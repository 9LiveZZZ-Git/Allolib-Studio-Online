import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface EditorSettings {
  fontSize: number
  tabSize: number
  wordWrap: 'on' | 'off' | 'wordWrapColumn'
  minimap: boolean
  lineNumbers: 'on' | 'off' | 'relative'
  theme: 'allolib-dark' | 'vs-dark' | 'hc-black'
}

export interface AudioSettings {
  sampleRate: 44100 | 48000 | 96000
  bufferSize: 128 | 256 | 512 | 1024 | 2048
  channels: 1 | 2
  limiterEnabled: boolean
  limiterThreshold: number // dB, typically -6 to 0
  softClipEnabled: boolean
  softClipDrive: number // 1.0 = no drive, higher = more saturation
}

export interface CompilerSettings {
  optimization: 'O0' | 'O1' | 'O2' | 'O3' | 'Os'
  debugInfo: boolean
  warnings: boolean
  runMode: 'project' | 'file'  // 'project' = all files, 'file' = active file only
}

export interface DisplaySettings {
  showAnalysisPanel: boolean
  showSequencer: boolean
  studioFocus: boolean
  consoleHeight: number
  analysisPanelHeight: number
  sequencerHeight: number
  defaultPointSize: number
}

export type QualityPreset = 'auto' | 'low' | 'medium' | 'high' | 'ultra'

export interface GraphicsSettings {
  qualityPreset: QualityPreset
  targetFPS: number
  resolutionScale: number
  lodBias: number
  // LOD distance settings
  lodMinFullQualityDistance: number  // Distance below which always use full quality (LOD 0)
  lodDistances: [number, number, number, number]  // Distance thresholds for LOD 1, 2, 3, 4
  lodDistanceScale: number  // Unified distance scale multiplier (0.1-10, default 1.0)
  lodLevels: number  // Number of LOD levels (1-16)
  lodUnloadEnabled: boolean  // Enable unloading at max distance
  lodUnloadDistance: number  // Distance at which to unload meshes
  shadowsEnabled: boolean
  shadowMapSize: 256 | 512 | 1024 | 2048
  reflectionsEnabled: boolean
  bloomEnabled: boolean
  ambientOcclusion: boolean
  antiAliasing: 'none' | 'fxaa' | 'msaa4x'
  maxLights: number
  maxParticles: number
  // Texture LOD settings
  textureQuality: 'low' | 'medium' | 'high' | 'ultra'
  maxTextureSize: 512 | 1024 | 2048 | 4096
  textureLODEnabled: boolean
  textureLODBias: number
  // Shader LOD settings
  shaderLODEnabled: boolean
  shaderComplexity: 'minimal' | 'simple' | 'standard' | 'full'
}

export const useSettingsStore = defineStore('settings', () => {
  // Editor settings
  const editor = ref<EditorSettings>({
    fontSize: 14,
    tabSize: 4,
    wordWrap: 'off',
    minimap: true,
    lineNumbers: 'on',
    theme: 'allolib-dark',
  })

  // Audio settings
  const audio = ref<AudioSettings>({
    sampleRate: 44100,
    bufferSize: 128,
    channels: 2,
    limiterEnabled: true,
    limiterThreshold: -1, // dB - brick wall at -1dB
    softClipEnabled: false, // Disabled by default for clean audio
    softClipDrive: 1.5, // Saturation amount when enabled
  })

  // Compiler settings
  const compiler = ref<CompilerSettings>({
    optimization: 'O2',
    debugInfo: false,
    warnings: true,
    runMode: 'project',
  })

  // Display settings
  const display = ref<DisplaySettings>({
    showAnalysisPanel: true,
    showSequencer: false,
    studioFocus: false,
    consoleHeight: 200,
    analysisPanelHeight: 200,
    sequencerHeight: 300,
    defaultPointSize: 1.0,
  })

  // Graphics/rendering quality settings
  const graphics = ref<GraphicsSettings>({
    qualityPreset: 'auto',
    targetFPS: 60,
    resolutionScale: 1.0,
    lodBias: 1.0,
    // LOD distance settings
    lodMinFullQualityDistance: 5.0,  // Full quality within 5 units
    lodDistances: [10, 25, 50, 100],  // LOD transitions at these distances
    lodDistanceScale: 1.0,  // Unified distance scale (higher = more detail at distance)
    lodLevels: 4,  // Default 4 LOD levels
    lodUnloadEnabled: false,  // Don't unload by default
    lodUnloadDistance: 500,  // Default unload distance
    shadowsEnabled: true,
    shadowMapSize: 1024,
    reflectionsEnabled: true,
    bloomEnabled: true,
    ambientOcclusion: true,
    antiAliasing: 'fxaa',
    maxLights: 8,
    maxParticles: 10000,
    // Texture LOD
    textureQuality: 'high',
    maxTextureSize: 2048,
    textureLODEnabled: true,
    textureLODBias: 1.0,
    // Shader LOD
    shaderLODEnabled: true,
    shaderComplexity: 'standard',
  })

  // Load settings from localStorage
  function loadSettings() {
    try {
      const saved = localStorage.getItem('allolib-settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.editor) Object.assign(editor.value, parsed.editor)
        if (parsed.audio) Object.assign(audio.value, parsed.audio)
        if (parsed.compiler) Object.assign(compiler.value, parsed.compiler)
        if (parsed.display) Object.assign(display.value, parsed.display)
        if (parsed.graphics) Object.assign(graphics.value, parsed.graphics)
      }
    } catch (e) {
      console.warn('Failed to load settings:', e)
    }
  }

  // Save settings to localStorage
  function saveSettings() {
    try {
      localStorage.setItem('allolib-settings', JSON.stringify({
        editor: editor.value,
        audio: audio.value,
        compiler: compiler.value,
        display: display.value,
        graphics: graphics.value,
      }))
    } catch (e) {
      console.warn('Failed to save settings:', e)
    }
  }

  // Reset to defaults
  function resetEditor() {
    editor.value = {
      fontSize: 14,
      tabSize: 4,
      wordWrap: 'off',
      minimap: true,
      lineNumbers: 'on',
      theme: 'allolib-dark',
    }
    saveSettings()
  }

  function resetAudio() {
    audio.value = {
      sampleRate: 44100,
      bufferSize: 128,
      channels: 2,
      limiterEnabled: true,
      limiterThreshold: -1,
      softClipEnabled: false,
      softClipDrive: 1.5,
    }
    saveSettings()
  }

  function resetCompiler() {
    compiler.value = {
      optimization: 'O2',
      debugInfo: false,
      warnings: true,
      runMode: 'project',
    }
    saveSettings()
  }

  function resetDisplay() {
    display.value = {
      showAnalysisPanel: true,
      showSequencer: false,
      studioFocus: false,
      consoleHeight: 200,
      analysisPanelHeight: 200,
      sequencerHeight: 300,
      defaultPointSize: 1.0,
    }
    saveSettings()
  }

  function resetGraphics() {
    graphics.value = {
      qualityPreset: 'auto',
      targetFPS: 60,
      resolutionScale: 1.0,
      lodBias: 1.0,
      // LOD distance settings
      lodMinFullQualityDistance: 5.0,
      lodDistances: [10, 25, 50, 100],
      lodDistanceScale: 1.0,
      lodLevels: 4,
      lodUnloadEnabled: false,
      lodUnloadDistance: 500,
      shadowsEnabled: true,
      shadowMapSize: 1024,
      reflectionsEnabled: true,
      bloomEnabled: true,
      ambientOcclusion: true,
      antiAliasing: 'fxaa',
      maxLights: 8,
      maxParticles: 10000,
      // Texture LOD
      textureQuality: 'high',
      maxTextureSize: 2048,
      textureLODEnabled: true,
      textureLODBias: 1.0,
      // Shader LOD
      shaderLODEnabled: true,
      shaderComplexity: 'standard',
    }
    saveSettings()
  }

  // Apply quality preset
  function applyQualityPreset(preset: QualityPreset) {
    graphics.value.qualityPreset = preset

    switch (preset) {
      case 'low':
        graphics.value.resolutionScale = 0.5
        graphics.value.lodBias = 2.0
        // LOD distances - aggressive reduction
        graphics.value.lodMinFullQualityDistance = 2
        graphics.value.lodDistances = [5, 15, 30, 60]
        graphics.value.lodDistanceScale = 0.5  // More aggressive LOD
        graphics.value.lodLevels = 8  // More levels for mobile
        graphics.value.lodUnloadEnabled = true
        graphics.value.lodUnloadDistance = 200
        graphics.value.shadowsEnabled = false
        graphics.value.shadowMapSize = 256
        graphics.value.reflectionsEnabled = false
        graphics.value.bloomEnabled = false
        graphics.value.ambientOcclusion = false
        graphics.value.antiAliasing = 'none'
        graphics.value.maxLights = 2
        graphics.value.maxParticles = 1000
        // Texture LOD - aggressive reduction
        graphics.value.textureQuality = 'low'
        graphics.value.maxTextureSize = 512
        graphics.value.textureLODEnabled = true
        graphics.value.textureLODBias = 2.0
        // Shader LOD - minimal shaders
        graphics.value.shaderLODEnabled = true
        graphics.value.shaderComplexity = 'minimal'
        break
      case 'medium':
        graphics.value.resolutionScale = 0.75
        graphics.value.lodBias = 1.5
        // LOD distances - moderate
        graphics.value.lodMinFullQualityDistance = 5
        graphics.value.lodDistances = [10, 25, 50, 100]
        graphics.value.lodDistanceScale = 0.75
        graphics.value.lodLevels = 6
        graphics.value.lodUnloadEnabled = true
        graphics.value.lodUnloadDistance = 400
        graphics.value.shadowsEnabled = true
        graphics.value.shadowMapSize = 512
        graphics.value.reflectionsEnabled = true
        graphics.value.bloomEnabled = true
        graphics.value.ambientOcclusion = false
        graphics.value.antiAliasing = 'fxaa'
        graphics.value.maxLights = 4
        graphics.value.maxParticles = 5000
        // Texture LOD - moderate
        graphics.value.textureQuality = 'medium'
        graphics.value.maxTextureSize = 1024
        graphics.value.textureLODEnabled = true
        graphics.value.textureLODBias = 1.5
        // Shader LOD - simple shaders
        graphics.value.shaderLODEnabled = true
        graphics.value.shaderComplexity = 'simple'
        break
      case 'high':
        graphics.value.resolutionScale = 1.0
        graphics.value.lodBias = 1.0
        // LOD distances - balanced
        graphics.value.lodMinFullQualityDistance = 8
        graphics.value.lodDistances = [15, 35, 70, 150]
        graphics.value.lodDistanceScale = 1.0
        graphics.value.lodLevels = 4
        graphics.value.lodUnloadEnabled = false
        graphics.value.lodUnloadDistance = 500
        graphics.value.shadowsEnabled = true
        graphics.value.shadowMapSize = 1024
        graphics.value.reflectionsEnabled = true
        graphics.value.bloomEnabled = true
        graphics.value.ambientOcclusion = true
        graphics.value.antiAliasing = 'fxaa'
        graphics.value.maxLights = 8
        graphics.value.maxParticles = 10000
        // Texture LOD - high quality
        graphics.value.textureQuality = 'high'
        graphics.value.maxTextureSize = 2048
        graphics.value.textureLODEnabled = true
        graphics.value.textureLODBias = 1.0
        // Shader LOD - standard PBR
        graphics.value.shaderLODEnabled = true
        graphics.value.shaderComplexity = 'standard'
        break
      case 'ultra':
        graphics.value.resolutionScale = 1.0
        graphics.value.lodBias = 0.75
        // LOD distances - maximum quality
        graphics.value.lodMinFullQualityDistance = 15
        graphics.value.lodDistances = [25, 60, 120, 250]
        graphics.value.lodDistanceScale = 2.0  // Keep quality longer
        graphics.value.lodLevels = 4  // Fewer levels for max quality
        graphics.value.lodUnloadEnabled = false
        graphics.value.lodUnloadDistance = 1000
        graphics.value.shadowsEnabled = true
        graphics.value.shadowMapSize = 2048
        graphics.value.reflectionsEnabled = true
        graphics.value.bloomEnabled = true
        graphics.value.ambientOcclusion = true
        graphics.value.antiAliasing = 'msaa4x'
        graphics.value.maxLights = 16
        graphics.value.maxParticles = 50000
        // Texture LOD - max quality
        graphics.value.textureQuality = 'ultra'
        graphics.value.maxTextureSize = 4096
        graphics.value.textureLODEnabled = false  // Always max quality
        graphics.value.textureLODBias = 0.75
        // Shader LOD - full quality
        graphics.value.shaderLODEnabled = false  // Always max complexity
        graphics.value.shaderComplexity = 'full'
        break
      case 'auto':
        // Start with high, will auto-adjust
        applyQualityPreset('high')
        graphics.value.qualityPreset = 'auto'
        break
    }

    // Notify WASM module of quality change
    notifyQualityChange()
    saveSettings()
  }

  // Send quality settings to WASM module
  function notifyQualityChange() {
    const w = window as any

    // Send to quality manager if available
    if (w.allolib?.quality?.setSettings) {
      w.allolib.quality.setSettings(graphics.value)
    }

    // Send LOD settings to auto-LOD system
    if (w.allolib?.autoLOD) {
      // Enable auto-LOD when texture LOD is enabled (they're related features)
      // Ultra preset disables both for maximum quality
      w.allolib.autoLOD.setEnabled(graphics.value.textureLODEnabled)

      // LOD bias from settings
      w.allolib.autoLOD.setBias(graphics.value.lodBias)

      // LOD distance thresholds
      w.allolib.autoLOD.setMinFullQualityDistance(graphics.value.lodMinFullQualityDistance)
      const d = graphics.value.lodDistances
      w.allolib.autoLOD.setDistances(d[0], d[1], d[2], d[3])

      // New LOD settings
      w.allolib.autoLOD.setDistanceScale(graphics.value.lodDistanceScale)
      w.allolib.autoLOD.setLevels(graphics.value.lodLevels)
      w.allolib.autoLOD.setUnloadEnabled(graphics.value.lodUnloadEnabled)
      w.allolib.autoLOD.setUnloadDistance(graphics.value.lodUnloadDistance)

      // Triangle budget based on quality preset
      const budgets: Record<string, number> = {
        low: 100000,
        medium: 300000,
        high: 500000,
        ultra: 1000000,
        auto: 500000,
      }
      w.allolib.autoLOD.setBudget(budgets[graphics.value.qualityPreset] || 500000)

      // Selection mode based on quality
      // 0=distance, 1=screenSize, 2=screenError, 3=triangleBudget
      const modes: Record<string, number> = {
        low: 0, // distance (fastest)
        medium: 1, // screen size
        high: 1, // screen size
        ultra: 2, // screen error (best quality)
        auto: 1, // screen size
      }
      w.allolib.autoLOD.setMode(modes[graphics.value.qualityPreset] || 1)

      console.log(
        '[Settings] LOD settings applied: enabled=' +
          graphics.value.textureLODEnabled +
          ', bias=' +
          graphics.value.lodBias +
          ', distanceScale=' +
          graphics.value.lodDistanceScale +
          ', levels=' +
          graphics.value.lodLevels +
          ', unload=' +
          graphics.value.lodUnloadEnabled +
          '@' +
          graphics.value.lodUnloadDistance +
          ', preset=' +
          graphics.value.qualityPreset
      )
    }
  }

  // Send display settings to WASM module
  function notifyDisplayChange() {
    const w = window as any

    // Send point size to graphics system
    if (w.allolib?.graphics?.setPointSize) {
      w.allolib.graphics.setPointSize(display.value.defaultPointSize)
      console.log('[Settings] Point size set to:', display.value.defaultPointSize)
    }
  }

  function resetAll() {
    resetEditor()
    resetAudio()
    resetCompiler()
    resetDisplay()
    resetGraphics()
  }

  // Watch for changes and auto-save
  watch([editor, audio, compiler, display, graphics], saveSettings, { deep: true })

  // Watch display settings and notify WASM
  watch(() => display.value.defaultPointSize, () => {
    notifyDisplayChange()
  })

  // Load on init
  loadSettings()

  return {
    editor,
    audio,
    compiler,
    display,
    graphics,
    loadSettings,
    saveSettings,
    resetEditor,
    resetAudio,
    resetCompiler,
    resetDisplay,
    resetGraphics,
    applyQualityPreset,
    notifyDisplayChange,
    notifyQualityChange,
    resetAll,
  }
})
