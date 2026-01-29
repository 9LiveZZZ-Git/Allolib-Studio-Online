import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  parseSynthSequence,
  serializeSynthSequence,
  resolveTriggerPairs,
  getSequenceDuration,
  type SynthSequenceEvent,
  type SynthSequenceData,
} from '@/utils/synthsequence-parser'
import { detectSynthClasses, type DetectedSynth, type SynthParamDef } from '@/utils/synth-detector'
import { useProjectStore } from '@/stores/project'
import { parameterSystem, ParameterType } from '@/utils/parameter-system'
import type { AllolibRuntime } from '@/services/runtime'
import type { LatticeNode } from '@/utils/tone-lattice'

// ── Types ───────────────────────────────────────────────────────────

export interface SequencerNote {
  id: string
  startTime: number       // relative to clip start (seconds)
  duration: number
  synthName: string
  frequency: number
  amplitude: number
  params: number[]
  paramNames: string[]
  selected: boolean
  muted: boolean
}

export interface SequencerClip {
  id: string
  name: string
  duration: number         // clip length in seconds
  color: string
  notes: SequencerNote[]
  synthName: string        // primary synth for this clip
  paramNames: string[]     // synth-specific parameter names (from .synthSequence header)
  filePath: string | null  // path to .synthSequence file in project
  isDirty: boolean         // whether in-memory clip differs from file
  automation: ClipAutomation[]  // per-parameter automation envelopes
}

export interface ClipInstance {
  id: string
  clipId: string           // reference to SequencerClip
  trackIndex: number       // which arrangement track lane
  startTime: number        // absolute position on the arrangement timeline
}

export interface ArrangementTrack {
  id: string
  name: string
  color: string
  muted: boolean
  solo: boolean
  synthName: string        // locked to a specific synth class
  expanded: boolean        // whether automation lanes are shown
  automationLanes: ParameterLaneConfig[]  // per-track automation lane configs
}

// ── Lattice interaction types ─────────────────────────────────────

export type LatticeInteractionMode = 'note' | 'path' | 'chord'

export interface LatticePath {
  id: string
  noteIds: string[]        // ordered sequence of note IDs in the active clip
  timeOffset: number       // seconds between successive notes
}

export interface LatticeChord {
  id: string
  noteIds: string[]        // notes sounding simultaneously
  duration: number         // chord duration
  repeats: number          // how many times to repeat within duration
}

export interface PendingChord {
  frequencies: number[]    // frequencies being collected before finalization
  nodeKeys: string[]       // "i,j,k" keys for highlighting
}

export interface LatticeContextMenu {
  type: 'note' | 'path'
  x: number               // screen pixel X
  y: number               // screen pixel Y
  noteId?: string          // for note context menu
  pathId?: string          // for path context menu
}

// ── Parameter lane types ─────────────────────────────────────────

export interface ParameterLaneConfig {
  paramIndex: number       // index into note.params[]
  paramName: string        // display name (e.g., "attackTime")
  collapsed: boolean       // whether this lane is hidden
  min: number              // display range minimum
  max: number              // display range maximum
}

export interface AutomationPoint {
  id: string          // for hit-testing and selection
  time: number        // relative to clip start, 0..clip.duration
  value: number       // parameter value within [lane.min, lane.max]
}

export interface ClipAutomation {
  paramName: string               // matches ParameterLaneConfig.paramName
  points: AutomationPoint[]       // always sorted ascending by time
}

const PARAM_DEFAULTS: Record<string, { min: number; max: number }> = {
  amplitude: { min: 0, max: 1 },
  frequency: { min: 20, max: 20000 },
  attackTime: { min: 0, max: 5 },
  releaseTime: { min: 0, max: 5 },
  pan: { min: -1, max: 1 },
  sustain: { min: 0, max: 1 },
}

// Legacy compat alias
export type SequencerEvent = SequencerNote

export interface SequencerTrack {
  id: string
  name: string
  synthName: string
  events: SequencerNote[]
  muted: boolean
  solo: boolean
  color: string
}

export type TransportState = 'stopped' | 'playing' | 'paused'
export type EditMode = 'select' | 'draw' | 'erase'
export type ViewMode = 'clipTimeline' | 'frequencyRoll' | 'toneLattice'
export type SnapMode = 'none' | 'beat' | 'half' | 'quarter' | 'eighth' | 'sixteenth'
export type TimeDisplay = 'seconds' | 'beats'

export interface Viewport {
  scrollX: number     // time offset in seconds
  scrollY: number     // frequency scroll (log-space offset)
  zoomX: number       // pixels per second
  zoomY: number       // pixels per octave
  minFreq: number     // Hz
  maxFreq: number     // Hz
}

interface UndoEntry {
  clips: string
  clipInstances: string
  arrangementTracks: string
}

// ── Constants ───────────────────────────────────────────────────────

const TRACK_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
]

const CLIP_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#ef4444', '#f97316', '#14b8a6', '#6366f1',
]

let _nextId = 1
function generateId(): string {
  return `seq_${Date.now().toString(36)}_${(_nextId++).toString(36)}`
}

// ── Store ───────────────────────────────────────────────────────────

export const useSequencerStore = defineStore('sequencer', () => {
  // ── State ─────────────────────────────────────────────────────────

  // Clip-based architecture
  const clips = ref<SequencerClip[]>([])
  const clipInstances = ref<ClipInstance[]>([])
  const arrangementTracks = ref<ArrangementTrack[]>([])
  const activeClipId = ref<string | null>(null)
  const selectedClipInstanceIds = ref<Set<string>>(new Set())

  // Legacy tracks (computed from clips for backward compat)
  const tracks = ref<SequencerTrack[]>([])

  const transport = ref<TransportState>('stopped')
  const playheadPosition = ref(0)          // current time in seconds
  const editMode = ref<EditMode>('select')
  const viewMode = ref<ViewMode>('clipTimeline')
  const snapMode = ref<SnapMode>('quarter')
  const timeDisplay = ref<TimeDisplay>('seconds')
  const bpm = ref(120)
  const loopEnabled = ref(false)
  const loopStart = ref(0)
  const loopEnd = ref(8)
  const currentFilePath = ref<string | null>(null)

  // Lattice settings (shared between ToneLattice.vue and toolbar/sidebar)
  const latticeMode = ref<'2d' | '3d'>('2d')
  const latticeFundamental = ref(440)
  const latticeRangeI = ref(3)   // prime-3 range
  const latticeRangeJ = ref(3)   // prime-5 range
  const latticeRangeK = ref(2)   // prime-2 range (3D only)
  const latticeOctaveFilter = ref<number | null>(null)  // null = show all
  const latticeHoveredNode = ref<LatticeNode | null>(null)
  const latticeZoom = ref(1.0)   // zoom factor
  const latticeRotX = ref(0)    // 3D rotation about X in degrees
  const latticeRotY = ref(0)    // 3D rotation about Y in degrees

  // Lattice interaction state
  const latticeInteractionMode = ref<LatticeInteractionMode>('note')
  const latticePolyPathEnabled = ref(false)
  const latticePaths = ref<LatticePath[]>([])
  const latticeActivePath = ref<string | null>(null)
  const latticeChords = ref<LatticeChord[]>([])
  const latticePendingChord = ref<PendingChord | null>(null)
  const latticeContextMenu = ref<LatticeContextMenu | null>(null)

  // Detected synth classes from source code
  const detectedSynthClasses = ref<string[]>([])
  const detectedSynths = ref<DetectedSynth[]>([])

  // ── Parameter lane state ───────────────────────────────────────
  const parameterLanes = ref<ParameterLaneConfig[]>([])
  const parameterLanesVisible = ref(true)
  let _sequencerIsUpdating = false
  let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null

  const viewport = ref<Viewport>({
    scrollX: 0,
    scrollY: 0,
    zoomX: 100,   // 100 pixels per second
    zoomY: 80,    // 80 pixels per octave
    minFreq: 27.5,   // A0
    maxFreq: 4186,   // C8
  })

  // Clip editor viewport (separate from arrangement viewport)
  const clipViewport = ref<Viewport>({
    scrollX: 0,
    scrollY: 0,
    zoomX: 100,
    zoomY: 80,
    minFreq: 27.5,
    maxFreq: 4186,
  })

  // Undo/redo
  const undoStack = ref<UndoEntry[]>([])
  const redoStack = ref<UndoEntry[]>([])
  const maxUndoDepth = 50

  // Transport animation
  let animFrameId: number | null = null
  let playStartWallTime = 0
  let playStartPosition = 0

  // WASM playback bridge
  let runtime: AllolibRuntime | null = null
  const triggeredNotes = new Set<string>()  // note IDs currently sounding
  let nextVoiceId = 1

  // ── Computed ──────────────────────────────────────────────────────

  const activeClip = computed(() => {
    if (!activeClipId.value) return null
    return clips.value.find(c => c.id === activeClipId.value) || null
  })

  const activeClipNotes = computed(() => {
    return activeClip.value?.notes || []
  })

  const selectedNotes = computed(() => {
    return activeClipNotes.value.filter(n => n.selected)
  })

  // All notes from all clips placed on the arrangement (resolved to absolute time)
  const allArrangementNotes = computed(() => {
    const result: Array<SequencerNote & { absoluteStartTime: number }> = []
    for (const inst of clipInstances.value) {
      const clip = clips.value.find(c => c.id === inst.clipId)
      if (!clip) continue
      const track = arrangementTracks.value[inst.trackIndex]
      if (track?.muted) continue
      // Check solo
      const hasSolo = arrangementTracks.value.some(t => t.solo)
      if (hasSolo && !track?.solo) continue

      for (const note of clip.notes) {
        if (note.muted) continue
        result.push({
          ...note,
          absoluteStartTime: inst.startTime + note.startTime,
        })
      }
    }
    return result
  })

  // Legacy: allEvents returns active clip notes for backward compat with timeline/lattice
  const allEvents = computed(() => {
    return activeClipNotes.value
  })

  const selectedEvents = computed(() => selectedNotes.value)

  const sequenceDuration = computed(() => {
    let max = 0
    for (const inst of clipInstances.value) {
      const clip = clips.value.find(c => c.id === inst.clipId)
      if (!clip) continue
      const end = inst.startTime + clip.duration
      if (end > max) max = end
    }
    return Math.max(max, 10)
  })

  const activeClipDuration = computed(() => {
    const clip = activeClip.value
    if (!clip) return 4
    return clip.duration
  })

  const beatDuration = computed(() => 60 / bpm.value)

  // Map frequency → count of notes at that frequency (for poly markers)
  const latticeFrequencyNoteCount = computed(() => {
    const map = new Map<number, number>()
    for (const note of activeClipNotes.value) {
      const key = Math.round(1200 * Math.log2(note.frequency / 1))
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  })

  const synthNames = computed(() => {
    const names = new Set<string>()
    for (const clip of clips.value) {
      names.add(clip.synthName)
      for (const note of clip.notes) {
        names.add(note.synthName)
      }
    }
    if (names.size === 0) names.add('SineEnv')
    return Array.from(names)
  })

  // ── Snap helpers ──────────────────────────────────────────────────

  function getSnapInterval(): number {
    const beat = 60 / bpm.value
    switch (snapMode.value) {
      case 'none': return 0
      case 'beat': return beat
      case 'half': return beat / 2
      case 'quarter': return beat / 4
      case 'eighth': return beat / 8
      case 'sixteenth': return beat / 16
    }
  }

  function snapTime(t: number): number {
    const interval = getSnapInterval()
    if (interval === 0) return t
    return Math.round(t / interval) * interval
  }

  // ── Undo/Redo ─────────────────────────────────────────────────────

  function pushUndo() {
    undoStack.value.push({
      clips: JSON.stringify(clips.value),
      clipInstances: JSON.stringify(clipInstances.value),
      arrangementTracks: JSON.stringify(arrangementTracks.value),
    })
    if (undoStack.value.length > maxUndoDepth) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  function undo() {
    const entry = undoStack.value.pop()
    if (!entry) return
    redoStack.value.push({
      clips: JSON.stringify(clips.value),
      clipInstances: JSON.stringify(clipInstances.value),
      arrangementTracks: JSON.stringify(arrangementTracks.value),
    })
    clips.value = JSON.parse(entry.clips)
    clipInstances.value = JSON.parse(entry.clipInstances)
    arrangementTracks.value = JSON.parse(entry.arrangementTracks)
  }

  function redo() {
    const entry = redoStack.value.pop()
    if (!entry) return
    undoStack.value.push({
      clips: JSON.stringify(clips.value),
      clipInstances: JSON.stringify(clipInstances.value),
      arrangementTracks: JSON.stringify(arrangementTracks.value),
    })
    clips.value = JSON.parse(entry.clips)
    clipInstances.value = JSON.parse(entry.clipInstances)
    arrangementTracks.value = JSON.parse(entry.arrangementTracks)
  }

  // ── Arrangement Track management ──────────────────────────────────

  function ensureTrack(index: number): ArrangementTrack {
    while (arrangementTracks.value.length <= index) {
      const i = arrangementTracks.value.length
      arrangementTracks.value.push({
        id: generateId(),
        name: `Track ${i + 1}`,
        color: TRACK_COLORS[i % TRACK_COLORS.length],
        muted: false,
        solo: false,
        synthName: '',
        expanded: false,
        automationLanes: [],
      })
    }
    return arrangementTracks.value[index]
  }

  function ensureSynthTrack(synthName: string): ArrangementTrack {
    let track = arrangementTracks.value.find(t => t.synthName === synthName)
    if (!track) {
      const i = arrangementTracks.value.length
      track = {
        id: generateId(),
        name: synthName,
        color: TRACK_COLORS[i % TRACK_COLORS.length],
        muted: false,
        solo: false,
        synthName,
        expanded: false,
        automationLanes: [],
      }
      arrangementTracks.value.push(track)
    }
    return track
  }

  function updateDetectedSynths(files: Array<{ name: string; content: string }>) {
    const detected = detectSynthClasses(files)
    const newNames = detected.map(d => d.displayName)
    detectedSynthClasses.value = newNames
    detectedSynths.value = detected

    // Create tracks for newly detected synths
    for (const name of newNames) {
      ensureSynthTrack(name)
    }

    // Populate paramNames on existing clips that don't have them yet
    for (const synth of detected) {
      if (synth.params.length === 0) continue
      const pNames = synth.params.map(p => p.name)
      for (const clip of clips.value) {
        if (clip.synthName === synth.displayName && clip.paramNames.length === 0) {
          clip.paramNames = pNames
        }
      }
    }

    // Rebuild automation lanes for expanded tracks now that we have param info
    for (let i = 0; i < arrangementTracks.value.length; i++) {
      if (arrangementTracks.value[i].expanded) {
        rebuildTrackAutomationLanes(i)
      }
    }
  }

  /** Look up detected C++ parameter definitions for a synth class */
  function getDetectedSynthParams(synthName: string): SynthParamDef[] {
    const synth = detectedSynths.value.find(
      s => s.displayName === synthName || s.className === synthName
    )
    return synth?.params || []
  }

  // ── Clip management ───────────────────────────────────────────────

  function createClip(
    synthName: string = 'SineEnv',
    duration?: number,
    name?: string,
    filePath?: string | null,
    paramNames?: string[],
  ): SequencerClip | null {
    // Gate: require detected synth classes before creating clips
    if (detectedSynthClasses.value.length === 0 && !filePath) {
      console.warn('Cannot create clip: no synth classes detected. Run your program first.')
      return null
    }

    const barDur = (60 / bpm.value) * 4
    const clipName = name || `Clip ${clips.value.length + 1}`

    // Resolve paramNames: passed > detected from C++ source > empty
    let resolvedParamNames = paramNames || []
    if (resolvedParamNames.length === 0) {
      const detectedParams = getDetectedSynthParams(synthName)
      if (detectedParams.length > 0) {
        resolvedParamNames = detectedParams.map(p => p.name)
      }
    }

    const clip: SequencerClip = {
      id: generateId(),
      name: clipName,
      duration: duration || barDur,
      color: CLIP_COLORS[clips.value.length % CLIP_COLORS.length],
      notes: [],
      synthName,
      paramNames: resolvedParamNames,
      filePath: filePath ?? null,
      isDirty: false,
      automation: [],
    }
    clips.value.push(clip)

    // Auto-create a .synthSequence file in bin/<synthName>-data/
    if (!clip.filePath) {
      const projectStore = useProjectStore()
      const safeFileName = clipName.replace(/[^a-zA-Z0-9_-]/g, '_')
      const dataFolder = `bin/${synthName}-data`
      const path = `${dataFolder}/${safeFileName}.synthSequence`

      // Ensure bin/ and bin/<synthName>-data/ folders exist
      if (!projectStore.project.folders.some(f => f.path === 'bin')) {
        projectStore.createFolder('bin')
      }
      if (!projectStore.project.folders.some(f => f.path === dataFolder)) {
        projectStore.createFolder(`${synthName}-data`, 'bin')
      }

      // Write # header with detected param names if available
      const headerParams = resolvedParamNames.length > 0
        ? `# ${synthName} ${resolvedParamNames.join(' ')}`
        : `# ${synthName}`
      const content = `${headerParams}\n`
      projectStore.createDataFile(path, content)
      clip.filePath = path
      clip.isDirty = false
    }

    return clip
  }

  function duplicateClip(clipId: string): SequencerClip | null {
    const source = clips.value.find(c => c.id === clipId)
    if (!source) return null
    pushUndo()
    const newClip: SequencerClip = {
      ...JSON.parse(JSON.stringify(source)),
      id: generateId(),
      name: `${source.name} (copy)`,
      filePath: null,  // duplicated clip is not file-backed until saved
      isDirty: true,
    }
    // Give new IDs to all notes
    for (const note of newClip.notes) {
      note.id = generateId()
    }
    // Give new IDs to all automation points
    for (const auto of newClip.automation) {
      for (const pt of auto.points) {
        pt.id = generateId()
      }
    }
    clips.value.push(newClip)
    return newClip
  }

  function deleteClip(clipId: string) {
    pushUndo()
    clips.value = clips.value.filter(c => c.id !== clipId)
    // Remove all instances of this clip
    clipInstances.value = clipInstances.value.filter(ci => ci.clipId !== clipId)
    if (activeClipId.value === clipId) {
      activeClipId.value = clips.value.length > 0 ? clips.value[0].id : null
    }
  }

  function setActiveClip(clipId: string | null) {
    activeClipId.value = clipId
    if (clipId) {
      const clip = clips.value.find(c => c.id === clipId)
      if (clip) {
        // Reset clip editor viewport
        clipViewport.value.scrollX = 0
      }
    }
  }

  // ── Clip Instance management ──────────────────────────────────────

  function addClipInstance(
    clipId: string,
    trackIndex: number,
    startTime: number,
  ): ClipInstance {
    pushUndo()
    ensureTrack(trackIndex)
    const inst: ClipInstance = {
      id: generateId(),
      clipId,
      trackIndex,
      startTime: snapTime(startTime),
    }
    clipInstances.value.push(inst)
    return inst
  }

  function removeClipInstance(instanceId: string) {
    pushUndo()
    clipInstances.value = clipInstances.value.filter(ci => ci.id !== instanceId)
    selectedClipInstanceIds.value.delete(instanceId)
  }

  function moveClipInstance(instanceId: string, startTime: number, trackIndex?: number) {
    const inst = clipInstances.value.find(ci => ci.id === instanceId)
    if (!inst) return
    inst.startTime = Math.max(0, snapTime(startTime))
    if (trackIndex !== undefined) {
      // Clamp to existing tracks only — new tracks are created by synth detection
      const maxTrack = Math.max(0, arrangementTracks.value.length - 1)
      inst.trackIndex = Math.max(0, Math.min(trackIndex, maxTrack))
    }
  }

  function selectClipInstance(instanceId: string, additive: boolean = false) {
    if (!additive) {
      selectedClipInstanceIds.value.clear()
    }
    selectedClipInstanceIds.value.add(instanceId)
  }

  function deselectAllClipInstances() {
    selectedClipInstanceIds.value.clear()
  }

  function deleteSelectedClipInstances() {
    if (selectedClipInstanceIds.value.size === 0) return
    pushUndo()
    clipInstances.value = clipInstances.value.filter(
      ci => !selectedClipInstanceIds.value.has(ci.id)
    )
    selectedClipInstanceIds.value.clear()
  }

  // ── Note management (within active clip) ──────────────────────────

  function addNote(
    synthName: string,
    startTime: number,
    duration: number,
    frequency: number,
    amplitude: number,
    params: number[] = [],
    paramNames: string[] = [],
  ): SequencerNote | null {
    const clip = activeClip.value
    if (!clip) return null
    pushUndo()

    // If no params provided, initialize from detected C++ defaults
    // so all synth parameters are present (e.g., SineEnv: amplitude frequency attackTime releaseTime pan)
    let resolvedParams = params
    let resolvedParamNames = paramNames
    if (resolvedParams.length === 0 && clip.paramNames.length > 0) {
      resolvedParamNames = clip.paramNames
      const detectedParams = getDetectedSynthParams(clip.synthName)
      resolvedParams = clip.paramNames.map((name, i) => {
        // Use the C++ default value from createInternalTriggerParameter
        const detected = detectedParams.find(p => p.name === name)
        if (detected) {
          // Override amplitude/frequency with the passed-in values
          if (name === 'amplitude') return amplitude
          if (name === 'frequency') return frequency
          return detected.defaultValue
        }
        // Fallback for params not found in C++ detection
        if (i === 0) return amplitude
        if (i === 1) return frequency
        return 0
      })
    } else if (resolvedParamNames.length === 0 && clip.paramNames.length > 0) {
      resolvedParamNames = clip.paramNames
    }

    const note: SequencerNote = {
      id: generateId(),
      startTime: snapTime(startTime),
      duration: Math.max(snapTime(duration) || getSnapInterval() || 0.25, 0.01),
      synthName,
      frequency,
      amplitude,
      params: resolvedParams,
      paramNames: resolvedParamNames,
      selected: false,
      muted: false,
    }
    clip.notes.push(note)
    clip.isDirty = true
    // Auto-extend clip duration if needed
    const noteEnd = note.startTime + note.duration
    if (noteEnd > clip.duration) {
      clip.duration = noteEnd
    }
    return note
  }

  function removeNote(noteId: string) {
    const clip = activeClip.value
    if (!clip) return
    pushUndo()
    clip.notes = clip.notes.filter(n => n.id !== noteId)
    clip.isDirty = true
  }

  function updateNote(noteId: string, updates: Partial<SequencerNote>) {
    const clip = activeClip.value
    if (!clip) return
    const note = clip.notes.find(n => n.id === noteId)
    if (note) {
      Object.assign(note, updates)
      clip.isDirty = true
    }
  }

  function deleteSelectedNotes() {
    const clip = activeClip.value
    if (!clip) return
    const sel = selectedNotes.value
    if (sel.length === 0) return
    pushUndo()
    clip.notes = clip.notes.filter(n => !n.selected)
  }

  function selectAllNotes() {
    for (const note of activeClipNotes.value) {
      note.selected = true
    }
  }

  function deselectAllNotes() {
    for (const note of activeClipNotes.value) {
      note.selected = false
    }
  }

  function selectNotesInRect(
    timeStart: number, timeEnd: number,
    freqLow: number, freqHigh: number,
    additive: boolean,
  ) {
    if (!additive) deselectAllNotes()
    for (const note of activeClipNotes.value) {
      const noteEnd = note.startTime + note.duration
      if (note.startTime < timeEnd && noteEnd > timeStart &&
          note.frequency >= freqLow && note.frequency <= freqHigh) {
        note.selected = true
      }
    }
  }

  // ── Legacy compat aliases ─────────────────────────────────────────

  // These delegate to the note-based methods for backward compat
  function addEvent(
    synthName: string,
    startTime: number,
    duration: number,
    frequency: number,
    amplitude: number,
    params: number[] = [],
    paramNames: string[] = [],
  ) {
    // If no active clip, create one
    if (!activeClipId.value) {
      const clip = createClip(synthName)
      if (!clip) return null  // gated: no synths detected
      setActiveClip(clip.id)
      // Also place it on the arrangement
      addClipInstance(clip.id, 0, 0)
    }
    return addNote(synthName, startTime, duration, frequency, amplitude, params, paramNames)
  }

  function removeEvent(eventId: string) {
    removeNote(eventId)
  }

  function updateEvent(eventId: string, updates: Partial<SequencerNote>) {
    updateNote(eventId, updates)
  }

  function deleteSelected() {
    if (viewMode.value === 'clipTimeline') {
      deleteSelectedClipInstances()
    } else {
      deleteSelectedNotes()
    }
  }

  function selectAll() {
    if (viewMode.value === 'clipTimeline') {
      for (const inst of clipInstances.value) {
        selectedClipInstanceIds.value.add(inst.id)
      }
    } else {
      selectAllNotes()
    }
  }

  function deselectAll() {
    if (viewMode.value === 'clipTimeline') {
      deselectAllClipInstances()
    } else {
      deselectAllNotes()
    }
  }

  function selectEventsInRect(
    timeStart: number, timeEnd: number,
    freqLow: number, freqHigh: number,
    additive: boolean,
  ) {
    selectNotesInRect(timeStart, timeEnd, freqLow, freqHigh, additive)
  }

  // Legacy: getOrCreateTrack (no longer primary, but kept for compat)
  function getOrCreateTrack(synthName: string): SequencerTrack {
    let track = tracks.value.find(t => t.synthName === synthName)
    if (!track) {
      track = {
        id: generateId(),
        name: synthName,
        synthName,
        events: [],
        muted: false,
        solo: false,
        color: TRACK_COLORS[tracks.value.length % TRACK_COLORS.length],
      }
      tracks.value.push(track)
    }
    return track
  }

  // ── Copy/Paste ────────────────────────────────────────────────────

  let clipboard: SequencerNote[] = []

  function copySelected() {
    clipboard = selectedNotes.value.map(n => ({ ...n }))
  }

  function cutSelected() {
    copySelected()
    deleteSelectedNotes()
  }

  function paste() {
    if (clipboard.length === 0) return
    const clip = activeClip.value
    if (!clip) return
    pushUndo()
    deselectAllNotes()
    const minTime = Math.min(...clipboard.map(n => n.startTime))
    const offset = playheadPosition.value - minTime
    for (const n of clipboard) {
      const newNote: SequencerNote = {
        ...n,
        id: generateId(),
        startTime: n.startTime + offset,
        selected: true,
      }
      clip.notes.push(newNote)
    }
  }

  // ── Lattice interaction methods ──────────────────────────────────

  function findNotesByFrequency(frequency: number): SequencerNote[] {
    return activeClipNotes.value.filter(n =>
      Math.abs(Math.log2(n.frequency / frequency)) < 0.003
    )
  }

  function toggleNoteAtFrequency(frequency: number): { added: boolean; noteId: string } {
    if (detectedSynthClasses.value.length === 0) {
      console.warn('Cannot add notes: no synth classes detected. Run your program first.')
      return { added: false, noteId: '' }
    }
    const existing = findNotesByFrequency(frequency)
    if (existing.length > 0) {
      // Remove the first matching note
      removeNote(existing[0].id)
      return { added: false, noteId: existing[0].id }
    }
    // Add new note
    const synthName = detectedSynthClasses.value[0] || synthNames.value[0] || 'SineEnv'
    const dur = getSnapInterval() || 0.5
    const note = addEvent(synthName, playheadPosition.value, dur, frequency, 0.5)
    return { added: true, noteId: note?.id || '' }
  }

  function startPath(noteId: string) {
    const path: LatticePath = {
      id: generateId(),
      noteIds: [noteId],
      timeOffset: getSnapInterval() || 0.5,
    }
    latticePaths.value.push(path)
    latticeActivePath.value = path.id
  }

  function extendPath(frequency: number) {
    if (!latticeActivePath.value) return
    const path = latticePaths.value.find(p => p.id === latticeActivePath.value)
    if (!path) return

    // Get the last note in the path to calculate startTime
    const lastNoteId = path.noteIds[path.noteIds.length - 1]
    const lastNote = activeClipNotes.value.find(n => n.id === lastNoteId)
    const startTime = lastNote ? lastNote.startTime + path.timeOffset : playheadPosition.value

    const synthName = detectedSynthClasses.value[0] || synthNames.value[0] || 'SineEnv'
    const dur = getSnapInterval() || 0.5
    const note = addNote(synthName, startTime, dur, frequency, 0.5)
    if (note) {
      path.noteIds.push(note.id)
    }
  }

  function finalizePath() {
    latticeActivePath.value = null
  }

  function setPathTimeOffset(pathId: string, offset: number) {
    const path = latticePaths.value.find(p => p.id === pathId)
    if (!path || path.noteIds.length < 2) return

    path.timeOffset = offset
    // Recalculate note start times based on new offset
    const firstNote = activeClipNotes.value.find(n => n.id === path.noteIds[0])
    if (!firstNote) return

    for (let i = 1; i < path.noteIds.length; i++) {
      const note = activeClipNotes.value.find(n => n.id === path.noteIds[i])
      if (note) {
        note.startTime = firstNote.startTime + i * offset
      }
    }
  }

  function addChordNote(frequency: number) {
    if (!latticePendingChord.value) {
      latticePendingChord.value = { frequencies: [], nodeKeys: [] }
    }
    // Avoid duplicates
    const alreadyExists = latticePendingChord.value.frequencies.some(
      f => Math.abs(Math.log2(f / frequency)) < 0.003
    )
    if (!alreadyExists) {
      latticePendingChord.value.frequencies.push(frequency)
    }
  }

  function addChordNodeKey(nodeKey: string) {
    if (latticePendingChord.value && !latticePendingChord.value.nodeKeys.includes(nodeKey)) {
      latticePendingChord.value.nodeKeys.push(nodeKey)
    }
  }

  function finalizeChord(duration: number, repeats: number) {
    if (!latticePendingChord.value || latticePendingChord.value.frequencies.length === 0) return
    if (detectedSynthClasses.value.length === 0) return

    const synthName = detectedSynthClasses.value[0] || synthNames.value[0] || 'SineEnv'
    const noteIds: string[] = []
    const repeatInterval = repeats > 1 ? duration / repeats : duration

    for (let r = 0; r < repeats; r++) {
      const startTime = playheadPosition.value + r * repeatInterval
      for (const freq of latticePendingChord.value.frequencies) {
        const note = addNote(synthName, startTime, repeatInterval, freq, 0.5)
        if (note) noteIds.push(note.id)
      }
    }

    latticeChords.value.push({
      id: generateId(),
      noteIds,
      duration,
      repeats,
    })

    latticePendingChord.value = null
  }

  function cancelChord() {
    latticePendingChord.value = null
  }

  function openContextMenu(type: 'note' | 'path', x: number, y: number, noteId?: string, pathId?: string) {
    latticeContextMenu.value = { type, x, y, noteId, pathId }
  }

  function closeContextMenu() {
    latticeContextMenu.value = null
  }

  function getPolyCount(frequency: number): number {
    return findNotesByFrequency(frequency).length
  }

  // ── WASM Runtime Connection ───────────────────────────────────────

  function connectRuntime(rt: AllolibRuntime) {
    runtime = rt
  }

  function disconnectRuntime() {
    runtime = null
  }

  // ── Transport ─────────────────────────────────────────────────────

  function play() {
    if (transport.value === 'playing') return
    transport.value = 'playing'
    playStartWallTime = performance.now()
    playStartPosition = playheadPosition.value
    triggeredNotes.clear()
    animatePlayhead()
  }

  function pause() {
    if (transport.value !== 'playing') return
    transport.value = 'paused'
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
    // Release all triggered notes
    releaseAllVoices()
  }

  function stop() {
    transport.value = 'stopped'
    playheadPosition.value = 0
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
    // Release all triggered notes
    releaseAllVoices()
  }

  function setPosition(time: number) {
    playheadPosition.value = Math.max(0, time)
    if (transport.value === 'playing') {
      playStartWallTime = performance.now()
      playStartPosition = playheadPosition.value
      // Clear triggered notes since position changed
      releaseAllVoices()
    }
  }

  function toggleLoop() {
    loopEnabled.value = !loopEnabled.value
  }

  function releaseAllVoices() {
    if (runtime) {
      for (const noteKey of triggeredNotes) {
        const voiceId = parseInt(noteKey.split(':')[0]) || 0
        runtime.releaseVoice(voiceId)
      }
    }
    triggeredNotes.clear()
  }

  function animatePlayhead() {
    if (transport.value !== 'playing') return

    const now = performance.now()
    const elapsed = (now - playStartWallTime) / 1000
    let newPos = playStartPosition + elapsed

    if (loopEnabled.value && newPos >= loopEnd.value) {
      newPos = loopStart.value + (newPos - loopEnd.value) % (loopEnd.value - loopStart.value)
      playStartWallTime = now
      playStartPosition = newPos
      // On loop, release all and re-trigger
      releaseAllVoices()
    }

    const prevPos = playheadPosition.value
    playheadPosition.value = newPos

    // Trigger/release voices via WASM bridge
    if (runtime?.hasSequencerBridge) {
      scheduleVoices(prevPos, newPos)
    }

    animFrameId = requestAnimationFrame(animatePlayhead)
  }

  /**
   * Check arrangement notes and trigger/release voices as needed.
   * Called each animation frame during playback.
   */
  function scheduleVoices(prevTime: number, currentTime: number) {
    if (!runtime) return

    const notes = allArrangementNotes.value

    for (const note of notes) {
      const noteStart = note.absoluteStartTime
      const noteEnd = noteStart + note.duration
      const noteKey = `${nextVoiceId}:${note.id}`

      // Check if note should start (crossed start boundary)
      if (noteStart >= prevTime && noteStart < currentTime) {
        // Note should trigger now
        const voiceId = nextVoiceId++
        const key = `${voiceId}:${note.id}`
        triggeredNotes.add(key)

        // Set all note parameters on control voice BEFORE triggering
        // These get copied to the new voice by al_seq_trigger_on
        for (let i = 0; i < note.params.length; i++) {
          runtime.setVoiceParam(0, i, note.params[i])
        }

        runtime.triggerVoice(voiceId, note.frequency, note.amplitude, note.duration)
      }

      // Check if note should end (crossed end boundary)
      // We need to find the key for this note
      for (const key of triggeredNotes) {
        const parts = key.split(':')
        if (parts[1] === note.id) {
          if (noteEnd >= prevTime && noteEnd < currentTime) {
            const voiceId = parseInt(parts[0])
            runtime.releaseVoice(voiceId)
            triggeredNotes.delete(key)
          }
          break
        }
      }
    }
  }

  // ── Clip File I/O ────────────────────────────────────────────────

  function loadClipFromFile(filePath: string): SequencerClip | null {
    // Check if we already have a clip for this file
    const existing = clips.value.find(c => c.filePath === filePath)
    if (existing) return existing

    const projectStore = useProjectStore()
    const file = projectStore.getFileByPath(filePath)
    if (!file) return null

    const data = parseSynthSequence(file.content)
    const resolved = resolveTriggerPairs(data)

    const synthName = resolved.length > 0 ? resolved[0].synthName : 'SineEnv'
    const maxEnd = resolved.length > 0
      ? Math.max(...resolved.map(e => e.startTime + e.duration), 4)
      : 4

    // Determine per-synth paramNames: prefer synthParamMap, then data.paramNames,
    // then auto-generate from param count in the data
    const synthPNames = resolveSynthParamNames(data, synthName, resolved)

    const clipName = file.name.replace('.synthSequence', '')
    const clip = createClip(synthName, maxEnd, clipName, filePath, synthPNames)

    for (const ev of resolved) {
      const frequency = ev.params.length > 1 ? ev.params[1] : 440
      const amplitude = ev.params.length > 0 ? ev.params[0] : 0.5
      // Use per-synth paramNames for this event's synth class
      const evParamNames = data.synthParamMap[ev.synthName] || synthPNames

      clip!.notes.push({
        id: generateId(),
        startTime: ev.startTime,
        duration: ev.duration,
        synthName: ev.synthName,
        frequency,
        amplitude,
        params: ev.params,
        paramNames: evParamNames,
        selected: false,
        muted: false,
      })
    }

    clip!.isDirty = false
    if (data.tempo !== 120) bpm.value = data.tempo
    return clip
  }

  /** Resolve parameter names for a synth from parsed data, with fallbacks */
  function resolveSynthParamNames(
    data: SynthSequenceData,
    synthName: string,
    resolved: SynthSequenceEvent[],
  ): string[] {
    // 1. Check per-synth param map from # headers
    if (data.synthParamMap[synthName]?.length > 0) {
      return data.synthParamMap[synthName]
    }
    // 2. Fallback to legacy paramNames (single-synth file)
    if (data.paramNames.length > 0) {
      return data.paramNames
    }
    // 3. Auto-generate from param count in data
    const firstEvent = resolved.find(e => e.synthName === synthName)
    if (firstEvent && firstEvent.params.length > 0) {
      return firstEvent.params.map((_, i) => `param${i}`)
    }
    return []
  }

  function exportClipToSynthSequence(clip: SequencerClip): string {
    const events: SynthSequenceEvent[] = clip.notes
      .filter(n => !n.muted)
      .map(n => ({
        type: '@' as const,
        startTime: n.startTime,
        duration: n.duration,
        synthName: n.synthName,
        params: n.params.length > 0 ? n.params : [n.amplitude, n.frequency],
      }))

    // Build per-synth param map from clip's own paramNames
    const synthParamMap: Record<string, string[]> = {}
    if (clip.paramNames.length > 0) {
      synthParamMap[clip.synthName] = clip.paramNames
    } else if (clip.notes[0]?.paramNames?.length > 0) {
      synthParamMap[clip.synthName] = clip.notes[0].paramNames
    }

    return serializeSynthSequence({
      events,
      tempo: bpm.value,
      paramNames: clip.paramNames.length > 0 ? clip.paramNames : (clip.notes[0]?.paramNames || []),
      synthParamMap,
      comments: [],
    })
  }

  function saveClipToFile(clipId: string) {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip || !clip.filePath) return

    const projectStore = useProjectStore()
    const content = exportClipToSynthSequence(clip)
    projectStore.updateFileContent(clip.filePath, content)
    clip.isDirty = false
  }

  function createClipFromNewFile(synthName: string, fileName?: string): SequencerClip | null {
    if (detectedSynthClasses.value.length === 0) {
      console.warn('Cannot create clip file: no synth classes detected. Run your program first.')
      return null
    }

    const projectStore = useProjectStore()
    const name = fileName || `${synthName}_${clips.value.length + 1}`
    const baseName = name.replace('.synthSequence', '')
    const dataFolder = `bin/${synthName}-data`
    const path = `${dataFolder}/${baseName}.synthSequence`

    // Ensure bin/ and bin/<synthName>-data/ folders exist
    if (!projectStore.project.folders.some(f => f.path === 'bin')) {
      projectStore.createFolder('bin')
    }
    if (!projectStore.project.folders.some(f => f.path === dataFolder)) {
      projectStore.createFolder(`${synthName}-data`, 'bin')
    }

    // Create template .synthSequence content with detected param names
    const detectedParams = getDetectedSynthParams(synthName)
    const pNames = detectedParams.map(p => p.name)
    const headerParams = pNames.length > 0
      ? `# ${synthName} ${pNames.join(' ')}`
      : `# ${synthName}`
    const content = `${headerParams}\n`
    projectStore.createDataFile(path, content)

    const clip = createClip(synthName, undefined, baseName, path, pNames)
    if (clip) clip.isDirty = false
    return clip
  }

  // ── Arrangement Persistence ─────────────────────────────────────

  interface ArrangementFileData {
    version: number
    bpm: number
    loopEnabled: boolean
    loopStart: number
    loopEnd: number
    viewport?: { scrollX: number; scrollY: number; zoomX: number; zoomY: number }
    tracks: Array<{
      synthName: string
      name: string
      color: string
      muted: boolean
      solo: boolean
      expanded: boolean
      automationLanes: Array<{ paramIndex: number; paramName: string; collapsed: boolean; min: number; max: number }>
    }>
    clipInstances: Array<{ filePath: string; trackSynthName: string; startTime: number }>
  }

  function saveArrangement() {
    const projectStore = useProjectStore()
    const data: ArrangementFileData = {
      version: 2,
      bpm: bpm.value,
      loopEnabled: loopEnabled.value,
      loopStart: loopStart.value,
      loopEnd: loopEnd.value,
      viewport: {
        scrollX: viewport.value.scrollX,
        scrollY: viewport.value.scrollY,
        zoomX: viewport.value.zoomX,
        zoomY: viewport.value.zoomY,
      },
      tracks: arrangementTracks.value.map(t => ({
        synthName: t.synthName,
        name: t.name,
        color: t.color,
        muted: t.muted,
        solo: t.solo,
        expanded: t.expanded,
        automationLanes: t.automationLanes.map(lane => ({
          paramIndex: lane.paramIndex,
          paramName: lane.paramName,
          collapsed: lane.collapsed,
          min: lane.min,
          max: lane.max,
        })),
      })),
      clipInstances: clipInstances.value.map(ci => {
        const clip = clips.value.find(c => c.id === ci.clipId)
        return {
          filePath: clip?.filePath || '',
          trackSynthName: arrangementTracks.value[ci.trackIndex]?.synthName || '',
          startTime: ci.startTime,
        }
      }).filter(ci => ci.filePath),
    }

    projectStore.createDataFile('arrangement.json', JSON.stringify(data, null, 2))
  }

  function loadArrangement() {
    const projectStore = useProjectStore()
    const file = projectStore.getFileByPath('arrangement.json')
    if (!file) return

    try {
      const data: ArrangementFileData = JSON.parse(file.content)
      bpm.value = data.bpm
      loopEnabled.value = data.loopEnabled
      loopStart.value = data.loopStart
      loopEnd.value = data.loopEnd

      // Restore viewport (version 2+)
      if (data.viewport) {
        viewport.value.scrollX = data.viewport.scrollX
        viewport.value.scrollY = data.viewport.scrollY
        viewport.value.zoomX = data.viewport.zoomX
        viewport.value.zoomY = data.viewport.zoomY
      }

      // Clear existing tracks and recreate from saved data
      arrangementTracks.value = []

      // Restore tracks with full state
      for (const td of data.tracks) {
        const track = ensureSynthTrack(td.synthName)
        // Restore additional properties (version 2+)
        if (td.name) track.name = td.name
        if (td.color) track.color = td.color
        track.muted = td.muted
        track.solo = td.solo
        track.expanded = td.expanded ?? false
        // Restore automation lanes (version 2+)
        if (td.automationLanes && td.automationLanes.length > 0) {
          track.automationLanes = td.automationLanes.map(lane => ({
            paramIndex: lane.paramIndex,
            paramName: lane.paramName,
            collapsed: lane.collapsed,
            min: lane.min,
            max: lane.max,
          }))
        }
      }

      // Load each referenced clip file and place on arrangement
      for (const ci of data.clipInstances) {
        const clip = loadClipFromFile(ci.filePath)
        if (!clip) continue

        const trackIdx = arrangementTracks.value.findIndex(t => t.synthName === ci.trackSynthName)
        if (trackIdx >= 0) {
          const inst: ClipInstance = {
            id: generateId(),
            clipId: clip.id,
            trackIndex: trackIdx,
            startTime: ci.startTime,
          }
          clipInstances.value.push(inst)
        }
      }

      // Set active clip to first one
      if (clips.value.length > 0) {
        setActiveClip(clips.value[0].id)
      }
    } catch (e) {
      console.warn('Failed to load arrangement:', e)
    }
  }

  // ── File I/O (Legacy) ──────────────────────────────────────────

  function loadFromSynthSequence(content: string, filePath?: string) {
    pushUndo()
    const data = parseSynthSequence(content)
    const resolved = resolveTriggerPairs(data)

    // Clear existing state
    clips.value = []
    clipInstances.value = []
    arrangementTracks.value = []
    tracks.value = []
    bpm.value = data.tempo

    if (filePath) currentFilePath.value = filePath

    // Group events by synthName to create one clip per synth
    const synthGroups = new Map<string, typeof resolved>()
    for (const ev of resolved) {
      const group = synthGroups.get(ev.synthName) || []
      group.push(ev)
      synthGroups.set(ev.synthName, group)
    }

    let trackIdx = 0
    for (const [synthName, events] of synthGroups) {
      // Resolve per-synth paramNames
      const synthPNames = resolveSynthParamNames(data, synthName, resolved)

      // Create a clip for this synth group
      const maxEnd = Math.max(...events.map(e => e.startTime + e.duration), 4)
      const clip = createClip(synthName, maxEnd, `${synthName} Clip`, undefined, synthPNames)

      for (const ev of events) {
        const frequency = ev.params.length > 1 ? ev.params[1] : 440
        const amplitude = ev.params.length > 0 ? ev.params[0] : 0.5

        clip!.notes.push({
          id: generateId(),
          startTime: ev.startTime,
          duration: ev.duration,
          synthName: ev.synthName,
          frequency,
          amplitude,
          params: ev.params,
          paramNames: synthPNames,
          selected: false,
          muted: false,
        })
      }

      // Place clip on arrangement
      const track = ensureSynthTrack(synthName)
      const tIdx = arrangementTracks.value.indexOf(track)
      addClipInstance(clip!.id, tIdx, 0)

      // Also build legacy track
      const legacyTrack = getOrCreateTrack(synthName)
      legacyTrack.events = clip!.notes

      trackIdx++
    }

    // Set active clip to the first one
    if (clips.value.length > 0) {
      setActiveClip(clips.value[0].id)
    }

    // Reset viewport to fit content
    const dur = getSequenceDuration(resolved)
    viewport.value.scrollX = 0
    if (dur > 0) {
      viewport.value.zoomX = Math.max(20, Math.min(200, 800 / dur))
    }

    // Reset transport
    transport.value = 'stopped'
    playheadPosition.value = 0
    undoStack.value = []
    redoStack.value = []
  }

  function exportToSynthSequence(): string {
    const events: SynthSequenceEvent[] = []
    const synthParamMap: Record<string, string[]> = {}

    // Gather all notes from all clip instances in arrangement order
    // and collect per-synth paramNames
    for (const inst of clipInstances.value) {
      const clip = clips.value.find(c => c.id === inst.clipId)
      if (!clip) continue
      const track = arrangementTracks.value[inst.trackIndex]
      if (track?.muted) continue

      // Collect per-synth paramNames from clips
      if (!synthParamMap[clip.synthName]) {
        if (clip.paramNames.length > 0) {
          synthParamMap[clip.synthName] = clip.paramNames
        } else if (clip.notes[0]?.paramNames?.length > 0) {
          synthParamMap[clip.synthName] = clip.notes[0].paramNames
        }
      }

      for (const note of clip.notes) {
        if (note.muted) continue
        events.push({
          type: '@',
          startTime: inst.startTime + note.startTime,
          duration: note.duration,
          synthName: note.synthName,
          params: note.params.length > 0 ? note.params : [note.amplitude, note.frequency],
        })
      }
    }

    // First synth's paramNames as legacy fallback
    const firstParamNames = Object.values(synthParamMap)[0] || []

    const seqData: SynthSequenceData = {
      events,
      tempo: bpm.value,
      paramNames: firstParamNames,
      synthParamMap,
      comments: [],
    }

    return serializeSynthSequence(seqData)
  }

  // ── Parameter Lane Methods ──────────────────────────────────────

  function rebuildParameterLanes() {
    const clip = activeClip.value
    if (!clip || clip.notes.length === 0) {
      parameterLanes.value = []
      return
    }

    const names = clip.paramNames.length > 0
      ? clip.paramNames
      : clip.notes[0].paramNames
    if (names.length === 0) {
      parameterLanes.value = []
      return
    }

    // Preserve collapsed state from previous lanes
    const prevCollapsed = new Map<string, boolean>()
    for (const lane of parameterLanes.value) {
      prevCollapsed.set(lane.paramName, lane.collapsed)
    }

    // Get detected C++ params for min/max
    const detectedParams = getDetectedSynthParams(clip.synthName)

    parameterLanes.value = names.map((name, index) => {
      let min: number, max: number

      // 1. Check detected C++ param definition
      const detectedP = detectedParams.find(p => p.name === name)
      if (detectedP) {
        min = detectedP.min
        max = detectedP.max
      } else {
        const defaults = PARAM_DEFAULTS[name]
        if (defaults) {
          min = defaults.min
          max = defaults.max
        } else {
          // Scan all notes for this param index to determine range
          let lo = Infinity, hi = -Infinity
          for (const note of clip.notes) {
            if (index < note.params.length) {
              lo = Math.min(lo, note.params[index])
              hi = Math.max(hi, note.params[index])
            }
          }
          if (!isFinite(lo)) { lo = 0; hi = 1 }
          const margin = (hi - lo) * 0.1 || 0.5
          min = lo - margin
          max = hi + margin
        }
      }

      return {
        paramIndex: index,
        paramName: name,
        collapsed: prevCollapsed.get(name) ?? false,
        min,
        max,
      }
    })
  }

  function toggleParameterLane(paramIndex: number) {
    const lane = parameterLanes.value.find(l => l.paramIndex === paramIndex)
    if (lane) lane.collapsed = !lane.collapsed
  }

  function setParameterLaneRange(paramIndex: number, min: number, max: number) {
    const lane = parameterLanes.value.find(l => l.paramIndex === paramIndex)
    if (lane) {
      lane.min = min
      lane.max = max
    }
  }

  function updateNoteParam(noteId: string, paramIndex: number, value: number) {
    const clip = activeClip.value
    if (!clip) return
    const note = clip.notes.find(n => n.id === noteId)
    if (!note) return

    // Ensure params array is long enough
    while (note.params.length <= paramIndex) {
      note.params.push(0)
    }
    note.params[paramIndex] = value

    // Keep amplitude/frequency in sync
    if (paramIndex === 0) note.amplitude = value
    if (paramIndex === 1) note.frequency = value

    clip.isDirty = true
  }

  /** Update a note parameter in any clip (not just active), for clip timeline automation lanes */
  function updateNoteParamInClip(clipId: string, noteId: string, paramIndex: number, value: number) {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) return
    const note = clip.notes.find(n => n.id === noteId)
    if (!note) return

    // Ensure params array is long enough
    while (note.params.length <= paramIndex) {
      note.params.push(0)
    }
    note.params[paramIndex] = value

    // Keep amplitude/frequency in sync
    if (paramIndex === 0) note.amplitude = value
    if (paramIndex === 1) note.frequency = value

    clip.isDirty = true
  }

  // Rebuild lanes when active clip changes
  watch(() => activeClipId.value, () => rebuildParameterLanes())

  // ── Track-Level Automation Lane Methods ──────────────────────────

  function rebuildTrackAutomationLanes(trackIndex: number) {
    const track = arrangementTracks.value[trackIndex]
    if (!track) return

    // Find clips on this track to determine synth-specific parameters
    const trackClips = findClipsForTrack(trackIndex)
    const synthName = track.synthName

    // Primary source: detected C++ params from createInternalTriggerParameter
    const detectedParams = getDetectedSynthParams(synthName)

    // Get paramNames: detected C++ > clip paramNames > parameterSystem fallback
    let pNames: string[] = []
    if (detectedParams.length > 0) {
      pNames = detectedParams.map(p => p.name)
    } else {
      for (const clip of trackClips) {
        if (clip.paramNames.length > 0) {
          pNames = clip.paramNames
          break
        }
        if (clip.notes.length > 0 && clip.notes[0].paramNames.length > 0) {
          pNames = clip.notes[0].paramNames
          break
        }
      }
    }

    // Last resort fallback: parameterSystem (runtime C++ params)
    if (pNames.length === 0) {
      const allParams = parameterSystem.getAll()
        .filter(p =>
          p.type === ParameterType.FLOAT ||
          p.type === ParameterType.INT ||
          p.type === ParameterType.BOOL ||
          p.type === ParameterType.MENU
        )
      if (allParams.length > 0) {
        pNames = allParams.map(p => p.name)
      }
    }

    if (pNames.length === 0) {
      track.automationLanes = []
      return
    }

    // Preserve collapsed state from existing lanes
    const prevCollapsed = new Map<string, boolean>()
    for (const lane of track.automationLanes) {
      prevCollapsed.set(lane.paramName, lane.collapsed)
    }

    // Determine min/max: detected C++ > PARAM_DEFAULTS > parameterSystem > data scan
    track.automationLanes = pNames.map((name, index) => {
      let min: number, max: number

      // 1. Check detected C++ param definition
      const detectedP = detectedParams.find(p => p.name === name)
      if (detectedP) {
        min = detectedP.min
        max = detectedP.max
      } else {
        const defaults = PARAM_DEFAULTS[name]
        if (defaults) {
          min = defaults.min
          max = defaults.max
        } else {
          // Try parameterSystem for range info
          const runtimeParam = parameterSystem.getAll().find(p => p.name === name)
          if (runtimeParam) {
            min = runtimeParam.min
            max = runtimeParam.max
          } else {
            // Scan clip notes for this param index to determine range
            let lo = Infinity, hi = -Infinity
            for (const clip of trackClips) {
              for (const note of clip.notes) {
                if (index < note.params.length) {
                  lo = Math.min(lo, note.params[index])
                  hi = Math.max(hi, note.params[index])
                }
              }
            }
            if (!isFinite(lo)) { lo = 0; hi = 1 }
            const margin = (hi - lo) * 0.1 || 0.5
            min = lo - margin
            max = hi + margin
          }
        }
      }

      return {
        paramIndex: index,
        paramName: name,
        collapsed: prevCollapsed.get(name) ?? false,
        min,
        max,
      }
    })
  }

  /** Find all clips placed on a given track */
  function findClipsForTrack(trackIndex: number): SequencerClip[] {
    const clipIds = new Set<string>()
    for (const inst of clipInstances.value) {
      if (inst.trackIndex === trackIndex) {
        clipIds.add(inst.clipId)
      }
    }
    return clips.value.filter(c => clipIds.has(c.id))
  }

  function toggleTrackExpanded(trackIndex: number) {
    const track = arrangementTracks.value[trackIndex]
    if (!track) return
    track.expanded = !track.expanded
    if (track.expanded && track.automationLanes.length === 0) {
      rebuildTrackAutomationLanes(trackIndex)
    }
  }

  function toggleTrackAutomationLane(trackIndex: number, paramName: string) {
    const track = arrangementTracks.value[trackIndex]
    if (!track) return
    const lane = track.automationLanes.find(l => l.paramName === paramName)
    if (lane) lane.collapsed = !lane.collapsed
  }

  /**
   * Delete a track and all clip instances on it.
   * Clip instances on higher tracks are shifted down.
   */
  function deleteTrack(trackIndex: number) {
    if (trackIndex < 0 || trackIndex >= arrangementTracks.value.length) return

    pushUndo()

    // Remove clip instances on this track
    clipInstances.value = clipInstances.value.filter(ci => ci.trackIndex !== trackIndex)

    // Shift clip instances on higher tracks down
    for (const ci of clipInstances.value) {
      if (ci.trackIndex > trackIndex) {
        ci.trackIndex--
      }
    }

    // Remove the track
    arrangementTracks.value.splice(trackIndex, 1)
  }

  function getTrackTotalHeight(trackIndex: number, baseH: number, laneH: number, collapsedH: number): number {
    const track = arrangementTracks.value[trackIndex]
    if (!track || !track.expanded) return baseH
    if (track.automationLanes.length === 0) return baseH + collapsedH
    let h = baseH
    for (const lane of track.automationLanes) {
      h += lane.collapsed ? collapsedH : laneH
    }
    return h
  }

  function getTrackYOffset(trackIndex: number, baseH: number, laneH: number, collapsedH: number, rulerH: number): number {
    let y = rulerH
    for (let i = 0; i < trackIndex; i++) {
      y += getTrackTotalHeight(i, baseH, laneH, collapsedH)
    }
    return y
  }

  // ── Clip Automation Methods ──────────────────────────────────────

  function addAutomationPoint(
    clipId: string, paramName: string, time: number, value: number,
  ): AutomationPoint | null {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) return null

    let autoEnv = clip.automation.find(a => a.paramName === paramName)
    if (!autoEnv) {
      autoEnv = { paramName, points: [] }
      clip.automation.push(autoEnv)
    }

    const clampedTime = Math.max(0, Math.min(clip.duration, snapTime(time)))
    const point: AutomationPoint = { id: generateId(), time: clampedTime, value }

    const idx = autoEnv.points.findIndex(p => p.time > clampedTime)
    if (idx < 0) autoEnv.points.push(point)
    else autoEnv.points.splice(idx, 0, point)

    clip.isDirty = true
    return point
  }

  function removeAutomationPoint(clipId: string, paramName: string, pointId: string) {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) return
    const autoEnv = clip.automation.find(a => a.paramName === paramName)
    if (!autoEnv) return
    autoEnv.points = autoEnv.points.filter(p => p.id !== pointId)
    if (autoEnv.points.length === 0) {
      clip.automation = clip.automation.filter(a => a !== autoEnv)
    }
    clip.isDirty = true
  }

  function moveAutomationPoint(
    clipId: string, paramName: string, pointId: string, newTime: number, newValue: number,
  ) {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) return
    const autoEnv = clip.automation.find(a => a.paramName === paramName)
    if (!autoEnv) return
    const point = autoEnv.points.find(p => p.id === pointId)
    if (!point) return
    point.time = Math.max(0, Math.min(clip.duration, snapTime(newTime)))
    point.value = newValue
    autoEnv.points.sort((a, b) => a.time - b.time)
    clip.isDirty = true
  }

  function clipAutomationToNewDuration(clipId: string, newDuration: number) {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) return
    for (const autoEnv of clip.automation) {
      autoEnv.points = autoEnv.points.filter(p => p.time <= newDuration)
    }
    clip.automation = clip.automation.filter(a => a.points.length > 0)
  }

  function addAutomationPointsBatch(
    clipId: string, paramName: string, newPoints: Array<{ time: number; value: number }>,
  ) {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) return

    let autoEnv = clip.automation.find(a => a.paramName === paramName)
    if (!autoEnv) {
      autoEnv = { paramName, points: [] }
      clip.automation.push(autoEnv)
    }

    const minT = Math.min(...newPoints.map(p => p.time))
    const maxT = Math.max(...newPoints.map(p => p.time))
    // Remove existing points in the drawn range
    autoEnv.points = autoEnv.points.filter(p => p.time < minT || p.time > maxT)

    for (const np of newPoints) {
      autoEnv.points.push({
        id: generateId(),
        time: Math.max(0, Math.min(clip.duration, np.time)),
        value: np.value,
      })
    }
    autoEnv.points.sort((a, b) => a.time - b.time)
    clip.isDirty = true
  }

  function removeAutomationPointsInRange(
    clipId: string, paramName: string, startTime: number, endTime: number,
  ) {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) return
    const autoEnv = clip.automation.find(a => a.paramName === paramName)
    if (!autoEnv) return
    const tMin = Math.min(startTime, endTime)
    const tMax = Math.max(startTime, endTime)
    autoEnv.points = autoEnv.points.filter(p => p.time < tMin || p.time > tMax)
    if (autoEnv.points.length === 0) {
      clip.automation = clip.automation.filter(a => a !== autoEnv)
    }
    clip.isDirty = true
  }

  // ── Bidirectional File Sync ───────────────────────────────────────

  function scheduleAutoSave(clipId: string) {
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer)
    _autoSaveTimer = setTimeout(() => {
      _autoSaveTimer = null
      const clip = clips.value.find(c => c.id === clipId)
      if (!clip || !clip.filePath || !clip.isDirty) return

      _sequencerIsUpdating = true
      const content = exportClipToSynthSequence(clip)
      const projectStore = useProjectStore()
      projectStore.updateFileContent(clip.filePath, content)
      clip.isDirty = false
      setTimeout(() => { _sequencerIsUpdating = false }, 0)
    }, 500)
  }

  // Auto-save dirty clips to their files
  watch(
    () => clips.value.filter(c => c.isDirty && c.filePath).map(c => c.id),
    (dirtyClipIds) => {
      if (dirtyClipIds.length > 0) {
        scheduleAutoSave(dirtyClipIds[0])
      }
    },
  )

  // Reload clip when its file changes externally (e.g., edited in Monaco)
  watch(
    () => {
      const projectStore = useProjectStore()
      return clips.value
        .filter(c => c.filePath)
        .map(c => {
          const file = projectStore.getFileByPath(c.filePath!)
          return { clipId: c.id, content: file?.content || '' }
        })
    },
    (entries, oldEntries) => {
      if (_sequencerIsUpdating) return
      if (!oldEntries) return
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const old = oldEntries[i]
        if (!old || entry.content === old.content) continue
        reloadClipFromFileContent(entry.clipId, entry.content)
      }
    },
    { deep: true },
  )

  function reloadClipFromFileContent(clipId: string, fileContent: string) {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) return

    const data = parseSynthSequence(fileContent)
    const resolved = resolveTriggerPairs(data)

    // Update clip-level paramNames from file headers
    const synthPNames = resolveSynthParamNames(data, clip.synthName, resolved)
    if (synthPNames.length > 0) {
      clip.paramNames = synthPNames
    }

    // Preserve selection state by matching startTime+frequency
    const oldSelectionMap = new Map<string, boolean>()
    for (const note of clip.notes) {
      oldSelectionMap.set(`${note.startTime}_${note.frequency}`, note.selected)
    }

    clip.notes = resolved.map(ev => {
      const frequency = ev.params.length > 1 ? ev.params[1] : 440
      const amplitude = ev.params.length > 0 ? ev.params[0] : 0.5
      const evParamNames = data.synthParamMap[ev.synthName] || synthPNames
      return {
        id: generateId(),
        startTime: ev.startTime,
        duration: ev.duration,
        synthName: ev.synthName,
        frequency,
        amplitude,
        params: ev.params,
        paramNames: evParamNames,
        selected: oldSelectionMap.get(`${ev.startTime}_${frequency}`) || false,
        muted: false,
      }
    })

    if (resolved.length > 0) {
      clip.duration = Math.max(clip.duration, Math.max(...resolved.map(e => e.startTime + e.duration)))
    }
    if (data.tempo !== 120) bpm.value = data.tempo
    clip.isDirty = false
    rebuildParameterLanes()

    // Rebuild automation lanes for any tracks containing this clip
    for (let i = 0; i < arrangementTracks.value.length; i++) {
      if (arrangementTracks.value[i].expanded) {
        const hasClip = clipInstances.value.some(ci => ci.clipId === clipId && ci.trackIndex === i)
        if (hasClip) rebuildTrackAutomationLanes(i)
      }
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  // Auto-rebuild automation lanes when C++ parameters are detected on run
  // (used as fallback when clips don't have their own synth-specific paramNames)
  const _unsubParams = parameterSystem.subscribe(() => {
    for (let i = 0; i < arrangementTracks.value.length; i++) {
      const track = arrangementTracks.value[i]
      if (track.expanded && track.automationLanes.length === 0) {
        rebuildTrackAutomationLanes(i)
      }
    }
  })

  // Auto-save arrangement when state changes (debounced)
  let _arrangementSaveTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleArrangementSave() {
    if (_arrangementSaveTimer) clearTimeout(_arrangementSaveTimer)
    _arrangementSaveTimer = setTimeout(() => {
      _arrangementSaveTimer = null
      saveArrangement()
    }, 2000) // Save 2 seconds after last change
  }

  // Watch arrangement-related state for auto-save
  watch(
    () => [
      arrangementTracks.value,
      clipInstances.value,
      bpm.value,
      loopEnabled.value,
      loopStart.value,
      loopEnd.value,
      viewport.value.scrollX,
      viewport.value.scrollY,
      viewport.value.zoomX,
      viewport.value.zoomY,
    ],
    () => {
      scheduleArrangementSave()
    },
    { deep: true }
  )

  function dispose() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
    if (_autoSaveTimer) {
      clearTimeout(_autoSaveTimer)
      _autoSaveTimer = null
    }
    if (_arrangementSaveTimer) {
      clearTimeout(_arrangementSaveTimer)
      _arrangementSaveTimer = null
    }
    _unsubParams()
  }

  return {
    // State
    clips,
    clipInstances,
    arrangementTracks,
    activeClipId,
    selectedClipInstanceIds,
    tracks,
    transport,
    playheadPosition,
    editMode,
    viewMode,
    snapMode,
    timeDisplay,
    bpm,
    loopEnabled,
    loopStart,
    loopEnd,
    viewport,
    clipViewport,
    currentFilePath,

    // Lattice state
    latticeMode,
    latticeFundamental,
    latticeRangeI,
    latticeRangeJ,
    latticeRangeK,
    latticeOctaveFilter,
    latticeHoveredNode,
    latticeZoom,
    latticeRotX,
    latticeRotY,

    // Lattice interaction state
    latticeInteractionMode,
    latticePolyPathEnabled,
    latticePaths,
    latticeActivePath,
    latticeChords,
    latticePendingChord,
    latticeContextMenu,

    // Parameter lanes
    parameterLanes,
    parameterLanesVisible,

    // Detected synths
    detectedSynthClasses,
    detectedSynths,
    getDetectedSynthParams,

    // Computed
    activeClip,
    activeClipNotes,
    selectedNotes,
    allArrangementNotes,
    allEvents,
    selectedEvents,
    sequenceDuration,
    activeClipDuration,
    beatDuration,
    latticeFrequencyNoteCount,
    synthNames,

    // Snap
    snapTime,
    getSnapInterval,

    // Undo/redo
    pushUndo,
    undo,
    redo,

    // Arrangement track management
    ensureTrack,
    ensureSynthTrack,
    updateDetectedSynths,
    toggleTrackExpanded,
    toggleTrackAutomationLane,
    deleteTrack,
    rebuildTrackAutomationLanes,
    getTrackTotalHeight,
    getTrackYOffset,

    // Clip automation
    addAutomationPoint,
    removeAutomationPoint,
    moveAutomationPoint,
    clipAutomationToNewDuration,
    addAutomationPointsBatch,
    removeAutomationPointsInRange,

    // Clip management
    createClip,
    duplicateClip,
    deleteClip,
    setActiveClip,

    // Clip instance management
    addClipInstance,
    removeClipInstance,
    moveClipInstance,
    selectClipInstance,
    deselectAllClipInstances,
    deleteSelectedClipInstances,

    // Note management (within active clip)
    addNote,
    removeNote,
    updateNote,
    deleteSelectedNotes,
    selectAllNotes,
    deselectAllNotes,
    selectNotesInRect,

    // Legacy compat
    getOrCreateTrack,
    addEvent,
    removeEvent,
    updateEvent,
    deleteSelected,
    selectAll,
    deselectAll,
    selectEventsInRect,

    // Copy/paste
    copySelected,
    cutSelected,
    paste,

    // Parameter lane management
    rebuildParameterLanes,
    toggleParameterLane,
    setParameterLaneRange,
    updateNoteParam,
    updateNoteParamInClip,

    // Lattice interaction
    findNotesByFrequency,
    toggleNoteAtFrequency,
    startPath,
    extendPath,
    finalizePath,
    setPathTimeOffset,
    addChordNote,
    addChordNodeKey,
    finalizeChord,
    cancelChord,
    openContextMenu,
    closeContextMenu,
    getPolyCount,

    // Runtime connection
    connectRuntime,
    disconnectRuntime,

    // Transport
    play,
    pause,
    stop,
    setPosition,
    toggleLoop,

    // Clip file I/O
    loadClipFromFile,
    saveClipToFile,
    createClipFromNewFile,
    exportClipToSynthSequence,

    // Arrangement persistence
    saveArrangement,
    loadArrangement,

    // File I/O (legacy)
    loadFromSynthSequence,
    exportToSynthSequence,

    // Cleanup
    dispose,
  }
})
