# AlloLib Studio Online

**Write, compile, and run AlloLib C++ code directly in your browser — no installation required.**

**[Launch the app →](https://9livezzz-git.github.io/Allolib-Studio-Online/)**

AlloLib Studio Online is a browser-based IDE for the [AlloLib](https://github.com/AlloSphere-Research-Group/allolib) C++ creative coding framework. Write C++ in Monaco Editor, compile server-side via Emscripten, and run the result as WebAssembly with WebGL2/WebGPU rendering and Web Audio — all in the browser.

---

> Built on the work of the [AlloSphere Research Group](https://allosphere.ucsb.edu/) at UC Santa Barbara.
>
> Special thanks to **Dr. JoAnn Kuchera-Morin** (Director, AlloSphere Research Facility), **Dr. Andres Cabrera** (AlloLib architect), **Dr. Lance Putnam** (Gamma DSP / AlloSystem), and all AlloLib contributors.

---

## Features

- **Monaco Editor** — C++ syntax highlighting, snippets, error diagnostics, multi-file projects
- **Live Compilation** — Emscripten server compiles to WASM; results stream back in seconds
- **WebGL2 + WebGPU** — Dual rendering backends; switch per-example or in settings
- **Web Audio** — Gamma DSP runs in an AudioWorklet at 128 samples/buffer
- **155 Examples** — AlloLib, Playground, and Studio GPU examples, ready to run
- **Sequencer** — Clip-based timeline, tone lattice (2D/3D just intonation), polyphonic synths
- **Asset Library** — Built-in PBR textures, OBJ meshes (bunny, teapot, suzanne), HDR environments
- **Terminal** — Shell-like interface with `compile`, `run`, sequencer control, and JS scripting
- **Recording** — Export video (WebM) or screenshots (PNG/JPEG/WebP) with social media size presets
- **Parameter Panel** — Runtime GUI sliders and toggles (AlloLib GUI / ImGui-style)

## Usage

1. Open **[https://9livezzz-git.github.io/Allolib-Studio-Online/](https://9livezzz-git.github.io/Allolib-Studio-Online/)**
2. Write C++ or pick an example from the **Examples** dropdown
3. Click **Run** (or `Ctrl+Enter`) to compile and execute
4. Interact with the canvas — WASD to move, mouse to look, keyboard for synth notes

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Compile and run |
| `Ctrl+S` | Save to browser |
| `Ctrl+F` | Find in editor |

### Musical keyboard (synth examples)

| Keys | Octave |
|------|--------|
| `ZXCVBNM` | C3–B3 |
| `ASDFGHJ` | C4–B4 |
| `QWERTYU` | C5–B5 |

## Running Locally

The frontend is a static site served from GitHub Pages. To run with a local compilation backend:

```bash
git clone https://github.com/9LiveZZZ-Git/Allolib-Studio-Online.git
cd Allolib-Studio-Online

# Install dependencies
npm install

# Start Docker containers (Redis + compiler)
docker start allolib-compiler redis

# Run backend and frontend
npm run dev
# → Frontend: http://localhost:3000
# → Backend:  http://localhost:4000
```

**Requirements:** Node.js 18+, Docker

See `PROJECT.md` for full architecture and Docker setup instructions.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Vue 3, TypeScript, Pinia, Monaco Editor |
| Backend | Node.js, Express, BullMQ, Redis |
| Compiler | Emscripten 3.1.73, Docker |
| Graphics | WebGL2 (default), WebGPU |
| Audio | Web Audio API, AudioWorklet, Gamma DSP |

## Acknowledgments

- [AlloSphere Research Group](https://allosphere.ucsb.edu/) — UCSB immersive multimedia research, directed by Dr. JoAnn Kuchera-Morin
- [AlloLib](https://github.com/AlloSphere-Research-Group/allolib) — Dr. Andres Cabrera and the AlloSphere team
- [AlloLib Playground](https://github.com/AlloSphere-Research-Group/allolib_playground) — Dr. Andres Cabrera, Myungin Lee, and contributors
- [Gamma](https://github.com/LancePutnam/Gamma) — Dr. Lance Putnam
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — Microsoft

## License

MIT License — see [LICENSE](LICENSE) for details.

Copyright (c) 2025 Luc Freiburg
