import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { submitCompilation, pollJobCompletion, cleanupJob, type ProjectFile } from '@/services/compiler'
import { parseCompilerOutput, type CompilerDiagnostic } from '@/utils/error-parser'

export type AppStatus = 'idle' | 'compiling' | 'loading' | 'running' | 'error'

export const useAppStore = defineStore('app', () => {
  // State
  const status = ref<AppStatus>('idle')
  const currentJobId = ref<string | null>(null)
  const consoleOutput = ref<string[]>([])
  const wasmUrl = ref<string | null>(null)
  const jsUrl = ref<string | null>(null)
  const errorMessage = ref<string | null>(null)
  const diagnostics = ref<CompilerDiagnostic[]>([])

  // Getters
  const isCompiling = computed(() => status.value === 'compiling')
  const isRunning = computed(() => status.value === 'running')
  const canRun = computed(() => status.value === 'idle' || status.value === 'error')
  const canStop = computed(() => status.value === 'running')

  // Actions
  function log(message: string) {
    const timestamp = new Date().toLocaleTimeString()
    consoleOutput.value.push(`[${timestamp}] ${message}`)
  }

  function clearConsole() {
    consoleOutput.value = []
  }

  async function compile(files: ProjectFile[], mainFile: string = 'main.cpp') {
    if (status.value === 'compiling' || status.value === 'running') {
      return
    }

    status.value = 'compiling'
    errorMessage.value = null
    diagnostics.value = [] // Clear previous diagnostics
    log(`[INFO] Starting compilation... (${files.length} file${files.length > 1 ? 's' : ''})`)

    try {
      // Submit compilation request
      const response = await submitCompilation({ files, mainFile })

      if (!response.success) {
        throw new Error(response.error || 'Compilation failed')
      }

      currentJobId.value = response.jobId
      log(`[INFO] Job submitted: ${response.jobId}`)

      // Poll for completion
      const result = await pollJobCompletion(
        response.jobId,
        (jobStatus) => {
          log(`[INFO] Status: ${jobStatus}`)
        }
      )

      if (result.status === 'failed') {
        const errors = result.result?.errors || ['Unknown error']
        // Parse errors into diagnostics for editor highlighting
        diagnostics.value = parseCompilerOutput(errors)
        throw new Error(errors.join('\n'))
      }

      if (result.result?.wasmUrl && result.result?.jsUrl) {
        wasmUrl.value = result.result.wasmUrl
        jsUrl.value = result.result.jsUrl
        log(`[SUCCESS] Compilation complete (${result.result.duration}ms)`)
        status.value = 'loading'
      } else {
        throw new Error('No output files generated')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log(`[ERROR] ${message}`)
      errorMessage.value = message
      status.value = 'error'
    }
  }

  function setRunning() {
    status.value = 'running'
    log('[INFO] Application running')
  }

  function stop() {
    if (currentJobId.value) {
      cleanupJob(currentJobId.value).catch(console.error)
      currentJobId.value = null
    }
    wasmUrl.value = null
    jsUrl.value = null
    status.value = 'idle'
    log('[INFO] Stopped')
  }

  function setError(message: string) {
    errorMessage.value = message
    status.value = 'error'
    log(`[ERROR] ${message}`)
  }

  function reset() {
    stop()
    clearConsole()
    errorMessage.value = null
  }

  return {
    // State
    status,
    currentJobId,
    consoleOutput,
    wasmUrl,
    jsUrl,
    errorMessage,
    diagnostics,

    // Getters
    isCompiling,
    isRunning,
    canRun,
    canStop,

    // Actions
    log,
    clearConsole,
    compile,
    setRunning,
    stop,
    setError,
    reset,
  }
})
