/**
 * PBR Fragment Shader with Image-Based Lighting
 *
 * WGSL equivalent of pbr_frag_shader() from al_WebPBR.hpp
 *
 * Implements physically-based rendering with:
 *   - Metallic-roughness workflow
 *   - Image-based lighting (IBL) for diffuse and specular
 *   - Fresnel-Schlick approximation
 *   - GGX normal distribution function
 *   - Schlick-GGX geometry function
 *   - Reinhard tone mapping
 *   - Gamma correction
 *
 * Inputs:
 *   - worldPos (location 0): world space position
 *   - normal (location 1): world space normal
 *   - texcoord (location 2): texture coordinates
 *
 * Output:
 *   - Final PBR-lit, tone-mapped color
 */

const PI: f32 = 3.14159265359;

struct Uniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    normalMatrix: mat4x4f,
    cameraPos: vec3f,
    _pad0: f32,
}

struct MaterialUniforms {
    albedo: vec3f,
    metallic: f32,
    roughness: f32,
    ao: f32,
    exposure: f32,
    gamma: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<uniform> material: MaterialUniforms;
@group(0) @binding(2) var envMap: texture_2d<f32>;
@group(0) @binding(3) var envSampler: sampler;
@group(0) @binding(4) var brdfLUT: texture_2d<f32>;
@group(0) @binding(5) var brdfSampler: sampler;

struct FragmentInput {
    @location(0) worldPos: vec3f,
    @location(1) normal: vec3f,
    @location(2) texcoord: vec2f,
}

// Convert 3D direction to equirectangular UV coordinates
fn directionToUV(dir: vec3f) -> vec2f {
    let phi = atan2(dir.z, dir.x);
    let theta = acos(dir.y);
    let u = (phi + PI) / (2.0 * PI);
    let v = theta / PI;
    return vec2f(u, v);
}

// Fresnel-Schlick approximation
fn fresnelSchlick(cosTheta: f32, F0: vec3f) -> vec3f {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Fresnel-Schlick with roughness for IBL
fn fresnelSchlickRoughness(cosTheta: f32, F0: vec3f, roughness: f32) -> vec3f {
    return F0 + (max(vec3f(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// GGX Normal Distribution Function
fn distributionGGX(N: vec3f, H: vec3f, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let NdotH = max(dot(N, H), 0.0);
    let NdotH2 = NdotH * NdotH;

    let num = a2;
    var denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return num / denom;
}

// Schlick-GGX Geometry function (single direction)
fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
    let r = roughness + 1.0;
    let k = (r * r) / 8.0;

    let num = NdotV;
    let denom = NdotV * (1.0 - k) + k;

    return num / denom;
}

// Smith's Geometry function (both view and light directions)
fn geometrySmith(N: vec3f, V: vec3f, L: vec3f, roughness: f32) -> f32 {
    let NdotV = max(dot(N, V), 0.0);
    let NdotL = max(dot(N, L), 0.0);
    let ggx2 = geometrySchlickGGX(NdotV, roughness);
    let ggx1 = geometrySchlickGGX(NdotL, roughness);

    return ggx1 * ggx2;
}

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4f {
    let N = normalize(in.normal);
    let V = normalize(uniforms.cameraPos - in.worldPos);
    let R = reflect(-V, N);

    // Calculate F0 (base reflectivity)
    var F0 = vec3f(0.04);  // Dielectric default
    F0 = mix(F0, material.albedo, material.metallic);

    // Sample environment for IBL
    let envUV = directionToUV(N);
    let irradiance = textureSample(envMap, envSampler, envUV).rgb;

    let reflectUV = directionToUV(R);
    // Use roughness to simulate mip level (simplified - real IBL would use prefiltered maps)
    let prefilteredColor = textureSample(envMap, envSampler, reflectUV).rgb;

    // BRDF lookup
    let NdotV = max(dot(N, V), 0.0);
    let brdf = textureSample(brdfLUT, brdfSampler, vec2f(NdotV, material.roughness)).rg;

    // Fresnel for IBL
    let F = fresnelSchlickRoughness(NdotV, F0, material.roughness);

    // Specular IBL
    let specular = prefilteredColor * (F * brdf.x + brdf.y);

    // Diffuse IBL (energy conservation)
    let kS = F;
    var kD = vec3f(1.0) - kS;
    kD *= 1.0 - material.metallic;  // Metals have no diffuse

    let diffuse = irradiance * material.albedo;

    // Combine
    let ambient = (kD * diffuse + specular) * material.ao;

    // Tone mapping (Reinhard)
    var color = ambient * material.exposure;
    color = color / (vec3f(1.0) + color);

    // Gamma correction
    color = pow(color, vec3f(1.0 / material.gamma));

    return vec4f(color, 1.0);
}
