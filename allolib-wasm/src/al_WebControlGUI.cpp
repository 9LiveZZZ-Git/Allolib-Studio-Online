/**
 * WebControlGUI C exports — strong definitions, registry-backed (v0.7.1).
 *
 * Pre-v0.7.1: the exports read from `WebControlGUI::getActiveInstance()`,
 * which is the static `sActiveInstance` set by the most-recently-constructed
 * WebControlGUI ctor. Two competing function-statics (one in WebApp::start,
 * one in WebPresetHandler::mirrorToActiveGui) raced for that slot, so the
 * panel could see whichever instance happened to win — sometimes both,
 * sometimes neither. See PARAMETER_PIPELINE_PLAN.md § audit.
 *
 * v0.7.1 phase 2: the exports look up the parameter via
 * `ParameterRegistry::global().at(index)` (the canonical singleton from
 * v0.7.0) and dispatch through the static `WebControlGUI::dispatchXxx`
 * helpers. No instance lookup, no sActiveInstance race. Every parameter
 * registered through ANY route — `gui << p`, `mPresets << p` (phase 3),
 * `parameterServer() << p` (phase 4) — feeds the registry, which is what
 * the JS bridge reads.
 *
 * The registry's pointer-dedup keeps the call idempotent; the panel sees
 * insertion order regardless of which path registered first.
 */

#ifdef __EMSCRIPTEN__

#include <emscripten.h>
#include <string>

#include "al_WebControlGUI.hpp"
#include "al_parameter_registry.hpp"
#include "al/ui/al_Parameter.hpp"

using al::WebControlGUI;
using al::ParameterMeta;
using al::ParameterRegistry;

// ─── Static dispatchers ────────────────────────────────────────────────────
//
// Type-aware lookups that take a ParameterMeta* directly. Pre-v0.7.1 the
// equivalent logic lived in instance methods (`getParameterInfo(idx)` etc.),
// which read from the WebControlGUI instance's mParameters. The static
// versions here read nothing instance-specific; they just dynamic_cast the
// pointer and act on the typed parameter.

al::WebParamInfo WebControlGUI::dispatchInfo(ParameterMeta* p, int index) {
    al::WebParamInfo info;
    if (!p) return info;
    info.name  = p->getName();
    info.group = p->getGroup();
    info.index = index;

    if (auto* fp = dynamic_cast<al::Parameter*>(p)) {
        info.type = al::WebParamType::FLOAT;
        info.min  = fp->min(); info.max = fp->max();
        info.value = fp->get(); info.defaultValue = fp->getDefault();
    } else if (auto* ip = dynamic_cast<al::ParameterInt*>(p)) {
        info.type = al::WebParamType::INT;
        info.min  = (float)ip->min(); info.max = (float)ip->max();
        info.value = (float)ip->get(); info.defaultValue = (float)ip->getDefault();
    } else if (auto* bp = dynamic_cast<al::ParameterBool*>(p)) {
        info.type = al::WebParamType::BOOL;
        info.min  = 0; info.max = 1;
        info.value = bp->get() ? 1.f : 0.f;
        info.defaultValue = bp->getDefault() ? 1.f : 0.f;
    } else if (auto* mp = dynamic_cast<al::ParameterMenu*>(p)) {
        info.type = al::WebParamType::MENU;
        info.menuItems = mp->getElements();
        info.min = 0; info.max = (float)info.menuItems.size() - 1;
        info.value = (float)mp->get(); info.defaultValue = (float)mp->getDefault();
    } else if (auto* tp = dynamic_cast<al::Trigger*>(p)) {
        info.type = al::WebParamType::TRIGGER;
        info.min = 0; info.max = 1; info.value = 0; info.defaultValue = 0;
        (void)tp;
    } else if (auto* sp = dynamic_cast<al::ParameterString*>(p)) {
        info.type = al::WebParamType::STRING;
        info.stringValue = sp->get();
    } else if (auto* vp3 = dynamic_cast<al::ParameterVec3*>(p)) {
        info.type = al::WebParamType::VEC3;
        auto v = vp3->get();
        info.components = {v.x, v.y, v.z};
    } else if (auto* vp4 = dynamic_cast<al::ParameterVec4*>(p)) {
        info.type = al::WebParamType::VEC4;
        auto v = vp4->get();
        info.components = {v.x, v.y, v.z, v.w};
    } else if (auto* cp = dynamic_cast<al::ParameterColor*>(p)) {
        info.type = al::WebParamType::COLOR;
        auto c = cp->get();
        info.components = {c.r, c.g, c.b, c.a};
    } else if (auto* pp = dynamic_cast<al::ParameterPose*>(p)) {
        info.type = al::WebParamType::POSE;
        auto pose = pp->get();
        // POSE component layout: x, y, z, qw, qx, qy, qz (7 floats).
        info.components = {
            (float)pose.pos().x, (float)pose.pos().y, (float)pose.pos().z,
            (float)pose.quat().w, (float)pose.quat().x,
            (float)pose.quat().y, (float)pose.quat().z
        };
    }
    return info;
}

float WebControlGUI::dispatchGetValue(ParameterMeta* p) {
    if (!p) return 0.f;
    if (auto* fp = dynamic_cast<al::Parameter*>(p))      return fp->get();
    if (auto* ip = dynamic_cast<al::ParameterInt*>(p))   return (float)ip->get();
    if (auto* bp = dynamic_cast<al::ParameterBool*>(p))  return bp->get() ? 1.f : 0.f;
    if (auto* mp = dynamic_cast<al::ParameterMenu*>(p))  return (float)mp->get();
    return 0.f;
}

void WebControlGUI::dispatchSetValue(ParameterMeta* p, float value) {
    if (!p) return;
    if (auto* fp = dynamic_cast<al::Parameter*>(p))         fp->set(value);
    else if (auto* ip = dynamic_cast<al::ParameterInt*>(p)) ip->set((int)value);
    else if (auto* bp = dynamic_cast<al::ParameterBool*>(p))bp->set(value > 0.5f);
    else if (auto* mp = dynamic_cast<al::ParameterMenu*>(p))mp->set((int)value);
}

void WebControlGUI::dispatchSetString(ParameterMeta* p, const std::string& value) {
    if (auto* sp = dynamic_cast<al::ParameterString*>(p)) sp->set(value);
}

void WebControlGUI::dispatchTrigger(ParameterMeta* p) {
    if (auto* tp = dynamic_cast<al::Trigger*>(p)) tp->trigger();
}

void WebControlGUI::dispatchSetVec3(ParameterMeta* p, float x, float y, float z) {
    if (auto* vp = dynamic_cast<al::ParameterVec3*>(p)) vp->set(al::Vec3f(x, y, z));
}

void WebControlGUI::dispatchSetVec4(ParameterMeta* p, float x, float y, float z, float w) {
    if (auto* vp = dynamic_cast<al::ParameterVec4*>(p))     vp->set(al::Vec4f(x, y, z, w));
    else if (auto* cp = dynamic_cast<al::ParameterColor*>(p)) cp->set(al::Color(x, y, z, w));
}

void WebControlGUI::dispatchSetPose(ParameterMeta* p, float x, float y, float z,
                                    float qw, float qx, float qy, float qz) {
    if (auto* pp = dynamic_cast<al::ParameterPose*>(p)) {
        pp->set(al::Pose(al::Vec3d(x, y, z), al::Quatd(qw, qx, qy, qz)));
    }
}

// ─── C exports ─────────────────────────────────────────────────────────────
//
// All exports route through ParameterRegistry::global().at(index). No
// WebControlGUI instance lookup; the panel reads the canonical list.

extern "C" {

EMSCRIPTEN_KEEPALIVE
int al_webgui_get_parameter_count() {
    return static_cast<int>(ParameterRegistry::global().count());
}

EMSCRIPTEN_KEEPALIVE
const char* al_webgui_get_parameter_name(int index) {
    static std::string name;
    auto* p = ParameterRegistry::global().at(index);
    if (p) { name = p->getName(); return name.c_str(); }
    return "";
}

EMSCRIPTEN_KEEPALIVE
const char* al_webgui_get_parameter_group(int index) {
    static std::string group;
    auto* p = ParameterRegistry::global().at(index);
    if (p) { group = p->getGroup(); return group.c_str(); }
    return "";
}

EMSCRIPTEN_KEEPALIVE
int al_webgui_get_parameter_type(int index) {
    auto* p = ParameterRegistry::global().at(index);
    return static_cast<int>(WebControlGUI::dispatchInfo(p, index).type);
}

EMSCRIPTEN_KEEPALIVE
float al_webgui_get_parameter_min(int index) {
    auto* p = ParameterRegistry::global().at(index);
    return p ? WebControlGUI::dispatchInfo(p, index).min : 0.f;
}

EMSCRIPTEN_KEEPALIVE
float al_webgui_get_parameter_max(int index) {
    auto* p = ParameterRegistry::global().at(index);
    return p ? WebControlGUI::dispatchInfo(p, index).max : 1.f;
}

EMSCRIPTEN_KEEPALIVE
float al_webgui_get_parameter_value(int index) {
    auto* p = ParameterRegistry::global().at(index);
    return WebControlGUI::dispatchGetValue(p);
}

EMSCRIPTEN_KEEPALIVE
float al_webgui_get_parameter_default(int index) {
    auto* p = ParameterRegistry::global().at(index);
    return p ? WebControlGUI::dispatchInfo(p, index).defaultValue : 0.f;
}

EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_value(int index, float value) {
    auto* p = ParameterRegistry::global().at(index);
    WebControlGUI::dispatchSetValue(p, value);
}

EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_string(int index, const char* value) {
    auto* p = ParameterRegistry::global().at(index);
    WebControlGUI::dispatchSetString(p, value ? value : "");
}

EMSCRIPTEN_KEEPALIVE
void al_webgui_trigger_parameter(int index) {
    auto* p = ParameterRegistry::global().at(index);
    WebControlGUI::dispatchTrigger(p);
}

EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_vec3(int index, float x, float y, float z) {
    auto* p = ParameterRegistry::global().at(index);
    WebControlGUI::dispatchSetVec3(p, x, y, z);
}

EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_vec4(int index, float x, float y, float z, float w) {
    auto* p = ParameterRegistry::global().at(index);
    WebControlGUI::dispatchSetVec4(p, x, y, z, w);
}

EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_pose(int index, float x, float y, float z,
                                  float qw, float qx, float qy, float qz) {
    auto* p = ParameterRegistry::global().at(index);
    WebControlGUI::dispatchSetPose(p, x, y, z, qw, qx, qy, qz);
}

} // extern "C"

#endif // __EMSCRIPTEN__
