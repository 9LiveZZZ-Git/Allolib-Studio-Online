/**
 * Lighting Fragment Shader (Phong/Blinn)
 *
 * WGSL equivalent of multilight_frag_shader() from al_DefaultShaders.hpp
 *
 * Implements multi-light Phong/Blinn-Phong shading with:
 *   - Up to 8 point lights
 *   - Ambient, diffuse, and specular components
 *   - Distance attenuation
 *   - Material properties
 *
 * Inputs:
 *   - viewPos (location 0): view space position
 *   - viewNormal (location 1): view space normal
 *   - color (location 2): vertex color
 *   - texcoord (location 3): texture coordinates
 *
 * Output:
 *   - Final lit color
 */

const MAX_LIGHTS: u32 = 8u;

struct Light {
    position: vec4f,
    ambient: vec4f,
    diffuse: vec4f,
    specular: vec4f,
    attenuation: vec3f,  // constant, linear, quadratic
    enabled: f32,
}

struct Material {
    ambient: vec4f,
    diffuse: vec4f,
    specular: vec4f,
    emission: vec4f,
    shininess: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
}

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

struct LightingUniforms {
    globalAmbient: vec4f,
    numLights: u32,
    _pad0: u32,
    _pad1: u32,
    _pad2: u32,
    lights: array<Light, 8>,
    material: Material,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<uniform> lighting: LightingUniforms;

struct FragmentInput {
    @location(0) viewPos: vec3f,
    @location(1) viewNormal: vec3f,
    @location(2) color: vec4f,
    @location(3) texcoord: vec2f,
}

fn calculateLight(lightIndex: u32, N: vec3f, V: vec3f, fragPos: vec3f) -> vec3f {
    let light = lighting.lights[lightIndex];

    if (light.enabled < 0.5) {
        return vec3f(0.0);
    }

    // Direction from fragment to light
    let L = normalize(light.position.xyz - fragPos);

    // Halfway vector for Blinn-Phong
    let H = normalize(L + V);

    // Distance attenuation
    let distance = length(light.position.xyz - fragPos);
    let attenuation = 1.0 / (light.attenuation.x +
                             light.attenuation.y * distance +
                             light.attenuation.z * distance * distance);

    // Ambient
    let ambient = light.ambient.rgb * lighting.material.ambient.rgb;

    // Diffuse
    let diff = max(dot(N, L), 0.0);
    let diffuse = light.diffuse.rgb * diff * lighting.material.diffuse.rgb;

    // Specular (Blinn-Phong)
    let spec = pow(max(dot(N, H), 0.0), lighting.material.shininess);
    let specular = light.specular.rgb * spec * lighting.material.specular.rgb;

    return (ambient + diffuse + specular) * attenuation;
}

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4f {
    let N = normalize(in.viewNormal);
    let V = normalize(-in.viewPos);  // View direction (from fragment to camera at origin)

    // Start with global ambient and emission
    var result = lighting.globalAmbient.rgb * lighting.material.ambient.rgb;
    result += lighting.material.emission.rgb;

    // Accumulate light contributions
    for (var i = 0u; i < min(lighting.numLights, MAX_LIGHTS); i++) {
        result += calculateLight(i, N, V, in.viewPos);
    }

    // Apply vertex color and tint
    let finalColor = vec4f(result, 1.0) * in.color * uniforms.tint;

    return finalColor;
}
