<!--
  KeyframeLane.vue

  Displays keyframe diamonds for a property on the timeline.
  Supports selection, dragging, and adding/removing keyframes.
-->
<template>
  <div
    class="keyframe-lane"
    ref="laneRef"
    :class="{ expanded }"
    @dblclick="handleDoubleClick"
  >
    <!-- Property label -->
    <div class="lane-label" v-if="showLabel">
      <span class="property-name">{{ propertyName }}</span>
      <span class="keyframe-count" v-if="keyframes.length > 0">
        {{ keyframes.length }}
      </span>
    </div>

    <!-- Keyframe diamonds -->
    <div class="keyframes-container">
      <div
        v-for="kf in visibleKeyframes"
        :key="kf.time"
        class="keyframe-diamond"
        :class="{
          selected: selectedTimes.has(kf.time),
          dragging: draggingKeyframe?.time === kf.time,
        }"
        :style="getKeyframeStyle(kf)"
        @mousedown.stop="startDragKeyframe($event, kf)"
        @click.stop="selectKeyframe($event, kf)"
        @contextmenu.prevent="openContextMenu($event, kf)"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M5 0L10 5L5 10L0 5Z" fill="currentColor" />
        </svg>
      </div>

      <!-- Curve preview (when expanded) -->
      <canvas
        v-if="expanded"
        ref="curveCanvas"
        class="curve-canvas"
      />
    </div>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu"
        class="keyframe-context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        @click.stop
      >
        <button @click="deleteKeyframe(contextMenu.keyframe)">Delete Keyframe</button>
        <button @click="setEasing(contextMenu.keyframe, 'linear')">Linear</button>
        <button @click="setEasing(contextMenu.keyframe, 'easeIn')">Ease In</button>
        <button @click="setEasing(contextMenu.keyframe, 'easeOut')">Ease Out</button>
        <button @click="setEasing(contextMenu.keyframe, 'easeInOut')">Ease In-Out</button>
        <button @click="closeContextMenu">Cancel</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

export interface Keyframe {
  time: number
  value: number | number[]
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'step'
}

const props = defineProps<{
  keyframes: Keyframe[]
  propertyName: string
  zoom: number
  scrollX: number
  color: string
  duration: number
  expanded?: boolean
  showLabel?: boolean
  minValue?: number
  maxValue?: number
}>()

const emit = defineEmits<{
  (e: 'add', time: number): void
  (e: 'remove', time: number): void
  (e: 'move', oldTime: number, newTime: number): void
  (e: 'select', times: number[]): void
  (e: 'easing', time: number, easing: Keyframe['easing']): void
}>()

const laneRef = ref<HTMLElement>()
const curveCanvas = ref<HTMLCanvasElement>()
const selectedTimes = ref<Set<number>>(new Set())
const draggingKeyframe = ref<Keyframe | null>(null)
const dragStartX = ref(0)
const dragStartTime = ref(0)

const contextMenu = ref<{
  x: number
  y: number
  keyframe: Keyframe
} | null>(null)

const visibleKeyframes = computed(() => {
  if (!laneRef.value) return props.keyframes

  const containerWidth = laneRef.value.clientWidth
  const startTime = props.scrollX / props.zoom
  const endTime = (props.scrollX + containerWidth) / props.zoom

  return props.keyframes.filter(kf =>
    kf.time >= startTime - 0.5 && kf.time <= endTime + 0.5
  )
})

function getKeyframeStyle(kf: Keyframe) {
  const x = (kf.time * props.zoom) - props.scrollX
  return {
    left: `${x}px`,
    '--kf-color': props.color,
  }
}

function timeFromX(clientX: number): number {
  const rect = laneRef.value?.getBoundingClientRect()
  if (!rect) return 0
  const x = clientX - rect.left
  return Math.max(0, Math.min((x + props.scrollX) / props.zoom, props.duration))
}

function handleDoubleClick(e: MouseEvent) {
  const time = timeFromX(e.clientX)
  emit('add', time)
}

function selectKeyframe(e: MouseEvent, kf: Keyframe) {
  if (e.shiftKey) {
    // Add to selection
    if (selectedTimes.value.has(kf.time)) {
      selectedTimes.value.delete(kf.time)
    } else {
      selectedTimes.value.add(kf.time)
    }
  } else if (e.ctrlKey || e.metaKey) {
    // Toggle selection
    if (selectedTimes.value.has(kf.time)) {
      selectedTimes.value.delete(kf.time)
    } else {
      selectedTimes.value.add(kf.time)
    }
  } else {
    // Single selection
    selectedTimes.value.clear()
    selectedTimes.value.add(kf.time)
  }

  emit('select', Array.from(selectedTimes.value))
}

function startDragKeyframe(e: MouseEvent, kf: Keyframe) {
  draggingKeyframe.value = kf
  dragStartX.value = e.clientX
  dragStartTime.value = kf.time

  window.addEventListener('mousemove', onDragKeyframe)
  window.addEventListener('mouseup', stopDragKeyframe)
}

function onDragKeyframe(e: MouseEvent) {
  if (!draggingKeyframe.value) return

  const deltaX = e.clientX - dragStartX.value
  const deltaTime = deltaX / props.zoom
  const newTime = Math.max(0, Math.min(dragStartTime.value + deltaTime, props.duration))

  // Visual feedback only - actual move happens on mouseup
  const diamond = laneRef.value?.querySelector('.keyframe-diamond.dragging') as HTMLElement
  if (diamond) {
    const x = (newTime * props.zoom) - props.scrollX
    diamond.style.left = `${x}px`
  }
}

function stopDragKeyframe(e: MouseEvent) {
  if (draggingKeyframe.value) {
    const deltaX = e.clientX - dragStartX.value
    const deltaTime = deltaX / props.zoom
    const newTime = Math.max(0, Math.min(dragStartTime.value + deltaTime, props.duration))

    if (Math.abs(newTime - dragStartTime.value) > 0.01) {
      emit('move', dragStartTime.value, newTime)
    }
  }

  draggingKeyframe.value = null
  window.removeEventListener('mousemove', onDragKeyframe)
  window.removeEventListener('mouseup', stopDragKeyframe)
}

function openContextMenu(e: MouseEvent, kf: Keyframe) {
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    keyframe: kf,
  }
}

function closeContextMenu() {
  contextMenu.value = null
}

function deleteKeyframe(kf: Keyframe) {
  emit('remove', kf.time)
  closeContextMenu()
}

function setEasing(kf: Keyframe, easing: Keyframe['easing']) {
  emit('easing', kf.time, easing)
  closeContextMenu()
}

// Close context menu on click outside
function onClickOutside(e: MouseEvent) {
  if (contextMenu.value) {
    closeContextMenu()
  }
}

// Draw curve preview
function drawCurve() {
  if (!props.expanded || !curveCanvas.value || !laneRef.value) return

  const canvas = curveCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = laneRef.value.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = rect.height
  const keyframes = props.keyframes

  if (keyframes.length < 2) return

  // Determine value range
  let minVal = props.minValue ?? Infinity
  let maxVal = props.maxValue ?? -Infinity

  if (minVal === Infinity || maxVal === -Infinity) {
    for (const kf of keyframes) {
      const v = Array.isArray(kf.value) ? kf.value[0] : kf.value
      minVal = Math.min(minVal, v)
      maxVal = Math.max(maxVal, v)
    }
    // Add padding
    const range = maxVal - minVal || 1
    minVal -= range * 0.1
    maxVal += range * 0.1
  }

  // Draw curve
  ctx.strokeStyle = props.color
  ctx.lineWidth = 1.5
  ctx.beginPath()

  for (let px = 0; px < width; px++) {
    const time = (px + props.scrollX) / props.zoom
    const value = interpolateValue(time, keyframes)
    const v = Array.isArray(value) ? value[0] : value
    const y = height - ((v - minVal) / (maxVal - minVal)) * height

    if (px === 0) {
      ctx.moveTo(px, y)
    } else {
      ctx.lineTo(px, y)
    }
  }

  ctx.stroke()
}

function interpolateValue(time: number, keyframes: Keyframe[]): number | number[] {
  if (keyframes.length === 0) return 0
  if (time <= keyframes[0].time) return keyframes[0].value
  if (time >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value

  let i = 0
  while (i < keyframes.length - 1 && keyframes[i + 1].time < time) {
    i++
  }

  const kf1 = keyframes[i]
  const kf2 = keyframes[i + 1]
  const t = (time - kf1.time) / (kf2.time - kf1.time)
  const easedT = applyEasing(t, kf1.easing)

  if (Array.isArray(kf1.value) && Array.isArray(kf2.value)) {
    return kf1.value.map((v, idx) => v + (kf2.value[idx] - v) * easedT)
  }

  const v1 = Array.isArray(kf1.value) ? kf1.value[0] : kf1.value
  const v2 = Array.isArray(kf2.value) ? kf2.value[0] : kf2.value
  return v1 + (v2 - v1) * easedT
}

function applyEasing(t: number, easing: Keyframe['easing']): number {
  switch (easing) {
    case 'linear': return t
    case 'easeIn': return t * t
    case 'easeOut': return 1 - (1 - t) * (1 - t)
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    case 'step': return t < 1 ? 0 : 1
    default: return t
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  if (props.expanded) {
    nextTick(drawCurve)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  stopDragKeyframe({ clientX: 0, clientY: 0 } as MouseEvent)
})

watch([() => props.keyframes, () => props.zoom, () => props.scrollX, () => props.expanded], () => {
  if (props.expanded) {
    nextTick(drawCurve)
  }
})
</script>

<style scoped>
.keyframe-lane {
  position: relative;
  height: 24px;
  background: rgba(0, 0, 0, 0.1);
  cursor: crosshair;
}

.keyframe-lane.expanded {
  height: 60px;
}

.lane-label {
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  z-index: 1;
}

.property-name {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
}

.keyframe-count {
  font-size: 8px;
  color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 4px;
  border-radius: 4px;
}

.keyframes-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.keyframe-diamond {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  cursor: pointer;
  color: var(--kf-color);
  transition: transform 0.1s, color 0.1s;
  z-index: 2;
}

.keyframe-diamond:hover {
  transform: translate(-50%, -50%) scale(1.3);
  color: #fff;
}

.keyframe-diamond.selected {
  color: #fff;
  filter: drop-shadow(0 0 2px var(--kf-color));
}

.keyframe-diamond.dragging {
  color: #fff;
  transform: translate(-50%, -50%) scale(1.2);
}

.curve-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.6;
}

/* Context menu */
.keyframe-context-menu {
  position: fixed;
  background: #2a2a3e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 4px 0;
  min-width: 140px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

.keyframe-context-menu button {
  display: block;
  width: 100%;
  padding: 6px 12px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.keyframe-context-menu button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.keyframe-context-menu button:first-child {
  color: #FC8181;
}

.keyframe-context-menu button:first-child:hover {
  background: rgba(252, 129, 129, 0.2);
}
</style>
