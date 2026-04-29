# MAT200B Buildable A/V Examples — Implementation Plan (AlloLib Studio Online)

Source list: `Downloads/buildable_examples.md` — 29 entries across 4 sections + 11 mixing/staging entries added by the user (40 total) + 5–7 cross-cutting helpers.
Target codebase: this repo (AlloLib Studio Online — browser IDE that compiles user C++ via Emscripten and runs it in WebGL2/WebGPU + Web Audio worklet).
Goal: every entry shipped as a real C++ example registered in `frontend/src/data/*.ts`, with **accurate audio AND visual** parts and the legibility-twist intact, running entirely in-browser with no native deps.

This plan replaces the playground-targeted version (which lived briefly at this path while the rewrite was in flight). The structure mirrors the playground plan: Section 0 covers Studio-Online-specific integration, Sections 1–4 hold per-entry mini-plans for all 40 entries, Section 5 phases the work, Section 6 lists open questions.

Adaptations from the native-AlloLib version, summarized:
- Examples register as `Example` objects in `frontend/src/data/playgroundExamples.ts` / `studioExamples.ts` (or the proposed `mat200bExamples.ts`) — no CMake, no `tutorials/<cat>/` files.
- Audio block size is fixed at **128 frames** (Web Audio worklet quantum); sample rate from `audioContext.sampleRate` (44.1 or 48 kHz).
- `al::WebApp` is the actual base; the transpiler rewrites user-written `App` to `WebApp` automatically.
- ImGui is stubbed; UI lives in the Vue Params panel via `WebControlGUI` registry.
- `al_ext/spatialaudio/al_Convolver.hpp`, `Gamma/HRFilter.h`, and `cookbook/pickable/` are **not linked** today — Phase 0 work either ports them or substitutes helpers.
- No FFmpeg / pthread / native sockets; *Real-time concatenative AV* gets an HTML5 `<video>` plus `EM_ASM` plan instead.
- Cross-cutting helpers live under a new `allolib-wasm/include/_studio_shared/` convention (header-only where possible).

---

## 0. Studio Online integration

This section replaces "Build system & template" from the playground-targeted plan. The Studio Online target has no `run.sh`, no per-folder `flags.cmake`, and no `tutorials/` tree. Examples are TypeScript objects compiled into the Vue SPA bundle, fed through a JS transpiler, then dropped on the backend Docker `compile.sh`.

### 0.1 How examples register

There is no file-system-based registration. Every example is a TypeScript object pushed to one of three arrays:

- `frontend/src/data/playgroundExamples.ts` → `playgroundExamples: Example[]`
- `frontend/src/data/studioExamples.ts` → `studioExamples: Example[]`
- `frontend/src/data/studioExamples.ts` → `studioMultiFileExamples: MultiFileExample[]` (for entries that need a `.cpp` plus auxiliary files such as `.glsl` or extra headers)

`Example` is defined in `frontend/src/data/examples.ts`:

```ts
export interface Example {
  id: string            // unique slug, used in URLs and localStorage
  title: string         // display label in the dropdown
  description: string   // one-liner shown in tooltips
  category: string      // must match an ExampleCategory.id from categoryGroups
  subcategory?: string  // must match an entry in that category's subcategories[]
  code: string          // the C++ source as a JS template literal
}

export interface MultiFileExample {
  id: string; title: string; description: string
  category: string; subcategory?: string
  files: ExampleFile[]   // { path: string, content: string }
  mainFile: string       // which path opens in Monaco
}
```

Adding a MAT200B example is "push one object to the right array, rebuild the frontend". No CMake edits, no per-file dependency manifests.

`categoryGroups` in `examples.ts` defines the dropdown taxonomy. Today there are four top-level groups:

| Group `id` | Group title | Categories (id → title)                                                                                                                                                                                                          |
|------------|-------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `allolib`  | AlloLib     | `basics`, `graphics`, `audio`, `interaction`, `scene`, `simulation`, `advanced`, `feature-tests`                                                                                                                                 |
| `playground` | AlloLib Playground | `playground-synthesis` (subs: envelopes, oscillators, modulation, filters), `playground-audiovisual` (subs: basic-av, advanced-av)                                                                                       |
| `studio`   | AlloLib Studio | `studio-environments`, `studio-textures`, `studio-meshes`, `studio-templates`, `studio-timeline`, `studio-showcase`                                                                                                          |
| `gpu`      | Allolib Studio (GPU) | `gpu-graphics` only                                                                                                                                                                                                        |

Recommendation: add a new top-level group `mat200b` rather than scattering 29 entries across `playground-synthesis`, `playground-audiovisual`, and `advanced/audiovisual`. The 29 entries form a coherent course unit; squeezing them into existing `playground-*` subcategories ("envelopes / oscillators / modulation / filters") misrepresents most entries (mixing, signal processing, visual music). Suggested layout:

```ts
{ id: 'mat200b', title: 'MAT200B', categories: [
  { id: 'mat-mixing',     title: 'Mixing & Monitoring',
    subcategories: [{id:'stems',title:'Stems'},{id:'mastering',title:'Mastering'},{id:'spatial',title:'Spatial'}] },
  { id: 'mat-synthesis',  title: 'Synthesis',
    subcategories: [{id:'wavetable',title:'Wavetable'},{id:'additive',title:'Additive'},
                    {id:'subtractive',title:'Subtractive'},{id:'modulation',title:'Modulation'},
                    {id:'physical',title:'Physical Models'},{id:'granular',title:'Granular'},
                    {id:'concat',title:'Concatenative'}] },
  { id: 'mat-signal',     title: 'Signal Processing',
    subcategories: [{id:'dynamics',title:'Dynamics'},{id:'spectral',title:'Spectral'},
                    {id:'delay',title:'Delay/Comb/Allpass'},{id:'convolution',title:'Convolution'},
                    {id:'spatial',title:'Spatialization'}] },
  { id: 'mat-visualmusic',title: 'Visual Music',
    subcategories: [{id:'mappers',title:'Mappers'},{id:'image-as-sound',title:'Image-as-Sound'},
                    {id:'scores',title:'Generative Scores'}] },
]}
```

The flat `categories` export at the bottom of `examples.ts` (line 187) auto-spreads the new group's categories — no extra wiring there.

### 0.2 The web template skeleton

Distilled from `pg-sine-env`, `pg-add-syn`, `studio-env-basic`. Studio Online house style differs from the native playground in several load-bearing ways:

- One canonical include — `al_playground_compat.hpp` — which transitively pulls `al_WebApp`, the `ControlGUI = WebControlGUI` alias, `PresetHandler` (full localStorage + IDBFS round-trip), `SynthGUIManager`, MIDI, and the no-op `ParameterGUI` shim. Don't include `al/app/al_App.hpp` directly; the transpiler rewrites it but it's a code smell in a hand-authored example.
- `using namespace al;` then `class MyApp : public App { ... };` — works because the transpiler rewrites `App` → `WebApp` before compile. Authors can write either; `App` is shorter and matches the playground source most students will be reading alongside.
- `gam::sampleRate(audioIO().framesPerSecond())` is **not optional** for any example using Gamma DSP. Studio Online runs Web Audio at whatever rate the browser provides (44.1 kHz on macOS Safari, 48 kHz on most Chrome/Firefox installs). Skipping this call detunes oscillators by ~9% on the wrong-rate machines.
- AudioWorklet block size is fixed at **128 frames** per quantum. The transpiler clamps any user `configureAudio(rate, N, …)` to `min(N, 256)` and the engine internally renders a 128-frame multiple of that buffer. Practical advice: write `configureAudio(48000, 128, 2, 0)` and treat the block size as advisory — DSP code must not assume a specific block size.
- ImGui is stubbed in the WASM build (every `ParameterGUI::draw*` is a no-op). Parameter UI is rendered in Vue from the `WebControlGUI` registry. `gui << param` Just Works; `imguiBeginFrame/End/Draw` are no-ops kept for compile-compat.
- `g.draw(mesh)` is auto-rewritten to `drawLOD(g, mesh)` — examples don't have to opt into LOD, just call `autoLOD().enable()` in `onCreate()` if desired.
- The macro `ALLOLIB_WEB_MAIN(MyApp)` replaces native `int main() { MyApp app; app.start(); return 0; }`. The transpiler injects it automatically when missing, but new examples should write it explicitly so the source is self-documenting.

Skeleton for every new MAT200B entry (drop into the `code:` template-literal field):

```cpp
/**
 * MAT200B / 2026 — <Project> — <one-line>
 * Audio:  <DSP graph>
 * Visual: <draw plan>
 * Twist:  <legibility hook from buildable_examples.md>
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Analysis.h"
#include "Gamma/Effects.h"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"
// #include "_studio_shared/audio_features.hpp"  // Phase 1

using namespace al;

class MyVoice : public SynthVoice {
public:
  gam::Sine<>      mOsc;
  gam::Env<3>      mAmpEnv;
  gam::Pan<>       mPan;
  gam::EnvFollow<> mEnvFollow;
  Mesh             mMesh;

  void init() override {
    mAmpEnv.curve(0); mAmpEnv.levels(0,1,1,0); mAmpEnv.sustainPoint(2);
    addDisc(mMesh, 1.0, 30);
    createInternalTriggerParameter("amplitude",  0.3, 0.0, 1.0);
    createInternalTriggerParameter("frequency",  220, 20, 5000);
    createInternalTriggerParameter("attackTime", 0.1, 0.01, 3.0);
    createInternalTriggerParameter("releaseTime",1.0, 0.1, 10.0);
    createInternalTriggerParameter("pan",        0.0, -1.0, 1.0);
  }
  void onProcess(AudioIOData& io) override {
    mOsc.freq(getInternalParameterValue("frequency"));
    mAmpEnv.lengths()[0] = getInternalParameterValue("attackTime");
    mAmpEnv.lengths()[2] = getInternalParameterValue("releaseTime");
    mPan.pos(getInternalParameterValue("pan"));
    const float amp = getInternalParameterValue("amplitude");
    while (io()) {
      float s1 = mOsc() * mAmpEnv() * amp, s2;
      mEnvFollow(s1); mPan(s1, s1, s2);
      io.out(0) += s1; io.out(1) += s2;
    }
    if (mAmpEnv.done() && mEnvFollow.value() < 0.001f) free();
  }
  void onProcess(Graphics& g) override {
    const float f = getInternalParameterValue("frequency");
    const float a = getInternalParameterValue("amplitude");
    g.pushMatrix();
    g.translate(f/200 - 3, a, -8); g.scale(1-a, a, 1);
    g.color(mEnvFollow.value(), f/1000, mEnvFollow.value()*10, 0.4);
    g.draw(mMesh);
    g.popMatrix();
  }
  void onTriggerOn()  override { mAmpEnv.reset(); }
  void onTriggerOff() override { mAmpEnv.release(); }
};

class MyApp : public App {
public:
  SynthGUIManager<MyVoice> synthManager{"MyVoice"};
  void onCreate() override {
    gam::sampleRate(audioIO().framesPerSecond());
  }
  void onSound(AudioIOData& io) override { synthManager.render(io); }
  void onAnimate(double dt)     override { (void)dt; }
  void onDraw(Graphics& g)      override { g.clear(); synthManager.render(g); }
  bool onKeyDown(const Keyboard& k) override {
    int m = asciiToMIDI(k.key());
    if (m > 0) {
      synthManager.voice()->setInternalParameterValue(
        "frequency", ::pow(2.f, (m-69.f)/12.f) * 432.f);
      synthManager.triggerOn(m);
    }
    return true;
  }
  bool onKeyUp(const Keyboard& k) override {
    int m = asciiToMIDI(k.key()); if (m > 0) synthManager.triggerOff(m); return true;
  }
};

int main() { MyApp app; app.configureAudio(48000, 128, 2, 0); app.start(); return 0; }
```

Non-polyphonic shape (compressor, oscilloscope, IR builder): `class MyApp : public App` with raw `onSound`/`onAnimate`/`onDraw`, `SingleRWRingBuffer` to hand audio samples to the graphics thread (matches `cookbook/av/audioToGraphics.cpp` from native playground; the type is available in WASM via `al_compat.hpp`).

### 0.3 Transpiler capabilities and limits

`frontend/src/services/transpiler.ts` is run on the source string before it reaches the backend Docker compiler.

**Auto-rewrites** (so examples may use the native form and still build):

- Includes: `al/app/al_App.hpp`, `al/app/al_AudioApp.hpp`, `al/app/al_GUIDomain.hpp` → `al_WebApp.hpp` or commented out.
- Includes: `al/ui/al_ControlGUI.hpp`, `al_ParameterGUI.hpp`, `al_PresetHandler.hpp`, `al_PresetSequencer.hpp`, `al_ParameterMIDI.hpp`, `al_PresetMapper.hpp`, `al_PresetMIDI.hpp` → `al_playground_compat.hpp`.
- Includes: `al/scene/al_DistributedScene.hpp` → `al/scene/al_DynamicScene.hpp`; `al/scene/al_PolySynth.hpp`, `al_SynthSequencer.hpp`, `al_SynthRecorder.hpp` → `al_playground_compat.hpp`.
- Includes: `al/io/al_MIDI.hpp` → `al_WebMIDI.hpp`; `al/sound/al_SoundFile.hpp` → `al_WebSamplePlayer.hpp`.
- Includes: `al_ext/assets3d/al_Asset.hpp` → `al_WebOBJ.hpp`.
- Base classes: `(al::)?App`, `(al::)?AudioApp`, `(al::)?DistributedApp(WithState<...>)?` → `(al::)?WebApp`; `(al::)?DistributedScene` → `DynamicScene`.
- `int main() { Foo app; app.start(); return 0; }` (and 3 variants) → `ALLOLIB_WEB_MAIN(Foo)`. If no main is matched but a class derives from WebApp, the macro is appended automatically.
- `configureAudio(rate, block, out [, in])` → `configureWebAudio(rate, min(block, 256), out, in)`.
- `SoundFile` → `WebSamplePlayer`; `MIDIIn`/`MIDIOut` → `WebMIDI`.
- `g.draw(mesh)` and `graphics.draw(mesh)` → `drawLOD(g, mesh)` / `drawLOD(graphics, mesh)`, except when the expression contains `VAO`/`vao`. Function-call forms (`g.draw(getMesh())`) are also rewritten.

**NOT auto-rewritten** — example authors must avoid these directly:

- `osc::Send` / `osc::Recv` / `osc::Message` are passed through. They have a real impl backed by Emscripten WebSocket transport (`al_OSC_Web.cpp`), but they require an OSC-WebSocket bridge server outside the browser. Don't rely on these for interactive examples — use `al_WebMIDI.hpp` for control and `WebControlGUI` for parameter binding.
- `imgui*` calls: the stubs are no-ops, so code compiles, but no UI appears. Examples should not advertise an ImGui panel that won't render. Use `gui << param` instead.
- `al::Image` / `al/graphics/al_Image.hpp` — the WASM build provides `al_WebImage.hpp` (fetch- and IDBFS-backed) but the include rewrite is **not** wired. Hand-write `#include "al_WebImage.hpp"` if needed.
- `Gamma/SoundFile.h`, `Gamma/AudioIO.h`, `Gamma/Recorder.h` are excluded from the WASM Gamma library (see `allolib-wasm/CMakeLists.txt:86`). Use `al_WebSamplePlayer.hpp` (linked) instead.

**`unsupportedPatterns`** array (`transpiler.ts:41-96`) — line-anchored compile errors that block the Apply button:

| Pattern | Severity | Why |
|---------|----------|-----|
| `al/io/al_Arduino.hpp`, `al_SerialIO.hpp` | error | No serial I/O in browsers |
| `al/io/al_Socket.hpp` | error | No raw TCP/UDP |
| `al/io/al_FileSelector.hpp` | error | ImGui-dependent |
| `al/protocol/al_CommandConnection.hpp` | error | Raw TCP |
| `: public Arduino`, `: public Command(Client/Server/Connection)` | error | Same |
| `ShaderProgram.compile(vert, frag, geom)` | error | No geometry shaders on WebGL2/WebGPU |
| `al/io/al_AppRecorder.hpp` | warning | Use Studio toolbar Record |
| `glPolygonMode(...)` | warning | No-op on WebGL2 |

MAT200B entries that would have hit these on the native side (none of the buildable_examples list does directly) need workarounds inside the example body, not at the include level.

### 0.4 Asset pipeline

Studio Online has a simple convention rather than a hardened pipeline.

- **Where assets live.** `frontend/public/assets/` is served at `/assets/...` by Vite. Existing top-level subdirs: `environments/` (HDRI maps consumed by `al_WebHDR.hpp`), `meshes/`, `textures/`. The `studio-env-*` examples fetch via URLs like `/assets/environments/studio_small_03_4k.hdr` and load them through `WebHDR::load()`, which calls `fetch()` underneath.
- **How loading works.** `al_WebSamplePlayer.hpp` (the `SoundFile` replacement) reads via `fopen` against the IDBFS-mounted `/assets` virtual directory or via async `fetch` for an HTTP URL. For audio specifically, prefer the URL form because IDBFS hydration is racy with Audio start. Mastering A/B's "load this WAV" flow uses `al_WebFile.hpp::fetchToMemfs(url, path)` → `WebSamplePlayer::load(path)`.
- **Proposed MAT200B asset bundle.** New folder `frontend/public/assets/mat200b/` with subfolders keyed by example id:
  - `mat200b/mastering/{master_v1.wav,master_v2.wav}` — short license-clean stems (Free Music Archive CC0 picks).
  - `mat200b/convolution/{ir_room.wav,ir_plate.wav}` — IRs from OpenAir or self-recorded.
  - `mat200b/concat/forest_5min.{webm,opus}` — for Real-time concatenative AV; pre-decoded MFCC sidecar JSON to avoid live FFmpeg.
  - `mat200b/hrtf/...` — KEMAR HRIR set if Spatializer needs it (verify Gamma's HRFilter ships the MIT/CIPIC tables; if not, ship a downsampled pack).
- **Bundle hygiene.** Keep the bundle under ~50 MB per category to avoid blowing up the Vite cold-cache. Files larger than ~5 MB should be opus/webm, not WAV. A `frontend/public/assets/mat200b/CREDITS.md` (mirroring the existing `assets/CREDITS.md`) documents licenses per file.
- **`/assets/environments/*.hdr` is the pattern to mirror.** The HDR loader resolves a relative URL via `fetch`, falls back to IDBFS, and handles 3-component float decode in JS. Mastering A/B and Convolution should follow the same code shape: relative URL string in source, fetch handled by `al_WebSamplePlayer` / `al_WebFile`.

### 0.5 Cross-cutting helpers (web-targeted)

There is no existing `_shared/` folder convention in `allolib-wasm/include/`. Compat shims live at the include root (`al_playground_compat.hpp`, `al_WebMIDI.hpp`, etc). For MAT200B helpers, propose a new subdirectory `allolib-wasm/include/_studio_shared/` — leading underscore sorts it above the alphabetical `al_*` headers and signals "not a public web compat shim". Files in this folder are header-only where possible so they don't have to be relinked into `libal_web.a` on every iteration; the backend `compile.sh` already adds `/app/allolib-wasm/include/` to `-I`, so `#include "_studio_shared/audio_features.hpp"` Just Works.

| Helper | File | API summary | Web notes | Used by |
|---|---|---|---|---|
| **Audio feature extractor** | `_studio_shared/audio_features.hpp` (+`.cpp` for MFCC/pitch) | `class AudioFeatureExtractor { processBlock(const float*, int); bool latest(FeatureFrame&); … }` — RMS, peak, ZCR, centroid, flatness, rolloff85, pitchHz, MFCC×13, magBands×32. ~250 LOC header + ~150 LOC impl. | Header-only path keeps it in the user `.cpp`. MFCC `.cpp` would have to live in `libal_web.a` — instead inline-define under `#ifdef AUDIO_FEATURES_IMPL` and let one example per source file define it. | ~12 examples (synesthetic mapper, Wehinger, multiscale stems, concatenative ×2, phase vocoder, compressor RMS, granular, Mastering A/B, vocal LPC, additive sculptor, real-time A/V) |
| **Parameter graph** | `_studio_shared/param_graph.hpp` | `class ParamGraph { addParameter; addSource; connect; tick; saveJSON/loadJSON; }`. ~400 LOC. | **Critical web caveat:** the native plan called for an ImGui node-editor view. ImGui is stubbed in WASM. Drop the in-WASM editor; instead expose graph topology via `WebControlGUI::registerParameterMeta` on each source/sink, and render the patch graph in Vue (a future panel). Phase 1 ships the C++ side only; Vue editor is Phase 3+. | ~8 examples (synesthetic mapper, graphic score, painter, granular mask routing, drawn-sound, convolution, AM/RM, FM index) |
| **Automation lanes** | `_studio_shared/automation.hpp` (+ `.cpp` if needed) | `class AutomationLane { startRecording; startPlayback; tick; saveCSV/loadCSV; }`. ~300 LOC. | Wraps `al::SequenceRecorder` (already linked in `libal_web.a` via `al_SynthSequencer.cpp`). `saveCSV` / `loadCSV` use IDBFS via `al_WebFile`. Automation curves rendered as `Mesh` LINE_STRIPs — no ImGui needed. | every "demo→composition" twist (Mastering A/B, virtual diffusion, phase vocoder, HRTF path recorder, AM/RM sweep, comb LFO, graphic score, Risset rate, granulation) |
| **Post-FX shaders** | `_studio_shared/post_fx.hpp` + inline GLSL strings | `class PostFXChain { init(w,h); push(FX, strength); beginCapture; endCaptureAndRender; }`. Phosphor decay, bloom, chromatic aberration, glitch, vignette. ~250 LOC C++ + ~300 LOC GLSL. | **GLSL must be ES 3.0 dialect with explicit precision qualifiers** (`precision highp float;`). Native AlloLib shaders compile on WebGL2 only after this transform. EasyFBO is replaced by `al_EasyFBO_Web.cpp` in the WASM build, so the API is the same. Inline shader strings (no `searchPaths`) — the file system path that native examples use is fragile in MEMFS. | Lissajous (required), Synchromy, additive geometry, K-S string, waveguide, real-time A/V cuts, Risset bars |
| **Drawable canvas** | `_studio_shared/draw_canvas.hpp` | `class DrawCanvas { onMouseDown/Drag/Up; clear; draw; strokes(); sampleAt; sampleColumn; }`. ~250 LOC. | Pure `Mesh` + `Graphics` + `App::onMouse*` callbacks; no ImGui dep. Mouse event coords arrive in screen pixels (`Mouse::x()`, `Mouse::y()`); canvas must take an explicit framebuffer rectangle to map into world coords — `WebApp::fbWidth/fbHeight` accounts for HiDPI. | painter, drawable wavetable, waveshaper, z-plane, drawn-sound (UPIC), spectrogram painter, Synchromy, graphic score, virtual diffusion, IR builder |
| **PVResynth** | `_studio_shared/pv_resynth.hpp` | STFT round-trip with editable bin buffer + phase-advance bookkeeping. ~150 LOC. | Builds on `gam::STFT` (linked). Hop and FFT size baked-in; users vary parameters but not block size (worklet quantum is fixed). | Phase vocoder lab, Spectrogram painter |
| **PixelAudioBridge** | `_studio_shared/pixel_audio_bridge.hpp` | `shared_ptr<vector<uint8_t>>` + `atomic<int>` row index for audio-rate pixel reads. ~80 LOC. | One subtle web concern: the AudioWorklet thread and main thread share the same WASM linear memory under SharedArrayBuffer-disabled builds. Audio reads of pixel buffers are serialized by `atomic<int>` index and must not allocate. | Synchromy, Lissajous draw mode |

**Helpers that depend on web-blocked deps:**

- **`al::Convolver`** (`al_ext/spatialaudio/al_Convolver.hpp`) — **NOT linked** into `libal_web.a` (verified: `Convolver|HRFilter|pickable` regex over `allolib-wasm/CMakeLists.txt` returns no matches). Phase 0 must add zita-convolver sources to the CMake target or hand-roll a partitioned-FFT convolver in `_studio_shared/web_convolver.hpp`. Without this, *Convolution playground* and *IR-builder reverb* are blocked.
- **`Gamma/HRFilter.h`** — **NOT linked** (same regex). Gamma sources in `allolib-wasm/CMakeLists.txt:86` enumerate explicitly and `HRFilter` is absent. Phase 0 must add it (it's header-only-ish; check whether it pulls in `Gamma::Recorder` or `SoundFile`, both excluded). Without this, *Spatializer with HRTF* loses its core.
- **`cookbook/pickable/`** — Studio Online's WASM build does not include the cookbook tree. The `Pickable` class needs a port: `_studio_shared/pickable.hpp` mirroring the native API but using `WebApp::onMouse*` event callbacks. Affects *Subtractive z-plane*, *Granular cloud* (tendency mask), *Vocal tract*, *Spatializer*, *IR-builder*, *Generative graphic score*, *Additive partial sculptor*. Mid-effort port (~250 LOC).
- **FFmpeg** — used in native plan for *Real-time concatenative AV* video decode. Browser-side, video decode is the `<video>` element + `requestVideoFrameCallback` + `EM_ASM` to push frame indices into WASM. No FFmpeg in `libal_web.a` and never will be. Plan: HTML `<video>` overlay with corpus offset table; the WASM side only sees frame indices.
- **pthread** — `libal_web.a` is single-threaded (no `-pthread`, no `SharedArrayBuffer`). All audio runs on the AudioWorklet thread; everything else is on the main thread. Helpers must not assume `std::thread`.

### 0.6 What's already wired vs. what's missing

`libal_web.a` audit (`allolib-wasm/CMakeLists.txt:121-247`):

**Linked and available** for MAT200B examples:

- Core: AudioIO (dummy backend bridged to AudioWorklet), AudioIOData, File, Window, ControlNav.
- App domains: ComputationDomain, AudioDomain, SimulationDomain, OpenGLGraphicsDomain. (No `OSCDomain`/`GUIDomain`.)
- Graphics: BufferObject, EasyVAO, GPUObject, Isosurface, Lens, Light, Mesh, RenderManager, Shader, Shapes, VAO, VAOMesh, Viewpoint, stb_image. WebGL2-replaced versions of Graphics, FBO, EasyFBO, Texture, OpenGL.
- Scene: DynamicScene, PolySynth, PositionedVoice, SynthSequencer, SynthVoice.
- Sound: Ambisonics, Biquad, Dbap, DownMixer, Lbap, Spatializer (the upstream class — not Gamma's HRTF), Speaker, SpeakerAdjustment, StereoPanner, Vbap. Plus AlloSphere speaker layout geometry.
- Spatial: HashSpace, Pose. System: PeriodicThread (no-op in single-thread WASM), Printing, Time. Types: Color, VariantValue.
- UI: Parameter, ParameterBundle, ParameterServer, DiscreteParameterValues. Plus oscpack OSC binary serialization.
- Web-only: WebApp, WebControlGUI, WebMIDI, WebSamplePlayer, WebFile, WebOBJ, WebHDR, WebEnvironment, WebPBR, WebProcedural, WebMipmapTexture, WebLOD, WebQuality, WebAutoLOD.
- Gamma: Conversion, DFT, Domain, FFT_fftpack, Print, Scheduler, Timer, arr, fftpack, scl. **Not** linked: AudioIO, Recorder, SoundFile (PortAudio/libsndfile deps).

**Missing — must be added in Phase 0:**

- `al::Convolver` (`al_ext/spatialaudio/al_Convolver.hpp` and the zita-convolver sources). Confirmed missing.
- `Gamma::HRFilter` (`Gamma/HRFilter.h` plus HRIR data). Confirmed missing.
- `cookbook/pickable/` — port to `_studio_shared/pickable.hpp`.
- AudioRecorder / WAV writer for examples that need to dump output. The `al_WebApp` exposes `Module.startRecording()` which captures WebM via MediaRecorder — usable but not WAV.

---

## 1. Section 1 — Mixing and Monitoring

> Sections 1+2 are recast from the native `tutorials/audiovisual/*.cpp` plan to live as **registry entries** in `frontend/src/data/playgroundExamples.ts`. The compile target is the WASM toolchain in `backend/docker/compile.sh`; the include canonical is `allolib-wasm/include/al_playground_compat.hpp`. `App` → `WebApp`, `ControlGUI` → `WebControlGUI` are handled either by `frontend/src/services/transpiler.ts` (when authors paste native code) or by the `al_playground_compat.hpp` aliasing (when authors author web-native).
>
> **Universal web caveats** that apply to every entry below (don't repeat in each section):
> - **Audio block size.** The transpiler clamps to ≤256 (`transpiler.ts:282`), but the Web Audio worklet is fixed at **128 samples**. The compat layer accepts any block ≤256 and runs the inner loop in 128-frame chunks. Author with `configureWebAudio(<sr>, 128, 2, 0|2)` to match worklet granularity exactly.
> - **Sample rate** comes from `audioContext.sampleRate` (44 100 or 48 000 Hz depending on OS); never hard-code. `gam::sampleRate(audioIO().framesPerSecond());` in `onCreate` covers it.
> - **No al_ext libs linked.** `backend/docker/compile.sh` does not pass `-I"$AL_EXT_DIR/spatialaudio"` and does not compile `al_Convolver.cpp`. **`al::Convolver` is unavailable** until either (a) zita-convolver is added to `allolib-wasm/CMakeLists.txt` as a static lib, or (b) a hand-rolled partitioned-FFT convolver lives under `_studio_shared/`. Until then any IR-builder/convolution example needs the helper.
> - **No `Pickable`.** The cookbook helper at `cookbook/pickable/` is not wired into the WASM include path. For draggable handles, use `App::onMouseDown/Drag/Up` with manual hit-testing (the transpiler keeps these methods as-is) or implement a small `WebPickable` helper under `_studio_shared/`.
> - **No ImGui.** `al_ControlGUI.hpp` aliases to `WebControlGUI` (`allolib-wasm/include/al_WebControlGUI.hpp`) which exposes parameters to the Vue panel via the `_al_webgui_*` exports listed in `compile.sh`. There is no in-canvas ImGui — text annotations must be drawn into the `al::Mesh` scene or rendered as Vue overlays.
> - **No `gam::SoundFile` / `SoundFilePlayerTS`.** The transpiler rewrites `SoundFile` → `WebSamplePlayer` (`transpiler.ts:303`, header `allolib-wasm/include/al_WebSamplePlayer.hpp`). Loading is async via `EM_ASM` → `decodeAudioData`; `ready()` must be polled before sample reads. **All audio assets must be served as URLs** — there is no asset-bundling pipeline yet, so a multitrack stems example needs a chosen hosting plan (probably `frontend/public/assets/mat200b/` with a manifest JSON).
> - **Available DSP.** `Gamma/Filter.h` (Biquad, Hilbert, Reson, OnePole, MovingAvg, AllPass1), `Gamma/DFT.h` (DFT, **STFT**), `Gamma/Effects.h`, `Gamma/Envelope.h`, `Gamma/Oscillator.h`, `Gamma/Analysis.h` (EnvFollow, ZeroCross), `Gamma/HRFilter.h` are all on the include path (`backend/docker/compile.sh:84`). `gam::Hilbert` (defined at `allolib/external/Gamma/Gamma/Filter.h:448`) is **available** — SSB twist is unblocked.
> - **Graphics primitives.** `al::Mesh`, `al::Texture`, `al::EasyFBO`, `al::ShaderProgram` all build under WebGL2 (`ALLOLIB_WEBGL2=1`); `al_FBO_Web.cpp` and `al_EasyFBO_Web.cpp` route them. Geometry shaders are blocked by `transpiler.ts:81`. Compute shaders only on WebGPU backend.
> - **Shared helpers** all live under a new `allolib-wasm/include/_studio_shared/` directory (mirroring the native plan's `tutorials/_shared/`). They're header-mostly so user examples just `#include "_studio_shared/audio_features.hpp"` etc. Every `.cpp` link is the same path that compile.sh already produces — no per-example flags needed.

---

### Multiscale stem visualizer

1. **Title** — verbatim.
2. **Registry entry** —
```ts
{
  id: 'pg-mix-multiscale-stems',
  title: 'Multiscale stem visualizer',
  description: 'Mix N stems with per-track gain. Three time scales (raw / 50 ms RMS / 1 s energy) stacked in viewports; Mondrian toggle redraws stems as axis-aligned rectangles colored by spectral centroid.',
  category: 'playground-audiovisual',
  subcategory: 'mixing',
  code: `…`,
}
```
Category placement: `playground-audiovisual` because the entry is a multitrack player + visual analyzer, not a synthesizer voice. New subcategory `'mixing'` (added once to `playgroundCategories[1].subcategories`) groups all of Section 1 + 1.5.
3. **AlloLib classes** — `al::WebApp` (transpiler-rewritten from `App`), `WebSamplePlayer` ×N (ex-`SoundFilePlayerTS`), `al::Mesh` with `Mesh::LINE_STRIP` and `Mesh::TRIANGLES`, `al::Texture` (waveform thumbnails), `al::SingleRWRingBuffer` (header-only — confirm `allolib/include/al/util/al_SingleRWRingBuffer.hpp` is on path; if not, drop a tiny SPSC ring under `_studio_shared/util.hpp`), `al::Parameter` + `WebControlGUI`, `gam::EnvFollow<>`, `gam::STFT` (centroid).
4. **Audio plan** — N stems summed via per-stem `Parameter` gain. Per-stem mono mix → ring buffer (1024 frames @ worklet sr). Worker decimates ring into three pyramids: raw, 50 ms RMS, 1 s energy. STFT 2048/512 for centroid (lives in audio thread; result `std::atomic<float>` to graphics). **Block 128**, sr from worklet.
5. **Visual plan** — Three vertically stacked viewports, each a `LINE_STRIP` of one pyramid level. Shared playhead vertical `LINES` strip. Logarithmic time-axis toggle. Stem labels through `WebControlGUI` parameter group (`Parameter::group("stems")`).
6. **A→V** — stem RMS → bar height; duration → width; centroid → HSV hue (mapped to `Color`); playhead time → x.
7. **Twist** — Mondrian view: replace lines with axis-aligned `TRIANGLES` rectangles (x=onset, w=duration, y stacked, h=RMS, color=centroid). Toggle is a `ParameterBool`.
8. **Size** — medium, ~450 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (centroid/RMS module), `_studio_shared/automation.hpp` (gain-curve recording).
10. **Web-specific risks** — Loads N stem files: must ship a stem pack under `frontend/public/assets/mat200b/stems/` and use `WebSamplePlayer::load("/assets/mat200b/stems/<id>.wav")`. `WebSamplePlayer::ready()` must be polled in `onAnimate` before audio rendering enables. Consider 4-stem default to keep first-load <20 MB. Browser per-file CORS isn't an issue when self-hosted, but if assets are CDN-hosted, set `crossorigin` on the fetch.

### Spectrum-mixing painter

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-mix-spectrum-painter'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing'`. Same justification as above (multitrack analyzer with painted control surface).
3. **AlloLib classes** — `al::WebApp`, `al::Texture` (`Texture::RGBA32F` per layer — confirm WebGL2 supports `EXT_color_buffer_float` in `al_WebGL2Extensions.cpp`; the helper there enables it where available), `al::EasyFBO` (`al_EasyFBO_Web.cpp` routes it through WebGL2 FBO), `al::Mesh` `TRIANGLE_STRIP`, `WebSamplePlayer`, `gam::STFT` (analysis + complex resynthesis), `al::Parameter`, `al::ShaderProgram` (Gaussian splat fragment).
4. **Audio plan** — N source files → STFT 1024/256 (256-hop fits cleanly into 128-block worklet at 2 hops/block). Per-bin weight `W_n[k,t]` sampled from per-layer alpha texture (CPU-side mirror — graphics texture is for display only); audio thread sums `Σ W_n·X_n` and inverse-STFTs. SR from worklet, block 128.
5. **Visual plan** — Each layer a translucent texture displayed via additive blending in `EasyFBO`. Brush splats Gaussian blobs into the active layer with a fragment shader; the painted alpha buffer is the source of `W_n`.
6. **A→V** — painted alpha at (bin, frame) → STFT bin weight; brush centroid → painted hue; per-layer time → which column samples now.
7. **Twist** — Brush radius parameterized as a Gabor atom — splat is multiplied by a 2D Gaussian whose σ_t,σ_f match a chosen window length.
8. **Size** — small, ~300 LOC.
9. **Helpers** — `_studio_shared/post_fx.hpp` (Gaussian splat shader), `_studio_shared/audio_features.hpp` (default brush color from STFT centroid).
10. **Web-specific risks** — `RGBA32F` textures depend on `EXT_color_buffer_float`; on iOS Safari the extension may be unavailable — fall back to RGBA8 with bigger UI feedback. STFT round-trip with editable bins crosses thread boundaries: use a double-buffered `std::array<std::atomic<float>>` for the bin weights so the audio thread reads consistent snapshots. Painter mouse events: use `App::onMouseDrag` (preserved by transpiler).

### Virtual diffusion stage

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-mix-diffusion-stage'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing'`. The native plan put this under `tutorials/interaction-sequencing/`; the Studio version drops "interaction-sequencing" and folds it into the mixing subcategory because the gesture sequencer is twist-flavor here, not the headline.
3. **AlloLib classes** — `al::WebApp`, `WebSamplePlayer` (single stereo input), `al::StereoPanner` (per virtual speaker), `gam::Biquad<>` per band, **no `Pickable`** — substitute manual `App::onMouseDown/Drag/Up` hit testing or use the new `_studio_shared/web_pickable.hpp`. `PresetSequencer` is stubbed in `al_playground_compat.hpp` (transpiler line 140); confirm the stub records/plays before relying on it — if not, swap for `_studio_shared/automation.hpp`. `al::Mesh` quads, `WebControlGUI`.
4. **Audio plan** — Each virtual speaker = `gam::Biquad<>` (bright=high-shelf, dark=low-pass, warm=peaking) + per-speaker gain + 2D pan from speaker (x,y) vs listener. Stereo input duplicated to N speakers, filtered, gain-staged, summed back equal-power. Block 128, sr from worklet.
5. **Visual plan** — Top-down 2D room (`LINE_LOOP`); each speaker a `TRIANGLE_FAN` disc with `Color` brightness from a `gam::EnvFollow<>` on its post-gain output. Lines source→speaker as `Mesh::LINES` with alpha = current gain.
6. **A→V** — post-fader RMS → speaker brightness; gain Parameter → line alpha; band selection → speaker tint.
7. **Twist** — Wrap every fader and (x,y) in `_studio_shared/automation.hpp::AutomationLane`. REC + PLAY buttons exposed as `WebControlGUI` triggers. Persist gestures as JSON via `localStorage` (Vue side) or IDBFS (`-lidbfs.js` is in compile flags, so the file persists in IndexedDB).
8. **Size** — medium, ~600 LOC.
9. **Helpers** — `_studio_shared/automation.hpp`, `_studio_shared/param_graph.hpp` (signal-flow lines mirror this), `_studio_shared/web_pickable.hpp`.
10. **Web-specific risks** — `PresetSequencer` web-stub status is the load-bearing question: if it's a no-op stub, the twist relies entirely on `automation.hpp`. **Sub-task:** read `al_playground_compat.hpp`'s `PresetSequencer` definition before writing the example, and if it's a stub, document this and route through the helper.

### Mastering A/B with diff visuals

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-mix-mastering-ab'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing'`.
3. **AlloLib classes** — `al::WebApp`, two `WebSamplePlayer`s, `al::SingleRWRingBuffer` (×2), `gam::STFT` (×2), `gam::EnvFollow<>` for short-term loudness, K-weighted `gam::Biquad<>` chain (high-shelf @ 1.5 kHz +4 dB + 100 Hz HPF — ITU-R BS.1770-4 specifies the exact biquad coefficients), `al::Mesh` `LINE_STRIP`, `al::Parameter`, `WebControlGUI`.
4. **Audio plan** — Two sample-locked players. Master is what plays through speakers; pre is analyzed in parallel (rendered to a second pair of channels in the audio worklet — 4-channel output is supported). Loudness via K-weighted EBU R128 short-term (3 s window). PLR = peak − loudness; PSR = short-term peak − short-term loudness. Block 128, sr from worklet.
5. **Visual plan** — Three stacked panes — overlaid waveforms with diff envelope shaded between (`TRIANGLES` with z = diff sign), spectrum diff `LINE_STRIP` (master − pre, log-frequency), PLR/PSR meter bars + LUFS history scroll.
6. **A→V** — sample-by-sample diff → red/green shading; bin-by-bin spectral diff → height; ΔLUFS → "loudness war" tick height.
7. **Twist** — Vector of `WebSamplePlayer`s (loadable masters list); LUFS history of each rendered as stacked overlay timeline with year labels.
8. **Size** — small, ~350 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (LUFS/RMS/peak module — K-weighting biquads + 400 ms gating block + 3 s integration window, ITU-R BS.1770-4 reference).
10. **Web-specific risks** — Two-master sample-lock requires both `WebSamplePlayer::ready()` to gate audio start. Author multiple masters as small (~30 s) loops to keep total payload reasonable. Browser autoplay policy: audio start needs a user gesture — surface a "Play" button via `WebControlGUI::trigger`. K-weighting biquad coefficients are sample-rate-dependent; recompute when `audioIO().framesPerSecond()` is known (44.1 vs 48 kHz).

---

## 1.5 Mixing & Production (extension)

> 11 new entries grouped under a single new subcategory `'mixing-production'` (added to `playgroundCategories[1].subcategories`). Naming rationale: keeps Section 1's mixing workflow examples (`'mixing'`) separate from the gain-staging / EQ-training drills here, so the dropdown shows two cleanly-scoped groups. All entries use `category: 'playground-audiovisual'` because every one ships an audio analyzer + visual readout, not a synthesizer voice.
>
> Common to every entry: K-weighting biquads + ITU-R BS.1770-4 short-term LUFS, true-peak via 4× oversampling (use `gam::Biquad<>` resampler chain or hand-rolled FIR), short-term integration via `gam::EnvFollow<>`. RMS, centroid, ZCR, attack-time, fundamental tracking via `_studio_shared/audio_features.hpp::AudioFeatureExtractor`. Where the user prompt says "MFCC + small kNN over a hand-curated bank", that's a header-only classifier under `_studio_shared/audio_features.hpp::MFCCkNN` with a JSON corpus shipped at `frontend/public/assets/mat200b/genre_eq_bank.json` and loaded via `EM_ASM` `fetch`.

### 1.5.1 −18 dBFS sweet-spot meter (small)

1. **Title** — −18 dBFS sweet-spot meter.
2. **Registry entry** — `id: 'pg-meter-sweetspot'`, `title: '−18 dBFS sweet-spot meter'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing-production'`. Audio-with-static-graphics drill, registry-shaped just like the spheres example.
3. **AlloLib classes** — `al::WebApp`, `WebSamplePlayer` (or live mic via `configureWebAudio(sr,128,2,2)`), `gam::EnvFollow<>` (RMS), K-weighting biquad chain (`gam::Biquad<>` ×2, ITU-R BS.1770-4), 4× upsampling true-peak detector (`gam::Biquad<>` interpolator + `std::abs` max), `al::Mesh` `TRIANGLES` for LED segments, `al::Parameter` (saturation curve selector enum: tape/tube/transformer), `WebControlGUI`.
4. **Audio plan** — Per block (128): update RMS via `EnvFollow` (300 ms), ITU-R BS.1770 short-term LUFS (3 s gated window), true-peak via 4× polyphase oversampler. All scalars handed to graphics via `std::atomic<float>`. Sr from worklet.
5. **Visual plan** — One vertical bar of N=24 LED segments built as `TRIANGLES` quads. Each LED's color comes from a parameter table: green for −24…−12 dBFS (the sweet-spot zone, painted with extra saturation), yellow −12…−6 dBFS, red above −6, dim grey below −24. Three indicators on the same bar: peak (thin tick at top), RMS (filled fill up to current value), short-term LUFS (semi-transparent overlay). A slow 10-s exponential moving average drawn as a faint ghost mark to the left of the bar. Zone labels (`TOO QUIET / SWEET SPOT / FINE / HOT / CLIP`) drawn with `addPrism` text-stroke meshes or rendered as Vue overlays positioned over the canvas via DOM coordinates.
6. **A→V** — RMS (linear) → fill height in dBFS scale; true-peak → tick y-position; short-term LUFS → ghost y; saturation-curve responsiveness (computed by analytically evaluating `d|y|/d|x|` for the chosen tape/tube/transformer waveshaper at the current RMS) → small green LED next to the bar lights when derivative deviates >5% from unity (the "audibly non-linear" zone).
7. **Twist** — Saturation responsiveness indicator: given a chosen analog-modeled curve (tape ≈ tanh(kx), tube ≈ asymmetric clipper, transformer ≈ soft hysteresis), light up the green "in the zone" indicator when the average is in the region where that curve becomes audibly non-linear (slope deviation > threshold). `ParameterMenu` selects the curve.
8. **Size** — small, ~250 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (`RMSMeter`, `LUFSShortTerm`, `TruePeak`); `_studio_shared/post_fx.hpp` (LED glow shader — multiplicative bloom on >−6 dBFS segments). No new helpers needed beyond `audio_features` LUFS/true-peak; saturation derivative is inline math.
10. **Web-specific risks** — Procedural meter, **no asset risk**. Mic mode requires user gesture + permission prompt. True-peak 4× upsampling adds CPU cost — measure on Chromebook target. ITU-R BS.1770 gating block size (400 ms with 75% overlap) interacts awkwardly with 128-frame worklet; accumulate gating blocks across calls.

### 1.5.2 Clip-gain vs fader-gain visualizer (small)

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-mix-clipgain-vs-fader'`, `title: 'Clip-gain vs fader-gain visualizer'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing-production'`. The duplicated processing graph is the conceptual centerpiece, and this is exclusively a mixing/production drill.
3. **AlloLib classes** — `al::WebApp`, `WebSamplePlayer`, two parallel chains: each chain is `[Gain] → gam::EnvFollow<> → soft-knee Compressor (custom) → Limiter → [Gain]`. The compressor/limiter are inline classes (no third-party — Gamma has the building blocks). `al::Mesh` `LINE_STRIP` (waveforms), `al::Mesh` `LINES` (output spectra via `gam::STFT`), `al::Parameter` for the master gain sweep, `WebControlGUI`.
4. **Audio plan** — Single source split into chain A (gain-before) and chain B (gain-after), identical comp/limiter coefficients. Both chains' outputs ring-buffered for graphics. Per block 128, run both chains, render only A through speakers (B is muted but visualized).
5. **Visual plan** — Five-pane stack: input waveform; A output waveform; B output waveform; output spectra of A and B overlaid on the same `LINE_STRIP` (with B in a different hue); compressor activity graph (gain-reduction in dB over time, two `LINE_STRIP`s) showing where each chain triggered the comp. Single `Parameter` slider sweeps gain from −20 to +10 dB; both A and B output meters sit at the right edge as a converging/diverging pair.
6. **A→V** — input level → both chains' compressor gain-reduction curves (legibility hinges on showing them on the same axis with the same y-units in dB); slider position → x-axis annotation; gain-reduction divergence between A and B → red shading where they differ by >0.5 dB.
7. **Twist** — Single slider sweeps gain from −20 to +10 dB; both chains' outputs converge at unity (slider = 0 dB) and diverge as soon as either chain hits the comp threshold. The diverge-from-converge moment is the "exactly when staging matters" pedagogical hit.
8. **Size** — small, ~300 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (compressor + limiter classes, plus shared GR-meter); `_studio_shared/automation.hpp` (record the sweep as a comparable lane).
10. **Web-specific risks** — Procedural, **no asset risk** (uses one short loop or live mic). Two parallel chains double CPU; 128-block worklet has ~2.7 ms budget at 48 kHz, so keep STFT off the hot path (run on every Nth block, not every block).

### 1.5.3 Mix thermometer (medium)

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-mix-thermometer'`, `title: 'Mix thermometer'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing-production'`.
3. **AlloLib classes** — `al::WebApp`, vector of `WebSamplePlayer`, `gam::STFT` per stem, `gam::EnvFollow<>` per stem, K-weighted ITU-R BS.1770 short-term LUFS per stem, `_studio_shared/audio_features.hpp::MFCCkNN` for stem classification (centroid + ZCR + attack-time + fundamental tracking), `al::Mesh` `TRIANGLES` (range bars), `al::Mesh` `addDisc` (measurement dots), `al::Parameter` for genre preset, `WebControlGUI`.
4. **Audio plan** — Drop a multitrack project in (mediated by `WebSamplePlayer::load` calls + a `WebFile` picker — `al_WebFile.hpp`). For each stem, on load: classify by type (kick / bass / vocal / lead / pad / hat / FX) using MFCC×13 + centroid + attack-time features run through a kNN over a curated bank (`frontend/public/assets/mat200b/stem_class_bank.json`). At runtime: measure peak and short-term LUFS per stem, plot against target ranges from a JSON levels chart (`frontend/public/assets/mat200b/levels_chart.json`, presets keyed by genre). Block 128.
5. **Visual plan** — Horizontal range bars per instrument category, drawn as `TRIANGLES` rectangles with low-alpha fill (target zone). Colored dot (`addDisc`) per stem at its actual peak/LUFS measurement; green if in target, yellow ±3 dB, red beyond. X-axis is dBFS, y-axis is instrument category label.
6. **A→V** — peak LUFS → dot x; in-band/out-of-band → dot color (RGB lerp from target distance); genre preset selection → range bars shift left/right and re-color.
7. **Twist** — Genre presets that shift the targets (the "trap kick" target is not the "house kick" target). Let the user save their own targets from a reference track they drop in: drop a reference, the tool runs the same per-stem analysis (using stem separation if available — but for now require the user to drop **stems**, not a mixed reference), saves means/stds as a new genre preset.
8. **Size** — medium, ~600 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (MFCC, kNN classifier, K-weighted LUFS, true-peak); `_studio_shared/automation.hpp` (save user-targets as automation-lane CSV-equivalent). The MFCC+kNN module is **new** for this section; it lands in `audio_features.hpp` and is reused by 1.5.10.
10. **Web-specific risks** — **Multitrack stem bundle required** — needs a curated demo project (4–8 stems × 30 s) at `frontend/public/assets/mat200b/demo_project/`. Stem upload via `al_WebFile.hpp` + IDBFS for persistence. Classification corpus must be small (~50 examples per class) and shipped as JSON to keep page-load reasonable. ITU-R BS.1770 gating across stems is independent (one integrator per stem).

### 1.5.4 Reference-track A/B difference engine (small)

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-mix-reference-ab'`, `title: 'Reference-track A/B difference engine'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing-production'`.
3. **AlloLib classes** — `al::WebApp`, two `WebSamplePlayer`s, `gam::STFT` ×2 (matched window/hop), third-octave band sums (31 bands, hand-rolled magnitude binning), PLR (peak − loudness) computed per chunk via `gam::EnvFollow<>` + true-peak detector, mid/side decomposition (M=L+R, S=L−R) per band for stereo width, `al::Mesh` `LINE_STRIP` ×3 stacked plots, `WebControlGUI` for align/play/pause.
4. **Audio plan** — Drag in mix and reference; tool aligns by tempo/length (cross-correlation of broadband envelopes — accept ±50 ms drift). Matched STFT analysis on both, normalized for level (subtract integrated LUFS difference). Per third-octave band: spectral mag(mix) − mag(ref), PLR(mix) − PLR(ref), width(mix) − width(ref). Block 128, sr from worklet.
5. **Visual plan** — Three diff plots stacked: spectrum (third-octave bars, x=center freq log, y=dB), dynamics (PLR over time), stereo width (per-band width difference). Each plot's zero-line is centered; positive values shaded one color, negative the other.
6. **A→V** — band magnitude diff → bar height + sign-color; PLR diff over time → line y; width diff → bar height in third pane. Clicking a band scrubs both files to where that band's diff peaks.
7. **Twist** — "Drift mode" — play both files in sync and watch the diff plots evolve; pause where the difference spikes and inspect (a peak-marker tracks the running max of each plot and parks a `Mesh` flag at the corresponding x).
8. **Size** — small, ~400 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (third-octave binner, mid/side decomposition, PLR/PSR, alignment cross-correlator).
10. **Web-specific risks** — Two-file payload doubles asset cost; encourage user-supplied uploads via `al_WebFile.hpp` rather than shipped demo references. Cross-correlation alignment on multi-minute files is O(N log N) with FFT — acceptable, but offload the alignment scan to a one-shot main-thread call in `onCreate` rather than every block.

### 1.5.5 Multitrack spectrum collision map (medium)

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-mix-collision-map'`, `title: 'Multitrack spectrum collision map'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing-production'`.
3. **AlloLib classes** — `al::WebApp`, vector of `WebSamplePlayer`, `gam::STFT` per track, peak-tracker (per-bin running max with decay) per track, `al::Mesh` `TRIANGLE_STRIP` for translucent stacked spectra, `al::Mesh` `TRIANGLES` for collision overlay (cumulative red bands), `WebControlGUI` (per-track gain/mute, click-to-inspect).
4. **Audio plan** — Per track FFT (1024/256), peak-tracking attack/release ~50 ms / 500 ms. Collision detection: at each bin, count tracks with magnitude > −24 dB threshold; if ≥2, mark collision. Collision intensity = sum of magnitudes of colliding tracks. Block 128.
5. **Visual plan** — Stacked translucent spectra in different hues (HSV-spaced, one hue per track); collision regions accumulate as bright vertical bands drawn on top in red with alpha = collision intensity / max. Logarithmic frequency axis. Click on a collision band → ImGui-equivalent tooltip via Vue (or in-canvas text mesh): list of colliding tracks + suggested EQ move.
6. **A→V** — per-track spectrum mag → translucent spectrum line height; collision intensity → red overlay alpha; click position → highlighted tracks (their lines pulse via emissive shader).
7. **Twist** — Clicking a collision band highlights which tracks are colliding and proposes a starter EQ — "cut 250 Hz on the rhythm guitar by 3 dB to clear the bass." Suggestion logic: pick the track with the highest energy in that bin that is not the one with the lowest fundamental (preserve bass-end clarity by suggesting cuts on the higher-fundamental track).
8. **Size** — medium, ~550 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (per-track STFT + peak-tracker + collision detector); `_studio_shared/draw_canvas.hpp` (the tooltip overlay drawing).
10. **Web-specific risks** — Multitrack stem bundle required (shared with 1.5.3 — same `frontend/public/assets/mat200b/demo_project/`). Per-track STFT is N FFTs per block; for 8 tracks at 256-hop and 128-block, that's 4 FFTs per block — tractable but profile.

### 1.5.6 Spectral real-estate planner (small)

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-mix-realestate-planner'`, `title: 'Spectral real-estate planner'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing-production'`. Mostly a planning tool; light audio (optional preset analysis).
3. **AlloLib classes** — `al::WebApp`, `al::Mesh` `TRIANGLES` (instrument rectangles), `al::Mesh` `LINES` (grid), `WebControlGUI` (carve mode toggle, preset selector), optional `WebSamplePlayer` for synth presets, optional `gam::STFT` for dominant-band detection. **No `Pickable`** → manual mouse drag/resize via `App::onMouseDown/Drag/Up`.
. **Audio plan** — Optional: load a synth preset audio sample, run STFT, find dominant bands (top-k peak picker), seed the planner with a rectangle for that instrument auto-placed at the detected band. Block 128.
5. **Visual plan** — Horizontal timeline (x = time), vertical frequency axis (log Hz, y). Instruments drawn as colored `TRIANGLES` rectangles the user can drag and resize via mouse handles. Overlapping rectangles are visually merged with stripe-pattern fragment shader (`_studio_shared/post_fx.hpp::stripeOverlap`) to make collisions obvious.
6. **A→V** — rectangle (x, y, w, h) → (start, freq-low, duration, freq-high); user drag → rectangle update; overlap detection → stripe overlay alpha.
7. **Twist** — "Carve mode" toggle that auto-suggests subtractive EQ moves to make assignments non-overlapping. Solver: for each overlap, propose narrowing the higher-fundamental instrument's band by min-shift to clear the collision. Compare user plan vs auto-carved version side-by-side.
8. **Size** — small, ~350 LOC.
9. **Helpers** — `_studio_shared/draw_canvas.hpp` (drag-resize handles + grid rendering); `_studio_shared/audio_features.hpp` (dominant-band peak picker for the optional preset-analysis flow).
10. **Web-specific risks** — Procedural, **no asset risk** (the optional preset analysis takes user uploads via `al_WebFile.hpp`). Manual hit-testing for drag-resize handles needs to be smooth — keep handle hit areas ≥10 px in canvas-space units.

### 1.5.7 Sweep-and-destroy assistant (small)

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-mix-sweep-destroy'`, `title: 'Sweep-and-destroy assistant'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing-production'`.
3. **AlloLib classes** — `al::WebApp`, `WebSamplePlayer`, `gam::Biquad<>` parametric peak (single sweepable filter), `gam::STFT` for spectrum display, `al::Mesh` `LINE_STRIP` (spectrum), `al::Mesh` `addDisc` (red flag marks), `al::Parameter` (sweep speed, Q, gain), `WebControlGUI` (mark trigger, A/B trigger), `_studio_shared/automation.hpp::AutomationLane` for the sweep curve.
4. **Audio plan** — Source through automated parametric EQ; peak frequency sweeps log-linearly from 20 Hz → 20 kHz at user-set speed (default 30 s/sweep). User presses "Mark" key when something sounds bad; mark = current sweep frequency. Each mark becomes a notch (peak filter with negative gain, e.g., −6 dB at Q=4). Final EQ curve = sum of all notches (cascaded `gam::Biquad<>`). Block 128.
5. **Visual plan** — Spectrum `LINE_STRIP` with the sweep band visible as a moving spike (a `LINES` vertical of height = current peak gain, animated to sweep position); user-marked frequencies appear as red `addDisc` flags pinned to the spectrum baseline; final EQ curve drawn live as a separate `LINE_STRIP` accumulating notches as flags are placed.
6. **A→V** — sweep frequency → moving spike x; mark events → flag at current x; cumulative notches → continuous EQ curve; A/B toggle → spectrum baseline color (original=neutral, carved=highlighted).
7. **Twist** — Once you have the cut list, the tool A/Bs the original vs the carved version, and shows the loudness/dynamics impact of the carving (∆LUFS short-term, ∆PLR over a few seconds) as a small badge.
8. **Size** — small, ~300 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (LUFS + PLR for the badge); `_studio_shared/automation.hpp` (sweep automation).
10. **Web-specific risks** — Procedural, **no asset risk** (user-supplied source). Sweep-while-listening is the whole point — make sure the `WebSamplePlayer` looper plays continuously; verify the audio worklet doesn't rebuffer on file-end.

### 1.5.8 Channel-strip order playground (medium)

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-mix-channel-strip-order'`, `title: 'Channel-strip order playground'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing-production'`.
3. **AlloLib classes** — `al::WebApp`, `WebSamplePlayer`, six processing slots each as a small `IPlugin` interface — `Gate`, `SubEQ`, `Compressor`, `AddEQ`, `Saturator`, `Limiter` — implementations using `gam::Biquad<>`, `gam::EnvFollow<>`, custom waveshaper. `std::array<IPlugin*, 6>` with a permutation array. `gam::STFT` per node (six probes — 6 FFTs is the budget concern). `al::Mesh` `LINE_STRIP` (waveform per node), `WebControlGUI` (drag-drop ordering surface uses Vue side; native side just receives an order array via a `Parameter::group("order")`).
4. **Audio plan** — Reorderable signal chain with stable plugin instances (state preserved when slots move). At each node, fork a probe tap to a ring buffer + STFT for graphics. Block 128, six FFT probes — profile target.
5. **Visual plan** — Timeline of "what each stage saw" — six panels, each showing the audio at that node (waveform `LINE_STRIP` + spectrum `LINE_STRIP` stacked). When the user reorders slots (Vue-side drag-drop), every panel updates within the next render frame. Slot labels follow the order.
6. **A→V** — ordered slot index → panel position; per-node audio tap → panel waveform + spectrum; user reorder → all panels re-label and re-render.
7. **Twist** — "Preset reasoning" mode — each ordering shows a one-line explanation of why it works or doesn't ("compressor is reacting to the 200 Hz mud you haven't cut yet"). Lookup table of common orderings keyed by `[gate,subEQ,comp,addEQ,sat,lim]` permutation hash → string. Unknown orderings get a generic heuristic ("comp before EQ → comp reacts to uncut frequencies").
8. **Size** — medium, ~700 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (compressor, gate, saturator, limiter implementations — these grow the file but are reused across 1.5.2 and 1.5.9); `_studio_shared/post_fx.hpp` (LED-style panel headers).
10. **Web-specific risks** — **Drag-drop UI is Vue-side**: native side receives an order via `WebControlGUI` parameters. The native code never knows about HTML drag events; the Vue panel publishes `Parameter::set` for each slot index. Six FFT probes per block at 1024/256 is heavy — measure; if it overshoots, downsample probes to one per 4 blocks.

### 1.5.9 Why-this-order quiz (small)

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-mix-order-quiz'`, `title: 'Why-this-order quiz'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing-production'`.
3. **AlloLib classes** — `al::WebApp`, `WebSamplePlayer`, three signal chains (same six plugins, three permutations), `_studio_shared/audio_features.hpp` plugin classes (reused from 1.5.8), `al::Mesh` `addDisc` for score indicator, `WebControlGUI` (three labeled triggers A/B/C, score counter exposed as a read-only parameter).
4. **Audio plan** — Same chain, three orderings, blind ABC. User taps A/B/C, the corresponding chain plays for 5 s, output is the only thing they hear. Per-trial state in a small JSON-shaped struct kept in C++ (mistakes log).
5. **Visual plan** — Minimal — three buttons (Vue side), score counter (read-only `Parameter`), and a small mistake-pattern heatmap (`TRIANGLES` rectangles, one per misclassified pair) that grows as the session progresses.
6. **A→V** — guess events → score; misclassification pattern → heatmap cell color; correct answer reveal → label flash.
7. **Twist** — Track which mistakes you keep making (e.g., "saturate-first vs saturate-last"). Tool gives focused exercises by re-weighting future questions toward the user's weak pairs (multinomial sampling biased by mistake frequencies).
8. **Size** — small, ~250 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (plugin chain reuse from 1.5.8); `_studio_shared/automation.hpp` (mistake log persistence as automation-style CSV).
10. **Web-specific risks** — Procedural, **no asset risk** (uses one short loop or live mic). Mistake log persistence: write to IDBFS path so it survives browser reloads (`-lidbfs.js` is already in compile flags).

### 1.5.10 Genre-aware EQ assistant (medium)

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-eq-genre-assistant'`, `title: 'Genre-aware EQ assistant'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing-production'`.
3. **AlloLib classes** — `al::WebApp`, `WebSamplePlayer`, `_studio_shared/audio_features.hpp::AudioFeatureExtractor` (centroid + ZCR + attack-time + fundamental tracking via autocorrelation pitch) + `MFCCkNN` classifier (kNN over a hand-curated bank of 50–100 stems per class — JSON at `frontend/public/assets/mat200b/genre_eq_bank.json`), parametric EQ (`gam::Biquad<>` ×N), `al::Mesh` `LINE_STRIP` (EQ curve), `al::Mesh` `TRIANGLES` (suggested cut/boost zones with band-colored fill), `WebControlGUI` (per-band gain/freq/Q parameters).
4. **Audio plan** — On stem load: feature extraction over a 10 s window, classify (kick / 808 / bass synth / lead / pad / hats). Lookup suggested cut/boost zones from a per-class JSON (e.g., `kick: { cut: [200..400], boost: [60..80, 4000..6000] }`). User adjusts the parametric EQ; changes routed live through `gam::Biquad<>` cascade. Block 128.
5. **Visual plan** — Parametric EQ canvas: x = log-frequency 20 Hz–20 kHz, y = dB ±15 dB. Suggested zones drawn as `TRIANGLES` semi-transparent rectangles (red for cut, green for boost). User EQ curve as a `LINE_STRIP` updated per parameter change. Active EQ band highlighted with a `addDisc` handle at peak frequency.
6. **A→V** — classifier output → suggested-zone rectangles; user `Parameter` band gains → curve y at corresponding x; click on suggested zone → tooltip text (Vue side or in-canvas mesh).
7. **Twist** — "Why this zone" tooltip — clicking a suggested cut explains the acoustic reason ("400 Hz boxiness comes from kick drum shell resonance; cutting it tightens the low-mids"). Static lookup table keyed by `(class, zone)` → string.
8. **Size** — medium, ~600 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (MFCC, kNN, fundamental tracker — shared with 1.5.3); `_studio_shared/draw_canvas.hpp` (parametric EQ curve renderer with handle hit-testing — **new helper for this entry**, also used by 1.5.11). The `draw_canvas` helper grew specifically to back the parametric EQ curve here — not just the click-paint use it had in the native plan.
10. **Web-specific risks** — **Genre EQ bank JSON** must be packaged at `frontend/public/assets/mat200b/genre_eq_bank.json` and `genre_eq_zones.json` (zones + reason strings). Total size <200 KB easily. Classifier corpus is the asset. **Live mic mode (optional)** would need user gesture + permission. Single-stem analysis at load time is one-shot — not a per-block cost.

### 1.5.11 EQ frequency trainer (small)

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-eq-frequency-trainer'`, `title: 'EQ frequency trainer'`, `category: 'playground-audiovisual'`, `subcategory: 'mixing-production'`.
3. **AlloLib classes** — `al::WebApp`, `WebSamplePlayer` (or pink-noise generator: `gam::NoiseWhite<>` + `gam::OnePole<>`), `gam::Biquad<>` (single hidden boost band), `al::Mesh` `LINE_STRIP` (frequency line — drawn unmarked until guess), `al::Mesh` `addDisc` (guess marker, correct-answer marker), `WebControlGUI` (toggle reference/altered, submit-guess parameter, difficulty selector enum), `_studio_shared/automation.hpp::WeaknessMap` (per-band guess log persisted to IDBFS).
4. **Audio plan** — Audio plays continuously (a short loop or pink noise). Tool boosts a hidden frequency by 6 dB via a single peaking biquad (Q = 1.0). User toggles between reference (no boost) and altered (with boost) versions on press. Difficulty scales: octaves first (12 bins), then thirds (36 bins), then specific ⅓-octave centers. Block 128.
5. **Visual plan** — Horizontal frequency line `LINE_STRIP` with no markings until the user guesses. After guess: correct answer revealed as a labeled flag (`addDisc` + text mesh) at the boost frequency. Character label below ("250 Hz — that's the muddy zone"). Personal weakness map drawn as a small color-coded histogram (`TRIANGLES`) at the bottom of the canvas: x = frequency band, y/color = miss rate.
6. **A→V** — toggle → which signal plays; guess (parameter set) → guess marker x; correct freq → answer marker x; weakness map updates after each round.
7. **Twist** — Personal weakness map — log every guess; the tool shows you which bands you're consistently bad at and weights future questions toward them (multinomial sampling weighted by 1 + miss-rate). Persisted to IDBFS so progress survives reloads.
8. **Size** — small, ~280 LOC.
9. **Helpers** — `_studio_shared/draw_canvas.hpp` (frequency line + labeled flag rendering — same helper as 1.5.10); `_studio_shared/automation.hpp::WeaknessMap` (per-band miss-rate histogram persisted to IDBFS — **new submodule for this entry**, also useful for 1.5.9's mistake log).
10. **Web-specific risks** — Procedural, **no asset risk** (pink-noise generator is fine; an optional user-uploaded source loop is bonus). IDBFS persistence requires the example to call the FS sync function on shutdown — wire via `onExit` in `WebApp`.

---

## 2. Section 2 — Synthesis

> All Section 2 entries become `playground-synthesis` registry entries. Native plan put files under `tutorials/synthesis/` and a sibling `tutorials/audiovisual/` for visualizations; the Studio version collapses each to a single registry example because the visual is part of the same `WebApp::onDraw`. The `subcategory` choices below extend `playgroundCategories[0].subcategories` with three new keys: `'synthesis-additive'`, `'synthesis-physical'`, `'synthesis-spectral'`. Justified per-entry.

### Drawable wavetable + 3D morph

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-synth-wavetable-morph'`, `category: 'playground-synthesis'`, `subcategory: 'oscillators'`. Reuses an existing subcategory (the 8-frame wavetable IS an oscillator class).
3. **AlloLib classes** — `al::WebApp`, `PolySynth` (via `al_playground_compat.hpp`), `gam::Osc<>` (table-based), `gam::ArrayPow2<float>` (8 frames × 2048), `gam::ADSR<>`, `al::Mesh` `TRIANGLE_STRIP` ribbon, `al::Parameter`, `WebControlGUI`, mouse via `App::onMouseDrag` (transpiler keeps it).
4. **Audio plan** — 8 user-drawable single-cycle tables. Voice reads two adjacent frames at `pos = morph * 7`, cubic (Catmull-Rom) interpolates per sample, then table lookup at carrier phase. Block 128, sr from worklet, polyphony 8 (well within WASM budget).
5. **Visual plan** — Ribbon = 8 rows × 2048 cols of vertices (x=sample, y=value, z=frame), connected `TRIANGLE_STRIP`s. Glowing playhead `LINE_STRIP` traces current interpolated cycle across z-axis at morph position. WebGL2 backend confirmed via `ALLOLIB_WEBGL2=1`.
6. **A→V** — morph → playhead z; cycle phase → playhead x; sample value → playhead y; voice envelope → ribbon emission/alpha (additive blend).
7. **Twist** — Second axis "spectralMorph" (0..1) does FFT-domain magnitude interpolation between frames instead of sample-domain. Ribbon visibly rotates 90° around its long axis when crossing 0.5.
8. **Size** — small, ~400 LOC.
9. **Helpers** — `_studio_shared/post_fx.hpp` (ribbon glow), `_studio_shared/automation.hpp` (morph automation).
10. **Web-specific risks** — Per-voice cubic interp at 8 voices × 128-sample block × cubic = ~1k mults/voice/block — fine. Drawing the table via mouse uses `App::onMouseDrag`, transpiler-preserved. FFT-domain morph mode runs an FFT/iFFT per frame transition — keep the transition rate-limited (no more than once per 50 ms of morph movement).

### Risset glissando reconstruction

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-synth-risset-glissando'`, `category: 'playground-synthesis'`, `subcategory: 'oscillators'` (it's an additive bank of sines, but the legibility hook is the rate slider — fits oscillators).
3. **AlloLib classes** — `al::WebApp`, `gam::Sine<>` ×12, `gam::EnvFollow<>`, `al::Parameter` (rate, direction, octaves), `al::Mesh` `TRIANGLES`, `WebControlGUI`, `al::SingleRWRingBuffer`.
4. **Audio plan** — 12 partials with logarithmic frequency `f_i(t) = f_min·2^((i + phase(t)) mod 12)`. Per-partial amplitude = Gaussian on log-frequency centered mid-spectrum. Global phase advances at rate (oct/s, signed). Block 128, sr from worklet.
5. **Visual plan** — 12 horizontal bars (`TRIANGLES`); y is log-frequency. Bars slide smoothly downward (or up); width fixed; alpha = current Gaussian amplitude. WebGL2 confirmed.
6. **A→V** — partial frequency → bar y; amplitude → bar alpha + RGB; rate → vertical scroll speed.
7. **Twist** — Single signed direction slider (-2…+2 oct/s); zero freezes; sign flips reverse scroll. ±0.5 oct/s locks the Shepard illusion.
8. **Size** — small, ~180 LOC.
9. **Helpers** — `_studio_shared/automation.hpp`.
10. **Web-specific risks** — Procedural, **no asset risk**. 12 sines per voice is trivial. Continuous global phase across worklet boundaries: store phase as `double` in app state, advance per `onSound` call.

### Additive partial sculptor

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-synth-additive-sculptor'`, `category: 'playground-synthesis'`, `subcategory: 'synthesis-additive'` (NEW subcategory — the 256-partial graph is a clear "additive synthesis" niche distinct from single-osc playgrounds).
3. **AlloLib classes** — `al::WebApp`, custom `Partial` struct (256 always-on, no `SynthVoice`), `gam::Sine<>`, `gam::Env<3>`, `al::Mesh` `TRIANGLES` quads + `LINE_STRIP` envelopes, **no `Pickable`** → use `_studio_shared/web_pickable.hpp` for draggable nodes, `al::Parameter`, mouse via `App::onMouseDown/Drag`.
4. **Audio plan** — Pool of 256 partials with frequency, start, duration, envelope, phase. Block iterates active partials whose [start, end] intersects current time, sums sines. Zero-crossing-anchored envelopes. Block 128, sr from worklet. **Profile note: 256 sines × 128 samples = 32k mults/block ≈ 250k/s × 2 (audio thread overhead) — should fit but stress-test on a Chromebook target.**
5. **Visual plan** — Piano roll with `TRIANGLES` quads in time-vs-log-frequency grid. Quad height = amplitude (dB), color = phase HSV. Per-partial envelope on hover via `LINE_STRIP`.
6. **A→V** — amplitude → height + saturation; phase → hue; frequency → y; onset → x.
7. **Twist** — "Import → Analyze" button: STFT peak picking on `WebSamplePlayer` source, instantiate one partial per detected sinusoidal track, drop them on the grid as draggable handles via `web_pickable.hpp`.
8. **Size** — medium, ~700 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (peak picking), `_studio_shared/param_graph.hpp`, `_studio_shared/automation.hpp`, `_studio_shared/web_pickable.hpp`.
10. **Web-specific risks** — **256-voice additive may need polyphony stress test.** If 256 sines × 128 samples is too heavy on low-end devices, gate the partial cap on a build-time `Parameter` (default 128, max 256). Asset risk: import-and-analyze loads a user file via `al_WebFile.hpp`, no shipped asset.

### Subtractive synth with z-plane visualizer

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-synth-subtractive-zplane'`, `category: 'playground-synthesis'`, `subcategory: 'filters'`. Reuses existing subcategory — z-plane *is* the canonical filter visualization.
3. **AlloLib classes** — `al::WebApp`, `gam::Biquad<>` or hand-rolled DF-II, `gam::NoiseWhite<>`, `gam::Saw<>`, **no `Pickable`** → `_studio_shared/web_pickable.hpp` for pole/zero handles, `al::Mesh` (`LINE_LOOP` unit circle, `POINTS`, `TRIANGLE_STRIP` 3D surface via `addSurface`), `WebControlGUI`.
4. **Audio plan** — 2-pole/2-zero biquad; coefficients from user-dragged complex pole/zero pairs (conjugates locked): `a1=-2Re(p), a2=|p|², b1=-2Re(z), b2=|z|²`. Source = white noise or sawtooth. Block 128.
5. **Visual plan** — Top-down complex plane: unit circle, poles (red ×), zeros (blue ○). Above plane, 64×64 `TRIANGLE_STRIP` surface evaluating `|H(e^jω)|` as height; updates on pole drag. WebGL2 confirmed.
6. **A→V** — pole position → coefficients → surface height + sound; |pole| → surface peakiness; zero proximity to circle → notch depth.
7. **Twist** — "Draw response" — user sketches target magnitude along unit circle; least-squares (Yule-Walker) computes pole/zero positions and snaps the visual to match.
8. **Size** — small-medium, ~450 LOC.
9. **Helpers** — `_studio_shared/post_fx.hpp` (3D surface lighting), `_studio_shared/web_pickable.hpp`.
10. **Web-specific risks** — Procedural, **no asset risk**. 64×64 surface re-eval on every pole drag — throttle to 30 fps. Yule-Walker LSQ is O(N²) for a small N — fine.

### AM/RM sideband visualizer

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-synth-am-rm-sidebands'`, `category: 'playground-synthesis'`, `subcategory: 'modulation'` (existing subcategory — perfect fit).
3. **AlloLib classes** — `al::WebApp`, `gam::Sine<>` carrier+modulator, **`gam::Hilbert`** (Filter.h:448, **confirmed available** in WASM Gamma build) for SSB, `al::Parameter` (mode, mod amp, mod freq), `gam::STFT` (8192) for spectrum, `al::Mesh` (`LINES` sticks, `TRIANGLES` heads via `addDisc`), `WebControlGUI`, in-canvas text annotations.
4. **Audio plan** — Modes — AM `(1+m·mod)·car`, RM `mod·car`, balanced AM `(0.5+0.5·m·mod)·car − 0.5·car`, SSB `car·cos(ωm) − Hilbert(car)·sin(ωm)`. Block 128.
5. **Visual plan** — Lollipop spectrum (`LINES` + `addDisc` heads). Detected peaks annotated with text labels "C", "C+M", "C-M", "C±2M" — labels rendered as Vue overlays positioned by querying the WASM-side peak frequencies, OR as in-canvas mesh text via the AlloLib font path.
6. **A→V** — modulator amplitude → sideband peak height; mod freq → sideband horizontal spacing; mode → which peaks vanish (DC for balanced, lower for SSB).
7. **Twist** — "Tremolo→AM" sweep button — animates `f_m` from 5 Hz to 5 kHz over 10 s in log space. Side peaks emerge from carrier exactly when `f_m` crosses ~20 Hz audibility.
8. **Size** — small, ~280 LOC.
9. **Helpers** — `_studio_shared/post_fx.hpp`, `_studio_shared/automation.hpp` (sweep curve).
10. **Web-specific risks** — Procedural, **no asset risk**. STFT 8192 is the heaviest analysis size in this section — profile on the audio thread; if it exceeds budget, run the analysis FFT off-thread by handing the ring buffer to a `pthread`-free ScriptProcessor-style worker (web build is `-pthread`-free, so use audio-thread FFT and accept the cost, or downsample to STFT 4096).

### FM index explorer

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-synth-fm-index'`, `category: 'playground-synthesis'`, `subcategory: 'modulation'`.
3. **AlloLib classes** — `al::WebApp`, `gam::Sine<>` carrier+modulator (PM), `gam::ADSR<>`, `al::Parameter` (idx, ratio), `gam::STFT` (4096), Bessel J_n table (precomputed at startup), `al::Mesh` (`LINE_STRIP` time, `LINES` spectrum, `LINE_STRIP` Bessel curves), `WebControlGUI`.
4. **Audio plan** — Phase modulation `out = sin(carPhase + I·sin(modPhase))`. `I` 0..15 live. C:M ratio settable. Block 128.
5. **Visual plan** — Three viewports — top time-domain via ring buffer, middle STFT lollipops, bottom Bessel curves J_0..J_8 over I∈[0,15] with vertical playhead at current I and `addDisc` markers highlighting current Bessel values.
6. **A→V** — index `I` → playhead x → spectral lollipop magnitudes; C:M ratio → spectral spacing; carrier amplitude → time-domain envelope.
7. **Twist** — `ParameterMenu` of presets (1:1 saw-like, 1:2 square-like, 1:√2 inharmonic-bell, 3:2 voice, 5:1 brass) snaps C:M and labels current region.
8. **Size** — medium, ~500 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (peak detection), `_studio_shared/post_fx.hpp`.
10. **Web-specific risks** — Procedural, **no asset risk**. Bessel J_n precomputed once at startup, indexed by I → no per-block math.

### Granular cloud visualizer

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-synth-granular-cloud'`, `category: 'playground-synthesis'`, `subcategory: 'synthesis-spectral'` (NEW subcategory — granular is in the spectral/textural family, distinct from oscillators or simple modulation).
3. **AlloLib classes** — `al::WebApp`, `WebSamplePlayer` source, custom `Grain` struct, `gam::Hann` window, `gam::Pan<>`, `al::Mesh` `POINTS` with billboard vertex shader, `al::Texture`, `al::Parameter`, `al::ShaderProgram` (additive blending). **No `Pickable`** → `_studio_shared/web_pickable.hpp`.
4. **Audio plan** — Async scheduler: every `1/density` s spawn a grain (random source-time, pitch shift, pan, duration 10–200 ms, Hann window). **Polyphony budget for WASM: cap at 64 simultaneous (down from 256 native), profile up.** Per-block iterate, read source with linear interp, multiply window, sum to stereo. Block 128.
5. **Visual plan** — Each active grain = one vertex with custom shader: position from source-time→x, pitch→z, age→y, size attribute = amplitude, color = pitch hue, alpha = (1 − age/duration). Volumetric fog via additive blending of large-radius point sprites. Camera flies via `nav()`. **WebGL2 note: `gl_PointSize` must be set in vertex shader (transpiler.ts:14 documents this).**
6. **A→V** — grain source-time → particle x; pitch → color; amplitude → size; age → opacity; overall RMS → camera bloom strength.
7. **Twist** — "Tendency mask": user draws a 3D Bezier with `web_pickable.hpp` control points. Scheduler biases per-grain (source-time, pitch, pan) to lie within Gaussian neighborhood of the curve at current playhead progress; curve renders as faint `LINE_STRIP` through the cloud.
8. **Size** — medium, ~700 LOC.
9. **Helpers** — `_studio_shared/post_fx.hpp` (point sprites, bloom — point-sprite shader pattern), `_studio_shared/param_graph.hpp` (mask routing), `_studio_shared/automation.hpp`, `_studio_shared/web_pickable.hpp`.
10. **Web-specific risks** — **Loads sound files; needs asset packaging plan.** Default to a small (4–8 MB) shipped sample at `frontend/public/assets/mat200b/granular_source.wav` plus user-upload via `al_WebFile.hpp`. 64 simultaneous grains × 128 samples × per-grain interp = ~8k mults/block — fine. `gl_PointSize` requires shader edit if author copy-pasted from native code.

### Concatenative corpus browser

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-synth-concat-browser'`, `category: 'playground-synthesis'`, `subcategory: 'synthesis-spectral'`.
3. **AlloLib classes** — `al::WebApp`, vector of `WebSamplePlayer` (batch-loaded via `WebFile`), `gam::STFT` for MFCC/centroid/flatness, custom UMAP/t-SNE (or PCA fallback) implemented inline, **no `Pickable`** → `_studio_shared/web_pickable.hpp`, `al::Mesh` (`POINTS` scatter, `LINE_STRIP` path, `TRIANGLE_STRIP` thumbnail), `al::Texture` thumbnails, `al::Parameter`, `WebControlGUI`, optional `audioIO().channelsIn()` for live target.
4. **Audio plan** — On load, per-grain (50 ms hop) feature [13 MFCC + centroid + flatness + RMS]; reduce to 2D with t-SNE 300 iters offline (PCA fallback). Click → schedule grain; path → schedule grains along path at constant rate. Overlap-add 50 ms Hann grains, max 16 concurrent. Block 128.
5. **Visual plan** — 2D scatter (`POINTS`) colored by file ID. Hover → 64×16 RGBA waveform thumbnail texture. Drawn path = `LINE_STRIP`; current playhead is a moving handle.
6. **A→V** — clicked point → grain plays; live target feature vector → moving target dot; nearest-neighbor distance → output amplitude.
7. **Twist** — `audioIO().channelsIn()` capture; per-block target features; render moving target dot at projected 2D location (kNN interpolation in feature space). Synth schedules from nearest corpus point continuously.
8. **Size** — large, ~1100 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (MFCC + 2D dim-reduction), `_studio_shared/automation.hpp` (path = composition), `_studio_shared/web_pickable.hpp`.
10. **Web-specific risks** — **Corpus is the asset.** Ship a small (~10 MB) corpus at `frontend/public/assets/mat200b/concat_corpus/` with a manifest JSON listing files. Live mic mode requires user gesture + permission. t-SNE 300 iters at startup is one-shot but blocking — run in `onCreate` after a "Loading…" splash. Browser audio-thread can't start until user gesture, so corpus-load and t-SNE happen before audio is even unlocked, which is convenient.

### Karplus–Strong string lab

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-synth-karplus-strong'`, `category: 'playground-synthesis'`, `subcategory: 'synthesis-physical'` (NEW subcategory — physical-modeling is a distinct enough niche from oscillators/filters/modulation to warrant its own group; KS, waveguide, vocal-tract all live here).
3. **AlloLib classes** — `al::WebApp`, `gam::Delay<float, gam::ipl::Trunc>`, `gam::MovingAvg<>`, `gam::NoiseWhite<>`, `gam::OnePole<>`, `gam::Decay<>`, `al::Mesh` `LINE_STRIP`, `al::SingleRWRingBuffer`, `al::Parameter`, `WebControlGUI`, custom `Trigger` parameter.
4. **Audio plan** — Single delay line of length N=SR/freq. On pluck, fill buffer with Hanning-windowed white-noise burst at `pluckPos·N`. Output = delay tap; feedback = lowpass(delay) × damping. Brightness = lowpass cutoff. Block 128, sr from worklet (delay-line length recomputes if sr changes).
5. **Visual plan** — Each frame copy the delay line (lock-free snapshot via `SingleRWRingBuffer`) into a `LINE_STRIP` of N vertices along a horizontal string; vertex y = sample value × scale. Below: IR decay envelope `LINE_STRIP` of trailing peak amplitudes.
6. **A→V** — delay buffer contents → string vertex y (literal); pluck position → noise centroid → initial peak location; damping → IR decay rate.
7. **Twist** — Toggleable Jaffe-Smith extensions one at a time as labeled `Parameter` toggles — "Stiffness (allpass)" → cascaded `gam::AllPass1<>`; "Pickup position (comb)" → second tap; "Pick attack (lowpass burst)" → pre-filter the noise.
8. **Size** — small, ~300 LOC.
9. **Helpers** — `_studio_shared/post_fx.hpp` (string glow), `_studio_shared/automation.hpp`.
10. **Web-specific risks** — Procedural, **no asset risk**. Delay-line length depends on sr — recompute on `onCreate`. Lock-free snapshot via `al::SingleRWRingBuffer` (single-writer audio thread, single-reader graphics thread) is the right pattern; verify the header is on path.

### 1D waveguide instrument

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-synth-waveguide-1d'`, `category: 'playground-synthesis'`, `subcategory: 'synthesis-physical'`.
3. **AlloLib classes** — `al::WebApp`, dual `gam::Delay<>` lines (D+/D−), `gam::OnePole<>` bridge filter, `gam::Biquad<>` nut filter, `gam::NoiseWhite<>`, `gam::Sine<>` for bow, `al::Mesh` `LINE_STRIP` ×3, `al::Parameter`, custom `Trigger`, `al::SingleRWRingBuffer`.
4. **Audio plan** — Coupled D+/D− delay lines with reflection filters at endpoints. Per sample: `outR = bridge_filter(-D+.read(N-1)); outL = nut_filter(-D−.read(N-1)); D+.write(D−.read(N-1) + excite_R); D−.write(D+.read(0) + excite_L)`. Excitation: pluck (impulse), strike (decaying noise), bow (`gam::Sine<>` + nonlinear friction). Block 128.
5. **Visual plan** — Three `LINE_STRIP`s — top D+ (rightward), bottom D− (leftward, drawn flipped), middle sum. Animated arrows or color gradient indicate travel direction; reflections visibly bounce.
6. **A→V** — D+ contents → top line y; D− contents → bottom; sum → middle; bridge cutoff → top color saturation falloff at right end.
7. **Twist** — "Non-physical" toggle replaces bridge filter with `gam::Comb<>` or grain buffer. Labeled "WRONG" in GUI; user hears comb-resonance or shattered grains.
8. **Size** — medium, ~550 LOC.
9. **Helpers** — `_studio_shared/post_fx.hpp` (line glow, arrow shader), `_studio_shared/automation.hpp`.
10. **Web-specific risks** — Procedural, **no asset risk**. Delay-line lengths sr-dependent (same as KS). Bow excitation has feedback through nonlinearity — clamp to avoid blowup at high gains.

### Vocal tract / formant explorer

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-synth-vocal-tract'`, `category: 'playground-synthesis'`, `subcategory: 'synthesis-physical'`.
3. **AlloLib classes** — `al::WebApp`, `gam::Impulse<>` or pulse train, `gam::NoiseWhite<>`, `gam::Biquad<>` ×5 (formants F1..F5), `gam::Reson<>` alt, `gam::OnePole<>` radiation, `al::Parameter`, **no `Pickable`** → `_studio_shared/web_pickable.hpp` for the vowel-pad dot, `al::Mesh` (`LINE_LOOP` IPA quad, `LINE_STRIP` tract), `WebControlGUI`.
4. **Audio plan** — Source = mix of pulse train (voiced, ~100–200 Hz) and white noise. Cascade of 5 `Biquad<>` bandpass filters. Optional FOF mode: 5 enveloped sinusoids per glottal pulse. Block 128.
5. **Visual plan** — Left: IPA vowel quadrilateral (`LINE_LOOP`); draggable handle dot maps (x,y) → (F2, F1) within quad. Right: animated mid-sagittal vocal tract cross-section (`LINE_STRIP` of 16 segment radii) derived from pad position.
6. **A→V** — pad x → F2 → tract narrowing position; pad y → F1 → opening width; voicing → source mix → glottis-area animation.
7. **Twist** — Drop-zone for `WebSamplePlayer`; autocorrelation-based LPC order 12 on a windowed segment, root-finding → formant frequencies, loaded into cascade as editable starting points (cross-synthesis).
8. **Size** — medium, ~650 LOC.
9. **Helpers** — `_studio_shared/audio_features.hpp` (LPC root-finder), `_studio_shared/param_graph.hpp`, `_studio_shared/post_fx.hpp`, `_studio_shared/web_pickable.hpp`.
10. **Web-specific risks** — Procedural for the synth side, but the LPC twist needs a user-uploaded vowel sample (via `al_WebFile.hpp`). LPC root-finding (Bairstow / Laguerre) is one-shot, not per-block. Five cascaded biquads × stereo = trivial CPU.

### Drawn-sound canvas (UPIC clone)

1. **Title** — verbatim.
2. **Registry entry** — `id: 'pg-synth-upic-canvas'`, `category: 'playground-synthesis'`, `subcategory: 'synthesis-spectral'` (the canvas IS the score and the timbre is per-stroke — sits with granular/concat as a score-as-control example).
3. **AlloLib classes** — `al::WebApp`, custom `Stroke` struct (sampled (t, freq) points + timbre id), `gam::Sine<>` per active stroke (pooled, max 32), `gam::Biquad<>` (BP for noise mode), `gam::NoiseWhite<>`, `gam::Env<2>`, `al::Mesh` `LINE_STRIP` per stroke, `al::Parameter`, `ParameterMenu` for timbre, `al::SingleRWRingBuffer`, mouse via `App::onMouseDrag`.
4. **Audio plan** — Active strokes (covering playhead) drive one oscillator each. Per audio sample: linear-interp stroke at current t for (freq, amp), set oscillator. Up to 32 simultaneous (well under WASM polyphony budget). Timbres: sine, sawtooth wavetable, BP-filtered noise. Block 128.
5. **Visual plan** — Scrolling horizontal canvas; x = time, y = log-frequency. Each stroke `LINE_STRIP` colored by timbre. Vertical playhead `LINES`. Faint octave gridlines.
6. **A→V** — stroke y at playhead → osc frequency; pen pressure (mouse drag speed proxy) → amp envelope; stroke color → timbre selection.
7. **Twist** — Per-stroke "noisiness" attribute (0..1) drawn with modifier key. Output = `(1−n)·sine + n·BP_noise(BP_center=stroke_freq, Q=5)`. Single stroke can morph from pitched glissando to noise band along its length.
8. **Size** — medium, ~600 LOC.
9. **Helpers** — `_studio_shared/automation.hpp` (canvas IS the score), `_studio_shared/post_fx.hpp`, `_studio_shared/param_graph.hpp`, `_studio_shared/draw_canvas.hpp` (mouse-drag stroke capture).
10. **Web-specific risks** — Procedural, **no asset risk**. `App::onMouseDrag` preserved by transpiler. Mouse-pressure proxy via drag speed is fine; if the device has a stylus, browser gives PointerEvent.pressure but this isn't surfaced through GLFW — would require a Vue-side pointer listener forwarding pressure into a `Parameter`.

---

## Summary of helpers grown by this plan

A new shared-helper directory `allolib-wasm/include/_studio_shared/` is established (mirroring the native plan's `tutorials/_shared/`). It holds:

- **`audio_features.hpp`** — RMS, peak, ZCR, centroid, flatness, rolloff85, pitchHz (autocorrelation), MFCC×13, magBands×32, K-weighting biquads + ITU-R BS.1770-4 short-term LUFS + true-peak (4× oversampler), third-octave binner, mid/side decomposition, PLR/PSR, alignment cross-correlator, peak picking, dominant-band detector, LPC root-finder, MFCC+kNN classifier, plus shared plugin classes (Compressor, Gate, Saturator, Limiter — added to back 1.5.2 / 1.5.8 / 1.5.9).
- **`param_graph.hpp`** — visible patch graph on top of `al::Parameter`.
- **`automation.hpp`** — record/playback automation lanes serialized to IDBFS, with a `WeaknessMap` submodule for 1.5.9 / 1.5.11.
- **`post_fx.hpp`** — phosphor decay, bloom, chromatic aberration, glitch, vignette, LED glow, Gaussian splat, stripe-overlap (collision rendering), point-sprite + line-glow shaders.
- **`draw_canvas.hpp`** — `onMouseDown/Drag/Up`, clear, sample-at, sample-column, **plus parametric-curve renderer with handle hit-testing** added for 1.5.10 / 1.5.11 EQ canvases.
- **`web_pickable.hpp`** — manual-hit-test substitute for `cookbook/pickable/`. New for the WASM build (no equivalent in the native plan).
- **`util.hpp`** — small SPSC ring buffer wrapper + atomic-snapshot helpers (used wherever `al::SingleRWRingBuffer` may not be on path).

The MFCC + kNN classifier and the K-weighted LUFS + true-peak cluster of `audio_features.hpp` grew specifically because of the 1.5 entries; same for `draw_canvas.hpp`'s parametric EQ renderer and `automation.hpp`'s `WeaknessMap`.

---

## 3. Section 3 — Signal Processing

### Studio Online linkage findings (verified against `allolib-wasm/CMakeLists.txt`)

Before per-entry plans, three blocking facts:

- **`al::Convolver`** — *not present* in Studio Online. The native plan points to `al_ext/spatialaudio/al_Convolver.hpp` (zita-convolver wrapper, partitioned FFT). The `al_ext/` tree is **not vendored** into `C:\Users\lpfre\Allolib-Studio-Online\` at all (`find` returns no `al_Convolver*` under the repo root); only the upstream copy under `C:\Users\lpfre\allolib_playground\al_ext\spatialaudio\` exists. Even if the header were copied in, neither the source `al_Convolver.cpp` nor the zita-convolver dependency is in `ALLOLIB_SOURCES`/`WEB_SOURCES` in `allolib-wasm/CMakeLists.txt`. **Status: Phase 0 port required.** Two viable paths: (a) port the zita wrapper — non-trivial, FFT internals call out to platform routines; or (b) hand-roll a small partitioned-FFT convolver on top of `gam::DFT` (which *is* compiled, see below). Recommendation: option (b), wrap as `_studio_shared/PartConvolver.hpp` (~250 LOC), since `gam::DFT` is already linked and the partitioned-OLA loop is well-known.
- **`gam::HRFilter`** — header lives in `allolib/external/Gamma/Gamma/HRFilter.h` and is **header-only** (no `HRFilter.cpp` exists upstream). It depends only on `Gamma/Filter.h`, `Gamma/Spatial.h`, `Gamma/Types.h`, all of which are present in the Gamma include path used by the WASM build. The implementation is a parametric Iida-2007 model — it does **not** load a SOFA database, so no asset shipping is required. **Status: should compile; needs a smoke test as part of S3 Phase 0.** Add a one-screen `pg-hrtf-smoke` example that pans a click around the listener and prints L/R RMS — confirms WASM linker accepts the template instantiations.
- **`gam::STFT` MAG_PHASE / MAG_FREQ** — the header is `Gamma/DFT.h`; `${GAMMA_DIR}/src/DFT.cpp` is in `GAMMA_SOURCES` and `FFT_fftpack.cpp` + `fftpack++1.cpp` + `fftpack++2.cpp` are also linked. **Status: confirmed available**. Both MAG_PHASE (used by Phase vocoder lab and Spectrogram painter for inverse-STFT) and MAG_FREQ (used by Allpass dispersion to recover phase) round-trip correctly in WASM.
- **`al::Pickable`** — cookbook helper. The `cookbook/` tree from `allolib_playground` is **not** in the Studio Online repo. Status: not available; either port a minimal `_studio_shared/Pickable.hpp` (~150 LOC: ray-vs-bbox + drag-plane projection) or fall back to raw `App::onMouseDown/onMouseDrag/onMouseUp` (already present in `al_WebApp.hpp:137,139`). Recommendation: ship a thin `Pickable.hpp` in `_studio_shared/` since *Subtractive z-plane*, *IR-builder reverb*, *HRTF source point*, *Granular tendency mask*, and *Generative graphic score* all want it.

### Audio-block-size addendum

The native plan specifies block sizes of 256 / 512 throughout. In Studio Online the **Web Audio worklet's `process()` callback is fixed at 128 frames** (`frontend/public/allolib-audio-processor.js:199` reads `output[0].length`). The runtime puts a queue between the WASM `onSound` callback and the worklet, so `configureAudio(rate, 128, 2, …)` is the correct call from C++ for *all* entries below: each `onSound` invocation must process exactly 128 samples. Larger STFT windows still work — they just span multiple `onSound` calls, accumulating in the STFT's internal buffer. Sample rate comes from `audioContext.sampleRate` (typically 48 kHz, occasionally 44.1 kHz on Linux); use `audioIO().framesPerSecond()` rather than hardcoding.

---

### 3.1 Live compressor with transfer curve

1. **Title:** Live compressor with transfer curve
2. **Registry entry:**
   ```ts
   { id: 'pg-compressor-transfer', title: 'Compressor with Transfer Curve',
     description: 'Live compressor with dB-dB transfer plot, GR meter, and before/after waveforms',
     category: 'playground-synthesis', subcategory: 'dsp-dynamics', code: '...' }
   ```
   Category placement: `playground-synthesis` (DSP-driven, no scene/3D component dominant). Subcategory `dsp-dynamics` keeps it grouped with future limiter/expander entries.
3. **AlloLib classes:** `WebApp` (auto-rewritten from `App` by `transpiler.ts`), `WebControlGUI` (via `al_playground_compat.hpp`), `Parameter`, `Mesh` LINE_STRIP+TRIANGLES, `gam::EnvFollow<>` for RMS, `gam::OnePole<>` for release smoothing, `gam::Sine<>`/`gam::SamplePlayer<>` (Web variant `WebSamplePlayer`) for source. No mic input in v1 (audio input through the worklet is not wired today; v2 hook).
4. **Audio plan:** `configureAudio(audioIO().framesPerSecond(), 128, 2, 0)`. Block 128 means RMS window must be expressed in samples per `EnvFollow` time-constant, not blocks. Computed entirely per-sample inside `while(io())`. PSR window of 256 samples now spans 2 worklet blocks — accumulate in a small ring carried across calls.
5. **Visual plan:** All four primitives (Mesh, Texture, EasyFBO, ShaderProgram) work via WebGL2 (`ALLOLIB_WEBGL2=1`). The transfer curve is a static LINE_STRIP plus two animated dots (`addDisc`); GR meter is a TRIANGLES quad. No FBO needed.
6. **A→V coupling:** unchanged (input RMS → X-dot, smoothed output gain → Y-dot, instantaneous reduction → meter, raw samples from `SingleRWRingBuffer` → before/after lines).
7. **Twist:** unchanged. PSR ratio overlay rectangle is plain Mesh.
8. **Size:** ~350 LOC (unchanged).
9. **Helpers:** `_studio_shared/audio_features.hpp` (RMS+peak module). Same path convention used by Phase 1 in the source plan; for Studio Online use `allolib-wasm/include/_studio_shared/`.
10. **Web-specific risks:** **Low.** Mic-input fallback for v2 needs the worklet's `inputs[]` plumbed through to WASM — that channel exists in the Web Audio API but is not currently routed. Acceptable to ship file-only first.

### 3.2 Phase vocoder lab

1. **Title:** Phase vocoder lab
2. **Registry entry:** `id: 'pg-phasevocoder-lab', category: 'playground-synthesis', subcategory: 'dsp-spectral'`. Synthesis-leaning because the lab's centerpiece is the resynthesis brush; spectral subcategory groups with Spectrogram painter.
3. **AlloLib classes:** `WebApp`, `Texture` (RGBA32F), `EasyFBO`, `ShaderProgram` (custom GLSL ES 3.0 — `ALLOLIB_WEBGL2=1` plus `-sFULL_ES3=1` enables float textures + `texelFetch`), `WebControlGUI`, `Parameter`, `gam::STFT` (MAG_PHASE forward+inverse — verified), `WebSamplePlayer` source. Needs `_studio_shared/PVResynth.hpp`.
4. **Audio plan:** FFT 2048, hop 512, Hann, 75 % overlap. With worklet block = 128, each `onSound(io)` feeds 128 samples into `STFT::operator()(float)`; STFT internally buffers and emits a frame every 512 samples (every 4 worklet calls). Inverse path runs on the same callback. The phase-advance buffer is per-bin (size 1024), updated when frames are emitted, not on every sample.
5. **Visual plan:** Sonogram texture is `Texture::INTERNAL_FORMAT = GL_RGBA32F` — supported on WebGL2 with `EXT_color_buffer_float`. Viridis colormap via fragment-shader lookup table (1×256 RGB texture or hardcoded `mix()` chain). EasyFBO double-buffer ping-pongs between brush layer and sonogram. Confirmed: `al_EasyFBO_Web.cpp` is in `WEB_SOURCES`, and `al_FBO_Web.cpp` routes WebGL2 framebuffers normally.
6. **A→V coupling:** unchanged. Brush in time-bin space writes into the bin buffer; playhead column drives playback frame index.
7. **Twist:** unchanged (record `EditEvent` to `std::vector`, replay at recorded wall-clock offsets).
8. **Size:** ~900 LOC (unchanged).
9. **Helpers:** **`_studio_shared/PVResynth.hpp`** is load-bearing for both this entry and Spectrogram painter (3.4 below) — STFT round-trip with editable bin buffer + per-bin phase-advance accumulator. ~180 LOC header-only. Plus `_studio_shared/audio_features.hpp` for transient detection in the freeze brush.
10. **Web-specific risks:** **Medium.** Three concerns: (a) `gam::STFT` MAG_PHASE round-trip in WASM — confirmed via header inspection (`STFT::accumPhases()` writes to `mAccums`, populated only in MAG_FREQ mode; MAG_PHASE uses `mPhases`, populated unconditionally). Smoke test: identity round-trip should return input within ε; if it doesn't, something is mis-strided. (b) RGBA32F texture upload via `Texture_Web.cpp` — needs verification with a tiny test that writes 32-bit floats and reads them back via `glReadPixels`. (c) Worklet block of 128 vs hop 512: each STFT frame straddles 4 callbacks; ensure `gam::STFT::operator()(float input)` returns true exactly once per 512 input samples and that the inverse side accumulates correctly through the 75 % overlap.

### 3.3 Comb filter swept-delay visualizer

1. **Title:** Comb filter swept-delay visualizer
2. **Registry entry:** `id: 'pg-comb-swept', category: 'playground-synthesis', subcategory: 'dsp-filters'`.
3. **AlloLib classes:** `WebApp`, `Mesh` LINE_STRIP×2, `WebControlGUI`, `gam::Comb<>`, `gam::LFO<>`, `gam::STFT` (analysis-only, MAG), `gam::NoiseWhite<>`. All linked.
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. Comb delay D modulated by LFO 0.05–5 Hz. STFT 1024/256. Theoretical analytic response evaluated 512 ω-points per animation frame (~30 Hz update) on the graphics thread, not audio thread — no extra cost in `onSound`.
5. **Visual plan:** Two LINE_STRIPs, alpha-blended. Standard Mesh on WebGL2 — works.
6. **A→V coupling:** unchanged.
7. **Twist:** unchanged (second Comb at 0.31 Hz vs 0.29 Hz for flange interference; envelope-variance threshold highlights flange emergence).
8. **Size:** ~300 LOC.
9. **Helpers:** `_studio_shared/audio_features.hpp` (envelope variance — small RMS-of-RMS).
10. **Web-specific risks:** **Low.** Animation frame budget is the only concern: 512-point response evaluation per animation frame is fine on desktop browsers but may stutter on mobile. Optional: precompute response in audio thread on parameter-change events (rate-limited).

### 3.4 Allpass dispersion plot

1. **Title:** Allpass dispersion plot
2. **Registry entry:** `id: 'pg-allpass-dispersion', category: 'playground-synthesis', subcategory: 'dsp-filters'`.
3. **AlloLib classes:** `WebApp`, `Mesh`, `WebControlGUI`, `gam::AllPass1<>` and/or `gam::Biquad<>` cascade ×8, `gam::STFT` (for phase), `SingleRWRingBuffer` (already used in playground; pattern from `cookbook/av/audioToGraphics.cpp`). All linked.
4. **Audio plan:** Block 128. On user trigger, fire single-sample impulse into cascade; capture next 4096 samples (32 worklet blocks) into ring buffer. Run STFT MAG_PHASE on that capture to recover phase, numerically differentiate for group-delay τ(ω).
5. **Visual plan:** Two-panel Mesh. Phase→hue is computed CPU-side; per-sample HSV color in vertex stream. Standard.
6. **A→V coupling:** unchanged.
7. **Twist:** unchanged (A/B against flat-magnitude Biquad chain; "magnitude difference < 0.1 dB" badge).
8. **Size:** ~280 LOC.
9. **Helpers:** small `_studio_shared/phase_color.hpp` (analytic-signal phase → HSV — ~30 LOC); shared with Phase vocoder.
10. **Web-specific risks:** **Low–Medium.** Phase decoding accuracy: `gam::STFT::phases()` returns *current analysis phases* per the header comment, but only documented as populated for MAG_FREQ format. Using MAG_PHASE the magnitude/phase bins land in successive slots of `bins()` (real= mag, imag = phase) — this is the documented contract and should round-trip. Add a unit-test scratch example (`pg-stft-phase-smoke`) that forwards a chirp and prints recovered phase vs `atan2` of complex bins, to confirm before shipping.

### 3.5 Convolution playground

1. **Title:** Convolution playground
2. **Registry entry:** `id: 'pg-convolution-playground', category: 'playground-synthesis', subcategory: 'dsp-spectral'`.
3. **AlloLib classes:** `WebApp`, `SingleRWRingBuffer`, `Mesh`, `Texture`, `WebControlGUI`, **`PartConvolver`** (*new*, hand-rolled — see Phase 0 finding above; replaces `al::Convolver`), `WebSamplePlayer`. No mic in v1.
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. Partitioned-FFT convolver: choose partition size = 512 (4 worklet blocks). For each input block, accumulate into FIFO; when FIFO has 512 samples, run forward FFT, multiply by frequency-domain partitioned IR, IFFT, overlap-add. The 4-block latency is acceptable. IR length up to 2 s (96 000 samples at 48 kHz = 188 partitions of 512).
5. **Visual plan:** Three vertical panels of Mesh LINE_STRIPs + a sliding-window highlight quad. `Texture` only used for waveform thumbnail render; standard WebGL2.
6. **A→V coupling:** unchanged.
7. **Twist:** **Modified for web.** "Live-mic IR mode" deferred — needs worklet input plumbing. Replacement twist: a "grain-cloud IR builder" — render a configurable grain cloud offline into a buffer, swap as IR with a fade. Same conceptual hit (any sound becomes an IR) without mic dependency.
8. **Size:** ~600 LOC (unchanged) plus ~250 LOC for `PartConvolver.hpp` (Phase 0).
9. **Helpers:** `_studio_shared/PartConvolver.hpp` (the Phase 0 substitute), `_studio_shared/audio_features.hpp`.
10. **Web-specific risks:** **High** *until* `PartConvolver.hpp` ships. Once it does, risk drops to medium (IR-load latency on `Convolver::loadIR()` analog — repartitioning a 2 s IR is a few-ms job; should run on graphics thread, hand off via atomic pointer swap).

### 3.6 IR-builder reverb

1. **Title:** IR-builder reverb
2. **Registry entry:** `id: 'pg-ir-builder-reverb', category: 'playground-audiovisual', subcategory: 'dsp-spatial'`. Audiovisual because the room-with-reflectors view is the centerpiece UI.
3. **AlloLib classes:** `WebApp`, `WebControlGUI`, `_studio_shared/Pickable.hpp` (port note above), `Mesh`, **`PartConvolver`** (same as 3.5).
4. **Audio plan:** Block 128. Image-source method runs offline on the graphics thread when reflector positions change: build IR (2 s @ rate, ~96 k samples), partition it, atomic-swap the convolver's frequency-domain IR. Audio thread sees no DSP cost on user drags besides the pointer swap.
5. **Visual plan:** Top-down room view = quad mesh + Pickable-wrapped polygons. Source/listener = `addDisc`. Ray paths = LINES. IR strip below = LINE_STRIP. All WebGL2-native.
6. **A→V coupling:** unchanged.
7. **Twist:** unchanged ("Reverse" toggle, "Synthetic IR" Schroeder button).
8. **Size:** ~750 LOC.
9. **Helpers:** `PartConvolver.hpp`, `_studio_shared/Pickable.hpp`, `_studio_shared/post_fx.hpp` (room shader, ray glow — needs the small post_fx helper from Section 0; defer until Phase 1 of S3).
10. **Web-specific risks:** **High** until `PartConvolver` *and* `Pickable` ship. Pickable port is the smaller of the two — 2D drag-plane projection only (this entry doesn't need 3D ray-vs-mesh).

### 3.7 Granulation time-stretcher

1. **Title:** Granulation time-stretcher
2. **Registry entry:** `id: 'pg-granul-stretch', category: 'playground-audiovisual', subcategory: 'dsp-grain'`.
3. **AlloLib classes:** `WebApp`, `Mesh`, `WebControlGUI`, `WebSamplePlayer` (random access — confirm interface supports sample-accurate seek; if not, fall back to direct buffer indexing on a loaded `std::vector<float>`), `gam::AD<>` per grain, custom `Grain` POD pool.
4. **Audio plan:** Block 128, 64 grains, synchronous overlap-add. Per-block iterate active grains; per-sample sum. Standard.
5. **Visual plan:** Two horizontal axes of LINE/TRIANGLE meshes. WebGL2-native.
6. **A→V coupling:** unchanged.
7. **Twist:** unchanged (onset detector protects attack regions; red brackets on source axis).
8. **Size:** ~400 LOC.
9. **Helpers:** `_studio_shared/audio_features.hpp` (onset detection: highpass + EnvFollow derivative + threshold).
10. **Web-specific risks:** **Low.** Sole concern is `WebSamplePlayer` random-access semantics; verify by direct read on `frontend/src/data/playgroundExamples.ts` patterns or fall back to raw buffer.

### 3.8 Waveshaper distortion explorer

1. **Title:** Waveshaper distortion explorer
2. **Registry entry:** `id: 'pg-waveshaper-explorer', category: 'playground-synthesis', subcategory: 'dsp-nonlinear'`.
3. **AlloLib classes:** `WebApp`, `Mesh`, `WebControlGUI`, `gam::Sine<>`, `gam::STFT` (analysis), 1024-point LUT as `std::array<float,1024>`, optional `gam::Upsample`/`Downsample` for 2× oversampling.
4. **Audio plan:** Block 128. Per-sample LUT lookup with linear interp; 2× oversample optional. Cheap.
5. **Visual plan:** Drawable curve (Studio Online lacks `_studio_shared/draw_canvas.hpp` — needs to be ported alongside; it's flagged as a Phase 1 helper in the source plan and is also needed by Spectrogram painter, Synchromy paint mode, and Generative graphic score). For now, simplest impl: capture mouse via `onMouseDrag`, write directly into LUT array, no separate canvas helper.
6. **A→V coupling:** unchanged.
7. **Twist:** unchanged (`ParameterMenu` of presets including Chebyshev-N solver).
8. **Size:** ~350 LOC.
9. **Helpers:** `_studio_shared/draw_canvas.hpp` (or inline mouse-capture as fallback), `_studio_shared/post_fx.hpp` (lollipop plot — generic enough to inline).
10. **Web-specific risks:** **Low.** Chebyshev solver is pure math, ~50 LOC. ParameterMenu must be rendered through Vue's `ParameterPanel` (Studio Online stubs ImGui per `al_playground_compat.hpp` comments) — needs a `Parameter` enum-style binding; verify `WebControlGUI` supports menu-style parameters or ship as integer+labels.

### 3.9 Spatializer with HRTF + visualization

1. **Title:** Spatializer with HRTF + visualization
2. **Registry entry:** `id: 'pg-hrtf-spatializer', category: 'playground-audiovisual', subcategory: 'dsp-spatial'`.
3. **AlloLib classes:** `WebApp`, `Mesh` (`addSphere` for head), `_studio_shared/Pickable.hpp` (3D drag this time — needs ray-vs-bbox), `WebControlGUI`, **`gam::HRFilter`** (header-only, available — see top of section). One filter pair (L/R) — the HRFilter encapsulates both ears internally per its `pos()` API.
4. **Audio plan:** Block 128. Source position → `HRFilter::pos(sourcePos, headPose)` once per block (or once per drag event); per-sample evaluate. ITD = `(d_R − d_L) / c` from `mDist` distances; ILD = 20·log10(rms_R/rms_L) over a sliding 1024-sample window (8 worklet blocks).
5. **Visual plan:** 3D scene — sphere head, two ear cones (small `addCone`), Pickable source point, two LINE_STRIP waveforms from L/R ring buffers. ImGui HUD replaced by `WebControlGUI` text fields (live-updating Parameter readouts).
6. **A→V coupling:** unchanged.
7. **Twist:** modified — Doppler stays (uses `gam::Delay` with time-varying read pointer; linked). Path-recorder requires a 60 Hz sampling thread; in Studio Online use `onAnimate(dt)` callback (already runs at requestAnimationFrame ≈ 60 Hz).
8. **Size:** ~550 LOC.
9. **Helpers:** `_studio_shared/Pickable.hpp` (3D variant), `_studio_shared/automation.hpp` (path recording — wraps `std::vector<Vec3f>` + simple playback), `_studio_shared/param_graph.hpp` if the user wants visible source→ear routing diagrams.
10. **Web-specific risks:** **Medium.** HRFilter compiles in theory (deps satisfied) but is *unexercised* in any other example in the WASM build. Risk: a missing template instantiation in `Gamma::Filter<float>` or `Gamma::Reson<float>` for the configs HRFilter uses, surfacing only at link time. Mitigation: dedicated 50-LOC `pg-hrtf-smoke` example built and run before this entry — clicks from −90° to +90° az and prints L/R RMS difference.

---

## 4. Section 4 — Visual Music / Tight A/V Coupling

### 4.1 Synesthetic mapper

1. **Title:** Synesthetic mapper
2. **Registry entry:** `id: 'pg-synesthetic-mapper', category: 'playground-audiovisual', subcategory: 'av-feature-driven'`.
3. **AlloLib classes:** `WebApp`, `WebControlGUI`, `Parameter` (multi-instance, used as menus — see 3.8 risk note about `ParameterMenu` rendering), `Mesh`, `WebSamplePlayer`, `gam::STFT` (centroid/flatness), `gam::ZeroCross<>`, `gam::EnvFollow<>` (RMS).
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. Per-block feature vector: RMS, spectral centroid `Σk·|X[k]|/Σ|X[k]|` (computed every STFT frame ≈ every 512 samples = every 4 blocks), ZCR, flatness, optional pitch (autocorrelation, deferred). Publish a thread-safe `FeatureVector` (a struct of `std::atomic<float>` × 6) every block.
5. **Visual plan:** 3D scene with N glyphs (sphere/cube/ribbon). All standard Mesh primitives — fully WebGL2.
6. **A→V coupling:** unchanged. Routing-table grid is the score; saves to JSON via `_studio_shared/automation.hpp`.
7. **Twist:** unchanged. JSON save/load uses `nlohmann/json.hpp` (already included by `al_playground_compat.hpp`).
8. **Size:** ~450 LOC.
9. **Helpers:** **`_studio_shared/audio_features.hpp`** — this entry is the helper's showcase. Plus `_studio_shared/param_graph.hpp` for the visible mapping table (or render as Vue HTML if the C++ side gets too noisy; long-term cleaner).
10. **Web-specific risks:** **Low.** ParameterMenu rendering is the only fragile spot — see 3.8 risk for shared mitigation.

### 4.2 McLaren Synchromy

1. **Title:** McLaren Synchromy
2. **Registry entry:** `id: 'pg-synchromy', category: 'playground-audiovisual', subcategory: 'av-tight-coupling'`.
3. **AlloLib classes:** `WebApp`, `Texture` (RGBA8, 256w × 8192h), `ShaderProgram` (GLSL ES 3.0 for the scanline display), `EasyFBO` (paint layer), `WebControlGUI`. *No audio synth* — audio derives from pixel reads.
4. **Audio plan:** Block 128. The audio thread reads a row of bytes from a `std::shared_ptr<std::vector<uint8_t>>` mirror of the texture, indexed by an `std::atomic<int>` row. 1-pixel-wide mode: `sample = (pixel.r/255.f * 2.f − 1.f)`. Multi-pixel mode: row → 32-bin amp array → 32 sines summed. 48 kHz typical; row index advances at user-set `pixelsPerSecond`. Per-block 128 samples × 1–32 sine reads is well within budget.
5. **Visual plan:** Vertical canvas, fullscreen Mesh quad sampled by ShaderProgram. Mouse paint writes both into the GPU texture (via `texSubImage2D` from `Texture::submit()`) and into the shared CPU mirror — same byte buffer, two writers. WebGL2-native.
6. **A→V coupling:** **identity** (the whole point of the entry).
7. **Twist:** unchanged (built-in by design).
8. **Size:** ~300 LOC.
9. **Helpers:** **`_studio_shared/PixelAudioBridge.hpp`** — the load-bearing helper for this entry. Encapsulates `std::shared_ptr<std::vector<uint8_t>>`, `std::atomic<int> rowIndex`, `width × height`, and a `readRow(uint8_t* dst)` that's lock-free for the audio thread. ~80 LOC. Also used by Lissajous draw mode (4.3). Plus `_studio_shared/post_fx.hpp` for the scanline shader (or inline GLSL).
10. **Web-specific risks:** **Low.** RGBA8 texture upload from CPU mirror is the routine path through `al_Texture_Web.cpp`.

### 4.3 Lissajous oscilloscope synth

1. **Title:** Lissajous oscilloscope synth
2. **Registry entry:** `id: 'pg-lissajous', category: 'playground-audiovisual', subcategory: 'av-tight-coupling'`.
3. **AlloLib classes:** `WebApp`, `Texture` (16-bit float HDR — `GL_RGBA16F` works on WebGL2 with `EXT_color_buffer_float`; degrades to RGBA8 with mild banding if the extension is missing), **two** `EasyFBO` (ping-pong decay), `ShaderProgram` (custom GLSL ES 3.0 for phosphor + bloom + chromatic aberration), `SingleRWRingBuffer`, `WebControlGUI`, `gam::Sine<>` ×2, `gam::LFO<>`.
4. **Audio plan:** Block 128 (already preferred for low XY latency in source plan; web-aligned). Two sines, ratio snap, phase offset. L/R written into a 4096-sample ring; drained per animation frame.
5. **Visual plan:** Phosphor decay shader runs on GPU. The pipeline is exactly the WebGL2 + custom ShaderProgram path that's been validated by the test suite (per CLAUDE.md "WebGPU compatibility / All 8 phases complete — textures, lighting, EasyFBO …"). Confirmed: `EasyFBO` + bound `ShaderProgram` work.
6. **A→V coupling:** identity at audio rate (L=X, R=Y).
7. **Twist:** unchanged. **Drawing mode** uses `_studio_shared/PixelAudioBridge.hpp` (same helper as Synchromy) but interpreted as "samples-from-curve" rather than "samples-from-row". Snap-to-Fourier-fit computes 16 complex coefficients via small FFT; cheap.
8. **Size:** ~500 LOC.
9. **Helpers:** **`_studio_shared/post_fx.hpp` (phosphor shader)** is the killer reuse. **`_studio_shared/PixelAudioBridge.hpp`** for draw-mode path. `_studio_shared/automation.hpp` for ratio sweeps.
10. **Web-specific risks:** **Low–Medium.** GLSL ES 3.0 phosphor shader: `texelFetch` and `texture()` both available; `mix(prev * decayFactor, curr, …)` is one-liner. Floating-point render targets are the only hardware variable — if `EXT_color_buffer_float` is not available (rare on desktop 2026, common on older mobile), fall back to RGBA8 with a slight loss in HDR bloom range.

### 4.4 Spectrogram painter

1. **Title:** Spectrogram painter
2. **Registry entry:** `id: 'pg-spectrogram-painter', category: 'playground-audiovisual', subcategory: 'av-tight-coupling'`.
3. **AlloLib classes:** `WebApp`, `Texture` (RGBA32F: R=mag, G=phase), `EasyFBO`, `ShaderProgram`, `WebControlGUI`, `gam::STFT` (MAG_PHASE inverse — confirmed). Shares **`_studio_shared/PVResynth.hpp`** with 3.2 Phase vocoder lab.
4. **Audio plan:** Block 128. Texture rows = freq bins (256 log-mel), cols = time slices (1024). Audio thread reads column at playhead, hands magnitudes (and phases or randomized phases) into PVResynth's bin buffer; PVResynth runs inverse-STFT with overlap-add. Hop 512 (4 worklet blocks per frame).
5. **Visual plan:** Fullscreen paintable RGBA32F texture; vertical playhead via Mesh LINES. Brush controls = `WebControlGUI` parameters; brush splat is a Gaussian fragment-shader pass into the EasyFBO. Same float-texture caveat as 3.2.
6. **A→V coupling:** texel R = bin magnitude, texel G = bin phase, playhead column = time pointer.
7. **Twist:** "Import image" — `WebImage` (Studio Online has `al_WebImage.hpp` per the include directory listing) loads PNG, downsample to 256×1024 on CPU, optional mel-warp `mel(f) = 2595·log10(1 + f/700)` on the y-axis as a one-line shader. Works.
8. **Size:** ~450 LOC.
9. **Helpers:** **`_studio_shared/PVResynth.hpp`** (shared), `_studio_shared/post_fx.hpp` (brush shader), `_studio_shared/audio_features.hpp` (default brush color from spectral centroid of a load-time sample).
10. **Web-specific risks:** **Medium.** Same risks as Phase vocoder lab — RGBA32F upload + STFT MAG_PHASE round-trip — plus the additional brush-paint compositing which uses an extra EasyFBO. All known-working on the WebGL2 backend per the existing test suite.

### 4.5 Additive geometry

1. **Title:** Additive geometry
2. **Registry entry:** `id: 'pg-additive-geometry', category: 'playground-audiovisual', subcategory: 'av-tight-coupling'`.
3. **AlloLib classes:** `WebApp`, `Mesh`, `WebControlGUI`, `gam::Sine<>` × 16, `std::array<std::atomic<float>,16> partialAmps`. Pure compute; no Texture, no FBO, no shader.
4. **Audio plan:** Block 128. 16 sines summed per sample. `partialAmps` is the sole shared state — both threads read from the same `std::atomic<float>` array (the entry's whole point).
5. **Visual plan:** Per-frame rebuild parametric vertex array `(θ,φ) → r = Σ a_n · cos(n·θ)` (or spherical-harmonic equivalent), reupload via `Mesh::vertices()` + recompute normals via `Mesh::generateNormals()`. WebGL2-native; no shader work needed.
6. **A→V coupling:** **single coefficient vector → both modalities**. Slider `a_n` ↑ → harmonic n louder *and* mesh lobe count visibly increments.
7. **Twist:** the implementation *is* the twist (atomic-shared array). "Scope" mode draws time-domain sum next to mesh cross-section at θ=0 — visibly the same curve.
8. **Size:** ~500 LOC.
9. **Helpers:** `_studio_shared/param_graph.hpp` (optional, for visible coefficient routing).
10. **Web-specific risks:** **Lowest in the section.** Pure compute, well-trodden Mesh path. Should be Phase-2 validation candidate as it isolates "atomic between threads" + "mesh rebuild every frame" from any Texture/FBO/shader dependency.

### 4.6 Real-time concatenative AV

1. **Title:** Real-time concatenative AV
2. **Registry entry:** `id: 'pg-concat-av', category: 'playground-audiovisual', subcategory: 'av-feature-driven'`.
3. **AlloLib classes:** `WebApp`, `Texture` (or atlas), `ShaderProgram` (crossfade), `WebControlGUI`, `gam::STFT` for live features, `WebSamplePlayer` for target audio. **Plus** an `EM_ASM`-driven `<video>` bridge — see risks.
4. **Audio plan:** Same as native: every block (128 samples) compute MFCC vector, KNN brute force against ~1000 corpus frames, schedule grain. PCA-on-MFCC scatter overlay precomputed offline.
5. **Visual plan:** A new helper `_studio_shared/VideoTexture.hpp` is required. Implementation sketch: an `EM_ASM` block creates an HTML `<video>` element, sets `src`, calls `play()`. On each `onAnimate(dt)`, JavaScript glue calls `gl.texSubImage2D(GL_TEXTURE_2D, 0, 0, 0, GL_RGBA, GL_UNSIGNED_BYTE, videoElement)` directly into an `al::Texture`. Emscripten's WebGL bindings support `HTMLVideoElement` as a texSubImage2D source via `EMSCRIPTEN_GL_TEXTURE_FROM_VIDEO_ELEMENT` (or by passing the video element through JS glue and using raw `GL_TEXTURE_2D` upload). Round-trip: video → JS-side `<video>` element → GL texture → fragment shader → fullscreen quad.
6. **A→V coupling:** identity at frame index — same `frame_idx` chooses both audio buffer and displayed texture.
7. **Twist:** **scoped down** for v1 — *image corpus only* (1000-image set, no video). All audio behavior unchanged; visual just swaps still images per frame index. v2 promotes to `<video>` once `VideoTexture.hpp` is hardened. v3 (out of scope here) adds offline FFmpeg analysis path for arbitrary user uploads.
8. **Size:** ~1100 LOC for full video version; ~600 LOC for image-corpus v1.
9. **Helpers:** `_studio_shared/audio_features.hpp` (MFCC + KNN), `_studio_shared/param_graph.hpp`, `_studio_shared/post_fx.hpp` (crossfade shader), and the new `_studio_shared/VideoTexture.hpp` (v2).
10. **Web-specific risks:** **HIGHEST IN THE PLAN.** AlloLib has no native video reader; Studio Online does not bundle FFmpeg. The `<video>`+`texSubImage2D` path works in principle but has three uninvestigated areas: (a) frame-accurate seek (HTMLVideoElement seeking is asynchronous; precise frame correspondence to audio buffer requires the video to be re-encoded with keyframes every frame, or accept ±1 frame jitter); (b) cross-origin video sources require CORS headers — for v1 ship the video as a same-origin asset under `frontend/public/`; (c) MFCC analysis of *the video's own audio track* requires Web Audio's `MediaElementAudioSourceNode` → worklet routing, which is currently not wired (target audio is fine because it's a regular `WebSamplePlayer`). Recommend shipping v1 as image-corpus + `WebSamplePlayer` target; defer the `<video>` path to a follow-up. **This is the one entry across both sections that should be explicitly de-scoped for the first ship.**

### 4.7 Generative graphic score

1. **Title:** Generative graphic score
2. **Registry entry:** `id: 'pg-graphic-score', category: 'playground-audiovisual', subcategory: 'av-tight-coupling'`. (Could go in a new `playground-sequencing` category if Studio Online wants to mirror the `tutorials/interaction-sequencing/` folder — but until that category exists, audiovisual is fine.)
3. **AlloLib classes:** `WebApp`, `WebControlGUI`, `_studio_shared/Pickable.hpp` (port note), `Mesh`, `SynthSequencer` + `PolySynth` (both confirmed in `ALLOLIB_SOURCES`: `al_SynthSequencer.cpp`, `al_PolySynth.cpp`, `al_SynthVoice.cpp` are all linked), `Parameter`. Sequencer is bridged through `al_WebSequencerBridge.hpp` (in include dir).
4. **Audio plan:** Block 128. Mark-types map to voices: Line → glissando voice (sine + LFO sweep), Dot → grain (short envelope on `Sine<>`), Area → sustained texture (filtered noise). Standard `PolySynth::render(io)` in `onSound`.
5. **Visual plan:** Drawable canvas (mouse strokes captured via `onMouseDown/Drag/Up`, stored as LINE_STRIP Mesh), Pickable dots, transport playhead = LINES. ImGui replaced by Vue-side ParameterPanel for interpreter-loading dropdown.
6. **A→V coupling:** unchanged.
7. **Twist:** unchanged. "Interpreter" JSON loaded via `nlohmann/json.hpp`; in WASM, files come from the IDBFS-mounted virtual FS (per CMakeLists.txt `-lidbfs.js`) or are bundled into the registry as a string blob.
8. **Size:** ~700 LOC.
9. **Helpers:** `_studio_shared/Pickable.hpp`, `_studio_shared/param_graph.hpp`, `_studio_shared/automation.hpp` (transport recording).
10. **Web-specific risks:** **Low–Medium.** `SynthSequencer` confirmed linked; only fragile spot is Pickable port (shared with several S3 entries). `WebSequencerBridge` is included but its Vue-side surface for loading external interpreters needs verification — for v1 ship interpreters as registry-bundled JSON literals.

### 4.8 Wehinger-style score-after-the-fact

1. **Title:** Wehinger-style score-after-the-fact
2. **Registry entry:** `id: 'pg-wehinger-score', category: 'playground-audiovisual', subcategory: 'av-feature-driven'`.
3. **AlloLib classes:** `WebApp`, `Mesh`, `Texture` (glyph atlas), `ShaderProgram` (instanced glyph rendering — instanced draw is supported on WebGL2 via `glDrawElementsInstanced`), `WebControlGUI`, `WebSamplePlayer`, `gam::STFT` (centroid + onsets, offline). Plus offline analysis pass writing `score.json` to IDBFS.
4. **Audio plan:** Two paths — (1) **offline** preprocessing: load file (via `WebFile` / IDBFS), STFT through it, detect onsets via `EnvFollow` derivative thresholding, extract centroid/pitch/noisiness per onset, write `score.json` to IDBFS; (2) **playback**: `WebSamplePlayer` plays audio, score replays in sync. Block 128 throughout.
5. **Visual plan:** Horizontally scrolling event list. Each event = instanced quad with texture from atlas (timbre class). Glyph color = pitch hue, size = amplitude, vertical position = centroid bin. Playhead = vertical line at center; events scroll right-to-left. WebGL2 instanced draws — confirmed working per existing graphics tests.
6. **A→V coupling:** **inverse** — audio drove offline analysis; extracted features now drive visuals at exact playback time.
7. **Twist:** unchanged (glyph-dictionary editor with versioned `glyphs.json`).
8. **Size:** ~700 LOC.
9. **Helpers:** **`_studio_shared/audio_features.hpp`** (offline analysis showcase — second beneficiary after Synesthetic mapper), `_studio_shared/post_fx.hpp` (instanced glyph shader), `_studio_shared/automation.hpp` (the score *is* a recorded feature track).
10. **Web-specific risks:** **Low–Medium.** Offline analysis happens on the audio thread but driven by playback completion; needs a `state = ANALYZING / PLAYING` machine. IDBFS `score.json` write/read are routine; `WebFile` already exists. The instanced-glyph shader is the largest unknown — single-instance fallback (one `g.draw(quad)` per event) is a clean degradation path that costs ~20 % FPS at 200 visible events but is otherwise fine.

---

### Section 3+4 helpers summary (deltas from native plan)

The seven shared helpers from the native Phase-1 list map to Studio Online with these adjustments:

| Helper | Studio Online path | Status | Used by S3+S4 entries |
|---|---|---|---|
| `audio_features.hpp` | `_studio_shared/` | Port — same as native, verify `gam::STFT` MAG mode plumbing | 3.1, 3.2, 3.7, 3.8, 4.1, 4.4, 4.6, 4.8 |
| `post_fx.hpp` | `_studio_shared/` | Port + GLSL → GLSL ES 3.0 conversion | 3.4, 3.6, 4.2, 4.3, 4.4, 4.6, 4.8 |
| `draw_canvas.hpp` | `_studio_shared/` | Port; uses `WebApp::onMouseDown/Drag` (no Pickable dependency) | 3.2, 3.8, 4.4, 4.7 |
| `automation.hpp` | `_studio_shared/` | Port; persists to IDBFS not native FS | 3.9, 4.1, 4.3, 4.7, 4.8 |
| `param_graph.hpp` | `_studio_shared/` | Port; could alternatively be Vue-side HTML | 3.3, 3.4, 3.9, 4.1, 4.5, 4.6, 4.7 |
| `PVResynth.hpp` | `_studio_shared/` | New, narrow scope; ~180 LOC; STFT round-trip + per-bin phase advance | 3.2, 4.4 |
| `PixelAudioBridge.hpp` | `_studio_shared/` | New, ~80 LOC; shared-pointer + atomic row index | 4.2, 4.3 |

Plus three Studio-Online-only ports flagged above:

| Helper | Status | Used by |
|---|---|---|
| `Pickable.hpp` | New port (~150 LOC). Cookbook source available in `allolib_playground/cookbook/pickable/`. | 3.6, 3.9, 4.7 |
| `PartConvolver.hpp` | New (~250 LOC). Replaces missing `al::Convolver`. | 3.5, 3.6 |
| `VideoTexture.hpp` | Deferred (v2). EM_ASM `<video>` → `texSubImage2D` bridge. | 4.6 (v2 only) |

### Phase ordering for S3+S4 in Studio Online

Inserts before native plan's Phase 2:

- **S3 Phase 0a:** `pg-stft-phase-smoke` — confirms STFT MAG_PHASE round-trip in WASM (gates 3.2, 3.4, 4.4).
- **S3 Phase 0b:** `pg-hrtf-smoke` — confirms `gam::HRFilter` link (gates 3.9).
- **S3 Phase 0c:** `_studio_shared/PartConvolver.hpp` ship (gates 3.5, 3.6).
- **S3 Phase 0d:** `_studio_shared/Pickable.hpp` ship (gates 3.6, 3.9, 4.7).

Once these four gates clear, S3 and S4 can fan out in parallel matching the native Phase 3 ordering, with **4.6 explicitly de-scoped to image-corpus v1** until the `VideoTexture.hpp` work is funded.

---

## 5. Recommended phasing

### Phase 0 — Studio Online infra audit (3–5 days)

1. **CMake additions** to `allolib-wasm/CMakeLists.txt`:
   - Append `al_ext/spatialaudio/al_Convolver.cpp` and zita-convolver sources to `ALLOLIB_SOURCES`. Confirm they build under Emscripten with `-pthread` disabled (zita uses pthread by default — likely needs a small patch to single-thread the IR-load path, since real-time convolution stays on the worklet thread).
   - Append `Gamma/HRFilter.cpp` (or its source files) to `GAMMA_SOURCES` if it's not header-only. Verify HRIR table data is bundled or reachable via fetch.
2. **Pickable port** to `_studio_shared/pickable.hpp` — mirror the native API: `Pickable::onEvent(const Hit&)`, `intersect(const Ray&)`, `pose()`. Plumb through `WebApp::onMouseDown/Drag` raycasting (use `Viewpoint::lens()` un-project).
3. **Asset pipeline freeze.** Decide: public folder (Vite-served, version-bumped on deploy) vs. base64-embedded in source strings. Recommend **public folder** for any asset > 4 KB (Vite inlines below 4 KB anyway), embedded base64 only for tiny lookup tables (Bessel coefficients, IPA vowel quad vertices).
4. **Category-group decision.** Adopt the proposed `mat200b` group (§ 0.1). Push a stub `categoryGroups[4]` entry with the four sub-categories so Phase 2 examples have a place to land.
5. **Naming convention.** Adopt `mat-` id prefix (mirrors existing `pg-`, `studio-`, `gpu-`). Title-case display names. Subcategory ids are short slugs.
6. **Transpiler-vs-hand-write split.** Three rules:
   - All MAT200B example source uses web-native idioms directly (`#include "al_playground_compat.hpp"`, `class MyApp : public App` — the transpiler still rewrites `App` to `WebApp` but the include is already correct).
   - `ALLOLIB_WEB_MAIN(MyApp)` is written explicitly.
   - `configureAudio(48000, 128, 2, 0)` written explicitly, not relying on the transpiler clamp.

### Phase 1 — ship cross-cutting helpers (1–2 weeks)

In strict order — same six as the playground plan, web-retargeted:

1. **`audio_features.hpp`** — header-only minimal first (RMS/centroid/flatness/STFT bands). Defer MFCC + pitch to a `.cpp` shipped per-example.
2. **`post_fx.hpp` + inline GLSL** — needed for Phase 2 Lissajous validator. **All shader strings ES 3.0 with `precision highp float;` headers.** Pre-flight on both WebGL2 and WebGPU backends (the `BackendType` is a runtime switch in `WebApp::configureBackend`).
3. **`draw_canvas.hpp`** — cheap, ~8 examples blocked.
4. **`automation.hpp`** — wraps existing `SequenceRecorder` from `libal_web.a`. Bigger; do last in Phase 1.
5. **`param_graph.hpp`** — depends on stable `automation`. Force multiplier but no Phase 2 example *blocks* on it. **Defer Vue editor panel to Phase 3.**
6. **`pv_resynth.hpp` + `pixel_audio_bridge.hpp`** — narrow-scope helpers, cheaper than the five above.

Phase 1 acceptance test: a one-page demo example exercising each helper compiles cleanly through `compile.sh` and runs in the browser at 60 FPS @ 1280×800.

### Phase 2 — 5 representative validation examples (1 week)

Same five as the source plan, each shipped as a `mat-` `Example` object pushed to a new `frontend/src/data/mat200bExamples.ts` file (mirroring `playgroundExamples.ts`):

| Phase 2 example | Validates | Studio Online flag |
|---|---|---|
| **Lissajous oscilloscope synth** | template, post_fx (phosphor), audio→graphics ringbuffer | Verifies ES 3.0 phosphor shader on both WebGL2 and WebGPU |
| **Live compressor with transfer curve** | non-`SynthVoice` simple App, audio_features (RMS), waveform diff | Mic input — verifies `(48000, 128, 2, 2)` channel matrix and getUserMedia permission flow |
| **Risset glissando reconstruction** | additive bank, no shared infra — sanity check | Pure synthesis, no asset deps — runs offline |
| **Spectrogram painter** | draw_canvas, audio_features, post_fx (bloom), PVResynth | Validates `EasyFBO_Web` round-trip and HiDPI mouse mapping |
| **Karplus–Strong string lab** | template, post_fx (phosphor on string), draw_canvas (pluck position) | Verifies `gam::Delay` works at variable browser sample rates |

End-to-end test = browser load via `npm run dev`, click into `MAT200B → <category>`, hit Run, verify it renders + sounds. Then plug into `tests/e2e/comprehensive-functional-tests.spec.ts` (Playwright); the existing harness already enumerates all examples.

### Phase 3 — fan-out (2–4 weeks, parallelizable)

- **Low-risk small (1 day each):** Drawable wavetable, AM/RM sideband, Comb filter, Allpass dispersion, Granulation time-stretcher, Waveshaper, Synesthetic mapper, McLaren Synchromy, Mastering A/B. Plus the **11 mixing/staging entries the user added to Section 1** — count verified, all slot into "low-risk small" because they reuse Mastering A/B's loader pattern and Multiscale stems' viewport stack. Section 1 entries themselves get described in the source plan's Section 1 by another agent.
- **Medium:** Multiscale stems, Spectrum-mixing painter, FM index, Granular cloud, 1D waveguide, Vocal tract, Drawn-sound canvas, Phase vocoder lab, Convolution playground (dep on Convolver Phase 0 work), IR-builder reverb (dep on Convolver + Pickable), Spatializer w/ HRTF (dep on HRFilter Phase 0), Additive geometry, Generative graphic score, Wehinger score, Virtual diffusion stage.
- **Large / risky** (unchanged from source plan, but additionally web-risky):
  - **Real-time concatenative AV** — native plan needed FFmpeg; web plan needs HTML5 `<video>` plus `EM_ASM` bridge for frame index, plus precomputed MFCC sidecar JSON. Riskier on web because the video element is outside Emscripten and frame-accurate sync requires `requestVideoFrameCallback`. Defer until Phase 3 mid-point at earliest.
  - **Concatenative corpus browser** — UMAP/t-SNE remains. Recommend precomputed JSON drop-in (offline analysis pipeline), live target feed via `audioIO().channelsIn()`.
  - **Additive partial sculptor** — 256 enveloped voices is fine in WASM (single-threaded but plenty of headroom at 128-frame quantum).
  - **Subtractive z-plane (reverse design)** — freehand→pole/zero solve unchanged from native; ship forward direction first.
  - **Phase vocoder lab** with brush-on-bins editor — heavy on draw_canvas/automation; HiDPI mouse mapping is the new wrinkle.
  - **Vocal tract** with LPC cross-synthesis — LPC solid; ports as-is.

---

## 6. Open questions (web-recast)

1. **Category-group strategy.** Adopt new `mat200b` top-level group (recommended in § 0.1), or fan entries into existing `playground-synthesis` / `playground-audiovisual` subcategories? The course-coherence argument favors a new group; the dropdown-clutter argument favors merging.
2. **Naming convention for ids.** `mat-` prefix (parallels existing `pg-`, `studio-`, `gpu-`) or `pg-` (treat as a playground extension)? Recommendation: `mat-`.
3. **Asset packaging.** `frontend/public/assets/mat200b/<id>/...` (Vite-served, easy to update, ships in production bundle) vs. base64-embedded in the `code` template literal (zero asset coupling, but compresses poorly and bloats the JS bundle). Recommendation: public folder for anything > 4 KB, base64 for tiny lookup tables.
4. **ImGui inside WebApp.** Confirmed: ImGui is fully stubbed — `imguiInit/Begin/End/Draw` are no-ops, `ParameterGUI::draw*` are no-ops. UI must come from `WebControlGUI` (rendered in Vue Params panel) or from in-canvas `Mesh`-drawn widgets. Decision: examples that need a node-editor (param_graph) or matrix grid (synesthetic mapper) draw their own widgets in-canvas; everything else uses `gui << param`.
5. **Touch / mobile.** Canvas defaults to `800×600` (`WebApp.hpp:392-393`); the existing studio examples don't adapt to mobile. MAT200B is desktop-only by spec — document "best on desktop, Chrome/Firefox/Safari ≥ recent" and skip mobile-specific code paths.
6. **Browser audio gotchas.**
   - `AudioContext` requires a user gesture to start — Studio's Run button already handles this.
   - Sample rate is browser-determined: 44.1 kHz on macOS Safari, 48 kHz on most Chrome/Firefox installs. Examples must call `gam::sampleRate(audioIO().framesPerSecond())` in `onCreate()`.
   - Worklet block size is fixed at 128. `configureAudio(rate, N, ...)` with `N != 128` is clamped/silently re-blocked; DSP must not assume any specific block size.
   - Mic input requires getUserMedia permission, prompted on first `(in > 0)` audio start.
7. **Parameter panel discoverability.** Should every example expose a default `gui << p` registry, or rely on `WebControlGUI`'s automatic panel display? Confirmed automatic: `WebControlGUI::sActiveInstance` is registered in the ctor and the panel auto-renders any registered parameter. Convention for MAT200B: every example has a `ControlGUI gui;` member, and parameters declared in `onCreate()` are pushed via `gui << amplitude << frequency`. PresetHandler auto-forwards to the panel (`al_playground_compat.hpp:192-209`) so users don't need both `mPresets << p` and `gui << p`.
8. **Test harness.** Per CLAUDE.md, `tests/e2e/comprehensive-functional-tests.spec.ts` tests all 155 examples × 2 backends at 100% compile + render pass. The harness enumerates examples from `frontend/src/data/examples.ts` `examples` export — confirm new MAT200B entries are spread into `examples` (the array must include MAT200B objects, not just a reference to a separate file). One-line addition to `examples.ts` after the playground/studio spreads.
9. **Long compile times.** The Docker compile path takes ~15–25 s per example today (Emscripten link is the bottleneck). Heavy examples (concatenative AV with corpus loader, phase vocoder with PVResynth) may push toward 40–60 s. Acceptable to user, or chunk into smaller submissions per category? Recommend per-category compile cache; `compile.sh` already hashes the source string — if MAT200B helpers are header-only, the cache hit rate stays high.
10. **Shared-folder convention.** `_studio_shared/` is not yet established in `allolib-wasm/include/`. Adopt it (recommendation, leading underscore sorts above `al_*`) or reuse `cookbook/_shared/` (doesn't exist — would have to create) or flat at the include root (`al_studio_features.hpp`)? Recommendation: `_studio_shared/`.
11. **Audio I/O channel matrix.** Examples needing mic input (compressor, real-time concatenative, convolution-with-live-IR) need `(in > 0)`. Web Audio supports stereo input on most browsers; mono fallback on some. Documented matrix:
    - `(48000, 128, 2, 0)` — synthesis; the default. Works everywhere.
    - `(48000, 128, 2, 1)` — mono input. Compressor, IR-builder. Triggers getUserMedia.
    - `(48000, 128, 2, 2)` — stereo input. Mastering A/B with live source. Some browsers downmix.
    - Anything > 2 channels in or out — not portable; Studio Online treats as stereo.
