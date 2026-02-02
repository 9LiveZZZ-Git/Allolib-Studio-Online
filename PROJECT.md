<!-- After any significant coding session, run:
     "Update PROJECT.md to reflect the changes we just made,
      only referencing git-tracked files." -->

# PROJECT.md - AlloLib Studio Online

## Layer 0: Summary

Browser-based creative coding IDE for AlloLib C++ framework. Users write C++ in Monaco Editor, server compiles via Emscripten to WASM, executes in browser with WebGL2/WebGPU graphics + Web Audio. Features: multi-file projects, polyphonic synth system, clip-based sequencer with tone lattice, parameter GUI, PBR materials, HDR environments, video recording. Stack: Vue 3 + Pinia frontend, Node/Express + Redis/BullMQ backend, Docker-containerized Emscripten compiler. Targets modern browsers (Chrome/Edge/Firefox/Safari). Desktop app via Electron.

---

## Layer 1: Architecture Map

### Directory Tree (git-tracked, depth 2)
```
allolib-studio-online/
├── frontend/                 # Vue 3 SPA (editor, viewer, sequencer)
│   ├── src/
│   │   ├── components/       # Vue components (42 files)
│   │   ├── stores/           # Pinia state (18 files, 17k LOC)
│   │   ├── services/         # Runtime, compiler, websocket (10 files, 4.8k LOC)
│   │   ├── data/             # Examples, glossary, synth data
│   │   ├── utils/            # Helpers (synth detection, lattice math)
│   │   └── composables/      # Vue composables (keyframes, shortcuts)
│   └── public/assets/        # Textures, meshes, HDR environments
├── backend/                  # Node.js compilation server
│   ├── src/                  # Express routes, compiler service
│   └── docker/               # Emscripten container, build scripts
├── allolib-wasm/             # C++ WASM compatibility layer
│   ├── include/              # Header patches (30+ files)
│   ├── src/                  # Web-specific implementations (18 files)
│   └── shaders/              # GLSL + WGSL shaders
├── desktop/                  # Electron wrapper
│   └── src/                  # Main process, menu, preload
└── *.md                      # Plans, README
```

### Data Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────────┐   │
│  │  Monaco  │───>│ Compiler │───>│ Runtime (WASM Module)    │   │
│  │  Editor  │    │ Service  │    │  ├─ WebGL2/WebGPU Canvas │   │
│  └──────────┘    └────┬─────┘    │  ├─ AudioWorklet         │   │
│       │               │          │  └─ JS ↔ C++ Bindings    │   │
│       v               │          └──────────────────────────┘   │
│  ┌──────────┐         │ WebSocket                               │
│  │  Pinia   │<────────┘ (compile status, errors)                │
│  │  Stores  │                                                    │
│  └──────────┘                                                    │
└─────────────────────────────────────────────────────────────────┘
         │
         │ HTTP/WS
         v
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Docker)                              │
│  ┌─────────┐    ┌───────────┐    ┌──────────────────────────┐   │
│  │ Express │───>│  BullMQ   │───>│ Emscripten Compiler      │   │
│  │  API    │    │  Queue    │    │ (Docker container)       │   │
│  └─────────┘    └───────────┘    └──────────────────────────┘   │
│                      │                        │                  │
│                      v                        v                  │
│                 ┌─────────┐            ┌───────────┐            │
│                 │  Redis  │            │ .js/.wasm │            │
│                 └─────────┘            └───────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Runtime Constraints
- **WASM**: Single-threaded, no native threads (Atomics via SharedArrayBuffer if enabled)
- **AudioWorklet**: 128 samples/buffer, 44.1/48kHz, requires user gesture to start
- **WebGL2**: GLSL ES 3.0, no geometry/tessellation shaders, float FBO needs extension
- **WebGPU**: WGSL shaders, Chrome 113+, experimental in Firefox/Safari
- **Memory**: ALLOW_MEMORY_GROWTH, starts ~256MB, grows as needed

---

## Layer 2: Interfaces & State

### Frontend Stores (Pinia)

```typescript
// stores/project.ts - Multi-file project management
interface ProjectFile { name: string; path: string; content: string; isMain: boolean; isDirty: boolean }
interface Project { id: string; name: string; files: ProjectFile[]; folders: ProjectFolder[]; activeFile: string }
// Actions: createFile, deleteFile, renameFile, saveToStorage, loadFromStorage

// stores/app.ts - Global app state
interface AppState { isCompiling: boolean; isRunning: boolean; compileOutput: string[]; errors: CompileError[] }
// Actions: setCompiling, setRunning, appendOutput, clearOutput

// stores/sequencer.ts - Clip-based sequencer
interface Clip { id: string; synthName: string; events: NoteEvent[]; startTime: number; duration: number }
interface Track { id: string; synthName: string; clips: string[]; muted: boolean; solo: boolean }
// Actions: addTrack, addClip, updateEvent, setPlayhead, togglePlayback

// stores/timeline.ts - Object timeline with keyframes
interface TimelineObject { id: string; type: string; properties: Record<string, any>; keyframes: Keyframe[] }
interface Keyframe { time: number; property: string; value: any; easing: EasingType }
// Actions: addObject, addKeyframe, interpolateAt, setCurrentTime

// stores/settings.ts - User preferences
interface Settings { theme: 'dark'|'light'; fontSize: number; audioEnabled: boolean; sampleRate: number }

// stores/terminal.ts - Shell emulation (4.5k LOC)
// Implements: ls, cd, cat, grep, find, compile, run, seq, fn (custom functions), js {}
```

### Frontend Services

```typescript
// services/compiler.ts - Compile orchestration
compileProject(files: ProjectFile[]): Promise<CompileResult>
getWebSocketStatus(): 'connected' | 'disconnected'

// services/runtime.ts - WASM module management
loadModule(wasmUrl: string): Promise<Module>
startAudio(): void; stopAudio(): void
callWasmFunction(name: string, ...args: any[]): any
// Exports: allolib_trigger_voice, allolib_release_voice, allolib_set_parameter

// services/objectManager.ts - C++↔JS object bridge
createObject(type: string, id: string): void
setProperty(id: string, prop: string, value: any): void
deleteObject(id: string): void
// Syncs timeline objects to C++ WebObjectManager via embind
```

### C++ WASM Layer (allolib-wasm)

```cpp
// al_WebApp.hpp - Main application base class
class WebApp : public App {
  void start();                    // Begin main loop
  void configureBackend(BackendType);
  GraphicsBackend* backend();
  // Virtuals: onCreate, onAnimate, onDraw, onSound, onKeyDown, etc.
};
#define ALLOLIB_WEB_MAIN(AppClass) // Entry point macro

// al_WebGraphicsBackend.hpp - GPU abstraction (500 LOC interface)
class GraphicsBackend {
  virtual bool init(int w, int h);
  virtual void beginFrame(); virtual void endFrame();
  virtual BufferHandle createBuffer(BufferType, BufferUsage, void*, size_t);
  virtual TextureHandle createTexture(TextureDesc, void*);
  virtual ShaderHandle createShader(ShaderDesc);
  virtual void draw(PrimitiveType, int vertexCount, int first);
  virtual void setUniformMat4(const char*, const float*);
  // WebGL2Backend: wraps existing al::Graphics GL calls
  // WebGPUBackend: native WebGPU with WGSL shaders
};

// al_WebObjectManager.hpp - Runtime object creation from JS
class WebObjectManager {
  void createObject(const std::string& type, const std::string& id);
  void setProperty(const std::string& id, const std::string& prop, float/Vec3f/Color);
  void deleteObject(const std::string& id);
  void renderAll(Graphics& g);  // Called from onDraw
};

// al_WebPBR.hpp - PBR material system
struct PBRMaterial { Color albedo; float metallic, roughness, ao; };
class WebPBR {
  void setMaterial(const PBRMaterial&);
  void setEnvironment(const std::string& hdrUrl);
  void draw(Graphics& g, Mesh& mesh);
};

// al_WebControlGUI.hpp - Parameter panel bridge
class WebControlGUI {
  void registerParameter(Parameter& p);  // Emits to JS via EM_ASM
  void sync();  // Update from JS values
};
```

### Key Constants

```cpp
// Audio
#define AL_AUDIO_SAMPLE_RATE 48000
#define AL_AUDIO_BLOCK_SIZE 128

// Uniform buffer layout (WebGPU, 160 bytes)
// offset 0: mat4 modelViewMatrix (64)
// offset 64: mat4 projectionMatrix (64)
// offset 128: vec4 tint (16)
// offset 144: f32 pointSize, eyeSep, focLen, _pad (16)
```

---

## Layer 3: Design Decisions

| Decision | Why |
|----------|-----|
| Vue 3 + Pinia | Reactive UI, TypeScript support, simpler than Redux |
| Monaco Editor | VS Code quality, C++ support, inline diagnostics |
| Docker for Emscripten | Reproducible builds, isolates 2GB toolchain |
| BullMQ + Redis | Job queue for concurrent compiles, persistence |
| WebGL2 default | 95%+ browser support vs WebGPU's ~60% |
| AudioWorklet | Low latency, off-main-thread, required for real-time |
| Dual backend abstraction | Future-proofs for WebGPU compute, allows A/B testing |
| Texture bridge pattern | Syncs GL textures to WebGPU without API changes |
| Header patching (include order) | Override AlloLib headers without forking upstream |
| embind over raw wasm-bindgen | Better C++ class/method exposure to JS |

### Known Limitations
- No GLSL→WGSL auto-transpilation (syntax too different)
- Custom shaders must be rewritten per backend
- No SharedArrayBuffer by default (requires COOP/COEP headers)
- Max 8 lights in WebGPU lighting shader
- EasyFBO not yet ported to WebGPU

### Gotchas
- `TRIANGLE_FAN`/`LINE_LOOP` converted to triangles/lines for WebGPU
- Texture::submit() must be called before bind() for WebGPU sync
- AudioContext requires user gesture (click/key) before starting
- WASM memory cannot shrink, only grow

---

## Layer 4: File Index

### Frontend (frontend/src/)

| Path | Purpose | LOC | Interfaces |
|------|---------|-----|------------|
| `App.vue` | Root component, layout | 590 | - |
| `components/Toolbar.vue` | Build/run controls, examples dropdown | 1938 | - |
| `components/EditorPane.vue` | Monaco wrapper | 373 | - |
| `components/ViewerPane.vue` | WebGL canvas container | 477 | - |
| `components/ParameterPanel.vue` | Synth param GUI | 777 | - |
| `components/AnalysisPanel.vue` | FFT, waveform viz | 1787 | - |
| `components/sequencer/ClipTimeline.vue` | Clip arrangement | 1460 | - |
| `components/sequencer/ToneLattice.vue` | Just intonation lattice | 1073 | - |
| `stores/project.ts` | Project/file state | 724 | ProjectFile, Project |
| `stores/sequencer.ts` | Sequencer state | 2353 | Clip, Track, NoteEvent |
| `stores/terminal.ts` | Shell emulation | 4495 | Command, Script |
| `stores/timeline.ts` | Object keyframes | 669 | TimelineObject, Keyframe |
| `stores/assetLibrary.ts` | Asset management | 3794 | Asset, AssetCategory |
| `services/runtime.ts` | WASM lifecycle | 883 | Module interface |
| `services/compiler.ts` | Compile API | 102 | CompileResult |
| `data/examples.ts` | 40+ code examples | 12k | ExampleCategory |
| `data/glossary.ts` | 330+ terms | 3817 | GlossaryEntry |

### Backend (backend/src/)

| Path | Purpose | LOC | Interfaces |
|------|---------|-----|------------|
| `index.ts` | Express server entry | 80 | - |
| `routes/compile.ts` | POST /compile endpoint | 159 | - |
| `services/compiler.ts` | Docker exec, job queue | 251 | CompileJob |
| `services/ws-manager.ts` | WebSocket handler | 200 | - |

### WASM Layer (allolib-wasm/)

| Path | Purpose | LOC | Interfaces |
|------|---------|-----|------------|
| `include/al_WebApp.hpp` | App base class | 200 | WebApp |
| `include/al_WebGraphicsBackend.hpp` | Backend abstraction | 506 | GraphicsBackend |
| `include/al_WebGPUBackend.hpp` | WebGPU impl header | 150 | WebGPUBackend |
| `include/al_WebPBR.hpp` | PBR materials | 300 | WebPBR, PBRMaterial |
| `include/al_WebObjectManager.hpp` | JS object bridge | 200 | WebObjectManager |
| `src/al_WebApp.cpp` | WebApp impl | 1057 | - |
| `src/al_WebGPUBackend.cpp` | WebGPU impl | 2407 | - |
| `src/al_Graphics_Web.cpp` | Graphics patches | 809 | - |
| `src/al_WebGL2Backend.cpp` | WebGL2 wrapper | 886 | - |
| `shaders/wgsl/*.wgsl` | WebGPU shaders | 800 | - |
| `shaders/glsl/*.glsl` | WebGL2 shaders | 400 | - |

### Desktop (desktop/src/)

| Path | Purpose | LOC | Interfaces |
|------|---------|-----|------------|
| `main.ts` | Electron main process | 300 | - |
| `preload.ts` | IPC bridge | 50 | - |
| `backend-runner.ts` | Spawns backend server | 150 | - |

---

## Verification Notes

- **Checked**: All paths exist in `git ls-files` output
- **Total tracked files**: 263
- **Total LOC**: ~194k (includes examples, data files)
- **Core source**: ~50k LOC (frontend + backend + wasm)
