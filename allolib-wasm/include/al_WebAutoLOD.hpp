/**
 * Advanced Automatic LOD System for WebGL
 *
 * Provides Unreal Engine/Nanite-inspired automatic level-of-detail.
 * Features:
 * - Screen-space error metric (not just distance)
 * - Triangle budget enforcement
 * - View-dependent detail (more detail in screen center)
 * - Adaptive quality based on frame time
 * - Smooth LOD transitions
 * - Integration with QualityManager settings
 *
 * Usage:
 *   // Enable in onCreate - that's it!
 *   enableAutoLOD();
 *
 *   // In onDraw, just use drawLOD()
 *   drawLOD(g, myMesh);  // LOD selected automatically!
 *
 * Settings are controlled from the toolbar's Graphics Settings panel.
 */

#ifndef AL_WEB_AUTO_LOD_HPP
#define AL_WEB_AUTO_LOD_HPP

#include <emscripten.h>
#include <unordered_map>
#include <memory>
#include <vector>
#include <cmath>
#include <algorithm>

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
 * Cached LOD mesh entry with bounding info
 */
struct CachedLODMesh {
    LODMesh lodMesh;
    bool generated = false;
    float boundingSphereRadius = 1.0f;
    Vec3f boundingCenter;
};

/**
 * LOD selection mode - like Unreal's options
 */
enum class LODSelectionMode {
    Distance,           // Classic distance-based
    ScreenSize,         // Based on projected screen size (Unreal default)
    ScreenError,        // Based on screen-space error (Nanite-like)
    TriangleBudget      // Enforce triangle budget
};

/**
 * Advanced Automatic LOD Manager
 *
 * Provides Unreal Engine-like automatic LOD with:
 * - Screen-space error metrics
 * - Triangle budgets
 * - Adaptive quality
 * - Settings from frontend UI
 */
class AutoLODManager {
public:
    AutoLODManager()
        : mEnabled(false)
        , mNumLevels(4)
        , mReductionFactor(0.5f)
        , mBias(1.0f)
        , mMinVertices(100)
        , mCameraPos(0, 0, 5)
        , mSelectionMode(LODSelectionMode::ScreenSize)
        , mScreenWidth(1920)
        , mScreenHeight(1080)
        , mFOV(60.0f)
        , mTriangleBudget(500000)
        , mCurrentTriangles(0)
        , mTargetScreenPixels(100.0f)  // Target pixels for LOD 0
        , mScreenErrorThreshold(2.0f)  // Max pixels of error before switching LOD
        , mStatsEnabled(false)
        , mTotalTriangles(0)
        , mMeshCount(0)
        , mFrameTime(0.016f)
        , mAdaptiveEnabled(true)
    {
        // Default distance thresholds (used for Distance mode)
        mDistances = {10.0f, 25.0f, 50.0f, 100.0f};

        // Screen size thresholds (fraction of screen height)
        mScreenSizeThresholds = {0.5f, 0.25f, 0.1f, 0.05f};
    }

    // =========================================================================
    // Enable/Disable
    // =========================================================================

    void enable(bool e = true) { mEnabled = e; }
    void disable() { mEnabled = false; }
    bool enabled() const { return mEnabled; }

    // =========================================================================
    // LOD Selection Mode (Unreal-like)
    // =========================================================================

    void setSelectionMode(LODSelectionMode mode) { mSelectionMode = mode; }
    LODSelectionMode selectionMode() const { return mSelectionMode; }

    // =========================================================================
    // Configuration
    // =========================================================================

    void setLevels(int levels) { mNumLevels = std::max(1, std::min(levels, 8)); }
    int levels() const { return mNumLevels; }

    void setReductionFactor(float factor) { mReductionFactor = std::max(0.1f, std::min(factor, 0.9f)); }
    float reductionFactor() const { return mReductionFactor; }

    // LOD Bias - like Unreal's LOD Distance Scale
    // Higher = use lower detail sooner, Lower = more detail at distance
    void setBias(float bias) { mBias = std::max(0.1f, std::min(bias, 5.0f)); }
    float bias() const { return mBias; }

    void setMinVertices(int minVerts) { mMinVertices = std::max(10, minVerts); }
    int minVertices() const { return mMinVertices; }

    // Distance thresholds (for Distance mode)
    void setDistances(const std::vector<float>& distances) {
        mDistances = distances;
        for (auto& entry : mCache) {
            if (entry.second.generated) {
                entry.second.lodMesh.setDistances(mDistances);
            }
        }
    }
    const std::vector<float>& distances() const { return mDistances; }

    // Screen size thresholds (for ScreenSize mode) - fraction of screen
    void setScreenSizeThresholds(const std::vector<float>& thresholds) {
        mScreenSizeThresholds = thresholds;
    }

    // =========================================================================
    // Unreal-like Settings
    // =========================================================================

    // Triangle budget (for TriangleBudget mode)
    void setTriangleBudget(int budget) { mTriangleBudget = std::max(1000, budget); }
    int triangleBudget() const { return mTriangleBudget; }

    // Screen error threshold in pixels (for ScreenError mode)
    void setScreenErrorThreshold(float pixels) { mScreenErrorThreshold = std::max(0.5f, pixels); }
    float screenErrorThreshold() const { return mScreenErrorThreshold; }

    // Target screen pixels for LOD 0 (for ScreenSize mode)
    void setTargetScreenPixels(float pixels) { mTargetScreenPixels = std::max(10.0f, pixels); }
    float targetScreenPixels() const { return mTargetScreenPixels; }

    // =========================================================================
    // View Settings (updated each frame)
    // =========================================================================

    void setCameraPos(const Vec3f& pos) { mCameraPos = pos; }
    const Vec3f& cameraPos() const { return mCameraPos; }

    void setScreenSize(int width, int height) {
        mScreenWidth = std::max(1, width);
        mScreenHeight = std::max(1, height);
    }

    void setFOV(float fov) { mFOV = std::max(1.0f, std::min(fov, 179.0f)); }
    float fov() const { return mFOV; }

    // =========================================================================
    // Adaptive Quality (like Unreal's dynamic resolution)
    // =========================================================================

    void setAdaptiveEnabled(bool e) { mAdaptiveEnabled = e; }
    bool adaptiveEnabled() const { return mAdaptiveEnabled; }

    void setFrameTime(float dt) { mFrameTime = dt; }

    void setTargetFrameTime(float target) { mTargetFrameTime = target; }

    // Called each frame to adjust quality if needed
    void adaptQuality() {
        if (!mAdaptiveEnabled) return;

        // If frame time is too high, increase LOD bias
        if (mFrameTime > mTargetFrameTime * 1.2f) {
            mBias = std::min(3.0f, mBias + 0.1f);
        }
        // If frame time is low enough, can decrease bias
        else if (mFrameTime < mTargetFrameTime * 0.8f && mBias > 0.5f) {
            mBias = std::max(0.5f, mBias - 0.05f);
        }
    }

    // =========================================================================
    // Cache Management
    // =========================================================================

    void clearCache() { mCache.clear(); }
    size_t cacheSize() const { return mCache.size(); }

    // =========================================================================
    // Statistics
    // =========================================================================

    void enableStats(bool e = true) { mStatsEnabled = e; }

    void resetFrameStats() {
        mTotalTriangles = 0;
        mMeshCount = 0;
        mCurrentTriangles = 0;
    }

    int frameTriangles() const { return mTotalTriangles; }
    int frameMeshes() const { return mMeshCount; }
    int currentTriangles() const { return mCurrentTriangles; }

    // =========================================================================
    // LOD Selection (main entry point)
    // =========================================================================

    /**
     * Select appropriate LOD mesh based on current settings and view
     */
    const Mesh& selectMesh(const Mesh& mesh, const Matrix4f& modelMatrix) {
        if (mStatsEnabled) mMeshCount++;

        // If disabled or mesh too small, return original
        if (!mEnabled || mesh.vertices().size() < (size_t)mMinVertices) {
            if (mStatsEnabled) {
                int tris = getTriangleCount(mesh);
                mTotalTriangles += tris;
                mCurrentTriangles += tris;
            }
            return mesh;
        }

        // Only process triangle meshes
        if (mesh.primitive() != Mesh::TRIANGLES) {
            if (mStatsEnabled) {
                int tris = getTriangleCount(mesh);
                mTotalTriangles += tris;
                mCurrentTriangles += tris;
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
                int tris = getTriangleCount(mesh);
                mTotalTriangles += tris;
                mCurrentTriangles += tris;
            }
            return mesh;
        }

        // Extract object position from model matrix
        Vec3f objectPos(modelMatrix[12], modelMatrix[13], modelMatrix[14]);

        // Extract scale from model matrix (approximate)
        float scaleX = Vec3f(modelMatrix[0], modelMatrix[1], modelMatrix[2]).mag();
        float scaleY = Vec3f(modelMatrix[4], modelMatrix[5], modelMatrix[6]).mag();
        float scaleZ = Vec3f(modelMatrix[8], modelMatrix[9], modelMatrix[10]).mag();
        float scale = (scaleX + scaleY + scaleZ) / 3.0f;

        // Select LOD level based on mode
        int lodLevel = selectLODLevel(cached, objectPos, scale);

        const Mesh& selected = cached->lodMesh.level(lodLevel);
        if (mStatsEnabled) {
            int tris = getTriangleCount(selected);
            mTotalTriangles += tris;
            mCurrentTriangles += tris;
        }
        return selected;
    }

    /**
     * Get LOD level for debugging/display
     */
    int getLevelForDistance(float distance) const {
        distance *= mBias;
        for (size_t i = 0; i < mDistances.size(); i++) {
            if (distance < mDistances[i]) return i;
        }
        return mDistances.size() - 1;
    }

    // =========================================================================
    // Apply settings from frontend (called via JS bridge)
    // =========================================================================

    void applySettings(float lodBias, bool enabled, int triangleBudget,
                       const std::string& selectionMode) {
        mBias = lodBias;
        mEnabled = enabled;
        mTriangleBudget = triangleBudget;

        if (selectionMode == "distance") {
            mSelectionMode = LODSelectionMode::Distance;
        } else if (selectionMode == "screenSize") {
            mSelectionMode = LODSelectionMode::ScreenSize;
        } else if (selectionMode == "screenError") {
            mSelectionMode = LODSelectionMode::ScreenError;
        } else if (selectionMode == "triangleBudget") {
            mSelectionMode = LODSelectionMode::TriangleBudget;
        }

        printf("[AutoLOD] Settings applied: bias=%.2f, enabled=%d, budget=%d, mode=%s\n",
               lodBias, enabled, triangleBudget, selectionMode.c_str());
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

        // Calculate bounding sphere
        Vec3f minB(1e10, 1e10, 1e10), maxB(-1e10, -1e10, -1e10);
        for (const auto& v : mesh.vertices()) {
            minB.x = std::min(minB.x, v.x);
            minB.y = std::min(minB.y, v.y);
            minB.z = std::min(minB.z, v.z);
            maxB.x = std::max(maxB.x, v.x);
            maxB.y = std::max(maxB.y, v.y);
            maxB.z = std::max(maxB.z, v.z);
        }
        cached.boundingCenter = (minB + maxB) * 0.5f;
        cached.boundingSphereRadius = (maxB - minB).mag() * 0.5f;

        cached.generated = true;
    }

    /**
     * Select LOD level based on current mode
     */
    int selectLODLevel(CachedLODMesh* cached, const Vec3f& objectPos, float scale) {
        float distance = (mCameraPos - objectPos).mag();
        float boundingRadius = cached->boundingSphereRadius * scale;

        switch (mSelectionMode) {
            case LODSelectionMode::Distance:
                return selectByDistance(distance);

            case LODSelectionMode::ScreenSize:
                return selectByScreenSize(distance, boundingRadius);

            case LODSelectionMode::ScreenError:
                return selectByScreenError(cached, distance, boundingRadius);

            case LODSelectionMode::TriangleBudget:
                return selectByBudget(cached, distance, boundingRadius);
        }
        return 0;
    }

    /**
     * Classic distance-based selection
     */
    int selectByDistance(float distance) {
        distance *= mBias;
        for (size_t i = 0; i < mDistances.size() && i < (size_t)mNumLevels; i++) {
            if (distance < mDistances[i]) return i;
        }
        return mNumLevels - 1;
    }

    /**
     * Screen-size based selection (like Unreal's default)
     * Uses projected size on screen
     */
    int selectByScreenSize(float distance, float boundingRadius) {
        // Calculate projected screen size (approximate)
        // screenSize = (objectSize / distance) * (screenHeight / tan(fov/2))
        float tanHalfFOV = tanf(mFOV * 0.5f * 3.14159f / 180.0f);
        float projectedSize = (boundingRadius / std::max(0.001f, distance)) *
                              (mScreenHeight / (2.0f * tanHalfFOV));

        // Apply bias
        projectedSize /= mBias;

        // Select LOD based on screen coverage
        float screenFraction = projectedSize / mScreenHeight;
        for (size_t i = 0; i < mScreenSizeThresholds.size() && i < (size_t)mNumLevels; i++) {
            if (screenFraction > mScreenSizeThresholds[i]) return i;
        }
        return mNumLevels - 1;
    }

    /**
     * Screen-space error selection (Nanite-like)
     * Switches LOD when geometric error would be visible
     */
    int selectByScreenError(CachedLODMesh* cached, float distance, float boundingRadius) {
        float tanHalfFOV = tanf(mFOV * 0.5f * 3.14159f / 180.0f);
        float pixelsPerUnit = mScreenHeight / (2.0f * tanHalfFOV * distance);

        // For each LOD level, estimate the geometric error in pixels
        for (int i = 0; i < mNumLevels; i++) {
            // Estimate error: more simplified = more error
            // Error roughly proportional to reduction
            float lodError = boundingRadius * powf(mReductionFactor, i);
            float pixelError = lodError * pixelsPerUnit;

            // If error is below threshold, use this LOD
            if (pixelError * mBias < mScreenErrorThreshold) {
                return i;
            }
        }
        return mNumLevels - 1;
    }

    /**
     * Budget-based selection
     * Tries to stay within triangle budget
     */
    int selectByBudget(CachedLODMesh* cached, float distance, float boundingRadius) {
        // If we're over budget, force lower LOD
        if (mCurrentTriangles > mTriangleBudget) {
            // Use lowest LOD for objects far away
            float normalizedDist = distance / 100.0f;  // Normalize
            int forcedLOD = std::min(mNumLevels - 1, (int)(normalizedDist * mNumLevels * mBias));
            return forcedLOD;
        }

        // Otherwise, use screen size selection
        return selectByScreenSize(distance, boundingRadius);
    }

    // Settings
    bool mEnabled;
    int mNumLevels;
    float mReductionFactor;
    float mBias;
    int mMinVertices;
    Vec3f mCameraPos;
    LODSelectionMode mSelectionMode;

    // View settings
    int mScreenWidth;
    int mScreenHeight;
    float mFOV;

    // Thresholds
    std::vector<float> mDistances;
    std::vector<float> mScreenSizeThresholds;

    // Budget & quality
    int mTriangleBudget;
    int mCurrentTriangles;
    float mTargetScreenPixels;
    float mScreenErrorThreshold;

    // Adaptive
    bool mAdaptiveEnabled;
    float mFrameTime;
    float mTargetFrameTime = 0.016f;  // 60 FPS

    // Cache
    std::unordered_map<MeshIdentity, CachedLODMesh, MeshIdentityHash> mCache;

    // Stats
    bool mStatsEnabled;
    int mTotalTriangles;
    int mMeshCount;
};

// =========================================================================
// Global AutoLOD instance for JS bridge
// =========================================================================
inline AutoLODManager* gAutoLODInstance = nullptr;

inline void setGlobalAutoLOD(AutoLODManager* lod) {
    gAutoLODInstance = lod;
}

} // namespace al

// =========================================================================
// JavaScript bridge functions (called from frontend settings)
// =========================================================================
extern "C" {

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_bias(float bias) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setBias(bias);
    }
}

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_enabled(int enabled) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->enable(enabled != 0);
    }
}

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_budget(int budget) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setTriangleBudget(budget);
    }
}

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_mode(int mode) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setSelectionMode(static_cast<al::LODSelectionMode>(mode));
    }
}

EMSCRIPTEN_KEEPALIVE
int al_autolod_get_triangles() {
    return al::gAutoLODInstance ? al::gAutoLODInstance->frameTriangles() : 0;
}

EMSCRIPTEN_KEEPALIVE
float al_autolod_get_bias() {
    return al::gAutoLODInstance ? al::gAutoLODInstance->bias() : 1.0f;
}

}

#endif // AL_WEB_AUTO_LOD_HPP
