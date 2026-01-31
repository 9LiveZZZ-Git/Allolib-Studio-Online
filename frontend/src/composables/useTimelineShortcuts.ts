/**
 * Timeline Keyboard Shortcuts Composable
 *
 * Provides keyboard shortcut handling for timeline operations:
 * - Copy/Cut/Paste/Duplicate (Ctrl+C, X, V, D)
 * - Delete (Delete, Backspace)
 * - Select All (Ctrl+A)
 * - Undo/Redo (Ctrl+Z, Ctrl+Shift+Z)
 * - Navigation (Arrow keys for nudging)
 * - Playback (Space for play/pause)
 */

import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { useTimelineStore } from '@/stores/timeline'
import { useCommandsStore } from '@/stores/commands'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description: string
  category: 'editing' | 'selection' | 'playback' | 'navigation' | 'view'
}

export interface ShortcutOptions {
  enabled?: Ref<boolean>
  onPlayPause?: () => void
  onStop?: () => void
  onUndo?: () => void
  onRedo?: () => void
  nudgeAmount?: number
  fineNudgeAmount?: number
}

// ─── Composable ──────────────────────────────────────────────────────────────

export function useTimelineShortcuts(options: ShortcutOptions = {}) {
  const timeline = useTimelineStore()
  const commands = useCommandsStore()

  const {
    enabled = ref(true),
    onPlayPause,
    onStop,
    onUndo,
    onRedo,
    nudgeAmount = 0.5,        // Default nudge: 0.5 seconds
    fineNudgeAmount = 0.1,    // Fine nudge: 0.1 seconds
  } = options

  // Track if shortcuts are currently active
  const isActive = ref(true)

  // ─── Shortcut Definitions ────────────────────────────────────────────────────

  const shortcuts: ShortcutConfig[] = [
    // ─── Editing ───────────────────────────────────────────────────────────────
    {
      key: 'c',
      ctrl: true,
      action: () => timeline.copySelection(),
      description: 'Copy selected keyframes',
      category: 'editing',
    },
    {
      key: 'x',
      ctrl: true,
      action: () => timeline.cutSelection(),
      description: 'Cut selected keyframes',
      category: 'editing',
    },
    {
      key: 'v',
      ctrl: true,
      action: () => timeline.pasteAtTime(),
      description: 'Paste keyframes at playhead',
      category: 'editing',
    },
    {
      key: 'd',
      ctrl: true,
      action: () => timeline.duplicateSelection(),
      description: 'Duplicate selected keyframes',
      category: 'editing',
    },
    {
      key: 'Delete',
      action: () => timeline.deleteSelection(),
      description: 'Delete selected keyframes',
      category: 'editing',
    },
    {
      key: 'Backspace',
      action: () => timeline.deleteSelection(),
      description: 'Delete selected keyframes',
      category: 'editing',
    },

    // ─── Selection ─────────────────────────────────────────────────────────────
    {
      key: 'a',
      ctrl: true,
      action: () => {
        // Select all in the currently focused category
        // For now, just log - full implementation needs UI context
        console.log('[Shortcuts] Select All - needs category context')
      },
      description: 'Select all keyframes',
      category: 'selection',
    },
    {
      key: 'Escape',
      action: () => timeline.clearSelection(),
      description: 'Clear selection',
      category: 'selection',
    },

    // ─── Undo/Redo ─────────────────────────────────────────────────────────────
    {
      key: 'z',
      ctrl: true,
      action: () => {
        if (onUndo) {
          onUndo()
        } else {
          commands.undo()
        }
      },
      description: 'Undo',
      category: 'editing',
    },
    {
      key: 'z',
      ctrl: true,
      shift: true,
      action: () => {
        if (onRedo) {
          onRedo()
        } else {
          commands.redo()
        }
      },
      description: 'Redo',
      category: 'editing',
    },
    {
      key: 'y',
      ctrl: true,
      action: () => {
        if (onRedo) {
          onRedo()
        } else {
          commands.redo()
        }
      },
      description: 'Redo (alternative)',
      category: 'editing',
    },

    // ─── Playback ──────────────────────────────────────────────────────────────
    {
      key: ' ',
      action: () => {
        if (onPlayPause) {
          onPlayPause()
        } else {
          if (timeline.playing) {
            timeline.pause()
          } else {
            timeline.play()
          }
        }
      },
      description: 'Play/Pause',
      category: 'playback',
    },
    {
      key: 'Enter',
      action: () => {
        if (onStop) {
          onStop()
        } else {
          timeline.stop()
        }
      },
      description: 'Stop and reset',
      category: 'playback',
    },
    {
      key: 'Home',
      action: () => timeline.seek(0),
      description: 'Go to start',
      category: 'playback',
    },
    {
      key: 'End',
      action: () => timeline.seek(timeline.duration),
      description: 'Go to end',
      category: 'playback',
    },

    // ─── Navigation (Nudge Selection) ──────────────────────────────────────────
    {
      key: 'ArrowLeft',
      action: () => timeline.nudgeSelection(-nudgeAmount),
      description: 'Nudge selection left',
      category: 'navigation',
    },
    {
      key: 'ArrowRight',
      action: () => timeline.nudgeSelection(nudgeAmount),
      description: 'Nudge selection right',
      category: 'navigation',
    },
    {
      key: 'ArrowLeft',
      shift: true,
      action: () => timeline.nudgeSelection(-fineNudgeAmount),
      description: 'Fine nudge selection left',
      category: 'navigation',
    },
    {
      key: 'ArrowRight',
      shift: true,
      action: () => timeline.nudgeSelection(fineNudgeAmount),
      description: 'Fine nudge selection right',
      category: 'navigation',
    },

    // ─── View ──────────────────────────────────────────────────────────────────
    {
      key: '=',
      ctrl: true,
      action: () => timeline.zoomIn(),
      description: 'Zoom in',
      category: 'view',
    },
    {
      key: '+',
      ctrl: true,
      action: () => timeline.zoomIn(),
      description: 'Zoom in',
      category: 'view',
    },
    {
      key: '-',
      ctrl: true,
      action: () => timeline.zoomOut(),
      description: 'Zoom out',
      category: 'view',
    },
    {
      key: '0',
      ctrl: true,
      action: () => timeline.setZoom(50),
      description: 'Reset zoom',
      category: 'view',
    },
  ]

  // ─── Event Handler ─────────────────────────────────────────────────────────

  function handleKeyDown(event: KeyboardEvent): void {
    if (!enabled.value || !isActive.value) return

    // Don't handle if focus is in an input field
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true'
    ) {
      return
    }

    // Find matching shortcut
    const shortcut = shortcuts.find(s => {
      if (s.key.toLowerCase() !== event.key.toLowerCase()) return false
      if (s.ctrl && !event.ctrlKey && !event.metaKey) return false
      if (!s.ctrl && (event.ctrlKey || event.metaKey)) return false
      if (s.shift && !event.shiftKey) return false
      if (!s.shift && event.shiftKey && s.key !== event.key) return false
      if (s.alt && !event.altKey) return false
      if (!s.alt && event.altKey) return false
      return true
    })

    if (shortcut) {
      event.preventDefault()
      event.stopPropagation()
      shortcut.action()
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  function activate(): void {
    isActive.value = true
  }

  function deactivate(): void {
    isActive.value = false
  }

  function setup(): void {
    window.addEventListener('keydown', handleKeyDown)
  }

  function cleanup(): void {
    window.removeEventListener('keydown', handleKeyDown)
  }

  onMounted(setup)
  onUnmounted(cleanup)

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    shortcuts,
    isActive,
    activate,
    deactivate,
    setup,
    cleanup,
  }
}

// ─── Shortcut Display Helpers ────────────────────────────────────────────────

/**
 * Format a shortcut for display (e.g., "Ctrl+C")
 */
export function formatShortcut(shortcut: ShortcutConfig): string {
  const parts: string[] = []

  if (shortcut.ctrl) {
    parts.push(navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl')
  }
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.alt) parts.push('Alt')

  // Format key name
  let keyName = shortcut.key
  if (keyName === ' ') keyName = 'Space'
  if (keyName.startsWith('Arrow')) keyName = keyName.replace('Arrow', '')
  parts.push(keyName.charAt(0).toUpperCase() + keyName.slice(1))

  return parts.join('+')
}

/**
 * Get shortcuts grouped by category
 */
export function getShortcutsByCategory(
  shortcuts: ShortcutConfig[]
): Record<string, ShortcutConfig[]> {
  return shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, ShortcutConfig[]>)
}
