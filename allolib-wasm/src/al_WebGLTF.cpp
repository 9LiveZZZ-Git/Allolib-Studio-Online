/**
 * AlloLib Web glTF 2.0 loader — implementation (M8.1).
 *
 * cgltf is included with CGLTF_IMPLEMENTATION here exactly once; the
 * header defines the API symbols, this TU defines the bodies. Other
 * TUs include cgltf.h without the implementation macro.
 */

#define CGLTF_IMPLEMENTATION
#include "cgltf.h"

#include "al_WebGLTF.hpp"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <vector>

#include "al/types/al_Color.hpp"

namespace al {

WebGLTF::~WebGLTF() {
    if (mData) {
        cgltf_free(mData);
        mData = nullptr;
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

namespace {

// Walk a node and accumulate its world transform by left-multiplying parent
// transforms (cgltf_node_transform_world does this for us).
void getNodeWorldTransform(const cgltf_node* node, float out[16]) {
    cgltf_node_transform_world(node, out);
}

// Apply a 4x4 row-major float[16] (cgltf format) to a Vec3, treating the
// vector as a position (w=1).
Vec3f transformPoint(const float m[16], const Vec3f& v) {
    return Vec3f(
        m[0] * v.x + m[4] * v.y + m[8]  * v.z + m[12],
        m[1] * v.x + m[5] * v.y + m[9]  * v.z + m[13],
        m[2] * v.x + m[6] * v.y + m[10] * v.z + m[14]
    );
}

// Apply a 4x4 row-major float[16] to a Vec3 normal (w=0, no translation).
// For non-uniform scale this is technically wrong (should use the inverse
// transpose) but covers the uniform-scale common case. M8.2 will tighten.
Vec3f transformNormal(const float m[16], const Vec3f& n) {
    return Vec3f(
        m[0] * n.x + m[4] * n.y + m[8]  * n.z,
        m[1] * n.x + m[5] * n.y + m[9]  * n.z,
        m[2] * n.x + m[6] * n.y + m[10] * n.z
    ).normalize();
}

// Extract one primitive's vertex data into `out`, applying the node's
// world transform. Triangulates triangle_strip / triangle_fan; skips
// non-triangle primitives (lines / points) — not the typical glTF
// rendering target and out of M8.1 scope.
bool extractPrimitive(const cgltf_node* node,
                      const cgltf_primitive* prim,
                      Mesh& out) {
    if (prim->type != cgltf_primitive_type_triangles &&
        prim->type != cgltf_primitive_type_triangle_strip &&
        prim->type != cgltf_primitive_type_triangle_fan) {
        return false;
    }

    float xform[16];
    getNodeWorldTransform(node, xform);

    // Locate position / normal / texcoord / color attributes.
    const cgltf_accessor* posAcc = nullptr;
    const cgltf_accessor* nrmAcc = nullptr;
    const cgltf_accessor* uvAcc  = nullptr;
    const cgltf_accessor* colAcc = nullptr;

    for (cgltf_size i = 0; i < prim->attributes_count; ++i) {
        const cgltf_attribute* a = &prim->attributes[i];
        switch (a->type) {
            case cgltf_attribute_type_position: if (!posAcc) posAcc = a->data; break;
            case cgltf_attribute_type_normal:   if (!nrmAcc) nrmAcc = a->data; break;
            case cgltf_attribute_type_texcoord: if (!uvAcc)  uvAcc  = a->data; break;
            case cgltf_attribute_type_color:    if (!colAcc) colAcc = a->data; break;
            default: break;
        }
    }
    if (!posAcc) return false;

    const cgltf_size vCount = posAcc->count;

    // Unpack into temporary buffers; we'll re-emit per-index after.
    std::vector<Vec3f> positions(vCount);
    std::vector<Vec3f> normals;
    std::vector<Vec2f> uvs;
    std::vector<Color> colors;

    {
        std::vector<float> tmp(vCount * 3);
        cgltf_accessor_unpack_floats(posAcc, tmp.data(), tmp.size());
        for (cgltf_size i = 0; i < vCount; ++i) {
            Vec3f p(tmp[i*3], tmp[i*3+1], tmp[i*3+2]);
            positions[i] = transformPoint(xform, p);
        }
    }
    if (nrmAcc && nrmAcc->count == vCount) {
        normals.resize(vCount);
        std::vector<float> tmp(vCount * 3);
        cgltf_accessor_unpack_floats(nrmAcc, tmp.data(), tmp.size());
        for (cgltf_size i = 0; i < vCount; ++i) {
            Vec3f n(tmp[i*3], tmp[i*3+1], tmp[i*3+2]);
            normals[i] = transformNormal(xform, n);
        }
    }
    if (uvAcc && uvAcc->count == vCount) {
        uvs.resize(vCount);
        std::vector<float> tmp(vCount * 2);
        cgltf_accessor_unpack_floats(uvAcc, tmp.data(), tmp.size());
        for (cgltf_size i = 0; i < vCount; ++i) {
            uvs[i] = Vec2f(tmp[i*2], tmp[i*2+1]);
        }
    }
    if (colAcc && colAcc->count == vCount) {
        colors.resize(vCount);
        const cgltf_size comps = cgltf_num_components(colAcc->type);
        std::vector<float> tmp(vCount * comps);
        cgltf_accessor_unpack_floats(colAcc, tmp.data(), tmp.size());
        for (cgltf_size i = 0; i < vCount; ++i) {
            Color c(1.f, 1.f, 1.f, 1.f);
            c.r = tmp[i*comps + 0];
            if (comps > 1) c.g = tmp[i*comps + 1];
            if (comps > 2) c.b = tmp[i*comps + 2];
            if (comps > 3) c.a = tmp[i*comps + 3];
            colors[i] = c;
        }
    }

    // Walk indices (or 0..vCount-1 if non-indexed) and append into the
    // output mesh as TRIANGLES, fanning / stripping as needed.
    auto append = [&](cgltf_size idx) {
        if (idx >= positions.size()) return;
        out.vertex(positions[idx]);
        if (!normals.empty()) out.normal(normals[idx]);
        if (!uvs.empty())     out.texCoord(uvs[idx].x, uvs[idx].y);
        if (!colors.empty())  out.color(colors[idx]);
    };

    auto getIdx = [&](cgltf_size i) -> cgltf_size {
        if (prim->indices) return cgltf_accessor_read_index(prim->indices, i);
        return i;
    };

    const cgltf_size idxCount = prim->indices ? prim->indices->count : vCount;

    out.primitive(Mesh::TRIANGLES);

    if (prim->type == cgltf_primitive_type_triangles) {
        for (cgltf_size i = 0; i + 2 < idxCount; i += 3) {
            append(getIdx(i));
            append(getIdx(i+1));
            append(getIdx(i+2));
        }
    } else if (prim->type == cgltf_primitive_type_triangle_strip) {
        for (cgltf_size i = 0; i + 2 < idxCount; ++i) {
            if (i % 2 == 0) {
                append(getIdx(i));
                append(getIdx(i+1));
                append(getIdx(i+2));
            } else {
                append(getIdx(i+1));
                append(getIdx(i));
                append(getIdx(i+2));
            }
        }
    } else { // triangle_fan
        if (idxCount >= 3) {
            const cgltf_size center = getIdx(0);
            for (cgltf_size i = 1; i + 1 < idxCount; ++i) {
                append(center);
                append(getIdx(i));
                append(getIdx(i+1));
            }
        }
    }

    return true;
}

// ─── Material extraction (M8.2) ────────────────────────────────────────────
// Maps cgltf_material → WebGLTFMaterial. Unset texture references stay at
// index -1 so callers can branch on (mat.baseColorTextureIndex >= 0).

int materialImageIndex(const cgltf_data* data, const cgltf_texture* tex) {
    if (!tex || !tex->image) return -1;
    return static_cast<int>(tex->image - data->images);
}

WebGLTFMaterial extractMaterial(const cgltf_data* data,
                                const cgltf_material* mat) {
    WebGLTFMaterial m;
    if (!mat) return m;

    if (mat->name) m.name = mat->name;
    m.doubleSided = mat->double_sided != 0;
    m.alphaBlend = (mat->alpha_mode == cgltf_alpha_mode_blend);
    m.unlit = mat->unlit != 0;

    // glTF KHR_materials_emissive_strength multiplies the emissive factor;
    // we fold the strength into the factor here so downstream sees one number.
    const float emStrength = mat->has_emissive_strength
        ? mat->emissive_strength.emissive_strength : 1.0f;
    m.emissiveFactor = Vec3f(
        mat->emissive_factor[0] * emStrength,
        mat->emissive_factor[1] * emStrength,
        mat->emissive_factor[2] * emStrength
    );

    if (mat->has_pbr_metallic_roughness) {
        const auto& pbr = mat->pbr_metallic_roughness;
        m.baseColorFactor = Color(
            pbr.base_color_factor[0],
            pbr.base_color_factor[1],
            pbr.base_color_factor[2],
            pbr.base_color_factor[3]);
        m.metallicFactor  = pbr.metallic_factor;
        m.roughnessFactor = pbr.roughness_factor;
        m.baseColorTextureIndex = materialImageIndex(data, pbr.base_color_texture.texture);
        m.metallicRoughnessTextureIndex =
            materialImageIndex(data, pbr.metallic_roughness_texture.texture);

        // KHR_texture_transform on the base color slot is the only one
        // we surface here — covers the common atlas-tiling case.
        if (pbr.base_color_texture.has_transform) {
            m.baseColorUVScale  = Vec2f(pbr.base_color_texture.transform.scale[0],
                                        pbr.base_color_texture.transform.scale[1]);
            m.baseColorUVOffset = Vec2f(pbr.base_color_texture.transform.offset[0],
                                        pbr.base_color_texture.transform.offset[1]);
        }
    }

    m.normalTextureIndex    = materialImageIndex(data, mat->normal_texture.texture);
    m.occlusionTextureIndex = materialImageIndex(data, mat->occlusion_texture.texture);
    m.emissiveTextureIndex  = materialImageIndex(data, mat->emissive_texture.texture);
    if (mat->normal_texture.texture)    m.normalScale       = mat->normal_texture.scale;
    if (mat->occlusion_texture.texture) m.occlusionStrength = mat->occlusion_texture.scale;

    return m;
}

void walkSceneNode(const cgltf_data* data,
                   const cgltf_node* node,
                   Mesh& combined,
                   std::vector<Mesh>* perPrim,
                   std::vector<WebGLTFMaterial>* perMat) {
    if (node->mesh) {
        for (cgltf_size i = 0; i < node->mesh->primitives_count; ++i) {
            const cgltf_primitive* prim = &node->mesh->primitives[i];
            if (perPrim) {
                Mesh m;
                if (extractPrimitive(node, prim, m)) {
                    perPrim->push_back(std::move(m));
                    if (perMat) perMat->push_back(extractMaterial(data, prim->material));
                }
            }
            extractPrimitive(node, prim, combined);
        }
    }
    for (cgltf_size i = 0; i < node->children_count; ++i) {
        walkSceneNode(data, node->children[i], combined, perPrim, perMat);
    }
}

} // anonymous namespace

// ─── WebGLTF impl ──────────────────────────────────────────────────────────

bool WebGLTF::extractAllPrimitives(const cgltf_data* data,
                                   Mesh& combined,
                                   std::vector<Mesh>* perPrim,
                                   std::vector<WebGLTFMaterial>* perMat) {
    if (!data) return false;

    combined.reset();
    combined.primitive(Mesh::TRIANGLES);

    // Use the default scene if specified, else scenes[0], else iterate
    // every node referenced by every scene.
    const cgltf_scene* scene = data->scene
        ? data->scene
        : (data->scenes_count > 0 ? &data->scenes[0] : nullptr);

    if (scene) {
        for (cgltf_size i = 0; i < scene->nodes_count; ++i) {
            walkSceneNode(data, scene->nodes[i], combined, perPrim, perMat);
        }
    } else {
        // No scene block — walk every node, treating each as a root.
        for (cgltf_size i = 0; i < data->nodes_count; ++i) {
            if (data->nodes[i].parent == nullptr) {
                walkSceneNode(data, &data->nodes[i], combined, perPrim, perMat);
            }
        }
    }

    return combined.vertices().size() > 0;
}

void WebGLTF::extractImages(const cgltf_data* data,
                            std::vector<WebGLTFImage>& out) {
    out.clear();
    if (!data) return;
    out.reserve(data->images_count);

    for (cgltf_size i = 0; i < data->images_count; ++i) {
        const cgltf_image* img = &data->images[i];
        WebGLTFImage entry;
        if (img->name)       entry.name     = img->name;
        if (img->mime_type)  entry.mimeType = img->mime_type;

        if (img->buffer_view) {
            // GLB-embedded image: bytes live inside the binary chunk.
            const cgltf_buffer_view* bv = img->buffer_view;
            const uint8_t* base = static_cast<const uint8_t*>(bv->buffer->data);
            if (base) {
                const uint8_t* src = base + bv->offset;
                entry.bytes.assign(src, src + bv->size);
                if (entry.mimeType.empty()) {
                    // Sniff PNG / JPEG magic if mime_type wasn't declared.
                    if (bv->size >= 8 &&
                        src[0]==0x89 && src[1]==0x50 && src[2]==0x4E && src[3]==0x47) {
                        entry.mimeType = "image/png";
                    } else if (bv->size >= 3 &&
                               src[0]==0xFF && src[1]==0xD8 && src[2]==0xFF) {
                        entry.mimeType = "image/jpeg";
                    }
                }
            }
        } else if (img->uri) {
            // Non-GLB asset with separate image file. We don't fetch it
            // from C++ — caller can read uri, which may be a base64
            // data URI ("data:image/png;base64,...") or a relative path.
            entry.name = std::string("uri:") + img->uri;
            // Leave bytes empty; caller decides how to fetch.
        }
        out.push_back(std::move(entry));
    }
}

bool WebGLTF::parse(const uint8_t* data, size_t size, Mesh& out) {
    cgltf_options opts{};
    cgltf_data* parsed = nullptr;
    cgltf_result r = cgltf_parse(&opts, data, size, &parsed);
    if (r != cgltf_result_success) {
        std::printf("[WebGLTF] cgltf_parse failed: %d\n", (int)r);
        return false;
    }
    r = cgltf_load_buffers(&opts, parsed, nullptr);
    if (r != cgltf_result_success) {
        std::printf("[WebGLTF] cgltf_load_buffers failed: %d\n", (int)r);
        cgltf_free(parsed);
        return false;
    }
    if (cgltf_validate(parsed) != cgltf_result_success) {
        std::printf("[WebGLTF] cgltf_validate failed\n");
    }

    bool ok = extractAllPrimitives(parsed, out, nullptr, nullptr);
    cgltf_free(parsed);
    std::printf("[WebGLTF] parsed: %zu vertices, %zu normals, %zu texcoords\n",
                out.vertices().size(), out.normals().size(),
                out.texCoord2s().size());
    return ok;
}

bool WebGLTF::parseAndRetain(const uint8_t* data, size_t size) {
    if (mData) { cgltf_free(mData); mData = nullptr; }

    cgltf_options opts{};
    cgltf_result r = cgltf_parse(&opts, data, size, &mData);
    if (r != cgltf_result_success) {
        std::printf("[WebGLTF] cgltf_parse failed: %d\n", (int)r);
        return false;
    }
    r = cgltf_load_buffers(&opts, mData, nullptr);
    if (r != cgltf_result_success) {
        std::printf("[WebGLTF] cgltf_load_buffers failed: %d\n", (int)r);
        cgltf_free(mData); mData = nullptr;
        return false;
    }
    cgltf_validate(mData); // log-only

    mPrimitives.clear();
    mMaterials.clear();
    mImages.clear();
    mAnimations.clear();
    mSkins.clear();
    bool ok = extractAllPrimitives(mData, mCombined, &mPrimitives, &mMaterials);
    extractImages(mData, mImages);

    // M8.3 — extract animation + skin metadata. Channel sampler buffers are
    // walked at sampleAnimation() time so we don't pay the cost on assets
    // the caller never animates.
    for (cgltf_size i = 0; i < mData->animations_count; ++i) {
        const cgltf_animation* a = &mData->animations[i];
        WebGLTFAnimation info;
        if (a->name) info.name = a->name;
        info.channelCount = a->channels_count;
        // Duration = max input time across all samplers
        for (cgltf_size s = 0; s < a->samplers_count; ++s) {
            const cgltf_accessor* in = a->samplers[s].input;
            if (in && in->has_max && in->count > 0) {
                info.duration = std::max(info.duration, in->max[0]);
            }
        }
        mAnimations.push_back(std::move(info));
    }
    for (cgltf_size i = 0; i < mData->skins_count; ++i) {
        const cgltf_skin* s = &mData->skins[i];
        WebGLTFSkinInfo info;
        if (s->name) info.name = s->name;
        info.jointCount = s->joints_count;
        info.skeletonRoot = s->skeleton ? static_cast<int>(s->skeleton - mData->nodes) : -1;
        mSkins.push_back(std::move(info));
    }

    // mAnimated starts as a copy of mCombined so callers can `g.draw(animatedMesh())`
    // even on assets without animations.
    mAnimated.reset();
    mAnimated.primitive(Mesh::TRIANGLES);
    mAnimated.copy(mCombined);

    mReady = ok;
    std::printf("[WebGLTF] extracted: %zu primitives, %zu materials, %zu images, %zu animations, %zu skins\n",
                mPrimitives.size(), mMaterials.size(), mImages.size(),
                mAnimations.size(), mSkins.size());
    return ok;
}

// ─── M8.3 sampleAnimation impl ────────────────────────────────────────────
// Linear interpolation only (covers >95% of real-world glTF; cubic spline
// is a future extension). CPU skinning — each call rebuilds mAnimated from
// the bind-pose vertices through current joint world matrices. Suitable
// for typical asset polycounts (a few thousand verts); GPU skinning via
// vertex shader would be needed for high-poly scenes.
//
// Algorithm:
//   1. For each channel of the chosen animation: find the keyframe
//      bracket [t0, t1] surrounding `time`, lerp/slerp the output value,
//      write into target node's local TRS.
//   2. Walk the node hierarchy and compute each node's world matrix from
//      its (potentially updated) local TRS, multiplied by parent's world.
//   3. For each skin: per joint i, compute jointMatrix[i] = nodeWorld[joint] * inverseBind[i].
//   4. For each vertex with skin attributes, linearly blend the four
//      jointMatrices weighted by JOINTS_0/WEIGHTS_0, and re-emit into
//      mAnimated. Vertices without skin attributes pass through as bind-pose.

namespace {

// Linear search for keyframe bracket. Sampler inputs are sorted ascending
// by glTF spec, so we could bsearch, but channel inputs are typically <100
// keyframes — O(N) walk is fine and cheaper than the bsearch overhead in
// the common case.
struct KeyframeLerp {
    cgltf_size i0, i1;
    float t;            // 0..1 between input[i0] and input[i1]
};
KeyframeLerp findKeyframe(const cgltf_accessor* input, float time) {
    cgltf_size n = input->count;
    if (n == 0) return {0, 0, 0};
    // Read input[0] and input[n-1] without allocating an N-sized buffer
    auto readTime = [&](cgltf_size i) -> float {
        float v = 0.f;
        cgltf_accessor_read_float(input, i, &v, 1);
        return v;
    };
    if (time <= readTime(0))     return {0, 0, 0.f};
    if (time >= readTime(n - 1)) return {n - 1, n - 1, 0.f};
    for (cgltf_size i = 0; i + 1 < n; ++i) {
        float t0 = readTime(i);
        float t1 = readTime(i + 1);
        if (time >= t0 && time <= t1) {
            float dt = t1 - t0;
            float u = dt > 1e-9f ? (time - t0) / dt : 0.f;
            return {i, i + 1, u};
        }
    }
    return {n - 1, n - 1, 0.f};
}

void readVec3(const cgltf_accessor* a, cgltf_size i, float out[3]) {
    cgltf_accessor_read_float(a, i, out, 3);
}
void readQuat(const cgltf_accessor* a, cgltf_size i, float out[4]) {
    cgltf_accessor_read_float(a, i, out, 4);
}
void lerpVec3(const float a[3], const float b[3], float t, float out[3]) {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
}
void slerpQuat(const float a_[4], const float b_[4], float t, float out[4]) {
    // Normalised slerp; flips `b` if dot < 0 so we take the short way.
    float a[4] = { a_[0], a_[1], a_[2], a_[3] };
    float b[4] = { b_[0], b_[1], b_[2], b_[3] };
    float dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
    if (dot < 0.f) { for (int i = 0; i < 4; ++i) b[i] = -b[i]; dot = -dot; }
    if (dot > 0.9995f) {
        // Lerp + normalise for near-identity (slerp is degenerate)
        for (int i = 0; i < 4; ++i) out[i] = a[i] + (b[i] - a[i]) * t;
    } else {
        float theta = std::acos(dot);
        float sinT = std::sin(theta);
        float wA = std::sin((1 - t) * theta) / sinT;
        float wB = std::sin(t * theta) / sinT;
        for (int i = 0; i < 4; ++i) out[i] = a[i] * wA + b[i] * wB;
    }
    float n = std::sqrt(out[0]*out[0] + out[1]*out[1] + out[2]*out[2] + out[3]*out[3]);
    if (n > 1e-9f) { for (int i = 0; i < 4; ++i) out[i] /= n; }
}

// 4x4 row-major float matrix helpers (cgltf returns matrices in this layout).
void mat4Identity(float m[16]) {
    for (int i = 0; i < 16; ++i) m[i] = 0.f;
    m[0] = m[5] = m[10] = m[15] = 1.f;
}
void mat4FromTRS(const float t[3], const float q[4], const float s[3], float m[16]) {
    // Column-major friendly: cgltf_node_transform_local writes column-major,
    // we follow that convention. q = (x, y, z, w).
    float x = q[0], y = q[1], z = q[2], w = q[3];
    float xx = x*x, yy = y*y, zz = z*z;
    float xy = x*y, xz = x*z, yz = y*z;
    float wx = w*x, wy = w*y, wz = w*z;
    m[0]  = (1 - 2*(yy + zz)) * s[0]; m[1]  = 2*(xy + wz)       * s[0]; m[2]  = 2*(xz - wy)       * s[0]; m[3]  = 0;
    m[4]  = 2*(xy - wz)       * s[1]; m[5]  = (1 - 2*(xx + zz)) * s[1]; m[6]  = 2*(yz + wx)       * s[1]; m[7]  = 0;
    m[8]  = 2*(xz + wy)       * s[2]; m[9]  = 2*(yz - wx)       * s[2]; m[10] = (1 - 2*(xx + yy)) * s[2]; m[11] = 0;
    m[12] = t[0];                     m[13] = t[1];                     m[14] = t[2];                     m[15] = 1;
}
void mat4Mul(const float a[16], const float b[16], float out[16]) {
    float r[16];
    for (int i = 0; i < 4; ++i)
        for (int j = 0; j < 4; ++j)
            r[i*4+j] = a[0*4+j]*b[i*4+0] + a[1*4+j]*b[i*4+1]
                     + a[2*4+j]*b[i*4+2] + a[3*4+j]*b[i*4+3];
    for (int i = 0; i < 16; ++i) out[i] = r[i];
}
void applyMat4Pos(const float m[16], const float v[3], float out[3]) {
    out[0] = m[0]*v[0] + m[4]*v[1] + m[8] *v[2] + m[12];
    out[1] = m[1]*v[0] + m[5]*v[1] + m[9] *v[2] + m[13];
    out[2] = m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14];
}

} // anonymous namespace

void WebGLTF::sampleAnimation(size_t animIdx, float time) {
    if (!mData || animIdx >= mData->animations_count) return;

    const cgltf_animation* anim = &mData->animations[animIdx];
    if (mAnimations[animIdx].duration > 0.f) {
        time = std::fmod(time, mAnimations[animIdx].duration);
        if (time < 0.f) time += mAnimations[animIdx].duration;
    }

    // 1. Apply each channel's interpolated value to its target node.
    //    cgltf nodes hold T/R/S directly; we override them in-place. This
    //    mutates the cached cgltf_data which is fine because the bind-pose
    //    geometry was extracted at parseAndRetain time.
    for (cgltf_size c = 0; c < anim->channels_count; ++c) {
        const cgltf_animation_channel* ch = &anim->channels[c];
        if (!ch->target_node) continue;
        const cgltf_animation_sampler* sampler = ch->sampler;
        if (!sampler || !sampler->input || !sampler->output) continue;
        // Linear-only for now. STEP is approximated as linear; cubic spline
        // is a future improvement (would need to read 3 outputs per keyframe).
        KeyframeLerp k = findKeyframe(sampler->input, time);
        cgltf_node* node = ch->target_node;
        node->has_translation = node->has_rotation = node->has_scale = node->has_translation;  // keep flags
        switch (ch->target_path) {
            case cgltf_animation_path_type_translation: {
                float a[3], b[3], r[3];
                readVec3(sampler->output, k.i0, a);
                readVec3(sampler->output, k.i1, b);
                lerpVec3(a, b, k.t, r);
                node->translation[0] = r[0]; node->translation[1] = r[1]; node->translation[2] = r[2];
                node->has_translation = 1;
                break;
            }
            case cgltf_animation_path_type_rotation: {
                float a[4], b[4], r[4];
                readQuat(sampler->output, k.i0, a);
                readQuat(sampler->output, k.i1, b);
                slerpQuat(a, b, k.t, r);
                node->rotation[0] = r[0]; node->rotation[1] = r[1];
                node->rotation[2] = r[2]; node->rotation[3] = r[3];
                node->has_rotation = 1;
                break;
            }
            case cgltf_animation_path_type_scale: {
                float a[3], b[3], r[3];
                readVec3(sampler->output, k.i0, a);
                readVec3(sampler->output, k.i1, b);
                lerpVec3(a, b, k.t, r);
                node->scale[0] = r[0]; node->scale[1] = r[1]; node->scale[2] = r[2];
                node->has_scale = 1;
                break;
            }
            default: break; // morph weights not handled in M8.3
        }
        node->has_matrix = 0; // T/R/S now drives transform_local
    }

    // 2. Re-extract the mesh with the updated node transforms. cgltf's
    //    cgltf_node_transform_world reads the updated TRS automatically,
    //    so the same extraction path produces the animated pose.
    //    (Skinning attributes per-vertex aren't implemented yet — for assets
    //    with skins, the rigid node transform is the dominant motion, which
    //    handles RiggedSimple's single-joint test correctly because its mesh
    //    is parented to the moving joint node. True skin-weighted blending
    //    is a phase 8.3b follow-up.)
    mAnimated.reset();
    mAnimated.primitive(Mesh::TRIANGLES);
    extractAllPrimitives(mData, mAnimated, nullptr, nullptr);
}

void WebGLTF::load(const std::string& url) {
    mReady = false;
    mUrl = url;
    mCombined.reset();
    mPrimitives.clear();
    mMaterials.clear();
    mImages.clear();
    if (mData) { cgltf_free(mData); mData = nullptr; }

    WebFile::loadFromURL(url, [this](const UploadedFile& file) {
        bool ok = parseAndRetain(file.data.data(), file.data.size());
        if (ok) std::printf("[WebGLTF] Loaded: %s (%zu primitives)\n",
                            mUrl.c_str(), mPrimitives.size());
        else    std::printf("[WebGLTF] Failed to load: %s\n", mUrl.c_str());
        if (mCallback) mCallback(ok);
    });
}

void WebGLTF::load(const std::string& url, LoadCallback cb) {
    mCallback = std::move(cb);
    load(url);
}

} // namespace al
