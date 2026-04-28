# Timeline Redesign Plan

Consolidates the four research reports:
- `TIMELINE_AUDIT_INVENTORY.md` — what exists, what works, what's dead
- `TIMELINE_RESEARCH_INDUSTRY.md` — patterns from AE / Theatre.js / Unity Timeline / Unreal Sequencer / Lottie / XState
- `TIMELINE_STYLE_AND_TRIGGERS.md` — visual language + trigger-system patterns
- `TIMELINE_PARAM_INTEGRATION.md` — how the new timeline plugs into the existing parameter system

---

## 1. Vision

Replace the multi-track, four-category timeline with a **one-lane-per-parameter** design where each lane is a horizontal strip bound to a single animatable target (a `Parameter`, `SceneObject` property, env property, or system slot like `cameraPose`). Lanes stack as the user adds them.

A lane carries an ordered sequence of **segments**. Each segment is one of:

- `CurveSegment` — keyframes interpolate the bound parameter inside a time window (the linear animation case).
- `TriggerSegment` — when the playhead enters this window AND the segment's `guard` evaluates true, fire `actions` (the non-linear / event-driven case).
- `ClipSegment` — read-only overlay of a sequencer clip, lets the user see audio events on the same playhead. No editing here; clips remain owned by `sequencer.ts`.
- `HoldSegment` — pin the bound parameter at a fixed value across a window (no per-frame writes).

This gives the user "one lane = one parameter, one playhead, two animation styles that can coexist on the same lane at different times." The user's stated preference was *whole-lane* mode toggle; the research recommendation is *per-segment*. See § 7 — pick the trade-off you want.

---

## 2. What stays / what goes

### KEEP (proven, well-shaped)

| Component | Why keep |
|---|---|
| `stores/objects.ts` — `addKeyframe / getValueAtTime / keyframeCurves` | Generic, working, used by RAF loop today |
| `stores/environment.ts` — same shape | Same pattern; methods just need to be *called* from the new RAF |
| `stores/events.ts` | Has the data, missing `addKeyframe/removeKeyframe/getEventsAtTime` integration |
| `composables/useKeyframes.ts` (`applyEasing` — 9 easings + Bezier) | Single source of truth for interpolation |
| `services/objectManager.ts:556` — `interpolateAllObjects` RAF | Already pushes object props into WASM each frame |
| `stores/sequencer.ts` — owns the playhead, BPM, clip triggering | Already authoritative; new timeline reads `currentTime` from it |
| `services/runtime.ts:54-57, 817-843` — `_al_seq_trigger_on/off/set_param` | Sequencer's voice bridge; out of scope for the redesign |
| `components/timeline/TransportBar.vue` | Visual is fine; just stops being multi-track header |
| `components/timeline/TimeRuler.vue`, `TrackContainer.vue`, `CurveEditor.vue` | Reusable lane chrome |
| `parameter-system.ts` — `Parameter`, `subscribe`, `setByIndex/setPose/setParameterValue` | The animation target surface |
| `components/inputs/Vec3Input.vue`, `ColorPicker.vue` | Inspector inputs for keyframe values |
| `composables/useResizableDrag.ts` | Lane height drag |

### REMOVE (~2700 LOC of dead/redundant code)

- `BezierCurveEditor.vue` (796 LOC) — superseded by `CurveEditor.vue`, no importers
- `tracks/AudioTrackLane.vue` (286) — replaced by embedded `ClipTimeline`
- `tracks/KeyframeLane.vue` (602) — duplicates the per-track-type lanes; carries its own selection state that shortcuts can't reach
- `tracks/LifecycleBar.vue` (251) — `ObjectTrackLane` draws its own spawn/destroy markers
- The 4-category orchestration in `timeline.ts:303-541` (selectKeyframe / pasteAtTime / nudgeSelection / selectAllInCategory) — keep the data, drop the per-category branching
- `services/timelineClipboard.ts:12` — broken `CameraKeyframe` import (type doesn't exist)

### FIX (concrete bugs found)

- `useTimelineShortcuts.ts:107-110` — Ctrl-A is a stub
- `timeline.ts:554, 566` — Events paste/nudge silently skipped (TODOs)
- `parameter-system.ts:779` — `setParameterValue('synth', ...)` reduces multi-component to `value[0]`
- `ParameterPanel.vue:243-245` — synth params explicitly excluded from keyframing; needs to allow it
- `WasmModule` typing missing `_al_webgui_set_parameter_vec3/vec4/pose` bindings (exports exist, JS can't reach them)
- `objectManager.ts:556` is the only RAF that animates anything — `environmentStore.getValueAtTime` and `eventsStore.getEventsAtTime` are **never called** during playback

---

## 3. Data model

```ts
// One root object; replaces the 4-category orchestration in timeline.ts
interface Timeline {
  lanes: Lane[];
  // Playhead, BPM, transport state continue to be sourced from sequencerStore.
  // Timeline never owns time; it consumes it.
}

interface Lane {
  id: string;
  binding: ParamBinding;     // what this lane animates
  height: number;            // px; useResizableDrag
  collapsed: boolean;
  segments: LaneSegment[];   // sorted by .time, non-overlapping (validated on insert)
  color?: string;            // overrides binding.source category color
}

// What the lane is wired to. Mirrors `Parameter.source` taxonomy from
// parameter-system.ts:38 so the panel and timeline share a vocabulary.
type ParamBinding =
  | { source: 'synth';       paramIndex: number }                     // WebControlGUI param
  | { source: 'object';      objectId: string;  property: string }    // SceneObject property
  | { source: 'environment'; property: string }                       // env property
  | { source: 'camera';      property: 'pos' | 'quat' | 'fov' }
  | { source: 'event';       channel: string };                       // pure-trigger lane

// Discriminated union — ONE segment type per slot. Segments do not overlap
// within a lane (engine enforces). Different segments on different lanes
// at the same time are fine.
type LaneSegment =
  | CurveSegment
  | TriggerSegment
  | ClipSegment
  | HoldSegment;

interface SegmentBase {
  id: string;
  start: number;             // seconds (timeline units)
  end:   number;             // seconds; equal to start for instant triggers
  label?: string;
}

interface CurveSegment extends SegmentBase {
  kind: 'curve';
  // Lottie-style keyframe shape: a single bit for animated-vs-static, bezier
  // handles as vectors. `s` is the stop value (scalar OR vector to match the
  // lane's binding type).
  keyframes: Array<{
    t: number;               // absolute time, seconds
    s: number | number[];    // stop value
    i?: [number, number];    // bezier in-handle (normalized t,v offsets)
    o?: [number, number];    // bezier out-handle
    h?: 0 | 1;               // hold (step) interpolation if 1
  }>;
  easing?: EasingId;         // default 'linear'; overridden per-keyframe via h flag
}

interface TriggerSegment extends SegmentBase {
  kind: 'trigger';
  // XState-flavoured event spec, flattened. No hierarchical states — the
  // segment IS the state; transitions cross segment boundaries.
  on:    TriggerSource;      // what fires this
  after?: number;            // OR after N seconds since segment.start
  guard?: GuardExpression;   // optional condition (param threshold, state)
  actions: TriggerAction[];  // what to do
  retroactive: boolean;      // fire when scrubbed past, or only realtime?
}

interface ClipSegment extends SegmentBase {
  kind: 'clip';
  clipInstanceId: string;    // read-only ref into sequencerStore
}

interface HoldSegment extends SegmentBase {
  kind: 'hold';
  value: number | number[];
}

// Trigger sources / actions — see § 6 for v1 catalog
type TriggerSource =
  | { type: 'midi-note';   note: number; channel?: number }
  | { type: 'midi-cc';     cc: number;   channel?: number; threshold?: number }
  | { type: 'osc';         address: string }
  | { type: 'audio-onset'; bandHz?: [number, number]; thresholdDb?: number }
  | { type: 'param-cross'; paramId: string; value: number; direction: 'up' | 'down' }
  | { type: 'time-marker'; markerId: string }
  | { type: 'key';         key: string }
  | { type: 'mouse';       button: 'left' | 'right' | 'middle'; on: 'down' | 'up' };

type TriggerAction =
  | { type: 'set-param';    paramId: string; value: number | number[] }
  | { type: 'recall-preset'; presetName: string; morphTime?: number }
  | { type: 'fire-clip';    clipId: string; trackId: string }
  | { type: 'goto-time';    seconds: number }
  | { type: 'set-state';    stateKey: string; value: any }
  | { type: 'run-snippet';  code: string };
```

Sources of inspiration: Theatre.js (`Sheet/SheetObject/Prop`) for the parameter-path-as-key idea, Lottie for the keyframe shape, XState (flattened) for the trigger shape, Unity Timeline diamonds + `retroactive` flag for the trigger visual model.

---

## 4. UI / UX

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Transport (existing)                          [BPM] [time]  │
├─────────────────────────────────────────────────────────────┤
│ TimeRuler (existing)                                        │
├──┬──────────────────────────────────────────────────────────┤
│  │ ♫ synth.gain         [+segment▾]  ◀━━━━╲___━━━╱━━━━━▶  │  ← lane (CurveSegment shown)
│  │ ◈ obj1.position.x    [+segment▾]  ◀━━━╳━━━━━━━━━━━━━━▶  │  ← lane (TriggerSegment as ◇)
│  │ ◐ env.fogDensity     [+segment▾]  ◀━━━━━━━━╲___━━━━━━▶  │
│  │ ⚡ event.tonic        [+segment▾]  ◀━━━╳━━━━━━━━━╳━━━━▶  │
│  │ + add lane                                               │
└──┴──────────────────────────────────────────────────────────┘
   ↓ inspector when a segment is selected
┌─────────────────────────────────────────────────────────────┐
│ CurveSegment "fade in"   [Curve | Trigger | Clip | Hold]    │
│   start: 1.20s   end: 4.50s                                 │
│   easing: ease-in-out                                       │
│   keyframes:  [Vec3 keyframe editor or scalar list]         │
└─────────────────────────────────────────────────────────────┘
```

### Style tokens (per `TIMELINE_STYLE_AND_TRIGGERS.md`)

- Outer: Tailwind `bg-editor-bg / border-editor-border / text-imgui-text`
- Lane header: `bg-imgui-header / hover:bg-imgui-header-hover / text-xs / category icon + name`
- Segment fills: per-category color from `stores/timeline.ts:41-71` — synth `#9F7AEA`, object `#63B3ED`, env `#68D391`, event `#F6AD55`
- Triggers render as diamonds at `start.x`, color from category
- Curves render as polylines connecting keyframe diamonds; selected segment outline = `imgui-accent`
- Mode toggle (per-segment): inspector tab pill matching `ConsolePanel.vue:62-95` pattern

### Adding a segment

User clicks `+segment▾` → small popover with four buttons (Curve / Trigger / Clip / Hold), keyboard shortcuts C / T / L / H. Default = Curve. Drops a 1-second segment at the playhead. If the segment-mode-per-lane decision (§ 7) goes the other way, the popover collapses to a single button using the lane's chosen mode.

### Inspector

Selecting a segment opens an inspector panel below the lanes (collapsible like Console / Analysis). Inspector contents are per-segment-kind:

- **Curve**: keyframe list (time + value), per-keyframe easing dropdown, "convert to Bezier" toggle, "use lane's default easing" toggle.
- **Trigger**: source picker (dropdown over the eight `TriggerSource` types, each with its own form), guard expression (one-line text expression, parsed; v1 = simple comparisons), actions list (add/remove/reorder).
- **Clip**: read-only — show the source clip's name, beat range, link to open it in `ClipTimeline`.
- **Hold**: just a value editor (uses the same input component the parameter panel uses for the bound type).

---

## 5. Runtime

### One unified RAF, replacing scattered loops

`services/timelineRuntime.ts` (new) owns a single `requestAnimationFrame` loop while playback is running:

```ts
function tickFrame(now: number) {
  const t = sequencerStore.playheadPosition;   // single source of truth
  for (const lane of timelineStore.lanes) {
    const seg = activeSegmentAt(lane, t);
    if (!seg) continue;
    switch (seg.kind) {
      case 'curve':   evalCurve(lane, seg, t); break;     // useKeyframes.applyEasing
      case 'hold':    writeBound(lane, seg.value); break;
      case 'trigger': maybeFire(lane, seg, t); break;     // edge-detect, retroactive flag
      case 'clip':    /* read-only — sequencer drives clips */ break;
    }
  }
}
```

`writeBound` dispatches based on `lane.binding.source`:
- `synth` → `parameterSystem.setByIndex` / `setPose` / etc.; **must** add the missing vec3/vec4/pose JS bindings to `WasmModule`
- `object` → `objectsStore` setter (already via `objectManager.interpolateAllObjects`)
- `environment` → new bridge that `objectManager` doesn't currently call (gap noted in audit)
- `camera` → `runtime.ts` cam helpers
- `event` → push into `eventsStore`

### Trigger firing

Edge-detect crossings: store last-frame `t` per lane; if `seg.start ≤ lastT < t` (entered) AND `guard` passes, evaluate `seg.on` against current frame's input snapshot, run `actions` once.

`retroactive: false` — only fires if `lastT` is within ~50ms of the boundary (i.e., realtime playback). Scrub-skipping the boundary doesn't trigger.
`retroactive: true` — fires whenever the playhead enters the segment by any means (scrub, transport jump, loop wrap).

### Param-cross trigger

Subscribe to `parameterSystem.subscribe` (line 196 in `ParameterPanel.vue` does it) inside the timeline runtime; on each notify, check every active `param-cross` source against the new value and direction.

### Audio-onset trigger

Reuse the analyser already created by `AnalysisPanel.vue` — exposes a `getEnergy(bandHz)` helper. Timeline runtime polls this each frame; trips the trigger when energy crosses `thresholdDb` upward.

### MIDI / OSC triggers

Subscribe to `WebMIDI` and `WebOSC` event streams that already exist in the runtime. Match `note`/`address` against active triggers per frame.

---

## 6. Trigger sources / actions catalog (v1)

**Sources** (8): `midi-note`, `midi-cc`, `osc`, `audio-onset`, `param-cross`, `time-marker`, `key`, `mouse`. Catalogued in `TIMELINE_STYLE_AND_TRIGGERS.md` Part B.

**Actions** (6): `set-param`, `recall-preset`, `fire-clip`, `goto-time`, `set-state`, `run-snippet`.

`recall-preset` integrates the M4 PresetHandler — actions can call `presetManager.getPresetNames()` to populate the dropdown, and the chosen preset's `morphTime` slot controls how the recall is staged.

---

## 7. Open decisions before implementation

1. **Per-segment vs per-lane mode toggle.** Industry research recommends per-segment (any segment kind can sit on any lane). Your stated preference was per-lane. Per-lane is simpler conceptually but forces "delete lane to switch modes." Per-segment supports a Curve segment + a Trigger segment on the *same* parameter at different times. Pick one.

2. **Synth multi-component interpolation path.** Two options:
   a. Per-frame JS-side tween via `useKeyframes.applyEasing`, push to WASM each frame via `setPose / setVec3 / setVec4`.
   b. Snapshot-and-let-PresetHandler.morph-do-it: the timeline emits keyframes as preset save+recall pairs, PresetHandler does the interpolation in C++.
   (a) is more flexible (per-property easing); (b) is what synth users already use. Probably (a) for the timeline runtime, but expose (b) as one of the trigger actions.

3. **Vec/Pose write surface.** The C++ `_al_webgui_set_parameter_vec3/vec4/pose` exports exist but `WasmModule` typing doesn't include them. Confirm: bind them on the JS side as part of this redesign, or in a smaller fix-it push first?

4. **EventsStore keyframe contract.** `events.ts` has `addKeyframe/removeKeyframe` TODO at `timeline.ts:554, 567`. The redesign needs an event store that tracks `TriggerSegment` instances; might warrant a rename from `events.ts` → `triggers.ts`. Or fold event-channels under `parameter-system` as a fifth source.

5. **Camera lane scope.** Camera is currently a parameter source AND has its own `CameraEvent` in events.ts. The redesign should pick one home — recommend keeping it under `parameter-system.cameraParameters` and dropping `CameraEvent`.

6. **Migration strategy for existing project files.** Old projects have multi-category timeline data. Either (a) write a migration that flattens old tracks into per-property lanes, or (b) declare a clean break — old timelines load empty.

---

## 8. Migration milestones

Each milestone is one push, validates against an upload of a representative example.

### T0 — Substrate fixes

- Bind `_al_webgui_set_parameter_vec3 / vec4 / pose` on `WasmModule` typing
- Fix `setParameterValue('synth', ...)` to dispatch by binding component count
- Allow `handleAddKeyframe` to accept synth params (drop the early-return)
- Add `addKeyframe / removeKeyframe / getValueAtTime` to `eventsStore`
- Wire `environmentStore.getValueAtTime` into `objectManager.interpolateAllObjects` (current omission)

### T1 — New stores + data model

- `stores/timeline.ts` becomes the new `Lane[]` + `LaneSegment` store; preserve `currentTime` alias to sequencer
- Migration: empty on first load, old data archived to `localStorage.timeline_v1_archive`
- Keep transport bar + time ruler unchanged

### T2 — Lane + segment rendering

- New `components/timeline/Lane.vue` (height-resizable, collapsible, header + body)
- New `components/timeline/segments/CurveSegment.vue`, `TriggerSegment.vue`, `ClipSegment.vue`, `HoldSegment.vue`
- New `components/timeline/SegmentInspector.vue` (collapsible bottom pane)
- Delete: `BezierCurveEditor`, `AudioTrackLane`, `KeyframeLane`, `LifecycleBar`
- Reuse: `TimeRuler`, `TrackContainer`, `CurveEditor`

### T3 — Runtime

- `services/timelineRuntime.ts` — single RAF, dispatches per segment kind
- Wire `useKeyframes.applyEasing` for `CurveSegment`
- Edge-detect for `TriggerSegment.retroactive` flag
- Subscribe to `parameterSystem.subscribe`, `WebMIDI`, `WebOSC`, `AnalysisPanel.analyser`

### T4 — Inspector + adding/removing segments

- Add-segment popover (C/T/L/H hotkeys)
- Per-kind inspector panels
- Selection / clipboard / nudge wired through `timelineStore` (no per-component selection state)

### T5 — Trigger source pickers

- v1 trigger sources implemented (MIDI / OSC / audio-onset / param-cross / time-marker / key / mouse)
- v1 action types implemented

### T6 — Polish

- Keyboard shortcuts (Ctrl-A, copy/paste/nudge — actually wired this time)
- Right-click context menus on segments
- Drag-to-resize segment endpoints
- Snap-to-beat / snap-to-marker

### T7 — Optional: native export integration

- Round-trip `Timeline` JSON to a `.timeline.json` file alongside `.preset` files in the same MEMFS folder (per M4 push 3 pattern)
- Export-to-native-AlloLib: emit the lane's playback as inline native code (TimeMasterCpu thread + parameter setters)

---

## 9. Style spec — what every timeline component must use

(From `TIMELINE_STYLE_AND_TRIGGERS.md`; copy-paste reference for the implementer.)

```
Lane row container:        bg-editor-bg border-b border-editor-border
Lane header:               bg-imgui-header hover:bg-imgui-header-hover text-xs px-2 py-1
Lane category badge:       per-category color (timeline.ts:41-71) + icon (♫ ◈ ◐ ⚡ 📷)
Time ruler:                bg-imgui-header text-imgui-text-dim text-[10px] font-mono
Segment fill:              category color at 60% opacity, full opacity on hover/select
Trigger diamond:           14×14 px, rotated square, category color, white outline if selected
Curve polyline stroke:     category color, 1.5px, accent on selected segment
Inspector pane:            same collapse pattern as ConsolePanel.vue:62-95
Action / +button:          text-xs bg-imgui-button hover:bg-imgui-button-hover px-2 py-0.5
```

---

## 10. Total LOC estimate

- Removed: ~2,700 (dead components + 4-category orchestration)
- Added: ~1,800 (new lane/segment/runtime/inspector + trigger source modules)
- Net: **~−900 LOC**, plus the runtime gap (env + events animation) actually closes for the first time.

---

## Sequencing

Recommended order: T0 (1 push, ~150 LOC) → T1 (1 push, ~250 LOC) → T2 (2 pushes, ~600 LOC) → T3 (1 push, ~300 LOC) → T4 (1 push, ~250 LOC) → T5 (1 push, ~400 LOC) → T6 (1 push, ~150 LOC). Roughly 8 pushes over a week of focused work.

Decisions in § 7 needed before T1 starts.
