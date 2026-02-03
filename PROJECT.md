<!-- After any significant coding session, run:
     "Update PROJECT.md to reflect the changes we just made,
      only referencing git-tracked files." -->

# PROJECT.md - AlloLib Studio Online

## Layer 0: Summary

Browser-based creative coding IDE for AlloLib C++ framework. Users write C++ in Monaco Editor, server compiles via Emscripten to WASM, executes in browser with WebGL2/WebGPU graphics + Web Audio. Features: multi-file projects, polyphonic synth system, clip-based sequencer with tone lattice, unified 4-category timeline with keyframe animation, parameter GUI, PBR materials, HDR environments, video recording. Stack: Vue 3 + Pinia frontend, Node/Express + Redis/BullMQ backend, Docker-containerized Emscripten 3.1.73 compiler. 70+ examples. Targets modern browsers (Chrome/Edge/Firefox/Safari). Desktop app via Electron.

---

## Layer 1: Architecture Map

### Directory Tree (git-tracked, depth 2)
```
allolib-studio-online/
├── frontend/                 # Vue 3 SPA (editor, viewer, sequencer, timeline)
│   ├── src/
│   │   ├── components/       # Vue components (42 files)
│   │   │   ├── timeline/     # Unified timeline (17 components)
│   │   │   ├── sequencer/    # Audio clip sequencer (10 components)
│   │   │   └── inputs/       # Custom controls (Vec3, ColorPicker)
│   │   ├── stores/           # Pinia state (18 files, 17k LOC)
│   │   │   └── sequencer/    # Sub-stores (tracks, clips, playback, editing)
│   │   ├── services/         # Runtime, compiler, websocket (10 files, 4.8k LOC)
│   │   │   └── transpiler/   # Code generation (5 files)
│   │   ├── composables/      # Vue composables (keyframes, shortcuts, virtual timeline)
│   │   ├── data/             # Examples (70+), glossary (330 terms), synth data
│   │   └── utils/            # Helpers (synth detection, lattice math, error parser)
│   └── public/assets/        # Textures, meshes, HDR environments
├── backend/                  # Node.js compilation server
│   ├── src/                  # Express routes, compiler service, WS manager
│   └── docker/               # Emscripten container, compile.sh, build-allolib.sh
├── allolib-wasm/             # C++ WASM compatibility layer
│   ├── include/              # Header patches (30+ files) - OVERRIDES AlloLib headers
│   ├── src/                  # Web-specific implementations (18 files)
│   ├── shaders/              # GLSL + WGSL shaders
│   └── CMakeLists.txt        # Emscripten build configuration
├── desktop/                  # Electron wrapper
│   └── src/                  # Main process, menu, preload, backend-runner
├── allolib/                  # AlloLib core (external, read-only)
├── al_ext/                   # AlloLib extensions (external)
└── docker-compose.yml        # Redis + Compiler + Backend services
```

### Data Flow
```
┌─────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────────┐   │
│  │ Monaco Editor│──>│  Compiler    │──>│  WASM Runtime              │   │
│  │ (C++ code)   │   │  Service     │   │  ├─ WebGL2/WebGPU Canvas   │   │
│  └──────────────┘   └──────┬───────┘   │  ├─ AudioWorklet (synth)   │   │
│         │                  │           │  ├─ WebObjectManager       │   │
│         v                  │           │  └─ embind JS↔C++ bindings │   │
│  ┌──────────────┐          │           └────────────────────────────┘   │
│  │ Pinia Stores │<─────────┘ WebSocket (compile status, errors)         │
│  │ ├─ project   │                                                        │
│  │ ├─ sequencer │──────────> voice triggers (_al_seq_trigger_on/off)    │
│  │ ├─ timeline  │──────────> object updates (objectManager.setProperty) │
│  │ ├─ objects   │                                                        │
│  │ └─ settings  │                                                        │
│  └──────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────┘
         │ HTTP POST /api/compile
         │ WebSocket /ws
         v
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Docker Compose)                          │
│  ┌───────────┐    ┌───────────┐    ┌────────────────────────────────┐   │
│  │  Express  │───>│  BullMQ   │───>│  Emscripten Container          │   │
│  │  :4000    │    │  Queue    │    │  em++ → app.js + app.wasm      │   │
│  └───────────┘    └───────────┘    └────────────────────────────────┘   │
│       │                │                          │                      │
│       │ WS broadcast   v                          v                      │
│       └──────────>┌─────────┐            ┌───────────────┐              │
│                   │  Redis  │            │ compiled/{id}/│              │
│                   └─────────┘            │ app.js/.wasm  │              │
│                                          └───────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Runtime Constraints
- **WASM**: Single-threaded, no native threads (Atomics via SharedArrayBuffer if COOP/COEP enabled)
- **AudioWorklet**: 128 samples/buffer, 44.1/48kHz, requires user gesture to start
- **WebGL2**: GLSL ES 3.0, no geometry/tessellation shaders, 95%+ browser support
- **WebGPU**: WGSL shaders, Chrome 113+/Edge 113+, ~60% browser support, experimental
- **Memory**: ALLOW_MEMORY_GROWTH, starts ~256MB, grows as needed (cannot shrink)

---

## Layer 2: Core Systems

### 2.1 Timeline System (Unified 4-Category)

The timeline is the central animation/sequencing interface with 4 track categories:

```
Timeline
├── Audio Tracks (♫ purple) ──────── Synth clips from sequencer
│   └── Clip instances with NoteEvents (freq, amp, duration)
├── Object Tracks (◈ blue) ───────── Visual entity keyframes
│   └── Keyframes: position.xyz, rotation.xyz, scale.xyz, color
├── Environment Track (◐ green) ──── Scene-wide properties
│   └── Keyframes: ambientLight, fogDensity, skyboxRotation
└── Event Track (⚡ orange) ───────── Triggers & scripts
    └── Markers, camera events, JavaScript handlers
```

**Keyframe Format:**
```typescript
interface Keyframe {
  time: number;           // Seconds
  property: string;       // "position.x", "color", etc.
  value: any;             // Number, Vec3f, Color
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier';
  bezierControlPoints?: [number, number, number, number];
}
```

**Runtime Interpolation:** `services/runtime.ts` evaluates keyframes at `currentTime`, applies easing, calls `objectManager.setProperty()` → C++ `WebObjectManager::setProperty()`.

**Key Files:**
- `components/timeline/TimelinePanel.vue` - Main container
- `components/timeline/KeyframeLane.vue` - Keyframe visualization
- `components/timeline/TransportBar.vue` - Play/pause/stop, BPM
- `stores/timeline.ts` - Selection, clipboard, viewport
- `stores/objects.ts` - Object definitions and keyframe storage
- `composables/useKeyframes.ts` - Interpolation logic

### 2.2 Sequencer System (Audio)

DAW-style clip arrangement for polyphonic synthesis:

```typescript
// stores/sequencer/clips.ts
interface NoteEvent {
  id: string;
  startTime: number;      // Beats (relative to clip start)
  duration: number;       // Beats
  frequency: number;      // Hz
  amplitude: number;      // 0-1
  params: number[];       // Per-voice parameters
}

interface Clip {
  id: string;
  synthName: string;      // Must match C++ SynthVoice class name
  events: NoteEvent[];
  filePath?: string;      // .synthSequence file
}

interface Track {
  id: string;
  synthName: string;
  clipInstances: { clipId: string; startTime: number; }[];
  muted: boolean;
  solo: boolean;
}
```

**Playback Flow:**
1. Sequencer playhead advances (BPM-based)
2. For each track, check if any clip's note should trigger
3. Call `_al_seq_trigger_on(voiceId, freq, amp, duration)` via WASM
4. C++ PolySynth allocates voice, calls `onTriggerOn()`
5. On note end: `_al_seq_trigger_off(voiceId)`

**Key Files:**
- `components/sequencer/ClipTimeline.vue` - Clip note editor
- `components/sequencer/ToneLattice.vue` - Just intonation grid
- `stores/sequencer/` - 4 sub-stores (tracks, clips, playback, editing)

### 2.3 Graphics Backend Abstraction

Dual-backend system allowing WebGL2 (stable) or WebGPU (modern):

```cpp
// al_WebGraphicsBackend.hpp - Abstract interface
class GraphicsBackend {
  virtual bool init(int w, int h) = 0;
  virtual void beginFrame() = 0;
  virtual void endFrame() = 0;
  virtual BufferHandle createBuffer(BufferType, BufferUsage, void* data, size_t) = 0;
  virtual TextureHandle createTexture(const TextureDesc&, void* data) = 0;
  virtual ShaderHandle createShader(const ShaderDesc&) = 0;
  virtual void draw(PrimitiveType, int vertexCount, int firstVertex) = 0;
  virtual void setUniformMat4(const char* name, const float* mat) = 0;
  // ... 30+ methods
};

// Implementations:
// al_WebGL2Backend.cpp  - Wraps existing al::Graphics OpenGL calls
// al_WebGPUBackend.cpp  - Native WebGPU with WGSL shaders (2400 LOC)
```

**Backend Selection:**
```cpp
// In user's main.cpp
void onCreate() override {
  configureBackend(BackendType::WebGL2);  // Default, stable
  // or: configureBackend(BackendType::WebGPU);  // Modern, compute support
  // or: configureBackend(BackendType::Auto);    // Auto-detect best
}
```

**Texture Bridge Pattern:** For WebGPU, OpenGL textures are synced via `Graphics_registerTexture()` which creates parallel WebGPU textures. User code unchanged.

### 2.4 Audio System

Web Audio API + AudioWorklet for low-latency synthesis:

```
┌─────────────────────────────────────────────────────┐
│ AudioContext (44.1/48kHz)                           │
│  └─ AudioWorkletNode ("allolib-processor")          │
│      ├─ bufferQueue[] (ring buffer)                 │
│      ├─ process() → pulls from queue → output       │
│      └─ postMessage() ↔ main thread                 │
└─────────────────────────────────────────────────────┘
         ↑ Float32Array buffers
         │
┌─────────────────────────────────────────────────────┐
│ WASM Module                                          │
│  └─ _allolib_process_audio(float* buffer, frames)   │
│      └─ App::onSound(AudioIOData& io)               │
│          └─ SynthVoice::onProcess() × N voices      │
└─────────────────────────────────────────────────────┘
```

**Key Constants:**
```cpp
#define AL_AUDIO_SAMPLE_RATE 48000  // or 44100
#define AL_AUDIO_BLOCK_SIZE 128
```

**Audio Safety:** Built-in limiter with soft clip + brick-wall at -0.5dB.

---

## Layer 3: Interfaces & State

### Frontend Stores (Pinia)

```typescript
// stores/project.ts - Multi-file project management
interface ProjectFile {
  name: string; path: string; content: string;
  isMain: boolean; isDirty: boolean;
  type: 'cpp' | 'hpp' | 'preset' | 'synthSequence' | 'obj';
}
interface ProjectFolder { name: string; path: string; children: (ProjectFile | ProjectFolder)[]; }
// Actions: createFile, deleteFile, renameFile, saveToStorage, loadFromStorage

// stores/app.ts - Global app state
interface AppState {
  isCompiling: boolean; isRunning: boolean;
  compileOutput: string[]; errors: CompileError[];
  wasmUrl: string; jsUrl: string; backend: 'webgl2' | 'webgpu';
}

// stores/objects.ts - Scene objects with transforms
interface SceneObject {
  id: string; name: string; type: 'sphere' | 'cube' | 'mesh' | 'light';
  position: Vec3; rotation: Vec3; scale: Vec3; color: Color;
  meshUrl?: string; materialPreset?: string;
  keyframes: Record<string, Keyframe[]>;  // Property name → keyframes
  spawnTime: number; destroyTime: number;  // Lifecycle
}

// stores/environment.ts - Scene-wide settings
interface EnvironmentState {
  backgroundColor: Color; ambientLight: Color; ambientIntensity: number;
  fogEnabled: boolean; fogDensity: number; fogColor: Color;
  skyboxUrl: string; skyboxRotation: number;
  hdriUrl: string; hdriIntensity: number;
  keyframes: Record<string, Keyframe[]>;
}

// stores/settings.ts - User preferences (persisted to localStorage)
interface Settings {
  editor: { fontSize: number; theme: 'dark' | 'light'; tabSize: number; };
  audio: { enabled: boolean; sampleRate: 44100 | 48000 | 96000; bufferSize: 128 | 256 | 512; };
  graphics: { backend: 'webgl2' | 'webgpu' | 'auto'; quality: 'low' | 'medium' | 'high' | 'ultra'; };
  display: { showFPS: boolean; showGrid: boolean; };
}
```

### Frontend Services

```typescript
// services/compiler.ts - Compile orchestration
interface CompileResult { success: boolean; wasmUrl: string; jsUrl: string; errors: CompileError[]; }
async function compileProject(files: ProjectFile[], mainFile: string, backend: string): Promise<CompileResult>
// POST /api/compile → polls /api/compile/status/:jobId → GET /api/compile/output/:jobId/app.wasm

// services/runtime.ts - WASM module management (AllolibRuntime class)
loadModule(wasmUrl: string, jsUrl: string): Promise<void>
start(): void   // Calls Module._allolib_start()
stop(): void    // Calls Module._allolib_stop()
// Voice triggers (called by sequencer):
triggerVoice(voiceId: number, freq: number, amp: number, dur: number): void
releaseVoice(voiceId: number): void
// Parameter sync (called by ParameterPanel):
setParameter(index: number, value: number): void

// services/objectManager.ts - C++↔JS object bridge
createObject(type: string, id: string, props: Partial<SceneObject>): void
setProperty(id: string, property: string, value: any): void  // e.g., "position.x", 1.5
deleteObject(id: string): void
// Syncs stores/objects.ts → WASM WebObjectManager via embind

// services/transpiler/index.ts - Code generation facade
generateMainCpp(project: Project, timeline: TimelineState, objects: SceneObject[]): string
generateCMakeLists(project: Project): string
importNativeProject(zipFile: File): Promise<Project>
```

### C++ WASM Layer

```cpp
// al_WebApp.hpp - Main application base class (mimics al::App)
class WebApp : public App {
public:
  void start();  // Registers Emscripten main loop
  void configureBackend(BackendType type);  // WebGL2, WebGPU, Auto
  GraphicsBackend* backend() const;

  // User overrides:
  virtual void onCreate() {}
  virtual void onAnimate(double dt) {}
  virtual void onDraw(Graphics& g) {}
  virtual void onSound(AudioIOData& io) {}
  virtual bool onKeyDown(const Keyboard& k) { return false; }
  virtual bool onMouseDown(const Mouse& m) { return false; }
};

// Entry point macro - generates WASM exports
#define ALLOLIB_WEB_MAIN(AppClass) \
  AppClass* _app = nullptr; \
  extern "C" { \
    void allolib_create() { _app = new AppClass(); } \
    void allolib_configure_backend(int type) { _app->configureBackend((BackendType)type); } \
    void allolib_start() { _app->start(); } \
    void allolib_stop() { /* stop loop */ } \
    void allolib_destroy() { delete _app; _app = nullptr; } \
  }

// al_WebObjectManager.hpp - Runtime object creation from JS
class WebObjectManager {
  std::unordered_map<std::string, SceneObject*> objects;
public:
  void createObject(const std::string& type, const std::string& id);
  void setProperty(const std::string& id, const std::string& prop, float value);
  void setPropertyVec3(const std::string& id, const std::string& prop, float x, float y, float z);
  void setPropertyColor(const std::string& id, const std::string& prop, float r, float g, float b, float a);
  void deleteObject(const std::string& id);
  void renderAll(Graphics& g);  // Called from App::onDraw
};

// al_WebControlGUI.hpp - Parameter panel bridge
class WebControlGUI {
public:
  void registerParameter(Parameter& p);  // Emits metadata to JS via EM_ASM
  void sync();  // Reads values from JS, updates C++ Parameters
  static int getParameterCount();
  static float getParameterValue(int index);
  static void setParameterValue(int index, float value);
};

// al_WebPBR.hpp - PBR material system
struct PBRMaterial {
  Color albedo{1, 1, 1};
  float metallic = 0.0f;
  float roughness = 0.5f;
  float ao = 1.0f;
  std::string albedoMapUrl, normalMapUrl, metallicMapUrl, roughnessMapUrl;
};
class WebPBR {
  void setMaterial(const PBRMaterial& m);
  void setEnvironment(const std::string& hdrUrl);
  void draw(Graphics& g, Mesh& mesh, const Mat4f& transform);
};
```

### Emscripten Exported Functions

```cpp
// Required exports for runtime integration (in compile.sh -sEXPORTED_FUNCTIONS)
_allolib_create, _allolib_configure_backend, _allolib_start, _allolib_stop, _allolib_destroy
_allolib_process_audio  // Called from AudioWorklet

// Sequencer voice control
_al_seq_trigger_on(int voiceId, float freq, float amp, float dur)
_al_seq_trigger_off(int voiceId)

// Parameter GUI
_al_webgui_get_parameter_count() -> int
_al_webgui_get_parameter_value(int index) -> float
_al_webgui_set_parameter_value(int index, float value)

// Object manager
_al_obj_create(const char* type, const char* id)
_al_obj_set_float(const char* id, const char* prop, float value)
_al_obj_set_vec3(const char* id, const char* prop, float x, float y, float z)
_al_obj_delete(const char* id)
```

---

## Layer 4: Feature Status

### Implemented Features

| Category | Feature | Status |
|----------|---------|--------|
| **Graphics** | WebGL2 backend | ✅ Stable |
| | Mesh rendering (all primitives) | ✅ |
| | Textures (2D, procedural) | ✅ |
| | Lighting (up to 8 lights) | ✅ |
| | PBR materials | ✅ |
| | HDR environments / IBL | ✅ |
| | OBJ model loading | ✅ |
| | Auto-LOD system | ✅ |
| | Normal mapping | ✅ |
| **Graphics (WebGPU)** | Basic mesh rendering | ✅ |
| | 2D Textures | ✅ Phase 1 complete |
| | Full lighting system | ✅ Phase 2 complete |
| | EasyFBO / render-to-texture | ⏳ Phase 3 pending |
| | Cubemaps / skybox | ⏳ Phase 4 pending |
| | PBR system | ⏳ Phase 5 pending |
| | HDRI / IBL | ⏳ Phase 6 pending |
| **Audio** | Web Audio + AudioWorklet | ✅ |
| | Polyphonic synthesis | ✅ |
| | Gamma DSP (oscillators, envelopes, filters) | ✅ |
| | Parameter automation | ✅ |
| | Safety limiter | ✅ |
| **Timeline** | 4-category unified timeline | ✅ |
| | Keyframe animation | ✅ |
| | Easing curves (linear, ease, bezier) | ✅ |
| | Object lifecycle (spawn/destroy) | ✅ |
| | Copy/paste/duplicate keyframes | ✅ |
| **Sequencer** | Clip arrangement | ✅ |
| | Tone lattice (just intonation) | ✅ |
| | Per-track mute/solo | ✅ |
| | BPM / loop controls | ✅ |
| **Editor** | Monaco with C++ highlighting | ✅ |
| | Multi-file projects | ✅ |
| | Error diagnostics | ✅ |
| | Example library (70+) | ✅ |
| **Recording** | WebM video recording | ✅ |
| | Screenshot (PNG/JPEG/WebP) | ✅ |
| | Social media presets | ✅ |
| **Terminal** | Unix-like shell (ls, cd, cat, grep) | ✅ |
| | Project commands (compile, run) | ✅ |
| | Custom functions (fn, js {}) | ✅ |

### WebGPU Completion Roadmap

| Phase | Feature | LOC Est. | Examples Enabled |
|-------|---------|----------|------------------|
| 1 | 2D Textures | ~200 | 15 | ✅ COMPLETE |
| 2 | Full Lighting | ~400 | 10 | ⚠️ NEEDS REDO |
| 3 | EasyFBO | ~150 | 5 | Pending |
| 4 | Cubemaps/Skybox | ~180 | 8 | Pending |
| 5 | WebPBR | ~300 | 12 | Pending |
| 6 | WebEnvironment/HDRI | ~200 | 6 | Pending |
| 7 | ProceduralTexture | ~100 | 4 | Pending |
| 8 | LOD System | ~50 | 4 | Pending |

---

## Layer 5: Examples Catalog (70+)

### AlloLib Core Examples
- **Basics (9)**: Hello Sphere, Hello Audio, Hello Audio-Visual, Shape Gallery, Custom Mesh, HSV Colors, Vertex Colors
- **Graphics (21)**: Points, Triangles, Mesh Primitives, Transform Hierarchy, Basic Lighting, Multi-Light, Custom Shader, Procedural Texture, Web Image Texture
- **Audio (18)**: Sine/Square/Saw/Triangle oscillators, ADSR envelopes, FM/Additive/Subtractive synthesis, Web Sample Player, Reverb, Filters
- **Interaction (3)**: Keyboard piano, Mouse theremin, WASD camera
- **Scene (3)**: SynthVoice, PolySynth, DynamicScene
- **Simulation (30+)**: Particles (rain, fire, smoke), Physics (springs, flocking), Cellular automata (Game of Life, Falling Sand), Fluid simulation, Ray marching (Mandelbulb), Artificial life (plants, creatures, slime mold)

### AlloLib Playground (Synthesis Tutorials)
- Sine Envelope, Wavetable, FM Synthesis, Subtractive, Additive, Filter Designs, Effects Chains

### AlloLib Studio (GPU Showcase)
- **Environments**: Basic IBL, PBR Showcase, HDRI Skybox, Environment Picker
- **Textures**: Procedural (brick, noise, Worley, marble), Normal Mapping, Texture LOD
- **Meshes**: OBJ Loading (Bunny, Teapot, Suzanne), Klein Bottle, Knot
- **Showcase**: Emergence (3-min audiovisual piece)

---

## Layer 6: Design Decisions & Gotchas

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Vue 3 + Pinia | Reactive UI, TypeScript support, simpler than Redux |
| Monaco Editor | VS Code quality, C++ support, inline diagnostics |
| Docker for Emscripten | Reproducible builds, isolates 2GB toolchain |
| BullMQ + Redis | Job queue for concurrent compiles, persistence |
| WebGL2 default | 95%+ browser support vs WebGPU's ~60% |
| AudioWorklet | Low latency, off-main-thread, required for real-time |
| Dual backend abstraction | Future-proofs for WebGPU compute |
| Texture bridge pattern | Syncs GL textures to WebGPU without API changes |
| Header patching (include order) | Override AlloLib headers without forking |
| embind over wasm-bindgen | Better C++ class/method exposure to JS |
| Unified timeline (4 categories) | Single playhead syncs audio + visual + events |
| Sequencer owns playhead | Audio timing is authoritative; timeline reads from it |

### Known Limitations
- No GLSL→WGSL auto-transpilation (syntax too different)
- Custom shaders must be rewritten per backend
- No SharedArrayBuffer by default (requires COOP/COEP headers)
- Max 8 lights in WebGPU lighting shader
- EasyFBO not yet ported to WebGPU
- WASM memory cannot shrink, only grow
- Audio requires user gesture to start (browser policy)

### Gotchas
- `TRIANGLE_FAN`/`LINE_LOOP` converted to triangles/lines for WebGPU
- `Texture::submit()` must be called before `bind()` for WebGPU sync
- Include order critical: `allolib-wasm/include/` must come before `allolib/include/`
- Preset files use `.preset` extension, sequence files use `.synthSequence`
- Timeline time is in seconds; sequencer time is in beats (convert via BPM)
- `glPointSize()` doesn't work in WebGL2; use `al_PointSize` uniform instead

---

## Layer 7: File Index (Key Files)

### Frontend (frontend/src/)

| Path | Purpose | LOC |
|------|---------|-----|
| `App.vue` | Root layout, compilation orchestration | 590 |
| `components/Toolbar.vue` | Build/run, examples dropdown | 1938 |
| `components/EditorPane.vue` | Monaco wrapper, file tabs | 373 |
| `components/ViewerPane.vue` | WebGL/WebGPU canvas container | 477 |
| `components/ParameterPanel.vue` | Synth parameter GUI sliders | 777 |
| `components/AnalysisPanel.vue` | FFT spectrum, waveform, meters | 1787 |
| `components/timeline/TimelinePanel.vue` | Unified timeline container | 842 |
| `components/timeline/KeyframeLane.vue` | Keyframe visualization | 456 |
| `components/timeline/TransportBar.vue` | Play/pause/stop, BPM, zoom | 318 |
| `components/timeline/TrackSection.vue` | Collapsible track category | 267 |
| `components/timeline/CurveEditor.vue` | Bezier easing editor | 534 |
| `components/sequencer/ClipTimeline.vue` | Clip note editor | 1460 |
| `components/sequencer/ToneLattice.vue` | Just intonation grid | 1073 |
| `stores/project.ts` | Project/file state | 724 |
| `stores/app.ts` | Compile/run state | 312 |
| `stores/sequencer.ts` (facade) | Sequencer state facade | 456 |
| `stores/sequencer/clips.ts` | Clip/note management | 623 |
| `stores/sequencer/playback.ts` | Transport, BPM, loop | 445 |
| `stores/timeline.ts` | Timeline viewport, selection | 669 |
| `stores/objects.ts` | Scene objects, keyframes | 534 |
| `stores/environment.ts` | Scene settings | 412 |
| `stores/terminal.ts` | Shell emulation | 4495 |
| `stores/assetLibrary.ts` | Asset management | 3794 |
| `services/runtime.ts` | WASM lifecycle, audio | 883 |
| `services/compiler.ts` | Compile API client | 102 |
| `services/objectManager.ts` | JS→C++ object bridge | 234 |
| `services/transpiler/mainCodeGen.ts` | Generate main.cpp | 456 |
| `data/examples.ts` | Example programs | 12k |

### Backend (backend/src/)

| Path | Purpose | LOC |
|------|---------|-----|
| `index.ts` | Express server, WebSocket | 80 |
| `routes/compile.ts` | POST /api/compile, GET /status | 159 |
| `services/compiler.ts` | Docker exec, job management | 251 |
| `services/ws-manager.ts` | WebSocket broadcast | 200 |

### WASM Layer (allolib-wasm/)

| Path | Purpose | LOC |
|------|---------|-----|
| `include/al_WebApp.hpp` | App base class | 200 |
| `include/al_WebGraphicsBackend.hpp` | Backend abstraction | 506 |
| `include/al_WebGPUBackend.hpp` | WebGPU backend header | 150 |
| `include/al_WebGL2Backend.hpp` | WebGL2 backend header | 120 |
| `include/al_WebPBR.hpp` | PBR materials | 300 |
| `include/al_WebEnvironment.hpp` | HDR/IBL | 250 |
| `include/al_WebObjectManager.hpp` | JS object bridge | 200 |
| `include/al_WebControlGUI.hpp` | Parameter panel bridge | 150 |
| `include/al_WebAutoLOD.hpp` | Auto level-of-detail | 400 |
| `src/al_WebApp.cpp` | WebApp implementation | 1057 |
| `src/al_WebGPUBackend.cpp` | WebGPU implementation | 2407 |
| `src/al_WebGL2Backend.cpp` | WebGL2 wrapper | 886 |
| `src/al_Graphics_Web.cpp` | Graphics patches | 809 |
| `src/al_WebObjectManager.cpp` | Object manager impl | 456 |
| `src/allolib-audio-processor.js` | AudioWorklet processor | 400 |
| `shaders/wgsl/*.wgsl` | WebGPU shaders | 800 |
| `shaders/glsl/*.glsl` | WebGL2 shaders | 400 |
| `CMakeLists.txt` | Emscripten build config | 350 |

### Docker (backend/docker/)

| Path | Purpose |
|------|---------|
| `Dockerfile` | Emscripten 3.1.73 image |
| `compile.sh` | User code compilation |
| `build-allolib.sh` | Pre-build AlloLib library |

---

## Layer 8: Terminal Commands Reference

```bash
# Navigation
ls [path]              # List files
cd <path>              # Change directory
cat <file>             # View file contents
grep <pattern> [path]  # Search in files
find <pattern>         # Find files by name

# Project
open <file>            # Open file in editor
compile                # Compile project
run                    # Compile and run
stop                   # Stop execution

# Sequencer
seq play               # Start playback
seq pause              # Pause playback
seq stop               # Stop and reset
seq bpm <value>        # Set tempo (e.g., seq bpm 120)
seq track add <name>   # Add synth track
seq clip add <track>   # Add clip to track

# Scripting
fn name { cmds }       # Define shell function
fn name js { code }    # Define JS function
js { code }            # Execute JavaScript
```

---

## Layer 9: E2E Testing Infrastructure

### Test Setup

The project uses **Playwright** for end-to-end browser testing of the rendering pipeline.

```
tests/
├── e2e/
│   ├── rendering-tests.spec.ts     # Core WebGL2/WebGPU rendering tests
│   ├── visual-regression.spec.ts   # Screenshot comparison tests
│   └── example-compatibility.spec.ts # Tests all 70+ examples compile
├── screenshots/
│   ├── baseline/                   # Reference images
│   ├── actual/                     # Current run captures
│   └── diff/                       # Visual diff output
└── playwright.config.ts            # Parallel execution config
```

### Running Tests

```bash
cd tests

# Run all tests (3 parallel workers)
npx playwright test

# Run specific test file
npx playwright test e2e/rendering-tests.spec.ts

# Run with UI mode (debugging)
npx playwright test --ui

# Update visual baselines
UPDATE_BASELINES=true npx playwright test

# Override worker count
WORKERS=1 npx playwright test
```

### Test Configuration (playwright.config.ts)

```typescript
{
  fullyParallel: true,
  workers: process.env.WORKERS ? parseInt(process.env.WORKERS) : (process.env.CI ? 2 : 3),
  timeout: 120000,  // 2 minutes per test (compilation is slow)
  use: {
    baseURL: 'http://localhost:5173',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  }
}
```

### Key Test Selectors

Tests use `data-testid` attributes for reliable element selection:

| Element | Selector |
|---------|----------|
| Run button | `[data-testid="run-button"]` |
| Canvas | `[data-testid="canvas"]` or `#canvas` |
| Console output | `[data-testid="console-output"]` |
| Stop button | `[data-testid="stop-button"]` |

### WebGPU Testing Requirements (Windows)

WebGPU requires the **DirectX Shader Compiler (DXC)** for device creation:

1. DXC binaries located at: `C:\Allolib Studio Online\bin\`
   - `dxil.dll`
   - `dxcompiler.dll`

2. Ensure bin folder is in PATH:
   ```cmd
   setx PATH "%PATH%;C:\Allolib Studio Online\bin"
   ```

3. Alternative: Copy to System32 (requires admin):
   ```cmd
   copy "C:\Allolib Studio Online\bin\dxil.dll" C:\Windows\System32\
   copy "C:\Allolib Studio Online\bin\dxcompiler.dll" C:\Windows\System32\
   ```

---

## Layer 10: Recent Session Work Log

### Session: 2026-02-02 - Test Infrastructure Fixes

**Goal:** Fix E2E tests that weren't working and configure parallel execution.

#### Problems Found & Fixed

1. **Button selector matching 11 elements**
   - **Cause:** Collapsible sections used "▶" text, matching generic button selector
   - **Fix:** Added `data-testid="run-button"` to Toolbar.vue, updated tests to use `.first()`

2. **Code not being set in Monaco editor**
   - **Cause:** Pinia stores loading old project from localStorage
   - **Fix:** Tests now clear localStorage before setting code:
     ```typescript
     await page.evaluate(() => {
       localStorage.removeItem('allolib-project')
       localStorage.removeItem('allolib-code')
       localStorage.removeItem('unified-project')
     })
     ```

3. **Test C++ code had wrong API**
   - **Cause:** Tests used `addSphere(mesh, radius)` but WebApp API is `addSphere(mesh, radius, slices, stacks)`
   - **Fix:** Updated all test code to use correct signature

4. **WASM function signature mismatch runtime error**
   - **Cause:** `_allolib_configure_backend` missing from EXPORTED_FUNCTIONS in compile.sh
   - **Fix:** Added to compile.sh:
     ```bash
     -sEXPORTED_FUNCTIONS="[...'_allolib_configure_backend',...
       '_al_seq_trigger_on','_al_seq_trigger_off','_al_seq_set_param','_al_seq_get_voice_count']"
     ```

5. **WebGPU device creation failed (Windows)**
   - **Cause:** Missing dxil.dll required by Chrome/Edge for WebGPU
   - **Fix:** Downloaded DXC, added to `C:\Allolib Studio Online\bin\`, added to PATH

#### Files Modified

| File | Changes |
|------|---------|
| `tests/playwright.config.ts` | Enabled parallel (3 workers), increased timeout |
| `tests/e2e/rendering-tests.spec.ts` | Fixed selectors, localStorage clearing, partial success handling |
| `tests/e2e/visual-regression.spec.ts` | Fixed button selector |
| `tests/e2e/example-compatibility.spec.ts` | Fixed selectors |
| `frontend/src/components/Toolbar.vue` | Added `data-testid="run-button"` |
| `frontend/src/components/ViewerPane.vue` | Added `data-testid="canvas"` |
| `frontend/src/components/Console.vue` | Added `data-testid="console-output"` |
| `backend/docker/compile.sh` | Added missing WASM exports |

#### Current Test Status (2026-02-03)

| Test Suite | Status |
|------------|--------|
| Example Compatibility | ✅ 100% pass (WebGL2) |
| WebGL2 Rendering | ✅ 17/17 passing |
| WebGPU Rendering | ✅ Tests properly skip in headless (requires headed mode with GPU) |
| Visual Regression | ✅ All 5 baselines generated and passing |
| Performance Benchmarks | ✅ Compile time ~8.8s avg, 60 FPS |

### Session: 2026-02-03 - WebGL2 Rendering Fix & Test Infrastructure

**Goal:** Fix WebGL2 rendering tests that were only showing background color (no geometry).

#### Root Cause Found & Fixed

1. **"function signature mismatch" WASM exception**
   - **Root cause:** GLAD's `glClearDepthf` function pointer was NULL in Emscripten
   - **Why:** `eglGetProcAddress` doesn't properly load WebGL2 functions in WASM
   - **Fix:** Bypass GLAD and use Emscripten's direct GL functions:
     ```cpp
     // In al_OpenGL_Web.cpp
     extern "C" {
         void emscripten_glClearDepthf(float d);
         void emscripten_glClearColor(float r, float g, float b, float a);
         void emscripten_glClear(unsigned int mask);
     }

     void clearDepth(float d) {
       #ifdef __EMSCRIPTEN__
         emscripten_glClearDepthf(d);
         emscripten_glClear(GL_DEPTH_BUFFER_BIT);
       #else
         glClearDepthf(d);
         glClear(GL_DEPTH_BUFFER_BIT);
       #endif
     }
     ```

2. **WebGPU tests failing in headless mode**
   - **Cause:** WebGPU requires headed mode with real GPU access
   - **Fix:** Added `headless: false` to chromium-webgpu project, proper skip conditions

3. **Visual regression tests capturing corrupted images**
   - **Cause:** Playwright's `element.screenshot()` doesn't capture WebGL canvas properly
   - **Fix:** Use `canvas.toDataURL()` for proper WebGL content capture

4. **Visual regression test code not compiling**
   - **Cause:** Tests used `int main() { MyApp().start(); }` instead of `ALLOLIB_WEB_MAIN(MyApp)`
   - **Fix:** Updated all test cases to use correct macro

#### Files Modified

| File | Changes |
|------|---------|
| `allolib-wasm/src/al_OpenGL_Web.cpp` | Bypass GLAD for Emscripten GL calls |
| `tests/e2e/rendering-tests.spec.ts` | WebGPU skip conditions, timeout fixes |
| `tests/e2e/visual-regression.spec.ts` | toDataURL capture, ALLOLIB_WEB_MAIN macro |
| `tests/playwright.config.ts` | DXC path, headless:false for WebGPU |
| `webgpu-full-compatibility-plan.md` | Marked lighting as needs redo |

#### Next Steps

1. **Redo WebGPU full lighting** - Phase 2 needs reimplementation
2. **Implement EasyFBO** - Phase 3 of WebGPU compatibility
3. **Add more visual regression test cases**

---

## Verification Notes

- **Checked**: All paths exist in `git ls-files` output
- **Total tracked files**: ~263
- **Total LOC**: ~194k (includes examples, data files)
- **Core source**: ~50k LOC (frontend + backend + wasm)
- **Last updated**: 2026-02-03 (WebGL2 rendering fix + test infrastructure)
