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
  {
    id: 'mat-amrm',
    title: 'AM / RM Sideband Visualizer',
    description:
      "Amplitude modulation vs. ring modulation, side by side. Two oscillators (carrier + modulator); the 'mode' switch picks AM (output = (1 + modDepth*mod) * carrier) or RM (output = mod * carrier). Spectrum view shows the sidebands appear at carrier±modulator (and the carrier-itself peak in AM mode, which RM removes). Time-domain view below shows the resulting waveform.",
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
 * of the recent audio block (256-point Hann-windowed) — students see
 * the sideband peaks move as 'mod_hz' is dragged. Bottom half = the
 * raw waveform itself, so the eye sees the AM "hugging" envelope vs.
 * the RM "balanced" zero-crossing pattern.
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
  Parameter     carrier_hz {"carrier_hz", "", 440.0f, 50.0f, 4000.0f};
  Parameter     mod_hz     {"mod_hz",     "",  80.0f,  1.0f, 2000.0f};
  Parameter     depth      {"depth",      "",   0.8f,  0.0f, 1.0f};
  Parameter     amp        {"amplitude",  "",   0.25f, 0.0f, 1.0f};
  ParameterBool ringMod    {"ringMod",    "", false};

  ControlGUI gui;

  gam::Sine<> carrier, modulator;

  // Recent audio block (mono) for the inline DFT.
  static constexpr int N = 256;
  std::array<float, N> blockBuf{};
  std::atomic<int> blockW{0};

  Mesh spectrum, waveform, gridMesh;

  void onInit() override {
    gui << carrier_hz << mod_hz << depth << amp << ringMod;
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
  }

  void onSound(AudioIOData& io) override {
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
      blockBuf[w] = s;
      blockW.store((w + 1) % N, std::memory_order_release);
    }
  }

  // Tiny non-FFT magnitude DFT — N=256 = 32k mults, runs once per frame.
  // Cheap on the graphics thread and avoids needing gam::STFT here.
  void computeSpectrum(std::array<float, N / 2>& mag) {
    // Snapshot the ring oldest -> newest with Hann window.
    const int w = blockW.load(std::memory_order_acquire);
    std::array<float, N> x{};
    for (int i = 0; i < N; ++i) {
      const int idx = (w + i) % N;
      const float win = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (N - 1)));
      x[i] = blockBuf[idx] * win;
    }
    for (int k = 0; k < N / 2; ++k) {
      float re = 0.f, im = 0.f;
      const float ang = -2.0f * M_PI * k / N;
      for (int n = 0; n < N; ++n) {
        re += x[n] * std::cos(ang * n);
        im += x[n] * std::sin(ang * n);
      }
      mag[k] = std::sqrt(re * re + im * im) * (2.0f / N);
    }
  }

  void onAnimate(double /*dt*/) override {
    std::array<float, N / 2> mag{};
    computeSpectrum(mag);

    spectrum.reset();
    spectrum.primitive(Mesh::LINE_STRIP);
    for (int k = 0; k < N / 2; ++k) {
      const float xx = -1.4f + (static_cast<float>(k) / (N / 2 - 1)) * 2.8f;
      const float yy = 0.2f + std::min(1.5f, mag[k] * 6.0f);
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

    // Reference baselines.
    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    gridMesh.vertex(-1.4f, 0.2f, 0.f); gridMesh.vertex(1.4f, 0.2f, 0.f);
    gridMesh.vertex(-1.4f,-0.9f, 0.f); gridMesh.vertex(1.4f,-0.9f, 0.f);
    for (int k = 0; k < 4; ++k) gridMesh.color(0.25f, 0.25f, 0.25f);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.05f, 0.07f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(spectrum);
    g.draw(waveform);
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
      "Phase-modulation FM (Chowning style): output = sin(2π·fc·t + index·sin(2π·fm·t)). The 'index' knob smoothly grows the sideband structure. Visual is the live magnitude spectrum so you watch the Bessel-like fan of partials at fc±k·fm widen as index rises.",
    category: 'mat-synthesis',
    subcategory: 'modulation',
    code: `/**
 * FM Index Explorer — MAT200B Phase 2
 *
 * Single-operator FM (technically PM, the way Chowning meant it).
 * The carrier oscillator's phase is offset by the modulator output
 * scaled by 'index':
 *
 *   y(t) = amp * sin(2pi*fc*t + index * sin(2pi*fm*t))
 *
 * Sideband structure follows Bessel functions of the first kind J_k
 * evaluated at the index — the spectrum is at fc + k*fm for all
 * integer k (positive and negative; negative-k partials reflect
 * around DC). At index = 0 you hear pure carrier; as index rises,
 * energy distributes into a widening fan of partials.
 *
 * Visual: live magnitude spectrum (256-point inline DFT, Hann
 * window). Drag 'index' from 0 -> 6 and watch the sidebands
 * spread.
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
  Parameter carrier_hz {"carrier_hz", "", 220.0f,  50.0f, 2000.0f};
  Parameter mod_hz     {"mod_hz",     "", 110.0f,   1.0f, 2000.0f};
  Parameter index      {"index",      "",   1.0f,   0.0f, 8.0f};
  Parameter amp        {"amplitude",  "",  0.25f,   0.0f, 1.0f};

  ControlGUI gui;

  gam::Sine<> mod;             // PM modulator (sine)
  // Carrier phase tracked manually so we can add the modulator output.
  double carrierPhase = 0.0;

  static constexpr int N = 256;
  std::array<float, N> blockBuf{};
  std::atomic<int> blockW{0};

  Mesh spectrum, waveform, gridMesh;

  void onInit() override {
    gui << carrier_hz << mod_hz << index << amp;
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
  }

  void onSound(AudioIOData& io) override {
    mod.freq(mod_hz.get());
    const float fc  = carrier_hz.get();
    const float idx = index.get();
    const float a   = amp.get();
    const float sr  = io.framesPerSecond();
    const double dPhase = 2.0 * M_PI * fc / sr;

    while (io()) {
      const float modOut = mod();
      const float s = a * static_cast<float>(std::sin(carrierPhase + idx * modOut));
      carrierPhase += dPhase;
      if (carrierPhase > 2.0 * M_PI) carrierPhase -= 2.0 * M_PI;

      io.out(0) = s;
      io.out(1) = s;
      const int w = blockW.load(std::memory_order_relaxed);
      blockBuf[w] = s;
      blockW.store((w + 1) % N, std::memory_order_release);
    }
  }

  void computeSpectrum(std::array<float, N / 2>& mag) {
    const int w = blockW.load(std::memory_order_acquire);
    std::array<float, N> x{};
    for (int i = 0; i < N; ++i) {
      const int idx2 = (w + i) % N;
      const float win = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (N - 1)));
      x[i] = blockBuf[idx2] * win;
    }
    for (int k = 0; k < N / 2; ++k) {
      float re = 0.f, im = 0.f;
      const float ang = -2.0f * M_PI * k / N;
      for (int n = 0; n < N; ++n) {
        re += x[n] * std::cos(ang * n);
        im += x[n] * std::sin(ang * n);
      }
      mag[k] = std::sqrt(re * re + im * im) * (2.0f / N);
    }
  }

  void onAnimate(double /*dt*/) override {
    std::array<float, N / 2> mag{};
    computeSpectrum(mag);

    spectrum.reset();
    spectrum.primitive(Mesh::LINE_STRIP);
    for (int k = 0; k < N / 2; ++k) {
      const float xx = -1.4f + (static_cast<float>(k) / (N / 2 - 1)) * 2.8f;
      const float yy = 0.2f + std::min(1.5f, mag[k] * 6.0f);
      spectrum.vertex(xx, yy, 0.f);
      const float t = static_cast<float>(k) / (N / 2);
      spectrum.color(0.5f + 0.4f * t, 0.4f + 0.5f * t, 1.0f - 0.3f * t);
    }

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

    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    gridMesh.vertex(-1.4f, 0.2f, 0.f); gridMesh.vertex(1.4f, 0.2f, 0.f);
    gridMesh.vertex(-1.4f,-0.9f, 0.f); gridMesh.vertex(1.4f,-0.9f, 0.f);
    for (int k = 0; k < 4; ++k) gridMesh.color(0.25f, 0.25f, 0.25f);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.04f, 0.08f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(spectrum);
    g.draw(waveform);
    gui.draw(g);
  }
};

ALLOLIB_WEB_MAIN(FmIndex)
`,
  },
  {
    id: 'mat-comb-swept',
    title: 'Comb Filter Swept-Delay Visualizer',
    description:
      "White noise into a comb filter (gam::Comb) whose delay length is modulated by a low-frequency sine. The comb's notches appear at fk = k / delaySec, so as delay sweeps the notches march up and down the spectrum. Live magnitude view (inline DFT) shows the comb teeth moving in real time.",
    category: 'mat-signal',
    subcategory: 'delay',
    code: `/**
 * Comb Filter Swept-Delay Visualizer — MAT200B Phase 2
 *
 * gam::Comb fed white noise. The delay length D (in seconds) is
 * modulated by a low-frequency sine LFO between 'delay_min' and
 * 'delay_max'. The comb's notches sit at fk = k / D for integer k,
 * so as D sweeps the notches and peaks march up and down the
 * spectrum. With 'feedback' close to 1 the resonances become
 * pronounced; with 'feedforward' the timbre is closer to a
 * subtractive filter.
 *
 * Visual: 256-point inline DFT of the comb output. Drag 'lfo_hz'
 * up to 5 Hz and watch the spectrum animate; drop it to 0.05 Hz
 * to study a static notch pattern at any chosen delay.
 */

#include "al_playground_compat.hpp"
#include "Gamma/Effects.h"
#include "Gamma/Filter.h"
#include "Gamma/Noise.h"
#include "Gamma/Oscillator.h"

#include <array>
#include <atomic>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

using namespace al;

class CombSwept : public App {
public:
  Parameter delay_min {"delay_min_ms", "",  2.0f,   0.5f,  20.0f};
  Parameter delay_max {"delay_max_ms", "", 20.0f,   5.0f, 100.0f};
  Parameter lfo_hz    {"lfo_hz",       "",  0.30f,  0.05f, 5.0f};
  Parameter feedback  {"feedback",     "",  0.85f,  0.0f,  0.99f};
  Parameter feedforward{"feedforward", "",  0.0f,   0.0f,  1.0f};
  Parameter amp       {"amplitude",    "",  0.20f,  0.0f,  1.0f};

  ControlGUI gui;

  gam::NoiseWhite<>      noise;
  gam::Comb<float, gam::ipl::Linear> comb{0.1f};   // 100 ms max delay
  gam::LFO<>             lfo;

  static constexpr int N = 256;
  std::array<float, N> blockBuf{};
  std::atomic<int> blockW{0};

  Mesh spectrum, gridMesh;

  void onInit() override {
    gui << delay_min << delay_max << lfo_hz << feedback << feedforward << amp;
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
  }

  void onSound(AudioIOData& io) override {
    lfo.freq(lfo_hz.get());
    const float dmin = delay_min.get() * 0.001f;
    const float dmax = delay_max.get() * 0.001f;
    const float fb   = feedback.get();
    const float ff   = feedforward.get();
    const float a    = amp.get();

    while (io()) {
      const float u = lfo.cos() * 0.5f + 0.5f;     // 0..1
      const float dSec = dmin + u * (dmax - dmin);
      comb.delay(dSec);
      comb.fbk(fb);
      comb.ffd(ff);

      const float n = noise() * 0.4f;
      const float s = comb(n) * a;
      io.out(0) = s;
      io.out(1) = s;

      const int w = blockW.load(std::memory_order_relaxed);
      blockBuf[w] = s;
      blockW.store((w + 1) % N, std::memory_order_release);
    }
  }

  void computeSpectrum(std::array<float, N / 2>& mag) {
    const int w = blockW.load(std::memory_order_acquire);
    std::array<float, N> x{};
    for (int i = 0; i < N; ++i) {
      const int idx = (w + i) % N;
      const float win = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (N - 1)));
      x[i] = blockBuf[idx] * win;
    }
    for (int k = 0; k < N / 2; ++k) {
      float re = 0.f, im = 0.f;
      const float ang = -2.0f * M_PI * k / N;
      for (int n = 0; n < N; ++n) {
        re += x[n] * std::cos(ang * n);
        im += x[n] * std::sin(ang * n);
      }
      mag[k] = std::sqrt(re * re + im * im) * (2.0f / N);
    }
  }

  void onAnimate(double /*dt*/) override {
    std::array<float, N / 2> mag{};
    computeSpectrum(mag);

    spectrum.reset();
    spectrum.primitive(Mesh::TRIANGLE_STRIP);
    for (int k = 0; k < N / 2; ++k) {
      const float xx = -1.4f + (static_cast<float>(k) / (N / 2 - 1)) * 2.8f;
      const float h  = std::min(1.6f, mag[k] * 8.0f);
      const float yb = -1.0f, yt = -1.0f + h;
      spectrum.vertex(xx, yb, 0.f);
      spectrum.vertex(xx, yt, 0.f);
      const float t = static_cast<float>(k) / (N / 2);
      const Color c{0.6f + 0.4f * t, 0.4f + 0.5f * (1.f - t), 0.85f};
      spectrum.color(c.r * 0.4f, c.g * 0.4f, c.b * 0.4f);
      spectrum.color(c.r,        c.g,        c.b);
    }

    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    gridMesh.vertex(-1.4f, -1.0f, 0.f); gridMesh.vertex(1.4f, -1.0f, 0.f);
    gridMesh.color(0.25f, 0.25f, 0.25f); gridMesh.color(0.25f, 0.25f, 0.25f);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.06f, 0.07f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(spectrum);
    gui.draw(g);
  }
};

ALLOLIB_WEB_MAIN(CombSwept)
`,
  },
  {
    id: 'mat-drawable-wavetable',
    title: 'Drawable Wavetable',
    description:
      'Click-and-drag in the canvas to draw a 256-point waveform; the oscillator plays it back at the carrier pitch. Visual layered: the table you drew (top, with playhead marker) + live spectrum (bottom, inline 256-point DFT). Drag from anywhere — when the mouse is in the canvas, x maps to table index, y maps to sample value.',
    category: 'mat-synthesis',
    subcategory: 'wavetable',
    code: `/**
 * Drawable Wavetable — MAT200B Phase 2
 *
 * 256-point wavetable indexed by a phase accumulator at 'carrier_hz'.
 * onMouseDrag writes mouse_y into the table at index = mouse_x (mapped
 * to [0..255]), giving you a paintbrush over the waveform. Clearing
 * resets to a sine; randomize fills with shaped noise; the smoothing
 * knob runs a small one-zero lowpass over the table on each redraw
 * so brush strokes don't alias too hard.
 *
 * Visual:
 *   top    — the table itself, drawn at y in [0.2 .. 1.4]
 *            with a playhead marker showing where the oscillator is.
 *   bottom — live magnitude spectrum from a 256-pt inline DFT of
 *            the recent audio block. Shape the table, watch the
 *            harmonics bloom.
 */

#include "al_playground_compat.hpp"

#include <array>
#include <atomic>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

using namespace al;

class DrawableWavetable : public App {
public:
  Parameter      carrier_hz {"carrier_hz", "", 220.0f,  20.0f, 2000.0f};
  Parameter      amp        {"amplitude",  "",  0.30f,  0.0f,  1.0f};
  Parameter      smoothing  {"smoothing",  "",  0.20f,  0.0f,  0.95f};
  Trigger        clearTbl   {"clear_to_sine", ""};
  Trigger        randomize  {"randomize", ""};

  ControlGUI gui;

  // Wavetable + phase accumulator.
  static constexpr int TBL = 256;
  std::array<float, TBL> table{};
  double phase = 0.0;

  // Input audio capture for spectrum.
  static constexpr int N = 256;
  std::array<float, N> blockBuf{};
  std::atomic<int> blockW{0};

  // Smoothed playhead index (atomic-published from audio thread).
  std::atomic<float> playheadIdx{0.0f};

  // Mouse interaction state. The latest dragged-to (idx, value) pair
  // gets applied next animation frame so the audio thread doesn't have
  // to touch the table mid-block.
  std::atomic<int>   pendingIdx{-1};
  std::atomic<float> pendingVal{0.f};

  Mesh tableMesh, spectrum, gridMesh, playMarker;

  void onInit() override {
    gui << carrier_hz << amp << smoothing << clearTbl << randomize;

    clearTbl.registerChangeCallback([this](float) {
      for (int i = 0; i < TBL; ++i) {
        table[i] = std::sin(2.0f * M_PI * i / TBL);
      }
    });
    randomize.registerChangeCallback([this](float) {
      for (int i = 0; i < TBL; ++i) {
        table[i] = (static_cast<float>(std::rand()) / RAND_MAX) * 2.f - 1.f;
      }
      // Two passes of one-zero LPF to take the harshest edges off.
      for (int pass = 0; pass < 2; ++pass) {
        float prev = table[0];
        for (int i = 1; i < TBL; ++i) {
          const float y = 0.5f * (prev + table[i]);
          prev = table[i];
          table[i] = y;
        }
      }
    });

    // Init to sine.
    for (int i = 0; i < TBL; ++i) table[i] = std::sin(2.0f * M_PI * i / TBL);
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
  }

  void onSound(AudioIOData& io) override {
    const float sr = io.framesPerSecond();
    const float dPh = TBL * carrier_hz.get() / sr;
    const float a   = amp.get();

    while (io()) {
      const int i0 = static_cast<int>(phase) % TBL;
      const int i1 = (i0 + 1) % TBL;
      const float frac = static_cast<float>(phase - std::floor(phase));
      const float s = (table[i0] + (table[i1] - table[i0]) * frac) * a;
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
      const float win = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (N - 1)));
      x[i] = blockBuf[idx] * win;
    }
    for (int k = 0; k < N / 2; ++k) {
      float re = 0.f, im = 0.f;
      const float ang = -2.0f * M_PI * k / N;
      for (int n = 0; n < N; ++n) {
        re += x[n] * std::cos(ang * n);
        im += x[n] * std::sin(ang * n);
      }
      mag[k] = std::sqrt(re * re + im * im) * (2.0f / N);
    }
  }

  void onAnimate(double /*dt*/) override {
    // Apply any pending drag write.
    const int pIdx = pendingIdx.exchange(-1, std::memory_order_acquire);
    if (pIdx >= 0 && pIdx < TBL) {
      table[pIdx] = std::max(-1.0f, std::min(1.0f, pendingVal.load()));
      // Optional smoothing pass blended by knob amount.
      const float s = smoothing.get();
      if (s > 0.f) {
        const int j0 = (pIdx - 1 + TBL) % TBL;
        const int j2 = (pIdx + 1)        % TBL;
        const float avg = (table[j0] + table[pIdx] + table[j2]) / 3.f;
        table[pIdx] = table[pIdx] * (1.f - s) + avg * s;
      }
    }

    // Render the table as a LINE_STRIP across the top half.
    tableMesh.reset();
    tableMesh.primitive(Mesh::LINE_STRIP);
    for (int i = 0; i < TBL; ++i) {
      const float xx = -1.4f + (static_cast<float>(i) / (TBL - 1)) * 2.8f;
      const float yy = 0.8f + table[i] * 0.55f;
      tableMesh.vertex(xx, yy, 0.f);
      tableMesh.color(0.6f, 0.95f, 0.4f);
    }

    // Spectrum across the bottom.
    std::array<float, N / 2> mag{};
    computeSpectrum(mag);
    spectrum.reset();
    spectrum.primitive(Mesh::LINE_STRIP);
    for (int k = 0; k < N / 2; ++k) {
      const float xx = -1.4f + (static_cast<float>(k) / (N / 2 - 1)) * 2.8f;
      const float h  = std::min(1.4f, mag[k] * 7.0f);
      const float yy = -1.0f + h;
      spectrum.vertex(xx, yy, 0.f);
      const float t = static_cast<float>(k) / (N / 2);
      spectrum.color(0.4f + 0.5f * t, 0.5f, 0.95f - 0.3f * t);
    }

    // Grid + a small dot showing the current playhead within the table.
    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    gridMesh.vertex(-1.4f, 0.8f, 0.f); gridMesh.vertex(1.4f, 0.8f, 0.f);
    gridMesh.vertex(-1.4f,-1.0f, 0.f); gridMesh.vertex(1.4f,-1.0f, 0.f);
    for (int k = 0; k < 4; ++k) gridMesh.color(0.22f, 0.22f, 0.22f);

    const float p = playheadIdx.load(std::memory_order_acquire) / TBL;   // 0..1
    const float px = -1.4f + p * 2.8f;
    const int idx = static_cast<int>(p * (TBL - 1));
    const float py = 0.8f + table[idx] * 0.55f;
    playMarker.reset();
    playMarker.primitive(Mesh::TRIANGLES);
    Mesh d; addDisc(d, 0.05f, 12);
    for (size_t v = 0; v < d.vertices().size(); ++v) {
      const auto& q = d.vertices()[v];
      playMarker.vertex(q.x + px, q.y + py, 0.f);
      playMarker.color(1.0f, 0.85f, 0.2f);
    }
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.05f, 0.07f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(tableMesh);
    g.draw(playMarker);
    g.draw(spectrum);
    gui.draw(g);
  }

  // Map mouse pixel coords (origin top-left) to table index + value.
  void writeFromMouse(const Mouse& m) {
    const float w = static_cast<float>(width());
    const float h = static_cast<float>(height());
    if (w < 1.f || h < 1.f) return;
    const float u  = std::max(0.0f, std::min(1.0f, m.x() / w));
    const float vy = std::max(0.0f, std::min(1.0f, m.y() / h));
    // Only react when the mouse is in the table's vertical band — top
    // ~60% of the canvas.
    if (vy > 0.7f) return;
    const int idx = std::min(TBL - 1, static_cast<int>(u * TBL));
    // Map [0..0.7] -> [+1..-1] (y is down in pixels, up in audio amplitude).
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
      'Pure waveshaping: input sine -> arbitrary memoryless transfer function -> output. Pick the shape from a menu (tanh, atan, hard-clip, soft-cubic, sin) and drive it with the gain knob to watch how harmonic content blooms. Three panels stacked: the transfer function, the input waveform, the output waveform. Live spectrum at the bottom.',
    category: 'mat-signal',
    subcategory: 'dynamics',
    code: `/**
 * Waveshaper Distortion Explorer — MAT200B Phase 2
 *
 * Memoryless nonlinearity y = f(drive * x). The 'shape' menu picks
 * which f() to use:
 *   tanh        soft saturation (smooth knee), classic tube model
 *   atan        slightly sharper than tanh
 *   hardclip    discontinuous; lots of high-order harmonics
 *   cubic       y = x - x^3 / 3 (Chebyshev-ish); odd harmonics only
 *   sin         folder y = sin(pi/2 * x); aliasing-prone, fun
 *
 * Visual: transfer curve (top), input waveform (middle), output
 * waveform (below it), live magnitude spectrum (bottom). Crank
 * 'drive' to watch the input get pushed toward the curve's
 * saturation regions and the spectrum fan out into harmonics.
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

class Waveshaper : public App {
public:
  Parameter     freq    {"freq",     "", 220.0f,  50.0f, 2000.0f};
  Parameter     drive   {"drive",    "",   2.0f,   0.1f,  20.0f};
  Parameter     output  {"output",   "",   0.30f,  0.0f,  1.0f};
  ParameterMenu shape   {"shape",    ""};

  ControlGUI gui;

  gam::Sine<> osc;

  static constexpr int N = 256;
  std::array<float, N> blockIn{}, blockOut{};
  std::atomic<int> blockW{0};

  Mesh transferCurve, waveIn, waveOut, spectrum, gridMesh;

  static float shapeFn(int s, float x) {
    switch (s) {
      case 0: return std::tanh(x);
      case 1: return (2.0f / M_PI) * std::atan(x);
      case 2: return std::max(-1.0f, std::min(1.0f, x));
      case 3: {
        const float y = std::max(-1.5f, std::min(1.5f, x));
        return y - (y * y * y) / 3.0f;
      }
      case 4: return std::sin((M_PI * 0.5f) * std::max(-1.0f, std::min(1.0f, x)));
      default: return std::tanh(x);
    }
  }

  void onInit() override {
    shape.setElements({"tanh", "atan", "hardclip", "cubic", "sin"});
    shape.set(0);
    gui << freq << drive << output << shape;
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
  }

  void onSound(AudioIOData& io) override {
    osc.freq(freq.get());
    const float dr = drive.get();
    const float og = output.get();
    const int   sh = shape.get();
    while (io()) {
      const float xin = osc();
      const float y   = shapeFn(sh, dr * xin) * og;
      io.out(0) = y;
      io.out(1) = y;
      const int w = blockW.load(std::memory_order_relaxed);
      blockIn[w]  = xin;
      blockOut[w] = y;
      blockW.store((w + 1) % N, std::memory_order_release);
    }
  }

  void computeSpectrum(std::array<float, N / 2>& mag, const std::array<float, N>& src) {
    std::array<float, N> x{};
    for (int i = 0; i < N; ++i) {
      const float win = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (N - 1)));
      x[i] = src[i] * win;
    }
    for (int k = 0; k < N / 2; ++k) {
      float re = 0.f, im = 0.f;
      const float ang = -2.0f * M_PI * k / N;
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

    // Transfer curve sampled at 240 points across [-1, +1] input.
    transferCurve.reset();
    transferCurve.primitive(Mesh::LINE_STRIP);
    constexpr int TC = 240;
    for (int i = 0; i < TC; ++i) {
      const float xin = -1.0f + 2.0f * i / (TC - 1);
      const float y   = shapeFn(sh, dr * xin);
      // Map (-1..+1) input to x in [-1.4, +1.4]; (-1..+1) output to y in [0.4, 1.4].
      const float xx = -1.4f + (xin + 1.f) * 0.5f * 2.8f;
      const float yy = 0.4f + (std::max(-1.f, std::min(1.f, y)) + 1.f) * 0.5f;
      transferCurve.vertex(xx, yy, 0.f);
      transferCurve.color(0.4f, 0.95f, 0.6f);
    }

    // Input + output waveforms, in/out side by side stacked vertically.
    const int w = blockW.load(std::memory_order_acquire);
    waveIn.reset(); waveOut.reset();
    waveIn.primitive(Mesh::LINE_STRIP);
    waveOut.primitive(Mesh::LINE_STRIP);
    for (int i = 0; i < N; ++i) {
      const int idx = (w + i) % N;
      const float xx = -1.4f + (static_cast<float>(i) / (N - 1)) * 2.8f;
      waveIn.vertex (xx, blockIn[idx]  * 0.18f - 0.10f, 0.f);
      waveIn.color(0.5f, 0.7f, 0.95f);
      waveOut.vertex(xx, blockOut[idx] * 0.18f - 0.45f, 0.f);
      waveOut.color(0.95f, 0.6f, 0.35f);
    }

    // Spectrum of the OUTPUT (most interesting visually).
    std::array<float, N / 2> mag{};
    computeSpectrum(mag, blockOut);
    spectrum.reset();
    spectrum.primitive(Mesh::LINE_STRIP);
    for (int k = 0; k < N / 2; ++k) {
      const float xx = -1.4f + (static_cast<float>(k) / (N / 2 - 1)) * 2.8f;
      const float h  = std::min(0.7f, mag[k] * 4.0f);
      spectrum.vertex(xx, -1.0f + h, 0.f);
      const float t = static_cast<float>(k) / (N / 2);
      spectrum.color(0.95f - 0.3f * t, 0.55f, 0.4f + 0.5f * t);
    }

    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    // Identity diagonal in the transfer area
    gridMesh.vertex(-1.4f, 0.4f, 0.f); gridMesh.vertex(1.4f, 1.4f, 0.f);
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
    g.draw(waveIn);
    g.draw(waveOut);
    g.draw(spectrum);
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
      'A cascade of N first-order allpass sections has flat magnitude (1.0 at every frequency) but non-trivial phase response. The phase plot shows the dispersion that gives allpass chains their characteristic "phasiness" sound — useful for reverbs, smear-filters, and Schroeder-style decorrelators. Audio: white noise through the cascade. Visual: the analytic phase curve across frequency.',
    category: 'mat-signal',
    subcategory: 'delay',
    code: `/**
 * Allpass Dispersion Plot — MAT200B Phase 2
 *
 * First-order allpass section:
 *   H(z) = (a + z^-1) / (1 + a*z^-1)     |H(e^jw)| = 1 for all w
 * Phase response (for one section):
 *   phi(w) = -w - 2 * atan2(a*sin(w), 1 + a*cos(w))
 * For an N-section cascade with the same coefficient, total phase is
 * N * phi(w). Different a's (or alternating signs) give richer
 * dispersion patterns; here all sections share one 'coefficient' so
 * the plot stays readable.
 *
 * Audio: white noise -> cascade -> output. The magnitude is flat so
 * tone colour stays constant; what changes is transient smearing
 * — increase 'sections' from 1 to 12 and you can hear the high-end
 * become more diffuse even though no frequencies are filtered out.
 *
 * Visual: phase curve in red across the lower half of the canvas
 * (range -2pi..+2pi mapped to y range), reference flat-magnitude
 * line in dim grey, and a live spectrum of the output for sanity
 * (should remain near-flat).
 */

#include "al_playground_compat.hpp"
#include "Gamma/Filter.h"
#include "Gamma/Noise.h"

#include <array>
#include <atomic>
#include <cmath>
#include <vector>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

using namespace al;

class AllpassDispersion : public App {
public:
  Parameter      coefficient {"coefficient", "",  0.7f, -0.95f, 0.95f};
  ParameterInt   sections    {"sections",    "",  4,    1,     12};
  Parameter      amp         {"amplitude",   "",  0.20f, 0.0f, 1.0f};

  ControlGUI gui;

  gam::NoiseWhite<> noise;

  static constexpr int N = 256;
  std::array<float, N> blockBuf{};
  std::atomic<int> blockW{0};

  // Per-stage state for the manual allpass cascade. Inline implementation
  // keeps us portable across gam::AllPass1 API differences between Gamma
  // versions; the math is small enough to write directly.
  //   y[n] = -a*x[n] + x[n-1] + a*y[n-1]
  std::array<float, 12> stateX{}, stateY{};

  Mesh phaseCurve, spectrum, gridMesh;

  void onInit() override {
    gui << coefficient << sections << amp;
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
  }

  inline float runStage(int i, float x, float a) {
    const float y = -a * x + stateX[i] + a * stateY[i];
    stateX[i] = x;
    stateY[i] = y;
    return y;
  }

  void onSound(AudioIOData& io) override {
    const int   n = sections.get();
    const float a = coefficient.get();
    const float g = amp.get();
    while (io()) {
      float s = noise() * 0.4f;
      for (int i = 0; i < n; ++i) s = runStage(i, s, a);
      const float y = s * g;
      io.out(0) = y;
      io.out(1) = y;
      const int w = blockW.load(std::memory_order_relaxed);
      blockBuf[w] = y;
      blockW.store((w + 1) % N, std::memory_order_release);
    }
  }

  void computeSpectrum(std::array<float, N / 2>& mag) {
    const int w = blockW.load(std::memory_order_acquire);
    std::array<float, N> x{};
    for (int i = 0; i < N; ++i) {
      const int idx = (w + i) % N;
      const float win = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (N - 1)));
      x[i] = blockBuf[idx] * win;
    }
    for (int k = 0; k < N / 2; ++k) {
      float re = 0.f, im = 0.f;
      const float ang = -2.0f * M_PI * k / N;
      for (int n = 0; n < N; ++n) {
        re += x[n] * std::cos(ang * n);
        im += x[n] * std::sin(ang * n);
      }
      mag[k] = std::sqrt(re * re + im * im) * (2.0f / N);
    }
  }

  void onAnimate(double /*dt*/) override {
    const int n  = sections.get();
    const float a = coefficient.get();

    // Analytic phase response: 240 freq points across (0, pi).
    phaseCurve.reset();
    phaseCurve.primitive(Mesh::LINE_STRIP);
    constexpr int W2 = 240;
    for (int k = 0; k < W2; ++k) {
      const float w = (M_PI * (k + 1)) / W2;
      // One-section phase: phi = -w - 2 * atan2(a*sin(w), 1+a*cos(w))
      const float phi1 = -w - 2.0f * std::atan2(a * std::sin(w), 1.0f + a * std::cos(w));
      const float phiN = phi1 * n;
      // Map phase from [-2pi*N..+2pi*N] to y in [-0.95..+0.40].
      const float yScale = std::max(1.0f, 2.0f * M_PI * static_cast<float>(n));
      const float yy = -0.275f + 0.675f * (phiN / yScale);
      const float xx = -1.4f + (static_cast<float>(k) / (W2 - 1)) * 2.8f;
      phaseCurve.vertex(xx, yy, 0.f);
      phaseCurve.color(0.95f, 0.45f, 0.4f);
    }

    // Live magnitude spectrum (should stay near-flat — that's the point).
    std::array<float, N / 2> mag{};
    computeSpectrum(mag);
    spectrum.reset();
    spectrum.primitive(Mesh::LINE_STRIP);
    for (int k = 0; k < N / 2; ++k) {
      const float xx = -1.4f + (static_cast<float>(k) / (N / 2 - 1)) * 2.8f;
      const float h  = std::min(0.6f, mag[k] * 8.0f);
      spectrum.vertex(xx, -1.05f + h, 0.f);
      const float t = static_cast<float>(k) / (N / 2);
      spectrum.color(0.4f + 0.5f * t, 0.85f, 0.5f);
    }

    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    // Phase axis baseline + zero line at midpoint.
    gridMesh.vertex(-1.4f, -0.275f, 0.f); gridMesh.vertex(1.4f, -0.275f, 0.f);
    gridMesh.vertex(-1.4f, -1.05f,  0.f); gridMesh.vertex(1.4f, -1.05f,  0.f);
    for (int k = 0; k < 4; ++k) gridMesh.color(0.22f, 0.22f, 0.22f);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.04f, 0.07f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(phaseCurve);
    g.draw(spectrum);
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
      'Real bidirectional waveguide string: two delay lines (left-going and right-going waves) exchange energy at each end through one-zero lowpass reflections. Pluck = noise burst written into both lines centred on the pluck position; pickup taps both lines at a configurable position. Tweak stiffness/damping to morph from piano-string to nylon-guitar to almost-rubber-band — and watch both travelling waves as separate strips on screen.',
    category: 'mat-synthesis',
    subcategory: 'physical',
    code: `/**
 * 1D Waveguide Instrument — MAT200B Phase 2 (physical models)
 *
 * Bidirectional digital waveguide model of a string. Unlike a
 * Karplus-Strong delay-line which folds both travelling waves into a
 * single buffer, here we keep them separate:
 *
 *   rightGoing[]  — wave moving toward the right boundary
 *   leftGoing[]   — wave moving toward the left boundary
 *
 * Each audio sample reflects with a sign flip + one-zero lowpass at
 * each boundary; the reflected sample feeds the OPPOSITE delay line.
 * 'stiffness' opens the boundary lowpass for a brighter, more piano-
 * like ring; 'damping' is the per-section feedback gain.
 *
 *   pitch_hz     50..1200  Hz       fundamental (delay length D = sr/f)
 *   pluckPos     0.05..0.95          pluck location along the string
 *   pickupPos    0.05..0.95          pickup tap location
 *   damping      0.90..1.00          per-sample feedback gain
 *   stiffness    0.0..1.0            boundary one-zero coefficient blend
 *   excitation   0.0..1.0            pluck noise amplitude
 *   pluck        Trigger             fires a new pluck burst
 */

#include "al_playground_compat.hpp"

#include <atomic>
#include <cmath>
#include <cstdlib>
#include <vector>

using namespace al;

class WaveguideString : public App {
public:
  Parameter pitch_hz   {"pitch_hz",   "", 220.0f, 50.0f, 1200.0f};
  Parameter pluckPos   {"pluckPos",   "",   0.30f, 0.05f,  0.95f};
  Parameter pickupPos  {"pickupPos",  "",   0.65f, 0.05f,  0.95f};
  Parameter damping    {"damping",    "",   0.99f, 0.90f,  1.00f};
  Parameter stiffness  {"stiffness",  "",   0.30f, 0.0f,   1.0f};
  Parameter excitation {"excitation", "",   0.60f, 0.0f,   1.0f};
  Trigger   pluck      {"pluck",      ""};

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

  Mesh rightStrip, leftStrip, gridMesh, pickupMarker;

  void onInit() override {
    gui << pitch_hz << pluckPos << pickupPos
        << damping << stiffness << excitation << pluck;
    pluck.registerChangeCallback([this](float) {
      pluckPending.store(1, std::memory_order_release);
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

    const float fb    = damping.get();
    const float aLP   = 0.5f - 0.5f * stiffness.get();

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

      const float intoRight = -lpLeft  * fb;
      const float intoLeft  = -lpRight * fb;

      const float pR = tap(rightGoing, writeIdxR, pickupTap);
      const float pL = tap(leftGoing,  writeIdxL, D - 1 - pickupTap);
      const float out = (pR + pL) * 0.5f;

      writeIdxR = (writeIdxR + 1) % MAX_DELAY;
      writeIdxL = (writeIdxL + 1) % MAX_DELAY;
      rightGoing[writeIdxR] = intoRight;
      leftGoing[writeIdxL]  = intoLeft;

      io.out(0) = out;
      io.out(1) = out;
    }
  }

  void onAnimate(double /*dt*/) override {
    const int D = delayLenAtomic.load(std::memory_order_acquire);
    constexpr int VN = 384;
    const int step = std::max(1, D / VN);

    rightStrip.reset();
    rightStrip.primitive(Mesh::LINE_STRIP);
    leftStrip.reset();
    leftStrip.primitive(Mesh::LINE_STRIP);

    int count = 0;
    for (int k = 0; k < D && count < VN; k += step, ++count) {
      const float t = static_cast<float>(count) / VN;
      const float x = -1.4f + 2.8f * t;

      const float vr = tap(rightGoing, writeIdxR, k);
      rightStrip.vertex(x, 0.5f + vr * 0.6f, 0.f);
      rightStrip.color(0.95f, 0.55f + 0.3f * t, 0.30f);

      const float vl = tap(leftGoing, writeIdxL, D - 1 - k);
      leftStrip.vertex(x, -0.5f + vl * 0.6f, 0.f);
      leftStrip.color(0.30f, 0.65f + 0.3f * t, 0.95f);
    }

    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    gridMesh.vertex(-1.4f,  0.5f, 0.f); gridMesh.vertex(1.4f,  0.5f, 0.f);
    gridMesh.vertex(-1.4f, -0.5f, 0.f); gridMesh.vertex(1.4f, -0.5f, 0.f);
    for (int i = 0; i < 4; ++i) gridMesh.color(0.22f, 0.22f, 0.25f);

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
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.05f, 0.07f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(rightStrip);
    g.draw(leftStrip);
    g.draw(pickupMarker);
    gui.draw(g);
  }
};

ALLOLIB_WEB_MAIN(WaveguideString)
`,
  },
  {
    id: 'mat-subtractive',
    title: 'Subtractive Synth — Saw + Resonant Filter',
    description:
      "Classic subtractive synthesis: a sawtooth oscillator whose harmonics are sculpted by a resonant lowpass biquad, with two ADSR envelopes — one shaping amplitude, the other sweeping the filter cutoff for that signature 'wah' motion. Visualization plots the filter's pole/zero positions on the complex z-plane (unit circle, two poles inside, two zeros at z=-1) above a live magnitude spectrum so the harmonic carving is visible while you hear it.",
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
 * Visual top: z-plane unit circle with illustrative pole/zero dots.
 * Visual bottom: 256-pt Hann-windowed inline DFT of the output.
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

  Mesh spectrum, gridMesh, unitCircle, poleMesh, zeroMesh;

  void onInit() override {
    gui << pitch_hz << cutoff_hz << resonance << env_amount
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

      io.out(0) = y;
      io.out(1) = y;

      const int w = blockW.load(std::memory_order_relaxed);
      blockBuf[w] = y;
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
    const float Q    = resonance.get();
    const float ce   = cutEnvViz.load(std::memory_order_relaxed);
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

    const float poleR     = std::max(0.0f,
                              std::min(0.99f, 1.0f - static_cast<float>(M_PI) * fc / (sr * Q)));
    const float poleTheta = 2.0f * static_cast<float>(M_PI) * fc / sr;

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
    gui.draw(g);
  }

  bool onMouseDown(const Mouse&) override { return false; }
  bool onMouseDrag(const Mouse&) override { return false; }
  bool onMouseUp  (const Mouse&) override { return false; }
};

ALLOLIB_WEB_MAIN(Subtractive)
`,
  },
  {
    id: 'mat-granular-cloud',
    title: 'Granular Cloud Visualizer',
    description:
      'Granular synthesis lab fed by a bundled CC0 loop. Each grain reads a Hann-windowed slice of the source at a randomized position and pitch shift. Visualization plots every active grain as a glowing dot in (source position x semitone) space, fading from bright to dark as the grain ages. Knobs cover density, grain length, position spread, pitch spread, pan spread, and amplitude.',
    category: 'mat-synthesis',
    subcategory: 'granular',
    code: `/**
 * Granular Cloud Visualizer — MAT200B granular synthesis
 *
 * Streams a bundled CC0 loop through a fixed-size pool of 32 grains.
 * Each grain has a Hann envelope, randomized start position, pitch
 * shift, and pan; advances by srcSR/hostSR per output sample.
 *
 * Visualization: every active grain plotted as a small disc at
 * (sourcePos, semitones) — newest grains glow, retiring grains
 * fade to dark.
 */

#include "al_playground_compat.hpp"
#include "al_WebSamplePlayer.hpp"

#include <array>
#include <atomic>
#include <cmath>
#include <cstdlib>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

using namespace al;

class GranularCloud : public App {
public:
  ParameterMenu source         {"source",          ""};
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
    bool   active   = false;
    int    startFrame = 0;
    double curFrame  = 0.0;
    float  pitchRatio = 1.f;
    int    dur       = 1;
    int    age       = 0;
    float  pan       = 0.f;
    float  semitones = 0.f;
  };
  std::array<Grain, MAX_GRAINS> grains{};

  struct GrainSnap {
    bool  active;
    float startNorm;
    float semitones;
    float ageNorm;
  };
  std::array<GrainSnap, MAX_GRAINS> snap{};
  std::atomic<int> snapPublish{0};

  static float frand(float lo, float hi) {
    const float u = static_cast<float>(std::rand()) / static_cast<float>(RAND_MAX);
    return lo + u * (hi - lo);
  }

  Mesh cloudMesh, gridMesh, bandMesh;

  void onInit() override {
    source.setElements({"drums", "pad", "mixed"});
    source.set(0);

    gui << source << density_hz << grain_ms << position_spread
        << centerPos << pitch_spread << pan_spread << amp;

    source.registerChangeCallback([this](float v) {
      switch (static_cast<int>(v)) {
        case 0: current = &drums; break;
        case 1: current = &pad;   break;
        case 2: current = &mixed; break;
      }
      for (auto& g : grains) g.active = false;
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

  void onSound(AudioIOData& io) override {
    if (!current || !current->ready()) {
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

      io.out(0) = outL * gain;
      io.out(1) = outR * gain;
    }

    for (int i = 0; i < MAX_GRAINS; ++i) {
      const Grain& gr = grains[i];
      GrainSnap& s = snap[i];
      s.active    = gr.active;
      s.startNorm = (nFrames > 1)
          ? static_cast<float>(gr.startFrame) / static_cast<float>(nFrames - 1)
          : 0.f;
      s.semitones = gr.semitones;
      s.ageNorm   = (gr.dur > 0)
          ? std::min(1.0f, static_cast<float>(gr.age) / static_cast<float>(gr.dur))
          : 1.f;
    }
    snapPublish.fetch_add(1, std::memory_order_release);
  }

  static float startToX(float startNorm) {
    return -1.4f + startNorm * 2.8f;
  }
  static float semiToY(float st) {
    return -1.0f + (st + 12.0f) / 24.0f * 2.0f;
  }

  // Inline disc emitter — pushes a TRIANGLES fan into 'm' centred at (cx,cy).
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
    auto vline = [&](float x, float r, float g, float b) {
      bandMesh.vertex(x, -1.0f, 0.f);
      bandMesh.vertex(x,  1.0f, 0.f);
      bandMesh.color(r, g, b);
      bandMesh.color(r, g, b);
    };
    vline(xL, 0.40f, 0.65f, 0.90f);
    vline(xC, 0.95f, 0.95f, 0.45f);
    vline(xR, 0.40f, 0.65f, 0.90f);

    cloudMesh.reset();
    cloudMesh.primitive(Mesh::TRIANGLES);
    for (int i = 0; i < MAX_GRAINS; ++i) {
      const GrainSnap& s = snap[i];
      if (!s.active) continue;
      const float px = startToX(s.startNorm);
      const float py = semiToY(s.semitones);
      const float bright = std::max(0.0f, 1.0f - s.ageNorm);
      const float r  = 0.20f + 0.80f * bright;
      const float gC = 0.10f + 0.85f * bright * bright;
      const float b  = 0.05f + 0.40f * bright * bright * bright;
      emitDisc(cloudMesh, px, py, 0.04f, 14, r, gC, b);
    }
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.04f, 0.07f);
    g.meshColor();
    g.draw(gridMesh);
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
    description: 'Play a bundled loop and visualize it at three simultaneous time scales (full loop overview, ~1s medium window, ~10ms short window) with per-scale dB-RMS meters.',
    category: 'mat-mixing',
    subcategory: 'stems',
    code: `/**
 * Multiscale Stem Visualizer
 *
 * Plays one of three bundled loops (drums, pad, mixed) and renders the
 * audio simultaneously at three time scales stacked vertically:
 *
 *   1. Top    : full-loop overview (downsampled min/max envelope, 256
 *               columns, with a moving playhead marker).
 *   2. Middle : medium-zoom window of the last ~zoom_med_ms ms.
 *   3. Bottom : live ~zoom_short_ms ms window.
 *
 * Three one-pole RMS detectors (short / medium / long taus) drive
 * dB meters pinned to the right edge.
 */
#include "al_playground_compat.hpp"
#include "al_WebSamplePlayer.hpp"
#include <array>
#include <vector>
#include <cmath>
#include <cstring>

using namespace al;

static const int   kFullCols    = 256;
static const int   kShortRing   = 1024;
static const int   kMedRing     = 72000;
static const float kHostSR      = 48000.f;

class MultiscaleStems : public App {
public:
  ControlGUI gui;

  ParameterMenu source{"source"};
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

  std::vector<float> envMin, envMax;
  int cachedFrames = 0;

  Mesh mFull, mMed, mShort, mBars, mGrid, mPlayhead;

  void onInit() override {
    source.setElements({"drums", "pad", "mixed"});
    gui << source << amp << zoom_short_ms << zoom_med_ms << retrigger;

    source.registerChangeCallback([this](int v) {
      switch (v) {
        case 0: current = &pDrums; break;
        case 1: current = &pPad;   break;
        default: current = &pMixed; break;
      }
      playhead = 0.0;
      buildFullEnvelope();
    });

    retrigger.registerChangeCallback([this](float) {
      playhead = 0.0;
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
    if (!current || current->frames() <= 0) {
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

      shortRing[shortW] = s;
      shortW = (shortW + 1) % kShortRing;
      medRing[medW] = s;
      medW = (medW + 1) % kMedRing;

      float ax = std::fabs(s);
      rmsShort = (1.f - coefShort) * ax + coefShort * rmsShort;
      rmsMed   = (1.f - coefMed)   * ax + coefMed   * rmsMed;
      rmsLong  = (1.f - coefLong)  * ax + coefLong  * rmsLong;

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

  void onDraw(Graphics& g) override {
    g.clear(0.06f, 0.07f, 0.09f);

    const float xL = -1.4f, xR = 1.25f;

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

    mFull.reset();
    mFull.primitive(Mesh::TRIANGLE_STRIP);
    if ((int)envMin.size() == kFullCols) {
      for (int c = 0; c < kFullCols; ++c) {
        float fx = xL + (c / (float)(kFullCols - 1)) * panelW;
        float yMin = +1.00f + envMin[c] * 0.33f;
        float yMax = +1.00f + envMax[c] * 0.33f;
        mFull.vertex(fx, yMax, 0); mFull.color(0.45f, 0.85f, 1.0f);
        mFull.vertex(fx, yMin, 0); mFull.color(0.25f, 0.55f, 0.8f);
      }
    }
    g.draw(mFull);

    mPlayhead.reset();
    mPlayhead.primitive(Mesh::LINES);
    if (cachedFrames > 0) {
      float t = (float)(playhead / (double)cachedFrames);
      float px = xL + t * panelW;
      mPlayhead.vertex(px, +1.32f, 0); mPlayhead.color(1.f, 1.f, 1.f);
      mPlayhead.vertex(px, +0.68f, 0); mPlayhead.color(1.f, 1.f, 1.f);
    }
    g.draw(mPlayhead);

    mMed.reset();
    mMed.primitive(Mesh::LINE_STRIP);
    int medSamples = (int)((zoom_med_ms.get() / 1000.f) * kHostSR);
    if (medSamples < 2) medSamples = 2;
    if (medSamples > kMedRing) medSamples = kMedRing;
    int verts = 512;
    for (int i = 0; i < verts; ++i) {
      int offs = (int)((float)i / (float)(verts - 1) * (medSamples - 1));
      int idx  = (medW - medSamples + offs) % kMedRing;
      if (idx < 0) idx += kMedRing;
      float s = medRing[(size_t)idx];
      float fx = xL + (i / (float)(verts - 1)) * panelW;
      float fy = +0.25f + s * 0.28f;
      mMed.vertex(fx, fy, 0);
      mMed.color(0.9f, 0.7f, 0.4f);
    }
    g.draw(mMed);

    mShort.reset();
    mShort.primitive(Mesh::LINE_STRIP);
    int shortSamples = (int)((zoom_short_ms.get() / 1000.f) * kHostSR);
    if (shortSamples < 2) shortSamples = 2;
    if (shortSamples > kShortRing) shortSamples = kShortRing;
    int sverts = std::min(512, shortSamples);
    for (int i = 0; i < sverts; ++i) {
      int offs = (int)((float)i / (float)(sverts - 1) * (shortSamples - 1));
      int idx  = (shortW - shortSamples + offs) % kShortRing;
      if (idx < 0) idx += kShortRing;
      float s = shortRing[(size_t)idx];
      float fx = xL + (i / (float)(sverts - 1)) * panelW;
      float fy = -0.50f + s * 0.32f;
      mShort.vertex(fx, fy, 0);
      mShort.color(1.0f, 0.55f, 0.6f);
    }
    g.draw(mShort);

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
    bar(1.35f, +0.65f, dbMap(rmsLong),  0.45f, 0.85f, 1.0f);
    bar(1.35f, -0.05f, dbMap(rmsMed),   0.9f,  0.7f,  0.4f);
    bar(1.35f, -0.85f, dbMap(rmsShort), 1.0f,  0.55f, 0.6f);
    g.draw(mBars);

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
      'Plays a bundled CC0 loop through two parallel chains: A is the clean reference, B is a simple mastering stack (gain trim + tilt EQ + soft tanh saturation). Toggle playB to A/B compare audibly with a 5-ms crossfade and an optional RMS loudness-match so the toggle judges timbre, not level. The visual stacks A on top, B in the middle, and the A-B difference as a filled red curve at the bottom — when the diff collapses to a flat line, B is doing nothing; as you push gain/tilt/saturation, the diff bulges.',
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
 * |A-B| difference (bottom, red TRIANGLE_STRIP fill) + RMS-diff bar +
 * coloured A/B badge.
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
  ParameterBool playB          {"playB",          "", false};
  Parameter     gain_dB        {"gain_dB",        "",  0.0f, -12.0f, 12.0f};
  Parameter     tiltAmount_dB  {"tiltAmount_dB",  "",  0.0f,  -6.0f,  6.0f};
  Parameter     tiltPivot_hz   {"tiltPivot_hz",   "", 800.0f, 100.0f, 4000.0f};
  Parameter     saturation     {"saturation",     "",  0.3f,  0.0f, 1.0f};
  Parameter     loudness_match {"loudness_match", "",  1.0f,  0.0f, 1.0f};
  Trigger       retrigger      {"retrigger",      ""};

  ControlGUI gui;

  WebSamplePlayer drums, pad, mixed;
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

  Mesh waveA, waveB, diffFill, gridMesh, rmsBar, badge;

  void onInit() override {
    source.setElements({"drums", "pad", "mixed"});
    source.set(0);

    gui << source << playB << gain_dB << tiltAmount_dB << tiltPivot_hz
        << saturation << loudness_match << retrigger;

    source.registerChangeCallback([this](float v) {
      switch (static_cast<int>(v)) {
        case 0: current = &drums; break;
        case 1: current = &pad;   break;
        case 2: current = &mixed; break;
      }
      playhead = 0.0;
    });
    retrigger.registerChangeCallback([this](float) { playhead = 0.0; });
    playB.registerChangeCallback([this](float v) {
      xfadeTarget.store(v > 0.5f ? 1 : 0, std::memory_order_release);
    });
  }

  void onCreate() override {
    gui.init();
    drums.load("drum_loop_120bpm.wav");
    pad.load("pad_loop.wav");
    mixed.load("mixed_loop.wav");

    lowShelf.type(gam::LOW_SHELF);
    highShelf.type(gam::HIGH_SHELF);
    lowShelf.res(0.707f);
    highShelf.res(0.707f);

    nav().pos(0, 0, 4.0f);
  }

  void onSound(AudioIOData& io) override {
    if (!current || !current->ready()) {
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

    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    const float rowYs[3] = { 0.85f, 0.10f, -0.65f };
    for (float y : rowYs) {
      gridMesh.vertex(-1.4f, y, 0.f);
      gridMesh.vertex( 1.4f, y, 0.f);
      gridMesh.color(0.22f, 0.22f, 0.26f);
      gridMesh.color(0.22f, 0.22f, 0.26f);
    }

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

    diffFill.reset();
    diffFill.primitive(Mesh::TRIANGLE_STRIP);
    const float yBase = rowYs[2];
    for (int i = 0; i < W; ++i) {
      const int idx = (w - W + i + RING) % RING;
      const float xx = -1.4f + (static_cast<float>(i) / (W - 1)) * 2.8f;
      const float d  = (ringA[idx] - ringB[idx]) * 0.45f;
      diffFill.vertex(xx, yBase,     0.f);
      diffFill.vertex(xx, yBase + d, 0.f);
      diffFill.color(0.95f, 0.30f, 0.30f);
      diffFill.color(0.95f, 0.30f, 0.30f);
    }

    rmsBar.reset();
    rmsBar.primitive(Mesh::TRIANGLES);
    const float diffDB = std::max(-12.0f, std::min(12.0f, dispRmsDiffDB.load()));
    const float barX0 = 1.55f, barX1 = 1.70f;
    const float barCenter = 0.10f;
    const float barH = (diffDB / 12.0f) * 0.6f;
    const float by0 = barCenter;
    const float by1 = barCenter + barH;
    const float ylo = std::min(by0, by1);
    const float yhi = std::max(by0, by1);
    rmsBar.vertex(barX0, ylo, 0.f); rmsBar.vertex(barX1, ylo, 0.f); rmsBar.vertex(barX1, yhi, 0.f);
    rmsBar.vertex(barX0, ylo, 0.f); rmsBar.vertex(barX1, yhi, 0.f); rmsBar.vertex(barX0, yhi, 0.f);
    const float bcR = (diffDB >= 0.f) ? 0.95f : 0.45f;
    const float bcG = (diffDB >= 0.f) ? 0.55f : 0.7f;
    const float bcB = (diffDB >= 0.f) ? 0.35f : 1.0f;
    for (int k = 0; k < 6; ++k) rmsBar.color(bcR, bcG, bcB);

    badge.reset();
    badge.primitive(Mesh::TRIANGLES);
    {
      const bool b = playB.get();
      const float r0 = b ? 0.95f : 0.45f;
      const float g0 = b ? 0.6f  : 0.65f;
      const float b0 = b ? 0.30f : 0.95f;
      emitDisc(badge, 1.30f, 1.20f, 0.10f, 24, r0, g0, b0);
    }
  }

  void onDraw(Graphics& g) override {
    g.clear(0.05f, 0.05f, 0.08f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(diffFill);
    g.draw(waveA);
    g.draw(waveB);
    g.draw(rmsBar);
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
      'Vertical thermometer-style loudness meter with cold/sweet/hot color zones plus a rolling 6-second history strip. Reference ticks at the streaming-platform norms (-23 / -18 / -14 dB) and a live cyan target line driven by the target_dB parameter. Honest caveat: this is RMS-pseudo-LUFS over a tunable window, not a true ITU-R BS.1770 K-weighted reading — qualitatively similar trend, easier to read in real time. Plays one of three bundled CC0 loops with a hot-running amp knob so you can push the meter into the red on purpose.',
    category: 'mat-mixing',
    subcategory: 'mastering',
    code: `/**
 * Mix Thermometer (Loudness Sweet-Spot Meter) — MAT200B Mixing/Mastering
 *
 * A vertical "thermometer" meter that visualizes the integrated
 * loudness of the playing loop over a tunable window (default 3 s).
 * Cold (blue) = too quiet, sweet (green) = inside target band,
 * hot (red) = too loud. Reference ticks at -23 / -18 / -14 dB.
 *
 * IMPORTANT — RMS-pseudo-LUFS caveat: true LUFS (ITU-R BS.1770)
 * needs K-weighting + gating. We skip both and use a one-pole RMS
 * over window_sec. The trend is qualitatively similar; absolute
 * values are not. Read as "how hot relative to my target," not
 * as "what would Spotify say."
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

  static constexpr int HIST_N = 360;
  std::array<float, HIST_N> hist{};
  int histW = 0;

  Mesh thermoBg, sweetBand, fillCol, refTicks, targetLine;
  Mesh histLine, histTarget, histBg;

  static constexpr float TH_X0 = -1.30f, TH_X1 = -1.00f;
  static constexpr float TH_Y0 = -0.90f, TH_Y1 =  0.90f;
  static constexpr float HS_X0 = -0.70f, HS_X1 =  1.40f;
  static constexpr float HS_Y0 = -0.40f, HS_Y1 =  0.40f;
  static constexpr float DB_LO = -60.0f, DB_HI = 0.0f;

  void onInit() override {
    source.setElements({"drums", "pad", "mixed"});
    source.set(0);

    gui << source << amp << windowSec << target_dB << sweetWidth_dB << retrigger;

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
    if (!current || !current->ready()) {
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

    while (io()) {
      const float s   = current->readInterp(0, static_cast<float>(playhead));
      playhead += rateRatio;
      if (playhead >= nFrames) playhead -= nFrames;

      const float out = s * gain;
      io.out(0) = out;
      io.out(1) = out;

      rmsLin = (1.f - coef) * out * out + coef * rmsLin;
    }

    const float rmsClamped = std::max(rmsLin, 1e-12f);
    const float dB = 10.0f * std::log10(rmsClamped);
    displayDB.store(dB, std::memory_order_release);
  }

  void onAnimate(double /*dt*/) override {
    const float dbNow = displayDB.load(std::memory_order_acquire);
    const float tgt   = target_dB.get();
    const float sw    = sweetWidth_dB.get();

    hist[histW] = dbNow;
    histW = (histW + 1) % HIST_N;

    thermoBg.reset();
    thermoBg.primitive(Mesh::TRIANGLE_STRIP);
    addRect(thermoBg, TH_X0, TH_Y0, TH_X1, TH_Y1, 0.10f, 0.10f, 0.13f);

    sweetBand.reset();
    sweetBand.primitive(Mesh::TRIANGLE_STRIP);
    {
      const float yLo = dbToThermoY(tgt - sw);
      const float yHi = dbToThermoY(tgt + sw);
      addRect(sweetBand, TH_X0, yLo, TH_X1, yHi, 0.10f, 0.35f, 0.18f);
    }

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

    refTicks.reset();
    refTicks.primitive(Mesh::TRIANGLES);
    const float refDBs[3] = {-23.f, -18.f, -14.f};
    for (int i = 0; i < 3; ++i) {
      const float y = dbToThermoY(refDBs[i]);
      const float x0 = TH_X0 - 0.03f;
      const float x1 = TH_X1 + 0.03f;
      const float halfH = 0.004f;
      const float r = 0.55f, gC = 0.55f, b = 0.55f;
      refTicks.vertex(x0, y - halfH, 0.f); refTicks.color(r, gC, b);
      refTicks.vertex(x1, y - halfH, 0.f); refTicks.color(r, gC, b);
      refTicks.vertex(x1, y + halfH, 0.f); refTicks.color(r, gC, b);
      refTicks.vertex(x0, y - halfH, 0.f); refTicks.color(r, gC, b);
      refTicks.vertex(x1, y + halfH, 0.f); refTicks.color(r, gC, b);
      refTicks.vertex(x0, y + halfH, 0.f); refTicks.color(r, gC, b);
    }

    targetLine.reset();
    targetLine.primitive(Mesh::TRIANGLE_STRIP);
    {
      const float y = dbToThermoY(tgt);
      addHLine(targetLine, TH_X0 - 0.05f, TH_X1 + 0.05f, y, 0.006f,
               0.30f, 0.95f, 1.00f);
    }

    histBg.reset();
    histBg.primitive(Mesh::TRIANGLE_STRIP);
    addRect(histBg, HS_X0, HS_Y0, HS_X1, HS_Y1, 0.07f, 0.07f, 0.10f);

    histTarget.reset();
    histTarget.primitive(Mesh::TRIANGLE_STRIP);
    {
      const float y = dbToHistY(tgt);
      addHLine(histTarget, HS_X0, HS_X1, y, 0.004f, 0.30f, 0.95f, 1.00f);
    }

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
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.04f, 0.07f);
    g.meshColor();

    g.draw(thermoBg);
    g.draw(sweetBand);
    g.draw(fillCol);
    g.draw(refTicks);
    g.draw(targetLine);

    g.draw(histBg);
    g.draw(histTarget);
    g.draw(histLine);

    gui.draw(g);
  }

  bool onMouseDown(const Mouse& /*m*/) override { return false; }
  bool onMouseDrag(const Mouse& /*m*/) override { return false; }
  bool onMouseUp  (const Mouse& /*m*/) override { return false; }
};

ALLOLIB_WEB_MAIN(MixThermometer)
`,
  },
]

// Multi-file MAT200B entries (e.g., examples that ship with auxiliary .glsl
// or extra headers). Phase 2 fills if needed.
export const mat200bMultiFileExamples: MultiFileExample[] = []
