/**
 * Custom Playwright Reporter - Error Tracker
 *
 * Tracks all errors across test runs, categorizes them,
 * and generates a comprehensive error report.
 */

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter'
import * as fs from 'fs'
import * as path from 'path'

interface TrackedError {
  testName: string
  testFile: string
  backend: 'webgl2' | 'webgpu' | 'unknown'
  category: 'compile' | 'runtime' | 'webgl' | 'webgpu' | 'network' | 'assertion' | 'unknown'
  message: string
  stack?: string
  timestamp: string
  browser: string
  screenshot?: string
}

interface ErrorReport {
  generatedAt: string
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  errors: TrackedError[]
  errorsByCategory: Record<string, number>
  errorsByBackend: Record<string, number>
  errorsByBrowser: Record<string, number>
  summary: string
}

class ErrorTrackerReporter implements Reporter {
  private errors: TrackedError[] = []
  private config!: FullConfig
  private totalTests = 0
  private passedTests = 0
  private failedTests = 0
  private skippedTests = 0

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config
    this.errors = []
    this.totalTests = 0
    this.passedTests = 0
    this.failedTests = 0
    this.skippedTests = 0

    console.log('\n📊 Error Tracker Reporter Initialized')
    console.log(`   Running ${suite.allTests().length} tests\n`)
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.totalTests++

    if (result.status === 'passed') {
      this.passedTests++
      return
    }

    if (result.status === 'skipped') {
      this.skippedTests++
      return
    }

    this.failedTests++

    // Extract error information
    const error = result.error
    if (!error) return

    // Determine backend from test name or project
    let backend: TrackedError['backend'] = 'unknown'
    if (test.title.toLowerCase().includes('webgpu') || test.parent.title.toLowerCase().includes('webgpu')) {
      backend = 'webgpu'
    } else if (test.title.toLowerCase().includes('webgl') || test.parent.title.toLowerCase().includes('webgl')) {
      backend = 'webgl2'
    }

    // Categorize error
    const category = this.categorizeError(error.message || '')

    // Find screenshot if available
    const screenshot = result.attachments.find(a => a.name === 'screenshot')?.path

    const trackedError: TrackedError = {
      testName: test.title,
      testFile: test.location.file,
      backend,
      category,
      message: error.message || 'Unknown error',
      stack: error.stack,
      timestamp: new Date().toISOString(),
      browser: test.parent.project()?.name || 'unknown',
      screenshot,
    }

    this.errors.push(trackedError)

    // Log error immediately
    console.log(`\n❌ Test Failed: ${test.title}`)
    console.log(`   Backend: ${backend}`)
    console.log(`   Category: ${category}`)
    console.log(`   Message: ${error.message?.slice(0, 100)}...`)
  }

  private categorizeError(message: string): TrackedError['category'] {
    const msg = message.toLowerCase()

    if (msg.includes('compile') || msg.includes('compilation') || msg.includes('build')) {
      return 'compile'
    }
    if (msg.includes('webgpu') || msg.includes('wgpu') || msg.includes('gpu device')) {
      return 'webgpu'
    }
    if (msg.includes('webgl') || msg.includes('gl_') || msg.includes('glget')) {
      return 'webgl'
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('http')) {
      return 'network'
    }
    if (msg.includes('expect') || msg.includes('assert') || msg.includes('tobetruthy')) {
      return 'assertion'
    }
    if (msg.includes('runtime') || msg.includes('exception') || msg.includes('error')) {
      return 'runtime'
    }

    return 'unknown'
  }

  async onEnd(result: FullResult): Promise<void> {
    // Generate report
    const report = this.generateReport()

    // Save JSON report
    const outputDir = path.join(this.config.rootDir, '..', 'test-results')
    fs.mkdirSync(outputDir, { recursive: true })

    const jsonPath = path.join(outputDir, 'error-report.json')
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))

    // Save Markdown report
    const mdPath = path.join(outputDir, 'error-report.md')
    fs.writeFileSync(mdPath, this.generateMarkdownReport(report))

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 ERROR TRACKING REPORT')
    console.log('='.repeat(60))
    console.log(`\nTotal Tests: ${this.totalTests}`)
    console.log(`  ✅ Passed: ${this.passedTests}`)
    console.log(`  ❌ Failed: ${this.failedTests}`)
    console.log(`  ⏭️ Skipped: ${this.skippedTests}`)

    if (this.errors.length > 0) {
      console.log('\nErrors by Category:')
      for (const [category, count] of Object.entries(report.errorsByCategory)) {
        console.log(`  ${category}: ${count}`)
      }

      console.log('\nErrors by Backend:')
      for (const [backend, count] of Object.entries(report.errorsByBackend)) {
        console.log(`  ${backend}: ${count}`)
      }
    }

    console.log(`\n📁 Full report saved to: ${jsonPath}`)
    console.log(`📝 Markdown report: ${mdPath}`)
    console.log('='.repeat(60) + '\n')
  }

  private generateReport(): ErrorReport {
    const errorsByCategory: Record<string, number> = {}
    const errorsByBackend: Record<string, number> = {}
    const errorsByBrowser: Record<string, number> = {}

    for (const error of this.errors) {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1
      errorsByBackend[error.backend] = (errorsByBackend[error.backend] || 0) + 1
      errorsByBrowser[error.browser] = (errorsByBrowser[error.browser] || 0) + 1
    }

    const summary = this.generateSummary(errorsByCategory, errorsByBackend)

    return {
      generatedAt: new Date().toISOString(),
      totalTests: this.totalTests,
      passedTests: this.passedTests,
      failedTests: this.failedTests,
      skippedTests: this.skippedTests,
      errors: this.errors,
      errorsByCategory,
      errorsByBackend,
      errorsByBrowser,
      summary,
    }
  }

  private generateSummary(
    byCategory: Record<string, number>,
    byBackend: Record<string, number>
  ): string {
    const lines: string[] = []

    if (this.failedTests === 0) {
      return 'All tests passed! No errors detected.'
    }

    lines.push(`${this.failedTests} test(s) failed out of ${this.totalTests}.`)

    // Identify main issues
    if (byCategory['webgpu'] > 0) {
      lines.push(`- WebGPU issues detected (${byCategory['webgpu']} errors). Check canvas context configuration.`)
    }
    if (byCategory['webgl'] > 0) {
      lines.push(`- WebGL issues detected (${byCategory['webgl']} errors). Check GL context and shader compilation.`)
    }
    if (byCategory['compile'] > 0) {
      lines.push(`- Compilation issues detected (${byCategory['compile']} errors). Check backend compiler service.`)
    }
    if (byCategory['runtime'] > 0) {
      lines.push(`- Runtime errors detected (${byCategory['runtime']} errors). Check WASM module initialization.`)
    }

    return lines.join('\n')
  }

  private generateMarkdownReport(report: ErrorReport): string {
    const lines: string[] = []

    lines.push('# AlloLib Studio Online - Test Error Report')
    lines.push('')
    lines.push(`Generated: ${report.generatedAt}`)
    lines.push('')

    lines.push('## Summary')
    lines.push('')
    lines.push(`| Metric | Count |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Total Tests | ${report.totalTests} |`)
    lines.push(`| Passed | ${report.passedTests} |`)
    lines.push(`| Failed | ${report.failedTests} |`)
    lines.push(`| Skipped | ${report.skippedTests} |`)
    lines.push('')

    if (report.errors.length === 0) {
      lines.push('**All tests passed!** 🎉')
      return lines.join('\n')
    }

    lines.push('## Analysis')
    lines.push('')
    lines.push(report.summary)
    lines.push('')

    lines.push('## Errors by Category')
    lines.push('')
    lines.push('| Category | Count |')
    lines.push('|----------|-------|')
    for (const [category, count] of Object.entries(report.errorsByCategory)) {
      lines.push(`| ${category} | ${count} |`)
    }
    lines.push('')

    lines.push('## Errors by Backend')
    lines.push('')
    lines.push('| Backend | Count |')
    lines.push('|---------|-------|')
    for (const [backend, count] of Object.entries(report.errorsByBackend)) {
      lines.push(`| ${backend} | ${count} |`)
    }
    lines.push('')

    lines.push('## Detailed Errors')
    lines.push('')

    for (const error of report.errors) {
      lines.push(`### ${error.testName}`)
      lines.push('')
      lines.push(`- **File:** ${error.testFile}`)
      lines.push(`- **Backend:** ${error.backend}`)
      lines.push(`- **Category:** ${error.category}`)
      lines.push(`- **Browser:** ${error.browser}`)
      lines.push(`- **Time:** ${error.timestamp}`)
      lines.push('')
      lines.push('**Message:**')
      lines.push('```')
      lines.push(error.message)
      lines.push('```')
      if (error.stack) {
        lines.push('')
        lines.push('<details>')
        lines.push('<summary>Stack Trace</summary>')
        lines.push('')
        lines.push('```')
        lines.push(error.stack)
        lines.push('```')
        lines.push('</details>')
      }
      lines.push('')
    }

    return lines.join('\n')
  }
}

export default ErrorTrackerReporter
