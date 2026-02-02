/**
 * Uniform Color Fragment Shader
 * Source: al_DefaultShaders.hpp - al_color_frag_shader()
 */
#version 300 es
precision highp float;
precision highp int;

uniform vec4 col0;
uniform vec4 tint;
out vec4 frag_color;

void main() {
    frag_color = col0 * tint;
}
