# Frontend Audit Report

Generated: 2026-04-24 · Audit scope: `frontend/src/**`

Overall grade: **B+** — core architecture is sound, clear optimization runway.

---

## 🏆 Top 10 Highest-Impact Fixes (by benefit/effort)

### Tier 1 — Quick Wins (≤1 day each)

1. **Extract `useResizableDrag` composable** (~2h)
   - `AnalysisPanel.vue`, `ConsolePanel.vue`, `ParameterPanel.vue` all copy-paste identical mouse-drag resize. Extract once, reuse.

2. **Add ESLint config** (~30min)
   - ESLint is installed but there's NO `.eslintrc*` file, so it runs with zero rules. Add `eslint-plugin-vue` + `@typescript-eslint/strict`.

3. **Add `vite-plugin-compression`** (~15min, ~40-50% gzip savings)
   - Bundle drops from ~750KB → ~350-400KB gzipped. Three lines of config.

4. **Fix HTTP error handling in `compiler.ts`** (~20min, real bug)
   - `submitCompilation()`/`getJobStatus()` call `.json()` without checking `response.ok`. 4xx/5xx returns malformed data silently.

5. **WASM string-allocation leaks in `objectManager.ts`** (~1h, real memory leak)
   - Lines 289, 420, 440, 468: `allocString()` without try/finally. Exceptions between alloc/free leak WASM heap.

### Tier 2 — Structural (1–3 days each)

6. **Decompose `Toolbar.vue`** (1-2 days) — 1957 lines, 43 refs. Extract `useToolbarMenus` composable.

7. **Build UI primitives: `IconButton`, `TextButton`, `Dialog`** (1 day) — removes ~200 LOC duplication, enables theming.

8. **Accessibility pass** (1-2 days) — only 2 `aria-*` attributes exist; 40+ icon buttons are unlabeled; no modal focus trap.

9. **Replace `{ deep: true }` watchers with targeted subscriptions** (1 day, 10-20% perf win) — `ToneLattice.vue:908-909`, `ClipTimeline.vue:1341`, `SequencerTimeline.vue:794`.

10. **Migrate persistence to `pinia-plugin-persistedstate`** (1 day) — replaces hand-rolled localStorage + debounced watchers in `project.ts`, `settings.ts`, `sequencer.ts`.

---

## 🔴 Real Bugs (not just improvements)

| # | Location | Bug |
|---|----------|-----|
| B1 | `services/compiler.ts:48-76` | `.json()` called without `response.ok` check — silent failures on HTTP errors |
| B2 | `services/objectManager.ts:289,420,440,468` | WASM string leaks on exception paths (missing try/finally) |
| B3 | `services/websocket.ts:76-86` | `disconnect()` doesn't clear listener Map — accumulates stale listeners on reconnect |
| B4 | `services/parameter-system.ts:413-429` | Polling interval has no try/catch — one throw kills future syncs forever |
| B5 | `composables/useTimelineShortcuts.ts:308-314` | Handler reference mismatch — cleanup silently fails |
| B6 | `services/recorder.ts:107-121` | `setAudioContext()` connects nodes without ever disconnecting — audio graph grows on every stop/start |
| B7 | `services/runtime.ts:898-901` | `destroy()` calls `audioContext.close()` without try/catch — throws if already closed |

---

## 📊 Oversized Files

| File | Lines | Action |
|------|-------|--------|
| `stores/terminal.ts` | 4,503 | Split into shell + commands + scripting. Persist user scripts (lost on reload) |
| `stores/assetLibrary.ts` | 3,776 | Extract 40+ hardcoded assets to `builtInAssets.json` |
| `stores/sequencer.ts` | 2,256 | Split: playback, clips, lattice |
| `components/Toolbar.vue` | 1,957 | See fix #6 |
| `components/AnalysisPanel.vue` | 1,778 | Extract tab logic to composable |
| `components/sequencer/ClipTimeline.vue` | 1,460 | Decompose into renderer, interaction, lane-header |
| `components/sequencer/ToneLattice.vue` | 1,073 | Move canvas logic to `utils/canvasDrawing.ts` |

---

## 🎨 Design/UX Gaps

- **No responsive design <1024px** — 50/50 split breaks on tablets
- **No first-run guidance** — idle state says "Press Run", doesn't hint at Examples
- **No toast notifications** — auto-save, export, errors all go to console
- **Contrast failures** — `text-gray-500` on `#1e1e1e` is 3:1 (AA needs 4.5:1)
- **No loading skeletons** for file explorer, examples, asset library
- **Only 4 CSS variables** — dozens of hardcoded hex values scattered
- **`window as any` casts in 7 files** — breaks TS safety; use `inject()` or namespace

---

## ⚙️ Config/Build Gaps

- No ESLint config (see #2)
- No Prettier
- No Husky pre-commit
- Monaco loads ALL language support (only C++ used) — ~100KB gzip saving via lazy-load
- No bundle analyzer
- No HTML preloads for `main.ts` or fonts
- Outdated deps: `vue@3.4`, `monaco@0.45`, `typescript@5.3`, `vite@5.0`

---

## 💡 Execution Order

**Week 1 (~1 day):** fixes #1-#5 + all 7 bugs (B1-B7)
**Week 2 (~3 days):** #8 accessibility, #9 watchers
**Month 2:** #6-#7 decomposition, #10 persistence plugin, big-store splits

Total remediation: ~40-60 dev hours.
