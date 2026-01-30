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
 * - Texture LOD integration for automatic resolution switching
 *
 * Usage:
 *   // Enable in onCreate - that's it!
 *   enableAutoLOD();
 *
 *   // In onDraw, just use drawLOD()
 *   drawLOD(g, myMesh);  // LOD selected automatically!
 *
 *   // For textures, use global helpers
 *   int level = getTextureLOD(distance);  // Get LOD level for distance
 *   int res = getTextureResolution(distance);  // Get recommended resolution
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
        , mMaxLevels(16)  // Support up to 16 LOD levels
        , mReductionFactor(0.5f)
        , mBias(1.0f)
        , mDistanceScale(1.0f)  // Unified distance scale multiplier
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
        , mMinFullQualityDistance(5.0f)  // Always use LOD 0 within this distance
        , mUnloadDistance(500.0f)  // Distance at which to unload (return empty mesh)
        , mUnloadEnabled(false)   // Whether unloading is enabled
        , mTextureLODEnabled(true)  // Texture LOD enabled by default
        , mTextureLODBias(1.0f)     // Texture LOD bias (higher = lower quality sooner)
        , mMaxTextureResolution(4096)  // Maximum texture resolution
        , mStatsEnabled(0)  // Using int instead of bool to avoid potential optimization issues
        , mTotalTriangles(0)
        , mMeshCount(0)
        , mFrameTime(0.016f)
        , mAdaptiveEnabled(true)
    {
        // Default distance thresholds (used for Distance mode) - up to 16 levels
        mDistances = {10.0f, 20.0f, 35.0f, 55.0f, 80.0f, 120.0f, 180.0f, 250.0f,
                      350.0f, 500.0f, 700.0f, 1000.0f, 1500.0f, 2000.0f, 3000.0f, 5000.0f};

        // Screen size thresholds (fraction of screen height) - up to 16 levels
        mScreenSizeThresholds = {0.5f, 0.35f, 0.25f, 0.18f, 0.12f, 0.08f, 0.05f, 0.03f,
                                  0.02f, 0.012f, 0.008f, 0.005f, 0.003f, 0.002f, 0.001f, 0.0005f};

        // Texture LOD distance thresholds (distance -> resolution level)
        // Closer = higher resolution, further = lower resolution
        mTextureDistances = {5.0f, 15.0f, 30.0f, 60.0f, 120.0f};

        // Standard texture resolution levels (from highest to lowest)
        mTextureResolutions = {4096, 2048, 1024, 512, 256, 128};
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

    void setLevels(int levels) {
        int newLevels = std::max(1, std::min(levels, mMaxLevels));
        if (newLevels != mNumLevels) {
            mNumLevels = newLevels;
            clearCache();  // Regenerate all meshes with new level count
            printf("[AutoLOD] Levels changed to %d, cache cleared for regeneration\n", mNumLevels);
        }
    }
    int levels() const { return mNumLevels; }
    int maxLevels() const { return mMaxLevels; }

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

    // Minimum distance for full quality (LOD 0) - always use full quality within this range
    void setMinFullQualityDistance(float distance) { mMinFullQualityDistance = std::max(0.0f, distance); }
    float minFullQualityDistance() const { return mMinFullQualityDistance; }

    // Distance scale - unified multiplier for all LOD distances (maintains ratios)
    // Higher = objects stay higher quality at distance, Lower = more aggressive LOD
    void setDistanceScale(float scale) { mDistanceScale = std::max(0.1f, std::min(scale, 10.0f)); }
    float distanceScale() const { return mDistanceScale; }

    // Unload distance - beyond this distance, mesh is not drawn (returns empty mesh)
    void setUnloadDistance(float distance) { mUnloadDistance = std::max(1.0f, distance); }
    float unloadDistance() const { return mUnloadDistance; }

    // Enable/disable unloading at max distance
    void setUnloadEnabled(bool enabled) { mUnloadEnabled = enabled; }
    bool unloadEnabled() const { return mUnloadEnabled; }

    // =========================================================================
    // Texture LOD Settings
    // =========================================================================

    // Enable/disable texture LOD
    void setTextureLODEnabled(bool enabled) { mTextureLODEnabled = enabled; }
    bool textureLODEnabled() const { return mTextureLODEnabled; }

    // Texture LOD bias - affects when to switch to lower resolutions
    // Higher values = use lower resolution textures sooner (better performance)
    // Lower values = keep high resolution textures longer (better quality)
    void setTextureLODBias(float bias) { mTextureLODBias = std::max(0.1f, std::min(bias, 5.0f)); }
    float textureLODBias() const { return mTextureLODBias; }

    // Maximum texture resolution allowed
    void setMaxTextureResolution(int resolution) {
        // Clamp to valid power-of-2 values
        if (resolution >= 4096) mMaxTextureResolution = 4096;
        else if (resolution >= 2048) mMaxTextureResolution = 2048;
        else if (resolution >= 1024) mMaxTextureResolution = 1024;
        else if (resolution >= 512) mMaxTextureResolution = 512;
        else mMaxTextureResolution = 256;
    }
    int maxTextureResolution() const { return mMaxTextureResolution; }

    // Texture distance thresholds
    void setTextureDistances(const std::vector<float>& distances) {
        mTextureDistances = distances;
    }
    const std::vector<float>& textureDistances() const { return mTextureDistances; }

    // Texture resolution levels (from highest to lowest)
    void setTextureResolutions(const std::vector<int>& resolutions) {
        mTextureResolutions = resolutions;
    }
    const std::vector<int>& textureResolutions() const { return mTextureResolutions; }

    /**
     * Get texture LOD level for a given distance.
     * Returns 0 for closest (highest quality), increasing for lower quality.
     * @param distance Distance from camera to object
     * @param numLevels Number of LOD levels available (default: use configured levels)
     * @return LOD level index (0 = highest quality)
     */
    int getTextureLODLevel(float distance, int numLevels = -1) const {
        if (!mTextureLODEnabled) return 0;  // Always highest quality if disabled

        int maxLevel = (numLevels > 0) ? numLevels - 1 : (int)mTextureDistances.size();

        // Apply bias (higher bias = lower quality sooner)
        float effectiveDistance = distance * mTextureLODBias;

        for (size_t i = 0; i < mTextureDistances.size(); i++) {
            if (effectiveDistance < mTextureDistances[i]) {
                return std::min((int)i, maxLevel);
            }
        }
        return maxLevel;
    }

    /**
     * Get recommended texture resolution for a given distance.
     * Takes into account bias and max resolution settings.
     * @param distance Distance from camera to object
     * @return Recommended texture resolution (e.g., 4096, 2048, 1024, 512, 256)
     */
    int getTextureResolution(float distance) const {
        if (!mTextureLODEnabled) return mMaxTextureResolution;

        int level = getTextureLODLevel(distance);
        if (level < (int)mTextureResolutions.size()) {
            return std::min(mTextureResolutions[level], mMaxTextureResolution);
        }
        return std::min(mTextureResolutions.back(), mMaxTextureResolution);
    }

    /**
     * Get texture LOD level from screen coverage.
     * Uses projected screen size to determine appropriate texture resolution.
     * @param screenCoverage Fraction of screen covered by the texture (0-1)
     * @return LOD level index
     */
    int getTextureLODFromScreenCoverage(float screenCoverage) const {
        if (!mTextureLODEnabled) return 0;

        // Screen coverage thresholds for texture LOD
        // Higher coverage = need higher resolution
        static const float coverageThresholds[] = {0.5f, 0.25f, 0.1f, 0.04f, 0.01f};

        for (size_t i = 0; i < 5; i++) {
            if (screenCoverage > coverageThresholds[i]) {
                return i;
            }
        }
        return 5;
    }

    // =========================================================================
    // Continuous Texture LOD (Unreal-style mipmap-based)
    // =========================================================================

    /**
     * Set texture reference distance.
     * This is the distance at which LOD = 0 (full resolution).
     * At 2x this distance, LOD = 1 (half resolution), etc.
     */
    void setTextureReferenceDistance(float d) {
        mTextureReferenceDistance = std::max(0.001f, d);
    }
    float textureReferenceDistance() const { return mTextureReferenceDistance; }

    /**
     * Get continuous (float) texture LOD from distance.
     * Uses logarithmic formula: LOD = log2(distance / referenceDistance) + bias
     *
     * This provides smooth, continuous LOD values for mipmap sampling.
     *
     * @param distance Distance from camera to object
     * @param maxMipLevel Maximum mip level available in the texture
     * @return Continuous LOD value (0.0 = full resolution, 1.0 = half, etc.)
     */
    float getContinuousTextureLOD(float distance, int maxMipLevel) const {
        if (!mTextureLODEnabled) return 0.0f;

        // Apply bias to distance (higher bias = lower quality sooner)
        float effectiveDistance = distance * mTextureLODBias;

        // Logarithmic LOD calculation
        float lod = log2f(effectiveDistance / mTextureReferenceDistance);

        return std::clamp(lod, 0.0f, (float)maxMipLevel);
    }

    /**
     * Get continuous texture LOD from screen coverage (Unreal-style).
     * Based on how much of the screen the textured object covers.
     *
     * @param screenCoverage Object's projected size in pixels
     * @param textureSize Original texture size (width or height)
     * @param maxMipLevel Maximum mip level available
     * @return Continuous LOD value
     */
    float getScreenBasedTextureLOD(float screenCoverage, int textureSize, int maxMipLevel) const {
        if (!mTextureLODEnabled) return 0.0f;
        if (screenCoverage <= 0.0f || textureSize <= 0) return (float)maxMipLevel;

        // How many texture pixels would ideally cover the screen area
        float neededTexels = screenCoverage;

        // LOD = how many times we can halve the texture and still have enough detail
        float lod = log2f((float)textureSize / std::max(1.0f, neededTexels)) * mTextureLODBias;

        return std::clamp(lod, 0.0f, (float)maxMipLevel);
    }

    /**
     * Get continuous texture LOD using projected screen size.
     * Combines distance and FOV for accurate LOD selection.
     *
     * @param distance Distance from camera to object
     * @param objectSize World-space size of the object
     * @param textureSize Original texture size
     * @param maxMipLevel Maximum mip level available
     * @return Continuous LOD value
     */
    float getProjectedTextureLOD(float distance, float objectSize, int textureSize, int maxMipLevel) const {
        if (!mTextureLODEnabled) return 0.0f;

        // Calculate projected screen size
        float tanHalfFOV = tanf(mFOV * 0.5f * 3.14159f / 180.0f);
        float projectedPixels = (objectSize / std::max(0.001f, distance)) *
                                (mScreenHeight / (2.0f * tanHalfFOV));

        return getScreenBasedTextureLOD(projectedPixels, textureSize, maxMipLevel);
    }

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

    void enableStats(bool e = true) { mStatsEnabled = e ? 1 : 0; }
    bool statsEnabled() const { return mStatsEnabled != 0; }

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

        // Calculate distance for unload check
        Vec3f objectPos(modelMatrix[12], modelMatrix[13], modelMatrix[14]);
        float rawDistance = (mCameraPos - objectPos).mag();

        // Check for unload (return empty mesh)
        if (mUnloadEnabled && rawDistance > mUnloadDistance * mDistanceScale) {
            // Don't count triangles for unloaded meshes
            return mEmptyMesh;
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

        // Extract scale from model matrix (approximate)
        // (objectPos already calculated above for unload check)
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

        // Apply distance scale (all distances are scaled by this)
        float scaledMinFullQuality = mMinFullQualityDistance * mDistanceScale;

        // ALWAYS use LOD 0 (full quality) within minimum distance
        if (distance < scaledMinFullQuality) {
            return 0;
        }

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
        // Apply both bias and distance scale
        float effectiveDistance = distance * mBias / mDistanceScale;
        for (size_t i = 0; i < mDistances.size() && i < (size_t)mNumLevels; i++) {
            if (effectiveDistance < mDistances[i]) return i;
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

        // Apply bias and distance scale (higher distance scale = more detail at distance)
        projectedSize = projectedSize * mDistanceScale / mBias;

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
    int mMaxLevels;
    float mReductionFactor;
    float mBias;
    float mDistanceScale;  // Unified distance scale
    int mMinVertices;
    Vec3f mCameraPos;
    LODSelectionMode mSelectionMode;

    // Empty mesh for unloading
    Mesh mEmptyMesh;

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
    float mMinFullQualityDistance;
    float mUnloadDistance;
    bool mUnloadEnabled;

    // Texture LOD
    bool mTextureLODEnabled;
    float mTextureLODBias;
    int mMaxTextureResolution;
    float mTextureReferenceDistance = 5.0f;  // Distance where LOD = 0 (full resolution)
    std::vector<float> mTextureDistances;
    std::vector<int> mTextureResolutions;

    // Adaptive
    bool mAdaptiveEnabled;
    float mFrameTime;
    float mTargetFrameTime = 0.016f;  // 60 FPS

    // Cache
    std::unordered_map<MeshIdentity, CachedLODMesh, MeshIdentityHash> mCache;

    // Stats - using int instead of bool to avoid potential WASM optimization issues
    int mStatsEnabled;
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

// =========================================================================
// Global drawLOD() function for easy transpiler compatibility
// =========================================================================

/**
 * Global drawLOD function - draws a mesh with automatic LOD selection.
 *
 * This is a convenience function that can be called from anywhere without
 * needing access to the WebApp instance. It uses the global AutoLODManager
 * that is automatically set up when WebApp::start() is called.
 *
 * Usage:
 *   void onDraw(Graphics& g) {
 *       al::drawLOD(g, myMesh);  // Automatic LOD based on camera distance
 *   }
 *
 * If auto-LOD is not enabled or no global instance exists, this falls back
 * to drawing the original mesh without LOD.
 */
inline void drawLOD(Graphics& g, const Mesh& mesh) {
    if (gAutoLODInstance && gAutoLODInstance->enabled()) {
        const Mesh& selected = gAutoLODInstance->selectMesh(mesh, g.modelMatrix());
        g.draw(selected);
    } else {
        g.draw(mesh);
    }
}

/**
 * Enable auto-LOD globally with default settings.
 * Call this in onCreate() to enable automatic LOD for all drawLOD() calls.
 */
inline void enableAutoLOD(int levels = 4) {
    if (gAutoLODInstance) {
        gAutoLODInstance->enable();
        gAutoLODInstance->setLevels(levels);
    }
}

/**
 * Disable auto-LOD globally.
 */
inline void disableAutoLOD() {
    if (gAutoLODInstance) {
        gAutoLODInstance->disable();
    }
}

// =========================================================================
// Global Texture LOD Helpers
// =========================================================================

/**
 * Get texture LOD level for a given distance.
 * Uses the global AutoLODManager settings.
 * @param distance Distance from camera to object
 * @param numLevels Number of LOD levels available (optional)
 * @return LOD level index (0 = highest quality)
 */
inline int getTextureLOD(float distance, int numLevels = -1) {
    if (gAutoLODInstance) {
        return gAutoLODInstance->getTextureLODLevel(distance, numLevels);
    }
    return 0;  // Default to highest quality
}

/**
 * Get recommended texture resolution for a given distance.
 * Uses the global AutoLODManager settings.
 * @param distance Distance from camera to object
 * @return Recommended texture resolution (4096, 2048, 1024, 512, 256, or 128)
 */
inline int getTextureResolution(float distance) {
    if (gAutoLODInstance) {
        return gAutoLODInstance->getTextureResolution(distance);
    }
    return 4096;  // Default to maximum
}

/**
 * Check if texture LOD is enabled globally.
 */
inline bool isTextureLODEnabled() {
    if (gAutoLODInstance) {
        return gAutoLODInstance->textureLODEnabled();
    }
    return false;
}

/**
 * Enable texture LOD globally.
 */
inline void enableTextureLOD() {
    if (gAutoLODInstance) {
        gAutoLODInstance->setTextureLODEnabled(true);
    }
}

/**
 * Disable texture LOD globally.
 */
inline void disableTextureLOD() {
    if (gAutoLODInstance) {
        gAutoLODInstance->setTextureLODEnabled(false);
    }
}

/**
 * Set texture LOD bias globally.
 * @param bias LOD bias (higher = lower quality sooner, default 1.0)
 */
inline void setTextureLODBias(float bias) {
    if (gAutoLODInstance) {
        gAutoLODInstance->setTextureLODBias(bias);
    }
}

/**
 * Set maximum texture resolution globally.
 * @param resolution Maximum resolution (4096, 2048, 1024, 512, or 256)
 */
inline void setMaxTextureResolution(int resolution) {
    if (gAutoLODInstance) {
        gAutoLODInstance->setMaxTextureResolution(resolution);
    }
}

// =========================================================================
// Continuous Texture LOD Helpers (Unreal-style mipmap support)
// =========================================================================

/**
 * Get continuous texture LOD from distance.
 * Returns a float value for smooth mipmap sampling using textureLod().
 *
 * @param distance Distance from camera to object
 * @param maxMipLevel Maximum mip level in the texture
 * @return Continuous LOD value (0.0 = full resolution, 1.0 = half, 2.0 = quarter, etc.)
 */
inline float getTextureLODContinuous(float distance, int maxMipLevel = 12) {
    if (gAutoLODInstance) {
        return gAutoLODInstance->getContinuousTextureLOD(distance, maxMipLevel);
    }
    // Fallback calculation if no global instance
    const float referenceDistance = 5.0f;
    float lod = log2f(distance / referenceDistance);
    return std::clamp(lod, 0.0f, (float)maxMipLevel);
}

/**
 * Get continuous texture LOD from screen coverage.
 * For Unreal-style screen-based LOD selection.
 *
 * @param screenCoverage Object's projected size in pixels
 * @param textureSize Original texture size
 * @param maxMipLevel Maximum mip level in the texture
 * @return Continuous LOD value
 */
inline float getTextureLODFromScreen(float screenCoverage, int textureSize, int maxMipLevel = 12) {
    if (gAutoLODInstance) {
        return gAutoLODInstance->getScreenBasedTextureLOD(screenCoverage, textureSize, maxMipLevel);
    }
    // Fallback calculation
    if (screenCoverage <= 0.0f || textureSize <= 0) return (float)maxMipLevel;
    float lod = log2f((float)textureSize / std::max(1.0f, screenCoverage));
    return std::clamp(lod, 0.0f, (float)maxMipLevel);
}

/**
 * Set texture reference distance globally.
 * This is the distance at which LOD = 0 (full resolution).
 *
 * @param distance Reference distance (default 5.0)
 */
inline void setTextureReferenceDistance(float distance) {
    if (gAutoLODInstance) {
        gAutoLODInstance->setTextureReferenceDistance(distance);
    }
}

/**
 * Get current texture reference distance.
 */
inline float getTextureReferenceDistance() {
    if (gAutoLODInstance) {
        return gAutoLODInstance->textureReferenceDistance();
    }
    return 5.0f;  // Default
}

} // namespace al

// =========================================================================
// JavaScript bridge functions (called from frontend settings)
// Declarations only - definitions are in al_WebApp.cpp
// =========================================================================
extern "C" {
    EMSCRIPTEN_KEEPALIVE void al_autolod_set_bias(float bias);
    EMSCRIPTEN_KEEPALIVE void al_autolod_set_enabled(int enabled);
    EMSCRIPTEN_KEEPALIVE void al_autolod_set_budget(int budget);
    EMSCRIPTEN_KEEPALIVE void al_autolod_set_mode(int mode);
    EMSCRIPTEN_KEEPALIVE void al_autolod_set_min_full_quality_distance(float distance);
    EMSCRIPTEN_KEEPALIVE void al_autolod_set_distances(float d0, float d1, float d2, float d3);
    EMSCRIPTEN_KEEPALIVE int al_autolod_get_triangles();
    EMSCRIPTEN_KEEPALIVE float al_autolod_get_bias();
    // New functions for enhanced LOD control
    EMSCRIPTEN_KEEPALIVE void al_autolod_set_distance_scale(float scale);
    EMSCRIPTEN_KEEPALIVE float al_autolod_get_distance_scale();
    EMSCRIPTEN_KEEPALIVE void al_autolod_set_levels(int levels);
    EMSCRIPTEN_KEEPALIVE int al_autolod_get_levels();
    EMSCRIPTEN_KEEPALIVE void al_autolod_set_unload_distance(float distance);
    EMSCRIPTEN_KEEPALIVE void al_autolod_set_unload_enabled(int enabled);

    // Texture LOD functions
    EMSCRIPTEN_KEEPALIVE void al_texture_lod_set_enabled(int enabled);
    EMSCRIPTEN_KEEPALIVE int al_texture_lod_get_enabled();
    EMSCRIPTEN_KEEPALIVE void al_texture_lod_set_bias(float bias);
    EMSCRIPTEN_KEEPALIVE float al_texture_lod_get_bias();
    EMSCRIPTEN_KEEPALIVE void al_texture_lod_set_max_resolution(int resolution);
    EMSCRIPTEN_KEEPALIVE int al_texture_lod_get_max_resolution();
    EMSCRIPTEN_KEEPALIVE int al_texture_lod_get_resolution(float distance);
    EMSCRIPTEN_KEEPALIVE int al_texture_lod_get_level(float distance, int numLevels);

    // Continuous texture LOD functions (mipmap support)
    EMSCRIPTEN_KEEPALIVE void al_texture_lod_set_reference_distance(float distance);
    EMSCRIPTEN_KEEPALIVE float al_texture_lod_get_reference_distance();
    EMSCRIPTEN_KEEPALIVE float al_texture_lod_get_continuous(float distance, int maxMipLevel);
}

#endif // AL_WEB_AUTO_LOD_HPP
