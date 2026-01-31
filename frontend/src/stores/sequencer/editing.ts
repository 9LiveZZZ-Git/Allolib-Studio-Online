/**
 * Sequencer Editing Store
 *
 * Manages note CRUD, selection, clipboard operations,
 * edit mode, and view mode.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  type SequencerNote,
  type EditMode,
  type ViewMode,
  type ParameterLaneConfig,
  PARAM_DEFAULTS,
  generateId,
} from './types'
import { useSequencerClipsStore } from './clips'
import { useSequencerPlaybackStore } from './playback'

interface ClipboardContent {
  notes: SequencerNote[]
  sourceClipId: string
}

export const useSequencerEditingStore = defineStore('sequencer-editing', () => {
  // ─── State ─────────────────────────────────────────────────────────────────

  const editMode = ref<EditMode>('select')
  const viewMode = ref<ViewMode>('clipTimeline')

  // Parameter lanes configuration
  const parameterLanes = ref<ParameterLaneConfig[]>([])
  const parameterLanesVisible = ref(true)

  // Clipboard
  const clipboard = ref<ClipboardContent | null>(null)

  // ─── Computed ──────────────────────────────────────────────────────────────

  const clipsStore = useSequencerClipsStore()

  const selectedNotes = computed(() => {
    return clipsStore.activeClipNotes.filter(n => n.selected)
  })

  const selectedNoteCount = computed(() => selectedNotes.value.length)

  const hasSelection = computed(() => selectedNoteCount.value > 0)

  const hasClipboard = computed(() => clipboard.value !== null && clipboard.value.notes.length > 0)

  // ─── Edit/View Mode ────────────────────────────────────────────────────────

  function setEditMode(mode: EditMode): void {
    editMode.value = mode
  }

  function setViewMode(mode: ViewMode): void {
    viewMode.value = mode
  }

  // ─── Note CRUD ─────────────────────────────────────────────────────────────

  /**
   * Add a note to the active clip
   */
  function addNote(options: {
    startTime: number
    duration: number
    frequency: number
    amplitude?: number
    synthName?: string
    params?: number[]
    paramNames?: string[]
  }): SequencerNote | null {
    const clip = clipsStore.activeClip
    if (!clip) return null

    const playbackStore = useSequencerPlaybackStore()

    const note: SequencerNote = {
      id: generateId(),
      startTime: playbackStore.snapTime(options.startTime),
      duration: Math.max(0.1, options.duration),
      frequency: options.frequency,
      amplitude: options.amplitude ?? 0.5,
      synthName: options.synthName || clip.synthName,
      params: options.params || [],
      paramNames: options.paramNames || clip.paramNames,
      selected: false,
      muted: false,
    }

    clip.notes.push(note)
    clip.isDirty = true

    return note
  }

  /**
   * Add a note to a specific clip
   */
  function addNoteToClip(
    clipId: string,
    options: {
      startTime: number
      duration: number
      frequency: number
      amplitude?: number
      synthName?: string
      params?: number[]
      paramNames?: string[]
    }
  ): SequencerNote | null {
    const clip = clipsStore.getClip(clipId)
    if (!clip) return null

    const playbackStore = useSequencerPlaybackStore()

    const note: SequencerNote = {
      id: generateId(),
      startTime: playbackStore.snapTime(options.startTime),
      duration: Math.max(0.1, options.duration),
      frequency: options.frequency,
      amplitude: options.amplitude ?? 0.5,
      synthName: options.synthName || clip.synthName,
      params: options.params || [],
      paramNames: options.paramNames || clip.paramNames,
      selected: false,
      muted: false,
    }

    clip.notes.push(note)
    clip.isDirty = true

    return note
  }

  /**
   * Remove a note from the active clip
   */
  function removeNote(noteId: string): boolean {
    const clip = clipsStore.activeClip
    if (!clip) return false

    const index = clip.notes.findIndex(n => n.id === noteId)
    if (index === -1) return false

    clip.notes.splice(index, 1)
    clip.isDirty = true
    return true
  }

  /**
   * Update a note's properties
   */
  function updateNote(noteId: string, updates: Partial<SequencerNote>): void {
    const clip = clipsStore.activeClip
    if (!clip) return

    const note = clip.notes.find(n => n.id === noteId)
    if (!note) return

    Object.assign(note, updates)
    clip.isDirty = true
  }

  /**
   * Update a note's parameter value
   */
  function updateNoteParam(noteId: string, paramIndex: number, value: number): void {
    const clip = clipsStore.activeClip
    if (!clip) return

    const note = clip.notes.find(n => n.id === noteId)
    if (!note) return

    while (note.params.length <= paramIndex) {
      note.params.push(0)
    }
    note.params[paramIndex] = value
    clip.isDirty = true
  }

  /**
   * Get a note by ID from the active clip
   */
  function getNote(noteId: string): SequencerNote | undefined {
    return clipsStore.activeClipNotes.find(n => n.id === noteId)
  }

  // ─── Selection ─────────────────────────────────────────────────────────────

  function selectNote(noteId: string, additive: boolean = false): void {
    const clip = clipsStore.activeClip
    if (!clip) return

    if (!additive) {
      clip.notes.forEach(n => n.selected = false)
    }

    const note = clip.notes.find(n => n.id === noteId)
    if (note) {
      note.selected = true
    }
  }

  function deselectNote(noteId: string): void {
    const note = getNote(noteId)
    if (note) {
      note.selected = false
    }
  }

  function selectAllNotes(): void {
    const clip = clipsStore.activeClip
    if (!clip) return
    clip.notes.forEach(n => n.selected = true)
  }

  function deselectAllNotes(): void {
    const clip = clipsStore.activeClip
    if (!clip) return
    clip.notes.forEach(n => n.selected = false)
  }

  function toggleNoteSelection(noteId: string): void {
    const note = getNote(noteId)
    if (note) {
      note.selected = !note.selected
    }
  }

  /**
   * Select notes within a rectangular region
   */
  function selectNotesInRect(
    startTime: number,
    endTime: number,
    minFreq: number,
    maxFreq: number,
    additive: boolean = false
  ): void {
    const clip = clipsStore.activeClip
    if (!clip) return

    if (!additive) {
      clip.notes.forEach(n => n.selected = false)
    }

    const tMin = Math.min(startTime, endTime)
    const tMax = Math.max(startTime, endTime)
    const fMin = Math.min(minFreq, maxFreq)
    const fMax = Math.max(minFreq, maxFreq)

    for (const note of clip.notes) {
      const noteEnd = note.startTime + note.duration
      if (note.startTime < tMax && noteEnd > tMin &&
          note.frequency >= fMin && note.frequency <= fMax) {
        note.selected = true
      }
    }
  }

  function deleteSelectedNotes(): void {
    const clip = clipsStore.activeClip
    if (!clip) return

    clip.notes = clip.notes.filter(n => !n.selected)
    clip.isDirty = true
  }

  function muteSelectedNotes(): void {
    for (const note of selectedNotes.value) {
      note.muted = true
    }
    clipsStore.markDirty(clipsStore.activeClipId!)
  }

  function unmuteSelectedNotes(): void {
    for (const note of selectedNotes.value) {
      note.muted = false
    }
    clipsStore.markDirty(clipsStore.activeClipId!)
  }

  // ─── Clipboard Operations ──────────────────────────────────────────────────

  function copySelected(): void {
    if (!clipsStore.activeClipId || selectedNotes.value.length === 0) return

    clipboard.value = {
      notes: JSON.parse(JSON.stringify(selectedNotes.value)),
      sourceClipId: clipsStore.activeClipId,
    }
  }

  function cutSelected(): void {
    copySelected()
    deleteSelectedNotes()
  }

  function paste(atTime?: number): SequencerNote[] {
    if (!clipboard.value || !clipsStore.activeClip) return []

    const clip = clipsStore.activeClip
    const playbackStore = useSequencerPlaybackStore()

    // Find earliest note time in clipboard
    const minTime = Math.min(...clipboard.value.notes.map(n => n.startTime))

    // Calculate paste offset
    const pasteTime = atTime ?? playbackStore.playheadPosition
    const offset = pasteTime - minTime

    const pastedNotes: SequencerNote[] = []

    for (const note of clipboard.value.notes) {
      const newNote: SequencerNote = {
        ...JSON.parse(JSON.stringify(note)),
        id: generateId(),
        startTime: note.startTime + offset,
        selected: true,
      }
      clip.notes.push(newNote)
      pastedNotes.push(newNote)
    }

    // Deselect other notes
    clip.notes.forEach(n => {
      if (!pastedNotes.includes(n)) {
        n.selected = false
      }
    })

    clip.isDirty = true
    return pastedNotes
  }

  function duplicateSelected(): SequencerNote[] {
    if (!clipsStore.activeClip || selectedNotes.value.length === 0) return []

    // Find the rightmost edge of selection
    const maxEnd = Math.max(...selectedNotes.value.map(n => n.startTime + n.duration))

    const clip = clipsStore.activeClip
    const duplicatedNotes: SequencerNote[] = []

    for (const note of selectedNotes.value) {
      const newNote: SequencerNote = {
        ...JSON.parse(JSON.stringify(note)),
        id: generateId(),
        startTime: note.startTime + (maxEnd - Math.min(...selectedNotes.value.map(n => n.startTime))),
        selected: false,
      }
      clip.notes.push(newNote)
      duplicatedNotes.push(newNote)
    }

    // Select duplicated notes instead
    deselectAllNotes()
    duplicatedNotes.forEach(n => n.selected = true)

    clip.isDirty = true
    return duplicatedNotes
  }

  // ─── Note Movement ─────────────────────────────────────────────────────────

  function moveSelectedNotes(deltaTime: number, deltaFrequency: number): void {
    const playbackStore = useSequencerPlaybackStore()

    for (const note of selectedNotes.value) {
      note.startTime = Math.max(0, playbackStore.snapTime(note.startTime + deltaTime))
      if (deltaFrequency !== 0) {
        // Move by semitones
        const semitones = Math.round(deltaFrequency)
        note.frequency = note.frequency * Math.pow(2, semitones / 12)
      }
    }

    if (clipsStore.activeClipId) {
      clipsStore.markDirty(clipsStore.activeClipId)
    }
  }

  function resizeSelectedNotes(deltaDuration: number): void {
    for (const note of selectedNotes.value) {
      note.duration = Math.max(0.1, note.duration + deltaDuration)
    }

    if (clipsStore.activeClipId) {
      clipsStore.markDirty(clipsStore.activeClipId)
    }
  }

  // ─── Parameter Lanes ───────────────────────────────────────────────────────

  function rebuildParameterLanes(): void {
    const clip = clipsStore.activeClip
    if (!clip) {
      parameterLanes.value = []
      return
    }

    const paramNames = clip.paramNames || []
    const existingLanes = new Map(parameterLanes.value.map(l => [l.paramName, l]))

    parameterLanes.value = paramNames.map((name, idx) => {
      const existing = existingLanes.get(name)
      if (existing) return existing

      const defaults = PARAM_DEFAULTS[name] || { min: 0, max: 1 }
      return {
        paramIndex: idx,
        paramName: name,
        collapsed: true,
        min: defaults.min,
        max: defaults.max,
      }
    })
  }

  function toggleParameterLane(paramIndex: number): void {
    const lane = parameterLanes.value.find(l => l.paramIndex === paramIndex)
    if (lane) {
      lane.collapsed = !lane.collapsed
    }
  }

  function setParameterLaneRange(paramIndex: number, min: number, max: number): void {
    const lane = parameterLanes.value.find(l => l.paramIndex === paramIndex)
    if (lane) {
      lane.min = min
      lane.max = max
    }
  }

  function setParameterLanesVisible(visible: boolean): void {
    parameterLanesVisible.value = visible
  }

  // ─── Note Lookup ───────────────────────────────────────────────────────────

  function findNotesByFrequency(frequency: number, tolerance: number = 0.01): SequencerNote[] {
    return clipsStore.activeClipNotes.filter(n =>
      Math.abs(n.frequency - frequency) / frequency < tolerance
    )
  }

  function findNotesInTimeRange(startTime: number, endTime: number): SequencerNote[] {
    return clipsStore.activeClipNotes.filter(n =>
      n.startTime < endTime && n.startTime + n.duration > startTime
    )
  }

  return {
    // State
    editMode,
    viewMode,
    parameterLanes,
    parameterLanesVisible,
    clipboard,

    // Computed
    selectedNotes,
    selectedNoteCount,
    hasSelection,
    hasClipboard,

    // Edit/View Mode
    setEditMode,
    setViewMode,

    // Note CRUD
    addNote,
    addNoteToClip,
    removeNote,
    updateNote,
    updateNoteParam,
    getNote,

    // Selection
    selectNote,
    deselectNote,
    selectAllNotes,
    deselectAllNotes,
    toggleNoteSelection,
    selectNotesInRect,
    deleteSelectedNotes,
    muteSelectedNotes,
    unmuteSelectedNotes,

    // Clipboard
    copySelected,
    cutSelected,
    paste,
    duplicateSelected,

    // Movement
    moveSelectedNotes,
    resizeSelectedNotes,

    // Parameter Lanes
    rebuildParameterLanes,
    toggleParameterLane,
    setParameterLaneRange,
    setParameterLanesVisible,

    // Lookup
    findNotesByFrequency,
    findNotesInTimeRange,
  }
})
