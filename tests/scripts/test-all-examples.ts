#!/usr/bin/env ts-node
/**
 * Test All Examples Script
 *
 * Systematically tests ALL examples in the AlloLib Studio library.
 * Generates a comprehensive compatibility report with:
 * - Pass/fail status for each example
 * - Error categorization
 * - Suggested fixes for common issues
 *
 * Usage:
 *   npx ts-node scripts/test-all-examples.ts --backend webgl2
 *   npx ts-node scripts/test-all-examples.ts --backend webgpu
 *   npx ts-node scripts/test-all-examples.ts --backend both --parallel 4
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:5173'
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000'
const COMPILE_TIMEOUT = 120000 // 2 minutes per example
const RENDER_WAIT = 3000
const MAX_RETRIES = 2

// Parse command line args
const args = process.argv.slice(2)
const backendArg = args.find(a => a.startsWith('--backend='))?.split('=')[1] ||
                   (args.includes('--backend') ? args[args.indexOf('--backend') + 1] : 'webgl2')
const parallelArg = parseInt(args.find(a => a.startsWith('--parallel='))?.split('=')[1] || '1')
const filterArg = args.find(a => a.startsWith('--filter='))?.split('=')[1]
const skipArg = args.find(a => a.startsWith('--skip='))?.split('=')[1]?.split(',') || []
const continueFrom = args.find(a => a.startsWith('--continue='))?.split('=')[1]

interface ExampleInfo {
  id: string
  title: string
  category: string
  subcategory?: string
  code: string
  isMultiFile: boolean
}

interface TestResult {
  id: string
  title: string
  category: string
  subcategory?: string
  backend: string
  status: 'passed' | 'failed' | 'skipped' | 'timeout' | 'error'
  compilationTime: number
  errors: string[]
  warnings: string[]
  hasRenderedContent: boolean
  screenshotPath?: string
  failureCategory?: string
  suggestedFix?: string
  retries: number
}

interface CompatibilityReport {
  generatedAt: string
  backend: string
  testDuration: number
  totalExamples: number
  passed: number
  failed: number
  skipped: number
  timeout: number
  passRate: string
  results: TestResult[]
  summary: {
    byCategory: Record<string, { total: number; passed: number; failed: number }>
    byFailureReason: Record<string, { count: number; examples: string[]; suggestedFix: string }>
    topErrors: { error: string; count: number }[]
  }
}

// Error patterns for categorization
const ERROR_PATTERNS = [
  { pattern: /undefined.*symbol|unresolved.*external/i, category: 'Link Error', fix: 'Missing library or symbol - check includes and linking' },
  { pattern: /gam::|Gamma/i, category: 'Gamma DSP', fix: 'Ensure Gamma library is properly linked' },
  { pattern: /texture|image.*load|png|jpg/i, category: 'Asset Loading', fix: 'Web assets require different loading mechanism' },
  { pattern: /mesh.*load|obj.*file|model/i, category: 'Mesh Loading', fix: 'OBJ files need to be bundled with the build' },
  { pattern: /shader.*compil|glsl|fragment|vertex/i, category: 'Shader Error', fix: 'Check GLSL syntax for WebGL2 compatibility' },
  { pattern: /wgsl|pipeline.*fail|webgpu/i, category: 'WebGPU Error', fix: 'WGSL syntax differs from GLSL' },
  { pattern: /canvas.*context|webgl.*context/i, category: 'Context Error', fix: 'Canvas context issue - check backend configuration' },
  { pattern: /audio|sound|sample.*rate/i, category: 'Audio Error', fix: 'Audio requires user interaction to start' },
  { pattern: /memory|alloc|heap|stack/i, category: 'Memory Error', fix: 'Reduce resource usage for web environment' },
  { pattern: /timeout|timed.*out/i, category: 'Timeout', fix: 'Example takes too long - may have infinite loop' },
  { pattern: /function.*signature|type.*mismatch/i, category: 'Type Error', fix: 'C++ function signature mismatch' },
  { pattern: /not.*found|missing|undefined/i, category: 'Missing Dependency', fix: 'Check if all includes are available in web build' },
]

function categorizeError(error: string): { category: string; fix: string } {
  for (const { pattern, category, fix } of ERROR_PATTERNS) {
    if (pattern.test(error)) {
      return { category, fix }
    }
  }
  return { category: 'Unknown', fix: 'Investigate error message' }
}

async function fetchExamplesFromApp(page: Page): Promise<ExampleInfo[]> {
  console.log('Fetching example list from application...')

  await page.goto(BASE_URL, { waitUntil: 'networkidle' })

  const examples = await page.evaluate(() => {
    const results: any[] = []

    // Try multiple methods to get examples
    const win = window as any

    // Method 1: Check if examples are exposed globally (we'll add this)
    if (win.__allExamples) {
      return win.__allExamples
    }

    // Method 2: Import directly from the module
    // This works because Vite exposes modules in dev mode
    try {
      // Access Vue app instance
      const app = document.querySelector('#app')
      if (app && (app as any).__vue_app__) {
        const vueApp = (app as any).__vue_app__
        // Try to access the examples from the app's provides or global properties
        const provides = vueApp._context?.provides
        if (provides?.examples) {
          return provides.examples
        }
      }
    } catch (e) {
      console.log('Could not access Vue app:', e)
    }

    // Method 3: Parse from the example selector UI
    const selector = document.querySelector('[data-testid="example-selector"]')
    if (selector) {
      const options = selector.querySelectorAll('option')
      options.forEach(opt => {
        if (opt.value) {
          results.push({
            id: opt.value,
            title: opt.textContent || opt.value,
            category: opt.closest('optgroup')?.label || 'unknown',
            code: '', // Will need to fetch later
            isMultiFile: false,
          })
        }
      })
    }

    return results
  })

  console.log(`Found ${examples.length} examples`)
  return examples
}

async function loadExampleCode(page: Page, exampleId: string): Promise<string | null> {
  // Navigate to the app and load the example
  await page.goto(`${BASE_URL}?example=${exampleId}`, { waitUntil: 'networkidle' })

  // Wait for editor to load
  await page.waitForTimeout(1000)

  // Get code from Monaco editor
  const code = await page.evaluate(() => {
    const win = window as any
    if (win.monaco) {
      const models = win.monaco.editor.getModels()
      if (models.length > 0) {
        return models[0].getValue()
      }
    }
    // Fallback: get from textarea
    const textarea = document.querySelector('textarea.code-editor, .monaco-editor textarea')
    return textarea ? (textarea as HTMLTextAreaElement).value : null
  })

  return code
}

async function testSingleExample(
  browser: Browser,
  example: ExampleInfo,
  backend: 'webgl2' | 'webgpu',
  screenshotDir: string
): Promise<TestResult> {
  const startTime = Date.now()
  const errors: string[] = []
  const warnings: string[] = []
  let retries = 0
  let context: BrowserContext | null = null
  let page: Page | null = null

  const result: TestResult = {
    id: example.id,
    title: example.title,
    category: example.category,
    subcategory: example.subcategory,
    backend,
    status: 'error',
    compilationTime: 0,
    errors: [],
    warnings: [],
    hasRenderedContent: false,
    retries: 0,
  }

  while (retries <= MAX_RETRIES) {
    try {
      // Create fresh context for each attempt
      const contextOptions: any = {}

      if (backend === 'webgpu') {
        contextOptions.args = [
          '--enable-unsafe-webgpu',
          '--enable-features=Vulkan,WebGPU',
        ]
      }

      context = await browser.newContext()
      page = await context.newPage()

      // Collect console messages
      page.on('console', msg => {
        const text = msg.text()
        if (msg.type() === 'error') errors.push(text)
        else if (msg.type() === 'warning') warnings.push(text)
      })

      page.on('pageerror', err => errors.push(`Page Error: ${err.message}`))

      // Navigate to app with example
      await page.goto(`${BASE_URL}?example=${example.id}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      })

      // Set backend preference
      await page.evaluate((backend) => {
        localStorage.setItem('allolib-settings', JSON.stringify({
          graphics: { backendType: backend }
        }))
      }, backend)

      // Find and click the Run button
      const runButton = page.locator('button:has-text("Run"), button:has-text("▶"), [data-testid="run-button"]')
      if (await runButton.count() > 0) {
        await runButton.first().click()
      } else {
        // Try keyboard shortcut
        await page.keyboard.press('Control+Enter')
      }

      // Wait for compilation result
      const compilePromise = page.waitForFunction(() => {
        const output = document.querySelector('.console-panel, .console-output, [data-testid="console"]')
        const text = output?.textContent || ''
        return text.includes('[SUCCESS]') ||
               text.includes('Application started') ||
               text.includes('[ERROR]') ||
               text.includes('error:') ||
               text.includes('failed')
      }, { timeout: COMPILE_TIMEOUT })

      const timeoutPromise = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), COMPILE_TIMEOUT)
      )

      const compileResult = await Promise.race([compilePromise.then(() => 'done'), timeoutPromise])
      result.compilationTime = Date.now() - startTime

      if (compileResult === 'timeout') {
        result.status = 'timeout'
        result.failureCategory = 'Timeout'
        result.suggestedFix = 'Example compilation or startup exceeded timeout'
        break
      }

      // Check console output for errors
      const consoleText = await page.evaluate(() => {
        const output = document.querySelector('.console-panel, .console-output, [data-testid="console"]')
        return output?.textContent || ''
      })

      if (consoleText.includes('[ERROR]') || consoleText.includes('error:')) {
        const errorMatch = consoleText.match(/\[ERROR\][^\n]+|error:[^\n]+/gi)
        if (errorMatch) {
          errors.push(...errorMatch)
        }
        const { category, fix } = categorizeError(errors.join(' '))
        result.status = 'failed'
        result.failureCategory = category
        result.suggestedFix = fix
        break
      }

      // Wait for rendering
      await page.waitForTimeout(RENDER_WAIT)

      // Check canvas for content
      const hasContent = await page.evaluate(() => {
        const canvas = document.querySelector('#canvas, canvas') as HTMLCanvasElement
        if (!canvas) return false

        try {
          const tempCanvas = document.createElement('canvas')
          const w = Math.min(canvas.width, 100)
          const h = Math.min(canvas.height, 100)
          tempCanvas.width = w
          tempCanvas.height = h
          const ctx = tempCanvas.getContext('2d')!
          ctx.drawImage(canvas, 0, 0, w, h)
          const data = ctx.getImageData(0, 0, w, h).data

          // Check for non-black pixels
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] > 15 || data[i + 1] > 15 || data[i + 2] > 15) {
              return true
            }
          }
          return false
        } catch (e) {
          return false
        }
      })

      result.hasRenderedContent = hasContent

      // Take screenshot
      try {
        const canvas = page.locator('#canvas, canvas').first()
        if (await canvas.count() > 0) {
          const screenshotPath = path.join(screenshotDir, `${example.id}.png`)
          await canvas.screenshot({ path: screenshotPath })
          result.screenshotPath = screenshotPath
        }
      } catch {
        // Screenshot failed - not critical
      }

      // Determine final status
      if (errors.length === 0 && (hasContent || consoleText.includes('[SUCCESS]'))) {
        result.status = 'passed'
      } else if (errors.length > 0) {
        const { category, fix } = categorizeError(errors.join(' '))
        result.status = 'failed'
        result.failureCategory = category
        result.suggestedFix = fix
      } else {
        result.status = 'failed'
        result.failureCategory = 'No Content'
        result.suggestedFix = 'Canvas shows no visible content - check rendering'
      }

      break // Success - exit retry loop
    } catch (error) {
      retries++
      result.retries = retries
      const errorMsg = error instanceof Error ? error.message : String(error)
      errors.push(`Attempt ${retries}: ${errorMsg}`)

      if (retries > MAX_RETRIES) {
        const { category, fix } = categorizeError(errorMsg)
        result.status = 'error'
        result.failureCategory = category
        result.suggestedFix = fix
      }
    } finally {
      if (page) await page.close().catch(() => {})
      if (context) await context.close().catch(() => {})
    }
  }

  result.errors = errors
  result.warnings = warnings
  result.compilationTime = Date.now() - startTime

  return result
}

function generateReport(results: TestResult[], backend: string, duration: number): CompatibilityReport {
  const passed = results.filter(r => r.status === 'passed').length
  const failed = results.filter(r => r.status === 'failed').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const timeout = results.filter(r => r.status === 'timeout').length

  // Group by category
  const byCategory: Record<string, { total: number; passed: number; failed: number }> = {}
  for (const r of results) {
    const cat = r.category || 'unknown'
    if (!byCategory[cat]) byCategory[cat] = { total: 0, passed: 0, failed: 0 }
    byCategory[cat].total++
    if (r.status === 'passed') byCategory[cat].passed++
    if (r.status === 'failed' || r.status === 'error') byCategory[cat].failed++
  }

  // Group by failure reason
  const byFailureReason: Record<string, { count: number; examples: string[]; suggestedFix: string }> = {}
  for (const r of results) {
    if (r.failureCategory) {
      if (!byFailureReason[r.failureCategory]) {
        byFailureReason[r.failureCategory] = { count: 0, examples: [], suggestedFix: r.suggestedFix || '' }
      }
      byFailureReason[r.failureCategory].count++
      byFailureReason[r.failureCategory].examples.push(r.id)
    }
  }

  // Top errors
  const errorCounts: Record<string, number> = {}
  for (const r of results) {
    for (const e of r.errors) {
      const key = e.slice(0, 80)
      errorCounts[key] = (errorCounts[key] || 0) + 1
    }
  }
  const topErrors = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([error, count]) => ({ error, count }))

  return {
    generatedAt: new Date().toISOString(),
    backend,
    testDuration: duration,
    totalExamples: results.length,
    passed,
    failed,
    skipped,
    timeout,
    passRate: ((passed / results.length) * 100).toFixed(1) + '%',
    results,
    summary: {
      byCategory,
      byFailureReason,
      topErrors,
    },
  }
}

function generateMarkdown(report: CompatibilityReport): string {
  const lines: string[] = []

  lines.push(`# ${report.backend.toUpperCase()} Example Compatibility Report`)
  lines.push('')
  lines.push(`**Generated:** ${report.generatedAt}`)
  lines.push(`**Duration:** ${(report.testDuration / 1000 / 60).toFixed(1)} minutes`)
  lines.push('')

  lines.push('## Summary')
  lines.push('')
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Total | ${report.totalExamples} |`)
  lines.push(`| ✅ Passed | ${report.passed} |`)
  lines.push(`| ❌ Failed | ${report.failed} |`)
  lines.push(`| ⏱️ Timeout | ${report.timeout} |`)
  lines.push(`| ⏭️ Skipped | ${report.skipped} |`)
  lines.push(`| **Pass Rate** | **${report.passRate}** |`)
  lines.push('')

  // Failures by reason
  if (Object.keys(report.summary.byFailureReason).length > 0) {
    lines.push('## Failure Analysis')
    lines.push('')
    lines.push('| Category | Count | Suggested Fix |')
    lines.push('|----------|-------|---------------|')
    const sorted = Object.entries(report.summary.byFailureReason)
      .sort((a, b) => b[1].count - a[1].count)
    for (const [category, data] of sorted) {
      lines.push(`| ${category} | ${data.count} | ${data.suggestedFix} |`)
    }
    lines.push('')

    // List affected examples
    lines.push('### Affected Examples by Category')
    lines.push('')
    for (const [category, data] of sorted) {
      lines.push(`<details>`)
      lines.push(`<summary><strong>${category}</strong> (${data.count} examples)</summary>`)
      lines.push('')
      for (const ex of data.examples) {
        lines.push(`- ${ex}`)
      }
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }
  }

  // Results by category
  lines.push('## Results by Category')
  lines.push('')
  lines.push('| Category | Total | Passed | Failed | Rate |')
  lines.push('|----------|-------|--------|--------|------|')
  for (const [cat, data] of Object.entries(report.summary.byCategory).sort((a, b) => a[0].localeCompare(b[0]))) {
    const rate = ((data.passed / data.total) * 100).toFixed(0)
    lines.push(`| ${cat} | ${data.total} | ${data.passed} | ${data.failed} | ${rate}% |`)
  }
  lines.push('')

  // All results
  lines.push('## All Results')
  lines.push('')
  lines.push('<details>')
  lines.push('<summary>Expand to see all example results</summary>')
  lines.push('')
  lines.push('| Example | Status | Time | Error |')
  lines.push('|---------|--------|------|-------|')
  for (const r of report.results) {
    const status = r.status === 'passed' ? '✅' : r.status === 'failed' ? '❌' : r.status === 'timeout' ? '⏱️' : '⚠️'
    const time = `${(r.compilationTime / 1000).toFixed(1)}s`
    const error = r.errors[0]?.slice(0, 50) || '-'
    lines.push(`| ${r.id} | ${status} | ${time} | ${error} |`)
  }
  lines.push('')
  lines.push('</details>')

  return lines.join('\n')
}

async function main() {
  console.log('\n🧪 AlloLib Studio - Example Compatibility Tester\n')
  console.log('═'.repeat(50))
  console.log(`Backend:  ${backendArg}`)
  console.log(`Parallel: ${parallelArg}`)
  if (filterArg) console.log(`Filter:   ${filterArg}`)
  if (skipArg.length) console.log(`Skip:     ${skipArg.join(', ')}`)
  if (continueFrom) console.log(`Continue: from ${continueFrom}`)
  console.log('═'.repeat(50))
  console.log('')

  const startTime = Date.now()

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: backendArg === 'webgpu' ? [
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,WebGPU',
      '--ignore-gpu-blocklist',
    ] : [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  })

  try {
    // Fetch examples
    const context = await browser.newContext()
    const page = await context.newPage()
    let examples = await fetchExamplesFromApp(page)
    await context.close()

    if (examples.length === 0) {
      console.error('❌ No examples found! Make sure the app is running.')
      console.log('   Start the frontend: cd frontend && npm run dev')
      process.exit(1)
    }

    // Apply filters
    if (filterArg) {
      const regex = new RegExp(filterArg, 'i')
      examples = examples.filter(e => regex.test(e.id) || regex.test(e.category))
    }

    if (skipArg.length > 0) {
      examples = examples.filter(e => !skipArg.includes(e.id))
    }

    if (continueFrom) {
      const idx = examples.findIndex(e => e.id === continueFrom)
      if (idx > 0) {
        examples = examples.slice(idx)
      }
    }

    console.log(`\nTesting ${examples.length} examples...\n`)

    // Prepare output directories
    const backends = backendArg === 'both' ? ['webgl2', 'webgpu'] : [backendArg]
    const outputDir = path.join(__dirname, '../../test-results/examples')
    fs.mkdirSync(outputDir, { recursive: true })

    for (const backend of backends as ('webgl2' | 'webgpu')[]) {
      console.log(`\n${'─'.repeat(50)}`)
      console.log(`Testing ${backend.toUpperCase()} backend`)
      console.log(`${'─'.repeat(50)}\n`)

      const screenshotDir = path.join(outputDir, 'screenshots', backend)
      fs.mkdirSync(screenshotDir, { recursive: true })

      const results: TestResult[] = []
      let completed = 0

      for (const example of examples) {
        completed++
        const progress = `[${completed}/${examples.length}]`
        process.stdout.write(`${progress} Testing: ${example.id.padEnd(40)}`)

        const result = await testSingleExample(browser, example, backend, screenshotDir)
        results.push(result)

        const statusIcon = result.status === 'passed' ? '✅' :
                          result.status === 'failed' ? '❌' :
                          result.status === 'timeout' ? '⏱️' : '⚠️'
        console.log(`${statusIcon} ${(result.compilationTime / 1000).toFixed(1)}s`)

        // Save progress periodically
        if (completed % 10 === 0) {
          const progressReport = generateReport(results, backend, Date.now() - startTime)
          fs.writeFileSync(
            path.join(outputDir, `${backend}-progress.json`),
            JSON.stringify(progressReport, null, 2)
          )
        }
      }

      // Generate final report
      const report = generateReport(results, backend, Date.now() - startTime)

      fs.writeFileSync(
        path.join(outputDir, `${backend}-compatibility.json`),
        JSON.stringify(report, null, 2)
      )
      fs.writeFileSync(
        path.join(outputDir, `${backend}-compatibility.md`),
        generateMarkdown(report)
      )

      console.log(`\n${'═'.repeat(50)}`)
      console.log(`${backend.toUpperCase()} Results: ${report.passed}/${report.totalExamples} passed (${report.passRate})`)
      console.log(`${'═'.repeat(50)}`)
    }

    console.log(`\n📁 Reports saved to: ${outputDir}`)
  } finally {
    await browser.close()
  }
}

main().catch(console.error)
