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
#include "al/io/al_AudioIO.hpp"
#include "al/io/al_AudioIOData.hpp"
#include "al/io/al_Window.hpp"
#include "al/io/al_ControlNav.hpp"
#include "al/math/al_Vec.hpp"
#include "al/math/al_Matrix4.hpp"
#include "al/math/al_Random.hpp"
#include "al/spatial/al_Pose.hpp"
#include "al_WebAutoLOD.hpp"
#include "al_WebGraphicsBackend.hpp"
#include "al_GraphicsWebExtension.hpp"

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
    /// Called once before onCreate() to set up domains/configuration —
    /// matches al::App's onInit() lifecycle hook.
    virtual void onInit() {}

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

    /// Configure graphics backend (call before start())
    /// Options: BackendType::WebGL2, BackendType::WebGPU, BackendType::Auto
    /// Default: WebGL2 for maximum compatibility
    void configureBackend(BackendType type) { mBackendType = type; }

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

    /// Get the graphics context (WebGL2/OpenGL ES 3.0)
    Graphics& graphics() { return *mGraphics; }

    /// Get the default window
    Window& defaultWindow() { return *mWindow; }

    /// Get the graphics backend (for low-level rendering)
    /// Returns nullptr if not initialized or if using classic Graphics only
    GraphicsBackend* backend() { return mBackend.get(); }
    const GraphicsBackend* backend() const { return mBackend.get(); }

    /// Check which backend type is active
    BackendType activeBackendType() const {
        return mBackend ? mBackend->getType() : BackendType::WebGL2;
    }

    /// Check if WebGPU backend is active (has compute shader support)
    bool hasComputeSupport() const {
        return mBackend && mBackend->supportsCompute();
    }

    /// Get audio configuration
    const WebAudioConfig& audioConfig() const { return mAudioConfig; }

    /// Native al::App compatibility — returns the underlying al::AudioIO
    /// (a real AudioIO, not a value-type proxy). The actual audio still
    /// flows through the AudioWorklet; this object just exposes the
    /// native channel/rate/buffer/append/start/cpu/time API surface so
    /// imported native code compiles unchanged. Lazily synced from
    /// mAudioConfig so framesPerSecond() etc. return the configured rate.
    AudioIO& audioIO() {
        if (mAudioIOReal.framesPerSecond() != mAudioConfig.sampleRate) {
            mAudioIOReal.framesPerSecond(mAudioConfig.sampleRate);
            mAudioIOReal.framesPerBuffer(mAudioConfig.bufferSize);
            mAudioIOReal.channelsOut(mAudioConfig.outputChannels);
            mAudioIOReal.channelsIn(mAudioConfig.inputChannels);
        }
        return mAudioIOReal;
    }
    const AudioIO& audioIO() const {
        return const_cast<WebApp*>(this)->audioIO();
    }

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

    // =========================================================================
    // Window control (al::App compatibility)
    // =========================================================================

    /// Quit the application (alias for stop())
    void quit() { stop(); }

    /// Set/get the window title
    void title(const std::string& t) {
        mTitle = t;
        EM_ASM({ document.title = UTF8ToString($0); }, t.c_str());
    }
    const std::string& title() const { return mTitle; }

    /// Set/get fullscreen mode
    void fullScreen(bool on) {
        mFullScreen = on;
        if (on) {
            EM_ASM({ Module.canvas.requestFullscreen(); });
        } else {
            EM_ASM({ if (document.exitFullscreen) document.exitFullscreen(); });
        }
    }
    bool fullScreen() const { return mFullScreen; }
    void fullScreenToggle() { fullScreen(!mFullScreen); }

    /// vsync - always true in browser (requestAnimationFrame is inherently vsync)
    bool vsync() const { return true; }
    void vsync(bool) {}  // no-op

    /// Target FPS (informational; rAF drives the actual rate)
    void fps(double f) { mTargetFPS = f; }
    double fps() const { return mTargetFPS; }

    /// Hide/show the mouse cursor over the canvas
    void cursorHide(bool v) {
        mCursorHidden = v;
        EM_ASM({
            Module.canvas.style.cursor = $0 ? 'none' : 'default';
        }, v ? 1 : 0);
    }
    bool cursorHide() const { return mCursorHidden; }
    void cursorHideToggle() { cursorHide(!mCursorHidden); }

    /// Window decoration - no-op (browser controls window chrome)
    void decorated(bool) {}
    bool decorated() const { return true; }

    /// Window visibility - no-op (canvas is always visible)
    void visible(bool) {}
    bool visible() const { return true; }

    /// Iconify - no-op in browser
    void iconify() {}

    // =========================================================================
    // Framebuffer / HiDPI (al::App compatibility)
    // =========================================================================

    /// Returns the device pixel ratio (>1 on HiDPI/Retina displays)
    double highresFactor() const {
        return EM_ASM_DOUBLE({ return window.devicePixelRatio || 1.0; });
    }

    /// Framebuffer width (physical pixels, accounting for HiDPI)
    int fbWidth()  const { return (int)(mWidth  * highresFactor()); }

    /// Framebuffer height (physical pixels, accounting for HiDPI)
    int fbHeight() const { return (int)(mHeight * highresFactor()); }

    // =========================================================================
    // Input accessors (al::App compatibility)
    // =========================================================================

    /// Get the current keyboard state
    const Keyboard& keyboard() const { return mKeyboard; }

    /// Get the current mouse state
    const Mouse&    mouse()    const { return mMouse; }

    // =========================================================================
    // Navigation control (al::App compatibility)
    // =========================================================================

    /// Get the navigation input controller
    NavInputControl& navControl() { return mNavControl; }
    const NavInputControl& navControl() const { return mNavControl; }

protected:
    /// Main loop tick (called every frame)
    void tick(double dt);

private:
    // Emscripten main loop callback
    static void mainLoopCallback(void* arg);

    // Initialization helpers
    void initGraphics();
    void initBackend();
    void initAudio();
    void cleanupGraphics();
    void cleanupBackend();
    void cleanupAudio();

    // Configuration
    WebAudioConfig mAudioConfig;
    int mWidth = 800;
    int mHeight = 600;
    BackendType mBackendType = BackendType::WebGL2;  // Default to WebGL2 for compatibility

    // Runtime state
    bool mRunning = false;
    bool mAudioInitialized = false;
    double mLastTime = 0;

    // Graphics
    std::unique_ptr<Window> mWindow;
    std::unique_ptr<Graphics> mGraphics;
    std::unique_ptr<GraphicsBackend> mBackend;

    // Audio
    AudioIOData* mAudioIO = nullptr;
    AudioIO mAudioIOReal;  // exposed via audioIO() — config-synced wrapper

    // Navigation and view
    Nav mNav;
    Viewpoint mViewpoint;
    NavInputControl mNavControl{mNav};

    // Input state
    Keyboard mKeyboard;
    Mouse mMouse;

    // Window state
    std::string mTitle     = "AlloLib Studio";
    bool mFullScreen       = false;
    bool mCursorHidden     = false;
    double mTargetFPS      = 60.0;

    // Automatic LOD
    AutoLODManager mAutoLOD;

    // Graphics-Backend integration for WebGPU rendering
    GraphicsWebExtension mGraphicsExtension;

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
        EMSCRIPTEN_KEEPALIVE void allolib_configure_backend(int type) { \
            EM_ASM({ console.log('[WASM] allolib_configure_backend: ' + $0); }, type); \
            if (gWebApp) {                                               \
                gWebApp->configureBackend(static_cast<al::BackendType>(type)); \
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
        /* NOTE: Do NOT call allolib_start() here! */                   \
        /* JavaScript runtime must call allolib_configure_backend() */  \
        /* first to set up WebGPU, then call allolib_start() */         \
        EM_ASM({ console.log('[WASM] main() done - waiting for JS to call allolib_start()'); }); \
        return 0;                                                        \
    }

} // namespace al
