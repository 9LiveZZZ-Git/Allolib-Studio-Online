/**
 * Native Scene loader (M8.6)
 *
 * Native equivalent of al_WebScene.hpp providing al::WebScene with the
 * same API names as the studio side. User source can reference
 * al::WebScene and al::Scene-shaped methods on both targets.
 *
 * Setup for native projects (only needed if the user opts to use the
 * studio-fork API on the desktop side):
 *   1. Drop cgltf.h on the include path.
 *   2. In ONE .cpp file, define CGLTF_IMPLEMENTATION before including
 *      this header.
 *   3. Include this header where you reference al::WebScene.
 *
 * Most vanilla AlloLib projects don't need this file — they use
 * upstream al::Scene from al_ext/assets3d/al_Asset.hpp directly.
 * This shim exists so the exported source from Studio Online builds
 * unchanged when paired with the native_compat layer.
 */

#ifndef AL_NATIVE_SCENE_HPP
#define AL_NATIVE_SCENE_HPP

#include "al_NativeGLTF.hpp"

namespace al {

class WebScene {
public:
    static WebScene* import(const std::string& path) {
        auto* s = new WebScene();
        s->mInner.load(path);
        return s;
    }

    unsigned int meshes() const {
        return static_cast<unsigned int>(mInner.primitiveCount());
    }
    void mesh(unsigned int i, Mesh& dst) const {
        if (i >= mInner.primitiveCount()) return;
        dst.copy(mInner.primitiveMesh(i));
    }
    void meshAll(Mesh& dst) const { dst.copy(mInner.mesh()); }

    void getBounds(Vec3f& mn, Vec3f& mx) const {
        const auto& verts = mInner.mesh().vertices();
        if (verts.empty()) { mn = mx = Vec3f(0, 0, 0); return; }
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

    WebGLTF&       gltf()       { return mInner; }
    const WebGLTF& gltf() const { return mInner; }

private:
    WebGLTF mInner;
};

} // namespace al

#endif // AL_NATIVE_SCENE_HPP
