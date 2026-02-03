<!--
  ObjectTrackLane.vue

  Individual track lane for scene objects.
  Shows object lifespan bar, keyframe diamonds, and visibility controls.
-->
<template>
  <div
    class="track-lane"
    :class="{ selected }"
    :style="laneStyle"
    @click="$emit('select')"
  >
    <!-- Track Header -->
    <div class="track-header" :style="{ width: `${headerWidth}px` }">
      <div class="track-info">
        <span class="track-icon">{{ getMeshIcon(object.mesh.primitive) }}</span>
        <span class="track-name" :title="object.name">{{ object.name }}</span>
      </div>
      <div class="track-controls">
        <button
          class="ctrl-btn"
          :class="{ active: object.visible }"
          @click.stop="toggleVisibility"
          title="Toggle visibility"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <circle v-if="object.visible" cx="6" cy="6" r="2" fill="currentColor" />
            <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1" />
          </svg>
        </button>
        <button
          class="ctrl-btn"
          :class="{ active: object.locked }"
          @click.stop="toggleLock"
          title="Lock/Unlock"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="3" y="5" width="6" height="5" rx="1" fill="currentColor" />
            <path
              v-if="object.locked"
              d="M4 5V3.5C4 2.67 4.9 2 6 2C7.1 2 8 2.67 8 3.5V5"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            />
            <path
              v-else
              d="M4 5V3.5C4 2.67 4.9 2 6 2C7.1 2 8 2.67 8 3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            />
          </svg>
        </button>
        <button
          class="ctrl-btn delete-btn"
          @click.stop="$emit('delete')"
          title="Delete object"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Track Content -->
    <div class="track-content" ref="contentRef">
      <canvas ref="canvasRef" class="track-canvas" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useObjectsStore, type SceneObject } from '@/stores/objects'
import { useTimelineStore } from '@/stores/timeline'

const props = defineProps<{
  object: SceneObject
  zoom: number
  scrollX: number
  headerWidth: number
  categoryColor: string
  selected: boolean
}>()

defineEmits<{
  (e: 'select'): void
  (e: 'delete'): void
}>()

const objectsStore = useObjectsStore()
const timeline = useTimelineStore()

const contentRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()

const TRACK_HEIGHT = 48

const laneStyle = computed(() => ({
  '--category-color': props.categoryColor,
}))

function getMeshIcon(primitive?: string): string {
  switch (primitive) {
    case 'sphere': return '●'
    case 'cube': return '■'
    case 'cylinder': return '▮'
    case 'cone': return '▲'
    case 'torus': return '◎'
    case 'plane': return '▬'
    default: return '◈'
  }
}

function toggleVisibility() {
  const obj = objectsStore.objects.get(props.object.id)
  if (obj) {
    obj.visible = !obj.visible
  }
}

function toggleLock() {
  const obj = objectsStore.objects.get(props.object.id)
  if (obj) {
    obj.locked = !obj.locked
  }
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

  // Calculate object lifespan bar
  const spawnTime = props.object.spawnTime ?? 0
  const destroyTime = props.object.destroyTime ?? timeline.duration

  const startX = (spawnTime * props.zoom) - props.scrollX
  const endX = (destroyTime * props.zoom) - props.scrollX
  const barWidth = endX - startX

  // Draw lifespan bar
  if (endX > 0 && startX < width) {
    // Bar background
    ctx.fillStyle = hexToRgba(props.categoryColor, props.object.visible ? 0.3 : 0.1)
    ctx.fillRect(Math.max(0, startX), 16, Math.min(barWidth, width - startX), 16)

    // Bar border
    ctx.strokeStyle = hexToRgba(props.categoryColor, props.object.visible ? 0.6 : 0.3)
    ctx.lineWidth = 1
    ctx.strokeRect(Math.max(0, startX) + 0.5, 16.5, Math.min(barWidth, width - startX) - 1, 15)

    // Spawn/destroy markers
    if (props.object.spawnTime !== undefined && startX > 0 && startX < width) {
      ctx.fillStyle = '#68D391'
      ctx.beginPath()
      ctx.moveTo(startX, 12)
      ctx.lineTo(startX + 4, 16)
      ctx.lineTo(startX, 20)
      ctx.closePath()
      ctx.fill()
    }

    if (props.object.destroyTime !== undefined && endX > 0 && endX < width) {
      ctx.fillStyle = '#FC8181'
      ctx.beginPath()
      ctx.moveTo(endX, 12)
      ctx.lineTo(endX - 4, 16)
      ctx.lineTo(endX, 20)
      ctx.closePath()
      ctx.fill()
    }
  }

  // Draw keyframe diamonds
  const keyframedProps = ['positionX', 'positionY', 'positionZ', 'scaleX', 'scaleY', 'scaleZ']
  for (const prop of keyframedProps) {
    const curve = objectsStore.keyframeCurves.get(`${props.object.id}:${prop}`)
    if (!curve) continue

    for (const kf of curve.keyframes) {
      const x = (kf.time * props.zoom) - props.scrollX
      if (x < -8 || x > width + 8) continue

      // Diamond shape
      ctx.fillStyle = props.selected ? '#90CDF4' : hexToRgba(props.categoryColor, 0.9)
      ctx.beginPath()
      ctx.moveTo(x, 24 - 5)
      ctx.lineTo(x + 4, 24)
      ctx.lineTo(x, 24 + 5)
      ctx.lineTo(x - 4, 24)
      ctx.closePath()
      ctx.fill()
    }
  }

  // Selection highlight
  if (props.selected) {
    ctx.strokeStyle = props.categoryColor
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, width - 2, height - 2)
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

watch([
  () => props.zoom,
  () => props.scrollX,
  () => props.object.visible,
  () => props.object.locked,
  () => props.selected,
  () => objectsStore.keyframeCurves.size,
], draw)
</script>

<style scoped>
.track-lane {
  display: flex;
  height: 48px;
  background: rgba(0, 0, 0, 0.1);
  cursor: pointer;
}

.track-lane:hover {
  background: rgba(255, 255, 255, 0.02);
}

.track-lane.selected {
  background: rgba(99, 179, 237, 0.1);
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

.track-lane.selected .track-header {
  background: rgba(99, 179, 237, 0.15);
}

.track-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.track-icon {
  color: var(--category-color);
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

.ctrl-btn.active {
  background: rgba(99, 179, 237, 0.3);
  border-color: rgba(99, 179, 237, 0.5);
  color: #63B3ED;
}

.ctrl-btn.delete-btn:hover {
  background: rgba(239, 68, 68, 0.3);
  border-color: rgba(239, 68, 68, 0.5);
  color: #EF4444;
}

.track-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.track-canvas {
  width: 100%;
  height: 100%;
}
</style>
