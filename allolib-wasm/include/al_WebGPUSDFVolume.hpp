/**
 * AlloLib Studio Online - WebGPU SDF Volume
 *
 * 3D storage texture holding SDF (Signed Distance Field) values.
 * Compute shader bakes analytical SDF primitives into the volume
 * with CSG operations (union, subtract, smooth union/subtract).
 *
 * Header-only for ease of use in examples.
 */

#ifndef AL_WEBGPU_SDF_VOLUME_HPP
#define AL_WEBGPU_SDF_VOLUME_HPP

#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include "al_WebGraphicsBackend.hpp"
#include <vector>
#include <cmath>
#include <cstdint>
#include <algorithm>

namespace al {

/// SDF primitive types
enum class SDFShape : uint32_t {
    Sphere = 0,
    Box = 1,
    Capsule = 2,
    Plane = 3
};

/// CSG combination modes
enum class SDFOp : uint32_t {
    Union = 0,
    Subtract = 1,
    SmoothUnion = 2,
    SmoothSubtract = 3
};

/// GPU-aligned SDF operation (48 bytes)
struct SDFOperation {
    float posX, posY, posZ, radius;     // xyz=center, w=radius (or param)
    float paramX, paramY, paramZ;       // half-extents, direction, or endpoint
    float smoothness;                   // smooth union/subtract factor
    uint32_t type;                      // SDFShape enum
    uint32_t combineOp;                 // SDFOp enum
    float _pad[2];
};
static_assert(sizeof(SDFOperation) == 48, "SDFOperation must be 48 bytes");

/// GPU-aligned volume parameters (48 bytes)
struct SDFVolumeParams {
    float worldMinX, worldMinY, worldMinZ;
    float voxelSize;
    float worldMaxX, worldMaxY, worldMaxZ;
    uint32_t opCount;
    uint32_t resolution;
    float _pad[3];
};
static_assert(sizeof(SDFVolumeParams) == 48, "SDFVolumeParams must be 48 bytes");

// ── WGSL Compute Shader ─────────────────────────────────────────────────────

static const char* kSDFVolumeBakeShader = R"(
struct SDFOperation {
    posAndRadius: vec4f,    // xyz=center, w=radius
    params: vec4f,          // xyz=halfExtent/direction, w=smoothness
    typeAndOp: vec2u,       // x=type, y=combineOp
    _pad: vec2f,
}

struct SDFVolumeParams {
    worldMin: vec3f,
    voxelSize: f32,
    worldMax: vec3f,
    opCount: u32,
    resolution: u32,
    _pad: vec3f,
}

@group(0) @binding(0) var volume: texture_storage_3d<r32float, write>;
@group(0) @binding(1) var<uniform> params: SDFVolumeParams;
@group(0) @binding(2) var<storage, read> ops: array<SDFOperation>;

fn sdfSphere(p: vec3f, center: vec3f, radius: f32) -> f32 {
    return length(p - center) - radius;
}

fn sdfBox(p: vec3f, center: vec3f, halfExtent: vec3f) -> f32 {
    let d = abs(p - center) - halfExtent;
    return length(max(d, vec3f(0.0))) + min(max(d.x, max(d.y, d.z)), 0.0);
}

fn sdfCapsule(p: vec3f, a: vec3f, b: vec3f, radius: f32) -> f32 {
    let ab = b - a;
    let ap = p - a;
    let t = clamp(dot(ap, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
    let closest = a + ab * t;
    return length(p - closest) - radius;
}

fn sdfPlane(p: vec3f, point: vec3f, normal: vec3f) -> f32 {
    return dot(p - point, normalize(normal));
}

fn smoothMin(a: f32, b: f32, k: f32) -> f32 {
    let h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.0001), 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

fn smoothMax(a: f32, b: f32, k: f32) -> f32 {
    return -smoothMin(-a, -b, k);
}

fn evaluateSDF(p: vec3f, op: SDFOperation) -> f32 {
    let center = op.posAndRadius.xyz;
    let radius = op.posAndRadius.w;
    let shape = op.typeAndOp.x;

    if (shape == 0u) {
        return sdfSphere(p, center, radius);
    } else if (shape == 1u) {
        return sdfBox(p, center, op.params.xyz);
    } else if (shape == 2u) {
        return sdfCapsule(p, center, op.params.xyz, radius);
    } else {
        return sdfPlane(p, center, normalize(op.params.xyz));
    }
}

fn combineSDF(current: f32, newDist: f32, combineOp: u32, smoothness: f32) -> f32 {
    if (combineOp == 0u) {
        return min(current, newDist);                        // Union
    } else if (combineOp == 1u) {
        return max(current, -newDist);                       // Subtract
    } else if (combineOp == 2u) {
        return smoothMin(current, newDist, smoothness);      // Smooth Union
    } else {
        return smoothMax(current, -newDist, smoothness);     // Smooth Subtract
    }
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let res = params.resolution;
    if (gid.x >= res || gid.y >= res || gid.z >= res) { return; }

    // Map voxel to world position
    let uvw = vec3f(gid) / f32(res - 1u);
    let worldPos = params.worldMin + uvw * (params.worldMax - params.worldMin);

    // Evaluate all SDF operations
    var dist = 1000.0;  // Start far away
    for (var i = 0u; i < params.opCount; i++) {
        let op = ops[i];
        let d = evaluateSDF(worldPos, op);
        if (i == 0u) {
            dist = d;
        } else {
            dist = combineSDF(dist, d, op.typeAndOp.y, op.params.w);
        }
    }

    textureStore(volume, gid, vec4f(dist, 0.0, 0.0, 0.0));
}
)";

// ── Partial rebake shader (dispatched for sub-region only) ───────────────────

static const char* kSDFVolumePartialBakeShader = R"(
struct SDFOperation {
    posAndRadius: vec4f,
    params: vec4f,
    typeAndOp: vec2u,
    _pad: vec2f,
}

struct SDFVolumeParams {
    worldMin: vec3f,
    voxelSize: f32,
    worldMax: vec3f,
    opCount: u32,
    resolution: u32,
    _pad: vec3f,
}

struct RegionParams {
    regionMin: vec3u,
    _pad0: u32,
    regionMax: vec3u,
    _pad1: u32,
}

@group(0) @binding(0) var volume: texture_storage_3d<r32float, write>;
@group(0) @binding(1) var<uniform> params: SDFVolumeParams;
@group(0) @binding(2) var<storage, read> ops: array<SDFOperation>;
@group(0) @binding(3) var<uniform> region: RegionParams;

fn sdfSphere(p: vec3f, center: vec3f, radius: f32) -> f32 {
    return length(p - center) - radius;
}

fn sdfBox(p: vec3f, center: vec3f, halfExtent: vec3f) -> f32 {
    let d = abs(p - center) - halfExtent;
    return length(max(d, vec3f(0.0))) + min(max(d.x, max(d.y, d.z)), 0.0);
}

fn sdfCapsule(p: vec3f, a: vec3f, b: vec3f, radius: f32) -> f32 {
    let ab = b - a;
    let ap = p - a;
    let t = clamp(dot(ap, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
    return length(p - (a + ab * t)) - radius;
}

fn sdfPlane(p: vec3f, point: vec3f, normal: vec3f) -> f32 {
    return dot(p - point, normalize(normal));
}

fn smoothMin(a: f32, b: f32, k: f32) -> f32 {
    let h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.0001), 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

fn smoothMax(a: f32, b: f32, k: f32) -> f32 {
    return -smoothMin(-a, -b, k);
}

fn evaluateSDF(p: vec3f, op: SDFOperation) -> f32 {
    let center = op.posAndRadius.xyz;
    let radius = op.posAndRadius.w;
    let shape = op.typeAndOp.x;
    if (shape == 0u) { return sdfSphere(p, center, radius); }
    else if (shape == 1u) { return sdfBox(p, center, op.params.xyz); }
    else if (shape == 2u) { return sdfCapsule(p, center, op.params.xyz, radius); }
    else { return sdfPlane(p, center, normalize(op.params.xyz)); }
}

fn combineSDF(current: f32, newDist: f32, combineOp: u32, smoothness: f32) -> f32 {
    if (combineOp == 0u) { return min(current, newDist); }
    else if (combineOp == 1u) { return max(current, -newDist); }
    else if (combineOp == 2u) { return smoothMin(current, newDist, smoothness); }
    else { return smoothMax(current, -newDist, smoothness); }
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let voxel = region.regionMin + gid;
    let res = params.resolution;
    if (voxel.x >= min(region.regionMax.x, res) ||
        voxel.y >= min(region.regionMax.y, res) ||
        voxel.z >= min(region.regionMax.z, res)) { return; }

    let uvw = vec3f(voxel) / f32(res - 1u);
    let worldPos = params.worldMin + uvw * (params.worldMax - params.worldMin);

    var dist = 1000.0;
    for (var i = 0u; i < params.opCount; i++) {
        let op = ops[i];
        let d = evaluateSDF(worldPos, op);
        if (i == 0u) { dist = d; }
        else { dist = combineSDF(dist, d, op.typeAndOp.y, op.params.w); }
    }

    textureStore(volume, voxel, vec4f(dist, 0.0, 0.0, 0.0));
}
)";

// ── C++ SDFVolume Class ──────────────────────────────────────────────────────

class SDFVolume {
    GraphicsBackend* mBackend = nullptr;
    ComputeShader mBakeShader;
    ComputeShader mPartialBakeShader;
    GPUUniformBuffer<SDFVolumeParams> mParamsBuffer;
    GPUBuffer<SDFOperation> mOpsBuffer;
    TextureHandle mVolumeTexture;

    std::vector<SDFOperation> mOps;
    SDFVolumeParams mParams;
    int mResolution = 128;
    float mWorldExtent = 4.0f;
    float mDefaultSmoothness = 0.1f;
    bool mDirty = true;

    static const int MAX_OPS = 128;

public:
    SDFVolume() = default;

    /// Create the SDF volume with given resolution
    void create(GraphicsBackend& backend, int resolution = 128) {
        mBackend = &backend;
        mResolution = resolution;
        float half = mWorldExtent / 2.0f;

        // Volume params
        mParams.worldMinX = -half;
        mParams.worldMinY = -half;
        mParams.worldMinZ = -half;
        mParams.worldMaxX = half;
        mParams.worldMaxY = half;
        mParams.worldMaxZ = half;
        mParams.voxelSize = mWorldExtent / (float)resolution;
        mParams.resolution = resolution;
        mParams.opCount = 0;
        mParams._pad[0] = mParams._pad[1] = mParams._pad[2] = 0;

        // Create 3D storage texture (R32F)
        TextureDesc texDesc;
        texDesc.width = resolution;
        texDesc.height = resolution;
        texDesc.depth = resolution;
        texDesc.format = PixelFormat::R32F;
        texDesc.storageTexture = true;
        texDesc.minFilter = FilterMode::Linear;
        texDesc.magFilter = FilterMode::Linear;
        texDesc.wrapS = WrapMode::ClampToEdge;
        texDesc.wrapT = WrapMode::ClampToEdge;
        texDesc.wrapR = WrapMode::ClampToEdge;
        mVolumeTexture = backend.createTexture(texDesc, nullptr);

        // Create compute shaders
        mBakeShader.create(backend, kSDFVolumeBakeShader);
        mPartialBakeShader.create(backend, kSDFVolumePartialBakeShader);

        // Create buffers
        mParamsBuffer.create(backend);
        // Pre-allocate ops buffer
        std::vector<SDFOperation> emptyOps(MAX_OPS);
        mOpsBuffer.create(backend, MAX_OPS, emptyOps.data());
    }

    /// Add a sphere SDF primitive
    int addSphere(float cx, float cy, float cz, float radius,
                  SDFOp op = SDFOp::Union) {
        if ((int)mOps.size() >= MAX_OPS) return -1;
        SDFOperation sdfOp = {};
        sdfOp.posX = cx; sdfOp.posY = cy; sdfOp.posZ = cz;
        sdfOp.radius = radius;
        sdfOp.type = (uint32_t)SDFShape::Sphere;
        sdfOp.combineOp = (uint32_t)op;
        sdfOp.smoothness = mDefaultSmoothness;
        mOps.push_back(sdfOp);
        mDirty = true;
        return (int)mOps.size() - 1;
    }

    /// Add a box SDF primitive
    int addBox(float cx, float cy, float cz,
               float hx, float hy, float hz,
               SDFOp op = SDFOp::Union) {
        if ((int)mOps.size() >= MAX_OPS) return -1;
        SDFOperation sdfOp = {};
        sdfOp.posX = cx; sdfOp.posY = cy; sdfOp.posZ = cz;
        sdfOp.paramX = hx; sdfOp.paramY = hy; sdfOp.paramZ = hz;
        sdfOp.type = (uint32_t)SDFShape::Box;
        sdfOp.combineOp = (uint32_t)op;
        sdfOp.smoothness = mDefaultSmoothness;
        mOps.push_back(sdfOp);
        mDirty = true;
        return (int)mOps.size() - 1;
    }

    /// Add a capsule SDF primitive (line segment + radius)
    int addCapsule(float ax, float ay, float az,
                   float bx, float by, float bz,
                   float radius, SDFOp op = SDFOp::Union) {
        if ((int)mOps.size() >= MAX_OPS) return -1;
        SDFOperation sdfOp = {};
        sdfOp.posX = ax; sdfOp.posY = ay; sdfOp.posZ = az;
        sdfOp.radius = radius;
        sdfOp.paramX = bx; sdfOp.paramY = by; sdfOp.paramZ = bz;
        sdfOp.type = (uint32_t)SDFShape::Capsule;
        sdfOp.combineOp = (uint32_t)op;
        sdfOp.smoothness = mDefaultSmoothness;
        mOps.push_back(sdfOp);
        mDirty = true;
        return (int)mOps.size() - 1;
    }

    /// Add a plane SDF primitive
    int addPlane(float px, float py, float pz,
                 float nx, float ny, float nz,
                 SDFOp op = SDFOp::Union) {
        if ((int)mOps.size() >= MAX_OPS) return -1;
        SDFOperation sdfOp = {};
        sdfOp.posX = px; sdfOp.posY = py; sdfOp.posZ = pz;
        sdfOp.paramX = nx; sdfOp.paramY = ny; sdfOp.paramZ = nz;
        sdfOp.type = (uint32_t)SDFShape::Plane;
        sdfOp.combineOp = (uint32_t)op;
        sdfOp.smoothness = mDefaultSmoothness;
        mOps.push_back(sdfOp);
        mDirty = true;
        return (int)mOps.size() - 1;
    }

    /// Remove an SDF operation by index (swaps with last)
    void removeOperation(int index) {
        if (index < 0 || index >= (int)mOps.size()) return;
        if (index != (int)mOps.size() - 1) {
            mOps[index] = mOps.back();
        }
        mOps.pop_back();
        mDirty = true;
    }

    /// Update position of an existing operation
    void updateOperation(int index, float x, float y, float z) {
        if (index < 0 || index >= (int)mOps.size()) return;
        mOps[index].posX = x;
        mOps[index].posY = y;
        mOps[index].posZ = z;
        mDirty = true;
    }

    /// Set global smoothness for smooth CSG operations
    void setSmoothness(float k) {
        mDefaultSmoothness = k;
        for (auto& op : mOps) {
            op.smoothness = k;
        }
        mDirty = true;
    }

    /// Set world extent (default 4.0 = [-2, 2])
    void setWorldExtent(float extent) {
        mWorldExtent = extent;
        float half = extent / 2.0f;
        mParams.worldMinX = -half; mParams.worldMinY = -half; mParams.worldMinZ = -half;
        mParams.worldMaxX =  half; mParams.worldMaxY =  half; mParams.worldMaxZ =  half;
        mParams.voxelSize = extent / (float)mResolution;
        mDirty = true;
    }

    /// Clear all operations
    void clear() {
        mOps.clear();
        mDirty = true;
    }

    /// Bake all SDF operations into the volume texture (full dispatch)
    void bake() {
        if (!mBackend || mOps.empty()) return;

        mParams.opCount = (uint32_t)mOps.size();
        mParamsBuffer.upload(mParams);
        mOpsBuffer.upload(mOps.data(), mOps.size());

        int groups = (mResolution + 3) / 4;
        mBakeShader.bindTexture(0, mVolumeTexture);
        mBakeShader.bindUniform(1, mParamsBuffer.handle());
        mBakeShader.bind(2, mOpsBuffer.handle());
        mBakeShader.dispatch(groups, groups, groups);
        mBackend->computeBarrier();
        mDirty = false;
    }

    /// Bake only the region affected by a brush at (wx, wy, wz) with given radius
    void bakeRegion(float wx, float wy, float wz, float brushRadius) {
        if (!mBackend || mOps.empty()) return;

        mParams.opCount = (uint32_t)mOps.size();
        mParamsBuffer.upload(mParams);
        mOpsBuffer.upload(mOps.data(), mOps.size());

        // Compute voxel region for the brush
        float half = mWorldExtent / 2.0f;
        float invSize = (float)mResolution / mWorldExtent;
        float margin = brushRadius * 1.5f;

        int minX = std::max(0, std::min(mResolution, (int)((wx - margin + half) * invSize)));
        int minY = std::max(0, std::min(mResolution, (int)((wy - margin + half) * invSize)));
        int minZ = std::max(0, std::min(mResolution, (int)((wz - margin + half) * invSize)));
        int maxX = std::min(mResolution, (int)((wx + margin + half) * invSize) + 1);
        int maxY = std::min(mResolution, (int)((wy + margin + half) * invSize) + 1);
        int maxZ = std::min(mResolution, (int)((wz + margin + half) * invSize) + 1);

        if (minX >= maxX || minY >= maxY || minZ >= maxZ) return;

        struct RegionParams {
            uint32_t minX, minY, minZ, _pad0;
            uint32_t maxX, maxY, maxZ, _pad1;
        };
        RegionParams rp;
        rp.minX = minX; rp.minY = minY; rp.minZ = minZ; rp._pad0 = 0;
        rp.maxX = maxX; rp.maxY = maxY; rp.maxZ = maxZ; rp._pad1 = 0;

        // Need a separate uniform buffer for region params
        // Use a temporary buffer (or cache it)
        BufferHandle regionBuf = mBackend->createBuffer(
            BufferType::Uniform, BufferUsage::Dynamic, &rp, sizeof(rp));

        int groupsX = (maxX - minX + 3) / 4;
        int groupsY = (maxY - minY + 3) / 4;
        int groupsZ = (maxZ - minZ + 3) / 4;

        mPartialBakeShader.bindTexture(0, mVolumeTexture);
        mPartialBakeShader.bindUniform(1, mParamsBuffer.handle());
        mPartialBakeShader.bind(2, mOpsBuffer.handle());
        mPartialBakeShader.bindUniform(3, regionBuf);
        mPartialBakeShader.dispatch(groupsX, groupsY, groupsZ);
        mBackend->computeBarrier();

        mBackend->destroyBuffer(regionBuf);
        mDirty = false;
    }

    /// Check if volume needs rebaking
    bool dirty() const { return mDirty; }

    /// Get the volume texture handle
    TextureHandle volumeTexture() const { return mVolumeTexture; }

    /// Get the volume resolution
    int resolution() const { return mResolution; }

    /// Get world-space AABB bounds
    float worldMinX() const { return mParams.worldMinX; }
    float worldMinY() const { return mParams.worldMinY; }
    float worldMinZ() const { return mParams.worldMinZ; }
    float worldMaxX() const { return mParams.worldMaxX; }
    float worldMaxY() const { return mParams.worldMaxY; }
    float worldMaxZ() const { return mParams.worldMaxZ; }
    float worldExtent() const { return mWorldExtent; }
    float voxelSize() const { return mParams.voxelSize; }

    /// Get the params buffer (for renderer)
    BufferHandle paramsBufferHandle() const { return mParamsBuffer.handle(); }

    /// Get operation count
    int opCount() const { return (int)mOps.size(); }

    /// Get operations (for undo/redo)
    const std::vector<SDFOperation>& operations() const { return mOps; }

    /// Set operations (for undo/redo restore)
    void setOperations(const std::vector<SDFOperation>& ops) {
        mOps.assign(ops.begin(), ops.begin() + std::min(ops.size(), (size_t)MAX_OPS));
        mDirty = true;
    }

    // Non-copyable
    SDFVolume(const SDFVolume&) = delete;
    SDFVolume& operator=(const SDFVolume&) = delete;
};

} // namespace al

#endif // AL_WEBGPU_SDF_VOLUME_HPP
