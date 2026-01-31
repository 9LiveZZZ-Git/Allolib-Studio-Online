/**
 * Audio-Visual Sync Manager
 *
 * Provides a master clock based on AudioContext for precise timing.
 * Ensures that audio and visual timelines stay synchronized.
 *
 * Features:
 * - AudioContext-based master clock (most accurate in browsers)
 * - RequestAnimationFrame for visual updates
 * - Drift correction for long sessions
 * - Latency compensation
 */

import { ref, computed, watch, type Ref } from 'vue'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SyncState {
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  latencyOffset: number
}

export interface SyncListener {
  id: string
  onTimeUpdate: (time: number) => void
  priority?: number
}

export interface SyncConfig {
  targetFPS?: number
  driftThreshold?: number
  latencyCompensation?: number
}

// ─── Sync Manager Class ──────────────────────────────────────────────────────

export class SyncManager {
  private audioContext: AudioContext | null = null
  private startContextTime: number = 0
  private startPlaybackTime: number = 0
  private pauseTime: number = 0
  private _isPlaying: boolean = false
  private _duration: number = 60
  private _playbackRate: number = 1
  private _latencyOffset: number = 0

  private animationFrame: number | null = null
  private lastFrameTime: number = 0
  private targetFrameInterval: number = 1000 / 60

  private listeners: Map<string, SyncListener> = new Map()
  private driftThreshold: number = 0.05  // 50ms drift tolerance

  constructor(config: SyncConfig = {}) {
    this.targetFrameInterval = 1000 / (config.targetFPS ?? 60)
    this.driftThreshold = config.driftThreshold ?? 0.05
    this._latencyOffset = config.latencyCompensation ?? 0
  }

  // ─── Initialization ────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.audioContext) return

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      // Resume context if suspended (needed for autoplay policies)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      console.log('[SyncManager] AudioContext initialized, sample rate:', this.audioContext.sampleRate)
    } catch (error) {
      console.error('[SyncManager] Failed to initialize AudioContext:', error)
      throw error
    }
  }

  // ─── Playback Control ──────────────────────────────────────────────────────

  get isPlaying(): boolean {
    return this._isPlaying
  }

  get currentTime(): number {
    if (!this._isPlaying) {
      return this.pauseTime
    }

    if (!this.audioContext) {
      return this.pauseTime
    }

    // Calculate current time from AudioContext
    const elapsed = (this.audioContext.currentTime - this.startContextTime) * this._playbackRate
    return Math.min(this.startPlaybackTime + elapsed, this._duration)
  }

  get duration(): number {
    return this._duration
  }

  set duration(value: number) {
    this._duration = Math.max(0, value)
  }

  get playbackRate(): number {
    return this._playbackRate
  }

  set playbackRate(value: number) {
    // If playing, adjust start times to maintain position
    if (this._isPlaying) {
      const currentPos = this.currentTime
      this._playbackRate = Math.max(0.1, Math.min(4, value))
      this.startPlaybackTime = currentPos
      this.startContextTime = this.audioContext?.currentTime ?? 0
    } else {
      this._playbackRate = Math.max(0.1, Math.min(4, value))
    }
  }

  async play(fromTime?: number): Promise<void> {
    if (!this.audioContext) {
      await this.initialize()
    }

    if (!this.audioContext) {
      console.error('[SyncManager] Cannot play: AudioContext not available')
      return
    }

    // Resume context if needed
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    this.startPlaybackTime = fromTime ?? this.pauseTime
    this.startContextTime = this.audioContext.currentTime
    this._isPlaying = true

    this.startSyncLoop()

    console.log('[SyncManager] Playing from', this.startPlaybackTime.toFixed(3), 's')
  }

  pause(): void {
    if (!this._isPlaying) return

    this.pauseTime = this.currentTime
    this._isPlaying = false

    this.stopSyncLoop()

    console.log('[SyncManager] Paused at', this.pauseTime.toFixed(3), 's')
  }

  stop(): void {
    this._isPlaying = false
    this.pauseTime = 0
    this.startPlaybackTime = 0

    this.stopSyncLoop()
    this.notifyListeners(0)

    console.log('[SyncManager] Stopped')
  }

  seek(time: number): void {
    const clampedTime = Math.max(0, Math.min(time, this._duration))

    if (this._isPlaying) {
      // Update start times to maintain playback from new position
      this.startPlaybackTime = clampedTime
      this.startContextTime = this.audioContext?.currentTime ?? 0
    } else {
      this.pauseTime = clampedTime
    }

    this.notifyListeners(clampedTime)
  }

  // ─── Sync Loop ─────────────────────────────────────────────────────────────

  private startSyncLoop(): void {
    if (this.animationFrame !== null) return

    this.lastFrameTime = performance.now()
    this.animationFrame = requestAnimationFrame((timestamp) => this.syncLoop(timestamp))
  }

  private stopSyncLoop(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  private syncLoop(timestamp: number): void {
    if (!this._isPlaying) {
      this.animationFrame = null
      return
    }

    // Frame rate limiting
    const elapsed = timestamp - this.lastFrameTime

    if (elapsed >= this.targetFrameInterval * 0.9) {
      this.lastFrameTime = timestamp

      const time = this.currentTime

      // Check if we've reached the end
      if (time >= this._duration) {
        this.pause()
        this.notifyListeners(this._duration)
        return
      }

      // Notify all listeners
      this.notifyListeners(time)
    }

    // Schedule next frame
    this.animationFrame = requestAnimationFrame((ts) => this.syncLoop(ts))
  }

  // ─── Listener Management ───────────────────────────────────────────────────

  addListener(listener: SyncListener): void {
    this.listeners.set(listener.id, listener)
  }

  removeListener(id: string): void {
    this.listeners.delete(id)
  }

  private notifyListeners(time: number): void {
    // Sort by priority (lower = earlier)
    const sorted = Array.from(this.listeners.values())
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

    for (const listener of sorted) {
      try {
        listener.onTimeUpdate(time + this._latencyOffset)
      } catch (error) {
        console.error(`[SyncManager] Listener ${listener.id} error:`, error)
      }
    }
  }

  // ─── Latency Compensation ──────────────────────────────────────────────────

  get latencyOffset(): number {
    return this._latencyOffset
  }

  set latencyOffset(value: number) {
    this._latencyOffset = value
  }

  // ─── Drift Detection ───────────────────────────────────────────────────────

  checkDrift(externalTime: number): number {
    const internalTime = this.currentTime
    const drift = Math.abs(internalTime - externalTime)

    if (drift > this.driftThreshold) {
      console.warn(`[SyncManager] Drift detected: ${(drift * 1000).toFixed(1)}ms`)
    }

    return drift
  }

  correctDrift(targetTime: number): void {
    if (!this._isPlaying) return

    // Smoothly correct drift by adjusting start times
    this.startPlaybackTime = targetTime
    this.startContextTime = this.audioContext?.currentTime ?? 0
  }

  // ─── State ─────────────────────────────────────────────────────────────────

  getState(): SyncState {
    return {
      isPlaying: this._isPlaying,
      currentTime: this.currentTime,
      duration: this._duration,
      playbackRate: this._playbackRate,
      latencyOffset: this._latencyOffset,
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  dispose(): void {
    this.stop()
    this.listeners.clear()

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}

// ─── Singleton Instance ──────────────────────────────────────────────────────

let globalSyncManager: SyncManager | null = null

export function getSyncManager(config?: SyncConfig): SyncManager {
  if (!globalSyncManager) {
    globalSyncManager = new SyncManager(config)
  }
  return globalSyncManager
}

// ─── Vue Composable ──────────────────────────────────────────────────────────

export function useSyncManager() {
  const manager = getSyncManager()

  const isPlaying = ref(manager.isPlaying)
  const currentTime = ref(manager.currentTime)
  const duration = ref(manager.duration)
  const playbackRate = ref(manager.playbackRate)

  // Sync state with manager
  const listenerId = `composable-${Date.now()}`

  manager.addListener({
    id: listenerId,
    onTimeUpdate: (time) => {
      currentTime.value = time
    },
    priority: -1,  // High priority
  })

  // Watch for external changes
  watch(isPlaying, (newValue) => {
    if (newValue !== manager.isPlaying) {
      if (newValue) {
        manager.play()
      } else {
        manager.pause()
      }
    }
  })

  // Play/pause functions
  async function play(fromTime?: number): Promise<void> {
    await manager.play(fromTime)
    isPlaying.value = true
  }

  function pause(): void {
    manager.pause()
    isPlaying.value = false
  }

  function stop(): void {
    manager.stop()
    isPlaying.value = false
    currentTime.value = 0
  }

  function seek(time: number): void {
    manager.seek(time)
    currentTime.value = manager.currentTime
  }

  function setDuration(value: number): void {
    manager.duration = value
    duration.value = value
  }

  function setPlaybackRate(rate: number): void {
    manager.playbackRate = rate
    playbackRate.value = manager.playbackRate
  }

  // Cleanup on unmount is handled by Vue's reactivity

  return {
    // State
    isPlaying,
    currentTime,
    duration,
    playbackRate,

    // Methods
    play,
    pause,
    stop,
    seek,
    setDuration,
    setPlaybackRate,

    // Direct manager access
    manager,
  }
}

// ─── Integration Helper ──────────────────────────────────────────────────────

/**
 * Create a bridge between SyncManager and timeline stores.
 * This ensures all timeline-related stores stay in sync.
 */
export function createTimelineSyncBridge(
  syncManager: SyncManager,
  timelineStore: any,
  sequencerStore: any
): () => void {
  const listenerId = `timeline-bridge-${Date.now()}`

  syncManager.addListener({
    id: listenerId,
    onTimeUpdate: (time) => {
      // Update timeline store (this is the source of truth for currentTime)
      // Note: Timeline store's currentTime is a computed from sequencer,
      // so we update the sequencer which propagates to timeline
      sequencerStore.setPosition(time)
    },
    priority: 0,
  })

  // Return cleanup function
  return () => {
    syncManager.removeListener(listenerId)
  }
}
