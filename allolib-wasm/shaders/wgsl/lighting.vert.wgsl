/**
 * Lighting Vertex Shader (Phong/Blinn)
 *
 * WGSL equivalent of multilight_vert_shader() from al_DefaultShaders.hpp
 *
 * Transforms vertex data for multi-light Phong/Blinn shading.
 *
 * Inputs:
 *   - position (location 0): vec3f vertex position
 *   - normal (location 3): vec3f vertex normal
 *   - color (location 1): vec4f vertex color (optional)
 *   - texcoord (location 2): vec2f texture coordinates (optional)
 *
 * Outputs:
 *   - position: clip space position
 *   - viewPos: view space position for lighting
 *   - viewNormal: view space normal
 *   - color: vertex color (if per-vertex coloring)
 *   - texcoord: texture coordinates
 */

struct Uniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    normalMatrix: mat4x4f,
    tint: vec4f,
    pointSize: f32,
    eyeSep: f32,
    focLen: f32,
    _pad: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec3f,
    @location(1) color: vec4f,
    @location(2) texcoord: vec2f,
    @location(3) normal: vec3f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) viewPos: vec3f,
    @location(1) viewNormal: vec3f,
    @location(2) color: vec4f,
    @location(3) texcoord: vec2f,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    let viewPos = uniforms.modelViewMatrix * vec4f(in.position, 1.0);
    out.viewPos = viewPos.xyz;
    out.position = uniforms.projectionMatrix * viewPos;

    // Transform normal to view space
    let normalMat = mat3x3f(
        uniforms.normalMatrix[0].xyz,
        uniforms.normalMatrix[1].xyz,
        uniforms.normalMatrix[2].xyz
    );
    out.viewNormal = normalize(normalMat * in.normal);

    out.color = in.color;
    out.texcoord = in.texcoord;

    return out;
}
