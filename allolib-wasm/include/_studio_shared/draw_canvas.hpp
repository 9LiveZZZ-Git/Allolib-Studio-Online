#pragma once

/**
 * AlloLib Studio Online - Drawable Canvas Helper
 *
 * Header-only mouse-driven drawing surface used by:
 *   painter, drawable wavetable, waveshaper, z-plane, drawn-sound (UPIC),
 *   spectrogram painter, Synchromy, graphic score, virtual diffusion, IR builder.
 *
 * Mouse coordinates arrive in screen pixels (Mouse::x(), Mouse::y()). The
 * canvas takes its bounds as a screen-pixel rect via setBounds(); examples
 * that care about HiDPI should derive that rect from WebApp::fbWidth/fbHeight.
 *
 * Design:
 *   - In-progress stroke held in std::optional<Stroke> mActive.
 *   - Committed strokes live in mStrokes.
 *   - sampleAt / sampleColumn rasterize strokes into a 256x256 grid the first
 *     time they're called after a mutation; cache invalidated on add/clear.
 *
 * No <thread> or pthread dependency. No Phase 1c deps.
 */

#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/io/al_Window.hpp"   // al::Mouse
#include "al/math/al_Vec.hpp"
#include "al/types/al_Color.hpp"

#include <algorithm>
#include <cmath>
#include <map>
#include <optional>
#include <string>
#include <vector>

namespace al {
namespace studio {

struct Stroke {
  std::vector<al::Vec2f> points;
  al::Color color{1.f, 1.f, 1.f, 1.f};
  float thickness{2.f};
  std::map<std::string, float> attrs;  // user-defined (e.g. "noisiness")
};

class DrawCanvas {
public:
  DrawCanvas() = default;

  // -- bounds (screen-pixel rect) ----------------------------------------
  void setBounds(float x, float y, float w, float h) {
    mX = x;
    mY = y;
    mW = (w > 1.f) ? w : 1.f;
    mH = (h > 1.f) ? h : 1.f;
  }

  float x() const { return mX; }
  float y() const { return mY; }
  float width() const { return mW; }
  float height() const { return mH; }

  // -- pen settings (apply to next/active stroke) ------------------------
  void setColor(const al::Color& c) { mPenColor = c; }
  void setThickness(float t) { mPenThickness = (t > 0.f) ? t : 1.f; }

  // -- mouse callbacks ---------------------------------------------------
  void onMouseDown(const al::Mouse& m) {
    if (!hitTest(static_cast<float>(m.x()), static_cast<float>(m.y()))) {
      return;
    }
    Stroke s;
    s.color = mPenColor;
    s.thickness = mPenThickness;
    s.points.push_back(toNormalized(static_cast<float>(m.x()),
                                    static_cast<float>(m.y())));
    mActive = std::move(s);
  }

  void onMouseDrag(const al::Mouse& m) {
    if (!mActive.has_value()) return;
    al::Vec2f p = toNormalized(static_cast<float>(m.x()),
                               static_cast<float>(m.y()));
    // Reject duplicate points to keep the LINE_STRIP clean.
    if (!mActive->points.empty()) {
      const al::Vec2f& last = mActive->points.back();
      const float dx = p.x - last.x;
      const float dy = p.y - last.y;
      if ((dx * dx + dy * dy) < 1e-8f) return;
    }
    mActive->points.push_back(p);
  }

  void onMouseUp(const al::Mouse& /*m*/) {
    if (!mActive.has_value()) return;
    if (mActive->points.size() >= 2) {
      mStrokes.push_back(std::move(*mActive));
      mGridDirty = true;
    }
    mActive.reset();
  }

  // -- mutation ----------------------------------------------------------
  void clear() {
    mStrokes.clear();
    mActive.reset();
    mGridDirty = true;
  }

  // Set an attribute on the in-progress stroke, falling back to the most
  // recently completed stroke if no stroke is active.
  void setStrokeAttr(const std::string& name, float value) {
    if (mActive.has_value()) {
      mActive->attrs[name] = value;
    } else if (!mStrokes.empty()) {
      mStrokes.back().attrs[name] = value;
    }
  }

  // -- rendering ---------------------------------------------------------
  // One LINE_STRIP Mesh per stroke, drawn in normalized [0,1] x [0,1] space.
  // Examples set up their own ortho projection / model matrix to map this
  // into the canvas rect.
  void draw(al::Graphics& g) const {
    for (const auto& s : mStrokes) drawStroke(g, s);
    if (mActive.has_value()) drawStroke(g, *mActive);
  }

  // -- accessors ---------------------------------------------------------
  const std::vector<Stroke>& strokes() const { return mStrokes; }
  bool hasActive() const { return mActive.has_value(); }
  const Stroke* activeStroke() const {
    return mActive.has_value() ? &(*mActive) : nullptr;
  }

  // -- sampling ----------------------------------------------------------
  // Bilinear sample of the rasterized stroke grid at normalized coords.
  // normalized.x in [0,1], y in [0,1] (top-down).
  float sampleAt(al::Vec2f normalized) const {
    ensureGrid();
    const float fx = clamp01(normalized.x) * (kGrid - 1);
    const float fy = clamp01(normalized.y) * (kGrid - 1);
    const int x0 = static_cast<int>(std::floor(fx));
    const int y0 = static_cast<int>(std::floor(fy));
    const int x1 = std::min(x0 + 1, kGrid - 1);
    const int y1 = std::min(y0 + 1, kGrid - 1);
    const float tx = fx - x0;
    const float ty = fy - y0;
    const float a = mGrid[y0 * kGrid + x0];
    const float b = mGrid[y0 * kGrid + x1];
    const float c = mGrid[y1 * kGrid + x0];
    const float d = mGrid[y1 * kGrid + x1];
    return (a * (1 - tx) + b * tx) * (1 - ty) +
           (c * (1 - tx) + d * tx) * ty;
  }

  // Column read: returns kGrid samples (one per row) at column xNorm.
  std::vector<float> sampleColumn(float xNorm) const {
    ensureGrid();
    const int col = std::clamp(
        static_cast<int>(std::round(clamp01(xNorm) * (kGrid - 1))),
        0, kGrid - 1);
    std::vector<float> out(kGrid);
    for (int y = 0; y < kGrid; ++y) out[y] = mGrid[y * kGrid + col];
    return out;
  }

  // Public grid resolution (256x256).
  static constexpr int gridSize() { return kGrid; }

private:
  // -- helpers -----------------------------------------------------------
  bool hitTest(float px, float py) const {
    return px >= mX && px <= mX + mW && py >= mY && py <= mY + mH;
  }

  al::Vec2f toNormalized(float px, float py) const {
    al::Vec2f n;
    n.x = clamp01((px - mX) / mW);
    n.y = clamp01((py - mY) / mH);
    return n;
  }

  static float clamp01(float v) { return std::clamp(v, 0.f, 1.f); }

  void drawStroke(al::Graphics& g, const Stroke& s) const {
    if (s.points.size() < 2) return;
    al::Mesh m{al::Mesh::LINE_STRIP};
    for (const auto& p : s.points) {
      m.vertex(p.x, p.y, 0.f);
      m.color(s.color);
    }
    g.draw(m);
  }

  // Lazy rasterization into a kGrid x kGrid float field. Each stroke
  // contributes thickness-weighted coverage along its segments. Updates
  // are accumulated; resulting field is in [0, ~strokeCount].
  void ensureGrid() const {
    if (!mGridDirty) return;
    mGrid.assign(static_cast<size_t>(kGrid) * kGrid, 0.f);
    for (const auto& s : mStrokes) rasterStroke(s);
    if (mActive.has_value()) rasterStroke(*mActive);
    mGridDirty = false;
  }

  void rasterStroke(const Stroke& s) const {
    const float maxDim = (mW > mH) ? mW : mH;
    // Map pen thickness (screen pixels) to grid cells.
    const float radius = std::max(0.5f, s.thickness * (kGrid / maxDim) * 0.5f);
    const float intensity = s.color.a;  // alpha-weighted contribution
    for (size_t i = 1; i < s.points.size(); ++i) {
      rasterSegment(s.points[i - 1], s.points[i], radius, intensity);
    }
  }

  void rasterSegment(const al::Vec2f& a, const al::Vec2f& b,
                     float radius, float intensity) const {
    // March along the segment in fractional grid steps and stamp a small
    // square brush. Cheap; fine for a 256x256 LUT.
    const float ax = a.x * (kGrid - 1);
    const float ay = a.y * (kGrid - 1);
    const float bx = b.x * (kGrid - 1);
    const float by = b.y * (kGrid - 1);
    const float dx = bx - ax;
    const float dy = by - ay;
    const float len = std::sqrt(dx * dx + dy * dy);
    const int steps = std::max(1, static_cast<int>(std::ceil(len)));
    const int r = std::max(1, static_cast<int>(std::ceil(radius)));
    for (int s = 0; s <= steps; ++s) {
      const float t = static_cast<float>(s) / static_cast<float>(steps);
      const int cx = static_cast<int>(std::round(ax + dx * t));
      const int cy = static_cast<int>(std::round(ay + dy * t));
      for (int oy = -r; oy <= r; ++oy) {
        const int y = cy + oy;
        if (y < 0 || y >= kGrid) continue;
        for (int ox = -r; ox <= r; ++ox) {
          const int x = cx + ox;
          if (x < 0 || x >= kGrid) continue;
          const float d2 =
              static_cast<float>(ox * ox + oy * oy);
          if (d2 > radius * radius) continue;
          const float w = 1.f - std::sqrt(d2) / radius;
          mGrid[y * kGrid + x] += intensity * w;
        }
      }
    }
  }

  // -- state -------------------------------------------------------------
  static constexpr int kGrid = 256;

  float mX{0.f}, mY{0.f}, mW{1.f}, mH{1.f};
  al::Color mPenColor{1.f, 1.f, 1.f, 1.f};
  float mPenThickness{2.f};

  std::vector<Stroke> mStrokes;
  std::optional<Stroke> mActive;

  mutable std::vector<float> mGrid;
  mutable bool mGridDirty{true};
};

// Free-function form requested by the plan: targets the in-progress stroke
// if any, otherwise the most recently completed stroke. Provided as an
// inline non-member overload that takes the canvas explicitly.
inline void setStrokeAttr(DrawCanvas& canvas, const std::string& name,
                          float value) {
  canvas.setStrokeAttr(name, value);
}

}  // namespace studio
}  // namespace al
