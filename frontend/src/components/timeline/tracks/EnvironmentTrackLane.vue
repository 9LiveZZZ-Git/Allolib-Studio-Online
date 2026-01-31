<!--
  EnvironmentTrackLane.vue

  Single track for environment settings (background, fog, ambient).
  Shows keyframes for all environment properties.
-->
<template>
  <div class="track-lane" :style="laneStyle">
    <!-- Track Header -->
    <div class="track-header" :style="{ width: `${headerWidth}px` }">
      <div class="track-info">
        <span class="track-icon">◐</span>
        <span class="track-name">Environment</span>
      </div>
      <div class="track-controls">
        <button
          class="ctrl-btn expand-btn"
          :class="{ active: expanded }"
          @click="expanded = !expanded"
          title="Expand properties"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M3 5L6 8L9 5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Track Content -->
    <div class="track-content" ref="contentRef">
      <canvas ref="canvasRef" class="track-canvas" />
    </div>
  </div>

  <!-- Expanded Property Rows -->
  <template v-if="expanded">
    <div
      v-for="prop in envProperties"
      :key="prop.id"
      class="property-row"
      :style="laneStyle"
    >
      <div class="property-header" :style="{ width: `${headerWidth}px` }">
        <span class="property-indent" />
        <span class="property-name">{{ prop.label }}</span>
        <div class="property-value" :style="prop.preview">
          {{ formatValue(prop.id) }}
        </div>
      </div>
      <div class="property-content" ref="propContentRef">
        <canvas :ref="el => propCanvasRefs[prop.id] = el as HTMLCanvasElement" class="property-canvas" />
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useEnvironmentStore } from '@/stores/environment'
import { useTimelineStore } from '@/stores/timeline'

const props = defineProps<{
  zoom: number
  scrollX: number
  headerWidth: number
  categoryColor: string
}>()

const environmentStore = useEnvironmentStore()
const timeline = useTimelineStore()

const contentRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()
const propCanvasRefs = reactive<Record<string, HTMLCanvasElement | null>>({})

const expanded = ref(false)
const TRACK_HEIGHT = 48
const PROP_HEIGHT = 28

const laneStyle = computed(() => ({
  '--category-color': props.categoryColor,
}))

const envProperties = [
  { id: 'backgroundColor', label: 'Background', type: 'color' },
  { id: 'ambientColor', label: 'Ambient Color', type: 'color' },
  { id: 'ambientIntensity', label: 'Ambient Intensity', type: 'number' },
  { id: 'fogEnabled', label: 'Fog Enabled', type: 'boolean' },
  { id: 'fogColor', label: 'Fog Color', type: 'color' },
  { id: 'fogNear', label: 'Fog Near', type: 'number' },
  { id: 'fogFar', label: 'Fog Far', type: 'number' },
]

function formatValue(propId: string): string {
  const val = environmentStore.getProperty(propId)
  if (val === undefined) return '-'
  if (typeof val === 'boolean') return val ? 'On' : 'Off'
  if (typeof val === 'number') return val.toFixed(2)
  if (Array.isArray(val)) {
    if (val.length <= 4) {
      return val.map(v => v.toFixed(1)).join(', ')
    }
  }
  return String(val)
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

  // Draw environment preview bar
  const bg = environmentStore.state.backgroundColor
  const bgColor = `rgba(${Math.round(bg[0]*255)}, ${Math.round(bg[1]*255)}, ${Math.round(bg[2]*255)}, ${bg[3]})`

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 10, width, height - 20)

  ctx.strokeStyle = hexToRgba(props.categoryColor, 0.5)
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 10.5, width - 1, height - 21)

  // Draw keyframe diamonds for all environment properties
  const keyframedProps = ['backgroundColor', 'ambientColor', 'ambientIntensity', 'fogEnabled', 'fogNear', 'fogFar']
  const propColors: Record<string, string> = {
    backgroundColor: '#68D391',
    ambientColor: '#F6AD55',
    ambientIntensity: '#F6AD55',
    fogEnabled: '#9F7AEA',
    fogNear: '#9F7AEA',
    fogFar: '#9F7AEA',
  }

  for (const propId of keyframedProps) {
    if (!environmentStore.hasKeyframes(propId)) continue

    const curve = environmentStore.keyframeCurves.get(propId)
    if (!curve) continue

    for (const kf of curve.keyframes) {
      const x = (kf.time * props.zoom) - props.scrollX
      if (x < -8 || x > width + 8) continue

      const color = propColors[propId] || props.categoryColor

      // Diamond shape
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, height/2 - 5)
      ctx.lineTo(x + 4, height/2)
      ctx.lineTo(x, height/2 + 5)
      ctx.lineTo(x - 4, height/2)
      ctx.closePath()
      ctx.fill()
    }
  }

  // Bottom border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, height - 0.5)
  ctx.lineTo(width, height - 0.5)
  ctx.stroke()
}

function drawPropertyRow(propId: string) {
  const canvas = propCanvasRefs[propId]
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0) return

  canvas.width = rect.width * dpr
  canvas.height = PROP_HEIGHT * dpr
  canvas.style.height = `${PROP_HEIGHT}px`
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = PROP_HEIGHT

  // Clear
  ctx.clearRect(0, 0, width, height)

  // Draw keyframes
  if (environmentStore.hasKeyframes(propId)) {
    const curve = environmentStore.keyframeCurves.get(propId)
    if (curve) {
      for (const kf of curve.keyframes) {
        const x = (kf.time * props.zoom) - props.scrollX
        if (x < -6 || x > width + 6) continue

        // Small diamond
        ctx.fillStyle = props.categoryColor
        ctx.beginPath()
        ctx.moveTo(x, height/2 - 4)
        ctx.lineTo(x + 3, height/2)
        ctx.lineTo(x, height/2 + 4)
        ctx.lineTo(x - 3, height/2)
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  // Bottom border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
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

  resizeObserver = new ResizeObserver(() => {
    draw()
    if (expanded.value) {
      nextTick(() => {
        for (const prop of envProperties) {
          drawPropertyRow(prop.id)
        }
      })
    }
  })

  if (contentRef.value) {
    resizeObserver.observe(contentRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch([() => props.zoom, () => props.scrollX, () => environmentStore.keyframeCurves.size], () => {
  draw()
  if (expanded.value) {
    nextTick(() => {
      for (const prop of envProperties) {
        drawPropertyRow(prop.id)
      }
    })
  }
})

watch(expanded, (isExpanded) => {
  if (isExpanded) {
    nextTick(() => {
      for (const prop of envProperties) {
        drawPropertyRow(prop.id)
      }
    })
  }
})
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
  color: var(--category-color);
  font-size: 12px;
}

.track-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
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

.expand-btn {
  transition: transform 0.2s;
}

.expand-btn.active {
  transform: rotate(180deg);
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

/* Property Rows */
.property-row {
  display: flex;
  height: 28px;
  background: rgba(0, 0, 0, 0.15);
}

.property-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.property-header {
  display: flex;
  align-items: center;
  padding: 0 8px;
  background: rgba(0, 0, 0, 0.1);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.property-indent {
  width: 16px;
}

.property-name {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  flex: 1;
}

.property-value {
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  color: rgba(255, 255, 255, 0.6);
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.property-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.property-canvas {
  width: 100%;
  height: 100%;
}
</style>
