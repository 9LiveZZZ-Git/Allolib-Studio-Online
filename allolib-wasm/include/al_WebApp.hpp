#pragma once

/**
 * AlloLib Web Application
 *
 * A self-contained web application class for running AlloLib
 * in the browser via Emscripten/WebAssembly.
 *
 * This class provides:
 * - WebGL2 graphics rendering
 * - Web Audio API integration
 * - Keyboard/mouse input handling
 * - Main loop management
 *
 * Unlike the desktop App class, this does not include OSC networking
 * or other features that don't work in the browser.
 */

#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/io/al_AudioIOData.hpp"
#include "al/io/al_Window.hpp"
#include "al/math/al_Vec.hpp"
#include "al/spatial/al_Pose.hpp"

#include <vector>
#include <memory>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/html5.h>
#endif

namespace al {

/**
 * Web Audio configuration
 */
struct WebAudioConfig {
    int sampleRate = 44100;
    int bufferSize = 128;  // Web Audio worklets process 128 samples at a time
    int outputChannels = 2;
    int inputChannels = 0;
};

/**
 * WebApp - Self-contained web application for AlloLib
 *
 * Users should inherit from this class and override the virtual methods:
 * - onCreate(): Called once when the app starts
 * - onAnimate(dt): Called every frame for animation
 * - onDraw(g): Called every frame for rendering
 * - onSound(io): Called to fill audio buffers
 * - onKeyDown(k), onKeyUp(k): Keyboard handling
 * - onMouseDown(m), etc.: Mouse handling
 */
class WebApp {
public:
    WebApp();
    virtual ~WebApp();

    // =========================================================================
    // Virtual methods to override
    // =========================================================================

    /// Called once when the application starts
    virtual void onCreate() {}

    /// Called every frame for animation (dt = time since last frame in seconds)
    virtual void onAnimate(double dt) { (void)dt; }

    /// Called every frame for rendering
    virtual void onDraw(Graphics& g) { (void)g; }

    /// Called to process audio
    virtual void onSound(AudioIOData& io) { (void)io; }

    /// Called when the application is about to exit
    virtual void onExit() {}

    /// Keyboard callbacks - return true to indicate event was handled
    virtual bool onKeyDown(const Keyboard& k) { (void)k; return false; }
    virtual bool onKeyUp(const Keyboard& k) { (void)k; return false; }

    /// Mouse callbacks - return true to indicate event was handled
    virtual bool onMouseDown(const Mouse& m) { (void)m; return false; }
    virtual bool onMouseUp(const Mouse& m) { (void)m; return false; }
    virtual bool onMouseDrag(const Mouse& m) { (void)m; return false; }
    virtual bool onMouseMove(const Mouse& m) { (void)m; return false; }
    virtual bool onMouseScroll(const Mouse& m) { (void)m; return false; }

    /// Called when the window is resized
    virtual void onResize(int w, int h) { (void)w; (void)h; }

    // =========================================================================
    // Configuration (call before start())
    // =========================================================================

    /// Configure web audio settings
    void configureWebAudio(const WebAudioConfig& config);
    void configureWebAudio(int sampleRate, int bufferSize, int outputChannels, int inputChannels = 0);

    /// Configure window/canvas dimensions
    void dimensions(int width, int height);

    // =========================================================================
    // Runtime control
    // =========================================================================

    /// Start the application
    void start();

    /// Stop the application
    void stop();

    /// Check if the app is running
    bool isRunning() const { return mRunning; }

    // =========================================================================
    // Accessors
    // =========================================================================

    /// Get the graphics context
    Graphics& graphics() { return *mGraphics; }

    /// Get the default window
    Window& defaultWindow() { return *mWindow; }

    /// Get audio configuration
    const WebAudioConfig& audioConfig() const { return mAudioConfig; }

    /// Get/set the navigation pose (camera position)
    Pose& nav() { return mNav; }
    const Pose& nav() const { return mNav; }

    // =========================================================================
    // Audio processing (called from JavaScript)
    // =========================================================================

    /// Fill the audio buffer (called from AudioWorklet via JavaScript)
    void processAudioBuffer(float* outputBuffer, int numFrames, int numChannels);

    /// Set listener pose for spatial audio
    void setListenerPose(const Pose& pose);

protected:
    /// Main loop tick (called every frame)
    void tick(double dt);

private:
    // Emscripten main loop callback
    static void mainLoopCallback(void* arg);

    // Initialization helpers
    void initGraphics();
    void initAudio();
    void cleanupGraphics();
    void cleanupAudio();

    // Configuration
    WebAudioConfig mAudioConfig;
    int mWidth = 800;
    int mHeight = 600;

    // Runtime state
    bool mRunning = false;
    bool mAudioInitialized = false;
    double mLastTime = 0;

    // Graphics
    std::unique_ptr<Window> mWindow;
    std::unique_ptr<Graphics> mGraphics;

    // Audio
    AudioIOData* mAudioIO = nullptr;

    // Navigation
    Pose mNav;
};

/**
 * Macro for easy web app creation
 * Creates the necessary Emscripten exports for the application
 */
#define ALLOLIB_WEB_MAIN(AppClass)                                      \
    static AppClass* gWebApp = nullptr;                                  \
    extern "C" {                                                         \
        EMSCRIPTEN_KEEPALIVE void allolib_create() {                    \
            if (!gWebApp) {                                              \
                gWebApp = new AppClass();                                \
            }                                                            \
        }                                                                \
        EMSCRIPTEN_KEEPALIVE void allolib_start() {                     \
            if (gWebApp) {                                               \
                gWebApp->start();                                        \
            }                                                            \
        }                                                                \
        EMSCRIPTEN_KEEPALIVE void allolib_stop() {                      \
            if (gWebApp) {                                               \
                gWebApp->stop();                                         \
            }                                                            \
        }                                                                \
        EMSCRIPTEN_KEEPALIVE void allolib_destroy() {                   \
            if (gWebApp) {                                               \
                delete gWebApp;                                          \
                gWebApp = nullptr;                                       \
            }                                                            \
        }                                                                \
        EMSCRIPTEN_KEEPALIVE void allolib_process_audio(                \
            float* buffer, int frames, int channels) {                   \
            if (gWebApp) {                                               \
                gWebApp->processAudioBuffer(buffer, frames, channels);   \
            }                                                            \
        }                                                                \
        EMSCRIPTEN_KEEPALIVE void allolib_configure_audio(              \
            int sampleRate, int bufferSize, int outCh, int inCh) {      \
            if (gWebApp) {                                               \
                gWebApp->configureWebAudio(sampleRate, bufferSize,       \
                                           outCh, inCh);                 \
            }                                                            \
        }                                                                \
    }                                                                    \
    int main() {                                                         \
        allolib_create();                                                \
        allolib_start();                                                 \
        return 0;                                                        \
    }

} // namespace al
