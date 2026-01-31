/**
 * Shared Keyframe Utilities Composable
 *
 * Provides reusable keyframe management functions that can be used
 * across multiple stores (objects, environment, events).
 *
 * This consolidates the duplicated keyframe interpolation code
 * that previously existed in 3+ stores.
 */

import { ref, computed, type Ref } from 'vue'

// ─── Types ───────────────────────────────────────────────────────────────────

export type EasingType =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeOutBack'
  | 'bounce'
  | 'elastic'
  | 'step'
  | 'bezier'

export type BezierPoints = [number, number, number, number]

export interface Keyframe<T = number> {
  time: number
  value: T
  easing: EasingType
  bezierPoints?: BezierPoints
}

export interface KeyframeCurve<T = number> {
  property: string
  keyframes: Keyframe<T>[]
}

// ─── Composable ──────────────────────────────────────────────────────────────

export function useKeyframes<T = number>(
  interpolateFn?: (a: T, b: T, t: number) => T
) {
  const keyframes = ref<Keyframe<T>[]>([]) as Ref<Keyframe<T>[]>

  // Default interpolation for numbers and arrays
  const interpolate = interpolateFn || ((a: T, b: T, t: number): T => {
    if (typeof a === 'number' && typeof b === 'number') {
      return (a + (b - a) * t) as unknown as T
    }
    if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
      return a.map((v, i) => v + ((b as number[])[i] - v) * t) as unknown as T
    }
    return t < 1 ? a : b
  })

  // ─── Keyframe CRUD ─────────────────────────────────────────────────────────

  function addKeyframe(
    time: number,
    value: T,
    easing: EasingType = 'linear',
    bezierPoints?: BezierPoints
  ): Keyframe<T> {
    // Check if keyframe exists at this time
    const existingIdx = keyframes.value.findIndex(kf =>
      Math.abs(kf.time - time) < 0.001
    )

    const kf: Keyframe<T> = { time, value, easing, bezierPoints }

    if (existingIdx >= 0) {
      keyframes.value[existingIdx] = kf
    } else {
      keyframes.value.push(kf)
      sortKeyframes()
    }

    return kf
  }

  function removeKeyframe(time: number): boolean {
    const idx = keyframes.value.findIndex(kf =>
      Math.abs(kf.time - time) < 0.001
    )
    if (idx >= 0) {
      keyframes.value.splice(idx, 1)
      return true
    }
    return false
  }

  function removeKeyframeByIndex(index: number): boolean {
    if (index >= 0 && index < keyframes.value.length) {
      keyframes.value.splice(index, 1)
      return true
    }
    return false
  }

  function updateKeyframe(
    time: number,
    updates: Partial<Keyframe<T>>
  ): boolean {
    const kf = keyframes.value.find(k => Math.abs(k.time - time) < 0.001)
    if (kf) {
      Object.assign(kf, updates)
      if (updates.time !== undefined) {
        sortKeyframes()
      }
      return true
    }
    return false
  }

  function moveKeyframe(oldTime: number, newTime: number): boolean {
    const kf = keyframes.value.find(k => Math.abs(k.time - oldTime) < 0.001)
    if (kf) {
      kf.time = newTime
      sortKeyframes()
      return true
    }
    return false
  }

  function getKeyframe(time: number): Keyframe<T> | undefined {
    return keyframes.value.find(kf => Math.abs(kf.time - time) < 0.001)
  }

  function getKeyframeByIndex(index: number): Keyframe<T> | undefined {
    return keyframes.value[index]
  }

  function sortKeyframes(): void {
    keyframes.value.sort((a, b) => a.time - b.time)
  }

  function clear(): void {
    keyframes.value = []
  }

  // ─── Interpolation ─────────────────────────────────────────────────────────

  function getValueAtTime(time: number): T | undefined {
    if (keyframes.value.length === 0) return undefined
    if (keyframes.value.length === 1) return keyframes.value[0].value

    const kfs = keyframes.value

    // Before first keyframe
    if (time <= kfs[0].time) return kfs[0].value

    // After last keyframe
    if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value

    // Find surrounding keyframes
    let i = 0
    while (i < kfs.length - 1 && kfs[i + 1].time < time) {
      i++
    }

    const kf1 = kfs[i]
    const kf2 = kfs[i + 1]
    const t = (time - kf1.time) / (kf2.time - kf1.time)
    const easedT = applyEasing(t, kf1.easing, kf1.bezierPoints)

    return interpolate(kf1.value, kf2.value, easedT)
  }

  function getSurroundingKeyframes(time: number): {
    before: Keyframe<T> | null
    after: Keyframe<T> | null
  } {
    const before = [...keyframes.value].reverse().find(kf => kf.time <= time) || null
    const after = keyframes.value.find(kf => kf.time > time) || null
    return { before, after }
  }

  // ─── Computed ──────────────────────────────────────────────────────────────

  const keyframeCount = computed(() => keyframes.value.length)

  const hasKeyframes = computed(() => keyframes.value.length > 0)

  const firstKeyframeTime = computed(() =>
    keyframes.value.length > 0 ? keyframes.value[0].time : null
  )

  const lastKeyframeTime = computed(() =>
    keyframes.value.length > 0 ? keyframes.value[keyframes.value.length - 1].time : null
  )

  const duration = computed(() => {
    if (keyframes.value.length < 2) return 0
    return keyframes.value[keyframes.value.length - 1].time - keyframes.value[0].time
  })

  // ─── Serialization ─────────────────────────────────────────────────────────

  function toJSON(): Keyframe<T>[] {
    return JSON.parse(JSON.stringify(keyframes.value))
  }

  function fromJSON(data: Keyframe<T>[]): void {
    keyframes.value = data
    sortKeyframes()
  }

  return {
    // State
    keyframes,

    // CRUD
    addKeyframe,
    removeKeyframe,
    removeKeyframeByIndex,
    updateKeyframe,
    moveKeyframe,
    getKeyframe,
    getKeyframeByIndex,
    clear,

    // Interpolation
    getValueAtTime,
    getSurroundingKeyframes,

    // Computed
    keyframeCount,
    hasKeyframes,
    firstKeyframeTime,
    lastKeyframeTime,
    duration,

    // Serialization
    toJSON,
    fromJSON,
  }
}

// ─── Easing Functions ────────────────────────────────────────────────────────

export function applyEasing(
  t: number,
  easing: EasingType,
  bezierPoints?: BezierPoints
): number {
  switch (easing) {
    case 'linear':
      return t

    case 'easeIn':
      return t * t * t  // Cubic ease in

    case 'easeOut':
      return 1 - Math.pow(1 - t, 3)  // Cubic ease out

    case 'easeInOut':
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2

    case 'easeOutBack': {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    }

    case 'bounce': {
      const n1 = 7.5625
      const d1 = 2.75
      if (t < 1 / d1) return n1 * t * t
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
      return n1 * (t -= 2.625 / d1) * t + 0.984375
    }

    case 'elastic': {
      if (t === 0 || t === 1) return t
      const c4 = (2 * Math.PI) / 3
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
    }

    case 'step':
      return t < 1 ? 0 : 1

    case 'bezier':
      if (bezierPoints) {
        return bezierEase(t, bezierPoints)
      }
      return t

    default:
      return t
  }
}

function bezierEase(t: number, points: BezierPoints): number {
  const [x1, y1, x2, y2] = points

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

// ─── Interpolation Helpers ───────────────────────────────────────────────────

export function interpolateNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function interpolateArray(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => v + (b[i] - v) * t)
}

export function interpolateColor(
  a: [number, number, number, number],
  b: [number, number, number, number],
  t: number
): [number, number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ]
}

// ─── Preset Easing Curves ────────────────────────────────────────────────────

export const EASING_PRESETS: Record<string, BezierPoints> = {
  // Standard CSS easings
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],

  // Common animation curves
  easeInQuad: [0.55, 0.085, 0.68, 0.53],
  easeOutQuad: [0.25, 0.46, 0.45, 0.94],
  easeInOutQuad: [0.455, 0.03, 0.515, 0.955],

  easeInCubic: [0.55, 0.055, 0.675, 0.19],
  easeOutCubic: [0.215, 0.61, 0.355, 1],
  easeInOutCubic: [0.645, 0.045, 0.355, 1],

  easeInQuart: [0.895, 0.03, 0.685, 0.22],
  easeOutQuart: [0.165, 0.84, 0.44, 1],
  easeInOutQuart: [0.77, 0, 0.175, 1],

  easeInExpo: [0.95, 0.05, 0.795, 0.035],
  easeOutExpo: [0.19, 1, 0.22, 1],
  easeInOutExpo: [1, 0, 0, 1],

  easeInBack: [0.6, -0.28, 0.735, 0.045],
  easeOutBack: [0.175, 0.885, 0.32, 1.275],
  easeInOutBack: [0.68, -0.55, 0.265, 1.55],
}
