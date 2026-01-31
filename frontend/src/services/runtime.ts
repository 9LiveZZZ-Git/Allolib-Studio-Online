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
  cwrap?: (name: string, returnType: string, argTypes: string[]) => Function
  ccall?: (name: string, returnType: string, argTypes: string[], args: any[]) => any
  UTF8ToString?: (ptr: number) => string
  HEAPF32?: Float32Array
  canvas?: HTMLCanvasElement
  GL?: WebGLRenderingContext

  // AlloLib-specific exports
  _allolib_create?: () => void
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
}

declare global {
  interface Window {
    Module: WasmModule
    alloAudioContext: AudioContext | null
    alloWorkletNode: AudioWorkletNode | null
    alloSoftClipper: WaveShaperNode | null
    alloLimiter: DynamicsCompressorNode | null
    alloLimiterGain: GainNode | null // For monitoring gain reduction
  }
}

// Generate a soft clipping curve using tanh-based saturation
function createSoftClipCurve(drive: number = 1.5, samples: number = 8192): Float32Array {
  const curve = new Float32Array(samples)
  const deg = Math.PI / 180

  for (let i = 0; i < samples; i++) {
    // Map to -1 to 1 range
    const x = (i * 2) / samples - 1

    // Apply drive and soft clipping using tanh
    // tanh provides smooth saturation that approaches ±1 asymptotically
    const driven = x * drive
    curve[i] = Math.tanh(driven)
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

    // Pre-create WebGL2 context with preserveDrawingBuffer for screenshots
    // This context will be reused by Emscripten
    const gl = this.canvas.getContext('webgl2', {
      preserveDrawingBuffer: true,  // Required for toDataURL() screenshots
      alpha: true,
      antialias: true,
      depth: true,
      stencil: true,
      premultipliedAlpha: true,
    })
    if (!gl) {
      console.warn('[Runtime] Failed to pre-create WebGL2 context')
    }

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

      // Get the pre-created WebGL context (created in constructor with preserveDrawingBuffer)
      const gl = this.canvas.getContext('webgl2')

      // Module configuration for Emscripten
      const moduleConfig = {
        canvas: this.canvas,
        // Pass pre-created context so Emscripten reuses it (keeps preserveDrawingBuffer)
        preinitializedWebGLContext: gl,
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

      // Dynamically import the ES6 module
      // The module exports a factory function that returns a Promise<Module>
      this.onPrint('[INFO] Importing ES6 module...')
      const createModule = await this.importModule(jsUrl)

      this.onPrint('[INFO] Instantiating WASM module...')
      const wasmModule = await createModule(moduleConfig)

      // Store reference to the module
      this.module = wasmModule as WasmModule
      window.Module = this.module

      this.onPrint('[SUCCESS] AlloLib WASM module loaded')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.onError(`[ERROR] Failed to load module: ${message}`)
      throw error
    }
  }

  private async loadAudioWorklet(baseUrl: string): Promise<void> {
    try {
      // Create audio context if needed
      if (!window.alloAudioContext) {
        window.alloAudioContext = new AudioContext({
          sampleRate: 44100,
          latencyHint: 'interactive',
        })
        // Log actual sample rate - browser may use different rate
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
    window.alloLimiter.knee.setValueAtTime(0, ctx.currentTime) // Hard knee for brick-wall limiting
    window.alloLimiter.ratio.setValueAtTime(20, ctx.currentTime) // High ratio = limiting
    window.alloLimiter.attack.setValueAtTime(0.001, ctx.currentTime) // 1ms attack - fast to catch transients
    window.alloLimiter.release.setValueAtTime(0.05, ctx.currentTime) // 50ms release - smooth recovery

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
      // Log only first request for debugging (logging causes latency)
      if (this.audioRequestCount === 0) {
        console.log(`[Audio] First request: ${frames} frames, ${channels} channels`)
        console.log(`[Audio] WASM functions available: HEAPF32=${!!this.module.HEAPF32}, _malloc=${!!this.module._malloc}, _allolib_process_audio=${!!this.module._allolib_process_audio}`)
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

      // Copy data from WASM memory to JavaScript
      // HEAPF32 is a Float32Array view, so bufferPtr is an element offset (not byte offset)
      const elementOffset = bufferPtr / 4  // Convert byte offset to float32 element offset
      const audioData = this.module.HEAPF32!.subarray(elementOffset, elementOffset + frames * channels)

      // Logging disabled to reduce latency - uncomment for debugging
      // if (this.audioRequestCount <= 5) {
      //   const maxSample = Math.max(...Array.from(audioData).map(Math.abs))
      //   console.log(`[Audio] Max: ${maxSample.toFixed(3)}`)
      // }

      // Send to worklet (make a copy since we'll free the memory)
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

  private async importModule(url: string): Promise<(config: any) => Promise<WasmModule>> {
    // Use dynamic import to load the ES6 module
    // We need to handle CORS and module loading properly
    try {
      // For cross-origin modules, we may need to fetch and create a blob URL
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch module: ${response.status} ${response.statusText}`)
      }

      const moduleText = await response.text()

      // Create a blob URL for the module code
      const blob = new Blob([moduleText], { type: 'application/javascript' })
      const blobUrl = URL.createObjectURL(blob)

      try {
        // Import the module from the blob URL
        const module = await import(/* @vite-ignore */ blobUrl)
        return module.default
      } finally {
        // Clean up blob URL
        URL.revokeObjectURL(blobUrl)
      }
    } catch (error) {
      // Fallback: try direct import (may work if same-origin)
      const module = await import(/* @vite-ignore */ url)
      return module.default
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
      // With MODULARIZE=1 + EXPORT_ES6=1, main() runs automatically during module init
      // The ALLOLIB_WEB_MAIN macro's main() calls allolib_create() and allolib_start()

      // Set up audio worklet now that we have the module
      this.setupAudioWorklet()

      // Resume audio context (must be after user interaction)
      this.resumeAudio()

      // Connect the parameter system to the WASM module
      // This enables the Vue ParameterPanel to show and control parameters
      if (this.module) {
        parameterSystem.connectWasm(this.module)

        // Connect the object manager bridge for timeline object sync
        objectManagerBridge.connect(this.module)
      }

      // Apply initial settings from the settings store
      // This ensures point size and other settings are applied when the app starts
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

    // Disconnect parameter system and object manager
    parameterSystem.disconnectWasm()
    objectManagerBridge.disconnect()

    // Stop the AlloLib app
    if (this.module?._allolib_stop) {
      try {
        this.module._allolib_stop()
      } catch (error) {
        console.warn('Stop error:', error)
      }
    }

    // Suspend audio
    if (window.alloAudioContext) {
      window.alloAudioContext.suspend()
    }

    // Disconnect audio chain (in reverse order)
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

    // Clear the canvas
    const gl = this.canvas.getContext('webgl2')
    if (gl) {
      gl.clearColor(0.1, 0.1, 0.1, 1.0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    }

    this.onPrint('[INFO] Application stopped')
  }

  private cleanup(): void {
    // Destroy previous module
    if (this.module?._allolib_destroy) {
      try {
        this.module._allolib_destroy()
      } catch (error) {
        console.warn('Cleanup error:', error)
      }
    }

    this.module = null
    window.Module = null as any
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1
    const width = this.canvas.clientWidth * dpr
    const height = this.canvas.clientHeight * dpr

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height

      // Update viewport if we have a context
      const gl = this.canvas.getContext('webgl2')
      if (gl) {
        gl.viewport(0, 0, width, height)
      }
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

  getModule(): WasmModule | null {
    return this.module
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
    // Save module reference before nulling
    const moduleRef = this.module

    // Call stop first while module is still valid
    this.stop()

    // Now null out window.Module to stop Emscripten event handlers
    // from calling into WASM (they typically check Module before proceeding)
    this.module = null
    window.Module = null as any

    // Call destroy on the saved module reference
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

// Audio runtime using Web Audio API
export class AudioRuntime {
  private audioContext: AudioContext | null = null
  private workletNode: AudioWorkletNode | null = null
  private isRunning = false

  async init(): Promise<void> {
    this.audioContext = new AudioContext({
      sampleRate: 44100,
      latencyHint: 'interactive',
    })
  }

  async start(): Promise<void> {
    if (!this.audioContext) {
      await this.init()
    }

    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume()
    }

    this.isRunning = true
  }

  stop(): void {
    if (this.audioContext) {
      this.audioContext.suspend()
    }
    this.isRunning = false
  }

  destroy(): void {
    this.stop()
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.workletNode = null
  }

  get running(): boolean {
    return this.isRunning
  }
}
