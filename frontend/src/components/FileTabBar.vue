<script setup lang="ts">
import { computed } from 'vue'
import type { ProjectFile } from '@/stores/project'

const props = defineProps<{
  files: ProjectFile[]
  activeFile: string
}>()

const emit = defineEmits<{
  selectFile: [path: string]
  newFile: []
  closeFile: [path: string]
}>()

const sortedFiles = computed(() => {
  // Keep main.cpp first, then sort alphabetically by path
  return [...props.files].sort((a, b) => {
    if (a.isMain) return -1
    if (b.isMain) return 1
    return a.path.localeCompare(b.path)
  })
})

function getFileIcon(filename: string): string {
  if (filename.endsWith('.hpp') || filename.endsWith('.h')) {
    return 'H' // Header
  }
  return 'C' // C++ source
}

function getFileIconColor(filename: string): string {
  if (filename.endsWith('.hpp') || filename.endsWith('.h')) {
    return 'text-allolib-purple' // Purple for headers
  }
  return 'text-allolib-blue' // Blue for source
}
</script>

<template>
  <div class="h-9 flex items-center bg-editor-sidebar border-b border-editor-border">
    <!-- Add File Button -->
    <button
      @click="emit('newFile')"
      class="px-3 h-full hover:bg-editor-active text-gray-400 hover:text-white transition-colors flex items-center gap-1"
      title="New File (Ctrl+N)"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
    </button>

    <!-- Separator -->
    <div class="w-px h-5 bg-editor-border"></div>

    <!-- File Tabs (scrollable) -->
    <div class="flex-1 flex overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
      <button
        v-for="file in sortedFiles"
        :key="file.path"
        @click="emit('selectFile', file.path)"
        :class="[
          'px-3 py-1.5 text-sm flex items-center gap-2 border-r border-editor-border',
          'hover:bg-editor-active transition-colors whitespace-nowrap group relative',
          file.path === activeFile
            ? 'bg-editor-bg text-white'
            : 'text-gray-400 hover:text-gray-200'
        ]"
        :title="file.path"
      >
        <!-- Active indicator -->
        <div
          v-if="file.path === activeFile"
          class="absolute top-0 left-0 right-0 h-0.5 bg-allolib-blue"
        ></div>

        <!-- File Icon -->
        <span :class="['text-xs font-bold', getFileIconColor(file.name)]">
          {{ getFileIcon(file.name) }}
        </span>

        <!-- Filename (show just the name, full path in tooltip) -->
        <span>{{ file.name }}</span>

        <!-- Dirty indicator -->
        <span v-if="file.isDirty" class="text-yellow-400 text-xs">●</span>

        <!-- Close Button (not on main.cpp) -->
        <button
          v-if="!file.isMain"
          @click.stop="emit('closeFile', file.path)"
          class="ml-1 p-0.5 hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Close file"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Spacer for main.cpp to align with closeable tabs -->
        <span v-if="file.isMain" class="w-4"></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for horizontal scroll */
.scrollbar-thin::-webkit-scrollbar {
  height: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 2px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>
