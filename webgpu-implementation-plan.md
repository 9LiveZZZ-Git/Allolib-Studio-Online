# AlloLib Studio Online: WebGPU Backend Implementation Plan

**Write, compile, and run AlloLib C++ code with modern GPU compute capabilities directly in your browser.**

---

## Executive Summary

Add a parallel WebGPU rendering backend to AlloLib Studio Online, enabling students to switch between WebGL2 (compatibility) and WebGPU (modern/compute) at project creation time. The WebGPU path unlocks GPU compute shaders for professional-grade VFX: particle systems, fluid simulation, volumetrics, and more.

| | |
|---|---|
| **Timeline** | 17–25 weeks |
| **Complexity** | High |
| **Outcome** | A creative coding environment with VFX and GPU audio capabilities rivaling game engine particle/fluid systems, plus massively parallel audio synthesis and zero-copy audio-visual bridging |

### Why WebGPU?

- **W3C standard** backed by Apple, Google, Mozilla, and Microsoft
- **Shipped in Chrome, Edge, and Safari** — not experimental
- Maps directly to Metal, Vulkan, and D3D12 under the hood
- Compute shaders are the key unlock for GPU particles, fluids, and physics
- WebGL2 is in maintenance mode — all browser GPU innovation is in WebGPU
- Students learn the **modern explicit API model** that mirrors Vulkan/Metal/D3D12

### Educational Value

| WebGL2 Path | WebGPU Path |
|-------------|-------------|
| Classic OpenGL mental model | Modern explicit API design |
| Immediate-mode patterns | Command buffer / queue model |
| GLSL (still everywhere) | WGSL (the future, teaches SPIR-V concepts) |
| "It just works" simplicity | Understanding GPU synchronization |
| Legacy compatibility | Compute shaders, real parallelism |

Having both side-by-side is pedagogically valuable. Students start with WebGL2 (simpler, more forgiving), graduate to WebGPU when they need compute, and understand *why* the abstractions differ.

---

## Architecture Overview

### Current Architecture

```
User's C++ Code
      ↓
AlloLib (OpenGL ES 3.0 calls)
      ↓
Emscripten
      ↓
WebGL2 in Browser
```

### Proposed Architecture (Parallel System)

```
┌──────────────────────────────────────────────────────────────┐
│                    User's C++ Code                            │
│              (unchanged — same API surface)                   │
└─────────────────────────┬────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│                   al::WebApp (modified)                       │
│              selectBackend() at construction                  │
└─────────┬───────────────────────────────────┬────────────────┘
          │                                   │
┌─────────▼─────────────┐       ┌─────────────▼────────────────┐
│   WebGL2 Path         │       │   WebGPU Path                │
│   (current default)   │       │   (new parallel option)      │
│                       │       │                              │
│  ┌─────────────────┐  │       │  ┌────────────────────────┐  │
│  │ al::Graphics    │  │       │  │ al_WebGPUBackend       │  │
│  │ (existing)      │  │       │  │ WGSL shaders           │  │
│  │ GLSL ES 3.0     │  │       │  │ ✓ Compute shaders      │  │
│  │ No compute      │  │       │  │ ✓ GPU particles        │  │
│  │ ✓ Max compat    │  │       │  │ ✓ Fluid simulation     │  │
│  └─────────────────┘  │       │  └────────────────────────┘  │
│                       │       │                              │
│  Existing systems:    │       │  New systems:                │
│  - al_WebPBR          │       │  - al_WebGPUCompute          │
│  - al_WebAutoLOD      │       │  - al_WebGPUParticles        │
│  - al_WebEnvironment  │       │  - al_WebGPUFluid            │
│  - al_WebTexture      │       │  - al_WebGPUAudio            │
│  - al_WebHDR          │       │                              │
└───────────────────────┘       └──────────────────────────────┘
```

### Repository Structure (Integrated with Existing)

```
allolib-wasm/
  include/
    # Existing files (unchanged)
    al_WebApp.hpp             # Modified: add backend selection
    al_WebPBR.hpp             # Unchanged
    al_WebAutoLOD.hpp         # Unchanged
    al_WebEnvironment.hpp     # Unchanged
    al_WebTexture.hpp         # Unchanged
    al_WebHDR.hpp             # Unchanged
    al_WebFile.hpp            # Unchanged
    ...

    # NEW: Graphics Backend Abstraction
    al_WebGraphicsBackend.hpp    # Abstract interface
    al_WebGL2Backend.hpp         # Wraps existing OpenGL path
    al_WebGPUBackend.hpp         # New WebGPU implementation
    al_WebGPUDevice.hpp          # WebGPU device/queue management

    # NEW: Compute Infrastructure
    al_WebGPUCompute.hpp         # ComputeShader wrapper
    al_WebGPUBuffer.hpp          # GPU storage buffer
    al_WebGPUTexture.hpp         # Storage textures for compute
    al_WebPingPong.hpp           # Double-buffer utility

    # NEW: VFX Systems
    al_WebGPUParticles.hpp       # GPU particle system
    al_WebGPUFluid2D.hpp         # 2D fluid simulation
    al_WebGPUFluid3D.hpp         # 3D volumetric fluid
    al_WebGPUVectorField.hpp     # Force fields

    # NEW: GPU Audio
    al_WebGPUAudio.hpp           # GPU audio buffer management
    al_WebGPUFFT.hpp             # GPU FFT engine
    al_WebGPUGranular.hpp        # Massive granular synthesis
    al_WebGPUConvolution.hpp     # GPU convolution reverb
    al_WebGPUPhysical.hpp        # Physical modeling (membrane, string)
    al_WebAudioVisualBridge.hpp  # Zero-copy audio→visual pipeline

  src/
    # Existing files
    al_WebApp.cpp              # Modified: backend initialization
    al_DefaultShaders_Web.cpp  # Unchanged
    ...

    # NEW: Backend implementations
    al_WebGraphicsBackend.cpp
    al_WebGL2Backend.cpp
    al_WebGPUBackend.cpp
    al_WebGPUCompute.cpp
    al_WebGPUParticles.cpp
    al_WebGPUFluid.cpp
    al_WebGPUAudio.cpp

  shaders/
    glsl/                    # Existing shaders, reorganized
      basic.vert
      basic.frag
      pbr.vert
      pbr.frag
      ...
    wgsl/                    # NEW: WebGPU shaders
      basic.vert.wgsl
      basic.frag.wgsl
      pbr.vert.wgsl
      pbr.frag.wgsl
      particles_update.compute.wgsl
      particles_emit.compute.wgsl
      fluid_advect.compute.wgsl
      fluid_pressure.compute.wgsl
      audio_fft.compute.wgsl
      audio_granular.compute.wgsl
      ...

  CMakeLists.txt             # Modified: dual-target build support
```

---

## Phase 0: Foundation & Toolchain Validation

**Duration:** 1–2 weeks

### 0.1 Emscripten WebGPU Proof of Concept

Before touching AlloLib, verify the toolchain works end-to-end.

**Deliverable:** Standalone WASM that renders a spinning cube via WebGPU.

```cpp
// test_webgpu.cpp
#include <webgpu/webgpu.h>
#include <emscripten/html5_webgpu.h>
#include <emscripten/emscripten.h>

WGPUDevice device;
WGPUQueue queue;
WGPURenderPipeline pipeline;

void frame() {
    // Render one frame
}

int main() {
    device = emscripten_webgpu_get_device();
    queue = wgpuDeviceGetQueue(device);

    // Setup pipeline, buffers, etc.

    emscripten_set_main_loop(frame, 0, true);
    return 0;
}
```

**Build command:**

```bash
emcc test_webgpu.cpp -o test.html \
    -sUSE_WEBGPU=1 \
    -sASYNCIFY \
    --shell-file shell.html
```

**Success criteria:**

- [ ] Compiles without errors
- [ ] Runs in Chrome/Edge
- [ ] Renders geometry
- [ ] Handles resize events

### 0.2 Shader Tooling Setup

Establish the shader workflow before writing lots of code.

**Option A — Manual dual-write (recommended to start):**

```
shaders/
  glsl/basic.vert
  glsl/basic.frag
  wgsl/basic.vert.wgsl
  wgsl/basic.frag.wgsl
```

**Option B — Naga transpilation pipeline (add later if needed):**

```bash
# GLSL → SPIR-V → WGSL
glslangValidator -V shader.vert -o shader.vert.spv
naga shader.vert.spv shader.vert.wgsl
```

**Recommendation:** Start with manual dual-write for core shaders (there are roughly 10–15). Add transpilation later if maintenance becomes painful.

**Deliverable:** Document the shader workflow, create template files for both languages.

### 0.3 Phase 0 Checklist

- [x] Emscripten WebGPU builds and runs in browser
- [x] Understand Emscripten's `webgpu.h` and `html5_webgpu.h` APIs
- [x] Shader workflow documented (see `allolib-wasm/shaders/README.md`)
- [x] Template WGSL files created alongside existing GLSL (see `allolib-wasm/shaders/wgsl/`)

---

## Proof of Concept Findings (Critical)

The following issues were discovered during proof of concept testing and **must be followed** throughout development.

### Emscripten Version Requirement

**Use Emscripten 3.1.73 or later.** Version 3.1.50 has incompatible WebGPU API types.

```dockerfile
# Dockerfile - use this version
FROM emscripten/emsdk:3.1.73
```

Older versions fail with errors like:
- `unknown type name 'WGPUSurfaceConfiguration'`
- `use of undeclared identifier 'WGPUCompositeAlphaMode_Opaque'`

### JavaScript-Side WebGPU Initialization (Required)

**WebGPU device MUST be initialized from JavaScript BEFORE loading the WASM module.** The device is then passed to Emscripten via `Module.preinitializedWebGPUDevice`.

```html
<script>
    var Module = {
        canvas: document.getElementById('canvas'),
    };

    async function init() {
        // Check WebGPU support
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported in this browser');
        }

        // Initialize WebGPU from JavaScript
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('Failed to get WebGPU adapter');
        }

        const device = await adapter.requestDevice();
        if (!device) {
            throw new Error('Failed to get WebGPU device');
        }

        // Pass device to Emscripten BEFORE loading the script
        Module.preinitializedWebGPUDevice = device;

        // NOW load the WASM script dynamically
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'my_app.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load WASM script'));
            document.body.appendChild(script);
        });
    }

    init().catch(err => console.error(err));
</script>
```

**Why:** Calling `emscripten_webgpu_get_device()` without pre-initialization returns undefined, causing `TypeError: Cannot read properties of undefined (reading 'queue')`.

### SwapChain API (Not Surface Present)

**Emscripten uses the older SwapChain API**, not the newer Surface Configure/Present API.

```cpp
// WRONG - causes "wgpuSurfacePresent is unsupported" error
WGPUSurfaceConfiguration config = {};
wgpuSurfaceConfigure(surface, &config);
// In frame:
WGPUSurfaceTexture surfaceTexture;
wgpuSurfaceGetCurrentTexture(surface, &surfaceTexture);
wgpuSurfacePresent(surface);  // FAILS

// CORRECT - use SwapChain API
WGPUSwapChainDescriptor swapChainDesc = {};
swapChainDesc.usage = WGPUTextureUsage_RenderAttachment;
swapChainDesc.format = WGPUTextureFormat_BGRA8Unorm;
swapChainDesc.width = canvasWidth;
swapChainDesc.height = canvasHeight;
swapChainDesc.presentMode = WGPUPresentMode_Fifo;

WGPUSwapChain swapChain = wgpuDeviceCreateSwapChain(device, surface, &swapChainDesc);

// In frame:
WGPUTextureView targetView = wgpuSwapChainGetCurrentTextureView(swapChain);
// ... render ...
// SwapChain presents automatically when texture view is released
wgpuTextureViewRelease(targetView);
```

### depthSlice for 2D Attachments

**For non-3D texture attachments, `depthSlice` must be set to `WGPU_DEPTH_SLICE_UNDEFINED`.**

```cpp
#include <cstdint>  // For UINT32_MAX

WGPURenderPassColorAttachment colorAttachment = {};
colorAttachment.view = targetView;
colorAttachment.loadOp = WGPULoadOp_Clear;
colorAttachment.storeOp = WGPUStoreOp_Store;
colorAttachment.clearValue = {0.1, 0.1, 0.15, 1.0};

// CRITICAL: Set depthSlice to undefined for 2D textures
#ifdef WGPU_DEPTH_SLICE_UNDEFINED
colorAttachment.depthSlice = WGPU_DEPTH_SLICE_UNDEFINED;
#else
colorAttachment.depthSlice = UINT32_MAX;  // Undefined for non-3D textures
#endif
```

**Why:** Zero-initialization sets `depthSlice = 0`, which is interpreted as "slice 0 of a 3D texture". For 2D textures, this causes validation error: `depthSlice (0) is defined for a non-3D attachment`.

### WebGPU Clip Space (Z: 0 to 1)

**WebGPU uses Z clip space [0, 1], not OpenGL's [-1, 1].** Perspective matrices must be adjusted.

```cpp
// OpenGL perspective (Z: -1 to 1) - WRONG for WebGPU
out[10] = (far + near) / (near - far);
out[14] = (2.0f * far * near) / (near - far);

// WebGPU perspective (Z: 0 to 1) - CORRECT
out[10] = far / (near - far);
out[14] = (far * near) / (near - far);
```

### Column-Major Matrices for WGSL

**WGSL expects column-major matrix storage.** All matrix functions must use column-major conventions.

```cpp
// Column-major matrix multiplication
void mat4Multiply(float* out, const float* a, const float* b) {
    float result[16];
    for (int col = 0; col < 4; col++) {
        for (int row = 0; row < 4; row++) {
            float sum = 0;
            for (int k = 0; k < 4; k++) {
                // a[row][k] * b[k][col] in column-major storage
                sum += a[k * 4 + row] * b[col * 4 + k];
            }
            result[col * 4 + row] = sum;
        }
    }
    memcpy(out, result, sizeof(result));
}

// Column-major rotation matrices
// Element at (row, col) is stored at index col*4 + row
void mat4RotateY(float* out, float angle) {
    mat4Identity(out);
    float c = cosf(angle);
    float s = sinf(angle);
    out[0] = c;      // col 0, row 0
    out[2] = -s;     // col 0, row 2
    out[8] = s;      // col 2, row 0
    out[10] = c;     // col 2, row 2
}
```

### Summary: Proof of Concept Test Results

| Test | Status | Notes |
|------|--------|-------|
| Emscripten 3.1.50 | ❌ Failed | API incompatibility |
| Emscripten 3.1.73 | ✅ Passed | Use this version |
| JS device init | ✅ Required | Must use `Module.preinitializedWebGPUDevice` |
| SwapChain API | ✅ Required | Surface Present not supported |
| depthSlice fix | ✅ Required | Set to UINT32_MAX for 2D |
| Z clip space | ✅ Required | Use [0, 1] not [-1, 1] |
| Column-major matrices | ✅ Required | WGSL expects column-major |
| Spinning cube | ✅ Working | All fixes applied |

---

## Phase 1: Graphics Backend Abstraction

**Duration:** 2–3 weeks

### 1.1 Define the Abstract Interface

This interface lives alongside existing allolib-wasm headers using our naming convention.

```cpp
// allolib-wasm/include/al_WebGraphicsBackend.hpp
#pragma once

/**
 * Graphics Backend Abstraction for AlloLib Studio Online
 *
 * Provides a unified interface for WebGL2 and WebGPU backends,
 * allowing seamless switching between rendering APIs.
 *
 * This integrates with the existing WebApp architecture and
 * works alongside existing systems like PBR, AutoLOD, etc.
 */

#include <memory>
#include <string>
#include "al/math/al_Mat.hpp"
#include "al/math/al_Vec.hpp"

namespace al {

// Opaque handles for GPU resources
struct BufferHandle { uint64_t id = 0; bool valid() const { return id != 0; } };
struct TextureHandle { uint64_t id = 0; bool valid() const { return id != 0; } };
struct ShaderHandle { uint64_t id = 0; bool valid() const { return id != 0; } };
struct RenderTargetHandle { uint64_t id = 0; bool valid() const { return id != 0; } };
struct ComputePipelineHandle { uint64_t id = 0; bool valid() const { return id != 0; } };

enum class BackendType { WebGL2, WebGPU };
enum class BufferType { Vertex, Index, Uniform, Storage };
enum class BufferUsage { Static, Dynamic, Stream };
enum class PixelFormat { RGBA8, RGBA16F, RGBA32F, RG32F, R32F, Depth24, Depth32F };
enum class PrimitiveType { Points, Lines, LineStrip, Triangles, TriangleStrip };
enum class BlendMode { None, Alpha, Additive, Multiply };
enum class CullFace { None, Front, Back };
enum class DepthFunc { Never, Less, LessEqual, Equal, Greater, GreaterEqual, Always };

struct TextureDesc {
    int width, height, depth = 1;
    PixelFormat format;
    bool mipmaps = false;
    bool renderTarget = false;
    bool storageTexture = false;  // For compute write access (WebGPU only)
};

struct ShaderDesc {
    std::string vertexSource;
    std::string fragmentSource;
    std::string computeSource;  // Empty for render shaders
};

struct DrawState {
    BlendMode blend = BlendMode::None;
    CullFace cull = CullFace::Back;
    DepthFunc depth = DepthFunc::Less;
    bool depthWrite = true;
    bool depthTest = true;
};

/**
 * Abstract Graphics Backend Interface
 *
 * Implementations:
 *   - WebGL2Backend: Wraps existing al::Graphics OpenGL calls
 *   - WebGPUBackend: New WebGPU implementation with compute support
 */
class GraphicsBackend {
public:
    virtual ~GraphicsBackend() = default;

    // ── Lifecycle ──────────────────────────────────────────────
    virtual bool init(int width, int height) = 0;
    virtual void shutdown() = 0;
    virtual void resize(int width, int height) = 0;
    virtual void beginFrame() = 0;
    virtual void endFrame() = 0;

    // ── State ──────────────────────────────────────────────────
    virtual void clear(float r, float g, float b, float a = 1.0f,
                       float depth = 1.0f) = 0;
    virtual void viewport(int x, int y, int w, int h) = 0;
    virtual void setDrawState(const DrawState& state) = 0;

    // ── Buffers ────────────────────────────────────────────────
    virtual BufferHandle createBuffer(BufferType type, BufferUsage usage,
                                       const void* data, size_t size) = 0;
    virtual void updateBuffer(BufferHandle handle, const void* data,
                              size_t size, size_t offset = 0) = 0;
    virtual void destroyBuffer(BufferHandle handle) = 0;

    // ── Textures ───────────────────────────────────────────────
    virtual TextureHandle createTexture(const TextureDesc& desc,
                                         const void* data = nullptr) = 0;
    virtual void updateTexture(TextureHandle handle, const void* data,
                               int level = 0, int x = 0, int y = 0,
                               int w = -1, int h = -1) = 0;
    virtual void destroyTexture(TextureHandle handle) = 0;

    // ── Render Targets (FBO equivalent) ────────────────────────
    virtual RenderTargetHandle createRenderTarget(TextureHandle color,
                                                   TextureHandle depth = {}) = 0;
    virtual void bindRenderTarget(RenderTargetHandle handle) = 0;
    virtual void destroyRenderTarget(RenderTargetHandle handle) = 0;

    // ── Shaders ────────────────────────────────────────────────
    virtual ShaderHandle createShader(const ShaderDesc& desc) = 0;
    virtual void destroyShader(ShaderHandle handle) = 0;
    virtual void useShader(ShaderHandle handle) = 0;

    // ── Uniforms ───────────────────────────────────────────────
    virtual void setUniform(const char* name, int value) = 0;
    virtual void setUniform(const char* name, float value) = 0;
    virtual void setUniform(const char* name, const Vec2f& value) = 0;
    virtual void setUniform(const char* name, const Vec3f& value) = 0;
    virtual void setUniform(const char* name, const Vec4f& value) = 0;
    virtual void setUniform(const char* name, const Mat4f& value) = 0;
    virtual void setTexture(const char* name, TextureHandle handle,
                            int unit = 0) = 0;

    // ── Drawing ────────────────────────────────────────────────
    virtual void draw(PrimitiveType primitive, BufferHandle vbo,
                      int vertexCount, int offset = 0) = 0;
    virtual void drawIndexed(PrimitiveType primitive, BufferHandle vbo,
                             BufferHandle ibo, int indexCount,
                             int offset = 0) = 0;
    virtual void drawInstanced(PrimitiveType primitive, BufferHandle vbo,
                               int vertexCount, int instanceCount) = 0;

    // ── Compute (WebGPU only — no-op on WebGL2) ───────────────
    virtual bool supportsCompute() const { return false; }
    virtual ComputePipelineHandle createComputePipeline(
        const ShaderDesc& desc) { return {}; }
    virtual void destroyComputePipeline(ComputePipelineHandle handle) {}
    virtual void bindStorageBuffer(int binding, BufferHandle handle) {}
    virtual void bindStorageTexture(int binding, TextureHandle handle) {}
    virtual void dispatch(ComputePipelineHandle pipeline,
                          int groupsX, int groupsY = 1, int groupsZ = 1) {}
    virtual void computeBarrier() {}  // Memory barrier between compute and render

    // ── Buffer Readback (for GPU audio) ────────────────────────
    virtual void readBuffer(BufferHandle handle, void* dest, size_t size,
                           size_t offset = 0) {}
    virtual void copyBuffer(BufferHandle src, BufferHandle dst, size_t size) {}

    // ── Queries ────────────────────────────────────────────────
    virtual BackendType getType() const = 0;
    virtual const char* getName() const = 0;
    virtual bool isWebGPU() const { return getType() == BackendType::WebGPU; }
};

// Factory functions
std::unique_ptr<GraphicsBackend> createWebGL2Backend();
std::unique_ptr<GraphicsBackend> createWebGPUBackend();

} // namespace al
```

### 1.2 WebGL2Backend Implementation

Wraps existing AlloLib OpenGL code. This is mostly reorganization — no new functionality.

```cpp
// allolib-wasm/include/al_WebGL2Backend.hpp
#pragma once

#include "al_WebGraphicsBackend.hpp"

#ifdef __EMSCRIPTEN__
#include <GLES3/gl3.h>
#endif

#include <unordered_map>

namespace al {

/**
 * WebGL2 Backend Implementation
 *
 * Wraps the existing OpenGL ES 3.0 / WebGL2 rendering path.
 * This backend does NOT support compute shaders.
 *
 * Used when:
 *   - Maximum browser compatibility is needed
 *   - The project doesn't require GPU compute features
 *   - Firefox without WebGPU support
 */
class WebGL2Backend : public GraphicsBackend {
    std::unordered_map<uint64_t, GLuint> buffers_;
    std::unordered_map<uint64_t, GLuint> textures_;
    std::unordered_map<uint64_t, GLuint> shaders_;
    std::unordered_map<uint64_t, GLuint> fbos_;
    uint64_t nextId_ = 1;
    ShaderHandle currentShader_;
    int width_ = 0, height_ = 0;

public:
    bool init(int width, int height) override;
    void shutdown() override;
    void resize(int width, int height) override;
    void beginFrame() override;
    void endFrame() override;

    void clear(float r, float g, float b, float a, float depth) override;
    void viewport(int x, int y, int w, int h) override;
    void setDrawState(const DrawState& state) override;

    BufferHandle createBuffer(BufferType type, BufferUsage usage,
                               const void* data, size_t size) override;
    void updateBuffer(BufferHandle handle, const void* data,
                      size_t size, size_t offset) override;
    void destroyBuffer(BufferHandle handle) override;

    TextureHandle createTexture(const TextureDesc& desc,
                                 const void* data) override;
    void updateTexture(TextureHandle handle, const void* data,
                       int level, int x, int y, int w, int h) override;
    void destroyTexture(TextureHandle handle) override;

    RenderTargetHandle createRenderTarget(TextureHandle color,
                                           TextureHandle depth) override;
    void bindRenderTarget(RenderTargetHandle handle) override;
    void destroyRenderTarget(RenderTargetHandle handle) override;

    ShaderHandle createShader(const ShaderDesc& desc) override;
    void destroyShader(ShaderHandle handle) override;
    void useShader(ShaderHandle handle) override;

    void setUniform(const char* name, int value) override;
    void setUniform(const char* name, float value) override;
    void setUniform(const char* name, const Vec2f& value) override;
    void setUniform(const char* name, const Vec3f& value) override;
    void setUniform(const char* name, const Vec4f& value) override;
    void setUniform(const char* name, const Mat4f& value) override;
    void setTexture(const char* name, TextureHandle handle, int unit) override;

    void draw(PrimitiveType primitive, BufferHandle vbo,
              int vertexCount, int offset) override;
    void drawIndexed(PrimitiveType primitive, BufferHandle vbo,
                     BufferHandle ibo, int indexCount, int offset) override;
    void drawInstanced(PrimitiveType primitive, BufferHandle vbo,
                       int vertexCount, int instanceCount) override;

    // Compute — not supported on WebGL2
    bool supportsCompute() const override { return false; }

    BackendType getType() const override { return BackendType::WebGL2; }
    const char* getName() const override { return "WebGL2"; }

private:
    GLuint compileGLShader(GLenum type, const char* source);
    GLenum toGL(PrimitiveType p);
    GLenum toGL(BlendMode b);
};

} // namespace al
```

### 1.3 WebGPUBackend Implementation

Map the same interface to WebGPU using Emscripten's WebGPU bindings.

```cpp
// allolib-wasm/include/al_WebGPUBackend.hpp
#pragma once

#include "al_WebGraphicsBackend.hpp"

#ifdef __EMSCRIPTEN__
#include <webgpu/webgpu.h>
#include <emscripten/html5_webgpu.h>
#endif

#include <unordered_map>

namespace al {

/**
 * WebGPU Backend Implementation
 *
 * Provides full WebGPU support including compute shaders.
 *
 * Used when:
 *   - GPU particle systems are needed
 *   - Fluid simulation is desired
 *   - GPU audio processing is required
 *   - Modern GPU features are important
 *
 * Requirements:
 *   - Chrome 113+, Edge 113+, Safari 17+
 */
class WebGPUBackend : public GraphicsBackend {
    WGPUDevice device_ = nullptr;
    WGPUQueue queue_ = nullptr;
    WGPUSurface surface_ = nullptr;
    WGPUSwapChain swapChain_ = nullptr;  // Use SwapChain API (see Proof of Concept Findings)
    WGPUTexture depthTexture_ = nullptr;
    WGPUTextureView depthTextureView_ = nullptr;

    WGPUCommandEncoder encoder_ = nullptr;
    WGPURenderPassEncoder renderPass_ = nullptr;
    WGPUTextureFormat surfaceFormat_ = WGPUTextureFormat_BGRA8Unorm;

    std::unordered_map<uint64_t, WGPUBuffer> buffers_;
    std::unordered_map<uint64_t, WGPUTexture> textures_;
    std::unordered_map<uint64_t, WGPURenderPipeline> renderPipelines_;
    std::unordered_map<uint64_t, WGPUComputePipeline> computePipelines_;
    std::unordered_map<uint64_t, WGPUBindGroup> bindGroups_;

    uint64_t nextId_ = 1;
    int width_, height_;

public:
    bool init(int width, int height) override;
    void shutdown() override;
    void resize(int width, int height) override;
    void beginFrame() override;
    void endFrame() override;

    void clear(float r, float g, float b, float a, float depth) override;
    void viewport(int x, int y, int w, int h) override;
    void setDrawState(const DrawState& state) override;

    BufferHandle createBuffer(BufferType type, BufferUsage usage,
                               const void* data, size_t size) override;
    void updateBuffer(BufferHandle handle, const void* data,
                      size_t size, size_t offset) override;
    void destroyBuffer(BufferHandle handle) override;

    TextureHandle createTexture(const TextureDesc& desc,
                                 const void* data) override;
    void updateTexture(TextureHandle handle, const void* data,
                       int level, int x, int y, int w, int h) override;
    void destroyTexture(TextureHandle handle) override;

    RenderTargetHandle createRenderTarget(TextureHandle color,
                                           TextureHandle depth) override;
    void bindRenderTarget(RenderTargetHandle handle) override;
    void destroyRenderTarget(RenderTargetHandle handle) override;

    ShaderHandle createShader(const ShaderDesc& desc) override;
    void destroyShader(ShaderHandle handle) override;
    void useShader(ShaderHandle handle) override;

    void setUniform(const char* name, int value) override;
    void setUniform(const char* name, float value) override;
    void setUniform(const char* name, const Vec2f& value) override;
    void setUniform(const char* name, const Vec3f& value) override;
    void setUniform(const char* name, const Vec4f& value) override;
    void setUniform(const char* name, const Mat4f& value) override;
    void setTexture(const char* name, TextureHandle handle, int unit) override;

    void draw(PrimitiveType primitive, BufferHandle vbo,
              int vertexCount, int offset) override;
    void drawIndexed(PrimitiveType primitive, BufferHandle vbo,
                     BufferHandle ibo, int indexCount, int offset) override;
    void drawInstanced(PrimitiveType primitive, BufferHandle vbo,
                       int vertexCount, int instanceCount) override;

    // ── Compute — fully supported ──────────────────────────────
    bool supportsCompute() const override { return true; }
    ComputePipelineHandle createComputePipeline(const ShaderDesc& desc) override;
    void destroyComputePipeline(ComputePipelineHandle handle) override;
    void bindStorageBuffer(int binding, BufferHandle handle) override;
    void bindStorageTexture(int binding, TextureHandle handle) override;
    void dispatch(ComputePipelineHandle pipeline,
                  int groupsX, int groupsY, int groupsZ) override;
    void computeBarrier() override;

    // ── Buffer Readback ────────────────────────────────────────
    void readBuffer(BufferHandle handle, void* dest, size_t size,
                   size_t offset) override;
    void copyBuffer(BufferHandle src, BufferHandle dst, size_t size) override;

    BackendType getType() const override { return BackendType::WebGPU; }
    const char* getName() const override { return "WebGPU"; }

    // Direct access for advanced use cases
    WGPUDevice getDevice() const { return device_; }
    WGPUQueue getQueue() const { return queue_; }

private:
    void createSwapChain();
    void createDepthTexture();
    WGPUShaderModule createShaderModule(const std::string& wgslSource);
};

} // namespace al
```

### 1.4 Integration with Existing WebApp

Modify `al_WebApp.hpp` to support backend selection while maintaining backward compatibility.

```cpp
// Changes to allolib-wasm/include/al_WebApp.hpp

// Add near the top:
#include "al_WebGraphicsBackend.hpp"

// Add to WebApp class public section:

    /// Backend selection (call before start())
    /// Default is WebGL2 for maximum compatibility
    void setBackend(BackendType type) { mRequestedBackend = type; }
    BackendType getBackend() const { return mRequestedBackend; }

    /// Check if compute shaders are available
    bool supportsCompute() const {
        return mBackend && mBackend->supportsCompute();
    }

    /// Get the graphics backend (for advanced usage)
    GraphicsBackend* backend() { return mBackend.get(); }

// Add to private section:
    BackendType mRequestedBackend = BackendType::WebGL2;
    std::unique_ptr<GraphicsBackend> mBackend;
```

### 1.5 Port Core Shaders to WGSL

**Inventory of AlloLib shaders to port:**

| Shader | Purpose | Complexity |
|--------|---------|------------|
| `basic` | Solid color | Trivial |
| `textured` | Texture mapping | Easy |
| `lighting` | Phong/Blinn | Medium |
| `point_sprite` | GL_POINTS rendering | Easy |
| `mesh_color` | Per-vertex color | Easy |
| `skybox` | Cubemap sampling | Easy |
| `pbr` | Physically-based rendering | Medium–Hard |
| `environment` | IBL environment maps | Medium |

**Example port — `basic.vert`:**

GLSL ES 3.0 (WebGL2):
```glsl
#version 300 es
precision highp float;

uniform mat4 u_modelView;
uniform mat4 u_projection;

in vec3 a_position;
in vec4 a_color;

out vec4 v_color;

void main() {
    v_color = a_color;
    gl_Position = u_projection * u_modelView * vec4(a_position, 1.0);
}
```

WGSL (WebGPU):
```wgsl
struct Uniforms {
    modelView: mat4x4f,
    projection: mat4x4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec3f,
    @location(1) color: vec4f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
}

@vertex
fn main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.color = in.color;
    out.position = uniforms.projection * uniforms.modelView
                   * vec4f(in.position, 1.0);
    return out;
}
```

### 1.6 Phase 1 Checklist

- [x] `GraphicsBackend` interface defined and compiles
- [x] `WebGL2Backend` wraps existing OpenGL calls — no regressions
- [x] `WebGPUBackend` renders a basic scene (mesh + shader + uniforms)
- [x] `WebApp` supports backend selection
- [x] All core shaders have WGSL equivalents
- [x] "Hello Sphere" example runs on both backends
- [x] Existing systems (PBR, AutoLOD) continue to work on WebGL2 path

**✅ Phase 1 Complete** — Verified 2026-02-01. WebGPU backend successfully detected, device acquired, and compute shaders enabled.

---

## Phase 2: Build System & Integration

**Duration:** 1–2 weeks

### 2.1 CMake Dual-Target Configuration

```cmake
# allolib-wasm/CMakeLists.txt (modifications)

# Add backend options
option(ALLOLIB_BACKEND_WEBGPU "Build with WebGPU backend" OFF)
option(ALLOLIB_BACKEND_WEBGL2 "Build with WebGL2 backend" ON)

# Can build both for maximum flexibility
if(ALLOLIB_BACKEND_WEBGPU)
    message(STATUS "WebGPU backend ENABLED")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -sUSE_WEBGPU=1")
    add_definitions(-DALLOLIB_WEBGPU=1)

    list(APPEND WEB_SOURCES
        ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGPUBackend.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGPUCompute.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGPUParticles.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGPUFluid.cpp
        ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGPUAudio.cpp
    )
endif()

if(ALLOLIB_BACKEND_WEBGL2)
    message(STATUS "WebGL2 backend ENABLED")
    # WebGL2 flags are already set

    list(APPEND WEB_SOURCES
        ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGL2Backend.cpp
    )
endif()

# Always include the backend abstraction
list(APPEND WEB_SOURCES
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGraphicsBackend.cpp
)

# Embed shaders based on backend
if(ALLOLIB_BACKEND_WEBGPU)
    file(GLOB WGSL_SHADERS "${CMAKE_CURRENT_SOURCE_DIR}/shaders/wgsl/*.wgsl")
    # Convert WGSL to embedded C strings
endif()

file(GLOB GLSL_SHADERS "${CMAKE_CURRENT_SOURCE_DIR}/shaders/glsl/*")
# Convert GLSL to embedded C strings (existing functionality)
```

### 2.2 Build Scripts

```bash
# scripts/build-webgl2.sh
#!/bin/bash
mkdir -p build-webgl2
cd build-webgl2
emcmake cmake .. -DALLOLIB_BACKEND_WEBGL2=ON -DALLOLIB_BACKEND_WEBGPU=OFF
emmake make -j$(nproc)

# scripts/build-webgpu.sh
#!/bin/bash
mkdir -p build-webgpu
cd build-webgpu
emcmake cmake .. -DALLOLIB_BACKEND_WEBGL2=OFF -DALLOLIB_BACKEND_WEBGPU=ON
emmake make -j$(nproc)

# scripts/build-dual.sh (both backends in one build)
#!/bin/bash
mkdir -p build-dual
cd build-dual
emcmake cmake .. -DALLOLIB_BACKEND_WEBGL2=ON -DALLOLIB_BACKEND_WEBGPU=ON
emmake make -j$(nproc)
```

### 2.3 Backend Compilation Service Update

```typescript
// backend/src/compiler/CompilerService.ts

interface CompileRequest {
    code: string;
    backend: 'webgl2' | 'webgpu' | 'auto';  // New field
}

async function compile(request: CompileRequest) {
    let buildDir = 'build-webgl2';  // Default

    if (request.backend === 'webgpu') {
        // Check if code uses compute features
        if (!navigator.gpu) {
            throw new Error('WebGPU not supported in this browser');
        }
        buildDir = 'build-webgpu';
    } else if (request.backend === 'auto') {
        // Auto-detect based on code analysis
        const usesCompute = detectComputeUsage(request.code);
        buildDir = usesCompute ? 'build-webgpu' : 'build-webgl2';
    }

    const alloLibPath = `/opt/allolib/${buildDir}`;
    // Compile user code against it
}

function detectComputeUsage(code: string): boolean {
    // Check for compute-related includes/classes
    return code.includes('al_WebGPUParticles') ||
           code.includes('al_WebGPUFluid') ||
           code.includes('al_WebGPUCompute') ||
           code.includes('supportsCompute()');
}
```

### 2.4 Docker Multi-Target Build

```dockerfile
# docker/Dockerfile (updated)
# IMPORTANT: Use 3.1.73+ for WebGPU support (see Proof of Concept Findings)
FROM emscripten/emsdk:3.1.73

WORKDIR /opt/allolib

# Copy source
COPY allolib/ ./allolib/
COPY allolib-wasm/ ./allolib-wasm/

# WebGL2 build (default, always available)
RUN mkdir build-webgl2 && cd build-webgl2 && \
    emcmake cmake ../allolib-wasm -DALLOLIB_BACKEND_WEBGL2=ON && \
    emmake make -j$(nproc)

# WebGPU build (parallel option)
RUN mkdir build-webgpu && cd build-webgpu && \
    emcmake cmake ../allolib-wasm -DALLOLIB_BACKEND_WEBGPU=ON && \
    emmake make -j$(nproc)
```

### 2.5 Frontend Backend Selection UI

```vue
<!-- frontend/src/components/ProjectSettings.vue -->
<template>
  <div class="settings-panel">
    <div class="setting-group">
      <label class="setting-label">Render Backend</label>
      <select v-model="project.backend" class="setting-select">
        <option value="webgl2">WebGL2 (Compatible)</option>
        <option value="webgpu" :disabled="!webgpuSupported">
          WebGPU (Modern + Compute)
        </option>
        <option value="auto">Auto-detect</option>
      </select>
    </div>

    <div v-if="project.backend === 'webgpu'" class="info-box webgpu-info">
      <h4>WebGPU Features</h4>
      <ul>
        <li>✓ Compute shaders</li>
        <li>✓ GPU particle systems (1M+ particles)</li>
        <li>✓ Real-time fluid simulation</li>
        <li>✓ GPU audio processing</li>
      </ul>
      <p class="browser-note">
        Requires Chrome 113+, Safari 17+, or Edge 113+
      </p>
    </div>

    <div v-if="!webgpuSupported && project.backend === 'webgpu'"
         class="warning-box">
      <p>⚠ WebGPU is not available in your browser.</p>
      <p>Please update to a supported browser or use WebGL2.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();
const webgpuSupported = computed(() => !!navigator.gpu);
</script>
```

### 2.6 Runtime Service Updates

```typescript
// frontend/src/services/runtime.ts

interface RuntimeConfig {
    backend: 'webgl2' | 'webgpu' | 'auto';
}

export class RuntimeService {
    private backend: 'webgl2' | 'webgpu' = 'webgl2';

    async initialize(config: RuntimeConfig) {
        // Determine actual backend
        if (config.backend === 'webgpu' || config.backend === 'auto') {
            if (navigator.gpu) {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) {
                    this.backend = 'webgpu';
                } else {
                    console.warn('WebGPU adapter not available, falling back to WebGL2');
                    this.backend = 'webgl2';
                }
            } else {
                if (config.backend === 'webgpu') {
                    throw new Error('WebGPU not supported in this browser');
                }
                this.backend = 'webgl2';
            }
        } else {
            this.backend = 'webgl2';
        }

        // Load appropriate WASM module
        const wasmUrl = this.backend === 'webgpu'
            ? '/wasm/allolib-webgpu.wasm'
            : '/wasm/allolib-webgl2.wasm';

        await this.loadWasm(wasmUrl);
    }

    get supportsCompute(): boolean {
        return this.backend === 'webgpu';
    }
}
```

### 2.7 Phase 2 Checklist

- [x] Both backends build from same CMake project (CMakeLists.txt updated with ALLOLIB_BACKEND_* options)
- [x] Docker image produces two WASM artifacts (build-allolib.sh builds both backends)
- [x] Compilation service accepts `backend` parameter (compile.ts and compile routes updated)
- [x] Frontend shows backend selector (completed in settings.ts and Toolbar.vue)
- [x] Correct WASM loaded based on selection (runtime.ts detects and passes WebGPU device)
- [x] WebGPU option disabled with message on unsupported browsers
- [x] Auto-detect mode works correctly
- [x] Existing examples work without modification on WebGL2

**✅ Phase 2 Complete** — Verified 2026-02-01. Dual-target build system configured with full frontend-backend integration.

### Known Limitation: Graphics Class Integration

The WebGPU backend successfully initializes (device, queue, canvas context), but the existing `al::Graphics` class internally uses direct OpenGL (`gl*`) calls. When user code calls `g.draw(mesh)`, it ultimately invokes OpenGL functions which cause "RuntimeError: function signature mismatch" on the WebGPU backend.

**Current Workarounds:**
1. Use WebGL2 backend (default) for all existing examples
2. WebGPU backend is ready for compute-only workloads

**Resolution Path:**
- Option A: Update `al::Graphics` to use `GraphicsBackend` interface for all rendering
- Option B: Provide a separate `WebGPURenderer` class for WebGPU-specific rendering
- This will be addressed as part of Phase 3 or as a separate Graphics integration phase

---

## Phase 3: Compute Infrastructure

**Duration:** 2–3 weeks

This is where WebGPU starts to shine. Build the foundational utilities that all VFX systems will use.

### 3.1 Compute Shader Framework

```cpp
// allolib-wasm/include/al_WebGPUCompute.hpp
#pragma once

/**
 * WebGPU Compute Shader Framework
 *
 * Provides easy-to-use wrappers for GPU compute operations.
 * Used internally by particle systems, fluid simulation, and GPU audio.
 *
 * Example:
 *   ComputeShader shader(backend);
 *   shader.compile(myWGSLSource);
 *   shader.bindBuffer(0, myBuffer);
 *   shader.dispatch(numGroups);
 */

#include "al_WebGraphicsBackend.hpp"
#include <string>

namespace al {

class ComputeShader {
    ComputePipelineHandle pipeline_;
    GraphicsBackend* backend_;
    bool valid_ = false;

public:
    ComputeShader(GraphicsBackend& backend) : backend_(&backend) {}

    bool compile(const std::string& wgslSource) {
        if (!backend_->supportsCompute()) {
            return false;
        }
        ShaderDesc desc;
        desc.computeSource = wgslSource;
        pipeline_ = backend_->createComputePipeline(desc);
        valid_ = pipeline_.valid();
        return valid_;
    }

    void dispatch(int groupsX, int groupsY = 1, int groupsZ = 1) {
        if (valid_) {
            backend_->dispatch(pipeline_, groupsX, groupsY, groupsZ);
        }
    }

    void bindBuffer(int binding, BufferHandle buffer) {
        backend_->bindStorageBuffer(binding, buffer);
    }

    void bindTexture(int binding, TextureHandle texture) {
        backend_->bindStorageTexture(binding, texture);
    }

    bool isValid() const { return valid_; }
};

} // namespace al
```

### 3.2 GPU Buffer Class

```cpp
// allolib-wasm/include/al_WebGPUBuffer.hpp
#pragma once

/**
 * Templated GPU Storage Buffer
 *
 * Provides type-safe GPU buffer management for compute shaders.
 * Handles upload and readback operations.
 */

#include "al_WebGraphicsBackend.hpp"
#include <vector>

namespace al {

template<typename T>
class GPUBuffer {
    BufferHandle handle_;
    GraphicsBackend* backend_;
    size_t count_;
    std::vector<T> cpuBuffer_;  // For readback

public:
    GPUBuffer(GraphicsBackend& backend, size_t count,
              const T* initialData = nullptr)
        : backend_(&backend), count_(count)
    {
        cpuBuffer_.resize(count);
        handle_ = backend_->createBuffer(
            BufferType::Storage,
            BufferUsage::Dynamic,
            initialData,
            count * sizeof(T)
        );
    }

    ~GPUBuffer() {
        if (handle_.valid()) {
            backend_->destroyBuffer(handle_);
        }
    }

    void upload(const T* data, size_t count, size_t offset = 0) {
        backend_->updateBuffer(
            handle_, data,
            count * sizeof(T),
            offset * sizeof(T)
        );
    }

    void upload(const std::vector<T>& data, size_t offset = 0) {
        upload(data.data(), data.size(), offset);
    }

    const T* readback() {
        backend_->readBuffer(handle_, cpuBuffer_.data(),
                            count_ * sizeof(T));
        return cpuBuffer_.data();
    }

    BufferHandle handle() const { return handle_; }
    size_t count() const { return count_; }
    size_t byteSize() const { return count_ * sizeof(T); }
};

} // namespace al
```

### 3.3 Ping-Pong Texture Utility

For algorithms that read from one texture and write to another each frame:

```cpp
// allolib-wasm/include/al_WebPingPong.hpp
#pragma once

/**
 * Ping-Pong Double Buffer
 *
 * Utility for algorithms that need to read from one buffer
 * while writing to another (e.g., fluid simulation, blur passes).
 */

#include "al_WebGraphicsBackend.hpp"

namespace al {

class PingPongTexture {
    TextureHandle textures_[2];
    int readIndex_ = 0;
    GraphicsBackend* backend_;

public:
    PingPongTexture(GraphicsBackend& backend, int width, int height,
                    PixelFormat format = PixelFormat::RGBA32F)
        : backend_(&backend)
    {
        TextureDesc desc;
        desc.width = width;
        desc.height = height;
        desc.format = format;
        desc.storageTexture = true;  // Writeable from compute

        textures_[0] = backend_->createTexture(desc);
        textures_[1] = backend_->createTexture(desc);
    }

    ~PingPongTexture() {
        if (textures_[0].valid()) backend_->destroyTexture(textures_[0]);
        if (textures_[1].valid()) backend_->destroyTexture(textures_[1]);
    }

    void swap() { readIndex_ = 1 - readIndex_; }

    TextureHandle readTexture() const { return textures_[readIndex_]; }
    TextureHandle writeTexture() const { return textures_[1 - readIndex_]; }
};

template<typename T>
class PingPongBuffer {
    BufferHandle buffers_[2];
    int readIndex_ = 0;
    GraphicsBackend* backend_;
    size_t count_;

public:
    PingPongBuffer(GraphicsBackend& backend, size_t count)
        : backend_(&backend), count_(count)
    {
        for (int i = 0; i < 2; i++) {
            buffers_[i] = backend_->createBuffer(
                BufferType::Storage,
                BufferUsage::Dynamic,
                nullptr,
                count * sizeof(T)
            );
        }
    }

    void swap() { readIndex_ = 1 - readIndex_; }

    BufferHandle readBuffer() const { return buffers_[readIndex_]; }
    BufferHandle writeBuffer() const { return buffers_[1 - readIndex_]; }
};

} // namespace al
```

### 3.4 Phase 3 Checklist

- [ ] `ComputeShader` wrapper compiles and dispatches workgroups
- [ ] `GPUBuffer<T>` creates storage buffers with upload/readback
- [ ] `PingPongTexture` provides double-buffered textures for compute
- [ ] Simple compute test: fill a buffer with values, read back and verify
- [ ] Memory barriers work between compute and render passes
- [ ] Graceful error when compute is attempted on WebGL2
- [ ] All utilities integrate with existing WebApp lifecycle

---

## Phase 4: GPU Particle System

**Duration:** 2–3 weeks

### 4.1 Particle Data Structures

```cpp
// allolib-wasm/include/al_WebGPUParticles.hpp
#pragma once

/**
 * GPU Particle System for AlloLib Studio Online
 *
 * High-performance particle simulation using WebGPU compute shaders.
 * Supports up to 1,000,000 particles at 60fps.
 *
 * Features:
 *   - Curl noise turbulence
 *   - Gravity and force fields
 *   - Color/size over lifetime
 *   - Audio-reactive behavior (via AudioVisualBridge)
 *   - SDF collision
 *
 * Example usage:
 *   ParticleSystem particles;
 *   particles.init(backend(), 100000);
 *
 *   ParticleEmitter emitter;
 *   emitter.position = Vec3f(0, 0, 0);
 *   emitter.rate = 5000;
 *
 *   void onAnimate(double dt) {
 *       particles.emit(emitter);
 *       particles.update(dt);
 *   }
 *
 *   void onDraw(Graphics& g) {
 *       particles.draw(g);
 *   }
 */

#include "al_WebGraphicsBackend.hpp"
#include "al_WebGPUCompute.hpp"
#include "al_WebGPUBuffer.hpp"
#include "al/math/al_Vec.hpp"
#include "al/types/al_Color.hpp"

namespace al {

// GPU-aligned particle structure (64 bytes)
struct Particle {
    Vec3f position;
    float age;
    Vec3f velocity;
    float lifetime;
    Color color;
    float size;
    float mass;
    float _pad[2];  // Align to 16 bytes for GPU
};

static_assert(sizeof(Particle) == 64,
    "Particle must be 64 bytes for GPU alignment");

struct ParticleEmitter {
    Vec3f position{0, 0, 0};
    float rate = 1000;           // Particles per second
    Vec3f direction{0, 1, 0};
    float spread = 0.5f;         // Cone angle in radians
    float minSpeed = 1.0f;
    float maxSpeed = 3.0f;
    float minLifetime = 1.0f;
    float maxLifetime = 3.0f;
    Color startColor{1, 1, 1, 1};
    Color endColor{1, 1, 1, 0};
    float startSize = 0.1f;
    float endSize = 0.05f;
};

struct SimParams {
    float deltaTime;
    Vec3f gravity;
    float damping;
    float noiseScale;
    float noiseStrength;
    float time;
};

class ParticleSystem {
    static const int MAX_PARTICLES = 1000000;

    GraphicsBackend* backend_ = nullptr;
    std::unique_ptr<GPUBuffer<Particle>> particleBuffer_;
    std::unique_ptr<ComputeShader> updateShader_;
    std::unique_ptr<ComputeShader> emitShader_;
    ShaderHandle renderShader_;
    BufferHandle uniformBuffer_;
    BufferHandle quadVBO_;

    int activeCount_ = 0;
    int emitQueue_ = 0;
    float totalTime_ = 0;
    float lastDt_ = 0;

    Vec3f gravity_{0, -9.8f, 0};
    float damping_ = 0.1f;
    float noiseScale_ = 0.5f;
    float noiseStrength_ = 2.0f;

    bool initialized_ = false;

public:
    ParticleSystem() = default;

    bool init(GraphicsBackend& backend, int maxParticles = 100000);
    void emit(const ParticleEmitter& emitter, int count = -1);
    void update(float dt);
    void draw(const Mat4f& viewProj, const Vec3f& cameraRight, const Vec3f& cameraUp);

    // Audio-reactive binding
    void bindAudioFeatures(BufferHandle featuresBuffer);
    void bindAudioSpectrum(BufferHandle magnitudeBuffer);

    // Configuration
    void setGravity(const Vec3f& g) { gravity_ = g; }
    void setDamping(float d) { damping_ = d; }
    void setTurbulence(float scale, float strength) {
        noiseScale_ = scale;
        noiseStrength_ = strength;
    }

    int activeCount() const { return activeCount_; }
    int maxParticles() const { return MAX_PARTICLES; }
    bool supportsCompute() const { return backend_ && backend_->supportsCompute(); }

private:
    void spawnGrains(const ParticleEmitter& emitter, int count);
};

} // namespace al
```

### 4.2 Particle Compute Shaders

See original plan sections 4.2-4.3 for complete WGSL shader code.

### 4.3 Phase 4 Checklist

- [ ] Particle data structure is GPU-aligned (64 bytes)
- [ ] Emit compute shader spawns particles with randomized properties
- [ ] Update compute shader integrates velocity, applies forces, ages particles
- [ ] Curl noise produces organic turbulence
- [ ] Billboarded quad rendering with alpha fade
- [ ] 100,000 particles at 60fps
- [ ] 1,000,000 particles at 30fps+
- [ ] `ParticleEmitter` configurable via parameter panel
- [ ] Integration with existing WebApp onDraw() flow

---

## Phase 5: Fluid Simulation

**Duration:** 2–3 weeks

See original plan sections 5.1-5.5 for complete implementation details.

Key changes for integration:
- Use `al_WebGPUFluid2D.hpp` and `al_WebGPUFluid3D.hpp` naming
- Integrate with existing texture loading via `al_WebTexture.hpp`
- Support rendering fluid density alongside existing PBR materials

### 5.1 Phase 5 Checklist

- [ ] 2D fluid sim runs all passes correctly
- [ ] Mouse interaction adds forces and dye
- [ ] 512×512 grid at 60fps
- [ ] 3D fluid sim with raymarched visualization
- [ ] Integration with WebApp mouse events

---

## Phase 6: Advanced VFX Features

**Duration:** 2–3 weeks

See original plan section 6.1-6.5 for complete implementation details.

### 6.1 Phase 6 Checklist

- [ ] Vector fields affect particle motion
- [ ] SDF collisions with primitive shapes
- [ ] Sprite sheet animation
- [ ] GPU bitonic sort for transparency
- [ ] Soft particles fade at geometry intersections

---

## Phase 7: User-Facing API & Examples

**Duration:** 2 weeks

### 7.1 Example Programs

All examples should be added to `studioExamples.ts` under a new "VFX" category:

| Example | Category | Demonstrates |
|---------|----------|--------------|
| `fire.cpp` | VFX - Particles | Basic emission, turbulence, color over life |
| `smoke.cpp` | VFX - Particles | Curl noise, soft particles, alpha blending |
| `galaxy.cpp` | VFX - Particles | Gravitational attraction, 1M particles |
| `fluid_2d.cpp` | VFX - Fluids | Interactive 2D fluid, mouse forces |
| `fluid_3d.cpp` | VFX - Fluids | Volumetric fluid, raymarching |
| `audio_reactive.cpp` | VFX - Audio | Particles driven by FFT spectrum |

### 7.2 Phase 7 Checklist

- [ ] All VFX examples compile and run on WebGPU backend
- [ ] Examples added to studioExamples.ts
- [ ] Parameter panel integration for VFX parameters
- [ ] Examples include educational comments

---

## Phase 8: Polish & Documentation

**Duration:** 1–2 weeks

See original plan section 8.1-8.4 for complete implementation details.

### 8.1 Phase 8 Checklist

- [ ] Graceful error messages when compute used on WebGL2
- [ ] Browser compatibility banner
- [ ] Glossary updated with new terms
- [ ] Tutorial examples added

---

## Phase 9: GPU-Accelerated Audio

**Duration:** 3–4 weeks

See original plan sections 9.1-9.12 for complete implementation details.

Key integration points:
- `al_WebGPUAudio.hpp` - GPU audio buffer management
- `al_WebGPUFFT.hpp` - GPU FFT engine
- `al_WebGPUGranular.hpp` - Massive granular synthesis
- `al_WebAudioVisualBridge.hpp` - Zero-copy audio→visual pipeline

Integration with existing audio system:
- Works alongside existing `onSound(AudioIOData&)` callback
- GPU audio is processed then read back for final output
- AudioVisualBridge provides GPU-side analysis for visuals

### 9.1 Phase 9 Checklist

- [ ] GPU audio buffer handles transfer correctly
- [ ] GPU FFT validated against CPU reference
- [ ] 10,000+ granular grains at audio rate
- [ ] AudioVisualBridge zero-copy pipeline works
- [ ] Integration with existing PolySynth system

---

## Summary Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **0: Foundation** | 1–2 weeks | WebGPU proof of concept, toolchain validation |
| **1: Abstraction** | 2–3 weeks | `GraphicsBackend` interface, both implementations |
| **2: Build System** | 1–2 weeks | Dual-target builds, frontend integration |
| **3: Compute** | 2–3 weeks | Compute utilities, buffers, ping-pong |
| **4: Particles** | 2–3 weeks | Full GPU particle system |
| **5: Fluids** | 2–3 weeks | 2D and 3D fluid simulation |
| **6: Advanced VFX** | 2–3 weeks | Vector fields, SDF collision, sorting |
| **7: API & Examples** | 2 weeks | Clean API, example programs |
| **8: Polish** | 1–2 weeks | Documentation, error handling |
| **9: GPU Audio** | 3–4 weeks | FFT, granular, physical modeling, AV bridge |

**Total: 17–25 weeks**

---

## Integration Notes for Existing Systems

### Compatibility with AutoLOD

The WebGPU backend maintains full compatibility with the existing AutoLOD system:
- LOD selection continues to work identically
- GPU particles can use simplified meshes for collision
- No changes required to `al_WebAutoLOD.hpp`

### Compatibility with PBR

The PBR system works on both backends:
- WebGL2: Uses existing GLSL shaders
- WebGPU: Uses ported WGSL PBR shaders
- Material definitions unchanged
- IBL/environment maps work identically

### Compatibility with Environment/HDR

- HDR loading via `al_WebHDR.hpp` unchanged
- Environment mapping works on both backends
- Skybox rendering ported to WGSL

### Compatibility with Timeline

- Timeline-controlled parameters work with VFX systems
- Particle emitter properties can be keyframed
- Fluid simulation parameters animatable

---

## Success Metrics

- [ ] Backend switch works seamlessly in the UI
- [ ] All existing examples work on both backends (no regressions)
- [ ] 1,000,000 particles at 60fps on WebGPU
- [ ] 2D fluid sim 512×512 at 60fps
- [ ] All VFX examples compile and run
- [ ] GPU audio produces correct output
- [ ] Zero-copy audio-visual pipeline working
- [ ] Documentation complete
- [ ] Graceful degradation on WebGL2

---

## Risk Mitigation

| Risk | Likelihood | Mitigation | Status |
|------|------------|------------|--------|
| Emscripten WebGPU API instability | Low | Pin to Emscripten 3.1.73+; Phase 0 validated | ✅ Mitigated |
| SwapChain vs Surface API confusion | Medium | Use SwapChain API only (documented in PoC findings) | ✅ Mitigated |
| Matrix convention mismatch | Medium | All matrices column-major for WGSL (documented) | ✅ Mitigated |
| Z clip space differences | Medium | Use [0,1] for WebGPU perspective matrices | ✅ Mitigated |
| AlloLib upstream divergence | Medium | Abstraction layer isolates changes | Pending |
| WebGPU browser support gaps | Low | WebGL2 always available as fallback | Pending |
| Performance not meeting targets | Low | Degrade particle counts gracefully | Pending |
| Shader porting complexity | Medium | Start with manual dual-write | Pending |
| GPU audio latency | Medium | Document latency per use case | Pending |

---

## Appendix: Key Resources

**WebGPU & WGSL:**
- [WebGPU Specification (W3C)](https://www.w3.org/TR/webgpu/)
- [WGSL Specification (W3C)](https://www.w3.org/TR/WGSL/)
- [Emscripten WebGPU Bindings](https://emscripten.org/docs/api_reference/html5.h.html)
- [WebGPU Fundamentals](https://webgpufundamentals.org/)

**Fluid Simulation:**
- [Jos Stam — Stable Fluids (1999)](https://www.dgp.toronto.edu/public_user/stam/reality/Research/pdf/ns.pdf)

**GPU Audio:**
- [Julius O. Smith — Physical Audio Signal Processing](https://ccrma.stanford.edu/~jos/pasp/)
