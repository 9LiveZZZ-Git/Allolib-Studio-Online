/**
 * Parameter System for AlloLib Studio
 *
 * Provides a bridge between C++ parameters and the web UI.
 * Parameters can be registered from WASM and controlled from JavaScript.
 *
 * Future integration:
 * - C++ code calls _allolib_register_parameter(name, group, value, min, max)
 * - JavaScript receives parameter updates via callbacks
 * - UI sends parameter changes back to WASM via _allolib_set_parameter(name, value)
 */

export interface Parameter {
  name: string
  displayName: string
  group: string
  value: number
  min: number
  max: number
  step?: number
  type: 'float' | 'int' | 'bool'
  onChange?: (value: number) => void
}

export interface ParameterGroup {
  name: string
  parameters: Parameter[]
}

type ParameterCallback = (name: string, value: number) => void

class ParameterSystem {
  private parameters: Map<string, Parameter> = new Map()
  private callbacks: Set<ParameterCallback> = new Set()
  private wasmModule: any = null

  /**
   * Register a parameter
   */
  register(param: Omit<Parameter, 'onChange'>): Parameter {
    const fullParam: Parameter = {
      ...param,
      step: param.step || (param.type === 'int' ? 1 : 0.01),
    }
    this.parameters.set(param.name, fullParam)
    this.notifyChange(param.name, param.value)
    return fullParam
  }

  /**
   * Unregister a parameter
   */
  unregister(name: string): void {
    this.parameters.delete(name)
  }

  /**
   * Clear all parameters
   */
  clear(): void {
    this.parameters.clear()
  }

  /**
   * Get a parameter by name
   */
  get(name: string): Parameter | undefined {
    return this.parameters.get(name)
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
      const groupName = param.group || 'General'
      if (!groups.has(groupName)) {
        groups.set(groupName, [])
      }
      groups.get(groupName)!.push(param)
    }

    return Array.from(groups.entries()).map(([name, parameters]) => ({
      name,
      parameters,
    }))
  }

  /**
   * Set a parameter value
   */
  set(name: string, value: number): void {
    const param = this.parameters.get(name)
    if (!param) return

    // Clamp to range
    value = Math.max(param.min, Math.min(param.max, value))

    // Round for int type
    if (param.type === 'int') {
      value = Math.round(value)
    }

    param.value = value

    // Call parameter-specific callback
    if (param.onChange) {
      param.onChange(value)
    }

    // Notify global listeners
    this.notifyChange(name, value)

    // Send to WASM if available
    this.sendToWasm(name, value)
  }

  /**
   * Subscribe to parameter changes
   */
  subscribe(callback: ParameterCallback): () => void {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  /**
   * Connect to WASM module
   */
  connectWasm(module: any): void {
    this.wasmModule = module

    // Check for parameter functions
    if (module._allolib_get_parameter_count) {
      this.loadFromWasm()
    }
  }

  /**
   * Disconnect from WASM module
   */
  disconnectWasm(): void {
    this.wasmModule = null
  }

  /**
   * Load parameters from WASM module
   */
  private loadFromWasm(): void {
    if (!this.wasmModule?._allolib_get_parameter_count) return

    const count = this.wasmModule._allolib_get_parameter_count()
    for (let i = 0; i < count; i++) {
      // These functions would need to be exported from the WASM module
      // For now, this is a placeholder for future integration
      // const name = this.wasmModule._allolib_get_parameter_name(i)
      // const value = this.wasmModule._allolib_get_parameter_value(i)
      // etc.
    }
  }

  /**
   * Send parameter value to WASM
   */
  private sendToWasm(name: string, value: number): void {
    if (!this.wasmModule?._allolib_set_parameter) return

    // This would require the parameter name to be passed as a pointer
    // For simplicity, we could use an index-based approach
    // this.wasmModule._allolib_set_parameter(index, value)
  }

  private notifyChange(name: string, value: number): void {
    for (const callback of this.callbacks) {
      callback(name, value)
    }
  }
}

// Global parameter system instance
export const parameterSystem = new ParameterSystem()

// Declare global for WASM access
declare global {
  interface Window {
    alloParameterSystem: ParameterSystem
  }
}

// Expose to window for WASM access
if (typeof window !== 'undefined') {
  window.alloParameterSystem = parameterSystem
}

/**
 * Helper to create a parameter with common defaults
 */
export function createParameter(
  name: string,
  options: {
    displayName?: string
    group?: string
    value?: number
    min?: number
    max?: number
    step?: number
    type?: 'float' | 'int' | 'bool'
  } = {}
): Parameter {
  return parameterSystem.register({
    name,
    displayName: options.displayName || name,
    group: options.group || 'General',
    value: options.value ?? 0.5,
    min: options.min ?? 0,
    max: options.max ?? 1,
    step: options.step,
    type: options.type || 'float',
  })
}

/**
 * Create demo parameters for testing
 */
export function createDemoParameters(): void {
  parameterSystem.clear()

  createParameter('frequency', {
    displayName: 'Frequency',
    group: 'Audio',
    value: 440,
    min: 100,
    max: 2000,
    step: 1,
    type: 'float',
  })

  createParameter('amplitude', {
    displayName: 'Amplitude',
    group: 'Audio',
    value: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
  })

  createParameter('rotationSpeed', {
    displayName: 'Rotation Speed',
    group: 'Graphics',
    value: 30,
    min: 0,
    max: 180,
    step: 1,
  })

  createParameter('hue', {
    displayName: 'Hue',
    group: 'Graphics',
    value: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
  })

  createParameter('saturation', {
    displayName: 'Saturation',
    group: 'Graphics',
    value: 0.8,
    min: 0,
    max: 1,
    step: 0.01,
  })
}
