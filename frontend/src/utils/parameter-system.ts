/**
 * Parameter System for AlloLib Studio
 *
 * Unified parameter management for all sources:
 * - synth: C++ SynthVoice parameters via WASM (createInternalTriggerParameter)
 * - object: Scene object transforms and materials (via ObjectsStore)
 * - environment: Global scene settings (via EnvironmentStore)
 * - camera: Camera position/rotation/FOV (via WASM nav())
 *
 * C++ Integration:
 * - WebControlGUI registers parameters via << operator
 * - Parameters are exposed via al_webgui_* C exports
 * - JS receives notifications via window.allolib callbacks
 *
 * Store Integration:
 * - Object/Environment stores are the source of truth for non-synth params
 * - Parameter panel reads from and writes to stores
 * - Stores sync to WASM when values change
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

// ─── Source Types for Unified Parameter System ───────────────────────────────

export type ParameterSource = 'synth' | 'object' | 'environment' | 'camera' | 'event'

export interface Parameter {
  name: string
  displayName: string
  group: string
  value: number | number[]
  min: number
  max: number
  defaultValue: number | number[]
  step?: number
  type: ParameterType
  index: number // Index in C++ parameter list
  menuItems?: string[] // For menu parameters

  // Extended properties for unified system
  source: ParameterSource
  sourceId?: string  // Object ID, synth name, etc.
  isKeyframeable: boolean
  hasKeyframes: boolean
}

export interface ParameterGroup {
  name: string
  source: ParameterSource
  sourceId?: string
  parameters: Parameter[]
  collapsed: boolean
}

// ─── Object/Environment Parameter Definitions ────────────────────────────────

export interface ObjectParameterDefinition {
  objectId: string
  objectName: string
  transform: {
    position: [number, number, number]
    rotation: [number, number, number, number]
    scale: [number, number, number]
  }
  uniforms?: Record<string, {
    type: 'float' | 'int' | 'bool' | 'vec3' | 'vec4' | 'color'
    value: number | number[]
    min?: number
    max?: number
    step?: number
  }>
}

export interface EnvironmentParameterDefinition {
  backgroundColor: [number, number, number, number]
  ambientColor: [number, number, number]
  ambientIntensity: number
  fogEnabled: boolean
  fogColor: [number, number, number]
  fogNear: number
  fogFar: number
}

export interface CameraParameterDefinition {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  near: number
  far: number
}

type ParameterCallback = () => void

class ParameterSystem {
  private parameters: Map<number, Parameter> = new Map() // keyed by index (synth params)
  private objectParameters: Map<string, Parameter[]> = new Map() // keyed by object ID
  private environmentParameters: Parameter[] = []
  private cameraParameters: Parameter[] = []
  private callbacks: Set<ParameterCallback> = new Set()
  private wasmModule: any = null
  private pollInterval: number | null = null
  private retryTimeouts: number[] = []

  // Currently selected object for parameter panel
  private _selectedObjectId: string | null = null
  private selectionCallbacks: Set<(objectId: string | null) => void> = new Set()

  constructor() {
    // Set up global callbacks for C++ notifications
    this.setupAlloLibCallbacks()
    // Initialize default environment and camera params
    this.initializeEnvironmentParams()
    this.initializeCameraParams()
  }

  /**
   * Initialize default environment parameters
   */
  private initializeEnvironmentParams(): void {
    this.environmentParameters = [
      {
        name: 'backgroundColor',
        displayName: 'Background Color',
        group: 'Environment',
        value: [0.1, 0.1, 0.1, 1.0],
        min: 0, max: 1, defaultValue: [0.1, 0.1, 0.1, 1.0],
        type: ParameterType.COLOR,
        index: -1,
        source: 'environment',
        isKeyframeable: true,
        hasKeyframes: false,
      },
      {
        name: 'ambientIntensity',
        displayName: 'Ambient Intensity',
        group: 'Environment',
        value: 0.3,
        min: 0, max: 2, defaultValue: 0.3,
        type: ParameterType.FLOAT,
        index: -1,
        source: 'environment',
        isKeyframeable: true,
        hasKeyframes: false,
      },
      {
        name: 'fogEnabled',
        displayName: 'Fog Enabled',
        group: 'Environment',
        value: 0,
        min: 0, max: 1, defaultValue: 0,
        type: ParameterType.BOOL,
        index: -1,
        source: 'environment',
        isKeyframeable: false,
        hasKeyframes: false,
      },
      {
        name: 'fogNear',
        displayName: 'Fog Near',
        group: 'Environment',
        value: 10,
        min: 0.1, max: 1000, defaultValue: 10,
        type: ParameterType.FLOAT,
        index: -1,
        source: 'environment',
        isKeyframeable: true,
        hasKeyframes: false,
      },
      {
        name: 'fogFar',
        displayName: 'Fog Far',
        group: 'Environment',
        value: 100,
        min: 1, max: 10000, defaultValue: 100,
        type: ParameterType.FLOAT,
        index: -1,
        source: 'environment',
        isKeyframeable: true,
        hasKeyframes: false,
      },
    ]
  }

  /**
   * Initialize default camera parameters
   */
  private initializeCameraParams(): void {
    this.cameraParameters = [
      {
        name: 'positionX',
        displayName: 'Position X',
        group: 'Camera',
        value: 0,
        min: -1000, max: 1000, defaultValue: 0,
        type: ParameterType.FLOAT,
        index: -1,
        source: 'camera',
        isKeyframeable: true,
        hasKeyframes: false,
      },
      {
        name: 'positionY',
        displayName: 'Position Y',
        group: 'Camera',
        value: 0,
        min: -1000, max: 1000, defaultValue: 0,
        type: ParameterType.FLOAT,
        index: -1,
        source: 'camera',
        isKeyframeable: true,
        hasKeyframes: false,
      },
      {
        name: 'positionZ',
        displayName: 'Position Z',
        group: 'Camera',
        value: 5,
        min: -1000, max: 1000, defaultValue: 5,
        type: ParameterType.FLOAT,
        index: -1,
        source: 'camera',
        isKeyframeable: true,
        hasKeyframes: false,
      },
      {
        name: 'fov',
        displayName: 'Field of View',
        group: 'Camera',
        value: 60,
        min: 10, max: 120, defaultValue: 60,
        type: ParameterType.FLOAT,
        index: -1,
        source: 'camera',
        isKeyframeable: true,
        hasKeyframes: false,
      },
    ]
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
        source: 'synth',
        isKeyframeable: true,
        hasKeyframes: false,
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
        source: 'synth',
        isKeyframeable: true,
        hasKeyframes: false,
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
   * Filters out .synthsequence groups (reserved for sequencer, not UI)
   */
  getGrouped(): ParameterGroup[] {
    const groups = new Map<string, Parameter[]>()

    for (const param of this.parameters.values()) {
      const groupName = param.group || 'Parameters'

      // Skip .synthsequence groups - they're for the sequencer, not the UI
      if (groupName.endsWith('.synthsequence')) continue

      // Clean up .preset suffix for display
      const displayName = groupName.endsWith('.preset')
        ? groupName.slice(0, -7)  // Remove ".preset"
        : groupName

      if (!groups.has(displayName)) {
        groups.set(displayName, [])
      }
      groups.get(displayName)!.push(param)
    }

    // Sort groups alphabetically, but put "Parameters" first
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === 'Parameters') return -1
      if (b[0] === 'Parameters') return 1
      return a[0].localeCompare(b[0])
    })

    return sortedGroups.map(([name, parameters]) => ({
      name,
      source: 'synth' as ParameterSource,
      parameters,
      collapsed: false,
    }))
  }

  /**
   * Get all parameter groups from all sources (unified view)
   * Filters out .synthsequence groups (reserved for sequencer, not UI)
   */
  getAllGroups(): ParameterGroup[] {
    const groups: ParameterGroup[] = []

    // Synth parameters (existing WASM-based)
    const synthParams = Array.from(this.parameters.values())
    if (synthParams.length > 0) {
      // Group by their group name
      const synthGroups = new Map<string, Parameter[]>()
      for (const param of synthParams) {
        const groupName = param.group || 'Synth'

        // Skip .synthsequence groups - they're for the sequencer, not the UI
        if (groupName.endsWith('.synthsequence')) continue

        // Clean up .preset suffix for display
        const displayName = groupName.endsWith('.preset')
          ? groupName.slice(0, -7)  // Remove ".preset"
          : groupName

        if (!synthGroups.has(displayName)) {
          synthGroups.set(displayName, [])
        }
        synthGroups.get(displayName)!.push(param)
      }

      for (const [name, params] of synthGroups) {
        groups.push({
          name: `Synth: ${name}`,
          source: 'synth',
          parameters: params,
          collapsed: false,
        })
      }
    }

    // Object parameters
    for (const [objectId, params] of this.objectParameters) {
      if (params.length > 0) {
        groups.push({
          name: `Object: ${objectId}`,
          source: 'object',
          sourceId: objectId,
          parameters: params,
          collapsed: true,
        })
      }
    }

    // Environment parameters
    if (this.environmentParameters.length > 0) {
      groups.push({
        name: 'Environment',
        source: 'environment',
        parameters: this.environmentParameters,
        collapsed: true,
      })
    }

    // Camera parameters
    if (this.cameraParameters.length > 0) {
      groups.push({
        name: 'Camera',
        source: 'camera',
        parameters: this.cameraParameters,
        collapsed: true,
      })
    }

    return groups
  }

  /**
   * Register an object with its parameters
   */
  registerObject(objectId: string, definition: ObjectParameterDefinition): void {
    const params: Parameter[] = []

    // Transform parameters
    params.push({
      name: 'positionX', displayName: 'Position X', group: 'Transform',
      value: definition.transform.position[0], min: -1000, max: 1000,
      defaultValue: definition.transform.position[0],
      type: ParameterType.FLOAT, index: -1, source: 'object', sourceId: objectId,
      isKeyframeable: true, hasKeyframes: false,
    })
    params.push({
      name: 'positionY', displayName: 'Position Y', group: 'Transform',
      value: definition.transform.position[1], min: -1000, max: 1000,
      defaultValue: definition.transform.position[1],
      type: ParameterType.FLOAT, index: -1, source: 'object', sourceId: objectId,
      isKeyframeable: true, hasKeyframes: false,
    })
    params.push({
      name: 'positionZ', displayName: 'Position Z', group: 'Transform',
      value: definition.transform.position[2], min: -1000, max: 1000,
      defaultValue: definition.transform.position[2],
      type: ParameterType.FLOAT, index: -1, source: 'object', sourceId: objectId,
      isKeyframeable: true, hasKeyframes: false,
    })
    params.push({
      name: 'scaleX', displayName: 'Scale X', group: 'Transform',
      value: definition.transform.scale[0], min: 0.01, max: 100,
      defaultValue: definition.transform.scale[0],
      type: ParameterType.FLOAT, index: -1, source: 'object', sourceId: objectId,
      isKeyframeable: true, hasKeyframes: false,
    })
    params.push({
      name: 'scaleY', displayName: 'Scale Y', group: 'Transform',
      value: definition.transform.scale[1], min: 0.01, max: 100,
      defaultValue: definition.transform.scale[1],
      type: ParameterType.FLOAT, index: -1, source: 'object', sourceId: objectId,
      isKeyframeable: true, hasKeyframes: false,
    })
    params.push({
      name: 'scaleZ', displayName: 'Scale Z', group: 'Transform',
      value: definition.transform.scale[2], min: 0.01, max: 100,
      defaultValue: definition.transform.scale[2],
      type: ParameterType.FLOAT, index: -1, source: 'object', sourceId: objectId,
      isKeyframeable: true, hasKeyframes: false,
    })

    // Material uniforms
    if (definition.uniforms) {
      for (const [name, uniform] of Object.entries(definition.uniforms)) {
        let paramType = ParameterType.FLOAT
        if (uniform.type === 'int') paramType = ParameterType.INT
        else if (uniform.type === 'bool') paramType = ParameterType.BOOL
        else if (uniform.type === 'vec3') paramType = ParameterType.VEC3
        else if (uniform.type === 'vec4') paramType = ParameterType.VEC4
        else if (uniform.type === 'color') paramType = ParameterType.COLOR

        params.push({
          name,
          displayName: name.charAt(0).toUpperCase() + name.slice(1),
          group: 'Material',
          value: uniform.value,
          min: uniform.min ?? 0,
          max: uniform.max ?? 1,
          defaultValue: uniform.value,
          step: uniform.step,
          type: paramType,
          index: -1,
          source: 'object',
          sourceId: objectId,
          isKeyframeable: true,
          hasKeyframes: false,
        })
      }
    }

    this.objectParameters.set(objectId, params)
    console.log(`[ParameterSystem] Registered object: ${objectId} with ${params.length} parameters`)
    this.notifyChange()
  }

  /**
   * Unregister an object
   */
  unregisterObject(objectId: string): void {
    this.objectParameters.delete(objectId)
    console.log(`[ParameterSystem] Unregistered object: ${objectId}`)
    this.notifyChange()
  }

  /**
   * Get parameters for a specific object
   */
  getObjectParameters(objectId: string): Parameter[] {
    return this.objectParameters.get(objectId) || []
  }

  /**
   * Get environment parameters
   */
  getEnvironmentParameters(): Parameter[] {
    return this.environmentParameters
  }

  /**
   * Get camera parameters
   */
  getCameraParameters(): Parameter[] {
    return this.cameraParameters
  }

  /**
   * Set a parameter value by source.
   * Routes to appropriate store/WASM bridge based on source type.
   */
  setParameterValue(source: ParameterSource, name: string, value: number | number[], sourceId?: string): void {
    let params: Parameter[] | undefined

    switch (source) {
      case 'synth':
        // Synth params go through WASM bridge - NEVER through stores
        this.set(name, typeof value === 'number' ? value : value[0])
        return

      case 'object':
        // Object params go to ObjectsStore
        params = sourceId ? this.objectParameters.get(sourceId) : undefined
        if (params) {
          const param = params.find(p => p.name === name)
          if (param) {
            param.value = value
            // Sync to store (store handles WASM sync)
            const objectsStore = (window as any).__objectsStore
            if (objectsStore && sourceId) {
              objectsStore.setProperty(sourceId, name, value)
            }
            this.notifyChange()
          }
        }
        return

      case 'environment':
        // Environment params go to EnvironmentStore
        params = this.environmentParameters
        if (params) {
          const param = params.find(p => p.name === name)
          if (param) {
            param.value = value
            // Sync to store (store handles WASM sync)
            const envStore = (window as any).__environmentStore
            if (envStore) {
              envStore.setProperty(name, value)
            }
            this.notifyChange()
          }
        }
        return

      case 'camera':
        // Camera params sync directly to WASM nav()
        params = this.cameraParameters
        if (params) {
          const param = params.find(p => p.name === name)
          if (param) {
            param.value = value
            // Sync to WASM camera
            this.syncCameraToWasm(name, value)
            this.notifyChange()
          }
        }
        return
    }
  }

  /**
   * Sync camera parameter to WASM nav()
   */
  private syncCameraToWasm(name: string, value: number | number[]): void {
    if (!this.wasmModule) return

    switch (name) {
      case 'positionX':
      case 'positionY':
      case 'positionZ':
        // Get all position values and send to WASM
        const posX = this.cameraParameters.find(p => p.name === 'positionX')?.value as number || 0
        const posY = this.cameraParameters.find(p => p.name === 'positionY')?.value as number || 0
        const posZ = this.cameraParameters.find(p => p.name === 'positionZ')?.value as number || 0
        if (this.wasmModule._al_nav_set_pos) {
          this.wasmModule._al_nav_set_pos(posX, posY, posZ)
        }
        break

      case 'fov':
        if (this.wasmModule._al_lens_set_fovy) {
          this.wasmModule._al_lens_set_fovy(value as number)
        }
        break
    }
  }

  /**
   * Check if any source has parameters
   */
  get hasAnyParameters(): boolean {
    return this.parameters.size > 0 ||
           this.objectParameters.size > 0 ||
           this.environmentParameters.length > 0 ||
           this.cameraParameters.length > 0
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

  /**
   * Populate parameters from detected C++ synth definitions.
   * This supplements the WASM-reported params with statically-detected ones
   * from parsing createInternalTriggerParameter calls in source code.
   */
  populateFromDetectedSynths(
    detectedParams: Array<{ name: string; defaultValue: number; min: number; max: number }>
  ): void {
    // Check which params we already have by name
    const existingNames = new Set<string>()
    for (const param of this.parameters.values()) {
      existingNames.add(param.name)
    }

    // Add any missing params from detected synths
    let added = 0
    for (const detected of detectedParams) {
      if (existingNames.has(detected.name)) continue

      // Find next available index
      let nextIndex = 0
      while (this.parameters.has(nextIndex)) nextIndex++

      const param: Parameter = {
        name: detected.name,
        displayName: detected.name,
        group: 'Parameters',
        value: detected.defaultValue,
        min: detected.min,
        max: detected.max,
        defaultValue: detected.defaultValue,
        type: ParameterType.FLOAT,
        index: nextIndex,
        step: 0.01,
        source: 'synth',
        isKeyframeable: true,
        hasKeyframes: false,
      }

      this.parameters.set(nextIndex, param)
      existingNames.add(detected.name)
      added++
    }

    if (added > 0) {
      console.log(`[ParameterSystem] Added ${added} parameters from C++ source detection`)
      this.notifyChange()
    }
  }

  // ─── Object Selection ─────────────────────────────────────────────────────

  /**
   * Get the currently selected object ID
   */
  get selectedObjectId(): string | null {
    return this._selectedObjectId
  }

  /**
   * Set the selected object (syncs with Parameter Panel)
   */
  setSelectedObject(objectId: string | null): void {
    if (this._selectedObjectId === objectId) return

    this._selectedObjectId = objectId

    // Notify listeners
    for (const callback of this.selectionCallbacks) {
      try {
        callback(objectId)
      } catch (e) {
        console.error('[ParameterSystem] Selection callback error:', e)
      }
    }

    // Notify parameter change to refresh panel
    this.notifyChange()
  }

  /**
   * Subscribe to object selection changes
   */
  onObjectSelectionChange(callback: (objectId: string | null) => void): () => void {
    this.selectionCallbacks.add(callback)
    return () => {
      this.selectionCallbacks.delete(callback)
    }
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
