<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useSequencerStore, type ClipInstance } from '@/stores/sequencer'

const sequencer = useSequencerStore()
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
let animFrameId: number | null = null

// Layout constants
const RULER_H = 24
const TRACK_H = 48
const HEADER_W = 80

// Interaction state
const isDragging = ref(false)
const dragMode = ref<'none' | 'move' | 'resize-right' | 'select-rect'>('none')
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragTarget = ref<ClipInstance | null>(null)
const dragOriginalStartTime = ref(0)
const dragOriginalTrackIndex = ref(0)
const hoveredInstance = ref<ClipInstance | null>(null)

// Drop zone state for external file drag
const dropTargetTrack = ref<number | null>(null)
const dropTargetTime = ref<number>(0)

// ── Coordinate transforms ───────────────────────────────────────────

function timeToX(t: number): number {
  return HEADER_W + (t - sequencer.viewport.scrollX) * sequencer.viewport.zoomX
}

function xToTime(x: number): number {
  return (x - HEADER_W) / sequencer.viewport.zoomX + sequencer.viewport.scrollX
}

function trackIndexFromY(y: number): number {
  if (y < RULER_H) return -1
  return Math.floor((y - RULER_H) / TRACK_H)
}

// ── Hit testing ─────────────────────────────────────────────────────

function getInstanceAtPoint(x: number, y: number): { instance: ClipInstance; edge: 'body' | 'right' } | null {
  const trackIdx = trackIndexFromY(y)
  if (trackIdx < 0) return null

  for (const inst of sequencer.clipInstances) {
    if (inst.trackIndex !== trackIdx) continue
    const clip = sequencer.clips.find(c => c.id === inst.clipId)
    if (!clip) continue

    const instX = timeToX(inst.startTime)
    const instW = clip.duration * sequencer.viewport.zoomX
    const instY = RULER_H + inst.trackIndex * TRACK_H

    if (x >= instX && x <= instX + instW && y >= instY && y <= instY + TRACK_H) {
      const edge = (x > instX + instW - 8) ? 'right' : 'body'
      return { instance: inst, edge }
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
  const trackCount = Math.max(sequencer.arrangementTracks.length, 4)

  // Clear
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, w, h)

  // ── Track lanes ─────────────────────────────────────────────────
  for (let i = 0; i < trackCount; i++) {
    const y = RULER_H + i * TRACK_H
    if (y > h) break

    // Alternating background
    ctx.fillStyle = i % 2 === 0 ? '#111827' : '#0f172a'
    ctx.fillRect(HEADER_W, y, w - HEADER_W, TRACK_H)

    // Lane border
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(HEADER_W, y + TRACK_H + 0.5)
    ctx.lineTo(w, y + TRACK_H + 0.5)
    ctx.stroke()
  }

  // ── Beat/bar grid lines ─────────────────────────────────────────
  const beatDur = 60 / sequencer.bpm
  const barDur = beatDur * 4
  const visibleStart = vp.scrollX
  const visibleEnd = vp.scrollX + (w - HEADER_W) / vp.zoomX

  let gridInterval = beatDur
  if (vp.zoomX * beatDur < 8) {
    gridInterval = barDur
  } else if (vp.zoomX * beatDur > 60) {
    gridInterval = beatDur / 4
  }

  const gridStart = Math.floor(visibleStart / gridInterval) * gridInterval
  for (let t = gridStart; t <= visibleEnd; t += gridInterval) {
    const x = Math.round(timeToX(t)) + 0.5
    if (x < HEADER_W) continue

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
      Math.max(lx1, HEADER_W), RULER_H,
      Math.min(lx2, w) - Math.max(lx1, HEADER_W), h - RULER_H
    )

    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    for (const lx of [lx1, lx2]) {
      if (lx >= HEADER_W && lx <= w) {
        ctx.beginPath()
        ctx.moveTo(lx, RULER_H)
        ctx.lineTo(lx, h)
        ctx.stroke()
      }
    }
    ctx.setLineDash([])
  }

  // ── Clip instances ──────────────────────────────────────────────
  for (const inst of sequencer.clipInstances) {
    const clip = sequencer.clips.find(c => c.id === inst.clipId)
    if (!clip) continue

    const x = timeToX(inst.startTime)
    const clipW = clip.duration * vp.zoomX
    const y = RULER_H + inst.trackIndex * TRACK_H + 2
    const clipH = TRACK_H - 4

    // Skip if offscreen
    if (x + clipW < HEADER_W || x > w) continue

    const isSelected = sequencer.selectedClipInstanceIds.has(inst.id)
    const isHovered = hoveredInstance.value?.id === inst.id
    const isActive = sequencer.activeClipId === clip.id

    // Clip body
    const clampedX = Math.max(x, HEADER_W)
    const clampedW = Math.min(x + clipW, w) - clampedX

    ctx.fillStyle = isSelected
      ? adjustAlpha(clip.color, 0.9)
      : isActive
        ? adjustAlpha(clip.color, 0.7)
        : adjustAlpha(clip.color, 0.5)
    ctx.beginPath()
    roundRect(ctx, clampedX, y, clampedW, clipH, 3)
    ctx.fill()

    // Clip border
    ctx.strokeStyle = isSelected ? '#fff' : isHovered ? '#d1d5db' : adjustAlpha(clip.color, 0.8)
    ctx.lineWidth = isSelected ? 2 : isActive ? 1.5 : 1
    ctx.stroke()

    // Draw mini note preview inside clip
    if (clip.notes.length > 0 && clampedW > 20) {
      drawClipNotePreview(ctx, clip, inst, clampedX, y, clampedW, clipH)
    }

    // Clip name label
    if (clampedW > 40) {
      ctx.fillStyle = isSelected || isActive ? '#fff' : 'rgba(255,255,255,0.8)'
      ctx.font = '10px sans-serif'
      ctx.textBaseline = 'top'
      ctx.fillText(clip.name, clampedX + 4, y + 3, clampedW - 8)
    }

    // Note count badge
    if (clampedW > 60 && clip.notes.length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '9px monospace'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${clip.notes.length} notes`, clampedX + 4, y + clipH - 2)
    }

    // Resize handle indicator
    if (isHovered && clampedW > 12) {
      const handleX = clampedX + clampedW - 4
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.fillRect(handleX, y + 6, 2, clipH - 12)
    }
  }

  // ── Track headers (left sidebar) ────────────────────────────────
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, RULER_H, HEADER_W, h - RULER_H)

  for (let i = 0; i < trackCount; i++) {
    const y = RULER_H + i * TRACK_H
    if (y > h) break

    const track = sequencer.arrangementTracks[i]

    // Track header background
    ctx.fillStyle = i % 2 === 0 ? '#111827' : '#0f172a'
    ctx.fillRect(0, y, HEADER_W, TRACK_H)

    // Border
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, y + TRACK_H + 0.5)
    ctx.lineTo(HEADER_W, y + TRACK_H + 0.5)
    ctx.stroke()

    if (track) {
      // Track name
      ctx.fillStyle = '#d1d5db'
      ctx.font = '10px sans-serif'
      ctx.textBaseline = 'middle'
      ctx.fillText(track.name, 4, y + TRACK_H / 2 - 6, HEADER_W - 8)

      // Mute/Solo indicators
      ctx.font = '8px monospace'
      if (track.muted) {
        ctx.fillStyle = '#ef4444'
        ctx.fillText('M', 4, y + TRACK_H / 2 + 10)
      }
      if (track.solo) {
        ctx.fillStyle = '#eab308'
        ctx.fillText('S', 16, y + TRACK_H / 2 + 10)
      }

      // Color stripe
      ctx.fillStyle = track.color
      ctx.fillRect(HEADER_W - 3, y, 3, TRACK_H)
    }
  }

  // Header border
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(HEADER_W + 0.5, RULER_H)
  ctx.lineTo(HEADER_W + 0.5, h)
  ctx.stroke()

  // ── Time ruler ──────────────────────────────────────────────────
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, w, RULER_H)

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
    if (x < HEADER_W) continue

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

    ctx.strokeStyle = isBar ? '#4b5563' : '#374151'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(Math.round(x) + 0.5, RULER_H - 6)
    ctx.lineTo(Math.round(x) + 0.5, RULER_H)
    ctx.stroke()
  }

  // ── Drop indicator ──────────────────────────────────────────────
  if (dropTargetTrack.value !== null) {
    const dropY = RULER_H + dropTargetTrack.value * TRACK_H
    const dropX = timeToX(dropTargetTime.value)

    // Highlight target track lane
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
    ctx.fillRect(HEADER_W, dropY, w - HEADER_W, TRACK_H)

    // Drop position line
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(dropX, dropY)
    ctx.lineTo(dropX, dropY + TRACK_H)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // ── Playback cursor ─────────────────────────────────────────────
  const cursorX = timeToX(sequencer.playheadPosition)
  if (cursorX >= HEADER_W && cursorX <= w) {
    ctx.strokeStyle = sequencer.transport === 'playing' ? '#22c55e' : '#ef4444'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cursorX, 0)
    ctx.lineTo(cursorX, h)
    ctx.stroke()

    // Cursor head
    ctx.fillStyle = sequencer.transport === 'playing' ? '#22c55e' : '#ef4444'
    ctx.beginPath()
    ctx.moveTo(cursorX - 5, 0)
    ctx.lineTo(cursorX + 5, 0)
    ctx.lineTo(cursorX, 8)
    ctx.closePath()
    ctx.fill()
  }

  // Corner block
  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, HEADER_W, RULER_H)
  ctx.strokeStyle = '#1e293b'
  ctx.strokeRect(0, 0, HEADER_W, RULER_H)

  // BPM in corner
  ctx.fillStyle = '#6b7280'
  ctx.font = '9px monospace'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${sequencer.bpm} BPM`, 4, RULER_H / 2)
}

function drawClipNotePreview(
  ctx: CanvasRenderingContext2D,
  clip: typeof sequencer.clips[0],
  inst: ClipInstance,
  clipX: number, clipY: number, clipW: number, clipH: number,
) {
  // Draw tiny note bars inside the clip as a preview
  const notes = clip.notes
  if (notes.length === 0) return

  // Find freq range of notes
  let minFreq = Infinity, maxFreq = -Infinity
  for (const n of notes) {
    if (n.frequency < minFreq) minFreq = n.frequency
    if (n.frequency > maxFreq) maxFreq = n.frequency
  }
  const freqRange = Math.max(maxFreq - minFreq, 1)
  const labelH = 14 // space for clip name at top
  const noteAreaH = clipH - labelH - 4
  const noteAreaY = clipY + labelH

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  for (const n of notes) {
    const nx = clipX + (n.startTime / clip.duration) * clipW
    const nw = Math.max((n.duration / clip.duration) * clipW, 1)
    const normalizedFreq = freqRange > 1 ? (n.frequency - minFreq) / freqRange : 0.5
    const ny = noteAreaY + (1 - normalizedFreq) * noteAreaH
    ctx.fillRect(nx, ny, nw, 2)
  }
}

function adjustAlpha(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return `rgba(100, 100, 100, ${alpha})`
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ── Mouse interactions ──────────────────────────────────────────────

function handleMouseDown(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (canvas.width / rect.width)
  const y = (e.clientY - rect.top) * (canvas.height / rect.height)

  // Click on time ruler → set playhead
  if (y < RULER_H) {
    const t = xToTime(x)
    sequencer.setPosition(Math.max(0, t))
    return
  }

  // Click in header → ignore for now
  if (x < HEADER_W) return

  const hit = getInstanceAtPoint(x, y)

  if (sequencer.editMode === 'erase') {
    if (hit) {
      sequencer.removeClipInstance(hit.instance.id)
      requestDraw()
    }
    return
  }

  if (sequencer.editMode === 'draw') {
    if (!hit) {
      // Create a new clip and place it
      const trackIdx = trackIndexFromY(y)
      if (trackIdx < 0) return
      const t = xToTime(x)
      const synthName = sequencer.synthNames[0] || 'SineEnv'
      const clip = sequencer.createClip(synthName)
      const inst = sequencer.addClipInstance(clip.id, trackIdx, t)
      sequencer.setActiveClip(clip.id)
      sequencer.selectClipInstance(inst.id)
      requestDraw()
      return
    }
  }

  // Select mode or draw mode click on existing clip
  if (hit) {
    if (!e.shiftKey && !sequencer.selectedClipInstanceIds.has(hit.instance.id)) {
      sequencer.deselectAllClipInstances()
    }
    sequencer.selectClipInstance(hit.instance.id, e.shiftKey)

    dragTarget.value = hit.instance
    dragMode.value = hit.edge === 'right' ? 'resize-right' : 'move'
    isDragging.value = true
    dragStartX.value = x
    dragStartY.value = y
    dragOriginalStartTime.value = hit.instance.startTime
    dragOriginalTrackIndex.value = hit.instance.trackIndex
    sequencer.pushUndo()
  } else {
    if (!e.shiftKey) sequencer.deselectAllClipInstances()
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
    const hit = getInstanceAtPoint(x, y)
    hoveredInstance.value = hit?.instance || null

    if (hit) {
      canvas.style.cursor = hit.edge === 'right' ? 'ew-resize' : 'pointer'
    } else if (y < RULER_H) {
      canvas.style.cursor = 'pointer'
    } else if (sequencer.editMode === 'draw') {
      canvas.style.cursor = 'crosshair'
    } else {
      canvas.style.cursor = 'default'
    }

    if (hoveredInstance.value !== hit?.instance) requestDraw()
    return
  }

  if (dragMode.value === 'move' && dragTarget.value) {
    const dt = (x - dragStartX.value) / sequencer.viewport.zoomX
    const newTime = sequencer.snapTime(dragOriginalStartTime.value + dt)
    const newTrackIdx = trackIndexFromY(y)

    sequencer.moveClipInstance(
      dragTarget.value.id,
      newTime,
      newTrackIdx >= 0 ? newTrackIdx : undefined
    )
    requestDraw()
  }

  if (dragMode.value === 'resize-right' && dragTarget.value) {
    const clip = sequencer.clips.find(c => c.id === dragTarget.value!.clipId)
    if (clip) {
      const endTime = xToTime(x)
      const newDur = sequencer.snapTime(endTime - dragTarget.value.startTime)
      clip.duration = Math.max(newDur, 0.1)
      requestDraw()
    }
  }
}

function handleMouseUp() {
  isDragging.value = false
  dragMode.value = 'none'
  dragTarget.value = null
  requestDraw()
}

function handleDblClick(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (canvas.width / rect.width)
  const y = (e.clientY - rect.top) * (canvas.height / rect.height)

  if (y < RULER_H || x < HEADER_W) return

  const hit = getInstanceAtPoint(x, y)
  if (hit) {
    // Double-click clip → open in editor (switch to frequency roll)
    const clip = sequencer.clips.find(c => c.id === hit.instance.clipId)
    if (clip) {
      sequencer.setActiveClip(clip.id)
      sequencer.viewMode = 'frequencyRoll'
    }
  }
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (canvas.width / rect.width)

  if (e.ctrlKey || e.metaKey) {
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const timeAtCursor = xToTime(x)
    sequencer.viewport.zoomX = Math.max(10, Math.min(500, sequencer.viewport.zoomX * factor))
    sequencer.viewport.scrollX = timeAtCursor - (x - HEADER_W) / sequencer.viewport.zoomX
    sequencer.viewport.scrollX = Math.max(0, sequencer.viewport.scrollX)
  } else {
    sequencer.viewport.scrollX = Math.max(0, sequencer.viewport.scrollX + e.deltaY / sequencer.viewport.zoomX)
  }

  requestDraw()
}

function handleKeyDown(e: KeyboardEvent) {
  if (document.activeElement !== canvasRef.value) return

  switch (e.key) {
    case 'Delete':
    case 'Backspace':
      sequencer.deleteSelectedClipInstances()
      requestDraw()
      e.preventDefault()
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
      sequencer.deselectAllClipInstances()
      requestDraw()
      break
    case 'v':
      if (!(e.ctrlKey || e.metaKey)) sequencer.editMode = 'select'
      break
    case 'd':
      sequencer.editMode = 'draw'
      break
    case 'e':
      sequencer.editMode = 'erase'
      break
  }
}

// ── External drag-and-drop (file drop from explorer/sidebar) ────────

function handleExternalDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('application/x-synthsequence-path')) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'

  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (canvas.width / rect.width)
  const y = (e.clientY - rect.top) * (canvas.height / rect.height)

  const trackIdx = trackIndexFromY(y)
  const time = xToTime(x)

  dropTargetTrack.value = trackIdx >= 0 ? trackIdx : null
  dropTargetTime.value = sequencer.snapTime(Math.max(0, time))
  requestDraw()
}

function handleExternalDragLeave() {
  dropTargetTrack.value = null
  requestDraw()
}

function handleExternalDrop(e: DragEvent) {
  const filePath = e.dataTransfer?.getData('application/x-synthsequence-path')
  dropTargetTrack.value = null

  if (!filePath) return
  e.preventDefault()

  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left) * (canvas.width / rect.width)
  const y = (e.clientY - rect.top) * (canvas.height / rect.height)

  const trackIdx = trackIndexFromY(y)
  if (trackIdx < 0) return

  const dropTime = sequencer.snapTime(Math.max(0, xToTime(x)))

  // Load or get the clip from the file
  const clip = sequencer.loadClipFromFile(filePath)
  if (!clip) return

  // Validate synth name matches track if track has a synthName set
  const track = sequencer.arrangementTracks[trackIdx]
  if (track && track.synthName && clip.synthName !== track.synthName) {
    // Find the correct track for this clip's synth
    const correctTrack = sequencer.arrangementTracks.findIndex(t => t.synthName === clip.synthName)
    if (correctTrack >= 0) {
      sequencer.addClipInstance(clip.id, correctTrack, dropTime)
    } else {
      // Create a track for this synth
      const newTrack = sequencer.ensureSynthTrack(clip.synthName)
      const newTrackIdx = sequencer.arrangementTracks.indexOf(newTrack)
      sequencer.addClipInstance(clip.id, newTrackIdx, dropTime)
    }
  } else {
    sequencer.addClipInstance(clip.id, trackIdx, dropTime)
  }

  sequencer.setActiveClip(clip.id)
  requestDraw()
}

// ── Canvas resize handling ──────────────────────────────────────────

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

function animate() {
  if (sequencer.transport === 'playing') {
    draw()
  }
  animFrameId = requestAnimationFrame(animate)
}

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

watch(() => [sequencer.clipInstances, sequencer.clips, sequencer.arrangementTracks, sequencer.editMode], () => {
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
      @dragover.prevent="handleExternalDragOver"
      @dragleave="handleExternalDragLeave"
      @drop.prevent="handleExternalDrop"
      @contextmenu.prevent
    />
  </div>
</template>
