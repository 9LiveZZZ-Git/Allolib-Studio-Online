/**
 * AlloLib Playground Compatibility Header
 *
 * Provides compatibility shims for allolib_playground tutorials
 * when running in AlloLib Studio Online (WASM/browser).
 *
 * WASM builds (Emscripten):
 * - ImGui is stubbed (draws nothing, Vue ParameterPanel handles UI)
 * - ControlGUI maps to WebControlGUI (web-based parameter panel)
 * - ParameterGUI is stubbed (no-op)
 * - PresetHandler is stubbed (use Vue preset manager)
 * - MIDI is stubbed (future: use Web MIDI API)
 *
 * Native builds (when exported):
 * - Real allolib headers are included (ControlGUI, ParameterGUI, etc.)
 * - ImGui-based UI works normally
 * - Full file system access for presets
 * - RtMidi for MIDI support
 *
 * Available in both:
 * - Parameter, ParameterInt, ParameterBool, etc.
 * - Light class, Shader, Texture, FBO
 * - PolySynth, SynthSequencer, SynthVoice
 * - SynthGUIManager (simplified for WASM, full for native)
 *
 * Usage:
 *   #include "al_playground_compat.hpp"
 *
 *   class MyApp : public App {
 *       // Works in both WASM and native
 *       SynthGUIManager<MySynth> synthManager{"name"};
 *       ControlGUI gui;  // WebControlGUI in WASM, real ControlGUI in native
 *   };
 */

#ifndef AL_PLAYGROUND_COMPAT_HPP
#define AL_PLAYGROUND_COMPAT_HPP

#include "al_compat.hpp"
#include "al/scene/al_PolySynth.hpp"
#include "al/scene/al_SynthSequencer.hpp"
#include "al/scene/al_SynthRecorder.hpp"
#include "al/ui/al_Parameter.hpp"
#include "al/ui/al_ParameterBundle.hpp"
#include "al/graphics/al_Light.hpp"
#include "al/math/al_Random.hpp"

// Gamma DSP library for sample rate configuration
#include "Gamma/Domain.h"

// Standard library
#include <cmath>
#include <memory>

// ============================================================================
// Platform-specific includes
// ============================================================================

#ifdef __EMSCRIPTEN__
// WASM builds: Include web-based parameter GUI and sequencer bridge
#include "al_WebControlGUI.hpp"
#include "al_WebSequencerBridge.hpp"
#else
// Native builds: Include real ImGui-based classes from allolib
// These are the actual implementations that use Dear ImGui
#include "al/ui/al_ControlGUI.hpp"
#include "al/ui/al_ParameterGUI.hpp"
#include "al/ui/al_PresetHandler.hpp"
#include "al/ui/al_PresetSequencer.hpp"
#include "al/ui/al_ParameterMIDI.hpp"
#endif

// ============================================================================
// ImGui Stubs (for WASM only - not available in browser)
// ============================================================================

#ifdef __EMSCRIPTEN__

// Stub out ImGui functions - they do nothing in WASM
inline void imguiInit() {}
inline void imguiBeginFrame() {}
inline void imguiEndFrame() {}
inline void imguiDraw() {}
inline void imguiShutdown() {}

// ParameterGUI stub - provides interface but does nothing
namespace al {

class ParameterGUI {
public:
    static bool usingKeyboard() { return false; }
    static void drawParameterMIDI(void*) {}

    // Draw functions - no-ops in WASM
    static void draw(ParameterMeta*) {}
    static void draw(ParameterMeta&) {}
    static void drawParameterMeta(ParameterMeta*, const char* = nullptr) {}
    static void drawParameter(Parameter*, const char* = nullptr) {}
    static void drawParameterInt(ParameterInt*, const char* = nullptr) {}
    static void drawParameterBool(ParameterBool*, const char* = nullptr) {}
    static void drawParameterString(ParameterString*, const char* = nullptr) {}
    static void drawMenu(ParameterMenu*, const char* = nullptr) {}
    static void drawChoice(ParameterChoice*, const char* = nullptr) {}
    static void drawVec3(ParameterVec3*, const char* = nullptr) {}
    static void drawVec4(ParameterVec4*, const char* = nullptr) {}
    static void drawColor(ParameterColor*, const char* = nullptr) {}
    static void drawTrigger(Trigger*, const char* = nullptr) {}

    template<typename T>
    static void drawFields(T*) {}
};

} // namespace al

// ============================================================================
// ControlGUI - Alias to WebControlGUI for WASM builds
// ============================================================================

namespace al {

// ControlGUI is an alias for WebControlGUI in web builds
// This allows existing code using ControlGUI to work with our web-based panel
using ControlGUI = WebControlGUI;

} // namespace al

// ============================================================================
// PresetHandler Stub (uses file system - localStorage in future)
// ============================================================================

namespace al {

class PresetHandler {
public:
    PresetHandler(std::string = "presets", bool = false) {}
    PresetHandler(TimeMasterMode, std::string = "presets", bool = false) {}
    ~PresetHandler() = default;

    // Store presets - no-op for now
    void storePreset(std::string) {}
    void storePreset(int, std::string = "", bool = true) {}

    // Recall presets - no-op for now
    void recallPreset(std::string) {}
    void recallPreset(int) {}
    void recallPresetSynchronous(std::string) {}
    void recallPresetSynchronous(int) {}

    // Morphing
    void setMorphTime(float) {}
    float getMorphTime() const { return 0.0f; }
    void morphTo(std::string, float) {}
    void morphTo(int, float) {}
    void stopMorph() {}

    // Registration
    PresetHandler& registerParameter(ParameterMeta&) { return *this; }
    PresetHandler& operator<<(ParameterMeta&) { return *this; }
    PresetHandler& registerParameterBundle(ParameterBundle&) { return *this; }
    PresetHandler& operator<<(ParameterBundle&) { return *this; }

    // Paths
    void setRootPath(std::string) {}
    std::string getRootPath() const { return ""; }
    void setSubDirectory(std::string) {}
    std::string getSubDirectory() const { return ""; }
    std::string getCurrentPath() const { return ""; }

    // Preset listing
    std::vector<std::string> availablePresets() const { return {}; }
    std::vector<std::string> availablePresetMaps() const { return {}; }
    int getCurrentPresetIndex() const { return 0; }
    std::string getCurrentPresetName() const { return ""; }

    // Callbacks
    void registerPresetCallback(std::function<void(int, void*)>, void* = nullptr) {}
    void registerMorphTimeCallback(std::function<void(float, void*)>, void* = nullptr) {}

    // Verbose
    void verbose(bool) {}
};

} // namespace al

// ============================================================================
// ParameterMIDI Stub (uses RtMidi - not available in WASM)
// Future: Could use Web MIDI API
// ============================================================================

namespace al {

class ParameterMIDI {
public:
    ParameterMIDI() = default;
    ParameterMIDI(unsigned int, bool = false) {}

    void open(unsigned int = 0) {}
    void open(int, bool) {}
    void init(int = 0, bool = false) {}
    void close() {}

    void connectControl(Parameter&, int, int) {}
    void connectControl(Parameter&, int, int, float, float) {}
    void connectControls(ParameterMeta&, std::vector<int>, int = 1,
                        std::vector<float> = {}, std::vector<float> = {}) {}

    void connectNoteToValue(Parameter&, int, float, int, float = -1, int = -1) {}
    void connectNoteToToggle(ParameterBool&, int, int) {}
    void connectNoteToIncrement(Parameter&, int, int, float) {}

    bool isOpen() { return false; }
};

} // namespace al

// ============================================================================
// PresetSequencer Stub (uses file system)
// ============================================================================

namespace al {

class PresetSequencer {
public:
    PresetSequencer(TimeMasterMode = TimeMasterMode::TIME_MASTER_CPU) {}

    void playSequence(const std::string&, double = 0.0) {}
    void stopSequence() {}
    bool running() const { return false; }

    PresetSequencer& registerPresetHandler(PresetHandler&) { return *this; }
    PresetSequencer& operator<<(PresetHandler&) { return *this; }

    void setDirectory(const std::string&) {}
    std::string getDirectory() const { return ""; }

    std::vector<std::string> getSequenceList() const { return {}; }
};

} // namespace al

#endif // __EMSCRIPTEN__

// ============================================================================
// SynthGUIManager Shim
// ============================================================================

namespace al {

/**
 * SynthGUIManager - manages polyphonic synths with voice allocation
 *
 * In WASM builds, this is a simplified version that works without ImGui.
 * It provides full voice management and triggering capabilities.
 *
 * Parameters registered via createInternalTriggerParameter() in the voice's
 * init() are automatically exposed to the web UI through WebControlGUI.
 * A dedicated "control voice" holds the template parameter values that are
 * displayed in the browser's parameter panel and copied to each triggered voice.
 */
template <class TSynthVoice>
class SynthGUIManager {
public:
    // Use TIME_MASTER_FREE to avoid threading issues in WASM
    SynthGUIManager(const std::string& name = "")
        : mName(name),
          mPolySynth(TimeMasterMode::TIME_MASTER_FREE),
          mSequencer(TimeMasterMode::TIME_MASTER_FREE) {
#ifdef __EMSCRIPTEN__
        EM_ASM({ console.log('[SynthGUIManager] Constructor start'); });
#endif
        // IMPORTANT: Set Gamma sample rate BEFORE allocating voices
        // This ensures oscillators are initialized with the correct sample rate
        gam::sampleRate(44100);

        // Initialize the control voice — this runs init() which calls
        // createInternalTriggerParameter(), populating mControlVoice's
        // trigger parameter list
        mControlVoice.init();

#ifdef __EMSCRIPTEN__
        EM_ASM({ console.log('[SynthGUIManager] Control voice initialized with %d trigger parameters'); },
               (int)mControlVoice.triggerParameters().size());

        // NOTE: We do NOT register trigger parameters with WebControlGUI here.
        // Trigger parameters are for per-voice control during sequencing, not for
        // the main UI panel. The app should register its own ControlGUI parameters
        // (e.g., gui << amplitude << attackTime) which control the values used
        // when triggering new voices.
        //
        // This avoids duplicate parameters in the UI panel - one set from the
        // voice's createInternalTriggerParameter() and one from the app's ControlGUI.
#endif

        // Pre-allocate voices
        for (int i = 0; i < 16; ++i) {
            mPolySynth.allocateVoice<TSynthVoice>();
        }
#ifdef __EMSCRIPTEN__
        // Register with WebSequencerBridge for JS-driven voice triggering
        WebSequencerBridge::setPolySynth(&mPolySynth);
        WebSequencerBridge::setControlParameters(mControlVoice.triggerParameters());
        EM_ASM({ console.log('[SynthGUIManager] WebSequencerBridge registered with %d control params'); },
               (int)mControlVoice.triggerParameters().size());

        EM_ASM({ console.log('[SynthGUIManager] Constructor done, voices allocated'); });
#endif
    }

    // Get the underlying PolySynth
    PolySynth& synth() { return mPolySynth; }
    SynthSequencer& synthSequencer() { return mSequencer; }

    /**
     * Get the control voice for parameter configuration.
     *
     * Returns the control voice (template voice) whose parameters are
     * displayed in the web UI panel. Setting parameter values on this
     * voice updates the UI sliders and determines the initial values
     * for the next triggerOn() call.
     *
     * This matches native AlloLib behavior where voice() returns the
     * control voice used for ImGui parameter display.
     */
    TSynthVoice* voice() {
        return &mControlVoice;
    }

    /**
     * Trigger a new voice with the current control voice parameters.
     *
     * Allocates a voice from the pool, copies all trigger parameter
     * values from the control voice to it, and triggers it.
     */
    void triggerOn(int id = 0) {
        TSynthVoice* v = mPolySynth.getVoice<TSynthVoice>();
#ifdef __EMSCRIPTEN__
        EM_ASM({ console.log('[SynthGUIManager] triggerOn(%d), voice: %s'); },
               id, v ? 1 : 0);
#endif
        if (v) {
            // Copy trigger parameters from control voice to pool voice
            configureVoiceFromGui(v);
            v->id(id);
            mPolySynth.triggerOn(v);
            mLastVoice = v;
        } else {
#ifdef __EMSCRIPTEN__
            EM_ASM({ console.log('[SynthGUIManager] ERROR: No voice available!'); });
#endif
        }
    }

    void triggerOff(int id = 0) {
        mPolySynth.triggerOff(id);
    }

    // Render audio and graphics
    void render(AudioIOData& io) {
        // In TIME_MASTER_FREE mode, we must manually process voices
        // This moves voices from the insert queue to the active list
        mPolySynth.processVoices();
        mPolySynth.processVoiceTurnOff();

        mSequencer.render(io);
        mPolySynth.render(io);

        // Also process inactive voices to free them after they're done
        mPolySynth.processInactiveVoices();

#ifdef __EMSCRIPTEN__
        // Sync control voice parameter values to WebControlGUI
        // (handles UI slider changes reflected back to C++)
        auto* gui = WebControlGUI::getActiveInstance();
        if (gui) {
            gui->draw(); // Calls syncParametersToJS()
        }
#endif
    }

    void render(Graphics& g) {
        mSequencer.render(g);
        mPolySynth.render(g);
    }

    // GUI functions - no-ops in WASM (Vue handles rendering)
    void drawSynthControlPanel() {}
    void drawSynthWidgets() {}

    // Preset functions - stubs for now
    void recallPreset(int) {}
    void storePreset(int) {}

    // Recorder access
    SynthRecorder& synthRecorder() { return mRecorder; }

private:
    /**
     * Copy trigger parameter values from the control voice to a pool voice.
     * Both voices have the same parameters (created by init()), so we
     * iterate by index and copy float values.
     */
    void configureVoiceFromGui(TSynthVoice* voice) {
        auto ctrlParams = mControlVoice.triggerParameters();
        auto voiceParams = voice->triggerParameters();
        for (size_t i = 0; i < ctrlParams.size() && i < voiceParams.size(); i++) {
            auto* src = dynamic_cast<Parameter*>(ctrlParams[i]);
            auto* dst = dynamic_cast<Parameter*>(voiceParams[i]);
            if (src && dst) {
                dst->set(src->get());
            }
        }
    }

    std::string mName;
    PolySynth mPolySynth;
    SynthSequencer mSequencer;
    SynthRecorder mRecorder;
    TSynthVoice mControlVoice;       // Template voice for UI parameter display
    SynthVoice* mLastVoice = nullptr;
};

} // namespace al

// ============================================================================
// MIDI Keyboard Mapping
// Note: allolib provides asciiToMIDI() in al/scene/al_PolySynth.hpp
// ============================================================================

namespace al {

// ASCII to index (0-9 for presets)
inline int asciiToIndex(int key) {
    if (key >= '0' && key <= '9') {
        return key - '0';
    }
    return -1;
}

} // namespace al

// ============================================================================
// Navigation Control Stub
// ============================================================================

namespace al {

// NavControl stub - navigation is handled differently in WASM
class NavControl {
public:
    void active(bool) {}
    bool active() const { return false; }
};

} // namespace al

#endif // AL_PLAYGROUND_COMPAT_HPP
