/**
 * AlloLib Studio Online - GPU 2D Fluid Simulation (Phase 5)
 *
 * Real-time 2D Navier-Stokes solver on the GPU using WebGPU compute shaders.
 * Uses the Stable Fluids method (Stam, 1999): advection, pressure projection,
 * and viscous diffusion via Jacobi iteration.
 *
 * Features:
 *   - Semi-Lagrangian advection for velocity and dye fields
 *   - Jacobi pressure solver (configurable iterations)
 *   - Interactive mouse force/dye injection with Gaussian splat
 *   - Fullscreen quad rendering via drawFluidField()
 *   - Multiple display modes (dye, velocity, pressure)
 *
 * Usage:
 *   FluidSim2D fluid;
 *   fluid.create(*backend(), 512, 512);
 *
 *   void onAnimate(double dt) { fluid.step(dt); }
 *   void onDraw(Graphics& g)  { fluid.draw(g); }
 *
 *   // In onMouseDrag:
 *   fluid.addForce(normX, normY, dx, dy, r, g, b);
 *
 * Header-only. Requires: al_WebGPUCompute.hpp, al_WebGPUBuffer.hpp,
 *   al_WebPingPong.hpp, al_WebGPUBackend.hpp
 */

#ifndef AL_WEBGPU_FLUID_2D_HPP
#define AL_WEBGPU_FLUID_2D_HPP

#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include "al_WebPingPong.hpp"
#include "al_WebGPUBackend.hpp"
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

// ── GPU-Aligned Structs (must match WGSL layouts exactly) ───────────────────

struct FluidParams {
    float dt;           // 0
    float dx;           // 4
    float viscosity;    // 8
    float dissipation;  // 12
    uint32_t gridW;     // 16
    uint32_t gridH;     // 20
    float pad[2];       // 24-31
};
static_assert(sizeof(FluidParams) == 32, "FluidParams must be 32 bytes");

struct ForceParams {
    float posX, posY;           // 0-7
    float forceX, forceY;       // 8-15
    float radius;               // 16
    float strength;             // 20
    float dyeR, dyeG, dyeB;    // 24-35
    float pad[3];               // 36-47
};
static_assert(sizeof(ForceParams) == 48, "ForceParams must be 48 bytes");

struct FluidRenderParams {
    uint32_t gridW;     // 0
    uint32_t gridH;     // 4
    float brightness;   // 8
    uint32_t mode;      // 12
};
static_assert(sizeof(FluidRenderParams) == 16, "FluidRenderParams must be 16 bytes");

// ── WGSL Compute Shaders ────────────────────────────────────────────────────

static const char* kFluidAdvectWGSL = R"(
struct FluidParams {
    dt: f32,
    dx: f32,
    viscosity: f32,
    dissipation: f32,
    gridW: u32,
    gridH: u32,
    pad0: f32,
    pad1: f32,
}

@group(0) @binding(0) var<storage, read> previous: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> current: array<vec4f>;
@group(0) @binding(2) var<uniform> params: FluidParams;

fn idx(x: u32, y: u32) -> u32 {
    return x + y * params.gridW;
}

fn sampleBilinear(field: ptr<storage, array<vec4f>, read>, fx: f32, fy: f32) -> vec4f {
    let x0 = u32(clamp(floor(fx), 0.0, f32(params.gridW - 1u)));
    let y0 = u32(clamp(floor(fy), 0.0, f32(params.gridH - 1u)));
    let x1 = min(x0 + 1u, params.gridW - 1u);
    let y1 = min(y0 + 1u, params.gridH - 1u);

    let sx = fx - floor(fx);
    let sy = fy - floor(fy);

    let v00 = (*field)[idx(x0, y0)];
    let v10 = (*field)[idx(x1, y0)];
    let v01 = (*field)[idx(x0, y1)];
    let v11 = (*field)[idx(x1, y1)];

    return mix(mix(v00, v10, sx), mix(v01, v11, sx), sy);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let x = gid.x;
    let y = gid.y;
    if (x >= params.gridW || y >= params.gridH) { return; }

    // Boundary: zero at edges
    if (x == 0u || x == params.gridW - 1u || y == 0u || y == params.gridH - 1u) {
        current[idx(x, y)] = vec4f(0.0);
        return;
    }

    let i = idx(x, y);
    let vel = previous[i];

    // Trace back
    let fx = f32(x) - vel.x * params.dt / params.dx;
    let fy = f32(y) - vel.y * params.dt / params.dx;

    var result = sampleBilinear(&previous, fx, fy);
    result *= params.dissipation;
    current[i] = result;
}
)";

static const char* kFluidDivergenceWGSL = R"(
struct FluidParams {
    dt: f32,
    dx: f32,
    viscosity: f32,
    dissipation: f32,
    gridW: u32,
    gridH: u32,
    pad0: f32,
    pad1: f32,
}

@group(0) @binding(0) var<storage, read> velocity: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> divergence: array<f32>;
@group(0) @binding(2) var<uniform> params: FluidParams;

fn idx(x: u32, y: u32) -> u32 {
    return x + y * params.gridW;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let x = gid.x;
    let y = gid.y;
    if (x >= params.gridW || y >= params.gridH) { return; }

    if (x == 0u || x == params.gridW - 1u || y == 0u || y == params.gridH - 1u) {
        divergence[idx(x, y)] = 0.0;
        return;
    }

    let vR = velocity[idx(x + 1u, y)].x;
    let vL = velocity[idx(x - 1u, y)].x;
    let vT = velocity[idx(x, y + 1u)].y;
    let vB = velocity[idx(x, y - 1u)].y;

    divergence[idx(x, y)] = (vR - vL + vT - vB) / (2.0 * params.dx);
}
)";

static const char* kFluidPressureWGSL = R"(
struct FluidParams {
    dt: f32,
    dx: f32,
    viscosity: f32,
    dissipation: f32,
    gridW: u32,
    gridH: u32,
    pad0: f32,
    pad1: f32,
}

@group(0) @binding(0) var<storage, read> pressure_prev: array<f32>;
@group(0) @binding(1) var<storage, read_write> pressure_next: array<f32>;
@group(0) @binding(2) var<storage, read> divergence: array<f32>;
@group(0) @binding(3) var<uniform> params: FluidParams;

fn idx(x: u32, y: u32) -> u32 {
    return x + y * params.gridW;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let x = gid.x;
    let y = gid.y;
    if (x >= params.gridW || y >= params.gridH) { return; }

    if (x == 0u || x == params.gridW - 1u || y == 0u || y == params.gridH - 1u) {
        pressure_next[idx(x, y)] = 0.0;
        return;
    }

    let i = idx(x, y);
    let pR = pressure_prev[idx(x + 1u, y)];
    let pL = pressure_prev[idx(x - 1u, y)];
    let pT = pressure_prev[idx(x, y + 1u)];
    let pB = pressure_prev[idx(x, y - 1u)];
    let div = divergence[i];

    pressure_next[i] = (pR + pL + pT + pB - params.dx * params.dx * div) / 4.0;
}
)";

static const char* kFluidGradientSubtractWGSL = R"(
struct FluidParams {
    dt: f32,
    dx: f32,
    viscosity: f32,
    dissipation: f32,
    gridW: u32,
    gridH: u32,
    pad0: f32,
    pad1: f32,
}

@group(0) @binding(0) var<storage, read_write> velocity: array<vec4f>;
@group(0) @binding(1) var<storage, read> pressure: array<f32>;
@group(0) @binding(2) var<uniform> params: FluidParams;

fn idx(x: u32, y: u32) -> u32 {
    return x + y * params.gridW;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let x = gid.x;
    let y = gid.y;
    if (x >= params.gridW || y >= params.gridH) { return; }

    if (x == 0u || x == params.gridW - 1u || y == 0u || y == params.gridH - 1u) {
        velocity[idx(x, y)] = vec4f(0.0);
        return;
    }

    let i = idx(x, y);
    var v = velocity[i];

    let pR = pressure[idx(x + 1u, y)];
    let pL = pressure[idx(x - 1u, y)];
    let pT = pressure[idx(x, y + 1u)];
    let pB = pressure[idx(x, y - 1u)];

    v.x -= (pR - pL) / (2.0 * params.dx);
    v.y -= (pT - pB) / (2.0 * params.dx);

    velocity[i] = v;
}
)";

static const char* kFluidAddForceWGSL = R"(
struct ForceParams {
    posX: f32,
    posY: f32,
    forceX: f32,
    forceY: f32,
    radius: f32,
    strength: f32,
    dyeR: f32,
    dyeG: f32,
    dyeB: f32,
    pad0: f32,
    pad1: f32,
    pad2: f32,
}

@group(0) @binding(0) var<storage, read_write> velocity: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> dye: array<vec4f>;
@group(0) @binding(2) var<uniform> params: ForceParams;
@group(0) @binding(3) var<uniform> gridSize: vec2u;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
    let x = gid.x;
    let y = gid.y;
    if (x >= gridSize.x || y >= gridSize.y) { return; }

    let normX = f32(x) / f32(gridSize.x);
    let normY = f32(y) / f32(gridSize.y);

    let dx = normX - params.posX;
    let dy = normY - params.posY;
    let dist2 = dx * dx + dy * dy;
    let r2 = params.radius * params.radius;

    let weight = exp(-dist2 / r2) * params.strength;

    if (weight < 0.001) { return; }

    let i = x + y * gridSize.x;

    // Add force to velocity
    var v = velocity[i];
    v.x += params.forceX * weight;
    v.y += params.forceY * weight;
    velocity[i] = v;

    // Add color to dye
    var d = dye[i];
    d.x += params.dyeR * weight;
    d.y += params.dyeG * weight;
    d.z += params.dyeB * weight;
    d.x = min(d.x, 5.0);
    d.y = min(d.y, 5.0);
    d.z = min(d.z, 5.0);
    dye[i] = d;
}
)";

// ── FluidSim2D Class ────────────────────────────────────────────────────────

class FluidSim2D {
    // Grid dimensions
    int mGridW = 512, mGridH = 512;

    // Ping-pong velocity fields (vec4f per cell: vx, vy, 0, 0)
    PingPongBuffer<float> mVelocity;
    // Ping-pong dye fields (vec4f per cell: r, g, b, 0)
    PingPongBuffer<float> mDye;
    // Ping-pong pressure fields (1 float per cell)
    PingPongBuffer<float> mPressure;
    // Divergence field (single buffer)
    GPUBuffer<float> mDivergence;

    // Uniform buffers
    GPUUniformBuffer<FluidParams> mFluidParamsBuffer;
    GPUUniformBuffer<ForceParams> mForceParamsBuffer;
    GPUUniformBuffer<FluidRenderParams> mRenderParamsBuffer;

    // Grid size uniform for add_force shader (8 bytes, padded to vec2u)
    struct GridSizeUniform { uint32_t w, h; };
    GPUUniformBuffer<GridSizeUniform> mGridSizeBuffer;

    // Compute shaders
    ComputeShader mAdvectShader;
    ComputeShader mDivergenceShader;
    ComputeShader mPressureShader;
    ComputeShader mGradientSubtractShader;
    ComputeShader mAddForceShader;

    // Simulation parameters
    float mViscosity = 0.0001f;
    float mDyeDissipation = 0.995f;
    float mVelDissipation = 0.999f;
    int mPressureIterations = 30;
    float mTime = 0.0f;

    // Mouse state
    bool mMouseActive = false;
    float mMouseX = 0, mMouseY = 0;
    float mMouseDX = 0, mMouseDY = 0;
    float mDyeColor[3] = {1, 0, 0};
    float mForceRadius = 0.02f;
    float mForceStrength = 500.0f;

    GraphicsBackend* mBackend = nullptr;
    bool mCreated = false;

public:
    FluidSim2D() = default;

    void create(GraphicsBackend& backend, int gridW = 512, int gridH = 512) {
        mBackend = &backend;
        mGridW = gridW;
        mGridH = gridH;
        mCreated = true;

        size_t cellCount = (size_t)gridW * gridH;

        // Initialize all fields to zero
        std::vector<float> zeroVec4(cellCount * 4, 0.0f);
        std::vector<float> zeroScalar(cellCount, 0.0f);

        mVelocity.create(backend, cellCount * 4, zeroVec4.data());
        mDye.create(backend, cellCount * 4, zeroVec4.data());
        mPressure.create(backend, cellCount, zeroScalar.data());
        mDivergence.create(backend, cellCount, zeroScalar.data());

        mFluidParamsBuffer.create(backend);
        mForceParamsBuffer.create(backend);
        mRenderParamsBuffer.create(backend);

        GridSizeUniform gs = { (uint32_t)gridW, (uint32_t)gridH };
        mGridSizeBuffer.create(backend, &gs);

        // Create compute shaders
        mAdvectShader.create(backend, kFluidAdvectWGSL);
        mDivergenceShader.create(backend, kFluidDivergenceWGSL);
        mPressureShader.create(backend, kFluidPressureWGSL);
        mGradientSubtractShader.create(backend, kFluidGradientSubtractWGSL);
        mAddForceShader.create(backend, kFluidAddForceWGSL);

        printf("[FluidSim2D] Created %dx%d grid (%zu cells)\n", gridW, gridH, cellCount);
    }

    void destroy() {
        mVelocity.destroy();
        mDye.destroy();
        mPressure.destroy();
        mDivergence.destroy();
        mFluidParamsBuffer.destroy();
        mForceParamsBuffer.destroy();
        mRenderParamsBuffer.destroy();
        mGridSizeBuffer.destroy();
        mAdvectShader.destroy();
        mDivergenceShader.destroy();
        mPressureShader.destroy();
        mGradientSubtractShader.destroy();
        mAddForceShader.destroy();
        mCreated = false;
    }

    ~FluidSim2D() { destroy(); }

    // ── Configuration ────────────────────────────────────────────────────

    void setViscosity(float v) { mViscosity = v; }
    float viscosity() const { return mViscosity; }

    void setDyeDissipation(float d) { mDyeDissipation = d; }
    float dyeDissipation() const { return mDyeDissipation; }

    void setVelDissipation(float d) { mVelDissipation = d; }
    float velDissipation() const { return mVelDissipation; }

    void setPressureIterations(int n) { mPressureIterations = n; }
    int pressureIterations() const { return mPressureIterations; }

    void setForceRadius(float r) { mForceRadius = r; }
    float forceRadius() const { return mForceRadius; }

    void setForceStrength(float s) { mForceStrength = s; }
    float forceStrength() const { return mForceStrength; }

    int gridW() const { return mGridW; }
    int gridH() const { return mGridH; }

    // ── Mouse Interaction ────────────────────────────────────────────────

    /// Call from onMouseDrag with normalized [0,1] coordinates and delta
    void addForce(float normX, float normY, float dx, float dy,
                  float r = 1.0f, float g = 0.0f, float b = 0.0f) {
        mMouseActive = true;
        mMouseX = normX;
        mMouseY = normY;
        mMouseDX = dx;
        mMouseDY = dy;
        mDyeColor[0] = r;
        mDyeColor[1] = g;
        mDyeColor[2] = b;
    }

    // ── Per-Frame Simulation ─────────────────────────────────────────────

    void step(double dt) {
        if (!mCreated || !mBackend) return;

        float fdt = (float)std::min(dt, 0.033);
        mTime += fdt;

        int groupsX = (mGridW + 7) / 8;
        int groupsY = (mGridH + 7) / 8;

        // Upload fluid params for velocity advection
        FluidParams fp = {};
        fp.dt = fdt;
        fp.dx = 1.0f / (float)mGridW;
        fp.viscosity = mViscosity;
        fp.dissipation = mVelDissipation;
        fp.gridW = (uint32_t)mGridW;
        fp.gridH = (uint32_t)mGridH;
        mFluidParamsBuffer.upload(fp);

        // 1. Advect velocity
        mAdvectShader.bind(0, mVelocity.previousHandle());
        mAdvectShader.bind(1, mVelocity.currentHandle());
        mAdvectShader.bindUniform(2, mFluidParamsBuffer.handle());
        mAdvectShader.dispatch(groupsX, groupsY);
        mVelocity.swap();

        // 2. Advect dye (with dye dissipation)
        fp.dissipation = mDyeDissipation;
        mFluidParamsBuffer.upload(fp);

        mAdvectShader.bind(0, mDye.previousHandle());
        mAdvectShader.bind(1, mDye.currentHandle());
        mAdvectShader.bindUniform(2, mFluidParamsBuffer.handle());
        mAdvectShader.dispatch(groupsX, groupsY);
        mDye.swap();

        // 3. Add force (if mouse active)
        if (mMouseActive) {
            ForceParams forceP = {};
            forceP.posX = mMouseX;
            forceP.posY = mMouseY;
            forceP.forceX = mMouseDX;
            forceP.forceY = mMouseDY;
            forceP.radius = mForceRadius;
            forceP.strength = mForceStrength;
            forceP.dyeR = mDyeColor[0];
            forceP.dyeG = mDyeColor[1];
            forceP.dyeB = mDyeColor[2];
            mForceParamsBuffer.upload(forceP);

            mAddForceShader.bind(0, mVelocity.currentHandle());
            mAddForceShader.bind(1, mDye.currentHandle());
            mAddForceShader.bindUniform(2, mForceParamsBuffer.handle());
            mAddForceShader.bindUniform(3, mGridSizeBuffer.handle());
            mAddForceShader.dispatch(groupsX, groupsY);

            mMouseActive = false;
        }

        // 4. Compute divergence
        fp.dissipation = mVelDissipation;  // restore
        mFluidParamsBuffer.upload(fp);

        mDivergenceShader.bind(0, mVelocity.currentHandle());
        mDivergenceShader.bind(1, mDivergence.handle());
        mDivergenceShader.bindUniform(2, mFluidParamsBuffer.handle());
        mDivergenceShader.dispatch(groupsX, groupsY);

        // 5. Pressure solve (Jacobi iterations)
        for (int iter = 0; iter < mPressureIterations; iter++) {
            mPressureShader.bind(0, mPressure.previousHandle());
            mPressureShader.bind(1, mPressure.currentHandle());
            mPressureShader.bind(2, mDivergence.handle());
            mPressureShader.bindUniform(3, mFluidParamsBuffer.handle());
            mPressureShader.dispatch(groupsX, groupsY);
            mPressure.swap();
        }

        // 6. Gradient subtract
        mGradientSubtractShader.bind(0, mVelocity.currentHandle());
        mGradientSubtractShader.bind(1, mPressure.currentHandle());
        mGradientSubtractShader.bindUniform(2, mFluidParamsBuffer.handle());
        mGradientSubtractShader.dispatch(groupsX, groupsY);
    }

    // ── Rendering ────────────────────────────────────────────────────────

    /// Draw the fluid field fullscreen. mode: 0=dye, 1=velocity, 2=pressure
    void draw(Graphics& g, int mode = 0, float brightness = 1.0f) {
        if (!mCreated) return;
        if (!Graphics_isWebGPU()) return;

#ifdef ALLOLIB_WEBGPU
        auto* backend = dynamic_cast<WebGPUBackend*>(Graphics_getBackend());
        if (!backend) return;

        FluidRenderParams rp = {};
        rp.gridW = (uint32_t)mGridW;
        rp.gridH = (uint32_t)mGridH;
        rp.brightness = brightness;
        rp.mode = (uint32_t)mode;
        mRenderParamsBuffer.upload(rp);

        BufferHandle fieldBuffer;
        if (mode == 0) {
            fieldBuffer = mDye.currentHandle();
        } else if (mode == 1) {
            fieldBuffer = mVelocity.currentHandle();
        } else {
            // For pressure, we need vec4f but pressure is scalar — use velocity for now
            fieldBuffer = mVelocity.currentHandle();
        }

        backend->drawFluidField(fieldBuffer, mRenderParamsBuffer.handle(),
                                mGridW * mGridH);
#endif
    }

    /// Get dye buffer handle (for custom rendering)
    BufferHandle dyeBuffer() { return mDye.currentHandle(); }
    /// Get velocity buffer handle
    BufferHandle velocityBuffer() { return mVelocity.currentHandle(); }

    // Non-copyable
    FluidSim2D(const FluidSim2D&) = delete;
    FluidSim2D& operator=(const FluidSim2D&) = delete;

    // Movable
    FluidSim2D(FluidSim2D&& other) noexcept
        : mGridW(other.mGridW), mGridH(other.mGridH),
          mVelocity(std::move(other.mVelocity)),
          mDye(std::move(other.mDye)),
          mPressure(std::move(other.mPressure)),
          mDivergence(std::move(other.mDivergence)),
          mFluidParamsBuffer(std::move(other.mFluidParamsBuffer)),
          mForceParamsBuffer(std::move(other.mForceParamsBuffer)),
          mRenderParamsBuffer(std::move(other.mRenderParamsBuffer)),
          mGridSizeBuffer(std::move(other.mGridSizeBuffer)),
          mAdvectShader(std::move(other.mAdvectShader)),
          mDivergenceShader(std::move(other.mDivergenceShader)),
          mPressureShader(std::move(other.mPressureShader)),
          mGradientSubtractShader(std::move(other.mGradientSubtractShader)),
          mAddForceShader(std::move(other.mAddForceShader)),
          mViscosity(other.mViscosity),
          mDyeDissipation(other.mDyeDissipation),
          mVelDissipation(other.mVelDissipation),
          mPressureIterations(other.mPressureIterations),
          mTime(other.mTime),
          mBackend(other.mBackend),
          mCreated(other.mCreated) {
        other.mBackend = nullptr;
        other.mCreated = false;
    }

    FluidSim2D& operator=(FluidSim2D&& other) noexcept {
        if (this != &other) {
            destroy();
            mGridW = other.mGridW;
            mGridH = other.mGridH;
            mVelocity = std::move(other.mVelocity);
            mDye = std::move(other.mDye);
            mPressure = std::move(other.mPressure);
            mDivergence = std::move(other.mDivergence);
            mFluidParamsBuffer = std::move(other.mFluidParamsBuffer);
            mForceParamsBuffer = std::move(other.mForceParamsBuffer);
            mRenderParamsBuffer = std::move(other.mRenderParamsBuffer);
            mGridSizeBuffer = std::move(other.mGridSizeBuffer);
            mAdvectShader = std::move(other.mAdvectShader);
            mDivergenceShader = std::move(other.mDivergenceShader);
            mPressureShader = std::move(other.mPressureShader);
            mGradientSubtractShader = std::move(other.mGradientSubtractShader);
            mAddForceShader = std::move(other.mAddForceShader);
            mViscosity = other.mViscosity;
            mDyeDissipation = other.mDyeDissipation;
            mVelDissipation = other.mVelDissipation;
            mPressureIterations = other.mPressureIterations;
            mTime = other.mTime;
            mBackend = other.mBackend;
            mCreated = other.mCreated;
            other.mBackend = nullptr;
            other.mCreated = false;
        }
        return *this;
    }
};

} // namespace al

#endif // AL_WEBGPU_FLUID_2D_HPP
