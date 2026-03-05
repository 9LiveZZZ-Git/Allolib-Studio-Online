/**
 * AlloLib Studio Online - GPU Vector Fields (Phase 6)
 *
 * Analytical force fields applied to particles each frame via compute shader.
 * Up to 8 fields can be active simultaneously. Each field has a type,
 * position, direction, and type-specific parameters.
 *
 * Field types:
 *   0 = Vortex:      Swirling force around an axis
 *   1 = Attractor:   Pull toward a center point (gravity-like)
 *   2 = Directional: Constant force in a direction (wind)
 *   3 = Turbulence:  Noise-based chaotic displacement
 *
 * Usage:
 *   VectorFieldSystem vf;
 *   vf.create(*backend());
 *   vf.addField(0, Vec3f(0,0,0), Vec3f(0,1,0), 5.0f);  // vortex
 *   vf.addField(1, Vec3f(0,2,0), Vec3f(0,0,0), 10.0f);  // attractor
 *   // In onAnimate:
 *   vf.apply(particles, dt);
 *
 * Header-only. Requires: al_WebGPUCompute.hpp, al_WebGPUBuffer.hpp, al_WebGPUParticles.hpp
 */

#ifndef AL_WEBGPU_VECTOR_FIELD_HPP
#define AL_WEBGPU_VECTOR_FIELD_HPP

#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include "al_WebGPUParticles.hpp"
#include "al/math/al_Vec.hpp"
#include <cstdio>
#include <cstring>

namespace al {

// ── GPU-Aligned Structs ─────────────────────────────────────────────────────

struct VectorFieldDesc {
    float posX, posY, posZ;     // field center position
    uint32_t type;              // 0=vortex, 1=attractor, 2=directional, 3=turbulence
    float paramA, paramB, paramC, paramD; // type-specific params
    float dirX, dirY, dirZ;     // direction (for directional/vortex axis)
    float pad;
};
static_assert(sizeof(VectorFieldDesc) == 48, "VectorFieldDesc must be 48 bytes");

struct VectorFieldParams {
    uint32_t fieldCount;
    uint32_t particleCount;
    float deltaTime;
    float time;
    VectorFieldDesc fields[8]; // 8 * 48 = 384 bytes
};
static_assert(sizeof(VectorFieldParams) == 400, "VectorFieldParams must be 400 bytes");

// ── WGSL Compute Shader ─────────────────────────────────────────────────────

static const char* kVectorFieldWGSL = R"(
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

struct FieldDesc {
    pos: vec3f,
    fieldType: u32,
    paramA: f32,
    paramB: f32,
    paramC: f32,
    paramD: f32,
    dir: vec3f,
    pad: f32,
}

struct Params {
    fieldCount: u32,
    particleCount: u32,
    deltaTime: f32,
    time: f32,
    fields: array<FieldDesc, 8>,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;

// Simple hash-based noise for turbulence
fn hash3(p: vec3f) -> vec3f {
    var q = vec3f(
        dot(p, vec3f(127.1, 311.7, 74.7)),
        dot(p, vec3f(269.5, 183.3, 246.1)),
        dot(p, vec3f(113.5, 271.9, 124.6))
    );
    return fract(sin(q) * 43758.5453) * 2.0 - 1.0;
}

fn computeVortexForce(pos: vec3f, field: FieldDesc) -> vec3f {
    let toCenter = field.pos - pos;
    let dist = length(toCenter);
    let epsilon = 0.01;
    let axis = normalize(field.dir);
    let tangent = cross(axis, toCenter);
    let strength = field.paramA;                // paramA = strength
    let falloff = field.paramB + epsilon;       // paramB = falloff radius
    let attenuation = 1.0 / (1.0 + (dist * dist) / (falloff * falloff));
    return tangent * strength * attenuation;
}

fn computeAttractorForce(pos: vec3f, field: FieldDesc) -> vec3f {
    let toCenter = field.pos - pos;
    let dist2 = dot(toCenter, toCenter);
    let epsilon = 0.1;
    let strength = field.paramA;                // paramA = strength
    let dir = toCenter / sqrt(dist2 + epsilon);
    return dir * strength / (dist2 + epsilon);
}

fn computeDirectionalForce(field: FieldDesc) -> vec3f {
    let strength = field.paramA;                // paramA = strength
    return normalize(field.dir) * strength;
}

fn computeTurbulenceForce(pos: vec3f, field: FieldDesc, time: f32) -> vec3f {
    let strength = field.paramA;                // paramA = strength
    let scale = field.paramB + 0.01;            // paramB = noise scale
    let p = pos * scale + vec3f(time * 0.3);
    let n = hash3(p);
    return n * strength;
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;
    if (index >= params.particleCount) { return; }

    var p = particles[index];
    if (p.age >= p.lifetime) { return; }

    var totalForce = vec3f(0.0);

    for (var i = 0u; i < params.fieldCount; i++) {
        let field = params.fields[i];
        switch field.fieldType {
            case 0u: { totalForce += computeVortexForce(p.position, field); }
            case 1u: { totalForce += computeAttractorForce(p.position, field); }
            case 2u: { totalForce += computeDirectionalForce(field); }
            case 3u: { totalForce += computeTurbulenceForce(p.position, field, params.time); }
            default: {}
        }
    }

    p.velocity += totalForce * params.deltaTime;
    particles[index] = p;
}
)";

// ── VectorFieldSystem Class ─────────────────────────────────────────────────

class VectorFieldSystem {
    ComputeShader mShader;
    GPUUniformBuffer<VectorFieldParams> mParamsBuffer;
    GraphicsBackend* mBackend = nullptr;
    VectorFieldParams mParams = {};
    float mTime = 0.0f;
    bool mCreated = false;

public:
    VectorFieldSystem() = default;

    void create(GraphicsBackend& backend) {
        mBackend = &backend;
        mShader.create(backend, kVectorFieldWGSL);
        mParamsBuffer.create(backend);
        memset(&mParams, 0, sizeof(mParams));
        mCreated = true;
        printf("[VectorFieldSystem] Created\n");
    }

    void destroy() {
        mShader.destroy();
        mParamsBuffer.destroy();
        mCreated = false;
    }

    ~VectorFieldSystem() { destroy(); }

    /// Add a vector field. Returns the field index (0-7), or -1 if full.
    int addField(uint32_t type, Vec3f pos, Vec3f dir,
                 float a, float b = 0, float c = 0, float d = 0) {
        if (mParams.fieldCount >= 8) return -1;
        int idx = (int)mParams.fieldCount;
        auto& f = mParams.fields[idx];
        f.posX = pos.x; f.posY = pos.y; f.posZ = pos.z;
        f.type = type;
        f.paramA = a; f.paramB = b; f.paramC = c; f.paramD = d;
        f.dirX = dir.x; f.dirY = dir.y; f.dirZ = dir.z;
        f.pad = 0;
        mParams.fieldCount++;
        return idx;
    }

    /// Update an existing field's position, direction, and parameters
    void updateField(int index, Vec3f pos, Vec3f dir,
                     float a, float b = 0, float c = 0, float d = 0) {
        if (index < 0 || index >= (int)mParams.fieldCount) return;
        auto& f = mParams.fields[index];
        f.posX = pos.x; f.posY = pos.y; f.posZ = pos.z;
        f.paramA = a; f.paramB = b; f.paramC = c; f.paramD = d;
        f.dirX = dir.x; f.dirY = dir.y; f.dirZ = dir.z;
    }

    /// Remove a field by index (swaps with last)
    void removeField(int index) {
        if (index < 0 || index >= (int)mParams.fieldCount) return;
        int last = (int)mParams.fieldCount - 1;
        if (index != last) {
            mParams.fields[index] = mParams.fields[last];
        }
        memset(&mParams.fields[last], 0, sizeof(VectorFieldDesc));
        mParams.fieldCount--;
    }

    /// Apply all active fields to the particle system
    void apply(ParticleSystem& ps, float dt) {
        if (!mCreated || mParams.fieldCount == 0) return;

        mTime += dt;
        mParams.particleCount = (uint32_t)ps.maxParticles();
        mParams.deltaTime = dt;
        mParams.time = mTime;

        mParamsBuffer.upload(mParams);

        mShader.bind(0, ps.particleBufferHandle());
        mShader.bindUniform(1, mParamsBuffer.handle());

        int groups = (ps.maxParticles() + 255) / 256;
        mShader.dispatch(groups);
    }

    uint32_t fieldCount() const { return mParams.fieldCount; }

    // Non-copyable, movable
    VectorFieldSystem(const VectorFieldSystem&) = delete;
    VectorFieldSystem& operator=(const VectorFieldSystem&) = delete;
    VectorFieldSystem(VectorFieldSystem&&) = default;
    VectorFieldSystem& operator=(VectorFieldSystem&&) = default;
};

} // namespace al

#endif // AL_WEBGPU_VECTOR_FIELD_HPP
