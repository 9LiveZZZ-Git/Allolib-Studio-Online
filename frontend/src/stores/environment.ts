/**
 * Environment Store
 *
 * Manages global scene environment settings:
 * - Background/clear color
 * - Skybox/HDRI environment
 * - Fog settings
 * - Ambient lighting
 * - Global post-processing
 *
 * These settings can be keyframed for timeline animation.
 * The parameter system reads from and writes to this store.
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

// ─── Environment Types ───────────────────────────────────────────────────────

export interface FogSettings {
  enabled: boolean
  type: 'linear' | 'exponential'
  color: [number, number, number]
  near: number
  far: number
  density: number  // For exponential fog
}

export interface AmbientSettings {
  color: [number, number, number]
  intensity: number
}

export interface SkyboxSettings {
  enabled: boolean
  type: 'color' | 'hdri' | 'procedural'
  hdriPath?: string
  proceduralType?: 'gradient' | 'atmosphere'
  topColor?: [number, number, number]
  bottomColor?: [number, number, number]
}

export interface EnvironmentState {
  // Background
  backgroundColor: [number, number, number, number]

  // Skybox
  skybox: SkyboxSettings

  // Lighting
  ambient: AmbientSettings

  // Fog
  fog: FogSettings

  // HDR Environment for reflections/IBL
  hdriEnvironment?: string
  hdriIntensity: number
  hdriRotation: number
}

// ─── Keyframe Types ──────────────────────────────────────────────────────────

export type EasingType =
  | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'easeOutBack' | 'bounce' | 'elastic' | 'step' | 'bezier'

export type BezierPoints = [number, number, number, number]

export interface Keyframe<T> {
  time: number
  value: T
  easing: EasingType
  bezierPoints?: BezierPoints
}

export interface KeyframeCurve<T> {
  property: string
  keyframes: Keyframe<T>[]
}

// ─── Default State ───────────────────────────────────────────────────────────

function createDefaultState(): EnvironmentState {
  return {
    backgroundColor: [0.1, 0.1, 0.1, 1.0],

    skybox: {
      enabled: false,
      type: 'color',
    },

    ambient: {
      color: [1.0, 1.0, 1.0],
      intensity: 0.3,
    },

    fog: {
      enabled: false,
      type: 'linear',
      color: [0.5, 0.5, 0.5],
      near: 10,
      far: 100,
      density: 0.01,
    },

    hdriIntensity: 1.0,
    hdriRotation: 0,
  }
}

// ─── Store Definition ────────────────────────────────────────────────────────

export const useEnvironmentStore = defineStore('environment', () => {
  // State
  const state = ref<EnvironmentState>(createDefaultState())
  const keyframeCurves = ref<Map<string, KeyframeCurve<any>>>(new Map())

  // Track if WASM is connected
  const wasmConnected = ref(false)

  // ─── Property Setters (Called by Parameter System) ──────────────────────

  /**
   * Set an environment property value.
   * This is the main entry point from the parameter panel.
   */
  function setProperty(propertyName: string, value: number | number[] | boolean): void {
    switch (propertyName) {
      // Background
      case 'backgroundColor':
        if (Array.isArray(value) && value.length >= 4) {
          state.value.backgroundColor = value as [number, number, number, number]
        }
        break

      // Ambient
      case 'ambientColor':
        if (Array.isArray(value) && value.length >= 3) {
          state.value.ambient.color = value as [number, number, number]
        }
        break
      case 'ambientIntensity':
        state.value.ambient.intensity = value as number
        break

      // Fog
      case 'fogEnabled':
        state.value.fog.enabled = Boolean(value)
        break
      case 'fogColor':
        if (Array.isArray(value) && value.length >= 3) {
          state.value.fog.color = value as [number, number, number]
        }
        break
      case 'fogNear':
        state.value.fog.near = value as number
        break
      case 'fogFar':
        state.value.fog.far = value as number
        break
      case 'fogDensity':
        state.value.fog.density = value as number
        break

      // Skybox
      case 'skyboxEnabled':
        state.value.skybox.enabled = Boolean(value)
        break

      // HDRI
      case 'hdriIntensity':
        state.value.hdriIntensity = value as number
        break
      case 'hdriRotation':
        state.value.hdriRotation = value as number
        break

      default:
        console.warn(`[EnvironmentStore] Unknown property: ${propertyName}`)
    }

    // Sync to WASM
    syncToWasm()
  }

  /**
   * Get a property value
   */
  function getProperty(propertyName: string): number | number[] | boolean | undefined {
    switch (propertyName) {
      case 'backgroundColor': return state.value.backgroundColor
      case 'ambientColor': return state.value.ambient.color
      case 'ambientIntensity': return state.value.ambient.intensity
      case 'fogEnabled': return state.value.fog.enabled
      case 'fogColor': return state.value.fog.color
      case 'fogNear': return state.value.fog.near
      case 'fogFar': return state.value.fog.far
      case 'fogDensity': return state.value.fog.density
      case 'skyboxEnabled': return state.value.skybox.enabled
      case 'hdriIntensity': return state.value.hdriIntensity
      case 'hdriRotation': return state.value.hdriRotation
      default: return undefined
    }
  }

  // ─── Convenience Setters ─────────────────────────────────────────────────

  function setBackgroundColor(color: [number, number, number, number]): void {
    state.value.backgroundColor = color
    syncToWasm()
  }

  function setAmbientLight(color: [number, number, number], intensity: number): void {
    state.value.ambient.color = color
    state.value.ambient.intensity = intensity
    syncToWasm()
  }

  function setFog(settings: Partial<FogSettings>): void {
    Object.assign(state.value.fog, settings)
    syncToWasm()
  }

  function loadHDRI(path: string): void {
    state.value.hdriEnvironment = path
    state.value.skybox.enabled = true
    state.value.skybox.type = 'hdri'
    state.value.skybox.hdriPath = path
    syncToWasm()
    console.log(`[EnvironmentStore] Loading HDRI: ${path}`)
  }

  // ─── Keyframe Management ─────────────────────────────────────────────────

  function addKeyframe(
    property: string,
    time: number,
    value: any,
    easing: EasingType = 'linear'
  ): void {
    let curve = keyframeCurves.value.get(property)

    if (!curve) {
      curve = { property, keyframes: [] }
      keyframeCurves.value.set(property, curve)
    }

    const existingIdx = curve.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.001)
    if (existingIdx >= 0) {
      curve.keyframes[existingIdx].value = value
      curve.keyframes[existingIdx].easing = easing
    } else {
      curve.keyframes.push({ time, value, easing })
      curve.keyframes.sort((a, b) => a.time - b.time)
    }

    console.log(`[EnvironmentStore] Added keyframe: ${property} @ ${time}s`)
  }

  function removeKeyframe(property: string, time: number): boolean {
    const curve = keyframeCurves.value.get(property)
    if (!curve) return false

    const idx = curve.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.001)
    if (idx >= 0) {
      curve.keyframes.splice(idx, 1)
      if (curve.keyframes.length === 0) {
        keyframeCurves.value.delete(property)
      }
      return true
    }
    return false
  }

  function hasKeyframes(property: string): boolean {
    const curve = keyframeCurves.value.get(property)
    return curve ? curve.keyframes.length > 0 : false
  }

  function getValueAtTime(property: string, time: number): any {
    const curve = keyframeCurves.value.get(property)
    if (!curve || curve.keyframes.length === 0) {
      return getProperty(property)
    }

    const keyframes = curve.keyframes

    if (time <= keyframes[0].time) {
      return keyframes[0].value
    }
    if (time >= keyframes[keyframes.length - 1].time) {
      return keyframes[keyframes.length - 1].value
    }

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

  function connectWasm(module: any): void {
    wasmConnected.value = true
    syncToWasm()
  }

  function disconnectWasm(): void {
    wasmConnected.value = false
  }

  function syncToWasm(): void {
    const wasmModule = (window as any).__alloWasmModule
    if (!wasmModule) return

    // Sync background color
    if (wasmModule._al_env_set_background_color) {
      const bg = state.value.backgroundColor
      wasmModule._al_env_set_background_color(bg[0], bg[1], bg[2], bg[3])
    }

    // Sync fog
    if (wasmModule._al_env_set_fog && state.value.fog.enabled) {
      const fog = state.value.fog
      wasmModule._al_env_set_fog(
        fog.enabled ? 1 : 0,
        fog.near,
        fog.far,
        fog.color[0],
        fog.color[1],
        fog.color[2]
      )
    }

    // Sync ambient
    if (wasmModule._al_env_set_ambient) {
      const amb = state.value.ambient
      wasmModule._al_env_set_ambient(amb.color[0], amb.color[1], amb.color[2], amb.intensity)
    }
  }

  // ─── Serialization ───────────────────────────────────────────────────────

  function toJSON(): {
    state: EnvironmentState
    keyframeCurves: Array<{ property: string; curve: KeyframeCurve<any> }>
  } {
    return {
      state: JSON.parse(JSON.stringify(state.value)),
      keyframeCurves: Array.from(keyframeCurves.value.entries()).map(([property, curve]) => ({
        property,
        curve,
      })),
    }
  }

  function fromJSON(data: ReturnType<typeof toJSON>): void {
    state.value = data.state
    keyframeCurves.value.clear()
    for (const { property, curve } of data.keyframeCurves) {
      keyframeCurves.value.set(property, curve)
    }
    syncToWasm()
  }

  function reset(): void {
    state.value = createDefaultState()
    keyframeCurves.value.clear()
    syncToWasm()
  }

  return {
    // State
    state,
    keyframeCurves,
    wasmConnected,

    // Property access (for parameter panel)
    setProperty,
    getProperty,

    // Convenience setters
    setBackgroundColor,
    setAmbientLight,
    setFog,
    loadHDRI,

    // Keyframes
    addKeyframe,
    removeKeyframe,
    hasKeyframes,
    getValueAtTime,

    // WASM
    connectWasm,
    disconnectWasm,
    syncToWasm,

    // Serialization
    toJSON,
    fromJSON,
    reset,
  }
})

// ─── Utility Functions ───────────────────────────────────────────────────────

function applyEasing(t: number, easing: EasingType, bezierPoints?: BezierPoints): number {
  switch (easing) {
    case 'linear': return t
    case 'easeIn': return t * t
    case 'easeOut': return 1 - (1 - t) * (1 - t)
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    case 'easeOutBack': {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    }
    case 'bounce': {
      const n1 = 7.5625, d1 = 2.75
      if (t < 1 / d1) return n1 * t * t
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
      return n1 * (t -= 2.625 / d1) * t + 0.984375
    }
    case 'elastic': {
      const c4 = (2 * Math.PI) / 3
      return t === 0 ? 0 : t === 1 ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
    }
    case 'step': return t < 1 ? 0 : 1
    case 'bezier': {
      if (bezierPoints) {
        return bezierEase(t, bezierPoints)
      }
      return t
    }
    default: return t
  }
}

function bezierEase(t: number, points: BezierPoints): number {
  const [x1, y1, x2, y2] = points
  // Newton-Raphson to find t from x
  let guessT = t
  for (let i = 0; i < 8; i++) {
    const currentX = cubicBezier(guessT, 0, x1, x2, 1)
    const slope = cubicBezierDerivative(guessT, 0, x1, x2, 1)
    if (Math.abs(slope) < 1e-6) break
    guessT -= (currentX - t) / slope
  }
  return cubicBezier(guessT, 0, y1, y2, 1)
}

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
}

function cubicBezierDerivative(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t
  return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2)
}

function interpolate(a: any, b: any, t: number): any {
  if (typeof a === 'number' && typeof b === 'number') {
    return a + (b - a) * t
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    return a.map((v, i) => v + (b[i] - v) * t)
  }
  return t < 1 ? a : b
}

// Register on window for terminal access
if (typeof window !== 'undefined') {
  ;(window as any).__environmentStore = null
}

export function registerEnvironmentStoreForTerminal(): void {
  const store = useEnvironmentStore()
  ;(window as any).__environmentStore = store
}
