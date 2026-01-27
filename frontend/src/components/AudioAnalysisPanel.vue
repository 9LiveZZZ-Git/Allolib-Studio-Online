<script setup lang="ts">
/**
 * Audio Analysis Panel
 *
 * Provides real-time audio visualization similar to Faust IDE:
 * - Master level meter with peak indicators
 * - Waveform analyzer (oscilloscope view)
 * - Spectrum analyzer (FFT visualization)
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps<{
  isRunning: boolean
  panelHeight?: number
}>()

// Canvas refs
const meterCanvasRef = ref<HTMLCanvasElement>()
const waveformCanvasRef = ref<HTMLCanvasElement>()
const spectrumCanvasRef = ref<HTMLCanvasElement>()

// Audio analysis state
let analyserNode: AnalyserNode | null = null
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
const peakHoldDuration = 1500 // ms

// View toggle
const activeView = ref<'waveform' | 'spectrum'>('waveform')

// Data arrays
let timeDataArray: Uint8Array
let freqDataArray: Uint8Array

function setupAnalyser() {
  const audioContext = window.alloAudioContext
  const workletNode = window.alloWorkletNode

  if (!audioContext || !workletNode) {
    console.warn('Audio context or worklet not available')
    return
  }

  // Create analyser node
  analyserNode = audioContext.createAnalyser()
  analyserNode.fftSize = fftSize
  analyserNode.smoothingTimeConstant = smoothingTimeConstant

  // Connect worklet -> analyser (for visualization only, audio continues to destination)
  workletNode.connect(analyserNode)

  // Initialize data arrays
  timeDataArray = new Uint8Array(analyserNode.frequencyBinCount)
  freqDataArray = new Uint8Array(analyserNode.frequencyBinCount)

  // Start animation loop
  animate()
}

function teardownAnalyser() {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  if (analyserNode) {
    analyserNode.disconnect()
    analyserNode = null
  }
}

function animate() {
  if (!analyserNode || !props.isRunning) {
    animationId = null
    return
  }

  // Get audio data
  analyserNode.getByteTimeDomainData(timeDataArray)
  analyserNode.getByteFrequencyData(freqDataArray)

  // Calculate levels
  updateLevels()

  // Draw visualizations
  drawMeter()
  if (activeView.value === 'waveform') {
    drawWaveform()
  } else {
    drawSpectrum()
  }

  animationId = requestAnimationFrame(animate)
}

function updateLevels() {
  if (!timeDataArray) return

  // Calculate RMS level from time domain data
  let sumL = 0
  let sumR = 0
  const len = timeDataArray.length

  for (let i = 0; i < len; i++) {
    // Convert from 0-255 to -1 to 1
    const sample = (timeDataArray[i] - 128) / 128
    // Approximate stereo by alternating samples
    if (i % 2 === 0) {
      sumL += sample * sample
    } else {
      sumR += sample * sample
    }
  }

  const rmsL = Math.sqrt(sumL / (len / 2))
  const rmsR = Math.sqrt(sumR / (len / 2))

  // Convert to dB-like scale (0-1 range)
  levelL.value = Math.min(1, rmsL * 3)
  levelR.value = Math.min(1, rmsR * 3)

  // Update peaks
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

function drawMeter() {
  const canvas = meterCanvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  const meterHeight = (height - 4) / 2

  // Clear
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, width, height)

  // Draw meter backgrounds
  ctx.fillStyle = '#2a2a3e'
  ctx.fillRect(20, 2, width - 24, meterHeight - 2)
  ctx.fillRect(20, meterHeight + 4, width - 24, meterHeight - 2)

  // Draw meter fills with gradient
  const meterWidth = width - 24

  // Left channel
  drawMeterBar(ctx, 20, 2, meterWidth, meterHeight - 2, levelL.value, peakL.value)

  // Right channel
  drawMeterBar(ctx, 20, meterHeight + 4, meterWidth, meterHeight - 2, levelR.value, peakR.value)

  // Labels
  ctx.fillStyle = '#888'
  ctx.font = '10px monospace'
  ctx.fillText('L', 4, meterHeight / 2 + 4)
  ctx.fillText('R', 4, meterHeight + meterHeight / 2 + 6)

  // dB scale markers
  ctx.fillStyle = '#555'
  ctx.font = '8px monospace'
  const markers = ['-60', '-40', '-20', '-10', '-6', '-3', '0']
  const positions = [0, 0.1, 0.3, 0.5, 0.65, 0.8, 1.0]
  markers.forEach((label, i) => {
    const x = 20 + positions[i] * meterWidth
    ctx.fillText(label, x - 8, height - 1)
  })
}

function drawMeterBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  width: number, height: number,
  level: number, peak: number
) {
  // Gradient from green to yellow to red
  const gradient = ctx.createLinearGradient(x, 0, x + width, 0)
  gradient.addColorStop(0, '#22c55e')    // Green
  gradient.addColorStop(0.6, '#22c55e')  // Green
  gradient.addColorStop(0.75, '#eab308') // Yellow
  gradient.addColorStop(0.9, '#f97316')  // Orange
  gradient.addColorStop(1, '#ef4444')    // Red

  // Draw level
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, width * level, height)

  // Draw peak indicator
  if (peak > 0.01) {
    const peakX = x + width * peak
    ctx.fillStyle = peak > 0.9 ? '#ef4444' : '#fff'
    ctx.fillRect(peakX - 2, y, 3, height)
  }
}

function drawWaveform() {
  const canvas = waveformCanvasRef.value
  if (!canvas || !timeDataArray) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height

  // Clear with dark background
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, width, height)

  // Draw grid
  ctx.strokeStyle = '#21262d'
  ctx.lineWidth = 1
  ctx.beginPath()

  // Horizontal center line
  ctx.moveTo(0, height / 2)
  ctx.lineTo(width, height / 2)

  // Vertical divisions
  for (let i = 1; i < 8; i++) {
    const x = (width / 8) * i
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  }

  // Horizontal divisions
  ctx.moveTo(0, height / 4)
  ctx.lineTo(width, height / 4)
  ctx.moveTo(0, height * 3 / 4)
  ctx.lineTo(width, height * 3 / 4)

  ctx.stroke()

  // Draw waveform
  ctx.strokeStyle = '#58a6ff'
  ctx.lineWidth = 1.5
  ctx.beginPath()

  const sliceWidth = width / timeDataArray.length
  let x = 0

  for (let i = 0; i < timeDataArray.length; i++) {
    const v = timeDataArray[i] / 255
    const y = v * height

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }

    x += sliceWidth
  }

  ctx.stroke()

  // Labels
  ctx.fillStyle = '#484f58'
  ctx.font = '10px monospace'
  ctx.fillText('+1', 4, 14)
  ctx.fillText(' 0', 4, height / 2 + 4)
  ctx.fillText('-1', 4, height - 4)
}

function drawSpectrum() {
  const canvas = spectrumCanvasRef.value
  if (!canvas || !freqDataArray) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height

  // Clear with dark background
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, width, height)

  // Draw grid
  ctx.strokeStyle = '#21262d'
  ctx.lineWidth = 1
  ctx.beginPath()

  // Horizontal lines (dB levels)
  for (let i = 1; i < 6; i++) {
    const y = (height / 6) * i
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }

  // Vertical lines (frequency decades)
  const freqMarkers = [100, 1000, 10000]
  const nyquist = 22050 // Assuming 44100 sample rate
  freqMarkers.forEach(freq => {
    const x = (Math.log10(freq) - Math.log10(20)) / (Math.log10(nyquist) - Math.log10(20)) * width
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  })

  ctx.stroke()

  // Draw spectrum bars
  const barCount = 64
  const barWidth = width / barCount - 1

  // Create gradient
  const gradient = ctx.createLinearGradient(0, height, 0, 0)
  gradient.addColorStop(0, '#22c55e')
  gradient.addColorStop(0.5, '#58a6ff')
  gradient.addColorStop(1, '#a855f7')

  ctx.fillStyle = gradient

  for (let i = 0; i < barCount; i++) {
    // Logarithmic frequency mapping
    const logIndex = Math.pow(i / barCount, 2) * freqDataArray.length
    const dataIndex = Math.floor(logIndex)
    const value = freqDataArray[dataIndex] / 255
    const barHeight = value * height * 0.9

    const x = i * (barWidth + 1)
    ctx.fillRect(x, height - barHeight, barWidth, barHeight)
  }

  // Frequency labels
  ctx.fillStyle = '#484f58'
  ctx.font = '10px monospace'
  ctx.fillText('20', 2, height - 4)

  const freq100x = (Math.log10(100) - Math.log10(20)) / (Math.log10(nyquist) - Math.log10(20)) * width
  ctx.fillText('100', freq100x - 10, height - 4)

  const freq1kx = (Math.log10(1000) - Math.log10(20)) / (Math.log10(nyquist) - Math.log10(20)) * width
  ctx.fillText('1k', freq1kx - 6, height - 4)

  const freq10kx = (Math.log10(10000) - Math.log10(20)) / (Math.log10(nyquist) - Math.log10(20)) * width
  ctx.fillText('10k', freq10kx - 10, height - 4)

  ctx.fillText('Hz', width - 16, height - 4)
}

// Setup canvas sizes
function setupCanvases() {
  const dpr = window.devicePixelRatio || 1

  if (meterCanvasRef.value) {
    const rect = meterCanvasRef.value.getBoundingClientRect()
    meterCanvasRef.value.width = rect.width * dpr
    meterCanvasRef.value.height = rect.height * dpr
    const ctx = meterCanvasRef.value.getContext('2d')
    ctx?.scale(dpr, dpr)
    meterCanvasRef.value.width = rect.width
    meterCanvasRef.value.height = rect.height
  }

  if (waveformCanvasRef.value) {
    const rect = waveformCanvasRef.value.getBoundingClientRect()
    waveformCanvasRef.value.width = rect.width
    waveformCanvasRef.value.height = rect.height
  }

  if (spectrumCanvasRef.value) {
    const rect = spectrumCanvasRef.value.getBoundingClientRect()
    spectrumCanvasRef.value.width = rect.width
    spectrumCanvasRef.value.height = rect.height
  }
}

// Watch for running state changes
watch(() => props.isRunning, (running) => {
  if (running) {
    // Small delay to ensure audio context is ready
    setTimeout(() => {
      setupCanvases()
      setupAnalyser()
    }, 100)
  } else {
    teardownAnalyser()
    // Reset levels
    levelL.value = 0
    levelR.value = 0
    peakL.value = 0
    peakR.value = 0
  }
})

onMounted(() => {
  setupCanvases()
  window.addEventListener('resize', setupCanvases)
})

onBeforeUnmount(() => {
  teardownAnalyser()
  window.removeEventListener('resize', setupCanvases)
})
</script>

<template>
  <div
    class="audio-analysis-panel bg-editor-sidebar border-t border-editor-border shrink-0"
    :style="panelHeight ? { height: `${panelHeight}px`, minHeight: `${panelHeight}px` } : {}"
  >
    <!-- Header -->
    <div class="h-8 flex items-center justify-between px-3 border-b border-editor-border">
      <span class="text-sm text-gray-400">Audio Analysis</span>
      <div class="flex gap-1">
        <button
          @click="activeView = 'waveform'"
          :class="[
            'px-2 py-0.5 text-xs rounded transition-colors',
            activeView === 'waveform'
              ? 'bg-allolib-blue text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          ]"
        >
          Waveform
        </button>
        <button
          @click="activeView = 'spectrum'"
          :class="[
            'px-2 py-0.5 text-xs rounded transition-colors',
            activeView === 'spectrum'
              ? 'bg-allolib-blue text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          ]"
        >
          Spectrum
        </button>
      </div>
    </div>

    <!-- Master Meter -->
    <div class="px-2 py-1">
      <div class="text-xs text-gray-500 mb-1">Master</div>
      <canvas
        ref="meterCanvasRef"
        class="w-full h-10 rounded"
      />
    </div>

    <!-- Waveform / Spectrum Display -->
    <div class="px-2 pb-2">
      <canvas
        v-show="activeView === 'waveform'"
        ref="waveformCanvasRef"
        class="w-full h-24 rounded"
      />
      <canvas
        v-show="activeView === 'spectrum'"
        ref="spectrumCanvasRef"
        class="w-full h-24 rounded"
      />
    </div>
  </div>
</template>

<style scoped>
.audio-analysis-panel {
  min-height: 160px;
}
</style>
