#pragma once

/**
 * al::WebParameterServer — ParameterServer subclass that feeds the
 * canonical ParameterRegistry alongside upstream's per-type lists.
 *
 * v0.7.4 phase 4 of the parameter pipeline migration.
 *
 * Why this exists
 * ===============
 * Upstream `al::ParameterServer::registerParameter(ParameterMeta&)` is the
 * sole funnel for `parameterServer() << p`. The pre-v0.7 strategy was a
 * mirror loop in `WebApp::start()` that walked five of the server's typed
 * accessors (`parameters()`, `stringParameters()`, `vec3Parameters()`,
 * `vec4Parameters()`, `poseParameters()`) and pushed each pointer into a
 * static `WebControlGUI sDefaultPanel`. The audit's smoking-gun finding
 * was that this walk silently dropped `int`/`bool`/`menu`/`choice`/`color`/
 * `trigger` types — those weren't enumerated. Users registering an
 * `ParameterInt` via `parameterServer() <<` got OSC routing but no panel.
 *
 * The fix is to capture the parameter at registration time, not at
 * walk-time. Each `<<` call goes through the shadowed templated
 * operator<< below, which calls upstream's registerParameter for the OSC
 * routing AND `ParameterRegistry::global().add(&p)` for the panel.
 * Type-agnostic by design — the registry takes any `ParameterMeta*`.
 *
 * Why a templated shadow rather than overriding registerParameter
 * ===============================================================
 * Upstream's `operator<<` is itself a function template:
 *
 *     template<class T> ParameterServer& operator<<(T& newParam) {
 *       return registerParameter(newParam);
 *     }
 *
 * When called on a `WebParameterServer*`, name lookup finds the
 * inherited template; inside the template body, `this->registerParameter`
 * resolves statically to `ParameterServer::registerParameter` (the
 * function it was compiled against). Re-defining `registerParameter` in
 * the subclass alone wouldn't reroute the inherited template's call.
 *
 * Solution: shadow `operator<<` itself in the subclass. Name lookup at
 * the call site of `parameterServer() << p` finds our template (now
 * a member of WebParameterServer), and our body explicitly invokes
 * `ParameterServer::registerParameter` plus the registry feed.
 */

#include "al/ui/al_ParameterServer.hpp"
#include "al/ui/al_ParameterBundle.hpp"
#include "al_parameter_registry.hpp"

namespace al {

class WebParameterServer : public ParameterServer {
public:
    using ParameterServer::ParameterServer;

    /// Single-parameter `<<` (templated to accept any ParameterMeta subtype).
    /// Forwards to upstream registerParameter for OSC dispatch, then adds
    /// to the global registry so the Studio Params panel sees it.
    template <class T>
    WebParameterServer& operator<<(T& newParam) {
        ParameterServer::registerParameter(newParam);
        ParameterRegistry::global().add(&newParam);
        return *this;
    }

    template <class T>
    WebParameterServer& operator<<(T* newParam) {
        if (newParam) {
            ParameterServer::registerParameter(*newParam);
            ParameterRegistry::global().add(newParam);
        }
        return *this;
    }

    /// ParameterBundle path. Upstream's `registerParameterBundle` walks
    /// the bundle's parameters and calls registerParameter on each; we
    /// invoke that to keep OSC routing intact, then mirror each into
    /// the registry. Pointer-dedup makes the mirror idempotent if any
    /// of the same parameters were already registered via another route.
    WebParameterServer& operator<<(ParameterBundle& bundle) {
        ParameterServer::registerParameterBundle(bundle);
        for (auto* p : bundle.parameters()) {
            if (p) ParameterRegistry::global().add(p);
        }
        return *this;
    }

    /// Direct registerParameter call (for code that doesn't use `<<`).
    /// Hides upstream's non-virtual method by name; consumers calling
    /// `webServer.registerParameter(p)` get the registry feed too.
    WebParameterServer& registerParameter(ParameterMeta& param) {
        ParameterServer::registerParameter(param);
        ParameterRegistry::global().add(&param);
        return *this;
    }

    WebParameterServer& registerParameterBundle(ParameterBundle& bundle) {
        ParameterServer::registerParameterBundle(bundle);
        for (auto* p : bundle.parameters()) {
            if (p) ParameterRegistry::global().add(p);
        }
        return *this;
    }
};

} // namespace al
