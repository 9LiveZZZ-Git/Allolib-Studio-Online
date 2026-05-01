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
]

// Multi-file MAT200B entries (e.g., examples that ship with auxiliary .glsl
// or extra headers). Phase 2 fills if needed.
export const mat200bMultiFileExamples: MultiFileExample[] = []
