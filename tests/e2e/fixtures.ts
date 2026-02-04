/**
 * Playwright Test Fixtures with Proper Cleanup
 *
 * Extends the base test with automatic cleanup on failure.
 * Use this instead of importing directly from @playwright/test.
 */

import { test as base, Page, BrowserContext } from '@playwright/test'

/**
 * Custom test fixture that ensures proper cleanup after each test.
 * - Takes screenshot on failure
 * - Closes page and context properly even on errors
 * - Handles timeout scenarios gracefully
 */
export const test = base.extend<{
  autoCleanup: void
}>({
  autoCleanup: [async ({ page, context }, use, testInfo) => {
    // Run the test
    await use()

    // Cleanup after test (runs even on failure)
    try {
      // If test failed, capture additional debug info
      if (testInfo.status !== 'passed') {
        console.log(`[Cleanup] Test "${testInfo.title}" ${testInfo.status}, cleaning up...`)

        // Try to capture final screenshot if not already done
        if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
          try {
            const screenshot = await page.screenshot({ timeout: 5000 })
            await testInfo.attach('cleanup-screenshot', {
              body: screenshot,
              contentType: 'image/png'
            })
          } catch {
            // Screenshot might fail if page is already closed
          }
        }
      }

      // Force close the page
      if (!page.isClosed()) {
        await page.close({ runBeforeUnload: false }).catch(() => {})
      }

      // Force close all pages in context
      for (const p of context.pages()) {
        if (!p.isClosed()) {
          await p.close({ runBeforeUnload: false }).catch(() => {})
        }
      }
    } catch (error) {
      console.log(`[Cleanup] Error during cleanup: ${error}`)
    }
  }, { auto: true }], // auto: true means it runs for every test automatically
})

export { expect } from '@playwright/test'
export type { Page, BrowserContext }

/**
 * Helper to wrap test body with timeout handling
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    clearTimeout(timeoutId!)
    return result
  } catch (error) {
    clearTimeout(timeoutId!)
    throw error
  }
}
