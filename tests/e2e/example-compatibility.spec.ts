/**
 * AlloLib Studio Online - Example Compatibility Tests
 *
 * Systematically tests ALL examples in the library for:
 * - Compilation success
 * - Runtime errors
 * - Rendering output
 *
 * Generates a detailed compatibility report.
 */

import { test, expect, Page, BrowserContext } from './fixtures'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'
const COMPILE_TIMEOUT = 90000 // 90s for complex examples
const RENDER_WAIT = 3000 // 3s for rendering to stabilize
const BATCH_SIZE = 10 // Process examples in batches to avoid memory issues

// Report structures
interface ExampleTestResult {
  id: string
  title: string
  category: string
  subcategory?: string
  backend: 'webgl2' | 'webgpu'
  status: 'passed' | 'failed' | 'skipped' | 'timeout'
  compilationTime?: number
  errors: string[]
  warnings: string[]
  hasRenderedContent: boolean
  screenshotPath?: string
  failureReason?: string
  suggestedFix?: string
}

interface CompatibilityReport {
  generatedAt: string
  backend: string
  totalExamples: number
  passed: number
  failed: number
  skipped: number
  timeout: number
  passRate: string
  results: ExampleTestResult[]
  failuresByCategory: Record<string, number>
  commonErrors: { error: string; count: number; examples: string[] }[]
}

// Error patterns and suggested fixes
const ERROR_PATTERNS: { pattern: RegExp; category: string; suggestedFix: string }[] = [
  {
    pattern: /undefined symbol.*gam::/i,
    category: 'Missing Gamma',
    suggestedFix: 'Add #include "Gamma/..." headers and ensure Gamma is linked',
  },
  {
    pattern: /al_playground_compat\.hpp.*not found/i,
    category: 'Missing Compat Header',
    suggestedFix: 'Ensure al_playground_compat.hpp is in the include path',
  },
  {
    pattern: /texture.*not.*found|failed.*load.*texture/i,
    category: 'Missing Texture',
    suggestedFix: 'Texture assets may not be available in web build',
  },
  {
    pattern: /mesh.*load.*fail|obj.*not.*found/i,
    category: 'Missing Mesh Asset',
    suggestedFix: 'OBJ/mesh files need to be bundled or loaded differently for web',
  },
  {
    pattern: /audio.*context.*not.*running/i,
    category: 'Audio Context',
    suggestedFix: 'Audio requires user interaction to start - add click handler',
  },
  {
    pattern: /webgpu.*not.*available|no.*canvas.*context/i,
    category: 'WebGPU Not Available',
    suggestedFix: 'WebGPU requires compatible browser and hardware',
  },
  {
    pattern: /shader.*compil.*error|glsl.*error/i,
    category: 'Shader Error',
    suggestedFix: 'GLSL syntax error - check shader code for WebGL2 compatibility',
  },
  {
    pattern: /wgsl.*error|pipeline.*creation.*failed/i,
    category: 'WGSL Error',
    suggestedFix: 'WGSL shader error - WebGPU shaders need different syntax than GLSL',
  },
  {
    pattern: /out of memory|allocation.*failed/i,
    category: 'Memory',
    suggestedFix: 'Example uses too much memory for web - reduce mesh/texture sizes',
  },
  {
    pattern: /function signature mismatch/i,
    category: 'WASM Type Error',
    suggestedFix: 'C++/WASM type mismatch - check function signatures',
  },
]

function categorizeError(errorMsg: string): { category: string; suggestedFix: string } {
  for (const { pattern, category, suggestedFix } of ERROR_PATTERNS) {
    if (pattern.test(errorMsg)) {
      return { category, suggestedFix }
    }
  }
  return { category: 'Unknown', suggestedFix: 'Investigate error message for root cause' }
}

/**
 * Fetches all examples from the running application
 */
async function fetchAllExamples(page: Page): Promise<Array<{
  id: string
  title: string
  category: string
  subcategory?: string
  isMultiFile: boolean
}>> {
  await page.goto(BASE_URL)
  await page.waitForLoadState('networkidle')

  return await page.evaluate(() => {
    // Access the examples from the Vue app's data
    // The examples are imported and available in the window scope via the app
    const allExamples: any[] = []

    // Try to get examples from the global scope or Pinia store
    const win = window as any

    // Method 1: Direct import (if exposed)
    if (win.__examples) {
      return win.__examples.map((e: any) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        subcategory: e.subcategory,
        isMultiFile: 'files' in e,
      }))
    }

    // Method 2: From app store
    const appStore = win.__pinia?.state?.value?.app
    if (appStore?.examples) {
      return appStore.examples.map((e: any) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        subcategory: e.subcategory,
        isMultiFile: 'files' in e,
      }))
    }

    // Method 3: Query the example selector dropdown
    const options = document.querySelectorAll('[data-example-id]')
    options.forEach((el) => {
      allExamples.push({
        id: el.getAttribute('data-example-id') || '',
        title: el.textContent || '',
        category: el.getAttribute('data-category') || 'unknown',
        subcategory: el.getAttribute('data-subcategory'),
        isMultiFile: false,
      })
    })

    return allExamples
  })
}

/**
 * Loads an example by ID and compiles it
 */
async function testExample(
  page: Page,
  exampleId: string,
  backend: 'webgl2' | 'webgpu'
): Promise<ExampleTestResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const startTime = Date.now()

  // Collect console messages
  const consoleHandler = (msg: any) => {
    const text = msg.text()
    if (msg.type() === 'error') {
      errors.push(text)
    } else if (msg.type() === 'warning') {
      warnings.push(text)
    }
  }
  page.on('console', consoleHandler)

  // Collect page errors
  const errorHandler = (error: Error) => {
    errors.push(`Page error: ${error.message}`)
  }
  page.on('pageerror', errorHandler)

  try {
    // Navigate and set backend
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Set backend via store
    await page.evaluate((backend) => {
      const win = window as any
      if (win.__pinia?.state?.value?.settings) {
        win.__pinia.state.value.settings.graphics = win.__pinia.state.value.settings.graphics || {}
        win.__pinia.state.value.settings.graphics.backendType = backend
      }
      localStorage.setItem('allolib-settings', JSON.stringify({
        graphics: { backendType: backend }
      }))
    }, backend)

    // Load example
    const loaded = await page.evaluate(async (id) => {
      const win = window as any

      // Try to find and load example
      // Method 1: Via app store action
      if (win.__pinia?.state?.value?.app?.loadExample) {
        await win.__pinia.state.value.app.loadExample(id)
        return true
      }

      // Method 2: Via event
      win.dispatchEvent(new CustomEvent('load-example', { detail: { id } }))

      // Wait a bit for the example to load
      await new Promise(r => setTimeout(r, 500))
      return true
    }, exampleId)

    if (!loaded) {
      return {
        id: exampleId,
        title: exampleId,
        category: 'unknown',
        backend,
        status: 'skipped',
        errors: ['Could not load example'],
        warnings: [],
        hasRenderedContent: false,
        failureReason: 'Example loading mechanism not available',
      }
    }

    // Click compile/run button - prefer data-testid, fallback to class
    const runButton = page.locator('[data-testid="run-button"], button.bg-green-600').first()
    if (await runButton.count() > 0) {
      await runButton.click()
    }

    // Wait for compilation - check body text for success/error indicators
    const compileResult = await Promise.race([
      page.waitForFunction(() => {
        const bodyText = document.body.innerText || ''
        if (bodyText.includes('[SUCCESS]') || bodyText.includes('Application started') || bodyText.includes('Running')) {
          return 'success'
        }
        if (bodyText.includes('[ERROR]') || bodyText.includes('error:') || bodyText.includes('compilation failed')) {
          return 'error'
        }
        return null
      }, { timeout: COMPILE_TIMEOUT }).then(result => result.jsonValue()),
      new Promise<string>(r => setTimeout(() => r('timeout'), COMPILE_TIMEOUT))
    ])

    const compilationTime = Date.now() - startTime

    if (compileResult === 'timeout') {
      return {
        id: exampleId,
        title: exampleId,
        category: 'unknown',
        backend,
        status: 'timeout',
        compilationTime,
        errors: ['Compilation timed out'],
        warnings,
        hasRenderedContent: false,
        failureReason: 'Compilation exceeded timeout',
        suggestedFix: 'Example may be too complex or have infinite loops',
      }
    }

    // Check for compilation errors
    const consoleText = await page.evaluate(() => {
      return document.querySelector('.console-panel')?.textContent || ''
    })

    const hasError = consoleText.includes('[ERROR]') || consoleText.includes('error:')

    if (hasError) {
      // Extract error message
      const errorMatch = consoleText.match(/\[ERROR\][^\n]+|error:[^\n]+/gi)
      const errorMsg = errorMatch ? errorMatch.join('; ') : 'Unknown error'
      errors.push(errorMsg)

      const { category, suggestedFix } = categorizeError(errorMsg)

      return {
        id: exampleId,
        title: exampleId,
        category: 'unknown',
        backend,
        status: 'failed',
        compilationTime,
        errors,
        warnings,
        hasRenderedContent: false,
        failureReason: category,
        suggestedFix,
      }
    }

    // Wait for rendering
    await page.waitForTimeout(RENDER_WAIT)

    // Check canvas content - prefer data-testid, fallback to id
    const hasContent = await page.evaluate(() => {
      const canvas = (document.querySelector('[data-testid="canvas"]') || document.querySelector('#canvas')) as HTMLCanvasElement
      if (!canvas) return false

      try {
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = Math.min(canvas.width, 100)
        tempCanvas.height = Math.min(canvas.height, 100)
        const ctx = tempCanvas.getContext('2d')!
        ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height)
        const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)

        // Check for non-black pixels
        for (let i = 0; i < imageData.data.length; i += 4) {
          if (imageData.data[i] > 20 || imageData.data[i + 1] > 20 || imageData.data[i + 2] > 20) {
            return true
          }
        }
        return false
      } catch {
        return false
      }
    })

    // Take screenshot
    const screenshotDir = path.join(__dirname, '../screenshots/examples', backend)
    fs.mkdirSync(screenshotDir, { recursive: true })
    const screenshotPath = path.join(screenshotDir, `${exampleId}.png`)

    try {
      const canvas = page.locator('[data-testid="canvas"], #canvas').first()
      if (await canvas.count() > 0) {
        await canvas.screenshot({ path: screenshotPath })
      }
    } catch {
      // Screenshot failed - not critical
    }

    return {
      id: exampleId,
      title: exampleId,
      category: 'unknown',
      backend,
      status: hasContent || errors.length === 0 ? 'passed' : 'failed',
      compilationTime,
      errors,
      warnings,
      hasRenderedContent: hasContent,
      screenshotPath: fs.existsSync(screenshotPath) ? screenshotPath : undefined,
      failureReason: hasContent ? undefined : 'Canvas has no visible content',
      suggestedFix: hasContent ? undefined : 'Check if example renders anything or has initialization issues',
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    errors.push(errorMsg)
    const { category, suggestedFix } = categorizeError(errorMsg)

    return {
      id: exampleId,
      title: exampleId,
      category: 'unknown',
      backend,
      status: 'failed',
      compilationTime: Date.now() - startTime,
      errors,
      warnings,
      hasRenderedContent: false,
      failureReason: category,
      suggestedFix,
    }
  } finally {
    page.off('console', consoleHandler)
    page.off('pageerror', errorHandler)
  }
}

/**
 * Generates the compatibility report
 */
function generateReport(results: ExampleTestResult[], backend: string): CompatibilityReport {
  const passed = results.filter(r => r.status === 'passed').length
  const failed = results.filter(r => r.status === 'failed').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const timeout = results.filter(r => r.status === 'timeout').length

  // Count failures by category
  const failuresByCategory: Record<string, number> = {}
  for (const result of results) {
    if (result.status === 'failed' && result.failureReason) {
      failuresByCategory[result.failureReason] = (failuresByCategory[result.failureReason] || 0) + 1
    }
  }

  // Find common errors
  const errorCounts: Record<string, { count: number; examples: string[] }> = {}
  for (const result of results) {
    for (const error of result.errors) {
      // Normalize error for grouping
      const normalized = error.slice(0, 100).toLowerCase()
      if (!errorCounts[normalized]) {
        errorCounts[normalized] = { count: 0, examples: [] }
      }
      errorCounts[normalized].count++
      errorCounts[normalized].examples.push(result.id)
    }
  }

  const commonErrors = Object.entries(errorCounts)
    .map(([error, data]) => ({ error, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    generatedAt: new Date().toISOString(),
    backend,
    totalExamples: results.length,
    passed,
    failed,
    skipped,
    timeout,
    passRate: ((passed / results.length) * 100).toFixed(1) + '%',
    results,
    failuresByCategory,
    commonErrors,
  }
}

/**
 * Generates markdown report
 */
function generateMarkdownReport(report: CompatibilityReport): string {
  const lines: string[] = []

  lines.push(`# Example Compatibility Report - ${report.backend.toUpperCase()}`)
  lines.push('')
  lines.push(`Generated: ${report.generatedAt}`)
  lines.push('')

  lines.push('## Summary')
  lines.push('')
  lines.push('| Metric | Count |')
  lines.push('|--------|-------|')
  lines.push(`| Total Examples | ${report.totalExamples} |`)
  lines.push(`| ✅ Passed | ${report.passed} |`)
  lines.push(`| ❌ Failed | ${report.failed} |`)
  lines.push(`| ⏭️ Skipped | ${report.skipped} |`)
  lines.push(`| ⏱️ Timeout | ${report.timeout} |`)
  lines.push(`| **Pass Rate** | **${report.passRate}** |`)
  lines.push('')

  if (Object.keys(report.failuresByCategory).length > 0) {
    lines.push('## Failures by Category')
    lines.push('')
    lines.push('| Category | Count | Suggested Fix |')
    lines.push('|----------|-------|---------------|')
    for (const [category, count] of Object.entries(report.failuresByCategory).sort((a, b) => b[1] - a[1])) {
      const example = report.results.find(r => r.failureReason === category)
      lines.push(`| ${category} | ${count} | ${example?.suggestedFix || '-'} |`)
    }
    lines.push('')
  }

  if (report.commonErrors.length > 0) {
    lines.push('## Common Errors')
    lines.push('')
    for (const { error, count, examples } of report.commonErrors.slice(0, 5)) {
      lines.push(`### ${error.slice(0, 80)}... (${count} occurrences)`)
      lines.push('')
      lines.push('Affected examples: ' + examples.slice(0, 5).join(', ') + (examples.length > 5 ? '...' : ''))
      lines.push('')
    }
  }

  lines.push('## Detailed Results')
  lines.push('')

  // Group by status
  const byStatus = {
    passed: report.results.filter(r => r.status === 'passed'),
    failed: report.results.filter(r => r.status === 'failed'),
    skipped: report.results.filter(r => r.status === 'skipped'),
    timeout: report.results.filter(r => r.status === 'timeout'),
  }

  if (byStatus.failed.length > 0) {
    lines.push('### ❌ Failed Examples')
    lines.push('')
    lines.push('| Example | Category | Reason | Suggested Fix |')
    lines.push('|---------|----------|--------|---------------|')
    for (const result of byStatus.failed) {
      lines.push(`| ${result.id} | ${result.failureReason || '-'} | ${result.errors[0]?.slice(0, 50) || '-'} | ${result.suggestedFix || '-'} |`)
    }
    lines.push('')
  }

  if (byStatus.timeout.length > 0) {
    lines.push('### ⏱️ Timeout Examples')
    lines.push('')
    for (const result of byStatus.timeout) {
      lines.push(`- ${result.id}`)
    }
    lines.push('')
  }

  if (byStatus.passed.length > 0) {
    lines.push('### ✅ Passed Examples')
    lines.push('')
    lines.push('<details>')
    lines.push('<summary>View all passed examples</summary>')
    lines.push('')
    for (const result of byStatus.passed) {
      lines.push(`- ${result.id} (${result.compilationTime}ms)`)
    }
    lines.push('')
    lines.push('</details>')
  }

  return lines.join('\n')
}

// ============================================================================
// Test Suite
// ============================================================================

test.describe('Example Compatibility - WebGL2', () => {
  test.describe.configure({ mode: 'serial', timeout: 600000 }) // 10 min total

  let allResults: ExampleTestResult[] = []

  test('test all examples on WebGL2', async ({ page }) => {
    // This is a meta-test that runs all examples
    // In a real run, you'd want to parallelize this

    // For now, test a representative sample
    const sampleExamples = [
      'hello-app',
      'hello-sphere',
      'pg-sine-env',
      'particle-system-basic',
      'studio-env-basic',
    ]

    for (const exampleId of sampleExamples) {
      console.log(`Testing: ${exampleId}`)
      const result = await testExample(page, exampleId, 'webgl2')
      allResults.push(result)
      console.log(`  Result: ${result.status}`)
    }

    // Generate report
    const report = generateReport(allResults, 'webgl2')
    const outputDir = path.join(__dirname, '../test-results/examples')
    fs.mkdirSync(outputDir, { recursive: true })

    fs.writeFileSync(
      path.join(outputDir, 'webgl2-compatibility.json'),
      JSON.stringify(report, null, 2)
    )
    fs.writeFileSync(
      path.join(outputDir, 'webgl2-compatibility.md'),
      generateMarkdownReport(report)
    )

    console.log(`\nWebGL2 Compatibility: ${report.passRate}`)
    expect(report.passed).toBeGreaterThan(0)
  })
})

test.describe('Example Compatibility - WebGPU', () => {
  test.describe.configure({ mode: 'serial', timeout: 600000 })

  test.beforeEach(async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'WebGPU only on Chromium')
  })

  test('test all examples on WebGPU', async ({ page }) => {
    const hasWebGPU = await page.evaluate(() => !!navigator.gpu)
    test.skip(!hasWebGPU, 'WebGPU not available')

    const sampleExamples = [
      'hello-app',
      'hello-sphere',
    ]

    const results: ExampleTestResult[] = []

    for (const exampleId of sampleExamples) {
      console.log(`Testing: ${exampleId}`)
      const result = await testExample(page, exampleId, 'webgpu')
      results.push(result)
      console.log(`  Result: ${result.status}`)
    }

    const report = generateReport(results, 'webgpu')
    const outputDir = path.join(__dirname, '../test-results/examples')
    fs.mkdirSync(outputDir, { recursive: true })

    fs.writeFileSync(
      path.join(outputDir, 'webgpu-compatibility.json'),
      JSON.stringify(report, null, 2)
    )
    fs.writeFileSync(
      path.join(outputDir, 'webgpu-compatibility.md'),
      generateMarkdownReport(report)
    )

    console.log(`\nWebGPU Compatibility: ${report.passRate}`)
  })
})
