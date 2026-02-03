/**
 * Visual Regression Tests for AlloLib Studio Online
 *
 * Captures screenshots of rendered scenes and compares them against
 * baseline images to detect visual regressions.
 */

import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots')
const BASELINE_DIR = path.join(SCREENSHOT_DIR, 'baseline')
const ACTUAL_DIR = path.join(SCREENSHOT_DIR, 'actual')
const DIFF_DIR = path.join(SCREENSHOT_DIR, 'diff')

// Ensure directories exist
for (const dir of [SCREENSHOT_DIR, BASELINE_DIR, ACTUAL_DIR, DIFF_DIR]) {
  fs.mkdirSync(dir, { recursive: true })
}

// Visual test cases with expected rendering
const visualTestCases = [
  {
    name: 'simple-sphere',
    description: 'Orange sphere with lighting',
    code: `
#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
using namespace al;
struct MyApp : WebApp {
  Mesh sphere;
  void onCreate() override {
    addSphere(sphere, 0.5);
    sphere.generateNormals();
    nav().pos(0, 0, 3);
  }
  void onDraw(Graphics& g) override {
    g.clear(0.1, 0.1, 0.15);
    g.lighting(true);
    g.light(Light().pos(2, 2, 5));
    g.color(1, 0.5, 0.2);
    g.draw(sphere);
  }
};
ALLOLIB_WEB_MAIN(MyApp)
`,
  },
  {
    name: 'colored-triangle',
    description: 'RGB triangle with mesh colors',
    code: `
#include "al_WebApp.hpp"
using namespace al;
struct MyApp : WebApp {
  Mesh mesh;
  void onCreate() override {
    mesh.primitive(Mesh::TRIANGLES);
    mesh.vertex(-0.6, -0.5, 0); mesh.color(1, 0, 0);
    mesh.vertex( 0.6, -0.5, 0); mesh.color(0, 1, 0);
    mesh.vertex( 0.0,  0.6, 0); mesh.color(0, 0, 1);
    nav().pos(0, 0, 2);
  }
  void onDraw(Graphics& g) override {
    g.clear(0.05, 0.05, 0.05);
    g.meshColor();
    g.draw(mesh);
  }
};
ALLOLIB_WEB_MAIN(MyApp)
`,
  },
  {
    name: 'wireframe-cube',
    description: 'White wireframe cube',
    code: `
#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
using namespace al;
struct MyApp : WebApp {
  Mesh cube;
  void onCreate() override {
    addWireBox(cube, 0.5);
    nav().pos(0, 0, 3);
  }
  void onDraw(Graphics& g) override {
    g.clear(0.0, 0.0, 0.1);
    g.color(1, 1, 1);
    g.draw(cube);
  }
};
ALLOLIB_WEB_MAIN(MyApp)
`,
  },
  {
    name: 'point-cloud',
    description: 'Colorful point cloud',
    code: `
#include "al_WebApp.hpp"
#include <cmath>
using namespace al;
struct MyApp : WebApp {
  Mesh points;
  void onCreate() override {
    points.primitive(Mesh::POINTS);
    for (int i = 0; i < 1000; i++) {
      float t = i / 1000.0f;
      float x = std::sin(t * 20) * t;
      float y = std::cos(t * 20) * t;
      float z = t - 0.5f;
      points.vertex(x, y, z);
      points.color(t, 1-t, 0.5f);
    }
    nav().pos(0, 0, 3);
  }
  void onDraw(Graphics& g) override {
    g.clear(0.02, 0.02, 0.05);
    g.meshColor();
    g.pointSize(3);
    g.draw(points);
  }
};
ALLOLIB_WEB_MAIN(MyApp)
`,
  },
  {
    name: 'checkerboard-texture',
    description: 'Checkerboard texture on quad',
    code: `
#include "al_WebApp.hpp"
#include <vector>
using namespace al;
struct MyApp : WebApp {
  Texture tex;
  Mesh quad;
  void onCreate() override {
    int size = 64;
    std::vector<uint8_t> pixels(size*size*4);
    for (int y = 0; y < size; y++) {
      for (int x = 0; x < size; x++) {
        bool white = ((x/8) + (y/8)) % 2 == 0;
        int i = (y*size + x) * 4;
        pixels[i] = white ? 255 : 50;
        pixels[i+1] = white ? 255 : 50;
        pixels[i+2] = white ? 255 : 50;
        pixels[i+3] = 255;
      }
    }
    tex.create2D(size, size, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
    tex.submit(pixels.data());
    quad.primitive(Mesh::TRIANGLE_STRIP);
    quad.vertex(-0.8,-0.8,0); quad.texCoord(0,0);
    quad.vertex(0.8,-0.8,0); quad.texCoord(1,0);
    quad.vertex(-0.8,0.8,0); quad.texCoord(0,1);
    quad.vertex(0.8,0.8,0); quad.texCoord(1,1);
    nav().pos(0, 0, 2);
  }
  void onDraw(Graphics& g) override {
    g.clear(0.2);
    tex.bind(0);
    g.texture();
    g.draw(quad);
    tex.unbind(0);
  }
};
ALLOLIB_WEB_MAIN(MyApp)
`,
  },
]

async function compileAndRun(page: Page, code: string): Promise<boolean> {
  // Clear any cached project state
  await page.evaluate(() => {
    localStorage.removeItem('allolib-project')
    localStorage.removeItem('allolib-code')
    localStorage.removeItem('unified-project')
  })

  // Wait for app to fully initialize
  await page.waitForTimeout(1000)

  // Set code using the project store (same approach as rendering tests)
  const editorSet = await page.evaluate((code) => {
    const win = window as any

    // Method 1: Use exposed store with actions (preferred)
    if (win.__stores?.project) {
      const projectStore = win.__stores.project
      const activeFilePath = projectStore.project?.activeFile || 'main.cpp'
      projectStore.updateFileContent(activeFilePath, code)
      return 'store-action'
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
        return 'store-direct'
      }
    }

    // Method 3: Try Monaco editor API directly
    if (win.monaco?.editor) {
      const models = win.monaco.editor.getModels()
      if (models && models.length > 0) {
        models[0].setValue(code)
        return 'monaco'
      }
    }

    return false
  }, code)

  console.log(`  Code set via: ${editorSet}`)

  // Sync Monaco with store if store method was used
  if (editorSet === 'store-action' || editorSet === 'store-direct') {
    await page.evaluate(() => {
      const win = window as any
      if (win.monaco?.editor) {
        const models = win.monaco.editor.getModels()
        const projectStore = win.__stores?.project
        const projectState = win.__pinia?.state?.value?.project
        const activeFile = projectStore?.project?.activeFile || projectState?.activeFile || 'main.cpp'
        const file = projectStore?.project?.files?.find((f: any) => f.path === activeFile) ||
                     projectState?.files?.find((f: any) => f.path === activeFile)
        if (models && models.length > 0 && file) {
          models[0].setValue(file.content)
        }
      }
    })
  }

  // Click run button
  const runButton = page.locator('[data-testid="run-button"], button.bg-green-600').first()
  await runButton.click()

  // Wait for compilation and rendering
  try {
    await page.waitForFunction(() => {
      const bodyText = document.body.innerText || ''
      return bodyText.includes('[SUCCESS]') || bodyText.includes('Application started') || bodyText.includes('Running')
    }, { timeout: 60000 })

    // Extra wait for rendering to stabilize
    await page.waitForTimeout(3000)
    return true
  } catch {
    return false
  }
}

async function captureCanvas(page: Page, name: string): Promise<string> {
  // Use toDataURL to capture WebGL content properly
  // Playwright's element.screenshot() doesn't capture WebGL canvas content correctly
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector('#canvas') as HTMLCanvasElement
    if (!canvas) return null

    // For WebGL canvases, we need to capture via toDataURL
    // The preserveDrawingBuffer option should be set, but if not, this still works
    // right after a render
    return canvas.toDataURL('image/png')
  })

  if (!dataUrl) {
    throw new Error('Failed to capture canvas - canvas not found')
  }

  // Convert data URL to file
  const screenshotPath = path.join(ACTUAL_DIR, `${name}.png`)
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
  fs.writeFileSync(screenshotPath, Buffer.from(base64Data, 'base64'))

  return screenshotPath
}

async function compareWithBaseline(
  actualPath: string,
  baselinePath: string,
  diffPath: string
): Promise<{ match: boolean; diffPercent: number }> {
  // Check if baseline exists
  if (!fs.existsSync(baselinePath)) {
    // First run - create baseline
    fs.copyFileSync(actualPath, baselinePath)
    return { match: true, diffPercent: 0 }
  }

  // Use Playwright's built-in comparison
  // For more sophisticated comparison, you could use pixelmatch
  const actual = fs.readFileSync(actualPath)
  const baseline = fs.readFileSync(baselinePath)

  if (actual.equals(baseline)) {
    return { match: true, diffPercent: 0 }
  }

  // Images differ - calculate approximate difference
  // This is a simple byte comparison; for real visual diff, use pixelmatch
  let diffCount = 0
  const minLen = Math.min(actual.length, baseline.length)

  for (let i = 0; i < minLen; i++) {
    if (actual[i] !== baseline[i]) diffCount++
  }

  const diffPercent = (diffCount / minLen) * 100

  // Copy actual to diff folder for inspection
  fs.copyFileSync(actualPath, diffPath)

  return { match: false, diffPercent }
}

// ============================================================================
// Visual Regression Test Suite
// ============================================================================

test.describe('Visual Regression Tests', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    console.log('\n📸 Visual Regression Test Suite')
    console.log(`   Baseline: ${BASELINE_DIR}`)
    console.log(`   Actual:   ${ACTUAL_DIR}`)
    console.log(`   Diff:     ${DIFF_DIR}\n`)
  })

  for (const testCase of visualTestCases) {
    test(`renders ${testCase.name} correctly`, async ({ page }) => {
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')

      // Compile and run
      const success = await compileAndRun(page, testCase.code)
      expect(success, `Compilation failed for ${testCase.name}`).toBe(true)

      // Capture screenshot
      const actualPath = await captureCanvas(page, testCase.name)
      const baselinePath = path.join(BASELINE_DIR, `${testCase.name}.png`)
      const diffPath = path.join(DIFF_DIR, `${testCase.name}.png`)

      // Compare with baseline
      const comparison = await compareWithBaseline(actualPath, baselinePath, diffPath)

      console.log(`  ${testCase.name}: ${comparison.match ? '✓ Match' : `✗ Diff ${comparison.diffPercent.toFixed(2)}%`}`)

      // Allow small differences (anti-aliasing, etc.)
      const threshold = 5 // 5% difference allowed
      expect(comparison.diffPercent).toBeLessThan(threshold)
    })
  }
})

// ============================================================================
// Update Baselines Command
// ============================================================================

test.describe('Update Baselines', () => {
  // Skip unless explicitly requested
  test.skip(process.env.UPDATE_BASELINES !== 'true', 'Set UPDATE_BASELINES=true to update baselines')

  for (const testCase of visualTestCases) {
    test(`update baseline for ${testCase.name}`, async ({ page }) => {
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')

      const success = await compileAndRun(page, testCase.code)
      expect(success).toBe(true)

      const baselinePath = path.join(BASELINE_DIR, `${testCase.name}.png`)

      // Use toDataURL to capture WebGL content properly
      const dataUrl = await page.evaluate(() => {
        const canvas = document.querySelector('#canvas') as HTMLCanvasElement
        return canvas?.toDataURL('image/png')
      })

      if (dataUrl) {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
        fs.writeFileSync(baselinePath, Buffer.from(base64Data, 'base64'))
      }

      console.log(`  Updated baseline: ${testCase.name}`)
    })
  }
})

// ============================================================================
// Canvas Health Check
// ============================================================================

test.describe('Canvas Health', () => {
  test('canvas renders non-black content', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    const simplestCode = `
#include "al_WebApp.hpp"
struct MyApp : al::WebApp {
  void onDraw(al::Graphics& g) override {
    g.clear(0.5, 0.2, 0.8); // Purple background
  }
};
ALLOLIB_WEB_MAIN(MyApp)
`

    await compileAndRun(page, simplestCode)

    // Check canvas content
    const hasContent = await page.evaluate(() => {
      const canvas = document.querySelector('#canvas') as HTMLCanvasElement
      if (!canvas) return false

      try {
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = canvas.width
        tempCanvas.height = canvas.height
        const ctx = tempCanvas.getContext('2d')!
        ctx.drawImage(canvas, 0, 0)

        const imageData = ctx.getImageData(0, 0, 100, 100)
        const data = imageData.data

        // Check if there's any non-black content
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 20 || data[i+1] > 20 || data[i+2] > 20) {
            return true
          }
        }
        return false
      } catch (e) {
        console.error('Canvas read error:', e)
        return false
      }
    })

    expect(hasContent).toBe(true)
  })
})
