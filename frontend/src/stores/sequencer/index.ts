/**
 * Sequencer Store - Unified Facade
 *
 * This is a backward-compatible facade that composes the split sequencer stores:
 * - tracks: Track management (CRUD, mute/solo, expansion)
 * - clips: Clip management (CRUD, instances, automation)
 * - playback: Transport, BPM, loop, viewport
 * - editing: Notes, selection, clipboard, edit mode
 *
 * Existing code can continue using `useSequencerStore()` and get
 * all functionality. New code can use individual stores for
 * better tree-shaking and code organization.
 */

import { defineStore, storeToRefs } from 'pinia'
import { computed } from 'vue'

// Import sub-stores
import { useSequencerTracksStore } from './tracks'
import { useSequencerClipsStore } from './clips'
import { useSequencerPlaybackStore } from './playback'
import { useSequencerEditingStore } from './editing'

// Re-export types
export * from './types'

// Re-export sub-stores for direct access
export { useSequencerTracksStore } from './tracks'
export { useSequencerClipsStore } from './clips'
export { useSequencerPlaybackStore } from './playback'
export { useSequencerEditingStore } from './editing'

// ─── Unified Facade Store ────────────────────────────────────────────────────

export const useSequencerStore = defineStore('sequencer', () => {
  // Get sub-stores
  const tracksStore = useSequencerTracksStore()
  const clipsStore = useSequencerClipsStore()
  const playbackStore = useSequencerPlaybackStore()
  const editingStore = useSequencerEditingStore()

  // ─── Backward Compatible State ─────────────────────────────────────────────

  // These are computed refs that point to the sub-store state
  const tracks = computed(() => tracksStore.tracks)
  const arrangementTracks = computed(() => tracksStore.tracks)
  const clips = computed(() => clipsStore.clips)
  const clipInstances = computed(() => clipsStore.clipInstances)
  const activeClipId = computed(() => clipsStore.activeClipId)
  const activeClip = computed(() => clipsStore.activeClip)
  const activeClipNotes = computed(() => clipsStore.activeClipNotes)

  const transport = computed(() => playbackStore.transport)
  const playheadPosition = computed(() => playbackStore.playheadPosition)
  const bpm = computed(() => playbackStore.bpm)
  const loopEnabled = computed(() => playbackStore.loopEnabled)
  const loopStart = computed(() => playbackStore.loopStart)
  const loopEnd = computed(() => playbackStore.loopEnd)
  const snapMode = computed(() => playbackStore.snapMode)
  const viewport = computed(() => playbackStore.viewport)
  const clipViewport = computed(() => playbackStore.clipViewport)

  const editMode = computed(() => editingStore.editMode)
  const viewMode = computed(() => editingStore.viewMode)
  const selectedNotes = computed(() => editingStore.selectedNotes)
  const parameterLanes = computed(() => editingStore.parameterLanes)
  const parameterLanesVisible = computed(() => editingStore.parameterLanesVisible)

  // ─── Legacy Computed Properties ────────────────────────────────────────────

  const selectedClipInstanceIds = computed(() => clipsStore.selectedClipInstanceIds)
  const selectedNoteCount = computed(() => editingStore.selectedNoteCount)
  const hasSelection = computed(() => editingStore.hasSelection)

  // ─── Backward Compatible Methods ───────────────────────────────────────────

  // Track methods
  const ensureTrack = tracksStore.ensureTrack
  const ensureSynthTrack = tracksStore.ensureSynthTrack
  const toggleTrackMute = (trackId: string) => tracksStore.toggleMute(trackId)
  const toggleTrackSolo = (trackId: string) => tracksStore.toggleSolo(trackId)
  const toggleTrackExpanded = (trackIndex: number) => tracksStore.toggleExpanded(trackIndex)
  const toggleTrackAutomationLane = tracksStore.toggleAutomationLane
  const deleteTrack = tracksStore.deleteTrack
  const getTrackTotalHeight = tracksStore.getTrackTotalHeight
  const getTrackYOffset = tracksStore.getTrackYOffset
  const rebuildTrackAutomationLanes = tracksStore.rebuildAutomationLanes

  // Clip methods
  const createClip = clipsStore.createClip
  const duplicateClip = clipsStore.duplicateClip
  const deleteClip = clipsStore.deleteClip
  const setActiveClip = clipsStore.setActiveClip
  const getClip = clipsStore.getClip
  const addClipInstance = clipsStore.addClipInstance
  const removeClipInstance = clipsStore.removeClipInstance
  const moveClipInstance = clipsStore.moveClipInstance
  const selectClipInstance = clipsStore.selectClipInstance
  const deselectAllClipInstances = clipsStore.deselectAllClipInstances
  const deleteSelectedClipInstances = clipsStore.deleteSelectedClipInstances
  const getClipInstancesForTrack = (trackId: string) => clipsStore.getInstancesForTrackId(trackId)
  const addAutomationPoint = clipsStore.addAutomationPoint
  const removeAutomationPoint = clipsStore.removeAutomationPoint
  const moveAutomationPoint = clipsStore.moveAutomationPoint
  const clipAutomationToNewDuration = clipsStore.clipAutomationToNewDuration

  // Playback methods
  const play = playbackStore.play
  const pause = playbackStore.pause
  const stop = playbackStore.stop
  const setPosition = playbackStore.setPosition
  const toggleLoop = playbackStore.toggleLoop
  const setBPM = playbackStore.setBPM
  const getSnapInterval = playbackStore.getSnapInterval
  const snapTime = playbackStore.snapTime
  const connectRuntime = playbackStore.connectRuntime
  const disconnectRuntime = playbackStore.disconnectRuntime
  const releaseAllVoices = playbackStore.releaseAllVoices

  // Editing methods
  const addNote = editingStore.addNote
  const removeNote = editingStore.removeNote
  const updateNote = editingStore.updateNote
  const updateNoteParam = editingStore.updateNoteParam
  const deleteSelectedNotes = editingStore.deleteSelectedNotes
  const selectAllNotes = editingStore.selectAllNotes
  const deselectAllNotes = editingStore.deselectAllNotes
  const selectNotesInRect = editingStore.selectNotesInRect
  const copySelected = editingStore.copySelected
  const cutSelected = editingStore.cutSelected
  const paste = editingStore.paste
  const rebuildParameterLanes = editingStore.rebuildParameterLanes
  const toggleParameterLane = editingStore.toggleParameterLane
  const setParameterLaneRange = editingStore.setParameterLaneRange
  const findNotesByFrequency = editingStore.findNotesByFrequency

  // Legacy aliases
  const addEvent = addNote
  const removeEvent = removeNote
  const updateEvent = updateNote
  const deleteSelected = deleteSelectedNotes
  const selectAll = selectAllNotes
  const deselectAll = deselectAllNotes
  const selectEventsInRect = selectNotesInRect

  // ─── Serialization ─────────────────────────────────────────────────────────

  function toJSON() {
    return {
      tracks: tracksStore.toJSON(),
      ...clipsStore.toJSON(),
      playback: {
        bpm: playbackStore.bpm,
        loopEnabled: playbackStore.loopEnabled,
        loopStart: playbackStore.loopStart,
        loopEnd: playbackStore.loopEnd,
        snapMode: playbackStore.snapMode,
      },
    }
  }

  function fromJSON(data: any) {
    if (data.tracks) {
      tracksStore.fromJSON(data.tracks)
    }
    if (data.clips) {
      clipsStore.fromJSON({
        clips: data.clips,
        clipInstances: data.clipInstances || [],
        activeClipId: data.activeClipId,
      })
    }
    if (data.playback) {
      playbackStore.bpm = data.playback.bpm ?? 120
      playbackStore.loopEnabled = data.playback.loopEnabled ?? false
      playbackStore.loopStart = data.playback.loopStart ?? 0
      playbackStore.loopEnd = data.playback.loopEnd ?? 8
      if (data.playback.snapMode) {
        playbackStore.snapMode = data.playback.snapMode
      }
    }
  }

  function clear() {
    tracksStore.clear()
    clipsStore.clear()
    playbackStore.stop()
  }

  function dispose() {
    playbackStore.dispose()
    clear()
  }

  // ─── Return All Methods ────────────────────────────────────────────────────

  return {
    // State (computed from sub-stores)
    tracks,
    arrangementTracks,
    clips,
    clipInstances,
    activeClipId,
    activeClip,
    activeClipNotes,
    transport,
    playheadPosition,
    bpm,
    loopEnabled,
    loopStart,
    loopEnd,
    snapMode,
    viewport,
    clipViewport,
    editMode,
    viewMode,
    selectedNotes,
    parameterLanes,
    parameterLanesVisible,
    selectedClipInstanceIds,
    selectedNoteCount,
    hasSelection,

    // Track methods
    ensureTrack,
    ensureSynthTrack,
    toggleTrackMute,
    toggleTrackSolo,
    toggleTrackExpanded,
    toggleTrackAutomationLane,
    deleteTrack,
    getTrackTotalHeight,
    getTrackYOffset,
    rebuildTrackAutomationLanes,

    // Clip methods
    createClip,
    duplicateClip,
    deleteClip,
    setActiveClip,
    getClip,
    addClipInstance,
    removeClipInstance,
    moveClipInstance,
    selectClipInstance,
    deselectAllClipInstances,
    deleteSelectedClipInstances,
    getClipInstancesForTrack,
    addAutomationPoint,
    removeAutomationPoint,
    moveAutomationPoint,
    clipAutomationToNewDuration,

    // Playback methods
    play,
    pause,
    stop,
    setPosition,
    toggleLoop,
    setBPM,
    getSnapInterval,
    snapTime,
    connectRuntime,
    disconnectRuntime,
    releaseAllVoices,

    // Editing methods
    addNote,
    removeNote,
    updateNote,
    updateNoteParam,
    deleteSelectedNotes,
    selectAllNotes,
    deselectAllNotes,
    selectNotesInRect,
    copySelected,
    cutSelected,
    paste,
    rebuildParameterLanes,
    toggleParameterLane,
    setParameterLaneRange,
    findNotesByFrequency,

    // Legacy aliases
    addEvent,
    removeEvent,
    updateEvent,
    deleteSelected,
    selectAll,
    deselectAll,
    selectEventsInRect,

    // Serialization
    toJSON,
    fromJSON,
    clear,
    dispose,

    // Sub-store access (for new code)
    $tracks: tracksStore,
    $clips: clipsStore,
    $playback: playbackStore,
    $editing: editingStore,
  }
})
