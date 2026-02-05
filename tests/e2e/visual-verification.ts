/**
 * Visual Verification Utilities
 *
 * Provides comprehensive visual testing capabilities:
 * - Baseline screenshot management
 * - Color analysis and dominant color detection
 * - Region-based verification
 * - Animation detection with configurable sensitivity
 * - Perceptual image comparison (SSIM-like)
 */

import { Page, Locator } from '@playwright/test'
import { PNG } from 'pngjs'
import * as fs from 'fs'
import * as path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RGB {
  r: number
  g: number
  b: number
}

export interface HSV {
  h: number  // 0-360
  s: number  // 0-1
  v: number  // 0-1
}

export interface ColorExpectation {
  name: string
  color: RGB
  tolerance: number  // 0-255 per channel
  minPercentage: number  // minimum % of pixels that should match
}

export interface RegionExpectation {
  name: string
  x: number  // 0-1 normalized
  y: number  // 0-1 normalized
  width: number  // 0-1 normalized
  height: number  // 0-1 normalized
  expectation: 'not-black' | 'not-white' | 'has-color' | 'has-variation' | 'specific-color'
  color?: RGB  // for 'specific-color'
  tolerance?: number
}

export interface VisualExpectation {
  // Dominant colors that should be present
  dominantColors?: ColorExpectation[]

  // Specific regions to check
  regions?: RegionExpectation[]

  // Minimum unique color count (quantized to 32-level buckets)
  minUniqueColors?: number

  // Maximum unique color count (to catch noise/artifacts)
  maxUniqueColors?: number

  // Expected brightness range (0-1)
  minBrightness?: number
  maxBrightness?: number

  // Should have non-trivial content
  requiresContent?: boolean

  // Animation expectations
  animation?: {
    expectedMinChange: number  // minimum % change between frames
    expectedMaxChange?: number  // maximum % change (to catch flicker)
    frameDelayMs: number  // delay between captures
    numFrames: number  // number of frames to capture
  }

  // Specific pixel checks
  pixelChecks?: Array<{
    x: number  // 0-1 normalized
    y: number  // 0-1 normalized
    expectedColor: RGB
    tolerance: number
  }>
}

export interface VisualAnalysisResult {
  // Basic metrics
  hasContent: boolean
  uniqueColors: number
  brightness: number

  // Color analysis
  dominantColors: Array<{ color: RGB; percentage: number }>
  colorDistribution: Record<string, number>

  // Region analysis
  regionResults: Array<{
    name: string
    passed: boolean
    details: string
  }>

  // Animation analysis
  animationDetected: boolean
  animationPercentage: number
  frameChanges: number[]

  // Overall
  allExpectationsMet: boolean
  failedExpectations: string[]
  passedExpectations: string[]
}

export interface BaselineCompareResult {
  match: boolean
  similarity: number  // 0-1, 1 = identical
  diffPixelCount: number
  diffPercentage: number
  diffImagePath?: string
}

// ─── Color Utilities ──────────────────────────────────────────────────────────

export function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const diff = max - min

  let h = 0
  if (diff !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / diff) % 6)
    } else if (max === g) {
      h = 60 * ((b - r) / diff + 2)
    } else {
      h = 60 * ((r - g) / diff + 4)
    }
  }
  if (h < 0) h += 360

  const s = max === 0 ? 0 : diff / max
  const v = max

  return { h, s, v }
}

export function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  )
}

export function colorMatches(c1: RGB, c2: RGB, tolerance: number): boolean {
  return Math.abs(c1.r - c2.r) <= tolerance &&
         Math.abs(c1.g - c2.g) <= tolerance &&
         Math.abs(c1.b - c2.b) <= tolerance
}

export function quantizeColor(r: number, g: number, b: number, levels: number = 32): string {
  const qr = Math.floor(r / (256 / levels)) * (256 / levels)
  const qg = Math.floor(g / (256 / levels)) * (256 / levels)
  const qb = Math.floor(b / (256 / levels)) * (256 / levels)
  return `${qr},${qg},${qb}`
}

export function parseQuantizedColor(key: string): RGB {
  const [r, g, b] = key.split(',').map(Number)
  return { r, g, b }
}

// ─── Image Analysis ───────────────────────────────────────────────────────────

export function analyzeImage(imageBuffer: Buffer): {
  width: number
  height: number
  pixels: Uint8Array
  hasContent: boolean
  uniqueColors: number
  brightness: number
  dominantColors: Array<{ color: RGB; percentage: number }>
  colorDistribution: Record<string, number>
} {
  const png = PNG.sync.read(imageBuffer)
  const { data, width, height } = png

  const colorCounts: Record<string, number> = {}
  let nonBlackCount = 0
  let totalBrightness = 0
  const totalPixels = width * height

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Check if non-black
    if (r > 15 || g > 15 || b > 15) {
      nonBlackCount++
    }

    // Accumulate brightness
    totalBrightness += (r + g + b) / 3

    // Quantize and count colors
    const key = quantizeColor(r, g, b)
    colorCounts[key] = (colorCounts[key] || 0) + 1
  }

  // Find dominant colors (sorted by frequency)
  const sortedColors = Object.entries(colorCounts)
    .map(([key, count]) => ({
      color: parseQuantizedColor(key),
      percentage: (count / totalPixels) * 100
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 10)

  return {
    width,
    height,
    pixels: data,
    hasContent: nonBlackCount > totalPixels * 0.01,
    uniqueColors: Object.keys(colorCounts).length,
    brightness: totalBrightness / totalPixels / 255,
    dominantColors: sortedColors,
    colorDistribution: colorCounts
  }
}

export function analyzeRegion(
  imageBuffer: Buffer,
  region: RegionExpectation
): { passed: boolean; details: string } {
  const png = PNG.sync.read(imageBuffer)
  const { data, width, height } = png

  // Convert normalized coordinates to pixels
  const startX = Math.floor(region.x * width)
  const startY = Math.floor(region.y * height)
  const regionWidth = Math.floor(region.width * width)
  const regionHeight = Math.floor(region.height * height)

  let nonBlackCount = 0
  let nonWhiteCount = 0
  let hasVariation = false
  let firstColor: RGB | null = null
  let colorMatchCount = 0
  let totalPixels = 0

  for (let y = startY; y < startY + regionHeight && y < height; y++) {
    for (let x = startX; x < startX + regionWidth && x < width; x++) {
      const idx = (y * width + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]

      totalPixels++

      if (r > 15 || g > 15 || b > 15) nonBlackCount++
      if (r < 240 || g < 240 || b < 240) nonWhiteCount++

      if (firstColor === null) {
        firstColor = { r, g, b }
      } else if (!hasVariation) {
        if (Math.abs(r - firstColor.r) > 10 ||
            Math.abs(g - firstColor.g) > 10 ||
            Math.abs(b - firstColor.b) > 10) {
          hasVariation = true
        }
      }

      if (region.color && region.tolerance !== undefined) {
        if (colorMatches({ r, g, b }, region.color, region.tolerance)) {
          colorMatchCount++
        }
      }
    }
  }

  const nonBlackPct = (nonBlackCount / totalPixels) * 100
  const nonWhitePct = (nonWhiteCount / totalPixels) * 100
  const colorMatchPct = (colorMatchCount / totalPixels) * 100

  switch (region.expectation) {
    case 'not-black':
      return {
        passed: nonBlackPct > 10,
        details: `${nonBlackPct.toFixed(1)}% non-black pixels`
      }
    case 'not-white':
      return {
        passed: nonWhitePct > 10,
        details: `${nonWhitePct.toFixed(1)}% non-white pixels`
      }
    case 'has-color':
      return {
        passed: nonBlackPct > 5 && nonWhitePct > 5,
        details: `Has color content (${nonBlackPct.toFixed(1)}% non-black)`
      }
    case 'has-variation':
      return {
        passed: hasVariation,
        details: hasVariation ? 'Color variation detected' : 'No color variation'
      }
    case 'specific-color':
      return {
        passed: colorMatchPct > 50,
        details: `${colorMatchPct.toFixed(1)}% pixels match expected color`
      }
    default:
      return { passed: true, details: 'Unknown expectation' }
  }
}

// ─── Animation Detection ──────────────────────────────────────────────────────

export function compareImages(img1: Buffer, img2: Buffer, threshold: number = 10): {
  diffPercentage: number
  diffPixelCount: number
} {
  const png1 = PNG.sync.read(img1)
  const png2 = PNG.sync.read(img2)

  if (png1.width !== png2.width || png1.height !== png2.height) {
    return { diffPercentage: 100, diffPixelCount: -1 }
  }

  const totalPixels = png1.width * png1.height
  let diffCount = 0

  for (let i = 0; i < png1.data.length; i += 4) {
    const dr = Math.abs(png1.data[i] - png2.data[i])
    const dg = Math.abs(png1.data[i + 1] - png2.data[i + 1])
    const db = Math.abs(png1.data[i + 2] - png2.data[i + 2])

    if (dr > threshold || dg > threshold || db > threshold) {
      diffCount++
    }
  }

  return {
    diffPercentage: (diffCount / totalPixels) * 100,
    diffPixelCount: diffCount
  }
}

export function createDiffImage(img1: Buffer, img2: Buffer, threshold: number = 10): Buffer {
  const png1 = PNG.sync.read(img1)
  const png2 = PNG.sync.read(img2)

  const diffPng = new PNG({ width: png1.width, height: png1.height })

  for (let i = 0; i < png1.data.length; i += 4) {
    const dr = Math.abs(png1.data[i] - png2.data[i])
    const dg = Math.abs(png1.data[i + 1] - png2.data[i + 1])
    const db = Math.abs(png1.data[i + 2] - png2.data[i + 2])

    if (dr > threshold || dg > threshold || db > threshold) {
      // Highlight differences in red
      diffPng.data[i] = 255
      diffPng.data[i + 1] = 0
      diffPng.data[i + 2] = 0
      diffPng.data[i + 3] = 255
    } else {
      // Keep original but dimmed
      diffPng.data[i] = Math.floor(png1.data[i] * 0.3)
      diffPng.data[i + 1] = Math.floor(png1.data[i + 1] * 0.3)
      diffPng.data[i + 2] = Math.floor(png1.data[i + 2] * 0.3)
      diffPng.data[i + 3] = 255
    }
  }

  return PNG.sync.write(diffPng)
}

// ─── Baseline Management ──────────────────────────────────────────────────────

export class BaselineManager {
  private baselineDir: string
  private diffDir: string

  constructor(baseDir: string = path.join(__dirname, '..', 'baselines')) {
    this.baselineDir = baseDir
    this.diffDir = path.join(baseDir, 'diffs')

    if (!fs.existsSync(this.baselineDir)) {
      fs.mkdirSync(this.baselineDir, { recursive: true })
    }
    if (!fs.existsSync(this.diffDir)) {
      fs.mkdirSync(this.diffDir, { recursive: true })
    }
  }

  getBaselinePath(exampleId: string, backend: string): string {
    return path.join(this.baselineDir, `${exampleId}-${backend}.png`)
  }

  hasBaseline(exampleId: string, backend: string): boolean {
    return fs.existsSync(this.getBaselinePath(exampleId, backend))
  }

  saveBaseline(exampleId: string, backend: string, imageBuffer: Buffer): void {
    const filepath = this.getBaselinePath(exampleId, backend)
    fs.writeFileSync(filepath, imageBuffer)
  }

  loadBaseline(exampleId: string, backend: string): Buffer | null {
    const filepath = this.getBaselinePath(exampleId, backend)
    if (!fs.existsSync(filepath)) return null
    return fs.readFileSync(filepath)
  }

  compareWithBaseline(
    exampleId: string,
    backend: string,
    currentImage: Buffer,
    tolerance: number = 5
  ): BaselineCompareResult {
    const baseline = this.loadBaseline(exampleId, backend)

    if (!baseline) {
      return {
        match: false,
        similarity: 0,
        diffPixelCount: -1,
        diffPercentage: 100
      }
    }

    const { diffPercentage, diffPixelCount } = compareImages(baseline, currentImage, tolerance)

    // If there are significant differences, save a diff image
    let diffImagePath: string | undefined
    if (diffPercentage > 1) {
      const diffImage = createDiffImage(baseline, currentImage, tolerance)
      diffImagePath = path.join(this.diffDir, `${exampleId}-${backend}-diff.png`)
      fs.writeFileSync(diffImagePath, diffImage)

      // Also save the current image for comparison
      const currentPath = path.join(this.diffDir, `${exampleId}-${backend}-current.png`)
      fs.writeFileSync(currentPath, currentImage)
    }

    return {
      match: diffPercentage < 1,  // Less than 1% different is a match
      similarity: 1 - (diffPercentage / 100),
      diffPixelCount,
      diffPercentage,
      diffImagePath
    }
  }

  updateBaseline(exampleId: string, backend: string, imageBuffer: Buffer): void {
    this.saveBaseline(exampleId, backend, imageBuffer)

    // Clean up any diff images
    const diffPath = path.join(this.diffDir, `${exampleId}-${backend}-diff.png`)
    const currentPath = path.join(this.diffDir, `${exampleId}-${backend}-current.png`)
    if (fs.existsSync(diffPath)) fs.unlinkSync(diffPath)
    if (fs.existsSync(currentPath)) fs.unlinkSync(currentPath)
  }

  listBaselines(): Array<{ exampleId: string; backend: string; path: string }> {
    const files = fs.readdirSync(this.baselineDir)
    return files
      .filter(f => f.endsWith('.png'))
      .map(f => {
        const match = f.match(/^(.+)-(webgl2|webgpu)\.png$/)
        if (match) {
          return {
            exampleId: match[1],
            backend: match[2],
            path: path.join(this.baselineDir, f)
          }
        }
        return null
      })
      .filter((x): x is { exampleId: string; backend: string; path: string } => x !== null)
  }
}

// ─── Canvas Capture ───────────────────────────────────────────────────────────

export async function captureCanvas(page: Page): Promise<Buffer> {
  const canvasLocator = page.locator('[data-testid="canvas"], #canvas, canvas').first()
  return await canvasLocator.screenshot({ type: 'png' })
}

export async function captureMultipleFrames(
  page: Page,
  numFrames: number,
  delayMs: number
): Promise<Buffer[]> {
  const frames: Buffer[] = []
  const canvasLocator = page.locator('[data-testid="canvas"], #canvas, canvas').first()

  for (let i = 0; i < numFrames; i++) {
    frames.push(await canvasLocator.screenshot({ type: 'png' }))
    if (i < numFrames - 1) {
      await page.waitForTimeout(delayMs)
    }
  }

  return frames
}

// ─── Full Visual Analysis ─────────────────────────────────────────────────────

export async function performVisualAnalysis(
  page: Page,
  expectations: VisualExpectation
): Promise<VisualAnalysisResult> {
  const result: VisualAnalysisResult = {
    hasContent: false,
    uniqueColors: 0,
    brightness: 0,
    dominantColors: [],
    colorDistribution: {},
    regionResults: [],
    animationDetected: false,
    animationPercentage: 0,
    frameChanges: [],
    allExpectationsMet: true,
    failedExpectations: [],
    passedExpectations: []
  }

  // Capture initial frame
  const imageBuffer = await captureCanvas(page)
  const analysis = analyzeImage(imageBuffer)

  result.hasContent = analysis.hasContent
  result.uniqueColors = analysis.uniqueColors
  result.brightness = analysis.brightness
  result.dominantColors = analysis.dominantColors
  result.colorDistribution = analysis.colorDistribution

  // Check content requirement
  if (expectations.requiresContent !== false) {
    if (analysis.hasContent) {
      result.passedExpectations.push('Has visible content')
    } else {
      result.failedExpectations.push('No visible content rendered')
      result.allExpectationsMet = false
    }
  }

  // Check unique colors
  if (expectations.minUniqueColors !== undefined) {
    if (analysis.uniqueColors >= expectations.minUniqueColors) {
      result.passedExpectations.push(`Unique colors (${analysis.uniqueColors}) >= ${expectations.minUniqueColors}`)
    } else {
      result.failedExpectations.push(`Unique colors (${analysis.uniqueColors}) < ${expectations.minUniqueColors}`)
      result.allExpectationsMet = false
    }
  }

  if (expectations.maxUniqueColors !== undefined) {
    if (analysis.uniqueColors <= expectations.maxUniqueColors) {
      result.passedExpectations.push(`Unique colors (${analysis.uniqueColors}) <= ${expectations.maxUniqueColors}`)
    } else {
      result.failedExpectations.push(`Unique colors (${analysis.uniqueColors}) > ${expectations.maxUniqueColors}`)
      result.allExpectationsMet = false
    }
  }

  // Check brightness
  if (expectations.minBrightness !== undefined) {
    if (analysis.brightness >= expectations.minBrightness) {
      result.passedExpectations.push(`Brightness (${analysis.brightness.toFixed(2)}) >= ${expectations.minBrightness}`)
    } else {
      result.failedExpectations.push(`Brightness (${analysis.brightness.toFixed(2)}) < ${expectations.minBrightness}`)
      result.allExpectationsMet = false
    }
  }

  if (expectations.maxBrightness !== undefined) {
    if (analysis.brightness <= expectations.maxBrightness) {
      result.passedExpectations.push(`Brightness (${analysis.brightness.toFixed(2)}) <= ${expectations.maxBrightness}`)
    } else {
      result.failedExpectations.push(`Brightness (${analysis.brightness.toFixed(2)}) > ${expectations.maxBrightness}`)
      result.allExpectationsMet = false
    }
  }

  // Check dominant colors
  if (expectations.dominantColors) {
    for (const colorExp of expectations.dominantColors) {
      const found = analysis.dominantColors.some(dc => {
        const matches = colorMatches(dc.color, colorExp.color, colorExp.tolerance)
        return matches && dc.percentage >= colorExp.minPercentage
      })

      if (found) {
        result.passedExpectations.push(`Found expected color: ${colorExp.name}`)
      } else {
        result.failedExpectations.push(`Missing expected color: ${colorExp.name}`)
        result.allExpectationsMet = false
      }
    }
  }

  // Check regions
  if (expectations.regions) {
    for (const region of expectations.regions) {
      const regionResult = analyzeRegion(imageBuffer, region)
      result.regionResults.push({
        name: region.name,
        passed: regionResult.passed,
        details: regionResult.details
      })

      if (regionResult.passed) {
        result.passedExpectations.push(`Region "${region.name}": ${regionResult.details}`)
      } else {
        result.failedExpectations.push(`Region "${region.name}": ${regionResult.details}`)
        result.allExpectationsMet = false
      }
    }
  }

  // Check pixel checks
  if (expectations.pixelChecks) {
    const png = PNG.sync.read(imageBuffer)
    for (const check of expectations.pixelChecks) {
      const x = Math.floor(check.x * png.width)
      const y = Math.floor(check.y * png.height)
      const idx = (y * png.width + x) * 4

      const pixelColor: RGB = {
        r: png.data[idx],
        g: png.data[idx + 1],
        b: png.data[idx + 2]
      }

      if (colorMatches(pixelColor, check.expectedColor, check.tolerance)) {
        result.passedExpectations.push(`Pixel at (${check.x}, ${check.y}) matches expected color`)
      } else {
        result.failedExpectations.push(
          `Pixel at (${check.x}, ${check.y}): expected RGB(${check.expectedColor.r},${check.expectedColor.g},${check.expectedColor.b}), ` +
          `got RGB(${pixelColor.r},${pixelColor.g},${pixelColor.b})`
        )
        result.allExpectationsMet = false
      }
    }
  }

  // Check animation
  if (expectations.animation) {
    const frames = await captureMultipleFrames(
      page,
      expectations.animation.numFrames,
      expectations.animation.frameDelayMs
    )

    const changes: number[] = []
    for (let i = 1; i < frames.length; i++) {
      const { diffPercentage } = compareImages(frames[i - 1], frames[i])
      changes.push(diffPercentage)
    }

    result.frameChanges = changes
    result.animationPercentage = changes.reduce((a, b) => a + b, 0) / changes.length
    result.animationDetected = result.animationPercentage > 0.1

    if (result.animationPercentage >= expectations.animation.expectedMinChange) {
      result.passedExpectations.push(
        `Animation detected: ${result.animationPercentage.toFixed(2)}% avg change >= ${expectations.animation.expectedMinChange}%`
      )
    } else {
      result.failedExpectations.push(
        `Animation not detected: ${result.animationPercentage.toFixed(2)}% avg change < ${expectations.animation.expectedMinChange}%`
      )
      result.allExpectationsMet = false
    }

    if (expectations.animation.expectedMaxChange !== undefined) {
      if (result.animationPercentage <= expectations.animation.expectedMaxChange) {
        result.passedExpectations.push(
          `Animation stable: ${result.animationPercentage.toFixed(2)}% <= ${expectations.animation.expectedMaxChange}%`
        )
      } else {
        result.failedExpectations.push(
          `Animation too unstable: ${result.animationPercentage.toFixed(2)}% > ${expectations.animation.expectedMaxChange}%`
        )
        result.allExpectationsMet = false
      }
    }
  }

  return result
}
