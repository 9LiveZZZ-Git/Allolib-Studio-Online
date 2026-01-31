/**
 * Sequencer Playback Store
 *
 * Manages transport (play/pause/stop), BPM, loop,
 * snap mode, and voice scheduling.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AllolibRuntime } from '@/services/runtime'
import {
  type TransportState,
  type SnapMode,
  type TimeDisplay,
  type Viewport,
  type SequencerNote,
} from './types'
import { useSequencerClipsStore } from './clips'
import { useSequencerTracksStore } from './tracks'

export const useSequencerPlaybackStore = defineStore('sequencer-playback', () => {
  // ─── State ─────────────────────────────────────────────────────────────────

  const transport = ref<TransportState>('stopped')
  const playheadPosition = ref(0)          // current time in seconds
  const bpm = ref(120)
  const loopEnabled = ref(false)
  const loopStart = ref(0)
  const loopEnd = ref(8)
  const snapMode = ref<SnapMode>('quarter')
  const timeDisplay = ref<TimeDisplay>('seconds')

  // Viewport state
  const viewport = ref<Viewport>({
    scrollX: 0,
    scrollY: 0,
    zoomX: 100,   // 100 pixels per second
    zoomY: 80,    // 80 pixels per octave
    minFreq: 27.5,   // A0
    maxFreq: 4186,   // C8
  })

  // Clip editor viewport (separate from arrangement viewport)
  const clipViewport = ref<Viewport>({
    scrollX: 0,
    scrollY: 0,
    zoomX: 100,
    zoomY: 80,
    minFreq: 27.5,
    maxFreq: 4186,
  })

  // Transport animation
  let animFrameId: number | null = null
  let playStartWallTime = 0
  let playStartPosition = 0

  // WASM playback bridge
  let runtime: AllolibRuntime | null = null
  const triggeredNotes = new Set<string>()  // note IDs currently sounding
  let nextVoiceId = 1

  // ─── Computed ──────────────────────────────────────────────────────────────

  const isPlaying = computed(() => transport.value === 'playing')
  const isPaused = computed(() => transport.value === 'paused')
  const isStopped = computed(() => transport.value === 'stopped')

  const beatsPerSecond = computed(() => bpm.value / 60)
  const secondsPerBeat = computed(() => 60 / bpm.value)

  const playheadBeat = computed(() => playheadPosition.value * beatsPerSecond.value)

  // ─── Snap Functions ────────────────────────────────────────────────────────

  function getSnapInterval(): number {
    switch (snapMode.value) {
      case 'none': return 0
      case 'beat': return secondsPerBeat.value
      case 'half': return secondsPerBeat.value / 2
      case 'quarter': return secondsPerBeat.value / 4
      case 'eighth': return secondsPerBeat.value / 8
      case 'sixteenth': return secondsPerBeat.value / 16
      default: return 0
    }
  }

  function snapTime(t: number): number {
    const interval = getSnapInterval()
    if (interval <= 0) return t
    return Math.round(t / interval) * interval
  }

  function snapToGrid(t: number): number {
    return snapTime(t)
  }

  // ─── Runtime Connection ────────────────────────────────────────────────────

  function connectRuntime(rt: AllolibRuntime): void {
    runtime = rt
  }

  function disconnectRuntime(): void {
    releaseAllVoices()
    runtime = null
  }

  function releaseAllVoices(): void {
    if (!runtime) return
    for (const voiceId of triggeredNotes) {
      try {
        runtime.releaseVoice(Number(voiceId.split('_')[1]) || 0)
      } catch (e) {
        // Voice may already be released
      }
    }
    triggeredNotes.clear()
  }

  // ─── Transport Controls ────────────────────────────────────────────────────

  function play(): void {
    if (transport.value === 'playing') return

    transport.value = 'playing'
    playStartWallTime = performance.now()
    playStartPosition = playheadPosition.value

    animatePlayhead()
  }

  function pause(): void {
    if (transport.value !== 'playing') return

    transport.value = 'paused'
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
    releaseAllVoices()
  }

  function stop(): void {
    transport.value = 'stopped'
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
    releaseAllVoices()
    playheadPosition.value = loopEnabled.value ? loopStart.value : 0
  }

  function setPosition(time: number): void {
    playheadPosition.value = Math.max(0, time)
    if (transport.value === 'playing') {
      playStartWallTime = performance.now()
      playStartPosition = playheadPosition.value
    }
  }

  function seek(time: number): void {
    setPosition(time)
  }

  function toggleLoop(): void {
    loopEnabled.value = !loopEnabled.value
  }

  function setLoop(enabled: boolean): void {
    loopEnabled.value = enabled
  }

  function setLoopRange(start: number, end: number): void {
    loopStart.value = Math.max(0, start)
    loopEnd.value = Math.max(loopStart.value + 0.1, end)
  }

  function setBPM(value: number): void {
    bpm.value = Math.max(20, Math.min(999, value))
  }

  function setSnapMode(mode: SnapMode): void {
    snapMode.value = mode
  }

  function setTimeDisplay(display: TimeDisplay): void {
    timeDisplay.value = display
  }

  // ─── Playhead Animation ────────────────────────────────────────────────────

  function animatePlayhead(): void {
    if (transport.value !== 'playing') return

    const clipsStore = useSequencerClipsStore()
    const tracksStore = useSequencerTracksStore()

    const now = performance.now()
    const elapsed = (now - playStartWallTime) / 1000
    const prevTime = playheadPosition.value
    let currentTime = playStartPosition + elapsed

    // Handle loop
    if (loopEnabled.value && currentTime >= loopEnd.value) {
      currentTime = loopStart.value + (currentTime - loopEnd.value) % (loopEnd.value - loopStart.value)
      playStartWallTime = now
      playStartPosition = currentTime
      releaseAllVoices()
    }

    playheadPosition.value = currentTime

    // Schedule voices
    scheduleVoices(prevTime, currentTime, clipsStore, tracksStore)

    animFrameId = requestAnimationFrame(() => animatePlayhead())
  }

  function scheduleVoices(
    prevTime: number,
    currentTime: number,
    clipsStore: ReturnType<typeof useSequencerClipsStore>,
    tracksStore: ReturnType<typeof useSequencerTracksStore>
  ): void {
    if (!runtime) return

    // Get all notes that should trigger in this time window
    for (const instance of clipsStore.clipInstances) {
      const clip = clipsStore.getClip(instance.clipId)
      if (!clip) continue

      const track = tracksStore.getTrackByIndex(instance.trackIndex)
      if (!track || track.muted) continue

      // Check solo
      if (tracksStore.hasSoloTrack && !track.solo) continue

      for (const note of clip.notes) {
        if (note.muted) continue

        const absoluteStart = instance.startTime + note.startTime
        const absoluteEnd = absoluteStart + note.duration
        const noteKey = `${instance.id}_${note.id}`

        // Check if note should trigger
        if (absoluteStart >= prevTime && absoluteStart < currentTime) {
          if (!triggeredNotes.has(noteKey)) {
            try {
              const voiceId = nextVoiceId++
              runtime.triggerVoice(
                note.synthName,
                voiceId,
                note.frequency,
                note.amplitude,
                note.params
              )
              triggeredNotes.add(noteKey)

              // Schedule release
              const releaseDelay = (absoluteEnd - currentTime) * 1000
              if (releaseDelay > 0) {
                setTimeout(() => {
                  try {
                    runtime?.releaseVoice(voiceId)
                  } catch (e) {
                    // Voice may be gone
                  }
                  triggeredNotes.delete(noteKey)
                }, releaseDelay)
              }
            } catch (e) {
              console.error('[Playback] Failed to trigger voice:', e)
            }
          }
        }
      }
    }
  }

  // ─── Viewport Controls ─────────────────────────────────────────────────────

  function setViewportZoomX(zoom: number): void {
    viewport.value.zoomX = Math.max(10, Math.min(500, zoom))
  }

  function setViewportZoomY(zoom: number): void {
    viewport.value.zoomY = Math.max(20, Math.min(200, zoom))
  }

  function setViewportScroll(x: number, y: number): void {
    viewport.value.scrollX = Math.max(0, x)
    viewport.value.scrollY = y
  }

  function zoomIn(): void {
    viewport.value.zoomX = Math.min(500, viewport.value.zoomX * 1.25)
  }

  function zoomOut(): void {
    viewport.value.zoomX = Math.max(10, viewport.value.zoomX / 1.25)
  }

  // ─── Time Conversion ───────────────────────────────────────────────────────

  function timeToPixels(time: number): number {
    return (time - viewport.value.scrollX) * viewport.value.zoomX
  }

  function pixelsToTime(pixels: number): number {
    return pixels / viewport.value.zoomX + viewport.value.scrollX
  }

  function beatToTime(beat: number): number {
    return beat * secondsPerBeat.value
  }

  function timeToBeat(time: number): number {
    return time * beatsPerSecond.value
  }

  // ─── Dispose ───────────────────────────────────────────────────────────────

  function dispose(): void {
    stop()
    disconnectRuntime()
  }

  return {
    // State
    transport,
    playheadPosition,
    bpm,
    loopEnabled,
    loopStart,
    loopEnd,
    snapMode,
    timeDisplay,
    viewport,
    clipViewport,

    // Computed
    isPlaying,
    isPaused,
    isStopped,
    beatsPerSecond,
    secondsPerBeat,
    playheadBeat,

    // Snap
    getSnapInterval,
    snapTime,
    snapToGrid,

    // Runtime
    connectRuntime,
    disconnectRuntime,
    releaseAllVoices,

    // Transport
    play,
    pause,
    stop,
    setPosition,
    seek,
    toggleLoop,
    setLoop,
    setLoopRange,
    setBPM,
    setSnapMode,
    setTimeDisplay,

    // Viewport
    setViewportZoomX,
    setViewportZoomY,
    setViewportScroll,
    zoomIn,
    zoomOut,

    // Time conversion
    timeToPixels,
    pixelsToTime,
    beatToTime,
    timeToBeat,

    // Lifecycle
    dispose,
  }
})
