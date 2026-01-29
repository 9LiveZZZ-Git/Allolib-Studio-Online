<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useSequencerStore, type ClipInstance, type ParameterLaneConfig, type SequencerClip, type SequencerNote } from '@/stores/sequencer'

const sequencer = useSequencerStore()
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
let animFrameId: number | null = null

// Layout constants
const RULER_H = 24
const BASE_TRACK_H = 48       // main clip lane height per track
const AUTO_LANE_H = 40        // expanded automation lane height
const AUTO_COLLAPSED_H = 16   // collapsed automation lane header
const HEADER_W = 80

// Interaction state
const isDragging = ref(false)
const dragMode = ref<'none' | 'move' | 'resize-right' | 'select-rect' | 'automation-edit'>('none')
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragTarget = ref<ClipInstance | null>(null)
const dragOriginalStartTime = ref(0)
const dragOriginalTrackIndex = ref(0)
const hoveredInstance = ref<ClipInstance | null>(null)

// Note-bar automation drag state
const dragAutoLane = ref<ParameterLaneConfig | null>(null)
const dragAutoLaneTop = ref(0)
const dragAutoNoteId = ref('')
const dragAutoClipId = ref('')
const dragAutoParamIndex = ref(-1)

// Drop zone state for external file drag
const dropTargetTrack = ref<number | null>(null)
const dropTargetTime = ref<number>(0)

// ── Dynamic track height helpers ─────────────────────────────────────

function getTrackY(trackIndex: number): number {
  return sequencer.getTrackYOffset(trackIndex, BASE_TRACK_H, AUTO_LANE_H, AUTO_COLLAPSED_H, RULER_H)
}

function getTrackHeight(trackIndex: number): number {
  return sequencer.getTrackTotalHeight(trackIndex, BASE_TRACK_H, AUTO_LANE_H, AUTO_COLLAPSED_H)
}

function trackIndexFromY(y: number): number {
  if (y < RULER_H) return -1
  const trackCount = Math.max(sequencer.arrangementTracks.length, 4)
  for (let i = 0; i < trackCount; i++) {
    const ty = getTrackY(i)
    const th = getTrackHeight(i)
    if (y >= ty && y < ty + th) return i
  }
  return -1
}

function isYInClipArea(y: number, trackIndex: number): boolean {
  const ty = getTrackY(trackIndex)
  return y >= ty && y < ty + BASE_TRACK_H
}

function getAutomationLaneAtY(y: number, trackIndex: number):
  { lane: ParameterLaneConfig; laneTop: number; laneH: number; laneIndex: number } | null {
  const track = sequencer.arrangementTracks[trackIndex]
  if (!track?.expanded || !track.automationLanes.length) return null
  let laneY = getTrackY(trackIndex) + BASE_TRACK_H
  for (let li = 0; li < track.automationLanes.length; li++) {
    const lane = track.automationLanes[li]
    const h = lane.collapsed ? AUTO_COLLAPSED_H : AUTO_LANE_H
    if (y >= laneY && y < laneY + h) return { lane, laneTop: laneY, laneH: h, laneIndex: li }
    laneY += h
  }
  return null
}

// ── Coordinate transforms ───────────────────────────────────────────

function timeToX(t: number): number {
  return HEADER_W + (t - sequencer.viewport.scrollX) * sequencer.viewport.zoomX
}

function xToTime(x: number): number {
  return (x - HEADER_W) / sequencer.viewport.zoomX + sequencer.viewport.scrollX
}

// ── Hit testing ─────────────────────────────────────────────────────

function getInstanceAtPoint(x: number, y: number): { instance: ClipInstance; edge: 'body' | 'right' } | null {
  const trackIdx = trackIndexFromY(y)
  if (trackIdx < 0) return null
  if (!isYInClipArea(y, trackIdx)) return null

  for (const inst of sequencer.clipInstances) {
    if (inst.trackIndex !== trackIdx) continue
    const clip = sequencer.clips.find(c => c.id === inst.clipId)
    if (!clip) continue

    const instX = timeToX(inst.startTime)
    const instW = clip.duration * sequencer.viewport.zoomX
    const instY = getTrackY(inst.trackIndex)

    if (x >= instX && x <= instX + instW && y >= instY && y <= instY + BASE_TRACK_H) {
      const edge = (x > instX + instW - 8) ? 'right' : 'body'
      return { instance: inst, edge }
    }
  }
  return null
}

/** Find a note bar near the mouse position in an automation lane */
function getNoteBarAtPoint(
  x: number, y: number, trackIndex: number, lane: ParameterLaneConfig, laneTop: number, laneH: number,
): { note: SequencerNote; clipId: string } | null {
  const BAR_H = 6
  const HIT_TOLERANCE = 8
  const range = lane.max - lane.min
  if (range === 0) return null

  const trackInstances = sequencer.clipInstances.filter(ci => ci.trackIndex === trackIndex)

  for (const inst of trackInstances) {
    const clip = sequencer.clips.find(c => c.id === inst.clipId)
    if (!clip) continue

    for (const note of clip.notes) {
      if (note.muted) continue
      const paramValue = lane.paramIndex < note.params.length ? note.params[lane.paramIndex] : 0
      const normalized = Math.max(0, Math.min(1, (paramValue - lane.min) / range))

      const barX = timeToX(inst.startTime + note.startTime)
      const barW = Math.max(note.duration * sequencer.viewport.zoomX, 4)
      const barCenterY = laneTop + laneH * (1 - normalized)

      if (x >= barX && x <= barX + barW && Math.abs(y - barCenterY) <= HIT_TOLERANCE) {
        return { note, clipId: clip.id }
      }
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

  // ── Beat/bar grid calculation ─────────────────────────────────
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

  // ── Track lanes + automation sub-lanes ────────────────────────
  for (let i = 0; i < trackCount; i++) {
    const ty = getTrackY(i)
    if (ty > h) break
    const track = sequencer.arrangementTracks[i]

    // Main clip lane background
    ctx.fillStyle = i % 2 === 0 ? '#111827' : '#0f172a'
    ctx.fillRect(HEADER_W, ty, w - HEADER_W, BASE_TRACK_H)

    // Main lane border
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(HEADER_W, ty + BASE_TRACK_H + 0.5)
    ctx.lineTo(w, ty + BASE_TRACK_H + 0.5)
    ctx.stroke()

    // Automation sub-lanes (if expanded)
    if (track?.expanded && track.automationLanes.length > 0) {
      let laneY = ty + BASE_TRACK_H

      for (let li = 0; li < track.automationLanes.length; li++) {
        const lane = track.automationLanes[li]
        const laneH = lane.collapsed ? AUTO_COLLAPSED_H : AUTO_LANE_H

        if (lane.collapsed) {
          // Collapsed lane: just a thin header
          ctx.fillStyle = '#0a0f18'
          ctx.fillRect(HEADER_W, laneY, w - HEADER_W, AUTO_COLLAPSED_H)

          // Border
          ctx.strokeStyle = '#1e293b'
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(HEADER_W, laneY + AUTO_COLLAPSED_H + 0.5)
          ctx.lineTo(w, laneY + AUTO_COLLAPSED_H + 0.5)
          ctx.stroke()
        } else {
          // Expanded lane background
          ctx.fillStyle = li % 2 === 0 ? '#0c1322' : '#0a101c'
          ctx.fillRect(HEADER_W, laneY, w - HEADER_W, AUTO_LANE_H)

          // Grid lines within lane
          const gridStart = Math.max(0, Math.floor(visibleStart / gridInterval) * gridInterval)
          for (let t = gridStart; t <= visibleEnd; t += gridInterval) {
            const gx = Math.round(timeToX(t)) + 0.5
            if (gx < HEADER_W) continue
            const isBar = Math.abs(t % barDur) < 0.001
            ctx.strokeStyle = isBar ? '#1e293b' : '#141c2b'
            ctx.lineWidth = isBar ? 0.5 : 0.25
            ctx.beginPath()
            ctx.moveTo(gx, laneY)
            ctx.lineTo(gx, laneY + AUTO_LANE_H)
            ctx.stroke()
          }

          // Zero reference line if 0 is within range
          if (lane.min < 0 && lane.max > 0) {
            const zeroNorm = (0 - lane.min) / (lane.max - lane.min)
            const zeroY = laneY + AUTO_LANE_H * (1 - zeroNorm)
            ctx.strokeStyle = '#374151'
            ctx.lineWidth = 0.5
            ctx.setLineDash([2, 2])
            ctx.beginPath()
            ctx.moveTo(HEADER_W, zeroY)
            ctx.lineTo(w, zeroY)
            ctx.stroke()
            ctx.setLineDash([])
          }

          // Draw per-note parameter bars for each clip instance on this track
          const trackInstances = sequencer.clipInstances.filter(ci => ci.trackIndex === i)
          for (const inst of trackInstances) {
            const clip = sequencer.clips.find(c => c.id === inst.clipId)
            if (!clip) continue
            drawNoteParamBars(ctx, clip, inst, lane, laneY, AUTO_LANE_H, w)
          }

          // Lane border
          ctx.strokeStyle = '#1e293b'
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(HEADER_W, laneY + AUTO_LANE_H + 0.5)
          ctx.lineTo(w, laneY + AUTO_LANE_H + 0.5)
          ctx.stroke()
        }

        laneY += laneH
      }
    }
  }

  // ── Main grid lines (over full canvas) ────────────────────────
  const gridStart = Math.max(0, Math.floor(visibleStart / gridInterval) * gridInterval)
  for (let t = gridStart; t <= visibleEnd; t += gridInterval) {
    const x = Math.round(timeToX(t)) + 0.5
    if (x < HEADER_W) continue

    const isBar = Math.abs(t % barDur) < 0.001
    ctx.strokeStyle = isBar ? '#334155' : '#1e293b'
    ctx.lineWidth = isBar ? 1 : 0.5
    ctx.beginPath()
    ctx.moveTo(x, RULER_H)
    ctx.lineTo(x, RULER_H + BASE_TRACK_H * trackCount) // only through clip lanes
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
    const y = getTrackY(inst.trackIndex) + 2
    const clipH = BASE_TRACK_H - 4

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
    const ty = getTrackY(i)
    if (ty > h) break
    const totalH = getTrackHeight(i)
    const track = sequencer.arrangementTracks[i]

    // Track header background (spans full track height)
    ctx.fillStyle = i % 2 === 0 ? '#111827' : '#0f172a'
    ctx.fillRect(0, ty, HEADER_W, totalH)

    // Bottom border
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, ty + totalH + 0.5)
    ctx.lineTo(HEADER_W, ty + totalH + 0.5)
    ctx.stroke()

    if (track) {
      // Track name
      ctx.fillStyle = '#d1d5db'
      ctx.font = '10px sans-serif'
      ctx.textBaseline = 'middle'
      ctx.fillText(track.name, 4, ty + BASE_TRACK_H / 2 - 6, HEADER_W - 20)

      // Mute/Solo indicators
      ctx.font = '8px monospace'
      if (track.muted) {
        ctx.fillStyle = '#ef4444'
        ctx.fillText('M', 4, ty + BASE_TRACK_H / 2 + 10)
      }
      if (track.solo) {
        ctx.fillStyle = '#eab308'
        ctx.fillText('S', 16, ty + BASE_TRACK_H / 2 + 10)
      }

      // Expand toggle triangle (bottom-right area of clip lane header)
      const hasClips = sequencer.clipInstances.some(ci => ci.trackIndex === i)
      if (hasClips) {
        const triX = HEADER_W - 14
        const triY = ty + BASE_TRACK_H - 14
        ctx.fillStyle = track.expanded ? '#60a5fa' : '#6b7280'
        ctx.beginPath()
        if (track.expanded) {
          // Down-pointing triangle
          ctx.moveTo(triX, triY)
          ctx.lineTo(triX + 10, triY)
          ctx.lineTo(triX + 5, triY + 8)
        } else {
          // Right-pointing triangle
          ctx.moveTo(triX, triY)
          ctx.lineTo(triX + 8, triY + 5)
          ctx.lineTo(triX, triY + 10)
        }
        ctx.closePath()
        ctx.fill()
      }

      // Color stripe (spans full height)
      ctx.fillStyle = track.color
      ctx.fillRect(HEADER_W - 3, ty, 3, totalH)

      // Automation lane headers in gutter
      if (track.expanded && track.automationLanes.length > 0) {
        let laneY = ty + BASE_TRACK_H
        for (const lane of track.automationLanes) {
          const laneH = lane.collapsed ? AUTO_COLLAPSED_H : AUTO_LANE_H

          // Lane header separator
          ctx.strokeStyle = '#1e293b'
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(0, laneY + 0.5)
          ctx.lineTo(HEADER_W, laneY + 0.5)
          ctx.stroke()

          // Lane background in gutter
          ctx.fillStyle = '#0a0f18'
          ctx.fillRect(0, laneY, HEADER_W - 3, laneH)

          if (lane.collapsed) {
            // Collapsed: right-pointing triangle + name
            ctx.fillStyle = '#4b5563'
            ctx.beginPath()
            ctx.moveTo(4, laneY + 4)
            ctx.lineTo(10, laneY + 8)
            ctx.lineTo(4, laneY + 12)
            ctx.closePath()
            ctx.fill()

            ctx.fillStyle = '#6b7280'
            ctx.font = '8px sans-serif'
            ctx.textBaseline = 'middle'
            ctx.fillText(lane.paramName, 14, laneY + AUTO_COLLAPSED_H / 2, HEADER_W - 20)
          } else {
            // Expanded: down-pointing triangle + name + range
            ctx.fillStyle = '#60a5fa'
            ctx.beginPath()
            ctx.moveTo(4, laneY + 4)
            ctx.lineTo(12, laneY + 4)
            ctx.lineTo(8, laneY + 10)
            ctx.closePath()
            ctx.fill()

            ctx.fillStyle = '#9ca3af'
            ctx.font = '9px sans-serif'
            ctx.textBaseline = 'top'
            ctx.fillText(lane.paramName, 14, laneY + 3, HEADER_W - 20)

            // Min/max range
            ctx.fillStyle = '#4b5563'
            ctx.font = '7px monospace'
            ctx.textBaseline = 'bottom'
            ctx.fillText(lane.max.toFixed(1), 4, laneY + 14)
            ctx.textBaseline = 'bottom'
            ctx.fillText(lane.min.toFixed(1), 4, laneY + AUTO_LANE_H - 2)
          }

          laneY += laneH
        }
      }
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

  const rulerGridStart = Math.max(0, Math.floor(visibleStart / gridInterval) * gridInterval)
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
    const dropY = getTrackY(dropTargetTrack.value)
    const dropX = timeToX(dropTargetTime.value)

    // Highlight target track lane
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
    ctx.fillRect(HEADER_W, dropY, w - HEADER_W, BASE_TRACK_H)

    // Drop position line
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(dropX, dropY)
    ctx.lineTo(dropX, dropY + BASE_TRACK_H)
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

function drawNoteParamBars(
  ctx: CanvasRenderingContext2D,
  clip: SequencerClip,
  inst: ClipInstance,
  lane: ParameterLaneConfig,
  laneTop: number, laneH: number, canvasW: number,
) {
  if (clip.notes.length === 0) return

  const range = lane.max - lane.min
  if (range === 0) return

  const clipStartX = timeToX(inst.startTime)
  const clipEndX = timeToX(inst.startTime + clip.duration)
  const leftBound = Math.max(clipStartX, HEADER_W)
  const rightBound = Math.min(clipEndX, canvasW)
  if (leftBound >= rightBound) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(leftBound, laneTop, rightBound - leftBound, laneH)
  ctx.clip()

  const BAR_H = 6

  for (const note of clip.notes) {
    if (note.muted) continue
    const paramValue = lane.paramIndex < note.params.length ? note.params[lane.paramIndex] : 0
    const normalized = Math.max(0, Math.min(1, (paramValue - lane.min) / range))

    const barX = timeToX(inst.startTime + note.startTime)
    const barW = Math.max(note.duration * sequencer.viewport.zoomX, 4)
    const barCenterY = laneTop + laneH * (1 - normalized)
    const barY = barCenterY - BAR_H / 2

    // Filled bar
    ctx.fillStyle = adjustAlpha(clip.color, 0.7)
    ctx.fillRect(barX, barY, barW, BAR_H)

    // Bar outline
    ctx.strokeStyle = adjustAlpha(clip.color, 0.95)
    ctx.lineWidth = 1
    ctx.strokeRect(barX, barY, barW, BAR_H)

    // Center dot for grab indication
    const dotX = barX + barW / 2
    ctx.beginPath()
    ctx.arc(dotX, barCenterY, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
  }

  ctx.restore()
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

  const trackIdx = trackIndexFromY(y)
  if (trackIdx < 0) return

  // Click in header area
  if (x < HEADER_W) {
    const track = sequencer.arrangementTracks[trackIdx]
    if (!track) return

    // Check if click is on expand toggle triangle
    const ty = getTrackY(trackIdx)
    const triX = HEADER_W - 14
    const triY = ty + BASE_TRACK_H - 14
    if (x >= triX && x <= triX + 10 && y >= triY && y <= triY + 10) {
      sequencer.toggleTrackExpanded(trackIdx)
      requestDraw()
      return
    }

    // Check if click is in an automation lane header (collapse toggle)
    if (track.expanded) {
      const autoHit = getAutomationLaneAtY(y, trackIdx)
      if (autoHit && x < 14) {
        sequencer.toggleTrackAutomationLane(trackIdx, autoHit.lane.paramName)
        requestDraw()
        return
      }
    }

    return
  }

  // Check if we're in an automation lane (not clip area)
  if (!isYInClipArea(y, trackIdx)) {
    const autoHit = getAutomationLaneAtY(y, trackIdx)
    if (autoHit && !autoHit.lane.collapsed) {
      // Hit-test for a note bar in this lane — any edit mode can drag note param values
      const barHit = getNoteBarAtPoint(x, y, trackIdx, autoHit.lane, autoHit.laneTop, AUTO_LANE_H)
      if (barHit) {
        sequencer.pushUndo()
        isDragging.value = true
        dragMode.value = 'automation-edit'
        dragAutoNoteId.value = barHit.note.id
        dragAutoClipId.value = barHit.clipId
        dragAutoParamIndex.value = autoHit.lane.paramIndex
        dragAutoLane.value = autoHit.lane
        dragAutoLaneTop.value = autoHit.laneTop
      }
      requestDraw()
    }
    return
  }

  // From here on, we're in the clip area
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
      const t = Math.max(0, xToTime(x))
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
    // Update cursor and hover state
    const trackIdx = trackIndexFromY(y)

    if (y < RULER_H) {
      canvas.style.cursor = 'pointer'
      hoveredInstance.value = null
    } else if (x < HEADER_W) {
      // Check for expand toggle or automation lane collapse
      const track = trackIdx >= 0 ? sequencer.arrangementTracks[trackIdx] : null
      if (track) {
        const ty = getTrackY(trackIdx)
        const triX = HEADER_W - 14
        const triY = ty + BASE_TRACK_H - 14
        if (x >= triX && x <= triX + 10 && y >= triY && y <= triY + 10) {
          canvas.style.cursor = 'pointer'
        } else if (track.expanded) {
          const autoHit = getAutomationLaneAtY(y, trackIdx)
          canvas.style.cursor = (autoHit && x < 14) ? 'pointer' : 'default'
        } else {
          canvas.style.cursor = 'default'
        }
      } else {
        canvas.style.cursor = 'default'
      }
      hoveredInstance.value = null
    } else if (trackIdx >= 0 && !isYInClipArea(y, trackIdx)) {
      // In automation lane area — show ns-resize over note bars
      const autoHit = getAutomationLaneAtY(y, trackIdx)
      if (autoHit && !autoHit.lane.collapsed) {
        const barHit = getNoteBarAtPoint(x, y, trackIdx, autoHit.lane, autoHit.laneTop, AUTO_LANE_H)
        canvas.style.cursor = barHit ? 'ns-resize' : 'default'
      } else {
        canvas.style.cursor = 'default'
      }
      hoveredInstance.value = null
    } else {
      const hit = getInstanceAtPoint(x, y)
      hoveredInstance.value = hit?.instance || null

      if (hit) {
        canvas.style.cursor = hit.edge === 'right' ? 'ew-resize' : 'pointer'
      } else if (sequencer.editMode === 'draw') {
        canvas.style.cursor = 'crosshair'
      } else {
        canvas.style.cursor = 'default'
      }
    }

    requestDraw()
    return
  }

  // Dragging note-bar in automation lane (change param value)
  if (dragMode.value === 'automation-edit' && dragAutoLane.value && dragAutoNoteId.value) {
    const lane = dragAutoLane.value
    const laneTop = dragAutoLaneTop.value
    const normalized = 1 - Math.max(0, Math.min(1, (y - laneTop) / AUTO_LANE_H))
    const newValue = lane.min + normalized * (lane.max - lane.min)
    const clamped = Math.max(lane.min, Math.min(lane.max, newValue))

    sequencer.updateNoteParamInClip(
      dragAutoClipId.value,
      dragAutoNoteId.value,
      dragAutoParamIndex.value,
      clamped,
    )

    requestDraw()
    return
  }

  if (dragMode.value === 'move' && dragTarget.value) {
    const dt = (x - dragStartX.value) / sequencer.viewport.zoomX
    const newTime = Math.max(0, sequencer.snapTime(dragOriginalStartTime.value + dt))
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
      const finalDur = Math.max(newDur, 0.1)
      clip.duration = finalDur
      requestDraw()
    }
  }
}

function handleMouseUp() {
  isDragging.value = false
  dragMode.value = 'none'
  dragTarget.value = null
  dragAutoLane.value = null
  dragAutoNoteId.value = ''
  dragAutoClipId.value = ''
  dragAutoParamIndex.value = -1
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
  } else {
    // Use whichever axis has more movement (supports trackpad horizontal swipe + mouse wheel)
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    sequencer.viewport.scrollX += delta / sequencer.viewport.zoomX
  }

  // Clamp to non-negative time
  sequencer.viewport.scrollX = Math.max(0, sequencer.viewport.scrollX)
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
