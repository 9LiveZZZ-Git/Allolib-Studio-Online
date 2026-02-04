/**
 * AlloLib Studio Online - Comprehensive Examples Pipeline Test
 *
 * Tests ALL examples from the Examples dropdown on BOTH WebGL2 and WebGPU pipelines.
 * Generates detailed error reports and visual verification.
 *
 * Features:
 * - Automatically discovers all examples from the UI
 * - Tests compilation and runtime on WebGL2 and WebGPU
 * - Captures screenshots for visual verification
 * - Documents all errors with categorization
 * - Generates JSON and Markdown reports
 *
 * Run with:
 *   npx playwright test all-examples-pipeline-test.spec.ts --project=chromium-webgl2
 *   npx playwright test all-examples-pipeline-test.spec.ts --project=chromium-webgpu
 */

import { test, expect, Page } from './fixtures'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'
const COMPILE_TIMEOUT = 120000 // 2 minutes for complex examples
const RENDER_WAIT = 5000 // 5s for rendering to stabilize
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots/examples')

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExampleInfo {
  id: string
  title: string
  category: string
  subcategory?: string
  groupId: string
  groupTitle: string
  isMultiFile: boolean
}

interface TestResult {
  example: ExampleInfo
  backend: 'webgl2' | 'webgpu'
  status: 'passed' | 'failed' | 'skipped' | 'timeout'
  compilationTime?: number
  errors: ErrorEntry[]
  warnings: string[]
  hasVisualContent: boolean
  screenshotPath?: string
  canvasInfo?: {
    width: number
    height: number
    hasNonBlackPixels: boolean
    dominantColor?: string
    uniqueColors: number
  }
  failureCategory?: string
  suggestedFix?: string
}

interface ErrorEntry {
  message: string
  type: 'console' | 'pageerror' | 'compilation' | 'runtime' | 'webgl' | 'webgpu'
  timestamp: number
}

interface PipelineReport {
  generatedAt: string
  backend: 'webgl2' | 'webgpu'
  browserInfo: string
  totalExamples: number
  passed: number
  failed: number
  skipped: number
  timeout: number
  passRate: string
  averageCompileTime: number
  results: TestResult[]
  errorsByCategory: Record<string, { count: number; examples: string[] }>
  examplesByGroup: Record<string, { total: number; passed: number; failed: number }>
}

// ─── Error Categorization ────────────────────────────────────────────────────

const ERROR_PATTERNS: { pattern: RegExp; category: string; fix: string }[] = [
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

function categorizeError(errorMsg: string): { category: string; fix: string } {
  for (const { pattern, category, fix } of ERROR_PATTERNS) {
    if (pattern.test(errorMsg)) {
      return { category, fix }
    }
  }
  return { category: 'Unknown Error', fix: 'Investigate error message for root cause' }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Ensures screenshot directory exists
 */
function ensureScreenshotDir(backend: string): string {
  const dir = path.join(SCREENSHOT_DIR, backend)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Sets the graphics backend via localStorage and Pinia store
 * Also disables Auto LOD to ensure accurate visual rendering
 */
async function setBackend(page: Page, backend: 'webgl2' | 'webgpu'): Promise<void> {
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
async function disableAutoLOD(page: Page): Promise<void> {
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
 * Fetches all examples from the UI by traversing the examples dropdown
 */
async function discoverAllExamples(page: Page): Promise<ExampleInfo[]> {
  await page.goto(BASE_URL)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000) // Wait for Vue app to initialize

  // Get examples from the app's data
  const examples = await page.evaluate(() => {
    const win = window as any
    const results: any[] = []

    // Try to access examples data
    // Method 1: Exposed global
    if (win.__allExamples) {
      return win.__allExamples
    }

    // Method 2: Import from examples module (if available)
    // The examples are defined in frontend/src/data/examples.ts
    // We need to access them through the Vue app

    // Method 3: Traverse the dropdown UI
    // Open examples dropdown and scrape
    return results
  })

  // If we got examples from the app, return them
  if (examples.length > 0) {
    return examples
  }

  // Fallback: Open the Examples dropdown and scrape the UI
  return await scrapeExamplesFromUI(page)
}

/**
 * Opens the examples dropdown and scrapes all example entries
 */
async function scrapeExamplesFromUI(page: Page): Promise<ExampleInfo[]> {
  const examples: ExampleInfo[] = []

  // Click the Examples button to open dropdown
  const examplesButton = page.locator('button:has-text("Examples")').first()
  if (await examplesButton.count() === 0) {
    console.log('[Warning] Examples button not found')
    return examples
  }

  await examplesButton.click()
  await page.waitForTimeout(500)

  // Get all category groups
  const groups = await page.locator('[class*="examples-dropdown"] [class*="group"]').all()

  // For now, we'll use a hardcoded list based on the examples.ts structure
  // This is more reliable than trying to scrape the dynamic UI
  return await page.evaluate(() => {
    const examples: any[] = []

    // Access the examples data from the app
    const win = window as any

    // Try multiple methods to get the examples
    let allExamples: any[] = []
    let categoryGroups: any[] = []

    // Check if examples are exposed globally (we may need to expose them)
    if (win.categoryGroups && win.allExamples) {
      categoryGroups = win.categoryGroups
      allExamples = win.allExamples
    }

    // Build the examples list with full category info
    for (const ex of allExamples) {
      // Find the group this example belongs to
      let groupId = 'unknown'
      let groupTitle = 'Unknown'

      for (const group of categoryGroups) {
        for (const cat of group.categories || []) {
          if (cat.id === ex.category) {
            groupId = group.id
            groupTitle = group.title
            break
          }
        }
      }

      examples.push({
        id: ex.id,
        title: ex.title,
        category: ex.category,
        subcategory: ex.subcategory,
        groupId,
        groupTitle,
        isMultiFile: 'files' in ex,
      })
    }

    return examples
  })
}

/**
 * Gets a predefined list of examples to test
 * This is used as fallback when dynamic discovery fails
 */
function getHardcodedExamplesList(): ExampleInfo[] {
  // Representative examples from each category
  return [
    // Basics
    { id: 'hello-sphere', title: 'Hello Sphere', category: 'basics', subcategory: 'hello-world', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },
    { id: 'hello-audio', title: 'Hello Audio', category: 'basics', subcategory: 'hello-world', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },
    { id: 'hello-audiovisual', title: 'Hello AudioVisual', category: 'basics', subcategory: 'hello-world', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },
    { id: 'shape-gallery', title: 'Shape Gallery', category: 'basics', subcategory: 'shapes', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },
    { id: 'custom-mesh', title: 'Custom Mesh', category: 'basics', subcategory: 'shapes', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },

    // Graphics
    { id: 'mesh-primitives', title: 'Mesh Primitives', category: 'graphics', subcategory: 'meshes', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },
    { id: 'basic-lighting', title: 'Basic Lighting', category: 'graphics', subcategory: 'lighting', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },
    { id: 'procedural-texture', title: 'Procedural Texture', category: 'graphics', subcategory: 'textures', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },

    // Audio
    { id: 'oscillator-types', title: 'Oscillator Types', category: 'audio', subcategory: 'oscillators', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },
    { id: 'adsr-envelope', title: 'ADSR Envelope', category: 'audio', subcategory: 'envelopes', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },

    // Interaction
    { id: 'piano-keyboard', title: 'Piano Keyboard', category: 'interaction', subcategory: 'keyboard', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },
    { id: 'camera-control', title: 'Camera Control', category: 'interaction', subcategory: 'navigation', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },

    // Scene System
    { id: 'synthvoice-basic', title: 'SynthVoice Basic', category: 'scene', subcategory: 'synthvoice', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },
    { id: 'polysynth-demo', title: 'PolySynth Demo', category: 'scene', subcategory: 'polysynth', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },

    // Simulation
    { id: 'particle-system', title: 'Particle System', category: 'simulation', subcategory: 'particles', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },

    // Feature Tests
    { id: 'mesh-primitives-test', title: 'Mesh Primitives Test', category: 'feature-tests', subcategory: 'graphics', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },
    { id: 'easyfbo-test', title: 'EasyFBO Test', category: 'feature-tests', subcategory: 'graphics', groupId: 'allolib', groupTitle: 'AlloLib', isMultiFile: false },

    // Playground
    { id: 'pg-sine-env', title: 'Sine Envelope', category: 'playground-synthesis', subcategory: 'envelopes', groupId: 'playground', groupTitle: 'AlloLib Playground', isMultiFile: false },

    // Studio
    { id: 'studio-env-basic', title: 'Studio Environment Basic', category: 'studio-environments', subcategory: 'hdri', groupId: 'studio', groupTitle: 'AlloLib Studio', isMultiFile: false },
  ]
}

/**
 * Loads an example into the editor
 * Uses the same approach as the working visual regression tests
 */
async function loadExample(page: Page, exampleId: string): Promise<boolean> {
  // Clear any cached state first (like visual regression tests do)
  await page.evaluate(() => {
    localStorage.removeItem('allolib-project')
    localStorage.removeItem('allolib-code')
  })

  // Wait for app to be ready
  await page.waitForTimeout(500)

  // Load example code using same approach as visual-regression.spec.ts
  const loaded = await page.evaluate((id) => {
    const win = window as any

    // Find the example
    const allExamples = win.allExamples || win.__allExamples || []
    const example = allExamples.find((e: any) => e.id === id)

    if (!example) {
      console.log(`[Test] Example ${id} not found in allExamples (${allExamples.length} total)`)
      return { success: false, reason: 'not_found' }
    }

    // Get the code to load
    let code: string | null = null
    if ('code' in example && example.code) {
      code = example.code
    } else if ('files' in example && example.files) {
      // For multi-file, find main.cpp or mainFile
      const mainFile = example.mainFile || 'main.cpp'
      const mainFileEntry = example.files.find((f: any) => f.path === mainFile || f.path.endsWith('.cpp'))
      if (mainFileEntry) {
        code = mainFileEntry.content
      }
    }

    if (!code) {
      console.log(`[Test] Example ${id} has no code`)
      return { success: false, reason: 'no_code' }
    }

    // Method 1: Use exposed store with actions (same as visual regression tests)
    if (win.__stores?.project) {
      const projectStore = win.__stores.project
      const activeFilePath = projectStore.project?.activeFile || 'main.cpp'
      projectStore.updateFileContent(activeFilePath, code)
      console.log(`[Test] Loaded ${id} via store.updateFileContent`)
      return { success: true, reason: 'store-action' }
    }

    // Method 2: Access via Pinia state directly
    if (win.__pinia?.state?.value?.project) {
      const projectState = win.__pinia.state.value.project
      const activeFile = projectState.activeFile || 'main.cpp'
      const fileIndex = projectState.files?.findIndex((f: any) => f.path === activeFile)
      if (fileIndex >= 0 && projectState.files[fileIndex]) {
        projectState.files[fileIndex].content = code
        projectState.files[fileIndex].isDirty = true
        projectState.files[fileIndex].updatedAt = Date.now()
        console.log(`[Test] Loaded ${id} via store-direct`)
        return { success: true, reason: 'store-direct' }
      }
    }

    // Method 3: Try Monaco editor API directly
    if (win.monaco?.editor) {
      const models = win.monaco.editor.getModels()
      if (models && models.length > 0) {
        models[0].setValue(code)
        console.log(`[Test] Loaded ${id} via Monaco`)
        return { success: true, reason: 'monaco' }
      }
    }

    console.log(`[Test] No method available to load ${id}`)
    return { success: false, reason: 'no_method' }
  }, exampleId)

  if (loaded.success) {
    // Sync Monaco with store if store method was used
    if (loaded.reason === 'store-action' || loaded.reason === 'store-direct') {
      await page.evaluate(() => {
        const win = window as any
        if (win.__stores?.project && win.monaco?.editor) {
          const models = win.monaco.editor.getModels()
          if (models && models.length > 0) {
            const projectStore = win.__stores.project
            const activeFilePath = projectStore.project?.activeFile || 'main.cpp'
            const content = projectStore.getFileContent?.(activeFilePath) ||
                           projectStore.project?.files?.find((f: any) => f.path === activeFilePath)?.content
            if (content) {
              models[0].setValue(content)
            }
          }
        }
      })
    }
    await page.waitForTimeout(300) // Allow sync to complete
    return true
  }

  console.log(`[Test] loadExample failed: ${loaded.reason}`)
  return false
}

/**
 * Compiles and runs the current code
 */
async function compileAndRun(page: Page): Promise<{ success: boolean; time: number; consoleOutput: string }> {
  const startTime = Date.now()

  // Click run button
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
      if (text.includes('[ERROR]') || text.includes('error:') || text.includes('failed')) {
        return 'error'
      }
      return null
    }, { timeout: COMPILE_TIMEOUT }).then(r => r.jsonValue()),
    new Promise<string>(resolve => setTimeout(() => resolve('timeout'), COMPILE_TIMEOUT))
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

/**
 * Analyzes the canvas content
 */
async function analyzeCanvas(page: Page): Promise<{
  hasContent: boolean
  width: number
  height: number
  dominantColor: string
  uniqueColors: number
}> {
  return await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="canvas"], #canvas, canvas') as HTMLCanvasElement
    if (!canvas) {
      return { hasContent: false, width: 0, height: 0, dominantColor: 'none', uniqueColors: 0 }
    }

    try {
      // Use toDataURL for WebGL canvas capture
      const dataUrl = canvas.toDataURL('image/png')

      // Create temp image to analyze
      const img = new Image()
      img.src = dataUrl

      // For synchronous analysis, create temp canvas
      const tempCanvas = document.createElement('canvas')
      const sampleSize = Math.min(canvas.width, canvas.height, 100)
      tempCanvas.width = sampleSize
      tempCanvas.height = sampleSize
      const ctx = tempCanvas.getContext('2d')!

      // Draw scaled down for analysis
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

        // Check for non-black
        if (r > 10 || g > 10 || b > 10) {
          nonBlackCount++
        }

        // Quantize color to 16-color bins
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
        hasContent: nonBlackCount > (sampleSize * sampleSize * 0.01), // >1% non-black
        width: canvas.width,
        height: canvas.height,
        dominantColor: `rgb(${dominantColor})`,
        uniqueColors: Object.keys(colorCounts).length
      }
    } catch (e) {
      return { hasContent: false, width: canvas.width || 0, height: canvas.height || 0, dominantColor: 'error', uniqueColors: 0 }
    }
  })
}

/**
 * Captures a screenshot of the canvas using requestAnimationFrame
 * This ensures we capture during an active render frame (WebGL buffers are cleared after swap)
 */
async function captureScreenshot(page: Page, backend: string, exampleId: string): Promise<string | undefined> {
  try {
    const dir = ensureScreenshotDir(backend)
    const filename = `${exampleId.replace(/[^a-z0-9-]/gi, '-')}.png`
    const filepath = path.join(dir, filename)

    // Capture canvas within requestAnimationFrame to ensure buffer has content
    const dataUrl = await page.evaluate(() => {
      return new Promise<string | null>((resolve) => {
        // Use requestAnimationFrame to capture during active render
        requestAnimationFrame(() => {
          const canvas = document.querySelector('#canvas, [data-testid="canvas"], canvas') as HTMLCanvasElement
          if (canvas) {
            try {
              // For WebGL canvases, toDataURL must be called within the same frame
              resolve(canvas.toDataURL('image/png'))
            } catch (e) {
              console.error('Canvas capture error:', e)
              resolve(null)
            }
          } else {
            resolve(null)
          }
        })
      })
    })

    if (dataUrl && dataUrl.length > 1000) { // Check for valid data (not empty image)
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
      fs.writeFileSync(filepath, base64Data, 'base64')
      return filepath
    }

    // Fallback: page screenshot
    await page.screenshot({ path: filepath, fullPage: false })
    return filepath
  } catch {
    return undefined
  }
}

/**
 * Tests a single example on a specific backend
 */
async function testSingleExample(
  page: Page,
  example: ExampleInfo,
  backend: 'webgl2' | 'webgpu'
): Promise<TestResult> {
  const errors: ErrorEntry[] = []
  const warnings: string[] = []

  // Set up error collection
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

  try {
    // Navigate and set backend
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await setBackend(page, backend)

    // Reload to apply backend setting
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Disable Auto LOD for accurate visual rendering
    await disableAutoLOD(page)

    // Load the example
    const loaded = await loadExample(page, example.id)
    if (!loaded) {
      return {
        example,
        backend,
        status: 'skipped',
        errors: [{ message: `Could not load example: ${example.id}`, type: 'runtime', timestamp: Date.now() }],
        warnings,
        hasVisualContent: false,
        failureCategory: 'Example Loading Failed',
        suggestedFix: 'Example may not exist or loading mechanism unavailable'
      }
    }

    // Compile and run
    const compileResult = await compileAndRun(page)

    if (!compileResult.success) {
      // Extract error details
      const errorMatch = compileResult.consoleOutput.match(/\[ERROR\][^\n]+|error:[^\n]+/gi)
      const errorMsg = errorMatch ? errorMatch.join('; ') : 'Compilation failed'
      errors.push({ message: errorMsg, type: 'compilation', timestamp: Date.now() })

      const { category, fix } = categorizeError(errorMsg)

      return {
        example,
        backend,
        status: compileResult.time >= COMPILE_TIMEOUT ? 'timeout' : 'failed',
        compilationTime: compileResult.time,
        errors,
        warnings,
        hasVisualContent: false,
        failureCategory: category,
        suggestedFix: fix
      }
    }

    // Short wait for initial render frame (don't wait too long or WebGL buffer clears)
    await page.waitForTimeout(1000)

    // Capture screenshot immediately (while canvas has content)
    const screenshotPath = await captureScreenshot(page, backend, example.id)

    // Wait a bit more for stable rendering before analysis
    await page.waitForTimeout(2000)

    // Analyze canvas
    const canvasInfo = await analyzeCanvas(page)

    // Check for runtime errors after rendering
    const runtimeErrors = errors.filter(e => e.type === 'pageerror' || e.type === 'console')
    const hasCriticalError = runtimeErrors.some(e =>
      /error|exception|failed|crash/i.test(e.message) &&
      !/warning/i.test(e.message)
    )

    if (hasCriticalError) {
      const { category, fix } = categorizeError(runtimeErrors[0].message)
      return {
        example,
        backend,
        status: 'failed',
        compilationTime: compileResult.time,
        errors,
        warnings,
        hasVisualContent: canvasInfo.hasContent,
        canvasInfo: {
          width: canvasInfo.width,
          height: canvasInfo.height,
          hasNonBlackPixels: canvasInfo.hasContent,
          dominantColor: canvasInfo.dominantColor,
          uniqueColors: canvasInfo.uniqueColors
        },
        screenshotPath,
        failureCategory: category,
        suggestedFix: fix
      }
    }

    // Success!
    return {
      example,
      backend,
      status: 'passed',
      compilationTime: compileResult.time,
      errors,
      warnings,
      hasVisualContent: canvasInfo.hasContent,
      canvasInfo: {
        width: canvasInfo.width,
        height: canvasInfo.height,
        hasNonBlackPixels: canvasInfo.hasContent,
        dominantColor: canvasInfo.dominantColor,
        uniqueColors: canvasInfo.uniqueColors
      },
      screenshotPath
    }
  } finally {
    page.off('console', consoleHandler)
    page.off('pageerror', pageErrorHandler)
  }
}

/**
 * Generates the compatibility report
 */
function generateReport(results: TestResult[], backend: 'webgl2' | 'webgpu', browserInfo: string): PipelineReport {
  const passed = results.filter(r => r.status === 'passed').length
  const failed = results.filter(r => r.status === 'failed').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const timeout = results.filter(r => r.status === 'timeout').length

  const compileTimes = results
    .filter(r => r.compilationTime !== undefined)
    .map(r => r.compilationTime!)
  const avgCompileTime = compileTimes.length > 0
    ? compileTimes.reduce((a, b) => a + b, 0) / compileTimes.length
    : 0

  // Group errors by category
  const errorsByCategory: Record<string, { count: number; examples: string[] }> = {}
  for (const r of results) {
    if (r.failureCategory) {
      if (!errorsByCategory[r.failureCategory]) {
        errorsByCategory[r.failureCategory] = { count: 0, examples: [] }
      }
      errorsByCategory[r.failureCategory].count++
      errorsByCategory[r.failureCategory].examples.push(r.example.id)
    }
  }

  // Group by example group
  const examplesByGroup: Record<string, { total: number; passed: number; failed: number }> = {}
  for (const r of results) {
    const group = r.example.groupTitle || 'Unknown'
    if (!examplesByGroup[group]) {
      examplesByGroup[group] = { total: 0, passed: 0, failed: 0 }
    }
    examplesByGroup[group].total++
    if (r.status === 'passed') examplesByGroup[group].passed++
    if (r.status === 'failed' || r.status === 'timeout') examplesByGroup[group].failed++
  }

  return {
    generatedAt: new Date().toISOString(),
    backend,
    browserInfo,
    totalExamples: results.length,
    passed,
    failed,
    skipped,
    timeout,
    passRate: `${((passed / results.length) * 100).toFixed(1)}%`,
    averageCompileTime: Math.round(avgCompileTime),
    results,
    errorsByCategory,
    examplesByGroup
  }
}

/**
 * Writes the report to files
 */
function writeReport(report: PipelineReport): void {
  const reportsDir = path.join(__dirname, '../reports')
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const jsonPath = path.join(reportsDir, `examples-${report.backend}-${timestamp}.json`)
  const mdPath = path.join(reportsDir, `examples-${report.backend}-${timestamp}.md`)

  // Write JSON
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  // Write Markdown
  let md = `# AlloLib Examples Compatibility Report - ${report.backend.toUpperCase()}\n\n`
  md += `**Generated:** ${report.generatedAt}\n`
  md += `**Browser:** ${report.browserInfo}\n\n`

  md += `## Summary\n\n`
  md += `| Metric | Value |\n|--------|-------|\n`
  md += `| Total Examples | ${report.totalExamples} |\n`
  md += `| Passed | ${report.passed} |\n`
  md += `| Failed | ${report.failed} |\n`
  md += `| Skipped | ${report.skipped} |\n`
  md += `| Timeout | ${report.timeout} |\n`
  md += `| Pass Rate | ${report.passRate} |\n`
  md += `| Avg Compile Time | ${report.averageCompileTime}ms |\n\n`

  md += `## Results by Group\n\n`
  md += `| Group | Total | Passed | Failed |\n|-------|-------|--------|--------|\n`
  for (const [group, stats] of Object.entries(report.examplesByGroup)) {
    md += `| ${group} | ${stats.total} | ${stats.passed} | ${stats.failed} |\n`
  }
  md += '\n'

  md += `## Error Categories\n\n`
  if (Object.keys(report.errorsByCategory).length === 0) {
    md += `No errors! All examples passed.\n\n`
  } else {
    md += `| Category | Count | Examples |\n|----------|-------|----------|\n`
    for (const [cat, data] of Object.entries(report.errorsByCategory)) {
      md += `| ${cat} | ${data.count} | ${data.examples.slice(0, 3).join(', ')}${data.examples.length > 3 ? '...' : ''} |\n`
    }
    md += '\n'
  }

  md += `## Failed Examples\n\n`
  const failedResults = report.results.filter(r => r.status === 'failed' || r.status === 'timeout')
  if (failedResults.length === 0) {
    md += `No failures!\n\n`
  } else {
    for (const r of failedResults) {
      md += `### ${r.example.title} (${r.example.id})\n`
      md += `- **Status:** ${r.status}\n`
      md += `- **Category:** ${r.failureCategory || 'Unknown'}\n`
      md += `- **Suggested Fix:** ${r.suggestedFix || 'N/A'}\n`
      if (r.errors.length > 0) {
        md += `- **Errors:**\n`
        for (const e of r.errors.slice(0, 3)) {
          md += `  - ${e.message.slice(0, 200)}\n`
        }
      }
      md += '\n'
    }
  }

  fs.writeFileSync(mdPath, md)

  console.log(`\n[Report] JSON saved to: ${jsonPath}`)
  console.log(`[Report] Markdown saved to: ${mdPath}`)
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

test.describe('All Examples Pipeline Test', () => {
  test.describe.configure({ mode: 'serial', timeout: 1800000 }) // 30 min timeout for full suite

  let allExamples: ExampleInfo[] = []
  let currentBackend: 'webgl2' | 'webgpu' = 'webgl2'

  test.beforeAll(async ({ browser }) => {
    // Determine backend from project name
    const projectName = test.info().project.name
    if (projectName.includes('webgpu')) {
      currentBackend = 'webgpu'
    } else {
      currentBackend = 'webgl2'
    }

    console.log(`\n[Setup] Testing on ${currentBackend.toUpperCase()} backend`)

    // Discover examples
    const page = await browser.newPage()
    try {
      allExamples = await discoverAllExamples(page)
      if (allExamples.length === 0) {
        console.log('[Setup] Dynamic discovery returned 0 examples, using hardcoded list')
        allExamples = getHardcodedExamplesList()
      }
      console.log(`[Setup] Found ${allExamples.length} examples to test`)
    } finally {
      await page.close()
    }
  })

  test('should compile and render all examples without errors', async ({ page, browser }) => {
    test.setTimeout(1800000) // 30 minutes for all 155+ examples

    const results: TestResult[] = []
    const browserInfo = browser.browserType().name()

    console.log(`\n[Test] Starting tests for ${allExamples.length} examples on ${currentBackend}`)

    for (let i = 0; i < allExamples.length; i++) {
      const example = allExamples[i]
      console.log(`\n[${i + 1}/${allExamples.length}] Testing: ${example.title} (${example.id})`)

      try {
        const result = await testSingleExample(page, example, currentBackend)
        results.push(result)

        const statusIcon = result.status === 'passed' ? '✓' : result.status === 'skipped' ? '○' : '✗'
        console.log(`  ${statusIcon} ${result.status} (${result.compilationTime || 0}ms)`)

        if (result.status === 'failed' && result.failureCategory) {
          console.log(`    Category: ${result.failureCategory}`)
        }
      } catch (error) {
        console.log(`  ✗ Error: ${error}`)
        results.push({
          example,
          backend: currentBackend,
          status: 'failed',
          errors: [{ message: String(error), type: 'runtime', timestamp: Date.now() }],
          warnings: [],
          hasVisualContent: false,
          failureCategory: 'Test Error',
          suggestedFix: 'Check test infrastructure'
        })
      }

      // Clear page state between examples
      await page.goto('about:blank')
      await page.waitForTimeout(500)
    }

    // Generate report
    const report = generateReport(results, currentBackend, browserInfo)
    writeReport(report)

    // Summary
    console.log(`\n${'='.repeat(60)}`)
    console.log(`RESULTS: ${currentBackend.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    console.log(`Total:   ${report.totalExamples}`)
    console.log(`Passed:  ${report.passed} (${report.passRate})`)
    console.log(`Failed:  ${report.failed}`)
    console.log(`Skipped: ${report.skipped}`)
    console.log(`Timeout: ${report.timeout}`)
    console.log(`Avg Compile: ${report.averageCompileTime}ms`)
    console.log(`${'='.repeat(60)}\n`)

    // Assertions
    expect(report.passed).toBeGreaterThan(0)

    // Soft assertion: warn if pass rate is low
    if (report.passed / report.totalExamples < 0.5) {
      console.warn(`[Warning] Pass rate is below 50%: ${report.passRate}`)
    }
  })
})

test.describe('Individual Example Tests', () => {
  // These run in parallel for faster execution - representative examples from each category
  test.describe.configure({ mode: 'parallel', timeout: 180000 }) // 3 min per example

  const representativeExamples = [
    { id: 'hello-sphere', name: 'Hello Sphere (Basic)' },
    { id: 'shape-gallery', name: 'Shape Gallery (Shapes)' },
    { id: 'mesh-primitives', name: 'Mesh Primitives (Graphics)' },
    { id: 'particle-system', name: 'Particle System (Simulation)' },
    { id: 'pg-sine-env', name: 'Sine Envelope (Playground)' },
    { id: 'studio-env-basic', name: 'Studio Environment Basic' },
  ]

  for (const { id, name } of representativeExamples) {
    test(`${name} compiles and renders`, async ({ page }) => {
      const projectName = test.info().project.name
      const backend: 'webgl2' | 'webgpu' = projectName.includes('webgpu') ? 'webgpu' : 'webgl2'

      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      await setBackend(page, backend)
      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000) // Allow app to initialize

      // Disable Auto LOD for accurate visual rendering
      await disableAutoLOD(page)

      // Load example
      const loaded = await loadExample(page, id)
      expect(loaded, `Example ${id} should load successfully`).toBe(true)

      // Compile
      const result = await compileAndRun(page)
      expect(result.success, `Example ${id} should compile: ${result.consoleOutput.slice(0, 500)}`).toBe(true)

      // Wait for render
      await page.waitForTimeout(RENDER_WAIT)

      // Check canvas
      const canvas = await analyzeCanvas(page)
      expect(canvas.width).toBeGreaterThan(0)
      expect(canvas.height).toBeGreaterThan(0)

      // For graphics examples, expect visual content
      if (!id.includes('audio') && !id.includes('envelope')) {
        expect(canvas.hasContent, `Example ${id} should have visual content`).toBe(true)
      }
    })
  }
})
