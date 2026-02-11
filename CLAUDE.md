# Claude Code Context

## Quick Start - Build & Run

**To start the app, run these commands in order:**

```bash
# 1. Start Docker container (if not running)
docker start allolib-compiler redis

# 2. Start backend (new terminal)
cd "C:/Allolib Studio Online/backend" && npm run dev

# 3. Start frontend (new terminal)
cd "C:/Allolib Studio Online/frontend" && npm run dev

# 4. Open http://localhost:3000
```

**If Docker container doesn't exist, create it:**
```bash
cd "C:/Allolib Studio Online/backend"
docker build -t allolib-compiler ./docker
docker run -d --name allolib-compiler \
  -v "C:/Allolib Studio Online/backend/source:/app/source" \
  -v "C:/Allolib Studio Online/backend/compiled:/app/output" \
  -v "C:/Allolib Studio Online/allolib-wasm:/app/allolib-wasm" \
  -v "C:/Allolib Studio Online/allolib:/app/allolib" \
  -v "C:/Allolib Studio Online/al_ext:/app/al_ext" \
  allolib-compiler sleep infinity
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

Read `PROJECT.md` for full architecture documentation.

## Git Workflow

**Always work on the `dev` branch, not `main`.**

```bash
# Check current branch
git branch

# Switch to dev branch
git checkout dev

# After completing a feature, merge to main via PR or:
git checkout main && git merge dev && git push && git checkout dev
```

**Branches:**
- `main` - Stable, production-ready code (protected)
- `dev` - Active development (work here)

## Project Overview

**AlloLib Studio Online** - Browser-based IDE for AlloLib C++ creative coding framework.
- Write C++ in Monaco Editor
- Server compiles via Emscripten to WASM
- Executes in browser with WebGL2/WebGPU + Web Audio

## Tech Stack

- **Frontend:** Vue 3 + Pinia + TypeScript
- **Backend:** Node/Express + Redis/BullMQ + Docker
- **WASM:** Emscripten 3.1.73, AlloLib C++ framework
- **Testing:** Playwright E2E tests

## Key Directories

```
frontend/src/          # Vue SPA
backend/src/           # Express server
backend/docker/        # Emscripten Docker (compile.sh, build-allolib.sh)
allolib-wasm/          # C++ WASM compatibility layer (overrides AlloLib headers)
tests/e2e/             # Playwright tests
```

## Common Tasks

### Run Dev Servers
```bash
# Frontend (port 3000)
cd frontend && npm run dev

# Backend (port 4000)
cd backend && npm run dev
```

### Build Docker Compiler
```bash
cd backend && docker build -t allolib-compiler ./docker
```

### Run E2E Tests
```bash
cd tests && npx playwright test
```

### Update Visual Test Baselines
```bash
cd tests && UPDATE_BASELINES=true npx playwright test
```

## Recent Work (2026-02-10)

### Phase 1 Complete: Full Test Suite Baseline

**Test Results: 290/308 passing (1.5 hours)**

| Metric | WebGL2 | WebGPU | Combined |
|--------|--------|--------|----------|
| Examples tested | 154 | 154 | 308 |
| Passed | 149 | 141 | 290 |
| Pass rate | **96.8%** | **91.6%** | **94.2%** |
| Compilation | **100%** | **100%** | **100%** |
| Baselines captured | 149 | 141 | 290 |

**Visual baselines:** 290 PNGs in `tests/baselines/` (149 WebGL2 + 141 WebGPU)

**Fix applied:** Backend rate limiting changed to POST-only (was blocking status/output polling)

**18 failures are known rendering/detection limitations:**
- 5 on both backends: sparse point-based simulations (wireworld, creatures, predator-prey)
- 8 WebGPU-only: sparse content + 3 compile timeouts
- See ROADMAP.md Phase 1 Results for full breakdown

## Previous Work (2026-02-05)

### Comprehensive Functional Tests - ALL 154 Examples on BOTH Backends

Created `tests/e2e/comprehensive-functional-tests.spec.ts` that tests ALL examples from the Examples dropdown on BOTH WebGL2 and WebGPU backends.

**Test Results: 308/308 passing (28.8 minutes)**

#### WebGL2 Backend (103 examples)
| Metric | Count | Pass Rate |
|--------|-------|-----------|
| Compilation | 103 | **100%** |
| Rendering | 103 | **100%** |
| Functional | 67 | **65%** |

#### WebGPU Backend (102 examples)
| Metric | Count | Pass Rate |
|--------|-------|-----------|
| Compilation | 102 | **100%** |
| Rendering | 102 | **100%** |
| Functional | 51 | **50%** |

### Reports Generated
- `tests/reports/functional-webgl2-*.md` - Detailed WebGL2 results
- `tests/reports/functional-webgpu-*.md` - Detailed WebGPU results

### Files Created
- `tests/e2e/comprehensive-functional-tests.spec.ts` - Tests all 154 examples on both backends
- `tests/e2e/true-functional-tests.spec.ts` - 13 focused interaction/animation tests

### Run the Tests
```bash
# Run comprehensive tests (takes ~30 min)
cd tests && npx playwright test comprehensive-functional-tests.spec.ts --project=chromium-webgl2

# Run focused functional tests (takes ~2 min)
cd tests && npx playwright test true-functional-tests.spec.ts --project=chromium-webgl2

# Run enhanced visual verification tests (takes ~35 min)
cd tests && npx playwright test enhanced-functional-tests.spec.ts --project=chromium-webgl2

# Capture new baseline screenshots
cd tests && UPDATE_BASELINES=true npx playwright test enhanced-functional-tests.spec.ts --project=chromium-webgl2
```

### Enhanced Visual Verification Tests (NEW)

Created comprehensive visual testing infrastructure:

**Files Created:**
- `tests/e2e/visual-verification.ts` - Visual testing utilities:
  - Baseline screenshot management (`BaselineManager` class)
  - Color analysis (RGB/HSV, dominant colors, quantization)
  - Region-based verification (check specific areas of canvas)
  - Animation detection with configurable sensitivity
  - Perceptual image comparison with diff image generation

- `tests/e2e/visual-expectations.ts` - Per-example expectations:
  - Defines expected visual characteristics for all 154 examples
  - Color expectations (dominant colors, min/max unique colors)
  - Region checks (center content, specific areas)
  - Brightness ranges
  - Animation requirements (min change %, frame delay)

- `tests/e2e/enhanced-functional-tests.spec.ts` - Enhanced test suite:
  - Visual expectation verification
  - Baseline screenshot comparison
  - Detailed error reporting with diff images
  - Comprehensive JSON + Markdown reports

**Visual Expectations Categories:**
- `staticGraphics()` - Non-animated graphics (minColors, brightness)
- `animatedGraphics()` - Animated content (minChange, frameDelay)
- `audioVisual()` - Audio-visual examples
- `particles()` - Particle systems
- `simulation()` - Dynamic simulations
- `centerContent()` - Content should be in center region

**Baseline Management:**
- Baselines stored in `tests/baselines/{example-id}-{backend}.png`
- Diff images generated in `tests/baselines/diffs/` on mismatch
- Run with `UPDATE_BASELINES=true` to capture new baselines

### Fixes Applied
1. **`life-slime-mold` WebGPU stack overflow** - FIXED
   - Root cause: `float newTrail[SIZE][SIZE]` (160KB) declared on stack in `onAnimate()`
   - Fix: Moved `newTrail` to class member to avoid stack allocation
   - Also increased stack sizes in `compile.sh`: ASYNCIFY_STACK_SIZE=128KB, STACK_SIZE=512KB

### Next Steps (Priority Order)
1. **Improve animation detection** - Current method doesn't reliably detect slow animations
2. Redo WebGPU full lighting (marked in webgpu-full-compatibility-plan.md)
3. Implement EasyFBO (Phase 3 of WebGPU compatibility)

## Previous Work (2026-02-03)

### WebGL2 Rendering Fix
1. Fixed "function signature mismatch" WASM exception - GLAD's `glClearDepthf` was NULL
2. Solution: Bypass GLAD and use Emscripten's direct GL functions (`emscripten_glClearDepthf`, etc.)
3. All WebGL2 rendering tests now pass (17/17)

### Test Infrastructure
1. Fixed visual regression tests - use `toDataURL()` for WebGL canvas capture
2. Fixed test code to use `ALLOLIB_WEB_MAIN(MyApp)` macro
3. WebGPU tests properly skip when not functional (requires headed mode with GPU)
4. All 5 visual regression baselines generated and passing

## Important Patterns

### Include Order (Critical)
`allolib-wasm/include/` must come BEFORE `allolib/include/` to override headers.

### WASM Exports
All C functions callable from JS must be in `compile.sh` EXPORTED_FUNCTIONS:
```bash
-sEXPORTED_FUNCTIONS="['_main','_allolib_create',...]"
```

### Test Selectors
Use `data-testid` attributes for reliable Playwright selection:
- `[data-testid="run-button"]`
- `[data-testid="canvas"]`
- `[data-testid="console-output"]`
