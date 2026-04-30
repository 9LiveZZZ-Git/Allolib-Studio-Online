# Parameter Pipeline Plan

Single source of truth for the AlloLib Studio Online parameter pipeline redesign — replaces the patchwork of registries and mirror loops accumulated across v0.4.5 → v0.6.3.

This document is assembled from three parallel deep-dive passes:

1. **`PIPELINE_AUDIT.md`** — what's there now, with file:line citations. Pure observation.
2. **`PIPELINE_DESIGN.md`** — the unified architecture: single global `al::ParameterRegistry`, `/presets` readiness via Module.preRun + defensive setCurrentPresetMap override, Vue subscription pattern.
3. **`PIPELINE_MIGRATION.md`** — 8-commit phased rollout with native parity tests + Playwright cases + rollback points.

The intermediate files remain on disk for reference. The execution proceeds against this consolidated doc.

**Native-parity-test honesty (per `COMPATIBILITY_REPORT.md`, 2026-04-29):** of the test files in `AlloLib Native Test Files/`, only `M0`/`M1`/`M2`/`M3`/`M5_2_preset_unify.cpp` actually compile against vanilla upstream allolib. Everything else (`M4`, `M5`, `M6`, `M7`, `M8`, `M9`, `registry_test`) targets the studio-online fork's compat layer and is **not** a vanilla-parity gate. The migration plan's "native parity preserved at every step" guarantee refers specifically to `M5_2` continuing to compile against vanilla; phase-by-phase tests like `M5_3`/`M5_4`/`M5_5` and `registry_test` are fork-only validators, tagged with `// REQUIRES: studio-online fork (not upstream allolib)` in their headers. Run them on the fork's WASM build (Studio Online editor → Run), not via vanilla `./run.sh`.

---

## Headline findings

- **6 parameter registries** are in play today (`ParameterServer.mParameters`, `PresetHandler.mParameters`, `WebPresetHandler` via base, `WebControlGUI.mParameters`, `SynthVoice.mTriggerParams`, `SynthVoice.mContinuousParameters`), plus bundle alias maps. The Vue panel reads from `WebControlGUI` only.
- **8 distinct registration entry points** across those registries. None of them is the canonical "the panel sees this" call.
- **`WebApp::start`'s mirror loop walks 5 of ParameterServer's typed lists** and skips `int`/`bool`/`menu`/`choice`/`color`/`trigger` — so users registering those types via `parameterServer() <<` get OSC but silently no panel.
- **Two competing `static WebControlGUI sDefaultPanel;`** function-statics race for `sActiveInstance` — one in `WebApp::start` (`al_WebApp.cpp:305`), one in `WebPresetHandler::mirrorToActiveGui` (`al_playground_compat.hpp:323`).
- **`/presets` IDBFS readiness** has been the source of half the post-v0.4.5 patches. The fix is a hybrid: `Module.preRun` returns a Promise that resolves on `FS.syncfs(true)` callback (Emscripten 3.1.73 awaits this before `main()`), plus a defensive `WebPresetHandler::setCurrentPresetMap` override that pre-writes a stub `.presetMap` and calls base with `autoCreate=false`.

## Unified architecture (one line)

A new global `al::ParameterRegistry` (singleton in `allolib-wasm/include/al_parameter_registry.hpp`) is the single source of truth. All 8 registration entry points keep their existing class-internal lists for native ABI parity AND additionally call `registry.add(&p)`. The C exports in `al_WebControlGUI.cpp` switch from reading `WebControlGUI::sActiveInstance` to reading the global registry. No more mirror loops.

## 8-commit migration

v0.7.0 → v0.7.7 over 8 commits. Each commit independently testable; native parity preserved at every step. Phase 5 (`/presets` readiness) flagged highest-risk.

3 new native parity tests + 1 registry unit test + 5 new Playwright cases.

---



---

# 1. Audit

# Parameter / Preset Pipeline Audit

Snapshot of every code path that touches a parameter object or the
`/presets` IDBFS mountpoint as of v0.6.3 (2026-04-29). Documentation only —
no recommendations.

File path conventions:
- `allolib/...` = upstream allolib repo (canonical at
  `C:/Users/lpfre/allolib_playground/allolib/...`).
- `allolib-wasm/...`, `frontend/...`, `backend/...` = this project's tree.

---

## 1. Parameter creation

The parameter type hierarchy lives entirely upstream and is reused
unchanged:

- `al::ParameterMeta` — abstract base; non-copyable; carries
  `mFullAddress`, `mParameterName`, `mDisplayName`, `mGroup`, hint map.
  Citation: `allolib/include/al/ui/al_Parameter.hpp:83-200`.
- `al::Parameter` — float; ctor signatures take name, group, default,
  min, max plus a callback registry. `allolib/include/al/ui/al_Parameter.hpp`
  declares the class, definition in `allolib/src/ui/al_Parameter.cpp`.
- `al::ParameterInt`, `ParameterBool`, `ParameterString`,
  `ParameterMenu`, `ParameterChoice`, `ParameterVec3`, `ParameterVec4`,
  `ParameterColor`, `ParameterPose`, `Trigger` — same header. All
  implement `getFields()` / `setFields()` over `VariantValue`, which is
  what `PresetHandler::storePreset` uses for serialization
  (`allolib/src/ui/al_PresetHandler.cpp:169-177`).
- `al::Trigger` — bool-style param exposing `trigger()`; routed from
  WebControlGUI's `triggerParameter(index)`
  (`allolib-wasm/include/al_WebControlGUI.hpp:309-315`).

`SynthVoice::createInternalTriggerParameter` lives in
`allolib/include/al/scene/al_SynthVoice.hpp:286-289` (declaration) and
`allolib/src/scene/al_SynthVoice.cpp:296-303` (definition):

```cpp
mInternalParameters[name] = std::make_shared<Parameter>(name, default, min, max);
registerTriggerParameter(*mInternalParameters[name]);
```

Two ownership paths in one call:
- The `shared_ptr` is stored in `mInternalParameters` (a per-voice
  `unordered_map<string, shared_ptr<Parameter>>` —
  `al_SynthVoice.hpp:427-428`).
- A raw `ParameterMeta*` is appended to `mTriggerParams` (a per-voice
  `vector<ParameterMeta*>` — `al_SynthVoice.hpp:423`).

Outside-the-voice access:
- `triggerParameters()` returns `mTriggerParams` by value
  (`al_SynthVoice.hpp:354`).
- `getInternalParameter(name)`, `getInternalParameterValue(name)`,
  `setInternalParameterValue(name, value)`
  (`al_SynthVoice.cpp:305-323`).
- The WASM `SynthGUIManager` constructs a *control voice*
  (`mControlVoice` member —
  `allolib-wasm/include/al_playground_compat.hpp:894`) whose
  `init()` is invoked at construction time
  (`al_playground_compat.hpp:754`); the trigger parameters created by
  that voice are then handed to `WebSequencerBridge::setControlParameters`
  (`al_playground_compat.hpp:777`). They are intentionally NOT pushed
  into `WebControlGUI` (comment at `al_playground_compat.hpp:760-768`).

---

## 2. Parameter registration paths

Five distinct registries hold `ParameterMeta*` lists. Each accepts
parameters via `operator<<` and/or `registerParameter`:

### 2.1 `al::ParameterServer` (OSC sink)

Internal data: `std::vector<ParameterMeta*> mParameters;`,
`std::map<std::string, std::vector<ParameterBundle*>> mParameterBundles;`
(`allolib/include/al/ui/al_ParameterServer.hpp:364-365`).

Registration entry points:
- `ParameterServer& registerParameter(ParameterMeta&)`
  (`allolib/src/ui/al_ParameterServer.cpp:272-348`). Pushes `&param` to
  `mParameters` then installs an OSC change-callback per concrete type
  (Parameter, ParameterInt, ParameterBool, ParameterMenu,
  ParameterChoice, ParameterVec3/4/5, ParameterColor, ParameterString,
  ParameterPose, Trigger).
- `operator<<(ParameterType&)`, `operator<<(ParameterType*)`,
  `operator<<(ParameterBundle&)` —
  `allolib/include/al/ui/al_ParameterServer.hpp:278-292`.

Idempotency: NOT idempotent. Both `registerParameter` and
`registerParameterBundle` `push_back` unconditionally. Re-registering a
parameter doubles its callback list.

In our project, this registry is canonical only for OSC. Web
panel does NOT poll it; instead it is **mirrored** into WebControlGUI in
`WebApp::start` (see §5).

### 2.2 `al::PresetHandler` (preset bookkeeping)

Internal data: `std::vector<ParameterMeta*> mParameters;`,
`std::map<std::string, std::vector<ParameterBundle*>> mBundles;`
(referenced throughout `allolib/src/ui/al_PresetHandler.cpp:169-200,
178-200, 651`).

Registration entry points (upstream, non-virtual):
- `PresetHandler& registerParameter(ParameterMeta&)`
  (`al_PresetHandler.cpp:650-653`). Pushes `&parameter`.
- `PresetHandler& registerParameterBundle(ParameterBundle&)`
  (`al_PresetHandler.cpp:655-661`).

Idempotency: NOT idempotent — bare `push_back`.

### 2.3 `al::WebPresetHandler` (subclass of PresetHandler)

`allolib-wasm/include/al_playground_compat.hpp:192-344`. Hides
upstream's `registerParameter` and `operator<<` so the user's `mPresets
<< p` chains through this:

```cpp
WebPresetHandler& registerParameter(ParameterMeta& p) {
    PresetHandler::registerParameter(p);
    mirrorToActiveGui(p);
    return *this;
}
```

(`al_playground_compat.hpp:251-255`). `mirrorToActiveGui` then calls
`WebControlGUI::getActiveInstance()->registerParameterMeta(p)` and
constructs a static-default `WebControlGUI` if no active one exists yet
(`al_playground_compat.hpp:318-328`).

Bundle path: `registerParameterBundle` walks `b.parameters()` and mirrors
each into the active panel
(`al_playground_compat.hpp:256-260`).

Macro at end of header rewrites bare `PresetHandler` in user code to
`WebPresetHandler`:

```cpp
#define PresetHandler WebPresetHandler
```

(`al_playground_compat.hpp:963`). Upstream `.cpp` files don't include
this header, so the macro is user-code-only.

### 2.4 `al::WebControlGUI` (the JS-bridge source of truth)

`allolib-wasm/include/al_WebControlGUI.hpp:71-468`.

Internal data: `std::vector<ParameterMeta*> mParameters;` and
`std::vector<float> mLastValues;` (header-only —
`al_WebControlGUI.hpp:368, 377`).

Registration entry points:
- `WebControlGUI& registerParameterMeta(ParameterMeta&)`
  (`al_WebControlGUI.hpp:90-101`). **Idempotent** — explicitly
  dedupes by pointer:

  ```cpp
  for (auto* existing : mParameters) {
      if (existing == &param) return *this;
  }
  ```

- `operator<<(ParameterMeta&)`, `operator<<(ParameterMeta*)`,
  `operator<<(ParameterBundle&)` (lines 103-133).
- Convenience overloads `add(Parameter&)`, `add(ParameterInt&)`, etc.
  (lines 113-121).
- Bundle path: walks `bundle.parameters()` and registers each
  (lines 124-129).

After `push_back`, `notifyParameterAdded` fires
`window.allolib.onParameterAdded({...})` via `EM_ASM`
(`al_WebControlGUI.hpp:379-428`) — packs name/group/type/min/max/value/
default plus `menuItems` and `components` arrays.

### 2.5 `al::SynthVoice` trigger / continuous lists

Internal data:
- `std::vector<ParameterMeta*> mTriggerParams;`
  (`al_SynthVoice.hpp:423`).
- `std::vector<ParameterMeta*> mContinuousParameters;`
  (`al_SynthVoice.hpp:425`).

Entry points:
- `registerTriggerParameter(ParameterMeta&)` —
  `al_SynthVoice.hpp:333-336`.
- `registerParameter(ParameterMeta&)` (continuous variant) —
  `al_SynthVoice.hpp:368-371`.
- `operator<<(ParameterMeta&)` → `registerTriggerParameter`
  (`al_SynthVoice.hpp:350-352`).
- `createInternalTriggerParameter` (see §1) implicitly chains through
  `registerTriggerParameter`.

Idempotency: NOT idempotent. SynthGUIManager works around this by NOT
mirroring trigger params into WebControlGUI (see §1 closing paragraph).

### 2.6 `al::ParameterBundle` (transitive store)

Internal data: `std::vector<ParameterMeta*> mParameters;`
(`allolib/include/al/ui/al_ParameterBundle.hpp:124`). Registration via
its own `operator<<` then transitively visible to ParameterServer / GUI
when the bundle is registered with one of those (each walks
`bundle.parameters()`).

### 2.7 Other places parameters are referenced (not registries)

- `BundleGUIManager` stub at `al_playground_compat.hpp:455-475`.
  Keeps a `vector<ParameterBundle*>` but does no panel mirror.
  Currently unused by examples.
- `ParameterMIDI` at `al_playground_compat.hpp:369-449` retains
  `Parameter*` in CC/note binding lists — does not register them in any
  display registry.

---

## 3. WebControlGUI registry — sActiveInstance lifecycle

Static member declared/defined at
`allolib-wasm/include/al_WebControlGUI.hpp:446` (declaration) and
`:467` (inline-variable definition):

```cpp
inline WebControlGUI* WebControlGUI::sActiveInstance = nullptr;
```

Set sites (`registerGlobalInstance` callers):
- `WebControlGUI` ctor — every constructed instance overwrites the
  pointer (`al_WebControlGUI.hpp:72-78` calls
  `registerGlobalInstance(this)` at `:448-450` body).
- Cleared on dtor unless another instance has overwritten it
  (`:80-83, 452-456`).

Construction sites within our codebase:
1. **User code member `ControlGUI gui;`** — most common path. Because
   `using ControlGUI = WebControlGUI;` (`al_playground_compat.hpp:141`),
   the ctor of `MyApp` runs as part of `_allolib_create()` which fires
   the WebControlGUI ctor and sets `sActiveInstance`.
2. **Static fallback in `WebApp::start`** (lines 304-308 of
   `allolib-wasm/src/al_WebApp.cpp`):
   ```cpp
   static WebControlGUI sDefaultPanel;
   ```
   Only constructed if the fallback branch fires AND
   `getActiveInstance()` is still null. Lazy `static` so the storage
   lives forever after first miss.
3. **Static fallback in `WebPresetHandler::mirrorToActiveGui`**
   (`al_playground_compat.hpp:318-328`):
   ```cpp
   static WebControlGUI sDefaultPanel;
   ```
   Separate `static` — different translation unit's storage from #2.
   Only fires when the user constructs `WebPresetHandler` *before* any
   ControlGUI member.

Activation order ("which instance wins sActiveInstance"):
- No GUI constructed → fallback static created on first
  `parameterServer() << p` mirror in `WebApp::start`, OR on first
  `mPresets << p` in `WebPresetHandler::mirrorToActiveGui`. Whichever
  fires first owns `sActiveInstance` for the rest of the session.
- `ControlGUI gui;` member of `MyApp` → its ctor runs during
  `MyApp` construction, *before* `WebApp::start`. `sActiveInstance`
  points at it. Subsequent `mPresets << p` mirrors land there.
- Multiple `ControlGUI` members — the **last-constructed** wins
  sActiveInstance. Earlier ones are orphaned (still hold their own
  `mParameters`, but the JS bridge can no longer see them because
  every C export reads only `getActiveInstance()`).

`registerParameterMeta` callers (in this codebase):
- User code via `gui << p` (`al_WebControlGUI.hpp:103-105`).
- `WebPresetHandler::mirrorToActiveGui` (§2.3).
- `WebApp::start` mirror loop (§5).
- Bundle pass-through inside `WebControlGUI::registerParameterBundle`
  (`al_WebControlGUI.hpp:124-129`).

---

## 4. JS bridge layer

C exports — the *only* strong definitions live in
`allolib-wasm/src/al_WebControlGUI.cpp:28-130`:

| Export | Purpose |
|---|---|
| `al_webgui_get_parameter_count` | `parameterCount()` from active instance |
| `al_webgui_get_parameter_name` | name as `static thread_local std::string` |
| `al_webgui_get_parameter_group` | group |
| `al_webgui_get_parameter_type` | from `getParameterInfo()` |
| `al_webgui_get_parameter_min` / `_max` / `_value` / `_default` | numeric fields |
| `al_webgui_set_parameter_value` | scalar set |
| `al_webgui_set_parameter_string` | string set |
| `al_webgui_trigger_parameter` | Trigger |
| `al_webgui_set_parameter_vec3` / `_vec4` / `_pose` | multi-component set |

Header note (`al_WebControlGUI.hpp:472-479`) explicitly says inline
copies that used to live in the header are now harmless (weak;
.cpp wins). The .cpp comment at lines 1-17 documents the prior
weak-vs-weak link bug that v0.4.7 fixed.

`EXPORTED_FUNCTIONS` list (`backend/docker/compile.sh:53`) confirms all
above plus `al_webgui_set_parameter_vec3` / `_vec4` / `_pose` are
exported.

Frontend polling (`frontend/src/utils/parameter-system.ts`):
- `connectWasm(module)` (line 328) is called from
  `frontend/src/services/runtime.ts:713` after `_allolib_start()`.
- `loadFromWasm()` (lines 401-464) loops `0 .. count-1` synchronously
  and rebuilds the local `Map<index, Parameter>`. Calls all
  `_al_webgui_get_parameter_*` exports.
- `startPolling()` (lines 469-482) starts a `setInterval(100ms)` running
  `syncFromWasm`.
- `syncFromWasm()` (lines 498-534) compares wasm count against
  *synth-source-only* count in the local map; if mismatch, calls
  `loadFromWasm()`. Otherwise just refreshes scalar values per index.
- A retry ladder (`scheduleRetries`, lines 363-375) fires at
  100/300/600/1000/2000ms after `connectWasm` if the initial load
  returned zero params.
- Push notifications: `window.allolib.onParameterAdded` and
  `window.allolib.onParameterChanged` are wired in `setupAlloLibCallbacks`
  (`parameter-system.ts:258-323`). `onParameterAdded` is invoked from
  `notifyParameterAdded` in WebControlGUI (`al_WebControlGUI.hpp:407-425`).
  `onParameterChanged` is invoked from `syncParametersToJS` in
  `WebControlGUI::draw()` (`al_WebControlGUI.hpp:430-443`), which is
  called from user `gui.draw()` AND from
  `SynthGUIManager::render(AudioIOData&)` after voice processing
  (`al_playground_compat.hpp:846-853`).

Vue panel reads from `parameterSystem`:
- The actual rendered panel is **AnalysisPanel.vue** under the "Params"
  tab (`frontend/src/components/AnalysisPanel.vue:11, 38, 45-46, 74,
  1399`). It calls `parameterSystem.getGrouped()` on every change.
- AnalysisPanel subscribes via `parameterSystem.subscribe(...)` at
  line 1351 and re-renders.
- App.vue references AnalysisPanel only — no `ParameterPanel.vue`
  import (Grep on `frontend/src` shows ParameterPanel.vue is imported
  *zero* times outside itself; cited comments in
  `composables/useResizableDrag.ts:32` and
  `AnalysisPanel.vue:1042` flag it as legacy).

---

## 5. Synchronization between registries

Mirror sites (intentional, current):

- **`WebApp::start` → WebControlGUI** —
  `allolib-wasm/src/al_WebApp.cpp:296-314`. After `onCreate()` returns,
  if `mParameterServer` is non-null (lazily allocated by the first
  `parameterServer()` call), iterate every typed list
  (`parameters()`, `stringParameters()`, `vec3Parameters()`,
  `vec4Parameters()`, `poseParameters()`) and call
  `gui->registerParameterMeta(*p)`. If no `gui` exists, falls back to
  the static `sDefaultPanel`.

  Gap: the upstream `ParameterServer` does not expose lists for
  `ParameterInt`, `ParameterBool`, `ParameterMenu`, `ParameterChoice`,
  `ParameterColor`, or `Trigger`. Their stored pointers in
  `mParameters` are returned only via the typed `parameters()`
  accessor (which returns `vector<Parameter*>` via dynamic_cast filter
  — see `al_ParameterServer.cpp:444-503`). Net: a user that does
  `parameterServer() << myInt` registers OSC for it but the panel
  mirror skips it. The header at `al_ParameterServer.hpp:270-275`
  shows only the six accessor functions.

- **`WebPresetHandler::operator<<` / `registerParameter` →
  WebControlGUI** — see §2.3. Mirrors are unconditional, dedup happens
  in WebControlGUI by pointer identity. Bundles also mirrored
  individually.

- **`SynthGUIManager::render(AudioIOData&)` → JS values** —
  `al_playground_compat.hpp:846-853`. Calls `gui->draw()` from the
  audio render path, which triggers `syncParametersToJS` for any
  parameter whose value changed since last sync. Does NOT add new
  parameters; only pushes value changes via `onParameterChanged`.

Gaps (registration paths that DO NOT mirror):

- `gui << p` (direct WebControlGUI register) — not visible to
  PresetHandler. Saving a preset captures only `mPresets` parameters,
  not `gui`-only ones.
- `parameterServer() << p` for INT/BOOL/MENU/CHOICE/COLOR/TRIGGER —
  not mirrored to panel because the WebApp::start mirror loop only
  walks the FLOAT/STRING/VEC3/VEC4/POSE accessor lists
  (`al_WebApp.cpp:309-313`).
- `voice.registerTriggerParameter(p)` (or
  `createInternalTriggerParameter`) — by design not mirrored
  (comment at `al_playground_compat.hpp:760-768`). Visible only via
  `triggerParameters()` and `WebSequencerBridge`.
- `bundle << p` then `bundle` only registered with
  `parameterServer()`/`mPresets` — bundle parameters land in those
  registries' `mParameterBundles` map, not the bare `mParameters`
  vector. Panel mirror of WebApp::start does NOT walk
  `mParameterBundles`, so bundle params skip the panel via this route.
  WebControlGUI's bundle handler does walk
  (`al_WebControlGUI.hpp:124-129`), so `gui << bundle` does work.

Idempotency in the mirror chain: WebControlGUI dedups by pointer
(`al_WebControlGUI.hpp:95-97`), so multiple mirror sources for the
same `Parameter` don't double up. ParameterServer and
PresetHandler do NOT dedup — but neither one is read by the panel,
so duplicate callbacks are the only consequence.

---

## 6. /presets filesystem layer

Mount call sites (current, single source):

- `allolib-wasm/src/al_WebApp.cpp:28-60`: a file-static
  `gPresetIDBFSMounted` flag and `ensurePresetIDBFSMounted()` helper.
  Called from `WebApp::WebApp()` ctor (`al_WebApp.cpp:200`). The
  comment block at lines 21-28 documents the historical alternatives
  (Module.preRun, static-initializer EM_ASM) that were tried and
  abandoned because of IDBFS-not-loaded races.

  The mount block does, in order:
  1. `FS.mkdir('/presets')` (try/catch — exists on warm reload).
  2. `FS.mount(IDBFS, {}, '/presets')`.
  3. **Stub-create `/presets/default.presetMap` synchronously** if not
     present (`al_WebApp.cpp:48-54`). This is the v0.6.3 race fix.
  4. `FS.syncfs(true, ...)` to overlay IndexedDB contents on top.

The race that triggered the v0.6.3 patch:
`PresetHandler::PresetHandler(...)` →
`setRootPath(rootDirectory)` → `setCurrentPresetMap()` (with no args
defaults to `mapName="default"`, `autoCreate=true`) →
`File::exists(mapFullPath)` test
(`allolib/src/ui/al_PresetHandler.cpp:701-744`). If the file did not
exist, the auto-create branch tried to write the file via
`storeCurrentPresetMap` *before* the async `FS.syncfs(true)` had
populated IDBFS, so the write hit a race. The stub write makes
`File::exists` return true unconditionally, which routes execution
to the `else` branch (line 741) that just calls `readPresetMap` —
which reads whatever is on disk at the moment (initially the empty
stub, eventually whatever the async syncfs(true) callback overlays).

IDBFS lifecycle:
- `FS.syncfs(true, ...)` — runs once at WebApp ctor (the mount block
  above, line 55). Loads IndexedDB → MEMFS overlay.
- `FS.syncfs(false, ...)` — runs after every successful preset store
  via `WebPresetHandler::installWebHooks` →
  `registerStoreCallback`
  (`allolib-wasm/include/al_playground_compat.hpp:303-316`).
  Also called from `presetFiles.clearPresetFiles` after a recursive
  remove (`frontend/src/services/presetFiles.ts:73-75`).

The "synchronous-on-mkdir but async-on-syncfs(true)" model matches
the comment at `al_WebApp.cpp:21-28`. `FS.mkdir`, `FS.writeFile`,
`FS.readFile` against MEMFS are synchronous; the IDBFS
serialization through IndexedDB is async and reports completion via
the callback.

Other paths through `/presets`:
- Frontend: `_al_list_dir("/presets")` enumerates contents via
  C++ helper at `allolib-wasm/src/al_WebApp.cpp:1178-1228`.
- Frontend: `_al_remove_dir("/presets")` recursive rm at
  `al_WebApp.cpp:1230-1253`.
- Both consumed by `frontend/src/services/presetFiles.ts:33-122`.
  Three consumers in the JS layer:
  - `listPresetFiles` → JSON parse + return entries.
  - `clearPresetFiles` → calls `_al_remove_dir` + `FS.mkdir` +
    `FS.syncfs(false)`. If module is dead, falls back to
    `indexedDB.deleteDatabase('/presets')`.
  - `syncPresetFilesToProject` → calls listPresetFiles then
    `projectStore.addOrUpdateFile('presets/<name>', body)`.

`PresetHandler::storePreset` (in upstream
`allolib/src/ui/al_PresetHandler.cpp:152-220`) writes
`<rootDir>/<subDir>/<name>.preset` and `default.presetMap`. Path is
computed via `getCurrentPath()` (line 612-618), which uses
`File::conformPathToOS(mRootDir + mSubDir)`. WebPresetHandler's
`normalizeWebPath` (`al_playground_compat.hpp:226-238`) ensures any
relative root resolves to an absolute `/presets`-rooted path.

---

## 7. The Vue side

Components:

- `frontend/src/components/AnalysisPanel.vue` — the rendered Params
  panel.
  - Imports `parameterSystem`, `ParameterType`, `Parameter`,
    `ParameterGroup` from `@/utils/parameter-system` (line 11).
  - Reactive ref `parameterGroups = ref<ParameterGroup[]>([])` (line 38).
  - `updateParameters()` calls `parameterSystem.getGrouped()` (line 45).
  - `hasParameters` computed from `parameterSystem.count` (line 74).
  - `paramUnsubscribe = parameterSystem.subscribe(...)` at line 1351
    triggers re-render and auto-switches `activeTab` to "params" if
    params arrive while another tab is active (line 1354).
  - Auto-resets via `parameterSystem.resetAllToDefaults` etc.
    (line ~1013, 1093, 1140).
  - Mutations route through `parameterSystem.setByIndex`,
    `setParameterValue`, `setPose`, `trigger`, `set` (string lookup).
  - Read in template: `{{ parameterSystem.count }}` (line 1399).

- `frontend/src/components/ParameterPanel.vue` — present in the
  codebase but **not imported anywhere** (Grep on `import.*ParameterPanel`
  → zero hits). Still maintains its own
  `parameterSystem.subscribe` block and same accessor patterns.
  Documentation comments at `composables/useResizableDrag.ts:32` and
  `AnalysisPanel.vue:1042` flag it as legacy. It uses
  `parameterSystem.getAllGroups()` when `showAllSources` is true.

- `frontend/src/utils/parameter-system.ts` — the API surface to the
  WASM bridge. See §4. Keys:
  - `parameters: Map<number, Parameter>` keyed by C++ index.
  - `objectParameters: Map<string, Parameter[]>` keyed by object ID.
  - `environmentParameters: Parameter[]`.
  - `cameraParameters: Parameter[]`.
  - Initialized statically in ctor (`initializeEnvironmentParams`,
    `initializeCameraParams`, `setupAlloLibCallbacks`).
  - Singleton: `export const parameterSystem = new ParameterSystem()`
    line 1083; mirrored to `window.alloParameterSystem` line 1087.

- `frontend/src/services/runtime.ts` — module init.
  - `connectWasm(module)` at line 713 after `_allolib_start()`.
  - `disconnectWasm()` at line 753 in `stop()`.
  - Comment block at lines 273-277 confirms the IDBFS preRun mount
    was removed in v0.6.1; mount is now C++-side.

Reactive update path post-init:
- C++ side appends a parameter → `notifyParameterAdded` →
  `onParameterAdded` (push) → `parameters.set(index, ...)` →
  `notifyChange()` → all subscribers refresh.
- C++ side mutates a value → next `gui.draw()` call →
  `syncParametersToJS` → `onParameterChanged(index, value)` (push) →
  `notifyChange()` → subscribers re-read.
- Polling backstop: every 100ms `syncFromWasm` checks count drift;
  on drift, full `loadFromWasm` rebuilds the map.

---

## 8. Studio examples that exercise this pipeline

Sampled from `frontend/src/data/playgroundExamples.ts`:

- **`pg-osc-env` (Wavetable Oscillator) — line 184**.
  - `class OscEnv : public SynthVoice` calls
    `createInternalTriggerParameter("amplitude", 0.3, 0, 1)` etc.
    (lines 226-231). These land in `OscEnv::mTriggerParams` only.
  - `class MyApp : public App` declares
    `Parameter amplitude{...}; ControlGUI gui;` plus more (lines
    around 248-260) and does `gui << amplitude << attackTime <<
    releaseTime << waveform` (line 299). These land in
    `WebControlGUI::mParameters` (sActiveInstance == this `gui`).
  - Panel reads from `gui` only. The voice's trigger params do NOT
    appear in the panel by design.
  - Result: panel shows 4-5 control sliders.

- **`pg-osc-sin` (Sine envelope) — line ~50**. Same shape as above:
  voice has 5 internal trigger params (lines 79-83), MyApp has 3
  GUI params (line 133: `gui << amplitude << attackTime <<
  releaseTime`). Panel shows 3.

- **`pg-fm` (FM synthesizer) — around line 380**. Voice has 13
  trigger params (lines 408-427). MyApp `gui << amplitude << idx1
  << idx2 << carMul << modMul` and a second line `gui << vibRate1
  << vibDepth << attackTime << releaseTime` (lines 523-524). Panel
  shows 9 (the union; `gui` accumulates across multiple `<<`
  expressions).

- **examples.ts line 6132** — `gui << frequency << amplitude <<
  rotation_speed; gui << shape_type << audio_enabled; gui << hue <<
  saturation << brightness;` — non-synth example using only
  `ControlGUI`. Panel shows all 8.

- **Studio examples (`studioExamples.ts`)**: only one usage of
  `createInternalTriggerParameter` at lines 2515-2516. No `gui <<`,
  no `mPresets <<`, no `parameterServer() <<`. The Studio examples
  are biased toward graphics demos that don't expose runtime
  parameters.

No example in any data file uses `parameterServer() << p` or
`mPresets << p` directly. Both registration paths exist in the
runtime infrastructure but are uncovered by the bundled examples.

---

## Open questions / observations

- Two distinct fallback `static WebControlGUI sDefaultPanel;` instances
  exist — one in `WebApp::start` (`al_WebApp.cpp:305`) and one in
  `WebPresetHandler::mirrorToActiveGui`
  (`al_playground_compat.hpp:323`). They live in different translation
  units. If both fire (e.g., `mPresets << p` at static init time
  before `WebApp::start`), the first to fire claims `sActiveInstance`
  and the second's call to `getActiveInstance()` returns the first
  panel — the second `sDefaultPanel` storage exists but is never
  pointed at by `sActiveInstance`. Whether this happens in practice
  depends on the order of static-vs-dynamic ctor invocation, which
  Emscripten order is hard to predict.

- `WebApp::start`'s mirror loop only walks five typed accessor lists
  on `ParameterServer` (FLOAT/STRING/VEC3/VEC4/POSE). The accessor
  list does NOT include INT/BOOL/MENU/CHOICE/COLOR/TRIGGER. This
  asymmetry is silent — those parameters silently don't appear in the
  panel even though they're in `mParameters`.

- `WebPresetHandler` and `WebControlGUI` both maintain
  `vector<ParameterMeta*>` lists pointing at the same objects, so the
  user has two separate aliasing registries that both must remain
  consistent for save/restore + display to match. There is no
  invariant guarantee that "everything in `mPresets` is also in
  `gui`", only the unidirectional mirror at `mPresets << p` time.
  Direct calls to `PresetHandler::registerParameter(p)` (not via
  `WebPresetHandler::operator<<`) skip the mirror.

- The `#define PresetHandler WebPresetHandler` macro at
  `al_playground_compat.hpp:963` is a textual rewrite that affects
  every translation unit that includes the playground compat header.
  Upstream `.cpp` files do not, so they see real
  `al::PresetHandler`. Mixing the two within one TU works only because
  the subclass *is-a* base — but the comment at lines 938-962
  acknowledges that qualified `al::PresetHandler` references in user
  code will also be rewritten, which is silently incorrect.

- `parameter-system.ts` retains a `populateFromDetectedSynths` path
  (lines 987-1039) that adds parameters at fake indices ≥ 1000
  *before* WASM publishes them. The bail-out at lines 993-996 says
  "skip if WASM has any params yet" — but the time window for this
  call vs. WASM init is unclear from the audit alone.

- `SynthGUIManager::render(AudioIOData&)` calls `gui->draw()` from the
  *audio* path (`al_playground_compat.hpp:846-853`). This means
  `syncParametersToJS` and its `EM_ASM` callback fire from the audio
  thread. Whether Emscripten's audio worklet runs `EM_ASM` on the
  main thread or worker is a question the audit cannot resolve from
  static reading; the `window.allolib.onParameterChanged` JS callback
  must tolerate either.

- `ParameterPanel.vue` (991 lines) is dead code per import analysis,
  but still references `parameterSystem.setParameterValue`,
  `setPose`, `setByIndex`, `getAllGroups`, `getGrouped`,
  `subscribe`, `resetAllToDefaults`, etc. — i.e. it would compile and
  appear functional if re-imported. Its `getAllGroups` reading path
  is the only consumer of `parameterSystem.getAllGroups()` in the
  rendered tree (AnalysisPanel uses only `getGrouped`).

- The retry ladder in `parameter-system.ts:scheduleRetries` (5 timers
  at 100/300/600/1000/2000 ms after `connectWasm`) only fires if the
  initial `loadFromWasm` returned zero. It will not detect parameters
  added *between* retries 1 and 5; the 100ms `setInterval` polling
  loop is the catch-all.

- The bundle-vs-direct asymmetry: `WebControlGUI::registerParameterBundle`
  walks `bundle.parameters()` and registers each one
  (`al_WebControlGUI.hpp:124-129`). But upstream
  `PresetHandler::registerParameterBundle` keeps the bundle in a
  separate `mBundles` map (`al_PresetHandler.cpp:655-661`) — preset
  serialization (`storePreset`, lines 178-200) does iterate
  `mBundles`. So bundles save correctly *and* display correctly
  through `gui << bundle`, but `parameterServer() << bundle` neither
  saves them nor mirrors them anywhere visible.


---

# 2. Design

# AlloLib Studio Online — Unified Parameter Pipeline Design

**Status:** Design only. No implementation, no migration plan.
**Scope:** Replaces the patchwork of three parameter registries plus mirror
loops that has accumulated since v0.4.5. Lives entirely in
`allolib-wasm/include/` and `allolib-wasm/src/`. No upstream patches.
**Audience:** the engineer doing the next push and the agent that reviews it.

---

## 0. Problem statement (quick)

Today the WASM build maintains three parameter registries that the user can
populate via three different idioms:

1. `gui << p` — `al::WebControlGUI::mParameters` (where the C exports read).
2. `mPresets << p` — `al::PresetHandler::mParams` (used for store/recall).
3. `parameterServer() << p` — `al::ParameterServer::mParameters{,String,…}`
   (used to dispatch OSC).

The Vue Studio Params panel reads only registry #1 via the C exports in
`al_WebControlGUI.cpp`. To plug the gap, every push has added a *mirror*: the
WebPresetHandler subclass mirrors registry #2 → registry #1 on `<<`;
`WebApp::start` walks registry #3 at start-time and mirrors it → registry #1.
These mirrors are racy, partial, and now collide with each other (a parameter
in all three registries gets pushed into #1 three times — the dedup-by-pointer
loop in `WebControlGUI::registerParameterMeta` handles this, but only because
we audited it last week). On top of that, `/presets` IDBFS init still races
the user's `PresetHandler` ctor in the M4 demo: the upstream
`setCurrentPresetMap` sees a missing `default.presetMap`, tries to write a
default, and hits IDBFS before `FS.syncfs(true, …)` has populated.

The redesign collapses the three mirrors into a **single global registry**
that everything else feeds. The Vue panel reads only that. `/presets`
readiness is shifted into a single moment with one well-defined invariant.

---

## 1. The single registry

A new `al::ParameterRegistry` singleton owns the canonical parameter list
that the JS bridge — and therefore the Vue panel — reads from. Each of the
three legacy registries (`WebControlGUI::mParameters`,
`PresetHandler::mParams`, `ParameterServer::mParameters`) keeps its own list
for native-API compatibility *and* additionally calls into the global registry
on every register. Mirrors disappear entirely.

### 1.1 Header

`allolib-wasm/include/al_parameter_registry.hpp`

### 1.2 API (pseudocode)

```
namespace al {

class ParameterRegistry {
public:
    static ParameterRegistry& global();

    // Adds p if not already present (dedupe by raw pointer).
    // Returns true if added, false if it was already in the registry.
    bool add(ParameterMeta* p);

    bool has(ParameterMeta* p) const;
    size_t count() const;
    ParameterMeta* at(size_t idx) const;

    // Snapshot: returns an immutable view (or a copy for caller iteration).
    // Used by the C exports so the read path doesn't have to lock.
    std::vector<ParameterMeta*> snapshot() const;

    // Subscribe to add/remove. Returns a token for unsubscribe.
    using OnChangeFn = std::function<void(ParameterMeta*, ChangeKind)>;
    SubscriptionToken onChange(OnChangeFn cb);
    void unsubscribe(SubscriptionToken);

    // Wipe (called from WebApp dtor on re-run / module teardown).
    void clear();

    // Atomic dirty counter — JS polls this cheaply to decide whether
    // a full re-read is necessary.
    uint64_t version() const noexcept;

private:
    ParameterRegistry() = default;
    // members …
};

enum class ChangeKind { Added, Removed, Cleared };

} // namespace al
```

### 1.3 Identity & dedup

Identity is the **raw `ParameterMeta*` pointer**. This is the AlloLib idiom
upstream already commits to (`registerParameter(ParameterMeta&)` stores `&p`).
Names are not unique (two `Parameter freq` in different bundles is legal).
Pointer equality also cheaply rejects the dominant duplicate case:
`gui << p; mPresets << p; parameterServer() << p;` lands `&p` in the registry
exactly once with no `getName()` strcmp.

### 1.4 Thread safety

Writes happen exclusively on the main thread (parameter ctors, `<<`, user
`onInit`). Reads happen from:

- The C exports — same thread (Emscripten main loop).
- The audio worklet — *only* through `Parameter::set/get`, which already has
  upstream's atomic primitives. Worklets do **not** enumerate the registry.
- JS callback dispatch via `EM_ASM` — same thread as the writer.

So contention is single-threaded in practice. The registry uses a
`std::vector<ParameterMeta*>` plus a `std::atomic<uint64_t> mVersion`. No
mutex; the version counter is the seqlock cue for the JS side. If a future
WebWorker reads were added, this becomes a `std::shared_mutex` swap; design
notes that out as out-of-scope for this push.

### 1.5 Lifecycle

- **Module init:** registry is a function-local-static, lazily instantiated
  on the first `global()` call. Survives across all subsystem inits.
- **`WebApp::~WebApp`:** calls `ParameterRegistry::global().clear()` so the
  next example run starts empty. This is the hook point that prevents
  parameters from previous examples bleeding into the panel after a
  Studio "Run" press.
- **Removal:** registry tracks add/remove. Today no path removes a
  parameter mid-run; the API includes a stub for the future, the
  `Removed` ChangeKind callback dispatches to JS, and `clear()` fires
  one `Cleared` event rather than N `Removed`s.

### 1.6 What feeds the registry

Every existing class continues to own its native registry. We add a single
line that pushes into the global registry:

| Class | File | Hook |
|---|---|---|
| `WebControlGUI::registerParameterMeta` | `al_WebControlGUI.hpp` | After existing dedup, call `ParameterRegistry::global().add(&param)`. |
| `WebPresetHandler::registerParameter` | `al_playground_compat.hpp` | After `PresetHandler::registerParameter(p)`, call `ParameterRegistry::global().add(&p)`. The current `mirrorToActiveGui()` call deletes. |
| `ParameterServer` registrations | new shim in `allolib-wasm/include/al_WebParameterServer.hpp` (or a callback installed at construction) | See §6. |

The C exports in `al_WebControlGUI.cpp` (already the *strong* definitions)
switch from `WebControlGUI::getActiveInstance()` to
`ParameterRegistry::global()`. From the JS side nothing changes — same
function names, same return shapes — but the *source* is now a single list,
populated regardless of which native idiom the user wrote.

### 1.7 What the existing classes still do

`WebControlGUI` keeps its own `mParameters` because user code that
explicitly creates a `ControlGUI gui;` member still expects `gui.draw()` and
`gui.parameterCount()` to work locally. `PresetHandler::mParams` is
upstream's storage for store/recall and *must* keep working unchanged.
`ParameterServer` keeps its `mParameters{,String,Vec3,…}` lists for the OSC
dispatch routing maps. The registry is *additive*, not a replacement.

---

## 2. Initialization order — `/presets`

### 2.1 Decision: hybrid of Option D + Option C

Use **Option D (frontend `runtime.ts` mounts IDBFS via `Module.preRun` with
the closed-over `Module.FS`)** as the primary readiness mechanism, and
**Option C (`WebPresetHandler` overrides `setCurrentPresetMap` to skip the
auto-create branch on web; pre-creates a stub synchronously via `EM_ASM`)**
as a defensive fallback inside the C++ side.

Option A (synchronous Asyncify-blocking mount in `WebApp::WebApp()`) is
rejected because Asyncify-blocking inside a constructor invades every user
project — the static-init of `MyApp` happens before `main()`, and
Asyncify-blocking pre-`main` interacts badly with Emscripten's stack
unwinding. Option B (lazy PresetHandler) is rejected because it forces
composition over inheritance and breaks `mPresets << p` ABI parity with
native AlloLib (the user-facing constraint).

### 2.2 Why D, not just the existing C++ static-init

The current `ensurePresetIDBFSMounted()` in `al_WebApp.cpp` runs in
`WebApp::WebApp()`. Empirically (per the v0.6.3 follow-up), the mount
*does* fire there — but `FS.syncfs(true, callback)` is asynchronous in JS,
and the user's `PresetHandler mPresets;` member ctor (which runs *after*
the WebApp base ctor returns, but synchronously in the same JS turn) hits
`File::exists("/presets/default.presetMap")` *before* `syncfs` calls back.
The stub-write helps when there *is* no stored presetMap, but it doesn't
help when the user has a stored presetMap from last session that hasn't
been read into MEMFS yet.

`Module.preRun` runs **before** any C++ `WASM_TABLE_INIT`-time static
constructors (which is when `MyApp` itself constructs in Emscripten's
default static-init main path), giving us a synchronous-from-JS-side
window. The trick is doing it *correctly*: today's `runtime.ts` calls have
been broken in past pushes because they referenced `mod.FS` from the
dynamic-import default, which is a different binding from the `Module.FS`
the C++ side actually uses. The redesign closes over `Module` directly:

```
// pseudocode in runtime.ts
const Module = {
  preRun: [() => {
    Module.FS.mkdir('/presets');
    Module.FS.mount(Module.IDBFS, {}, '/presets');
    // Pump synchronously from IndexedDB into MEMFS BEFORE main() runs.
    // We resolve the awaitable in a Promise that runtime awaits before
    // resolving createModule(). When createModule() resolves, /presets is
    // populated from IndexedDB.
    return new Promise((resolve, reject) =>
      Module.FS.syncfs(true, (err) => err ? reject(err) : resolve())
    );
  }],
  // …rest of Module config
};
```

Emscripten's `MODULARIZE` runtime supports `preRun` returning a Promise
since 3.1.51; we're on 3.1.73 so this works. `createModule()` waits for
preRun to complete before invoking `main()`. By the time *any* C++ code
runs, `/presets` is mounted *and populated*.

### 2.3 The defensive C++ fallback (Option C)

Even with D in place, `WebPresetHandler` overrides
`setCurrentPresetMap(name, autoCreate)` to:

1. Compute the absolute presetMap path (`getCurrentPath() + name + ".presetMap"`).
2. If it doesn't exist, write an empty file synchronously via `EM_ASM`
   (`FS.writeFile(path, '')`) — same trick the current
   `ensurePresetIDBFSMounted` uses, but applied per-call rather than once
   at mount time.
3. Call `PresetHandler::setCurrentPresetMap(name, /*autoCreate=*/false)`
   so upstream's auto-create branch (which calls `File::write` non-trivially
   and races IDBFS state in pathological cases) is never taken.

This is the only hook needed in the override; it neutralizes the failure
mode that aborted M4 even when the IDBFS mount had completed.

### 2.4 Single readiness invariant

After this design, the invariant is:

> **By the time any user-code C++ constructor runs, `/presets` is mounted,
> populated from IndexedDB, and `default.presetMap` exists (empty or real).**

Maintained by D for mount + populate, and by C's
`setCurrentPresetMap` override for any *subsequent* presetMap referenced
by user code that didn't exist last session.

### 2.5 IDBFS write path

`WebPresetHandler::installWebHooks` already calls `FS.syncfs(false, …)`
after every preset store via `registerStoreCallback`. Keep that. The
write path is independent of the read-readiness problem.

---

## 3. Subscription pattern for the Vue panel

### 3.1 Layered approach

**Layer 1: dirty-version polling (always on, cheap).**
The Vue panel polls `_al_param_registry_version()` (new C export, returns
`ParameterRegistry::global().version()`) once per animation frame
(`requestAnimationFrame` in the panel's `onMounted` hook). On mismatch with
the cached version, it does a full re-read of the count + per-index info.

**Layer 2: push notification (eager, JS callback).**
The registry's `onChange` fires an `EM_ASM` block that calls
`window.allolib.onParameterAdded(payload)` — the same JS function the
existing `WebControlGUI::notifyParameterAdded` already calls. The Vue panel
subscribes to this callback (the runtime exposes it as a Pinia store
mutation) and re-renders immediately. The push path is the fast path; the
poll is the safety net for any timing gap during page-load races.

**Layer 3: per-parameter value sync (already exists).**
`WebControlGUI::syncParametersToJS` walks parameters each `draw()` call and
fires `window.allolib.onParameterChanged(idx, value)` on changes. This is
unrelated to the registry redesign and stays as-is — it operates on the
*content* of parameters, not the *roster*.

### 3.2 Why both push and poll

Push alone has been bitten twice:

- The Vue panel mounts asynchronously (Pinia store init can land *after*
  the first registry adds fire); push events get dropped on the floor.
- Race recovery after a hot-reload or example switch is hard with
  push-only — the panel doesn't know it missed events.

Polling the version counter is one int-load per frame; the cost is
negligible and it eliminates the "panel sometimes empty until the user
clicks something" class of bug.

### 3.3 Suggested C exports

```
EMSCRIPTEN_KEEPALIVE uint64_t al_param_registry_version();
EMSCRIPTEN_KEEPALIVE int      al_param_registry_count();
// Existing per-index getters in al_WebControlGUI.cpp keep their names but
// internally read from ParameterRegistry::global().at(idx).
```

---

## 4. PresetHandler unification

### 4.1 Current state audit

`WebPresetHandler` (in `al_playground_compat.hpp`) is a subclass of upstream
`al::PresetHandler`. The user-facing ergonomic is achieved via a `#define
PresetHandler WebPresetHandler` at the *very* end of the compat header, so
user code's `PresetHandler mPresets;` constructs `WebPresetHandler`. The
override exists to:

(a) `mirrorToActiveGui(p)` — push every registered parameter into
    `WebControlGUI::sActiveInstance` so it shows up in the panel.
(b) Install IDBFS persist via `registerStoreCallback`.
(c) Wire morph tick to `gPlaygroundAnimateHook`.
(d) Expose legacy aliases (`tick(dt)`, `recallPreset(name, t)`, `dumpFiles`).

### 4.2 What changes

(a) **Goes away.** With the global registry, `PresetHandler::registerParameter`
(via the WebPresetHandler override) calls `ParameterRegistry::global().add(&p)`
directly. The "active GUI mirror" logic deletes — there is no longer a
notion of "the active GUI" mediating between handlers and the panel.

(b), (c), (d) **Stay.** These are independent of registry routing.

The `<<` overload still exists for ABI/dispatch correctness (upstream's
`operator<<` is non-virtual; without the hide-by-name override, `mPresets <<
p` would static-dispatch to base and skip our hook), but its body shrinks:

```
// pseudocode
WebPresetHandler& registerParameter(ParameterMeta& p) {
    PresetHandler::registerParameter(p);          // upstream bookkeeping
    ParameterRegistry::global().add(&p);          // panel
    return *this;
}
```

### 4.3 Does the registry remove the macro shadow?

No. The `#define PresetHandler WebPresetHandler` exists for two reasons:

1. To attach the IDBFS-persist callback / morph wiring / aliases (b, c, d).
2. To force `mPresets << p` through our override.

Reason 1 is independent of the registry. Reason 2 is solved by the
override-on-`<<`. Neither is solved by the registry alone.

A cleaner alternative — **install a static callback on
`al::PresetHandler::registerStoreCallback`-equivalent for parameter-add
events**, if upstream supported it — does not exist in upstream's API. So
the macro shadow stays. Document it as such; do not try to remove it in
this push.

### 4.4 Subclass vs. composition

Subclass is the correct call given the constraint *no upstream patches*
and *preserve `mPresets << p` ABI*. Composition (a `WebPresetHandlerWrapper`
holding a `PresetHandler*`) breaks the `<<` operator dispatch on the
member-of-class case (`mPresets` is a value member, not a pointer; user
code writes `PresetHandler mPresets;`). Rejected.

---

## 5. Native parity preservation

The MAT200B native parity test
(`AlloLib Native Test Files/M5_2_preset_unify.cpp`) is the canonical
parity surface. The redesign preserves every API call it uses:

| Native call | Native dispatch | WASM dispatch under redesign |
|---|---|---|
| `Parameter freq{name, group, def, min, max};` | upstream ctor | upstream ctor (unchanged) |
| `gui << freq;` | `ControlGUI::operator<<` | `WebControlGUI::operator<<` → adds to local `mParameters` AND `ParameterRegistry::global()` |
| `mPresets << freq;` | `PresetHandler::operator<<` | `WebPresetHandler::operator<<` → `PresetHandler::registerParameter` (upstream's `mParams`) AND `ParameterRegistry::global()` |
| `parameterServer() << freq;` | `ParameterServer::operator<<` | `ParameterServer::operator<<` (upstream's lists) AND `ParameterRegistry::global()` (via the hook in §6) |
| `mPresets.storePreset("a")` | upstream serializer | upstream serializer (web override only neutralizes setCurrentPresetMap) |
| `mPresets.recallPreset("a")` | upstream loader | upstream loader (unchanged) |
| `mPresets.morphTo("a", 0.5)` | upstream morph engine | upstream morph engine, ticked from `gPlaygroundAnimateHook` |

Every user-facing identifier in the parity test resolves to upstream code
or to a subclass that does what upstream does *plus* a registry add. The
test compiles untouched against vanilla AlloLib (no compat header) and
against the WASM build (with compat header). No source-level divergence.

---

## 6. ParameterServer integration

### 6.1 Why it has to feed the registry

Today, parameters registered via `parameterServer() << p` are mirrored into
`WebControlGUI` only at `WebApp::start` time (the explicit loop in the .cpp
walking `parameters() / stringParameters() / vec3Parameters() / …`). Two
problems:

- If user code registers *more* parameters with the server *after* `start`
  (rare but valid), the panel never sees them.
- The mirror loop has to know the type-specific accessor names. Each new
  upstream parameter type adds a maintenance burden.

### 6.2 The hook

There is no virtual `registerParameter` on upstream `ParameterServer` we can
override. Two options:

**Option 6.2a:** Subclass `ParameterServer` as `WebParameterServer` and
hide-by-name the `registerParameter` overloads (same trick as
WebPresetHandler). Each override calls base then adds to the registry.
`WebApp::parameterServer()` returns a `WebParameterServer&`. User code
that wrote `ParameterServer ps;` directly is rare (the canonical idiom is
`parameterServer() << p`); for safety, add `using ParameterServer =
WebParameterServer;` shadow at the end of the compat header — same pattern
as the PresetHandler shadow.

**Option 6.2b:** Wrap the lazy-init in `WebApp::parameterServer()` to
install a one-shot polling hook in `WebApp::tick`: every N ticks, walk the
server's parameter lists and add any unseen ones to the registry. Cheap
(N seen-pointers comparison), survives late-registrations.

Recommendation: **6.2a as primary**, fall back to 6.2b only if the subclass
hide-by-name turns out to break some uncommon ParameterServer overload.
The subclass path is consistent with WebPresetHandler and removes the
existing one-shot mirror loop in `WebApp::start` entirely.

### 6.3 What deletes from `WebApp::start`

The five-line block iterating `mParameterServer->parameters()` /
`stringParameters()` / `vec3Parameters()` / `vec4Parameters()` /
`poseParameters()` and pushing into `WebControlGUI::registerParameterMeta`
deletes. The subclass + registry already covered every call site.

---

## 7. Failure modes the redesign explicitly handles

| Failure mode (currently observed) | Redesign mechanism |
|---|---|
| M4 abort: "No preset map. Creating default." | §2 — preRun-promise + setCurrentPresetMap override. By the time PresetHandler ctor runs, `/presets` is mounted, populated, and the override neutralizes the auto-create write entirely. |
| Empty Vue panel after `parameterServer() << p` only | §6 — WebParameterServer subclass routes through the registry; panel gets the parameter on the *call*, not at start-time. |
| Empty Vue panel after `mPresets << p` only | §4 — WebPresetHandler override routes through the registry. |
| `/presets` files not appearing in explorer until a delay | §2 — preRun-promise blocks createModule resolution on `FS.syncfs(true)` completion. Files exist in MEMFS before the user can interact with the IDE. |
| Parameter registered twice when user calls `gui << p; mPresets << p` | §1.3 — registry dedup by pointer. Each `<<` adds to its native list independently (upstream may keep duplicates in some cases) but the registry sees one entry, panel renders one slider. |
| Multiple `WebControlGUI` instances (e.g. user creates two `ControlGUI` members) | §1 — registry is global; no notion of "active instance" in the panel read path. Multiple GUIs can coexist; each adds to its own `mParameters` *and* the global registry. The panel shows the union, deduped. |
| User code that explicitly creates `ControlGUI gui;` member | Preserved. `gui << p` still works locally (gui owns its own mParameters list and `gui.draw()` still iterates that list); the registry add is additional. |
| Hot-reload / re-run of an example leaves stale parameters in panel | §1.5 — `WebApp::~WebApp` calls `ParameterRegistry::global().clear()`. Next run starts empty. |
| Vue panel mounts after first parameter add fires | §3 — version-counter polling reconciles even if the push event was missed. |
| Worklet thread enumerates registry concurrently with main-thread add | §1.4 — worklets don't enumerate; they hold direct `Parameter*` for `set/get`. No registry contention. |

---

## 8. Architectural diagram

```mermaid
flowchart TD
    A[User code: Parameter freq{...}] -->|stack/heap object| B[ParameterMeta* &freq]

    B -->|"gui << freq"| C[WebControlGUI::registerParameterMeta]
    B -->|"mPresets << freq"| D[WebPresetHandler::registerParameter]
    B -->|"parameterServer() << freq"| E[WebParameterServer::registerParameter]

    C -->|local list| C1[WebControlGUI::mParameters]
    D -->|upstream list| D1[PresetHandler::mParams]
    E -->|upstream lists| E1[ParameterServer::mParameters / mStringParameters / ...]

    C -->|add| R[ParameterRegistry::global]
    D -->|add| R
    E -->|add| R

    R -->|version++| V[atomic uint64_t mVersion]
    R -->|fire onChange| X[EM_ASM window.allolib.onParameterAdded]

    V -->|polled by| P[Vue panel rAF loop]
    X -->|push| P

    P -->|reads count + per-index info| Y[al_webgui_get_parameter_count / al_webgui_get_parameter_info_*]
    Y -->|reads from| R

    P -->|user moves slider| Z[al_webgui_set_parameter_value]
    Z -->|writes through pointer| B

    subgraph "Single Source of Truth"
        R
        V
    end

    subgraph "Native Compatibility Storage"
        C1
        D1
        E1
    end
```

The key property: **every arrow into the registry is a side-effect of a
native AlloLib idiom the user already writes, with no extra mirror step
between any two registries.** The Vue panel reads the registry; native
classes own their own storage; nothing mirrors anything.

---

## 9. What changes vs. what stays

| File | Change | Notes |
|---|---|---|
| `allolib-wasm/include/al_parameter_registry.hpp` | **NEW** | Singleton, API per §1.2. Header-only impl. |
| `allolib-wasm/include/al_WebControlGUI.hpp` | Modify | `registerParameterMeta` adds one line: `ParameterRegistry::global().add(&param)`. `notifyParameterAdded` stays for the eager push event but its body delegates to a registry-driven helper (no more reading from `sActiveInstance`). |
| `allolib-wasm/src/al_WebControlGUI.cpp` | Modify | C exports switch from `WebControlGUI::getActiveInstance()` to `ParameterRegistry::global()`. |
| `allolib-wasm/include/al_playground_compat.hpp` | Modify | `WebPresetHandler::registerParameter` body changes: drop `mirrorToActiveGui`, add `ParameterRegistry::global().add(&p)`. Add `setCurrentPresetMap` override (§2.3). The `#define PresetHandler WebPresetHandler` shadow stays. |
| `allolib-wasm/include/al_WebParameterServer.hpp` | **NEW** | `WebParameterServer` subclass per §6.2a. `using ParameterServer = WebParameterServer;` shadow at header end. |
| `allolib-wasm/include/al_WebApp.hpp` | Modify | `parameterServer()` returns `WebParameterServer&` instead of `ParameterServer&`. |
| `allolib-wasm/src/al_WebApp.cpp` | Modify | Delete the parameter-server mirror loop in `WebApp::start`. Add `ParameterRegistry::global().clear()` in `WebApp::~WebApp`. Keep `ensurePresetIDBFSMounted` as a defensive fallback (will run after preRun has already done the work; idempotent). |
| `frontend/src/services/runtime.ts` | Modify | `Module.preRun` returns a Promise that resolves on `FS.syncfs(true)` callback. Hooks `window.allolib.onParameterAdded` and a new `version()` poll. |
| `frontend/src/utils/parameter-system.ts` | Modify | Add version-counter polling alongside the existing roster read. |
| `frontend/src/components/ParameterPanel.vue` (or analog) | Modify | Subscribe to the Pinia store mutation driven by `onParameterAdded` push + version poll. |
| `allolib-wasm/include/al_compat.hpp` and other compat headers | Unchanged | No registry knowledge needed. |
| Upstream `al/ui/al_PresetHandler.{hpp,cpp}` | **Unchanged** | Constraint: no upstream patches. |
| Upstream `al/ui/al_ParameterServer.{hpp,cpp}` | **Unchanged** | Same. |

---

## 10. Risk register

What could go wrong that the current patchwork *does* handle:

**R1: An upstream parameter type we don't know about.**
Current ParameterServer mirror enumerates known accessors
(`stringParameters / vec3Parameters / poseParameters / …`). If upstream
adds a new type, the current mirror silently drops it. The redesigned
WebParameterServer subclass hides each `registerParameter` overload by
name, so a new overload bypasses our hook the same way. **Mitigation:** add a
compile-time check (`static_assert` on the count of upstream's
`registerParameter` overloads) that fails the build if upstream adds a
new one we haven't shadowed. Living-with-it cost: one CI break each
upstream rev that adds a parameter type.

**R2: preRun Promise and existing static-init race.**
If a future Emscripten upgrade changes the order of preRun resolution and
static initializers, the C++ `MyApp` ctor could run before preRun finishes.
**Mitigation:** the §2.3 fallback (`setCurrentPresetMap` override + stub
write) catches this. Even if preRun fires late, the override still
neutralizes the abort.

**R3: User code that holds `ParameterMeta*` across module reloads.**
`ParameterRegistry::clear()` in `WebApp::~WebApp` invalidates pointers.
User code that *somehow* held a `ParameterMeta*` past WebApp dtor would
dangle. In practice no example does this — `Parameter` objects are App
members and die with the App — but document it as a contract.

**R4: Two `WebApp` instances simultaneously.**
The registry is global; if a user constructs two `WebApp`s (rare, mostly
test harnesses) and one destructs first, it `clear()`s the registry under
the other. **Mitigation:** the registry tracks an "owner WebApp*" set; only
the *last* WebApp to destruct triggers clear. Or just document that two
`WebApp`s aren't supported (which has always been the case in WASM).

**R5: Vue panel not subscribing to push before first add fires.**
The version-counter polling fallback (§3.1) reconciles this. If the panel
isn't even mounted yet, the next `requestAnimationFrame` after mount sees
the version delta and re-reads. Cost: at most one rAF of latency.

**R6: `EM_ASM` push event triggers reentrancy into C++ via setParameterValue.**
JS handlers shouldn't synchronously round-trip back into C++ during an
add event, but if they do, the C++-side write to a `ParameterMeta` is
already serialized (single thread). Registry write is *not* reentrant —
the `add` finishes its push to `mParameters` *before* firing `onChange`.
Document as a contract; assert in debug builds with a per-thread reentrancy
counter.

**R7: `setCurrentPresetMap` override interferes with native parity.**
The override skips the upstream auto-create branch only on web (it's a
member of `WebPresetHandler`, not a patch on `PresetHandler`). The native
parity test uses upstream `PresetHandler` directly and sees the original
auto-create path. No divergence.

**R8: `version()` overflow.**
`uint64_t` rolls over after ~10^11 years at 100 adds/sec. Not a risk.
Listed for completeness.

**R9: Registry tied to a specific dynamic-library load order.**
Function-local-static lifetime means the singleton lives for the whole
WASM module's lifetime. Module reloads (new `createModule` invocation)
construct a fresh module, fresh registry — no persistence issue.

**R10: Future requirement: multi-app parameter sharing across iframes.**
Out of scope. Registry is per-module; cross-iframe sharing would require
postMessage bridging at the JS layer above. Design does not preclude it
but does not enable it either.

---

## 11. End of design

The unified pipeline replaces three mirroring registries with one shared
registry that every native idiom feeds as a side-effect. The Vue panel
reads only the registry; no "active GUI", no "active handler", no
mirror loops. `/presets` readiness is owned by a single moment
(`Module.preRun` Promise resolution) with one defensive C++ fallback.
PresetHandler keeps subclass + macro shadow for behavioral hooks; the
mirror logic deletes. ParameterServer adds a parallel subclass +
shadow. Native parity is preserved because every user-facing API call
resolves to upstream code with at most one extra registry-add line in
the override path.


---

# 3. Migration

# PIPELINE_MIGRATION.md — Parameter Pipeline Unification

**Target version range:** v0.7.0 — v0.7.7
**Author:** migration-plan agent (2026-04-29)
**Companion design doc:** `PIPELINE_DESIGN.md` (in flight)
**Status:** Draft — do not start phase 1 until Section 7 (Open Questions) is resolved.

---

## Why this exists

Since v0.4.5 the parameter pipeline has been patched ten times. Every patch fixed one symptom and exposed another, because three independent registration paths (`gui << p`, `mPresets << p`, `parameterServer() << p`) each produced their own list, and the C exports read whichever list `WebControlGUI::sActiveInstance` happened to point at. The redesign in `PIPELINE_DESIGN.md` collapses those three lists into one `al::ParameterRegistry` singleton; this document defines how we get from the current patchwork to that endpoint without burning another ten pushes.

The hard constraints from the user are explicit: each commit on `dev` must be independently testable, must keep `M5_2_preset_unify.cpp` compiling against vanilla AlloLib, and must never ship a half-broken state. Version bumps stay in lockstep across `frontend/package.json`, the `README.md` badge, and `ALLOLIB_WASM_LIB_VERSION` in `al_WebApp.cpp`.

---

## 1. Phased migration commits

Seven commits, each lands on `dev`, each is squash-merged to `main` only after the validation in its row passes. Phase numbers map 1:1 to v0.7.x patch versions.

### Phase 1 — v0.7.0 — `feat(registry): introduce ParameterRegistry singleton, no callers yet`

- **Surface:** new file `allolib-wasm/include/al_parameter_registry.hpp` (~80 LOC). No edits to `al_WebControlGUI.hpp`, `al_WebApp.cpp`, or any preset code. Add `#include` of the new header from `al_playground_compat.hpp` so it transitively reaches every example. `frontend/package.json` 0.6.3 → 0.7.0; matching bump in `al_WebApp.cpp` and `README.md`.
- **Behavior change:** none user-visible. Internal: a `ParameterRegistry::global()` exists and is callable, returns an empty registry, and is exercised by the unit test in §2.
- **Native parity check:** `M5_2_preset_unify.cpp` builds against vanilla AlloLib unchanged — the new header is web-only and never reached from native builds (it lives under `allolib-wasm/include/`). The existing run.sh smoke output stays byte-identical.
- **Web validation:** open Studio Online, run any existing example with `gui << p`. Confirm Params panel still populates exactly as it did at v0.6.3 (no regression). Confirm no console warning about the new header.
- **Risk:** introducing a singleton in a header-only include path that gets pulled into every TU. Risk is multiple-definition link errors. Mitigation: declare the singleton accessor `inline` and keep the storage as a function-local static (Meyer's singleton). The `_registry_test.cpp` unit test catches this on the first compile.

### Phase 2 — v0.7.1 — `refactor(gui): WebControlGUI::registerParameterMeta routes to registry`

- **Surface:** `allolib-wasm/include/al_WebControlGUI.hpp` (lines 90–127, ~15 LOC delta). Each `add()` overload still updates the GUI's local `mParams` for backward compatibility but **also** calls `ParameterRegistry::global().add(&param)`. C exports in `allolib-wasm/src/al_WebControlGUI.cpp` switch from `sActiveInstance->mParams` reads to `ParameterRegistry::global().items()` reads. `sActiveInstance` itself is left in place for now (Phase 7 removes it).
- **Behavior change:** user-observable bug fixed — when an example creates a `WebControlGUI` and immediately destroys+recreates one (rare, but happens in S3 examples that hot-rebuild a GUI on preset switch), parameters from the old GUI no longer linger in the Vue panel because the registry is the single source of truth and is rebuilt deterministically on `WebApp::destroy()` (see Section 7 question 3).
- **Native parity check:** `M5_2_preset_unify.cpp` is unaffected (uses bare `PresetHandler`, never touches `WebControlGUI`). Re-run run.sh and diff stdout.
- **Web validation:** load `studio-env-basic`, confirm 3 parameters appear. Reload with no code change, confirm still 3 (no doubling). Edit code to add a fourth `gui << newParam`, recompile, confirm exactly 4 in the panel.
- **Risk:** the C exports may briefly read from the registry while another thread is mid-`add()`. WASM is single-threaded so the data race is theoretical, but the AudioWorklet runs in a separate context. Mitigation: registry storage is `std::vector<ParameterMeta*>`, never resized during audio callbacks because all `add()` happens during `onInit` / `onCreate`.

### Phase 3 — v0.7.2 — `refactor(presets): WebPresetHandler::operator<< feeds registry directly`

- **Surface:** `allolib-wasm/include/al_WebPresetHandler.hpp` (currently does an explicit `WebControlGUI::sActiveInstance->add(p)` mirror in its `operator<<`; replace with `ParameterRegistry::global().add(&p)`). ~10 LOC delta. Remove the now-dead mirror logic.
- **Behavior change:** user-observable bug fixed — examples that do `mPresets << amp << freq` but never construct a `WebControlGUI` (common in headless/audio-only examples in `mat-synthesis/`) now show their parameters in the Params panel. Previously they appeared only if the example also wrote `gui << amp`, which was a footgun.
- **Native parity check:** `M5_2_preset_unify.cpp` still uses upstream `PresetHandler::operator<<` from `al/ui/al_PresetHandler.hpp` — that file is untouched. New native test `M5_3_registration_paths.cpp` (see §3) adds coverage for the all-three-paths case but is independent of native parity (it confirms registry-side behavior, not native-side).
- **Web validation:** in Studio Online, paste a 10-line example with `WebPresetHandler mPresets; mPresets << gain;` and **no** `gui` at all. Confirm `gain` appears in Params panel. This is the first commit where this works.
- **Risk:** the dropped mirror was the load-bearing line on three existing examples (`pg-add-syn`, `studio-timeline-basic`, `mat-mixing-stems`). Mitigation: those examples already declare a `gui` and use `gui <<`, so the registry path covers them. Verify by running `comprehensive-functional-tests.spec.ts` filtered to those three IDs before merging.

### Phase 4 — v0.7.3 — `refactor(server): ParameterServer hook feeds registry, drop WebApp::start mirror loop`

- **Surface:** `allolib-wasm/src/al_WebApp.cpp:296–315` — the `if (mParameterServer) { for (auto* p : ...->parameters()) gui->registerParameterMeta(*p); }` block is removed. Replace by hooking `ParameterServer::operator<<` (via a `ParameterServerHook.hpp` shim that defines a free-function `operator<<(ParameterServer&, ParameterMeta&)` that wraps upstream's and calls registry.add). ~25 LOC delta net (hook is ~30 LOC, removed mirror is ~15 LOC).
- **Behavior change:** user-observable bug fixed — `parameterServer() << p` registrations performed **after** `app.start()` (e.g. inside `onAnimate` for a hot-reload-triggered preset) now appear in the Params panel without requiring an `app.restart()`. Previously the mirror loop only ran once at start.
- **Native parity check:** `M5_2_preset_unify.cpp` does not use `parameterServer()`. New native test `M5_4_three_path_parity.cpp` (§3) registers via all three paths and confirms native still builds (the registry header is web-only and gated by `#ifdef __EMSCRIPTEN__`; native builds skip it).
- **Web validation:** OSC-relay example (`M5_osc_relay`) — register a parameter via `parameterServer() << p` 5 seconds into onAnimate via a one-shot. Confirm Params panel grows from 0 to 1 within one polling tick.
- **Risk:** ParameterServer's internal `mParameters` may be modified concurrently by an OSC receive thread. WASM has no real threads but desktop-mode (Electron) does. Mitigation: the hook only adds during the synchronous `operator<<` call site, never during OSC receive — registry is never touched from the OSC dispatcher.

### Phase 5 — v0.7.4 — `fix(presets): /presets readiness via Module.preRun closure`

- **Surface:** `allolib-wasm/src/al_WebApp.cpp` — replace the current synchronous `EM_ASM` `IDBFS.syncfs` call with the design doc's chosen option. Per the spec, this is `Module.preRun` with closure-captured Module, falling back to ASYNCIFY-blocking syncfs only if preRun is unavailable. `frontend/src/services/runtime.ts` adds a one-line readiness gate (`await Module.fsReady`) before the first `_main()` call. Also: `default.presetMap` is pre-created in IDBFS as a 0-byte stub during preRun, so `PresetHandler`'s auto-create path for the default map never races against the user's first `storePreset` call. ~40 LOC delta across two files.
- **Behavior change:** user-observable bug fixed — the long-standing "first compile shows empty preset slots, second compile shows them populated" bug is gone. /presets is readable and writable before `WebApp::WebApp()` returns.
- **Native parity check:** `M5_2_preset_unify.cpp` and `M5_5_custom_preset_map.cpp` (new, §3) both work natively because `PresetHandler` on native uses real filesystem; the IDBFS gate is web-only (`#ifdef __EMSCRIPTEN__`).
- **Web validation:** fresh browser tab (incognito), run `studio-timeline-basic` for the first time ever. Confirm the four built-in presets ("intro", "build", "drop", "outro") show up in the panel on first compile, not second.
- **Risk:** `Module.preRun` runs asynchronously relative to Vue's runtime mount. The gate in `runtime.ts` must `await` it; if the gate is skipped or the Module shape changes (Emscripten 3.1.x has shifted the property name in past releases), `_main()` runs against an unmounted IDBFS. Mitigation: a console warning fires if `Module.fsReady` is undefined when first checked, with a fallback to a 250 ms timeout.

### Phase 6 — v0.7.5 — `chore(presets): drop PresetHandler macro shadow if unused, else document why it stays`

- **Surface:** `allolib-wasm/include/al_playground_compat.hpp` — there is currently a `#define PresetHandler WebPresetHandler` macro shadow that rewrites bare `PresetHandler` declarations to `WebPresetHandler`. With phases 1–5 done, `WebPresetHandler::operator<<` and `PresetHandler::operator<<` (on web, via the registry hook) produce identical Vue-panel results. The macro becomes redundant. Audit: if any example still relies on the macro, document why in a comment block; if none do, remove the macro. ~5 LOC delta.
- **Behavior change:** none user-visible. Internal: removes a macro that has been a frequent source of "why is my error message complaining about `WebPresetHandler` when I wrote `PresetHandler`" confusion.
- **Native parity check:** `M5_2_preset_unify.cpp` uses bare `PresetHandler` and **must** continue to compile natively — it does, because the macro is web-only (defined inside `al_playground_compat.hpp` which native builds never include).
- **Web validation:** grep all 155 existing examples for `PresetHandler` (case-sensitive, word-boundary). For any matches, confirm they compile with the macro removed.
- **Risk:** an example written by a student during MAT200B that we don't know about may break. Mitigation: this is a `dev`-only commit; let it sit on `dev` for 48 hours before merging, ask in the course Slack for breakage reports. If the macro must stay, this commit becomes "document the macro" — same commit number, scope reduced.

### Phase 7 — v0.7.6 — `chore(cleanup): remove sActiveInstance, dead-code mirror loops, update inline docs`

- **Surface:** `allolib-wasm/include/al_WebControlGUI.hpp:446–467` — delete `sActiveInstance` and its registration helpers. `allolib-wasm/src/al_WebApp.cpp` — delete leftover comments referencing the parameter mirror loop (the code is gone after phase 4, but the explanatory comments remain). Update inline docstrings on `registerParameterMeta` to point to `ParameterRegistry::global()` as the source of truth. ~50 LOC delta net (mostly deletions).
- **Behavior change:** none user-visible. Internal: the codebase no longer mentions `sActiveInstance`. A reader can trace any parameter from registration to Vue panel through the registry alone.
- **Native parity check:** `M5_2_preset_unify.cpp` is web-irrelevant; native compile unchanged.
- **Web validation:** full E2E suite — `comprehensive-functional-tests.spec.ts` (155 × 2 backends), `parameter-pipeline.spec.ts` (new in §2). Confirm 100% pass rate matching v0.6.3.
- **Risk:** deleting `sActiveInstance` may break a third-party example or a helper in `_studio_shared/` that we missed. Mitigation: grep for `sActiveInstance` across the entire repo before merging; expected count after this commit is zero.

### Phase 8 — v0.7.7 — `docs: parameter pipeline overview in CLAUDE.md, PROJECT.md, glossary, MAT200B plan`

- **Surface:** `CLAUDE.md`, `PROJECT.md`, `frontend/src/data/glossary.ts`, `MAT200B_EXAMPLES_PLAN.md`. Documentation only — no code. ~150 LOC delta.
- **Behavior change:** none. See Section 5 for what each doc gets.
- **Native parity check:** N/A (docs).
- **Web validation:** spell-check, link-check, render the glossary entries in the running app and confirm the new "registration paths" section reads correctly.
- **Risk:** none material.

---

## 2. Test strategy

Each phase ships with: a C++ snippet that exercises its registration path, a Playwright spec block, and (where applicable) a registry unit test.

### 2.1 Registry unit test (lands with phase 1)

**File:** `allolib-wasm/include/_studio_shared/_registry_test.cpp`

```cpp
// Tiny unit test for ParameterRegistry. Builds against vanilla AlloLib too —
// the registry header is the only web-specific include. Run via:
//   ./run.sh _studio_shared/_registry_test.cpp
//
// Expected output:
//   [registry] count after add: 1
//   [registry] has(p) after add: 1
//   [registry] count after re-add (dedup): 1
//   [registry] count after clear: 0
#include <iostream>
#include "al/ui/al_Parameter.hpp"
#include "al_parameter_registry.hpp"
using namespace al;
int main() {
  Parameter p{"amp", "", 0.5f, 0.0f, 1.0f};
  auto& reg = ParameterRegistry::global();
  reg.add(&p);
  std::cout << "[registry] count after add: " << reg.count() << std::endl;
  std::cout << "[registry] has(p) after add: " << reg.has(&p) << std::endl;
  reg.add(&p);
  std::cout << "[registry] count after re-add (dedup): " << reg.count() << std::endl;
  reg.clear();
  std::cout << "[registry] count after clear: " << reg.count() << std::endl;
  return 0;
}
```

### 2.2 Per-phase C++ snippets and expectations

Phase 2 — `WebControlGUI` path:

```cpp
WebControlGUI gui;
Parameter amp{"amp", "", 0.5f, 0.0f, 1.0f};
gui << amp;
// Expected Studio log: [registry] +amp (1 total)
// Expected Params panel: one slider labeled "amp", range 0.0–1.0, value 0.5.
```

Phase 3 — `WebPresetHandler` path with no `gui`:

```cpp
WebPresetHandler mPresets;
Parameter freq{"freq", "", 220.0f, 20.0f, 5000.0f};
mPresets << freq;
// Expected Studio log: [registry] +freq (1 total)
// Expected Params panel: one slider labeled "freq", range 20.0–5000.0.
```

Phase 4 — `parameterServer()` path, post-start:

```cpp
void onAnimate(double dt) override {
  static bool once = false;
  if (!once && mTime > 5.0) { parameterServer() << gain; once = true; }
}
// Expected Studio log at t=5s: [registry] +gain (N+1 total)
// Expected Params panel: gain appears at t=5s without recompile.
```

Phase 5 — /presets readiness:

```cpp
WebPresetHandler mPresets;  // /presets must exist already
mPresets.storePreset(0, "first", true);
// Expected Studio log on FIRST compile of fresh tab:
//   [WebApp] /presets ready, 0 existing files
//   [WebPresetHandler] storePreset("first") OK
// (Pre-phase-5: "ENOENT /presets" on first compile, OK on second.)
```

### 2.3 Playwright spec — `tests/e2e/parameter-pipeline.spec.ts`

New file, lands with phase 2 and grows incrementally each phase. Outline of test cases (one `test()` block per phase):

- **`gui << p populates panel within 2s of compile`** (phase 2): paste a 12-line snippet using `gui << amp; gui << freq;`, click run, wait for canvas, assert `[data-testid="params-panel"] [data-testid^="param-row-"]` count is 2 within 2000 ms.
- **`mPresets << p with no gui populates panel`** (phase 3): paste a snippet using only `WebPresetHandler` and `mPresets << gain`, assert exactly 1 param row.
- **`parameterServer() << p post-start grows panel`** (phase 4): paste the onAnimate-delayed snippet, wait 6 s, assert param-row count grows from 1 to 2.
- **`/presets ready on first compile`** (phase 5): incognito context, run a snippet that calls `storePreset` in `onInit`, assert no `ENOENT` in `[data-testid="console-output"]` and the preset slot button shows a populated state on first run.
- **`re-running example does not show ghost params`** (phase 7): run example A (3 params), stop, run example B (1 param), assert exactly 1 param row, not 4. (Validates the registry-clear-on-destroy decision from Section 7.)

Total Playwright tests added: 5.

---

## 3. Native test additions

Three new files under `AlloLib Native Test Files/`. Each is run with `./run.sh <file>` against vanilla AlloLib; the actual stdout is captured and pasted into the file as `// Expected output (verified 2026-04-29)`. These tests validate the **API surface** the migration depends on; they don't validate registry behavior (which is web-only).

### 3.1 `M5_3_registration_paths.cpp`

Registers one parameter via each of the three native upstream paths, confirms each call site compiles and the parameter participates in the upstream `ParameterServer::parameters()` list.

- **Path:** `AlloLib Native Test Files/M5_3_registration_paths.cpp`.
- **Outline:** declare `ControlGUI gui; PresetHandler mPresets; ParameterServer paramServer{"127.0.0.1", 9010};`. Three parameters: `viaGui`, `viaPresets`, `viaServer`. Wire them: `gui << viaGui; mPresets << viaPresets; paramServer << viaServer;`. In `onInit`, print `paramServer.parameters().size()`, then `mPresets.parameters().size()`. `quit()` after onInit.
- **Expected stdout:** `[M5.3] paramServer params: 1`, `[M5.3] presetHandler params: 1`. (ControlGUI does not expose a public counter upstream — confirms by `gui.numParameters()` if available, else just by successful compile.)

### 3.2 `M5_4_custom_preset_map.cpp`

Reproduces the v0.6.3 `setCurrentPresetMap` patch limitation: that fix only covered the default map. This test exercises a **named** map and confirms upstream behavior matches what we expect WebPresetHandler to deliver.

- **Path:** `AlloLib Native Test Files/M5_4_custom_preset_map.cpp`.
- **Outline:** `PresetHandler ph{"M5_4_root", true}; ph.setCurrentPresetMap("custom");` then `ph << amp; ph.storePreset(0, "x"); ph.recallPreset(0);` print recalled name.
- **Expected stdout:** `[M5.4] currentPresetMap: custom`, `[M5.4] storePreset OK in M5_4_root/custom.presetMap`, `[M5.4] recallPreset(0): x`.

### 3.3 `M5_5_web_preset_handler_custom_root.cpp`

Validates that a `WebPresetHandler` (or upstream `PresetHandler`, since the test runs natively) with a non-default `rootDirectory` round-trips correctly. Today's `/presets` readiness fix in phase 5 specifically pre-creates the default `default.presetMap`; confirm a custom root doesn't collide.

- **Path:** `AlloLib Native Test Files/M5_5_web_preset_handler_custom_root.cpp`.
- **Outline:** `PresetHandler ph{"M5_5_custom_root", true};` (no other args), write a preset, recall, compare values.
- **Expected stdout:** `[M5.5] root: M5_5_custom_root`, `[M5.5] storePreset OK`, `[M5.5] recallPreset roundtrip OK (amp=0.7)`.

After running each on the native AlloLib repo, paste the captured stdout into the file as a comment block headed `// Expected output (verified 2026-04-29)`.

---

## 4. Rollback plan

Every phase is a single squash commit on `main`. A bad commit is reverted with `git revert <sha>` and pushed; this works regardless of how many later commits have landed because each phase is independently functional.

Specifically:

- **Phase 1 revert** restores the codebase to v0.6.3 exactly. No callers, no risk.
- **Phase 2 revert** restores the C exports to read `sActiveInstance->mParams`. The registry header stays (harmless empty singleton). No data loss.
- **Phase 3 revert** restores the explicit `WebControlGUI` mirror in `WebPresetHandler::operator<<`. Examples using only `mPresets <<` (with no `gui`) lose their Params panel rows again — that is the v0.6.3 baseline, which is acceptable until a fixed phase 3 lands.
- **Phase 4 revert** restores the start-time mirror loop. `parameterServer() << p` again becomes a register-once-at-start operation. Acceptable.
- **Phase 5 revert** is the most consequential — restores the EM_ASM IDBFS approach. First-compile preset visibility regresses. If phase 5 must be reverted, the same revert must also bump the version backward (0.7.4 → 0.7.4-rollback) and `frontend/package.json` and the WASM lib version follow.
- **Phase 6, 7, 8 reverts** are pure code/doc reversions, no user data implications.

The user can `git log --oneline main` and identify the exact phase by commit subject (each starts with the phase number). No mid-flight broken states are possible because the validation row in §1 must pass before merge.

---

## 5. Documentation updates

Lands as the final phase 8 commit. Touches four files.

### `frontend/src/data/glossary.ts`

The `PresetHandler` entry (around line 3201) currently says "WebPresetHandler — same API, plus auto-mirror to the Studio Params panel". Replace "auto-mirror" with a one-line mention of the registry: *"Any of `gui << p`, `mPresets << p`, or `parameterServer() << p` registers `p` with the global parameter registry, which the Studio Params panel reads. Pick the path that matches the parameter's purpose; all three work."* Add cross-links from the `Parameter`, `ControlGUI`, and `ParameterServer` entries to the new "Parameter Registry" entry. New entry term: `Parameter Registry`, definition ~80 words, no code example needed (it is internal).

### `MAT200B_EXAMPLES_PLAN.md` § 0.5 (cross-cutting helpers)

Audit each helper in `allolib-wasm/include/_studio_shared/`. Three of nine touch parameters: `param_graph.hpp`, `automation.hpp`, `pickable.hpp`. Each currently uses `gui << p` patterns inside its construct method. Update §0.5 to state explicitly that helpers must use one of the three documented registration paths and **must not** call `ParameterRegistry::global().add` directly — keeps the helper portable to native AlloLib via the macro shadow.

### `CLAUDE.md`

Add a new short section after "Important Patterns" titled **Parameter Pipeline Overview**: one paragraph explaining that `ParameterRegistry::global()` is the single source of truth for what shows up in the Vue Params panel, and that `gui <<`, `mPresets <<`, and `parameterServer() <<` are the three documented public APIs. State that direct registry access is **not** part of the public surface — examples and helpers must use the three operator paths.

### `PROJECT.md`

Same paragraph as `CLAUDE.md`, plus a sentence in the Architecture Overview clarifying that the Pinia panel store polls (or subscribes to — see Section 7) the registry rather than the GUI's local list. Update the test coverage summary table to add the `parameter-pipeline.spec.ts` row.

---

## 6. Cross-cutting concerns

Things that span the migration but aren't pinned to a single phase.

### 6.1 No-stubs policy (per `feedback_no_stubs.md`)

Every helper in `_studio_shared/` is treated as a first-class example contributor and must register all its parameters via the panel. Audit results (one-line each):

- `param_graph.hpp` — registers via `gui << p`. **OK** as-is.
- `automation.hpp` — registers via `gui << p`. **OK** as-is.
- `pickable.hpp` — currently does **not** register the pick-state parameter; this was an oversight. Add a `gui << mIsPicked` line in phase 3 timeframe (incidental fix).
- `audio_features.hpp`, `draw_canvas.hpp`, `pixel_audio_bridge.hpp`, `post_fx.hpp`, `pv_resynth.hpp`, `web_convolver.hpp` — no parameter-touching code. **Skip.**

### 6.2 Existing examples that use `gui << p` (must continue working unchanged)

Spot-check inventory (not exhaustive, but covers the highest-traffic IDs):

- `studio-env-basic`, `studio-env-night`, `studio-env-storm` (3 examples in studio-environments)
- `pg-sine-env`, `pg-add-syn`, `pg-fm-bell`, `pg-saw-vco`, `pg-pluck-string` (5 in playground-synthesis)
- `studio-timeline-basic`, `studio-timeline-keyframes` (2 in studio-timeline)
- 10+ MAT200B examples that already shipped in v0.6.0

All thirty-something examples must compile and render identically through phases 2–7. The `comprehensive-functional-tests.spec.ts` Playwright suite (which exercises all 155 examples × 2 backends) is the gate; it must pass at 100% after every phase merge. If any single example breaks, that phase does not merge — it gets reworked on `dev`.

### 6.3 MAT200B foundation (v0.6.0) parameter-touching audit

Of the nine v0.6.0 helpers, three touch parameters (see §6.1). None of them do anything exotic — all use bare `gui << p`. The migration leaves their behavior identical at every phase boundary, so the v0.6.0 examples that depend on them continue to work without modification.

---

## 7. Open questions to answer before phase 1 starts

These three decisions block phase 1. The user must answer in writing (in `PIPELINE_DESIGN.md`'s Q&A section) before any commit on `dev` lands.

### 7.1 Is the registry singleton OK across multiple `WebApp` instances?

Studio Online has never run two `WebApp` instances simultaneously. The redesign assumes one. If a future feature wants two (e.g. a comparison view), the singleton has to become a per-WebApp registry, which is a larger refactor. **Recommended answer:** singleton is fine; revisit only when multi-app becomes a real requirement.

### 7.2 Polling vs callback for the Vue panel?

The Vue panel currently polls the WASM module every animation frame for the parameter list (cheap because the list is short). The redesign could instead emit a Module postMessage on every `add()`/`clear()` and have Vue subscribe. **Recommended answer:** keep polling for phase 1–7. The cost is ~5 µs per frame on a list of ten params. Switching to callbacks introduces a serialization-boundary failure mode (what if the postMessage queue is full?) that polling cannot exhibit. Reconsider only if the panel becomes a hot path.

### 7.3 Should the registry persist across `WebApp::destroy()` or be cleared?

This is the one with a user-facing effect. If the registry persists, re-running an example shows ghost parameters from the previous run until a hard page reload. If it clears, every re-run starts from zero. **Recommended answer:** clear on `WebApp::destroy()`. The phase 7 Playwright test explicitly asserts this. Persisting would be confusing UX (users have repeatedly reported "phantom params" in the v0.4.5 era as a bug, not a feature).

---

## End

This plan is internally consistent: each phase is a real, testable improvement; native parity is verified at every step; rollback is one revert per phase. Total commits 7 (or 8 counting the doc-only finale), total native test files 3 new (M5.3–M5.5) plus the unchanged M5.2, total Playwright tests 5 new in `parameter-pipeline.spec.ts`. The biggest schedule risk is phase 5 — IDBFS readiness has been the root cause of more than half of the post-v0.4.5 patches, and the design doc's resolution there is the load-bearing assumption for everything downstream.
