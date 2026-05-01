<div align="center">

# AlloLib Studio Online

**Write, compile, and run AlloLib C++ code directly in your browser — no installation required.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.12.1-green.svg)](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/releases)
[![WebGL2](https://img.shields.io/badge/WebGL2-supported-success.svg)]()
[![WebGPU](https://img.shields.io/badge/WebGPU-known%20issue-yellow.svg)]()
[![Wiki](https://img.shields.io/badge/docs-wiki-blue.svg)](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki)

[**Launch App**](https://9livezzz-git.github.io/Allolib-Studio-Online/) · [**Documentation**](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki) · [**Examples**](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Examples-Guide) · [**Report Bug**](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/issues) · [**Security**](SECURITY.md)

</div>

---

AlloLib Studio Online is a browser-based IDE for the [AlloLib](https://github.com/AlloSphere-Research-Group/allolib) C++ creative coding framework. Write C++ in Monaco Editor, compile server-side via Emscripten, and run the result as WebAssembly with WebGL2/WebGPU rendering and Web Audio — all in the browser.

> Built on the work of the [AlloSphere Research Group](https://allosphere.ucsb.edu/) at UC Santa Barbara.
>
> Special thanks to **Dr. JoAnn Kuchera-Morin** (Director, AlloSphere Research Facility), **Dr. Andres Cabrera** (AlloLib architect), **Dr. Lance Putnam** (Gamma DSP / AlloSystem), and all AlloLib contributors.

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
# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
```

**Requirements:** Node.js 18+, Docker

See the [Wiki: Getting Started Local](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Getting-Started-Local) for full setup and `PROJECT.md` for architecture details.

## Documentation

Full documentation lives on the **[GitHub Wiki](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki)**.

<table>
<tr>
<td>

**Tutorials**
- [Your First App](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Tutorial-Your-First-App)
- [Graphics](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Tutorial-Graphics)
- [Audio](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Tutorial-Audio)
- [Interactive](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Tutorial-Interactive)

</td>
<td>

**Core API**
- [App & Lifecycle](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/AlloLib-API-App)
- [Graphics](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/AlloLib-API-Graphics)
- [Camera & Nav](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/AlloLib-API-Camera)
- [Synth System](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/AlloLib-API-Synth)
- [Gamma DSP](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Gamma-DSP-Reference)

</td>
<td>

**Web API**
- [Textures & PBR](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Web-API-Textures)
- [Environments/HDR](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Web-API-Environment)
- [OBJ Meshes](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Web-API-Meshes)
- [Materials](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Web-API-Materials)
- [Platform Guide](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Web-Platform-Guide)

</td>
</tr>
</table>

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | Vue 3, TypeScript, Pinia, Monaco Editor |
| Backend | Node.js, Express, BullMQ, Redis |
| Compiler | Emscripten 3.1.73, Docker |
| Graphics | WebGL2 (default), WebGPU |
| Audio | Web Audio API, AudioWorklet, Gamma DSP |

## Testing

```bash
cd tests && npx playwright test                        # run all E2E tests
cd tests && UPDATE_BASELINES=true npx playwright test  # update visual baselines
```

Four test suites cover 155 examples across both backends, WebGPU feature regressions, visual baseline comparisons, and interaction tests. See the [Contributing guide](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Contributing).

## Roadmap

- [x] Dual backend (WebGL2 + WebGPU Phases 1-8)
- [x] 155 examples, 100% compile + render pass rate
- [x] Cloud compilation (Railway-hosted)
- [x] Tone lattice sequencer
- [x] Full wiki documentation
- [ ] Events-track keyframe wiring
- [ ] WebGPU mipmap compute shaders
- [ ] GPU compute examples (fluid, particles)

See [WIKI_PLAN.md](WIKI_PLAN.md) and [FRONTEND_AUDIT.md](FRONTEND_AUDIT.md) for in-progress work.

## Contributing

Contributions welcome. Work on the `dev` branch, run tests before submitting, and see the [Contributing guide](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Contributing) for patterns and conventions.

## Security

See [SECURITY.md](SECURITY.md) for the security policy, supported versions, and responsible disclosure process.

## License

MIT License — see [LICENSE](LICENSE). Copyright (c) 2025 Luc Freiburg.

## Acknowledgments

- [AlloSphere Research Group](https://allosphere.ucsb.edu/) — UCSB immersive multimedia research, directed by Dr. JoAnn Kuchera-Morin
- [AlloLib](https://github.com/AlloSphere-Research-Group/allolib) — Dr. Andres Cabrera and the AlloSphere team. Contributors: Keehong Youn, Kon Hyong Kim, Karl Yerkes, Myungin Lee, Timothy Wood, Joel A. Jaffe, Sihwa Park, Graham Wakefield, Aaron Anderson, Dennis Adderton, Ricky Walsh
- [AlloLib Playground](https://github.com/AlloSphere-Research-Group/allolib_playground) — Dr. Andres Cabrera, Myungin Lee, and contributors
- [Gamma](https://github.com/LancePutnam/Gamma) — Dr. Lance Putnam
- [AlloSystem](https://github.com/AlloSphere-Research-Group/AlloSystem) — Original AlloSphere C++ libraries by Dr. Lance Putnam and Graham Wakefield
- Assets (all CC0): [Poly Haven](https://polyhaven.com) · Stanford Bunny (Stanford CGL) · Utah Teapot (Martin Newell) · Suzanne (Blender Foundation) · Spot the Cow (Keenan Crane)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — Microsoft
