/**
 * Skybox Vertex Shader
 * Source: al_WebEnvironment.hpp - skybox_vert_shader()
 */
#version 300 es
precision highp float;
precision highp int;

layout (location = 0) in vec3 position;
uniform mat4 al_ModelViewMatrix;
uniform mat4 al_ProjectionMatrix;
out vec3 vDirection;

void main() {
    // Remove translation from view matrix for skybox
    mat4 viewNoTranslate = al_ModelViewMatrix;
    viewNoTranslate[3][0] = 0.0;
    viewNoTranslate[3][1] = 0.0;
    viewNoTranslate[3][2] = 0.0;

    vec4 pos = al_ProjectionMatrix * viewNoTranslate * vec4(position, 1.0);
    // Set z to w so the skybox is always at max depth
    gl_Position = pos.xyww;
    vDirection = position;
}
