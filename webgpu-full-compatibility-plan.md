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

**Playwright tests:** ✅ COMPLETE
- [x] Add "WebGPU Phase 1: Textures" test suite to `webgpu-features.spec.ts`
- [x] Test texture loading and display (WebGL2 + WebGPU)
- [x] Test UV coordinate mapping
- [x] Test multiple texture binding
- [x] Generate visual baseline: `webgpu-phase1-texture-quad.png`

---

### Phase 2: Full Lighting System (Enables ~10 examples) ✅ COMPLETE
**Status:** Fully implemented with multi-light support, materials, and normal matrix computation. All 11 Playwright tests passing.

**Completed:**
- [x] Reimplemented WebGPU lighting uniforms and bind groups
- [x] Normal matrix computed (inverse transpose of modelView 3x3)
- [x] Multi-light support (up to 8 lights)
- [x] Material properties (ambient, diffuse, specular, emission, shininess)
- [x] Global ambient light support
- [x] Shader selection logic (lighting > textured > default)
- [x] Fixed uniform buffer layout bug (tint/params saved before normalMatrix write)
- [x] Fixed test canvas capture for WebGPU (uses Playwright screenshot instead of toDataURL)

**Files modified:**
- `al_WebGPUBackend.hpp` - Added LightData, MaterialData, LightingUniforms structs; lighting shader handle; API methods
- `al_WebGPUBackend.cpp` - Implemented createLightingShader(), updateLightingBindGroup(), flushLightingUniforms(); lighting API; shader selection in draw()
- `al_Graphics_Web.cpp` - Added syncLightingToBackend() helper; modified drawMeshWithWebGPU() to pass lighting data
- `al/graphics/al_Graphics.hpp` (patched) - Added numLights(), getLight(), isLightOn(), getMaterial() accessors

**Implementation approach:**
- Lighting shader uses two bind groups: uniforms (with normalMatrix) + lighting uniforms
- Graphics bridge syncs Light/Material data to WebGPU backend before each draw
- Normal matrix computed from modelView inverse transpose
- Uniform buffer layout dynamically adjusts offsets when lighting is enabled

**Lines added:** ~450 (includes shader, uniforms, API methods, sync code)

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
| 2 | Full Lighting | 10 | 450 | 700 | ✅ DONE |
| 3 | EasyFBO | 5 | 150 | 850 | Pending |
| 4 | Cubemaps/Skybox | 8 | 180 | 1030 | Pending |
| 5 | WebPBR | 12 | 300 | 1330 | Pending |
| 6 | WebEnvironment | 6 | 200 | 1530 | Pending |
| 7 | ProceduralTexture | 4 | 100 | 1630 | Pending |
| 8 | LOD System | 4 | 50 | 1680 | Pending |

**Total: ~1,680 lines of new code (700 complete)**

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

## CRITICAL: Pipeline Separation Guidelines

### Why This Matters
**Previous FBO implementation broke BOTH WebGL2 and WebGPU pipelines.** This section documents the architecture to prevent that.

### Current Backend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     al_Graphics_Web.cpp                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  GLOBAL STATE (DANGER ZONE)                              │   │
│  │  - sGraphicsBackend: GraphicsBackend*                    │   │
│  │  - sWebGPUMode: bool                                     │   │
│  │  - sTextureBridge: map<GLuint, TextureBridgeEntry>       │   │
│  │  - sMeshAdapter: WebMeshAdapter                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│         ┌────────────────────┴────────────────────┐              │
│         ▼                                         ▼              │
│  ┌──────────────┐                         ┌──────────────┐       │
│  │  WebGL2      │                         │  WebGPU      │       │
│  │  Backend     │                         │  Backend     │       │
│  │  (GL calls)  │                         │  (WGPU calls)│       │
│  └──────────────┘                         └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Golden Rules

1. **NEVER modify shared global state without guards**
   - `sTextureBridge` - affects both backends
   - `sMeshAdapter` - caches are backend-specific

2. **ALWAYS check `sWebGPUMode` before GL or WebGPU calls**
   ```cpp
   if (sWebGPUMode && sGraphicsBackend) {
       // WebGPU path
       return;
   }
   // WebGL2 path
   ```

3. **NEVER assume GL IDs work in WebGPU context**
   - GLuint (32-bit) ≠ Handle.id (64-bit)
   - FBO IDs created by GL are meaningless to WebGPU

4. **ALWAYS use abstract handles above the backend layer**
   - `TextureHandle`, `RenderTargetHandle`, `ShaderHandle`
   - Not `GLuint`, `WGPUTexture`, etc.

5. **ISOLATE backend-specific code with preprocessor guards**
   ```cpp
   #ifdef ALLOLIB_WEBGPU
   // WebGPU-only code
   #endif
   ```

### Critical Shared Resources

| Resource | WebGL2 | WebGPU | Risk |
|----------|--------|--------|------|
| Texture IDs | `GLuint` | `uint64_t handle` | **HIGH** - Bridge map keys are GLuint |
| FBO IDs | `GLuint` | `uint64_t handle` | **CRITICAL** - Stack stores unsigned int |
| Mesh Cache | Shared `sMeshAdapter` | Same | **HIGH** - Not invalidated on switch |
| Depth Formats | Flexible | Strict validation | **HIGH** - WebGPU rejects invalid |
| Viewport State | Implicit | Explicit | **MEDIUM** - Must coordinate |

### Key Files & Line Numbers

| File | Critical Sections |
|------|-------------------|
| `al_Graphics_Web.cpp:26-128` | Global state, backend registration |
| `al_Graphics_Web.cpp:632-720` | Draw routing (WebGL2 vs WebGPU) |
| `al_Graphics_Web.cpp:32-111` | Texture bridge (shared state!) |
| `al_WebGL2Backend.cpp:300-400` | RenderTarget implementation |
| `al_WebGPUBackend.cpp:1307-1318` | Shader selection (hardcoded) |
| `al_WebApp.cpp:688-784` | Backend initialization/selection |

---

## Automatic Shader Selection System

### Current State (Limited)
The WebGPU backend currently has **hardcoded shader selection**:
```cpp
// al_WebGPUBackend.cpp:1307-1318
if (mCurrentShader.valid()) {
    shaderToUse = mCurrentShader;      // User override
} else if (texture_bound) {
    shaderToUse = mTexturedShader;     // Auto-texture
} else {
    shaderToUse = mDefaultShader;      // Fallback
}
```

**Only handles**: textured vs non-textured. No lighting, PBR, etc.

### Existing WGSL Shaders (Ready to Use)

| Shader | Files | Current Status |
|--------|-------|----------------|
| Mesh | `mesh.vert/frag.wgsl` | ✅ Default shader |
| Color | `color.vert/frag.wgsl` | Ready, not integrated |
| Textured | `textured.vert/frag.wgsl` | ✅ Auto-selected on texture bind |
| Lighting | `lighting.vert/frag.wgsl` | Ready, not integrated |
| PBR | `pbr.vert/frag.wgsl` | Ready, not integrated |
| Skybox | `skybox.vert/frag.wgsl` | Ready, not integrated |

### Proposed: Smart Shader Selection

**Add rendering mode detection:**
```cpp
enum class RenderingMode {
    Mesh,       // Per-vertex colors (default)
    Color,      // Uniform color
    Textured,   // 2D texture bound
    Lit,        // Lighting enabled (g.lighting(true))
    PBR,        // PBR material set
    Skybox      // Skybox rendering
};

// In draw():
RenderingMode mode = detectRenderingMode(
    mBoundTextures,           // Any textures bound?
    mCurrentMaterial,         // PBR material set?
    mLightingEnabled,         // g.lighting(true) called?
    currentMesh.hasNormals()  // Mesh has normals?
);

ShaderHandle shader = mShaderRegistry.getShader(mode);
```

**Implementation location:** `al_WebGPUBackend.cpp:1307` (replace hardcoded logic)

### WebShaderManager Integration

**Existing infrastructure** (al_WebShaders.hpp):
```cpp
class WebShaderManager {
    ShaderHandle getShader(DefaultShader type);  // Already exists!
    // Types: Mesh, Color, Textured, Lighting, PBR, Skybox
};
```

**Enhancement needed:**
```cpp
// Add to WebGPUBackend
WebShaderManager mShaderManager;

// In initialization:
mShaderManager.setBackend(this);

// In draw():
DefaultShader shaderType = mapModeToShader(mode);
ShaderHandle shader = mShaderManager.getShader(shaderType);
```

---

## Phase Implementation Checklists

### Phase 2: Full Lighting ✅ COMPLETE

**Pre-implementation checklist:**
- [x] Read `al_WebGPUBackend.cpp:1870-1914` (current default shader)
- [x] Verify `lighting.vert/frag.wgsl` uniform layout matches
- [x] Check `al_Graphics_Web.cpp` lighting state forwarding

**Implementation steps:**
- [x] Add `mLightingEnabled` flag to WebGPUBackend
- [x] Implement `setLight(index, Light&)` method
- [x] Implement `setMaterial(Material&)` method
- [x] Create lighting uniform buffer (matches WGSL layout)
- [x] Add lighting shader to selection logic
- [x] **TEST WebGL2 still works after changes**

**Post-implementation verification:**
- [x] `npx playwright test --project=chromium-webgl2` passes
- [x] Lighting example works in WebGL2 mode
- [x] Lighting example works in WebGPU mode

**Playwright tests:** ✅ COMPLETE (11/11 passing)
- [x] Add "WebGPU Phase 2: Lighting" test suite to `webgpu-features.spec.ts`
- [x] Test single directional light (WebGL2 + WebGPU)
- [x] Test single point light (WebGL2 + WebGPU)
- [x] Test multiple lights (3 colored lights) (WebGL2 + WebGPU)
- [x] Test material properties (ambient/diffuse/specular/shininess) (WebGL2 + WebGPU)
- [x] Test lighting + textures combined (WebGL2 + WebGPU)
- [x] Generate visual baseline: `webgpu-phase2-lighting-sphere.png`
- [x] Cross-backend comparison test (WebGL2 vs WebGPU)
- Run: `npx playwright test webgpu-features.spec.ts -g "Phase 2"`

### Phase 3: EasyFBO / Render-to-Texture

**⚠️ HIGH RISK - This broke both pipelines before**

**Pre-implementation checklist:**
- [ ] Read `al_WebGL2Backend.cpp:300-400` (current RenderTarget impl)
- [ ] Read `allolib/src/graphics/al_FBO.cpp` (original GL impl)
- [ ] Understand `RenderManager::FBOStack` (stores GLuint IDs)

**Critical risks to address:**
1. **FBO ID type mismatch** - GLuint vs uint64_t handles
2. **Texture bridge doesn't sync depth textures** - Only RGBA/UBYTE
3. **Viewport not coordinated** - FBO bind sets viewport, pop doesn't restore
4. **Format validation** - WebGPU strict, WebGL2 flexible

**Safe implementation approach:**

```cpp
// NEW: Abstract FBO that works with both backends
class EasyFBOWeb {
    GraphicsBackend* mBackend;
    RenderTargetHandle mHandle;  // Abstract, not GLuint
    TextureHandle mColorTex;
    TextureHandle mDepthTex;

public:
    void init(GraphicsBackend* backend, int w, int h);
    void begin();  // Bind + viewport
    void end();    // Restore previous
};
```

**Implementation steps:**
- [ ] Create `EasyFBOWeb` class (NEW file, don't modify existing)
- [ ] Add depth texture support to texture bridge
- [ ] Create format validation for WebGPU
- [ ] Add viewport save/restore coordination
- [ ] **TEST WebGL2 EasyFBO still works**
- [ ] **TEST WebGPU EasyFBO works**
- [ ] **TEST switching backends doesn't break**

**Post-implementation verification:**
- [ ] All existing WebGL2 tests pass
- [ ] EasyFBO test renders correctly in WebGL2
- [ ] EasyFBO test renders correctly in WebGPU
- [ ] Multiple nested FBOs work
- [ ] Viewport correctly restored after popFramebuffer

**Playwright tests to create:**
- [ ] Add "WebGPU Phase 3: EasyFBO" test suite to `webgpu-features.spec.ts`
- [ ] Test render-to-texture basic functionality
- [ ] Test FBO color attachment is readable as texture
- [ ] Test nested FBOs (2 levels deep)
- [ ] Test viewport save/restore after FBO operations
- [ ] Generate visual baseline: `webgpu-fbo-mirror.png`
- [ ] Run: `npx playwright test webgpu-features.spec.ts -g "Phase 3"`

---

## Risk Analysis: Cross-Pipeline Breakage

### What Broke Last Time (FBO)

1. **Type confusion**: Code assumed FBO IDs (GLuint) worked everywhere
2. **Missing null checks**: WebGPU backend wasn't initialized
3. **Shared state corruption**: Texture bridge got stale entries
4. **Format mismatch**: WebGPU rejected depth formats WebGL2 accepted

### Prevention Strategies

**Strategy 1: Defensive mode checks**
```cpp
// ALWAYS check mode before backend calls
void someFunction() {
    if (!sGraphicsBackend) return;  // Null check first

    if (sWebGPUMode) {
        // WebGPU path - uses handles
        sGraphicsBackend->doSomething(handle);
        return;
    }

    // WebGL2 path - can use GL directly
    glDoSomething(glId);
}
```

**Strategy 2: Type-safe wrappers**
```cpp
// Don't store raw IDs in stacks
struct FBOEntry {
    enum class Type { GL, Handle } type;
    uint64_t value;  // Big enough for both
};
```

**Strategy 3: Test after every change**
```bash
# After ANY change to al_Graphics_Web.cpp or backends:
npx playwright test --project=chromium-webgl2
```

**Strategy 4: Isolate new code**
- Create NEW files for new features (e.g., `al_EasyFBOWeb.cpp`)
- Don't modify existing working code paths
- Use composition over modification

---

## Playwright Testing Requirements

### Testing Strategy

**CRITICAL: Every completed phase MUST have corresponding Playwright tests.**

After implementing any phase:
1. Create tests in `tests/e2e/webgpu-features.spec.ts`
2. Run full test suite to ensure no regressions
3. Generate visual baselines if applicable

### Test File Structure

```
tests/
├── e2e/
│   ├── rendering-tests.spec.ts      # Core WebGL2/WebGPU rendering (existing)
│   ├── visual-regression.spec.ts    # Screenshot comparisons (existing)
│   ├── webgpu-features.spec.ts      # NEW: WebGPU feature-specific tests
│   └── example-compatibility.spec.ts # Example compilation (existing)
└── screenshots/
    └── baseline/
        ├── webgpu-texture-*.png      # Phase 1 baselines
        ├── webgpu-lighting-*.png     # Phase 2 baselines
        ├── webgpu-fbo-*.png          # Phase 3 baselines
        └── ...
```

### Phase-Specific Test Requirements

#### Phase 1: Textures ✅ COMPLETE (7/7 passing)
- [x] Test: Texture loads and displays correctly
- [x] Test: UV coordinates work properly
- [x] Test: Multiple textures can be bound
- [x] Visual baseline: `webgpu-phase1-texture-quad.png`

#### Phase 2: Full Lighting ✅ COMPLETE (11/11 passing)
- [x] Test: Single directional light (WebGL2 + WebGPU)
- [x] Test: Single point light (WebGL2 + WebGPU)
- [x] Test: Multiple lights (3 colored lights)
- [x] Test: Material ambient/diffuse/specular
- [x] Test: Lighting + textures combined
- [x] Visual baseline: `webgpu-phase2-lighting-sphere.png`
- [x] Cross-backend comparison (WebGL2 vs WebGPU)

#### Phase 3: EasyFBO
- [ ] Test: Render to texture works
- [ ] Test: FBO color attachment readable
- [ ] Test: Nested FBOs work correctly
- [ ] Test: Viewport restored after FBO pop
- [ ] Visual baseline: Render-to-texture mirror effect

#### Phase 4: Cubemaps/Skybox
- [ ] Test: Cubemap loads all 6 faces
- [ ] Test: Skybox renders behind scene
- [ ] Test: Environment mapping on reflective surface
- [ ] Visual baseline: Scene with skybox

#### Phase 5: WebPBR
- [ ] Test: PBR material properties apply
- [ ] Test: Metallic/roughness affects appearance
- [ ] Test: PBR + textures combined
- [ ] Visual baseline: PBR material showcase

#### Phase 6: WebEnvironment/HDRI
- [ ] Test: HDR environment loads
- [ ] Test: IBL lighting affects scene
- [ ] Test: Environment rotation works
- [ ] Visual baseline: HDRI-lit sphere

#### Phase 7: ProceduralTexture
- [ ] Test: Procedural texture generates correctly
- [ ] Test: Different noise types work
- [ ] Visual baseline: Procedural noise pattern

#### Phase 8: LOD System
- [ ] Test: LOD switches at correct distances
- [ ] Test: No visual pop on transition
- [ ] Visual baseline: Multi-LOD object

### Test Template

```typescript
// tests/e2e/webgpu-features.spec.ts
import { test, expect } from '@playwright/test';

test.describe('WebGPU Phase X: [Feature Name]', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean state
    await page.evaluate(() => {
      localStorage.removeItem('allolib-project');
      localStorage.removeItem('allolib-code');
      localStorage.removeItem('unified-project');
    });
  });

  test('should [test description]', async ({ page }) => {
    await page.goto('/');

    const testCode = `
#include "al/app/al_App.hpp"
using namespace al;

class TestApp : public App {
  void onCreate() override {
    // Configure WebGPU backend
    configureBackend(BackendType::WebGPU);
  }
  void onDraw(Graphics& g) override {
    g.clear(0.1, 0.1, 0.1);
    // Test-specific drawing code
  }
};

ALLOLIB_WEB_MAIN(TestApp)
`;

    // Set code and compile
    await page.evaluate((code) => {
      const store = (window as any).__pinia?.state?.value?.project;
      if (store?.files?.[0]) {
        store.files[0].content = code;
      }
    }, testCode);

    // Click run and wait for canvas
    await page.locator('[data-testid="run-button"]').first().click();
    await page.waitForSelector('[data-testid="canvas"]', { state: 'visible', timeout: 60000 });

    // Wait for rendering
    await page.waitForTimeout(2000);

    // Capture and compare (for visual tests)
    const canvas = page.locator('[data-testid="canvas"]');
    const screenshot = await canvas.screenshot();
    expect(screenshot).toMatchSnapshot('webgpu-feature-name.png', { threshold: 0.1 });
  });
});
```

### Running WebGPU Tests

```bash
cd tests

# Run all WebGPU feature tests
npx playwright test webgpu-features.spec.ts

# Run specific phase tests
npx playwright test webgpu-features.spec.ts -g "Phase 2"

# Update baselines after visual changes
UPDATE_BASELINES=true npx playwright test webgpu-features.spec.ts

# Run with headed mode (required for WebGPU)
npx playwright test webgpu-features.spec.ts --headed
```

### CI/CD Integration

WebGPU tests should be tagged to allow conditional execution:

```typescript
test.describe('WebGPU Phase 2: Lighting @webgpu', () => {
  // Tests here
});
```

Run only WebGPU tests:
```bash
npx playwright test --grep @webgpu
```

Skip WebGPU tests in environments without GPU:
```bash
npx playwright test --grep-invert @webgpu
```

---

## Success Criteria

After all phases:
- ✅ ALL non-shader examples work unchanged
- ✅ Shader examples have GPU-category equivalents
- ✅ User code uses same API (`g.draw()`, `g.texture()`, etc.)
- ✅ Backend selection is transparent to example code
- ✅ WebGL2 tests pass after every WebGPU change
- ✅ No shared state corruption between backends
- ✅ **Playwright tests exist for every implemented phase**
- ✅ **Visual regression baselines captured for each feature**
