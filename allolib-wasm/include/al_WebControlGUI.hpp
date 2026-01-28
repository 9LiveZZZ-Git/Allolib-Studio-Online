/**
 * WebControlGUI - Web-based Parameter Control GUI
 *
 * Provides ImGui-like parameter control functionality in the browser.
 * Parameters registered with WebControlGUI are exposed to JavaScript
 * and can be controlled via a Vue-based UI panel.
 *
 * Usage:
 *   WebControlGUI gui;
 *   gui << myParameter;           // Register a parameter
 *   gui.registerParameter(param); // Alternative syntax
 *
 * The Vue frontend will automatically render controls for registered
 * parameters and handle two-way binding.
 */

#ifndef AL_WEB_CONTROL_GUI_HPP
#define AL_WEB_CONTROL_GUI_HPP

#include "al/ui/al_Parameter.hpp"
#include "al/ui/al_ParameterBundle.hpp"
#include <vector>
#include <string>
#include <functional>
#include <unordered_map>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/val.h>
#endif

namespace al {

/**
 * Parameter type enumeration for JavaScript
 */
enum class WebParamType {
    FLOAT = 0,
    INT = 1,
    BOOL = 2,
    STRING = 3,
    VEC3 = 4,
    VEC4 = 5,
    COLOR = 6,
    MENU = 7,
    TRIGGER = 8
};

/**
 * Parameter info structure for JavaScript interop
 */
struct WebParamInfo {
    std::string name;
    std::string group;
    WebParamType type;
    float min;
    float max;
    float value;
    float defaultValue;
    std::vector<std::string> menuItems;  // For menu/choice parameters
    int index;  // Index in the parameter list
};

/**
 * WebControlGUI - Browser-based parameter control panel
 */
class WebControlGUI {
public:
    WebControlGUI() {
#ifdef __EMSCRIPTEN__
        // Register this instance globally for JS access
        registerGlobalInstance(this);
#endif
    }

    ~WebControlGUI() {
#ifdef __EMSCRIPTEN__
        unregisterGlobalInstance(this);
#endif
    }

    // =========================================================================
    // Parameter Registration
    // =========================================================================

    WebControlGUI& registerParameterMeta(ParameterMeta& param) {
        mParameters.push_back(&param);
        notifyParameterAdded(param);
        return *this;
    }

    WebControlGUI& operator<<(ParameterMeta& param) {
        return registerParameterMeta(param);
    }

    WebControlGUI& operator<<(ParameterMeta* param) {
        if (param) registerParameterMeta(*param);
        return *this;
    }

    // Convenience methods for specific parameter types
    WebControlGUI& add(Parameter& p) { return registerParameterMeta(p); }
    WebControlGUI& add(ParameterInt& p) { return registerParameterMeta(p); }
    WebControlGUI& add(ParameterBool& p) { return registerParameterMeta(p); }
    WebControlGUI& add(ParameterString& p) { return registerParameterMeta(p); }
    WebControlGUI& add(ParameterVec3& p) { return registerParameterMeta(p); }
    WebControlGUI& add(ParameterVec4& p) { return registerParameterMeta(p); }
    WebControlGUI& add(ParameterColor& p) { return registerParameterMeta(p); }
    WebControlGUI& add(ParameterMenu& p) { return registerParameterMeta(p); }
    WebControlGUI& add(Trigger& p) { return registerParameterMeta(p); }

    // Bundle registration
    WebControlGUI& registerParameterBundle(ParameterBundle& bundle) {
        for (auto* param : bundle.parameters()) {
            registerParameterMeta(*param);
        }
        return *this;
    }

    WebControlGUI& operator<<(ParameterBundle& bundle) {
        return registerParameterBundle(bundle);
    }

    // Nav registration (no-op in web, navigation handled differently)
    template<typename NavType>
    WebControlGUI& registerNav(NavType&) { return *this; }

    // PresetHandler registration (future: will connect to localStorage presets)
    template<typename T>
    WebControlGUI& registerPresetHandler(T&, int = -1, int = -1) { return *this; }

    // =========================================================================
    // GUI Configuration
    // =========================================================================

    void setTitle(const std::string& title) { mTitle = title; }
    std::string title() const { return mTitle; }

    // Init - no-op in web (Vue handles initialization)
    void init() {}

    void setPosition(int x, int y) { mPosX = x; mPosY = y; }
    void setWidth(int w) { mWidth = w; }
    void setWidthAuto() { mWidth = -1; }

    // =========================================================================
    // Drawing (no-op in web, Vue handles rendering)
    // =========================================================================

    void draw() {
        // In web builds, the Vue panel handles drawing
        // This is called in the render loop but does nothing
#ifdef __EMSCRIPTEN__
        // Update any parameter values that changed from C++ side
        syncParametersToJS();
#endif
    }

    void begin() {}
    void end() {}

    bool usingInput() const { return mUsingInput; }

    // =========================================================================
    // Parameter Access (for JavaScript interop)
    // =========================================================================

    size_t parameterCount() const { return mParameters.size(); }

    ParameterMeta* getParameter(size_t index) {
        if (index < mParameters.size()) {
            return mParameters[index];
        }
        return nullptr;
    }

    ParameterMeta* getParameterByName(const std::string& name) {
        for (auto* p : mParameters) {
            if (p->getName() == name) return p;
        }
        return nullptr;
    }

    // Get parameter info for JavaScript
    WebParamInfo getParameterInfo(size_t index) {
        WebParamInfo info;
        if (index >= mParameters.size()) return info;

        ParameterMeta* p = mParameters[index];
        info.name = p->getName();
        info.group = p->getGroup();
        info.index = static_cast<int>(index);

        // Determine type and get value/range
        if (auto* fp = dynamic_cast<Parameter*>(p)) {
            info.type = WebParamType::FLOAT;
            info.min = fp->min();
            info.max = fp->max();
            info.value = fp->get();
            info.defaultValue = fp->getDefault();
        } else if (auto* ip = dynamic_cast<ParameterInt*>(p)) {
            info.type = WebParamType::INT;
            info.min = static_cast<float>(ip->min());
            info.max = static_cast<float>(ip->max());
            info.value = static_cast<float>(ip->get());
            info.defaultValue = static_cast<float>(ip->getDefault());
        } else if (auto* bp = dynamic_cast<ParameterBool*>(p)) {
            info.type = WebParamType::BOOL;
            info.min = 0;
            info.max = 1;
            info.value = bp->get() ? 1.0f : 0.0f;
            info.defaultValue = bp->getDefault() ? 1.0f : 0.0f;
        } else if (auto* mp = dynamic_cast<ParameterMenu*>(p)) {
            info.type = WebParamType::MENU;
            info.min = 0;
            info.max = static_cast<float>(mp->max());
            info.value = static_cast<float>(mp->get());
            info.defaultValue = static_cast<float>(mp->getDefault());
            // Get menu items
            auto elements = mp->getElements();
            for (const auto& elem : elements) {
                info.menuItems.push_back(elem);
            }
        } else if (dynamic_cast<ParameterVec3*>(p)) {
            info.type = WebParamType::VEC3;
        } else if (dynamic_cast<ParameterVec4*>(p)) {
            info.type = WebParamType::VEC4;
        } else if (dynamic_cast<ParameterColor*>(p)) {
            info.type = WebParamType::COLOR;
        } else if (dynamic_cast<Trigger*>(p)) {
            info.type = WebParamType::TRIGGER;
        } else if (dynamic_cast<ParameterString*>(p)) {
            info.type = WebParamType::STRING;
        }

        return info;
    }

    // Set parameter value from JavaScript
    void setParameterValue(size_t index, float value) {
        if (index >= mParameters.size()) return;

        ParameterMeta* p = mParameters[index];

        if (auto* fp = dynamic_cast<Parameter*>(p)) {
            fp->set(value);
        } else if (auto* ip = dynamic_cast<ParameterInt*>(p)) {
            ip->set(static_cast<int>(value));
        } else if (auto* bp = dynamic_cast<ParameterBool*>(p)) {
            bp->set(value > 0.5f);
        } else if (auto* mp = dynamic_cast<ParameterMenu*>(p)) {
            mp->set(static_cast<int>(value));
        }
    }

    // Set string parameter value
    void setParameterString(size_t index, const std::string& value) {
        if (index >= mParameters.size()) return;

        if (auto* sp = dynamic_cast<ParameterString*>(mParameters[index])) {
            sp->set(value);
        }
    }

    // Trigger a trigger parameter
    void triggerParameter(size_t index) {
        if (index >= mParameters.size()) return;

        if (auto* tp = dynamic_cast<Trigger*>(mParameters[index])) {
            tp->trigger();
        }
    }

    // Set Vec3 parameter
    void setParameterVec3(size_t index, float x, float y, float z) {
        if (index >= mParameters.size()) return;

        if (auto* vp = dynamic_cast<ParameterVec3*>(mParameters[index])) {
            vp->set(Vec3f(x, y, z));
        }
    }

    // Set Vec4/Color parameter
    void setParameterVec4(size_t index, float x, float y, float z, float w) {
        if (index >= mParameters.size()) return;

        if (auto* vp = dynamic_cast<ParameterVec4*>(mParameters[index])) {
            vp->set(Vec4f(x, y, z, w));
        } else if (auto* cp = dynamic_cast<ParameterColor*>(mParameters[index])) {
            cp->set(Color(x, y, z, w));
        }
    }

    // Get current float value
    float getParameterValue(size_t index) {
        if (index >= mParameters.size()) return 0;

        ParameterMeta* p = mParameters[index];

        if (auto* fp = dynamic_cast<Parameter*>(p)) {
            return fp->get();
        } else if (auto* ip = dynamic_cast<ParameterInt*>(p)) {
            return static_cast<float>(ip->get());
        } else if (auto* bp = dynamic_cast<ParameterBool*>(p)) {
            return bp->get() ? 1.0f : 0.0f;
        } else if (auto* mp = dynamic_cast<ParameterMenu*>(p)) {
            return static_cast<float>(mp->get());
        }
        return 0;
    }

private:
    std::vector<ParameterMeta*> mParameters;
    std::string mTitle = "Parameters";
    int mPosX = 10;
    int mPosY = 10;
    int mWidth = 300;
    bool mUsingInput = false;

#ifdef __EMSCRIPTEN__
    // Track last known values for change detection
    std::vector<float> mLastValues;

    void notifyParameterAdded(ParameterMeta& param) {
        // Notify JavaScript that a parameter was added
        size_t index = mParameters.size() - 1;
        WebParamInfo info = getParameterInfo(index);

        EM_ASM({
            if (window.allolib && window.allolib.onParameterAdded) {
                window.allolib.onParameterAdded({
                    index: $0,
                    name: UTF8ToString($1),
                    group: UTF8ToString($2),
                    type: $3,
                    min: $4,
                    max: $5,
                    value: $6,
                    defaultValue: $7
                });
            }
        }, index, info.name.c_str(), info.group.c_str(),
           static_cast<int>(info.type), info.min, info.max, info.value, info.defaultValue);

        mLastValues.push_back(info.value);
    }

    void syncParametersToJS() {
        // Check for value changes and notify JS
        for (size_t i = 0; i < mParameters.size(); i++) {
            float currentValue = getParameterValue(i);
            if (i < mLastValues.size() && mLastValues[i] != currentValue) {
                mLastValues[i] = currentValue;
                EM_ASM({
                    if (window.allolib && window.allolib.onParameterChanged) {
                        window.allolib.onParameterChanged($0, $1);
                    }
                }, i, currentValue);
            }
        }
    }

    // Global instance management for JS access
    static WebControlGUI* sActiveInstance;

    static void registerGlobalInstance(WebControlGUI* gui) {
        sActiveInstance = gui;
    }

    static void unregisterGlobalInstance(WebControlGUI* gui) {
        if (sActiveInstance == gui) {
            sActiveInstance = nullptr;
        }
    }

public:
    static WebControlGUI* getActiveInstance() {
        return sActiveInstance;
    }
#endif
};

#ifdef __EMSCRIPTEN__
// Static member definition
inline WebControlGUI* WebControlGUI::sActiveInstance = nullptr;
#endif

} // namespace al

// ============================================================================
// C exports for JavaScript interop
// These override the weak stubs in al_WebControlGUI.cpp when this header is included
// ============================================================================

#ifdef __EMSCRIPTEN__

extern "C" {

// Use __attribute__((used)) to ensure these aren't stripped, and they will
// override the weak stubs from al_WebControlGUI.cpp
__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline int al_webgui_get_parameter_count() {
    auto* gui = al::WebControlGUI::getActiveInstance();
    return gui ? static_cast<int>(gui->parameterCount()) : 0;
}

__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline const char* al_webgui_get_parameter_name(int index) {
    static std::string name;
    auto* gui = al::WebControlGUI::getActiveInstance();
    if (gui) {
        auto* param = gui->getParameter(index);
        if (param) {
            name = param->getName();
            return name.c_str();
        }
    }
    return "";
}

__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline const char* al_webgui_get_parameter_group(int index) {
    static std::string group;
    auto* gui = al::WebControlGUI::getActiveInstance();
    if (gui) {
        auto* param = gui->getParameter(index);
        if (param) {
            group = param->getGroup();
            return group.c_str();
        }
    }
    return "";
}

__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline int al_webgui_get_parameter_type(int index) {
    auto* gui = al::WebControlGUI::getActiveInstance();
    if (gui) {
        auto info = gui->getParameterInfo(index);
        return static_cast<int>(info.type);
    }
    return 0;
}

__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline float al_webgui_get_parameter_min(int index) {
    auto* gui = al::WebControlGUI::getActiveInstance();
    if (gui) {
        auto info = gui->getParameterInfo(index);
        return info.min;
    }
    return 0;
}

__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline float al_webgui_get_parameter_max(int index) {
    auto* gui = al::WebControlGUI::getActiveInstance();
    if (gui) {
        auto info = gui->getParameterInfo(index);
        return info.max;
    }
    return 1;
}

__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline float al_webgui_get_parameter_value(int index) {
    auto* gui = al::WebControlGUI::getActiveInstance();
    if (gui) {
        return gui->getParameterValue(index);
    }
    return 0;
}

__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline float al_webgui_get_parameter_default(int index) {
    auto* gui = al::WebControlGUI::getActiveInstance();
    if (gui) {
        auto info = gui->getParameterInfo(index);
        return info.defaultValue;
    }
    return 0;
}

__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline void al_webgui_set_parameter_value(int index, float value) {
    auto* gui = al::WebControlGUI::getActiveInstance();
    if (gui) {
        gui->setParameterValue(index, value);
    }
}

__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline void al_webgui_set_parameter_string(int index, const char* value) {
    auto* gui = al::WebControlGUI::getActiveInstance();
    if (gui) {
        gui->setParameterString(index, value ? value : "");
    }
}

__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline void al_webgui_trigger_parameter(int index) {
    auto* gui = al::WebControlGUI::getActiveInstance();
    if (gui) {
        gui->triggerParameter(index);
    }
}

__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline void al_webgui_set_parameter_vec3(int index, float x, float y, float z) {
    auto* gui = al::WebControlGUI::getActiveInstance();
    if (gui) {
        gui->setParameterVec3(index, x, y, z);
    }
}

__attribute__((used)) EMSCRIPTEN_KEEPALIVE
inline void al_webgui_set_parameter_vec4(int index, float x, float y, float z, float w) {
    auto* gui = al::WebControlGUI::getActiveInstance();
    if (gui) {
        gui->setParameterVec4(index, x, y, z, w);
    }
}

} // extern "C"
#endif

#endif // AL_WEB_CONTROL_GUI_HPP
