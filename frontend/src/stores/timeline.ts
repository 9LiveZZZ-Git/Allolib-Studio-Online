/**
 * Timeline Store
 *
 * Orchestrates the unified timeline with all track categories:
 * - ♫ Audio (synth tracks from sequencer)
 * - ◈ Objects (visual entities)
 * - ◐ Environment (global scene settings)
 * - ⚡ Events (camera, markers, scripts)
 *
 * This store manages:
 * - Section collapse/expand state
 * - Unified playhead position
 * - Track category visibility
 * - Color coding per category
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSequencerStore } from './sequencer'
import { useObjectsStore } from './objects'
import { useEnvironmentStore } from './environment'

// ─── Track Category Types ────────────────────────────────────────────────────

export type TrackCategory = 'audio' | 'objects' | 'environment' | 'events'

export interface TrackCategoryConfig {
  id: TrackCategory
  label: string
  icon: string
  color: string
  headerColor: string
  trackBg: string
  accentColor: string
  collapsed: boolean
  visible: boolean
}

// ─── Category Color Schemes ──────────────────────────────────────────────────

const CATEGORY_COLORS: Record<TrackCategory, {
  color: string
  headerColor: string
  trackBg: string
  accentColor: string
}> = {
  audio: {
    color: '#9F7AEA',      // Purple
    headerColor: '#6B46C1',
    trackBg: '#2D1F4E',
    accentColor: '#B794F4',
  },
  objects: {
    color: '#63B3ED',      // Blue
    headerColor: '#2B6CB0',
    trackBg: '#1A365D',
    accentColor: '#90CDF4',
  },
  environment: {
    color: '#68D391',      // Green
    headerColor: '#276749',
    trackBg: '#1C4532',
    accentColor: '#9AE6B4',
  },
  events: {
    color: '#F6AD55',      // Orange
    headerColor: '#C05621',
    trackBg: '#652B19',
    accentColor: '#FBD38D',
  },
}

// ─── Store Definition ────────────────────────────────────────────────────────

export const useTimelineStore = defineStore('timeline', () => {
  // ─── State ─────────────────────────────────────────────────────────────────

  // Duration in seconds
  const duration = ref(60)

  // Mode: animation (linear playback) or interactive (game-like)
  const mode = ref<'animation' | 'interactive'>('animation')

  // Get sequencer store - it owns the actual playhead (has audio timing logic)
  const sequencer = useSequencerStore()

  // Current playhead position - computed from sequencer (single source of truth)
  // The sequencer controls audio timing, so it's the master for playhead position
  const currentTime = computed(() => sequencer.playheadPosition)

  // Playing state - computed from sequencer transport
  const playing = computed(() => sequencer.transport === 'playing')

  // Track category configurations
  const categories = ref<TrackCategoryConfig[]>([
    {
      id: 'audio',
      label: 'Audio',
      icon: '♫',
      collapsed: false,
      visible: true,
      ...CATEGORY_COLORS.audio,
    },
    {
      id: 'objects',
      label: 'Objects',
      icon: '◈',
      collapsed: false,
      visible: true,
      ...CATEGORY_COLORS.objects,
    },
    {
      id: 'environment',
      label: 'Environment',
      icon: '◐',
      collapsed: false,
      visible: true,
      ...CATEGORY_COLORS.environment,
    },
    {
      id: 'events',
      label: 'Events',
      icon: '⚡',
      collapsed: false,
      visible: true,
      ...CATEGORY_COLORS.events,
    },
  ])

  // Viewport state for the timeline
  const viewport = ref({
    scrollX: 0,
    scrollY: 0,
    zoomX: 50, // pixels per second
  })

  // ─── Computed ──────────────────────────────────────────────────────────────

  const objectsStore = useObjectsStore()
  const environmentStore = useEnvironmentStore()

  // Get category by ID
  const getCategory = computed(() => {
    return (id: TrackCategory) => categories.value.find(c => c.id === id)
  })

  // Audio track count
  const audioTrackCount = computed(() => sequencer.arrangementTracks.length)

  // Object track count
  const objectTrackCount = computed(() => objectsStore.objectList.length)

  // Visible categories
  const visibleCategories = computed(() =>
    categories.value.filter(c => c.visible)
  )

  // Expanded categories
  const expandedCategories = computed(() =>
    categories.value.filter(c => !c.collapsed)
  )

  // ─── Actions ───────────────────────────────────────────────────────────────

  /**
   * Toggle section collapse state
   */
  function toggleSection(categoryId: TrackCategory): void {
    const cat = categories.value.find(c => c.id === categoryId)
    if (cat) {
      cat.collapsed = !cat.collapsed
      console.log(`[Timeline] ${categoryId} section ${cat.collapsed ? 'collapsed' : 'expanded'}`)
    }
  }

  /**
   * Set section collapse state
   */
  function setSectionCollapsed(categoryId: TrackCategory, collapsed: boolean): void {
    const cat = categories.value.find(c => c.id === categoryId)
    if (cat) {
      cat.collapsed = collapsed
    }
  }

  /**
   * Toggle section visibility
   */
  function toggleSectionVisibility(categoryId: TrackCategory): void {
    const cat = categories.value.find(c => c.id === categoryId)
    if (cat) {
      cat.visible = !cat.visible
    }
  }

  /**
   * Collapse all sections
   */
  function collapseAll(): void {
    categories.value.forEach(c => c.collapsed = true)
  }

  /**
   * Expand all sections
   */
  function expandAll(): void {
    categories.value.forEach(c => c.collapsed = false)
  }

  // ─── Transport Controls ────────────────────────────────────────────────────
  // Note: currentTime and playing are computed from sequencer (single source of truth)

  /**
   * Play the timeline (forwards to sequencer)
   */
  function play(): void {
    sequencer.play()
    console.log('[Timeline] Play')
  }

  /**
   * Pause the timeline (forwards to sequencer)
   */
  function pause(): void {
    sequencer.pause()
    console.log('[Timeline] Pause')
  }

  /**
   * Stop and reset to beginning (forwards to sequencer)
   */
  function stop(): void {
    sequencer.stop()
    console.log('[Timeline] Stop')
  }

  /**
   * Seek to a specific time (forwards to sequencer)
   * @param time Time in seconds
   * @param snap If true, snap to the current snap grid
   */
  function seek(time: number, snap: boolean = false): void {
    let targetTime = time
    if (snap) {
      targetTime = snapTime(time)
    }
    const clampedTime = Math.max(0, Math.min(targetTime, duration.value))
    sequencer.setPosition(clampedTime)
  }

  /**
   * Snap time to the current grid/beat setting (delegates to sequencer)
   */
  function snapTime(time: number): number {
    return sequencer.snapTime(time)
  }

  /**
   * Get the current snap interval in seconds (delegates to sequencer)
   */
  function getSnapInterval(): number {
    return sequencer.getSnapInterval()
  }

  // ─── Viewport Controls ─────────────────────────────────────────────────────

  function setZoom(zoom: number): void {
    viewport.value.zoomX = Math.max(10, Math.min(500, zoom))
  }

  function setScroll(x: number, y: number): void {
    viewport.value.scrollX = Math.max(0, x)
    viewport.value.scrollY = Math.max(0, y)
  }

  function zoomIn(): void {
    setZoom(viewport.value.zoomX * 1.2)
  }

  function zoomOut(): void {
    setZoom(viewport.value.zoomX / 1.2)
  }

  // ─── Selection State ──────────────────────────────────────────────────────

  interface KeyframeSelection {
    category: TrackCategory
    objectId?: string    // For objects category
    property: string
    time: number
    value: any
    easing: string
  }

  const selectedKeyframes = ref<KeyframeSelection[]>([])
  const selectionBox = ref<{
    startX: number
    startY: number
    endX: number
    endY: number
  } | null>(null)

  const hasSelection = computed(() => selectedKeyframes.value.length > 0)
  const selectionCount = computed(() => selectedKeyframes.value.length)

  /**
   * Select a keyframe
   */
  function selectKeyframe(
    selection: KeyframeSelection,
    additive: boolean = false
  ): void {
    if (!additive) {
      selectedKeyframes.value = []
    }

    // Check if already selected
    const exists = selectedKeyframes.value.some(s =>
      s.category === selection.category &&
      s.objectId === selection.objectId &&
      s.property === selection.property &&
      Math.abs(s.time - selection.time) < 0.001
    )

    if (!exists) {
      selectedKeyframes.value.push(selection)
    }
  }

  /**
   * Deselect a specific keyframe
   */
  function deselectKeyframe(
    category: TrackCategory,
    objectId: string | undefined,
    property: string,
    time: number
  ): void {
    selectedKeyframes.value = selectedKeyframes.value.filter(s =>
      !(s.category === category &&
        s.objectId === objectId &&
        s.property === property &&
        Math.abs(s.time - time) < 0.001)
    )
  }

  /**
   * Toggle keyframe selection
   */
  function toggleKeyframeSelection(selection: KeyframeSelection): void {
    const idx = selectedKeyframes.value.findIndex(s =>
      s.category === selection.category &&
      s.objectId === selection.objectId &&
      s.property === selection.property &&
      Math.abs(s.time - selection.time) < 0.001
    )

    if (idx >= 0) {
      selectedKeyframes.value.splice(idx, 1)
    } else {
      selectedKeyframes.value.push(selection)
    }
  }

  /**
   * Clear all selections
   */
  function clearSelection(): void {
    selectedKeyframes.value = []
    selectionBox.value = null
  }

  /**
   * Select all keyframes in a category
   */
  function selectAllInCategory(category: TrackCategory): void {
    // This would need to query the appropriate store for all keyframes
    // Implementation depends on category
    console.log(`[Timeline] Select all in ${category} - requires store integration`)
  }

  /**
   * Start a box selection
   */
  function startBoxSelection(x: number, y: number): void {
    selectionBox.value = { startX: x, startY: y, endX: x, endY: y }
  }

  /**
   * Update box selection
   */
  function updateBoxSelection(x: number, y: number): void {
    if (selectionBox.value) {
      selectionBox.value.endX = x
      selectionBox.value.endY = y
    }
  }

  /**
   * End box selection and select keyframes within
   */
  function endBoxSelection(keyframesInBox: KeyframeSelection[]): void {
    selectedKeyframes.value = keyframesInBox
    selectionBox.value = null
  }

  // ─── Clipboard ────────────────────────────────────────────────────────────

  interface ClipboardContent {
    keyframes: KeyframeSelection[]
    referenceTime: number  // Earliest keyframe time for relative pasting
  }

  const clipboard = ref<ClipboardContent | null>(null)
  const hasClipboard = computed(() =>
    clipboard.value !== null && clipboard.value.keyframes.length > 0
  )

  /**
   * Copy selected keyframes to clipboard
   */
  function copySelection(): void {
    if (selectedKeyframes.value.length === 0) return

    const minTime = Math.min(...selectedKeyframes.value.map(s => s.time))

    clipboard.value = {
      keyframes: JSON.parse(JSON.stringify(selectedKeyframes.value)),
      referenceTime: minTime,
    }

    console.log(`[Timeline] Copied ${selectedKeyframes.value.length} keyframes`)
  }

  /**
   * Cut selected keyframes (copy + delete)
   */
  function cutSelection(): void {
    copySelection()
    deleteSelection()
  }

  /**
   * Paste clipboard at current time
   */
  function pasteAtTime(time?: number): KeyframeSelection[] {
    if (!clipboard.value) return []

    const pasteTime = time ?? currentTime.value
    const offset = pasteTime - clipboard.value.referenceTime

    const pasted: KeyframeSelection[] = []

    for (const kf of clipboard.value.keyframes) {
      const newKf: KeyframeSelection = {
        ...JSON.parse(JSON.stringify(kf)),
        time: kf.time + offset,
      }

      // Actually add the keyframe to the appropriate store
      addKeyframeToStore(newKf)
      pasted.push(newKf)
    }

    // Select pasted keyframes
    selectedKeyframes.value = pasted

    console.log(`[Timeline] Pasted ${pasted.length} keyframes at ${pasteTime.toFixed(2)}s`)
    return pasted
  }

  /**
   * Delete selected keyframes
   */
  function deleteSelection(): void {
    for (const kf of selectedKeyframes.value) {
      removeKeyframeFromStore(kf)
    }

    console.log(`[Timeline] Deleted ${selectedKeyframes.value.length} keyframes`)
    selectedKeyframes.value = []
  }

  /**
   * Duplicate selected keyframes (paste immediately after)
   */
  function duplicateSelection(): KeyframeSelection[] {
    if (selectedKeyframes.value.length === 0) return []

    const maxTime = Math.max(...selectedKeyframes.value.map(s => s.time))
    const minTime = Math.min(...selectedKeyframes.value.map(s => s.time))
    const duration = maxTime - minTime + 0.5  // Add small gap

    copySelection()
    return pasteAtTime(minTime + duration)
  }

  /**
   * Nudge selected keyframes by time offset
   */
  function nudgeSelection(deltaTime: number): void {
    const objectsStore = useObjectsStore()
    const environmentStore = useEnvironmentStore()

    for (const kf of selectedKeyframes.value) {
      const newTime = Math.max(0, kf.time + deltaTime)

      // Remove old keyframe and add at new time
      if (kf.category === 'objects' && kf.objectId) {
        objectsStore.removeKeyframe(kf.objectId, kf.property, kf.time)
        objectsStore.addKeyframe(kf.objectId, kf.property, newTime, kf.value, kf.easing as any)
      } else if (kf.category === 'environment') {
        environmentStore.removeKeyframe(kf.property, kf.time)
        environmentStore.addKeyframe(kf.property, newTime, kf.value, kf.easing as any)
      }

      kf.time = newTime
    }
  }

  // ─── Helper: Add keyframe to appropriate store ────────────────────────────

  function addKeyframeToStore(kf: KeyframeSelection): void {
    const objectsStore = useObjectsStore()
    const environmentStore = useEnvironmentStore()

    if (kf.category === 'objects' && kf.objectId) {
      objectsStore.addKeyframe(kf.objectId, kf.property, kf.time, kf.value, kf.easing as any)
    } else if (kf.category === 'environment') {
      environmentStore.addKeyframe(kf.property, kf.time, kf.value, kf.easing as any)
    }
    // TODO: Add events category support
  }

  function removeKeyframeFromStore(kf: KeyframeSelection): void {
    const objectsStore = useObjectsStore()
    const environmentStore = useEnvironmentStore()

    if (kf.category === 'objects' && kf.objectId) {
      objectsStore.removeKeyframe(kf.objectId, kf.property, kf.time)
    } else if (kf.category === 'environment') {
      environmentStore.removeKeyframe(kf.property, kf.time)
    }
    // TODO: Add events category support
  }

  // ─── Serialization ─────────────────────────────────────────────────────────

  function toJSON() {
    return {
      duration: duration.value,
      mode: mode.value,
      categories: categories.value.map(c => ({
        id: c.id,
        collapsed: c.collapsed,
        visible: c.visible,
      })),
    }
  }

  function fromJSON(data: ReturnType<typeof toJSON>): void {
    duration.value = data.duration
    mode.value = data.mode

    for (const catData of data.categories) {
      const cat = categories.value.find(c => c.id === catData.id)
      if (cat) {
        cat.collapsed = catData.collapsed
        cat.visible = catData.visible
      }
    }
  }

  function reset(): void {
    duration.value = 60
    mode.value = 'animation'
    categories.value.forEach(c => {
      c.collapsed = false
      c.visible = true
    })
    viewport.value = { scrollX: 0, scrollY: 0, zoomX: 50 }
    // Reset sequencer playhead (currentTime and playing are computed from sequencer)
    sequencer.stop()
  }

  return {
    // State
    duration,
    currentTime,  // computed from sequencer.playheadPosition
    playing,      // computed from sequencer.transport
    mode,
    categories,
    viewport,

    // Computed
    getCategory,
    audioTrackCount,
    objectTrackCount,
    visibleCategories,
    expandedCategories,

    // Section controls
    toggleSection,
    setSectionCollapsed,
    toggleSectionVisibility,
    collapseAll,
    expandAll,

    // Transport (forwards to sequencer)
    play,
    pause,
    stop,
    seek,
    snapTime,
    getSnapInterval,

    // Viewport
    setZoom,
    setScroll,
    zoomIn,
    zoomOut,

    // Selection
    selectedKeyframes,
    selectionBox,
    hasSelection,
    selectionCount,
    selectKeyframe,
    deselectKeyframe,
    toggleKeyframeSelection,
    clearSelection,
    selectAllInCategory,
    startBoxSelection,
    updateBoxSelection,
    endBoxSelection,

    // Clipboard
    clipboard,
    hasClipboard,
    copySelection,
    cutSelection,
    pasteAtTime,
    deleteSelection,
    duplicateSelection,
    nudgeSelection,

    // Serialization
    toJSON,
    fromJSON,
    reset,
  }
})

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Get color scheme for a category
 */
export function getCategoryColors(category: TrackCategory) {
  return CATEGORY_COLORS[category]
}

/**
 * Register store for external access
 */
export function registerTimelineStoreForTerminal(): void {
  const store = useTimelineStore()
  ;(window as any).__timelineStore = store
}
