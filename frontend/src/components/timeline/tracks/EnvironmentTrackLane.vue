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
      <canvas
        ref="canvasRef"
        class="track-canvas"
        @dblclick="handleDoubleClick"
        @click="handleClick"
        @contextmenu.prevent="handleContextMenu"
      />
    </div>
  </div>

  <!-- Context Menu -->
  <Teleport to="body">
    <div
      v-if="contextMenu"
      class="env-context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
    >
      <template v-if="contextMenu.property">
        <!-- Editing existing keyframe -->
        <div class="menu-header">{{ contextMenu.property }}</div>
        <button class="menu-item" @click="emit('edit-curve', contextMenu.property, contextMenu.time)">
          Edit Curve...
        </button>
        <div class="menu-divider" />
        <div class="menu-label">Easing</div>
        <button class="menu-item" @click="setKeyframeEasing(contextMenu.property, contextMenu.time, 'linear')">Linear</button>
        <button class="menu-item" @click="setKeyframeEasing(contextMenu.property, contextMenu.time, 'easeIn')">Ease In</button>
        <button class="menu-item" @click="setKeyframeEasing(contextMenu.property, contextMenu.time, 'easeOut')">Ease Out</button>
        <button class="menu-item" @click="setKeyframeEasing(contextMenu.property, contextMenu.time, 'easeInOut')">Ease In/Out</button>
        <button class="menu-item" @click="setKeyframeEasing(contextMenu.property, contextMenu.time, 'step')">Step</button>
        <div class="menu-divider" />
        <button class="menu-item danger" @click="deleteKeyframe(contextMenu.property, contextMenu.time)">
          Delete Keyframe
        </button>
      </template>
      <template v-else>
        <!-- Adding new keyframe -->
        <div class="menu-header">Add Keyframe @ {{ contextMenu.time.toFixed(2) }}s</div>
        <button
          v-for="prop in envProperties"
          :key="prop.id"
          class="menu-item"
          @click="addKeyframeForProperty(prop.id, contextMenu.time)"
        >
          {{ prop.label }}
        </button>
      </template>
    </div>
  </Teleport>

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
        <canvas
          :ref="el => propCanvasRefs[prop.id] = el as HTMLCanvasElement"
          class="property-canvas"
          @dblclick="handlePropertyDoubleClick($event, prop.id)"
          @contextmenu.prevent="handlePropertyContextMenu($event, prop.id)"
        />
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch, nextTick, Teleport } from 'vue'
import { useEnvironmentStore, type EasingType } from '@/stores/environment'
import { useTimelineStore } from '@/stores/timeline'
import { useSequencerStore } from '@/stores/sequencer'

const props = defineProps<{
  zoom: number
  scrollX: number
  headerWidth: number
  categoryColor: string
}>()

const emit = defineEmits<{
  (e: 'edit-curve', property: string, time: number): void
}>()

const environmentStore = useEnvironmentStore()
const timeline = useTimelineStore()
const sequencer = useSequencerStore()

const contentRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()
const propCanvasRefs = reactive<Record<string, HTMLCanvasElement | null>>({})

const expanded = ref(false)
const TRACK_HEIGHT = 48
const PROP_HEIGHT = 28

// Keyframe interaction state
const selectedKeyframe = ref<{ property: string; time: number } | null>(null)
const contextMenu = ref<{ x: number; y: number; property: string; time: number } | null>(null)

// Hit-test threshold in pixels
const HIT_THRESHOLD = 8

const laneStyle = computed(() => ({
  '--category-color': props.categoryColor,
}))

const envProperties = [
  // Background & Skybox
  { id: 'backgroundColor', label: 'Background', type: 'color', group: 'background' },
  { id: 'skyboxEnabled', label: 'Skybox', type: 'boolean', group: 'background' },
  { id: 'hdriIntensity', label: 'HDRI Intensity', type: 'number', group: 'background' },
  { id: 'hdriRotation', label: 'HDRI Rotation', type: 'number', group: 'background' },
  // Ambient Lighting
  { id: 'ambientColor', label: 'Ambient Color', type: 'color', group: 'lighting' },
  { id: 'ambientIntensity', label: 'Ambient Intensity', type: 'number', group: 'lighting' },
  // Fog
  { id: 'fogEnabled', label: 'Fog', type: 'boolean', group: 'fog' },
  { id: 'fogColor', label: 'Fog Color', type: 'color', group: 'fog' },
  { id: 'fogNear', label: 'Fog Near', type: 'number', group: 'fog' },
  { id: 'fogFar', label: 'Fog Far', type: 'number', group: 'fog' },
  { id: 'fogDensity', label: 'Fog Density', type: 'number', group: 'fog' },
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

// ─── Keyframe Interaction ────────────────────────────────────────────────────

function screenToTime(x: number): number {
  return (x + props.scrollX) / props.zoom
}

function timeToScreen(time: number): number {
  return (time * props.zoom) - props.scrollX
}

function findKeyframeAtPosition(x: number, y: number): { property: string; time: number } | null {
  const canvasHeight = TRACK_HEIGHT

  for (const propId of envProperties.map(p => p.id)) {
    if (!environmentStore.hasKeyframes(propId)) continue

    const curve = environmentStore.keyframeCurves.get(propId)
    if (!curve) continue

    for (const kf of curve.keyframes) {
      const kfX = timeToScreen(kf.time)
      const kfY = canvasHeight / 2

      const distance = Math.sqrt((x - kfX) ** 2 + (y - kfY) ** 2)
      if (distance <= HIT_THRESHOLD) {
        return { property: propId, time: kf.time }
      }
    }
  }

  return null
}

function handleClick(event: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const hit = findKeyframeAtPosition(x, y)
  selectedKeyframe.value = hit

  if (hit) {
    // Seek to keyframe time
    timeline.seek(hit.time)
  }

  draw()
}

function handleDoubleClick(event: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = event.clientX - rect.left
  let time = screenToTime(x)

  // Apply snap if not 'none'
  if (sequencer.snapMode !== 'none') {
    time = timeline.snapTime(time)
  }

  // Find if we hit an existing keyframe
  const hit = findKeyframeAtPosition(x, event.clientY - rect.top)

  if (hit) {
    // Edit existing keyframe - emit event to open curve editor
    emit('edit-curve', hit.property, hit.time)
  } else {
    // Add keyframe for backgroundColor at the clicked time
    const currentValue = environmentStore.getProperty('backgroundColor')
    if (currentValue !== undefined) {
      environmentStore.addKeyframe('backgroundColor', time, currentValue, 'linear')
      draw()
    }
  }
}

function handleContextMenu(event: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const hit = findKeyframeAtPosition(x, y)

  if (hit) {
    contextMenu.value = {
      x: event.clientX,
      y: event.clientY,
      property: hit.property,
      time: hit.time,
    }
  } else {
    // Show menu to add keyframes for any property
    const time = screenToTime(x)
    contextMenu.value = {
      x: event.clientX,
      y: event.clientY,
      property: '',  // Empty means "add new"
      time,
    }
  }
}

function deleteKeyframe(property: string, time: number) {
  environmentStore.removeKeyframe(property, time)
  selectedKeyframe.value = null
  contextMenu.value = null
  draw()
}

function addKeyframeForProperty(property: string, time: number) {
  const currentValue = environmentStore.getProperty(property)
  if (currentValue !== undefined) {
    environmentStore.addKeyframe(property, time, currentValue, 'linear')
    contextMenu.value = null
    draw()
  }
}

function setKeyframeEasing(property: string, time: number, easing: EasingType) {
  const curve = environmentStore.keyframeCurves.get(property)
  if (!curve) return

  const kf = curve.keyframes.find(k => Math.abs(k.time - time) < 0.001)
  if (kf) {
    kf.easing = easing
    contextMenu.value = null
    draw()
  }
}

// Close context menu on click outside
function handleGlobalClick(event: MouseEvent) {
  if (contextMenu.value) {
    contextMenu.value = null
  }
}

// Property row handlers
function handlePropertyDoubleClick(event: MouseEvent, propertyId: string) {
  const canvas = propCanvasRefs[propertyId]
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  let time = screenToTime(x)

  // Apply snap if not 'none'
  if (sequencer.snapMode !== 'none') {
    time = timeline.snapTime(time)
  }

  // Check if we hit an existing keyframe
  const curve = environmentStore.keyframeCurves.get(propertyId)
  if (curve) {
    for (const kf of curve.keyframes) {
      const kfX = timeToScreen(kf.time)
      if (Math.abs(x - kfX) <= HIT_THRESHOLD) {
        emit('edit-curve', propertyId, kf.time)
        return
      }
    }
  }

  // Add new keyframe
  const currentValue = environmentStore.getProperty(propertyId)
  if (currentValue !== undefined) {
    environmentStore.addKeyframe(propertyId, time, currentValue, 'linear')
    drawPropertyRow(propertyId)
    draw()
  }
}

function handlePropertyContextMenu(event: MouseEvent, propertyId: string) {
  const canvas = propCanvasRefs[propertyId]
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const time = screenToTime(x)

  // Check if we hit an existing keyframe
  const curve = environmentStore.keyframeCurves.get(propertyId)
  if (curve) {
    for (const kf of curve.keyframes) {
      const kfX = timeToScreen(kf.time)
      if (Math.abs(x - kfX) <= HIT_THRESHOLD) {
        contextMenu.value = {
          x: event.clientX,
          y: event.clientY,
          property: propertyId,
          time: kf.time,
        }
        return
      }
    }
  }

  // Show add menu
  contextMenu.value = {
    x: event.clientX,
    y: event.clientY,
    property: '',  // Empty triggers "add new" for this property
    time,
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

  // Draw environment preview bar
  const bg = environmentStore.state.backgroundColor
  const bgColor = `rgba(${Math.round(bg[0]*255)}, ${Math.round(bg[1]*255)}, ${Math.round(bg[2]*255)}, ${bg[3]})`

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 10, width, height - 20)

  ctx.strokeStyle = hexToRgba(props.categoryColor, 0.5)
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 10.5, width - 1, height - 21)

  // Draw keyframe diamonds for all environment properties
  const keyframedProps = envProperties.map(p => p.id)
  const propColors: Record<string, string> = {
    backgroundColor: '#68D391',
    skyboxEnabled: '#68D391',
    hdriIntensity: '#68D391',
    hdriRotation: '#68D391',
    ambientColor: '#F6AD55',
    ambientIntensity: '#F6AD55',
    fogEnabled: '#9F7AEA',
    fogColor: '#9F7AEA',
    fogNear: '#9F7AEA',
    fogFar: '#9F7AEA',
    fogDensity: '#9F7AEA',
  }

  for (const propId of keyframedProps) {
    if (!environmentStore.hasKeyframes(propId)) continue

    const curve = environmentStore.keyframeCurves.get(propId)
    if (!curve) continue

    for (const kf of curve.keyframes) {
      const x = (kf.time * props.zoom) - props.scrollX
      if (x < -8 || x > width + 8) continue

      const color = propColors[propId] || props.categoryColor

      // Check if this keyframe is selected
      const isSelected = selectedKeyframe.value?.property === propId &&
                         Math.abs(selectedKeyframe.value.time - kf.time) < 0.001

      // Diamond shape
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x, height/2 - 5)
      ctx.lineTo(x + 4, height/2)
      ctx.lineTo(x, height/2 + 5)
      ctx.lineTo(x - 4, height/2)
      ctx.closePath()
      ctx.fill()

      // Selection highlight
      if (isSelected) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, height/2 - 7)
        ctx.lineTo(x + 6, height/2)
        ctx.lineTo(x, height/2 + 7)
        ctx.lineTo(x - 6, height/2)
        ctx.closePath()
        ctx.stroke()
      }
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

  // Listen for clicks outside to close context menu
  document.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  document.removeEventListener('click', handleGlobalClick)
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

/* Context Menu */
.env-context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 160px;
  background: #252538;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  padding: 4px 0;
  overflow: hidden;
}

.menu-header {
  padding: 6px 12px;
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(0, 0, 0, 0.2);
}

.menu-label {
  padding: 4px 12px 2px;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
}

.menu-item {
  display: block;
  width: 100%;
  padding: 6px 12px;
  text-align: left;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.1s;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.menu-item.danger {
  color: #f87171;
}

.menu-item.danger:hover {
  background: rgba(248, 113, 113, 0.15);
}

.menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 4px 0;
}
</style>
