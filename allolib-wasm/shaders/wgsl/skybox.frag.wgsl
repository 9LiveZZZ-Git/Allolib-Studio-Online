/**
 * Skybox Fragment Shader
 *
 * WGSL equivalent of skybox_frag_shader() from al_WebEnvironment.hpp
 *
 * Samples equirectangular HDR environment map and applies tone mapping.
 *
 * Inputs:
 *   - direction (location 0): view direction for environment sampling
 *
 * Output:
 *   - Tone-mapped and gamma-corrected environment color
 */

const PI: f32 = 3.14159265359;

struct Uniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    exposure: f32,
    gamma: f32,
    _pad0: f32,
    _pad1: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var envMap: texture_2d<f32>;
@group(0) @binding(2) var envSampler: sampler;

struct FragmentInput {
    @location(0) direction: vec3f,
}

// Convert 3D direction to equirectangular UV coordinates
fn directionToUV(dir: vec3f) -> vec2f {
    // Equirectangular mapping
    let phi = atan2(dir.z, dir.x);    // -PI to PI
    let theta = acos(dir.y);          // 0 to PI

    let u = (phi + PI) / (2.0 * PI);  // 0 to 1
    let v = theta / PI;                // 0 to 1

    return vec2f(u, v);
}

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4f {
    let dir = normalize(in.direction);
    let uv = directionToUV(dir);

    let hdrColor = textureSample(envMap, envSampler, uv).rgb;

    // Tone mapping (Reinhard)
    var mapped = hdrColor * uniforms.exposure;
    mapped = mapped / (vec3f(1.0) + mapped);

    // Gamma correction
    mapped = pow(mapped, vec3f(1.0 / uniforms.gamma));

    return vec4f(mapped, 1.0);
}
