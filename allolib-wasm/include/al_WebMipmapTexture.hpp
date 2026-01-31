/**
 * Unreal-Style Automatic Texture LOD with Mipmaps
 *
 * Single texture upload with GPU-generated mipmaps and continuous LOD selection.
 *
 * Features:
 * - Upload ONE high-resolution texture
 * - GPU auto-generates full mipmap chain via glGenerateMipmap()
 * - Continuous LOD selection (float, not discrete levels)
 * - Shader samples mip level using textureLod()
 *
 * Usage:
 *   MipmapTexture tex;
 *   tex.load("/assets/brick_4k.jpg");
 *   tex.setReferenceDistance(5.0f);
 *
 *   void onDraw(Graphics& g) {
 *       float dist = (nav().pos() - objectPos).mag();
 *       float lod = tex.calculateLOD(dist);
 *
 *       g.shader(lodShader);
 *       lodShader.uniform("u_textureLOD", lod);
 *       tex.bind(0);
 *       g.draw(mesh);
 *   }
 *
 * LOD Formula:
 *   LOD = log2(distance / referenceDistance) + bias
 *
 *   At referenceDistance (default 5.0): LOD = 0 (full resolution)
 *   At 2x distance: LOD = 1 (half resolution)
 *   At 4x distance: LOD = 2 (quarter resolution)
 */

#ifndef AL_WEB_MIPMAP_TEXTURE_HPP
#define AL_WEB_MIPMAP_TEXTURE_HPP

#include <emscripten.h>
#include <string>
#include <vector>
#include <array>
#include <cmath>
#include <functional>
#include <algorithm>

#include "al_WebImage.hpp"
#include "al/graphics/al_OpenGL.hpp"

// Anisotropic filtering extension constants (EXT_texture_filter_anisotropic)
// These may not be defined in all OpenGL ES / WebGL2 headers
#ifndef GL_TEXTURE_MAX_ANISOTROPY_EXT
#define GL_TEXTURE_MAX_ANISOTROPY_EXT 0x84FE
#endif
#ifndef GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT
#define GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT 0x84FF
#endif

namespace al {

/**
 * MipmapTexture - Single texture with auto-generated mipmaps
 *
 * Provides Unreal Engine-style continuous LOD based on distance.
 * GPU generates the full mipmap chain automatically.
 */
class MipmapTexture {
public:
    using LoadCallback = std::function<void(bool success)>;

    MipmapTexture()
        : mTextureId(0)
        , mWidth(0)
        , mHeight(0)
        , mMaxMipLevel(0)
        , mLODBias(0.0f)
        , mReferenceDistance(5.0f)
        , mReady(false)
        , mNeedsUpload(false)
    {}

    ~MipmapTexture() {
        destroy();
    }

    /**
     * Load texture from URL asynchronously
     */
    void load(const std::string& url, LoadCallback callback = nullptr) {
        mReady = false;
        mNeedsUpload = false;
        mUrl = url;
        mCallback = callback;

        printf("[MipmapTexture] Loading: %s\n", url.c_str());

        mImage.load(url, [this](bool success) {
            if (success && mImage.width() > 0 && mImage.height() > 0) {
                mWidth = mImage.width();
                mHeight = mImage.height();
                mMaxMipLevel = (int)floor(log2(std::max(mWidth, mHeight)));
                mNeedsUpload = true;

                printf("[MipmapTexture] Loaded: %s (%dx%d, %d mip levels)\n",
                       mUrl.c_str(), mWidth, mHeight, mMaxMipLevel + 1);

                if (mCallback) mCallback(true);
            } else {
                printf("[MipmapTexture] Failed to load: %s\n", mUrl.c_str());
                if (mCallback) mCallback(false);
            }
        });
    }

    /**
     * Upload texture to GPU and generate mipmaps
     * Call this after load completes (or it's called automatically on first bind)
     */
    void uploadToGPU() {
        if (!mNeedsUpload || mWidth == 0 || mHeight == 0) return;

        // Create texture if needed
        if (mTextureId == 0) {
            glGenTextures(1, &mTextureId);
        }

        glBindTexture(GL_TEXTURE_2D, mTextureId);

        // Upload base level only
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8,
                     mWidth, mHeight, 0,
                     GL_RGBA, GL_UNSIGNED_BYTE, mImage.pixels());

        // GPU generates full mipmap chain automatically
        glGenerateMipmap(GL_TEXTURE_2D);

        // Trilinear filtering for smooth mip transitions
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);

        // Enable anisotropic filtering if available
        GLfloat maxAniso = 1.0f;
        glGetFloatv(GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT, &maxAniso);
        if (maxAniso > 1.0f) {
            glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_MAX_ANISOTROPY_EXT,
                           std::min(maxAniso, 4.0f));
        }

        glBindTexture(GL_TEXTURE_2D, 0);

        mReady = true;
        mNeedsUpload = false;

        printf("[MipmapTexture] Uploaded to GPU: %dx%d, mip levels 0-%d\n",
               mWidth, mHeight, mMaxMipLevel);
    }

    /**
     * Destroy GPU resources
     */
    void destroy() {
        if (mTextureId != 0) {
            glDeleteTextures(1, &mTextureId);
            mTextureId = 0;
        }
        mReady = false;
    }

    /**
     * Calculate continuous LOD from distance
     *
     * Formula: LOD = log2(distance / referenceDistance) + bias
     *
     * @param distance Distance from camera to object
     * @param objectScale Scale of the object (larger objects need less detail)
     * @return Continuous LOD value (0.0 = full res, 1.0 = half res, etc.)
     */
    float calculateLOD(float distance, float objectScale = 1.0f) const {
        if (mReferenceDistance <= 0.0f) return 0.0f;

        float effectiveDistance = distance / std::max(0.001f, objectScale);
        float lod = log2f(effectiveDistance / mReferenceDistance) + mLODBias;

        return std::clamp(lod, 0.0f, (float)mMaxMipLevel);
    }

    /**
     * Calculate LOD from screen coverage (Unreal-style)
     *
     * @param objectScreenPixels Object's projected size in pixels
     * @param screenHeight Total screen height in pixels
     * @return Continuous LOD value
     */
    float calculateLODFromScreenSize(float objectScreenPixels, float screenHeight) const {
        if (objectScreenPixels <= 0.0f || screenHeight <= 0.0f) return (float)mMaxMipLevel;

        // How many texture pixels would ideally cover the screen area
        float screenCoverage = objectScreenPixels / screenHeight;
        float neededTexels = screenCoverage * (float)mHeight;

        // LOD = how many times we can halve the texture and still have enough detail
        float lod = log2f((float)mHeight / std::max(1.0f, neededTexels)) + mLODBias;

        return std::clamp(lod, 0.0f, (float)mMaxMipLevel);
    }

    /**
     * Bind texture to specified unit
     */
    void bind(int unit = 0) {
        // Lazy upload on first bind
        if (mNeedsUpload) {
            uploadToGPU();
        }

        glActiveTexture(GL_TEXTURE0 + unit);
        glBindTexture(GL_TEXTURE_2D, mTextureId);
    }

    /**
     * Unbind texture from specified unit
     */
    void unbind(int unit = 0) {
        glActiveTexture(GL_TEXTURE0 + unit);
        glBindTexture(GL_TEXTURE_2D, 0);
    }

    // =========================================================================
    // Accessors
    // =========================================================================

    GLuint textureId() const { return mTextureId; }
    int width() const { return mWidth; }
    int height() const { return mHeight; }
    int maxMipLevel() const { return mMaxMipLevel; }
    bool ready() const { return mReady; }

    // =========================================================================
    // Settings
    // =========================================================================

    /**
     * Set LOD bias
     * Negative = sharper (use higher resolution)
     * Positive = blurrier (use lower resolution)
     */
    void setLODBias(float bias) { mLODBias = bias; }
    float lodBias() const { return mLODBias; }

    /**
     * Set reference distance (distance where LOD = 0)
     * At this distance, full resolution is used.
     * At 2x this distance, LOD = 1 (half resolution).
     */
    void setReferenceDistance(float d) { mReferenceDistance = std::max(0.001f, d); }
    float referenceDistance() const { return mReferenceDistance; }

private:
    GLuint mTextureId;
    int mWidth;
    int mHeight;
    int mMaxMipLevel;
    float mLODBias;
    float mReferenceDistance;

    std::string mUrl;
    WebImage mImage;
    LoadCallback mCallback;

    bool mReady;
    bool mNeedsUpload;
};

/**
 * PBRMipmapSet - Complete PBR texture set with mipmap LOD
 *
 * Loads albedo, normal, roughness, metallic, AO, and emissive maps
 * with automatic mipmap generation and continuous LOD selection.
 */
class PBRMipmapSet {
public:
    enum MapType {
        ALBEDO = 0,
        NORMAL,
        ROUGHNESS,
        METALLIC,
        AO,
        EMISSIVE,
        MAP_COUNT
    };

    using LoadCallback = std::function<void(bool success)>;

    PBRMipmapSet()
        : mCurrentLOD(0.0f)
        , mReferenceDistance(5.0f)
        , mLODBias(0.0f)
        , mMaxMipLevel(0)
        , mPendingLoads(0)
    {
        mMapEnabled.fill(false);
    }

    /**
     * Load PBR maps from base path
     * Automatically appends: _albedo, _normal, _roughness, _metallic, _ao, _emissive
     *
     * @param basePath Base path without suffix (e.g., "/assets/textures/brick")
     * @param extension File extension (e.g., ".jpg", ".png")
     * @param callback Called when all maps are loaded
     */
    void load(const std::string& basePath,
              const std::string& extension = ".jpg",
              LoadCallback callback = nullptr) {

        mBasePath = basePath;
        mCallback = callback;
        mPendingLoads = 0;

        // Map type suffixes
        const char* suffixes[MAP_COUNT] = {
            "_albedo", "_normal", "_roughness", "_metallic", "_ao", "_emissive"
        };

        printf("[PBRMipmapSet] Loading from: %s\n", basePath.c_str());

        for (int i = 0; i < MAP_COUNT; i++) {
            std::string url = basePath + suffixes[i] + extension;
            mPendingLoads++;

            mMaps[i].setReferenceDistance(mReferenceDistance);
            mMaps[i].setLODBias(mLODBias);

            mMaps[i].load(url, [this, i](bool success) {
                mMapEnabled[i] = success;
                mPendingLoads--;

                if (success && mMaps[i].maxMipLevel() > mMaxMipLevel) {
                    mMaxMipLevel = mMaps[i].maxMipLevel();
                }

                // Check if all loads completed
                if (mPendingLoads == 0) {
                    int loadedCount = 0;
                    for (int j = 0; j < MAP_COUNT; j++) {
                        if (mMapEnabled[j]) loadedCount++;
                    }
                    printf("[PBRMipmapSet] Loaded %d/%d maps\n", loadedCount, MAP_COUNT);

                    if (mCallback) {
                        mCallback(loadedCount > 0);
                    }
                }
            });
        }
    }

    /**
     * Calculate LOD for entire set based on distance
     */
    float calculateLOD(float distance, float objectScale = 1.0f) const {
        if (mReferenceDistance <= 0.0f) return 0.0f;

        float effectiveDistance = distance / std::max(0.001f, objectScale);
        float lod = log2f(effectiveDistance / mReferenceDistance) + mLODBias;

        return std::clamp(lod, 0.0f, (float)mMaxMipLevel);
    }

    /**
     * Update LOD value based on distance
     */
    void updateLOD(float distance, float objectScale = 1.0f) {
        mCurrentLOD = calculateLOD(distance, objectScale);
    }

    /**
     * Bind all available maps to consecutive texture units
     * Returns the current LOD value for shader uniform
     */
    void bind(int baseUnit = 3) {
        for (int i = 0; i < MAP_COUNT; i++) {
            if (mMapEnabled[i]) {
                mMaps[i].bind(baseUnit + i);
            }
        }
    }

    /**
     * Unbind all maps
     */
    void unbind(int baseUnit = 3) {
        for (int i = 0; i < MAP_COUNT; i++) {
            if (mMapEnabled[i]) {
                mMaps[i].unbind(baseUnit + i);
            }
        }
    }

    /**
     * Bind a specific map type
     */
    void bindMap(MapType type, int unit) {
        if (mMapEnabled[type]) {
            mMaps[type].bind(unit);
        }
    }

    // =========================================================================
    // Accessors
    // =========================================================================

    float currentLOD() const { return mCurrentLOD; }
    int maxMipLevel() const { return mMaxMipLevel; }
    bool hasMap(MapType type) const { return mMapEnabled[type]; }
    bool ready() const { return mPendingLoads == 0; }

    MipmapTexture& map(MapType type) { return mMaps[type]; }
    const MipmapTexture& map(MapType type) const { return mMaps[type]; }

    // =========================================================================
    // Settings
    // =========================================================================

    void setReferenceDistance(float d) {
        mReferenceDistance = std::max(0.001f, d);
        for (int i = 0; i < MAP_COUNT; i++) {
            mMaps[i].setReferenceDistance(mReferenceDistance);
        }
    }
    float referenceDistance() const { return mReferenceDistance; }

    void setLODBias(float bias) {
        mLODBias = bias;
        for (int i = 0; i < MAP_COUNT; i++) {
            mMaps[i].setLODBias(mLODBias);
        }
    }
    float lodBias() const { return mLODBias; }

private:
    std::array<MipmapTexture, MAP_COUNT> mMaps;
    std::array<bool, MAP_COUNT> mMapEnabled;

    std::string mBasePath;
    LoadCallback mCallback;

    float mCurrentLOD;
    float mReferenceDistance;
    float mLODBias;
    int mMaxMipLevel;
    int mPendingLoads;
};

// =========================================================================
// Global Helper Functions
// =========================================================================

/**
 * Calculate continuous texture LOD from distance
 * Uses the global AutoLOD settings if available
 */
inline float calculateTextureLOD(float distance, float referenceDistance = 5.0f,
                                  float bias = 0.0f, int maxMipLevel = 12) {
    if (referenceDistance <= 0.0f) return 0.0f;

    float lod = log2f(distance / referenceDistance) + bias;
    return std::clamp(lod, 0.0f, (float)maxMipLevel);
}

/**
 * Calculate texture LOD from screen coverage
 */
inline float calculateTextureLODFromScreen(float objectScreenPixels, float screenHeight,
                                            float textureHeight, float bias = 0.0f,
                                            int maxMipLevel = 12) {
    if (objectScreenPixels <= 0.0f || screenHeight <= 0.0f) return (float)maxMipLevel;

    float screenCoverage = objectScreenPixels / screenHeight;
    float neededTexels = screenCoverage * textureHeight;
    float lod = log2f(textureHeight / std::max(1.0f, neededTexels)) + bias;

    return std::clamp(lod, 0.0f, (float)maxMipLevel);
}

} // namespace al

#endif // AL_WEB_MIPMAP_TEXTURE_HPP
