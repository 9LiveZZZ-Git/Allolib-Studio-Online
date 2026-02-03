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
        <button class="delete-btn" @click="deleteKeyframe(contextMenu.keyframe)">Delete Keyframe</button>
        <div class="menu-divider" />
        <div class="menu-label">Easing</div>
        <button @click="setEasing(contextMenu.keyframe, 'linear')">
          <span class="easing-icon">╱</span> Linear
        </button>
        <button @click="setEasing(contextMenu.keyframe, 'easeIn')">
          <span class="easing-icon">╭</span> Ease In
        </button>
        <button @click="setEasing(contextMenu.keyframe, 'easeOut')">
          <span class="easing-icon">╮</span> Ease Out
        </button>
        <button @click="setEasing(contextMenu.keyframe, 'easeInOut')">
          <span class="easing-icon">∿</span> Ease In-Out
        </button>
        <button @click="setEasing(contextMenu.keyframe, 'easeOutBack')">
          <span class="easing-icon">↩</span> Back
        </button>
        <button @click="setEasing(contextMenu.keyframe, 'bounce')">
          <span class="easing-icon">⌢</span> Bounce
        </button>
        <button @click="setEasing(contextMenu.keyframe, 'elastic')">
          <span class="easing-icon">〰</span> Elastic
        </button>
        <button @click="setEasing(contextMenu.keyframe, 'step')">
          <span class="easing-icon">⌐</span> Step
        </button>
        <div class="menu-divider" />
        <button class="edit-curve-btn" @click="openCurveEditor(contextMenu.keyframe)">
          <span class="easing-icon">⚙</span> Edit Curve...
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useTimelineStore } from '@/stores/timeline'
import { useSequencerStore } from '@/stores/sequencer'

export type EasingType =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeOutBack'
  | 'bounce'
  | 'elastic'
  | 'step'
  | 'bezier'

export type BezierPoints = [number, number, number, number]

export interface Keyframe {
  time: number
  value: number | number[]
  easing: EasingType
  bezierPoints?: BezierPoints
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
  (e: 'easing', time: number, easing: EasingType, bezierPoints?: BezierPoints): void
  (e: 'edit-curve', keyframe: Keyframe, nextKeyframe: Keyframe | null): void
}>()

const timeline = useTimelineStore()
const sequencer = useSequencerStore()

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
  let time = timeFromX(e.clientX)
  // Apply snap if not 'none'
  if (sequencer.snapMode !== 'none') {
    time = timeline.snapTime(time)
  }
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
    let newTime = Math.max(0, Math.min(dragStartTime.value + deltaTime, props.duration))

    // Apply snap if not 'none'
    if (sequencer.snapMode !== 'none') {
      newTime = timeline.snapTime(newTime)
    }

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

function setEasing(kf: Keyframe, easing: EasingType, bezierPoints?: BezierPoints) {
  emit('easing', kf.time, easing, bezierPoints)
  closeContextMenu()
}

function openCurveEditor(kf: Keyframe) {
  // Find the next keyframe
  const idx = props.keyframes.findIndex(k => k.time === kf.time)
  const nextKf = idx >= 0 && idx < props.keyframes.length - 1 ? props.keyframes[idx + 1] : null
  emit('edit-curve', kf, nextKf)
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
  const easedT = applyEasing(t, kf1.easing, kf1.bezierPoints)

  if (Array.isArray(kf1.value) && Array.isArray(kf2.value)) {
    return kf1.value.map((v, idx) => v + (kf2.value[idx] - v) * easedT)
  }

  const v1 = Array.isArray(kf1.value) ? kf1.value[0] : kf1.value
  const v2 = Array.isArray(kf2.value) ? kf2.value[0] : kf2.value
  return v1 + (v2 - v1) * easedT
}

function applyEasing(t: number, easing: EasingType, bezierPoints?: BezierPoints): number {
  switch (easing) {
    case 'linear': return t
    case 'easeIn': return t * t * t
    case 'easeOut': return 1 - Math.pow(1 - t, 3)
    case 'easeInOut': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    case 'easeOutBack': {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    }
    case 'bounce': return bezierEase(t, 0.68, -0.55, 0.27, 1.55)
    case 'elastic': {
      if (t === 0 || t === 1) return t
      return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3)) + 1
    }
    case 'step': return t < 1 ? 0 : 1
    case 'bezier': return bezierPoints ? bezierEase(t, ...bezierPoints) : t
    default: return t
  }
}

function bezierEase(t: number, x1: number, y1: number, x2: number, y2: number): number {
  let guess = t
  for (let i = 0; i < 8; i++) {
    const x = cubicBezier(guess, 0, x1, x2, 1)
    const dx = 3 * (1 - guess) * (1 - guess) * x1 +
               6 * (1 - guess) * guess * (x2 - x1) +
               3 * guess * guess * (1 - x2)
    if (Math.abs(dx) < 0.0001) break
    guess -= (x - t) / dx
    guess = Math.max(0, Math.min(1, guess))
  }
  return cubicBezier(guess, 0, y1, y2, 1)
}

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
}

// Keyboard shortcuts
function onKeyDown(e: KeyboardEvent) {
  // Delete selected keyframes
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTimes.value.size > 0) {
    e.preventDefault()
    for (const time of selectedTimes.value) {
      emit('remove', time)
    }
    selectedTimes.value.clear()
    emit('select', [])
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  document.addEventListener('keydown', onKeyDown)
  if (props.expanded) {
    nextTick(drawCurve)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  document.removeEventListener('keydown', onKeyDown)
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
  border-radius: 6px;
  padding: 4px 0;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

.keyframe-context-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
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

.keyframe-context-menu .delete-btn {
  color: #FC8181;
}

.keyframe-context-menu .delete-btn:hover {
  background: rgba(252, 129, 129, 0.2);
}

.keyframe-context-menu .edit-curve-btn {
  color: #60A5FA;
}

.keyframe-context-menu .edit-curve-btn:hover {
  background: rgba(96, 165, 250, 0.2);
}

.keyframe-context-menu .menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 4px 0;
}

.keyframe-context-menu .menu-label {
  padding: 4px 12px 2px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
}

.keyframe-context-menu .easing-icon {
  width: 16px;
  text-align: center;
  font-family: monospace;
  opacity: 0.7;
}

.keyframe-context-menu button:first-child {
  color: #FC8181;
}

.keyframe-context-menu button:first-child:hover {
  background: rgba(252, 129, 129, 0.2);
}
</style>
