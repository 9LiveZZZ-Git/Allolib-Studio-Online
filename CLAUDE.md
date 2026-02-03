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
# Frontend (port 5173)
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

## Recent Work (2026-02-03)

### WebGL2 Rendering Fix
1. Fixed "function signature mismatch" WASM exception - GLAD's `glClearDepthf` was NULL
2. Solution: Bypass GLAD and use Emscripten's direct GL functions (`emscripten_glClearDepthf`, etc.)
3. All WebGL2 rendering tests now pass (17/17)

### Test Infrastructure
1. Fixed visual regression tests - use `toDataURL()` for WebGL canvas capture
2. Fixed test code to use `ALLOLIB_WEB_MAIN(MyApp)` macro
3. WebGPU tests properly skip when not functional (requires headed mode with GPU)
4. All 5 visual regression baselines generated and passing

### Files Changed
- `allolib-wasm/src/al_OpenGL_Web.cpp` - Bypass GLAD for Emscripten
- `tests/e2e/rendering-tests.spec.ts` - WebGPU skip conditions
- `tests/e2e/visual-regression.spec.ts` - toDataURL capture, correct macros
- `tests/playwright.config.ts` - DXC path, headless:false for WebGPU

### Current Status
- WebGL2 tests: ✅ All passing (17/17)
- WebGPU tests: ✅ Properly skipped when not functional
- Visual regression: ✅ All 5 baselines passing
- Performance: ~8.8s compile time, 60 FPS

### Next Steps
1. Redo WebGPU full lighting (marked in webgpu-full-compatibility-plan.md)
2. Implement EasyFBO (Phase 3 of WebGPU compatibility)

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
