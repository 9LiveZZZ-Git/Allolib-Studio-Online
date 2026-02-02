/**
 * Uniform Color Fragment Shader
 *
 * WGSL equivalent of al_color_frag_shader() from al_DefaultShaders.hpp
 *
 * Output:
 *   - Uniform color with tint applied
 */

struct Uniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    color: vec4f,
    tint: vec4f,
    pointSize: f32,
    eyeSep: f32,
    focLen: f32,
    _pad: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn fs_main() -> @location(0) vec4f {
    return uniforms.color * uniforms.tint;
}
