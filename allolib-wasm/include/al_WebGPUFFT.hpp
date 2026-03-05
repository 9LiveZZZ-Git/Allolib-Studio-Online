/**
 * AlloLib Studio Online - GPU FFT Engine (Phase 9)
 *
 * Radix-2 Cooley-Tukey FFT via 4 compute shader passes.
 * Supports sizes 256, 512, 1024, 2048.
 *
 * Usage:
 *   GPUFFT fft;
 *   fft.create(*backend(), 1024);
 *
 *   void onAnimate(double dt) {
 *       ring.uploadToGPU();
 *       fft.compute(ring);
 *       // fft.magnitudeBuffer() has frequency magnitudes
 *   }
 *
 * Header-only. Requires: al_WebGPUCompute.hpp, al_WebGPUBuffer.hpp,
 *   al_WebPingPong.hpp, al_WebGPUAudio.hpp
 */

#ifndef AL_WEBGPU_FFT_HPP
#define AL_WEBGPU_FFT_HPP

#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include "al_WebPingPong.hpp"
#include "al_WebGPUAudio.hpp"
#include <cmath>
#include <cstdio>

namespace al {

// ── GPU-Aligned Structs ─────────────────────────────────────────────────────

struct FFTParams {               // 16 bytes
    uint32_t fftSize;
    uint32_t passIndex;          // butterfly pass 0..log2(N)-1
    uint32_t numBits;            // log2(fftSize)
    uint32_t _pad;
};
static_assert(sizeof(FFTParams) == 16, "FFTParams must be 16 bytes");

// ── WGSL Shader Sources ─────────────────────────────────────────────────────

// Pass 1: Apply Hanning window and write as complex pairs [re, 0.0]
static const char* kFFTWindowWGSL = R"(
struct Params {
    fftSize: u32,
    passIndex: u32,
    numBits: u32,
    _pad: u32,
}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

const PI: f32 = 3.14159265358979323846;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i = gid.x;
    if (i >= params.fftSize) { return; }

    let n = f32(params.fftSize);
    let window = 0.5 * (1.0 - cos(2.0 * PI * f32(i) / (n - 1.0)));
    let sample = input[i] * f32(window);

    // Write as complex pair: [re, im]
    output[i * 2u] = sample;
    output[i * 2u + 1u] = 0.0;
}
)";

// Pass 2: Bit-reverse permutation
static const char* kFFTBitReverseWGSL = R"(
struct Params {
    fftSize: u32,
    passIndex: u32,
    numBits: u32,
    _pad: u32,
}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

fn reverseBits(x: u32, bits: u32) -> u32 {
    var v = x;
    var r = 0u;
    for (var i = 0u; i < bits; i++) {
        r = (r << 1u) | (v & 1u);
        v >>= 1u;
    }
    return r;
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i = gid.x;
    if (i >= params.fftSize) { return; }

    let j = reverseBits(i, params.numBits);

    // Copy complex pair
    output[j * 2u] = input[i * 2u];
    output[j * 2u + 1u] = input[i * 2u + 1u];
}
)";

// Pass 3: Butterfly operation (run numBits times, alternating ping-pong)
static const char* kFFTButterflyWGSL = R"(
struct Params {
    fftSize: u32,
    passIndex: u32,
    numBits: u32,
    _pad: u32,
}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

const PI: f32 = 3.14159265358979323846;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i = gid.x;
    if (i >= params.fftSize) { return; }

    let halfSize = 1u << params.passIndex;
    let fullSize = halfSize << 1u;

    let group = i / fullSize;
    let pos = i % fullSize;

    if (pos < halfSize) {
        // This thread handles a "top" element
        let topIdx = group * fullSize + pos;
        let botIdx = topIdx + halfSize;

        let topRe = input[topIdx * 2u];
        let topIm = input[topIdx * 2u + 1u];
        let botRe = input[botIdx * 2u];
        let botIm = input[botIdx * 2u + 1u];

        // Twiddle factor: W = e^{-2*pi*i*k/N}
        let k = pos;
        let N = fullSize;
        let angle = -2.0 * PI * f32(k) / f32(N);
        let twRe = cos(angle);
        let twIm = sin(angle);

        // Complex multiply: twiddle * bot
        let tbRe = twRe * botRe - twIm * botIm;
        let tbIm = twRe * botIm + twIm * botRe;

        // Butterfly
        output[topIdx * 2u] = topRe + tbRe;
        output[topIdx * 2u + 1u] = topIm + tbIm;
        output[botIdx * 2u] = topRe - tbRe;
        output[botIdx * 2u + 1u] = topIm - tbIm;
    }
    // Bottom elements are written by the top thread above
}
)";

// Pass 4: Compute magnitude from complex pairs
static const char* kFFTMagnitudeWGSL = R"(
struct Params {
    fftSize: u32,
    passIndex: u32,
    numBits: u32,
    _pad: u32,
}

@group(0) @binding(0) var<storage, read> complex: array<f32>;
@group(0) @binding(1) var<storage, read_write> magnitudes: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let i = gid.x;
    let numBins = params.fftSize / 2u + 1u;
    if (i >= numBins) { return; }

    let re = complex[i * 2u];
    let im = complex[i * 2u + 1u];
    let n = f32(params.fftSize);
    magnitudes[i] = sqrt(re * re + im * im) / n;
}
)";

// ── GPUFFT Class ────────────────────────────────────────────────────────────

class GPUFFT {
    int mSize = 0;
    int mNumPasses = 0;
    GPUBuffer<float> mComplexA;         // size*2 floats (re,im pairs)
    GPUBuffer<float> mComplexB;         // size*2 floats (ping-pong)
    GPUBuffer<float> mMagnitudes;       // size/2+1 floats
    GPUUniformBuffer<FFTParams> mParamsBuffer;
    ComputeShader mWindowShader;
    ComputeShader mBitReverseShader;
    ComputeShader mButterflyShader;
    ComputeShader mMagnitudeShader;
    bool mCreated = false;

    static int log2i(int n) {
        int bits = 0;
        while ((1 << bits) < n) bits++;
        return bits;
    }

public:
    GPUFFT() = default;

    static bool isPowerOfTwo(int n) { return n > 0 && (n & (n - 1)) == 0; }

    void create(GraphicsBackend& backend, int fftSize = 1024) {
        if (!isPowerOfTwo(fftSize)) return;
        mSize = fftSize;
        mNumPasses = log2i(fftSize);

        mComplexA.create(backend, fftSize * 2);
        mComplexB.create(backend, fftSize * 2);
        mMagnitudes.create(backend, fftSize / 2 + 1);
        mParamsBuffer.create(backend);

        mWindowShader.create(backend, kFFTWindowWGSL);
        mBitReverseShader.create(backend, kFFTBitReverseWGSL);
        mButterflyShader.create(backend, kFFTButterflyWGSL);
        mMagnitudeShader.create(backend, kFFTMagnitudeWGSL);

        mCreated = true;
        printf("[GPUFFT] Created %d-point FFT (%d butterfly passes)\n", fftSize, mNumPasses);
    }

    /// Run FFT on a raw GPU audio buffer
    void compute(BufferHandle inputTimeDomain) {
        if (!mCreated) return;

        int groups = (mSize + 255) / 256;
        FFTParams p;
        p.fftSize = (uint32_t)mSize;
        p.numBits = (uint32_t)mNumPasses;
        p._pad = 0;

        // Pass 1: Window → complex A
        p.passIndex = 0;
        mParamsBuffer.upload(p);
        mWindowShader.bind(0, inputTimeDomain);
        mWindowShader.bind(1, mComplexA.handle());
        mWindowShader.bindUniform(2, mParamsBuffer.handle());
        mWindowShader.dispatch(groups);

        // Pass 2: Bit-reverse A → B
        mBitReverseShader.bind(0, mComplexA.handle());
        mBitReverseShader.bind(1, mComplexB.handle());
        mBitReverseShader.bindUniform(2, mParamsBuffer.handle());
        mBitReverseShader.dispatch(groups);

        // Pass 3: Butterfly passes (alternate between B→A and A→B)
        // After bit-reverse, data is in B
        bool dataInA = false;  // data starts in B
        for (int pass = 0; pass < mNumPasses; pass++) {
            p.passIndex = (uint32_t)pass;
            mParamsBuffer.upload(p);

            if (!dataInA) {
                // Read B, write A
                mButterflyShader.bind(0, mComplexB.handle());
                mButterflyShader.bind(1, mComplexA.handle());
            } else {
                // Read A, write B
                mButterflyShader.bind(0, mComplexA.handle());
                mButterflyShader.bind(1, mComplexB.handle());
            }
            mButterflyShader.bindUniform(2, mParamsBuffer.handle());
            mButterflyShader.dispatch(groups);
            dataInA = !dataInA;
        }

        // Pass 4: Magnitude from whichever buffer has the final result
        BufferHandle finalComplex = dataInA ? mComplexA.handle() : mComplexB.handle();
        mMagnitudeShader.bind(0, finalComplex);
        mMagnitudeShader.bind(1, mMagnitudes.handle());
        mMagnitudeShader.bindUniform(2, mParamsBuffer.handle());
        int magGroups = (mSize / 2 + 1 + 255) / 256;
        mMagnitudeShader.dispatch(magGroups);
    }

    /// Convenience: compute FFT from an AudioRingBuffer
    void compute(AudioRingBuffer& audio) {
        compute(audio.audioBufferHandle());
    }

    BufferHandle magnitudeBuffer() const { return mMagnitudes.handle(); }
    int size() const { return mSize; }
    int numBins() const { return mSize / 2 + 1; }

    /// Readback magnitudes to CPU (requires ASYNCIFY)
    void readbackMagnitudes(std::vector<float>& dest) {
        mMagnitudes.readback(dest);
    }

    void destroy() {
        mComplexA.destroy();
        mComplexB.destroy();
        mMagnitudes.destroy();
        mParamsBuffer.destroy();
        mWindowShader.destroy();
        mBitReverseShader.destroy();
        mButterflyShader.destroy();
        mMagnitudeShader.destroy();
        mCreated = false;
    }

    ~GPUFFT() { destroy(); }

    // Non-copyable
    GPUFFT(const GPUFFT&) = delete;
    GPUFFT& operator=(const GPUFFT&) = delete;

    // Movable
    GPUFFT(GPUFFT&& other) noexcept
        : mSize(other.mSize),
          mNumPasses(other.mNumPasses),
          mComplexA(std::move(other.mComplexA)),
          mComplexB(std::move(other.mComplexB)),
          mMagnitudes(std::move(other.mMagnitudes)),
          mParamsBuffer(std::move(other.mParamsBuffer)),
          mWindowShader(std::move(other.mWindowShader)),
          mBitReverseShader(std::move(other.mBitReverseShader)),
          mButterflyShader(std::move(other.mButterflyShader)),
          mMagnitudeShader(std::move(other.mMagnitudeShader)),
          mCreated(other.mCreated) {
        other.mCreated = false;
    }

    GPUFFT& operator=(GPUFFT&& other) noexcept {
        if (this != &other) {
            destroy();
            mSize = other.mSize;
            mNumPasses = other.mNumPasses;
            mComplexA = std::move(other.mComplexA);
            mComplexB = std::move(other.mComplexB);
            mMagnitudes = std::move(other.mMagnitudes);
            mParamsBuffer = std::move(other.mParamsBuffer);
            mWindowShader = std::move(other.mWindowShader);
            mBitReverseShader = std::move(other.mBitReverseShader);
            mButterflyShader = std::move(other.mButterflyShader);
            mMagnitudeShader = std::move(other.mMagnitudeShader);
            mCreated = other.mCreated;
            other.mCreated = false;
        }
        return *this;
    }
};

} // namespace al

#endif // AL_WEBGPU_FFT_HPP
