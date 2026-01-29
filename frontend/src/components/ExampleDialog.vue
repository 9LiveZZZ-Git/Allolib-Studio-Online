<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Example, MultiFileExample } from '@/data/examples'

const props = defineProps<{
  example: Example | MultiFileExample | null
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  addToProject: [example: Example | MultiFileExample]
  replaceProject: [example: Example | MultiFileExample]
}>()

// Check if this is a multi-file example
const isMultiFile = computed(() => {
  if (!props.example) return false
  return 'files' in props.example
})

const fileCount = computed(() => {
  if (!props.example) return 0
  if ('files' in props.example) {
    return props.example.files.length
  }
  return 1
})

const fileList = computed(() => {
  if (!props.example) return []
  if ('files' in props.example) {
    return props.example.files.map(f => f.path)
  }
  return ['main.cpp']
})

function handleAddToProject() {
  if (props.example) {
    emit('addToProject', props.example)
  }
}

function handleReplaceProject() {
  if (props.example) {
    emit('replaceProject', props.example)
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && example"
      class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      @click.self="handleClose"
    >
      <div class="bg-editor-bg border border-editor-border rounded-lg shadow-2xl w-[480px] max-w-[95vw]">
        <!-- Header -->
        <div class="px-4 py-3 border-b border-editor-border">
          <h2 class="text-lg font-semibold text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-allolib-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Load Example
          </h2>
        </div>

        <!-- Content -->
        <div class="p-4 space-y-4">
          <!-- Example Info -->
          <div class="bg-editor-sidebar rounded-lg p-3">
            <div class="text-allolib-blue font-medium">{{ example.title }}</div>
            <div class="text-sm text-gray-400 mt-1">{{ example.description }}</div>

            <!-- File list for multi-file examples -->
            <div v-if="isMultiFile" class="mt-3 pt-3 border-t border-editor-border">
              <div class="text-xs text-gray-500 mb-2">
                This example contains {{ fileCount }} files:
              </div>
              <div class="space-y-1">
                <div
                  v-for="file in fileList"
                  :key="file"
                  class="text-xs font-mono text-gray-300 flex items-center gap-2"
                >
                  <svg class="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {{ file }}
                </div>
              </div>
            </div>
          </div>

          <!-- Question -->
          <div class="text-sm text-gray-300">
            How would you like to load this example?
          </div>

          <!-- Options -->
          <div class="space-y-2">
            <!-- Add to Project -->
            <button
              @click="handleAddToProject"
              class="w-full p-3 rounded-lg border border-editor-border hover:border-allolib-blue hover:bg-editor-active transition-colors text-left group"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center group-hover:bg-green-600/30 transition-colors">
                  <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <div class="font-medium text-white">Add to Project</div>
                  <div class="text-xs text-gray-500">
                    {{ isMultiFile ? 'Add all example files to your current project' : 'Add example file to your current project' }}
                  </div>
                </div>
              </div>
            </button>

            <!-- Replace Project -->
            <button
              @click="handleReplaceProject"
              class="w-full p-3 rounded-lg border border-editor-border hover:border-allolib-blue hover:bg-editor-active transition-colors text-left group"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                  <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <div class="font-medium text-white">Replace Project</div>
                  <div class="text-xs text-gray-500">
                    Start fresh with only this example
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-4 py-3 border-t border-editor-border flex justify-end">
          <button
            @click="handleClose"
            class="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
