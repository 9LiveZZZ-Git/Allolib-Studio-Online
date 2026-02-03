#!/usr/bin/env node
/**
 * Combine Reports Script
 *
 * Combines test results from multiple test runs into a single report.
 * Used by GitHub Actions to generate a unified summary.
 */

const fs = require('fs')
const path = require('path')

const inputDir = process.argv[2] || 'all-results'
const outputDir = process.argv[3] || 'combined-report'

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true })

// Find all result files
function findResultFiles(dir, pattern = /results\.json$/i) {
  const results = []

  if (!fs.existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`)
    return results
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      results.push(...findResultFiles(fullPath, pattern))
    } else if (pattern.test(entry.name)) {
      results.push(fullPath)
    }
  }

  return results
}

// Parse and combine results
function combineResults(files) {
  const combined = {
    generatedAt: new Date().toISOString(),
    sources: [],
    totals: {
      tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    },
    byBackend: {
      webgl2: { tests: 0, passed: 0, failed: 0 },
      webgpu: { tests: 0, passed: 0, failed: 0 },
    },
    byBrowser: {},
    errors: [],
    allTests: [],
  }

  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(file, 'utf8'))
      combined.sources.push(path.relative(inputDir, file))

      // Handle Playwright JSON reporter format
      if (content.suites) {
        processPlaywrightResults(content, combined)
      }
      // Handle our custom error report format
      else if (content.errors) {
        processErrorReport(content, combined)
      }
      // Handle compilation test format
      else if (content.results && content.summary) {
        processCompilationResults(content, combined)
      }
    } catch (e) {
      console.warn(`Failed to parse ${file}: ${e.message}`)
    }
  }

  return combined
}

function processPlaywrightResults(data, combined) {
  function processTests(suite, browserName = 'unknown') {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const result = {
          title: spec.title,
          browser: browserName,
          status: test.status,
          duration: test.results?.[0]?.duration || 0,
          error: test.results?.[0]?.error?.message,
        }

        combined.allTests.push(result)
        combined.totals.tests++

        if (test.status === 'passed' || test.status === 'expected') {
          combined.totals.passed++
        } else if (test.status === 'failed' || test.status === 'unexpected') {
          combined.totals.failed++
          if (result.error) {
            combined.errors.push({
              test: spec.title,
              browser: browserName,
              error: result.error,
            })
          }
        } else if (test.status === 'skipped') {
          combined.totals.skipped++
        }

        // Track by browser
        combined.byBrowser[browserName] = combined.byBrowser[browserName] || { tests: 0, passed: 0, failed: 0 }
        combined.byBrowser[browserName].tests++
        if (test.status === 'passed') combined.byBrowser[browserName].passed++
        if (test.status === 'failed') combined.byBrowser[browserName].failed++

        // Track by backend (infer from project name or test title)
        const testInfo = spec.title.toLowerCase() + browserName.toLowerCase()
        if (testInfo.includes('webgpu')) {
          combined.byBackend.webgpu.tests++
          if (test.status === 'passed') combined.byBackend.webgpu.passed++
          if (test.status === 'failed') combined.byBackend.webgpu.failed++
        } else {
          combined.byBackend.webgl2.tests++
          if (test.status === 'passed') combined.byBackend.webgl2.passed++
          if (test.status === 'failed') combined.byBackend.webgl2.failed++
        }
      }
    }

    for (const child of suite.suites || []) {
      // Try to extract browser from project name
      const browser = suite.title?.match(/chromium|firefox|webkit/i)?.[0] || browserName
      processTests(child, browser)
    }
  }

  for (const suite of data.suites || []) {
    processTests(suite)
  }
}

function processErrorReport(data, combined) {
  combined.errors.push(...(data.errors || []))

  combined.totals.tests += data.totalTests || 0
  combined.totals.passed += data.passedTests || 0
  combined.totals.failed += data.failedTests || 0
  combined.totals.skipped += data.skippedTests || 0

  // Merge by category
  for (const [backend, count] of Object.entries(data.errorsByBackend || {})) {
    if (backend === 'webgl2' || backend === 'webgpu') {
      combined.byBackend[backend].failed += count
    }
  }
}

function processCompilationResults(data, combined) {
  combined.totals.tests += data.summary.total
  combined.totals.passed += data.summary.passed
  combined.totals.failed += data.summary.failed

  for (const result of data.results || []) {
    combined.allTests.push({
      title: `[Compilation] ${result.name}`,
      browser: 'node',
      status: result.passed ? 'passed' : 'failed',
      duration: result.time,
      error: result.error,
    })

    if (!result.passed && result.error) {
      combined.errors.push({
        test: result.name,
        browser: 'compilation',
        error: result.error,
      })
    }
  }
}

// Generate markdown summary
function generateSummary(combined) {
  const lines = []

  lines.push('# Test Results Summary')
  lines.push('')
  lines.push(`Generated: ${combined.generatedAt}`)
  lines.push('')

  // Overall stats
  const passRate = combined.totals.tests > 0
    ? ((combined.totals.passed / combined.totals.tests) * 100).toFixed(1)
    : '0'

  lines.push('## Overall Results')
  lines.push('')
  lines.push(`| Metric | Count |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Total Tests | ${combined.totals.tests} |`)
  lines.push(`| Passed | ${combined.totals.passed} |`)
  lines.push(`| Failed | ${combined.totals.failed} |`)
  lines.push(`| Skipped | ${combined.totals.skipped} |`)
  lines.push(`| Pass Rate | ${passRate}% |`)
  lines.push('')

  // By backend
  lines.push('## Results by Backend')
  lines.push('')
  lines.push('| Backend | Tests | Passed | Failed |')
  lines.push('|---------|-------|--------|--------|')
  for (const [backend, stats] of Object.entries(combined.byBackend)) {
    lines.push(`| ${backend} | ${stats.tests} | ${stats.passed} | ${stats.failed} |`)
  }
  lines.push('')

  // By browser
  if (Object.keys(combined.byBrowser).length > 0) {
    lines.push('## Results by Browser')
    lines.push('')
    lines.push('| Browser | Tests | Passed | Failed |')
    lines.push('|---------|-------|--------|--------|')
    for (const [browser, stats] of Object.entries(combined.byBrowser)) {
      lines.push(`| ${browser} | ${stats.tests} | ${stats.passed} | ${stats.failed} |`)
    }
    lines.push('')
  }

  // Errors
  if (combined.errors.length > 0) {
    lines.push('## Errors')
    lines.push('')
    for (const error of combined.errors.slice(0, 10)) {
      lines.push(`### ${error.test}`)
      lines.push('')
      lines.push(`- **Browser:** ${error.browser}`)
      lines.push('```')
      lines.push(error.error?.slice(0, 500) || 'Unknown error')
      lines.push('```')
      lines.push('')
    }

    if (combined.errors.length > 10) {
      lines.push(`_...and ${combined.errors.length - 10} more errors_`)
      lines.push('')
    }
  }

  // Status badge
  const status = combined.totals.failed === 0 ? '✅ All tests passed!' : `❌ ${combined.totals.failed} test(s) failed`
  lines.push('---')
  lines.push('')
  lines.push(`**Status:** ${status}`)

  return lines.join('\n')
}

// Main
const files = findResultFiles(inputDir)
console.log(`Found ${files.length} result file(s)`)

if (files.length === 0) {
  console.warn('No result files found!')
  fs.writeFileSync(path.join(outputDir, 'summary.md'), '# No test results found\n\nNo result files were generated.')
  process.exit(0)
}

const combined = combineResults(files)

// Write JSON
fs.writeFileSync(
  path.join(outputDir, 'combined-results.json'),
  JSON.stringify(combined, null, 2)
)

// Write summary
const summary = generateSummary(combined)
fs.writeFileSync(path.join(outputDir, 'summary.md'), summary)

console.log(`Combined report written to ${outputDir}/`)
console.log(`  - combined-results.json`)
console.log(`  - summary.md`)

// Print summary
console.log('\n' + '='.repeat(40))
console.log(`Total: ${combined.totals.tests} | Passed: ${combined.totals.passed} | Failed: ${combined.totals.failed}`)
console.log('='.repeat(40))
