<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useAppStore } from './stores/app'
import { useSettingsStore } from './stores/settings'
import { useProjectStore } from './stores/project'
import { useTerminalStore } from './stores/terminal'
import { useSequencerStore } from './stores/sequencer'
import Toolbar from './components/Toolbar.vue'
import EditorPane from './components/EditorPane.vue'
import ViewerPane from './components/ViewerPane.vue'
import ConsolePanel from './components/ConsolePanel.vue'
import SequencerPanel from './components/SequencerPanel.vue'
import AssetLoadingTest from './components/AssetLoadingTest.vue'
import { defaultCode } from '@/utils/monaco-config'
import { isMultiFileExample, type AnyExample } from '@/data/examples'
import { wsService } from '@/services/websocket'
import type { AllolibRuntime } from '@/services/runtime'
import { parameterSystem } from '@/utils/parameter-system'
import {
  transpileToWeb,
  transpileToNative,
  formatForExport,
  detectCodeType,
  getTranspileSummary,
  type TranspileResult
} from '@/services/transpiler'
import JSZip from 'jszip'

const appStore = useAppStore()
const settingsStore = useSettingsStore()
const projectStore = useProjectStore()
const terminalStore = useTerminalStore()
const sequencerStore = useSequencerStore()
const editorRef = ref<InstanceType<typeof EditorPane>>()
const currentFileName = ref('main.cpp')

// Transpiler modal state
const showTranspileModal = ref(false)
const transpileResult = ref<TranspileResult | null>(null)
const transpileTarget = ref<'native' | 'web'>('native')
const pendingTranspiledCode = ref('')

// Computed console height style
const consoleHeightStyle = computed(() => ({
  height: `${settingsStore.display.consoleHeight}px`,
  minHeight: `${settingsStore.display.consoleHeight}px`,
}))

const handleRun = async () => {
  let files: Array<{ name: string; content: string }> = []
  let mainFile: string

  if (settingsStore.compiler.runMode === 'file') {
    // Run active file only
    const activeFile = projectStore.activeFile
    if (!activeFile) {
      appStore.log('[ERROR] No active file to compile')
      return
    }
    files = [{ name: activeFile.path, content: activeFile.content }]
    mainFile = activeFile.path
    appStore.log(`[INFO] Compiling single file: ${activeFile.path}`)
  } else {
    // Run project (all files)
    files = editorRef.value?.getFilesForCompilation() || []
    mainFile = projectStore.mainFilePath
    if (files.length === 0) {
      appStore.log('[ERROR] No files to compile')
      return
    }
    appStore.log(`[INFO] Compiling project (${files.length} files)`)
  }

  // Clear previous errors before compiling
  editorRef.value?.clearDiagnostics()
  await appStore.compile(files, mainFile)

  // If there are diagnostics (errors/warnings), show them in the editor
  if (appStore.diagnostics.length > 0) {
    editorRef.value?.setDiagnostics(appStore.diagnostics)
    editorRef.value?.jumpToFirstError(appStore.diagnostics)
  }
}

const handleStop = () => {
  appStore.stop()
}

const handleLoadExample = (code: string) => {
  editorRef.value?.setCode(code)
  appStore.log('[INFO] Example loaded')
}

// Example dialog handlers
const handleAddExampleToProject = (example: AnyExample) => {
  if (isMultiFileExample(example)) {
    // Add all files from multi-file example
    for (const file of example.files) {
      projectStore.addOrUpdateFile(file.path, file.content)
    }
    // Open the main file
    projectStore.setActiveFile(example.mainFile)
    // Force editor to show the new content
    const content = projectStore.getFileContent(example.mainFile)
    if (content) editorRef.value?.setCode(content)
    appStore.log(`[INFO] Added ${example.files.length} files to project: ${example.title}`)
  } else {
    // Single file - add with a unique name based on example id
    const fileName = `${example.id}.cpp`
    projectStore.addOrUpdateFile(fileName, example.code)
    projectStore.setActiveFile(fileName)
    // Force editor to show the new content
    editorRef.value?.setCode(example.code)
    appStore.log(`[INFO] Added "${example.title}" to project as ${fileName}`)
  }
}

const handleReplaceProjectWithExample = (example: AnyExample) => {
  // Clear existing project
  projectStore.newProject()

  if (isMultiFileExample(example)) {
    // Add all files from multi-file example
    for (const file of example.files) {
      projectStore.addOrUpdateFile(file.path, file.content)
    }
    // Open the main file
    projectStore.setActiveFile(example.mainFile)
    // Force editor to show the new content
    const content = projectStore.getFileContent(example.mainFile)
    if (content) editorRef.value?.setCode(content)
    appStore.log(`[INFO] Loaded multi-file example: ${example.title} (${example.files.length} files)`)
  } else {
    // Single file - replace main.cpp content directly
    projectStore.addOrUpdateFile('main.cpp', example.code)
    // Force editor to show the new content (active file is already main.cpp)
    editorRef.value?.setCode(example.code)
    appStore.log(`[INFO] Loaded example: ${example.title}`)
  }
}

// File menu handlers
const handleFileNew = () => {
  if (confirm('Create a new project? Unsaved changes will be lost.')) {
    editorRef.value?.newProject()
    currentFileName.value = 'main.cpp'
    appStore.log('[INFO] New project created')
  }
}

const handleFileSave = () => {
  const code = editorRef.value?.getCode() || ''
  localStorage.setItem('allolib-code', code)
  localStorage.setItem('allolib-filename', currentFileName.value)
  appStore.log(`[INFO] Saved to browser storage: ${currentFileName.value}`)
}

const handleFileSaveAs = () => {
  const name = prompt('Enter file name:', currentFileName.value)
  if (name) {
    currentFileName.value = name.endsWith('.cpp') ? name : `${name}.cpp`
    handleFileSave()
  }
}

const handleFileOpen = () => {
  const savedCode = localStorage.getItem('allolib-code')
  const savedName = localStorage.getItem('allolib-filename')
  if (savedCode) {
    editorRef.value?.setCode(savedCode)
    if (savedName) currentFileName.value = savedName
    appStore.log(`[INFO] Opened from browser storage: ${currentFileName.value}`)
  } else {
    appStore.log('[WARN] No saved file found in browser storage')
  }
}

const handleFileOpenFromDisk = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.cpp,.c,.h,.hpp'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const text = await file.text()
      editorRef.value?.setCode(text)
      currentFileName.value = file.name
      appStore.log(`[INFO] Opened file: ${file.name}`)
    }
  }
  input.click()
}

const handleFileExport = () => {
  const code = editorRef.value?.getCode() || ''
  const blob = new Blob([code], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = currentFileName.value
  a.click()
  URL.revokeObjectURL(url)
  appStore.log(`[INFO] Exported: ${currentFileName.value}`)
}

const handleFileExportZip = async () => {
  // Save arrangement state before export to ensure it's included
  sequencerStore.saveArrangement()

  const zip = new JSZip()
  const project = projectStore.project
  const projectName = project.name || 'allolib-project'

  // Add all project files to the zip
  for (const file of project.files) {
    zip.file(file.path, file.content)
  }

  // Generate zip and download
  try {
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName}.zip`
    a.click()
    URL.revokeObjectURL(url)
    appStore.log(`[INFO] Exported project as ZIP: ${projectName}.zip (${project.files.length} files)`)
  } catch (error) {
    appStore.log(`[ERROR] Failed to create ZIP: ${error}`)
  }
}

const handleConsoleResize = (height: number) => {
  settingsStore.display.consoleHeight = height
}

const handleAnalysisResize = (height: number) => {
  settingsStore.display.analysisPanelHeight = height
}

const handleSequencerResize = (height: number) => {
  settingsStore.display.sequencerHeight = height
}

const sequencerHeightStyle = computed(() => ({
  height: `${settingsStore.display.sequencerHeight}px`,
  minHeight: `${settingsStore.display.sequencerHeight}px`,
}))

// Transpiler handlers
const handleImportNative = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.cpp,.c,.h,.hpp'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const text = await file.text()
      const codeType = detectCodeType(text)

      if (codeType === 'web') {
        // Already web code, just load it
        editorRef.value?.setCode(text)
        currentFileName.value = file.name
        appStore.log(`[INFO] Loaded web code: ${file.name}`)
      } else {
        // Native code - transpile to web
        const result = transpileToWeb(text)
        transpileResult.value = result
        transpileTarget.value = 'web'
        pendingTranspiledCode.value = result.code

        if (result.warnings.length > 0 || result.errors.length > 0) {
          // Show modal with warnings/errors
          showTranspileModal.value = true
        } else {
          // No issues, apply directly
          editorRef.value?.setCode(result.code)
          currentFileName.value = file.name.replace(/\.cpp$/, '_web.cpp')
          appStore.log(`[INFO] Imported and converted to web: ${file.name}`)
        }
      }
    }
  }
  input.click()
}

const handleExportNative = () => {
  const code = editorRef.value?.getCode() || ''
  const codeType = detectCodeType(code)

  if (codeType === 'native') {
    // Already native code, just export
    const formatted = formatForExport(code, 'native')
    downloadCode(formatted, currentFileName.value.replace(/_web\.cpp$/, '.cpp'))
    appStore.log('[INFO] Exported native AlloLib code')
  } else {
    // Web code - transpile to native
    const result = transpileToNative(code)
    transpileResult.value = result
    transpileTarget.value = 'native'
    pendingTranspiledCode.value = formatForExport(result.code, 'native')

    if (result.warnings.length > 0 || result.errors.length > 0) {
      // Show modal with warnings/errors
      showTranspileModal.value = true
    } else {
      // No issues, download directly
      downloadCode(pendingTranspiledCode.value, currentFileName.value.replace(/_web\.cpp$/, '.cpp').replace(/\.cpp$/, '_native.cpp'))
      appStore.log('[INFO] Exported as native AlloLib code')
    }
  }
}

const downloadCode = (code: string, filename: string) => {
  const blob = new Blob([code], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const applyTranspile = () => {
  if (transpileTarget.value === 'web') {
    // Import: apply code to editor
    editorRef.value?.setCode(pendingTranspiledCode.value)
    appStore.log('[INFO] Applied transpiled web code')
  } else {
    // Export: download the code
    downloadCode(pendingTranspiledCode.value, currentFileName.value.replace(/_web\.cpp$/, '.cpp').replace(/\.cpp$/, '_native.cpp'))
    appStore.log('[INFO] Exported as native AlloLib code')
  }
  showTranspileModal.value = false
}

const cancelTranspile = () => {
  showTranspileModal.value = false
  transpileResult.value = null
  pendingTranspiledCode.value = ''
}

const handleClearConsole = () => {
  appStore.clearConsole()
}

// Runtime started handler - connects runtime to sequencer for voice triggering
const handleRuntimeStarted = (runtime: AllolibRuntime) => {
  appStore.setRunning()
  sequencerStore.connectRuntime(runtime)
}

// Auto-detect synth classes when compilation succeeds
watch(() => appStore.status, (newStatus) => {
  if (newStatus === 'running') {
    const sourceFiles = projectStore.project.files
      .filter(f => /\.(cpp|hpp|h)$/i.test(f.path))
      .map(f => ({ name: f.path, content: f.content }))
    sequencerStore.updateDetectedSynths(sourceFiles)

    // NOTE: We no longer populate parameter system from source detection.
    // The WASM now properly reports only ControlGUI parameters (the app's
    // user-facing params), not the voice trigger parameters (which are for
    // sequencing). Source detection was adding duplicates.
  }
})

// WebSocket setup for real-time compile streaming
function onCompileOutput(payload: Record<string, unknown>) {
  const line = payload.line as string
  if (line) {
    terminalStore.writeCompilationOutput(line)
  }
}

// Handle compile triggered from terminal
function onTerminalCompile() {
  handleRun()
}

onMounted(() => {
  wsService.connect()
  wsService.on('compile:output', onCompileOutput)
  window.addEventListener('terminal:compile', onTerminalCompile)
})

onBeforeUnmount(() => {
  wsService.off('compile:output', onCompileOutput)
  wsService.disconnect()
  window.removeEventListener('terminal:compile', onTerminalCompile)
})

// Mirror console output to the terminal
let lastConsoleLength = 0
watch(() => appStore.consoleOutput.length, (newLen) => {
  for (let i = lastConsoleLength; i < newLen; i++) {
    terminalStore.writeCompilationOutput(appStore.consoleOutput[i])
  }
  lastConsoleLength = newLen
})
</script>

<template>
  <div class="h-screen flex flex-col bg-editor-bg">
    <!-- Toolbar -->
    <Toolbar
      :status="appStore.status"
      @run="handleRun"
      @stop="handleStop"
      @load-example="handleLoadExample"
      @add-example-to-project="handleAddExampleToProject"
      @replace-project-with-example="handleReplaceProjectWithExample"
      @file-new="handleFileNew"
      @file-save="handleFileSave"
      @file-save-as="handleFileSaveAs"
      @file-open="handleFileOpen"
      @file-open-from-disk="handleFileOpenFromDisk"
      @file-export="handleFileExport"
      @file-export-zip="handleFileExportZip"
      @import-native="handleImportNative"
      @export-native="handleExportNative"
    />

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Pane: Editor + Console (hidden in studio focus mode) -->
      <div
        v-show="!settingsStore.display.studioFocus"
        class="w-1/2 flex flex-col border-r border-editor-border overflow-hidden"
      >
        <EditorPane ref="editorRef" class="flex-1 min-h-0" />
        <ConsolePanel
          :output="appStore.consoleOutput"
          :style="consoleHeightStyle"
          class="shrink-0"
          @resize="handleConsoleResize"
          @clear="handleClearConsole"
        />
      </div>

      <!-- Right Pane: Viewer (full width in studio focus mode) -->
      <div :class="settingsStore.display.studioFocus ? 'w-full' : 'w-1/2'">
        <ViewerPane
          :status="appStore.status"
          :js-url="appStore.jsUrl"
          :show-analysis-panel="settingsStore.display.showAnalysisPanel"
          :panel-height="settingsStore.display.analysisPanelHeight"
          @started="handleRuntimeStarted"
          @error="appStore.setError"
          @log="appStore.log"
          @analysis-resize="handleAnalysisResize"
        />
      </div>
    </div>

    <!-- Sequencer Panel -->
    <SequencerPanel
      v-if="settingsStore.display.showSequencer"
      :height="settingsStore.display.sequencerHeight"
      :style="sequencerHeightStyle"
      class="shrink-0"
      @resize="handleSequencerResize"
    />

    <!-- Transpile Modal -->
    <div v-if="showTranspileModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-editor-bg border border-editor-border rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div class="px-4 py-3 border-b border-editor-border">
          <h3 class="text-white font-medium">
            {{ transpileTarget === 'web' ? 'Import Native AlloLib Code' : 'Export for Desktop AlloLib' }}
          </h3>
        </div>

        <div class="p-4 max-h-80 overflow-y-auto">
          <!-- Errors -->
          <div v-if="transpileResult?.errors?.length" class="mb-4">
            <h4 class="text-red-400 font-medium mb-2 flex items-center gap-2">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              Errors
            </h4>
            <ul class="text-sm text-red-300 space-y-1">
              <li v-for="(error, i) in transpileResult.errors" :key="i" class="bg-red-900/30 px-3 py-2 rounded">
                {{ error }}
              </li>
            </ul>
          </div>

          <!-- Warnings -->
          <div v-if="transpileResult?.warnings?.length" class="mb-4">
            <h4 class="text-yellow-400 font-medium mb-2 flex items-center gap-2">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              Warnings
            </h4>
            <ul class="text-sm text-yellow-300 space-y-1">
              <li v-for="(warning, i) in transpileResult.warnings" :key="i" class="bg-yellow-900/30 px-3 py-2 rounded">
                {{ warning }}
              </li>
            </ul>
          </div>

          <!-- Info message -->
          <p class="text-gray-400 text-sm">
            <template v-if="transpileTarget === 'web'">
              The code has been converted to AlloLib Online format. Review the warnings above before applying.
            </template>
            <template v-else>
              The code has been converted to native AlloLib format. Review the warnings above before downloading.
            </template>
          </p>
        </div>

        <div class="px-4 py-3 border-t border-editor-border flex justify-end gap-2">
          <button
            @click="cancelTranspile"
            class="px-4 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded"
          >
            Cancel
          </button>
          <button
            @click="applyTranspile"
            class="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
            :disabled="transpileResult?.errors?.length"
            :class="{ 'opacity-50 cursor-not-allowed': transpileResult?.errors?.length }"
          >
            {{ transpileTarget === 'web' ? 'Apply Code' : 'Download' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Asset Loading Test Panel (for development) -->
    <AssetLoadingTest />
  </div>
</template>
