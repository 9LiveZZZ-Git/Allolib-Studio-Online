/**
 * Virtual Timeline Composable
 *
 * Provides virtual scrolling for large timelines with many tracks.
 * Only renders visible tracks plus a buffer, significantly improving
 * performance when dealing with 50+ tracks.
 *
 * Features:
 * - Lazy rendering of tracks outside viewport
 * - Smooth scrolling with overscan buffer
 * - Dynamic track heights support
 * - Sticky headers for sections
 */

import { ref, computed, watch, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VirtualTrack {
  id: string
  category: string
  height: number
  expanded: boolean
  visible: boolean
}

export interface VirtualizedItem<T> {
  data: T
  offsetTop: number
  index: number
}

export interface VirtualScrollState {
  scrollTop: number
  scrollLeft: number
  containerHeight: number
  containerWidth: number
}

export interface UseVirtualTimelineOptions {
  defaultTrackHeight?: number
  expandedTrackHeight?: number
  overscan?: number
  sectionHeaderHeight?: number
  enableStickyHeaders?: boolean
}

// ─── Virtual Timeline Composable ─────────────────────────────────────────────

export function useVirtualTimeline<T extends VirtualTrack>(
  containerRef: Ref<HTMLElement | null>,
  tracks: Ref<T[]> | ComputedRef<T[]>,
  options: UseVirtualTimelineOptions = {}
) {
  const {
    defaultTrackHeight = 48,
    expandedTrackHeight = 160,
    overscan = 3,
    sectionHeaderHeight = 32,
    enableStickyHeaders = true,
  } = options

  // ─── State ─────────────────────────────────────────────────────────────────

  const scrollTop = ref(0)
  const scrollLeft = ref(0)
  const containerHeight = ref(0)
  const containerWidth = ref(0)
  const isScrolling = ref(false)
  const scrollTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

  // ─── Track Height Calculation ──────────────────────────────────────────────

  function getTrackHeight(track: T): number {
    if (!track.visible) return 0
    return track.expanded ? expandedTrackHeight : defaultTrackHeight
  }

  // ─── Layout Calculation ────────────────────────────────────────────────────

  interface TrackLayout {
    id: string
    category: string
    offsetTop: number
    height: number
    index: number
  }

  const trackLayouts = computed((): TrackLayout[] => {
    const layouts: TrackLayout[] = []
    let currentOffset = 0
    let lastCategory = ''

    tracks.value.forEach((track, index) => {
      // Add section header height for new categories
      if (enableStickyHeaders && track.category !== lastCategory) {
        currentOffset += sectionHeaderHeight
        lastCategory = track.category
      }

      const height = getTrackHeight(track)

      layouts.push({
        id: track.id,
        category: track.category,
        offsetTop: currentOffset,
        height,
        index,
      })

      currentOffset += height
    })

    return layouts
  })

  // ─── Total Height ──────────────────────────────────────────────────────────

  const totalHeight = computed((): number => {
    if (trackLayouts.value.length === 0) return 0
    const last = trackLayouts.value[trackLayouts.value.length - 1]
    return last.offsetTop + last.height
  })

  // ─── Visible Range ─────────────────────────────────────────────────────────

  const visibleRange = computed(() => {
    const viewStart = scrollTop.value
    const viewEnd = scrollTop.value + containerHeight.value

    // Find first visible track
    let startIndex = 0
    for (let i = 0; i < trackLayouts.value.length; i++) {
      const layout = trackLayouts.value[i]
      if (layout.offsetTop + layout.height > viewStart) {
        startIndex = Math.max(0, i - overscan)
        break
      }
    }

    // Find last visible track
    let endIndex = trackLayouts.value.length
    for (let i = startIndex; i < trackLayouts.value.length; i++) {
      const layout = trackLayouts.value[i]
      if (layout.offsetTop > viewEnd) {
        endIndex = Math.min(trackLayouts.value.length, i + overscan)
        break
      }
    }

    return { start: startIndex, end: endIndex }
  })

  // ─── Visible Tracks ────────────────────────────────────────────────────────

  const visibleTracks = computed((): VirtualizedItem<T>[] => {
    const { start, end } = visibleRange.value

    return trackLayouts.value.slice(start, end).map((layout) => ({
      data: tracks.value[layout.index],
      offsetTop: layout.offsetTop,
      index: layout.index,
    }))
  })

  // ─── Sticky Headers ────────────────────────────────────────────────────────

  interface StickyHeader {
    category: string
    offsetTop: number
    isStuck: boolean
  }

  const stickyHeaders = computed((): StickyHeader[] => {
    if (!enableStickyHeaders) return []

    const headers: StickyHeader[] = []
    let lastCategory = ''
    let currentOffset = 0

    for (const track of tracks.value) {
      if (track.category !== lastCategory) {
        const isStuck = currentOffset < scrollTop.value

        headers.push({
          category: track.category,
          offsetTop: currentOffset,
          isStuck,
        })

        lastCategory = track.category
        currentOffset += sectionHeaderHeight
      }
      currentOffset += getTrackHeight(track)
    }

    return headers
  })

  // Currently stuck header (for rendering at top)
  const currentStickyHeader = computed(() => {
    const stuck = stickyHeaders.value.filter(h => h.isStuck)
    return stuck.length > 0 ? stuck[stuck.length - 1] : null
  })

  // ─── Scroll Handling ───────────────────────────────────────────────────────

  function onScroll(event: Event): void {
    const target = event.target as HTMLElement
    scrollTop.value = target.scrollTop
    scrollLeft.value = target.scrollLeft

    // Mark as scrolling for optimization
    isScrolling.value = true

    // Clear previous timeout
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value)
    }

    // Set timeout to mark scrolling as finished
    scrollTimeout.value = setTimeout(() => {
      isScrolling.value = false
    }, 150)
  }

  // ─── Scroll To Methods ─────────────────────────────────────────────────────

  function scrollToTrack(trackId: string, behavior: ScrollBehavior = 'smooth'): void {
    const layout = trackLayouts.value.find(l => l.id === trackId)
    if (!layout || !containerRef.value) return

    containerRef.value.scrollTo({
      top: layout.offsetTop,
      behavior,
    })
  }

  function scrollToTime(time: number, zoom: number, behavior: ScrollBehavior = 'smooth'): void {
    if (!containerRef.value) return

    const x = time * zoom
    containerRef.value.scrollTo({
      left: x,
      behavior,
    })
  }

  function scrollToTop(behavior: ScrollBehavior = 'smooth'): void {
    containerRef.value?.scrollTo({ top: 0, behavior })
  }

  function scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    containerRef.value?.scrollTo({ top: totalHeight.value, behavior })
  }

  // ─── Resize Observer ───────────────────────────────────────────────────────

  let resizeObserver: ResizeObserver | null = null

  function setupResizeObserver(): void {
    if (!containerRef.value) return

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerHeight.value = entry.contentRect.height
        containerWidth.value = entry.contentRect.width
      }
    })

    resizeObserver.observe(containerRef.value)

    // Initial size
    const rect = containerRef.value.getBoundingClientRect()
    containerHeight.value = rect.height
    containerWidth.value = rect.width
  }

  function cleanupResizeObserver(): void {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  onMounted(() => {
    setupResizeObserver()

    if (containerRef.value) {
      containerRef.value.addEventListener('scroll', onScroll, { passive: true })
    }
  })

  onUnmounted(() => {
    cleanupResizeObserver()

    if (containerRef.value) {
      containerRef.value.removeEventListener('scroll', onScroll)
    }

    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value)
    }
  })

  // Watch for container ref changes
  watch(containerRef, (newRef, oldRef) => {
    if (oldRef) {
      oldRef.removeEventListener('scroll', onScroll)
    }

    cleanupResizeObserver()

    if (newRef) {
      newRef.addEventListener('scroll', onScroll, { passive: true })
      setupResizeObserver()
    }
  })

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    // State
    scrollTop,
    scrollLeft,
    containerHeight,
    containerWidth,
    isScrolling,

    // Computed
    totalHeight,
    visibleRange,
    visibleTracks,
    trackLayouts,
    stickyHeaders,
    currentStickyHeader,

    // Methods
    scrollToTrack,
    scrollToTime,
    scrollToTop,
    scrollToBottom,
    getTrackHeight,
  }
}

// ─── Helper: Virtual List for Non-Track Items ────────────────────────────────

export function useVirtualList<T>(
  containerRef: Ref<HTMLElement | null>,
  items: Ref<T[]> | ComputedRef<T[]>,
  itemHeight: number | ((item: T, index: number) => number),
  overscan: number = 3
) {
  const scrollTop = ref(0)
  const containerHeight = ref(0)

  // Get height for an item
  function getItemHeight(item: T, index: number): number {
    return typeof itemHeight === 'function' ? itemHeight(item, index) : itemHeight
  }

  // Calculate total height
  const totalHeight = computed(() => {
    let height = 0
    for (let i = 0; i < items.value.length; i++) {
      height += getItemHeight(items.value[i], i)
    }
    return height
  })

  // Calculate item offsets
  const itemOffsets = computed(() => {
    const offsets: number[] = []
    let offset = 0

    for (let i = 0; i < items.value.length; i++) {
      offsets.push(offset)
      offset += getItemHeight(items.value[i], i)
    }

    return offsets
  })

  // Calculate visible items
  const visibleItems = computed((): VirtualizedItem<T>[] => {
    const viewStart = scrollTop.value
    const viewEnd = scrollTop.value + containerHeight.value

    const result: VirtualizedItem<T>[] = []

    for (let i = 0; i < items.value.length; i++) {
      const offset = itemOffsets.value[i]
      const height = getItemHeight(items.value[i], i)

      // Check if item is in view (with overscan)
      if (offset + height >= viewStart - (overscan * height) &&
          offset <= viewEnd + (overscan * height)) {
        result.push({
          data: items.value[i],
          offsetTop: offset,
          index: i,
        })
      }
    }

    return result
  })

  // Event handler
  function onScroll(event: Event): void {
    const target = event.target as HTMLElement
    scrollTop.value = target.scrollTop
  }

  // Setup
  onMounted(() => {
    if (containerRef.value) {
      containerRef.value.addEventListener('scroll', onScroll, { passive: true })
      containerHeight.value = containerRef.value.getBoundingClientRect().height
    }
  })

  onUnmounted(() => {
    if (containerRef.value) {
      containerRef.value.removeEventListener('scroll', onScroll)
    }
  })

  return {
    scrollTop,
    containerHeight,
    totalHeight,
    visibleItems,
    itemOffsets,
  }
}
