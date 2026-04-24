/**
 * Events Store
 *
 * Manages timed events for the timeline:
 * - Camera keyframes and modes (orbit, follow, cinematic, shake)
 * - Markers for navigation
 * - Script events for custom logic
 * - Spawn/destroy object triggers
 *
 * Events are organized into tracks for timeline display.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { type EasingType, applyEasing } from '@/composables/useKeyframes'

// Re-export so consumers that import EasingType from this module continue to work
export type { EasingType }

// ─── Event Types ─────────────────────────────────────────────────────────────

export type EventType = 'camera' | 'marker' | 'spawn' | 'destroy' | 'set' | 'emit' | 'script'

export type CameraMode = 'free' | 'orbit' | 'follow' | 'cinematic' | 'shake'

export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  mode: CameraMode
  // Mode-specific settings
  orbitRadius?: number
  orbitSpeed?: number
  followTarget?: string  // Object ID to follow
  followOffset?: [number, number, number]
  shakeIntensity?: number
  shakeDuration?: number
}

export interface BaseEvent {
  id: string
  type: EventType
  time: number
  duration?: number  // For events with duration (scripts, camera transitions)
  name?: string
  enabled: boolean
}

export interface CameraEvent extends BaseEvent {
  type: 'camera'
  state: CameraState
  easing: EasingType
  bezierPoints?: [number, number, number, number]
}

export interface MarkerEvent extends BaseEvent {
  type: 'marker'
  color: string
  label: string
}

export interface SpawnEvent extends BaseEvent {
  type: 'spawn'
  objectId: string
  objectType: string
  position?: [number, number, number]
  properties?: Record<string, number | number[] | boolean | string>
}

export interface DestroyEvent extends BaseEvent {
  type: 'destroy'
  objectId: string
}

export interface SetEvent extends BaseEvent {
  type: 'set'
  target: 'object' | 'environment' | 'audio'
  targetId?: string
  property: string
  value: number | number[] | boolean | string
}

export interface EmitEvent extends BaseEvent {
  type: 'emit'
  eventName: string
  data?: unknown
}

export interface ScriptEvent extends BaseEvent {
  type: 'script'
  code: string
  context?: Record<string, unknown>
}

export type TimelineEvent = CameraEvent | MarkerEvent | SpawnEvent | DestroyEvent | SetEvent | EmitEvent | ScriptEvent

// ─── Event Track Types ───────────────────────────────────────────────────────

export type TrackType = 'camera' | 'marker' | 'script' | 'action'

export interface EventTrack {
  id: string
  name: string
  type: TrackType
  color: string
  visible: boolean
  locked: boolean
  events: TimelineEvent[]
}

// ─── Store Definition ────────────────────────────────────────────────────────

export const useEventsStore = defineStore('events', () => {
  // ─── State ─────────────────────────────────────────────────────────────────

  const tracks = ref<EventTrack[]>([])
  const selectedEventId = ref<string | null>(null)
  const selectedTrackId = ref<string | null>(null)

  // Camera state
  const currentCameraState = ref<CameraState>({
    position: [0, 0, 5],
    target: [0, 0, 0],
    fov: 60,
    mode: 'free',
  })

  // Custom event listeners (for non-linear events)
  const listeners = ref<Map<string, Array<(data: unknown) => void>>>(new Map())

  // ─── Computed ──────────────────────────────────────────────────────────────

  const allEvents = computed(() => {
    const events: TimelineEvent[] = []
    for (const track of tracks.value) {
      events.push(...track.events)
    }
    return events.sort((a, b) => a.time - b.time)
  })

  const cameraTrack = computed(() =>
    tracks.value.find(t => t.type === 'camera')
  )

  const markerTrack = computed(() =>
    tracks.value.find(t => t.type === 'marker')
  )

  const markers = computed(() =>
    allEvents.value.filter(e => e.type === 'marker') as MarkerEvent[]
  )

  const selectedEvent = computed(() => {
    if (!selectedEventId.value) return null
    return allEvents.value.find(e => e.id === selectedEventId.value) || null
  })

  const selectedTrack = computed(() => {
    if (!selectedTrackId.value) return null
    return tracks.value.find(t => t.id === selectedTrackId.value) || null
  })

  // ─── Track Management ──────────────────────────────────────────────────────

  function addTrack(type: TrackType, name?: string): EventTrack {
    const colors: Record<TrackType, string> = {
      camera: '#F6AD55',
      marker: '#68D391',
      script: '#9F7AEA',
      action: '#63B3ED',
    }

    const track: EventTrack = {
      id: `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} Track`,
      type,
      color: colors[type],
      visible: true,
      locked: false,
      events: [],
    }

    tracks.value.push(track)
    return track
  }

  function removeTrack(trackId: string): boolean {
    const index = tracks.value.findIndex(t => t.id === trackId)
    if (index === -1) return false

    tracks.value.splice(index, 1)
    if (selectedTrackId.value === trackId) {
      selectedTrackId.value = null
    }
    return true
  }

  function getTrack(trackId: string): EventTrack | undefined {
    return tracks.value.find(t => t.id === trackId)
  }

  function ensureCameraTrack(): EventTrack {
    let track = cameraTrack.value
    if (!track) {
      track = addTrack('camera', 'Camera')
    }
    return track
  }

  function ensureMarkerTrack(): EventTrack {
    let track = markerTrack.value
    if (!track) {
      track = addTrack('marker', 'Markers')
    }
    return track
  }

  // ─── Event Management ──────────────────────────────────────────────────────

  function addEvent(trackId: string, event: Omit<TimelineEvent, 'id'>): TimelineEvent | null {
    const track = getTrack(trackId)
    if (!track) return null

    const newEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    } as TimelineEvent

    track.events.push(newEvent)
    track.events.sort((a, b) => a.time - b.time)

    return newEvent
  }

  function removeEvent(eventId: string): boolean {
    for (const track of tracks.value) {
      const index = track.events.findIndex(e => e.id === eventId)
      if (index !== -1) {
        track.events.splice(index, 1)
        if (selectedEventId.value === eventId) {
          selectedEventId.value = null
        }
        return true
      }
    }
    return false
  }

  function updateEvent(eventId: string, updates: Partial<TimelineEvent>): boolean {
    for (const track of tracks.value) {
      const event = track.events.find(e => e.id === eventId)
      if (event) {
        Object.assign(event, updates)
        // Re-sort if time changed
        if ('time' in updates) {
          track.events.sort((a, b) => a.time - b.time)
        }
        return true
      }
    }
    return false
  }

  function getEvent(eventId: string): TimelineEvent | undefined {
    return allEvents.value.find(e => e.id === eventId)
  }

  function selectEvent(eventId: string | null): void {
    selectedEventId.value = eventId
  }

  function selectTrack(trackId: string | null): void {
    selectedTrackId.value = trackId
  }

  // ─── Camera Helpers ────────────────────────────────────────────────────────

  function addCameraKeyframe(time: number, state: Partial<CameraState>, easing: EasingType = 'easeInOut'): CameraEvent | null {
    const track = ensureCameraTrack()

    const fullState: CameraState = {
      position: state.position ?? currentCameraState.value.position,
      target: state.target ?? currentCameraState.value.target,
      fov: state.fov ?? currentCameraState.value.fov,
      mode: state.mode ?? currentCameraState.value.mode,
      ...state,
    }

    return addEvent(track.id, {
      type: 'camera',
      time,
      state: fullState,
      easing,
      enabled: true,
    }) as CameraEvent | null
  }

  function getCameraStateAtTime(time: number): CameraState {
    const track = cameraTrack.value
    if (!track || track.events.length === 0) {
      return currentCameraState.value
    }

    const cameraEvents = track.events.filter(e => e.type === 'camera') as CameraEvent[]
    if (cameraEvents.length === 0) {
      return currentCameraState.value
    }

    // Find surrounding keyframes
    if (time <= cameraEvents[0].time) {
      return cameraEvents[0].state
    }
    if (time >= cameraEvents[cameraEvents.length - 1].time) {
      return cameraEvents[cameraEvents.length - 1].state
    }

    let i = 0
    while (i < cameraEvents.length - 1 && cameraEvents[i + 1].time < time) {
      i++
    }

    const kf1 = cameraEvents[i]
    const kf2 = cameraEvents[i + 1]
    const t = (time - kf1.time) / (kf2.time - kf1.time)
    const easedT = applyEasing(t, kf1.easing, kf1.bezierPoints)

    return interpolateCameraState(kf1.state, kf2.state, easedT)
  }

  function interpolateCameraState(a: CameraState, b: CameraState, t: number): CameraState {
    return {
      position: lerpVec3(a.position, b.position, t),
      target: lerpVec3(a.target, b.target, t),
      fov: lerp(a.fov, b.fov, t),
      mode: t < 0.5 ? a.mode : b.mode,  // Discrete switch at midpoint
      orbitRadius: lerpOptional(a.orbitRadius, b.orbitRadius, t),
      orbitSpeed: lerpOptional(a.orbitSpeed, b.orbitSpeed, t),
      shakeIntensity: lerpOptional(a.shakeIntensity, b.shakeIntensity, t),
    }
  }

  // ─── Marker Helpers ────────────────────────────────────────────────────────

  function addMarker(time: number, label: string, color: string = '#68D391'): MarkerEvent | null {
    const track = ensureMarkerTrack()

    return addEvent(track.id, {
      type: 'marker',
      time,
      label,
      color,
      enabled: true,
    }) as MarkerEvent | null
  }

  function getNextMarker(fromTime: number): MarkerEvent | null {
    const future = markers.value.filter(m => m.time > fromTime)
    return future.length > 0 ? future[0] : null
  }

  function getPreviousMarker(fromTime: number): MarkerEvent | null {
    const past = markers.value.filter(m => m.time < fromTime)
    return past.length > 0 ? past[past.length - 1] : null
  }

  // ─── Script Helpers ────────────────────────────────────────────────────────

  function addScriptEvent(trackId: string, time: number, code: string, duration: number = 0): ScriptEvent | null {
    return addEvent(trackId, {
      type: 'script',
      time,
      duration,
      code,
      enabled: true,
    }) as ScriptEvent | null
  }

  // ─── Event Execution ───────────────────────────────────────────────────────

  function getEventsInRange(startTime: number, endTime: number): TimelineEvent[] {
    return allEvents.value.filter(e => e.enabled && e.time >= startTime && e.time <= endTime)
  }

  function getEventsAtTime(time: number, tolerance: number = 0.001): TimelineEvent[] {
    return allEvents.value.filter(e => e.enabled && Math.abs(e.time - time) <= tolerance)
  }

  // ─── Custom Event System ───────────────────────────────────────────────────

  function on(eventName: string, callback: (data: unknown) => void): void {
    if (!listeners.value.has(eventName)) {
      listeners.value.set(eventName, [])
    }
    listeners.value.get(eventName)!.push(callback)
  }

  function off(eventName: string, callback: (data: unknown) => void): void {
    const list = listeners.value.get(eventName)
    if (list) {
      const index = list.indexOf(callback)
      if (index !== -1) {
        list.splice(index, 1)
      }
    }
  }

  function emit(eventName: string, data?: unknown): void {
    const list = listeners.value.get(eventName)
    if (list) {
      for (const callback of list) {
        try {
          callback(data)
        } catch (error) {
          console.error(`[EventsStore] Error in listener for '${eventName}':`, error)
        }
      }
    }
  }

  // ─── Serialization ─────────────────────────────────────────────────────────

  function toJSON() {
    return {
      tracks: tracks.value.map(track => ({
        ...track,
        events: track.events.map(e => ({ ...e })),
      })),
      currentCameraState: { ...currentCameraState.value },
    }
  }

  function fromJSON(data: ReturnType<typeof toJSON>): void {
    tracks.value = data.tracks || []
    if (data.currentCameraState) {
      currentCameraState.value = data.currentCameraState
    }
  }

  function reset(): void {
    tracks.value = []
    selectedEventId.value = null
    selectedTrackId.value = null
    currentCameraState.value = {
      position: [0, 0, 5],
      target: [0, 0, 0],
      fov: 60,
      mode: 'free',
    }
    listeners.value.clear()
  }

  // ─── Initialize default tracks ─────────────────────────────────────────────

  function initDefaults(): void {
    if (tracks.value.length === 0) {
      addTrack('camera', 'Camera')
      addTrack('marker', 'Markers')
    }
  }

  return {
    // State
    tracks,
    selectedEventId,
    selectedTrackId,
    currentCameraState,

    // Computed
    allEvents,
    cameraTrack,
    markerTrack,
    markers,
    selectedEvent,
    selectedTrack,

    // Track management
    addTrack,
    removeTrack,
    getTrack,
    ensureCameraTrack,
    ensureMarkerTrack,

    // Event management
    addEvent,
    removeEvent,
    updateEvent,
    getEvent,
    selectEvent,
    selectTrack,

    // Camera
    addCameraKeyframe,
    getCameraStateAtTime,

    // Markers
    addMarker,
    getNextMarker,
    getPreviousMarker,

    // Scripts
    addScriptEvent,

    // Execution
    getEventsInRange,
    getEventsAtTime,

    // Custom events
    on,
    off,
    emit,

    // Serialization
    toJSON,
    fromJSON,
    reset,
    initDefaults,
  }
})

// ─── Utility Functions ───────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpVec3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

function lerpOptional(a: number | undefined, b: number | undefined, t: number): number | undefined {
  if (a === undefined || b === undefined) return undefined
  return lerp(a, b, t)
}

// applyEasing is imported from @/composables/useKeyframes

// Register on window for terminal access
if (typeof window !== 'undefined') {
  (window as any).__eventsStore = null
}

export function registerEventsStoreForTerminal(): void {
  const store = useEventsStore()
  ;(window as any).__eventsStore = store
}
