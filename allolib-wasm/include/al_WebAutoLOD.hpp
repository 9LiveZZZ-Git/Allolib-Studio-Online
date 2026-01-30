/**
 * Automatic LOD System for WebGL
 *
 * Provides transparent, automatic level-of-detail mesh simplification.
 * Integrates directly into the Graphics system - just enable auto-LOD
 * and all mesh draws will automatically use appropriate detail levels.
 *
 * Usage:
 *   // In your WebApp subclass - auto-LOD is built into Graphics!
 *   void onCreate() {
 *       g.enableAutoLOD();              // Enable automatic LOD
 *       g.setAutoLODLevels(4);          // 4 LOD levels (optional)
 *       g.setAutoLODDistances({10, 25, 50, 100});  // Distance thresholds
 *   }
 *
 *   void onDraw(Graphics& g) {
 *       // Just draw normally - LOD happens automatically!
 *       g.draw(myMesh);
 *   }
 *
 * The system automatically:
 * - Generates simplified versions of meshes on first draw
 * - Caches LOD meshes for reuse
 * - Selects appropriate LOD based on camera distance
 * - Extracts object position from the current model matrix
 */

#ifndef AL_WEB_AUTO_LOD_HPP
#define AL_WEB_AUTO_LOD_HPP

#include <unordered_map>
#include <memory>
#include <vector>

#include "al_WebLOD.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/math/al_Vec.hpp"
#include "al/math/al_Matrix4.hpp"

namespace al {

/**
 * Mesh identity for cache lookup
 */
struct MeshIdentity {
    size_t vertexCount;
    size_t indexCount;
    uintptr_t ptrHash;

    bool operator==(const MeshIdentity& other) const {
        return vertexCount == other.vertexCount &&
               indexCount == other.indexCount &&
               ptrHash == other.ptrHash;
    }
};

struct MeshIdentityHash {
    size_t operator()(const MeshIdentity& id) const {
        return id.vertexCount ^ (id.indexCount << 16) ^ id.ptrHash;
    }
};

/**
 * Cached LOD mesh entry
 */
struct CachedLODMesh {
    LODMesh lodMesh;
    bool generated = false;
};

/**
 * Automatic LOD Manager
 * Integrated into Graphics for transparent mesh simplification.
 */
class AutoLODManager {
public:
    AutoLODManager() : mEnabled(false), mNumLevels(4), mReductionFactor(0.5f),
                       mBias(1.0f), mMinVertices(100), mCameraPos(0, 0, 5),
                       mStatsEnabled(false), mTotalTriangles(0), mMeshCount(0) {
        mDistances = {10.0f, 25.0f, 50.0f, 100.0f};
    }

    // Enable/disable
    void enable(bool e = true) { mEnabled = e; }
    void disable() { mEnabled = false; }
    bool enabled() const { return mEnabled; }

    // Configuration
    void setLevels(int levels) { mNumLevels = std::max(1, std::min(levels, 8)); }
    int levels() const { return mNumLevels; }

    void setReductionFactor(float factor) { mReductionFactor = std::max(0.1f, std::min(factor, 0.9f)); }
    float reductionFactor() const { return mReductionFactor; }

    void setDistances(const std::vector<float>& distances) {
        mDistances = distances;
        // Update existing cached meshes with new distances
        for (auto& entry : mCache) {
            if (entry.second.generated) {
                entry.second.lodMesh.setDistances(mDistances);
            }
        }
    }
    const std::vector<float>& distances() const { return mDistances; }

    void setBias(float bias) { mBias = std::max(0.1f, bias); }
    float bias() const { return mBias; }

    void setMinVertices(int minVerts) { mMinVertices = std::max(10, minVerts); }
    int minVertices() const { return mMinVertices; }

    // Camera position (updated each frame by WebApp)
    void setCameraPos(const Vec3f& pos) { mCameraPos = pos; }
    const Vec3f& cameraPos() const { return mCameraPos; }

    // Cache management
    void clearCache() { mCache.clear(); }
    size_t cacheSize() const { return mCache.size(); }

    // Statistics
    void enableStats(bool e = true) { mStatsEnabled = e; }
    void resetFrameStats() { mTotalTriangles = 0; mMeshCount = 0; }
    int frameTriangles() const { return mTotalTriangles; }
    int frameMeshes() const { return mMeshCount; }

    /**
     * Select appropriate LOD mesh based on model matrix position
     * Returns the mesh to draw (original if LOD disabled or mesh too small)
     */
    const Mesh& selectMesh(const Mesh& mesh, const Matrix4f& modelMatrix) {
        if (mStatsEnabled) {
            mMeshCount++;
        }

        // If disabled or mesh too small, return original
        if (!mEnabled || mesh.vertices().size() < (size_t)mMinVertices) {
            if (mStatsEnabled) {
                mTotalTriangles += getTriangleCount(mesh);
            }
            return mesh;
        }

        // Only process triangle meshes
        if (mesh.primitive() != Mesh::TRIANGLES) {
            if (mStatsEnabled) {
                mTotalTriangles += getTriangleCount(mesh);
            }
            return mesh;
        }

        // Get or create LOD mesh
        MeshIdentity id = getMeshIdentity(mesh);
        auto it = mCache.find(id);

        CachedLODMesh* cached;
        if (it == mCache.end()) {
            auto& entry = mCache[id];
            generateLOD(mesh, entry);
            cached = &entry;
        } else {
            cached = &it->second;
        }

        // If generation failed, return original
        if (!cached->generated || !cached->lodMesh.ready()) {
            if (mStatsEnabled) {
                mTotalTriangles += getTriangleCount(mesh);
            }
            return mesh;
        }

        // Extract object position from model matrix
        Vec3f objectPos(modelMatrix[12], modelMatrix[13], modelMatrix[14]);
        float distance = (mCameraPos - objectPos).mag() * mBias;

        // Select LOD
        const Mesh& selected = cached->lodMesh.selectByDistance(distance);
        if (mStatsEnabled) {
            mTotalTriangles += getTriangleCount(selected);
        }
        return selected;
    }

    /**
     * Get LOD level for a given distance (for debugging)
     */
    int getLevelForDistance(float distance) const {
        distance *= mBias;
        for (size_t i = 0; i < mDistances.size(); i++) {
            if (distance < mDistances[i]) return i;
        }
        return mDistances.size() - 1;
    }

private:
    MeshIdentity getMeshIdentity(const Mesh& mesh) const {
        return {mesh.vertices().size(), mesh.indices().size(),
                reinterpret_cast<uintptr_t>(&mesh)};
    }

    int getTriangleCount(const Mesh& mesh) const {
        if (!mesh.indices().empty()) {
            return mesh.indices().size() / 3;
        }
        return mesh.vertices().size() / 3;
    }

    void generateLOD(const Mesh& mesh, CachedLODMesh& cached) {
        cached.lodMesh.generate(mesh, mNumLevels, mReductionFactor);
        if (!mDistances.empty()) {
            cached.lodMesh.setDistances(mDistances);
        }
        cached.generated = true;
    }

    bool mEnabled;
    int mNumLevels;
    float mReductionFactor;
    float mBias;
    int mMinVertices;
    Vec3f mCameraPos;
    std::vector<float> mDistances;

    std::unordered_map<MeshIdentity, CachedLODMesh, MeshIdentityHash> mCache;

    bool mStatsEnabled;
    int mTotalTriangles;
    int mMeshCount;
};

} // namespace al

#endif // AL_WEB_AUTO_LOD_HPP
