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
  snapshot: any
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

function applyObjectsSnapshot(snapshot: any) {
  const objectsStore = useObjectsStore()
  objectsStore.fromJSON(snapshot)
}

function applyEnvironmentSnapshot(snapshot: any) {
  const environmentStore = useEnvironmentStore()
  environmentStore.fromJSON(snapshot)
}

function applyEventsSnapshot(snapshot: any) {
  const eventsStore = useEventsStore()
  eventsStore.fromJSON(snapshot)
}

function applySequencerSnapshot(snapshot: any) {
  const sequencerStore = useSequencerStore()
  // The sequencer store doesn't have direct setters, so we need to do this carefully
  if (snapshot.clips) {
    ;(sequencerStore as any).clips = snapshot.clips
  }
  if (snapshot.clipInstances) {
    ;(sequencerStore as any).clipInstances = snapshot.clipInstances
  }
  if (snapshot.arrangementTracks) {
    ;(sequencerStore as any).arrangementTracks = snapshot.arrangementTracks
  }
}

function applyAllSnapshot(snapshot: any) {
  if (snapshot.objects) applyObjectsSnapshot(snapshot.objects)
  if (snapshot.environment) applyEnvironmentSnapshot(snapshot.environment)
  if (snapshot.events) applyEventsSnapshot(snapshot.events)
  if (snapshot.sequencer) applySequencerSnapshot(snapshot.sequencer)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Push current state to undo stack before making changes
 */
export function pushUndo(source: HistorySource, description: string): void {
  if (isPerformingUndoRedo.value) return

  let snapshot: any
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

  console.log(`[History] Pushed: ${description} (${source})`)
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
    let currentSnapshot: any
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

    console.log(`[History] Undo: ${entry.description}`)
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
    let currentSnapshot: any
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

    console.log(`[History] Redo: ${entry.description}`)
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
  console.log('[History] Cleared')
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
