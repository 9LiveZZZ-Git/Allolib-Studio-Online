# AlloLib Studio Online

Browser-based creative coding environment for AlloLib C++ applications.

## Overview

AlloLib Studio Online enables users to write, compile, and run AlloLib C++ code directly in the web browser. No local installation required.

## Architecture

This project uses **server-side compilation**:
- User writes C++ code in the browser (Monaco Editor)
- Code is sent to the backend server
- Server compiles with Emscripten against pre-built AlloLib
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
│   └── ...
├── allolib-wasm/       # AlloLib WebAssembly port
│   ├── include/        # Header files
│   ├── src/            # Web Audio backend, etc.
│   └── CMakeLists.txt  # Emscripten build config
└── docs/               # Documentation
```

## Tech Stack

**Frontend:**
- Vue 3 + TypeScript
- Monaco Editor (code editing)
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
- pnpm or npm
- Docker (for backend compilation)
- Emscripten SDK (for local development)

### Installation

```bash
# Install dependencies
npm install

# Start development servers
npm run dev
```

### Development

```bash
# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend

# Build for production
npm run build
```

## License

MIT
