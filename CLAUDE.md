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

## Current State (2026-04-23)

The codebase is stable and comprehensively tested. All major features are complete:

- **WebGPU compatibility**: All 8 phases complete — textures, lighting, EasyFBO, cubemaps/skybox, PBR materials, HDRI/IBL, procedural textures, and LOD all work on both backends
- **Test infrastructure**: 155 examples × 2 backends tested at 100% compile and render pass rate
- **E2E tests**: Comprehensive functional tests, visual verification with baseline comparison, and interaction tests all in place

### Test Suite Summary

| Suite | What it tests | Time |
|-------|--------------|------|
| `comprehensive-functional-tests.spec.ts` | All 155 examples on WebGL2 + WebGPU | ~30 min |
| `true-functional-tests.spec.ts` | 13 interaction/animation examples | ~2 min |
| `enhanced-functional-tests.spec.ts` | Visual expectation + baseline comparison | ~35 min |
| `webgpu-features.spec.ts` | WebGPU Phase 1-8 feature regression | ~5 min |

### Known Open Issues
- Animation detection in headless tests is unreliable for slow animations
- Audio context not created in headless mode (browser policy: requires user gesture)
- Events track keyframes not wired to `EventsStore.addKeyframe/removeKeyframe` (see `timeline.ts:524`)

## Important Patterns

### Parameter Pipeline Overview

**`al::ParameterRegistry::global()`** (in `allolib-wasm/include/al_parameter_registry.hpp`) is the single source of truth for what shows up in the Vue Params panel. Three public APIs feed it — pick whichever matches the parameter's purpose:

- `gui << p` — `WebControlGUI` route (display + Studio panel only).
- `mPresets << p` — `WebPresetHandler` route (display + preset save/load).
- `parameterServer() << p` — `WebParameterServer` route (display + OSC routing).

All three call `ParameterRegistry::global().add(&p)` at registration time; the JS bridge (`al_webgui_*` C exports) reads only from the registry. The `ParameterRegistry::global()` API is **internal** — examples and helpers MUST use one of the three operator paths so the same source compiles unmodified against vanilla AlloLib.

Native source pasted into the editor (`#include "al/ui/al_PresetHandler.hpp"` + bare `PresetHandler mPresets`) is auto-transpiled at compile time (see `frontend/src/stores/app.ts:preprocessForWasm`) so the `#define PresetHandler WebPresetHandler` macro fires and the registry is fed regardless of how the source landed.

The registry clears on `WebApp::~WebApp()` so re-running an example doesn't show ghost parameters from the previous run. See `docs/PARAMETER_PIPELINE_PLAN.md` for the migration history (v0.7.0–v0.7.11) and rationale.

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
