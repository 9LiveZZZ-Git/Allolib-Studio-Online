/**
 * Timeline Clipboard Service
 *
 * Handles copy/paste operations for timeline data:
 * - Keyframes (objects, environment)
 * - Events (camera, markers, scripts)
 * - Audio notes/clips
 */

import { useObjectsStore } from '@/stores/objects'
import { useEnvironmentStore } from '@/stores/environment'
import { useEventsStore, type TimelineEvent, type CameraKeyframe } from '@/stores/events'
import { useSequencerStore, type SequencerNote, type ClipInstance } from '@/stores/sequencer'
import { useTimelineStore } from '@/stores/timeline'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClipboardDataType = 'keyframes' | 'events' | 'notes' | 'clips'

export interface ClipboardKeyframe {
  time: number
  value: any
  easing: string
  bezierPoints?: [number, number, number, number]
}

export interface ClipboardKeyframeSet {
  type: 'keyframes'
  source: 'objects' | 'environment'
  objectId?: string      // For object keyframes
  property: string       // Property name (e.g., 'position', 'backgroundColor')
  keyframes: ClipboardKeyframe[]
  referenceTime: number  // Earliest keyframe time (for relative paste)
}

export interface ClipboardEvent {
  type: TimelineEvent['type']
  time: number
  duration?: number
  data: any
}

export interface ClipboardEventSet {
  type: 'events'
  trackType: 'camera' | 'marker' | 'script'
  events: ClipboardEvent[]
  referenceTime: number
}

export interface ClipboardNote {
  startTime: number
  duration: number
  frequency: number
  amplitude: number
  synthName: string
  params: number[]
  paramNames: string[]
}

export interface ClipboardNoteSet {
  type: 'notes'
  notes: ClipboardNote[]
  referenceTime: number
}

export interface ClipboardClipSet {
  type: 'clips'
  clips: Array<{
    clipId: string
    startTime: number
    trackIndex: number
  }>
  referenceTime: number
}

export type ClipboardData =
  | ClipboardKeyframeSet
  | ClipboardEventSet
  | ClipboardNoteSet
  | ClipboardClipSet

// ─── Clipboard State ──────────────────────────────────────────────────────────

let clipboard: ClipboardData | null = null

// ─── Copy Functions ───────────────────────────────────────────────────────────

/**
 * Copy selected object keyframes to clipboard
 */
export function copyObjectKeyframes(objectId: string, property: string, times: number[]): void {
  const objectsStore = useObjectsStore()

  const object = objectsStore.objects.get(objectId)
  if (!object) return

  const curve = objectsStore.getKeyframeCurve(objectId, property)
  if (!curve) return

  const selectedKeyframes = curve.keyframes.filter(kf => times.includes(kf.time))
  if (selectedKeyframes.length === 0) return

  const referenceTime = Math.min(...selectedKeyframes.map(kf => kf.time))

  clipboard = {
    type: 'keyframes',
    source: 'objects',
    objectId,
    property,
    keyframes: selectedKeyframes.map(kf => ({
      time: kf.time - referenceTime, // Store relative time
      value: JSON.parse(JSON.stringify(kf.value)),
      easing: kf.easing,
      bezierPoints: kf.bezierPoints,
    })),
    referenceTime,
  }

  console.log(`[Clipboard] Copied ${selectedKeyframes.length} object keyframes`)
}

/**
 * Copy selected environment keyframes to clipboard
 */
export function copyEnvironmentKeyframes(property: string, times: number[]): void {
  const environmentStore = useEnvironmentStore()

  const curve = environmentStore.keyframeCurves.get(property)
  if (!curve) return

  const selectedKeyframes = curve.keyframes.filter(kf => times.includes(kf.time))
  if (selectedKeyframes.length === 0) return

  const referenceTime = Math.min(...selectedKeyframes.map(kf => kf.time))

  clipboard = {
    type: 'keyframes',
    source: 'environment',
    property,
    keyframes: selectedKeyframes.map(kf => ({
      time: kf.time - referenceTime,
      value: JSON.parse(JSON.stringify(kf.value)),
      easing: kf.easing,
      bezierPoints: kf.bezierPoints,
    })),
    referenceTime,
  }

  console.log(`[Clipboard] Copied ${selectedKeyframes.length} environment keyframes`)
}

/**
 * Copy events to clipboard
 */
export function copyEvents(trackType: 'camera' | 'marker' | 'script', events: TimelineEvent[]): void {
  if (events.length === 0) return

  const referenceTime = Math.min(...events.map(e => e.time))

  clipboard = {
    type: 'events',
    trackType,
    events: events.map(e => ({
      type: e.type,
      time: e.time - referenceTime,
      duration: e.duration,
      data: JSON.parse(JSON.stringify(e.data)),
    })),
    referenceTime,
  }

  console.log(`[Clipboard] Copied ${events.length} events`)
}

/**
 * Copy selected sequencer notes to clipboard
 */
export function copyNotes(notes: SequencerNote[]): void {
  if (notes.length === 0) return

  const referenceTime = Math.min(...notes.map(n => n.startTime))

  clipboard = {
    type: 'notes',
    notes: notes.map(n => ({
      startTime: n.startTime - referenceTime,
      duration: n.duration,
      frequency: n.frequency,
      amplitude: n.amplitude,
      synthName: n.synthName,
      params: [...n.params],
      paramNames: [...n.paramNames],
    })),
    referenceTime,
  }

  console.log(`[Clipboard] Copied ${notes.length} notes`)
}

/**
 * Copy selected clip instances to clipboard
 */
export function copyClipInstances(instances: ClipInstance[]): void {
  if (instances.length === 0) return

  const referenceTime = Math.min(...instances.map(ci => ci.startTime))

  clipboard = {
    type: 'clips',
    clips: instances.map(ci => ({
      clipId: ci.clipId,
      startTime: ci.startTime - referenceTime,
      trackIndex: ci.trackIndex,
    })),
    referenceTime,
  }

  console.log(`[Clipboard] Copied ${instances.length} clip instances`)
}

// ─── Paste Functions ──────────────────────────────────────────────────────────

/**
 * Paste clipboard contents at the given time
 */
export function paste(pasteTime?: number): boolean {
  if (!clipboard) {
    console.log('[Clipboard] Nothing to paste')
    return false
  }

  const timeline = useTimelineStore()
  const targetTime = pasteTime ?? timeline.currentTime

  switch (clipboard.type) {
    case 'keyframes':
      return pasteKeyframes(clipboard, targetTime)
    case 'events':
      return pasteEvents(clipboard, targetTime)
    case 'notes':
      return pasteNotes(clipboard, targetTime)
    case 'clips':
      return pasteClipInstances(clipboard, targetTime)
    default:
      return false
  }
}

function pasteKeyframes(data: ClipboardKeyframeSet, targetTime: number): boolean {
  if (data.source === 'objects') {
    const objectsStore = useObjectsStore()

    // If we have an objectId, paste to the same object
    // Otherwise, we could potentially paste to a selected object
    if (!data.objectId) return false

    for (const kf of data.keyframes) {
      objectsStore.addKeyframe(
        data.objectId,
        data.property,
        targetTime + kf.time,
        kf.value,
        kf.easing as any,
        kf.bezierPoints
      )
    }

    console.log(`[Clipboard] Pasted ${data.keyframes.length} keyframes to object ${data.objectId}`)
    return true
  } else if (data.source === 'environment') {
    const environmentStore = useEnvironmentStore()

    for (const kf of data.keyframes) {
      environmentStore.addKeyframe(
        data.property,
        targetTime + kf.time,
        kf.value,
        kf.easing as any,
        kf.bezierPoints
      )
    }

    console.log(`[Clipboard] Pasted ${data.keyframes.length} keyframes to environment`)
    return true
  }

  return false
}

function pasteEvents(data: ClipboardEventSet, targetTime: number): boolean {
  const eventsStore = useEventsStore()

  for (const event of data.events) {
    const time = targetTime + event.time

    switch (data.trackType) {
      case 'camera':
        if (event.data.cameraState) {
          eventsStore.addCameraKeyframe(time, event.data.cameraState)
        }
        break
      case 'marker':
        eventsStore.addMarker(time, event.data.label || 'Marker')
        break
      case 'script':
        // Find the script track
        const scriptTrack = eventsStore.tracks.find(t => t.type === 'script')
        if (scriptTrack) {
          eventsStore.addScriptEvent(scriptTrack.id, time, event.data.code || '')
        }
        break
    }
  }

  console.log(`[Clipboard] Pasted ${data.events.length} events`)
  return true
}

function pasteNotes(data: ClipboardNoteSet, targetTime: number): boolean {
  const sequencer = useSequencerStore()

  if (!sequencer.activeClipId) {
    console.log('[Clipboard] No active clip to paste into')
    return false
  }

  sequencer.pushUndo()
  sequencer.deselectAllNotes()

  for (const note of data.notes) {
    const newNote = sequencer.addNote(
      note.synthName,
      targetTime + note.startTime,
      note.duration,
      note.frequency,
      note.amplitude,
      note.params,
      note.paramNames
    )
    if (newNote) {
      newNote.selected = true
    }
  }

  console.log(`[Clipboard] Pasted ${data.notes.length} notes`)
  return true
}

function pasteClipInstances(data: ClipboardClipSet, targetTime: number): boolean {
  const sequencer = useSequencerStore()

  sequencer.pushUndo()
  sequencer.deselectAllClipInstances()

  for (const clip of data.clips) {
    const inst = sequencer.addClipInstance(
      clip.clipId,
      clip.trackIndex,
      targetTime + clip.startTime
    )
    sequencer.selectClipInstance(inst.id, true)
  }

  console.log(`[Clipboard] Pasted ${data.clips.length} clip instances`)
  return true
}

// ─── Cut Function ─────────────────────────────────────────────────────────────

/**
 * Cut - copy then delete the source items
 */
export function cutObjectKeyframes(objectId: string, property: string, times: number[]): void {
  copyObjectKeyframes(objectId, property, times)

  const objectsStore = useObjectsStore()
  for (const time of times) {
    objectsStore.removeKeyframe(objectId, property, time)
  }
}

export function cutEnvironmentKeyframes(property: string, times: number[]): void {
  copyEnvironmentKeyframes(property, times)

  const environmentStore = useEnvironmentStore()
  for (const time of times) {
    environmentStore.removeKeyframe(property, time)
  }
}

export function cutNotes(): void {
  const sequencer = useSequencerStore()
  const selectedNotes = sequencer.selectedNotes
  if (selectedNotes.length === 0) return

  copyNotes(selectedNotes)
  sequencer.deleteSelectedNotes()
}

export function cutClipInstances(): void {
  const sequencer = useSequencerStore()
  const selectedIds = Array.from(sequencer.selectedClipInstanceIds)
  const instances = sequencer.clipInstances.filter(ci => selectedIds.includes(ci.id))
  if (instances.length === 0) return

  copyClipInstances(instances)
  sequencer.deleteSelectedClipInstances()
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Check if clipboard has data
 */
export function hasClipboardData(): boolean {
  return clipboard !== null
}

/**
 * Get clipboard data type
 */
export function getClipboardType(): ClipboardDataType | null {
  return clipboard?.type ?? null
}

/**
 * Clear clipboard
 */
export function clearClipboard(): void {
  clipboard = null
}

/**
 * Get clipboard contents (for display purposes)
 */
export function getClipboardInfo(): string {
  if (!clipboard) return 'Empty'

  switch (clipboard.type) {
    case 'keyframes':
      return `${clipboard.keyframes.length} keyframe(s) - ${clipboard.property}`
    case 'events':
      return `${clipboard.events.length} event(s) - ${clipboard.trackType}`
    case 'notes':
      return `${clipboard.notes.length} note(s)`
    case 'clips':
      return `${clipboard.clips.length} clip(s)`
    default:
      return 'Unknown'
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const timelineClipboard = {
  copyObjectKeyframes,
  copyEnvironmentKeyframes,
  copyEvents,
  copyNotes,
  copyClipInstances,
  paste,
  cutObjectKeyframes,
  cutEnvironmentKeyframes,
  cutNotes,
  cutClipInstances,
  hasClipboardData,
  getClipboardType,
  clearClipboard,
  getClipboardInfo,
}
