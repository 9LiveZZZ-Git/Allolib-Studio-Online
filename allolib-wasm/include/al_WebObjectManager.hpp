/**
 * @file al_WebObjectManager.hpp
 * @brief Object Manager for Allolib Studio Timeline
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
 */

#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <functional>

#include "al/math/al_Vec.hpp"
#include "al/math/al_Quat.hpp"
#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/graphics/al_VAOMesh.hpp"
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
  ObjectManager();
  ~ObjectManager();

  // ─── Object CRUD ─────────────────────────────────────────────────────────

  /**
   * Create a new object with the given ID
   * @param id Unique object identifier (from JS store)
   * @param name Display name
   * @param primitive Primitive type
   * @return Pointer to created object, or nullptr if ID exists
   */
  SceneObject* createObject(const std::string& id, const std::string& name,
                            PrimitiveType primitive = PrimitiveType::Cube);

  /**
   * Remove an object by ID
   * @return true if removed, false if not found
   */
  bool removeObject(const std::string& id);

  /**
   * Get an object by ID
   * @return Pointer to object, or nullptr if not found
   */
  SceneObject* getObject(const std::string& id);

  /**
   * Get all objects
   */
  const std::unordered_map<std::string, std::unique_ptr<SceneObject>>& objects() const {
    return mObjects;
  }

  /**
   * Clear all objects
   */
  void clear();

  // ─── Transform Updates (Called from JS) ──────────────────────────────────

  void setPosition(const std::string& id, float x, float y, float z);
  void setRotation(const std::string& id, float x, float y, float z, float w);
  void setScale(const std::string& id, float x, float y, float z);

  // ─── Material Updates ────────────────────────────────────────────────────

  void setColor(const std::string& id, float r, float g, float b, float a);
  void setMaterialType(const std::string& id, MaterialType type);
  void setPBRParams(const std::string& id, float metallic, float roughness);

  // ─── Visibility & Lifecycle ──────────────────────────────────────────────

  void setVisible(const std::string& id, bool visible);
  void setSpawnTime(const std::string& id, float time);
  void setDestroyTime(const std::string& id, float time);

  /**
   * Update object visibility based on current timeline time
   * Called each frame during playback
   */
  void updateLifecycles(float currentTime);

  // ─── Rendering ───────────────────────────────────────────────────────────

  /**
   * Initialize primitive meshes (call once after GL context ready)
   */
  void initMeshes();

  /**
   * Draw all visible objects
   * @param g Graphics context
   * @param pbr Optional PBR renderer for PBR materials
   */
  void draw(Graphics& g, WebPBR* pbr = nullptr);

  /**
   * Draw a single object
   */
  void drawObject(Graphics& g, SceneObject& obj, WebPBR* pbr = nullptr);

  // ─── State ───────────────────────────────────────────────────────────────

  size_t objectCount() const { return mObjects.size(); }
  size_t visibleCount() const;

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

  VAOMesh* getMeshForPrimitive(PrimitiveType type);
  void createPrimitiveMeshes();
};

// ─── Global Instance ─────────────────────────────────────────────────────────

extern ObjectManager* gObjectManager;

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

// ─── WASM Exports ────────────────────────────────────────────────────────────

extern "C" {

// Object CRUD
int al_obj_create(const char* id, const char* name, const char* primitive);
int al_obj_remove(const char* id);
void al_obj_clear();

// Transform
void al_obj_set_position(const char* id, float x, float y, float z);
void al_obj_set_rotation(const char* id, float x, float y, float z, float w);
void al_obj_set_scale(const char* id, float x, float y, float z);

// Material
void al_obj_set_color(const char* id, float r, float g, float b, float a);
void al_obj_set_material_type(const char* id, const char* type);
void al_obj_set_pbr_params(const char* id, float metallic, float roughness);

// Visibility & Lifecycle
void al_obj_set_visible(const char* id, int visible);
void al_obj_set_spawn_time(const char* id, float time);
void al_obj_set_destroy_time(const char* id, float time);

// Lifecycle update (call each frame during playback)
void al_obj_update_lifecycles(float currentTime);

// Queries
int al_obj_count();
int al_obj_visible_count();

}
