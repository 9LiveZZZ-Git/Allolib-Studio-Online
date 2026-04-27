# Native AlloLib → Web Compatibility Plan

**Goal**: every native AlloLib C++ program imported via the Cross-Platform → Import Native dialog compiles and *behaves identically* in the browser, with one exception class: APIs that fundamentally require OS access (serial ports, raw sockets, native filesystem dialogs, multi-machine network sync) emit a **transpile-time error** with a clear message, not a silent stub.

**Definition of "100% compatibility"**:

| Class | Behavior |
|---|---|
| Pure C++ logic, math, value classes | Pass-through, byte-identical behavior. |
| Graphics / Audio / MIDI / OSC / File / Synth / Scene | Real implementation backed by web APIs (WebGL2/WebGPU, AudioWorklet, WebMIDI, WebSocket/HTTP, Origin-Private FS, etc). Behavior matches native within the limits of the underlying web platform (e.g., audio buffer size 128 vs configurable, no SharedArrayBuffer without COOP/COEP). |
| Serial, raw sockets, distributed/multi-machine, native FS dialogs, ImGui | Transpile-time error with `error:` prefix, message naming the unsupported API and pointing at the web alternative if any. |

This document supersedes the four `NATIVE_COMPAT_AUDIT_*.md` reports — those are the input spec; this plan converts them into milestones.

---

## Source of truth

- **Audit reports**: `NATIVE_COMPAT_AUDIT_app_audio.md`, `NATIVE_COMPAT_AUDIT_graphics.md`, `NATIVE_COMPAT_AUDIT_synth_ui.md`, `NATIVE_COMPAT_AUDIT_io_math_dist.md`.
- **Compat layer**: `allolib-wasm/include/`, `allolib-wasm/src/`.
- **Transpiler**: `frontend/src/services/transpiler.ts`.
- **Compile pipeline**: `backend/docker/compile.sh`, root `Dockerfile` (Railway), `allolib-wasm/CMakeLists.txt`.

---

## Milestones

Each milestone ships independently — green-light by importing 5–10 representative native examples that exercise the milestone's surface and confirming compile + render + audio + interaction match native behavior. Milestones are sized for ~1 push each, but several may take multiple sessions of implementation.

### M0 — Build environment fixes (link-time only)

Pulls upstream AlloLib `.cpp` files into the WASM link. Already-written code, just unlinked.

**Changes**:
- `allolib-wasm/CMakeLists.txt`:
  - Add `al/io/al_AudioIO.cpp` (compiles under `AL_AUDIO_DUMMY` already).
  - Add `al/sphere/al_AlloSphereSpeakerLayout.cpp`.
  - Add `al/app/al_*Domain.cpp` family: `al_AudioDomain.cpp`, `al_OSCDomain.cpp`, `al_OpenGLGraphicsDomain.cpp`, `al_SimulationDomain.cpp`, `al_StateDistributionDomain.cpp`, `al_GUIDomain.cpp`, `al_OmniRendererDomain.cpp`, `al_ConsoleDomain.cpp`, `al_ComputationDomain.cpp`.
  - Add `al/io/al_File.cpp` (provides `FilePath/FileList/SearchPaths` real impl).
  - Add `al/util/al_Curve.cpp`, `al/util/al_SingleRWRingBuffer.cpp`, `al/util/al_Functions.cpp`, `al/util/al_Serialize.cpp`.

**Risk**: some `.cpp` files pull in headers we override (e.g., al_Time.hpp). Override-include order must keep working. Test by compiling each `.cpp` standalone in the Docker container before linking.

**Validation**: existing examples still compile; previously link-failing exports (`AudioIO::numDevices`, `audioDomain()`, etc.) now resolve.

**LOC**: ~30 lines of CMake.

---

### M1 — Scene & Voice (DynamicScene, PositionedVoice, full SynthVoice)

The single highest-leverage milestone. Every spatial / polyphonic / synth tutorial uses these.

**Native API surface to mirror** (from `al/scene/al_DynamicScene.hpp`, `al/scene/al_PolySynth.hpp`):
- `al::PositionedVoice` extends `SynthVoice` with `Pose pose()`, `void pose(const Pose&)`, `Vec3f position()`, `setPosition(Vec3f)`, `setPositionStart()`, distance-attenuation hooks.
- `al::DynamicScene` extends `PolySynth` with `update(double dt)`, `render(AudioIOData&)` for spatial audio, `render(Graphics&)` for visual draw, voice lifetime + culling, async voice insertion via `triggerOn(int id)`/`triggerOff(int id)`, spatializer selection.
- `al::DistributedScene` extends `DynamicScene` with networked voice state — collapse to `DynamicScene` in WASM (single-process), no separate impl needed.

**Implementation strategy**:
- Pull upstream `al/scene/al_DynamicScene.cpp` into the WASM link if it compiles cleanly under our overrides. Likely needs minor touch-ups for `al_Time.hpp` and `al_AudioIO.hpp` overrides.
- DynamicScene's `render(AudioIOData&)` uses the spatializers already in `CMakeLists.txt` (Dbap/Vbap/Ambisonics/StereoPanner/Lbap/DownMixer). Plug them through.
- Voice rendering hooks into existing `WebApp::onSound` chain — extend `WebApp::onSound` to optionally delegate to a `DynamicScene` instance when the user's app uses one.
- Visual rendering of `PositionedVoice` follows existing `objectManager.setProperty()` path.

**Files**:
- `allolib-wasm/CMakeLists.txt` — add `al/scene/al_DynamicScene.cpp`, `al/scene/al_PolySynth.cpp` if not already.
- `allolib-wasm/include/al_playground_compat.hpp` — remove any conflicting partial stubs.
- `frontend/src/services/transpiler.ts` — pass-through `#include "al/scene/al_DynamicScene.hpp"` (no rewrite needed once upstream compiles).
- Base-class rewrites: `: public DistributedScene` → `: public DynamicScene` (collapse network, keep scene logic).

**Validation**: `examples/scene/*`, `examples/synth/*`, `examples/spatial/*` compile and produce identical voice triggering, panning, and 3D positioning vs native (within audio buffer-size tolerance).

**LOC**: ~50–100 in our compat layer; the bulk is upstream code now linked.

---

### M2 — Filesystem & Path (FilePath, FileList, SearchPaths, path helpers)

**Native API surface**:
- `al::FilePath` — `filepath()`, `file()`, `dir()`, `ext()`, ctor from string.
- `al::FileList` — iterable list of `FilePath`, populated via `searchPaths().listAll(pattern)`.
- `al::SearchPaths` — `addSearchPath(path, recurse)`, `addAppPaths()`, `find(filename)`, `glob(pattern)`.
- Free functions in `al::` namespace: `baseName(path)`, `extension(path)`, `directory(path)`, `checkExtension(path, ext)`.

**Implementation strategy**:
- Use Emscripten's MEMFS (in-memory virtual FS). Files uploaded via the existing UploadedFile path become entries in MEMFS.
- Real path parsing: `FilePath` is pure string ops, no platform calls. Pull upstream `al/io/al_File.cpp` directly — it works.
- Directory listing via `opendir/readdir` (Emscripten supports them on MEMFS).
- `addAppPaths()` becomes a known set of mounted asset paths (`/assets`, `/uploads`).

**Files**:
- `allolib-wasm/CMakeLists.txt` — add `al/io/al_File.cpp`.
- `allolib-wasm/include/al_WebFile.hpp` — keep `WebFile` for browser-specific file picker; *also* provide `FilePath`/`FileList`/`SearchPaths` via upstream.
- Wire the existing `UploadedFile` → MEMFS so user-uploaded files are reachable through `searchPaths().find()`.

**Validation**: native examples that load `.obj`, `.preset`, `.synthSequence`, `.png`, `.wav` from disk work after the user uploads the file.

**LOC**: ~80 in our compat (the bridge); upstream `al_File.cpp` ~400 lines linked.

---

### M3 — Audio runtime (real AudioIO, real append, real callbacks)

**Native API surface**:
- `al::AudioIO` with `append(AudioCallback&)`, `start()`, `stop()`, `processAudio()`, `time()`, `cpu()`, `framesPerBuffer()`, `framesPerSecond()`, `channelsBus`, `channelsOut`, `channelsIn`, `device()`.
- `al::AudioIOData` (already linked) for callback parameter.
- `app.audioIO()` returns a real `AudioIO&`, not a value-type proxy.

**Implementation strategy**:
- Replace the current `AudioIOView` value-type with a real `WebAudioIO` that owns the AudioWorklet connection and dispatches `process()` to registered callbacks.
- The Worklet (`allolib-audio-processor.js`) already calls `_allolib_process_audio`. Extend it so user-registered `AudioCallback`s run on the same buffer.
- Preserve the existing safety limiter chain.
- `audioIO().append(myCallback)` → adds to a vector; each block, dispatch in registration order.

**Files**:
- `allolib-wasm/include/al_WebAudioIO.hpp` (new) — replaces the inline `AudioIOView`.
- `allolib-wasm/src/al_WebApp.cpp` — wire up the worklet hook.
- `allolib-wasm/src/allolib-audio-processor.js` — call additional callbacks if registered.

**Validation**: native examples using `app.audioIO().append(myFx)` produce sample-accurate output through the chain.

**LOC**: ~150.

---

### M4 — Preset system (full type round-trip + morph)

**Native API surface** (from `al/ui/al_PresetHandler.hpp`):
- `storePreset` / `recallPreset` round-trip: `Parameter` (float), `ParameterInt`, `ParameterBool`, `ParameterString`, `ParameterMenu`, `ParameterChoice`, `ParameterVec3`, `ParameterVec4`, `ParameterColor`, `ParameterPose`, `Trigger`.
- `morphTo(presetName, morphTime)` interpolates linearly from current to target over `morphTime` seconds, sampling at audio rate.
- `availablePresets()`, `getCurrentPresetName()`, `setSubDirectory()`, `setMaxPresetIndex()`, callbacks `registerPresetCallback`/`registerStoreCallback`.
- `PresetSequencer` plays a `.presetSequence` file (timeline of preset transitions), `playSequence(name)`, `stopSequence()`, `setHandlerSubDirectory()`.
- `PresetMapper`, `PresetMIDI`, `PresetServer`, `ParameterServer`.

**Implementation strategy**:
- Replace JSON serializer in `al_playground_compat.hpp` `PresetHandler` with one that handles every parameter type, using `ParameterMeta::valueAsString()` / `setValueAsString()` for round-trip text — same as native. Storage stays in `localStorage` keyed by preset name; or upgrade to OPFS for larger sets.
- `morphTo` uses a worklet-driven timer: each audio block, advance interpolation `t` and call each parameter's `setNoCalls(lerp(start, end, t))`. Same as native.
- Pull upstream `al/ui/al_PresetSequencer.cpp` into the WASM link — its only platform dep is file I/O, which M2 handles.
- `PresetMapper`, `PresetMIDI` link from upstream once dependencies are linked.
- `PresetServer`, `ParameterServer` route over WebSocket using the existing OSC bridge (M5).

**Files**:
- `allolib-wasm/include/al_playground_compat.hpp` — replace `PresetHandler` body.
- `allolib-wasm/CMakeLists.txt` — add `al/ui/al_PresetSequencer.cpp`, `al_PresetMapper.cpp`, `al_PresetMIDI.cpp`.

**Validation**: save/load every parameter type; `recallPreset(name, 2.0f)` produces audible 2-second linear morph.

**LOC**: ~300 in compat header; ~600 upstream linked.

---

### M5 — OSC, ParameterServer, distributed-replacement

**Native API surface**:
- `osc::Send` with up to 8-arg variadic `send(addr, ...)`.
- `osc::Recv`, `osc::PacketHandler` virtual.
- `OSCMessage::operator>>` for stream extraction; full `OSCArg` type set (int32/int64/float/double/string/blob/char).
- `ParameterServer` exposing parameters over OSC.
- `WebApp::onMessage(osc::Message&)` virtual.

**Implementation strategy**:
- Pull upstream `al/protocol/al_OSC.cpp`. Its socket layer is the only platform-dependent part — replace transport with **WebSocket-to-relay** (already partially built as `WebOSC`) when in WASM via a `#ifdef AL_EMSCRIPTEN` switch in the `Sock` struct. Same `osc::Send`/`osc::Recv` API up the call stack.
- A small Node relay (in `backend/`) bridges WebSocket frames to UDP for cross-language OSC. Optional — apps that talk only browser-to-browser don't need it.
- Add `WebApp::onMessage` virtual + transpiler regex to handle multi-line bodies.

**Files**:
- `allolib-wasm/include/al_WebOSC.hpp` — extend to full native API.
- `allolib-wasm/src/al_WebOSC.cpp` (new) — implement transport.
- `backend/src/services/osc-bridge.ts` (new, optional) — WebSocket↔UDP relay.
- `allolib-wasm/include/al_WebApp.hpp` — add `onMessage` virtual.
- Transpiler: rewrite `: public osc::PacketHandler` → `: public al::osc::PacketHandler` (no rewrite needed if upstream is linked).

**Validation**: send/receive messages between two browser tabs through a relay; full 8-arg `send` works; `onMessage` body with multiple statements compiles.

**LOC**: ~400 (WebSocket transport + extra send overloads).

---

### M6 — Browser-impossible APIs: transpile-time errors

For these, the transpiler produces a **fatal error** with a precise message, listing the affected line and pointing at the web alternative if any.

| Native API | Why impossible | Transpile error message |
|---|---|---|
| `al::Arduino`, `al/io/al_Arduino.hpp` | No serial port access from browser sandbox. | `error: Arduino serial I/O is not available in browsers. Use Web Serial API directly via EM_ASM, or hardware-WebSocket bridge.` |
| `al::Socket`, `al/io/al_Socket.hpp` (TCP/UDP) | No raw sockets from browser. | `error: Raw sockets are not available in browsers. Use WebSocket (al_WebSocket.hpp) instead.` |
| `al::SerialIO` | Same as Arduino. | Same. |
| `al::CommandConnection`, `al::CommandClient`, `al::CommandServer` | TCP-based. | `error: CommandConnection requires raw TCP. For browser-to-browser RPC use al_WebOSC.hpp.` |
| `al::FileSelector` (ImGui) | ImGui not in WASM build. | `error: FileSelector uses ImGui which is unavailable. Use the Cross-Platform → Import Native dialog or app.uploadFile().` |
| `al::DistributedApp` networking layer | Requires raw multicast/UDP. | (collapsed to WebApp; only multi-machine sync features error.) |
| `al::AppRecorder` (writes native video file) | No direct disk writes. | `warning: AppRecorder writes to disk; web build records via WebM in-browser via app.startRecording().` (degrade to warning since the web alternative is in the toolbar.) |
| Geometry shaders (`ShaderProgram::compile(v,f,g)` with non-empty `g`) | WebGL2/WebGPU don't support. | `error: Geometry shaders are not supported on WebGL2 or WebGPU. Use a vertex/fragment pipeline or WebGPU compute.` |
| `glPolygonMode(GL_POINT/GL_LINE)` | Not in WebGL2 spec. | `warning: GL_POINT/GL_LINE polygon mode is unsupported in WebGL2; falling back to GL_FILL.` |

**Implementation**:
- Transpiler scans imported source for these patterns *before* applying replacements.
- Each detected pattern pushes onto `errors[]` (or `warnings[]`) in `TranspileResult`.
- `App.vue` `handleImportNative` already shows `transpileResult.errors` in the modal — when errors are present, **block** Apply.
- Error messages cite the source line number from the original native file.

**Files**:
- `frontend/src/services/transpiler.ts` — add `unsupportedPatterns` array with regex + error template + suggested-alternative text.
- Extend `TranspileResult` to include line-number-anchored errors.
- `frontend/src/components/TranspileModal.vue` — render errors with line numbers and disable Apply when any error is present.

**LOC**: ~150.

---

### M7 — Font (real text rendering)

**Native API surface**:
- `al::Font` with `load(path, size)`, `width(text)`, `ascender()`, `descender()`, `lineHeight()`, `render(Graphics&, text)` and `renderTexture(text, Texture&)`.

**Implementation strategy**:
- Two viable paths:
  1. **Bitmap atlas**: load a `.ttf` via `fetch`, parse with `stb_truetype` (linkable in WASM), generate atlas at requested size, draw via existing `Graphics` quad pipeline.
  2. **Canvas2D bridge**: render text to an `OffscreenCanvas` via JS, upload as texture. Easier, lower fidelity, still web-native.
- Path 1 matches native byte-for-byte. Picking path 1.

**Files**:
- `allolib-wasm/include/al_WebFont.hpp` — replace stub with full Font API.
- `allolib-wasm/src/al_WebFont.cpp` (new) — atlas generation via `stb_truetype.h`.
- `allolib-wasm/CMakeLists.txt` — add `stb_truetype` (single-header, no extra deps).
- Transpiler: rewrite `#include "al/graphics/al_Font.hpp"` → `#include "al_WebFont.hpp"`.

**LOC**: ~400.

---

### M8 — 3D meshes (glTF + animation)

**Native API**: `al::Asset3D`, `al::Scene` (Assimp-based mesh loading + animation playback).

**Implementation strategy**:
- Drop Assimp (5MB compiled, slow to link). Use `cgltf` (single header, ~3KB compiled) for glTF 2.0 import, which covers ~90% of modern asset workflows.
- FBX is intentionally skipped — niche, license-burdensome, and any FBX exporter can target glTF.
- Animation: implement skeletal animation playback over time, blending poses, per-bone transforms.

**Files**:
- `allolib-wasm/include/al_WebGLTF.hpp` (new) — replaces `WebOBJ` for richer assets.
- `allolib-wasm/src/al_WebGLTF.cpp` (new).
- `allolib-wasm/CMakeLists.txt` — add `cgltf`.
- Transpiler: rewrite `al/io/al_Asset3D.hpp` → `al_WebGLTF.hpp`.

**LOC**: ~600.

---

### M9 — WebGPU feature parity

**Currently missing** (per Graphics audit):
- `Graphics::quadViewport` (WebGPU path).
- `Graphics::omni` (omni shaders not initialized on WebGPU).
- 3D textures (`Texture::create3D`/`resize(w,h,d)`).
- `Texture::copyFrameBuffer` (WebGPU).
- Mipmap generation via WebGPU compute.

**Implementation strategy**:
- WGSL compute shader for mipmap generation (downsample 2x2 box filter per level).
- 3D texture support via `wgpu::TextureDimension::e3D` + appropriate bind group layouts.
- `quadViewport` is a simple full-screen-triangle pass — port the WebGL2 version to WGSL.
- `omni` shaders need cubemap-sampling pipeline.
- `copyFrameBuffer` via `commandEncoder.copyTextureToTexture`.

**Files**:
- `allolib-wasm/src/al_WebGPUBackend.cpp`.
- `allolib-wasm/shaders/wgsl/mipmap_generator.wgsl` (new).
- `allolib-wasm/shaders/wgsl/quad_viewport.wgsl` (new).

**LOC**: ~600.

---

## Cross-cutting

### Transpiler include path rewrites (apply across all milestones)

Add to `nativeToWebPatterns`:

```
al/io/al_CSVReader.hpp           → al_playground_compat.hpp  (already handled?)
al/io/al_FileSelector.hpp        → ERROR (M6)
al/io/al_AppRecorder.hpp         → al_playground_compat.hpp  (degraded, warning)
al/io/al_Arduino.hpp             → ERROR (M6)
al/io/al_Socket.hpp              → ERROR (M6)
al/protocol/al_CommandConnection.hpp → ERROR (M6)
al/scene/al_DynamicScene.hpp     → pass-through (M1)
al/scene/al_DistributedScene.hpp → al/scene/al_DynamicScene.hpp (collapse)
al/app/al_AudioDomain.hpp        → pass-through (M0)
al/app/al_OSCDomain.hpp          → pass-through (M5)
al/app/al_OpenGLGraphicsDomain.hpp → pass-through
al/app/al_GUIDomain.hpp          → pass-through
al/app/al_StateDistributionDomain.hpp → pass-through (single-process collapse)
al/app/al_NodeConfiguration.hpp  → pass-through (single-process collapse)
al/sphere/al_AlloSphereSpeakerLayout.hpp → pass-through
al/sphere/al_OmniRendererDomain.hpp → pass-through
al/sphere/al_PerProjectionRender.hpp → pass-through
al/ui/al_PresetMapper.hpp        → pass-through (M4)
al/ui/al_PresetMIDI.hpp          → pass-through (M4)
al/ui/al_PresetServer.hpp        → pass-through (M5)
al/ui/al_ParameterServer.hpp     → pass-through (M5)
al/ui/al_BundleGUIManager.hpp    → al_playground_compat.hpp (already)
al/ui/al_Composition.hpp         → al_playground_compat.hpp (already)
al/ui/al_SequenceRecorder.hpp    → al_playground_compat.hpp (already)
al/ui/al_SequenceServer.hpp      → pass-through (M5)
al/ui/al_SequencerMIDI.hpp       → pass-through (M5)
al/graphics/al_Font.hpp          → al_WebFont.hpp (M7)
al_ext/assets3d/al_Asset.hpp     → al_WebGLTF.hpp (M8)
```

### Base-class rewrites

```
: public DistributedScene → : public DynamicScene  (M1)
: public OmniApp           → : public WebApp        (M0)
: public osc::PacketHandler → pass-through (M5)
```

### Web→native round-trip (`webToNativePatterns`)

Currently omits `ParameterMIDI` and `DynamicScene`. Add reverse mappings so export → re-import is byte-identical.

---

## Validation strategy

For each milestone, "done" means:

1. **Compiles**: 5–10 representative native examples from `C:\Users\lpfre\allolib_playground\allolib\examples\<area>` import + compile cleanly.
2. **Runs**: at least 3 of those examples produce identical (or web-platform-equivalent) output vs native — visual frame, audio waveform, MIDI behavior.
3. **Edge cases**: each milestone names ≥2 weird patterns that previously broke and now don't.
4. **No regressions**: the existing 155 web-native examples in `frontend/src/data/examples.ts` still pass on both WebGL2 and WebGPU.

The verification harness is the existing **Cross-Platform → Import Native** dialog. No separate test script — uploading a `.cpp` exercises the entire path. If a milestone needs broader coverage, write a Playwright spec that drives the dialog for a list of files.

---

## Sequencing & estimates

| Milestone | LOC (ours) | LOC (upstream linked) | Effort |
|---|---|---|---|
| M0 — CMake fixes | 30 | — | <1 day |
| M1 — Scene/Voice | ~100 | ~600 | 1–2 days |
| M2 — Filesystem | ~80 | ~400 | 1 day |
| M3 — AudioIO | ~150 | — | 1 day |
| M4 — Preset system | ~300 | ~600 | 2 days |
| M5 — OSC + ParameterServer | ~400 | ~500 | 2 days |
| M6 — Compile errors | ~150 | — | <1 day |
| M7 — Font | ~400 | (stb_truetype) | 2 days |
| M8 — glTF | ~600 | (cgltf) | 2 days |
| M9 — WebGPU parity | ~600 | — | 3 days |
| **Totals** | **~2.8k** | **~2.1k** | **~14–17 days** |

Each milestone bumps the patch version (`v0.3.7`, `v0.3.8`, …) and is committed independently. Railway rebuild after each header change (~25–40 min); transpiler-only changes deploy via GitHub Pages in ~2 min.

---

## Out of scope

- **OmniStereo / multi-channel sphere rendering**: requires multiple synchronized GPUs. Not deliverable in a single browser tab.
- **Distributed multi-machine sync**: M6 errors out the parts that can't work; the single-process collapse in M1 covers everything else.
- **ImGui-based UIs**: replaced by the Vue parameter panel; not making them work natively.
- **Native file dialogs beyond Import Native**: replaced by the Cross-Platform menu.

---

## Open questions before M1

1. Confirm the "transpile-time error" UX in `TranspileModal.vue` — should errored imports show alongside warnings, or fully block until the user removes them?
2. For OSC relay (M5): host the relay on Railway alongside the compile API, or ship as opt-in self-host? Railway uses one process per service; bundling adds dependency surface.
3. For glTF (M8): include a default test asset so `Asset3D::load("default.glb")` works out of the box?
