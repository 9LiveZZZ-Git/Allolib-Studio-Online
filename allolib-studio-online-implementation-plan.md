# AlloLib Studio Online - Complete Implementation Plan

## Project Overview

**Goal**: Create a browser-based creative coding environment that compiles and runs AlloLib C++ code online, featuring a Monaco Editor for code editing and a WebGL/WebAudio viewer for output.

**Architecture**: Split-pane interface with editor/compiler on the left and real-time viewer on the right.

**Selected Approach**: Option A - Server-Side Compilation (Full functionality)

---

## Implementation Progress

### Completed
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

### In Progress
- [ ] **AlloLib WASM Build** - Configure CMake for Emscripten compilation
- [ ] **Web Audio Backend** - Replace PortAudio with Web Audio API
- [ ] **WebGL2 Integration** - Connect GLFW port to canvas

### Pending
- [ ] **Full Compilation Testing** - End-to-end C++ to WASM pipeline
- [ ] **Example Projects** - Pre-built demos (sphere, synth, particles)
- [ ] **Project Persistence** - IndexedDB storage for user code
- [ ] **Error Handling** - Compiler diagnostics in editor
- [ ] **Production Deployment** - Docker Compose for full stack

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
      ];
      
      return { suggestions };
    }
  });
  
  // Register hover provider for AlloLib types
  monacoInstance.languages.registerHoverProvider('cpp', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      
      const alloLibDocs: Record<string, string> = {
        'App': '**AlloLib App**\n\nBase class for AlloLib applications. Override `onCreate()`, `onAnimate()`, `onDraw()`, and `onSound()` for your application logic.',
        'Graphics': '**AlloLib Graphics**\n\nGraphics context for rendering. Use methods like `clear()`, `color()`, `draw()`, etc.',
        'Mesh': '**AlloLib Mesh**\n\nVertex data container. Add vertices, colors, normals, and indices for rendering.',
        'AudioIOData': '**AlloLib AudioIOData**\n\nAudio I/O buffer. Use `io()` to advance, `in(channel)` for input, `out(channel)` for output.',
        'Nav': '**AlloLib Nav**\n\nNavigation/camera controller. Set position with `pos()`, orientation with `quat()`.',
        'Vec3f': '**AlloLib Vec3f**\n\n3D float vector. Components: x, y, z.',
        'Color': '**AlloLib Color**\n\nRGBA color. Components: r, g, b, a (0-1 range).',
        'HSV': '**AlloLib HSV**\n\nHue-Saturation-Value color. H: 0-1 (hue), S: 0-1 (saturation), V: 0-1 (value).',
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

export const EXAMPLES: Example[] = [
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
        // Map keys to frequencies (A4 = 440Hz)
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
        g.clear(0.1);
        // Draw frequency visualization
    }
};

int main() {
    SimpleSynth app;
    app.configureAudio(44100, 512, 2, 2);
    app.start();
    return 0;
}`,
  },
  {
    id: 'particle-system',
    title: 'Particle System',
    description: '3D particle system with physics',
    category: 'graphics',
    code: `#include "al/app/al_App.hpp"
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
        // Spawn new particles
        for (int i = 0; i < 10; i++) spawn();
        
        // Update particles
        for (auto& p : particles) {
            p.vel.y -= 2 * dt;  // gravity
            p.pos += p.vel * dt;
            p.life -= dt * 0.5;
        }
        
        // Remove dead particles
        particles.erase(
            std::remove_if(particles.begin(), particles.end(),
                [](const Particle& p) { return p.life <= 0; }),
            particles.end());
        
        // Update mesh
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
    return 0;
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
