/**
 * Sequencer Clips Store
 *
 * Manages clip CRUD, clip instances on the arrangement,
 * and clip-level automation.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  type SequencerClip,
  type ClipInstance,
  type ClipAutomation,
  type AutomationPoint,
  type SequencerNote,
  CLIP_COLORS,
  generateId,
} from './types'
import { useSequencerTracksStore } from './tracks'

export const useSequencerClipsStore = defineStore('sequencer-clips', () => {
  // ─── State ─────────────────────────────────────────────────────────────────

  const clips = ref<SequencerClip[]>([])
  const clipInstances = ref<ClipInstance[]>([])
  const activeClipId = ref<string | null>(null)
  const selectedClipInstanceIds = ref<Set<string>>(new Set())

  // ─── Computed ──────────────────────────────────────────────────────────────

  const activeClip = computed(() => {
    if (!activeClipId.value) return null
    return clips.value.find(c => c.id === activeClipId.value) || null
  })

  const activeClipNotes = computed(() => {
    return activeClip.value?.notes || []
  })

  const clipCount = computed(() => clips.value.length)

  const instanceCount = computed(() => clipInstances.value.length)

  // ─── Clip CRUD ─────────────────────────────────────────────────────────────

  /**
   * Create a new clip
   */
  function createClip(options: {
    name?: string
    synthName: string
    duration?: number
    filePath?: string | null
    paramNames?: string[]
    notes?: SequencerNote[]
  }): SequencerClip {
    const clip: SequencerClip = {
      id: generateId(),
      name: options.name || `Clip ${clips.value.length + 1}`,
      duration: options.duration || 4,
      color: CLIP_COLORS[clips.value.length % CLIP_COLORS.length],
      notes: options.notes || [],
      synthName: options.synthName,
      paramNames: options.paramNames || [],
      filePath: options.filePath ?? null,
      isDirty: false,
      automation: [],
    }

    clips.value.push(clip)
    return clip
  }

  /**
   * Get a clip by ID
   */
  function getClip(clipId: string): SequencerClip | undefined {
    return clips.value.find(c => c.id === clipId)
  }

  /**
   * Duplicate a clip
   */
  function duplicateClip(clipId: string): SequencerClip | null {
    const source = getClip(clipId)
    if (!source) return null

    const newClip: SequencerClip = {
      ...JSON.parse(JSON.stringify(source)),
      id: generateId(),
      name: `${source.name} (copy)`,
      filePath: null,
      isDirty: true,
    }

    // Regenerate note IDs
    for (const note of newClip.notes) {
      note.id = generateId()
    }

    clips.value.push(newClip)
    return newClip
  }

  /**
   * Delete a clip and all its instances
   */
  function deleteClip(clipId: string): boolean {
    const index = clips.value.findIndex(c => c.id === clipId)
    if (index === -1) return false

    // Remove all instances of this clip
    clipInstances.value = clipInstances.value.filter(i => i.clipId !== clipId)

    // Clear selection if this clip was active
    if (activeClipId.value === clipId) {
      activeClipId.value = null
    }

    clips.value.splice(index, 1)
    return true
  }

  /**
   * Set the active clip for editing
   */
  function setActiveClip(clipId: string | null): void {
    activeClipId.value = clipId
  }

  /**
   * Update clip properties
   */
  function updateClip(clipId: string, updates: Partial<SequencerClip>): void {
    const clip = getClip(clipId)
    if (!clip) return

    Object.assign(clip, updates)
    clip.isDirty = true
  }

  /**
   * Mark clip as dirty (modified)
   */
  function markDirty(clipId: string): void {
    const clip = getClip(clipId)
    if (clip) {
      clip.isDirty = true
    }
  }

  /**
   * Mark clip as clean (saved)
   */
  function markClean(clipId: string): void {
    const clip = getClip(clipId)
    if (clip) {
      clip.isDirty = false
    }
  }

  // ─── Clip Instances ────────────────────────────────────────────────────────

  /**
   * Add a clip instance to the arrangement
   */
  function addClipInstance(
    clipId: string,
    trackIndex: number,
    startTime: number
  ): ClipInstance {
    const tracksStore = useSequencerTracksStore()
    tracksStore.ensureTrack(trackIndex)

    const instance: ClipInstance = {
      id: generateId(),
      clipId,
      trackIndex,
      startTime,
    }

    clipInstances.value.push(instance)
    return instance
  }

  /**
   * Remove a clip instance
   */
  function removeClipInstance(instanceId: string): boolean {
    const index = clipInstances.value.findIndex(i => i.id === instanceId)
    if (index === -1) return false

    clipInstances.value.splice(index, 1)
    selectedClipInstanceIds.value.delete(instanceId)
    return true
  }

  /**
   * Move a clip instance
   */
  function moveClipInstance(
    instanceId: string,
    startTime: number,
    trackIndex?: number
  ): void {
    const instance = clipInstances.value.find(i => i.id === instanceId)
    if (!instance) return

    instance.startTime = Math.max(0, startTime)
    if (trackIndex !== undefined) {
      const tracksStore = useSequencerTracksStore()
      tracksStore.ensureTrack(trackIndex)
      instance.trackIndex = trackIndex
    }
  }

  /**
   * Get clip instances for a track
   */
  function getInstancesForTrack(trackIndex: number): ClipInstance[] {
    return clipInstances.value.filter(i => i.trackIndex === trackIndex)
  }

  /**
   * Get clip instances for a track by ID
   */
  function getInstancesForTrackId(trackId: string): ClipInstance[] {
    const tracksStore = useSequencerTracksStore()
    const index = tracksStore.getTrackIndex(trackId)
    if (index === -1) return []
    return getInstancesForTrack(index)
  }

  // ─── Instance Selection ────────────────────────────────────────────────────

  function selectClipInstance(instanceId: string, additive: boolean = false): void {
    if (!additive) {
      selectedClipInstanceIds.value.clear()
    }
    selectedClipInstanceIds.value.add(instanceId)
  }

  function deselectClipInstance(instanceId: string): void {
    selectedClipInstanceIds.value.delete(instanceId)
  }

  function deselectAllClipInstances(): void {
    selectedClipInstanceIds.value.clear()
  }

  function isClipInstanceSelected(instanceId: string): boolean {
    return selectedClipInstanceIds.value.has(instanceId)
  }

  function deleteSelectedClipInstances(): void {
    for (const id of selectedClipInstanceIds.value) {
      removeClipInstance(id)
    }
    selectedClipInstanceIds.value.clear()
  }

  // ─── Clip Automation ───────────────────────────────────────────────────────

  /**
   * Add an automation point to a clip
   */
  function addAutomationPoint(
    clipId: string,
    paramName: string,
    time: number,
    value: number
  ): AutomationPoint | null {
    const clip = getClip(clipId)
    if (!clip) return null

    let automation = clip.automation.find(a => a.paramName === paramName)
    if (!automation) {
      automation = { paramName, points: [] }
      clip.automation.push(automation)
    }

    const point: AutomationPoint = {
      id: generateId(),
      time,
      value,
    }

    automation.points.push(point)
    automation.points.sort((a, b) => a.time - b.time)
    clip.isDirty = true

    return point
  }

  /**
   * Remove an automation point
   */
  function removeAutomationPoint(
    clipId: string,
    paramName: string,
    pointId: string
  ): boolean {
    const clip = getClip(clipId)
    if (!clip) return false

    const automation = clip.automation.find(a => a.paramName === paramName)
    if (!automation) return false

    const index = automation.points.findIndex(p => p.id === pointId)
    if (index === -1) return false

    automation.points.splice(index, 1)
    clip.isDirty = true
    return true
  }

  /**
   * Move an automation point
   */
  function moveAutomationPoint(
    clipId: string,
    paramName: string,
    pointId: string,
    time: number,
    value: number
  ): void {
    const clip = getClip(clipId)
    if (!clip) return

    const automation = clip.automation.find(a => a.paramName === paramName)
    if (!automation) return

    const point = automation.points.find(p => p.id === pointId)
    if (!point) return

    point.time = Math.max(0, Math.min(clip.duration, time))
    point.value = value
    automation.points.sort((a, b) => a.time - b.time)
    clip.isDirty = true
  }

  /**
   * Get automation value at a time
   */
  function getAutomationValue(
    clipId: string,
    paramName: string,
    time: number
  ): number | null {
    const clip = getClip(clipId)
    if (!clip) return null

    const automation = clip.automation.find(a => a.paramName === paramName)
    if (!automation || automation.points.length === 0) return null

    const points = automation.points

    // Before first point
    if (time <= points[0].time) return points[0].value

    // After last point
    if (time >= points[points.length - 1].time) {
      return points[points.length - 1].value
    }

    // Interpolate between points
    for (let i = 0; i < points.length - 1; i++) {
      if (time >= points[i].time && time < points[i + 1].time) {
        const t = (time - points[i].time) / (points[i + 1].time - points[i].time)
        return points[i].value + (points[i + 1].value - points[i].value) * t
      }
    }

    return null
  }

  /**
   * Adjust automation to new clip duration
   */
  function clipAutomationToNewDuration(clipId: string, newDuration: number): void {
    const clip = getClip(clipId)
    if (!clip) return

    for (const automation of clip.automation) {
      automation.points = automation.points.filter(p => p.time <= newDuration)
    }
    clip.duration = newDuration
    clip.isDirty = true
  }

  // ─── Arrangement Duration ──────────────────────────────────────────────────

  const arrangementDuration = computed(() => {
    let maxEnd = 0
    for (const instance of clipInstances.value) {
      const clip = getClip(instance.clipId)
      if (clip) {
        maxEnd = Math.max(maxEnd, instance.startTime + clip.duration)
      }
    }
    return Math.max(maxEnd, 60) // Minimum 60 seconds
  })

  // ─── Serialization ─────────────────────────────────────────────────────────

  function toJSON(): {
    clips: SequencerClip[]
    clipInstances: ClipInstance[]
    activeClipId: string | null
  } {
    return {
      clips: JSON.parse(JSON.stringify(clips.value)),
      clipInstances: JSON.parse(JSON.stringify(clipInstances.value)),
      activeClipId: activeClipId.value,
    }
  }

  function fromJSON(data: {
    clips: SequencerClip[]
    clipInstances: ClipInstance[]
    activeClipId?: string | null
  }): void {
    clips.value = data.clips
    clipInstances.value = data.clipInstances
    activeClipId.value = data.activeClipId ?? null
    selectedClipInstanceIds.value.clear()
  }

  function clear(): void {
    clips.value = []
    clipInstances.value = []
    activeClipId.value = null
    selectedClipInstanceIds.value.clear()
  }

  return {
    // State
    clips,
    clipInstances,
    activeClipId,
    selectedClipInstanceIds,

    // Computed
    activeClip,
    activeClipNotes,
    clipCount,
    instanceCount,
    arrangementDuration,

    // Clip CRUD
    createClip,
    getClip,
    duplicateClip,
    deleteClip,
    setActiveClip,
    updateClip,
    markDirty,
    markClean,

    // Clip Instances
    addClipInstance,
    removeClipInstance,
    moveClipInstance,
    getInstancesForTrack,
    getInstancesForTrackId,

    // Instance Selection
    selectClipInstance,
    deselectClipInstance,
    deselectAllClipInstances,
    isClipInstanceSelected,
    deleteSelectedClipInstances,

    // Automation
    addAutomationPoint,
    removeAutomationPoint,
    moveAutomationPoint,
    getAutomationValue,
    clipAutomationToNewDuration,

    // Serialization
    toJSON,
    fromJSON,
    clear,
  }
})
