/**
 * Native Adaptive Quality System
 *
 * Native equivalent of al_WebQuality.hpp.
 * Automatically adjusts rendering quality based on performance.
 *
 * Usage is identical to WebQuality:
 *   QualityManager quality;
 *   quality.setTargetFPS(60);
 *   quality.setPreset(QualityPreset::High);
 *
 *   // In onAnimate
 *   quality.update(dt);
 */

#ifndef AL_NATIVE_QUALITY_HPP
#define AL_NATIVE_QUALITY_HPP

#include <cmath>
#include <string>
#include <functional>
#include <algorithm>

namespace al {

/**
 * Quality preset levels
 */
enum class QualityPreset {
    Auto,
    Low,
    Medium,
    High,
    Ultra
};

/**
 * Individual quality settings
 */
struct QualitySettings {
    // Resolution
    float resolutionScale = 1.0f;

    // Geometry
    float lodBias = 1.0f;
    int maxTrianglesPerFrame = 1000000;
    bool geometryInstancing = true;

    // Textures
    int textureQuality = 2;
    bool anisotropicFiltering = true;
    int maxTextureSize = 2048;

    // Lighting
    int maxLights = 8;
    bool shadowsEnabled = true;
    int shadowMapSize = 1024;
    bool softShadows = true;

    // Effects
    bool reflectionsEnabled = true;
    int reflectionQuality = 2;
    bool bloomEnabled = true;
    bool ambientOcclusion = true;
    int aoQuality = 1;

    // PBR
    int pbrQuality = 2;
    int irradianceSamples = 64;
    int specularSamples = 64;

    // Particles
    int maxParticles = 10000;
    bool particleSoftness = true;

    // Anti-aliasing
    int antiAliasing = 2;
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
     * Update with frame time
     */
    void update(double dt) {
        mFrameTimeAccum += dt;
        mFrameCount++;

        if (mFrameTimeAccum >= 0.5) {
            mCurrentFPS = mFrameCount / mFrameTimeAccum;
            mFrameTimeAccum = 0;
            mFrameCount = 0;

            for (int i = FPS_HISTORY_SIZE - 1; i > 0; i--) {
                mFPSHistory[i] = mFPSHistory[i-1];
            }
            mFPSHistory[0] = mCurrentFPS;

            if (mAdaptiveEnabled && mPreset == QualityPreset::Auto) {
                adaptQuality();
            }
        }
    }

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
                setPreset(QualityPreset::High);
                mPreset = QualityPreset::Auto;
                break;
        }

        if (mCallback) {
            mCallback(mSettings);
        }
    }

    void setTargetFPS(float fps) { mTargetFPS = fps; }
    float targetFPS() const { return mTargetFPS; }

    float currentFPS() const { return mCurrentFPS; }

    float averageFPS() const {
        float sum = 0;
        for (int i = 0; i < FPS_HISTORY_SIZE; i++) sum += mFPSHistory[i];
        return sum / FPS_HISTORY_SIZE;
    }

    void setAdaptive(bool enabled) { mAdaptiveEnabled = enabled; }
    bool isAdaptive() const { return mAdaptiveEnabled; }

    const QualitySettings& settings() const { return mSettings; }
    QualitySettings& settings() { return mSettings; }

    QualityPreset preset() const { return mPreset; }

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

    float estimatedGPULoad() const {
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

        if (fpsRatio < 0.85f) {
            mStabilityCounter--;
            if (mStabilityCounter < -3) {
                decreaseQuality();
                mStabilityCounter = 0;
            }
        } else if (fpsRatio > 1.1f) {
            mStabilityCounter++;
            if (mStabilityCounter > 5) {
                increaseQuality();
                mStabilityCounter = 0;
            }
        } else {
            mStabilityCounter = 0;
        }
    }

    void decreaseQuality() {
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

// Alias for web compatibility
using WebQuality = QualityManager;

} // namespace al

#endif // AL_NATIVE_QUALITY_HPP
