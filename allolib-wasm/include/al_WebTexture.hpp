/**
 * Web Texture System
 *
 * Unified texture loading with multi-resolution support and LOD integration.
 * Supports async loading, LOD selection, and PBR texture maps.
 *
 * Usage:
 *   WebTexture tex;
 *   tex.loadMultiRes("/assets/textures/brick", {2048, 1024, 512});
 *   // Loads brick_2k.jpg, brick_1k.jpg, brick_512.jpg
 *
 *   // In onDraw
 *   tex.bind(0, cameraDistance);  // Auto-selects appropriate resolution
 *
 * PBR Usage:
 *   PBRTextureSet bricks;
 *   bricks.load("/assets/textures/brick", {2048, 1024, 512});
 *   // Loads brick_albedo_2k.jpg, brick_normal_2k.jpg, etc.
 *
 *   bricks.bind(0, cameraDistance);  // Binds all maps with LOD
 */

#ifndef AL_WEB_TEXTURE_HPP
#define AL_WEB_TEXTURE_HPP

#include <emscripten.h>
// Use allolib's OpenGL header which properly handles GLAD
#include "al/graphics/al_OpenGL.hpp"
#include <vector>
#include <string>
#include <functional>
#include <unordered_map>
#include <memory>
#include <array>
#include <cmath>

#include "al_WebImage.hpp"
#include "al_WebLOD.hpp"

namespace al {

/**
 * Multi-resolution texture with LOD support
 */
class WebTexture {
public:
    using LoadCallback = std::function<void(bool success, int level)>;

    WebTexture() : mCurrentLevel(0), mReady(false), mUploaded(false) {}

    ~WebTexture() {
        destroy();
    }

    /**
     * Load single texture from URL
     */
    void load(const std::string& url, LoadCallback callback = nullptr) {
        mCallback = callback;
        mLevels.clear();
        mLevels.resize(1);
        mLevels[0].url = url;
        mLevels[0].resolution = 0;  // Unknown until loaded

        mLevels[0].image.load(url, [this](bool success) {
            if (success) {
                mLevels[0].resolution = mLevels[0].image.width();
                mLevels[0].loaded = true;
                mReady = true;
                printf("[WebTexture] Loaded: %s (%dx%d)\n",
                       mLevels[0].url.c_str(),
                       mLevels[0].image.width(),
                       mLevels[0].image.height());
            }
            if (mCallback) mCallback(success, 0);
        });
    }

    /**
     * Load multi-resolution texture set
     * @param basePath Base path without resolution suffix
     * @param resolutions List of resolutions to load (e.g., {2048, 1024, 512})
     * @param extension File extension (default: ".jpg")
     *
     * Files should be named: basePath_2k.jpg, basePath_1k.jpg, basePath_512.jpg
     */
    void loadMultiRes(const std::string& basePath,
                      const std::vector<int>& resolutions,
                      const std::string& extension = ".jpg") {
        mLevels.clear();
        mLevels.resize(resolutions.size());
        mLoadedCount = 0;
        mReady = false;

        // Set up LOD thresholds
        mLOD.setLevels(std::vector<int>(resolutions.begin(), resolutions.end()));

        for (size_t i = 0; i < resolutions.size(); i++) {
            mLevels[i].resolution = resolutions[i];
            mLevels[i].url = basePath + "_" + resolutionSuffix(resolutions[i]) + extension;

            size_t idx = i;
            mLevels[i].image.load(mLevels[i].url, [this, idx](bool success) {
                if (success) {
                    mLevels[idx].loaded = true;
                    mLoadedCount++;
                    printf("[WebTexture] Loaded level %zu: %s (%d)\n",
                           idx, mLevels[idx].url.c_str(), mLevels[idx].resolution);

                    // Ready when at least one level is loaded
                    if (!mReady) mReady = true;

                    if (mCallback) mCallback(true, idx);
                } else {
                    printf("[WebTexture] Failed to load: %s\n", mLevels[idx].url.c_str());
                    if (mCallback) mCallback(false, idx);
                }
            });
        }
    }

    /**
     * Set LOD distance thresholds
     */
    void setLODDistances(const std::vector<float>& distances) {
        mLOD.setDistances(distances);
    }

    /**
     * Set LOD bias (higher = use lower resolution sooner)
     */
    void setLODBias(float bias) {
        mLOD.bias(bias);
    }

    /**
     * Bind texture with automatic LOD selection
     * @param unit Texture unit (0-15)
     * @param distance Camera distance for LOD selection
     */
    void bind(int unit, float distance) {
        int level = mLOD.selectLevel(distance);
        bindLevel(unit, level);
    }

    /**
     * Bind specific LOD level
     */
    void bindLevel(int unit, int level) {
        // Clamp to valid range
        level = std::max(0, std::min(level, (int)mLevels.size() - 1));

        // Find best available level (may need to use higher res if lower not loaded)
        while (level < (int)mLevels.size() && !mLevels[level].loaded) {
            level++;
        }
        // Fallback to lower res if needed
        if (level >= (int)mLevels.size()) {
            for (level = mLevels.size() - 1; level >= 0; level--) {
                if (mLevels[level].loaded) break;
            }
        }

        if (level < 0 || !mLevels[level].loaded) return;

        // Upload if needed
        if (!mLevels[level].uploaded) {
            uploadLevel(level);
        }

        mCurrentLevel = level;

        glActiveTexture(GL_TEXTURE0 + unit);
        glBindTexture(GL_TEXTURE_2D, mLevels[level].textureId);
    }

    /**
     * Unbind texture
     */
    void unbind(int unit) {
        glActiveTexture(GL_TEXTURE0 + unit);
        glBindTexture(GL_TEXTURE_2D, 0);
    }

    /**
     * Get current LOD level
     */
    int currentLevel() const { return mCurrentLevel; }

    /**
     * Get current resolution
     */
    int currentResolution() const {
        if (mCurrentLevel >= 0 && mCurrentLevel < (int)mLevels.size()) {
            return mLevels[mCurrentLevel].resolution;
        }
        return 0;
    }

    /**
     * Check if texture is ready (at least one level loaded)
     */
    bool ready() const { return mReady; }

    /**
     * Check if specific level is ready
     */
    bool levelReady(int level) const {
        return level >= 0 && level < (int)mLevels.size() && mLevels[level].loaded;
    }

    /**
     * Get number of LOD levels
     */
    int numLevels() const { return mLevels.size(); }

    /**
     * Get loading progress (0.0 to 1.0)
     */
    float loadProgress() const {
        if (mLevels.empty()) return 0;
        return (float)mLoadedCount / mLevels.size();
    }

    /**
     * Destroy GPU resources
     */
    void destroy() {
        for (auto& level : mLevels) {
            if (level.textureId != 0) {
                glDeleteTextures(1, &level.textureId);
                level.textureId = 0;
                level.uploaded = false;
            }
        }
    }

private:
    struct TextureLevel {
        std::string url;
        int resolution = 0;
        WebImage image;
        GLuint textureId = 0;
        bool loaded = false;
        bool uploaded = false;
    };

    std::vector<TextureLevel> mLevels;
    TextureLOD mLOD;
    int mCurrentLevel;
    int mLoadedCount = 0;
    bool mReady;
    bool mUploaded;
    LoadCallback mCallback;

    void uploadLevel(int level) {
        if (level < 0 || level >= (int)mLevels.size()) return;
        if (!mLevels[level].loaded || mLevels[level].uploaded) return;

        auto& lvl = mLevels[level];

        glGenTextures(1, &lvl.textureId);
        glBindTexture(GL_TEXTURE_2D, lvl.textureId);

        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8,
                     lvl.image.width(), lvl.image.height(), 0,
                     GL_RGBA, GL_UNSIGNED_BYTE, lvl.image.pixels());

        // Generate mipmaps for quality filtering
        glGenerateMipmap(GL_TEXTURE_2D);

        // Set filtering
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);

        glBindTexture(GL_TEXTURE_2D, 0);

        lvl.uploaded = true;
        printf("[WebTexture] Uploaded level %d to GPU (%dx%d)\n",
               level, lvl.image.width(), lvl.image.height());
    }

    std::string resolutionSuffix(int resolution) {
        if (resolution >= 4096) return "4k";
        if (resolution >= 2048) return "2k";
        if (resolution >= 1024) return "1k";
        return std::to_string(resolution);
    }
};


/**
 * PBR Texture Set - albedo, normal, roughness, metallic, AO
 */
class PBRTextureSet {
public:
    enum MapType {
        ALBEDO = 0,
        NORMAL = 1,
        ROUGHNESS = 2,
        METALLIC = 3,
        AO = 4,
        EMISSIVE = 5,
        HEIGHT = 6,
        NUM_MAPS = 7
    };

    PBRTextureSet() {
        mMapEnabled.fill(false);
    }

    /**
     * Load complete PBR texture set
     * @param basePath Base path (e.g., "/assets/textures/brick")
     * @param resolutions Resolution levels (default: {2048, 1024, 512})
     *
     * Loads: brick_albedo_2k.jpg, brick_normal_2k.jpg, etc.
     */
    void load(const std::string& basePath,
              const std::vector<int>& resolutions = {2048, 1024, 512}) {
        mBasePath = basePath;

        // Load each map type that exists
        loadMap(ALBEDO, basePath + "_albedo", resolutions);
        loadMap(NORMAL, basePath + "_normal", resolutions);
        loadMap(ROUGHNESS, basePath + "_roughness", resolutions);
        loadMap(METALLIC, basePath + "_metallic", resolutions);
        loadMap(AO, basePath + "_ao", resolutions);
    }

    /**
     * Load individual map with multi-resolution
     */
    void loadMap(MapType type, const std::string& basePath,
                 const std::vector<int>& resolutions = {2048, 1024, 512}) {
        if (type >= NUM_MAPS) return;

        mMaps[type].loadMultiRes(basePath, resolutions);
        mMapEnabled[type] = true;
    }

    /**
     * Load individual map (single resolution)
     */
    void loadMapSingle(MapType type, const std::string& url) {
        if (type >= NUM_MAPS) return;

        mMaps[type].load(url);
        mMapEnabled[type] = true;
    }

    /**
     * Bind all maps with LOD selection
     * @param baseUnit Starting texture unit (maps use units baseUnit to baseUnit+6)
     * @param distance Camera distance for LOD
     */
    void bind(int baseUnit, float distance) {
        for (int i = 0; i < NUM_MAPS; i++) {
            if (mMapEnabled[i] && mMaps[i].ready()) {
                mMaps[i].bind(baseUnit + i, distance);
            }
        }
    }

    /**
     * Bind specific map
     */
    void bindMap(MapType type, int unit, float distance) {
        if (type < NUM_MAPS && mMapEnabled[type] && mMaps[type].ready()) {
            mMaps[type].bind(unit, distance);
        }
    }

    /**
     * Unbind all maps
     */
    void unbindAll(int baseUnit) {
        for (int i = 0; i < NUM_MAPS; i++) {
            if (mMapEnabled[i]) {
                mMaps[i].unbind(baseUnit + i);
            }
        }
    }

    /**
     * Check if specific map exists and is enabled
     */
    bool hasMap(MapType type) const {
        return type < NUM_MAPS && mMapEnabled[type];
    }

    /**
     * Check if at least albedo is ready
     */
    bool ready() const {
        return mMapEnabled[ALBEDO] && mMaps[ALBEDO].ready();
    }

    /**
     * Check if all enabled maps are ready
     */
    bool allReady() const {
        for (int i = 0; i < NUM_MAPS; i++) {
            if (mMapEnabled[i] && !mMaps[i].ready()) {
                return false;
            }
        }
        return true;
    }

    /**
     * Set LOD distances for all maps
     */
    void setLODDistances(const std::vector<float>& distances) {
        for (int i = 0; i < NUM_MAPS; i++) {
            mMaps[i].setLODDistances(distances);
        }
    }

    /**
     * Set LOD bias for all maps
     */
    void setLODBias(float bias) {
        for (int i = 0; i < NUM_MAPS; i++) {
            mMaps[i].setLODBias(bias);
        }
    }

    /**
     * Get texture for specific map
     */
    WebTexture& getMap(MapType type) { return mMaps[type]; }
    const WebTexture& getMap(MapType type) const { return mMaps[type]; }

    /**
     * Get map suffix string
     */
    static const char* mapSuffix(MapType type) {
        static const char* suffixes[] = {
            "albedo", "normal", "roughness", "metallic", "ao", "emissive", "height"
        };
        return (type < NUM_MAPS) ? suffixes[type] : "";
    }

private:
    std::string mBasePath;
    std::array<WebTexture, NUM_MAPS> mMaps;
    std::array<bool, NUM_MAPS> mMapEnabled;
};


/**
 * Texture Cache - manages loaded textures to avoid duplicates
 */
class TextureCache {
public:
    static TextureCache& instance() {
        static TextureCache cache;
        return cache;
    }

    /**
     * Get or load a texture
     */
    WebTexture* get(const std::string& path,
                    const std::vector<int>& resolutions = {2048, 1024, 512}) {
        auto it = mTextures.find(path);
        if (it != mTextures.end()) {
            return it->second.get();
        }

        auto tex = std::make_unique<WebTexture>();
        if (resolutions.size() > 1) {
            tex->loadMultiRes(path, resolutions);
        } else {
            tex->load(path);
        }

        WebTexture* ptr = tex.get();
        mTextures[path] = std::move(tex);
        return ptr;
    }

    /**
     * Get or load a PBR texture set
     */
    PBRTextureSet* getPBR(const std::string& basePath,
                          const std::vector<int>& resolutions = {2048, 1024, 512}) {
        auto it = mPBRSets.find(basePath);
        if (it != mPBRSets.end()) {
            return it->second.get();
        }

        auto set = std::make_unique<PBRTextureSet>();
        set->load(basePath, resolutions);

        PBRTextureSet* ptr = set.get();
        mPBRSets[basePath] = std::move(set);
        return ptr;
    }

    /**
     * Preload textures for later use
     */
    void preload(const std::string& path,
                 const std::vector<int>& resolutions = {2048, 1024, 512}) {
        get(path, resolutions);
    }

    /**
     * Clear all cached textures
     */
    void clear() {
        mTextures.clear();
        mPBRSets.clear();
    }

    /**
     * Get approximate memory usage in bytes
     */
    size_t memoryUsage() const {
        // Rough estimate: resolution^2 * 4 bytes per level
        size_t total = 0;
        for (const auto& pair : mTextures) {
            const auto& tex = pair.second;
            for (int i = 0; i < tex->numLevels(); i++) {
                if (tex->levelReady(i)) {
                    int res = tex->currentResolution();
                    total += res * res * 4;
                }
            }
        }
        return total;
    }

private:
    TextureCache() = default;
    TextureCache(const TextureCache&) = delete;
    TextureCache& operator=(const TextureCache&) = delete;

    std::unordered_map<std::string, std::unique_ptr<WebTexture>> mTextures;
    std::unordered_map<std::string, std::unique_ptr<PBRTextureSet>> mPBRSets;
};

} // namespace al

#endif // AL_WEB_TEXTURE_HPP
