/**
 * AlloLib Studio Online - GPU Bitonic Sort (Phase 6)
 *
 * In-place bitonic sort of particles by camera distance for correct
 * back-to-front transparency rendering.
 *
 * Algorithm:
 *   1. Key generation: compute view-space Z for each particle
 *   2. Bitonic merge steps: compare-and-swap particle pairs by distance key
 *
 * The sort reorders particles in-place (swaps actual particle data) so
 * the existing non-indexed draw path works without modification.
 *
 * Usage:
 *   GPUBitonicSort sorter;
 *   sorter.create(*backend(), 200000);
 *   // In onDraw, before drawing particles:
 *   sorter.sort(particles, viewMatrix);
 *   particles.draw(g);
 *
 * Header-only. Requires: al_WebGPUCompute.hpp, al_WebGPUBuffer.hpp, al_WebGPUParticles.hpp
 */

#ifndef AL_WEBGPU_SORT_HPP
#define AL_WEBGPU_SORT_HPP

#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include "al_WebGPUParticles.hpp"
#include "al/math/al_Vec.hpp"
#include <cstdio>
#include <cstring>
#include <cmath>

namespace al {

// ── GPU-Aligned Structs ─────────────────────────────────────────────────────

struct SortKeyGenParams {
    float viewMatrix[16];
    uint32_t particleCount;
    uint32_t _pad0, _pad1, _pad2;
};
static_assert(sizeof(SortKeyGenParams) == 80, "SortKeyGenParams must be 80 bytes");

struct SortStepParams {
    uint32_t count;
    uint32_t groupWidth;    // comparison distance
    uint32_t groupHeight;   // block size
    uint32_t stepIndex;
};
static_assert(sizeof(SortStepParams) == 16, "SortStepParams must be 16 bytes");

// ── WGSL Compute Shaders ────────────────────────────────────────────────────

// Key generation: compute view-space Z for each particle and store as sort key
static const char* kSortKeyGenWGSL = R"(
struct Particle {
    position: vec3f,
    age: f32,
    velocity: vec3f,
    lifetime: f32,
    color: vec4f,
    size: f32,
    mass: f32,
    _pad0: f32,
    _pad1: f32,
}

struct KeyValue {
    key: f32,
    index: u32,
}

struct Params {
    viewMatrix: mat4x4f,
    particleCount: u32,
    _pad0: u32,
    _pad1: u32,
    _pad2: u32,
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> keys: array<KeyValue>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;
    if (index >= params.particleCount) { return; }

    let p = particles[index];

    // Dead particles get pushed to the end (far away)
    if (p.age >= p.lifetime) {
        keys[index] = KeyValue(1e10, index);
        return;
    }

    // Compute view-space Z (negative Z = in front of camera)
    let viewZ = params.viewMatrix[0][2] * p.position.x +
                params.viewMatrix[1][2] * p.position.y +
                params.viewMatrix[2][2] * p.position.z +
                params.viewMatrix[3][2];

    // Negate so farther particles sort first (back-to-front)
    keys[index] = KeyValue(-viewZ, index);
}
)";

// Bitonic merge step: one pass of compare-and-swap
static const char* kBitonicStepWGSL = R"(
struct Particle {
    position: vec3f,
    age: f32,
    velocity: vec3f,
    lifetime: f32,
    color: vec4f,
    size: f32,
    mass: f32,
    _pad0: f32,
    _pad1: f32,
}

struct KeyValue {
    key: f32,
    index: u32,
}

struct Params {
    count: u32,
    groupWidth: u32,
    groupHeight: u32,
    stepIndex: u32,
}

@group(0) @binding(0) var<storage, read_write> keys: array<KeyValue>;
@group(0) @binding(1) var<uniform> params: Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let i = global_id.x;
    if (i >= params.count / 2u) { return; }

    let groupWidth = params.groupWidth;
    let groupHeight = params.groupHeight;

    // Calculate indices for this comparison
    let blockId = i / (groupWidth / 2u);
    let blockOffset = i % (groupWidth / 2u);

    let leftIdx = blockId * groupWidth + blockOffset;
    let rightIdx = leftIdx + groupWidth / 2u;

    if (rightIdx >= params.count) { return; }

    // Determine sort direction (alternating blocks)
    let sameBlock = (leftIdx / groupHeight) == (rightIdx / groupHeight);
    let ascending = ((leftIdx / groupHeight) % 2u) == 0u;

    let leftKey = keys[leftIdx];
    let rightKey = keys[rightIdx];

    let shouldSwap = select(leftKey.key < rightKey.key, leftKey.key > rightKey.key, ascending);

    if (shouldSwap) {
        keys[leftIdx] = rightKey;
        keys[rightIdx] = leftKey;
    }
}
)";

// Final reorder: rearrange particles based on sorted indices
static const char* kReorderWGSL = R"(
struct Particle {
    position: vec3f,
    age: f32,
    velocity: vec3f,
    lifetime: f32,
    color: vec4f,
    size: f32,
    mass: f32,
    _pad0: f32,
    _pad1: f32,
}

struct KeyValue {
    key: f32,
    index: u32,
}

struct Params {
    count: u32,
    groupWidth: u32,
    groupHeight: u32,
    stepIndex: u32,
}

@group(0) @binding(0) var<storage, read> sortedKeys: array<KeyValue>;
@group(0) @binding(1) var<storage, read> srcParticles: array<Particle>;
@group(0) @binding(2) var<storage, read_write> dstParticles: array<Particle>;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;
    if (index >= params.count) { return; }

    let srcIdx = sortedKeys[index].index;
    dstParticles[index] = srcParticles[srcIdx];
}
)";

// ── GPUBitonicSort Class ────────────────────────────────────────────────────

struct SortKeyValue {
    float key;
    uint32_t index;
};

class GPUBitonicSort {
    ComputeShader mKeyGenShader;
    ComputeShader mBitonicStepShader;
    ComputeShader mReorderShader;
    GPUBuffer<SortKeyValue> mKeysBuffer;
    GPUBuffer<GPUParticle> mTempParticleBuffer;
    GPUUniformBuffer<SortKeyGenParams> mKeyGenParamsBuffer;
    GPUUniformBuffer<SortStepParams> mStepParamsBuffer;
    GraphicsBackend* mBackend = nullptr;
    int mMaxCount = 0;
    int mPaddedCount = 0; // Next power of 2
    bool mCreated = false;

    static int nextPowerOf2(int n) {
        int p = 1;
        while (p < n) p <<= 1;
        return p;
    }

public:
    GPUBitonicSort() = default;

    void create(GraphicsBackend& backend, int maxCount) {
        mBackend = &backend;
        mMaxCount = maxCount;
        mPaddedCount = nextPowerOf2(maxCount);

        mKeyGenShader.create(backend, kSortKeyGenWGSL);
        mBitonicStepShader.create(backend, kBitonicStepWGSL);
        mReorderShader.create(backend, kReorderWGSL);

        // Allocate keys buffer (padded to power of 2)
        std::vector<SortKeyValue> initKeys(mPaddedCount);
        for (int i = 0; i < mPaddedCount; i++) {
            initKeys[i].key = 1e10f;  // dead particles sort to end
            initKeys[i].index = (uint32_t)i;
        }
        mKeysBuffer.create(backend, initKeys);

        // Temp particle buffer for reorder
        std::vector<GPUParticle> initParticles(maxCount);
        for (int i = 0; i < maxCount; i++) {
            initParticles[i] = {};
            initParticles[i].age = 1.0f;
            initParticles[i].lifetime = 0.0f;
        }
        mTempParticleBuffer.create(backend, initParticles);

        mKeyGenParamsBuffer.create(backend);
        mStepParamsBuffer.create(backend);

        mCreated = true;
        printf("[GPUBitonicSort] Created for %d particles (padded to %d)\n", maxCount, mPaddedCount);
    }

    void destroy() {
        mKeyGenShader.destroy();
        mBitonicStepShader.destroy();
        mReorderShader.destroy();
        mKeysBuffer.destroy();
        mTempParticleBuffer.destroy();
        mKeyGenParamsBuffer.destroy();
        mStepParamsBuffer.destroy();
        mCreated = false;
    }

    ~GPUBitonicSort() { destroy(); }

    /// Sort particles by camera distance (back-to-front).
    /// Call before drawing for correct transparency.
    void sort(ParticleSystem& ps, const float* viewMatrix) {
        if (!mCreated) return;

        int count = ps.maxParticles();
        int paddedCount = nextPowerOf2(count);

        // Step 1: Generate sort keys (view-space Z)
        SortKeyGenParams keyParams = {};
        memcpy(keyParams.viewMatrix, viewMatrix, 64);
        keyParams.particleCount = (uint32_t)count;
        mKeyGenParamsBuffer.upload(keyParams);

        mKeyGenShader.bind(0, ps.particleBufferHandle());
        mKeyGenShader.bind(1, mKeysBuffer.handle());
        mKeyGenShader.bindUniform(2, mKeyGenParamsBuffer.handle());
        mKeyGenShader.dispatch((count + 255) / 256);

        // Step 2: Bitonic sort passes
        // log2(paddedCount) * (log2(paddedCount)+1) / 2 total dispatches
        for (int k = 2; k <= paddedCount; k <<= 1) {
            for (int j = k >> 1; j > 0; j >>= 1) {
                SortStepParams stepParams = {};
                stepParams.count = (uint32_t)paddedCount;
                stepParams.groupWidth = (uint32_t)(j * 2);
                stepParams.groupHeight = (uint32_t)k;
                stepParams.stepIndex = 0;
                mStepParamsBuffer.upload(stepParams);

                mBitonicStepShader.bind(0, mKeysBuffer.handle());
                mBitonicStepShader.bindUniform(1, mStepParamsBuffer.handle());
                mBitonicStepShader.dispatch((paddedCount / 2 + 255) / 256);
            }
        }

        // Step 3: Reorder particles based on sorted keys
        // Copy current particles to temp, then scatter-write to original
        mBackend->copyBuffer(ps.particleBufferHandle(), mTempParticleBuffer.handle(),
                             count * sizeof(GPUParticle));

        SortStepParams reorderParams = {};
        reorderParams.count = (uint32_t)count;
        mStepParamsBuffer.upload(reorderParams);

        mReorderShader.bind(0, mKeysBuffer.handle());
        mReorderShader.bind(1, mTempParticleBuffer.handle());
        mReorderShader.bind(2, ps.particleBufferHandle());
        mReorderShader.bindUniform(3, mStepParamsBuffer.handle());
        mReorderShader.dispatch((count + 255) / 256);
    }

    // Non-copyable, movable
    GPUBitonicSort(const GPUBitonicSort&) = delete;
    GPUBitonicSort& operator=(const GPUBitonicSort&) = delete;
    GPUBitonicSort(GPUBitonicSort&&) = default;
    GPUBitonicSort& operator=(GPUBitonicSort&&) = default;
};

} // namespace al

#endif // AL_WEBGPU_SORT_HPP
