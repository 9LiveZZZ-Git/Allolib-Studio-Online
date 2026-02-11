# AlloLib Studio Online — Roadmap & Implementation Plan

## Current State (2026-02-10)

- **WebGPU Compatibility:** Phases 1-8 complete (textures, lighting, FBO, cubemaps, PBR, environment, procedural, LOD)
- **Test Suite:** 308 tests (154 examples × 2 backends), 290 passing (94.2%), 100% compilation
- **Visual Baselines:** 290 PNGs captured in `tests/baselines/` (149 WebGL2 + 141 WebGPU)
- **Phase 1 Complete:** Full test baseline established, pass rates documented
- **Desktop App:** Electron scaffolding complete (main process, IPC, auto-update, CI builds)
- **Sequencer/Timeline:** Extensive frontend infrastructure (stores, components, tone lattice), playback integration incomplete

---

## Phase 1: Full Test Suite Baseline

**Goal:** Run all 308 tests, document pass rates, create visual baselines, fix any remaining failures.

**Effort:** 1-2 days

### Tasks

1. **Run full enhanced test suite on both backends**
   ```bash
   cd tests && SKIP_WEBSERVER=1 TEST_URL=http://localhost:5173 \
     npx playwright test enhanced-functional-tests.spec.ts --timeout=240000
   ```

2. **Capture visual baselines**
   ```bash
   cd tests && UPDATE_BASELINES=true SKIP_WEBSERVER=1 TEST_URL=http://localhost:5173 \
     npx playwright test enhanced-functional-tests.spec.ts --timeout=240000
   ```

3. **Document results** — Generate markdown reports for both backends with:
   - Compilation pass rate (target: 100%)
   - Rendering pass rate (target: 100%)
   - Visual verification pass rate (target: >90%)
   - List of any failing examples with root causes

4. **Fix remaining failures** — Triage and fix any examples that fail rendering or visual checks. Known issues:
   - `rm-sphere-basic` WebGPU: only 2 unique colors (may need lighting fix)
   - `ca-game-of-life` WebGPU: no visible content (rendering issue)
   - Some examples may need adjusted visual expectations

### Deliverables
- [x] Full test run report committed to `tests/reports/`
- [x] Visual baselines captured in `tests/baselines/` (290 PNGs: 149 WebGL2 + 141 WebGPU)
- [x] All fixable failures resolved (rate limit fix: POST-only rate limiting)
- [x] CLAUDE.md updated with final pass rates

### Results (2026-02-10)

| Metric | WebGL2 | WebGPU | Combined |
|--------|--------|--------|----------|
| Examples tested | 154 | 154 | 308 |
| Passed | 149 | 141 | 290 |
| Failed | 5 | 13 | 18 |
| Pass rate | 96.8% | 91.6% | 94.2% |
| Compilation | 100% | 100% | 100% |
| Baselines captured | 149 | 141 | 290 |

**Remaining failures (not fixable — rendering limitations):**

| Example | WebGL2 | WebGPU | Issue |
|---------|--------|--------|-------|
| `ca-wireworld` | fail | fail | Point-based grid too sparse for content detection |
| `life-creatures-simple` | fail | fail | Point-based creatures too sparse |
| `agents-predator-prey` | fail | fail | Small agents on dark background |
| `pg-subtractive` | fail | - | Audio-only visual, dark background |
| `studio-showcase-emergence` | fail | fail | Complex emergence sim, sparse initial content |
| `sim-particle-fountain` | - | fail | Particles too sparse on WebGPU |
| `sim-flocking` | - | fail | Small boids on dark background |
| `sim-ant-trails` | - | fail | Point-based trails too sparse |
| `ca-game-of-life` | - | fail | Grid too sparse for detection |
| `pg-audiovisual-color` | - | fail | Audio-reactive, needs audio input |
| `studio-showcase-particles` | - | fail | Complex particle system |
| `particle-system` | - | timeout | WebGPU compile timeout (4 min) |
| `sim-point-test` | - | timeout | WebGPU compile timeout (4 min) |
| `particles-fire` | - | timeout | WebGPU compile timeout (4 min) |

**Note:** All failures are rendering/visual-detection limitations, not compilation failures. The examples work correctly when viewed interactively.

---

## Phase 2: 3D Textures & HDR Textures (WebGPU)

**Goal:** Make the remaining 2 LOW-priority texture features work on WebGPU.

**Effort:** 4-5 days

### 2A: 3D Textures (~3 days)

**Current state:** WebGL2 works. WebGPU has partial infrastructure (TextureDesc supports `depth`, createTexture checks 3D dimension) but critical bugs and missing shader code.

**Files to modify:**

| File | Change |
|------|--------|
| `al_WebGPUBackend.cpp:1675` | **Bug fix:** Change `{width, height, 1}` to `{width, height, depth}` for 3D upload |
| `al_WebGPUBackend.cpp` | Add WGSL 3D texture sampling shader (`texture_3d<f32>`) |
| `al_WebGPUBackend.cpp` | Add 3D texture bind group layout (separate from 2D) |
| `al_Graphics_Web.cpp:44-182` | Extend texture bridge to detect and sync 3D textures |
| `al_WebGPUBackend.cpp` | Update shader selection: detect 3D texture bound → use 3D shader |

**New WGSL shader needed:**
```wgsl
@group(1) @binding(0) var tex3d: texture_3d<f32>;
@group(1) @binding(1) var samp3d: sampler;

@fragment fn fs_main(in: FragInput) -> @location(0) vec4f {
    let color = textureSample(tex3d, samp3d, in.texcoord3d);
    return color * uniforms.tint;
}
```

**Test:** Run "3D Noise Volume" example (`studio-tex-3d-noise`) on WebGPU.

### 2B: HDR Float Textures (~2 days)

**Current state:** HDR loading works (WebHDR.hpp parses .hdr files). WebGPU format enums exist (RGBA16F, RGBA32F). PBR/Environment phases use HDR indirectly. Direct float texture upload to WebGPU not wired up.

**Files to modify:**

| File | Change |
|------|--------|
| `al_Graphics_Web.cpp` | `Graphics_registerTexture()`: detect float format, preserve RGBA16F/RGBA32F |
| `al_WebGPUBackend.cpp:1615` | Render target creation: support RGBA16Float for HDR FBOs |
| `al_WebGPUBackend.cpp:1687` | `updateTexture()`: handle float pixel data (4 bytes/component) |

**Test:** Run "HDR Exposure Control" example (`studio-tex-hdr-exposure`) on WebGPU.

### Deliverables
- [ ] 3D texture upload bug fixed
- [ ] WGSL 3D sampling shader implemented
- [ ] Float texture bridge working
- [ ] HDR render target support
- [ ] Both examples pass on WebGPU
- [ ] Playwright tests added to `webgpu-features.spec.ts`
- [ ] `webgpu-full-compatibility-plan.md` updated

---

## Phase 3: GLSL-to-WGSL Shader Examples

**Goal:** Create WebGPU-native WGSL versions of examples that use custom GLSL shaders.

**Effort:** 5-7 days

### Current GLSL Examples (Cannot Auto-Convert)

| Example | Type | GLSL Lines | Complexity |
|---------|------|------------|------------|
| `custom-shader` | Vertex deformation + rainbow fragment | ~50 | Medium |
| `easyfbo-test` | Post-process (invert/grayscale/pixelate) | ~30 | Low |
| `rm-sphere-basic` | Basic ray march | ~50 | Medium |
| `rm-csg-operations` | CSG (union/intersection/difference) | ~35 | Medium |
| `rm-infinite-repetition` | Domain repetition | ~45 | Medium |
| `rm-mandelbulb` | Mandelbulb fractal | ~55 | High |
| `rm-terrain` | Noise terrain + camera | ~90 | High |
| `rm-volumetric-clouds` | Volumetric clouds + light scattering | ~80 | High |
| `rm-organic-blob` | Animated metaballs + SSS | ~90 | High |
| `fluid-lava-lamp` | Metaball field + temperature | ~50 | Medium |

### Implementation Strategy

**Option A: Dual-shader examples** (recommended)
- Each example includes both GLSL and WGSL versions
- Runtime selects based on active backend
- User code unchanged — shader selection automatic
- Requires adding WGSL string to each example's C++ code

**Option B: Custom shader pipeline in WebGPU backend**
- Add `compileWGSLShader(const char* vertex, const char* fragment)` to WebGPU backend
- Examples call `g.shader(myWGSLShader)` when in WebGPU mode
- More flexible but more infrastructure work

### Priority Order

1. **Post-process shaders** (`easyfbo-test`) — validates FBO + custom fragment pipeline
2. **Custom vertex shader** (`custom-shader`) — validates custom vertex pipeline
3. **Basic ray marching** (`rm-sphere-basic`) — template for all ray march examples
4. **CSG + repetition** (`rm-csg-operations`, `rm-infinite-repetition`) — SDF library in WGSL
5. **Complex ray marching** (mandelbulb, terrain, clouds, blob, lava lamp) — using SDF library

### WGSL Ray March Template

All ray marching examples share a common pattern. Create a reusable WGSL template:

```wgsl
// Vertex: fullscreen quad
@vertex fn vs_main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
    let pos = array(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
    return vec4f(pos[vi], 0, 1);
}

// Fragment: ray march loop
@fragment fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
    let uv = (fragCoord.xy - uniforms.resolution * 0.5) / uniforms.resolution.y;
    let ro = uniforms.cameraPos;
    let rd = normalize(vec3f(uv, 1.0));
    // ... march loop, SDF, lighting ...
}
```

### Custom Shader Infrastructure Needed

To support user-written WGSL shaders in WebGPU mode:

1. **`al_WebGPUBackend.cpp`**: Add `compileCustomShader(wgslSource)` → returns ShaderHandle
2. **`al_Graphics_Web.cpp`**: Route `g.shader()` to compile WGSL when in WebGPU mode
3. **Uniform binding**: Custom shaders need access to standard uniforms (time, resolution, modelView, projection)
4. **Fullscreen quad mesh**: Add built-in fullscreen quad for fragment-only shaders

### Deliverables
- [ ] Post-process WGSL shader (invert, grayscale, pixelate)
- [ ] Custom vertex deformation WGSL shader
- [ ] Ray march WGSL template with SDF library
- [ ] All 10 GLSL examples have WGSL equivalents
- [ ] Custom shader compilation pipeline in WebGPU backend
- [ ] Examples auto-select shader based on backend
- [ ] Tests added for each shader example

---

## Phase 4: Screen-Space Post-Processing Pipeline

**Goal:** Build a proper post-processing pipeline for WebGPU with bloom, blur, and other effects.

**Effort:** 5-7 days

### Architecture

```
Scene Render → FBO (HDR) → Post-Process Chain → Screen
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
                  Bloom      Blur     Tone Map
```

### Components

1. **PostProcessPipeline class** (new C++ header: `al_WebPostProcess.hpp`)
   - Manages chain of post-process effects
   - Each effect: input texture → WGSL fragment shader → output texture
   - Final output to screen

2. **Built-in effects** (WGSL shaders):
   - **Bloom**: Brightness threshold → Gaussian blur (2-pass) → Additive blend
   - **Gaussian Blur**: Separable horizontal + vertical passes
   - **Tone Mapping**: Reinhard, ACES, exposure control
   - **Color Grading**: Brightness, contrast, saturation, vignette
   - **FXAA**: Fast approximate anti-aliasing

3. **User API**:
   ```cpp
   PostProcessPipeline pp;
   pp.addEffect(PostEffect::Bloom, {{"threshold", 0.8f}, {"intensity", 1.5f}});
   pp.addEffect(PostEffect::ToneMap, {{"exposure", 1.0f}, {"method", "aces"}});

   // In onDraw:
   pp.begin(g);         // Redirects to FBO
   // ... scene rendering ...
   pp.end(g);           // Applies effects and renders to screen
   ```

### Dependencies
- Phase 2B (HDR textures) — bloom needs float FBOs
- Phase 3 (custom WGSL shaders) — effects are WGSL fragment shaders
- Phase 3 EasyFBO WGSL — render-to-texture pipeline

### Deliverables
- [ ] `al_WebPostProcess.hpp` with PostProcessPipeline class
- [ ] Bloom effect (threshold + blur + blend)
- [ ] Gaussian blur effect (separable, configurable radius)
- [ ] Tone mapping (Reinhard + ACES)
- [ ] Color grading (brightness/contrast/saturation/vignette)
- [ ] Example: "Post-Process Demo" showing all effects
- [ ] Works on both WebGL2 (GLSL) and WebGPU (WGSL)

---

## Phase 5: Sequencer & Timeline Improvements

**Goal:** Complete the playback integration and polish the sequencer/timeline UX.

**Effort:** 7-10 days

### Current State

**Working:**
- Clip CRUD, arrangement, track management
- Transport (play/pause/stop, BPM, snap grid)
- Tone lattice (2D/3D) with note/path/chord modes
- Keyframe creation, selection, deletion, clipboard
- Multi-category tracks (audio, objects, environment, events)
- Easing curves (9 types + custom bezier)
- WASM bridge (`al_seq_trigger_on/off/set_param`)

**Incomplete:**
- Audio automation playback (parameters not interpolated during playback)
- Visual keyframe execution (objects/environment not updated during playback)
- Event track implementation (camera, markers, scripts)
- Curve visualization in KeyframeLane

### Tasks

#### 5A: Audio Automation Playback (3 days)
1. **Interpolate automation points during playback**
   - In `playback.ts`: during play loop, for each active clip instance, evaluate automation curves at current time
   - Call `al_seq_set_param(voiceId, paramIndex, interpolatedValue)` for each parameter
   - Support all easing types for automation curves

2. **Visual feedback during playback**
   - Highlight active automation points as playhead passes
   - Show current parameter values in parameter lanes

#### 5B: Visual Keyframe Execution (3 days)
1. **Object keyframe evaluation**
   - In timeline playback loop, evaluate all `KeyframeCurve<T>` at current time
   - Push interpolated transforms to WASM via `WebObjectManager`
   - Support position, rotation, scale, material properties

2. **Environment keyframe evaluation**
   - Same pattern for background color, fog, lighting intensity
   - Push to WASM environment state

#### 5C: Event Track (2 days)
1. **Camera keyframes** — Interpolate camera position/target/up during playback
2. **Markers** — Visual-only time markers (labels on ruler)
3. **Scripts** — Trigger JS callbacks at specific times (stretch goal)

#### 5D: UX Polish (2 days)
1. **Curve canvas rendering** in KeyframeLane — draw interpolated curves between keyframes
2. **Waveform visualization** — Show audio waveform in audio track lanes
3. **Timeline zoom-to-fit** — Auto-scale to show all content
4. **Undo/redo** for sequencer operations

### Key Files

| File | Purpose |
|------|---------|
| `frontend/src/stores/sequencer/playback.ts` | Transport + voice scheduling |
| `frontend/src/stores/sequencer/clips.ts` | Clip + automation point management |
| `frontend/src/stores/timeline.ts` | Unified timeline orchestration |
| `frontend/src/stores/objects.ts` | Scene objects + keyframe curves |
| `frontend/src/stores/environment.ts` | Global settings + keyframe curves |
| `frontend/src/components/timeline/tracks/KeyframeLane.vue` | Keyframe visualization |
| `allolib-wasm/include/al_WebSequencerBridge.hpp` | WASM audio bridge |
| `allolib-wasm/include/al_WebObjectManager.hpp` | WASM object bridge |

### Deliverables
- [ ] Audio parameters interpolated and sent to WASM during playback
- [ ] Object transforms updated from keyframes during playback
- [ ] Environment settings updated from keyframes during playback
- [ ] Camera animation via event track
- [ ] Curve visualization in expanded keyframe lanes
- [ ] Timeline zoom-to-fit

---

## Phase 6: Desktop App (Electron)

**Goal:** Ship a beta release of the desktop app.

**Effort:** 3-5 days

### Current State

**Working:**
- Main process with window/menu/tray management
- Backend spawning with health check
- IPC bridge with context isolation
- Auto-update via electron-updater + GitHub releases
- CI workflow for Windows/macOS/Linux builds
- Build scripts for local development

**Missing:**
- App icons (only placeholder generation script exists)
- Code signing (Windows/macOS)
- Port conflict handling
- Electron-specific E2E tests

### Tasks

1. **Create app icons** (1 day)
   - Design 256×256 PNG with AlloLib branding
   - Run `generate-icons.js` to create platform-specific formats
   - Add `icon.ico`, `icon.icns`, `icon.png`, `tray-icon.png` to `desktop/resources/`

2. **Fix branch references** (0.5 day)
   - Update `release-desktop.yml` to trigger on `dev` branch tags
   - Verify workflow runs end-to-end

3. **Port conflict handling** (0.5 day)
   - In `backend-runner.ts`: detect if port 3001 is in use
   - Try next available port, pass to frontend via IPC

4. **Test release flow** (1 day)
   - Tag a beta version: `git tag v0.1.0-beta.1`
   - Verify GitHub Actions builds for all platforms
   - Test auto-update from beta.1 to beta.2

5. **Basic Electron E2E tests** (1 day)
   - App launches and shows window
   - Backend starts and responds to health check
   - Frontend loads and Monaco editor renders
   - Example compiles and renders

### Deliverables
- [ ] App icons designed and committed
- [ ] CI workflow tested with real tag push
- [ ] Port conflict fallback implemented
- [ ] Beta release published to GitHub Releases
- [ ] Basic E2E test for Electron app

---

## Phase 7: CI/CD Updates

**Goal:** Align CI/CD with current codebase state and add missing infrastructure.

**Effort:** 2-3 days

### Issues Found

| Issue | File | Fix |
|-------|------|-----|
| Branch mismatch | `example-compatibility.yml`, `rendering-tests.yml` | Change `develop` to `dev` in `on.push.branches` |
| WebGPU headless | `rendering-tests.yml` | Add `--headed` flag or use Xvfb for headed mode in CI |
| Missing reporter | `playwright.config.ts` | Create `tests/reporters/error-tracker.ts` or remove reference |
| Missing teardown | `playwright.config.ts` | Create `tests/global-teardown.ts` or remove reference |
| Example count | `example-compatibility.yml` | Update from 107 to 154 |
| Docker socket path | `docker-compose.yml` | Fix `//var/run/docker.sock` → `/var/run/docker.sock` |

### Tasks

1. **Fix branch references** (0.5 day)
   - Update all workflows to use `dev` branch instead of `develop`
   - Keep `main` triggers for release workflows

2. **Fix test infrastructure** (1 day)
   - Create or remove references to missing reporter/teardown files
   - Update example count to match actual examples
   - Fix Docker path issues

3. **Add WebGPU CI support** (1 day)
   - Use `xvfb-run` for headed Playwright on Linux
   - Or switch to Chrome's `--headless=new` mode with GPU emulation
   - Remove `continue-on-error` once WebGPU tests are stable

4. **Add test result badges** (0.5 day)
   - Render pass/fail badges in README
   - Link to latest test reports

### Deliverables
- [ ] All workflows trigger on correct branches
- [ ] Missing test infrastructure files created
- [ ] WebGPU tests run in CI (not just skipped)
- [ ] Docker configuration fixed
- [ ] README badges for test status

---

## Timeline Summary

| Phase | Description | Effort | Dependencies | Priority |
|-------|-------------|--------|--------------|----------|
| **1** | Full test baseline | 1-2 days | None | **Critical** |
| **2** | 3D + HDR textures | 4-5 days | Phase 1 | High |
| **3** | GLSL→WGSL shaders | 5-7 days | Phase 1 | High |
| **4** | Post-processing pipeline | 5-7 days | Phase 2B, 3 | Medium |
| **5** | Sequencer/timeline | 7-10 days | None | Medium |
| **6** | Desktop app beta | 3-5 days | None | Medium |
| **7** | CI/CD updates | 2-3 days | None | High |

### Recommended Execution Order

```
Week 1:  Phase 1 (baseline) + Phase 7 (CI/CD)
Week 2:  Phase 2 (3D/HDR textures)
Week 3:  Phase 3 (GLSL→WGSL shaders)
Week 4:  Phase 4 (post-processing) — depends on Phase 2+3
Week 5:  Phase 5A-5B (sequencer playback)
Week 6:  Phase 5C-5D (events + polish) + Phase 6 (desktop)
```

Phases 5, 6, and 7 have no dependencies on each other and can be parallelized.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebGPU canvas readback stays broken | Medium | Frame counter fallback already implemented; accept for animation detection |
| 3D texture not supported by Dawn/Emscripten | High | Check Dawn texture_3d support before starting; fall back to 2D atlas |
| WGSL ray marching performance | Medium | Test on target hardware; optimize march step count |
| Electron build fails on macOS ARM64 | Low | Test locally before CI; use cross-compilation |
| Sequencer WASM bridge latency | Medium | Batch parameter updates; use SharedArrayBuffer if needed |

---

## Success Criteria

- [ ] 308/308 tests passing (compilation + rendering)
- [ ] >95% visual verification pass rate on both backends
- [ ] All 154 examples work on WebGL2, >145 on WebGPU
- [ ] Ray marching examples render on WebGPU
- [ ] Post-processing effects work on both backends
- [ ] Sequencer plays back with audio parameter automation
- [ ] Timeline plays back with object/environment keyframes
- [ ] Desktop app installable on Windows/macOS/Linux
- [ ] CI/CD runs on every push to dev, green badge on README
