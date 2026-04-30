# MAT245 Buildable A/V Examples — Implementation Plan (AlloLib Studio Online)

Source list: 21 entries across 7 weekly clusters (Lectures 1–12) + 5 cross-cutting helpers, drawn from the user's Multimedia Composition course portfolio-development brief.
Target codebase: this repo (AlloLib Studio Online — browser IDE that compiles user C++ via Emscripten and runs it in WebGL2/WebGPU + Web Audio worklet).
Goal: every entry shipped as a real `.cpp` example registered in `frontend/src/data/mat245Examples.ts`, with **accurate audio AND visual** parts (or a deliberately silent / no-visual modality where the source spec demands it), running entirely in-browser with no native deps.

This plan parallels `MAT200B_EXAMPLES_PLAN.md` (already on disk) — same Section 0 (Studio Online integration), same four-phase Section 5 (audit → helpers → 5 validation examples → fan-out), same recast-for-web Section 6 open questions. The 21 entries split into Sections 1 through 7, one per lecture-week.

The course's central claim is that composition is a unified discipline across modalities — the same group-theoretic and set-theoretic structures show up in pitch, shape, time, and interaction. The projects below are excuses to make that unification operational.

User's portfolio-distinguishing picks (per the source brief):
1. Group-theory composition engine (W1)
2. Xenakis grammar engine (W5)
3. High-dimensional audio piece (W4 — addresses an A/V-coupling gap in the existing portfolio)
4. Iterative-refinement diff browser (W7)
5. Material-transformation lab with degrade/regenerate (W6)

Adaptations from the native-AlloLib version of the source brief:
- Examples register as `Example` objects in `frontend/src/data/mat245Examples.ts` — no CMake, no `tutorials/<cat>/` files.
- Audio block size is fixed at **128 frames** (Web Audio worklet quantum); sample rate from `audioContext.sampleRate` (44.1 or 48 kHz).
- `al::WebApp` is the actual base; the transpiler rewrites user-written `App` to `WebApp` automatically.
- ImGui is stubbed; UI lives in the Vue Params panel via `WebControlGUI` (post-pipeline-redesign: via the global `ParameterRegistry`).
- 5 new MAT245-specific helpers go under `allolib-wasm/include/_studio_shared/`: `pcset_engine.hpp`, `multi_scale_features.hpp`, `group_theory.hpp`, `versioned_state.hpp`, `constraint_layer.hpp`. Plus 3 Phase 0 micro-helpers: `midi_parser.hpp`, `similarity_matrix.hpp`, `optical_flow.hpp`.
- Reuses the MAT200B foundation already on disk (commits `0d8d98f` + `5c86aec`): `audio_features.hpp`, `automation.hpp`, `draw_canvas.hpp`, `param_graph.hpp`, `pickable.hpp`, `pixel_audio_bridge.hpp`, `post_fx.hpp`, `pv_resynth.hpp`, `web_convolver.hpp`.
- Web-only blockers: 8-channel ambisonic for the High-dimensional audio piece downmixes to binaural via `gam::HRFilter` (header-only, confirmed); video frame I/O for Cross-modal coherence checker uses HTML5 `<video>` + `requestVideoFrameCallback` + `EM_ASM` to push frame textures into a `gam::Texture`.

---

## 0. Studio Online integration

This section is the MAT245-targeted twin of `MAT200B_EXAMPLES_PLAN.md` § 0. Studio Online has no `run.sh`, no per-folder `flags.cmake`, no `tutorials/` tree — every example is a TypeScript object, every helper is a header in `allolib-wasm/include/`, and every asset is a Vite-served file under `frontend/public/assets/`. MAT245's compositional bias (tools-and-pieces rather than synthesis instruments) shifts the helper mix toward set theory, group operations, multi-scale features, versioning, and constraints; Section 0 declares which existing MAT200B helpers MAT245 reuses verbatim and which it needs net-new.

Source list (read verbatim from the MAT245 task prompt):

- **W1 — Symmetry as Foundation** (Lectures 1–2): Group-theory composition engine; Bartók palindrome reader; T/I clock.
- **W2 — Breaking Symmetry / Set Theory** (Lectures 3–4): Set-class transformer with M5/M7; Gradual-vs-sudden symmetry breaker; Asymmetric-balance composer.
- **W3 — Synchronization / Desynchronization** (Lecture 5): Phase shifter (Reich engine); Multi-scale temporal viewer; Sync/desync interactive.
- **W4 — Modality-Specific Expression** (Lecture 7): High-dimensional audio piece; High-dimensional visual piece; Modality decision tool.
- **W5 — Advanced Integration** (Lecture 8): Single-process / dual-output engine; Xenakis grammar engine; Cross-modal coherence checker.
- **W6 — Structure / Form / Material Transformation** (Lectures 10–11): Manovich-principles browser; Messiaen mode and rhythm engine; Database vs narrative composer; Material-transformation lab.
- **W7 — Personal Voice and Coherence** (Lecture 12): Constraint-based composition shell; Coherence inspector; Iterative-refinement diff browser.

Plus **5 cross-cutting infra helpers**: pitch-class set engine; multi-scale feature extractor; group-theory primitive; versioned project state; constraint declaration/enforcement layer.

### 0.1 How examples register

The mechanism is identical to MAT200B § 0.1: every example is an `Example` (or `MultiFileExample`) object pushed to a TypeScript array, then spread into the global `examples` export of `frontend/src/data/examples.ts`. Types live at `frontend/src/data/examples.ts` lines 27–52:

```ts
export interface Example {
  id: string; title: string; description: string
  category: string; subcategory?: string
  code: string
}
export interface MultiFileExample {
  id: string; title: string; description: string
  category: string; subcategory?: string
  files: ExampleFile[]; mainFile: string
}
```

The MAT200B Phase 0 scaffold (commit `6b659b6`) created `frontend/src/data/mat200bExamples.ts` and added a top-level `mat200b` group to `categoryGroups` in `examples.ts:178-181`, plus a spread of `mat200bCategories` into the flat `categories` export at line 202. MAT245 should follow the exact same pattern: a new file `frontend/src/data/mat245Examples.ts` exporting `mat245Categories`, `mat245Examples`, and `mat245MultiFileExamples`, plus a sibling top-level group `{ id: 'mat245', title: 'MAT245', categories: mat245Categories }` immediately after `mat200b` in `categoryGroups`.

**Category-group strategy.** Two viable options:

1. **One group, seven categories** (recommended): one MAT245 top-level group with seven categories `mat-symmetry`, `mat-set-theory`, `mat-sync-desync`, `mat-modality`, `mat-integration`, `mat-structure`, `mat-voice` mapping 1:1 onto W1–W7. 21 entries spread roughly 3 per category — readable in the dropdown, course-coherent.
2. **One group, three or four pedagogical categories** (e.g. `mat-symmetry-tools`, `mat-pieces`, `mat-portfolio-infra`). Tighter dropdown but obscures the lecture mapping students will be reading alongside.

Recommendation: option 1. The course-week structure is the single most important navigation key for students working through MAT245 in parallel with the syllabus. Subcategory layout proposal:

```ts
{ id: 'mat245', title: 'MAT245', categories: [
  { id: 'mat-symmetry',    title: 'MAT245 - Symmetry as Foundation (W1)',
    subcategories: [{id:'group-engine',title:'Group Engine'},
                    {id:'palindrome',title:'Palindrome Reader'},
                    {id:'ti-clock',title:'T/I Clock'}] },
  { id: 'mat-set-theory',  title: 'MAT245 - Set Theory & Symmetry Breaking (W2)',
    subcategories: [{id:'transformer',title:'Set-Class Transformer'},
                    {id:'breaker',title:'Symmetry Breaker'},
                    {id:'balance',title:'Asymmetric Balance'}] },
  { id: 'mat-sync-desync', title: 'MAT245 - Sync / Desync (W3)',
    subcategories: [{id:'reich',title:'Reich Engine'},
                    {id:'multiscale',title:'Multi-Scale Viewer'},
                    {id:'interactive',title:'Sync/Desync Toy'}] },
  { id: 'mat-modality',    title: 'MAT245 - Modality (W4)',
    subcategories: [{id:'audio-piece',title:'High-D Audio'},
                    {id:'visual-piece',title:'High-D Visual'},
                    {id:'decision-tool',title:'Modality Decision Tool'}] },
  { id: 'mat-integration', title: 'MAT245 - Advanced Integration (W5)',
    subcategories: [{id:'dual-output',title:'Dual-Output Engine'},
                    {id:'xenakis',title:'Xenakis Grammar'},
                    {id:'cross-modal',title:'Cross-Modal Coherence'}] },
  { id: 'mat-structure',   title: 'MAT245 - Structure & Material (W6)',
    subcategories: [{id:'manovich',title:'Manovich Browser'},
                    {id:'messiaen',title:'Messiaen Engine'},
                    {id:'database',title:'Database vs Narrative'},
                    {id:'material-lab',title:'Material Transformation'}] },
  { id: 'mat-voice',       title: 'MAT245 - Personal Voice (W7)',
    subcategories: [{id:'constraint',title:'Constraint Shell'},
                    {id:'coherence',title:'Coherence Inspector'},
                    {id:'diff-browser',title:'Iterative Diff Browser'}] },
]}
```

**Naming convention.** `mat245-` id prefix, parallel to `mat-` already established for MAT200B (`mat200bExamples.ts` uses `mat-mixing`, `mat-synthesis`, etc. for *category* ids; example *ids* in MAT200B will use `mat-` per § 1 of that plan). To avoid id collisions across the two courses, MAT245 uses `mat245-` for example ids while reusing the `mat-<topic>` shape only for *category* ids (visible in the dropdown). Concrete: `mat245-ti-clock`, `mat245-reich-engine`, `mat245-xenakis-grammar`, etc.

### 0.2 The web template skeleton

Same canonical include and same transpiler contract as MAT200B § 0.2: `#include "al_playground_compat.hpp"`, `class MyApp : public App { … };`, explicit `gam::sampleRate(audioIO().framesPerSecond())` in `onCreate()`, explicit `configureAudio(48000, 128, 2, 0)` in `main()`, explicit `ALLOLIB_WEB_MAIN(MyApp)`. AudioWorklet block size is fixed at **128 frames**; ImGui is stubbed (UI lives in the Vue Params panel via `WebControlGUI`); `g.draw(mesh)` is auto-rewritten to `drawLOD(g, mesh)`.

MAT245 adds two skeleton variants because most of its 21 entries are **not** synthesis instruments — they are score viewers, set-class calculators, coherence inspectors, and database browsers. The synthesis-style skeleton (used by W1 group engine, W2 breaker, W3 Reich engine, W5 Xenakis, W6 Messiaen sound side, W6 material lab) follows the MAT200B § 0.2 polysynth shape exactly. The analysis-style skeleton (used by W1 palindrome reader, W3 multi-scale viewer, W7 coherence inspector, W7 diff browser) reads a `SoundFile` through `gam::SamplePlayer` (which is **not** linked in the WASM build — see § 0.3) routed through `al_WebSamplePlayer.hpp` instead, computes features, and draws diagnostic plots in-canvas.

Synthesis-style skeleton (drop into the `code:` template literal):

```cpp
/**
 * MAT245 / 2026 — <Project> — <one-line>
 * Audio:  <DSP graph>
 * Visual: <draw plan>
 * Hook:   <legibility twist from MAT245 source list>
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"
#include "_studio_shared/pcset_engine.hpp"     // Phase 1
#include "_studio_shared/group_theory.hpp"     // Phase 1
// #include "_studio_shared/constraint_layer.hpp"  // W6/W7 only

using namespace al;

class MyApp : public App {
public:
  studio::PcSet         mSet{0,1,4,8};        // [0,1,4,8] — set class 4-Z15
  studio::ControlGUI    gui;
  Mesh                  mClock;
  double                mPhase = 0.0;

  void onCreate() override {
    gam::sampleRate(audioIO().framesPerSecond());
    addCircle(mClock, 1.0, 12);
    gui << /* parameters bound to set ops */ ;
  }
  void onSound(AudioIOData& io)  override { /* polysynth render */ }
  void onAnimate(double dt)      override { mPhase += dt; }
  void onDraw(Graphics& g)       override { /* draw set on PC clock */ }
};

int main() { MyApp app; app.configureAudio(48000, 128, 2, 0); app.start(); return 0; }
ALLOLIB_WEB_MAIN(MyApp)
```

Analysis-style skeleton (used by ~9 of 21 entries):

```cpp
/**
 * MAT245 / 2026 — <Project> — <one-line>
 * Reads:  <input — MIDI file, audio file, video, or live mic>
 * Computes: <features / set-class / similarity / etc.>
 * Draws:  <diagnostic plot, piano-roll, similarity matrix>
 */

#include "al_playground_compat.hpp"
#include "al_WebSamplePlayer.hpp"
#include "_studio_shared/audio_features.hpp"
#include "_studio_shared/multi_scale_features.hpp"
#include "_studio_shared/midi_parser.hpp"           // Phase 0 deliverable
// #include "_studio_shared/similarity_matrix.hpp"  // W7 coherence

using namespace al;

class MyApp : public App {
public:
  WebSamplePlayer            mPlayer;
  studio::MultiScaleFeatures mFeatures{48000.f};
  std::vector<float>         mNoveltyCurve;       // 30 Hz
  Mesh                       mPlot;

  void onCreate() override {
    gam::sampleRate(audioIO().framesPerSecond());
    mPlayer.load("/assets/mat245/coherence/example_in.wav");
  }
  void onSound(AudioIOData& io) override {
    while (io()) { float s = mPlayer(); io.out(0)+=s; io.out(1)+=s;
      mFeatures.process(s); }
  }
  void onAnimate(double dt) override { mFeatures.poll(mNoveltyCurve); }
  void onDraw(Graphics& g) override { /* line strip of mNoveltyCurve */ }
};

int main() { MyApp app; app.configureAudio(48000, 128, 2, 0); app.start(); return 0; }
ALLOLIB_WEB_MAIN(MyApp)
```

### 0.3 Transpiler capabilities and limits

All MAT200B § 0.3 capabilities and blocks apply verbatim to MAT245: `frontend/src/services/transpiler.ts` auto-rewrites `al/app/al_App.hpp` → `al_WebApp.hpp` (and the matching base-class rewrite `App` → `WebApp`); rewrites `al/io/al_MIDI.hpp` → `al_WebMIDI.hpp` and `MIDIIn`/`MIDIOut` → `WebMIDI`; rewrites `al/sound/al_SoundFile.hpp` → `al_WebSamplePlayer.hpp` and `SoundFile` → `WebSamplePlayer`; rewrites the `int main()` block to `ALLOLIB_WEB_MAIN(...)`. The same `unsupportedPatterns` array still blocks `al_Arduino.hpp`, `al_SerialIO.hpp`, `al_Socket.hpp`, `al_FileSelector.hpp`, geometry-shader compile, and `glPolygonMode`. ImGui is still stubbed; `osc::Send/Recv` is still pass-through; `Gamma/SoundFile.h` and `Gamma/AudioIO.h` are still excluded from the WASM Gamma library (verified `allolib-wasm/CMakeLists.txt:86-98`).

**MAT245-specific notes:**

- **MIDI / MusicXML imports for offline files are NOT auto-rewritten.** The Bartók palindrome reader (W1) and the Messiaen engine (W6) need to parse score files as **data**, not consume **live** MIDI. `al_WebMIDI.hpp` is for live Web MIDI input only (`navigator.requestMIDIAccess`); it does not parse SMF (Standard MIDI File) bytes. AlloLib upstream has no SMF parser at all — neither native nor web. Plan: ship a tiny pure-C++ SMF parser at `_studio_shared/midi_parser.hpp` (~250 LOC: variable-length quantities, meta events, note on/off, tempo map, time signature). MusicXML is a much larger spec — for the MAT245 scope, ship a *narrow* MusicXML reader that only extracts `<note>`/`<duration>`/`<pitch>`/`<time>`/`<key>`/`<measure>` (~150 LOC against `nlohmann/json` is the wrong tool; use a hand-rolled tiny XML scanner since the existing tree already pulls `tinyxml2` for COLLADA via `al_ext/assets3d`, but since `assets3d` is not currently in `libal_web.a`, just hand-roll a 100-line state-machine XML scanner). Both parsers run on file bytes loaded from `/assets/mat245/<id>/score.{mid,xml}` via `al_WebFile::fetchToMemfs`.
- **Alternative path** (lower-risk, lower-fidelity): leverage an embedded JS parser via `EM_ASM` — call `tonejs/midi` or `vexflow` JS modules from C++. Tradeoff: JS-side parser is more battle-tested and handles edge cases (multi-track tempo maps, weird quantizers); but it adds a JS dependency to the page bundle and complicates the asset pipeline (parser output has to round-trip through JSON). § 6 question 1 asks the user to pick.
- **`gam::SamplePlayer` is NOT in the WASM Gamma build** because `Gamma/SoundFile.h` is excluded (`CMakeLists.txt:86`). Examples that the source list describes as "reads a `SoundFile` through `gam::SamplePlayer`" must rewrite to `al_WebSamplePlayer.hpp` (fetch- and IDBFS-backed; verified at `allolib-wasm/include/al_WebSamplePlayer.hpp:30`). The transpiler does this automatically for `SoundFile` → `WebSamplePlayer`; it does **not** rewrite `gam::SamplePlayer` (since that's a Gamma symbol, not an AlloLib one). New rewrite recommended: add `gam::SamplePlayer` → `WebSamplePlayer` to `transpiler.ts` for MAT245 entries that lift Gamma-style code from the syllabus.

### 0.4 Asset pipeline

Same convention as MAT200B § 0.4. `frontend/public/assets/` is Vite-served at `/assets/...`. Existing tree (verified): `assets/CREDITS.md`, `assets/environments/` (8 HDR files, e.g. `studio_small_09_1k.hdr`, `forest_slope_1k.hdr`), `assets/meshes/`, `assets/textures/`, and the new `assets/mat200b/` from MAT200B Phase 0. Proposed MAT245 layout: `frontend/public/assets/mat245/<id>/` mirroring the same per-example folder convention.

**MAT245-specific assets:**

- **Reference scores for the Bartók palindrome reader (W1).** SMF format, ~10–80 KB each. License-clean candidates: Bartók died 1945, US PD as of 2021; the *Mikrokosmos Volume 6 No. 141 "Subject and Reflection"* and *Music for Strings, Percussion and Celesta* II are the canonical palindrome examples and are PD in the US but not in the EU until 2026 (corporate authorship rules don't apply — author-life-plus-70 kicks in 2026). For Studio Online (US-hosted and US-targeted), document the assets as US-PD with a note. Where: `assets/mat245/palindrome/{mikrokosmos_141.mid,music_for_strings_ii.mid}`. If the user is uncomfortable with the US/EU split, ship Stravinsky's *Three Pieces for String Quartet* (PD US since 2014) as the fallback example.
- **Olivier Messiaen *Quatuor pour la fin du Temps* movement audio** for the W6 Messiaen engine inspector. **Copyright-protected** in both US (Messiaen d.1992, US PD ≥2063) and EU (≥2063). Document path as `user-supplied`: ship a stub README at `assets/mat245/messiaen/USER_SUPPLIED.md` instructing the user to drop their own `quatuor_mvt3_abime.flac`. As a fallback shipped-by-default, use Stravinsky *L'Histoire du soldat* "The Soldier's March" (PD US) at `assets/mat245/messiaen/stravinsky_soldat_march.opus`. The example code reads whichever file is present.
- **50 short A/V fragments for the W6 Database-vs-narrative composer.** Need ~50 × (3–10 s audio + matching 3–10 s 480p video). Curate a CC0 fragment bundle from Pexels/Pixabay/Free Music Archive: 50 fragments × ~600 KB average (opus audio + 480p webm video) ≈ **30 MB total**. Drop at `assets/mat245/database/{frag_001..frag_050}/{audio.opus,video.webm,meta.json}` with a top-level `assets/mat245/database/INDEX.json` containing precomputed feature vectors (centroid, RMS, dominant color, motion magnitude). Per MAT200B § 0.4 bundle hygiene, 30 MB stays under the ~50 MB-per-category cold-cache budget.
- **HDRI / texture sets for the W4 high-dimensional visual piece.** Already present: 8 HDRs in `frontend/public/assets/environments/`. Reuse `kloofendal_48d_partly_cloudy_puresky_1k.hdr` and `museum_of_ethnography_1k.hdr` as the two canonical environments; document the expectation in the example header.
- **Video corpus for the W5 Cross-modal coherence checker.** ~5 short user-uploaded video clips at `assets/mat245/cross-modal/{clip1.webm,...}` plus an optical-flow sidecar JSON precomputed offline. Same HTML5 `<video>` + `EM_ASM` pattern as MAT200B's *Real-time concatenative AV* — see § 0.5 below.

`assets/mat245/CREDITS.md` per the existing `assets/CREDITS.md` template, one entry per file, license per file.

### 0.5 Cross-cutting helpers (web-targeted)

The MAT200B Phase 0/1 work has populated `allolib-wasm/include/_studio_shared/` with header-only helpers (verified — directory listing on disk: `audio_features.hpp`, `automation.hpp`, `draw_canvas.hpp`, `param_graph.hpp`, `pickable.hpp`, `pixel_audio_bridge.hpp`, `post_fx.hpp`, `pv_resynth.hpp`, `web_convolver.hpp`, plus `_hrfilter_notes.md` and `_smoke_test.cpp`). MAT245 reuses 9 of those verbatim and adds **5 new MAT245-specific helpers** plus **3 micro-helpers** for blockers identified in § 0.6.

**Reused from MAT200B foundation (no changes needed):**

| Helper | MAT245 example consumers |
|---|---|
| `audio_features.hpp` | W7 coherence inspector, W5 cross-modal coherence, W3 multi-scale viewer, W6 material-transformation lab |
| `automation.hpp` | W2 gradual-vs-sudden symmetry breaker, W3 Reich phase shifter, W7 constraint shell, W7 iterative diff browser |
| `param_graph.hpp` | W6 material-transformation lab, W7 constraint shell |
| `draw_canvas.hpp` | W2 asymmetric-balance composer, W6 database-vs-narrative composer |
| `post_fx.hpp` | W4 high-dimensional visual piece, W5 single-process dual-output engine |
| `pv_resynth.hpp` | W6 material-transformation lab |
| `pickable.hpp` | W2 asymmetric-balance composer, W1 T/I clock, W1 group-theory engine |
| `pixel_audio_bridge.hpp` | W5 single-process dual-output engine |
| `web_convolver.hpp` | W6 material-transformation lab (degrade/regenerate twist) |

**New MAT245 helpers** under `allolib-wasm/include/_studio_shared/`:

| Helper | File | API summary | Web notes | Used by | Real LOC |
|---|---|---|---|---|---|
| **PC-set engine** | `pcset_engine.hpp` | `struct PcSet` over `std::array<int, 12>` bit-mask plus ordered-list view; ops `T(int n)`, `I(int n)`, `M5()`, `M7()`, `M(int)`, `normalForm()`, `primeForm()`, `intervalVector()`, `forteName()`, `complement()`, `Z_partner()`. Embedded `static constexpr ForteEntry kForte[228]` table mapping prime form → Forte number + Z-partner. Built-in iteration helpers `for (auto& sc : allSetClasses())`. | Header-only. The 228-entry Forte table embeds as a `constexpr` array — no asset load, no JSON parse. Diagnostic plots (PC clock with set highlighted, interval vector bar chart) draw via `Mesh` directly; no FontRenderer (`al_WebFont.hpp` exists but ImGui is stubbed — use bitmap glyph atlas if labels are needed). | W1 group engine, W1 T/I clock, W2 set-class transformer, W2 symmetry breaker, W6 Messiaen engine, W7 constraint shell, W7 coherence inspector | ~450 |
| **Multi-scale features** | `multi_scale_features.hpp` | `class MultiScaleFeatures { processBlock(const float*, int); poll(MicroFrame&); pollMeso(MesoFrame&); pollMacro(MacroFrame&); }`. Three-scale pyramid: micro = sample-rate RMS/peak/centroid (wraps the existing `audio_features.hpp` STFT extractor); meso = ~30 Hz onset/novelty curve via spectral flux + adaptive threshold; macro = section segmentation via self-similarity matrix novelty (Foote 2000) over a sliding 60 s window. Outputs `boundaries: vector<double>` (seconds). | Wraps not duplicates `audio_features.hpp` (the underlying `AudioFeatureExtractor` already provides centroid/STFT bands). The macro layer needs a self-similarity matrix — defer the heavy SSM compute to `_studio_shared/similarity_matrix.hpp` (§ 0.6 micro-helper) so the MSF helper stays under 350 LOC. | W3 multi-scale viewer, W3 sync/desync interactive, W5 cross-modal coherence, W7 coherence inspector | ~380 |
| **Group-theory primitive** | `group_theory.hpp` | Templated universal-operation primitive: `enum class Transform { Tn, In, M5, M7, Reflect, Rotate, Translate, Scale }`; free function `template<class T> T apply(Transform op, int param, const T& target)` with overloads for `PcSet`, `Mesh`, `std::vector<float>` (parameter array), and `Pose` (3D). Compile-time check via `if constexpr` so a single user-side line `auto next = apply(Tn, 5, currentSet)` works whether `currentSet` is set, shape, or parameter array. | Header-only. Composes with `pcset_engine.hpp` for the set case, `al/math/al_Mat.hpp` for the geometric case (already in `libal_web.a`), and lambdas for the parameter-array case. | W1 group engine, W1 T/I clock, W2 transformer, W2 symmetry breaker, W5 dual-output engine, W5 Xenakis grammar | ~320 |
| **Versioned project state** | `versioned_state.hpp` (C++ side) + Pinia integration (TS side) | C++ side is ~150 LOC and **only** serializes a `FeatureVector` struct (audio features, set-class fingerprint, parameter snapshot) into a `nlohmann::json` blob keyed by commit id. The actual snapshot store lives in TypeScript, hooked into `frontend/src/stores/project.ts` (verified — the existing `Project` interface at `project.ts:22-30` has `id/name/files/folders/activeFile/createdAt/updatedAt`; we add a `commits: ProjectCommit[]` field that captures `{id, parent, timestamp, files, arrangement, featureVectorJSON}` per save). The TS commit-on-save logic and diff UI is ~350 additional LOC. | The C++ side runs in WASM, the snapshot store runs in the SPA. Storage backend: IndexedDB direct (room for ~50 MB per origin in modern browsers, enough for ~200 commits with feature vectors but no audio renders). Asynchronous via `idb-keyval` (already a project dep — confirm) or `idb`. Per § 6 question 4: the user picks IndexedDB direct vs. git-style content-addressed. | W7 iterative diff browser (primary consumer); also instrumented across W5/W6 portfolio-life examples | ~150 C++ + ~350 TS |
| **Constraint declaration / enforcement** | `constraint_layer.hpp` | Declarative constraint set: `struct ConstraintSet { void requireSet(string forteName); void requireMode(MessiaenMode m); void requireTimeSig(int n, int d); void budget(BudgetKind k, int max); std::function<bool(const Action&)> allow; };` plus `Action` variants `(Transform, PcSetChange, ParamChange, Insert, Delete)` and a registry of editor-side surfaces that subscribe via `ConstraintSet::onViolation(callback)`. C++ side enforces during `onSound`/`onDraw`; the Vue side surfaces violations as red highlights in the Params panel. | Header-only on the C++ side. The Vue subscription wiring lives in a new composable `frontend/src/composables/useConstraintLayer.ts` (~80 LOC) that subscribes to the `WebControlGUI` parameter-change events. | W6 Messiaen engine, W6 database-vs-narrative composer, W7 constraint shell, W7 coherence inspector | ~420 C++ + ~80 TS |

**Web-specific notes shared across the new helpers:**

- **No FontRenderer with arbitrary text.** `al_WebFont.hpp` exists in the include tree but is bitmap-glyph-atlas based; long Forte numbers like "5-Z37" render fine, but anything beyond ASCII should be tested. For the PC-set engine's interval-vector display, render bars not numbers.
- **Diagnostic plots are `Mesh` LINE_STRIP / TRIANGLES** — no in-canvas ImGui, no SVG. The pattern is established in MAT200B § 0.5 `automation.hpp` for automation curves; reuse the same approach for the multi-scale pyramid plot, the SSM heatmap (`Mesh` with TRIANGLES at one quad per cell, vertex-color encoding the similarity), and the Forte-class lookup table widget.
- **MIDI imports go through `al_WebMIDI.hpp` for live input and `_studio_shared/midi_parser.hpp` for offline files.** The boundary is sharp: live MIDI controllers need `navigator.requestMIDIAccess` (the live API surface in `al_WebMIDI.hpp` lines 1–30); SMF parsing reads file bytes from MEMFS. Don't confuse them.

### 0.6 What's already wired vs. what's missing

Re-audit of `allolib-wasm/CMakeLists.txt` (verified `CMakeLists.txt:80-247`): same wired set as MAT200B § 0.6 — Core (AudioIO, AudioIOData, File, Window, ControlNav), App domains (Computation/Audio/Simulation/OpenGLGraphics — no `OSCDomain`/`GUIDomain`), Graphics (BufferObject through stb_image, plus all WebGL2-replaced versions), Scene (DynamicScene, PolySynth, SynthSequencer, SynthVoice), Sound (Ambisonics, Biquad, Dbap, DownMixer, Lbap, Spatializer, Vbap), Spatial (HashSpace, Pose), UI (Parameter, ParameterBundle, ParameterServer), Web-only headers (WebApp, WebControlGUI, WebMIDI, WebSamplePlayer, WebFile, WebOBJ, WebHDR, WebPBR, WebProcedural, WebMipmapTexture, WebLOD, WebQuality, WebAutoLOD), Gamma (Conversion, DFT, Domain, FFT_fftpack, Print, Scheduler, Timer, arr, fftpack, scl).

MAT200B Phase 0/1 has already added: `web_convolver.hpp` (replacing the missing `al::Convolver` zita port), `pickable.hpp` (replacing the missing `cookbook/pickable/`), `_hrfilter_notes.md` (documenting the deferred HRFilter port). For MAT245 these all carry over unchanged.

**MAT245-specific blockers** to resolve in Phase 0:

- **MIDI / MusicXML parsing**: ship `_studio_shared/midi_parser.hpp` as a Phase 0 deliverable. Real implementation: parse SMF format directly in C++ (~250 LOC). For MusicXML, a hand-rolled state-machine XML scanner extracting only the elements named in § 0.3 (~150 LOC). Used by W1 palindrome reader and W6 Messiaen engine.
- **Self-similarity matrix viz**: leverages `audio_features.hpp` plus a new `_studio_shared/similarity_matrix.hpp` micro-helper (~150 LOC: distance metrics — cosine, Euclidean, Mahalanobis on MFCC frames; novelty-curve extraction via Foote checkerboard kernel; rendering as a vertex-colored TRIANGLES mesh). Used by W7 coherence inspector and W3 multi-scale viewer macro layer.
- **Optical flow / frame difference for cross-modal coherence**: ship `_studio_shared/optical_flow.hpp` (~200 LOC: Lucas-Kanade pyramidal optical flow on uploaded video frames). The frame I/O is the trickier half — leverage HTML5 `<video>` + `requestVideoFrameCallback` + `EM_ASM` to draw current frame to a hidden `<canvas>`, `getImageData`, and copy bytes into a `gam::Texture` (matches the MAT200B *Real-time concatenative AV* § 0.5 pattern; this MAT245 version is pure-frame, no audio-corpus segmentation). Used by W5 cross-modal coherence checker.
- **`gam::SamplePlayer` rewrite rule** in `transpiler.ts` (§ 0.3) — small one-line addition.

Net new Phase 0 deliverables for MAT245: 5 helpers + 3 micro-helpers + 1 transpiler rule + asset bundle scaffolding + 4 README/PD-license documentation files.

---

## 8. Recommended phasing

Same four-phase shape as MAT200B § 5.

### Phase 0 — Studio Online infra audit (3–5 days)

1. **Registry scaffold.** Create `frontend/src/data/mat245Examples.ts` mirroring `mat200bExamples.ts` (which itself is the reference template — verified at lines 1–71 of that file): export `mat245Categories`, `mat245Examples`, `mat245MultiFileExamples`. Add the seven categories from § 0.1. Push the new top-level group `{ id: 'mat245', title: 'MAT245', categories: mat245Categories }` into `categoryGroups` in `examples.ts` immediately after the existing `mat200b` entry (line 181 of `examples.ts`). Spread `mat245Categories` into the flat `categories` export at line 202.
2. **Asset folder scaffolding.** Create `frontend/public/assets/mat245/{palindrome,messiaen,database,cross-modal,coherence}/` with placeholder `.gitkeep` files plus per-folder `README.md` describing the expected files and their licenses. Create `frontend/public/assets/mat245/CREDITS.md` (mirror of the existing top-level `assets/CREDITS.md`).
3. **Category-group decision.** Adopt option 1 from § 0.1 (one MAT245 group, seven W1–W7 categories). The naming convention is `mat245-` for example ids, `mat-<topic>` for category ids (`mat-symmetry`, etc.).
4. **MAT245-specific deps.** Port the three micro-helpers from § 0.6: `_studio_shared/midi_parser.hpp`, `_studio_shared/similarity_matrix.hpp`, `_studio_shared/optical_flow.hpp`. All header-only; total ≈ 600 LOC. Add `gam::SamplePlayer` → `WebSamplePlayer` rewrite rule to `transpiler.ts` (one regex, one line in the test array).
5. **Transpiler-vs-hand-write split.** Same three rules as MAT200B § 5 Phase 0: web-native idioms in source (`#include "al_playground_compat.hpp"`, `class MyApp : public App`), explicit `ALLOLIB_WEB_MAIN(MyApp)`, explicit `configureAudio(48000, 128, 2, 0)`.
6. **Versioned-state Pinia hook decision.** Pick IndexedDB-direct vs. content-addressed (§ 6 question 4). Recommend IndexedDB-direct for Phase 0 — switching later is a migration but the API surface (`versioned_state.hpp::commit()` plus the TS composable `useVersionedProject`) does not change.

### Phase 1 — ship MAT245 helpers (1.5–2 weeks)

In strict dependency order:

1. **`pcset_engine.hpp`** — first because four other helpers and seven examples depend on it. Embedded 228-entry Forte table is mechanical to author (data tables published in Forte 1973 + Rahn 1980 are the reference). Acceptance: round-trip `[0,1,4,8] → primeForm → "4-Z15" → forteEntry → [0,1,4,8]` returns the original set.
2. **`group_theory.hpp`** — depends on `pcset_engine.hpp` for the set-overload path. The geometric overload uses `al/math/al_Mat.hpp` directly (already linked).
3. **`midi_parser.hpp`** + **`similarity_matrix.hpp`** + **`optical_flow.hpp`** — the three Phase 0 micro-helpers, finished now since they each block ≥ 1 Phase 2 example. Acceptance: a one-page demo per helper compiles cleanly through `compile.sh` and runs in the browser at 60 FPS @ 1280×800.
4. **`multi_scale_features.hpp`** — depends on `audio_features.hpp` (already shipped from MAT200B Phase 1) plus `similarity_matrix.hpp` (just shipped above). Wraps not duplicates.
5. **`constraint_layer.hpp`** + Vue composable `useConstraintLayer.ts` — depends on `pcset_engine.hpp` and on the Vue Params panel surface. Heavier than the others; finish last.
6. **`versioned_state.hpp`** — C++ side is ~150 LOC of feature-vector serialization. The TS Pinia integration is the bigger piece; ship it as a separate deliverable.

Phase 1 acceptance: all 8 new helpers compile cleanly through `compile.sh`, the 3 micro-helpers exercise their respective Phase 2 examples without crashes, and the Vue Params panel shows constraint violations in red.

### Phase 2 — 5 representative validation examples (1 week)

Each shipped as a `mat245-` `Example` object pushed to `frontend/src/data/mat245Examples.ts`:

| Phase 2 example | Validates | Studio Online flag |
|---|---|---|
| **T/I clock (W1)** | template, `pcset_engine.hpp`, `group_theory.hpp`, `pickable.hpp` | First end-to-end PC-set example — verifies the Forte table, normal/prime form, and the universal `apply<>` primitive |
| **Phase shifter / Reich engine (W3)** | template, `automation.hpp`, audio-only (no asset deps) | Verifies AudioWorklet 128-frame stability under two diverging tempo lanes; pure synthesis, runs offline |
| **Modality decision tool (W4)** | analysis-style template, `multi_scale_features.hpp`, `WebSamplePlayer`, `audio_features.hpp` | Validates the multi-scale pyramid against a known reference; user uploads any WAV and the tool prints micro/meso/macro decisions |
| **Manovich-principles browser (W6)** | template, `draw_canvas.hpp`, registry only — no DSP | Smallest example, validates the new `mat245` category-group dropdown and per-example asset path resolution (loads 5 small images from `/assets/mat245/manovich/`) |
| **Iterative-refinement diff browser (W7)** | `versioned_state.hpp` C++ + TS side, `audio_features.hpp` | First end-to-end portfolio-life example; verifies IndexedDB round-trip, the Vue diff UI, and the C++ feature-vector serializer |

End-to-end test = browser load via `npm run dev`, click into `MAT245 → <category>`, hit Run, verify it renders + sounds. Then plug into `tests/e2e/comprehensive-functional-tests.spec.ts` (Playwright); the existing harness already enumerates examples from the `examples` export.

### Phase 3 — fan-out (3–5 weeks, parallelizable)

Remaining 16 entries split by risk.

- **Low-risk small (1 day each):** Group-theory composition engine (W1), Bartók palindrome reader (W1), Set-class transformer with M5/M7 (W2), Gradual-vs-sudden symmetry breaker (W2), Multi-scale temporal viewer (W3), Sync/desync interactive (W3), Asymmetric-balance composer (W2), Constraint-based composition shell (W7), Coherence inspector (W7).
- **Medium:** Single-process / dual-output engine (W5 — needs careful audio/visual sync via `pixel_audio_bridge.hpp`), Manovich-principles browser (Phase 2 stub gets full content treatment in Phase 3), Messiaen mode and rhythm engine (W6 — Messiaen modes 1–7 plus non-retrogradable rhythms; depends on `midi_parser.hpp` + `pcset_engine.hpp` + `constraint_layer.hpp`), Material-transformation lab (W6 — `pv_resynth.hpp` + `web_convolver.hpp` + `param_graph.hpp` + `automation.hpp`).
- **Large / risky:**
  - **Xenakis grammar engine (W5)** — large, 3D mesh + ruled-surface generation (Xenakis's *Metastaseis* glissando bundles, *Pithoprakta* stochastic clouds, *Nomos Alpha* group-theory compositional rules). 3D meshes generated procedurally per-frame; LOD via `al_WebAutoLOD.hpp` is mandatory for performance. Defer until Phase 3 mid-point. AlloSphere relevance — see § 6 question 7.
  - **High-dimensional audio piece (W4)** — 8-channel ambisonic. Web Audio supports `AudioContext({ outputChannels: 8 })` on Chrome/Firefox but Safari downmixes; the AlloLib `Ambisonics.hpp` is linked but the *output* path through Web Audio is the question. Plan: render 8-channel ambisonic to a 4-channel B-format internally, then run binaural HRTF convolution via `_studio_shared/web_convolver.hpp` for stereo output as fallback. § 6 question 3 asks the user to pick.
  - **Cross-modal coherence checker (W5)** — needs HTML5 `<video>` + `EM_ASM` bridge for frame index, plus `optical_flow.hpp` running on uploaded clips. Same web-risk profile as MAT200B *Real-time concatenative AV* (frame-accurate sync via `requestVideoFrameCallback`). Defer until Phase 3 late.
  - **Database vs narrative composer (W6)** — 50-fragment asset bundle (~30 MB) is the biggest single asset commit in either MAT200B or MAT245. Verify Vite cold-cache budget, document the 30 MB cost, and consider per-fragment lazy-load via `fetch` rather than pre-loading the whole bundle.
  - **High-dimensional visual piece (W4)** — depends on `post_fx.hpp` chain plus HDR environments (already shipped under `assets/environments/`). Lower risk than the above three but has WebGL2/WebGPU dual-backend testing burden.

---

## 9. Open questions (web-recast)

Drops native-only questions (CMake paths, HRIR data, pthread). Keeps web-applicable ones (asset packaging, browser audio quirks, ImGui status, mobile, Playwright harness, compile-cache). Adds MAT245-specific questions.

1. **MIDI / MusicXML import strategy.** Three viable paths for the W1 palindrome reader and W6 Messiaen engine: (a) pure-C++ SMF + tiny XML scanner in `_studio_shared/midi_parser.hpp` (~400 LOC total, zero JS deps, recommended); (b) JS parser via `EM_ASM` calling `tonejs/midi` and `vexflow` modules from C++ (more battle-tested but adds a JS dep, complicates asset pipeline); (c) `al_WebFile.hpp` + a TS-side parser in the SPA, feeding parsed-event arrays into WASM via JSON over `EM_ASM`. Recommendation: option (a). User to confirm before Phase 0 work begins.
2. **Score-render output for Bartók/Messiaen.** Two paths: (a) simple piano-roll Mesh — black-key/white-key vertical stripes plus note rectangles (~80 LOC, no JS deps); (b) embed VexFlow via `EM_ASM` to render proper engraving (legibility win for music-theory students, JS dep). Recommendation: ship (a) in Phase 3, reserve (b) for a future polish pass.
3. **Eight-channel ambisonic for the W4 high-dimensional audio piece.** Verify Web Audio supports 8-channel `AudioContext` on Studio Online's target browsers (Chrome/Firefox/Safari latest). If yes, ship the full ambisonic path through `Ambisonics.hpp` (already linked); if no, downmix internally to a 4-channel B-format then binaural HRTF stereo via `web_convolver.hpp`. § 5 Phase 3 risk flag depends on this answer.
4. **Versioning hook backend.** Three options: (a) IndexedDB direct via `idb` (recommended; ~50 MB origin budget, ~200 commits with feature vectors; simplest); (b) `frontend/src/stores/project.ts` extended with an in-memory `commits: ProjectCommit[]` array plus localStorage write-through (no schema migration but bounded by ~5–10 MB); (c) git-style content-addressed storage in IndexedDB (commits are content-addressed blobs, deduplicated; more complex but supports large file trees). Recommendation: (a) for Phase 0; the public API does not change between (a) and (c).
5. **Constraint enforcement scope.** Does the constraint layer apply only to the new MAT245 examples, or do we retrofit existing studio examples (e.g., `studio-env-*`, `mat200b-*`)? Recommendation: MAT245-only for now. Retrofit is opt-in via the constraint shell example, not via top-level enforcement.
6. **Asset license picks.** Per § 0.4: Bartók palindrome reader uses *Mikrokosmos 141* + *Music for Strings II* (US-PD, EU-PD as of 2026); Messiaen engine ships Stravinsky *L'Histoire du soldat* "Soldier's March" as the default-shipped fallback (US-PD), with Messiaen's *Quatuor pour la fin du Temps* documented as user-supplied; Database-vs-narrative bundles 50 CC0 A/V fragments from Pexels/Pixabay/FMA (~30 MB total). Document each pick per example in `assets/mat245/CREDITS.md`. User to confirm comfortable with US-only PD interpretation (the studio is US-hosted; the EU PD-2026 caveat does not affect production).
7. **AlloSphere relevance.** Two MAT245 examples are AlloSphere-rendering candidates: the Xenakis grammar engine (3D ruled surfaces and stochastic clouds, designed for hemispherical immersion) and the high-dimensional visual piece (HDRI + PBR scene tour, naturally panoramic). Should the plan include a "render in AlloSphere" deployment target documented per example? Recommendation: yes, as a one-paragraph "AlloSphere note" at the foot of each example's source comment, citing speaker-layout assumptions and the `al_WebEnvironment.hpp` HDRI configuration. The Studio Online build itself does not target the AlloSphere — that path runs through the native AlloLib build — but documenting the bridge is cheap and instructive for MAT students who will deploy there.
8. **Browser audio quirks (carry-over from MAT200B § 6).** Same constraints apply: `AudioContext` requires user gesture (Run button handles); sample rate is 44.1 kHz on macOS Safari, 48 kHz on most Chrome/Firefox installs; worklet block size fixed at 128; mic input requires getUserMedia. MAT245's W4 high-dimensional audio piece adds the 8-channel question (§ 6 question 3 above).
9. **ImGui status (carry-over).** Confirmed stubbed; UI lives in `WebControlGUI` (Vue Params panel) or in-canvas `Mesh`-drawn widgets. The PC clock for the T/I clock example, the SSM heatmap for the coherence inspector, and the Forte-table widget for the set-class transformer all draw their own widgets in-canvas.
10. **Test harness integration.** Per `CLAUDE.md`, `tests/e2e/comprehensive-functional-tests.spec.ts` enumerates examples from the `examples` export. Confirm new MAT245 entries are spread into that export — same one-line addition as MAT200B (the `mat245Examples` array spreads after `mat200bExamples`).
11. **Compile cache.** `compile.sh` already hashes the source string; MAT245 helpers are header-only so the cache hit rate stays high. Heavy examples (Xenakis grammar with 3D mesh generation, cross-modal coherence with optical flow) may push compile time toward 40–60 s on a cold cache — acceptable per MAT200B § 6 question 9.
12. **Mobile.** Carry-over from MAT200B § 6 question 5: desktop-only by spec, document "best on desktop, Chrome/Firefox/Safari ≥ recent". MAT245's analysis-heavy entries (multi-scale viewer, coherence inspector, diff browser) make even less sense on mobile than MAT200B's synthesis-heavy entries.


---

# MAT245 — Multimedia Composition: Buildable Examples Plan (Weeks 1–3)

> Sections 1+2+3 recast the MAT245 syllabus into **registry entries** for `frontend/src/data/playgroundExamples.ts`. The compile target is the WASM toolchain in `backend/docker/compile.sh`; the canonical include is `allolib-wasm/include/al_playground_compat.hpp`. `App` → `WebApp`, `ControlGUI` → `WebControlGUI` are handled either by `frontend/src/services/transpiler.ts` (when authors paste native code) or by the `al_playground_compat.hpp` aliasing (when authors author web-native).
>
> **Universal web caveats** (don't repeat per entry):
> - **Audio block 128** (worklet quantum, `frontend/public/allolib-audio-processor.js`); `transpiler.ts` clamps `configureAudio` to ≤256. Author with `configureWebAudio(<sr>, 128, 2, 0)`.
> - **Sample rate** comes from `audioContext.sampleRate` (44.1 / 48 kHz). Always `gam::sampleRate(audioIO().framesPerSecond())` in `onCreate`.
> - **No ImGui** in WASM — `WebControlGUI` exposes parameters to the Vue panel (`_al_webgui_*` exports). No in-canvas widgets; text is `al::Mesh`-rendered or Vue-overlaid.
> - **No `cookbook/Pickable`** — use `_studio_shared/pickable.hpp` (manual hit-testing on `App::onMouseDown/Drag/Up`, ported from cookbook).
> - **No native MIDI / RtMidi** — use `al_WebMIDI.hpp` (Web MIDI API) for hardware I/O; for `.mid` files use Phase 0 `_studio_shared/midi_parser.hpp` (in-browser SMF reader). MusicXML uses a TS-side parser (`frontend/src/services/musicxml.ts`) that emits JSON, marshalled into WASM via `Module.HEAPU8` + `stringToUTF8`.
> - **MIDI hardware** (the symmetry-clock entry's "fader = T_n" optional twist): Web MIDI works on Chromium / Edge, requires user gesture + permission prompt, **not supported on Safari** — degrade gracefully.
> - **No raw sockets / OSC over UDP** — bridge server out of scope; control via `WebControlGUI` and Web MIDI.
> - **Available DSP.** `Gamma/Filter.h`, `Gamma/DFT.h` (DFT, STFT MAG_PHASE round-trip), `Gamma/Effects.h`, `Gamma/Envelope.h`, `Gamma/Oscillator.h`, `Gamma/Analysis.h`, `Gamma/HRFilter.h`. `WebSamplePlayer` replaces `SoundFile` (transpiler-rewritten).
> - **Graphics.** `al::Mesh`, `al::Texture`, `al::EasyFBO`, `al::ShaderProgram` build under WebGL2 (`ALLOLIB_WEBGL2=1`); GLSL must be ES 3.0 with explicit precision qualifiers. No geometry shaders. Compute shaders only on WebGPU backend.
> - **State persistence.** `_studio_shared/versioned_state.hpp` writes JSON to IDBFS (`-lidbfs.js` is in compile flags) for portfolio artifacts (perceptual thresholds, recorded gestures, palindrome scores).
> - **New helpers grown by W1–W3** (added to `_studio_shared/`):
>   - `group_theory.hpp` (Phase 1) — `Transform`, `PCSet`, `Shape2D`, `ParamTraj` types with a unified `apply(Transform)` interface.
>   - `pcset_engine.hpp` (Phase 1) — Forte-number lookup, normal/prime form, T_n/I_n/M_5/M_7, interval vector.
>   - `multi_scale_features.hpp` (Phase 1) — micro/meso/macro feature pyramid.
>   - `midi_parser.hpp` (Phase 0) — SMF byte-level reader; emits `vector<NoteEvent>`.
>   - `similarity_matrix.hpp` (Phase 0) — self-similarity / cross-similarity over feature streams (used by palindrome + multiscale).
>   - `optical_flow.hpp` (Phase 0) — Lucas-Kanade pyramid (used by W2 asymmetric-balance, future W4+).
>   - Plus reuse of existing `audio_features.hpp`, `automation.hpp`, `param_graph.hpp`, `draw_canvas.hpp`, `post_fx.hpp`, `pickable.hpp`, `versioned_state.hpp`, `constraint_layer.hpp`.

---

## 1. Section 1 — Week 1: Symmetry as Foundation

> The "AlloSphere lineage" cluster. Theme: symmetry as a generative/analytical primitive. All three entries share the dihedral D₁₂ group as substrate (the 24-element group generated by the 12 transpositions T_n and 12 inversions I_n on pitch-class space, isomorphic to the symmetries of the regular 12-gon).

---

### Group-theory composition engine

1. **Title** — verbatim.
2. **Registry entry** —
```ts
{
  id: 'mat245-w1-group-theory-engine',
  title: 'Group-theory composition engine',
  description: 'Unified transformation surface: one Transform op simultaneously drives a PC-set sequencer, a 2D shape under D₁₂, and a parameter-automation lane. Buttons T₁..T₁₁, I₀..I₁₁, M₅, M₇, R apply the same group element across all three media.',
  category: 'mat245-symmetry',
  subcategory: 'group-theory',
  code: `…`,
}
```
Category placement: new top-level category `mat245-symmetry` (added to `playgroundCategories`). Subcategory `'group-theory'` groups all three Week 1 entries.
3. **AlloLib classes** — `al::WebApp`, `WebControlGUI` (transformation buttons, T_n/I_n/M_5/M_7/R triggers), `al::Mesh` `LINE_LOOP` (PC clock 12-gon), `al::Mesh` `TRIANGLES` (shape canvas polygon), `al::Mesh` `LINE_STRIP` (parameter automation lane), `al::Parameter` group `"transform"`, `gam::SineD<>` polyphonic voice (one per active PC), `gam::Env<3>` ADSR per voice, `gam::Pan<>`, `_studio_shared/pickable.hpp` (drag a vertex to rotate the shape; rotation snaps to nearest T_n).
4. **Audio plan** — Apply current `Transform op` to internal `PCSet pcs`; map each pitch-class (0–11) to a `gam::SineD<>` at f = 440 · 2^((pc + register·12)/12) with amplitude scaled by 1 / |pcs|. Trigger on button press; envelope attack 10 ms, sustain on hold, release 400 ms. Block 128, sr from `audioIO().framesPerSecond()`. Ring-buffer post-mix RMS for the param-lane visualization.
5. **Visual plan** — Three side-by-side viewports laid out via `Viewpoint` push/pop. **Left:** PC clock — 12-vertex `Mesh::LINE_LOOP` (radius 1.5), filled `addDisc` markers at active PCs (color-coded by interval class), hand-line from center to current root. **Middle:** Shape canvas — user-defined `Mesh::TRIANGLES` polygon (default = scalene quadrilateral, deliberately asymmetric for legibility), redrawn after each `op.applyToShape`. **Right:** Parameter automation lane — last 16 transforms recorded as a `LINE_STRIP` over time (x = transform index, y = encoded group element ordinal in [0, 24)). Top row: 12 transposition buttons + 12 inversion buttons + M₅ + M₇ + R (retrograde) as `WebControlGUI` triggers.
6. **A→V coupling** — Active PCs in `pcs` → clock-vertex highlight + sounding `SineD` voices (audio + visual stay synchronized via the same `pcs` integer mask). Shape rotation/reflection state → triangle vertex positions. Transform history → parameter-lane vertex stream. Single `op` mutation propagates everywhere in one frame: `op.apply(pcs); op.apply(shape); paramLane.record(op);`.
7. **Twist implementation** — Unified `Transform op;` lives in `_studio_shared/group_theory.hpp` as a tagged union: `enum class Kind { T, I, M5, M7, R }; int n; // 0..11 for T/I`. Each typed object exposes `apply(Transform)`: `PCSet::apply` does `pc → (T.n + s·pc) mod 12` (with `s=−1` for I, `s=5` for M₅, `s=7` for M₇); `Shape2D::apply` does the corresponding 2D rigid motion (T_n = rotation by n·30°, I_n = reflection across the line through n·15°, M₅/M₇ = no-op spatially but flag the shape's hue, R = reverses traversal direction); `ParamTraj::apply` appends `op` to a CSV-equivalent stream. The unified call site is literally `pcs.apply(op); shape.apply(op); traj.apply(op);` — three lines in `WebControlGUI` button callbacks.
8. **Size estimate** — Medium, ~600 LOC (excluding `group_theory.hpp` helper which is shared).
9. **Helpers** — `_studio_shared/group_theory.hpp` (**new, Phase 1** — `Transform`, `PCSet`, `Shape2D`, `ParamTraj` types with unified `apply` interface; ~250 LOC), `_studio_shared/pcset_engine.hpp` (**new, Phase 1** — Forte-number lookup table, normal+prime form algorithms; ~300 LOC), `_studio_shared/automation.hpp` (param-lane history persistence), `_studio_shared/pickable.hpp` (clock-hand drag), `_studio_shared/versioned_state.hpp` (save transformation sequence as portfolio artifact).
10. **Web-specific risks** — **Low.** All-procedural; no asset shipping. Forte-number lookup is a static `constexpr` table embedded in the helper header (~12 KB). The 24 transformation buttons are a lot for `WebControlGUI`; group them via `Parameter::group("T_n")` / `Parameter::group("I_n")` / `Parameter::group("multiplicative")` so the Vue panel can collapse sections. No MIDI dependency in baseline; optional twist (faders mapped to T_n on a hardware MIDI controller) needs Web MIDI — Chromium/Edge only, gracefully degrade.

---

### Bartók palindrome reader

1. **Title** — verbatim.
2. **Registry entry** —
```ts
{
  id: 'mat245-w1-bartok-palindrome',
  title: 'Bartók palindrome reader',
  description: 'Load a MIDI or MusicXML score, detect retrograde-symmetric passages within a tolerance window, and render a piano-roll with palindrome axis lines and a violation-map overlay where symmetry breaks.',
  category: 'mat245-symmetry',
  subcategory: 'group-theory',
  code: `…`,
}
```
3. **AlloLib classes** — `al::WebApp`, `WebControlGUI` (file picker trigger, tolerance slider, axis-position scrubber, playback transport), `al_WebFile.hpp::fetchToMemfs` for `.mid` upload + IDBFS persistence, `al::Mesh` `TRIANGLES` (piano-roll note rectangles), `al::Mesh` `LINES` (palindrome axis), `al::Texture` (violation-map heatmap, RGBA8), `al::EasyFBO` (offscreen heatmap render target), `WebSamplePlayer` (optional audio rendition via a sampled grand piano, asset under `frontend/public/assets/mat245/piano/`), `gam::Env<3>` per voice if synthesizing instead. **Note:** RtMidi for hardware MIDI input is replaced by `al_WebMIDI.hpp` (Web MIDI API) — only used for live-input mode; baseline reads files.
4. **Audio plan** — Score-driven playback: walk `vector<NoteEvent>` (parsed from SMF / MusicXML), schedule onsets via `SynthSequencer`. Optional sampled piano via `WebSamplePlayer` (one velocity-layered C4 sample, pitch-shifted per note — keeps payload <2 MB). Block 128, sr from worklet. Score loading is one-shot async in `onCreate`: TS side parses MusicXML → JSON → `EM_ASM` writes to a shared `vector<uint8_t>` → C++ `_studio_shared/midi_parser.hpp::parseJSON` (or `parseSMF` for `.mid`).
5. **Visual plan** — Piano-roll viewport: x = time (beats), y = MIDI pitch (21–108). Each note rendered as a `Mesh::TRIANGLES` rectangle (start, dur, pitch, color = voice-index hue). Vertical playhead `LINES`. **Palindrome axis** drawn as a single thick `LINES` segment at user-scrubbable x-position (default = score midpoint). **Violation map** rendered into an `EasyFBO`-backed `Texture` (width = score-length pixels, height = pitch-range): for each (t, pitch) cell, sample `violation_intensity(t, pitch, axis)` ∈ [0,1] and draw as red overlay at α = intensity. A "candidate axes" minimap below shows the top-5 axis positions ranked by symmetry score.
6. **A→V coupling** — Score events drive sounding voices and piano-roll positions in the same `vector<NoteEvent>` (single source of truth). Axis x-position drives violation-map regeneration (debounced, 200 ms). Tolerance slider drives the matching window (in beats and in semitones independently); changing it rebuilds the violation texture in <50 ms for ≤2000 notes.
7. **Twist implementation** — Detection algorithm: given axis at time `t_a`, for each note `n_i = (t_i, p_i, dur_i)`, find the best mirror match `n_j` minimizing `cost = w_t · |（t_j − t_a) + (t_i − t_a)| + w_p · |p_j − (p_pivot − (p_i − p_pivot))|` within tolerance window `(Δt, Δp)`. Symmetry score = `1 − Σ min_costs / |N|`. Violation intensity at note `i` = `min_cost_i / max_cost`. Auto-axis search: sweep `t_a` over the score, return top-5 local maxima of the global score. Pitch-axis: `p_pivot` is a free parameter, defaulted to the median pitch of the matched pair set; user can lock it to a specific pitch via `WebControlGUI`. The "violation map" is the visual deliverable — students can see exactly *where* a Bartók passage breaks the palindrome (e.g., the deliberate asymmetry at the climax of *Music for Strings, Percussion and Celesta*, second movement).
8. **Size estimate** — Small, ~450 LOC (parser is in helper).
9. **Helpers** — `_studio_shared/midi_parser.hpp` (**new, Phase 0** — minimal SMF reader + delta-time decoder, ~300 LOC; MusicXML path uses `frontend/src/services/musicxml.ts` parsing in TS, marshalled in via `EM_ASM`), `_studio_shared/similarity_matrix.hpp` (**new, Phase 0** — self-similarity over note-event streams; the palindrome detector calls into this with a reverse-stream comparator), `_studio_shared/draw_canvas.hpp` (piano-roll renderer + axis-drag handle), `_studio_shared/versioned_state.hpp` (save axis position + tolerance + score hash as portfolio artifact).
10. **Web-specific risks** — **MusicXML parsing is the load-bearing risk.** Native plan would use a C++ XML library; web plan splits work: `.mid` files parsed entirely in WASM (`midi_parser.hpp`), MusicXML parsed in TS (`frontend/src/services/musicxml.ts`, ~400 LOC) and passed in as JSON via `Module.stringToUTF8`. Document the marshalling pattern in helper docstring. Optional sampled-piano asset (~2 MB) goes under `frontend/public/assets/mat245/piano/c4_velocity_layers.opus`. File-picker UI is Vue-side `<input type="file">`; native code only sees the parsed event vector. **No Safari Web MIDI** — live-input mode gracefully degrades to "MIDI input unavailable on this browser" message.

---

### T/I clock

1. **Title** — verbatim.
2. **Registry entry** —
```ts
{
  id: 'mat245-w1-ti-clock',
  title: 'T/I clock',
  description: '12-vertex polygon with a draggable hand. Drag rotates by T_n; click flips by I_n. Each transformation triggers a chord. Trace mode records the operation sequence; Replay mode plays it back as a piece.',
  category: 'mat245-symmetry',
  subcategory: 'group-theory',
  code: `…`,
}
```
3. **AlloLib classes** — `al::WebApp`, `WebControlGUI` (tempo, replay trigger, clear-trace, voicing-mode menu), `al::Mesh` `LINE_LOOP` (12-gon), `al::Mesh` `addDisc` ×12 (vertex markers), `al::Mesh` `LINES` (clock hand), `_studio_shared/pickable.hpp` (12 vertex pickables + 1 hand pickable, ~13 hit-tested elements total), `gam::SineD<>` polyphonic (3-voice chord per click), `gam::Env<3>` ADSR, `gam::Pan<>`, `al::Parameter` group `"trace"`.
4. **Audio plan** — On each transformation event: trigger a 3-note chord at frequencies `f_k = 440 · 2^((pc_k − 9)/12)` for k ∈ active set. Voicing menu: "PC = root+third+fifth" (default), "PC = full PC mask", "PC = single tone". Block 128. Replay mode walks the recorded `vector<Transform>` at user-set tempo (BPM `Parameter` 30–180), triggering chords on each step. Sr from worklet.
5. **Visual plan** — Centered 12-gon in screen middle; vertex markers labeled 0–11 as `addDisc` filled in highlight color when in active PC set. Clock hand from center to current root vertex; hand position interpolated smoothly during T_n animation (200 ms ease, parameterized t in `onAnimate`). Click on a vertex → `I_n` flip animation (mirror across axis through clicked vertex; 250 ms). **Trace mode:** dotted polyline (`LINE_STRIP` with stipple-pattern shader from `post_fx.hpp`) connecting consecutive hand-tip positions in transformation history, fading older steps via per-vertex alpha.
6. **A→V coupling** — Hand angle (radians) → discrete root pc = `round(angle / (π/6)) mod 12`. Transformation event → chord trigger + visual animation start. Replay step → same chord + same visual update, walking the recorded sequence. Single `Transform` event drives audio onset, hand position, and trace polyline append in one frame.
7. **Twist implementation** — `vector<Transform> trace;` records every user gesture. **Trace mode toggle (`ParameterBool`):** on → record, off → freeze. **Replay** walks `trace` at user tempo: `for (auto& op : trace) { schedule(op, t); t += beat; }`. The recorded sequence becomes a piece — students can save a `trace` to IDBFS via `versioned_state.hpp` and reload it as a "composed piece". Trace is a path through the 24-element dihedral group; the visual trace polyline is a literal walk on the group's Cayley graph (in 2D embedding). Optional: export trace as a notated chord sequence (Vue-side renderer reads JSON, renders staff via VexFlow — out of scope for v1).
8. **Size estimate** — Small, ~350 LOC.
9. **Helpers** — `_studio_shared/group_theory.hpp` (shared `Transform` type), `_studio_shared/pickable.hpp` (12 vertex hit-tests + hand drag), `_studio_shared/automation.hpp` (replay engine — reuses the lane scheduler), `_studio_shared/post_fx.hpp` (stipple shader for trace fade), `_studio_shared/versioned_state.hpp` (save trace as portfolio artifact).
10. **Web-specific risks** — **Very low.** Procedural, no asset shipping, no MIDI. Pickable hit-testing on 13 elements is well within budget. Animation timing uses `onAnimate(double dt)` — no monotonic-clock assumptions.

---

## 2. Section 2 — Week 2: Breaking Symmetry / Set Theory

> Theme: PC-set theory as the analytical/generative engine for *controlled* symmetry breaking. Builds on `_studio_shared/pcset_engine.hpp` (Phase 1) — the same Forte-number / interval-vector machinery introduced in Week 1, now exercised across three larger pieces.

---

### Set-class transformer with M5/M7

1. **Title** — verbatim.
2. **Registry entry** —
```ts
{
  id: 'mat245-w2-setclass-transformer',
  title: 'Set-class transformer with M5/M7',
  description: 'PC-set sequencer with prominent Forte-number badge, interval-vector bar chart, and a non-similarity navigator: BFS through M5/M7/T/I space using interval-vector L1 distance as cost.',
  category: 'mat245-symmetry',
  subcategory: 'set-theory',
  code: `…`,
}
```
Subcategory `'set-theory'` groups Week 2 entries.
3. **AlloLib classes** — `al::WebApp`, `WebControlGUI` (transform buttons T₁–T₁₁ / I₀–I₁₁ / M₅ / M₇ / R, "find non-similar" trigger, "clear path" trigger, target-set entry), `al::Mesh` `LINE_LOOP` (PC clock — visual carryover from W1), `al::Mesh` `TRIANGLES` (interval-vector bar chart — 6 bars for IC1..IC6), `al::Mesh` `LINE_STRIP` (path-trace through set-class graph), `_studio_shared/pickable.hpp` (clock vertex picks to enter PCs by clicking), `_studio_shared/pcset_engine.hpp::PCSet`, `gam::SineD<>` polyphonic, `al::Parameter`.
4. **Audio plan** — Same as W1 group-theory engine (one `gam::SineD<>` per active PC, root-pos at 440 Hz). Block 128, sr from worklet. On transformation, retrigger envelope; on path-traversal step (BFS animation), play each visited set-class for 800 ms.
5. **Visual plan** — Three-panel layout. **Top:** Forte-number badge (large, centered) — built from `addPrism` letter-strokes or a tiny SDF-text helper (no in-canvas ImGui), e.g., "5-Z17". **Middle-left:** PC clock as in W1. **Middle-right:** Interval-vector bar chart — 6 vertical bars (IC1..IC6) drawn as `TRIANGLES` rectangles, height = count of that interval class in current PC-set, color-graded blue→red by magnitude. **Bottom:** Set-class graph mini-view — nodes (small disks) for visited Forte-classes, edges for transformations, current node highlighted. Path-trace `LINE_STRIP` overlays the BFS walk.
6. **A→V coupling** — `pcs` mutation → clock highlights + IV bar heights + Forte badge text + sounding voices, all from the same source-of-truth set. BFS step → graph node highlight + IV bar morph (interpolated 300 ms) + chord trigger. Edit-distance metric → edge thickness in graph view.
7. **Twist implementation** — **Non-similarity navigator** = BFS in the set-class graph. **Nodes:** Forte set-classes (pre-enumerated from `pcset_engine.hpp` lookup table — 224 set-classes for cardinalities 0–12). **Edges:** for each pair `(sc_a, sc_b)`, edge exists if there's a transformation in {T_n, I_n, M₅, M₇, R} mapping a representative of `sc_a` to a representative of `sc_b`. **Cost function:** `cost(sc_a, sc_b) = ||IV(sc_a) − IV(sc_b)||_1` where IV is the interval vector (length-6 integer vector). BFS expands frontier with min-cost-first (technically Dijkstra; document as such). Search target: user enters a target Forte number or "find the most dissimilar reachable set-class within k=4 steps". Output: ordered path of set-classes + the transformation labels on each edge. Animation walks the path, playing each set-class. Document: "non-similarity" means high IV distance — this is the M-level concept (set-class similarity by Forte / Castren / Lewin). The cost function is `L1` for legibility; mention `Castren M-similarity` as an alternative metric in inline doc.
8. **Size estimate** — Medium, ~600 LOC.
9. **Helpers** — `_studio_shared/pcset_engine.hpp` (Forte-number lookup, normal+prime form, IV computation; **shared with W1 group-theory engine and W1 T/I clock**), `_studio_shared/group_theory.hpp` (shared `Transform`), `_studio_shared/pickable.hpp` (clock vertex entry), `_studio_shared/draw_canvas.hpp` (IV bar chart renderer; reuses parametric-curve renderer from MAT200B 1.5.10 with a discrete-bin variant), `_studio_shared/versioned_state.hpp` (save BFS paths as portfolio artifacts).
10. **Web-specific risks** — **Low.** 224-node set-class graph fits in <100 KB JSON; pre-enumerate at compile time as a `constexpr` table in `pcset_engine.hpp`. BFS over 224 nodes with branching ≈ 26 (T+I+M+R operations) is trivial — sub-millisecond. Forte-number badge text rendering via mesh-strokes is the only fiddly bit; ship a small SDF-text helper or use Vue-overlay-positioned DOM text (preferred for legibility).

---

### Gradual-vs-sudden symmetry breaker

1. **Title** — verbatim.
2. **Registry entry** —
```ts
{
  id: 'mat245-w2-symmetry-breaker',
  title: 'Gradual-vs-sudden symmetry breaker',
  description: 'Two knobs (asymmetry-amount, asymmetry-rate) become AutomationLanes; the resulting 2D trajectory through (amount, rate) space is rendered as a path. Compare-curves mode overlays multiple recorded trajectories.',
  category: 'mat245-symmetry',
  subcategory: 'set-theory',
  code: `…`,
}
```
3. **AlloLib classes** — `al::WebApp`, `WebControlGUI` (two knob `Parameter`s for amount + rate, REC + PLAY triggers, compare-mode toggle, clear-curves trigger), `al::Mesh` `LINE_STRIP` (current trajectory + N overlay trajectories, each a different hue), `al::Mesh` `TRIANGLES` (background heatmap of "perceptual breakage" zones), `_studio_shared/automation.hpp::AutomationLane` ×2 (one per knob), `gam::SineD<>` ensemble (4-voice chord with per-voice detune driven by `amount`), `gam::Env<3>`, `gam::Comb<>` (FX increasing with rate), `_studio_shared/pickable.hpp` (drag points on the trajectory to scrub).
4. **Audio plan** — Base symmetric structure: 4-voice equal-tempered chord (e.g., C–E–G–C8va). `amount` ∈ [0,1] perturbs each voice frequency by `±amount · σ` where σ is sampled deterministically per voice from a fixed PRNG seed (so the same `amount` always produces the same detuning). `rate` ∈ [0,1] drives a `gam::Comb<>` feedback parameter — at rate=0, comb is bypassed (smooth, "gradual" breakage); at rate=1, comb feedback is high and produces sudden timbral shift. Block 128. Both knobs are continuously evaluated per audio block from `AutomationLane::sample(t)`.
5. **Visual plan** — Main canvas: 2D phase-space plot, x = amount [0,1], y = rate [0,1]. Background `TRIANGLES` heatmap colors quadrants: bottom-left = "still symmetric", top-right = "fully broken", bottom-right = "sudden break", top-left = "gradual drift". Current `(amount, rate)` plotted as a moving disc (`addDisc`). REC mode: appends `(t, amount, rate)` to current `AutomationLane` pair; PLAY mode walks the lane and re-renders the trajectory `LINE_STRIP`. **Compare-curves mode:** load N saved trajectories from IDBFS, render each as a translucent `LINE_STRIP` in a unique hue with semi-transparent fill, label each curve with a small Vue-overlay tag.
6. **A→V coupling** — `(amount, rate)` → audio detuning + comb feedback + 2D disc position + heatmap-quadrant color hint at current location. Trajectory `LINE_STRIP` → audio playback as REC plays back. Compare-mode overlays show how multiple recorded gestures differ — e.g., "fast gradual" vs "slow sudden".
7. **Twist implementation** — Two `AutomationLane` instances (one per knob) recorded in lockstep. **Trajectory** = parametric curve `t → (amount(t), rate(t))` rendered as a `LINE_STRIP` in 2D phase-space. **Compare-curves mode:** persist each recorded trajectory pair to IDBFS as `mat245/symmetry_breaker/curve_<timestamp>.json` via `versioned_state.hpp`; the loader globs the directory and renders all curves in different hues. The pedagogical hit: "gradual" trajectories are smooth, mostly-monotonic paths; "sudden" trajectories have sharp angles. Students see the difference in the shape of their gesture, not just hear it. Heatmap zones are labeled with text overlays for legibility.
8. **Size estimate** — Medium, ~550 LOC.
9. **Helpers** — `_studio_shared/automation.hpp` (two-lane recording — already supports multi-lane from MAT200B), `_studio_shared/draw_canvas.hpp` (2D phase-space renderer with grid + axis labels + overlay polylines), `_studio_shared/versioned_state.hpp` (curve save/load), `_studio_shared/post_fx.hpp` (subtle bloom on the moving disc).
10. **Web-specific risks** — **Low.** All-procedural. IDBFS curve persistence has been validated by MAT200B `automation.hpp`; curve directory listing uses the existing IDBFS glob pattern. Memory: each curve at 60 Hz × 30 s = 1800 points × 16 bytes = 28 KB; a hundred curves comfortably fit in <3 MB.

---

### Asymmetric-balance composer

1. **Title** — verbatim.
2. **Registry entry** —
```ts
{
  id: 'mat245-w2-asymmetric-balance',
  title: 'Asymmetric-balance composer',
  description: '2D draggable elements with size + amplitude; tool computes visual COM and audio COM live. Balance-budget twist constrains: if visual COM drifts left by 20%, audio COM must drift right by 20% within tolerance. Red lines = imbalance; green = in tolerance.',
  category: 'mat245-symmetry',
  subcategory: 'set-theory',
  code: `…`,
}
```
3. **AlloLib classes** — `al::WebApp`, `WebControlGUI` (tolerance `Parameter` ε ∈ [0.01, 0.5], default 0.2; reset button; "lock" toggle to enforce constraint), `al::Mesh` `addDisc` (per-element disc; size encodes mass), `al::Mesh` `LINES` (imbalance indicator lines from canvas-center to each COM), `_studio_shared/pickable.hpp` (drag + resize handles per element — N elements, default N=6, max 12), `_studio_shared/constraint_layer.hpp` (Phase 1 — already on the helper list; this is its first MAT245 use; soft-constraint solver), `gam::SineD<>` polyphonic (one voice per element, frequency = element.id-indexed pitch from a fixed scale), `gam::Pan<>` (pan = element.x), `al::Parameter`.
4. **Audio plan** — N voices, one per element. Per-element parameters: frequency (pitch from major-scale lookup), amplitude, pan. Pan = `clamp(element.x, −1, 1)`; amplitude = `Parameter` per-element (drives audio COM). Block 128, sr from worklet. Audio COM_x = `Σ(amp_i · pan_i) / Σ amp_i` computed every animation frame and passed to graphics.
5. **Visual plan** — Square canvas (centered, ±1 in world coords). Per element: a disc (`addDisc`, radius = `size_param_i`, color = HSV from element.id), draggable via `pickable.hpp`, with a small "amplitude slider" handle attached. Visual COM marker = magenta crosshair at `(Σ size_i·pos_i) / Σ size_i`. Audio COM marker = cyan crosshair at `(Σ amp_i·pos_i) / Σ amp_i`. **Imbalance indicator:** thick `LINES` segment from canvas-center to each COM; segment color = red if `|visualCOM + audioCOM| > ε` (i.e., the COMs aren't mirror-balanced about origin) else green. Legend (Vue-overlay): "Aim: visual drift left ⇔ audio drift right".
6. **A→V coupling** — Element drag updates visual COM in real-time; element amplitude param updates audio COM. Both COMs feed the imbalance metric `|visualCOM_x + audioCOM_x|`; if > ε, indicator goes red and (when "lock" is enabled) the constraint solver nudges amplitude params to bring them back. Per-voice audio is synchronously driven by the element list.
7. **Twist implementation** — **Balance budget:** the metric is `|visualCOM + audioCOM|` (vector sum, not difference — when they're mirror-symmetric about origin, the sum is zero). User drag of an element off-center shifts visualCOM; the tool then *requires* the user to compensate by adjusting other elements' amplitudes so audioCOM mirrors. **Lock mode:** when ON, `constraint_layer.hpp::softSolve` finds the nearest set of amplitude values that satisfies `audioCOM_x ≈ −visualCOM_x` and `audioCOM_y ≈ −visualCOM_y` within ε; runs every animation frame as a constrained least-squares (analytic since it's linear). User sees their amplitude sliders auto-adjust as they drag — a teaching moment on how compensation feels. **Off mode:** user must manually adjust; red/green feedback shows them where they stand. Tolerance ε is user-controllable (`Parameter`); tighter ε = harder game.
8. **Size estimate** — Small, ~400 LOC.
9. **Helpers** — `_studio_shared/pickable.hpp` (per-element drag + resize), `_studio_shared/constraint_layer.hpp` (soft-constraint solver — first use in MAT245; ~150 LOC, analytic least-squares for the linear case here), `_studio_shared/draw_canvas.hpp` (canvas grid + COM crosshair + imbalance lines), `_studio_shared/versioned_state.hpp` (save final layouts as portfolio artifacts).
10. **Web-specific risks** — **Low.** All-procedural. Pickable hit-test for N=12 + handles is well within budget. Per-voice `gam::SineD<>` ensemble (12 voices × 128 samples) is ~2K multiply-adds per block — trivial.

---

## 3. Section 3 — Week 3: Sync / Desync

> Theme: temporal sync as the perceptual variable. Three entries probe sync at the sample level (phase shifter), the formal level (multi-scale viewer), and the perceptual-threshold level (interactive ABX).

---

### Phase shifter (Reich engine)

1. **Title** — verbatim.
2. **Registry entry** —
```ts
{
  id: 'mat245-w3-phase-shifter',
  title: 'Phase shifter (Reich engine)',
  description: 'Two SamplePlayers; player B has a slow rate detune (e.g., ×1.0001). Phase trajectory rendered as line-strip of (B.t − A.t) over wall-clock time. Rephase button instantly relocks. Trail mode keeps full history.',
  category: 'mat245-symmetry',
  subcategory: 'sync-desync',
  code: `…`,
}
```
Subcategory `'sync-desync'` groups Week 3 entries.
3. **AlloLib classes** — `al::WebApp`, `WebControlGUI` (rate-offset slider [-0.01, +0.01] around 1.0, rephase trigger, trail-mode toggle, sample selector menu, gain), `WebSamplePlayer` ×2 (with adjustable playback rate via internal phase increment), `al::Mesh` `LINE_STRIP` (phase trajectory: x = wall-clock seconds, y = `t_B − t_A` modulo loop length), `al::Mesh` `LINES` (zero-line + grid), `gam::EnvFollow<>` ×2 (per-player RMS for visual feedback), `al::Parameter`.
4. **Audio plan** — Both players load the same source (a short looped phrase, ~5–10 s, e.g., a piano figure or hand-claps in homage to *Piano Phase*). Player A plays at rate=1.0; player B at rate=`1.0 + offset` where offset is user-controlled. Block 128, sr from worklet. Phase difference `Δt = t_B − t_A` measured in source samples; reported to graphics every animation frame via `std::atomic<float>`. **Rephase:** sets `t_B = t_A` instantly (buffer-aligned), restoring sync.
5. **Visual plan** — Top panel: two waveform `LINE_STRIP`s (overlaid, alpha-blended), one per player, scrolling left at the looper rate. Bottom panel: phase trajectory — `LINE_STRIP` of `(wall_clock_t, Δt mod loopLen)` plotted with x = time (last 60 s), y = phase difference [−loopLen/2, +loopLen/2]. Trajectory wraps around y-edges (modular topology) — render as multiple disconnected segments. **Trail mode** keeps the entire session history as a faded `LINE_STRIP` (alpha decays linearly with age). Rephase events are marked as vertical `LINES` ticks on the time axis.
6. **A→V coupling** — Per-block `Δt` → trajectory vertex append + visual playhead-offset between the two waveforms. Rephase event → instantaneous trajectory discontinuity (visible as a vertical jump). RMS of each player → waveform thickness/alpha, so users can see *which* player they're attending to in moments of audible separation.
7. **Twist implementation** — Reich's phase-shift technique made literal: the trajectory `LINE_STRIP` *is* the piece. Different rate offsets produce different visual signatures: 1.0001 = slow linear ramp; 1.001 = steeper ramp; 1.01 = nearly vertical. **Rephase button** is the "reset" Reich's musicians performed by ear — here it's a single `WebControlGUI` trigger. **Trail mode** keeps the entire session history visible — students see their full phase-walking gesture as a single drawing. Save the trail polyline to IDBFS via `versioned_state.hpp` (per-session SVG-equivalent JSON).
8. **Size estimate** — Small, ~300 LOC.
9. **Helpers** — `_studio_shared/automation.hpp` (rate-offset envelope recording), `_studio_shared/post_fx.hpp` (trail-fade shader, reuse from MAT200B phosphor decay), `_studio_shared/versioned_state.hpp` (trail save), `_studio_shared/draw_canvas.hpp` (phase-space renderer).
10. **Web-specific risks** — **Low.** Single short audio asset (~1 MB opus): a license-clean piano phrase under `frontend/public/assets/mat245/phrases/reich_loop_a.opus`. `WebSamplePlayer::ready()` polled in `onAnimate`. Rate-adjustment fidelity: `WebSamplePlayer` interpolates internally — verify no clicks at the rate-step boundaries (smoke test). Browser autoplay policy: requires user-gesture trigger on the initial play.

---

### Multi-scale temporal viewer

1. **Title** — verbatim.
2. **Registry entry** —
```ts
{
  id: 'mat245-w3-multiscale-temporal',
  title: 'Multi-scale temporal viewer',
  description: 'Three stacked timelines (micro / meso / macro) with linked playhead, each scrolling at its own rate. Roads-test twist: user clicks moments to mark micro/meso/macro perception; tool computes precision/recall vs algorithmic detection.',
  category: 'mat245-symmetry',
  subcategory: 'sync-desync',
  code: `…`,
}
```
3. **AlloLib classes** — `al::WebApp`, `WebControlGUI` (scale-rate sliders ×3, "mark micro" / "mark meso" / "mark macro" triggers, "compute precision/recall" trigger, source loader), `WebSamplePlayer`, `al::Mesh` `LINE_STRIP` ×3 (per-scale feature curves), `al::Mesh` `LINES` (linked playhead + user marks + algorithmic marks), `al::Mesh` `addDisc` (mark dots), `_studio_shared/multi_scale_features.hpp` (Phase 1), `_studio_shared/audio_features.hpp` (RMS, centroid, ZCR primitives feeding the pyramid), `gam::EnvFollow<>` ×3 (one per scale, time constants 5 ms / 250 ms / 2.5 s), `al::Parameter`.
4. **Audio plan** — Source through three parallel feature extractors at different time scales: **micro** (RMS, centroid, ZCR over 5 ms windows; ~256-sample blocks), **meso** (event-onset detection over 250 ms windows; spectral flux peak-pick), **macro** (section-boundary detection over 2.5 s windows; novelty-curve from self-similarity matrix in `similarity_matrix.hpp`). Block 128. All three scales computed every block but downsampled for storage (e.g., macro stored at 4 Hz). Algorithmic detection: peak-pick on each scale's feature curve with scale-appropriate thresholds yields algo-marks.
5. **Visual plan** — Three stacked timelines, each ~⅓ canvas height. Each timeline scrolls left at its own rate (micro: 50 px/s, meso: 5 px/s, macro: 0.5 px/s). Linked playhead = a single shared time `t` rendered as a `LINES` vertical on each panel — its x-position differs per panel because the scroll rates differ, but it represents the same instant. Per-scale feature curve as `LINE_STRIP`. **User marks** drawn as colored `addDisc` on the relevant panel (color = scale: red/green/blue). **Algo marks** drawn as `addDisc` with a different shape/border style.
6. **A→V coupling** — Audio playback `t` → playhead positions on all three panels (synced). Per-scale feature value → curve y. User mark trigger → append `(t, scale)` to user-mark list + render dot. Algo detection → append `(t, scale)` to algo-mark list + render dot. The "linked playhead" is the synchronization device — students see how the same instant looks at three different scales simultaneously.
7. **Twist implementation** — **Roads-test mode** (named after Curtis Roads' time-scale taxonomy in *Microsound*): user listens through a piece, clicks "mark micro" / "mark meso" / "mark macro" each time they perceive a feature at that scale. After playback, the tool computes precision/recall vs algorithmic detection: for each scale, match user-marks to algo-marks within a scale-appropriate tolerance window (micro: ±50 ms, meso: ±500 ms, macro: ±5 s); report `precision = TP/(TP+FP)`, `recall = TP/(TP+FN)`, F1. Display result panel (Vue-overlay, since static text) with per-scale scores. **Personal calibration:** save (audio_hash, scale, marks) as JSON to IDBFS via `versioned_state.hpp`; over multiple sessions and pieces, accumulate the user's perception profile — "user X marks meso events later than algo by 180 ms on average; user X under-marks macro." This becomes a portfolio artifact.
8. **Size estimate** — Medium, ~700 LOC.
9. **Helpers** — `_studio_shared/multi_scale_features.hpp` (**new, Phase 1** — the micro/meso/macro feature pyramid; ~400 LOC; depends on `audio_features.hpp` primitives + `similarity_matrix.hpp` for macro novelty curve), `_studio_shared/similarity_matrix.hpp` (**Phase 0** — already used by W1 palindrome reader; reused here for macro novelty), `_studio_shared/audio_features.hpp` (RMS/centroid/ZCR/spectral-flux primitives), `_studio_shared/automation.hpp` (mark-event recording), `_studio_shared/versioned_state.hpp` (save calibration data).
10. **Web-specific risks** — **Medium.** Source audio asset: ship a 60-s representative piece (e.g., a Xenakis stochastic excerpt, license-clean from CC sources) at `frontend/public/assets/mat245/multiscale/source.opus` (~1.5 MB). Macro novelty curve via similarity-matrix is the heaviest computation: for a 60-s source at 4 Hz, that's a 240×240 matrix = 57600 cells, computed once at load; budget ~200 ms on cold load. Don't recompute per block. Three feature pyramids running simultaneously in the audio thread is the budget concern — measure on Chromebook target; if tight, downsample meso/macro to compute every Nth block (every 4th block at 48 kHz still gives 94 Hz update on meso, fine for visual).

---

### Sync/desync interactive

1. **Title** — verbatim.
2. **Registry entry** —
```ts
{
  id: 'mat245-w3-sync-desync-abx',
  title: 'Sync/desync interactive',
  description: 'Two metronomic streams with adjustable inter-stream offset. Perceptual-threshold probe twist: ABX-test scaffold randomizes offset across N trials, fits psychometric function, outputs user threshold in ms. Saves to versioned_state for portfolio.',
  category: 'mat245-symmetry',
  subcategory: 'sync-desync',
  code: `…`,
}
```
3. **AlloLib classes** — `al::WebApp`, `WebControlGUI` (start-trial trigger, A/B/X response triggers, trial-count `Parameter`, "fit psychometric" trigger, save-result trigger, manual-mode offset slider for free exploration), `WebSamplePlayer` ×2 (or `gam::SineD<>` clicks if no asset), `gam::Env<3>` (short attack/release for click rendering), `al::Mesh` `addDisc` ×2 (visual blink markers per stream), `al::Mesh` `LINE_STRIP` (psychometric curve fit), `al::Mesh` `addDisc` per-trial (data points), `al::Parameter`.
4. **Audio plan** — Two streams of click/tone events at fixed period (default 500 ms = 120 BPM). Stream A always at `t = k·T`; stream B at `t = k·T + offset_ms·1e-3`. Click rendering: short tone `gam::SineD<>` with 5 ms attack / 50 ms release at 1 kHz; or a sample asset (`/assets/mat245/clicks/click_a.opus` and `click_b.opus` if differentiated by timbre). Block 128. Offset is the experimental variable; controlled programmatically per trial.
5. **Visual plan** — Manual-explore mode: minimal — two blink markers (`addDisc`) flashing on each stream's onset; a small text counter (Vue-overlay) for current offset in ms. **ABX trial mode:** centered text "Trial k of N" + three buttons A / B / X (Vue-side, mapped to `WebControlGUI` triggers). After all trials complete, render psychometric function plot: x = `|offset|` in ms (log scale), y = proportion correct ∈ [0,1]; data points as `addDisc`, fitted curve as `LINE_STRIP`. **Threshold readout** (the `|offset|` value where p_correct = 0.75) shown as a vertical `LINES` indicator + Vue-overlay text "Your threshold: 18.4 ms".
6. **A→V coupling** — Stream onsets → click audio + blink. Trial offset → audio inter-stream gap. User response → trial datapoint append. Fit results → curve + threshold marker.
7. **Twist implementation** — **Real ABX scaffold.** Per trial: randomize whether reference X matches A or B (50/50). Randomize the offset magnitude uniformly in log-space across `[1, 100]` ms (reasonable bounds for human inter-onset perception). For each trial: play A (offset=0, "synced"), play B (offset=±trial_offset, "desynced"), play X (= A or B). User clicks "X = A" or "X = B". Record `(trial_offset, correct)` to `vector<TrialResult>`. After N trials (default 30), fit a logistic psychometric function `p_correct(offset) = 0.5 + 0.5 / (1 + exp(−k·(log(offset) − log(threshold))))` via gradient descent (8–10 iterations, simple closed-form gradient on the logit; ~50 LOC). Output: threshold in ms (offset where p_correct = 0.75 by convention) and slope k. **Save results** as `mat245/sync_desync/threshold_<timestamp>.json` to IDBFS via `versioned_state.hpp`: `{ trials, fitted_threshold_ms, fitted_slope, audio_context_sr, user_session_id }`. Across multiple sessions, students build a personal threshold-vs-context table (their threshold for clicks vs tonal sounds vs noise sources; their threshold at the start of the term vs the end).
8. **Size estimate** — Small, ~400 LOC.
9. **Helpers** — `_studio_shared/versioned_state.hpp` (threshold-result persistence; portfolio artifact), `_studio_shared/automation.hpp` (trial sequencer with deterministic PRNG seeding for reproducibility), `_studio_shared/audio_features.hpp` (only RMS for blink-marker brightness — minimal use), `_studio_shared/draw_canvas.hpp` (psychometric plot renderer; reuses 2D plot infrastructure from W2 symmetry-breaker). The psychometric-fit logistic regression is small enough to inline in the example file (~50 LOC) — does not need its own helper.
10. **Web-specific risks** — **Low–medium.** Click-precision is the load-bearing concern: Web Audio scheduling has ~5 ms resolution at the worklet boundary, but the worklet's 128-frame quantum (~2.7 ms at 48 kHz) is finer than typical perceptual threshold (~20–50 ms for trained listeners on click pairs), so this is OK. Sample-accurate click placement requires submitting events with sample-frame offsets in `onSound` — not relying on `setTimeout`. Document this caveat in the example header. Asset (optional differentiated click sounds) ~100 KB total. Browser autoplay policy: trial start requires a user gesture. Save-to-IDBFS uses the same path pattern as MAT200B `automation.hpp` lanes.

---

## Helpers grown by W1+W2+W3

This plan grows the `_studio_shared/` directory with **three new Phase 1 helpers** and exercises **three Phase 0 helpers** for the first time.

| Helper | Status | Used by |
|---|---|---|
| `group_theory.hpp` | **new, Phase 1** | W1 group-theory engine; W1 T/I clock; W2 set-class transformer |
| `pcset_engine.hpp` | **new, Phase 1** | W1 group-theory engine; W2 set-class transformer; reused throughout MAT245 |
| `multi_scale_features.hpp` | **new, Phase 1** | W3 multi-scale temporal viewer; reused in later weeks |
| `midi_parser.hpp` | **new, Phase 0** | W1 Bartók palindrome reader |
| `similarity_matrix.hpp` | **new, Phase 0** | W1 Bartók palindrome reader; W3 multi-scale temporal viewer (macro novelty) |
| `optical_flow.hpp` | **new, Phase 0** | (reserved for W4+; not used in W1–W3) |
| `audio_features.hpp` | reused from MAT200B | every entry |
| `automation.hpp` | reused from MAT200B | symmetry breaker, T/I clock replay, ABX trial sequencer |
| `pickable.hpp` | reused from MAT200B 1.5 | clock vertex pickables, balance composer drag, multiscale marks |
| `draw_canvas.hpp` | reused from MAT200B 1.5.10 | IV bar chart, phase-space plots, psychometric plot |
| `constraint_layer.hpp` | first MAT245 use | W2 asymmetric-balance composer (lock mode) |
| `versioned_state.hpp` | reused | every twist that produces a portfolio artifact |
| `post_fx.hpp` | reused | T/I clock trace stipple, phase-shifter trail fade |
| `param_graph.hpp` | reused (sparingly) | not load-bearing for W1–W3 |

**Web-specific risks worth highlighting** (not previously surfaced for the MAT200B base):

- **MusicXML on the web.** No in-WASM XML parser is available cheaply; W1 Bartók palindrome reader splits work between TS-side `frontend/src/services/musicxml.ts` (parse, ~400 LOC) and WASM (`midi_parser.hpp::parseJSON`). Marshalling pattern is `Module.stringToUTF8` + a shared `vector<uint8_t>`. Document this in the helper.
- **Hardware MIDI on Safari.** Web MIDI is Chromium/Edge only. Optional MIDI-controller-as-T_n-fader twists for W1 entries must degrade gracefully ("MIDI unavailable on this browser; use the on-screen buttons").
- **Sample-accurate click placement** (W3 ABX). Web Audio's coarsest scheduling is the worklet quantum (~2.7 ms at 48 kHz, finer than typical perceptual threshold but coarser than what `setTimeout` would imply); document and use sample-frame offsets in `onSound` rather than wall-clock timers.
- **Forte-number lookup table size.** 224 set-classes × IV (6 ints) + prime-form (≤12 ints) + Forte string ≈ 12 KB embedded as `constexpr` in `pcset_engine.hpp` — no asset shipping needed.
- **Similarity-matrix compute on cold load** (W3 multi-scale). 240×240 cells once per source load; budget ~200 ms; not on hot path.
- **Per-trial PRNG reproducibility** (W3 ABX). Use a deterministic seed from session id so saved results can be replayed.
- **No mic-input plumbing in baseline.** All W1–W3 entries use file or procedural sources; if a future entry wants live mic, the worklet's `inputs[]` plumbing needs to land first (separate Phase 0 task, not blocking W1–W3).

---


---

# MAT245 Multimedia Composition — Studio Online buildable-examples plan

Sections 4–7 (Weeks 4–7). Mirrors the 10-field shape used in `MAT200B_EXAMPLES_PLAN.md` Sections 3+4. Every entry is concrete enough that a Phase 3 implementer can write the file directly from this spec. No "v2 deferred" stubs — when web cannot host the native shape, the workaround is named (HTML5 `<video>` + `requestVideoFrameCallback`, `OfflineAudioContext` for >2-channel renders, etc.).

Foundation already on disk (`0d8d98f`, `5c86aec`): `audio_features`, `automation`, `param_graph`, `draw_canvas`, `post_fx`, `pickable`, `pixel_audio_bridge`, `pv_resynth`, `web_convolver`. New helpers introduced by this plan, all `_studio_shared/`: `pcset_engine`, `multi_scale_features`, `group_theory`, `versioned_state`, `constraint_layer`, `midi_parser`, `similarity_matrix`, `optical_flow`.

Audio defaults for every entry: `configureAudio(audioIO().framesPerSecond(), 128, 2, 0)` (Web Audio worklet `process()` is fixed at 128 frames per `frontend/public/allolib-audio-processor.js:199`); 8-channel ambisonic entries call `configureAudio(rate, 128, 8, 0)` and binaurally downmix to 2 via `gam::HRFilter` for the default browser path.

---

## 4. Section 4 — Week 4: Modality-Specific Expression

### 4.1 High-dimensional audio piece — *Eight Spheres, One Room*

1. **Title:** Eight Spheres, One Room (high-dimensional audio piece)
2. **Registry entry:**
   ```ts
   { id: 'mat245-hd-audio-eight-spheres', title: 'Eight Spheres, One Room',
     description: 'Audio-only 8-channel ambisonic piece: granular cloud + spectral freezes over a Haas-style ascending-fifths plan; binaural downmix on stereo browsers',
     category: 'mat245-modality', subcategory: 'audio-only' }
   ```
3. **AlloLib classes:** `al::WebApp` (transpiled from `App`), `al::ControlGUI` (via `WebControlGUI`), `gam::Sine<>`, `gam::AD<>`, `gam::SamplePlayer<>` (via `WebSamplePlayer`), `gam::STFT` (MAG_PHASE), `gam::HRFilter` (for stereo downmix path), `al::AmbisonicsSpatializer` from `al/sound/al_Ambisonics.hpp` (header is linked; verify Phase 0 link smoke). Plus `_studio_shared/pv_resynth.hpp` for spectral freezes/morphs and `_studio_shared/multi_scale_features.hpp` for the formal-scheme analyzer.
4. **Audio plan:** `configureAudio(rate, 128, 8, 0)` — request 8 output channels. WASM emits 3rd-order ambisonic B-format (16 channels packed into 8 audio outputs as W,X,Y,Z plus 2nd/3rd order; downmix to 8 speakers via `AmbiDecode` or to 2 via `HRFilter`). Granular cloud: hand-rolled scheduler, 96 active grains, each grain a `gam::SamplePlayer` slice + `gam::AD` envelope, source position randomized within an azimuth/elevation cell drifting upward through the Haas-style ascending fifths (12 cells, fifth-spaced in log-frequency *and* azimuth). Spectral track: `pv_resynth.hpp` runs MAG_PHASE STFT (2048/512) on a parallel sample stream; "freeze" = lock magnitudes, randomize phases per frame; "morph" = LERP magnitudes between two spectra over `t` seconds. Formal scheme: 12-section structure; section index drives a global `Parameter` that the granular density, freeze probability, and ambisonic source-cell map all read.
5. **Visual plan:** Single black canvas (`g.clearColor(0,0,0,1)`) plus a **diagnostic-only** 2D source-position visualizer (top-down xy plot of active grain azimuths, drawn via `Mesh` POINTS) that is hidden behind a `bool showDiagnostic` Parameter, default `false`. In production the canvas stays black — the constraint of no visuals *is* the piece.
6. **A→V coupling:** **inverted by design** — none. The audio piece is the work; visuals only exist as a diagnostic the composer can switch on during rehearsal. Document this in the example description.
7. **Twist implementation:** Haas-*In Vain* ascending-fifths plan implemented as a `std::array<SectionPlan,12>` loaded at `onCreate`, where each `SectionPlan` carries `{centerHz, azimuthDeg, durationSec, granDensity, freezeProb}`. A `SectionScheduler` reads `audioIO().framesPerSecond()` and advances on the audio thread. **Web caveat path:** if `audioContext.destination.channelCount < 8`, the C++ side detects via `audioIO().channels(OUT)` and switches to the `HRFilter` binaural downmix branch automatically; the example description names this. For studios with a 5.1/7.1/Atmos setup, the user toggles a `Parameter` "rawAmbisonic" that bypasses HRFilter and routes B-format direct to outs. For 8ch renders the worklet can't sustain live (e.g. on low-end laptops at 3rd-order), an "Offline Render" button creates an `OfflineAudioContext` at `numberOfChannels=8` and bounces the full piece to a downloadable WAV via `_studio_shared/automation.hpp` + `Blob` save.
8. **Size estimate:** **large**, ~1300 LOC (scheduler 400, granular 250, spectral 200, ambisonic routing 200, downmix logic 100, transport+UI 150).
9. **Helpers:** `_studio_shared/pv_resynth.hpp` (freezes/morphs), `_studio_shared/multi_scale_features.hpp` (long-window centroid+flux for the formal-scheme analyzer overlay in diagnostic mode), `_studio_shared/automation.hpp` (offline-render bounce), foundation `audio_features.hpp` (transient guard for grain attacks).
10. **Web-specific risks:** **HIGH.** (a) Web Audio's default destination is 2 channels — confirmed binaural fallback path via `gam::HRFilter` is mandatory on every consumer browser; the 8-channel raw path requires the user to have configured their OS audio output device with ≥8 channels *and* the browser's `AudioContext` to honour the request (Chrome 122+ on macOS Core Audio: yes; Firefox: partial; Safari: stereo-only). (b) `al/sound/al_Ambisonics.hpp` is in the upstream tree but not yet exercised by any Studio Online example — Phase 0 smoke test (`mat245-ambi-smoke`: pan a click 0°→360° az, print W/X/Y/Z RMS) required before this entry. (c) `gam::HRFilter` shares the same Phase 0 risk noted in the MAT200B plan §3.9. (d) `OfflineAudioContext` 8-channel renders are only valid up to ~10 minutes on most browsers (memory cap); document maximum offline-render duration.

### 4.2 High-dimensional visual piece — *Hopf Bloom*

1. **Title:** Hopf Bloom (high-dimensional visual piece)
2. **Registry entry:**
   ```ts
   { id: 'mat245-hd-visual-hopf-bloom', title: 'Hopf Bloom',
     description: 'Silent visual piece: raymarched 4D Hopf-fibration projection; a silent Risset glissando drives the projection angle but never the bus',
     category: 'mat245-modality', subcategory: 'visual-only' }
   ```
3. **AlloLib classes:** `al::WebApp`, `al::ShaderProgram` (GLSL ES 3.0 fullscreen-quad fragment shader), `al::Mesh` (one fullscreen quad), `al::Texture` (palette LUT 1×256), `al::EasyFBO` (optional bloom post), `gam::Sine<>` (silent driver), `_studio_shared/post_fx.hpp` (fullscreen-quad scaffolding shared with §4.3 of MAT200B), `_studio_shared/automation.hpp` (timeline of projection-angle keyframes).
4. **Audio plan:** Worklet runs and writes `0.f` to both output channels every block — explicit silence, not a stopped audio graph. A `gam::Sine<>` is instantiated at log-frequency `f(t) = f0 · 2^(t/T)` (Risset-style ascending glissando) but its output is summed only into a `std::atomic<float> projectionDriver` shared with the graphics thread; it is **never** written to `io.out()`. This documents the piece's structural argument: the "audio" exists as a hidden generator.
5. **Visual plan:** Fullscreen quad mesh; fragment shader does iterative SDF/IFS marching of a 4D Hopf-fibration projected to 3D via a rotating projection matrix. Shader pseudocode:
   ```glsl
   vec3 march(vec3 ro, vec3 rd){
     float t=0.; for(int i=0;i<128;i++){
       vec4 p4 = stereo3to4(ro + rd*t);
       p4 = rot4(uTime*uHopfRate) * p4;
       float d = sdHopfFiber(p4);
       if(d<0.001) return shade(p4, normal(p4));
       t += d; if(t>20.) break;
     } return vec3(0.);
   }
   ```
   `uHopfRate` is read from `projectionDriver` (the silent Risset). Palette LUT mapped from radial coordinate. `EasyFBO` ping-pong for one-tap bloom (optional via Parameter).
6. **A→V coupling:** **inverted/silent.** The audio-derived structure (Risset log-frequency curve) is encoded into the geometry via the projection-rate uniform. Audio output bus stays at zero amplitude; the audio thread runs purely to produce the driver value at audio rate. Document explicitly in the example description.
7. **Twist implementation:** the silent Risset is a sum of 6 sines at octave-spaced frequencies with bell-shaped amplitude envelopes that scroll up the log-frequency axis; the *aggregate* output (which is the value a listener would hear if the bus weren't muted) drives `uHopfRate`. A "Reveal Audio" debug Parameter (default `false`) un-mutes the bus for diagnostic — the piece in production keeps it muted. Topology evolution is the 4D rotation matrix `rot4` parameterized by `(α,β,γ,δ)` with each angle on its own slow LFO (incommensurate periods 47s/61s/73s/89s), so the projection never repeats over a typical sitting.
8. **Size estimate:** **large**, ~900 LOC (shader 400 GLSL, C++ host 350, palette/LUT/post 100, UI 50).
9. **Helpers:** `_studio_shared/post_fx.hpp` (fullscreen-quad pipeline), foundation `automation.hpp` (timeline of LFO rates and palette swaps), foundation `param_graph.hpp` (debug visualization of the silent Risset → uniform routing — only shown when `showDiagnostic = true`).
10. **Web-specific risks:** **MEDIUM.** Raymarching 128 steps × 1080p is borderline on integrated GPUs; expose a `quality` Parameter (steps=64/128/192) and document a recommended starting value. WebGL2 fragment-shader loop unrolling: keep loop bound a compile-time constant via `#define MAX_STEPS 128` to avoid driver-specific loop limits. Float-texture LUT requires `EXT_color_buffer_float` only if rendered into; a 1×256 RGBA8 palette suffices for the LUT lookup and works on every WebGL2 device.

### 4.3 Modality decision tool — *Should this be audio, visual, or both?*

1. **Title:** Modality Decision Tool
2. **Registry entry:**
   ```ts
   { id: 'mat245-modality-decision-tool', title: 'Modality Decision Tool',
     description: 'Worksheet that asks 12 questions about a compositional intent and recommends modality (audio-only / visual-only / A+V); IndexedDB-versioned with an evolution-tree view',
     category: 'mat245-modality', subcategory: 'pedagogy' }
   ```
3. **AlloLib classes:** Minimal C++ stub (`al::WebApp` + `al::ControlGUI`) drives the canvas with text-mode prompts; the actual worksheet UI is a Vue panel (`MultiFileExample` mode — the Vue side mounts a `<ModalityWorksheet>` SFC alongside the canvas). C++ side just renders a question count and a "saved revision: N" label via `Mesh` text. Reuses the already-supported "Vue panel + WASM canvas" pattern that other pedagogy examples in the registry use.
4. **Audio plan:** Silent. Worklet runs at zero output. No `gam::*` instantiated. `configureAudio(rate, 128, 2, 0)` only because `WebApp` requires audio-graph init; the `onSound` callback is a 2-line zero-fill.
5. **Visual plan:** C++ canvas: small text panel ("Q5/12: Does the idea privilege time or space?"). Vue side renders the actual form (12 weighted questions) and the evolution tree (D3-style force-directed graph of saved revisions, each node showing a thumbnail of the answer summary).
6. **A→V coupling:** N/A — pedagogical tool.
7. **Twist implementation:** **versioned_state** helper does the work. Every form save (debounced 500 ms) calls `VersionedState::snapshot(json answers, optional<uint64_t> parentId)` which writes to IndexedDB via Emscripten's `IDBFS` mount. Each snapshot stores `{id, parentId, timestampMs, answersJson, recommendation}`. "View Evolution" mode queries the full snapshot table, builds a parent→children DAG, and renders it as a force-directed graph where edge length ∝ Hamming distance over the 12-question answer vector. Branches are created when the user loads a past snapshot and edits — the new save's `parentId` is the loaded one, not the latest. Recommendation algorithm: weighted vote over the 12 answers, mapped onto a 3-simplex (audio / visual / both) and rendered as a barycentric dot.
8. **Size estimate:** **small**, ~450 LOC (Vue worksheet 250, C++ stub 80, `versioned_state.hpp` ~200 LOC reusable header — counted under helpers, not this entry).
9. **Helpers:** **`_studio_shared/versioned_state.hpp`** (NEW, ~200 LOC) — wraps Emscripten IDBFS to provide `snapshot(json) → id`, `load(id) → json`, `tree() → vector<Node>`. Reused by §7.3 (Iterative-refinement diff browser) and §7.1 (Constraint shell relaxation log). Foundation `automation.hpp` (form export to JSON file via `Blob` download).
10. **Web-specific risks:** **LOW.** IDBFS persistence requires the user accept the mount prompt the first time the example runs; subsequent loads are silent. Quota: each snapshot is <2 KB; 1000 revisions = 2 MB, well under the per-origin quota. Vue panel ↔ WASM canvas IPC uses the existing `MultiFileExample` postMessage bridge.

---

## 5. Section 5 — Week 5: Advanced Integration

### 5.1 Single-process / dual-output engine — *McLaren Generalized*

1. **Title:** Single-Process Dual-Output Engine (McLaren Generalized)
2. **Registry entry:**
   ```ts
   { id: 'mat245-dual-output-mclaren', title: 'McLaren Generalized: Single Buffer, Two Outputs',
     description: 'A 1024×8192 byte buffer is simultaneously a vertical scrolling image and a horizontal audio scanline; edit either, both update',
     category: 'mat245-integration', subcategory: 'av-tight-coupling' }
   ```
3. **AlloLib classes:** `al::WebApp`, `al::Texture` (RGBA8, 1024×8192 — texture memory 32 MB, fits in WebGL2 texture cap), `al::ShaderProgram` (display shader), `al::EasyFBO` (paint compositor), `al::ControlGUI`, foundation `_studio_shared/pixel_audio_bridge.hpp` (already on disk, `5c86aec`), foundation `_studio_shared/draw_canvas.hpp`. No `gam::*` synth — audio is direct buffer reads.
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. The audio thread reads a horizontal **scanline** of bytes (one row, 1024 wide) every output sample at a user-set `pixelsPerSecond` (default = `rate` for 1:1 sample-to-pixel). Two interpretations exposed via `Parameter mode`: (a) **direct-PCM**: `sample_L = (row[col].r/255 * 2 − 1)`, `sample_R = (row[col].g/255 * 2 − 1)`, with `col` advancing at `rate` and `row` advancing on user scroll. (b) **bin-bank**: row's 1024 bytes are 1024 amplitude bins of an additive bank; resynthesis = sum of 1024 sines summed sparsely (only top-K=64 amplitudes evaluated to keep CPU under 30%). Buffer is `std::shared_ptr<std::vector<uint8_t>>` with one `std::atomic<int> rowIndex`. Same lock-free pattern as `pixel_audio_bridge.hpp`.
5. **Visual plan:** Vertical scrolling strip of the same texture, displayed via fullscreen quad + sampling shader. A horizontal scanline highlight quad (1px tall) marks the audio-read row in real time. EasyFBO paint compositor lets the user draw with brushes — `draw_canvas.hpp` handles mouse pickup, splats into the FBO, FBO's color attachment is the texture itself.
6. **A→V coupling:** **identity by buffer.** The texture and the audio sample source are the same `std::vector<uint8_t>`; click-edit on either triggers the other automatically. There is no "synthesis" step — the buffer *is* both modalities.
7. **Twist implementation:** "Edit either, both update" is built-in to the buffer-sharing architecture. Adds: a "Mode toggle" between direct-PCM and bin-bank gives the McLaren *Synchromy* effect (PCM, recognizable as picture) vs an additive-bank effect (paint a horizontal stripe pattern → hear an additive chord). A "snapshot strip" feature saves a 64×8192 column into a side-by-side history pane via `automation.hpp`, so the user can diff successive paint passes.
8. **Size estimate:** **medium**, ~600 LOC (paint compositor 200, audio thread 150, display shader 100, snapshot pane 80, UI 70).
9. **Helpers:** **`_studio_shared/pixel_audio_bridge.hpp`** (foundation, load-bearing — same shared-pointer + atomic-row-index pattern as MAT200B §4.2/§4.3), **`_studio_shared/draw_canvas.hpp`** (foundation), `_studio_shared/post_fx.hpp` (display shader scaffolding), foundation `automation.hpp`.
10. **Web-specific risks:** **LOW.** Texture upload via `texSubImage2D` on every paint splat is a routine WebGL2 path. The 32 MB texture stays inside the typical 256 MB WebGL2 cap. Sole risk: bin-bank mode with K=64 active sines per sample = 64 × 128 = 8192 sine evals per block, about 2% CPU on a modern laptop; document a Parameter to lower K on slower hardware.

### 5.2 Xenakis grammar engine — *Ruled Surfaces, Audible Architecture*

1. **Title:** Xenakis Grammar Engine: Ruled Surfaces, Audible Architecture
2. **Registry entry:**
   ```ts
   { id: 'mat245-xenakis-ruled-surfaces', title: 'Xenakis Grammar: Ruled Surfaces',
     description: 'Generative grammar produces a hyperbolic-paraboloid or conoid; each generator line is a sine glissando AND a structural rib; pavilion mode exports OBJ/STL',
     category: 'mat245-integration', subcategory: 'grammar-generative' }
   ```
3. **AlloLib classes:** `al::WebApp`, `al::Mesh` (TRIANGLES + LINES, big — up to 128×128 grid = 32 K verts), `al::ShaderProgram` (Phong + wireframe overlay), `al::Texture` (optional rib-color), `al::ControlGUI`, `gam::Sine<>` × 128 (one per generator line), `gam::AD<>` × 128 envelopes, `gam::LFO<>` for surface-rotation parameter, `_studio_shared/group_theory.hpp` (NEW — generator subgroups for symmetric pavilions), foundation `_studio_shared/param_graph.hpp` (rule editor), foundation `automation.hpp` (OBJ/STL export via in-browser `Blob` download leveraging `al_WebFile.hpp::saveBlob`).
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. A 64–128-voice sine bank. Each voice's pitch trajectory is the parameterization of one straight line in the ruled surface: for a hyperbolic paraboloid `S(u,v) = (1−v)·L1(u) + v·L2(u)` between two skew lines L1, L2, the *u*-line at constant *v=v_i* has linear endpoints; map line endpoint y-coordinates to log-Hz via `f(y) = 110 · 2^(y · 4)` (4 octaves over y∈[0,1]). Each voice plays its line endpoint-to-endpoint over `T_voice` seconds (default 8s) with overlap. ITD-based stereo placement using the line's x-coordinate. For conoid mode, generators rotate around an axis; pitch sweep is a sine of phase = u · 2π. A→V coupling means a single rule edit triggers regeneration of both bank and mesh in the same `recompute()` function.
5. **Visual plan:** Mesh built once per parameter change. Two passes: TRIANGLES with Phong (lambert + half-Lambert wrap), then LINES of the generators on top with depth bias. Per-rib color = rib's current pitch hue (HSV from line index). User orbits camera via `Nav`. "Pavilion mode" toggle renders only the retained ribs (per-segment booleans, `std::vector<bool> ribKeep`) and switches to a triangulated solid surface from the kept generators only.
6. **A→V coupling:** **rule → both**. One rule edit (e.g. "rotate L2 endpoint by 15°") simultaneously updates the mesh vertices and the sine voices' pitch envelopes — both branches read from the same `std::vector<RuledLine>` data structure inside `recompute()`.
7. **Twist implementation:** Pavilion-mode export wired to `_studio_shared/automation.hpp::exportMeshOBJ(mesh, "pavilion.obj")` and `exportMeshSTL(mesh, "pavilion.stl")` — both write to `Blob`, trigger download via `EM_ASM(({ const blob = new Blob([HEAPU8.slice($0,$0+$1)]); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = UTF8ToString($2); a.click(); }, ptr, len, "pavilion.obj"))`. Per-rib retain UI = `Pickable` toggle on each generator line (foundation `pickable.hpp`). Grammar editor = a small DSL ("L1 := bezier((0,0,0),(2,1,0)); L2 := rotate(L1, 90°, axis=z); surface := lerp(L1, L2, v∈[0,1])") parsed via a hand-rolled recursive-descent parser, ~150 LOC. `_studio_shared/group_theory.hpp` provides D_n / C_n symmetry operators that the grammar can call to instantiate symmetric pavilions (e.g. "octagonal pavilion = D_8 of one ruled segment").
8. **Size estimate:** **large**, ~1500 LOC (grammar parser 250, surface generator 300, sine bank + envelope scheduler 350, mesh build + shader 250, pavilion export 150, UI + param graph 200).
9. **Helpers:** **`_studio_shared/group_theory.hpp`** (NEW, ~250 LOC) — finite cyclic and dihedral group action on `Vec3f` lists, used here and reusable in §6.2 (Messiaen modes-of-limited-transposition share group structure). Foundation `param_graph.hpp` (rule editor), foundation `automation.hpp` (OBJ/STL export), foundation `pickable.hpp` (rib toggles).
10. **Web-specific risks:** **MEDIUM.** (a) 128 simultaneous sines at 48 kHz × 128 frames = 16K mults per block ≈ 6% CPU on a modern laptop — fine. (b) OBJ/STL export sizes: 32 K-vert mesh ≈ 3 MB STL — within Blob/Blob URL limits. (c) Mesh rebuild on every parameter change: throttle to 10 Hz max via `automation.hpp` debounce. (d) The grammar parser is the largest unknown — keep grammar minimal (no recursion in v1; only flat lists of rules), expand in a follow-up.

### 5.3 Cross-modal coherence checker — *Onset / Flow Correlator*

1. **Title:** Cross-Modal Coherence Checker
2. **Registry entry:**
   ```ts
   { id: 'mat245-coherence-checker', title: 'Cross-Modal Coherence Checker',
     description: 'Loads a video; computes optical flow per frame and audio onset density per block; plots correlation, lag, redundancy, divergence',
     category: 'mat245-integration', subcategory: 'analysis' }
   ```
3. **AlloLib classes:** `al::WebApp`, `al::Texture` (RGBA8 video frame — uploaded each `requestVideoFrameCallback`), `al::ShaderProgram` (overlay), `al::Mesh` (4 plot panels), `al::ControlGUI`, `gam::STFT` (analysis), `_studio_shared/optical_flow.hpp` (NEW — Lucas-Kanade pyramid on CPU), foundation `_studio_shared/audio_features.hpp` (onset detection: Spectral Flux + adaptive threshold). Plus an `EM_ASM` JS bridge to an HTML `<video>` element + `requestVideoFrameCallback` for frame-accurate frame I/O.
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. Audio pulled from `MediaElementAudioSourceNode` (the same `<video>`'s audio track) — needs JS-side wiring of `audioContext.createMediaElementSource(videoEl).connect(audioWorkletNode)`; *this is a Phase 0 plumbing task identical to the MAT200B §4.6 risk note*. Audio thread runs `audio_features.hpp::onsetDetector` (spectral flux > median × adaptiveK), pushes `onsetTimes` (audio sample index) to a thread-safe ring read by graphics thread.
5. **Visual plan:** **Video frame I/O via `<video>` + `requestVideoFrameCallback`** — JS glue: `videoEl.requestVideoFrameCallback((now, metadata) => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, videoEl); pushFrameStamp(metadata.mediaTime); videoEl.requestVideoFrameCallback(...); })`. Optical flow runs CPU-side (Phase 0 helper) on a 2-step pyramid at 160×90 downsampled grayscale (well under 1 ms per frame). Four diagnostic panels (`Mesh` LINE_STRIP × 4): (1) flow magnitude time series, (2) onset density time series, (3) correlation function `R_xy(τ)` over τ ∈ [−1, +1] s, (4) redundancy = 1 − H(audio | visual) estimated from a 32×32 joint histogram (spectral-centroid bin × flow-magnitude bin).
6. **A→V coupling:** **inverse / diagnostic.** The example does not generate A or V; it observes both and quantifies their relationship.
7. **Twist implementation:** four-panel diagnostic dashboard. Panel 1: flow magnitude `|v|(t)`; Panel 2: onset density `|onsets ∩ [t-Δ,t]|/Δ`; Panel 3: cross-correlation function with peak τ* annotated as the A/V lag; Panel 4: mutual information / redundancy bar plot per 1-second window. A "load reference" button compares against canonical examples (Whitney *Permutations*, Lye *Free Radicals*, Reich *Six Pianos* video) — registry-bundled video assets in `frontend/public/mat245-references/` (CORS same-origin). Reference numerics are precomputed and shipped as a JSON sidecar so the user sees their own piece's numbers next to canonical ones.
8. **Size estimate:** **medium**, ~700 LOC (video bridge + JS glue 150, optical flow 200, panel rendering 200, correlation/MI computation 100, UI 50).
9. **Helpers:** **`_studio_shared/optical_flow.hpp`** (NEW, ~250 LOC) — pyramidal Lucas-Kanade, CPU-side, 2-step pyramid, ~1 ms at 160×90. Reused by §7.2 (Coherence inspector) for visual feature vectors. Foundation `audio_features.hpp` (onset + flux), `param_graph.hpp` (panel arrangement).
10. **Web-specific risks:** **HIGHEST IN SECTION 5.** This is the same risk profile as MAT200B §4.6. (a) `requestVideoFrameCallback` is well-supported in Chrome/Edge but only behind a flag in Firefox <122 and partial in Safari ≤16; ship a `requestAnimationFrame` fallback that polls `videoEl.currentTime` (sub-frame jitter, document the limitation). (b) `MediaElementAudioSourceNode` → worklet routing is not currently wired in Studio Online; add this Phase 0 task. (c) Cross-origin video sources require CORS — reference videos live under `frontend/public/mat245-references/` (same-origin); user-uploaded videos go through `URL.createObjectURL(file)` (also same-origin per spec). (d) Optical-flow pyramid downsample on CPU is borderline at 1080p — downsample to 160×90 first via a one-line `gl.copyTexSubImage2D` before reading back to CPU.

---

## 6. Section 6 — Week 6: Structure / Form / Material Transformation

### 6.1 Manovich-principles browser

1. **Title:** Manovich Principles Browser
2. **Registry entry:**
   ```ts
   { id: 'mat245-manovich-browser', title: 'Manovich Principles Browser',
     description: '5-panel inspector (numerical, modular, automated, variable, transcoded); variability mode generates 10 perturbed variants of a loaded asset',
     category: 'mat245-form', subcategory: 'pedagogy' }
   ```
3. **AlloLib classes:** `al::WebApp`, `al::Texture` (variant thumbnails), `al::Mesh`, `al::ControlGUI`, `al::ShaderProgram` (image-perturb shaders: hue/saturation/blur/balance/dither), `gam::SamplePlayer` (audio variants), `gam::OnePole`, `gam::STFT` (for spectral-perturb path), foundation `_studio_shared/post_fx.hpp` (image perturb), `_studio_shared/audio_features.hpp` (variant feature delta).
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. For audio assets: 5 perturb axes per Parameter slider — sample-rate (resample via `gam::Quantizer`), pitch (PSOLA via `pv_resynth.hpp`), time (granular stretch reusing MAT200B §3.7 logic), spatial (HRTF re-pan), spectral (centroid shift). For image assets, audio is silent. 10 variants generated by sampling the perturb-vector cube at 10 random points within configurable radius.
5. **Visual plan:** 5 panels arranged in a 2-row layout — each panel labelled with its Manovich principle and showing a domain-specific visualization. Variability mode opens an 11th panel: a 10-grid of variant thumbnails (image perturb on GPU via `post_fx.hpp` filter chain; audio perturb shows spectrogram thumbnail via offline analysis on load).
6. **A→V coupling:** N/A — pedagogical observer.
7. **Twist implementation:** "Variability" panel: each click on a base asset spawns 10 deterministic perturbations (seeded RNG so the same asset always produces the same gallery — auditable). For images, 5 perturb shaders chain in a configurable order (chain order itself is a Parameter, exposing Manovich's "modular" principle). For audio, 5 perturb operators chain through `param_graph.hpp` connections. Save variants as a `Blob` ZIP via the `JSZip` JS lib loaded via `EM_ASM`.
8. **Size estimate:** **small**, ~500 LOC (5 perturb shaders 150 GLSL, audio perturb 150, variant gallery 100, UI + asset loader 100).
9. **Helpers:** Foundation `post_fx.hpp`, `audio_features.hpp`, `pv_resynth.hpp`, `param_graph.hpp`, `automation.hpp` (variant ZIP export).
10. **Web-specific risks:** **LOW.** ZIP export via JSZip adds ~100 KB JS to the bundle; load lazily on first export. Image-perturb shaders are standard fullscreen-quad GLSL ES 3.0.

### 6.2 Messiaen mode and rhythm engine

1. **Title:** Messiaen Mode and Rhythm Engine
2. **Registry entry:**
   ```ts
   { id: 'mat245-messiaen-modes-rhythms', title: 'Messiaen Modes and Non-Retrogradable Rhythms',
     description: '7 modes-of-limited-transposition driver + non-retrogradable rhythm palindrome editor; live highlighter against loaded Quatuor movement audio + score',
     category: 'mat245-form', subcategory: 'theory-engine' }
   ```
3. **AlloLib classes:** `al::WebApp`, `al::Mesh`, `al::Texture` (score image), `al::ControlGUI`, `gam::Sine<>` × 12, `gam::AD<>`, `gam::SamplePlayer` (Quatuor reference audio), `gam::STFT` (live pitch detector for highlighting), foundation `_studio_shared/draw_canvas.hpp` (rhythm palindrome editor), `_studio_shared/pcset_engine.hpp` (NEW — pitch-class set arithmetic), `_studio_shared/group_theory.hpp` (shared with §5.2 — modes-of-limited-transposition are exactly the orbits of the cyclic group on Z_12), `_studio_shared/midi_parser.hpp` (NEW — for the score panel).
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. Two paths: (1) **synth**: user composes a phrase in a piano-roll using only mode-N pitches (constraint enforced by `pcset_engine`). 12-voice `gam::Sine` poly. (2) **analysis**: load Quatuor audio (e.g. *Liturgie de cristal* movement, registry-bundled), live pitch-detect every 512 samples via STFT peak, look up resulting PC against the 7 modes, highlight the best-matching mode in the UI.
5. **Visual plan:** Three panels — (a) PC-circle for current mode, with mode pitches lit; (b) rhythm palindrome editor (uses `draw_canvas.hpp`, draw 8–16 onsets, "make non-retrogradable" button mirrors around centre and locks); (c) Quatuor analysis panel: scrolling spectrogram + a ribbon under it showing which of the 7 modes matches each window. Score image scrolls in sync with audio playback.
6. **A→V coupling:** mode index → PC-circle highlight + voice-set constraint; rhythm palindrome → onset times for synth mode; analysis path: STFT peak → mode-best-match ribbon (one-direction A→V).
7. **Twist implementation:** Mode highlighter = `pcset_engine.hpp` enumerates the 7 modes as `std::array<PCSet,7>` (M1={0,2,4,6,8,10}, M2={0,1,3,4,6,7,9,10}, etc.) and defines `bestMatch(detectedPCs) → modeIndex` as max Jaccard overlap. Rhythm palindrome editor: user paints durations on a 32-slot grid via `draw_canvas`; "make non-retrogradable" mirrors `dur[i]` to `dur[N−1−i]` and snaps the centre. `group_theory.hpp` exposes the cyclic-12 group action so the user can transpose the mode through its (limited) transposition orbit and see exactly how many distinct transpositions exist for each mode (M1=2, M2=3, ...). Score panel: `midi_parser.hpp` consumes a SimpleScore JSON or a small subset of MusicXML and produces note events synced to playback time.
8. **Size estimate:** **medium**, ~750 LOC (PC-set engine 200 helper, rhythm editor 150, analysis ribbon 150, score panel 150, UI 100).
9. **Helpers:** **`_studio_shared/pcset_engine.hpp`** (NEW, ~300 LOC) — pitch-class sets with normal form, prime form, transposition, inversion, intersection/union, Jaccard distance. Reused heavily by §7.1 constraint shell. **`_studio_shared/midi_parser.hpp`** (NEW, ~250 LOC) — minimal MIDI file parser + a hand-rolled MusicXML subset reader (just `<note>` elements with `<pitch>`, `<duration>`). **`_studio_shared/group_theory.hpp`** (shared with §5.2). Foundation `draw_canvas.hpp`, `audio_features.hpp`.
10. **Web-specific risks:** **MEDIUM.** (a) MusicXML is XML — bundle a tiny XML parser (e.g. pugixml, single-header, BSD licence, ~10K LOC; or hand-roll a tag-walker for the MAT245 subset, ~100 LOC). Avoid the full standard. (b) MIDI parser: standard format-1 MIDI files only; reject SMPTE timecodes in v1. (c) Live pitch detection: STFT-peak is fast but noisy — use the YIN-lite path in `audio_features.hpp` (autocorrelation peak with parabolic interp, ~80 LOC) for stable pitch.

### 6.3 Database vs narrative composer

1. **Title:** Database vs Narrative Composer
2. **Registry entry:**
   ```ts
   { id: 'mat245-database-narrative', title: 'Database vs Narrative Composer',
     description: '50-fragment A/V bundle; toggle linear (narrative) vs random-walk (database) playback; filter / sort / layer compositing operations',
     category: 'mat245-form', subcategory: 'manovich-form' }
   ```
3. **AlloLib classes:** `al::WebApp`, `al::Texture` (50 thumbnails + 50 image fragments), `al::Mesh`, `al::ControlGUI`, `gam::SamplePlayer` × up to 8 simultaneous (layer mode), `gam::STFT` (offline feature extraction), foundation `_studio_shared/audio_features.hpp` (sort axes), `_studio_shared/multi_scale_features.hpp` (NEW — short and long-window features for sort/filter), foundation `_studio_shared/param_graph.hpp` (filter predicates).
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. Up to 8 `WebSamplePlayer` instances mixing simultaneously in layer mode; in narrative/random modes only 1 plays at a time with crossfade (`gam::OnePole` smoother on each player's gain). Offline analysis at load time computes per-fragment feature vector `{rms, centroid, flux, dur}` via `multi_scale_features.hpp`.
5. **Visual plan:** Two view modes: **grid** (database — 5×10 thumbnail grid, click to play) and **timeline** (narrative — 50-cell ribbon at the bottom, playhead scrubs). Compositing operations panel exposes filter (`predicate :: Fragment → bool`), sort (axis = centroid/rms/dur), layer (parallel playback with up-to-8 selected fragments).
6. **A→V coupling:** synchronous — each fragment is an A/V bundle (1 audio + 1 image), index advances together. In layer mode, up to 8 audio play + up to 8 thumbnails composited via `post_fx.hpp` blend shader.
7. **Twist implementation:** Manovich's 4 compositing ops (filter / sort / layer / compose) each as a UI panel. Filter: predicate DSL ("centroid > 1500 AND rms > 0.1") parsed via the same recursive-descent parser as §5.2's grammar; predicate evaluates against the precomputed feature vector. Sort: switch axis via Parameter dropdown, animates fragment reflow with a spring tween. Layer: multi-select up to 8 fragments; image composite via Porter-Duff blend modes (a Parameter chooses mode); audio sums with per-track gain. Random-walk uses transition probabilities optionally driven by feature similarity (cosine on `multi_scale_features` vectors).
8. **Size estimate:** **medium**, ~800 LOC (fragment loader + analysis 200, grid view 150, timeline view 100, compositing ops 200, predicate parser 150).
9. **Helpers:** **`_studio_shared/multi_scale_features.hpp`** (NEW, ~200 LOC) — short-window (RMS/centroid/flux per 25 ms) and long-window (mean/var per 1 s) feature extraction; reused by §7.2 (Coherence inspector). Foundation `audio_features.hpp`, `param_graph.hpp`, `post_fx.hpp` (blend shader), `automation.hpp`.
10. **Web-specific risks:** **LOW.** 50-fragment bundle ≈ 50 × (200 KB audio + 100 KB image) = 15 MB. Bundle as a single `.tar` or `.zip` registry asset and lazy-extract at example load via `JSZip`. 8 simultaneous `WebSamplePlayer`s = 8 × disk reads, all from in-memory buffers post-extract; CPU well under 5%.

### 6.4 Material-transformation lab

1. **Title:** Material Transformation Lab
2. **Registry entry:**
   ```ts
   { id: 'mat245-material-transform-lab', title: 'Material Transformation Lab',
     description: 'Node-graph chain of {granular, time-stretch, spectral, blend, filter, convolve}; degrade-then-regenerate via Markov / similarity / statistical resamplers',
     category: 'mat245-form', subcategory: 'transformation-graph' }
   ```
3. **AlloLib classes:** `al::WebApp`, `al::Mesh` (graph nodes/edges), `al::ControlGUI`, `al::Texture` (per-node thumbnail/spectrogram), `gam::STFT`, `gam::Comb<>`, `gam::Biquad<>`, `gam::SamplePlayer`, foundation `_studio_shared/param_graph.hpp` (load-bearing — node UI + connection model), foundation `_studio_shared/pv_resynth.hpp` (spectral node), foundation `_studio_shared/web_convolver.hpp` (convolve node), foundation `_studio_shared/similarity_matrix.hpp` (NEW — the regenerate operator's similarity-based concatenation).
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. Node-graph DAG. Each node owns its own DSP block; the audio thread topologically-sorts at every graph mutation (rare) and runs `process(in, out, 128)` on each node in order. Six node types:
   - `GranularNode` (slice into N grains, hand-rolled scheduler reusing MAT200B §3.7);
   - `TimeStretchNode` (PSOLA via `pv_resynth.hpp`);
   - `SpectralNode` (STFT bin-mask / shift / freeze);
   - `BlendNode` (mix two inputs with crossfade curve);
   - `FilterNode` (`gam::Biquad` cascade, 8 sections max);
   - `ConvolveNode` (`web_convolver.hpp` partitioned FFT).
5. **Visual plan:** Node graph rendered through `param_graph.hpp` — each node a draggable card with thumbnail (live spectrogram of its output), connections as bezier edges. Right-side detail panel shows the selected node's parameters via `ControlGUI`. A "trace" mode highlights signal flow with animated dashed line on the active edges.
6. **A→V coupling:** the graph itself *is* the A→V coupling — visual node positions are not coupled to audio; the *transformations being inspected* are. Output audio plays; output spectrogram thumbnails update on the visible nodes.
7. **Twist implementation:** **Degrade-then-regenerate.** A `FragmentNode` slices source into N=64 grains (each `Grain = {startSample, dur, source}`); a `RegenerateNode` rebuilds output from the grain pool via one of three algorithms exposed as a Parameter:
   - **Markov chain** — first-order over grain index; transition matrix learned from the source's onset sequence;
   - **Similarity-based concatenation** — `similarity_matrix.hpp` computes pairwise cosine on per-grain feature vectors; greedy walk picks next grain by similarity to current + small noise;
   - **Statistical resampling** — sample grains weighted by their RMS distribution.
   The regenerate node has a "compositional fingerprint" output — a feature-vector summary that lets the next node know what was preserved vs lost.
8. **Size estimate:** **medium**, ~900 LOC (6 node types × ~80 LOC = 480, regenerate algorithms 200, graph runtime 150, UI 70).
9. **Helpers:** **`_studio_shared/similarity_matrix.hpp`** (NEW, ~200 LOC) — cosine and DTW similarity over feature vectors; reused by §7.2 self-similarity matrix. Foundation `param_graph.hpp`, `pv_resynth.hpp`, `web_convolver.hpp`, `audio_features.hpp`.
10. **Web-specific risks:** **MEDIUM.** (a) Graph topology mutations on the audio thread require lock-free swap — use the same `std::atomic<GraphState*>` pattern as MAT200B §3.6 image-source IR swap. (b) `web_convolver.hpp` partition-size is 512 frames = 4 worklet blocks of latency per convolve node; chain of 3 convolve nodes = 12 blocks ≈ 32 ms — borderline; document and cap chain depth at 2 for live-monitor mode (offline render bypasses cap). (c) `similarity_matrix.hpp` 64×64 is 4 K cells × ~10 ops each, well under 1 ms.

---

## 7. Section 7 — Week 7: Personal Voice and Coherence

### 7.1 Constraint-based composition shell

1. **Title:** Constraint-Based Composition Shell
2. **Registry entry:**
   ```ts
   { id: 'mat245-constraint-shell', title: 'Constraint-Based Composition Shell',
     description: 'MIDI piano-roll editor that rejects out-of-set pitches; sidebar lists active constraints; relaxation log records every override; voice profile aggregates across sessions',
     category: 'mat245-voice', subcategory: 'authoring-shell' }
   ```
3. **AlloLib classes:** `al::WebApp`, `al::Mesh` (piano-roll grid + notes), `al::ControlGUI`, `al::Texture` (timeline backdrop), `gam::Sine<>` × 16 (audition synth), `gam::AD<>`, foundation `_studio_shared/draw_canvas.hpp` (note painting), `_studio_shared/constraint_layer.hpp` (NEW — central rule engine), `_studio_shared/pcset_engine.hpp` (shared with §6.2), `_studio_shared/versioned_state.hpp` (shared with §4.3), `_studio_shared/midi_parser.hpp` (shared with §6.2).
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. Audition synth: 16-voice sine poly with `gam::AD` envelopes, triggered when the user clicks a note in the roll. Plays the active phrase on transport-play. Constraint engine intercepts every note-paint event *before* it reaches the audio buffer; if the note's PC is not in the active set the engine rejects with an audible "thunk" (filtered noise burst) and a visual red flash on the rejected cell. Override key (Shift+Click) bypasses with mandatory reason logged.
5. **Visual plan:** Piano-roll grid: 88 keys × N beats. Notes as colored quads via `Mesh` TRIANGLES. Active-constraints sidebar lists rules (e.g. "PC ⊆ M3 of mode-2", "duration ≥ 0.25", "max polyphony ≤ 4"). Relaxation log panel below: scrollable list of `{time, ruleId, oldNote, newNote, reasonText}`.
6. **A→V coupling:** rule edit → both visual highlight (allowed cells lit) *and* audible note acceptance (illegal notes click-rejected); override → both visual log entry *and* audible note insertion.
7. **Twist implementation:** **constraint_layer.hpp** is the engine. Constraints are predicates `(NoteEvent, Phrase) → ConstraintResult{allowed, suggestion, reason}` registered via `addConstraint(name, predicate)`. Built-in constraints: `inPCSet(set)`, `durationAtLeast(s)`, `maxPolyphony(n)`, `noTritoneAcrossBars`, custom DSL (recursive-descent parser shared with §5.2). Relaxation log persists via `versioned_state.hpp` snapshots. **Voice profile**: at session-end, aggregate `{constraintsActive, overrideCount, transformChainsUsed, densityHistogram}` into a single JSON. After ≥3 sessions, the example writes `voice_profile.json` to IDBFS and offers a "Download My Voice Profile" button — the file is a portable artefact the user carries between projects (and into §7.2/§7.3 for self-comparison).
8. **Size estimate:** **medium**, ~850 LOC (constraint engine helper 300, piano roll + paint 250, audition synth 100, sidebar + log 100, voice-profile aggregator 100).
9. **Helpers:** **`_studio_shared/constraint_layer.hpp`** (NEW, ~300 LOC) — predicate registry + relaxation log + override semantics. Reused conceptually in §7.2's coherence rule extraction. Shared `pcset_engine.hpp`, `versioned_state.hpp`, `midi_parser.hpp` (export phrase as MIDI). Foundation `automation.hpp` (voice-profile JSON download), `draw_canvas.hpp`, `param_graph.hpp` (constraint composition).
10. **Web-specific risks:** **LOW–MEDIUM.** (a) MIDI export uses `midi_parser.hpp` reverse path — write SMF format-0; routine. (b) Voice profile requires ≥3 sessions of cumulative state in IDBFS — works but requires the user accept persistent storage. (c) Custom-DSL constraint predicate parser shares the §5.2/§6.3 parser, so risk is amortized; keep it strict (typed) to avoid eval-style holes.

### 7.2 Coherence inspector

1. **Title:** Coherence Inspector
2. **Registry entry:**
   ```ts
   { id: 'mat245-coherence-inspector', title: 'Coherence Inspector',
     description: 'Feature-vector clustering across timeline (k-means/DBSCAN), section-length histogram, self-similarity matrix, surprise plot; side-by-side reference comparison',
     category: 'mat245-voice', subcategory: 'analysis' }
   ```
3. **AlloLib classes:** `al::WebApp`, `al::Texture` (similarity matrix as RGBA8), `al::Mesh` (panels), `al::ShaderProgram` (matrix shader), `al::ControlGUI`, `gam::STFT`, foundation `_studio_shared/audio_features.hpp` (per-frame features), `_studio_shared/multi_scale_features.hpp` (shared with §6.3 — short and long features), `_studio_shared/similarity_matrix.hpp` (shared with §6.4), foundation `_studio_shared/post_fx.hpp` (matrix display).
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. Offline analysis on file load: STFT through the file, per-frame compute `{rms, centroid, flux, mfcc[13], onset}`, push into `std::vector<FeatureVec>`. K-means (k user-selected, default 5) over the feature vectors via Lloyd's algorithm with k-means++ init, ~100 LOC. DBSCAN as alternative (`epsilon`, `minPts` Parameters), ~120 LOC. Section detection: greedy boundary at clustering changes; section-length histogram plots `dur` distribution.
5. **Visual plan:** Four panels in 2×2 layout: (P1) cluster-colored timeline strip, (P2) section-length histogram (`Mesh` TRIANGLES bars), (P3) self-similarity matrix (RGBA8 texture, shader applies viridis colormap), (P4) surprise plot — `H(next | prev) = -Σ p log p` over the cluster transition Markov matrix, plotted as a line over time. Reference-comparison toggle: load Stravinsky / Ikeda from `frontend/public/mat245-references/`, render the same four panels in a side-by-side column.
6. **A→V coupling:** **inverse / diagnostic** — same as §5.3.
7. **Twist implementation:** Section-length histogram exposes the user's "rhythmic signature" (do you mostly write 8-second sections or 32-second sections?). Self-similarity matrix is the textbook MIR diagonal-stripe view. Surprise plot — entropy of next-section prediction — captures the user's "predictability index"; high entropy = exploratory voice, low entropy = stable identity. Reference comparison frames the user's numbers in canonical context (Ikeda's *Op.* shows extremely low surprise / high self-similarity; Stravinsky's *Sacre* shows medium surprise / strong block structure). Side-by-side rendering uses two `EasyFBO`s composited.
8. **Size estimate:** **medium**, ~900 LOC (clustering 250, similarity matrix render 150, histogram + surprise 150, reference loader 100, panel layout 250).
9. **Helpers:** Foundation `audio_features.hpp`, `multi_scale_features.hpp` (shared), `similarity_matrix.hpp` (shared with §6.4), `post_fx.hpp`, `param_graph.hpp` (panel arrangement).
10. **Web-specific risks:** **LOW.** Offline analysis runs on the audio thread post-load (state machine `IDLE → ANALYZING → READY`). 5-minute file at 48 kHz × 13 MFCC × 100 fps = ~3.5 MB feature buffer — fine. Reference-comparison precomputes Stravinsky/Ikeda feature vectors at build time and ships them as JSON sidecars to avoid re-analyzing at every load.

### 7.3 Iterative-refinement diff browser

1. **Title:** Iterative-Refinement Diff Browser
2. **Registry entry:**
   ```ts
   { id: 'mat245-refinement-diff-browser', title: 'Iterative-Refinement Diff Browser',
     description: 'Every save snapshots; tree graph with thumbnails/spectrograms per node; diff adjacent versions (feature delta + frame diff); color-code unchanged elements across history',
     category: 'mat245-voice', subcategory: 'history-tool' }
   ```
3. **AlloLib classes:** `al::WebApp`, `al::Texture` (per-node thumbnail + spectrogram), `al::Mesh` (tree graph edges + node cards), `al::ControlGUI`, `al::ShaderProgram` (frame-diff shader), `gam::STFT` (per-snapshot spectrogram), foundation `_studio_shared/post_fx.hpp` (frame-diff shader), `_studio_shared/versioned_state.hpp` (shared with §4.3 / §7.1 — load-bearing here), `_studio_shared/similarity_matrix.hpp` (shared — pairwise version distances), foundation `_studio_shared/audio_features.hpp` (feature delta), `_studio_shared/multi_scale_features.hpp` (shared).
4. **Audio plan:** `configureAudio(rate, 128, 2, 0)`. On node click, load that snapshot's audio buffer (stored as `WAV` Blob in IDBFS via `versioned_state`) into a `WebSamplePlayer`. A/B compare: two `WebSamplePlayer` instances, one per selected version, crossfade slider between them. Feature deltas precomputed on snapshot create.
5. **Visual plan:** Tree graph (force-directed, same engine as §4.3) with each node showing two stacked thumbnails: visual (latest canvas frame) + audio spectrogram. Edges colored by feature-vector cosine distance. Diff view: select two nodes, render their canvas frames side-by-side and a per-pixel delta in the centre via a shader `delta = abs(texA - texB)` with viridis colormap; spectrogram diff in the bottom panel via the same approach. **Color-coded survival**: pixels (or feature dimensions) that are within ε across *every* version in the lineage are highlighted gold — the "compositional core."
6. **A→V coupling:** N/A — meta tool.
7. **Twist implementation:** Survival map. For each pixel `(x,y)` and each spectrogram bin `(t,f)`, compute `surviveScore = #{i : |v_i - v_{i-1}| < ε} / (N-1)` over all N versions in the lineage; if score > 0.95, color the pixel/bin gold in an overlay layer. The gold pattern reveals the user's true compositional core: what survived every revision is what they care about, however unconsciously. Voice-profile JSON from §7.1 can be cross-referenced — a "voice match" panel shows which surviving features align with the constraints the user always keeps.
8. **Size estimate:** **small**, ~550 LOC (tree graph render 150, snapshot loader 100, diff shader 80 GLSL, survival overlay 100, A/B player 80, UI 40).
9. **Helpers:** **`_studio_shared/versioned_state.hpp`** (shared, load-bearing). `_studio_shared/similarity_matrix.hpp` (pairwise version distances), foundation `audio_features.hpp`, `multi_scale_features.hpp`, `post_fx.hpp` (diff shader). No new helpers needed for §7.3 specifically.
10. **Web-specific risks:** **LOW.** IDBFS storage for many snapshots can hit quota — each snapshot is ~500 KB (compressed WAV + small JSON state); 50 snapshots ≈ 25 MB, well within the per-origin 100s-of-MB Chrome quota. Provide a "prune older than N" button for safety. Tree-graph layout for >100 nodes — switch to a hierarchical layout (D3 tree) at that count; the force-directed layout is fine up to ~50 nodes.

---

## Section 4–7 helpers summary (deltas from foundation)

Foundation already on disk (commits `0d8d98f`, `5c86aec`):

| Helper | Path | Used by §4–7 entries |
|---|---|---|
| `audio_features.hpp` | `_studio_shared/` | 4.1, 5.3, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3 |
| `automation.hpp` | `_studio_shared/` | 4.1, 4.3, 5.1, 5.2, 6.1, 6.3, 7.1 |
| `param_graph.hpp` | `_studio_shared/` | 5.1, 5.2, 5.3, 6.1, 6.3, 6.4, 7.1, 7.2 |
| `draw_canvas.hpp` | `_studio_shared/` | 5.1, 6.2, 7.1 |
| `post_fx.hpp` | `_studio_shared/` | 4.2, 5.1, 6.1, 6.3, 7.2, 7.3 |
| `pickable.hpp` | `_studio_shared/` | 5.2 |
| `pixel_audio_bridge.hpp` | `_studio_shared/` | 5.1 |
| `pv_resynth.hpp` | `_studio_shared/` | 4.1, 6.1, 6.4 |
| `web_convolver.hpp` | `_studio_shared/` | 6.4 |

New MAT245-specific helpers (Phase 0/1 of this section):

| Helper | LOC | First used by | Reused by |
|---|---|---|---|
| `pcset_engine.hpp` | ~300 | 6.2 | 7.1 |
| `multi_scale_features.hpp` | ~200 | 6.3 | 6.4 (regenerate features), 7.2, 7.3 |
| `group_theory.hpp` | ~250 | 5.2 | 6.2 |
| `versioned_state.hpp` | ~200 | 4.3 | 7.1, 7.3 |
| `constraint_layer.hpp` | ~300 | 7.1 | (conceptually §7.2) |
| `midi_parser.hpp` | ~250 | 6.2 | 7.1 |
| `similarity_matrix.hpp` | ~200 | 6.4 | 7.2, 7.3 |
| `optical_flow.hpp` | ~250 | 5.3 | 7.2 (visual feature input, optional) |

---

## Phase 0 plumbing tasks (cross-section)

These must land before the corresponding entries can ship:

1. **8-channel ambisonic Web Audio path** — request `audioContext = new AudioContext({ ...sinkOptions })` with appropriate channel count; verify `audioWorkletNode.channelCount = 8` is honoured per browser. Block on §4.1.
2. **`gam::HRFilter` link smoke test** — see MAT200B §3.9; same `pg-hrtf-smoke` covers §4.1's binaural-downmix branch.
3. **`al/sound/al_Ambisonics.hpp` smoke test** — `mat245-ambi-smoke` example: pan a click 0°→360° azimuth, print W/X/Y/Z RMS; gate before §4.1.
4. **`MediaElementAudioSourceNode` → worklet routing** — JS-side glue + WASM-side `audioIO()` exposure of the upstream stream. Block on §5.3.
5. **`requestVideoFrameCallback` + `texSubImage2D(videoEl)` upload path** — JS bridge + frame-time stamping. Block on §5.3.
6. **`OfflineAudioContext` 8-channel render** — driver in Vue side that runs the example offline and returns a 8-channel WAV blob. Block on §4.1's "Offline Render" button.

---

## Web-specific risk roll-up

| Entry | Risk | Mitigation summary |
|---|---|---|
| 4.1 Eight Spheres | HIGH | Binaural-downmix fallback mandatory; ambisonic Phase 0 smoke; OfflineAudioContext for >2ch renders |
| 4.2 Hopf Bloom | MEDIUM | Quality Parameter for raymarch step count; RGBA8 LUT (no float-tex required) |
| 4.3 Modality Tool | LOW | IDBFS persistence prompt, <2 KB per snapshot |
| 5.1 McLaren Generalized | LOW | Standard pixel-audio-bridge pattern |
| 5.2 Xenakis Grammar | MEDIUM | OBJ/STL Blob export size cap; mesh-rebuild debounce; minimal grammar parser |
| 5.3 Coherence Checker | HIGHEST | `requestVideoFrameCallback` + `MediaElementAudioSourceNode` Phase 0 plumbing; CORS-safe reference assets |
| 6.1 Manovich Browser | LOW | JSZip lazy load |
| 6.2 Messiaen Engine | MEDIUM | Tiny MusicXML subset; YIN-lite for stable pitch |
| 6.3 Database/Narrative | LOW | Bundle 50 fragments as ZIP, lazy-extract |
| 6.4 Material Lab | MEDIUM | Atomic graph swap; cap convolve-chain depth at 2 in live-monitor |
| 7.1 Constraint Shell | LOW–MEDIUM | DSL parser shared/strict; IDBFS voice profile after ≥3 sessions |
| 7.2 Coherence Inspector | LOW | Reference features precomputed at build time |
| 7.3 Diff Browser | LOW | Quota: prune-older button; tree layout switch at >50 nodes |
