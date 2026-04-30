#ifndef AL_WEB_GLTF_HPP
#define AL_WEB_GLTF_HPP

/**
 * AlloLib Web glTF 2.0 loader (M8.1 — static meshes)
 *
 * Parses .gltf / .glb files via the vendored cgltf single-header library
 * and produces al::Mesh instances ready for the existing Graphics pipeline.
 *
 * Scope of M8.1:
 *   - static meshes only (no skeletal animation — M8.3)
 *   - no PBR material binding yet (M8.2)
 *   - synchronous parse from in-memory buffer; async fetch via WebFile
 *   - flattens all primitives in the file into a single al::Mesh (or one
 *     al::Mesh per primitive via primitiveCount() / primitiveMesh(i))
 *
 * Replaces the Assimp-based al::Scene (al_ext/assets3d/al_Asset.hpp) for
 * web builds. Native parity is provided by the M8.4 native_compat header.
 *
 * Usage:
 *   al::WebGLTF gltf;
 *   gltf.load("/assets/meshes/suzanne.glb", [&](bool ok) {
 *     if (ok) g.draw(gltf.mesh());
 *   });
 *
 * Or synchronous from bytes:
 *   al::Mesh m;
 *   if (al::WebGLTF::parse(bytes.data(), bytes.size(), m)) { ... }
 */

#include <cstdint>
#include <cstddef>
#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "al/graphics/al_Mesh.hpp"
#include "al/math/al_Vec.hpp"
#include "al/types/al_Color.hpp"

#include "al_WebFile.hpp"

// cgltf forward declarations — keep the 7k-line cgltf.h out of every TU
// that includes al_WebGLTF.hpp. Pointers to these types in SkinnedPrim
// only need a forward decl. The cgltf_primitive_type enum can't be
// forward-declared portably (C-style typedef enum has no fixed underlying
// type), so we store the primitive type as a plain int and cast at use
// sites in al_WebGLTF.cpp.
struct cgltf_data;
struct cgltf_node;
struct cgltf_skin;

namespace al {

/// Per-primitive PBR material extracted from a glTF asset (M8.2).
/// Mirrors glTF 2.0's metallic-roughness workflow plus optional emissive
/// and normal maps. Texture indices are -1 when absent; otherwise they
/// index into the WebGLTF instance's image table (see imageCount()).
struct WebGLTFMaterial {
    // Factors (glTF defaults baked in)
    Color baseColorFactor{1.0f, 1.0f, 1.0f, 1.0f};
    float metallicFactor   = 1.0f;
    float roughnessFactor  = 1.0f;
    Vec3f emissiveFactor   {0.0f, 0.0f, 0.0f};
    float normalScale      = 1.0f;
    float occlusionStrength = 1.0f;
    bool  doubleSided      = false;
    bool  alphaBlend       = false;
    bool  unlit            = false;

    // Texture indices into WebGLTF::imageCount() (-1 = not present)
    int baseColorTextureIndex     = -1;
    int metallicRoughnessTextureIndex = -1;
    int normalTextureIndex        = -1;
    int occlusionTextureIndex     = -1;
    int emissiveTextureIndex      = -1;

    // UV transforms (KHR_texture_transform; identity by default)
    Vec2f baseColorUVScale {1.0f, 1.0f};
    Vec2f baseColorUVOffset{0.0f, 0.0f};

    // Human-readable name for diagnostics
    std::string name;
};

/// Raw image bytes extracted from a glTF buffer view. mimeType is "image/png"
/// or "image/jpeg" (the only types glTF 2.0 mandates support for). Decoded
/// pixels live in a separate al::WebImage / al::Texture — this struct just
/// holds the source bytes so callers can hand them to the browser decoder
/// or a CPU decoder of their choice.
struct WebGLTFImage {
    std::vector<uint8_t> bytes;
    std::string mimeType;
    std::string name;
};

/// Diagnostic metadata for an animation track (M8.3).
/// `duration` is the maximum sampler-input time across all of the
/// animation's channels — i.e. the loop length when playing back.
struct WebGLTFAnimation {
    std::string name;
    float duration = 0.0f;   // seconds
    size_t channelCount = 0; // number of property channels (T/R/S per joint)
};

/// Diagnostic metadata for a skin (M8.3). joint count is what
/// sampleAnimation walks; skeletonRoot is informational.
struct WebGLTFSkinInfo {
    std::string name;
    size_t jointCount = 0;
    int skeletonRoot = -1;   // node index or -1 if unspecified
};

class WebGLTF {
public:
    using LoadCallback = std::function<void(bool success)>;

    WebGLTF() = default;
    ~WebGLTF();

    WebGLTF(const WebGLTF&) = delete;
    WebGLTF& operator=(const WebGLTF&) = delete;

    /// Parse glTF or GLB bytes synchronously. Populates `out` with all
    /// primitives in the file flattened into one mesh (TRIANGLES). Returns
    /// false on parse error or empty asset.
    static bool parse(const uint8_t* data, size_t size, Mesh& out);

    /// Parse and keep the cgltf_data alive on this instance so callers can
    /// query primitiveCount() / primitiveMesh(i) for per-primitive access.
    /// The combined mesh is also available via mesh().
    bool parseAndRetain(const uint8_t* data, size_t size);

    /// Async load via WebFile (browser fetch). Mesh becomes available when
    /// `ready()` returns true. Optional callback fires on completion.
    void load(const std::string& url);
    void load(const std::string& url, LoadCallback cb);

    bool ready() const { return mReady; }
    const std::string& url() const { return mUrl; }

    /// The flattened mesh containing every primitive.
    const Mesh& mesh() const { return mCombined; }
    Mesh&       mesh()       { return mCombined; }

    /// Per-primitive access — populated by parseAndRetain. Returns 0 if the
    /// instance was used via the static `parse()` form only.
    size_t primitiveCount() const { return mPrimitives.size(); }
    const Mesh& primitiveMesh(size_t i) const { return mPrimitives.at(i); }

    /// Per-primitive PBR material (M8.2). Index parallel to primitiveMesh(i).
    /// If the primitive has no material, returns a default WebGLTFMaterial
    /// (baseColor white, metallic=1, roughness=1, no textures).
    const WebGLTFMaterial& primitiveMaterial(size_t i) const { return mMaterials.at(i); }

    /// Embedded image table (M8.2). Each image's bytes are extracted from
    /// the glTF buffer (or external URI in non-GLB assets) and held here
    /// for the user to upload via WebImage / al::Texture.
    size_t imageCount() const { return mImages.size(); }
    const WebGLTFImage& image(size_t i) const { return mImages.at(i); }

    /// Animation accessors (M8.3).
    size_t animationCount() const { return mAnimations.size(); }
    const WebGLTFAnimation& animation(size_t i) const { return mAnimations.at(i); }

    size_t skinCount() const { return mSkins.size(); }
    const WebGLTFSkinInfo& skin(size_t i) const { return mSkins.at(i); }

    /// Sample animation `animIdx` at `time` seconds (looped via fmod against
    /// the animation's duration). Walks each channel: linearly interpolates
    /// the sampler input/output keyframes to derive new translation /
    /// rotation / scale on the target node, then re-walks joint hierarchies
    /// to compute world matrices and re-skins the vertices. After this call
    /// `animatedMesh()` reflects the new pose. (Identity behaviour for
    /// non-animated assets — call is harmless.)
    void sampleAnimation(size_t animIdx, float time);

    /// Mesh recomputed by the most recent sampleAnimation() call. Empty
    /// (matches `mesh()`) before any sample. Use this in onDraw when the
    /// asset is animated; use `mesh()` for static art.
    const Mesh& animatedMesh() const { return mAnimated; }

private:
    /// Per-primitive bind-pose cache used for skin-weighted vertex
    /// blending in sampleAnimation (M8.3b). Populated at parseAndRetain;
    /// each entry holds the bind-pose vertex stream PLUS the JOINTS_0 /
    /// WEIGHTS_0 attribute streams when the primitive is skinned.
    /// Non-skinned primitives use `node` to apply the rigid world
    /// transform; skinned primitives walk the joint-matrix table.
    ///
    /// Private because it references cgltf types directly. cacheNode is
    /// a private static member (not an anonymous-namespace free function)
    /// so it can construct these from inside the class without exposing
    /// cgltf.h into user-include paths.
    struct SkinnedPrim {
        cgltf_node*       node = nullptr;
        const cgltf_skin* skin = nullptr;
        std::vector<Vec3f>    positions;
        std::vector<Vec3f>    normals;
        std::vector<Vec2f>    uvs;
        std::vector<Color>    colors;
        std::vector<uint16_t> joints;   // 4 per vertex (flattened)
        std::vector<float>    weights;  // 4 per vertex (flattened)
        std::vector<uint32_t> indices;  // empty if non-indexed
        // Stored as int to avoid pulling cgltf.h into the public header.
        // cast to cgltf_primitive_type in al_WebGLTF.cpp at use sites;
        // 4 = cgltf_primitive_type_triangles per the enum order.
        int                   type = 4;
    };

    static void cacheNode(const cgltf_node* node,
                          std::vector<SkinnedPrim>& out);

    static bool extractAllPrimitives(const cgltf_data* data,
                                     Mesh& combined,
                                     std::vector<Mesh>* perPrim,
                                     std::vector<WebGLTFMaterial>* perMat);
    static void extractImages(const cgltf_data* data,
                              std::vector<WebGLTFImage>& out);
    void buildSkinCache();
    void rebuildAnimatedMesh();

    std::string                  mUrl;
    Mesh                         mCombined;
    Mesh                         mAnimated;     // M8.3 — re-skinned per sampleAnimation
    std::vector<Mesh>            mPrimitives;
    std::vector<WebGLTFMaterial> mMaterials;
    std::vector<WebGLTFImage>    mImages;
    std::vector<WebGLTFAnimation> mAnimations;  // M8.3 metadata
    std::vector<WebGLTFSkinInfo>  mSkins;       // M8.3 metadata
    std::vector<SkinnedPrim>     mCache;        // M8.3b — bind-pose + skin attrs
    bool                         mReady = false;
    LoadCallback                 mCallback;

    // Owned cgltf_data, freed in dtor. Held only when parseAndRetain was
    // used so per-primitive node hierarchies stay queryable. Static
    // parse() form frees immediately after extraction.
    cgltf_data*       mData = nullptr;
};

} // namespace al

#endif // AL_WEB_GLTF_HPP
