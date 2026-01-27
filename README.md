# AlloLib Studio Online

Browser-based creative coding environment for AlloLib C++ applications.

## Status

**Phase 3: Integration Testing - COMPLETE**

- ✅ Monaco Editor with C++ syntax and AlloLib snippets
- ✅ Server-side compilation with Emscripten (~5 second compile time)
- ✅ WebGL2 graphics rendering (3D meshes, colors, transforms, lighting)
- ✅ Web Audio playback (Gamma oscillators, AudioWorklet output)
- ✅ Audio analysis panel (level meters, waveform, spectrum analyzer)
- ✅ Keyboard/mouse input (Emscripten HTML5 event handlers)

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

## License

MIT
