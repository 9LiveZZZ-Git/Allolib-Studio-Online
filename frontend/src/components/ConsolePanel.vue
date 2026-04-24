<script setup lang="ts">
import { ref, nextTick } from 'vue'
import Console from './Console.vue'
import XTerminal from './XTerminal.vue'
import TerminalReference from './TerminalReference.vue'
import { useResizableDrag } from '@/composables/useResizableDrag'

const props = defineProps<{
  output: string[]
}>()

// Copy all output to clipboard
async function copyOutput() {
  const text = props.output.join('\n')
  await navigator.clipboard.writeText(text)
}

const emit = defineEmits<{
  resize: [height: number]
  clear: []
}>()

const activeTab = ref<'output' | 'terminal' | 'reference'>('output')
const xtermRef = ref<InstanceType<typeof XTerminal>>()
const containerRef = ref<HTMLDivElement>()

// Bottom-anchored panel: dragging upward grows it, downward shrinks it.
const { startResize } = useResizableDrag({
  axis: 'vertical',
  min: 100,
  max: 600,
  invert: true,
  getElement: () => containerRef.value,
  fallbackSize: 200,
  onResize: (h) => emit('resize', h),
})

function switchTab(tab: 'output' | 'terminal' | 'reference') {
  activeTab.value = tab
  if (tab === 'terminal') {
    // Re-fit xterm after tab switch (DOM needs to update first)
    nextTick(() => {
      xtermRef.value?.fit()
    })
  }
}
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

      <!-- Copy and Clear buttons -->
      <div v-if="activeTab === 'output'" class="flex items-center gap-2">
        <button
          @click="copyOutput"
          class="text-gray-500 hover:text-gray-300 transition-colors"
          title="Copy to clipboard"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          @click="emit('clear')"
          class="text-gray-500 hover:text-gray-300 transition-colors"
          title="Clear console"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
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
