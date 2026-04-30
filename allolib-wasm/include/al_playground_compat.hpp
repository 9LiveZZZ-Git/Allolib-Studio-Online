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
#include <fstream>
#include <sstream>
#include <sys/stat.h>

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

// Header-only hook (C++17 inline variable) so referencing it from the
// user's main.cpp doesn't require libal_web.a to export a symbol —
// avoids the rebuild gap when this header changes. WebApp::tick checks
// it via the same inline-variable mechanism after Railway rebuilds; if
// the lib in use is older, the hook is simply un-fired and the user
// can call mPresets.tick(dt) manually from onAnimate as a fallback.
inline void (*gPlaygroundAnimateHook)(double dt) = nullptr;

// ============================================================================
// M5.2 — unify on upstream PresetHandler / PresetSequencer / PresetMapper.
// Web-specific behaviors that used to live in our hand-rolled class move
// into the WebPresetHandler subclass below:
//   - auto-WebControlGUI mirror on `<<` / registerParameter
//   - IDBFS syncfs(false) after every store, via registerStoreCallback
//   - morph engine wired to gPlaygroundAnimateHook via stepMorphing
//   - dumpFiles() diagnostic
// The previous .arrangement.json sidecar and localStorage cache were
// only-written, never-read auxiliaries — the upstream .preset file
// format combined with the IDBFS persist now covers cross-session
// reload, so the sidecars are dropped (not a regression: nothing in
// the codebase consumed them).
// ============================================================================
#include "al/ui/al_PresetHandler.hpp"
#include "al/ui/al_PresetSequencer.hpp"
#include "al/ui/al_PresetMapper.hpp"

namespace al {

class WebPresetHandler : public PresetHandler {
public:
    // Web-friendly defaults: rooted at /presets (IDBFS mountpoint); ASYNC
    // mode disables the upstream CPU-thread morph (Emscripten's pthread
    // story is fragile; we tick stepMorphing from gPlaygroundAnimateHook).
    // Web-friendly defaults: rooted at /presets (IDBFS mountpoint); FREE
    // mode is the only PresetHandler mode that does NOT spawn the upstream
    // CPU-thread morph (CPU starts a thread; GRAPHICS and AUDIO fall back
    // to CPU per upstream's PresetHandler.cpp). We tick stepMorphing() from
    // gPlaygroundAnimateHook instead.
    explicit WebPresetHandler(std::string rootDirectory = "/presets",
                              bool verbose = false)
        : PresetHandler(TimeMasterMode::TIME_MASTER_FREE,
                        prepareWebPath(rootDirectory), verbose) {
        installWebHooks();
    }
    // Compat overload: caller supplies an explicit time-master mode.
    WebPresetHandler(TimeMasterMode mode, std::string rootDirectory = "/presets",
                     bool verbose = false)
        : PresetHandler(mode, normalizeWebPath(rootDirectory), verbose) {
        if (mode == TimeMasterMode::TIME_MASTER_CPU) {
            printf("[WebPresetHandler] TIME_MASTER_CPU spawns a CPU thread; "
                   "TIME_MASTER_FREE is recommended on web.\n");
        }
        installWebHooks();
    }

private:
    // Phase 5: every user-supplied root is mapped under the single
    // /presets IDBFS mountpoint. The previous strategy ("normalize to
    // absolute, leave alone") meant `PresetHandler ph("M5_2_test_presets")`
    // got an absolute /M5_2_test_presets path that lived OUTSIDE the
    // mounted /presets — so mkdir/readdir failed (errno 28) and the
    // upstream auto-create branch logged errors all the way through.
    //
    // Mapping:
    //   ""                  → "/presets"
    //   "."                 → "/presets"
    //   "presets"           → "/presets"
    //   "./presets"         → "/presets"
    //   "/presets"          → "/presets"
    //   "M5_2_test_presets" → "/presets/M5_2_test_presets"
    //   "./songs/scene1"    → "/presets/songs/scene1"
    //   "/foo/bar"          → "/presets/foo/bar"
    //
    // Native code's identical-source compile (no compat header) gets
    // upstream's literal-string path semantics — disk-relative or
    // disk-absolute. Web-only re-rooting; round-trip preserved.
    static std::string normalizeWebPath(const std::string& p) {
        std::string s = p;
        // Strip leading "./" or "."
        if (s.size() >= 2 && s[0] == '.' && s[1] == '/') s.erase(0, 2);
        else if (s.size() == 1 && s[0] == '.') s.clear();
        // Strip leading "/"
        while (!s.empty() && s[0] == '/') s.erase(0, 1);
        if (s.empty() || s == "presets") return "/presets";
        // Strip leading "presets/" if user already put it there
        if (s.rfind("presets/", 0) == 0) s.erase(0, 8);
        return "/presets/" + s;
    }

    // prepareWebPath runs in the BASE-CTOR member-init list (as the
    // string argument's evaluation), so it executes BEFORE the upstream
    // PresetHandler ctor body — which means it executes BEFORE upstream's
    // setCurrentPresetMap() call. We use this window to:
    //   1. mkdir each path component in IDBFS so File::exists succeeds.
    //   2. Pre-create a stub `default.presetMap` file synchronously, so
    //      upstream's `if (autoCreate && !File::exists(mapFullPath))`
    //      check is false and the auto-create write — which has been
    //      racing FS.syncfs(true) and aborting — is skipped entirely.
    //
    // The async syncfs(true) populate from preRun has already completed
    // by main() time (gated via Emscripten's run-dependency counter), so
    // any IDB-restored map files overlay the empty stub seamlessly.
    static std::string prepareWebPath(const std::string& userRoot) {
        std::string normalized = normalizeWebPath(userRoot);
        EM_ASM({
            var path = UTF8ToString($0);
            // Recursive mkdir — split on '/' and create each segment.
            var parts = path.split('/').filter(function(s){ return s.length > 0; });
            var acc = '';
            for (var i = 0; i < parts.length; ++i) {
                acc += '/' + parts[i];
                try { FS.mkdir(acc); } catch (e) { /* exists */ }
            }
            // Stub default.presetMap so upstream's auto-create branch
            // sees the file and skips the racing write.
            try {
                var mapPath = path + '/default.presetMap';
                if (!FS.analyzePath(mapPath).exists) {
                    FS.writeFile(mapPath, new Uint8Array());
                }
            } catch (e) { console.warn('[WebPresetHandler] presetMap stub failed:', e); }
        }, normalized.c_str());
        return normalized;
    }
public:
    ~WebPresetHandler() {
        auto& v = activeHandlers();
        v.erase(std::remove(v.begin(), v.end(), this), v.end());
    }

    // ── Auto-feed the global ParameterRegistry ───────────────────────────
    // Hides upstream's non-virtual operator<< / registerParameter so user
    // code's `mPresets << gain` registers BOTH with upstream's preset
    // bookkeeping AND with the canonical ParameterRegistry that the
    // Studio Params panel reads from. Without the hide-by-name shadow,
    // base's operator<< would static-dispatch to base's registerParameter
    // and skip our registry feed.
    //
    // v0.7.3 phase 3: route through ParameterRegistry::global().add(&p)
    // instead of looking up an active WebControlGUI instance. The
    // pre-v0.7 mirrorToActiveGui used a function-static `sDefaultPanel`
    // that raced with WebApp::start's identical static for the
    // sActiveInstance slot — fixed by routing through the singleton
    // registry, which the C exports in al_WebControlGUI.cpp now read
    // (per v0.7.1 phase 2).
    WebPresetHandler& registerParameter(ParameterMeta& p) {
        PresetHandler::registerParameter(p);
        ParameterRegistry::global().add(&p);
        return *this;
    }
    WebPresetHandler& registerParameterBundle(ParameterBundle& b) {
        PresetHandler::registerParameterBundle(b);
        for (auto* p : b.parameters()) if (p) ParameterRegistry::global().add(p);
        return *this;
    }
    WebPresetHandler& operator<<(ParameterMeta& p) { return registerParameter(p); }
    WebPresetHandler& operator<<(ParameterBundle& b) { return registerParameterBundle(b); }

    // ── setCurrentPresetMap shadow ───────────────────────────────────────
    // User code that calls mPresets.setCurrentPresetMap("scene1") would
    // hit upstream's auto-create branch, which races FS.syncfs(true) and
    // aborts. The hide-by-name shadow pre-creates the stub file so the
    // auto-create branch is skipped, then forwards to base. Same surface
    // upstream exposes; round-trip with native is preserved (native
    // PresetHandler::setCurrentPresetMap auto-creates fine on a real
    // filesystem with no async populate to race).
    void setCurrentPresetMap(std::string mapName = "default",
                             bool autoCreate = true) {
        const std::string mapPath = getCurrentPath() + "/" + mapName + ".presetMap";
        EM_ASM({
            var p = UTF8ToString($0);
            try {
                if (!FS.analyzePath(p).exists) {
                    FS.writeFile(p, new Uint8Array());
                }
            } catch (e) { console.warn('[WebPresetHandler] presetMap stub failed:', e); }
        }, mapPath.c_str());
        // Forward to base. autoCreate is irrelevant now (file exists), so
        // upstream's `!File::exists(mapFullPath)` branch is dead either way.
        PresetHandler::setCurrentPresetMap(mapName, autoCreate);
    }

    // ── Compat aliases for the previous custom API ───────────────────────
    // The hand-rolled compat PresetHandler exposed `tick(dt)` (called from
    // gPlaygroundAnimateHook) and `recallPreset(name, morphTime)` /
    // `stopMorph()` overloads that don't exist upstream. We bridge them
    // here so any pre-existing user code keeps compiling.
    void tick(double dt)            { stepMorphing(dt); }
    void tick(float dt)             { stepMorphing(static_cast<double>(dt)); }
    void recallPreset(std::string name, float morphTime) { morphTo(name, morphTime); }
    void recallPreset(int index, float morphTime)        { morphTo(getPresetName(index), morphTime); }
    using PresetHandler::recallPreset;  // unhide base recallPreset(name)/recallPreset(int)
    void stopMorph()                { stopMorphing(); }

    // ── Diagnostic: list /presets contents in the JS console ─────────────
    // Non-const because upstream PresetHandler::getCurrentPath() is
    // non-const (it lazily refreshes the cached subdirectory string).
    void dumpFiles() {
        const std::string dir = getCurrentPath();
        EM_ASM({
            var path = UTF8ToString($0);
            try {
                var entries = FS.readdir(path).filter(function(n) {
                    return n !== '.' && n !== '..';
                });
                console.log('[WebPresetHandler] ' + path + ' contains '
                    + entries.length + ' file(s):', entries);
                entries.forEach(function(name) {
                    try {
                        var content = FS.readFile(path + '/' + name, { encoding: 'utf8' });
                        console.log('  ' + name + ':\n' + content);
                    } catch(e) { console.warn('  could not read ' + name, e); }
                });
            } catch(e) {
                console.warn('[WebPresetHandler] cannot list ' + path, e);
            }
        }, dir.c_str());
    }

private:
    // ── Setup ────────────────────────────────────────────────────────────
    void installWebHooks() {
        registerForMorphTick();
        // Persist to IndexedDB after every successful store so .preset
        // files survive a page reload through the IDBFS mountpoint.
        registerStoreCallback([](int /*index*/, std::string /*name*/, void* /*ud*/) {
            EM_ASM({
                if (typeof FS !== 'undefined' && FS.syncfs) {
                    FS.syncfs(false, function(err) {
                        if (err) console.warn('[IDBFS] preset persist failed:', err);
                    });
                }
            });
        });
    }

    // (v0.7.3: mirrorToActiveGui removed — it created a race between two
    // function-static WebControlGUI instances competing for sActiveInstance.
    // operator<< now feeds ParameterRegistry::global() directly, which the
    // JS bridge reads via al_WebControlGUI.cpp's v0.7.1-rewritten C exports.
    // No active-instance lookup, no race.)

    // ── Morph tick wiring ────────────────────────────────────────────────
    static std::vector<WebPresetHandler*>& activeHandlers() {
        static std::vector<WebPresetHandler*> v;
        return v;
    }
    static void tickAllFromAnimate(double dt) {
        for (auto* h : activeHandlers()) h->stepMorphing(dt);
    }
    void registerForMorphTick() {
        if (gPlaygroundAnimateHook == nullptr) {
            gPlaygroundAnimateHook = &WebPresetHandler::tickAllFromAnimate;
        }
        activeHandlers().push_back(this);
    }
};

// User-facing alias: existing example code that wrote `PresetHandler` keeps
// compiling, but with web hooks attached automatically.
//
// CAREFUL: this `using` is intentionally NOT in `namespace al` (where
// upstream's `class al::PresetHandler` already lives). Instead we leave
// `al::PresetHandler` as upstream's class (so PresetSequencer.cpp's
// internal references compile against the right ABI) and provide the
// WebPresetHandler name for opt-in web behavior. Most user code should
// write `WebPresetHandler` directly.
//
// (For a future refactor: a TU-local typedef in user code's main.cpp via
// transpiler injection — `using PresetHandler = al::WebPresetHandler;`
// at function scope — would let bare `PresetHandler` resolve to the
// subclass without breaking upstream's ABI. Out of scope for this push.)

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

// PresetSequencer + PresetMapper come from upstream now (M5.2). They are
// included near the top of this header alongside the WebPresetHandler
// subclass; no compat shims live here anymore.

// ============================================================================
// PresetMIDI — MIDI control surface ↔ PresetHandler recall slot bindings
// Compile-compat stub; binding routing happens in WebMIDI in a future push.
// ============================================================================

namespace al {

class PresetMIDI {
public:
    PresetMIDI() = default;
    PresetMIDI(int /*deviceIndex*/) {}
    PresetMIDI(int /*deviceIndex*/, PresetHandler& h) { setPresetHandler(h); }

    void open(int = 0) {}
    void open(int, PresetHandler& h) { setPresetHandler(h); }
    void close() {}
    bool isOpen() const { return false; }

    void setPresetHandler(PresetHandler& h) { mPresetHandler = &h; }
    PresetHandler* presetHandler() { return mPresetHandler; }

    void connectNoteToPreset(int /*channel*/, int /*midiNote*/, int /*presetIndex*/) {}
    void connectProgramToPreset(int /*channel*/, int /*program*/, int /*presetIndex*/) {}
    void connectCCToMorphTime(int /*channel*/, int /*cc*/, float /*minSec*/ = 0.f, float /*maxSec*/ = 10.f) {}
    void clearBindings() {}

    void setMorphTimeFromCC(bool) {}
    void verbose(bool) {}

private:
    PresetHandler* mPresetHandler = nullptr;
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

// ============================================================================
// User-code-only macro: rewrite bare `PresetHandler` to `WebPresetHandler`
// in everything parsed AFTER this point.
//
// PHASE 6 AUDIT (v0.7.8): the macro is LOAD-BEARING — confirmed kept.
//
// What user code gets when it writes `PresetHandler mPresets("./songs");`:
//   1. Path normalization — every user root re-rooted under /presets to
//      land inside the IDBFS mountpoint (prepareWebPath, phase 5).
//   2. Pre-creation of `default.presetMap` BEFORE upstream's ctor body
//      runs setCurrentPresetMap, neutralizing the auto-create-vs-syncfs
//      race (phase 5).
//   3. Pre-creation on user-initiated setCurrentPresetMap("scene1") calls
//      via the subclass shadow (phase 5).
//   4. Direct feed into ParameterRegistry::global() on `<<` /
//      registerParameter, so the Studio Params panel sees the parameter
//      regardless of any ControlGUI instance (phases 1+3).
//   5. Legacy aliases `tick(dt)` / `recallPreset(name, morphTime)` /
//      `stopMorph()` that pre-v0.5 user code expected (still aliased to
//      stepMorphing / morphTo / stopMorphing for backward compat).
//
// Without the macro, bare `PresetHandler mPresets;` in user code would
// construct upstream's class directly and lose all five behaviors —
// the Studio panel would go empty for that code path, IDBFS races would
// abort module init, etc. Removal is a regression, not a cleanup.
//
// Native compiles are unaffected (verified 2026-04-29 via M5_2 parity
// gate): native test files don't include al_playground_compat.hpp at
// all, so the macro never reaches them. Round-trip with native is
// preserved bit-for-bit.
//
// Why `#define` rather than `using PresetHandler = WebPresetHandler`:
// the using-alias would conflict with upstream's `class al::PresetHandler`
// already declared by includes higher in this header. The macro is
// purely textual, so it only affects symbol references parsed AFTER
// this line — not type declarations parsed earlier.
//
// Placement matters: at the VERY END of the header so all upstream
// `class al::PresetHandler` declarations and our WebPresetHandler
// subclass body (which uses `PresetHandler::` explicitly to access
// base members) are fully parsed before the macro fires.
//
// User code that needs upstream's class explicitly can `#undef
// PresetHandler` after including this header.
// ============================================================================
#define PresetHandler WebPresetHandler

#endif // AL_PLAYGROUND_COMPAT_HPP
