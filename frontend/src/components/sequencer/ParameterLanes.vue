<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useSequencerStore, type SequencerNote, type ParameterLaneConfig } from '@/stores/sequencer'

const sequencer = useSequencerStore()
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
let animFrameId: number | null = null

// Layout constants - GUTTER_W must match SequencerTimeline
const LANE_H = 60
const GUTTER_W = 56
const COLLAPSE_BTN_SIZE = 10

// Interaction state
const isDragging = ref(false)
const dragNoteId = ref<string | null>(null)
const dragParamIndex = ref(-1)
const dragLaneIndex = ref(-1)

// Visible (non-collapsed) lanes
const visibleLanes = computed(() =>
  sequencer.parameterLanes.filter(l => !l.collapsed)
)

const totalHeight = computed(() => {
  if (!sequencer.parameterLanesVisible) return 0
  // Collapsed header rows (16px each) + visible lane bodies
  const collapsedCount = sequencer.parameterLanes.filter(l => l.collapsed).length
  const visibleCount = visibleLanes.value.length
  if (visibleCount === 0 && collapsedCount === 0) return 0
  return visibleCount * LANE_H + collapsedCount * 16
})

// ── Coordinate transforms (shared time axis with frequency roll) ──

function timeToX(t: number): number {
  return GUTTER_W + (t - sequencer.viewport.scrollX) * sequencer.viewport.zoomX
}

function xToTime(x: number): number {
  return (x - GUTTER_W) / sequencer.viewport.zoomX + sequencer.viewport.scrollX
}

function valueToY(value: number, lane: ParameterLaneConfig, laneTop: number): number {
  const range = lane.max - lane.min
  if (range === 0) return laneTop + LANE_H / 2
  const normalized = (value - lane.min) / range
  return laneTop + LANE_H * (1 - Math.max(0, Math.min(1, normalized)))
}

function yToValue(y: number, lane: ParameterLaneConfig, laneTop: number): number {
  const normalized = 1 - (y - laneTop) / LANE_H
  return lane.min + Math.max(0, Math.min(1, normalized)) * (lane.max - lane.min)
}

// ── Lane layout helpers ──────────────────────────────────────────

interface LaneLayout {
  lane: ParameterLaneConfig
  top: number
  height: number
  isCollapsed: boolean
}

function getLaneLayouts(): LaneLayout[] {
  const layouts: LaneLayout[] = []
  let y = 0
  for (const lane of sequencer.parameterLanes) {
    if (lane.collapsed) {
      layouts.push({ lane, top: y, height: 16, isCollapsed: true })
      y += 16
    } else {
      layouts.push({ lane, top: y, height: LANE_H, isCollapsed: false })
      y += LANE_H
    }
  }
  return layouts
}

function getLaneAtY(y: number): LaneLayout | null {
  for (const layout of getLaneLayouts()) {
    if (y >= layout.top && y < layout.top + layout.height) {
      return layout
    }
  }
  return null
}

// ── Hit testing ──────────────────────────────────────────────────

function getNoteBarAtPoint(x: number, y: number): { note: SequencerNote; laneLayout: LaneLayout } | null {
  const layout = getLaneAtY(y)
  if (!layout || layout.isCollapsed) return null

  const t = xToTime(x)

  for (const note of sequencer.activeClipNotes) {
    const noteEnd = note.startTime + note.duration
    if (t >= note.startTime && t <= noteEnd) {
      // Check if Y is within the bar area
      const paramValue = layout.lane.paramIndex < note.params.length
        ? note.params[layout.lane.paramIndex]
        : 0
      const barY = valueToY(paramValue, layout.lane, layout.top)
      const barBottom = layout.top + LANE_H

      if (y >= Math.min(barY, barBottom) - 2 && y <= Math.max(barY, barBottom) + 2) {
        return { note, laneLayout: layout }
      }
    }
  }
  return null
}

// ── Drawing ──────────────────────────────────────────────────────

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height
  const vp = sequencer.viewport

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, w, h)

  const layouts = getLaneLayouts()
  if (layouts.length === 0) return

  const beatDur = 60 / sequencer.bpm
  const barDur = beatDur * 4
  const visibleStart = vp.scrollX
  const visibleEnd = vp.scrollX + (w - GUTTER_W) / vp.zoomX

  // Determine grid density
  let gridInterval = beatDur
  if (vp.zoomX * beatDur < 8) {
    gridInterval = barDur
  } else if (vp.zoomX * beatDur > 60) {
    gridInterval = beatDur / 4
  }

  const clipColor = sequencer.activeClip?.color || '#3b82f6'

  for (const layout of layouts) {
    const { lane, top: laneTop, height: laneHeight, isCollapsed } = layout

    if (isCollapsed) {
      // Draw collapsed header
      ctx.fillStyle = '#111827'
      ctx.fillRect(0, laneTop, w, 16)

      // Collapse toggle (right-pointing triangle)
      ctx.fillStyle = '#6b7280'
      ctx.beginPath()
      ctx.moveTo(6, laneTop + 4)
      ctx.lineTo(14, laneTop + 8)
      ctx.lineTo(6, laneTop + 12)
      ctx.closePath()
      ctx.fill()

      // Label
      ctx.fillStyle = '#6b7280'
      ctx.font = '9px monospace'
      ctx.textBaseline = 'middle'
      ctx.fillText(lane.paramName, 18, laneTop + 8)

      // Separator
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, laneTop + 15.5)
      ctx.lineTo(w, laneTop + 15.5)
      ctx.stroke()
      continue
    }

    // ── Lane background ──────────────────────────────────────────
    ctx.fillStyle = lane.paramIndex % 2 === 0 ? '#111827' : '#0f172a'
    ctx.fillRect(GUTTER_W, laneTop, w - GUTTER_W, LANE_H)

    // ── Grid lines ───────────────────────────────────────────────
    const gridStart = Math.floor(visibleStart / gridInterval) * gridInterval
    for (let t = gridStart; t <= visibleEnd; t += gridInterval) {
      const x = Math.round(timeToX(t)) + 0.5
      if (x < GUTTER_W) continue
      const isBar = Math.abs(t % barDur) < 0.001
      ctx.strokeStyle = isBar ? '#1e293b' : '#111827'
      ctx.lineWidth = isBar ? 0.5 : 0.25
      ctx.beginPath()
      ctx.moveTo(x, laneTop)
      ctx.lineTo(x, laneTop + LANE_H)
      ctx.stroke()
    }

    // ── Zero/reference line ──────────────────────────────────────
    const zeroY = valueToY(0, lane, laneTop)
    if (zeroY > laneTop && zeroY < laneTop + LANE_H) {
      ctx.strokeStyle = '#374151'
      ctx.lineWidth = 0.5
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.moveTo(GUTTER_W, Math.round(zeroY) + 0.5)
      ctx.lineTo(w, Math.round(zeroY) + 0.5)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── Note parameter bars ──────────────────────────────────────
    for (const note of sequencer.activeClipNotes) {
      if (note.muted) continue
      const paramValue = lane.paramIndex < note.params.length
        ? note.params[lane.paramIndex]
        : 0

      const x = timeToX(note.startTime)
      const barW = note.duration * vp.zoomX
      const barY = valueToY(paramValue, lane, laneTop)
      const barBottom = laneTop + LANE_H

      // Skip if offscreen
      if (x + barW < GUTTER_W || x > w) continue

      const clampedX = Math.max(x, GUTTER_W)
      const clampedW = Math.min(barW, w - clampedX)
      const barHeight = barBottom - barY

      // Fill bar
      const rgb = hexToRgb(clipColor)
      const alpha = note.selected ? 0.7 : 0.4
      ctx.fillStyle = note.selected
        ? `rgba(96, 165, 250, ${alpha})`
        : `rgba(${rgb}, ${alpha})`
      ctx.fillRect(clampedX, barY, clampedW, barHeight)

      // Top edge line (value indicator)
      ctx.strokeStyle = note.selected ? '#93c5fd' : `rgba(${rgb}, 0.9)`
      ctx.lineWidth = note.selected ? 2 : 1
      ctx.beginPath()
      ctx.moveTo(clampedX, Math.round(barY) + 0.5)
      ctx.lineTo(clampedX + clampedW, Math.round(barY) + 0.5)
      ctx.stroke()

      // Value label if bar is wide enough
      if (barW > 35) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.font = '8px monospace'
        ctx.textBaseline = 'bottom'
        ctx.fillText(
          formatParamValue(paramValue, lane.paramName),
          clampedX + 2, barY - 1,
        )
      }
    }

    // ── Gutter ───────────────────────────────────────────────────
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, laneTop, GUTTER_W, LANE_H)

    // Collapse toggle (down-pointing triangle)
    ctx.fillStyle = '#9ca3af'
    ctx.beginPath()
    ctx.moveTo(4, laneTop + 6)
    ctx.lineTo(14, laneTop + 6)
    ctx.lineTo(9, laneTop + 13)
    ctx.closePath()
    ctx.fill()

    // Parameter name
    ctx.fillStyle = '#d1d5db'
    ctx.font = '9px monospace'
    ctx.textBaseline = 'top'
    ctx.fillText(truncateLabel(lane.paramName, 7), 4, laneTop + 16)

    // Min/max range
    ctx.fillStyle = '#6b7280'
    ctx.font = '8px monospace'
    ctx.textBaseline = 'bottom'
    ctx.fillText(formatNum(lane.max), 4, laneTop + LANE_H - 14)
    ctx.fillText(formatNum(lane.min), 4, laneTop + LANE_H - 2)

    // Gutter border
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(GUTTER_W + 0.5, laneTop)
    ctx.lineTo(GUTTER_W + 0.5, laneTop + LANE_H)
    ctx.stroke()

    // Lane separator
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, Math.round(laneTop + LANE_H) + 0.5)
    ctx.lineTo(w, Math.round(laneTop + LANE_H) + 0.5)
    ctx.stroke()
  }

  // ── Playback cursor ───────────────────────────────────────────
  const totalH = layouts.reduce((s, l) => s + l.height, 0)
  const cursorX = timeToX(sequencer.playheadPosition)
  if (cursorX >= GUTTER_W && cursorX <= w) {
    ctx.strokeStyle = sequencer.transport === 'playing' ? '#22c55e' : '#ef4444'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cursorX, 0)
    ctx.lineTo(cursorX, totalH)
    ctx.stroke()
  }
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '100, 100, 100'
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}

function formatParamValue(value: number, paramName: string): string {
  if (paramName === 'frequency') return `${Math.round(value)}Hz`
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(3)
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  if (Math.abs(n) >= 100) return Math.round(n).toString()
  return n.toFixed(1)
}

function truncateLabel(s: string, maxLen: number): string {
  return s.length > maxLen ? s.substring(0, maxLen - 1) + '\u2026' : s
}

// ── Mouse interactions ──────────────────────────────────────────

function handleMouseDown(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (canvas.width / rect.width)
  const y = (e.clientY - rect.top) * (canvas.height / rect.height)

  // Check collapse toggle clicks in gutter
  if (x < GUTTER_W) {
    const layout = getLaneAtY(y)
    if (layout) {
      // Toggle collapse on click in the gutter area
      const relY = y - layout.top
      if (relY < 16) {
        sequencer.toggleParameterLane(layout.lane.paramIndex)
        resizeCanvas()
        requestDraw()
      }
    }
    return
  }

  // Check for note bar hit
  const hit = getNoteBarAtPoint(x, y)
  if (hit) {
    // Select the note
    if (!e.shiftKey) sequencer.deselectAll()
    hit.note.selected = true

    // Start drag to edit parameter value
    isDragging.value = true
    dragNoteId.value = hit.note.id
    dragParamIndex.value = hit.laneLayout.lane.paramIndex
    dragLaneIndex.value = sequencer.parameterLanes.indexOf(hit.laneLayout.lane)
    sequencer.pushUndo()
    requestDraw()
  }
}

function handleMouseMove(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (canvas.width / rect.width)
  const y = (e.clientY - rect.top) * (canvas.height / rect.height)

  if (isDragging.value && dragNoteId.value && dragLaneIndex.value >= 0) {
    const lane = sequencer.parameterLanes[dragLaneIndex.value]
    if (!lane || lane.collapsed) return

    const layout = getLaneLayouts()[dragLaneIndex.value]
    if (!layout) return

    const newValue = yToValue(y, lane, layout.top)
    const clamped = Math.max(lane.min, Math.min(lane.max, newValue))
    sequencer.updateNoteParam(dragNoteId.value, dragParamIndex.value, clamped)
    requestDraw()
    return
  }

  // Hover cursor
  if (x < GUTTER_W) {
    canvas.style.cursor = 'pointer'
  } else {
    const hit = getNoteBarAtPoint(x, y)
    canvas.style.cursor = hit ? 'ns-resize' : 'default'
  }
}

function handleMouseUp(_e: MouseEvent) {
  isDragging.value = false
  dragNoteId.value = null
  dragParamIndex.value = -1
  dragLaneIndex.value = -1
  requestDraw()
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (canvas.width / rect.width)

  if (e.ctrlKey || e.metaKey) {
    // Zoom time axis
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const timeAtCursor = xToTime(x)
    sequencer.viewport.zoomX = Math.max(10, Math.min(500, sequencer.viewport.zoomX * factor))
    sequencer.viewport.scrollX = timeAtCursor - (x - GUTTER_W) / sequencer.viewport.zoomX
    sequencer.viewport.scrollX = Math.max(0, sequencer.viewport.scrollX)
  } else if (e.shiftKey) {
    // Scroll time
    sequencer.viewport.scrollX = Math.max(0, sequencer.viewport.scrollX + e.deltaY / sequencer.viewport.zoomX)
  }

  requestDraw()
}

// ── Canvas resize handling ──────────────────────────────────────

function resizeCanvas() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  const rect = container.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`

  requestDraw()
}

let drawQueued = false
function requestDraw() {
  if (!drawQueued) {
    drawQueued = true
    requestAnimationFrame(() => {
      drawQueued = false
      draw()
    })
  }
}

// ── Animation loop for playhead ─────────────────────────────────

function animate() {
  if (sequencer.transport === 'playing') {
    draw()
  }
  animFrameId = requestAnimationFrame(animate)
}

// ── Lifecycle ───────────────────────────────────────────────────

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeCanvas()
  resizeObserver = new ResizeObserver(() => resizeCanvas())
  if (containerRef.value) resizeObserver.observe(containerRef.value)
  animFrameId = requestAnimationFrame(animate)
})

onBeforeUnmount(() => {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId)
  if (resizeObserver) resizeObserver.disconnect()
})

// Redraw when store data changes
watch(
  () => [sequencer.activeClipNotes, sequencer.viewport, sequencer.parameterLanes],
  () => requestDraw(),
  { deep: true },
)

// Resize when lanes collapse/expand
watch(totalHeight, () => {
  requestAnimationFrame(() => resizeCanvas())
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative w-full overflow-hidden border-t border-editor-border"
    :style="{ height: totalHeight + 'px' }"
    v-show="totalHeight > 0"
  >
    <canvas
      ref="canvasRef"
      class="absolute inset-0 w-full h-full"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @wheel.prevent="handleWheel"
      @contextmenu.prevent
    />
  </div>
</template>
