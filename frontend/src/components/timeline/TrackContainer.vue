<!--
  TrackContainer.vue

  Container for all track sections with synchronized scrolling.
  Manages horizontal scroll sync between ruler and tracks.
-->
<template>
  <div class="track-container" ref="containerRef">
    <div
      class="tracks-scroll"
      ref="scrollRef"
      @scroll="handleScroll"
    >
      <div class="tracks-content" :style="contentStyle">
        <!-- Grid overlay -->
        <div v-if="showGrid" class="grid-overlay" :style="gridOverlayStyle">
          <div
            v-for="line in gridLines"
            :key="line.time"
            class="grid-line"
            :class="{ bar: line.isBar, beat: !line.isBar }"
            :style="{ left: `${line.x}px` }"
          />
        </div>
        <slot />
      </div>
    </div>

    <!-- Vertical scrollbar indicator -->
    <div class="scroll-indicator" v-if="showScrollIndicator">
      <div
        class="scroll-thumb"
        :style="scrollThumbStyle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  duration: number
  zoom: number
  scrollX: number
  scrollY: number
  headerWidth?: number
  bpm?: number
  showGrid?: boolean
}>(), {
  bpm: 120,
  showGrid: true,
})

const emit = defineEmits<{
  (e: 'scroll', x: number, y: number): void
}>()

const containerRef = ref<HTMLElement>()
const scrollRef = ref<HTMLElement>()
const showScrollIndicator = ref(false)
const contentHeight = ref(0)

const headerW = computed(() => props.headerWidth ?? 80)

const contentStyle = computed(() => ({
  width: `${headerW.value + (props.duration * props.zoom)}px`,
  minHeight: '100%',
}))

// Grid overlay positioning
const gridOverlayStyle = computed(() => ({
  left: `${headerW.value}px`,
  width: `${props.duration * props.zoom}px`,
}))

// Calculate grid lines based on BPM and zoom
const gridLines = computed(() => {
  const lines: Array<{ time: number; x: number; isBar: boolean }> = []
  const beatDuration = 60 / props.bpm
  const barDuration = beatDuration * 4

  // Determine grid interval based on zoom level
  let interval = beatDuration
  if (props.zoom * beatDuration < 15) {
    interval = barDuration  // Show only bars when zoomed out
  } else if (props.zoom * beatDuration > 80) {
    interval = beatDuration / 4  // Show 16th notes when zoomed in
  }

  // Calculate visible range
  const viewportWidth = containerRef.value?.clientWidth ?? 800
  const visibleStart = Math.max(0, props.scrollX / props.zoom)
  const visibleEnd = visibleStart + (viewportWidth / props.zoom) + interval

  // Generate lines
  const startTime = Math.floor(visibleStart / interval) * interval
  for (let t = startTime; t <= Math.min(visibleEnd, props.duration); t += interval) {
    if (t < 0) continue
    const x = t * props.zoom
    const isBar = Math.abs(t % barDuration) < 0.001
    lines.push({ time: t, x, isBar })
  }

  return lines
})

const scrollThumbStyle = computed(() => {
  if (!containerRef.value || !scrollRef.value) return {}

  const viewportHeight = containerRef.value.clientHeight
  const scrollHeight = scrollRef.value.scrollHeight
  const thumbHeight = Math.max(30, (viewportHeight / scrollHeight) * viewportHeight)
  const thumbTop = (props.scrollY / (scrollHeight - viewportHeight)) * (viewportHeight - thumbHeight)

  return {
    height: `${thumbHeight}px`,
    top: `${thumbTop}px`,
  }
})

function handleScroll() {
  if (!scrollRef.value) return

  const x = scrollRef.value.scrollLeft
  const y = scrollRef.value.scrollTop

  emit('scroll', x, y)
}

// Sync scroll position from props
watch([() => props.scrollX, () => props.scrollY], ([x, y]) => {
  if (!scrollRef.value) return

  if (Math.abs(scrollRef.value.scrollLeft - x) > 1) {
    scrollRef.value.scrollLeft = x
  }
  if (Math.abs(scrollRef.value.scrollTop - y) > 1) {
    scrollRef.value.scrollTop = y
  }
})

// Update scroll indicator visibility
function updateScrollIndicator() {
  if (!containerRef.value || !scrollRef.value) return

  showScrollIndicator.value = scrollRef.value.scrollHeight > containerRef.value.clientHeight
  contentHeight.value = scrollRef.value.scrollHeight
}

onMounted(() => {
  updateScrollIndicator()

  // Use ResizeObserver to track content size changes
  const resizeObserver = new ResizeObserver(updateScrollIndicator)
  if (scrollRef.value) {
    resizeObserver.observe(scrollRef.value)
  }
})

// Expose scroll methods
function scrollTo(x: number, y: number) {
  if (scrollRef.value) {
    scrollRef.value.scrollTo({ left: x, top: y, behavior: 'smooth' })
  }
}

function scrollToTime(time: number) {
  const x = time * props.zoom - (containerRef.value?.clientWidth ?? 0) / 2 + headerW.value
  scrollTo(Math.max(0, x), props.scrollY)
}

defineExpose({
  scrollTo,
  scrollToTime,
})
</script>

<style scoped>
.track-container {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.tracks-scroll {
  width: 100%;
  height: 100%;
  overflow: auto;
}

/* Hide default scrollbar on webkit */
.tracks-scroll::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.tracks-scroll::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

.tracks-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.tracks-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.tracks-scroll::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.2);
}

.tracks-content {
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Grid overlay */
.grid-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
}

.grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
}

.grid-line.bar {
  background: rgba(255, 255, 255, 0.12);
}

.grid-line.beat {
  background: rgba(255, 255, 255, 0.05);
}

/* Custom scroll indicator (optional) */
.scroll-indicator {
  position: absolute;
  top: 0;
  right: 0;
  width: 6px;
  height: 100%;
  background: rgba(0, 0, 0, 0.2);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}

.track-container:hover .scroll-indicator {
  opacity: 1;
}

.scroll-thumb {
  position: absolute;
  right: 0;
  width: 100%;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  transition: background 0.15s;
}

.scroll-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}
</style>
