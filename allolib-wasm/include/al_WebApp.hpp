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
 * - Automatic LOD (level of detail) mesh simplification
 *
 * API compatible with native al::App where possible:
 * - nav(), pose(), lens(), view() for camera control
 * - configureAudio() aliased to configureWebAudio()
 *
 * Automatic LOD:
 *   // Enable in onCreate():
 *   autoLOD().enable();
 *   autoLOD().setLevels(4);
 *   autoLOD().setDistances({10, 25, 50, 100});
 *
 *   // In onDraw, just use drawLOD() instead of g.draw():
 *   drawLOD(g, myMesh);  // Automatically uses appropriate LOD level
 *
 * Unlike the desktop App class, this does not include OSC networking
 * or other features that don't work in the browser.
 */

#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/graphics/al_Lens.hpp"
#include "al/graphics/al_Viewpoint.hpp"
#include "al/io/al_AudioIOData.hpp"
#include "al/io/al_Window.hpp"
#include "al/io/al_ControlNav.hpp"
#include "al/math/al_Vec.hpp"
#include "al/math/al_Matrix4.hpp"
#include "al/spatial/al_Pose.hpp"
#include "al_WebAutoLOD.hpp"

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

    /// Get/set the navigation pose (camera position) - compatible with al::App
    Nav& nav() { return mNav; }
    const Nav& nav() const { return mNav; }

    /// Get/set the camera pose - alias for nav() for al::App compatibility
    Nav& pose() { return mNav; }
    const Nav& pose() const { return mNav; }

    /// Get/set the lens (projection settings) - al::App compatibility
    Lens& lens() { return mViewpoint.lens(); }
    const Lens& lens() const { return mViewpoint.lens(); }

    /// Get/set the viewpoint (combined lens + pose) - al::App compatibility
    Viewpoint& view() { return mViewpoint; }
    const Viewpoint& view() const { return mViewpoint; }

    /// Get aspect ratio of the window
    double aspect() const { return mWidth > 0 && mHeight > 0 ? (double)mWidth / mHeight : 1.0; }

    /// Get window dimensions
    int width() const { return mWidth; }
    int height() const { return mHeight; }

    /// Alias for configureWebAudio - al::App compatibility
    void configureAudio(int sampleRate, int bufferSize, int outputChannels, int inputChannels = 0) {
        configureWebAudio(sampleRate, bufferSize, outputChannels, inputChannels);
    }

    // =========================================================================
    // Automatic LOD (Level of Detail)
    // =========================================================================

    /// Get the auto-LOD manager for configuration
    AutoLODManager& autoLOD() { return mAutoLOD; }
    const AutoLODManager& autoLOD() const { return mAutoLOD; }

    /// Draw a mesh with automatic LOD selection
    /// Uses camera distance to select appropriate detail level
    void drawLOD(Graphics& g, const Mesh& mesh) {
        if (mAutoLOD.enabled()) {
            const Mesh& selected = mAutoLOD.selectMesh(mesh, g.modelMatrix());
            g.draw(selected);
        } else {
            g.draw(mesh);
        }
    }

    /// Convenience: Enable auto-LOD with default settings
    void enableAutoLOD(int levels = 4) {
        mAutoLOD.enable();
        mAutoLOD.setLevels(levels);
    }

    /// Convenience: Disable auto-LOD
    void disableAutoLOD() {
        mAutoLOD.disable();
    }

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

    // Navigation and view
    Nav mNav;
    Viewpoint mViewpoint;

    // Automatic LOD
    AutoLODManager mAutoLOD;

    // Initialize viewpoint with nav pose
    void initViewpoint() {
        mViewpoint.pose(mNav);
        // Default lens settings
        mViewpoint.lens().fovy(60.0);
        mViewpoint.lens().near(0.01);
        mViewpoint.lens().far(1000.0);
    }
};

/**
 * Macro for easy web app creation
 * Creates the necessary Emscripten exports for the application
 */
#define ALLOLIB_WEB_MAIN(AppClass)                                      \
    static AppClass* gWebApp = nullptr;                                  \
    extern "C" {                                                         \
        EMSCRIPTEN_KEEPALIVE void allolib_create() {                    \
            EM_ASM({ console.log('[WASM] allolib_create() called'); }); \
            if (!gWebApp) {                                              \
                gWebApp = new AppClass();                                \
                EM_ASM({ console.log('[WASM] App instance created'); });\
            }                                                            \
        }                                                                \
        EMSCRIPTEN_KEEPALIVE void allolib_start() {                     \
            EM_ASM({ console.log('[WASM] allolib_start() called'); });  \
            if (gWebApp) {                                               \
                gWebApp->start();                                        \
                EM_ASM({ console.log('[WASM] start() returned'); });    \
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
        EM_ASM({ console.log('[WASM] main() called'); });               \
        allolib_create();                                                \
        allolib_start();                                                 \
        EM_ASM({ console.log('[WASM] main() done'); });                 \
        return 0;                                                        \
    }

} // namespace al
