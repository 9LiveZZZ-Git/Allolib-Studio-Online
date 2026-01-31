/**
 * @file al_WebObjectManager.cpp
 * @brief Implementation of Object Manager for Allolib Studio Timeline
 */

#include "al_WebObjectManager.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

namespace al {

// Global instance
ObjectManager* gObjectManager = nullptr;

// ─── Constructor/Destructor ──────────────────────────────────────────────────

ObjectManager::ObjectManager() {
  // Meshes will be initialized when initMeshes() is called
}

ObjectManager::~ObjectManager() {
  clear();
}

// ─── Object CRUD ─────────────────────────────────────────────────────────────

SceneObject* ObjectManager::createObject(const std::string& id, const std::string& name,
                                          PrimitiveType primitive) {
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

bool ObjectManager::removeObject(const std::string& id) {
  auto it = mObjects.find(id);
  if (it == mObjects.end()) {
    return false;
  }
  mObjects.erase(it);
  return true;
}

SceneObject* ObjectManager::getObject(const std::string& id) {
  auto it = mObjects.find(id);
  if (it == mObjects.end()) {
    return nullptr;
  }
  return it->second.get();
}

void ObjectManager::clear() {
  mObjects.clear();
}

// ─── Transform Updates ───────────────────────────────────────────────────────

void ObjectManager::setPosition(const std::string& id, float x, float y, float z) {
  if (auto* obj = getObject(id)) {
    obj->transform.position.set(x, y, z);
    obj->needsUpdate = true;
  }
}

void ObjectManager::setRotation(const std::string& id, float x, float y, float z, float w) {
  if (auto* obj = getObject(id)) {
    obj->transform.rotation.set(x, y, z, w);
    obj->needsUpdate = true;
  }
}

void ObjectManager::setScale(const std::string& id, float x, float y, float z) {
  if (auto* obj = getObject(id)) {
    obj->transform.scale.set(x, y, z);
    obj->needsUpdate = true;
  }
}

// ─── Material Updates ────────────────────────────────────────────────────────

void ObjectManager::setColor(const std::string& id, float r, float g, float b, float a) {
  if (auto* obj = getObject(id)) {
    obj->material.color.set(r, g, b, a);
    obj->needsUpdate = true;
  }
}

void ObjectManager::setMaterialType(const std::string& id, MaterialType type) {
  if (auto* obj = getObject(id)) {
    obj->material.type = type;
    obj->needsUpdate = true;
  }
}

void ObjectManager::setPBRParams(const std::string& id, float metallic, float roughness) {
  if (auto* obj = getObject(id)) {
    obj->material.metallic = metallic;
    obj->material.roughness = roughness;
    obj->needsUpdate = true;
  }
}

// ─── Visibility & Lifecycle ──────────────────────────────────────────────────

void ObjectManager::setVisible(const std::string& id, bool visible) {
  if (auto* obj = getObject(id)) {
    obj->visible = visible;
  }
}

void ObjectManager::setSpawnTime(const std::string& id, float time) {
  if (auto* obj = getObject(id)) {
    obj->spawnTime = time;
  }
}

void ObjectManager::setDestroyTime(const std::string& id, float time) {
  if (auto* obj = getObject(id)) {
    obj->destroyTime = time;
  }
}

void ObjectManager::updateLifecycles(float currentTime) {
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

// ─── Rendering ───────────────────────────────────────────────────────────────

void ObjectManager::initMeshes() {
  if (mMeshesInitialized) return;
  createPrimitiveMeshes();
  mMeshesInitialized = true;
}

void ObjectManager::createPrimitiveMeshes() {
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

VAOMesh* ObjectManager::getMeshForPrimitive(PrimitiveType type) {
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

void ObjectManager::draw(Graphics& g, WebPBR* pbr) {
  for (auto& [id, obj] : mObjects) {
    if (obj->visible && obj->mesh) {
      drawObject(g, *obj, pbr);
    }
  }
}

void ObjectManager::drawObject(Graphics& g, SceneObject& obj, WebPBR* pbr) {
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
    pbr->material(
      obj.material.color.rgb(),
      obj.material.metallic,
      obj.material.roughness
    );
    g.draw(*obj.mesh);
  } else {
    // Basic rendering
    g.color(obj.material.color);
    g.draw(*obj.mesh);
  }

  g.popMatrix();
  obj.needsUpdate = false;
}

size_t ObjectManager::visibleCount() const {
  size_t count = 0;
  for (const auto& [id, obj] : mObjects) {
    if (obj->visible) count++;
  }
  return count;
}

} // namespace al

// ─── WASM Exports Implementation ─────────────────────────────────────────────

extern "C" {

int al_obj_create(const char* id, const char* name, const char* primitive) {
  auto type = al::primitiveFromString(primitive);
  auto* obj = al::objectManager().createObject(id, name, type);
  return obj ? 1 : 0;
}

int al_obj_remove(const char* id) {
  return al::objectManager().removeObject(id) ? 1 : 0;
}

void al_obj_clear() {
  al::objectManager().clear();
}

void al_obj_set_position(const char* id, float x, float y, float z) {
  al::objectManager().setPosition(id, x, y, z);
}

void al_obj_set_rotation(const char* id, float x, float y, float z, float w) {
  al::objectManager().setRotation(id, x, y, z, w);
}

void al_obj_set_scale(const char* id, float x, float y, float z) {
  al::objectManager().setScale(id, x, y, z);
}

void al_obj_set_color(const char* id, float r, float g, float b, float a) {
  al::objectManager().setColor(id, r, g, b, a);
}

void al_obj_set_material_type(const char* id, const char* type) {
  al::objectManager().setMaterialType(id, al::materialFromString(type));
}

void al_obj_set_pbr_params(const char* id, float metallic, float roughness) {
  al::objectManager().setPBRParams(id, metallic, roughness);
}

void al_obj_set_visible(const char* id, int visible) {
  al::objectManager().setVisible(id, visible != 0);
}

void al_obj_set_spawn_time(const char* id, float time) {
  al::objectManager().setSpawnTime(id, time);
}

void al_obj_set_destroy_time(const char* id, float time) {
  al::objectManager().setDestroyTime(id, time);
}

void al_obj_update_lifecycles(float currentTime) {
  al::objectManager().updateLifecycles(currentTime);
}

int al_obj_count() {
  return static_cast<int>(al::objectManager().objectCount());
}

int al_obj_visible_count() {
  return static_cast<int>(al::objectManager().visibleCount());
}

}
