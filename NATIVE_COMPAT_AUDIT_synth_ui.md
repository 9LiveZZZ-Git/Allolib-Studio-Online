# Native Compatibility Audit — Synth + Scene + UI + Parameters

Scope: AlloLib native API (`al/scene/*`, `al/ui/*`) vs the WASM compat layer in `allolib-wasm/include/al_playground_compat.hpp`, `allolib-wasm/include/al_WebControlGUI.hpp`, and the transpiler at `frontend/src/services/transpiler.ts`.

## Already covered

| Native API | Web equivalent | File:line |
|---|---|---|
| `al::PolySynth` (full class) | upstream native header included as-is | playground_compat.hpp:40 |
| `al::SynthVoice` (full class incl. `createInternalTriggerParameter`, `triggerOn/Off`, `triggerParameters`) | upstream native header | playground_compat.hpp:40 (transitive) |
| `al::SynthSequencer` (`add`, `addVoice`, `addVoiceFromNow`, `playEvents`, `setTempo`, `setTime`, `synth()`, `<<PolySynth`) | upstream native header | playground_compat.hpp:41 |
| `al::SynthGUIManager<V>` (`triggerOn/Off`, `voice()`, `synth()`, `synthSequencer()`, `synthRecorder()`, `render(io)`, `render(g)`) | hand-rolled template shim | playground_compat.hpp:637-797 |
| `al::ControlGUI` (alias) `add/<<` Parameter, ParameterBundle, init/draw, position, title | `al::WebControlGUI` aliased as `ControlGUI` | playground_compat.hpp:136, WebControlGUI.hpp:67 |
| `al::Parameter` / `ParameterInt` / `ParameterBool` / `ParameterString` / `ParameterMenu` / `ParameterVec3` / `ParameterVec4` / `ParameterColor` / `Trigger` | upstream native via `al/ui/al_Parameter.hpp` + UI bridge | WebControlGUI.hpp:198-237 |
| `al::ParameterBundle` register, parameters() | upstream native, registered into WebControlGUI | WebControlGUI.hpp:113-122 |
| `al::ParameterMIDI` `open/close/init/connectControl/connectNoteToValue/connectNoteToIncrement/isOpen` | bridged to Web MIDI API | playground_compat.hpp:284-364 |
| `al::PresetHandler` `storePreset/recallPreset/availablePresets/registerParameter/<<`, name lookup | localStorage JSON-backed stub | playground_compat.hpp:146-274 |
| `al::SynthRecorder` `startRecord/stopRecord/registerPolySynth/<<` (in-memory, browser download) | manual buffer + Blob download | playground_compat.hpp:508-573 |
| `al::Composition` constructor / `insertStep` / `deleteStep` / `play` / `stop` / `running` / `write` / callbacks | no-op stub | playground_compat.hpp:402-417 |
| `al::PresetSequencer` constructor / `playSequence` / `stopSequence` / `<<PresetHandler` / `getSequenceList` / `setDirectory` | no-op stub | playground_compat.hpp:480-497 |
| `al::CSVReader` (string-mode only via `readString`) | manual string parser | playground_compat.hpp:423-472 |
| `al::BundleGUIManager` `<<Bundle / currentBundle / setCurrentBundle / drawBundleGUI` | no-op stub (no UI) | playground_compat.hpp:370-391 |
| `al::NavControl` (active toggle) | no-op stub | playground_compat.hpp:816-820 |
| `al::AppRecorder` (start/stop) | no-op stub | playground_compat.hpp:828-835 |
| Transpile `al/ui/al_ControlGUI.hpp`, `al_ParameterGUI.hpp`, `al_PresetHandler.hpp`, `al_PresetSequencer.hpp`, `al_ParameterMIDI.hpp` -> compat header | rewrite rules | transpiler.ts:53-76 |
| Transpile `al/scene/al_PolySynth.hpp`, `al_SynthSequencer.hpp`, `al_SynthRecorder.hpp` -> compat header | rewrite rules | transpiler.ts:80-93 |

## Stubs that are too thin

- **`PresetHandler::recallPreset` / `morphTo`** — `playground_compat.hpp:184,218` ignore `morphTime`; jumps directly to target. Native interpolates over `morphTime` seconds via `stepMorphing`. Apps depending on smooth preset transitions get hard cuts.
- **`PresetHandler::storePreset` JSON serializer** — `playground_compat.hpp:162-177` only writes `toFloat()`; loses Vec3/Vec4/Color/String/Pose/Menu state. Native serializes via `ParameterMeta::getFields`. Recall after reload restores only scalar params.
- **`PresetHandler` missing `setInterpolatedPreset` / `setInterpolatedValues` / `setInterpolatedValuesDelta` / `stepMorphing` / `loadPresetValues` / `savePresetValues` / `skipParameter` / `registerStoreCallback` / `registerMorphTimeCallback` (signature mismatch — takes `Parameter::ParameterChangeCallback` natively but `std::function<void(float,void*)>` here) / `useCallbacks` / `setCurrentPresetMap` / `availablePresetMaps` / `getPresetName(int)` / `changeParameterValue` / `asciiToPresetIndex`** — all silent no-ops or absent.
- **`PresetSequencer`** — `playground_compat.hpp:480-497` is fully no-op. `playSequence`/`stopSequence`/`appendStep`/`registerEventCommand`/`registerBeginCallback`/`registerEndCallback`/`rewind`/`setTime`/`stepSequencer`/`getSequenceTotalDuration` all do nothing. Apps that drive playback through `PresetSequencer` will appear stuck.
- **`Composition`** — `playground_compat.hpp:402-417` no-ops everything: `play()`, `stop()`, `insertStep`, `playArchive`, `archive`, `restore`. Also signature mismatch: native `CompositionStep::deltaTime` is `float`; compat is `double`. Native `insertStep(name,deltaTime,index)` has no default for `index`; compat defaults to `-1`. Native `Composition(string fileName, string path)` ctor; compat takes `(PresetHandler&, string)`.
- **`BundleGUIManager`** — `playground_compat.hpp:370-391` tracks bundles but `drawBundleGUI`/`drawBundleGlobal` are no-ops, no `bundleGlobal()` accessor (native has it), no `bundles()` accessor returning the vector (native has it).
- **`SynthRecorder`** — `playground_compat.hpp:508-573` records only manually-logged triggers via `logTrigger()`. The real recorder hooks `PolySynth::registerTriggerOnCallback` via `<<PolySynth`; here `<<PolySynth` is a no-op (line 553). Also `onTriggerOn`/`onTriggerOff` overrides on line 559-560 are stubs — native versions are static callbacks called by PolySynth and are how recording actually works. `TextFormat` enum names match but `CPP_FORMAT`/`SEQUENCER_TRIGGERS` are unused.
- **`SynthSequencer::playSequence(filename)` / `loadSequence(filename)`** — Inherited from native header; both read from disk via fstream. In WASM the FS layer is sandboxed so these silently fail (no `.synthSequence` files exist). The stub helpers `playSynthSequenceFromText`/`playSynthSequenceFromURL` (playground_compat.hpp:592-614) are non-functional placeholders ("TODO: implement actual parsing").
- **`SynthGUIManager`** — missing `presetHandler()`, `presetSequencer()`, `recallPreset(int)` is a no-op (line 767), `drawPresets`/`drawPresetSequencer`/`drawSynthSequencer`/`drawSynthRecorder`/`drawTriggerButton`/`drawAllNotesOffButton`/`drawBundle`/`drawFields`/`createBundle`/`setCurrentTab`/`triggerButtonState` are absent. `name()` accessor missing. So apps using `synthManager.presetHandler() << param` won't compile.
- **`ParameterMIDI::connectNoteToToggle`** — playground_compat.hpp:318 is a no-op (other connect* methods append bindings that get dispatched).

## Missing — high severity

- **`al::DynamicScene`** — derived from `PolySynth`, used everywhere for spatial synthesis. Native: `class DynamicScene : public PolySynth` with `prepare(io)`, `render(g)`, `render(io)`, `update(dt)`, `setSpatializer(Speakers&)`, `listenerPose()`, `distanceAttenuation()`, `setUpdateThreaded(bool)`, `setAudioThreaded(bool)`, `stopAudioThreads()`, `showWorldMarker(bool)`, `sortDrawingByDistance(bool)`, `cleanup()`. Why it matters: every spatial-audio playground example inherits from this. No compat shim, no transpiler include rewrite. Suggested approach: alias `DynamicScene` to `PolySynth` plus a no-op `setSpatializer`/`listenerPose`/`distanceAttenuation`; transpile `#include "al/scene/al_DynamicScene.hpp"` into the playground compat header.
- **`al::DistributedScene`** — extends DynamicScene with network sync. Native: `class DistributedScene : public DynamicScene`. Transpiler collapses `DistributedApp` -> `WebApp` (line 148-156) but does not handle `DistributedScene` base class. Suggested approach: alias `DistributedScene` to a `PolySynth`-derived stub or DynamicScene shim; add transpiler rewrite for `: public (al::)?DistributedScene` and `#include "al/scene/al_DistributedScene.hpp"`.
- **`al::PositionedVoice`** — derived from `SynthVoice`, used by spatial examples. Native: `pose()`, `setPose(Pose)`, `size()`/`setSize(float)`, `audioOutOffsets()`, `useDistanceAttenuation(bool)`, `parameterPose()`, `parameterSize()`, `applyTransformations(g)`, `preProcess(g)`, `getTriggerParams()` override that adds 7 pose+size fields, `setTriggerParams` overrides, `isPrimary()`. Why it matters: `class MyVoice : public PositionedVoice` is the standard pattern in tutorial code; without it those apps fail to compile. Suggested approach: define a thin `PositionedVoice : public SynthVoice` in the compat header that owns a `Pose mPose` and `float mSize` plus the listed accessors; ignore the audio-spatial parts.
- **`al::PresetMapper`** — `archive`, `load`, `restore`, `listAvailableMaps`, `<<PresetHandler`, `registerPresetHandler`. Used to swap preset maps at runtime. No stub. Suggested: empty stub class accepting `<<PresetHandler` and a `restore(name)` no-op so code links.
- **`al::PresetMIDI`** — bind MIDI program-change/notes/CCs to preset recall and morph time. No stub. Suggested: stub class with `connectProgramToPreset(int)`, `connectNoteToPreset(int,int)`, `connectCCToMorphTime(int,int)` no-ops so linking succeeds.
- **`al::SequenceRecorder`** — records parameter changes to `.sequence` text files. `<<PresetHandler`, `<<ParameterMeta`, `startRecord(name,overwrite)`, `stopRecord()`, `recording()`. Distinct from `SynthRecorder` (which captures voice triggers). No stub at all. Suggested: minimal stub with start/stop and operator<< no-ops, or extend the existing SynthRecorder pattern to log parameter snapshots and download.
- **`al::SequencerMIDI`** — drive a SynthSequencer or PolySynth from MIDI input. No stub. Suggested: stub class — most MIDI work happens through ParameterMIDI which is already covered.
- **`al::SequenceServer`** / **`al::PresetServer`** / **`al::ParameterServer`** — OSC servers exposing presets/sequences/parameters over the network. Useful for show control. No stubs. Suggested: empty stub classes; OSC is partially covered by `WebOSC` already.
- **`SynthSequencer::registerSequenceBeginCallback` / `registerSequenceEndCallback` / `registerTimeChangeCallback`** — these are inherited from upstream and do work, but in WASM the playback machinery that fires them depends on `playSequence(file)` which is non-functional. Net effect: callbacks never fire.
- **`PresetSequencer` event/preset/parameter step types and `appendStep(Step&)`** — native lets users build sequences in code (no file I/O). The compat stub would compile this pattern but nothing plays. Suggested: implement at least in-memory step queue + `playSequence` that walks steps using `emscripten_set_timeout` and calls `PresetHandler::recallPreset` (which already works for scalar params).
- **`Parameter*` family beyond the 9 covered**: `ParameterDouble`, `ParameterChoice`, `ParameterPose`, `ParameterInt8/16/64`, `ParameterUInt8/16/32/64`, `ParameterVec5`, `DiscreteParameterValues`. Native code routinely uses `ParameterChoice` and `ParameterPose`. WebControlGUI's `getParameterInfo`/`setParameterValue` (`al_WebControlGUI.hpp:188-257`) only handles the 9 main types via `dynamic_cast`. A `ParameterChoice` registered into ControlGUI silently falls through and shows nothing. Suggested: add `ParameterChoice` and `ParameterPose` to the dynamic_cast chain (treat Choice like Menu, Pose like Vec3+quat).

## Missing — low severity

- **`PolySynth::registerSynthClass<T>(name, allowAuto)`** — works (upstream), but its named-voice variants `getVoice(name)` / `allocatePolyphony(name, n)` / `disableAllocation(name)` are rarely used in playground code.
- **`PresetHandler::buildMapPath`, `setPresetMap`, `storeCurrentPresetMap`, `readPresetMap`** — file-system map persistence; localStorage version is fine for single-map use.
- **`Composition::archive` / `playArchive` / `restore`** — multi-file archive on disk; not viable in WASM.
- **`SynthRecorder::TextFormat` (CPP_FORMAT)** — generates C++ literal output; cosmetic.
- **`ControlGUI::backgroundAlpha`, `manageImGUI`, `fixedPosition`, `getBundleCurrent`, `getBundleIsGlobal`, `setCurrentBundle(name,index)`, `beginGroup/endGroup/separator`, `cleanup`, `add(GUIMarker)` / `add(SequenceRecorder&)` / `add(PresetSequencer&)` overloads** — WebControlGUI mostly maps `<<` for Parameter/Bundle but does not accept the engine objects (PresetHandler, SynthSequencer, etc.). Native code like `gui << presetHandler << sequencer` fails to compile. Suggested: add no-op `<<` overloads in WebControlGUI for `PresetHandler&`, `PresetSequencer&`, `SynthSequencer&`, `SynthRecorder&`, `SequenceRecorder&`, `DynamicScene&`.
- **`SynthVoice::registerParameters(args...)` variadic** — provided by upstream but seldom an issue.
- **`asciiToIndex` free function** — playground_compat.hpp:802-806 explicitly defers to upstream; OK.

## Transpiler gaps

`frontend/src/services/transpiler.ts` lines 50-122 handle ControlGUI, ParameterGUI, PresetHandler, PresetSequencer, ParameterMIDI, PolySynth, SynthSequencer, SynthRecorder, MIDI, OSC, SoundFile, File, Asset3D. Missing rewrites:

- `#include "al/ui/al_PresetMapper.hpp"` — uncovered; raw include leaks through and fails (header drags fstream).
- `#include "al/ui/al_PresetMIDI.hpp"` — uncovered; pulls RtMidi.
- `#include "al/ui/al_PresetServer.hpp"` — uncovered; pulls oscpack.
- `#include "al/ui/al_ParameterServer.hpp"` — uncovered; pulls oscpack server.
- `#include "al/ui/al_BundleGUIManager.hpp"` — uncovered; pulls Dear ImGui.
- `#include "al/ui/al_Composition.hpp"` — uncovered; pulls fstream.
- `#include "al/ui/al_SequenceRecorder.hpp"` — uncovered.
- `#include "al/ui/al_SequenceServer.hpp"` — uncovered.
- `#include "al/ui/al_SequencerMIDI.hpp"` — uncovered.
- `#include "al/scene/al_DynamicScene.hpp"` — uncovered. This is the biggest gap; many examples include this directly.
- `#include "al/scene/al_DistributedScene.hpp"` — uncovered.
- `#include "al/sphere/AlloSphereSpeakerLayout.hpp"` and `al/sound/al_*Spatializer.hpp` — out of scope here but used together with DynamicScene.

Base-class patterns not handled:

- `: public DynamicScene` / `: public al::DynamicScene` — no rewrite. Should at minimum map to `al::PolySynth` (or to a future shim), since DynamicScene-derived classes typically only need PolySynth's API.
- `: public DistributedScene` / `: public al::DistributedScene` — same.
- `: public PositionedVoice` / `: public al::PositionedVoice` — no rewrite. Without a PositionedVoice shim, code must fall through to `al::SynthVoice` (loses pose/size). Suggested: rewrite to `al::SynthVoice` only if no PositionedVoice shim is added; otherwise leave it.

Other patterns:

- The web->native include expansion at transpiler.ts:303-316 (`al_playground_compat.hpp` -> multiple native includes) does **not** include `al/ui/al_ParameterMIDI.hpp` or `al/scene/al_DynamicScene.hpp`. Code that compiles in WASM via the bundled compat header may not round-trip cleanly to native because the native build will not pull in those headers from the same file.
- `ALLOLIB_WEB_MAIN` macro is defined for app classes; no equivalent for `SynthGUIManager`-style examples that don't have a top-level App start. (Not strictly transpiler-specific but worth noting.)
