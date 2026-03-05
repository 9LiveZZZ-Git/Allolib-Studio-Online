/**
 * AlloLib Studio Online - WebGPU SDF Sculpting System
 *
 * Interactive SDF sculpting via mouse input. Casts rays through the SDF volume
 * to find hit points, then places/subtracts SDF primitives at those positions.
 * Supports brush size, shape, operation type, and incremental rebaking.
 *
 * Header-only for ease of use in examples.
 */

#ifndef AL_WEBGPU_SDF_SCULPT_HPP
#define AL_WEBGPU_SDF_SCULPT_HPP

#include "al_WebGPUSDFVolume.hpp"
#include "al_WebGPUSDFRenderer.hpp"
#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include <vector>
#include <cstdio>
#include <cmath>

namespace al {

/// Ray cast result from GPU
struct SDFRayHit {
    float hitX, hitY, hitZ;
    float hitNormalX, hitNormalY, hitNormalZ;
    float distance;
    uint32_t didHit;
};

/// Ray cast input parameters (GPU-aligned, 128 bytes)
struct SDFRayCastParams {
    float invViewProj[16];
    float camPosX, camPosY, camPosZ, _pad0;
    float volumeMinX, volumeMinY, volumeMinZ, volumeExtent;
    float volumeMaxX, volumeMaxY, volumeMaxZ;
    uint32_t resolution;
    float uvX, uvY;     // Normalized screen coordinates [0,1]
    float _pad1[2];
};
static_assert(sizeof(SDFRayCastParams) == 128, "SDFRayCastParams must be 128 bytes");

// ── WGSL Ray Cast Compute Shader ─────────────────────────────────────────────

static const char* kSDFRayCastShader = R"(
struct RayCastParams {
    invViewProj: mat4x4f,
    camPos: vec3f,
    _pad0: f32,
    volumeMin: vec3f,
    volumeExtent: f32,
    volumeMax: vec3f,
    resolution: u32,
    screenUV: vec2f,
    _pad1: vec2f,
}

struct RayHit {
    hitPos: vec3f,
    hitNormal: vec3f,
    distance: f32,
    didHit: u32,
}

@group(0) @binding(0) var volume: texture_3d<f32>;
@group(0) @binding(1) var volumeSampler: sampler;
@group(0) @binding(2) var<uniform> params: RayCastParams;
@group(0) @binding(3) var<storage, read_write> result: RayHit;

fn worldToUV(p: vec3f) -> vec3f {
    return (p - params.volumeMin) / (params.volumeMax - params.volumeMin);
}

fn sampleSDF(p: vec3f) -> f32 {
    let uv = worldToUV(p);
    if (any(uv < vec3f(0.0)) || any(uv > vec3f(1.0))) {
        return 1.0;
    }
    return textureSampleLevel(volume, volumeSampler, uv, 0.0).r;
}

fn calcNormal(p: vec3f) -> vec3f {
    let e = params.volumeExtent / f32(params.resolution) * 0.5;
    let dx = sampleSDF(p + vec3f(e, 0.0, 0.0)) - sampleSDF(p - vec3f(e, 0.0, 0.0));
    let dy = sampleSDF(p + vec3f(0.0, e, 0.0)) - sampleSDF(p - vec3f(0.0, e, 0.0));
    let dz = sampleSDF(p + vec3f(0.0, 0.0, e)) - sampleSDF(p - vec3f(0.0, 0.0, e));
    return normalize(vec3f(dx, dy, dz));
}

@compute @workgroup_size(1)
fn main() {
    // Reconstruct ray from screen UV
    let ndc = vec4f(params.screenUV * 2.0 - 1.0, -1.0, 1.0);
    let ndcFar = vec4f(params.screenUV * 2.0 - 1.0, 1.0, 1.0);

    var worldNear = params.invViewProj * ndc;
    worldNear /= worldNear.w;
    var worldFar = params.invViewProj * ndcFar;
    worldFar /= worldFar.w;

    let ro = worldNear.xyz;
    let rd = normalize(worldFar.xyz - worldNear.xyz);

    // Intersect volume AABB
    let invRd = 1.0 / rd;
    let t1 = (params.volumeMin - ro) * invRd;
    let t2 = (params.volumeMax - ro) * invRd;
    let tmin = min(t1, t2);
    let tmax = max(t1, t2);
    let tNear = max(max(tmin.x, tmin.y), tmin.z);
    let tFar = min(min(tmax.x, tmax.y), tmax.z);

    if (max(tNear, 0.0) > tFar) {
        result.didHit = 0u;
        return;
    }

    // Sphere trace
    var t = max(tNear, 0.0);
    let maxT = tFar;
    let eps = 0.005;

    for (var i = 0u; i < 128u; i++) {
        let p = ro + rd * t;
        let d = sampleSDF(p);

        if (d < eps) {
            result.hitPos = p;
            result.hitNormal = calcNormal(p);
            result.distance = t;
            result.didHit = 1u;
            return;
        }

        t += max(d * 0.9, eps * 0.5);
        if (t > maxT) { break; }
    }

    // No hit - place at the nearest AABB exit point for adding new geometry
    result.hitPos = ro + rd * min(t, maxT);
    result.hitNormal = vec3f(0.0, 1.0, 0.0);
    result.distance = t;
    result.didHit = 0u;
}
)";

// ── C++ SDFSculpt Class ──────────────────────────────────────────────────────

class SDFSculpt {
    GraphicsBackend* mBackend = nullptr;
    SDFVolume* mVolume = nullptr;
    SDFRenderer* mRenderer = nullptr;

    ComputeShader mRayCastShader;
    GPUUniformBuffer<SDFRayCastParams> mRayCastParams;
    GPUBuffer<SDFRayHit> mRayHitBuffer;

    SDFRayCastParams mParams;
    SDFRayHit mLastHit;

    float mBrushSize = 0.2f;
    SDFShape mBrushShape = SDFShape::Sphere;
    SDFOp mOperation = SDFOp::Union;
    float mSmoothness = 0.05f;
    bool mStrokeActive = false;
    float mMinStrokeSpacing = 0.1f;
    float mLastStrokeX = 0, mLastStrokeY = 0, mLastStrokeZ = 0;

    // Undo stack
    std::vector<std::vector<SDFOperation>> mUndoStack;
    std::vector<std::vector<SDFOperation>> mRedoStack;
    static const int MAX_UNDO = 32;

#ifdef __EMSCRIPTEN__
    WGPUSampler mRayCastSampler = nullptr;
#endif

public:
    SDFSculpt() = default;

    /// Create the sculpting system
    void create(GraphicsBackend& backend, SDFVolume& volume, SDFRenderer& renderer) {
        mBackend = &backend;
        mVolume = &volume;
        mRenderer = &renderer;

        mRayCastShader.create(backend, kSDFRayCastShader);
        mRayCastParams.create(backend);

        SDFRayHit emptyHit = {};
        mRayHitBuffer.create(backend, 1, &emptyHit);

#ifdef __EMSCRIPTEN__
        auto* wgpuBackend = dynamic_cast<WebGPUBackend*>(&backend);
        if (wgpuBackend) {
            WGPUSamplerDescriptor sampDesc = {};
            sampDesc.addressModeU = WGPUAddressMode_ClampToEdge;
            sampDesc.addressModeV = WGPUAddressMode_ClampToEdge;
            sampDesc.addressModeW = WGPUAddressMode_ClampToEdge;
            sampDesc.magFilter = WGPUFilterMode_Nearest;
            sampDesc.minFilter = WGPUFilterMode_Nearest;
            sampDesc.mipmapFilter = WGPUMipmapFilterMode_Nearest;
            mRayCastSampler = wgpuDeviceCreateSampler(wgpuBackend->getDevice(), &sampDesc);
        }
#endif
    }

    /// Set camera (same as renderer - needed for ray casting)
    void setCamera(const float* viewMatrix, const float* projMatrix,
                   float camX, float camY, float camZ) {
        // Compute view-projection and invert
        float vp[16];
        for (int i = 0; i < 4; i++) {
            for (int j = 0; j < 4; j++) {
                vp[i * 4 + j] = 0;
                for (int k = 0; k < 4; k++) {
                    vp[i * 4 + j] += projMatrix[k * 4 + j] * viewMatrix[i * 4 + k];
                }
            }
        }
        invertMatrix4(vp, mParams.invViewProj);
        mParams.camPosX = camX;
        mParams.camPosY = camY;
        mParams.camPosZ = camZ;
    }

    /// Cast a ray from screen coordinates and read back the hit
    bool castRay(float screenX, float screenY, float screenW, float screenH) {
        if (!mBackend || !mVolume) return false;

        // Normalize screen coords to [0, 1]
        mParams.uvX = screenX / screenW;
        mParams.uvY = 1.0f - (screenY / screenH); // Flip Y
        mParams.volumeMinX = mVolume->worldMinX();
        mParams.volumeMinY = mVolume->worldMinY();
        mParams.volumeMinZ = mVolume->worldMinZ();
        mParams.volumeMaxX = mVolume->worldMaxX();
        mParams.volumeMaxY = mVolume->worldMaxY();
        mParams.volumeMaxZ = mVolume->worldMaxZ();
        mParams.volumeExtent = mVolume->worldExtent();
        mParams.resolution = mVolume->resolution();

        mRayCastParams.upload(mParams);

        // Dispatch ray cast compute shader
        // Need to bind texture for sampling in compute - but compute can't use sampled textures easily
        // Instead, we'll use the storage texture directly via textureLoad
        // Actually, we need texture_3d<f32> + sampler which requires texture binding, not storage
        // The ray cast shader uses texture sampling, so we bind as texture (not storage)

        // For the compute ray cast, we use the backend's bindStorageTexture for the volume
        // But the shader expects texture_3d and sampler, which needs a custom bind group approach
        // Since ComputeShader only supports storage buffers/textures, we need to handle this differently

        // Workaround: Use the simpler approach of creating a custom compute bind group
        // with texture + sampler bindings directly
#ifdef __EMSCRIPTEN__
        auto* wgpuBackend = dynamic_cast<WebGPUBackend*>(mBackend);
        if (!wgpuBackend) return false;

        // For compute ray casting, we need texture sampling which requires a custom pipeline
        // The ComputeShader wrapper only supports storage bindings
        // Instead, do a CPU-side ray march approximation for the pick ray
        return castRayCPU(screenX, screenY, screenW, screenH);
#else
        return false;
#endif
    }

    /// Begin a sculpting stroke
    void beginStroke(float screenX, float screenY, float screenW, float screenH) {
        if (!mVolume) return;

        // Save undo state
        pushUndo();

        mStrokeActive = true;
        applyBrush(screenX, screenY, screenW, screenH);
    }

    /// Continue a sculpting stroke (on mouse drag)
    void continueStroke(float screenX, float screenY, float screenW, float screenH) {
        if (!mStrokeActive || !mVolume) return;
        applyBrush(screenX, screenY, screenW, screenH);
    }

    /// End the current stroke
    void endStroke() {
        mStrokeActive = false;
    }

    /// Set brush size (radius)
    void setBrushSize(float radius) { mBrushSize = radius; }
    float brushSize() const { return mBrushSize; }

    /// Set brush shape
    void setBrushShape(SDFShape shape) { mBrushShape = shape; }

    /// Set CSG operation mode
    void setOperation(SDFOp op) { mOperation = op; }

    /// Set smoothness for smooth CSG
    void setSmoothness(float k) { mSmoothness = k; }

    /// Undo last stroke
    void undo() {
        if (mUndoStack.empty() || !mVolume) return;
        mRedoStack.push_back(mVolume->operations());
        mVolume->setOperations(mUndoStack.back());
        mUndoStack.pop_back();
        mVolume->bake();
    }

    /// Redo last undone stroke
    void redo() {
        if (mRedoStack.empty() || !mVolume) return;
        mUndoStack.push_back(mVolume->operations());
        mVolume->setOperations(mRedoStack.back());
        mRedoStack.pop_back();
        mVolume->bake();
    }

    /// Check if undo is available
    bool canUndo() const { return !mUndoStack.empty(); }
    bool canRedo() const { return !mRedoStack.empty(); }

    /// Get last ray hit result
    const SDFRayHit& lastHit() const { return mLastHit; }

private:
    void pushUndo() {
        if (!mVolume) return;
        mUndoStack.push_back(mVolume->operations());
        if ((int)mUndoStack.size() > MAX_UNDO) {
            mUndoStack.erase(mUndoStack.begin());
        }
        mRedoStack.clear();
    }

    void applyBrush(float screenX, float screenY, float screenW, float screenH) {
        if (!castRayCPU(screenX, screenY, screenW, screenH)) return;

        float hx = mLastHit.hitX;
        float hy = mLastHit.hitY;
        float hz = mLastHit.hitZ;

        // Spacing check: don't place too close to last placement
        if (mStrokeActive) {
            float dx = hx - mLastStrokeX;
            float dy = hy - mLastStrokeY;
            float dz = hz - mLastStrokeZ;
            float dist = sqrtf(dx*dx + dy*dy + dz*dz);
            if (dist < mMinStrokeSpacing * mBrushSize && dist > 0.0001f) return;
        }

        mLastStrokeX = hx; mLastStrokeY = hy; mLastStrokeZ = hz;

        // Place the brush primitive
        switch (mBrushShape) {
            case SDFShape::Sphere:
                mVolume->addSphere(hx, hy, hz, mBrushSize, mOperation);
                break;
            case SDFShape::Box:
                mVolume->addBox(hx, hy, hz, mBrushSize, mBrushSize, mBrushSize, mOperation);
                break;
            default:
                mVolume->addSphere(hx, hy, hz, mBrushSize, mOperation);
                break;
        }

        // Incremental rebake (only affected region)
        mVolume->bakeRegion(hx, hy, hz, mBrushSize);
    }

    /// CPU-side ray march through the SDF volume (for pick rays)
    /// Uses the analytical SDF operations directly instead of reading from GPU texture
    bool castRayCPU(float screenX, float screenY, float screenW, float screenH) {
        if (!mVolume) return false;

        float uvX = screenX / screenW;
        float uvY = 1.0f - (screenY / screenH);

        // Reconstruct ray
        float ndc[4] = { uvX * 2 - 1, uvY * 2 - 1, -1, 1 };
        float ndcFar[4] = { uvX * 2 - 1, uvY * 2 - 1, 1, 1 };

        float worldNear[4], worldFar[4];
        mulMat4Vec4(mParams.invViewProj, ndc, worldNear);
        mulMat4Vec4(mParams.invViewProj, ndcFar, worldFar);

        if (worldNear[3] != 0) { for (int i = 0; i < 3; i++) worldNear[i] /= worldNear[3]; }
        if (worldFar[3] != 0) { for (int i = 0; i < 3; i++) worldFar[i] /= worldFar[3]; }

        float ro[3] = { worldNear[0], worldNear[1], worldNear[2] };
        float rd[3] = {
            worldFar[0] - worldNear[0],
            worldFar[1] - worldNear[1],
            worldFar[2] - worldNear[2]
        };
        float rdLen = sqrtf(rd[0]*rd[0] + rd[1]*rd[1] + rd[2]*rd[2]);
        if (rdLen < 0.0001f) return false;
        rd[0] /= rdLen; rd[1] /= rdLen; rd[2] /= rdLen;

        // AABB intersection
        float volMin[3] = { mVolume->worldMinX(), mVolume->worldMinY(), mVolume->worldMinZ() };
        float volMax[3] = { mVolume->worldMaxX(), mVolume->worldMaxY(), mVolume->worldMaxZ() };

        float tNear = -1e30f, tFar = 1e30f;
        for (int i = 0; i < 3; i++) {
            if (fabsf(rd[i]) < 1e-8f) {
                if (ro[i] < volMin[i] || ro[i] > volMax[i]) return false;
            } else {
                float t1 = (volMin[i] - ro[i]) / rd[i];
                float t2 = (volMax[i] - ro[i]) / rd[i];
                if (t1 > t2) { float tmp = t1; t1 = t2; t2 = tmp; }
                tNear = fmaxf(tNear, t1);
                tFar = fminf(tFar, t2);
            }
        }
        tNear = fmaxf(tNear, 0.0f);
        if (tNear > tFar) return false;

        // March through evaluating analytical SDF
        const auto& ops = mVolume->operations();
        float t = tNear;
        float eps = 0.005f;

        for (int step = 0; step < 128; step++) {
            float p[3] = { ro[0] + rd[0]*t, ro[1] + rd[1]*t, ro[2] + rd[2]*t };
            float dist = evaluateSDFCPU(p, ops);

            if (dist < eps) {
                mLastHit.hitX = p[0];
                mLastHit.hitY = p[1];
                mLastHit.hitZ = p[2];
                // Compute normal via central differences
                float e = mVolume->voxelSize() * 0.5f;
                float px[3] = {p[0]+e, p[1], p[2]};
                float mx[3] = {p[0]-e, p[1], p[2]};
                float py[3] = {p[0], p[1]+e, p[2]};
                float my[3] = {p[0], p[1]-e, p[2]};
                float pz[3] = {p[0], p[1], p[2]+e};
                float mz[3] = {p[0], p[1], p[2]-e};
                float nx = evaluateSDFCPU(px, ops) - evaluateSDFCPU(mx, ops);
                float ny = evaluateSDFCPU(py, ops) - evaluateSDFCPU(my, ops);
                float nz = evaluateSDFCPU(pz, ops) - evaluateSDFCPU(mz, ops);
                float nLen = sqrtf(nx*nx + ny*ny + nz*nz);
                if (nLen > 0.0001f) { nx /= nLen; ny /= nLen; nz /= nLen; }
                mLastHit.hitNormalX = nx;
                mLastHit.hitNormalY = ny;
                mLastHit.hitNormalZ = nz;
                mLastHit.distance = t;
                mLastHit.didHit = 1;
                return true;
            }

            t += fmaxf(dist * 0.9f, eps * 0.5f);
            if (t > tFar) break;
        }

        // No hit - place at center of volume along ray
        float tMid = (tNear + tFar) * 0.5f;
        mLastHit.hitX = ro[0] + rd[0] * tMid;
        mLastHit.hitY = ro[1] + rd[1] * tMid;
        mLastHit.hitZ = ro[2] + rd[2] * tMid;
        mLastHit.hitNormalX = 0; mLastHit.hitNormalY = 1; mLastHit.hitNormalZ = 0;
        mLastHit.distance = tMid;
        mLastHit.didHit = 0;
        return true; // Still allow placement even without hit
    }

    /// Evaluate all SDF operations at a point (CPU mirror of WGSL)
    float evaluateSDFCPU(const float* p, const std::vector<SDFOperation>& ops) {
        float dist = 1000.0f;
        for (size_t i = 0; i < ops.size(); i++) {
            const auto& op = ops[i];
            float d = 0;
            switch ((SDFShape)op.type) {
                case SDFShape::Sphere: {
                    float dx = p[0]-op.posX, dy = p[1]-op.posY, dz = p[2]-op.posZ;
                    d = sqrtf(dx*dx + dy*dy + dz*dz) - op.radius;
                    break;
                }
                case SDFShape::Box: {
                    float dx = fabsf(p[0]-op.posX)-op.paramX;
                    float dy = fabsf(p[1]-op.posY)-op.paramY;
                    float dz = fabsf(p[2]-op.posZ)-op.paramZ;
                    float ox = fmaxf(dx, 0.0f), oy = fmaxf(dy, 0.0f), oz = fmaxf(dz, 0.0f);
                    d = sqrtf(ox*ox + oy*oy + oz*oz) + fminf(fmaxf(dx, fmaxf(dy, dz)), 0.0f);
                    break;
                }
                case SDFShape::Capsule: {
                    float abx = op.paramX-op.posX, aby = op.paramY-op.posY, abz = op.paramZ-op.posZ;
                    float apx = p[0]-op.posX, apy = p[1]-op.posY, apz = p[2]-op.posZ;
                    float abDot = abx*abx + aby*aby + abz*abz;
                    float t = (apx*abx + apy*aby + apz*abz) / fmaxf(abDot, 0.0001f);
                    t = fmaxf(0.0f, fminf(1.0f, t));
                    float cx = op.posX + abx*t - p[0];
                    float cy = op.posY + aby*t - p[1];
                    float cz = op.posZ + abz*t - p[2];
                    d = sqrtf(cx*cx + cy*cy + cz*cz) - op.radius;
                    break;
                }
                case SDFShape::Plane: {
                    float nx = op.paramX, ny = op.paramY, nz = op.paramZ;
                    float nLen = sqrtf(nx*nx + ny*ny + nz*nz);
                    if (nLen > 0.0001f) { nx /= nLen; ny /= nLen; nz /= nLen; }
                    d = (p[0]-op.posX)*nx + (p[1]-op.posY)*ny + (p[2]-op.posZ)*nz;
                    break;
                }
            }

            if (i == 0) {
                dist = d;
            } else {
                switch ((SDFOp)op.combineOp) {
                    case SDFOp::Union: dist = fminf(dist, d); break;
                    case SDFOp::Subtract: dist = fmaxf(dist, -d); break;
                    case SDFOp::SmoothUnion: dist = smoothMinCPU(dist, d, op.smoothness); break;
                    case SDFOp::SmoothSubtract: dist = -smoothMinCPU(-dist, -(-d), op.smoothness); break;
                }
            }
        }
        return dist;
    }

    static float smoothMinCPU(float a, float b, float k) {
        if (k < 0.0001f) return fminf(a, b);
        float h = fmaxf(0.0f, fminf(1.0f, 0.5f + 0.5f * (b - a) / k));
        return b + (a - b) * h - k * h * (1.0f - h);
    }

    static void mulMat4Vec4(const float* m, const float* v, float* out) {
        for (int i = 0; i < 4; i++) {
            out[i] = m[i]*v[0] + m[i+4]*v[1] + m[i+8]*v[2] + m[i+12]*v[3];
        }
    }

    static void invertMatrix4(const float* m, float* out) {
        float inv[16];
        inv[0] = m[5]*m[10]*m[15]-m[5]*m[11]*m[14]-m[9]*m[6]*m[15]+m[9]*m[7]*m[14]+m[13]*m[6]*m[11]-m[13]*m[7]*m[10];
        inv[4] = -m[4]*m[10]*m[15]+m[4]*m[11]*m[14]+m[8]*m[6]*m[15]-m[8]*m[7]*m[14]-m[12]*m[6]*m[11]+m[12]*m[7]*m[10];
        inv[8] = m[4]*m[9]*m[15]-m[4]*m[11]*m[13]-m[8]*m[5]*m[15]+m[8]*m[7]*m[13]+m[12]*m[5]*m[11]-m[12]*m[7]*m[9];
        inv[12] = -m[4]*m[9]*m[14]+m[4]*m[10]*m[13]+m[8]*m[5]*m[14]-m[8]*m[6]*m[13]-m[12]*m[5]*m[10]+m[12]*m[6]*m[9];
        inv[1] = -m[1]*m[10]*m[15]+m[1]*m[11]*m[14]+m[9]*m[2]*m[15]-m[9]*m[3]*m[14]-m[13]*m[2]*m[11]+m[13]*m[3]*m[10];
        inv[5] = m[0]*m[10]*m[15]-m[0]*m[11]*m[14]-m[8]*m[2]*m[15]+m[8]*m[3]*m[14]+m[12]*m[2]*m[11]-m[12]*m[3]*m[10];
        inv[9] = -m[0]*m[9]*m[15]+m[0]*m[11]*m[13]+m[8]*m[1]*m[15]-m[8]*m[3]*m[13]-m[12]*m[1]*m[11]+m[12]*m[3]*m[9];
        inv[13] = m[0]*m[9]*m[14]-m[0]*m[10]*m[13]-m[8]*m[1]*m[14]+m[8]*m[2]*m[13]+m[12]*m[1]*m[10]-m[12]*m[2]*m[9];
        inv[2] = m[1]*m[6]*m[15]-m[1]*m[7]*m[14]-m[5]*m[2]*m[15]+m[5]*m[3]*m[14]+m[13]*m[2]*m[7]-m[13]*m[3]*m[6];
        inv[6] = -m[0]*m[6]*m[15]+m[0]*m[7]*m[14]+m[4]*m[2]*m[15]-m[4]*m[3]*m[14]-m[12]*m[2]*m[7]+m[12]*m[3]*m[6];
        inv[10] = m[0]*m[5]*m[15]-m[0]*m[7]*m[13]-m[4]*m[1]*m[15]+m[4]*m[3]*m[13]+m[12]*m[1]*m[7]-m[12]*m[3]*m[5];
        inv[14] = -m[0]*m[5]*m[14]+m[0]*m[6]*m[13]+m[4]*m[1]*m[14]-m[4]*m[2]*m[13]-m[12]*m[1]*m[6]+m[12]*m[2]*m[5];
        inv[3] = -m[1]*m[6]*m[11]+m[1]*m[7]*m[10]+m[5]*m[2]*m[11]-m[5]*m[3]*m[10]-m[9]*m[2]*m[7]+m[9]*m[3]*m[6];
        inv[7] = m[0]*m[6]*m[11]-m[0]*m[7]*m[10]-m[4]*m[2]*m[11]+m[4]*m[3]*m[10]+m[8]*m[2]*m[7]-m[8]*m[3]*m[6];
        inv[11] = -m[0]*m[5]*m[11]+m[0]*m[7]*m[9]+m[4]*m[1]*m[11]-m[4]*m[3]*m[9]-m[8]*m[1]*m[7]+m[8]*m[3]*m[5];
        inv[15] = m[0]*m[5]*m[10]-m[0]*m[6]*m[9]-m[4]*m[1]*m[10]+m[4]*m[2]*m[9]+m[8]*m[1]*m[6]-m[8]*m[2]*m[5];
        float det = m[0]*inv[0]+m[1]*inv[4]+m[2]*inv[8]+m[3]*inv[12];
        if (det == 0) { for (int i = 0; i < 16; i++) out[i] = 0; return; }
        det = 1.0f / det;
        for (int i = 0; i < 16; i++) out[i] = inv[i] * det;
    }
};

} // namespace al

#endif // AL_WEBGPU_SDF_SCULPT_HPP
