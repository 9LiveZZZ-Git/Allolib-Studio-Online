// _studio_shared/_smoke_test.cpp — compile-only smoke test for ALL Phase 0
// cross-cutting helpers + gam::HRFilter.
//
// v0.10.0: extended from audio_features + post_fx to cover every helper
// shipped in `allolib-wasm/include/_studio_shared/`. Surfaces template
// instantiation gaps + missing symbols before they hit the Phase 2
// validation examples (Lissajous, compressor, Risset, spectrogram, K-S).
//
// Not part of the regular libal_web.a build. Manual verification:
//
//   /opt/emsdk/upstream/emscripten/em++ \
//     -std=c++17 -fsyntax-only \
//     -I /app/allolib-wasm/include \
//     -I /app/allolib/include \
//     -I /app/allolib/external/Gamma \
//     -I /app/allolib/external/json/include \
//     /app/allolib-wasm/include/_studio_shared/_smoke_test.cpp
//
// Full link verification happens once Phase 2 example #1 (Lissajous
// oscilloscope) lands and consumes audio_features + post_fx + a
// ringbuffer; once Phase 3 examples wire up Convolver, Pickable, etc.
// the link path is exercised naturally.

#include "_studio_shared/audio_features.hpp"
#include "_studio_shared/automation.hpp"
#include "_studio_shared/draw_canvas.hpp"
#include "_studio_shared/param_graph.hpp"
#include "_studio_shared/pickable.hpp"
#include "_studio_shared/pixel_audio_bridge.hpp"
#include "_studio_shared/post_fx.hpp"
#include "_studio_shared/pv_resynth.hpp"
#include "_studio_shared/web_convolver.hpp"

// Header-only HRFilter from Gamma — verifies WASM includes resolve and
// the template instantiates without pulling SoundFile/Recorder. Per
// _hrfilter_notes.md it transitively only depends on already-linked
// Gamma headers. Failure here would mean HRScene/HRFilter is reaching
// for an excluded Gamma .cpp.
#include "Gamma/HRFilter.h"

#include "al/ui/al_Parameter.hpp"

void smoke_audio_features() {
  studio::AudioFeatureExtractor af(2048, 512, 48000.f);
  af.setSampleRate(44100.f);
  af.enableMFCC(true);
  af.enablePitch(true);
  float buf[128] = {0.f};
  af.processBlock(buf, 128);
  studio::FeatureFrame f;
  (void)af.latest(f);
}

void smoke_post_fx() {
  studio::PostFXChain fx;
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

void smoke_automation() {
  al::Parameter p{"gain", "", 0.5f, 0.f, 1.f};
  studio::AutomationLane lane(p);
  // Reference the public surface so the linker has to find it.
  (void)&studio::AutomationLane::startRecording;
  (void)&studio::AutomationLane::startPlayback;
  (void)&studio::AutomationLane::tick;
  (void)&studio::AutomationLane::saveCSV;
  (void)&studio::AutomationLane::loadCSV;
}

void smoke_draw_canvas() {
  studio::DrawCanvas canvas;
  (void)&studio::DrawCanvas::onMouseDown;
  (void)&studio::DrawCanvas::onMouseDrag;
  (void)&studio::DrawCanvas::onMouseUp;
  (void)&studio::DrawCanvas::clear;
  (void)&studio::DrawCanvas::draw;
  (void)&studio::DrawCanvas::sampleAt;
  (void)&studio::DrawCanvas::sampleColumn;
  canvas.clear();
}

void smoke_param_graph() {
  studio::ParamGraph graph;
  (void)&studio::ParamGraph::addParameter;
  (void)&studio::ParamGraph::addSource;
  (void)&studio::ParamGraph::connect;
  (void)&studio::ParamGraph::tick;
  (void)&studio::ParamGraph::saveJSON;
  (void)&studio::ParamGraph::loadJSON;
  graph.tick(0.016f);
}

void smoke_pickable() {
  studio::Pickable pk;
  (void)&studio::Pickable::onMouseDown;
  (void)&studio::Pickable::onMouseDrag;
  (void)&studio::Pickable::onMouseUp;
  studio::Ray r{al::Vec3f(0,0,0), al::Vec3f(0,0,-1)};
  studio::Hit h;
  (void)pk.intersect(r, h);
}

void smoke_pixel_audio_bridge() {
  studio::PixelAudioBridge bridge(512, 256);
  uint8_t row[512 * 4] = {0};
  bridge.writePixel(0, 0, row[0], row[1], row[2], row[3]);
  std::vector<uint8_t> out(512 * 4);
  bridge.readRow(0, out.data());
}

void smoke_pv_resynth() {
  studio::PVResynth pv(1024, 256, 44100.f);
  float in[256] = {0.f}, out[256] = {0.f};
  pv.analyze(in, 256);
  pv.resynthesize(out, 256);
  pv.setBinMag(0, 0.5f);
  pv.freezeFrame(true);
}

void smoke_web_convolver() {
  studio::WebConvolver conv;
  (void)&studio::WebConvolver::loadIR;
  (void)&studio::WebConvolver::process;
  (void)&studio::WebConvolver::setBlockSize;
  conv.setBlockSize(128);
}

void smoke_hrfilter() {
  // gam::HRFilter is the parametric (Iida 2007/2018) head-shadow + pinna
  // model. Header-only, transitive deps all on the WASM Gamma include
  // path per _hrfilter_notes.md. Instantiating + calling the operator
  // forces the linker to resolve every transitive symbol; if any
  // excluded Gamma .cpp creeps in (SoundFile/Recorder/AudioIO), this
  // catches it at compile time.
  gam::HRFilter<float> hrf;
  hrf.pos(1.f, 0.f, 0.f);
  float in = 0.f;
  float l = 0.f, r = 0.f;
  hrf(in, l, r);
  (void)l; (void)r;
}

// Aggregator so the linker doesn't dead-strip individual smoke fns.
void smoke_all() {
  smoke_audio_features();
  smoke_post_fx();
  smoke_automation();
  smoke_draw_canvas();
  smoke_param_graph();
  smoke_pickable();
  smoke_pixel_audio_bridge();
  smoke_pv_resynth();
  smoke_web_convolver();
  smoke_hrfilter();
}
