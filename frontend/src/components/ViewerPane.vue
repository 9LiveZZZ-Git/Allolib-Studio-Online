<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { AllolibRuntime } from '@/services/runtime'
import type { AppStatus } from '@/stores/app'
import { useSettingsStore } from '@/stores/settings'
import AnalysisPanel from './AnalysisPanel.vue'

const settings = useSettingsStore()

const props = defineProps<{
  status: AppStatus
  jsUrl: string | null
  showAnalysisPanel?: boolean
  panelHeight?: number
}>()

// Computed property for audio panel
const isAudioRunning = computed(() => props.status === 'running')

const emit = defineEmits<{
  started: []
  error: [message: string]
  log: [message: string]
  'analysis-resize': [height: number]
}>()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const viewerRef = ref<HTMLDivElement>()
const isFullscreen = ref(false)
let runtime: AllolibRuntime | null = null

onMounted(() => {
  // Handle resize
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
  handleResize()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
  runtime?.destroy()
})

function handleKeydown(e: KeyboardEvent) {
  // F11 to toggle fullscreen (only when viewer is focused or running)
  if (e.key === 'F11' && props.status === 'running') {
    e.preventDefault()
    toggleFullscreen()
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
  // Resize after fullscreen change
  setTimeout(handleResize, 100)
}

async function toggleFullscreen() {
  if (!viewerRef.value) return

  try {
    if (!document.fullscreenElement) {
      await viewerRef.value.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch (err) {
    console.error('Fullscreen error:', err)
  }
}

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

      // Apply limiter settings before loading (will be used when audio chain is created)
      runtime.configureLimiter({
        enabled: settings.audio.limiterEnabled,
        threshold: settings.audio.limiterThreshold,
        softClipEnabled: settings.audio.softClipEnabled,
        softClipDrive: settings.audio.softClipDrive,
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

// Watch for audio settings changes and update runtime limiter
watch(
  () => settings.audio,
  (audioSettings) => {
    if (runtime) {
      runtime.configureLimiter({
        enabled: audioSettings.limiterEnabled,
        threshold: audioSettings.limiterThreshold,
        softClipEnabled: audioSettings.softClipEnabled,
        softClipDrive: audioSettings.softClipDrive,
      })
    }
  },
  { deep: true }
)

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
  <div ref="viewerRef" class="h-full flex flex-col bg-black">
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
        <!-- Fullscreen button -->
        <button
          @click="toggleFullscreen"
          class="p-1 hover:bg-gray-700 rounded transition-colors"
          :title="isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen (F11)'"
        >
          <!-- Expand icon when not fullscreen -->
          <svg v-if="!isFullscreen" class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
          </svg>
          <!-- Compress icon when fullscreen -->
          <svg v-else class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4H4m0 0l5 5M9 20v-5H4m0 0l5-5m11 10h-5v5m0 0l5-5m-5-10h5V4m0 0l-5 5" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Main content area with canvas and audio panel -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- WebGL Canvas -->
      <div ref="containerRef" class="flex-1 relative overflow-hidden">
      <canvas
        id="canvas"
        ref="canvasRef"
        class="absolute inset-0 w-full h-full cursor-pointer"
        @dblclick="toggleFullscreen"
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

      <!-- Analysis Panel -->
      <AnalysisPanel
        v-show="showAnalysisPanel !== false"
        :is-running="isAudioRunning"
        :panel-height="panelHeight"
        @resize="(h) => emit('analysis-resize', h)"
      />
    </div>
  </div>
</template>
