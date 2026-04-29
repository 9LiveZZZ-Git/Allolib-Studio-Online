// _studio_shared/_smoke_test.cpp — compile-only smoke test for Phase 1a helpers.
//
// Not built by the regular pipeline. To verify locally inside the WASM
// container:
//
//   /opt/emsdk/upstream/emscripten/em++ \
//     -std=c++17 -fsyntax-only \
//     -I /app/allolib-wasm/include \
//     -I /app/allolib/include \
//     -I /app/allolib/external/Gamma \
//     /app/allolib-wasm/include/_studio_shared/_smoke_test.cpp
//
// This will validate the headers parse + the public APIs from §0.5 are
// present. Full link verification will happen once a Phase 2 example
// (Lissajous oscilloscope synth) consumes them via Studio Online.

#include "_studio_shared/audio_features.hpp"
#include "_studio_shared/post_fx.hpp"

void smoke_audio() {
  studio::AudioFeatureExtractor af(2048, 512, 48000.f);
  af.setSampleRate(44100.f);
  af.enableMFCC(true);
  af.enablePitch(true);
  float buf[128] = {0.f};
  af.processBlock(buf, 128);
  studio::FeatureFrame f;
  (void)af.latest(f);
}

void smoke_postfx() {
  studio::PostFXChain fx;
  // init/resize/push/clear/setUniform are exercised; begin/endCapture
  // require a live GL context so they are not invoked here.
  // (void) calls keep the symbols referenced.
  (void)&studio::PostFXChain::init;
  (void)&studio::PostFXChain::resize;
  (void)&studio::PostFXChain::push;
  (void)&studio::PostFXChain::clear;
  (void)&studio::PostFXChain::beginCapture;
  (void)&studio::PostFXChain::endCaptureAndRender;
  (void)&studio::PostFXChain::setUniform;
  fx.push(studio::FX::Phosphor, 0.92f);
  fx.push(studio::FX::Bloom, 0.6f);
  fx.push(studio::FX::Vignette, 0.4f);
  fx.clear();
}
