/**
 * AlloLib Studio Online - WebGPU SDF Terrain Generator
 *
 * Procedural terrain generation using FBM (Fractal Brownian Motion) noise
 * baked into a 3D SDF volume. Supports interactive digging and building.
 *
 * Header-only for ease of use in examples.
 */

#ifndef AL_WEBGPU_SDF_TERRAIN_HPP
#define AL_WEBGPU_SDF_TERRAIN_HPP

#include "al_WebGPUSDFVolume.hpp"
#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include <cstdint>

namespace al {

/// Terrain generation parameters (64 bytes, GPU-aligned)
struct SDFTerrainParams {
    float worldMinX, worldMinY, worldMinZ;
    float voxelSize;
    float worldMaxX, worldMaxY, worldMaxZ;
    uint32_t resolution;
    uint32_t octaves;
    float frequency;
    float amplitude;
    float lacunarity;
    float persistence;
    float heightOffset;     // Y offset for terrain surface
    uint32_t seed;
    float _pad;
};
static_assert(sizeof(SDFTerrainParams) == 64, "SDFTerrainParams must be 64 bytes");

/// Terrain edit operation (32 bytes, GPU-aligned)
struct SDFTerrainEdit {
    float posX, posY, posZ, radius;
    uint32_t type;      // 0 = dig (subtract), 1 = build (add)
    float _pad[3];
};
static_assert(sizeof(SDFTerrainEdit) == 32, "SDFTerrainEdit must be 32 bytes");

// ── WGSL Terrain Generation Shader ──────────────────────────────────────────

static const char* kSDFTerrainGenShader = R"(
struct TerrainParams {
    worldMin: vec3f,
    voxelSize: f32,
    worldMax: vec3f,
    resolution: u32,
    octaves: u32,
    frequency: f32,
    amplitude: f32,
    lacunarity: f32,
    persistence: f32,
    heightOffset: f32,
    seed: u32,
    _pad: f32,
}

struct TerrainEdit {
    pos: vec3f,
    radius: f32,
    editType: u32,
    _pad: vec3f,
}

@group(0) @binding(0) var volume: texture_storage_3d<r32float, write>;
@group(0) @binding(1) var<uniform> params: TerrainParams;
@group(0) @binding(2) var<storage, read> edits: array<TerrainEdit>;
@group(0) @binding(3) var<uniform> editCount: u32;

// Hash functions for procedural noise
fn hash3(p: vec3f) -> f32 {
    var p3 = fract(p * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

fn noise3(p: vec3f) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);

    let n000 = hash3(i + vec3f(0.0, 0.0, 0.0));
    let n100 = hash3(i + vec3f(1.0, 0.0, 0.0));
    let n010 = hash3(i + vec3f(0.0, 1.0, 0.0));
    let n110 = hash3(i + vec3f(1.0, 1.0, 0.0));
    let n001 = hash3(i + vec3f(0.0, 0.0, 1.0));
    let n101 = hash3(i + vec3f(1.0, 0.0, 1.0));
    let n011 = hash3(i + vec3f(0.0, 1.0, 1.0));
    let n111 = hash3(i + vec3f(1.0, 1.0, 1.0));

    let nx00 = mix(n000, n100, u.x);
    let nx10 = mix(n010, n110, u.x);
    let nx01 = mix(n001, n101, u.x);
    let nx11 = mix(n011, n111, u.x);

    let nxy0 = mix(nx00, nx10, u.y);
    let nxy1 = mix(nx01, nx11, u.y);

    return mix(nxy0, nxy1, u.z) * 2.0 - 1.0;
}

fn fbm(p: vec3f, octaves: u32, frequency: f32, amplitude: f32,
       lacunarity: f32, persistence: f32) -> f32 {
    var value = 0.0;
    var freq = frequency;
    var amp = amplitude;
    for (var i = 0u; i < octaves; i++) {
        value += noise3(p * freq) * amp;
        freq *= lacunarity;
        amp *= persistence;
    }
    return value;
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let res = params.resolution;
    if (gid.x >= res || gid.y >= res || gid.z >= res) { return; }

    // Map voxel to world position
    let uvw = vec3f(gid) / f32(res - 1u);
    let worldPos = params.worldMin + uvw * (params.worldMax - params.worldMin);

    // Terrain SDF: y - fbm(x, z) + heightOffset
    let seedOffset = vec3f(f32(params.seed) * 13.37, 0.0, f32(params.seed) * 7.13);
    let terrainHeight = fbm(
        vec3f(worldPos.x, 0.0, worldPos.z) + seedOffset,
        params.octaves,
        params.frequency,
        params.amplitude,
        params.lacunarity,
        params.persistence
    );

    var dist = worldPos.y - terrainHeight - params.heightOffset;

    // Apply edits (dig/build operations)
    for (var i = 0u; i < editCount; i++) {
        let edit = edits[i];
        let sphereDist = length(worldPos - edit.pos) - edit.radius;

        if (edit.editType == 0u) {
            // Dig (subtract sphere)
            dist = max(dist, -sphereDist);
        } else {
            // Build (add sphere)
            dist = min(dist, sphereDist);
        }
    }

    textureStore(volume, gid, vec4f(dist, 0.0, 0.0, 0.0));
}
)";

// ── C++ SDFTerrain Class ─────────────────────────────────────────────────────

class SDFTerrain {
    GraphicsBackend* mBackend = nullptr;
    ComputeShader mGenShader;
    GPUUniformBuffer<SDFTerrainParams> mParamsBuffer;
    GPUBuffer<SDFTerrainEdit> mEditsBuffer;
    GPUUniformBuffer<uint32_t> mEditCountBuffer;
    TextureHandle mVolumeTexture;

    SDFTerrainParams mParams;
    std::vector<SDFTerrainEdit> mEdits;
    int mResolution = 128;
    float mWorldExtent = 8.0f;

    static const int MAX_EDITS = 256;

public:
    SDFTerrain() = default;

    /// Create terrain volume
    void create(GraphicsBackend& backend, int resolution = 128) {
        mBackend = &backend;
        mResolution = resolution;
        float half = mWorldExtent / 2.0f;

        mParams.worldMinX = -half; mParams.worldMinY = -half; mParams.worldMinZ = -half;
        mParams.worldMaxX = half; mParams.worldMaxY = half; mParams.worldMaxZ = half;
        mParams.voxelSize = mWorldExtent / (float)resolution;
        mParams.resolution = resolution;
        mParams.octaves = 6;
        mParams.frequency = 1.0f;
        mParams.amplitude = 0.8f;
        mParams.lacunarity = 2.0f;
        mParams.persistence = 0.5f;
        mParams.heightOffset = 0.0f;
        mParams.seed = 42;
        mParams._pad = 0;

        // Create 3D storage texture
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

        mGenShader.create(backend, kSDFTerrainGenShader);
        mParamsBuffer.create(backend);

        std::vector<SDFTerrainEdit> emptyEdits(MAX_EDITS);
        mEditsBuffer.create(backend, MAX_EDITS, emptyEdits.data());

        uint32_t zero = 0;
        mEditCountBuffer.create(backend, &zero);
    }

    /// Set noise parameters
    void setNoiseParams(int octaves, float frequency, float amplitude, float lacunarity) {
        mParams.octaves = octaves;
        mParams.frequency = frequency;
        mParams.amplitude = amplitude;
        mParams.lacunarity = lacunarity;
    }

    /// Set noise persistence
    void setPersistence(float p) { mParams.persistence = p; }

    /// Set terrain height offset
    void setHeightOffset(float h) { mParams.heightOffset = h; }

    /// Set random seed
    void setSeed(uint32_t seed) { mParams.seed = seed; }

    /// Set world extent
    void setWorldExtent(float extent) {
        mWorldExtent = extent;
        float half = extent / 2.0f;
        mParams.worldMinX = -half; mParams.worldMinY = -half; mParams.worldMinZ = -half;
        mParams.worldMaxX = half; mParams.worldMaxY = half; mParams.worldMaxZ = half;
        mParams.voxelSize = extent / (float)mResolution;
    }

    /// Dig a spherical hole at a position
    void dig(float x, float y, float z, float radius) {
        if ((int)mEdits.size() >= MAX_EDITS) return;
        SDFTerrainEdit edit = {};
        edit.posX = x; edit.posY = y; edit.posZ = z;
        edit.radius = radius;
        edit.type = 0; // dig
        mEdits.push_back(edit);
    }

    /// Build a spherical mound at a position
    void build(float x, float y, float z, float radius) {
        if ((int)mEdits.size() >= MAX_EDITS) return;
        SDFTerrainEdit edit = {};
        edit.posX = x; edit.posY = y; edit.posZ = z;
        edit.radius = radius;
        edit.type = 1; // build
        mEdits.push_back(edit);
    }

    /// Clear all edits
    void clearEdits() { mEdits.clear(); }

    /// Generate the terrain (dispatch compute shader)
    void generate() {
        if (!mBackend) return;

        mParamsBuffer.upload(mParams);

        uint32_t editCount = (uint32_t)mEdits.size();
        mEditCountBuffer.upload(editCount);

        if (!mEdits.empty()) {
            mEditsBuffer.upload(mEdits.data(), mEdits.size());
        }

        int groups = (mResolution + 3) / 4;
        mGenShader.bindTexture(0, mVolumeTexture);
        mGenShader.bindUniform(1, mParamsBuffer.handle());
        mGenShader.bind(2, mEditsBuffer.handle());
        mGenShader.bindUniform(3, mEditCountBuffer.handle());
        mGenShader.dispatch(groups, groups, groups);
        mBackend->computeBarrier();
    }

    /// Get the volume texture handle
    TextureHandle volumeTexture() const { return mVolumeTexture; }

    /// Get volume bounds (for renderer)
    float worldMinX() const { return mParams.worldMinX; }
    float worldMinY() const { return mParams.worldMinY; }
    float worldMinZ() const { return mParams.worldMinZ; }
    float worldMaxX() const { return mParams.worldMaxX; }
    float worldMaxY() const { return mParams.worldMaxY; }
    float worldMaxZ() const { return mParams.worldMaxZ; }
    float worldExtent() const { return mWorldExtent; }
    int resolution() const { return mResolution; }
    float voxelSize() const { return mParams.voxelSize; }

    // Non-copyable
    SDFTerrain(const SDFTerrain&) = delete;
    SDFTerrain& operator=(const SDFTerrain&) = delete;
};

} // namespace al

#endif // AL_WEBGPU_SDF_TERRAIN_HPP
