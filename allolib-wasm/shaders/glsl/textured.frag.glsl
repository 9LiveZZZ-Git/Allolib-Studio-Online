/**
 * Textured Fragment Shader
 * Source: al_DefaultShaders.hpp - al_tex_frag_shader()
 */
#version 300 es
precision highp float;
precision highp int;

uniform sampler2D tex0;
uniform vec4 tint;
in vec2 texcoord_;
out vec4 frag_color;

void main() {
    frag_color = texture(tex0, texcoord_) * tint;
}
