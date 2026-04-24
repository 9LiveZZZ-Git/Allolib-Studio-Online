<div align="center">

# AlloLib Studio Online

**A browser-based IDE for the AlloLib C++ creative coding framework.**

Write C++, compile server-side via Emscripten, run as WebAssembly with WebGL2/WebGPU rendering and Web Audio — all in the browser.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-green.svg)](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/releases)
[![WebGL2](https://img.shields.io/badge/WebGL2-supported-success.svg)]()
[![WebGPU](https://img.shields.io/badge/WebGPU-supported-success.svg)]()
[![Wiki](https://img.shields.io/badge/docs-wiki-blue.svg)](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki)

[**Launch App**](https://9livezzz-git.github.io/Allolib-Studio-Online/) · [**Documentation**](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki) · [**Examples**](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Examples-Guide) · [**Report Bug**](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/issues) · [**Security**](SECURITY.md)

</div>

---

## ✨ Features

- 🎨 **Monaco Editor** — Full C++ syntax highlighting, snippets, error diagnostics, multi-file projects
- ⚡ **Live Compilation** — Emscripten server compiles to WASM in seconds, results stream back
- 🖥 **Dual Graphics** — WebGL2 (stable, universal) and WebGPU (modern compute-capable) backends
- 🔊 **Web Audio + Gamma DSP** — AudioWorklet at 128 samples/buffer, full Gamma synthesis library
- 📚 **155+ Examples** — AlloLib core, Playground, and Studio GPU examples ready to run
- 🎹 **Sequencer** — Clip-based timeline, 2D/3D tone lattice (just intonation), polyphonic synths
- 🎞 **Timeline** — 4-category keyframe animation (audio, objects, environment, events)
- 📦 **Asset Library** — Built-in PBR textures, OBJ meshes, HDR environments (all CC0)
- 💻 **Terminal** — Virtual shell with `compile`, `run`, sequencer control, and JS scripting
- 📼 **Export** — WebM video, PNG/JPEG/WebP screenshots, social media presets

## 🚀 Quick Start

### Use Online
Open **[9livezzz-git.github.io/Allolib-Studio-Online](https://9livezzz-git.github.io/Allolib-Studio-Online/)**, pick an example, press `Ctrl+Enter`.

### Run Locally

```bash
git clone https://github.com/9LiveZZZ-Git/Allolib-Studio-Online.git
cd Allolib-Studio-Online
npm install                              # install workspace dependencies
docker start allolib-compiler redis      # first-time? see Wiki: Getting Started Local
npm run dev                              # http://localhost:3000
```

**Requirements:** Node.js 18+ · Docker · Git

See **[Wiki: Getting Started Local](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Getting-Started-Local)** for Docker container setup.

## 📖 Documentation

All documentation lives on the **[GitHub Wiki](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki)**:

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

## 🏗 Architecture

```
┌─────────────────────┐        ┌──────────────────┐       ┌────────────────┐
│  Browser (Vue 3)    │  HTTP  │  Express Server  │  exec │  Emscripten    │
│  Monaco Editor ────▶│───────▶│  BullMQ + Redis ─┼──────▶│  (Docker)      │
│  WASM Runtime  ◀────│◀───────│  app.js + .wasm  │◀──────│  al_web lib    │
│  WebGL2 / WebGPU    │        └──────────────────┘       └────────────────┘
│  Web Audio Worklet  │
└─────────────────────┘
```

**Tech Stack**
| Layer | Technologies |
|-------|-------------|
| Frontend | Vue 3, TypeScript, Pinia, Monaco Editor, Vite |
| Backend | Node.js, Express, BullMQ, Redis |
| Compiler | Emscripten 3.1.73, Docker |
| Graphics | WebGL2 (default), WebGPU |
| Audio | Web Audio API, AudioWorklet, Gamma DSP |
| Testing | Playwright (E2E), visual regression |

## 🧪 Testing

```bash
cd tests && npx playwright test                    # run all E2E tests
cd tests && UPDATE_BASELINES=true npx playwright test  # update visual baselines
```

Four test suites: comprehensive functional (155 examples × 2 backends), WebGPU features, enhanced visual verification, and interaction tests. See the [Contributing guide](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Contributing).

## 🗺 Roadmap

- [x] Dual backend (WebGL2 + WebGPU Phases 1-8)
- [x] 155 examples, 100% compile + render pass rate
- [x] Cloud compilation (Railway-hosted)
- [x] Tone lattice sequencer
- [x] Full wiki documentation
- [ ] Events-track keyframe wiring (in progress)
- [ ] WebGPU mipmap compute shaders
- [ ] PresetHandler localStorage backend
- [ ] GPU compute examples (fluid, particles)

See [WIKI_PLAN.md](WIKI_PLAN.md) for reference tab expansion plans.

## 🤝 Contributing

Contributions welcome! Please:
1. Work on the `dev` branch (not `main`)
2. Run tests before submitting: `cd tests && npx playwright test`
3. See [Contributing guide](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki/Contributing) for patterns and conventions

## 🔒 Security

See [SECURITY.md](SECURITY.md) for our security policy, supported versions, and how to report vulnerabilities responsibly.

## 📜 License

MIT License — see [LICENSE](LICENSE). Copyright (c) 2025 Luc Freiburg.

## 🙏 Acknowledgments

Built on the work of the [AlloSphere Research Group](https://allosphere.ucsb.edu/) at UC Santa Barbara.

<details>
<summary><strong>Full contributor credits</strong></summary>

**AlloLib** — [github.com/AlloSphere-Research-Group/allolib](https://github.com/AlloSphere-Research-Group/allolib)
Created and led by **Dr. Andres Cabrera** ([@mantaraya36](https://github.com/mantaraya36)).
Contributors: Keehong Youn, Kon Hyong Kim, Karl Yerkes, Myungin Lee, Timothy Wood, Joel A. Jaffe, Sihwa Park, Graham Wakefield, Aaron Anderson, Dennis Adderton, Ricky Walsh.

**AlloLib Playground** — [github.com/AlloSphere-Research-Group/allolib_playground](https://github.com/AlloSphere-Research-Group/allolib_playground)
By Dr. Andres Cabrera, Myungin Lee, and the UCSB MAT community.

**Gamma DSP** — [github.com/LancePutnam/Gamma](https://github.com/LancePutnam/Gamma)
Created by **Dr. Lance Putnam** ([@LancePutnam](https://github.com/LancePutnam)).

**AlloSystem** — Original AlloSphere C++ libraries by Dr. Lance Putnam and Graham Wakefield.

**AlloSphere Research Facility** — Directed by **Dr. JoAnn Kuchera-Morin**, inventor of the AlloSphere.

**Assets (all CC0):**
- HDR Environments & Textures from [Poly Haven](https://polyhaven.com)
- Stanford Bunny — Stanford CGL · Utah Teapot — Martin Newell · Suzanne — Blender Foundation · Spot the Cow — Keenan Crane

**Tools:**
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) (Microsoft, MIT)
- [Emscripten](https://emscripten.org/) (MIT/LLVM)
- [Vue 3](https://vuejs.org/) and [Vite](https://vitejs.dev/) (MIT)

</details>

---

<div align="center">

Made with ♥ at UC Santa Barbara · [Issues](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/issues) · [Discussions](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/discussions) · [Wiki](https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki)

</div>
