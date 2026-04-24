# AlloLib Studio Online

**Write, compile, and run AlloLib C++ code directly in your browser — no installation required.**

**[Launch the app →](https://9livezzz-git.github.io/Allolib-Studio-Online/)**
**[Wiki & Documentation →](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki)**

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

## Documentation

Full documentation is available on the **[GitHub Wiki](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki)**:

- [Getting Started](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Getting-Started-Online)
- [Web API Reference](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Web-API-Reference) — WebTexture, WebPBR, WebOBJ, WebHDR, WebEnvironment, LOD, Quality
- [AlloLib Synth API](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/AlloLib-API-Synth) — SynthVoice, PolySynth, DynamicScene
- [Gamma DSP Reference](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Gamma-DSP-Reference) — Oscillators, Filters, Envelopes, Effects
- [Architecture Overview](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Architecture-Overview)
- [Examples Guide](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Examples-Guide)

## Acknowledgments

Built on the work of the [AlloSphere Research Group](https://allosphere.ucsb.edu/) at UC Santa Barbara.

**AlloLib** — [github.com/AlloSphere-Research-Group/allolib](https://github.com/AlloSphere-Research-Group/allolib)
Created and led by **Dr. Andres Cabrera** ([@mantaraya36](https://github.com/mantaraya36)).
Contributors: **Keehong Youn**, **Kon Hyong Kim**, **Karl Yerkes**, **Myungin Lee**, **Timothy Wood**, **Joel A. Jaffe**, **Sihwa Park**, **Graham Wakefield**, **Aaron Anderson**, **Dennis Adderton**, **Ricky Walsh**

**AlloLib Playground** — [github.com/AlloSphere-Research-Group/allolib_playground](https://github.com/AlloSphere-Research-Group/allolib_playground)
Created by **Dr. Andres Cabrera** and **Myungin Lee**, with tutorials and examples by the UCSB MAT community.

**Gamma DSP** — [github.com/LancePutnam/Gamma](https://github.com/LancePutnam/Gamma)
Created by **Dr. Lance Putnam** ([@LancePutnam](https://github.com/LancePutnam)).

**AlloSystem** — [github.com/AlloSphere-Research-Group/AlloSystem](https://github.com/AlloSphere-Research-Group/AlloSystem)
Original AlloSphere C++ libraries by **Dr. Lance Putnam** and **Graham Wakefield**.

**AlloSphere Research Facility** — Directed by **Dr. JoAnn Kuchera-Morin**, inventor of the AlloSphere and pioneer of immersive multimedia research at UC Santa Barbara.

**Assets:**
- HDR Environments & Textures: [Poly Haven](https://polyhaven.com) (CC0)
- Stanford Bunny: Stanford University Computer Graphics Laboratory (public domain)
- Utah Teapot: Martin Newell, University of Utah (public domain)
- Suzanne: Blender Foundation (CC0)
- Spot the Cow: Keenan Crane, Carnegie Mellon University (CC0)

**Tools & Libraries:**
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — Microsoft (MIT)
- [Emscripten](https://emscripten.org/) — Emscripten contributors (MIT/LLVM)
- [Vue 3](https://vuejs.org/) — Evan You and Vue contributors (MIT)
- [Vite](https://vitejs.dev/) — Evan You and Vite contributors (MIT)

## License

MIT License — see [LICENSE](LICENSE) for details.

Copyright (c) 2025 Luc Freiburg
