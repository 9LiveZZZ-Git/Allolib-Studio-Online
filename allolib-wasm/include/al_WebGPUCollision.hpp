/**
 * AlloLib Studio Online - GPU SDF Collisions (Phase 6)
 *
 * Signed distance function collision with primitive shapes.
 * Particles bounce off surfaces defined by SDFs.
 * Up to 8 colliders active simultaneously.
 *
 * Collider types:
 *   0 = Sphere:  distance to sphere surface
 *   1 = Box:     distance to axis-aligned box surface
 *   2 = Plane:   distance to infinite plane
 *   3 = Capsule: distance to capsule (line segment + radius)
 *
 * Usage:
 *   SDFCollisionSystem col;
 *   col.create(*backend());
 *   col.addPlane(Vec3f(0,-1,0), Vec3f(0,1,0));     // ground
 *   col.addSphere(Vec3f(0,1,0), 0.5f);             // sphere obstacle
 *   // In onAnimate:
 *   col.apply(particles, dt);
 *
 * Header-only. Requires: al_WebGPUCompute.hpp, al_WebGPUBuffer.hpp, al_WebGPUParticles.hpp
 */

#ifndef AL_WEBGPU_COLLISION_HPP
#define AL_WEBGPU_COLLISION_HPP

#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include "al_WebGPUParticles.hpp"
#include "al/math/al_Vec.hpp"
#include <cstdio>
#include <cstring>

namespace al {

// ── GPU-Aligned Structs ─────────────────────────────────────────────────────

struct SDFColliderDesc {
    float posX, posY, posZ;     // collider center / point on plane / capsule start
    uint32_t type;              // 0=sphere, 1=box, 2=plane, 3=capsule
    float paramA, paramB, paramC; // type-specific (radius, half-extents, normal, etc.)
    float restitution;          // bounce factor (0-1)
    float friction;             // friction coefficient
    float dirX, dirY, dirZ;    // normal (plane), end point (capsule), unused (sphere/box)
};
static_assert(sizeof(SDFColliderDesc) == 48, "SDFColliderDesc must be 48 bytes");

struct SDFCollisionParams {
    uint32_t colliderCount;
    uint32_t particleCount;
    float deltaTime;
    float pad;
    SDFColliderDesc colliders[8]; // 8 * 48 = 384 bytes
};
static_assert(sizeof(SDFCollisionParams) == 400, "SDFCollisionParams must be 400 bytes");

// ── WGSL Compute Shader ─────────────────────────────────────────────────────

static const char* kSDFCollisionWGSL = R"(
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

struct ColliderDesc {
    posX: f32,
    posY: f32,
    posZ: f32,
    colliderType: u32,
    paramA: f32,
    paramB: f32,
    paramC: f32,
    restitution: f32,
    friction: f32,
    dirX: f32,
    dirY: f32,
    dirZ: f32,
}

struct Params {
    colliderCount: u32,
    particleCount: u32,
    deltaTime: f32,
    pad: f32,
    colliders: array<ColliderDesc, 8>,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: Params;

// SDF: Sphere
fn sdfSphere(p: vec3f, center: vec3f, radius: f32) -> f32 {
    return length(p - center) - radius;
}

fn sdfSphereNormal(p: vec3f, center: vec3f) -> vec3f {
    return normalize(p - center);
}

// SDF: Box (axis-aligned)
fn sdfBox(p: vec3f, center: vec3f, halfExtents: vec3f) -> f32 {
    let d = abs(p - center) - halfExtents;
    return length(max(d, vec3f(0.0))) + min(max(d.x, max(d.y, d.z)), 0.0);
}

fn sdfBoxNormal(p: vec3f, center: vec3f, halfExtents: vec3f) -> vec3f {
    let d = abs(p - center) - halfExtents;
    let s = sign(p - center);
    // Find the closest face
    if (d.x > d.y && d.x > d.z) { return vec3f(s.x, 0.0, 0.0); }
    if (d.y > d.z) { return vec3f(0.0, s.y, 0.0); }
    return vec3f(0.0, 0.0, s.z);
}

// SDF: Plane
fn sdfPlane(p: vec3f, point: vec3f, normal: vec3f) -> f32 {
    return dot(p - point, normal);
}

// SDF: Capsule (line segment + radius)
fn sdfCapsule(p: vec3f, a: vec3f, b: vec3f, radius: f32) -> f32 {
    let ab = b - a;
    let ap = p - a;
    let t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
    let closest = a + ab * t;
    return length(p - closest) - radius;
}

fn sdfCapsuleNormal(p: vec3f, a: vec3f, b: vec3f) -> vec3f {
    let ab = b - a;
    let ap = p - a;
    let t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
    let closest = a + ab * t;
    return normalize(p - closest);
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;
    if (index >= params.particleCount) { return; }

    var p = particles[index];
    if (p.age >= p.lifetime) { return; }

    for (var i = 0u; i < params.colliderCount; i++) {
        let col = params.colliders[i];
        let colPos = vec3f(col.posX, col.posY, col.posZ);
        let colDir = vec3f(col.dirX, col.dirY, col.dirZ);
        var dist: f32;
        var normal: vec3f;

        switch col.colliderType {
            case 0u: { // Sphere
                let radius = col.paramA;
                dist = sdfSphere(p.position, colPos, radius);
                normal = sdfSphereNormal(p.position, colPos);
            }
            case 1u: { // Box
                let halfExtents = vec3f(col.paramA, col.paramB, col.paramC);
                dist = sdfBox(p.position, colPos, halfExtents);
                normal = sdfBoxNormal(p.position, colPos, halfExtents);
            }
            case 2u: { // Plane
                let planeNormal = normalize(colDir);
                dist = sdfPlane(p.position, colPos, planeNormal);
                normal = planeNormal;
            }
            case 3u: { // Capsule
                let endPoint = colDir;  // dir stores end point for capsule
                let radius = col.paramA;
                dist = sdfCapsule(p.position, colPos, endPoint, radius);
                normal = sdfCapsuleNormal(p.position, colPos, endPoint);
            }
            default: { continue; }
        }

        // If inside the collider (negative distance), push out and reflect
        if (dist < 0.0) {
            // Push particle out to surface
            p.position += normal * (-dist + 0.001);

            // Reflect velocity
            let vn = dot(p.velocity, normal);
            if (vn < 0.0) {
                // Decompose velocity into normal and tangent components
                let velNormal = normal * vn;
                let velTangent = p.velocity - velNormal;

                // Apply restitution to normal, friction to tangent
                p.velocity = velTangent * (1.0 - col.friction) - velNormal * col.restitution;
            }
        }
    }

    particles[index] = p;
}
)";

// ── SDFCollisionSystem Class ────────────────────────────────────────────────

class SDFCollisionSystem {
    ComputeShader mShader;
    GPUUniformBuffer<SDFCollisionParams> mParamsBuffer;
    GraphicsBackend* mBackend = nullptr;
    SDFCollisionParams mParams = {};
    bool mCreated = false;

public:
    SDFCollisionSystem() = default;

    void create(GraphicsBackend& backend) {
        mBackend = &backend;
        mShader.create(backend, kSDFCollisionWGSL);
        mParamsBuffer.create(backend);
        memset(&mParams, 0, sizeof(mParams));
        mCreated = true;
        printf("[SDFCollisionSystem] Created\n");
    }

    void destroy() {
        mShader.destroy();
        mParamsBuffer.destroy();
        mCreated = false;
    }

    ~SDFCollisionSystem() { destroy(); }

    /// Add a sphere collider. Returns index or -1 if full.
    int addSphere(Vec3f center, float radius, float restitution = 0.5f) {
        if (mParams.colliderCount >= 8) return -1;
        int idx = (int)mParams.colliderCount;
        auto& c = mParams.colliders[idx];
        c.posX = center.x; c.posY = center.y; c.posZ = center.z;
        c.type = 0;
        c.paramA = radius; c.paramB = 0; c.paramC = 0;
        c.restitution = restitution;
        c.friction = 0.1f;
        c.dirX = 0; c.dirY = 0; c.dirZ = 0;
        mParams.colliderCount++;
        return idx;
    }

    /// Add a box collider. Returns index or -1 if full.
    int addBox(Vec3f center, Vec3f halfExtents, float restitution = 0.5f) {
        if (mParams.colliderCount >= 8) return -1;
        int idx = (int)mParams.colliderCount;
        auto& c = mParams.colliders[idx];
        c.posX = center.x; c.posY = center.y; c.posZ = center.z;
        c.type = 1;
        c.paramA = halfExtents.x; c.paramB = halfExtents.y; c.paramC = halfExtents.z;
        c.restitution = restitution;
        c.friction = 0.1f;
        c.dirX = 0; c.dirY = 0; c.dirZ = 0;
        mParams.colliderCount++;
        return idx;
    }

    /// Add a plane collider. Returns index or -1 if full.
    int addPlane(Vec3f point, Vec3f normal, float restitution = 0.5f) {
        if (mParams.colliderCount >= 8) return -1;
        int idx = (int)mParams.colliderCount;
        auto& c = mParams.colliders[idx];
        c.posX = point.x; c.posY = point.y; c.posZ = point.z;
        c.type = 2;
        c.paramA = 0; c.paramB = 0; c.paramC = 0;
        c.restitution = restitution;
        c.friction = 0.1f;
        c.dirX = normal.x; c.dirY = normal.y; c.dirZ = normal.z;
        mParams.colliderCount++;
        return idx;
    }

    /// Add a capsule collider. Returns index or -1 if full.
    int addCapsule(Vec3f a, Vec3f b, float radius, float restitution = 0.5f) {
        if (mParams.colliderCount >= 8) return -1;
        int idx = (int)mParams.colliderCount;
        auto& c = mParams.colliders[idx];
        c.posX = a.x; c.posY = a.y; c.posZ = a.z;
        c.type = 3;
        c.paramA = radius; c.paramB = 0; c.paramC = 0;
        c.restitution = restitution;
        c.friction = 0.1f;
        c.dirX = b.x; c.dirY = b.y; c.dirZ = b.z;
        mParams.colliderCount++;
        return idx;
    }

    /// Update a collider's position
    void updateCollider(int index, Vec3f pos) {
        if (index < 0 || index >= (int)mParams.colliderCount) return;
        auto& c = mParams.colliders[index];
        c.posX = pos.x; c.posY = pos.y; c.posZ = pos.z;
    }

    /// Update a collider's direction/normal/endpoint
    void updateColliderDir(int index, Vec3f dir) {
        if (index < 0 || index >= (int)mParams.colliderCount) return;
        auto& c = mParams.colliders[index];
        c.dirX = dir.x; c.dirY = dir.y; c.dirZ = dir.z;
    }

    /// Remove a collider by index (swaps with last)
    void removeCollider(int index) {
        if (index < 0 || index >= (int)mParams.colliderCount) return;
        int last = (int)mParams.colliderCount - 1;
        if (index != last) {
            mParams.colliders[index] = mParams.colliders[last];
        }
        memset(&mParams.colliders[last], 0, sizeof(SDFColliderDesc));
        mParams.colliderCount--;
    }

    /// Set friction for a collider
    void setFriction(int index, float f) {
        if (index < 0 || index >= (int)mParams.colliderCount) return;
        mParams.colliders[index].friction = f;
    }

    /// Set restitution for a collider
    void setRestitution(int index, float r) {
        if (index < 0 || index >= (int)mParams.colliderCount) return;
        mParams.colliders[index].restitution = r;
    }

    /// Apply collisions to the particle system
    void apply(ParticleSystem& ps, float dt) {
        if (!mCreated || !mBackend || mParams.colliderCount == 0) return;

        mParams.particleCount = (uint32_t)ps.maxParticles();
        mParams.deltaTime = dt;
        mParams.pad = 0;

        mParamsBuffer.upload(mParams);

        mShader.bind(0, ps.particleBufferHandle());
        mShader.bindUniform(1, mParamsBuffer.handle());

        int groups = (ps.maxParticles() + 255) / 256;
        mShader.dispatch(groups);
    }

    uint32_t colliderCount() const { return mParams.colliderCount; }

    // Non-copyable, movable
    SDFCollisionSystem(const SDFCollisionSystem&) = delete;
    SDFCollisionSystem& operator=(const SDFCollisionSystem&) = delete;
    SDFCollisionSystem(SDFCollisionSystem&&) = default;
    SDFCollisionSystem& operator=(SDFCollisionSystem&&) = default;
};

} // namespace al

#endif // AL_WEBGPU_COLLISION_HPP
