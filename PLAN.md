# AlloLib Studio Online — Forward Plan

Last updated: 2026-04-23

---

## Current Status

The project is production-ready and comprehensively tested.

**What works today:**
- 155 AlloLib C++ examples compile and render at 100% pass rate on both WebGL2 and WebGPU
- Full WebGPU compatibility layer (Phases 1-8 complete): textures, multi-light, EasyFBO, cubemaps/skybox, PBR materials, HDRI/IBL, procedural textures, LOD
- Unified 4-category timeline: Audio, Objects, Environment, Events — with keyframe animation and easing curves
- DAW-style sequencer with tone lattice, clip arrangement, and polyphonic synthesis
- Monaco editor with C++ syntax, error diagnostics, multi-file projects, 155 examples
- Video recording, screenshot export, and social media size presets
- Electron desktop app with bundled backend
- Playwright E2E test suite: comprehensive functional, visual verification, interaction, and visual regression tests

**Test coverage summary:**
- `comprehensive-functional-tests.spec.ts` — 155 examples × 2 backends, 100% compile + render
- `webgpu-features.spec.ts` — WebGPU Phase 1-8 feature regression
- `enhanced-functional-tests.spec.ts` — per-example visual expectations with baseline comparison
- `true-functional-tests.spec.ts` — 13 keyboard/mouse interaction tests

---

## Architecture Overview

Browser-based IDE: users write C++ in Monaco Editor, the frontend POSTs it to a Node/Express backend that queues the job via BullMQ/Redis and runs Emscripten inside a Docker container. The compiled `.wasm` + `.js` are served back and loaded in the browser WASM runtime. Rendering uses a dual-backend abstraction (`GraphicsBackend` interface) with a WebGL2 implementation (stable, 95%+ browser support) and a WebGPU implementation (modern, ~60% support). Audio runs in an AudioWorklet at 128 samples/buffer. The `allolib-wasm/include/` layer patches AlloLib headers without forking the library — include order is critical.

The frontend is Vue 3 + Pinia + TypeScript. Pinia stores own all app state (project files, scene objects, timeline, sequencer, settings). A thin service layer (`runtime.ts`, `objectManager.ts`, `compiler.ts`) bridges the WASM module to the stores. The timeline's playhead is owned by the sequencer store (audio timing is authoritative); keyframe interpolation is evaluated in `composables/useKeyframes.ts` and pushed to WASM via `objectManager.setProperty()`.

---

## Active Priorities

### 1. Events Track Keyframe Wiring (Small, High Value)

The Events track (camera keyframes, markers, spawn/destroy triggers, script events) is fully implemented in `frontend/src/stores/events.ts`, but `timeline.ts` cannot yet add/remove keyframes to it — two TODO comments at `timeline.ts:524` and `timeline.ts:536` point to the gap. EventsStore needs `addKeyframe` and `removeKeyframe` methods exposed, and the timeline store switch statement needs an `events` case.

Files to touch: `frontend/src/stores/events.ts`, `frontend/src/stores/timeline.ts`

### 2. Animation Detection Improvement

The headless Playwright test environment cannot reliably detect slow-moving animations. The current approach diffs two canvas frames; it works for fast animations (oscillator-types 27% change, camera-control 21% change) but silently passes slow simulations as "not animated." The fix is multi-frame sampling with configurable sensitivity — capture N frames over a longer window and aggregate the maximum pixel delta.

Files to touch: `tests/e2e/visual-verification.ts` (`AnimationDetector` class)

### 3. WebGPU Mipmap Generation via Compute

`allolib-wasm/src/al_WebGPUBackend.cpp:1722` has a `// TODO: Implement mipmap generation via compute`. Currently single-level mipmaps are used for WebGPU textures. WebGPU exposes a compute pipeline that can generate full mip chains, which would improve texture quality at distance. This is low risk but improves visual fidelity.

Files to touch: `allolib-wasm/src/al_WebGPUBackend.cpp`

### 4. WebGPU 3D Textures and HDR Texture Support

Two WebGPU texture formats remain unported: 3D textures (used in the 3D Noise Volumes example) and HDR float textures (used in HDR-specific examples). These affect a small number of examples but complete the coverage gap. The texture bridge pattern from Phase 1 provides the model to follow.

Files to touch: `allolib-wasm/src/al_WebGPUBackend.cpp`, `allolib-wasm/include/al_WebGPUBackend.hpp`

### 5. Native WebPBR and WebFont Compatibility

The native compatibility headers (`allolib-wasm/include/native_compat/`) cover most web headers but two are missing native equivalents: `WebPBR` (PBR shaders need adaptation from WebGL2 to desktop OpenGL) and `WebFont` (uses browser canvas API; native would need FreeType). This matters for users who want to export their web projects to run locally with native AlloLib.

Files to touch: `allolib-wasm/include/native_compat/`

---

## Known Limitations / Open Issues

- **No GLSL→WGSL auto-transpilation**: Custom shaders must be written separately for each backend. This is fundamental — the languages are too different.
- **Audio context requires user gesture**: Browser policy prevents AudioContext creation in headless test environments and on page load. Audio tests cannot be automated.
- **Max 8 lights in WebGPU**: The lighting WGSL shader has a hardcoded 8-light limit. Raising it requires recompiling the shader with a new array size.
- **WASM memory cannot shrink**: `ALLOW_MEMORY_GROWTH` means the heap only grows. Long sessions may accumulate memory.
- **WebGPU browser support ~60%**: Chrome 113+, Edge 113+, Safari 18+ only. Firefox requires a flag.
- **Events track keyframes**: `EventsStore.addKeyframe/removeKeyframe` not yet exposed (see `frontend/src/stores/timeline.ts:524`).
- **Headless animation detection**: Slow animations show "not detected" in test reports — a known limitation of the two-frame diff approach.

---

## Long-Term Vision

AlloLib Studio Online aims to be the definitive browser-based environment for learning and creating with AlloLib: write C++, hear audio, see 3D graphics, record a video, share a URL — no install required. The key next horizon is **GPU compute**: WebGPU compute shaders would unlock GPU-accelerated particle systems, fluid simulation, and audio synthesis (GPU convolution reverb, spectral processing). The dual-backend abstraction is already designed to accommodate compute pipelines. Beyond compute, a hosted deployment (static frontend + cloud compilation) would eliminate the Docker requirement and make the tool accessible to students without developer environments.
