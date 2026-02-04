/**
 * Global Teardown for Playwright Tests
 *
 * Ensures all browser processes are cleaned up after test runs,
 * especially important when tests fail with errors in headed mode.
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function globalTeardown() {
  console.log('\n[Global Teardown] Cleaning up browser processes...')

  try {
    // Kill any lingering Chromium processes on Windows
    if (process.platform === 'win32') {
      // Kill chromium processes that might be left over from Playwright
      await execAsync('taskkill /F /IM "chromium.exe" /T 2>nul').catch(() => {})
      await execAsync('taskkill /F /IM "chrome.exe" /FI "WINDOWTITLE eq *Playwright*" /T 2>nul').catch(() => {})
    } else {
      // Unix-like systems
      await execAsync('pkill -f "chromium.*--test-type" 2>/dev/null').catch(() => {})
      await execAsync('pkill -f "chrome.*--test-type" 2>/dev/null').catch(() => {})
    }

    console.log('[Global Teardown] Cleanup complete')
  } catch (error) {
    // Ignore errors - processes may not exist
    console.log('[Global Teardown] Cleanup finished (some processes may not have existed)')
  }
}

export default globalTeardown
