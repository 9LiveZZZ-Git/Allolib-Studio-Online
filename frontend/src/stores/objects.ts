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

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'step'

export interface Keyframe<T> {
  time: number
  value: T
  easing: EasingType
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
   */
  function setProperty(objectId: string, propertyName: string, value: number | number[]): void {
    const obj = objects.value.get(objectId)
    if (!obj) {
      console.warn(`[ObjectsStore] Object not found: ${objectId}`)
      return
    }

    // Map property names to object structure
    switch (propertyName) {
      // Transform - Position
      case 'positionX':
        obj.transform.position[0] = value as number
        break
      case 'positionY':
        obj.transform.position[1] = value as number
        break
      case 'positionZ':
        obj.transform.position[2] = value as number
        break

      // Transform - Scale
      case 'scaleX':
        obj.transform.scale[0] = value as number
        break
      case 'scaleY':
        obj.transform.scale[1] = value as number
        break
      case 'scaleZ':
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

    return interpolate(kf1.value, kf2.value, applyEasing(t, kf1.easing))
  }

  // ─── WASM Sync ───────────────────────────────────────────────────────────

  /**
   * Sync object state to WASM runtime
   */
  function syncObjectToWasm(objectId: string): void {
    const obj = objects.value.get(objectId)
    if (!obj) return

    // Get WASM module from window
    const wasmModule = (window as any).__alloWasmModule
    if (!wasmModule) return

    // TODO: Call WASM functions to update object transform/material
    // This will be implemented when ObjectManager is added to C++
    // For now, objects are managed in user C++ code
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
    objects.value.clear()
    keyframeCurves.value.clear()

    for (const obj of data.objects) {
      objects.value.set(obj.id, obj)
    }

    for (const { key, curve } of data.keyframeCurves) {
      keyframeCurves.value.set(key, curve)
    }

    console.log(`[ObjectsStore] Loaded ${data.objects.length} objects, ${data.keyframeCurves.length} curves`)
  }

  /**
   * Clear all objects
   */
  function clear(): void {
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

    // Serialization
    toJSON,
    fromJSON,
    clear,
  }
})

// ─── Utility Functions ───────────────────────────────────────────────────────

function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'linear':
      return t
    case 'easeIn':
      return t * t
    case 'easeOut':
      return 1 - (1 - t) * (1 - t)
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    case 'step':
      return t < 1 ? 0 : 1
    default:
      return t
  }
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
