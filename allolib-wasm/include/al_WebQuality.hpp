/**
 * Web Adaptive Quality System
 *
 * Automatically adjusts rendering quality based on performance.
 * Similar to Unreal Engine's scalability system.
 *
 * Features:
 * - FPS monitoring and automatic quality adjustment
 * - Quality presets (Low/Medium/High/Ultra)
 * - Per-feature quality settings
 * - Resolution scaling
 * - Shader complexity levels
 *
 * Usage:
 *   QualityManager quality;
 *   quality.setTargetFPS(60);
 *   quality.setPreset(QualityPreset::High);
 *
 *   // In onAnimate
 *   quality.update(dt);
 *
 *   // In onDraw
 *   if (quality.shadowsEnabled()) { ... }
 *   lodMesh.bias(quality.lodBias());
 */

#ifndef AL_WEB_QUALITY_HPP
#define AL_WEB_QUALITY_HPP

#include <emscripten.h>
#include <cmath>
#include <string>
#include <functional>

namespace al {

/**
 * Quality preset levels
 */
enum class QualityPreset {
    Auto,       // Automatic adjustment based on FPS
    Low,        // Maximum performance
    Medium,     // Balanced
    High,       // High quality
    Ultra       // Maximum quality
};

/**
 * Individual quality settings
 */
struct QualitySettings {
    // Resolution
    float resolutionScale = 1.0f;       // 0.5 - 1.0 (render resolution multiplier)

    // Geometry
    float lodBias = 1.0f;               // LOD selection bias (higher = lower detail)
    int maxTrianglesPerFrame = 1000000; // Triangle budget
    bool geometryInstancing = true;     // Use instancing for repeated objects

    // Textures
    int textureQuality = 2;             // 0=Low, 1=Medium, 2=High (mipmap bias)
    bool anisotropicFiltering = true;   // Enable aniso filtering
    int maxTextureSize = 2048;          // Max texture dimension

    // Lighting
    int maxLights = 8;                  // Max simultaneous lights
    bool shadowsEnabled = true;         // Enable shadow mapping
    int shadowMapSize = 1024;           // Shadow map resolution
    bool softShadows = true;            // PCF soft shadows

    // Effects
    bool reflectionsEnabled = true;     // Environment reflections
    int reflectionQuality = 2;          // 0=Low, 1=Medium, 2=High
    bool bloomEnabled = true;           // Bloom post-process
    bool ambientOcclusion = true;       // SSAO
    int aoQuality = 1;                  // 0=Low, 1=Medium, 2=High

    // PBR
    int pbrQuality = 2;                 // 0=Simple, 1=Standard, 2=Full IBL
    int irradianceSamples = 64;         // Samples for diffuse IBL
    int specularSamples = 64;           // Samples for specular IBL

    // Particles
    int maxParticles = 10000;           // Particle budget
    bool particleSoftness = true;       // Soft particle edges

    // Anti-aliasing
    int antiAliasing = 2;               // 0=None, 1=FXAA, 2=MSAA 4x
};

/**
 * Adaptive Quality Manager
 */
class QualityManager {
public:
    using QualityChangeCallback = std::function<void(const QualitySettings&)>;

    QualityManager()
        : mPreset(QualityPreset::Auto)
        , mTargetFPS(60.0f)
        , mCurrentFPS(60.0f)
        , mFrameTimeAccum(0.0)
        , mFrameCount(0)
        , mAdaptiveEnabled(true)
        , mStabilityCounter(0)
    {
        setPreset(QualityPreset::High);
    }

    /**
     * Update with frame time (call every frame)
     */
    void update(double dt) {
        // Accumulate frame times
        mFrameTimeAccum += dt;
        mFrameCount++;

        // Update FPS every 0.5 seconds
        if (mFrameTimeAccum >= 0.5) {
            mCurrentFPS = mFrameCount / mFrameTimeAccum;
            mFrameTimeAccum = 0;
            mFrameCount = 0;

            // Record FPS history
            for (int i = FPS_HISTORY_SIZE - 1; i > 0; i--) {
                mFPSHistory[i] = mFPSHistory[i-1];
            }
            mFPSHistory[0] = mCurrentFPS;

            // Adaptive quality adjustment
            if (mAdaptiveEnabled && mPreset == QualityPreset::Auto) {
                adaptQuality();
            }
        }
    }

    /**
     * Set quality preset
     */
    void setPreset(QualityPreset preset) {
        mPreset = preset;

        switch (preset) {
            case QualityPreset::Low:
                mSettings.resolutionScale = 0.5f;
                mSettings.lodBias = 2.0f;
                mSettings.maxTrianglesPerFrame = 100000;
                mSettings.textureQuality = 0;
                mSettings.anisotropicFiltering = false;
                mSettings.maxTextureSize = 512;
                mSettings.maxLights = 2;
                mSettings.shadowsEnabled = false;
                mSettings.shadowMapSize = 256;
                mSettings.softShadows = false;
                mSettings.reflectionsEnabled = false;
                mSettings.reflectionQuality = 0;
                mSettings.bloomEnabled = false;
                mSettings.ambientOcclusion = false;
                mSettings.aoQuality = 0;
                mSettings.pbrQuality = 0;
                mSettings.irradianceSamples = 16;
                mSettings.specularSamples = 16;
                mSettings.maxParticles = 1000;
                mSettings.particleSoftness = false;
                mSettings.antiAliasing = 0;
                break;

            case QualityPreset::Medium:
                mSettings.resolutionScale = 0.75f;
                mSettings.lodBias = 1.5f;
                mSettings.maxTrianglesPerFrame = 300000;
                mSettings.textureQuality = 1;
                mSettings.anisotropicFiltering = true;
                mSettings.maxTextureSize = 1024;
                mSettings.maxLights = 4;
                mSettings.shadowsEnabled = true;
                mSettings.shadowMapSize = 512;
                mSettings.softShadows = false;
                mSettings.reflectionsEnabled = true;
                mSettings.reflectionQuality = 1;
                mSettings.bloomEnabled = true;
                mSettings.ambientOcclusion = false;
                mSettings.aoQuality = 0;
                mSettings.pbrQuality = 1;
                mSettings.irradianceSamples = 32;
                mSettings.specularSamples = 32;
                mSettings.maxParticles = 5000;
                mSettings.particleSoftness = true;
                mSettings.antiAliasing = 1;
                break;

            case QualityPreset::High:
                mSettings.resolutionScale = 1.0f;
                mSettings.lodBias = 1.0f;
                mSettings.maxTrianglesPerFrame = 500000;
                mSettings.textureQuality = 2;
                mSettings.anisotropicFiltering = true;
                mSettings.maxTextureSize = 2048;
                mSettings.maxLights = 8;
                mSettings.shadowsEnabled = true;
                mSettings.shadowMapSize = 1024;
                mSettings.softShadows = true;
                mSettings.reflectionsEnabled = true;
                mSettings.reflectionQuality = 2;
                mSettings.bloomEnabled = true;
                mSettings.ambientOcclusion = true;
                mSettings.aoQuality = 1;
                mSettings.pbrQuality = 2;
                mSettings.irradianceSamples = 64;
                mSettings.specularSamples = 64;
                mSettings.maxParticles = 10000;
                mSettings.particleSoftness = true;
                mSettings.antiAliasing = 2;
                break;

            case QualityPreset::Ultra:
                mSettings.resolutionScale = 1.0f;
                mSettings.lodBias = 0.75f;
                mSettings.maxTrianglesPerFrame = 1000000;
                mSettings.textureQuality = 2;
                mSettings.anisotropicFiltering = true;
                mSettings.maxTextureSize = 4096;
                mSettings.maxLights = 16;
                mSettings.shadowsEnabled = true;
                mSettings.shadowMapSize = 2048;
                mSettings.softShadows = true;
                mSettings.reflectionsEnabled = true;
                mSettings.reflectionQuality = 2;
                mSettings.bloomEnabled = true;
                mSettings.ambientOcclusion = true;
                mSettings.aoQuality = 2;
                mSettings.pbrQuality = 2;
                mSettings.irradianceSamples = 128;
                mSettings.specularSamples = 128;
                mSettings.maxParticles = 50000;
                mSettings.particleSoftness = true;
                mSettings.antiAliasing = 2;
                break;

            case QualityPreset::Auto:
                // Start at High, will adapt
                setPreset(QualityPreset::High);
                mPreset = QualityPreset::Auto;
                break;
        }

        if (mCallback) {
            mCallback(mSettings);
        }
    }

    /**
     * Set target FPS for auto mode
     */
    void setTargetFPS(float fps) { mTargetFPS = fps; }
    float targetFPS() const { return mTargetFPS; }

    /**
     * Get current FPS
     */
    float currentFPS() const { return mCurrentFPS; }

    /**
     * Get average FPS over history
     */
    float averageFPS() const {
        float sum = 0;
        for (int i = 0; i < FPS_HISTORY_SIZE; i++) sum += mFPSHistory[i];
        return sum / FPS_HISTORY_SIZE;
    }

    /**
     * Enable/disable adaptive quality
     */
    void setAdaptive(bool enabled) { mAdaptiveEnabled = enabled; }
    bool isAdaptive() const { return mAdaptiveEnabled; }

    /**
     * Get current settings
     */
    const QualitySettings& settings() const { return mSettings; }
    QualitySettings& settings() { return mSettings; }

    /**
     * Get current preset
     */
    QualityPreset preset() const { return mPreset; }

    /**
     * Set callback for quality changes
     */
    void setCallback(QualityChangeCallback cb) { mCallback = cb; }

    // Convenience accessors
    float resolutionScale() const { return mSettings.resolutionScale; }
    float lodBias() const { return mSettings.lodBias; }
    bool shadowsEnabled() const { return mSettings.shadowsEnabled; }
    bool reflectionsEnabled() const { return mSettings.reflectionsEnabled; }
    bool bloomEnabled() const { return mSettings.bloomEnabled; }
    bool ambientOcclusion() const { return mSettings.ambientOcclusion; }
    int maxLights() const { return mSettings.maxLights; }
    int pbrQuality() const { return mSettings.pbrQuality; }
    int maxParticles() const { return mSettings.maxParticles; }

    /**
     * Get preset name as string
     */
    static const char* presetName(QualityPreset p) {
        switch (p) {
            case QualityPreset::Auto: return "Auto";
            case QualityPreset::Low: return "Low";
            case QualityPreset::Medium: return "Medium";
            case QualityPreset::High: return "High";
            case QualityPreset::Ultra: return "Ultra";
        }
        return "Unknown";
    }

    /**
     * Get estimated GPU load (0-1)
     */
    float estimatedGPULoad() const {
        // Rough estimate based on settings
        float load = 0;
        load += mSettings.resolutionScale * 0.3f;
        load += (1.0f / mSettings.lodBias) * 0.2f;
        load += mSettings.shadowsEnabled ? 0.15f : 0;
        load += mSettings.reflectionsEnabled ? 0.1f : 0;
        load += mSettings.ambientOcclusion ? 0.1f : 0;
        load += mSettings.bloomEnabled ? 0.05f : 0;
        load += (mSettings.pbrQuality / 2.0f) * 0.1f;
        return std::min(1.0f, load);
    }

private:
    static const int FPS_HISTORY_SIZE = 10;

    void adaptQuality() {
        float avgFPS = averageFPS();
        float fpsRatio = avgFPS / mTargetFPS;

        // Only adjust if FPS is consistently off target
        if (fpsRatio < 0.85f) {
            // FPS too low, decrease quality
            mStabilityCounter--;
            if (mStabilityCounter < -3) {
                decreaseQuality();
                mStabilityCounter = 0;
            }
        } else if (fpsRatio > 1.1f) {
            // FPS higher than needed, can increase quality
            mStabilityCounter++;
            if (mStabilityCounter > 5) {
                increaseQuality();
                mStabilityCounter = 0;
            }
        } else {
            // FPS is good, reset counter
            mStabilityCounter = 0;
        }
    }

    void decreaseQuality() {
        // Decrease quality in priority order
        if (mSettings.ambientOcclusion) {
            mSettings.ambientOcclusion = false;
            printf("[Quality] Disabled AO (FPS: %.1f)\n", mCurrentFPS);
        } else if (mSettings.softShadows) {
            mSettings.softShadows = false;
            printf("[Quality] Disabled soft shadows (FPS: %.1f)\n", mCurrentFPS);
        } else if (mSettings.bloomEnabled) {
            mSettings.bloomEnabled = false;
            printf("[Quality] Disabled bloom (FPS: %.1f)\n", mCurrentFPS);
        } else if (mSettings.reflectionQuality > 0) {
            mSettings.reflectionQuality--;
            printf("[Quality] Reduced reflection quality (FPS: %.1f)\n", mCurrentFPS);
        } else if (mSettings.shadowMapSize > 256) {
            mSettings.shadowMapSize /= 2;
            printf("[Quality] Reduced shadow resolution (FPS: %.1f)\n", mCurrentFPS);
        } else if (mSettings.lodBias < 3.0f) {
            mSettings.lodBias += 0.5f;
            printf("[Quality] Increased LOD bias (FPS: %.1f)\n", mCurrentFPS);
        } else if (mSettings.resolutionScale > 0.5f) {
            mSettings.resolutionScale -= 0.1f;
            printf("[Quality] Reduced resolution scale (FPS: %.1f)\n", mCurrentFPS);
        } else if (mSettings.shadowsEnabled) {
            mSettings.shadowsEnabled = false;
            printf("[Quality] Disabled shadows (FPS: %.1f)\n", mCurrentFPS);
        }

        if (mCallback) mCallback(mSettings);
    }

    void increaseQuality() {
        // Increase quality in reverse priority order
        if (!mSettings.shadowsEnabled) {
            mSettings.shadowsEnabled = true;
            printf("[Quality] Enabled shadows (FPS: %.1f)\n", mCurrentFPS);
        } else if (mSettings.resolutionScale < 1.0f) {
            mSettings.resolutionScale = std::min(1.0f, mSettings.resolutionScale + 0.1f);
            printf("[Quality] Increased resolution scale (FPS: %.1f)\n", mCurrentFPS);
        } else if (mSettings.lodBias > 1.0f) {
            mSettings.lodBias = std::max(1.0f, mSettings.lodBias - 0.5f);
            printf("[Quality] Decreased LOD bias (FPS: %.1f)\n", mCurrentFPS);
        } else if (mSettings.shadowMapSize < 1024) {
            mSettings.shadowMapSize *= 2;
            printf("[Quality] Increased shadow resolution (FPS: %.1f)\n", mCurrentFPS);
        } else if (mSettings.reflectionQuality < 2) {
            mSettings.reflectionQuality++;
            printf("[Quality] Increased reflection quality (FPS: %.1f)\n", mCurrentFPS);
        } else if (!mSettings.bloomEnabled) {
            mSettings.bloomEnabled = true;
            printf("[Quality] Enabled bloom (FPS: %.1f)\n", mCurrentFPS);
        } else if (!mSettings.softShadows) {
            mSettings.softShadows = true;
            printf("[Quality] Enabled soft shadows (FPS: %.1f)\n", mCurrentFPS);
        } else if (!mSettings.ambientOcclusion) {
            mSettings.ambientOcclusion = true;
            printf("[Quality] Enabled AO (FPS: %.1f)\n", mCurrentFPS);
        }

        if (mCallback) mCallback(mSettings);
    }

    QualityPreset mPreset;
    QualitySettings mSettings;
    float mTargetFPS;
    float mCurrentFPS;
    float mFPSHistory[FPS_HISTORY_SIZE] = {60, 60, 60, 60, 60, 60, 60, 60, 60, 60};
    double mFrameTimeAccum;
    int mFrameCount;
    bool mAdaptiveEnabled;
    int mStabilityCounter;
    QualityChangeCallback mCallback;
};

/**
 * JavaScript bridge for quality settings
 * Allows the Vue frontend to control quality
 */
inline void registerQualityJS(QualityManager& quality) {
    // Export to JavaScript
    EM_ASM({
        window.allolib = window.allolib || {};
        window.allolib.quality = {
            setPreset: function(preset) {
                Module.ccall('al_quality_set_preset', null, ['number'], [preset]);
            },
            getPreset: function() {
                return Module.ccall('al_quality_get_preset', 'number', [], []);
            },
            getFPS: function() {
                return Module.ccall('al_quality_get_fps', 'number', [], []);
            },
            getSettings: function() {
                return JSON.parse(Module.ccall('al_quality_get_settings', 'string', [], []));
            }
        };
    });
}

} // namespace al

#endif // AL_WEB_QUALITY_HPP
