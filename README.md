# AlloLib Studio Online

**Write, compile, and run AlloLib C++ code directly in your browser.**

AlloLib Studio Online is a browser-based creative coding environment for building interactive audio-visual applications using the [AlloLib](https://github.com/AlloSphere-Research-Group/allolib) C++ framework. No local installation required.

![Status](https://img.shields.io/badge/status-Phase%207%20Complete-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

> **Built on the work of the [AlloSphere Research Group](https://allosphere.ucsb.edu/) at UC Santa Barbara.**
>
> Special thanks to **Dr. JoAnn Kuchera-Morin** — Director, Inventor, and Lead Researcher of the [AlloSphere Research Facility](https://allosphere.ucsb.edu/) — whose vision for immersive multimedia research made AlloLib and the AlloSphere possible.
>
> Thanks to **Dr. Andres Cabrera** ([@mantaraya36](https://github.com/mantaraya36)) for architecting and leading development of [AlloLib](https://github.com/AlloSphere-Research-Group/allolib) and [AlloLib Playground](https://github.com/AlloSphere-Research-Group/allolib_playground), and to **Dr. Lance Putnam** ([@LancePutnam](https://github.com/LancePutnam)) for creating the [Gamma](https://github.com/LancePutnam/Gamma) DSP library and the original [AlloSystem](https://github.com/AlloSphere-Research-Group/AlloSystem).
>
> And to all the AlloLib and AlloLib Playground contributors: **Keehong Youn**, **Kon Hyong Kim**, **Karl Yerkes**, **Myungin Lee**, **Timothy Wood**, **Joel A. Jaffe**, **Sihwa Park**, **Graham Wakefield**, **Aaron Anderson**, and **Dennis Adderton**.

---

## Features

### Core
- **Code Editor** - Monaco Editor with C++ syntax highlighting, AlloLib snippets, and intelligent autocomplete
- **Live Compilation** - Server-side Emscripten compilation to WebAssembly with streaming output
- **WebGL2 Graphics** - 3D rendering with meshes, lighting, shaders, and textures
- **Web Audio** - Real-time audio synthesis with Gamma DSP library
- **Parameter Panel** - Interactive GUI controls for synth parameters (like ImGui)
- **Preset System** - Save/load presets as allolib-compatible `.preset` files
- **Multi-File Projects** - Create headers, organize with folders, export as ZIP
- **Polyphonic Synths** - SynthGUIManager, PolySynth, keyboard-triggered voices
- **40+ Examples** - Ready-to-run demos organized by AlloLib and Playground categories
- **Multi-File Examples** - Examples with multiple source files and headers
- **Example Dialog** - Choose to add examples to project or start fresh
- **Glossary** - 330+ searchable terms covering AlloLib and Gamma DSP APIs
- **Error Highlighting** - Compiler errors shown directly in the editor
- **Audio Safety** - Built-in limiter protects your speakers

### Sequencer
- **Clip-Based Sequencer** - Create, edit, and arrange `.synthSequence` clips on a timeline
- **Auto Synth Detection** - Detects `SynthVoice` subclasses from your C++ source on compile
- **Frequency Roll** - Piano-roll-style view for editing note events by frequency and time
- **Tone Lattice** - Interactive 5-limit just intonation lattice for composing with pure intervals
  - **2D Mode** - Octave-reduced lattice of 3rds and 5ths
  - **3D Mode** - Full lattice with octave (2), fifth (3), and major third (5) axes, isometric projection with mouse-drag rotation
  - **Note Mode** - Click to toggle notes on/off
  - **Path Mode** - Click or drag across nodes to create sequenced note paths with configurable time offsets
  - **Chord Mode** - Select multiple nodes then finalize as a chord with duration and repeat count
  - **Poly Paths** - Stack multiple paths through the same node with `^n` count markers
  - **Context Menus** - Right-click notes or paths to edit duration, amplitude, and timing
- **Clip File Organization** - `.synthSequence` files stored in `bin/<SynthName>-data/` directories
- **Arrangement View** - Place clip instances on tracks, loop regions, per-track mute/solo
- **Spectrum Analyzer** - Professional FFT visualization with configurable resolution

### Terminal
- **Unix-Like Shell** - Navigate the virtual filesystem with `ls`, `cd`, `cat`, `grep`, `find`, etc.
- **Project Commands** - `compile`, `run`, `stop`, `open <file>` for quick project control
- **Sequencer Commands** - Control playback, tracks, clips, and notes via `seq` commands
- **Scripting System** - Define custom functions with `fn name { commands }` (shell) or `fn name js { code }` (JavaScript)
- **Full JavaScript API** - Execute JS code with `js { code }` for automation and scripting
  - Access to `fs`, `project`, `seq`, `Math`, `mtof/ftom`, and more
  - Lattice/Just Intonation API for creating sequences from ratio strings
- **Reference Tab** - Searchable command documentation with examples
  - Add custom command documentation that persists across sessions
- **Tab Completion** - Autocomplete commands, filenames, and user scripts
- **Pipes & Redirects** - Chain commands with `|`, write output with `>` or `>>`

## Quick Start

### Desktop App (Recommended)

Download the standalone desktop application from [GitHub Releases](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/releases):

| Platform | Download |
|----------|----------|
| Windows | `AlloLib-Studio-Setup-x.x.x.exe` |
| macOS (Intel) | `AlloLib-Studio-x.x.x-x64.dmg` |
| macOS (Apple Silicon) | `AlloLib-Studio-x.x.x-arm64.dmg` |
| Linux | `AlloLib-Studio-x.x.x.AppImage` |

The desktop app:
- Runs locally with no internet required (after download)
- Automatically checks for updates
- Bundles the backend compilation server

### Online Demo

Visit the hosted version (coming soon) or run locally:

### Run Locally (Development)

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
3. **Play** notes using your keyboard (ZXCVBNM, ASDFGHJ, QWERTYU)
4. **Adjust** parameters in the Parameter Panel
5. **Save** presets with Quick Save (creates `.preset` files)

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

### Musical Keyboard

For synth examples, play notes with your keyboard:
- **ZXCVBNM** - C3 to B3 (low octave)
- **ASDFGHJ** - C4 to B4 (middle C octave)
- **QWERTYU** - C5 to B5 (high octave)

### Terminal Commands

The Terminal tab provides a shell-like interface. Examples:

```bash
# File navigation
ls -l                    # List files with details
cat main.cpp             # View file contents
grep TODO *.cpp          # Search in files

# Project control
compile                  # Compile the project
run                      # Compile and run
stop                     # Stop execution

# Sequencer control
seq play                 # Start playback
seq bpm 140              # Set tempo
seq track add MySynth    # Add a track

# Custom functions
fn rebuild compile && run
fn hello js { print("Hello, " + $1) }

# JavaScript with lattice API
js lattice.sequence("1/1 5/4 3/2 2/1", "1 0.5 0.5 2", {base: 440})
js lattice.randomSequence(lattice.scales.pentatonic)
```

Type `help` for all commands or click the **Reference** tab for searchable documentation.

### Camera Controls

Default camera controls in the viewer:
- **WASD** - Move forward/left/back/right
- **Q/E** - Move up/down
- **Mouse drag** - Look around

## Examples

The Examples dropdown organizes demos into two main groups:

### AlloLib Examples

Core framework examples demonstrating fundamental concepts:

| Category | Examples |
|----------|----------|
| **Basics** | Hello Sphere, Hello Audio, AudioVisual |
| **Graphics** | Shapes, Transforms, Lighting, Shaders, Textures |
| **Audio** | Oscillators, Envelopes, Synthesis |
| **Interaction** | Keyboard, Mouse, Navigation |
| **Scene System** | SynthVoice, PolySynth, DynamicScene |
| **Simulation** | Particle Systems, Physics, Agent-Based (Flocking, Wave Equation, Spring Mesh) |
| **Advanced** | Particles, Generative, Multi-File Projects |

### AlloLib Playground Examples

Creative coding examples with synthesis and audio-visual integration:

| Category | Examples |
|----------|----------|
| **Synthesis** | Sine Envelope, Wavetable, FM, Subtractive, Additive |
| **AudioVisual** | AudioVisual Spheres, Synthesis Showcase |

### Loading Examples

When selecting an example, a dialog appears with two options:
- **Add to Project** - Adds the example file(s) to your current project
- **Replace Project** - Clears existing files and starts fresh with the example

Multi-file examples show a file list in the dialog before loading.

## Architecture

```
Browser                                Server
┌──────────────────────────┐          ┌─────────────────┐
│  Monaco Editor           │  HTTP/WS │   Express API   │
│       ↓                  │ ───────→ │       ↓         │
│  C++ Source              │          │  Emscripten     │
│       ↓                  │  WASM    │       ↓         │
│  WASM Runtime            │ ←─────── │  WebAssembly    │
│       ↓                  │          └─────────────────┘
│  WebGL2 + Audio          │
│       ↓                  │
│  Sequencer / Tone Lattice│
│       ↓                  │
│  .synthSequence Files    │
└──────────────────────────┘
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
├── frontend/                # Vue 3 web application
│   └── src/
│       ├── components/      # UI components
│       │   └── sequencer/   # Sequencer panel, timeline, lattice, toolbar, sidebar
│       ├── services/        # Compiler, Runtime, WebSocket
│       ├── stores/          # Pinia state (project, sequencer, settings, terminal)
│       └── utils/           # Tone lattice math, synth detection, .synthSequence parser
├── backend/                 # Node.js compilation server
│   └── docker/              # Emscripten container
├── desktop/                 # Electron desktop application
│   ├── src/                 # Main process, preload, menu
│   ├── scripts/             # Build scripts for all platforms
│   └── resources/           # App icons
├── allolib/                 # AlloLib C++ library (cloned separately)
└── allolib-wasm/            # WASM build configuration & compatibility headers
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

### Build Desktop App

To build the desktop application from source:

```bash
# Install dependencies
npm install
cd desktop && npm install && cd ..

# Build for your platform
npm run desktop:dist:win    # Windows
npm run desktop:dist:mac    # macOS
npm run desktop:dist:linux  # Linux

# Output in desktop/release/
```

Or use the build scripts:

**Windows (PowerShell):**
```powershell
cd desktop
.\scripts\setup.ps1
.\scripts\build-local.ps1 -Target all
```

**macOS/Linux:**
```bash
cd desktop
chmod +x scripts/build-local.sh
./scripts/build-local.sh --target all
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

- [AlloSphere Research Group](https://allosphere.ucsb.edu/) - UCSB's immersive multimedia research facility, directed by Dr. JoAnn Kuchera-Morin
- [AlloLib](https://github.com/AlloSphere-Research-Group/allolib) - Interactive multimedia C++ library by Dr. Andres Cabrera and the AlloSphere team
- [AlloLib Playground](https://github.com/AlloSphere-Research-Group/allolib_playground) - Tutorials and examples for AlloLib by Dr. Andres Cabrera, Myungin Lee, and contributors
- [AlloSystem](https://github.com/AlloSphere-Research-Group/AlloSystem) - The original AlloSphere C++ libraries by Dr. Lance Putnam
- [Gamma](https://github.com/LancePutnam/Gamma) - Generic sound synthesis C++ library by Dr. Lance Putnam
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Microsoft

## License

MIT License - see [LICENSE](LICENSE) for details.

Copyright (c) 2025 Luc Freiburg
