#pragma once

/**
 * al::ParameterRegistry — single source of truth for the Studio Params
 * panel pipeline.
 *
 * Why this exists
 * ===============
 * The pre-v0.7 pipeline had six registries (`ParameterServer.mParameters`,
 * `PresetHandler.mParameters`, `WebPresetHandler` via base,
 * `WebControlGUI.mParameters`, plus two SynthVoice trigger/continuous lists)
 * and eight registration entry points. The Vue panel read only from
 * `WebControlGUI`, and a partial mirror loop in `WebApp::start` walked
 * five of `ParameterServer`'s typed lists, silently dropping
 * int/bool/menu/choice/color/trigger types. Two competing
 * `static WebControlGUI sDefaultPanel` instances raced for
 * `sActiveInstance`. The panel-empty bug across v0.4.5–v0.6.3 was
 * therefore not one bug but half a dozen.
 *
 * The redesign (per `PARAMETER_PIPELINE_PLAN.md` § 2) collapses every
 * registration path into one canonical list. Each existing class still
 * owns its own list for native ABI parity AND additionally calls
 * `ParameterRegistry::global().add(&p)`. The C exports in
 * `al_WebControlGUI.cpp` (and any future bridge) read from this registry,
 * never from a per-class list.
 *
 * Approved design decisions (user-confirmed before phase 1):
 *   Q1: singleton — process-global, Meyer's-singleton storage. Multiple
 *       WebApp instances unsupported in WASM (always have been).
 *   Q2: Vue panel polls a cheap atomic version counter every animation
 *       frame; only re-reads the snapshot when the counter advances.
 *       No JS-callback dispatch path — avoids postMessage backpressure
 *       failure modes.
 *   Q3: registry is cleared in `WebApp::~WebApp` so re-running an example
 *       doesn't leave ghost parameters in the panel.
 *
 * Identity / dedup
 * ================
 * Dedupe by raw `ParameterMeta*` pointer — the canonical AlloLib idiom.
 * Calling `add(&p)` twice is idempotent (returns false on the second
 * call). Different parameter objects with the same name are distinct
 * registry entries.
 *
 * Thread-safety
 * =============
 * WASM is single-threaded; the AudioWorklet runs on a separate context
 * but never enumerates the registry. Writes therefore come only from
 * the main thread. Reads from JS (via `al_webgui_*` C exports) run on
 * the main thread too — JS calls into WASM are trampolined through
 * Emscripten on the main JS thread. The atomic version counter exists
 * for the JS polling fallback in case a future feature trampolines
 * registry writes from a worker.
 */

#include <atomic>
#include <cstdint>
#include <cstddef>
#include <functional>
#include <vector>

// Forward-declare ParameterMeta to avoid pulling in the full upstream
// header from every translation unit that consumes the registry. The
// only operations we perform on the pointer are address comparison and
// passing it back out; we never dereference.
namespace al { class ParameterMeta; }

namespace al {

/**
 * Subscription token returned by ParameterRegistry::onChange. Opaque to
 * callers; pass to `unsubscribe` to detach the callback. Stored as a
 * monotonic id rather than a pointer/iterator because iterator
 * invalidation under vector resize is too easy to get wrong.
 */
struct ParameterRegistrySubscription {
    uint64_t id = 0;
    bool valid() const noexcept { return id != 0; }
};

class ParameterRegistry {
public:
    using Callback = std::function<void(ParameterMeta*)>;

    /**
     * Process-global registry. Meyer's-singleton storage so the lifetime
     * matches the WASM module's, and so we don't fight static-init
     * ordering (the function-local-static is constructed on first call,
     * destroyed at module teardown).
     */
    static ParameterRegistry& global() {
        static ParameterRegistry sInstance;
        return sInstance;
    }

    /**
     * Add a parameter. Returns true if newly added, false if already
     * present (idempotent). Bumps `version()` and fires `onChange`
     * callbacks only on the true case.
     */
    bool add(ParameterMeta* p) {
        if (!p) return false;
        for (auto* existing : mParameters) {
            if (existing == p) return false;
        }
        mParameters.push_back(p);
        mVersion.fetch_add(1, std::memory_order_release);
        notifyAdd(p);
        return true;
    }

    /**
     * Pointer-identity membership query. O(N) — the parameter list is
     * always small (typically <50). If a future feature pushes this past
     * a few hundred entries, swap to a `std::unordered_set<ParameterMeta*>`
     * mirror — keep the vector ordering for `at(idx)` indexed access.
     */
    bool has(ParameterMeta* p) const {
        for (auto* existing : mParameters) {
            if (existing == p) return true;
        }
        return false;
    }

    /// Number of registered parameters.
    size_t count() const noexcept { return mParameters.size(); }

    /// Indexed access; returns nullptr on out-of-range. Stable across
    /// add/clear: the order is insertion order, never permuted.
    ParameterMeta* at(size_t idx) const {
        if (idx >= mParameters.size()) return nullptr;
        return mParameters[idx];
    }

    /// Defensive copy of the full list. Use sparingly — the typical
    /// JS-bridge access pattern is `count()` + indexed `at(i)` reads,
    /// which avoids the allocation.
    std::vector<ParameterMeta*> snapshot() const { return mParameters; }

    /**
     * Subscribe to add/clear events. Returns a token; pass to
     * `unsubscribe` when the subscriber lifetime ends. Used by future
     * Vue-panel callback path (Q2 says polling for now, but the
     * subscription API is real so the upgrade path is one C-export
     * dispatch hook away).
     */
    ParameterRegistrySubscription onChange(Callback cb) {
        ParameterRegistrySubscription tok;
        tok.id = ++mNextSubId;
        mSubscribers.push_back({tok.id, std::move(cb)});
        return tok;
    }

    void unsubscribe(ParameterRegistrySubscription tok) {
        if (!tok.valid()) return;
        for (auto it = mSubscribers.begin(); it != mSubscribers.end(); ++it) {
            if (it->id == tok.id) { mSubscribers.erase(it); return; }
        }
    }

    /**
     * Drop everything. Bumps version and fires onChange(nullptr) so
     * subscribers know to reset. Called from `WebApp::~WebApp` (Q3).
     */
    void clear() {
        mParameters.clear();
        mVersion.fetch_add(1, std::memory_order_release);
        for (auto& s : mSubscribers) s.cb(nullptr);
    }

    /**
     * Monotonic counter, incremented on every state change (add /
     * clear). The Vue panel polls this each animation frame; if the
     * value changed since the last poll, it re-reads the parameter
     * list. ~5 µs per frame. Atomic so a future cross-thread reader
     * sees a consistent value without a mutex.
     */
    uint64_t version() const noexcept {
        return mVersion.load(std::memory_order_acquire);
    }

private:
    ParameterRegistry() = default;
    ~ParameterRegistry() = default;
    ParameterRegistry(const ParameterRegistry&) = delete;
    ParameterRegistry& operator=(const ParameterRegistry&) = delete;

    void notifyAdd(ParameterMeta* p) {
        for (auto& s : mSubscribers) s.cb(p);
    }

    struct Subscriber {
        uint64_t id;
        Callback cb;
    };

    std::vector<ParameterMeta*> mParameters;
    std::vector<Subscriber> mSubscribers;
    std::atomic<uint64_t> mVersion{0};
    uint64_t mNextSubId{0};
};

} // namespace al
