/**
 * Media Recording Service
 *
 * Handles video and audio recording from the WebGL canvas and Web Audio API.
 * Supports various output formats and size presets for social media platforms.
 */

export interface SizePreset {
  name: string
  width: number
  height: number
  aspectRatio: string
  platform: string
  description: string
}

export interface RecordingOptions {
  videoBitsPerSecond?: number
  audioBitsPerSecond?: number
  mimeType?: string
}

export interface ExportOptions {
  filename: string
  format: 'webm' | 'mp4' | 'gif'
  includeAudio: boolean
  quality: 'low' | 'medium' | 'high' | 'ultra'
}

// Size presets for various platforms
export const sizePresets: SizePreset[] = [
  // Vertical Short-Form (9:16) - Most Popular for Social Media
  { name: 'YouTube Shorts', width: 1080, height: 1920, aspectRatio: '9:16', platform: 'Shorts & Reels', description: 'Vertical (up to 3 min)' },
  { name: 'Instagram Reels', width: 1080, height: 1920, aspectRatio: '9:16', platform: 'Shorts & Reels', description: 'Vertical (up to 3 min)' },
  { name: 'TikTok', width: 1080, height: 1920, aspectRatio: '9:16', platform: 'Shorts & Reels', description: 'Vertical Video' },
  { name: 'Instagram Story', width: 1080, height: 1920, aspectRatio: '9:16', platform: 'Shorts & Reels', description: 'Full Screen Vertical' },
  { name: 'Facebook Reels', width: 1080, height: 1920, aspectRatio: '9:16', platform: 'Shorts & Reels', description: 'Vertical Video' },

  // YouTube Landscape
  { name: 'YouTube 4K', width: 3840, height: 2160, aspectRatio: '16:9', platform: 'YouTube', description: '4K Ultra HD' },
  { name: 'YouTube 1080p', width: 1920, height: 1080, aspectRatio: '16:9', platform: 'YouTube', description: 'Full HD (Recommended)' },
  { name: 'YouTube 720p', width: 1280, height: 720, aspectRatio: '16:9', platform: 'YouTube', description: 'HD' },

  // Instagram
  { name: 'Instagram Feed Square', width: 1080, height: 1080, aspectRatio: '1:1', platform: 'Instagram', description: 'Square Post' },
  { name: 'Instagram Portrait', width: 1080, height: 1350, aspectRatio: '4:5', platform: 'Instagram', description: 'Portrait Post' },

  // Twitter/X
  { name: 'Twitter/X Landscape', width: 1280, height: 720, aspectRatio: '16:9', platform: 'Twitter', description: 'Landscape Video' },
  { name: 'Twitter/X Square', width: 720, height: 720, aspectRatio: '1:1', platform: 'Twitter', description: 'Square Video' },

  // Facebook
  { name: 'Facebook Feed', width: 1280, height: 720, aspectRatio: '16:9', platform: 'Facebook', description: 'News Feed' },

  // Standard Screen Sizes
  { name: '4K UHD', width: 3840, height: 2160, aspectRatio: '16:9', platform: 'Standard', description: '4K Ultra HD' },
  { name: '2K QHD', width: 2560, height: 1440, aspectRatio: '16:9', platform: 'Standard', description: 'Quad HD' },
  { name: '1080p Full HD', width: 1920, height: 1080, aspectRatio: '16:9', platform: 'Standard', description: 'Full HD' },
  { name: '720p HD', width: 1280, height: 720, aspectRatio: '16:9', platform: 'Standard', description: 'HD Ready' },
  { name: '480p SD', width: 854, height: 480, aspectRatio: '16:9', platform: 'Standard', description: 'Standard Definition' },

  // Custom aspect ratios
  { name: 'Vertical 9:16', width: 1080, height: 1920, aspectRatio: '9:16', platform: 'Standard', description: 'Portrait/Mobile' },
  { name: 'Ultrawide 21:9', width: 2560, height: 1080, aspectRatio: '21:9', platform: 'Standard', description: 'Ultrawide Cinema' },
  { name: 'Square 1:1', width: 1080, height: 1080, aspectRatio: '1:1', platform: 'Standard', description: 'Square Format' },
]

// Quality presets for video encoding
export const qualityPresets = {
  low: { videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 64_000 },
  medium: { videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 },
  high: { videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 192_000 },
  ultra: { videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 320_000 },
}

declare global {
  interface Window {
    alloAudioContext: AudioContext | null
    alloWorkletNode: AudioWorkletNode | null
    alloLimiterGain: GainNode | null
  }
}

export class MediaRecorderService {
  private mediaRecorder: MediaRecorder | null = null
  private recordedChunks: Blob[] = []
  private canvas: HTMLCanvasElement | null = null
  private audioDestination: MediaStreamAudioDestinationNode | null = null
  private isRecording = false
  private startTime = 0
  private onProgressCallback: ((duration: number) => void) | null = null
  private progressInterval: number | null = null

  constructor() {}

  /**
   * Initialize the recorder with a canvas element
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
  }

  /**
   * Set up audio capture from the global audio context
   * This connects to the existing audio chain for recording
   */
  setAudioContext(audioContext: AudioContext | null): void {
    if (!audioContext) return

    // Create a media stream destination for recording
    this.audioDestination = audioContext.createMediaStreamDestination()

    // Connect the limiter gain (end of audio chain) to our recording destination
    // This captures the final processed audio
    if (window.alloLimiterGain) {
      window.alloLimiterGain.connect(this.audioDestination)
    } else if (window.alloWorkletNode) {
      // Fallback: connect directly to worklet output
      window.alloWorkletNode.connect(this.audioDestination)
    }
  }

  /**
   * Get the audio destination node to connect audio sources
   */
  getAudioDestination(): MediaStreamAudioDestinationNode | null {
    return this.audioDestination
  }

  /**
   * Check if recording is supported
   */
  isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' &&
           typeof HTMLCanvasElement.prototype.captureStream === 'function'
  }

  /**
   * Get supported MIME types
   */
  getSupportedMimeTypes(): string[] {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ]
    return types.filter(type => MediaRecorder.isTypeSupported(type))
  }

  /**
   * Start recording
   */
  startRecording(options: RecordingOptions = {}, includeAudio = true): boolean {
    if (!this.canvas) {
      console.error('Canvas not set')
      return false
    }

    if (this.isRecording) {
      console.warn('Already recording')
      return false
    }

    try {
      // Get video stream from canvas (30 fps)
      const videoStream = this.canvas.captureStream(30)

      // Combine video and audio streams
      let combinedStream: MediaStream

      if (includeAudio && this.audioDestination) {
        const audioTrack = this.audioDestination.stream.getAudioTracks()[0]
        if (audioTrack) {
          combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            audioTrack
          ])
        } else {
          combinedStream = videoStream
        }
      } else {
        combinedStream = videoStream
      }

      // Determine best MIME type
      const supportedTypes = this.getSupportedMimeTypes()
      const mimeType = options.mimeType || supportedTypes[0] || 'video/webm'

      // Create MediaRecorder
      const recorderOptions: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: options.videoBitsPerSecond || 5_000_000,
        audioBitsPerSecond: options.audioBitsPerSecond || 128_000,
      }

      this.mediaRecorder = new MediaRecorder(combinedStream, recorderOptions)
      this.recordedChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.start(100) // Collect data every 100ms
      this.isRecording = true
      this.startTime = Date.now()

      // Start progress tracking
      if (this.onProgressCallback) {
        this.progressInterval = window.setInterval(() => {
          const duration = (Date.now() - this.startTime) / 1000
          this.onProgressCallback?.(duration)
        }, 100)
      }

      return true
    } catch (error) {
      console.error('Failed to start recording:', error)
      return false
    }
  }

  /**
   * Stop recording and return the recorded blob
   */
  async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null)
        return
      }

      // Clear progress interval
      if (this.progressInterval) {
        clearInterval(this.progressInterval)
        this.progressInterval = null
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'video/webm'
        const blob = new Blob(this.recordedChunks, { type: mimeType })
        this.isRecording = false
        this.recordedChunks = []
        resolve(blob)
      }

      this.mediaRecorder.stop()
    })
  }

  /**
   * Check if currently recording
   */
  getIsRecording(): boolean {
    return this.isRecording
  }

  /**
   * Get recording duration in seconds
   */
  getRecordingDuration(): number {
    if (!this.isRecording) return 0
    return (Date.now() - this.startTime) / 1000
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (duration: number) => void): void {
    this.onProgressCallback = callback
  }

  /**
   * Take a screenshot of the canvas
   */
  takeScreenshot(format: 'png' | 'jpeg' | 'webp' = 'png', quality = 0.95): string | null {
    if (!this.canvas) return null

    const mimeType = `image/${format}`
    return this.canvas.toDataURL(mimeType, quality)
  }

  /**
   * Download a blob as a file
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Download a data URL as a file
   */
  downloadDataUrl(dataUrl: string, filename: string): void {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  /**
   * Export recording with options
   */
  async exportRecording(blob: Blob, options: ExportOptions): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${options.filename || 'recording'}_${timestamp}.${options.format}`

    // For WebM, we can directly download
    if (options.format === 'webm') {
      this.downloadBlob(blob, filename)
      return
    }

    // For other formats, we'd need server-side conversion or a library
    // For now, just download as WebM with a note
    console.warn(`Format ${options.format} requires conversion. Downloading as WebM.`)
    this.downloadBlob(blob, filename.replace(`.${options.format}`, '.webm'))
  }

  /**
   * Record audio only
   */
  async recordAudioOnly(durationMs: number): Promise<Blob | null> {
    if (!this.audioDestination) {
      console.error('Audio context not set')
      return null
    }

    return new Promise((resolve) => {
      const audioRecorder = new MediaRecorder(this.audioDestination!.stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128_000,
      })

      const chunks: Blob[] = []

      audioRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      audioRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        resolve(blob)
      }

      audioRecorder.start(100)

      setTimeout(() => {
        audioRecorder.stop()
      }, durationMs)
    })
  }
}

// Singleton instance
export const recorderService = new MediaRecorderService()
