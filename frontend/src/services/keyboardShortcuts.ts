/**
 * Keyboard Shortcuts Service
 *
 * Centralized keyboard shortcut handling for the timeline and sequencer.
 * Shortcuts are context-aware based on active panel/focus.
 */

import { ref, watch } from 'vue'
import { useTimelineStore } from '@/stores/timeline'
import { useSequencerStore } from '@/stores/sequencer'
import { useObjectsStore } from '@/stores/objects'
import { useEventsStore } from '@/stores/events'
import { timelineClipboard } from './timelineClipboard'
import { saveUnifiedProject, downloadProject } from './unifiedProject'
import { historyManager } from './historyManager'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShortcutContext = 'global' | 'timeline' | 'sequencer' | 'editor'

export interface ShortcutDefinition {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  context: ShortcutContext | ShortcutContext[]
  description: string
  action: () => void
}

// ─── State ────────────────────────────────────────────────────────────────────

const activeContext = ref<ShortcutContext>('global')
const isEnabled = ref(true)

// ─── Shortcut Definitions ─────────────────────────────────────────────────────

const shortcuts: ShortcutDefinition[] = []

function registerShortcut(def: ShortcutDefinition) {
  shortcuts.push(def)
}

function registerDefaultShortcuts() {
  // ─── Global Shortcuts ───────────────────────────────────────────────────────

  // Play/Pause
  registerShortcut({
    key: ' ',
    context: ['global', 'timeline', 'sequencer'],
    description: 'Play / Pause',
    action: () => {
      const timeline = useTimelineStore()
      if (timeline.playing) {
        timeline.pause()
      } else {
        timeline.play()
      }
    },
  })

  // Stop
  registerShortcut({
    key: 'Escape',
    context: ['global', 'timeline', 'sequencer'],
    description: 'Stop playback',
    action: () => {
      const timeline = useTimelineStore()
      timeline.stop()
    },
  })

  // Save project
  registerShortcut({
    key: 's',
    ctrl: true,
    context: 'global',
    description: 'Save project',
    action: () => {
      saveUnifiedProject()
      console.log('[Shortcuts] Project saved')
    },
  })

  // Export project
  registerShortcut({
    key: 's',
    ctrl: true,
    shift: true,
    context: 'global',
    description: 'Export project as .allolib',
    action: () => {
      downloadProject()
    },
  })

  // ─── Timeline/Sequencer Shortcuts ───────────────────────────────────────────

  // Copy
  registerShortcut({
    key: 'c',
    ctrl: true,
    context: ['timeline', 'sequencer'],
    description: 'Copy selected',
    action: () => {
      const sequencer = useSequencerStore()
      if (sequencer.viewMode === 'clipTimeline') {
        // Copy clip instances
        const selectedIds = Array.from(sequencer.selectedClipInstanceIds)
        const instances = sequencer.clipInstances.filter(ci => selectedIds.includes(ci.id))
        if (instances.length > 0) {
          timelineClipboard.copyClipInstances(instances)
        }
      } else {
        // Copy notes
        const notes = sequencer.selectedNotes
        if (notes.length > 0) {
          timelineClipboard.copyNotes(notes)
        }
      }
    },
  })

  // Cut
  registerShortcut({
    key: 'x',
    ctrl: true,
    context: ['timeline', 'sequencer'],
    description: 'Cut selected',
    action: () => {
      const sequencer = useSequencerStore()
      if (sequencer.viewMode === 'clipTimeline') {
        timelineClipboard.cutClipInstances()
      } else {
        timelineClipboard.cutNotes()
      }
    },
  })

  // Paste
  registerShortcut({
    key: 'v',
    ctrl: true,
    context: ['timeline', 'sequencer'],
    description: 'Paste at playhead',
    action: () => {
      timelineClipboard.paste()
    },
  })

  // Delete
  registerShortcut({
    key: 'Delete',
    context: ['timeline', 'sequencer'],
    description: 'Delete selected',
    action: () => {
      const sequencer = useSequencerStore()
      sequencer.deleteSelected()
    },
  })

  // Backspace also deletes
  registerShortcut({
    key: 'Backspace',
    context: ['timeline', 'sequencer'],
    description: 'Delete selected',
    action: () => {
      const sequencer = useSequencerStore()
      sequencer.deleteSelected()
    },
  })

  // Select All
  registerShortcut({
    key: 'a',
    ctrl: true,
    context: ['timeline', 'sequencer'],
    description: 'Select all',
    action: () => {
      const sequencer = useSequencerStore()
      sequencer.selectAll()
    },
  })

  // Deselect All
  registerShortcut({
    key: 'd',
    ctrl: true,
    context: ['timeline', 'sequencer'],
    description: 'Deselect all',
    action: () => {
      const sequencer = useSequencerStore()
      sequencer.deselectAll()
    },
  })

  // Undo
  registerShortcut({
    key: 'z',
    ctrl: true,
    context: ['timeline', 'sequencer'],
    description: 'Undo',
    action: () => {
      // Try sequencer first (for note editing), then unified history
      const sequencer = useSequencerStore()
      if (sequencer.viewMode !== 'clipTimeline' && sequencer.canUndo) {
        sequencer.undo()
      } else if (historyManager.canUndo.value) {
        historyManager.undo()
      }
    },
  })

  // Redo
  registerShortcut({
    key: 'y',
    ctrl: true,
    context: ['timeline', 'sequencer'],
    description: 'Redo',
    action: () => {
      const sequencer = useSequencerStore()
      if (sequencer.viewMode !== 'clipTimeline' && sequencer.canRedo) {
        sequencer.redo()
      } else if (historyManager.canRedo.value) {
        historyManager.redo()
      }
    },
  })

  // Redo (alternative)
  registerShortcut({
    key: 'z',
    ctrl: true,
    shift: true,
    context: ['timeline', 'sequencer'],
    description: 'Redo',
    action: () => {
      const sequencer = useSequencerStore()
      if (sequencer.viewMode !== 'clipTimeline' && sequencer.canRedo) {
        sequencer.redo()
      } else if (historyManager.canRedo.value) {
        historyManager.redo()
      }
    },
  })

  // ─── Navigation Shortcuts ───────────────────────────────────────────────────

  // Go to start
  registerShortcut({
    key: 'Home',
    context: ['timeline', 'sequencer'],
    description: 'Go to start',
    action: () => {
      const timeline = useTimelineStore()
      timeline.seek(0)
    },
  })

  // Go to end
  registerShortcut({
    key: 'End',
    context: ['timeline', 'sequencer'],
    description: 'Go to end',
    action: () => {
      const timeline = useTimelineStore()
      timeline.seek(timeline.duration)
    },
  })

  // Jump forward
  registerShortcut({
    key: 'ArrowRight',
    context: ['timeline', 'sequencer'],
    description: 'Jump forward 1 beat',
    action: () => {
      const timeline = useTimelineStore()
      const sequencer = useSequencerStore()
      const beatDuration = 60 / sequencer.bpm
      timeline.seek(timeline.currentTime + beatDuration, true)
    },
  })

  // Jump backward
  registerShortcut({
    key: 'ArrowLeft',
    context: ['timeline', 'sequencer'],
    description: 'Jump backward 1 beat',
    action: () => {
      const timeline = useTimelineStore()
      const sequencer = useSequencerStore()
      const beatDuration = 60 / sequencer.bpm
      timeline.seek(Math.max(0, timeline.currentTime - beatDuration), true)
    },
  })

  // Jump forward (large)
  registerShortcut({
    key: 'ArrowRight',
    shift: true,
    context: ['timeline', 'sequencer'],
    description: 'Jump forward 4 beats',
    action: () => {
      const timeline = useTimelineStore()
      const sequencer = useSequencerStore()
      const beatDuration = 60 / sequencer.bpm
      timeline.seek(timeline.currentTime + beatDuration * 4, true)
    },
  })

  // Jump backward (large)
  registerShortcut({
    key: 'ArrowLeft',
    shift: true,
    context: ['timeline', 'sequencer'],
    description: 'Jump backward 4 beats',
    action: () => {
      const timeline = useTimelineStore()
      const sequencer = useSequencerStore()
      const beatDuration = 60 / sequencer.bpm
      timeline.seek(Math.max(0, timeline.currentTime - beatDuration * 4), true)
    },
  })

  // ─── Zoom Shortcuts ─────────────────────────────────────────────────────────

  // Zoom in
  registerShortcut({
    key: '=',
    ctrl: true,
    context: ['timeline', 'sequencer'],
    description: 'Zoom in',
    action: () => {
      const timeline = useTimelineStore()
      timeline.zoomIn()
    },
  })

  // Zoom out
  registerShortcut({
    key: '-',
    ctrl: true,
    context: ['timeline', 'sequencer'],
    description: 'Zoom out',
    action: () => {
      const timeline = useTimelineStore()
      timeline.zoomOut()
    },
  })

  // ─── Edit Mode Shortcuts ────────────────────────────────────────────────────

  // Select mode
  registerShortcut({
    key: 'v',
    context: ['timeline', 'sequencer'],
    description: 'Select tool',
    action: () => {
      const sequencer = useSequencerStore()
      sequencer.editMode = 'select'
    },
  })

  // Draw mode
  registerShortcut({
    key: 'b',
    context: ['timeline', 'sequencer'],
    description: 'Draw/pencil tool',
    action: () => {
      const sequencer = useSequencerStore()
      sequencer.editMode = 'draw'
    },
  })

  // Erase mode
  registerShortcut({
    key: 'e',
    context: ['timeline', 'sequencer'],
    description: 'Erase tool',
    action: () => {
      const sequencer = useSequencerStore()
      sequencer.editMode = 'erase'
    },
  })

  // Toggle loop
  registerShortcut({
    key: 'l',
    context: ['timeline', 'sequencer'],
    description: 'Toggle loop',
    action: () => {
      const sequencer = useSequencerStore()
      sequencer.toggleLoop()
    },
  })
}

// ─── Handler ──────────────────────────────────────────────────────────────────

function handleKeyDown(event: KeyboardEvent) {
  if (!isEnabled.value) return

  // Skip if focused on input elements
  const target = event.target as HTMLElement
  if (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  ) {
    // Allow some shortcuts even in inputs
    const allowedInInputs = ['s', 'S'] // Save
    if (!event.ctrlKey || !allowedInInputs.includes(event.key)) {
      return
    }
  }

  const key = event.key
  const ctrl = event.ctrlKey || event.metaKey
  const shift = event.shiftKey
  const alt = event.altKey

  for (const shortcut of shortcuts) {
    // Check key match
    if (shortcut.key !== key) continue

    // Check modifiers
    if (!!shortcut.ctrl !== ctrl) continue
    if (!!shortcut.shift !== shift) continue
    if (!!shortcut.alt !== alt) continue

    // Check context
    const contexts = Array.isArray(shortcut.context) ? shortcut.context : [shortcut.context]
    if (!contexts.includes('global') && !contexts.includes(activeContext.value)) {
      continue
    }

    // Execute action
    event.preventDefault()
    event.stopPropagation()
    shortcut.action()
    return
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize keyboard shortcuts
 */
export function initKeyboardShortcuts() {
  registerDefaultShortcuts()
  window.addEventListener('keydown', handleKeyDown)
  console.log('[Shortcuts] Initialized with', shortcuts.length, 'shortcuts')
}

/**
 * Cleanup keyboard shortcuts
 */
export function destroyKeyboardShortcuts() {
  window.removeEventListener('keydown', handleKeyDown)
  shortcuts.length = 0
}

/**
 * Set the active context
 */
export function setShortcutContext(context: ShortcutContext) {
  activeContext.value = context
}

/**
 * Enable/disable shortcuts
 */
export function setShortcutsEnabled(enabled: boolean) {
  isEnabled.value = enabled
}

/**
 * Get all registered shortcuts for display
 */
export function getAllShortcuts(): ShortcutDefinition[] {
  return [...shortcuts]
}

/**
 * Get shortcuts for a specific context
 */
export function getShortcutsForContext(context: ShortcutContext): ShortcutDefinition[] {
  return shortcuts.filter(s => {
    const contexts = Array.isArray(s.context) ? s.context : [s.context]
    return contexts.includes(context) || contexts.includes('global')
  })
}

/**
 * Format shortcut key combination for display
 */
export function formatShortcut(shortcut: ShortcutDefinition): string {
  const parts: string[] = []
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.alt) parts.push('Alt')
  if (shortcut.shift) parts.push('Shift')

  // Format special keys
  let keyLabel = shortcut.key
  switch (shortcut.key) {
    case ' ': keyLabel = 'Space'; break
    case 'ArrowLeft': keyLabel = '←'; break
    case 'ArrowRight': keyLabel = '→'; break
    case 'ArrowUp': keyLabel = '↑'; break
    case 'ArrowDown': keyLabel = '↓'; break
    case 'Escape': keyLabel = 'Esc'; break
    case 'Delete': keyLabel = 'Del'; break
    default:
      if (keyLabel.length === 1) keyLabel = keyLabel.toUpperCase()
  }
  parts.push(keyLabel)

  return parts.join('+')
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const keyboardShortcuts = {
  init: initKeyboardShortcuts,
  destroy: destroyKeyboardShortcuts,
  setContext: setShortcutContext,
  setEnabled: setShortcutsEnabled,
  getAll: getAllShortcuts,
  getForContext: getShortcutsForContext,
  format: formatShortcut,
}
