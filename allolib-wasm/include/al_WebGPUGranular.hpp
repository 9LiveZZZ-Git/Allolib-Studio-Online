/**
 * AlloLib Studio Online - GPU Granular Synthesis (Phase 9)
 *
 * 10,000+ grain granular synthesis on the GPU. Grains are spawned, advanced,
 * and mixed entirely on the GPU. Output is read back to CPU for onSound().
 *
 * Uses fixed-point atomics for mixing (WGSL has no atomicAdd for f32).
 * Double-buffered readback: 1-frame latency (~16.7ms), acceptable for
 * granular texture.
 *
 * Usage:
 *   GranularSynth granular;
 *   granular.create(*backend(), 10000, 2048);
 *   granular.setSourceAudio(samples, count);
 *
 *   void onAnimate(double dt) { granular.update(dt); }
 *   void onSound(AudioIOData& io) {
 *       float bufL[2048], bufR[2048];
 *       int n = granular.fillAudioBuffer(bufL, bufR, io.framesPerBuffer());
 *       for (int i = 0; i < n; i++) { io.out(0, i) += bufL[i]; io.out(1, i) += bufR[i]; }
 *   }
 *
 * Header-only. Requires: al_WebGPUCompute.hpp, al_WebGPUBuffer.hpp
 */

#ifndef AL_WEBGPU_GRANULAR_HPP
#define AL_WEBGPU_GRANULAR_HPP

#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include <vector>
#include <cmath>
#include <cstring>
#include <cstdio>
#include <algorithm>
#include <mutex>

namespace al {

// ── GPU-Aligned Structs ─────────────────────────────────────────────────────

struct GPUGrain {                // 32 bytes
    float sourcePos;             // position in source buffer (samples, fractional)
    float playbackRate;
    float phase;                 // [0,1], grain dies at >= 1
    float duration;              // seconds
    float amplitude;
    float pan;                   // [-1, 1]
    uint32_t active;             // 1=alive, 0=dead
    float _pad;
};
static_assert(sizeof(GPUGrain) == 32, "GPUGrain must be 32 bytes");

struct GranularParams {          // 32 bytes
    uint32_t grainCount;
    uint32_t sourceLength;
    uint32_t outputFrames;       // e.g. 2048
    float    sampleRate;
    float    deltaTime;
    float    time;
    float    _pad[2];
};
static_assert(sizeof(GranularParams) == 32, "GranularParams must be 32 bytes");

struct GrainEmitParams {         // 48 bytes
    float sourcePosMin, sourcePosMax;
    float durationMin, durationMax;
    float rateMin, rateMax;
    float amplitudeMin, amplitudeMax;
    float panMin, panMax;
    uint32_t emitCount;
    float time;
};
static_assert(sizeof(GrainEmitParams) == 48, "GrainEmitParams must be 48 bytes");

// ── WGSL Shader Sources ─────────────────────────────────────────────────────

// Clear the i32 output buffer to zero
static const char* kGranularClearWGSL = R"(
struct Params {
    grainCount: u32,
    sourceLength: u32,
    outputFrames: u32,
    sampleRate: f32,
    deltaTime: f32,
    time: f32,
    _pad0: f32,
    _pad1: f32,
}

@group(0) @binding(0) var<storage, read_write> output: array<atomic<i32>>;
@group(0) @binding(1) var<uniform> params: Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i = gid.x;
    // Stereo output: outputFrames * 2
    if (i >= params.outputFrames * 2u) { return; }
    atomicStore(&output[i], 0);
}
)";

// Emit new grains into dead slots
static const char* kGranularEmitWGSL = R"(
struct Grain {
    sourcePos: f32,
    playbackRate: f32,
    phase: f32,
    duration: f32,
    amplitude: f32,
    pan: f32,
    active: u32,
    _pad: f32,
}

struct EmitParams {
    sourcePosMin: f32, sourcePosMax: f32,
    durationMin: f32, durationMax: f32,
    rateMin: f32, rateMax: f32,
    amplitudeMin: f32, amplitudeMax: f32,
    panMin: f32, panMax: f32,
    emitCount: u32,
    time: f32,
}

struct Counter {
    count: atomic<u32>,
}

@group(0) @binding(0) var<storage, read_write> grains: array<Grain>;
@group(0) @binding(1) var<uniform> emitParams: EmitParams;
@group(0) @binding(2) var<storage, read_write> counter: Counter;

fn hash(n: u32) -> f32 {
    var x = n;
    x = ((x >> 16u) ^ x) * 0x45d9f3bu;
    x = ((x >> 16u) ^ x) * 0x45d9f3bu;
    x = (x >> 16u) ^ x;
    return f32(x) / f32(0xffffffffu);
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i = gid.x;
    if (i >= arrayLength(&grains)) { return; }

    var g = grains[i];
    if (g.active == 1u) { return; }  // Skip living grains

    let emitted = atomicAdd(&counter.count, 1u);
    if (emitted >= emitParams.emitCount) { return; }

    let seed = i * 7u + u32(emitParams.time * 1000.0);

    g.sourcePos = mix(emitParams.sourcePosMin, emitParams.sourcePosMax, hash(seed));
    g.playbackRate = mix(emitParams.rateMin, emitParams.rateMax, hash(seed + 1u));
    g.duration = mix(emitParams.durationMin, emitParams.durationMax, hash(seed + 2u));
    g.amplitude = mix(emitParams.amplitudeMin, emitParams.amplitudeMax, hash(seed + 3u));
    g.pan = mix(emitParams.panMin, emitParams.panMax, hash(seed + 4u));
    g.phase = 0.0;
    g.active = 1u;

    grains[i] = g;
}
)";

// Advance grains and mix into output buffer using fixed-point atomics
static const char* kGranularAdvanceWGSL = R"(
struct Grain {
    sourcePos: f32,
    playbackRate: f32,
    phase: f32,
    duration: f32,
    amplitude: f32,
    pan: f32,
    active: u32,
    _pad: f32,
}

struct Params {
    grainCount: u32,
    sourceLength: u32,
    outputFrames: u32,
    sampleRate: f32,
    deltaTime: f32,
    time: f32,
    _pad0: f32,
    _pad1: f32,
}

@group(0) @binding(0) var<storage, read_write> grains: array<Grain>;
@group(0) @binding(1) var<storage, read> source: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<atomic<i32>>;
@group(0) @binding(3) var<uniform> params: Params;

const PI: f32 = 3.14159265358979323846;
const FIXED_SCALE: f32 = 65536.0;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i = gid.x;
    if (i >= params.grainCount) { return; }

    var g = grains[i];
    if (g.active == 0u) { return; }

    // Hanning envelope based on phase
    let envelope = 0.5 * (1.0 - cos(2.0 * PI * g.phase));

    // How many output frames this grain contributes to
    let grainSamplesPerFrame = params.sampleRate * g.duration;
    let phaseIncrement = 1.0 / grainSamplesPerFrame;

    // Write samples for this grain into the output buffer
    let framesToWrite = min(params.outputFrames, u32(grainSamplesPerFrame * (1.0 - g.phase) + 1.0));

    for (var f = 0u; f < framesToWrite; f++) {
        let currentPhase = g.phase + f32(f) * phaseIncrement;
        if (currentPhase >= 1.0) { break; }

        // Hanning at current phase
        let env = f32(0.5 * (1.0 - cos(2.0 * PI * currentPhase)));

        // Source position with linear interpolation
        let srcPos = g.sourcePos + f32(f) * g.playbackRate;
        let srcIdx = u32(srcPos) % params.sourceLength;
        let srcNext = (srcIdx + 1u) % params.sourceLength;
        let frac = srcPos - floor(srcPos);
        let sample = source[srcIdx] * (1.0 - frac) + source[srcNext] * frac;

        let value = sample * env * g.amplitude;

        // Stereo panning (equal-power approximation)
        let leftGain = (1.0 - g.pan) * 0.5 + 0.5;
        let rightGain = (1.0 + g.pan) * 0.5 + 0.5;

        // Convert to fixed-point and atomically add
        let leftFixed = i32(value * leftGain * FIXED_SCALE);
        let rightFixed = i32(value * rightGain * FIXED_SCALE);

        atomicAdd(&output[f * 2u], leftFixed);
        atomicAdd(&output[f * 2u + 1u], rightFixed);
    }

    // Advance grain phase
    g.phase += f32(params.outputFrames) * phaseIncrement;
    if (g.phase >= 1.0) {
        g.active = 0u;
    }

    grains[i] = g;
}
)";

// Convert fixed-point i32 output to float
static const char* kGranularConvertWGSL = R"(
struct Params {
    grainCount: u32,
    sourceLength: u32,
    outputFrames: u32,
    sampleRate: f32,
    deltaTime: f32,
    time: f32,
    _pad0: f32,
    _pad1: f32,
}

@group(0) @binding(0) var<storage, read> intOutput: array<i32>;
@group(0) @binding(1) var<storage, read_write> floatOutput: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i = gid.x;
    if (i >= params.outputFrames * 2u) { return; }
    floatOutput[i] = f32(intOutput[i]) / 65536.0;
}
)";

// ── GranularSynth Class ─────────────────────────────────────────────────────

class GranularSynth {
    GPUBuffer<GPUGrain> mGrains;
    GPUBuffer<float> mSource;            // mono source audio
    GPUBuffer<int32_t> mOutputFixed;     // fixed-point stereo output (atomic)
    GPUBuffer<float> mOutputFloat;       // converted float output
    GPUBuffer<uint32_t> mCounter;        // atomic emit counter
    GPUUniformBuffer<GranularParams> mParams;
    GPUUniformBuffer<GrainEmitParams> mEmitParams;
    ComputeShader mClearShader;
    ComputeShader mEmitShader;
    ComputeShader mAdvanceShader;
    ComputeShader mConvertShader;

    // Double-buffered readback
    std::vector<float> mReadbackA, mReadbackB;
    int mReadbackCurrent = 0;  // 0 = read A, write B; 1 = read B, write A
    int mPlaybackPos = 0;
    std::mutex mReadbackMutex;

    int mMaxGrains = 0;
    int mOutputFrames = 0;
    float mSampleRate = 44100.0f;
    float mTime = 0.0f;
    bool mCreated = false;

    GrainEmitParams mCurrentEmitParams;

public:
    GranularSynth() = default;

    void create(GraphicsBackend& backend, int maxGrains = 10000, int outputFrames = 2048) {
        mMaxGrains = maxGrains;
        mOutputFrames = outputFrames;

        // Initialize all grains as dead
        std::vector<GPUGrain> initGrains(maxGrains);
        for (auto& g : initGrains) {
            g = {};
            g.active = 0;
        }
        mGrains.create(backend, initGrains);

        // Source starts empty (user must call setSourceAudio)
        std::vector<float> silence(44100, 0.0f);  // 1 second of silence
        mSource.create(backend, silence);

        // Output buffers: stereo (frames * 2)
        mOutputFixed.create(backend, outputFrames * 2);
        mOutputFloat.create(backend, outputFrames * 2);

        // Atomic counter
        std::vector<uint32_t> zero(1, 0);
        mCounter.create(backend, zero);

        mParams.create(backend);
        mEmitParams.create(backend);

        mClearShader.create(backend, kGranularClearWGSL);
        mEmitShader.create(backend, kGranularEmitWGSL);
        mAdvanceShader.create(backend, kGranularAdvanceWGSL);
        mConvertShader.create(backend, kGranularConvertWGSL);

        mReadbackA.resize(outputFrames * 2, 0.0f);
        mReadbackB.resize(outputFrames * 2, 0.0f);
        mPlaybackPos = 0;

        // Default emit params
        mCurrentEmitParams.sourcePosMin = 0.0f;
        mCurrentEmitParams.sourcePosMax = 44100.0f;
        mCurrentEmitParams.durationMin = 0.02f;
        mCurrentEmitParams.durationMax = 0.08f;
        mCurrentEmitParams.rateMin = 0.8f;
        mCurrentEmitParams.rateMax = 1.2f;
        mCurrentEmitParams.amplitudeMin = 0.1f;
        mCurrentEmitParams.amplitudeMax = 0.3f;
        mCurrentEmitParams.panMin = -0.8f;
        mCurrentEmitParams.panMax = 0.8f;
        mCurrentEmitParams.emitCount = 0;
        mCurrentEmitParams.time = 0.0f;

        mCreated = true;
        printf("[GranularSynth] Created with %d max grains, %d output frames\n", maxGrains, outputFrames);
    }

    /// Upload source audio to GPU (mono, call once or when source changes)
    void setSourceAudio(const float* samples, int count) {
        if (!mCreated || !samples || count <= 0) return;
        const int n = std::min(count, static_cast<int>(mSource.count()));
        if (n <= 0) return;
        mSource.upload(samples, n);
    }

    /// Set grain emission parameters
    void setEmitParams(const GrainEmitParams& p) {
        mCurrentEmitParams = p;
    }

    /// GPU update: clear output, emit new grains, advance+mix, convert (call from onAnimate)
    void update(double dt, int emitCount = 100) {
        if (!mCreated) return;

        float fdt = (float)std::min(dt, 0.033);
        mTime += fdt;

        GranularParams gp;
        gp.grainCount = (uint32_t)mMaxGrains;
        gp.sourceLength = (uint32_t)mSource.count();
        gp.outputFrames = (uint32_t)mOutputFrames;
        gp.sampleRate = mSampleRate;
        gp.deltaTime = fdt;
        gp.time = mTime;
        gp._pad[0] = 0; gp._pad[1] = 0;
        mParams.upload(gp);

        // 1. Clear output buffer
        int clearGroups = (mOutputFrames * 2 + 255) / 256;
        mClearShader.bind(0, mOutputFixed.handle());
        mClearShader.bindUniform(1, mParams.handle());
        mClearShader.dispatch(clearGroups);

        // 2. Emit new grains
        mCurrentEmitParams.emitCount = (uint32_t)emitCount;
        mCurrentEmitParams.time = mTime;
        mEmitParams.upload(mCurrentEmitParams);

        // Reset counter
        std::vector<uint32_t> zero(1, 0);
        mCounter.upload(zero.data(), 1);

        int grainGroups = (mMaxGrains + 255) / 256;
        mEmitShader.bind(0, mGrains.handle());
        mEmitShader.bindUniform(1, mEmitParams.handle());
        mEmitShader.bind(2, mCounter.handle());
        mEmitShader.dispatch(grainGroups);

        // 3. Advance grains and mix to output
        mAdvanceShader.bind(0, mGrains.handle());
        mAdvanceShader.bind(1, mSource.handle());
        mAdvanceShader.bind(2, mOutputFixed.handle());
        mAdvanceShader.bindUniform(3, mParams.handle());
        mAdvanceShader.dispatch(grainGroups);

        // 4. Convert fixed-point to float
        mConvertShader.bind(0, mOutputFixed.handle());
        mConvertShader.bind(1, mOutputFloat.handle());
        mConvertShader.bindUniform(2, mParams.handle());
        mConvertShader.dispatch(clearGroups);

        // 5. Readback (double-buffered)
        // Read current frame's output into the "write" buffer
        auto& writeBuffer = (mReadbackCurrent == 0) ? mReadbackB : mReadbackA;
        mOutputFloat.readback(writeBuffer.data(), mOutputFrames * 2);

        // Swap for next frame (synchronized with fillAudioBuffer)
        {
            std::lock_guard<std::mutex> lock(mReadbackMutex);
            mReadbackCurrent = 1 - mReadbackCurrent;
            mPlaybackPos = 0;
        }
    }

    /// Fill audio output from the readback buffer (call from onSound)
    /// Returns number of frames actually filled
    int fillAudioBuffer(float* outL, float* outR, int frames) {
        if (!mCreated) return 0;

        std::lock_guard<std::mutex> lock(mReadbackMutex);
        const auto& readBuffer = (mReadbackCurrent == 0) ? mReadbackA : mReadbackB;
        int available = mOutputFrames - mPlaybackPos;
        int toFill = std::min(frames, available);

        for (int i = 0; i < toFill; i++) {
            int idx = (mPlaybackPos + i) * 2;
            outL[i] = readBuffer[idx];
            outR[i] = readBuffer[idx + 1];
        }

        // Zero remaining frames
        for (int i = toFill; i < frames; i++) {
            outL[i] = 0.0f;
            outR[i] = 0.0f;
        }

        mPlaybackPos += toFill;
        return toFill;
    }

    /// Get grain buffer handle for visual binding
    BufferHandle grainBufferHandle() const { return mGrains.handle(); }
    int maxGrains() const { return mMaxGrains; }
    int outputFrames() const { return mOutputFrames; }

    void destroy() {
        mGrains.destroy();
        mSource.destroy();
        mOutputFixed.destroy();
        mOutputFloat.destroy();
        mCounter.destroy();
        mParams.destroy();
        mEmitParams.destroy();
        mClearShader.destroy();
        mEmitShader.destroy();
        mAdvanceShader.destroy();
        mConvertShader.destroy();
        mCreated = false;
    }

    ~GranularSynth() { destroy(); }

    // Non-copyable
    GranularSynth(const GranularSynth&) = delete;
    GranularSynth& operator=(const GranularSynth&) = delete;

    // Movable
    GranularSynth(GranularSynth&& other) noexcept
        : mGrains(std::move(other.mGrains)),
          mSource(std::move(other.mSource)),
          mOutputFixed(std::move(other.mOutputFixed)),
          mOutputFloat(std::move(other.mOutputFloat)),
          mCounter(std::move(other.mCounter)),
          mParams(std::move(other.mParams)),
          mEmitParams(std::move(other.mEmitParams)),
          mClearShader(std::move(other.mClearShader)),
          mEmitShader(std::move(other.mEmitShader)),
          mAdvanceShader(std::move(other.mAdvanceShader)),
          mConvertShader(std::move(other.mConvertShader)),
          mReadbackA(std::move(other.mReadbackA)),
          mReadbackB(std::move(other.mReadbackB)),
          mReadbackCurrent(other.mReadbackCurrent),
          mPlaybackPos(other.mPlaybackPos),
          mMaxGrains(other.mMaxGrains),
          mOutputFrames(other.mOutputFrames),
          mSampleRate(other.mSampleRate),
          mTime(other.mTime),
          mCreated(other.mCreated),
          mCurrentEmitParams(other.mCurrentEmitParams) {
        other.mCreated = false;
    }

    GranularSynth& operator=(GranularSynth&& other) noexcept {
        if (this != &other) {
            destroy();
            mGrains = std::move(other.mGrains);
            mSource = std::move(other.mSource);
            mOutputFixed = std::move(other.mOutputFixed);
            mOutputFloat = std::move(other.mOutputFloat);
            mCounter = std::move(other.mCounter);
            mParams = std::move(other.mParams);
            mEmitParams = std::move(other.mEmitParams);
            mClearShader = std::move(other.mClearShader);
            mEmitShader = std::move(other.mEmitShader);
            mAdvanceShader = std::move(other.mAdvanceShader);
            mConvertShader = std::move(other.mConvertShader);
            mReadbackA = std::move(other.mReadbackA);
            mReadbackB = std::move(other.mReadbackB);
            mReadbackCurrent = other.mReadbackCurrent;
            mPlaybackPos = other.mPlaybackPos;
            mMaxGrains = other.mMaxGrains;
            mOutputFrames = other.mOutputFrames;
            mSampleRate = other.mSampleRate;
            mTime = other.mTime;
            mCreated = other.mCreated;
            mCurrentEmitParams = other.mCurrentEmitParams;
            other.mCreated = false;
        }
        return *this;
    }
};

} // namespace al

#endif // AL_WEBGPU_GRANULAR_HPP
