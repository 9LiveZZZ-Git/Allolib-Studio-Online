// _al_web_sample_loaded — JS calls this back with the decoded sample buffer.
//
// Lives in libal_web.a (not the header) so the symbol is always present in
// the final binary. With EXPORTED_FUNCTIONS listing _al_web_sample_loaded,
// wasm-ld would otherwise error on examples that don't load samples and
// thus don't include al_WebSamplePlayer.hpp.

#include "al_WebSamplePlayer.hpp"
#include <emscripten.h>
#include <cstdlib>

extern "C" {

EMSCRIPTEN_KEEPALIVE
void _al_web_sample_loaded(al::WebSamplePlayer* player, float* samples,
                           int channels, int frames, float sampleRate,
                           int totalSamples) {
  if (player) {
    player->_onLoaded(samples, channels, frames, sampleRate, totalSamples);
    std::free(samples);
  }
}

} // extern "C"
