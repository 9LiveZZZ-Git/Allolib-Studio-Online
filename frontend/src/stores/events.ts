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
  properties?: Record<string, any>
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
  value: any
}

export interface EmitEvent extends BaseEvent {
  type: 'emit'
  eventName: string
  data?: any
}

export interface ScriptEvent extends BaseEvent {
  type: 'script'
  code: string
  context?: Record<string, any>
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

// ─── Easing Types ────────────────────────────────────────────────────────────

export type EasingType =
  | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'easeOutBack' | 'bounce' | 'elastic' | 'step' | 'bezier'

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
  const listeners = ref<Map<string, Array<(data: any) => void>>>(new Map())

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

  function on(eventName: string, callback: (data: any) => void): void {
    if (!listeners.value.has(eventName)) {
      listeners.value.set(eventName, [])
    }
    listeners.value.get(eventName)!.push(callback)
  }

  function off(eventName: string, callback: (data: any) => void): void {
    const list = listeners.value.get(eventName)
    if (list) {
      const index = list.indexOf(callback)
      if (index !== -1) {
        list.splice(index, 1)
      }
    }
  }

  function emit(eventName: string, data?: any): void {
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

function applyEasing(t: number, easing: EasingType, bezierPoints?: [number, number, number, number]): number {
  switch (easing) {
    case 'linear': return t
    case 'easeIn': return t * t
    case 'easeOut': return 1 - (1 - t) * (1 - t)
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    case 'easeOutBack': {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    }
    case 'bounce': {
      const n1 = 7.5625, d1 = 2.75
      if (t < 1 / d1) return n1 * t * t
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
      return n1 * (t -= 2.625 / d1) * t + 0.984375
    }
    case 'elastic': {
      const c4 = (2 * Math.PI) / 3
      return t === 0 ? 0 : t === 1 ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
    }
    case 'step': return t < 1 ? 0 : 1
    case 'bezier': {
      if (bezierPoints) {
        return bezierEase(t, bezierPoints)
      }
      return t
    }
    default: return t
  }
}

function bezierEase(t: number, points: [number, number, number, number]): number {
  const [x1, y1, x2, y2] = points
  let guessT = t
  for (let i = 0; i < 8; i++) {
    const currentX = cubicBezier(guessT, 0, x1, x2, 1)
    const slope = cubicBezierDerivative(guessT, 0, x1, x2, 1)
    if (Math.abs(slope) < 1e-6) break
    guessT -= (currentX - t) / slope
  }
  return cubicBezier(guessT, 0, y1, y2, 1)
}

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
}

function cubicBezierDerivative(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t
  return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2)
}

// Register on window for terminal access
if (typeof window !== 'undefined') {
  ;(window as any).__eventsStore = null
}

export function registerEventsStoreForTerminal(): void {
  const store = useEventsStore()
  ;(window as any).__eventsStore = store
}
