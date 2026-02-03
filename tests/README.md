# AlloLib Studio Online - Test Suite

Comprehensive testing infrastructure for the WebGL2 and WebGPU rendering pipelines.

## Overview

This test suite provides:

- **E2E Browser Tests** - Playwright-based tests that run in real browsers with GPU
- **Example Compatibility Tests** - Tests ALL 150+ examples on both backends
- **Visual Regression Tests** - Screenshot comparison for rendering accuracy
- **Compilation Tests** - Verify C++ to WASM compilation pipeline
- **Error Tracking** - Automatic categorization and reporting of failures
- **CI/CD Integration** - GitHub Actions workflows for automated testing

## Quick Start

### Install Dependencies

```bash
cd tests
npm install
npx playwright install chromium firefox --with-deps
```

### Run Tests Locally

```bash
# Run all tests (starts dev servers automatically)
npm test

# Run WebGL2 tests only
npm run test:webgl2

# Run WebGPU tests only
npm run test:webgpu

# Run in headed mode (see the browser)
npm run test:headed

# Interactive debug mode
npm run test:debug

# Playwright UI mode
npm run test:ui
```

## Example Compatibility Testing

Test ALL 150+ examples in the library:

```bash
# Test all examples on WebGL2 (recommended first)
npm run test:examples:webgl2

# Test all examples on WebGPU
npm run test:examples:webgpu

# Test on both backends
npm run test:examples:both

# Filter by category or name
npx ts-node scripts/test-all-examples.ts --backend webgl2 --filter "particle"

# Skip specific examples
npx ts-node scripts/test-all-examples.ts --backend webgl2 --skip "heavy-example,slow-example"

# Continue from a specific example (useful after interruption)
npx ts-node scripts/test-all-examples.ts --backend webgl2 --continue "example-id"
```

### Example Test Reports

Reports are saved to `test-results/examples/`:

- `webgl2-compatibility.json` - Machine-readable results
- `webgl2-compatibility.md` - Human-readable report with:
  - Pass/fail summary
  - Failures grouped by category
  - Suggested fixes for each error type
  - Screenshots of each example

### Failure Categories

The test system automatically categorizes failures:

| Category | Description | Suggested Fix |
|----------|-------------|---------------|
| Gamma DSP | Missing Gamma library symbols | Ensure Gamma is linked |
| Asset Loading | Texture/image load failures | Use web-compatible asset loading |
| Mesh Loading | OBJ/model file not found | Bundle assets with build |
| Shader Error | GLSL compilation failed | Check WebGL2 GLSL compatibility |
| WebGPU Error | WGSL or pipeline failure | WGSL syntax differs from GLSL |
| Audio Error | Audio context issues | Add user interaction handler |
| Memory Error | Allocation failures | Reduce resource usage |
| Timeout | Compilation exceeded limit | Check for infinite loops |

### Local Test Runner with Dashboard

```bash
# Run with live error tracking dashboard
npm run test:local -- --dashboard

# Watch mode - re-runs on file changes
npm run test:local -- --watch --dashboard

# Test specific backend
npm run test:local -- --backend webgpu --headed
```

### Compilation Tests (No Browser Required)

```bash
# Test the C++ compilation pipeline
npm run test:compilation
```

## Test Structure

```
tests/
├── e2e/
│   ├── rendering-tests.spec.ts      # Main rendering tests
│   ├── visual-regression.spec.ts    # Screenshot comparison tests
│   └── example-compatibility.spec.ts # Playwright example tests
├── reporters/
│   └── error-tracker.ts             # Custom error categorization
├── scripts/
│   ├── local-test-runner.ts         # Interactive test runner with dashboard
│   ├── test-all-examples.ts         # Comprehensive example tester
│   ├── test-compilation.ts          # Compilation pipeline tests
│   └── combine-reports.js           # Merge CI results
├── screenshots/
│   ├── baseline/                    # Reference screenshots
│   ├── actual/                      # Current run screenshots
│   └── diff/                        # Visual differences
├── test-results/
│   └── examples/                    # Example compatibility reports
│       ├── webgl2-compatibility.md  # Human-readable report
│       ├── webgl2-compatibility.json # Machine-readable data
│       └── screenshots/             # Example screenshots
├── playwright.config.ts             # Playwright configuration
├── package.json
└── README.md
```

## Sample Report Output

After running example tests, you get reports like:

```markdown
# WEBGL2 Example Compatibility Report

**Generated:** 2024-01-15T10:30:00Z
**Duration:** 45.2 minutes

## Summary
| Metric | Value |
|--------|-------|
| Total | 156 |
| ✅ Passed | 142 |
| ❌ Failed | 10 |
| ⏱️ Timeout | 4 |
| **Pass Rate** | **91.0%** |

## Failure Analysis
| Category | Count | Suggested Fix |
|----------|-------|---------------|
| Shader Error | 5 | Check GLSL syntax for WebGL2 |
| Asset Loading | 3 | Use web-compatible asset loading |
| Gamma DSP | 2 | Ensure Gamma library is linked |
```

## Test Categories

### Rendering Tests (`e2e/rendering-tests.spec.ts`)

Tests the full rendering pipeline:

| Test | Description |
|------|-------------|
| Simple Sphere | Basic mesh with lighting |
| Mesh Colors | Per-vertex color rendering |
| Textures | Texture mapping and sampling |
| Error Handling | Shader/runtime error capture |

### Visual Regression Tests (`e2e/visual-regression.spec.ts`)

Compares rendered output against baseline screenshots:

```bash
# Run visual tests
npx playwright test visual-regression

# Update baselines (when changes are intentional)
UPDATE_BASELINES=true npx playwright test visual-regression
```

### Compilation Tests (`scripts/test-compilation.ts`)

Tests without browser:
- Valid code compilation
- Syntax error detection
- Type error detection
- Link error detection

## Error Tracking

The test suite automatically categorizes errors:

| Category | Description |
|----------|-------------|
| `webgl` | WebGL context, shader, or rendering errors |
| `webgpu` | WebGPU device, pipeline, or surface errors |
| `compile` | C++ compilation or WASM build errors |
| `runtime` | JavaScript/WASM runtime exceptions |
| `network` | API or fetch failures |
| `assertion` | Test assertion failures |

Error reports are saved to:
- `test-results/error-report.json` - Machine-readable
- `test-results/error-report.md` - Human-readable

## CI/CD Pipeline

The GitHub Actions workflow runs on every push and PR:

```yaml
# Triggers
- Push to main, develop, feature/*
- Pull requests to main, develop
- Manual dispatch with backend selection

# Jobs
1. Build - Compile frontend/backend
2. WebGL2 Tests - Chromium + Firefox
3. WebGPU Tests - Chromium with WebGPU flags
4. Compilation Tests - WASM build verification
5. Report Generation - Combined summary
```

### Manual Trigger

1. Go to Actions > Rendering Pipeline Tests
2. Click "Run workflow"
3. Select backend (both/webgl2/webgpu)
4. Enable debug mode if needed

### Artifacts

Each run produces:
- `webgl2-test-results` - WebGL2 test output
- `webgpu-test-results` - WebGPU test output
- `compilation-results` - Compilation test output
- `combined-test-report` - Merged summary

## GitHub Actions Setup

### What You Need to Do

**For public repositories:** Nothing! GitHub Actions is enabled by default.

**For private repositories:**
1. Go to your repo on GitHub
2. Click **Settings** > **Actions** > **General**
3. Under "Actions permissions", select "Allow all actions"
4. Click **Save**

### Available Workflows

| Workflow | File | Triggers |
|----------|------|----------|
| Rendering Tests | `rendering-tests.yml` | Push, PR, Manual |
| Example Compatibility | `example-compatibility.yml` | Weekly, Manual, Push to examples |

### Running Workflows Manually

1. Go to your repo on GitHub
2. Click **Actions** tab
3. Select the workflow from the left sidebar
4. Click **Run workflow** (dropdown on right)
5. Configure options and click the green **Run workflow** button

### Workflow Outputs

After a workflow completes:
1. Click on the workflow run
2. Scroll to **Artifacts** section at the bottom
3. Download the reports (JSON, Markdown, screenshots)

### Example Compatibility Workflow

The `example-compatibility.yml` workflow:
- **Runs weekly** on Sunday at 2 AM UTC
- **Tests ALL 150+ examples** on both WebGL2 and WebGPU
- **Generates detailed reports** with failure analysis
- **Creates an issue** if failures are detected

To run manually:
1. Actions > Example Compatibility > Run workflow
2. Choose backend: `both`, `webgl2`, or `webgpu`
3. Optionally filter examples by regex
4. Click Run workflow

### Viewing Results

Reports are available as workflow artifacts:
- `webgl2-example-report/` - WebGL2 compatibility report
- `webgpu-example-report/` - WebGPU compatibility report
- `example-compatibility-report/` - Combined summary

The workflow also posts a summary to the GitHub Actions job page.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TEST_URL` | Frontend URL | `http://localhost:5173` |
| `BACKEND_URL` | Compiler API URL | `http://localhost:4000` |
| `UPDATE_BASELINES` | Update visual baselines | `false` |
| `CI` | Running in CI environment | Auto-detected |

### Playwright Config Options

Edit `playwright.config.ts` to adjust:

- `timeout` - Global test timeout (default: 2 minutes)
- `retries` - Retry failed tests in CI
- `workers` - Parallel test execution
- Browser launch args for GPU access

## Troubleshooting

### Tests Time Out

```bash
# Increase timeout
npx playwright test --timeout 180000

# Check if servers are running
curl http://localhost:5173
curl http://localhost:4000/health
```

### WebGPU Not Available

WebGPU requires:
- Chrome/Edge 113+ or Safari 17+
- GPU hardware or software rendering
- No conflicting WebGL context on canvas

```bash
# Check WebGPU in browser console
navigator.gpu?.requestAdapter()
```

### Canvas Shows Black

Common causes:
1. WebGL context not initialized
2. Shader compilation failed
3. Wrong canvas element selected

Check browser console for `[Graphics]` and `[WebGPUBackend]` logs.

### Visual Diff Failures

```bash
# View the differences
ls tests/screenshots/diff/

# Update baselines if changes are intentional
UPDATE_BASELINES=true npm run test
```

## Adding New Tests

### New Rendering Test

```typescript
// In e2e/rendering-tests.spec.ts

const MY_TEST_CODE = `
#include "al/app/al_App.hpp"
struct MyApp : al::App {
  void onDraw(al::Graphics& g) override {
    g.clear(0.1);
    // Your rendering code
  }
};
int main() { MyApp().start(); }
`

test('my new rendering test', async ({ page }) => {
  const result = await compileAndRun(page, MY_TEST_CODE, 'webgl2')

  expect(result.success).toBe(true)
  expect(result.canvasPixels?.hasContent).toBe(true)
})
```

### New Visual Test

Add to `visualTestCases` array in `visual-regression.spec.ts`:

```typescript
{
  name: 'my-visual-test',
  description: 'Description of expected output',
  code: `...`,
}
```

Then run:
```bash
UPDATE_BASELINES=true npx playwright test visual-regression --grep "my-visual-test"
```

## Contributing

1. Add tests for new features
2. Update baselines when visuals change intentionally
3. Keep compilation tests passing
4. Document any new test patterns
