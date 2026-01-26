#pragma once

/**
 * AlloLib Web Application Base Class
 *
 * This header provides the WebApp base class that extends AlloLib's App
 * for browser-based execution via WebAssembly.
 *
 * TODO: Implement full AlloLib integration
 */

namespace al {
namespace web {

/**
 * Base class for browser-based AlloLib applications.
 * Handles WebGL2 rendering and Web Audio integration.
 */
class WebApp {
public:
  virtual ~WebApp() = default;

  // Lifecycle methods
  virtual void onCreate() {}
  virtual void onAnimate(double dt) {}
  virtual void onDraw() {}
  virtual void onExit() {}

  // Input handlers
  virtual void onKeyDown(int key) {}
  virtual void onKeyUp(int key) {}
  virtual void onMouseMove(double x, double y) {}
  virtual void onMouseDown(int button) {}
  virtual void onMouseUp(int button) {}

  // Audio callback
  virtual void onAudio(float* outBuffer, int numFrames, int numChannels) {}

  // Start the application main loop
  void start();
  void stop();

protected:
  bool mRunning = false;
  int mWidth = 800;
  int mHeight = 600;
  double mFPS = 60.0;
};

} // namespace web
} // namespace al
