/**
 * AlloLib WASM Runtime Manager
 *
 * Manages the lifecycle of AlloLib WebAssembly applications
 * including graphics rendering and audio processing.
 */

import { parameterSystem } from '@/utils/parameter-system'
import { useSettingsStore } from '@/stores/settings'
import { objectManagerBridge } from '@/services/objectManager'

export interface RuntimeConfig {
  canvas: HTMLCanvasElement
  onPrint?: (text: string) => void
  onError?: (error: string) => void
  onExit?: (code: number) => void
}

export interface WasmModule {
  // Emscripten standard exports
  _main?: () => number
  _malloc?: (size: number) => number
  _free?: (ptr: number) => void
  cwrap?: (name: string, returnType: string, argTypes: string[]) => (...args: unknown[]) => unknown
  ccall?: (name: string, returnType: string, argTypes: string[], args: unknown[]) => unknown
  UTF8ToString?: (ptr: number) => string
  HEAPF32?: Float32Array
  HEAPU8?: Uint8Array
  canvas?: HTMLCanvasElement
  GL?: WebGLRenderingContext

  // AlloLib-specific exports
  _allolib_create?: () => void
  _allolib_configure_backend?: (type: number) => void
  _allolib_start?: () => void
  _allolib_stop?: () => void
  _allolib_destroy?: () => void
  _allolib_process_audio?: (buffer: number, frames: number, channels: number) => void
  _allolib_configure_audio?: (sampleRate: number, bufferSize: number, outCh: number, inCh: number) => void

  // WebControlGUI exports (parameter panel)
  _al_webgui_get_parameter_count?: () => number
  _al_webgui_get_parameter_name?: (index: number) => number // Returns pointer to string
  _al_webgui_get_parameter_group?: (index: number) => number // Returns pointer to string
  _al_webgui_get_parameter_type?: (index: number) => number
  _al_webgui_get_parameter_min?: (index: number) => number
  _al_webgui_get_parameter_max?: (index: number) => number
  _al_webgui_get_parameter_value?: (index: number) => number
  _al_webgui_get_parameter_default?: (index: number) => number
  _al_webgui_set_parameter_value?: (index: number, value: number) => void
  _al_webgui_trigger_parameter?: (index: number) => void

  // WebSequencerBridge exports (voice triggering from sequencer)
  _al_seq_trigger_on?: (id: number, freq: number, amp: number, dur: number) => void
  _al_seq_trigger_off?: (id: number) => void
  _al_seq_set_param?: (voiceId: number, paramIndex: number, value: number) => void
  _al_seq_get_voice_count?: () => number

  // WebGPU context references (set by JS before module renders)
  _webgpuCanvasContext?: GPUCanvasContext
  _webgpuDevice?: GPUDevice
  _webgpuFormat?: GPUTextureFormat
}

declare global {
  interface Window {
    Module: WasmModule | null
    alloAudioContext: AudioContext | null
    alloWorkletNode: AudioWorkletNode | null
    alloSoftClipper: WaveShaperNode | null
    alloLimiter: DynamicsCompressorNode | null
    alloLimiterGain: GainNode | null // For monitoring gain reduction
  }
}

// Generates a tanh-shaped soft clipping lookup table for WaveShaperNode.
// tanh approaches ±1 asymptotically, providing smooth saturation without hard clipping.
function createSoftClipCurve(drive: number = 1.5, samples: number = 8192): Float32Array {
  const curve = new Float32Array(samples)

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1
    curve[i] = Math.tanh(x * drive)
  }

  return curve
}

export class AllolibRuntime {
  private module: WasmModule | null = null
  private canvas: HTMLCanvasElement
  private isRunning = false
  private onPrint: (text: string) => void
  private onError: (text: string) => void
  private onExit: (code: number) => void
  private limiterSettings = {
    enabled: true,
    threshold: -1,
    softClipEnabled: false, // Disabled by default for clean audio
    softClipDrive: 1.5,
  }

  constructor(config: RuntimeConfig) {
    this.canvas = config.canvas
    this.onPrint = config.onPrint || console.log
    this.onError = config.onError || console.error
    this.onExit = config.onExit || (() => {})

    // NOTE: Do NOT pre-create WebGL2 context here!
    // Creating any GL context on the canvas prevents WebGPU from working.
    // The context will be created lazily in load() based on the selected backend.

    this.resize()
  }

  async load(jsUrl: string): Promise<void> {
    this.onPrint('[INFO] Loading AlloLib WASM module...')

    // Clean up any previous module
    this.cleanup()

    try {
      // Get the base URL for loading related files
      const baseUrl = jsUrl.replace(/\/[^/]+$/, '')

      // Load audio worklet processor first
      await this.loadAudioWorklet(baseUrl)

      // Get backend setting from store
      const settings = useSettingsStore()
      const backendType = settings.graphics.backendType || 'webgl2'

      // Clear debug output for backend selection
      this.onPrint(`[Backend] Requested backend: ${backendType}`)

      // Determine which backend to use
      let useWebGPU = false
      let webgpuDevice: GPUDevice | null = null

      if (backendType === 'webgpu' || backendType === 'auto') {
        // Try to initialize WebGPU
        if (navigator.gpu) {
          try {
            this.onPrint('[Backend] navigator.gpu exists, requesting adapter...')
            const adapter = await navigator.gpu.requestAdapter()
            if (adapter) {
              this.onPrint('[Backend] Adapter acquired, requesting device...')
              webgpuDevice = await adapter.requestDevice()
              useWebGPU = true
              this.onPrint('[Backend] WebGPU device acquired successfully!')
            } else {
              this.onPrint('[Backend] WebGPU adapter not available')
            }
          } catch (e) {
            this.onPrint(`[Backend] WebGPU initialization failed: ${e}`)
          }
        } else {
          this.onPrint('[Backend] WebGPU not supported (no navigator.gpu)')
        }

        if (!useWebGPU && backendType === 'webgpu') {
          this.onError('[Backend] ERROR: WebGPU was requested but is not available!')
        }
      } else {
      }

      // Create WebGL2 context only if NOT using WebGPU
      // (WebGL and WebGPU contexts are mutually exclusive on the same canvas)
      let gl: WebGL2RenderingContext | null = null

      if (useWebGPU) {
        // For WebGPU, we need a canvas without any GL context
        // Replace if this canvas has a GL context (switching from WebGL2)
        const hasGLContext = !!(this.canvas as any).__hasGLContext

        if (hasGLContext) {
          this.onPrint('[Backend] Canvas has GL context, creating fresh canvas for WebGPU...')
          const parent = this.canvas.parentElement
          const oldCanvas = this.canvas

          // Create new canvas with same attributes
          const newCanvas = document.createElement('canvas')
          newCanvas.id = oldCanvas.id || 'canvas'
          newCanvas.className = oldCanvas.className
          newCanvas.style.cssText = oldCanvas.style.cssText
          newCanvas.width = oldCanvas.width
          newCanvas.height = oldCanvas.height

          // Clear flags on old canvas
          ;(oldCanvas as any).__hasGLContext = false

          // Replace old canvas in DOM
          if (parent) {
            parent.replaceChild(newCanvas, oldCanvas)
            this.canvas = newCanvas
            ;(window as any).__alloCanvas = newCanvas
            this.onPrint(`[Backend] Fresh canvas created for WebGPU (id=${newCanvas.id})`)
          }
        } else {
          this.onPrint('[Backend] Reusing existing canvas for WebGPU')
        }
        // Mark canvas as WebGPU
        ;(this.canvas as any).__hasGLContext = false
        ;(this.canvas as any).__isWebGPU = true
        ;(window as any).__canvasIsWebGPU = this.canvas
      } else {
        // For WebGL2, we need a canvas without WebGPU context
        // Replace if this canvas was used for WebGPU
        const isWebGPUCanvas = !!(this.canvas as any).__isWebGPU

        if (isWebGPUCanvas) {
          this.onPrint('[Backend] Canvas has WebGPU context, creating fresh canvas for WebGL2...')
          const parent = this.canvas.parentElement
          const oldCanvas = this.canvas

          // Create new canvas with same attributes
          const newCanvas = document.createElement('canvas')
          newCanvas.id = oldCanvas.id || 'canvas'
          newCanvas.className = oldCanvas.className
          newCanvas.style.cssText = oldCanvas.style.cssText
          newCanvas.width = oldCanvas.width
          newCanvas.height = oldCanvas.height

          // Clear flags on old canvas
          ;(oldCanvas as any).__isWebGPU = false

          // Replace old canvas in DOM
          if (parent) {
            parent.replaceChild(newCanvas, oldCanvas)
            this.canvas = newCanvas
            ;(window as any).__alloCanvas = newCanvas
            this.onPrint(`[Backend] Fresh canvas created for WebGL2 (id=${newCanvas.id})`)
          }
        }
        // Mark canvas as WebGL2
        ;(this.canvas as any).__hasGLContext = true
        ;(this.canvas as any).__isWebGPU = false
        ;(window as any).__canvasIsWebGPU = null
        gl = this.canvas.getContext('webgl2', {
          preserveDrawingBuffer: true,  // Required for toDataURL() screenshots
          alpha: true,
          antialias: true,
          depth: true,
          stencil: true,
          premultipliedAlpha: true,
        })
      }

      // Module configuration for Emscripten
      const moduleConfig: {
        canvas: HTMLCanvasElement
        print: (text: string) => void
        printErr: (text: string) => void
        onExit: (code: number) => void
        locateFile: (path: string) => string
        postMainLoop?: () => void
        preinitializedWebGLContext?: WebGL2RenderingContext | null
        preinitializedWebGPUDevice?: GPUDevice
      } = {
        canvas: this.canvas,
        print: (text: string) => this.onPrint(text),
        printErr: (text: string) => this.onError(text),
        onExit: (code: number) => {
          this.isRunning = false
          this.onExit(code)
        },
        locateFile: (path: string) => {
          if (path.endsWith('.wasm')) {
            return jsUrl.replace('.js', '.wasm')
          }
          return `${baseUrl}/${path}`
        },
      }

      // Configure backend-specific options
      if (useWebGPU && webgpuDevice) {
        // For WebGPU, pass the pre-initialized device
        moduleConfig.preinitializedWebGPUDevice = webgpuDevice
        this.onPrint('[Backend] Passing WebGPU device to WASM module')
      } else {
        // For WebGL2, pass pre-created context so Emscripten reuses it
        moduleConfig.preinitializedWebGLContext = gl
        this.onPrint('[Backend] Passing WebGL2 context to WASM module')
      }

      // Hook into Emscripten main loop to count frames and enable captures
      moduleConfig.postMainLoop = () => {
        const w = window as any
        w.__emFrameCount = (w.__emFrameCount || 0) + 1
      }

      // Store backend type for runtime queries
      const activeBackend = useWebGPU ? 'webgpu' : 'webgl2'
      ;(window as any).alloBackendType = activeBackend

      // Final debug output
      this.onPrint(`[Backend] Active backend: ${activeBackend}`)
      this.onPrint(`[Backend] Compute shaders: ${useWebGPU ? 'ENABLED' : 'DISABLED'}`)

      // Dynamically import the ES6 module
      // The module exports a factory function that returns a Promise<Module>
      this.onPrint('[INFO] Importing ES6 module...')
      const createModule = await this.importModule(jsUrl)

      // Set up object registration callback BEFORE module init
      // This allows C++ code in onCreate() to register objects with the timeline
      // The callback will be properly connected after module loads
      this.setupPreInitCallbacks()

      this.onPrint('[INFO] Instantiating WASM module...')
      const wasmModule = await createModule(moduleConfig)

      // Store reference to the module
      this.module = wasmModule as WasmModule
      window.Module = this.module
      // Also store for other systems that need it
      ;(window as any).__alloWasmModule = this.module

      // Configure WebGPU canvas context AFTER module loads
      // The WebGPU backend expects Module._webgpuCanvasContext to be set
      if (useWebGPU && webgpuDevice) {
        await this.configureWebGPUCanvas(webgpuDevice)
      }

      this.onPrint('[SUCCESS] AlloLib WASM module loaded')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.onError(`[ERROR] Failed to load module: ${message}`)
      throw error
    }
  }

  /**
   * Set up callbacks that need to exist BEFORE module initialization.
   * This is critical for C++ code that registers objects in onCreate().
   */
  private setupPreInitCallbacks(): void {
    // Ensure window.allolib namespace exists
    ;(window as any).allolib = (window as any).allolib || {}

    // Store pending objects - will be synced after module fully loads
    const pendingObjects: Array<{
      id: string
      name: string
      primitive: string
      position: [number, number, number]
      scale: [number, number, number]
      color: [number, number, number, number]
    }> = []

    // This is called by C++ registerTimelineObject() via EM_ASM
    ;(window as any).allolib.onObjectRegistered = (info: {
      id: string
      name: string
      primitive: string
      position: [number, number, number]
      scale: [number, number, number]
      color: [number, number, number, number]
    }) => {
      pendingObjects.push(info)
    }

    // Store pending objects reference for later sync
    ;(window as any).__pendingTimelineObjects = pendingObjects
  }

  private async loadAudioWorklet(baseUrl: string): Promise<void> {
    try {
      // Create audio context if needed
      if (!window.alloAudioContext) {
        window.alloAudioContext = new AudioContext({
          sampleRate: 44100,
          latencyHint: 'interactive',
        })
            // Browser may negotiate a different sample rate than requested; log the actual value.
        this.onPrint(`[INFO] Audio context created (state: ${window.alloAudioContext.state}, sampleRate: ${window.alloAudioContext.sampleRate})`)
      }

      // Load the audio worklet processor
      const workletUrl = `${baseUrl}/allolib-audio-processor.js`
      this.onPrint(`[INFO] Loading audio worklet from: ${workletUrl}`)
      await window.alloAudioContext.audioWorklet.addModule(workletUrl)
      this.onPrint('[INFO] Audio worklet processor registered')
    } catch (error) {
      // Audio worklet is optional, app can still run without audio
      this.onPrint(`[WARN] Audio worklet not available: ${error}`)
      console.warn('Audio worklet load error:', error)
    }
  }

  private setupAudioWorklet(): void {
    if (!window.alloAudioContext || !this.module) {
      this.onPrint('[WARN] Cannot setup audio: no context or module')
      return
    }

    try {
      this.onPrint('[INFO] Creating AudioWorkletNode...')

      // Create the AudioWorkletNode
      window.alloWorkletNode = new AudioWorkletNode(
        window.alloAudioContext,
        'allolib-processor',
        {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2],
          processorOptions: {
            bufferSize: 128,
            sampleRate: 44100,
            outputChannels: 2,
          },
        }
      )

      // Handle messages from worklet (audio buffer requests)
      window.alloWorkletNode.port.onmessage = (event) => {
        if (event.data.type === 'requestBuffer') {
          this.processAudioRequest(event.data.frames, event.data.channels)
        }
      }

      // Create safety limiter chain: worklet → soft clipper → limiter → destination
      this.setupSafetyLimiter()

      this.onPrint(`[INFO] Audio worklet connected (state: ${window.alloAudioContext.state})`)
    } catch (error) {
      console.warn('Audio worklet setup error:', error)
      this.onPrint(`[WARN] Audio worklet setup failed: ${error}`)
    }
  }

  private setupSafetyLimiter(): void {
    if (!window.alloAudioContext || !window.alloWorkletNode) return

    const ctx = window.alloAudioContext

    // Create soft clipper (WaveShaperNode with tanh curve)
    window.alloSoftClipper = ctx.createWaveShaper()
    if (this.limiterSettings.softClipEnabled) {
      window.alloSoftClipper.curve = createSoftClipCurve(this.limiterSettings.softClipDrive)
      window.alloSoftClipper.oversample = '2x' // Reduce aliasing from nonlinear distortion
    }

    // Create limiter (DynamicsCompressorNode with brick-wall settings)
    window.alloLimiter = ctx.createDynamicsCompressor()
    window.alloLimiter.threshold.setValueAtTime(this.limiterSettings.threshold, ctx.currentTime)
    window.alloLimiter.knee.setValueAtTime(0, ctx.currentTime) // 0 dB knee = hard/brick-wall limiting
    window.alloLimiter.ratio.setValueAtTime(20, ctx.currentTime) // 20:1 approximates brick-wall
    window.alloLimiter.attack.setValueAtTime(0.001, ctx.currentTime) // 1 ms — fast enough to catch transients
    window.alloLimiter.release.setValueAtTime(0.05, ctx.currentTime) // 50 ms — avoids pumping

    // Create a gain node for monitoring (placed after limiter)
    window.alloLimiterGain = ctx.createGain()
    window.alloLimiterGain.gain.setValueAtTime(1.0, ctx.currentTime)

    // Connect the chain based on settings
    if (this.limiterSettings.softClipEnabled && this.limiterSettings.enabled) {
      // Full chain: worklet → soft clipper → limiter → gain → destination
      window.alloWorkletNode.connect(window.alloSoftClipper)
      window.alloSoftClipper.connect(window.alloLimiter)
      window.alloLimiter.connect(window.alloLimiterGain)
      window.alloLimiterGain.connect(ctx.destination)
      this.onPrint('[INFO] Safety limiter enabled (soft clip + limiter)')
    } else if (this.limiterSettings.enabled) {
      // Limiter only: worklet → limiter → gain → destination
      window.alloWorkletNode.connect(window.alloLimiter)
      window.alloLimiter.connect(window.alloLimiterGain)
      window.alloLimiterGain.connect(ctx.destination)
      this.onPrint('[INFO] Safety limiter enabled')
    } else if (this.limiterSettings.softClipEnabled) {
      // Soft clip only: worklet → soft clipper → gain → destination
      window.alloWorkletNode.connect(window.alloSoftClipper)
      window.alloSoftClipper.connect(window.alloLimiterGain)
      window.alloLimiterGain.connect(ctx.destination)
      this.onPrint('[INFO] Soft clipper enabled')
    } else {
      // Bypass: worklet → destination
      window.alloWorkletNode.connect(ctx.destination)
      this.onPrint('[INFO] Safety limiter bypassed')
    }
  }

  // Configure limiter settings (can be called to update settings at runtime)
  configureLimiter(settings: {
    enabled?: boolean
    threshold?: number
    softClipEnabled?: boolean
    softClipDrive?: number
  }): void {
    if (settings.enabled !== undefined) this.limiterSettings.enabled = settings.enabled
    if (settings.threshold !== undefined) this.limiterSettings.threshold = settings.threshold
    if (settings.softClipEnabled !== undefined) this.limiterSettings.softClipEnabled = settings.softClipEnabled
    if (settings.softClipDrive !== undefined) this.limiterSettings.softClipDrive = settings.softClipDrive

    // Update limiter threshold if it exists
    if (window.alloLimiter && settings.threshold !== undefined) {
      window.alloLimiter.threshold.setValueAtTime(settings.threshold, window.alloAudioContext?.currentTime || 0)
    }

    // Update soft clipper curve
    // When disabled, use null curve (bypass), when enabled use tanh curve
    if (window.alloSoftClipper) {
      if (this.limiterSettings.softClipEnabled) {
        window.alloSoftClipper.curve = createSoftClipCurve(this.limiterSettings.softClipDrive)
      } else {
        // Bypass: null curve means linear passthrough
        window.alloSoftClipper.curve = null
      }
    }
  }

  private audioRequestCount = 0

  private processAudioRequest(frames: number, channels: number): void {
    if (!this.module || !window.alloWorkletNode) return

    try {
      // Log only the first request; repeated logging from the audio thread adds measurable latency.
      if (this.audioRequestCount === 0) {
      }
      this.audioRequestCount++

      // Allocate buffer in WASM memory
      const bufferSize = frames * channels * 4 // float32 = 4 bytes
      const bufferPtr = this.module._malloc?.(bufferSize)

      if (!bufferPtr) {
        console.warn('[Audio] Failed to allocate buffer')
        return
      }

      if (!this.module._allolib_process_audio) {
        console.warn('[Audio] _allolib_process_audio not found')
        return
      }

      // Call WASM to fill the buffer
      this.module._allolib_process_audio(bufferPtr, frames, channels)

      // HEAPF32 is indexed by float32 elements, but _malloc returns a byte pointer.
      const elementOffset = bufferPtr / 4  // Convert byte offset to Float32Array element index
      const audioData = this.module.HEAPF32!.subarray(elementOffset, elementOffset + frames * channels)

      // Send to worklet (make a copy before freeing the WASM allocation)
      const bufferCopy = audioData.slice()
      window.alloWorkletNode.port.postMessage({
        type: 'audioBuffer',
        buffer: bufferCopy.buffer,
      }, [bufferCopy.buffer])

      // Free the buffer
      this.module._free?.(bufferPtr)
    } catch (error) {
      console.warn('Audio processing error:', error)
    }
  }

  private async importModule(url: string): Promise<(config: Record<string, unknown>) => Promise<WasmModule>> {
    // Fetch the compiled JS as text and re-import via a blob URL.
    // Direct dynamic import() of a same-origin path would also work, but the blob
    // approach avoids any CORS restriction when the file server lacks CORS headers.
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch module: ${response.status} ${response.statusText}`)
      }

      const moduleText = await response.text()

      // Create a blob URL for the module code
      const blob = new Blob([moduleText], { type: 'application/javascript' })
      const blobUrl = URL.createObjectURL(blob)

      try {
        const module = await import(/* @vite-ignore */ blobUrl)
        return module.default
      } finally {
        URL.revokeObjectURL(blobUrl)
      }
    } catch (error) {
      // Fallback for same-origin where blob creation may fail (rare)
      const module = await import(/* @vite-ignore */ url)
      return module.default
    }
  }

  /**
   * Configure the WebGPU canvas context for rendering.
   * This MUST be called after the WASM module loads but before rendering starts.
   * The WebGPU backend's beginFrame() expects Module._webgpuCanvasContext to be set.
   */
  private async configureWebGPUCanvas(device: GPUDevice): Promise<void> {
    try {
      this.onPrint('[WebGPU] Configuring canvas context...')

      // Get the canvas element
      const canvas = this.canvas
      if (!canvas) {
        this.onError('[WebGPU] No canvas element available!')
        return
      }

      // Get WebGPU context from canvas
      const context = canvas.getContext('webgpu') as GPUCanvasContext | null
      if (!context) {
        this.onError('[WebGPU] Failed to get WebGPU context from canvas!')
        return
      }

      // Get preferred canvas format
      const format = navigator.gpu.getPreferredCanvasFormat()
      this.onPrint(`[WebGPU] Using format: ${format}`)

      // COPY_SRC is required so toDataURL() works on the WebGPU canvas (Chrome/Dawn
      // SharedTextureMemory on Windows rejects screenshots without it).
      context.configure({
        device: device,
        format: format,
        alphaMode: 'premultiplied',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      })

      // The WASM WebGPU backend's beginFrame() reads these from Module directly.
      if (this.module) {
        this.module._webgpuCanvasContext = context
        this.module._webgpuDevice = device
        this.module._webgpuFormat = format
      }

      // Also store globally for debugging
      ;(window as any).__webgpuCanvasContext = context
      ;(window as any).__webgpuDevice = device

      this.onPrint('[WebGPU] Canvas context configured successfully!')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.onError(`[WebGPU] Failed to configure canvas: ${message}`)
    }
  }

  start(): void {
    if (!this.module) {
      this.onError('[ERROR] No module loaded')
      return
    }

    if (this.isRunning) {
      this.onPrint('[WARN] Already running')
      return
    }

    this.isRunning = true
    this.onPrint('[INFO] Starting AlloLib application...')

    try {
      // With MODULARIZE=1 + EXPORT_ES6=1, main() runs automatically on module init.
      // ALLOLIB_WEB_MAIN calls allolib_create() but NOT allolib_start(), so we
      // configure the backend then start manually here.

      const activeBackend = (window as any).alloBackendType || 'webgl2'
      if (this.module._allolib_configure_backend) {
        // BackendType enum: WebGL2 = 0, WebGPU = 1
        const backendTypeNum = activeBackend === 'webgpu' ? 1 : 0
        this.onPrint(`[Runtime] Configuring backend: ${activeBackend} (${backendTypeNum})`)
        this.module._allolib_configure_backend(backendTypeNum)
      }

      // Now start the application
      if (this.module._allolib_start) {
        this.module._allolib_start()
      }

      // Set up audio worklet now that we have the module
      this.setupAudioWorklet()

      // Resume audio context (must be after user interaction)
      this.resumeAudio()

      if (this.module) {
        parameterSystem.connectWasm(this.module)
        objectManagerBridge.connect(this.module)
      }

      // Push initial display/quality settings into WASM immediately after start
      // so the app sees correct values on its first frame.
      try {
        const settings = useSettingsStore()
        settings.notifyDisplayChange()
        settings.notifyQualityChange()
      } catch (e) {
        console.warn('[Runtime] Could not apply initial settings:', e)
      }

      this.onPrint('[SUCCESS] Application started')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.onError(`[ERROR] Runtime error: ${message}`)
      this.isRunning = false
    }
  }

  private resumeAudio(): void {
    if (window.alloAudioContext) {
      this.onPrint(`[INFO] Audio context state: ${window.alloAudioContext.state}`)
      if (window.alloAudioContext.state === 'suspended') {
        window.alloAudioContext.resume().then(() => {
          this.onPrint(`[INFO] Audio context resumed, now: ${window.alloAudioContext?.state}`)
        }).catch(err => {
          console.warn('Audio resume failed:', err)
        })
      }
    }
  }

  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false

    parameterSystem.disconnectWasm()
    objectManagerBridge.disconnect()

    if (this.module?._allolib_stop) {
      try {
        this.module._allolib_stop()
      } catch (error) {
        console.warn('Stop error:', error)
      }
    }

    if (window.alloAudioContext) {
      window.alloAudioContext.suspend()
    }

    // Disconnect audio chain in reverse order (output → input)
    if (window.alloLimiterGain) {
      window.alloLimiterGain.disconnect()
      window.alloLimiterGain = null
    }

    if (window.alloLimiter) {
      window.alloLimiter.disconnect()
      window.alloLimiter = null
    }

    if (window.alloSoftClipper) {
      window.alloSoftClipper.disconnect()
      window.alloSoftClipper = null
    }

    if (window.alloWorkletNode) {
      window.alloWorkletNode.disconnect()
      window.alloWorkletNode = null
    }

    // Calling getContext('webgl2') on a WebGPU canvas throws; guard with the flag
    // set in load() when the backend was chosen.
    const isWebGPU = !!(this.canvas as any).__isWebGPU
    if (!isWebGPU && (this.canvas as any).__hasGLContext) {
      const gl = this.canvas.getContext('webgl2')
      if (gl) {
        gl.clearColor(0.1, 0.1, 0.1, 1.0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      }
    }

    this.onPrint('[INFO] Application stopped')
  }

  private cleanup(): void {
    if (this.module?._allolib_destroy) {
      try {
        this.module._allolib_destroy()
      } catch (error) {
        console.warn('Cleanup error:', error)
      }
    }

    this.module = null
    window.Module = null
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1
    const width = this.canvas.clientWidth * dpr
    const height = this.canvas.clientHeight * dpr

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height

      // Calling getContext('webgl2') before load() would claim the canvas and
      // prevent WebGPU from working; skip resize until we're actually running.
      if (this.isRunning) {
        const isWebGPU = !!(this.canvas as any).__isWebGPU
        if (!isWebGPU && (this.canvas as any).__hasGLContext) {
          const gl = this.canvas.getContext('webgl2')
          if (gl) {
            gl.viewport(0, 0, width, height)
          }
        }
      }
      // For WebGPU, the backend handles viewport via the resize callback
    }
  }

  // ── Sequencer Voice Bridge ─────────────────────────────────────────

  /**
   * Trigger a synth voice from the sequencer.
   * Calls al_seq_trigger_on in the WASM module.
   */
  triggerVoice(id: number, freq: number, amp: number, dur: number): void {
    if (!this.module?._al_seq_trigger_on) return
    this.module._al_seq_trigger_on(id, freq, amp, dur)
  }

  /**
   * Release (trigger off) a synth voice.
   * Calls al_seq_trigger_off in the WASM module.
   */
  releaseVoice(id: number): void {
    if (!this.module?._al_seq_trigger_off) return
    this.module._al_seq_trigger_off(id)
  }

  /**
   * Set a parameter on a voice by index.
   */
  setVoiceParam(voiceId: number, paramIndex: number, value: number): void {
    if (!this.module?._al_seq_set_param) return
    this.module._al_seq_set_param(voiceId, paramIndex, value)
  }

  /**
   * Check if the sequencer bridge is available in the loaded WASM module.
   */
  get hasSequencerBridge(): boolean {
    return !!this.module?._al_seq_trigger_on
  }

  /**
   * Get the active graphics backend type ('webgl2' or 'webgpu')
   */
  get activeBackendType(): string {
    return (window as any).alloBackendType || 'webgl2'
  }

  getModule(): WasmModule | null {
    return this.module
  }

  /**
   * Get the current canvas element (may differ from original if replaced for WebGPU)
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  /**
   * Get the audio context for external use (e.g., recording)
   */
  getAudioContext(): AudioContext | null {
    return window.alloAudioContext
  }

  /**
   * Get the audio worklet node for external use (e.g., recording)
   */
  getAudioWorkletNode(): AudioWorkletNode | null {
    return window.alloWorkletNode
  }

  destroy(): void {
    const moduleRef = this.module

    this.stop()

    // Null window.Module before calling _allolib_destroy so that any Emscripten
    // event handlers that fire during teardown see an empty Module and bail early.
    this.module = null
    window.Module = null

    if (moduleRef?._allolib_destroy) {
      try {
        moduleRef._allolib_destroy()
      } catch (error) {
        console.warn('Destroy error:', error)
      }
    }

    // Close audio context
    if (window.alloAudioContext) {
      window.alloAudioContext.close()
      window.alloAudioContext = null
    }

    this.onPrint('[INFO] Runtime destroyed')
  }

  get running(): boolean {
    return this.isRunning
  }
}

