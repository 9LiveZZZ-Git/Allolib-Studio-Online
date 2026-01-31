<!--
  EventTrackLane.vue

  Track lane for event tracks (camera, markers, scripts).
  Shows event markers and keyframes.
-->
<template>
  <div class="track-lane" :style="laneStyle">
    <!-- Track Header -->
    <div class="track-header" :style="{ width: `${headerWidth}px` }">
      <div class="track-info">
        <span class="track-icon">{{ getTypeIcon(track.type) }}</span>
        <span class="track-name" :title="track.name">{{ track.name }}</span>
      </div>
      <div class="track-controls">
        <button
          class="ctrl-btn delete-btn"
          @click="$emit('delete')"
          title="Delete track"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Track Content -->
    <div
      class="track-content"
      ref="contentRef"
      @dblclick="handleDoubleClick"
    >
      <canvas ref="canvasRef" class="track-canvas" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTimelineStore } from '@/stores/timeline'

interface EventTrack {
  id: string
  name: string
  type: string
  events?: Array<{
    id: string
    time: number
    duration?: number
    data?: any
  }>
}

const props = defineProps<{
  track: EventTrack
  zoom: number
  scrollX: number
  headerWidth: number
  categoryColor: string
}>()

const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'add-event', time: number): void
}>()

const timeline = useTimelineStore()

const contentRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()

const TRACK_HEIGHT = 48

const laneStyle = computed(() => ({
  '--category-color': props.categoryColor,
}))

function getTypeIcon(type: string): string {
  switch (type) {
    case 'camera': return '🎥'
    case 'marker': return '🏳'
    case 'script': return '⚡'
    default: return '●'
  }
}

function handleDoubleClick(e: MouseEvent) {
  const rect = contentRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = e.clientX - rect.left
  const time = (x + props.scrollX) / props.zoom
  emit('add-event', Math.max(0, Math.min(time, timeline.duration)))
}

function draw() {
  const canvas = canvasRef.value
  const container = contentRef.value
  if (!canvas || !container) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = container.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = TRACK_HEIGHT * dpr
  canvas.style.height = `${TRACK_HEIGHT}px`
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = TRACK_HEIGHT

  // Clear
  ctx.clearRect(0, 0, width, height)

  // Draw events
  const events = props.track.events || []
  for (const event of events) {
    const x = (event.time * props.zoom) - props.scrollX
    const eventWidth = event.duration ? event.duration * props.zoom : 16

    if (x + eventWidth < 0 || x > width) continue

    if (props.track.type === 'camera') {
      // Camera keyframe - diamond
      ctx.fillStyle = hexToRgba(props.categoryColor, 0.9)
      ctx.beginPath()
      ctx.moveTo(x, height/2 - 8)
      ctx.lineTo(x + 6, height/2)
      ctx.lineTo(x, height/2 + 8)
      ctx.lineTo(x - 6, height/2)
      ctx.closePath()
      ctx.fill()

      // Camera icon inside
      ctx.fillStyle = '#1a1a2e'
      ctx.beginPath()
      ctx.arc(x, height/2, 2, 0, Math.PI * 2)
      ctx.fill()
    } else if (props.track.type === 'marker') {
      // Marker - vertical line with flag
      ctx.strokeStyle = props.categoryColor
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, 8)
      ctx.lineTo(x, height - 8)
      ctx.stroke()

      // Flag
      ctx.fillStyle = hexToRgba(props.categoryColor, 0.8)
      ctx.beginPath()
      ctx.moveTo(x, 8)
      ctx.lineTo(x + 12, 14)
      ctx.lineTo(x, 20)
      ctx.closePath()
      ctx.fill()
    } else if (props.track.type === 'script') {
      // Script event - rectangle with duration
      const w = Math.max(eventWidth, 20)

      ctx.fillStyle = hexToRgba(props.categoryColor, 0.4)
      ctx.fillRect(x, 12, w, height - 24)

      ctx.strokeStyle = hexToRgba(props.categoryColor, 0.8)
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, 12.5, w - 1, height - 25)

      // Lightning icon
      ctx.fillStyle = props.categoryColor
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('⚡', x + w/2, height/2)
    } else {
      // Default - circle
      ctx.fillStyle = props.categoryColor
      ctx.beginPath()
      ctx.arc(x, height/2, 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Hint text if no events
  if (events.length === 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.font = '10px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Double-click to add event', width / 2, height / 2)
  }

  // Bottom border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, height - 0.5)
  ctx.lineTo(width, height - 0.5)
  ctx.stroke()
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  draw()

  resizeObserver = new ResizeObserver(draw)
  if (contentRef.value) {
    resizeObserver.observe(contentRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch([() => props.zoom, () => props.scrollX, () => props.track.events], draw)
</script>

<style scoped>
.track-lane {
  display: flex;
  height: 48px;
  background: rgba(0, 0, 0, 0.1);
}

.track-lane:hover {
  background: rgba(255, 255, 255, 0.02);
}

.track-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.track-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.track-icon {
  font-size: 12px;
}

.track-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-controls {
  display: flex;
  gap: 2px;
}

.ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: all 0.15s;
}

.ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.delete-btn:hover {
  background: rgba(252, 129, 129, 0.2);
  border-color: rgba(252, 129, 129, 0.4);
  color: #FC8181;
}

.track-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  cursor: crosshair;
}

.track-canvas {
  width: 100%;
  height: 100%;
}
</style>
