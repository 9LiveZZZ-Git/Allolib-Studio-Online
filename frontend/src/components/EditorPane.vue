<script setup lang="ts">
import { ref } from 'vue'
import MonacoEditor from './MonacoEditor.vue'
import { defaultCode } from '@/utils/monaco-config'

const code = ref(defaultCode)
const editorRef = ref<InstanceType<typeof MonacoEditor>>()

const emit = defineEmits<{
  save: []
}>()

const handleSave = () => {
  emit('save')
}

// Editor action handlers
const handleFormat = () => {
  editorRef.value?.format()
}

const handleUndo = () => {
  editorRef.value?.undo()
}

const handleRedo = () => {
  editorRef.value?.redo()
}

const handleFind = () => {
  editorRef.value?.openFind()
}

const handleReplace = () => {
  editorRef.value?.openReplace()
}

const handleGoToLine = () => {
  editorRef.value?.openGoToLine()
}

// Expose editor ref for parent
defineExpose({
  getCode: () => code.value,
  setCode: (value: string) => {
    code.value = value
    editorRef.value?.setValue(value)
  },
  format: handleFormat,
  undo: handleUndo,
  redo: handleRedo,
  find: handleFind,
  replace: handleReplace,
  goToLine: handleGoToLine,
})
</script>

<template>
  <div class="flex flex-col bg-editor-bg h-full min-h-0">
    <!-- Editor Header -->
    <div class="h-8 bg-editor-sidebar border-b border-editor-border flex items-center px-3 justify-between">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-allolib-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        <span class="text-sm text-gray-400">main.cpp</span>
      </div>
      <div class="flex items-center gap-1">
        <!-- Editor toolbar buttons -->
        <button
          @click="handleUndo"
          class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
          title="Undo (Ctrl+Z)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          @click="handleRedo"
          class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
          title="Redo (Ctrl+Y)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>
        <div class="w-px h-4 bg-editor-border mx-1"></div>
        <button
          @click="handleFind"
          class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
          title="Find (Ctrl+F)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        <button
          @click="handleReplace"
          class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
          title="Replace (Ctrl+H)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>
        <button
          @click="handleGoToLine"
          class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
          title="Go to Line (Ctrl+G)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        </button>
        <div class="w-px h-4 bg-editor-border mx-1"></div>
        <button
          @click="handleFormat"
          class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
          title="Format Document (Shift+Alt+F)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </button>
        <div class="w-px h-4 bg-editor-border mx-1"></div>
        <span class="text-xs text-gray-500">C++17</span>
      </div>
    </div>
    <div class="flex-1 min-h-0 overflow-hidden">
      <MonacoEditor
        ref="editorRef"
        v-model="code"
        @save="handleSave"
      />
    </div>
  </div>
</template>
