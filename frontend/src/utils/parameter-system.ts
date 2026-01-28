/**
 * Parameter System for AlloLib Studio
 *
 * Provides a bridge between C++ WebControlGUI parameters and the web UI.
 * Parameters registered in C++ via WebControlGUI are automatically
 * exposed to JavaScript and can be controlled from the Vue UI.
 *
 * C++ Integration:
 * - WebControlGUI registers parameters via << operator
 * - Parameters are exposed via al_webgui_* C exports
 * - JS receives notifications via window.allolib callbacks
 */

// Parameter type enum matching WebParamType in C++
export enum ParameterType {
  FLOAT = 0,
  INT = 1,
  BOOL = 2,
  STRING = 3,
  VEC3 = 4,
  VEC4 = 5,
  COLOR = 6,
  MENU = 7,
  TRIGGER = 8,
}

export interface Parameter {
  name: string
  displayName: string
  group: string
  value: number
  min: number
  max: number
  defaultValue: number
  step?: number
  type: ParameterType
  index: number // Index in C++ parameter list
  menuItems?: string[] // For menu parameters
}

export interface ParameterGroup {
  name: string
  parameters: Parameter[]
}

type ParameterCallback = () => void

class ParameterSystem {
  private parameters: Map<number, Parameter> = new Map() // keyed by index
  private callbacks: Set<ParameterCallback> = new Set()
  private wasmModule: any = null
  private pollInterval: number | null = null
  private retryTimeouts: number[] = []

  constructor() {
    // Set up global callbacks for C++ notifications
    this.setupAlloLibCallbacks()
  }

  /**
   * Set up window.allolib callbacks for C++ notifications
   */
  private setupAlloLibCallbacks(): void {
    if (typeof window === 'undefined') return

    // Create the allolib namespace if it doesn't exist
    ;(window as any).allolib = (window as any).allolib || {}

    // Called when C++ adds a parameter via WebControlGUI
    ;(window as any).allolib.onParameterAdded = (info: {
      index: number
      name: string
      group: string
      type: number
      min: number
      max: number
      value: number
      defaultValue: number
    }) => {
      console.log('[ParameterSystem] Parameter added from C++:', info)
      const param: Parameter = {
        name: info.name,
        displayName: info.name,
        group: info.group || 'Parameters',
        value: info.value,
        min: info.min,
        max: info.max,
        defaultValue: info.defaultValue,
        type: info.type as ParameterType,
        index: info.index,
        step: info.type === ParameterType.INT ? 1 : 0.01,
      }
      this.parameters.set(info.index, param)
      this.notifyChange()
    }

    // Called when C++ parameter value changes
    ;(window as any).allolib.onParameterChanged = (index: number, value: number) => {
      const param = this.parameters.get(index)
      if (param) {
        param.value = value
        this.notifyChange()
      }
    }
  }

  /**
   * Connect to WASM module
   */
  connectWasm(module: any): void {
    this.stopPolling()
    this.cancelRetries()
    this.wasmModule = module
    this.parameters.clear()
    console.log('[ParameterSystem] Connected to WASM module')

    // Load any existing parameters from WASM
    this.loadFromWasm()

    // If no parameters found yet, retry with increasing delays.
    // Parameters may be registered after main() returns (e.g., in onCreate)
    // or the onParameterAdded callback may have fired before we were ready.
    if (this.parameters.size === 0) {
      this.scheduleRetries()
    }

    // Start polling for parameter updates (for values changed from C++ side)
    this.startPolling()
  }

  /**
   * Disconnect from WASM module
   */
  disconnectWasm(): void {
    this.cancelRetries()
    this.wasmModule = null
    this.parameters.clear()
    this.stopPolling()
    this.notifyChange()
  }

  /**
   * Schedule retry attempts to load parameters from WASM.
   * Covers race conditions where parameters are registered after initial load.
   */
  private scheduleRetries(): void {
    this.cancelRetries()

    const delays = [100, 300, 600, 1000, 2000]
    for (const delay of delays) {
      const t = window.setTimeout(() => {
        if (this.parameters.size === 0 && this.wasmModule) {
          console.log(`[ParameterSystem] Retry loading parameters (${delay}ms)`)
          this.loadFromWasm()
        }
      }, delay)
      this.retryTimeouts.push(t)
    }
  }

  /**
   * Cancel any pending retry timeouts
   */
  private cancelRetries(): void {
    for (const t of this.retryTimeouts) {
      clearTimeout(t)
    }
    this.retryTimeouts = []
  }

  /**
   * Load parameters from WASM module
   */
  loadFromWasm(): void {
    if (!this.wasmModule) return

    const getCount = this.wasmModule._al_webgui_get_parameter_count
    if (!getCount) {
      console.log('[ParameterSystem] WebGUI functions not available')
      return
    }

    const count = getCount()
    console.log(`[ParameterSystem] Loading ${count} parameters from WASM`)

    for (let i = 0; i < count; i++) {
      const namePtr = this.wasmModule._al_webgui_get_parameter_name(i)
      const groupPtr = this.wasmModule._al_webgui_get_parameter_group(i)
      const name = this.wasmModule.UTF8ToString(namePtr)
      const group = this.wasmModule.UTF8ToString(groupPtr)
      const type = this.wasmModule._al_webgui_get_parameter_type(i)
      const min = this.wasmModule._al_webgui_get_parameter_min(i)
      const max = this.wasmModule._al_webgui_get_parameter_max(i)
      const value = this.wasmModule._al_webgui_get_parameter_value(i)
      const defaultValue = this.wasmModule._al_webgui_get_parameter_default(i)

      const param: Parameter = {
        name,
        displayName: name,
        group: group || 'Parameters',
        value,
        min,
        max,
        defaultValue,
        type: type as ParameterType,
        index: i,
        step: type === ParameterType.INT ? 1 : 0.01,
      }

      console.log(`[ParameterSystem] Loaded parameter: ${name} (${group})`, param)
      this.parameters.set(i, param)
    }

    this.notifyChange()
  }

  /**
   * Start polling for parameter value changes
   */
  private startPolling(): void {
    if (this.pollInterval) return

    this.pollInterval = window.setInterval(() => {
      this.syncFromWasm()
    }, 100) // Poll every 100ms
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollInterval) {
      window.clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  /**
   * Sync parameter values from WASM.
   * Also detects newly registered parameters by checking count changes.
   */
  private syncFromWasm(): void {
    if (!this.wasmModule) return

    const getCount = this.wasmModule._al_webgui_get_parameter_count
    const getValue = this.wasmModule._al_webgui_get_parameter_value
    if (!getCount || !getValue) return

    // Check if new parameters were added since last load
    const wasmCount = getCount()
    if (wasmCount > this.parameters.size) {
      console.log(`[ParameterSystem] New parameters detected (${this.parameters.size} → ${wasmCount}), reloading`)
      this.loadFromWasm()
      return
    }

    // Sync existing parameter values
    let changed = false
    for (const [index, param] of this.parameters) {
      const newValue = getValue(index)
      if (Math.abs(param.value - newValue) > 0.0001) {
        param.value = newValue
        changed = true
      }
    }

    if (changed) {
      this.notifyChange()
    }
  }

  /**
   * Get all parameters
   */
  getAll(): Parameter[] {
    return Array.from(this.parameters.values())
  }

  /**
   * Get parameters grouped by their group name
   */
  getGrouped(): ParameterGroup[] {
    const groups = new Map<string, Parameter[]>()

    for (const param of this.parameters.values()) {
      const groupName = param.group || 'Parameters'
      if (!groups.has(groupName)) {
        groups.set(groupName, [])
      }
      groups.get(groupName)!.push(param)
    }

    // Sort groups alphabetically, but put "Parameters" first
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === 'Parameters') return -1
      if (b[0] === 'Parameters') return 1
      return a[0].localeCompare(b[0])
    })

    return sortedGroups.map(([name, parameters]) => ({
      name,
      parameters,
    }))
  }

  /**
   * Set a parameter value by index
   */
  setByIndex(index: number, value: number): void {
    const param = this.parameters.get(index)
    if (!param) return

    // Clamp to range
    value = Math.max(param.min, Math.min(param.max, value))

    // Round for int type
    if (param.type === ParameterType.INT || param.type === ParameterType.MENU) {
      value = Math.round(value)
    }

    param.value = value

    // Send to WASM
    if (this.wasmModule?._al_webgui_set_parameter_value) {
      this.wasmModule._al_webgui_set_parameter_value(index, value)
    }

    this.notifyChange()
  }

  /**
   * Set a parameter value by name
   */
  set(name: string, value: number): void {
    for (const [index, param] of this.parameters) {
      if (param.name === name) {
        this.setByIndex(index, value)
        return
      }
    }
  }

  /**
   * Trigger a trigger parameter
   */
  trigger(index: number): void {
    if (this.wasmModule?._al_webgui_trigger_parameter) {
      this.wasmModule._al_webgui_trigger_parameter(index)
    }
  }

  /**
   * Reset parameter to default value
   */
  resetToDefault(index: number): void {
    const param = this.parameters.get(index)
    if (param) {
      this.setByIndex(index, param.defaultValue)
    }
  }

  /**
   * Reset all parameters to defaults
   */
  resetAllToDefaults(): void {
    for (const [index] of this.parameters) {
      this.resetToDefault(index)
    }
  }

  /**
   * Subscribe to parameter changes
   */
  subscribe(callback: ParameterCallback): () => void {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  /**
   * Notify all subscribers of a change
   */
  private notifyChange(): void {
    for (const callback of this.callbacks) {
      callback()
    }
  }

  /**
   * Get parameter count
   */
  get count(): number {
    return this.parameters.size
  }

  /**
   * Check if parameters are available
   */
  get hasParameters(): boolean {
    return this.parameters.size > 0
  }
}

// Global parameter system instance
export const parameterSystem = new ParameterSystem()

// Expose to window for debugging
if (typeof window !== 'undefined') {
  ;(window as any).alloParameterSystem = parameterSystem
}

// Type helper for UI display
export function getParameterTypeLabel(type: ParameterType): string {
  switch (type) {
    case ParameterType.FLOAT:
      return 'float'
    case ParameterType.INT:
      return 'int'
    case ParameterType.BOOL:
      return 'bool'
    case ParameterType.STRING:
      return 'string'
    case ParameterType.VEC3:
      return 'vec3'
    case ParameterType.VEC4:
      return 'vec4'
    case ParameterType.COLOR:
      return 'color'
    case ParameterType.MENU:
      return 'menu'
    case ParameterType.TRIGGER:
      return 'trigger'
    default:
      return 'unknown'
  }
}

// ============================================================================
// Preset System - Save/Load parameter states to localStorage
// ============================================================================

export interface Preset {
  name: string
  timestamp: number
  values: Record<string, number> // parameter name -> value
}

const PRESET_STORAGE_KEY = 'allolib-parameter-presets'

class PresetManager {
  private presets: Map<string, Preset> = new Map()

  constructor() {
    this.loadFromStorage()
  }

  /**
   * Load presets from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(PRESET_STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored) as Preset[]
        for (const preset of data) {
          this.presets.set(preset.name, preset)
        }
        console.log(`[PresetManager] Loaded ${this.presets.size} presets from storage`)
      }
    } catch (error) {
      console.warn('[PresetManager] Failed to load presets:', error)
    }
  }

  /**
   * Save presets to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.presets.values())
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn('[PresetManager] Failed to save presets:', error)
    }
  }

  /**
   * Save current parameter values as a preset
   */
  savePreset(name: string): void {
    const values: Record<string, number> = {}

    for (const param of parameterSystem.getAll()) {
      // Don't save trigger parameters (they have no value)
      if (param.type !== ParameterType.TRIGGER) {
        values[param.name] = param.value
      }
    }

    const preset: Preset = {
      name,
      timestamp: Date.now(),
      values,
    }

    this.presets.set(name, preset)
    this.saveToStorage()
    console.log(`[PresetManager] Saved preset: ${name}`)
  }

  /**
   * Load a preset by name
   */
  loadPreset(name: string): boolean {
    const preset = this.presets.get(name)
    if (!preset) {
      console.warn(`[PresetManager] Preset not found: ${name}`)
      return false
    }

    // Apply values to parameters
    for (const [paramName, value] of Object.entries(preset.values)) {
      parameterSystem.set(paramName, value)
    }

    console.log(`[PresetManager] Loaded preset: ${name}`)
    return true
  }

  /**
   * Delete a preset
   */
  deletePreset(name: string): boolean {
    const deleted = this.presets.delete(name)
    if (deleted) {
      this.saveToStorage()
      console.log(`[PresetManager] Deleted preset: ${name}`)
    }
    return deleted
  }

  /**
   * Get all preset names
   */
  getPresetNames(): string[] {
    return Array.from(this.presets.keys())
  }

  /**
   * Get all presets
   */
  getAllPresets(): Preset[] {
    return Array.from(this.presets.values()).sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Check if a preset exists
   */
  hasPreset(name: string): boolean {
    return this.presets.has(name)
  }

  /**
   * Rename a preset
   */
  renamePreset(oldName: string, newName: string): boolean {
    const preset = this.presets.get(oldName)
    if (!preset) return false

    this.presets.delete(oldName)
    preset.name = newName
    this.presets.set(newName, preset)
    this.saveToStorage()
    return true
  }

  /**
   * Export presets as JSON string
   */
  exportPresets(): string {
    return JSON.stringify(Array.from(this.presets.values()), null, 2)
  }

  /**
   * Import presets from JSON string
   */
  importPresets(json: string, merge = true): number {
    try {
      const data = JSON.parse(json) as Preset[]
      if (!merge) {
        this.presets.clear()
      }
      let count = 0
      for (const preset of data) {
        if (preset.name && preset.values) {
          this.presets.set(preset.name, preset)
          count++
        }
      }
      this.saveToStorage()
      return count
    } catch (error) {
      console.warn('[PresetManager] Failed to import presets:', error)
      return 0
    }
  }
}

// Global preset manager instance
export const presetManager = new PresetManager()

// Expose to window for debugging
if (typeof window !== 'undefined') {
  ;(window as any).alloPresetManager = presetManager
}
