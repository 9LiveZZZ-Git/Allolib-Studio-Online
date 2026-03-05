/**
 * AlloLib Studio Online - GPU 3D Fluid / Smoke Simulation (Phase 5)
 *
 * Simplified 3D Navier-Stokes solver with buoyancy for volumetric smoke.
 * Uses Stable Fluids on a 64x64x64 grid with temperature-driven buoyancy.
 *
 * Rendering uses z-slice compositing via drawFluidField() for simplicity —
 * each z-slice is rendered as a semi-transparent fullscreen layer.
 * Future phases can add raymarched volume rendering.
 *
 * Features:
 *   - 3D semi-Lagrangian advection
 *   - Jacobi pressure solver
 *   - Temperature-driven buoyancy (hot smoke rises)
 *   - Heat source injection at bottom center
 *   - Rendered via density point cloud using drawParticles()
 *
 * Usage:
 *   FluidSim3D smoke;
 *   smoke.create(*backend(), 64, 64, 64);
 *
 *   void onAnimate(double dt) { smoke.step(dt); }
 *   void onDraw(Graphics& g)  { smoke.draw(g); }
 *
 * Header-only. Requires: al_WebGPUCompute.hpp, al_WebGPUBuffer.hpp,
 *   al_WebPingPong.hpp, al_WebGPUBackend.hpp
 */

#ifndef AL_WEBGPU_FLUID_3D_HPP
#define AL_WEBGPU_FLUID_3D_HPP

#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include "al_WebPingPong.hpp"
#include "al_WebGPUBackend.hpp"
#include "al_WebGPUParticles.hpp"  // For ParticleRenderParams and drawParticles
#include <cstring>
#include <cmath>
#include <cstdio>
#include <algorithm>
#include <vector>

extern "C" {
    bool Graphics_isWebGPU();
    al::GraphicsBackend* Graphics_getBackend();
}

namespace al {

// ── GPU-Aligned Structs ─────────────────────────────────────────────────────

struct Fluid3DParams {
    float dt;           // 0
    float dx;           // 4
    float viscosity;    // 8
    float dissipation;  // 12
    uint32_t gridW;     // 16
    uint32_t gridH;     // 20
    uint32_t gridD;     // 24
    float buoyancy;     // 28
    float ambientTemp;  // 32
    float pad[3];       // 36-47
};
static_assert(sizeof(Fluid3DParams) == 48, "Fluid3DParams must be 48 bytes");

struct Heat3DParams {
    float posX, posY, posZ;  // 0-11
    float radius;            // 12
    float heatRate;          // 16
    float densityRate;       // 20
    uint32_t gridW;          // 24
    uint32_t gridH;          // 28
    uint32_t gridD;          // 32
    float pad[3];            // 36-47
};
static_assert(sizeof(Heat3DParams) == 48, "Heat3DParams must be 48 bytes");

struct Smoke3DRenderParams {
    float viewMatrix[16];
    float projMatrix[16];
    float cameraRightX, cameraRightY, cameraRightZ, _pad0;
    float cameraUpX, cameraUpY, cameraUpZ, _pad1;
};
static_assert(sizeof(Smoke3DRenderParams) == 160, "Smoke3DRenderParams must be 160 bytes");

// ── WGSL Compute Shaders (3D) ──────────────────────────────────────────────

static const char* kFluid3DAdvectWGSL = R"(
struct Fluid3DParams {
    dt: f32,
    dx: f32,
    viscosity: f32,
    dissipation: f32,
    gridW: u32,
    gridH: u32,
    gridD: u32,
    buoyancy: f32,
    ambientTemp: f32,
    pad0: f32,
    pad1: f32,
    pad2: f32,
}

@group(0) @binding(0) var<storage, read> previous: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> current: array<vec4f>;
@group(0) @binding(2) var<uniform> params: Fluid3DParams;

fn idx(x: u32, y: u32, z: u32) -> u32 {
    return x + y * params.gridW + z * params.gridW * params.gridH;
}

fn sampleTrilinear(fx: f32, fy: f32, fz: f32) -> vec4f {
    let x0 = u32(clamp(floor(fx), 0.0, f32(params.gridW - 1u)));
    let y0 = u32(clamp(floor(fy), 0.0, f32(params.gridH - 1u)));
    let z0 = u32(clamp(floor(fz), 0.0, f32(params.gridD - 1u)));
    let x1 = min(x0 + 1u, params.gridW - 1u);
    let y1 = min(y0 + 1u, params.gridH - 1u);
    let z1 = min(z0 + 1u, params.gridD - 1u);

    let sx = fx - floor(fx);
    let sy = fy - floor(fy);
    let sz = fz - floor(fz);

    let v000 = previous[idx(x0, y0, z0)];
    let v100 = previous[idx(x1, y0, z0)];
    let v010 = previous[idx(x0, y1, z0)];
    let v110 = previous[idx(x1, y1, z0)];
    let v001 = previous[idx(x0, y0, z1)];
    let v101 = previous[idx(x1, y0, z1)];
    let v011 = previous[idx(x0, y1, z1)];
    let v111 = previous[idx(x1, y1, z1)];

    let c00 = mix(v000, v100, sx);
    let c10 = mix(v010, v110, sx);
    let c01 = mix(v001, v101, sx);
    let c11 = mix(v011, v111, sx);

    let c0 = mix(c00, c10, sy);
    let c1 = mix(c01, c11, sy);

    return mix(c0, c1, sz);
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let x = gid.x;
    let y = gid.y;
    let z = gid.z;
    if (x >= params.gridW || y >= params.gridH || z >= params.gridD) { return; }

    // Boundary: zero at edges
    if (x == 0u || x == params.gridW - 1u ||
        y == 0u || y == params.gridH - 1u ||
        z == 0u || z == params.gridD - 1u) {
        current[idx(x, y, z)] = vec4f(0.0);
        return;
    }

    let i = idx(x, y, z);
    let vel = previous[i];

    // Trace back
    let fx = f32(x) - vel.x * params.dt / params.dx;
    let fy = f32(y) - vel.y * params.dt / params.dx;
    let fz = f32(z) - vel.z * params.dt / params.dx;

    var result = sampleTrilinear(fx, fy, fz);
    result *= params.dissipation;
    current[i] = result;
}
)";

static const char* kFluid3DDivergenceWGSL = R"(
struct Fluid3DParams {
    dt: f32,
    dx: f32,
    viscosity: f32,
    dissipation: f32,
    gridW: u32,
    gridH: u32,
    gridD: u32,
    buoyancy: f32,
    ambientTemp: f32,
    pad0: f32,
    pad1: f32,
    pad2: f32,
}

@group(0) @binding(0) var<storage, read> velocity: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> divergence: array<f32>;
@group(0) @binding(2) var<uniform> params: Fluid3DParams;

fn idx(x: u32, y: u32, z: u32) -> u32 {
    return x + y * params.gridW + z * params.gridW * params.gridH;
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let x = gid.x;
    let y = gid.y;
    let z = gid.z;
    if (x >= params.gridW || y >= params.gridH || z >= params.gridD) { return; }

    if (x == 0u || x == params.gridW - 1u ||
        y == 0u || y == params.gridH - 1u ||
        z == 0u || z == params.gridD - 1u) {
        divergence[idx(x, y, z)] = 0.0;
        return;
    }

    let vR = velocity[idx(x + 1u, y, z)].x;
    let vL = velocity[idx(x - 1u, y, z)].x;
    let vT = velocity[idx(x, y + 1u, z)].y;
    let vB = velocity[idx(x, y - 1u, z)].y;
    let vF = velocity[idx(x, y, z + 1u)].z;
    let vK = velocity[idx(x, y, z - 1u)].z;

    divergence[idx(x, y, z)] = (vR - vL + vT - vB + vF - vK) / (2.0 * params.dx);
}
)";

static const char* kFluid3DPressureWGSL = R"(
struct Fluid3DParams {
    dt: f32,
    dx: f32,
    viscosity: f32,
    dissipation: f32,
    gridW: u32,
    gridH: u32,
    gridD: u32,
    buoyancy: f32,
    ambientTemp: f32,
    pad0: f32,
    pad1: f32,
    pad2: f32,
}

@group(0) @binding(0) var<storage, read> pressure_prev: array<f32>;
@group(0) @binding(1) var<storage, read_write> pressure_next: array<f32>;
@group(0) @binding(2) var<storage, read> divergence: array<f32>;
@group(0) @binding(3) var<uniform> params: Fluid3DParams;

fn idx(x: u32, y: u32, z: u32) -> u32 {
    return x + y * params.gridW + z * params.gridW * params.gridH;
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let x = gid.x;
    let y = gid.y;
    let z = gid.z;
    if (x >= params.gridW || y >= params.gridH || z >= params.gridD) { return; }

    if (x == 0u || x == params.gridW - 1u ||
        y == 0u || y == params.gridH - 1u ||
        z == 0u || z == params.gridD - 1u) {
        pressure_next[idx(x, y, z)] = 0.0;
        return;
    }

    let i = idx(x, y, z);
    let pR = pressure_prev[idx(x + 1u, y, z)];
    let pL = pressure_prev[idx(x - 1u, y, z)];
    let pT = pressure_prev[idx(x, y + 1u, z)];
    let pB = pressure_prev[idx(x, y - 1u, z)];
    let pF = pressure_prev[idx(x, y, z + 1u)];
    let pK = pressure_prev[idx(x, y, z - 1u)];
    let div = divergence[i];

    pressure_next[i] = (pR + pL + pT + pB + pF + pK - params.dx * params.dx * div) / 6.0;
}
)";

static const char* kFluid3DGradientSubtractWGSL = R"(
struct Fluid3DParams {
    dt: f32,
    dx: f32,
    viscosity: f32,
    dissipation: f32,
    gridW: u32,
    gridH: u32,
    gridD: u32,
    buoyancy: f32,
    ambientTemp: f32,
    pad0: f32,
    pad1: f32,
    pad2: f32,
}

@group(0) @binding(0) var<storage, read_write> velocity: array<vec4f>;
@group(0) @binding(1) var<storage, read> pressure: array<f32>;
@group(0) @binding(2) var<uniform> params: Fluid3DParams;

fn idx(x: u32, y: u32, z: u32) -> u32 {
    return x + y * params.gridW + z * params.gridW * params.gridH;
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let x = gid.x;
    let y = gid.y;
    let z = gid.z;
    if (x >= params.gridW || y >= params.gridH || z >= params.gridD) { return; }

    if (x == 0u || x == params.gridW - 1u ||
        y == 0u || y == params.gridH - 1u ||
        z == 0u || z == params.gridD - 1u) {
        velocity[idx(x, y, z)] = vec4f(0.0);
        return;
    }

    let i = idx(x, y, z);
    var v = velocity[i];

    let pR = pressure[idx(x + 1u, y, z)];
    let pL = pressure[idx(x - 1u, y, z)];
    let pT = pressure[idx(x, y + 1u, z)];
    let pB = pressure[idx(x, y - 1u, z)];
    let pF = pressure[idx(x, y, z + 1u)];
    let pK = pressure[idx(x, y, z - 1u)];

    v.x -= (pR - pL) / (2.0 * params.dx);
    v.y -= (pT - pB) / (2.0 * params.dx);
    v.z -= (pF - pK) / (2.0 * params.dx);

    velocity[i] = v;
}
)";

static const char* kFluid3DBuoyancyWGSL = R"(
struct Fluid3DParams {
    dt: f32,
    dx: f32,
    viscosity: f32,
    dissipation: f32,
    gridW: u32,
    gridH: u32,
    gridD: u32,
    buoyancy: f32,
    ambientTemp: f32,
    pad0: f32,
    pad1: f32,
    pad2: f32,
}

@group(0) @binding(0) var<storage, read_write> velocity: array<vec4f>;
@group(0) @binding(1) var<storage, read> density: array<vec4f>;
@group(0) @binding(2) var<uniform> params: Fluid3DParams;

fn idx(x: u32, y: u32, z: u32) -> u32 {
    return x + y * params.gridW + z * params.gridW * params.gridH;
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let x = gid.x;
    let y = gid.y;
    let z = gid.z;
    if (x >= params.gridW || y >= params.gridH || z >= params.gridD) { return; }

    let i = idx(x, y, z);
    let d = density[i];

    // d.x = density, d.y = temperature
    let temp = d.y;
    let dens = d.x;

    // Buoyancy: hot gas rises (positive Y)
    let buoyancyForce = params.buoyancy * (temp - params.ambientTemp) * params.dt;
    // Gravity: density pulls down
    let gravityForce = -0.5 * dens * params.dt;

    var v = velocity[i];
    v.y += buoyancyForce + gravityForce;
    velocity[i] = v;
}
)";

static const char* kFluid3DAddHeatWGSL = R"(
struct Heat3DParams {
    posX: f32,
    posY: f32,
    posZ: f32,
    radius: f32,
    heatRate: f32,
    densityRate: f32,
    gridW: u32,
    gridH: u32,
    gridD: u32,
    pad0: f32,
    pad1: f32,
    pad2: f32,
}

@group(0) @binding(0) var<storage, read_write> density: array<vec4f>;
@group(0) @binding(1) var<uniform> params: Heat3DParams;

fn idx(x: u32, y: u32, z: u32) -> u32 {
    return x + y * params.gridW + z * params.gridW * params.gridH;
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let x = gid.x;
    let y = gid.y;
    let z = gid.z;
    if (x >= params.gridW || y >= params.gridH || z >= params.gridD) { return; }

    let normX = f32(x) / f32(params.gridW);
    let normY = f32(y) / f32(params.gridH);
    let normZ = f32(z) / f32(params.gridD);

    let dx = normX - params.posX;
    let dy = normY - params.posY;
    let dz = normZ - params.posZ;
    let dist2 = dx * dx + dy * dy + dz * dz;
    let r2 = params.radius * params.radius;

    let weight = exp(-dist2 / r2);
    if (weight < 0.001) { return; }

    let i = idx(x, y, z);
    var d = density[i];
    d.x += params.densityRate * weight;  // density
    d.y += params.heatRate * weight;     // temperature
    d.x = min(d.x, 5.0);
    d.y = min(d.y, 5.0);
    density[i] = d;
}
)";

// Shader to build a particle buffer from the 3D density field for rendering
static const char* kFluid3DBuildPointsWGSL = R"(
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

struct BuildParams {
    gridW: u32,
    gridH: u32,
    gridD: u32,
    scale: f32,
    offsetX: f32,
    offsetY: f32,
    offsetZ: f32,
    threshold: f32,
}

@group(0) @binding(0) var<storage, read> density: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(2) var<uniform> params: BuildParams;

fn idx(x: u32, y: u32, z: u32) -> u32 {
    return x + y * params.gridW + z * params.gridW * params.gridH;
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let x = gid.x;
    let y = gid.y;
    let z = gid.z;
    if (x >= params.gridW || y >= params.gridH || z >= params.gridD) { return; }

    let i = idx(x, y, z);
    let d = density[i];
    var p: Particle;

    // Position: map grid to world space
    p.position = vec3f(
        (f32(x) / f32(params.gridW) - 0.5) * params.scale + params.offsetX,
        (f32(y) / f32(params.gridH) - 0.5) * params.scale + params.offsetY,
        (f32(z) / f32(params.gridD) - 0.5) * params.scale + params.offsetZ,
    );

    let dens = d.x;
    let temp = d.y;

    if (dens > params.threshold) {
        p.age = 0.0;
        p.lifetime = 1.0;

        // Color based on temperature: white-hot → orange → dark gray
        let t = clamp(temp * 0.5, 0.0, 1.0);
        p.color = vec4f(
            mix(0.5, 1.0, t),     // R
            mix(0.5, 0.6, t),     // G
            mix(0.5, 0.2, t),     // B
            min(dens * 0.8, 0.9), // A (density-based opacity)
        );
        p.size = 0.015 * params.scale;
    } else {
        // Dead particle (won't be rendered)
        p.age = 1.0;
        p.lifetime = 0.0;
        p.color = vec4f(0.0);
        p.size = 0.0;
    }

    p.velocity = vec3f(0.0);
    p.mass = 1.0;
    p._pad0 = 0.0;
    p._pad1 = 0.0;

    particles[i] = p;
}
)";

// ── FluidSim3D Class ────────────────────────────────────────────────────────

struct BuildPointsParams {
    uint32_t gridW, gridH, gridD;
    float scale;
    float offsetX, offsetY, offsetZ;
    float threshold;
};
static_assert(sizeof(BuildPointsParams) == 32, "BuildPointsParams must be 32 bytes");

class FluidSim3D {
    int mGridW = 64, mGridH = 64, mGridD = 64;

    // Velocity field: vec4f (vx, vy, vz, 0)
    PingPongBuffer<float> mVelocity;
    // Density field: vec4f (density, temperature, 0, 0)
    PingPongBuffer<float> mDensity;
    // Pressure field: scalar
    PingPongBuffer<float> mPressure;
    // Divergence: scalar
    GPUBuffer<float> mDivergence;

    // Uniform buffers
    GPUUniformBuffer<Fluid3DParams> mFluidParamsBuffer;
    GPUUniformBuffer<Heat3DParams> mHeatParamsBuffer;

    // Compute shaders
    ComputeShader mAdvectShader;
    ComputeShader mDivergenceShader;
    ComputeShader mPressureShader;
    ComputeShader mGradientSubtractShader;
    ComputeShader mBuoyancyShader;
    ComputeShader mAddHeatShader;

    // Point cloud rendering
    ComputeShader mBuildPointsShader;
    GPUBuffer<GPUParticle> mPointCloudBuffer;
    GPUUniformBuffer<BuildPointsParams> mBuildParamsBuffer;
    GPUUniformBuffer<ParticleRenderParams> mRenderParamsBuffer;

    // Simulation parameters
    float mViscosity = 0.0f;
    float mDensityDissipation = 0.99f;
    float mVelDissipation = 0.999f;
    float mBuoyancy = 3.0f;
    float mAmbientTemp = 0.0f;
    int mPressureIterations = 20;
    float mTime = 0.0f;

    // Heat source
    float mHeatPosX = 0.5f, mHeatPosY = 0.1f, mHeatPosZ = 0.5f;
    float mHeatRadius = 0.06f;
    float mHeatRate = 2.0f;
    float mDensityRate = 1.5f;
    float mRenderScale = 4.0f;
    float mDensityThreshold = 0.02f;

    GraphicsBackend* mBackend = nullptr;
    bool mCreated = false;

public:
    FluidSim3D() = default;

    void create(GraphicsBackend& backend, int gridW = 64, int gridH = 64, int gridD = 64) {
        if (gridW <= 0 || gridH <= 0 || gridD <= 0) return;
        mBackend = &backend;
        mGridW = gridW;
        mGridH = gridH;
        mGridD = gridD;
        mCreated = true;

        size_t cellCount = (size_t)gridW * gridH * gridD;

        std::vector<float> zeroVec4(cellCount * 4, 0.0f);
        std::vector<float> zeroScalar(cellCount, 0.0f);

        mVelocity.create(backend, cellCount * 4, zeroVec4.data());
        mDensity.create(backend, cellCount * 4, zeroVec4.data());
        mPressure.create(backend, cellCount, zeroScalar.data());
        mDivergence.create(backend, cellCount, zeroScalar.data());

        mFluidParamsBuffer.create(backend);
        mHeatParamsBuffer.create(backend);

        // Create compute shaders
        mAdvectShader.create(backend, kFluid3DAdvectWGSL);
        mDivergenceShader.create(backend, kFluid3DDivergenceWGSL);
        mPressureShader.create(backend, kFluid3DPressureWGSL);
        mGradientSubtractShader.create(backend, kFluid3DGradientSubtractWGSL);
        mBuoyancyShader.create(backend, kFluid3DBuoyancyWGSL);
        mAddHeatShader.create(backend, kFluid3DAddHeatWGSL);

        // Point cloud rendering buffers
        mBuildPointsShader.create(backend, kFluid3DBuildPointsWGSL);
        mPointCloudBuffer.create(backend, cellCount);  // One GPUParticle per cell
        mBuildParamsBuffer.create(backend);
        mRenderParamsBuffer.create(backend);

        printf("[FluidSim3D] Created %dx%dx%d grid (%zu cells)\n",
               gridW, gridH, gridD, cellCount);
    }

    void destroy() {
        mVelocity.destroy();
        mDensity.destroy();
        mPressure.destroy();
        mDivergence.destroy();
        mFluidParamsBuffer.destroy();
        mHeatParamsBuffer.destroy();
        mAdvectShader.destroy();
        mDivergenceShader.destroy();
        mPressureShader.destroy();
        mGradientSubtractShader.destroy();
        mBuoyancyShader.destroy();
        mAddHeatShader.destroy();
        mBuildPointsShader.destroy();
        mPointCloudBuffer.destroy();
        mBuildParamsBuffer.destroy();
        mRenderParamsBuffer.destroy();
        mCreated = false;
    }

    ~FluidSim3D() { destroy(); }

    // ── Configuration ────────────────────────────────────────────────────

    void setBuoyancy(float b) { mBuoyancy = b; }
    float buoyancy() const { return mBuoyancy; }

    void setDensityDissipation(float d) { mDensityDissipation = d; }
    float densityDissipation() const { return mDensityDissipation; }

    void setPressureIterations(int n) { mPressureIterations = n; }
    int pressureIterations() const { return mPressureIterations; }

    void setHeatSource(float x, float y, float z, float radius = 0.06f) {
        mHeatPosX = x; mHeatPosY = y; mHeatPosZ = z;
        mHeatRadius = radius;
    }

    void setHeatRate(float rate) { mHeatRate = rate; }
    void setDensityRate(float rate) { mDensityRate = rate; }
    void setRenderScale(float s) { mRenderScale = s; }
    void setDensityThreshold(float t) { mDensityThreshold = t; }

    int gridW() const { return mGridW; }
    int gridH() const { return mGridH; }
    int gridD() const { return mGridD; }

    // ── Per-Frame Simulation ─────────────────────────────────────────────

    void step(double dt) {
        if (!mCreated || !mBackend) return;

        float fdt = (float)std::min(dt, 0.033);
        mTime += fdt;

        int groupsX = (mGridW + 3) / 4;
        int groupsY = (mGridH + 3) / 4;
        int groupsZ = (mGridD + 3) / 4;

        // Upload fluid params
        Fluid3DParams fp = {};
        fp.dt = fdt;
        fp.dx = 1.0f / (float)mGridW;
        fp.viscosity = mViscosity;
        fp.dissipation = mVelDissipation;
        fp.gridW = (uint32_t)mGridW;
        fp.gridH = (uint32_t)mGridH;
        fp.gridD = (uint32_t)mGridD;
        fp.buoyancy = mBuoyancy;
        fp.ambientTemp = mAmbientTemp;
        mFluidParamsBuffer.upload(fp);

        // 1. Advect velocity
        mAdvectShader.bind(0, mVelocity.previousHandle());
        mAdvectShader.bind(1, mVelocity.currentHandle());
        mAdvectShader.bindUniform(2, mFluidParamsBuffer.handle());
        mAdvectShader.dispatch(groupsX, groupsY, groupsZ);
        mVelocity.swap();

        // 2. Advect density (with density dissipation)
        fp.dissipation = mDensityDissipation;
        mFluidParamsBuffer.upload(fp);

        mAdvectShader.bind(0, mDensity.previousHandle());
        mAdvectShader.bind(1, mDensity.currentHandle());
        mAdvectShader.bindUniform(2, mFluidParamsBuffer.handle());
        mAdvectShader.dispatch(groupsX, groupsY, groupsZ);
        mDensity.swap();

        // 3. Add heat source
        Heat3DParams hp = {};
        hp.posX = mHeatPosX;
        hp.posY = mHeatPosY;
        hp.posZ = mHeatPosZ;
        hp.radius = mHeatRadius;
        hp.heatRate = mHeatRate * fdt;
        hp.densityRate = mDensityRate * fdt;
        hp.gridW = (uint32_t)mGridW;
        hp.gridH = (uint32_t)mGridH;
        hp.gridD = (uint32_t)mGridD;
        mHeatParamsBuffer.upload(hp);

        mAddHeatShader.bind(0, mDensity.currentHandle());
        mAddHeatShader.bindUniform(1, mHeatParamsBuffer.handle());
        mAddHeatShader.dispatch(groupsX, groupsY, groupsZ);

        // 4. Buoyancy
        fp.dissipation = mVelDissipation;  // restore
        mFluidParamsBuffer.upload(fp);

        mBuoyancyShader.bind(0, mVelocity.currentHandle());
        mBuoyancyShader.bind(1, mDensity.currentHandle());
        mBuoyancyShader.bindUniform(2, mFluidParamsBuffer.handle());
        mBuoyancyShader.dispatch(groupsX, groupsY, groupsZ);

        // 5. Divergence
        mDivergenceShader.bind(0, mVelocity.currentHandle());
        mDivergenceShader.bind(1, mDivergence.handle());
        mDivergenceShader.bindUniform(2, mFluidParamsBuffer.handle());
        mDivergenceShader.dispatch(groupsX, groupsY, groupsZ);

        // 6. Pressure solve (Jacobi iterations)
        for (int iter = 0; iter < mPressureIterations; iter++) {
            mPressureShader.bind(0, mPressure.previousHandle());
            mPressureShader.bind(1, mPressure.currentHandle());
            mPressureShader.bind(2, mDivergence.handle());
            mPressureShader.bindUniform(3, mFluidParamsBuffer.handle());
            mPressureShader.dispatch(groupsX, groupsY, groupsZ);
            mPressure.swap();
        }

        // 7. Gradient subtract
        mGradientSubtractShader.bind(0, mVelocity.currentHandle());
        mGradientSubtractShader.bind(1, mPressure.currentHandle());
        mGradientSubtractShader.bindUniform(2, mFluidParamsBuffer.handle());
        mGradientSubtractShader.dispatch(groupsX, groupsY, groupsZ);
    }

    // ── Rendering ────────────────────────────────────────────────────────

    /// Draw the 3D smoke as a point cloud
    void draw(Graphics& g) {
        if (!mCreated) return;
        if (!Graphics_isWebGPU()) return;

#ifdef ALLOLIB_WEBGPU
        auto* backend = dynamic_cast<WebGPUBackend*>(Graphics_getBackend());
        if (!backend) return;

        int groupsX = (mGridW + 3) / 4;
        int groupsY = (mGridH + 3) / 4;
        int groupsZ = (mGridD + 3) / 4;

        // Build point cloud from density
        BuildPointsParams bp = {};
        bp.gridW = (uint32_t)mGridW;
        bp.gridH = (uint32_t)mGridH;
        bp.gridD = (uint32_t)mGridD;
        bp.scale = mRenderScale;
        bp.offsetX = 0.0f;
        bp.offsetY = 0.0f;
        bp.offsetZ = 0.0f;
        bp.threshold = mDensityThreshold;
        mBuildParamsBuffer.upload(bp);

        mBuildPointsShader.bind(0, mDensity.currentHandle());
        mBuildPointsShader.bind(1, mPointCloudBuffer.handle());
        mBuildPointsShader.bindUniform(2, mBuildParamsBuffer.handle());
        mBuildPointsShader.dispatch(groupsX, groupsY, groupsZ);

        // Render using drawParticles
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
        rp.shapeMode = 0.0f;

        mRenderParamsBuffer.upload(rp);

        int totalCells = mGridW * mGridH * mGridD;
        backend->drawParticles(
            mPointCloudBuffer.handle(),
            mRenderParamsBuffer.handle(),
            totalCells
        );
#endif
    }

    // Non-copyable
    FluidSim3D(const FluidSim3D&) = delete;
    FluidSim3D& operator=(const FluidSim3D&) = delete;

    // Movable
    FluidSim3D(FluidSim3D&& other) noexcept
        : mGridW(other.mGridW), mGridH(other.mGridH), mGridD(other.mGridD),
          mVelocity(std::move(other.mVelocity)),
          mDensity(std::move(other.mDensity)),
          mPressure(std::move(other.mPressure)),
          mDivergence(std::move(other.mDivergence)),
          mFluidParamsBuffer(std::move(other.mFluidParamsBuffer)),
          mHeatParamsBuffer(std::move(other.mHeatParamsBuffer)),
          mAdvectShader(std::move(other.mAdvectShader)),
          mDivergenceShader(std::move(other.mDivergenceShader)),
          mPressureShader(std::move(other.mPressureShader)),
          mGradientSubtractShader(std::move(other.mGradientSubtractShader)),
          mBuoyancyShader(std::move(other.mBuoyancyShader)),
          mAddHeatShader(std::move(other.mAddHeatShader)),
          mBuildPointsShader(std::move(other.mBuildPointsShader)),
          mPointCloudBuffer(std::move(other.mPointCloudBuffer)),
          mBuildParamsBuffer(std::move(other.mBuildParamsBuffer)),
          mRenderParamsBuffer(std::move(other.mRenderParamsBuffer)),
          mBackend(other.mBackend),
          mCreated(other.mCreated) {
        other.mBackend = nullptr;
        other.mCreated = false;
    }

    FluidSim3D& operator=(FluidSim3D&& other) noexcept {
        if (this != &other) {
            destroy();
            mGridW = other.mGridW;
            mGridH = other.mGridH;
            mGridD = other.mGridD;
            mVelocity = std::move(other.mVelocity);
            mDensity = std::move(other.mDensity);
            mPressure = std::move(other.mPressure);
            mDivergence = std::move(other.mDivergence);
            mFluidParamsBuffer = std::move(other.mFluidParamsBuffer);
            mHeatParamsBuffer = std::move(other.mHeatParamsBuffer);
            mAdvectShader = std::move(other.mAdvectShader);
            mDivergenceShader = std::move(other.mDivergenceShader);
            mPressureShader = std::move(other.mPressureShader);
            mGradientSubtractShader = std::move(other.mGradientSubtractShader);
            mBuoyancyShader = std::move(other.mBuoyancyShader);
            mAddHeatShader = std::move(other.mAddHeatShader);
            mBuildPointsShader = std::move(other.mBuildPointsShader);
            mPointCloudBuffer = std::move(other.mPointCloudBuffer);
            mBuildParamsBuffer = std::move(other.mBuildParamsBuffer);
            mRenderParamsBuffer = std::move(other.mRenderParamsBuffer);
            mBackend = other.mBackend;
            mCreated = other.mCreated;
            other.mBackend = nullptr;
            other.mCreated = false;
        }
        return *this;
    }
};

} // namespace al

#endif // AL_WEBGPU_FLUID_3D_HPP
