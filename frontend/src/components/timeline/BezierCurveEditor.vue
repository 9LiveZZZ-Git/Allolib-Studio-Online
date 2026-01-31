<!--
  BezierCurveEditor.vue

  Visual editor for custom Bezier easing curves.
  Similar to After Effects and CSS cubic-bezier editors.

  Features:
  - Draggable control point handles
  - Real-time curve preview
  - Preset curves (ease, easeIn, easeOut, etc.)
  - Value preview animation
  - Copy/paste curve values
-->
<template>
  <Teleport to="body">
    <div v-if="visible" class="bezier-editor-overlay" @click.self="$emit('cancel')">
      <div class="bezier-editor">
        <!-- Header -->
        <div class="editor-header">
          <h3>Edit Easing Curve</h3>
          <button class="close-btn" @click="$emit('cancel')" title="Close">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>

        <div class="editor-body">
          <!-- Presets -->
          <div class="presets-section">
            <div class="section-label">Presets</div>
            <div class="presets-grid">
              <button
                v-for="(points, name) in PRESETS"
                :key="name"
                class="preset-btn"
                :class="{ active: isPresetActive(points) }"
                @click="applyPreset(points)"
                :title="name"
              >
                <svg width="32" height="32" viewBox="0 0 32 32">
                  <path :d="getPresetPath(points)" fill="none" stroke="currentColor" stroke-width="2"/>
                </svg>
                <span class="preset-name">{{ formatPresetName(name) }}</span>
              </button>
            </div>
          </div>

          <!-- Canvas -->
          <div class="canvas-section">
            <canvas
              ref="canvasRef"
              width="240"
              height="240"
              @mousedown="startDrag"
              @mousemove="onDrag"
              @mouseup="endDrag"
              @mouseleave="endDrag"
            />

            <!-- Control point labels -->
            <div class="point-labels">
              <div class="point-label p1" :style="getP1LabelStyle()">
                P1 ({{ controlPoints[0].toFixed(2) }}, {{ controlPoints[1].toFixed(2) }})
              </div>
              <div class="point-label p2" :style="getP2LabelStyle()">
                P2 ({{ controlPoints[2].toFixed(2) }}, {{ controlPoints[3].toFixed(2) }})
              </div>
            </div>
          </div>

          <!-- Value inputs -->
          <div class="values-section">
            <div class="section-label">Control Points</div>
            <div class="value-inputs">
              <div class="input-group">
                <label>P1 X</label>
                <input
                  type="number"
                  v-model.number="controlPoints[0]"
                  min="0" max="1" step="0.01"
                  @input="updateCanvas"
                />
              </div>
              <div class="input-group">
                <label>P1 Y</label>
                <input
                  type="number"
                  v-model.number="controlPoints[1]"
                  min="-0.5" max="1.5" step="0.01"
                  @input="updateCanvas"
                />
              </div>
              <div class="input-group">
                <label>P2 X</label>
                <input
                  type="number"
                  v-model.number="controlPoints[2]"
                  min="0" max="1" step="0.01"
                  @input="updateCanvas"
                />
              </div>
              <div class="input-group">
                <label>P2 Y</label>
                <input
                  type="number"
                  v-model.number="controlPoints[3]"
                  min="-0.5" max="1.5" step="0.01"
                  @input="updateCanvas"
                />
              </div>
            </div>

            <!-- CSS value -->
            <div class="css-value">
              <label>CSS</label>
              <input
                type="text"
                :value="cssValue"
                readonly
                @click="copyCSS"
                title="Click to copy"
              />
            </div>
          </div>

          <!-- Preview -->
          <div class="preview-section">
            <div class="section-label">Preview</div>
            <div class="preview-track">
              <div
                class="preview-ball"
                :style="{ left: `${previewPosition * 100}%` }"
              />
            </div>
            <button class="preview-btn" @click="playPreview">
              {{ isPreviewPlaying ? 'Stop' : 'Play' }}
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="editor-footer">
          <button class="cancel-btn" @click="$emit('cancel')">Cancel</button>
          <button class="apply-btn" @click="apply">Apply</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { EASING_PRESETS, type BezierPoints } from '@/composables/useKeyframes'

// ─── Props & Emits ───────────────────────────────────────────────────────────

const props = defineProps<{
  visible: boolean
  initialPoints?: BezierPoints
}>()

const emit = defineEmits<{
  (e: 'apply', points: BezierPoints): void
  (e: 'cancel'): void
}>()

// ─── State ───────────────────────────────────────────────────────────────────

const canvasRef = ref<HTMLCanvasElement | null>(null)
const controlPoints = ref<BezierPoints>([0.25, 0.1, 0.25, 1])

const draggingPoint = ref<'p1' | 'p2' | null>(null)
const isPreviewPlaying = ref(false)
const previewPosition = ref(0)
let previewAnimationId: number | null = null

// ─── Presets ─────────────────────────────────────────────────────────────────

const PRESETS: Record<string, BezierPoints> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  easeInQuad: [0.55, 0.085, 0.68, 0.53],
  easeOutQuad: [0.25, 0.46, 0.45, 0.94],
  easeInCubic: [0.55, 0.055, 0.675, 0.19],
  easeOutCubic: [0.215, 0.61, 0.355, 1],
  easeOutBack: [0.175, 0.885, 0.32, 1.275],
  easeInBack: [0.6, -0.28, 0.735, 0.045],
}

// ─── Computed ────────────────────────────────────────────────────────────────

const cssValue = computed(() => {
  const [x1, y1, x2, y2] = controlPoints.value
  return `cubic-bezier(${x1.toFixed(3)}, ${y1.toFixed(3)}, ${x2.toFixed(3)}, ${y2.toFixed(3)})`
})

// ─── Canvas Drawing ──────────────────────────────────────────────────────────

const CANVAS_SIZE = 240
const PADDING = 20
const GRAPH_SIZE = CANVAS_SIZE - PADDING * 2

function updateCanvas(): void {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const [x1, y1, x2, y2] = controlPoints.value

  // Clear
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  // Background grid
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const pos = PADDING + (GRAPH_SIZE / 4) * i

    ctx.beginPath()
    ctx.moveTo(pos, PADDING)
    ctx.lineTo(pos, PADDING + GRAPH_SIZE)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(PADDING, pos)
    ctx.lineTo(PADDING + GRAPH_SIZE, pos)
    ctx.stroke()
  }

  // Linear reference line
  ctx.strokeStyle = '#444'
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(PADDING, PADDING + GRAPH_SIZE)
  ctx.lineTo(PADDING + GRAPH_SIZE, PADDING)
  ctx.stroke()
  ctx.setLineDash([])

  // Convert control points to canvas coordinates
  const p0 = { x: PADDING, y: PADDING + GRAPH_SIZE }
  const p1 = {
    x: PADDING + x1 * GRAPH_SIZE,
    y: PADDING + GRAPH_SIZE - y1 * GRAPH_SIZE
  }
  const p2 = {
    x: PADDING + x2 * GRAPH_SIZE,
    y: PADDING + GRAPH_SIZE - y2 * GRAPH_SIZE
  }
  const p3 = { x: PADDING + GRAPH_SIZE, y: PADDING }

  // Control point lines
  ctx.strokeStyle = '#666'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(p0.x, p0.y)
  ctx.lineTo(p1.x, p1.y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(p3.x, p3.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()

  // Bezier curve
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(p0.x, p0.y)
  ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
  ctx.stroke()

  // Control point handles
  // P1
  ctx.fillStyle = '#22c55e'
  ctx.beginPath()
  ctx.arc(p1.x, p1.y, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.stroke()

  // P2
  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.arc(p2.x, p2.y, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.stroke()

  // Start/End points
  ctx.fillStyle = '#888'
  ctx.beginPath()
  ctx.arc(p0.x, p0.y, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(p3.x, p3.y, 4, 0, Math.PI * 2)
  ctx.fill()
}

// ─── Drag Handling ───────────────────────────────────────────────────────────

function startDrag(e: MouseEvent): void {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const [x1, y1, x2, y2] = controlPoints.value

  // Convert to canvas coords
  const p1 = {
    x: PADDING + x1 * GRAPH_SIZE,
    y: PADDING + GRAPH_SIZE - y1 * GRAPH_SIZE
  }
  const p2 = {
    x: PADDING + x2 * GRAPH_SIZE,
    y: PADDING + GRAPH_SIZE - y2 * GRAPH_SIZE
  }

  // Check which point is being dragged
  const dist1 = Math.hypot(x - p1.x, y - p1.y)
  const dist2 = Math.hypot(x - p2.x, y - p2.y)

  if (dist1 < 15) {
    draggingPoint.value = 'p1'
  } else if (dist2 < 15) {
    draggingPoint.value = 'p2'
  }
}

function onDrag(e: MouseEvent): void {
  if (!draggingPoint.value) return

  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left - PADDING) / GRAPH_SIZE
  const y = 1 - (e.clientY - rect.top - PADDING) / GRAPH_SIZE

  // Clamp x to 0-1, allow y to overshoot slightly
  const clampedX = Math.max(0, Math.min(1, x))
  const clampedY = Math.max(-0.5, Math.min(1.5, y))

  if (draggingPoint.value === 'p1') {
    controlPoints.value[0] = clampedX
    controlPoints.value[1] = clampedY
  } else {
    controlPoints.value[2] = clampedX
    controlPoints.value[3] = clampedY
  }

  updateCanvas()
}

function endDrag(): void {
  draggingPoint.value = null
}

// ─── Presets ─────────────────────────────────────────────────────────────────

function applyPreset(points: BezierPoints): void {
  controlPoints.value = [...points]
  updateCanvas()
}

function isPresetActive(points: BezierPoints): boolean {
  return controlPoints.value.every((v, i) => Math.abs(v - points[i]) < 0.01)
}

function getPresetPath(points: BezierPoints): string {
  const [x1, y1, x2, y2] = points
  const scale = 28
  const offset = 2
  return `M ${offset} ${scale + offset} C ${offset + x1 * scale} ${scale + offset - y1 * scale} ${offset + x2 * scale} ${scale + offset - y2 * scale} ${scale + offset} ${offset}`
}

function formatPresetName(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').trim()
}

// ─── Preview Animation ───────────────────────────────────────────────────────

function playPreview(): void {
  if (isPreviewPlaying.value) {
    stopPreview()
    return
  }

  isPreviewPlaying.value = true
  previewPosition.value = 0

  const duration = 1000 // 1 second
  const startTime = performance.now()

  function animate(currentTime: number): void {
    const elapsed = currentTime - startTime
    const t = Math.min(1, elapsed / duration)

    // Apply bezier easing
    previewPosition.value = evaluateBezier(t, controlPoints.value)

    if (t < 1) {
      previewAnimationId = requestAnimationFrame(animate)
    } else {
      isPreviewPlaying.value = false
      previewAnimationId = null
    }
  }

  previewAnimationId = requestAnimationFrame(animate)
}

function stopPreview(): void {
  if (previewAnimationId !== null) {
    cancelAnimationFrame(previewAnimationId)
    previewAnimationId = null
  }
  isPreviewPlaying.value = false
  previewPosition.value = 0
}

function evaluateBezier(t: number, points: BezierPoints): number {
  const [x1, y1, x2, y2] = points

  // Newton-Raphson to find parameter
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
  const t2 = t * t
  const t3 = t2 * t
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3
}

// ─── Label Positions ─────────────────────────────────────────────────────────

function getP1LabelStyle() {
  const [x1, y1] = controlPoints.value
  return {
    left: `${PADDING + x1 * GRAPH_SIZE}px`,
    top: `${PADDING + GRAPH_SIZE - y1 * GRAPH_SIZE + 15}px`,
  }
}

function getP2LabelStyle() {
  const [, , x2, y2] = controlPoints.value
  return {
    left: `${PADDING + x2 * GRAPH_SIZE}px`,
    top: `${PADDING + GRAPH_SIZE - y2 * GRAPH_SIZE - 25}px`,
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

function apply(): void {
  emit('apply', [...controlPoints.value] as BezierPoints)
}

function copyCSS(): void {
  navigator.clipboard.writeText(cssValue.value)
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

watch(() => props.visible, (visible) => {
  if (visible) {
    if (props.initialPoints) {
      controlPoints.value = [...props.initialPoints]
    }
    nextTick(() => updateCanvas())
  } else {
    stopPreview()
  }
})

onMounted(() => {
  if (props.visible) {
    updateCanvas()
  }
})

onUnmounted(() => {
  stopPreview()
})
</script>

<style scoped>
.bezier-editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.bezier-editor {
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  width: 360px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #3c3c3c;
}

.editor-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #fff;
}

.editor-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.section-label {
  font-size: 11px;
  font-weight: 500;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

/* Presets */
.presets-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.preset-btn {
  background: #2a2a2a;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: #888;
  transition: all 0.15s;
}

.preset-btn:hover {
  background: #333;
  color: #fff;
}

.preset-btn.active {
  border-color: #3b82f6;
  color: #3b82f6;
}

.preset-name {
  font-size: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* Canvas */
.canvas-section {
  position: relative;
  display: flex;
  justify-content: center;
}

.canvas-section canvas {
  background: #1a1a1a;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  cursor: crosshair;
}

.point-labels {
  position: absolute;
  pointer-events: none;
}

.point-label {
  position: absolute;
  font-size: 10px;
  color: #888;
  white-space: nowrap;
  transform: translateX(-50%);
}

.point-label.p1 {
  color: #22c55e;
}

.point-label.p2 {
  color: #f59e0b;
}

/* Values */
.value-inputs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-group label {
  font-size: 10px;
  color: #888;
}

.input-group input {
  background: #2a2a2a;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  color: #fff;
  width: 100%;
}

.input-group input:focus {
  outline: none;
  border-color: #3b82f6;
}

.css-value {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.css-value label {
  font-size: 10px;
  color: #888;
  flex-shrink: 0;
}

.css-value input {
  flex: 1;
  background: #2a2a2a;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 11px;
  font-family: monospace;
  color: #888;
  cursor: pointer;
}

.css-value input:hover {
  border-color: #3b82f6;
}

/* Preview */
.preview-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-track {
  height: 8px;
  background: #2a2a2a;
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.preview-ball {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: #3b82f6;
  border-radius: 50%;
  transition: left 0.05s linear;
}

.preview-btn {
  background: #2a2a2a;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  color: #fff;
  cursor: pointer;
}

.preview-btn:hover {
  background: #333;
}

/* Footer */
.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #3c3c3c;
}

.cancel-btn,
.apply-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}

.cancel-btn {
  background: none;
  border: 1px solid #3c3c3c;
  color: #888;
}

.cancel-btn:hover {
  background: #2a2a2a;
  color: #fff;
}

.apply-btn {
  background: #3b82f6;
  border: none;
  color: #fff;
}

.apply-btn:hover {
  background: #2563eb;
}
</style>
