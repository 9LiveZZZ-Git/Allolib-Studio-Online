/**
 * WebControlGUI C exports - weak stub implementations
 *
 * This file provides WEAK stub implementations of the WebGUI C functions.
 * These are used when user code doesn't include al_WebControlGUI.hpp.
 *
 * When user code DOES include al_WebControlGUI.hpp, the strong (non-weak)
 * definitions in that header take precedence over these weak stubs.
 */

#ifdef __EMSCRIPTEN__

#include <emscripten.h>

extern "C" {

// All stubs are weak - they will be overridden by strong definitions from the header
__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
int al_webgui_get_parameter_count() {
    return 0;
}

__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
const char* al_webgui_get_parameter_name(int index) {
    (void)index;
    return "";
}

__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
const char* al_webgui_get_parameter_group(int index) {
    (void)index;
    return "";
}

__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
int al_webgui_get_parameter_type(int index) {
    (void)index;
    return 0;
}

__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
float al_webgui_get_parameter_min(int index) {
    (void)index;
    return 0.0f;
}

__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
float al_webgui_get_parameter_max(int index) {
    (void)index;
    return 1.0f;
}

__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
float al_webgui_get_parameter_value(int index) {
    (void)index;
    return 0.0f;
}

__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
float al_webgui_get_parameter_default(int index) {
    (void)index;
    return 0.0f;
}

__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_value(int index, float value) {
    (void)index;
    (void)value;
}

__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_string(int index, const char* value) {
    (void)index;
    (void)value;
}

__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
void al_webgui_trigger_parameter(int index) {
    (void)index;
}

__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_vec3(int index, float x, float y, float z) {
    (void)index;
    (void)x;
    (void)y;
    (void)z;
}

__attribute__((weak)) EMSCRIPTEN_KEEPALIVE
void al_webgui_set_parameter_vec4(int index, float x, float y, float z, float w) {
    (void)index;
    (void)x;
    (void)y;
    (void)z;
    (void)w;
}

} // extern "C"

#endif // __EMSCRIPTEN__
