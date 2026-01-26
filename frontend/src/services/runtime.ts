export interface RuntimeConfig {
  canvas: HTMLCanvasElement
  onPrint?: (text: string) => void
  onError?: (error: string) => void
  onExit?: (code: number) => void
}

export interface WasmModule {
  _main?: () => number
  canvas?: HTMLCanvasElement
  GL?: WebGLRenderingContext
  requestAnimationFrame?: typeof requestAnimationFrame
  cwrap?: (name: string, returnType: string, argTypes: string[]) => Function
  ccall?: (name: string, returnType: string, argTypes: string[], args: any[]) => any
}

export class AllolibRuntime {
  private module: WasmModule | null = null
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext | null = null
  private animationFrameId: number | null = null
  private isRunning = false
  private onPrint: (text: string) => void
  private onError: (text: string) => void
  private onExit: (code: number) => void

  constructor(config: RuntimeConfig) {
    this.canvas = config.canvas
    this.onPrint = config.onPrint || console.log
    this.onError = config.onError || console.error
    this.onExit = config.onExit || (() => {})

    // Initialize WebGL context
    this.initWebGL()
  }

  private initWebGL(): void {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      depth: true,
      stencil: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })

    if (!gl) {
      this.onError('WebGL2 not supported')
      return
    }

    this.gl = gl

    // Set viewport
    this.resize()
  }

  async load(jsUrl: string): Promise<void> {
    this.onPrint('[INFO] Loading WASM module...')

    try {
      // Dynamic import of the compiled module
      const moduleFactory = await import(/* @vite-ignore */ jsUrl)
      const createModule = moduleFactory.default

      // Configure and instantiate the module
      this.module = await createModule({
        canvas: this.canvas,
        print: this.onPrint,
        printErr: this.onError,
        onExit: this.onExit,
        locateFile: (path: string) => {
          // Handle .wasm file location
          if (path.endsWith('.wasm')) {
            return jsUrl.replace('.js', '.wasm')
          }
          return path
        },
      })

      this.onPrint('[SUCCESS] WASM module loaded')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.onError(`[ERROR] Failed to load module: ${message}`)
      throw error
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
    this.onPrint('[INFO] Starting application...')

    try {
      // Call the main function if it exists
      if (this.module._main) {
        this.module._main()
      }

      this.onPrint('[SUCCESS] Application started')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.onError(`[ERROR] Runtime error: ${message}`)
      this.isRunning = false
    }
  }

  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    // Clear the canvas
    if (this.gl) {
      this.gl.clearColor(0.1, 0.1, 0.1, 1.0)
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)
    }

    this.onPrint('[INFO] Application stopped')
  }

  resize(): void {
    if (!this.gl) return

    const dpr = window.devicePixelRatio || 1
    const width = this.canvas.clientWidth * dpr
    const height = this.canvas.clientHeight * dpr

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      this.gl.viewport(0, 0, width, height)
    }
  }

  destroy(): void {
    this.stop()
    this.module = null
    this.gl = null
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

    // Load audio worklet processor
    // This will be implemented when we have the actual audio worklet
    // await this.audioContext.audioWorklet.addModule('/audio-processor.js')
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
