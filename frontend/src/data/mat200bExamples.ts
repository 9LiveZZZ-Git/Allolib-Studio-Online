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
      "White noise into a comb filter (gam::Comb) whose delay length is modulated by a low-frequency sine. The comb's notches appear at fk = k / delaySec, so as delay sweeps the notches march up and down the spectrum. The visualizer plots the deterministic transfer function |H(e^jω)| computed from the current delay/feedback/feedforward — visible immediately, no audio start-up wait — with a wallclock-driven LFO so the comb teeth animate even before the AudioContext engages.",
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
 * Visual: deterministic |H(e^jω)| of the IIR comb computed directly
 * from delay D, feedback g, feedforward c at every animation frame.
 * For sample-delay M = round(D * sr), the difference equation is
 *   y[n] = x[n] + c x[n-M] + g y[n-M]
 * giving transfer function
 *   H(z) = (1 + c z^-M) / (1 - g z^-M).
 * Magnitude on the unit circle z = e^jω, ω in [0, π], maps to
 * frequency [0, sr/2]. Plotting this directly means the visualizer
 * shows the correct comb response BEFORE audio starts, no DFT-of-
 * silence empty bars. The LFO is driven by wallclock so the sweep
 * is visible whether or not the AudioContext is running.
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

  // Wallclock LFO phase for the visualizer — so the spectrum animates
  // even when AudioContext hasn't started yet.
  double vizLfoPhase = 0.0;
  // Last known sample rate from audio thread (for converting delay
  // seconds -> integer sample-delay in the transfer function).
  std::atomic<float> sampleRateHz{48000.f};

  Mesh spectrum, gridMesh, notchMarks;

  void onInit() override {
    gui << delay_min << delay_max << lfo_hz << feedback << feedforward << amp;
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
  }

  void onSound(AudioIOData& io) override {
    sampleRateHz.store(io.framesPerSecond(), std::memory_order_relaxed);
    lfo.freq(lfo_hz.get());
    const float dmin = delay_min.get() * 0.001f;
    const float dmax = delay_max.get() * 0.001f;
    const float fb   = feedback.get();
    const float ff   = feedforward.get();
    const float a    = amp.get();

    while (io()) {
      const float u = lfo.cos() * 0.5f + 0.5f;
      const float dSec = dmin + u * (dmax - dmin);
      comb.delay(dSec);
      comb.fbk(fb);
      comb.ffd(ff);

      const float n = noise() * 0.4f;
      const float s = comb(n) * a;
      io.out(0) = s;
      io.out(1) = s;
    }
  }

  void onAnimate(double dt) override {
    // Wallclock LFO so the visual animates pre-audio.
    vizLfoPhase += dt * static_cast<double>(lfo_hz.get());
    if (vizLfoPhase > 1.0) vizLfoPhase -= std::floor(vizLfoPhase);
    const float u = 0.5f + 0.5f * std::cos(2.0f * static_cast<float>(M_PI)
                                           * static_cast<float>(vizLfoPhase));

    const float sr   = sampleRateHz.load(std::memory_order_relaxed);
    const float dmin = delay_min.get() * 0.001f;
    const float dmax = delay_max.get() * 0.001f;
    const float dSec = dmin + u * (dmax - dmin);
    const float g    = feedback.get();
    const float c    = feedforward.get();
    const int   M    = std::max(1, static_cast<int>(std::round(dSec * sr)));

    // Plot |H(e^jω)| at NB equally-spaced ω in [0, π].
    constexpr int NB = 256;
    spectrum.reset();
    spectrum.primitive(Mesh::TRIANGLE_STRIP);
    for (int k = 0; k < NB; ++k) {
      const float w = static_cast<float>(M_PI) * k / (NB - 1);
      const float wM = w * M;
      // numerator   N(e^jω) = 1 + c e^-jωM   -> |N|^2 = 1 + 2c cos(ωM) + c²
      const float numMag2 = 1.f + 2.f * c * std::cos(wM) + c * c;
      // denominator D(e^jω) = 1 - g e^-jωM   -> |D|^2 = 1 - 2g cos(ωM) + g²
      const float denMag2 = std::max(1e-6f,
                            1.f - 2.f * g * std::cos(wM) + g * g);
      const float H = std::sqrt(numMag2 / denMag2);
      // dB-ish vertical scale: log compresses the resonance peaks so
      // they don't shoot off-screen at high feedback.
      const float h  = std::min(1.6f, std::log10(1.f + H * 4.f) * 1.4f);

      const float xx = -1.4f + (static_cast<float>(k) / (NB - 1)) * 2.8f;
      const float yb = -1.0f, yt = -1.0f + h;
      spectrum.vertex(xx, yb, 0.f);
      spectrum.vertex(xx, yt, 0.f);
      const float t = static_cast<float>(k) / (NB - 1);
      // Bottom row darker, top row brighter — gives the peaks a clear
      // glow against the baseline.
      spectrum.color(0.20f + 0.20f * t, 0.20f + 0.30f * (1.f - t), 0.45f);
      spectrum.color(0.65f + 0.35f * t, 0.45f + 0.50f * (1.f - t), 0.95f);
    }

    // Mark the harmonic notch positions fk = k / D as dim vertical
    // ticks along the baseline. Helps the eye lock onto the math.
    notchMarks.reset();
    notchMarks.primitive(Mesh::LINES);
    if (dSec > 1e-6f && sr > 1.f) {
      const float fundamental = 1.f / dSec;     // Hz
      const float nyquist = 0.5f * sr;
      for (int kk = 1; kk < 64; ++kk) {
        const float fk = (kk - 0.5f) * fundamental;   // notch midpoints
        if (fk >= nyquist) break;
        const float xx = -1.4f + (fk / nyquist) * 2.8f;
        notchMarks.vertex(xx, -1.0f, 0.f);
        notchMarks.vertex(xx, -0.92f, 0.f);
        notchMarks.color(0.55f, 0.30f, 0.30f);
        notchMarks.color(0.55f, 0.30f, 0.30f);
      }
    }

    gridMesh.reset();
    gridMesh.primitive(Mesh::LINES);
    gridMesh.vertex(-1.4f, -1.0f, 0.f); gridMesh.vertex(1.4f, -1.0f, 0.f);
    gridMesh.color(0.25f, 0.25f, 0.25f); gridMesh.color(0.25f, 0.25f, 0.25f);
    // Mid-line and 0-dB-ish reference at h = log10(1 + 1*4) * 1.4 ≈ 0.98.
    const float refY = -1.0f + std::min(1.6f, std::log10(5.f) * 1.4f);
    gridMesh.vertex(-1.4f, refY, 0.f); gridMesh.vertex(1.4f, refY, 0.f);
    gridMesh.color(0.25f, 0.25f, 0.25f); gridMesh.color(0.25f, 0.25f, 0.25f);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.04f, 0.06f, 0.07f);
    g.meshColor();
    g.draw(gridMesh);
    g.draw(spectrum);
    g.draw(notchMarks);
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
  {
    id: 'mat-additive-geometry',
    title: 'Additive Geometry',
    description:
      'A single coefficient vector simultaneously drives a 16-partial additive synthesizer and a parametric 3D mesh whose radius is the same Fourier sum: r(theta) = R0 + sum(a_n * cos(n*theta)). Push the a3 slider up and you hear the third harmonic AND see three new lobes bloom around the surface. Mesh hue tracks the dominant harmonic index, and a thin time-domain scope ring traces one period of the audio waveform — which is also the mesh radius cross-section at the equator. The trick is a std::array<std::atomic<float>, 16> shared lock-free between audio and graphics.',
    category: 'mat-synthesis',
    subcategory: 'additive',
    code: `/**
 * Additive Geometry — MAT200B Phase 2 (additive synthesis)
 *
 * One std::array<std::atomic<float>, 16> drives BOTH:
 *   - audio: 16 sines summed with amplitudes a[n]
 *   - mesh:  parametric surface radius r(theta) = R0 + sum a_n cos(n theta)
 *
 * Slider a_n up -> harmonic n louder AND n lobes appear on the mesh.
 * The scope ring at the bottom traces r(theta) at the equator — same
 * curve as one period of the time-domain waveform.
 */

#include "al_playground_compat.hpp"
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

  Parameter f0      {"f0_Hz",       "",        110.0f,  40.0f,  440.0f};
  Parameter master  {"master",      "",          0.25f,  0.0f,    1.0f};
  Parameter a1{"a1","partials",1.00f,0.f,1.f}; Parameter a2{"a2","partials",0.f,0.f,1.f};
  Parameter a3{"a3","partials",0.00f,0.f,1.f}; Parameter a4{"a4","partials",0.f,0.f,1.f};
  Parameter a5{"a5","partials",0.00f,0.f,1.f}; Parameter a6{"a6","partials",0.f,0.f,1.f};
  Parameter a7{"a7","partials",0.00f,0.f,1.f}; Parameter a8{"a8","partials",0.f,0.f,1.f};
  Parameter tailDecay {"tail_decay","",  0.5f, 0.0f, 1.0f};
  Parameter rotate    {"rotate",    "",  0.3f, -2.0f, 2.0f};
  Parameter R0        {"base_radius","", 1.0f, 0.2f, 2.0f};
  ParameterBool wireframe {"wireframe","", false};
  Trigger sawPreset    {"preset_saw",   ""};
  Trigger squarePreset {"preset_square",""};
  Trigger clearPreset  {"preset_clear", ""};

  ControlGUI gui;

  Mesh surface, scope;
  static constexpr int N_LON = 64;
  static constexpr int N_LAT = 32;
  float yaw = 0.0f;
  int frameCount = 0;

  void onInit() override {
    for (int i = 0; i < N_PARTIALS; ++i) partialAmps[i].store(0.0f);
    partialAmps[0].store(1.0f);

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

    gui << f0 << master
        << a1 << a2 << a3 << a4 << a5 << a6 << a7 << a8
        << tailDecay << rotate << R0 << wireframe
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

  float radiusAt(float theta) const {
    float sum = 0.0f, norm = 0.0f;
    for (int i = 0; i < N_PARTIALS; ++i) {
      const float a = partialAmps[i].load(std::memory_order_relaxed);
      sum  += a * std::cos(float(i + 1) * theta);
      norm += a;
    }
    if (norm < 1e-4f) norm = 1.0f;
    return R0.get() + 0.5f * sum / norm;
  }

  int dominantPartial() const {
    int best = 0;
    float bestVal = -1.0f;
    for (int i = 0; i < N_PARTIALS; ++i) {
      const float a = partialAmps[i].load(std::memory_order_relaxed);
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

    const float hue = float(dominantPartial()) / float(N_PARTIALS);

    std::vector<Vec3f> verts;
    std::vector<float> rgb;
    verts.reserve((N_LAT + 1) * (N_LON + 1));
    rgb.reserve((N_LAT + 1) * (N_LON + 1) * 3);

    for (int j = 0; j <= N_LAT; ++j) {
      const float v = float(j) / float(N_LAT);
      const float phi = v * float(M_PI);
      const float sinPhi = std::sin(phi);
      const float cosPhi = std::cos(phi);
      for (int i = 0; i <= N_LON; ++i) {
        const float u = float(i) / float(N_LON);
        const float theta = u * 2.0f * float(M_PI);
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

    scope.reset();
    scope.primitive(Mesh::LINE_STRIP);
    constexpr int SCOPE_N = 256;
    for (int i = 0; i <= SCOPE_N; ++i) {
      const float u = float(i) / float(SCOPE_N);
      const float theta = u * 2.0f * float(M_PI);
      const float r = radiusAt(theta);
      scope.vertex(r * std::cos(theta), r * std::sin(theta), -2.0f);
      scope.color(0.95f, 0.95f, 0.95f);
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
    g.popMatrix();

    g.depthTesting(false);
    g.pushMatrix();
    g.translate(0.0f, -1.6f, 0.0f);
    g.scale(0.4f);
    g.meshColor();
    g.draw(scope);
    g.popMatrix();

    gui.draw(g);
  }

  void onSound(AudioIOData& io) override {
    const float amp = master.get();
    const float decay = tailDecay.get();
    float amps[N_PARTIALS];
    float norm = 0.0f;
    for (int i = 0; i < N_PARTIALS; ++i) {
      amps[i] = partialAmps[i].load(std::memory_order_relaxed)
                * std::pow(1.0f - 0.4f * decay, float(i));
      norm += amps[i];
    }
    if (norm < 1e-4f) norm = 1.0f;
    const float invNorm = amp / norm;

    while (io()) {
      float s = 0.0f;
      for (int i = 0; i < N_PARTIALS; ++i) s += amps[i] * oscs[i]();
      s *= invNorm;
      if (s >  1.0f) s =  1.0f;
      if (s < -1.0f) s = -1.0f;
      io.out(0) = s;
      io.out(1) = s;
    }
  }

  bool onMouseDown(const Mouse&) override { return false; }
  bool onMouseDrag(const Mouse&) override { return false; }
  bool onMouseUp  (const Mouse&) override { return false; }
};

ALLOLIB_WEB_MAIN(AdditiveGeometry)
`,
  },
  {
    id: 'mat-additive-sculptor',
    title: 'Additive Partial Sculptor',
    description:
      'Paint a 32-partial harmonic spectrum and hear it instantly. The top panel is a click-and-drag bar chart where each bar is the amplitude of partial n (frequency = f0 * n); the bottom panel is a live time-domain trace showing one period of the resulting waveform, computed by summing all 32 sines across [0, 2pi]. Sculpt sawtooth, square, and triangle approximations from the preset triggers, then drag bars to break the symmetry and watch the waveform redraw beneath your gesture. Honest caveat: 32 sine evals per sample at 48 kHz is fine on desktop, may stutter on mobile.',
    category: 'mat-synthesis',
    subcategory: 'additive',
    code: `/**
 * Additive Partial Sculptor — MAT200B Phase 2 (additive synthesis)
 *
 * 32 harmonic partials of a fundamental, painted by mouse drag.
 * Top panel: bar chart (the spectrum you sculpt).
 * Bottom panel: time-domain trace, one period summed from all 32 sines.
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

static const int NUM_PARTIALS = 32;
static const int WAVE_SAMPLES = 256;

class AdditiveSculptor : public App {
public:
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

  bool dragging = false;

  // Bar panel rect in world coords ([-1.5, 1.5] x [-0.9, 0.9] visible).
  static constexpr float BAR_X0 = -1.30f, BAR_X1 = 1.30f;
  static constexpr float BAR_Y0 =  0.10f, BAR_Y1 = 0.85f;
  static constexpr float WAV_X0 = -1.30f, WAV_X1 = 1.30f;
  static constexpr float WAV_Y0 = -0.85f, WAV_Y1 = -0.10f;

  void onInit() override {
    for (int i = 0; i < NUM_PARTIALS; ++i) partialAmps[i].store(0.0f);

    reset.registerChangeCallback([this](float) {
      for (int i = 0; i < NUM_PARTIALS; ++i) partialAmps[i].store(0.0f);
    });
    preset_saw.registerChangeCallback([this](float) {
      for (int i = 0; i < NUM_PARTIALS; ++i)
        partialAmps[i].store(1.0f / float(i + 1));
    });
    preset_square.registerChangeCallback([this](float) {
      for (int i = 0; i < NUM_PARTIALS; ++i) {
        const int n = i + 1;
        partialAmps[i].store((n % 2 == 1) ? 1.0f / float(n) : 0.0f);
      }
    });
    preset_triangle.registerChangeCallback([this](float) {
      for (int i = 0; i < NUM_PARTIALS; ++i) {
        const int n = i + 1;
        partialAmps[i].store((n % 2 == 1) ? 1.0f / float(n * n) : 0.0f);
      }
    });

    gui << pitch_hz << master_amp << reset
        << preset_saw << preset_square << preset_triangle;
  }

  void onCreate() override {
    gui.init();
    nav().pos(0, 0, 4.0f);
    for (int i = 0; i < NUM_PARTIALS; ++i) osc[i].freq(pitch_hz.get() * float(i + 1));
  }

  void onSound(AudioIOData& io) override {
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
  }

  // Convert mouse pixel coords to the same world space we draw into.
  // Camera is nav().pos(0,0,4) with default fov: visible world y span ~[-1, 1]
  // by [-1.5, 1.5] depending on aspect. We use a tuned [-1.5, 1.5] x [-0.9, 0.9].
  void mouseToWorld(const Mouse& m, float& wx, float& wy) const {
    const float w = (float)width();
    const float h = (float)height();
    const float u = (w > 0.f) ? (float)m.x() / w : 0.f;
    const float v = (h > 0.f) ? (float)m.y() / h : 0.f;
    wx = -1.5f + u * 3.0f;
    wy =  0.9f - v * 1.8f;     // flip y so up is positive
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

    Mesh bars; bars.primitive(Mesh::TRIANGLES);
    const float barW = (BAR_X1 - BAR_X0) / float(NUM_PARTIALS);
    for (int i = 0; i < NUM_PARTIALS; ++i) {
      float a = ampsSnapshot[i];
      if (a < 0.f) a = 0.f; else if (a > 1.f) a = 1.f;
      const float x0 = BAR_X0 + float(i) * barW + barW * 0.08f;
      const float x1 = BAR_X0 + float(i + 1) * barW - barW * 0.08f;
      const float y0 = BAR_Y0;
      const float y1 = BAR_Y0 + a * (BAR_Y1 - BAR_Y0);
      float cr, cg, cb;
      partialColor(i, cr, cg, cb);
      emitRect(bars, x0, y0, x1, y1, cr, cg, cb);
    }
    g.draw(bars);

    // Wave panel.
    const float waveMidY = WAV_Y0 + 0.5f * (WAV_Y1 - WAV_Y0);
    Mesh wgrid; wgrid.primitive(Mesh::LINES);
    auto whline = [&](float y) {
      wgrid.vertex(WAV_X0, y, 0); wgrid.color(0.18f, 0.20f, 0.24f);
      wgrid.vertex(WAV_X1, y, 0); wgrid.color(0.18f, 0.20f, 0.24f);
    };
    whline(WAV_Y0); whline(WAV_Y1); whline(waveMidY);
    g.draw(wgrid);

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

    gui.draw(g);
  }
};

ALLOLIB_WEB_MAIN(AdditiveSculptor)
`,
  },
  {
    id: 'mat-granul-stretch',
    title: 'Granulation Time-Stretcher',
    description:
      'Time-stretches a bundled CC0 audio loop by triggering up to 64 overlapping Hann-windowed grains read from a slowly-advancing source position. The stretch factor controls how slowly readPos creeps through the source while each grain plays back at an independent pitch (in semitones), so pitch and time are decoupled. Top panel: full source waveform envelope with a red box highlighting the current read region (jittered by position-jitter). Middle: a real-time playhead cursor that advances at unstretched-source speed since the last retrigger — visualizes how much faster or slower perceived playback is vs. the source. Bottom: 32 most-recently-spawned grains as dots in (source-position × pitch-offset) space. Future work: skip jitter near detected onsets to preserve transients.',
    category: 'mat-signal',
    subcategory: 'delay',
    code: `/**
 * Granulation Time-Stretcher — MAT200B Phase 2 (granular DSP)
 *
 * 64 overlapping grains read from a bundled loop. readPos advances
 * by (srcSR / hostSR) / stretch per output sample; each grain plays
 * back at its own pitch ratio so pitch and time decouple.
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

  ParameterMenu source         {"source",          ""};
  Parameter     stretch        {"stretch",         "",  1.0f,  0.25f, 4.0f};
  Parameter     pitch_semitones{"pitch_semitones", "",  0.0f, -12.0f, 12.0f};
  Parameter     grain_ms       {"grain_ms",        "", 80.0f,  30.0f, 200.0f};
  Parameter     density_hz     {"density_hz",      "", 20.0f,   5.0f, 40.0f};
  Parameter     jitter         {"jitter",          "",  0.005f, 0.0f, 0.05f};
  Parameter     amp            {"amp",             "",  0.6f,   0.0f, 1.0f};
  Trigger       retrigger      {"retrigger",       ""};

  struct Grain {
    bool   active = false;
    double srcPos = 0.0;
    double rate   = 1.0;
    int    age    = 0;
    int    dur    = 1;
  };
  std::array<Grain, kMaxGrains> grains{};
  double readPos = 0.0;
  unsigned int rngState = 0xC0FFEEu;

  std::atomic<float>     readPosNormA{0.0f};
  std::atomic<long long> outputSamplesA{0};
  std::atomic<int>       grainHeadA{0};

  struct RecentGrain { float srcNorm; float pitchOffset; };
  std::array<RecentGrain, kRecentGrains> recent{};

  double wallSeconds = 0.0;
  double retriggerWall = 0.0;
  std::vector<float> envMin, envMax;
  int envSourceIdx = -1;
  float hostSR = 48000.0f;

  WebSamplePlayer* current() {
    const int s = (int)source.get();
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
    for (auto& r : recent) { r.srcNorm = -1.0f; r.pitchOffset = 0.0f; }

    source.setElements({"drums", "pad", "mixed"});
    source.set(0);

    gui << source << stretch << pitch_semitones << grain_ms
        << density_hz << jitter << amp << retrigger;

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

  void buildEnvelope(WebSamplePlayer* sp) {
    envMin.assign(kEnvelopeBins, 0.0f);
    envMax.assign(kEnvelopeBins, 0.0f);
    if (!sp || !sp->ready()) return;
    const int frames = sp->frames();
    if (frames <= 0) return;
    const int chunk = std::max(1, frames / kEnvelopeBins);
    for (int b = 0; b < kEnvelopeBins; ++b) {
      const int s0 = (int)((long long)b * frames / kEnvelopeBins);
      const int s1 = std::min(frames, s0 + chunk);
      float lo = 1.0f, hi = -1.0f;
      for (int i = s0; i < s1; ++i) {
        const float v = sp->readInterp(0, (float)i);
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      envMin[b] = lo;
      envMax[b] = hi;
    }
  }

  void onSound(AudioIOData& io) override {
    hostSR = (float)io.framesPerSecond();
    WebSamplePlayer* sp = current();
    if (!sp || !sp->ready()) {
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
    int recentHead = grainHeadA.load(std::memory_order_relaxed);
    long long outCounter = outputSamplesA.load(std::memory_order_relaxed);

    while (io()) {
      if (frand() < spawnProb) {
        for (int gi = 0; gi < kMaxGrains; ++gi) {
          if (!grains[gi].active) {
            const float jit = (frand() * 2.0f - 1.0f) * jitterFrames;
            double startFrame = readPos + jit;
            while (startFrame < 0)         startFrame += srcFrames;
            while (startFrame >= srcFrames) startFrame -= srcFrames;
            grains[gi].active = true;
            grains[gi].srcPos = startFrame;
            grains[gi].rate   = pitchRate;
            grains[gi].age    = 0;
            grains[gi].dur    = std::max(2, (int)grainDurSamps);
            recent[recentHead].srcNorm     = (float)(startFrame / (double)srcFrames);
            recent[recentHead].pitchOffset = pitch_semitones.get() / 12.0f;
            recentHead = (recentHead + 1) % kRecentGrains;
            break;
          }
        }
      }

      float out = 0.0f;
      for (int gi = 0; gi < kMaxGrains; ++gi) {
        Grain& g = grains[gi];
        if (!g.active) continue;
        const float t = (float)g.age / (float)g.dur;
        const float env = 0.5f * (1.0f - std::cos(2.0f * (float)M_PI * t));
        double sp_pos = g.srcPos;
        while (sp_pos < 0)         sp_pos += srcFrames;
        while (sp_pos >= srcFrames) sp_pos -= srcFrames;
        out += sp->readInterp(0, (float)sp_pos) * env;
        g.srcPos += g.rate;
        if (++g.age >= g.dur) g.active = false;
      }

      const float y = out * ampVal * densNorm;
      io.out(0) = y;
      io.out(1) = y;

      readPos += readAdv;
      while (readPos < 0)          readPos += srcFrames;
      while (readPos >= srcFrames)  readPos -= srcFrames;
      ++outCounter;
    }

    readPosNormA.store((float)(readPos / (double)srcFrames), std::memory_order_relaxed);
    outputSamplesA.store(outCounter, std::memory_order_relaxed);
    grainHeadA.store(recentHead, std::memory_order_relaxed);
  }

  void onAnimate(double dt) override {
    wallSeconds += dt;
    const int sIdx = (int)source.get();
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

    // World-coord layout: x [-1.4, 1.4], y [-1, 1].
    constexpr float xL = -1.4f, xR = 1.4f;
    constexpr float topY0 = 0.20f,  topY1 = 0.90f;
    constexpr float midY0 = 0.05f,  midY1 = 0.15f;
    constexpr float botY0 = -0.85f, botY1 = -0.05f;

    Mesh panels; panels.primitive(Mesh::TRIANGLES);
    emitRect(panels, xL, topY0, xR - xL, topY1 - topY0, 0.10f, 0.10f, 0.13f);
    emitRect(panels, xL, midY0, xR - xL, midY1 - midY0, 0.08f, 0.08f, 0.10f);
    emitRect(panels, xL, botY0, xR - xL, botY1 - botY0, 0.10f, 0.10f, 0.13f);
    g.draw(panels);

    // Top: source envelope (LINES bars).
    if ((int)envMin.size() == kEnvelopeBins) {
      const float panelW  = xR - xL;
      const float midLine = 0.5f * (topY0 + topY1);
      const float halfH   = 0.45f * (topY1 - topY0);
      Mesh wave; wave.primitive(Mesh::LINES);
      for (int i = 0; i < kEnvelopeBins; ++i) {
        const float x = xL + (i / (float)(kEnvelopeBins - 1)) * panelW;
        wave.vertex(x, midLine + envMin[i] * halfH, 0);
        wave.color(0.55f, 0.85f, 1.0f);
        wave.vertex(x, midLine + envMax[i] * halfH, 0);
        wave.color(0.55f, 0.85f, 1.0f);
      }
      g.draw(wave);

      const float rp = readPosNormA.load(std::memory_order_relaxed);
      WebSamplePlayer* sp = current();
      float jitNorm = 0.0f;
      if (sp && sp->ready() && sp->frames() > 0) {
        jitNorm = (jitter.get() * sp->sampleRate()) / (float)sp->frames();
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

    // Middle: real-time playhead.
    {
      const float panelW = xR - xL;
      const double elapsed = wallSeconds - retriggerWall;
      WebSamplePlayer* sp = current();
      double srcSec = 1.0;
      if (sp && sp->ready() && sp->sampleRate() > 0.f)
        srcSec = (double)sp->frames() / (double)sp->sampleRate();
      const double rtNorm = std::fmod(elapsed / std::max(0.001, srcSec), 1.0);
      const float cx = xL + (float)rtNorm * panelW;
      Mesh cursor; cursor.primitive(Mesh::TRIANGLES);
      emitRect(cursor, cx - 0.012f, midY0 + 0.005f, 0.024f, midY1 - midY0 - 0.01f,
               0.95f, 0.95f, 0.40f);
      g.draw(cursor);
      Mesh ax; ax.primitive(Mesh::LINES);
      const float cy = 0.5f * (midY0 + midY1);
      ax.vertex(xL, cy, 0); ax.color(0.40f, 0.40f, 0.45f);
      ax.vertex(xR, cy, 0); ax.color(0.40f, 0.40f, 0.45f);
      g.draw(ax);
    }

    // Bottom: recent-grain scatter in (sourcePos x pitchOffset).
    {
      const float panelW  = xR - xL;
      const float midLine = 0.5f * (botY0 + botY1);
      const float halfH   = 0.45f * (botY1 - botY0);
      Mesh axis; axis.primitive(Mesh::LINES);
      axis.vertex(xL, midLine, 0); axis.color(0.30f, 0.30f, 0.35f);
      axis.vertex(xR, midLine, 0); axis.color(0.30f, 0.30f, 0.35f);
      g.draw(axis);

      Mesh dots; dots.primitive(Mesh::TRIANGLES);
      for (int i = 0; i < kRecentGrains; ++i) {
        const RecentGrain& r = recent[i];
        if (r.srcNorm < 0) continue;
        const float x  = xL + r.srcNorm * panelW;
        const float po = std::max(-1.0f, std::min(1.0f, r.pitchOffset));
        const float y  = midLine + po * halfH;
        const float age = (float)((i + 1) % kRecentGrains) / (float)kRecentGrains;
        const float a  = 0.4f + 0.6f * age;
        const float cr = 0.40f * a, cg = 1.0f * a, cb = 0.70f * a;
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
      'Extracts four per-block audio features from a bundled CC0 loop — RMS amplitude, spectral centroid, zero-crossing rate, and spectral flatness — then routes any feature to any visual channel of a glyph ensemble. Pick which feature drives size, hue, vertical position, and rotation through ParameterMenu controls; a feature-readout bar at the bottom shows the live values of all four features. An inline 64-point Hann-windowed DFT computes spectral statistics; atomic feature buffers hand data from audio thread to graphics thread without locks.',
    category: 'mat-visualmusic',
    subcategory: 'mappers',
    code: `/**
 * Synesthetic Mapper — MAT200B Phase 2 (audio→visual feature routing)
 *
 * RMS / centroid / ZCR / flatness extracted in onSound; glyph row in
 * onDraw rendered with user-selected feature → channel mapping.
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
  ParameterMenu size_src   {"size_src",      ""};
  ParameterMenu hue_src    {"hue_src",       ""};
  ParameterMenu posY_src   {"posY_src",      ""};
  ParameterMenu rot_src    {"rotation_src",  ""};
  ParameterInt  num_glyphs {"num_glyphs",    "",  8, 1, 16};
  Parameter     amp        {"amp",           "",  0.7f, 0.0f, 1.0f};
  Trigger       retrigger  {"retrigger",     ""};

  double playhead = 0.0;

  static constexpr int kDFTSize = 64;
  std::array<float, kDFTSize> dftBuf{};
  int dftWritePos = 0;
  int samplesSinceDFT = 0;

  float lastSample = 0.0f;
  float rmsAccum = 0.0f;
  float zcrSm = 0.f, centSm = 0.f, flatSm = 0.f;

  std::atomic<float> fRMS{0.0f}, fCentroid{0.0f}, fZCR{0.0f}, fFlatness{0.0f};
  float dispRMS = 0.0f, dispCent = 0.0f, dispZCR = 0.0f, dispFlat = 0.0f;

  std::array<float, 16> glyphPhase{};

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

    gui << source << size_src << hue_src << posY_src << rot_src
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
    if (!current || !current->ready()) {
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

    while (io()) {
      const float raw = current->readInterp(0, (float)playhead);
      playhead += rate;
      if (playhead >= nFrames) playhead -= nFrames;
      const float s = raw * gain;
      io.out(0) = s; io.out(1) = s;

      blockRMS += raw * raw;
      if ((raw >= 0.f && prev < 0.f) || (raw < 0.f && prev >= 0.f)) ++blockZC;
      prev = raw;
      dftBuf[dftWritePos] = raw;
      dftWritePos = (dftWritePos + 1) % kDFTSize;
      ++samplesSinceDFT;
    }
    lastSample = prev;

    const float instRMS = std::sqrt(blockRMS / (float)std::max(1, blockLen));
    rmsAccum = 0.9f * rmsAccum + 0.1f * instRMS;
    fRMS.store(std::min(1.0f, rmsAccum * 3.0f));

    const float zcrNorm = (float)blockZC / (float)std::max(1, blockLen);
    zcrSm = 0.85f * zcrSm + 0.15f * std::min(1.0f, zcrNorm * 8.0f);
    fZCR.store(zcrSm);

    if (samplesSinceDFT >= kDFTSize) {
      samplesSinceDFT = 0;
      const int N = kDFTSize;
      std::array<float, kDFTSize> win{};
      for (int n = 0; n < N; ++n) {
        const int idx = (dftWritePos + n) % N;
        const float w = 0.5f - 0.5f * std::cos(2.f * (float)M_PI * (float)n / (float)(N - 1));
        win[n] = dftBuf[idx] * w;
      }
      const int bins = N / 2;
      float sumMag = 0.f, sumKMag = 0.f, logSum = 0.f, arithSum = 0.f;
      for (int k = 0; k < bins; ++k) {
        float re = 0.f, im = 0.f;
        const float ang = -2.f * (float)M_PI * (float)k / (float)N;
        for (int n = 0; n < N; ++n) {
          re += win[n] * std::cos(ang * n);
          im += win[n] * std::sin(ang * n);
        }
        const float mag = std::sqrt(re * re + im * im);
        sumMag  += mag;
        sumKMag += (float)k * mag;
        logSum  += std::log(mag + 1e-9f);
        arithSum += mag;
      }
      const float centroidBin  = (sumMag > 1e-6f) ? (sumKMag / sumMag) : 0.f;
      const float centroidNorm = centroidBin / (float)bins;
      centSm = 0.8f * centSm + 0.2f * centroidNorm;
      fCentroid.store(std::min(1.0f, centSm * 1.5f));
      const float geo = std::exp(logSum / (float)bins);
      const float ari = arithSum / (float)bins;
      const float flat = (ari > 1e-6f) ? (geo / ari) : 0.f;
      flatSm = 0.85f * flatSm + 0.15f * flat;
      fFlatness.store(std::min(1.0f, flatSm));
    }
  }

  float feature(int idx) const {
    switch (idx) {
      case 0: return fRMS.load();
      case 1: return fCentroid.load();
      case 2: return fZCR.load();
      case 3: return fFlatness.load();
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
      const float a0 = 2.f * (float)M_PI * i       / segs;
      const float a1 = 2.f * (float)M_PI * (i + 1) / segs;
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
    dispRMS  = 0.85f * dispRMS  + 0.15f * fRMS.load();
    dispCent = 0.85f * dispCent + 0.15f * fCentroid.load();
    dispZCR  = 0.85f * dispZCR  + 0.15f * fZCR.load();
    dispFlat = 0.85f * dispFlat + 0.15f * fFlatness.load();

    const float rotF = feature(rot_src.get());
    const int n = num_glyphs.get();
    for (int i = 0; i < n && i < (int)glyphPhase.size(); ++i) {
      const float perGlyphMod = 0.5f + (float)i / (float)std::max(1, n);
      glyphPhase[i] += (float)dt * (0.3f + rotF * 4.0f) * perGlyphMod;
      if (glyphPhase[i] > 2.f * (float)M_PI) glyphPhase[i] -= 2.f * (float)M_PI;
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

    Mesh discs; discs.primitive(Mesh::TRIANGLES);
    Mesh ticks; ticks.primitive(Mesh::LINES);

    const float baseRadius = 0.10f;
    for (int i = 0; i < n; ++i) {
      const float t = (n == 1) ? 0.5f : (float)i / (float)(n - 1);
      const float x = -1.3f + t * 2.6f;
      const float idxMod = 0.6f + 0.4f * std::sin(t * 2.f * (float)M_PI + 1.7f);
      const float y = (posYF - 0.5f) * 1.0f * idxMod;
      const float radius = baseRadius * (0.5f + 1.5f * sizeF * idxMod);
      const float hue = std::fmod(hueF + t * 0.2f, 1.0f);
      float r, gg, b;
      hsv2rgb(hue, 0.85f, 0.95f, r, gg, b);
      emitDisc(discs, x, y, radius, r, gg, b, 24);

      const float ang = glyphPhase[i];
      const float tickLen = radius * 1.4f;
      ticks.vertex(x, y, 0.f); ticks.color(1.f, 1.f, 1.f);
      ticks.vertex(x + std::cos(ang) * tickLen, y + std::sin(ang) * tickLen, 0.f);
      ticks.color(1.f, 1.f, 1.f);
    }
    g.draw(discs);
    g.draw(ticks);

    Mesh bars; bars.primitive(Mesh::TRIANGLES);
    emitRect(bars, -1.4f, -1.0f, 2.8f, 0.18f, 0.10f, 0.10f, 0.14f);

    const float vals[4] = { dispRMS, dispCent, dispZCR, dispFlat };
    const float cols[4][3] = {
      {0.95f, 0.30f, 0.30f},
      {0.30f, 0.90f, 0.45f},
      {0.35f, 0.55f, 0.95f},
      {0.95f, 0.85f, 0.30f}
    };
    const float barW = 0.55f, gap = 0.10f;
    const float startX = -((barW * 4.0f + gap * 3.0f) * 0.5f);
    const float baseY  = -0.98f;
    const float maxH   =  0.14f;
    for (int i = 0; i < 4; ++i) {
      float v = std::min(1.0f, std::max(0.0f, vals[i]));
      const float x = startX + i * (barW + gap);
      emitRect(bars, x, baseY, barW, maxH, 0.18f, 0.18f, 0.22f);
      emitRect(bars, x, baseY, barW * v, maxH, cols[i][0], cols[i][1], cols[i][2]);
    }
    g.draw(bars);

    Mesh frames; frames.primitive(Mesh::LINES);
    const int routed[4] = { size_src.get(), hue_src.get(), posY_src.get(), rot_src.get() };
    const float chCols[4][3] = {
      {1.00f, 1.00f, 1.00f},
      {0.20f, 0.90f, 0.95f},
      {0.95f, 0.35f, 0.85f},
      {0.95f, 0.55f, 0.20f}
    };
    for (int ch = 0; ch < 4; ++ch) {
      const int featIdx = routed[ch];
      if (featIdx < 0 || featIdx > 3) continue;
      const float x = startX + featIdx * (barW + gap);
      const float ox = 0.012f * (ch + 1);
      const float oy = 0.012f * (ch + 1);
      const float r = chCols[ch][0], gg = chCols[ch][1], b = chCols[ch][2];
      frames.vertex(x - ox, baseY - oy, 0); frames.color(r, gg, b);
      frames.vertex(x + barW + ox, baseY - oy, 0); frames.color(r, gg, b);
      frames.vertex(x + barW + ox, baseY - oy, 0); frames.color(r, gg, b);
      frames.vertex(x + barW + ox, baseY + maxH + oy, 0); frames.color(r, gg, b);
      frames.vertex(x + barW + ox, baseY + maxH + oy, 0); frames.color(r, gg, b);
      frames.vertex(x - ox, baseY + maxH + oy, 0); frames.color(r, gg, b);
      frames.vertex(x - ox, baseY + maxH + oy, 0); frames.color(r, gg, b);
      frames.vertex(x - ox, baseY - oy, 0); frames.color(r, gg, b);
    }
    g.draw(frames);

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
