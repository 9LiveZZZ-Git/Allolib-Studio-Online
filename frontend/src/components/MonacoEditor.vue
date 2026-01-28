<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as monaco from 'monaco-editor'
import { configureMonaco, defaultCode } from '@/utils/monaco-config'
import { useSettingsStore } from '@/stores/settings'
import {
  type CompilerDiagnostic,
  setEditorDiagnostics,
  clearEditorDiagnostics,
  jumpToFirstError,
} from '@/utils/error-parser'

// Import Monaco workers using Vite's ?worker syntax
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

// Initialize Monaco workers
self.MonacoEnvironment = {
  getWorker: function (_moduleId: string, _label: string) {
    // For C++ editing, we only need the basic editor worker
    // No need for language-specific workers (JSON, TS, etc.)
    return new editorWorker()
  },
}

const props = defineProps<{
  modelValue?: string
}>()

const settings = useSettingsStore()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
}>()

const editorContainer = ref<HTMLDivElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  if (!editorContainer.value) return

  // Configure Monaco with AlloLib settings
  configureMonaco()

  // Create editor instance with settings from store
  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue || defaultCode,
    language: 'cpp',
    theme: settings.editor.theme,
    automaticLayout: true,
    fontSize: settings.editor.fontSize,
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    fontLigatures: true,
    minimap: {
      enabled: settings.editor.minimap,
      scale: 1,
    },
    scrollBeyondLastLine: false,
    wordWrap: settings.editor.wordWrap,
    tabSize: settings.editor.tabSize,
    insertSpaces: true,
    renderWhitespace: 'selection',
    lineNumbers: settings.editor.lineNumbers,
    glyphMargin: true,
    folding: true,
    bracketPairColorization: {
      enabled: true,
    },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    snippetSuggestions: 'top',
  })

  // Emit changes
  editor.onDidChangeModelContent(() => {
    const value = editor?.getValue() || ''
    emit('update:modelValue', value)
  })

  // Handle Ctrl+S
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    emit('save')
  })

  // Handle window resize
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  editor?.dispose()
})

// Update editor when prop changes externally
watch(() => props.modelValue, (newValue) => {
  if (editor && newValue !== undefined && editor.getValue() !== newValue) {
    editor.setValue(newValue)
  }
})

// Watch for settings changes and update editor options
watch(() => settings.editor, (newSettings) => {
  if (editor) {
    editor.updateOptions({
      fontSize: newSettings.fontSize,
      tabSize: newSettings.tabSize,
      wordWrap: newSettings.wordWrap,
      minimap: { enabled: newSettings.minimap },
      lineNumbers: newSettings.lineNumbers,
    })
    // Theme requires special handling
    monaco.editor.setTheme(newSettings.theme)
  }
}, { deep: true })

function handleResize() {
  editor?.layout()
}

// Expose methods for parent components
defineExpose({
  getValue: () => editor?.getValue() || '',
  setValue: (value: string) => editor?.setValue(value),
  focus: () => editor?.focus(),
  layout: () => editor?.layout(),
  // Editor actions
  undo: () => editor?.trigger('keyboard', 'undo', null),
  redo: () => editor?.trigger('keyboard', 'redo', null),
  format: () => editor?.getAction('editor.action.formatDocument')?.run(),
  openFind: () => editor?.getAction('actions.find')?.run(),
  openReplace: () => editor?.getAction('editor.action.startFindReplaceAction')?.run(),
  openGoToLine: () => editor?.getAction('editor.action.gotoLine')?.run(),
  openCommandPalette: () => editor?.getAction('editor.action.quickCommand')?.run(),
  // Diagnostics (error highlighting)
  setDiagnostics: (diagnostics: CompilerDiagnostic[]) => setEditorDiagnostics(editor, diagnostics),
  clearDiagnostics: () => clearEditorDiagnostics(editor),
  jumpToFirstError: (diagnostics: CompilerDiagnostic[]) => jumpToFirstError(editor, diagnostics),
  getEditor: () => editor,
})
</script>

<template>
  <div class="h-full w-full" ref="editorContainer"></div>
</template>
