<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  recorderService,
  sizePresets,
  qualityPresets,
  type SizePreset,
  type RecordingOptions,
} from '@/services/recorder'

const props = defineProps<{
  canvas: HTMLCanvasElement | null
  audioContext: AudioContext | null
  isRunning: boolean
}>()

const emit = defineEmits<{
  close: []
  popout: []
  minimize: []
}>()

// Minimized state
const isMinimized = ref(false)

// Recording state
const isRecording = ref(false)
const recordingDuration = ref(0)
const recordedBlob = ref<Blob | null>(null)

// Settings
const selectedPreset = ref<SizePreset>(sizePresets.find(p => p.name === 'YouTube Shorts')!)
const selectedQuality = ref<'low' | 'medium' | 'high' | 'ultra'>('high')
const includeAudio = ref(true)
const customWidth = ref(1920)
const customHeight = ref(1080)
const useCustomSize = ref(false)

// Screenshot format
const screenshotFormat = ref<'png' | 'jpeg' | 'webp'>('png')

// UI state
const showSettings = ref(false)
const showExport = ref(false)
const popoutWindow = ref<Window | null>(null)

// Group presets by platform
const presetsByPlatform = computed(() => {
  const grouped: Record<string, SizePreset[]> = {}
  for (const preset of sizePresets) {
    if (!grouped[preset.platform]) {
      grouped[preset.platform] = []
    }
    grouped[preset.platform].push(preset)
  }
  return grouped
})

// Current size
const currentSize = computed(() => {
  if (useCustomSize.value) {
    return { width: customWidth.value, height: customHeight.value }
  }
  return { width: selectedPreset.value.width, height: selectedPreset.value.height }
})

// Format duration as MM:SS.ms
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Initialize recorder with canvas and audio
function initRecorder() {
  if (props.canvas) {
    recorderService.setCanvas(props.canvas)
  }
  if (props.audioContext) {
    recorderService.setAudioContext(props.audioContext)
  }

  // Set up progress callback
  recorderService.onProgress((duration) => {
    recordingDuration.value = duration
  })
}

// Start recording
function startRecording() {
  if (!props.canvas) {
    console.error('No canvas available for recording')
    return
  }

  initRecorder()

  const quality = qualityPresets[selectedQuality.value]
  const options: RecordingOptions = {
    videoBitsPerSecond: quality.videoBitsPerSecond,
    audioBitsPerSecond: quality.audioBitsPerSecond,
  }

  const success = recorderService.startRecording(options, includeAudio.value)
  if (success) {
    isRecording.value = true
    recordedBlob.value = null
  }
}

// Stop recording
async function stopRecording() {
  const blob = await recorderService.stopRecording()
  isRecording.value = false
  recordingDuration.value = 0

  if (blob) {
    recordedBlob.value = blob
    showExport.value = true
  }
}

// Take screenshot
function takeScreenshot() {
  if (!props.canvas) return

  initRecorder()
  const dataUrl = recorderService.takeScreenshot(screenshotFormat.value)
  if (dataUrl) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `allolib-screenshot_${timestamp}.${screenshotFormat.value}`
    recorderService.downloadDataUrl(dataUrl, filename)
  }
}

// Download recording
function downloadRecording() {
  if (!recordedBlob.value) return

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `allolib-recording_${timestamp}.webm`
  recorderService.downloadBlob(recordedBlob.value, filename)
}

// Download audio only from recording
async function downloadAudioOnly() {
  if (!props.audioContext) {
    console.error('No audio context available')
    return
  }

  initRecorder()

  // Record 5 seconds of audio
  const blob = await recorderService.recordAudioOnly(5000)
  if (blob) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `allolib-audio_${timestamp}.webm`
    recorderService.downloadBlob(blob, filename)
  }
}

// Open in popout window
function openPopout() {
  const { width, height } = currentSize.value
  const left = (screen.width - width) / 2
  const top = (screen.height - height) / 2

  const features = [
    `width=${width}`,
    `height=${height + 100}`, // Extra height for controls
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
    emit('popout')
  }
}

// Watch for running state changes
watch(() => props.isRunning, (running) => {
  if (!running && isRecording.value) {
    stopRecording()
  }
})

// Watch for canvas changes
watch(() => props.canvas, () => {
  initRecorder()
})

onMounted(() => {
  initRecorder()
})

onBeforeUnmount(() => {
  if (isRecording.value) {
    stopRecording()
  }
  if (popoutWindow.value && !popoutWindow.value.closed) {
    popoutWindow.value.close()
  }
})
</script>

<template>
  <div class="popout-visualizer bg-editor-bg border border-editor-border rounded-lg shadow-xl">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-1.5 border-b border-editor-border bg-editor-sidebar">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-gray-200">Recording</span>
        <span v-if="isRecording" class="flex items-center gap-1 text-red-400 text-xs">
          <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          REC {{ formatDuration(recordingDuration) }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="!isMinimized"
          @click="showSettings = !showSettings"
          class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Settings"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          v-if="!isMinimized"
          @click="openPopout"
          class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title="Open in new window"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
        <!-- Minimize button -->
        <button
          @click="isMinimized = !isMinimized"
          class="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          :title="isMinimized ? 'Expand' : 'Minimize'"
        >
          <svg v-if="!isMinimized" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
          </svg>
          <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <!-- Close button -->
        <button
          @click="emit('close')"
          class="p-1 rounded hover:bg-red-600/50 text-gray-400 hover:text-white transition-colors"
          title="Close"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Settings Panel -->
    <div v-if="showSettings && !isMinimized" class="px-4 py-3 border-b border-editor-border bg-editor-sidebar/50">
      <div class="space-y-4">
        <!-- Size Preset -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">Output Size</label>
          <div class="flex items-center gap-2 mb-2">
            <label class="flex items-center gap-1 text-xs text-gray-300">
              <input type="checkbox" v-model="useCustomSize" class="rounded" />
              Custom
            </label>
          </div>

          <div v-if="useCustomSize" class="flex items-center gap-2">
            <input
              type="number"
              v-model.number="customWidth"
              class="w-20 px-2 py-1 bg-editor-bg border border-editor-border rounded text-xs"
              placeholder="Width"
            />
            <span class="text-gray-500">x</span>
            <input
              type="number"
              v-model.number="customHeight"
              class="w-20 px-2 py-1 bg-editor-bg border border-editor-border rounded text-xs"
              placeholder="Height"
            />
          </div>

          <div v-else class="space-y-2">
            <select
              v-model="selectedPreset"
              class="w-full px-2 py-1.5 bg-editor-bg border border-editor-border rounded text-sm"
            >
              <optgroup v-for="(presets, platform) in presetsByPlatform" :key="platform" :label="platform">
                <option v-for="preset in presets" :key="preset.name" :value="preset">
                  {{ preset.name }} ({{ preset.width }}x{{ preset.height }})
                </option>
              </optgroup>
            </select>
            <div class="text-xs text-gray-500">
              {{ selectedPreset.description }} - {{ selectedPreset.aspectRatio }}
            </div>
          </div>
        </div>

        <!-- Quality -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">Quality</label>
          <div class="flex gap-2">
            <button
              v-for="quality in (['low', 'medium', 'high', 'ultra'] as const)"
              :key="quality"
              @click="selectedQuality = quality"
              class="px-3 py-1 rounded text-xs capitalize transition-colors"
              :class="selectedQuality === quality
                ? 'bg-allolib-blue text-white'
                : 'bg-editor-bg border border-editor-border text-gray-400 hover:border-gray-500'"
            >
              {{ quality }}
            </button>
          </div>
          <div class="text-xs text-gray-500 mt-1">
            Video: {{ (qualityPresets[selectedQuality].videoBitsPerSecond / 1_000_000).toFixed(1) }} Mbps,
            Audio: {{ qualityPresets[selectedQuality].audioBitsPerSecond / 1000 }} kbps
          </div>
        </div>

        <!-- Audio -->
        <div>
          <label class="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" v-model="includeAudio" class="rounded" />
            Include audio in recording
          </label>
        </div>

        <!-- Screenshot Format -->
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-2">Screenshot Format</label>
          <div class="flex gap-2">
            <button
              v-for="format in (['png', 'jpeg', 'webp'] as const)"
              :key="format"
              @click="screenshotFormat = format"
              class="px-3 py-1 rounded text-xs uppercase transition-colors"
              :class="screenshotFormat === format
                ? 'bg-allolib-blue text-white'
                : 'bg-editor-bg border border-editor-border text-gray-400 hover:border-gray-500'"
            >
              {{ format }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div v-if="!isMinimized" class="px-4 py-3 flex items-center gap-3">
      <!-- Record Button -->
      <button
        v-if="!isRecording"
        @click="startRecording"
        :disabled="!isRunning"
        class="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
        :class="isRunning
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-gray-700 text-gray-500 cursor-not-allowed'"
      >
        <span class="w-3 h-3 rounded-full bg-current"></span>
        Record
      </button>
      <button
        v-else
        @click="stopRecording"
        class="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
        Stop
      </button>

      <!-- Screenshot Button -->
      <button
        @click="takeScreenshot"
        :disabled="!isRunning"
        class="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        :class="isRunning
          ? 'bg-editor-sidebar hover:bg-gray-700 text-gray-300'
          : 'bg-gray-800 text-gray-600 cursor-not-allowed'"
        title="Take Screenshot"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Screenshot
      </button>

      <!-- Size indicator -->
      <div class="ml-auto text-xs text-gray-500">
        {{ currentSize.width }} x {{ currentSize.height }}
      </div>
    </div>

    <!-- Export Panel -->
    <div v-if="showExport && recordedBlob && !isMinimized" class="px-4 py-3 border-t border-editor-border bg-editor-sidebar/30">
      <div class="flex items-center justify-between mb-3">
        <div>
          <span class="text-sm font-medium text-gray-200">Recording Ready</span>
          <span class="text-xs text-gray-500 ml-2">{{ formatFileSize(recordedBlob.size) }}</span>
        </div>
        <button
          @click="showExport = false; recordedBlob = null"
          class="text-gray-500 hover:text-gray-300"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="flex gap-2">
        <button
          @click="downloadRecording"
          class="flex items-center gap-2 px-3 py-1.5 bg-allolib-blue hover:bg-blue-600 text-white rounded transition-colors text-sm"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Video
        </button>
        <button
          @click="() => {
            if (recordedBlob) {
              const url = URL.createObjectURL(recordedBlob)
              window.open(url, '_blank')
            }
          }"
          class="flex items-center gap-2 px-3 py-1.5 bg-editor-sidebar hover:bg-gray-700 text-gray-300 rounded transition-colors text-sm"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Preview
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.popout-visualizer {
  min-width: 320px;
}
</style>
