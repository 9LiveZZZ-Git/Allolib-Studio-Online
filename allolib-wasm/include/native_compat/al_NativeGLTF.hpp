/**
 * Native glTF 2.0 loader (M8.4)
 *
 * Native equivalent of al_WebGLTF.hpp providing al::WebGLTF, al::WebGLTFMaterial,
 * al::WebGLTFImage with the SAME class names — no symbol renames, so user source
 * is byte-identical between the studio (WASM) and native AlloLib builds.
 *
 * Setup for native projects:
 *   1. Drop cgltf.h next to this header (or anywhere on -I).
 *      Available at https://github.com/jkuhlmann/cgltf (single header, MIT).
 *   2. In ONE .cpp file in your project, define the implementation:
 *        #define CGLTF_IMPLEMENTATION
 *        #include "cgltf.h"
 *      (Same convention as stb_image.h.)
 *   3. Include this header where you use al::WebGLTF:
 *        #include "native_compat/al_NativeGLTF.hpp"
 *
 * Usage (identical to web):
 *   al::WebGLTF gltf;
 *   gltf.load("/path/to/Box.glb", [&](bool ok) {
 *     if (ok) g.draw(gltf.mesh());
 *   });
 *
 * Differences from web:
 *   - load() is synchronous on native (file I/O is fast on disk vs the web
 *     fetch path). The callback fires before load() returns.
 *   - Image decode is unimplemented here — embedded image bytes are still
 *     populated in WebGLTFImage::bytes for callers to feed to stb_image
 *     or similar.
 */

#ifndef AL_NATIVE_GLTF_HPP
#define AL_NATIVE_GLTF_HPP

#include <cstdint>
#include <cstddef>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <functional>
#include <string>
#include <vector>

#include "cgltf.h"

#include "al/graphics/al_Mesh.hpp"
#include "al/math/al_Vec.hpp"
#include "al/types/al_Color.hpp"

namespace al {

// ─── Public API structs (mirror al_WebGLTF.hpp 1:1) ───────────────────────

struct WebGLTFMaterial {
    Color baseColorFactor{1.0f, 1.0f, 1.0f, 1.0f};
    float metallicFactor   = 1.0f;
    float roughnessFactor  = 1.0f;
    Vec3f emissiveFactor   {0.0f, 0.0f, 0.0f};
    float normalScale      = 1.0f;
    float occlusionStrength = 1.0f;
    bool  doubleSided      = false;
    bool  alphaBlend       = false;
    bool  unlit            = false;

    int baseColorTextureIndex     = -1;
    int metallicRoughnessTextureIndex = -1;
    int normalTextureIndex        = -1;
    int occlusionTextureIndex     = -1;
    int emissiveTextureIndex      = -1;

    Vec2f baseColorUVScale {1.0f, 1.0f};
    Vec2f baseColorUVOffset{0.0f, 0.0f};

    std::string name;
};

struct WebGLTFImage {
    std::vector<uint8_t> bytes;
    std::string mimeType;
    std::string name;
};

struct WebGLTFAnimation {
    std::string name;
    float duration = 0.0f;
    size_t channelCount = 0;
};

struct WebGLTFSkinInfo {
    std::string name;
    size_t jointCount = 0;
    int skeletonRoot = -1;
};

// ─── WebGLTF (native impl) ────────────────────────────────────────────────

class WebGLTF {
public:
    using LoadCallback = std::function<void(bool success)>;

    WebGLTF() = default;
    ~WebGLTF() { if (mData) { cgltf_free(mData); mData = nullptr; } }

    WebGLTF(const WebGLTF&) = delete;
    WebGLTF& operator=(const WebGLTF&) = delete;

    static bool parse(const uint8_t* data, size_t size, Mesh& out) {
        cgltf_options opts{};
        cgltf_data* parsed = nullptr;
        if (cgltf_parse(&opts, data, size, &parsed) != cgltf_result_success) {
            std::printf("[WebGLTF] cgltf_parse failed\n");
            return false;
        }
        if (cgltf_load_buffers(&opts, parsed, nullptr) != cgltf_result_success) {
            std::printf("[WebGLTF] cgltf_load_buffers failed\n");
            cgltf_free(parsed);
            return false;
        }
        bool ok = extractAllPrimitives(parsed, out, nullptr, nullptr);
        cgltf_free(parsed);
        return ok;
    }

    bool parseAndRetain(const uint8_t* data, size_t size,
                        const std::string& filePathHint = "") {
        if (mData) { cgltf_free(mData); mData = nullptr; }

        cgltf_options opts{};
        if (cgltf_parse(&opts, data, size, &mData) != cgltf_result_success) {
            std::printf("[WebGLTF] cgltf_parse failed\n");
            return false;
        }
        const char* base = filePathHint.empty() ? nullptr : filePathHint.c_str();
        if (cgltf_load_buffers(&opts, mData, base) != cgltf_result_success) {
            std::printf("[WebGLTF] cgltf_load_buffers failed\n");
            cgltf_free(mData); mData = nullptr;
            return false;
        }

        mPrimitives.clear();
        mMaterials.clear();
        mImages.clear();
        mAnimations.clear();
        mSkins.clear();
        mCache.clear();
        bool ok = extractAllPrimitives(mData, mCombined, &mPrimitives, &mMaterials);
        extractImages(mData, mImages);
        buildSkinCache_();

        for (cgltf_size i = 0; i < mData->animations_count; ++i) {
            const cgltf_animation* a = &mData->animations[i];
            WebGLTFAnimation info;
            if (a->name) info.name = a->name;
            info.channelCount = a->channels_count;
            for (cgltf_size s = 0; s < a->samplers_count; ++s) {
                const cgltf_accessor* in = a->samplers[s].input;
                if (in && in->has_max && in->count > 0)
                    info.duration = std::max(info.duration, in->max[0]);
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

        mAnimated.reset();
        mAnimated.primitive(Mesh::TRIANGLES);
        mAnimated.copy(mCombined);

        mReady = ok;
        std::printf("[WebGLTF] extracted: %zu primitives, %zu materials, %zu images, %zu animations, %zu skins\n",
                    mPrimitives.size(), mMaterials.size(), mImages.size(),
                    mAnimations.size(), mSkins.size());
        return ok;
    }

    /// Synchronous on native — callback fires before load() returns.
    void load(const std::string& url) {
        mUrl = url;
        std::ifstream f(url, std::ios::binary | std::ios::ate);
        if (!f) {
            std::printf("[WebGLTF] cannot open %s\n", url.c_str());
            if (mCallback) mCallback(false);
            return;
        }
        std::streamsize size = f.tellg();
        f.seekg(0);
        std::vector<unsigned char> bytes(size);
        if (!f.read(reinterpret_cast<char*>(bytes.data()), size)) {
            if (mCallback) mCallback(false);
            return;
        }
        bool ok = parseAndRetain(bytes.data(), bytes.size(), url);
        if (mCallback) mCallback(ok);
    }
    void load(const std::string& url, LoadCallback cb) {
        mCallback = std::move(cb);
        load(url);
    }

    bool ready() const { return mReady; }
    const std::string& url() const { return mUrl; }

    const Mesh& mesh() const { return mCombined; }
    Mesh&       mesh()       { return mCombined; }

    size_t primitiveCount() const { return mPrimitives.size(); }
    const Mesh& primitiveMesh(size_t i) const { return mPrimitives.at(i); }
    const WebGLTFMaterial& primitiveMaterial(size_t i) const { return mMaterials.at(i); }

    size_t imageCount() const { return mImages.size(); }
    const WebGLTFImage& image(size_t i) const { return mImages.at(i); }

    size_t animationCount() const { return mAnimations.size(); }
    const WebGLTFAnimation& animation(size_t i) const { return mAnimations.at(i); }
    size_t skinCount() const { return mSkins.size(); }
    const WebGLTFSkinInfo& skin(size_t i) const { return mSkins.at(i); }

    void sampleAnimation(size_t animIdx, float time) {
        if (!mData || animIdx >= mData->animations_count) return;
        const cgltf_animation* anim = &mData->animations[animIdx];
        if (mAnimations[animIdx].duration > 0.f) {
            time = std::fmod(time, mAnimations[animIdx].duration);
            if (time < 0.f) time += mAnimations[animIdx].duration;
        }
        // Update animated nodes' TRS — same logic as web side.
        for (cgltf_size c = 0; c < anim->channels_count; ++c) {
            const cgltf_animation_channel* ch = &anim->channels[c];
            if (!ch->target_node || !ch->sampler) continue;
            const cgltf_animation_sampler* sampler = ch->sampler;
            if (!sampler->input || !sampler->output) continue;
            cgltf_size n = sampler->input->count;
            if (n == 0) continue;
            auto readT = [&](cgltf_size i) {
                float v = 0.f; cgltf_accessor_read_float(sampler->input, i, &v, 1); return v;
            };
            cgltf_size i0 = 0, i1 = 0; float u = 0.f;
            if (time <= readT(0))     { i0 = i1 = 0; }
            else if (time >= readT(n - 1)) { i0 = i1 = n - 1; }
            else {
                for (cgltf_size i = 0; i + 1 < n; ++i) {
                    float t0 = readT(i), t1 = readT(i + 1);
                    if (time >= t0 && time <= t1) {
                        float dt = t1 - t0;
                        u = dt > 1e-9f ? (time - t0) / dt : 0.f;
                        i0 = i; i1 = i + 1; break;
                    }
                }
            }
            cgltf_node* node = ch->target_node;
            switch (ch->target_path) {
                case cgltf_animation_path_type_translation: {
                    float a[3], b[3];
                    cgltf_accessor_read_float(sampler->output, i0, a, 3);
                    cgltf_accessor_read_float(sampler->output, i1, b, 3);
                    for (int k = 0; k < 3; ++k) node->translation[k] = a[k] + (b[k] - a[k]) * u;
                    node->has_translation = 1;
                    break;
                }
                case cgltf_animation_path_type_rotation: {
                    float a[4], b[4];
                    cgltf_accessor_read_float(sampler->output, i0, a, 4);
                    cgltf_accessor_read_float(sampler->output, i1, b, 4);
                    float dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
                    if (dot < 0.f) { for (int k = 0; k < 4; ++k) b[k] = -b[k]; dot = -dot; }
                    float r[4];
                    if (dot > 0.9995f) {
                        for (int k = 0; k < 4; ++k) r[k] = a[k] + (b[k] - a[k]) * u;
                    } else {
                        float th = std::acos(dot);
                        float s = std::sin(th);
                        float wA = std::sin((1 - u) * th) / s;
                        float wB = std::sin(u * th) / s;
                        for (int k = 0; k < 4; ++k) r[k] = a[k] * wA + b[k] * wB;
                    }
                    float n2 = std::sqrt(r[0]*r[0]+r[1]*r[1]+r[2]*r[2]+r[3]*r[3]);
                    if (n2 > 1e-9f) for (int k = 0; k < 4; ++k) r[k] /= n2;
                    for (int k = 0; k < 4; ++k) node->rotation[k] = r[k];
                    node->has_rotation = 1;
                    break;
                }
                case cgltf_animation_path_type_scale: {
                    float a[3], b[3];
                    cgltf_accessor_read_float(sampler->output, i0, a, 3);
                    cgltf_accessor_read_float(sampler->output, i1, b, 3);
                    for (int k = 0; k < 3; ++k) node->scale[k] = a[k] + (b[k] - a[k]) * u;
                    node->has_scale = 1;
                    break;
                }
                default: break;
            }
            node->has_matrix = 0;
        }
        rebuildAnimatedMesh();
    }

    const Mesh& animatedMesh() const { return mAnimated; }

private:
    // ─── M8.3b skin-weighted blending state + helpers ─────────────────────
    struct SkinnedPrim {
        cgltf_node*          node = nullptr;
        const cgltf_skin*    skin = nullptr;
        std::vector<Vec3f>   positions;
        std::vector<Vec3f>   normals;
        std::vector<Vec2f>   uvs;
        std::vector<Color>   colors;
        std::vector<uint16_t>joints;
        std::vector<float>   weights;
        std::vector<uint32_t>indices;
        cgltf_primitive_type type = cgltf_primitive_type_triangles;
    };
    std::vector<SkinnedPrim> mCache;

    static void mat4MulCM_(const float a[16], const float b[16], float r[16]) {
        float t[16];
        for (int c = 0; c < 4; ++c)
            for (int row = 0; row < 4; ++row)
                t[c*4 + row] = a[0*4+row]*b[c*4+0] + a[1*4+row]*b[c*4+1]
                             + a[2*4+row]*b[c*4+2] + a[3*4+row]*b[c*4+3];
        for (int i = 0; i < 16; ++i) r[i] = t[i];
    }
    static void mat4ApplyPosCM_(const float m[16], const Vec3f& p, Vec3f& o) {
        o.x = m[0]*p.x + m[4]*p.y + m[8] *p.z + m[12];
        o.y = m[1]*p.x + m[5]*p.y + m[9] *p.z + m[13];
        o.z = m[2]*p.x + m[6]*p.y + m[10]*p.z + m[14];
    }
    static void mat4ApplyNrmCM_(const float m[16], const Vec3f& n, Vec3f& o) {
        o.x = m[0]*n.x + m[4]*n.y + m[8] *n.z;
        o.y = m[1]*n.x + m[5]*n.y + m[9] *n.z;
        o.z = m[2]*n.x + m[6]*n.y + m[10]*n.z;
        o.normalize();
    }

    static void cacheNode_(const cgltf_node* node, std::vector<SkinnedPrim>& out) {
        if (node->mesh) {
            for (cgltf_size i = 0; i < node->mesh->primitives_count; ++i) {
                const cgltf_primitive* prim = &node->mesh->primitives[i];
                if (prim->type != cgltf_primitive_type_triangles &&
                    prim->type != cgltf_primitive_type_triangle_strip &&
                    prim->type != cgltf_primitive_type_triangle_fan) continue;
                SkinnedPrim sp;
                sp.node = const_cast<cgltf_node*>(node);
                sp.skin = node->skin;
                sp.type = prim->type;
                const cgltf_accessor *posAcc=nullptr,*nrmAcc=nullptr,*uvAcc=nullptr,
                                     *colAcc=nullptr,*jntAcc=nullptr,*wgtAcc=nullptr;
                for (cgltf_size a = 0; a < prim->attributes_count; ++a) {
                    const auto* at = &prim->attributes[a];
                    switch (at->type) {
                        case cgltf_attribute_type_position: if (!posAcc) posAcc=at->data; break;
                        case cgltf_attribute_type_normal:   if (!nrmAcc) nrmAcc=at->data; break;
                        case cgltf_attribute_type_texcoord: if (!uvAcc)  uvAcc =at->data; break;
                        case cgltf_attribute_type_color:    if (!colAcc) colAcc=at->data; break;
                        case cgltf_attribute_type_joints:   if (!jntAcc) jntAcc=at->data; break;
                        case cgltf_attribute_type_weights:  if (!wgtAcc) wgtAcc=at->data; break;
                        default: break;
                    }
                }
                if (!posAcc) continue;
                const cgltf_size n = posAcc->count;
                sp.positions.resize(n);
                {
                    std::vector<float> tmp(n*3);
                    cgltf_accessor_unpack_floats(posAcc, tmp.data(), tmp.size());
                    for (cgltf_size k=0;k<n;++k) sp.positions[k] = Vec3f(tmp[k*3],tmp[k*3+1],tmp[k*3+2]);
                }
                if (nrmAcc && nrmAcc->count==n) {
                    sp.normals.resize(n);
                    std::vector<float> tmp(n*3);
                    cgltf_accessor_unpack_floats(nrmAcc, tmp.data(), tmp.size());
                    for (cgltf_size k=0;k<n;++k) sp.normals[k] = Vec3f(tmp[k*3],tmp[k*3+1],tmp[k*3+2]);
                }
                if (uvAcc && uvAcc->count==n) {
                    sp.uvs.resize(n);
                    std::vector<float> tmp(n*2);
                    cgltf_accessor_unpack_floats(uvAcc, tmp.data(), tmp.size());
                    for (cgltf_size k=0;k<n;++k) sp.uvs[k] = Vec2f(tmp[k*2],tmp[k*2+1]);
                }
                if (colAcc && colAcc->count==n) {
                    sp.colors.resize(n);
                    const cgltf_size comps = cgltf_num_components(colAcc->type);
                    std::vector<float> tmp(n*comps);
                    cgltf_accessor_unpack_floats(colAcc, tmp.data(), tmp.size());
                    for (cgltf_size k=0;k<n;++k) {
                        Color c(1,1,1,1);
                        c.r = tmp[k*comps+0];
                        if (comps>1) c.g = tmp[k*comps+1];
                        if (comps>2) c.b = tmp[k*comps+2];
                        if (comps>3) c.a = tmp[k*comps+3];
                        sp.colors[k] = c;
                    }
                }
                if (jntAcc && wgtAcc && jntAcc->count==n && wgtAcc->count==n) {
                    sp.joints.resize(n*4);
                    sp.weights.resize(n*4);
                    for (cgltf_size k=0;k<n;++k) {
                        cgltf_uint j[4] = {0,0,0,0};
                        cgltf_accessor_read_uint(jntAcc, k, j, 4);
                        sp.joints[k*4+0]=(uint16_t)j[0]; sp.joints[k*4+1]=(uint16_t)j[1];
                        sp.joints[k*4+2]=(uint16_t)j[2]; sp.joints[k*4+3]=(uint16_t)j[3];
                        cgltf_accessor_read_float(wgtAcc, k, &sp.weights[k*4], 4);
                    }
                }
                const cgltf_size idxCount = prim->indices ? prim->indices->count : n;
                sp.indices.resize(idxCount);
                for (cgltf_size k=0;k<idxCount;++k) {
                    sp.indices[k] = prim->indices
                        ? (uint32_t)cgltf_accessor_read_index(prim->indices, k)
                        : (uint32_t)k;
                }
                out.push_back(std::move(sp));
            }
        }
        for (cgltf_size i=0; i<node->children_count; ++i) cacheNode_(node->children[i], out);
    }

    void buildSkinCache_() {
        mCache.clear();
        if (!mData) return;
        const cgltf_scene* scene = mData->scene
            ? mData->scene
            : (mData->scenes_count>0 ? &mData->scenes[0] : nullptr);
        if (scene) {
            for (cgltf_size i=0;i<scene->nodes_count;++i) cacheNode_(scene->nodes[i], mCache);
        } else {
            for (cgltf_size i=0;i<mData->nodes_count;++i)
                if (mData->nodes[i].parent==nullptr) cacheNode_(&mData->nodes[i], mCache);
        }
    }

    void rebuildAnimatedMesh() {
        mAnimated.reset();
        mAnimated.primitive(Mesh::TRIANGLES);
        if (!mData) return;
        std::vector<std::vector<float>> jointMatrices(mData->skins_count);
        for (cgltf_size s=0;s<mData->skins_count;++s) {
            const cgltf_skin* sk = &mData->skins[s];
            jointMatrices[s].resize(sk->joints_count * 16);
            std::vector<float> ibm(sk->joints_count * 16, 0.f);
            for (cgltf_size j=0;j<sk->joints_count;++j) {
                ibm[j*16+0]=ibm[j*16+5]=ibm[j*16+10]=ibm[j*16+15]=1.f;
            }
            if (sk->inverse_bind_matrices) {
                cgltf_accessor_unpack_floats(sk->inverse_bind_matrices, ibm.data(), ibm.size());
            }
            for (cgltf_size j=0;j<sk->joints_count;++j) {
                float jw[16];
                cgltf_node_transform_world(sk->joints[j], jw);
                mat4MulCM_(jw, &ibm[j*16], &jointMatrices[s][j*16]);
            }
        }
        for (const auto& sp : mCache) {
            const bool skinned = sp.skin && !sp.joints.empty() && !sp.weights.empty();
            int skinIdx = -1;
            if (skinned) {
                for (cgltf_size s=0;s<mData->skins_count;++s)
                    if (&mData->skins[s] == sp.skin) { skinIdx=(int)s; break; }
            }
            auto transformVertex = [&](size_t v, Vec3f& outP, Vec3f& outN) {
                if (skinned && skinIdx >= 0) {
                    float blend[16] = {0};
                    const float* w = &sp.weights[v*4];
                    const uint16_t* j = &sp.joints[v*4];
                    for (int k=0;k<4;++k) {
                        if (w[k] <= 0.f) continue;
                        if (j[k] >= mData->skins[skinIdx].joints_count) continue;
                        const float* jm = &jointMatrices[skinIdx][j[k]*16];
                        for (int i=0;i<16;++i) blend[i] += jm[i] * w[k];
                    }
                    mat4ApplyPosCM_(blend, sp.positions[v], outP);
                    if (!sp.normals.empty()) mat4ApplyNrmCM_(blend, sp.normals[v], outN);
                } else {
                    float xform[16];
                    cgltf_node_transform_world(sp.node, xform);
                    mat4ApplyPosCM_(xform, sp.positions[v], outP);
                    if (!sp.normals.empty()) mat4ApplyNrmCM_(xform, sp.normals[v], outN);
                }
            };
            auto emit = [&](uint32_t v) {
                Vec3f p, n;
                transformVertex(v, p, n);
                mAnimated.vertex(p);
                if (!sp.normals.empty()) mAnimated.normal(n);
                if (!sp.uvs.empty()) mAnimated.texCoord(sp.uvs[v].x, sp.uvs[v].y);
                if (!sp.colors.empty()) mAnimated.color(sp.colors[v]);
            };
            const auto& idx = sp.indices;
            const size_t idxCount = idx.size();
            if (sp.type == cgltf_primitive_type_triangles) {
                for (size_t i=0; i+2<idxCount; i+=3) { emit(idx[i]); emit(idx[i+1]); emit(idx[i+2]); }
            } else if (sp.type == cgltf_primitive_type_triangle_strip) {
                for (size_t i=0; i+2<idxCount; ++i) {
                    if (i%2==0) { emit(idx[i]); emit(idx[i+1]); emit(idx[i+2]); }
                    else        { emit(idx[i+1]); emit(idx[i]); emit(idx[i+2]); }
                }
            } else if (sp.type == cgltf_primitive_type_triangle_fan) {
                if (idxCount >= 3) {
                    for (size_t i=1; i+1<idxCount; ++i) {
                        emit(idx[0]); emit(idx[i]); emit(idx[i+1]);
                    }
                }
            }
        }
    }

    // ─── extraction helpers (mirror al_WebGLTF.cpp logic line-for-line) ───

    static void apply4x4Pos(const float m[16], const Vec3f& v, Vec3f& out) {
        out.x = m[0]*v.x + m[4]*v.y + m[8] *v.z + m[12];
        out.y = m[1]*v.x + m[5]*v.y + m[9] *v.z + m[13];
        out.z = m[2]*v.x + m[6]*v.y + m[10]*v.z + m[14];
    }
    static void apply4x4Nrm(const float m[16], const Vec3f& n, Vec3f& out) {
        out.x = m[0]*n.x + m[4]*n.y + m[8] *n.z;
        out.y = m[1]*n.x + m[5]*n.y + m[9] *n.z;
        out.z = m[2]*n.x + m[6]*n.y + m[10]*n.z;
        out.normalize();
    }

    static bool extractPrimitive(const cgltf_node* node,
                                 const cgltf_primitive* prim,
                                 Mesh& out) {
        if (prim->type != cgltf_primitive_type_triangles &&
            prim->type != cgltf_primitive_type_triangle_strip &&
            prim->type != cgltf_primitive_type_triangle_fan) return false;

        float xform[16];
        cgltf_node_transform_world(node, xform);

        const cgltf_accessor *posAcc=nullptr,*nrmAcc=nullptr,*uvAcc=nullptr,*colAcc=nullptr;
        for (cgltf_size i=0; i<prim->attributes_count; ++i) {
            const auto* a = &prim->attributes[i];
            if (a->type==cgltf_attribute_type_position && !posAcc) posAcc=a->data;
            if (a->type==cgltf_attribute_type_normal   && !nrmAcc) nrmAcc=a->data;
            if (a->type==cgltf_attribute_type_texcoord && !uvAcc)  uvAcc =a->data;
            if (a->type==cgltf_attribute_type_color    && !colAcc) colAcc=a->data;
        }
        if (!posAcc) return false;

        const cgltf_size vCount = posAcc->count;
        std::vector<Vec3f> positions(vCount);
        std::vector<Vec3f> normals;
        std::vector<Vec2f> uvs;
        std::vector<Color> colors;

        {
            std::vector<float> tmp(vCount*3);
            cgltf_accessor_unpack_floats(posAcc, tmp.data(), tmp.size());
            for (cgltf_size i=0;i<vCount;++i)
                apply4x4Pos(xform, Vec3f(tmp[i*3],tmp[i*3+1],tmp[i*3+2]), positions[i]);
        }
        if (nrmAcc && nrmAcc->count==vCount) {
            normals.resize(vCount);
            std::vector<float> tmp(vCount*3);
            cgltf_accessor_unpack_floats(nrmAcc, tmp.data(), tmp.size());
            for (cgltf_size i=0;i<vCount;++i)
                apply4x4Nrm(xform, Vec3f(tmp[i*3],tmp[i*3+1],tmp[i*3+2]), normals[i]);
        }
        if (uvAcc && uvAcc->count==vCount) {
            uvs.resize(vCount);
            std::vector<float> tmp(vCount*2);
            cgltf_accessor_unpack_floats(uvAcc, tmp.data(), tmp.size());
            for (cgltf_size i=0;i<vCount;++i) uvs[i]=Vec2f(tmp[i*2],tmp[i*2+1]);
        }
        if (colAcc && colAcc->count==vCount) {
            colors.resize(vCount);
            const cgltf_size comps = cgltf_num_components(colAcc->type);
            std::vector<float> tmp(vCount*comps);
            cgltf_accessor_unpack_floats(colAcc, tmp.data(), tmp.size());
            for (cgltf_size i=0;i<vCount;++i) {
                Color c(1,1,1,1);
                c.r = tmp[i*comps + 0];
                if (comps>1) c.g = tmp[i*comps+1];
                if (comps>2) c.b = tmp[i*comps+2];
                if (comps>3) c.a = tmp[i*comps+3];
                colors[i] = c;
            }
        }

        auto append = [&](cgltf_size idx) {
            if (idx >= positions.size()) return;
            out.vertex(positions[idx]);
            if (!normals.empty()) out.normal(normals[idx]);
            if (!uvs.empty())     out.texCoord(uvs[idx].x, uvs[idx].y);
            if (!colors.empty())  out.color(colors[idx]);
        };
        auto getIdx = [&](cgltf_size i)->cgltf_size{
            if (prim->indices) return cgltf_accessor_read_index(prim->indices, i);
            return i;
        };
        const cgltf_size idxCount = prim->indices ? prim->indices->count : vCount;
        out.primitive(Mesh::TRIANGLES);

        if (prim->type == cgltf_primitive_type_triangles) {
            for (cgltf_size i=0; i+2<idxCount; i+=3) {
                append(getIdx(i)); append(getIdx(i+1)); append(getIdx(i+2));
            }
        } else if (prim->type == cgltf_primitive_type_triangle_strip) {
            for (cgltf_size i=0; i+2<idxCount; ++i) {
                if (i%2==0) { append(getIdx(i));   append(getIdx(i+1)); append(getIdx(i+2)); }
                else        { append(getIdx(i+1)); append(getIdx(i));   append(getIdx(i+2)); }
            }
        } else { // triangle_fan
            if (idxCount>=3) {
                const cgltf_size center = getIdx(0);
                for (cgltf_size i=1; i+1<idxCount; ++i) {
                    append(center); append(getIdx(i)); append(getIdx(i+1));
                }
            }
        }
        return true;
    }

    static int materialImageIndex(const cgltf_data* data, const cgltf_texture* tex) {
        if (!tex || !tex->image) return -1;
        return static_cast<int>(tex->image - data->images);
    }

    static WebGLTFMaterial extractMaterial(const cgltf_data* data,
                                           const cgltf_material* mat) {
        WebGLTFMaterial m;
        if (!mat) return m;
        if (mat->name) m.name = mat->name;
        m.doubleSided = mat->double_sided != 0;
        m.alphaBlend  = (mat->alpha_mode == cgltf_alpha_mode_blend);
        m.unlit       = mat->unlit != 0;

        const float emStrength = mat->has_emissive_strength
            ? mat->emissive_strength.emissive_strength : 1.0f;
        m.emissiveFactor = Vec3f(
            mat->emissive_factor[0]*emStrength,
            mat->emissive_factor[1]*emStrength,
            mat->emissive_factor[2]*emStrength);

        if (mat->has_pbr_metallic_roughness) {
            const auto& pbr = mat->pbr_metallic_roughness;
            m.baseColorFactor = Color(
                pbr.base_color_factor[0], pbr.base_color_factor[1],
                pbr.base_color_factor[2], pbr.base_color_factor[3]);
            m.metallicFactor  = pbr.metallic_factor;
            m.roughnessFactor = pbr.roughness_factor;
            m.baseColorTextureIndex =
                materialImageIndex(data, pbr.base_color_texture.texture);
            m.metallicRoughnessTextureIndex =
                materialImageIndex(data, pbr.metallic_roughness_texture.texture);
            if (pbr.base_color_texture.has_transform) {
                m.baseColorUVScale = Vec2f(pbr.base_color_texture.transform.scale[0],
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

    static void walkSceneNode(const cgltf_data* data,
                              const cgltf_node* node,
                              Mesh& combined,
                              std::vector<Mesh>* perPrim,
                              std::vector<WebGLTFMaterial>* perMat) {
        if (node->mesh) {
            for (cgltf_size i=0; i<node->mesh->primitives_count; ++i) {
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
        for (cgltf_size i=0; i<node->children_count; ++i) {
            walkSceneNode(data, node->children[i], combined, perPrim, perMat);
        }
    }

    static bool extractAllPrimitives(const cgltf_data* data,
                                     Mesh& combined,
                                     std::vector<Mesh>* perPrim,
                                     std::vector<WebGLTFMaterial>* perMat) {
        if (!data) return false;
        combined.reset();
        combined.primitive(Mesh::TRIANGLES);
        const cgltf_scene* scene = data->scene
            ? data->scene
            : (data->scenes_count>0 ? &data->scenes[0] : nullptr);
        if (scene) {
            for (cgltf_size i=0; i<scene->nodes_count; ++i)
                walkSceneNode(data, scene->nodes[i], combined, perPrim, perMat);
        } else {
            for (cgltf_size i=0; i<data->nodes_count; ++i) {
                if (data->nodes[i].parent==nullptr)
                    walkSceneNode(data, &data->nodes[i], combined, perPrim, perMat);
            }
        }
        return combined.vertices().size()>0;
    }

    static void extractImages(const cgltf_data* data,
                              std::vector<WebGLTFImage>& out) {
        out.clear();
        if (!data) return;
        out.reserve(data->images_count);
        for (cgltf_size i=0; i<data->images_count; ++i) {
            const cgltf_image* img = &data->images[i];
            WebGLTFImage entry;
            if (img->name)      entry.name     = img->name;
            if (img->mime_type) entry.mimeType = img->mime_type;
            if (img->buffer_view) {
                const cgltf_buffer_view* bv = img->buffer_view;
                const uint8_t* base = static_cast<const uint8_t*>(bv->buffer->data);
                if (base) {
                    const uint8_t* src = base + bv->offset;
                    entry.bytes.assign(src, src + bv->size);
                    if (entry.mimeType.empty()) {
                        if (bv->size>=8 &&
                            src[0]==0x89 && src[1]==0x50 && src[2]==0x4E && src[3]==0x47)
                            entry.mimeType = "image/png";
                        else if (bv->size>=3 &&
                                 src[0]==0xFF && src[1]==0xD8 && src[2]==0xFF)
                            entry.mimeType = "image/jpeg";
                    }
                }
            } else if (img->uri) {
                entry.name = std::string("uri:") + img->uri;
            }
            out.push_back(std::move(entry));
        }
    }

    std::string                  mUrl;
    Mesh                         mCombined;
    Mesh                         mAnimated;
    std::vector<Mesh>            mPrimitives;
    std::vector<WebGLTFMaterial> mMaterials;
    std::vector<WebGLTFImage>    mImages;
    std::vector<WebGLTFAnimation> mAnimations;
    std::vector<WebGLTFSkinInfo>  mSkins;
    bool                         mReady = false;
    LoadCallback                 mCallback;
    cgltf_data*                  mData = nullptr;
};

} // namespace al

#endif // AL_NATIVE_GLTF_HPP
