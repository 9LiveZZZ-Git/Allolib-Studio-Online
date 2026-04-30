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

#include "al_WebFile.hpp"

// cgltf is forward-declared via opaque pointers so this header doesn't
// pull the 7k-line cgltf.h into every TU. Implementation lives in
// al_WebGLTF.cpp where CGLTF_IMPLEMENTATION is defined.
struct cgltf_data;

namespace al {

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

private:
    static bool extractAllPrimitives(const cgltf_data* data,
                                     Mesh& combined,
                                     std::vector<Mesh>* perPrim);

    std::string       mUrl;
    Mesh              mCombined;
    std::vector<Mesh> mPrimitives;
    bool              mReady = false;
    LoadCallback      mCallback;

    // Owned cgltf_data, freed in dtor. Held only when parseAndRetain was
    // used so per-primitive node hierarchies stay queryable. Static
    // parse() form frees immediately after extraction.
    cgltf_data*       mData = nullptr;
};

} // namespace al

#endif // AL_WEB_GLTF_HPP
