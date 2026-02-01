#include "al_WebApp.hpp"

// Conditionally include backends based on build configuration
#if defined(ALLOLIB_WEBGL2)
#include "al_WebGL2Backend.hpp"
#endif

#if defined(ALLOLIB_WEBGPU)
#include "al_WebGPUBackend.hpp"
#endif

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/html5.h>
#include <EGL/egl.h>
#endif

// Forward declare GLAD loader
extern "C" int gladLoadGLLoader(void* (*load)(const char*));

#include <cmath>
#include <cstring>
#include <iostream>

// Gamma DSP library for oscillators etc.
#include "Gamma/Domain.h"

// EM_JS function to register AutoLOD JavaScript bridge
// Using EM_JS instead of EM_ASM because EM_ASM has issues with JS object literals
#ifdef __EMSCRIPTEN__
EM_JS(void, registerPointSizeJSBridge, (), {
    window.allolib = window.allolib || {};
    window.allolib.graphics = window.allolib.graphics || {};
    window.allolib.graphics.setPointSize = function(size) {
        Module.ccall('al_web_set_point_size', null, ['number'], [size]);
    };
    window.allolib.graphics.getPointSize = function() {
        return Module.ccall('al_web_get_point_size', 'number', [], []);
    };
    console.log('[AlloLib] Graphics JS bridge registered');
});

EM_JS(void, registerAutoLODJSBridge, (), {
    window.allolib = window.allolib || {};
    window.allolib.autoLOD = {
        setBias: function(bias) {
            Module.ccall('al_autolod_set_bias', null, ['number'], [bias]);
        },
        setEnabled: function(enabled) {
            Module.ccall('al_autolod_set_enabled', null, ['number'], [enabled ? 1 : 0]);
        },
        setBudget: function(budget) {
            Module.ccall('al_autolod_set_budget', null, ['number'], [budget]);
        },
        setMode: function(mode) {
            Module.ccall('al_autolod_set_mode', null, ['number'], [mode]);
        },
        setMinFullQualityDistance: function(distance) {
            Module.ccall('al_autolod_set_min_full_quality_distance', null, ['number'], [distance]);
        },
        setDistances: function(d0, d1, d2, d3) {
            Module.ccall('al_autolod_set_distances', null, ['number', 'number', 'number', 'number'], [d0, d1, d2, d3]);
        },
        getTriangles: function() {
            return Module.ccall('al_autolod_get_triangles', 'number', [], []);
        },
        getBias: function() {
            return Module.ccall('al_autolod_get_bias', 'number', [], []);
        },
        // New functions for enhanced LOD control
        setDistanceScale: function(scale) {
            Module.ccall('al_autolod_set_distance_scale', null, ['number'], [scale]);
        },
        getDistanceScale: function() {
            return Module.ccall('al_autolod_get_distance_scale', 'number', [], []);
        },
        setLevels: function(levels) {
            Module.ccall('al_autolod_set_levels', null, ['number'], [levels]);
        },
        getLevels: function() {
            return Module.ccall('al_autolod_get_levels', 'number', [], []);
        },
        setUnloadDistance: function(distance) {
            Module.ccall('al_autolod_set_unload_distance', null, ['number'], [distance]);
        },
        setUnloadEnabled: function(enabled) {
            Module.ccall('al_autolod_set_unload_enabled', null, ['number'], [enabled ? 1 : 0]);
        }
    };

    // Texture LOD bridge
    window.allolib.textureLOD = {
        setEnabled: function(enabled) {
            Module.ccall('al_texture_lod_set_enabled', null, ['number'], [enabled ? 1 : 0]);
        },
        getEnabled: function() {
            return Module.ccall('al_texture_lod_get_enabled', 'number', [], []) !== 0;
        },
        setBias: function(bias) {
            Module.ccall('al_texture_lod_set_bias', null, ['number'], [bias]);
        },
        getBias: function() {
            return Module.ccall('al_texture_lod_get_bias', 'number', [], []);
        },
        setMaxResolution: function(resolution) {
            Module.ccall('al_texture_lod_set_max_resolution', null, ['number'], [resolution]);
        },
        getMaxResolution: function() {
            return Module.ccall('al_texture_lod_get_max_resolution', 'number', [], []);
        },
        getResolutionForDistance: function(distance) {
            return Module.ccall('al_texture_lod_get_resolution', 'number', ['number'], [distance]);
        },
        getLevelForDistance: function(distance, numLevels) {
            return Module.ccall('al_texture_lod_get_level', 'number', ['number', 'number'], [distance, numLevels || -1]);
        },
        // Continuous LOD methods (Unreal-style mipmap support)
        setReferenceDistance: function(distance) {
            Module.ccall('al_texture_lod_set_reference_distance', null, ['number'], [distance]);
        },
        getReferenceDistance: function() {
            return Module.ccall('al_texture_lod_get_reference_distance', 'number', [], []);
        },
        getContinuousLOD: function(distance, maxMipLevel) {
            return Module.ccall('al_texture_lod_get_continuous', 'number', ['number', 'number'], [distance, maxMipLevel || 12]);
        }
    };

    console.log('[AlloLib] Auto-LOD and Texture LOD JS bridges registered');
});
#endif

namespace al {

// Forward declarations for Emscripten event callbacks
#ifdef __EMSCRIPTEN__
static EM_BOOL keyCallback(int eventType, const EmscriptenKeyboardEvent* e, void* userData);
static EM_BOOL mouseCallback(int eventType, const EmscriptenMouseEvent* e, void* userData);
static EM_BOOL wheelCallback(int eventType, const EmscriptenWheelEvent* e, void* userData);
#endif

WebApp::WebApp() {
#ifdef __EMSCRIPTEN__
    EM_ASM({ console.log('[WebApp] Constructor start'); });
#endif
    // Default navigation position (camera at z=5 looking at origin)
    mNav.pos(0, 0, 5);
#ifdef __EMSCRIPTEN__
    EM_ASM({ console.log('[WebApp] Nav pos set'); });
#endif
    // Initialize viewpoint with nav pose
    initViewpoint();
#ifdef __EMSCRIPTEN__
    EM_ASM({ console.log('[WebApp] Constructor done'); });
#endif
}

WebApp::~WebApp() {
    stop();
    cleanupAudio();
    cleanupBackend();
    cleanupGraphics();
}

void WebApp::configureWebAudio(const WebAudioConfig& config) {
    mAudioConfig = config;
}

void WebApp::configureWebAudio(int sampleRate, int bufferSize, int outputChannels, int inputChannels) {
    mAudioConfig.sampleRate = sampleRate;
    mAudioConfig.bufferSize = bufferSize;
    mAudioConfig.outputChannels = outputChannels;
    mAudioConfig.inputChannels = inputChannels;
}

void WebApp::dimensions(int width, int height) {
    mWidth = width;
    mHeight = height;
}

void WebApp::start() {
    if (mRunning) return;

#ifdef __EMSCRIPTEN__
    EM_ASM({ console.log('[AlloLib] start() called'); });
#endif
    std::cout << "[AlloLib] Starting web application..." << std::endl;

    // Register global AutoLOD for JS bridge
    setGlobalAutoLOD(&mAutoLOD);

    // Register JS bridges
    registerPointSizeJSBridge();
    registerAutoLODJSBridge();

    // Initialize graphics
#ifdef __EMSCRIPTEN__
    EM_ASM({ console.log('[AlloLib] About to call initGraphics()'); });
#endif
    initGraphics();

    // Initialize graphics backend (optional, for WebGPU support)
#ifdef __EMSCRIPTEN__
    EM_ASM({ console.log('[AlloLib] About to call initBackend()'); });
#endif
    initBackend();

    // Initialize audio
#ifdef __EMSCRIPTEN__
    EM_ASM({ console.log('[AlloLib] About to call initAudio()'); });
#endif
    initAudio();

    // Call user's onCreate
#ifdef __EMSCRIPTEN__
    EM_ASM({ console.log('[AlloLib] About to call onCreate()'); });
#endif
    onCreate();

    mRunning = true;

#ifdef __EMSCRIPTEN__
    // Get initial time
    mLastTime = emscripten_get_now() / 1000.0;

    // Register keyboard event handlers
    emscripten_set_keydown_callback(EMSCRIPTEN_EVENT_TARGET_DOCUMENT, this, EM_TRUE, keyCallback);
    emscripten_set_keyup_callback(EMSCRIPTEN_EVENT_TARGET_DOCUMENT, this, EM_TRUE, keyCallback);

    // Register mouse event handlers on canvas
    emscripten_set_mousedown_callback("#canvas", this, EM_TRUE, mouseCallback);
    emscripten_set_mouseup_callback("#canvas", this, EM_TRUE, mouseCallback);
    emscripten_set_mousemove_callback("#canvas", this, EM_TRUE, mouseCallback);
    emscripten_set_wheel_callback("#canvas", this, EM_TRUE, wheelCallback);

    EM_ASM({ console.log('[AlloLib] Input event handlers registered'); });

    // Start Emscripten main loop
    // 0 = use requestAnimationFrame (vsync)
    // 1 = simulate infinite loop (don't return from this function)
    emscripten_set_main_loop_arg(mainLoopCallback, this, 0, 0);

    // Note: Audio worklet is loaded by the JavaScript runtime from the correct path
    // The runtime.ts handles audio context creation and worklet setup
    EM_ASM({
        console.log('[AlloLib] Audio configuration: sampleRate=' + $0 + ', channels=' + $1);
    }, mAudioConfig.sampleRate, mAudioConfig.outputChannels);
#endif

    std::cout << "[AlloLib] Application started" << std::endl;
}

void WebApp::stop() {
    if (!mRunning) return;

    std::cout << "[AlloLib] Stopping application..." << std::endl;

    // Call user's onExit
    onExit();

    mRunning = false;

#ifdef __EMSCRIPTEN__
    emscripten_cancel_main_loop();

    // Remove keyboard event handlers (pass nullptr to unregister)
    emscripten_set_keydown_callback(EMSCRIPTEN_EVENT_TARGET_DOCUMENT, nullptr, EM_TRUE, nullptr);
    emscripten_set_keyup_callback(EMSCRIPTEN_EVENT_TARGET_DOCUMENT, nullptr, EM_TRUE, nullptr);

    // Remove mouse event handlers
    emscripten_set_mousedown_callback("#canvas", nullptr, EM_TRUE, nullptr);
    emscripten_set_mouseup_callback("#canvas", nullptr, EM_TRUE, nullptr);
    emscripten_set_mousemove_callback("#canvas", nullptr, EM_TRUE, nullptr);
    emscripten_set_wheel_callback("#canvas", nullptr, EM_TRUE, nullptr);

    EM_ASM({ console.log('[AlloLib] Input event handlers removed'); });

    // Cleanup audio
    EM_ASM({
        if (window.alloWorkletNode) {
            window.alloWorkletNode.disconnect();
            window.alloWorkletNode = null;
        }
        if (window.alloAudioContext) {
            window.alloAudioContext.suspend();
        }
    });
#endif

    std::cout << "[AlloLib] Application stopped" << std::endl;
}

void WebApp::tick(double dt) {
    // Call user's onAnimate
    onAnimate(dt);

    // Update navigation direction vectors (needed for uf(), ur(), uu())
    mNav.updateDirectionVectors();

    // Update auto-LOD with view parameters
    mAutoLOD.setCameraPos(mNav.pos());
    mAutoLOD.setScreenSize(mWidth, mHeight);
    mAutoLOD.setFOV(mViewpoint.lens().fovy());
    mAutoLOD.setFrameTime(dt);
    mAutoLOD.resetFrameStats();

    // Adaptive quality adjustment based on frame time
    mAutoLOD.adaptQuality();

    // Render graphics
    if (mGraphics) {
        // Set up view matrix from navigation pose
        mGraphics->camera(mNav);

        // Clear the screen
        mGraphics->clear(0.1f, 0.1f, 0.1f);

        // Set point size uniform for WebGL2 (glPointSize doesn't work)
        // This needs to be set on active shaders - done via gl::pointSize storing the value
        // The shader reads al_PointSize uniform which defaults to stored value
        float pointSize = gl::getPointSize();
        if (pointSize > 0.0f) {
            mGraphics->shader().uniform("al_PointSize", pointSize);
        }

        // Call user's onDraw
        onDraw(*mGraphics);
    }
}

void WebApp::mainLoopCallback(void* arg) {
    WebApp* app = static_cast<WebApp*>(arg);

    if (!app || !app->mRunning) return;

#ifdef __EMSCRIPTEN__
    // Calculate delta time
    double now = emscripten_get_now() / 1000.0;
    double dt = now - app->mLastTime;
    app->mLastTime = now;

    // Cap delta time to prevent huge jumps
    if (dt > 0.1) dt = 0.1;

    app->tick(dt);
#endif
}

// Static pointer for event callbacks
static WebApp* gCurrentApp = nullptr;

// Helper classes to access protected members of Keyboard and Mouse
// These are needed because the setters are protected and only accessible to WindowImpl
class KeyboardAccess : public Keyboard {
public:
    void setKey(int k, bool v) { Keyboard::setKey(k, v); }
    void shift(bool state) { Keyboard::shift(state); }
    void ctrl(bool state) { Keyboard::ctrl(state); }
    void alt(bool state) { Keyboard::alt(state); }
};

class MouseAccess : public Mouse {
public:
    void position(int x, int y) { Mouse::position(x, y); }
    void button(int b, bool v) { Mouse::button(b, v); }
    void scroll(double x, double y) { Mouse::scroll(x, y); }
};

#ifdef __EMSCRIPTEN__
// Keyboard event callback
static EM_BOOL keyCallback(int eventType, const EmscriptenKeyboardEvent* e, void* userData) {
    WebApp* app = static_cast<WebApp*>(userData);
    if (!app) {
        EM_ASM({ console.log('[Keyboard] No app!'); });
        return EM_FALSE;
    }

    // Check if user is typing in an input field - if so, don't capture the key event
    bool isTypingInInput = EM_ASM_INT({
        var activeEl = document.activeElement;
        if (!activeEl) return 0;
        var tagName = activeEl.tagName.toLowerCase();
        // Don't capture keys when typing in input, textarea, select, or contenteditable elements
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            return 1;
        }
        if (activeEl.isContentEditable) {
            return 1;
        }
        return 0;
    });

    if (isTypingInInput) {
        // Let the browser handle the key event for the input field
        return EM_FALSE;
    }

    EM_ASM({ console.log('[Keyboard] Event: type=' + $0 + ', key=' + UTF8ToString($1) + ', code=' + UTF8ToString($2)); },
           eventType, e->key, e->code);

    // Create AlloLib Keyboard object using helper class
    KeyboardAccess k;

    // Map key code - use 'key' string for printable characters, 'code' for special keys
    int key = 0;
    if (e->key[0] != '\0' && e->key[1] == '\0') {
        // Single character key
        key = e->key[0];
    } else {
        // Special key - map common ones
        if (strcmp(e->code, "Space") == 0) key = ' ';
        else if (strcmp(e->code, "Enter") == 0) key = 13;
        else if (strcmp(e->code, "Escape") == 0) key = 27;
        else if (strcmp(e->code, "Tab") == 0) key = 9;
        else if (strcmp(e->code, "Backspace") == 0) key = 8;
        else if (strcmp(e->code, "ArrowUp") == 0) key = Keyboard::UP;
        else if (strcmp(e->code, "ArrowDown") == 0) key = Keyboard::DOWN;
        else if (strcmp(e->code, "ArrowLeft") == 0) key = Keyboard::LEFT;
        else if (strcmp(e->code, "ArrowRight") == 0) key = Keyboard::RIGHT;
        else key = e->keyCode;
    }

    // Set key state
    k.setKey(key, eventType == EMSCRIPTEN_EVENT_KEYDOWN);

    // Set modifier states
    k.shift(e->shiftKey);
    k.ctrl(e->ctrlKey);
    k.alt(e->altKey);

    // Call appropriate handler
    bool handled = false;
    if (eventType == EMSCRIPTEN_EVENT_KEYDOWN) {
        EM_ASM({ console.log('[Keyboard] Calling onKeyDown, key code=' + $0); }, key);
        handled = app->onKeyDown(k);
        EM_ASM({ console.log('[Keyboard] onKeyDown returned ' + $0); }, handled ? 1 : 0);
    } else if (eventType == EMSCRIPTEN_EVENT_KEYUP) {
        handled = app->onKeyUp(k);
    }

    return handled ? EM_TRUE : EM_FALSE;
}

// Mouse event callback
static EM_BOOL mouseCallback(int eventType, const EmscriptenMouseEvent* e, void* userData) {
    WebApp* app = static_cast<WebApp*>(userData);
    if (!app) return EM_FALSE;

    MouseAccess m;

    // Set position
    m.position(e->targetX, e->targetY);

    // Set button state based on event type
    bool isDown = (eventType == EMSCRIPTEN_EVENT_MOUSEDOWN);
    int buttonIndex = e->button; // 0=left, 1=middle, 2=right
    m.button(buttonIndex, isDown);

    // Call appropriate handler
    bool handled = false;
    switch (eventType) {
        case EMSCRIPTEN_EVENT_MOUSEDOWN:
            handled = app->onMouseDown(m);
            break;
        case EMSCRIPTEN_EVENT_MOUSEUP:
            handled = app->onMouseUp(m);
            break;
        case EMSCRIPTEN_EVENT_MOUSEMOVE:
            if (e->buttons) {
                handled = app->onMouseDrag(m);
            } else {
                handled = app->onMouseMove(m);
            }
            break;
    }

    return handled ? EM_TRUE : EM_FALSE;
}

// Mouse wheel callback
static EM_BOOL wheelCallback(int eventType, const EmscriptenWheelEvent* e, void* userData) {
    (void)eventType;
    WebApp* app = static_cast<WebApp*>(userData);
    if (!app) return EM_FALSE;

    MouseAccess m;
    m.position(e->mouse.targetX, e->mouse.targetY);
    m.scroll(e->deltaX, e->deltaY);

    return app->onMouseScroll(m) ? EM_TRUE : EM_FALSE;
}
#endif

void WebApp::initGraphics() {
#ifdef __EMSCRIPTEN__
    gCurrentApp = this;

    // Check if we're using WebGPU backend - if so, skip WebGL context creation
    // WebGPU and WebGL contexts are mutually exclusive on the same canvas
    if (mBackendType == BackendType::WebGPU) {
        EM_ASM({ console.log('[AlloLib] initGraphics() - WebGPU mode, skipping WebGL context'); });

        // Don't create WebGL context - WebGPU backend will handle rendering
        mWindow = nullptr;

        // Still create Graphics object but it won't be used for rendering
        // User code may still call g.draw() but it will be a no-op until
        // WebGPU rendering is fully implemented
        mGraphics = std::make_unique<Graphics>();

        // Note: Graphics::init() requires a GL context, so we skip it for WebGPU
        // This means the Graphics object won't be fully functional
        EM_ASM({ console.log('[AlloLib] Graphics object created (WebGPU mode - limited functionality)'); });
        return;
    }

    EM_ASM({ console.log('[AlloLib] initGraphics() - using Emscripten WebGL'); });

    // Create WebGL2 context directly using Emscripten API
    EmscriptenWebGLContextAttributes attrs;
    emscripten_webgl_init_context_attributes(&attrs);
    attrs.majorVersion = 2;  // WebGL2
    attrs.minorVersion = 0;
    attrs.alpha = false;
    attrs.depth = true;
    attrs.stencil = true;
    attrs.antialias = true;
    attrs.premultipliedAlpha = false;
    attrs.preserveDrawingBuffer = true;

    EM_ASM({ console.log('[AlloLib] Creating WebGL2 context on #canvas...'); });

    EMSCRIPTEN_WEBGL_CONTEXT_HANDLE ctx = emscripten_webgl_create_context("#canvas", &attrs);
    if (ctx <= 0) {
        EM_ASM({ console.error('[AlloLib] Failed to create WebGL2 context! Error: ' + $0); }, ctx);
        return;
    }

    EM_ASM({ console.log('[AlloLib] WebGL2 context created: ' + $0); }, ctx);

    EMSCRIPTEN_RESULT res = emscripten_webgl_make_context_current(ctx);
    if (res != EMSCRIPTEN_RESULT_SUCCESS) {
        EM_ASM({ console.error('[AlloLib] Failed to make context current! Error: ' + $0); }, res);
        return;
    }

    EM_ASM({ console.log('[AlloLib] WebGL2 context is current'); });

    // Initialize GLAD with EGL proc address for Emscripten
    EM_ASM({ console.log('[AlloLib] Initializing GLAD with eglGetProcAddress...'); });

    int gladResult = gladLoadGLLoader((void* (*)(const char*))eglGetProcAddress);
    EM_ASM({ console.log('[AlloLib] GLAD loaded: ' + $0); }, gladResult);

    if (!gladResult) {
        EM_ASM({ console.error('[AlloLib] GLAD initialization failed!'); });
        // Continue anyway - some functions might work
    }

    // Don't use AlloLib's Window class for Emscripten
    mWindow = nullptr;

    // Create graphics context
    EM_ASM({ console.log('[AlloLib] Creating AlloLib Graphics object...'); });
    mGraphics = std::make_unique<Graphics>();

    // Initialize Graphics (compiles all default shaders)
    EM_ASM({ console.log('[AlloLib] Initializing Graphics (compiling shaders)...'); });
    mGraphics->init();

    EM_ASM({ console.log('[AlloLib] Graphics initialized successfully!'); });
#else
    // Desktop path - use AlloLib's Window class
    mWindow = std::make_unique<Window>();
    mWindow->dimensions(mWidth, mHeight);
    mWindow->title("AlloLib Web");
    mWindow->create();
    mGraphics = std::make_unique<Graphics>();
#endif
}

void WebApp::initAudio() {
    std::cout << "[AlloLib] Initializing audio..." << std::endl;

    // Clean up any existing audio IO
    if (mAudioIO) {
        delete mAudioIO;
        mAudioIO = nullptr;
    }

    // Set up Gamma DSP sample rate (required for oscillators to work correctly)
    gam::sampleRate(mAudioConfig.sampleRate);

    // Create and configure AudioIOData with proper buffers
    mAudioIO = new AudioIOData();
    mAudioIO->framesPerBuffer(mAudioConfig.bufferSize);
    mAudioIO->framesPerSecond(mAudioConfig.sampleRate);
    mAudioIO->channelsOut(mAudioConfig.outputChannels);
    mAudioIO->channelsIn(mAudioConfig.inputChannels);

    mAudioInitialized = true;

    std::cout << "[AlloLib] Audio initialized with sample rate: " << mAudioConfig.sampleRate << std::endl;
}

void WebApp::cleanupGraphics() {
    mGraphics.reset();
    mWindow.reset();
}

void WebApp::cleanupAudio() {
    mAudioInitialized = false;

    if (mAudioIO) {
        delete mAudioIO;
        mAudioIO = nullptr;
    }
}

void WebApp::initBackend() {
    // Create backend based on configured type and available backends
    switch (mBackendType) {
        case BackendType::WebGPU:
#ifdef __EMSCRIPTEN__
            EM_ASM({ console.log('[AlloLib] Attempting WebGPU backend...'); });
#endif
#if defined(ALLOLIB_WEBGPU)
            if (isWebGPUAvailable()) {
                mBackend = createWebGPUBackend();
            } else {
                std::cout << "[AlloLib] WebGPU not available";
#if defined(ALLOLIB_WEBGL2)
                std::cout << ", falling back to WebGL2" << std::endl;
                mBackend = createWebGL2Backend();
#else
                std::cout << " and WebGL2 not compiled in!" << std::endl;
#endif
            }
#elif defined(ALLOLIB_WEBGL2)
            std::cout << "[AlloLib] WebGPU not compiled in, using WebGL2" << std::endl;
            mBackend = createWebGL2Backend();
#endif
            break;

        case BackendType::Auto:
#ifdef __EMSCRIPTEN__
            EM_ASM({ console.log('[AlloLib] Auto-detecting best backend...'); });
#endif
#if defined(ALLOLIB_WEBGPU)
            if (isWebGPUAvailable()) {
                mBackend = createWebGPUBackend();
            } else {
#if defined(ALLOLIB_WEBGL2)
                mBackend = createWebGL2Backend();
#endif
            }
#elif defined(ALLOLIB_WEBGL2)
            mBackend = createWebGL2Backend();
#endif
            break;

        case BackendType::WebGL2:
        default:
#ifdef __EMSCRIPTEN__
            EM_ASM({ console.log('[AlloLib] Using WebGL2 backend'); });
#endif
#if defined(ALLOLIB_WEBGL2)
            mBackend = createWebGL2Backend();
#elif defined(ALLOLIB_WEBGPU)
            std::cout << "[AlloLib] WebGL2 not compiled in, using WebGPU" << std::endl;
            mBackend = createWebGPUBackend();
#endif
            break;
    }

    // Initialize the backend
    if (mBackend) {
        if (!mBackend->init(mWidth, mHeight)) {
            std::cerr << "[AlloLib] Backend initialization failed!" << std::endl;
            mBackend.reset();
        } else {
            std::cout << "[AlloLib] Backend initialized: " << mBackend->getName() << std::endl;
#ifdef __EMSCRIPTEN__
            EM_ASM({ console.log('[AlloLib] Backend active: ' + UTF8ToString($0)); }, mBackend->getName());
#endif
        }
    }
}

void WebApp::cleanupBackend() {
    if (mBackend) {
        mBackend->shutdown();
        mBackend.reset();
    }
}

static int audioCallCount = 0;

void WebApp::processAudioBuffer(float* outputBuffer, int numFrames, int numChannels) {
#ifdef __EMSCRIPTEN__
    // Debug: log state on first few calls
    if (audioCallCount < 5) {
        EM_ASM({
            console.log('[WASM Audio] processAudioBuffer: mRunning=' + $0 + ', mAudioInit=' + $1 + ', mAudioIO=' + $2);
        }, mRunning ? 1 : 0, mAudioInitialized ? 1 : 0, mAudioIO ? 1 : 0);
    }
#endif

    if (!mRunning || !mAudioInitialized || !mAudioIO) {
        // Fill with silence
        for (int i = 0; i < numFrames * numChannels; ++i) {
            outputBuffer[i] = 0.0f;
        }
#ifdef __EMSCRIPTEN__
        if (audioCallCount < 5) {
            EM_ASM({ console.log('[WASM Audio] Early return - state check failed'); });
        }
#endif
        audioCallCount++;
        return;
    }

#ifdef __EMSCRIPTEN__
    // Debug: log first few calls
    if (audioCallCount < 5) {
        EM_ASM({
            console.log('[WASM Audio] Processing audio: frames=' + $0 + ', channels=' + $1);
        }, numFrames, numChannels);
    }
#endif
    audioCallCount++;

    // Reset frame counter
    mAudioIO->frame(0);

    // Zero the output buffer
    mAudioIO->zeroOut();

    // Call user's audio callback
    onSound(*mAudioIO);

    // Copy from non-interleaved format to interleaved output
    for (int frame = 0; frame < numFrames; ++frame) {
        for (int ch = 0; ch < numChannels; ++ch) {
            outputBuffer[frame * numChannels + ch] = mAudioIO->out(ch, frame);
        }
    }

#ifdef __EMSCRIPTEN__
    // Debug: check if we have non-zero output
    if (audioCallCount <= 5) {
        float maxSample = 0;
        for (int i = 0; i < numFrames * numChannels; ++i) {
            float absVal = outputBuffer[i] > 0 ? outputBuffer[i] : -outputBuffer[i];
            if (absVal > maxSample) maxSample = absVal;
        }
        EM_ASM({
            console.log('[WASM Audio] Max output sample: ' + $0);
        }, maxSample);
    }
#endif
}

void WebApp::setListenerPose(const Pose& pose) {
#ifdef __EMSCRIPTEN__
    // Update spatial audio listener position
    EM_ASM({
        if (window.alloWorkletNode) {
            window.alloWorkletNode.port.postMessage({
                type: 'setListener',
                pos: { x: $0, y: $1, z: $2 },
                quat: { w: $3, x: $4, y: $5, z: $6 }
            });
        }
    }, pose.pos().x, pose.pos().y, pose.pos().z,
       pose.quat().w, pose.quat().x, pose.quat().y, pose.quat().z);
#else
    (void)pose;
#endif
}

} // namespace al

// =========================================================================
// JavaScript bridge function definitions for AutoLOD
// These must be in .cpp file (not header) to avoid duplicate symbols
// =========================================================================
extern "C" {

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_bias(float bias) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setBias(bias);
    }
}

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_enabled(int enabled) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->enable(enabled != 0);
    }
}

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_budget(int budget) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setTriangleBudget(budget);
    }
}

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_mode(int mode) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setSelectionMode(static_cast<al::LODSelectionMode>(mode));
    }
}

EMSCRIPTEN_KEEPALIVE
int al_autolod_get_triangles() {
    return al::gAutoLODInstance ? al::gAutoLODInstance->frameTriangles() : 0;
}

EMSCRIPTEN_KEEPALIVE
float al_autolod_get_bias() {
    return al::gAutoLODInstance ? al::gAutoLODInstance->bias() : 1.0f;
}

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_min_full_quality_distance(float distance) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setMinFullQualityDistance(distance);
    }
}

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_distances(float d0, float d1, float d2, float d3) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setDistances({d0, d1, d2, d3});
    }
}

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_distance_scale(float scale) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setDistanceScale(scale);
    }
}

EMSCRIPTEN_KEEPALIVE
float al_autolod_get_distance_scale() {
    return al::gAutoLODInstance ? al::gAutoLODInstance->distanceScale() : 1.0f;
}

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_levels(int levels) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setLevels(levels);
    }
}

EMSCRIPTEN_KEEPALIVE
int al_autolod_get_levels() {
    return al::gAutoLODInstance ? al::gAutoLODInstance->levels() : 4;
}

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_unload_distance(float distance) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setUnloadDistance(distance);
    }
}

EMSCRIPTEN_KEEPALIVE
void al_autolod_set_unload_enabled(int enabled) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setUnloadEnabled(enabled != 0);
    }
}

// =========================================================================
// Texture LOD bridge functions
// =========================================================================

EMSCRIPTEN_KEEPALIVE
void al_texture_lod_set_enabled(int enabled) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setTextureLODEnabled(enabled != 0);
    }
}

EMSCRIPTEN_KEEPALIVE
int al_texture_lod_get_enabled() {
    return (al::gAutoLODInstance && al::gAutoLODInstance->textureLODEnabled()) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
void al_texture_lod_set_bias(float bias) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setTextureLODBias(bias);
    }
}

EMSCRIPTEN_KEEPALIVE
float al_texture_lod_get_bias() {
    return al::gAutoLODInstance ? al::gAutoLODInstance->textureLODBias() : 1.0f;
}

EMSCRIPTEN_KEEPALIVE
void al_texture_lod_set_max_resolution(int resolution) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setMaxTextureResolution(resolution);
    }
}

EMSCRIPTEN_KEEPALIVE
int al_texture_lod_get_max_resolution() {
    return al::gAutoLODInstance ? al::gAutoLODInstance->maxTextureResolution() : 4096;
}

EMSCRIPTEN_KEEPALIVE
int al_texture_lod_get_resolution(float distance) {
    return al::gAutoLODInstance ? al::gAutoLODInstance->getTextureResolution(distance) : 4096;
}

EMSCRIPTEN_KEEPALIVE
int al_texture_lod_get_level(float distance, int numLevels) {
    return al::gAutoLODInstance ? al::gAutoLODInstance->getTextureLODLevel(distance, numLevels) : 0;
}

// Continuous texture LOD functions (mipmap support)

EMSCRIPTEN_KEEPALIVE
void al_texture_lod_set_reference_distance(float distance) {
    if (al::gAutoLODInstance) {
        al::gAutoLODInstance->setTextureReferenceDistance(distance);
    }
}

EMSCRIPTEN_KEEPALIVE
float al_texture_lod_get_reference_distance() {
    return al::gAutoLODInstance ? al::gAutoLODInstance->textureReferenceDistance() : 5.0f;
}

EMSCRIPTEN_KEEPALIVE
float al_texture_lod_get_continuous(float distance, int maxMipLevel) {
    return al::gAutoLODInstance ? al::gAutoLODInstance->getContinuousTextureLOD(distance, maxMipLevel) : 0.0f;
}

} // extern "C"
