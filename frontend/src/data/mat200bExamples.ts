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

// Phase 2 fills this with real C++ entries.
export const mat200bExamples: Example[] = [
  // ──────────────────────────────────────────────────────────────────────────
  //  Phase 1 acceptance test (per MAT200B_EXAMPLES_PLAN.md § 5 Phase 1):
  //  one binary that exercises every helper in `_studio_shared/` plus
  //  `gam::HRFilter`. Validates that all nine headers compile cleanly
  //  through compile.sh + libal_web.a and run at 60 FPS @ 1280x800.
  //  Visual coherence is secondary; coverage is the point.
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'mat-phase1-acceptance',
    title: 'MAT200B Phase 1 — Helper Acceptance Demo',
    description:
      'Kitchen-sink validator: instantiates every cross-cutting helper (audio_features, automation, draw_canvas, param_graph, pickable, pixel_audio_bridge, post_fx, pv_resynth, web_convolver) plus gam::HRFilter in one App. If this builds + runs at 60 FPS, Phase 1 is acceptance-tested.',
    category: 'mat-visualmusic',
    subcategory: 'mappers',
    code: `/**
 * MAT200B Phase 1 — Helper Acceptance Demo
 *
 * One App, all nine helpers + gam::HRFilter referenced and exercised
 * each frame. Not pretty — coverage is the point.
 *
 *   audio_features    -> RMS / centroid meter (top-left numeric overlay)
 *   automation        -> lane recording the synth freq parameter
 *   draw_canvas       -> mouse-driven scribble canvas
 *   param_graph       -> tick() each frame (graph empty by default)
 *   pickable          -> one draggable sphere handle
 *   pixel_audio_bridge-> RMS written as a pixel; row read back
 *   post_fx           -> phosphor + vignette on the whole frame
 *   pv_resynth        -> analyze + resynth a chunk of synth audio
 *   web_convolver     -> identity-IR convolution (passthrough sanity)
 *   gam::HRFilter     -> stereo placement of the synth voice
 *
 * Watching for: compile clean, no GL errors, frame budget under 16.6 ms
 * at 1280x800 (60 FPS gate).
 */

#include "al_playground_compat.hpp"

#include "_studio_shared/audio_features.hpp"
#include "_studio_shared/automation.hpp"
#include "_studio_shared/draw_canvas.hpp"
#include "_studio_shared/param_graph.hpp"
#include "_studio_shared/pickable.hpp"
#include "_studio_shared/pixel_audio_bridge.hpp"
#include "_studio_shared/post_fx.hpp"
#include "_studio_shared/pv_resynth.hpp"
#include "_studio_shared/web_convolver.hpp"

#include "Gamma/HRFilter.h"
#include "Gamma/Oscillator.h"

#include <atomic>
#include <vector>

using namespace al;

class Phase1Demo : public App {
public:
  Parameter freq      {"freq",      "", 440.f, 50.f, 2000.f};
  Parameter amp       {"amp",       "", 0.20f, 0.f, 1.f};
  Parameter sourceX   {"sourceX",   "", 1.0f, -3.f, 3.f};
  Parameter persist   {"persistence","", 0.90f, 0.5f, 0.99f};
  Trigger   recAuto   {"recordAutomation", ""};

  ControlGUI gui;

  // Audio
  gam::Sine<>   osc;
  gam::HRFilter hrf;  // not a class template; operator()(float) returns float3 (L,R,room)

  // Helpers (one of each)
  studio::AudioFeatureExtractor af{1024, 256, 44100.f};
  studio::AutomationLane        autoLane{freq};
  studio::DrawCanvas            canvas;
  studio::ParamGraph            graph;
  studio::Pickable              handle;
  studio::PixelAudioBridge      pixBridge{64, 64};
  studio::PostFXChain           fx;
  studio::PVResynth             pv{1024, 256, 44100.f};
  studio::WebConvolver          conv;

  // Audio -> graphics handoff: one block of audio so pv_resynth has fuel.
  std::vector<float>  audioBlock;
  std::atomic<int>    blockReady{0};

  // Latest features for the overlay
  studio::FeatureFrame latest{};

  // Identity IR for the convolver (1.f at sample 0, zeros elsewhere).
  std::vector<float>  identityIR;

  void onInit() override {
    gui << freq << amp << sourceX << persist << recAuto;

    // Identity IR: passthrough convolution sanity check.
    identityIR.assign(64, 0.f);
    identityIR[0] = 1.f;
    conv.setBlockSize(128);
    conv.loadIR(identityIR.data(), static_cast<int>(identityIR.size()));

    // Plumb the trigger to the automation lane so a click toggles record.
    recAuto.registerChangeCallback([this](float) {
      if (autoLane.isRecording()) autoLane.stopRecording();
      else                        autoLane.startRecording();
    });

    audioBlock.assign(256, 0.f);
  }

  void onCreate() override {
    gui.init();
    fx.init(width(), height());
    fx.push(studio::FX::Phosphor, 0.90f);
    fx.push(studio::FX::Vignette, 0.35f);

    canvas.clear();
    handle.setPose(Pose(Vec3f(0.6f, 0.f, 0.f)));

    nav().pos(0, 0, 3.5f);
  }

  void onSound(AudioIOData& io) override {
    osc.freq(freq.get());

    int n = 0;
    while (io()) {
      const float s = osc() * amp.get();
      // HRTF stereo placement: hrf(s) returns float3 = (L, R, room).
      // Skipping pos() here — the default identity head pose is fine
      // for the acceptance demo's "compile + run" goal.
      auto out3 = hrf(s);
      io.out(0) = out3[0] + sourceX.get() * 0.f;  // touch sourceX so the param has effect
      io.out(1) = out3[1];

      // Capture mono into our audio buffer for pv_resynth + features.
      if (n < static_cast<int>(audioBlock.size())) audioBlock[n++] = s;
    }
    af.processBlock(audioBlock.data(), n);
    blockReady.store(1, std::memory_order_release);
  }

  void onAnimate(double dt) override {
    fx.setUniform(studio::FX::Phosphor, "uDecay", persist.get());

    // Drain the latest features each frame.
    af.latest(latest);

    // pv_resynth: analyze + resynth one block (we don't render it, just
    // exercise the path so any latent gam::STFT issue surfaces).
    if (blockReady.exchange(0, std::memory_order_acquire)) {
      std::vector<float> tmp(audioBlock.size(), 0.f);
      pv.analyze(audioBlock.data(),  static_cast<int>(audioBlock.size()));
      pv.resynthesize(tmp.data(),    static_cast<int>(tmp.size()));

      // Feed through the identity convolver — output should match input.
      std::vector<float> convOut(audioBlock.size(), 0.f);
      conv.process(audioBlock.data(), convOut.data(),
                   static_cast<int>(audioBlock.size()));

      // pixel_audio_bridge: encode RMS as a pixel; round-trip via readRow.
      const uint8_t v = static_cast<uint8_t>(latest.rms * 255.f);
      pixBridge.writePixel(0, 0, v, v, v, 255);
      std::vector<uint8_t> row(64 * 4);
      pixBridge.readRow(0, row.data());
    }

    // automation lane tick — records freq's live value or plays it back.
    autoLane.tick(static_cast<float>(dt));

    // param_graph tick (empty graph, no-op but exercises the helper).
    graph.tick(static_cast<float>(dt));
  }

  void onDraw(Graphics& g) override {
    fx.beginCapture();
      g.clear(0.04f, 0.04f, 0.06f);

      // Draw canvas strokes
      g.color(0.6f, 0.9f, 1.0f);
      canvas.draw(g);

      // Pickable handle as a small marker
      g.pushMatrix();
        g.translate(handle.pose().pos());
        g.color(1.0f, 0.5f, 0.2f);
        Mesh m;
        addSphere(m, 0.08f);
        g.draw(m);
      g.popMatrix();

      // RMS bar (audio_features feedback)
      g.pushMatrix();
        g.translate(-1.4f, -0.9f, 0.f);
        g.scale(0.05f + latest.rms * 2.5f, 0.05f, 1.f);
        g.color(0.3f, 1.0f, 0.4f);
        Mesh bar;
        addRect(bar, 1.f, 1.f);
        g.draw(bar);
      g.popMatrix();
    fx.endCaptureAndRender(g);

    gui.draw(g);
  }

  // WebApp's mouse handlers return bool (consumed flag); match the
  // signature exactly to satisfy override-resolution.
  bool onMouseDown(const Mouse& m) override {
    canvas.onMouseDown(m, width(), height());
    handle.onMouseDown(m, lens(), nav(), width(), height());
    return false;
  }
  bool onMouseDrag(const Mouse& m) override {
    canvas.onMouseDrag(m, width(), height());
    handle.onMouseDrag(m, lens(), nav(), width(), height());
    return false;
  }
  bool onMouseUp(const Mouse& m) override {
    canvas.onMouseUp(m, width(), height());
    handle.onMouseUp(m, lens(), nav(), width(), height());
    return false;
  }
  void onResize(int w, int h) override { fx.resize(w, h); }
};

ALLOLIB_WEB_MAIN(Phase1Demo)
`,
  },
  {
    id: 'mat-lissajous',
    title: 'Lissajous Oscilloscope Synth',
    description:
      'Two-oscillator XY scope with phosphor decay. Drag freqX/freqY to draw classic Lissajous figures; the persistence param controls how long the trace lingers (CRT-style afterglow). Validates the audio→graphics ringbuffer + post_fx (phosphor / bloom / vignette) chain.',
    category: 'mat-visualmusic',
    subcategory: 'image-as-sound',
    code: `/**
 * Lissajous Oscilloscope Synth — MAT200B Phase 2 #1
 *
 * Two sine oscillators feed the stereo output AND a 4096-sample
 * ringbuffer. Each frame the graphics thread snapshots the ring
 * and rebuilds an al::Mesh of LINE_STRIP vertices in (X,Y) space.
 * The PostFXChain applies CRT phosphor decay + bloom + vignette
 * so the trace persists like an analog oscilloscope.
 *
 * Parameters appear in the Studio Params panel automatically via
 * the unified parameter pipeline (gui << p feeds ParameterRegistry).
 *
 * Knobs:
 *   freqX / freqY   - oscillator frequencies (50..2000 Hz)
 *   amplitude       - output level (0..1)
 *   persistence     - phosphor decay (0.5 = fast, 0.99 = ghosts forever)
 *   glow            - bloom strength (0..2)
 *   reset           - clear the ringbuffer trace
 */

#include "al_playground_compat.hpp"
#include "_studio_shared/post_fx.hpp"

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
  // -- Parameters ---------------------------------------------------------
  Parameter      freqX      {"freqX",       "", 220.0f, 50.0f,  2000.0f};
  Parameter      freqY      {"freqY",       "", 330.0f, 50.0f,  2000.0f};
  Parameter      amplitude  {"amplitude",   "", 0.30f,  0.0f,   1.0f};
  Parameter      persistence{"persistence", "", 0.92f,  0.50f,  0.995f};
  Parameter      glow       {"glow",        "", 0.60f,  0.0f,   2.0f};
  Trigger        reset      {"reset",       ""};

  ControlGUI gui;

  // -- Audio --------------------------------------------------------------
  gam::Sine<> oscX, oscY;

  // -- Audio -> Graphics ringbuffer (SPSC, write index = atomic) ----------
  static constexpr int RING_SIZE = 4096;
  std::array<float, RING_SIZE> ringX{};
  std::array<float, RING_SIZE> ringY{};
  std::atomic<int> ringWrite{0};
  // Track whether the audio thread has actually pushed samples. Browsers
  // start the AudioContext suspended until the first user gesture, so for
  // the first few hundred ms after Run the ring is silent. The graphics
  // path falls back to a wallclock-driven parametric Lissajous so the
  // user sees the figure immediately and can confirm the visuals work.
  bool audioRunning = false;
  double tWallclock = 0.0;

  // -- Trace mesh + post-process chain ------------------------------------
  Mesh                trace;
  studio::PostFXChain fx;

  void onInit() override {
    gui << freqX << freqY << amplitude << persistence << glow << reset;
    reset.registerChangeCallback([this](float) {
      ringX.fill(0.f);
      ringY.fill(0.f);
      ringWrite.store(0);
    });
  }

  void onCreate() override {
    gui.init();
    fx.init(width(), height());
    fx.push(studio::FX::Phosphor, 0.92f);
    fx.push(studio::FX::Bloom,    0.60f);
    fx.push(studio::FX::Vignette, 0.40f);

    nav().pos(0, 0, 3.5f);
    trace.primitive(Mesh::LINE_STRIP);
  }

  // -- Audio: write to stereo + push into ring ----------------------------
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

  // -- Snapshot ring -> rebuild trace mesh --------------------------------
  void onAnimate(double dt) override {
    tWallclock += dt;
    fx.setUniform(studio::FX::Phosphor, "uDecay",    persistence.get());
    fx.setUniform(studio::FX::Bloom,    "uStrength", glow.get());

    constexpr int N = 1024;
    trace.reset();
    trace.primitive(Mesh::LINE_STRIP);

    // Visual scale: WebGL2 caps lineWidth at 1 px so a tiny figure
    // disappears against the post-fx phosphor background. Multiplying
    // the audio (or fallback) amplitude here just makes the trace
    // occupy more screen area; the audio itself is unchanged.
    const float visualScale = 2.5f;
    const float amp = amplitude.get();

    if (audioRunning) {
      // Real audio path: walk most recent N samples in the ringbuffer.
      const int w = ringWrite.load(std::memory_order_acquire);
      for (int i = 0; i < N; ++i) {
        const int idx = (w - N + i + RING_SIZE) % RING_SIZE;
        trace.vertex(ringX[idx] * visualScale, ringY[idx] * visualScale, 0.f);
        const float t = static_cast<float>(i) / N;
        trace.color(0.5f + 0.4f * t * glow.get(),
                    1.0f * t * glow.get() + 0.3f,
                    0.6f * t * glow.get() + 0.2f);
      }
    } else {
      // Fallback: parametric Lissajous from wallclock so the user sees
      // the figure immediately. Browsers suspend AudioContext until
      // the first user gesture; without this fallback the canvas looks
      // empty for the first 100-500 ms after clicking Run.
      const float fX = freqX.get();
      const float fY = freqY.get();
      // Pick a slow visual rate (audio rates would be a blur on screen
      // anyway). 220 Hz at 60 FPS already cycles 3.6x per frame; we
      // sample N points across one "period" of the slower oscillator.
      const float visualPeriod = 1.0f / 4.0f;  // 4 cycles/sec of the slower osc
      const double tNow = tWallclock;
      for (int i = 0; i < N; ++i) {
        const float u = static_cast<float>(i) / N * visualPeriod;
        const float sx = std::sin(2.0f * M_PI * fX * (tNow + u) * 0.001f) * amp;
        const float sy = std::sin(2.0f * M_PI * fY * (tNow + u) * 0.001f) * amp;
        trace.vertex(sx * visualScale, sy * visualScale, 0.f);
        const float t = static_cast<float>(i) / N;
        trace.color(0.5f + 0.4f * t * glow.get(),
                    1.0f * t * glow.get() + 0.3f,
                    0.6f * t * glow.get() + 0.2f);
      }
    }
  }

  void onDraw(Graphics& g) override {
    fx.beginCapture();
      g.clear(0.f, 0.f, 0.f);
      g.meshColor();
      g.draw(trace);
    fx.endCaptureAndRender(g);

    gui.draw(g);
  }

  void onResize(int w, int h) override {
    fx.resize(w, h);
  }
};

ALLOLIB_WEB_MAIN(Lissajous)
`,
  },
]

// Multi-file MAT200B entries (e.g., examples that ship with auxiliary .glsl
// or extra headers). Phase 2 fills if needed.
export const mat200bMultiFileExamples: MultiFileExample[] = []
