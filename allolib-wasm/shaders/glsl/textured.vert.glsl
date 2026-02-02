/**
 * Textured Vertex Shader
 * Source: al_DefaultShaders.hpp - al_tex_vert_shader()
 */
#version 300 es
precision highp float;
precision highp int;

uniform mat4 al_ModelViewMatrix;
uniform mat4 al_ProjectionMatrix;
layout (location = 0) in vec3 position;
layout (location = 2) in vec2 texcoord;
uniform float eye_sep;
uniform float foc_len;
uniform float al_PointSize;
out vec2 texcoord_;

vec4 stereo_displace(vec4 v, float e, float f) {
    float l = sqrt((v.x - e) * (v.x - e) + v.y * v.y + v.z * v.z);
    float z = abs(v.z);
    float t = f * (v.x - e) / z;
    v.x = z * (e + t) / f;
    v.xyz = normalize(v.xyz);
    v.xyz *= l;
    return v;
}

void main() {
    if (eye_sep == 0.0) {
        gl_Position = al_ProjectionMatrix * al_ModelViewMatrix * vec4(position, 1.0);
    } else {
        gl_Position = al_ProjectionMatrix * stereo_displace(al_ModelViewMatrix * vec4(position, 1.0), eye_sep, foc_len);
    }
    texcoord_ = texcoord;
    gl_PointSize = al_PointSize > 0.0 ? al_PointSize : 5.0;
}
