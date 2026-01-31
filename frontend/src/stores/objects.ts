/**
 * Objects Store
 *
 * Manages visual object entities for the timeline/scene.
 * Each object has transform, mesh, and material properties
 * that can be keyframed and controlled via the Parameter Panel.
 *
 * This store is the source of truth for object state.
 * The parameter system reads from and writes to this store.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { coercePropertyValue } from '@/utils/property-validation'
import { useCommandsStore, createPropertyCommand, createKeyframeCommand, createObjectCommand } from './commands'

// ─── Object Definition Types ─────────────────────────────────────────────────

export interface ObjectTransform {
  position: [number, number, number]
  rotation: [number, number, number, number] // Quaternion
  scale: [number, number, number]
}

export interface ObjectMaterial {
  type: 'basic' | 'pbr' | 'custom'
  color?: [number, number, number, number]
  metallic?: number
  roughness?: number
  emissive?: [number, number, number]
  uniforms?: Record<string, {
    type: 'float' | 'int' | 'bool' | 'vec3' | 'vec4' | 'color'
    value: number | number[]
    min?: number
    max?: number
    step?: number
  }>
}

export interface ObjectMesh {
  type: 'primitive' | 'obj' | 'custom'
  primitive?: 'sphere' | 'cube' | 'cylinder' | 'plane' | 'torus' | 'cone'
  objPath?: string
  subdivisions?: number
}

export interface SceneObject {
  id: string
  name: string
  visible: boolean
  transform: ObjectTransform
  mesh: ObjectMesh
  material: ObjectMaterial

  // Timeline properties
  spawnTime?: number      // When object appears (undefined = always visible)
  destroyTime?: number    // When object disappears (undefined = never)

  // Parent-child hierarchy
  parentId?: string

  // Metadata
  locked: boolean
  tags: string[]
}

// ─── Keyframe Types ──────────────────────────────────────────────────────────

export type EasingType =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeOutBack'
  | 'bounce'
  | 'elastic'
  | 'step'
  | 'bezier'  // Custom bezier curve

// Bezier control points: [x1, y1, x2, y2] where x is time (0-1) and y is value (0-1, can overshoot)
export type BezierPoints = [number, number, number, number]

export interface Keyframe<T> {
  time: number
  value: T
  easing: EasingType
  bezierPoints?: BezierPoints  // Only used when easing === 'bezier'
}

export interface KeyframeCurve<T> {
  objectId: string
  property: string       // e.g., 'positionX', 'scaleY', 'color'
  keyframes: Keyframe<T>[]
}

// ─── Store Definition ────────────────────────────────────────────────────────

export const useObjectsStore = defineStore('objects', () => {
  // State
  const objects = ref<Map<string, SceneObject>>(new Map())
  const selectedObjectId = ref<string | null>(null)
  const keyframeCurves = ref<Map<string, KeyframeCurve<any>>>(new Map())

  // ─── Computed ────────────────────────────────────────────────────────────

  const selectedObject = computed(() => {
    if (!selectedObjectId.value) return null
    return objects.value.get(selectedObjectId.value) || null
  })

  const objectList = computed(() => {
    return Array.from(objects.value.values())
  })

  const visibleObjects = computed(() => {
    return objectList.value.filter(obj => obj.visible)
  })

  // ─── Object CRUD ─────────────────────────────────────────────────────────

  function createObject(partial: Partial<SceneObject> = {}): SceneObject {
    const id = partial.id || `obj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const obj: SceneObject = {
      id,
      name: partial.name || `Object ${objects.value.size + 1}`,
      visible: partial.visible ?? true,
      transform: partial.transform || {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      mesh: partial.mesh || {
        type: 'primitive',
        primitive: 'cube',
      },
      material: partial.material || {
        type: 'basic',
        color: [1, 1, 1, 1],
      },
      locked: partial.locked ?? false,
      tags: partial.tags || [],
      parentId: partial.parentId,
      spawnTime: partial.spawnTime,
      destroyTime: partial.destroyTime,
    }

    objects.value.set(id, obj)
    console.log(`[ObjectsStore] Created object: ${obj.name} (${id})`)

    // Create in WASM if connected
    createObjectInWasm(obj)

    return obj
  }

  function deleteObject(id: string): boolean {
    const obj = objects.value.get(id)
    if (!obj) return false

    // Remove any keyframe curves for this object
    for (const [key] of keyframeCurves.value) {
      if (key.startsWith(`${id}:`)) {
        keyframeCurves.value.delete(key)
      }
    }

    // Deselect if selected
    if (selectedObjectId.value === id) {
      selectedObjectId.value = null
    }

    // Remove from WASM
    removeObjectFromWasm(id)

    objects.value.delete(id)
    console.log(`[ObjectsStore] Deleted object: ${obj.name} (${id})`)

    return true
  }

  function getObject(id: string): SceneObject | undefined {
    return objects.value.get(id)
  }

  function selectObject(id: string | null): void {
    selectedObjectId.value = id
    if (id) {
      console.log(`[ObjectsStore] Selected: ${objects.value.get(id)?.name || id}`)
    }
  }

  // ─── Property Setters (Called by Parameter System) ──────────────────────

  /**
   * Set a property value on an object.
   * This is the main entry point from the parameter panel.
   *
   * @param objectId - Object to modify
   * @param propertyName - Property to set
   * @param value - New value
   * @param options - Optional settings
   * @param options.recordCommand - Whether to record for undo/redo (default: true)
   * @param options.validate - Whether to validate value (default: true)
   */
  function setProperty(
    objectId: string,
    propertyName: string,
    value: number | number[],
    options: { recordCommand?: boolean; validate?: boolean } = {}
  ): void {
    const { recordCommand = true, validate = true } = options

    const obj = objects.value.get(objectId)
    if (!obj) {
      console.warn(`[ObjectsStore] Object not found: ${objectId}`)
      return
    }

    // Validate value if requested
    let validatedValue = value
    if (validate) {
      // Map legacy property names to validation keys
      const validationKey = mapPropertyNameToValidationKey(propertyName)
      if (validationKey) {
        validatedValue = coercePropertyValue(validationKey, value)
      }
    }

    // Get old value for undo
    const oldValue = getProperty(objectId, propertyName)

    // Record command if requested (and commands store is recording)
    if (recordCommand) {
      const commandsStore = useCommandsStore()
      if (commandsStore.isRecording()) {
        const cmd = createPropertyCommand(
          objectId,
          propertyName,
          oldValue,
          validatedValue,
          (id, prop, val) => setPropertyInternal(id, prop, val)
        )
        commandsStore.execute(cmd)
        return  // Command execution will call setPropertyInternal
      }
    }

    // Apply value directly
    setPropertyInternal(objectId, propertyName, validatedValue)
  }

  /**
   * Internal property setter - applies value without recording command
   */
  function setPropertyInternal(objectId: string, propertyName: string, value: number | number[]): void {
    const obj = objects.value.get(objectId)
    if (!obj) return

    // Map property names to object structure
    switch (propertyName) {
      // Transform - Position
      case 'positionX':
      case 'position.x':
        obj.transform.position[0] = value as number
        break
      case 'positionY':
      case 'position.y':
        obj.transform.position[1] = value as number
        break
      case 'positionZ':
      case 'position.z':
        obj.transform.position[2] = value as number
        break

      // Transform - Scale
      case 'scaleX':
      case 'scale.x':
        obj.transform.scale[0] = value as number
        break
      case 'scaleY':
      case 'scale.y':
        obj.transform.scale[1] = value as number
        break
      case 'scaleZ':
      case 'scale.z':
        obj.transform.scale[2] = value as number
        break

      // Transform - Rotation (quaternion)
      case 'rotation':
        if (Array.isArray(value) && value.length === 4) {
          obj.transform.rotation = value as [number, number, number, number]
        }
        break

      // Material - Basic properties
      case 'color':
        if (obj.material.color && Array.isArray(value)) {
          obj.material.color = value as [number, number, number, number]
        }
        break
      case 'metallic':
        if (obj.material.type === 'pbr') {
          obj.material.metallic = value as number
        }
        break
      case 'roughness':
        if (obj.material.type === 'pbr') {
          obj.material.roughness = value as number
        }
        break
      case 'opacity':
        if (obj.material.color) {
          obj.material.color[3] = value as number
        }
        break

      // Material - Custom uniforms
      default:
        if (obj.material.uniforms && propertyName in obj.material.uniforms) {
          obj.material.uniforms[propertyName].value = value
        } else {
          console.warn(`[ObjectsStore] Unknown property: ${propertyName}`)
        }
    }

    // Sync to WASM if runtime is available
    syncObjectToWasm(objectId)
  }

  /**
   * Map legacy property names to validation keys
   */
  function mapPropertyNameToValidationKey(name: string): string | null {
    const mapping: Record<string, string> = {
      positionX: 'position.x',
      positionY: 'position.y',
      positionZ: 'position.z',
      scaleX: 'scale.x',
      scaleY: 'scale.y',
      scaleZ: 'scale.z',
      'rotation.x': 'rotation.x',
      'rotation.y': 'rotation.y',
      'rotation.z': 'rotation.z',
    }
    return mapping[name] || name
  }

  /**
   * Get a property value from an object
   */
  function getProperty(objectId: string, propertyName: string): number | number[] | undefined {
    const obj = objects.value.get(objectId)
    if (!obj) return undefined

    switch (propertyName) {
      case 'positionX': return obj.transform.position[0]
      case 'positionY': return obj.transform.position[1]
      case 'positionZ': return obj.transform.position[2]
      case 'scaleX': return obj.transform.scale[0]
      case 'scaleY': return obj.transform.scale[1]
      case 'scaleZ': return obj.transform.scale[2]
      case 'rotation': return obj.transform.rotation
      case 'color': return obj.material.color
      case 'metallic': return obj.material.metallic
      case 'roughness': return obj.material.roughness
      default:
        if (obj.material.uniforms && propertyName in obj.material.uniforms) {
          return obj.material.uniforms[propertyName].value
        }
        return undefined
    }
  }

  // ─── Keyframe Management ─────────────────────────────────────────────────

  /**
   * Add a keyframe for a property at the given time
   */
  function addKeyframe(
    objectId: string,
    property: string,
    time: number,
    value: any,
    easing: EasingType = 'linear'
  ): void {
    const curveKey = `${objectId}:${property}`
    let curve = keyframeCurves.value.get(curveKey)

    if (!curve) {
      curve = {
        objectId,
        property,
        keyframes: [],
      }
      keyframeCurves.value.set(curveKey, curve)
    }

    // Check if keyframe exists at this time
    const existingIdx = curve.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.001)
    if (existingIdx >= 0) {
      // Update existing keyframe
      curve.keyframes[existingIdx].value = value
      curve.keyframes[existingIdx].easing = easing
    } else {
      // Add new keyframe
      curve.keyframes.push({ time, value, easing })
      // Keep sorted by time
      curve.keyframes.sort((a, b) => a.time - b.time)
    }

    console.log(`[ObjectsStore] Added keyframe: ${objectId}.${property} @ ${time}s = ${value}`)
  }

  /**
   * Remove a keyframe
   */
  function removeKeyframe(objectId: string, property: string, time: number): boolean {
    const curveKey = `${objectId}:${property}`
    const curve = keyframeCurves.value.get(curveKey)
    if (!curve) return false

    const idx = curve.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.001)
    if (idx >= 0) {
      curve.keyframes.splice(idx, 1)
      console.log(`[ObjectsStore] Removed keyframe: ${objectId}.${property} @ ${time}s`)

      // Remove curve if no keyframes left
      if (curve.keyframes.length === 0) {
        keyframeCurves.value.delete(curveKey)
      }
      return true
    }
    return false
  }

  /**
   * Get keyframe curve for a property
   */
  function getKeyframeCurve(objectId: string, property: string): KeyframeCurve<any> | undefined {
    return keyframeCurves.value.get(`${objectId}:${property}`)
  }

  /**
   * Check if a property has keyframes
   */
  function hasKeyframes(objectId: string, property: string): boolean {
    const curve = keyframeCurves.value.get(`${objectId}:${property}`)
    return curve ? curve.keyframes.length > 0 : false
  }

  /**
   * Interpolate value at a given time
   */
  function getValueAtTime(objectId: string, property: string, time: number): any {
    const curve = keyframeCurves.value.get(`${objectId}:${property}`)
    if (!curve || curve.keyframes.length === 0) {
      return getProperty(objectId, property)
    }

    const keyframes = curve.keyframes

    // Before first keyframe
    if (time <= keyframes[0].time) {
      return keyframes[0].value
    }

    // After last keyframe
    if (time >= keyframes[keyframes.length - 1].time) {
      return keyframes[keyframes.length - 1].value
    }

    // Find surrounding keyframes
    let i = 0
    while (i < keyframes.length - 1 && keyframes[i + 1].time < time) {
      i++
    }

    const kf1 = keyframes[i]
    const kf2 = keyframes[i + 1]
    const t = (time - kf1.time) / (kf2.time - kf1.time)

    return interpolate(kf1.value, kf2.value, applyEasing(t, kf1.easing, kf1.bezierPoints))
  }

  // ─── WASM Sync ───────────────────────────────────────────────────────────

  const wasmConnected = ref(false)

  function connectWasm(): void {
    wasmConnected.value = true
    // Sync all existing objects to WASM
    for (const obj of objects.value.values()) {
      syncObjectToWasm(obj.id)
    }
  }

  function disconnectWasm(): void {
    wasmConnected.value = false
  }

  /**
   * Sync object state to WASM runtime
   * Uses WASM exports from al_WebObjectManager.hpp
   */
  function syncObjectToWasm(objectId: string): void {
    const obj = objects.value.get(objectId)
    if (!obj) return

    // Get WASM module from window
    const wasmModule = (window as any).__alloWasmModule
    if (!wasmModule) return

    // Convert string ID to C string for WASM
    const allocString = (str: string): number => {
      const encoder = new TextEncoder()
      const bytes = encoder.encode(str + '\0')
      const ptr = wasmModule._malloc(bytes.length)
      wasmModule.HEAPU8.set(bytes, ptr)
      return ptr
    }

    const freeString = (ptr: number): void => {
      wasmModule._free(ptr)
    }

    const idPtr = allocString(obj.id)

    try {
      // Sync transform - Position
      if (wasmModule._al_obj_set_position) {
        wasmModule._al_obj_set_position(
          idPtr,
          obj.transform.position[0],
          obj.transform.position[1],
          obj.transform.position[2]
        )
      }

      // Sync transform - Rotation (quaternion)
      if (wasmModule._al_obj_set_rotation) {
        wasmModule._al_obj_set_rotation(
          idPtr,
          obj.transform.rotation[0],
          obj.transform.rotation[1],
          obj.transform.rotation[2],
          obj.transform.rotation[3]
        )
      }

      // Sync transform - Scale
      if (wasmModule._al_obj_set_scale) {
        wasmModule._al_obj_set_scale(
          idPtr,
          obj.transform.scale[0],
          obj.transform.scale[1],
          obj.transform.scale[2]
        )
      }

      // Sync material - Color
      if (wasmModule._al_obj_set_color && obj.material.color) {
        wasmModule._al_obj_set_color(
          idPtr,
          obj.material.color[0],
          obj.material.color[1],
          obj.material.color[2],
          obj.material.color[3]
        )
      }

      // Sync material - PBR params
      if (wasmModule._al_obj_set_pbr_params && obj.material.type === 'pbr') {
        wasmModule._al_obj_set_pbr_params(
          idPtr,
          obj.material.metallic ?? 0,
          obj.material.roughness ?? 0.5
        )
      }

      // Sync visibility
      if (wasmModule._al_obj_set_visible) {
        wasmModule._al_obj_set_visible(idPtr, obj.visible ? 1 : 0)
      }

      // Sync lifecycle times
      if (wasmModule._al_obj_set_spawn_time && obj.spawnTime !== undefined) {
        wasmModule._al_obj_set_spawn_time(idPtr, obj.spawnTime)
      }

      if (wasmModule._al_obj_set_destroy_time && obj.destroyTime !== undefined) {
        wasmModule._al_obj_set_destroy_time(idPtr, obj.destroyTime)
      }
    } finally {
      freeString(idPtr)
    }
  }

  /**
   * Create object in WASM runtime
   */
  function createObjectInWasm(obj: SceneObject): void {
    const wasmModule = (window as any).__alloWasmModule
    if (!wasmModule || !wasmModule._al_obj_create) return

    const allocString = (str: string): number => {
      const encoder = new TextEncoder()
      const bytes = encoder.encode(str + '\0')
      const ptr = wasmModule._malloc(bytes.length)
      wasmModule.HEAPU8.set(bytes, ptr)
      return ptr
    }

    const freeString = (ptr: number): void => {
      wasmModule._free(ptr)
    }

    const idPtr = allocString(obj.id)
    const namePtr = allocString(obj.name)
    const primitivePtr = allocString(obj.mesh.primitive || 'cube')

    try {
      wasmModule._al_obj_create(idPtr, namePtr, primitivePtr)
      // Now sync all properties
      syncObjectToWasm(obj.id)
    } finally {
      freeString(idPtr)
      freeString(namePtr)
      freeString(primitivePtr)
    }
  }

  /**
   * Remove object from WASM runtime
   */
  function removeObjectFromWasm(id: string): void {
    const wasmModule = (window as any).__alloWasmModule
    if (!wasmModule || !wasmModule._al_obj_remove) return

    const encoder = new TextEncoder()
    const bytes = encoder.encode(id + '\0')
    const ptr = wasmModule._malloc(bytes.length)
    wasmModule.HEAPU8.set(bytes, ptr)

    try {
      wasmModule._al_obj_remove(ptr)
    } finally {
      wasmModule._free(ptr)
    }
  }

  /**
   * Update object lifecycles based on current timeline time
   */
  function updateLifecycles(currentTime: number): void {
    const wasmModule = (window as any).__alloWasmModule
    if (wasmModule && wasmModule._al_obj_update_lifecycles) {
      wasmModule._al_obj_update_lifecycles(currentTime)
    }
  }

  // ─── Serialization ───────────────────────────────────────────────────────

  /**
   * Export all objects and keyframes to JSON
   */
  function toJSON(): {
    objects: SceneObject[]
    keyframeCurves: Array<{ key: string; curve: KeyframeCurve<any> }>
  } {
    return {
      objects: Array.from(objects.value.values()),
      keyframeCurves: Array.from(keyframeCurves.value.entries()).map(([key, curve]) => ({
        key,
        curve,
      })),
    }
  }

  /**
   * Import objects and keyframes from JSON
   */
  function fromJSON(data: ReturnType<typeof toJSON>): void {
    // Clear WASM objects first
    clearWasmObjects()

    objects.value.clear()
    keyframeCurves.value.clear()

    for (const obj of data.objects) {
      objects.value.set(obj.id, obj)
      // Create in WASM
      createObjectInWasm(obj)
    }

    for (const { key, curve } of data.keyframeCurves) {
      keyframeCurves.value.set(key, curve)
    }

    console.log(`[ObjectsStore] Loaded ${data.objects.length} objects, ${data.keyframeCurves.length} curves`)
  }

  /**
   * Clear all WASM objects
   */
  function clearWasmObjects(): void {
    const wasmModule = (window as any).__alloWasmModule
    if (wasmModule && wasmModule._al_obj_clear) {
      wasmModule._al_obj_clear()
    }
  }

  /**
   * Clear all objects
   */
  function clear(): void {
    clearWasmObjects()
    objects.value.clear()
    keyframeCurves.value.clear()
    selectedObjectId.value = null
  }

  return {
    // State
    objects,
    selectedObjectId,
    keyframeCurves,

    // Computed
    selectedObject,
    objectList,
    visibleObjects,

    // Object CRUD
    createObject,
    deleteObject,
    getObject,
    selectObject,

    // Property access (for parameter panel)
    setProperty,
    getProperty,

    // Keyframes
    addKeyframe,
    removeKeyframe,
    getKeyframeCurve,
    hasKeyframes,
    getValueAtTime,

    // WASM Sync
    wasmConnected,
    connectWasm,
    disconnectWasm,
    syncObjectToWasm,
    updateLifecycles,

    // Serialization
    toJSON,
    fromJSON,
    clear,
  }
})

// ─── Utility Functions ───────────────────────────────────────────────────────

function applyEasing(t: number, easing: EasingType, bezierPoints?: BezierPoints): number {
  switch (easing) {
    case 'linear':
      return t
    case 'easeIn':
      return t * t * t  // Cubic ease in
    case 'easeOut':
      return 1 - Math.pow(1 - t, 3)  // Cubic ease out
    case 'easeInOut':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    case 'easeOutBack':
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    case 'bounce':
      // Approximate bounce with overshoot bezier
      return bezierEase(t, 0.68, -0.55, 0.27, 1.55)
    case 'elastic':
      if (t === 0 || t === 1) return t
      return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3)) + 1
    case 'step':
      return t < 1 ? 0 : 1
    case 'bezier':
      if (bezierPoints) {
        return bezierEase(t, bezierPoints[0], bezierPoints[1], bezierPoints[2], bezierPoints[3])
      }
      return t
    default:
      return t
  }
}

// Cubic bezier easing function
function bezierEase(t: number, x1: number, y1: number, x2: number, y2: number): number {
  // Newton-Raphson iteration to find parameter at time t
  let guess = t
  for (let i = 0; i < 8; i++) {
    const x = cubicBezier(guess, 0, x1, x2, 1)
    const dx = 3 * (1 - guess) * (1 - guess) * x1 +
               6 * (1 - guess) * guess * (x2 - x1) +
               3 * guess * guess * (1 - x2)
    if (Math.abs(dx) < 0.0001) break
    guess -= (x - t) / dx
    guess = Math.max(0, Math.min(1, guess))
  }
  return cubicBezier(guess, 0, y1, y2, 1)
}

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const t2 = t * t
  const t3 = t2 * t
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3
}

function interpolate(a: any, b: any, t: number): any {
  if (typeof a === 'number' && typeof b === 'number') {
    return a + (b - a) * t
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    return a.map((v, i) => v + (b[i] - v) * t)
  }
  // For non-interpolatable types, use step
  return t < 1 ? a : b
}

// Register on window for terminal access
if (typeof window !== 'undefined') {
  ;(window as any).__objectsStore = null // Will be set after store creation
}

/**
 * Register store for terminal/external access
 */
export function registerObjectsStoreForTerminal(): void {
  const store = useObjectsStore()
  ;(window as any).__objectsStore = store
}
