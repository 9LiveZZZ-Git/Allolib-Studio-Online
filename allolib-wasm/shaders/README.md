# AlloLib Studio Online Shader System

This directory contains shaders for both WebGL2 and WebGPU backends.

## Directory Structure

```
shaders/
├── glsl/           # WebGL2 / OpenGL ES 3.0 shaders
│   └── (currently inline in C++ headers)
├── wgsl/           # WebGPU shaders
│   ├── mesh.vert.wgsl
│   ├── mesh.frag.wgsl
│   ├── textured.vert.wgsl
│   ├── textured.frag.wgsl
│   ├── color.vert.wgsl
│   ├── color.frag.wgsl
│   ├── skybox.vert.wgsl
│   ├── skybox.frag.wgsl
│   ├── pbr.vert.wgsl
│   ├── pbr.frag.wgsl
│   ├── lighting.vert.wgsl
│   ├── lighting.frag.wgsl
│   ├── particles_update.compute.wgsl
│   ├── particles_emit.compute.wgsl
│   ├── particles_render.vert.wgsl
│   └── particles_render.frag.wgsl
└── README.md       # This file
```

## Shader Workflow

### Manual Dual-Write Approach (Recommended)

We maintain separate GLSL and WGSL versions of each shader. This approach:

1. **Ensures correctness** - Each shader is optimized for its target API
2. **Avoids transpilation bugs** - No dependency on GLSL→WGSL conversion tools
3. **Allows API-specific features** - WGSL compute shaders have no GLSL equivalent

### Naming Convention

| File Pattern | Description |
|-------------|-------------|
| `*.vert.wgsl` | WGSL vertex shader |
| `*.frag.wgsl` | WGSL fragment shader |
| `*.compute.wgsl` | WGSL compute shader (WebGPU only) |

### GLSL Source Locations

Currently, GLSL shaders are embedded inline in C++ headers:

| Header File | Shaders |
|-------------|---------|
| `al_DefaultShaders.hpp` | mesh, textured, color, lighting |
| `al_WebEnvironment.hpp` | skybox, environment reflection |
| `al_WebPBR.hpp` | PBR (IBL and fallback variants) |

## GLSL → WGSL Porting Guide

### Key Differences

| GLSL ES 3.0 | WGSL | Notes |
|-------------|------|-------|
| `#version 300 es` | (none) | WGSL has no version directive |
| `precision highp float;` | (none) | WGSL uses explicit types |
| `uniform mat4 mvp;` | `var<uniform> mvp: mat4x4f;` | Uniform blocks required |
| `in vec3 position;` | `@location(0) position: vec3f` | Explicit locations |
| `out vec4 color;` | Return struct with `@location` | Outputs via return value |
| `gl_Position` | `@builtin(position)` | Built-in attributes |
| `gl_PointSize` | (not supported) | Use geometry/instancing |
| `texture(tex, uv)` | `textureSample(tex, sampler, uv)` | Separate sampler |
| `vec3(1.0)` | `vec3f(1.0)` | Type suffixes (f, i, u) |
| `mat4` | `mat4x4f` | Explicit dimensions |

### Matrix Storage

**Critical:** WGSL uses column-major storage, same as GLSL. However, matrix multiplication must be done correctly:

```wgsl
// Column-major: element at (row, col) stored at col*4 + row
// Multiplication: C[col*4+row] = sum of A[k*4+row] * B[col*4+k]
```

### Clip Space

| API | Z Clip Range | Notes |
|-----|--------------|-------|
| OpenGL/WebGL2 | [-1, 1] | NDC z from -1 to 1 |
| WebGPU | [0, 1] | NDC z from 0 to 1 |

**Perspective matrix must be adjusted for WebGPU:**

```cpp
// OpenGL (Z: -1 to 1)
out[10] = (far + near) / (near - far);
out[14] = (2.0f * far * near) / (near - far);

// WebGPU (Z: 0 to 1)
out[10] = far / (near - far);
out[14] = (far * near) / (near - far);
```

### Uniform Buffer Layout

WGSL requires uniforms to be in uniform buffers with explicit binding:

```wgsl
struct Uniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    tint: vec4f,
    // Padding for 16-byte alignment
    _pad: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
```

**Alignment rules:**
- `vec2f`: 8-byte alignment
- `vec3f`: 16-byte alignment (wastes 4 bytes)
- `vec4f`: 16-byte alignment
- `mat4x4f`: 16-byte alignment
- Structs: largest member alignment

### Texture Sampling

WGSL separates textures and samplers:

```wgsl
@group(0) @binding(1) var myTexture: texture_2d<f32>;
@group(0) @binding(2) var mySampler: sampler;

// In fragment shader:
let color = textureSample(myTexture, mySampler, uv);
```

### Compute Shaders (WebGPU Only)

Compute shaders use storage buffers and workgroups:

```wgsl
struct Particle {
    position: vec3f,
    velocity: vec3f,
    // ... (must be 16-byte aligned)
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let index = id.x;
    // Update particle at index
}
```

## Shader Inventory

### Core Rendering Shaders

| Shader | GLSL | WGSL | Purpose |
|--------|------|------|---------|
| mesh | ✅ | ✅ | Per-vertex colors |
| textured | ✅ | ✅ | Texture mapping |
| color | ✅ | ✅ | Uniform color |
| lighting | ✅ | ✅ | Multi-light Phong |
| skybox | ✅ | ✅ | Environment background |
| pbr | ✅ | ✅ | Physically-based rendering |

### Compute Shaders (WebGPU Only)

| Shader | Purpose |
|--------|---------|
| particles_update | Physics simulation |
| particles_emit | Particle spawning |

### Rendering Shaders (WebGPU)

| Shader | Purpose |
|--------|---------|
| particles_render | Billboarded particle quads |

## Testing Shaders

Each WGSL shader should be tested with the WebGPU proof-of-concept setup:

```bash
cd allolib-wasm/webgpu-test
# Build with Docker (Emscripten 3.1.73+)
docker run --rm -v "$(pwd):/src" emscripten/emsdk:3.1.73 \
    bash -c "cd /src && mkdir -p build && cd build && emcmake cmake .. && emmake make"
# Serve and test in browser
python -m http.server 8080
```

## Adding New Shaders

1. **GLSL version:** Add to appropriate C++ header as inline string
2. **WGSL version:** Create `.wgsl` file in `shaders/wgsl/`
3. **Update this README** with the new shader in the inventory
4. **Test both backends** to ensure visual parity

## References

- [WGSL Specification (W3C)](https://www.w3.org/TR/WGSL/)
- [WebGPU Specification (W3C)](https://www.w3.org/TR/webgpu/)
- [GLSL ES 3.0 Specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
- [Emscripten WebGPU](https://emscripten.org/docs/api_reference/html5.h.html#webgpu)
