/**
 * Mesh Fragment Shader - Per-vertex colors
 * Source: al_DefaultShaders.hpp - al_mesh_frag_shader()
 */
#version 300 es
precision highp float;
precision highp int;

uniform vec4 tint;
in vec4 color_;
out vec4 frag_color;

void main() {
    frag_color = color_ * tint;
}
