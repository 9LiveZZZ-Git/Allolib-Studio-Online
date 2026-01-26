/**
 * Web Audio Backend for AlloLib
 *
 * This replaces PortAudio with Web Audio API for browser execution.
 * Uses AudioWorklet for low-latency audio processing.
 *
 * TODO: Implement full Web Audio integration
 */

#include "al_web_app.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/bind.h>
#endif

namespace al {
namespace web {

void WebApp::start() {
  mRunning = true;

#ifdef __EMSCRIPTEN__
  // Set up Emscripten main loop
  // emscripten_set_main_loop_arg(mainLoopCallback, this, 0, 1);
#endif
}

void WebApp::stop() {
  mRunning = false;

#ifdef __EMSCRIPTEN__
  // emscripten_cancel_main_loop();
#endif
}

#ifdef __EMSCRIPTEN__
// Embind bindings for JavaScript interop
EMSCRIPTEN_BINDINGS(allolib_web) {
  // TODO: Add bindings for WebApp methods
}
#endif

} // namespace web
} // namespace al
