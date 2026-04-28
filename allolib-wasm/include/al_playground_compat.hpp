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
#ifndef __EMSCRIPTEN__
// SynthRecorder uses fstream / native file I/O — excluded from WASM builds.
// A WASM-compatible stub is provided below under #ifdef __EMSCRIPTEN__.
#include "al/scene/al_SynthRecorder.hpp"
#endif
#include "al/ui/al_Parameter.hpp"
#include "al/ui/al_ParameterBundle.hpp"
#include "al/graphics/al_Light.hpp"
#include "al/math/al_Random.hpp"

// Gamma DSP library for sample rate configuration
#include "Gamma/Domain.h"

// Ensure Gamma sample rate is synchronized when audio is configured
// WebApp calls this automatically via _allolib_configure_audio
inline void gammaSetSampleRate(int sr) {
    gam::sampleRate((double)sr);
}

// Standard library
#include <cmath>
#include <memory>

// ============================================================================
// Platform-specific includes
// ============================================================================

#ifdef __EMSCRIPTEN__
// WASM builds: Include web-based parameter GUI, sequencer bridge, and MIDI
#include <emscripten.h>
#include <nlohmann/json.hpp>
#include "al/types/al_VariantValue.hpp"
#include "al_WebControlGUI.hpp"
#include "al_WebSequencerBridge.hpp"
#include "al_WebMIDI.hpp"
#include "al_WebFile.hpp"
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
// PresetHandler — full ParameterMeta::getFields/setFields round-trip
// ============================================================================
//
// Serializes registered parameters via the same VariantValue field schema
// upstream uses (al_Parameter.hpp), so every parameter type round-trips:
// Parameter (float), ParameterInt, ParameterBool, ParameterString,
// ParameterMenu, ParameterChoice, ParameterVec3/Vec4, ParameterColor,
// ParameterPose, Trigger.
//
// Storage: JSON-per-preset in localStorage under key
//   `allolib_preset_<rootDir>_<presetName>`
// JSON shape: { "param.name": <scalar OR array of scalars> }
//
// morphTo(name, time) snapshots the current field set, loads the target
// without applying, and walks the interpolation each tick(dt) call. The
// playground compat tick is invoked from WebApp::tickAudio so morphing
// runs at audio rate (configurable later).

// Hook installed in al_WebApp.cpp; PresetHandler points it at tickAll on
// first construction so morph interpolation runs once per frame from
// WebApp::tick(dt), without users needing to plumb a tick call themselves.
extern void (*gPlaygroundAnimateHook)(double dt);

namespace al {

class PresetHandler {
public:
    PresetHandler(std::string name = "presets", bool = false) : mName(name) {
        registerForTick();
    }
    PresetHandler(TimeMasterMode, std::string name = "presets", bool = false) : mName(name) {
        registerForTick();
    }
    ~PresetHandler() {
        auto& v = activeHandlers();
        v.erase(std::remove(v.begin(), v.end(), this), v.end());
    }

    // ── Registration ──────────────────────────────────────────────────────
    PresetHandler& registerParameter(ParameterMeta& p) {
        mParams.push_back(&p);
        return *this;
    }
    PresetHandler& operator<<(ParameterMeta& p) { return registerParameter(p); }
    PresetHandler& registerParameterBundle(ParameterBundle&) { return *this; }  // bundles not fully supported yet
    PresetHandler& operator<<(ParameterBundle& b) { return registerParameterBundle(b); }

    // ── Store / recall ────────────────────────────────────────────────────
    void storePreset(std::string name) {
        nlohmann::json root = nlohmann::json::object();
        for (auto* p : mParams) {
            std::vector<VariantValue> fields;
            p->getFields(fields);
            root[p->getName()] = serializeFields(fields);
        }
        std::string s = root.dump();
        EM_ASM({
            try {
                localStorage.setItem('allolib_preset_' + UTF8ToString($0) + '_' + UTF8ToString($1), UTF8ToString($2));
            } catch(e) { console.warn('[PresetHandler] localStorage full', e); }
        }, mName.c_str(), name.c_str(), s.c_str());
        mCurrentPreset = name;
    }
    void storePreset(int index, std::string name = "", bool = true) {
        if (name.empty()) name = std::to_string(index);
        storePreset(name);
    }

    void recallPreset(std::string name) {
        nlohmann::json root;
        if (!loadPresetJson(name, root)) return;
        for (auto* p : mParams) {
            auto it = root.find(p->getName());
            if (it == root.end()) continue;
            std::vector<VariantValue> fields;
            p->getFields(fields);  // get type schema for the parameter
            applyJsonToFields(*it, fields);
            p->setFields(fields);
        }
        mCurrentPreset = name;
        mMorphElapsed = mMorphDuration;  // cancel any in-flight morph
    }
    void recallPreset(int index) { recallPreset(std::to_string(index)); }
    void recallPresetSynchronous(std::string name) { recallPreset(name); }
    void recallPresetSynchronous(int index) { recallPreset(index); }

    // ── Morph ─────────────────────────────────────────────────────────────
    // Same semantics as native: snapshot current values and interpolate
    // toward the target preset over `morphTime` seconds. Numeric fields
    // are linearly interpolated; non-numeric (string/bool) snap at the
    // midpoint. Caller must invoke tick(dt) periodically for the morph
    // to advance (we tick from the audio loop in WebApp).
    void recallPreset(std::string name, float morphTime) {
        if (morphTime <= 0.0f) { recallPreset(name); return; }
        nlohmann::json root;
        if (!loadPresetJson(name, root)) return;
        mMorphFromFields.clear();
        mMorphToFields.clear();
        mMorphParams.clear();
        for (auto* p : mParams) {
            auto it = root.find(p->getName());
            if (it == root.end()) continue;
            std::vector<VariantValue> fromF, toF;
            p->getFields(fromF);
            toF = fromF;  // copy schema
            applyJsonToFields(*it, toF);
            mMorphParams.push_back(p);
            mMorphFromFields.push_back(std::move(fromF));
            mMorphToFields.push_back(std::move(toF));
        }
        mMorphDuration = morphTime;
        mMorphElapsed  = 0.0f;
        mCurrentPreset = name;
    }
    void recallPreset(int i, float morphTime) { recallPreset(std::to_string(i), morphTime); }

    void setMorphTime(float t) { mMorphTime = t; }
    float getMorphTime() const { return mMorphTime; }
    void morphTo(std::string name, float t) { recallPreset(name, t); }
    void morphTo(int i, float t)            { recallPreset(i, t); }
    void stopMorph() { mMorphElapsed = mMorphDuration; }

    // Advance the active morph by dt seconds. Safe to call when no morph
    // is in progress (no-op).
    void tick(float dt) {
        if (mMorphElapsed >= mMorphDuration) return;
        mMorphElapsed += dt;
        float t = mMorphElapsed / mMorphDuration;
        if (t >= 1.0f) t = 1.0f;
        for (size_t i = 0; i < mMorphParams.size(); ++i) {
            std::vector<VariantValue> blended = mMorphFromFields[i];
            for (size_t k = 0; k < blended.size() && k < mMorphToFields[i].size(); ++k) {
                blended[k] = lerpVariant(mMorphFromFields[i][k], mMorphToFields[i][k], t);
            }
            mMorphParams[i]->setFields(blended);
        }
    }

    // ── Paths / metadata ──────────────────────────────────────────────────
    void setRootPath(std::string) {}
    std::string getRootPath() const { return ""; }
    void setSubDirectory(std::string) {}
    std::string getSubDirectory() const { return ""; }
    std::string getCurrentPath() const { return ""; }

    std::vector<std::string> availablePresets() const {
        std::vector<std::string> result;
        char* listPtr = (char*)EM_ASM_PTR({
            var prefix = 'allolib_preset_' + UTF8ToString($0) + '_';
            var keys = [];
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(prefix) === 0) keys.push(k.substring(prefix.length));
            }
            var s = keys.join(',');
            var lengthBytes = lengthBytesUTF8(s) + 1;
            var ptr = _malloc(lengthBytes);
            stringToUTF8(s, ptr, lengthBytes);
            return ptr;
        }, mName.c_str());
        if (listPtr) {
            std::string list(listPtr);
            free(listPtr);
            size_t start = 0;
            while (start < list.size()) {
                size_t end = list.find(',', start);
                if (end == std::string::npos) end = list.size();
                if (end > start) result.push_back(list.substr(start, end - start));
                start = end + 1;
            }
        }
        return result;
    }
    std::vector<std::string> availablePresetMaps() const { return {}; }
    int getCurrentPresetIndex() const { return 0; }
    std::string getCurrentPresetName() const { return mCurrentPreset; }

    // ── Callbacks (no-op for now; future: dispatch on store/recall) ───────
    void registerPresetCallback(std::function<void(int, void*)>, void* = nullptr) {}
    void registerMorphTimeCallback(std::function<void(float, void*)>, void* = nullptr) {}

    void verbose(bool) {}

private:
    // ── Helpers ───────────────────────────────────────────────────────────
    static nlohmann::json variantToJson(const VariantValue& v) {
        switch (v.type()) {
            case VariantType::VARIANT_FLOAT:  return v.get<float>();
            case VariantType::VARIANT_DOUBLE: return v.get<double>();
            case VariantType::VARIANT_INT8:   return v.get<int8_t>();
            case VariantType::VARIANT_INT16:  return v.get<int16_t>();
            case VariantType::VARIANT_INT32:  return v.get<int32_t>();
            case VariantType::VARIANT_INT64:  return v.get<int64_t>();
            case VariantType::VARIANT_UINT8:  return v.get<uint8_t>();
            case VariantType::VARIANT_UINT16: return v.get<uint16_t>();
            case VariantType::VARIANT_UINT32: return v.get<uint32_t>();
            case VariantType::VARIANT_UINT64: return v.get<uint64_t>();
            case VariantType::VARIANT_BOOL:   return v.get<bool>();
            case VariantType::VARIANT_STRING: return v.get<std::string>();
            case VariantType::VARIANT_CHAR:   return std::string(1, v.get<char>());
            default: return nullptr;
        }
    }

    static nlohmann::json serializeFields(const std::vector<VariantValue>& fields) {
        if (fields.size() == 1) return variantToJson(fields[0]);
        nlohmann::json arr = nlohmann::json::array();
        for (auto& f : fields) arr.push_back(variantToJson(f));
        return arr;
    }

    static VariantValue jsonToVariantOfType(const nlohmann::json& j, VariantType t) {
        switch (t) {
            case VariantType::VARIANT_FLOAT:
                return VariantValue(j.is_number() ? j.get<float>() : 0.0f);
            case VariantType::VARIANT_DOUBLE:
                return VariantValue(j.is_number() ? j.get<double>() : 0.0);
            case VariantType::VARIANT_INT32:
                return VariantValue(j.is_number() ? j.get<int32_t>() : (int32_t)0);
            case VariantType::VARIANT_INT64:
                return VariantValue(j.is_number() ? j.get<int64_t>() : (int64_t)0);
            case VariantType::VARIANT_BOOL:
                return VariantValue(j.is_boolean() ? j.get<bool>() : (j.is_number() && j.get<int>() != 0));
            case VariantType::VARIANT_STRING:
                return VariantValue(j.is_string() ? j.get<std::string>() : std::string());
            default:
                return j.is_number() ? VariantValue((float)j.get<double>()) : VariantValue();
        }
    }

    // Replace each entry in `fields` with the corresponding JSON value,
    // preserving the original VariantType (so setFields gets the right
    // schema even if JSON loses precision/type info).
    static void applyJsonToFields(const nlohmann::json& v, std::vector<VariantValue>& fields) {
        if (v.is_array()) {
            size_t n = std::min(fields.size(), v.size());
            for (size_t i = 0; i < n; ++i) {
                fields[i] = jsonToVariantOfType(v[i], fields[i].type());
            }
        } else if (!fields.empty()) {
            fields[0] = jsonToVariantOfType(v, fields[0].type());
        }
    }

    bool loadPresetJson(const std::string& name, nlohmann::json& out) const {
        char* jsonPtr = (char*)EM_ASM_PTR({
            var v = localStorage.getItem('allolib_preset_' + UTF8ToString($0) + '_' + UTF8ToString($1));
            if (!v) return 0;
            var lengthBytes = lengthBytesUTF8(v) + 1;
            var ptr = _malloc(lengthBytes);
            stringToUTF8(v, ptr, lengthBytes);
            return ptr;
        }, mName.c_str(), name.c_str());
        if (!jsonPtr) return false;
        std::string json(jsonPtr);
        free(jsonPtr);
        out = nlohmann::json::parse(json, nullptr, /*allow_exceptions=*/false);
        return !out.is_discarded();
    }

    static VariantValue lerpVariant(const VariantValue& a, const VariantValue& b, float t) {
        switch (a.type()) {
            case VariantType::VARIANT_FLOAT:
                return VariantValue(a.get<float>() + (b.get<float>() - a.get<float>()) * t);
            case VariantType::VARIANT_DOUBLE:
                return VariantValue(a.get<double>() + (b.get<double>() - a.get<double>()) * (double)t);
            case VariantType::VARIANT_INT32:
                return VariantValue((int32_t)(a.get<int32_t>() + (int32_t)((b.get<int32_t>() - a.get<int32_t>()) * t)));
            case VariantType::VARIANT_INT64:
                return VariantValue((int64_t)(a.get<int64_t>() + (int64_t)((b.get<int64_t>() - a.get<int64_t>()) * t)));
            // Non-numeric: snap at the midpoint.
            default:
                return t < 0.5f ? a : b;
        }
    }

    std::string mName;
    std::string mCurrentPreset;
    std::vector<ParameterMeta*> mParams;
    float mMorphTime = 0.0f;

    // Active morph state
    float mMorphDuration = 0.0f;
    float mMorphElapsed  = 0.0f;
    std::vector<ParameterMeta*>           mMorphParams;
    std::vector<std::vector<VariantValue>> mMorphFromFields;
    std::vector<std::vector<VariantValue>> mMorphToFields;

    // Static auto-tick registry — wired into WebApp::tick via the
    // gPlaygroundAnimateHook function pointer at first construction.
    static std::vector<PresetHandler*>& activeHandlers() {
        static std::vector<PresetHandler*> v;
        return v;
    }
    static void tickAllFromAnimate(double dt) {
        for (auto* h : activeHandlers()) h->tick((float)dt);
    }
    void registerForTick() {
        if (gPlaygroundAnimateHook == nullptr) {
            gPlaygroundAnimateHook = &PresetHandler::tickAllFromAnimate;
        }
        activeHandlers().push_back(this);
    }
};

} // namespace al

// ============================================================================
// ParameterMIDI - bridged to WebMIDI for CC / note control in the browser
// ============================================================================

namespace al {

class ParameterMIDI {
public:
    ParameterMIDI() = default;
    ParameterMIDI(unsigned int port, bool = false) { open(port); }

    void open(unsigned int = 0) {
        if (!mMidi) mMidi = std::make_unique<WebMIDI>();
        mMidi->open();
        mMidi->setCCCallback([this](int channel, int cc, int value) {
            handleCC(channel, cc, value);
        });
        mMidi->setNoteOnCallback([this](int channel, int note, int velocity) {
            handleNote(channel, note, velocity, true);
        });
        mMidi->setNoteOffCallback([this](int channel, int note, int velocity) {
            handleNote(channel, note, velocity, false);
        });
    }
    void open(int port, bool) { open((unsigned int)port); }
    void init(int port = 0, bool = false) { open((unsigned int)port); }
    void close() { if (mMidi) mMidi->close(); }

    void connectControl(Parameter& p, int cc, int channel) {
        mCCBindings.push_back({&p, cc, channel, p.min(), p.max()});
    }
    void connectControl(Parameter& p, int cc, int channel, float min, float max) {
        mCCBindings.push_back({&p, cc, channel, min, max});
    }
    void connectControls(ParameterMeta&, std::vector<int>, int = 1,
                         std::vector<float> = {}, std::vector<float> = {}) {}

    void connectNoteToValue(Parameter& p, int channel, float value, int note, float = -1, int = -1) {
        mNoteBindings.push_back({&p, note, channel, value, false});
    }
    void connectNoteToToggle(ParameterBool&, int, int) {}
    void connectNoteToIncrement(Parameter& p, int channel, int note, float increment) {
        mNoteBindings.push_back({&p, note, channel, increment, true});
    }

    bool isOpen() { return mMidi && mMidi->isOpen(); }

private:
    struct CCBinding {
        Parameter* param;
        int cc;
        int channel;   // 0 = all, 1-16 specific
        float min, max;
    };
    struct NoteBinding {
        Parameter* param;
        int note;
        int channel;
        float value;
        bool increment;
    };

    void handleCC(int channel, int cc, int value) {
        for (auto& b : mCCBindings) {
            if ((b.channel == 0 || b.channel == channel) && b.cc == cc) {
                float normalized = value / 127.0f;
                float scaled = b.min + normalized * (b.max - b.min);
                b.param->set(scaled);
            }
        }
    }
    void handleNote(int channel, int note, int /*vel*/, bool on) {
        if (!on) return;
        for (auto& b : mNoteBindings) {
            if ((b.channel == 0 || b.channel == channel) && b.note == note) {
                if (b.increment) b.param->set(b.param->get() + b.value);
                else b.param->set(b.value);
            }
        }
    }

    std::unique_ptr<WebMIDI> mMidi;
    std::vector<CCBinding> mCCBindings;
    std::vector<NoteBinding> mNoteBindings;
};

} // namespace al

// ============================================================================
// BundleGUIManager Stub
// ============================================================================
namespace al {
class BundleGUIManager {
public:
    BundleGUIManager(const std::string& name = "") : mName(name) {}
    BundleGUIManager& operator<<(ParameterBundle& b) {
        mBundles.push_back(&b);
        return *this;
    }
    void registerParameterBundle(ParameterBundle& b) {
        mBundles.push_back(&b);
    }
    int currentBundle() const { return mCurrent; }
    void setCurrentBundle(int i) { if (i >= 0 && (size_t)i < mBundles.size()) mCurrent = i; }
    void drawBundleGUI() {}  // no-op: Vue handles UI
    void drawBundleGlobal() {}
    const std::string& name() const { return mName; }
    size_t bundleCount() const { return mBundles.size(); }
private:
    std::string mName;
    std::vector<ParameterBundle*> mBundles;
    int mCurrent = 0;
};
} // namespace al

// ============================================================================
// Composition Stub (uses file system - not available in WASM)
// ============================================================================
namespace al {
class CompositionStep {
public:
    std::string presetName;
    double deltaTime = 0.0;
};
class Composition {
public:
    Composition(PresetHandler& handler, const std::string& name = "") {}
    void insertStep(const std::string& presetName, double deltaTime, int index = -1) {}
    void deleteStep(int index) {}
    CompositionStep getStep(int index) const { return {}; }
    int size() const { return 0; }
    void play() {}
    void stop() {}
    bool running() const { return false; }
    void write() {}
    std::string getName() const { return ""; }
    void registerBeginCallback(std::function<void(Composition*)>) {}
    void registerEndCallback(std::function<void(Composition*)>) {}
};
} // namespace al

// ============================================================================
// CSVReader Stub (uses file system - limited in WASM)
// ============================================================================
namespace al {
class CSVReader {
public:
    enum class DataType { STRING, INT64, REAL, BOOLEAN, IGNORE_COLUMN };
    CSVReader() = default;
    // Synchronous file reading is not supported in WASM.
    // Use WebFile::loadFromURL() + parse the result manually, or pass a
    // pre-fetched CSV string to readString() below.
    bool readFile(const std::string& fileName, bool = true) {
        printf("[WASM] CSVReader: synchronous file reading unavailable. "
               "Use WebFile::loadFromURL('%s') and parse the returned bytes.\n", fileName.c_str());
        return false;
    }
    void addType(DataType t) { mTypes.push_back(t); }
    void clearTypes() { mTypes.clear(); }
    std::vector<std::string> getColumnNames() const { return mColumnNames; }
    int size() const { return (int)mRows.size(); }
    void setBasePath(const std::string&) {}

    // Manually load from a string (for programmatic use after fetching bytes)
    bool readString(const std::string& csv, bool hasColumnNames = true) {
        mRows.clear();
        mColumnNames.clear();
        size_t pos = 0;
        bool first = true;
        while (pos < csv.size()) {
            size_t eol = csv.find('\n', pos);
            if (eol == std::string::npos) eol = csv.size();
            std::string line = csv.substr(pos, eol - pos);
            std::vector<std::string> row;
            size_t cp = 0;
            while (cp <= line.size()) {
                size_t comma = line.find(',', cp);
                if (comma == std::string::npos) comma = line.size();
                row.push_back(line.substr(cp, comma - cp));
                cp = comma + 1;
                if (comma == line.size()) break;
            }
            if (first && hasColumnNames) mColumnNames = row;
            else mRows.push_back(row);
            first = false;
            pos = eol + 1;
        }
        return true;
    }
private:
    std::vector<DataType> mTypes;
    std::vector<std::string> mColumnNames;
    std::vector<std::vector<std::string>> mRows;
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

// ============================================================================
// SynthRecorder WASM (in-memory .synthSequence buffer + browser download)
// The native al::SynthRecorder writes to disk via fstream — not available in
// Emscripten. This version records events to an in-memory buffer and, on
// stopRecord(), triggers a browser download of the resulting text file.
// ============================================================================

namespace al {

class SynthRecorder {
public:
    enum TextFormat { SEQUENCER_EVENT, SEQUENCER_TRIGGERS, CPP_FORMAT };

    SynthRecorder() = default;

    void startRecord(std::string fileName = "", bool = false, bool = false) {
        mFilename = fileName.empty() ? "recording.synthSequence" : fileName;
        mEvents.clear();
        mRecording = true;
        mStartTime = emscripten_get_now() * 0.001;
        printf("[WASM] SynthRecorder: recording started -> %s\n", mFilename.c_str());
    }
    void stopRecord() {
        if (!mRecording) return;
        mRecording = false;
        // Build a .synthSequence text file from events
        std::string content;
        for (auto& e : mEvents) {
            content += "+" + std::to_string(e.time) + " " + e.voice + " " + std::to_string(e.id) + "\n";
        }
        // Trigger browser download
        EM_ASM({
            var blob = new Blob([UTF8ToString($0)], { type: 'text/plain' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = UTF8ToString($1);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
        }, content.c_str(), mFilename.c_str());
        printf("[WASM] SynthRecorder: saved %zu events to %s\n", mEvents.size(), mFilename.c_str());
    }
    bool isRecording() const { return mRecording; }

    // When a voice is triggered, the real SynthRecorder would capture it.
    // We expose manual logging:
    void logTrigger(const std::string& voiceName, int id) {
        if (!mRecording) return;
        double t = emscripten_get_now() * 0.001 - mStartTime;
        mEvents.push_back({t, voiceName, id});
    }

    SynthRecorder& operator<<(PolySynth&) { return *this; }
    SynthRecorder& operator<<(SynthSequencer&) { return *this; }
    void registerPolySynth(PolySynth&) {}
    void setDirectory(const std::string&) {}
    void setMaxRecordTime(double) {}
    void verbose(bool) {}
    void onTriggerOn(SynthVoice*, int = 0) {}
    void onTriggerOff(SynthVoice*, int = 0) {}

private:
    struct Event {
        double time;
        std::string voice;
        int id;
    };
    std::string mFilename;
    std::vector<Event> mEvents;
    bool mRecording = false;
    double mStartTime = 0;
};

} // namespace al

// ============================================================================
// SynthSequencer URL helper (WASM extension)
// ============================================================================
// al::SynthSequencer IS included (from al/scene/al_SynthSequencer.hpp).
// Most methods work. However, playSequence(filename) reads from disk.
// On WASM, use WebSequencerBridge for frontend-driven sequencing instead.
// The extension below adds a web-safe helper that logs a clear message.

namespace al {

// Parse .synthSequence text format and schedule events on a SynthSequencer.
// Format per line: "@<time> <voice> <id> <params>" or "+<time> ..." / "-<time> ..."
// Actual parsing matching the native SynthSequencer file format requires access
// to internal scheduling APIs; for now this logs the receipt and leaves the
// SynthSequencer untouched. Users should use WebSequencerBridge or the Studio
// sequencer panel for full functionality.
inline void playSynthSequenceFromText(SynthSequencer& seq, const std::string& content, float startTime = 0.0f) {
    printf("[WASM] playSynthSequenceFromText: %zu bytes received at t=%.2f\n", content.size(), startTime);
    // TODO: implement actual parsing matching the native SynthSequencer file format.
    (void)seq;
    (void)startTime;
}

// Fetch a .synthSequence file from URL and play it.
// The fetch is async; the text body is logged for debugging. Full plumbing into
// playSynthSequenceFromText requires a ccall round-trip from JS back into C++.
inline void playSynthSequenceFromURL(SynthSequencer& seq, const std::string& url, float startTime = 0.0f) {
    EM_ASM({
        var url = UTF8ToString($0);
        fetch(url).then(function(r) { return r.text(); }).then(function(text) {
            console.log('[WASM] Fetched synthSequence:', text.length, 'bytes');
            // Dispatch to C++ parser (would need ccall here)
        }).catch(function(e) {
            console.error('[WASM] playSynthSequenceFromURL failed:', e);
        });
    }, url.c_str());
    (void)seq;
    (void)startTime;
}

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
// Note: al::asciiToIndex() is provided by allolib's al/scene/al_PolySynth.hpp
// (signature: int asciiToIndex(int asciiKey, int offset = 0)). Defining a
// second overload here causes ambiguous-call errors when both headers are
// visible, so we just rely on the upstream one.
// ============================================================================

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

// ============================================================================
// AppRecorder Stub
// ============================================================================
namespace al {
class AppRecorder {
public:
    AppRecorder() = default;
    void startRecording() {}
    void stopRecording() {}
    bool isRecording() const { return false; }
    void setOutputFile(const std::string&) {}
};
} // namespace al

#endif // AL_PLAYGROUND_COMPAT_HPP
