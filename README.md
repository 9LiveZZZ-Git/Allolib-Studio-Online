# AlloLib Studio Online

Browser-based creative coding environment for AlloLib C++ applications.

## Status

**Phase 4: Feature Verification - COMPLETE**

- ✅ Monaco Editor with C++ syntax and AlloLib snippets
- ✅ Server-side compilation with Emscripten (~5 second compile time)
- ✅ WebGL2 graphics rendering (3D meshes, colors, transforms, lighting)
- ✅ Web Audio playback (Gamma oscillators, AudioWorklet output)
- ✅ Audio analysis panel (level meters, waveform, spectrum analyzer)
- ✅ Keyboard/mouse input (Emscripten HTML5 event handlers)
- ✅ Scene System (PolySynth, SynthVoice, DynamicScene, PositionedVoice)
- ✅ Custom GLSL ES 3.0 shaders
- ✅ Procedural texture generation

## Overview

AlloLib Studio Online enables users to write, compile, and run AlloLib C++ code directly in the web browser. No local installation required.

## Architecture

This project uses **server-side compilation**:
- User writes C++ code in the browser (Monaco Editor)
- Code is sent to the backend server
- Server compiles with Emscripten against AlloLib
- WebAssembly binary is returned to the browser
- WASM executes with WebGL2 graphics and Web Audio

## Project Structure

```
allolib-studio-online/
├── frontend/           # Vue 3 + TypeScript web application
│   ├── src/
│   │   ├── components/ # Vue components (Editor, Viewer, Console, etc.)
│   │   ├── services/   # Compiler, Runtime, Storage services
│   │   ├── stores/     # Pinia state management
│   │   └── utils/      # Utilities and helpers
│   └── ...
├── backend/            # Node.js compilation server
│   ├── src/
│   │   ├── routes/     # API endpoints
│   │   ├── services/   # Compilation service, caching
│   │   └── workers/    # Job handlers
│   ├── docker/         # Dockerfile and compile script
│   └── ...
├── allolib/            # AlloLib library (cloned separately)
├── al_ext/             # AlloLib extensions (cloned separately)
└── docs/               # Documentation
```

## Tech Stack

**Frontend:**
- Vue 3 + TypeScript
- Monaco Editor (code editing with AlloLib snippets)
- Tailwind CSS (styling)
- Pinia (state management)
- WebGL2 + Web Audio API (output)

**Backend:**
- Node.js + Express
- Emscripten (C++ to WASM compilation)
- BullMQ + Redis (job queue)
- Docker (sandboxed compilation)

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Docker + Docker Compose
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/9LiveZZZ-Git/Allolib-Studio-Online.git
cd Allolib-Studio-Online

# Clone AlloLib (required for compilation)
git clone https://github.com/AlloSphere-Research-Group/allolib.git
cd allolib
git submodule update --init --recursive
cd ..

# Clone AlloLib extensions (optional, for additional features)
git clone https://github.com/AlloSphere-Research-Group/al_ext.git
cd al_ext
git submodule update --init --recursive
cd ..

# Install dependencies
npm install
```

### Running with Docker (Recommended)

```bash
# Start all services (Redis, Compiler, Backend)
docker-compose up -d

# Start frontend dev server
npm run dev:frontend
```

Then visit http://localhost:3000

### Development (without Docker)

```bash
# Start both frontend and backend
npm run dev

# Or separately:
npm run dev:frontend  # http://localhost:3000
npm run dev:backend   # http://localhost:4000
```

Note: Without Docker, compilation will use mock mode (no actual WASM generation).

### Building for Production

```bash
npm run build
```

## Usage

1. Write your AlloLib C++ code in the editor
2. Click **Run** to compile and execute
3. View output in the WebGL canvas
4. Check the console for compilation logs and errors

### Code Snippets

The editor includes AlloLib-specific snippets:
- `allolib-app` - Basic application template
- `mesh-sphere` - Create a sphere mesh
- `mesh-cube` - Create a cube mesh
- `sine-osc` - Sine wave oscillator
- `adsr-env` - ADSR envelope
- `nav3d` - 3D camera setup
- `color-hsv` - HSV color creation
- `shader-basic` - Basic shader program

## WebGL2 Technical Notes

AlloLib Studio Online uses WebGL2 (OpenGL ES 3.0), which has some differences from desktop OpenGL. Here's how we handle them:

### Graphics Limitations & Solutions

| Limitation | Desktop OpenGL | WebGL2 Solution |
|------------|----------------|-----------------|
| **No Geometry Shaders** | Geometry shader stage | CPU-side vertex generation, instancing |
| **No Tessellation** | Tessellation shaders | Pre-tessellated meshes, adaptive LOD |
| **Limited Extensions** | Wide extension support | Runtime extension detection |
| **GLSL Version** | GLSL 3.30+ | GLSL ES 3.0 compatibility layer |
| **Memory Limits** | System RAM | Reasonable defaults, streaming |

### Float Textures (EXT_color_buffer_float)

Float textures can always be *read* in WebGL2, but rendering to them (as FBO targets) requires the `EXT_color_buffer_float` extension:

```cpp
#include "al/graphics/al_WebGL2Extensions.hpp"

// Check if float render targets are available
if (al::WebGL2Extensions::canRenderToFloatTexture()) {
    // Use RGBA32F for HDR rendering
    texture.create2D(width, height, GL_RGBA32F, GL_RGBA, GL_FLOAT);
} else {
    // Fall back to 8-bit
    texture.create2D(width, height, GL_RGBA8, GL_RGBA, GL_UNSIGNED_BYTE);
}
```

### Cubemap Textures

Cubemap textures are fully supported in WebGL2 core (no extension needed):

```cpp
al::Texture cubemap;
cubemap.createCubemap(512, GL_RGB8, GL_RGB, GL_UNSIGNED_BYTE);
// Submit faces with glTexSubImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + face, ...)
```

### Extension Detection

Use the `WebGL2Extensions` helper to check runtime capabilities:

```cpp
auto& caps = al::WebGL2Extensions::capabilities();

if (caps.anisotropicFiltering) {
    // Use up to caps.maxAnisotropy levels
}

if (caps.s3tcCompression) {
    // DXT/S3TC compressed textures available
}
```

## Web Audio Technical Notes

### Audio Architecture

Audio runs in an AudioWorklet for low-latency processing:
- 128 samples per buffer (Web Audio standard)
- Configurable sample rate (typically 44.1kHz or 48kHz)
- Stereo output (expandable to multichannel)

### Buffer Underrun Detection

The audio processor monitors for buffer underruns and reports statistics:

```javascript
// The worklet sends 'underrun' messages when audio glitches occur
workletNode.port.onmessage = (event) => {
    if (event.data.type === 'underrun') {
        console.warn('Audio underrun:', event.data.count);
    }
};
```

### Sample-Accurate Scheduling

Events can be scheduled with sample accuracy using `AudioContext.currentTime`:

```javascript
// Schedule an event 100ms in the future
workletNode.port.postMessage({
    type: 'scheduleEvent',
    time: audioContext.currentTime + 0.1,
    event: { type: 'noteOn', note: 60 }
});
```

### Spatializer Support

AlloLib's spatializers work via stereo panning:
- **StereoPanner** - Simple left/right panning (full support)
- **VBAP/DBAP** - Downmixed to stereo for web (2 speakers)
- **Ambisonics** - First-order decode to stereo

```cpp
// Use StereoPanner for web audio
al::StereoPanner panner;
panner.numSpeakers(2);
std::vector<float> azimuths = {-45.0f, 45.0f};
panner.setSpeakerAngles(azimuths);
```

## License

MIT
