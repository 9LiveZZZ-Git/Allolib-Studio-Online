/**
 * WebControlGUI C exports — strong definitions.
 *
 * Previously this file held weak stubs intended to be overridden by `inline`
 * definitions in al_WebControlGUI.hpp. That doesn't work: `inline` functions
 * are weak symbols in C++, and weak-vs-weak resolves to whichever the linker
 * sees first — usually this .cpp (it's pulled in to satisfy the
 * EXPORTED_FUNCTIONS list directly), so the header's logic was dead. The
 * Studio Params panel showed empty for parameters registered through any
 * route (PresetHandler, ParameterServer, gui<<p) because every export
 * collapsed to "0".
 *
 * The C exports now live here as the single, strong definitions. They read
 * from `WebControlGUI::getActiveInstance()` exactly like the header copies
 * intended; the inline copies still in the header are harmless (weak; .cpp
 * wins) but should eventually be removed.
 */

#ifdef __EMSCRIPTEN__

#include <emscripten.h>
#include <string>

#include "al_WebControlGUI.hpp"

using al::WebControlGUI;

extern "C" {

EMSCRIPTEN_KEEPALIVE
int al_webgui_get_parameter_count() {
    auto* gui = WebControlGUI::getActiveInstance();
    return gui ? static_cast<int>(gui->parameterCount()) : 0;
}

EMSCRIPTEN_KEEPALIVE
const char* al_webgui_get_parameter_name(int index) {
    static std::string name;
    auto* gui = WebControlGUI::getActiveInstance();
    if (gui) {
        auto* p = gui->getParameter(index);
        if (p) { name = p->getName(); return name.c_str(); }
    }
    return "";
}

EMSCRIPTEN_KEEPALIVE
const char* al_webgui_get_parameter_group(int index) {
    static std::string group;
    auto* gui = WebControlGUI::getActiveInstance();
    if (gui) {
        auto* p = gui->getParameter(index);
        if (p) { group = p->getGroup(); return group.c_str(); }
    }
    return "";
}

EMSCRIPTEN_KEEPALIVE
int al_webgui_get_parameter_type(int index) {
    auto* gui = WebControlGUI::getActiveInstance();
    if (!gui) return 0;
    return static_cast<int>(gui->getParameterInfo(index).type);
}

EMSCRIPTEN_KEEPALIVE
float al_webgui_get_parameter_min(int index) {
    auto* gui = WebControlGUI::getActiveInstance();
    if (!gui) return 0.f;
    return gui->getParameterInfo(index).min;
}

EMSCRIPTEN_KEEPALIVE
float al_webgui_get_parameter_max(int index) {
    auto* gui = WebControlGUI::getActiveInstance();
    if (!gui) return 1.f;
    return gui->getParameterInfo(index).max;
}

EMSCRIPTEN_KEEPALIVE
float al_webgui_get_parameter_value(int index) {
    auto* gui = WebControlGUI::getActiveInstance();
    if (!gui) return 0.f;
    return gui->getParameterValue(index);
}

EMSCRIPTEN_KEEPALIVE
float al_webgui_get_parameter_default(int index) {
    auto* gui = WebControlGUI::getActiveInstance();
    if (!gui) return 0.f;
    return gui->getParameterInfo(index).defaultValue;
}

EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_value(int index, float value) {
    auto* gui = WebControlGUI::getActiveInstance();
    if (gui) gui->setParameterValue(index, value);
}

EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_string(int index, const char* value) {
    auto* gui = WebControlGUI::getActiveInstance();
    if (gui) gui->setParameterString(index, value ? value : "");
}

EMSCRIPTEN_KEEPALIVE
void al_webgui_trigger_parameter(int index) {
    auto* gui = WebControlGUI::getActiveInstance();
    if (gui) gui->triggerParameter(index);
}

EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_vec3(int index, float x, float y, float z) {
    auto* gui = WebControlGUI::getActiveInstance();
    if (gui) gui->setParameterVec3(index, x, y, z);
}

EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_vec4(int index, float x, float y, float z, float w) {
    auto* gui = WebControlGUI::getActiveInstance();
    if (gui) gui->setParameterVec4(index, x, y, z, w);
}

EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_pose(int index, float x, float y, float z,
                                  float qw, float qx, float qy, float qz) {
    auto* gui = WebControlGUI::getActiveInstance();
    if (gui) gui->setParameterPose(index, x, y, z, qw, qx, qy, qz);
}

} // extern "C"

#endif // __EMSCRIPTEN__
