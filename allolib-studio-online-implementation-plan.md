# AlloLib Studio Online - Complete Implementation Plan

## Project Overview

**Goal**: Create a browser-based creative coding environment that compiles and runs AlloLib C++ code online, featuring a Monaco Editor for code editing and a WebGL/WebAudio viewer for output.

**Architecture**: Split-pane interface with editor/compiler on the left and real-time viewer on the right.

**Selected Approach**: Option A - Server-Side Compilation (Full functionality)

---

## Implementation Progress

### ✅ Phase 1: Infrastructure - COMPLETE
- [x] **Project Setup** - Git repository initialized, npm workspaces configured
- [x] **Frontend Scaffolding** - Vue 3 + TypeScript + Tailwind CSS + Vite
- [x] **Backend Scaffolding** - Node.js + Express + WebSocket server
- [x] **Monaco Editor Integration** - C++ syntax, AlloLib snippets, custom theme
- [x] **Docker Configuration** - Emscripten 3.1.50 compilation environment
- [x] **Compilation Pipeline** - Job submission, status polling, output serving
- [x] **WASM Runtime Loader** - AllolibRuntime + AudioRuntime classes
- [x] **State Management** - Pinia store for app state
- [x] **UI Components** - Toolbar, EditorPane, ViewerPane, Console
- [x] **AlloLib Cloned** - Full library with all submodules (Gamma, GLFW, imgui, etc.)
- [x] **al_ext Cloned** - Extensions (soundfile, spatialaudio, assets3d)
- [x] **AlloLib Documentation** - Complete glossary, dictionary, and how-to guide

### ✅ Phase 2: AlloLib WASM Port - COMPLETE
- [x] **AlloLib WASM Build** - CMakeLists.txt for Emscripten (`allolib-wasm/CMakeLists.txt`)
- [x] **Web Audio Backend** - Web Audio API backend (`allolib-wasm/src/al_WebAudioBackend.cpp`)
- [x] **WebGL2 Integration** - GLFW Emscripten port with WebGL2
- [x] **Full Compilation Testing** - End-to-end C++ to WASM pipeline verified
- [x] **WebApp Wrapper** - Self-contained `al::WebApp` class (not inheriting from App)
- [x] **AudioWorklet Processor** - Real-time audio in worker (`allolib-audio-processor.js`)
- [x] **Gamma DSP Integration** - Compiled into libGamma.a (160KB)
- [x] **Graphics Core** - Graphics, Mesh, Shapes, Shader, Texture, VAO compiled
- [x] **Shape Functions** - All primitives included (sphere, cube, cone, cylinder, etc.)
- [x] **Lighting System** - Light class compiled into libal_web.a
- [x] **Sound/Spatializer Sources** - Ambisonics, VBAP, DBAP, StereoPanner compiled
- [x] **Scene System Sources** - SynthVoice, PolySynth, DynamicScene, PositionedVoice compiled

### ✅ Phase 3: Integration Testing - COMPLETE
- [x] **Test Application** - Basic rotating sphere + sine wave (`test_app.cpp`)
- [x] **Docker Services Running** - Frontend (3000), Backend (4000), Redis (6379), Compiler
- [x] **Frontend-Backend Integration** - Monaco → API → Compilation pipeline works
- [x] **Compilation Pipeline** - Code compiles successfully (~5 seconds)
- [x] **WASM Module Loading** - ES6 module imports and initializes correctly
- [x] **Application Lifecycle** - `allolib_create()`, `allolib_start()` called successfully
- [x] **Audio Worklet Loading** - Processor loads without errors
- [x] **WebGL Rendering** - Graphics display correctly (rotating colored sphere visible)
- [x] **Audio Analysis Panel** - Faust IDE-style visualization (meters, waveform, spectrum)
- [x] **Keyboard/Mouse Input Code** - Emscripten HTML5 event handlers implemented
- [x] **Audio Playback** - Gamma oscillators generate audio, AudioWorklet plays correctly
- [x] **Input Events** - Keyboard/mouse events registered via Emscripten HTML5 API

#### WebGL Rendering Fix (Completed):
Multiple issues were resolved to get WebGL rendering working:

1. **ES6 Module Loading** - Runtime updated to properly import ES6 WASM modules using dynamic imports with blob URLs

2. **WebGL Context Creation** - Bypassed AlloLib's GLFW Window class for Emscripten, using direct `emscripten_webgl_create_context()` instead

3. **GLAD Initialization** - Added `gladLoadGLLoader((void* (*)(const char*))eglGetProcAddress)` after WebGL context creation

4. **Shader Compatibility** - Created patched shader headers (`allolib-wasm/include/al/graphics/al_DefaultShaders.hpp`) with `#version 300 es` + precision qualifiers for WebGL2 (replacing desktop `#version 330`)

5. **Missing Graphics::init()** - Added the crucial `mGraphics->init()` call in WebApp to compile all default shaders before use

#### Audio Analysis Panel (Completed):
Added Faust IDE-style audio visualization (`frontend/src/components/AudioAnalysisPanel.vue`):

1. **Master Level Meter** - Stereo L/R meters with peak hold indicators
   - Color gradient (green → yellow → red) for signal level
   - dB scale markers (-60 to 0 dB)

2. **Waveform Analyzer** - Oscilloscope-style time domain display
   - Real-time waveform rendering using Web Audio AnalyserNode
   - Grid lines and amplitude labels (+1, 0, -1)

3. **Spectrum Analyzer** - FFT-based frequency display
   - Logarithmic frequency scale (20Hz to 22kHz)
   - 64 frequency bands with gradient coloring
   - Frequency markers (100Hz, 1kHz, 10kHz)

4. **Toggle View** - Switch between waveform and spectrum views

#### Keyboard/Mouse Input (Completed):
Implemented Emscripten HTML5 event handlers in `al_WebApp.cpp`:

1. **Keyboard Events** - Document-level keydown/keyup handlers
   - Maps JavaScript key codes to AlloLib Keyboard constants
   - Supports modifiers (shift, ctrl, alt)
   - Special key mapping (arrows, escape, enter, etc.)

2. **Mouse Events** - Canvas-level mouse handlers
   - mousedown, mouseup, mousemove for basic interaction
   - wheel event for scroll/zoom
   - Drag detection (when buttons are pressed during move)

3. **Helper Classes** - KeyboardAccess/MouseAccess to access protected setters

#### Audio Pipeline Fix (Completed):
Fixed the complete audio pipeline from WASM to Web Audio output:

1. **Gamma Sample Rate** - Added `gam::sampleRate(sampleRate)` in WebApp::initAudio() to configure Gamma DSP library (required for oscillators to work)

2. **Buffer Size Alignment** - Changed default WebAudioConfig::bufferSize from 512 to 128 to match Web Audio worklet quantum size

3. **AudioWorklet Integration** - Full bidirectional communication:
   - Worklet sends `requestBuffer` messages to main thread
   - Main thread allocates WASM memory, calls `_allolib_process_audio`
   - Audio data copied back and sent to worklet via `postMessage`
   - HEAPF32 subarray with proper byte-to-element offset conversion

4. **AudioIOData Setup** - Proper buffer allocation in initAudio():
   - framesPerBuffer(128) sets internal buffer size
   - channelsOut(2) allocates stereo output buffers
   - frame(0) resets iterator before onSound callback

5. **Docker Volume Fix** - Removed `compiler-lib` volume to force library rebuild when source changes

### ✅ Phase 4: Feature Verification - COMPLETE
- [x] **Scene System Testing** - Voice management compiles and works
  - [x] SynthVoice lifecycle (trigger, release)
  - [x] PolySynth voice allocation
  - [x] DynamicScene spatial rendering
- [x] **Shader Support** - Custom GLSL ES 3.0 shaders work
- [x] **Texture Support** - Procedural texture generation works
- [x] **Spatializer Compilation** - All spatializers compile (runtime testing pending)
  - [x] StereoPanner compiled
  - [x] VBAP/DBAP compiled
  - [x] Ambisonics compiled

#### Library Additions (Completed):
To support the full scene system, the following were added to the WASM build:

1. **VariantValue** - Added `al_VariantValue.cpp` for parameter system support

2. **Demangle Web Stub** - Created `al_Demangle_Web.cpp` using cxxabi for C++ name demangling

3. **OSC Web Stubs** - Created `al_OSC_Web.cpp` with no-op implementations for:
   - `osc::Packet` - Message building
   - `osc::Send` - Network sending
   - `osc::Message` - Message parsing
   - (OSC is a networking protocol not applicable to web environment)

#### Test Examples Created:
- `allolib-wasm/examples/polysynth_test.cpp` - PolySynth with SynthVoice
- `allolib-wasm/examples/dynamicscene_test.cpp` - DynamicScene with PositionedVoice
- `allolib-wasm/examples/shader_test.cpp` - Custom GLSL ES 3.0 shaders
- `allolib-wasm/examples/texture_test.cpp` - Procedural texture generation

### ✅ Phase 5: WebGL2 & Audio Feature Parity - COMPLETED

Ensure WebGL2 and Web Audio implementations support all AlloLib features. WebGL2 is based on OpenGL ES 3.0 (differs from desktop OpenGL 3.3+), and Web Audio has its own constraints compared to native audio APIs.

**Test Examples Created:**
- `allolib-wasm/examples/phase5/mesh_primitives_test.cpp` - Tests all primitive types
- `allolib-wasm/examples/phase5/shape_gallery_test.cpp` - Tests all addShape() functions
- `allolib-wasm/examples/phase5/transform_stack_test.cpp` - Tests matrix operations
- `allolib-wasm/examples/phase5/multilight_test.cpp` - Tests multi-light system
- `allolib-wasm/examples/phase5/easyfbo_test.cpp` - Tests render-to-texture
- `allolib-wasm/examples/phase5/blend_modes_test.cpp` - Tests blend modes and render states
- `allolib-wasm/examples/phase5/gamma_dsp_test.cpp` - Tests all Gamma DSP components
- `allolib-wasm/examples/phase5/spatial_audio_test.cpp` - Tests spatial audio features

#### Graphics Features
- [x] **Mesh Primitives** - All primitive types working
  - [x] POINTS, LINES, LINE_STRIP, LINE_LOOP
  - [x] TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN
- [x] **Mesh Attributes** - All vertex attributes
  - [x] Position (location 0)
  - [x] Color (location 1)
  - [x] TexCoord (location 2)
  - [x] Normal (location 3)
- [x] **Shape Functions** - All addShape() primitives
  - [x] addSphere, addCube, addCone, addCylinder
  - [x] addTorus, addSurface, addRect
  - [x] addIcosphere, addDodecahedron, addOctahedron, addTetrahedron
- [x] **Transform Stack** - Matrix operations
  - [x] pushMatrix/popMatrix
  - [x] translate, rotate, scale
  - [x] Model/View/Projection matrices

#### Shader System
- [x] **Default Shaders** - All shader types compiling
  - [x] COLOR shader (uniform color)
  - [x] MESH shader (per-vertex color)
  - [x] TEXTURE shader (texture sampling)
  - [x] LIGHTING_* shaders (with lights)
- [x] **Custom Shaders** - User GLSL ES 3.0 shaders
  - [x] Vertex shader compilation
  - [x] Fragment shader compilation
  - [x] Uniform binding
  - [x] Attribute binding
- [x] **Shader Compatibility Layer** - GLSL 330 → GLSL ES 300 translation
  - [x] Precision qualifiers (highp/mediump/lowp)
  - [x] Integer literal suffixes
  - [x] Texture functions (texture vs texture2D)

#### Lighting System
- [x] **Light Types**
  - [x] Point lights
  - [x] Directional lights
  - [x] Multiple lights (up to 8)
- [x] **Material Properties**
  - [x] Ambient, diffuse, specular
  - [x] Shininess
- [x] **Lighting Shaders**
  - [x] Per-fragment lighting
  - [x] Normal matrix calculation

#### Texture System
- [x] **Texture Types**
  - [x] 2D textures (TEXTURE_2D)
  - [x] Cubemap textures (GL_TEXTURE_CUBE_MAP - core WebGL2)
- [x] **Texture Formats**
  - [x] RGBA8, RGB8
  - [x] Float textures (EXT_color_buffer_float for FBO, reading always works)
  - [x] Half-float textures (EXT_color_buffer_half_float)
- [x] **Texture Parameters**
  - [x] Filtering (LINEAR, NEAREST, MIPMAP)
  - [x] Wrapping (REPEAT, CLAMP_TO_EDGE)
- [x] **Texture Loading**
  - [x] From image data (stb_image)
  - [x] Procedural generation

#### Framebuffer Objects
- [x] **EasyFBO** - Render-to-texture support
  - [x] Color attachment
  - [x] Depth attachment
  - [ ] Stencil attachment
- [x] **Post-processing** - Multi-pass rendering

#### Blending & State
- [x] **Blend Modes**
  - [x] Alpha blending
  - [x] Additive blending
  - [x] Custom blend functions (multiply, screen)
- [x] **Depth Testing**
  - [x] Enable/disable
  - [x] Depth function
- [x] **Face Culling**
  - [x] Front/back culling
  - [x] Winding order
- [x] **Viewport & Scissor**
  - [x] Viewport setting
  - [x] Scissor testing

#### WebGL2-Specific Limitations to Address
- [x] **No Geometry Shaders** - WebGL2 doesn't support geometry shaders
  - [x] Alternative: compute on CPU or use instancing
- [x] **No Tessellation** - WebGL2 doesn't support tessellation shaders
  - [x] Use pre-tessellated meshes with adaptive LOD
- [x] **Limited Extensions** - Check for and handle missing extensions
  - [x] EXT_color_buffer_float (float texture render targets)
  - [x] OES_texture_float_linear (float texture filtering)
  - [x] EXT_color_buffer_half_float (half-float render targets)
  - [x] EXT_texture_filter_anisotropic (anisotropic filtering)
  - [x] WEBGL_debug_renderer_info (GPU vendor/renderer)
  - [x] Runtime capability detection via WebGL2Extensions helper
- [x] **Memory Limits** - Handle WebGL memory constraints
  - [x] Texture size limits
  - [x] Buffer size limits
  - [x] Query GL_MAX_TEXTURE_SIZE, GL_MAX_CUBE_MAP_TEXTURE_SIZE at runtime

#### Testing & Validation
- [x] **Visual Comparison Tests** - Created comprehensive test examples
- [x] **Performance Benchmarks** - Tests run at acceptable frame rates
- [ ] **Browser Compatibility** - Test on Chrome, Firefox, Safari, Edge

#### Audio Parity
Ensure Web Audio implementation supports all AlloLib audio features:

- [x] **Gamma DSP Integration**
  - [x] All oscillator types (Sine, Saw, Square, Tri, Pulse)
  - [x] Envelope generators (ADSR, AD, Seg)
  - [x] Filters (Biquad LP/HP/BP, OnePole)
  - [x] Effects (Delay, Comb reverb)
  - [x] Sample rate conversion handling
  - [x] Pink noise generator
- [x] **AudioIOData Features**
  - [x] Stereo output
  - [x] Multi-channel output (limited to stereo in browsers; multichannel reserved for future)
  - [x] Audio input (requires getUserMedia permission; implemented but needs user testing)
  - [x] Bus channels for internal routing
  - [x] Gain control
  - [x] Buffer size configuration (128 samples standard for Web Audio)
  - [x] Sample rate handling (44.1kHz or 48kHz depending on browser)
- [x] **Spatializer Support**
  - [x] StereoPanner - Stereo panning (full support)
  - [x] VBAP - Vector Base Amplitude Panning (2D mode, degrades to stereo pairs)
  - [x] DBAP - Distance Based Amplitude Panning (outputs to 2 speakers)
  - [x] Ambisonics - First-order ambisonic encoding/decoding (decodes to stereo)
  - [x] Listener pose updates (position, orientation)
  - [x] Distance-based attenuation
  - Note: All spatializers work but are limited to stereo output in web environment
- [x] **Scene System Audio**
  - [x] SynthVoice with proper lifecycle (trigger, release, free)
  - [x] PolySynth voice allocation and stealing
  - [x] DynamicScene with spatial audio rendering
  - [x] PositionedVoice with 3D positioning
- [x] **Audio Analysis** (Frontend)
  - [x] Real-time FFT for visualization
  - [x] RMS level metering
  - [x] Stereo scope (Lissajous)
- [x] **Web Audio Limitations**
  - [x] Handle AudioContext autoplay policy (require user gesture)
  - [x] Manage AudioWorklet latency (~128 samples minimum)
  - [x] Buffer underrun detection and recovery
    - [x] Track underrun count and report to main thread
    - [x] Automatic buffer queue management (min/max queue sizes)
    - [x] Latency tracking (roundtrip time measurement)
  - [x] Sample-accurate scheduling via AudioContext.currentTime
    - [x] Event scheduling with sample-level precision
    - [x] Sorted event queue in AudioWorklet
    - [x] Sample offset calculation within buffers

### ✅ Phase 6: Editor Enhancement - COMPLETE
- [x] **Monaco Intellisense** - Full autocomplete for 12+ AlloLib classes
  - [x] Hover documentation for all classes (Mesh, Graphics, Vec3f, Color, Nav, AudioIOData, WebApp, etc.)
  - [x] Method signatures and parameter hints (SignatureHelpProvider)
  - [x] Code snippets for common patterns (17 snippets)
  - [x] Class member completion (type `mesh.` to see methods)
  - [x] Namespace completion (`al::` and `gam::` autocomplete)
- [x] **Example Projects** - 22 demos covering all features (exceeds 12 requirement):
  - [x] Basics: Hello Sphere, Hello Audio, Hello AudioVisual
  - [x] Graphics: Shapes, Transforms, Lighting, Shaders, Textures
  - [x] Audio: Oscillators, Envelopes, Synthesis
  - [x] Interaction: Keyboard, Mouse, Navigation
  - [x] Scene System: SynthVoice, PolySynth, DynamicScene
  - [x] Advanced: Particles, Audio-Visual, Generative
- [x] **Project Persistence** - IndexedDB storage for user code
  - [x] Multiple project support
  - [x] Version history per project
  - [x] Export/import functionality
  - [x] Search projects
- [x] **Error Handling** - Compiler diagnostics with line highlighting
  - [x] GCC/Clang/Emscripten error parsing
  - [x] Monaco editor markers (red squiggles)
  - [x] Auto-jump to first error
- [x] **Parameter System** - Parameter/ParameterServer with UI callbacks
  - [x] JavaScript-side parameter management
  - [x] Grouped parameter organization
  - [x] Change callbacks and subscriptions
  - [x] ParameterPanel Vue component
- [x] **Safety Limiter** - Audio protection
  - [x] Soft clipper (tanh-based saturation)
  - [x] Brick-wall limiter (DynamicsCompressorNode)
  - [x] Configurable threshold and drive
  - [x] Limiter activity indicator in Analysis panel

### 📋 Phase 7: Production - PENDING
- [ ] **Production Docker Compose** - Optimized multi-stage builds
- [ ] **CDN Setup** - Static asset serving for WASM/JS
- [ ] **Rate Limiting** - Compilation request throttling
- [ ] **Caching** - Redis cache for compiled modules
- [ ] **HTTPS** - SSL/TLS configuration
- [ ] **Monitoring** - Health checks and logging

---

## Build Artifacts

### Libraries Built (in Docker `/app/lib/`)
| Library | Size | Contents |
|---------|------|----------|
| `libal_web.a` | 1.8 MB | AlloLib core (Graphics, Audio, Scene, Sound, Spatial) |
| `libGamma.a` | 160 KB | Gamma DSP library (oscillators, filters, FFT) |

### Test Application Output (in Docker `/app/output/`)
| File | Size | Description |
|------|------|-------------|
| `app.js` | 172 KB | Emscripten JS loader |
| `app.wasm` | 501 KB | WebAssembly binary |
| `allolib-audio-processor.js` | 4 KB | AudioWorklet processor |

---

## Key Files Created

### allolib-wasm/ (New Module)
```
allolib-wasm/
├── CMakeLists.txt              # Emscripten build configuration
├── include/
│   ├── al_WebApp.hpp           # Self-contained WebApp class
│   └── al/graphics/
│       └── al_DefaultShaders.hpp  # Patched shaders for WebGL2 (#version 300 es)
└── src/
    ├── al_WebApp.cpp           # WebApp implementation (WebGL context, GLAD init)
    ├── al_WebAudioBackend.cpp  # Web Audio backend
    ├── al_DefaultShaderString_Web.cpp  # WebGL2 shader version strings
    ├── al_DefaultShaders_Web.cpp       # WebGL2 multilight shaders
    ├── allolib-audio-processor.js      # AudioWorklet processor
    └── test_app.cpp            # Test application
```

### Docker Configuration
```
backend/docker/
├── Dockerfile                  # Emscripten 3.1.50 container
├── build-allolib.sh           # AlloLib static library builder
└── compile.sh                 # User code compiler
```

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Phase 1: Project Setup & Infrastructure](#3-phase-1-project-setup--infrastructure)
4. [Phase 2: AlloLib Emscripten Port](#4-phase-2-allolib-emscripten-port)
5. [Phase 3: Monaco Editor Integration](#5-phase-3-monaco-editor-integration)
6. [Phase 4: Compilation Pipeline](#6-phase-4-compilation-pipeline)
7. [Phase 5: Runtime & Viewer](#7-phase-5-runtime--viewer)
8. [Phase 6: UI/UX Implementation](#8-phase-6-uiux-implementation)
9. [Phase 7: Advanced Features](#9-phase-7-advanced-features)
10. [File Structure](#10-file-structure)
11. [Detailed Implementation Tasks](#11-detailed-implementation-tasks)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AlloLib Studio Online                            │
├─────────────────────────────────┬───────────────────────────────────────┤
│         EDITOR PANE             │            VIEWER PANE                │
│  ┌───────────────────────────┐  │  ┌─────────────────────────────────┐  │
│  │     Monaco Editor         │  │  │      WebGL Canvas               │  │
│  │     (C++ syntax)          │  │  │      (AlloLib Graphics)         │  │
│  │                           │  │  │                                 │  │
│  │  - Autocomplete           │  │  │  - OpenGL ES 3.0 via WebGL2    │  │
│  │  - Error highlighting     │  │  │  - Shader support              │  │
│  │  - AlloLib snippets       │  │  │  - 3D rendering                │  │
│  └───────────────────────────┘  │  └─────────────────────────────────┘  │
│  ┌───────────────────────────┐  │  ┌─────────────────────────────────┐  │
│  │     Console/Output        │  │  │      Web Audio Context          │  │
│  │  - Compilation logs       │  │  │      (AlloLib Audio)            │  │
│  │  - Runtime errors         │  │  │                                 │  │
│  │  - stdout/stderr          │  │  │  - AudioWorklet processing     │  │
│  └───────────────────────────┘  │  │  - Spatial audio               │  │
│                                 │  └─────────────────────────────────┘  │
├─────────────────────────────────┴───────────────────────────────────────┤
│                         TOOLBAR                                         │
│  [▶ Run] [⏹ Stop] [📁 Examples] [💾 Save] [📤 Export] [⚙ Settings]      │
└─────────────────────────────────────────────────────────────────────────┘

                              ↕ WebSocket/HTTP

┌─────────────────────────────────────────────────────────────────────────┐
│                     COMPILATION SERVER (Optional)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  Emscripten     │  │  AlloLib        │  │  WASM Module            │  │
│  │  Toolchain      │→ │  Pre-compiled   │→ │  Generator              │  │
│  │  (emsdk)        │  │  Libraries      │  │                         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Compilation Strategy Options

**Option A: Server-Side Compilation (Recommended for Full Functionality)**
- User code sent to server
- Server compiles with Emscripten against pre-built AlloLib
- Returns WASM binary + JS glue code
- Best for complete C++ support

**Option B: Client-Side with Pre-compiled Runtime**
- AlloLib compiled to WASM library once
- User writes "scripts" that interact with pre-defined entry points
- Limited but instant compilation
- Good for educational/simple use cases

**Option C: Hybrid Approach (Best Balance)**
- Core AlloLib as pre-compiled WASM module
- Simple user code compiled client-side via wasm-clang
- Complex code sent to server
- Provides both quick iteration and full power

---

## 2. Technology Stack

### Frontend
```json
{
  "framework": "Vue 3 + TypeScript",
  "editor": "Monaco Editor",
  "ui": "Tailwind CSS + Headless UI",
  "state": "Pinia",
  "build": "Vite",
  "3d": "Raw WebGL2 (AlloLib handles this)",
  "audio": "Web Audio API + AudioWorklet"
}
```

### Backend (Compilation Server)
```json
{
  "runtime": "Node.js + Express / Fastify",
  "compilation": "Emscripten (emsdk)",
  "caching": "Redis (compiled module cache)",
  "queue": "Bull (compilation job queue)",
  "container": "Docker (isolated compilation)"
}
```

### AlloLib WASM Runtime
```json
{
  "compiler": "Emscripten 3.x",
  "target": "WebAssembly + WebGL2 + WebAudio",
  "threading": "SharedArrayBuffer + Web Workers",
  "filesystem": "MEMFS / IDBFS for persistence"
}
```

---

## 3. Phase 1: Project Setup & Infrastructure

### 3.1 Repository Structure Setup

```bash
# Create project structure
mkdir -p allolib-studio-online/{
  frontend/{src/{components,views,stores,utils,workers},public},
  backend/{src/{routes,services,workers},docker},
  allolib-wasm/{src,include,build},
  shared/{types,constants},
  docs,
  examples
}
```

### 3.2 Frontend Initialization

```bash
# Initialize Vue project
cd frontend
npm create vite@latest . -- --template vue-ts
npm install monaco-editor @monaco-editor/loader
npm install tailwindcss postcss autoprefixer
npm install pinia @vueuse/core
npm install xterm xterm-addon-fit  # Terminal emulator for console
npm install split.js  # Resizable split panes
```

### 3.3 Backend Initialization

```bash
# Initialize Node.js backend
cd backend
npm init -y
npm install express cors helmet
npm install bull ioredis  # Job queue
npm install ws  # WebSocket for real-time updates
npm install dockerode  # Docker SDK for sandboxed compilation
npm install typescript ts-node @types/node @types/express
```

### 3.4 Docker Configuration for Compilation

```dockerfile
# backend/docker/Dockerfile.compiler
FROM emscripten/emsdk:3.1.50

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    cmake \
    ninja-build \
    git \
    && rm -rf /var/lib/apt/lists/*

# Clone and build AlloLib for Emscripten
WORKDIR /allolib
RUN git clone --recursive https://github.com/AlloSphere-Research-Group/allolib.git .

# Pre-build AlloLib as static library for Emscripten
WORKDIR /allolib/build-wasm
RUN emcmake cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_EXAMPLES=OFF \
    -G Ninja
RUN ninja

# Setup compilation workspace
WORKDIR /workspace
COPY compile.sh /compile.sh
RUN chmod +x /compile.sh

ENTRYPOINT ["/compile.sh"]
```

---

## 4. Phase 2: AlloLib Emscripten Port

### 4.1 AlloLib Dependencies Analysis

AlloLib depends on several libraries that need Emscripten-compatible versions:

| Dependency | Emscripten Support | Solution |
|------------|-------------------|----------|
| OpenGL | ✅ WebGL2 | Use `-sUSE_WEBGL2=1` |
| GLFW | ✅ Emscripten port | Use `-sUSE_GLFW=3` |
| PortAudio | ❌ Not supported | Replace with Web Audio API |
| libsndfile | ⚠️ Partial | Use Emscripten port or JS alternative |
| Gamma | ✅ Header-only | Direct compilation |
| GLM | ✅ Header-only | Direct compilation |
| Dear ImGui | ✅ Emscripten examples | Use official Emscripten backend |

### 4.1.1 AlloLib Feature Coverage Matrix

Reference: `allolib/ALLOLIB_DOCUMENTATION.md`

#### Core Modules Required

| Module | Key Classes | Web Support | Implementation Notes |
|--------|-------------|-------------|---------------------|
| **App** | `App`, `AudioDomain`, `OpenGLGraphicsDomain`, `SimulationDomain` | ✅ Full | WebApp wrapper needed |
| **Graphics** | `Graphics`, `Mesh`, `Shader`, `ShaderProgram`, `Texture`, `Light` | ✅ Full | WebGL2 compatible |
| **Math** | `Vec2/3/4`, `Quat`, `Mat4`, `rnd::` functions | ✅ Full | Header-only, no changes |
| **Spatial** | `Pose`, `Nav` | ✅ Full | Header-only, no changes |
| **Audio** | `AudioIO`, `AudioIOData` | ⚠️ Custom | Web Audio API backend |
| **Sound** | `Spatializer`, `Ambisonics`, `Vbap`, `Dbap`, `StereoPanner` | ⚠️ Custom | AudioWorklet implementation |
| **Scene** | `SynthVoice`, `PolySynth`, `DynamicScene`, `PositionedVoice` | ✅ Full | Works with Web Audio backend |
| **Types** | `Color`, `Colori`, `HSV`, `RGB` | ✅ Full | Header-only, no changes |
| **UI** | `Parameter`, `ParameterServer` | ⚠️ Partial | OSC via WebSocket |
| **IO** | `Window`, `Keyboard`, `Mouse` | ✅ Full | Emscripten GLFW port |
| **Protocol** | `osc::Send`, `osc::Recv` | ⚠️ Custom | WebSocket bridge |

#### Shape Functions (al/graphics/al_Shapes.hpp)

All must be supported:
- `addSphere()` - Parametric sphere
- `addIcosphere()` - Icosahedral sphere
- `addCube()` - Box primitive
- `addCone()` - Cone/pyramid
- `addCylinder()` - Open cylinder
- `addTorus()` - Torus
- `addDisc()` - Disc/polygon
- `addPrism()` - Prism with twist
- `addAnnulus()` - Ring shape
- `addSurface()` - Height map surface
- `addWireBox()` - Wireframe box

#### Audio Processing Chain

```
User Code (onSound) → AudioIOData → Web Audio Backend → AudioWorklet → Speakers
                                         ↓
                              Spatializer (optional)
                              - Ambisonics
                              - VBAP
                              - DBAP
                              - StereoPanner
```

#### Scene/Synthesis Architecture

```
PolySynth/DynamicScene
    ├── Voice Pool (pre-allocated)
    │   ├── SynthVoice (audio only)
    │   └── PositionedVoice (audio + 3D position)
    ├── triggerOn(voice) → onTriggerOn() → active
    ├── triggerOff(voice) → onTriggerOff() → releasing
    └── render(io/g) → calls active voice onProcess()
```

### 4.2 CMake Configuration for Emscripten

```cmake
# allolib-wasm/CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(allolib-wasm)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Emscripten-specific settings
if(EMSCRIPTEN)
    set(CMAKE_EXECUTABLE_SUFFIX ".html")
    
    # Emscripten compiler flags
    set(EMSCRIPTEN_FLAGS
        "-sUSE_WEBGL2=1"
        "-sUSE_GLFW=3"
        "-sFULL_ES3=1"
        "-sALLOW_MEMORY_GROWTH=1"
        "-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString']"
        "-sEXPORTED_FUNCTIONS=['_main','_malloc','_free']"
        "-sASYNCIFY"
        "-sASYNCIFY_STACK_SIZE=65536"
        "-sPTHREAD_POOL_SIZE=4"
        "-sUSE_PTHREADS=1"
        "-sOFFSCREENCANVAS_SUPPORT=1"
        "--preload-file ${CMAKE_SOURCE_DIR}/assets@/assets"
    )
    
    string(REPLACE ";" " " EMSCRIPTEN_FLAGS_STR "${EMSCRIPTEN_FLAGS}")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${EMSCRIPTEN_FLAGS_STR}")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} ${EMSCRIPTEN_FLAGS_STR}")
endif()

# Include AlloLib
add_subdirectory(allolib)

# Audio backend replacement for Web
add_library(al_web_audio STATIC
    src/web_audio_backend.cpp
    src/web_audio_worklet.cpp
)

target_include_directories(al_web_audio PUBLIC include)
```

### 4.3 Web Audio Backend Implementation

```cpp
// allolib-wasm/src/web_audio_backend.cpp
#include "al/io/al_AudioIO.hpp"
#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/webaudio.h>

namespace al {

// Web Audio API integration using AudioWorklet
class WebAudioBackend {
public:
    static WebAudioBackend& instance() {
        static WebAudioBackend inst;
        return inst;
    }
    
    void initialize(int sampleRate, int bufferSize, int channels) {
        mSampleRate = sampleRate;
        mBufferSize = bufferSize;
        mChannels = channels;
        
        // Initialize Web Audio context via JavaScript
        EM_ASM({
            if (!window.alloAudioContext) {
                window.alloAudioContext = new AudioContext({
                    sampleRate: $0,
                    latencyHint: 'interactive'
                });
            }
        }, sampleRate);
    }
    
    void start(AudioCallback callback, void* userData) {
        mCallback = callback;
        mUserData = userData;
        
        // Create and connect AudioWorklet
        EM_ASM({
            const ctx = window.alloAudioContext;
            
            // Load AudioWorklet processor
            ctx.audioWorklet.addModule('allolib-audio-processor.js').then(() => {
                const node = new AudioWorkletNode(ctx, 'allolib-processor', {
                    numberOfInputs: 1,
                    numberOfOutputs: 1,
                    outputChannelCount: [$0],
                    processorOptions: {
                        bufferSize: $1
                    }
                });
                
                node.port.onmessage = (e) => {
                    if (e.data.type === 'requestBuffer') {
                        // Call back to C++ to fill buffer
                        const ptr = Module._malloc(e.data.size * 4);
                        Module._allolib_audio_callback(ptr, e.data.size);
                        const buffer = Module.HEAPF32.slice(ptr/4, ptr/4 + e.data.size);
                        node.port.postMessage({type: 'buffer', data: buffer});
                        Module._free(ptr);
                    }
                };
                
                node.connect(ctx.destination);
                window.alloAudioNode = node;
            });
        }, mChannels, mBufferSize);
    }
    
    void stop() {
        EM_ASM({
            if (window.alloAudioNode) {
                window.alloAudioNode.disconnect();
                window.alloAudioNode = null;
            }
        });
    }
    
private:
    int mSampleRate = 44100;
    int mBufferSize = 512;
    int mChannels = 2;
    AudioCallback mCallback = nullptr;
    void* mUserData = nullptr;
};

} // namespace al

// Exported function for AudioWorklet callback
extern "C" {
    EMSCRIPTEN_KEEPALIVE
    void allolib_audio_callback(float* buffer, int size) {
        // Route to AlloLib audio callback
        // Implementation depends on AlloLib's AudioIO interface
    }
}
```

### 4.4 AudioWorklet Processor

```javascript
// allolib-wasm/src/allolib-audio-processor.js
class AllolibProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.bufferSize = options.processorOptions?.bufferSize || 128;
        this.pendingBuffer = null;

        this.port.onmessage = (e) => {
            if (e.data.type === 'buffer') {
                this.pendingBuffer = e.data.data;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];

        // Request new buffer from main thread / WASM
        this.port.postMessage({
            type: 'requestBuffer',
            size: output[0].length * output.length
        });

        // Use pending buffer if available
        if (this.pendingBuffer) {
            for (let channel = 0; channel < output.length; channel++) {
                const channelData = output[channel];
                for (let i = 0; i < channelData.length; i++) {
                    channelData[i] = this.pendingBuffer[channel * channelData.length + i] || 0;
                }
            }
            this.pendingBuffer = null;
        }

        return true;
    }
}

registerProcessor('allolib-processor', AllolibProcessor);
```

### 4.5 Spatializer Web Audio Implementation

To support allolib's spatial audio features (Ambisonics, VBAP, DBAP, StereoPanner), we need custom AudioWorklet implementations:

```javascript
// allolib-wasm/src/spatializer-processor.js

// Base spatializer interface
class SpatializerProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.listenerPos = {x: 0, y: 0, z: 0};
        this.listenerQuat = {w: 1, x: 0, y: 0, z: 0};
        this.sources = new Map(); // sourceId -> {pos, buffer}

        this.port.onmessage = (e) => {
            switch(e.data.type) {
                case 'setListener':
                    this.listenerPos = e.data.pos;
                    this.listenerQuat = e.data.quat;
                    break;
                case 'addSource':
                    this.sources.set(e.data.id, {
                        pos: e.data.pos,
                        buffer: null
                    });
                    break;
                case 'updateSource':
                    if (this.sources.has(e.data.id)) {
                        this.sources.get(e.data.id).pos = e.data.pos;
                    }
                    break;
                case 'sourceBuffer':
                    if (this.sources.has(e.data.id)) {
                        this.sources.get(e.data.id).buffer = e.data.buffer;
                    }
                    break;
                case 'removeSource':
                    this.sources.delete(e.data.id);
                    break;
            }
        };
    }

    // Calculate distance attenuation
    calculateAttenuation(sourcePos, law = 'inverse') {
        const dx = sourcePos.x - this.listenerPos.x;
        const dy = sourcePos.y - this.listenerPos.y;
        const dz = sourcePos.z - this.listenerPos.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        switch(law) {
            case 'inverse': return 1 / Math.max(1, dist);
            case 'inverse_square': return 1 / Math.max(1, dist * dist);
            case 'linear': return Math.max(0, 1 - dist / 100);
            default: return 1;
        }
    }

    // Calculate pan position for stereo
    calculatePan(sourcePos) {
        // Transform source position to listener space
        const dx = sourcePos.x - this.listenerPos.x;
        const dz = sourcePos.z - this.listenerPos.z;
        const angle = Math.atan2(dx, -dz);
        return Math.sin(angle); // -1 = left, 0 = center, 1 = right
    }
}

// Stereo panner implementation
class StereoPannerProcessor extends SpatializerProcessor {
    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const left = output[0];
        const right = output[1];

        // Clear output
        left.fill(0);
        right.fill(0);

        // Mix all sources with spatial panning
        for (const [id, source] of this.sources) {
            if (!source.buffer) continue;

            const atten = this.calculateAttenuation(source.pos, 'inverse_square');
            const pan = this.calculatePan(source.pos);

            // Equal-power panning
            const leftGain = Math.cos((pan + 1) * Math.PI / 4) * atten;
            const rightGain = Math.sin((pan + 1) * Math.PI / 4) * atten;

            for (let i = 0; i < left.length && i < source.buffer.length; i++) {
                left[i] += source.buffer[i] * leftGain;
                right[i] += source.buffer[i] * rightGain;
            }
        }

        return true;
    }
}

registerProcessor('stereo-panner', StereoPannerProcessor);

// VBAP (Vector-Based Amplitude Panning) - simplified 2D version
class VBAPProcessor extends SpatializerProcessor {
    constructor(options) {
        super(options);
        // Speaker positions (configurable)
        this.speakers = options.processorOptions?.speakers || [
            {angle: -30}, {angle: 30}, {angle: -110}, {angle: 110}
        ];
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];

        // Clear all channels
        for (let ch = 0; ch < output.length; ch++) {
            output[ch].fill(0);
        }

        for (const [id, source] of this.sources) {
            if (!source.buffer) continue;

            const atten = this.calculateAttenuation(source.pos, 'inverse_square');
            const sourceAngle = Math.atan2(
                source.pos.x - this.listenerPos.x,
                -(source.pos.z - this.listenerPos.z)
            ) * 180 / Math.PI;

            // Find two closest speakers and calculate gains
            const gains = this.calculateVBAPGains(sourceAngle);

            for (let ch = 0; ch < Math.min(output.length, gains.length); ch++) {
                for (let i = 0; i < output[ch].length && i < source.buffer.length; i++) {
                    output[ch][i] += source.buffer[i] * gains[ch] * atten;
                }
            }
        }

        return true;
    }

    calculateVBAPGains(sourceAngle) {
        // Simplified VBAP for 2D speaker array
        const gains = new Array(this.speakers.length).fill(0);

        // Find the two speakers that bracket the source angle
        let minDiff = Infinity;
        let closest = 0;

        for (let i = 0; i < this.speakers.length; i++) {
            const diff = Math.abs(this.normalizeAngle(sourceAngle - this.speakers[i].angle));
            if (diff < minDiff) {
                minDiff = diff;
                closest = i;
            }
        }

        // Simple gain based on angular distance
        for (let i = 0; i < this.speakers.length; i++) {
            const diff = Math.abs(this.normalizeAngle(sourceAngle - this.speakers[i].angle));
            gains[i] = Math.max(0, 1 - diff / 90);
        }

        // Normalize gains
        const sum = gains.reduce((a, b) => a + b, 0);
        if (sum > 0) {
            for (let i = 0; i < gains.length; i++) {
                gains[i] /= sum;
            }
        }

        return gains;
    }

    normalizeAngle(angle) {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }
}

registerProcessor('vbap', VBAPProcessor);
```

### 4.6 Scene/Voice System Web Implementation

The PolySynth and DynamicScene systems need to work with the Web Audio backend:

```cpp
// allolib-wasm/include/al_web_scene.hpp
#pragma once

#include "al/scene/al_PolySynth.hpp"
#include "al/scene/al_DynamicScene.hpp"
#include <emscripten.h>

namespace al {

// Web-compatible PolySynth that integrates with AudioWorklet
class WebPolySynth : public PolySynth {
public:
    void render(AudioIOData& io) override {
        // Standard PolySynth render
        PolySynth::render(io);
    }

    // Expose voice state to JavaScript for visualization
    EM_JS(void, updateVoiceState, (int id, float x, float y, float z, bool active), {
        if (window.alloVoiceCallback) {
            window.alloVoiceCallback(id, x, y, z, active);
        }
    });

    void syncVoicesToJS() {
        int id = 0;
        for (auto* voice : voices()) {
            if (auto* pv = dynamic_cast<PositionedVoice*>(voice)) {
                updateVoiceState(id, pv->pos().x, pv->pos().y, pv->pos().z, voice->active());
            }
            id++;
        }
    }
};

// Web-compatible DynamicScene with spatial audio via AudioWorklet
class WebDynamicScene : public DynamicScene {
public:
    void render(AudioIOData& io) override {
        // Update listener pose in JavaScript spatializer
        EM_ASM({
            if (window.alloSpatializer) {
                window.alloSpatializer.postMessage({
                    type: 'setListener',
                    pos: {x: $0, y: $1, z: $2},
                    quat: {w: $3, x: $4, y: $5, z: $6}
                });
            }
        },
        listenerPose().pos().x, listenerPose().pos().y, listenerPose().pos().z,
        listenerPose().quat().w, listenerPose().quat().x,
        listenerPose().quat().y, listenerPose().quat().z);

        // Render voices
        DynamicScene::render(io);
    }
};

} // namespace al
```

### 4.5 AlloLib App Wrapper for Web

```cpp
// allolib-wasm/include/al_web_app.hpp
#pragma once

#include "al/app/al_App.hpp"
#include <emscripten.h>
#include <emscripten/html5.h>

namespace al {

// Modified App class for web environment
class WebApp : public App {
public:
    void start() override {
        // Initialize WebGL context
        EmscriptenWebGLContextAttributes attrs;
        emscripten_webgl_init_context_attributes(&attrs);
        attrs.majorVersion = 2;  // WebGL2
        attrs.minorVersion = 0;
        attrs.alpha = true;
        attrs.depth = true;
        attrs.stencil = true;
        attrs.antialias = true;
        attrs.preserveDrawingBuffer = false;
        
        EMSCRIPTEN_WEBGL_CONTEXT_HANDLE ctx = emscripten_webgl_create_context("#allolib-canvas", &attrs);
        emscripten_webgl_make_context_current(ctx);
        
        // Setup main loop
        onCreate();
        
        emscripten_set_main_loop_arg([](void* arg) {
            WebApp* app = static_cast<WebApp*>(arg);
            app->onAnimate(1.0/60.0);  // Assume 60fps
            app->onDraw(app->graphics());
        }, this, 0, 1);
    }
    
    void quit() {
        emscripten_cancel_main_loop();
    }
};

} // namespace al

// Macro for easy web app creation
#define ALLOLIB_WEB_MAIN(AppClass) \
    AppClass* gApp = nullptr; \
    extern "C" { \
        EMSCRIPTEN_KEEPALIVE void allolib_init() { \
            gApp = new AppClass(); \
            gApp->start(); \
        } \
        EMSCRIPTEN_KEEPALIVE void allolib_stop() { \
            if (gApp) { \
                gApp->quit(); \
                delete gApp; \
                gApp = nullptr; \
            } \
        } \
    }
```

---

## 5. Phase 3: Monaco Editor Integration

### 5.1 Monaco Editor Component

```vue
<!-- frontend/src/components/MonacoEditor.vue -->
<template>
  <div ref="editorContainer" class="h-full w-full"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as monaco from 'monaco-editor';
import { configureMonacoForAlloLib } from '@/utils/monaco-allolib';

const props = defineProps<{
  modelValue: string;
  language?: string;
  theme?: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'save': [];
  'compile': [];
}>();

const editorContainer = ref<HTMLElement>();
let editor: monaco.editor.IStandaloneCodeEditor | null = null;

onMounted(() => {
  if (!editorContainer.value) return;
  
  // Configure AlloLib-specific language features
  configureMonacoForAlloLib(monaco);
  
  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: props.language || 'cpp',
    theme: props.theme || 'vs-dark',
    readOnly: props.readOnly || false,
    automaticLayout: true,
    minimap: { enabled: true },
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontLigatures: true,
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    bracketPairColorization: { enabled: true },
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    tabSize: 4,
    insertSpaces: true,
  });
  
  // Handle content changes
  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor!.getValue());
  });
  
  // Keyboard shortcuts
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    emit('save');
  });
  
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    emit('compile');
  });
  
  // Add AlloLib-specific keyboard shortcuts
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR, () => {
    emit('compile');
  });
});

onUnmounted(() => {
  editor?.dispose();
});

watch(() => props.modelValue, (newValue) => {
  if (editor && editor.getValue() !== newValue) {
    editor.setValue(newValue);
  }
});

// Expose methods
defineExpose({
  getEditor: () => editor,
  focus: () => editor?.focus(),
  setValue: (value: string) => editor?.setValue(value),
  getValue: () => editor?.getValue() || '',
});
</script>
```

### 5.2 AlloLib Monaco Configuration

```typescript
// frontend/src/utils/monaco-allolib.ts
import * as monaco from 'monaco-editor';

export function configureMonacoForAlloLib(monacoInstance: typeof monaco) {
  // Register AlloLib code snippets
  monacoInstance.languages.registerCompletionItemProvider('cpp', {
    provideCompletionItems: (model, position) => {
      const suggestions: monaco.languages.CompletionItem[] = [
        // Basic App template
        {
          label: 'allolib-app',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `#include "al/app/al_App.hpp"
using namespace al;

struct MyApp : App {
    void onCreate() override {
        \${1:// Initialization}
    }
    
    void onAnimate(double dt) override {
        \${2:// Animation logic}
    }
    
    void onDraw(Graphics& g) override {
        g.clear(\${3:0, 0, 0});
        \${4:// Drawing code}
    }
    
    void onSound(AudioIOData& io) override {
        while (io()) {
            \${5:// Audio processing}
            io.out(0) = 0;
            io.out(1) = 0;
        }
    }
    
    bool onKeyDown(const Keyboard& k) override {
        \${6:// Key handling}
        return true;
    }
};

int main() {
    MyApp app;
    app.configureAudio(44100, 512, 2, 2);
    app.start();
    return 0;
}`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Complete AlloLib application template',
        },
        
        // Mesh creation
        {
          label: 'mesh-sphere',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Mesh mesh;
addSphere(mesh, \${1:1.0}, \${2:32}, \${3:32});
mesh.generateNormals();`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a sphere mesh',
        },
        
        // Sine oscillator
        {
          label: 'osc-sine',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `gam::Sine<> osc{\${1:440}};`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Gamma sine oscillator',
        },
        
        // Envelope
        {
          label: 'env-adsr',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `gam::ADSR<> env{
    \${1:0.01},  // attack
    \${2:0.1},   // decay
    \${3:0.7},   // sustain
    \${4:0.5}    // release
};`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Gamma ADSR envelope',
        },
        
        // Navigation
        {
          label: 'nav-setup',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `nav().pos(\${1:0}, \${2:0}, \${3:5});
nav().faceToward(Vec3f{0, 0, 0});`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Setup navigation/camera position',
        },
        
        // Color
        {
          label: 'color-hsv',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Color c = HSV{\${1:0.5}, \${2:1.0}, \${3:1.0}};`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create color from HSV',
        },
        
        // Shader
        {
          label: 'shader-basic',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `ShaderProgram shader;
shader.compile(R"(
#version 330
layout(location = 0) in vec3 position;
layout(location = 1) in vec4 color;
uniform mat4 al_ModelViewMatrix;
uniform mat4 al_ProjectionMatrix;
out vec4 vColor;
void main() {
    gl_Position = al_ProjectionMatrix * al_ModelViewMatrix * vec4(position, 1.0);
    vColor = color;
}
)", R"(
#version 330
in vec4 vColor;
out vec4 fragColor;
void main() {
    fragColor = vColor;
}
)");`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Basic vertex/fragment shader',
        },

        // === SCENE/SYNTHESIS SNIPPETS ===

        // SynthVoice
        {
          label: 'synthvoice',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `struct \${1:MyVoice} : SynthVoice {
    float freq = 440;
    float phase = 0;
    gam::ADSR<> env{0.01, 0.1, 0.7, 0.5};

    void onProcess(AudioIOData& io) override {
        while (io()) {
            float s = std::sin(phase * M_2PI) * env() * 0.3;
            io.out(0) = s;
            io.out(1) = s;
            phase += freq / io.framesPerSecond();
            if (phase >= 1) phase -= 1;
        }
        if (env.done()) free();
    }

    void onTriggerOn() override {
        phase = 0;
        env.reset();
    }

    void onTriggerOff() override {
        env.release();
    }
};`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'SynthVoice template for polyphonic synthesis',
        },

        // PolySynth usage
        {
          label: 'polysynth',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `PolySynth synth;

void onCreate() override {
    synth.allocatePolyphony<\${1:MyVoice}>(\${2:16});
}

void triggerNote(float freq) {
    auto* voice = synth.getVoice<\${1:MyVoice}>();
    voice->freq = freq;
    synth.triggerOn(voice);
}

void onSound(AudioIOData& io) override {
    synth.render(io);
}`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'PolySynth setup for polyphonic voice management',
        },

        // PositionedVoice for spatial audio
        {
          label: 'positionedvoice',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `struct \${1:SpatialVoice} : PositionedVoice {
    float freq = 440;
    float phase = 0;

    void onProcess(AudioIOData& io) override {
        while (io()) {
            float s = std::sin(phase * M_2PI) * 0.3;
            io.out(0) = s;
            phase += freq / io.framesPerSecond();
            if (phase >= 1) phase -= 1;
        }
    }

    void onProcess(Graphics& g) override {
        g.pushMatrix();
        Mesh m;
        addSphere(m, 0.1);
        g.color(1, 1, 0);
        g.draw(m);
        g.popMatrix();
    }

    void update(double dt) override {
        // Update position/animation
    }
};`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'PositionedVoice for 3D spatial audio',
        },

        // DynamicScene usage
        {
          label: 'dynamicscene',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `DynamicScene scene;

void onCreate() override {
    scene.distanceAttenuation().law(AttenuationLaw::ATTEN_INVERSE_SQUARE);

    for (int i = 0; i < \${1:4}; i++) {
        auto* voice = scene.getVoice<\${2:SpatialVoice}>();
        voice->pos(rnd::uniformS() * 5, rnd::uniformS() * 5, rnd::uniformS() * 5);
        scene.triggerOn(voice);
    }
}

void onAnimate(double dt) override {
    scene.update(dt);
}

void onDraw(Graphics& g) override {
    g.clear(0);
    scene.render(g);
}

void onSound(AudioIOData& io) override {
    scene.listenerPose(pose());
    scene.render(io);
}`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'DynamicScene for spatial audio scene management',
        },

        // === GRAPHICS SNIPPETS ===

        // All shape functions
        {
          label: 'mesh-icosphere',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Mesh mesh;
addIcosphere(mesh, \${1:1.0}, \${2:3});
mesh.generateNormals();`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create an icosahedral sphere mesh',
        },
        {
          label: 'mesh-cube',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Mesh mesh;
addCube(mesh, \${1:1.0});
mesh.generateNormals();`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a cube mesh',
        },
        {
          label: 'mesh-cone',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Mesh mesh;
addCone(mesh, \${1:1.0}, Vec3f(0, 0, \${2:2}), \${3:32});
mesh.generateNormals();`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a cone/pyramid mesh',
        },
        {
          label: 'mesh-cylinder',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Mesh mesh;
addCylinder(mesh, \${1:0.5}, \${2:2.0}, \${3:32});
mesh.generateNormals();`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create an open cylinder mesh',
        },
        {
          label: 'mesh-torus',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Mesh mesh;
addTorus(mesh, \${1:0.3}, \${2:0.7}, \${3:16}, \${4:32});
mesh.generateNormals();`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a torus mesh',
        },
        {
          label: 'mesh-disc',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Mesh mesh;
addDisc(mesh, \${1:1.0}, \${2:32});
mesh.generateNormals();`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a disc/polygon mesh',
        },
        {
          label: 'mesh-prism',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Mesh mesh;
addPrism(mesh, \${1:1.0}, \${2:0.5}, \${3:2.0}, \${4:6}, \${5:0.0});
mesh.generateNormals();`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a prism with optional twist',
        },
        {
          label: 'mesh-surface',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Mesh mesh;
addSurface(mesh, \${1:32}, \${2:32});
// Modify vertices for height map
for (auto& v : mesh.vertices()) {
    float r = hypot(v.x, v.y);
    v.z = exp(-8 * r * r);
}
mesh.generateNormals();`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Create a surface/height map mesh',
        },

        // Lighting setup
        {
          label: 'lighting-setup',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Light light;
light.pos(\${1:5}, \${2:5}, \${3:5});

void onDraw(Graphics& g) override {
    g.clear(0);
    g.depthTesting(true);
    g.lighting(true);
    g.light(light);
    g.meshColor();
    // draw meshes...
}`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Basic lighting setup',
        },

        // === UI PARAMETER SNIPPETS ===

        {
          label: 'parameter',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Parameter \${1:paramName}{"\\${2:displayName}", "\\${3:group}", \${4:0.5}, \${5:0.0}, \${6:1.0}};

void onCreate() override {
    \${1:paramName}.registerChangeCallback([this](float value) {
        // Handle parameter change
        \${7:// update something}
    });
}`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Thread-safe parameter with callback',
        },

        // === MATH SNIPPETS ===

        {
          label: 'vec3-operations',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Vec3f a(\${1:1}, \${2:0}, \${3:0});
Vec3f b(\${4:0}, \${5:1}, \${6:0});
float dot = a.dot(b);
Vec3f cross = a.cross(b);
float mag = a.mag();
Vec3f normalized = a.normalized();
Vec3f lerped = a.lerp(b, \${7:0.5});`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Common Vec3f operations',
        },

        {
          label: 'quat-rotation',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `Quatd q;
q.fromAxisAngle(\${1:M_PI/4}, Vec3d(\${2:0}, \${3:1}, \${4:0}));
// Or use slerp for smooth interpolation
Quatd q2 = Quatd::slerp(q1, q2, \${5:0.5});`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Quaternion rotation operations',
        },

        // === AUDIO SNIPPETS ===

        {
          label: 'audio-loop',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `void onSound(AudioIOData& io) override {
    while (io()) {
        // Read input (if available)
        float in0 = io.in(0);
        float in1 = io.in(1);

        // Generate/process audio
        float out = \${1:0.0f};

        // Write output
        io.out(0) = out;
        io.out(1) = out;
    }
}`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Standard audio processing loop',
        },

        {
          label: 'gamma-oscillators',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `// Gamma oscillators
gam::Sine<> sine{\${1:440}};
gam::Saw<> saw{\${2:220}};
gam::Square<> square{\${3:110}};
gam::Tri<> tri{\${4:330}};
gam::Noise noise;

// In onSound:
float s = sine() + saw() * 0.5 + square() * 0.3;`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Gamma library oscillators',
        },

        {
          label: 'gamma-filters',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `// Gamma filters
gam::Biquad<> lpf;
lpf.type(gam::FilterType::LP);
lpf.freq(\${1:1000});
lpf.res(\${2:1});

// In onSound:
float filtered = lpf(input);`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Gamma library filters',
        },
      ];

      return { suggestions };
    }
  });
  
  // Register hover provider for AlloLib types - COMPREHENSIVE COVERAGE
  // Reference: allolib/ALLOLIB_DOCUMENTATION.md
  monacoInstance.languages.registerHoverProvider('cpp', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const alloLibDocs: Record<string, string> = {
        // === APP MODULE ===
        'App': '**al::App**\n\nMain application class. Override:\n- `onCreate()` - initialization\n- `onAnimate(double dt)` - per-frame updates\n- `onDraw(Graphics& g)` - rendering\n- `onSound(AudioIOData& io)` - audio processing\n- `onKeyDown/Up(Keyboard&)` - keyboard events\n- `onMouseDown/Up/Drag/Move(Mouse&)` - mouse events',
        'AudioDomain': '**al::AudioDomain**\n\nManages the audio processing thread. Part of the domain architecture.',
        'OpenGLGraphicsDomain': '**al::OpenGLGraphicsDomain**\n\nManages the OpenGL rendering context and window.',
        'SimulationDomain': '**al::SimulationDomain**\n\nManages the update/simulation thread.',

        // === GRAPHICS MODULE ===
        'Graphics': '**al::Graphics**\n\nHigh-level rendering interface.\n\n**State:** `clear()`, `blending()`, `depthTesting()`, `culling()`, `lighting()`\n**Color:** `color()`, `meshColor()`, `texture()`, `tint()`\n**Transform:** `pushMatrix()`, `popMatrix()`, `translate()`, `rotate()`, `scale()`\n**Draw:** `draw(Mesh&)`, `shader()`',
        'Mesh': '**al::Mesh**\n\nVertex geometry container.\n\n**Primitives:** POINTS, LINES, LINE_STRIP, TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN\n**Methods:** `vertex()`, `color()`, `normal()`, `texCoord()`, `index()`, `generateNormals()`, `scale()`, `translate()`',
        'Shader': '**al::Shader**\n\nSingle shader stage (VERTEX, FRAGMENT, GEOMETRY).\n\n**Methods:** `source()`, `compile()`, `compiled()`, `log()`',
        'ShaderProgram': '**al::ShaderProgram**\n\nLinked shader program.\n\n**Methods:** `attach()`, `link()`, `begin()`, `end()`, `uniform()`, `uniformMatrix4()`, `attribute()`',
        'Texture': '**al::Texture**\n\nGPU texture (1D, 2D, 3D, Cubemap).\n\n**Methods:** `create2D()`, `bind()`, `unbind()`, `submit()`, `filter()`, `wrap()`',
        'Light': '**al::Light**\n\nLight source with position, ambient/diffuse/specular colors, attenuation.',

        // === MATH MODULE ===
        'Vec2f': '**al::Vec2f**\n\n2D float vector. Components: x, y\n\n**Ops:** +, -, *, /, `dot()`, `mag()`, `normalize()`, `lerp()`',
        'Vec2d': '**al::Vec2d**\n\n2D double vector. Components: x, y',
        'Vec3f': '**al::Vec3f**\n\n3D float vector. Components: x, y, z\n\n**Ops:** +, -, *, /, `dot()`, `cross()`, `mag()`, `normalize()`, `lerp()`',
        'Vec3d': '**al::Vec3d**\n\n3D double vector. Components: x, y, z',
        'Vec4f': '**al::Vec4f**\n\n4D float vector. Components: x, y, z, w',
        'Vec4d': '**al::Vec4d**\n\n4D double vector. Components: x, y, z, w',
        'Quatf': '**al::Quatf**\n\nFloat quaternion for 3D rotations.\n\n**Methods:** `normalize()`, `toVectorX/Y/Z()`, `toEuler()`\n**Static:** `identity()`, `slerp()`, `getRotationTo()`',
        'Quatd': '**al::Quatd**\n\nDouble quaternion for 3D rotations.',
        'Mat4f': '**al::Mat4f**\n\n4x4 float matrix.\n\n**Methods:** `identity()`, `transpose()`, `invert()`, `translate()`, `rotate()`, `scale()`',
        'Mat4d': '**al::Mat4d**\n\n4x4 double matrix.',

        // === SPATIAL MODULE ===
        'Pose': '**al::Pose**\n\nPosition + orientation in 3D.\n\n**Methods:** `pos()`, `quat()`, `faceToward()`, `matrix()`, `ux()`, `uy()`, `uz()`, `ur()`, `uu()`, `uf()`, `lerp()`',
        'Nav': '**al::Nav**\n\nNavigation (extends Pose).\n\n**Movement:** `moveF()`, `moveR()`, `moveU()`, `spin()`, `nudgeF/R/U()`\n**Control:** `step()`, `smooth()`, `halt()`',

        // === AUDIO MODULE ===
        'AudioIO': '**al::AudioIO**\n\nAudio stream manager.\n\n**Methods:** `init()`, `open()`, `close()`, `start()`, `stop()`, `channelsIn/Out()`, `framesPerSecond()`, `framesPerBuffer()`',
        'AudioIOData': '**al::AudioIOData**\n\nAudio buffer in callback.\n\n**Usage:**\n```cpp\nwhile(io()) {\n  float in = io.in(0);\n  io.out(0) = processed;\n}\n```\n**Methods:** `in()`, `out()`, `channelsIn/Out()`, `framesPerBuffer()`, `framesPerSecond()`, `frame()`',

        // === SOUND/SPATIALIZER MODULE ===
        'Spatializer': '**al::Spatializer**\n\nAbstract base for spatialization.\n\n**Methods:** `compile()`, `renderSample()`, `renderBuffer()`',
        'Ambisonics': '**al::Ambisonics**\n\nAmbisonic encoding/decoding spatializer.',
        'Vbap': '**al::Vbap**\n\nVector-Based Amplitude Panning spatializer.',
        'Dbap': '**al::Dbap**\n\nDistance-Based Amplitude Panning spatializer.',
        'StereoPanner': '**al::StereoPanner**\n\nSimple stereo panning spatializer.',

        // === SCENE MODULE ===
        'SynthVoice': '**al::SynthVoice**\n\nPolyphonic voice base class.\n\n**Override:** `onProcess(AudioIOData&)`, `onProcess(Graphics&)`, `onTriggerOn()`, `onTriggerOff()`, `update(double dt)`\n**State:** `active()`, `free()`, `id()`\n**Params:** `createInternalTriggerParameter()`, `setTriggerParams()`',
        'PolySynth': '**al::PolySynth**\n\nVoice manager.\n\n**Methods:** `allocatePolyphony<T>(count)`, `getVoice<T>()`, `triggerOn()`, `triggerOff()`, `render(io)`, `render(g)`',
        'DynamicScene': '**al::DynamicScene**\n\nScene with spatial audio (extends PolySynth).\n\n**Methods:** `listenerPose()`, `render(io)` - spatially renders all positioned voices',
        'PositionedVoice': '**al::PositionedVoice**\n\nSynthVoice with 3D position (extends SynthVoice + Pose).\n\nAutomatically spatialized in DynamicScene.',

        // === TYPES MODULE ===
        'Color': '**al::Color**\n\nRGBA float color [0-1].\n\n**Constructors:** `Color(r,g,b,a)`, `Color(gray,alpha)`, `Color(HSV,alpha)`\n**Methods:** `set()`, `invert()`, `luminance()`, `mix()`',
        'Colori': '**al::Colori**\n\nRGBA uint8 color [0-255].',
        'HSV': '**al::HSV**\n\nHue-Saturation-Value color.\n\n**Components:** h, s, v [0-1]\n**Methods:** `rotateHue()`, `wrapHue()`',
        'RGB': '**al::RGB**\n\nRGB color (no alpha).',

        // === UI MODULE ===
        'Parameter': '**al::Parameter**\n\nThread-safe parameter with callbacks.\n\n**Methods:** `set()`, `get()`, `min()`, `max()`, `registerChangeCallback()`, `getName()`, `getGroup()`',
        'ParameterServer': '**al::ParameterServer**\n\nOSC server for parameters.\n\n**Methods:** `registerParameter()` - address: /group/parameter',

        // === IO MODULE ===
        'Window': '**al::Window**\n\nWindow management.\n\n**Methods:** `create()`, `close()`, `dimensions()`, `fullScreen()`, `title()`',
        'Keyboard': '**al::Keyboard**\n\nKeyboard state.\n\n**Methods:** `key()`, `isDown()`, `ctrl()`, `shift()`, `alt()`\n**Constants:** RETURN, SPACE, TAB, ESC, A-Z, 0-9, arrows, F-keys',
        'Mouse': '**al::Mouse**\n\nMouse state.\n\n**Methods:** `x()`, `y()`, `dx()`, `dy()`, `button()`, `left()`, `right()`, `middle()`, `scrollX()`, `scrollY()`',

        // === RANDOM MODULE ===
        'rnd': '**al::rnd namespace**\n\nRandom number generation.\n\n**Functions:**\n- `uniform()` - [0, 1)\n- `uniformS()` - [-1, 1)\n- `uniform(hi)` - [0, hi)\n- `prob(p)` - bool with probability p\n- `gaussian()` - normal distribution',
      };

      const doc = alloLibDocs[word.word];
      if (doc) {
        return {
          contents: [{ value: doc }]
        };
      }

      return null;
    }
  });
  
  // Custom theme with AlloLib colors
  monacoInstance.editor.defineTheme('allolib-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'C586C0' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'comment', foreground: '6A9955' },
    ],
    colors: {
      'editor.background': '#1a1a2e',
      'editor.foreground': '#eaeaea',
      'editorLineNumber.foreground': '#5a5a7a',
      'editor.selectionBackground': '#3a3a5a',
      'editor.lineHighlightBackground': '#2a2a4a',
    }
  });
}
```

### 5.3 Error Diagnostics Integration

```typescript
// frontend/src/utils/diagnostics.ts
import * as monaco from 'monaco-editor';

export interface CompilationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export function setEditorDiagnostics(
  editor: monaco.editor.IStandaloneCodeEditor,
  errors: CompilationError[]
) {
  const model = editor.getModel();
  if (!model) return;
  
  const markers: monaco.editor.IMarkerData[] = errors.map(error => ({
    severity: error.severity === 'error' 
      ? monaco.MarkerSeverity.Error 
      : error.severity === 'warning'
        ? monaco.MarkerSeverity.Warning
        : monaco.MarkerSeverity.Info,
    startLineNumber: error.line,
    startColumn: error.column,
    endLineNumber: error.line,
    endColumn: error.column + 10,
    message: error.message,
    source: 'AlloLib Compiler',
  }));
  
  monaco.editor.setModelMarkers(model, 'allolib', markers);
}

export function clearEditorDiagnostics(editor: monaco.editor.IStandaloneCodeEditor) {
  const model = editor.getModel();
  if (!model) return;
  monaco.editor.setModelMarkers(model, 'allolib', []);
}

// Parse Emscripten/clang error output
export function parseCompilerOutput(output: string): CompilationError[] {
  const errors: CompilationError[] = [];
  const regex = /^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/gm;
  
  let match;
  while ((match = regex.exec(output)) !== null) {
    errors.push({
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: match[5],
      severity: match[4] as 'error' | 'warning' | 'info',
    });
  }
  
  return errors;
}
```

---

## 6. Phase 4: Compilation Pipeline

### 6.1 Compilation Service (Backend)

```typescript
// backend/src/services/compiler.ts
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import Redis from 'ioredis';
import crypto from 'crypto';

interface CompilationResult {
  success: boolean;
  wasmUrl?: string;
  jsUrl?: string;
  errors?: string;
  warnings?: string;
  compilationTime?: number;
}

export class CompilerService {
  private redis: Redis;
  private workDir: string;
  private allolibPath: string;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.workDir = process.env.WORK_DIR || '/tmp/allolib-compile';
    this.allolibPath = process.env.ALLOLIB_PATH || '/allolib';
  }
  
  // Generate cache key from source code
  private getCacheKey(source: string): string {
    return crypto.createHash('sha256').update(source).digest('hex');
  }
  
  async compile(source: string): Promise<CompilationResult> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(source);
    
    // Check cache first
    const cached = await this.redis.get(`compile:${cacheKey}`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const jobId = uuidv4();
    const jobDir = path.join(this.workDir, jobId);
    
    try {
      await fs.mkdir(jobDir, { recursive: true });
      
      // Write source file
      const sourcePath = path.join(jobDir, 'main.cpp');
      await fs.writeFile(sourcePath, this.wrapSource(source));
      
      // Compile with Emscripten
      const result = await this.runEmscripten(jobDir, sourcePath);
      
      if (result.success) {
        // Move output files to static serving directory
        const outputDir = path.join(process.env.OUTPUT_DIR || '/output', jobId);
        await fs.mkdir(outputDir, { recursive: true });
        
        await fs.rename(
          path.join(jobDir, 'main.wasm'),
          path.join(outputDir, 'main.wasm')
        );
        await fs.rename(
          path.join(jobDir, 'main.js'),
          path.join(outputDir, 'main.js')
        );
        
        // Copy AudioWorklet processor
        await fs.copyFile(
          path.join(this.allolibPath, 'src', 'allolib-audio-processor.js'),
          path.join(outputDir, 'allolib-audio-processor.js')
        );
        
        result.wasmUrl = `/output/${jobId}/main.wasm`;
        result.jsUrl = `/output/${jobId}/main.js`;
        result.compilationTime = Date.now() - startTime;
        
        // Cache successful compilations for 1 hour
        await this.redis.setex(
          `compile:${cacheKey}`,
          3600,
          JSON.stringify(result)
        );
      }
      
      return result;
    } finally {
      // Cleanup job directory
      await fs.rm(jobDir, { recursive: true, force: true });
    }
  }
  
  private wrapSource(source: string): string {
    // Add web-specific includes and main wrapper if needed
    const hasMain = source.includes('int main(');
    const hasWebInclude = source.includes('al_web_app.hpp');
    
    let wrapped = source;
    
    if (!hasWebInclude) {
      wrapped = `#include "al_web_app.hpp"\n${wrapped}`;
    }
    
    // If no main, assume it's an App class and add web main
    if (!hasMain) {
      // Try to detect App class name
      const classMatch = source.match(/struct\s+(\w+)\s*:\s*(?:public\s+)?(?:al::)?App/);
      if (classMatch) {
        wrapped += `\n\nALLOLIB_WEB_MAIN(${classMatch[1]})\n`;
      }
    }
    
    return wrapped;
  }
  
  private async runEmscripten(jobDir: string, sourcePath: string): Promise<CompilationResult> {
    return new Promise((resolve) => {
      const args = [
        sourcePath,
        '-o', path.join(jobDir, 'main.js'),
        `-I${this.allolibPath}/include`,
        `-I${this.allolibPath}/external/Gamma`,
        `-I${this.allolibPath}/external/glm`,
        `-L${this.allolibPath}/build-wasm/lib`,
        '-lal',
        '-lGamma',
        '-std=c++17',
        '-O2',
        '-sUSE_WEBGL2=1',
        '-sUSE_GLFW=3',
        '-sFULL_ES3=1',
        '-sALLOW_MEMORY_GROWTH=1',
        '-sEXPORTED_RUNTIME_METHODS=["ccall","cwrap","UTF8ToString"]',
        '-sEXPORTED_FUNCTIONS=["_main","_malloc","_free","_allolib_init","_allolib_stop"]',
        '-sASYNCIFY',
        '-sASYNCIFY_STACK_SIZE=65536',
        '--bind',
      ];
      
      const proc = spawn('em++', args, {
        cwd: jobDir,
        env: { ...process.env, EMCC_CFLAGS: '-fexceptions' }
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => { stdout += data; });
      proc.stderr.on('data', (data) => { stderr += data; });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            warnings: stderr.includes('warning:') ? stderr : undefined,
          });
        } else {
          resolve({
            success: false,
            errors: stderr,
          });
        }
      });
      
      proc.on('error', (err) => {
        resolve({
          success: false,
          errors: err.message,
        });
      });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        proc.kill();
        resolve({
          success: false,
          errors: 'Compilation timeout (60s)',
        });
      }, 60000);
    });
  }
}
```

### 6.2 Compilation API Routes

```typescript
// backend/src/routes/compile.ts
import { Router } from 'express';
import { CompilerService } from '../services/compiler';
import rateLimit from 'express-rate-limit';

const router = Router();
const compiler = new CompilerService();

// Rate limiting
const compileLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 compilations per minute
  message: { error: 'Too many compilation requests. Please wait.' }
});

router.post('/compile', compileLimiter, async (req, res) => {
  try {
    const { source } = req.body;
    
    if (!source || typeof source !== 'string') {
      return res.status(400).json({ error: 'Source code is required' });
    }
    
    if (source.length > 100000) {
      return res.status(400).json({ error: 'Source code too large (max 100KB)' });
    }
    
    const result = await compiler.compile(source);
    res.json(result);
  } catch (error) {
    console.error('Compilation error:', error);
    res.status(500).json({ error: 'Internal compilation error' });
  }
});

// WebSocket endpoint for real-time compilation progress
router.ws('/compile/stream', (ws, req) => {
  ws.on('message', async (msg) => {
    try {
      const { source } = JSON.parse(msg.toString());
      
      ws.send(JSON.stringify({ status: 'compiling' }));
      
      const result = await compiler.compile(source);
      
      ws.send(JSON.stringify({ status: 'complete', result }));
    } catch (error) {
      ws.send(JSON.stringify({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  });
});

export default router;
```

### 6.3 Frontend Compilation Service

```typescript
// frontend/src/services/compiler.ts
import { ref, Ref } from 'vue';

export interface CompilationResult {
  success: boolean;
  wasmUrl?: string;
  jsUrl?: string;
  errors?: string;
  warnings?: string;
  compilationTime?: number;
}

export interface CompilationState {
  isCompiling: boolean;
  progress: string;
  result: CompilationResult | null;
}

export function useCompiler() {
  const state: Ref<CompilationState> = ref({
    isCompiling: false,
    progress: '',
    result: null,
  });
  
  const compile = async (source: string): Promise<CompilationResult> => {
    state.value.isCompiling = true;
    state.value.progress = 'Sending to compiler...';
    state.value.result = null;
    
    try {
      // Use WebSocket for real-time updates
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${import.meta.env.VITE_WS_URL}/compile/stream`);
        
        ws.onopen = () => {
          ws.send(JSON.stringify({ source }));
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.status === 'compiling') {
            state.value.progress = 'Compiling...';
          } else if (data.status === 'complete') {
            state.value.result = data.result;
            state.value.isCompiling = false;
            ws.close();
            resolve(data.result);
          } else if (data.status === 'error') {
            state.value.isCompiling = false;
            ws.close();
            reject(new Error(data.error));
          }
        };
        
        ws.onerror = (error) => {
          state.value.isCompiling = false;
          reject(error);
        };
        
        // Fallback timeout
        setTimeout(() => {
          if (state.value.isCompiling) {
            state.value.isCompiling = false;
            ws.close();
            reject(new Error('Compilation timeout'));
          }
        }, 120000);
      });
    } catch (error) {
      state.value.isCompiling = false;
      throw error;
    }
  };
  
  // Fallback to HTTP if WebSocket fails
  const compileHttp = async (source: string): Promise<CompilationResult> => {
    state.value.isCompiling = true;
    state.value.progress = 'Compiling...';
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      
      if (!response.ok) {
        throw new Error('Compilation request failed');
      }
      
      const result = await response.json();
      state.value.result = result;
      return result;
    } finally {
      state.value.isCompiling = false;
    }
  };
  
  return {
    state,
    compile,
    compileHttp,
  };
}
```

---

## 7. Phase 5: Runtime & Viewer

### 7.1 WASM Runtime Loader

```typescript
// frontend/src/services/runtime.ts
export interface AllolibRuntime {
  module: WebAssembly.Module;
  instance: any; // Emscripten Module instance
  canvas: HTMLCanvasElement;
  audioContext: AudioContext;
}

export class RuntimeManager {
  private runtime: AllolibRuntime | null = null;
  private canvas: HTMLCanvasElement;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }
  
  async load(jsUrl: string, wasmUrl: string): Promise<void> {
    // Stop any existing runtime
    await this.stop();
    
    // Setup canvas
    this.canvas.id = 'allolib-canvas';
    
    // Create audio context (must be after user interaction)
    const audioContext = new AudioContext({
      sampleRate: 44100,
      latencyHint: 'interactive',
    });
    
    // Dynamically load the Emscripten-generated JS
    return new Promise((resolve, reject) => {
      // Create script element
      const script = document.createElement('script');
      script.src = jsUrl;
      
      // Setup Module configuration before script loads
      (window as any).Module = {
        canvas: this.canvas,
        
        // Emscripten configuration
        print: (text: string) => console.log('[AlloLib]', text),
        printErr: (text: string) => console.error('[AlloLib Error]', text),
        
        // Override audio initialization
        preRun: [
          () => {
            (window as any).alloAudioContext = audioContext;
          }
        ],
        
        // Called when runtime is ready
        onRuntimeInitialized: () => {
          console.log('AlloLib runtime initialized');
          
          // Initialize the app
          if ((window as any).Module._allolib_init) {
            (window as any).Module._allolib_init();
          }
          
          this.runtime = {
            module: (window as any).Module.wasmModule,
            instance: (window as any).Module,
            canvas: this.canvas,
            audioContext,
          };
          
          resolve();
        },
        
        // Handle WebGL context
        onAbort: (what: any) => {
          console.error('AlloLib aborted:', what);
          reject(new Error(`Runtime aborted: ${what}`));
        },
      };
      
      script.onerror = () => reject(new Error('Failed to load runtime script'));
      document.body.appendChild(script);
    });
  }
  
  async stop(): Promise<void> {
    if (this.runtime) {
      // Call AlloLib stop function
      if ((window as any).Module?._allolib_stop) {
        (window as any).Module._allolib_stop();
      }
      
      // Close audio context
      if (this.runtime.audioContext.state !== 'closed') {
        await this.runtime.audioContext.close();
      }
      
      // Clear runtime
      this.runtime = null;
      
      // Clean up global Module
      delete (window as any).Module;
      delete (window as any).alloAudioContext;
    }
  }
  
  isRunning(): boolean {
    return this.runtime !== null;
  }
  
  getAudioContext(): AudioContext | null {
    return this.runtime?.audioContext || null;
  }
}
```

### 7.2 Viewer Component

```vue
<!-- frontend/src/components/AllolibViewer.vue -->
<template>
  <div class="relative h-full w-full bg-black">
    <!-- WebGL Canvas -->
    <canvas
      ref="canvasRef"
      class="h-full w-full"
      @contextmenu.prevent
      tabindex="0"
    ></canvas>
    
    <!-- Loading overlay -->
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-black/80"
    >
      <div class="text-center">
        <div class="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p class="text-white">{{ loadingMessage }}</p>
      </div>
    </div>
    
    <!-- Error overlay -->
    <div
      v-if="error"
      class="absolute inset-0 flex items-center justify-center bg-black/90 p-4"
    >
      <div class="max-w-md text-center">
        <div class="mb-4 text-4xl">⚠️</div>
        <h3 class="mb-2 text-xl font-bold text-red-400">Runtime Error</h3>
        <pre class="whitespace-pre-wrap text-left text-sm text-red-300">{{ error }}</pre>
        <button
          @click="$emit('retry')"
          class="mt-4 rounded bg-primary px-4 py-2 text-white hover:bg-primary-dark"
        >
          Retry
        </button>
      </div>
    </div>
    
    <!-- Controls overlay -->
    <div class="absolute bottom-4 right-4 flex gap-2">
      <button
        @click="toggleFullscreen"
        class="rounded bg-white/10 p-2 text-white hover:bg-white/20"
        title="Fullscreen"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
      <button
        v-if="audioEnabled"
        @click="toggleAudio"
        class="rounded bg-white/10 p-2 text-white hover:bg-white/20"
        :title="audioMuted ? 'Unmute' : 'Mute'"
      >
        <svg v-if="!audioMuted" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
        <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
      </button>
    </div>
    
    <!-- FPS counter -->
    <div v-if="showFps" class="absolute left-4 top-4 rounded bg-black/50 px-2 py-1 text-sm text-white">
      {{ fps }} FPS
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { RuntimeManager } from '@/services/runtime';

const props = defineProps<{
  jsUrl?: string;
  wasmUrl?: string;
  showFps?: boolean;
}>();

const emit = defineEmits<{
  'ready': [];
  'error': [error: string];
  'retry': [];
}>();

const canvasRef = ref<HTMLCanvasElement>();
const loading = ref(false);
const loadingMessage = ref('Initializing...');
const error = ref<string | null>(null);
const audioEnabled = ref(false);
const audioMuted = ref(false);
const fps = ref(0);

let runtime: RuntimeManager | null = null;
let fpsInterval: number | null = null;

onMounted(() => {
  if (canvasRef.value) {
    runtime = new RuntimeManager(canvasRef.value);
    
    // Start FPS counter
    if (props.showFps) {
      let frameCount = 0;
      let lastTime = performance.now();
      
      const updateFps = () => {
        const now = performance.now();
        frameCount++;
        
        if (now - lastTime >= 1000) {
          fps.value = frameCount;
          frameCount = 0;
          lastTime = now;
        }
        
        fpsInterval = requestAnimationFrame(updateFps);
      };
      
      updateFps();
    }
  }
});

onUnmounted(async () => {
  if (fpsInterval) {
    cancelAnimationFrame(fpsInterval);
  }
  await runtime?.stop();
});

watch(() => [props.jsUrl, props.wasmUrl], async ([jsUrl, wasmUrl]) => {
  if (jsUrl && wasmUrl && runtime) {
    await loadRuntime(jsUrl, wasmUrl);
  }
});

async function loadRuntime(jsUrl: string, wasmUrl: string) {
  loading.value = true;
  loadingMessage.value = 'Loading WebAssembly module...';
  error.value = null;
  
  try {
    await runtime?.load(jsUrl, wasmUrl);
    audioEnabled.value = runtime?.getAudioContext() !== null;
    loading.value = false;
    emit('ready');
  } catch (e) {
    loading.value = false;
    error.value = e instanceof Error ? e.message : 'Unknown error';
    emit('error', error.value);
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    canvasRef.value?.parentElement?.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

function toggleAudio() {
  const ctx = runtime?.getAudioContext();
  if (ctx) {
    if (audioMuted.value) {
      ctx.resume();
    } else {
      ctx.suspend();
    }
    audioMuted.value = !audioMuted.value;
  }
}

defineExpose({
  loadRuntime,
  stop: () => runtime?.stop(),
});
</script>
```

---

## 8. Phase 6: UI/UX Implementation

### 8.1 Main Application Layout

```vue
<!-- frontend/src/App.vue -->
<template>
  <div class="flex h-screen flex-col bg-gray-900 text-white">
    <!-- Toolbar -->
    <Toolbar
      :is-running="isRunning"
      :is-compiling="compiler.state.value.isCompiling"
      @run="handleRun"
      @stop="handleStop"
      @save="handleSave"
      @load-example="handleLoadExample"
      @settings="showSettings = true"
    />
    
    <!-- Main content area with split panes -->
    <div class="flex-1 overflow-hidden">
      <Split
        class="flex h-full"
        :sizes="[50, 50]"
        :min-size="[300, 300]"
        :gutter-size="8"
        direction="horizontal"
      >
        <!-- Left pane: Editor + Console -->
        <div class="flex h-full flex-col">
          <Split
            class="flex h-full flex-col"
            :sizes="[70, 30]"
            :min-size="[200, 100]"
            :gutter-size="8"
            direction="vertical"
          >
            <!-- Editor -->
            <div class="overflow-hidden">
              <MonacoEditor
                ref="editorRef"
                v-model="code"
                theme="allolib-dark"
                @save="handleSave"
                @compile="handleRun"
              />
            </div>
            
            <!-- Console -->
            <div class="overflow-hidden">
              <Console
                :logs="consoleLogs"
                :errors="compilerErrors"
                @clear="consoleLogs = []"
              />
            </div>
          </Split>
        </div>
        
        <!-- Right pane: Viewer -->
        <div class="overflow-hidden">
          <AllolibViewer
            ref="viewerRef"
            :js-url="runtimeUrls.js"
            :wasm-url="runtimeUrls.wasm"
            :show-fps="settings.showFps"
            @ready="isRunning = true"
            @error="handleRuntimeError"
            @retry="handleRun"
          />
        </div>
      </Split>
    </div>
    
    <!-- Modals -->
    <SettingsModal v-model="showSettings" v-model:settings="settings" />
    <ExamplesModal v-model="showExamples" @select="handleLoadExample" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import Split from 'vue-split-panel';
import MonacoEditor from '@/components/MonacoEditor.vue';
import AllolibViewer from '@/components/AllolibViewer.vue';
import Console from '@/components/Console.vue';
import Toolbar from '@/components/Toolbar.vue';
import SettingsModal from '@/components/SettingsModal.vue';
import ExamplesModal from '@/components/ExamplesModal.vue';
import { useCompiler } from '@/services/compiler';
import { parseCompilerOutput, setEditorDiagnostics } from '@/utils/diagnostics';
import { DEFAULT_CODE } from '@/constants/defaults';
import { saveToLocalStorage, loadFromLocalStorage } from '@/utils/storage';

const editorRef = ref();
const viewerRef = ref();

const code = ref(loadFromLocalStorage('code') || DEFAULT_CODE);
const isRunning = ref(false);
const consoleLogs = ref<string[]>([]);
const compilerErrors = ref<any[]>([]);
const showSettings = ref(false);
const showExamples = ref(false);

const compiler = useCompiler();

const runtimeUrls = reactive({
  js: '',
  wasm: '',
});

const settings = reactive({
  showFps: true,
  autoSave: true,
  fontSize: 14,
  theme: 'allolib-dark',
});

// Auto-save
watch(code, (newCode) => {
  if (settings.autoSave) {
    saveToLocalStorage('code', newCode);
  }
}, { debounce: 1000 } as any);

async function handleRun() {
  consoleLogs.value.push('[System] Compiling...');
  compilerErrors.value = [];
  
  try {
    const result = await compiler.compile(code.value);
    
    if (result.success) {
      consoleLogs.value.push(`[System] Compilation successful (${result.compilationTime}ms)`);
      
      if (result.warnings) {
        consoleLogs.value.push(`[Warning] ${result.warnings}`);
      }
      
      // Load the compiled module
      runtimeUrls.js = result.jsUrl!;
      runtimeUrls.wasm = result.wasmUrl!;
    } else {
      consoleLogs.value.push('[Error] Compilation failed');
      consoleLogs.value.push(result.errors || 'Unknown error');
      
      // Parse and display errors in editor
      compilerErrors.value = parseCompilerOutput(result.errors || '');
      setEditorDiagnostics(editorRef.value?.getEditor(), compilerErrors.value);
    }
  } catch (error) {
    consoleLogs.value.push(`[Error] ${error}`);
  }
}

async function handleStop() {
  await viewerRef.value?.stop();
  isRunning.value = false;
  consoleLogs.value.push('[System] Stopped');
}

function handleSave() {
  saveToLocalStorage('code', code.value);
  consoleLogs.value.push('[System] Saved to browser storage');
}

function handleLoadExample(exampleCode: string) {
  code.value = exampleCode;
  showExamples.value = false;
}

function handleRuntimeError(error: string) {
  isRunning.value = false;
  consoleLogs.value.push(`[Runtime Error] ${error}`);
}
</script>
```

### 8.2 Toolbar Component

```vue
<!-- frontend/src/components/Toolbar.vue -->
<template>
  <div class="flex items-center gap-2 border-b border-gray-700 bg-gray-800 px-4 py-2">
    <!-- Logo -->
    <div class="flex items-center gap-2">
      <img src="/logo.svg" alt="AlloLib" class="h-8 w-8" />
      <span class="font-bold">AlloLib Studio</span>
    </div>
    
    <div class="mx-4 h-6 w-px bg-gray-600"></div>
    
    <!-- Run/Stop -->
    <button
      @click="isRunning ? $emit('stop') : $emit('run')"
      :disabled="isCompiling"
      :class="[
        'flex items-center gap-2 rounded px-4 py-2 font-medium transition',
        isRunning
          ? 'bg-red-600 hover:bg-red-700'
          : 'bg-green-600 hover:bg-green-700',
        isCompiling && 'cursor-not-allowed opacity-50'
      ]"
    >
      <template v-if="isCompiling">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
        Compiling...
      </template>
      <template v-else-if="isRunning">
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" />
        </svg>
        Stop
      </template>
      <template v-else>
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        Run
      </template>
    </button>
    
    <!-- Examples -->
    <button
      @click="$emit('load-example')"
      class="flex items-center gap-2 rounded bg-gray-700 px-4 py-2 hover:bg-gray-600"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      Examples
    </button>
    
    <div class="flex-1"></div>
    
    <!-- Save -->
    <button
      @click="$emit('save')"
      class="flex items-center gap-2 rounded bg-gray-700 px-4 py-2 hover:bg-gray-600"
      title="Save (Ctrl+S)"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
      </svg>
      Save
    </button>
    
    <!-- Settings -->
    <button
      @click="$emit('settings')"
      class="rounded p-2 hover:bg-gray-700"
      title="Settings"
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
    
    <!-- GitHub -->
    <a
      href="https://github.com/AlloSphere-Research-Group/allolib-studio-online"
      target="_blank"
      class="rounded p-2 hover:bg-gray-700"
      title="GitHub"
    >
      <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    </a>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isRunning: boolean;
  isCompiling: boolean;
}>();

defineEmits<{
  'run': [];
  'stop': [];
  'save': [];
  'load-example': [];
  'settings': [];
}>();
</script>
```

---

## 9. Phase 7: Advanced Features

### 9.1 Example Projects Library

```typescript
// frontend/src/constants/examples.ts
export interface Example {
  id: string;
  title: string;
  description: string;
  category: 'basics' | 'graphics' | 'audio' | 'interaction' | 'advanced';
  code: string;
}

// COMPREHENSIVE EXAMPLES covering all major AlloLib features
// Reference: allolib/ALLOLIB_DOCUMENTATION.md

export const EXAMPLES: Example[] = [
  // === BASICS CATEGORY ===
  {
    id: 'hello-sphere',
    title: 'Hello Sphere',
    description: 'A simple rotating sphere with colors',
    category: 'basics',
    code: `#include "al/app/al_App.hpp"
using namespace al;

struct HelloSphere : App {
    Mesh mesh;
    double phase = 0;

    void onCreate() override {
        addSphere(mesh, 1.0, 32, 32);
        mesh.generateNormals();
        nav().pos(0, 0, 5);
    }

    void onAnimate(double dt) override {
        phase += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1);
        g.depthTesting(true);
        g.lighting(true);

        g.rotate(phase * 30, 0, 1, 0);
        g.color(HSV(phase * 0.1, 1, 1));
        g.draw(mesh);
    }
};

int main() {
    HelloSphere app;
    app.start();
    return 0;
}`,
  },

  {
    id: 'shape-gallery',
    title: 'Shape Gallery',
    description: 'All AlloLib shape primitives',
    category: 'basics',
    code: `#include "al/app/al_App.hpp"
#include "al/graphics/al_Shapes.hpp"
using namespace al;

struct ShapeGallery : App {
    static const int NUM_SHAPES = 9;
    Mesh meshes[NUM_SHAPES];
    double angle = 0;
    Light light;

    void onCreate() override {
        nav().pullBack(8);
        light.pos(5, 5, 5);
    }

    void onAnimate(double dt) override {
        angle += dt * 30;

        // Recreate meshes each frame (for dynamic parameters)
        for (int i = 0; i < NUM_SHAPES; i++) meshes[i].reset();

        int s = 0;
        addSphere(meshes[s++], 0.4, 16, 16);
        addIcosphere(meshes[s++], 0.4, 2);
        addCube(meshes[s++], 0.7);
        addCone(meshes[s++], 0.4, Vec3f(0, 0, 0.8), 16);
        addCylinder(meshes[s++], 0.3, 0.8, 16);
        addTorus(meshes[s++], 0.15, 0.35, 16, 32);
        addDisc(meshes[s++], 0.4, 6);
        addPrism(meshes[s++], 0.4, 0.2, 0.8, 6, 0.2);
        addAnnulus(meshes[s++], 0.2, 0.4, 32);

        for (int i = 0; i < NUM_SHAPES; i++) {
            meshes[i].generateNormals();
            // Add colors
            for (int v = 0; v < meshes[i].vertices().size(); v++) {
                meshes[i].color(HSV(float(i) / NUM_SHAPES + float(v) / 100, 0.8, 1));
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1);
        g.depthTesting(true);
        g.lighting(true);
        g.light(light);

        for (int i = 0; i < NUM_SHAPES; i++) {
            g.pushMatrix();
            float x = (i % 3 - 1) * 2.5;
            float y = (i / 3 - 1) * 2.5;
            g.translate(x, -y, 0);
            g.rotate(angle, 0.3, 1, 0.2);
            g.meshColor();
            g.draw(meshes[i]);
            g.popMatrix();
        }
    }
};

int main() {
    ShapeGallery app;
    app.start();
}`,
  },

  {
    id: 'navigation-demo',
    title: 'Navigation Demo',
    description: 'Camera navigation with Nav class',
    category: 'basics',
    code: `#include "al/app/al_App.hpp"
#include "al/graphics/al_Shapes.hpp"
using namespace al;

struct NavigationDemo : App {
    Mesh grid, axes;

    void onCreate() override {
        // Create grid
        grid.primitive(Mesh::LINES);
        for (int i = -10; i <= 10; i++) {
            grid.vertex(i, 0, -10); grid.vertex(i, 0, 10);
            grid.vertex(-10, 0, i); grid.vertex(10, 0, i);
            grid.color(0.3, 0.3, 0.3); grid.color(0.3, 0.3, 0.3);
            grid.color(0.3, 0.3, 0.3); grid.color(0.3, 0.3, 0.3);
        }

        // Create axes
        axes.primitive(Mesh::LINES);
        axes.vertex(0,0,0); axes.vertex(5,0,0); axes.color(1,0,0); axes.color(1,0,0);
        axes.vertex(0,0,0); axes.vertex(0,5,0); axes.color(0,1,0); axes.color(0,1,0);
        axes.vertex(0,0,0); axes.vertex(0,0,5); axes.color(0,0,1); axes.color(0,0,1);

        nav().pos(0, 2, 10);
        nav().faceToward(Vec3d(0, 0, 0));
    }

    void onAnimate(double dt) override {
        // Smooth navigation
        nav().smooth(0.8);
        nav().step(dt);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1);
        g.depthTesting(true);
        g.meshColor();
        g.draw(grid);
        g.draw(axes);

        // Draw a marker at origin
        Mesh marker;
        addSphere(marker, 0.2, 16, 16);
        g.color(1, 1, 0);
        g.draw(marker);
    }

    bool onKeyDown(Keyboard const& k) override {
        float speed = 0.5;
        switch(k.key()) {
            case 'w': nav().moveF(speed); break;
            case 's': nav().moveF(-speed); break;
            case 'a': nav().moveR(-speed); break;
            case 'd': nav().moveR(speed); break;
            case 'q': nav().moveU(speed); break;
            case 'e': nav().moveU(-speed); break;
            case ' ': nav().halt(); break;
        }
        return true;
    }
};

int main() {
    NavigationDemo app;
    app.start();
}`,
  },
  // === AUDIO CATEGORY ===
  {
    id: 'simple-synth',
    title: 'Simple Synth',
    description: 'Basic sine wave synthesizer with keyboard control',
    category: 'audio',
    code: `#include "al/app/al_App.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
using namespace al;

struct SimpleSynth : App {
    gam::Sine<> osc{440};
    gam::ADSR<> env{0.01, 0.1, 0.7, 0.5};
    float frequency = 440;

    void onCreate() override {
        nav().pos(0, 0, 5);
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            osc.freq(frequency);
            float s = osc() * env() * 0.5;
            io.out(0) = s;
            io.out(1) = s;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        float freqs[] = {261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25};
        if (k.key() >= 'a' && k.key() <= 'h') {
            frequency = freqs[k.key() - 'a'];
            env.reset();
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        env.release();
        return true;
    }

    void onDraw(Graphics& g) override {
        g.clear(HSV(frequency / 1000, 0.5, 0.2));
    }
};

int main() {
    SimpleSynth app;
    app.configureAudio(44100, 512, 2, 0);
    app.start();
}`,
  },

  {
    id: 'polysynth-demo',
    title: 'Polyphonic Synth',
    description: 'PolySynth with SynthVoice for polyphony',
    category: 'audio',
    code: `#include "al/app/al_App.hpp"
#include "al/scene/al_PolySynth.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
using namespace al;

// Define a voice for polyphonic synthesis
struct SineVoice : SynthVoice {
    gam::Sine<> osc;
    gam::ADSR<> env{0.01, 0.1, 0.7, 0.3};
    float amp = 0.2;

    void onProcess(AudioIOData& io) override {
        while (io()) {
            float s = osc() * env() * amp;
            io.out(0) += s;
            io.out(1) += s;
        }
        if (env.done()) free();
    }

    void onTriggerOn() override {
        // Get frequency from trigger parameters
        float freq = getInternalParameterValue("frequency");
        osc.freq(freq);
        env.reset();
    }

    void onTriggerOff() override {
        env.release();
    }
};

struct PolySynthDemo : App {
    PolySynth synth;

    void onCreate() override {
        synth.allocatePolyphony<SineVoice>(16);
        nav().pos(0, 0, 5);
    }

    void triggerNote(float freq) {
        auto* voice = synth.getVoice<SineVoice>();
        voice->setInternalParameterValue("frequency", freq);
        synth.triggerOn(voice);
    }

    bool onKeyDown(const Keyboard& k) override {
        float freqs[] = {261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25};
        if (k.key() >= 'a' && k.key() <= 'h') {
            triggerNote(freqs[k.key() - 'a']);
        }
        return true;
    }

    void onSound(AudioIOData& io) override {
        synth.render(io);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1);
    }
};

int main() {
    PolySynthDemo app;
    app.configureAudio(44100, 512, 2, 0);
    app.start();
}`,
  },

  {
    id: 'spatial-audio',
    title: 'Spatial Audio Scene',
    description: 'DynamicScene with PositionedVoice for 3D audio',
    category: 'audio',
    code: `#include "al/app/al_App.hpp"
#include "al/scene/al_DynamicScene.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/math/al_Random.hpp"
#include <cmath>
using namespace al;

// A voice with position that orbits and makes sound
struct OrbiterVoice : PositionedVoice {
    float freq = 440;
    float phase = 0;
    float orbitRadius = 3;
    float orbitSpeed = 1;
    float orbitPhase = 0;

    void onProcess(AudioIOData& io) override {
        while (io()) {
            float s = std::sin(phase * M_2PI) * 0.2;
            io.out(0) = s;
            phase += freq / io.framesPerSecond();
            if (phase >= 1) phase -= 1;
        }
    }

    void onProcess(Graphics& g) override {
        Mesh m;
        addSphere(m, 0.15, 8, 8);
        g.color(HSV(freq / 880, 1, 1));
        g.draw(m);
    }

    void update(double dt) override {
        orbitPhase += orbitSpeed * dt;
        float x = std::cos(orbitPhase) * orbitRadius;
        float z = std::sin(orbitPhase) * orbitRadius;
        float y = std::sin(orbitPhase * 2) * 0.5;
        setPose(Pose(Vec3d(x, y, z)));
    }
};

struct SpatialAudioDemo : App {
    DynamicScene scene;
    Mesh gridMesh;

    void onCreate() override {
        // Setup distance attenuation
        scene.distanceAttenuation().law(AttenuationLaw::ATTEN_INVERSE_SQUARE);

        // Create orbiting voices
        for (int i = 0; i < 4; i++) {
            auto* voice = scene.getVoice<OrbiterVoice>();
            voice->freq = 220 * (i + 1);
            voice->orbitRadius = 2 + i;
            voice->orbitSpeed = 0.5 + rnd::uniform() * 0.5;
            voice->orbitPhase = i * M_PI / 2;
            scene.triggerOn(voice);
        }

        // Create grid
        gridMesh.primitive(Mesh::LINES);
        for (int i = -5; i <= 5; i++) {
            gridMesh.vertex(i, 0, -5); gridMesh.vertex(i, 0, 5);
            gridMesh.vertex(-5, 0, i); gridMesh.vertex(5, 0, i);
            gridMesh.color(0.3, 0.3, 0.3); gridMesh.color(0.3, 0.3, 0.3);
            gridMesh.color(0.3, 0.3, 0.3); gridMesh.color(0.3, 0.3, 0.3);
        }

        nav().pos(0, 2, 8);
    }

    void onAnimate(double dt) override {
        scene.update(dt);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05);
        g.depthTesting(true);
        g.blending(true);
        g.blendAdd();

        g.meshColor();
        g.draw(gridMesh);

        scene.render(g);
    }

    void onSound(AudioIOData& io) override {
        scene.listenerPose(pose());
        scene.render(io);
    }
};

int main() {
    SpatialAudioDemo app;
    app.configureAudio(44100, 512, 2, 0);
    app.start();
}`,
  },
  // === GRAPHICS CATEGORY ===
  {
    id: 'particle-system',
    title: 'Particle System',
    description: '3D particle system with physics',
    category: 'graphics',
    code: `#include "al/app/al_App.hpp"
#include "al/math/al_Random.hpp"
#include <vector>
using namespace al;

struct Particle {
    Vec3f pos, vel;
    Color color;
    float life;
};

struct ParticleSystem : App {
    std::vector<Particle> particles;
    Mesh mesh;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);
        nav().pos(0, 0, 10);
    }

    void spawn() {
        Particle p;
        p.pos = Vec3f(rnd::uniformS(), rnd::uniformS(), rnd::uniformS()) * 0.1;
        p.vel = Vec3f(rnd::uniformS(), rnd::uniform() + 0.5, rnd::uniformS()) * 2;
        p.color = HSV(rnd::uniform(), 1, 1);
        p.life = 1;
        particles.push_back(p);
    }

    void onAnimate(double dt) override {
        for (int i = 0; i < 10; i++) spawn();

        for (auto& p : particles) {
            p.vel.y -= 2 * dt;
            p.pos += p.vel * dt;
            p.life -= dt * 0.5;
        }

        particles.erase(
            std::remove_if(particles.begin(), particles.end(),
                [](const Particle& p) { return p.life <= 0; }),
            particles.end());

        mesh.reset();
        for (const auto& p : particles) {
            mesh.vertex(p.pos);
            mesh.color(p.color.r, p.color.g, p.color.b, p.life);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0);
        g.blending(true);
        g.blendAdd();
        g.pointSize(4);
        g.draw(mesh);
    }
};

int main() {
    ParticleSystem app;
    app.start();
}`,
  },

  {
    id: 'shader-demo',
    title: 'Custom Shader',
    description: 'Custom vertex and fragment shaders',
    category: 'graphics',
    code: `#include "al/app/al_App.hpp"
#include "al/graphics/al_Shapes.hpp"
using namespace al;

const char* vertexShader = R"(
#version 330
layout(location = 0) in vec3 position;
layout(location = 1) in vec4 color;
layout(location = 2) in vec3 normal;
uniform mat4 al_ModelViewMatrix;
uniform mat4 al_ProjectionMatrix;
uniform float time;
out vec4 vColor;
out vec3 vNormal;

void main() {
    // Wobble effect
    vec3 pos = position;
    pos += normal * sin(time * 3.0 + position.y * 5.0) * 0.1;

    gl_Position = al_ProjectionMatrix * al_ModelViewMatrix * vec4(pos, 1.0);
    vColor = color;
    vNormal = normal;
}
)";

const char* fragmentShader = R"(
#version 330
in vec4 vColor;
in vec3 vNormal;
uniform float time;
out vec4 fragColor;

void main() {
    // Animate color based on normal and time
    vec3 col = vColor.rgb;
    col *= 0.5 + 0.5 * dot(vNormal, normalize(vec3(sin(time), cos(time), 1.0)));
    fragColor = vec4(col, 1.0);
}
)";

struct ShaderDemo : App {
    Mesh mesh;
    ShaderProgram shader;
    double time = 0;

    void onCreate() override {
        addIcosphere(mesh, 1.0, 3);
        mesh.generateNormals();
        for (int i = 0; i < mesh.vertices().size(); i++) {
            mesh.color(HSV(float(i) / mesh.vertices().size(), 0.8, 1));
        }

        shader.compile(vertexShader, fragmentShader);
        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1);
        g.depthTesting(true);

        shader.begin();
        shader.uniform("time", (float)time);
        g.shader(shader);
        g.meshColor();
        g.draw(mesh);
        shader.end();
    }
};

int main() {
    ShaderDemo app;
    app.start();
}`,
  },

  {
    id: 'texture-demo',
    title: 'Texture Mapping',
    description: 'Texture loading and mapping',
    category: 'graphics',
    code: `#include "al/app/al_App.hpp"
#include "al/graphics/al_Shapes.hpp"
using namespace al;

struct TextureDemo : App {
    Mesh mesh;
    Texture tex;
    double angle = 0;

    void onCreate() override {
        // Create sphere with texture coordinates
        addSphere(mesh, 1.0, 32, 32, true);  // true = generate tex coords
        mesh.generateNormals();

        // Create procedural texture
        int N = 256;
        std::vector<Color> pixels(N * N);
        for (int j = 0; j < N; j++) {
            for (int i = 0; i < N; i++) {
                float u = float(i) / N;
                float v = float(j) / N;
                // Checkerboard pattern
                bool check = ((int)(u * 8) + (int)(v * 8)) % 2;
                pixels[j * N + i] = check ? Color(1, 0.8, 0.2) : Color(0.2, 0.1, 0.5);
            }
        }
        tex.create2D(N, N, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
        tex.submit(pixels.data());
        tex.filter(Texture::LINEAR);

        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        angle += dt * 30;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1);
        g.depthTesting(true);

        tex.bind();
        g.texture();
        g.rotate(angle, 0, 1, 0);
        g.draw(mesh);
        tex.unbind();
    }
};

int main() {
    TextureDemo app;
    app.start();
}`,
  },

  // === INTERACTION CATEGORY ===
  {
    id: 'mouse-interaction',
    title: 'Mouse Interaction',
    description: 'Mouse input and object picking',
    category: 'interaction',
    code: `#include "al/app/al_App.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/math/al_Random.hpp"
#include <vector>
using namespace al;

struct Sphere {
    Vec3f pos;
    Color color;
    float radius;
    bool selected = false;
};

struct MouseInteraction : App {
    std::vector<Sphere> spheres;
    Mesh sphereMesh;
    Vec3f mouseWorld;

    void onCreate() override {
        addSphere(sphereMesh, 1.0, 16, 16);
        sphereMesh.generateNormals();

        // Create random spheres
        for (int i = 0; i < 20; i++) {
            Sphere s;
            s.pos = Vec3f(rnd::uniformS() * 5, rnd::uniformS() * 5, rnd::uniformS() * 5);
            s.color = HSV(rnd::uniform(), 0.8, 1);
            s.radius = 0.2 + rnd::uniform() * 0.3;
            spheres.push_back(s);
        }

        nav().pos(0, 0, 15);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1);
        g.depthTesting(true);
        g.lighting(true);

        for (auto& s : spheres) {
            g.pushMatrix();
            g.translate(s.pos);
            g.scale(s.radius);
            if (s.selected) {
                g.color(1, 1, 1);
            } else {
                g.color(s.color);
            }
            g.draw(sphereMesh);
            g.popMatrix();
        }
    }

    bool onMouseDown(Mouse const& m) override {
        // Simple ray casting for selection
        for (auto& s : spheres) {
            s.selected = false;
        }

        // Find closest sphere to click
        float closestDist = 1000;
        Sphere* closest = nullptr;

        for (auto& s : spheres) {
            Vec3f toSphere = s.pos - nav().pos();
            float dist = toSphere.mag();
            if (dist < closestDist) {
                closestDist = dist;
                closest = &s;
            }
        }

        if (closest) closest->selected = true;
        return true;
    }
};

int main() {
    MouseInteraction app;
    app.start();
}`,
  },

  // === ADVANCED CATEGORY ===
  {
    id: 'audio-reactive',
    title: 'Audio Reactive Visuals',
    description: 'Graphics that respond to audio',
    category: 'advanced',
    code: `#include "al/app/al_App.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Analysis.h"
#include <cmath>
using namespace al;

struct AudioReactive : App {
    gam::Sine<> osc{220};
    gam::EnvFollow<> envFollow{0.1};
    Mesh mesh;
    float amplitude = 0;
    float frequency = 220;
    double phase = 0;

    void onCreate() override {
        nav().pos(0, 0, 5);
    }

    void onAnimate(double dt) override {
        phase += dt;

        // Rebuild mesh based on amplitude
        mesh.reset();
        int rings = 32;
        int segs = 64;
        float baseRadius = 0.5 + amplitude * 2;

        for (int i = 0; i < rings; i++) {
            float phi = M_PI * i / (rings - 1);
            for (int j = 0; j < segs; j++) {
                float theta = 2 * M_PI * j / segs;

                // Modulate radius with audio
                float r = baseRadius * (1 + 0.3 * sin(phi * 8 + phase * 5) * amplitude);

                float x = r * sin(phi) * cos(theta);
                float y = r * cos(phi);
                float z = r * sin(phi) * sin(theta);

                mesh.vertex(x, y, z);
                mesh.color(HSV(frequency / 880 + float(i) / rings * 0.2, 0.8, 0.5 + amplitude));
            }
        }

        // Create indices for triangle strip
        mesh.primitive(Mesh::TRIANGLE_STRIP);
        for (int i = 0; i < rings - 1; i++) {
            for (int j = 0; j <= segs; j++) {
                mesh.index(i * segs + (j % segs));
                mesh.index((i + 1) * segs + (j % segs));
            }
        }
        mesh.generateNormals();
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float s = osc() * 0.3;
            envFollow(s);
            io.out(0) = s;
            io.out(1) = s;
        }
        amplitude = envFollow.value();
    }

    bool onKeyDown(Keyboard const& k) override {
        if (k.key() >= '1' && k.key() <= '9') {
            frequency = 110 * (k.key() - '0');
            osc.freq(frequency);
        }
        return true;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05);
        g.depthTesting(true);
        g.lighting(true);
        g.rotate(phase * 20, 0.3, 1, 0.2);
        g.meshColor();
        g.draw(mesh);
    }
};

int main() {
    AudioReactive app;
    app.configureAudio(44100, 512, 2, 0);
    app.start();
}`,
  },

  {
    id: 'parameter-ui',
    title: 'Parameter Control',
    description: 'Using Parameter class for interactive control',
    category: 'advanced',
    code: `#include "al/app/al_App.hpp"
#include "al/ui/al_Parameter.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
using namespace al;

struct ParameterDemo : App {
    Parameter frequency{"Frequency", "", 440, 100, 2000};
    Parameter amplitude{"Amplitude", "", 0.3, 0, 1};
    Parameter rotSpeed{"Rotation Speed", "", 30, 0, 180};
    Parameter hue{"Hue", "", 0.5, 0, 1};

    gam::Sine<> osc;
    Mesh mesh;
    double angle = 0;

    void onCreate() override {
        addIcosphere(mesh, 1.0, 2);
        mesh.generateNormals();

        // Register parameter callbacks
        frequency.registerChangeCallback([this](float f) {
            osc.freq(f);
        });

        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        angle += rotSpeed.get() * dt;

        // Update mesh colors based on hue
        for (int i = 0; i < mesh.vertices().size(); i++) {
            mesh.colors()[i] = HSV(hue.get() + float(i) / mesh.vertices().size() * 0.3, 0.8, 1);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1);
        g.depthTesting(true);
        g.lighting(true);
        g.rotate(angle, 0, 1, 0);
        g.meshColor();
        g.draw(mesh);
    }

    void onSound(AudioIOData& io) override {
        float amp = amplitude.get();
        while (io()) {
            float s = osc() * amp;
            io.out(0) = s;
            io.out(1) = s;
        }
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case 'f': frequency.set(frequency.get() * 1.1); break;
            case 'd': frequency.set(frequency.get() / 1.1); break;
            case 'a': amplitude.set(std::min(1.0f, amplitude.get() + 0.1f)); break;
            case 's': amplitude.set(std::max(0.0f, amplitude.get() - 0.1f)); break;
            case 'h': hue.set(fmod(hue.get() + 0.1, 1.0)); break;
        }
        return true;
    }
};

int main() {
    ParameterDemo app;
    app.configureAudio(44100, 512, 2, 0);
    app.start();
}`,
  },
];
```

### 9.2 Project Save/Load with IndexedDB

```typescript
// frontend/src/services/storage.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AllolibStudioDB extends DBSchema {
  projects: {
    key: string;
    value: {
      id: string;
      name: string;
      code: string;
      assets: { name: string; data: ArrayBuffer }[];
      createdAt: Date;
      updatedAt: Date;
    };
    indexes: { 'by-name': string };
  };
  settings: {
    key: string;
    value: any;
  };
}

class StorageService {
  private db: IDBPDatabase<AllolibStudioDB> | null = null;
  
  async init() {
    this.db = await openDB<AllolibStudioDB>('allolib-studio', 1, {
      upgrade(db) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-name', 'name');
        db.createObjectStore('settings');
      },
    });
  }
  
  async saveProject(project: Omit<AllolibStudioDB['projects']['value'], 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
    if (!this.db) await this.init();
    
    const id = project.id || crypto.randomUUID();
    const now = new Date();
    
    await this.db!.put('projects', {
      ...project,
      id,
      createdAt: project.id ? (await this.db!.get('projects', id))?.createdAt || now : now,
      updatedAt: now,
    });
    
    return id;
  }
  
  async getProject(id: string) {
    if (!this.db) await this.init();
    return this.db!.get('projects', id);
  }
  
  async getAllProjects() {
    if (!this.db) await this.init();
    return this.db!.getAll('projects');
  }
  
  async deleteProject(id: string) {
    if (!this.db) await this.init();
    return this.db!.delete('projects', id);
  }
  
  async saveSetting(key: string, value: any) {
    if (!this.db) await this.init();
    return this.db!.put('settings', value, key);
  }
  
  async getSetting(key: string) {
    if (!this.db) await this.init();
    return this.db!.get('settings', key);
  }
}

export const storage = new StorageService();
```

### 9.3 Real-time Collaboration (Optional Future Feature)

```typescript
// frontend/src/services/collaboration.ts
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';

export class CollaborationService {
  private doc: Y.Doc;
  private provider: WebsocketProvider;
  private binding: MonacoBinding | null = null;
  
  constructor(roomId: string, wsUrl: string) {
    this.doc = new Y.Doc();
    this.provider = new WebsocketProvider(wsUrl, roomId, this.doc);
    
    this.provider.on('status', ({ status }: { status: string }) => {
      console.log('Collaboration status:', status);
    });
  }
  
  bindToEditor(editor: any, model: any) {
    const yText = this.doc.getText('code');
    this.binding = new MonacoBinding(yText, model, new Set([editor]), this.provider.awareness);
  }
  
  destroy() {
    this.binding?.destroy();
    this.provider.destroy();
    this.doc.destroy();
  }
  
  get awareness() {
    return this.provider.awareness;
  }
}
```

---

## 10. File Structure

```
allolib-studio-online/
├── frontend/
│   ├── public/
│   │   ├── logo.svg
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/
│   │   │   ├── MonacoEditor.vue
│   │   │   ├── AllolibViewer.vue
│   │   │   ├── Console.vue
│   │   │   ├── Toolbar.vue
│   │   │   ├── SettingsModal.vue
│   │   │   └── ExamplesModal.vue
│   │   ├── services/
│   │   │   ├── compiler.ts
│   │   │   ├── runtime.ts
│   │   │   ├── storage.ts
│   │   │   └── collaboration.ts
│   │   ├── utils/
│   │   │   ├── monaco-allolib.ts
│   │   │   └── diagnostics.ts
│   │   ├── constants/
│   │   │   ├── defaults.ts
│   │   │   └── examples.ts
│   │   ├── stores/
│   │   │   └── app.ts
│   │   ├── App.vue
│   │   └── main.ts
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── compile.ts
│   │   │   └── health.ts
│   │   ├── services/
│   │   │   ├── compiler.ts
│   │   │   └── cache.ts
│   │   ├── workers/
│   │   │   └── compile-worker.ts
│   │   └── index.ts
│   ├── docker/
│   │   ├── Dockerfile.compiler
│   │   └── docker-compose.yml
│   ├── package.json
│   └── tsconfig.json
│
├── allolib-wasm/
│   ├── include/
│   │   └── al_web_app.hpp
│   ├── src/
│   │   ├── web_audio_backend.cpp
│   │   ├── web_audio_worklet.cpp
│   │   └── allolib-audio-processor.js
│   ├── CMakeLists.txt
│   └── build.sh
│
├── shared/
│   ├── types/
│   │   └── index.ts
│   └── constants/
│       └── index.ts
│
├── examples/
│   ├── hello-sphere/
│   ├── simple-synth/
│   └── particle-system/
│
├── docs/
│   ├── getting-started.md
│   ├── api.md
│   └── contributing.md
│
├── .github/
│   └── workflows/
│       ├── frontend.yml
│       └── backend.yml
│
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 11. Detailed Implementation Tasks

### Phase 1: Foundation (Week 1-2)

```markdown
## Task List

### 1.1 Repository Setup
- [ ] Initialize monorepo with npm workspaces or turborepo
- [ ] Setup ESLint, Prettier, TypeScript configs
- [ ] Configure CI/CD with GitHub Actions
- [ ] Create development Docker Compose setup

### 1.2 Frontend Scaffolding
- [ ] Create Vue 3 + TypeScript + Vite project
- [ ] Install and configure Tailwind CSS
- [ ] Setup Pinia store
- [ ] Create basic layout components
- [ ] Integrate Monaco Editor

### 1.3 Backend Scaffolding
- [ ] Create Node.js + Express project
- [ ] Setup TypeScript compilation
- [ ] Create health check endpoint
- [ ] Setup WebSocket support
- [ ] Configure Redis connection
```

### Phase 2: AlloLib Port (Week 3-5)

```markdown
### 2.1 Emscripten Build System
- [ ] Fork AlloLib repository
- [ ] Create Emscripten CMake toolchain
- [ ] Identify and resolve dependency conflicts
- [ ] Create Web Audio backend
- [ ] Create AudioWorklet processor
- [ ] Test basic rendering

### 2.2 API Abstraction Layer
- [ ] Create WebApp base class
- [ ] Implement WebGL2 context setup
- [ ] Implement Web Audio integration
- [ ] Create keyboard/mouse input handlers
- [ ] Port navigation controls

### 2.3 Library Compilation
- [ ] Compile AlloLib core as static library
- [ ] Compile Gamma as static library
- [ ] Create WASM/JS output
- [ ] Test with simple examples
```

### Phase 3: Monaco Integration (Week 6)

```markdown
### 3.1 Editor Features
- [ ] Configure C++ language support
- [ ] Add AlloLib snippets
- [ ] Implement hover documentation
- [ ] Create custom theme
- [ ] Add keyboard shortcuts

### 3.2 Diagnostics
- [ ] Parse compiler errors
- [ ] Display inline error markers
- [ ] Implement error panel
```

### Phase 4: Compilation Pipeline (Week 7-8)

```markdown
### 4.1 Backend Compiler Service
- [ ] Create Docker compilation environment
- [ ] Implement source wrapping
- [ ] Create compilation job queue
- [ ] Implement result caching
- [ ] Add security sandboxing

### 4.2 API Endpoints
- [ ] POST /compile endpoint
- [ ] WebSocket streaming endpoint
- [ ] Static file serving for outputs
- [ ] Rate limiting

### 4.3 Frontend Integration
- [ ] Create compiler service
- [ ] Implement real-time progress
- [ ] Handle errors gracefully
```

### Phase 5: Runtime & Viewer (Week 9-10)

```markdown
### 5.1 WASM Runtime
- [ ] Create runtime loader
- [ ] Implement hot-reload
- [ ] Handle audio context initialization
- [ ] Memory management

### 5.2 Viewer Component
- [ ] Canvas setup and management
- [ ] Fullscreen support
- [ ] Audio controls
- [ ] FPS counter
- [ ] Error display
```

### Phase 6: UI Polish (Week 11-12)

```markdown
### 6.1 Main Layout
- [ ] Split pane implementation
- [ ] Resizable panels
- [ ] Responsive design
- [ ] Dark theme

### 6.2 Additional Features
- [ ] Examples browser
- [ ] Settings panel
- [ ] Project save/load
- [ ] Export functionality
```

### Phase 7: Testing & Launch (Week 13-14)

```markdown
### 7.1 Testing
- [ ] Unit tests for services
- [ ] Integration tests for compilation
- [ ] E2E tests with Playwright
- [ ] Performance testing

### 7.2 Documentation
- [ ] User documentation
- [ ] API documentation
- [ ] Contributing guide
- [ ] Video tutorials

### 7.3 Deployment
- [ ] Production Docker setup
- [ ] CDN configuration
- [ ] Monitoring and logging
- [ ] Launch!
```

### Phase 8: Example Testing & Validation (Week 15)

```markdown
### 8.1 Basics Examples Testing
- [ ] Hello Sphere - Basic app with rotating sphere
- [ ] Hello Cube - Basic app with rotating cube
- [ ] Shape Gallery - All primitive shapes
- [ ] Color Gradient - HSV color interpolation
- [ ] RGB Colors - Direct RGB color control

### 8.2 Graphics Examples Testing
- [ ] Wire Meshes - Wireframe rendering modes
- [ ] Custom Mesh - Procedural mesh generation
- [ ] Rotation Transform - Object rotation
- [ ] Scale Transform - Object scaling
- [ ] Basic Lighting - Ambient/diffuse lighting
- [ ] Multi-Light - Multiple light sources
- [ ] Animated Shader - Time-based GLSL shaders
- [ ] Vertex Deform - Vertex displacement shaders
- [ ] Checkerboard Texture - Procedural textures
- [ ] Gradient Texture - Gradient texture generation

### 8.3 Audio Examples Testing
- [ ] Sine Wave - Basic sine oscillator
- [ ] Multi-Oscillator - Multiple waveforms
- [ ] ADSR Envelope - Amplitude envelopes
- [ ] FM Synthesis - Frequency modulation

### 8.4 Interaction Examples Testing
- [ ] Key Colors - Keyboard input handling
- [ ] Mouse Draw - Mouse click/drag interaction
- [ ] Fly Camera - 3D navigation controls

### 8.5 Scene System Examples Testing
- [ ] Simple Voice - SynthVoice implementation
- [ ] Piano Keys - PolySynth polyphonic keyboard
- [ ] Spatial Voices - DynamicScene with positioned voices

### 8.6 Advanced Examples Testing
- [ ] Particle System - GPU particles with physics
- [ ] Audio Visualizer - Real-time audio-reactive graphics
- [ ] Generative Art - Procedural generation patterns

### 8.7 Validation Criteria
- [ ] All 28 examples compile successfully
- [ ] All examples run without runtime errors
- [ ] Graphics render correctly (visual inspection)
- [ ] Audio plays correctly (auditory inspection)
- [ ] Keyboard/mouse interactions work as expected
- [ ] Scene system manages voices correctly
- [ ] Performance meets 60fps target
```

---

## Appendix: Command Reference for Claude Code

```bash
# Clone and setup
git clone <repo-url>
cd allolib-studio-online
npm install

# Frontend development
cd frontend
npm run dev

# Backend development
cd backend
npm run dev

# Build AlloLib WASM
cd allolib-wasm
./build.sh

# Docker development
docker-compose up -d

# Run tests
npm test

# Build for production
npm run build

# Deploy
npm run deploy
```

---

## Notes for Claude Code

1. **Start with Phase 1** - Get the basic structure working before diving into AlloLib compilation
2. **Test incrementally** - Each phase should produce testable output
3. **Keep AlloLib modifications minimal** - Prefer wrapper classes over modifying AlloLib source
4. **Prioritize audio** - Web Audio is the trickiest part; get it working early
5. **Use feature flags** - Enable/disable features for gradual rollout
6. **Monitor memory** - WASM apps can leak memory; implement proper cleanup
7. **Cache aggressively** - Compilation is expensive; cache everything possible

This plan provides a complete roadmap for building AlloLib Studio Online. Each section can be tackled independently by Claude Code, with clear deliverables and test criteria.

---

## Appendix A: AlloLib Feature Implementation Checklist

Reference documentation: `allolib/ALLOLIB_DOCUMENTATION.md`

### Core Module Support Status

| Module | Features | Status | Notes |
|--------|----------|--------|-------|
| **al::App** | `onCreate`, `onAnimate`, `onDraw`, `onSound`, events | 🔲 Pending | WebApp wrapper class |
| **al::Graphics** | All drawing methods, state management | 🔲 Pending | WebGL2 compatible |
| **al::Mesh** | All primitives, vertex data | 🔲 Pending | WebGL2 compatible |
| **al::Shader/ShaderProgram** | Custom shaders | 🔲 Pending | GLSL ES 3.0 |
| **al::Texture** | 2D textures | 🔲 Pending | WebGL2 textures |
| **al::Light** | Lighting | 🔲 Pending | Built-in shaders |
| **Shapes (al_Shapes.hpp)** | All 10 shape functions | 🔲 Pending | Header-only |
| **al::Vec2/3/4** | Vector math | ✅ Ready | Header-only |
| **al::Quat** | Quaternions | ✅ Ready | Header-only |
| **al::Mat4** | Matrices | ✅ Ready | Header-only |
| **al::rnd** | Random numbers | ✅ Ready | Header-only |
| **al::Pose** | Position+orientation | ✅ Ready | Header-only |
| **al::Nav** | Navigation | ✅ Ready | Header-only |
| **al::Color/HSV** | Color types | ✅ Ready | Header-only |
| **al::AudioIO** | Audio I/O | 🔲 Pending | Web Audio backend |
| **al::AudioIOData** | Audio buffers | 🔲 Pending | AudioWorklet |
| **al::Spatializer** | Base class | 🔲 Pending | Custom implementation |
| **al::StereoPanner** | Stereo pan | 🔲 Pending | AudioWorklet |
| **al::Vbap** | VBAP | 🔲 Pending | AudioWorklet |
| **al::Dbap** | DBAP | 🔲 Pending | AudioWorklet |
| **al::Ambisonics** | Ambisonics | 🔲 Pending | AudioWorklet |
| **al::SynthVoice** | Voice base | 🔲 Pending | Works with Web Audio |
| **al::PolySynth** | Voice manager | 🔲 Pending | Works with Web Audio |
| **al::DynamicScene** | Spatial scene | 🔲 Pending | Web spatializer |
| **al::PositionedVoice** | 3D voice | 🔲 Pending | With DynamicScene |
| **al::Parameter** | Thread-safe params | 🔲 Pending | Atomic access |
| **al::Window/Keyboard/Mouse** | Input | 🔲 Pending | Emscripten GLFW |
| **Gamma DSP** | Oscillators, filters, envelopes | 🔲 Pending | Header-only |

### Implementation Priority Order

1. **Phase A - Core Rendering** (Required first)
   - WebApp class (al::App for web)
   - Graphics state machine
   - Mesh and shape functions
   - Basic shaders

2. **Phase B - Audio Foundation**
   - Web Audio backend (AudioIO replacement)
   - AudioWorklet processor
   - AudioIOData buffer interface
   - Gamma integration

3. **Phase C - Scene System**
   - SynthVoice implementation
   - PolySynth voice management
   - DynamicScene with spatial audio
   - PositionedVoice with spatializers

4. **Phase D - Advanced Features**
   - Custom shaders (ShaderProgram)
   - Textures
   - Parameters with callbacks
   - OSC over WebSocket

### Monaco Editor Intellisense Coverage

The implementation plan includes Monaco editor support for:
- ✅ All major classes documented in ALLOLIB_DOCUMENTATION.md
- ✅ Code snippets for common patterns (App template, shapes, synth voices)
- ✅ Hover documentation for 50+ classes/types
- ✅ Autocomplete for methods and parameters

### Example Coverage

The examples library includes demonstrations of:
- ✅ Basic App lifecycle
- ✅ All shape primitives
- ✅ Navigation and camera control
- ✅ Simple audio synthesis
- ✅ Polyphonic synthesis (PolySynth)
- ✅ Spatial audio (DynamicScene)
- ✅ Particle systems
- ✅ Custom shaders
- ✅ Textures
- ✅ Mouse interaction
- ✅ Audio-reactive visuals
- ✅ Parameter control

### Web Audio Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Audio Context                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌───────────────────┐    ┌──────────────┐ │
│  │ User WASM    │    │ AllolibProcessor  │    │ Destination  │ │
│  │ onSound()    │───▶│ (AudioWorklet)    │───▶│ (Speakers)   │ │
│  └──────────────┘    └───────────────────┘    └──────────────┘ │
│         │                     │                                  │
│         │            ┌────────┴────────┐                        │
│         │            │                 │                        │
│         ▼            ▼                 ▼                        │
│  ┌──────────────────────┐    ┌─────────────────────┐           │
│  │ DynamicScene         │    │ Spatializer         │           │
│  │ - voices[]           │───▶│ - StereoPanner      │           │
│  │ - listenerPose       │    │ - VBAP              │           │
│  │ - distanceAtten      │    │ - DBAP              │           │
│  └──────────────────────┘    │ - Ambisonics        │           │
│                              └─────────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Success Metrics

For full AlloLib feature parity, the web implementation must support:

1. **Graphics**
   - [ ] 60fps rendering with complex meshes
   - [ ] All 10 shape primitives
   - [ ] Custom GLSL shaders
   - [ ] Textures (procedural and loaded)
   - [ ] Lighting (ambient, diffuse, specular)

2. **Audio**
   - [ ] 44100Hz sample rate
   - [ ] 512 or lower buffer size (low latency)
   - [ ] Stereo output minimum
   - [ ] Real-time synthesis with Gamma
   - [ ] Polyphonic voice management (16+ voices)
   - [ ] Basic spatial audio (stereo panning + distance)

3. **Interaction**
   - [ ] Keyboard events (onKeyDown/Up)
   - [ ] Mouse events (click, drag, move, scroll)
   - [ ] Navigation controls (WASD + mouse look)

4. **Compilation**
   - [ ] < 30 second compile time for simple apps
   - [ ] Meaningful error messages with line numbers
   - [ ] Code caching for faster recompilation
