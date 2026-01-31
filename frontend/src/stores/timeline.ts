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

  // Current playhead position (synced with sequencer)
  const currentTime = ref(0)

  // Playing state
  const playing = ref(false)

  // Mode: animation (linear playback) or interactive (game-like)
  const mode = ref<'animation' | 'interactive'>('animation')

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

  const sequencer = useSequencerStore()
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

  /**
   * Play the timeline
   */
  function play(): void {
    playing.value = true
    sequencer.play()
    console.log('[Timeline] Play')
  }

  /**
   * Pause the timeline
   */
  function pause(): void {
    playing.value = false
    sequencer.pause()
    console.log('[Timeline] Pause')
  }

  /**
   * Stop and reset to beginning
   */
  function stop(): void {
    playing.value = false
    currentTime.value = 0
    sequencer.stop()
    console.log('[Timeline] Stop')
  }

  /**
   * Seek to a specific time
   */
  function seek(time: number): void {
    currentTime.value = Math.max(0, Math.min(time, duration.value))
    sequencer.setPosition(currentTime.value)
  }

  /**
   * Update current time (called each frame during playback)
   */
  function update(dt: number): void {
    if (!playing.value) return

    currentTime.value += dt
    if (currentTime.value >= duration.value) {
      if (mode.value === 'animation') {
        stop()
      }
      // In interactive mode, time can continue
    }
  }

  /**
   * Sync current time from sequencer
   */
  function syncFromSequencer(): void {
    currentTime.value = sequencer.playheadPosition
    playing.value = sequencer.transport === 'playing'
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
    currentTime.value = 0
    playing.value = false
    mode.value = 'animation'
    categories.value.forEach(c => {
      c.collapsed = false
      c.visible = true
    })
    viewport.value = { scrollX: 0, scrollY: 0, zoomX: 50 }
  }

  return {
    // State
    duration,
    currentTime,
    playing,
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

    // Transport
    play,
    pause,
    stop,
    seek,
    update,
    syncFromSequencer,

    // Viewport
    setZoom,
    setScroll,
    zoomIn,
    zoomOut,

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
