<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useSequencerStore, type SequencerEvent } from '@/stores/sequencer'

const sequencer = useSequencerStore()
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
let animFrameId: number | null = null

// Layout constants
const RULER_H = 24
const GUTTER_W = 56

// Interaction state
const isDragging = ref(false)
const dragMode = ref<'none' | 'move' | 'resize-right' | 'select-rect' | 'draw'>('none')
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartTime = ref(0)
const dragStartFreq = ref(0)
const dragTarget = ref<SequencerEvent | null>(null)
const dragOriginalStartTime = ref(0)
const dragOriginalDuration = ref(0)
const dragOriginalFreq = ref(0)
const selectionRect = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
const hoveredEvent = ref<SequencerEvent | null>(null)

// ── Coordinate transforms ───────────────────────────────────────────

function timeToX(t: number): number {
  return GUTTER_W + (t - sequencer.viewport.scrollX) * sequencer.viewport.zoomX
}

function xToTime(x: number): number {
  return (x - GUTTER_W) / sequencer.viewport.zoomX + sequencer.viewport.scrollX
}

function freqToY(f: number): number {
  const vp = sequencer.viewport
  const canvas = canvasRef.value
  if (!canvas) return 0
  const canvasH = canvas.height - RULER_H
  const logMin = Math.log2(vp.minFreq)
  const logMax = Math.log2(vp.maxFreq)
  const logF = Math.log2(Math.max(f, 1))
  return RULER_H + (1 - (logF - logMin) / (logMax - logMin)) * canvasH
}

function yToFreq(y: number): number {
  const vp = sequencer.viewport
  const canvas = canvasRef.value
  if (!canvas) return 440
  const canvasH = canvas.height - RULER_H
  const logMin = Math.log2(vp.minFreq)
  const logMax = Math.log2(vp.maxFreq)
  const normalized = 1 - (y - RULER_H) / canvasH
  return Math.pow(2, logMin + normalized * (logMax - logMin))
}

// ── Note name helper ────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function freqToNoteName(freq: number): string {
  if (freq <= 0) return ''
  const semitone = 12 * Math.log2(freq / 440) + 69
  const noteIdx = Math.round(semitone) % 12
  const octave = Math.floor(Math.round(semitone) / 12) - 1
  return `${NOTE_NAMES[noteIdx < 0 ? noteIdx + 12 : noteIdx]}${octave}`
}

// ── Event hit testing ───────────────────────────────────────────────

const EVENT_H = 12  // height of event rectangles in pixels

function getEventAtPoint(x: number, y: number): { event: SequencerEvent; edge: 'body' | 'right' } | null {
  const t = xToTime(x)
  const f = yToFreq(y)

  for (const ev of sequencer.allEvents) {
    const evX = timeToX(ev.startTime)
    const evW = ev.duration * sequencer.viewport.zoomX
    const evY = freqToY(ev.frequency)

    if (x >= evX && x <= evX + evW && y >= evY - EVENT_H / 2 && y <= evY + EVENT_H / 2) {
      const edge = (x > evX + evW - 6) ? 'right' : 'body'
      return { event: ev, edge }
    }
  }
  return null
}

// ── Drawing ─────────────────────────────────────────────────────────

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height
  const vp = sequencer.viewport

  // Clear
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, w, h)

  // ── Octave bands (alternating background) ───────────────────────
  const logMin = Math.log2(vp.minFreq)
  const logMax = Math.log2(vp.maxFreq)
  const minOctave = Math.floor(logMin)
  const maxOctave = Math.ceil(logMax)
  const canvasH = h - RULER_H

  for (let oct = minOctave; oct <= maxOctave; oct++) {
    const freqLow = Math.pow(2, oct)
    const freqHigh = Math.pow(2, oct + 1)
    const yTop = freqToY(freqHigh)
    const yBot = freqToY(freqLow)

    if (yBot < RULER_H || yTop > h) continue

    const clampedTop = Math.max(yTop, RULER_H)
    const clampedBot = Math.min(yBot, h)

    ctx.fillStyle = oct % 2 === 0 ? '#111827' : '#0f172a'
    ctx.fillRect(GUTTER_W, clampedTop, w - GUTTER_W, clampedBot - clampedTop)

    // Octave line
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(GUTTER_W, Math.round(clampedBot) + 0.5)
    ctx.lineTo(w, Math.round(clampedBot) + 0.5)
    ctx.stroke()
  }

  // ── Beat/bar grid lines ─────────────────────────────────────────
  const beatDur = 60 / sequencer.bpm
  const barDur = beatDur * 4
  const visibleStart = vp.scrollX
  const visibleEnd = vp.scrollX + (w - GUTTER_W) / vp.zoomX

  // Determine grid density based on zoom
  let gridInterval = beatDur
  let isBeat = true
  if (vp.zoomX * beatDur < 8) {
    gridInterval = barDur
    isBeat = false
  } else if (vp.zoomX * beatDur > 60) {
    gridInterval = beatDur / 4
  }

  const gridStart = Math.floor(visibleStart / gridInterval) * gridInterval
  for (let t = gridStart; t <= visibleEnd; t += gridInterval) {
    const x = Math.round(timeToX(t)) + 0.5
    if (x < GUTTER_W) continue

    const isBar = Math.abs(t % barDur) < 0.001
    ctx.strokeStyle = isBar ? '#334155' : '#1e293b'
    ctx.lineWidth = isBar ? 1 : 0.5
    ctx.beginPath()
    ctx.moveTo(x, RULER_H)
    ctx.lineTo(x, h)
    ctx.stroke()
  }

  // ── Loop region highlight ───────────────────────────────────────
  if (sequencer.loopEnabled) {
    const lx1 = timeToX(sequencer.loopStart)
    const lx2 = timeToX(sequencer.loopEnd)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
    ctx.fillRect(
      Math.max(lx1, GUTTER_W), RULER_H,
      Math.min(lx2, w) - Math.max(lx1, GUTTER_W), h - RULER_H
    )

    // Loop markers
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    for (const lx of [lx1, lx2]) {
      if (lx >= GUTTER_W && lx <= w) {
        ctx.beginPath()
        ctx.moveTo(lx, RULER_H)
        ctx.lineTo(lx, h)
        ctx.stroke()
      }
    }
    ctx.setLineDash([])
  }

  // ── Event rectangles ────────────────────────────────────────────
  const clipColor = sequencer.activeClip?.color || '#3b82f6'
  for (const ev of sequencer.allEvents) {
    if (ev.muted) continue
    const x = timeToX(ev.startTime)
    const evW = ev.duration * vp.zoomX
    const y = freqToY(ev.frequency)

    // Skip if offscreen
    if (x + evW < GUTTER_W || x > w || y - EVENT_H < RULER_H || y + EVENT_H > h) continue

    const isHovered = hoveredEvent.value?.id === ev.id
    const alpha = ev.muted ? 0.3 : (ev.selected ? 1 : 0.8)

    // Event body
    ctx.fillStyle = ev.selected
      ? `rgba(96, 165, 250, ${alpha})`
      : isHovered
        ? `rgba(${hexToRgb(clipColor)}, ${alpha})`
        : `rgba(${hexToRgb(clipColor)}, ${alpha * 0.7})`
    ctx.fillRect(
      Math.max(x, GUTTER_W), y - EVENT_H / 2,
      Math.min(evW, w - Math.max(x, GUTTER_W)), EVENT_H
    )

    // Event border
    ctx.strokeStyle = ev.selected ? '#93c5fd' : isHovered ? '#fff' : 'rgba(255,255,255,0.2)'
    ctx.lineWidth = ev.selected ? 1.5 : 0.5
    ctx.strokeRect(
      Math.max(x, GUTTER_W), y - EVENT_H / 2,
      Math.min(evW, w - Math.max(x, GUTTER_W)), EVENT_H
    )

    // Note name label inside event if wide enough
    if (evW > 30) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.font = '9px monospace'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        freqToNoteName(ev.frequency),
        Math.max(x + 3, GUTTER_W + 3), y
      )
    }
  }

  // ── Selection rectangle ─────────────────────────────────────────
  if (selectionRect.value) {
    const sr = selectionRect.value
    const rx = Math.min(sr.x1, sr.x2)
    const ry = Math.min(sr.y1, sr.y2)
    const rw = Math.abs(sr.x2 - sr.x1)
    const rh = Math.abs(sr.y2 - sr.y1)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
    ctx.fillRect(rx, ry, rw, rh)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)'
    ctx.lineWidth = 1
    ctx.strokeRect(rx, ry, rw, rh)
  }

  // ── Frequency gutter (left labels) ──────────────────────────────
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, RULER_H, GUTTER_W, h - RULER_H)

  // Frequency labels at octave C notes
  ctx.fillStyle = '#6b7280'
  ctx.font = '10px monospace'
  ctx.textBaseline = 'middle'

  const labelFreqs = [27.5, 55, 110, 220, 440, 880, 1760, 3520]
  for (const f of labelFreqs) {
    const y = freqToY(f)
    if (y > RULER_H + 10 && y < h - 10) {
      const noteName = freqToNoteName(f)
      ctx.fillStyle = '#9ca3af'
      ctx.fillText(noteName, 4, y)
      ctx.fillStyle = '#6b7280'
      ctx.fillText(`${Math.round(f)}`, 4, y + 10)

      // Tick mark
      ctx.strokeStyle = '#374151'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(GUTTER_W - 4, Math.round(y) + 0.5)
      ctx.lineTo(GUTTER_W, Math.round(y) + 0.5)
      ctx.stroke()
    }
  }

  // Gutter border
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(GUTTER_W + 0.5, RULER_H)
  ctx.lineTo(GUTTER_W + 0.5, h)
  ctx.stroke()

  // ── Time ruler (top) ────────────────────────────────────────────
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, w, RULER_H)

  // Ruler border
  ctx.strokeStyle = '#1e293b'
  ctx.beginPath()
  ctx.moveTo(0, RULER_H + 0.5)
  ctx.lineTo(w, RULER_H + 0.5)
  ctx.stroke()

  // Time labels
  ctx.fillStyle = '#9ca3af'
  ctx.font = '10px monospace'
  ctx.textBaseline = 'top'

  const rulerGridStart = Math.floor(visibleStart / gridInterval) * gridInterval
  for (let t = rulerGridStart; t <= visibleEnd; t += gridInterval) {
    const x = timeToX(t)
    if (x < GUTTER_W) continue

    const isBar = Math.abs(t % barDur) < 0.001

    if (isBar || vp.zoomX * gridInterval > 30) {
      let label: string
      if (sequencer.timeDisplay === 'beats') {
        const beat = t / beatDur
        const bar = Math.floor(beat / 4) + 1
        const beatInBar = Math.floor(beat % 4) + 1
        label = `${bar}.${beatInBar}`
      } else {
        label = t.toFixed(1) + 's'
      }
      ctx.fillStyle = isBar ? '#d1d5db' : '#6b7280'
      ctx.fillText(label, x + 3, 4)
    }

    // Tick
    ctx.strokeStyle = isBar ? '#4b5563' : '#374151'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(Math.round(x) + 0.5, RULER_H - 6)
    ctx.lineTo(Math.round(x) + 0.5, RULER_H)
    ctx.stroke()
  }

  // ── Playback cursor ─────────────────────────────────────────────
  const cursorX = timeToX(sequencer.playheadPosition)
  if (cursorX >= GUTTER_W && cursorX <= w) {
    ctx.strokeStyle = sequencer.transport === 'playing' ? '#22c55e' : '#ef4444'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cursorX, 0)
    ctx.lineTo(cursorX, h)
    ctx.stroke()

    // Cursor head triangle
    ctx.fillStyle = sequencer.transport === 'playing' ? '#22c55e' : '#ef4444'
    ctx.beginPath()
    ctx.moveTo(cursorX - 5, 0)
    ctx.lineTo(cursorX + 5, 0)
    ctx.lineTo(cursorX, 8)
    ctx.closePath()
    ctx.fill()
  }

  // Corner block (top-left)
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, GUTTER_W, RULER_H)
  ctx.strokeStyle = '#1e293b'
  ctx.strokeRect(0, 0, GUTTER_W, RULER_H)

  // BPM display in corner
  ctx.fillStyle = '#6b7280'
  ctx.font = '9px monospace'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${sequencer.bpm} BPM`, 4, RULER_H / 2)

  // ── Clip boundary indicator ───────────────────────────────────
  const clip = sequencer.activeClip
  if (clip) {
    const clipEndX = timeToX(clip.duration)
    if (clipEndX >= GUTTER_W && clipEndX <= w) {
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 3])
      ctx.beginPath()
      ctx.moveTo(clipEndX, RULER_H)
      ctx.lineTo(clipEndX, h)
      ctx.stroke()
      ctx.setLineDash([])

      // "End" label
      ctx.fillStyle = '#f59e0b'
      ctx.font = '9px sans-serif'
      ctx.textBaseline = 'top'
      ctx.fillText('clip end', clipEndX + 3, RULER_H + 4)
    }

    // Clip name in corner
    ctx.fillStyle = clip.color
    ctx.font = '8px sans-serif'
    ctx.textBaseline = 'bottom'
    ctx.fillText(clip.name, 4, RULER_H - 2)
  }

  // ── Empty state ───────────────────────────────────────────────
  if (!clip) {
    ctx.fillStyle = '#6b7280'
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('No clip selected. Switch to Clips view and double-click a clip to edit.', w / 2, h / 2)
    ctx.textAlign = 'left'
  }
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '100, 100, 100'
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}

// ── Mouse interactions ──────────────────────────────────────────────

function handleMouseDown(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (canvas.width / rect.width)
  const y = (e.clientY - rect.top) * (canvas.height / rect.height)

  // Click on time ruler → set playhead position
  if (y < RULER_H) {
    const t = xToTime(x)
    sequencer.setPosition(Math.max(0, t))
    return
  }

  // Click in gutter → ignore
  if (x < GUTTER_W) return

  const hit = getEventAtPoint(x, y)

  if (sequencer.editMode === 'erase') {
    if (hit) {
      sequencer.removeEvent(hit.event.id)
      requestDraw()
    }
    return
  }

  if (sequencer.editMode === 'draw') {
    if (hit) {
      // If drawing mode and clicking existing event, select it
      if (!e.shiftKey) sequencer.deselectAll()
      hit.event.selected = true
      dragTarget.value = hit.event
      dragMode.value = hit.edge === 'right' ? 'resize-right' : 'move'
      isDragging.value = true
      dragStartX.value = x
      dragStartY.value = y
      dragOriginalStartTime.value = hit.event.startTime
      dragOriginalDuration.value = hit.event.duration
      dragOriginalFreq.value = hit.event.frequency
      sequencer.pushUndo()
    } else {
      // Draw new event
      const t = xToTime(x)
      const f = yToFreq(y)
      const synthName = sequencer.synthNames[0] || 'SineEnv'
      const ev = sequencer.addEvent(synthName, t, sequencer.getSnapInterval() || 0.5, f, 0.5)
      dragTarget.value = ev
      dragMode.value = 'resize-right'
      isDragging.value = true
      dragStartX.value = x
      dragStartY.value = y
      dragOriginalStartTime.value = ev.startTime
      dragOriginalDuration.value = ev.duration
      dragOriginalFreq.value = ev.frequency
    }
    requestDraw()
    return
  }

  // Select mode
  if (hit) {
    if (!e.shiftKey && !hit.event.selected) {
      sequencer.deselectAll()
    }
    hit.event.selected = true

    dragTarget.value = hit.event
    dragMode.value = hit.edge === 'right' ? 'resize-right' : 'move'
    isDragging.value = true
    dragStartX.value = x
    dragStartY.value = y
    dragOriginalStartTime.value = hit.event.startTime
    dragOriginalDuration.value = hit.event.duration
    dragOriginalFreq.value = hit.event.frequency
    sequencer.pushUndo()
  } else {
    // Rubber-band selection
    if (!e.shiftKey) sequencer.deselectAll()
    dragMode.value = 'select-rect'
    isDragging.value = true
    dragStartX.value = x
    dragStartY.value = y
    selectionRect.value = { x1: x, y1: y, x2: x, y2: y }
  }

  requestDraw()
}

function handleMouseMove(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (canvas.width / rect.width)
  const y = (e.clientY - rect.top) * (canvas.height / rect.height)

  if (!isDragging.value) {
    // Hover detection
    const hit = getEventAtPoint(x, y)
    const prev = hoveredEvent.value
    hoveredEvent.value = hit?.event || null

    // Update cursor
    if (hit) {
      canvas.style.cursor = hit.edge === 'right' ? 'ew-resize' : 'pointer'
    } else if (y < RULER_H) {
      canvas.style.cursor = 'pointer'
    } else if (sequencer.editMode === 'draw') {
      canvas.style.cursor = 'crosshair'
    } else if (sequencer.editMode === 'erase') {
      canvas.style.cursor = 'pointer'
    } else {
      canvas.style.cursor = 'default'
    }

    if (prev !== hoveredEvent.value) requestDraw()
    return
  }

  // Dragging
  if (dragMode.value === 'move' && dragTarget.value) {
    const dt = (x - dragStartX.value) / sequencer.viewport.zoomX
    const newFreq = yToFreq(y)
    const newTime = sequencer.snapTime(dragOriginalStartTime.value + dt)

    // Move all selected events
    const timeDelta = newTime - dragTarget.value.startTime
    const freqRatio = newFreq / dragTarget.value.frequency

    for (const ev of sequencer.selectedEvents) {
      ev.startTime = Math.max(0, ev.startTime + timeDelta)
      ev.frequency = ev.frequency * freqRatio
    }
    requestDraw()
  }

  if (dragMode.value === 'resize-right' && dragTarget.value) {
    const endTime = xToTime(x)
    const newDur = sequencer.snapTime(endTime - dragTarget.value.startTime)
    dragTarget.value.duration = Math.max(newDur, 0.01)
    requestDraw()
  }

  if (dragMode.value === 'select-rect' && selectionRect.value) {
    selectionRect.value.x2 = x
    selectionRect.value.y2 = y

    // Live selection update
    const sr = selectionRect.value
    const tStart = xToTime(Math.min(sr.x1, sr.x2))
    const tEnd = xToTime(Math.max(sr.x1, sr.x2))
    const fHigh = yToFreq(Math.min(sr.y1, sr.y2))
    const fLow = yToFreq(Math.max(sr.y1, sr.y2))
    sequencer.selectEventsInRect(tStart, tEnd, fLow, fHigh, e.shiftKey)
    requestDraw()
  }
}

function handleMouseUp(_e: MouseEvent) {
  isDragging.value = false
  dragMode.value = 'none'
  dragTarget.value = null
  selectionRect.value = null
  requestDraw()
}

function handleDblClick(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (canvas.width / rect.width)
  const y = (e.clientY - rect.top) * (canvas.height / rect.height)

  if (y < RULER_H || x < GUTTER_W) return

  const hit = getEventAtPoint(x, y)
  if (hit) {
    // Double click on event → toggle selection
    hit.event.selected = !hit.event.selected
  } else {
    // Double click on empty → create event
    const t = xToTime(x)
    const f = yToFreq(y)
    const synthName = sequencer.synthNames[0] || 'SineEnv'
    sequencer.addEvent(synthName, t, sequencer.getSnapInterval() || 0.5, f, 0.5)
  }
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
    // Keep cursor position stable
    sequencer.viewport.scrollX = timeAtCursor - (x - GUTTER_W) / sequencer.viewport.zoomX
    sequencer.viewport.scrollX = Math.max(0, sequencer.viewport.scrollX)
  } else if (e.shiftKey) {
    // Scroll time
    sequencer.viewport.scrollX = Math.max(0, sequencer.viewport.scrollX + e.deltaY / sequencer.viewport.zoomX)
  } else {
    // Scroll frequency axis
    const logMin = Math.log2(sequencer.viewport.minFreq)
    const logMax = Math.log2(sequencer.viewport.maxFreq)
    const range = logMax - logMin
    const scrollAmt = (e.deltaY > 0 ? 1 : -1) * range * 0.05

    const newLogMin = logMin + scrollAmt
    const newLogMax = logMax + scrollAmt
    // Clamp to sensible range (20Hz–20kHz)
    if (newLogMin >= Math.log2(20) && newLogMax <= Math.log2(20000)) {
      sequencer.viewport.minFreq = Math.pow(2, newLogMin)
      sequencer.viewport.maxFreq = Math.pow(2, newLogMax)
    }
  }

  requestDraw()
}

// ── Keyboard ────────────────────────────────────────────────────────

function handleKeyDown(e: KeyboardEvent) {
  // Only handle if canvas is focused
  if (document.activeElement !== canvasRef.value) return

  switch (e.key) {
    case 'Delete':
    case 'Backspace':
      sequencer.deleteSelected()
      requestDraw()
      e.preventDefault()
      break
    case 'a':
      if (e.ctrlKey || e.metaKey) {
        sequencer.selectAll()
        requestDraw()
        e.preventDefault()
      }
      break
    case 'c':
      if (e.ctrlKey || e.metaKey) {
        sequencer.copySelected()
        e.preventDefault()
      }
      break
    case 'v':
      if (e.ctrlKey || e.metaKey) {
        sequencer.paste()
        requestDraw()
        e.preventDefault()
      } else {
        sequencer.editMode = 'select'
      }
      break
    case 'x':
      if (e.ctrlKey || e.metaKey) {
        sequencer.cutSelected()
        requestDraw()
        e.preventDefault()
      }
      break
    case 'z':
      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey) {
          sequencer.redo()
        } else {
          sequencer.undo()
        }
        requestDraw()
        e.preventDefault()
      }
      break
    case 'd':
      sequencer.editMode = 'draw'
      break
    case 'e':
      sequencer.editMode = 'erase'
      break
    case ' ':
      if (sequencer.transport === 'playing') {
        sequencer.pause()
      } else {
        sequencer.play()
      }
      e.preventDefault()
      break
    case 'Escape':
      sequencer.deselectAll()
      requestDraw()
      break
  }
}

// ── Canvas resize handling ──────────────────────────────────────────

function resizeCanvas() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  const rect = container.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`

  const ctx = canvas.getContext('2d')
  if (ctx) ctx.scale(dpr, dpr)

  // Adjust canvas dimensions back for drawing coordinates (pre-scaled)
  canvas.width = rect.width
  canvas.height = rect.height

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

// ── Animation loop for playhead ─────────────────────────────────────

function animate() {
  if (sequencer.transport === 'playing') {
    draw()
  }
  animFrameId = requestAnimationFrame(animate)
}

// ── Lifecycle ───────────────────────────────────────────────────────

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeCanvas()

  resizeObserver = new ResizeObserver(() => resizeCanvas())
  if (containerRef.value) resizeObserver.observe(containerRef.value)

  animFrameId = requestAnimationFrame(animate)
  document.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId)
  if (resizeObserver) resizeObserver.disconnect()
  document.removeEventListener('keydown', handleKeyDown)
})

// Redraw when store data changes
watch(() => [sequencer.allEvents, sequencer.editMode, sequencer.viewMode, sequencer.activeClip], () => {
  requestDraw()
}, { deep: true })
</script>

<template>
  <div ref="containerRef" class="relative w-full h-full overflow-hidden">
    <canvas
      ref="canvasRef"
      class="absolute inset-0 w-full h-full"
      tabindex="0"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @dblclick="handleDblClick"
      @wheel.prevent="handleWheel"
      @contextmenu.prevent
    />
  </div>
</template>
