<!--
  CurveEditor.vue

  A modal curve editor for keyframe interpolation.
  Supports bezier curves with tangent handles and preset easing types.
-->
<template>
  <Teleport to="body">
    <div v-if="visible" class="curve-editor-overlay" @click.self="close">
      <div class="curve-editor-modal">
        <!-- Header -->
        <div class="curve-header">
          <h3>Curve Editor</h3>
          <div class="curve-info">
            <span class="property-name">{{ propertyName }}</span>
            <span class="time-range">{{ startTime.toFixed(2) }}s → {{ endTime.toFixed(2) }}s</span>
          </div>
          <button class="close-btn" @click="close">×</button>
        </div>

        <!-- Preset buttons -->
        <div class="preset-bar">
          <button
            v-for="preset in presets"
            :key="preset.name"
            class="preset-btn"
            :class="{ active: currentPreset === preset.name }"
            @click="applyPreset(preset)"
            :title="preset.name"
          >
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path :d="preset.icon" stroke="currentColor" fill="none" stroke-width="1.5" />
            </svg>
            <span>{{ preset.label }}</span>
          </button>
        </div>

        <!-- Canvas area -->
        <div class="canvas-container" ref="containerRef">
          <canvas
            ref="canvasRef"
            @mousedown="onMouseDown"
            @mousemove="onMouseMove"
            @mouseup="onMouseUp"
            @mouseleave="onMouseUp"
          />

          <!-- Value labels -->
          <div class="value-label start-value">{{ formatValue(startValue) }}</div>
          <div class="value-label end-value">{{ formatValue(endValue) }}</div>
        </div>

        <!-- Bezier controls -->
        <div class="bezier-controls">
          <div class="control-group">
            <label>Handle 1 (Out)</label>
            <div class="handle-inputs">
              <input
                type="number"
                v-model.number="bezierPoints[0]"
                step="0.01"
                min="0"
                max="1"
                @change="updateCurve"
              />
              <input
                type="number"
                v-model.number="bezierPoints[1]"
                step="0.01"
                @change="updateCurve"
              />
            </div>
          </div>
          <div class="control-group">
            <label>Handle 2 (In)</label>
            <div class="handle-inputs">
              <input
                type="number"
                v-model.number="bezierPoints[2]"
                step="0.01"
                min="0"
                max="1"
                @change="updateCurve"
              />
              <input
                type="number"
                v-model.number="bezierPoints[3]"
                step="0.01"
                @change="updateCurve"
              />
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="curve-footer">
          <button class="btn-secondary" @click="reset">Reset</button>
          <button class="btn-primary" @click="apply">Apply</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'

export interface CurvePreset {
  name: string
  label: string
  icon: string
  bezier: [number, number, number, number]
}

const props = defineProps<{
  visible: boolean
  propertyName: string
  startTime: number
  endTime: number
  startValue: number
  endValue: number
  initialBezier?: [number, number, number, number]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', bezier: [number, number, number, number]): void
}>()

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()

// Bezier control points: [x1, y1, x2, y2] normalized 0-1
const bezierPoints = ref<[number, number, number, number]>([0.25, 0.1, 0.25, 1.0])
const currentPreset = ref<string>('')
const draggingHandle = ref<1 | 2 | null>(null)

// Presets with SVG path icons
const presets: CurvePreset[] = [
  {
    name: 'linear',
    label: 'Linear',
    icon: 'M4 20L20 4',
    bezier: [0, 0, 1, 1],
  },
  {
    name: 'easeIn',
    label: 'Ease In',
    icon: 'M4 20Q4 4 20 4',
    bezier: [0.42, 0, 1, 1],
  },
  {
    name: 'easeOut',
    label: 'Ease Out',
    icon: 'M4 20Q20 20 20 4',
    bezier: [0, 0, 0.58, 1],
  },
  {
    name: 'easeInOut',
    label: 'Ease In-Out',
    icon: 'M4 20C4 12 20 12 20 4',
    bezier: [0.42, 0, 0.58, 1],
  },
  {
    name: 'easeOutBack',
    label: 'Back',
    icon: 'M4 20C8 24 16 0 20 4',
    bezier: [0.34, 1.56, 0.64, 1],
  },
  {
    name: 'bounce',
    label: 'Bounce',
    icon: 'M4 20Q8 4 12 12Q16 4 20 4',
    bezier: [0.68, -0.55, 0.27, 1.55],
  },
  {
    name: 'elastic',
    label: 'Elastic',
    icon: 'M4 20C6 28 10 -4 20 4',
    bezier: [0.68, -0.6, 0.32, 1.6],
  },
  {
    name: 'step',
    label: 'Step',
    icon: 'M4 20H12V4H20',
    bezier: [0, 0, 0, 0], // Special case handled separately
  },
]

// Canvas dimensions
const canvasWidth = 300
const canvasHeight = 200
const padding = 30

function close() {
  emit('close')
}

function apply() {
  emit('apply', [...bezierPoints.value] as [number, number, number, number])
  close()
}

function reset() {
  bezierPoints.value = props.initialBezier
    ? [...props.initialBezier] as [number, number, number, number]
    : [0.25, 0.1, 0.25, 1.0]
  currentPreset.value = ''
  updateCurve()
}

function applyPreset(preset: CurvePreset) {
  bezierPoints.value = [...preset.bezier] as [number, number, number, number]
  currentPreset.value = preset.name
  updateCurve()
}

function formatValue(val: number): string {
  if (Math.abs(val) < 0.01) return '0'
  if (Math.abs(val) >= 1000) return val.toFixed(0)
  if (Math.abs(val) >= 100) return val.toFixed(1)
  return val.toFixed(2)
}

// Coordinate conversion
function canvasToNorm(x: number, y: number): [number, number] {
  const w = canvasWidth - padding * 2
  const h = canvasHeight - padding * 2
  return [
    Math.max(0, Math.min(1, (x - padding) / w)),
    Math.max(-0.5, Math.min(1.5, 1 - (y - padding) / h)),
  ]
}

function normToCanvas(nx: number, ny: number): [number, number] {
  const w = canvasWidth - padding * 2
  const h = canvasHeight - padding * 2
  return [
    padding + nx * w,
    padding + (1 - ny) * h,
  ]
}

// Bezier curve evaluation
function bezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const t2 = t * t
  const t3 = t2 * t
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3
}

// Get Y value at time T using cubic bezier
function getYAtT(t: number): number {
  const [x1, y1, x2, y2] = bezierPoints.value
  // Approximate: find parameter that gives x ≈ t, then return y
  // Using Newton-Raphson iteration
  let guess = t
  for (let i = 0; i < 8; i++) {
    const x = bezier(guess, 0, x1, x2, 1)
    const dx = 3 * (1 - guess) * (1 - guess) * x1 + 6 * (1 - guess) * guess * (x2 - x1) + 3 * guess * guess * (1 - x2)
    if (Math.abs(dx) < 0.0001) break
    guess -= (x - t) / dx
    guess = Math.max(0, Math.min(1, guess))
  }
  return bezier(guess, 0, y1, y2, 1)
}

function updateCurve() {
  drawCurve()
}

function drawCurve() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  canvas.width = canvasWidth * dpr
  canvas.height = canvasHeight * dpr
  canvas.style.width = `${canvasWidth}px`
  canvas.style.height = `${canvasHeight}px`
  ctx.scale(dpr, dpr)

  // Clear
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // Draw grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 1

  // Vertical grid lines
  for (let i = 0; i <= 4; i++) {
    const x = padding + (i / 4) * (canvasWidth - padding * 2)
    ctx.beginPath()
    ctx.moveTo(x, padding)
    ctx.lineTo(x, canvasHeight - padding)
    ctx.stroke()
  }

  // Horizontal grid lines
  for (let i = 0; i <= 4; i++) {
    const y = padding + (i / 4) * (canvasHeight - padding * 2)
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(canvasWidth - padding, y)
    ctx.stroke()
  }

  // Draw diagonal reference (linear)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  const [startX, startY] = normToCanvas(0, 0)
  const [endX, endY] = normToCanvas(1, 1)
  ctx.moveTo(startX, startY)
  ctx.lineTo(endX, endY)
  ctx.stroke()
  ctx.setLineDash([])

  // Draw the bezier curve
  ctx.strokeStyle = '#60A5FA'
  ctx.lineWidth = 2
  ctx.beginPath()

  const [sx, sy] = normToCanvas(0, 0)
  ctx.moveTo(sx, sy)

  for (let t = 0; t <= 1; t += 0.01) {
    const y = getYAtT(t)
    const [cx, cy] = normToCanvas(t, y)
    ctx.lineTo(cx, cy)
  }
  ctx.stroke()

  // Draw control point handles
  const [x1, y1, x2, y2] = bezierPoints.value
  const [h1x, h1y] = normToCanvas(x1, y1)
  const [h2x, h2y] = normToCanvas(x2, y2)
  const [p0x, p0y] = normToCanvas(0, 0)
  const [p1x, p1y] = normToCanvas(1, 1)

  // Handle lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.moveTo(p0x, p0y)
  ctx.lineTo(h1x, h1y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(p1x, p1y)
  ctx.lineTo(h2x, h2y)
  ctx.stroke()

  // Start/end points
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(p0x, p0y, 5, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(p1x, p1y, 5, 0, Math.PI * 2)
  ctx.fill()

  // Control handles
  ctx.fillStyle = '#F59E0B'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2

  ctx.beginPath()
  ctx.arc(h1x, h1y, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(h2x, h2y, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

// Mouse interaction
function onMouseDown(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const [x1, y1, x2, y2] = bezierPoints.value
  const [h1x, h1y] = normToCanvas(x1, y1)
  const [h2x, h2y] = normToCanvas(x2, y2)

  // Check if clicking on handle 1
  if (Math.hypot(x - h1x, y - h1y) < 15) {
    draggingHandle.value = 1
    return
  }

  // Check if clicking on handle 2
  if (Math.hypot(x - h2x, y - h2y) < 15) {
    draggingHandle.value = 2
    return
  }
}

function onMouseMove(e: MouseEvent) {
  if (!draggingHandle.value) return

  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const [nx, ny] = canvasToNorm(x, y)

  if (draggingHandle.value === 1) {
    bezierPoints.value[0] = nx
    bezierPoints.value[1] = ny
  } else {
    bezierPoints.value[2] = nx
    bezierPoints.value[3] = ny
  }

  currentPreset.value = ''
  updateCurve()
}

function onMouseUp() {
  draggingHandle.value = null
}

// Initialize
watch(() => props.visible, (visible) => {
  if (visible) {
    if (props.initialBezier) {
      bezierPoints.value = [...props.initialBezier] as [number, number, number, number]
    }
    nextTick(drawCurve)
  }
})

onMounted(() => {
  if (props.visible) {
    nextTick(drawCurve)
  }
})
</script>

<style scoped>
.curve-editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.curve-editor-modal {
  background: #1e1e2e;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  width: 360px;
  overflow: hidden;
}

.curve-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #16213e;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.curve-header h3 {
  font-size: 14px;
  font-weight: 500;
  margin: 0;
  color: #fff;
}

.curve-info {
  margin-left: auto;
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.property-name {
  color: #60A5FA;
}

.close-btn {
  margin-left: 12px;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.preset-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 9px;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.preset-btn.active {
  background: rgba(96, 165, 250, 0.2);
  border-color: #60A5FA;
  color: #60A5FA;
}

.preset-btn svg {
  width: 20px;
  height: 20px;
}

.canvas-container {
  position: relative;
  padding: 12px;
  display: flex;
  justify-content: center;
}

.canvas-container canvas {
  border-radius: 4px;
  cursor: crosshair;
}

.value-label {
  position: absolute;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
}

.start-value {
  left: 8px;
  bottom: 16px;
}

.end-value {
  right: 8px;
  top: 16px;
}

.bezier-controls {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
}

.control-group {
  flex: 1;
}

.control-group label {
  display: block;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
  text-transform: uppercase;
}

.handle-inputs {
  display: flex;
  gap: 4px;
}

.handle-inputs input {
  flex: 1;
  width: 60px;
  padding: 4px 6px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  font-family: monospace;
}

.handle-inputs input:focus {
  outline: none;
  border-color: #60A5FA;
}

.curve-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-secondary,
.btn-primary {
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.btn-primary {
  background: #60A5FA;
  border: 1px solid #60A5FA;
  color: #fff;
}

.btn-primary:hover {
  background: #3B82F6;
  border-color: #3B82F6;
}
</style>
