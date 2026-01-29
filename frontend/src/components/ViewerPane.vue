<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { AllolibRuntime } from '@/services/runtime'
import type { AppStatus } from '@/stores/app'
import { useSettingsStore } from '@/stores/settings'
import AnalysisPanel from './AnalysisPanel.vue'
import PopoutVisualizer from './PopoutVisualizer.vue'

const settings = useSettingsStore()
const isStudioFocus = computed(() => settings.display.studioFocus)

const props = defineProps<{
  status: AppStatus
  jsUrl: string | null
  showAnalysisPanel?: boolean
  panelHeight?: number
}>()

// Computed property for audio panel
const isAudioRunning = computed(() => props.status === 'running')

const emit = defineEmits<{
  started: [runtime: AllolibRuntime]
  error: [message: string]
  log: [message: string]
  'analysis-resize': [height: number]
}>()

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()
const viewerRef = ref<HTMLDivElement>()
const runtimeRef = ref<AllolibRuntime | null>(null)
let runtime: AllolibRuntime | null = null

// Recording controls
const showRecordingControls = ref(false)
const popoutWindow = ref<Window | null>(null)
const isPopoutMode = ref(false)

onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('message', handlePopoutMessage)
  handleResize()
})

// Handle messages from popout window
function handlePopoutMessage(event: MessageEvent) {
  if (event.data.type === 'record-toggle') {
    // Toggle recording in the PopoutVisualizer component
    // For now, just toggle the recording controls to show
    showRecordingControls.value = true
  } else if (event.data.type === 'screenshot') {
    // Trigger screenshot from popout
    if (canvasRef.value) {
      const dataUrl = canvasRef.value.toDataURL('image/png')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `allolib-screenshot_${timestamp}.png`
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('message', handlePopoutMessage)
  runtime?.destroy()
  // Close popout window if open
  if (popoutWindow.value && !popoutWindow.value.closed) {
    popoutWindow.value.close()
  }
})

function handleKeydown(e: KeyboardEvent) {
  // F11 to toggle studio focus (only when running)
  if (e.key === 'F11' && props.status === 'running') {
    e.preventDefault()
    toggleStudioFocus()
  }
  // Escape to exit studio focus
  if (e.key === 'Escape' && settings.display.studioFocus) {
    settings.display.studioFocus = false
  }
}

function toggleStudioFocus() {
  settings.display.studioFocus = !settings.display.studioFocus
  // Resize after layout change
  setTimeout(handleResize, 100)
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
      runtimeRef.value = runtime

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
      emit('started', runtime)
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

// Get audio context from runtime (for recording)
const audioContext = computed(() => {
  return runtimeRef.value?.getAudioContext?.() || null
})

// Toggle recording controls panel
function toggleRecordingControls() {
  showRecordingControls.value = !showRecordingControls.value
}

// Handle popout - opens visualizer in new window
function handlePopout() {
  if (!canvasRef.value) return

  const width = 1280
  const height = 720 + 150 // Canvas + controls
  const left = (screen.width - width) / 2
  const top = (screen.height - height) / 2

  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'menubar=no',
    'toolbar=no',
    'location=no',
    'status=no',
    'resizable=yes',
  ].join(',')

  popoutWindow.value = window.open('', 'AlloLib Visualizer', features)

  if (popoutWindow.value) {
    isPopoutMode.value = true
    setupPopoutWindow(popoutWindow.value)
  }
}

// Setup the popout window with necessary content
function setupPopoutWindow(win: Window) {
  if (!canvasRef.value) return

  // Write the HTML structure
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>AlloLib Studio - Visualizer</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #1a1a2e; color: #fff; font-family: system-ui, sans-serif; overflow: hidden; }
        .container { display: flex; flex-direction: column; height: 100vh; }
        .header { padding: 12px 16px; background: #16213e; display: flex; align-items: center; justify-content: space-between; }
        .title { font-size: 14px; font-weight: 500; }
        .canvas-container { flex: 1; display: flex; align-items: center; justify-content: center; background: #000; }
        #popout-canvas { max-width: 100%; max-height: 100%; }
        .controls { padding: 12px 16px; background: #16213e; display: flex; gap: 12px; align-items: center; }
        button { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 6px; }
        .btn-record { background: #dc2626; color: white; }
        .btn-record:hover { background: #b91c1c; }
        .btn-stop { background: #dc2626; color: white; }
        .btn-screenshot { background: #374151; color: #d1d5db; }
        .btn-screenshot:hover { background: #4b5563; }
        .status { margin-left: auto; font-size: 12px; color: #9ca3af; }
        .recording { color: #ef4444; display: flex; align-items: center; gap: 6px; }
        .recording-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 1s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="title">AlloLib Studio - Visualizer</span>
          <span id="size-display">1280 x 720</span>
        </div>
        <div class="canvas-container">
          <canvas id="popout-canvas"></canvas>
        </div>
        <div class="controls">
          <button id="btn-record" class="btn-record">
            <span style="width:10px;height:10px;border-radius:50%;background:currentColor"></span>
            Record
          </button>
          <button id="btn-screenshot" class="btn-screenshot">
            Screenshot
          </button>
          <div id="status" class="status">Ready</div>
        </div>
      </div>
      <script>
        // Message parent window for actions
        document.getElementById('btn-record').addEventListener('click', () => {
          window.opener.postMessage({ type: 'record-toggle' }, '*');
        });
        document.getElementById('btn-screenshot').addEventListener('click', () => {
          window.opener.postMessage({ type: 'screenshot' }, '*');
        });
        window.addEventListener('message', (e) => {
          if (e.data.type === 'recording-status') {
            const btn = document.getElementById('btn-record');
            const status = document.getElementById('status');
            if (e.data.isRecording) {
              btn.innerHTML = '<span style="width:10px;height:10px;background:currentColor"></span> Stop';
              status.innerHTML = '<span class="recording"><span class="recording-dot"></span>Recording ' + e.data.duration + '</span>';
            } else {
              btn.innerHTML = '<span style="width:10px;height:10px;border-radius:50%;background:currentColor"></span> Record';
              status.textContent = 'Ready';
            }
          }
        });
      <\/script>
    </body>
    </html>
  `)
  win.document.close()

  // Copy canvas content to popout
  const popoutCanvas = win.document.getElementById('popout-canvas') as HTMLCanvasElement
  if (popoutCanvas && canvasRef.value) {
    const ctx = popoutCanvas.getContext('2d')
    if (ctx) {
      // Set up canvas mirroring
      const mirrorCanvas = () => {
        if (win.closed) {
          isPopoutMode.value = false
          return
        }
        popoutCanvas.width = canvasRef.value!.width
        popoutCanvas.height = canvasRef.value!.height
        ctx.drawImage(canvasRef.value!, 0, 0)
        requestAnimationFrame(mirrorCanvas)
      }
      mirrorCanvas()
    }
  }

  // Handle window close
  win.addEventListener('beforeunload', () => {
    isPopoutMode.value = false
    popoutWindow.value = null
  })
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
        <!-- Recording controls button -->
        <button
          @click="toggleRecordingControls"
          class="p-1 rounded transition-colors"
          :class="showRecordingControls ? 'bg-red-600/30 text-red-400 hover:bg-red-600/40' : 'hover:bg-gray-700 text-gray-400'"
          title="Recording Controls"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
          </svg>
        </button>
        <!-- Popout button -->
        <button
          @click="handlePopout"
          class="p-1 rounded transition-colors hover:bg-gray-700 text-gray-400"
          title="Open in new window"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
        <!-- Studio Focus button -->
        <button
          @click="toggleStudioFocus"
          class="p-1 rounded transition-colors"
          :class="isStudioFocus ? 'bg-allolib-blue/30 text-allolib-blue hover:bg-allolib-blue/40' : 'hover:bg-gray-700 text-gray-400'"
          :title="isStudioFocus ? 'Exit Studio Focus (Esc)' : 'Studio Focus (F11)'"
        >
          <!-- Studio focus icon: layout with expanded right pane -->
          <svg v-if="!isStudioFocus" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          <!-- Exit studio focus: restore split layout -->
          <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
            <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Recording Controls Panel -->
    <PopoutVisualizer
      v-if="showRecordingControls"
      :canvas="canvasRef || null"
      :audio-context="audioContext"
      :is-running="status === 'running'"
      @close="showRecordingControls = false"
      @popout="handlePopout"
      class="absolute top-10 right-2 z-50"
    />

    <!-- Main content area with canvas and audio panel -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- WebGL Canvas -->
      <div ref="containerRef" class="flex-1 relative overflow-hidden">
      <canvas
        id="canvas"
        ref="canvasRef"
        class="absolute inset-0 w-full h-full cursor-pointer"
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

      <!-- Toolbar Panel -->
      <AnalysisPanel
        v-show="showAnalysisPanel !== false"
        :is-running="isAudioRunning"
        :panel-height="panelHeight"
        @resize="(h) => emit('analysis-resize', h)"
      />
    </div>
  </div>
</template>
