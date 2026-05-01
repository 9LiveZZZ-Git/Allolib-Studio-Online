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
  {
    id: 'mat-risset',
    title: 'Risset Glissando Reconstruction',
    description:
      "Eight sine oscillators stacked an octave apart, each rising (or falling) at the same rate; a Gaussian amplitude envelope across the stack means the chord seems to shift forever without ever leaving the audible band. Visual is a polar plot where each oscillator's angle = pitch-within-octave, radius scaled by the bell envelope.",
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
 * Visual: polar plot, one disc per oscillator. Angle = octave fraction
 * (0..1 mod 2pi), radius scaled by the bell envelope. As the rate
 * spins the dots, the eye sees what the ear hears.
 *
 *   rate         oct/sec, signed — positive rises, negative falls
 *   amplitude    overall level
 *   spread       Gaussian width (smaller = harder bell, more obvious wrap)
 *   numTones     count of stacked oscillators (3..16)
 *   reset        Trigger — reset all phases to zero
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"
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
  Parameter     rate     {"rate",      "",  0.30f, -2.0f, 2.0f};
  Parameter     amplitude{"amplitude", "",  0.25f,  0.0f, 1.0f};
  Parameter     spread   {"spread",    "",  0.30f,  0.05f, 1.0f};
  ParameterInt  numTones {"numTones",  "",  8,      3,    16};
  Trigger       reset    {"reset",     ""};

  ControlGUI gui;

  static constexpr int MAX_TONES = 16;
  std::vector<gam::Sine<>> oscs{MAX_TONES};
  std::array<float, MAX_TONES> logF{};   // octaves above base
  float baseHz = 110.f;

  Mesh dots;

  void onInit() override {
    gui << rate << amplitude << spread << numTones << reset;
    reset.registerChangeCallback([this](float) {
      for (auto& v : logF) v = 0.f;
    });
    for (int i = 0; i < MAX_TONES; ++i) logF[i] = static_cast<float>(i);
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
    dots.primitive(Mesh::TRIANGLES);
  }

  void onSound(AudioIOData& io) override {
    const int N = numTones.get();
    const float dt = 1.0f / io.framesPerSecond();
    const float r  = rate.get();
    const float sp = spread.get();
    const float amp = amplitude.get();

    while (io()) {
      float mix = 0.f;
      for (int i = 0; i < N; ++i) {
        logF[i] += r * dt;
        // Wrap into [0, N): when an osc leaves the top it reappears at
        // the bottom an octave lower (silent due to the envelope).
        while (logF[i] < 0.f)  logF[i] += static_cast<float>(N);
        while (logF[i] >= N)   logF[i] -= static_cast<float>(N);

        const float hz = baseHz * std::pow(2.0f, logF[i]);
        oscs[i].freq(hz);

        // Bell envelope on position-within-band, peak at N/2.
        const float u = (logF[i] - 0.5f * (N - 1)) / (sp * N);
        const float env = std::exp(-u * u);
        mix += oscs[i]() * env;
      }
      const float s = mix * amp / std::sqrt(static_cast<float>(N));
      io.out(0) = s;
      io.out(1) = s;
    }
  }

  void onAnimate(double /*dt*/) override {
    const int N = numTones.get();
    const float sp = spread.get();
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
      Mesh disc;
      addDisc(disc, 0.05f + 0.10f * env, 16);
      const float cr = 1.0f - frac;
      const float cg = 0.4f + 0.5f * frac;
      const float cb = 0.4f + 0.6f * frac;
      for (size_t v = 0; v < disc.vertices().size(); ++v) {
        const auto& p = disc.vertices()[v];
        dots.vertex(p.x + cx, p.y + cy, 0.f);
        dots.color(cr * env, cg * env, cb * env);
      }
    }
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.04f, 0.07f);
    g.meshColor();
    g.draw(dots);
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
      'Plucked-string physical model: short noise burst into a delay line + lowpass feedback. Pitch = sampleRate / delay length; damping is the feedback gain. Visual is the delay line itself drawn as a horizontal vertex strip — each vertex height = current sample, so you watch the standing wave develop and decay.',
    category: 'mat-synthesis',
    subcategory: 'physical',
    code: `/**
 * Karplus–Strong String Lab — MAT200B Phase 1 #3
 *
 * Classic delay-line + lowpass-feedback string. Pluck = N samples of
 * white noise written into a circular delay buffer; each subsequent
 * audio sample averages the current and previous ring read with a
 * feedback gain ('damping'). One-zero lowpass + scalar feedback is
 * enough to model the lossy reflections at the bridge.
 *
 *   y[n]    = 0.5 * (buf[r] + prev) * damping
 *   buf[w]  = y[n]
 *   prev    = buf[r]   (before write)
 *
 * Pluck position is faked by writing the noise burst centred on
 * pluckPos*delayLen with a triangular window — fewer high harmonics
 * if you pluck near the centre, more if near the bridge.
 *
 * Visual: the delay buffer drawn as a LINE_STRIP, x = position along
 * the string, y = current sample value. Standing-wave shape and
 * decay both visible.
 *
 *   pitch        Hz — sets the delay length (sampleRate / pitch)
 *   damping      0.80..1.00 — feedback gain (1 ~= no decay)
 *   pluckPos     0..1 — fraction along the string that gets noise
 *   excitation   0..1 — initial pluck amplitude
 *   pluck        Trigger — fire a new noise burst
 */

#include "al_playground_compat.hpp"

#include <atomic>
#include <cstdlib>
#include <vector>

using namespace al;

class KarplusStrong : public App {
public:
  Parameter pitch     {"pitch",      "", 220.0f, 40.0f, 1200.0f};
  Parameter damping   {"damping",    "", 0.99f,  0.80f, 1.00f};
  Parameter pluckPos  {"pluckPos",   "", 0.50f,  0.05f, 0.95f};
  Parameter excitation{"excitation", "", 0.60f,  0.0f,  1.0f};
  Trigger   pluck     {"pluck",      ""};

  ControlGUI gui;

  static constexpr int MAX_DELAY = 4096;
  std::vector<float> buf;
  int delayLen   = 256;
  int writeIdx   = 0;
  float prevSample = 0.f;
  std::atomic<int> pluckPending{0};

  Mesh stringMesh;

  void onInit() override {
    gui << pitch << damping << pluckPos << excitation << pluck;
    pluck.registerChangeCallback([this](float) {
      pluckPending.store(1, std::memory_order_release);
    });
  }

  void onCreate() override {
    gui.init();
    buf.assign(MAX_DELAY, 0.f);
    nav().pos(0, 0, 3.5f);
    stringMesh.primitive(Mesh::LINE_STRIP);
  }

  void onSound(AudioIOData& io) override {
    const float sr = io.framesPerSecond();
    delayLen = std::max(2, std::min(MAX_DELAY,
                static_cast<int>(sr / pitch.get())));
    const float fb = damping.get();

    if (pluckPending.exchange(0, std::memory_order_acquire)) {
      // Triangular-windowed noise burst centred on pluckPos.
      const int center = static_cast<int>(pluckPos.get() * delayLen);
      const int width  = std::max(8, delayLen / 4);
      const float amp  = excitation.get();
      for (int i = 0; i < delayLen; ++i) {
        const int dist = std::abs(i - center);
        if (dist < width / 2) {
          const float w = 1.0f - (2.0f * dist / static_cast<float>(width));
          const float n = (static_cast<float>(std::rand()) / RAND_MAX) * 2.f - 1.f;
          buf[i] = n * w * amp;
        } else {
          buf[i] *= 0.5f;
        }
      }
    }

    while (io()) {
      const float cur = buf[writeIdx];
      const float y   = 0.5f * (cur + prevSample) * fb;
      prevSample = cur;
      buf[writeIdx] = y;
      writeIdx = (writeIdx + 1) % delayLen;
      io.out(0) = y;
      io.out(1) = y;
    }
  }

  void onAnimate(double /*dt*/) override {
    stringMesh.reset();
    stringMesh.primitive(Mesh::LINE_STRIP);
    // Downsample for cheap mesh upload — 512 vertices / frame.
    constexpr int N = 512;
    const int step = std::max(1, delayLen / N);
    int i = 0;
    for (int k = 0; k < delayLen && i < N; k += step, ++i) {
      const float x = -1.4f + 2.8f * (static_cast<float>(i) / N);
      const float y = buf[(writeIdx + k) % delayLen] * 1.5f;
      stringMesh.vertex(x, y, 0.f);
      const float t = static_cast<float>(i) / N;
      stringMesh.color(0.4f + 0.5f * t, 0.8f - 0.4f * t, 0.5f);
    }
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.06f, 0.06f);
    g.meshColor();
    g.draw(stringMesh);
    gui.draw(g);
  }
};

ALLOLIB_WEB_MAIN(KarplusStrong)
`,
  },
  {
    id: 'mat-compressor',
    title: 'Compressor Lab — Downward + Upward',
    description:
      'Dynamics processor with dB-dB transfer plot, gain-reduction meter, and before/after waveforms. Switch between downward (peak-tame) and upward (quiet-lift) compression on the same signal to see how a single threshold treats peaks vs. body. Plays bundled CC0 audio (drums / pad / mix).',
    category: 'mat-signal',
    subcategory: 'dynamics',
    code: `/**
 * Compressor Lab — MAT200B Phase 1 #4
 *
 * Plays one of three bundled CC0 loops through a one-pole envelope
 * follower + threshold/ratio/attack/release compressor. The headline
 * pedagogy is the mode toggle:
 *
 *   downward (default) — when input exceeds threshold, output is
 *     pulled toward threshold by 1/ratio of the overshoot. Tames
 *     peaks. Transfer curve bends DOWN above the knee.
 *
 *   upward — when input falls BELOW threshold (and above the noise
 *     floor), output is BOOSTED toward threshold by ratio. Lifts
 *     the quiet body of the signal without touching peaks. Transfer
 *     curve bends UP below the knee.
 *
 * Same threshold, ratio, attack, release knobs in both modes — the
 * mode switch just chooses which side of the threshold gets the
 * gain shaping. Drums (high transient material) demo downward best;
 * the pad (low dynamic range) demo upward best; mixed shows both.
 *
 * Visuals: dB-dB transfer curve (LINE_STRIP) + live input/output
 * dot moving along it + before/after waveforms drawn from a
 * 1024-sample atomic ringbuffer.
 *
 * Knobs:
 *   source        menu — drums / pad / mixed
 *   upwardMode    bool — false = downward, true = upward
 *   threshold_dB  -60..0
 *   ratio         1..20
 *   attack_ms     0.1..200
 *   release_ms    10..1000
 *   makeup_dB     0..24
 *   retrigger     restart loop from start
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
  ParameterBool upwardMode {"upwardMode",  "", false};
  Parameter     threshold  {"threshold_dB","", -20.0f, -60.0f, 0.0f};
  Parameter     ratio      {"ratio",       "",  4.0f,   1.0f, 20.0f};
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

  // Audio -> graphics ringbuffers (mono before/after).
  static constexpr int RING = 1024;
  std::array<float, RING> beforeRing{};
  std::array<float, RING> afterRing{};
  std::atomic<int> ringW{0};

  // Live display values (atomically published from audio thread).
  std::atomic<float> currentInDB {-60.f};
  std::atomic<float> currentOutDB{-60.f};
  std::atomic<float> currentGRDB {  0.f};

  Mesh transferCurve, livePoint, gridMesh, beforeWave, afterWave, grBar;

  void onInit() override {
    source.setElements({"drums", "pad", "mixed"});
    source.set(0);

    gui << source << upwardMode << threshold << ratio
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

  void onSound(AudioIOData& io) override {
    if (!current || !current->ready()) {
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
    const float makeupLin = std::pow(10.0f, makeup_dB.get() / 20.0f);
    const bool  upward = upwardMode.get();
    const float noiseFloorDB = -60.0f;
    const int   nFrames = current->frames();

    float lastInDB = -60.f, lastOutDB = -60.f, lastGRDB = 0.f;

    while (io()) {
      // Source read with linear interpolation, looping.
      const float in = current->readInterp(0, static_cast<float>(playhead));
      playhead += rateRatio;
      if (playhead >= nFrames) playhead -= nFrames;

      // Envelope follower (peak / one-pole).
      const float absIn = std::abs(in);
      const float coef  = (absIn > envState) ? aA : aR;
      envState = absIn + coef * (envState - absIn);

      const float lvlDB = (envState > 1e-6f) ? 20.f * std::log10(envState) : -120.f;

      float grDB = 0.f;
      if (!upward) {
        // Downward: shave overshoot.
        if (lvlDB > thrDB) {
          grDB = -(lvlDB - thrDB) * (1.0f - 1.0f / r);
        }
      } else {
        // Upward: lift undershoot, but only down to the noise floor.
        if (lvlDB < thrDB && lvlDB > noiseFloorDB) {
          grDB = (thrDB - lvlDB) * (1.0f - 1.0f / r);
        }
      }

      const float gainLin = std::pow(10.0f, grDB / 20.0f) * makeupLin;
      const float out     = in * gainLin;

      io.out(0) = out;
      io.out(1) = out;

      const int w = ringW.load(std::memory_order_relaxed);
      beforeRing[w] = in;
      afterRing[w]  = out;
      ringW.store((w + 1) % RING, std::memory_order_release);

      lastInDB  = lvlDB;
      lastOutDB = lvlDB + grDB + makeup_dB.get();
      lastGRDB  = grDB;
    }

    currentInDB.store(lastInDB,  std::memory_order_release);
    currentOutDB.store(lastOutDB,std::memory_order_release);
    currentGRDB.store(lastGRDB,  std::memory_order_release);
  }

  // Map an input dB value to screen X in [-1.4, +1.4] over the -60..0 range.
  static float dbToX(float db) { return -1.4f + (db + 60.0f) / 60.0f * 2.8f; }
  static float dbToY(float db) { return  0.2f + (db + 60.0f) / 60.0f * 1.8f; }

  void onAnimate(double /*dt*/) override {
    const float thrDB  = threshold.get();
    const float r      = ratio.get();
    const float makeup = makeup_dB.get();
    const bool  upward = upwardMode.get();

    // Transfer curve: 240 points from -60 to 0 dB input.
    transferCurve.reset();
    transferCurve.primitive(Mesh::LINE_STRIP);
    constexpr int N = 240;
    for (int i = 0; i < N; ++i) {
      const float inDB = -60.0f + (60.0f * i) / (N - 1);
      float outDB = inDB;
      if (!upward) {
        if (inDB > thrDB) outDB = thrDB + (inDB - thrDB) / r;
      } else {
        if (inDB < thrDB && inDB > -60.f)
          outDB = inDB + (thrDB - inDB) * (1.0f - 1.0f / r);
      }
      outDB += makeup;
      transferCurve.vertex(dbToX(inDB), dbToY(outDB), 0.f);
      transferCurve.color(upward ? 0.5f : 0.4f,
                          upward ? 0.7f : 0.9f,
                          upward ? 1.0f : 0.5f);
    }

    // Reference identity line (input = output, no compression).
    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    for (int dB = -60; dB <= 0; dB += 10) {
      // vertical
      gridMesh.vertex(dbToX(dB),     dbToY(-60.f), 0.f);
      gridMesh.vertex(dbToX(dB),     dbToY(0.f),   0.f);
      // horizontal
      gridMesh.vertex(dbToX(-60.f),  dbToY(dB),    0.f);
      gridMesh.vertex(dbToX(0.f),    dbToY(dB),    0.f);
      const float c = 0.18f;
      for (int k = 0; k < 4; ++k) gridMesh.color(c, c, c);
    }
    // identity diagonal
    gridMesh.vertex(dbToX(-60.f), dbToY(-60.f), 0.f);
    gridMesh.vertex(dbToX(0.f),   dbToY(0.f),   0.f);
    gridMesh.color(0.3f, 0.3f, 0.3f);
    gridMesh.color(0.3f, 0.3f, 0.3f);

    // Live point on the curve.
    livePoint.reset();
    livePoint.primitive(Mesh::TRIANGLES);
    {
      Mesh d;
      addDisc(d, 0.04f, 16);
      const float px = dbToX(currentInDB.load());
      const float py = dbToY(currentOutDB.load());
      for (size_t v = 0; v < d.vertices().size(); ++v) {
        const auto& p = d.vertices()[v];
        livePoint.vertex(p.x + px, p.y + py, 0.f);
        livePoint.color(1.0f, 0.85f, 0.2f);
      }
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

    // GR meter on the right edge — height proportional to |GR| in dB.
    grBar.reset();
    grBar.primitive(Mesh::TRIANGLES);
    const float grAbs = std::min(24.f, std::abs(currentGRDB.load()));
    const float h     = grAbs / 24.0f * 1.8f;
    const float x0    = 1.55f, x1 = 1.70f, y0 = 0.2f, y1 = 0.2f + h;
    // two triangles
    grBar.vertex(x0, y0, 0.f); grBar.vertex(x1, y0, 0.f); grBar.vertex(x1, y1, 0.f);
    grBar.vertex(x0, y0, 0.f); grBar.vertex(x1, y1, 0.f); grBar.vertex(x0, y1, 0.f);
    const Color grColor = upward ? Color(0.4f, 0.85f, 1.0f) : Color(1.0f, 0.55f, 0.4f);
    for (int k = 0; k < 6; ++k) grBar.color(grColor.r, grColor.g, grColor.b);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.05f, 0.05f, 0.08f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(transferCurve);
    g.draw(livePoint);
    g.draw(beforeWave);
    g.draw(afterWave);
    g.draw(grBar);
    gui.draw(g);
  }
};

ALLOLIB_WEB_MAIN(CompressorLab)
`,
  },
]

// Multi-file MAT200B entries (e.g., examples that ship with auxiliary .glsl
// or extra headers). Phase 2 fills if needed.
export const mat200bMultiFileExamples: MultiFileExample[] = []
