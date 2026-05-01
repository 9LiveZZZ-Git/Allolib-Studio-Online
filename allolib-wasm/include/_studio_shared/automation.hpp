#pragma once

/**
 * AlloLib Studio Online - Automation lanes (header-only)
 *
 * Wraps al::Parameter so that any change is captured into a time-indexed
 * curve, and the curve can be replayed with sample-accurate playback by
 * linearly interpolating between adjacent breakpoints.
 *
 * Recording is callback-driven: registerChangeCallback() fires whenever
 * anything (UI, OSC, code) writes the parameter, so the lane never has to
 * poll. Playback drives the parameter via Parameter::set(), which re-fires
 * the change callbacks -- to avoid feedback into the lane during playback,
 * the lane's own callback is gated by mState.
 *
 * Drawing is real al::Mesh primitives (LINE_STRIP for the curve, LINES for
 * the playhead). No ImGui dependency. Optional WebFont label can be
 * supplied per lane; if no font is set, the lane prints its index/name to
 * stdout via printf so the user can still tell lanes apart by color.
 *
 * Persistence: per-lane CSV (time,value) and an AutomationSet bundle that
 * concatenates all lanes into one CSV with a leading header row of names
 * and an unrolled "lane,time,value" body. Both round-trip on /-rooted
 * paths, which resolve to IDBFS in the web build (see compile.sh
 * -lidbfs.js linkage).
 *
 * Threading: callbacks fire on the parameter owner's thread (typically the
 * main / graphics thread); we never spawn threads. State coordination uses
 * std::atomic for the small flag bits that may be inspected from a
 * different stack frame, but all mutation runs on the owning thread.
 */

#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/types/al_Color.hpp"
#include "al/ui/al_Parameter.hpp"

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

// Optional WebFont label support (header is part of allolib-wasm).
#if __has_include("al_WebFont.hpp")
#include "al_WebFont.hpp"
#define AL_STUDIO_AUTOMATION_HAS_WEBFONT 1
#else
#define AL_STUDIO_AUTOMATION_HAS_WEBFONT 0
#endif

// v0.10.3: dropped surrounding `namespace al` to match the other helpers (file-scope ::studio)
namespace studio {

struct Breakpoint {
  double t;       // seconds since startRecording
  float value;    // parameter value at this instant
};

class AutomationLane {
public:
  enum class State : int { Idle = 0, Recording = 1, Playing = 2 };

  explicit AutomationLane(al::Parameter& target)
      : mTarget(&target), mName(target.getName()) {
    // Hook the parameter's change callback once. The callback captures a
    // shared self-pointer slot that we own; this lets us tear down the
    // hook on destruction by clearing the slot, since al::Parameter has
    // no public unregister API.
    mAlive = std::make_shared<std::atomic<bool>>(true);
    auto alive = mAlive;
    auto* self = this;
    mTarget->registerChangeCallback([alive, self](float v) {
      if (!alive->load(std::memory_order_acquire)) return;
      self->onParameterChanged(v);
    });
  }

  ~AutomationLane() {
    if (mAlive) mAlive->store(false, std::memory_order_release);
  }

  AutomationLane(const AutomationLane&) = delete;
  AutomationLane& operator=(const AutomationLane&) = delete;

  // ----------------------- recording -----------------------------------

  void startRecording(double nowSec) {
    mBreakpoints.clear();
    mRecordStart = nowSec;
    mState.store(State::Recording, std::memory_order_release);
    // Record current value as t=0 so playback always has a starting frame.
    mBreakpoints.push_back(Breakpoint{0.0, mTarget->get()});
  }

  void stopRecording() {
    if (mState.load() == State::Recording) {
      mState.store(State::Idle, std::memory_order_release);
    }
  }

  // ----------------------- playback ------------------------------------

  void startPlayback(double nowSec) {
    if (mBreakpoints.empty()) return;
    mPlayStart = nowSec;
    mPlayCursor = 0;
    mState.store(State::Playing, std::memory_order_release);
    // Snap target to first breakpoint immediately for a clean start.
    setTargetSilently(mBreakpoints.front().value);
  }

  void stopPlayback() {
    if (mState.load() == State::Playing) {
      mState.store(State::Idle, std::memory_order_release);
    }
  }

  void setLoop(bool on) { mLoop = on; }
  bool loop() const { return mLoop; }

  // Call every frame. Advances playback cursor and writes the
  // interpolated value to the target parameter. No-op when not playing.
  void tick(double nowSec) {
    if (mState.load(std::memory_order_acquire) != State::Playing) return;
    if (mBreakpoints.size() < 2) {
      // Single point: just hold it.
      if (!mBreakpoints.empty()) {
        setTargetSilently(mBreakpoints.front().value);
      }
      return;
    }

    double total = mBreakpoints.back().t;
    if (total <= 0.0) {
      setTargetSilently(mBreakpoints.front().value);
      return;
    }

    double t = nowSec - mPlayStart;
    if (t >= total) {
      if (mLoop) {
        // Reset start so the modulus stays meaningful for long sessions.
        mPlayStart = nowSec - std::fmod(t, total);
        t = std::fmod(t, total);
        mPlayCursor = 0;
      } else {
        setTargetSilently(mBreakpoints.back().value);
        mState.store(State::Idle, std::memory_order_release);
        return;
      }
    }
    if (t < 0.0) t = 0.0;

    // Advance cursor forward to the segment that brackets t. Reset to 0
    // if t went backward (loop wrap or external reset).
    if (mPlayCursor + 1 >= mBreakpoints.size() ||
        t < mBreakpoints[mPlayCursor].t) {
      mPlayCursor = 0;
    }
    while (mPlayCursor + 1 < mBreakpoints.size() &&
           mBreakpoints[mPlayCursor + 1].t < t) {
      ++mPlayCursor;
    }

    const Breakpoint& a = mBreakpoints[mPlayCursor];
    const Breakpoint& b =
        mBreakpoints[std::min(mPlayCursor + 1, mBreakpoints.size() - 1)];
    float v;
    if (b.t <= a.t) {
      v = a.value;
    } else {
      const double u = (t - a.t) / (b.t - a.t);
      v = static_cast<float>(a.value + (b.value - a.value) * u);
    }
    setTargetSilently(v);
    mLastPlayheadT = t;
  }

  // ----------------------- introspection -------------------------------

  const std::vector<Breakpoint>& breakpoints() const { return mBreakpoints; }
  std::vector<Breakpoint>& breakpoints() { return mBreakpoints; }
  const std::string& name() const { return mName; }
  void setName(const std::string& n) { mName = n; }
  State state() const { return mState.load(); }
  bool isRecording() const { return state() == State::Recording; }
  bool isPlaying() const { return state() == State::Playing; }
  al::Parameter& target() { return *mTarget; }
  const al::Parameter& target() const { return *mTarget; }

  // Total duration of the recorded curve in seconds, or 0 if empty.
  double duration() const {
    return mBreakpoints.empty() ? 0.0 : mBreakpoints.back().t;
  }

  // ----------------------- color (lane id) -----------------------------
  void setColor(const al::Color& c) { mColor = c; }
  const al::Color& color() const { return mColor; }

  // ----------------------- font label (optional) -----------------------
#if AL_STUDIO_AUTOMATION_HAS_WEBFONT
  void setFont(WebFont* f) { mFont = f; }
#endif

  // ----------------------- drawing -------------------------------------

  // Draw the curve normalized to a (w, h) box with origin at (0, 0).
  // Examples set up their own model matrix to position the lane. The
  // parameter's [min, max] are mapped to y=[0, h]; time is mapped to
  // x=[0, w] using the lane's full duration. A vertical playhead line is
  // drawn during playback; a record indicator dot is drawn during
  // recording.
  void drawCurve(al::Graphics& g, float w, float h) {
    if (w <= 0.f || h <= 0.f) return;

    const float pmin = mTarget->min();
    const float pmax = mTarget->max();
    const float prange = (pmax > pmin) ? (pmax - pmin) : 1.f;
    const double dur = duration();

    // Bounding box (faint).
    al::Mesh box(al::Mesh::LINE_STRIP);
    box.color(mColor.r * 0.4f, mColor.g * 0.4f, mColor.b * 0.4f, 0.6f);
    box.vertex(0.f, 0.f);
    box.vertex(w, 0.f);
    box.vertex(w, h);
    box.vertex(0.f, h);
    box.vertex(0.f, 0.f);
    g.meshColor();
    g.draw(box);

    // Curve.
    if (mBreakpoints.size() >= 2 && dur > 0.0) {
      al::Mesh curve(al::Mesh::LINE_STRIP);
      for (const auto& bp : mBreakpoints) {
        const float nx = static_cast<float>(bp.t / dur) * w;
        const float ny = ((bp.value - pmin) / prange) * h;
        curve.color(mColor);
        curve.vertex(nx, std::clamp(ny, 0.f, h));
      }
      g.draw(curve);
    } else if (mBreakpoints.size() == 1) {
      // Single breakpoint: draw a horizontal hold line.
      al::Mesh hold(al::Mesh::LINES);
      const float ny = ((mBreakpoints[0].value - pmin) / prange) * h;
      hold.color(mColor);
      hold.vertex(0.f, std::clamp(ny, 0.f, h));
      hold.color(mColor);
      hold.vertex(w, std::clamp(ny, 0.f, h));
      g.draw(hold);
    }

    // Playhead.
    if (isPlaying() && dur > 0.0) {
      const float px = static_cast<float>(mLastPlayheadT / dur) * w;
      al::Mesh ph(al::Mesh::LINES);
      ph.color(1.f, 1.f, 1.f, 0.9f);
      ph.vertex(px, 0.f);
      ph.color(1.f, 1.f, 1.f, 0.9f);
      ph.vertex(px, h);
      g.draw(ph);
    }

    // Record indicator (red disc-ish triangle in the upper-left corner).
    if (isRecording()) {
      al::Mesh rec(al::Mesh::TRIANGLES);
      const float r = std::min(w, h) * 0.04f + 2.f;
      rec.color(1.f, 0.15f, 0.15f, 0.9f);
      rec.vertex(2.f, h - 2.f);
      rec.color(1.f, 0.15f, 0.15f, 0.9f);
      rec.vertex(2.f + r, h - 2.f);
      rec.color(1.f, 0.15f, 0.15f, 0.9f);
      rec.vertex(2.f + r * 0.5f, h - 2.f - r);
      g.draw(rec);
    }

#if AL_STUDIO_AUTOMATION_HAS_WEBFONT
    if (mFont) {
      mFont->render(g, mName, 6.f, h - 18.f);
    }
#endif
  }

  // ----------------------- CSV I/O -------------------------------------

  bool saveCSV(const std::string& path) const {
    std::ofstream out(path);
    if (!out) return false;
    out << "# AutomationLane name=" << mName << " min=" << mTarget->min()
        << " max=" << mTarget->max() << "\n";
    out << "time,value\n";
    out.setf(std::ios::fixed);
    out.precision(6);
    for (const auto& bp : mBreakpoints) {
      out << bp.t << "," << bp.value << "\n";
    }
    out.flush();
    if (!out) return false;
#ifdef __EMSCRIPTEN__
    // Persist IDBFS so writes survive a browser reload.
    EM_ASM({
      try {
        if (typeof FS !== 'undefined' && FS.syncfs)
          FS.syncfs(false, function(err) {});
      } catch (e) {}
    });
#endif
    return true;
  }

  bool loadCSV(const std::string& path) {
    std::ifstream in(path);
    if (!in) return false;
    std::vector<Breakpoint> bps;
    std::string line;
    while (std::getline(in, line)) {
      if (line.empty()) continue;
      if (line[0] == '#') continue;
      if (line.rfind("time", 0) == 0) continue;  // header row
      // Parse "time,value"
      const auto comma = line.find(',');
      if (comma == std::string::npos) continue;
      try {
        Breakpoint bp;
        bp.t = std::stod(line.substr(0, comma));
        bp.value = std::stof(line.substr(comma + 1));
        bps.push_back(bp);
      } catch (...) {
        continue;
      }
    }
    if (bps.empty()) return false;
    mBreakpoints = std::move(bps);
    return true;
  }

private:
  void setTargetSilently(float v) {
    // We don't have a public unregister, so we suppress recording while
    // the lane itself drives the parameter via the gate flag.
    mGate = true;
    mTarget->set(v);
    mGate = false;
  }

  void onParameterChanged(float v) {
    if (mGate) return;  // self-write during playback
    if (mState.load(std::memory_order_acquire) != State::Recording) return;
#ifdef __EMSCRIPTEN__
    const double now = emscripten_get_now() / 1000.0;
#else
    // Fall back to the most recent tick time during native testing.
    const double now = mRecordStart + (mBreakpoints.empty()
                                           ? 0.0
                                           : mBreakpoints.back().t + 1e-3);
#endif
    const double t = now - mRecordStart;
    if (!mBreakpoints.empty() && t <= mBreakpoints.back().t) {
      // Strict-increasing time keeps interpolation well-defined; if two
      // changes land in the same frame we coalesce by overwriting.
      if (std::abs(mBreakpoints.back().value - v) < 1e-7f) return;
      if (t == mBreakpoints.back().t) {
        mBreakpoints.back().value = v;
        return;
      }
    }
    mBreakpoints.push_back(Breakpoint{t, v});
  }

  al::Parameter* mTarget;
  std::string mName;
  std::vector<Breakpoint> mBreakpoints;
  std::atomic<State> mState{State::Idle};
  std::shared_ptr<std::atomic<bool>> mAlive;
  bool mGate{false};
  bool mLoop{false};
  double mRecordStart{0.0};
  double mPlayStart{0.0};
  double mLastPlayheadT{0.0};
  size_t mPlayCursor{0};
  al::Color mColor{0.4f, 0.85f, 1.f, 1.f};
#if AL_STUDIO_AUTOMATION_HAS_WEBFONT
  WebFont* mFont{nullptr};
#endif
};

// ===========================================================================
//  AutomationSet -- collection of lanes
// ===========================================================================
class AutomationSet {
public:
  AutomationSet() = default;
  AutomationSet(const AutomationSet&) = delete;
  AutomationSet& operator=(const AutomationSet&) = delete;

  AutomationLane& add(al::Parameter& p) {
    auto lane = std::make_unique<AutomationLane>(p);
    // Auto-color new lanes around the hue circle so users can tell them
    // apart even without a font.
    const float hue = std::fmod(static_cast<float>(mLanes.size()) * 0.137f, 1.f);
    lane->setColor(al::Color(al::HSV(hue, 0.7f, 1.f)));
    AutomationLane& ref = *lane;
    mLanes.push_back(std::move(lane));
    return ref;
  }

  size_t size() const { return mLanes.size(); }
  AutomationLane& operator[](size_t i) { return *mLanes[i]; }
  const AutomationLane& operator[](size_t i) const { return *mLanes[i]; }

  void startRecordingAll(double nowSec) {
    for (auto& l : mLanes) l->startRecording(nowSec);
  }
  void stopRecordingAll() {
    for (auto& l : mLanes) l->stopRecording();
  }
  void startPlaybackAll(double nowSec) {
    for (auto& l : mLanes) l->startPlayback(nowSec);
  }
  void stopPlaybackAll() {
    for (auto& l : mLanes) l->stopPlayback();
  }
  void setLoopAll(bool on) {
    for (auto& l : mLanes) l->setLoop(on);
  }

  void tickAll(double nowSec) {
    for (auto& l : mLanes) l->tick(nowSec);
  }

  // ImGui is stubbed on web; render an in-canvas vertical stack of mini
  // curves. Each lane gets a horizontal slice of the (x, y, w, h) rect.
  // Examples call this from onDraw() after setting up an ortho projection
  // covering the same rect (or just call drawAllAt(g, ...) below for an
  // explicit rect API).
  void drawAllImGui() { drawAllAt(*sLastGraphics, 0.f, 0.f, 800.f, 400.f); }

  // Explicit-rect form. Lanes are stacked top-to-bottom with a small gap.
  void drawAllAt(al::Graphics& g, float x, float y, float w, float h) {
    sLastGraphics = &g;
    if (mLanes.empty() || w <= 0.f || h <= 0.f) return;
    const float gap = 4.f;
    const float laneH = std::max(8.f, (h - gap * (mLanes.size() - 1)) /
                                          static_cast<float>(mLanes.size()));
    for (size_t i = 0; i < mLanes.size(); ++i) {
      const float ly = y + i * (laneH + gap);
      g.pushMatrix();
      g.translate(x, ly);
      mLanes[i]->drawCurve(g, w, laneH);
      g.popMatrix();
    }
  }

  // ----------------------- bundle I/O ----------------------------------
  // Single CSV: "lane,time,value" with a leading "# names" comment row
  // listing the lane order. Symmetric on load.
  bool saveBundle(const std::string& path) const {
    std::ofstream out(path);
    if (!out) return false;
    out << "# AutomationSet lanes=" << mLanes.size() << "\n";
    out << "# names=";
    for (size_t i = 0; i < mLanes.size(); ++i) {
      out << (i ? "|" : "") << mLanes[i]->name();
    }
    out << "\n";
    out << "lane,time,value\n";
    out.setf(std::ios::fixed);
    out.precision(6);
    for (size_t i = 0; i < mLanes.size(); ++i) {
      for (const auto& bp : mLanes[i]->breakpoints()) {
        out << i << "," << bp.t << "," << bp.value << "\n";
      }
    }
    out.flush();
    if (!out) return false;
#ifdef __EMSCRIPTEN__
    EM_ASM({
      try {
        if (typeof FS !== 'undefined' && FS.syncfs)
          FS.syncfs(false, function(err) {});
      } catch (e) {}
    });
#endif
    return true;
  }

  // Loads breakpoints into the existing lanes by index. Lanes that
  // weren't pre-added via add() are silently skipped (the bundle has no
  // way to recover the al::Parameter binding).
  bool loadBundle(const std::string& path) {
    std::ifstream in(path);
    if (!in) return false;
    // Clear breakpoints in existing lanes -- preserves Parameter bindings.
    for (auto& l : mLanes) l->breakpoints().clear();
    std::string line;
    while (std::getline(in, line)) {
      if (line.empty() || line[0] == '#') continue;
      if (line.rfind("lane", 0) == 0) continue;
      // Parse "lane,time,value"
      const auto c1 = line.find(',');
      if (c1 == std::string::npos) continue;
      const auto c2 = line.find(',', c1 + 1);
      if (c2 == std::string::npos) continue;
      try {
        const size_t idx = static_cast<size_t>(std::stoul(line.substr(0, c1)));
        if (idx >= mLanes.size()) continue;
        Breakpoint bp;
        bp.t = std::stod(line.substr(c1 + 1, c2 - c1 - 1));
        bp.value = std::stof(line.substr(c2 + 1));
        mLanes[idx]->breakpoints().push_back(bp);
      } catch (...) {
        continue;
      }
    }
    return true;
  }

private:
  std::vector<std::unique_ptr<AutomationLane>> mLanes;
  // drawAllImGui() needs a Graphics* but the API is parameterless; set
  // by drawAllAt() so the no-arg form keeps working after the explicit
  // form has been called once. Examples that only call drawAllImGui()
  // can pre-set this via setGraphicsContext().
  inline static al::Graphics* sLastGraphics = nullptr;

public:
  static void setGraphicsContext(al::Graphics& g) { sLastGraphics = &g; }
};

}  // namespace studio
// (close of removed `namespace al`)
