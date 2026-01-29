<script setup lang="ts">
import { ref, onBeforeUnmount, nextTick } from 'vue'
import Console from './Console.vue'
import XTerminal from './XTerminal.vue'
import TerminalReference from './TerminalReference.vue'

defineProps<{
  output: string[]
}>()

const emit = defineEmits<{
  resize: [height: number]
  clear: []
}>()

const activeTab = ref<'output' | 'terminal' | 'reference'>('output')
const xtermRef = ref<InstanceType<typeof XTerminal>>()

// Resize state
const isResizing = ref(false)
const startY = ref(0)
const startHeight = ref(0)
const containerRef = ref<HTMLDivElement>()

function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  startY.value = e.clientY
  startHeight.value = containerRef.value?.offsetHeight || 200

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(e: MouseEvent) {
  if (!isResizing.value) return

  const delta = startY.value - e.clientY
  const newHeight = Math.max(100, Math.min(600, startHeight.value + delta))
  emit('resize', newHeight)
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function switchTab(tab: 'output' | 'terminal' | 'reference') {
  activeTab.value = tab
  if (tab === 'terminal') {
    // Re-fit xterm after tab switch (DOM needs to update first)
    nextTick(() => {
      xtermRef.value?.fit()
    })
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<template>
  <div ref="containerRef" class="flex flex-col bg-editor-bg border-t border-editor-border">
    <!-- Resize Handle -->
    <div
      class="h-1 bg-editor-border hover:bg-allolib-blue cursor-ns-resize transition-colors group flex items-center justify-center"
      @mousedown="startResize"
      :class="{ 'bg-allolib-blue': isResizing }"
    >
      <div class="w-12 h-0.5 bg-gray-600 group-hover:bg-white rounded-full transition-colors" :class="{ 'bg-white': isResizing }"></div>
    </div>

    <!-- Header with tabs -->
    <div class="h-8 bg-editor-sidebar border-b border-editor-border flex items-center justify-between px-3 shrink-0">
      <div class="flex items-center gap-1">
        <button
          @click="switchTab('output')"
          :class="[
            'px-2 py-0.5 text-xs rounded transition-colors',
            activeTab === 'output'
              ? 'bg-allolib-blue text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          ]"
        >
          Output
        </button>
        <button
          @click="switchTab('terminal')"
          :class="[
            'px-2 py-0.5 text-xs rounded transition-colors',
            activeTab === 'terminal'
              ? 'bg-allolib-blue text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          ]"
        >
          Terminal
        </button>
        <button
          @click="switchTab('reference')"
          :class="[
            'px-2 py-0.5 text-xs rounded transition-colors',
            activeTab === 'reference'
              ? 'bg-allolib-blue text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          ]"
        >
          Reference
        </button>
      </div>

      <!-- Clear button -->
      <button
        v-if="activeTab === 'output'"
        @click="emit('clear')"
        class="text-gray-500 hover:text-gray-300 transition-colors"
        title="Clear console"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 overflow-hidden">
      <!-- Output tab -->
      <div v-show="activeTab === 'output'" class="h-full">
        <Console :output="output" />
      </div>

      <!-- Terminal tab (always mounted for xterm) -->
      <div v-show="activeTab === 'terminal'" class="h-full">
        <XTerminal ref="xtermRef" />
      </div>

      <!-- Reference tab -->
      <div v-show="activeTab === 'reference'" class="h-full">
        <TerminalReference />
      </div>
    </div>
  </div>
</template>
