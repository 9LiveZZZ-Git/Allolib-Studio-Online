# AlloLib Studio Online — Wiki & Reference Tab Plan

Generated: 2026-04-23

---

## REFERENCE TAB GAPS (Glossary Additions)

Current: 380 terms across 12 categories.
Target: ~520–540 terms. Priority-ranked below.

---

### PRIORITY 1 — Gamma DSP Missing (High user value, frequently used)

**Missing oscillators/generators:**
- `gam::Noise` (alias group) — NoisePink, NoiseBrown, NoiseWhite, NoiseViolet, NoiseBinary
- `gam::Pulse` — PWM oscillator with `width()` control
- `gam::DSF` / `gam::DWO` — Band-limited oscillators

**Missing envelopes:**
- `gam::Seg` — Linear segment (start→end over time), building block for Env
- `gam::Env` — General multi-segment envelope with `sustainPoint()`
- `gam::Decay` — Pure exponential decay, lighter than ADSR

**Missing filters:**
- `gam::AllPass2` — 2nd-order all-pass (phase shifting)
- `gam::Notch` — Notch/band-reject filter with `freq()` + `width()`
- `gam::Reson` — 2-pole resonator/formant filter

**Missing effects:**
- `gam::Chorus` — Modulated delay chorus effect
- `gam::Pluck` — Karplus-Strong plucked string synthesis
- `gam::FreqShift` — Frequency domain shift
- `gam::ChebyN` — Chebyshev harmonic distortion
- `gam::AM` — Amplitude/ring modulation
- `gam::MonoSynth` — Self-contained mono synth voice
- `gam::Quantizer` — Bit/frequency quantization

**Missing utilities:**
- `gam::Param<T>` — Smoothed parameter with exponential glide
- `gam::Voice` / `gam::Voices` — Gamma-level voice pool management
- `gam::IndexPool` — Voice index allocation (O(1))

---

### PRIORITY 2 — AlloLib Missing (Important but less beginner-facing)

**Missing spatializers:**
- `al::Vbap` — Vector-based amplitude panning (2D + 3D)
- `al::Dbap` — Distance-based amplitude panning
- `al::Lbap` — Linear basis amplitude panning
- `al::StereoPanner` — Simple stereo panning spatializer
- `al::DistAtten` — Distance attenuation model
- `al::SmoothPose` — Smoothed/interpolated pose

**Missing audio:**
- `al::SoundFile` — Read/write audio files (WAV, AIFF)
- `al::SoundFilePlayer` — Audio file playback
- `al::StaticDelayLine` — Fixed-length delay buffer
- `al::Reverb<T>` — Plate reverberator (al:: wrapper)

**Missing graphics:**
- `al::EasyFBO` — Simplified framebuffer (init/begin/end, tex + depthTex)
- `al::RBO` — Render buffer object (depth/stencil)
- `al::Font` / `al::FontRenderer` — Text rendering
- `al::Image` — Image file loading (native)
- `al::Isosurface` — Marching cubes mesh generator

**Missing UI/parameters:**
- `al::Composition` / `al::CompositionStep` — Timed preset sequences
- `al::BundleGUIManager` — Multi-bundle GUI manager
- `al::ParameterMIDI` — MIDI-mapped parameters
- `al::PresetMIDI` — MIDI-triggered preset recall
- `al::ParameterDouble` / `al::ParameterInt` variants — typed parameters

**Missing app/domain:**
- `al::SimulationDomain` — Simulation tick separate from graphics
- `al::AsynchronousDomain` — Base for custom async processors
- `al::AudioCallback` — Chainable audio processor (append/prepend)
- `al::AppRecorder` — Record application state to file

**Missing scene:**
- `al::PositionedVoice` — SynthVoice with 3D position
- `al::DistributedScene` — Network-synced polyphonic scene

**Missing math/utility:**
- `al::Frustum` — View frustum for culling
- `al::HashSpace` — Spatial hash for proximity queries
- `al::CSVReader` — Expand existing entry with full API
- `al::Clock` — Expand existing entry

---

### PRIORITY 3 — Web Platform Gaps (Studio-specific)

- `WebApp` lifecycle vs `App` — detailed comparison
- `configureBackend()` — full BackendType enum docs
- `WebControlGUI` — all parameter widget types
- `WebMIDI` — expand with note/CC/clock API
- `WebSamplePlayer` — expand with playback control API
- `al_WebFile::loadFromURL` / `al_WebFile::promptUpload` — full API
- `al_WebImage` — pixel access and canvas-to-texture

---

## GITHUB WIKI STRUCTURE

8 top-level sections, ~35 pages total.

```
Home
├── 1. Getting Started
│   ├── 1.1 Online (No Install)
│   ├── 1.2 Local Dev Setup
│   ├── 1.3 Desktop App (Electron)
│   └── 1.4 IDE Basics & Shortcuts
│
├── 2. Features Guide
│   ├── 2.1 Code Editor & Projects
│   ├── 2.2 Compilation & Backends
│   ├── 2.3 Parameter Panel (Runtime GUI)
│   ├── 2.4 Sequencer (DAW Timeline)
│   ├── 2.5 Keyframe Timeline (4-Category)
│   ├── 2.6 Asset Library
│   ├── 2.7 Terminal & Scripting
│   └── 2.8 Recording & Export
│
├── 3. Web API Reference
│   ├── 3.1 WebApp & App Lifecycle
│   ├── 3.2 Textures (WebTexture, MipmapTexture)
│   ├── 3.3 Materials (WebPBR)
│   ├── 3.4 Environments & Skybox (WebHDR, WebEnvironment)
│   ├── 3.5 Mesh Loading (WebOBJ)
│   ├── 3.6 Procedural Generation (WebProcedural)
│   ├── 3.7 LOD & Quality System (WebLOD, WebQuality, WebAutoLOD)
│   ├── 3.8 Object Manager (WebObjectManager)
│   ├── 3.9 Audio (WebSamplePlayer, WebMIDI)
│   └── 3.10 Native Compatibility Headers
│
├── 4. AlloLib API Reference
│   ├── 4.1 App & Domains
│   ├── 4.2 Graphics (Mesh, Shader, Texture, FBO)
│   ├── 4.3 Camera & Navigation (Nav, Lens, NavInputControl)
│   ├── 4.4 Lighting & Materials
│   ├── 4.5 Synth System (SynthVoice, PolySynth, DynamicScene)
│   ├── 4.6 Sequencer & Presets
│   ├── 4.7 Spatial Audio (Spatializers, Ambisonics)
│   ├── 4.8 Parameters & GUI
│   └── 4.9 Math Types (Vec, Mat, Quat, Pose)
│
├── 5. Gamma DSP Reference
│   ├── 5.1 Oscillators
│   ├── 5.2 Noise Generators
│   ├── 5.3 Envelopes
│   ├── 5.4 Filters
│   └── 5.5 Effects & Utilities
│
├── 6. Examples Guide
│   ├── 6.1 AlloLib Basics
│   ├── 6.2 Graphics & Rendering
│   ├── 6.3 Audio & Synthesis
│   ├── 6.4 Spatial Audio
│   └── 6.5 Studio GPU Examples
│
├── 7. Architecture
│   ├── 7.1 System Overview
│   ├── 7.2 Frontend (Vue + Pinia Stores)
│   ├── 7.3 Backend & Compilation Pipeline
│   ├── 7.4 WASM Runtime & Graphics
│   └── 7.5 Audio Pipeline
│
└── 8. Contributing
    ├── 8.1 Dev Setup & Git Workflow
    ├── 8.2 Adding Examples
    ├── 8.3 Testing
    └── 8.4 Known Issues & Roadmap
```

---

## IMPLEMENTATION ORDER

### Phase 1 — Wiki skeleton (Home + Getting Started + Architecture)
Create the repo structure, Home page, Getting Started pages, and Architecture overview.
These are high-value for new users and can be written from existing CLAUDE.md / PLAN.md.

### Phase 2 — Web API Reference pages
Auto-generate from `allolib-wasm/include/*.hpp` headers.
Each page = one header = class description + all public methods.

### Phase 3 — AlloLib + Gamma Reference pages
Summarize the Doxygen findings from agents into clean wiki pages with examples.

### Phase 4 — Glossary additions
Add Priority 1 (Gamma DSP gaps) first, then Priority 2, then Priority 3.
Each batch: ~30–40 new entries added to `frontend/src/data/glossary.ts`.

### Phase 5 — Examples guide pages
Auto-generated from `examples.ts` + `studioExamples.ts` with descriptions.

---

## NOTES

- Wiki lives at: https://github.com/9LiveZZZ-Git/Allolib-Studio-Online/wiki
- Wiki git repo: https://github.com/9LiveZZZ-Git/Allolib-Studio-Online.wiki.git
- Each wiki page = one `.md` file, filename = URL slug
- Home page = `Home.md`
- All pages link back to Home
