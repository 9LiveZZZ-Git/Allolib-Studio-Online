/**
 * Sequencer Tracks Store
 *
 * Manages arrangement tracks: CRUD, mute/solo, expansion,
 * and automation lane configuration.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  type ArrangementTrack,
  type ParameterLaneConfig,
  TRACK_COLORS,
  PARAM_DEFAULTS,
  generateId,
} from './types'

export const useSequencerTracksStore = defineStore('sequencer-tracks', () => {
  // ─── State ─────────────────────────────────────────────────────────────────

  const tracks = ref<ArrangementTrack[]>([])

  // ─── Computed ──────────────────────────────────────────────────────────────

  const trackCount = computed(() => tracks.value.length)

  const hasSoloTrack = computed(() => tracks.value.some(t => t.solo))

  const activeTracks = computed(() => {
    if (hasSoloTrack.value) {
      return tracks.value.filter(t => t.solo && !t.muted)
    }
    return tracks.value.filter(t => !t.muted)
  })

  // ─── Track CRUD ────────────────────────────────────────────────────────────

  /**
   * Ensure a track exists at the given index, creating if needed
   */
  function ensureTrack(index: number): ArrangementTrack {
    while (tracks.value.length <= index) {
      const newTrack: ArrangementTrack = {
        id: generateId(),
        name: `Track ${tracks.value.length + 1}`,
        color: TRACK_COLORS[tracks.value.length % TRACK_COLORS.length],
        muted: false,
        solo: false,
        synthName: '',
        expanded: false,
        automationLanes: [],
      }
      tracks.value.push(newTrack)
    }
    return tracks.value[index]
  }

  /**
   * Ensure a track exists for a specific synth
   */
  function ensureSynthTrack(synthName: string): ArrangementTrack {
    let track = tracks.value.find(t => t.synthName === synthName)
    if (!track) {
      track = {
        id: generateId(),
        name: synthName,
        color: TRACK_COLORS[tracks.value.length % TRACK_COLORS.length],
        muted: false,
        solo: false,
        synthName,
        expanded: false,
        automationLanes: [],
      }
      tracks.value.push(track)
    }
    return track
  }

  /**
   * Create a new track
   */
  function createTrack(synthName: string = '', name?: string): ArrangementTrack {
    const track: ArrangementTrack = {
      id: generateId(),
      name: name || synthName || `Track ${tracks.value.length + 1}`,
      color: TRACK_COLORS[tracks.value.length % TRACK_COLORS.length],
      muted: false,
      solo: false,
      synthName,
      expanded: false,
      automationLanes: [],
    }
    tracks.value.push(track)
    return track
  }

  /**
   * Delete a track by index
   */
  function deleteTrack(index: number): boolean {
    if (index < 0 || index >= tracks.value.length) return false
    tracks.value.splice(index, 1)
    return true
  }

  /**
   * Delete a track by ID
   */
  function deleteTrackById(trackId: string): boolean {
    const index = tracks.value.findIndex(t => t.id === trackId)
    if (index === -1) return false
    return deleteTrack(index)
  }

  /**
   * Get track by ID
   */
  function getTrack(trackId: string): ArrangementTrack | undefined {
    return tracks.value.find(t => t.id === trackId)
  }

  /**
   * Get track by index
   */
  function getTrackByIndex(index: number): ArrangementTrack | undefined {
    return tracks.value[index]
  }

  /**
   * Get track index by ID
   */
  function getTrackIndex(trackId: string): number {
    return tracks.value.findIndex(t => t.id === trackId)
  }

  // ─── Mute/Solo ─────────────────────────────────────────────────────────────

  function toggleMute(trackId: string): void {
    const track = getTrack(trackId)
    if (track) {
      track.muted = !track.muted
    }
  }

  function toggleSolo(trackId: string): void {
    const track = getTrack(trackId)
    if (track) {
      track.solo = !track.solo
    }
  }

  function setMute(trackId: string, muted: boolean): void {
    const track = getTrack(trackId)
    if (track) {
      track.muted = muted
    }
  }

  function setSolo(trackId: string, solo: boolean): void {
    const track = getTrack(trackId)
    if (track) {
      track.solo = solo
    }
  }

  function muteAll(): void {
    tracks.value.forEach(t => t.muted = true)
  }

  function unmuteAll(): void {
    tracks.value.forEach(t => t.muted = false)
  }

  function clearSolo(): void {
    tracks.value.forEach(t => t.solo = false)
  }

  // ─── Expansion ─────────────────────────────────────────────────────────────

  function toggleExpanded(trackIndex: number): void {
    const track = tracks.value[trackIndex]
    if (track) {
      track.expanded = !track.expanded
    }
  }

  function setExpanded(trackIndex: number, expanded: boolean): void {
    const track = tracks.value[trackIndex]
    if (track) {
      track.expanded = expanded
    }
  }

  function expandAll(): void {
    tracks.value.forEach(t => t.expanded = true)
  }

  function collapseAll(): void {
    tracks.value.forEach(t => t.expanded = false)
  }

  // ─── Automation Lanes ──────────────────────────────────────────────────────

  /**
   * Toggle visibility of an automation lane
   */
  function toggleAutomationLane(trackIndex: number, paramName: string): void {
    const track = tracks.value[trackIndex]
    if (!track) return

    const lane = track.automationLanes.find(l => l.paramName === paramName)
    if (lane) {
      lane.collapsed = !lane.collapsed
    }
  }

  /**
   * Set automation lane range
   */
  function setAutomationLaneRange(
    trackIndex: number,
    paramName: string,
    min: number,
    max: number
  ): void {
    const track = tracks.value[trackIndex]
    if (!track) return

    const lane = track.automationLanes.find(l => l.paramName === paramName)
    if (lane) {
      lane.min = min
      lane.max = max
    }
  }

  /**
   * Rebuild automation lanes for a track based on clips
   */
  function rebuildAutomationLanes(
    trackIndex: number,
    paramNames: string[]
  ): void {
    const track = tracks.value[trackIndex]
    if (!track) return

    // Get unique param names
    const uniqueParams = [...new Set(paramNames)]

    // Keep existing lane configs, add new ones
    const existingLanes = new Map(
      track.automationLanes.map(l => [l.paramName, l])
    )

    track.automationLanes = uniqueParams.map((paramName, idx) => {
      const existing = existingLanes.get(paramName)
      if (existing) return existing

      const defaults = PARAM_DEFAULTS[paramName] || { min: 0, max: 1 }
      return {
        paramIndex: idx,
        paramName,
        collapsed: true,
        min: defaults.min,
        max: defaults.max,
      }
    })
  }

  // ─── Track Height Calculations ─────────────────────────────────────────────

  /**
   * Calculate total height of a track including automation lanes
   */
  function getTrackTotalHeight(
    trackIndex: number,
    baseHeight: number,
    laneHeight: number,
    collapsedHeight: number
  ): number {
    const track = tracks.value[trackIndex]
    if (!track || !track.expanded) return baseHeight

    let height = baseHeight
    for (const lane of track.automationLanes) {
      height += lane.collapsed ? collapsedHeight : laneHeight
    }
    return height
  }

  /**
   * Calculate Y offset for a track
   */
  function getTrackYOffset(
    trackIndex: number,
    baseHeight: number,
    laneHeight: number,
    collapsedHeight: number,
    rulerHeight: number
  ): number {
    let y = rulerHeight
    for (let i = 0; i < trackIndex; i++) {
      y += getTrackTotalHeight(i, baseHeight, laneHeight, collapsedHeight)
    }
    return y
  }

  // ─── Reorder ───────────────────────────────────────────────────────────────

  function reorderTrack(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= tracks.value.length) return
    if (toIndex < 0 || toIndex >= tracks.value.length) return
    if (fromIndex === toIndex) return

    const [track] = tracks.value.splice(fromIndex, 1)
    tracks.value.splice(toIndex, 0, track)
  }

  // ─── Serialization ─────────────────────────────────────────────────────────

  function toJSON(): ArrangementTrack[] {
    return JSON.parse(JSON.stringify(tracks.value))
  }

  function fromJSON(data: ArrangementTrack[]): void {
    tracks.value = data
  }

  function clear(): void {
    tracks.value = []
  }

  return {
    // State
    tracks,

    // Computed
    trackCount,
    hasSoloTrack,
    activeTracks,

    // CRUD
    ensureTrack,
    ensureSynthTrack,
    createTrack,
    deleteTrack,
    deleteTrackById,
    getTrack,
    getTrackByIndex,
    getTrackIndex,

    // Mute/Solo
    toggleMute,
    toggleSolo,
    setMute,
    setSolo,
    muteAll,
    unmuteAll,
    clearSolo,

    // Expansion
    toggleExpanded,
    setExpanded,
    expandAll,
    collapseAll,

    // Automation Lanes
    toggleAutomationLane,
    setAutomationLaneRange,
    rebuildAutomationLanes,

    // Height Calculations
    getTrackTotalHeight,
    getTrackYOffset,

    // Reorder
    reorderTrack,

    // Serialization
    toJSON,
    fromJSON,
    clear,
  }
})
