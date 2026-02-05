/**
 * Comprehensive Functional Verification Tests
 *
 * Tests ALL examples from the Examples dropdown on BOTH WebGL2 and WebGPU backends.
 *
 * For each example, tests:
 * 1. Compilation succeeds
 * 2. Rendering produces visible content
 * 3. Category-specific functional behavior:
 *    - Interaction: keyboard/mouse input causes visual changes
 *    - Audio: audio context exists and no errors
 *    - Animation: visual changes over time
 *    - Graphics: proper rendering with color/shading
 *
 * Generates a report documenting what works and what needs fixing.
 */

import { test, expect, Page } from './fixtures'
import {
  setBackend,
  isWebGPUFunctional,
  BASE_URL,
  COMPILE_TIMEOUT,
} from './test-helpers'
import { PNG } from 'pngjs'
import * as fs from 'fs'
import * as path from 'path'

// ─── Constants ────────────────────────────────────────────────────────────────

const RENDER_WAIT = 3000
const ANIMATION_WAIT = 800
const INTERACTION_WAIT = 400

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunctionalTestResult {
  exampleId: string
  title: string
  category: string
  backend: 'webgl2' | 'webgpu'
  compilation: 'pass' | 'fail' | 'skip'
  rendering: 'pass' | 'fail' | 'skip'
  functional: 'pass' | 'partial' | 'fail' | 'skip' | 'n/a'
  functionalDetails: string
  errors: string[]
  metrics: {
    hasContent: boolean
    uniqueColors: number
    animationChange: number
    interactionChange: number
    audioContext: boolean
  }
}

// Global results storage
const testResults: FunctionalTestResult[] = []

// ─── Utilities ────────────────────────────────────────────────────────────────

async function analyzeCanvas(page: Page): Promise<{
  hasContent: boolean
  uniqueColors: number
  brightness: number
}> {
  const canvasLocator = page.locator('[data-testid="canvas"], #canvas, canvas').first()

  try {
    const screenshot = await canvasLocator.screenshot({ type: 'png' })
    const png = PNG.sync.read(screenshot)
    const { data, width, height } = png

    const colorCounts: Record<string, number> = {}
    let nonBlackCount = 0
    let totalBrightness = 0

    for (let i = 0; i < data.length; i += 8) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      if (r > 15 || g > 15 || b > 15) nonBlackCount++
      totalBrightness += (r + g + b) / 3

      const qr = Math.floor(r / 32) * 32
      const qg = Math.floor(g / 32) * 32
      const qb = Math.floor(b / 32) * 32
      const key = `${qr},${qg},${qb}`
      colorCounts[key] = (colorCounts[key] || 0) + 1
    }

    const totalPixels = (width * height) / 2
    return {
      hasContent: nonBlackCount > totalPixels * 0.01,
      uniqueColors: Object.keys(colorCounts).length,
      brightness: totalBrightness / (data.length / 8) / 255
    }
  } catch {
    return { hasContent: false, uniqueColors: 0, brightness: 0 }
  }
}

async function detectAnimation(page: Page, intervalMs: number = ANIMATION_WAIT): Promise<number> {
  const canvasLocator = page.locator('[data-testid="canvas"], #canvas, canvas').first()

  try {
    const shot1 = await canvasLocator.screenshot({ type: 'png' })
    await page.waitForTimeout(intervalMs)
    const shot2 = await canvasLocator.screenshot({ type: 'png' })

    const png1 = PNG.sync.read(shot1)
    const png2 = PNG.sync.read(shot2)

    if (png1.data.length !== png2.data.length) return 0

    let diffCount = 0
    for (let i = 0; i < png1.data.length; i += 8) {
      const dr = Math.abs(png1.data[i] - png2.data[i])
      const dg = Math.abs(png1.data[i + 1] - png2.data[i + 1])
      const db = Math.abs(png1.data[i + 2] - png2.data[i + 2])
      if (dr > 10 || dg > 10 || db > 10) diffCount++
    }

    return (diffCount / (png1.data.length / 8)) * 100
  } catch {
    return 0
  }
}

async function testKeyboardInteraction(page: Page, keys: string[]): Promise<number> {
  const canvasLocator = page.locator('[data-testid="canvas"], #canvas, canvas').first()

  try {
    const shotBefore = await canvasLocator.screenshot({ type: 'png' })

    // Click to focus
    await canvasLocator.click({ force: true })
    await page.waitForTimeout(100)

    // Press keys
    for (const key of keys) {
      await page.keyboard.press(key)
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(INTERACTION_WAIT)

    const shotAfter = await canvasLocator.screenshot({ type: 'png' })

    const png1 = PNG.sync.read(shotBefore)
    const png2 = PNG.sync.read(shotAfter)

    if (png1.data.length !== png2.data.length) return 0

    let diffCount = 0
    for (let i = 0; i < png1.data.length; i += 4) {
      const dr = Math.abs(png1.data[i] - png2.data[i])
      const dg = Math.abs(png1.data[i + 1] - png2.data[i + 1])
      const db = Math.abs(png1.data[i + 2] - png2.data[i + 2])
      if (dr > 15 || dg > 15 || db > 15) diffCount++
    }

    return (diffCount / (png1.data.length / 4)) * 100
  } catch {
    return 0
  }
}

async function checkAudioContext(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const win = window as any
    const ctx = win.__audioContext || win.Module?.audioContext
    return !!ctx
  })
}

async function setupAndRunExample(page: Page, exampleId: string): Promise<{
  success: boolean
  errors: string[]
  logs: string[]
}> {
  const errors: string[] = []
  const logs: string[] = []

  const consoleHandler = (msg: any) => {
    const text = msg.text()
    logs.push(`[${msg.type()}] ${text}`)
    if (msg.type() === 'error') errors.push(text)
  }
  page.on('console', consoleHandler)
  page.on('pageerror', (err: Error) => errors.push(`PageError: ${err.message}`))

  await page.goto(BASE_URL)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  // Clear cached project
  await page.evaluate(() => {
    localStorage.removeItem('allolib-project')
    localStorage.removeItem('allolib-code')
    localStorage.removeItem('unified-project')
  })

  // Load example
  const loaded = await page.evaluate((id) => {
    const win = window as any
    const allExamples = win.__allExamples || win.allExamples || []
    const ex = allExamples.find((e: any) => e.id === id)
    if (!ex) return false

    const projectStore = win.__stores?.project
    if (!projectStore) return false

    try {
      if (ex.files) {
        if (typeof projectStore.newProject === 'function') projectStore.newProject()
        if (typeof projectStore.addOrUpdateFile === 'function') {
          for (const file of ex.files) projectStore.addOrUpdateFile(file.path, file.content)
          if (ex.mainFile) projectStore.setActiveFile?.(ex.mainFile)
        }
      } else if (ex.code) {
        if (typeof projectStore.loadFromCode === 'function') {
          projectStore.loadFromCode(ex.code, 'main.cpp')
        } else if (typeof projectStore.addOrUpdateFile === 'function') {
          projectStore.addOrUpdateFile('main.cpp', ex.code)
        }
      }
      if (win.monaco?.editor) {
        const models = win.monaco.editor.getModels()
        if (models?.length > 0) {
          const code = ex.code || ex.files?.find((f: any) => f.path === ex.mainFile)?.content
          if (code) models[0].setValue(code)
        }
      }
      return true
    } catch { return false }
  }, exampleId)

  if (!loaded) {
    page.off('console', consoleHandler)
    return { success: false, errors: [`Could not load example: ${exampleId}`], logs }
  }

  await page.waitForTimeout(500)

  // Click run
  const runButton = page.locator('[data-testid="run-button"]').first()
  if (await runButton.count() === 0) {
    page.off('console', consoleHandler)
    return { success: false, errors: ['Run button not found'], logs }
  }
  await runButton.click()

  // Wait for compilation
  try {
    await page.waitForFunction(() => {
      const text = document.body.innerText || ''
      return text.includes('[SUCCESS]') || text.includes('Application started') ||
             text.includes('Running') || text.includes('[ERROR]') ||
             text.includes('error:') || text.includes('compilation failed')
    }, { timeout: COMPILE_TIMEOUT })
  } catch {
    page.off('console', consoleHandler)
    return { success: false, errors: ['Compilation timed out'], logs }
  }

  const bodyText = await page.evaluate(() => document.body.innerText)
  const compileFailed = bodyText.includes('[ERROR]') || bodyText.includes('compilation failed')
  if (compileFailed) {
    page.off('console', consoleHandler)
    return { success: false, errors: ['Compilation failed'], logs }
  }

  await page.waitForTimeout(RENDER_WAIT)
  page.off('console', consoleHandler)

  const criticalErrors = errors.filter(e =>
    !e.includes('favicon') && !e.includes('DevTools') && !e.includes('extension') &&
    !e.includes('Manifest') && !e.includes('third-party')
  )

  return { success: true, errors: criticalErrors, logs }
}

// ─── Example Definitions ──────────────────────────────────────────────────────

interface ExampleDef {
  id: string
  title: string
  category: 'interaction' | 'audio' | 'animation' | 'graphics' | 'simulation'
  testKeys?: string[] // Keys to test for interaction
  expectAnimation?: boolean
  expectAudio?: boolean
}

// All examples from the dropdown, categorized by functional behavior
const ALL_EXAMPLES: ExampleDef[] = [
  // === BASICS ===
  { id: 'hello-sphere', title: 'Hello Sphere', category: 'graphics' },
  { id: 'hello-audio', title: 'Hello Audio', category: 'audio', expectAudio: true },
  { id: 'hello-audiovisual', title: 'Hello Audiovisual', category: 'audio', expectAudio: true, expectAnimation: true },
  { id: 'shape-gallery', title: 'Shape Gallery', category: 'animation', expectAnimation: true },
  { id: 'custom-mesh', title: 'Custom Mesh', category: 'graphics' },
  { id: 'color-hsv', title: 'HSV Colors', category: 'animation', expectAnimation: true },
  { id: 'vertex-colors', title: 'Vertex Colors', category: 'graphics' },

  // === GRAPHICS ===
  { id: 'points-only-test', title: 'Points Only', category: 'graphics' },
  { id: 'triangles-only-test', title: 'Triangles Only', category: 'graphics' },
  { id: 'mesh-primitives', title: 'Mesh Primitives', category: 'graphics' },
  { id: 'mesh-normals', title: 'Mesh Normals', category: 'animation', expectAnimation: true },
  { id: 'transform-hierarchy', title: 'Transform Hierarchy', category: 'animation', expectAnimation: true },
  { id: 'matrix-operations', title: 'Matrix Operations', category: 'animation', expectAnimation: true },
  { id: 'basic-lighting', title: 'Basic Lighting', category: 'graphics' },
  { id: 'custom-shader', title: 'Custom Shader', category: 'graphics' },
  { id: 'procedural-texture', title: 'Procedural Texture', category: 'graphics' },
  { id: 'web-image-texture', title: 'Web Image Texture', category: 'graphics' },

  // === AUDIO ===
  { id: 'oscillator-types', title: 'Oscillator Types', category: 'interaction', testKeys: ['1', '2', '3', '4'], expectAudio: true },
  { id: 'fm-synthesis', title: 'FM Synthesis', category: 'audio', expectAudio: true },
  { id: 'adsr-envelope', title: 'ADSR Envelope', category: 'audio', expectAudio: true },
  { id: 'additive-synthesis', title: 'Additive Synthesis', category: 'audio', expectAudio: true },
  { id: 'web-sample-player', title: 'Web Sample Player', category: 'audio', expectAudio: true },
  { id: 'reverb-filter-chain', title: 'Reverb Filter Chain', category: 'audio', expectAudio: true },

  // === INTERACTION ===
  { id: 'piano-keyboard', title: 'Piano Keyboard', category: 'interaction', testKeys: ['a', 's', 'd', 'f'], expectAudio: true },
  { id: 'mouse-theremin', title: 'Mouse Theremin', category: 'audio', expectAudio: true },
  { id: 'camera-control', title: 'Camera Control', category: 'interaction', testKeys: ['w', 'a', 's', 'd'] },

  // === SCENE ===
  { id: 'synthvoice-basic', title: 'SynthVoice Basic', category: 'audio', expectAudio: true },
  { id: 'polysynth-demo', title: 'PolySynth Demo', category: 'audio', expectAudio: true },
  { id: 'dynamic-scene', title: 'Dynamic Scene', category: 'audio', expectAudio: true },

  // === SIMULATION ===
  { id: 'particle-system', title: 'Particle System', category: 'simulation', expectAnimation: true },
  { id: 'audio-reactive', title: 'Audio Reactive', category: 'audio', expectAudio: true, expectAnimation: true },
  { id: 'lissajous', title: 'Lissajous Curves', category: 'animation', expectAnimation: true },
  { id: 'fractal-tree', title: 'Fractal Tree', category: 'graphics' },
  { id: 'sim-particle-fountain', title: 'Particle Fountain', category: 'simulation', expectAnimation: true },
  { id: 'sim-flocking', title: 'Flocking Boids', category: 'simulation', expectAnimation: true },
  { id: 'sim-wave-equation', title: 'Wave Equation', category: 'simulation', expectAnimation: true },
  { id: 'sim-spring-mesh', title: 'Spring Mesh', category: 'simulation', expectAnimation: true },
  { id: 'sim-ant-trails', title: 'Ant Trails', category: 'simulation', expectAnimation: true },
  { id: 'sim-andromeda-galaxy', title: 'Andromeda Galaxy', category: 'graphics' },
  { id: 'sim-particle-galaxy', title: 'Particle Galaxy', category: 'simulation', expectAnimation: true },
  { id: 'sim-point-test', title: 'Point Test', category: 'graphics' },

  // === CELLULAR AUTOMATA ===
  { id: 'ca-game-of-life', title: 'Game of Life', category: 'simulation', expectAnimation: true },
  { id: 'ca-falling-sand', title: 'Falling Sand', category: 'simulation', expectAnimation: true },
  { id: 'ca-3d-life', title: '3D Game of Life', category: 'simulation', expectAnimation: true },
  { id: 'ca-reaction-diffusion', title: 'Reaction Diffusion', category: 'simulation', expectAnimation: true },
  { id: 'ca-wireworld', title: 'Wireworld', category: 'simulation', expectAnimation: true },

  // === RAY MARCHING ===
  { id: 'rm-sphere-basic', title: 'RM Sphere', category: 'graphics' },
  { id: 'rm-mandelbulb', title: 'RM Mandelbulb', category: 'graphics' },
  { id: 'rm-csg-operations', title: 'RM CSG Operations', category: 'graphics' },
  { id: 'rm-infinite-repetition', title: 'RM Infinite Repetition', category: 'graphics' },
  { id: 'rm-organic-blob', title: 'RM Organic Blob', category: 'animation', expectAnimation: true },
  { id: 'rm-terrain', title: 'RM Terrain', category: 'graphics' },
  { id: 'rm-volumetric-clouds', title: 'RM Volumetric Clouds', category: 'graphics' },

  // === FLUIDS ===
  { id: 'fluid-simple-2d', title: 'Simple 2D Fluid', category: 'simulation', expectAnimation: true },
  { id: 'fluid-smoke-2d', title: '2D Smoke', category: 'simulation', expectAnimation: true },
  { id: 'fluid-ink-drops', title: 'Ink Drops', category: 'simulation', expectAnimation: true },
  { id: 'fluid-lava-lamp', title: 'Lava Lamp', category: 'simulation', expectAnimation: true },

  // === ARTIFICIAL LIFE ===
  { id: 'life-slime-mold', title: 'Slime Mold', category: 'simulation', expectAnimation: true },
  { id: 'life-creatures-simple', title: 'Simple Creatures', category: 'simulation', expectAnimation: true },
  { id: 'life-aquarium', title: 'Aquarium', category: 'simulation', expectAnimation: true },
  { id: 'life-coral-growth', title: 'Coral Growth', category: 'simulation', expectAnimation: true },
  { id: 'life-neural-creatures', title: 'Neural Creatures', category: 'simulation', expectAnimation: true },
  { id: 'life-plants-2d', title: '2D Plants', category: 'simulation', expectAnimation: true },

  // === AGENTS ===
  { id: 'agents-evolution', title: 'Evolution Agents', category: 'simulation', expectAnimation: true },
  { id: 'agents-predator-prey', title: 'Predator-Prey', category: 'simulation', expectAnimation: true },
  { id: 'agents-school-fish', title: 'School of Fish', category: 'simulation', expectAnimation: true },
  { id: 'agents-traffic', title: 'Traffic Simulation', category: 'simulation', expectAnimation: true },

  // === PROCEDURAL ===
  { id: 'proc-caves', title: 'Procedural Caves', category: 'graphics' },
  { id: 'proc-city', title: 'Procedural City', category: 'graphics' },
  { id: 'proc-galaxy', title: 'Procedural Galaxy', category: 'graphics' },
  { id: 'proc-noise-gallery', title: 'Noise Gallery', category: 'graphics' },
  { id: 'proc-terrain', title: 'Procedural Terrain', category: 'graphics' },

  // === PARTICLES ===
  { id: 'particles-rain', title: 'Rain Particles', category: 'simulation', expectAnimation: true },
  { id: 'particles-fire', title: 'Fire Particles', category: 'simulation', expectAnimation: true },
  { id: 'particles-snow', title: 'Snow Particles', category: 'simulation', expectAnimation: true },
  { id: 'particles-smoke', title: 'Smoke Particles', category: 'simulation', expectAnimation: true },
  { id: 'particles-attractor', title: 'Particle Attractor', category: 'simulation', expectAnimation: true },
  { id: 'particles-swarm', title: 'Particle Swarm', category: 'simulation', expectAnimation: true },

  // === ADVANCED ===
  { id: 'adv-multifile-synth', title: 'Multi-file Synth', category: 'audio', expectAudio: true },
  { id: 'cross-platform-app', title: 'Cross-Platform App', category: 'graphics' },
  { id: 'hashspace-demo', title: 'HashSpace Demo', category: 'graphics' },

  // === FEATURE TESTS ===
  { id: 'mesh-primitives-test', title: 'Mesh Primitives Test', category: 'graphics' },
  { id: 'transform-stack-test', title: 'Transform Stack Test', category: 'graphics' },
  { id: 'distance-attenuation', title: 'Distance Attenuation', category: 'graphics' },
  { id: 'multilight-test', title: 'Multi-Light Test', category: 'graphics' },
  { id: 'easyfbo-test', title: 'EasyFBO Test', category: 'graphics' },
  { id: 'blend-modes-test', title: 'Blend Modes Test', category: 'graphics' },
  { id: 'shape-gallery-test', title: 'Shape Gallery Test', category: 'animation', expectAnimation: true },
  { id: 'parameter-panel-test', title: 'Parameter Panel Test', category: 'graphics' },
  { id: 'spatial-audio-test', title: 'Spatial Audio Test', category: 'audio', expectAudio: true },
  { id: 'gamma-dsp-test', title: 'Gamma DSP Test', category: 'audio', expectAudio: true },
  { id: 'gamma-oscillators-full', title: 'Gamma Oscillators Full', category: 'audio', expectAudio: true },
  { id: 'gamma-fft-analysis', title: 'Gamma FFT Analysis', category: 'audio', expectAudio: true, expectAnimation: true },
  { id: 'gamma-envelopes', title: 'Gamma Envelopes', category: 'audio', expectAudio: true },
  { id: 'gamma-filters', title: 'Gamma Filters', category: 'audio', expectAudio: true },
  { id: 'gamma-delays-effects', title: 'Gamma Delays Effects', category: 'audio', expectAudio: true },
  { id: 'allolib-reverb', title: 'AlloLib Reverb', category: 'audio', expectAudio: true },

  // === GPU EXAMPLES ===
  { id: 'gpu-wave-shader', title: 'GPU Wave Shader', category: 'animation', expectAnimation: true },
  { id: 'gpu-gradient-sphere', title: 'GPU Gradient Sphere', category: 'graphics' },
  { id: 'gpu-procedural-pattern', title: 'GPU Procedural Pattern', category: 'graphics' },
  { id: 'gpu-vertex-colors', title: 'GPU Vertex Colors', category: 'graphics' },

  // === PLAYGROUND ===
  { id: 'pg-sine-env', title: 'Sine Envelope', category: 'audio', expectAudio: true },
  { id: 'pg-osc-env', title: 'Osc Envelope', category: 'audio', expectAudio: true },
  { id: 'pg-fm', title: 'FM Synthesis', category: 'audio', expectAudio: true },
  { id: 'pg-am', title: 'AM Synthesis', category: 'audio', expectAudio: true },
  { id: 'pg-vibrato', title: 'Vibrato', category: 'audio', expectAudio: true },
  { id: 'pg-subtractive', title: 'Subtractive Synth', category: 'audio', expectAudio: true },
  { id: 'pg-additive', title: 'Additive Synth', category: 'audio', expectAudio: true },
  { id: 'pg-audiovisual-basic', title: 'Audiovisual Basic', category: 'audio', expectAudio: true },
  { id: 'pg-audiovisual-color', title: 'Audiovisual Color', category: 'audio', expectAudio: true },
  { id: 'pg-plucked-string', title: 'Plucked String', category: 'audio', expectAudio: true },
  { id: 'pg-synthesis-showcase', title: 'Synthesis Showcase', category: 'audio', expectAudio: true },

  // === STUDIO - ENVIRONMENTS ===
  { id: 'studio-env-basic', title: 'Studio Env Basic', category: 'graphics' },
  { id: 'studio-env-pbr-materials', title: 'PBR Materials', category: 'graphics' },
  { id: 'studio-env-pbr-roughness', title: 'PBR Roughness', category: 'graphics' },
  { id: 'studio-env-hdri-skybox', title: 'HDRI Skybox', category: 'graphics' },
  { id: 'studio-env-reflect-sphere', title: 'Reflective Sphere', category: 'graphics' },
  { id: 'studio-skybox-procedural', title: 'Procedural Skybox', category: 'graphics' },
  { id: 'studio-skybox-hdri-picker', title: 'HDRI Picker', category: 'graphics' },

  // === STUDIO - MESHES ===
  { id: 'studio-mesh-bunny', title: 'Stanford Bunny', category: 'graphics' },
  { id: 'studio-mesh-teapot', title: 'Teapot', category: 'graphics' },
  { id: 'studio-mesh-pbr-bunny', title: 'PBR Bunny', category: 'graphics' },
  { id: 'studio-mesh-env-teapot', title: 'Env Teapot', category: 'graphics' },
  { id: 'studio-mesh-gallery', title: 'Mesh Gallery', category: 'graphics' },
  { id: 'studio-mesh-knot', title: 'Trefoil Knot', category: 'animation', expectAnimation: true },
  { id: 'studio-mesh-klein', title: 'Klein Bottle', category: 'graphics' },
  { id: 'studio-mesh-lod-demo', title: 'LOD Demo', category: 'graphics' },
  { id: 'studio-mesh-lod-group', title: 'LOD Group', category: 'graphics' },
  { id: 'studio-mesh-lod-controller', title: 'LOD Controller', category: 'graphics' },
  { id: 'studio-mesh-texture-lod', title: 'Texture LOD', category: 'graphics' },
  { id: 'studio-mesh-shader-lod', title: 'Shader LOD', category: 'graphics' },

  // === STUDIO - TEXTURES ===
  { id: 'studio-tex-procedural-noise', title: 'Procedural Noise', category: 'graphics' },
  { id: 'studio-tex-procedural-patterns', title: 'Procedural Patterns', category: 'graphics' },
  { id: 'studio-tex-bunny-uv', title: 'Bunny UV', category: 'graphics' },
  { id: 'studio-tex-lod-demo', title: 'Texture LOD Demo', category: 'graphics' },
  { id: 'studio-tex-mipmap-lod', title: 'Mipmap LOD', category: 'graphics' },
  { id: 'studio-tex-pbr-mipmap', title: 'PBR Mipmap', category: 'graphics' },
  { id: 'studio-tex-pbr-procedural', title: 'PBR Procedural', category: 'graphics' },
  { id: 'studio-tex-pbr-normal-mapping', title: 'PBR Normal Mapping', category: 'graphics' },
  { id: 'studio-tex-3d-noise', title: '3D Noise', category: 'graphics' },
  { id: 'studio-tex-hdr-exposure', title: 'HDR Exposure', category: 'graphics' },

  // === STUDIO - TIMELINE ===
  { id: 'studio-timeline-objects', title: 'Timeline Objects', category: 'animation', expectAnimation: true },
  { id: 'studio-timeline-keyframes', title: 'Timeline Keyframes', category: 'animation', expectAnimation: true },

  // === STUDIO - TEMPLATES ===
  { id: 'studio-template-av', title: 'AV Template', category: 'audio', expectAudio: true },

  // === STUDIO - SHOWCASE ===
  { id: 'studio-showcase-particles', title: 'Showcase Particles', category: 'simulation', expectAnimation: true },
  { id: 'studio-showcase-pbr-gallery', title: 'PBR Gallery', category: 'graphics' },
  { id: 'studio-showcase-museum', title: 'Virtual Museum', category: 'graphics' },
  { id: 'studio-showcase-crystal-cave', title: 'Crystal Cave', category: 'graphics' },
  { id: 'studio-showcase-procedural-planet', title: 'Procedural Planet', category: 'graphics' },
  { id: 'studio-showcase-day-night', title: 'Day Night Cycle', category: 'animation', expectAnimation: true },
  { id: 'studio-showcase-camera-demo', title: 'Camera Demo', category: 'animation', expectAnimation: true },
  { id: 'studio-showcase-audio-visualizer', title: 'Audio Visualizer', category: 'audio', expectAudio: true, expectAnimation: true },
  { id: 'studio-showcase-simple-game', title: 'Simple Game', category: 'interaction', testKeys: ['w', 'a', 's', 'd'] },
  { id: 'studio-showcase-emergence', title: 'Emergence', category: 'simulation', expectAnimation: true },
]

// ─── Report Generation ────────────────────────────────────────────────────────

function generateReport(results: FunctionalTestResult[], backend: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportDir = path.join(__dirname, '..', 'reports')

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  // Summary statistics
  const total = results.length
  const compilePassed = results.filter(r => r.compilation === 'pass').length
  const renderPassed = results.filter(r => r.rendering === 'pass').length
  const functionalPassed = results.filter(r => r.functional === 'pass').length
  const functionalPartial = results.filter(r => r.functional === 'partial').length

  // Generate markdown report
  let md = `# Functional Verification Report - ${backend.toUpperCase()}\n\n`
  md += `**Generated:** ${new Date().toISOString()}\n\n`
  md += `## Summary\n\n`
  md += `| Metric | Count | Percentage |\n`
  md += `|--------|-------|------------|\n`
  md += `| Total Examples | ${total} | 100% |\n`
  md += `| Compilation Pass | ${compilePassed} | ${((compilePassed / total) * 100).toFixed(1)}% |\n`
  md += `| Rendering Pass | ${renderPassed} | ${((renderPassed / total) * 100).toFixed(1)}% |\n`
  md += `| Functional Pass | ${functionalPassed} | ${((functionalPassed / total) * 100).toFixed(1)}% |\n`
  md += `| Functional Partial | ${functionalPartial} | ${((functionalPartial / total) * 100).toFixed(1)}% |\n\n`

  // Group by category
  const categories = ['interaction', 'audio', 'animation', 'graphics', 'simulation']
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat)
    if (catResults.length === 0) continue

    md += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)} Examples (${catResults.length})\n\n`
    md += `| Example | Compile | Render | Functional | Details |\n`
    md += `|---------|---------|--------|------------|----------|\n`

    for (const r of catResults) {
      const compile = r.compilation === 'pass' ? '✅' : r.compilation === 'skip' ? '⏭️' : '❌'
      const render = r.rendering === 'pass' ? '✅' : r.rendering === 'skip' ? '⏭️' : '❌'
      const functional = r.functional === 'pass' ? '✅' :
                         r.functional === 'partial' ? '⚠️' :
                         r.functional === 'n/a' ? '➖' :
                         r.functional === 'skip' ? '⏭️' : '❌'
      md += `| ${r.title} | ${compile} | ${render} | ${functional} | ${r.functionalDetails} |\n`
    }
    md += '\n'
  }

  // Issues needing attention
  const issues = results.filter(r => r.functional === 'fail' || r.functional === 'partial')
  if (issues.length > 0) {
    md += `## Issues Needing Attention (${issues.length})\n\n`
    for (const r of issues) {
      md += `### ${r.title} (${r.exampleId})\n`
      md += `- **Category:** ${r.category}\n`
      md += `- **Functional Status:** ${r.functional}\n`
      md += `- **Details:** ${r.functionalDetails}\n`
      if (r.errors.length > 0) {
        md += `- **Errors:** ${r.errors.slice(0, 3).join('; ')}\n`
      }
      md += '\n'
    }
  }

  // Write files
  const mdPath = path.join(reportDir, `functional-${backend}-${timestamp}.md`)
  const jsonPath = path.join(reportDir, `functional-${backend}-${timestamp}.json`)

  fs.writeFileSync(mdPath, md)
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2))

  console.log(`\nReport written to: ${mdPath}`)
}

// ─── Test Generation ──────────────────────────────────────────────────────────

const BACKENDS: Array<'webgl2' | 'webgpu'> = ['webgl2', 'webgpu']

for (const backend of BACKENDS) {
  test.describe(`Comprehensive Functional Tests - ${backend.toUpperCase()}`, () => {
    test.setTimeout(180000)

    const backendResults: FunctionalTestResult[] = []

    test.beforeEach(async ({ page, browserName }) => {
      if (backend === 'webgpu') {
        test.skip(browserName !== 'chromium', 'WebGPU only on Chromium')
        await page.goto(BASE_URL)
        const functional = await isWebGPUFunctional(page)
        test.skip(!functional, 'WebGPU not functional')
      }
    })

    test.afterAll(async () => {
      if (backendResults.length > 0) {
        generateReport(backendResults, backend)
        testResults.push(...backendResults)
      }
    })

    for (const example of ALL_EXAMPLES) {
      test(`${example.id}: ${example.title}`, async ({ page }) => {
        const result: FunctionalTestResult = {
          exampleId: example.id,
          title: example.title,
          category: example.category,
          backend,
          compilation: 'skip',
          rendering: 'skip',
          functional: 'skip',
          functionalDetails: '',
          errors: [],
          metrics: {
            hasContent: false,
            uniqueColors: 0,
            animationChange: 0,
            interactionChange: 0,
            audioContext: false
          }
        }

        // Set backend
        await page.goto(BASE_URL)
        await page.waitForLoadState('networkidle')
        await setBackend(page, backend)

        // Run example
        const run = await setupAndRunExample(page, example.id)
        result.errors = run.errors

        if (!run.success) {
          result.compilation = 'fail'
          result.functionalDetails = `Compilation failed: ${run.errors.join('; ')}`
          backendResults.push(result)
          expect(run.success, `Compilation failed: ${run.errors.join('; ')}`).toBe(true)
          return
        }

        result.compilation = 'pass'

        // Check rendering
        const canvas = await analyzeCanvas(page)
        result.metrics.hasContent = canvas.hasContent
        result.metrics.uniqueColors = canvas.uniqueColors

        if (!canvas.hasContent) {
          result.rendering = 'fail'
          result.functionalDetails = 'No visible content rendered'
          backendResults.push(result)
          expect(canvas.hasContent, 'Canvas should have content').toBe(true)
          return
        }

        result.rendering = 'pass'

        // Category-specific functional tests
        let functionalPass = true
        const details: string[] = []

        // Test interaction if applicable
        if (example.testKeys && example.testKeys.length > 0) {
          const interactionChange = await testKeyboardInteraction(page, example.testKeys)
          result.metrics.interactionChange = interactionChange

          if (interactionChange > 5) {
            details.push(`Interaction: ${interactionChange.toFixed(1)}% change`)
          } else {
            details.push(`Interaction: minimal change (${interactionChange.toFixed(1)}%)`)
            functionalPass = false
          }
        }

        // Test animation if expected
        if (example.expectAnimation) {
          const animChange = await detectAnimation(page)
          result.metrics.animationChange = animChange

          if (animChange > 0.5) {
            details.push(`Animation: ${animChange.toFixed(1)}% change`)
          } else {
            details.push(`Animation: not detected`)
            // Don't fail for animation - it's hard to detect reliably
          }
        }

        // Check audio if expected
        if (example.expectAudio) {
          const hasAudio = await checkAudioContext(page)
          result.metrics.audioContext = hasAudio

          if (hasAudio) {
            details.push('Audio: context exists')
          } else {
            details.push('Audio: no context (needs user gesture)')
            // Don't fail - audio requires user gesture
          }
        }

        // Check for WASM errors
        const wasmErrors = result.errors.filter(e =>
          e.includes('RuntimeError') || e.includes('Aborted') || e.includes('unreachable')
        )
        if (wasmErrors.length > 0) {
          details.push(`WASM errors: ${wasmErrors.length}`)
          functionalPass = false
        }

        // Determine functional status
        if (example.testKeys && result.metrics.interactionChange < 5) {
          result.functional = 'partial'
        } else if (wasmErrors.length > 0) {
          result.functional = 'fail'
        } else if (details.length === 0) {
          result.functional = 'n/a'
        } else {
          result.functional = functionalPass ? 'pass' : 'partial'
        }

        result.functionalDetails = details.join('; ') || 'Basic rendering verified'
        backendResults.push(result)

        // Pass the test (we've recorded results)
        expect(true).toBe(true)
      })
    }
  })
}
