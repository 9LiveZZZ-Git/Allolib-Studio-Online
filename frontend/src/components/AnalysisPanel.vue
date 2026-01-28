<script setup lang="ts">
/**
 * Analysis Panel
 *
 * Provides real-time analysis with two main tabs:
 * - Audio: Stereo meters, waveform, spectrum analyzer
 * - Video: FPS counter, frame time, render stats
 */
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'

const props = defineProps<{
  isRunning: boolean
  panelHeight?: number
}>()

const emit = defineEmits<{
  resize: [height: number]
}>()

// Resize state
const containerRef = ref<HTMLDivElement>()
const isResizing = ref(false)
const startY = ref(0)
const startHeight = ref(0)

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

  // Calculate new height (dragging up increases height)
  const delta = startY.value - e.clientY
  const newHeight = Math.max(100, Math.min(400, startHeight.value + delta))

  emit('resize', newHeight)
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// Main tab state
const activeTab = ref<'audio' | 'video'>('audio')

// Audio sub-view state
const audioView = ref<'waveform' | 'spectrum' | 'stereo'>('stereo')

// Canvas refs - Audio
const stereoMeterRef = ref<HTMLCanvasElement>()
const stereoScopeRef = ref<HTMLCanvasElement>()
const waveformCanvasRef = ref<HTMLCanvasElement>()
const spectrumCanvasRef = ref<HTMLCanvasElement>()

// Canvas refs - Video
const fpsGraphRef = ref<HTMLCanvasElement>()
const frameTimeGraphRef = ref<HTMLCanvasElement>()

// Audio analysis state
let analyserNodeL: AnalyserNode | null = null
let analyserNodeR: AnalyserNode | null = null
let splitterNode: ChannelSplitterNode | null = null
let animationId: number | null = null
const fftSize = 2048
const smoothingTimeConstant = 0.8

// Level meter state
const levelL = ref(0)
const levelR = ref(0)
const peakL = ref(0)
const peakR = ref(0)
let peakHoldTimeL = 0
let peakHoldTimeR = 0
const peakHoldDuration = 1500

// Limiter state
const gainReduction = ref(0) // in dB (negative value when limiting)
const isLimiting = ref(false)

// Video stats
const fps = ref(0)
const frameTime = ref(0)
const resolution = ref({ width: 0, height: 0 })
const gpuInfo = ref('')
const drawCalls = ref(0)
const triangles = ref(0)
let lastFrameTime = 0
let frameCount = 0
let lastFpsUpdate = 0
let fpsHistory: number[] = []
let frameTimeHistory: number[] = []
const historyLength = 60

// Data arrays
let timeDataArrayL: Uint8Array
let timeDataArrayR: Uint8Array
let freqDataArrayL: Uint8Array

function setupAnalyser() {
  const audioContext = window.alloAudioContext
  const workletNode = window.alloWorkletNode

  if (!audioContext || !workletNode) {
    console.warn('Audio context or worklet not available')
    return
  }

  // Create channel splitter for true stereo analysis
  splitterNode = audioContext.createChannelSplitter(2)

  // Create separate analysers for L and R
  analyserNodeL = audioContext.createAnalyser()
  analyserNodeL.fftSize = fftSize
  analyserNodeL.smoothingTimeConstant = smoothingTimeConstant

  analyserNodeR = audioContext.createAnalyser()
  analyserNodeR.fftSize = fftSize
  analyserNodeR.smoothingTimeConstant = smoothingTimeConstant

  // Connect: worklet -> splitter -> analysers
  workletNode.connect(splitterNode)
  splitterNode.connect(analyserNodeL, 0)
  splitterNode.connect(analyserNodeR, 1)

  // Initialize data arrays
  timeDataArrayL = new Uint8Array(analyserNodeL.frequencyBinCount)
  timeDataArrayR = new Uint8Array(analyserNodeR.frequencyBinCount)
  freqDataArrayL = new Uint8Array(analyserNodeL.frequencyBinCount)

  // Initialize video stats
  fpsHistory = new Array(historyLength).fill(0)
  frameTimeHistory = new Array(historyLength).fill(0)

  // Start animation loop
  lastFrameTime = performance.now()
  animate()
}

function teardownAnalyser() {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  if (analyserNodeL) {
    analyserNodeL.disconnect()
    analyserNodeL = null
  }
  if (analyserNodeR) {
    analyserNodeR.disconnect()
    analyserNodeR = null
  }
  if (splitterNode) {
    splitterNode.disconnect()
    splitterNode = null
  }
}

function animate() {
  if (!props.isRunning) {
    animationId = null
    return
  }

  const now = performance.now()
  const delta = now - lastFrameTime
  lastFrameTime = now

  // Update frame time
  frameCount++
  frameTime.value = delta
  frameTimeHistory.push(delta)
  if (frameTimeHistory.length > historyLength) frameTimeHistory.shift()

  // Calculate FPS every 500ms for stability
  if (now - lastFpsUpdate > 500) {
    const avgFrameTime = frameTimeHistory.reduce((a, b) => a + b, 0) / frameTimeHistory.length
    fps.value = Math.round(1000 / avgFrameTime)
    fpsHistory.push(fps.value)
    if (fpsHistory.length > historyLength) fpsHistory.shift()
    lastFpsUpdate = now
  }

  // Update resolution from canvas
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  if (canvas) {
    resolution.value = { width: canvas.width, height: canvas.height }

    // Try to get WebGL stats
    const gl = canvas.getContext('webgl2')
    if (gl && !gpuInfo.value) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        gpuInfo.value = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'WebGL2'
      } else {
        gpuInfo.value = 'WebGL2'
      }
    }
  }

  // Get audio data
  if (analyserNodeL && analyserNodeR) {
    analyserNodeL.getByteTimeDomainData(timeDataArrayL)
    analyserNodeR.getByteTimeDomainData(timeDataArrayR)
    analyserNodeL.getByteFrequencyData(freqDataArrayL)
    updateLevels()
  }

  // Get limiter gain reduction
  if (window.alloLimiter) {
    gainReduction.value = window.alloLimiter.reduction
    isLimiting.value = gainReduction.value < -0.5 // Active if reducing by more than 0.5dB
  }

  // Draw based on active tab
  if (activeTab.value === 'audio') {
    drawStereoMeter()
    if (audioView.value === 'waveform') {
      drawWaveform()
    } else if (audioView.value === 'spectrum') {
      drawSpectrum()
    } else {
      drawStereoScope()
    }
  } else {
    drawFpsGraph()
    drawFrameTimeGraph()
  }

  animationId = requestAnimationFrame(animate)
}

function updateLevels() {
  if (!timeDataArrayL || !timeDataArrayR) return

  let sumL = 0
  let sumR = 0
  const len = timeDataArrayL.length

  for (let i = 0; i < len; i++) {
    const sampleL = (timeDataArrayL[i] - 128) / 128
    const sampleR = (timeDataArrayR[i] - 128) / 128
    sumL += sampleL * sampleL
    sumR += sampleR * sampleR
  }

  const rmsL = Math.sqrt(sumL / len)
  const rmsR = Math.sqrt(sumR / len)

  levelL.value = Math.min(1, rmsL * 3)
  levelR.value = Math.min(1, rmsR * 3)

  const now = Date.now()
  if (levelL.value > peakL.value) {
    peakL.value = levelL.value
    peakHoldTimeL = now
  } else if (now - peakHoldTimeL > peakHoldDuration) {
    peakL.value = Math.max(levelL.value, peakL.value * 0.95)
  }

  if (levelR.value > peakR.value) {
    peakR.value = levelR.value
    peakHoldTimeR = now
  } else if (now - peakHoldTimeR > peakHoldDuration) {
    peakR.value = Math.max(levelR.value, peakR.value * 0.95)
  }
}

function drawStereoMeter() {
  const canvas = stereoMeterRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  const meterHeight = (height - 4) / 2

  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#2a2a3e'
  ctx.fillRect(20, 2, width - 24, meterHeight - 2)
  ctx.fillRect(20, meterHeight + 4, width - 24, meterHeight - 2)

  const meterWidth = width - 24
  drawMeterBar(ctx, 20, 2, meterWidth, meterHeight - 2, levelL.value, peakL.value)
  drawMeterBar(ctx, 20, meterHeight + 4, meterWidth, meterHeight - 2, levelR.value, peakR.value)

  ctx.fillStyle = '#888'
  ctx.font = '10px monospace'
  ctx.fillText('L', 4, meterHeight / 2 + 4)
  ctx.fillText('R', 4, meterHeight + meterHeight / 2 + 6)
}

function drawMeterBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, level: number, peak: number) {
  const gradient = ctx.createLinearGradient(x, 0, x + width, 0)
  gradient.addColorStop(0, '#22c55e')
  gradient.addColorStop(0.6, '#22c55e')
  gradient.addColorStop(0.75, '#eab308')
  gradient.addColorStop(0.9, '#f97316')
  gradient.addColorStop(1, '#ef4444')

  ctx.fillStyle = gradient
  ctx.fillRect(x, y, width * level, height)

  if (peak > 0.01) {
    const peakX = x + width * peak
    ctx.fillStyle = peak > 0.9 ? '#ef4444' : '#fff'
    ctx.fillRect(peakX - 2, y, 3, height)
  }
}

function drawStereoScope() {
  const canvas = stereoScopeRef.value
  if (!canvas || !timeDataArrayL || !timeDataArrayR) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  const centerX = width / 2
  const centerY = height / 2
  const scale = Math.min(width, height) / 2.5

  // Clear with fade effect for trails
  ctx.fillStyle = 'rgba(13, 17, 23, 0.3)'
  ctx.fillRect(0, 0, width, height)

  // Draw grid
  ctx.strokeStyle = '#21262d'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(centerX, 0)
  ctx.lineTo(centerX, height)
  ctx.moveTo(0, centerY)
  ctx.lineTo(width, centerY)
  // Diagonal lines for stereo reference
  ctx.moveTo(0, 0)
  ctx.lineTo(width, height)
  ctx.moveTo(width, 0)
  ctx.lineTo(0, height)
  ctx.stroke()

  // Draw stereo scope (Lissajous)
  ctx.strokeStyle = '#58a6ff'
  ctx.lineWidth = 1
  ctx.beginPath()

  const step = 4
  for (let i = 0; i < timeDataArrayL.length; i += step) {
    const l = (timeDataArrayL[i] - 128) / 128
    const r = (timeDataArrayR[i] - 128) / 128

    // Convert L/R to X/Y (M/S style display)
    const x = centerX + (l + r) * scale * 0.5
    const y = centerY - (l - r) * scale * 0.5

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()

  // Labels
  ctx.fillStyle = '#484f58'
  ctx.font = '10px monospace'
  ctx.fillText('L', 4, centerY - 4)
  ctx.fillText('R', width - 12, centerY - 4)
  ctx.fillText('+', centerX + 4, 14)
  ctx.fillText('-', centerX + 4, height - 4)
}

function drawWaveform() {
  const canvas = waveformCanvasRef.value
  if (!canvas || !timeDataArrayL || !timeDataArrayR) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  const halfHeight = height / 2

  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, width, height)

  // Draw grid
  ctx.strokeStyle = '#21262d'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, halfHeight / 2)
  ctx.lineTo(width, halfHeight / 2)
  ctx.moveTo(0, halfHeight)
  ctx.lineTo(width, halfHeight)
  ctx.moveTo(0, halfHeight + halfHeight / 2)
  ctx.lineTo(width, halfHeight + halfHeight / 2)
  ctx.stroke()

  const sliceWidth = width / timeDataArrayL.length

  // Draw Left channel (top half, blue)
  ctx.strokeStyle = '#58a6ff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i < timeDataArrayL.length; i++) {
    const v = timeDataArrayL[i] / 255
    const y = v * halfHeight
    if (i === 0) ctx.moveTo(0, y)
    else ctx.lineTo(i * sliceWidth, y)
  }
  ctx.stroke()

  // Draw Right channel (bottom half, green)
  ctx.strokeStyle = '#22c55e'
  ctx.beginPath()
  for (let i = 0; i < timeDataArrayR.length; i++) {
    const v = timeDataArrayR[i] / 255
    const y = halfHeight + v * halfHeight
    if (i === 0) ctx.moveTo(0, y)
    else ctx.lineTo(i * sliceWidth, y)
  }
  ctx.stroke()

  // Labels
  ctx.fillStyle = '#58a6ff'
  ctx.font = '10px monospace'
  ctx.fillText('L', 4, 14)
  ctx.fillStyle = '#22c55e'
  ctx.fillText('R', 4, halfHeight + 14)
}

function drawSpectrum() {
  const canvas = spectrumCanvasRef.value
  if (!canvas || !freqDataArrayL) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height

  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, width, height)

  // Draw grid
  ctx.strokeStyle = '#21262d'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 1; i < 6; i++) {
    const y = (height / 6) * i
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()

  // Draw spectrum bars
  const barCount = 64
  const barWidth = width / barCount - 1

  const gradient = ctx.createLinearGradient(0, height, 0, 0)
  gradient.addColorStop(0, '#22c55e')
  gradient.addColorStop(0.5, '#58a6ff')
  gradient.addColorStop(1, '#a855f7')

  ctx.fillStyle = gradient

  for (let i = 0; i < barCount; i++) {
    const logIndex = Math.pow(i / barCount, 2) * freqDataArrayL.length
    const dataIndex = Math.floor(logIndex)
    const value = freqDataArrayL[dataIndex] / 255
    const barHeight = value * height * 0.9

    const x = i * (barWidth + 1)
    ctx.fillRect(x, height - barHeight, barWidth, barHeight)
  }

  // Frequency labels
  ctx.fillStyle = '#484f58'
  ctx.font = '10px monospace'
  ctx.fillText('20Hz', 2, height - 4)
  ctx.fillText('1kHz', width * 0.4, height - 4)
  ctx.fillText('20kHz', width - 40, height - 4)
}

function drawFpsGraph() {
  const canvas = fpsGraphRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height

  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, width, height)

  // Draw 60fps line
  ctx.strokeStyle = '#22c55e33'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, height * (1 - 60 / 120))
  ctx.lineTo(width, height * (1 - 60 / 120))
  ctx.stroke()

  // Draw FPS history
  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = 2
  ctx.beginPath()
  const step = width / historyLength
  for (let i = 0; i < fpsHistory.length; i++) {
    const x = i * step
    const y = height * (1 - fpsHistory[i] / 120)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Current FPS text
  ctx.fillStyle = fps.value >= 55 ? '#22c55e' : fps.value >= 30 ? '#eab308' : '#ef4444'
  ctx.font = 'bold 16px monospace'
  ctx.fillText(`${fps.value} FPS`, 8, 20)
}

function drawFrameTimeGraph() {
  const canvas = frameTimeGraphRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height

  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, width, height)

  // Draw 16.67ms line (60fps target)
  ctx.strokeStyle = '#58a6ff33'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, height * (16.67 / 50))
  ctx.lineTo(width, height * (16.67 / 50))
  ctx.stroke()

  // Draw frame time history
  ctx.strokeStyle = '#58a6ff'
  ctx.lineWidth = 2
  ctx.beginPath()
  const step = width / historyLength
  for (let i = 0; i < frameTimeHistory.length; i++) {
    const x = i * step
    const y = height * Math.min(1, frameTimeHistory[i] / 50)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Frame time text
  ctx.fillStyle = '#58a6ff'
  ctx.font = '12px monospace'
  ctx.fillText(`${frameTime.value.toFixed(1)}ms`, 8, 16)
}

function setupCanvases() {
  // Audio canvases
  const audioCanvases = [
    stereoMeterRef.value,
    stereoScopeRef.value,
    waveformCanvasRef.value,
    spectrumCanvasRef.value,
  ]

  // Video canvases
  const videoCanvases = [
    fpsGraphRef.value,
    frameTimeGraphRef.value,
  ]

  // Only setup visible canvases to get correct dimensions
  const canvases = activeTab.value === 'audio' ? audioCanvases : videoCanvases

  canvases.forEach(canvas => {
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      // Only update if we have valid dimensions
      if (rect.width > 0 && rect.height > 0) {
        // Use CSS dimensions for drawing, not HiDPI scaled
        canvas.width = rect.width
        canvas.height = rect.height
      }
    }
  })
}

watch(() => props.isRunning, (running) => {
  if (running) {
    setTimeout(() => {
      setupCanvases()
      setupAnalyser()
    }, 100)
  } else {
    teardownAnalyser()
    levelL.value = 0
    levelR.value = 0
    peakL.value = 0
    peakR.value = 0
    gainReduction.value = 0
    isLimiting.value = false
    fps.value = 0
    frameTime.value = 0
    gpuInfo.value = ''
    fpsHistory = []
    frameTimeHistory = []
  }
})

// Re-setup canvases when tab changes (v-show elements need resize)
watch(activeTab, () => {
  setTimeout(setupCanvases, 50)
})

watch(audioView, () => {
  setTimeout(setupCanvases, 50)
})

onMounted(() => {
  setupCanvases()
  window.addEventListener('resize', setupCanvases)
})

onBeforeUnmount(() => {
  teardownAnalyser()
  window.removeEventListener('resize', setupCanvases)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<template>
  <div
    ref="containerRef"
    class="analysis-panel bg-editor-sidebar border-t border-editor-border shrink-0 flex flex-col"
    :style="panelHeight ? { height: `${panelHeight}px`, minHeight: `${panelHeight}px` } : {}"
  >
    <!-- Resize Handle -->
    <div
      class="h-1 bg-editor-border hover:bg-allolib-blue cursor-ns-resize transition-colors group flex items-center justify-center"
      @mousedown="startResize"
      :class="{ 'bg-allolib-blue': isResizing }"
    >
      <div class="w-12 h-0.5 bg-gray-600 group-hover:bg-white rounded-full transition-colors" :class="{ 'bg-white': isResizing }"></div>
    </div>

    <!-- Header with main tabs -->
    <div class="h-8 flex items-center justify-between px-3 border-b border-editor-border shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-400">Analysis</span>
        <div class="flex gap-1 ml-2">
          <button
            @click="activeTab = 'audio'"
            :class="[
              'px-2 py-0.5 text-xs rounded transition-colors',
              activeTab === 'audio'
                ? 'bg-allolib-blue text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            ]"
          >
            Audio
          </button>
          <button
            @click="activeTab = 'video'"
            :class="[
              'px-2 py-0.5 text-xs rounded transition-colors',
              activeTab === 'video'
                ? 'bg-allolib-blue text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            ]"
          >
            Video
          </button>
        </div>
      </div>

      <!-- Audio sub-view selector -->
      <div v-if="activeTab === 'audio'" class="flex gap-1">
        <button
          @click="audioView = 'stereo'"
          :class="[
            'px-2 py-0.5 text-xs rounded transition-colors',
            audioView === 'stereo'
              ? 'bg-gray-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          ]"
        >
          Stereo
        </button>
        <button
          @click="audioView = 'waveform'"
          :class="[
            'px-2 py-0.5 text-xs rounded transition-colors',
            audioView === 'waveform'
              ? 'bg-gray-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          ]"
        >
          Waveform
        </button>
        <button
          @click="audioView = 'spectrum'"
          :class="[
            'px-2 py-0.5 text-xs rounded transition-colors',
            audioView === 'spectrum'
              ? 'bg-gray-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          ]"
        >
          Spectrum
        </button>
      </div>

      <!-- Video stats -->
      <div v-if="activeTab === 'video'" class="flex items-center gap-3 text-xs">
        <span class="text-gray-500">{{ resolution.width }}x{{ resolution.height }}</span>
        <span class="text-gray-600">|</span>
        <span class="text-gray-500 truncate max-w-[200px]" :title="gpuInfo">{{ gpuInfo || 'Detecting...' }}</span>
      </div>
    </div>

    <!-- Audio Content -->
    <div v-show="activeTab === 'audio'" class="flex-1 flex flex-col overflow-hidden">
      <!-- Stereo Meter with Limiter Indicator -->
      <div class="px-2 py-1 shrink-0 flex items-center gap-2">
        <canvas ref="stereoMeterRef" class="flex-1 h-8 rounded" />
        <!-- Limiter Indicator -->
        <div class="flex flex-col items-center justify-center w-12 h-8 rounded text-xs"
             :class="isLimiting ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-400'">
          <span class="font-bold text-[10px]">LIM</span>
          <span class="text-[9px]">{{ gainReduction.toFixed(1) }}dB</span>
        </div>
      </div>

      <!-- Audio Visualizer -->
      <div class="flex-1 px-2 pb-2 min-h-0">
        <canvas
          v-show="audioView === 'stereo'"
          ref="stereoScopeRef"
          class="w-full h-full rounded"
        />
        <canvas
          v-show="audioView === 'waveform'"
          ref="waveformCanvasRef"
          class="w-full h-full rounded"
        />
        <canvas
          v-show="audioView === 'spectrum'"
          ref="spectrumCanvasRef"
          class="w-full h-full rounded"
        />
      </div>
    </div>

    <!-- Video Content -->
    <div v-show="activeTab === 'video'" class="flex-1 flex flex-col overflow-hidden">
      <div class="flex-1 flex gap-2 p-2 min-h-0">
        <!-- FPS Graph -->
        <div class="flex-1 flex flex-col">
          <div class="text-xs text-gray-500 mb-1">Frame Rate</div>
          <canvas ref="fpsGraphRef" class="flex-1 w-full rounded" />
        </div>
        <!-- Frame Time Graph -->
        <div class="flex-1 flex flex-col">
          <div class="text-xs text-gray-500 mb-1">Frame Time</div>
          <canvas ref="frameTimeGraphRef" class="flex-1 w-full rounded" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analysis-panel {
  min-height: 160px;
}
</style>
