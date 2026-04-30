/**
 * AlloLib Web Scene loader (M8.6)
 *
 * Studio-Online wrapper around al::WebGLTF that exposes the same API
 * surface as upstream al::Scene (al_ext/assets3d/al_Asset.hpp). Lets
 * vanilla AlloLib code that uses al::Scene compile and run on the web
 * after a single transpiler rewrite of the symbol name and include
 * path — no #ifdef gymnastics in user code.
 *
 * Mirrored API (matches upstream al_Asset.hpp):
 *   static WebScene* import(const std::string& path);
 *   unsigned int meshes() const;
 *   void mesh(unsigned int i, Mesh& dst) const;
 *   void meshAll(Mesh& dst) const;
 *   void getBounds(Vec3f& min, Vec3f& max) const;
 *
 * Studio-fork-only extensions (no vanilla equivalent):
 *   - sampleAnimation(idx, time)
 *   - animatedMesh()
 *   - primitiveMaterial(i)  (PBR — vanilla al::Scene's Material is Phong)
 * Available via the underlying gltf() accessor when user code opts in.
 *
 * Caller owns the returned WebScene* (matches al::Scene::import which
 * also returns a heap pointer the user must delete).
 */

#ifndef AL_WEB_SCENE_HPP
#define AL_WEB_SCENE_HPP

#include "al_WebGLTF.hpp"

namespace al {

class WebScene {
public:
    /// Synchronous-API import (matches al::Scene::import). On web the
    /// underlying WebGLTF::load is async via WebFile::loadFromURL — but
    /// because WebFile uses fetch() and the asset overlay synthesises
    /// Responses immediately for project-uploaded assets, this returns
    /// a populated WebScene* in the common case. For network-fetched
    /// assets the mesh will arrive a few frames later and `meshes()`
    /// will return 0 until then.
    static WebScene* import(const std::string& path) {
        auto* s = new WebScene();
        s->mInner.load(path);
        return s;
    }

    /// Number of primitives in the scene. Each primitive maps to one
    /// mesh slot in al::Scene's terminology.
    unsigned int meshes() const {
        return static_cast<unsigned int>(mInner.primitiveCount());
    }

    /// Read primitive `i` into `dst`. Mirrors al::Scene::mesh(i, dst).
    void mesh(unsigned int i, Mesh& dst) const {
        if (i >= mInner.primitiveCount()) return;
        dst.copy(mInner.primitiveMesh(i));
    }

    /// Read every primitive into `dst` (concatenated). Mirrors
    /// al::Scene::meshAll(dst).
    void meshAll(Mesh& dst) const { dst.copy(mInner.mesh()); }

    /// Get axis-aligned bounding box of the combined geometry.
    void getBounds(Vec3f& mn, Vec3f& mx) const {
        const auto& verts = mInner.mesh().vertices();
        if (verts.empty()) {
            mn = mx = Vec3f(0, 0, 0);
            return;
        }
        mn = mx = verts[0];
        for (const auto& v : verts) {
            mn.x = v.x < mn.x ? v.x : mn.x;
            mn.y = v.y < mn.y ? v.y : mn.y;
            mn.z = v.z < mn.z ? v.z : mn.z;
            mx.x = v.x > mx.x ? v.x : mx.x;
            mx.y = v.y > mx.y ? v.y : mx.y;
            mx.z = v.z > mx.z ? v.z : mx.z;
        }
    }

    bool ready() const { return mInner.ready(); }

    /// Studio-fork extension hatch — gives access to the WebGLTF surface
    /// (animations, PBR materials, embedded images) for code that opts
    /// into studio-only features. Vanilla AlloLib code never reaches
    /// this method.
    WebGLTF&       gltf()       { return mInner; }
    const WebGLTF& gltf() const { return mInner; }

private:
    WebGLTF mInner;
};

} // namespace al

#endif // AL_WEB_SCENE_HPP
