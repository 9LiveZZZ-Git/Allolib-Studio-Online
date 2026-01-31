/**
 * Commands Store
 *
 * Unified undo/redo system using the Command Pattern.
 * This replaces the fragmented undo systems in individual stores
 * with a centralized, memory-efficient approach.
 *
 * Based on best practices from professional DAWs like Ableton Live
 * which use command-based undo for complex, interrelated state.
 *
 * Key features:
 * - Single source of truth for undo/redo
 * - Command merging for related operations (e.g., continuous slider drags)
 * - Batch commands for transactional operations
 * - Memory-efficient (stores only deltas, not full state)
 * - Observer pattern for UI updates
 */

import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'

// ─── Command Interface ───────────────────────────────────────────────────────

export interface Command {
  /** Unique identifier for this command */
  id: string

  /** Type identifier for command grouping */
  type: string

  /** Human-readable description for UI */
  description: string

  /** Execute the command (do/redo) */
  execute(): void

  /** Undo the command */
  undo(): void

  /**
   * Check if this command can be merged with the previous one.
   * Used for continuous operations like slider drags.
   */
  canMerge?(previous: Command): boolean

  /**
   * Merge with previous command, returning the merged command.
   * Only called if canMerge returns true.
   */
  merge?(previous: Command): Command

  /** Timestamp when command was executed */
  timestamp?: number

  /** Optional metadata */
  meta?: Record<string, any>
}

// ─── Batch Command ───────────────────────────────────────────────────────────

/**
 * A command that executes multiple commands as a single undoable unit.
 * Use for operations that span multiple stores or require atomicity.
 */
export class BatchCommand implements Command {
  id: string
  type = 'batch'
  description: string
  commands: Command[]
  timestamp?: number

  constructor(commands: Command[], description?: string) {
    this.id = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    this.commands = commands
    this.description = description || `Batch: ${commands.length} operations`
    this.timestamp = Date.now()
  }

  execute(): void {
    for (const cmd of this.commands) {
      cmd.execute()
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo()
    }
  }
}

// ─── Command Factories ───────────────────────────────────────────────────────

/**
 * Create a simple value change command
 */
export function createValueCommand<T>(
  type: string,
  description: string,
  getValue: () => T,
  setValue: (value: T) => void,
  newValue: T
): Command {
  const oldValue = getValue()

  return {
    id: `${type}-${Date.now()}`,
    type,
    description,
    timestamp: Date.now(),
    execute() {
      setValue(newValue)
    },
    undo() {
      setValue(oldValue)
    },
    canMerge(prev: Command): boolean {
      // Merge if same type and within 500ms
      return prev.type === this.type &&
        prev.timestamp !== undefined &&
        this.timestamp !== undefined &&
        this.timestamp - prev.timestamp < 500
    },
    merge(prev: Command): Command {
      // Keep the oldest oldValue, use newest newValue
      const mergedOldValue = (prev as any)._oldValue ?? oldValue
      return {
        ...this,
        id: prev.id,  // Keep original ID
        timestamp: prev.timestamp,  // Keep original timestamp
        execute() {
          setValue(newValue)
        },
        undo() {
          setValue(mergedOldValue)
        },
        _oldValue: mergedOldValue,
      } as Command
    },
    _oldValue: oldValue,
  } as Command & { _oldValue: T }
}

/**
 * Create an object property change command
 */
export function createPropertyCommand(
  objectId: string,
  property: string,
  oldValue: any,
  newValue: any,
  setter: (id: string, prop: string, value: any) => void
): Command {
  return {
    id: `prop-${objectId}-${property}-${Date.now()}`,
    type: 'property',
    description: `Set ${property}`,
    timestamp: Date.now(),
    meta: { objectId, property },
    execute() {
      setter(objectId, property, newValue)
    },
    undo() {
      setter(objectId, property, oldValue)
    },
    canMerge(prev: Command): boolean {
      return prev.type === 'property' &&
        prev.meta?.objectId === objectId &&
        prev.meta?.property === property &&
        prev.timestamp !== undefined &&
        this.timestamp !== undefined &&
        this.timestamp - prev.timestamp < 500
    },
    merge(prev: Command): Command {
      const mergedOldValue = (prev as any)._oldValue
      return {
        ...this,
        id: prev.id,
        timestamp: prev.timestamp,
        execute() {
          setter(objectId, property, newValue)
        },
        undo() {
          setter(objectId, property, mergedOldValue)
        },
        _oldValue: mergedOldValue,
      } as Command
    },
    _oldValue: oldValue,
  } as Command & { _oldValue: any }
}

/**
 * Create a keyframe add/remove command
 */
export function createKeyframeCommand(
  action: 'add' | 'remove',
  objectId: string,
  property: string,
  time: number,
  value: any,
  easing: string,
  addFn: (id: string, prop: string, time: number, value: any, easing: string) => void,
  removeFn: (id: string, prop: string, time: number) => void
): Command {
  return {
    id: `kf-${action}-${objectId}-${property}-${time}-${Date.now()}`,
    type: `keyframe-${action}`,
    description: action === 'add' ? `Add keyframe at ${time.toFixed(2)}s` : `Remove keyframe at ${time.toFixed(2)}s`,
    timestamp: Date.now(),
    meta: { objectId, property, time },
    execute() {
      if (action === 'add') {
        addFn(objectId, property, time, value, easing)
      } else {
        removeFn(objectId, property, time)
      }
    },
    undo() {
      if (action === 'add') {
        removeFn(objectId, property, time)
      } else {
        addFn(objectId, property, time, value, easing)
      }
    },
  }
}

/**
 * Create a keyframe move command
 */
export function createMoveKeyframeCommand(
  objectId: string,
  property: string,
  oldTime: number,
  newTime: number,
  value: any,
  easing: string,
  addFn: (id: string, prop: string, time: number, value: any, easing: string) => void,
  removeFn: (id: string, prop: string, time: number) => void
): Command {
  return {
    id: `kf-move-${objectId}-${property}-${Date.now()}`,
    type: 'keyframe-move',
    description: `Move keyframe ${oldTime.toFixed(2)}s → ${newTime.toFixed(2)}s`,
    timestamp: Date.now(),
    meta: { objectId, property, oldTime, newTime },
    execute() {
      removeFn(objectId, property, oldTime)
      addFn(objectId, property, newTime, value, easing)
    },
    undo() {
      removeFn(objectId, property, newTime)
      addFn(objectId, property, oldTime, value, easing)
    },
  }
}

/**
 * Create an object CRUD command
 */
export function createObjectCommand(
  action: 'create' | 'delete',
  objectData: any,
  createFn: (data: any) => any,
  deleteFn: (id: string) => void
): Command {
  return {
    id: `obj-${action}-${objectData.id || 'new'}-${Date.now()}`,
    type: `object-${action}`,
    description: action === 'create' ? `Create ${objectData.name || 'object'}` : `Delete ${objectData.name || 'object'}`,
    timestamp: Date.now(),
    meta: { objectId: objectData.id },
    execute() {
      if (action === 'create') {
        createFn(objectData)
      } else {
        deleteFn(objectData.id)
      }
    },
    undo() {
      if (action === 'create') {
        deleteFn(objectData.id)
      } else {
        createFn(objectData)
      }
    },
  }
}

// ─── Commands Store ──────────────────────────────────────────────────────────

export const useCommandsStore = defineStore('commands', () => {
  // Undo and redo stacks
  const undoStack = shallowRef<Command[]>([])
  const redoStack = shallowRef<Command[]>([])

  // Configuration
  const maxHistory = ref(100)
  const isExecuting = ref(false)  // Prevent recursive command execution

  // Computed
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const undoDescription = computed(() => undoStack.value.at(-1)?.description ?? null)
  const redoDescription = computed(() => redoStack.value.at(-1)?.description ?? null)
  const historyLength = computed(() => undoStack.value.length)

  /**
   * Execute a command and add to undo stack
   */
  function execute(command: Command): void {
    if (isExecuting.value) {
      console.warn('[Commands] Ignoring nested command execution')
      return
    }

    isExecuting.value = true

    try {
      // Execute the command
      command.execute()

      // Check if we can merge with the last command
      const lastCommand = undoStack.value.at(-1)
      if (lastCommand && command.canMerge?.(lastCommand)) {
        const mergedCommand = command.merge!(lastCommand)
        // Replace last command with merged
        undoStack.value = [...undoStack.value.slice(0, -1), mergedCommand]
      } else {
        // Add to undo stack
        undoStack.value = [...undoStack.value, command]
      }

      // Clear redo stack (new action invalidates redo history)
      redoStack.value = []

      // Trim history if needed
      if (undoStack.value.length > maxHistory.value) {
        undoStack.value = undoStack.value.slice(-maxHistory.value)
      }

      console.log(`[Commands] Executed: ${command.description}`)
    } finally {
      isExecuting.value = false
    }
  }

  /**
   * Execute multiple commands as a single undoable batch
   */
  function executeBatch(commands: Command[], description?: string): void {
    if (commands.length === 0) return
    if (commands.length === 1) {
      execute(commands[0])
      return
    }

    execute(new BatchCommand(commands, description))
  }

  /**
   * Undo the last command
   */
  function undo(): boolean {
    if (undoStack.value.length === 0) {
      console.log('[Commands] Nothing to undo')
      return false
    }

    isExecuting.value = true

    try {
      const command = undoStack.value.at(-1)!
      command.undo()

      // Move to redo stack
      undoStack.value = undoStack.value.slice(0, -1)
      redoStack.value = [...redoStack.value, command]

      console.log(`[Commands] Undone: ${command.description}`)
      return true
    } finally {
      isExecuting.value = false
    }
  }

  /**
   * Redo the last undone command
   */
  function redo(): boolean {
    if (redoStack.value.length === 0) {
      console.log('[Commands] Nothing to redo')
      return false
    }

    isExecuting.value = true

    try {
      const command = redoStack.value.at(-1)!
      command.execute()

      // Move back to undo stack
      redoStack.value = redoStack.value.slice(0, -1)
      undoStack.value = [...undoStack.value, command]

      console.log(`[Commands] Redone: ${command.description}`)
      return true
    } finally {
      isExecuting.value = false
    }
  }

  /**
   * Clear all history
   */
  function clear(): void {
    undoStack.value = []
    redoStack.value = []
    console.log('[Commands] History cleared')
  }

  /**
   * Get recent history for UI display
   */
  function getHistory(limit = 20): { undo: string[]; redo: string[] } {
    return {
      undo: undoStack.value.slice(-limit).reverse().map(c => c.description),
      redo: redoStack.value.slice(-limit).reverse().map(c => c.description),
    }
  }

  /**
   * Check if currently executing a command (to prevent nested executions)
   */
  function isRecording(): boolean {
    return !isExecuting.value
  }

  return {
    // State
    undoStack,
    redoStack,
    maxHistory,
    isExecuting,

    // Computed
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
    historyLength,

    // Actions
    execute,
    executeBatch,
    undo,
    redo,
    clear,
    getHistory,
    isRecording,
  }
})

// ─── Transaction Helper ──────────────────────────────────────────────────────

/**
 * Run a function as a transaction - all commands executed within
 * will be grouped into a single undoable batch.
 */
export function runTransaction<T>(
  description: string,
  fn: (addCommand: (cmd: Command) => void) => T
): T {
  const commands: Command[] = []
  const addCommand = (cmd: Command) => {
    cmd.execute()
    commands.push(cmd)
  }

  try {
    const result = fn(addCommand)

    // Register the batch
    if (commands.length > 0) {
      const commandsStore = useCommandsStore()
      // Don't re-execute, just add to stack
      const batch = new BatchCommand(commands, description)
      commandsStore.undoStack.value = [...commandsStore.undoStack.value, batch]
      commandsStore.redoStack.value = []
    }

    return result
  } catch (error) {
    // Rollback: undo all executed commands in reverse
    for (let i = commands.length - 1; i >= 0; i--) {
      try {
        commands[i].undo()
      } catch (e) {
        console.error('[Commands] Rollback failed:', e)
      }
    }
    throw error
  }
}

// ─── Window Registration ─────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  ;(window as any).__commandsStore = null
}

export function registerCommandsStoreForTerminal(): void {
  const store = useCommandsStore()
  ;(window as any).__commandsStore = store
}
