/**
 * MAT200B Buildable A/V Examples — Registry skeleton
 *
 * This file is the Phase 0 scaffold for the MAT200B example set described in
 * `MAT200B_EXAMPLES_PLAN.md`. Categories below are wired into the dropdown via
 * `categoryGroups` in `examples.ts` and the flat `categories` export. The
 * `mat200bExamples` and `mat200bMultiFileExamples` arrays are intentionally
 * empty — Phase 2 fills them with real entries.
 *
 * Subcategory taxonomy follows MAT200B_EXAMPLES_PLAN.md § 0.1:
 *   - mat-mixing      → stems, mastering, spatial
 *   - mat-synthesis   → wavetable, additive, subtractive, modulation,
 *                       physical, granular, concat
 *   - mat-signal      → dynamics, spectral, delay, convolution, spatial
 *   - mat-visualmusic → mappers, image-as-sound, scores
 */

import type { Example, ExampleCategory, MultiFileExample } from './examples'

export const mat200bCategories: ExampleCategory[] = [
  {
    id: 'mat-mixing',
    title: 'MAT200B - Mixing & Monitoring',
    subcategories: [
      { id: 'stems', title: 'Stems' },
      { id: 'mastering', title: 'Mastering' },
      { id: 'spatial', title: 'Spatial' },
    ],
  },
  {
    id: 'mat-synthesis',
    title: 'MAT200B - Synthesis',
    subcategories: [
      { id: 'wavetable', title: 'Wavetable' },
      { id: 'additive', title: 'Additive' },
      { id: 'subtractive', title: 'Subtractive' },
      { id: 'modulation', title: 'Modulation' },
      { id: 'physical', title: 'Physical Models' },
      { id: 'granular', title: 'Granular' },
      { id: 'concat', title: 'Concatenative' },
    ],
  },
  {
    id: 'mat-signal',
    title: 'MAT200B - Signal Processing',
    subcategories: [
      { id: 'dynamics', title: 'Dynamics' },
      { id: 'spectral', title: 'Spectral' },
      { id: 'delay', title: 'Delay/Comb/Allpass' },
      { id: 'convolution', title: 'Convolution' },
      { id: 'spatial', title: 'Spatialization' },
    ],
  },
  {
    id: 'mat-visualmusic',
    title: 'MAT200B - Visual Music',
    subcategories: [
      { id: 'mappers', title: 'Mappers' },
      { id: 'image-as-sound', title: 'Image-as-Sound' },
      { id: 'scores', title: 'Generative Scores' },
    ],
  },
]

// MAT200B examples are AlloLib Studio Online — NOT allolib_playground
// vanilla. They target the studio's web build directly and use only the
// primitives already shipping in libal_web.a:
//   - al_playground_compat.hpp (provides web ControlGUI, WebPresetHandler,
//     Trigger, SynthGUIManager, the full parameter pipeline, etc.)
//   - al::Parameter / ParameterBool / ParameterColor / ...
//   - al::Mesh + al::Graphics (web backends)
//   - Gamma oscillators / filters / envelopes
// No _studio_shared/ helpers — they were redundant and the namespace +
// API drift bugs we hit in v0.10.2-v0.10.5 were exactly the maintenance
// cost the user wanted to avoid. The examples ship as plain-Studio-Online
// .cpp blobs; round-tripping back to a desktop AlloLib install is NOT a
// goal for this set.
//
// v0.11.0: cross-cutting helpers retired from the plan.
// ──────────────────────────────────────────────────────────────────────────
export const mat200bExamples: Example[] = [
  // ──────────────────────────────────────────────────────────────────────────
  //  MAT200B Template — canonical shape for every Phase 2/3 example.
  //  ControlGUI + PresetHandler register five parameters covering the
  //  major al::Parameter types; an audio->graphics ringbuffer pattern
  //  shown inline; per-vertex color fade gives a trail without FBOs.
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'mat-template',
    title: 'MAT200B Template — Studio Online Skeleton',
    description:
      'Canonical shape every MAT200B example follows. ControlGUI + WebPresetHandler register five al::Parameter types covering the major typed surface (float, int, bool, color, trigger). Inline audio→graphics ringbuffer with std::atomic<int> write index, no helper headers. Per-vertex color fade gives a CRT-like trail without FBO ping-pong. ~120 LOC.',
    category: 'mat-visualmusic',
    subcategory: 'mappers',
    code: `/**
 * MAT200B Template — Studio Online skeleton
 *
 * Reference shape for every MAT200B example. No _studio_shared/
 * helpers — only what already ships in libal_web.a:
 *   - al_playground_compat.hpp  (ControlGUI, WebPresetHandler, Trigger)
 *   - al::Parameter family       (parameter pipeline auto-registers)
 *   - al::Mesh + al::Graphics   (web backends)
 *   - Gamma oscillators
 *
 * Audio writes a sine to stereo + a 1024-sample ring; graphics
 * snapshots the ring each frame and rebuilds a LINE_STRIP mesh with
 * per-vertex color fade (head bright -> tail dark) so the trace looks
 * scope-like without an FBO ping-pong.
 *
 * Five parameters cover the major al::Parameter types:
 *   freq        Parameter (float)
 *   detune      ParameterInt
 *   stereo      ParameterBool
 *   tint        ParameterColor
 *   reset       Trigger
 */

#include "al_playground_compat.hpp"
#include "Gamma/Oscillator.h"

#include <array>
#include <atomic>

using namespace al;

class MATTemplate : public App {
public:
  Parameter      freq   {"freq",   "", 220.f, 50.f, 2000.f};
  ParameterInt   detune {"detune", "", 0,    -50,   50};
  ParameterBool  stereo {"stereo", "", true};
  ParameterColor tint   {"tint",   "", Color(0.4f, 0.9f, 0.5f)};
  Trigger        reset  {"reset",  ""};

  ControlGUI    gui;
  PresetHandler mPresets {"./presets"};   // -> WebPresetHandler via compat header

  gam::Sine<> oscL, oscR;

  // Audio -> graphics ringbuffer: stereo samples + atomic write index.
  static constexpr int RING_SIZE = 1024;
  std::array<float, RING_SIZE> ringL{}, ringR{};
  std::atomic<int> ringWrite{0};

  Mesh trace;

  void onInit() override {
    gui      << freq << detune << stereo << tint << reset;
    mPresets << freq << detune << stereo << tint << reset;
    reset.registerChangeCallback([this](float) {
      ringL.fill(0.f); ringR.fill(0.f); ringWrite.store(0);
    });
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 3.5f);
    trace.primitive(Mesh::LINE_STRIP);
  }

  void onSound(AudioIOData& io) override {
    const float fL = freq.get();
    const float fR = stereo.get() ? freq.get() + detune.get() : freq.get();
    oscL.freq(fL);
    oscR.freq(fR);
    while (io()) {
      const float l = oscL() * 0.20f;
      const float r = oscR() * 0.20f;
      io.out(0) = l;
      io.out(1) = r;
      const int w = ringWrite.load(std::memory_order_relaxed);
      ringL[w] = l;
      ringR[w] = r;
      ringWrite.store((w + 1) % RING_SIZE, std::memory_order_release);
    }
  }

  void onAnimate(double /*dt*/) override {
    const int w = ringWrite.load(std::memory_order_acquire);
    Color c = tint.get();
    trace.reset();
    trace.primitive(Mesh::LINE_STRIP);
    constexpr int N = RING_SIZE;
    for (int i = 0; i < N; ++i) {
      const int idx = (w - N + i + RING_SIZE) % RING_SIZE;
      const float t = static_cast<float>(i) / N;
      // Walk left to right across the canvas; vertical = stereo difference
      // (left+right when in stereo mode).
      const float x = -1.5f + 3.0f * t;
      const float y = ringL[idx] * 1.5f + (stereo.get() ? ringR[idx] : 0.f) * 1.5f;
      trace.vertex(x, y, 0.f);
      trace.color(c.r * t, c.g * t, c.b * t);
    }
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.04f, 0.07f);
    g.meshColor();
    g.draw(trace);
    gui.draw(g);
  }
};

ALLOLIB_WEB_MAIN(MATTemplate)
`,
  },
  {
    id: 'mat-lissajous',
    title: 'Lissajous Oscilloscope Synth',
    description:
      'Two-oscillator XY scope. Drag freqX / freqY to draw classic Lissajous figures. Per-vertex color fade from head (bright) to tail (dark) gives a CRT-trail look without an FBO ping-pong post-process chain — pure al::Mesh + al::Graphics.',
    category: 'mat-visualmusic',
    subcategory: 'image-as-sound',
    code: `/**
 * Lissajous Oscilloscope Synth — MAT200B Phase 2 #1
 *
 * Two sine oscillators feed the stereo output AND a 4096-sample
 * ringbuffer. Each frame the graphics thread snapshots the ring and
 * rebuilds an al::Mesh of LINE_STRIP vertices in (X, Y) space. Trail
 * effect via per-vertex color fade (head bright, tail dark) — no FBO
 * post-processing.
 *
 * Studio Online vanilla — no _studio_shared/ helpers. Only:
 *   al_playground_compat.hpp  (ControlGUI, parameter pipeline)
 *   gam::Sine                 (Gamma oscillators)
 *   al::Mesh + al::Graphics
 *
 * Browsers start the AudioContext suspended until first user gesture,
 * so for the first few hundred ms after Run the ring is silent. The
 * graphics path falls back to a wallclock-driven parametric Lissajous
 * so the figure shows immediately.
 *
 * Knobs:
 *   freqX / freqY   - oscillator frequencies (50..2000 Hz)
 *   amplitude       - output level (0..1)
 *   reset           - clear the ringbuffer trace
 */

#include "al_playground_compat.hpp"
#include "Gamma/Oscillator.h"

#include <array>
#include <atomic>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

using namespace al;

class Lissajous : public App {
public:
  Parameter freqX     {"freqX",     "", 220.0f, 50.0f,  2000.0f};
  Parameter freqY     {"freqY",     "", 330.0f, 50.0f,  2000.0f};
  Parameter amplitude {"amplitude", "", 0.30f,  0.0f,   1.0f};
  Trigger   reset     {"reset",     ""};

  ControlGUI gui;

  gam::Sine<> oscX, oscY;

  // Audio -> graphics ringbuffer.
  static constexpr int RING_SIZE = 4096;
  std::array<float, RING_SIZE> ringX{};
  std::array<float, RING_SIZE> ringY{};
  std::atomic<int> ringWrite{0};

  bool   audioRunning = false;
  double tWallclock = 0.0;

  Mesh trace;

  void onInit() override {
    gui << freqX << freqY << amplitude << reset;
    reset.registerChangeCallback([this](float) {
      ringX.fill(0.f);
      ringY.fill(0.f);
      ringWrite.store(0);
    });
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 3.5f);
    trace.primitive(Mesh::LINE_STRIP);
  }

  void onSound(AudioIOData& io) override {
    oscX.freq(freqX.get());
    oscY.freq(freqY.get());
    const float amp = amplitude.get();
    while (io()) {
      const float sx = oscX() * amp;
      const float sy = oscY() * amp;
      io.out(0) = sx;
      io.out(1) = sy;
      const int w = ringWrite.load(std::memory_order_relaxed);
      ringX[w] = sx;
      ringY[w] = sy;
      ringWrite.store((w + 1) % RING_SIZE, std::memory_order_release);
      audioRunning = true;
    }
  }

  void onAnimate(double dt) override {
    tWallclock += dt;
    constexpr int N = 1024;
    trace.reset();
    trace.primitive(Mesh::LINE_STRIP);
    // WebGL2 caps lineWidth at 1 px so a tiny figure disappears.
    // Visual scale here only — audio output is unchanged.
    const float visualScale = 2.5f;
    const float amp = amplitude.get();

    if (audioRunning) {
      const int w = ringWrite.load(std::memory_order_acquire);
      for (int i = 0; i < N; ++i) {
        const int idx = (w - N + i + RING_SIZE) % RING_SIZE;
        trace.vertex(ringX[idx] * visualScale, ringY[idx] * visualScale, 0.f);
        const float t = static_cast<float>(i) / N;
        trace.color(0.4f * t + 0.2f, 1.0f * t + 0.2f, 0.5f * t + 0.2f);
      }
    } else {
      // Wallclock fallback — visible on first frame after Run, before
      // the AudioContext kicks out of suspended state.
      const float fX = freqX.get();
      const float fY = freqY.get();
      const float visualPeriod = 1.0f / 4.0f;
      const double tNow = tWallclock;
      for (int i = 0; i < N; ++i) {
        const float u = static_cast<float>(i) / N * visualPeriod;
        const float sx = std::sin(2.0f * M_PI * fX * (tNow + u) * 0.001f) * amp;
        const float sy = std::sin(2.0f * M_PI * fY * (tNow + u) * 0.001f) * amp;
        trace.vertex(sx * visualScale, sy * visualScale, 0.f);
        const float t = static_cast<float>(i) / N;
        trace.color(0.4f * t + 0.2f, 1.0f * t + 0.2f, 0.5f * t + 0.2f);
      }
    }
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.04f, 0.06f);
    g.meshColor();
    g.draw(trace);
    gui.draw(g);
  }
};

ALLOLIB_WEB_MAIN(Lissajous)
`,
  },
]

// Multi-file MAT200B entries (e.g., examples that ship with auxiliary .glsl
// or extra headers). Phase 2 fills if needed.
export const mat200bMultiFileExamples: MultiFileExample[] = []
