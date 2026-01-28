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
    return new editorWorker()
  },
}

const props = defineProps<{
  modelValue?: string
  filename?: string
}>()

const settings = useSettingsStore()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
}>()

const editorContainer = ref<HTMLDivElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

// Multi-model support
const models = new Map<string, monaco.editor.ITextModel>()
const viewStates = new Map<string, monaco.editor.ICodeEditorViewState | null>()
let currentFilename = ref<string>('main.cpp')

function getLanguageForFile(filename: string): string {
  // All C/C++ files use 'cpp' language
  return 'cpp'
}

function getOrCreateModel(filename: string, content: string): monaco.editor.ITextModel {
  let model = models.get(filename)
  if (!model || model.isDisposed()) {
    const uri = monaco.Uri.parse(`file:///${filename}`)
    // Check if a model with this URI already exists
    const existingModel = monaco.editor.getModel(uri)
    if (existingModel) {
      model = existingModel
      if (model.getValue() !== content) {
        model.setValue(content)
      }
    } else {
      model = monaco.editor.createModel(content, getLanguageForFile(filename), uri)
    }
    models.set(filename, model)
  }
  return model
}

function switchToFile(filename: string, content: string) {
  if (!editor) return

  // Save current view state
  if (currentFilename.value) {
    viewStates.set(currentFilename.value, editor.saveViewState())
  }

  // Get or create model for new file
  const model = getOrCreateModel(filename, content)

  // Set model on editor
  editor.setModel(model)
  currentFilename.value = filename

  // Restore view state if we have one
  const savedState = viewStates.get(filename)
  if (savedState) {
    editor.restoreViewState(savedState)
  }

  // Focus the editor
  editor.focus()
}

function updateModelContent(filename: string, content: string) {
  const model = models.get(filename)
  if (model && !model.isDisposed() && model.getValue() !== content) {
    model.setValue(content)
  }
}

function disposeModel(filename: string) {
  const model = models.get(filename)
  if (model && !model.isDisposed()) {
    model.dispose()
  }
  models.delete(filename)
  viewStates.delete(filename)
}

function disposeAllModels() {
  models.forEach((model) => {
    if (!model.isDisposed()) {
      model.dispose()
    }
  })
  models.clear()
  viewStates.clear()
}

onMounted(() => {
  if (!editorContainer.value) return

  // Configure Monaco with AlloLib settings
  configureMonaco()

  const initialFilename = props.filename || 'main.cpp'
  const initialContent = props.modelValue || defaultCode
  currentFilename.value = initialFilename

  // Create initial model
  const model = getOrCreateModel(initialFilename, initialContent)

  // Create editor instance with settings from store
  editor = monaco.editor.create(editorContainer.value, {
    model,
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
  disposeAllModels()
  editor?.dispose()
})

// Update editor when prop changes externally (for single-file compatibility)
watch(() => props.modelValue, (newValue) => {
  if (editor && newValue !== undefined && editor.getValue() !== newValue) {
    const model = editor.getModel()
    if (model) {
      model.setValue(newValue)
    }
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
  // Basic value access
  getValue: () => editor?.getValue() || '',
  setValue: (value: string) => {
    const model = editor?.getModel()
    if (model) {
      model.setValue(value)
    }
  },
  focus: () => editor?.focus(),
  layout: () => editor?.layout(),

  // Multi-file support
  switchToFile,
  updateModelContent,
  disposeModel,
  getCurrentFilename: () => currentFilename.value,

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
