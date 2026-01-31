/**
 * Canvas Rendering Optimization Utility
 *
 * Provides high-performance canvas rendering for timeline components:
 * - Dirty rectangle tracking for minimal redraws
 * - Offscreen canvas for complex elements
 * - RequestAnimationFrame scheduling
 * - Region merging to minimize render calls
 *
 * Based on best practices from web.dev/canvas-performance
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RenderRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasLayer {
  id: string
  canvas: HTMLCanvasElement | OffscreenCanvas
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  dirty: boolean
  zIndex: number
  render: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, region?: RenderRegion) => void
}

export interface TimelineCanvasConfig {
  width: number
  height: number
  pixelRatio?: number
  enableOffscreen?: boolean
  enableDirtyRects?: boolean
}

// ─── Canvas Optimizer Class ──────────────────────────────────────────────────

export class TimelineCanvasRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private offscreenCanvas: OffscreenCanvas | HTMLCanvasElement | null = null
  private offscreenCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null
  private dirtyRegions: RenderRegion[] = []
  private animationFrame: number | null = null
  private layers: Map<string, CanvasLayer> = new Map()
  private pixelRatio: number = 1
  private enableDirtyRects: boolean = true

  constructor(canvas: HTMLCanvasElement, config: Partial<TimelineCanvasConfig> = {}) {
    this.canvas = canvas
    this.pixelRatio = config.pixelRatio ?? window.devicePixelRatio ?? 1
    this.enableDirtyRects = config.enableDirtyRects ?? true

    // Get context with performance optimizations
    const ctx = canvas.getContext('2d', {
      alpha: false,           // No transparency needed for timeline background
      desynchronized: true,   // Reduce latency
    })

    if (!ctx) {
      throw new Error('Failed to get 2D rendering context')
    }

    this.ctx = ctx

    // Apply pixel ratio scaling
    this.applyPixelRatio()

    // Create offscreen canvas if supported and enabled
    if (config.enableOffscreen !== false) {
      this.createOffscreenCanvas()
    }
  }

  // ─── Setup ─────────────────────────────────────────────────────────────────

  private applyPixelRatio(): void {
    const { width, height } = this.canvas.getBoundingClientRect()
    this.canvas.width = width * this.pixelRatio
    this.canvas.height = height * this.pixelRatio
    this.ctx.scale(this.pixelRatio, this.pixelRatio)
  }

  private createOffscreenCanvas(): void {
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        this.offscreenCanvas = new OffscreenCanvas(
          this.canvas.width,
          this.canvas.height
        )
        this.offscreenCtx = this.offscreenCanvas.getContext('2d')
      } else {
        // Fallback for browsers without OffscreenCanvas
        this.offscreenCanvas = document.createElement('canvas')
        this.offscreenCanvas.width = this.canvas.width
        this.offscreenCanvas.height = this.canvas.height
        this.offscreenCtx = this.offscreenCanvas.getContext('2d')
      }
    } catch (e) {
      console.warn('[CanvasOptimizer] Offscreen canvas not available:', e)
    }
  }

  // ─── Layer Management ──────────────────────────────────────────────────────

  addLayer(
    id: string,
    zIndex: number,
    render: CanvasLayer['render']
  ): void {
    // Create dedicated canvas for this layer
    let layerCanvas: HTMLCanvasElement | OffscreenCanvas
    let layerCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null

    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        layerCanvas = new OffscreenCanvas(this.canvas.width, this.canvas.height)
        layerCtx = layerCanvas.getContext('2d')
      } else {
        layerCanvas = document.createElement('canvas')
        layerCanvas.width = this.canvas.width
        layerCanvas.height = this.canvas.height
        layerCtx = layerCanvas.getContext('2d')
      }
    } catch {
      layerCanvas = document.createElement('canvas')
      layerCanvas.width = this.canvas.width
      layerCanvas.height = this.canvas.height
      layerCtx = layerCanvas.getContext('2d')
    }

    if (!layerCtx) return

    this.layers.set(id, {
      id,
      canvas: layerCanvas,
      ctx: layerCtx,
      dirty: true,
      zIndex,
      render,
    })
  }

  removeLayer(id: string): void {
    this.layers.delete(id)
  }

  markLayerDirty(id: string): void {
    const layer = this.layers.get(id)
    if (layer) {
      layer.dirty = true
      this.scheduleRender()
    }
  }

  // ─── Dirty Rectangle Management ────────────────────────────────────────────

  markDirty(region: RenderRegion): void {
    if (!this.enableDirtyRects) {
      // If dirty rects disabled, mark everything dirty
      this.dirtyRegions = [{
        x: 0,
        y: 0,
        width: this.canvas.width / this.pixelRatio,
        height: this.canvas.height / this.pixelRatio,
      }]
    } else {
      this.dirtyRegions.push(region)
    }
    this.scheduleRender()
  }

  markAllDirty(): void {
    this.dirtyRegions = [{
      x: 0,
      y: 0,
      width: this.canvas.width / this.pixelRatio,
      height: this.canvas.height / this.pixelRatio,
    }]
    this.layers.forEach(layer => layer.dirty = true)
    this.scheduleRender()
  }

  // ─── Render Scheduling ─────────────────────────────────────────────────────

  private scheduleRender(): void {
    if (this.animationFrame !== null) return
    this.animationFrame = requestAnimationFrame(() => this.render())
  }

  cancelRender(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  forceRender(): void {
    this.cancelRender()
    this.render()
  }

  private render(): void {
    this.animationFrame = null

    if (this.dirtyRegions.length === 0 && !this.hasAnyDirtyLayer()) {
      return
    }

    // Merge overlapping dirty regions
    const merged = this.mergeDirtyRegions(this.dirtyRegions)
    this.dirtyRegions = []

    // Render each dirty region
    if (merged.length === 0) {
      // No specific regions, check layers
      this.renderLayers()
    } else {
      for (const region of merged) {
        this.renderRegion(region)
      }
    }

    // Composite layers onto main canvas
    this.compositeLayers()
  }

  private hasAnyDirtyLayer(): boolean {
    for (const layer of this.layers.values()) {
      if (layer.dirty) return true
    }
    return false
  }

  private renderRegion(region: RenderRegion): void {
    // Save context state
    this.ctx.save()

    // Clip to dirty region
    this.ctx.beginPath()
    this.ctx.rect(region.x, region.y, region.width, region.height)
    this.ctx.clip()

    // Clear the region
    this.ctx.clearRect(region.x, region.y, region.width, region.height)

    // Render layers that intersect this region
    const sortedLayers = Array.from(this.layers.values())
      .sort((a, b) => a.zIndex - b.zIndex)

    for (const layer of sortedLayers) {
      if (this.regionIntersectsLayer(region, layer)) {
        layer.render(layer.ctx, region)
        layer.dirty = false
      }
    }

    // Restore context
    this.ctx.restore()
  }

  private renderLayers(): void {
    const sortedLayers = Array.from(this.layers.values())
      .filter(l => l.dirty)
      .sort((a, b) => a.zIndex - b.zIndex)

    for (const layer of sortedLayers) {
      // Clear layer canvas
      layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height)

      // Render layer content
      layer.render(layer.ctx)
      layer.dirty = false
    }
  }

  private compositeLayers(): void {
    // Clear main canvas
    this.ctx.clearRect(
      0, 0,
      this.canvas.width / this.pixelRatio,
      this.canvas.height / this.pixelRatio
    )

    // Draw layers in order
    const sortedLayers = Array.from(this.layers.values())
      .sort((a, b) => a.zIndex - b.zIndex)

    for (const layer of sortedLayers) {
      this.ctx.drawImage(
        layer.canvas as CanvasImageSource,
        0, 0,
        this.canvas.width / this.pixelRatio,
        this.canvas.height / this.pixelRatio
      )
    }
  }

  private regionIntersectsLayer(_region: RenderRegion, _layer: CanvasLayer): boolean {
    // For now, assume all layers need updating if the region overlaps
    // A more sophisticated implementation would track per-layer bounds
    return true
  }

  // ─── Dirty Region Merging ──────────────────────────────────────────────────

  private mergeDirtyRegions(regions: RenderRegion[]): RenderRegion[] {
    if (regions.length <= 1) return regions

    // Sort by x position
    const sorted = [...regions].sort((a, b) => a.x - b.x)

    const merged: RenderRegion[] = []
    let current = { ...sorted[0] }

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]

      // Check if regions overlap or are adjacent
      if (this.regionsOverlap(current, next)) {
        // Merge them
        current = this.mergeTwo(current, next)
      } else {
        merged.push(current)
        current = { ...next }
      }
    }

    merged.push(current)

    // If too many regions, just redraw everything
    if (merged.length > 10) {
      return [{
        x: 0,
        y: 0,
        width: this.canvas.width / this.pixelRatio,
        height: this.canvas.height / this.pixelRatio,
      }]
    }

    return merged
  }

  private regionsOverlap(a: RenderRegion, b: RenderRegion): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    )
  }

  private mergeTwo(a: RenderRegion, b: RenderRegion): RenderRegion {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    const right = Math.max(a.x + a.width, b.x + b.width)
    const bottom = Math.max(a.y + a.height, b.y + b.height)

    return {
      x,
      y,
      width: right - x,
      height: bottom - y,
    }
  }

  // ─── Resize Handling ───────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    // Update main canvas
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.canvas.width = width * this.pixelRatio
    this.canvas.height = height * this.pixelRatio
    this.ctx.scale(this.pixelRatio, this.pixelRatio)

    // Update offscreen canvas
    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = width * this.pixelRatio
      this.offscreenCanvas.height = height * this.pixelRatio
    }

    // Update all layer canvases
    for (const layer of this.layers.values()) {
      layer.canvas.width = width * this.pixelRatio
      layer.canvas.height = height * this.pixelRatio
      layer.dirty = true
    }

    this.markAllDirty()
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  get width(): number {
    return this.canvas.width / this.pixelRatio
  }

  get height(): number {
    return this.canvas.height / this.pixelRatio
  }

  get context(): CanvasRenderingContext2D {
    return this.ctx
  }

  get offscreen(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
    return this.offscreenCtx
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  dispose(): void {
    this.cancelRender()
    this.layers.clear()
    this.dirtyRegions = []
  }
}

// ─── Timeline-Specific Rendering Helpers ─────────────────────────────────────

export interface TimelineRenderState {
  scrollX: number
  scrollY: number
  zoom: number
  playheadPosition: number
  duration: number
  gridSnap: number
  bpm: number
}

export class TimelineRenderer extends TimelineCanvasRenderer {
  private state: TimelineRenderState = {
    scrollX: 0,
    scrollY: 0,
    zoom: 50,
    playheadPosition: 0,
    duration: 60,
    gridSnap: 0.25,
    bpm: 120,
  }

  constructor(canvas: HTMLCanvasElement, config?: Partial<TimelineCanvasConfig>) {
    super(canvas, config)

    // Add default layers
    this.addLayer('grid', 0, (ctx) => this.renderGrid(ctx as CanvasRenderingContext2D))
    this.addLayer('content', 1, (ctx) => this.renderContent(ctx as CanvasRenderingContext2D))
    this.addLayer('playhead', 2, (ctx) => this.renderPlayhead(ctx as CanvasRenderingContext2D))
  }

  updateState(updates: Partial<TimelineRenderState>): void {
    const prevState = { ...this.state }
    Object.assign(this.state, updates)

    // Determine which layers need updating
    if (updates.scrollX !== prevState.scrollX ||
        updates.scrollY !== prevState.scrollY ||
        updates.zoom !== prevState.zoom ||
        updates.gridSnap !== prevState.gridSnap ||
        updates.bpm !== prevState.bpm) {
      this.markLayerDirty('grid')
      this.markLayerDirty('content')
    }

    if (updates.playheadPosition !== prevState.playheadPosition) {
      // Only dirty the playhead region
      const prevX = this.timeToX(prevState.playheadPosition)
      const newX = this.timeToX(this.state.playheadPosition)

      this.markDirty({ x: prevX - 5, y: 0, width: 10, height: this.height })
      this.markDirty({ x: newX - 5, y: 0, width: 10, height: this.height })
      this.markLayerDirty('playhead')
    }
  }

  private timeToX(time: number): number {
    return (time * this.state.zoom) - this.state.scrollX
  }

  private xToTime(x: number): number {
    return (x + this.state.scrollX) / this.state.zoom
  }

  private renderGrid(ctx: CanvasRenderingContext2D): void {
    const { zoom, scrollX, duration, gridSnap, bpm } = this.state
    const width = this.width
    const height = this.height

    // Calculate beat duration
    const beatDuration = 60 / bpm
    const barDuration = beatDuration * 4

    // Draw minor grid lines (beats)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1

    const startTime = Math.floor(scrollX / zoom / gridSnap) * gridSnap
    const endTime = Math.min(duration, (scrollX + width) / zoom)

    for (let t = startTime; t <= endTime; t += gridSnap) {
      const x = this.timeToX(t)
      if (x >= 0 && x <= width) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
    }

    // Draw major grid lines (bars)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
    ctx.lineWidth = 1

    for (let t = 0; t <= endTime; t += barDuration) {
      const x = this.timeToX(t)
      if (x >= 0 && x <= width) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
    }
  }

  private renderContent(_ctx: CanvasRenderingContext2D): void {
    // This will be overridden by timeline components
    // Each component extends this and provides its own content rendering
  }

  private renderPlayhead(ctx: CanvasRenderingContext2D): void {
    const x = this.timeToX(this.state.playheadPosition)
    const height = this.height

    if (x >= 0 && x <= this.width) {
      // Playhead line
      ctx.strokeStyle = '#FF6B6B'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()

      // Playhead triangle
      ctx.fillStyle = '#FF6B6B'
      ctx.beginPath()
      ctx.moveTo(x - 6, 0)
      ctx.lineTo(x + 6, 0)
      ctx.lineTo(x, 10)
      ctx.closePath()
      ctx.fill()
    }
  }
}
