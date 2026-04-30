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
        bool ok = extractAllPrimitives(mData, mCombined, &mPrimitives, &mMaterials);
        extractImages(mData, mImages);
        mReady = ok;
        std::printf("[WebGLTF] extracted: %zu primitives, %zu materials, %zu images\n",
                    mPrimitives.size(), mMaterials.size(), mImages.size());
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

private:
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
    std::vector<Mesh>            mPrimitives;
    std::vector<WebGLTFMaterial> mMaterials;
    std::vector<WebGLTFImage>    mImages;
    bool                         mReady = false;
    LoadCallback                 mCallback;
    cgltf_data*                  mData = nullptr;
};

} // namespace al

#endif // AL_NATIVE_GLTF_HPP
