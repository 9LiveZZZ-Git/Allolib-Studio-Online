<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { AllolibRuntime } from '@/services/runtime'
import type { AppStatus } from '@/stores/app'
import AudioAnalysisPanel from './AudioAnalysisPanel.vue'

const props = defineProps<{
  status: AppStatus
  jsUrl: string | null
  showAudioPanel?: boolean
  audioPanelHeight?: number
}>()

// Computed property for audio panel
const isAudioRunning = computed(() => props.status === 'running')

const emit = defineEmits<{
  started: []
  error: [message: string]
  log: [message: string]
}>()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
let runtime: AllolibRuntime | null = null

onMounted(() => {
  // Handle resize
  window.addEventListener('resize', handleResize)
  handleResize()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  runtime?.destroy()
})

// Watch for JS URL changes to load new modules
watch(() => props.jsUrl, async (newUrl) => {
  if (newUrl && canvasRef.value) {
    try {
      // Cleanup previous runtime
      runtime?.destroy()

      // Create new runtime
      runtime = new AllolibRuntime({
        canvas: canvasRef.value,
        onPrint: (text) => emit('log', text),
        onError: (text) => emit('log', text),
        onExit: (code) => emit('log', `[INFO] Exit code: ${code}`),
      })

      // Load and start
      await runtime.load(newUrl)
      runtime.start()
      emit('started')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      emit('error', message)
    }
  }
})

// Watch for stop
watch(() => props.status, (newStatus) => {
  if (newStatus === 'idle' && runtime) {
    runtime.stop()
  }
})

function handleResize() {
  if (containerRef.value && canvasRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    canvasRef.value.style.width = `${rect.width}px`
    canvasRef.value.style.height = `${rect.height}px`
    runtime?.resize()
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-black">
    <div class="h-8 bg-editor-sidebar border-b border-editor-border flex items-center px-3 justify-between">
      <span class="text-sm text-gray-400">Output</span>
      <div class="flex items-center gap-3">
        <span class="text-xs flex items-center gap-1">
          <span class="w-2 h-2 rounded-full" :class="status === 'running' ? 'bg-green-500' : 'bg-gray-500'"></span>
          WebGL2
        </span>
        <span class="text-xs flex items-center gap-1">
          <span class="w-2 h-2 rounded-full" :class="status === 'running' ? 'bg-green-500' : 'bg-gray-500'"></span>
          Audio
        </span>
      </div>
    </div>

    <!-- Main content area with canvas and audio panel -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- WebGL Canvas -->
      <div ref="containerRef" class="flex-1 relative overflow-hidden">
      <canvas
        id="canvas"
        ref="canvasRef"
        class="absolute inset-0 w-full h-full"
      />

      <!-- Idle state overlay -->
      <div
        v-if="status === 'idle'"
        class="absolute inset-0 flex items-center justify-center bg-black/80"
      >
        <div class="text-center">
          <div class="text-4xl mb-4 text-allolib-blue">AlloLib Studio</div>
          <p class="text-gray-400">Press <span class="text-green-400 font-semibold">Run</span> to compile and execute</p>
          <p class="text-gray-500 text-sm mt-2">Your AlloLib application will render here</p>
        </div>
      </div>

      <!-- Compiling overlay -->
      <div
        v-else-if="status === 'compiling' || status === 'loading'"
        class="absolute inset-0 flex items-center justify-center bg-black/80"
      >
        <div class="text-center">
          <div class="animate-spin w-12 h-12 border-4 border-allolib-blue border-t-transparent rounded-full mx-auto mb-4"></div>
          <p class="text-gray-400">{{ status === 'compiling' ? 'Compiling...' : 'Loading WASM...' }}</p>
        </div>
      </div>

      <!-- Error overlay -->
      <div
        v-else-if="status === 'error'"
        class="absolute inset-0 flex items-center justify-center bg-black/80"
      >
        <div class="text-center max-w-md">
          <div class="text-red-500 text-4xl mb-4">Error</div>
          <p class="text-gray-400">Compilation or runtime error occurred.</p>
          <p class="text-gray-500 text-sm mt-2">Check the console for details.</p>
        </div>
      </div>
      </div>

      <!-- Audio Analysis Panel -->
      <AudioAnalysisPanel
        v-if="showAudioPanel !== false"
        :is-running="isAudioRunning"
        :panel-height="audioPanelHeight"
      />
    </div>
  </div>
</template>
