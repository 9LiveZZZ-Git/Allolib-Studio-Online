/**
 * AlloLib Studio Online - GPU Particle System (Phase 4)
 *
 * High-performance particle system using WebGPU compute + instanced rendering.
 * Particles are simulated entirely on the GPU — no CPU readback needed.
 *
 * Features:
 *   - Emit, update, and render up to 1M particles on GPU
 *   - Curl noise turbulence, gravity, damping
 *   - Billboarded quad rendering with soft circular falloff
 *   - Additive blending for glow effects
 *   - Multiple emitter support
 *
 * Usage:
 *   ParticleSystem ps;
 *   ps.create(*backend(), 200000);
 *
 *   ParticleEmitterConfig emitter;
 *   emitter.position = Vec3f(0, -1, 0);
 *   emitter.direction = Vec3f(0, 1, 0);
 *   emitter.emitRate = 10000;
 *   int id = ps.addEmitter(emitter);
 *
 *   void onAnimate(double dt) { ps.update(dt); }
 *   void onDraw(Graphics& g) { ps.draw(g); }
 *
 * Header-only. Requires: al_WebGPUCompute.hpp, al_WebGPUBuffer.hpp
 */

#ifndef AL_WEBGPU_PARTICLES_HPP
#define AL_WEBGPU_PARTICLES_HPP

#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include "al_WebGPUBackend.hpp"
#include "al/math/al_Vec.hpp"
#include "al/types/al_Color.hpp"
#include <vector>
#include <cstring>
#include <cmath>
#include <cstdio>
#include <algorithm>

// External functions for detecting rendering backend
extern "C" {
    bool Graphics_isWebGPU();
    al::GraphicsBackend* Graphics_getBackend();
}

namespace al {

// ── GPU-Aligned Structs (must match WGSL layouts exactly) ───────────────────

struct GPUParticle {
    float px, py, pz;     // position
    float age;
    float vx, vy, vz;     // velocity
    float lifetime;
    float r, g, b, a;     // color
    float size;
    float mass;
    float _pad0, _pad1;
};
static_assert(sizeof(GPUParticle) == 64, "GPUParticle must be 64 bytes");

struct ParticleSimParams {
    float deltaTime;
    float time;
    float damping;
    float noiseScale;
    float noiseStrength;
    uint32_t particleCount;
    uint32_t _pad0, _pad1;
    float gravityX, gravityY, gravityZ;
    float _pad2;
};
static_assert(sizeof(ParticleSimParams) == 48, "ParticleSimParams must be 48 bytes");

struct ParticleEmitParams {
    float posX, posY, posZ;
    uint32_t emitCount;
    float dirX, dirY, dirZ;
    float spread;
    float minSpeed, maxSpeed;
    float minLifetime, maxLifetime;
    float startR, startG, startB, startA;
    float endR, endG, endB, endA;
    float startSize, endSize;
    float time;
    uint32_t particleCount;
};
static_assert(sizeof(ParticleEmitParams) == 96, "ParticleEmitParams must be 96 bytes");

struct ParticleRenderParams {
    float viewMatrix[16];
    float projMatrix[16];
    float cameraRightX, cameraRightY, cameraRightZ;
    float _pad0;
    float cameraUpX, cameraUpY, cameraUpZ;
    float shapeMode;  // 0=circle(default), 1=star, 2=ring, 3=spark, 4=square
};
static_assert(sizeof(ParticleRenderParams) == 160, "ParticleRenderParams must be 160 bytes");

struct AtomicCounter {
    uint32_t count;
};

// ── User-Facing Emitter Configuration ───────────────────────────────────────

struct ParticleEmitterConfig {
    Vec3f position{0, 0, 0};
    Vec3f direction{0, 1, 0};
    float spread = 0.5f;
    float minSpeed = 1.0f;
    float maxSpeed = 3.0f;
    float minLifetime = 1.0f;
    float maxLifetime = 3.0f;
    Color startColor{1.0f, 1.0f, 1.0f, 1.0f};
    Color endColor{1.0f, 1.0f, 1.0f, 0.0f};
    float startSize = 0.05f;
    float endSize = 0.02f;
    int emitRate = 5000;  // particles per second
};

// ── Embedded Compute Shader Sources ─────────────────────────────────────────

static const char* kParticleUpdateWGSL = R"(
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

struct SimParams {
    deltaTime: f32,
    time: f32,
    damping: f32,
    noiseScale: f32,
    noiseStrength: f32,
    particleCount: u32,
    _pad0: u32,
    _pad1: u32,
    gravity: vec3f,
    _pad2: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;

fn mod289(x: vec3f) -> vec3f {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_4(x: vec4f) -> vec4f {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute(x: vec4f) -> vec4f {
    return mod289_4(((x * 34.0) + 1.0) * x);
}

fn taylorInvSqrt(r: vec4f) -> vec4f {
    return 1.79284291400159 - 0.85373472095314 * r;
}

fn snoise(v: vec3f) -> f32 {
    let C = vec2f(1.0 / 6.0, 1.0 / 3.0);
    let D = vec4f(0.0, 0.5, 1.0, 2.0);

    var i = floor(v + dot(v, vec3f(C.y)));
    let x0 = v - i + dot(i, vec3f(C.x));

    let g = step(x0.yzx, x0.xyz);
    let l = 1.0 - g;
    let i1 = min(g.xyz, l.zxy);
    let i2 = max(g.xyz, l.zxy);

    let x1 = x0 - i1 + vec3f(C.x);
    let x2 = x0 - i2 + vec3f(C.y);
    let x3 = x0 - vec3f(D.y);

    i = mod289(i);
    let p = permute(permute(permute(
        i.z + vec4f(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4f(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4f(0.0, i1.x, i2.x, 1.0));

    let n_ = 0.142857142857;
    let ns = n_ * D.wyz - D.xzx;

    let j = p - 49.0 * floor(p * ns.z * ns.z);

    let x_ = floor(j * ns.z);
    let y_ = floor(j - 7.0 * x_);

    let x = x_ * ns.x + vec4f(ns.y);
    let y = y_ * ns.x + vec4f(ns.y);
    let h = 1.0 - abs(x) - abs(y);

    let b0 = vec4f(x.xy, y.xy);
    let b1 = vec4f(x.zw, y.zw);

    let s0 = floor(b0) * 2.0 + 1.0;
    let s1 = floor(b1) * 2.0 + 1.0;
    let sh = -step(h, vec4f(0.0));

    let a0 = b0.xzyw + s0.xzyw * vec4f(sh.x, sh.x, sh.y, sh.y);
    let a1 = b1.xzyw + s1.xzyw * vec4f(sh.z, sh.z, sh.w, sh.w);

    var p0 = vec3f(a0.xy, h.x);
    var p1 = vec3f(a0.zw, h.y);
    var p2 = vec3f(a1.xy, h.z);
    var p3 = vec3f(a1.zw, h.w);

    let norm = taylorInvSqrt(vec4f(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    var m = max(0.6 - vec4f(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4f(0.0));
    m = m * m;
    return 42.0 * dot(m * m, vec4f(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

fn curlNoise(p: vec3f) -> vec3f {
    let e = 0.0001;
    let dx = vec3f(e, 0.0, 0.0);
    let dy = vec3f(0.0, e, 0.0);
    let dz = vec3f(0.0, 0.0, e);

    let p_x0 = snoise(p - dx);
    let p_x1 = snoise(p + dx);
    let p_y0 = snoise(p - dy);
    let p_y1 = snoise(p + dy);
    let p_z0 = snoise(p - dz);
    let p_z1 = snoise(p + dz);

    let x = (p_y1 - p_y0) - (p_z1 - p_z0);
    let y = (p_z1 - p_z0) - (p_x1 - p_x0);
    let z = (p_x1 - p_x0) - (p_y1 - p_y0);

    return normalize(vec3f(x, y, z)) / (2.0 * e);
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;
    if (index >= params.particleCount) { return; }

    var p = particles[index];
    if (p.age >= p.lifetime) { return; }

    p.age += params.deltaTime;
    p.velocity += params.gravity * params.deltaTime;

    let noisePos = p.position * params.noiseScale + vec3f(params.time * 0.1);
    let turbulence = curlNoise(noisePos) * params.noiseStrength;
    p.velocity += turbulence * params.deltaTime;

    p.velocity *= 1.0 - params.damping * params.deltaTime;
    p.position += p.velocity * params.deltaTime;

    let lifeRatio = p.age / p.lifetime;
    p.color.a = 1.0 - lifeRatio;

    particles[index] = p;
}
)";

static const char* kParticleEmitWGSL = R"(
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

struct EmitParams {
    emitPosition: vec3f,
    emitCount: u32,
    emitDirection: vec3f,
    spread: f32,
    minSpeed: f32,
    maxSpeed: f32,
    minLifetime: f32,
    maxLifetime: f32,
    startColor: vec4f,
    endColor: vec4f,
    startSize: f32,
    endSize: f32,
    time: f32,
    particleCount: u32,
}

struct AtomicCounter {
    count: atomic<u32>,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: EmitParams;
@group(0) @binding(2) var<storage, read_write> emitCounter: AtomicCounter;

fn hash(n: u32) -> f32 {
    var x = n;
    x = ((x >> 16u) ^ x) * 0x45d9f3bu;
    x = ((x >> 16u) ^ x) * 0x45d9f3bu;
    x = (x >> 16u) ^ x;
    return f32(x) / f32(0xffffffffu);
}

fn randomInCone(dir: vec3f, spread: f32, seed: u32) -> vec3f {
    let angle = hash(seed) * 6.28318530718;
    let radius = sqrt(hash(seed + 1u)) * tan(spread);

    var up = vec3f(0.0, 1.0, 0.0);
    if (abs(dot(dir, up)) > 0.99) {
        up = vec3f(1.0, 0.0, 0.0);
    }

    let right = normalize(cross(up, dir));
    let forward = cross(dir, right);

    let offset = right * cos(angle) * radius + forward * sin(angle) * radius;
    return normalize(dir + offset);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;
    if (index >= params.particleCount) { return; }

    var p = particles[index];
    if (p.age < p.lifetime) { return; }

    let emitted = atomicAdd(&emitCounter.count, 1u);
    if (emitted >= params.emitCount) { return; }

    let seed = index * 7u + u32(params.time * 1000.0);

    p.position = params.emitPosition;
    let dir = randomInCone(params.emitDirection, params.spread, seed);
    let speed = mix(params.minSpeed, params.maxSpeed, hash(seed + 10u));
    p.velocity = dir * speed;

    p.lifetime = mix(params.minLifetime, params.maxLifetime, hash(seed + 20u));
    p.age = 0.0;
    p.color = params.startColor;
    p.size = params.startSize;
    p.mass = 1.0;

    particles[index] = p;
}
)";

// ── ParticleSystem Class ────────────────────────────────────────────────────

class ParticleSystem {
    GPUBuffer<GPUParticle> mParticleBuffer;
    GPUUniformBuffer<ParticleSimParams> mSimParamsBuffer;
    GPUUniformBuffer<ParticleEmitParams> mEmitParamsBuffer;
    GPUUniformBuffer<ParticleRenderParams> mRenderParamsBuffer;
    GPUBuffer<AtomicCounter> mAtomicCounterBuffer;
    ComputeShader mUpdateShader;
    ComputeShader mEmitShader;

    GraphicsBackend* mBackend = nullptr;
    int mMaxParticles = 0;
    float mTime = 0.0f;
    float mEmitAccumulator = 0.0f;

    // Simulation config
    Vec3f mGravity{0.0f, -9.8f, 0.0f};
    float mDamping = 0.5f;
    float mNoiseScale = 1.0f;
    float mNoiseStrength = 0.5f;

    // Emitters
    std::vector<ParticleEmitterConfig> mEmitters;

    int mShapeMode = 0;  // 0=circle, 1=star, 2=ring, 3=spark, 4=square
    bool mCreated = false;

public:
    ParticleSystem() = default;

    void create(GraphicsBackend& backend, int maxParticles = 100000) {
        mBackend = &backend;
        mMaxParticles = maxParticles;
        mCreated = true;

        // Initialize all particles as dead (age >= lifetime)
        std::vector<GPUParticle> initData(maxParticles);
        for (int i = 0; i < maxParticles; i++) {
            initData[i] = {};
            initData[i].age = 1.0f;
            initData[i].lifetime = 0.0f;  // age >= lifetime → dead
        }

        mParticleBuffer.create(backend, initData);
        mSimParamsBuffer.create(backend);
        mEmitParamsBuffer.create(backend);
        mRenderParamsBuffer.create(backend);

        // Atomic counter (single uint32_t)
        AtomicCounter zero = {0};
        mAtomicCounterBuffer.create(backend, 1, &zero);

        // Create compute shaders
        mUpdateShader.create(backend, kParticleUpdateWGSL);
        mEmitShader.create(backend, kParticleEmitWGSL);

        printf("[ParticleSystem] Created with %d max particles\n", maxParticles);
    }

    void destroy() {
        mParticleBuffer.destroy();
        mSimParamsBuffer.destroy();
        mEmitParamsBuffer.destroy();
        mRenderParamsBuffer.destroy();
        mAtomicCounterBuffer.destroy();
        mUpdateShader.destroy();
        mEmitShader.destroy();
        mCreated = false;
    }

    ~ParticleSystem() { destroy(); }

    // ── Emitter Management ──────────────────────────────────────────────

    int addEmitter(const ParticleEmitterConfig& config) {
        mEmitters.push_back(config);
        return (int)mEmitters.size() - 1;
    }

    ParticleEmitterConfig& emitter(int index) {
        return mEmitters[index];
    }

    const ParticleEmitterConfig& emitter(int index) const {
        return mEmitters[index];
    }

    void removeEmitter(int index) {
        if (index >= 0 && index < (int)mEmitters.size()) {
            mEmitters.erase(mEmitters.begin() + index);
        }
    }

    int emitterCount() const { return (int)mEmitters.size(); }

    // ── Simulation Config ───────────────────────────────────────────────

    void setGravity(const Vec3f& g) { mGravity = g; }
    Vec3f gravity() const { return mGravity; }

    void setDamping(float d) { mDamping = d; }
    float damping() const { return mDamping; }

    void setTurbulence(float scale, float strength) {
        mNoiseScale = scale;
        mNoiseStrength = strength;
    }
    float noiseScale() const { return mNoiseScale; }
    float noiseStrength() const { return mNoiseStrength; }

    int maxParticles() const { return mMaxParticles; }

    // ── Buffer Accessors (for VFX systems) ──────────────────────────────

    BufferHandle particleBufferHandle() const { return mParticleBuffer.handle(); }
    BufferHandle renderParamsHandle() const { return mRenderParamsBuffer.handle(); }

    void setShapeMode(int mode) { mShapeMode = mode; }
    int shapeMode() const { return mShapeMode; }

    // ── Per-Frame Calls ─────────────────────────────────────────────────

    void update(double dt) {
        if (!mCreated || !mBackend) return;

        float fdt = (float)std::min(dt, 0.033);  // Cap at ~30fps
        mTime += fdt;

        // ── Emit Phase ──────────────────────────────────────────────
        for (auto& em : mEmitters) {
            int toEmit = (int)(em.emitRate * fdt);
            if (toEmit <= 0) continue;

            // Reset atomic counter to 0
            AtomicCounter zero = {0};
            mAtomicCounterBuffer.upload(&zero, 1);

            // Fill emit params
            ParticleEmitParams ep = {};
            ep.posX = em.position.x;
            ep.posY = em.position.y;
            ep.posZ = em.position.z;
            ep.emitCount = (uint32_t)toEmit;
            ep.dirX = em.direction.x;
            ep.dirY = em.direction.y;
            ep.dirZ = em.direction.z;
            ep.spread = em.spread;
            ep.minSpeed = em.minSpeed;
            ep.maxSpeed = em.maxSpeed;
            ep.minLifetime = em.minLifetime;
            ep.maxLifetime = em.maxLifetime;
            ep.startR = em.startColor.r;
            ep.startG = em.startColor.g;
            ep.startB = em.startColor.b;
            ep.startA = em.startColor.a;
            ep.endR = em.endColor.r;
            ep.endG = em.endColor.g;
            ep.endB = em.endColor.b;
            ep.endA = em.endColor.a;
            ep.startSize = em.startSize;
            ep.endSize = em.endSize;
            ep.time = mTime;
            ep.particleCount = (uint32_t)mMaxParticles;
            mEmitParamsBuffer.upload(ep);

            // Bind and dispatch emit shader
            mEmitShader.bind(0, mParticleBuffer.handle());
            mEmitShader.bindUniform(1, mEmitParamsBuffer.handle());
            mEmitShader.bind(2, mAtomicCounterBuffer.handle());

            int emitGroups = (mMaxParticles + 63) / 64;
            mEmitShader.dispatch(emitGroups);
        }

        // ── Update Phase ────────────────────────────────────────────
        ParticleSimParams sp = {};
        sp.deltaTime = fdt;
        sp.time = mTime;
        sp.damping = mDamping;
        sp.noiseScale = mNoiseScale;
        sp.noiseStrength = mNoiseStrength;
        sp.particleCount = (uint32_t)mMaxParticles;
        sp._pad0 = 0;
        sp._pad1 = 0;
        sp.gravityX = mGravity.x;
        sp.gravityY = mGravity.y;
        sp.gravityZ = mGravity.z;
        sp._pad2 = 0.0f;
        mSimParamsBuffer.upload(sp);

        mUpdateShader.bind(0, mParticleBuffer.handle());
        mUpdateShader.bindUniform(1, mSimParamsBuffer.handle());

        int updateGroups = (mMaxParticles + 255) / 256;
        mUpdateShader.dispatch(updateGroups);
    }

    void draw(Graphics& g) {
        if (!mCreated) return;
        if (!Graphics_isWebGPU()) return;

#ifdef ALLOLIB_WEBGPU
        auto* backend = dynamic_cast<WebGPUBackend*>(Graphics_getBackend());
        if (!backend) return;

        // Extract camera vectors from view matrix
        // View matrix columns 0 and 1 give camera right and up in world space
        const float* view = g.viewMatrix().elems();
        const float* proj = g.projMatrix().elems();

        ParticleRenderParams rp = {};
        memcpy(rp.viewMatrix, view, 64);
        memcpy(rp.projMatrix, proj, 64);

        // Camera right = first column of view matrix (transposed)
        rp.cameraRightX = view[0];
        rp.cameraRightY = view[4];
        rp.cameraRightZ = view[8];
        rp._pad0 = 0.0f;

        // Camera up = second column of view matrix (transposed)
        rp.cameraUpX = view[1];
        rp.cameraUpY = view[5];
        rp.cameraUpZ = view[9];
        rp.shapeMode = (float)mShapeMode;

        mRenderParamsBuffer.upload(rp);

        backend->drawParticles(
            mParticleBuffer.handle(),
            mRenderParamsBuffer.handle(),
            mMaxParticles
        );
#endif
    }

    /// Draw with soft particle depth-aware fade (for geometry intersections)
    void drawSoft(Graphics& g, float fadeDistance = 0.5f) {
        if (!mCreated) return;
        if (!Graphics_isWebGPU()) return;

#ifdef ALLOLIB_WEBGPU
        auto* backend = dynamic_cast<WebGPUBackend*>(Graphics_getBackend());
        if (!backend) return;

        const float* view = g.viewMatrix().elems();
        const float* proj = g.projMatrix().elems();

        ParticleRenderParams rp = {};
        memcpy(rp.viewMatrix, view, 64);
        memcpy(rp.projMatrix, proj, 64);

        rp.cameraRightX = view[0];
        rp.cameraRightY = view[4];
        rp.cameraRightZ = view[8];
        rp._pad0 = 0.0f;

        rp.cameraUpX = view[1];
        rp.cameraUpY = view[5];
        rp.cameraUpZ = view[9];
        rp.shapeMode = (float)mShapeMode;

        mRenderParamsBuffer.upload(rp);

        backend->drawParticlesSoft(
            mParticleBuffer.handle(),
            mRenderParamsBuffer.handle(),
            mMaxParticles,
            fadeDistance
        );
#endif
    }

    // Non-copyable
    ParticleSystem(const ParticleSystem&) = delete;
    ParticleSystem& operator=(const ParticleSystem&) = delete;

    // Movable
    ParticleSystem(ParticleSystem&& other) noexcept
        : mParticleBuffer(std::move(other.mParticleBuffer)),
          mSimParamsBuffer(std::move(other.mSimParamsBuffer)),
          mEmitParamsBuffer(std::move(other.mEmitParamsBuffer)),
          mRenderParamsBuffer(std::move(other.mRenderParamsBuffer)),
          mAtomicCounterBuffer(std::move(other.mAtomicCounterBuffer)),
          mUpdateShader(std::move(other.mUpdateShader)),
          mEmitShader(std::move(other.mEmitShader)),
          mBackend(other.mBackend),
          mMaxParticles(other.mMaxParticles),
          mTime(other.mTime),
          mEmitAccumulator(other.mEmitAccumulator),
          mGravity(other.mGravity),
          mDamping(other.mDamping),
          mNoiseScale(other.mNoiseScale),
          mNoiseStrength(other.mNoiseStrength),
          mEmitters(std::move(other.mEmitters)),
          mShapeMode(other.mShapeMode),
          mCreated(other.mCreated) {
        other.mBackend = nullptr;
        other.mCreated = false;
    }

    ParticleSystem& operator=(ParticleSystem&& other) noexcept {
        if (this != &other) {
            destroy();
            mParticleBuffer = std::move(other.mParticleBuffer);
            mSimParamsBuffer = std::move(other.mSimParamsBuffer);
            mEmitParamsBuffer = std::move(other.mEmitParamsBuffer);
            mRenderParamsBuffer = std::move(other.mRenderParamsBuffer);
            mAtomicCounterBuffer = std::move(other.mAtomicCounterBuffer);
            mUpdateShader = std::move(other.mUpdateShader);
            mEmitShader = std::move(other.mEmitShader);
            mBackend = other.mBackend;
            mMaxParticles = other.mMaxParticles;
            mTime = other.mTime;
            mEmitAccumulator = other.mEmitAccumulator;
            mGravity = other.mGravity;
            mDamping = other.mDamping;
            mNoiseScale = other.mNoiseScale;
            mNoiseStrength = other.mNoiseStrength;
            mEmitters = std::move(other.mEmitters);
            mShapeMode = other.mShapeMode;
            mCreated = other.mCreated;
            other.mBackend = nullptr;
            other.mCreated = false;
        }
        return *this;
    }
};

} // namespace al

#endif // AL_WEBGPU_PARTICLES_HPP
