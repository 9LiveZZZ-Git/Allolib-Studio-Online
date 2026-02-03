<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/70" @click="close"></div>

      <!-- Dialog -->
      <div class="relative bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl w-[480px] max-h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
          <h2 class="text-lg font-semibold text-white">Import Project</h2>
          <button @click="close" class="text-gray-400 hover:text-white">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-4 space-y-4 overflow-y-auto">
          <!-- Drop Zone -->
          <div
            @dragover.prevent="isDragging = true"
            @dragleave="isDragging = false"
            @drop.prevent="handleDrop"
            :class="[
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              isDragging ? 'border-[#007acc] bg-[#007acc]/10' : 'border-[#3c3c3c]'
            ]"
          >
            <div v-if="!selectedFile">
              <svg class="w-12 h-12 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p class="text-gray-400 mb-2">Drag and drop a .allolib file here</p>
              <p class="text-gray-500 text-sm mb-4">or</p>
              <label class="inline-block px-4 py-2 text-sm bg-[#2d2d2d] text-white rounded cursor-pointer hover:bg-[#3c3c3c]">
                Browse Files
                <input
                  type="file"
                  accept=".allolib"
                  class="hidden"
                  @change="handleFileSelect"
                />
              </label>
            </div>
            <div v-else class="text-left">
              <div class="flex items-center">
                <svg class="w-8 h-8 text-[#007acc] mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                </svg>
                <div>
                  <p class="text-white font-medium">{{ selectedFile.name }}</p>
                  <p class="text-gray-500 text-sm">{{ formatFileSize(selectedFile.size) }}</p>
                </div>
                <button @click="clearFile" class="ml-auto text-gray-400 hover:text-white">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Warning -->
          <div class="bg-yellow-900/30 border border-yellow-700/50 rounded p-3 text-sm text-yellow-200">
            <strong>Warning:</strong> Importing will replace your current project. Make sure to export first if you want to keep your work.
          </div>

          <!-- Error -->
          <div v-if="error" class="bg-red-900/30 border border-red-700/50 rounded p-3 text-sm text-red-200">
            {{ error }}
          </div>

          <!-- Loading -->
          <div v-if="isLoading" class="flex items-center justify-center py-4">
            <svg class="animate-spin w-6 h-6 text-[#007acc]" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="ml-2 text-gray-300">Importing...</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-[#3c3c3c]">
          <button
            @click="close"
            class="px-4 py-2 text-sm text-gray-300 hover:text-white"
            :disabled="isLoading"
          >
            Cancel
          </button>
          <button
            @click="handleImport"
            :disabled="!selectedFile || isLoading"
            :class="[
              'px-4 py-2 text-sm rounded',
              selectedFile && !isLoading
                ? 'bg-[#007acc] text-white hover:bg-[#005a9e]'
                : 'bg-[#3c3c3c] text-gray-500 cursor-not-allowed'
            ]"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { importProjectFile } from '@/services/unifiedProject'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'imported'): void
}>()

const isDragging = ref(false)
const selectedFile = ref<File | null>(null)
const isLoading = ref(false)
const error = ref('')

function close() {
  if (!isLoading.value) {
    selectedFile.value = null
    error.value = ''
    emit('update:modelValue', false)
  }
}

function clearFile() {
  selectedFile.value = null
  error.value = ''
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    selectFile(input.files[0])
  }
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    selectFile(event.dataTransfer.files[0])
  }
}

function selectFile(file: File) {
  error.value = ''
  if (!file.name.endsWith('.allolib')) {
    error.value = 'Please select a .allolib file'
    return
  }
  selectedFile.value = file
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function handleImport() {
  if (!selectedFile.value) return

  isLoading.value = true
  error.value = ''

  try {
    await importProjectFile(selectedFile.value)
    emit('imported')
    close()
    // Reload to ensure all components reflect new state
    window.location.reload()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to import project'
  } finally {
    isLoading.value = false
  }
}
</script>
