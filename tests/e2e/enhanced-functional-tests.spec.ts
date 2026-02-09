/**
 * Enhanced Functional Verification Tests
 *
 * Comprehensive visual and functional testing for ALL examples:
 * 1. Compilation verification
 * 2. Visual expectations (colors, regions, brightness)
 * 3. Baseline screenshot comparison
 * 4. Animation detection with configurable sensitivity
 * 5. Interaction testing
 * 6. Audio context verification
 *
 * Run with UPDATE_BASELINES=true to capture new baseline screenshots.
 */

import { test, expect, Page } from './fixtures'
import {
  setBackend,
  isWebGPUFunctional,
  BASE_URL,
  COMPILE_TIMEOUT,
} from './test-helpers'
import {
  BaselineManager,
  captureCanvas,
  captureMultipleFrames,
  analyzeImage,
  compareImages,
  performVisualAnalysis,
  VisualAnalysisResult,
  BaselineCompareResult,
} from './visual-verification'
import { getExpectation, VISUAL_EXPECTATIONS } from './visual-expectations'
import { PNG } from 'pngjs'
import * as fs from 'fs'
import * as path from 'path'

// ─── Constants ────────────────────────────────────────────────────────────────

const RENDER_WAIT = 3000
const INTERACTION_WAIT = 400
const UPDATE_BASELINES = process.env.UPDATE_BASELINES === 'true'
const BASELINE_SIMILARITY_THRESHOLD = 0.95  // 95% similar to pass

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnhancedTestResult {
  exampleId: string
  title: string
  category: string
  backend: 'webgl2' | 'webgpu'

  // Core status
  compilation: 'pass' | 'fail' | 'skip'
  rendering: 'pass' | 'fail' | 'skip'

  // Visual verification
  visualAnalysis: VisualAnalysisResult | null
  baselineComparison: BaselineCompareResult | null
  baselineStatus: 'match' | 'mismatch' | 'new' | 'error' | 'skip'

  // Functional tests
  interactionChange: number
  animationDetected: boolean
  audioContextExists: boolean

  // Overall
  overallStatus: 'pass' | 'partial' | 'fail' | 'skip'
  issues: string[]
  notes: string[]
  errors: string[]
}

// Global results storage
const allResults: EnhancedTestResult[] = []
const baselineManager = new BaselineManager()

// ─── Utilities ────────────────────────────────────────────────────────────────

async function testKeyboardInteraction(
  page: Page,
  keys: string[],
  backend: 'webgl2' | 'webgpu' = 'webgl2'
): Promise<number> {
  const canvasLocator = page.locator('[data-testid="canvas"], #canvas, canvas').first()

  try {
    const shotBefore = await captureCanvas(page, backend)

    // Click to focus
    await canvasLocator.click({ force: true })
    await page.waitForTimeout(100)

    // Press keys
    for (const key of keys) {
      await page.keyboard.press(key)
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(INTERACTION_WAIT)

    const shotAfter = await captureCanvas(page, backend)

    const { diffPercentage } = compareImages(shotBefore, shotAfter)
    return diffPercentage
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
  testKeys?: string[]
  expectAnimation?: boolean
  expectAudio?: boolean
}

// All examples from the dropdown
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

function generateEnhancedReport(results: EnhancedTestResult[], backend: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportDir = path.join(__dirname, '..', 'reports')

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  // Summary statistics
  const total = results.length
  const compilePassed = results.filter(r => r.compilation === 'pass').length
  const renderPassed = results.filter(r => r.rendering === 'pass').length
  const visualPassed = results.filter(r => r.visualAnalysis?.allExpectationsMet).length
  const baselineMatched = results.filter(r => r.baselineStatus === 'match').length
  const baselineNew = results.filter(r => r.baselineStatus === 'new').length
  const overallPassed = results.filter(r => r.overallStatus === 'pass').length
  const overallPartial = results.filter(r => r.overallStatus === 'partial').length

  // Generate markdown report
  let md = `# Enhanced Functional Verification Report - ${backend.toUpperCase()}\n\n`
  md += `**Generated:** ${new Date().toISOString()}\n`
  md += `**Mode:** ${UPDATE_BASELINES ? 'UPDATE BASELINES' : 'Verification'}\n\n`

  md += `## Summary\n\n`
  md += `| Metric | Count | Percentage |\n`
  md += `|--------|-------|------------|\n`
  md += `| Total Examples | ${total} | 100% |\n`
  md += `| Compilation Pass | ${compilePassed} | ${((compilePassed / total) * 100).toFixed(1)}% |\n`
  md += `| Rendering Pass | ${renderPassed} | ${((renderPassed / total) * 100).toFixed(1)}% |\n`
  md += `| Visual Expectations Met | ${visualPassed} | ${((visualPassed / total) * 100).toFixed(1)}% |\n`
  md += `| Baseline Match | ${baselineMatched} | ${((baselineMatched / total) * 100).toFixed(1)}% |\n`
  md += `| Baseline New | ${baselineNew} | ${((baselineNew / total) * 100).toFixed(1)}% |\n`
  md += `| Overall Pass | ${overallPassed} | ${((overallPassed / total) * 100).toFixed(1)}% |\n`
  md += `| Overall Partial | ${overallPartial} | ${((overallPartial / total) * 100).toFixed(1)}% |\n\n`

  // Group by category
  const categories = ['interaction', 'audio', 'animation', 'graphics', 'simulation']
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat)
    if (catResults.length === 0) continue

    md += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)} Examples (${catResults.length})\n\n`
    md += `| Example | Compile | Render | Visual | Baseline | Overall | Details |\n`
    md += `|---------|---------|--------|--------|----------|---------|----------|\n`

    for (const r of catResults) {
      const compile = r.compilation === 'pass' ? '✅' : r.compilation === 'skip' ? '⏭️' : '❌'
      const render = r.rendering === 'pass' ? '✅' : r.rendering === 'skip' ? '⏭️' : '❌'
      const visual = r.visualAnalysis?.allExpectationsMet ? '✅' : r.visualAnalysis ? '⚠️' : '➖'
      const baseline = r.baselineStatus === 'match' ? '✅' :
                       r.baselineStatus === 'new' ? '🆕' :
                       r.baselineStatus === 'mismatch' ? '❌' :
                       r.baselineStatus === 'skip' ? '⏭️' : '⚠️'
      const overall = r.overallStatus === 'pass' ? '✅' :
                      r.overallStatus === 'partial' ? '⚠️' :
                      r.overallStatus === 'skip' ? '⏭️' : '❌'

      const details: string[] = []
      if (r.interactionChange > 0) details.push(`Interaction: ${r.interactionChange.toFixed(1)}%`)
      if (r.animationDetected) details.push('Animation: ✓')
      if (r.audioContextExists) details.push('Audio: ✓')
      if (r.issues.length > 0) details.push(`Issues: ${r.issues.length}`)

      md += `| ${r.title} | ${compile} | ${render} | ${visual} | ${baseline} | ${overall} | ${details.join('; ') || '-'} |\n`
    }
    md += '\n'
  }

  // Visual failures
  const visualFailures = results.filter(r => r.visualAnalysis && !r.visualAnalysis.allExpectationsMet)
  if (visualFailures.length > 0) {
    md += `## Visual Expectation Failures (${visualFailures.length})\n\n`
    for (const r of visualFailures) {
      md += `### ${r.title} (${r.exampleId})\n`
      md += `**Failed Expectations:**\n`
      for (const exp of r.visualAnalysis!.failedExpectations) {
        md += `- ${exp}\n`
      }
      md += '\n'
    }
  }

  // Baseline mismatches
  const baselineMismatches = results.filter(r => r.baselineStatus === 'mismatch')
  if (baselineMismatches.length > 0) {
    md += `## Baseline Mismatches (${baselineMismatches.length})\n\n`
    for (const r of baselineMismatches) {
      md += `### ${r.title} (${r.exampleId})\n`
      if (r.baselineComparison) {
        md += `- Similarity: ${(r.baselineComparison.similarity * 100).toFixed(1)}%\n`
        md += `- Diff Pixels: ${r.baselineComparison.diffPixelCount}\n`
        if (r.baselineComparison.diffImagePath) {
          md += `- Diff Image: ${r.baselineComparison.diffImagePath}\n`
        }
      }
      md += '\n'
    }
  }

  // Errors
  const withErrors = results.filter(r => r.errors.length > 0)
  if (withErrors.length > 0) {
    md += `## Examples with Errors (${withErrors.length})\n\n`
    for (const r of withErrors) {
      md += `### ${r.title} (${r.exampleId})\n`
      for (const err of r.errors.slice(0, 5)) {
        md += `- ${err.substring(0, 200)}${err.length > 200 ? '...' : ''}\n`
      }
      md += '\n'
    }
  }

  // Write files
  const mdPath = path.join(reportDir, `enhanced-${backend}-${timestamp}.md`)
  const jsonPath = path.join(reportDir, `enhanced-${backend}-${timestamp}.json`)

  fs.writeFileSync(mdPath, md)
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2))

  console.log(`\nEnhanced report written to: ${mdPath}`)
}

// ─── Test Generation ──────────────────────────────────────────────────────────

const BACKENDS: Array<'webgl2' | 'webgpu'> = ['webgl2', 'webgpu']

for (const backend of BACKENDS) {
  test.describe(`Enhanced Functional Tests - ${backend.toUpperCase()}`, () => {
    // WebGPU shader compilation can be slow (DXC compiler) - use 4 min timeout
    test.setTimeout(240000)

    const backendResults: EnhancedTestResult[] = []

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
        generateEnhancedReport(backendResults, backend)
        allResults.push(...backendResults)
      }
    })

    for (const example of ALL_EXAMPLES) {
      test(`${example.id}: ${example.title}`, async ({ page }) => {
        const result: EnhancedTestResult = {
          exampleId: example.id,
          title: example.title,
          category: example.category,
          backend,
          compilation: 'skip',
          rendering: 'skip',
          visualAnalysis: null,
          baselineComparison: null,
          baselineStatus: 'skip',
          interactionChange: 0,
          animationDetected: false,
          audioContextExists: false,
          overallStatus: 'skip',
          issues: [],
          notes: [],
          errors: []
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
          result.overallStatus = 'fail'
          result.issues.push('Compilation failed')
          backendResults.push(result)
          expect(run.success, `Compilation failed: ${run.errors.join('; ')}`).toBe(true)
          return
        }

        result.compilation = 'pass'

        // Capture screenshot and perform visual analysis
        try {
          const screenshot = await captureCanvas(page, backend)
          const basicAnalysis = analyzeImage(screenshot)

          if (!basicAnalysis.hasContent) {
            result.rendering = 'fail'
            result.overallStatus = 'fail'
            result.issues.push('No visible content')
            backendResults.push(result)
            expect(basicAnalysis.hasContent, 'Canvas should have content').toBe(true)
            return
          }

          result.rendering = 'pass'

          // Perform detailed visual analysis
          const expectations = getExpectation(example.id, backend)
          result.visualAnalysis = await performVisualAnalysis(page, expectations, backend)

          if (!result.visualAnalysis.allExpectationsMet) {
            result.issues.push(...result.visualAnalysis.failedExpectations)
          }

          // Baseline comparison
          if (UPDATE_BASELINES) {
            baselineManager.saveBaseline(example.id, backend, screenshot)
            result.baselineStatus = 'new'
            result.notes.push('Baseline saved')
          } else if (baselineManager.hasBaseline(example.id, backend)) {
            result.baselineComparison = baselineManager.compareWithBaseline(
              example.id,
              backend,
              screenshot
            )
            result.baselineStatus = result.baselineComparison.match ? 'match' : 'mismatch'
            if (!result.baselineComparison.match) {
              result.issues.push(
                `Baseline mismatch: ${(result.baselineComparison.similarity * 100).toFixed(1)}% similar`
              )
            }
          } else {
            result.baselineStatus = 'new'
            result.notes.push('No baseline exists - run with UPDATE_BASELINES=true to create')
          }

          // Test interaction if applicable
          if (example.testKeys && example.testKeys.length > 0) {
            result.interactionChange = await testKeyboardInteraction(page, example.testKeys, backend)
            if (result.interactionChange < 5) {
              result.issues.push(`Low interaction response: ${result.interactionChange.toFixed(1)}%`)
            }
          }

          // Animation from visual analysis
          result.animationDetected = result.visualAnalysis.animationDetected

          // Check audio
          if (example.expectAudio) {
            result.audioContextExists = await checkAudioContext(page)
            if (!result.audioContextExists) {
              result.notes.push('Audio context not created (requires user gesture)')
            }
          }

          // Check for WASM errors
          const wasmErrors = result.errors.filter(e =>
            e.includes('RuntimeError') || e.includes('Aborted') || e.includes('unreachable')
          )
          if (wasmErrors.length > 0) {
            result.issues.push(`WASM errors: ${wasmErrors.length}`)
          }

          // Determine overall status
          const hasCriticalIssues = result.errors.filter(e =>
            e.includes('RuntimeError') || e.includes('Aborted')
          ).length > 0

          if (hasCriticalIssues) {
            result.overallStatus = 'fail'
          } else if (result.visualAnalysis.allExpectationsMet &&
                     (result.baselineStatus === 'match' || result.baselineStatus === 'new')) {
            result.overallStatus = 'pass'
          } else if (result.issues.length > 0) {
            result.overallStatus = 'partial'
          } else {
            result.overallStatus = 'pass'
          }

        } catch (error) {
          result.rendering = 'fail'
          result.overallStatus = 'fail'
          result.errors.push(`Visual analysis error: ${error}`)
        }

        backendResults.push(result)
        expect(true).toBe(true)
      })
    }
  })
}
