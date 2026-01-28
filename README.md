# AlloLib Studio Online

**Write, compile, and run AlloLib C++ code directly in your browser.**

AlloLib Studio Online is a browser-based creative coding environment for building interactive audio-visual applications using the [AlloLib](https://github.com/AlloSphere-Research-Group/allolib) C++ framework. No local installation required.

![Status](https://img.shields.io/badge/status-Phase%206%20Complete-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Code Editor** - Monaco Editor with C++ syntax highlighting, AlloLib snippets, and intelligent autocomplete
- **Live Compilation** - Server-side Emscripten compilation (~5 seconds) to WebAssembly
- **WebGL2 Graphics** - 3D rendering with meshes, lighting, shaders, and textures
- **Web Audio** - Real-time audio synthesis with Gamma DSP library
- **22+ Examples** - Ready-to-run demos covering graphics, audio, and interaction
- **Error Highlighting** - Compiler errors shown directly in the editor
- **Audio Safety** - Built-in limiter protects your speakers

## Quick Start

### Online Demo

Visit the hosted version (coming soon) or run locally:

### Run Locally

```bash
# Clone the repository
git clone https://github.com/9LiveZZZ-Git/Allolib-Studio-Online.git
cd Allolib-Studio-Online

# Clone AlloLib (required)
git clone https://github.com/AlloSphere-Research-Group/allolib.git
cd allolib && git submodule update --init --recursive && cd ..

# Install dependencies
npm install

# Start with Docker (recommended)
docker-compose up -d
npm run dev:frontend

# Visit http://localhost:3000
```

**Requirements:** Node.js 18+, Docker, Git

## Usage

1. **Write** your C++ code in the editor (or choose an example)
2. **Run** to compile and execute
3. **View** the output in the WebGL canvas
4. **Listen** to audio through your speakers

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save to browser |
| `Ctrl+Enter` | Compile and run |
| `Ctrl+F` | Find |
| `Ctrl+G` | Go to line |

### Code Snippets

Type these prefixes and press Tab:

- `allolib-app` - Basic application template
- `mesh-sphere` - Create a sphere mesh
- `sine-osc` - Sine wave oscillator
- `synthvoice` - Polyphonic voice template

### Controls

Default camera controls in the viewer:
- **WASD** - Move forward/left/back/right
- **Q/E** - Move up/down
- **Mouse drag** - Look around

## Examples

The Examples dropdown includes demos organized by category:

| Category | Examples |
|----------|----------|
| **Basics** | Hello Sphere, Hello Audio, AudioVisual |
| **Graphics** | Shapes, Transforms, Lighting, Shaders, Textures |
| **Audio** | Oscillators, Envelopes, Synthesis |
| **Interaction** | Keyboard, Mouse, Navigation |
| **Scene System** | SynthVoice, PolySynth, DynamicScene |
| **Advanced** | Particles, Generative, Audio-Visual |

## Architecture

```
Browser                          Server
┌─────────────────┐             ┌─────────────────┐
│  Monaco Editor  │   HTTP      │   Express API   │
│       ↓         │ ────────→   │       ↓         │
│  C++ Source     │             │  Emscripten     │
│       ↓         │   WASM      │       ↓         │
│  WASM Runtime   │ ←────────   │  WebAssembly    │
│       ↓         │             └─────────────────┘
│  WebGL2 + Audio │
└─────────────────┘
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Vue 3, TypeScript, Monaco Editor, Tailwind CSS, Pinia |
| **Backend** | Node.js, Express, Redis, BullMQ |
| **Compiler** | Emscripten 3.1.50, Docker |
| **Output** | WebGL2, Web Audio API, AudioWorklet |

## Project Structure

```
allolib-studio-online/
├── frontend/           # Vue 3 web application
│   └── src/
│       ├── components/ # UI components
│       ├── services/   # Compiler, Runtime
│       ├── stores/     # Pinia state
│       └── utils/      # Helpers, Monaco config
├── backend/            # Node.js compilation server
│   └── docker/         # Emscripten container
├── allolib/            # AlloLib C++ library
└── allolib-wasm/       # WASM build configuration
```

## Development

### Without Docker (Mock Mode)

```bash
npm run dev
```

This starts both frontend and backend, but compilation returns mock results (no actual WASM).

### With Docker (Full Compilation)

```bash
docker-compose up -d    # Start Redis + Compiler + Backend
npm run dev:frontend    # Start frontend only
```

### Build for Production

```bash
npm run build
```

## Technical Details

<details>
<summary><strong>WebGL2 Notes</strong></summary>

AlloLib Studio uses WebGL2 (OpenGL ES 3.0). Key differences from desktop OpenGL:

- No geometry shaders (use CPU-side generation)
- No tessellation (use pre-tessellated meshes)
- GLSL ES 3.0 (not GLSL 330)
- Float textures require `EXT_color_buffer_float` for FBO rendering

</details>

<details>
<summary><strong>Web Audio Notes</strong></summary>

Audio runs in an AudioWorklet for low latency:

- 128 samples per buffer (Web Audio standard)
- 44.1kHz or 48kHz sample rate
- Stereo output
- Built-in safety limiter (soft clip + brick-wall)

</details>

<details>
<summary><strong>Safety Limiter</strong></summary>

The audio output includes protection:

- **Soft Clipper** - Gentle tanh saturation
- **Brick-Wall Limiter** - Prevents clipping at -1dB
- **Visual Indicator** - Shows gain reduction in real-time

Configure in Settings → Audio.

</details>

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Acknowledgments

- [AlloLib](https://github.com/AlloSphere-Research-Group/allolib) - The AlloSphere Research Group
- [Gamma](https://github.com/LancePutnam/Gamma) - Lance Putnam's DSP library
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Microsoft

## License

MIT License - see [LICENSE](LICENSE) for details.

Copyright (c) 2025 Luc Freiburg
