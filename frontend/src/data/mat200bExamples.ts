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
   * snapshots the ring each frame. The five Parameters appear as a
   * 5-chip HUD across the top — one chip per Parameter type so the
   * example doubles as a "what each Parameter widget unlocks" legend.
   *
   * Five parameters cover the major al::Parameter types:
   *   freq        Parameter (float)   — one-pole smoothed for click-free drag
   *   detune      ParameterInt        — visible phase drift between L/R traces
   *   stereo      ParameterBool       — 1D scope when off, Lissajous XY when on
   *   tint        ParameterColor      — recolours both traces
   *   reset       Trigger             — ramp-to-silence on the ring
   */

  #include "al_playground_compat.hpp"
  #include "Gamma/Oscillator.h"

  #include <array>
  #include <atomic>
  #include <cmath>

  using namespace al;

  class MATTemplate : public App {
  public:
    ParameterBool  playing{"playing", "", true};
    Parameter      freq   {"freq",   "", 220.f, 50.f, 2000.f};
    ParameterInt   detune {"detune", "", 0,    -50,   50};
    ParameterBool  stereo {"stereo", "", true};
    ParameterColor tint   {"tint",   "", Color(0.4f, 0.9f, 0.5f)};
    Trigger        reset  {"reset",  ""};

    ControlGUI    gui;
    PresetHandler mPresets {"./presets"};   // -> WebPresetHandler via compat header

    gam::Sine<> oscL, oscR;

    // One-pole smoothed freq state (audio thread).
    float freqSmoothed = 220.f;
    // Ramp-to-silence gate on reset — multiplies output for ~30 ms after a reset.
    float resetGate = 1.f;

    // Audio -> graphics ringbuffer: stereo samples + atomic write index.
    static constexpr int RING_SIZE = 1024;
    std::array<float, RING_SIZE> ringL{}, ringR{};
    std::atomic<int> ringWrite{0};

    Mesh traceL, traceR, lissa, hud;

    void onInit() override {
      gui      << playing << freq << detune << stereo << tint << reset;
      mPresets << freq << detune << stereo << tint << reset;
      reset.registerChangeCallback([this](float) {
        // Ramp gate to zero — onSound walks it back up to 1.0 over ~30 ms.
        resetGate = 0.f;
      });
    }

    void onCreate() override {
      gui.init();
      nav().pos(0, 0, 4.0f);
      traceL.primitive(Mesh::LINE_STRIP);
      traceR.primitive(Mesh::LINE_STRIP);
      lissa.primitive(Mesh::LINE_STRIP);
      hud.primitive(Mesh::TRIANGLES);
    }

    void onSound(AudioIOData& io) override {
      if (!playing.get()) {
        while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
        return;
      }
      const float fTarget = freq.get();
      const int   det     = detune.get();
      const float fs      = io.framesPerSecond();
      // One-pole smoothing coefficient: ~5 ms time constant.
      const float coef     = 1.f - std::exp(-1.f / (0.005f * fs));
      // Reset-gate ramp time constant: ~30 ms.
      const float gateCoef = 1.f - std::exp(-1.f / (0.030f * fs));
      while (io()) {
        freqSmoothed += coef * (fTarget - freqSmoothed);
        resetGate    += gateCoef * (1.f - resetGate);
        oscL.freq(freqSmoothed);
        oscR.freq(freqSmoothed + static_cast<float>(det));
        const float l = oscL() * 0.20f * resetGate;
        const float r = oscR() * 0.20f * resetGate;
        io.out(0) = l;
        io.out(1) = r;
        const int w = ringWrite.load(std::memory_order_relaxed);
        ringL[w] = l;
        ringR[w] = r;
        ringWrite.store((w + 1) % RING_SIZE, std::memory_order_release);
      }
    }

    // Push a small filled rectangle into a TRIANGLES mesh (for the HUD chips).
    void pushChipBar(Mesh& m, float x0, float y0, float w, float h,
                     float r, float gC, float b) {
      const float x1 = x0 + w, y1 = y0 + h;
      m.vertex(x0, y0, 0.f); m.color(r, gC, b);
      m.vertex(x1, y0, 0.f); m.color(r, gC, b);
      m.vertex(x1, y1, 0.f); m.color(r, gC, b);
      m.vertex(x0, y0, 0.f); m.color(r, gC, b);
      m.vertex(x1, y1, 0.f); m.color(r, gC, b);
      m.vertex(x0, y1, 0.f); m.color(r, gC, b);
    }

    void onAnimate(double /*dt*/) override {
      const int w = ringWrite.load(std::memory_order_acquire);
      Color c = tint.get();
      constexpr int N = RING_SIZE;

      traceL.reset(); traceL.primitive(Mesh::LINE_STRIP);
      traceR.reset(); traceR.primitive(Mesh::LINE_STRIP);
      lissa.reset();  lissa.primitive(Mesh::LINE_STRIP);

      // detune as a *visible* phase drift: shift the R read index by 2*detune samples.
      const int phaseShift = detune.get() * 2;

      if (stereo.get()) {
        // Lissajous XY: x = L, y = R.
        for (int i = 0; i < N; ++i) {
          const int idxL = (w - N + i + RING_SIZE) % RING_SIZE;
          const int idxR = (w - N + i + phaseShift + RING_SIZE) % RING_SIZE;
          const float t = static_cast<float>(i) / N;
          const float x = ringL[idxL] * 4.0f;
          const float y = ringR[idxR] * 4.0f - 0.1f;
          lissa.vertex(x, y, 0.f);
          lissa.color(c.r * (0.3f + 0.7f * t),
                      c.g * (0.3f + 0.7f * t),
                      c.b * (0.3f + 0.7f * t));
        }
      } else {
        // Two stacked 1D scopes — top = L, bottom = R, both tinted by 'tint'.
        for (int i = 0; i < N; ++i) {
          const int idxL = (w - N + i + RING_SIZE) % RING_SIZE;
          const int idxR = (w - N + i + phaseShift + RING_SIZE) % RING_SIZE;
          const float t = static_cast<float>(i) / N;
          const float x  = -1.5f + 3.0f * t;
          const float yL =  0.45f + ringL[idxL] * 1.2f;
          const float yR = -0.45f + ringR[idxR] * 1.2f;
          traceL.vertex(x, yL, 0.f);
          traceL.color(c.r * t, c.g * t, c.b * t);
          traceR.vertex(x, yR, 0.f);
          // R tinted with channels rotated so the phase drift is obvious.
          traceR.color(c.b * t, c.r * t, c.g * t);
        }
      }

      // 5-chip Parameter-type HUD across the top.
      hud.reset();
      hud.primitive(Mesh::TRIANGLES);
      const float chipW = 0.42f, chipH = 0.10f, gap = 0.04f;
      const float row = 1.36f;
      float x = -1.5f + 0.05f;
      auto drawChip = [&](float fillFrac, float r, float gC, float b) {
        // Frame
        pushChipBar(hud, x, row, chipW, chipH, 0.10f, 0.10f, 0.14f);
        // Fill bar (clamped 0..1)
        float f = fillFrac;
        if (f < 0.f) f = 0.f;
        if (f > 1.f) f = 1.f;
        pushChipBar(hud, x + 0.01f, row + 0.012f,
                    (chipW - 0.02f) * f, chipH - 0.024f,
                    r, gC, b);
        x += chipW + gap;
      };
      // float — freq
      drawChip((freq.get() - 50.f) / (2000.f - 50.f), 0.40f, 0.85f, 1.00f);
      // int — detune (-50..50)
      drawChip((static_cast<float>(detune.get()) + 50.f) / 100.f, 1.00f, 0.70f, 0.20f);
      // bool — stereo (full bar vs empty)
      drawChip(stereo.get() ? 1.0f : 0.0f, 0.60f, 1.00f, 0.30f);
      // color — tint chip is the tint colour itself
      drawChip(1.0f, c.r, c.g, c.b);
      // trigger — reset gate (lights up during the ramp-to-silence)
      drawChip(1.0f - resetGate, 1.00f, 0.30f, 0.45f);
    }

    void onDraw(Graphics& g) override {
      g.clear(0.04f, 0.04f, 0.07f);
      g.meshColor();
      if (stereo.get()) {
        g.draw(lissa);
      } else {
        g.draw(traceL);
        g.draw(traceR);
      }
      g.draw(hud);
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
        'Two-oscillator XY scope. Drag freqX / freqY to draw classic Lissajous figures. Per-vertex color fade from head (bright) to tail (dark) gives a CRT-trail look without an FBO ping-pong post-process chain — pure al::Mesh + al::Graphics. Now with a GCD-based ratio HUD, six preset ratio triggers, neon-CRT two-pass glow, and an optional 3D yaw rotation.',
      category: 'mat-visualmusic',
      subcategory: 'image-as-sound',
    code: `/**
   * Lissajous Oscilloscope Synth — MAT200B Phase 2 #1
   *
   * Two sine oscillators feed the stereo output AND a 4096-sample
   * ringbuffer. Each frame the graphics thread snapshots the ring and
   * rebuilds an al::Mesh of LINE_STRIP vertices in (X, Y) space.
   *
   * Upgrades over the v0.12 version:
   *   - GCD ratio HUD: snaps freqX/freqY to nearest 10 Hz "small int" pair
   *     (gcd_step = 10 Hz) and reduces with a Euclidean GCD. Lights up
   *     when both reduced ints are <= 5.
   *   - Six preset ratio Trigger buttons (1:1, 1:2, 2:3, 3:4, 3:5, 4:5,
   *     golden) — each sets freqY = freqX * (b / a).
   *   - Neon-CRT two-pass glow: thick faint underlay + thin bright overlay
   *     (WebGL2 caps lineWidth at 1 px so we simulate via an offset pass).
   *   - rotate3D toggle: slow wallclock yaw on each vertex.
   *
   * Studio Online vanilla — no _studio_shared/ helpers.
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

  // Plain Euclidean GCD — std::__gcd is libstdc++-only, this is portable.
  static int gcdI(int a, int b) {
    if (a < 0) a = -a;
    if (b < 0) b = -b;
    while (b != 0) { int t = a % b; a = b; b = t; }
    return a == 0 ? 1 : a;
  }

  class Lissajous : public App {
  public:
    ParameterBool playing {"playing", "", true};
    Parameter freqX     {"freqX",     "", 220.0f, 50.0f,  2000.0f};
    Parameter freqY     {"freqY",     "", 330.0f, 50.0f,  2000.0f};
    Parameter amplitude {"amplitude", "", 0.30f,  0.0f,   1.0f};
    ParameterBool rotate3D {"rotate3D", "", false};

    // Preset ratio Triggers — onClick set freqY = freqX * (b/a).
    Trigger ratio_1_1    {"ratio_1_1",    ""};
    Trigger ratio_1_2    {"ratio_1_2",    ""};
    Trigger ratio_2_3    {"ratio_2_3",    ""};
    Trigger ratio_3_4    {"ratio_3_4",    ""};
    Trigger ratio_3_5    {"ratio_3_5",    ""};
    Trigger ratio_4_5    {"ratio_4_5",    ""};
    Trigger ratio_golden {"ratio_golden", ""};

    Trigger reset {"reset", ""};

    ControlGUI gui;

    gam::Sine<> oscX, oscY;

    // Audio -> graphics ringbuffer.
    static constexpr int RING_SIZE = 4096;
    std::array<float, RING_SIZE> ringX{};
    std::array<float, RING_SIZE> ringY{};
    std::atomic<int> ringWrite{0};

    bool   audioRunning = false;
    double tWallclock = 0.0;

    Mesh traceUnderlay, traceOverlay, hud;

    void applyRatio(float a, float b) {
      if (a <= 0.f) return;
      float fy = freqX.get() * (b / a);
      if (fy < 50.f)   fy = 50.f;
      if (fy > 2000.f) fy = 2000.f;
      freqY.set(fy);
    }

    void onInit() override {
      gui << playing << freqX << freqY << amplitude << rotate3D
          << ratio_1_1 << ratio_1_2 << ratio_2_3 << ratio_3_4
          << ratio_3_5 << ratio_4_5 << ratio_golden << reset;
      reset.registerChangeCallback([this](float) {
        ringX.fill(0.f);
        ringY.fill(0.f);
        ringWrite.store(0);
      });
      ratio_1_1.registerChangeCallback   ([this](float){ applyRatio(1.f, 1.f); });
      ratio_1_2.registerChangeCallback   ([this](float){ applyRatio(1.f, 2.f); });
      ratio_2_3.registerChangeCallback   ([this](float){ applyRatio(2.f, 3.f); });
      ratio_3_4.registerChangeCallback   ([this](float){ applyRatio(3.f, 4.f); });
      ratio_3_5.registerChangeCallback   ([this](float){ applyRatio(3.f, 5.f); });
      ratio_4_5.registerChangeCallback   ([this](float){ applyRatio(4.f, 5.f); });
      ratio_golden.registerChangeCallback([this](float){ applyRatio(1.f, 1.6180339887f); });
    }

    void onCreate() override {
      gui.init();
      nav().pos(0, 0, 4.0f);
      traceUnderlay.primitive(Mesh::LINE_STRIP);
      traceOverlay.primitive(Mesh::LINE_STRIP);
      hud.primitive(Mesh::TRIANGLES);
    }

    void onSound(AudioIOData& io) override {
      if (!playing.get()) {
        while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
        return;
      }
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

    // Build a tiny TRIANGLES bar for the HUD chips.
    void pushBar(Mesh& m, float x0, float y0, float w, float h,
                 float r, float gC, float b) {
      const float x1 = x0 + w, y1 = y0 + h;
      m.vertex(x0, y0, 0.f); m.color(r, gC, b);
      m.vertex(x1, y0, 0.f); m.color(r, gC, b);
      m.vertex(x1, y1, 0.f); m.color(r, gC, b);
      m.vertex(x0, y0, 0.f); m.color(r, gC, b);
      m.vertex(x1, y1, 0.f); m.color(r, gC, b);
      m.vertex(x0, y1, 0.f); m.color(r, gC, b);
    }

    // Render an int as a stack of small unit-bars on the HUD ("3" = 3 bars).
    void pushIntStack(Mesh& m, float x0, float y0, int n,
                      float r, float gC, float b) {
      const float bw = 0.05f, bh = 0.05f, gap = 0.012f;
      for (int i = 0; i < n; ++i) {
        pushBar(m, x0 + i * (bw + gap), y0, bw, bh, r, gC, b);
      }
    }

    void onAnimate(double dt) override {
      tWallclock += dt;
      constexpr int N = 1024;
      const float visualScale = 2.5f;
      const float amp = amplitude.get();

      // Optional 3D yaw — wallclock-driven. Rotate around vertical Y axis,
      // so only X and Z change.
      const float yaw = rotate3D.get()
          ? static_cast<float>(tWallclock) * 0.6f
          : 0.f;
      const float cy = std::cos(yaw), sy = std::sin(yaw);

      auto pushTracePass = [&](Mesh& mesh, float xOff, float yOff,
                               float br, float bg, float bb) {
        mesh.reset();
        mesh.primitive(Mesh::LINE_STRIP);
        if (audioRunning) {
          const int w = ringWrite.load(std::memory_order_acquire);
          for (int i = 0; i < N; ++i) {
            const int idx = (w - N + i + RING_SIZE) % RING_SIZE;
            float x = ringX[idx] * visualScale;
            float y = ringY[idx] * visualScale;
            float z = 0.f;
            if (rotate3D.get()) {
              z = (static_cast<float>(i) / N - 0.5f) * 1.5f;
              const float xr = cy * x + sy * z;
              const float zr = -sy * x + cy * z;
              x = xr; z = zr;
            }
            mesh.vertex(x + xOff, y + yOff, z);
            const float t = static_cast<float>(i) / N;
            mesh.color(br * t, bg * t, bb * t);
          }
        } else {
          // Wallclock fallback before AudioContext kicks out of suspended state.
          const float fX = freqX.get();
          const float fY = freqY.get();
          const float visualPeriod = 1.0f / 4.0f;
          const double tNow = tWallclock;
          for (int i = 0; i < N; ++i) {
            const float u = static_cast<float>(i) / N * visualPeriod;
            float x = std::sin(2.0f * static_cast<float>(M_PI) * fX *
                                static_cast<float>(tNow + u) * 0.001f) * amp * visualScale;
            float y = std::sin(2.0f * static_cast<float>(M_PI) * fY *
                                static_cast<float>(tNow + u) * 0.001f) * amp * visualScale;
            float z = 0.f;
            if (rotate3D.get()) {
              z = (static_cast<float>(i) / N - 0.5f) * 1.5f;
              const float xr = cy * x + sy * z;
              const float zr = -sy * x + cy * z;
              x = xr; z = zr;
            }
            mesh.vertex(x + xOff, y + yOff, z);
            const float t = static_cast<float>(i) / N;
            mesh.color(br * t, bg * t, bb * t);
          }
        }
      };

      // Two passes: faint underlay slightly offset (fakes a halo since
      // WebGL2 caps lineWidth at 1 px) + bright overlay on the line.
      pushTracePass(traceUnderlay, 0.012f, 0.012f, 0.20f, 0.30f, 0.18f);
      pushTracePass(traceOverlay,  0.0f,    0.0f,   0.55f, 1.00f, 0.65f);

      // ----- GCD ratio HUD ----------------------------------------------
      //   gcd_step = 10 Hz; aInt = round(freqX/gcd_step), bInt = round(freqY/gcd_step)
      //   reduce by gcd; light up when both reduced ints <= 5.
      hud.reset();
      hud.primitive(Mesh::TRIANGLES);
      const float gcd_step = 10.f;
      int aInt = static_cast<int>(std::round(freqX.get() / gcd_step));
      int bInt = static_cast<int>(std::round(freqY.get() / gcd_step));
      if (aInt < 1) aInt = 1;
      if (bInt < 1) bInt = 1;
      const int g = gcdI(aInt, bInt);
      const int a = aInt / g;
      const int b = bInt / g;
      const bool lit = (a <= 5 && b <= 5);
      const float litR = lit ? 1.0f : 0.40f;
      const float litG = lit ? 0.90f : 0.40f;
      const float litB = lit ? 0.50f : 0.45f;
      // Background panel for the ratio readout.
      pushBar(hud, -0.55f, 1.20f, 1.10f, 0.20f, 0.06f, 0.06f, 0.10f);
      // Render integers as bar stacks ("a : b"); colon = two small dot bars.
      const int aClamp = a > 12 ? 12 : a;
      const int bClamp = b > 12 ? 12 : b;
      pushIntStack(hud, -0.50f, 1.27f, aClamp, litR, litG, litB);
      pushBar     (hud, -0.02f, 1.31f, 0.03f, 0.03f, litR, litG, litB);
      pushBar     (hud, -0.02f, 1.25f, 0.03f, 0.03f, litR, litG, litB);
      pushIntStack(hud,  0.06f, 1.27f, bClamp, litR, litG, litB);
    }

    void onDraw(Graphics& g) override {
      g.clear(0.04f, 0.04f, 0.06f);
      g.meshColor();
      g.draw(traceUnderlay);
      g.draw(traceOverlay);
      g.draw(hud);
      gui.draw(g);
    }
  };

  ALLOLIB_WEB_MAIN(Lissajous)
  `,
    },
  {
      id: 'mat-risset',
      title: 'Risset Glissando Reconstruction',
      description:
        "Eight sine oscillators stacked an octave apart, each rising (or falling) at the same rate; a Gaussian amplitude envelope across the stack means the chord seems to shift forever without ever leaving the audible band. Visual is a polar plot where each oscillator's angle = pitch-within-octave, radius scaled by the bell envelope, plus a faint radial gradient halo and a right-edge sidebar plotting absolute Hz over time.",
      category: 'mat-synthesis',
      subcategory: 'additive',
    code: `/**
   * Risset Glissando Reconstruction — MAT200B Phase 1 #2
   *
   * Stack of N sine oscillators at one-octave spacing. Each frame all of
   * them shift by 'rate' octaves/sec (positive = up, negative = down);
   * when one passes the top of the band it wraps to the bottom an octave
   * lower. A Gaussian amplitude envelope across the stack (centred at
   * mid-band) hides the discontinuity, so the perceived pitch motion
   * never stops.
   *
   * Visual:
   *   - polar dot per oscillator (angle = octave fraction, radius = env)
   *     drawn as inline TRIANGLES fans (no addDisc helper needed)
   *   - faint radial gradient ring (TRIANGLE_STRIP donut) whose darkness
   *     follows the bell envelope as 'spread' widens or narrows
   *   - right-edge sidebar plotting each oscillator's absolute Hz (log
   *     scale) over the last 8 seconds — proof the tones really do drift
   *     up forever
   *
   * Audio:
   *   - rate is one-pole smoothed (rateSmoothed) — 'direction' Trigger
   *     simply negates the target, the smoothing crossfades through zero
   *   - normalization = amp / sumOfEnvelopes (per sample), so 'spread' no
   *     longer doubles as a master volume control
   *
   *   rate         oct/sec, signed — positive rises, negative falls
   *   amplitude    overall level
   *   spread       Gaussian width (smaller = harder bell, more obvious wrap)
   *   numTones     count of stacked oscillators (3..16)
   *   direction    Trigger — invert rate (smoothly)
   *   reset        Trigger — reset all phases to zero
   */

  #include "al_playground_compat.hpp"
  #include "Gamma/Oscillator.h"

  #include <array>
  #include <cmath>
  #include <vector>

  #ifndef M_PI
  #define M_PI 3.14159265358979323846
  #endif

  using namespace al;

  class Risset : public App {
  public:
    ParameterBool playing  {"playing",   "", true};
    Parameter     rate     {"rate",      "",  0.30f, -2.0f, 2.0f};
    Parameter     amplitude{"amplitude", "",  0.25f,  0.0f, 1.0f};
    Parameter     spread   {"spread",    "",  0.30f,  0.05f, 1.0f};
    ParameterInt  numTones {"numTones",  "",  8,      3,    16};
    Trigger       direction{"direction", ""};
    Trigger       reset    {"reset",     ""};

    ControlGUI gui;

    static constexpr int MAX_TONES = 16;
    std::vector<gam::Sine<>> oscs{MAX_TONES};
    std::array<float, MAX_TONES> logF{};   // octaves above base
    float baseHz = 110.f;

    // Audio-thread smoothed rate ('direction' flips its target sign).
    float rateSmoothed = 0.30f;

    // Sidebar history: ring of recent absolute-Hz frames per oscillator.
    static constexpr int   HIST         = 256;       // ~32 fps * 8 s
    static constexpr float HIST_SECONDS = 8.0f;
    std::array<std::array<float, MAX_TONES>, HIST> histHz{};
    int    histWrite = 0;
    double histAccum = 0.0;

    Mesh dots, halo, sidebar;

    void onInit() override {
      gui << playing << rate << amplitude << spread << numTones << direction << reset;
      reset.registerChangeCallback([this](float) {
        for (auto& v : logF) v = 0.f;
      });
      direction.registerChangeCallback([this](float) {
        // Invert the *target* rate; rateSmoothed will glide through zero.
        rate.set(-rate.get());
      });
      for (int i = 0; i < MAX_TONES; ++i) logF[i] = static_cast<float>(i);
    }

    void onCreate() override {
      gui.init();
      nav().pos(0, 0, 4.0f);
      dots.primitive(Mesh::TRIANGLES);
      halo.primitive(Mesh::TRIANGLE_STRIP);
      sidebar.primitive(Mesh::LINES);
    }

    void onSound(AudioIOData& io) override {
      if (!playing.get()) {
        while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
        return;
      }
      const int   N   = numTones.get();
      const float dt  = 1.0f / io.framesPerSecond();
      const float sp  = spread.get();
      const float amp = amplitude.get();
      const float fs  = io.framesPerSecond();
      // ~80 ms time constant on the smoothed rate so 'direction' is
      // dramatic but click-free.
      const float coef    = 1.f - std::exp(-1.f / (0.080f * fs));
      const float rTarget = rate.get();

      while (io()) {
        rateSmoothed += coef * (rTarget - rateSmoothed);
        float mix    = 0.f;
        float envSum = 0.f;
        for (int i = 0; i < N; ++i) {
          logF[i] += rateSmoothed * dt;
          while (logF[i] < 0.f)  logF[i] += static_cast<float>(N);
          while (logF[i] >= N)   logF[i] -= static_cast<float>(N);

          const float hz = baseHz * std::pow(2.0f, logF[i]);
          oscs[i].freq(hz);

          // Bell envelope on position-within-band, peak at N/2.
          const float u   = (logF[i] - 0.5f * (N - 1)) / (sp * N);
          const float env = std::exp(-u * u);
          envSum += env;
          mix    += oscs[i]() * env;
        }
        // amp / sumOfEnvelopes — keeps perceived loudness flat as 'spread'
        // changes how many oscillators fit under the bell.
        const float norm = envSum > 1e-6f ? (1.f / envSum) : 0.f;
        const float s    = mix * amp * norm;
        io.out(0) = s;
        io.out(1) = s;
      }
    }

    void onAnimate(double dt) override {
      const int   N  = numTones.get();
      const float sp = spread.get();

      // ----- dots (polar plot) ------------------------------------------
      dots.reset();
      dots.primitive(Mesh::TRIANGLES);
      for (int i = 0; i < N; ++i) {
        const float frac = logF[i] / static_cast<float>(N);
        const float u    = (logF[i] - 0.5f * (N - 1)) / (sp * N);
        const float env  = std::exp(-u * u);
        const float r    = 0.4f + 1.4f * env;
        const float ang  = frac * 2.0f * static_cast<float>(M_PI);
        const float cx   = std::cos(ang) * r;
        const float cy   = std::sin(ang) * r;
        const float cr   = 1.0f - frac;
        const float cg   = 0.4f + 0.5f * frac;
        const float cb   = 0.4f + 0.6f * frac;
        // Inline TRIANGLES fan disc — radius = 0.05 + 0.10*env, 16 segments.
        const float radius = 0.05f + 0.10f * env;
        const int   SEG    = 16;
        for (int s = 0; s < SEG; ++s) {
          const float a0 = (static_cast<float>(s)     / SEG) * 2.0f * static_cast<float>(M_PI);
          const float a1 = (static_cast<float>(s + 1) / SEG) * 2.0f * static_cast<float>(M_PI);
          // centre
          dots.vertex(cx, cy, 0.f);
          dots.color(cr * env, cg * env, cb * env);
          // outer 0
          dots.vertex(cx + std::cos(a0) * radius,
                      cy + std::sin(a0) * radius, 0.f);
          dots.color(cr * env * 0.4f, cg * env * 0.4f, cb * env * 0.4f);
          // outer 1
          dots.vertex(cx + std::cos(a1) * radius,
                      cy + std::sin(a1) * radius, 0.f);
          dots.color(cr * env * 0.4f, cg * env * 0.4f, cb * env * 0.4f);
        }
      }

      // ----- radial gradient halo (TRIANGLE_STRIP donut) -----------------
      // alpha-via-darker-color tracks the bell envelope at each angle.
      halo.reset();
      halo.primitive(Mesh::TRIANGLE_STRIP);
      const int   HSEG   = 64;
      const float innerR = 0.30f;
      const float outerR = 1.95f;
      for (int s = 0; s <= HSEG; ++s) {
        const float a   = (static_cast<float>(s) / HSEG) * 2.0f * static_cast<float>(M_PI);
        const float fr  = static_cast<float>(s) / HSEG;
        const float u   = (fr * N - 0.5f * (N - 1)) / (sp * N);
        const float env = std::exp(-u * u);
        const float dim = 0.04f + 0.20f * env;
        halo.vertex(std::cos(a) * innerR, std::sin(a) * innerR, 0.f);
        halo.color(dim * 0.6f, dim * 0.4f, dim * 1.0f);
        halo.vertex(std::cos(a) * outerR, std::sin(a) * outerR, 0.f);
        halo.color(dim * 0.05f, dim * 0.04f, dim * 0.10f);
      }

      // ----- pitch-axis sidebar (right edge) ----------------------------
      histAccum += dt;
      const double histStep = HIST_SECONDS / static_cast<double>(HIST);
      while (histAccum >= histStep) {
        histAccum -= histStep;
        for (int i = 0; i < MAX_TONES; ++i) {
          const float hz = baseHz * std::pow(2.0f, logF[i]);
          histHz[histWrite][i] = hz;
        }
        histWrite = (histWrite + 1) % HIST;
      }

      sidebar.reset();
      sidebar.primitive(Mesh::LINES);
      const float sbX0 = 1.55f, sbX1 = 1.95f;
      const float sbY0 = -1.20f, sbY1 = 1.20f;
      // Frame: four LINES forming a rectangle.
      auto frameSeg = [&](float x0, float y0, float x1, float y1) {
        sidebar.vertex(x0, y0, 0.f); sidebar.color(0.30f, 0.30f, 0.40f);
        sidebar.vertex(x1, y1, 0.f); sidebar.color(0.30f, 0.30f, 0.40f);
      };
      frameSeg(sbX0, sbY0, sbX1, sbY0);
      frameSeg(sbX1, sbY0, sbX1, sbY1);
      frameSeg(sbX1, sbY1, sbX0, sbY1);
      frameSeg(sbX0, sbY1, sbX0, sbY0);

      // For each oscillator, draw the pitch trail across HIST steps.
      // y = log2(hz / baseHz) / N, normalised into the sidebar.
      for (int i = 0; i < N; ++i) {
        const float frac = static_cast<float>(i) / static_cast<float>(N);
        const float cr   = 1.0f - frac;
        const float cg   = 0.4f + 0.5f * frac;
        const float cb   = 0.4f + 0.6f * frac;
        for (int h = 0; h < HIST - 1; ++h) {
          const int idx0 = (histWrite + h)     % HIST;
          const int idx1 = (histWrite + h + 1) % HIST;
          const float hz0 = histHz[idx0][i];
          const float hz1 = histHz[idx1][i];
          if (hz0 <= 0.f || hz1 <= 0.f) continue;
          const float l0 = std::log2(hz0 / baseHz) / static_cast<float>(N);
          const float l1 = std::log2(hz1 / baseHz) / static_cast<float>(N);
          const float t0 = static_cast<float>(h)     / (HIST - 1);
          const float t1 = static_cast<float>(h + 1) / (HIST - 1);
          const float x0 = sbX0 + (sbX1 - sbX0) * t0;
          const float x1 = sbX0 + (sbX1 - sbX0) * t1;
          const float y0 = sbY0 + (sbY1 - sbY0) * l0;
          const float y1 = sbY0 + (sbY1 - sbY0) * l1;
          sidebar.vertex(x0, y0, 0.f); sidebar.color(cr, cg, cb);
          sidebar.vertex(x1, y1, 0.f); sidebar.color(cr, cg, cb);
        }
      }
    }

    void onDraw(Graphics& g) override {
      g.clear(0.04f, 0.04f, 0.07f);
      g.meshColor();
      g.draw(halo);     // background halo first
      g.draw(dots);
      g.draw(sidebar);
      gui.draw(g);
    }
  };

  ALLOLIB_WEB_MAIN(Risset)
  `,
    },
  {
    id: 'mat-karplus-strong',
    title: 'Karplus–Strong String Lab',
    description:
      "Plucked-string physical model: short noise burst into a delay line + lowpass feedback. Pitch = sampleRate / delay length; damping is the feedback gain. Visual is the delay line itself drawn as a horizontal vertex strip — each vertex height = current sample, so you watch the standing wave develop and decay. Now with a vertical pluck-position marker (red), bridge markers at the string endpoints (white), sign-based per-vertex coloring (positive=warm red, negative=cool blue), and an inline mini-FFT panel under the string (256-pt windowed DFT) so the 1/k harmonic spacing dims top-down as 'damping' falls. Pitch changes crossfade between two delay buffers over ~10 ms to remove zipper noise; damping is clamped to 0.999 max to prevent runaway feedback.",
    category: 'mat-synthesis',
    subcategory: 'physical',
    code: `/**
   * Karplus–Strong String Lab — MAT200B Phase 1 #3
   *
   * Pitch changes crossfade between two delay buffers (bufA, bufB) over
   * ~10 ms — when 'pitch' moves, the active buffer is resampled into
   * the other buffer at the new length and a 0->1 ramp mixes them.
   * 'damping' clamped to 0.999 max. Visual: sign-based color (red+/blue-),
   * red pluck marker + white bridge markers, mini-FFT panel below.
   */

  #include "al_playground_compat.hpp"

  #include <array>
  #include <atomic>
  #include <cmath>
  #include <cstdlib>
  #include <vector>

  #ifndef M_PI
  #define M_PI 3.14159265358979323846
  #endif

  using namespace al;

  class KarplusStrong : public App {
  public:
    Parameter pitch     {"pitch",      "", 220.0f, 40.0f, 1200.0f};
    Parameter damping   {"damping",    "", 0.99f,  0.80f, 0.999f};
    Parameter pluckPos  {"pluckPos",   "", 0.50f,  0.05f, 0.95f};
    Parameter excitation{"excitation", "", 0.60f,  0.0f,  1.0f};
    Trigger   pluck     {"pluck",      ""};

    ControlGUI gui;

    static constexpr int MAX_DELAY = 4096;
    std::vector<float> bufA, bufB;
    int delayLenA = 256, delayLenB = 256;
    int writeIdxA = 0,   writeIdxB = 0;
    int activeBuf = 0;
    float crossfadePos = 1.0f;
    float crossfadeStep = 0.0f;
    int lastDelayLenForActive = 256;
    float prevSampleA = 0.f, prevSampleB = 0.f;

    std::atomic<int> pluckPending{0};
    std::atomic<int> activeBufAtomic{0};
    std::atomic<int> delayLenAAtomic{256};
    std::atomic<int> delayLenBAtomic{256};

    Mesh stringMesh, markerMesh, fftMesh, fftBaseline;

    void onInit() override {
      gui << pitch << damping << pluckPos << excitation << pluck;
      pluck.registerChangeCallback([this](float) {
        pluckPending.store(1, std::memory_order_release);
      });
    }

    void onCreate() override {
      gui.init();
      bufA.assign(MAX_DELAY, 0.f);
      bufB.assign(MAX_DELAY, 0.f);
      nav().pos(0, 0, 3.5f);
      stringMesh.primitive(Mesh::LINE_STRIP);
    }

    static void copyResample(const std::vector<float>& src, int srcLen, int srcW,
                             std::vector<float>& dst, int dstLen) {
      if (srcLen <= 0 || dstLen <= 0) return;
      for (int i = 0; i < dstLen; ++i) {
        const float u = static_cast<float>(i) / static_cast<float>(dstLen);
        int srcIdx = static_cast<int>(u * srcLen);
        if (srcIdx >= srcLen) srcIdx = srcLen - 1;
        const int s = ((srcW + srcIdx) % srcLen + srcLen) % srcLen;
        dst[i] = src[s];
      }
      for (int i = dstLen; i < MAX_DELAY; ++i) dst[i] = 0.f;
    }

    void onSound(AudioIOData& io) override {
      const float sr = io.framesPerSecond();
      const int newLen = std::max(2, std::min(MAX_DELAY,
                    static_cast<int>(sr / pitch.get())));
      const float fb = damping.get();

      if (newLen != lastDelayLenForActive && crossfadePos >= 1.0f) {
        if (activeBuf == 0) {
          copyResample(bufA, delayLenA, writeIdxA, bufB, newLen);
          delayLenB = newLen; writeIdxB = 0; prevSampleB = 0.f;
        } else {
          copyResample(bufB, delayLenB, writeIdxB, bufA, newLen);
          delayLenA = newLen; writeIdxA = 0; prevSampleA = 0.f;
        }
        crossfadePos = 0.0f;
        crossfadeStep = 1.0f / std::max(1.0f, 0.010f * sr);
        lastDelayLenForActive = newLen;
      } else if (crossfadePos >= 1.0f) {
        lastDelayLenForActive = newLen;
      }

      if (pluckPending.exchange(0, std::memory_order_acquire)) {
        auto pluckBuf = [&](std::vector<float>& buf, int& w, int len) {
          if (len <= 0) return;
          const int center = static_cast<int>(pluckPos.get() * len);
          const int wid    = std::max(8, len / 4);
          const float amp  = excitation.get();
          for (int i = 0; i < len; ++i) {
            const int dist = std::abs(i - center);
            if (dist < wid / 2) {
              const float wgt = 1.0f - (2.0f * dist / static_cast<float>(wid));
              const float n = (static_cast<float>(std::rand()) / RAND_MAX) * 2.f - 1.f;
              buf[i] = n * wgt * amp;
            } else {
              buf[i] *= 0.5f;
            }
          }
          w = 0;
        };
        pluckBuf(bufA, writeIdxA, delayLenA);
        pluckBuf(bufB, writeIdxB, delayLenB);
        prevSampleA = 0.f; prevSampleB = 0.f;
      }

      while (io()) {
        const int lenA = std::max(1, delayLenA);
        const int lenB = std::max(1, delayLenB);

        const float curA = bufA[writeIdxA];
        const float yA   = 0.5f * (curA + prevSampleA) * fb;
        prevSampleA = curA;
        bufA[writeIdxA] = yA;
        writeIdxA = (writeIdxA + 1) % lenA;

        const float curB = bufB[writeIdxB];
        const float yB   = 0.5f * (curB + prevSampleB) * fb;
        prevSampleB = curB;
        bufB[writeIdxB] = yB;
        writeIdxB = (writeIdxB + 1) % lenB;

        float out;
        if (crossfadePos < 1.0f) {
          const float oldS = (activeBuf == 0) ? yA : yB;
          const float newS = (activeBuf == 0) ? yB : yA;
          out = oldS + (newS - oldS) * crossfadePos;
          crossfadePos += crossfadeStep;
          if (crossfadePos >= 1.0f) {
            crossfadePos = 1.0f;
            activeBuf = 1 - activeBuf;
            activeBufAtomic.store(activeBuf, std::memory_order_release);
          }
        } else {
          out = (activeBuf == 0) ? yA : yB;
        }
        io.out(0) = out; io.out(1) = out;
      }

      delayLenAAtomic.store(delayLenA, std::memory_order_release);
      delayLenBAtomic.store(delayLenB, std::memory_order_release);
    }

    void computeMiniFFT(std::array<float, 128>& mag, int activeIdx) {
      constexpr int NDFT = 256;
      const std::vector<float>& src = (activeIdx == 0) ? bufA : bufB;
      const int len = (activeIdx == 0) ? delayLenAAtomic.load(std::memory_order_acquire)
                                       : delayLenBAtomic.load(std::memory_order_acquire);
      if (len <= 1) { for (auto& v : mag) v = 0.0f; return; }
      std::array<float, NDFT> x{};
      for (int i = 0; i < NDFT; ++i) {
        const int idx = (i * len) / NDFT;
        const float win = 0.5f * (1.0f - std::cos(2.0f * static_cast<float>(M_PI) * i / (NDFT - 1)));
        x[i] = src[idx] * win;
      }
      for (int k = 0; k < 128; ++k) {
        float re = 0.f, im = 0.f;
        const float ang = -2.0f * static_cast<float>(M_PI) * k / NDFT;
        for (int n = 0; n < NDFT; ++n) {
          re += x[n] * std::cos(ang * n);
          im += x[n] * std::sin(ang * n);
        }
        mag[k] = std::sqrt(re * re + im * im) * (2.0f / NDFT);
      }
    }

    void onAnimate(double /*dt*/) override {
      const int activeIdx = activeBufAtomic.load(std::memory_order_acquire);
      const std::vector<float>& srcBuf = (activeIdx == 0) ? bufA : bufB;
      const int len = (activeIdx == 0) ? delayLenAAtomic.load(std::memory_order_acquire)
                                       : delayLenBAtomic.load(std::memory_order_acquire);
      const int writeIdx = (activeIdx == 0) ? writeIdxA : writeIdxB;
      const int safeLen = std::max(1, len);

      stringMesh.reset();
      stringMesh.primitive(Mesh::LINE_STRIP);
      constexpr int N = 512;
      const int step = std::max(1, safeLen / N);
      int i = 0;
      for (int k = 0; k < safeLen && i < N; k += step, ++i) {
        const float x = -1.4f + 2.8f * (static_cast<float>(i) / N);
        const float s = srcBuf[(writeIdx + k) % safeLen];
        stringMesh.vertex(x, s * 1.5f, 0.f);
        if (s >= 0.f) {
          const float t = std::min(1.0f, s * 4.0f);
          stringMesh.color(0.85f, 0.40f - 0.20f * t, 0.30f - 0.20f * t);
        } else {
          const float t = std::min(1.0f, -s * 4.0f);
          stringMesh.color(0.30f - 0.20f * t, 0.45f - 0.20f * t, 0.95f);
        }
      }

      markerMesh.reset();
      markerMesh.primitive(Mesh::LINES);
      const float pluckX = -1.4f + 2.8f * pluckPos.get();
      markerMesh.vertex(pluckX, -1.0f, 0.f); markerMesh.color(0.95f, 0.25f, 0.25f);
      markerMesh.vertex(pluckX,  1.0f, 0.f); markerMesh.color(0.95f, 0.25f, 0.25f);
      markerMesh.vertex(-1.4f,  -1.0f, 0.f); markerMesh.color(0.95f, 0.95f, 0.95f);
      markerMesh.vertex(-1.4f,   1.0f, 0.f); markerMesh.color(0.95f, 0.95f, 0.95f);
      markerMesh.vertex( 1.4f,  -1.0f, 0.f); markerMesh.color(0.95f, 0.95f, 0.95f);
      markerMesh.vertex( 1.4f,   1.0f, 0.f); markerMesh.color(0.95f, 0.95f, 0.95f);

      std::array<float, 128> mag{};
      computeMiniFFT(mag, activeIdx);
      fftMesh.reset();
      fftMesh.primitive(Mesh::LINE_STRIP);
      const float fftYBase  = -1.45f;
      const float fftYScale = 0.40f;
      for (int k = 0; k < 128; ++k) {
        const float xx = -1.4f + 2.8f * (static_cast<float>(k) / 127.0f);
        const float yy = fftYBase + std::min(fftYScale, mag[k] * fftYScale * 4.0f);
        fftMesh.vertex(xx, yy, 0.f);
        const float t = static_cast<float>(k) / 127.0f;
        fftMesh.color(0.40f + 0.45f * t, 0.85f - 0.30f * t, 0.55f);
      }
      fftBaseline.reset();
      fftBaseline.primitive(Mesh::LINES);
      fftBaseline.vertex(-1.4f, fftYBase, 0.f); fftBaseline.color(0.30f, 0.30f, 0.35f);
      fftBaseline.vertex( 1.4f, fftYBase, 0.f); fftBaseline.color(0.30f, 0.30f, 0.35f);
    }

    void onDraw(Graphics& g) override {
      g.clear(0.04f, 0.06f, 0.06f);
      g.meshColor();
      g.draw(markerMesh);
      g.draw(stringMesh);
      g.draw(fftBaseline);
      g.draw(fftMesh);
      gui.draw(g);
    }

    static int noteFromKey(int key) {
      static const int kbd[] = {
        'Z',48,'X',50,'C',52,'V',53,'B',55,'N',57,'M',59,
        'A',60,'S',62,'D',64,'F',65,'G',67,'H',69,'J',71,
        'Q',72,'W',74,'E',76,'R',77,'T',79,'Y',81,'U',83
      };
      for (int i = 0; i < 21; ++i) {
        const int K = kbd[i*2];
        if (key == K || key == K + 32) return kbd[i*2 + 1];
      }
      return -1;
    }
    bool onKeyDown(const Keyboard& k) override {
      const int n = noteFromKey(k.key());
      if (n >= 0) {
        pitch.set(440.0f * std::pow(2.0f, (n - 69) / 12.0f));
        pluck.set(1.0f);
      }
      return true;
    }
  };

  ALLOLIB_WEB_MAIN(KarplusStrong)
  `,
  },
  {
    id: 'mat-compressor',
    title: 'Compressor Lab — Downward + Upward',
    description:
      'Dynamics processor with dB-dB transfer plot, gain-reduction meter, and before/after waveforms. Switch between downward (peak-tame) and upward (quiet-lift) compression on the same signal to see how a single threshold treats peaks vs. body. Plays bundled CC0 audio (drums / pad / mix). Soft-knee parameter smooths the elbow; threshold cross-hairs and a faint knee-tinted band make the bend region obvious; live IN / OUT / GR mini-bars sit next to the moving dot; a slowly-decaying 60-bin dB histogram at the bottom shows how compression narrows the input distribution into the output.',
    category: 'mat-signal',
    subcategory: 'dynamics',
    code: `/**
   * Compressor Lab — MAT200B Phase 1 #4 (v0.13.x upgrade)
   *
   * Plays one of three bundled CC0 loops through a one-pole envelope
   * follower + threshold/ratio/attack/release compressor. The headline
   * pedagogy is the mode toggle:
   *
   *   downward (default) — when input exceeds threshold, output is
   *     pulled toward threshold by 1/ratio of the overshoot.
   *   upward — when input falls BELOW threshold (and above the noise
   *     floor), output is BOOSTED toward threshold by ratio.
   *
   * Upgrades in this version:
   *   - knee_dB parameter (0..18) — soft knee uses a quadratic
   *     transition over a window of width knee_dB centered on the
   *     threshold. Hard knee at knee_dB = 0.
   *   - Threshold cross-hairs on the transfer plot (vertical at
   *     x = dbToX(thr), horizontal at y = dbToY(thr)) and a faint
   *     blue knee-region band so the bend is visible.
   *   - Live IN / OUT / GR value bars stacked next to the moving dot.
   *   - 60-bin slowly-decaying dB histogram (input blue / output
   *     orange) at the bottom shows the statistical effect.
   */

  #include "al_playground_compat.hpp"
  #include "al_WebSamplePlayer.hpp"

  #include <array>
  #include <atomic>
  #include <cmath>

  using namespace al;

  class CompressorLab : public App {
  public:
    ParameterMenu source     {"source",      ""};
    ParameterBool playing    {"playing",     "", true};
    ParameterBool upwardMode {"upwardMode",  "", false};
    ParameterBool autoNormalize {"auto_normalize", "", true};
    Parameter     threshold  {"threshold_dB","", -20.0f, -60.0f, 0.0f};
    Parameter     ratio      {"ratio",       "",  4.0f,   1.0f, 20.0f};
    Parameter     knee_dB    {"knee_dB",     "",  0.0f,   0.0f, 18.0f};
    Parameter     attackMs   {"attack_ms",   "",  5.0f,   0.1f, 200.0f};
    Parameter     releaseMs  {"release_ms",  "", 100.0f, 10.0f, 1000.0f};
    Parameter     makeup_dB  {"makeup_dB",   "",  0.0f,   0.0f, 24.0f};
    Trigger       retrigger  {"retrigger",   ""};

    ControlGUI gui;

    WebSamplePlayer drums, pad, mixed;
    WebSamplePlayer* current = &drums;

    // Playhead is in source-rate frames; advance by srcRate/hostRate per output sample.
    double playhead = 0.0;

    // Envelope follower state (linear).
    float envState = 0.f;

    // Auto-normalize state.
    float rmsInSq  = 1e-8f;
    float rmsOutSq = 1e-8f;
    float autoGainLin = 1.0f;

    // Audio -> graphics ringbuffers (mono before/after).
    static constexpr int RING = 1024;
    std::array<float, RING> beforeRing{};
    std::array<float, RING> afterRing{};
    std::atomic<int> ringW{0};

    // Live display values (atomically published from audio thread).
    std::atomic<float> currentInDB {-60.f};
    std::atomic<float> currentOutDB{-60.f};
    std::atomic<float> currentGRDB {  0.f};

    // dB histogram — 60 bins covering -60..0 dB, decayed each frame.
    static constexpr int HBINS = 60;
    std::array<float, HBINS> histIn{};
    std::array<float, HBINS> histOut{};
    // Block-average dB values published by audio thread.
    std::atomic<float> blockAvgInDB {-60.f};
    std::atomic<float> blockAvgOutDB{-60.f};

    Mesh transferCurve, livePoint, gridMesh, beforeWave, afterWave, grBar;
    Mesh thresholdLines, kneeBand, valueBars, histInMesh, histOutMesh;

    void onInit() override {
      source.setElements({"drums", "pad", "mixed"});
      source.set(0);

      gui << source << playing << upwardMode << autoNormalize
          << threshold << ratio << knee_dB
          << attackMs << releaseMs << makeup_dB << retrigger;

      source.registerChangeCallback([this](float v) {
        switch (static_cast<int>(v)) {
          case 0: current = &drums; break;
          case 1: current = &pad;   break;
          case 2: current = &mixed; break;
        }
        playhead = 0.0;
      });
      retrigger.registerChangeCallback([this](float) { playhead = 0.0; });
    }

    void onCreate() override {
      gui.init();
      drums.load("drum_loop_120bpm.wav");
      pad.load("pad_loop.wav");
      mixed.load("mixed_loop.wav");
      nav().pos(0, 0, 4.0f);
    }

    static float onePoleCoef(float ms, float sr) {
      return std::exp(-1.0f / (ms * 0.001f * sr));
    }

    // Soft-knee gain reduction: returns grDB given input level lvlDB,
    // threshold thrDB, ratio r, knee width kneeW (dB), and direction.
    // Below the knee region we use the existing hard-knee formula.
    static float kneeGR(float lvlDB, float thrDB, float r, float kneeW, bool upward) {
      const float oneMinusInvR = 1.0f - 1.0f / r;
      if (kneeW <= 1e-6f) {
        // Hard knee.
        if (!upward) {
          return (lvlDB > thrDB) ? -(lvlDB - thrDB) * oneMinusInvR : 0.0f;
        } else {
          return (lvlDB < thrDB) ?  (thrDB - lvlDB) * oneMinusInvR : 0.0f;
        }
      }
      const float halfK = 0.5f * kneeW;
      if (!upward) {
        // Downward
        const float diff = lvlDB - thrDB;
        if (diff <= -halfK) return 0.0f;                                 // below knee
        if (diff >=  halfK) return -(lvlDB - thrDB) * oneMinusInvR;      // above knee
        // Soft region: quadratic transition. At diff = -halfK the slope
        // is identity (gr=0); at diff = +halfK the slope is the full
        // ratio. Output is gr = -(1 - 1/r) * (diff + halfK)^2 / (2*kneeW).
        const float x = diff + halfK; // 0..kneeW
        return -oneMinusInvR * (x * x) / (2.0f * kneeW);
      } else {
        // Upward (mirror)
        const float diff = thrDB - lvlDB;
        if (diff <= -halfK) return 0.0f;
        if (diff >=  halfK) return  (thrDB - lvlDB) * oneMinusInvR;
        const float x = diff + halfK;
        return  oneMinusInvR * (x * x) / (2.0f * kneeW);
      }
    }

    void onSound(AudioIOData& io) override {
      if (!playing.get() || !current || !current->ready()) {
        while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
        return;
      }
      const float sr     = io.framesPerSecond();
      const float srcSR  = current->sampleRate() > 1.f ? current->sampleRate() : sr;
      const double rateRatio = static_cast<double>(srcSR) / static_cast<double>(sr);
      const float aA     = onePoleCoef(attackMs.get(),  sr);
      const float aR     = onePoleCoef(releaseMs.get(), sr);
      const float thrDB  = threshold.get();
      const float r      = ratio.get();
      const float kneeW  = knee_dB.get();
      const float makeupLin = std::pow(10.0f, makeup_dB.get() / 20.0f);
      const bool  upward = upwardMode.get();
      const bool  autoOn = autoNormalize.get();
      const float noiseFloorDB = -60.0f;
      const int   nFrames = current->frames();

      const float rmsCoef  = std::exp(-1.0f / (0.500f * sr));
      const float gainCoef = std::exp(-1.0f / (0.200f * sr));

      float lastInDB = -60.f, lastOutDB = -60.f, lastGRDB = 0.f;
      double sumInDB = 0.0, sumOutDB = 0.0;
      int    nAccum  = 0;

      while (io()) {
        const float in = current->readInterp(0, static_cast<float>(playhead));
        playhead += rateRatio;
        if (playhead >= nFrames) playhead -= nFrames;

        const float absIn = std::abs(in);
        const float coef  = (absIn > envState) ? aA : aR;
        envState = absIn + coef * (envState - absIn);

        const float lvlDB = (envState > 1e-6f) ? 20.f * std::log10(envState) : -120.f;

        float grDB = 0.f;
        if (!upward) {
          if (lvlDB > noiseFloorDB) grDB = kneeGR(lvlDB, thrDB, r, kneeW, false);
        } else {
          if (lvlDB < thrDB && lvlDB > noiseFloorDB)
            grDB = kneeGR(lvlDB, thrDB, r, kneeW, true);
        }

        const float gainLin = std::pow(10.0f, grDB / 20.0f) * makeupLin;
        float out = in * gainLin;

        rmsInSq  = in  * in  + rmsCoef * (rmsInSq  - in  * in);
        rmsOutSq = out * out + rmsCoef * (rmsOutSq - out * out);
        const float rIn  = std::sqrt(std::max(rmsInSq,  1e-10f));
        const float rOut = std::sqrt(std::max(rmsOutSq, 1e-10f));
        const float corrTarget = std::min(8.0f, rIn / std::max(rOut, 1e-6f));
        autoGainLin = corrTarget + gainCoef * (autoGainLin - corrTarget);
        if (autoOn) out *= autoGainLin;

        io.out(0) = out;
        io.out(1) = out;

        const int w = ringW.load(std::memory_order_relaxed);
        beforeRing[w] = in;
        afterRing[w]  = out;
        ringW.store((w + 1) % RING, std::memory_order_release);

        lastInDB  = lvlDB;
        lastOutDB = lvlDB + grDB + makeup_dB.get()
                  + (autoOn ? 20.0f * std::log10(std::max(autoGainLin, 1e-6f)) : 0.0f);
        lastGRDB  = grDB;
        sumInDB  += lastInDB;
        sumOutDB += lastOutDB;
        ++nAccum;
      }

      currentInDB.store(lastInDB,  std::memory_order_release);
      currentOutDB.store(lastOutDB,std::memory_order_release);
      currentGRDB.store(lastGRDB,  std::memory_order_release);

      if (nAccum > 0) {
        blockAvgInDB.store(static_cast<float>(sumInDB / nAccum),
                           std::memory_order_release);
        blockAvgOutDB.store(static_cast<float>(sumOutDB / nAccum),
                            std::memory_order_release);
      }
    }

    // Map an input dB value to screen X / Y on the transfer plot.
    static float dbToX(float db) { return -1.4f + (db + 60.0f) / 60.0f * 2.8f; }
    static float dbToY(float db) { return  0.2f + (db + 60.0f) / 60.0f * 1.8f; }

    // Inline disc emitter — TRIANGLES fan centred at (cx, cy).
    static void emitDisc(Mesh& m, float cx, float cy, float radius, int segs,
                         float r, float gC, float b) {
      for (int i = 0; i < segs; ++i) {
        const float a0 = 2.0f * static_cast<float>(M_PI) * i       / segs;
        const float a1 = 2.0f * static_cast<float>(M_PI) * (i + 1) / segs;
        m.vertex(cx, cy, 0.f);
        m.vertex(cx + radius * std::cos(a0), cy + radius * std::sin(a0), 0.f);
        m.vertex(cx + radius * std::cos(a1), cy + radius * std::sin(a1), 0.f);
        m.color(r, gC, b); m.color(r, gC, b); m.color(r, gC, b);
      }
    }

    static void emitRect(Mesh& m, float x0, float y0, float x1, float y1,
                         float r, float gC, float b) {
      // Two triangles forming a rect.
      m.vertex(x0, y0, 0.f); m.vertex(x1, y0, 0.f); m.vertex(x1, y1, 0.f);
      m.vertex(x0, y0, 0.f); m.vertex(x1, y1, 0.f); m.vertex(x0, y1, 0.f);
      for (int k = 0; k < 6; ++k) m.color(r, gC, b);
    }

    void onAnimate(double /*dt*/) override {
      const float thrDB  = threshold.get();
      const float r      = ratio.get();
      const float kneeW  = knee_dB.get();
      const float makeup = makeup_dB.get();
      const bool  upward = upwardMode.get();

      // Knee-region tinted band on the transfer plot.
      kneeBand.reset();
      kneeBand.primitive(Mesh::TRIANGLE_STRIP);
      if (kneeW > 1e-6f) {
        const float xL = dbToX(thrDB - 0.5f * kneeW);
        const float xR = dbToX(thrDB + 0.5f * kneeW);
        const float yT = dbToY(0.0f);
        const float yB = dbToY(-60.0f);
        const float br = 0.18f, bg = 0.30f, bb = 0.55f;
        kneeBand.vertex(xL, yB, 0.f); kneeBand.color(br, bg, bb);
        kneeBand.vertex(xR, yB, 0.f); kneeBand.color(br, bg, bb);
        kneeBand.vertex(xL, yT, 0.f); kneeBand.color(br, bg, bb);
        kneeBand.vertex(xR, yT, 0.f); kneeBand.color(br, bg, bb);
      }

      // Threshold cross-hairs (vertical + horizontal pale grey).
      thresholdLines.reset();
      thresholdLines.primitive(Mesh::LINES);
      {
        const float gx = 0.55f, gy = 0.55f, gb = 0.62f;
        // vertical at x = dbToX(thrDB)
        thresholdLines.vertex(dbToX(thrDB), dbToY(-60.f), 0.f);
        thresholdLines.vertex(dbToX(thrDB), dbToY(0.f),   0.f);
        // horizontal at y = dbToY(thrDB)
        thresholdLines.vertex(dbToX(-60.f), dbToY(thrDB), 0.f);
        thresholdLines.vertex(dbToX(0.f),   dbToY(thrDB), 0.f);
        for (int k = 0; k < 4; ++k) thresholdLines.color(gx, gy, gb);
      }

      // Transfer curve: 240 points from -60 to 0 dB input.
      transferCurve.reset();
      transferCurve.primitive(Mesh::LINE_STRIP);
      constexpr int N = 240;
      for (int i = 0; i < N; ++i) {
        const float inDB = -60.0f + (60.0f * i) / (N - 1);
        const float gr   = kneeGR(inDB, thrDB, r, kneeW, upward);
        const float outDB = inDB + gr + makeup;
        transferCurve.vertex(dbToX(inDB), dbToY(outDB), 0.f);
        transferCurve.color(upward ? 0.5f : 0.4f,
                            upward ? 0.7f : 0.9f,
                            upward ? 1.0f : 0.5f);
      }

      // Reference identity grid.
      gridMesh.reset();
      gridMesh.primitive(Mesh::LINES);
      for (int dB = -60; dB <= 0; dB += 10) {
        gridMesh.vertex(dbToX(dB),     dbToY(-60.f), 0.f);
        gridMesh.vertex(dbToX(dB),     dbToY(0.f),   0.f);
        gridMesh.vertex(dbToX(-60.f),  dbToY(dB),    0.f);
        gridMesh.vertex(dbToX(0.f),    dbToY(dB),    0.f);
        const float c = 0.18f;
        for (int k = 0; k < 4; ++k) gridMesh.color(c, c, c);
      }
      gridMesh.vertex(dbToX(-60.f), dbToY(-60.f), 0.f);
      gridMesh.vertex(dbToX(0.f),   dbToY(0.f),   0.f);
      gridMesh.color(0.3f, 0.3f, 0.3f);
      gridMesh.color(0.3f, 0.3f, 0.3f);

      // Live point on the curve.
      livePoint.reset();
      livePoint.primitive(Mesh::TRIANGLES);
      const float pInDB  = currentInDB.load();
      const float pOutDB = currentOutDB.load();
      const float pGRDB  = currentGRDB.load();
      const float px = dbToX(pInDB);
      const float py = dbToY(pOutDB);
      emitDisc(livePoint, px, py, 0.04f, 16, 1.0f, 0.85f, 0.2f);

      // Value bars stacked in a row to the right of the dot:
      //   IN  (blue)  width prop to (inDB + 60)/60 in [0, 1]
      //   OUT (green) width prop to (outDB + 60)/60
      //   GR  (red)   width prop to |grDB| / 24
      // Each bar is 0.10 wide x 0.04 tall; row of three to right of dot.
      valueBars.reset();
      valueBars.primitive(Mesh::TRIANGLES);
      {
        auto clamp01 = [](float v) { return v < 0.f ? 0.f : (v > 1.f ? 1.f : v); };
        const float bw = 0.10f, bh = 0.04f, gap = 0.012f;
        const float bx0 = px + 0.06f;
        const float by0 = py - bh * 0.5f;
        const float vIn  = clamp01((pInDB  + 60.0f) / 60.0f);
        const float vOut = clamp01((pOutDB + 60.0f) / 60.0f);
        const float vGR  = clamp01(std::abs(pGRDB) / 24.0f);
        // Track outlines (faint).
        emitRect(valueBars, bx0,                           by0, bx0 + bw,                       by0 + bh, 0.10f, 0.10f, 0.14f);
        emitRect(valueBars, bx0 + bw + gap,                by0, bx0 + bw + gap + bw,            by0 + bh, 0.10f, 0.10f, 0.14f);
        emitRect(valueBars, bx0 + 2.f * (bw + gap),        by0, bx0 + 2.f * (bw + gap) + bw,    by0 + bh, 0.10f, 0.10f, 0.14f);
        // Filled portions (IN blue, OUT green, GR red).
        emitRect(valueBars, bx0,                           by0, bx0 + bw * vIn,                 by0 + bh, 0.30f, 0.55f, 0.95f);
        emitRect(valueBars, bx0 + bw + gap,                by0, bx0 + bw + gap + bw * vOut,     by0 + bh, 0.30f, 0.85f, 0.45f);
        emitRect(valueBars, bx0 + 2.f * (bw + gap),        by0, bx0 + 2.f * (bw + gap) + bw * vGR, by0 + bh, 0.95f, 0.35f, 0.30f);
      }

      // Before / after waveforms (below the transfer plot).
      const int w = ringW.load(std::memory_order_acquire);
      beforeWave.reset(); afterWave.reset();
      beforeWave.primitive(Mesh::LINE_STRIP);
      afterWave.primitive(Mesh::LINE_STRIP);
      constexpr int W = 512;
      for (int i = 0; i < W; ++i) {
        const int idx = (w - W + i + RING) % RING;
        const float xx = -1.4f + (static_cast<float>(i) / W) * 2.8f;
        beforeWave.vertex(xx, beforeRing[idx] * 0.18f - 1.20f, 0.f);
        beforeWave.color(0.4f, 0.6f, 0.9f);
        afterWave.vertex (xx, afterRing[idx]  * 0.18f - 1.65f, 0.f);
        afterWave.color (0.95f, 0.55f, 0.3f);
      }

      // GR meter on the right edge.
      grBar.reset();
      grBar.primitive(Mesh::TRIANGLES);
      const float grAbs = std::min(24.f, std::abs(currentGRDB.load()));
      const float h     = grAbs / 24.0f * 1.8f;
      const float x0    = 1.55f, x1 = 1.70f, y0 = 0.2f, y1 = 0.2f + h;
      grBar.vertex(x0, y0, 0.f); grBar.vertex(x1, y0, 0.f); grBar.vertex(x1, y1, 0.f);
      grBar.vertex(x0, y0, 0.f); grBar.vertex(x1, y1, 0.f); grBar.vertex(x0, y1, 0.f);
      const float grR = upward ? 0.4f : 1.0f;
      const float grG = upward ? 0.85f : 0.55f;
      const float grB = upward ? 1.0f : 0.4f;
      for (int k = 0; k < 6; ++k) grBar.color(grR, grG, grB);

      // Histograms: decay each bin, accumulate the block averages.
      for (int i = 0; i < HBINS; ++i) {
        histIn[i]  *= 0.99f;
        histOut[i] *= 0.99f;
      }
      auto bumpBin = [&](std::array<float, HBINS>& h, float dB) {
        // Map -60..0 dB to bin 0..HBINS-1. Skip out-of-range / silence.
        if (dB <= -60.f || dB > 0.f) return;
        int bin = static_cast<int>((dB + 60.0f) / 60.0f * (HBINS - 1));
        if (bin < 0) bin = 0;
        if (bin >= HBINS) bin = HBINS - 1;
        h[bin] += 1.0f;
      };
      bumpBin(histIn,  blockAvgInDB.load(std::memory_order_acquire));
      bumpBin(histOut, blockAvgOutDB.load(std::memory_order_acquire));

      // Find a per-frame peak so the strip auto-scales.
      float histMax = 1e-3f;
      for (int i = 0; i < HBINS; ++i) {
        if (histIn[i]  > histMax) histMax = histIn[i];
        if (histOut[i] > histMax) histMax = histOut[i];
      }
      const float histY0 = -1.95f;
      const float histH  = 0.20f;
      histInMesh.reset();
      histInMesh.primitive(Mesh::LINE_STRIP);
      histOutMesh.reset();
      histOutMesh.primitive(Mesh::LINE_STRIP);
      for (int i = 0; i < HBINS; ++i) {
        const float xx = dbToX(-60.0f + (60.0f * i) / (HBINS - 1));
        const float yIn  = histY0 + (histIn[i]  / histMax) * histH;
        const float yOut = histY0 + (histOut[i] / histMax) * histH;
        histInMesh.vertex(xx, yIn, 0.f);
        histInMesh.color(0.40f, 0.65f, 0.95f);
        histOutMesh.vertex(xx, yOut, 0.f);
        histOutMesh.color(0.95f, 0.60f, 0.30f);
      }
    }

    void onDraw(Graphics& g) override {
      g.clear(0.05f, 0.05f, 0.08f);
      g.meshColor();
      g.draw(kneeBand);
      g.draw(gridMesh);
      g.draw(thresholdLines);
      g.draw(transferCurve);
      g.draw(livePoint);
      g.draw(valueBars);
      g.draw(beforeWave);
      g.draw(afterWave);
      g.draw(grBar);
      g.draw(histInMesh);
      g.draw(histOutMesh);
      gui.draw(g);
    }

    bool onMouseDown(const Mouse& /*m*/) override { return false; }
    bool onMouseDrag(const Mouse& /*m*/) override { return false; }
    bool onMouseUp  (const Mouse& /*m*/) override { return false; }
  };

  ALLOLIB_WEB_MAIN(CompressorLab)
  `,
  },
  {
    id: 'mat-amrm',
    title: 'AM / RM Sideband Visualizer',
    description:
      "Amplitude modulation vs. ring modulation, side by side. Two oscillators (carrier + modulator); the 'mode' switch picks AM (output = (1 + modDepth*mod) * carrier) or RM (output = mod * carrier). Spectrum view shows the sidebands appear at carrier±modulator (and the carrier-itself peak in AM mode, which RM removes); thin vertical markers show the THEORETICAL peak positions so it's obvious which sideband is which. Time-domain view below shows the resulting waveform. A small Lissajous panel in the top-right plots (carrier, modulator) so AM's envelope-hugging bowtie and RM's balanced figure-8 are visible at a glance. Toggling RM briefly draws a red X through the carrier-frequency marker — visual punch on the change.",
    category: 'mat-synthesis',
    subcategory: 'modulation',
    code: `/**
   * AM/RM Sideband Visualizer — MAT200B Phase 2
   *
   * Two oscillators:
   *   carrier   gam::Sine at 'carrier_hz'
   *   modulator gam::Sine at 'mod_hz'
   *
   * Mode toggle:
   *   AM (false)  out = (1 + depth * mod) * carrier
   *               -> sidebands at carrier ± mod, plus the carrier itself
   *   RM (true)   out = mod * carrier
   *               -> sidebands at carrier ± mod, NO carrier peak (it's
   *                  cancelled by the multiplication when mod is bipolar)
   *
   * Visual: top half = magnitude spectrum drawn from a small inline DFT
   * of the recent audio block (256-point Hann-windowed), with thin
   * theoretical-peak markers overlaid. Bottom half = the raw waveform.
   * Top-right = a Lissajous panel plotting (carrier, modulator) so the
   * AM bowtie / RM figure-8 distinction is visible at a glance. A
   * one-pole magnitude smoother sharpens the peaks across frames; a
   * frame-counter "X" briefly crosses the carrier marker on every RM
   * toggle so the change has visual punch.
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

  class AmRmViz : public App {
  public:
  ParameterBool playing    {"playing",    "", true};
  Parameter     carrier_hz {"carrier_hz", "", 440.0f, 50.0f, 4000.0f};
  Parameter     mod_hz     {"mod_hz",     "",  80.0f,  1.0f, 2000.0f};
  Parameter     depth      {"depth",      "",   0.8f,  0.0f, 1.0f};
  Parameter     amp        {"amplitude",  "",   0.25f, 0.0f, 1.0f};
  ParameterBool ringMod    {"ringMod",    "", false};

  ControlGUI gui;

  gam::Sine<> carrier, modulator;

  // Recent audio block (mono mix) for the inline DFT and waveform.
  static constexpr int N = 256;
  std::array<float, N> blockBuf{};
  // Carrier-only and modulator-only ring buffers, used for the
  // Lissajous plot (carrier vs. modulator without the modulation math
  // on top).
  std::array<float, N> carrierBuf{};
  std::array<float, N> modBuf{};
  std::atomic<int> blockW{0};

  // One-pole smoothed magnitude spectrum, persisted across frames.
  std::array<float, N / 2> magSmooth{};

  // Audio-thread published sample rate.
  std::atomic<float> sampleRateHz{48000.0f};

  // RM toggle countdown — set to ~30 frames each time the toggle flips
  // so the X-through-carrier marker fades back out after about half a
  // second at 60 FPS.
  bool prevRingMod = false;
  int  toggleFlash = 0;

  Mesh spectrum, waveform, gridMesh, markers, lissajous, toggleFx;

  void onInit() override {
    gui << playing << carrier_hz << mod_hz << depth << amp << ringMod;
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
    for (auto& v : magSmooth) v = 0.0f;
  }

  void onSound(AudioIOData& io) override {
    sampleRateHz.store(static_cast<float>(io.framesPerSecond()),
                       std::memory_order_relaxed);
    if (!playing.get()) {
      while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
      return;
    }
    carrier.freq(carrier_hz.get());
    modulator.freq(mod_hz.get());
    const float d   = depth.get();
    const float a   = amp.get();
    const bool  rm  = ringMod.get();
    while (io()) {
      const float c = carrier();
      const float m = modulator();
      const float s = (rm ? (c * m) : ((1.0f + d * m) * c)) * a;
      io.out(0) = s;
      io.out(1) = s;
      const int w = blockW.load(std::memory_order_relaxed);
      blockBuf[w]   = s;
      carrierBuf[w] = c;
      modBuf[w]     = m;
      blockW.store((w + 1) % N, std::memory_order_release);
    }
  }

  // Tiny non-FFT magnitude DFT — N=256 = 32k mults, runs once per frame.
  void computeSpectrum(std::array<float, N / 2>& mag) {
    const int w = blockW.load(std::memory_order_acquire);
    std::array<float, N> x{};
    for (int i = 0; i < N; ++i) {
      const int idx = (w + i) % N;
      const float win = 0.5f * (1.0f - std::cos(2.0f * static_cast<float>(M_PI) * i / (N - 1)));
      x[i] = blockBuf[idx] * win;
    }
    for (int k = 0; k < N / 2; ++k) {
      float re = 0.f, im = 0.f;
      const float ang = -2.0f * static_cast<float>(M_PI) * k / N;
      for (int n = 0; n < N; ++n) {
        re += x[n] * std::cos(ang * n);
        im += x[n] * std::sin(ang * n);
      }
      mag[k] = std::sqrt(re * re + im * im) * (2.0f / N);
    }
  }

  // Map a frequency in Hz to the spectrum panel x coordinate. The
  // existing spectrum draws bin k = 0..N/2-1 across [-1.4, 1.4]; bin k
  // corresponds to frequency k * sr / N, so the panel covers
  // [0, sr/2 * (N/2 - 1)/(N/2)] ~= [0, Nyquist].
  float freqToX(float hz) const {
    const float sr = sampleRateHz.load(std::memory_order_relaxed);
    if (sr <= 0.0f) return -1.4f;
    const float bin = hz * float(N) / sr;       // continuous bin index
    const float u   = bin / float(N / 2 - 1);   // 0..1
    if (u < 0.0f) return -1.4f;
    if (u > 1.0f) return  1.4f;
    return -1.4f + u * 2.8f;
  }

  static void emitRect(Mesh& m, float x0, float y0, float x1, float y1,
                       float r, float g, float b) {
    // TRIANGLE_STRIP-friendly winding: 4 vertices in (x0,y0),(x1,y0),
    // (x0,y1),(x1,y1) order.
    m.vertex(x0, y0, 0.f); m.color(r, g, b);
    m.vertex(x1, y0, 0.f); m.color(r, g, b);
    m.vertex(x0, y1, 0.f); m.color(r, g, b);
    m.vertex(x1, y1, 0.f); m.color(r, g, b);
  }

  void onAnimate(double /*dt*/) override {
    // Detect RM toggle and arm the X-flash countdown.
    const bool rmNow = ringMod.get();
    if (rmNow != prevRingMod) toggleFlash = 30;
    prevRingMod = rmNow;
    if (toggleFlash > 0) --toggleFlash;

    std::array<float, N / 2> mag{};
    computeSpectrum(mag);
    // One-pole magnitude smoothing — sharper, less jittery peaks.
    for (int k = 0; k < N / 2; ++k) {
      magSmooth[k] = 0.5f * mag[k] + 0.5f * magSmooth[k];
    }

    // Theoretical-peak markers FIRST so the live spectrum draws on top.
    markers.reset();
    markers.primitive(Mesh::TRIANGLE_STRIP);
    const float fc = carrier_hz.get();
    const float fm = mod_hz.get();
    auto markerBar = [&](float hz, float r, float g, float b) {
      // Each marker is its own quad with a degenerate triangle separating
      // it from the next so a single TRIANGLE_STRIP draw stays correct.
      const float x = freqToX(hz);
      const float w = 0.006f;
      // Repeat the first vertex to start the new strip cleanly.
      markers.vertex(x - w, 0.20f, 0.f); markers.color(r, g, b);
      markers.vertex(x - w, 0.20f, 0.f); markers.color(r, g, b);
      markers.vertex(x + w, 0.20f, 0.f); markers.color(r, g, b);
      markers.vertex(x - w, 1.70f, 0.f); markers.color(r, g, b);
      markers.vertex(x + w, 1.70f, 0.f); markers.color(r, g, b);
      // Close the strip with a degenerate so the next marker doesn't
      // smear into this one.
      markers.vertex(x + w, 1.70f, 0.f); markers.color(r, g, b);
    };
    if (rmNow) {
      // RM: only sidebands, NO carrier line.
      markerBar(fc - fm, 0.55f, 0.40f, 0.95f);
      markerBar(fc + fm, 0.55f, 0.40f, 0.95f);
    } else {
      // AM: sidebands + carrier-itself.
      markerBar(fc - fm, 0.40f, 0.85f, 0.55f);
      markerBar(fc,      0.95f, 0.80f, 0.30f);
      markerBar(fc + fm, 0.40f, 0.85f, 0.55f);
    }

    spectrum.reset();
    spectrum.primitive(Mesh::LINE_STRIP);
    for (int k = 0; k < N / 2; ++k) {
      const float xx = -1.4f + (static_cast<float>(k) / (N / 2 - 1)) * 2.8f;
      const float yy = 0.2f + std::min(1.5f, magSmooth[k] * 6.0f);
      spectrum.vertex(xx, yy, 0.f);
      const float t = static_cast<float>(k) / (N / 2);
      spectrum.color(0.4f + 0.5f * t, 0.9f - 0.4f * t, 0.5f);
    }

    waveform.reset();
    waveform.primitive(Mesh::LINE_STRIP);
    const int w = blockW.load(std::memory_order_acquire);
    for (int i = 0; i < N; ++i) {
      const int idx = (w + i) % N;
      const float xx = -1.4f + (static_cast<float>(i) / (N - 1)) * 2.8f;
      const float yy = -0.9f + blockBuf[idx] * 0.6f;
      waveform.vertex(xx, yy, 0.f);
      waveform.color(0.95f, 0.65f, 0.35f);
    }

    // Lissajous panel — top-right, plotting (carrier, modulator) over
    // the most recent N samples as a fading LINE_STRIP. Center at
    // (1.05, 1.10), half-extent 0.30.
    const float lx = 1.05f, ly = 1.10f, lr = 0.30f;
    lissajous.reset();
    lissajous.primitive(Mesh::LINE_STRIP);
    for (int i = 0; i < N; ++i) {
      const int idx = (w + i) % N;
      float cx = carrierBuf[idx];
      float my = modBuf[idx];
      if (cx < -1.f) cx = -1.f; else if (cx > 1.f) cx = 1.f;
      if (my < -1.f) my = -1.f; else if (my > 1.f) my = 1.f;
      const float xx = lx + cx * lr;
      const float yy = ly + my * lr;
      // Fade from dim (oldest) to bright (newest) for a trail effect.
      const float a = static_cast<float>(i) / static_cast<float>(N - 1);
      const float r = 0.30f + 0.65f * a;
      const float gC = 0.55f + 0.40f * a;
      const float bb = 0.95f - 0.10f * a;
      lissajous.vertex(xx, yy, 0.f);
      lissajous.color(r, gC, bb);
    }

    // Reference baselines + Lissajous frame.
    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    gridMesh.vertex(-1.4f, 0.2f, 0.f); gridMesh.vertex(1.4f, 0.2f, 0.f);
    gridMesh.vertex(-1.4f,-0.9f, 0.f); gridMesh.vertex(1.4f,-0.9f, 0.f);
    for (int k = 0; k < 4; ++k) gridMesh.color(0.25f, 0.25f, 0.25f);
    // Lissajous box and crosshairs.
    auto pushLine = [&](float x0, float y0, float x1, float y1,
                        float r, float gc, float b) {
      gridMesh.vertex(x0, y0, 0.f); gridMesh.color(r, gc, b);
      gridMesh.vertex(x1, y1, 0.f); gridMesh.color(r, gc, b);
    };
    pushLine(lx - lr, ly - lr, lx + lr, ly - lr, 0.30f, 0.32f, 0.38f);
    pushLine(lx + lr, ly - lr, lx + lr, ly + lr, 0.30f, 0.32f, 0.38f);
    pushLine(lx + lr, ly + lr, lx - lr, ly + lr, 0.30f, 0.32f, 0.38f);
    pushLine(lx - lr, ly + lr, lx - lr, ly - lr, 0.30f, 0.32f, 0.38f);
    pushLine(lx - lr, ly,       lx + lr, ly,       0.22f, 0.24f, 0.30f);
    pushLine(lx,       ly - lr, lx,       ly + lr, 0.22f, 0.24f, 0.30f);

    // Mode-toggle X at the carrier marker (decays with toggleFlash).
    toggleFx.reset();
    toggleFx.primitive(Mesh::LINES);
    if (toggleFlash > 0) {
      const float a = static_cast<float>(toggleFlash) / 30.0f;
      const float r = 0.95f, gc = 0.20f, b = 0.20f;
      const float cx = freqToX(fc);
      const float dx = 0.045f, dy = 0.18f;
      // Down-right diagonal.
      toggleFx.vertex(cx - dx, 1.55f, 0.f); toggleFx.color(r * a, gc * a, b * a);
      toggleFx.vertex(cx + dx, 1.55f - dy, 0.f); toggleFx.color(r * a, gc * a, b * a);
      // Down-left diagonal.
      toggleFx.vertex(cx + dx, 1.55f, 0.f); toggleFx.color(r * a, gc * a, b * a);
      toggleFx.vertex(cx - dx, 1.55f - dy, 0.f); toggleFx.color(r * a, gc * a, b * a);
    }
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.05f, 0.07f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(markers);
    g.draw(spectrum);
    g.draw(waveform);
    g.draw(lissajous);
    g.draw(toggleFx);
    gui.draw(g);
  }
  };

  ALLOLIB_WEB_MAIN(AmRmViz)
  `,
  },
  {
    id: 'mat-fm-index',
    title: 'FM Index Explorer',
    description:
      "Phase-modulation FM (Chowning style): output = sin(2π·fc·t + index·sin(2π·fm·t)). The 'index' knob smoothly grows the sideband structure. Three coupled views: (1) live magnitude spectrum overlaid with analytic Bessel-J amplitude predictions |J_k(index)| at fc±k·fm so you can SEE the textbook prediction land on top of the measured FFT; (2) time-domain output trace; (3) a phase-modulator circle in the top-right corner — a moving disc on the unit circle traces (cos(phase + index·sin(modPhase)), sin(...)) with a 256-frame fading trail so you watch the carrier's instantaneous phase wobble. A c:m-ratio menu picks classic ratios (1:1, 1:2, 2:3, 1:√2) or 'free'; a one-pole 30 ms slew on 'index' kills slider-drag scratch.",
    category: 'mat-synthesis',
    subcategory: 'modulation',
    code: `/**
   * FM Index Explorer — MAT200B Phase 2
   *
   * Single-operator FM (technically PM, the way Chowning meant it).
   *
   *   y(t) = amp * sin(2pi*fc*t + index * sin(2pi*fm*t))
   *
   * Sideband structure follows Bessel functions of the first kind J_k
   * evaluated at the modulation index — partials at fc + k*fm for all
   * integer k with amplitudes |J_k(index)|. We OVERLAY analytic
   * |J_k(index)| for k=0..8 (mirrored to negative k as well) on top of
   * the measured FFT magnitude so the textbook prediction lines up
   * with the measured spectrum in real time.
   *
   * Top-right corner: a phase-modulator circle. A moving disc traces
   * (cos(phase + index*sin(modPhase)), sin(phase + index*sin(modPhase)))
   * on the unit circle; the last 256 phase positions trail behind as a
   * fading LINE_STRIP. This makes the "phase modulation" visible.
   *
   * c:m ratio menu picks classic carrier/modulator ratios. A one-pole
   * 30 ms slew on 'index' kills slider-drag scratch.
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

  class FmIndex : public App {
  public:
    ParameterBool playing {"playing", "", true};
    ParameterMenu c_to_m_ratio {"c_to_m_ratio", ""};
    Parameter carrier_hz {"carrier_hz", "", 220.0f,  50.0f, 2000.0f};
    Parameter mod_hz     {"mod_hz",     "", 220.0f,   1.0f, 2000.0f};
    Parameter index      {"index",      "",   1.0f,   0.0f, 8.0f};
    Parameter amp        {"amplitude",  "",  0.25f,   0.0f, 1.0f};

    ControlGUI gui;

    gam::Sine<> mod;
    // Carrier phase tracked manually so we can add the modulator output.
    double carrierPhase = 0.0;
    double modPhase     = 0.0;

    // One-pole slew on index, ~30 ms.
    float indexSmoothed = 1.0f;

    static constexpr int N = 256;
    std::array<float, N> blockBuf{};
    std::atomic<int> blockW{0};

    // Phase trail for the modulator-circle viz.
    static constexpr int TRAIL_N = 256;
    std::array<float, TRAIL_N> trailX{};
    std::array<float, TRAIL_N> trailY{};
    std::atomic<int> trailW{0};
    // Latest phase + index snapshot for the dot.
    std::atomic<float> lastCarrierPhase{0.f};
    std::atomic<float> lastModPhase{0.f};
    std::atomic<float> lastIndex{1.f};

    Mesh spectrum, waveform, gridMesh, bessel, circleMesh, dotMesh, trailMesh;

    bool ratioCallbackArmed = false;

    void onInit() override {
      c_to_m_ratio.setElements({"1:1", "1:2", "2:3", "1:1.4142 (sqrt2)", "free"});
      c_to_m_ratio.set(0);
      c_to_m_ratio.registerChangeCallback([this](float){
        applyRatio();
      });
      carrier_hz.registerChangeCallback([this](float){
        // Re-derive mod_hz when the user moves the carrier, unless 'free'.
        if (!ratioCallbackArmed) applyRatio();
      });

      gui << playing << c_to_m_ratio
          << carrier_hz << mod_hz << index << amp;
    }

    void onCreate() override {
      gui.init();
      nav().pos(0, 0, 4.0f);
      indexSmoothed = index.get();
      applyRatio();
    }

    // Apply the c:m ratio to mod_hz unless 'free' is selected.
    void applyRatio() {
      const int sel = static_cast<int>(c_to_m_ratio.get());
      if (sel == 4) return; // free
      float ratio = 1.0f;
      switch (sel) {
        case 0: ratio = 1.0f;          break; // 1:1
        case 1: ratio = 0.5f;          break; // 1:2  -> mod = c / (1/2)? No: c:m=1:2 means m=2c
        case 2: ratio = 2.0f / 3.0f;   break; // 2:3  -> m = c * 3/2
        case 3: ratio = 1.0f / std::sqrt(2.0f); break; // 1:sqrt(2) -> m = c*sqrt(2)
        default: ratio = 1.0f;
      }
      // The audit spec says: mod_hz = carrier_hz / ratio, so for 1:1 -> mod=c,
      // for 1:2 ratio=0.5 -> mod = c / 0.5 = 2c, etc.
      ratioCallbackArmed = true;
      mod_hz.set(carrier_hz.get() / ratio);
      ratioCallbackArmed = false;
    }

    void onSound(AudioIOData& io) override {
      if (!playing.get()) {
        while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
        return;
      }
      mod.freq(mod_hz.get());
      const float fc       = carrier_hz.get();
      const float idxTgt   = index.get();
      const float a        = amp.get();
      const float sr       = io.framesPerSecond();
      const double dPhaseC = 2.0 * static_cast<double>(M_PI) * fc / sr;
      const double dPhaseM = 2.0 * static_cast<double>(M_PI) * mod_hz.get() / sr;
      // One-pole coefficient for ~30 ms time constant.
      const float coef = 1.0f - std::exp(-1.0f / (0.030f * sr));

      while (io()) {
        indexSmoothed += (idxTgt - indexSmoothed) * coef;
        const float modOut = mod();
        const float s = a * static_cast<float>(
          std::sin(carrierPhase + indexSmoothed * modOut));
        carrierPhase += dPhaseC;
        modPhase     += dPhaseM;
        if (carrierPhase > 2.0 * static_cast<double>(M_PI))
          carrierPhase -= 2.0 * static_cast<double>(M_PI);
        if (modPhase > 2.0 * static_cast<double>(M_PI))
          modPhase -= 2.0 * static_cast<double>(M_PI);

        io.out(0) = s;
        io.out(1) = s;
        const int w = blockW.load(std::memory_order_relaxed);
        blockBuf[w] = s;
        blockW.store((w + 1) % N, std::memory_order_release);
      }

      // Publish a per-block snapshot of phase + index for the circle viz.
      lastCarrierPhase.store(static_cast<float>(carrierPhase),
                             std::memory_order_relaxed);
      lastModPhase.store(static_cast<float>(modPhase),
                         std::memory_order_relaxed);
      lastIndex.store(indexSmoothed, std::memory_order_relaxed);
    }

    void computeSpectrum(std::array<float, N / 2>& mag) {
      const int w = blockW.load(std::memory_order_acquire);
      std::array<float, N> x{};
      for (int i = 0; i < N; ++i) {
        const int idx2 = (w + i) % N;
        const float win = 0.5f * (1.0f - std::cos(
          2.0f * static_cast<float>(M_PI) * i / (N - 1)));
        x[i] = blockBuf[idx2] * win;
      }
      for (int k = 0; k < N / 2; ++k) {
        float re = 0.f, im = 0.f;
        const float ang = -2.0f * static_cast<float>(M_PI) * k / N;
        for (int n = 0; n < N; ++n) {
          re += x[n] * std::cos(ang * n);
          im += x[n] * std::sin(ang * n);
        }
        mag[k] = std::sqrt(re * re + im * im) * (2.0f / N);
      }
    }

    // J_k(x) via the standard ascending series. 10 terms is plenty for x<8.
    static float besselJ(int k, float x) {
      if (k < 0) k = -k; // J_{-k}(x) = (-1)^k J_k(x); we want |.| anyway
      double sum = 0.0;
      double termSign = 1.0;
      // Compute (x/2)^k / k!
      double xk_over_2k = 1.0;
      for (int i = 0; i < k; ++i) xk_over_2k *= (static_cast<double>(x) / 2.0);
      double kFact = 1.0;
      for (int i = 1; i <= k; ++i) kFact *= i;
      double leading = xk_over_2k / kFact;
      double pow_x2_2m = 1.0; // (x/2)^(2m), starts m=0 -> 1
      double mFact = 1.0;
      double kPlusMFact = kFact;
      for (int m = 0; m < 10; ++m) {
        sum += termSign * pow_x2_2m / (mFact * kPlusMFact);
        termSign = -termSign;
        pow_x2_2m *= (static_cast<double>(x) / 2.0)
                   * (static_cast<double>(x) / 2.0);
        const double mNext = m + 1;
        mFact *= mNext;
        kPlusMFact *= (k + mNext);
      }
      return static_cast<float>(leading * sum);
    }

    void onAnimate(double /*dt*/) override {
      std::array<float, N / 2> mag{};
      computeSpectrum(mag);

      // ---------- spectrum (top half) ----------
      spectrum.reset();
      spectrum.primitive(Mesh::LINE_STRIP);
      for (int k = 0; k < N / 2; ++k) {
        const float xx = -1.4f + (static_cast<float>(k) / (N / 2 - 1)) * 2.8f;
        const float yy = 0.2f + std::min(1.5f, mag[k] * 6.0f);
        spectrum.vertex(xx, yy, 0.f);
        const float t = static_cast<float>(k) / (N / 2);
        spectrum.color(0.5f + 0.4f * t, 0.4f + 0.5f * t, 1.0f - 0.3f * t);
      }

      // ---------- analytic Bessel ghost peaks ----------
      // Bars at fc + k*fm AND fc - k*fm for k = 0..8, height = |J_k(index)|.
      bessel.reset();
      bessel.primitive(Mesh::TRIANGLES);
      const float fc = carrier_hz.get();
      const float fm = mod_hz.get();
      const float sr = 48000.0f; // approximate; matches DFT bin layout
      const float idxNow = lastIndex.load(std::memory_order_relaxed);
      auto freqToX = [&](float f) -> float {
        // Mirror the DFT bin->x mapping: bin = f * N / sr -> normalised.
        const float norm = f * float(N) / sr / float(N / 2 - 1);
        return -1.4f + std::min(1.0f, std::max(0.0f, norm)) * 2.8f;
      };
      auto pushGhostBar = [&](float fx, float h) {
        if (fx < -1.4f || fx > 1.4f) return;
        const float bw = 0.012f;
        const float y0 = 0.2f;
        const float y1 = 0.2f + std::min(1.5f, h * 6.0f);
        const float x0 = fx - bw, x1 = fx + bw;
        // TRIANGLES quad in a contrasting orange.
        const float rC = 1.0f, gC = 0.55f, bC = 0.15f;
        bessel.vertex(x0, y0, 0.f); bessel.color(rC, gC, bC);
        bessel.vertex(x1, y0, 0.f); bessel.color(rC, gC, bC);
        bessel.vertex(x0, y1, 0.f); bessel.color(rC, gC, bC);
        bessel.vertex(x1, y0, 0.f); bessel.color(rC, gC, bC);
        bessel.vertex(x1, y1, 0.f); bessel.color(rC, gC, bC);
        bessel.vertex(x0, y1, 0.f); bessel.color(rC, gC, bC);
      };
      for (int k = 0; k <= 8; ++k) {
        const float jk = std::fabs(besselJ(k, idxNow)) * amp.get();
        pushGhostBar(freqToX(fc + k * fm), jk);
        if (k > 0) {
          const float fNeg = std::fabs(fc - k * fm);
          pushGhostBar(freqToX(fNeg), jk);
        }
      }

      // ---------- waveform ----------
      waveform.reset();
      waveform.primitive(Mesh::LINE_STRIP);
      const int w = blockW.load(std::memory_order_acquire);
      for (int i = 0; i < N; ++i) {
        const int idx2 = (w + i) % N;
        const float xx = -1.4f + (static_cast<float>(i) / (N - 1)) * 2.8f;
        const float yy = -0.9f + blockBuf[idx2] * 0.6f;
        waveform.vertex(xx, yy, 0.f);
        waveform.color(0.4f, 0.85f, 0.6f);
      }

      // ---------- grid ----------
      gridMesh.reset();
      gridMesh.primitive(Mesh::LINES);
      gridMesh.vertex(-1.4f, 0.2f, 0.f); gridMesh.vertex(1.4f, 0.2f, 0.f);
      gridMesh.vertex(-1.4f,-0.9f, 0.f); gridMesh.vertex(1.4f,-0.9f, 0.f);
      for (int kk = 0; kk < 4; ++kk) gridMesh.color(0.25f, 0.25f, 0.25f);

      // ---------- modulator circle (top-right corner) ----------
      // Centre at (cx, cy), radius R. Unit-circle outline + moving dot +
      // fading trail.
      const float cx = 1.05f, cy = 1.05f, R = 0.30f;
      circleMesh.reset();
      circleMesh.primitive(Mesh::LINE_STRIP);
      constexpr int CSEG = 64;
      for (int i = 0; i <= CSEG; ++i) {
        const float a = 2.0f * static_cast<float>(M_PI) * i / CSEG;
        circleMesh.vertex(cx + R * std::cos(a), cy + R * std::sin(a), 0.f);
        circleMesh.color(0.5f, 0.5f, 0.6f);
      }

      // Update trail with the latest snapshot.
      const float cp = lastCarrierPhase.load(std::memory_order_relaxed);
      const float mp = lastModPhase.load(std::memory_order_relaxed);
      const float effPhase = cp + idxNow * std::sin(mp);
      const float dotX = cx + R * std::cos(effPhase);
      const float dotY = cy + R * std::sin(effPhase);
      {
        const int t = trailW.load(std::memory_order_relaxed);
        trailX[t] = dotX;
        trailY[t] = dotY;
        trailW.store((t + 1) % TRAIL_N, std::memory_order_release);
      }

      // Render fading trail (newest = bright, oldest = dim).
      trailMesh.reset();
      trailMesh.primitive(Mesh::LINE_STRIP);
      {
        const int t = trailW.load(std::memory_order_acquire);
        for (int i = 0; i < TRAIL_N; ++i) {
          const int idx2 = (t + i) % TRAIL_N;
          const float age = float(i) / float(TRAIL_N - 1); // 0=oldest, 1=newest
          trailMesh.vertex(trailX[idx2], trailY[idx2], 0.f);
          trailMesh.color(0.95f * age, 0.6f * age, 0.2f * age);
        }
      }

      // Moving disc — inline TRIANGLES fan.
      dotMesh.reset();
      dotMesh.primitive(Mesh::TRIANGLES);
      constexpr int DSEG = 16;
      const float dr = 0.025f;
      for (int i = 0; i < DSEG; ++i) {
        const float a0 = 2.0f * static_cast<float>(M_PI) * i / DSEG;
        const float a1 = 2.0f * static_cast<float>(M_PI) * (i + 1) / DSEG;
        dotMesh.vertex(dotX, dotY, 0.f);
        dotMesh.vertex(dotX + dr * std::cos(a0), dotY + dr * std::sin(a0), 0.f);
        dotMesh.vertex(dotX + dr * std::cos(a1), dotY + dr * std::sin(a1), 0.f);
        dotMesh.color(1.0f, 0.85f, 0.3f);
        dotMesh.color(1.0f, 0.85f, 0.3f);
        dotMesh.color(1.0f, 0.85f, 0.3f);
      }
    }

    void onDraw(Graphics& g) override {
      g.clear(0.04f, 0.04f, 0.08f);
      g.meshColor();
      g.draw(gridMesh);
      g.draw(spectrum);
      g.draw(bessel);
      g.draw(waveform);
      g.draw(circleMesh);
      g.draw(trailMesh);
      g.draw(dotMesh);
      gui.draw(g);
    }
  };

  ALLOLIB_WEB_MAIN(FmIndex)
  `,
  },
  {
    id: 'mat-comb-swept',
    title: 'Comb Filter — Source · Mode · Sweep',
    description:
      "A pedagogical comb filter lab with three layered visualizers: (1) the deterministic transfer function |H(e^jω)| computed live from the current delay/feedback/feedforward — visible the instant the example loads, no audio warm-up; (2) the impulse response in time domain, computed each animation frame by sending a delta into a clone of the filter — you can literally see the echo train; (3) the live audio output trace below. Source selector covers white noise, pink noise, single impulses, a slow sine sweep, and the bundled mixed loop. Mode toggle switches between feedback comb (resonant peaks at fk = k/D) and feedforward comb (notches at fk = (k+0.5)/D). LFO sweep reveals the math live. On/off gate so you can A/B silence vs the filtered tail without restarting.",
    category: 'mat-signal',
    subcategory: 'delay',
    code: `/**
 * Comb Filter — Source · Mode · Sweep — MAT200B Phase 2 v3
 *
 * Three coupled views of the same filter on screen at once:
 *
 *   TOP      transfer function |H(e^jω)| — math, deterministic
 *   MIDDLE   impulse response IR[n] — echo train, computed each frame
 *            by injecting a delta into a clone of the comb
 *   BOTTOM   live time-domain output trace
 *
 * Source menu (white noise / pink noise / impulse pulse train /
 * sine sweep / bundled mixed loop) and a feedback↔feedforward
 * mode toggle. Wallclock-driven LFO so the visual animates even
 * before AudioContext engages.
 *
 *   y_fb[n]  = x[n] + g · y[n - M]              (peaks at k/D)
 *   y_ff[n]  = x[n] - g · x[n - M]              (notches at (k+0.5)/D)
 *
 * 'mode' picks fb / ff. 'g' is the (single) feedback or feedforward
 * gain; the example deliberately exposes ONE knob so the math is
 * legible. 'D' (delay in ms) is LFO-modulated between dmin and dmax.
 */

#include "al_playground_compat.hpp"
#include "al_WebSamplePlayer.hpp"
#include "Gamma/Noise.h"
#include "Gamma/Oscillator.h"

#include <array>
#include <atomic>
#include <cmath>
#include <vector>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

using namespace al;

class CombSwept : public App {
public:
  ParameterMenu source     {"source",       ""};
  ParameterMenu mode       {"mode",         ""};
  ParameterBool playing    {"playing",      "", true};
  Parameter     delay_min  {"delay_min_ms", "",  2.0f,   0.5f,  20.0f};
  Parameter     delay_max  {"delay_max_ms", "", 20.0f,   5.0f, 100.0f};
  Parameter     lfo_hz     {"lfo_hz",       "",  0.30f,  0.0f,  5.0f};
  Parameter     g_gain     {"g",            "",  0.85f, -0.99f, 0.99f};
  Parameter     amp        {"amplitude",    "",  0.30f,  0.0f,  1.0f};
  Trigger       fire_pulse {"fire_pulse",   ""};

  ControlGUI gui;

  // ------------- Comb filter delay line (manual, so we can also
  // ------------- use a separate clone for the impulse-response view).
  static constexpr int   MAX_DELAY = 8192;
  std::array<float, MAX_DELAY> dline{};
  int dlineW = 0;

  // Source state
  gam::NoiseWhite<> nw;
  WebSamplePlayer mixed;
  // Pink noise state (Voss-McCartney-ish via 7-pole IIR averaging of white).
  std::array<float, 7> pinkRows{};
  // Sine sweep state
  double sweepPhase = 0.0;
  // Pulse-train trigger
  std::atomic<int> firePulsePending{0};
  int   pulseCountdown = 0;
  int   autoPulseCounter = 0;

  // Wallclock LFO phase
  double vizLfoPhase = 0.0;
  std::atomic<float> sampleRateHz{48000.f};

  // Audio→graphics ring for the live-output panel
  static constexpr int RING = 512;
  std::array<float, RING> outRing{};
  std::atomic<int> ringW{0};

  // Smoothed gate gain to avoid clicks on play/stop
  float gateGain = 0.0f;

  Mesh spectrum, irMesh, outWave, gridMesh, notchMarks, modeBadge;

  void onInit() override {
    source.setElements({"white noise", "pink noise", "impulse train",
                        "sine sweep", "mixed loop"});
    source.set(0);
    mode.setElements({"feedback (peaks)", "feedforward (notches)"});
    mode.set(0);

    gui << source << mode << playing
        << delay_min << delay_max << lfo_hz << g_gain << amp << fire_pulse;

    fire_pulse.registerChangeCallback([this](float){
      firePulsePending.store(1, std::memory_order_release);
    });
  }

  void onCreate() override {
    gui.init();
    mixed.load("mixed_loop.wav");
    nav().pos(0, 0, 4.0f);
  }

  // --- source generators ----------------------------------------------
  float pinkNoise() {
    // Voss-McCartney 7-row pink. Rolling rng + sum of rows.
    static unsigned int rngState = 0x1234567u;
    rngState = rngState * 1664525u + 1013904223u;
    int row = __builtin_ctz((rngState | 0x80) & 0x7F);
    if (row >= 7) row = 0;
    pinkRows[row] = (((rngState >> 8) & 0xFFFF) / 32768.f - 1.f);
    float sum = 0.f;
    for (float v : pinkRows) sum += v;
    return sum * (1.0f / 7.0f);
  }

  float renderSource(int srcIdx, float sr, float& playhead, int nFrames) {
    switch (srcIdx) {
      case 0: return nw() * 0.5f;
      case 1: return pinkNoise() * 1.2f;
      case 2: {
        // Impulse train: one pulse per ~250 ms, plus user-fired pulses.
        if (firePulsePending.exchange(0, std::memory_order_acquire))
          pulseCountdown = 1;
        if (pulseCountdown > 0) { --pulseCountdown; return 0.95f; }
        if (++autoPulseCounter >= static_cast<int>(sr * 0.25f)) {
          autoPulseCounter = 0;
          return 0.85f;
        }
        return 0.0f;
      }
      case 3: {
        // 6-second log sweep 100 -> 4000 Hz.
        const double sweepDur = 6.0;
        const double t = std::fmod(sweepPhase / sr, sweepDur);
        const double fStart = 100.0, fEnd = 4000.0;
        const double f = fStart * std::pow(fEnd / fStart, t / sweepDur);
        sweepPhase += 1.0;
        return std::sin(2.0 * M_PI * f * t) * 0.6f;
      }
      case 4: {
        if (!mixed.ready() || nFrames <= 0) return 0.f;
        const float s = mixed.readInterp(0, playhead);
        playhead += mixed.sampleRate() / sr;
        if (playhead >= nFrames) playhead -= nFrames;
        return s;
      }
    }
    return 0.0f;
  }

  // Tap delay line at sample-distance M behind writeIdx.
  static inline float tap(const std::array<float, MAX_DELAY>& buf,
                          int writeIdx, int M) {
    int idx = writeIdx - M;
    while (idx < 0) idx += MAX_DELAY;
    return buf[idx % MAX_DELAY];
  }

  // --- audio -----------------------------------------------------------
  float mixedPlayhead = 0.0f;

  void onSound(AudioIOData& io) override {
    sampleRateHz.store(io.framesPerSecond(), std::memory_order_relaxed);
    const float sr = io.framesPerSecond();
    const float dmin = delay_min.get() * 0.001f;
    const float dmax = delay_max.get() * 0.001f;
    const float lfoF = lfo_hz.get();
    const float g    = g_gain.get();
    const float a    = amp.get();
    const int   srcIdx = (int)source.get();
    const bool  isFB = ((int)mode.get() == 0);
    const float targetGate = playing.get() ? 1.0f : 0.0f;
    const float gateA = std::exp(-1.0f / (0.005f * sr));   // ~5 ms
    const int   nFrames = mixed.frames();

    double phase = 0.0;
    while (io()) {
      // Modulated delay (audio-rate, smooth).
      phase += lfoF / sr;
      if (phase > 1.0) phase -= std::floor(phase);
      const float u = 0.5f + 0.5f * std::cos(2.0f * (float)M_PI * (float)phase);
      const float dSec = dmin + u * (dmax - dmin);
      const int M = std::max(1, std::min(MAX_DELAY - 1,
                              static_cast<int>(std::round(dSec * sr))));

      const float x = renderSource(srcIdx, sr, mixedPlayhead, nFrames);

      float y;
      if (isFB) {
        const float yPrev = tap(dline, dlineW, M);
        y = x + g * yPrev;
        dlineW = (dlineW + 1) % MAX_DELAY;
        dline[dlineW] = y;
      } else {
        const float xPrev = tap(dline, dlineW, M);
        y = x - g * xPrev;
        dlineW = (dlineW + 1) % MAX_DELAY;
        dline[dlineW] = x;
      }

      gateGain = targetGate + gateA * (gateGain - targetGate);
      const float out = y * a * gateGain;
      io.out(0) = out;
      io.out(1) = out;

      const int w = ringW.load(std::memory_order_relaxed);
      outRing[w] = out;
      ringW.store((w + 1) % RING, std::memory_order_release);
    }
  }

  // --- visuals ---------------------------------------------------------
  void onAnimate(double dt) override {
    vizLfoPhase += dt * static_cast<double>(lfo_hz.get());
    if (vizLfoPhase > 1.0) vizLfoPhase -= std::floor(vizLfoPhase);
    const float u = 0.5f + 0.5f * std::cos(2.0f * (float)M_PI * (float)vizLfoPhase);

    const float sr = sampleRateHz.load(std::memory_order_relaxed);
    const float dmin = delay_min.get() * 0.001f;
    const float dmax = delay_max.get() * 0.001f;
    const float dSec = dmin + u * (dmax - dmin);
    const float g = g_gain.get();
    const bool  isFB = ((int)mode.get() == 0);
    const int   M = std::max(1, static_cast<int>(std::round(dSec * sr)));

    // ------- TOP: |H(e^jω)|
    constexpr int NB = 256;
    spectrum.reset();
    spectrum.primitive(Mesh::TRIANGLE_STRIP);
    const float yTop_b = +0.30f, yTop_t = +1.30f;
    for (int k = 0; k < NB; ++k) {
      const float w = (float)M_PI * k / (NB - 1);
      const float wM = w * M;
      float magSq;
      if (isFB) {
        // |1 / (1 - g e^-jωM)|² = 1 / (1 - 2g cos(ωM) + g²)
        const float den = std::max(1e-6f, 1.f - 2.f * g * std::cos(wM) + g * g);
        magSq = 1.f / den;
      } else {
        // |1 - g e^-jωM|² = 1 - 2g cos(ωM) + g²
        magSq = 1.f - 2.f * g * std::cos(wM) + g * g;
      }
      const float H = std::sqrt(std::max(magSq, 1e-9f));
      const float h = std::min(1.0f, std::log10(1.f + H * 4.f) * 1.0f);
      const float xx = -1.4f + ((float)k / (NB - 1)) * 2.8f;
      spectrum.vertex(xx, yTop_b, 0.f);
      spectrum.vertex(xx, yTop_b + h * (yTop_t - yTop_b), 0.f);
      const float t = (float)k / (NB - 1);
      // Color by mode: feedback warm orange/red, feedforward cool cyan/blue.
      if (isFB) {
        spectrum.color(0.30f, 0.10f, 0.10f);
        spectrum.color(0.95f, 0.55f + 0.40f * t, 0.20f);
      } else {
        spectrum.color(0.10f, 0.10f, 0.30f);
        spectrum.color(0.30f + 0.30f * t, 0.65f, 0.95f);
      }
    }

    // ------- MIDDLE: impulse response (live)
    // Compute IR_len = min(2 * M + 64, 512) samples by simulating the
    // filter on a delta.
    constexpr int IR_LEN = 512;
    std::array<float, IR_LEN> irBuf{};
    std::array<float, MAX_DELAY> irDline{};
    int irW = 0;
    for (int n = 0; n < IR_LEN; ++n) {
      const float x = (n == 0) ? 1.0f : 0.0f;
      float y;
      if (isFB) {
        const float yPrev = tap(irDline, irW, M);
        y = x + g * yPrev;
        irW = (irW + 1) % MAX_DELAY;
        irDline[irW] = y;
      } else {
        const float xPrev = tap(irDline, irW, M);
        y = x - g * xPrev;
        irW = (irW + 1) % MAX_DELAY;
        irDline[irW] = x;
      }
      irBuf[n] = y;
    }
    irMesh.reset();
    irMesh.primitive(Mesh::LINES);
    const float yMid_c = -0.05f;
    const float irScale = 0.25f;
    for (int n = 0; n < IR_LEN; ++n) {
      const float xx = -1.4f + ((float)n / (IR_LEN - 1)) * 2.8f;
      const float v = irBuf[n] * irScale;
      irMesh.vertex(xx, yMid_c, 0.f);
      irMesh.vertex(xx, yMid_c + v, 0.f);
      const float fade = 1.0f - (float)n / (IR_LEN - 1);
      if (isFB) {
        irMesh.color(0.95f, 0.55f, 0.20f);
        irMesh.color(0.95f, 0.55f, 0.20f * fade + 0.05f);
      } else {
        irMesh.color(0.30f, 0.85f, 0.95f);
        irMesh.color(0.30f, 0.85f, 0.95f * fade + 0.05f);
      }
    }

    // ------- BOTTOM: live audio trace
    outWave.reset();
    outWave.primitive(Mesh::LINE_STRIP);
    const int wHead = ringW.load(std::memory_order_acquire);
    constexpr int W = 256;
    const float yBot_c = -0.85f;
    for (int i = 0; i < W; ++i) {
      const int idx = (wHead - W + i + RING) % RING;
      const float xx = -1.4f + ((float)i / (W - 1)) * 2.8f;
      const float v = outRing[idx] * 0.25f;
      outWave.vertex(xx, yBot_c + v, 0.f);
      outWave.color(0.85f, 0.85f, 0.40f);
    }

    // ------- Notch / peak markers (theory)
    notchMarks.reset();
    notchMarks.primitive(Mesh::LINES);
    if (dSec > 1e-6f && sr > 1.f) {
      const float fundamental = 1.0f / dSec;
      const float nyquist = 0.5f * sr;
      // Feedback: peaks at k * fundamental. Feedforward: notches at
      // (k + 0.5) * fundamental. Show whichever applies.
      for (int kk = 1; kk < 64; ++kk) {
        const float fk = isFB ? (float)kk * fundamental
                              : ((float)kk - 0.5f) * fundamental;
        if (fk >= nyquist) break;
        const float xx = -1.4f + (fk / nyquist) * 2.8f;
        notchMarks.vertex(xx, yTop_b, 0.f);
        notchMarks.vertex(xx, yTop_b + 0.05f, 0.f);
        if (isFB) {
          notchMarks.color(1.0f, 0.85f, 0.30f);
          notchMarks.color(1.0f, 0.85f, 0.30f);
        } else {
          notchMarks.color(0.85f, 0.30f, 0.30f);
          notchMarks.color(0.85f, 0.30f, 0.30f);
        }
      }
    }

    // ------- Grid: panel dividers
    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    auto hline = [&](float y, float r, float gC, float b) {
      gridMesh.vertex(-1.4f, y, 0.f); gridMesh.color(r, gC, b);
      gridMesh.vertex( 1.4f, y, 0.f); gridMesh.color(r, gC, b);
    };
    hline(yTop_b,    0.35f, 0.35f, 0.40f);   // top panel base
    hline(yMid_c,    0.30f, 0.30f, 0.35f);   // mid axis
    hline(yMid_c+0.30f, 0.18f, 0.18f, 0.22f);
    hline(yMid_c-0.30f, 0.18f, 0.18f, 0.22f);
    hline(yBot_c,    0.30f, 0.30f, 0.35f);   // bottom axis
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.05f, 0.07f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(notchMarks);
    g.draw(spectrum);
    g.draw(irMesh);
    g.draw(outWave);
    gui.draw(g);
  }

  bool onMouseDown(const Mouse&) override { return false; }
  bool onMouseDrag(const Mouse&) override { return false; }
  bool onMouseUp  (const Mouse&) override { return false; }
};

ALLOLIB_WEB_MAIN(CombSwept)
`,
  },
  {
    id: 'mat-drawable-wavetable',
    title: 'Drawable Wavetable',
    description:
    'Click-and-drag inside the dashed rectangle to draw a 256-point waveform; the oscillator plays it back at the carrier pitch. Linear interp of an arbitrary hand-drawn table aliases hard — every brush stroke injects energy above Nyquist that folds back as inharmonic hash, and "randomize" is a wall of it. Toggle "bandlimit" to filter the table in the frequency domain (256-pt DFT, zero bins above min(64, Nyquist/carrier_hz), IDFT into a separate playTable) and play THAT version. Bright green = the table you drew; dim cyan overlay = the bandlimited table actually playing.',
    category: 'mat-synthesis',
    subcategory: 'wavetable',
    code: `/**
   * Drawable Wavetable — MAT200B Phase 2 (bandlimit upgrade)
   *
   * Drag inside the dashed draw zone to paint a 256-point waveform.
   * The naive playback path (bandlimit OFF) reads 'table' directly with
   * linear interpolation — any hand-drawn shape contains harmonics
   * above Nyquist that alias back as inharmonic hash, especially after
   * a 'randomize' press.
   *
   * The bandlimit path (default ON) runs an inline 256-pt DFT of the
   * drawn table, zeros all bins above min(64, Nyquist / carrier_hz),
   * and runs an inline IDFT into a separate 'playTable'. The audio
   * thread reads playTable when bandlimit is on. We rebuild on any
   * mutation: drag, clear, randomize, smoothing change, carrier change,
   * or toggle.
   *
   * Visual:
   *   dashed rectangle — the draw zone (only strokes inside it write).
   *   bright green     — the table you drew.
   *   dim cyan         — playTable (bandlimited, only when toggle on).
   *   bottom strip     — live magnitude spectrum from a 256-pt DFT.
   */

  #include "al_playground_compat.hpp"

  #include <array>
  #include <atomic>
  #include <cmath>
  #include <cstdlib>

  #ifndef M_PI
  #define M_PI 3.14159265358979323846
  #endif

  using namespace al;

  class DrawableWavetable : public App {
  public:
  ParameterBool  playing    {"playing",    "", true};
  ParameterBool  bandlimit  {"bandlimit",  "", true};
  Parameter      carrier_hz {"carrier_hz", "", 220.0f,  20.0f, 2000.0f};
  Parameter      amp        {"amplitude",  "",  0.30f,  0.0f,  1.0f};
  Parameter      smoothing  {"smoothing",  "",  0.20f,  0.0f,  0.95f};
  Trigger        clearTbl   {"clear_to_sine", ""};
  Trigger        randomize  {"randomize", ""};

  ControlGUI gui;

  static constexpr int TBL = 256;
  std::array<float, TBL> table{};      // what you drew
  std::array<float, TBL> playTable{};  // bandlimited copy
  double phase = 0.0;

  // Cached sample rate so onAnimate can compute the DFT cutoff.
  std::atomic<float> sampleRate{48000.0f};

  static constexpr int N = 256;
  std::array<float, N> blockBuf{};
  std::atomic<int> blockW{0};

  std::atomic<float> playheadIdx{0.0f};

  std::atomic<int>   pendingIdx{-1};
  std::atomic<float> pendingVal{0.f};

  std::atomic<bool> tableDirty{true};

  Mesh tableMesh, playMesh, spectrum, gridMesh, drawZone, playMarker;

  // Inline DFT/IDFT — N=256, called only on table-change events.
  static void bandlimitTable(const std::array<float, TBL>& src,
                             std::array<float, TBL>& dst,
                             int cutoff) {
    std::array<float, TBL> re{}, im{};
    for (int k = 0; k < TBL; ++k) {
      float ar = 0.f, ai = 0.f;
      const float ang = -2.0f * static_cast<float>(M_PI) * k / TBL;
      for (int n = 0; n < TBL; ++n) {
        ar += src[n] * std::cos(ang * n);
        ai += src[n] * std::sin(ang * n);
      }
      re[k] = ar;
      im[k] = ai;
    }
    // Zero bins above cutoff (and their conjugate mirror at TBL-k).
    for (int k = 0; k < TBL; ++k) {
      const int kSym = (k <= TBL / 2) ? k : (TBL - k);
      if (kSym > cutoff) {
        re[k] = 0.f;
        im[k] = 0.f;
      }
    }
    // IDFT — real part only (input is real, bins are conjugate-symmetric).
    for (int n = 0; n < TBL; ++n) {
      float acc = 0.f;
      const float ang = 2.0f * static_cast<float>(M_PI) * n / TBL;
      for (int k = 0; k < TBL; ++k) {
        acc += re[k] * std::cos(ang * k) - im[k] * std::sin(ang * k);
      }
      dst[n] = acc / TBL;
    }
  }

  void rebuildPlayTable() {
    const float sr = sampleRate.load(std::memory_order_relaxed);
    const float ny = sr * 0.5f;
    const float fc = carrier_hz.get();
    const int   maxHarm = (fc > 1.f) ? static_cast<int>(ny / fc) : 64;
    const int   cutoff  = std::min(64, std::max(1, maxHarm));
    bandlimitTable(table, playTable, cutoff);
  }

  void onInit() override {
    gui << playing << bandlimit << carrier_hz << amp << smoothing
        << clearTbl << randomize;

    clearTbl.registerChangeCallback([this](float) {
      for (int i = 0; i < TBL; ++i) {
        table[i] = std::sin(2.0f * static_cast<float>(M_PI) * i / TBL);
      }
      tableDirty.store(true, std::memory_order_release);
    });
    randomize.registerChangeCallback([this](float) {
      for (int i = 0; i < TBL; ++i) {
        table[i] = (static_cast<float>(std::rand()) / RAND_MAX) * 2.f - 1.f;
      }
      for (int pass = 0; pass < 2; ++pass) {
        float prev = table[0];
        for (int i = 1; i < TBL; ++i) {
          const float y = 0.5f * (prev + table[i]);
          prev = table[i];
          table[i] = y;
        }
      }
      tableDirty.store(true, std::memory_order_release);
    });
    carrier_hz.registerChangeCallback([this](float) {
      tableDirty.store(true, std::memory_order_release);
    });
    bandlimit.registerChangeCallback([this](float) {
      tableDirty.store(true, std::memory_order_release);
    });

    for (int i = 0; i < TBL; ++i) {
      table[i] = std::sin(2.0f * static_cast<float>(M_PI) * i / TBL);
    }
    playTable = table;
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
  }

  void onSound(AudioIOData& io) override {
    sampleRate.store(io.framesPerSecond(), std::memory_order_relaxed);
    if (!playing.get()) {
      while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
      return;
    }
    const float sr = io.framesPerSecond();
    const float dPh = TBL * carrier_hz.get() / sr;
    const float a   = amp.get();
    const bool  bl  = bandlimit.get();

    while (io()) {
      const int i0 = static_cast<int>(phase) % TBL;
      const int i1 = (i0 + 1) % TBL;
      const float frac = static_cast<float>(phase - std::floor(phase));
      float s;
      if (bl) {
        s = (playTable[i0] + (playTable[i1] - playTable[i0]) * frac) * a;
      } else {
        s = (table[i0] + (table[i1] - table[i0]) * frac) * a;
      }
      io.out(0) = s;
      io.out(1) = s;

      phase += dPh;
      if (phase >= TBL) phase -= TBL;

      const int w = blockW.load(std::memory_order_relaxed);
      blockBuf[w] = s;
      blockW.store((w + 1) % N, std::memory_order_release);
    }
    playheadIdx.store(static_cast<float>(phase), std::memory_order_release);
  }

  void computeSpectrum(std::array<float, N / 2>& mag) {
    const int w = blockW.load(std::memory_order_acquire);
    std::array<float, N> x{};
    for (int i = 0; i < N; ++i) {
      const int idx = (w + i) % N;
      const float win = 0.5f * (1.0f - std::cos(2.0f * static_cast<float>(M_PI) * i / (N - 1)));
      x[i] = blockBuf[idx] * win;
    }
    for (int k = 0; k < N / 2; ++k) {
      float re = 0.f, im = 0.f;
      const float ang = -2.0f * static_cast<float>(M_PI) * k / N;
      for (int n = 0; n < N; ++n) {
        re += x[n] * std::cos(ang * n);
        im += x[n] * std::sin(ang * n);
      }
      mag[k] = std::sqrt(re * re + im * im) * (2.0f / N);
    }
  }

  void onAnimate(double /*dt*/) override {
    const int pIdx = pendingIdx.exchange(-1, std::memory_order_acquire);
    if (pIdx >= 0 && pIdx < TBL) {
      table[pIdx] = std::max(-1.0f, std::min(1.0f, pendingVal.load()));
      const float s = smoothing.get();
      if (s > 0.f) {
        const int j0 = (pIdx - 1 + TBL) % TBL;
        const int j2 = (pIdx + 1)        % TBL;
        const float avg = (table[j0] + table[pIdx] + table[j2]) / 3.f;
        table[pIdx] = table[pIdx] * (1.f - s) + avg * s;
      }
      tableDirty.store(true, std::memory_order_release);
    }

    if (tableDirty.exchange(false, std::memory_order_acq_rel)) {
      if (bandlimit.get()) {
        rebuildPlayTable();
      } else {
        playTable = table;
      }
    }

    // Drawn table: bright green LINE_STRIP centered at y = 0.55.
    tableMesh.reset();
    tableMesh.primitive(Mesh::LINE_STRIP);
    for (int i = 0; i < TBL; ++i) {
      const float xx = -1.4f + (static_cast<float>(i) / (TBL - 1)) * 2.8f;
      const float yy = 0.55f + table[i] * 0.40f;
      tableMesh.vertex(xx, yy, 0.f);
      tableMesh.color(0.6f, 0.95f, 0.4f);
    }

    // Bandlimited overlay (dim cyan) — only when bandlimit is on.
    playMesh.reset();
    if (bandlimit.get()) {
      playMesh.primitive(Mesh::LINE_STRIP);
      for (int i = 0; i < TBL; ++i) {
        const float xx = -1.4f + (static_cast<float>(i) / (TBL - 1)) * 2.8f;
        const float yy = 0.55f + playTable[i] * 0.40f;
        playMesh.vertex(xx, yy, 0.f);
        playMesh.color(0.35f, 0.75f, 0.85f);
      }
    }

    // Spectrum across the bottom: y in [-0.95, +0.05] max.
    std::array<float, N / 2> mag{};
    computeSpectrum(mag);
    spectrum.reset();
    spectrum.primitive(Mesh::LINE_STRIP);
    for (int k = 0; k < N / 2; ++k) {
      const float xx = -1.4f + (static_cast<float>(k) / (N / 2 - 1)) * 2.8f;
      const float h  = std::min(1.0f, mag[k] * 7.0f);
      const float yy = -0.95f + h;
      spectrum.vertex(xx, yy, 0.f);
      const float t = static_cast<float>(k) / (N / 2);
      spectrum.color(0.4f + 0.5f * t, 0.5f, 0.95f - 0.3f * t);
    }

    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    gridMesh.vertex(-1.4f, 0.55f, 0.f); gridMesh.vertex(1.4f, 0.55f, 0.f);
    gridMesh.vertex(-1.4f,-0.95f, 0.f); gridMesh.vertex(1.4f,-0.95f, 0.f);
    for (int k = 0; k < 4; ++k) gridMesh.color(0.22f, 0.22f, 0.22f);

    // Dashed-rectangle draw zone — top of canvas (matches writeFromMouse).
    drawZone.reset();
    drawZone.primitive(Mesh::LINES);
    {
      const float top = 0.95f, bot = 0.15f;
      const float left = -1.4f, right = 1.4f;
      const int   hDashes = 28;
      const float dx = (right - left) / hDashes;
      for (int i = 0; i < hDashes; i += 2) {
        const float x0 = left + i * dx;
        const float x1 = left + (i + 1) * dx;
        drawZone.vertex(x0, top, 0.f); drawZone.vertex(x1, top, 0.f);
        drawZone.vertex(x0, bot, 0.f); drawZone.vertex(x1, bot, 0.f);
      }
      const int   vDashes = 12;
      const float dy = (top - bot) / vDashes;
      for (int j = 0; j < vDashes; j += 2) {
        const float y0 = bot + j * dy;
        const float y1 = bot + (j + 1) * dy;
        drawZone.vertex(left,  y0, 0.f); drawZone.vertex(left,  y1, 0.f);
        drawZone.vertex(right, y0, 0.f); drawZone.vertex(right, y1, 0.f);
      }
    }
    for (size_t v = 0; v < drawZone.vertices().size(); ++v) {
      drawZone.color(0.55f, 0.45f, 0.25f);
    }

    // Playhead disc tracks whatever the audio thread is reading.
    const float p = playheadIdx.load(std::memory_order_acquire) / TBL;
    const float px = -1.4f + p * 2.8f;
    const int idx = static_cast<int>(p * (TBL - 1));
    const float src = bandlimit.get() ? playTable[idx] : table[idx];
    const float py = 0.55f + src * 0.40f;
    playMarker.reset();
    playMarker.primitive(Mesh::TRIANGLES);
    {
      const int seg = 14;
      const float radius = 0.045f;
      for (int s = 0; s < seg; ++s) {
        const float a0 = 2.f * static_cast<float>(M_PI) * s       / seg;
        const float a1 = 2.f * static_cast<float>(M_PI) * (s + 1) / seg;
        playMarker.vertex(px, py, 0.f);
        playMarker.vertex(px + radius * std::cos(a0), py + radius * std::sin(a0), 0.f);
        playMarker.vertex(px + radius * std::cos(a1), py + radius * std::sin(a1), 0.f);
        playMarker.color(1.0f, 0.85f, 0.2f);
        playMarker.color(1.0f, 0.85f, 0.2f);
        playMarker.color(1.0f, 0.85f, 0.2f);
      }
    }
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.05f, 0.07f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(drawZone);
    g.draw(playMesh);
    g.draw(tableMesh);
    g.draw(playMarker);
    g.draw(spectrum);
    gui.draw(g);
  }

  void writeFromMouse(const Mouse& m) {
    const float w = static_cast<float>(width());
    const float h = static_cast<float>(height());
    if (w < 1.f || h < 1.f) return;
    const float u  = std::max(0.0f, std::min(1.0f, m.x() / w));
    const float vy = std::max(0.0f, std::min(1.0f, m.y() / h));
    if (vy > 0.7f) return;
    const int idx = std::min(TBL - 1, static_cast<int>(u * TBL));
    const float val = 1.0f - 2.0f * (vy / 0.7f);
    pendingIdx.store(idx, std::memory_order_release);
    pendingVal.store(val, std::memory_order_release);
  }

  bool onMouseDown(const Mouse& m) override { writeFromMouse(m); return false; }
  bool onMouseDrag(const Mouse& m) override { writeFromMouse(m); return false; }
  bool onMouseUp(const Mouse&)     override { return false; }
  };

  ALLOLIB_WEB_MAIN(DrawableWavetable)
  `,
  },
  {
    id: 'mat-waveshaper',
    title: 'Waveshaper Distortion Explorer',
    description:
    'Pure waveshaping: input -> arbitrary memoryless transfer function -> output. Pick the source (sine/saw/noise) and the curve (tanh/atan/hardclip/cubic/sin), then crank "drive" to push the signal into saturation. A memoryless nonlinearity generates harmonics at integer multiples of the input frequency — the moment any harmonic exceeds Nyquist it folds back as inharmonic aliasing. Toggle "oversample" to process at 4x sr (linear-upsample, shape, 4-tap FIR average, decimate). When on, both spectra are drawn: orange = aliased (1x shaping), white = clean (oversampled). The orange spikes above the white curve are exactly the aliasing artifacts the FIR removes. The yellow disc tracks the live input on the transfer curve.',
    category: 'mat-signal',
    subcategory: 'dynamics',
    code: `/**
   * Waveshaper Distortion Explorer — MAT200B Phase 2 (oversample upgrade)
   *
   * Memoryless nonlinearity y = f(drive * x). Aliasing in 1x processing
   * is the central pedagogical point: any frequency content the shaper
   * generates above Nyquist folds back. With 'oversample' on we run the
   * shaper at 4x sr (linear interpolation up, shape, 4-tap boxcar FIR
   * LPF, decimate by 4). The boxcar is a simple but valid decimation
   * filter for demonstration purposes.
   *
   * Source menu: sine / saw / noise.
   * Shape menu: tanh / atan / hardclip / cubic / sin.
   *
   * Visual:
   *   transfer curve (top) with a yellow disc tracking the live input.
   *   input + output waveforms (middle).
   *   spectrum (bottom): when oversample is on, BOTH the aliased
   *   (orange) and clean (white) spectra are drawn — the orange spikes
   *   above the white curve are the folded-back harmonics. When
   *   oversample is off, only the orange spectrum is drawn.
   */

  #include "al_playground_compat.hpp"
  #include "Gamma/Oscillator.h"
  #include "Gamma/Noise.h"

  #include <array>
  #include <atomic>
  #include <cmath>

  #ifndef M_PI
  #define M_PI 3.14159265358979323846
  #endif

  using namespace al;

  class Waveshaper : public App {
  public:
  ParameterBool playing    {"playing",    "", true};
  ParameterBool oversample {"oversample", "", true};
  Parameter     freq       {"freq",       "", 220.0f, 50.0f, 2000.0f};
  Parameter     drive      {"drive",      "",   2.0f,  0.1f,  20.0f};
  Parameter     output     {"output",     "",   0.30f, 0.0f,  1.0f};
  ParameterMenu source     {"source",     ""};
  ParameterMenu shape      {"shape",      ""};

  ControlGUI gui;

  gam::Sine<>       oscSine;
  gam::Saw<>        oscSaw;
  gam::NoiseWhite<> noise;

  static constexpr int N = 256;
  std::array<float, N> blockIn{};
  std::array<float, N> blockAliased{};
  std::array<float, N> blockClean{};
  std::atomic<int> blockW{0};

  std::atomic<float> cursorIn{0.0f};

  // Audio-thread state for 4x linear interpolation.
  float prevIn = 0.0f;

  Mesh transferCurve, waveIn, waveOut, spectrumA, spectrumC, gridMesh, cursorDisc;

  static float shapeFn(int s, float x) {
    switch (s) {
      case 0: return std::tanh(x);
      case 1: return (2.0f / static_cast<float>(M_PI)) * std::atan(x);
      case 2: return std::max(-1.0f, std::min(1.0f, x));
      case 3: {
        const float y = std::max(-1.5f, std::min(1.5f, x));
        return y - (y * y * y) / 3.0f;
      }
      case 4: return std::sin((static_cast<float>(M_PI) * 0.5f) *
                              std::max(-1.0f, std::min(1.0f, x)));
      default: return std::tanh(x);
    }
  }

  void onInit() override {
    source.setElements({"sine", "saw", "noise"});
    source.set(0);
    shape.setElements({"tanh", "atan", "hardclip", "cubic", "sin"});
    shape.set(0);
    gui << playing << oversample << freq << drive << output << source << shape;
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
  }

  inline float nextSource(int src) {
    switch (src) {
      case 0: return oscSine();
      case 1: return oscSaw();
      case 2: return noise() * 0.7f;
      default: return oscSine();
    }
  }

  void onSound(AudioIOData& io) override {
    if (!playing.get()) {
      while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
      return;
    }
    oscSine.freq(freq.get());
    oscSaw.freq(freq.get());
    const float dr  = drive.get();
    const float og  = output.get();
    const int   sh  = shape.get();
    const int   src = source.get();
    const bool  os  = oversample.get();

    while (io()) {
      const float xin = nextSource(src);

      // Aliased (1x) — always computed as the spectrum reference.
      const float yAliased = shapeFn(sh, dr * xin);

      // Clean path: 4x linear-upsample, shape each, 4-tap boxcar
      // FIR LPF, decimate. Boxcar averaging is the simplest valid
      // decimation filter — adequate for the pedagogical comparison.
      float yClean;
      if (os) {
        const float u0 = 0.75f * prevIn + 0.25f * xin;
        const float u1 = 0.50f * prevIn + 0.50f * xin;
        const float u2 = 0.25f * prevIn + 0.75f * xin;
        const float u3 = xin;
        const float s0 = shapeFn(sh, dr * u0);
        const float s1 = shapeFn(sh, dr * u1);
        const float s2 = shapeFn(sh, dr * u2);
        const float s3 = shapeFn(sh, dr * u3);
        yClean = 0.25f * (s0 + s1 + s2 + s3);
      } else {
        yClean = yAliased;
      }
      prevIn = xin;

      const float y = (os ? yClean : yAliased) * og;
      io.out(0) = y;
      io.out(1) = y;

      const int w = blockW.load(std::memory_order_relaxed);
      blockIn[w]      = xin;
      blockAliased[w] = yAliased;
      blockClean[w]   = yClean;
      blockW.store((w + 1) % N, std::memory_order_release);

      cursorIn.store(xin, std::memory_order_relaxed);
    }
  }

  void computeSpectrum(std::array<float, N / 2>& mag, const std::array<float, N>& srcBuf) {
    std::array<float, N> x{};
    for (int i = 0; i < N; ++i) {
      const float win = 0.5f * (1.0f - std::cos(2.0f * static_cast<float>(M_PI) * i / (N - 1)));
      x[i] = srcBuf[i] * win;
    }
    for (int k = 0; k < N / 2; ++k) {
      float re = 0.f, im = 0.f;
      const float ang = -2.0f * static_cast<float>(M_PI) * k / N;
      for (int n = 0; n < N; ++n) {
        re += x[n] * std::cos(ang * n);
        im += x[n] * std::sin(ang * n);
      }
      mag[k] = std::sqrt(re * re + im * im) * (2.0f / N);
    }
  }

  void onAnimate(double /*dt*/) override {
    const int sh = shape.get();
    const float dr = drive.get();
    const bool  os = oversample.get();

    // Transfer curve sampled at 240 points across [-1, +1] input.
    transferCurve.reset();
    transferCurve.primitive(Mesh::LINE_STRIP);
    constexpr int TC = 240;
    for (int i = 0; i < TC; ++i) {
      const float xin = -1.0f + 2.0f * i / (TC - 1);
      const float y   = shapeFn(sh, dr * xin);
      const float xx = -1.4f + (xin + 1.f) * 0.5f * 2.8f;
      const float yy = 0.4f + (std::max(-1.f, std::min(1.f, y)) + 1.f) * 0.5f;
      transferCurve.vertex(xx, yy, 0.f);
      transferCurve.color(0.4f, 0.95f, 0.6f);
    }

    // Yellow cursor disc on transfer curve at the current input value.
    {
      const float xin = std::max(-1.0f, std::min(1.0f,
                          cursorIn.load(std::memory_order_relaxed)));
      const float y   = shapeFn(sh, dr * xin);
      const float cx  = -1.4f + (xin + 1.f) * 0.5f * 2.8f;
      const float cy  = 0.4f + (std::max(-1.f, std::min(1.f, y)) + 1.f) * 0.5f;
      cursorDisc.reset();
      cursorDisc.primitive(Mesh::TRIANGLES);
      const int seg = 16;
      const float radius = 0.04f;
      for (int s = 0; s < seg; ++s) {
        const float a0 = 2.f * static_cast<float>(M_PI) * s       / seg;
        const float a1 = 2.f * static_cast<float>(M_PI) * (s + 1) / seg;
        cursorDisc.vertex(cx, cy, 0.f);
        cursorDisc.vertex(cx + radius * std::cos(a0), cy + radius * std::sin(a0), 0.f);
        cursorDisc.vertex(cx + radius * std::cos(a1), cy + radius * std::sin(a1), 0.f);
        cursorDisc.color(1.0f, 0.9f, 0.2f);
        cursorDisc.color(1.0f, 0.9f, 0.2f);
        cursorDisc.color(1.0f, 0.9f, 0.2f);
      }
    }

    // Input + output waveforms.
    const int w = blockW.load(std::memory_order_acquire);
    waveIn.reset(); waveOut.reset();
    waveIn.primitive(Mesh::LINE_STRIP);
    waveOut.primitive(Mesh::LINE_STRIP);
    for (int i = 0; i < N; ++i) {
      const int idx = (w + i) % N;
      const float xx = -1.4f + (static_cast<float>(i) / (N - 1)) * 2.8f;
      waveIn.vertex (xx, blockIn[idx]  * 0.18f - 0.10f, 0.f);
      waveIn.color(0.5f, 0.7f, 0.95f);
      const float outSamp = os ? blockClean[idx] : blockAliased[idx];
      waveOut.vertex(xx, outSamp * 0.18f - 0.45f, 0.f);
      waveOut.color(0.95f, 0.6f, 0.35f);
    }

    // Aliased (orange) — always drawn.
    spectrumA.reset();
    spectrumA.primitive(Mesh::LINE_STRIP);
    {
      std::array<float, N / 2> magA{};
      computeSpectrum(magA, blockAliased);
      for (int k = 0; k < N / 2; ++k) {
        const float xx = -1.4f + (static_cast<float>(k) / (N / 2 - 1)) * 2.8f;
        const float h  = std::min(0.7f, magA[k] * 4.0f);
        spectrumA.vertex(xx, -1.0f + h, 0.f);
        spectrumA.color(0.95f, 0.55f, 0.25f);
      }
    }
    // Clean (white) — only when oversample is on.
    spectrumC.reset();
    if (os) {
      spectrumC.primitive(Mesh::LINE_STRIP);
      std::array<float, N / 2> magC{};
      computeSpectrum(magC, blockClean);
      for (int k = 0; k < N / 2; ++k) {
        const float xx = -1.4f + (static_cast<float>(k) / (N / 2 - 1)) * 2.8f;
        const float h  = std::min(0.7f, magC[k] * 4.0f);
        spectrumC.vertex(xx, -1.0f + h, 0.f);
        spectrumC.color(0.95f, 0.95f, 0.95f);
      }
    }

    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    gridMesh.vertex(-1.4f, 0.4f, 0.f); gridMesh.vertex(1.4f, 0.4f, 0.f);
    gridMesh.vertex(-1.4f,-0.10f,0.f); gridMesh.vertex(1.4f,-0.10f,0.f);
    gridMesh.vertex(-1.4f,-0.45f,0.f); gridMesh.vertex(1.4f,-0.45f,0.f);
    gridMesh.vertex(-1.4f,-1.00f,0.f); gridMesh.vertex(1.4f,-1.00f,0.f);
    for (int k = 0; k < 8; ++k) gridMesh.color(0.22f, 0.22f, 0.22f);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.05f, 0.06f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(transferCurve);
    g.draw(cursorDisc);
    g.draw(waveIn);
    g.draw(waveOut);
    g.draw(spectrumA);
    g.draw(spectrumC);
    gui.draw(g);
  }
  };

  ALLOLIB_WEB_MAIN(Waveshaper)
  `,
  },
  {
    id: 'mat-allpass-dispersion',
    title: 'Allpass Dispersion Plot',
    description:
      'A cascade of N first-order allpass sections has flat magnitude (1.0 at every frequency) but a phase response that grows with N. The trick: phase-only effects are silent on white noise (random phase already), so this example fires a periodic impulse train — a single sharp click smears into a metallic chirp as you stack sections, because each frequency component is delayed by a different amount (group delay = -dphi/dw). Top panel: phase response phi(w) wrapped to [-pi, pi] (saw fans out as N grows) overlaid with group delay tau(w). Middle panel: live impulse response IR[n] showing the click stretching out. Bottom panel: live audio trace of the actual output. Increase pulse_period_ms to space the clicks out, fire_pulse for a single shot.',
    category: 'mat-signal',
    subcategory: 'delay',
    code: `/**
   * Allpass Dispersion Plot — MAT200B Phase 2
   *
   * First-order allpass section (one shared coefficient g, one shared
   * delay D samples):
   *     y[n] = -g * x[n] + x[n-D] + g * y[n-D]
   *     H(z) = (-g + z^-D) / (1 - g * z^-D)
   *     |H(e^jw)| = 1 for all w  (allpass)
   *
   * For a single section the phase is
   *     phi(w) = atan2(sin(wD), -g + cos(wD)) - atan2(g*sin(wD), 1 - g*cos(wD))
   * For an N-section cascade phi_total(w) = N * phi(w), and the
   * group delay tau(w) = -d phi_total / dw smears transients in time.
   *
   * Why the impulse train?
   * White noise has random phase already, so phase-shifting it sounds
   * identical to the unshifted signal — the audit caught this. We
   * instead drive a periodic narrow impulse: one ~5-sample-wide click
   * every pulse_period_ms. As N grows, the click stretches into a
   * downward (or upward) chirp because high frequencies and low
   * frequencies leave the cascade at different times. That's the
   * audible signature of a Schroeder-style allpass diffuser.
   */

  #include "al_playground_compat.hpp"

  #include <array>
  #include <atomic>
  #include <cmath>

  #ifndef M_PI
  #define M_PI 3.14159265358979323846
  #endif

  using namespace al;

  class AllpassDispersion : public App {
  public:
  Parameter     g_apf           {"g_apf",           "",  0.70f, -0.99f, 0.99f};
  ParameterInt  sections        {"sections",        "",  6,      1,    12};
  ParameterInt  delay_samp      {"delay_samp",      "",  4,      1,    32};
  Parameter     pulse_period_ms {"pulse_period_ms", "",  200.0f, 100.0f, 500.0f};
  Parameter     amp             {"amplitude",       "",  0.30f,  0.0f,   1.0f};
  ParameterBool playing         {"playing",         "",  true};
  Trigger       fire_pulse      {"fire_pulse",      ""};

  ControlGUI gui;

  // Per-stage delay-line state for the audio cascade. Each stage owns
  // its own circular buffer of MAX_D samples for both x and y history,
  // implementing y[n] = -g*x[n] + x[n-D] + g*y[n-D].
  static constexpr int MAX_STAGES = 12;
  static constexpr int MAX_D      = 64;
  std::array<std::array<float, MAX_D>, MAX_STAGES> xBuf{};
  std::array<std::array<float, MAX_D>, MAX_STAGES> yBuf{};
  std::array<int, MAX_STAGES> wIdx{};

  // Impulse generator state (audio thread).
  int   pulseCounter = 0;
  int   clickCounter = 0;
  std::atomic<int> manualPulsePending{0};

  // Live ring buffers for the bottom (output) and middle (IR) panels.
  static constexpr int N = 256;
  std::array<float, N> outBuf{};
  std::atomic<int> outW{0};

  Mesh phaseCurve, groupDelayCurve, irMesh, outMesh, gridMesh;

  void onInit() override {
    gui << g_apf << sections << delay_samp
        << pulse_period_ms << amp << playing << fire_pulse;
    fire_pulse.registerChangeCallback([this](float) {
      manualPulsePending.store(1, std::memory_order_release);
    });
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
  }

  // Manual allpass section: one stage, with circular delay-D buffers.
  inline float runStage(int s, int D, float x, float g) {
    int& w = wIdx[s];
    const int rIdx = (w - D + MAX_D) % MAX_D;
    const float xD = xBuf[s][rIdx];
    const float yD = yBuf[s][rIdx];
    const float y  = -g * x + xD + g * yD;
    xBuf[s][w] = x;
    yBuf[s][w] = y;
    w = (w + 1) % MAX_D;
    return y;
  }

  void onSound(AudioIOData& io) override {
    if (!playing.get()) {
      while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
      return;
    }

    const float sr  = io.framesPerSecond();
    const int   N_  = sections.get();
    const float g   = g_apf.get();
    const int   D   = std::max(1, std::min(MAX_D - 1, delay_samp.get()));
    const float gA  = amp.get();
    const int   per = std::max(8, static_cast<int>(pulse_period_ms.get() * 0.001f * sr));
    constexpr int CLICK_W = 5;

    if (manualPulsePending.exchange(0, std::memory_order_acquire)) {
      clickCounter = CLICK_W;
    }

    while (io()) {
      // Periodic impulse train: 5-sample-wide rectangular click.
      if (++pulseCounter >= per) {
        pulseCounter = 0;
        clickCounter = CLICK_W;
      }
      float src = 0.f;
      if (clickCounter > 0) {
        src = 1.0f;
        --clickCounter;
      }

      float s = src;
      for (int i = 0; i < N_; ++i) s = runStage(i, D, s, g);
      const float y = s * gA;
      io.out(0) = y;
      io.out(1) = y;

      const int w = outW.load(std::memory_order_relaxed);
      outBuf[w] = y;
      outW.store((w + 1) % N, std::memory_order_release);
    }
  }

  // Phase of one allpass section H(z) = (-g + z^-D) / (1 - g*z^-D)
  static inline float onePhase(float w, int D, float g) {
    const float wD = w * static_cast<float>(D);
    const float numPhase = std::atan2(std::sin(wD), -g + std::cos(wD));
    const float denPhase = std::atan2(-g * std::sin(wD), 1.0f - g * std::cos(wD));
    return numPhase - denPhase;
  }

  static inline float wrapPi(float p) {
    constexpr float TAU = 2.0f * static_cast<float>(M_PI);
    while (p >  static_cast<float>(M_PI)) p -= TAU;
    while (p < -static_cast<float>(M_PI)) p += TAU;
    return p;
  }

  // Compute IR by feeding a unit impulse through a SHADOW cascade whose
  // state is local — this lets us draw the dispersion curve without
  // disturbing the live audio cascade.
  void computeIR(std::array<float, N>& ir, int N_, int D, float g) {
    std::array<std::array<float, MAX_D>, MAX_STAGES> xs{};
    std::array<std::array<float, MAX_D>, MAX_STAGES> ys{};
    std::array<int, MAX_STAGES> ws{};
    for (int n = 0; n < N; ++n) {
      float s = (n == 0) ? 1.0f : 0.0f;
      for (int i = 0; i < N_; ++i) {
        int& w = ws[i];
        const int rIdx = (w - D + MAX_D) % MAX_D;
        const float xD = xs[i][rIdx];
        const float yD = ys[i][rIdx];
        const float y  = -g * s + xD + g * yD;
        xs[i][w] = s;
        ys[i][w] = y;
        w = (w + 1) % MAX_D;
        s = y;
      }
      ir[n] = s;
    }
  }

  void onAnimate(double /*dt*/) override {
    const int   N_ = sections.get();
    const float g  = g_apf.get();
    const int   D  = std::max(1, std::min(MAX_D - 1, delay_samp.get()));
    const float sr = 48000.f; // for group delay scale; visualization only

    // ---------------- TOP PANEL: phase + group delay ----------------
    constexpr int W2 = 240;
    constexpr float TOP_Y0 = 0.55f, TOP_AMP = 0.40f;
    phaseCurve.reset();
    phaseCurve.primitive(Mesh::LINE_STRIP);
    groupDelayCurve.reset();
    groupDelayCurve.primitive(Mesh::LINE_STRIP);

    // First pass: gather group delay (raw) so we can auto-scale it.
    std::array<float, W2> gd{};
    float gdMax = 1e-6f;
    constexpr float dw = static_cast<float>(M_PI) / W2;
    for (int k = 0; k < W2; ++k) {
      const float w0 = std::max(1e-4f, dw * (k + 0.5f - 0.5f));
      const float w1 = w0 + dw * 0.5f;
      const float wm = w0 + dw * 0.25f;
      const float p0 = onePhase(wm - dw * 0.25f, D, g) * N_;
      const float p1 = onePhase(wm + dw * 0.25f, D, g) * N_;
      // tau = -dphi/dw; convert to seconds via /sr*sr cancels — keep in samples.
      gd[k] = -(p1 - p0) / (dw * 0.5f);
      if (std::fabs(gd[k]) > gdMax) gdMax = std::fabs(gd[k]);
    }

    for (int k = 0; k < W2; ++k) {
      const float w  = dw * (k + 0.5f);
      const float xx = -1.4f + (static_cast<float>(k) / (W2 - 1)) * 2.8f;

      // Phase wrapped to [-pi, pi]
      const float phiN = onePhase(w, D, g) * N_;
      const float phiW = wrapPi(phiN);
      const float yPhase = TOP_Y0 + TOP_AMP * (phiW / static_cast<float>(M_PI));
      phaseCurve.vertex(xx, yPhase, 0.f);
      phaseCurve.color(0.95f, 0.45f, 0.40f);

      // Group delay normalized
      const float yGD = TOP_Y0 + TOP_AMP * (gd[k] / gdMax);
      groupDelayCurve.vertex(xx, yGD, 0.f);
      groupDelayCurve.color(0.40f, 0.85f, 0.60f);
    }

    // Group-delay seconds at sr (display only — pulse_period scales the
    // hint but we use sr as a stable reference for the label).
    (void)sr;

    // ---------------- MIDDLE PANEL: impulse response ----------------
    std::array<float, N> ir{};
    computeIR(ir, N_, D, g);
    irMesh.reset();
    irMesh.primitive(Mesh::TRIANGLE_STRIP);
    constexpr float MID_Y0 = 0.0f, MID_AMP = 0.22f;
    for (int n = 0; n < N; ++n) {
      const float xx = -1.4f + (static_cast<float>(n) / (N - 1)) * 2.8f;
      const float v  = std::max(-1.0f, std::min(1.0f, ir[n]));
      const float top = MID_Y0 + v * MID_AMP;
      irMesh.vertex(xx, top, 0.f);
      irMesh.color(0.55f, 0.75f, 0.95f);
      irMesh.vertex(xx, MID_Y0, 0.f);
      irMesh.color(0.20f, 0.30f, 0.50f);
    }

    // ---------------- BOTTOM PANEL: live output trace ----------------
    outMesh.reset();
    outMesh.primitive(Mesh::LINE_STRIP);
    const int wOut = outW.load(std::memory_order_acquire);
    constexpr float BOT_Y0 = -0.65f, BOT_AMP = 0.22f;
    for (int i = 0; i < N; ++i) {
      const int idx = (wOut + i) % N;
      const float v = std::max(-1.0f, std::min(1.0f, outBuf[idx]));
      const float xx = -1.4f + (static_cast<float>(i) / (N - 1)) * 2.8f;
      outMesh.vertex(xx, BOT_Y0 + v * BOT_AMP, 0.f);
      outMesh.color(0.95f, 0.85f, 0.30f);
    }

    // Grid: one baseline per panel.
    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    gridMesh.vertex(-1.4f, TOP_Y0, 0.f); gridMesh.vertex(1.4f, TOP_Y0, 0.f);
    gridMesh.vertex(-1.4f, MID_Y0, 0.f); gridMesh.vertex(1.4f, MID_Y0, 0.f);
    gridMesh.vertex(-1.4f, BOT_Y0, 0.f); gridMesh.vertex(1.4f, BOT_Y0, 0.f);
    for (int k = 0; k < 6; ++k) gridMesh.color(0.22f, 0.22f, 0.28f);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.04f, 0.07f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(irMesh);
    g.draw(phaseCurve);
    g.draw(groupDelayCurve);
    g.draw(outMesh);
    gui.draw(g);
  }
  };

  ALLOLIB_WEB_MAIN(AllpassDispersion)
  `,
  },
  {
    id: 'mat-1d-waveguide',
    title: '1D Waveguide Instrument',
    description:
      "Real bidirectional waveguide string: two delay lines (left-going and right-going waves) exchange energy at each end through one-zero lowpass reflections. Pluck = noise burst written into both lines centred on the pluck position; pickup taps both lines at a configurable position. Tweak stiffness/damping to morph from piano-string to nylon-guitar to almost-rubber-band — and watch both travelling waves as separate strips on screen, each with a riding peak-arrow glyph showing the maximum-amplitude position. A 'mode' toggle switches between rigid-bridge (sign-flip reflection, octave-down ring) and free-bridge (in-phase reflection, octave-up ring). A gold pluck-position marker spans the grid; on every pluck a 2-frame additive flash overlays the canvas. A third row at the bottom plots the physical string displacement = right + left summed.",
    category: 'mat-synthesis',
    subcategory: 'physical',
    code: `/**
   * 1D Waveguide Instrument — MAT200B Phase 2
   *
   * 'mode' picks rigid bridge (sign-flip reflection -> octave-down ring)
   * or free bridge (in-phase reflection -> octave-up ring). Visuals:
   * top strip = rightGoing, mid strip = leftGoing, bottom = sum (the
   * physical string displacement). Riding peak triangles + gold pluck-
   * position vertical + 2-frame additive pluck flash.
   */

  #include "al_playground_compat.hpp"

  #include <array>
  #include <atomic>
  #include <cmath>
  #include <cstdlib>
  #include <vector>

  using namespace al;

  class WaveguideString : public App {
  public:
    Parameter     pitch_hz   {"pitch_hz",   "", 220.0f, 50.0f, 1200.0f};
    Parameter     pluckPos   {"pluckPos",   "",   0.30f, 0.05f,  0.95f};
    Parameter     pickupPos  {"pickupPos",  "",   0.65f, 0.05f,  0.95f};
    Parameter     damping    {"damping",    "",   0.99f, 0.90f,  1.00f};
    Parameter     stiffness  {"stiffness",  "",   0.30f, 0.0f,   1.0f};
    Parameter     excitation {"excitation", "",   0.60f, 0.0f,   1.0f};
    ParameterBool mode       {"mode",       "", false}; // false=rigid, true=free
    Trigger       pluck      {"pluck",      ""};

    ControlGUI gui;

    static constexpr int MAX_DELAY = 4096;
    std::vector<float> rightGoing;
    std::vector<float> leftGoing;

    int   delayLen = 256;
    int   writeIdxR = 0;
    int   writeIdxL = 0;
    float lpStateLeft  = 0.f;
    float lpStateRight = 0.f;

    std::atomic<int> pluckPending{0};
    std::atomic<int> delayLenAtomic{256};
    std::atomic<int> pluckFlashSet{0};

    static constexpr int VN = 384;
    std::array<float, VN> rightStripVals{};
    std::array<float, VN> leftStripVals{};
    int pluckFlashCounter = 0;

    Mesh rightStrip, leftStrip, sumStrip, gridMesh, pickupMarker, peakMarkers,
         pluckLineMesh, flashMesh;

    void onInit() override {
      gui << pitch_hz << pluckPos << pickupPos
          << damping << stiffness << excitation << mode << pluck;
      pluck.registerChangeCallback([this](float) {
        pluckPending.store(1, std::memory_order_release);
        pluckFlashSet.store(2, std::memory_order_release);
      });
    }

    void onCreate() override {
      gui.init();
      rightGoing.assign(MAX_DELAY, 0.f);
      leftGoing.assign(MAX_DELAY, 0.f);
      nav().pos(0, 0, 3.5f);
    }

    static inline float tap(const std::vector<float>& buf, int writeIdx, int pos) {
      int idx = writeIdx - pos;
      while (idx < 0) idx += MAX_DELAY;
      return buf[idx % MAX_DELAY];
    }

    void onSound(AudioIOData& io) override {
      const float sr = io.framesPerSecond();
      const int   D  = std::max(4, std::min(MAX_DELAY - 1,
                         static_cast<int>(sr / pitch_hz.get())));
      delayLen = D;
      delayLenAtomic.store(D, std::memory_order_release);

      const float fb       = damping.get();
      const float aLP      = 0.5f - 0.5f * stiffness.get();
      // Rigid bridge: sign-flip reflection (-1). Free bridge: in-phase (+1).
      const float reflSign = mode.get() ? +1.0f : -1.0f;

      if (pluckPending.exchange(0, std::memory_order_acquire)) {
        const int   center = static_cast<int>(pluckPos.get() * D);
        const int   width  = std::max(8, D / 4);
        const float amp    = excitation.get() * 0.5f;
        for (int i = 0; i < D; ++i) {
          const int dist = std::abs(i - center);
          const int idxR = ((writeIdxR - i) % MAX_DELAY + MAX_DELAY) % MAX_DELAY;
          const int idxL = ((writeIdxL - i) % MAX_DELAY + MAX_DELAY) % MAX_DELAY;
          if (dist < width / 2) {
            const float w = 1.0f - (2.0f * dist / static_cast<float>(width));
            const float n = (static_cast<float>(std::rand()) / RAND_MAX) * 2.f - 1.f;
            const float v = n * w * amp;
            rightGoing[idxR] = v;
            leftGoing[idxL]  = v;
          } else {
            rightGoing[idxR] *= 0.5f;
            leftGoing[idxL]  *= 0.5f;
          }
        }
        lpStateLeft = lpStateRight = 0.f;
      }

      const int pickupTap = std::max(1, std::min(D - 2,
                              static_cast<int>(pickupPos.get() * D)));

      while (io()) {
        const float rAtRight = tap(rightGoing, writeIdxR, D - 1);
        const float lAtLeft  = tap(leftGoing,  writeIdxL, D - 1);

        const float lpLeft  = (1.0f - aLP) * lAtLeft  + aLP * lpStateLeft;
        lpStateLeft = lAtLeft;
        const float lpRight = (1.0f - aLP) * rAtRight + aLP * lpStateRight;
        lpStateRight = rAtRight;

        const float intoRight = reflSign * lpLeft  * fb;
        const float intoLeft  = reflSign * lpRight * fb;

        const float pR = tap(rightGoing, writeIdxR, pickupTap);
        const float pL = tap(leftGoing,  writeIdxL, D - 1 - pickupTap);
        const float out = (pR + pL) * 0.5f;

        writeIdxR = (writeIdxR + 1) % MAX_DELAY;
        writeIdxL = (writeIdxL + 1) % MAX_DELAY;
        rightGoing[writeIdxR] = intoRight;
        leftGoing[writeIdxL]  = intoLeft;

        io.out(0) = out; io.out(1) = out;
      }
    }

    void onAnimate(double /*dt*/) override {
      const int D = delayLenAtomic.load(std::memory_order_acquire);
      const int step = std::max(1, D / VN);

      rightStrip.reset(); rightStrip.primitive(Mesh::LINE_STRIP);
      leftStrip.reset();  leftStrip.primitive(Mesh::LINE_STRIP);
      sumStrip.reset();   sumStrip.primitive(Mesh::LINE_STRIP);

      int count = 0;
      for (int k = 0; k < D && count < VN; k += step, ++count) {
        const float t = static_cast<float>(count) / VN;
        const float x = -1.4f + 2.8f * t;

        const float vr = tap(rightGoing, writeIdxR, k);
        const float vl = tap(leftGoing,  writeIdxL, D - 1 - k);
        rightStripVals[count] = vr;
        leftStripVals [count] = vl;

        rightStrip.vertex(x, 0.5f + vr * 0.6f, 0.f);
        rightStrip.color(0.95f, 0.55f + 0.3f * t, 0.30f);

        leftStrip.vertex(x, -0.5f + vl * 0.6f, 0.f);
        leftStrip.color(0.30f, 0.65f + 0.3f * t, 0.95f);

        const float sumV = vr + vl;
        sumStrip.vertex(x, -0.85f + sumV * 0.30f, 0.f);
        sumStrip.color(0.85f, 0.85f, 0.40f);
      }
      for (int k = count; k < VN; ++k) {
        rightStripVals[k] = 0.f;
        leftStripVals [k] = 0.f;
      }

      int rPeak = 0, lPeak = 0;
      float rMax = 0.f, lMax = 0.f;
      const int activeCount = std::max(1, count);
      for (int k = 0; k < activeCount; ++k) {
        const float ar  = std::fabs(rightStripVals[k]);
        const float al2 = std::fabs(leftStripVals [k]);
        if (ar  > rMax) { rMax = ar;  rPeak = k; }
        if (al2 > lMax) { lMax = al2; lPeak = k; }
      }

      peakMarkers.reset();
      peakMarkers.primitive(Mesh::TRIANGLES);
      auto pushTri = [&](float cx, float cy, float dirX, float r,
                         float cr, float cg, float cb) {
        const float ax = cx + dirX * r;
        const float ay = cy;
        const float bx = cx - dirX * r * 0.5f;
        const float by = cy - r * 0.7f;
        const float dx = cx - dirX * r * 0.5f;
        const float dy = cy + r * 0.7f;
        peakMarkers.vertex(ax, ay, 0.f); peakMarkers.color(cr, cg, cb);
        peakMarkers.vertex(bx, by, 0.f); peakMarkers.color(cr, cg, cb);
        peakMarkers.vertex(dx, dy, 0.f); peakMarkers.color(cr, cg, cb);
      };
      {
        const float xR = -1.4f + 2.8f * (static_cast<float>(rPeak) / VN);
        const float yR = 0.5f + rightStripVals[rPeak] * 0.6f;
        pushTri(xR, yR, +1.0f, 0.05f, 1.0f, 0.85f, 0.30f);
        const float xL = -1.4f + 2.8f * (static_cast<float>(lPeak) / VN);
        const float yL = -0.5f + leftStripVals[lPeak] * 0.6f;
        pushTri(xL, yL, -1.0f, 0.05f, 0.40f, 0.90f, 1.0f);
      }

      gridMesh.reset();
      gridMesh.primitive(Mesh::LINES);
      auto hline = [&](float y) {
        gridMesh.vertex(-1.4f, y, 0.f); gridMesh.color(0.22f, 0.22f, 0.25f);
        gridMesh.vertex( 1.4f, y, 0.f); gridMesh.color(0.22f, 0.22f, 0.25f);
      };
      hline( 0.5f); hline(-0.5f); hline(-0.85f);

      pickupMarker.reset();
      pickupMarker.primitive(Mesh::TRIANGLES);
      const float px = -1.4f + 2.8f * pickupPos.get();
      auto addDot = [&](float cx, float cy, float r) {
        const int seg = 16;
        for (int s = 0; s < seg; ++s) {
          const float a0 = 2.0f * 3.14159265f * s       / seg;
          const float a1 = 2.0f * 3.14159265f * (s + 1) / seg;
          pickupMarker.vertex(cx, cy, 0.f);
          pickupMarker.vertex(cx + r * std::cos(a0), cy + r * std::sin(a0), 0.f);
          pickupMarker.vertex(cx + r * std::cos(a1), cy + r * std::sin(a1), 0.f);
          pickupMarker.color(1.0f, 0.85f, 0.20f);
          pickupMarker.color(1.0f, 0.85f, 0.20f);
          pickupMarker.color(1.0f, 0.85f, 0.20f);
        }
      };
      addDot(px,  0.5f, 0.04f);
      addDot(px, -0.5f, 0.04f);
      addDot(px, -0.85f, 0.035f);

      pluckLineMesh.reset();
      pluckLineMesh.primitive(Mesh::LINES);
      const float plX = -1.4f + 2.8f * pluckPos.get();
      pluckLineMesh.vertex(plX, -1.05f, 0.f); pluckLineMesh.color(0.95f, 0.80f, 0.20f);
      pluckLineMesh.vertex(plX,  1.05f, 0.f); pluckLineMesh.color(0.95f, 0.80f, 0.20f);

      const int flashRequest = pluckFlashSet.exchange(0, std::memory_order_acquire);
      if (flashRequest > 0) pluckFlashCounter = flashRequest;
      flashMesh.reset();
      flashMesh.primitive(Mesh::TRIANGLE_STRIP);
      if (pluckFlashCounter > 0) {
        const float a = 0.18f * static_cast<float>(pluckFlashCounter) / 2.0f;
        flashMesh.vertex(-1.6f, -1.2f, 0.f); flashMesh.color(a, a, a);
        flashMesh.vertex( 1.6f, -1.2f, 0.f); flashMesh.color(a, a, a);
        flashMesh.vertex(-1.6f,  1.2f, 0.f); flashMesh.color(a, a, a);
        flashMesh.vertex( 1.6f,  1.2f, 0.f); flashMesh.color(a, a, a);
        --pluckFlashCounter;
      }
    }

    void onDraw(Graphics& g) override {
      g.clear(0.04f, 0.05f, 0.07f);
      g.meshColor();
      g.draw(flashMesh);
      g.draw(gridMesh);
      g.draw(pluckLineMesh);
      g.draw(rightStrip);
      g.draw(leftStrip);
      g.draw(sumStrip);
      g.draw(peakMarkers);
      g.draw(pickupMarker);
      gui.draw(g);
    }

    static int noteFromKey(int key) {
      static const int kbd[] = {
        'Z',48,'X',50,'C',52,'V',53,'B',55,'N',57,'M',59,
        'A',60,'S',62,'D',64,'F',65,'G',67,'H',69,'J',71,
        'Q',72,'W',74,'E',76,'R',77,'T',79,'Y',81,'U',83
      };
      for (int i = 0; i < 21; ++i) {
        const int K = kbd[i*2];
        if (key == K || key == K + 32) return kbd[i*2 + 1];
      }
      return -1;
    }
    bool onKeyDown(const Keyboard& k) override {
      const int n = noteFromKey(k.key());
      if (n >= 0) {
        pitch_hz.set(440.0f * std::pow(2.0f, (n - 69) / 12.0f));
        pluck.set(1.0f);
      }
      return true;
    }
  };

  ALLOLIB_WEB_MAIN(WaveguideString)
  `,
  },
  {
    id: 'mat-subtractive',
    title: 'Subtractive Synth — Saw + Resonant Filter',
    description:
      "Classic subtractive synthesis: a sawtooth oscillator whose harmonics are sculpted by a resonant lowpass biquad, with two ADSR envelopes — one shaping amplitude, the other sweeping the filter cutoff for that signature 'wah' motion. Visualization plots the filter's true RBJ-cookbook biquad poles (analytic roots of the denominator) and zeros at z=-1 on the complex z-plane above a live magnitude spectrum, with a sliding cutoff line and log-Hz tick marks at 100 Hz / 1 kHz / 10 kHz so the harmonic carving lines up with the real cutoff frequency. A soft tanh limiter on the output keeps the resonant ringing musical instead of self-oscillating into clipping.",
    category: 'mat-synthesis',
    subcategory: 'subtractive',
    code: `/**
   * Subtractive Synth — Saw + Resonant Filter — MAT200B Phase 2
   *
   * Source -> filter -> amp envelope is the textbook subtractive
   * voice. A sawtooth is harmonically dense (1/k spectrum), a
   * resonant lowpass biquad carves a band, and an ADSR shapes
   * amplitude. A second ADSR with its own depth ('env_amount') is
   * summed into the filter cutoff for the classic synth-bass sweep.
   *
   * Visualization (top): z-plane unit circle with the EXACT analytic
   * RBJ-cookbook poles of a resonant lowpass biquad:
   *     w0 = 2*pi*fc/sr,   alpha = sin(w0)/(2Q)
   *     a0 = 1+alpha,  a1 = -2cos(w0)/a0,  a2 = (1-alpha)/a0
   *     pole = (-a1 +/- sqrt(a1^2 - 4*a2)) / 2
   * For the resonant case the discriminant is negative; |pole| = sqrt(a2)
   * and theta = atan2(sqrt(-disc)/2, -a1/2). Zeros sit at z=-1 (double).
   *
   * Visualization (bottom): 256-pt Hann-windowed inline DFT of the
   * output, with log-spaced tick marks at 100 Hz, 1 kHz, 10 kHz and a
   * sliding vertical line at the live (envelope-modulated) cutoff so
   * the spectral notch lines up with the real cutoff in real time.
   *
   * Output: tanh-limited at 1.2x to keep self-oscillation musical.
   */

  #include "al_playground_compat.hpp"
  #include "Gamma/Filter.h"
  #include "Gamma/Envelope.h"
  #include "Gamma/Oscillator.h"

  #include <array>
  #include <atomic>
  #include <cmath>

  #ifndef M_PI
  #define M_PI 3.14159265358979323846
  #endif

  using namespace al;

  class Subtractive : public App {
  public:
  ParameterBool playing {"playing", "", true};
  Parameter pitch_hz   {"pitch_hz",   "",  110.0f,  40.0f, 1200.0f};
  Parameter cutoff_hz  {"cutoff_hz",  "", 1200.0f,  50.0f,12000.0f};
  Parameter resonance  {"resonance",  "",    4.0f,   0.5f,   15.0f};
  Parameter env_amount {"env_amount", "", 1500.0f,   0.0f, 6000.0f};
  Parameter attack_ms  {"attack_ms",  "",    5.0f,   1.0f, 1000.0f};
  Parameter decay_ms   {"decay_ms",   "",  250.0f,  10.0f, 2000.0f};
  Parameter sustain    {"sustain",    "",    0.5f,   0.0f,    1.0f};
  Parameter release_ms {"release_ms", "",  500.0f,  10.0f, 3000.0f};
  Parameter amp        {"amplitude",  "",   0.20f,   0.0f,    1.0f};
  Trigger   noteOn     {"noteOn",     ""};
  Trigger   noteOff    {"noteOff",    ""};

  ControlGUI gui;

  gam::Saw<>    saw;
  gam::Biquad<> lpf;
  gam::Env<3>   ampEnv;
  gam::Env<3>   cutEnv;

  std::atomic<int> noteOnPending{0};
  std::atomic<int> noteOffPending{0};

  std::atomic<float> cutEnvViz{0.f};
  std::atomic<float> sampleRateHz{48000.f};

  static constexpr int N = 256;
  std::array<float, N> blockBuf{};
  std::atomic<int> blockW{0};

  Mesh spectrum, gridMesh, unitCircle, poleMesh, zeroMesh, cutoffLine, tickMesh;

  void onInit() override {
    gui << playing << pitch_hz << cutoff_hz << resonance << env_amount
        << attack_ms << decay_ms << sustain << release_ms << amp
        << noteOn << noteOff;

    noteOn.registerChangeCallback([this](float) {
      noteOnPending.store(1, std::memory_order_release);
    });
    noteOff.registerChangeCallback([this](float) {
      noteOffPending.store(1, std::memory_order_release);
    });

    ampEnv.levels(0.f, 1.f, sustain.get(), 0.f);
    ampEnv.sustainPoint(2);
    cutEnv.levels(0.f, 1.f, sustain.get(), 0.f);
    cutEnv.sustainPoint(2);

    lpf.type(gam::LOW_PASS);
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
  }

  void onSound(AudioIOData& io) override {
    if (!playing.get()) {
      while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
      return;
    }
    const float sr = io.framesPerSecond();
    sampleRateHz.store(sr, std::memory_order_relaxed);

    ampEnv.lengths()[0] = attack_ms.get()  / 1000.f;
    ampEnv.lengths()[1] = decay_ms.get()   / 1000.f;
    ampEnv.lengths()[2] = release_ms.get() / 1000.f;
    ampEnv.levels()[2]  = sustain.get();
    cutEnv.lengths()[0] = attack_ms.get()  / 1000.f;
    cutEnv.lengths()[1] = decay_ms.get()   / 1000.f;
    cutEnv.lengths()[2] = release_ms.get() / 1000.f;
    cutEnv.levels()[2]  = sustain.get();

    if (noteOnPending.exchange(0, std::memory_order_acquire)) {
      ampEnv.reset();
      cutEnv.reset();
    }
    if (noteOffPending.exchange(0, std::memory_order_acquire)) {
      ampEnv.release();
      cutEnv.release();
    }

    saw.freq(pitch_hz.get());
    const float baseFc  = cutoff_hz.get();
    const float envAmt  = env_amount.get();
    const float Q       = resonance.get();
    const float gain    = amp.get();

    while (io()) {
      const float ce = cutEnv();
      const float fc = std::min(0.49f * sr,
                                std::max(20.f, baseFc + envAmt * ce));
      lpf.set(fc, Q);

      const float src = saw();
      const float filt = lpf(src);
      const float ae   = ampEnv();
      const float y    = filt * ae * gain;

      // Soft tanh limiter — keeps high-Q self-oscillation musical
      // instead of clipping/exploding when resonance is cranked.
      const float yLim = std::tanh(y * 1.2f);
      io.out(0) = yLim;
      io.out(1) = yLim;

      const int w = blockW.load(std::memory_order_relaxed);
      blockBuf[w] = yLim;
      blockW.store((w + 1) % N, std::memory_order_release);
    }

    cutEnvViz.store(cutEnv.value(), std::memory_order_relaxed);
  }

  void computeSpectrum(std::array<float, N / 2>& mag) {
    const int w = blockW.load(std::memory_order_acquire);
    std::array<float, N> x{};
    for (int i = 0; i < N; ++i) {
      const int idx = (w + i) % N;
      const float win = 0.5f * (1.0f - std::cos(2.0f * static_cast<float>(M_PI) * i / (N - 1)));
      x[i] = blockBuf[idx] * win;
    }
    for (int k = 0; k < N / 2; ++k) {
      float re = 0.f, im = 0.f;
      const float ang = -2.0f * static_cast<float>(M_PI) * k / N;
      for (int n = 0; n < N; ++n) {
        re += x[n] * std::cos(ang * n);
        im += x[n] * std::sin(ang * n);
      }
      mag[k] = std::sqrt(re * re + im * im) * (2.0f / N);
    }
  }

  void addDiscDots(Mesh& m, float cx, float cy, float radius,
                   float r, float gC, float b) {
    constexpr int SEG = 12;
    for (int i = 0; i < SEG; ++i) {
      const float a0 = 2.0f * static_cast<float>(M_PI) * i       / SEG;
      const float a1 = 2.0f * static_cast<float>(M_PI) * (i + 1) / SEG;
      m.vertex(cx, cy, 0.f);
      m.vertex(cx + radius * std::cos(a0), cy + radius * std::sin(a0), 0.f);
      m.vertex(cx + radius * std::cos(a1), cy + radius * std::sin(a1), 0.f);
      m.color(r, gC, b); m.color(r, gC, b); m.color(r, gC, b);
    }
  }

  void onAnimate(double /*dt*/) override {
    const float sr   = sampleRateHz.load(std::memory_order_relaxed);
    const float Q    = std::max(0.5f, resonance.get());
    const float ce   = cutEnvViz.load(std::memory_order_relaxed);
    const float nyq  = 0.5f * sr;
    const float fc   = std::min(0.49f * sr,
                       std::max(20.f, cutoff_hz.get() + env_amount.get() * ce));

    constexpr float CX = 0.0f;
    constexpr float CY = 0.55f;
    constexpr float R  = 0.45f;

    unitCircle.reset();
    unitCircle.primitive(Mesh::LINE_STRIP);
    constexpr int CSEG = 64;
    for (int i = 0; i <= CSEG; ++i) {
      const float a = 2.0f * static_cast<float>(M_PI) * i / CSEG;
      unitCircle.vertex(CX + R * std::cos(a), CY + R * std::sin(a), 0.f);
      unitCircle.color(0.45f, 0.45f, 0.55f);
    }

    // ---- RBJ cookbook biquad LP poles (analytic) ----
    const float w0    = 2.0f * static_cast<float>(M_PI) * fc / sr;
    const float alpha = std::sin(w0) / (2.0f * Q);
    const float a0    = 1.0f + alpha;
    const float a1    = -2.0f * std::cos(w0) / a0;
    const float a2    = (1.0f - alpha) / a0;
    // Roots of z^2 + a1 z + a2 = 0
    const float disc  = a1 * a1 - 4.0f * a2;
    float poleR, poleTheta;
    if (disc < 0.0f) {
      poleR     = std::sqrt(std::max(0.0f, a2));
      poleTheta = std::atan2(std::sqrt(-disc) * 0.5f, -a1 * 0.5f);
    } else {
      // Real poles fallback (low-Q corner) — use larger-magnitude root.
      const float s = std::sqrt(disc);
      const float r1 = (-a1 + s) * 0.5f;
      const float r2 = (-a1 - s) * 0.5f;
      poleR     = std::max(std::fabs(r1), std::fabs(r2));
      poleTheta = (std::fabs(r1) > std::fabs(r2)) ? (r1 < 0 ? static_cast<float>(M_PI) : 0.f)
                                                  : (r2 < 0 ? static_cast<float>(M_PI) : 0.f);
    }
    poleR = std::min(0.999f, poleR);

    poleMesh.reset();
    poleMesh.primitive(Mesh::TRIANGLES);
    addDiscDots(poleMesh,
            CX + R * poleR * std::cos(poleTheta),
            CY + R * poleR * std::sin(poleTheta),
            0.035f, 0.95f, 0.55f, 0.35f);
    addDiscDots(poleMesh,
            CX + R * poleR * std::cos(-poleTheta),
            CY + R * poleR * std::sin(-poleTheta),
            0.035f, 0.95f, 0.55f, 0.35f);

    zeroMesh.reset();
    zeroMesh.primitive(Mesh::TRIANGLES);
    addDiscDots(zeroMesh, CX - R, CY, 0.030f, 0.30f, 0.85f, 0.95f);

    // ---- Spectrum ----
    std::array<float, N / 2> mag{};
    computeSpectrum(mag);

    spectrum.reset();
    spectrum.primitive(Mesh::LINE_STRIP);
    for (int k = 0; k < N / 2; ++k) {
      const float xx = -1.4f + (static_cast<float>(k) / (N / 2 - 1)) * 2.8f;
      const float h  = std::min(0.95f, mag[k] * 6.0f);
      spectrum.vertex(xx, -1.05f + h, 0.f);
      const float t = static_cast<float>(k) / (N / 2);
      spectrum.color(0.55f + 0.35f * t, 0.45f + 0.45f * t, 0.95f - 0.3f * t);
    }

    // ---- Live cutoff line on spectrum: linear k = fc/nyquist mapping ----
    cutoffLine.reset();
    cutoffLine.primitive(Mesh::LINES);
    const float fcRel = std::min(1.0f, std::max(0.0f, fc / nyq));
    const float fcX   = -1.4f + fcRel * 2.8f;
    cutoffLine.vertex(fcX, -1.05f, 0.f);
    cutoffLine.vertex(fcX, -0.10f, 0.f);
    cutoffLine.color(1.0f, 0.85f, 0.30f);
    cutoffLine.color(1.0f, 0.85f, 0.30f);

    // ---- Log-Hz tick marks at 100 Hz, 1 kHz, 10 kHz ----
    tickMesh.reset();
    tickMesh.primitive(Mesh::TRIANGLES);
    const float tickFreqs[3] = {100.0f, 1000.0f, 10000.0f};
    for (int t = 0; t < 3; ++t) {
      const float f = tickFreqs[t];
      if (f >= nyq) continue;
      const float fr = f / nyq;
      const float x  = -1.4f + fr * 2.8f;
      const float h  = 0.025f;
      const float w  = 0.012f;
      // Small upward triangle sitting on the spectrum baseline.
      tickMesh.vertex(x - w, -1.08f, 0.f);
      tickMesh.vertex(x + w, -1.08f, 0.f);
      tickMesh.vertex(x,     -1.08f + h, 0.f);
      tickMesh.color(0.65f, 0.65f, 0.75f);
      tickMesh.color(0.65f, 0.65f, 0.75f);
      tickMesh.color(0.65f, 0.65f, 0.75f);
    }

    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    gridMesh.vertex(CX - R - 0.05f, CY, 0.f);
    gridMesh.vertex(CX + R + 0.05f, CY, 0.f);
    gridMesh.vertex(CX, CY - R - 0.05f, 0.f);
    gridMesh.vertex(CX, CY + R + 0.05f, 0.f);
    gridMesh.vertex(-1.4f, -1.05f, 0.f);
    gridMesh.vertex( 1.4f, -1.05f, 0.f);
    for (int k = 0; k < 6; ++k) gridMesh.color(0.22f, 0.22f, 0.28f);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.04f, 0.08f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(unitCircle);
    g.draw(zeroMesh);
    g.draw(poleMesh);
    g.draw(spectrum);
    g.draw(cutoffLine);
    g.draw(tickMesh);
    gui.draw(g);
  }

  bool onMouseDown(const Mouse&) override { return false; }
  bool onMouseDrag(const Mouse&) override { return false; }
  bool onMouseUp  (const Mouse&) override { return false; }

  // Musical keyboard: ZXCVBNM = C3..B3, ASDFGHJ = C4..B4, QWERTYU = C5..B5.
  static int noteFromKey(int key) {
    static const int kbd[] = {
      'Z',48,'X',50,'C',52,'V',53,'B',55,'N',57,'M',59,
      'A',60,'S',62,'D',64,'F',65,'G',67,'H',69,'J',71,
      'Q',72,'W',74,'E',76,'R',77,'T',79,'Y',81,'U',83
    };
    for (int i = 0; i < 21; ++i) {
      const int K = kbd[i*2];
      if (key == K || key == K + 32) return kbd[i*2 + 1];
    }
    return -1;
  }
  static float freqFromMidi(int n) {
    return 440.0f * std::pow(2.0f, (n - 69) / 12.0f);
  }
  bool onKeyDown(const Keyboard& k) override {
    const int n = noteFromKey(k.key());
    if (n >= 0) {
      pitch_hz.set(freqFromMidi(n));
      noteOn.set(1.0f);
    }
    return true;
  }
  bool onKeyUp(const Keyboard& k) override {
    if (noteFromKey(k.key()) >= 0) noteOff.set(1.0f);
    return true;
  }
  };

  ALLOLIB_WEB_MAIN(Subtractive)
  `,
  },
  {
    id: 'mat-granular-cloud',
    title: 'Granular Cloud Visualizer',
    description:
      'Granular synthesis lab fed by a bundled CC0 loop. Each grain reads a Hann-windowed slice of the source at a randomized position and pitch shift. Visualization plots every active grain as a glowing dot in (current source position x semitone) space — pitch-shifted dots drift visibly faster or slower than unpitched ones because dot X = the grain\\u2019s CURRENT playhead, not its spawn position. Dot SIZE breathes with the Hann envelope amplitude. A faint horizontal source-envelope strip across the top maps each X coordinate back to the underlying audio. Density compensation (Parseval-style 1/sqrt(density*grainMs)) keeps level constant as overlap grows.',
    category: 'mat-synthesis',
    subcategory: 'granular',
    code: `/**
   * Granular Cloud Visualizer — MAT200B granular synthesis (v0.13.x upgrade)
   *
   * Streams a bundled CC0 loop through a fixed-size pool of 32 grains.
   * Each grain has a Hann envelope, randomized start position, pitch
   * shift, and pan; advances by srcSR/hostSR per output sample.
   *
   * Upgrades:
   *   - Density compensation: divide output by sqrt(density_hz * grain_ms*1e-3)
   *     (Parseval-style; same pattern mat-granul-stretch uses) so density
   *     1->50 Hz at 80 ms doesn't 4x the level.
   *   - Grain dots TRAVEL: dot X = current grain playhead in source, not
   *     just spawn position. Pitch-shifted grains have visible non-flat
   *     drift slope, making pitch-vs-time decoupling obvious.
   *   - Dot SIZE = current Hann envelope amplitude. Cloud breathes.
   *   - Faint horizontal source-envelope strip across the top with a
   *     gold centerPos marker, linking the scatter X axis to the audio.
   */

  #include "al_playground_compat.hpp"
  #include "al_WebSamplePlayer.hpp"

  #include <array>
  #include <atomic>
  #include <cmath>
  #include <cstdlib>
  #include <vector>

  #ifndef M_PI
  #define M_PI 3.14159265358979323846
  #endif

  using namespace al;

  class GranularCloud : public App {
  public:
    ParameterMenu source         {"source",          ""};
    ParameterBool playing        {"playing",         "", true};
    Parameter     density_hz     {"density_hz",      "",  8.0f,  1.0f,  50.0f};
    Parameter     grain_ms       {"grain_ms",        "", 80.0f, 10.0f, 500.0f};
    Parameter     position_spread{"position_spread", "",  0.30f, 0.0f,   1.0f};
    Parameter     centerPos      {"centerPos",       "",  0.30f, 0.0f,   1.0f};
    Parameter     pitch_spread   {"pitch_spread",    "",  4.0f,  0.0f,  12.0f};
    Parameter     pan_spread     {"pan_spread",      "",  0.60f, 0.0f,   1.0f};
    Parameter     amp            {"amp",             "",  0.40f, 0.0f,   1.0f};

    ControlGUI gui;

    WebSamplePlayer drums, pad, mixed;
    WebSamplePlayer* current = &drums;

    static constexpr int MAX_GRAINS = 32;

    struct Grain {
      bool   active     = false;
      int    startFrame = 0;
      double curFrame   = 0.0;
      float  pitchRatio = 1.f;
      int    dur        = 1;
      int    age        = 0;
      float  pan        = 0.f;
      float  semitones  = 0.f;
    };
    std::array<Grain, MAX_GRAINS> grains{};

    struct GrainSnap {
      bool  active;
      float curNorm;     // current playhead, normalized 0..1
      float semitones;
      float ageNorm;     // 0..1
      float envAmp;      // Hann envelope at this age
    };
    std::array<GrainSnap, MAX_GRAINS> snap{};
    std::atomic<int> snapPublish{0};

    // Source envelope strip (top-of-canvas) — built once on source change.
    static constexpr int kEnvBins = 256;
    std::vector<float> envMin, envMax;
    int envSourceIdx = -1;

    static float frand(float lo, float hi) {
      const float u = static_cast<float>(std::rand()) / static_cast<float>(RAND_MAX);
      return lo + u * (hi - lo);
    }

    Mesh cloudMesh, gridMesh, bandMesh, envStripMesh;

    void onInit() override {
      source.setElements({"drums", "pad", "mixed"});
      source.set(0);

      gui << source << playing << density_hz << grain_ms << position_spread
          << centerPos << pitch_spread << pan_spread << amp;

      source.registerChangeCallback([this](float v) {
        switch (static_cast<int>(v)) {
          case 0: current = &drums; break;
          case 1: current = &pad;   break;
          case 2: current = &mixed; break;
        }
        for (auto& g : grains) g.active = false;
        envSourceIdx = -1;
      });
    }

    void onCreate() override {
      gui.init();
      drums.load("drum_loop_120bpm.wav");
      pad.load("pad_loop.wav");
      mixed.load("mixed_loop.wav");
      nav().pos(0, 0, 4.0f);
    }

    int allocGrain() {
      for (int i = 0; i < MAX_GRAINS; ++i) {
        if (!grains[i].active) return i;
      }
      return -1;
    }

    void buildEnvelopeStrip(WebSamplePlayer* sp) {
      envMin.assign(kEnvBins, 0.0f);
      envMax.assign(kEnvBins, 0.0f);
      if (!sp || !sp->ready()) return;
      const int frames = sp->frames();
      if (frames <= 0) return;
      const int per = std::max(1, frames / kEnvBins);
      for (int b = 0; b < kEnvBins; ++b) {
        const int s0 = (b * frames) / kEnvBins;
        const int s1 = std::min(frames, s0 + per);
        float lo = 1.0f, hi = -1.0f;
        for (int i = s0; i < s1; ++i) {
          const float v = sp->readInterp(0, static_cast<float>(i));
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        if (lo > hi) { lo = 0.f; hi = 0.f; }
        envMin[b] = lo;
        envMax[b] = hi;
      }
    }

    void onSound(AudioIOData& io) override {
      if (!playing.get() || !current || !current->ready()) {
        while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
        return;
      }
      const float  sr        = io.framesPerSecond();
      const float  srcSR     = current->sampleRate() > 1.f ? current->sampleRate() : sr;
      const double rateRatio = static_cast<double>(srcSR) / static_cast<double>(sr);
      const int    nFrames   = current->frames();
      if (nFrames <= 1) {
        while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
        return;
      }

      const float density = density_hz.get();
      const float gMs     = grain_ms.get();
      const float posSpr  = position_spread.get();
      const float ctr     = centerPos.get();
      const float pSpr    = pitch_spread.get();
      const float panSpr  = pan_spread.get();
      const float gain    = amp.get();
      const float pSpawn  = density / sr;
      const int   gDur    = std::max(1, static_cast<int>(gMs * 0.001f * sr));

      // Density compensation (Parseval-style).
      const float densNorm = 1.0f / std::sqrt(std::max(1.0f, density * gMs * 0.001f));

      while (io()) {
        if (frand(0.f, 1.f) < pSpawn) {
          const int slot = allocGrain();
          if (slot >= 0) {
            Grain& gr = grains[slot];
            const float posNorm = std::min(0.999f, std::max(0.f,
                ctr + frand(-posSpr, +posSpr)));
            const float st = frand(-pSpr, +pSpr);
            gr.active     = true;
            gr.startFrame = static_cast<int>(posNorm * (nFrames - 1));
            gr.curFrame   = static_cast<double>(gr.startFrame);
            gr.pitchRatio = std::pow(2.0f, st / 12.0f);
            gr.dur        = gDur;
            gr.age        = 0;
            gr.pan        = frand(-panSpr, +panSpr);
            gr.semitones  = st;
          }
        }

        float outL = 0.f, outR = 0.f;
        for (auto& gr : grains) {
          if (!gr.active) continue;
          const float in = current->readInterp(0, static_cast<float>(gr.curFrame));
          const float t = static_cast<float>(gr.age) / static_cast<float>(gr.dur);
          const float w = 0.5f * (1.0f - std::cos(2.0f * static_cast<float>(M_PI) * t));
          const float v = in * w;
          const float panAng = (gr.pan + 1.0f) * 0.25f * static_cast<float>(M_PI);
          outL += v * std::cos(panAng);
          outR += v * std::sin(panAng);
          gr.curFrame += static_cast<double>(gr.pitchRatio) * rateRatio;
          if (gr.curFrame >= nFrames) gr.curFrame -= nFrames;
          if (gr.curFrame < 0)        gr.curFrame += nFrames;
          ++gr.age;
          if (gr.age >= gr.dur) gr.active = false;
        }

        io.out(0) = outL * gain * densNorm;
        io.out(1) = outR * gain * densNorm;
      }

      for (int i = 0; i < MAX_GRAINS; ++i) {
        const Grain& gr = grains[i];
        GrainSnap& s = snap[i];
        s.active   = gr.active;
        s.curNorm  = (nFrames > 1)
            ? static_cast<float>(gr.curFrame) / static_cast<float>(nFrames - 1)
            : 0.f;
        s.semitones = gr.semitones;
        const float t = (gr.dur > 0)
            ? std::min(1.0f, static_cast<float>(gr.age) / static_cast<float>(gr.dur))
            : 1.f;
        s.ageNorm = t;
        s.envAmp  = 0.5f * (1.0f - std::cos(2.0f * static_cast<float>(M_PI) * t));
      }
      snapPublish.fetch_add(1, std::memory_order_release);
    }

    static float startToX(float startNorm) {
      return -1.4f + startNorm * 2.8f;
    }
    static float semiToY(float st) {
      return -1.0f + (st + 12.0f) / 24.0f * 2.0f;
    }

    // Inline disc emitter — TRIANGLES fan centred at (cx,cy).
    static void emitDisc(Mesh& m, float cx, float cy, float radius, int segs,
                         float r, float gC, float b) {
      for (int i = 0; i < segs; ++i) {
        const float a0 = 2.0f * static_cast<float>(M_PI) * i       / segs;
        const float a1 = 2.0f * static_cast<float>(M_PI) * (i + 1) / segs;
        m.vertex(cx, cy, 0.f);
        m.vertex(cx + radius * std::cos(a0), cy + radius * std::sin(a0), 0.f);
        m.vertex(cx + radius * std::cos(a1), cy + radius * std::sin(a1), 0.f);
        m.color(r, gC, b); m.color(r, gC, b); m.color(r, gC, b);
      }
    }

    void onAnimate(double /*dt*/) override {
      (void)snapPublish.load(std::memory_order_acquire);

      // Rebuild source envelope strip if the source changed.
      const int sIdx = static_cast<int>(source.get());
      if (sIdx != envSourceIdx && current && current->ready()) {
        buildEnvelopeStrip(current);
        envSourceIdx = sIdx;
      }

      gridMesh.reset();
      gridMesh.primitive(Mesh::LINES);
      gridMesh.vertex(-1.4f, semiToY(0.f), 0.f);
      gridMesh.vertex( 1.4f, semiToY(0.f), 0.f);
      gridMesh.color(0.55f, 0.55f, 0.55f);
      gridMesh.color(0.55f, 0.55f, 0.55f);
      for (int st = -12; st <= 12; st += 6) {
        if (st == 0) continue;
        gridMesh.vertex(-1.4f, semiToY(static_cast<float>(st)), 0.f);
        gridMesh.vertex( 1.4f, semiToY(static_cast<float>(st)), 0.f);
        gridMesh.color(0.18f, 0.18f, 0.22f);
        gridMesh.color(0.18f, 0.18f, 0.22f);
      }
      gridMesh.vertex(-1.4f, -1.0f, 0.f); gridMesh.vertex(1.4f, -1.0f, 0.f);
      gridMesh.vertex(-1.4f,  1.0f, 0.f); gridMesh.vertex(1.4f,  1.0f, 0.f);
      for (int k = 0; k < 4; ++k) gridMesh.color(0.25f, 0.25f, 0.30f);

      bandMesh.reset();
      bandMesh.primitive(Mesh::LINES);
      const float ctr   = centerPos.get();
      const float spr   = position_spread.get();
      auto clamp01 = [](float v) { return v < 0.f ? 0.f : (v > 1.f ? 1.f : v); };
      const float xL    = startToX(clamp01(ctr - spr));
      const float xC    = startToX(clamp01(ctr));
      const float xR    = startToX(clamp01(ctr + spr));
      auto vline = [&](float x, float r, float gg, float b) {
        bandMesh.vertex(x, -1.0f, 0.f);
        bandMesh.vertex(x,  1.0f, 0.f);
        bandMesh.color(r, gg, b);
        bandMesh.color(r, gg, b);
      };
      vline(xL, 0.40f, 0.65f, 0.90f);
      vline(xC, 0.95f, 0.95f, 0.45f);
      vline(xR, 0.40f, 0.65f, 0.90f);

      // Faint horizontal source-envelope strip across the top.
      envStripMesh.reset();
      envStripMesh.primitive(Mesh::LINES);
      if (static_cast<int>(envMin.size()) == kEnvBins) {
        const float stripY  = 1.20f;
        const float stripH  = 0.12f;
        for (int i = 0; i < kEnvBins; ++i) {
          const float xx = -1.4f + (static_cast<float>(i) / (kEnvBins - 1)) * 2.8f;
          envStripMesh.vertex(xx, stripY + envMin[i] * stripH, 0.f);
          envStripMesh.color(0.35f, 0.50f, 0.65f);
          envStripMesh.vertex(xx, stripY + envMax[i] * stripH, 0.f);
          envStripMesh.color(0.35f, 0.50f, 0.65f);
        }
        // Vertical centerPos marker on the strip (gold).
        const float cx = startToX(clamp01(ctr));
        envStripMesh.vertex(cx, stripY - stripH * 1.3f, 0.f);
        envStripMesh.color(0.95f, 0.80f, 0.25f);
        envStripMesh.vertex(cx, stripY + stripH * 1.3f, 0.f);
        envStripMesh.color(0.95f, 0.80f, 0.25f);
      }

      cloudMesh.reset();
      cloudMesh.primitive(Mesh::TRIANGLES);
      for (int i = 0; i < MAX_GRAINS; ++i) {
        const GrainSnap& s = snap[i];
        if (!s.active) continue;
        // Dots TRAVEL: x = current playhead position, not just spawn.
        const float px = startToX(s.curNorm);
        const float py = semiToY(s.semitones);
        const float bright = std::max(0.0f, 1.0f - s.ageNorm);
        const float r  = 0.20f + 0.80f * bright;
        const float gC = 0.10f + 0.85f * bright * bright;
        const float b  = 0.05f + 0.40f * bright * bright * bright;
        // Dot SIZE = current Hann envelope amplitude (breathes).
        const float radius = 0.012f + 0.045f * s.envAmp;
        emitDisc(cloudMesh, px, py, radius, 14, r, gC, b);
      }
    }

    void onDraw(Graphics& g) override {
      g.clear(0.04f, 0.04f, 0.07f);
      g.meshColor();
      g.draw(gridMesh);
      g.draw(envStripMesh);
      g.draw(bandMesh);
      g.draw(cloudMesh);
      gui.draw(g);
    }

    bool onMouseDown(const Mouse& /*m*/) override { return false; }
    bool onMouseDrag(const Mouse& /*m*/) override { return false; }
    bool onMouseUp  (const Mouse& /*m*/) override { return false; }
  };

  ALLOLIB_WEB_MAIN(GranularCloud)
  `,
  },
  {
    id: 'mat-multiscale-stems',
    title: 'Multiscale Stem Visualizer',
    description: 'Play a bundled loop and visualize it at three simultaneous time scales (full loop overview, ~1s medium window, ~10ms short window) with per-scale dB-RMS meters, color-framed waveform panels, dB tick markers, a full-height playhead, yellow zoom brackets on the overview, and a phase-heatmap strip that shows where loud transients live in the loop.',
    category: 'mat-mixing',
    subcategory: 'stems',
    code: `/**
   * Multiscale Stem Visualizer
   *
   * Plays one of three bundled loops (drums, pad, mixed) and renders the
   * audio simultaneously at three time scales stacked vertically:
   *
   *   1. Top    : full-loop overview (downsampled min/max envelope, 256
   *               columns) with yellow brackets indicating the medium and
   *               short zoom windows.
   *   2. Middle : medium-zoom window of the last ~zoom_med_ms ms.
   *   3. Bottom : live ~zoom_short_ms ms window.
   *   4. Strip  : phase heatmap — 256 columns coloured by the short-tau
   *               RMS captured for each phase of the loop.
   *
   * Three one-pole RMS detectors (short / medium / long taus) drive
   * dB meters pinned to the right edge, with -60 / -30 / 0 dB tick
   * markers next to each meter. A white playhead spans the full canvas
   * height across all three rows. Each waveform row is color-framed to
   * match its meter (cyan / amber / pink).
   */
  #include "al_playground_compat.hpp"
  #include "al_WebSamplePlayer.hpp"
  #include <array>
  #include <vector>
  #include <cmath>
  #include <cstring>

  using namespace al;

  static const int   kFullCols    = 256;
  static const int   kHeatCols    = 256;
  static const int   kShortRing   = 1024;
  static const int   kMedRing     = 72000;
  static const float kHostSR      = 48000.f;

  class MultiscaleStems : public App {
  public:
  ControlGUI gui;

  ParameterMenu source{"source"};
  ParameterBool playing{"playing", "", true};
  Parameter amp{"amp", "", 0.5f, 0.f, 1.f};
  Parameter zoom_short_ms{"zoom_short_ms", "", 10.f, 1.f, 50.f};
  Parameter zoom_med_ms{"zoom_med_ms", "", 1000.f, 100.f, 3000.f};
  Trigger retrigger{"retrigger"};

  WebSamplePlayer pDrums, pPad, pMixed;
  WebSamplePlayer* current = nullptr;

  double playhead = 0.0;

  std::array<float, kShortRing> shortRing{};
  std::array<float, kMedRing>   medRing{};
  int shortW = 0;
  int medW   = 0;

  float rmsShort = 0.f, rmsMed = 0.f, rmsLong = 0.f;
  float coefShort = 0.f, coefMed = 0.f, coefLong = 0.f;

  // Phase heatmap: per-loop-phase peak short-RMS, decayed each pass.
  std::array<float, kHeatCols> heat{};

  std::vector<float> envMin, envMax;
  int cachedFrames = 0;

  Mesh mFull, mMed, mShort, mBars, mGrid, mPlayhead;
  Mesh mFrames, mTicks, mBrackets, mHeat;

  void onInit() override {
    source.setElements({"drums", "pad", "mixed"});
    gui << source << playing << amp << zoom_short_ms << zoom_med_ms << retrigger;

    source.registerChangeCallback([this](int v) {
      switch (v) {
        case 0: current = &pDrums; break;
        case 1: current = &pPad;   break;
        default: current = &pMixed; break;
      }
      playhead = 0.0;
      heat.fill(0.f);
      buildFullEnvelope();
    });

    retrigger.registerChangeCallback([this](float) {
      playhead = 0.0;
      heat.fill(0.f);
    });

    auto tauCoef = [](float tauSec) {
      return std::exp(-1.f / (tauSec * kHostSR));
    };
    coefShort = tauCoef(0.010f);
    coefMed   = tauCoef(0.300f);
    coefLong  = tauCoef(3.000f);
  }

  void onCreate() override {
    gui.init();
    pDrums.load("drum_loop_120bpm.wav");
    pPad.load("pad_loop.wav");
    pMixed.load("mixed_loop.wav");
    current = &pDrums;
    buildFullEnvelope();

    nav().pos(0, 0, 4);

    mFull.primitive(Mesh::TRIANGLE_STRIP);
    mMed.primitive(Mesh::LINE_STRIP);
    mShort.primitive(Mesh::LINE_STRIP);
    mBars.primitive(Mesh::TRIANGLES);
    mGrid.primitive(Mesh::LINES);
    mPlayhead.primitive(Mesh::LINES);
    mFrames.primitive(Mesh::TRIANGLES);
    mTicks.primitive(Mesh::TRIANGLES);
    mBrackets.primitive(Mesh::TRIANGLES);
    mHeat.primitive(Mesh::TRIANGLES);
  }

  void buildFullEnvelope() {
    envMin.assign(kFullCols, 0.f);
    envMax.assign(kFullCols, 0.f);
    if (!current) return;
    int frames = (int)current->frames();
    cachedFrames = frames;
    if (frames <= 0) return;
    int per = std::max(1, frames / kFullCols);
    for (int c = 0; c < kFullCols; ++c) {
      int start = (c * frames) / kFullCols;
      int end   = std::min(frames, start + per);
      float lo = 1.f, hi = -1.f;
      for (int i = start; i < end; ++i) {
        float s = current->readInterp(0, (double)i);
        if (s < lo) lo = s;
        if (s > hi) hi = s;
      }
      if (lo > hi) { lo = 0.f; hi = 0.f; }
      envMin[c] = lo;
      envMax[c] = hi;
    }
  }

  void onSound(AudioIOData& io) override {
    float a = amp.get();
    if (!playing.get() || !current || current->frames() <= 0) {
      while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
      return;
    }
    double srcSR = current->sampleRate();
    double inc = srcSR / (double)kHostSR;
    int frames = (int)current->frames();

    while (io()) {
      float s = current->readInterp(0, playhead) * a;
      playhead += inc;
      if (playhead >= frames) playhead -= frames;
      if (playhead < 0) playhead += frames;

      shortRing[(size_t)shortW] = s;
      shortW = (shortW + 1) % kShortRing;
      medRing[(size_t)medW] = s;
      medW = (medW + 1) % kMedRing;

      float ax = std::fabs(s);
      rmsShort = (1.f - coefShort) * ax + coefShort * rmsShort;
      rmsMed   = (1.f - coefMed)   * ax + coefMed   * rmsMed;
      rmsLong  = (1.f - coefLong)  * ax + coefLong  * rmsLong;

      // Phase heatmap: write the current short-RMS into the bucket for
      // this playhead phase. Use peak-and-decay so loud transients stay
      // visible even after the playhead has passed.
      if (frames > 0) {
        int hi = (int)((playhead / (double)frames) * (double)kHeatCols);
        if (hi < 0) hi = 0;
        if (hi >= kHeatCols) hi = kHeatCols - 1;
        const float decay = 0.9995f; // very slow decay so heatmap accumulates
        heat[(size_t)hi] = std::max(rmsShort, heat[(size_t)hi] * decay);
      }

      io.out(0) = s;
      io.out(1) = s;
    }
  }

  void onAnimate(double) override {}

  static float dbMap(float lin) {
    float db = 20.f * std::log10(std::max(1e-6f, lin));
    float t = (db + 60.f) / 60.f;
    if (t < 0.f) t = 0.f;
    if (t > 1.f) t = 1.f;
    return t * 0.7f;
  }

  // Helper: emit a filled rectangle (TRIANGLES) into a mesh.
  static void rect(Mesh& m, float x0, float y0, float x1, float y1,
                   float r, float g, float b) {
    m.vertex(x0, y0, 0); m.color(r, g, b);
    m.vertex(x1, y0, 0); m.color(r, g, b);
    m.vertex(x1, y1, 0); m.color(r, g, b);
    m.vertex(x0, y0, 0); m.color(r, g, b);
    m.vertex(x1, y1, 0); m.color(r, g, b);
    m.vertex(x0, y1, 0); m.color(r, g, b);
  }

  // Helper: emit a hollow rectangle outline as 4 thin TRIANGLES strips.
  static void rectOutline(Mesh& m, float x0, float y0, float x1, float y1,
                          float thick, float r, float g, float b) {
    rect(m, x0, y1 - thick, x1, y1, r, g, b);                 // top
    rect(m, x0, y0, x1, y0 + thick, r, g, b);                 // bottom
    rect(m, x0, y0, x0 + thick, y1, r, g, b);                 // left
    rect(m, x1 - thick, y0, x1, y1, r, g, b);                 // right
  }

  void onDraw(Graphics& g) override {
    g.clear(0.06f, 0.07f, 0.09f);

    const float xL = -1.4f, xR = 1.25f;

    // ---- Grid lines ----
    mGrid.reset();
    mGrid.primitive(Mesh::LINES);
    auto hline = [&](float y, float r, float gG, float b){
      mGrid.vertex(xL, y, 0); mGrid.color(r, gG, b);
      mGrid.vertex(xR, y, 0); mGrid.color(r, gG, b);
    };
    hline(+1.35f, 0.3f, 0.3f, 0.35f);
    hline(+0.65f, 0.3f, 0.3f, 0.35f);
    hline(+0.55f, 0.3f, 0.3f, 0.35f);
    hline(-0.05f, 0.3f, 0.3f, 0.35f);
    hline(-0.15f, 0.3f, 0.3f, 0.35f);
    hline(-0.85f, 0.3f, 0.3f, 0.35f);
    auto zeroAxis = [&](float yc){
      mGrid.vertex(xL, yc, 0); mGrid.color(0.45f, 0.45f, 0.5f);
      mGrid.vertex(xR, yc, 0); mGrid.color(0.45f, 0.45f, 0.5f);
    };
    zeroAxis(+1.00f);
    zeroAxis(+0.25f);
    zeroAxis(-0.50f);
    g.meshColor();
    g.draw(mGrid);

    const float panelW = xR - xL;

    // ---- Top panel: full-loop envelope ----
    mFull.reset();
    mFull.primitive(Mesh::TRIANGLE_STRIP);
    if ((int)envMin.size() == kFullCols) {
      for (int c = 0; c < kFullCols; ++c) {
        float fx = xL + ((float)c / (float)(kFullCols - 1)) * panelW;
        float yMin = +1.00f + envMin[(size_t)c] * 0.33f;
        float yMax = +1.00f + envMax[(size_t)c] * 0.33f;
        mFull.vertex(fx, yMax, 0); mFull.color(0.45f, 0.85f, 1.0f);
        mFull.vertex(fx, yMin, 0); mFull.color(0.25f, 0.55f, 0.8f);
      }
    }
    g.draw(mFull);

    // ---- Yellow zoom brackets on the top panel ----
    // Bracket widths reflect (zoom_*_ms / loopMs) * panelW, centered
    // on the current playhead. They are filled with very faint fills
    // and outlined in the row colour underneath.
    mBrackets.reset();
    mBrackets.primitive(Mesh::TRIANGLES);
    if (cachedFrames > 0) {
      const double srcSR  = current ? current->sampleRate() : (double)kHostSR;
      const double loopMs = (srcSR > 1.0) ? (1000.0 * (double)cachedFrames / srcSR) : 0.0;
      if (loopMs > 1.0) {
        const float t = (float)(playhead / (double)cachedFrames);
        const float px = xL + t * panelW;
        const float topY0 = +0.68f, topY1 = +1.32f;

        // medium bracket (amber)
        const float wMed = (float)(((double)zoom_med_ms.get() / loopMs)) * panelW;
        const float halfMed = std::min(panelW * 0.5f, wMed * 0.5f);
        const float mx0 = std::max(xL, px - halfMed);
        const float mx1 = std::min(xR, px + halfMed);
        rect(mBrackets, mx0, topY0, mx1, topY1, 0.55f, 0.42f, 0.10f);
        rectOutline(mBrackets, mx0, topY0, mx1, topY1, 0.008f,
                    0.95f, 0.75f, 0.20f);

        // short bracket (pink)
        const float wShort = (float)(((double)zoom_short_ms.get() / loopMs)) * panelW;
        const float halfShort = std::min(panelW * 0.5f, wShort * 0.5f);
        const float sx0 = std::max(xL, px - halfShort);
        const float sx1 = std::min(xR, px + halfShort);
        rect(mBrackets, sx0, topY0, sx1, topY1, 0.55f, 0.20f, 0.30f);
        rectOutline(mBrackets, sx0, topY0, sx1, topY1, 0.008f,
                    1.00f, 0.55f, 0.60f);
      }
    }
    g.draw(mBrackets);

    // Re-draw the full envelope on top of the bracket fills so the
    // waveform stays legible.
    g.draw(mFull);

    // ---- Full-height playhead spanning all three rows ----
    mPlayhead.reset();
    mPlayhead.primitive(Mesh::LINES);
    if (cachedFrames > 0) {
      float t = (float)(playhead / (double)cachedFrames);
      float px = xL + t * panelW;
      mPlayhead.vertex(px, +1.32f, 0); mPlayhead.color(1.f, 1.f, 1.f);
      mPlayhead.vertex(px, -0.85f, 0); mPlayhead.color(1.f, 1.f, 1.f);
    }
    g.draw(mPlayhead);

    // ---- Middle panel: medium-zoom window ----
    mMed.reset();
    mMed.primitive(Mesh::LINE_STRIP);
    int medSamples = (int)((zoom_med_ms.get() / 1000.f) * kHostSR);
    if (medSamples < 2) medSamples = 2;
    if (medSamples > kMedRing) medSamples = kMedRing;
    int verts = 512;
    for (int i = 0; i < verts; ++i) {
      int offs = (int)((float)i / (float)(verts - 1) * (float)(medSamples - 1));
      int idx  = (medW - medSamples + offs) % kMedRing;
      if (idx < 0) idx += kMedRing;
      float s = medRing[(size_t)idx];
      float fx = xL + ((float)i / (float)(verts - 1)) * panelW;
      float fy = +0.25f + s * 0.28f;
      mMed.vertex(fx, fy, 0);
      mMed.color(0.9f, 0.7f, 0.4f);
    }
    g.draw(mMed);

    // ---- Bottom panel: short-zoom window ----
    mShort.reset();
    mShort.primitive(Mesh::LINE_STRIP);
    int shortSamples = (int)((zoom_short_ms.get() / 1000.f) * kHostSR);
    if (shortSamples < 2) shortSamples = 2;
    if (shortSamples > kShortRing) shortSamples = kShortRing;
    int sverts = std::min(512, shortSamples);
    for (int i = 0; i < sverts; ++i) {
      int offs = (int)((float)i / (float)(sverts - 1) * (float)(shortSamples - 1));
      int idx  = (shortW - shortSamples + offs) % kShortRing;
      if (idx < 0) idx += kShortRing;
      float s = shortRing[(size_t)idx];
      float fx = xL + ((float)i / (float)(sverts - 1)) * panelW;
      float fy = -0.50f + s * 0.32f;
      mShort.vertex(fx, fy, 0);
      mShort.color(1.0f, 0.55f, 0.6f);
    }
    g.draw(mShort);

    // ---- Color-framed outlines around each waveform row ----
    mFrames.reset();
    mFrames.primitive(Mesh::TRIANGLES);
    rectOutline(mFrames, xL, +0.68f, xR, +1.32f, 0.006f, 0.45f, 0.85f, 1.0f); // top
    rectOutline(mFrames, xL, -0.05f, xR, +0.55f, 0.006f, 0.9f,  0.7f,  0.4f); // mid
    rectOutline(mFrames, xL, -0.85f, xR, -0.15f, 0.006f, 1.0f,  0.55f, 0.6f); // bot
    g.draw(mFrames);

    // ---- Phase heatmap strip (y in [-0.95, -0.90]) ----
    mHeat.reset();
    mHeat.primitive(Mesh::TRIANGLES);
    {
      const float hy0 = -0.95f, hy1 = -0.90f;
      // Find a per-frame max so the gradient breathes.
      float hMax = 1e-6f;
      for (int i = 0; i < kHeatCols; ++i) {
        if (heat[(size_t)i] > hMax) hMax = heat[(size_t)i];
      }
      for (int c = 0; c < kHeatCols; ++c) {
        float fx0 = xL + ((float)c / (float)kHeatCols) * panelW;
        float fx1 = xL + ((float)(c + 1) / (float)kHeatCols) * panelW;
        float v = heat[(size_t)c] / hMax; // 0..1
        v = std::pow(std::min(1.f, std::max(0.f, v)), 0.5f);
        // cool -> warm gradient: blue (0,0.2,0.6) -> magenta (0.9,0.2,0.5) -> yellow (1,0.85,0.2)
        float r, gC, b;
        if (v < 0.5f) {
          float t = v * 2.f;
          r = 0.0f + t * 0.9f;
          gC = 0.2f + t * 0.0f;
          b = 0.6f + t * (-0.1f);
        } else {
          float t = (v - 0.5f) * 2.f;
          r = 0.9f + t * 0.1f;
          gC = 0.2f + t * 0.65f;
          b = 0.5f + t * (-0.3f);
        }
        rect(mHeat, fx0, hy0, fx1, hy1, r, gC, b);
      }
      // Thin neutral border so the strip has an edge.
      rectOutline(mHeat, xL, hy0, xR, hy1, 0.004f, 0.45f, 0.45f, 0.5f);
    }
    g.draw(mHeat);

    // ---- RMS bars + dB tick markers ----
    mBars.reset();
    mBars.primitive(Mesh::TRIANGLES);
    auto bar = [&](float cx, float yBase, float h, float r, float gC, float b){
      const float w = 0.06f;
      float x0 = cx - w * 0.5f, x1 = cx + w * 0.5f;
      float y0 = yBase, y1 = yBase + h;
      mBars.vertex(x0, y0, 0); mBars.color(r, gC, b);
      mBars.vertex(x1, y0, 0); mBars.color(r, gC, b);
      mBars.vertex(x1, y1, 0); mBars.color(r * 1.4f, gC * 1.4f, b * 1.4f);
      mBars.vertex(x0, y0, 0); mBars.color(r, gC, b);
      mBars.vertex(x1, y1, 0); mBars.color(r * 1.4f, gC * 1.4f, b * 1.4f);
      mBars.vertex(x0, y1, 0); mBars.color(r * 1.4f, gC * 1.4f, b * 1.4f);
    };
    // dbMap returns 0..0.7 for -60..0 dB. Each bar is at (cx, yBase, h<=0.7).
    // Pull bar centers in to x=1.20 so the right-side ticks at x=1.27 don't clip.
    const float meterX = 1.20f;
    bar(meterX, +0.65f, dbMap(rmsLong),  0.45f, 0.85f, 1.0f);
    bar(meterX, -0.05f, dbMap(rmsMed),   0.9f,  0.7f,  0.4f);
    bar(meterX, -0.85f, dbMap(rmsShort), 1.0f,  0.55f, 0.6f);
    g.draw(mBars);

    // dB tick markers at -60 / -30 / 0 dB next to each meter.
    mTicks.reset();
    mTicks.primitive(Mesh::TRIANGLES);
    auto meterTicks = [&](float yBase, float r, float gC, float b){
      // Ticks normalised to dbMap output: -60->0, -30->0.35, 0->0.70.
      const float tickX0 = meterX + 0.05f;
      const float tickX1 = tickX0 + 0.04f;   // 4mm-ish tick stub
      const float th = 0.006f;
      const float yMinus60 = yBase + 0.0f;
      const float yMinus30 = yBase + 0.35f;
      const float yZero    = yBase + 0.70f;
      rect(mTicks, tickX0, yMinus60 - th * 0.5f, tickX1, yMinus60 + th * 0.5f, r, gC, b);
      rect(mTicks, tickX0, yMinus30 - th * 0.5f, tickX1, yMinus30 + th * 0.5f, r, gC, b);
      rect(mTicks, tickX0, yZero    - th * 0.5f, tickX1, yZero    + th * 0.5f, r, gC, b);
      // Make the 0 dB tick slightly longer to mark the ceiling.
      rect(mTicks, tickX1, yZero - th * 0.5f, tickX1 + 0.02f, yZero + th * 0.5f, r, gC, b);
    };
    meterTicks(+0.65f, 0.45f, 0.85f, 1.0f);
    meterTicks(-0.05f, 0.9f,  0.7f,  0.4f);
    meterTicks(-0.85f, 1.0f,  0.55f, 0.6f);
    g.draw(mTicks);

    gui.draw(g);
  }

  bool onMouseDown(const Mouse&) override { return false; }
  bool onMouseDrag(const Mouse&) override { return false; }
  bool onMouseUp(const Mouse&)   override { return false; }
  };

  ALLOLIB_WEB_MAIN(MultiscaleStems)
  `,
  },
  {
    id: 'mat-mastering-ab',
    title: 'Mastering A/B with Diff Visuals',
    description:
      'Plays a bundled CC0 audio source through two parallel chains: A is the clean reference, B is a simple mastering stack (gain trim + tilt EQ + soft tanh saturation). Six source choices: short single-stem loops (drums, pad, mix) and three full 30-second mastering reference tracks (EDM, jazz, orchestral) so you can hear the EQ + saturation chain over a real arrangement. Toggle playB to A/B compare audibly with a 5-ms crossfade and an optional RMS loudness-match so the toggle judges timbre, not level. The visual stacks A on top, B in the middle, and the A-B difference as a filled red curve at the bottom, with a live overlaid log-x FFT spectrum panel comparing A vs B at the top-right.',
    category: 'mat-mixing',
    subcategory: 'mastering',
    code: `/**
   * Mastering A/B with Diff Visuals — MAT200B Phase 3
   *
   * A (reference) = source untouched. B (processed) = tilt EQ -> gain
   * trim -> soft tanh saturation. The 'playB' toggle picks which chain
   * is audible with a 5-ms crossfade. Optional 'loudness_match' applies
   * a slowly-smoothed RMS correction to B so toggling judges timbre,
   * not level.
   *
   * Visuals: A waveform (top, blue) + B waveform (middle, orange) +
   * |A-B| rectified difference (bottom, red TRIANGLE_STRIP fill, scaled
   * 4x with running RMS-of-diff tick) + RMS-diff bar with labeled scale
   * (+0 dB center, ±12 dB endcaps) + numeric value bar + animated A/B
   * badge that pulses on toggle + 256-bin FFT spectrum panel (top-right)
   * showing A vs B as overlaid log-x spectra with difference shaded.
   */

  #include "al_playground_compat.hpp"
  #include "al_WebSamplePlayer.hpp"
  #include "Gamma/Filter.h"

  #include <array>
  #include <atomic>
  #include <cmath>
  #include <algorithm>

  #ifndef M_PI
  #define M_PI 3.14159265358979323846
  #endif

  using namespace al;

  class MasteringAB : public App {
  public:
    ParameterMenu source         {"source",         ""};
    ParameterBool playing        {"playing",        "", true};
    ParameterBool playB          {"playB",          "", false};
    Parameter     gain_dB        {"gain_dB",        "",  0.0f, -12.0f, 12.0f};
    Parameter     tiltAmount_dB  {"tiltAmount_dB",  "",  0.0f,  -6.0f,  6.0f};
    Parameter     tiltPivot_hz   {"tiltPivot_hz",   "", 800.0f, 100.0f, 4000.0f};
    Parameter     saturation     {"saturation",     "",  0.3f,  0.0f, 1.0f};
    Parameter     loudness_match {"loudness_match", "",  1.0f,  0.0f, 1.0f};
    Trigger       retrigger      {"retrigger",      ""};

    ControlGUI gui;

    WebSamplePlayer drums, pad, mixed, edm, jazz, orchestral;
    WebSamplePlayer* current = &drums;

    double playhead = 0.0;

    gam::Biquad<> lowShelf, highShelf;

    float rmsA_sq = 1e-8f, rmsB_sq = 1e-8f;
    float corrSmoothed = 1.0f;

    std::atomic<int>   xfadeTarget{0};
    int                xfadePrev = 0;
    float              xfadePos  = 1.0f;
    float              xfadeStep = 1.0f / 240.0f;

    static constexpr int RING = 1024;
    std::array<float, RING> ringA{};
    std::array<float, RING> ringB{};
    std::atomic<int> ringW{0};

    std::atomic<float> dispRmsDiffDB{0.0f};

    // Running RMS of (A-B) for the diff strip tick — graphics-side, runs
    // off the same ring buffer the FFT does.
    float rmsDiffSmooth = 0.0f;

    // Badge animation: set to 60 frames on toggle, decays each onAnimate.
    int badgeAnimCounter = 0;

    Mesh waveA, waveB, diffFill, diffRmsTick, gridMesh, rmsBar, rmsScale, valueBar, badge;
    Mesh fftA, fftB, fftDiff, fftFrame;

    void onInit() override {
      // Short stems first (drums/pad/mix), then full reference tracks
      // (edm/jazz/orchestral) so the menu reads "loops then mixes."
      source.setElements({"drums", "pad", "mixed",
                          "edm full", "jazz full", "orchestral full"});
      source.set(3);   // default to EDM full mix — most useful for mastering work

      gui << source << playing << playB << gain_dB << tiltAmount_dB << tiltPivot_hz
          << saturation << loudness_match << retrigger;

      source.registerChangeCallback([this](float v) {
        switch (static_cast<int>(v)) {
          case 0: current = &drums;      break;
          case 1: current = &pad;        break;
          case 2: current = &mixed;      break;
          case 3: current = &edm;        break;
          case 4: current = &jazz;       break;
          case 5: current = &orchestral; break;
        }
        playhead = 0.0;
      });
      retrigger.registerChangeCallback([this](float) { playhead = 0.0; });
      playB.registerChangeCallback([this](float v) {
        xfadeTarget.store(v > 0.5f ? 1 : 0, std::memory_order_release);
        badgeAnimCounter = 60;  // 1 s pulse on toggle
      });
    }

    void onCreate() override {
      gui.init();
      drums.load("drum_loop_120bpm.wav");
      pad.load("pad_loop.wav");
      mixed.load("mixed_loop.wav");
      edm.load("edm_full.wav");
      jazz.load("jazz_full.wav");
      orchestral.load("orchestral_full.wav");
      current = &edm;

      lowShelf.type(gam::LOW_SHELF);
      highShelf.type(gam::HIGH_SHELF);
      lowShelf.res(0.707f);
      highShelf.res(0.707f);

      nav().pos(0, 0, 4.0f);
    }

    void onSound(AudioIOData& io) override {
      if (!playing.get() || !current || !current->ready()) {
        while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
        return;
      }
      const float sr        = io.framesPerSecond();
      const float srcSR     = current->sampleRate() > 1.f ? current->sampleRate() : sr;
      const double rateRatio = static_cast<double>(srcSR) / static_cast<double>(sr);
      const int   nFrames   = current->frames();

      const float tilt = tiltAmount_dB.get();
      const float pivot = tiltPivot_hz.get();
      lowShelf.freq(pivot);
      highShelf.freq(pivot);
      lowShelf.level(std::pow(10.0f, (-tilt * 0.5f) / 20.0f));
      highShelf.level(std::pow(10.0f, ( tilt * 0.5f) / 20.0f));

      const float gainLin   = std::pow(10.0f, gain_dB.get() / 20.0f);
      const float satAmt    = saturation.get();
      const bool  satActive = satAmt > 0.001f;
      const float satDrive  = 1.0f + satAmt * 5.0f;
      const float lmMix     = loudness_match.get();

      const float rmsCoef   = std::exp(-1.0f / (0.300f * sr));
      const float corrCoef  = std::exp(-1.0f / (0.150f * sr));

      xfadeStep = 1.0f / std::max(1.0f, sr * 0.005f);

      const int target = xfadeTarget.load(std::memory_order_acquire);

      while (io()) {
        const float in = current->readInterp(0, static_cast<float>(playhead));
        playhead += rateRatio;
        if (playhead >= nFrames) playhead -= nFrames;

        const float a = in;

        float b = lowShelf(in);
        b = highShelf(b);
        b *= gainLin;
        if (satActive) b = std::tanh(b * satDrive);

        rmsA_sq = a * a + rmsCoef * (rmsA_sq - a * a);
        rmsB_sq = b * b + rmsCoef * (rmsB_sq - b * b);

        const float rA = std::sqrt(std::max(rmsA_sq, 1e-10f));
        const float rB = std::sqrt(std::max(rmsB_sq, 1e-10f));
        const float corrTarget = std::min(8.0f, rA / std::max(rB, 1e-6f));
        corrSmoothed = corrTarget + corrCoef * (corrSmoothed - corrTarget);
        const float corr = 1.0f * (1.0f - lmMix) + corrSmoothed * lmMix;
        const float bMatched = b * corr;

        if (target != xfadePrev && xfadePos >= 1.0f) {
          xfadePos = 0.0f;
        }
        float outSample;
        if (xfadePos >= 1.0f) {
          outSample = (target == 1) ? bMatched : a;
          xfadePrev = target;
        } else {
          const float prevS = (xfadePrev == 1) ? bMatched : a;
          const float targS = (target    == 1) ? bMatched : a;
          outSample = prevS + (targS - prevS) * xfadePos;
          xfadePos += xfadeStep;
          if (xfadePos >= 1.0f) { xfadePos = 1.0f; xfadePrev = target; }
        }

        io.out(0) = outSample;
        io.out(1) = outSample;

        const int w = ringW.load(std::memory_order_relaxed);
        ringA[w] = a;
        ringB[w] = bMatched;
        ringW.store((w + 1) % RING, std::memory_order_release);
      }

      const float rA = std::sqrt(std::max(rmsA_sq, 1e-10f));
      const float rB = std::sqrt(std::max(rmsB_sq, 1e-10f));
      const float diffDB = 20.0f * std::log10(std::max(rB, 1e-6f) / std::max(rA, 1e-6f));
      dispRmsDiffDB.store(diffDB, std::memory_order_release);
    }

    static void emitDisc(Mesh& m, float cx, float cy, float radius, int segs,
                         float r, float gC, float b) {
      for (int i = 0; i < segs; ++i) {
        const float a0 = 2.0f * static_cast<float>(M_PI) * i       / segs;
        const float a1 = 2.0f * static_cast<float>(M_PI) * (i + 1) / segs;
        m.vertex(cx, cy, 0.f);
        m.vertex(cx + radius * std::cos(a0), cy + radius * std::sin(a0), 0.f);
        m.vertex(cx + radius * std::cos(a1), cy + radius * std::sin(a1), 0.f);
        m.color(r, gC, b); m.color(r, gC, b); m.color(r, gC, b);
      }
    }

    void onAnimate(double /*dt*/) override {
      const int w = ringW.load(std::memory_order_acquire);
      constexpr int W = 512;

      // ---- Background grid ----
      gridMesh.reset();
      gridMesh.primitive(Mesh::LINES);
      const float rowYs[3] = { 0.85f, 0.10f, -0.65f };
      for (float y : rowYs) {
        gridMesh.vertex(-1.4f, y, 0.f);
        gridMesh.vertex( 1.4f, y, 0.f);
        gridMesh.color(0.22f, 0.22f, 0.26f);
        gridMesh.color(0.22f, 0.22f, 0.26f);
      }

      // ---- Time-domain waveforms (A top, B middle) ----
      waveA.reset(); waveB.reset();
      waveA.primitive(Mesh::LINE_STRIP);
      waveB.primitive(Mesh::LINE_STRIP);
      for (int i = 0; i < W; ++i) {
        const int idx = (w - W + i + RING) % RING;
        const float xx = -1.4f + (static_cast<float>(i) / (W - 1)) * 2.8f;
        const float a  = ringA[idx];
        const float b  = ringB[idx];
        waveA.vertex(xx, rowYs[0] + a * 0.20f, 0.f);
        waveA.color(0.45f, 0.65f, 0.95f);
        waveB.vertex(xx, rowYs[1] + b * 0.20f, 0.f);
        waveB.color(0.95f, 0.6f, 0.30f);
      }

      // ---- Rectified |A-B| diff strip, scaled 4x, baseline-anchored ----
      diffFill.reset();
      diffFill.primitive(Mesh::TRIANGLE_STRIP);
      const float yBase = rowYs[2];
      float rmsDiffAccum = 0.0f;
      for (int i = 0; i < W; ++i) {
        const int idx = (w - W + i + RING) % RING;
        const float xx = -1.4f + (static_cast<float>(i) / (W - 1)) * 2.8f;
        const float diffRaw = ringA[idx] - ringB[idx];
        rmsDiffAccum += diffRaw * diffRaw;
        const float d = std::fabs(diffRaw) * 4.0f;
        diffFill.vertex(xx, yBase,     0.f);
        diffFill.vertex(xx, yBase + d, 0.f);
        diffFill.color(0.95f, 0.30f, 0.30f);
        diffFill.color(0.95f, 0.30f, 0.30f);
      }
      const float rmsDiffNow = std::sqrt(rmsDiffAccum / static_cast<float>(W));
      rmsDiffSmooth = rmsDiffSmooth * 0.85f + rmsDiffNow * 0.15f;

      // RMS-of-diff horizontal tick across the diff strip (LINES segment).
      diffRmsTick.reset();
      diffRmsTick.primitive(Mesh::LINES);
      {
        const float yTick = yBase + rmsDiffSmooth * 4.0f;
        diffRmsTick.vertex(-1.4f, yTick, 0.f); diffRmsTick.color(1.0f, 0.85f, 0.4f);
        diffRmsTick.vertex( 1.4f, yTick, 0.f); diffRmsTick.color(1.0f, 0.85f, 0.4f);
      }

      // ---- 256-bin FFT panel (top-right): A blue, B orange, diff shaded ----
      constexpr int FFT_N = 256;
      const float panelX0 = 0.20f, panelX1 = 1.40f;
      const float panelY0 = 0.40f, panelY1 = 1.00f;
      const float panelMid = 0.5f * (panelY0 + panelY1);
      const float panelHalfH = 0.5f * (panelY1 - panelY0);

      // Pull last FFT_N samples of each ring, apply Hann window, compute
      // magnitude via inline DFT (small N -> fine for graphics rate).
      std::array<float, FFT_N> aWin{}, bWin{};
      for (int n = 0; n < FFT_N; ++n) {
        const int idx = (w - FFT_N + n + RING) % RING;
        const float hann = 0.5f - 0.5f * std::cos(2.0f * static_cast<float>(M_PI)
                                                  * static_cast<float>(n)
                                                  / static_cast<float>(FFT_N - 1));
        aWin[n] = ringA[idx] * hann;
        bWin[n] = ringB[idx] * hann;
      }
      const int K = FFT_N / 2;
      std::array<float, 128> magA{}, magB{};
      for (int k = 0; k < K; ++k) {
        float reA = 0.f, imA = 0.f, reB = 0.f, imB = 0.f;
        const float wk = -2.0f * static_cast<float>(M_PI)
                         * static_cast<float>(k) / static_cast<float>(FFT_N);
        for (int n = 0; n < FFT_N; ++n) {
          const float ang = wk * static_cast<float>(n);
          const float c = std::cos(ang);
          const float s = std::sin(ang);
          reA += aWin[n] * c; imA += aWin[n] * s;
          reB += bWin[n] * c; imB += bWin[n] * s;
        }
        magA[k] = std::sqrt(reA * reA + imA * imA) / static_cast<float>(K);
        magB[k] = std::sqrt(reB * reB + imB * imB) / static_cast<float>(K);
      }

      auto magToY = [&](float mag) {
        const float dB = 20.0f * std::log10(std::max(mag, 1e-6f));
        const float t = (dB + 60.0f) / 60.0f;  // -60..0 dB -> 0..1
        const float tc = std::max(0.0f, std::min(1.0f, t));
        return panelY0 + tc * (panelY1 - panelY0);
      };
      auto kToX = [&](int k) {
        // log-x: x = log2(1 + k * 15 / N) / log2(16)
        const float lx = std::log2(1.0f + static_cast<float>(k) * 15.0f
                                   / static_cast<float>(FFT_N))
                         / std::log2(16.0f);
        return panelX0 + lx * (panelX1 - panelX0);
      };

      fftFrame.reset();
      fftFrame.primitive(Mesh::LINES);
      {
        const float fc = 0.30f;
        // Frame.
        fftFrame.vertex(panelX0, panelY0, 0.f); fftFrame.color(fc, fc, 0.35f);
        fftFrame.vertex(panelX1, panelY0, 0.f); fftFrame.color(fc, fc, 0.35f);
        fftFrame.vertex(panelX1, panelY0, 0.f); fftFrame.color(fc, fc, 0.35f);
        fftFrame.vertex(panelX1, panelY1, 0.f); fftFrame.color(fc, fc, 0.35f);
        fftFrame.vertex(panelX1, panelY1, 0.f); fftFrame.color(fc, fc, 0.35f);
        fftFrame.vertex(panelX0, panelY1, 0.f); fftFrame.color(fc, fc, 0.35f);
        fftFrame.vertex(panelX0, panelY1, 0.f); fftFrame.color(fc, fc, 0.35f);
        fftFrame.vertex(panelX0, panelY0, 0.f); fftFrame.color(fc, fc, 0.35f);
        // Mid line (-30 dB).
        fftFrame.vertex(panelX0, panelMid, 0.f); fftFrame.color(0.22f, 0.22f, 0.27f);
        fftFrame.vertex(panelX1, panelMid, 0.f); fftFrame.color(0.22f, 0.22f, 0.27f);
      }

      // Diff fill BETWEEN A and B as a TRIANGLE_STRIP, red where B>A,
      // blue where A>B.
      fftDiff.reset();
      fftDiff.primitive(Mesh::TRIANGLE_STRIP);
      for (int k = 0; k < K; ++k) {
        const float xx = kToX(k);
        const float yA = magToY(magA[k]);
        const float yB = magToY(magB[k]);
        const float ylo = std::min(yA, yB);
        const float yhi = std::max(yA, yB);
        const bool bLouder = magB[k] > magA[k];
        const float r = bLouder ? 0.95f : 0.30f;
        const float gC = bLouder ? 0.45f : 0.55f;
        const float bC = bLouder ? 0.35f : 0.95f;
        // Clip into panel.
        const float ylo2 = std::max(panelY0, std::min(panelY1, ylo));
        const float yhi2 = std::max(panelY0, std::min(panelY1, yhi));
        fftDiff.vertex(xx, ylo2, 0.f); fftDiff.color(r, gC, bC);
        fftDiff.vertex(xx, yhi2, 0.f); fftDiff.color(r, gC, bC);
      }

      // A spectrum line.
      fftA.reset();
      fftA.primitive(Mesh::LINE_STRIP);
      for (int k = 0; k < K; ++k) {
        const float xx = kToX(k);
        const float y = std::max(panelY0, std::min(panelY1, magToY(magA[k])));
        fftA.vertex(xx, y, 0.f);
        fftA.color(0.45f, 0.70f, 1.00f);
      }
      // B spectrum line.
      fftB.reset();
      fftB.primitive(Mesh::LINE_STRIP);
      for (int k = 0; k < K; ++k) {
        const float xx = kToX(k);
        const float y = std::max(panelY0, std::min(panelY1, magToY(magB[k])));
        fftB.vertex(xx, y, 0.f);
        fftB.color(1.00f, 0.65f, 0.30f);
      }

      // ---- RMS bar + scale ticks + numeric value bar (right edge) ----
      const float diffDB = std::max(-12.0f, std::min(12.0f, dispRmsDiffDB.load()));
      const float barX0 = 1.55f, barX1 = 1.70f;
      const float barCenter = 0.10f;
      const float barH = (diffDB / 12.0f) * 0.6f;
      const float by0 = barCenter;
      const float by1 = barCenter + barH;
      const float ylo = std::min(by0, by1);
      const float yhi = std::max(by0, by1);

      rmsBar.reset();
      rmsBar.primitive(Mesh::TRIANGLES);
      rmsBar.vertex(barX0, ylo, 0.f); rmsBar.vertex(barX1, ylo, 0.f); rmsBar.vertex(barX1, yhi, 0.f);
      rmsBar.vertex(barX0, ylo, 0.f); rmsBar.vertex(barX1, yhi, 0.f); rmsBar.vertex(barX0, yhi, 0.f);
      const float bcR = (diffDB >= 0.f) ? 0.95f : 0.45f;
      const float bcG = (diffDB >= 0.f) ? 0.55f : 0.7f;
      const float bcB = (diffDB >= 0.f) ? 0.35f : 1.0f;
      for (int k = 0; k < 6; ++k) rmsBar.color(bcR, bcG, bcB);

      // Scale ticks: +0 dB center + ±12 dB endcaps.
      rmsScale.reset();
      rmsScale.primitive(Mesh::LINES);
      {
        const float tickColR = 0.85f, tickColG = 0.85f, tickColB = 0.85f;
        // 0 dB center tick (slightly extended).
        rmsScale.vertex(barX0 - 0.04f, barCenter, 0.f);
        rmsScale.color(tickColR, tickColG, tickColB);
        rmsScale.vertex(barX1 + 0.04f, barCenter, 0.f);
        rmsScale.color(tickColR, tickColG, tickColB);
        // +12 dB top endcap.
        rmsScale.vertex(barX0 - 0.02f, barCenter + 0.6f, 0.f);
        rmsScale.color(0.95f, 0.55f, 0.35f);
        rmsScale.vertex(barX1 + 0.02f, barCenter + 0.6f, 0.f);
        rmsScale.color(0.95f, 0.55f, 0.35f);
        // -12 dB bottom endcap.
        rmsScale.vertex(barX0 - 0.02f, barCenter - 0.6f, 0.f);
        rmsScale.color(0.45f, 0.70f, 1.00f);
        rmsScale.vertex(barX1 + 0.02f, barCenter - 0.6f, 0.f);
        rmsScale.color(0.45f, 0.70f, 1.00f);
        // Frame the bar with vertical edges.
        rmsScale.vertex(barX0, barCenter - 0.6f, 0.f);
        rmsScale.color(0.30f, 0.30f, 0.36f);
        rmsScale.vertex(barX0, barCenter + 0.6f, 0.f);
        rmsScale.color(0.30f, 0.30f, 0.36f);
        rmsScale.vertex(barX1, barCenter - 0.6f, 0.f);
        rmsScale.color(0.30f, 0.30f, 0.36f);
        rmsScale.vertex(barX1, barCenter + 0.6f, 0.f);
        rmsScale.color(0.30f, 0.30f, 0.36f);
      }

      // Numeric value bar: horizontal length proportional to |diffDB|/12.
      valueBar.reset();
      valueBar.primitive(Mesh::TRIANGLES);
      {
        const float vbY0 = -0.55f;
        const float vbY1 = -0.50f;
        const float vbX0 = 1.55f;
        const float frac = std::min(1.0f, std::fabs(diffDB) / 12.0f);
        const float vbX1 = vbX0 + frac * 0.20f;
        const float vR = (diffDB >= 0.f) ? 0.95f : 0.45f;
        const float vG = (diffDB >= 0.f) ? 0.55f : 0.70f;
        const float vB = (diffDB >= 0.f) ? 0.35f : 1.00f;
        valueBar.vertex(vbX0, vbY0, 0.f); valueBar.vertex(vbX1, vbY0, 0.f); valueBar.vertex(vbX1, vbY1, 0.f);
        valueBar.vertex(vbX0, vbY0, 0.f); valueBar.vertex(vbX1, vbY1, 0.f); valueBar.vertex(vbX0, vbY1, 0.f);
        for (int k = 0; k < 6; ++k) valueBar.color(vR, vG, vB);
      }

      // ---- Animated A/B badge ----
      badge.reset();
      badge.primitive(Mesh::TRIANGLES);
      {
        const bool bSel = playB.get();
        const float baseR = bSel ? 0.95f : 0.45f;
        const float baseG = bSel ? 0.6f  : 0.65f;
        const float baseB = bSel ? 0.30f : 0.95f;

        if (badgeAnimCounter > 0) badgeAnimCounter--;
        const float t = static_cast<float>(badgeAnimCounter) / 60.0f;  // 1->0 over 60 frames
        // Ease (1 - (1-t)^2) -> punchy then settles.
        const float ease = 1.0f - (1.0f - t) * (1.0f - t);
        const float radius = 0.10f + 0.05f * ease;
        // Pulse toward white during animation.
        const float r0 = baseR + (1.0f - baseR) * ease * 0.6f;
        const float g0 = baseG + (1.0f - baseG) * ease * 0.6f;
        const float b0 = baseB + (1.0f - baseB) * ease * 0.6f;
        emitDisc(badge, 1.30f, 1.20f, radius, 24, r0, g0, b0);
      }
    }

    void onDraw(Graphics& g) override {
      g.clear(0.05f, 0.05f, 0.08f);
      g.meshColor();
      g.draw(gridMesh);
      g.draw(diffFill);
      g.draw(diffRmsTick);
      g.draw(waveA);
      g.draw(waveB);
      // FFT panel: frame -> diff fill -> spectra on top.
      g.draw(fftFrame);
      g.draw(fftDiff);
      g.draw(fftA);
      g.draw(fftB);
      g.draw(rmsBar);
      g.draw(rmsScale);
      g.draw(valueBar);
      g.draw(badge);
      gui.draw(g);
    }

    bool onMouseDown(const Mouse& /*m*/) override { return false; }
    bool onMouseDrag(const Mouse& /*m*/) override { return false; }
    bool onMouseUp  (const Mouse& /*m*/) override { return false; }
  };

  ALLOLIB_WEB_MAIN(MasteringAB)
  `,
  },
  {
    id: 'mat-mix-thermometer',
    title: 'Mix Thermometer (Loudness Sweet-Spot Meter)',
    description:
      'Vertical thermometer-style loudness meter with cold/sweet/hot color zones plus a rolling 6-second history strip with sweet-band overlay. A thin red true-peak indicator sits beside the integrated bar (max-hold with 6 dB/s decay) so you see the gap between peak and integrated loudness. Reference ticks at the streaming-platform norms (-23 / -18 / -14 dB) are color-coded by platform — grey for EBU broadcast, dark blue for mastering classic, green for Spotify/streaming. A live cyan target line is driven by the target_dB parameter. Honest caveat: this is RMS-pseudo-LUFS over a tunable window, not a true ITU-R BS.1770 K-weighted reading — qualitatively similar trend, easier to read in real time.',
    category: 'mat-mixing',
    subcategory: 'mastering',
    code: `/**
   * Mix Thermometer (Loudness Sweet-Spot Meter) — MAT200B Mixing/Mastering
   *
   * A vertical "thermometer" meter that visualizes the integrated
   * loudness of the playing loop over a tunable window (default 3 s),
   * plus a thin true-peak bar to its right (max-hold over 1 s, 6 dB/s
   * decay). Cold (blue) = too quiet, sweet (green) = inside target band,
   * hot (red) = too loud. Reference ticks at -23 / -18 / -14 dB are
   * color-coded by streaming-platform target.
   *
   * IMPORTANT — RMS-pseudo-LUFS caveat: true LUFS (ITU-R BS.1770)
   * needs K-weighting + gating. We skip both and use a one-pole RMS
   * over window_sec. The trend is qualitatively similar; absolute
   * values are not. Read as "how hot relative to my target," not
   * as "what would Spotify say." The true-peak bar shows the gap
   * between sample peak and integrated loudness — half the point of
   * a real LUFS meter.
   */

  #include "al_playground_compat.hpp"
  #include "al_WebSamplePlayer.hpp"

  #include <array>
  #include <atomic>
  #include <cmath>
  #include <algorithm>

  using namespace al;

  class MixThermometer : public App {
  public:
    ParameterMenu source        {"source",         ""};
    ParameterBool playing       {"playing",        "", true};
    Parameter     amp           {"amp",            "",  1.0f,   0.0f,   2.0f};
    Parameter     windowSec     {"window_sec",     "",  3.0f,   0.5f,  10.0f};
    Parameter     target_dB     {"target_dB",      "", -18.0f, -28.0f,  -9.0f};
    Parameter     sweetWidth_dB {"sweet_width_dB", "",  3.0f,   1.0f,   6.0f};
    Trigger       retrigger     {"retrigger",      ""};

    ControlGUI gui;

    WebSamplePlayer drums, pad, mixed;
    WebSamplePlayer* current = &drums;

    double playhead = 0.0;
    float rmsLin = 1e-9f;
    std::atomic<float> displayDB{-60.f};

    // True-peak: track |sample| max with one-pole 6 dB/s decay.
    // 6 dB/s in linear terms = factor 10^(-6/20) = 0.5012 per second.
    // Per-sample multiplier = exp(ln(0.5012)/sr).
    float truePeakLin = 1e-9f;
    std::atomic<float> truePeakDB{-120.0f};

    static constexpr int HIST_N = 360;
    std::array<float, HIST_N> hist{};
    int histW = 0;

    Mesh thermoBg, sweetBand, fillCol, refTicks, targetLine;
    Mesh truePeakBar;
    Mesh histLine, histTarget, histBg, histSweet;
    Mesh liveValueBar, targetValueBar;

    static constexpr float TH_X0 = -1.30f, TH_X1 = -1.00f;
    static constexpr float TH_Y0 = -0.90f, TH_Y1 =  0.90f;
    static constexpr float HS_X0 = -0.70f, HS_X1 =  1.40f;
    static constexpr float HS_Y0 = -0.40f, HS_Y1 =  0.40f;
    static constexpr float DB_LO = -60.0f, DB_HI = 0.0f;

    void onInit() override {
      source.setElements({"drums", "pad", "mixed"});
      source.set(0);

      gui << source << playing << amp << windowSec << target_dB << sweetWidth_dB << retrigger;

      source.registerChangeCallback([this](float v) {
        switch (static_cast<int>(v)) {
          case 0: current = &drums; break;
          case 1: current = &pad;   break;
          case 2: current = &mixed; break;
        }
        playhead = 0.0;
      });
      retrigger.registerChangeCallback([this](float) { playhead = 0.0; });

      hist.fill(-60.f);
    }

    void onCreate() override {
      gui.init();
      drums.load("drum_loop_120bpm.wav");
      pad.load("pad_loop.wav");
      mixed.load("mixed_loop.wav");
      nav().pos(0, 0, 4.0f);
    }

    static float clamp01(float v) { return v < 0.f ? 0.f : (v > 1.f ? 1.f : v); }

    static float dbToThermoY(float db) {
      const float t = (db - DB_LO) / (DB_HI - DB_LO);
      return TH_Y0 + clamp01(t) * (TH_Y1 - TH_Y0);
    }
    static float dbToHistY(float db) {
      const float t = (db - DB_LO) / (DB_HI - DB_LO);
      return HS_Y0 + clamp01(t) * (HS_Y1 - HS_Y0);
    }

    // (r,g,b) lerp.
    static void lerpColor(float ar, float ag, float ab,
                          float br, float bg, float bb,
                          float t,
                          float& outR, float& outG, float& outB) {
      t = clamp01(t);
      outR = ar + (br - ar) * t;
      outG = ag + (bg - ag) * t;
      outB = ab + (bb - ab) * t;
    }

    static void zoneColor(float db, float tgt, float sw,
                          float& outR, float& outG, float& outB) {
      const float lo = tgt - sw;
      const float hi = tgt + sw;
      if (db < lo) {
        const float t = (db - DB_LO) / std::max(0.001f, lo - DB_LO);
        lerpColor(0.20f, 0.45f, 1.00f,
                  0.30f, 0.95f, 0.40f, t, outR, outG, outB);
      } else if (db > hi) {
        const float t = (db - hi) / std::max(0.001f, DB_HI - hi);
        lerpColor(0.30f, 0.95f, 0.40f,
                  1.00f, 0.30f, 0.25f, t, outR, outG, outB);
      } else {
        outR = 0.30f; outG = 0.95f; outB = 0.40f;
      }
    }

    static void addRect(Mesh& m, float x0, float y0, float x1, float y1,
                        float r, float gC, float b) {
      m.vertex(x0, y0, 0.f); m.color(r, gC, b);
      m.vertex(x1, y0, 0.f); m.color(r, gC, b);
      m.vertex(x0, y1, 0.f); m.color(r, gC, b);
      m.vertex(x1, y1, 0.f); m.color(r, gC, b);
    }
    static void addHLine(Mesh& m, float x0, float x1, float y, float halfH,
                         float r, float gC, float b) {
      addRect(m, x0, y - halfH, x1, y + halfH, r, gC, b);
    }

    void onSound(AudioIOData& io) override {
      if (!playing.get() || !current || !current->ready()) {
        while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
        return;
      }
      const float sr        = io.framesPerSecond();
      const float srcSR     = current->sampleRate() > 1.f ? current->sampleRate() : sr;
      const double rateRatio = static_cast<double>(srcSR) / static_cast<double>(sr);
      const int   nFrames   = current->frames();
      const float gain      = amp.get();
      const float winSec    = std::max(0.05f, windowSec.get());
      const float coef      = std::exp(-1.0f / (winSec * sr));

      // True-peak decay coefficient: 6 dB/s = factor 10^(-6/20) = 0.5012 per sec.
      // Per-sample multiplier: 0.5012^(1/sr) = exp(ln(0.5012)/sr).
      const float tpDecay = std::exp(std::log(0.5012f) / sr);

      while (io()) {
        const float s   = current->readInterp(0, static_cast<float>(playhead));
        playhead += rateRatio;
        if (playhead >= nFrames) playhead -= nFrames;

        const float out = s * gain;
        io.out(0) = out;
        io.out(1) = out;

        rmsLin = (1.f - coef) * out * out + coef * rmsLin;

        // True-peak: latch to new sample magnitude when greater, else decay.
        const float mag = std::fabs(out);
        truePeakLin *= tpDecay;
        if (mag > truePeakLin) truePeakLin = mag;
      }

      const float rmsClamped = std::max(rmsLin, 1e-12f);
      const float dB = 10.0f * std::log10(rmsClamped);
      displayDB.store(dB, std::memory_order_release);

      const float tpClamped = std::max(truePeakLin, 1e-9f);
      const float tpDB = 20.0f * std::log10(tpClamped);
      truePeakDB.store(tpDB, std::memory_order_release);
    }

    void onAnimate(double /*dt*/) override {
      const float dbNow   = displayDB.load(std::memory_order_acquire);
      const float tpNow   = truePeakDB.load(std::memory_order_acquire);
      const float tgt     = target_dB.get();
      const float sw      = sweetWidth_dB.get();

      hist[histW] = dbNow;
      histW = (histW + 1) % HIST_N;

      // ---- Thermometer background ----
      thermoBg.reset();
      thermoBg.primitive(Mesh::TRIANGLE_STRIP);
      addRect(thermoBg, TH_X0, TH_Y0, TH_X1, TH_Y1, 0.10f, 0.10f, 0.13f);

      // ---- Sweet band (vertical green stripe inside thermo) ----
      sweetBand.reset();
      sweetBand.primitive(Mesh::TRIANGLE_STRIP);
      {
        const float yLo = dbToThermoY(tgt - sw);
        const float yHi = dbToThermoY(tgt + sw);
        addRect(sweetBand, TH_X0, yLo, TH_X1, yHi, 0.10f, 0.35f, 0.18f);
      }

      // ---- Fill column (live integrated level) ----
      fillCol.reset();
      fillCol.primitive(Mesh::TRIANGLE_STRIP);
      {
        const float yTop = dbToThermoY(dbNow);
        float zR, zG, zB;
        zoneColor(dbNow, tgt, sw, zR, zG, zB);
        const float pad = 0.015f;
        addRect(fillCol, TH_X0 + pad, TH_Y0 + 0.005f,
                         TH_X1 - pad, yTop, zR, zG, zB);
      }

      // ---- Reference ticks: color-coded by streaming-platform standard ----
      // -23 dB grey (broadcast / EBU), -18 dB dark blue (mastering classic),
      // -14 dB green (Spotify / streaming). Each tick = horizontal bar
      // across thermo + a small inward-pointing TRIANGLE at the right edge.
      refTicks.reset();
      refTicks.primitive(Mesh::TRIANGLES);
      struct TickStyle { float db; float r; float g; float b; };
      const TickStyle tickStyles[3] = {
        {-23.f, 0.55f, 0.55f, 0.55f},  // grey EBU
        {-18.f, 0.20f, 0.30f, 0.65f},  // dark blue mastering
        {-14.f, 0.30f, 0.85f, 0.40f}   // green Spotify
      };
      for (int i = 0; i < 3; ++i) {
        const TickStyle& ts = tickStyles[i];
        const float y = dbToThermoY(ts.db);
        const float x0 = TH_X0 - 0.03f;
        const float x1 = TH_X1 + 0.03f;
        const float halfH = 0.004f;
        // Horizontal bar (2 triangles).
        refTicks.vertex(x0, y - halfH, 0.f); refTicks.color(ts.r, ts.g, ts.b);
        refTicks.vertex(x1, y - halfH, 0.f); refTicks.color(ts.r, ts.g, ts.b);
        refTicks.vertex(x1, y + halfH, 0.f); refTicks.color(ts.r, ts.g, ts.b);
        refTicks.vertex(x0, y - halfH, 0.f); refTicks.color(ts.r, ts.g, ts.b);
        refTicks.vertex(x1, y + halfH, 0.f); refTicks.color(ts.r, ts.g, ts.b);
        refTicks.vertex(x0, y + halfH, 0.f); refTicks.color(ts.r, ts.g, ts.b);
        // Inward-pointing colored triangle marker at right edge of thermo.
        const float tx0 = TH_X1 + 0.05f;
        const float tx1 = TH_X1 + 0.13f;
        const float th  = 0.025f;
        refTicks.vertex(tx1, y + th, 0.f); refTicks.color(ts.r, ts.g, ts.b);
        refTicks.vertex(tx1, y - th, 0.f); refTicks.color(ts.r, ts.g, ts.b);
        refTicks.vertex(tx0, y,      0.f); refTicks.color(ts.r, ts.g, ts.b);
      }

      // ---- Target line (cyan) ----
      targetLine.reset();
      targetLine.primitive(Mesh::TRIANGLE_STRIP);
      {
        const float y = dbToThermoY(tgt);
        addHLine(targetLine, TH_X0 - 0.05f, TH_X1 + 0.05f, y, 0.006f,
                 0.30f, 0.95f, 1.00f);
      }

      // ---- True-peak bar to right of main thermometer ----
      truePeakBar.reset();
      truePeakBar.primitive(Mesh::TRIANGLE_STRIP);
      {
        const float tpClamped = std::max(-60.0f, std::min(0.0f, tpNow));
        const float t = (tpClamped + 60.0f) / 60.0f;
        const float yTop = TH_Y0 + clamp01(t) * (TH_Y1 - TH_Y0);
        const float tpX0 = TH_X1 + 0.05f;
        const float tpX1 = TH_X1 + 0.10f;
        addRect(truePeakBar, tpX0, TH_Y0 + 0.005f, tpX1, yTop,
                0.95f, 0.20f, 0.20f);
      }

      // ---- History strip background ----
      histBg.reset();
      histBg.primitive(Mesh::TRIANGLE_STRIP);
      addRect(histBg, HS_X0, HS_Y0, HS_X1, HS_Y1, 0.07f, 0.07f, 0.10f);

      // ---- History strip sweet-band overlay (drawn FIRST so line overlays) ----
      histSweet.reset();
      histSweet.primitive(Mesh::TRIANGLE_STRIP);
      {
        const float yLo = dbToHistY(tgt - sw);
        const float yHi = dbToHistY(tgt + sw);
        addRect(histSweet, HS_X0, yLo, HS_X1, yHi, 0.10f, 0.30f, 0.16f);
      }

      // ---- History strip target line ----
      histTarget.reset();
      histTarget.primitive(Mesh::TRIANGLE_STRIP);
      {
        const float y = dbToHistY(tgt);
        addHLine(histTarget, HS_X0, HS_X1, y, 0.004f, 0.30f, 0.95f, 1.00f);
      }

      // ---- History line (zone-coloured) ----
      histLine.reset();
      histLine.primitive(Mesh::LINE_STRIP);
      for (int i = 0; i < HIST_N; ++i) {
        const int idx = (histW + i) % HIST_N;
        const float t = static_cast<float>(i) / (HIST_N - 1);
        const float x = HS_X0 + t * (HS_X1 - HS_X0);
        const float y = dbToHistY(hist[idx]);
        float zR, zG, zB;
        zoneColor(hist[idx], tgt, sw, zR, zG, zB);
        histLine.vertex(x, y, 0.f);
        histLine.color(zR, zG, zB);
      }

      // ---- Numeric "tick value bars" below the thermometer ----
      // Live: length = (displayDB + 60)/60, zone-coloured.
      // Target: length = (target + 60)/60, cyan.
      liveValueBar.reset();
      liveValueBar.primitive(Mesh::TRIANGLE_STRIP);
      {
        const float vbY0 = -0.98f;
        const float vbY1 = -0.95f;
        const float vbX0 = TH_X0;
        const float dbClamp = std::max(-60.0f, std::min(0.0f, dbNow));
        const float frac = (dbClamp + 60.0f) / 60.0f;
        const float vbX1 = vbX0 + frac * (TH_X1 - TH_X0 + 0.10f);
        float zR, zG, zB;
        zoneColor(dbNow, tgt, sw, zR, zG, zB);
        addRect(liveValueBar, vbX0, vbY0, vbX1, vbY1, zR, zG, zB);
      }
      targetValueBar.reset();
      targetValueBar.primitive(Mesh::TRIANGLE_STRIP);
      {
        const float vbY0 = -1.02f;
        const float vbY1 = -1.00f;
        const float vbX0 = TH_X0;
        const float frac = (tgt + 60.0f) / 60.0f;
        const float fracC = clamp01(frac);
        const float vbX1 = vbX0 + fracC * (TH_X1 - TH_X0 + 0.10f);
        addRect(targetValueBar, vbX0, vbY0, vbX1, vbY1, 0.30f, 0.95f, 1.00f);
      }
    }

    void onDraw(Graphics& g) override {
      g.clear(0.04f, 0.04f, 0.07f);
      g.meshColor();

      g.draw(thermoBg);
      g.draw(sweetBand);
      g.draw(fillCol);
      g.draw(refTicks);
      g.draw(targetLine);
      g.draw(truePeakBar);

      // History strip: bg -> sweet stripe -> target line -> data line on top.
      g.draw(histBg);
      g.draw(histSweet);
      g.draw(histTarget);
      g.draw(histLine);

      // Numeric value bars below thermometer.
      g.draw(liveValueBar);
      g.draw(targetValueBar);

      gui.draw(g);
    }

    bool onMouseDown(const Mouse& /*m*/) override { return false; }
    bool onMouseDrag(const Mouse& /*m*/) override { return false; }
    bool onMouseUp  (const Mouse& /*m*/) override { return false; }
  };

  ALLOLIB_WEB_MAIN(MixThermometer)
  `,
  },
  {
    id: 'mat-additive-geometry',
    title: 'Additive Geometry',
    description:
      'A single coefficient vector simultaneously drives a 16-partial additive synthesizer and a parametric 3D mesh whose radius is the same Fourier sum: r(theta) = R0 + sum(a_n * cos(n*theta)). Push the a3 slider up and you hear the third harmonic AND see three new lobes bloom around the surface. Mesh hue tracks the dominant harmonic index, an ADSR envelope glides amplitude on each keyboard note (no clicks), the equator scope ring rides on the mesh itself as a transparent slice, and a click-drag 16-bar mini-spectrum lets you paint partials 1..16 directly. A bandlimit toggle attenuates partials past Nyquist with a cosine taper and dims those bars in the mini-spectrum so you can SEE where aliasing would start. The trick is a std::array<std::atomic<float>, 16> shared lock-free between audio and graphics.',
    category: 'mat-synthesis',
    subcategory: 'additive',
    code: `/**
   * Additive Geometry — MAT200B Phase 2 (additive synthesis)
   *
   * One std::array<std::atomic<float>, 16> drives BOTH:
   *   - audio: 16 sines summed with amplitudes a[n], gated by an ADSR
   *            envelope that retriggers on each onKeyDown
   *   - mesh:  parametric surface radius r(theta) = R0 + sum a_n cos(n theta)
   *
   * The equator scope is rendered AS A SLICE THROUGH THE MESH at z=0,
   * coloured by the dominant-partial hue — same curve as one period of
   * the time-domain waveform, riding on the rotating mesh itself.
   *
   * Top-right: a 16-bar mini-spectrum. CLICK-DRAG over the bars to paint
   * partials 1..16 directly. Bandlimit toggle attenuates partial n by
   * cos(pi*n*f0 / (2*nyquist))^2 and visually dims the bars past the
   * cutoff so you can see exactly where aliasing would otherwise start.
   */

  #include "al_playground_compat.hpp"
  #include "Gamma/Envelope.h"
  #include "Gamma/Oscillator.h"

  #include <array>
  #include <atomic>
  #include <cmath>
  #include <vector>
  #include <algorithm>

  #ifndef M_PI
  #define M_PI 3.14159265358979323846
  #endif

  using namespace al;

  class AdditiveGeometry : public App {
  public:
    static constexpr int N_PARTIALS = 16;
    std::array<gam::Sine<>, N_PARTIALS> oscs;
    std::array<std::atomic<float>, N_PARTIALS> partialAmps;

    ParameterBool playing {"playing", "", true};
    Parameter f0      {"f0_Hz",       "",        110.0f,  40.0f,  440.0f};
    Parameter master  {"master",      "",          0.25f,  0.0f,    1.0f};
    Parameter a1{"a1","partials",1.00f,0.f,1.f}; Parameter a2{"a2","partials",0.f,0.f,1.f};
    Parameter a3{"a3","partials",0.00f,0.f,1.f}; Parameter a4{"a4","partials",0.f,0.f,1.f};
    Parameter a5{"a5","partials",0.00f,0.f,1.f}; Parameter a6{"a6","partials",0.f,0.f,1.f};
    Parameter a7{"a7","partials",0.00f,0.f,1.f}; Parameter a8{"a8","partials",0.f,0.f,1.f};
    Parameter tailDecay {"tail_decay","",  0.5f, 0.0f, 1.0f};
    Parameter rotate    {"rotate",    "",  0.3f, -2.0f, 2.0f};
    Parameter R0        {"base_radius","", 1.0f, 0.2f, 2.0f};
    Parameter atk_ms    {"attack_ms",  "",  10.0f, 1.0f, 500.0f};
    Parameter dec_ms    {"decay_ms",   "", 200.0f, 5.0f, 2000.0f};
    Parameter rel_ms    {"release_ms", "", 600.0f, 5.0f, 4000.0f};
    ParameterBool bandlimit {"bandlimit","", true};
    ParameterBool wireframe {"wireframe","", false};
    Trigger sawPreset    {"preset_saw",   ""};
    Trigger squarePreset {"preset_square",""};
    Trigger clearPreset  {"preset_clear", ""};

    ControlGUI gui;

    // ADSR-style envelope (attack/decay/release; sustain pinned at 1).
    gam::Env<3> ampEnv;
    std::atomic<int> envTrigPending{0};

    Mesh surface, scope, miniSpec, miniSpecBg;
    static constexpr int N_LON = 64;
    static constexpr int N_LAT = 32;
    float yaw = 0.0f;
    int frameCount = 0;

    // Mini-spectrum world rect (top-right corner, billboarded by depth-off draw).
    static constexpr float SPEC_X0 =  0.55f, SPEC_X1 = 1.55f;
    static constexpr float SPEC_Y0 =  0.85f, SPEC_Y1 = 1.45f;
    bool painting = false;

    std::atomic<float> sampleRateHz{48000.f};

    void onInit() override {
      for (int i = 0; i < N_PARTIALS; ++i) partialAmps[i].store(0.0f);
      partialAmps[0].store(1.0f);

      // Envelope: A->1, D->1 (sustain), R->0
      ampEnv.levels(0.f, 1.f, 1.f, 0.f);
      ampEnv.lengths()[0] = atk_ms.get() / 1000.f;
      ampEnv.lengths()[1] = dec_ms.get() / 1000.f;
      ampEnv.lengths()[2] = rel_ms.get() / 1000.f;
      ampEnv.sustainPoint(2);

      Parameter* live[8] = {&a1,&a2,&a3,&a4,&a5,&a6,&a7,&a8};
      for (int i = 0; i < 8; ++i) {
        const int idx = i;
        live[i]->registerChangeCallback([this, idx](float v) {
          partialAmps[idx].store(v);
        });
      }

      sawPreset.registerChangeCallback([this, live](float){
        for (int i = 0; i < 8; ++i) live[i]->set(1.0f / float(i + 1));
        for (int i = 8; i < N_PARTIALS; ++i) partialAmps[i].store(1.0f / float(i + 1));
      });
      squarePreset.registerChangeCallback([this, live](float){
        for (int i = 0; i < 8; ++i) {
          const int n = i + 1;
          live[i]->set((n % 2 == 1) ? 1.0f / float(n) : 0.0f);
        }
        for (int i = 8; i < N_PARTIALS; ++i) {
          const int n = i + 1;
          partialAmps[i].store((n % 2 == 1) ? 1.0f / float(n) : 0.0f);
        }
      });
      clearPreset.registerChangeCallback([this, live](float){
        for (int i = 0; i < 8; ++i) live[i]->set(0.0f);
        for (int i = 8; i < N_PARTIALS; ++i) partialAmps[i].store(0.0f);
      });

      gui << playing << f0 << master
          << a1 << a2 << a3 << a4 << a5 << a6 << a7 << a8
          << tailDecay << rotate << R0
          << atk_ms << dec_ms << rel_ms
          << bandlimit << wireframe
          << sawPreset << squarePreset << clearPreset;
    }

    void onCreate() override {
      gui.init();
      nav().pos(0, 0, 4.0f);
      for (auto& o : oscs) o.freq(110.0f);
      surface.primitive(Mesh::TRIANGLES);
      scope.primitive(Mesh::LINE_STRIP);
      rebuildMesh();
    }

    // Bandlimit attenuation: cos^2 taper centred on Nyquist. Returns 1 when
    // the partial is well below Nyquist, 0 once it reaches Nyquist.
    float bandlimitGain(int n /*1-indexed*/) {
      if (!bandlimit.get()) return 1.0f;
      const float sr = sampleRateHz.load(std::memory_order_relaxed);
      const float nyq = 0.5f * sr;
      const float fp = float(n) * f0.get();
      if (fp >= nyq) return 0.0f;
      const float c = std::cos(static_cast<float>(M_PI) * fp / (2.0f * nyq));
      return c * c;
    }

    float radiusAt(float theta) {
      float sum = 0.0f, norm = 0.0f;
      for (int i = 0; i < N_PARTIALS; ++i) {
        const float a = partialAmps[i].load(std::memory_order_relaxed)
                      * bandlimitGain(i + 1);
        sum  += a * std::cos(float(i + 1) * theta);
        norm += a;
      }
      if (norm < 1e-4f) norm = 1.0f;
      return R0.get() + 0.5f * sum / norm;
    }

    int dominantPartial() {
      int best = 0;
      float bestVal = -1.0f;
      for (int i = 0; i < N_PARTIALS; ++i) {
        const float a = partialAmps[i].load(std::memory_order_relaxed)
                      * bandlimitGain(i + 1);
        if (a > bestVal) { bestVal = a; best = i; }
      }
      return best;
    }

    static void hsv2rgb(float h, float s, float v, float& r, float& g, float& b) {
      const float i = std::floor(h * 6.0f);
      const float f = h * 6.0f - i;
      const float p = v * (1.0f - s);
      const float q = v * (1.0f - f * s);
      const float t = v * (1.0f - (1.0f - f) * s);
      const int ii = int(i) % 6;
      switch (ii) {
        case 0: r=v; g=t; b=p; break;
        case 1: r=q; g=v; b=p; break;
        case 2: r=p; g=v; b=t; break;
        case 3: r=p; g=q; b=v; break;
        case 4: r=t; g=p; b=v; break;
        default: r=v; g=p; b=q; break;
      }
    }

    void rebuildMesh() {
      surface.reset();
      surface.primitive(wireframe.get() ? Mesh::LINES : Mesh::TRIANGLES);

      const int dom = dominantPartial();
      const float hue = float(dom) / float(N_PARTIALS);
      float domR, domG, domB; hsv2rgb(hue, 0.85f, 1.0f, domR, domG, domB);

      std::vector<Vec3f> verts;
      std::vector<float> rgb;
      verts.reserve((N_LAT + 1) * (N_LON + 1));
      rgb.reserve((N_LAT + 1) * (N_LON + 1) * 3);

      for (int j = 0; j <= N_LAT; ++j) {
        const float v = float(j) / float(N_LAT);
        const float phi = v * static_cast<float>(M_PI);
        const float sinPhi = std::sin(phi);
        const float cosPhi = std::cos(phi);
        for (int i = 0; i <= N_LON; ++i) {
          const float u = float(i) / float(N_LON);
          const float theta = u * 2.0f * static_cast<float>(M_PI);
          const float r = radiusAt(theta);
          const float taper = 0.5f + 0.5f * sinPhi;
          const float rEff = R0.get() + (r - R0.get()) * taper;
          const float x = rEff * sinPhi * std::cos(theta);
          const float y = rEff * cosPhi;
          const float z = rEff * sinPhi * std::sin(theta);
          verts.push_back(Vec3f(x, y, z));
          float bright = 0.4f + 0.6f * std::max(0.0f, (r - R0.get()) * 1.5f + 0.5f);
          if (bright > 1.0f) bright = 1.0f;
          float cr, cg, cb;
          hsv2rgb(hue, 0.85f, bright, cr, cg, cb);
          rgb.push_back(cr); rgb.push_back(cg); rgb.push_back(cb);
        }
      }

      auto idx = [](int j, int i) { return j * (N_LON + 1) + i; };
      auto emit = [&](int p) {
        surface.vertex(verts[p]);
        surface.color(rgb[p*3], rgb[p*3+1], rgb[p*3+2]);
      };

      for (int j = 0; j < N_LAT; ++j) {
        for (int i = 0; i < N_LON; ++i) {
          const int a = idx(j, i);
          const int b = idx(j, i + 1);
          const int c = idx(j + 1, i);
          const int d = idx(j + 1, i + 1);
          if (wireframe.get()) {
            emit(a); emit(b);
            emit(a); emit(c);
          } else {
            emit(a); emit(c); emit(b);
            emit(b); emit(c); emit(d);
          }
        }
      }

      // Equator scope ribbon — slice through the mesh at z=0 (cosPhi=0,
      // sinPhi=1, taper=1). Lives on the rotating mesh itself, not a
      // separate translated panel. Coloured by dominant-partial hue.
      scope.reset();
      scope.primitive(Mesh::LINE_STRIP);
      constexpr int SCOPE_N = 256;
      for (int i = 0; i <= SCOPE_N; ++i) {
        const float u = float(i) / float(SCOPE_N);
        const float theta = u * 2.0f * static_cast<float>(M_PI);
        const float r = radiusAt(theta);
        // Equator: y = 0, x = r cos(theta), z = r sin(theta).
        scope.vertex(r * std::cos(theta), 0.0f, r * std::sin(theta));
        scope.color(domR, domG, domB);
      }

      rebuildMiniSpec();
    }

    // 16-bar mini-spectrum, top-right. Bars dim past the bandlimit point.
    void rebuildMiniSpec() {
      miniSpecBg.reset();
      miniSpecBg.primitive(Mesh::TRIANGLE_STRIP);
      miniSpecBg.vertex(SPEC_X0, SPEC_Y0, 0.f); miniSpecBg.color(0.10f,0.10f,0.14f);
      miniSpecBg.vertex(SPEC_X1, SPEC_Y0, 0.f); miniSpecBg.color(0.10f,0.10f,0.14f);
      miniSpecBg.vertex(SPEC_X0, SPEC_Y1, 0.f); miniSpecBg.color(0.14f,0.14f,0.18f);
      miniSpecBg.vertex(SPEC_X1, SPEC_Y1, 0.f); miniSpecBg.color(0.14f,0.14f,0.18f);

      miniSpec.reset();
      miniSpec.primitive(Mesh::TRIANGLES);
      const float barW = (SPEC_X1 - SPEC_X0) / float(N_PARTIALS);
      for (int i = 0; i < N_PARTIALS; ++i) {
        const float a = std::min(1.0f,
          partialAmps[i].load(std::memory_order_relaxed));
        const float bl = bandlimitGain(i + 1);
        const float h = (SPEC_Y1 - SPEC_Y0) * a;
        const float x0 = SPEC_X0 + i * barW + barW * 0.1f;
        const float x1 = SPEC_X0 + (i + 1) * barW - barW * 0.1f;
        const float y0 = SPEC_Y0;
        const float y1 = SPEC_Y0 + h;
        // Hue per partial; dim by bandlimit gain.
        const float hue = float(i) / float(N_PARTIALS);
        float cr, cg, cb;
        hsv2rgb(hue, 0.85f, 0.95f, cr, cg, cb);
        const float dim = 0.25f + 0.75f * bl;
        cr *= dim; cg *= dim; cb *= dim;
        // Two triangles per bar.
        miniSpec.vertex(x0, y0, 0.f); miniSpec.color(cr, cg, cb);
        miniSpec.vertex(x1, y0, 0.f); miniSpec.color(cr, cg, cb);
        miniSpec.vertex(x0, y1, 0.f); miniSpec.color(cr, cg, cb);
        miniSpec.vertex(x1, y0, 0.f); miniSpec.color(cr, cg, cb);
        miniSpec.vertex(x1, y1, 0.f); miniSpec.color(cr, cg, cb);
        miniSpec.vertex(x0, y1, 0.f); miniSpec.color(cr, cg, cb);
      }
    }

    void onAnimate(double dt) override {
      yaw += float(dt) * rotate.get();
      if (++frameCount % 3 == 0) rebuildMesh();
      const float base = f0.get();
      for (int i = 0; i < N_PARTIALS; ++i) {
        oscs[i].freq(base * float(i + 1));
      }
    }

    void onDraw(Graphics& g) override {
      g.clear(0.04f, 0.04f, 0.07f);
      g.depthTesting(true);

      g.pushMatrix();
      g.rotate(yaw * 57.2958f, Vec3f(0, 1, 0));
      g.rotate(15.0f, Vec3f(1, 0, 0));
      g.meshColor();
      g.draw(surface);
      // Equator ribbon rides ON the mesh — same model space, same rotation.
      g.draw(scope);
      g.popMatrix();

      // Mini-spectrum panel — screen-space, depth off so it always sits
      // on top of the rotating mesh in the corner.
      g.depthTesting(false);
      g.meshColor();
      g.draw(miniSpecBg);
      g.draw(miniSpec);

      gui.draw(g);
    }

    void onSound(AudioIOData& io) override {
      if (!playing.get()) {
        while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
        return;
      }
      const float sr = io.framesPerSecond();
      sampleRateHz.store(sr, std::memory_order_relaxed);

      // Update envelope segment lengths from params each block.
      ampEnv.lengths()[0] = atk_ms.get() / 1000.f;
      ampEnv.lengths()[1] = dec_ms.get() / 1000.f;
      ampEnv.lengths()[2] = rel_ms.get() / 1000.f;

      if (envTrigPending.exchange(0, std::memory_order_acquire)) {
        ampEnv.reset();
      }

      const float amp = master.get();
      const float decay = tailDecay.get();
      float amps[N_PARTIALS];
      float norm = 0.0f;
      for (int i = 0; i < N_PARTIALS; ++i) {
        amps[i] = partialAmps[i].load(std::memory_order_relaxed)
                * std::pow(1.0f - 0.4f * decay, float(i))
                * bandlimitGain(i + 1);
        norm += amps[i];
      }
      if (norm < 1e-4f) norm = 1.0f;
      const float invNorm = amp / norm;

      while (io()) {
        float s = 0.0f;
        for (int i = 0; i < N_PARTIALS; ++i) s += amps[i] * oscs[i]();
        s *= invNorm * ampEnv();
        if (s >  1.0f) s =  1.0f;
        if (s < -1.0f) s = -1.0f;
        io.out(0) = s;
        io.out(1) = s;
      }
    }

    // --- mini-spec paint surface ---------------------------------------
    // Mouse coords from al::Mouse are in pixels (top-left origin); convert
    // to the [-1.6, 1.6]-ish world rect by treating the mouse as
    // normalised to viewport then mapping linearly. We use the same
    // x-range (-1.6..1.6) and y-range (-1..1) the GUI lives in.
    bool mouseToBar(const Mouse& m, int& barOut, float& ampOut) {
      const float px = float(m.x()) / float(std::max(1, width()));
      const float py = float(m.y()) / float(std::max(1, height()));
      // World rect — matches the world units used elsewhere in the app.
      const float wx = -1.6f + px * 3.2f;
      const float wy =  1.0f - py * 2.0f;
      if (wx < SPEC_X0 || wx > SPEC_X1) return false;
      if (wy < SPEC_Y0 || wy > SPEC_Y1) return false;
      const float u = (wx - SPEC_X0) / (SPEC_X1 - SPEC_X0);
      int bar = int(u * N_PARTIALS);
      if (bar < 0) bar = 0;
      if (bar >= N_PARTIALS) bar = N_PARTIALS - 1;
      float a = (wy - SPEC_Y0) / (SPEC_Y1 - SPEC_Y0);
      if (a < 0.f) a = 0.f;
      if (a > 1.f) a = 1.f;
      barOut = bar;
      ampOut = a;
      return true;
    }

    void paintBar(int bar, float a) {
      partialAmps[bar].store(a);
      // Mirror to slider parameters so the GUI sliders move in sync.
      Parameter* live[8] = {&a1,&a2,&a3,&a4,&a5,&a6,&a7,&a8};
      if (bar < 8) live[bar]->set(a);
    }

    bool onMouseDown(const Mouse& m) override {
      int bar; float a;
      if (mouseToBar(m, bar, a)) {
        painting = true;
        paintBar(bar, a);
      }
      return false;
    }
    bool onMouseDrag(const Mouse& m) override {
      if (!painting) return false;
      int bar; float a;
      if (mouseToBar(m, bar, a)) paintBar(bar, a);
      return false;
    }
    bool onMouseUp(const Mouse&) override {
      painting = false;
      return false;
    }

    // Musical keyboard sets the fundamental f0; harmonics scale automatically.
    // Each keypress retriggers the ADSR envelope to remove pitch-change clicks.
    static int noteFromKey(int key) {
      static const int kbd[] = {
        'Z',48,'X',50,'C',52,'V',53,'B',55,'N',57,'M',59,
        'A',60,'S',62,'D',64,'F',65,'G',67,'H',69,'J',71,
        'Q',72,'W',74,'E',76,'R',77,'T',79,'Y',81,'U',83
      };
      for (int i = 0; i < 21; ++i) {
        const int K = kbd[i*2];
        if (key == K || key == K + 32) return kbd[i*2 + 1];
      }
      return -1;
    }
    bool onKeyDown(const Keyboard& k) override {
      const int n = noteFromKey(k.key());
      if (n >= 0) {
        f0.set(440.0f * std::pow(2.0f, (n - 69) / 12.0f));
        envTrigPending.store(1, std::memory_order_release);
      }
      return true;
    }
  };

  ALLOLIB_WEB_MAIN(AdditiveGeometry)
  `,
  },
  {
    id: 'mat-additive-sculptor',
    title: 'Additive Partial Sculptor',
    description:
      'Paint a 64-partial harmonic spectrum and hear it instantly. The top panel is a click-and-drag bar chart where each bar is the amplitude of partial n (frequency = f0 * n); the bottom panel is a live time-domain trace showing one period of the resulting waveform, computed by summing all 64 sines across [0, 2pi]. Sculpt sawtooth, square, and triangle approximations from the preset triggers, watch a dim reference waveform and a "% match" badge tell you how close your spectrum is to the ideal Fourier coefficients, and notice partials past 0.9*Nyquist greyed-out with a red "!" warning so you can see where aliasing kicks in. Color ticks at bars 8/16/32/64 give a sense of how high up the spectrum you are painting.',
    category: 'mat-synthesis',
    subcategory: 'additive',
    code: `/**
   * Additive Partial Sculptor — MAT200B Phase 2 (additive synthesis)
   *
   * 64 harmonic partials of a fundamental, painted by mouse drag.
   * Top panel: bar chart (the spectrum you sculpt) with bandlimit
   *            warnings, colored frequency-ladder ticks, and a
   *            "% match" badge that scores against the ideal
   *            Fourier coefficients of the most recent preset.
   * Bottom panel: time-domain trace, one period summed from all 64
   *               sines, with a dim reference of the IDEAL preset
   *               target overlaid underneath the live trace.
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

  static const int NUM_PARTIALS = 64;
  static const int WAVE_SAMPLES = 384;

  class AdditiveSculptor : public App {
  public:
  ParameterBool playing {"playing", "", true};
  Parameter pitch_hz   {"pitch_hz",   "", 110.0f, 40.0f, 1200.0f};
  Parameter master_amp {"master_amp", "", 0.25f,   0.0f,    1.0f};
  Trigger reset            {"reset",            ""};
  Trigger preset_saw       {"preset_saw",       ""};
  Trigger preset_square    {"preset_square",    ""};
  Trigger preset_triangle  {"preset_triangle",  ""};

  ControlGUI gui;

  std::array<gam::Sine<>, NUM_PARTIALS> osc;
  std::array<std::atomic<float>, NUM_PARTIALS> partialAmps;
  std::array<float, NUM_PARTIALS> ampsSnapshot{};
  std::array<float, WAVE_SAMPLES> waveBuf{};
  std::array<float, WAVE_SAMPLES> targetWave{};

  // Sample rate published from audio thread (defaults to 48 k until
  // the first onSound callback updates it).
  std::atomic<float> sampleRateHz{48000.0f};

  enum LastPreset { PRESET_NONE, PRESET_SAW, PRESET_SQUARE, PRESET_TRIANGLE };
  std::atomic<int> lastPreset{PRESET_NONE};

  bool dragging = false;

  // Bar panel rect in world coords.
  static constexpr float BAR_X0 = -1.30f, BAR_X1 = 1.30f;
  static constexpr float BAR_Y0 =  0.10f, BAR_Y1 = 0.85f;
  static constexpr float WAV_X0 = -1.30f, WAV_X1 = 1.30f;
  static constexpr float WAV_Y0 = -0.85f, WAV_Y1 = -0.10f;

  // Closed-form ideal Fourier coefficient for partial n (1-indexed).
  // Saw       a_n = -2 / (pi * n)            (all n)
  // Square    a_n =  4 / (pi * n)            (odd n only)
  // Triangle  a_n =  8 / (pi^2 * n^2) * (-1)^((n-1)/2)   (odd n only)
  // We compare absolute amplitudes (the bars are unsigned), so we use
  // |a_n| for the "% match" score and the signed value (with the same
  // normalisation used by the audio loop) for the target waveform.
  static float idealCoefSigned(int preset, int n /*1-indexed*/) {
    const float pi = static_cast<float>(M_PI);
    if (preset == PRESET_SAW) return -2.0f / (pi * float(n));
    if (preset == PRESET_SQUARE) {
      if (n % 2 == 0) return 0.0f;
      return 4.0f / (pi * float(n));
    }
    if (preset == PRESET_TRIANGLE) {
      if (n % 2 == 0) return 0.0f;
      const int k = (n - 1) / 2;
      const float sign = (k % 2 == 0) ? 1.0f : -1.0f;
      return sign * 8.0f / (pi * pi * float(n) * float(n));
    }
    return 0.0f;
  }
  static float idealCoefMag(int preset, int n) {
    return std::fabs(idealCoefSigned(preset, n));
  }

  void onInit() override {
    for (int i = 0; i < NUM_PARTIALS; ++i) partialAmps[i].store(0.0f);

    reset.registerChangeCallback([this](float) {
      for (int i = 0; i < NUM_PARTIALS; ++i) partialAmps[i].store(0.0f);
      lastPreset.store(PRESET_NONE);
    });
    preset_saw.registerChangeCallback([this](float) {
      for (int i = 0; i < NUM_PARTIALS; ++i)
        partialAmps[i].store(1.0f / float(i + 1));
      lastPreset.store(PRESET_SAW);
    });
    preset_square.registerChangeCallback([this](float) {
      for (int i = 0; i < NUM_PARTIALS; ++i) {
        const int n = i + 1;
        partialAmps[i].store((n % 2 == 1) ? 1.0f / float(n) : 0.0f);
      }
      lastPreset.store(PRESET_SQUARE);
    });
    preset_triangle.registerChangeCallback([this](float) {
      for (int i = 0; i < NUM_PARTIALS; ++i) {
        const int n = i + 1;
        partialAmps[i].store((n % 2 == 1) ? 1.0f / float(n * n) : 0.0f);
      }
      lastPreset.store(PRESET_TRIANGLE);
    });

    gui << playing << pitch_hz << master_amp << reset
        << preset_saw << preset_square << preset_triangle;
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
    for (int i = 0; i < NUM_PARTIALS; ++i) osc[i].freq(pitch_hz.get() * float(i + 1));
  }

  void onSound(AudioIOData& io) override {
    sampleRateHz.store(static_cast<float>(io.framesPerSecond()),
                       std::memory_order_relaxed);
    if (!playing.get()) {
      while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
      return;
    }
    const float f0  = pitch_hz.get();
    const float amp = master_amp.get();
    for (int i = 0; i < NUM_PARTIALS; ++i) osc[i].freq(f0 * float(i + 1));

    float a[NUM_PARTIALS];
    float norm = 0.0f;
    for (int i = 0; i < NUM_PARTIALS; ++i) {
      a[i] = partialAmps[i].load(std::memory_order_relaxed);
      norm += a[i];
    }
    const float invNorm = (norm > 1.0f) ? (1.0f / norm) : 1.0f;

    while (io()) {
      float s = 0.0f;
      for (int i = 0; i < NUM_PARTIALS; ++i) s += a[i] * osc[i]();
      s *= amp * invNorm;
      io.out(0) = s;
      io.out(1) = s;
    }
  }

  // Mean-squared closeness over partials 1..NUM_PARTIALS, normalised so
  // that "you matched the preset perfectly" ~ 1.0 and "everything else"
  // approaches 0. We compare each bar amplitude to |ideal_n| AFTER
  // normalising the ideal vector to its own max so the units match the
  // [0,1] painted bars.
  float computeMatch(int preset) const {
    if (preset == PRESET_NONE) return 0.0f;
    float ideal[NUM_PARTIALS];
    float maxIdeal = 0.0f;
    for (int i = 0; i < NUM_PARTIALS; ++i) {
      ideal[i] = idealCoefMag(preset, i + 1);
      if (ideal[i] > maxIdeal) maxIdeal = ideal[i];
    }
    if (maxIdeal <= 0.0f) return 0.0f;
    for (int i = 0; i < NUM_PARTIALS; ++i) ideal[i] /= maxIdeal;

    float mse = 0.0f;
    for (int i = 0; i < NUM_PARTIALS; ++i) {
      float a = ampsSnapshot[i];
      if (a < 0.f) a = 0.f; else if (a > 1.f) a = 1.f;
      const float d = a - ideal[i];
      mse += d * d;
    }
    mse /= float(NUM_PARTIALS);
    // Convert MSE to a 0..1 score; 0 MSE -> 1.0, MSE >= 0.25 -> 0.0.
    float score = 1.0f - (mse / 0.25f);
    if (score < 0.f) score = 0.f;
    if (score > 1.f) score = 1.f;
    return score;
  }

  void onAnimate(double /*dt*/) override {
    for (int i = 0; i < NUM_PARTIALS; ++i)
      ampsSnapshot[i] = partialAmps[i].load(std::memory_order_relaxed);

    float norm = 0.0f;
    for (int i = 0; i < NUM_PARTIALS; ++i) norm += ampsSnapshot[i];
    const float invNorm = (norm > 1.0f) ? (1.0f / norm) : 1.0f;

    for (int s = 0; s < WAVE_SAMPLES; ++s) {
      const float t = float(s) / float(WAVE_SAMPLES);
      const float phase = 2.0f * float(M_PI) * t;
      float v = 0.0f;
      for (int i = 0; i < NUM_PARTIALS; ++i)
        v += ampsSnapshot[i] * std::sin(phase * float(i + 1));
      waveBuf[s] = v * invNorm;
    }

    // Build the IDEAL target waveform for the most recent preset using
    // the SIGNED Fourier coefficients (so saw really looks like a saw,
    // not a wobble). Normalised the same way as the live trace.
    const int preset = lastPreset.load(std::memory_order_relaxed);
    if (preset == PRESET_NONE) {
      for (int s = 0; s < WAVE_SAMPLES; ++s) targetWave[s] = 0.0f;
    } else {
      float coef[NUM_PARTIALS];
      float coefNorm = 0.0f;
      for (int i = 0; i < NUM_PARTIALS; ++i) {
        coef[i] = idealCoefSigned(preset, i + 1);
        coefNorm += std::fabs(coef[i]);
      }
      const float invCoefNorm = (coefNorm > 1.0f) ? (1.0f / coefNorm) : 1.0f;
      for (int s = 0; s < WAVE_SAMPLES; ++s) {
        const float t = float(s) / float(WAVE_SAMPLES);
        const float phase = 2.0f * float(M_PI) * t;
        float v = 0.0f;
        for (int i = 0; i < NUM_PARTIALS; ++i)
          v += coef[i] * std::sin(phase * float(i + 1));
        targetWave[s] = v * invCoefNorm;
      }
    }
    (void)invNorm;
  }

  // Convert mouse pixel coords to the same world space we draw into.
  void mouseToWorld(const Mouse& m, float& wx, float& wy) const {
    const float w = (float)width();
    const float h = (float)height();
    const float u = (w > 0.f) ? (float)m.x() / w : 0.f;
    const float v = (h > 0.f) ? (float)m.y() / h : 0.f;
    wx = -1.5f + u * 3.0f;
    wy =  0.9f - v * 1.8f;
  }

  bool inBarPanel(float wx, float wy) const {
    return wx >= BAR_X0 && wx <= BAR_X1 && wy >= BAR_Y0 && wy <= BAR_Y1;
  }

  void paintAt(float wx, float wy) {
    float u = (wx - BAR_X0) / (BAR_X1 - BAR_X0);
    if (u < 0.f) u = 0.f; else if (u > 0.9999f) u = 0.9999f;
    int idx = int(u * float(NUM_PARTIALS));
    if (idx < 0) idx = 0; else if (idx >= NUM_PARTIALS) idx = NUM_PARTIALS - 1;

    float v = (wy - BAR_Y0) / (BAR_Y1 - BAR_Y0);
    if (v < 0.f) v = 0.f; else if (v > 1.f) v = 1.f;
    partialAmps[idx].store(v);
    // Manual painting invalidates the preset-matching reference.
    lastPreset.store(PRESET_NONE);
  }

  bool onMouseDown(const Mouse& m) override {
    float wx, wy;
    mouseToWorld(m, wx, wy);
    if (inBarPanel(wx, wy)) {
      dragging = true;
      paintAt(wx, wy);
    }
    return false;
  }

  bool onMouseDrag(const Mouse& m) override {
    if (!dragging) return false;
    float wx, wy;
    mouseToWorld(m, wx, wy);
    if (wx < BAR_X0) wx = BAR_X0;
    if (wx > BAR_X1) wx = BAR_X1;
    if (wy < BAR_Y0) wy = BAR_Y0;
    if (wy > BAR_Y1) wy = BAR_Y1;
    paintAt(wx, wy);
    return false;
  }

  bool onMouseUp(const Mouse&) override {
    dragging = false;
    return false;
  }

  static void emitRect(Mesh& m, float x0, float y0, float x1, float y1,
                       float r, float g, float b) {
    m.vertex(x0, y0, 0.f); m.color(r, g, b);
    m.vertex(x1, y0, 0.f); m.color(r, g, b);
    m.vertex(x0, y1, 0.f); m.color(r, g, b);
    m.vertex(x1, y0, 0.f); m.color(r, g, b);
    m.vertex(x1, y1, 0.f); m.color(r, g, b);
    m.vertex(x0, y1, 0.f); m.color(r, g, b);
  }

  // Triangle (3-vertex fan) — used for the red "!" alias warning marker.
  static void emitTri(Mesh& m, float x0, float y0, float x1, float y1,
                      float x2, float y2, float r, float g, float b) {
    m.vertex(x0, y0, 0.f); m.color(r, g, b);
    m.vertex(x1, y1, 0.f); m.color(r, g, b);
    m.vertex(x2, y2, 0.f); m.color(r, g, b);
  }

  static void partialColor(int i, float& r, float& g, float& b) {
    const float t = float(i) / float(NUM_PARTIALS - 1);
    if (t < 0.5f) {
      const float u = t * 2.0f;
      r = 0.10f * (1 - u) + 0.20f * u;
      g = 0.40f * (1 - u) + 0.90f * u;
      b = 0.90f * (1 - u) + 0.30f * u;
    } else {
      const float u = (t - 0.5f) * 2.0f;
      r = 0.20f * (1 - u) + 1.00f * u;
      g = 0.90f * (1 - u) + 0.30f * u;
      b = 0.30f * (1 - u) + 0.10f * u;
    }
  }

  void onDraw(Graphics& g) override {
    g.clear(0.06f, 0.07f, 0.09f);
    g.meshColor();

    const float f0       = pitch_hz.get();
    const float sr       = sampleRateHz.load(std::memory_order_relaxed);
    const float nyquist  = 0.5f * sr;
    const float aliasCap = 0.9f * nyquist;
    const int   preset   = lastPreset.load(std::memory_order_relaxed);

    Mesh grid; grid.primitive(Mesh::LINES);
    auto hline = [&](float y, float r, float gC, float b) {
      grid.vertex(BAR_X0, y, 0); grid.color(r, gC, b);
      grid.vertex(BAR_X1, y, 0); grid.color(r, gC, b);
    };
    hline(BAR_Y1, 0.18f, 0.20f, 0.24f);
    hline(BAR_Y0 + 0.5f * (BAR_Y1 - BAR_Y0), 0.18f, 0.20f, 0.24f);
    hline(BAR_Y0, 0.18f, 0.20f, 0.24f);
    for (int i = 0; i <= NUM_PARTIALS; i += 4) {
      const float u = float(i) / float(NUM_PARTIALS);
      const float x = BAR_X0 + u * (BAR_X1 - BAR_X0);
      grid.vertex(x, BAR_Y0, 0); grid.color(0.18f, 0.20f, 0.24f);
      grid.vertex(x, BAR_Y1, 0); grid.color(0.18f, 0.20f, 0.24f);
    }
    g.draw(grid);

    Mesh bars;    bars.primitive(Mesh::TRIANGLES);
    Mesh markers; markers.primitive(Mesh::TRIANGLES);
    const float barW = (BAR_X1 - BAR_X0) / float(NUM_PARTIALS);
    for (int i = 0; i < NUM_PARTIALS; ++i) {
      float a = ampsSnapshot[i];
      if (a < 0.f) a = 0.f; else if (a > 1.f) a = 1.f;
      const float x0 = BAR_X0 + float(i) * barW + barW * 0.08f;
      const float x1 = BAR_X0 + float(i + 1) * barW - barW * 0.08f;
      const float y0 = BAR_Y0;
      const float y1 = BAR_Y0 + a * (BAR_Y1 - BAR_Y0);

      const float partialFreq = f0 * float(i + 1);
      const bool aliasing = (partialFreq > aliasCap);

      float cr, cg, cb;
      partialColor(i, cr, cg, cb);
      if (aliasing) {
        // Dim/grey the bar so it visually retreats.
        cr = cr * 0.25f + 0.10f;
        cg = cg * 0.25f + 0.10f;
        cb = cb * 0.25f + 0.10f;
      }
      emitRect(bars, x0, y0, x1, y1, cr, cg, cb);

      if (aliasing) {
        // Tiny red "!" — a triangle pointing down above the bar tip.
        const float cx = 0.5f * (x0 + x1);
        const float my = (y1 < BAR_Y1 - 0.04f) ? (y1 + 0.025f) : (BAR_Y1 - 0.02f);
        const float halfW = std::min(barW * 0.45f, 0.018f);
        emitTri(markers,
                cx - halfW, my + 0.030f,
                cx + halfW, my + 0.030f,
                cx,         my,
                0.95f, 0.20f, 0.20f);
      }
    }
    g.draw(bars);
    g.draw(markers);

    // Frequency-ladder ticks at bars 8 / 16 / 32 / 64 — colored verticals
    // so the eye sees how high up the spectrum the painting is reaching.
    Mesh ticks; ticks.primitive(Mesh::LINES);
    auto tickAt = [&](int barIndex /*1-indexed*/, float r, float gC, float b,
                      float lenScale) {
      if (barIndex < 1 || barIndex > NUM_PARTIALS) return;
      const float u = float(barIndex - 1 + 0.5f) / float(NUM_PARTIALS);
      const float x = BAR_X0 + u * (BAR_X1 - BAR_X0);
      const float y0 = BAR_Y0 - 0.005f;
      const float y1 = BAR_Y0 - 0.005f - 0.05f * lenScale;
      ticks.vertex(x, y0, 0); ticks.color(r, gC, b);
      ticks.vertex(x, y1, 0); ticks.color(r, gC, b);
    };
    tickAt(8,  0.95f, 0.85f, 0.30f, 1.0f);  // yellow,  short
    tickAt(16, 0.95f, 0.55f, 0.20f, 1.5f);  // orange,  medium
    tickAt(32, 0.95f, 0.25f, 0.20f, 2.0f);  // red,     long
    tickAt(64, 0.30f, 0.95f, 0.55f, 2.5f);  // green,   longest
    g.draw(ticks);

    // Wave panel.
    const float waveMidY = WAV_Y0 + 0.5f * (WAV_Y1 - WAV_Y0);
    Mesh wgrid; wgrid.primitive(Mesh::LINES);
    auto whline = [&](float y) {
      wgrid.vertex(WAV_X0, y, 0); wgrid.color(0.18f, 0.20f, 0.24f);
      wgrid.vertex(WAV_X1, y, 0); wgrid.color(0.18f, 0.20f, 0.24f);
    };
    whline(WAV_Y0); whline(WAV_Y1); whline(waveMidY);
    g.draw(wgrid);

    // Dim white reference of the IDEAL preset target (drawn first so the
    // bright yellow live trace overlays it).
    if (preset != PRESET_NONE) {
      Mesh tgt; tgt.primitive(Mesh::LINE_STRIP);
      for (int s = 0; s < WAVE_SAMPLES; ++s) {
        const float u = float(s) / float(WAVE_SAMPLES - 1);
        const float x = WAV_X0 + u * (WAV_X1 - WAV_X0);
        float v = targetWave[s];
        if (v < -1.f) v = -1.f; else if (v > 1.f) v = 1.f;
        const float y = waveMidY + 0.5f * v * (WAV_Y1 - WAV_Y0);
        tgt.vertex(x, y, 0.f);
        tgt.color(0.55f, 0.55f, 0.55f);
      }
      g.draw(tgt);
    }

    Mesh wave; wave.primitive(Mesh::LINE_STRIP);
    for (int s = 0; s < WAVE_SAMPLES; ++s) {
      const float u = float(s) / float(WAVE_SAMPLES - 1);
      const float x = WAV_X0 + u * (WAV_X1 - WAV_X0);
      float v = waveBuf[s];
      if (v < -1.f) v = -1.f; else if (v > 1.f) v = 1.f;
      const float y = waveMidY + 0.5f * v * (WAV_Y1 - WAV_Y0);
      wave.vertex(x, y, 0.f);
      wave.color(0.95f, 0.85f, 0.35f);
    }
    g.draw(wave);

    Mesh borders; borders.primitive(Mesh::LINES);
    auto rectOutline = [&](float x0, float y0, float x1, float y1,
                           float r, float gC, float b) {
      borders.vertex(x0, y0, 0); borders.color(r, gC, b);
      borders.vertex(x1, y0, 0); borders.color(r, gC, b);
      borders.vertex(x1, y0, 0); borders.color(r, gC, b);
      borders.vertex(x1, y1, 0); borders.color(r, gC, b);
      borders.vertex(x1, y1, 0); borders.color(r, gC, b);
      borders.vertex(x0, y1, 0); borders.color(r, gC, b);
      borders.vertex(x0, y1, 0); borders.color(r, gC, b);
      borders.vertex(x0, y0, 0); borders.color(r, gC, b);
    };
    rectOutline(BAR_X0, BAR_Y0, BAR_X1, BAR_Y1, 0.30f, 0.55f, 0.80f);
    rectOutline(WAV_X0, WAV_Y0, WAV_X1, WAV_Y1, 0.85f, 0.55f, 0.25f);
    g.draw(borders);

    // "% match" badge: a small horizontal progress bar in the top-right
    // showing how close the current spectrum is to the active preset.
    if (preset != PRESET_NONE) {
      const float score = computeMatch(preset);
      Mesh badge; badge.primitive(Mesh::TRIANGLES);
      const float bx0 = 0.85f, bx1 = 1.30f;
      const float by0 = 0.90f, by1 = 0.96f;
      // Background track.
      emitRect(badge, bx0, by0, bx1, by1, 0.15f, 0.16f, 0.20f);
      // Filled portion.
      const float fillX = bx0 + score * (bx1 - bx0);
      // Color goes red -> yellow -> green with score.
      float rr = 0.95f - 0.65f * score;
      float gg = 0.30f + 0.60f * score;
      float bb = 0.25f + 0.10f * score;
      emitRect(badge, bx0, by0 + 0.005f, fillX, by1 - 0.005f, rr, gg, bb);
      g.draw(badge);

      // Notch tick marks at 25 / 50 / 75 / 100 % — gives a sense of scale.
      Mesh notches; notches.primitive(Mesh::LINES);
      for (int q = 1; q <= 4; ++q) {
        const float fx = bx0 + 0.25f * float(q) * (bx1 - bx0);
        notches.vertex(fx, by0 - 0.005f, 0); notches.color(0.7f, 0.7f, 0.75f);
        notches.vertex(fx, by1 + 0.005f, 0); notches.color(0.7f, 0.7f, 0.75f);
      }
      g.draw(notches);
    }

    gui.draw(g);
  }

  // Musical keyboard: each key sets the fundamental.
  static int noteFromKey(int key) {
    static const int kbd[] = {
      'Z',48,'X',50,'C',52,'V',53,'B',55,'N',57,'M',59,
      'A',60,'S',62,'D',64,'F',65,'G',67,'H',69,'J',71,
      'Q',72,'W',74,'E',76,'R',77,'T',79,'Y',81,'U',83
    };
    for (int i = 0; i < 21; ++i) {
      const int K = kbd[i*2];
      if (key == K || key == K + 32) return kbd[i*2 + 1];
    }
    return -1;
  }
  bool onKeyDown(const Keyboard& k) override {
    const int n = noteFromKey(k.key());
    if (n >= 0) pitch_hz.set(440.0f * std::pow(2.0f, (n - 69) / 12.0f));
    return true;
  }
  };

  ALLOLIB_WEB_MAIN(AdditiveSculptor)
  `,
  },
  {
    id: 'mat-granul-stretch',
    title: 'Granulation Time-Stretcher',
    description:
      'Time-stretches a bundled CC0 audio loop by triggering up to 64 overlapping Hann-windowed grains read from a slowly-advancing source position. The stretch factor controls how slowly readPos creeps through the source while each grain plays back at an independent pitch (in semitones), so pitch and time are decoupled. Top: full source envelope with a red box highlighting the current jittered read region. Middle (expanded): real-time playhead (white) AND stretched readPos cursor (red) overlaid on the SAME axis — direct visual comparison of "where you would be" vs. "where you are." Bottom: 32 most-recently-spawned grains as dots whose X follows the grain\\u2019s CURRENT playhead (pitch-shifted dots have visibly non-horizontal drift), colored by elapsed wallclock since spawn. transient_protect toggle disables jitter within ~30ms of detected onsets to preserve drum hits.',
    category: 'mat-signal',
    subcategory: 'delay',
    code: `/**
   * Granulation Time-Stretcher — MAT200B Phase 2 (granular DSP, v0.13.x upgrade)
   *
   * 64 overlapping grains read from a bundled loop. readPos advances
   * by (srcSR / hostSR) / stretch per output sample; each grain plays
   * back at its own pitch ratio so pitch and time decouple.
   *
   * Upgrades:
   *   - Fix grain-age coloring: each RecentGrain stores spawnTimeSamples
   *     (audio-thread sample counter); age in onAnimate is computed from
   *     elapsed audio samples, not array slot index.
   *   - Expand middle real-time playhead panel to y in [-0.05, 0.20] and
   *     overlay BOTH cursors: real-time (white) + actual readPos (red).
   *   - Animate scatter dots by current grain playhead (startFrame +
   *     age*pitchRate*srcSR), so pitch-shifted dots drift visibly.
   *   - transient_protect toggle: precompute an onset mask via energy
   *     derivative of high-passed source envelope; audio thread skips
   *     jitter for samples whose source-position falls in an onset
   *     window (~30 ms after each detected onset).
   */

  #include "al_playground_compat.hpp"
  #include "al_WebSamplePlayer.hpp"

  #include <array>
  #include <atomic>
  #include <cmath>
  #include <vector>
  #include <algorithm>

  #ifndef M_PI
  #define M_PI 3.14159265358979323846
  #endif

  using namespace al;

  static const int kMaxGrains = 64;
  static const int kEnvelopeBins = 256;
  static const int kRecentGrains = 32;

  class GranulStretch : public App {
  public:
    ControlGUI gui;
    WebSamplePlayer pDrums, pPad, pMixed;

    ParameterMenu source           {"source",            ""};
    ParameterBool playing          {"playing",           "", true};
    Parameter     stretch          {"stretch",           "",  1.0f,  0.25f, 4.0f};
    Parameter     pitch_semitones  {"pitch_semitones",   "",  0.0f, -12.0f, 12.0f};
    Parameter     grain_ms         {"grain_ms",          "", 80.0f,  30.0f, 200.0f};
    Parameter     density_hz       {"density_hz",        "", 20.0f,   5.0f, 40.0f};
    Parameter     jitter           {"jitter",            "",  0.005f, 0.0f, 0.05f};
    Parameter     amp              {"amp",               "",  0.6f,   0.0f, 1.0f};
    ParameterBool transient_protect{"transient_protect", "", false};
    Trigger       retrigger        {"retrigger",         ""};

    struct Grain {
      bool   active     = false;
      double srcPos     = 0.0;     // current source playhead
      double srcStart   = 0.0;     // spawn position in source frames
      double rate       = 1.0;     // source frames per output sample
      int    age        = 0;
      int    dur        = 1;
    };
    std::array<Grain, kMaxGrains> grains{};
    double readPos = 0.0;
    unsigned int rngState = 0xC0FFEEu;

    std::atomic<float>     readPosNormA{0.0f};
    std::atomic<long long> outputSamplesA{0};
    std::atomic<int>       grainHeadA{0};

    // Audio-thread sample counter (number of output samples produced
    // since boot). Used as a wallclock-equivalent for grain spawn time.
    long long sampleCounter = 0;

    struct RecentGrain {
      float srcNorm     = -1.0f;
      float pitchOffset =  0.0f;
      long long spawnTimeSamples = 0;
      float pitchRate   = 1.0f;
      int   durSamps    = 1;
      int   nFramesAtSpawn = 1;
    };
    std::array<RecentGrain, kRecentGrains> recent{};

    double wallSeconds = 0.0;
    double retriggerWall = 0.0;
    std::vector<float> envMin, envMax;
    // Onset mask: 1 = "onset window" (~30 ms after detected onset).
    std::vector<int>   onsetMask;
    int envSourceIdx = -1;
    float hostSR = 48000.0f;

    WebSamplePlayer* current() {
      const int s = static_cast<int>(source.get());
      if (s == 0) return &pDrums;
      if (s == 1) return &pPad;
      return &pMixed;
    }

    float frand() {
      rngState ^= rngState << 13;
      rngState ^= rngState >> 17;
      rngState ^= rngState << 5;
      return (rngState & 0xFFFFFF) / 16777216.0f;
    }

    void onInit() override {
      for (auto& r : recent) {
        r.srcNorm = -1.0f;
        r.pitchOffset = 0.0f;
        r.spawnTimeSamples = 0;
        r.pitchRate = 1.0f;
        r.durSamps = 1;
        r.nFramesAtSpawn = 1;
      }

      source.setElements({"drums", "pad", "mixed"});
      source.set(0);

      gui << source << playing << stretch << pitch_semitones << grain_ms
          << density_hz << jitter << amp << transient_protect << retrigger;

      retrigger.registerChangeCallback([this](float){
        readPos = 0.0;
        retriggerWall = wallSeconds;
        for (auto& g : grains) g.active = false;
      });

      source.registerChangeCallback([this](float){
        readPos = 0.0;
        retriggerWall = wallSeconds;
        envSourceIdx = -1;
      });
    }

    void onCreate() override {
      gui.init();
      pDrums.load("drum_loop_120bpm.wav");
      pPad.load("pad_loop.wav");
      pMixed.load("mixed_loop.wav");
      nav().pos(0, 0, 4.0f);
    }

    // Build the envelope plot AND the onset mask in one pass.
    void buildEnvelope(WebSamplePlayer* sp) {
      envMin.assign(kEnvelopeBins, 0.0f);
      envMax.assign(kEnvelopeBins, 0.0f);
      onsetMask.clear();
      if (!sp || !sp->ready()) return;
      const int frames = sp->frames();
      if (frames <= 0) return;

      // Envelope strip.
      const int chunk = std::max(1, frames / kEnvelopeBins);
      for (int b = 0; b < kEnvelopeBins; ++b) {
        const int s0 = static_cast<int>(static_cast<long long>(b) * frames / kEnvelopeBins);
        const int s1 = std::min(frames, s0 + chunk);
        float lo = 1.0f, hi = -1.0f;
        for (int i = s0; i < s1; ++i) {
          const float v = sp->readInterp(0, static_cast<float>(i));
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        envMin[b] = lo;
        envMax[b] = hi;
      }

      // Onset mask: simple energy-derivative detector.
      // 1) one-pole high-pass, 2) abs-envelope follower, 3) derivative,
      // 4) threshold; mark a 30 ms window after each detected peak.
      const float srcSR = sp->sampleRate() > 1.f ? sp->sampleRate() : hostSR;
      const int   windowSamps = std::max(1, static_cast<int>(0.030f * srcSR));
      onsetMask.assign(frames, 0);

      // High-pass: y = x - prevX + 0.97 * prevY. (Cheap one-pole HPF.)
      // Then envelope follower (peak-track). Then derivative.
      float prevX = 0.f, prevY = 0.f;
      float envF = 0.f;
      const float envCoef = std::exp(-1.0f / (0.005f * srcSR));   // ~5 ms
      std::vector<float> envBuf(frames, 0.f);
      for (int i = 0; i < frames; ++i) {
        const float x = sp->readInterp(0, static_cast<float>(i));
        const float y = x - prevX + 0.97f * prevY;
        prevX = x; prevY = y;
        const float ax = std::abs(y);
        envF = (ax > envF) ? ax : (ax + envCoef * (envF - ax));
        envBuf[i] = envF;
      }
      // Derivative + threshold. Threshold is a fraction of running peak.
      float runMax = 1e-6f;
      for (int i = 0; i < frames; ++i) runMax = std::max(runMax, envBuf[i]);
      const float thresh = runMax * 0.20f;
      int lastOnset = -windowSamps * 4;
      for (int i = 1; i < frames; ++i) {
        const float deriv = envBuf[i] - envBuf[i - 1];
        // Refractory: only mark a new onset if we're not still in the
        // tail of the previous one (separate by >= windowSamps).
        if (deriv > thresh * 0.05f && envBuf[i] > thresh
            && (i - lastOnset) > windowSamps) {
          const int s0 = i;
          const int s1 = std::min(frames, i + windowSamps);
          for (int k = s0; k < s1; ++k) onsetMask[k] = 1;
          lastOnset = i;
        }
      }
    }

    void onSound(AudioIOData& io) override {
      hostSR = static_cast<float>(io.framesPerSecond());
      WebSamplePlayer* sp = current();
      if (!playing.get() || !sp || !sp->ready()) {
        while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
        return;
      }
      const int   srcFrames = sp->frames();
      const float srcSR     = sp->sampleRate();
      if (srcFrames <= 0) {
        while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
        return;
      }

      const float st            = std::max(0.0001f, stretch.get());
      const float readAdv       = (srcSR / hostSR) / st;
      const float pitchRate     = std::pow(2.0f, pitch_semitones.get() / 12.0f) * (srcSR / hostSR);
      const float grainDurSamps = grain_ms.get() * 0.001f * hostSR;
      const float spawnProb     = density_hz.get() / hostSR;
      const float jitterFrames  = jitter.get() * srcSR;
      const float ampVal        = amp.get();
      const float densNorm      = 1.0f / std::sqrt(std::max(1.0f, density_hz.get() * grain_ms.get() * 0.001f));
      const bool  protectOn     = transient_protect.get();
      int recentHead = grainHeadA.load(std::memory_order_relaxed);
      long long outCounter = outputSamplesA.load(std::memory_order_relaxed);
      const bool  haveMask = (static_cast<int>(onsetMask.size()) == srcFrames);

      while (io()) {
        if (frand() < spawnProb) {
          for (int gi = 0; gi < kMaxGrains; ++gi) {
            if (!grains[gi].active) {
              // Apply jitter EXCEPT when transient_protect is on AND
              // the current readPos falls inside an onset window.
              float jit = (frand() * 2.0f - 1.0f) * jitterFrames;
              if (protectOn && haveMask) {
                int rpIdx = static_cast<int>(readPos);
                if (rpIdx < 0) rpIdx = 0;
                if (rpIdx >= srcFrames) rpIdx = srcFrames - 1;
                if (onsetMask[rpIdx]) jit = 0.f;
              }
              double startFrame = readPos + jit;
              while (startFrame < 0)         startFrame += srcFrames;
              while (startFrame >= srcFrames) startFrame -= srcFrames;
              grains[gi].active   = true;
              grains[gi].srcPos   = startFrame;
              grains[gi].srcStart = startFrame;
              grains[gi].rate     = pitchRate;
              grains[gi].age      = 0;
              grains[gi].dur      = std::max(2, static_cast<int>(grainDurSamps));
              recent[recentHead].srcNorm     = static_cast<float>(startFrame / static_cast<double>(srcFrames));
              recent[recentHead].pitchOffset = pitch_semitones.get() / 12.0f;
              recent[recentHead].spawnTimeSamples = sampleCounter;
              recent[recentHead].pitchRate   = pitchRate;
              recent[recentHead].durSamps    = grains[gi].dur;
              recent[recentHead].nFramesAtSpawn = srcFrames;
              recentHead = (recentHead + 1) % kRecentGrains;
              break;
            }
          }
        }

        float out = 0.0f;
        for (int gi = 0; gi < kMaxGrains; ++gi) {
          Grain& g = grains[gi];
          if (!g.active) continue;
          const float t = static_cast<float>(g.age) / static_cast<float>(g.dur);
          const float env = 0.5f * (1.0f - std::cos(2.0f * static_cast<float>(M_PI) * t));
          double sp_pos = g.srcPos;
          while (sp_pos < 0)          sp_pos += srcFrames;
          while (sp_pos >= srcFrames) sp_pos -= srcFrames;
          out += sp->readInterp(0, static_cast<float>(sp_pos)) * env;
          g.srcPos += g.rate;
          if (++g.age >= g.dur) g.active = false;
        }

        const float y = out * ampVal * densNorm;
        io.out(0) = y;
        io.out(1) = y;

        readPos += readAdv;
        while (readPos < 0)           readPos += srcFrames;
        while (readPos >= srcFrames)  readPos -= srcFrames;
        ++outCounter;
        ++sampleCounter;
      }

      readPosNormA.store(static_cast<float>(readPos / static_cast<double>(srcFrames)),
                         std::memory_order_relaxed);
      outputSamplesA.store(outCounter, std::memory_order_relaxed);
      grainHeadA.store(recentHead, std::memory_order_relaxed);
    }

    void onAnimate(double dt) override {
      wallSeconds += dt;
      const int sIdx = static_cast<int>(source.get());
      if (sIdx != envSourceIdx) {
        WebSamplePlayer* sp = current();
        if (sp && sp->ready()) {
          buildEnvelope(sp);
          envSourceIdx = sIdx;
        }
      }
    }

    static void emitRect(Mesh& m, float x, float y, float w, float h,
                         float r, float gC, float b) {
      m.vertex(x,     y,     0); m.color(r, gC, b);
      m.vertex(x + w, y,     0); m.color(r, gC, b);
      m.vertex(x,     y + h, 0); m.color(r, gC, b);
      m.vertex(x + w, y,     0); m.color(r, gC, b);
      m.vertex(x + w, y + h, 0); m.color(r, gC, b);
      m.vertex(x,     y + h, 0); m.color(r, gC, b);
    }

    void onDraw(Graphics& g) override {
      g.clear(0.05f, 0.05f, 0.07f);
      g.meshColor();

      constexpr float xL = -1.4f, xR = 1.4f;
      constexpr float topY0 = 0.30f,  topY1 = 0.95f;
      // Expanded middle panel: y in [-0.05, 0.20].
      constexpr float midY0 = -0.05f, midY1 = 0.20f;
      constexpr float botY0 = -0.95f, botY1 = -0.15f;

      Mesh panels; panels.primitive(Mesh::TRIANGLES);
      emitRect(panels, xL, topY0, xR - xL, topY1 - topY0, 0.10f, 0.10f, 0.13f);
      emitRect(panels, xL, midY0, xR - xL, midY1 - midY0, 0.08f, 0.08f, 0.10f);
      emitRect(panels, xL, botY0, xR - xL, botY1 - botY0, 0.10f, 0.10f, 0.13f);
      g.draw(panels);

      // Top: source envelope (LINES bars) + onset-mask tint.
      if (static_cast<int>(envMin.size()) == kEnvelopeBins) {
        const float panelW  = xR - xL;
        const float midLine = 0.5f * (topY0 + topY1);
        const float halfH   = 0.45f * (topY1 - topY0);

        // Onset shading: pale orange columns for bins overlapping onset windows.
        WebSamplePlayer* sp = current();
        if (sp && sp->ready() && static_cast<int>(onsetMask.size()) == sp->frames()
            && transient_protect.get()) {
          Mesh onsetTint; onsetTint.primitive(Mesh::TRIANGLES);
          const int frames = sp->frames();
          for (int i = 0; i < kEnvelopeBins; ++i) {
            const int s0 = static_cast<int>(static_cast<long long>(i) * frames / kEnvelopeBins);
            const int s1 = std::min(frames, static_cast<int>(static_cast<long long>(i + 1) * frames / kEnvelopeBins));
            int hits = 0;
            for (int k = s0; k < s1; ++k) hits += onsetMask[k];
            if (hits > 0) {
              const float x = xL + (i / static_cast<float>(kEnvelopeBins - 1)) * panelW;
              const float w = panelW / static_cast<float>(kEnvelopeBins);
              emitRect(onsetTint, x, topY0, w, topY1 - topY0,
                       0.55f, 0.30f, 0.10f);
            }
          }
          g.draw(onsetTint);
        }

        Mesh wave; wave.primitive(Mesh::LINES);
        for (int i = 0; i < kEnvelopeBins; ++i) {
          const float x = xL + (i / static_cast<float>(kEnvelopeBins - 1)) * panelW;
          wave.vertex(x, midLine + envMin[i] * halfH, 0);
          wave.color(0.55f, 0.85f, 1.0f);
          wave.vertex(x, midLine + envMax[i] * halfH, 0);
          wave.color(0.55f, 0.85f, 1.0f);
        }
        g.draw(wave);

        const float rp = readPosNormA.load(std::memory_order_relaxed);
        float jitNorm = 0.0f;
        if (sp && sp->ready() && sp->frames() > 0) {
          jitNorm = (jitter.get() * sp->sampleRate()) / static_cast<float>(sp->frames());
        }
        const float halfBox = std::max(0.005f, jitNorm);
        const float bx0 = xL + std::max(0.0f, rp - halfBox) * panelW;
        const float bx1 = xL + std::min(1.0f, rp + halfBox) * panelW;
        Mesh box; box.primitive(Mesh::TRIANGLES);
        emitRect(box, bx0, topY0, std::max(0.005f, bx1 - bx0), topY1 - topY0,
                 0.85f, 0.20f, 0.20f);
        g.draw(box);

        Mesh ph; ph.primitive(Mesh::LINES);
        const float cx = xL + rp * panelW;
        ph.vertex(cx, topY0, 0); ph.color(1.0f, 0.5f, 0.5f);
        ph.vertex(cx, topY1, 0); ph.color(1.0f, 0.5f, 0.5f);
        g.draw(ph);
      }

      // Middle (expanded): real-time playhead (white) + readPos (red)
      // on the SAME axis. Real-time is wallclock since retrigger,
      // wrapped to source duration.
      {
        const float panelW = xR - xL;
        const double elapsed = wallSeconds - retriggerWall;
        WebSamplePlayer* sp = current();
        double srcSec = 1.0;
        if (sp && sp->ready() && sp->sampleRate() > 0.f)
          srcSec = static_cast<double>(sp->frames()) / static_cast<double>(sp->sampleRate());
        const double rtNorm = std::fmod(elapsed / std::max(0.001, srcSec), 1.0);
        const float rp = readPosNormA.load(std::memory_order_relaxed);

        // Mid axis line.
        Mesh ax; ax.primitive(Mesh::LINES);
        const float cy = 0.5f * (midY0 + midY1);
        ax.vertex(xL, cy, 0); ax.color(0.40f, 0.40f, 0.45f);
        ax.vertex(xR, cy, 0); ax.color(0.40f, 0.40f, 0.45f);
        g.draw(ax);

        // Real-time cursor (white).
        Mesh rtCur; rtCur.primitive(Mesh::TRIANGLES);
        const float rtX = xL + static_cast<float>(rtNorm) * panelW;
        emitRect(rtCur, rtX - 0.010f, midY0 + 0.015f, 0.020f,
                 midY1 - midY0 - 0.030f, 1.0f, 1.0f, 1.0f);
        g.draw(rtCur);

        // ReadPos cursor (red).
        Mesh rpCur; rpCur.primitive(Mesh::TRIANGLES);
        const float rpX = xL + rp * panelW;
        emitRect(rpCur, rpX - 0.010f, midY0 + 0.015f, 0.020f,
                 midY1 - midY0 - 0.030f, 0.95f, 0.30f, 0.30f);
        g.draw(rpCur);

        // Connector tick between them at the axis.
        Mesh link; link.primitive(Mesh::LINES);
        link.vertex(rtX, cy, 0); link.color(0.85f, 0.85f, 0.85f);
        link.vertex(rpX, cy, 0); link.color(0.95f, 0.30f, 0.30f);
        g.draw(link);
      }

      // Bottom: scatter dots — animated by current grain playhead, age
      // computed from elapsed audio samples since spawn.
      {
        const float panelW  = xR - xL;
        const float midLine = 0.5f * (botY0 + botY1);
        const float halfH   = 0.45f * (botY1 - botY0);
        Mesh axis; axis.primitive(Mesh::LINES);
        axis.vertex(xL, midLine, 0); axis.color(0.30f, 0.30f, 0.35f);
        axis.vertex(xR, midLine, 0); axis.color(0.30f, 0.30f, 0.35f);
        g.draw(axis);

        const long long counterNow = outputSamplesA.load(std::memory_order_relaxed);

        Mesh dots; dots.primitive(Mesh::TRIANGLES);
        for (int i = 0; i < kRecentGrains; ++i) {
          const RecentGrain& r = recent[i];
          if (r.srcNorm < 0) continue;

          // age (0..1) by elapsed samples / fade duration.
          const long long elapsed = counterNow - r.spawnTimeSamples;
          const float fadeSamps = static_cast<float>(std::max(1, r.durSamps * 4));
          float age = static_cast<float>(elapsed) / fadeSamps;
          if (age < 0.f) age = 0.f;
          if (age > 1.f) age = 1.f;

          // Animated x: startFrame + age * pitchRate * srcSR. Express in
          // source frames using stored snapshots.
          const int nFr = std::max(1, r.nFramesAtSpawn);
          const float startFrames = r.srcNorm * static_cast<float>(nFr);
          const float ageSamps    = age * fadeSamps;
          // pitchRate is source-frames per host-sample, so:
          const float curFrames = startFrames + ageSamps * r.pitchRate;
          float curNorm = std::fmod(curFrames / static_cast<float>(nFr), 1.0f);
          if (curNorm < 0.f) curNorm += 1.0f;

          const float x  = xL + curNorm * panelW;
          const float po = std::max(-1.0f, std::min(1.0f, r.pitchOffset));
          const float y  = midLine + po * halfH;
          // Color from elapsed wallclock (age), not array slot.
          const float bright = 1.0f - age;
          const float cr = 0.40f * (0.4f + 0.6f * bright);
          const float cg = 1.00f * (0.4f + 0.6f * bright);
          const float cb = 0.70f * (0.4f + 0.6f * bright);
          dots.vertex(x - 0.018f, y - 0.018f, 0); dots.color(cr, cg, cb);
          dots.vertex(x + 0.018f, y - 0.018f, 0); dots.color(cr, cg, cb);
          dots.vertex(x,          y + 0.022f, 0); dots.color(cr, cg, cb);
        }
        g.draw(dots);
      }

      gui.draw(g);
    }

    bool onMouseDown(const Mouse&) override { return false; }
    bool onMouseDrag(const Mouse&) override { return false; }
    bool onMouseUp  (const Mouse&) override { return false; }
  };

  ALLOLIB_WEB_MAIN(GranulStretch)
  `,
  },
  {
    id: 'mat-synesthetic-mapper',
    title: 'Synesthetic Mapper',
    description:
      'Extracts four per-block audio features from a bundled CC0 loop — RMS amplitude, spectral centroid, zero-crossing rate, and spectral flatness — then routes any feature to any visual channel of a glyph ensemble. Pick which feature drives size, hue, vertical position, and rotation through ParameterMenu controls. Visual aids include: a 4x4 routing matrix at the top-right (rows = visual channels, cols = features) showing the active mapping, motion trails on each glyph (last 8 frames), a faint live spectrum curve behind the glyph row, and a color-keyed feature-readout bar at the bottom. A 256-pt Hann-windowed DFT runs in onAnimate (graphics thread) over a 256-sample ring buffer filled by the audio thread.',
    category: 'mat-visualmusic',
    subcategory: 'mappers',
    code: `/**
   * Synesthetic Mapper — MAT200B Phase 2 (audio→visual feature routing)
   *
   * Audio thread: writes raw samples into a 256-sample ring buffer and
   * accumulates RMS / ZCR per block. Graphics thread (onAnimate) reads
   * the ring snapshot and runs a 256-pt Hann DFT to extract centroid +
   * flatness + a 128-bin magnitude curve. This keeps the audio callback
   * cheap while giving the visuals ~94 Hz/bin spectral resolution.
   *
   * Visuals: a row of glyphs whose size / hue / posY / rotation are
   * routed from any of the 4 features via ParameterMenus. A 4x4 routing
   * matrix at the top-right shows which (channel, feature) cells are
   * active. A faint spectrum curve sits behind the glyphs, and each
   * glyph leaves an 8-frame motion trail.
   */

  #include "al_playground_compat.hpp"
  #include "al_WebSamplePlayer.hpp"

  #include <array>
  #include <atomic>
  #include <cmath>
  #include <vector>

  #ifndef M_PI
  #define M_PI 3.14159265358979323846
  #endif

  using namespace al;

  class SynestheticMapper : public App {
  public:
  ControlGUI gui;

  WebSamplePlayer drums, pad, mixed;
  WebSamplePlayer* current = &drums;

  ParameterMenu source     {"source",        ""};
  ParameterBool playing    {"playing",       "", true};
  ParameterMenu size_src   {"size_src",      ""};
  ParameterMenu hue_src    {"hue_src",       ""};
  ParameterMenu posY_src   {"posY_src",      ""};
  ParameterMenu rot_src    {"rotation_src",  ""};
  ParameterInt  num_glyphs {"num_glyphs",    "",  8, 1, 16};
  Parameter     amp        {"amp",           "",  0.7f, 0.0f, 1.0f};
  Trigger       retrigger  {"retrigger",     ""};

  double playhead = 0.0;

  // 256-sample audio→graphics ring (raw, pre-gain samples).
  static constexpr int kRing = 256;
  std::array<float, kRing> ring{};
  std::atomic<int> ringW{0};

  // Audio-thread-cheap feature accumulators.
  float lastSample = 0.0f;
  float rmsAccum = 0.0f;
  float zcrSm = 0.f;
  std::atomic<float> fRMS{0.0f}, fZCR{0.0f};

  // Graphics-thread features (DFT-derived).
  float centSm = 0.f, flatSm = 0.f;
  float fCentroid = 0.0f, fFlatness = 0.0f;

  // Display-smoothed values for the readout bar.
  float dispRMS = 0.0f, dispCent = 0.0f, dispZCR = 0.0f, dispFlat = 0.0f;

  // 128-bin spectrum magnitude (normalised) for the background curve.
  static constexpr int kBins = 128;
  std::array<float, kBins> specMag{};

  // Glyph state.
  std::array<float, 16> glyphPhase{};
  // Trails: last 8 frames of (x, y, radius) per glyph; oldest first.
  static constexpr int kTrail = 8;
  std::array<std::array<float, kTrail>, 16> trailX{};
  std::array<std::array<float, kTrail>, 16> trailY{};
  std::array<std::array<float, kTrail>, 16> trailR{};
  int trailW = 0;
  int trailFill = 0;

  void onInit() override {
    source.setElements({"drums", "pad", "mixed"});
    source.set(0);
    source.registerChangeCallback([this](float v){
      switch ((int)v) {
        case 0: current = &drums; break;
        case 1: current = &pad;   break;
        case 2: current = &mixed; break;
      }
      playhead = 0.0;
    });
    retrigger.registerChangeCallback([this](float){ playhead = 0.0; });

    const std::vector<std::string> feats = {"RMS", "centroid", "ZCR", "flatness"};
    size_src.setElements(feats); size_src.set(0);
    hue_src.setElements(feats);  hue_src.set(1);
    posY_src.setElements(feats); posY_src.set(2);
    rot_src.setElements(feats);  rot_src.set(3);

    gui << source << playing << size_src << hue_src << posY_src << rot_src
        << num_glyphs << amp << retrigger;
  }

  void onCreate() override {
    gui.init();
    drums.load("drum_loop_120bpm.wav");
    pad.load("pad_loop.wav");
    mixed.load("mixed_loop.wav");
    nav().pos(0, 0, 4.0f);
  }

  void onSound(AudioIOData& io) override {
    if (!playing.get() || !current || !current->ready()) {
      while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
      return;
    }
    const float sr     = io.framesPerSecond();
    const float srcSR  = current->sampleRate() > 1.f ? current->sampleRate() : sr;
    const double rate  = (double)srcSR / (double)sr;
    const int   nFrames = current->frames();
    if (nFrames <= 0) {
      while (io()) { io.out(0) = 0.f; io.out(1) = 0.f; }
      return;
    }

    const int blockLen = io.framesPerBuffer();
    const float gain = amp.get();
    float blockRMS = 0.0f;
    int   blockZC  = 0;
    float prev = lastSample;
    int wLocal = ringW.load(std::memory_order_relaxed);

    while (io()) {
      const float raw = current->readInterp(0, (float)playhead);
      playhead += rate;
      if (playhead >= nFrames) playhead -= nFrames;
      const float s = raw * gain;
      io.out(0) = s; io.out(1) = s;

      blockRMS += raw * raw;
      if ((raw >= 0.f && prev < 0.f) || (raw < 0.f && prev >= 0.f)) ++blockZC;
      prev = raw;

      ring[(size_t)wLocal] = raw;
      wLocal = (wLocal + 1) % kRing;
    }
    ringW.store(wLocal, std::memory_order_release);
    lastSample = prev;

    const float instRMS = std::sqrt(blockRMS / (float)std::max(1, blockLen));
    rmsAccum = 0.9f * rmsAccum + 0.1f * instRMS;
    fRMS.store(std::min(1.0f, rmsAccum * 3.0f));

    const float zcrNorm = (float)blockZC / (float)std::max(1, blockLen);
    zcrSm = 0.85f * zcrSm + 0.15f * std::min(1.0f, zcrNorm * 8.0f);
    fZCR.store(zcrSm);
  }

  // Snapshot the ring + run a 256-pt Hann DFT on the graphics thread.
  void runDFT() {
    const int N = kRing;
    int w = ringW.load(std::memory_order_acquire);
    std::array<float, kRing> win{};
    for (int n = 0; n < N; ++n) {
      const int idx = (w + n) % N;
      const float wcoef = 0.5f - 0.5f * std::cos(2.f * (float)M_PI * (float)n / (float)(N - 1));
      win[(size_t)n] = ring[(size_t)idx] * wcoef;
    }
    const int bins = N / 2; // 128 bins
    float sumMag = 0.f, sumKMag = 0.f, logSum = 0.f, arithSum = 0.f;
    for (int k = 0; k < bins; ++k) {
      float re = 0.f, im = 0.f;
      const float ang = -2.f * (float)M_PI * (float)k / (float)N;
      for (int n = 0; n < N; ++n) {
        re += win[(size_t)n] * std::cos(ang * (float)n);
        im += win[(size_t)n] * std::sin(ang * (float)n);
      }
      const float mag = std::sqrt(re * re + im * im);
      specMag[(size_t)k] = 0.7f * specMag[(size_t)k] + 0.3f * mag;
      sumMag  += mag;
      sumKMag += (float)k * mag;
      logSum  += std::log(mag + 1e-9f);
      arithSum += mag;
    }
    const float centroidBin  = (sumMag > 1e-6f) ? (sumKMag / sumMag) : 0.f;
    const float centroidNorm = centroidBin / (float)bins;
    centSm = 0.8f * centSm + 0.2f * centroidNorm;
    fCentroid = std::min(1.0f, centSm * 1.5f);
    const float geo = std::exp(logSum / (float)bins);
    const float ari = arithSum / (float)bins;
    const float flat = (ari > 1e-6f) ? (geo / ari) : 0.f;
    flatSm = 0.85f * flatSm + 0.15f * flat;
    fFlatness = std::min(1.0f, flatSm);
  }

  float feature(int idx) const {
    switch (idx) {
      case 0: return fRMS.load();
      case 1: return fCentroid;
      case 2: return fZCR.load();
      case 3: return fFlatness;
    }
    return 0.0f;
  }

  static void hsv2rgb(float h, float s, float v, float& r, float& g, float& b) {
    h = h - std::floor(h);
    const float i = std::floor(h * 6.0f);
    const float f = h * 6.0f - i;
    const float p = v * (1.0f - s);
    const float q = v * (1.0f - f * s);
    const float t = v * (1.0f - (1.0f - f) * s);
    const int ii = int(i) % 6;
    switch (ii) {
      case 0: r=v; g=t; b=p; break;
      case 1: r=q; g=v; b=p; break;
      case 2: r=p; g=v; b=t; break;
      case 3: r=p; g=q; b=v; break;
      case 4: r=t; g=p; b=v; break;
      default: r=v; g=p; b=q; break;
    }
  }

  static void emitDisc(Mesh& m, float cx, float cy, float radius,
                       float r, float g, float b, int segs = 24) {
    for (int i = 0; i < segs; ++i) {
      const float a0 = 2.f * (float)M_PI * (float)i       / (float)segs;
      const float a1 = 2.f * (float)M_PI * (float)(i + 1) / (float)segs;
      m.vertex(cx, cy, 0.f); m.color(r, g, b);
      m.vertex(cx + std::cos(a0) * radius, cy + std::sin(a0) * radius, 0.f);
      m.color(r, g, b);
      m.vertex(cx + std::cos(a1) * radius, cy + std::sin(a1) * radius, 0.f);
      m.color(r, g, b);
    }
  }

  static void emitRect(Mesh& m, float x, float y, float w, float h,
                       float r, float g, float b) {
    m.vertex(x,     y,     0); m.color(r, g, b);
    m.vertex(x + w, y,     0); m.color(r, g, b);
    m.vertex(x + w, y + h, 0); m.color(r, g, b);
    m.vertex(x,     y,     0); m.color(r, g, b);
    m.vertex(x + w, y + h, 0); m.color(r, g, b);
    m.vertex(x,     y + h, 0); m.color(r, g, b);
  }

  void onAnimate(double dt) override {
    runDFT();

    dispRMS  = 0.85f * dispRMS  + 0.15f * fRMS.load();
    dispCent = 0.85f * dispCent + 0.15f * fCentroid;
    dispZCR  = 0.85f * dispZCR  + 0.15f * fZCR.load();
    dispFlat = 0.85f * dispFlat + 0.15f * fFlatness;

    const float rotF = feature(rot_src.get());
    const int n = num_glyphs.get();
    for (int i = 0; i < n && i < (int)glyphPhase.size(); ++i) {
      const float perGlyphMod = 0.5f + (float)i / (float)std::max(1, n);
      glyphPhase[(size_t)i] += (float)dt * (0.3f + rotF * 4.0f) * perGlyphMod;
      if (glyphPhase[(size_t)i] > 2.f * (float)M_PI) {
        glyphPhase[(size_t)i] -= 2.f * (float)M_PI;
      }
    }
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.05f, 0.08f);
    g.meshColor();

    int n = num_glyphs.get();
    if (n < 1) n = 1; else if (n > 16) n = 16;

    const float sizeF = feature(size_src.get());
    const float hueF  = feature(hue_src.get());
    const float posYF = feature(posY_src.get());

    // --- 1. Faint live spectrum behind the glyphs (LINE_STRIP, 128 bins) ---
    Mesh spec; spec.primitive(Mesh::LINE_STRIP);
    const float specXL = -1.3f, specXR = 1.3f;
    // Find a normaliser so the curve breathes without being washed out.
    float specMax = 1e-3f;
    for (int k = 0; k < kBins; ++k) {
      if (specMag[(size_t)k] > specMax) specMax = specMag[(size_t)k];
    }
    for (int k = 0; k < kBins; ++k) {
      const float t = (float)k / (float)(kBins - 1);
      const float fx = specXL + t * (specXR - specXL);
      const float mag = specMag[(size_t)k] / specMax; // 0..1
      const float fy = -0.05f + std::pow(mag, 0.5f) * 0.55f;
      spec.vertex(fx, fy, 0.f);
      spec.color(0.25f, 0.45f, 0.55f);
    }
    g.draw(spec);

    // --- 2. Compute glyph positions for THIS frame, then push to trail ring ---
    std::array<float, 16> curX{}, curY{}, curR{};
    const float baseRadius = 0.10f;
    for (int i = 0; i < n; ++i) {
      const float t = (n == 1) ? 0.5f : (float)i / (float)(n - 1);
      const float x = -1.3f + t * 2.6f;
      const float idxMod = 0.6f + 0.4f * std::sin(t * 2.f * (float)M_PI + 1.7f);
      const float y = (posYF - 0.5f) * 1.0f * idxMod;
      const float radius = baseRadius * (0.5f + 1.5f * sizeF * idxMod);
      curX[(size_t)i] = x;
      curY[(size_t)i] = y;
      curR[(size_t)i] = radius;
    }
    // Write into ring slot trailW (oldest is the slot we're about to overwrite).
    for (int i = 0; i < n; ++i) {
      trailX[(size_t)i][(size_t)trailW] = curX[(size_t)i];
      trailY[(size_t)i][(size_t)trailW] = curY[(size_t)i];
      trailR[(size_t)i][(size_t)trailW] = curR[(size_t)i];
    }
    trailW = (trailW + 1) % kTrail;
    if (trailFill < kTrail) ++trailFill;

    Mesh trails; trails.primitive(Mesh::TRIANGLES);
    Mesh discs;  discs.primitive(Mesh::TRIANGLES);
    Mesh ticks;  ticks.primitive(Mesh::LINES);

    for (int i = 0; i < n; ++i) {
      const float t = (n == 1) ? 0.5f : (float)i / (float)(n - 1);
      const float hue = std::fmod(hueF + t * 0.2f, 1.0f);
      float r, gg, b;
      hsv2rgb(hue, 0.85f, 0.95f, r, gg, b);

      // Trails: walk back from newest to oldest, alpha-fading via brightness.
      // The slot at (trailW - 1) is the snapshot we just wrote (newest).
      for (int age = 1; age <= trailFill; ++age) {
        const int slot = (trailW - age + kTrail) % kTrail;
        if (age == 1) continue; // skip the freshest, drawn as the live disc below
        const float fade = 1.0f - (float)(age - 1) / (float)kTrail;
        const float dim  = fade * 0.55f;
        emitDisc(trails,
                 trailX[(size_t)i][(size_t)slot],
                 trailY[(size_t)i][(size_t)slot],
                 trailR[(size_t)i][(size_t)slot] * (0.4f + 0.6f * fade),
                 r * dim, gg * dim, b * dim, 16);
      }

      emitDisc(discs, curX[(size_t)i], curY[(size_t)i], curR[(size_t)i], r, gg, b, 24);

      const float ang = glyphPhase[(size_t)i];
      const float tickLen = curR[(size_t)i] * 1.4f;
      ticks.vertex(curX[(size_t)i], curY[(size_t)i], 0.f); ticks.color(1.f, 1.f, 1.f);
      ticks.vertex(curX[(size_t)i] + std::cos(ang) * tickLen,
                   curY[(size_t)i] + std::sin(ang) * tickLen, 0.f);
      ticks.color(1.f, 1.f, 1.f);
    }
    g.draw(trails);
    g.draw(discs);
    g.draw(ticks);

    // --- 3. Bottom feature-readout bar (color-keyed chips) ---
    Mesh bars; bars.primitive(Mesh::TRIANGLES);
    emitRect(bars, -1.4f, -1.0f, 2.8f, 0.18f, 0.10f, 0.10f, 0.14f);

    const float vals[4] = { dispRMS, dispCent, dispZCR, dispFlat };
    const float featCols[4][3] = {
      {0.95f, 0.30f, 0.30f}, // RMS = red
      {0.30f, 0.90f, 0.45f}, // centroid = green
      {0.35f, 0.55f, 0.95f}, // ZCR = blue
      {0.95f, 0.85f, 0.30f}  // flatness = yellow
    };
    const float barW = 0.55f, gap = 0.10f;
    const float startX = -((barW * 4.0f + gap * 3.0f) * 0.5f);
    const float baseY  = -0.98f;
    const float maxH   =  0.14f;
    for (int i = 0; i < 4; ++i) {
      float v = std::min(1.0f, std::max(0.0f, vals[i]));
      const float x = startX + (float)i * (barW + gap);
      // chip on the left edge (10% of bar width) shows the feature color
      const float chipW = barW * 0.10f;
      emitRect(bars, x, baseY, chipW, maxH,
               featCols[i][0], featCols[i][1], featCols[i][2]);
      // value bar fills the remainder
      const float trackX = x + chipW + 0.01f;
      const float trackW = barW - chipW - 0.01f;
      emitRect(bars, trackX, baseY, trackW, maxH, 0.18f, 0.18f, 0.22f);
      emitRect(bars, trackX, baseY, trackW * v, maxH,
               featCols[i][0], featCols[i][1], featCols[i][2]);
    }
    g.draw(bars);

    // --- 4. 4x4 routing matrix at top-right ---
    // Rows: visual channels (size, hue, posY, rotation) = white/cyan/magenta/orange
    // Cols: features (RMS, centroid, ZCR, flatness)
    const float chCols[4][3] = {
      {1.00f, 1.00f, 1.00f},
      {0.20f, 0.90f, 0.95f},
      {0.95f, 0.35f, 0.85f},
      {0.95f, 0.55f, 0.20f}
    };
    const int routed[4] = { size_src.get(), hue_src.get(), posY_src.get(), rot_src.get() };
    Mesh matrix; matrix.primitive(Mesh::TRIANGLES);
    const float cellSize = 0.07f;
    const float cellGap  = 0.012f;
    const float matrixW  = 4.f * cellSize + 3.f * cellGap;
    const float matrixX0 = 1.32f - matrixW;     // pin to right edge
    const float matrixY0 = 0.95f - 4.f * (cellSize + cellGap); // top-right corner
    // Backing panel
    emitRect(matrix,
             matrixX0 - 0.02f,
             matrixY0 - 0.02f,
             matrixW + 0.04f,
             4.f * (cellSize + cellGap) + 0.02f,
             0.08f, 0.08f, 0.10f);
    // Cells (row 0 at top = size channel)
    for (int row = 0; row < 4; ++row) {
      for (int col = 0; col < 4; ++col) {
        const float cx = matrixX0 + (float)col * (cellSize + cellGap);
        const float cy = matrixY0 + (float)(3 - row) * (cellSize + cellGap);
        const bool active = (routed[row] == col);
        if (active) {
          emitRect(matrix, cx, cy, cellSize, cellSize,
                   chCols[row][0], chCols[row][1], chCols[row][2]);
        } else {
          emitRect(matrix, cx, cy, cellSize, cellSize,
                   0.18f, 0.18f, 0.22f);
        }
      }
    }
    g.draw(matrix);

    // Outline the active cell (per row) with a brighter LINES border so it
    // reads as a "patched" connection from row to column.
    Mesh matOutline; matOutline.primitive(Mesh::LINES);
    for (int row = 0; row < 4; ++row) {
      const int col = routed[row];
      if (col < 0 || col > 3) continue;
      const float cx = matrixX0 + (float)col * (cellSize + cellGap);
      const float cy = matrixY0 + (float)(3 - row) * (cellSize + cellGap);
      const float r = chCols[row][0], gg = chCols[row][1], b = chCols[row][2];
      const float x0 = cx - 0.004f, x1 = cx + cellSize + 0.004f;
      const float y0 = cy - 0.004f, y1 = cy + cellSize + 0.004f;
      matOutline.vertex(x0, y0, 0); matOutline.color(r, gg, b);
      matOutline.vertex(x1, y0, 0); matOutline.color(r, gg, b);
      matOutline.vertex(x1, y0, 0); matOutline.color(r, gg, b);
      matOutline.vertex(x1, y1, 0); matOutline.color(r, gg, b);
      matOutline.vertex(x1, y1, 0); matOutline.color(r, gg, b);
      matOutline.vertex(x0, y1, 0); matOutline.color(r, gg, b);
      matOutline.vertex(x0, y1, 0); matOutline.color(r, gg, b);
      matOutline.vertex(x0, y0, 0); matOutline.color(r, gg, b);
    }
    g.draw(matOutline);

    gui.draw(g);
  }

  bool onMouseDown(const Mouse&) override { return false; }
  bool onMouseDrag(const Mouse&) override { return false; }
  bool onMouseUp  (const Mouse&) override { return false; }
  };

  ALLOLIB_WEB_MAIN(SynestheticMapper)
  `,
  },
]

// Multi-file MAT200B entries (e.g., examples that ship with auxiliary .glsl
// or extra headers). Phase 2 fills if needed.
export const mat200bMultiFileExamples: MultiFileExample[] = []
