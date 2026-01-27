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
}

export interface CompilerSettings {
  optimization: 'O0' | 'O1' | 'O2' | 'O3' | 'Os'
  debugInfo: boolean
  warnings: boolean
}

export interface DisplaySettings {
  showAnalysisPanel: boolean
  consoleHeight: number
  analysisPanelHeight: number
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
  })

  // Compiler settings
  const compiler = ref<CompilerSettings>({
    optimization: 'O2',
    debugInfo: false,
    warnings: true,
  })

  // Display settings
  const display = ref<DisplaySettings>({
    showAnalysisPanel: true,
    consoleHeight: 200,
    analysisPanelHeight: 200,
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
    }
    saveSettings()
  }

  function resetCompiler() {
    compiler.value = {
      optimization: 'O2',
      debugInfo: false,
      warnings: true,
    }
    saveSettings()
  }

  function resetDisplay() {
    display.value = {
      showAnalysisPanel: true,
      consoleHeight: 200,
      analysisPanelHeight: 200,
    }
    saveSettings()
  }

  function resetAll() {
    resetEditor()
    resetAudio()
    resetCompiler()
    resetDisplay()
  }

  // Watch for changes and auto-save
  watch([editor, audio, compiler, display], saveSettings, { deep: true })

  // Load on init
  loadSettings()

  return {
    editor,
    audio,
    compiler,
    display,
    loadSettings,
    saveSettings,
    resetEditor,
    resetAudio,
    resetCompiler,
    resetDisplay,
    resetAll,
  }
})
