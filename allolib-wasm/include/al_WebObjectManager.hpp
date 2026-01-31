/**
 * @file al_WebObjectManager.hpp
 * @brief Object Manager for Allolib Studio Timeline (Header-Only)
 *
 * Manages scene objects with:
 * - Spawn/destroy lifecycle based on timeline time
 * - Transform interpolation from keyframes
 * - Primitive mesh rendering (sphere, cube, cylinder, cone, torus, plane)
 * - Material support (basic, PBR)
 *
 * Integration:
 * - JS calls spawn/destroy/update via WASM exports
 * - Keyframe interpolation happens in JS, values pushed to WASM
 * - Objects rendered in WebApp::onDraw()
 *
 * This is a header-only library for easier integration with examples.
 */

#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <functional>
#include <cmath>

#include "al/math/al_Vec.hpp"
#include "al/math/al_Quat.hpp"
#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/graphics/al_VAOMesh.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al_WebPBR.hpp"

namespace al {

// ─── Object Types ────────────────────────────────────────────────────────────

enum class PrimitiveType {
  Sphere,
  Cube,
  Cylinder,
  Cone,
  Torus,
  Plane
};

enum class MaterialType {
  Basic,
  PBR,
  Custom
};

struct ObjectTransform {
  Vec3f position{0, 0, 0};
  Quatf rotation{1, 0, 0, 0};  // Identity quaternion
  Vec3f scale{1, 1, 1};

  Mat4f toMatrix() const {
    Mat4f mat;
    mat.setIdentity();
    mat.translate(position);

    // Convert quaternion to rotation matrix
    Mat4f rotMat;
    rotation.toMatrix(rotMat.elems());
    mat *= rotMat;

    mat.scale(scale);
    return mat;
  }
};

struct ObjectMaterial {
  MaterialType type = MaterialType::Basic;
  Color color{1, 1, 1, 1};
  float metallic = 0.0f;
  float roughness = 0.5f;
  Vec3f emissive{0, 0, 0};
};

struct SceneObject {
  std::string id;
  std::string name;
  bool visible = true;
  bool locked = false;

  ObjectTransform transform;
  PrimitiveType primitiveType = PrimitiveType::Cube;
  ObjectMaterial material;

  // Lifecycle
  float spawnTime = -1;   // -1 = always visible
  float destroyTime = -1; // -1 = never destroyed

  // Internal
  VAOMesh* mesh = nullptr;
  bool needsUpdate = true;
};

// ─── Object Manager ──────────────────────────────────────────────────────────

class ObjectManager {
public:
  ObjectManager() {}
  ~ObjectManager() { clear(); }

  // ─── Object CRUD ─────────────────────────────────────────────────────────

  SceneObject* createObject(const std::string& id, const std::string& name,
                            PrimitiveType primitive = PrimitiveType::Cube) {
    if (mObjects.find(id) != mObjects.end()) {
      return nullptr; // ID already exists
    }

    auto obj = std::make_unique<SceneObject>();
    obj->id = id;
    obj->name = name;
    obj->primitiveType = primitive;
    obj->mesh = getMeshForPrimitive(primitive);

    SceneObject* ptr = obj.get();
    mObjects[id] = std::move(obj);

    return ptr;
  }

  bool removeObject(const std::string& id) {
    auto it = mObjects.find(id);
    if (it == mObjects.end()) {
      return false;
    }
    mObjects.erase(it);
    return true;
  }

  SceneObject* getObject(const std::string& id) {
    auto it = mObjects.find(id);
    if (it == mObjects.end()) {
      return nullptr;
    }
    return it->second.get();
  }

  const std::unordered_map<std::string, std::unique_ptr<SceneObject>>& objects() const {
    return mObjects;
  }

  void clear() {
    mObjects.clear();
  }

  // ─── Transform Updates (Called from JS) ──────────────────────────────────

  void setPosition(const std::string& id, float x, float y, float z) {
    if (auto* obj = getObject(id)) {
      obj->transform.position.set(x, y, z);
      obj->needsUpdate = true;
    }
  }

  void setRotation(const std::string& id, float x, float y, float z, float w) {
    if (auto* obj = getObject(id)) {
      obj->transform.rotation.set(x, y, z, w);
      obj->needsUpdate = true;
    }
  }

  void setScale(const std::string& id, float x, float y, float z) {
    if (auto* obj = getObject(id)) {
      obj->transform.scale.set(x, y, z);
      obj->needsUpdate = true;
    }
  }

  // ─── Material Updates ────────────────────────────────────────────────────

  void setColor(const std::string& id, float r, float g, float b, float a) {
    if (auto* obj = getObject(id)) {
      obj->material.color.set(r, g, b, a);
      obj->needsUpdate = true;
    }
  }

  void setMaterialType(const std::string& id, MaterialType type) {
    if (auto* obj = getObject(id)) {
      obj->material.type = type;
      obj->needsUpdate = true;
    }
  }

  void setPBRParams(const std::string& id, float metallic, float roughness) {
    if (auto* obj = getObject(id)) {
      obj->material.metallic = metallic;
      obj->material.roughness = roughness;
      obj->needsUpdate = true;
    }
  }

  // ─── Visibility & Lifecycle ──────────────────────────────────────────────

  void setVisible(const std::string& id, bool visible) {
    if (auto* obj = getObject(id)) {
      obj->visible = visible;
    }
  }

  void setSpawnTime(const std::string& id, float time) {
    if (auto* obj = getObject(id)) {
      obj->spawnTime = time;
    }
  }

  void setDestroyTime(const std::string& id, float time) {
    if (auto* obj = getObject(id)) {
      obj->destroyTime = time;
    }
  }

  void updateLifecycles(float currentTime) {
    mCurrentTime = currentTime;

    for (auto& [id, obj] : mObjects) {
      // Check spawn time
      if (obj->spawnTime >= 0 && currentTime < obj->spawnTime) {
        obj->visible = false;
        continue;
      }

      // Check destroy time
      if (obj->destroyTime >= 0 && currentTime >= obj->destroyTime) {
        obj->visible = false;
        continue;
      }

      // Object is within its lifecycle
      obj->visible = true;
    }
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  void initMeshes() {
    if (mMeshesInitialized) return;
    createPrimitiveMeshes();
    mMeshesInitialized = true;
  }

  void draw(Graphics& g, WebPBR* pbr = nullptr) {
    for (auto& [id, obj] : mObjects) {
      if (obj->visible && obj->mesh) {
        drawObject(g, *obj, pbr);
      }
    }
  }

  void drawObject(Graphics& g, SceneObject& obj, WebPBR* pbr = nullptr) {
    if (!obj.mesh) {
      obj.mesh = getMeshForPrimitive(obj.primitiveType);
      if (!obj.mesh) return;
    }

    g.pushMatrix();
    g.translate(obj.transform.position);
    g.rotate(obj.transform.rotation);
    g.scale(obj.transform.scale);

    if (obj.material.type == MaterialType::PBR && pbr) {
      // Use PBR rendering
      PBRMaterial mat(
        obj.material.color.rgb(),
        obj.material.metallic,
        obj.material.roughness
      );
      pbr->material(mat);
      g.draw(*obj.mesh);
    } else {
      // Basic rendering
      g.color(obj.material.color);
      g.draw(*obj.mesh);
    }

    g.popMatrix();
    obj.needsUpdate = false;
  }

  // ─── State ───────────────────────────────────────────────────────────────

  size_t objectCount() const { return mObjects.size(); }

  size_t visibleCount() const {
    size_t count = 0;
    for (const auto& [id, obj] : mObjects) {
      if (obj->visible) count++;
    }
    return count;
  }

private:
  std::unordered_map<std::string, std::unique_ptr<SceneObject>> mObjects;

  // Shared primitive meshes
  std::unique_ptr<VAOMesh> mSphereMesh;
  std::unique_ptr<VAOMesh> mCubeMesh;
  std::unique_ptr<VAOMesh> mCylinderMesh;
  std::unique_ptr<VAOMesh> mConeMesh;
  std::unique_ptr<VAOMesh> mTorusMesh;
  std::unique_ptr<VAOMesh> mPlaneMesh;

  bool mMeshesInitialized = false;
  float mCurrentTime = 0;

  VAOMesh* getMeshForPrimitive(PrimitiveType type) {
    if (!mMeshesInitialized) {
      return nullptr;
    }

    switch (type) {
      case PrimitiveType::Sphere:   return mSphereMesh.get();
      case PrimitiveType::Cube:     return mCubeMesh.get();
      case PrimitiveType::Cylinder: return mCylinderMesh.get();
      case PrimitiveType::Cone:     return mConeMesh.get();
      case PrimitiveType::Torus:    return mTorusMesh.get();
      case PrimitiveType::Plane:    return mPlaneMesh.get();
      default:                      return mCubeMesh.get();
    }
  }

  void createPrimitiveMeshes() {
    // Sphere
    mSphereMesh = std::make_unique<VAOMesh>();
    addSphere(*mSphereMesh, 1.0, 32, 32);
    mSphereMesh->update();

    // Cube
    mCubeMesh = std::make_unique<VAOMesh>();
    addCube(*mCubeMesh, false, 1.0);
    mCubeMesh->update();

    // Cylinder
    mCylinderMesh = std::make_unique<VAOMesh>();
    addCylinder(*mCylinderMesh, 0.5, 0.5, 1.0, 32, 1);
    mCylinderMesh->update();

    // Cone
    mConeMesh = std::make_unique<VAOMesh>();
    addCone(*mConeMesh, 0.5, Vec3f(0, 0, 1), 32);
    mConeMesh->update();

    // Torus
    mTorusMesh = std::make_unique<VAOMesh>();
    addTorus(*mTorusMesh, 0.3, 0.7, 32, 32);
    mTorusMesh->update();

    // Plane
    mPlaneMesh = std::make_unique<VAOMesh>();
    mPlaneMesh->primitive(Mesh::TRIANGLES);
    mPlaneMesh->vertex(-0.5, 0, -0.5);
    mPlaneMesh->vertex(0.5, 0, -0.5);
    mPlaneMesh->vertex(0.5, 0, 0.5);
    mPlaneMesh->vertex(-0.5, 0, 0.5);
    mPlaneMesh->normal(0, 1, 0);
    mPlaneMesh->normal(0, 1, 0);
    mPlaneMesh->normal(0, 1, 0);
    mPlaneMesh->normal(0, 1, 0);
    mPlaneMesh->texCoord(0, 0);
    mPlaneMesh->texCoord(1, 0);
    mPlaneMesh->texCoord(1, 1);
    mPlaneMesh->texCoord(0, 1);
    mPlaneMesh->index(0, 1, 2);
    mPlaneMesh->index(0, 2, 3);
    mPlaneMesh->update();
  }
};

// ─── Global Instance (inline for header-only) ────────────────────────────────

inline ObjectManager* gObjectManager = nullptr;

inline ObjectManager& objectManager() {
  if (!gObjectManager) {
    gObjectManager = new ObjectManager();
  }
  return *gObjectManager;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

inline PrimitiveType primitiveFromString(const std::string& str) {
  if (str == "sphere") return PrimitiveType::Sphere;
  if (str == "cube") return PrimitiveType::Cube;
  if (str == "cylinder") return PrimitiveType::Cylinder;
  if (str == "cone") return PrimitiveType::Cone;
  if (str == "torus") return PrimitiveType::Torus;
  if (str == "plane") return PrimitiveType::Plane;
  return PrimitiveType::Cube; // default
}

inline MaterialType materialFromString(const std::string& str) {
  if (str == "basic") return MaterialType::Basic;
  if (str == "pbr") return MaterialType::PBR;
  if (str == "custom") return MaterialType::Custom;
  return MaterialType::Basic; // default
}

} // namespace al

// ─── WASM Exports (inline implementations) ───────────────────────────────────

extern "C" {

inline int al_obj_create(const char* id, const char* name, const char* primitive) {
  auto type = al::primitiveFromString(primitive);
  auto* obj = al::objectManager().createObject(id, name, type);
  return obj ? 1 : 0;
}

inline int al_obj_remove(const char* id) {
  return al::objectManager().removeObject(id) ? 1 : 0;
}

inline void al_obj_clear() {
  al::objectManager().clear();
}

inline void al_obj_set_position(const char* id, float x, float y, float z) {
  al::objectManager().setPosition(id, x, y, z);
}

inline void al_obj_set_rotation(const char* id, float x, float y, float z, float w) {
  al::objectManager().setRotation(id, x, y, z, w);
}

inline void al_obj_set_scale(const char* id, float x, float y, float z) {
  al::objectManager().setScale(id, x, y, z);
}

inline void al_obj_set_color(const char* id, float r, float g, float b, float a) {
  al::objectManager().setColor(id, r, g, b, a);
}

inline void al_obj_set_material_type(const char* id, const char* type) {
  al::objectManager().setMaterialType(id, al::materialFromString(type));
}

inline void al_obj_set_pbr_params(const char* id, float metallic, float roughness) {
  al::objectManager().setPBRParams(id, metallic, roughness);
}

inline void al_obj_set_visible(const char* id, int visible) {
  al::objectManager().setVisible(id, visible != 0);
}

inline void al_obj_set_spawn_time(const char* id, float time) {
  al::objectManager().setSpawnTime(id, time);
}

inline void al_obj_set_destroy_time(const char* id, float time) {
  al::objectManager().setDestroyTime(id, time);
}

inline void al_obj_update_lifecycles(float currentTime) {
  al::objectManager().updateLifecycles(currentTime);
}

inline int al_obj_count() {
  return static_cast<int>(al::objectManager().objectCount());
}

inline int al_obj_visible_count() {
  return static_cast<int>(al::objectManager().visibleCount());
}

}
