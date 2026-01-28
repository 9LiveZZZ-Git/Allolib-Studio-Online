/**
 * AlloLib Compatibility Header
 *
 * Allows the same code to compile for both:
 * - Native AlloLib (desktop)
 * - AlloLib Studio Online (WASM/browser)
 *
 * Usage:
 *   #include "al_compat.hpp"
 *
 *   class MyApp : public al::App {  // Works on both platforms
 *   public:
 *       void onCreate() override { ... }
 *       void onDraw(Graphics& g) override { ... }
 *       void onSound(AudioIOData& io) override { ... }
 *   };
 *
 *   ALLOLIB_MAIN(MyApp)  // Works on both platforms
 *
 * Compatible APIs (available on both platforms):
 * - nav()          : Get/set navigation pose (camera position/orientation)
 * - pose()         : Alias for nav()
 * - lens()         : Get/set lens (projection) settings (fov, near/far clips)
 * - view()         : Get/set viewpoint (combined lens + pose)
 * - aspect()       : Get window aspect ratio
 * - width/height() : Get window dimensions
 * - configureAudio(): Configure audio (aliased to configureWebAudio on WASM)
 *
 * Camera/View example:
 *   void onCreate() override {
 *       nav().pos(0, 0, 5);           // Position camera at z=5
 *       lens().fovy(60);              // Set field of view
 *       lens().near(0.1).far(100);    // Set clip planes
 *   }
 *
 *   void onDraw(Graphics& g) override {
 *       g.camera(view());             // Apply camera view
 *       // ... draw objects ...
 *   }
 */

#ifndef AL_COMPAT_HPP
#define AL_COMPAT_HPP

#ifdef __EMSCRIPTEN__
// ============================================================================
// WASM/Browser Build
// ============================================================================

#include "al_WebApp.hpp"

namespace al {
    // WebApp IS the App class for WASM builds
    using App = WebApp;
}

// Unified main macro
#define ALLOLIB_MAIN(AppClass) ALLOLIB_WEB_MAIN(AppClass)

// Audio configuration compatibility
#define configureAudio configureWebAudio

#else
// ============================================================================
// Native/Desktop Build
// ============================================================================

#include "al/app/al_App.hpp"

// Unified main macro for desktop
#define ALLOLIB_MAIN(AppClass) \
    int main() { \
        AppClass app; \
        app.start(); \
        return 0; \
    }

// For compatibility with WASM-style audio config
#define configureWebAudio configureAudio

#endif // __EMSCRIPTEN__

// ============================================================================
// Cross-platform utilities
// ============================================================================

namespace al {

/**
 * Platform detection
 */
inline bool isWASM() {
#ifdef __EMSCRIPTEN__
    return true;
#else
    return false;
#endif
}

inline bool isDesktop() {
    return !isWASM();
}

/**
 * Platform-specific print (printf works on both, but this adds context)
 */
inline void platformPrint(const char* msg) {
#ifdef __EMSCRIPTEN__
    printf("[WASM] %s\n", msg);
#else
    printf("[Desktop] %s\n", msg);
#endif
}

} // namespace al

// ============================================================================
// API Compatibility Notes
// ============================================================================
//
// The following methods are compatible across platforms:
//
// Navigation/Camera:
//   nav()      - Pose&           - Navigation pose (camera transformation)
//   pose()     - Pose&           - Alias for nav()
//   lens()     - Lens&           - Projection settings (fovy, near, far)
//   view()     - Viewpoint&      - Combined lens + pose for rendering
//   aspect()   - double          - Window aspect ratio (width/height)
//   width()    - int             - Canvas/window width
//   height()   - int             - Canvas/window height
//
// Graphics callbacks:
//   onCreate()                   - Called once at start
//   onAnimate(double dt)         - Called every frame
//   onDraw(Graphics& g)          - Called every frame for rendering
//   onExit()                     - Called before shutdown
//
// Audio callbacks:
//   onSound(AudioIOData& io)     - Called for audio processing
//   configureAudio(rate, buffer, outCh, inCh)
//
// Input callbacks:
//   onKeyDown(const Keyboard& k) - Key pressed
//   onKeyUp(const Keyboard& k)   - Key released
//   onMouseDown(const Mouse& m)  - Mouse button pressed
//   onMouseUp(const Mouse& m)    - Mouse button released
//   onMouseDrag(const Mouse& m)  - Mouse dragged
//   onMouseMove(const Mouse& m)  - Mouse moved
//   onMouseScroll(const Mouse& m)- Mouse scrolled
//   onResize(int w, int h)       - Window resized
//
// Platform-specific features (not available cross-platform):
//   - OSC networking (use WebOSC on WASM)
//   - MIDI (use WebMIDI on WASM)
//   - File I/O (use WebFile on WASM)
//   - ImGui (not available on WASM)
//   - DistributedApp (not available on WASM)
//
// ============================================================================

#endif // AL_COMPAT_HPP
