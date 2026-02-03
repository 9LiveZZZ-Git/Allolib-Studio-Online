/**
 * WebGPU Feature Tests - Phase-specific tests for WebGPU compatibility
 *
 * Tests each phase of WebGPU implementation as defined in webgpu-full-compatibility-plan.md
 * These tests verify that WebGPU features work correctly and match WebGL2 behavior.
 */

import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'
const COMPILE_TIMEOUT = 90000 // 90s for compilation
const RENDER_WAIT = 5000 // 5s for rendering to stabilize

const SCREENSHOT_DIR = path.join(__dirname, '../screenshots')
const BASELINE_DIR = path.join(SCREENSHOT_DIR, 'baseline')
const ACTUAL_DIR = path.join(SCREENSHOT_DIR, 'actual')

// Ensure directories exist
for (const dir of [SCREENSHOT_DIR, BASELINE_DIR, ACTUAL_DIR]) {
  fs.mkdirSync(dir, { recursive: true })
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Check if WebGPU is functional (not just present)
 */
async function isWebGPUFunctional(page: Page): Promise<boolean> {
  return await page.evaluate(async () => {
    if (!navigator.gpu) return false
    try {
      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) return false
      const device = await adapter.requestDevice()
      device.destroy()
      return true
    } catch {
      return false
    }
  })
}

/**
 * Set graphics backend in settings
 */
async function setBackend(page: Page, backend: 'webgl2' | 'webgpu') {
  await page.evaluate((backend) => {
    const settingsStore = (window as any).__pinia?.state?.value?.settings
    if (settingsStore) {
      settingsStore.graphics.backendType = backend
    }
    const settings = JSON.parse(localStorage.getItem('allolib-settings') || '{}')
    settings.graphics = settings.graphics || {}
    settings.graphics.backendType = backend
    localStorage.setItem('allolib-settings', JSON.stringify(settings))
  }, backend)
}

/**
 * Compile and run code, returns success status
 */
async function compileAndRun(page: Page, code: string, backend: 'webgl2' | 'webgpu' = 'webgl2'): Promise<boolean> {
  // Clear localStorage
  await page.evaluate(() => {
    localStorage.removeItem('allolib-project')
    localStorage.removeItem('allolib-code')
    localStorage.removeItem('unified-project')
  })

  // Set backend
  await setBackend(page, backend)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  // Set code in editor
  await page.evaluate((code) => {
    const win = window as any
    if (win.__stores?.project) {
      const projectStore = win.__stores.project
      const activeFilePath = projectStore.project?.activeFile || 'main.cpp'
      projectStore.updateFileContent(activeFilePath, code)
    } else if (win.__pinia?.state?.value?.project) {
      const projectState = win.__pinia.state.value.project
      const fileIndex = projectState.files?.findIndex((f: any) => f.path === (projectState.activeFile || 'main.cpp'))
      if (fileIndex >= 0) {
        projectState.files[fileIndex].content = code
        projectState.files[fileIndex].isDirty = true
      }
    }
    // Sync Monaco
    if (win.monaco?.editor) {
      const models = win.monaco.editor.getModels()
      if (models?.length > 0) models[0].setValue(code)
    }
  }, code)

  await page.waitForTimeout(500)

  // Click run button
  const runButton = page.locator('[data-testid="run-button"]').first()
  await runButton.click()

  // Wait for compilation
  try {
    await page.waitForFunction(() => {
      const bodyText = document.body.innerText || ''
      return bodyText.includes('[SUCCESS]') || bodyText.includes('Application started') || bodyText.includes('Running')
    }, { timeout: COMPILE_TIMEOUT })

    await page.waitForTimeout(RENDER_WAIT)
    return true
  } catch {
    return false
  }
}

/**
 * Capture canvas using Playwright screenshot (works for both WebGL and WebGPU)
 * Note: WebGPU canvases don't support toDataURL() reliably, so we use Playwright's
 * native screenshot capability which captures the actual rendered pixels.
 */
async function captureCanvas(page: Page): Promise<Buffer | null> {
  const canvasLocator = page.locator('[data-testid="canvas"], #canvas').first()
  try {
    return await canvasLocator.screenshot({ type: 'png' })
  } catch {
    return null
  }
}

/**
 * Analyze canvas content using Playwright screenshot
 * This works for both WebGL and WebGPU canvases.
 * WebGPU doesn't preserve drawing buffer like WebGL, so toDataURL() returns empty.
 * Using Playwright's screenshot captures the actual displayed pixels.
 */
async function analyzeCanvas(page: Page): Promise<{
  hasContent: boolean
  uniqueColors: number
  dominantColor: [number, number, number]
}> {
  const { PNG } = await import('pngjs')

  const canvasLocator = page.locator('[data-testid="canvas"], #canvas').first()

  try {
    // Use Playwright screenshot - works for both WebGL and WebGPU
    const screenshot = await canvasLocator.screenshot({ type: 'png' })

    // Parse PNG to analyze pixels
    const png = PNG.sync.read(screenshot)
    const data = png.data
    const colorCounts: Record<string, number> = {}
    let hasNonBlack = false

    // Sample pixels (every 4th pixel for performance)
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      if (r > 10 || g > 10 || b > 10) hasNonBlack = true
      const key = `${Math.floor(r / 16)},${Math.floor(g / 16)},${Math.floor(b / 16)}`
      colorCounts[key] = (colorCounts[key] || 0) + 1
    }

    let maxCount = 0, dominantKey = '0,0,0'
    for (const [key, count] of Object.entries(colorCounts)) {
      if (count > maxCount) { maxCount = count; dominantKey = key }
    }
    const [r, g, b] = dominantKey.split(',').map(n => parseInt(n) * 16)

    return {
      hasContent: hasNonBlack,
      uniqueColors: Object.keys(colorCounts).length,
      dominantColor: [r, g, b] as [number, number, number]
    }
  } catch (err) {
    console.error('analyzeCanvas error:', err)
    return { hasContent: false, uniqueColors: 0, dominantColor: [0, 0, 0] as [number, number, number] }
  }
}

// ============================================================================
// Phase 1: Textures @webgpu
// ============================================================================

test.describe('WebGPU Phase 1: Textures @webgpu', () => {
  // Test code for simple texture
  const SIMPLE_TEXTURE_CODE = `
#include "al_WebApp.hpp"
#include <vector>
using namespace al;

struct TextureTestApp : WebApp {
  Texture tex;
  Mesh quad;

  void onCreate() override {
    // Create 64x64 checkerboard texture
    int size = 64;
    std::vector<uint8_t> pixels(size * size * 4);
    for (int y = 0; y < size; y++) {
      for (int x = 0; x < size; x++) {
        bool white = ((x / 8) + (y / 8)) % 2 == 0;
        int i = (y * size + x) * 4;
        pixels[i] = white ? 255 : 40;
        pixels[i+1] = white ? 255 : 40;
        pixels[i+2] = white ? 255 : 40;
        pixels[i+3] = 255;
      }
    }
    tex.create2D(size, size, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
    tex.submit(pixels.data());

    // Create quad with UV coords
    quad.primitive(Mesh::TRIANGLE_STRIP);
    quad.vertex(-0.8, -0.8, 0); quad.texCoord(0, 0);
    quad.vertex( 0.8, -0.8, 0); quad.texCoord(1, 0);
    quad.vertex(-0.8,  0.8, 0); quad.texCoord(0, 1);
    quad.vertex( 0.8,  0.8, 0); quad.texCoord(1, 1);

    nav().pos(0, 0, 2);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.2, 0.2, 0.25);
    tex.bind(0);
    g.texture();
    g.draw(quad);
    tex.unbind(0);
  }
};

ALLOLIB_WEB_MAIN(TextureTestApp)
`

  // Test code for colored texture (red/blue pattern)
  const COLORED_TEXTURE_CODE = `
#include "al_WebApp.hpp"
#include <vector>
using namespace al;

struct ColoredTextureApp : WebApp {
  Texture tex;
  Mesh quad;

  void onCreate() override {
    int size = 64;
    std::vector<uint8_t> pixels(size * size * 4);
    for (int y = 0; y < size; y++) {
      for (int x = 0; x < size; x++) {
        bool isRed = ((x / 16) + (y / 16)) % 2 == 0;
        int i = (y * size + x) * 4;
        pixels[i] = isRed ? 255 : 50;      // R
        pixels[i+1] = 50;                   // G
        pixels[i+2] = isRed ? 50 : 255;    // B
        pixels[i+3] = 255;                  // A
      }
    }
    tex.create2D(size, size, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
    tex.submit(pixels.data());

    quad.primitive(Mesh::TRIANGLE_STRIP);
    quad.vertex(-0.7, -0.7, 0); quad.texCoord(0, 0);
    quad.vertex( 0.7, -0.7, 0); quad.texCoord(1, 0);
    quad.vertex(-0.7,  0.7, 0); quad.texCoord(0, 1);
    quad.vertex( 0.7,  0.7, 0); quad.texCoord(1, 1);

    nav().pos(0, 0, 2);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.1, 0.1, 0.1);
    tex.bind(0);
    g.texture();
    g.draw(quad);
    tex.unbind(0);
  }
};

ALLOLIB_WEB_MAIN(ColoredTextureApp)
`

  // Test code for multiple textures
  const MULTI_TEXTURE_CODE = `
#include "al_WebApp.hpp"
#include <vector>
using namespace al;

struct MultiTextureApp : WebApp {
  Texture tex1, tex2;
  Mesh quad1, quad2;

  void onCreate() override {
    int size = 32;
    std::vector<uint8_t> pixels1(size * size * 4);
    std::vector<uint8_t> pixels2(size * size * 4);

    for (int y = 0; y < size; y++) {
      for (int x = 0; x < size; x++) {
        int i = (y * size + x) * 4;
        // Texture 1: Red gradient
        pixels1[i] = (x * 255) / size;
        pixels1[i+1] = 50;
        pixels1[i+2] = 50;
        pixels1[i+3] = 255;
        // Texture 2: Blue gradient
        pixels2[i] = 50;
        pixels2[i+1] = 50;
        pixels2[i+2] = (y * 255) / size;
        pixels2[i+3] = 255;
      }
    }

    tex1.create2D(size, size, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
    tex1.submit(pixels1.data());
    tex2.create2D(size, size, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
    tex2.submit(pixels2.data());

    // Left quad
    quad1.primitive(Mesh::TRIANGLE_STRIP);
    quad1.vertex(-0.9, -0.6, 0); quad1.texCoord(0, 0);
    quad1.vertex(-0.1, -0.6, 0); quad1.texCoord(1, 0);
    quad1.vertex(-0.9,  0.6, 0); quad1.texCoord(0, 1);
    quad1.vertex(-0.1,  0.6, 0); quad1.texCoord(1, 1);

    // Right quad
    quad2.primitive(Mesh::TRIANGLE_STRIP);
    quad2.vertex(0.1, -0.6, 0); quad2.texCoord(0, 0);
    quad2.vertex(0.9, -0.6, 0); quad2.texCoord(1, 0);
    quad2.vertex(0.1,  0.6, 0); quad2.texCoord(0, 1);
    quad2.vertex(0.9,  0.6, 0); quad2.texCoord(1, 1);

    nav().pos(0, 0, 2);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.15, 0.15, 0.15);

    tex1.bind(0);
    g.texture();
    g.draw(quad1);
    tex1.unbind(0);

    tex2.bind(0);
    g.texture();
    g.draw(quad2);
    tex2.unbind(0);
  }
};

ALLOLIB_WEB_MAIN(MultiTextureApp)
`

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
  })

  test('texture loads and displays correctly (WebGL2)', async ({ page }) => {
    const success = await compileAndRun(page, SIMPLE_TEXTURE_CODE, 'webgl2')
    expect(success, 'Compilation should succeed').toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGL2 Texture Test:', analysis)

    expect(analysis.hasContent, 'Canvas should have content').toBe(true)
    // Checkerboard should have at least 2 distinct colors
    expect(analysis.uniqueColors).toBeGreaterThan(1)
  })

  test('texture loads and displays correctly (WebGPU)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebGPU only in Chromium')

    const webgpuOk = await isWebGPUFunctional(page)
    test.skip(!webgpuOk, 'WebGPU not functional')

    const success = await compileAndRun(page, SIMPLE_TEXTURE_CODE, 'webgpu')
    expect(success, 'Compilation should succeed').toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGPU Texture Test:', analysis)

    expect(analysis.hasContent, 'Canvas should have content').toBe(true)
    expect(analysis.uniqueColors).toBeGreaterThan(1)
  })

  test('UV coordinates map correctly (WebGL2)', async ({ page }) => {
    const success = await compileAndRun(page, COLORED_TEXTURE_CODE, 'webgl2')
    expect(success).toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGL2 UV Test:', analysis)

    // Should see red and blue regions
    expect(analysis.hasContent).toBe(true)
    expect(analysis.uniqueColors).toBeGreaterThan(2)
  })

  test('multiple textures can be bound (WebGL2)', async ({ page }) => {
    const success = await compileAndRun(page, MULTI_TEXTURE_CODE, 'webgl2')
    expect(success).toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGL2 Multi-Texture Test:', analysis)

    expect(analysis.hasContent).toBe(true)
    // Should have red gradient and blue gradient regions
    expect(analysis.uniqueColors).toBeGreaterThan(3)
  })

  test('multiple textures can be bound (WebGPU)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebGPU only in Chromium')

    const webgpuOk = await isWebGPUFunctional(page)
    test.skip(!webgpuOk, 'WebGPU not functional')

    const success = await compileAndRun(page, MULTI_TEXTURE_CODE, 'webgpu')
    expect(success).toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGPU Multi-Texture Test:', analysis)

    expect(analysis.hasContent).toBe(true)
    expect(analysis.uniqueColors).toBeGreaterThan(3)
  })

  test('visual baseline: textured quad', async ({ page }) => {
    const success = await compileAndRun(page, SIMPLE_TEXTURE_CODE, 'webgl2')
    expect(success).toBe(true)

    const screenshot = await captureCanvas(page)
    expect(screenshot).not.toBeNull()

    // Save baseline
    const baselinePath = path.join(BASELINE_DIR, 'webgpu-phase1-texture-quad.png')
    if (process.env.UPDATE_BASELINES === 'true' || !fs.existsSync(baselinePath)) {
      fs.writeFileSync(baselinePath, screenshot!)
      console.log('  Saved baseline:', baselinePath)
    }
  })
})

// ============================================================================
// Phase 2: Full Lighting @webgpu
// ============================================================================

test.describe('WebGPU Phase 2: Lighting @webgpu', () => {
  // Single directional light
  const DIRECTIONAL_LIGHT_CODE = `
#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
using namespace al;

struct DirectionalLightApp : WebApp {
  Mesh sphere;

  void onCreate() override {
    addSphere(sphere, 0.6, 32, 32);
    sphere.generateNormals();
    nav().pos(0, 0, 3);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.1, 0.1, 0.15);

    g.lighting(true);
    g.light(Light().dir(1, 1, 1).diffuse(Color(1, 1, 0.9)));

    g.color(0.8, 0.3, 0.2);
    g.draw(sphere);

    g.lighting(false);
  }
};

ALLOLIB_WEB_MAIN(DirectionalLightApp)
`

  // Single point light
  const POINT_LIGHT_CODE = `
#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
using namespace al;

struct PointLightApp : WebApp {
  Mesh sphere;

  void onCreate() override {
    addSphere(sphere, 0.5, 32, 32);
    sphere.generateNormals();
    nav().pos(0, 0, 3);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.05, 0.05, 0.1);

    g.lighting(true);
    g.light(Light().pos(2, 1, 3).diffuse(Color(1, 0.9, 0.8)));

    g.color(0.2, 0.5, 0.8);
    g.draw(sphere);

    g.lighting(false);
  }
};

ALLOLIB_WEB_MAIN(PointLightApp)
`

  // Multiple lights (3 lights)
  const MULTI_LIGHT_CODE = `
#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
using namespace al;

struct MultiLightApp : WebApp {
  Mesh sphere;
  Light lights[3];

  void onCreate() override {
    addSphere(sphere, 0.5, 32, 32);
    sphere.generateNormals();

    // Red light from left
    lights[0].pos(-2, 0, 2).diffuse(Color(1, 0.2, 0.2)).ambient(Color(0.1, 0, 0));
    // Green light from right
    lights[1].pos(2, 0, 2).diffuse(Color(0.2, 1, 0.2)).ambient(Color(0, 0.1, 0));
    // Blue light from top
    lights[2].pos(0, 2, 2).diffuse(Color(0.2, 0.2, 1)).ambient(Color(0, 0, 0.1));

    nav().pos(0, 0, 3);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.02, 0.02, 0.02);

    g.lighting(true);
    for (int i = 0; i < 3; i++) {
      g.light(lights[i], i);
    }

    g.color(0.9, 0.9, 0.9);
    g.draw(sphere);

    g.lighting(false);
  }
};

ALLOLIB_WEB_MAIN(MultiLightApp)
`

  // Material properties test
  const MATERIAL_CODE = `
#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
using namespace al;

struct MaterialApp : WebApp {
  Mesh sphere;
  Material material;

  void onCreate() override {
    addSphere(sphere, 0.5, 32, 32);
    sphere.generateNormals();

    material.ambient(Color(0.1, 0.1, 0.2));
    material.diffuse(Color(0.6, 0.2, 0.8));
    material.specular(Color(1, 1, 1));
    material.shininess(64);

    nav().pos(0, 0, 3);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.05, 0.05, 0.08);

    g.lighting(true);
    g.light(Light().pos(2, 2, 4).diffuse(Color(1, 1, 1)).specular(Color(1, 1, 1)));
    g.material(material);

    g.draw(sphere);

    g.lighting(false);
  }
};

ALLOLIB_WEB_MAIN(MaterialApp)
`

  // Lighting + Textures combined
  const LIT_TEXTURE_CODE = `
#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <vector>
using namespace al;

struct LitTextureApp : WebApp {
  Mesh sphere;
  Texture tex;

  void onCreate() override {
    addSphere(sphere, 0.5, 32, 32);
    sphere.generateNormals();

    // Generate texture coords for sphere
    auto& texCoords = sphere.texCoord2s();
    auto& verts = sphere.vertices();
    texCoords.clear();
    for (auto& v : verts) {
      float u = 0.5f + atan2(v.z, v.x) / (2 * M_PI);
      float vcoord = 0.5f - asin(v.y) / M_PI;
      texCoords.push_back(Vec2f(u, vcoord));
    }

    // Create striped texture
    int size = 64;
    std::vector<uint8_t> pixels(size * size * 4);
    for (int y = 0; y < size; y++) {
      for (int x = 0; x < size; x++) {
        bool stripe = (x / 4) % 2 == 0;
        int i = (y * size + x) * 4;
        pixels[i] = stripe ? 255 : 100;
        pixels[i+1] = stripe ? 200 : 80;
        pixels[i+2] = stripe ? 150 : 60;
        pixels[i+3] = 255;
      }
    }
    tex.create2D(size, size, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
    tex.submit(pixels.data());

    nav().pos(0, 0, 3);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.1, 0.1, 0.12);

    g.lighting(true);
    g.light(Light().pos(3, 2, 4).diffuse(Color(1, 1, 0.95)));

    tex.bind(0);
    g.texture();
    g.draw(sphere);
    tex.unbind(0);

    g.lighting(false);
  }
};

ALLOLIB_WEB_MAIN(LitTextureApp)
`

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
  })

  test('single directional light (WebGL2)', async ({ page }) => {
    const success = await compileAndRun(page, DIRECTIONAL_LIGHT_CODE, 'webgl2')
    expect(success, 'Compilation should succeed').toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGL2 Directional Light:', analysis)

    expect(analysis.hasContent).toBe(true)
    // Lit sphere should have shading gradients
    expect(analysis.uniqueColors).toBeGreaterThan(3)
  })

  test('single directional light (WebGPU)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebGPU only in Chromium')

    const webgpuOk = await isWebGPUFunctional(page)
    test.skip(!webgpuOk, 'WebGPU not functional')

    const success = await compileAndRun(page, DIRECTIONAL_LIGHT_CODE, 'webgpu')
    expect(success, 'Compilation should succeed').toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGPU Directional Light:', analysis)

    expect(analysis.hasContent).toBe(true)
    expect(analysis.uniqueColors).toBeGreaterThan(3)
  })

  test('single point light (WebGL2)', async ({ page }) => {
    const success = await compileAndRun(page, POINT_LIGHT_CODE, 'webgl2')
    expect(success).toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGL2 Point Light:', analysis)

    expect(analysis.hasContent).toBe(true)
    expect(analysis.uniqueColors).toBeGreaterThan(3)
  })

  test('single point light (WebGPU)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebGPU only in Chromium')

    const webgpuOk = await isWebGPUFunctional(page)
    test.skip(!webgpuOk, 'WebGPU not functional')

    const success = await compileAndRun(page, POINT_LIGHT_CODE, 'webgpu')
    expect(success).toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGPU Point Light:', analysis)

    expect(analysis.hasContent).toBe(true)
    expect(analysis.uniqueColors).toBeGreaterThan(3)
  })

  test('multiple lights - 3 colored lights (WebGL2)', async ({ page }) => {
    const success = await compileAndRun(page, MULTI_LIGHT_CODE, 'webgl2')
    expect(success).toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGL2 Multi-Light:', analysis)

    expect(analysis.hasContent).toBe(true)
    // RGB lights should create color mixing
    expect(analysis.uniqueColors).toBeGreaterThan(5)
  })

  test('multiple lights - 3 colored lights (WebGPU)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebGPU only in Chromium')

    const webgpuOk = await isWebGPUFunctional(page)
    test.skip(!webgpuOk, 'WebGPU not functional')

    const success = await compileAndRun(page, MULTI_LIGHT_CODE, 'webgpu')
    expect(success).toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGPU Multi-Light:', analysis)

    expect(analysis.hasContent).toBe(true)
    expect(analysis.uniqueColors).toBeGreaterThan(5)
  })

  test('material properties (WebGL2)', async ({ page }) => {
    const success = await compileAndRun(page, MATERIAL_CODE, 'webgl2')
    expect(success).toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGL2 Material:', analysis)

    expect(analysis.hasContent).toBe(true)
    // Material with specular should have highlights
    expect(analysis.uniqueColors).toBeGreaterThan(4)
  })

  test('material properties (WebGPU)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebGPU only in Chromium')

    const webgpuOk = await isWebGPUFunctional(page)
    test.skip(!webgpuOk, 'WebGPU not functional')

    const success = await compileAndRun(page, MATERIAL_CODE, 'webgpu')
    expect(success).toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGPU Material:', analysis)

    expect(analysis.hasContent).toBe(true)
    expect(analysis.uniqueColors).toBeGreaterThan(4)
  })

  test('lighting + textures combined (WebGL2)', async ({ page }) => {
    const success = await compileAndRun(page, LIT_TEXTURE_CODE, 'webgl2')
    expect(success).toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGL2 Lit Texture:', analysis)

    expect(analysis.hasContent).toBe(true)
    // Textured + lit should have many color variations
    expect(analysis.uniqueColors).toBeGreaterThan(5)
  })

  test('lighting + textures combined (WebGPU)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebGPU only in Chromium')

    const webgpuOk = await isWebGPUFunctional(page)
    test.skip(!webgpuOk, 'WebGPU not functional')

    const success = await compileAndRun(page, LIT_TEXTURE_CODE, 'webgpu')
    expect(success).toBe(true)

    const analysis = await analyzeCanvas(page)
    console.log('  WebGPU Lit Texture:', analysis)

    expect(analysis.hasContent).toBe(true)
    expect(analysis.uniqueColors).toBeGreaterThan(5)
  })

  test('visual baseline: lit sphere with 3 lights', async ({ page }) => {
    const success = await compileAndRun(page, MULTI_LIGHT_CODE, 'webgl2')
    expect(success).toBe(true)

    const screenshot = await captureCanvas(page)
    expect(screenshot).not.toBeNull()

    // Save baseline
    const baselinePath = path.join(BASELINE_DIR, 'webgpu-phase2-lighting-sphere.png')
    if (process.env.UPDATE_BASELINES === 'true' || !fs.existsSync(baselinePath)) {
      fs.writeFileSync(baselinePath, screenshot!)
      console.log('  Saved baseline:', baselinePath)
    }
  })
})

// ============================================================================
// Cross-Backend Comparison Tests
// ============================================================================

test.describe('WebGL2 vs WebGPU Comparison @webgpu', () => {
  const COMPARISON_CODE = `
#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
using namespace al;

struct ComparisonApp : WebApp {
  Mesh sphere;

  void onCreate() override {
    addSphere(sphere, 0.5, 24, 24);
    sphere.generateNormals();
    nav().pos(0, 0, 3);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.1, 0.1, 0.15);
    g.lighting(true);
    g.light(Light().pos(2, 2, 4).diffuse(Color(1, 0.95, 0.9)));
    g.color(0.7, 0.4, 0.2);
    g.draw(sphere);
    g.lighting(false);
  }
};

ALLOLIB_WEB_MAIN(ComparisonApp)
`

  test('WebGL2 and WebGPU produce similar output', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebGPU only in Chromium')

    // First render with WebGL2
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    const webgl2Success = await compileAndRun(page, COMPARISON_CODE, 'webgl2')
    expect(webgl2Success).toBe(true)

    const webgl2Analysis = await analyzeCanvas(page)
    console.log('  WebGL2:', webgl2Analysis)

    // Check if WebGPU is functional
    const webgpuOk = await isWebGPUFunctional(page)
    if (!webgpuOk) {
      console.log('  WebGPU not functional, skipping comparison')
      return
    }

    // Render with WebGPU
    const webgpuSuccess = await compileAndRun(page, COMPARISON_CODE, 'webgpu')
    expect(webgpuSuccess).toBe(true)

    const webgpuAnalysis = await analyzeCanvas(page)
    console.log('  WebGPU:', webgpuAnalysis)

    // Both should have content
    expect(webgl2Analysis.hasContent).toBe(true)
    expect(webgpuAnalysis.hasContent).toBe(true)

    // Both should have similar color complexity (within reasonable tolerance)
    // Note: WebGL2 and WebGPU may have different shader precision and rendering algorithms,
    // so we allow a wider tolerance. The key is that both produce meaningful, varied output.
    const colorRatio = webgpuAnalysis.uniqueColors / webgl2Analysis.uniqueColors
    console.log(`  Color ratio: ${colorRatio.toFixed(3)} (WebGPU: ${webgpuAnalysis.uniqueColors}, WebGL2: ${webgl2Analysis.uniqueColors})`)
    expect(colorRatio).toBeGreaterThan(0.3)  // Allow 30% minimum
    expect(colorRatio).toBeLessThan(3.0)     // Allow 3x maximum
  })
})
