#ifndef ALLOLIB_STUDIO_SHARED_POST_FX_HPP
#define ALLOLIB_STUDIO_SHARED_POST_FX_HPP

// MAT200B Studio Online — Post-FX chain helper (header-only).
//
// Ping-pong EasyFBO chain that runs a stack of 2D fragment shaders over a
// captured scene. Effects: Phosphor (CRT decay), Bloom, ChromaticAberration,
// Glitch, Vignette.
//
// Web-specific notes:
//   - All shader sources are embedded as static const char*, ES 3.0 dialect
//     with explicit `precision highp float;`. This is required for WebGL2.
//     No `searchPaths` / on-disk shader files (MEMFS path resolution is
//     fragile in the worker).
//   - al::EasyFBO comes from the web-replaced version (al_EasyFBO_Web.cpp,
//     linked into libal_web.a per plan §0.6) — same API as upstream.
//   - Effects render a fullscreen triangle via inline geometry (no Mesh).
//
// Usage sketch:
//
//   PostFXChain fx;
//   fx.init(fbWidth, fbHeight);
//   fx.push(FX::Phosphor, 0.92f);
//   fx.push(FX::Bloom,    0.6f);
//   fx.push(FX::Vignette, 0.4f);
//
//   // each frame:
//   fx.beginCapture();
//     // ... draw scene with `g` against the captured FBO ...
//   fx.endCaptureAndRender(g);

#include <string>
#include <vector>

#include "al/graphics/al_EasyFBO.hpp"
#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_Shader.hpp"
#include "al/graphics/al_VAOMesh.hpp"

namespace studio {

enum class FX {
  Phosphor,
  Bloom,
  ChromaticAberration,
  Glitch,
  Vignette,
};

namespace post_fx_detail {

// ─── Shared fullscreen vertex shader ───────────────────────────────────────
static const char* kFullscreenVS = R"(#version 300 es
layout(location = 0) in vec3 vertexPosition;
layout(location = 2) in vec2 vertexTexCoord;
out vec2 vUV;
void main() {
  vUV = vertexTexCoord;
  gl_Position = vec4(vertexPosition.xy, 0.0, 1.0);
}
)";

// ─── Phosphor (CRT decay + bright additive bleed) ──────────────────────────
// Reads previous-frame FBO, scales by decay, max with current input,
// adds glow from bright pixels.
static const char* kPhosphorFS = R"(#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uCurrent;
uniform sampler2D uPrev;
uniform float uDecay;     // 0..1; 0.92 typical
uniform float uStrength;
out vec4 fragColor;
void main() {
  vec3 cur  = texture(uCurrent, vUV).rgb;
  vec3 prev = texture(uPrev,    vUV).rgb * uDecay;
  vec3 phos = max(cur, prev);
  float lum = dot(cur, vec3(0.2126, 0.7152, 0.0722));
  vec3 bleed = cur * smoothstep(0.6, 1.0, lum) * uStrength;
  fragColor = vec4(phos + bleed, 1.0);
}
)";

// ─── Bloom (single-pass gaussian blur on bright extract, additive) ─────────
// For brevity this is one combined pass; quality-conscious examples can
// chain two FX::Bloom pushes for a separable HV blur.
static const char* kBloomFS = R"(#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uCurrent;
uniform vec2 uTexel;
uniform float uStrength;
uniform float uThreshold;
out vec4 fragColor;
const float W[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
void main() {
  vec3 base = texture(uCurrent, vUV).rgb;
  // Brightness extract.
  float lum = dot(base, vec3(0.2126, 0.7152, 0.0722));
  vec3 hi = base * smoothstep(uThreshold, uThreshold + 0.1, lum);
  // Two-direction 9-tap gaussian on the brightness channel.
  vec3 acc = hi * W[0];
  for (int i = 1; i < 5; ++i) {
    float fi = float(i);
    acc += texture(uCurrent, vUV + vec2(uTexel.x * fi, 0.0)).rgb * W[i];
    acc += texture(uCurrent, vUV - vec2(uTexel.x * fi, 0.0)).rgb * W[i];
    acc += texture(uCurrent, vUV + vec2(0.0, uTexel.y * fi)).rgb * W[i];
    acc += texture(uCurrent, vUV - vec2(0.0, uTexel.y * fi)).rgb * W[i];
  }
  fragColor = vec4(base + acc * uStrength, 1.0);
}
)";

// ─── Chromatic aberration (radial RGB split) ───────────────────────────────
static const char* kChromaFS = R"(#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uCurrent;
uniform float uStrength;
out vec4 fragColor;
void main() {
  vec2 d = vUV - vec2(0.5);
  float r2 = dot(d, d);
  vec2 off = d * r2 * uStrength;
  float r = texture(uCurrent, vUV - off).r;
  float g = texture(uCurrent, vUV).g;
  float b = texture(uCurrent, vUV + off).b;
  fragColor = vec4(r, g, b, 1.0);
}
)";

// ─── Glitch (hash-noise horizontal slice offsets) ──────────────────────────
static const char* kGlitchFS = R"(#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uCurrent;
uniform float uStrength;
uniform float uTime;
out vec4 fragColor;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  // Slice index along Y; same offset within a slice.
  float slice = floor(vUV.y * 64.0);
  float r = hash(slice + floor(uTime * 30.0));
  float kick = step(0.92, r);  // most slices unaffected; rare strong slip
  float xoff = (r - 0.5) * 0.1 * uStrength * kick;
  fragColor = texture(uCurrent, vec2(vUV.x + xoff, vUV.y));
}
)";

// ─── Vignette (radial darkening) ───────────────────────────────────────────
static const char* kVignetteFS = R"(#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uCurrent;
uniform float uStrength;
out vec4 fragColor;
void main() {
  vec3 c = texture(uCurrent, vUV).rgb;
  vec2 d = vUV - vec2(0.5);
  float v = 1.0 - dot(d, d) * 4.0 * uStrength;
  v = clamp(v, 0.0, 1.0);
  fragColor = vec4(c * v, 1.0);
}
)";

inline const char* fragmentSource(FX fx) {
  switch (fx) {
    case FX::Phosphor:            return kPhosphorFS;
    case FX::Bloom:               return kBloomFS;
    case FX::ChromaticAberration: return kChromaFS;
    case FX::Glitch:              return kGlitchFS;
    case FX::Vignette:            return kVignetteFS;
  }
  return kVignetteFS;
}

}  // namespace post_fx_detail

class PostFXChain {
 public:
  struct PassEntry {
    FX fx;
    float strength;
    // Optional override uniforms (uName -> value), e.g. uDecay for Phosphor,
    // uThreshold for Bloom. Looked up by name at draw time.
    std::vector<std::pair<std::string, float>> overrides;
  };

  // Compile shaders + create ping-pong FBOs sized (w,h).
  void init(int w, int h) {
    if (mInitialized) return;
    mWidth = w;
    mHeight = h;

    al::EasyFBOSetting s;
    s.internal = 0x8814;  // GL_RGBA16F — extended dynamic range for bloom.
    s.format = 0x1908;    // GL_RGBA
    s.type = 0x1406;      // GL_FLOAT
    s.filterMin = 0x2601; // GL_LINEAR
    s.filterMag = 0x2601; // GL_LINEAR
    mInputFBO.init(w, h, s);
    mPing.init(w, h, s);
    mPong.init(w, h, s);

    // Per-effect shader programs; compile lazily to keep startup cheap, but
    // since we know the kit is small we just compile all up front.
    using namespace post_fx_detail;
    mShaders[(int)FX::Phosphor].compile(kFullscreenVS, kPhosphorFS);
    mShaders[(int)FX::Bloom].compile(kFullscreenVS, kBloomFS);
    mShaders[(int)FX::ChromaticAberration].compile(kFullscreenVS, kChromaFS);
    mShaders[(int)FX::Glitch].compile(kFullscreenVS, kGlitchFS);
    mShaders[(int)FX::Vignette].compile(kFullscreenVS, kVignetteFS);

    buildQuad();
    mInitialized = true;
  }

  void resize(int w, int h) {
    if (!mInitialized) {
      init(w, h);
      return;
    }
    if (w == mWidth && h == mHeight) return;
    mWidth = w;
    mHeight = h;
    al::EasyFBOSetting s;
    s.internal = 0x8814;
    s.format = 0x1908;
    s.type = 0x1406;
    s.filterMin = 0x2601;
    s.filterMag = 0x2601;
    // EasyFBO has no resize() — re-init in place; the destructor of the old
    // attachments is invoked on new init() because GPUObject manages handles.
    mInputFBO.init(w, h, s);
    mPing.init(w, h, s);
    mPong.init(w, h, s);
  }

  void push(FX fx, float strength = 1.f) {
    mPasses.push_back(PassEntry{fx, strength, {}});
  }

  void clear() { mPasses.clear(); }

  // Bind the input FBO so the user's scene draws into it.
  // Caller is responsible for clearing.
  void beginCapture() {
    mInputFBO.begin();
  }

  // Run the FX chain to the default framebuffer.
  void endCaptureAndRender(al::Graphics& g) {
    mInputFBO.end();
    if (mPasses.empty()) {
      // Pass-through: blit to default framebuffer via a textured quad.
      g.quadViewport(mInputFBO.tex(), -1.f, -1.f, 2.f, 2.f);
      return;
    }

    // Ping-pong: source starts as input; for the final pass we render to the
    // default framebuffer via Graphics::quadViewport using the last result.
    al::Texture* src = &mInputFBO.tex();
    al::EasyFBO* dst = &mPing;

    for (size_t i = 0; i < mPasses.size(); ++i) {
      const PassEntry& p = mPasses[i];
      const bool isLast = (i + 1 == mPasses.size());

      if (isLast) {
        // Render last pass directly to the screen.
        runPass(p, *src, nullptr);
      } else {
        runPass(p, *src, dst);
        src = &dst->tex();
        dst = (dst == &mPing) ? &mPong : &mPing;
      }
    }
  }

  // Override a uniform on the most recently pushed effect of type `fx`.
  // Useful for runtime sweeps (e.g. fx.setUniform(FX::Phosphor,"uDecay",.85)).
  void setUniform(FX fx, const std::string& name, float value) {
    for (auto it = mPasses.rbegin(); it != mPasses.rend(); ++it) {
      if (it->fx == fx) {
        for (auto& kv : it->overrides) {
          if (kv.first == name) {
            kv.second = value;
            return;
          }
        }
        it->overrides.emplace_back(name, value);
        return;
      }
    }
  }

  bool initialized() const { return mInitialized; }

 private:
  void buildQuad() {
    // Fullscreen triangle covering NDC; UV mapped 0..1.
    mQuad.reset();
    mQuad.primitive(al::Mesh::TRIANGLES);
    mQuad.vertex(-1.f, -1.f, 0.f);
    mQuad.vertex( 3.f, -1.f, 0.f);
    mQuad.vertex(-1.f,  3.f, 0.f);
    mQuad.texCoord(0.f, 0.f);
    mQuad.texCoord(2.f, 0.f);
    mQuad.texCoord(0.f, 2.f);
    mQuad.update();
  }

  // Run one pass. If `dst` is null, render to the currently bound framebuffer
  // (typically the default FB at the end of the chain).
  void runPass(const PassEntry& p, al::Texture& src, al::EasyFBO* dst) {
    al::ShaderProgram& sp = mShaders[(int)p.fx];
    if (dst) dst->begin();

    sp.begin();
    sp.uniform("uCurrent", 0);
    sp.uniform("uStrength", p.strength);

    // Per-effect default uniforms.
    switch (p.fx) {
      case FX::Phosphor:
        sp.uniform("uPrev", 1);
        sp.uniform("uDecay", 0.92f);
        // Phosphor reads previous-frame from the alternate ping-pong FBO.
        mPong.tex().bind(1);
        break;
      case FX::Bloom:
        sp.uniform("uTexel",
                   1.f / static_cast<float>(mWidth),
                   1.f / static_cast<float>(mHeight));
        sp.uniform("uThreshold", 0.7f);
        break;
      case FX::Glitch:
        sp.uniform("uTime", mGlitchTime);
        mGlitchTime += 1.f / 60.f;
        break;
      default:
        break;
    }

    // Apply user uniform overrides (last wins).
    for (const auto& kv : p.overrides) {
      sp.uniform(kv.first.c_str(), kv.second);
    }

    src.bind(0);
    // We avoid Graphics::draw() (which sets up its own shader state machine);
    // rely on the VAOMesh draw with our own ShaderProgram bound.
    mQuad.draw();
    src.unbind(0);

    if (p.fx == FX::Phosphor) mPong.tex().unbind(1);

    sp.end();
    if (dst) dst->end();
  }

  bool mInitialized = false;
  int mWidth = 0;
  int mHeight = 0;
  al::EasyFBO mInputFBO;
  al::EasyFBO mPing;
  al::EasyFBO mPong;
  al::ShaderProgram mShaders[5];   // one per FX
  std::vector<PassEntry> mPasses;
  al::VAOMesh mQuad;
  float mGlitchTime = 0.f;
};

}  // namespace studio

#endif  // ALLOLIB_STUDIO_SHARED_POST_FX_HPP
