/**
 * Skybox Vertex Shader
 *
 * WGSL equivalent of skybox_vert_shader() from al_WebEnvironment.hpp
 *
 * Renders a skybox using equirectangular environment mapping.
 * Removes translation from view matrix so skybox stays at infinity.
 *
 * Inputs:
 *   - position (location 0): vec3f cube vertex position
 *
 * Outputs:
 *   - position: clip space position (z set to w for max depth)
 *   - direction: view direction for environment sampling
 */

struct Uniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    exposure: f32,
    gamma: f32,
    _pad0: f32,
    _pad1: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec3f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) direction: vec3f,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    // Remove translation from view matrix for skybox
    var viewNoTranslate = uniforms.modelViewMatrix;
    viewNoTranslate[3][0] = 0.0;
    viewNoTranslate[3][1] = 0.0;
    viewNoTranslate[3][2] = 0.0;

    var pos = uniforms.projectionMatrix * viewNoTranslate * vec4f(in.position, 1.0);

    // Set z to w so the skybox is always at max depth
    out.position = vec4f(pos.xy, pos.w, pos.w);
    out.direction = in.position;

    return out;
}
