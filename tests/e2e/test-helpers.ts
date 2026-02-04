/**
 * AlloLib Studio Online - Shared Test Helpers
 *
 * Common utilities for E2E tests across different test files.
 */

import { Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

export const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'
export const COMPILE_TIMEOUT = 120000 // 2 minutes
export const RENDER_WAIT = 5000 // 5 seconds

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExampleInfo {
  id: string
  title: string
  description?: string
  category: string
  subcategory?: string
  isMultiFile: boolean
  code?: string
  files?: { path: string; content: string }[]
  mainFile?: string
}

export interface CanvasAnalysis {
  hasContent: boolean
  width: number
  height: number
  dominantColor: string
  uniqueColors: number
}

export interface CompilationResult {
  success: boolean
  time: number
  consoleOutput: string
}

// ─── Backend Management ──────────────────────────────────────────────────────

/**
 * Sets the graphics backend (webgl2 or webgpu)
 * Also disables Auto LOD for accurate visual rendering in tests
 */
export async function setBackend(page: Page, backend: 'webgl2' | 'webgpu'): Promise<void> {
  await page.evaluate((b) => {
    // Set localStorage
    const settings = JSON.parse(localStorage.getItem('allolib-settings') || '{}')
    settings.graphics = settings.graphics || {}
    settings.graphics.backendType = b
    // Disable Auto LOD for accurate visual tests
    settings.graphics.autoLOD = false
    settings.graphics.lodEnabled = false
    localStorage.setItem('allolib-settings', JSON.stringify(settings))

    // Set Pinia store if available
    const win = window as any
    if (win.__pinia?.state?.value?.settings?.graphics) {
      win.__pinia.state.value.settings.graphics.backendType = b
      win.__pinia.state.value.settings.graphics.autoLOD = false
      win.__pinia.state.value.settings.graphics.lodEnabled = false
    }
    if (win.__stores?.settings?.graphics) {
      win.__stores.settings.graphics.backendType = b
      win.__stores.settings.graphics.autoLOD = false
      win.__stores.settings.graphics.lodEnabled = false
    }
  }, backend)
}

/**
 * Disables Auto LOD at runtime via WASM bridge
 */
export async function disableAutoLOD(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as any
    // Try to disable via WASM exported function
    if (typeof win.Module?._al_autolod_set_enabled === 'function') {
      win.Module._al_autolod_set_enabled(0)
      console.log('[Test] Disabled Auto LOD via WASM')
    }
    // Also try via settings store
    if (win.__stores?.settings) {
      win.__stores.settings.setAutoLOD?.(false)
    }
  })
}

/**
 * Gets the current backend from the project name
 */
export function getBackendFromProject(projectName: string): 'webgl2' | 'webgpu' {
  return projectName.includes('webgpu') ? 'webgpu' : 'webgl2'
}

/**
 * Checks if WebGPU is functional in the current browser
 */
export async function isWebGPUFunctional(page: Page): Promise<boolean> {
  return await page.evaluate(async () => {
    const nav = navigator as any
    if (!nav.gpu) return false
    try {
      const adapter = await nav.gpu.requestAdapter()
      return adapter !== null
    } catch {
      return false
    }
  })
}

// ─── Example Discovery & Loading ─────────────────────────────────────────────

/**
 * Gets all examples from the app's exposed data
 */
export async function getAllExamples(page: Page): Promise<ExampleInfo[]> {
  await page.goto(BASE_URL)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500) // Wait for Vue to initialize

  return await page.evaluate(() => {
    const win = window as any

    // Try different methods to get examples
    const allExamples = win.__allExamples || win.allExamples || []

    return allExamples.map((ex: any) => ({
      id: ex.id,
      title: ex.title,
      description: ex.description,
      category: ex.category,
      subcategory: ex.subcategory,
      isMultiFile: ex.isMultiFile || 'files' in ex,
      code: ex.code,
      files: ex.files,
      mainFile: ex.mainFile,
    }))
  })
}

/**
 * Loads an example into the editor
 */
export async function loadExample(page: Page, example: ExampleInfo): Promise<boolean> {
  // Method 1: Direct code injection via Pinia store
  const loaded = await page.evaluate((ex) => {
    const win = window as any
    // Access the actual store instance (not raw state)
    const projectStore = win.__stores?.project

    if (!projectStore) {
      console.log('[Test] Project store not available')
      return false
    }

    try {
      if (ex.isMultiFile && ex.files) {
        // Multi-file example - first create fresh project
        if (typeof projectStore.newProject === 'function') {
          projectStore.newProject()
        }
        // Then add all files
        if (typeof projectStore.addOrUpdateFile === 'function') {
          for (const file of ex.files) {
            projectStore.addOrUpdateFile(file.path, file.content)
          }
          // Set the main file as active
          if (ex.mainFile && typeof projectStore.setActiveFile === 'function') {
            projectStore.setActiveFile(ex.mainFile)
          }
          console.log(`[Test] Loaded multi-file example: ${ex.id}`)
          return true
        }
      } else if (ex.code) {
        // Single-file example - use loadFromCode
        if (typeof projectStore.loadFromCode === 'function') {
          projectStore.loadFromCode(ex.code, 'main.cpp')
          console.log(`[Test] Loaded single-file example: ${ex.id}`)
          return true
        }
        // Fallback: use addOrUpdateFile
        if (typeof projectStore.addOrUpdateFile === 'function') {
          projectStore.addOrUpdateFile('main.cpp', ex.code)
          console.log(`[Test] Loaded example via addOrUpdateFile: ${ex.id}`)
          return true
        }
      }
      console.log(`[Test] Example ${ex.id} has no code or files`)
      return false
    } catch (e) {
      console.error('[Test] Error loading example:', e)
      return false
    }
  }, example)

  if (loaded) {
    await page.waitForTimeout(500) // Allow store update to propagate to Monaco
    return true
  }

  // Method 2: Monaco editor injection
  const monacoLoaded = await page.evaluate((code) => {
    const win = window as any
    try {
      const editor = win.monaco?.editor
      if (editor) {
        const models = editor.getModels()
        if (models && models[0] && code) {
          models[0].setValue(code)
          console.log('[Test] Loaded via Monaco editor')
          return true
        }
      }
    } catch (e) {
      console.error('[Test] Monaco fallback failed:', e)
    }
    return false
  }, example.code || '')

  return monacoLoaded
}

/**
 * Loads an example by ID (fetches from exposed data)
 */
export async function loadExampleById(page: Page, exampleId: string): Promise<boolean> {
  const example = await page.evaluate((id) => {
    const win = window as any
    const allExamples = win.__allExamples || win.allExamples || []
    return allExamples.find((e: any) => e.id === id)
  }, exampleId)

  if (!example) {
    console.log(`[Test] Example ${exampleId} not found`)
    return false
  }

  return await loadExample(page, example)
}

// ─── Compilation & Running ───────────────────────────────────────────────────

/**
 * Clicks the run button and waits for compilation
 */
export async function compileAndRun(page: Page, timeout = COMPILE_TIMEOUT): Promise<CompilationResult> {
  const startTime = Date.now()

  // Find and click run button
  const runButton = page.locator('[data-testid="run-button"], button.bg-green-600, button:has-text("Run")').first()
  if (await runButton.count() === 0) {
    return { success: false, time: 0, consoleOutput: 'Run button not found' }
  }

  await runButton.click()

  // Wait for compilation result
  const result = await Promise.race([
    page.waitForFunction(() => {
      const text = document.body.innerText || ''
      if (text.includes('[SUCCESS]') || text.includes('Application started') || text.includes('Running')) {
        return 'success'
      }
      if (text.includes('[ERROR]') || text.includes('error:') || text.includes('compilation failed')) {
        return 'error'
      }
      return null
    }, { timeout }).then(r => r.jsonValue()),
    new Promise<string>(resolve => setTimeout(() => resolve('timeout'), timeout))
  ]).catch(() => 'timeout')

  const elapsed = Date.now() - startTime

  // Get console output
  const consoleOutput = await page.evaluate(() => {
    const panel = document.querySelector('.console-panel, [class*="console"]')
    return panel?.textContent || document.body.innerText.slice(0, 5000)
  })

  return {
    success: result === 'success',
    time: elapsed,
    consoleOutput
  }
}

// ─── Canvas Analysis ─────────────────────────────────────────────────────────

/**
 * Analyzes the WebGL/WebGPU canvas content
 */
export async function analyzeCanvas(page: Page): Promise<CanvasAnalysis> {
  return await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="canvas"], #canvas, canvas') as HTMLCanvasElement
    if (!canvas) {
      return { hasContent: false, width: 0, height: 0, dominantColor: 'none', uniqueColors: 0 }
    }

    try {
      // Use toDataURL for WebGL canvas capture (more reliable than drawImage)
      const dataUrl = canvas.toDataURL('image/png')

      // Create temp canvas for analysis
      const tempCanvas = document.createElement('canvas')
      const sampleSize = Math.min(canvas.width, canvas.height, 100)
      tempCanvas.width = sampleSize
      tempCanvas.height = sampleSize
      const ctx = tempCanvas.getContext('2d')!

      // Load the data URL into an image and draw to temp canvas
      const img = new Image()
      img.src = dataUrl

      // For synchronous analysis, draw the original canvas
      ctx.drawImage(canvas, 0, 0, sampleSize, sampleSize)
      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize)
      const data = imageData.data

      // Analyze pixels
      let nonBlackCount = 0
      const colorCounts: Record<string, number> = {}

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        if (r > 10 || g > 10 || b > 10) {
          nonBlackCount++
        }

        // Quantize to 16-color bins
        const qr = Math.floor(r / 64) * 64
        const qg = Math.floor(g / 64) * 64
        const qb = Math.floor(b / 64) * 64
        const key = `${qr},${qg},${qb}`
        colorCounts[key] = (colorCounts[key] || 0) + 1
      }

      // Find dominant color
      let dominantColor = '0,0,0'
      let maxCount = 0
      for (const [color, count] of Object.entries(colorCounts)) {
        if (count > maxCount) {
          maxCount = count
          dominantColor = color
        }
      }

      return {
        hasContent: nonBlackCount > (sampleSize * sampleSize * 0.01),
        width: canvas.width,
        height: canvas.height,
        dominantColor: `rgb(${dominantColor})`,
        uniqueColors: Object.keys(colorCounts).length
      }
    } catch (e) {
      return {
        hasContent: false,
        width: canvas.width || 0,
        height: canvas.height || 0,
        dominantColor: 'error',
        uniqueColors: 0
      }
    }
  })
}

/**
 * Captures a screenshot of the canvas
 */
export async function captureCanvasScreenshot(page: Page, outputPath: string): Promise<boolean> {
  try {
    // Ensure directory exists
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Get canvas data URL
    const dataUrl = await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="canvas"], #canvas, canvas') as HTMLCanvasElement
      if (canvas) {
        try {
          return canvas.toDataURL('image/png')
        } catch {
          return null
        }
      }
      return null
    })

    if (dataUrl) {
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
      fs.writeFileSync(outputPath, base64Data, 'base64')
      return true
    }

    // Fallback: page screenshot
    await page.screenshot({ path: outputPath, fullPage: false })
    return true
  } catch {
    return false
  }
}

// ─── Error Categorization ────────────────────────────────────────────────────

export const ERROR_PATTERNS: { pattern: RegExp; category: string; fix: string }[] = [
  // Compilation errors
  { pattern: /undefined symbol.*gam::/i, category: 'Missing Gamma Library', fix: 'Ensure Gamma headers are included and linked' },
  { pattern: /undefined symbol/i, category: 'Undefined Symbol', fix: 'Check for missing library dependencies or exports' },
  { pattern: /error:.*expected/i, category: 'Syntax Error', fix: 'Fix C++ syntax error in the code' },
  { pattern: /include.*not found/i, category: 'Missing Header', fix: 'Add the required header file to include path' },

  // Runtime errors
  { pattern: /function signature mismatch/i, category: 'WASM Type Mismatch', fix: 'Check function parameter types match WASM exports' },
  { pattern: /RuntimeError|Aborted/i, category: 'WASM Runtime Error', fix: 'Check for null pointers or invalid memory access' },
  { pattern: /out of memory|allocation.*failed/i, category: 'Memory Error', fix: 'Reduce resource usage (meshes, textures)' },

  // Graphics errors
  { pattern: /WebGL.*context.*lost/i, category: 'WebGL Context Lost', fix: 'Graphics context crashed - reduce GPU load' },
  { pattern: /shader.*compil.*error|glsl.*error/i, category: 'Shader Compilation Error', fix: 'Fix GLSL shader syntax for WebGL2' },
  { pattern: /texture.*not.*found|failed.*load.*texture/i, category: 'Missing Texture', fix: 'Texture assets not available in web build' },
  { pattern: /framebuffer.*incomplete/i, category: 'FBO Error', fix: 'Check framebuffer attachment configuration' },

  // WebGPU specific
  { pattern: /webgpu.*not.*available/i, category: 'WebGPU Unavailable', fix: 'WebGPU requires compatible browser/hardware' },
  { pattern: /wgsl.*error|pipeline.*creation.*failed/i, category: 'WGSL Shader Error', fix: 'Fix WGSL shader syntax for WebGPU' },
  { pattern: /textureSample.*uniform control flow/i, category: 'WGSL Uniform Flow', fix: 'Move textureSample outside conditional branches' },

  // Audio errors
  { pattern: /audio.*context.*not.*running/i, category: 'Audio Context', fix: 'Audio requires user interaction to start' },
  { pattern: /audio.*device.*error/i, category: 'Audio Device Error', fix: 'Check audio device availability' },

  // Asset errors
  { pattern: /mesh.*load.*fail|obj.*not.*found/i, category: 'Missing Mesh Asset', fix: 'OBJ files need web-compatible loading' },
  { pattern: /font.*not.*found/i, category: 'Missing Font', fix: 'Font file not bundled for web' },
]

export function categorizeError(errorMsg: string): { category: string; fix: string } {
  for (const { pattern, category, fix } of ERROR_PATTERNS) {
    if (pattern.test(errorMsg)) {
      return { category, fix }
    }
  }
  return { category: 'Unknown Error', fix: 'Investigate error message for root cause' }
}

// ─── Error Collection ────────────────────────────────────────────────────────

export interface CollectedError {
  message: string
  type: 'console' | 'pageerror' | 'compilation' | 'runtime'
  timestamp: number
}

/**
 * Sets up error collection handlers on a page
 */
export function setupErrorCollection(page: Page): {
  errors: CollectedError[]
  warnings: string[]
  cleanup: () => void
} {
  const errors: CollectedError[] = []
  const warnings: string[] = []

  const consoleHandler = (msg: any) => {
    const text = msg.text()
    const type = msg.type()
    if (type === 'error') {
      errors.push({ message: text, type: 'console', timestamp: Date.now() })
    } else if (type === 'warning') {
      warnings.push(text)
    }
  }
  page.on('console', consoleHandler)

  const pageErrorHandler = (error: Error) => {
    errors.push({ message: error.message, type: 'pageerror', timestamp: Date.now() })
  }
  page.on('pageerror', pageErrorHandler)

  return {
    errors,
    warnings,
    cleanup: () => {
      page.off('console', consoleHandler)
      page.off('pageerror', pageErrorHandler)
    }
  }
}
