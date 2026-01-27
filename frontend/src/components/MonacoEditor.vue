<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as monaco from 'monaco-editor'
import { configureMonaco, defaultCode } from '@/utils/monaco-config'

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
