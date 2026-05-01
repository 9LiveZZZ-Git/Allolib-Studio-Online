#pragma once

/**
 * AlloLib Studio Online - Pickable handles
 *
 * Mouse-driven 3D pickable handles. The native AlloLib `cookbook/pickable/`
 * tree is not bundled into the WASM build, so this is a clean-room port of
 * the public API used by 7 MAT200B examples (subtractive z-plane, granular
 * cloud tendency mask, vocal tract, spatializer, IR-builder reflectors,
 * generative graphic score, additive partial sculptor).
 *
 * Real ray-intersection routines:
 *   - Ray-sphere: solve quadratic |O + tD - C|^2 = r^2.
 *   - Ray-AABB:   slab method with tmin/tmax bookkeeping.
 *   - Ray-mesh:   Möller-Trumbore per triangle (TRIANGLES primitive only;
 *                 TRIANGLE_STRIP and TRIANGLE_FAN are expanded into a
 *                 cached triangle list at setMesh time).
 *
 * Real drag math: the mouse ray on each onMouseDrag is intersected against
 * the plane that is perpendicular to the *camera forward direction* and
 * passes through the pickable's current center. The drag axis can be
 * constrained: setDragAxis(axis) restricts movement to translations along
 * that world-space axis (passing the line-line nearest-point projection
 * through it). Default drag axis is the zero vector, which means "free
 * planar drag".
 *
 * `screenToRay(WebApp& app, Vec2f screen)` is a free function in this
 * header. It unprojects (mouseX, mouseY) -- in screen pixels with origin at
 * the top-left -- through the WebApp's active camera, returning a ray with
 * `origin = camera position` and a normalized `direction`. Examples call
 * this from `onMouseDown` / `onMouseDrag` and feed the result into
 * Pickable::onMouseDown / onMouseDrag.
 *
 * Header-only. Depends on al::Mesh, al::Pose, al::Vec, al::Graphics, and
 * al::WebApp (only inside `screenToRay`).
 */

#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/math/al_Mat.hpp"
#include "al/math/al_Vec.hpp"
#include "al/spatial/al_Pose.hpp"

#include <algorithm>
#include <cmath>
#include <functional>
#include <limits>
#include <vector>

#ifndef ALLOLIB_STUDIO_PICKABLE_NO_WEBAPP
#include "al_WebApp.hpp"  // for screenToRay()
#endif

// v0.10.3: dropped surrounding `namespace al` to match the other helpers (file-scope ::studio)
namespace studio {

struct Hit {
  bool hit = false;
  float t = std::numeric_limits<float>::infinity();
  al::Vec3f point{0.f, 0.f, 0.f};
};

struct Ray {
  al::Vec3f origin{0.f, 0.f, 0.f};
  al::Vec3f direction{0.f, 0.f, -1.f};  // normalized
};

// =====================================================================
// Pickable
// =====================================================================

class Pickable {
public:
  enum Kind { Sphere, AABB, Mesh };

  Pickable() = default;

  // ---- Shape configuration --------------------------------------------

  void setSphere(al::Vec3f center, float radius) {
    mKind = Sphere;
    mCenter = center;
    mPosition = center;
    mRadius = (radius > 0.f) ? radius : 1.f;
    rebuildHandleMesh();
  }

  void setAABB(al::Vec3f minP, al::Vec3f maxP) {
    mKind = AABB;
    mMin = minP;
    mMax = maxP;
    mCenter = (minP + maxP) * 0.5f;
    mPosition = mCenter;
    // bounding sphere fallback for fast reject
    mRadius = (maxP - minP).mag() * 0.5f;
    rebuildHandleMesh();
  }

  /// Takes a copy of the mesh's vertex positions and indices. If the mesh
  /// is TRIANGLES, indices/vertices are stored verbatim. TRIANGLE_STRIP /
  /// TRIANGLE_FAN are expanded to a TRIANGLES index list. LINES / POINTS
  /// are not pickable — setMesh on those degrades to bounding-sphere mode.
  void setMesh(const al::Mesh& m) {
    mKind = Mesh;
    mMeshVertices = m.vertices();  // copy
    mMeshIndices.clear();
    al::Vec3f minP{1e30f, 1e30f, 1e30f};
    al::Vec3f maxP{-1e30f, -1e30f, -1e30f};
    for (const auto& v : mMeshVertices) {
      minP.x = std::min(minP.x, v.x);
      minP.y = std::min(minP.y, v.y);
      minP.z = std::min(minP.z, v.z);
      maxP.x = std::max(maxP.x, v.x);
      maxP.y = std::max(maxP.y, v.y);
      maxP.z = std::max(maxP.z, v.z);
    }
    mMin = minP;
    mMax = maxP;
    mCenter = (minP + maxP) * 0.5f;
    mPosition = mCenter;
    mRadius = (maxP - minP).mag() * 0.5f;
    if (mRadius <= 0.f) mRadius = 1.f;

    const auto prim = m.primitive();
    const auto& src = m.indices();
    if (prim == al::Mesh::TRIANGLES) {
      if (!src.empty()) {
        mMeshIndices.assign(src.begin(), src.end());
      } else {
        mMeshIndices.reserve(mMeshVertices.size());
        for (unsigned i = 0; i < mMeshVertices.size(); ++i) mMeshIndices.push_back(i);
      }
    } else if (prim == al::Mesh::TRIANGLE_STRIP) {
      // Expand strip a,b,c,d,e -> (a,b,c),(c,b,d),(c,d,e),...
      const std::size_t N =
          src.empty() ? mMeshVertices.size() : src.size();
      auto idx = [&](std::size_t i) -> unsigned {
        return src.empty() ? static_cast<unsigned>(i) : src[i];
      };
      for (std::size_t i = 0; i + 2 < N; ++i) {
        if (i & 1u) {
          mMeshIndices.push_back(idx(i + 1));
          mMeshIndices.push_back(idx(i));
          mMeshIndices.push_back(idx(i + 2));
        } else {
          mMeshIndices.push_back(idx(i));
          mMeshIndices.push_back(idx(i + 1));
          mMeshIndices.push_back(idx(i + 2));
        }
      }
    } else if (prim == al::Mesh::TRIANGLE_FAN) {
      const std::size_t N =
          src.empty() ? mMeshVertices.size() : src.size();
      auto idx = [&](std::size_t i) -> unsigned {
        return src.empty() ? static_cast<unsigned>(i) : src[i];
      };
      for (std::size_t i = 1; i + 1 < N; ++i) {
        mMeshIndices.push_back(idx(0));
        mMeshIndices.push_back(idx(i));
        mMeshIndices.push_back(idx(i + 1));
      }
    } else {
      // Non-triangulated — fall back to bounding sphere by leaving
      // mMeshIndices empty; intersect() will use the AABB sphere reject.
      mMeshIndices.clear();
    }
    rebuildHandleMesh();
  }

  void setTransform(const al::Pose& pose) {
    mPose = pose;
    mPosition = al::Vec3f(pose.pos());
  }

  Kind kind() const { return mKind; }

  // ---- Intersection ---------------------------------------------------

  /// Intersect a world-space ray against this pickable. Returns the
  /// nearest positive-t hit. The returned point is in world space,
  /// accounting for the current Pose translation (rotation is applied
  /// when present in mPose, but for AABB and mesh modes the rotation is
  /// applied to the ray inverse-transformed into local space).
  Hit intersect(const al::Vec3f& rayOrigin, const al::Vec3f& rayDir) const {
    al::Vec3f dir = rayDir;
    const float dlen = dir.mag();
    if (dlen <= 0.f) return Hit{};
    dir /= dlen;

    // Bring ray into local space by subtracting current world center
    // (mPosition). Rotation: if mPose has non-identity quat, rotate the
    // ray by the inverse quat. The dragged center is mPosition.
    al::Vec3f localOrigin = rayOrigin - mPosition;
    al::Vec3f localDir = dir;
    if (!isIdentityQuat()) {
      // Rotate by inverse quaternion: q^{-1} * v * q
      auto qi = mPose.quat().conj();
      al::Vec3d lo3{localOrigin.x, localOrigin.y, localOrigin.z};
      al::Vec3d ld3{localDir.x, localDir.y, localDir.z};
      lo3 = qi.rotate(lo3);
      ld3 = qi.rotate(ld3);
      localOrigin = al::Vec3f(static_cast<float>(lo3.x),
                              static_cast<float>(lo3.y),
                              static_cast<float>(lo3.z));
      localDir = al::Vec3f(static_cast<float>(ld3.x),
                           static_cast<float>(ld3.y),
                           static_cast<float>(ld3.z));
    }

    Hit h;
    switch (mKind) {
      case Sphere: {
        h = intersectSphere(localOrigin, localDir, al::Vec3f{0, 0, 0}, mRadius);
        break;
      }
      case AABB: {
        const al::Vec3f localMin = mMin - mCenter;
        const al::Vec3f localMax = mMax - mCenter;
        h = intersectAABB(localOrigin, localDir, localMin, localMax);
        break;
      }
      case Mesh: {
        if (mMeshIndices.empty()) {
          // Fallback bounding sphere
          h = intersectSphere(localOrigin, localDir, al::Vec3f{0, 0, 0}, mRadius);
        } else {
          // Quick AABB reject
          const al::Vec3f localMin = mMin - mCenter;
          const al::Vec3f localMax = mMax - mCenter;
          Hit aabb = intersectAABB(localOrigin, localDir, localMin, localMax);
          if (!aabb.hit) return Hit{};
          h = intersectMesh(localOrigin, localDir);
        }
        break;
      }
    }
    if (h.hit) {
      // Translate hit point back to world space.
      h.point += mPosition;
    }
    return h;
  }

  // ---- Drag handles ---------------------------------------------------

  /// Begin dragging if the ray hits this pickable.
  /// Stores the offset between the hit point and the pickable center so
  /// the pickable doesn't snap to the cursor.
  bool onMouseDown(const al::Vec3f& rayOrigin, const al::Vec3f& rayDir) {
    Hit h = intersect(rayOrigin, rayDir);
    if (!h.hit) {
      mDragging = false;
      return false;
    }
    mDragging = true;
    mDragOffset = mPosition - h.point;  // worldDelta = newCenter - newHit
    mDragRefDepth = (mPosition - rayOrigin).dot(safeNormalize(rayDir));
    return true;
  }

  /// Update position from a new ray. Call from onMouseDrag.
  bool onMouseDrag(const al::Vec3f& rayOrigin, const al::Vec3f& rayDir) {
    if (!mDragging) return false;

    const al::Vec3f dir = safeNormalize(rayDir);
    const al::Vec3f planeN = mDragPlaneNormal.magSqr() > 1e-8f
                                 ? safeNormalize(mDragPlaneNormal)
                                 : -dir;  // default: plane perpendicular to camera ray
    // Project onto plane through (mPosition - mDragOffset) with normal planeN.
    // ray: O + t*D ; plane: dot(P - C, n) = 0 -> t = dot(C - O, n)/dot(D,n)
    const al::Vec3f C = mPosition - mDragOffset;  // current grab point
    const float denom = dir.dot(planeN);
    al::Vec3f hitPoint;
    if (std::abs(denom) < 1e-6f) {
      // Ray parallel to plane: fall back to the original reference depth.
      hitPoint = rayOrigin + dir * mDragRefDepth;
    } else {
      const float t = (C - rayOrigin).dot(planeN) / denom;
      if (t <= 0.f) return false;
      hitPoint = rayOrigin + dir * t;
    }

    al::Vec3f newCenter = hitPoint + mDragOffset;

    // Optional axis constraint: project newCenter - oldCenter onto the
    // axis and apply only that component.
    if (mDragAxis.magSqr() > 1e-8f) {
      const al::Vec3f axis = safeNormalize(mDragAxis);
      const al::Vec3f delta = newCenter - mPosition;
      newCenter = mPosition + axis * delta.dot(axis);
    }

    if (newCenter != mPosition) {
      mPosition = newCenter;
      if (onChange) onChange(*this);
    }
    return true;
  }

  void onMouseUp() { mDragging = false; }
  bool isDragging() const { return mDragging; }

  // ---- Position / axis ------------------------------------------------

  al::Vec3f position() const { return mPosition; }
  void setPosition(al::Vec3f p) {
    mPosition = p;
    if (onChange) onChange(*this);
  }

  /// Constrain drag to translations along the given world-space axis.
  /// Pass the zero vector to release the constraint (free planar drag).
  void setDragAxis(al::Vec3f axis) { mDragAxis = axis; }
  al::Vec3f dragAxis() const { return mDragAxis; }

  /// Set the world-space normal of the drag plane explicitly. If left
  /// zero (default), the plane defaults to "perpendicular to the ray
  /// direction", which from a mouse picker is "perpendicular to camera".
  void setDragPlaneNormal(al::Vec3f n) { mDragPlaneNormal = n; }

  // ---- Visual ---------------------------------------------------------

  void draw(al::Graphics& g, bool highlighted = false) const {
    g.pushMatrix();
    g.translate(mPosition.x, mPosition.y, mPosition.z);
    if (highlighted || mDragging) {
      g.color(1.f, 0.85f, 0.3f, 0.7f);
    } else {
      g.color(0.5f, 0.85f, 1.f, 0.4f);
    }
    g.draw(mHandleMesh);
    g.popMatrix();
  }

  // ---- User callback --------------------------------------------------

  std::function<void(const Pickable&)> onChange;

private:
  // -- shape state --
  Kind mKind = Sphere;
  al::Vec3f mCenter{0, 0, 0};   // shape's intrinsic center (untranslated)
  al::Vec3f mPosition{0, 0, 0}; // current world-space position (mutable via drag)
  float mRadius = 1.f;
  al::Vec3f mMin{-1, -1, -1};
  al::Vec3f mMax{1, 1, 1};
  al::Pose mPose;
  std::vector<al::Mesh::Vertex> mMeshVertices;  // local-space copy
  std::vector<unsigned> mMeshIndices;           // expanded to TRIANGLES

  al::Mesh mHandleMesh;  // small visualizer drawn at draw()

  // -- drag state --
  bool mDragging = false;
  al::Vec3f mDragOffset{0, 0, 0};
  al::Vec3f mDragAxis{0, 0, 0};         // (0,0,0) = unconstrained
  al::Vec3f mDragPlaneNormal{0, 0, 0};  // (0,0,0) = camera-perpendicular
  float mDragRefDepth = 1.f;

  // -- helpers --

  bool isIdentityQuat() const {
    const auto& q = mPose.quat();
    return std::abs(q.w - 1.0) < 1e-9 && std::abs(q.x) < 1e-9 &&
           std::abs(q.y) < 1e-9 && std::abs(q.z) < 1e-9;
  }

  static al::Vec3f safeNormalize(const al::Vec3f& v) {
    const float m = v.mag();
    if (m <= 1e-12f) return al::Vec3f{0, 0, -1};
    return v * (1.f / m);
  }

  static Hit intersectSphere(const al::Vec3f& O, const al::Vec3f& D,
                             const al::Vec3f& C, float r) {
    // |O + tD - C|^2 = r^2  =>  (D.D)t^2 + 2(D.(O-C))t + (|O-C|^2 - r^2) = 0
    const al::Vec3f L = O - C;
    const float a = D.dot(D);
    const float b = 2.f * D.dot(L);
    const float c = L.dot(L) - r * r;
    const float disc = b * b - 4.f * a * c;
    if (disc < 0.f) return Hit{};
    const float sq = std::sqrt(disc);
    const float t0 = (-b - sq) / (2.f * a);
    const float t1 = (-b + sq) / (2.f * a);
    float t = (t0 > 1e-4f) ? t0 : ((t1 > 1e-4f) ? t1 : -1.f);
    if (t < 0.f) return Hit{};
    Hit h;
    h.hit = true;
    h.t = t;
    h.point = O + D * t;
    return h;
  }

  static Hit intersectAABB(const al::Vec3f& O, const al::Vec3f& D,
                           const al::Vec3f& bmin, const al::Vec3f& bmax) {
    float tmin = -std::numeric_limits<float>::infinity();
    float tmax = std::numeric_limits<float>::infinity();
    for (int i = 0; i < 3; ++i) {
      const float oi = (i == 0) ? O.x : (i == 1) ? O.y : O.z;
      const float di = (i == 0) ? D.x : (i == 1) ? D.y : D.z;
      const float lo = (i == 0) ? bmin.x : (i == 1) ? bmin.y : bmin.z;
      const float hi = (i == 0) ? bmax.x : (i == 1) ? bmax.y : bmax.z;
      if (std::abs(di) < 1e-8f) {
        if (oi < lo || oi > hi) return Hit{};
      } else {
        float t1 = (lo - oi) / di;
        float t2 = (hi - oi) / di;
        if (t1 > t2) std::swap(t1, t2);
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return Hit{};
      }
    }
    const float t = (tmin > 1e-4f) ? tmin : ((tmax > 1e-4f) ? tmax : -1.f);
    if (t < 0.f) return Hit{};
    Hit h;
    h.hit = true;
    h.t = t;
    h.point = O + D * t;
    return h;
  }

  // Möller-Trumbore. Returns nearest positive-t hit across all triangles.
  Hit intersectMesh(const al::Vec3f& O, const al::Vec3f& D) const {
    Hit best;
    for (std::size_t i = 0; i + 2 < mMeshIndices.size(); i += 3) {
      const auto& v0 = mMeshVertices[mMeshIndices[i + 0]];
      const auto& v1 = mMeshVertices[mMeshIndices[i + 1]];
      const auto& v2 = mMeshVertices[mMeshIndices[i + 2]];
      const al::Vec3f e1 = v1 - v0;
      const al::Vec3f e2 = v2 - v0;
      const al::Vec3f p = D.cross(e2);
      const float det = e1.dot(p);
      if (std::abs(det) < 1e-8f) continue;
      const float invDet = 1.f / det;
      const al::Vec3f tvec = O - v0;
      const float u = tvec.dot(p) * invDet;
      if (u < 0.f || u > 1.f) continue;
      const al::Vec3f q = tvec.cross(e1);
      const float v = D.dot(q) * invDet;
      if (v < 0.f || u + v > 1.f) continue;
      const float t = e2.dot(q) * invDet;
      if (t > 1e-4f && t < best.t) {
        best.hit = true;
        best.t = t;
        best.point = O + D * t;
      }
    }
    return best;
  }

  void rebuildHandleMesh() {
    mHandleMesh.reset();
    mHandleMesh.primitive(al::Mesh::TRIANGLES);
    // 8-segment icosphere-ish handle so draw() shows something useful
    // regardless of which Kind is in use.
    const float r = (mKind == Sphere) ? mRadius : 0.05f * mRadius + 0.02f;
    al::addSphere(mHandleMesh, r, 12, 8);
  }
};

// =====================================================================
// screenToRay
// =====================================================================

#ifndef ALLOLIB_STUDIO_PICKABLE_NO_WEBAPP

/// Build a world-space ray from a screen pixel coordinate.
///   - `screen.x`, `screen.y` are in CSS pixels with the origin at the
///     top-left of the canvas (matches al::Mouse::x()/y()).
///   - The returned origin is the camera position (app.nav().pos()).
///   - The returned direction is normalized.
///
/// The math: convert (sx, sy) to NDC in [-1, 1], then build a view-space
/// direction using the camera lens parameters (fovy, aspect, near plane),
/// then rotate that direction by the camera's world orientation and scale.
inline Ray screenToRay(al::WebApp& app, al::Vec2f screen) {
  const float W = static_cast<float>(app.fbWidth());
  const float H = static_cast<float>(app.fbHeight());
  const float aspect = (H > 0.f) ? (W / H) : 1.f;
  const float fovy = static_cast<float>(app.lens().fovy());

  // Pixel -> NDC.  Mouse y grows downward; flip so +y is up in NDC.
  const float ndcX = (2.f * screen.x / std::max(1.f, W)) - 1.f;
  const float ndcY = 1.f - (2.f * screen.y / std::max(1.f, H));

  // View-space ray direction at the near plane.
  const float tanHalfFov = std::tan(static_cast<float>(fovy * M_PI / 180.f) * 0.5f);
  const float vx = ndcX * tanHalfFov * aspect;
  const float vy = ndcY * tanHalfFov;
  const float vz = -1.f;  // camera looks down -Z in view space
  al::Vec3f viewDir{vx, vy, vz};

  // Rotate view-space dir into world space via the nav's basis.
  // Nav basis: ur (right) = +X local, uu (up) = +Y local, uf (forward) = -Z
  // local (camera looks down -Z in view space). A view-space vector
  // (vx, vy, vz) with vz = -1 means "one unit forward", so the world-space
  // contribution is `forward * (-vz)` = `forward * 1` for the near-plane
  // direction. Putting it together:
  al::Vec3d r3 = app.nav().ur();
  al::Vec3d u3 = app.nav().uu();
  al::Vec3d f3 = app.nav().uf();
  al::Vec3f right{static_cast<float>(r3.x), static_cast<float>(r3.y), static_cast<float>(r3.z)};
  al::Vec3f up{static_cast<float>(u3.x), static_cast<float>(u3.y), static_cast<float>(u3.z)};
  al::Vec3f forward{static_cast<float>(f3.x), static_cast<float>(f3.y), static_cast<float>(f3.z)};

  al::Vec3f worldDir = right * vx + up * vy + forward * (-vz);
  // Normalize.
  const float m = worldDir.mag();
  if (m > 0.f) worldDir /= m;

  Ray ray;
  al::Vec3d pos3 = app.nav().pos();
  ray.origin =
      al::Vec3f(static_cast<float>(pos3.x), static_cast<float>(pos3.y), static_cast<float>(pos3.z));
  ray.direction = worldDir;
  return ray;
}

#endif  // ALLOLIB_STUDIO_PICKABLE_NO_WEBAPP

}  // namespace studio
// (close of removed `namespace al`)
