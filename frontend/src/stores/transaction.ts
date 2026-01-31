/**
 * Transaction Store
 *
 * Provides transactional operations that span multiple stores.
 * If an operation fails mid-way, the entire transaction is rolled back.
 *
 * Features:
 * - Snapshot-based rollback
 * - Nested transaction support
 * - Integration with command store for undo/redo
 * - Automatic cleanup on failure
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useObjectsStore } from './objects'
import { useEnvironmentStore } from './environment'
import { useEventsStore } from './events'
import { useTimelineStore } from './timeline'
import { useSequencerStore } from './sequencer'
import { useCommandsStore, type Command } from './commands'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StoreSnapshot {
  objects: any
  environment: any
  events: any
  timeline: any
  sequencer: any
  timestamp: number
}

export interface Transaction {
  id: string
  description: string
  snapshot: StoreSnapshot
  startTime: number
  completed: boolean
  rolledBack: boolean
}

export interface TransactionResult<T> {
  success: boolean
  result?: T
  error?: Error
  duration: number
}

// ─── Transaction Store ───────────────────────────────────────────────────────

export const useTransactionStore = defineStore('transaction', () => {
  // ─── State ─────────────────────────────────────────────────────────────────

  const activeTransactions = ref<Transaction[]>([])
  const transactionHistory = ref<Transaction[]>([])
  const maxHistorySize = ref(20)

  // ─── Computed ──────────────────────────────────────────────────────────────

  const hasActiveTransaction = computed(() => activeTransactions.value.length > 0)

  const currentTransaction = computed(() =>
    activeTransactions.value[activeTransactions.value.length - 1] || null
  )

  const nestingLevel = computed(() => activeTransactions.value.length)

  // ─── Snapshot Management ───────────────────────────────────────────────────

  function captureSnapshot(): StoreSnapshot {
    const objectsStore = useObjectsStore()
    const environmentStore = useEnvironmentStore()
    const eventsStore = useEventsStore()
    const timelineStore = useTimelineStore()
    const sequencerStore = useSequencerStore()

    return {
      objects: objectsStore.toJSON ? objectsStore.toJSON() : {},
      environment: environmentStore.toJSON(),
      events: eventsStore.toJSON(),
      timeline: timelineStore.toJSON(),
      sequencer: sequencerStore.toJSON(),
      timestamp: Date.now(),
    }
  }

  function restoreSnapshot(snapshot: StoreSnapshot): void {
    const objectsStore = useObjectsStore()
    const environmentStore = useEnvironmentStore()
    const eventsStore = useEventsStore()
    const timelineStore = useTimelineStore()
    const sequencerStore = useSequencerStore()

    try {
      if (objectsStore.fromJSON && snapshot.objects) {
        objectsStore.fromJSON(snapshot.objects)
      }
      if (snapshot.environment) {
        environmentStore.fromJSON(snapshot.environment)
      }
      if (snapshot.events) {
        eventsStore.fromJSON(snapshot.events)
      }
      if (snapshot.timeline) {
        timelineStore.fromJSON(snapshot.timeline)
      }
      if (snapshot.sequencer) {
        sequencerStore.fromJSON(snapshot.sequencer)
      }
    } catch (error) {
      console.error('[Transaction] Failed to restore snapshot:', error)
      throw error
    }
  }

  // ─── Transaction Lifecycle ─────────────────────────────────────────────────

  function beginTransaction(description: string): string {
    const id = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const transaction: Transaction = {
      id,
      description,
      snapshot: captureSnapshot(),
      startTime: performance.now(),
      completed: false,
      rolledBack: false,
    }

    activeTransactions.value.push(transaction)

    console.log(`[Transaction] Begin: ${description} (id: ${id}, nesting: ${nestingLevel.value})`)

    return id
  }

  function commitTransaction(id?: string): void {
    if (activeTransactions.value.length === 0) {
      console.warn('[Transaction] No active transaction to commit')
      return
    }

    // If id provided, verify it matches current transaction
    const current = currentTransaction.value!
    if (id && current.id !== id) {
      console.warn(`[Transaction] ID mismatch: expected ${current.id}, got ${id}`)
      return
    }

    // Pop the transaction
    const transaction = activeTransactions.value.pop()!
    transaction.completed = true

    // Add to history
    transactionHistory.value.push(transaction)

    // Trim history
    while (transactionHistory.value.length > maxHistorySize.value) {
      transactionHistory.value.shift()
    }

    const duration = performance.now() - transaction.startTime
    console.log(`[Transaction] Commit: ${transaction.description} (${duration.toFixed(2)}ms)`)
  }

  function rollbackTransaction(id?: string): void {
    if (activeTransactions.value.length === 0) {
      console.warn('[Transaction] No active transaction to rollback')
      return
    }

    // If id provided, verify it matches current transaction
    const current = currentTransaction.value!
    if (id && current.id !== id) {
      console.warn(`[Transaction] ID mismatch for rollback: expected ${current.id}, got ${id}`)
      return
    }

    // Pop the transaction
    const transaction = activeTransactions.value.pop()!
    transaction.rolledBack = true

    // Restore the snapshot
    console.log(`[Transaction] Rolling back: ${transaction.description}`)
    restoreSnapshot(transaction.snapshot)

    // Add to history
    transactionHistory.value.push(transaction)

    const duration = performance.now() - transaction.startTime
    console.log(`[Transaction] Rollback complete: ${transaction.description} (${duration.toFixed(2)}ms)`)
  }

  function rollbackAll(): void {
    while (activeTransactions.value.length > 0) {
      rollbackTransaction()
    }
  }

  // ─── High-Level Transaction API ────────────────────────────────────────────

  /**
   * Run a function within a transaction.
   * If the function throws, the transaction is rolled back.
   */
  function runTransaction<T>(
    description: string,
    fn: () => T
  ): TransactionResult<T> {
    const startTime = performance.now()
    const id = beginTransaction(description)

    try {
      const result = fn()
      commitTransaction(id)

      return {
        success: true,
        result,
        duration: performance.now() - startTime,
      }
    } catch (error) {
      rollbackTransaction(id)

      return {
        success: false,
        error: error as Error,
        duration: performance.now() - startTime,
      }
    }
  }

  /**
   * Run an async function within a transaction.
   */
  async function runTransactionAsync<T>(
    description: string,
    fn: () => Promise<T>
  ): Promise<TransactionResult<T>> {
    const startTime = performance.now()
    const id = beginTransaction(description)

    try {
      const result = await fn()
      commitTransaction(id)

      return {
        success: true,
        result,
        duration: performance.now() - startTime,
      }
    } catch (error) {
      rollbackTransaction(id)

      return {
        success: false,
        error: error as Error,
        duration: performance.now() - startTime,
      }
    }
  }

  /**
   * Run a transaction that integrates with the command store for undo/redo.
   */
  function runUndoableTransaction<T>(
    description: string,
    fn: () => T
  ): TransactionResult<T> {
    const commandStore = useCommandsStore()
    const startTime = performance.now()
    const snapshot = captureSnapshot()

    try {
      const result = fn()

      // Create a command that captures the before/after state
      const finalSnapshot = captureSnapshot()

      const command: Command = {
        id: `tx-cmd-${Date.now()}`,
        type: 'transaction',
        description,
        execute: () => restoreSnapshot(finalSnapshot),
        undo: () => restoreSnapshot(snapshot),
      }

      commandStore.execute(command)

      return {
        success: true,
        result,
        duration: performance.now() - startTime,
      }
    } catch (error) {
      // Rollback on failure
      restoreSnapshot(snapshot)

      return {
        success: false,
        error: error as Error,
        duration: performance.now() - startTime,
      }
    }
  }

  // ─── Savepoints ────────────────────────────────────────────────────────────

  /**
   * Create a savepoint within the current transaction.
   * Can be used to partially rollback.
   */
  function createSavepoint(): StoreSnapshot {
    return captureSnapshot()
  }

  /**
   * Restore to a savepoint without ending the transaction.
   */
  function restoreToSavepoint(savepoint: StoreSnapshot): void {
    restoreSnapshot(savepoint)
  }

  // ─── Clear History ─────────────────────────────────────────────────────────

  function clearHistory(): void {
    transactionHistory.value = []
  }

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    // State
    activeTransactions,
    transactionHistory,
    maxHistorySize,

    // Computed
    hasActiveTransaction,
    currentTransaction,
    nestingLevel,

    // Lifecycle
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    rollbackAll,

    // High-level API
    runTransaction,
    runTransactionAsync,
    runUndoableTransaction,

    // Savepoints
    createSavepoint,
    restoreToSavepoint,

    // Utilities
    captureSnapshot,
    restoreSnapshot,
    clearHistory,
  }
})

// ─── Convenience Composable ──────────────────────────────────────────────────

export function useTransaction() {
  const store = useTransactionStore()

  return {
    runTransaction: store.runTransaction,
    runTransactionAsync: store.runTransactionAsync,
    runUndoableTransaction: store.runUndoableTransaction,
    createSavepoint: store.createSavepoint,
    restoreToSavepoint: store.restoreToSavepoint,
  }
}
