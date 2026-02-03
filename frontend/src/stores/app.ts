import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { submitCompilation, pollJobCompletion, cleanupJob, type ProjectFile, type BackendType } from '@/services/compiler'
import { parseCompilerOutput, type CompilerDiagnostic } from '@/utils/error-parser'
import { useSettingsStore } from '@/stores/settings'

export type AppStatus = 'idle' | 'compiling' | 'loading' | 'running' | 'error'

/**
 * Auto-LOD patterns to convert g.draw(mesh) to drawLOD(g, mesh)
 * This enables automatic LOD for all mesh draw calls.
 * Excludes VAO draws since they're not Mesh types.
 */
const autoLODPatterns: Array<{ pattern: RegExp; replacement: string | ((match: string, ...args: string[]) => string) }> = [
  // g.draw(expr) -> drawLOD(g, expr) - handles identifiers, member access, arrays, pointers
  {
    pattern: /\bg\.draw\s*\(\s*(\*?[a-zA-Z_][a-zA-Z0-9_]*(?:(?:\.|->)[a-zA-Z_][a-zA-Z0-9_]*)*(?:\[[^\]]+\])?)\s*\)/g,
    replacement: (match: string, expr: string) => {
      // Skip VAO draws
      if (expr.toLowerCase().includes('vao')) return match
      return `drawLOD(g, ${expr.trim()})`
    }
  },
  // g.draw(func()) -> drawLOD(g, func()) - handles function calls
  {
    pattern: /\bg\.draw\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*(?:(?:\.|->)[a-zA-Z_][a-zA-Z0-9_]*)*\([^)]*\))\s*\)/g,
    replacement: (match: string, expr: string) => {
      if (expr.toLowerCase().includes('vao')) return match
      return `drawLOD(g, ${expr.trim()})`
    }
  },
  // graphics.draw variants
  {
    pattern: /\bgraphics\.draw\s*\(\s*(\*?[a-zA-Z_][a-zA-Z0-9_]*(?:(?:\.|->)[a-zA-Z_][a-zA-Z0-9_]*)*(?:\[[^\]]+\])?)\s*\)/g,
    replacement: (match: string, expr: string) => {
      if (expr.toLowerCase().includes('vao')) return match
      return `drawLOD(graphics, ${expr.trim()})`
    }
  },
]

/**
 * Preprocess code to ensure WebApp classes use ALLOLIB_WEB_MAIN macro
 * and apply Auto-LOD transformations for mesh draw calls.
 * This is required for WASM exports and automatic LOD to work correctly.
 */
function preprocessForWasm(content: string): string {
  // Check if this file uses WebApp
  if (!content.includes('WebApp') && !content.includes('al_WebApp.hpp')) {
    return content
  }

  let result = content

  // Apply Auto-LOD transformations: g.draw(mesh) -> drawLOD(g, mesh)
  // This enables automatic LOD for all mesh draw calls when Auto-LOD is enabled
  for (const { pattern, replacement } of autoLODPatterns) {
    const before = result
    if (typeof replacement === 'function') {
      result = result.replace(pattern, replacement as (match: string, ...args: string[]) => string)
    } else {
      result = result.replace(pattern, replacement)
    }
    if (before !== result) {
      console.log('[Auto-LOD] Transformed g.draw() calls to drawLOD()')
    }
  }

  // Check if ALLOLIB_WEB_MAIN is already used
  if (result.includes('ALLOLIB_WEB_MAIN')) {
    return result
  }

  // Pattern to match simple main() that instantiates an app and calls start()
  // Handles: int main() { ClassName app; app.start(); return 0; }
  // Also handles: int main() { ClassName app; app.configureAudio(...); app.start(); return 0; }
  const mainPattern = /int\s+main\s*\(\s*\)\s*\{\s*(\w+)\s+(\w+)\s*;([^}]*)\2\.start\s*\(\s*\)\s*;\s*return\s+0\s*;\s*\}/

  const match = result.match(mainPattern)
  if (match) {
    const className = match[1]
    // Replace the entire main function with ALLOLIB_WEB_MAIN macro
    return result.replace(mainPattern, `ALLOLIB_WEB_MAIN(${className})`)
  }

  return result
}

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
      // Preprocess files to ensure WebApp classes use WEBAPP_CREATE_APP
      const preprocessedFiles = files.map(file => ({
        name: file.name,
        content: file.name.endsWith('.cpp') || file.name.endsWith('.hpp')
          ? preprocessForWasm(file.content)
          : file.content
      }))

      // Get backend setting
      const settings = useSettingsStore()
      const backend = (settings.graphics.backendType || 'webgl2') as BackendType

      // Submit compilation request with backend selection
      const response = await submitCompilation({ files: preprocessedFiles, mainFile, backend })

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
