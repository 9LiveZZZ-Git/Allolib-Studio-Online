/**
 * PBR Vertex Shader
 *
 * WGSL equivalent of pbr_vert_shader() from al_WebPBR.hpp
 *
 * Transforms vertex data for physically-based rendering with IBL.
 *
 * Inputs:
 *   - position (location 0): vec3f vertex position
 *   - normal (location 3): vec3f vertex normal
 *   - texcoord (location 2): vec2f texture coordinates (optional)
 *
 * Outputs:
 *   - position: clip space position
 *   - worldPos: world space position for lighting
 *   - normal: world space normal
 *   - texcoord: texture coordinates
 */

struct Uniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    normalMatrix: mat4x4f,
    cameraPos: vec3f,
    _pad0: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec3f,
    @location(2) texcoord: vec2f,
    @location(3) normal: vec3f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) worldPos: vec3f,
    @location(1) normal: vec3f,
    @location(2) texcoord: vec2f,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    let worldPos = uniforms.modelViewMatrix * vec4f(in.position, 1.0);
    out.worldPos = worldPos.xyz;
    out.position = uniforms.projectionMatrix * worldPos;

    // Transform normal to world space using normal matrix (upper-left 3x3)
    let normalMat = mat3x3f(
        uniforms.normalMatrix[0].xyz,
        uniforms.normalMatrix[1].xyz,
        uniforms.normalMatrix[2].xyz
    );
    out.normal = normalize(normalMat * in.normal);

    out.texcoord = in.texcoord;

    return out;
}
