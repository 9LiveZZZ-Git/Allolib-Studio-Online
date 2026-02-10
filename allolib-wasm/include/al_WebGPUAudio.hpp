/**
 * AlloLib Studio Online - GPU Audio Ring Buffer (Phase 9)
 *
 * Accumulates audio samples from onSound() on CPU, uploads a window to GPU
 * each frame for compute shader analysis (FFT, feature extraction, etc.).
 *
 * Usage:
 *   AudioRingBuffer ring;
 *   ring.create(*backend(), 2048, 44100);
 *
 *   void onSound(AudioIOData& io) {
 *       while (io()) ring.pushSample(io.out(0));
 *   }
 *   void onAnimate(double dt) {
 *       ring.uploadToGPU();
 *       // ring.audioBufferHandle() → bind to compute shaders
 *   }
 *
 * Header-only. Requires: al_WebGPUBuffer.hpp
 */

#ifndef AL_WEBGPU_AUDIO_HPP
#define AL_WEBGPU_AUDIO_HPP

#include "al_WebGPUBuffer.hpp"
#include <vector>
#include <cmath>
#include <cstring>
#include <algorithm>

namespace al {

// ── GPU-Aligned Structs ─────────────────────────────────────────────────────

struct AudioBufferParams {       // 16 bytes, uniform-compatible
    uint32_t windowSize;         // e.g. 2048
    uint32_t sampleRate;         // e.g. 44100
    float    rmsEnergy;          // computed during push
    float    peakAmplitude;      // max |sample| in window
};
static_assert(sizeof(AudioBufferParams) == 16, "AudioBufferParams must be 16 bytes");

// ── AudioRingBuffer Class ───────────────────────────────────────────────────

class AudioRingBuffer {
    std::vector<float> mRing;           // capacity = windowSize * 4
    int mWritePos = 0;
    int mWindowSize = 0;
    int mSampleRate = 44100;
    std::vector<float> mUploadWindow;   // extracted window for upload
    GPUBuffer<float> mGPUBuffer;
    GPUUniformBuffer<AudioBufferParams> mParamsBuffer;
    AudioBufferParams mParams;
    bool mDirty = false;
    bool mCreated = false;

    // Running stats
    float mRunningSum = 0.0f;
    float mRunningSumSq = 0.0f;
    float mPeak = 0.0f;
    int mSamplesAccumulated = 0;

public:
    AudioRingBuffer() = default;

    void create(GraphicsBackend& backend, int windowSize = 2048, int sampleRate = 44100) {
        mWindowSize = windowSize;
        mSampleRate = sampleRate;
        mRing.resize(windowSize * 4, 0.0f);
        mUploadWindow.resize(windowSize, 0.0f);
        mWritePos = 0;

        mGPUBuffer.create(backend, windowSize);
        mParamsBuffer.create(backend);

        mParams.windowSize = (uint32_t)windowSize;
        mParams.sampleRate = (uint32_t)sampleRate;
        mParams.rmsEnergy = 0.0f;
        mParams.peakAmplitude = 0.0f;
        mParamsBuffer.upload(mParams);

        mCreated = true;
    }

    /// Push a block of audio samples (call from onSound)
    void pushSamples(const float* samples, int count) {
        int ringSize = (int)mRing.size();
        for (int i = 0; i < count; i++) {
            float s = samples[i];
            mRing[mWritePos] = s;
            mWritePos = (mWritePos + 1) % ringSize;

            mRunningSumSq += s * s;
            float absS = std::fabs(s);
            if (absS > mPeak) mPeak = absS;
            mSamplesAccumulated++;
        }
        mDirty = true;
    }

    /// Convenience: push a single sample
    void pushSample(float sample) {
        pushSamples(&sample, 1);
    }

    /// Upload the latest window to GPU (call from onAnimate)
    void uploadToGPU() {
        if (!mCreated || !mDirty) return;
        mDirty = false;

        // Extract last windowSize samples from ring (wrap-safe)
        int ringSize = (int)mRing.size();
        int readPos = (mWritePos - mWindowSize + ringSize) % ringSize;
        for (int i = 0; i < mWindowSize; i++) {
            mUploadWindow[i] = mRing[(readPos + i) % ringSize];
        }

        mGPUBuffer.upload(mUploadWindow);

        // Compute RMS from accumulated samples
        if (mSamplesAccumulated > 0) {
            mParams.rmsEnergy = std::sqrt(mRunningSumSq / (float)mSamplesAccumulated);
            mParams.peakAmplitude = mPeak;
        }
        mParams.windowSize = (uint32_t)mWindowSize;
        mParams.sampleRate = (uint32_t)mSampleRate;
        mParamsBuffer.upload(mParams);

        // Reset running stats for next frame
        mRunningSumSq = 0.0f;
        mPeak = 0.0f;
        mSamplesAccumulated = 0;
    }

    BufferHandle audioBufferHandle() const { return mGPUBuffer.handle(); }
    BufferHandle paramsHandle() const { return mParamsBuffer.handle(); }
    int windowSize() const { return mWindowSize; }
    int sampleRate() const { return mSampleRate; }
    float rmsEnergy() const { return mParams.rmsEnergy; }
    float peakAmplitude() const { return mParams.peakAmplitude; }

    void destroy() {
        mGPUBuffer.destroy();
        mParamsBuffer.destroy();
        mCreated = false;
    }

    ~AudioRingBuffer() { destroy(); }

    // Non-copyable
    AudioRingBuffer(const AudioRingBuffer&) = delete;
    AudioRingBuffer& operator=(const AudioRingBuffer&) = delete;

    // Movable
    AudioRingBuffer(AudioRingBuffer&& other) noexcept
        : mRing(std::move(other.mRing)),
          mWritePos(other.mWritePos),
          mWindowSize(other.mWindowSize),
          mSampleRate(other.mSampleRate),
          mUploadWindow(std::move(other.mUploadWindow)),
          mGPUBuffer(std::move(other.mGPUBuffer)),
          mParamsBuffer(std::move(other.mParamsBuffer)),
          mParams(other.mParams),
          mDirty(other.mDirty),
          mCreated(other.mCreated) {
        other.mCreated = false;
    }

    AudioRingBuffer& operator=(AudioRingBuffer&& other) noexcept {
        if (this != &other) {
            destroy();
            mRing = std::move(other.mRing);
            mWritePos = other.mWritePos;
            mWindowSize = other.mWindowSize;
            mSampleRate = other.mSampleRate;
            mUploadWindow = std::move(other.mUploadWindow);
            mGPUBuffer = std::move(other.mGPUBuffer);
            mParamsBuffer = std::move(other.mParamsBuffer);
            mParams = other.mParams;
            mDirty = other.mDirty;
            mCreated = other.mCreated;
            other.mCreated = false;
        }
        return *this;
    }
};

} // namespace al

#endif // AL_WEBGPU_AUDIO_HPP
