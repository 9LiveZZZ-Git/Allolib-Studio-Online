<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useSequencerStore } from '@/stores/sequencer'
import type { LatticePath } from '@/stores/sequencer'
import {
  generateLattice,
  generateLattice3D,
  isometricProject,
  type LatticeNode,
} from '@/utils/tone-lattice'

const sequencer = useSequencerStore()
const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()

// Use store state instead of local refs
const lattice = computed(() => {
  if (sequencer.latticeMode === '3d') {
    return generateLattice3D(
      sequencer.latticeFundamental,
      sequencer.latticeRangeI,
      sequencer.latticeRangeJ,
      sequencer.latticeRangeK,
    )
  }
  return generateLattice(
    sequencer.latticeFundamental,
    sequencer.latticeRangeI,
    sequencer.latticeRangeJ,
  )
})

// Active frequencies from visible events
const activeFrequencies = computed(() => {
  return new Set(sequencer.allEvents.map(ev => ev.frequency))
})

// Layout
const BASE_SPACING_X = 70
const BASE_SPACING_Y = 60
const BASE_SPACING_Z = 50
const NODE_MIN_R = 10
const NODE_MAX_R = 22

// Edge colors by axis type
const EDGE_COLORS: Record<string, string> = {
  prime3: '#1e3a5f',
  prime5: '#2d4a2d',
  prime2: '#4b5563',
}

// Compass interaction state
const isCompassDragging = ref(false)
const compassDragStartX = ref(0)
const compassDragStartY = ref(0)
const compassDragStartRotX = ref(0)
const compassDragStartRotY = ref(0)

// Compass dimensions
const COMPASS_SIZE = 70
const COMPASS_MARGIN = 12

// ── Lattice interaction state ──────────────────────────────────
const mouseDownNode = ref<LatticeNode | null>(null)
const mouseDownPos = ref<{ x: number; y: number } | null>(null)
const isDraggingPath = ref(false)
const dragPathNodes = ref<LatticeNode[]>([])

// Context menu refs
const contextNoteDuration = ref(0.5)
const contextNoteAmplitude = ref(0.5)
const contextPathOffset = ref(0.5)

// Chord finalization dialog
const showChordDialog = ref(false)
const chordDuration = ref(1)
const chordRepeats = ref(1)

// Poly dialog
const showPolyDialog = ref(false)
const polyDialogFrequency = ref(0)
const polyDialogX = ref(0)
const polyDialogY = ref(0)

function getSpacing() {
  const z = sequencer.latticeZoom
  return {
    x: BASE_SPACING_X * z,
    y: BASE_SPACING_Y * z,
    z: BASE_SPACING_Z * z,
  }
}

function nodeToCanvas2D(i: number, j: number, w: number, h: number): { x: number; y: number; depth: number } {
  const sp = getSpacing()
  return {
    x: w / 2 + i * sp.x,
    y: h / 2 - j * sp.y,
    depth: 0,
  }
}

function nodeToCanvas3D(i: number, j: number, k: number, w: number, h: number): { x: number; y: number; depth: number } {
  const sp = getSpacing()
  return isometricProject(
    i, j, k,
    sp.x, sp.y, sp.z,
    w / 2, h / 2,
    sequencer.latticeRotX, sequencer.latticeRotY,
  )
}

function nodeToCanvas(node: LatticeNode, w: number, h: number): { x: number; y: number; depth: number } {
  if (sequencer.latticeMode === '3d') {
    return nodeToCanvas3D(node.i, node.j, node.k, w, h)
  }
  return nodeToCanvas2D(node.i, node.j, w, h)
}

function findNodeAtPoint(x: number, y: number, w: number, h: number): LatticeNode | null {
  const { nodes } = lattice.value
  let closest: LatticeNode | null = null
  let minDist = (NODE_MAX_R * sequencer.latticeZoom) + 5

  // In 3D, iterate front-to-back so we pick the frontmost node
  const sorted = sequencer.latticeMode === '3d'
    ? [...nodes].sort((a, b) => {
        const pa = nodeToCanvas(a, w, h)
        const pb = nodeToCanvas(b, w, h)
        return pb.depth - pa.depth
      })
    : nodes

  for (const node of sorted) {
    const pos = nodeToCanvas(node, w, h)
    const depthScale = getDepthScale(node.k)
    const radius = (NODE_MIN_R + (NODE_MAX_R - NODE_MIN_R) * node.consonance) * depthScale * sequencer.latticeZoom
    const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)
    if (dist < radius + 5 && dist < minDist) {
      minDist = dist
      closest = node
    }
  }
  return closest
}

function getDepthScale(k: number): number {
  if (sequencer.latticeMode === '2d') return 1
  return Math.max(0.6, 1 - Math.abs(k) * 0.15)
}

function getDepthOpacity(k: number): number {
  if (sequencer.latticeMode === '2d') return 1
  const octaveFilter = sequencer.latticeOctaveFilter
  if (octaveFilter != null && k !== octaveFilter) return 0.2
  return Math.max(0.3, 1 - Math.abs(k) * 0.15)
}

// ── Compass geometry ─────────────────────────────────────────────

function getCompassRect(w: number, h: number) {
  return {
    x: w - COMPASS_SIZE - COMPASS_MARGIN,
    y: h - COMPASS_SIZE - COMPASS_MARGIN,
    size: COMPASS_SIZE,
  }
}

function isPointInCompass(px: number, py: number, w: number, h: number): boolean {
  if (sequencer.latticeMode !== '3d') return false
  const c = getCompassRect(w, h)
  const cx = c.x + c.size / 2
  const cy = c.y + c.size / 2
  const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
  return dist <= c.size / 2
}

function drawCompass(ctx: CanvasRenderingContext2D, w: number, h: number) {
  if (sequencer.latticeMode !== '3d') return

  const c = getCompassRect(w, h)
  const cx = c.x + c.size / 2
  const cy = c.y + c.size / 2
  const r = c.size / 2 - 4

  // Background circle
  ctx.globalAlpha = isCompassDragging.value ? 0.9 : 0.6
  ctx.fillStyle = '#1f2937'
  ctx.beginPath()
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = isCompassDragging.value ? '#60a5fa' : '#4b5563'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.globalAlpha = 1

  // Compute axis endpoints from rotation
  const rx = sequencer.latticeRotX * Math.PI / 180
  const ry = sequencer.latticeRotY * Math.PI / 180
  const cosRx = Math.cos(rx)
  const sinRx = Math.sin(rx)
  const cosRy = Math.cos(ry)
  const sinRy = Math.sin(ry)

  // 3D axis unit vectors, rotated then projected to 2D
  const axes = [
    { dx: 1, dy: 0, dz: 0, color: '#ef4444', label: '3' },  // prime-3 = X (red)
    { dx: 0, dy: 1, dz: 0, color: '#22c55e', label: '5' },  // prime-5 = Y (green)
    { dx: 0, dy: 0, dz: 1, color: '#3b82f6', label: '2' },  // prime-2 = Z (blue)
  ]

  for (const axis of axes) {
    let x3 = axis.dx, y3 = axis.dy, z3 = axis.dz

    // Apply Y rotation
    let nx = x3 * cosRy + z3 * sinRy
    let nz = -x3 * sinRy + z3 * cosRy
    x3 = nx; z3 = nz

    // Apply X rotation
    let ny = y3 * cosRx - z3 * sinRx
    nz = y3 * sinRx + z3 * cosRx
    y3 = ny; z3 = nz

    // Isometric project to 2D
    const cos30 = Math.cos(Math.PI / 6)
    const sin30 = Math.sin(Math.PI / 6)
    const sx = x3 + z3 * cos30
    const sy = -y3 - z3 * sin30

    const len = r * 0.75
    const ex = cx + sx * len
    const ey = cy + sy * len

    // Axis line
    ctx.strokeStyle = axis.color
    ctx.lineWidth = 2
    ctx.globalAlpha = z3 > -0.3 ? 1 : 0.3  // dim if pointing away
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.stroke()

    // Axis label
    ctx.fillStyle = axis.color
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lx = cx + sx * (len + 10)
    const ly = cy + sy * (len + 10)
    ctx.fillText(axis.label, lx, ly)
  }

  ctx.globalAlpha = 1

  // Reset button indicator (small dot at center)
  if (sequencer.latticeRotX !== 0 || sequencer.latticeRotY !== 0) {
    ctx.fillStyle = '#9ca3af'
    ctx.font = '8px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('drag to rotate', cx, c.y + c.size + 12)
  }
}

// ── Path drawing helpers ──────────────────────────────────────────

function drawPath(ctx: CanvasRenderingContext2D, path: LatticePath, w: number, h: number) {
  const points: Array<{ x: number; y: number }> = []
  for (const noteId of path.noteIds) {
    const note = sequencer.activeClipNotes.find(n => n.id === noteId)
    if (!note) continue
    const node = lattice.value.nodes.find(n =>
      Math.abs(Math.log2(n.frequency / note.frequency)) < 0.003
    )
    if (!node) continue
    points.push(nodeToCanvas(node, w, h))
  }

  if (points.length < 2) return

  const isActive = path.id === sequencer.latticeActivePath
  ctx.strokeStyle = isActive ? '#f59e0b' : '#d97706'
  ctx.lineWidth = 2
  ctx.setLineDash([4, 4])
  ctx.globalAlpha = 0.8
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
  ctx.setLineDash([])

  // Draw arrow heads at midpoints
  for (let i = 0; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2
    const my = (points[i].y + points[i + 1].y) / 2
    const angle = Math.atan2(points[i + 1].y - points[i].y, points[i + 1].x - points[i].x)
    const arrowLen = 6
    ctx.fillStyle = isActive ? '#f59e0b' : '#d97706'
    ctx.beginPath()
    ctx.moveTo(mx + Math.cos(angle) * arrowLen, my + Math.sin(angle) * arrowLen)
    ctx.lineTo(mx + Math.cos(angle + 2.5) * arrowLen, my + Math.sin(angle + 2.5) * arrowLen)
    ctx.lineTo(mx + Math.cos(angle - 2.5) * arrowLen, my + Math.sin(angle - 2.5) * arrowLen)
    ctx.closePath()
    ctx.fill()
  }

  ctx.globalAlpha = 1
}

function drawDragPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  if (dragPathNodes.value.length === 0) return

  const allNodes = mouseDownNode.value
    ? [mouseDownNode.value, ...dragPathNodes.value]
    : dragPathNodes.value

  const points = allNodes.map(n => nodeToCanvas(n, w, h))
  if (points.length < 2) return

  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth = 2.5
  ctx.setLineDash([6, 3])
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1
}

function findPathLineAtPoint(px: number, py: number, w: number, h: number): { pathId: string } | null {
  for (const path of sequencer.latticePaths) {
    const points: Array<{ x: number; y: number }> = []
    for (const noteId of path.noteIds) {
      const note = sequencer.activeClipNotes.find(n => n.id === noteId)
      if (!note) continue
      const node = lattice.value.nodes.find(n =>
        Math.abs(Math.log2(n.frequency / note.frequency)) < 0.003
      )
      if (!node) continue
      points.push(nodeToCanvas(node, w, h))
    }

    for (let i = 0; i < points.length - 1; i++) {
      const dist = pointToLineDistance(px, py, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y)
      if (dist < 8) return { pathId: path.id }
    }
  }
  return null
}

function pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = x1 + t * dx
  const projY = y1 + t * dy
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

// ── Main draw ────────────────────────────────────────────────────

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height

  // Clear
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, w, h)

  const { nodes, edges } = lattice.value
  const hoveredNode = sequencer.latticeHoveredNode
  const zoom = sequencer.latticeZoom

  // Sort nodes back-to-front for 3D
  const sortedNodes = sequencer.latticeMode === '3d'
    ? [...nodes].sort((a, b) => {
        const pa = nodeToCanvas(a, w, h)
        const pb = nodeToCanvas(b, w, h)
        return pa.depth - pb.depth
      })
    : nodes

  // Draw edges (back-to-front in 3D)
  const sortedEdges = sequencer.latticeMode === '3d'
    ? [...edges].sort((a, b) => {
        const fromA = nodes.find(n => n.i === a.from[0] && n.j === a.from[1] && n.k === a.from[2])
        const fromB = nodes.find(n => n.i === b.from[0] && n.j === b.from[1] && n.k === b.from[2])
        if (!fromA || !fromB) return 0
        return nodeToCanvas(fromA, w, h).depth - nodeToCanvas(fromB, w, h).depth
      })
    : edges

  for (const edge of sortedEdges) {
    const fromNode = nodes.find(n => n.i === edge.from[0] && n.j === edge.from[1] && n.k === edge.from[2])
    const toNode = nodes.find(n => n.i === edge.to[0] && n.j === edge.to[1] && n.k === edge.to[2])
    if (!fromNode || !toNode) continue

    const fromPos = nodeToCanvas(fromNode, w, h)
    const toPos = nodeToCanvas(toNode, w, h)
    const avgOpacity = (getDepthOpacity(fromNode.k) + getDepthOpacity(toNode.k)) / 2

    ctx.strokeStyle = EDGE_COLORS[edge.type] || '#1e293b'
    ctx.lineWidth = edge.type === 'prime2' ? 0.5 : 1
    ctx.globalAlpha = avgOpacity
    ctx.beginPath()
    ctx.moveTo(fromPos.x, fromPos.y)
    ctx.lineTo(toPos.x, toPos.y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Draw lattice paths
  for (const path of sequencer.latticePaths) {
    drawPath(ctx, path, w, h)
  }
  // Draw drag-in-progress path
  if (isDraggingPath.value) {
    drawDragPath(ctx, w, h)
  }

  // Draw nodes
  for (const node of sortedNodes) {
    const pos = nodeToCanvas(node, w, h)
    const depthScale = getDepthScale(node.k)
    const depthOpacity = getDepthOpacity(node.k)
    const radius = (NODE_MIN_R + (NODE_MAX_R - NODE_MIN_R) * node.consonance) * depthScale * zoom
    const isActive = isNodeActive(node)
    const isHovered = hoveredNode?.i === node.i && hoveredNode?.j === node.j && hoveredNode?.k === node.k
    const isUnison = node.i === 0 && node.j === 0 && node.k === 0

    ctx.globalAlpha = depthOpacity

    // Chord pending highlight
    if (sequencer.latticePendingChord) {
      const nodeKey = `${node.i},${node.j},${node.k}`
      if (sequencer.latticePendingChord.nodeKeys.includes(nodeKey)) {
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, radius + 4, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // Node circle
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)

    if (isUnison) {
      ctx.fillStyle = isHovered ? '#60a5fa' : '#3b82f6'
    } else if (isActive) {
      ctx.fillStyle = isHovered ? '#34d399' : '#22c55e'
    } else {
      ctx.fillStyle = isHovered ? '#374151' : '#1f2937'
    }
    ctx.fill()

    ctx.strokeStyle = isHovered ? '#fff' : isActive ? '#6ee7b7' : '#4b5563'
    ctx.lineWidth = isHovered ? 2 : 1
    ctx.stroke()

    // Label (hide on small zoom)
    if (radius > 6) {
      ctx.fillStyle = isActive || isUnison ? '#fff' : '#9ca3af'
      ctx.font = radius > 16 ? '11px monospace' : '9px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const displayLabel = sequencer.latticeMode === '3d' && node.k !== 0
        ? node.label.split(' ')[0]
        : node.label
      ctx.fillText(displayLabel, pos.x, pos.y)
    }

    // Frequency below (only for larger nodes)
    if (radius > 14) {
      ctx.fillStyle = '#6b7280'
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(`${Math.round(node.frequency)}`, pos.x, pos.y + radius + 4)
    }

    // Poly markers (^n)
    if (sequencer.latticePolyPathEnabled && isActive) {
      const count = sequencer.getPolyCount(node.frequency)
      if (count > 1) {
        ctx.fillStyle = '#f59e0b'
        ctx.font = 'bold 9px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`^${count}`, pos.x, pos.y - radius - 4)
      }
    }
  }

  ctx.globalAlpha = 1

  // Axis labels
  ctx.fillStyle = '#6b7280'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('\u2190 fourths    fifths \u2192', w / 2, h - 12)

  ctx.save()
  ctx.translate(12, h / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('\u2190 minor    major \u2192', 0, 0)
  ctx.restore()

  if (sequencer.latticeMode === '3d') {
    ctx.fillStyle = '#4b5563'
    ctx.font = '10px sans-serif'
    ctx.fillText('\u2199 lower octaves    higher octaves \u2197', w / 2, 14)
  }

  // Info overlay (top-left)
  ctx.fillStyle = '#9ca3af'
  ctx.font = '10px monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const yBase = sequencer.latticeMode === '3d' ? 26 : 8
  ctx.fillText(`Fund: ${sequencer.latticeFundamental} Hz`, 8, yBase)

  const zoomPct = Math.round(zoom * 100)
  ctx.fillText(`Zoom: ${zoomPct}%`, 8, yBase + 14)

  if (sequencer.latticeMode === '3d') {
    ctx.fillText(`3D  k: ${sequencer.latticeOctaveFilter !== null ? sequencer.latticeOctaveFilter : 'all'}`, 8, yBase + 28)
  }

  // Mode indicator
  const modeLabel = sequencer.latticeInteractionMode === 'note' ? 'Note'
    : sequencer.latticeInteractionMode === 'path' ? 'Path'
    : 'Chord'
  ctx.fillStyle = '#6b7280'
  ctx.textAlign = 'right'
  ctx.fillText(`Mode: ${modeLabel}`, w - 8, yBase)

  // Draw compass (3D only)
  drawCompass(ctx, w, h)
}

function isNodeActive(node: LatticeNode): boolean {
  for (const freq of activeFrequencies.value) {
    if (Math.abs(Math.log2(freq / node.frequency)) < 0.003) {
      return true
    }
  }
  return false
}

// ── Event handlers ───────────────────────────────────────────────

function getCanvasCoords(e: MouseEvent): { x: number; y: number } {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  }
}

function handleMouseDown(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const { x, y } = getCanvasCoords(e)

  // Close context menu on any click
  sequencer.closeContextMenu()

  // Check if clicking compass
  if (isPointInCompass(x, y, canvas.width, canvas.height)) {
    isCompassDragging.value = true
    compassDragStartX.value = e.clientX
    compassDragStartY.value = e.clientY
    compassDragStartRotX.value = sequencer.latticeRotX
    compassDragStartRotY.value = sequencer.latticeRotY
    document.addEventListener('mousemove', handleCompassDrag)
    document.addEventListener('mouseup', handleCompassDragEnd)
    e.preventDefault()
    return
  }

  // Right-click handled by contextmenu event
  if (e.button === 2) return

  const node = findNodeAtPoint(x, y, canvas.width, canvas.height)
  if (node) {
    mouseDownNode.value = node
    mouseDownPos.value = { x, y }
    isDraggingPath.value = false
    dragPathNodes.value = []
    e.preventDefault()
  }
}

function handleCompassDrag(e: MouseEvent) {
  if (!isCompassDragging.value) return
  const dx = e.clientX - compassDragStartX.value
  const dy = e.clientY - compassDragStartY.value
  sequencer.latticeRotY = compassDragStartRotY.value + dx * 0.5
  sequencer.latticeRotX = compassDragStartRotX.value + dy * 0.5
  // Clamp X rotation to +/- 60 degrees
  sequencer.latticeRotX = Math.max(-60, Math.min(60, sequencer.latticeRotX))
  requestDraw()
}

function handleCompassDragEnd() {
  isCompassDragging.value = false
  document.removeEventListener('mousemove', handleCompassDrag)
  document.removeEventListener('mouseup', handleCompassDragEnd)
  requestDraw()
}

function handleDblClick(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const { x, y } = getCanvasCoords(e)

  // Double-click on compass resets rotation
  if (isPointInCompass(x, y, canvas.width, canvas.height)) {
    sequencer.latticeRotX = 0
    sequencer.latticeRotY = 0
    requestDraw()
    return
  }
}

function handleMouseMove(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas || isCompassDragging.value) return

  const { x, y } = getCanvasCoords(e)

  // Compass hover cursor
  if (isPointInCompass(x, y, canvas.width, canvas.height)) {
    canvas.style.cursor = 'grab'
    sequencer.latticeHoveredNode = null
    requestDraw()
    return
  }

  // Path dragging
  if (mouseDownNode.value && mouseDownPos.value) {
    const dist = Math.sqrt((x - mouseDownPos.value.x) ** 2 + (y - mouseDownPos.value.y) ** 2)
    if (dist > 5 && sequencer.latticeInteractionMode === 'path') {
      isDraggingPath.value = true
      const hoverNode = findNodeAtPoint(x, y, canvas.width, canvas.height)
      if (hoverNode && !dragPathNodes.value.find(n =>
        n.i === hoverNode.i && n.j === hoverNode.j && n.k === hoverNode.k
      ) && !(mouseDownNode.value.i === hoverNode.i &&
             mouseDownNode.value.j === hoverNode.j &&
             mouseDownNode.value.k === hoverNode.k)) {
        dragPathNodes.value.push(hoverNode)
      }
      requestDraw()
      return
    }
  }

  const node = findNodeAtPoint(x, y, canvas.width, canvas.height)
  sequencer.latticeHoveredNode = node
  canvas.style.cursor = node ? 'pointer' : 'default'

  requestDraw()
}

function handleMouseUp(e: MouseEvent) {
  if (e.button === 2) return

  const canvas = canvasRef.value
  if (!canvas) return
  const { x, y } = getCanvasCoords(e)
  const node = findNodeAtPoint(x, y, canvas.width, canvas.height)

  if (isDraggingPath.value && dragPathNodes.value.length > 0) {
    createPathFromDrag()
  } else if (mouseDownNode.value && node &&
    node.i === mouseDownNode.value.i &&
    node.j === mouseDownNode.value.j &&
    node.k === mouseDownNode.value.k) {
    handleNodeClick(node, e)
  }

  mouseDownNode.value = null
  mouseDownPos.value = null
  isDraggingPath.value = false
  dragPathNodes.value = []
  requestDraw()
}

function handleNodeClick(node: LatticeNode, e: MouseEvent) {
  const mode = sequencer.latticeInteractionMode

  if (mode === 'note') {
    // Toggle: if note exists -> remove, else -> add
    sequencer.toggleNoteAtFrequency(node.frequency)
  } else if (mode === 'path') {
    if (sequencer.latticePolyPathEnabled) {
      // Poly mode: check if clicking ^n marker
      const count = sequencer.getPolyCount(node.frequency)
      if (count > 1) {
        // Open poly dialog
        polyDialogFrequency.value = node.frequency
        polyDialogX.value = e.clientX
        polyDialogY.value = e.clientY
        showPolyDialog.value = true
        return
      }
      // Always add a new note in poly mode
      const synthName = sequencer.detectedSynthClasses[0] || sequencer.synthNames[0] || 'SineEnv'
      const dur = sequencer.getSnapInterval() || 0.5
      sequencer.addEvent(synthName, sequencer.playheadPosition, dur, node.frequency, 0.5)
    } else {
      if (sequencer.latticeActivePath) {
        // Extending active path: extendPath creates the note internally
        sequencer.extendPath(node.frequency)
      } else {
        // Starting new path: toggle to create note, then start path
        const result = sequencer.toggleNoteAtFrequency(node.frequency)
        if (result.added) {
          sequencer.startPath(result.noteId)
        }
      }
    }
  } else if (mode === 'chord') {
    // Add note to pending chord
    sequencer.addChordNote(node.frequency)
    sequencer.addChordNodeKey(`${node.i},${node.j},${node.k}`)
    requestDraw()
  }
}

function createPathFromDrag() {
  if (!mouseDownNode.value || dragPathNodes.value.length === 0) return

  const allNodes = [mouseDownNode.value, ...dragPathNodes.value]
  const synthName = sequencer.detectedSynthClasses[0] || sequencer.synthNames[0] || 'SineEnv'
  const dur = sequencer.getSnapInterval() || 0.5
  const offset = dur

  // Create notes for each node in the path
  const firstNote = sequencer.addEvent(synthName, sequencer.playheadPosition, dur, allNodes[0].frequency, 0.5)
  if (!firstNote) return

  sequencer.startPath(firstNote.id)

  for (let i = 1; i < allNodes.length; i++) {
    sequencer.extendPath(allNodes[i].frequency)
  }

  sequencer.finalizePath()
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  const canvas = canvasRef.value
  if (!canvas) return
  const { x, y } = getCanvasCoords(e)

  const node = findNodeAtPoint(x, y, canvas.width, canvas.height)

  if (node && isNodeActive(node)) {
    // Right-click on active note
    const notes = sequencer.findNotesByFrequency(node.frequency)
    if (notes.length > 0) {
      contextNoteDuration.value = notes[0].duration
      contextNoteAmplitude.value = notes[0].amplitude
      sequencer.openContextMenu('note', e.clientX, e.clientY, notes[0].id)
    }
  } else {
    // Check if near a path line
    const pathHit = findPathLineAtPoint(x, y, canvas.width, canvas.height)
    if (pathHit) {
      const path = sequencer.latticePaths.find(p => p.id === pathHit.pathId)
      if (path) {
        contextPathOffset.value = path.timeOffset
        sequencer.openContextMenu('path', e.clientX, e.clientY, undefined, pathHit.pathId)
      }
    }
  }
}

function updateContextNote() {
  const menu = sequencer.latticeContextMenu
  if (!menu || menu.type !== 'note' || !menu.noteId) return
  sequencer.updateNote(menu.noteId, {
    duration: Math.max(0.01, contextNoteDuration.value),
    amplitude: Math.max(0, Math.min(1, contextNoteAmplitude.value)),
  })
}

function applyPathOffset() {
  const menu = sequencer.latticeContextMenu
  if (!menu || menu.type !== 'path' || !menu.pathId) return
  sequencer.setPathTimeOffset(menu.pathId, Math.max(0.01, contextPathOffset.value))
  sequencer.closeContextMenu()
}

function handleMouseLeave() {
  sequencer.latticeHoveredNode = null
  requestDraw()
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  const newZoom = Math.max(0.3, Math.min(3.0, sequencer.latticeZoom + delta))
  sequencer.latticeZoom = Math.round(newZoom * 100) / 100
  requestDraw()
}

// ── Chord dialog ──────────────────────────────────────────────────

function openChordDialog() {
  chordDuration.value = 1
  chordRepeats.value = 1
  showChordDialog.value = true
}

function handleFinalizeChord() {
  sequencer.finalizeChord(chordDuration.value, chordRepeats.value)
  showChordDialog.value = false
}

function handleCancelChord() {
  sequencer.cancelChord()
  showChordDialog.value = false
}

// Expose openChordDialog for toolbar button
defineExpose({ openChordDialog })

// ── Canvas setup ─────────────────────────────────────────────────

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

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeCanvas()
  resizeObserver = new ResizeObserver(() => resizeCanvas())
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
  document.removeEventListener('mousemove', handleCompassDrag)
  document.removeEventListener('mouseup', handleCompassDragEnd)
})

// Watch store lattice settings for redraw
watch(
  () => [
    sequencer.latticeFundamental,
    sequencer.latticeRangeI,
    sequencer.latticeRangeJ,
    sequencer.latticeRangeK,
    sequencer.latticeMode,
    sequencer.latticeOctaveFilter,
    sequencer.latticeZoom,
    sequencer.latticeRotX,
    sequencer.latticeRotY,
    sequencer.latticeInteractionMode,
    sequencer.latticePolyPathEnabled,
    sequencer.latticePendingChord,
  ],
  () => requestDraw(),
)
watch(() => sequencer.allEvents, () => requestDraw(), { deep: true })
watch(() => sequencer.latticePaths, () => requestDraw(), { deep: true })

// Finalize active path when switching interaction mode
watch(() => sequencer.latticeInteractionMode, () => {
  if (sequencer.latticeActivePath) {
    sequencer.finalizePath()
  }
})
</script>

<template>
  <div ref="containerRef" class="relative w-full h-full overflow-hidden">
    <canvas
      ref="canvasRef"
      class="absolute inset-0 w-full h-full"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @mousemove="handleMouseMove"
      @dblclick="handleDblClick"
      @mouseleave="handleMouseLeave"
      @wheel.prevent="handleWheel"
      @contextmenu.prevent="handleContextMenu"
    />

    <!-- Note context menu -->
    <div
      v-if="sequencer.latticeContextMenu?.type === 'note'"
      class="fixed z-50 bg-editor-sidebar border border-editor-border rounded shadow-lg p-2 min-w-[180px]"
      :style="{ left: sequencer.latticeContextMenu.x + 'px', top: sequencer.latticeContextMenu.y + 'px' }"
      @mousedown.stop
    >
      <div class="text-xs text-gray-400 mb-2 font-medium">Note Properties</div>
      <label class="flex items-center justify-between text-xs mb-1.5">
        <span class="text-gray-400">Duration</span>
        <input
          type="number"
          step="0.05"
          min="0.01"
          v-model.number="contextNoteDuration"
          @change="updateContextNote"
          class="w-16 bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:border-allolib-blue"
        />
      </label>
      <label class="flex items-center justify-between text-xs mb-1.5">
        <span class="text-gray-400">Amplitude</span>
        <input
          type="number"
          step="0.05"
          min="0"
          max="1"
          v-model.number="contextNoteAmplitude"
          @change="updateContextNote"
          class="w-16 bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:border-allolib-blue"
        />
      </label>
      <button
        @click="sequencer.closeContextMenu()"
        class="w-full text-xs text-gray-500 hover:text-white mt-1 py-0.5 rounded hover:bg-editor-active transition-colors"
      >Close</button>
    </div>

    <!-- Path context menu -->
    <div
      v-if="sequencer.latticeContextMenu?.type === 'path'"
      class="fixed z-50 bg-editor-sidebar border border-editor-border rounded shadow-lg p-2 min-w-[180px]"
      :style="{ left: sequencer.latticeContextMenu.x + 'px', top: sequencer.latticeContextMenu.y + 'px' }"
      @mousedown.stop
    >
      <div class="text-xs text-gray-400 mb-2 font-medium">Path Settings</div>
      <label class="flex items-center justify-between text-xs mb-1.5">
        <span class="text-gray-400">Note Offset (s)</span>
        <input
          type="number"
          step="0.05"
          min="0.01"
          v-model.number="contextPathOffset"
          class="w-16 bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:border-allolib-blue"
        />
      </label>
      <button
        @click="applyPathOffset"
        class="w-full text-xs text-allolib-blue hover:text-white py-0.5 rounded hover:bg-editor-active transition-colors"
      >Apply</button>
    </div>

    <!-- Poly paths dialog -->
    <div
      v-if="showPolyDialog"
      class="fixed z-50 bg-editor-sidebar border border-editor-border rounded shadow-lg p-3 min-w-[220px]"
      :style="{ left: polyDialogX + 'px', top: polyDialogY + 'px' }"
      @mousedown.stop
    >
      <div class="text-xs text-gray-400 mb-2 font-medium">
        Paths through {{ Math.round(polyDialogFrequency) }} Hz
      </div>
      <div class="space-y-1 max-h-[200px] overflow-y-auto">
        <div
          v-for="path in sequencer.latticePaths.filter(p =>
            p.noteIds.some(id => {
              const n = sequencer.activeClipNotes.find(note => note.id === id)
              return n && Math.abs(Math.log2(n.frequency / polyDialogFrequency)) < 0.003
            })
          )"
          :key="path.id"
          class="flex items-center justify-between text-xs bg-editor-bg rounded px-2 py-1"
        >
          <span class="text-gray-300">{{ path.noteIds.length }} notes</span>
          <span class="text-gray-500">offset: {{ path.timeOffset.toFixed(2) }}s</span>
        </div>
      </div>
      <button
        @click="showPolyDialog = false"
        class="w-full text-xs text-gray-500 hover:text-white mt-2 py-0.5 rounded hover:bg-editor-active transition-colors"
      >Close</button>
    </div>

    <!-- Chord finalization dialog -->
    <div
      v-if="showChordDialog && sequencer.latticePendingChord"
      class="fixed z-50 bg-editor-sidebar border border-editor-border rounded shadow-lg p-3 min-w-[240px]"
      style="left: 50%; top: 50%; transform: translate(-50%, -50%);"
      @mousedown.stop
    >
      <div class="text-xs text-gray-400 mb-3 font-medium">
        Finalize Chord ({{ sequencer.latticePendingChord.frequencies.length }} notes)
      </div>
      <div class="space-y-2">
        <div class="text-[10px] text-gray-500 mb-1">
          Frequencies: {{ sequencer.latticePendingChord.frequencies.map(f => Math.round(f)).join(', ') }} Hz
        </div>
        <label class="flex items-center justify-between text-xs">
          <span class="text-gray-400">Duration (s)</span>
          <input
            type="number"
            step="0.25"
            min="0.1"
            v-model.number="chordDuration"
            class="w-16 bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:border-allolib-blue"
          />
        </label>
        <label class="flex items-center justify-between text-xs">
          <span class="text-gray-400">Repeats</span>
          <input
            type="number"
            step="1"
            min="1"
            max="32"
            v-model.number="chordRepeats"
            class="w-16 bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:border-allolib-blue"
          />
        </label>
      </div>
      <div class="flex gap-1 mt-3">
        <button
          @click="handleFinalizeChord"
          class="flex-1 py-1 text-xs bg-allolib-blue text-white rounded hover:bg-allolib-blue/80 transition-colors"
        >Create</button>
        <button
          @click="handleCancelChord"
          class="flex-1 py-1 text-xs text-gray-400 hover:text-white rounded hover:bg-editor-active border border-editor-border transition-colors"
        >Cancel</button>
      </div>
    </div>
  </div>
</template>
