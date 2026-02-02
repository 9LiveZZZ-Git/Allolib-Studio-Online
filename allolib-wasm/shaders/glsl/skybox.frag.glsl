/**
 * Skybox Fragment Shader
 * Source: al_WebEnvironment.hpp - skybox_frag_shader()
 */
#version 300 es
precision highp float;
precision highp int;

in vec3 vDirection;
uniform sampler2D envMap;
uniform float exposure;
uniform float gamma;
out vec4 frag_color;

const float PI = 3.14159265359;

vec2 directionToUV(vec3 dir) {
    // Equirectangular mapping
    float phi = atan(dir.z, dir.x);    // -PI to PI
    float theta = acos(dir.y);         // 0 to PI

    float u = (phi + PI) / (2.0 * PI); // 0 to 1
    float v = theta / PI;               // 0 to 1

    return vec2(u, v);
}

void main() {
    vec3 dir = normalize(vDirection);
    vec2 uv = directionToUV(dir);

    vec3 hdrColor = texture(envMap, uv).rgb;

    // Tone mapping (Reinhard)
    vec3 mapped = hdrColor * exposure;
    mapped = mapped / (vec3(1.0) + mapped);

    // Gamma correction
    mapped = pow(mapped, vec3(1.0 / gamma));

    frag_color = vec4(mapped, 1.0);
}
