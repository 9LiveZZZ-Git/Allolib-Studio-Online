<script setup lang="ts">
import { ref } from 'vue'
import MonacoEditor from './MonacoEditor.vue'
import { defaultCode } from '@/utils/monaco-config'

const code = ref(defaultCode)
const editorRef = ref<InstanceType<typeof MonacoEditor>>()

const handleSave = () => {
  // Save to local storage for now
  localStorage.setItem('allolib-code', code.value)
  console.log('[INFO] Code saved')
}

// Expose editor ref for parent
defineExpose({
  getCode: () => code.value,
  setCode: (value: string) => {
    code.value = value
    editorRef.value?.setValue(value)
  },
})
</script>

<template>
  <div class="h-full flex flex-col bg-editor-bg">
    <div class="h-8 bg-editor-sidebar border-b border-editor-border flex items-center px-3 justify-between">
      <span class="text-sm text-gray-400">main.cpp</span>
      <span class="text-xs text-gray-500">C++17 • UTF-8</span>
    </div>
    <div class="flex-1 overflow-hidden">
      <MonacoEditor
        ref="editorRef"
        v-model="code"
        @save="handleSave"
      />
    </div>
  </div>
</template>
