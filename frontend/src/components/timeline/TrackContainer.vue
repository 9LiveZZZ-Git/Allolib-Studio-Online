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

const props = defineProps<{
  duration: number
  zoom: number
  scrollX: number
  scrollY: number
  headerWidth?: number
}>()

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
