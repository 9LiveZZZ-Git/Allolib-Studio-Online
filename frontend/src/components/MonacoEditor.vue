<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as monaco from 'monaco-editor'
import { configureMonaco, defaultCode } from '@/utils/monaco-config'

// Initialize Monaco workers
self.MonacoEnvironment = {
  getWorker: function (_moduleId: string, label: string) {
    const getWorkerModule = (moduleUrl: string) => {
      return new Worker(
        new URL(moduleUrl, import.meta.url),
        { type: 'module' }
      )
    }

    switch (label) {
      case 'json':
        return getWorkerModule('monaco-editor/esm/vs/language/json/json.worker.js')
      case 'css':
      case 'scss':
      case 'less':
        return getWorkerModule('monaco-editor/esm/vs/language/css/css.worker.js')
      case 'html':
      case 'handlebars':
      case 'razor':
        return getWorkerModule('monaco-editor/esm/vs/language/html/html.worker.js')
      case 'typescript':
      case 'javascript':
        return getWorkerModule('monaco-editor/esm/vs/language/typescript/ts.worker.js')
      default:
        return getWorkerModule('monaco-editor/esm/vs/editor/editor.worker.js')
    }
  },
}

const props = defineProps<{
  modelValue?: string
}>()

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

  // Create editor instance
  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue || defaultCode,
    language: 'cpp',
    theme: 'allolib-dark',
    automaticLayout: true,
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
    fontLigatures: true,
    minimap: {
      enabled: true,
      scale: 1,
    },
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    tabSize: 2,
    insertSpaces: true,
    renderWhitespace: 'selection',
    lineNumbers: 'on',
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

function handleResize() {
  editor?.layout()
}

// Expose methods for parent components
defineExpose({
  getValue: () => editor?.getValue() || '',
  setValue: (value: string) => editor?.setValue(value),
  focus: () => editor?.focus(),
  layout: () => editor?.layout(),
})
</script>

<template>
  <div class="h-full w-full" ref="editorContainer"></div>
</template>
