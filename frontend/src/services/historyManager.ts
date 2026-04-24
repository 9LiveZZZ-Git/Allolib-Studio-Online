/**
 * History Manager
 *
 * Unified undo/redo system for all timeline stores.
 * Captures snapshots of state and allows reverting changes.
 */

import { ref, computed } from 'vue'
import { useObjectsStore } from '@/stores/objects'
import { useEnvironmentStore } from '@/stores/environment'
import { useEventsStore } from '@/stores/events'
import { useSequencerStore } from '@/stores/sequencer'

// ─── Types ────────────────────────────────────────────────────────────────────

export type HistorySource = 'objects' | 'environment' | 'events' | 'sequencer' | 'all'

export interface HistoryEntry {
  id: string
  timestamp: number
  source: HistorySource
  description: string
  snapshot: unknown
}

// ─── State ────────────────────────────────────────────────────────────────────

const undoStack = ref<HistoryEntry[]>([])
const redoStack = ref<HistoryEntry[]>([])
const maxHistory = ref(50)
const isPerformingUndoRedo = ref(false)

// ─── Computed ─────────────────────────────────────────────────────────────────

export const canUndo = computed(() => undoStack.value.length > 0)
export const canRedo = computed(() => redoStack.value.length > 0)
export const undoDescription = computed(() =>
  undoStack.value.length > 0 ? undoStack.value[undoStack.value.length - 1].description : ''
)
export const redoDescription = computed(() =>
  redoStack.value.length > 0 ? redoStack.value[redoStack.value.length - 1].description : ''
)

// ─── Snapshot Functions ───────────────────────────────────────────────────────

function generateId(): string {
  return `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function captureObjectsSnapshot() {
  const objectsStore = useObjectsStore()
  return objectsStore.toJSON()
}

function captureEnvironmentSnapshot() {
  const environmentStore = useEnvironmentStore()
  return environmentStore.toJSON()
}

function captureEventsSnapshot() {
  const eventsStore = useEventsStore()
  return eventsStore.toJSON()
}

function captureSequencerSnapshot() {
  const sequencerStore = useSequencerStore()
  return {
    clips: JSON.parse(JSON.stringify(sequencerStore.clips)),
    clipInstances: JSON.parse(JSON.stringify(sequencerStore.clipInstances)),
    arrangementTracks: JSON.parse(JSON.stringify(sequencerStore.arrangementTracks)),
  }
}

function captureAllSnapshot() {
  return {
    objects: captureObjectsSnapshot(),
    environment: captureEnvironmentSnapshot(),
    events: captureEventsSnapshot(),
    sequencer: captureSequencerSnapshot(),
  }
}

type ObjectsSnapshot = Parameters<ReturnType<typeof useObjectsStore>['fromJSON']>[0]
type EnvironmentSnapshot = Parameters<ReturnType<typeof useEnvironmentStore>['fromJSON']>[0]
type EventsSnapshot = Parameters<ReturnType<typeof useEventsStore>['fromJSON']>[0]

function applyObjectsSnapshot(snapshot: unknown) {
  const objectsStore = useObjectsStore()
  objectsStore.fromJSON(snapshot as ObjectsSnapshot)
}

function applyEnvironmentSnapshot(snapshot: unknown) {
  const environmentStore = useEnvironmentStore()
  environmentStore.fromJSON(snapshot as EnvironmentSnapshot)
}

function applyEventsSnapshot(snapshot: unknown) {
  const eventsStore = useEventsStore()
  eventsStore.fromJSON(snapshot as EventsSnapshot)
}

interface SequencerSnapshot {
  clips?: unknown
  clipInstances?: unknown
  arrangementTracks?: unknown
}

function applySequencerSnapshot(snapshot: unknown) {
  const sequencerStore = useSequencerStore()
  const s = snapshot as SequencerSnapshot
  // The sequencer store doesn't have direct setters, so we need to do this carefully
  if (s.clips) {
    ;(sequencerStore as Record<string, unknown>).clips = s.clips
  }
  if (s.clipInstances) {
    ;(sequencerStore as Record<string, unknown>).clipInstances = s.clipInstances
  }
  if (s.arrangementTracks) {
    ;(sequencerStore as Record<string, unknown>).arrangementTracks = s.arrangementTracks
  }
}

interface AllSnapshot {
  objects?: unknown
  environment?: unknown
  events?: unknown
  sequencer?: unknown
}

function applyAllSnapshot(snapshot: unknown) {
  const s = snapshot as AllSnapshot
  if (s.objects) applyObjectsSnapshot(s.objects)
  if (s.environment) applyEnvironmentSnapshot(s.environment)
  if (s.events) applyEventsSnapshot(s.events)
  if (s.sequencer) applySequencerSnapshot(s.sequencer)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Push current state to undo stack before making changes
 */
export function pushUndo(source: HistorySource, description: string): void {
  if (isPerformingUndoRedo.value) return

  let snapshot: unknown
  switch (source) {
    case 'objects':
      snapshot = captureObjectsSnapshot()
      break
    case 'environment':
      snapshot = captureEnvironmentSnapshot()
      break
    case 'events':
      snapshot = captureEventsSnapshot()
      break
    case 'sequencer':
      snapshot = captureSequencerSnapshot()
      break
    case 'all':
      snapshot = captureAllSnapshot()
      break
  }

  const entry: HistoryEntry = {
    id: generateId(),
    timestamp: Date.now(),
    source,
    description,
    snapshot,
  }

  undoStack.value.push(entry)

  // Limit stack size
  while (undoStack.value.length > maxHistory.value) {
    undoStack.value.shift()
  }

  // Clear redo stack on new action
  redoStack.value = []

}

/**
 * Undo the last action
 */
export function undo(): boolean {
  if (undoStack.value.length === 0) return false

  isPerformingUndoRedo.value = true

  try {
    const entry = undoStack.value.pop()!

    // Capture current state for redo
    let currentSnapshot: unknown
    switch (entry.source) {
      case 'objects':
        currentSnapshot = captureObjectsSnapshot()
        break
      case 'environment':
        currentSnapshot = captureEnvironmentSnapshot()
        break
      case 'events':
        currentSnapshot = captureEventsSnapshot()
        break
      case 'sequencer':
        currentSnapshot = captureSequencerSnapshot()
        break
      case 'all':
        currentSnapshot = captureAllSnapshot()
        break
    }

    // Push to redo stack
    redoStack.value.push({
      ...entry,
      snapshot: currentSnapshot,
    })

    // Apply the undo snapshot
    switch (entry.source) {
      case 'objects':
        applyObjectsSnapshot(entry.snapshot)
        break
      case 'environment':
        applyEnvironmentSnapshot(entry.snapshot)
        break
      case 'events':
        applyEventsSnapshot(entry.snapshot)
        break
      case 'sequencer':
        applySequencerSnapshot(entry.snapshot)
        break
      case 'all':
        applyAllSnapshot(entry.snapshot)
        break
    }

    return true
  } finally {
    isPerformingUndoRedo.value = false
  }
}

/**
 * Redo the last undone action
 */
export function redo(): boolean {
  if (redoStack.value.length === 0) return false

  isPerformingUndoRedo.value = true

  try {
    const entry = redoStack.value.pop()!

    // Capture current state for undo
    let currentSnapshot: unknown
    switch (entry.source) {
      case 'objects':
        currentSnapshot = captureObjectsSnapshot()
        break
      case 'environment':
        currentSnapshot = captureEnvironmentSnapshot()
        break
      case 'events':
        currentSnapshot = captureEventsSnapshot()
        break
      case 'sequencer':
        currentSnapshot = captureSequencerSnapshot()
        break
      case 'all':
        currentSnapshot = captureAllSnapshot()
        break
    }

    // Push to undo stack
    undoStack.value.push({
      ...entry,
      snapshot: currentSnapshot,
    })

    // Apply the redo snapshot
    switch (entry.source) {
      case 'objects':
        applyObjectsSnapshot(entry.snapshot)
        break
      case 'environment':
        applyEnvironmentSnapshot(entry.snapshot)
        break
      case 'events':
        applyEventsSnapshot(entry.snapshot)
        break
      case 'sequencer':
        applySequencerSnapshot(entry.snapshot)
        break
      case 'all':
        applyAllSnapshot(entry.snapshot)
        break
    }

    return true
  } finally {
    isPerformingUndoRedo.value = false
  }
}

/**
 * Clear all history
 */
export function clearHistory(): void {
  undoStack.value = []
  redoStack.value = []
}

/**
 * Get history summary
 */
export function getHistorySummary(): { undoCount: number; redoCount: number } {
  return {
    undoCount: undoStack.value.length,
    redoCount: redoStack.value.length,
  }
}

/**
 * Set max history size
 */
export function setMaxHistory(max: number): void {
  maxHistory.value = Math.max(1, max)
  // Trim if necessary
  while (undoStack.value.length > maxHistory.value) {
    undoStack.value.shift()
  }
}

/**
 * Check if currently performing undo/redo
 */
export function isUndoingOrRedoing(): boolean {
  return isPerformingUndoRedo.value
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const historyManager = {
  pushUndo,
  undo,
  redo,
  clear: clearHistory,
  canUndo,
  canRedo,
  undoDescription,
  redoDescription,
  getSummary: getHistorySummary,
  setMaxHistory,
  isUndoingOrRedoing,
}
