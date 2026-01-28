import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  parseSynthSequence,
  serializeSynthSequence,
  resolveTriggerPairs,
  getSequenceDuration,
  type SynthSequenceEvent,
  type SynthSequenceData,
} from '@/utils/synthsequence-parser'
import { detectSynthClasses } from '@/utils/synth-detector'
import { useProjectStore } from '@/stores/project'
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
  filePath: string | null  // path to .synthSequence file in project
  isDirty: boolean         // whether in-memory clip differs from file
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
      }
      arrangementTracks.value.push(track)
    }
    return track
  }

  function updateDetectedSynths(files: Array<{ name: string; content: string }>) {
    const detected = detectSynthClasses(files)
    const newNames = detected.map(d => d.displayName)
    detectedSynthClasses.value = newNames

    // Create tracks for newly detected synths
    for (const name of newNames) {
      ensureSynthTrack(name)
    }
  }

  // ── Clip management ───────────────────────────────────────────────

  function createClip(
    synthName: string = 'SineEnv',
    duration?: number,
    name?: string,
    filePath?: string | null,
  ): SequencerClip | null {
    // Gate: require detected synth classes before creating clips
    if (detectedSynthClasses.value.length === 0 && !filePath) {
      console.warn('Cannot create clip: no synth classes detected. Run your program first.')
      return null
    }

    const barDur = (60 / bpm.value) * 4
    const clipName = name || `Clip ${clips.value.length + 1}`
    const clip: SequencerClip = {
      id: generateId(),
      name: clipName,
      duration: duration || barDur,
      color: CLIP_COLORS[clips.value.length % CLIP_COLORS.length],
      notes: [],
      synthName,
      filePath: filePath ?? null,
      isDirty: false,
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

      const content = `# ${synthName}\n# @ <start> <dur> ${synthName} <params...>\n`
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
      ensureTrack(trackIndex)
      inst.trackIndex = trackIndex
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
    const note: SequencerNote = {
      id: generateId(),
      startTime: snapTime(startTime),
      duration: Math.max(snapTime(duration) || getSnapInterval() || 0.25, 0.01),
      synthName,
      frequency,
      amplitude,
      params,
      paramNames,
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

    const clipName = file.name.replace('.synthSequence', '')
    const clip = createClip(synthName, maxEnd, clipName, filePath)

    for (const ev of resolved) {
      const frequency = ev.params.length > 1 ? ev.params[1] : 440
      const amplitude = ev.params.length > 0 ? ev.params[0] : 0.5

      clip.notes.push({
        id: generateId(),
        startTime: ev.startTime,
        duration: ev.duration,
        synthName: ev.synthName,
        frequency,
        amplitude,
        params: ev.params,
        paramNames: data.paramNames,
        selected: false,
        muted: false,
      })
    }

    clip.isDirty = false
    if (data.tempo !== 120) bpm.value = data.tempo
    return clip
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

    return serializeSynthSequence({
      events,
      tempo: bpm.value,
      paramNames: clip.notes[0]?.paramNames || [],
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

    // Create template .synthSequence content
    const content = `# ${synthName}\n# @ <start> <dur> ${synthName} <params...>\n`
    projectStore.createDataFile(path, content)

    const clip = createClip(synthName, undefined, baseName, path)
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
    tracks: Array<{ synthName: string; muted: boolean; solo: boolean }>
    clipInstances: Array<{ filePath: string; trackSynthName: string; startTime: number }>
  }

  function saveArrangement() {
    const projectStore = useProjectStore()
    const data: ArrangementFileData = {
      version: 1,
      bpm: bpm.value,
      loopEnabled: loopEnabled.value,
      loopStart: loopStart.value,
      loopEnd: loopEnd.value,
      tracks: arrangementTracks.value.map(t => ({
        synthName: t.synthName,
        muted: t.muted,
        solo: t.solo,
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

      // Ensure tracks exist
      for (const td of data.tracks) {
        const track = ensureSynthTrack(td.synthName)
        track.muted = td.muted
        track.solo = td.solo
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
      // Create a clip for this synth group
      const maxEnd = Math.max(...events.map(e => e.startTime + e.duration), 4)
      const clip = createClip(synthName, maxEnd, `${synthName} Clip`)

      for (const ev of events) {
        const frequency = ev.params.length > 1 ? ev.params[1] : 440
        const amplitude = ev.params.length > 0 ? ev.params[0] : 0.5

        clip.notes.push({
          id: generateId(),
          startTime: ev.startTime,
          duration: ev.duration,
          synthName: ev.synthName,
          frequency,
          amplitude,
          params: ev.params,
          paramNames: data.paramNames,
          selected: false,
          muted: false,
        })
      }

      // Place clip on arrangement
      const track = ensureSynthTrack(synthName)
      const tIdx = arrangementTracks.value.indexOf(track)
      addClipInstance(clip.id, tIdx, 0)

      // Also build legacy track
      const legacyTrack = getOrCreateTrack(synthName)
      legacyTrack.events = clip.notes

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
    let paramNames: string[] = []

    // Gather all notes from all clip instances in arrangement order
    for (const inst of clipInstances.value) {
      const clip = clips.value.find(c => c.id === inst.clipId)
      if (!clip) continue
      const track = arrangementTracks.value[inst.trackIndex]
      if (track?.muted) continue

      for (const note of clip.notes) {
        if (note.muted) continue
        if (paramNames.length === 0 && note.paramNames.length > 0) {
          paramNames = note.paramNames
        }
        events.push({
          type: '@',
          startTime: inst.startTime + note.startTime,
          duration: note.duration,
          synthName: note.synthName,
          params: note.params.length > 0 ? note.params : [note.amplitude, note.frequency],
        })
      }
    }

    const seqData: SynthSequenceData = {
      events,
      tempo: bpm.value,
      paramNames,
      comments: [],
    }

    return serializeSynthSequence(seqData)
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  function dispose() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
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

    // Detected synths
    detectedSynthClasses,

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
