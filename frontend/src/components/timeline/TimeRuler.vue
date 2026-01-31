<!--
  TimeRuler.vue

  Time ruler with beat/time grid markers.
  Shows time markers, beat divisions, and playhead position.
-->
<template>
  <div class="time-ruler" ref="rulerRef">
    <canvas
      ref="canvasRef"
      class="ruler-canvas"
      @click="handleClick"
      @mousedown="startDrag"
    />
    <div
      class="playhead"
      :style="playheadStyle"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  duration: number      // Total duration in seconds
  currentTime: number   // Current playhead position
  zoom: number          // Pixels per second
  scrollX: number       // Horizontal scroll offset
  bpm?: number          // Beats per minute (optional)
  showBeats?: boolean   // Show beat markers
  headerWidth?: number  // Width of track headers
}>()

const emit = defineEmits<{
  (e: 'seek', time: number): void
}>()

const rulerRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()
const isDragging = ref(false)

const headerW = computed(() => props.headerWidth ?? 80)

const playheadStyle = computed(() => {
  const x = headerW.value + (props.currentTime * props.zoom) - props.scrollX
  return {
    left: `${x}px`,
    display: x < headerW.value ? 'none' : 'block',
  }
})

function timeToX(time: number): number {
  return headerW.value + (time * props.zoom) - props.scrollX
}

function xToTime(x: number): number {
  return (x - headerW.value + props.scrollX) / props.zoom
}

function handleClick(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = e.clientX - rect.left
  if (x < headerW.value) return

  const time = Math.max(0, Math.min(xToTime(x), props.duration))
  emit('seek', time)
}

function startDrag(e: MouseEvent) {
  isDragging.value = true
  handleClick(e)
  window.addEventListener('mousemove', handleDrag)
  window.addEventListener('mouseup', stopDrag)
}

function handleDrag(e: MouseEvent) {
  if (!isDragging.value || !canvasRef.value) return

  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const time = Math.max(0, Math.min(xToTime(x), props.duration))
  emit('seek', time)
}

function stopDrag() {
  isDragging.value = false
  window.removeEventListener('mousemove', handleDrag)
  window.removeEventListener('mouseup', stopDrag)
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = rect.height

  // Clear
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, width, height)

  // Header area background
  ctx.fillStyle = '#252538'
  ctx.fillRect(0, 0, headerW.value, height)

  // Calculate marker spacing based on zoom
  const pixelsPerSecond = props.zoom
  let majorInterval = 1    // seconds
  let minorDivisions = 10  // subdivisions per major

  // Adjust intervals based on zoom
  if (pixelsPerSecond < 20) {
    majorInterval = 10
    minorDivisions = 10
  } else if (pixelsPerSecond < 50) {
    majorInterval = 5
    minorDivisions = 5
  } else if (pixelsPerSecond < 100) {
    majorInterval = 2
    minorDivisions = 4
  } else if (pixelsPerSecond > 200) {
    majorInterval = 0.5
    minorDivisions = 5
  }

  const minorInterval = majorInterval / minorDivisions

  // Calculate visible time range
  const startTime = Math.max(0, props.scrollX / props.zoom)
  const endTime = Math.min(props.duration, (props.scrollX + width - headerW.value) / props.zoom)

  // Draw minor ticks
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1

  const firstMinor = Math.floor(startTime / minorInterval) * minorInterval
  for (let t = firstMinor; t <= endTime; t += minorInterval) {
    const x = timeToX(t)
    if (x < headerW.value) continue

    ctx.beginPath()
    ctx.moveTo(x, height - 4)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  // Draw major ticks and labels
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.font = '10px JetBrains Mono, monospace'
  ctx.textAlign = 'center'

  const firstMajor = Math.floor(startTime / majorInterval) * majorInterval
  for (let t = firstMajor; t <= endTime; t += majorInterval) {
    const x = timeToX(t)
    if (x < headerW.value) continue

    // Tick
    ctx.beginPath()
    ctx.moveTo(x, height - 10)
    ctx.lineTo(x, height)
    ctx.stroke()

    // Label
    const label = formatTimeLabel(t)
    ctx.fillText(label, x, height - 12)
  }

  // Draw beat markers if enabled
  if (props.showBeats && props.bpm) {
    const secondsPerBeat = 60 / props.bpm
    ctx.strokeStyle = 'rgba(159, 122, 234, 0.3)'

    const firstBeat = Math.floor(startTime / secondsPerBeat) * secondsPerBeat
    for (let t = firstBeat; t <= endTime; t += secondsPerBeat) {
      const x = timeToX(t)
      if (x < headerW.value) continue

      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height - 12)
      ctx.stroke()
    }
  }

  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.beginPath()
  ctx.moveTo(0, height - 0.5)
  ctx.lineTo(width, height - 0.5)
  ctx.stroke()
}

function formatTimeLabel(seconds: number): string {
  if (seconds < 60) {
    return seconds.toFixed(seconds % 1 === 0 ? 0 : 1) + 's'
  }
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Resize handling
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  draw()

  resizeObserver = new ResizeObserver(() => {
    draw()
  })

  if (rulerRef.value) {
    resizeObserver.observe(rulerRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  stopDrag()
})

// Redraw on prop changes
watch([() => props.duration, () => props.zoom, () => props.scrollX, () => props.bpm], draw)
</script>

<style scoped>
.time-ruler {
  position: relative;
  height: 28px;
  background: #1a1a2e;
  user-select: none;
}

.ruler-canvas {
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.playhead {
  position: absolute;
  top: 0;
  width: 1px;
  height: 100%;
  background: #68D391;
  pointer-events: none;
  z-index: 10;
}

.playhead::before {
  content: '';
  position: absolute;
  top: 0;
  left: -5px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid #68D391;
}
</style>
