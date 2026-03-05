/**
 * AlloLib Studio Online - Audio-Visual Bridge (Phase 9)
 *
 * One-stop object combining ring buffer + FFT + feature extraction + beat
 * detection. Provides GPU-side buffers that particle/fluid systems can bind
 * directly (zero-copy), plus CPU-side convenience accessors for the tiny
 * 48-byte AudioFeatures struct.
 *
 * Usage:
 *   AudioVisualBridge bridge;
 *   bridge.create(*backend(), 1024, 44100);
 *
 *   void onSound(AudioIOData& io) {
 *       while (io()) bridge.pushAudio(&io.out(0), 1);
 *   }
 *   void onAnimate(double dt) {
 *       bridge.analyze();
 *       if (bridge.beatDetected()) { // burst particles }
 *       float bass = bridge.bassEnergy();
 *   }
 *   // Bind bridge.spectrumBuffer() to compute shaders for GPU-side access
 *
 * Header-only. Requires: al_WebGPUAudio.hpp, al_WebGPUFFT.hpp,
 *   al_WebGPUCompute.hpp, al_WebGPUBuffer.hpp
 */

#ifndef AL_WEB_AUDIO_VISUAL_BRIDGE_HPP
#define AL_WEB_AUDIO_VISUAL_BRIDGE_HPP

#include "al_WebGPUAudio.hpp"
#include "al_WebGPUFFT.hpp"
#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include <vector>
#include <cmath>
#include <cstring>
#include <cstdio>
#include <algorithm>

namespace al {

// ── GPU-Aligned Structs ─────────────────────────────────────────────────────

struct AudioFeatures {           // 48 bytes
    float rmsEnergy;
    float peakAmplitude;
    float spectralCentroid;      // weighted avg frequency (Hz)
    float spectralFlux;          // change from previous frame
    float bassEnergy;            // 20-250 Hz
    float midEnergy;             // 250-4000 Hz
    float trebleEnergy;          // 4000-20000 Hz
    float beatDetected;          // 1.0 if beat, 0.0 otherwise
    float beatEnergy;
    float beatThreshold;
    float tempo;                 // estimated BPM (0 if unknown)
    float _pad;
};
static_assert(sizeof(AudioFeatures) == 48, "AudioFeatures must be 48 bytes");

// ── Feature Extraction WGSL ─────────────────────────────────────────────────

// Single workgroup of 256 threads, parallel reduction over FFT bins
static const char* const kFeatureExtractionWGSL = R"(
struct Features {
    rmsEnergy: f32,
    peakAmplitude: f32,
    spectralCentroid: f32,
    spectralFlux: f32,
    bassEnergy: f32,
    midEnergy: f32,
    trebleEnergy: f32,
    beatDetected: f32,
    beatEnergy: f32,
    beatThreshold: f32,
    tempo: f32,
    _pad: f32,
}

struct Params {
    fftSize: u32,
    sampleRate: u32,
    _pad0: u32,
    _pad1: u32,
}

@group(0) @binding(0) var<storage, read> magnitudes: array<f32>;
@group(0) @binding(1) var<storage, read> prevMagnitudes: array<f32>;
@group(0) @binding(2) var<storage, read_write> features: Features;
@group(0) @binding(3) var<uniform> params: Params;

// Shared memory for parallel reduction
var<workgroup> shBass: array<f32, 256>;
var<workgroup> shMid: array<f32, 256>;
var<workgroup> shTreble: array<f32, 256>;
var<workgroup> shFlux: array<f32, 256>;
var<workgroup> shCentroidNum: array<f32, 256>;
var<workgroup> shCentroidDen: array<f32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) lid: vec3u) {
    let tid = lid.x;
    let numBins = params.fftSize / 2u + 1u;
    let binWidth = f32(params.sampleRate) / f32(params.fftSize);

    // Each thread accumulates over a stride
    var bass = 0.0f;
    var mid = 0.0f;
    var treble = 0.0f;
    var flux = 0.0f;
    var centNum = 0.0f;
    var centDen = 0.0f;

    var i = tid;
    while (i < numBins) {
        let mag = magnitudes[i];
        let prevMag = prevMagnitudes[i];
        let freq = f32(i) * binWidth;
        let magSq = mag * mag;

        // Band energy
        if (freq < 250.0) { bass += magSq; }
        else if (freq < 4000.0) { mid += magSq; }
        else if (freq < 20000.0) { treble += magSq; }

        // Spectral flux (half-wave rectified difference)
        let diff = mag - prevMag;
        if (diff > 0.0) { flux += diff; }

        // Spectral centroid
        centNum += freq * mag;
        centDen += mag;

        i += 256u;
    }

    shBass[tid] = bass;
    shMid[tid] = mid;
    shTreble[tid] = treble;
    shFlux[tid] = flux;
    shCentroidNum[tid] = centNum;
    shCentroidDen[tid] = centDen;

    workgroupBarrier();

    // Parallel reduction (8 steps for 256 threads)
    for (var stride = 128u; stride > 0u; stride >>= 1u) {
        if (tid < stride) {
            shBass[tid] += shBass[tid + stride];
            shMid[tid] += shMid[tid + stride];
            shTreble[tid] += shTreble[tid + stride];
            shFlux[tid] += shFlux[tid + stride];
            shCentroidNum[tid] += shCentroidNum[tid + stride];
            shCentroidDen[tid] += shCentroidDen[tid + stride];
        }
        workgroupBarrier();
    }

    // Thread 0 writes final result
    if (tid == 0u) {
        features.bassEnergy = sqrt(shBass[0]);
        features.midEnergy = sqrt(shMid[0]);
        features.trebleEnergy = sqrt(shTreble[0]);
        features.spectralFlux = shFlux[0];

        if (shCentroidDen[0] > 0.001) {
            features.spectralCentroid = shCentroidNum[0] / shCentroidDen[0];
        } else {
            features.spectralCentroid = 0.0;
        }
    }
}
)";

// ── AudioVisualBridge Class ─────────────────────────────────────────────────

class AudioVisualBridge {
    AudioRingBuffer mRing;
    GPUFFT mFFT;
    GPUBuffer<AudioFeatures> mFeaturesBuffer;
    GPUBuffer<float> mPrevMagnitudes;    // for spectral flux
    struct FeatureParams {
        uint32_t fftSize;
        uint32_t sampleRate;
        uint32_t _pad0;
        uint32_t _pad1;
    };
    GPUUniformBuffer<FeatureParams> mFeatureParamsBuffer;
    ComputeShader mFeatureShader;

    GraphicsBackend* mBackend = nullptr;
    int mFFTSize = 0;
    int mSampleRate = 0;

    // Beat detection state (CPU-side)
    float mBeatHistory[64] = {};
    int mBeatHistoryIdx = 0;
    float mBeatSensitivity = 1.5f;
    AudioFeatures mCurrent{};
    bool mCreated = false;

    // Readback buffer for magnitudes
    std::vector<float> mMagReadback;

public:
    AudioVisualBridge() = default;

    void create(GraphicsBackend& backend, int fftSize = 1024, int sampleRate = 44100) {
        if (mCreated) {
            destroy();
        }
        if (fftSize <= 0 || sampleRate <= 0) {
            printf("[AudioVisualBridge] Invalid params: fftSize=%d, sampleRate=%d\n", fftSize, sampleRate);
            return;
        }
        mBackend = &backend;
        mFFTSize = fftSize;
        mSampleRate = sampleRate;

        mRing.create(backend, fftSize, sampleRate);
        mFFT.create(backend, fftSize);

        // Features buffer: single AudioFeatures struct
        AudioFeatures zeroFeatures = {};
        mFeaturesBuffer.create(backend, 1, &zeroFeatures);

        // Previous magnitudes for spectral flux
        int numBins = fftSize / 2 + 1;
        std::vector<float> zeroMags(numBins, 0.0f);
        mPrevMagnitudes.create(backend, zeroMags);

        // Feature extraction params
        FeatureParams fp = {(uint32_t)fftSize, (uint32_t)sampleRate, 0, 0};
        mFeatureParamsBuffer.create(backend, &fp);

        mFeatureShader.create(backend, kFeatureExtractionWGSL);

        memset(mBeatHistory, 0, sizeof(mBeatHistory));
        mBeatHistoryIdx = 0;
        memset(&mCurrent, 0, sizeof(mCurrent));

        mMagReadback.resize(numBins, 0.0f);

        mCreated = true;
        printf("[AudioVisualBridge] Created: %d-point FFT, %d Hz sample rate\n", fftSize, sampleRate);
    }

    /// Push audio samples (call from onSound)
    void pushAudio(const float* samples, int count) {
        if (!mCreated || !samples || count <= 0) return;
        mRing.pushSamples(samples, count);
    }

    /// Run full analysis pipeline: upload → FFT → features → beat detection (call from onAnimate)
    void analyze() {
        if (!mCreated) return;

        // 1. Upload audio window to GPU
        mRing.uploadToGPU();

        // 2. Run FFT
        mFFT.compute(mRing);

        // 3. Feature extraction on GPU
        mFeatureShader.bind(0, mFFT.magnitudeBuffer());
        mFeatureShader.bind(1, mPrevMagnitudes.handle());
        mFeatureShader.bind(2, mFeaturesBuffer.handle());
        mFeatureShader.bindUniform(3, mFeatureParamsBuffer.handle());
        mFeatureShader.dispatch(1);  // Single workgroup of 256

        // 4. Readback the tiny 48-byte features struct
        mFeaturesBuffer.readback(&mCurrent, 1);

        // Fill in RMS/peak from ring buffer (computed on CPU during push)
        mCurrent.rmsEnergy = mRing.rmsEnergy();
        mCurrent.peakAmplitude = mRing.peakAmplitude();

        // 5. CPU-side beat detection
        float energy = mCurrent.bassEnergy + mCurrent.midEnergy * 0.5f;
        mBeatHistory[mBeatHistoryIdx] = energy;
        mBeatHistoryIdx = (mBeatHistoryIdx + 1) % 64;

        float avgEnergy = 0.0f;
        for (int i = 0; i < 64; i++) avgEnergy += mBeatHistory[i];
        avgEnergy /= 64.0f;

        mCurrent.beatEnergy = energy;
        mCurrent.beatThreshold = avgEnergy * mBeatSensitivity;
        mCurrent.beatDetected = (energy > mCurrent.beatThreshold && energy > 0.01f) ? 1.0f : 0.0f;
        mCurrent.tempo = 0.0f;  // BPM estimation deferred

        // 6. Re-upload features with beat info so GPU shaders can read it
        mFeaturesBuffer.upload(&mCurrent, 1);

        // 7. Copy current magnitudes → prev for next frame's flux
        // TODO: Replace with GPU-side buffer copy when backend supports copyBufferToBuffer()
        mFFT.readbackMagnitudes(mMagReadback);
        mPrevMagnitudes.upload(mMagReadback);
    }

    // ── GPU handles — bind directly to particle/fluid shaders ────────

    BufferHandle spectrumBuffer() const { return mFFT.magnitudeBuffer(); }
    BufferHandle featuresBuffer() const { return mFeaturesBuffer.handle(); }
    BufferHandle audioBuffer() const { return mRing.audioBufferHandle(); }

    // ── CPU convenience (from tiny 48-byte readback) ─────────────────

    float rmsEnergy() const { return mCurrent.rmsEnergy; }
    float peakAmplitude() const { return mCurrent.peakAmplitude; }
    float spectralCentroid() const { return mCurrent.spectralCentroid; }
    float spectralFlux() const { return mCurrent.spectralFlux; }
    float bassEnergy() const { return mCurrent.bassEnergy; }
    float midEnergy() const { return mCurrent.midEnergy; }
    float trebleEnergy() const { return mCurrent.trebleEnergy; }
    bool beatDetected() const { return mCurrent.beatDetected > 0.5f; }
    float beatEnergy() const { return mCurrent.beatEnergy; }

    void setBeatSensitivity(float multiplier) { mBeatSensitivity = multiplier; }
    float beatSensitivity() const { return mBeatSensitivity; }

    int fftSize() const { return mFFTSize; }
    int numBins() const { return mFFTSize / 2 + 1; }

    /// Readback spectrum magnitudes to CPU
    const std::vector<float>& readbackSpectrum() {
        mFFT.readbackMagnitudes(mMagReadback);
        return mMagReadback;
    }

    void destroy() {
        mRing.destroy();
        mFFT.destroy();
        mFeaturesBuffer.destroy();
        mPrevMagnitudes.destroy();
        mFeatureParamsBuffer.destroy();
        mFeatureShader.destroy();
        mCreated = false;
    }

    ~AudioVisualBridge() { destroy(); }

    // Non-copyable
    AudioVisualBridge(const AudioVisualBridge&) = delete;
    AudioVisualBridge& operator=(const AudioVisualBridge&) = delete;

    // Movable
    AudioVisualBridge(AudioVisualBridge&& other) noexcept
        : mRing(std::move(other.mRing)),
          mFFT(std::move(other.mFFT)),
          mFeaturesBuffer(std::move(other.mFeaturesBuffer)),
          mPrevMagnitudes(std::move(other.mPrevMagnitudes)),
          mFeatureParamsBuffer(std::move(other.mFeatureParamsBuffer)),
          mFeatureShader(std::move(other.mFeatureShader)),
          mBackend(other.mBackend),
          mFFTSize(other.mFFTSize),
          mSampleRate(other.mSampleRate),
          mBeatHistoryIdx(other.mBeatHistoryIdx),
          mBeatSensitivity(other.mBeatSensitivity),
          mCurrent(other.mCurrent),
          mCreated(other.mCreated),
          mMagReadback(std::move(other.mMagReadback)) {
        memcpy(mBeatHistory, other.mBeatHistory, sizeof(mBeatHistory));
        other.mCreated = false;
    }

    AudioVisualBridge& operator=(AudioVisualBridge&& other) noexcept {
        if (this != &other) {
            destroy();
            mRing = std::move(other.mRing);
            mFFT = std::move(other.mFFT);
            mFeaturesBuffer = std::move(other.mFeaturesBuffer);
            mPrevMagnitudes = std::move(other.mPrevMagnitudes);
            mFeatureParamsBuffer = std::move(other.mFeatureParamsBuffer);
            mFeatureShader = std::move(other.mFeatureShader);
            mBackend = other.mBackend;
            mFFTSize = other.mFFTSize;
            mSampleRate = other.mSampleRate;
            memcpy(mBeatHistory, other.mBeatHistory, sizeof(mBeatHistory));
            mBeatHistoryIdx = other.mBeatHistoryIdx;
            mBeatSensitivity = other.mBeatSensitivity;
            mCurrent = other.mCurrent;
            mCreated = other.mCreated;
            mMagReadback = std::move(other.mMagReadback);
            other.mCreated = false;
        }
        return *this;
    }
};

} // namespace al

#endif // AL_WEB_AUDIO_VISUAL_BRIDGE_HPP
