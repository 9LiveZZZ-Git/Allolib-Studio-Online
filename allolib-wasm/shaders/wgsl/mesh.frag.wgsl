/**
 * Mesh Fragment Shader - Per-vertex colors
 *
 * WGSL equivalent of al_mesh_frag_shader() from al_DefaultShaders.hpp
 *
 * Inputs:
 *   - color (location 0): interpolated vertex color
 *
 * Output:
 *   - Final fragment color with tint applied
 */

struct Uniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    tint: vec4f,
    pointSize: f32,
    eyeSep: f32,
    focLen: f32,
    _pad: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
    @location(0) color: vec4f,
}

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4f {
    return in.color * uniforms.tint;
}
