# Native Compat Audit — App Lifecycle + Audio + DSP

Scope: `al_App.hpp`, `al_AudioDomain.hpp`, `al_AudioIO.hpp`, `al_AudioIOData.hpp`, all `*Domain.hpp` headers, and `sound/` (Biquad, Crossover, DBAP, VBAP, Ambisonics, Speaker, AlloSphereSpeakerLayout, StereoPanner). Web side: `allolib-wasm/include/`.

Build context: `allolib-wasm/CMakeLists.txt` links upstream `al_AudioIOData.cpp`, `al_Ambisonics.cpp`, `al_Biquad.cpp`, `al_Dbap.cpp`, `al_DownMixer.cpp`, `al_Lbap.cpp`, `al_Spatializer.cpp`, `al_Speaker.cpp`, `al_SpeakerAdjustment.cpp`, `al_StereoPanner.cpp`, `al_Vbap.cpp` directly. `AL_AUDIO_DUMMY` is defined; `al_AudioIO.cpp` is NOT linked. `al_Crossover.hpp` is header-only (template). `al_AlloSphereSpeakerLayout.cpp` and the `al/app/*Domain.cpp` files are NOT linked.

## Already covered

| Native API | Web equivalent | File:line |
|---|---|---|
| `al::App` (base class) | `al::WebApp` (aliased to `App` via `using`) | al_compat.hpp:54 |
| `App::onCreate/onAnimate/onDraw/onSound/onExit` | `WebApp::onCreate/onAnimate/onDraw/onSound/onExit` | al_WebApp.hpp:90-102 |
| `App::onKeyDown/Up`, `onMouse{Down,Up,Drag,Move,Scroll}`, `onResize` | same names | al_WebApp.hpp:105-116 |
| `App::nav()`, `pose()`, `lens()`, `view()`, `navControl()` | same | al_WebApp.hpp:194-207, 346-347 |
| `App::aspect()`, `width()`, `height()`, `fbWidth()`, `fbHeight()`, `highresFactor()` | same | al_WebApp.hpp:210-329 |
| `App::keyboard()`, `mouse()` | same | al_WebApp.hpp:336-339 |
| `App::title(std::string)/title()`, `fullScreen(bool)/fullScreen()`, `fullScreenToggle()`, `cursorHide(bool)/cursorHide()/Toggle()`, `vsync(bool)/vsync()`, `decorated(bool)/decorated()`, `visible()`, `iconify()`, `fps(double)/fps()`, `dimensions(int,int)`, `quit()` | all present (most as no-ops on browser) | al_WebApp.hpp:127-314 |
| `App::audioIO()` | returns `AudioIOView` proxy with `framesPerSecond/Buffer/channelsOut/In` | al_WebApp.hpp:178-191 |
| `App::configureAudio(rate, block, out, in)` | `configureAudio()` macro -> `configureWebAudio()` | al_compat.hpp:61, al_WebApp.hpp:217 |
| `AudioIOData` (full API: `out/in/bus/sum/temp/*Buffer/zero*/frame()/operator()/channelsIn/Out/Bus/framesPerSecond/Buffer/secondsPerBuffer/user`) | upstream header used as-is, `al_AudioIOData.cpp` linked | CMakeLists.txt:124 |
| `AudioCallback::onAudioCB` | upstream header (linked) | CMakeLists.txt:124 |
| `AudioDeviceInfo` enums (INPUT/OUTPUT) | upstream header (header-only portions ok) | — |
| `BiQuad`, `BiQuadNX`, `BIQUADTYPE` | upstream `al_Biquad.cpp` linked | CMakeLists.txt:169 |
| `Crossover<T>` | upstream header-only | — |
| `Speaker`, `Speakers`, `SpeakerRingLayout`, `StereoSpeakerLayout`, `OctalSpeakerLayout`, `HeadsetSpeakerLayout`, `CubeLayout` | upstream `al_Speaker.cpp` linked | CMakeLists.txt:174 |
| `Spatializer` (base), `StereoPanner`, `Dbap`, `Vbap`, `AmbiBase`, `AmbiDecode`, `AmbiEncode`, `AmbisonicsSpatializer`, `Lbap`, `DownMixer`, `SpeakerAdjustment*` | upstream sources linked | CMakeLists.txt:168-177 |
| `DistributedApp[WithState<...>]` (base class only) | collapsed to `WebApp` by transpiler | transpiler.ts:148-156 |
| `al::AudioApp` (include + base class) | rewritten to WebApp | transpiler.ts:41-44, 136-144 |
| `GUIDomain` include | commented out | transpiler.ts:46-48 |

## Missing — high severity

- **`App::onInit()`** — `virtual void onInit()`. Common first-call hook in many examples (init params before window/audio). Not declared on `WebApp`. _Fix_: add empty virtual to `WebApp`, call before `onCreate()`.
- **`App::onMessage(osc::Message&)`** — OSC dispatch; declared on every native App. Web has no equivalent and transpiler only strips bodies that match a strict regex. _Fix_: declare a no-op virtual on `WebApp` taking a stub `osc::Message`, or extend transpiler to remove the override more reliably.
- **`App::audioIO()` returns `AudioIO&`** (mutable, has `start/stop/open/isRunning/append(AudioCallback&)/channelsBus/processAudio/time()/cpu()`). Web returns a value-type `AudioIOView` with only 4 getters. Code like `audioIO().append(myCb)`, `audioIO().channelsBus(4)`, `audioIO().start()`, `audioIO().time()` won't compile. _Fix_: make `audioIO()` return a reference to an object that owns the WebApp's audio config and exposes the common members as no-ops or thin wrappers.
- **`AudioIO` class itself** (`al/io/al_AudioIO.hpp`). Used as a free-standing object in some examples (`AudioIO io; io.init(...); io.start();`). The header is upstream but `al_AudioIO.cpp` is NOT linked, so any non-inline use will be a link error. _Fix_: add `al_AudioIO.cpp` to CMake (it has an `AL_AUDIO_DUMMY` branch that no-ops cleanly) or stub a minimal version in compat.
- **`AudioDevice`** static methods `numDevices()`, `defaultInput()`, `defaultOutput()`, `printAll()`, instance `print()`, `valid()`, `hasInput()`, `hasOutput()`. Same root cause: `al_AudioIO.cpp` not linked. _Fix_: same as above.
- **`App::audioDomain()`, `oscDomain()`, `graphicsDomain()`, `simulationDomain()`, `defaultWindowDomain()`, `parameterServer()`** — domain accessors. Used in patterns like `app.audioDomain()->configure(...)` or `app.parameterServer().registerParameter(p)`. None present on `WebApp`. _Fix_: stub each to return shared_ptr<NoOpDomain> or a static dummy reference.
- **`App::shouldQuit()`, `created()`, `enabled(Window::DisplayMode)`, `cursor()/cursor(Window::Cursor)`, `displayMode()/displayMode(Window::DisplayMode)`, `dimensions()` (returning `Window::Dim`), `dimensions(int x,int y,int w,int h)`, `dimensions(const Window::Dim&)`, `hide()`** — common Window query/setters. Several missing from `WebApp`. _Fix_: add as no-ops/sane returns.
- **`App::append/prepend/remove(WindowEventHandler&)` (deprecated but present)** — some examples still call these. Missing on WebApp.
- **`AudioDomain`, `GammaAudioDomain`, `ConsoleDomain`, `SimulationDomain`, `OSCDomain`, `OpenGLGraphicsDomain`, `GLFWOpenGLWindowDomain`, `OmniRendererDomain`, `StateDistributionDomain`, `StateReceiveDomain`, `StateSendDomain`, `GUIDomain`, `GUIPanelDomain`** — entire `al/app/*Domain.hpp` family. Distributed/Omni examples instantiate these directly. None covered. None of the corresponding `.cpp`s are linked. _Fix_: stub headers under `allolib-wasm/include/al/app/*` mapping to no-ops.
- **`AlloSphereSpeakerLayout()` and friends** (`AlloSphereSpeakerLayoutCompensated`, `*Thin`, `*ExtraThin`, `*Horizontal*`) — header-only declarations but `.cpp` is NOT linked → undefined-reference at link time. Used by every AlloSphere demo. _Fix_: add `${ALLOLIB_DIR}/src/sphere/al_AlloSphereSpeakerLayout.cpp` to CMake `ALLOLIB_SOURCES`.

## Missing — low severity

- `App::newDomain<T>()` template — niche; collides with stubbed domains.
- `App::stdControls` (StandardWindowAppKeyControls) — public field used rarely.
- `AudioIO::supportsFPS`, `clipOut`, `zeroNANs`, `setStreamName`, `errorText`, `channelsInDevice/OutDevice` — only relevant if `AudioIO` is exposed.
- `GammaAudioDomain` — convenience sync class; covered indirectly by `gammaSetSampleRate()` helper.
- `Vbap::makeTriple/makePhantomChannel/compile`, `Dbap::setFocus`, `AmbiDecode::flavor/decode`, `AmbiEncode::direction/encode` — work today (linked) but rarely used; just noting they exist if missing tests reveal a gap.
- `SpeakerTriple` struct, `SpeakerDistanceGainAdjustment*` family — niche speaker-calibration utilities (linked, should work).
- `App::iconify()` — already a no-op, fine.

## Transpiler gaps

The `nativeToWebPatterns` array in `frontend/src/services/transpiler.ts` (lines 29-280) does not handle:

- `#include "al/app/al_AudioDomain.hpp"` — not rewritten/stripped.
- `#include "al/app/al_OSCDomain.hpp"` — not rewritten/stripped.
- `#include "al/app/al_SimulationDomain.hpp"` — not rewritten.
- `#include "al/app/al_StateDistributionDomain.hpp"` — not rewritten (DistributedApp examples).
- `#include "al/app/al_OmniRendererDomain.hpp"` — not rewritten.
- `#include "al/app/al_OpenGLGraphicsDomain.hpp"` — not rewritten.
- `#include "al/app/al_ConsoleDomain.hpp"` — not rewritten.
- `#include "al/app/al_DistributedApp.hpp"` — not rewritten (only the base-class `: public DistributedApp` is handled at line 147-156).
- `#include "al/app/al_AppRecorder.hpp"` — not rewritten (a stub `AppRecorder` exists in `al_playground_compat.hpp:828` but the include must already resolve).
- `#include "al/app/al_FPS.hpp"` — not rewritten.
- `#include "al/app/al_NodeConfiguration.hpp"` — not rewritten.
- `#include "al/sphere/al_AlloSphereSpeakerLayout.hpp"` — not rewritten (header resolves via upstream, but link will fail; a transpiler note + CMake fix is needed).
- `#include "al/sphere/*"` more broadly (al_OmniStereo.hpp, al_Perprojection.hpp, al_SphereUtils.hpp) — none rewritten.
- `#include "al/sound/al_AudioBackend.hpp"` (and `al_AudioIO.hpp` itself) — not rewritten; user code using `al::AudioIO` directly will link-fail.
- `: public StateDistributionDomain<...>`, `: public OmniRendererDomain` — only `DistributedApp[WithState<...>]` is collapsed; other domain bases pass through unchanged.
- `void onMessage(osc::Message& m) override { ... }` — line 228 strips the body but only when it's a single `{ ... }` with no nested braces; multi-statement `onMessage` overrides won't match (regex is non-recursive, `\{[^}]*\}`).
- `void onInit() override { ... }` — passes through, but `WebApp` has no `onInit` virtual so the `override` keyword causes a compile error.
- `app.audioIO().append(cb)`, `app.audioIO().start()`, `app.parameterServer() << param` — no handling; these use methods missing on `WebApp`.
