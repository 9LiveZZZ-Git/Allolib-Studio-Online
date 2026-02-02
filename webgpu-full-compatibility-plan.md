# WebGPU Full Compatibility Plan

## Goal
Make ALL existing AlloLib Studio examples work with WebGPU **without changing example code**.

---

## Current WebGPU Status

### Already Working
- Basic mesh rendering (vertices, colors, normals, indices)
- All primitive types (with TRIANGLE_FAN/LINE_LOOP conversion)
- Matrix transforms (push/pop, translate, rotate, scale)
- Depth testing, blending, culling
- Diffuse lighting (Lambert shading)
- Uniform color tint
- **2D Textures** (Phase 1 complete) - Texture bridge syncs GL textures to WebGPU

### Not Yet Implemented
| Feature | Examples Affected | Priority |
|---------|-------------------|----------|
| ~~2D Textures~~ | ~~Procedural Texture, Web Image, UV Mapping~~ | ✅ DONE |
| Multi-Light System | Multi-Light Test, lighting examples | HIGH |
| Material Properties | All lit examples | HIGH |
| EasyFBO (render-to-texture) | EasyFBO Test, post-processing | MEDIUM |
| Cubemaps/Skyboxes | HDRI Skybox, Environment examples | MEDIUM |
| WebPBR System | All PBR examples | MEDIUM |
| WebEnvironment | Environment Picker, Reflections | MEDIUM |
| ProceduralTexture | Procedural Noise, Patterns | LOW |
| 3D Textures | 3D Textures example | LOW |
| HDR Textures | HDR examples | LOW |
| LOD System | All LOD examples | LOW |

---

## CANNOT Be Made Compatible (Need GPU-Specific Examples)

These examples use **custom GLSL shaders** which cannot be automatically transpiled to WGSL:

| Example | Reason | Solution |
|---------|--------|----------|
| Custom Shader | Hand-written GLSL ES 3.0 | Create WGSL version in GPU category |
| Shader LOD Demo | Custom GLSL with LOD logic | Create WGSL version |
| Post-processing effects | GLSL fragment shaders | Create WGSL post-process shaders |

**Why GLSL → WGSL auto-transpilation won't work:**
- Different syntax (GLSL: `vec3`, WGSL: `vec3f`)
- Different built-ins (GLSL: `texture2D`, WGSL: `textureSample`)
- Different attribute/uniform declarations
- Different shader entry points
- WGSL requires explicit type annotations everywhere

---

## Implementation Phases

### Phase 1: Textures (Enables ~15 examples) ✅ COMPLETE
**Files modified:**
- `al_WebGPUBackend.hpp` - Added texture tracking and textured bind group
- `al_WebGPUBackend.cpp` - Implemented textured shader with WGSL sampler/texture bindings
- `al_TextureBridge.hpp` - NEW: Bridge API for syncing GL textures to WebGPU
- `al_Texture_Web.cpp` - NEW: Patched Texture class with WebGPU hooks
- `al_Graphics_Web.cpp` - Added texture bridge implementation
- `CMakeLists.txt` - Added new source files

**Implementation approach:**
- Texture bridge intercepts `Texture::submit()` and `Texture::bind()`
- Creates parallel WebGPU textures from GL texture data
- Automatically switches to textured shader when texture is bound
- No changes needed to user example code

**Lines added:** ~250

---

### Phase 2: Full Lighting System (Enables ~10 examples)
**Files to modify:**
- `al_WebGPUBackend.hpp` - Add light uniform buffer
- `al_WebGPUBackend.cpp` - Implement light management
- `shaders/wgsl/lighting.vert.wgsl` - Already exists
- `shaders/wgsl/lighting.frag.wgsl` - Already exists

**Uniform buffer layout (matches existing WGSL shader):**
```wgsl
struct LightUniforms {
    numLights: u32,
    _pad: vec3f,
    lights: array<LightData, 8>,  // Max 8 lights
}

struct LightData {
    position: vec4f,    // w=0 for directional, w=1 for point
    ambient: vec4f,
    diffuse: vec4f,
    specular: vec4f,
}
```

**Material uniform buffer:**
```wgsl
struct MaterialUniforms {
    ambient: vec4f,
    diffuse: vec4f,
    specular: vec4f,
    shininess: f32,
    _pad: vec3f,
}
```

**API additions:**
```cpp
void setLight(int index, const Light& light);
void setMaterial(const Material& material);
void setLightingEnabled(bool enabled);
```

**Estimated lines:** ~250

---

### Phase 3: EasyFBO / Render-to-Texture (Enables ~5 examples)
**Files to modify:**
- `al_WebGPUBackend.hpp` - Add framebuffer support
- `al_WebGPUBackend.cpp` - Implement render targets

**API to implement:**
```cpp
FramebufferHandle createFramebuffer(int width, int height);
void destroyFramebuffer(FramebufferHandle handle);
void bindFramebuffer(FramebufferHandle handle);
void unbindFramebuffer();
TextureHandle getFramebufferColorTexture(FramebufferHandle handle);
```

**WebGPU implementation:**
- Create WGPUTexture as render target
- Create WGPUTextureView for color attachment
- Swap render pass descriptor when FBO is bound

**Estimated lines:** ~150

---

### Phase 4: Cubemaps & Skyboxes (Enables ~8 examples)
**Files to modify:**
- `al_WebGPUBackend.hpp` - Add cubemap support
- `al_WebGPUBackend.cpp` - Cubemap creation and binding
- Already have: `shaders/wgsl/skybox.vert.wgsl`, `skybox.frag.wgsl`

**API to implement:**
```cpp
TextureHandle createCubemap(int size, const void* faces[6], TextureFormat format);
void setCubemap(TextureHandle handle, int unit);
void drawSkybox(TextureHandle cubemap);
```

**Estimated lines:** ~180

---

### Phase 5: WebPBR System (Enables ~12 examples)
**Files to modify:**
- `al_WebGPUBackend.hpp` - PBR uniform buffers
- `al_WebGPUBackend.cpp` - PBR pipeline
- Already have: `shaders/wgsl/pbr.vert.wgsl`, `pbr.frag.wgsl`

**PBR Uniform buffer:**
```wgsl
struct PBRMaterial {
    albedo: vec4f,
    metallic: f32,
    roughness: f32,
    ao: f32,
    _pad: f32,
}

struct PBREnvironment {
    irradianceMapBound: u32,
    prefilteredMapBound: u32,
    brdfLUTBound: u32,
    exposure: f32,
}
```

**API additions:**
```cpp
void setPBRMaterial(float metallic, float roughness, float ao);
void setPBREnvironment(TextureHandle irradiance, TextureHandle prefiltered, TextureHandle brdfLUT);
void enablePBR(bool enable);
```

**Estimated lines:** ~300

---

### Phase 6: WebEnvironment / HDRI (Enables ~6 examples)
**Builds on Phase 4 & 5**

**Additional API:**
```cpp
void loadHDREnvironment(const char* url); // Async load
void setEnvironmentRotation(float angle);
void enableReflections(bool enable);
void beginReflectionCapture(const Vec3f& position);
void endReflectionCapture();
```

**Estimated lines:** ~200

---

### Phase 7: ProceduralTexture (Enables ~4 examples)
**Can be implemented entirely in C++ (CPU-side)**

The ProceduralTexture class generates texture data on CPU, then uploads via `createTexture2D()`. Once Phase 1 is done, this should "just work" if the class exists.

**Check if `ProceduralTexture` class exists in allolib-wasm or needs porting.**

**Estimated lines:** ~100 (if porting needed)

---

### Phase 8: LOD System (Enables ~4 examples)
**Mostly C++ logic, minimal GPU changes**

LOD switching is done on CPU based on distance. The GPU just renders whichever mesh/texture is selected.

**Estimated lines:** ~50 (integration only)

---

## Summary Table

| Phase | Feature | Examples Enabled | Est. Lines | Cumulative | Status |
|-------|---------|------------------|------------|------------|--------|
| 1 | 2D Textures | 15 | 250 | 250 | ✅ DONE |
| 2 | Full Lighting | 10 | 250 | 500 | Pending |
| 3 | EasyFBO | 5 | 150 | 650 | Pending |
| 4 | Cubemaps/Skybox | 8 | 180 | 830 | Pending |
| 5 | WebPBR | 12 | 300 | 1130 | Pending |
| 6 | WebEnvironment | 6 | 200 | 1330 | Pending |
| 7 | ProceduralTexture | 4 | 100 | 1430 | Pending |
| 8 | LOD System | 4 | 50 | 1480 | Pending |

**Total: ~1,480 lines of new code (250 complete)**

---

## GPU-Category Examples Needed

These examples MUST be recreated for WebGPU (cannot auto-convert):

| Original Example | GPU Version | Reason |
|------------------|-------------|--------|
| Custom Shader | GPU: Wave Deformation | GLSL → WGSL |
| Custom Shader | GPU: Dynamic Vertex Colors | GLSL → WGSL |
| Procedural Texture (shader-based) | GPU: Procedural Pattern | GLSL → WGSL |
| Post-process effects | GPU: Post-process Pack | GLSL → WGSL |

**Already Created:**
- Wave Deformation (uses vertex animation instead of vertex shader)
- Dynamic Vertex Colors (CPU-computed colors)
- Procedural Pattern (vertex colors instead of fragment shader)
- Gradient Sphere (vertex color interpolation)

**Still Need GPU Versions:**
- Screen-space post-processing (blur, bloom, etc.)
- Noise-based fragment shaders
- Any example that requires per-pixel computation in shader

---

## Recommended Implementation Order

1. **Phase 1 (Textures)** - Highest impact, enables many examples
2. **Phase 2 (Lighting)** - Core graphics feature
3. **Phase 4 (Cubemaps)** - Enables environment examples
4. **Phase 3 (EasyFBO)** - Enables post-processing
5. **Phase 5 (WebPBR)** - Advanced rendering
6. **Phase 6 (WebEnvironment)** - Builds on PBR
7. **Phase 7-8** - Lower priority, fewer examples

---

## Files Overview

### New Files to Create
- None required (all additions to existing files)

### Files to Modify
| File | Changes |
|------|---------|
| `al_WebGPUBackend.hpp` | Add texture, light, material, FBO, cubemap, PBR structs and methods |
| `al_WebGPUBackend.cpp` | Implement all new methods |
| `al_Graphics_Web.cpp` | Route texture/light/material calls through backend |
| `al_WebApp.cpp` | Minor integration if needed |

### Existing Shaders to Integrate
| Shader | Status |
|--------|--------|
| `mesh.vert/frag.wgsl` | ✅ In use |
| `color.vert/frag.wgsl` | Ready to integrate |
| `textured.vert/frag.wgsl` | Ready for Phase 1 |
| `lighting.vert/frag.wgsl` | Ready for Phase 2 |
| `pbr.vert/frag.wgsl` | Ready for Phase 5 |
| `skybox.vert/frag.wgsl` | Ready for Phase 4 |

---

## Success Criteria

After all phases:
- ✅ ALL non-shader examples work unchanged
- ✅ Shader examples have GPU-category equivalents
- ✅ User code uses same API (`g.draw()`, `g.texture()`, etc.)
- ✅ Backend selection is transparent to example code
