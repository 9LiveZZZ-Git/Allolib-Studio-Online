<script setup lang="ts">
/**
 * Toolbar Panel
 *
 * Provides parameter controls and real-time analysis with tabs:
 * - Params: Parameter controls for the running application
 * - Audio: Stereo meters, waveform, spectrum analyzer
 * - Video: FPS counter, frame time, render stats
 */
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { parameterSystem, ParameterType, type Parameter, type ParameterGroup } from '@/utils/parameter-system'
import { useProjectStore } from '@/stores/project'
import { useSequencerStore } from '@/stores/sequencer'
import TimelinePanel from './timeline/TimelinePanel.vue'

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

// Parameter panel state
const parameterGroups = ref<ParameterGroup[]>([])
const expandedGroups = ref<Set<string>>(new Set(['Parameters', 'Audio', 'Graphics', 'Color']))
const showPresetMenu = ref(false)
const newPresetName = ref('')
const presetList = ref<string[]>([])

function updateParameters() {
  parameterGroups.value = parameterSystem.getGrouped()
}

// Update preset list from project files
function updatePresetList() {
  const synthName = extractSynthName()
  const dataFolder = `bin/${synthName}-data`

  // Find all .preset files in the data folder
  const presets: string[] = []
  for (const file of projectStore.files) {
    if (file.path.startsWith(dataFolder) && file.path.endsWith('.preset')) {
      // Use the filename without extension as the preset name
      const name = file.name.replace('.preset', '')
      presets.push(name)
    }
  }

  // Sort numerically if they're numbers, otherwise alphabetically
  presets.sort((a, b) => {
    const numA = parseInt(a)
    const numB = parseInt(b)
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB
    return a.localeCompare(b)
  })

  presetList.value = presets
}

const hasParameters = computed(() => parameterSystem.count > 0)

// Subscribe to parameter changes
let paramUnsubscribe: (() => void) | null = null

// Main tab state - switches to 'params' when parameters appear
const activeTab = ref<'audio' | 'video' | 'params' | 'timeline'>('audio')

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

// Spectrum analyzer settings - professional grade
const spectrumSettings = ref({
  fftSize: 8192,           // 4096 bins - good balance of resolution and performance
  smoothing: 0.8,          // Temporal smoothing
  minDb: -90,              // Minimum dB display
  maxDb: -10,               // Maximum dB display
  showPeaks: true,         // Show peak hold
  logScale: true,          // Logarithmic frequency scale
  fillSpectrum: true,      // Fill under the curve
})

// Available FFT sizes (must be power of 2, 32-32768)
const fftSizeOptions = [
  { label: '1K bins (2048)', value: 2048 },
  { label: '2K bins (4096)', value: 4096 },
  { label: '4K bins (8192)', value: 8192 },
  { label: '8K bins (16384)', value: 16384 },
  { label: '16K bins (32768)', value: 32768 },
]

// Spectrum state
let peakData: Float32Array | null = null
const peakDecayRate = 0.002  // dB per frame
let spectrumHoverInfo = ref<{ freq: number; db: number; x: number; y: number } | null>(null)
const showSpectrumSettings = ref(false)

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
let freqDataArrayL: Float32Array  // Use Float32 for dB precision
let sampleRate = 44100  // Will be updated from AudioContext

function setupAnalyser() {
  const audioContext = window.alloAudioContext
  const workletNode = window.alloWorkletNode

  if (!audioContext || !workletNode) {
    console.warn('Audio context or worklet not available')
    return
  }

  // Get actual sample rate
  sampleRate = audioContext.sampleRate

  // Create channel splitter for true stereo analysis
  splitterNode = audioContext.createChannelSplitter(2)

  // Create separate analysers for L and R with high-resolution FFT
  analyserNodeL = audioContext.createAnalyser()
  analyserNodeL.fftSize = spectrumSettings.value.fftSize
  analyserNodeL.smoothingTimeConstant = spectrumSettings.value.smoothing

  analyserNodeR = audioContext.createAnalyser()
  analyserNodeR.fftSize = spectrumSettings.value.fftSize
  analyserNodeR.smoothingTimeConstant = spectrumSettings.value.smoothing

  // Connect: worklet -> splitter -> analysers
  workletNode.connect(splitterNode)
  splitterNode.connect(analyserNodeL, 0)
  splitterNode.connect(analyserNodeR, 1)

  // Initialize data arrays - use Float32 for frequency data (dB precision)
  timeDataArrayL = new Uint8Array(analyserNodeL.frequencyBinCount)
  timeDataArrayR = new Uint8Array(analyserNodeR.frequencyBinCount)
  freqDataArrayL = new Float32Array(analyserNodeL.frequencyBinCount)

  // Initialize peak hold array
  peakData = new Float32Array(analyserNodeL.frequencyBinCount)
  peakData.fill(spectrumSettings.value.minDb)

  // Initialize video stats
  fpsHistory = new Array(historyLength).fill(0)
  frameTimeHistory = new Array(historyLength).fill(0)

  // Start animation loop
  lastFrameTime = performance.now()
  animate()
}

// Update analyser FFT size when settings change
function updateAnalyserSettings() {
  if (analyserNodeL && analyserNodeR) {
    analyserNodeL.fftSize = spectrumSettings.value.fftSize
    analyserNodeL.smoothingTimeConstant = spectrumSettings.value.smoothing
    analyserNodeR.fftSize = spectrumSettings.value.fftSize
    analyserNodeR.smoothingTimeConstant = spectrumSettings.value.smoothing

    // Reinitialize arrays for new size
    timeDataArrayL = new Uint8Array(analyserNodeL.frequencyBinCount)
    timeDataArrayR = new Uint8Array(analyserNodeR.frequencyBinCount)
    freqDataArrayL = new Float32Array(analyserNodeL.frequencyBinCount)
    peakData = new Float32Array(analyserNodeL.frequencyBinCount)
    peakData.fill(spectrumSettings.value.minDb)
  }
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
    // Use Float for frequency data - returns dB values directly
    analyserNodeL.getFloatFrequencyData(freqDataArrayL)
    updateLevels()
    updatePeakHold()
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

// Update peak hold data for spectrum analyzer
function updatePeakHold() {
  if (!freqDataArrayL || !peakData || !spectrumSettings.value.showPeaks) return

  for (let i = 0; i < freqDataArrayL.length; i++) {
    const currentDb = freqDataArrayL[i]
    if (currentDb > peakData[i]) {
      peakData[i] = currentDb
    } else {
      // Decay peaks
      peakData[i] -= peakDecayRate * 60  // Decay per frame (~60fps)
      if (peakData[i] < spectrumSettings.value.minDb) {
        peakData[i] = spectrumSettings.value.minDb
      }
    }
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
  const settings = spectrumSettings.value

  // Margins for labels
  const marginLeft = 35
  const marginBottom = 20
  const marginTop = 5
  const marginRight = 10
  const graphWidth = width - marginLeft - marginRight
  const graphHeight = height - marginBottom - marginTop

  // Clear background
  ctx.fillStyle = '#0d1117'
  ctx.fillRect(0, 0, width, height)

  // Calculate frequency range (20Hz to Nyquist)
  const nyquist = sampleRate / 2
  const minFreq = 20
  const maxFreq = Math.min(20000, nyquist)
  const binCount = freqDataArrayL.length
  const freqPerBin = nyquist / binCount

  // dB range
  const dbRange = settings.maxDb - settings.minDb

  // Helper functions
  const freqToX = (freq: number): number => {
    if (settings.logScale) {
      const logMin = Math.log10(minFreq)
      const logMax = Math.log10(maxFreq)
      const logFreq = Math.log10(Math.max(minFreq, Math.min(maxFreq, freq)))
      return marginLeft + ((logFreq - logMin) / (logMax - logMin)) * graphWidth
    } else {
      return marginLeft + ((freq - minFreq) / (maxFreq - minFreq)) * graphWidth
    }
  }

  const xToFreq = (x: number): number => {
    const normalizedX = (x - marginLeft) / graphWidth
    if (settings.logScale) {
      const logMin = Math.log10(minFreq)
      const logMax = Math.log10(maxFreq)
      return Math.pow(10, logMin + normalizedX * (logMax - logMin))
    } else {
      return minFreq + normalizedX * (maxFreq - minFreq)
    }
  }

  const dbToY = (db: number): number => {
    const clampedDb = Math.max(settings.minDb, Math.min(settings.maxDb, db))
    return marginTop + (1 - (clampedDb - settings.minDb) / dbRange) * graphHeight
  }

  // Draw dB grid lines and labels
  ctx.strokeStyle = '#21262d'
  ctx.lineWidth = 1
  ctx.fillStyle = '#484f58'
  ctx.font = '9px monospace'
  ctx.textAlign = 'right'

  const dbSteps = [-90, -80, -70, -60, -50, -40, -30, -20, -10, 0]
  for (const db of dbSteps) {
    if (db >= settings.minDb && db <= settings.maxDb) {
      const y = dbToY(db)
      ctx.beginPath()
      ctx.moveTo(marginLeft, y)
      ctx.lineTo(width - marginRight, y)
      ctx.stroke()
      ctx.fillText(`${db}`, marginLeft - 4, y + 3)
    }
  }

  // Draw frequency grid lines and labels
  ctx.textAlign = 'center'
  const freqLabels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  for (const freq of freqLabels) {
    if (freq >= minFreq && freq <= maxFreq) {
      const x = freqToX(freq)
      if (x >= marginLeft && x <= width - marginRight) {
        ctx.beginPath()
        ctx.strokeStyle = '#21262d'
        ctx.moveTo(x, marginTop)
        ctx.lineTo(x, height - marginBottom)
        ctx.stroke()

        // Format frequency label
        let label: string
        if (freq >= 1000) {
          label = `${freq / 1000}k`
        } else {
          label = `${freq}`
        }
        ctx.fillStyle = '#484f58'
        ctx.fillText(label, x, height - 5)
      }
    }
  }

  // Build spectrum path
  ctx.beginPath()
  let firstPoint = true

  for (let i = 0; i < binCount; i++) {
    const freq = i * freqPerBin
    if (freq < minFreq || freq > maxFreq) continue

    const x = freqToX(freq)
    if (x < marginLeft || x > width - marginRight) continue

    const db = freqDataArrayL[i]
    const y = dbToY(db)

    if (firstPoint) {
      ctx.moveTo(x, y)
      firstPoint = false
    } else {
      ctx.lineTo(x, y)
    }
  }

  // Draw filled spectrum
  if (settings.fillSpectrum) {
    // Create gradient for fill
    const gradient = ctx.createLinearGradient(0, marginTop, 0, height - marginBottom)
    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.8)')   // Purple at top
    gradient.addColorStop(0.3, 'rgba(88, 166, 255, 0.6)')  // Blue
    gradient.addColorStop(0.7, 'rgba(34, 197, 94, 0.4)')   // Green
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0.1)')     // Faded green at bottom

    // Complete the path for fill
    ctx.lineTo(width - marginRight, height - marginBottom)
    ctx.lineTo(marginLeft, height - marginBottom)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()
  }

  // Draw spectrum line
  ctx.beginPath()
  firstPoint = true
  for (let i = 0; i < binCount; i++) {
    const freq = i * freqPerBin
    if (freq < minFreq || freq > maxFreq) continue

    const x = freqToX(freq)
    if (x < marginLeft || x > width - marginRight) continue

    const db = freqDataArrayL[i]
    const y = dbToY(db)

    if (firstPoint) {
      ctx.moveTo(x, y)
      firstPoint = false
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.strokeStyle = '#58a6ff'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Draw peak hold
  if (settings.showPeaks && peakData) {
    ctx.beginPath()
    firstPoint = true
    for (let i = 0; i < binCount; i++) {
      const freq = i * freqPerBin
      if (freq < minFreq || freq > maxFreq) continue

      const x = freqToX(freq)
      if (x < marginLeft || x > width - marginRight) continue

      const db = peakData[i]
      const y = dbToY(db)

      if (firstPoint) {
        ctx.moveTo(x, y)
        firstPoint = false
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)'  // Red peaks
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Draw hover info
  if (spectrumHoverInfo.value) {
    const info = spectrumHoverInfo.value
    const freq = info.freq
    const db = info.db

    // Draw crosshair
    const hoverX = freqToX(freq)
    const hoverY = dbToY(db)

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(hoverX, marginTop)
    ctx.lineTo(hoverX, height - marginBottom)
    ctx.moveTo(marginLeft, hoverY)
    ctx.lineTo(width - marginRight, hoverY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw info box
    const freqStr = freq >= 1000 ? `${(freq / 1000).toFixed(2)}kHz` : `${freq.toFixed(1)}Hz`
    const dbStr = `${db.toFixed(1)}dB`
    const text = `${freqStr}  ${dbStr}`

    ctx.font = 'bold 11px monospace'
    const textWidth = ctx.measureText(text).width + 10

    let boxX = hoverX + 10
    let boxY = hoverY - 25
    if (boxX + textWidth > width - marginRight) boxX = hoverX - textWidth - 10
    if (boxY < marginTop) boxY = hoverY + 10

    ctx.fillStyle = 'rgba(30, 30, 40, 0.9)'
    ctx.fillRect(boxX, boxY, textWidth, 20)
    ctx.strokeStyle = '#58a6ff'
    ctx.lineWidth = 1
    ctx.strokeRect(boxX, boxY, textWidth, 20)

    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.fillText(text, boxX + 5, boxY + 14)
  }

  // Draw bin count info
  ctx.fillStyle = '#484f58'
  ctx.font = '9px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`${binCount} bins`, width - marginRight, marginTop + 10)
}

// Handle spectrum canvas mouse events
function handleSpectrumMouseMove(event: MouseEvent) {
  const canvas = spectrumCanvasRef.value
  if (!canvas || !freqDataArrayL) return

  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const width = canvas.width
  const height = canvas.height
  const settings = spectrumSettings.value

  const marginLeft = 35
  const marginBottom = 20
  const marginTop = 5
  const marginRight = 10
  const graphWidth = width - marginLeft - marginRight
  const graphHeight = height - marginBottom - marginTop

  // Check if within graph area
  if (x < marginLeft || x > width - marginRight || y < marginTop || y > height - marginBottom) {
    spectrumHoverInfo.value = null
    return
  }

  const nyquist = sampleRate / 2
  const minFreq = 20
  const maxFreq = Math.min(20000, nyquist)
  const binCount = freqDataArrayL.length
  const freqPerBin = nyquist / binCount

  // Calculate frequency from X position
  const normalizedX = (x - marginLeft) / graphWidth
  let freq: number
  if (settings.logScale) {
    const logMin = Math.log10(minFreq)
    const logMax = Math.log10(maxFreq)
    freq = Math.pow(10, logMin + normalizedX * (logMax - logMin))
  } else {
    freq = minFreq + normalizedX * (maxFreq - minFreq)
  }

  // Find the closest bin
  const binIndex = Math.round(freq / freqPerBin)
  if (binIndex >= 0 && binIndex < binCount) {
    const db = freqDataArrayL[binIndex]
    spectrumHoverInfo.value = { freq, db, x, y }
  }
}

function handleSpectrumMouseLeave() {
  spectrumHoverInfo.value = null
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

// Parameter panel functions
function toggleGroup(groupName: string) {
  if (expandedGroups.value.has(groupName)) {
    expandedGroups.value.delete(groupName)
  } else {
    expandedGroups.value.add(groupName)
  }
}

function handleSliderChange(param: Parameter, event: Event) {
  const target = event.target as HTMLInputElement
  parameterSystem.setByIndex(param.index, parseFloat(target.value))
}

function handleBoolToggle(param: Parameter) {
  parameterSystem.setByIndex(param.index, param.value === 0 ? 1 : 0)
}

function handleMenuChange(param: Parameter, event: Event) {
  const target = event.target as HTMLSelectElement
  parameterSystem.setByIndex(param.index, parseInt(target.value))
}

function handleTrigger(param: Parameter) {
  parameterSystem.trigger(param.index)
}

function resetToDefault(param: Parameter) {
  parameterSystem.resetToDefault(param.index)
}

function formatValue(param: Parameter): string {
  const value = param.value
  if (param.type === ParameterType.INT || param.type === ParameterType.MENU) {
    return Math.round(value).toString()
  }
  if (param.type === ParameterType.BOOL) {
    return value > 0.5 ? 'On' : 'Off'
  }
  if (Math.abs(value) < 0.001 && value !== 0) return value.toExponential(2)
  if (Math.abs(value) < 10) return value.toFixed(3)
  if (Math.abs(value) < 100) return value.toFixed(2)
  return value.toFixed(1)
}

function getStep(param: Parameter): number {
  if (param.type === ParameterType.INT || param.type === ParameterType.MENU) return 1
  const range = param.max - param.min
  if (range <= 1) return 0.001
  if (range <= 10) return 0.01
  if (range <= 100) return 0.1
  return 1
}

// Save preset with custom name to project file
function savePreset() {
  if (!newPresetName.value.trim()) return

  const synthName = extractSynthName()
  const dataFolder = `bin/${synthName}-data`
  const presetName = newPresetName.value.trim()
  const presetPath = `${dataFolder}/${presetName}.preset`

  // Create folders if needed
  if (!projectStore.folders.some(f => f.path === 'bin')) {
    projectStore.createFolder('bin')
  }
  if (!projectStore.folders.some(f => f.path === dataFolder)) {
    projectStore.createFolder(`${synthName}-data`, 'bin')
  }

  // Find preset number (use existing number or find next)
  let presetNum = parseInt(presetName)
  if (isNaN(presetNum)) {
    presetNum = findNextPresetNumber(synthName)
  }

  // Generate and save preset content
  const content = generatePresetContent(presetNum)
  const result = projectStore.createDataFile(presetPath, content)

  if (result.success) {
    projectStore.saveProject()
    console.log(`[Preset] Saved: ${presetPath}`)
  }

  newPresetName.value = ''
  updatePresetList()
  showPresetMenu.value = false
}

// Project store for file operations
const projectStore = useProjectStore()

/**
 * Extract synth name from the project code
 * Looks for SynthGUIManager<...> synthManager{"Name"} pattern
 */
function extractSynthName(): string {
  const mainFile = projectStore.getFileContent(projectStore.mainFilePath)
  if (!mainFile) return 'Synth'

  // Look for SynthGUIManager pattern: SynthGUIManager<...> name{"SynthName"}
  const match = mainFile.match(/SynthGUIManager<[^>]+>\s+\w+\s*\{\s*"([^"]+)"\s*\}/)
  if (match) return match[1]

  // Fallback: look for simpler pattern
  const match2 = mainFile.match(/SynthGUIManager<(\w+)>/)
  if (match2) return match2[1]

  return 'Synth'
}

/**
 * Generate allolib preset file content
 * Format: ::N\n/paramName f value\n...\n::
 */
function generatePresetContent(presetNumber: number): string {
  const params = parameterSystem.getAll()
  let content = `::${presetNumber}\n`

  for (const param of params) {
    // Skip trigger parameters (no persistent value)
    if (param.type === ParameterType.TRIGGER) continue

    // Format: /paramName f value (f for float)
    const typeChar = param.type === ParameterType.INT ? 'i' : 'f'
    content += `/${param.name} ${typeChar} ${param.value.toFixed(6)} \n`
  }

  content += '::\n'
  return content
}

/**
 * Find the next available preset number
 */
function findNextPresetNumber(synthName: string): number {
  const dataFolder = `bin/${synthName}-data`
  let num = 0

  // Check existing files to find next available number
  for (const file of projectStore.files) {
    if (file.path.startsWith(dataFolder) && file.path.endsWith('.preset')) {
      const match = file.path.match(/(\d+)\.preset$/)
      if (match) {
        const existingNum = parseInt(match[1])
        if (existingNum >= num) {
          num = existingNum + 1
        }
      }
    }
  }

  return num
}

// Quick save preset as allolib-format file
function quickSavePreset() {
  const synthName = extractSynthName()
  const dataFolder = `bin/${synthName}-data`
  const presetNum = findNextPresetNumber(synthName)
  const presetPath = `${dataFolder}/${presetNum}.preset`

  console.log(`[Preset] Quick save: synthName=${synthName}, path=${presetPath}`)

  // Create the bin folder if needed
  if (!projectStore.folders.some(f => f.path === 'bin')) {
    const binResult = projectStore.createFolder('bin')
    console.log(`[Preset] Created bin folder:`, binResult)
  }

  // Create the data folder if needed
  if (!projectStore.folders.some(f => f.path === dataFolder)) {
    const dataResult = projectStore.createFolder(`${synthName}-data`, 'bin')
    console.log(`[Preset] Created data folder:`, dataResult)
  }

  // Generate preset content
  const content = generatePresetContent(presetNum)
  console.log(`[Preset] Generated content:`, content)

  // Create the preset file using the store's data file function
  const result = projectStore.createDataFile(presetPath, content)

  if (result.success) {
    // Save project to localStorage
    projectStore.saveProject()
    console.log(`[Preset] Saved preset to ${presetPath}`)
  } else {
    console.error(`[Preset] Failed to save: ${result.error}`)
  }
}

// Parse allolib preset file content and apply values
function loadPreset(name: string) {
  const synthName = extractSynthName()
  const presetPath = `bin/${synthName}-data/${name}.preset`

  const file = projectStore.getFileByPath(presetPath)
  if (!file) {
    console.error(`[Preset] File not found: ${presetPath}`)
    return
  }

  // Parse the preset file
  // Format: ::N\n/paramName f value\n...\n::
  const lines = file.content.split('\n')
  for (const line of lines) {
    // Match parameter lines: /paramName f value or /paramName i value
    const match = line.match(/^\/(\S+)\s+[fi]\s+([\d.-]+)/)
    if (match) {
      const paramName = match[1]
      const value = parseFloat(match[2])
      parameterSystem.set(paramName, value)
    }
  }

  console.log(`[Preset] Loaded preset: ${name}`)
  showPresetMenu.value = false
}

// Delete a preset file from the project
function deletePreset(name: string, event: Event) {
  event.stopPropagation()
  if (confirm(`Delete preset "${name}"?`)) {
    const synthName = extractSynthName()
    const presetPath = `bin/${synthName}-data/${name}.preset`

    const result = projectStore.deleteFile(presetPath)
    if (result.success) {
      projectStore.saveProject()
      updatePresetList()
      console.log(`[Preset] Deleted: ${presetPath}`)
    } else {
      console.error(`[Preset] Failed to delete: ${result.error}`)
    }
  }
}

// Watch for file changes to update preset list
watch(() => projectStore.files, () => {
  updatePresetList()
}, { deep: true })

onMounted(() => {
  setupCanvases()
  window.addEventListener('resize', setupCanvases)

  // Subscribe to parameter changes
  updateParameters()
  updatePresetList()
  paramUnsubscribe = parameterSystem.subscribe(() => {
    updateParameters()
    // Auto-switch to params tab when parameters appear
    if (parameterSystem.count > 0 && activeTab.value !== 'params') {
      activeTab.value = 'params'
    }
  })
})

onBeforeUnmount(() => {
  teardownAnalyser()
  window.removeEventListener('resize', setupCanvases)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
  if (paramUnsubscribe) paramUnsubscribe()
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
        <span class="text-sm text-gray-400">Toolbar</span>
        <div class="flex gap-1 ml-2">
          <!-- Params tab - always visible -->
          <button
            @click="activeTab = 'params'"
            :class="[
              'px-2 py-0.5 text-xs rounded transition-colors',
              activeTab === 'params'
                ? 'bg-allolib-blue text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            ]"
          >
            Params
            <span v-if="hasParameters" class="ml-1 text-[10px] opacity-70">({{ parameterSystem.count }})</span>
          </button>
          <button
            @click="activeTab = 'timeline'"
            :class="[
              'px-2 py-0.5 text-xs rounded transition-colors',
              activeTab === 'timeline'
                ? 'bg-allolib-blue text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            ]"
          >
            Timeline
          </button>
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
      <div v-if="activeTab === 'audio'" class="flex items-center gap-1">
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

        <!-- Spectrum Settings Button -->
        <div v-if="audioView === 'spectrum'" class="relative ml-2">
          <button
            @click="showSpectrumSettings = !showSpectrumSettings"
            class="px-2 py-0.5 text-xs rounded transition-colors text-gray-400 hover:text-white hover:bg-gray-700"
            title="Spectrum Settings"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          <!-- Settings Dropdown -->
          <div
            v-if="showSpectrumSettings"
            class="absolute top-7 right-0 w-56 bg-editor-sidebar border border-editor-border rounded shadow-lg z-50 p-2 space-y-2"
          >
            <div class="text-xs text-gray-400 font-semibold border-b border-editor-border pb-1 mb-2">Spectrum Settings</div>

            <!-- FFT Size -->
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">FFT Size:</label>
              <select
                v-model.number="spectrumSettings.fftSize"
                @change="updateAnalyserSettings"
                class="w-28 h-5 text-xs bg-gray-700 border border-gray-600 rounded px-1 text-gray-300"
              >
                <option v-for="opt in fftSizeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- Smoothing -->
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Smoothing:</label>
              <input
                type="range"
                v-model.number="spectrumSettings.smoothing"
                @change="updateAnalyserSettings"
                min="0"
                max="0.99"
                step="0.01"
                class="w-20 h-3"
              />
              <span class="text-xs text-gray-500 w-8 text-right">{{ spectrumSettings.smoothing.toFixed(2) }}</span>
            </div>

            <!-- dB Range -->
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Min dB:</label>
              <input
                type="range"
                v-model.number="spectrumSettings.minDb"
                min="-120"
                max="-30"
                step="5"
                class="w-20 h-3"
              />
              <span class="text-xs text-gray-500 w-10 text-right">{{ spectrumSettings.minDb }}dB</span>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Max dB:</label>
              <input
                type="range"
                v-model.number="spectrumSettings.maxDb"
                min="-30"
                max="0"
                step="5"
                class="w-20 h-3"
              />
              <span class="text-xs text-gray-500 w-10 text-right">{{ spectrumSettings.maxDb }}dB</span>
            </div>

            <!-- Toggles -->
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Log Scale:</label>
              <button
                @click="spectrumSettings.logScale = !spectrumSettings.logScale"
                :class="[
                  'w-8 h-4 rounded-full transition-colors',
                  spectrumSettings.logScale ? 'bg-allolib-blue' : 'bg-gray-600'
                ]"
              >
                <div
                  :class="[
                    'w-3 h-3 rounded-full bg-white shadow transform transition-transform',
                    spectrumSettings.logScale ? 'translate-x-4' : 'translate-x-0.5'
                  ]"
                />
              </button>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Peak Hold:</label>
              <button
                @click="spectrumSettings.showPeaks = !spectrumSettings.showPeaks"
                :class="[
                  'w-8 h-4 rounded-full transition-colors',
                  spectrumSettings.showPeaks ? 'bg-allolib-blue' : 'bg-gray-600'
                ]"
              >
                <div
                  :class="[
                    'w-3 h-3 rounded-full bg-white shadow transform transition-transform',
                    spectrumSettings.showPeaks ? 'translate-x-4' : 'translate-x-0.5'
                  ]"
                />
              </button>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Fill Spectrum:</label>
              <button
                @click="spectrumSettings.fillSpectrum = !spectrumSettings.fillSpectrum"
                :class="[
                  'w-8 h-4 rounded-full transition-colors',
                  spectrumSettings.fillSpectrum ? 'bg-allolib-blue' : 'bg-gray-600'
                ]"
              >
                <div
                  :class="[
                    'w-3 h-3 rounded-full bg-white shadow transform transition-transform',
                    spectrumSettings.fillSpectrum ? 'translate-x-4' : 'translate-x-0.5'
                  ]"
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Video stats -->
      <div v-if="activeTab === 'video'" class="flex items-center gap-3 text-xs">
        <span class="text-gray-500">{{ resolution.width }}x{{ resolution.height }}</span>
        <span class="text-gray-600">|</span>
        <span class="text-gray-500 truncate max-w-[200px]" :title="gpuInfo">{{ gpuInfo || 'Detecting...' }}</span>
      </div>
    </div>

    <!-- Parameters Content -->
    <div v-show="activeTab === 'params'" class="flex-1 flex flex-col overflow-hidden">
      <div class="flex-1 overflow-y-auto">
        <div v-for="group in parameterGroups" :key="group.name" class="border-b border-editor-border last:border-b-0">
          <!-- Group Header -->
          <button
            class="w-full px-3 py-1 flex items-center gap-1 text-xs hover:bg-editor-active bg-editor-sidebar"
            @click="toggleGroup(group.name)"
          >
            <svg
              class="w-2.5 h-2.5 text-gray-500 transition-transform flex-shrink-0"
              :class="{ 'rotate-90': expandedGroups.has(group.name) }"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            <span class="text-gray-300 font-medium">{{ group.name }}</span>
            <span class="text-gray-500">({{ group.parameters.length }})</span>
          </button>

          <!-- Parameters -->
          <div v-if="expandedGroups.has(group.name)" class="px-3 py-1.5 space-y-1.5 bg-editor-bg">
            <div v-for="param in group.parameters" :key="param.index" class="flex items-center gap-2">
              <!-- Float/Int Slider -->
              <template v-if="param.type === ParameterType.FLOAT || param.type === ParameterType.INT">
                <label
                  class="text-xs text-gray-400 w-24 truncate flex-shrink-0 cursor-pointer"
                  :title="param.name + ' (double-click to reset)'"
                  @dblclick="resetToDefault(param)"
                >
                  {{ param.displayName }}
                </label>
                <input
                  type="range"
                  :min="param.min"
                  :max="param.max"
                  :step="getStep(param)"
                  :value="param.value"
                  @input="handleSliderChange(param, $event)"
                  class="flex-1 h-3 bg-gray-700 rounded appearance-none cursor-pointer accent-allolib-blue"
                />
                <span class="text-xs text-blue-400 font-mono w-12 text-right">
                  {{ formatValue(param) }}
                </span>
              </template>

              <!-- Bool Toggle -->
              <template v-else-if="param.type === ParameterType.BOOL">
                <label class="text-xs text-gray-400 w-24 truncate flex-shrink-0">
                  {{ param.displayName }}
                </label>
                <button
                  @click="handleBoolToggle(param)"
                  :class="[
                    'w-4 h-4 border rounded-sm flex items-center justify-center',
                    param.value > 0.5 ? 'bg-allolib-blue border-allolib-blue' : 'bg-gray-700 border-gray-600'
                  ]"
                >
                  <svg v-if="param.value > 0.5" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </template>

              <!-- Menu -->
              <template v-else-if="param.type === ParameterType.MENU">
                <label class="text-xs text-gray-400 w-24 truncate flex-shrink-0">
                  {{ param.displayName }}
                </label>
                <select
                  :value="Math.round(param.value)"
                  @change="handleMenuChange(param, $event)"
                  class="flex-1 h-5 text-xs bg-gray-700 border border-gray-600 rounded px-1 text-gray-300"
                >
                  <option v-for="i in (param.max + 1)" :key="i - 1" :value="i - 1">
                    Option {{ i - 1 }}
                  </option>
                </select>
              </template>

              <!-- Trigger -->
              <template v-else-if="param.type === ParameterType.TRIGGER">
                <label class="text-xs text-gray-400 w-24 truncate flex-shrink-0">
                  {{ param.displayName }}
                </label>
                <button
                  @click="handleTrigger(param)"
                  class="px-3 h-5 text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded text-gray-300"
                >
                  Trigger
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Preset Footer -->
      <div class="px-3 py-1.5 border-t border-editor-border bg-editor-sidebar flex items-center gap-2 shrink-0">
        <span class="text-xs text-gray-500">Presets:</span>
        <div class="relative flex-1">
          <button
            @click="showPresetMenu = !showPresetMenu"
            class="w-full h-5 text-xs bg-gray-700 border border-gray-600 rounded px-2 text-left text-gray-300 flex items-center justify-between"
          >
            <span>{{ presetList.length > 0 ? `${presetList.length} saved` : 'None' }}</span>
            <svg class="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>

          <!-- Preset dropdown -->
          <div
            v-if="showPresetMenu"
            class="absolute bottom-6 left-0 w-48 bg-editor-sidebar border border-editor-border rounded shadow-lg z-50"
          >
            <div v-if="presetList.length > 0" class="max-h-32 overflow-y-auto">
              <div
                v-for="preset in presetList"
                :key="preset"
                @click="loadPreset(preset)"
                class="w-full px-2 py-1 text-xs text-left text-gray-300 hover:bg-editor-active flex items-center justify-between group cursor-pointer"
              >
                <span>{{ preset }}</span>
                <span
                  @click.stop="deletePreset(preset, $event)"
                  class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 px-1 cursor-pointer"
                >
                  ✕
                </span>
              </div>
            </div>
            <div v-else class="px-2 py-1 text-xs text-gray-500 italic">No presets</div>
            <div class="border-t border-editor-border px-2 py-1.5 flex gap-1">
              <input
                v-model="newPresetName"
                @keyup.enter="savePreset"
                placeholder="New preset"
                class="flex-1 h-5 text-xs bg-gray-700 border border-gray-600 rounded px-1 text-gray-300"
              />
              <button
                @click="savePreset"
                :disabled="!newPresetName.trim()"
                class="px-2 h-5 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-300 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
        <button
          @click="quickSavePreset"
          class="px-2 h-5 text-xs bg-blue-600 hover:bg-blue-500 border border-blue-700 rounded text-white"
          title="Save preset as 'Preset N'"
        >
          Quick Save
        </button>
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
          class="w-full h-full rounded cursor-crosshair"
          @mousemove="handleSpectrumMouseMove"
          @mouseleave="handleSpectrumMouseLeave"
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

    <!-- Timeline Content (Unified Timeline) -->
    <div v-show="activeTab === 'timeline'" class="flex-1 flex flex-col overflow-hidden">
      <TimelinePanel class="flex-1" />
    </div>

  </div>
</template>

<style scoped>
.analysis-panel {
  min-height: 160px;
}

/* Parameter slider styling */
.analysis-panel input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: #374151;
  border-radius: 4px;
}

.analysis-panel input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 14px;
  background: #9ca3af;
  border-radius: 2px;
  cursor: grab;
}

.analysis-panel input[type="range"]::-webkit-slider-thumb:active {
  cursor: grabbing;
  background: #58a6ff;
}

.analysis-panel input[type="range"]::-moz-range-thumb {
  width: 10px;
  height: 14px;
  background: #9ca3af;
  border-radius: 2px;
  border: none;
  cursor: grab;
}

.analysis-panel input[type="range"]::-moz-range-thumb:active {
  cursor: grabbing;
  background: #58a6ff;
}
</style>
