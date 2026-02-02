/**
 * Textured Fragment Shader
 *
 * WGSL equivalent of al_tex_frag_shader() from al_DefaultShaders.hpp
 *
 * Inputs:
 *   - texcoord (location 0): interpolated texture coordinates
 *
 * Output:
 *   - Sampled texture color with tint applied
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
@group(0) @binding(1) var tex0: texture_2d<f32>;
@group(0) @binding(2) var samp0: sampler;

struct FragmentInput {
    @location(0) texcoord: vec2f,
}

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4f {
    let texColor = textureSample(tex0, samp0, in.texcoord);
    return texColor * uniforms.tint;
}
