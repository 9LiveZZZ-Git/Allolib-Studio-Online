/**
 * Playwright Configuration for AlloLib Studio Online
 *
 * Configures browser testing with GPU support for WebGL2/WebGPU testing.
 */

import { defineConfig, devices } from '@playwright/test'
import path from 'path'

// DXC (DirectX Shader Compiler) path for WebGPU support on Windows
const dxcBinPath = path.resolve(__dirname, '../bin')

export default defineConfig({
  testDir: './e2e',
  // Enable parallel execution - each test gets its own browser context
  // GPU tests can run in parallel as long as each has its own context
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Use 2-3 workers for parallel execution
  // Set WORKERS env var to override (e.g., WORKERS=1 for debugging)
  workers: process.env.WORKERS ? parseInt(process.env.WORKERS) : (process.env.CI ? 2 : 3),
  reporter: [
    ['html', { outputFolder: '../test-results/html-report' }],
    ['json', { outputFile: '../test-results/results.json' }],
    ['list'],
    // Custom reporter for error tracking
    ['./reporters/error-tracker.ts']
  ],
  outputDir: '../test-results/artifacts',

  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on-first-retry',

    // Browser context options for GPU access
    contextOptions: {
      // Allow WebGL/WebGPU
      permissions: [],
    },

    // Ensure proper cleanup on test failure
    actionTimeout: 30000,
  },

  // Global timeout
  timeout: 120000, // 2 minutes per test (compilation takes time)

  // Global setup/teardown for cleanup
  globalTeardown: './global-teardown.ts',
  expect: {
    timeout: 30000,
  },

  projects: [
    {
      name: 'chromium-webgl2',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-webgl2-compute-context',
            '--use-gl=angle',
            '--use-angle=default',
            '--enable-features=Vulkan',
            '--ignore-gpu-blocklist',
            '--disable-gpu-sandbox',
            '--enable-gpu-rasterization',
            '--disable-software-rasterizer',
          ],
          // Add DXC to PATH for WebGPU shader compilation
          env: {
            ...process.env,
            PATH: `${dxcBinPath};${process.env.PATH}`,
          },
        },
      },
    },
    {
      name: 'chromium-webgpu',
      use: {
        ...devices['Desktop Chrome'],
        // WebGPU requires headed mode (real GPU context)
        headless: false,
        launchOptions: {
          args: [
            '--enable-unsafe-webgpu',
            '--enable-features=WebGPU',
            '--ignore-gpu-blocklist',
            '--disable-gpu-sandbox',
            '--disable-features=SharedImageSwapChainFactory',
            '--use-gl=angle',
            '--use-angle=d3d11',
          ],
          // Add DXC to PATH for WebGPU shader compilation
          env: {
            ...process.env,
            PATH: `${dxcBinPath};${process.env.PATH}`,
          },
        },
      },
    },
    {
      name: 'firefox-webgl2',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'webgl.force-enabled': true,
            'webgl.disabled': false,
          },
        },
      },
    },
    {
      name: 'webkit-webgl2',
      use: {
        ...devices['Desktop Safari'],
      },
    },
  ],

  // Start local dev server before tests
  // Set SKIP_WEBSERVER=1 to use existing servers
  webServer: process.env.SKIP_WEBSERVER ? undefined : [
    {
      command: 'npm run dev',
      cwd: '../frontend',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: 'npm run dev',
      cwd: '../backend',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
})
