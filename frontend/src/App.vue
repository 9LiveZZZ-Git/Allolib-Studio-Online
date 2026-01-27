<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from './stores/app'
import { useSettingsStore } from './stores/settings'
import Toolbar from './components/Toolbar.vue'
import EditorPane from './components/EditorPane.vue'
import ViewerPane from './components/ViewerPane.vue'
import Console from './components/Console.vue'
import { defaultCode } from '@/utils/monaco-config'

const appStore = useAppStore()
const settingsStore = useSettingsStore()
const editorRef = ref<InstanceType<typeof EditorPane>>()
const currentFileName = ref('main.cpp')

// Computed panel height style
const panelHeightStyle = computed(() => ({
  height: `${settingsStore.display.panelHeight}px`,
  minHeight: `${settingsStore.display.panelHeight}px`,
}))

const handleRun = async () => {
  const code = editorRef.value?.getCode() || ''
  await appStore.compile(code)
}

const handleStop = () => {
  appStore.stop()
}

const handleLoadExample = (code: string) => {
  editorRef.value?.setCode(code)
  appStore.log('[INFO] Example loaded')
}

// File menu handlers
const handleFileNew = () => {
  if (confirm('Create a new file? Unsaved changes will be lost.')) {
    editorRef.value?.setCode(defaultCode)
    currentFileName.value = 'main.cpp'
    appStore.log('[INFO] New file created')
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
</script>

<template>
  <div class="h-screen flex flex-col bg-editor-bg">
    <!-- Toolbar -->
    <Toolbar
      :status="appStore.status"
      @run="handleRun"
      @stop="handleStop"
      @load-example="handleLoadExample"
      @file-new="handleFileNew"
      @file-save="handleFileSave"
      @file-save-as="handleFileSaveAs"
      @file-open="handleFileOpen"
      @file-open-from-disk="handleFileOpenFromDisk"
      @file-export="handleFileExport"
    />

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Pane: Editor + Console -->
      <div class="w-1/2 flex flex-col border-r border-editor-border">
        <EditorPane ref="editorRef" class="flex-1" />
        <Console
          :output="appStore.consoleOutput"
          :style="panelHeightStyle"
          class="shrink-0"
        />
      </div>

      <!-- Right Pane: Viewer -->
      <div class="w-1/2">
        <ViewerPane
          :status="appStore.status"
          :js-url="appStore.jsUrl"
          :show-analysis-panel="settingsStore.display.showAnalysisPanel"
          :panel-height="settingsStore.display.panelHeight"
          @started="appStore.setRunning"
          @error="appStore.setError"
          @log="appStore.log"
        />
      </div>
    </div>
  </div>
</template>
