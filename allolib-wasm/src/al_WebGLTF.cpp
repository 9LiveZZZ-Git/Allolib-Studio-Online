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

void walkSceneNode(const cgltf_node* node,
                   Mesh& combined,
                   std::vector<Mesh>* perPrim) {
    if (node->mesh) {
        for (cgltf_size i = 0; i < node->mesh->primitives_count; ++i) {
            const cgltf_primitive* prim = &node->mesh->primitives[i];
            if (perPrim) {
                Mesh m;
                if (extractPrimitive(node, prim, m)) {
                    perPrim->push_back(std::move(m));
                }
            }
            extractPrimitive(node, prim, combined);
        }
    }
    for (cgltf_size i = 0; i < node->children_count; ++i) {
        walkSceneNode(node->children[i], combined, perPrim);
    }
}

} // anonymous namespace

// ─── WebGLTF impl ──────────────────────────────────────────────────────────

bool WebGLTF::extractAllPrimitives(const cgltf_data* data,
                                   Mesh& combined,
                                   std::vector<Mesh>* perPrim) {
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
            walkSceneNode(scene->nodes[i], combined, perPrim);
        }
    } else {
        // No scene block — walk every node, treating each as a root.
        for (cgltf_size i = 0; i < data->nodes_count; ++i) {
            if (data->nodes[i].parent == nullptr) {
                walkSceneNode(&data->nodes[i], combined, perPrim);
            }
        }
    }

    return combined.vertices().size() > 0;
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

    bool ok = extractAllPrimitives(parsed, out, nullptr);
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
    bool ok = extractAllPrimitives(mData, mCombined, &mPrimitives);
    mReady = ok;
    return ok;
}

void WebGLTF::load(const std::string& url) {
    mReady = false;
    mUrl = url;
    mCombined.reset();
    mPrimitives.clear();
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
