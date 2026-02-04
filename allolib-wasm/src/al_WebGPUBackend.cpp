/**
 * AlloLib Studio Online - WebGPU Graphics Backend Implementation
 *
 * Maps the abstract GraphicsBackend interface to WebGPU calls.
 * Uses Emscripten's WebGPU bindings with SwapChain API.
 *
 * Critical implementation notes from PoC testing:
 * - Requires Emscripten 3.1.73+
 * - Device must be initialized in JavaScript (Module.preinitializedWebGPUDevice)
 * - Uses SwapChain API (not Surface Present)
 * - depthSlice = UINT32_MAX for 2D texture attachments
 * - WebGPU Z clip space is [0, 1] (not [-1, 1])
 * - WGSL expects column-major matrices
 */

#include "al_WebGPUBackend.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/html5_webgpu.h>
#include <cstring>
#include <cstdio>
#include <cmath>

namespace al {

// ─── Embedded WGSL Shaders ───────────────────────────────────────────────────
// Default mesh shader with diffuse lighting

static const char* kDefaultVertexShader = R"(
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

struct VertexInput {
    @location(0) position: vec3f,
    @location(1) color: vec4f,
    @location(2) texcoord: vec2f,
    @location(3) normal: vec3f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) viewNormal: vec3f,
    @location(2) viewPos: vec3f,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    // Transform position to view space
    let viewPos = uniforms.modelViewMatrix * vec4f(in.position, 1.0);
    out.viewPos = viewPos.xyz;

    // Transform to clip space
    var clipPos = uniforms.projectionMatrix * viewPos;

    // Convert Z from OpenGL clip space [-w,w] to WebGPU clip space [0,w]
    clipPos.z = clipPos.z * 0.5 + clipPos.w * 0.5;

    out.position = clipPos;
    out.color = in.color;

    // Transform normal to view space using upper-left 3x3 of modelView matrix
    // Note: For non-uniform scaling, we'd need the inverse transpose (normal matrix)
    // This is a simplification that works for uniform scaling and rotation
    let normalMat = mat3x3f(
        uniforms.modelViewMatrix[0].xyz,
        uniforms.modelViewMatrix[1].xyz,
        uniforms.modelViewMatrix[2].xyz
    );
    out.viewNormal = normalize(normalMat * in.normal);

    return out;
}
)";

static const char* kDefaultFragmentShader = R"(
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
    @location(1) viewNormal: vec3f,
    @location(2) viewPos: vec3f,
}

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4f {
    // Normalize interpolated normal
    let N = normalize(in.viewNormal);

    // Light direction in view space (from above-right-front, like typical 3-point lighting)
    // This matches AlloLib's default light at (1, 1, 1) in world space, transformed to view
    let lightDir = normalize(vec3f(1.0, 1.0, 1.0));

    // Ambient light (provides base illumination so back faces aren't completely black)
    let ambient = 0.3;

    // Diffuse lighting (Lambert)
    let diffuse = max(dot(N, lightDir), 0.0);

    // Combined lighting with some softening
    let lighting = ambient + diffuse * 0.7;

    // Apply lighting to vertex color and tint
    let litColor = in.color.rgb * lighting;
    return vec4f(litColor * uniforms.tint.rgb, in.color.a * uniforms.tint.a);
}
)";

// Textured shader - for rendering with 2D textures
static const char* kTexturedVertexShader = R"(
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

struct VertexInput {
    @location(0) position: vec3f,
    @location(1) color: vec4f,
    @location(2) texcoord: vec2f,
    @location(3) normal: vec3f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) texcoord: vec2f,
    @location(2) viewNormal: vec3f,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    let viewPos = uniforms.modelViewMatrix * vec4f(in.position, 1.0);
    var clipPos = uniforms.projectionMatrix * viewPos;
    clipPos.z = clipPos.z * 0.5 + clipPos.w * 0.5;

    out.position = clipPos;
    out.color = in.color;
    out.texcoord = in.texcoord;

    let normalMat = mat3x3f(
        uniforms.modelViewMatrix[0].xyz,
        uniforms.modelViewMatrix[1].xyz,
        uniforms.modelViewMatrix[2].xyz
    );
    out.viewNormal = normalize(normalMat * in.normal);

    return out;
}
)";

static const char* kTexturedFragmentShader = R"(
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
    @location(0) color: vec4f,
    @location(1) texcoord: vec2f,
    @location(2) viewNormal: vec3f,
}

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4f {
    // Sample texture
    let texColor = textureSample(tex0, samp0, in.texcoord);

    // Apply diffuse lighting
    let N = normalize(in.viewNormal);
    let lightDir = normalize(vec3f(1.0, 1.0, 1.0));
    let ambient = 0.3;
    let diffuse = max(dot(N, lightDir), 0.0);
    let lighting = ambient + diffuse * 0.7;

    // Combine texture, vertex color, lighting, and tint
    let litColor = texColor.rgb * in.color.rgb * lighting;
    return vec4f(litColor * uniforms.tint.rgb, texColor.a * in.color.a * uniforms.tint.a);
}
)";

// ─── Screen-space Textured Shader ────────────────────────────────────────────
// For post-processing and full-screen quads - no transformation applied
// Use this when rendering to a screen-filling quad with vertices in NDC

static const char* kScreenSpaceVertexShader = R"(
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

struct VertexInput {
    @location(0) position: vec3f,
    @location(1) color: vec4f,
    @location(2) texcoord: vec2f,
    @location(3) normal: vec3f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) texcoord: vec2f,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    // No transformation - position is already in NDC
    out.position = vec4f(in.position.xy, 0.0, 1.0);
    out.color = in.color;
    out.texcoord = in.texcoord;

    return out;
}
)";

static const char* kScreenSpaceFragmentShader = R"(
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
    @location(0) color: vec4f,
    @location(1) texcoord: vec2f,
}

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4f {
    // Sample texture - no lighting, just apply tint
    let texColor = textureSample(tex0, samp0, in.texcoord);
    return vec4f(texColor.rgb * uniforms.tint.rgb, texColor.a * uniforms.tint.a);
}
)";

// ─── Lighting Shader (Phase 2) ───────────────────────────────────────────────
// Full Phong/Blinn lighting with up to 8 lights

static const char* kLightingVertexShader = R"(
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

    var clipPos = uniforms.projectionMatrix * viewPos;
    clipPos.z = clipPos.z * 0.5 + clipPos.w * 0.5;
    out.position = clipPos;

    // Transform normal to view space using normal matrix
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
)";

static const char* kLightingFragmentShader = R"(
const MAX_LIGHTS: u32 = 8u;

struct Light {
    position: vec4f,
    ambient: vec4f,
    diffuse: vec4f,
    specular: vec4f,
    attenuation: vec3f,
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
    var L: vec3f;
    var attenuation: f32 = 1.0;

    if (light.position.w < 0.5) {
        // Directional light
        L = normalize(light.position.xyz);
    } else {
        // Point light
        L = normalize(light.position.xyz - fragPos);
        let distance = length(light.position.xyz - fragPos);
        attenuation = 1.0 / (light.attenuation.x +
                            light.attenuation.y * distance +
                            light.attenuation.z * distance * distance);
    }

    // Halfway vector for Blinn-Phong
    let H = normalize(L + V);

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
    let V = normalize(-in.viewPos);

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
)";

// ─── Skybox Shader (Phase 4) ─────────────────────────────────────────────────
// Renders equirectangular environment map as skybox

static const char* kSkyboxVertexShader = R"(
struct Uniforms {
    viewMatrix: mat4x4f,
    projMatrix: mat4x4f,
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
    var viewNoTranslate = uniforms.viewMatrix;
    viewNoTranslate[3][0] = 0.0;
    viewNoTranslate[3][1] = 0.0;
    viewNoTranslate[3][2] = 0.0;

    var pos = uniforms.projMatrix * viewNoTranslate * vec4f(in.position, 1.0);

    // Convert Z from OpenGL clip space to WebGPU clip space
    pos.z = pos.z * 0.5 + pos.w * 0.5;

    // Set z to w so the skybox is always at max depth
    out.position = vec4f(pos.xy, pos.w, pos.w);
    out.direction = in.position;

    return out;
}
)";

static const char* kSkyboxFragmentShader = R"(
const PI: f32 = 3.14159265359;

struct Uniforms {
    viewMatrix: mat4x4f,
    projMatrix: mat4x4f,
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
)";

// ─── Environment Reflection Shaders (Phase 6) ────────────────────────────────
// Environment mapping with equirectangular HDR textures

static const char* kEnvReflectVertexShader = R"(
struct TransformUniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    normalMatrix: mat4x4f,
}

struct ReflectParams {
    cameraPos: vec4f,
    baseColor: vec4f,
    exposure: f32,
    gamma: f32,
    reflectivity: f32,
    envRotation: f32,
}

@group(0) @binding(0) var<uniform> transform: TransformUniforms;
@group(0) @binding(1) var<uniform> params: ReflectParams;

struct VertexInput {
    @location(0) position: vec3f,
    @location(1) texcoord: vec2f,
    @location(2) color: vec4f,
    @location(3) normal: vec3f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) worldPos: vec3f,
    @location(1) normal: vec3f,
    @location(2) viewDir: vec3f,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let worldPos = transform.modelViewMatrix * vec4f(input.position, 1.0);
    output.position = transform.projectionMatrix * worldPos;
    output.worldPos = worldPos.xyz;

    // Transform normal using upper-left 3x3 of modelViewMatrix
    let normalMat = mat3x3f(
        transform.normalMatrix[0].xyz,
        transform.normalMatrix[1].xyz,
        transform.normalMatrix[2].xyz
    );
    output.normal = normalize(normalMat * input.normal);

    // View direction from camera to vertex
    output.viewDir = normalize(params.cameraPos.xyz - worldPos.xyz);

    return output;
}
)";

static const char* kEnvReflectFragmentShader = R"(
struct ReflectParams {
    cameraPos: vec4f,
    baseColor: vec4f,
    exposure: f32,
    gamma: f32,
    reflectivity: f32,
    envRotation: f32,
}

@group(0) @binding(1) var<uniform> params: ReflectParams;
@group(0) @binding(2) var envMap: texture_2d<f32>;
@group(0) @binding(3) var envSampler: sampler;

const PI: f32 = 3.14159265359;

// Convert direction vector to equirectangular UV coordinates
fn directionToUV(dir: vec3f) -> vec2f {
    // Apply Y-axis rotation for environment rotation
    let cosR = cos(params.envRotation);
    let sinR = sin(params.envRotation);
    let rotatedDir = vec3f(
        dir.x * cosR - dir.z * sinR,
        dir.y,
        dir.x * sinR + dir.z * cosR
    );

    let phi = atan2(rotatedDir.z, rotatedDir.x);  // -PI to PI
    let theta = acos(clamp(rotatedDir.y, -1.0, 1.0));  // 0 to PI

    let u = (phi + PI) / (2.0 * PI);  // 0 to 1
    let v = theta / PI;                // 0 to 1

    return vec2f(u, v);
}

struct FragmentInput {
    @location(0) worldPos: vec3f,
    @location(1) normal: vec3f,
    @location(2) viewDir: vec3f,
}

@fragment
fn fs_main(input: FragmentInput) -> @location(0) vec4f {
    let normal = normalize(input.normal);
    let viewDir = normalize(input.viewDir);

    // Compute reflection vector
    let reflectDir = reflect(-viewDir, normal);

    // Sample environment map
    let uv = directionToUV(reflectDir);
    let envColor = textureSample(envMap, envSampler, uv).rgb;

    // Tone mapping (Reinhard)
    var mapped = envColor * params.exposure;
    mapped = mapped / (vec3f(1.0) + mapped);

    // Gamma correction
    mapped = pow(mapped, vec3f(1.0 / params.gamma));

    // Mix with base color based on reflectivity
    let finalColor = mix(params.baseColor.rgb, mapped, params.reflectivity);

    return vec4f(finalColor, params.baseColor.a);
}
)";

// ─── PBR Shaders (Phase 5) ───────────────────────────────────────────────────
// Physically-Based Rendering with metallic-roughness workflow and IBL

static const char* kPBRVertexShader = R"(
struct TransformUniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    normalMatrix: mat4x4f,
}

@group(0) @binding(0) var<uniform> transform: TransformUniforms;

struct VertexInput {
    @location(0) position: vec3f,
    @location(2) texcoord: vec2f,
    @location(3) normal: vec3f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) viewPos: vec3f,
    @location(1) viewNormal: vec3f,
    @location(2) texcoord: vec2f,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    let viewPos = transform.modelViewMatrix * vec4f(in.position, 1.0);
    out.viewPos = viewPos.xyz;
    out.position = transform.projectionMatrix * viewPos;

    // Transform normal to view space
    let normalMat = mat3x3f(
        transform.normalMatrix[0].xyz,
        transform.normalMatrix[1].xyz,
        transform.normalMatrix[2].xyz
    );
    out.viewNormal = normalize(normalMat * in.normal);

    out.texcoord = in.texcoord;

    return out;
}
)";

static const char* kPBRFragmentShader = R"(
const PI: f32 = 3.14159265359;

struct TransformUniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    normalMatrix: mat4x4f,
}

struct MaterialUniforms {
    albedo: vec4f,
    metallic: f32,
    roughness: f32,
    ao: f32,
    _pad1: f32,
    emission: vec4f,
}

struct ParamsUniforms {
    envIntensity: f32,
    exposure: f32,
    gamma: f32,
    _pad: f32,
    invViewRot0: vec4f,
    invViewRot1: vec4f,
    invViewRot2: vec4f,
    cameraPos: vec4f,
}

@group(0) @binding(0) var<uniform> transform: TransformUniforms;
@group(0) @binding(1) var<uniform> material: MaterialUniforms;
@group(0) @binding(2) var<uniform> params: ParamsUniforms;
@group(0) @binding(3) var envMap: texture_2d<f32>;
@group(0) @binding(4) var irradianceMap: texture_2d<f32>;
@group(0) @binding(5) var brdfLUT: texture_2d<f32>;
@group(0) @binding(6) var envSampler: sampler;

struct FragmentInput {
    @location(0) viewPos: vec3f,
    @location(1) viewNormal: vec3f,
    @location(2) texcoord: vec2f,
}

// Convert 3D direction to equirectangular UV coordinates
fn directionToUV(dir: vec3f) -> vec2f {
    let phi = atan2(dir.z, dir.x);
    let theta = acos(clamp(dir.y, -1.0, 1.0));
    return vec2f((phi + PI) / (2.0 * PI), theta / PI);
}

// Fresnel-Schlick approximation
fn fresnelSchlick(cosTheta: f32, F0: vec3f) -> vec3f {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Fresnel-Schlick with roughness for IBL
fn fresnelSchlickRoughness(cosTheta: f32, F0: vec3f, roughness: f32) -> vec3f {
    return F0 + (max(vec3f(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Sample environment with roughness blur approximation
// All texture samples are unconditional for WGSL uniform control flow compliance
fn sampleEnvLOD(worldDir: vec3f, roughness: f32) -> vec3f {
    let uv = directionToUV(worldDir);
    let centerSample = textureSample(envMap, envSampler, uv).rgb;

    // Always sample blur offsets (WGSL requires uniform control flow for textureSample)
    let blur = max(roughness * 0.03, 0.001);
    let blurSample1 = textureSample(envMap, envSampler, uv + vec2f(blur, 0.0)).rgb;
    let blurSample2 = textureSample(envMap, envSampler, uv + vec2f(-blur, 0.0)).rgb;
    let blurSample3 = textureSample(envMap, envSampler, uv + vec2f(0.0, blur)).rgb;
    let blurSample4 = textureSample(envMap, envSampler, uv + vec2f(0.0, -blur)).rgb;

    let blurredColor = (centerSample + blurSample1 + blurSample2 + blurSample3 + blurSample4) / 5.0;

    // Select between sharp and blurred based on roughness
    return select(centerSample, blurredColor, roughness > 0.1);
}

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4f {
    let N = normalize(in.viewNormal);
    let V = normalize(-in.viewPos);  // Camera at origin in view space
    let R = reflect(-V, N);

    // Build inverse view rotation matrix
    let invViewRot = mat3x3f(
        params.invViewRot0.xyz,
        params.invViewRot1.xyz,
        params.invViewRot2.xyz
    );

    // Transform to world space for environment sampling
    let worldN = invViewRot * N;
    let worldR = invViewRot * R;

    // Calculate F0 (base reflectivity)
    var F0 = vec3f(0.04);  // Dielectric default
    F0 = mix(F0, material.albedo.rgb, material.metallic);

    // IBL Diffuse - sample irradiance map
    let irradianceUV = directionToUV(worldN);
    let irradianceMapSample = textureSample(irradianceMap, envSampler, irradianceUV).rgb;

    // Compute fallback irradiance from env map (always computed for uniform control flow)
    let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(worldN.y) >= 0.999);
    let tangent = normalize(cross(up, worldN));
    let bitangent = cross(worldN, tangent);

    // Sample all directions unconditionally (WGSL uniform control flow requirement)
    let fallbackCenter = textureSample(envMap, envSampler, directionToUV(worldN)).rgb * 0.3;
    let fallbackTangentP = textureSample(envMap, envSampler, directionToUV(normalize(worldN + tangent * 0.5))).rgb * 0.15;
    let fallbackTangentN = textureSample(envMap, envSampler, directionToUV(normalize(worldN - tangent * 0.5))).rgb * 0.15;
    let fallbackBitangentP = textureSample(envMap, envSampler, directionToUV(normalize(worldN + bitangent * 0.5))).rgb * 0.15;
    let fallbackBitangentN = textureSample(envMap, envSampler, directionToUV(normalize(worldN - bitangent * 0.5))).rgb * 0.15;
    let fallbackUp = textureSample(envMap, envSampler, directionToUV(normalize(worldN + vec3f(0.0, 0.5, 0.0)))).rgb * 0.1;
    let fallbackIrradiance = fallbackCenter + fallbackTangentP + fallbackTangentN + fallbackBitangentP + fallbackBitangentN + fallbackUp;

    // Select between irradiance map and fallback based on irradiance map strength
    let useIrradianceMap = length(irradianceMapSample) >= 0.001;
    var irradiance = select(fallbackIrradiance, irradianceMapSample, useIrradianceMap);

    let NdotV = max(dot(N, V), 0.0);
    let kS = fresnelSchlickRoughness(NdotV, F0, material.roughness);
    var kD = vec3f(1.0) - kS;
    kD = kD * (1.0 - material.metallic);  // Metals have no diffuse

    let diffuse = irradiance * material.albedo.rgb;

    // IBL Specular
    let prefilteredColor = sampleEnvLOD(worldR, material.roughness);

    // BRDF lookup
    let brdfUV = vec2f(NdotV, material.roughness);
    var brdf = textureSample(brdfLUT, envSampler, brdfUV).rg;

    // Approximation if BRDF LUT not available
    if (brdf.x < 0.001 && brdf.y < 0.001) {
        let a = material.roughness * material.roughness;
        brdf.x = 1.0 - a * 0.5;
        brdf.y = a * 0.5;
    }

    let specular = prefilteredColor * (kS * brdf.x + brdf.y);

    // Combine
    let ambient = (kD * diffuse + specular) * material.ao * params.envIntensity;
    var color = ambient + material.emission.rgb;

    // Tone mapping (Reinhard)
    color = color * params.exposure;
    color = color / (vec3f(1.0) + color);

    // Gamma correction
    color = pow(color, vec3f(1.0 / params.gamma));

    return vec4f(color, 1.0);
}
)";

// PBR Fallback shader with analytical lighting (no IBL)
static const char* kPBRFallbackFragmentShader = R"(
const PI: f32 = 3.14159265359;

struct TransformUniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    normalMatrix: mat4x4f,
}

struct MaterialUniforms {
    albedo: vec4f,
    metallic: f32,
    roughness: f32,
    ao: f32,
    _pad1: f32,
    emission: vec4f,
}

struct ParamsUniforms {
    envIntensity: f32,
    exposure: f32,
    gamma: f32,
    _pad: f32,
    invViewRot0: vec4f,
    invViewRot1: vec4f,
    invViewRot2: vec4f,
    cameraPos: vec4f,
}

@group(0) @binding(0) var<uniform> transform: TransformUniforms;
@group(0) @binding(1) var<uniform> material: MaterialUniforms;
@group(0) @binding(2) var<uniform> params: ParamsUniforms;

struct FragmentInput {
    @location(0) viewPos: vec3f,
    @location(1) viewNormal: vec3f,
    @location(2) texcoord: vec2f,
}

// Fresnel-Schlick
fn fresnelSchlick(cosTheta: f32, F0: vec3f) -> vec3f {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// GGX NDF
fn distributionGGX(N: vec3f, H: vec3f, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let NdotH = max(dot(N, H), 0.0);
    let NdotH2 = NdotH * NdotH;
    let denom = (NdotH2 * (a2 - 1.0) + 1.0);
    return a2 / (PI * denom * denom);
}

// Schlick-GGX
fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
    let r = roughness + 1.0;
    let k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

fn geometrySmith(N: vec3f, V: vec3f, L: vec3f, roughness: f32) -> f32 {
    let NdotV = max(dot(N, V), 0.0);
    let NdotL = max(dot(N, L), 0.0);
    return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4f {
    let N = normalize(in.viewNormal);
    let V = normalize(-in.viewPos);

    var F0 = vec3f(0.04);
    F0 = mix(F0, material.albedo.rgb, material.metallic);

    // 3-point lighting (view space positions)
    var lightPositions: array<vec3f, 3>;
    lightPositions[0] = vec3f(3.0, 3.0, 2.0);   // Key light
    lightPositions[1] = vec3f(-3.0, 2.0, 0.0);  // Fill light
    lightPositions[2] = vec3f(0.0, -2.0, 1.0);  // Rim light

    var lightColors: array<vec3f, 3>;
    lightColors[0] = vec3f(1.0, 0.95, 0.9) * 8.0;  // Key (warm)
    lightColors[1] = vec3f(0.6, 0.7, 1.0) * 4.0;   // Fill (cool)
    lightColors[2] = vec3f(0.5, 0.5, 0.5) * 2.0;   // Rim

    var Lo = vec3f(0.0);

    for (var i = 0u; i < 3u; i = i + 1u) {
        let L = normalize(lightPositions[i] - in.viewPos);
        let H = normalize(V + L);
        let distance = length(lightPositions[i] - in.viewPos);
        let attenuation = 1.0 / (1.0 + distance * distance * 0.1);
        let radiance = lightColors[i] * attenuation;

        let NDF = distributionGGX(N, H, material.roughness);
        let G = geometrySmith(N, V, L, material.roughness);
        let F = fresnelSchlick(max(dot(H, V), 0.0), F0);

        let kD = (vec3f(1.0) - F) * (1.0 - material.metallic);

        let numerator = NDF * G * F;
        let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
        let specular = numerator / denominator;

        let NdotL = max(dot(N, L), 0.0);
        Lo = Lo + (kD * material.albedo.rgb / PI + specular) * radiance * NdotL;
    }

    // Ambient
    var ambient = vec3f(0.2, 0.2, 0.25) * material.albedo.rgb * material.ao;
    ambient = ambient + vec3f(0.15, 0.12, 0.1) * max(N.y, 0.0) * material.albedo.rgb * material.ao;

    var color = ambient + Lo * params.envIntensity + material.emission.rgb;

    // Tone mapping and gamma
    color = color * params.exposure;
    color = color / (vec3f(1.0) + color);
    color = pow(color, vec3f(1.0 / params.gamma));

    return vec4f(color, 1.0);
}
)";

// ─── Constructor / Destructor ────────────────────────────────────────────────

WebGPUBackend::WebGPUBackend() {
    // Reserve space for uniform data (typical size)
    mUniformData.resize(256, 0);

    // Initialize lighting data with sensible defaults
    mGlobalAmbient[0] = 0.1f; mGlobalAmbient[1] = 0.1f;
    mGlobalAmbient[2] = 0.1f; mGlobalAmbient[3] = 1.0f;

    // Initialize default material (white diffuse)
    mMaterial.ambient[0] = 0.2f; mMaterial.ambient[1] = 0.2f;
    mMaterial.ambient[2] = 0.2f; mMaterial.ambient[3] = 1.0f;
    mMaterial.diffuse[0] = 0.8f; mMaterial.diffuse[1] = 0.8f;
    mMaterial.diffuse[2] = 0.8f; mMaterial.diffuse[3] = 1.0f;
    mMaterial.specular[0] = 1.0f; mMaterial.specular[1] = 1.0f;
    mMaterial.specular[2] = 1.0f; mMaterial.specular[3] = 1.0f;
    mMaterial.emission[0] = 0.0f; mMaterial.emission[1] = 0.0f;
    mMaterial.emission[2] = 0.0f; mMaterial.emission[3] = 1.0f;
    mMaterial.shininess = 32.0f;
    mMaterial._pad[0] = mMaterial._pad[1] = mMaterial._pad[2] = 0.0f;

    // Initialize default light (white from above-right)
    for (int i = 0; i < 8; i++) {
        mLights[i].position[0] = 1.0f; mLights[i].position[1] = 1.0f;
        mLights[i].position[2] = 1.0f; mLights[i].position[3] = 0.0f; // Directional
        mLights[i].ambient[0] = 0.1f; mLights[i].ambient[1] = 0.1f;
        mLights[i].ambient[2] = 0.1f; mLights[i].ambient[3] = 1.0f;
        mLights[i].diffuse[0] = 1.0f; mLights[i].diffuse[1] = 1.0f;
        mLights[i].diffuse[2] = 1.0f; mLights[i].diffuse[3] = 1.0f;
        mLights[i].specular[0] = 1.0f; mLights[i].specular[1] = 1.0f;
        mLights[i].specular[2] = 1.0f; mLights[i].specular[3] = 1.0f;
        mLights[i].attenuation[0] = 1.0f; mLights[i].attenuation[1] = 0.0f;
        mLights[i].attenuation[2] = 0.0f;
        mLights[i].enabled = (i == 0) ? 1.0f : 0.0f; // Only first light enabled
    }

    // Initialize normal matrix to identity
    for (int i = 0; i < 16; i++) {
        mNormalMatrix[i] = (i % 5 == 0) ? 1.0f : 0.0f;
    }

    // Initialize PBR material defaults (Phase 5)
    mPBRMaterial.albedo[0] = 0.8f; mPBRMaterial.albedo[1] = 0.8f;
    mPBRMaterial.albedo[2] = 0.8f; mPBRMaterial.albedo[3] = 1.0f;
    mPBRMaterial.metallic = 0.0f;
    mPBRMaterial.roughness = 0.5f;
    mPBRMaterial.ao = 1.0f;
    mPBRMaterial._pad1 = 0.0f;
    mPBRMaterial.emission[0] = 0.0f; mPBRMaterial.emission[1] = 0.0f;
    mPBRMaterial.emission[2] = 0.0f; mPBRMaterial.emission[3] = 0.0f;

    // Initialize PBR params defaults
    mPBRParams.envIntensity = 1.0f;
    mPBRParams.exposure = 1.0f;
    mPBRParams.gamma = 2.2f;
    mPBRParams._pad = 0.0f;
    // Identity matrix for invViewRot (3 columns stored as vec4)
    mPBRParams.invViewRot[0] = 1.0f; mPBRParams.invViewRot[1] = 0.0f;
    mPBRParams.invViewRot[2] = 0.0f; mPBRParams.invViewRot[3] = 0.0f;
    mPBRParams.invViewRot[4] = 0.0f; mPBRParams.invViewRot[5] = 1.0f;
    mPBRParams.invViewRot[6] = 0.0f; mPBRParams.invViewRot[7] = 0.0f;
    mPBRParams.invViewRot[8] = 0.0f; mPBRParams.invViewRot[9] = 0.0f;
    mPBRParams.invViewRot[10] = 1.0f; mPBRParams.invViewRot[11] = 0.0f;
    mPBRParams.cameraPos[0] = 0.0f; mPBRParams.cameraPos[1] = 0.0f;
    mPBRParams.cameraPos[2] = 0.0f; mPBRParams.cameraPos[3] = 0.0f;
}

WebGPUBackend::~WebGPUBackend() {
    shutdown();
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

bool WebGPUBackend::init(int width, int height) {
    printf("[WebGPUBackend] init() called with %dx%d\n", width, height);

    mWidth = width;
    mHeight = height;

    // Check if preinitializedWebGPUDevice is set in JavaScript
    int hasDevice = EM_ASM_INT({
        var hasIt = (typeof Module !== 'undefined' &&
                     Module.preinitializedWebGPUDevice !== undefined &&
                     Module.preinitializedWebGPUDevice !== null);
        console.log('[WebGPUBackend] JS check - Module.preinitializedWebGPUDevice exists:', hasIt);
        if (hasIt) {
            console.log('[WebGPUBackend] Device type:', typeof Module.preinitializedWebGPUDevice);
        }
        return hasIt ? 1 : 0;
    });

    if (!hasDevice) {
        printf("[WebGPUBackend] ERROR: Module.preinitializedWebGPUDevice not set!\n");
        return false;
    }

    printf("[WebGPUBackend] Getting device from Emscripten...\n");

    // Get device from JavaScript (must be pre-initialized)
    mDevice = emscripten_webgpu_get_device();
    if (!mDevice) {
        printf("[WebGPUBackend] ERROR: emscripten_webgpu_get_device() returned null!\n");
        printf("[WebGPUBackend] Ensure Module.preinitializedWebGPUDevice is set in JavaScript.\n");
        return false;
    }

    printf("[WebGPUBackend] Device acquired: %p\n", (void*)mDevice);

    mQueue = wgpuDeviceGetQueue(mDevice);
    if (!mQueue) {
        printf("[WebGPUBackend] ERROR: Failed to get command queue!\n");
        return false;
    }

    printf("[WebGPUBackend] Queue acquired: %p\n", (void*)mQueue);

    // Create swap chain
    printf("[WebGPUBackend] Creating swap chain...\n");
    createSwapChain();

    if (!mSwapChain) {
        printf("[WebGPUBackend] ERROR: Swap chain creation failed!\n");
        return false;
    }

    // Create depth buffer
    printf("[WebGPUBackend] Creating depth buffer...\n");
    createDepthBuffer();

    // Create uniform ring buffer for dynamic offsets (supports many draw calls per frame)
    printf("[WebGPUBackend] Creating uniform ring buffer...\n");
    {
        WGPUBufferDescriptor ringBufDesc = {};
        ringBufDesc.size = kUniformAlignment * kMaxDrawsPerFrame;  // 256 * 256 = 64KB
        ringBufDesc.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
        ringBufDesc.mappedAtCreation = false;
        mUniformRingBuffer = wgpuDeviceCreateBuffer(mDevice, &ringBufDesc);
        if (!mUniformRingBuffer) {
            printf("[WebGPUBackend] ERROR: Failed to create uniform ring buffer!\n");
            return false;
        }
        printf("[WebGPUBackend] Uniform ring buffer created: %zu bytes\n",
               kUniformAlignment * kMaxDrawsPerFrame);
    }

    // Initialize viewport
    mViewportX = 0;
    mViewportY = 0;
    mViewportW = width;
    mViewportH = height;

    // Create default shader
    printf("[WebGPUBackend] Creating default shader...\n");
    createDefaultShader();

    // Create textured shader
    printf("[WebGPUBackend] Creating textured shader...\n");
    createTexturedShader();

    // Create screen-space shader (for post-processing)
    printf("[WebGPUBackend] Creating screen-space shader...\n");
    createScreenSpaceShader();

    // Create lighting shader (Phase 2)
    printf("[WebGPUBackend] Creating lighting shader...\n");
    createLightingShader();

    // Create skybox shader and mesh (Phase 4)
    printf("[WebGPUBackend] Creating skybox shader...\n");
    createSkyboxShader();
    createSkyboxMesh();

    // Create PBR shaders (Phase 5)
    printf("[WebGPUBackend] Creating PBR shaders...\n");
    createPBRShader();
    createPBRFallbackShader();

    printf("[WebGPUBackend] Initialized %dx%d successfully\n", width, height);
    return true;
}

void WebGPUBackend::shutdown() {
    // End any active passes
    if (mRenderPassEncoder) {
        wgpuRenderPassEncoderEnd(mRenderPassEncoder);
        wgpuRenderPassEncoderRelease(mRenderPassEncoder);
        mRenderPassEncoder = nullptr;
    }
    if (mComputePassEncoder) {
        wgpuComputePassEncoderEnd(mComputePassEncoder);
        wgpuComputePassEncoderRelease(mComputePassEncoder);
        mComputePassEncoder = nullptr;
    }
    if (mCommandEncoder) {
        wgpuCommandEncoderRelease(mCommandEncoder);
        mCommandEncoder = nullptr;
    }

    // Destroy all resources

    // Release textured bind group first (before textures)
    if (mTexturedBindGroup) {
        wgpuBindGroupRelease(mTexturedBindGroup);
        mTexturedBindGroup = nullptr;
    }

    // Release lighting resources (Phase 2)
    if (mLitBindGroup) {
        wgpuBindGroupRelease(mLitBindGroup);
        mLitBindGroup = nullptr;
    }
    if (mLightingUniformBuffer) {
        wgpuBufferRelease(mLightingUniformBuffer);
        mLightingUniformBuffer = nullptr;
    }

    // Release skybox resources (Phase 4)
    if (mSkyboxBindGroup) {
        wgpuBindGroupRelease(mSkyboxBindGroup);
        mSkyboxBindGroup = nullptr;
    }
    if (mSkyboxUniformBuffer) {
        wgpuBufferRelease(mSkyboxUniformBuffer);
        mSkyboxUniformBuffer = nullptr;
    }
    if (mSkyboxPipeline) {
        wgpuRenderPipelineRelease(mSkyboxPipeline);
        mSkyboxPipeline = nullptr;
    }
    if (mSkyboxBindGroupLayout) {
        wgpuBindGroupLayoutRelease(mSkyboxBindGroupLayout);
        mSkyboxBindGroupLayout = nullptr;
    }
    mSkyboxShader = {};
    mSkyboxVertexBuffer = {};
    mBoundEnvironmentTexture = {};

    // Release PBR resources (Phase 5)
    if (mPBRBindGroup) {
        wgpuBindGroupRelease(mPBRBindGroup);
        mPBRBindGroup = nullptr;
    }
    if (mPBRUniformBuffer) {
        wgpuBufferRelease(mPBRUniformBuffer);
        mPBRUniformBuffer = nullptr;
    }
    if (mPBRPipeline) {
        wgpuRenderPipelineRelease(mPBRPipeline);
        mPBRPipeline = nullptr;
    }
    if (mPBRFallbackPipeline) {
        wgpuRenderPipelineRelease(mPBRFallbackPipeline);
        mPBRFallbackPipeline = nullptr;
    }
    if (mPBRBindGroupLayout) {
        wgpuBindGroupLayoutRelease(mPBRBindGroupLayout);
        mPBRBindGroupLayout = nullptr;
    }
    mPBRShader = {};
    mPBRFallbackShader = {};
    mPBREnvMap = {};
    mPBRIrradianceMap = {};
    mPBRBrdfLUT = {};

    // Clear bound texture references
    for (int i = 0; i < 8; i++) {
        mBoundTextures[i] = {};
    }

    for (auto& [id, buf] : mBuffers) {
        if (buf.buffer) wgpuBufferRelease(buf.buffer);
    }
    mBuffers.clear();

    for (auto& [id, tex] : mTextures) {
        if (tex.sampler) wgpuSamplerRelease(tex.sampler);
        if (tex.view) wgpuTextureViewRelease(tex.view);
        if (tex.texture) wgpuTextureRelease(tex.texture);
    }
    mTextures.clear();

    for (auto& [id, shader] : mShaders) {
        if (shader.bindGroup) wgpuBindGroupRelease(shader.bindGroup);
        if (shader.uniformBuffer) wgpuBufferRelease(shader.uniformBuffer);
        // Release all pipelines (different primitive topologies)
        for (auto& [primType, pipeline] : shader.pipelines) {
            if (pipeline) wgpuRenderPipelineRelease(pipeline);
        }
        shader.pipelines.clear();
        if (shader.pipelineLayout) wgpuPipelineLayoutRelease(shader.pipelineLayout);
        if (shader.bindGroupLayout) wgpuBindGroupLayoutRelease(shader.bindGroupLayout);
        if (shader.fragModule) wgpuShaderModuleRelease(shader.fragModule);
        if (shader.vertModule) wgpuShaderModuleRelease(shader.vertModule);
    }
    mShaders.clear();

    for (auto& [id, rt] : mRenderTargets) {
        if (rt.colorView) wgpuTextureViewRelease(rt.colorView);
        if (rt.depthView) wgpuTextureViewRelease(rt.depthView);
    }
    mRenderTargets.clear();

    for (auto& [id, compute] : mComputePipelines) {
        if (compute.bindGroup) wgpuBindGroupRelease(compute.bindGroup);
        if (compute.pipeline) wgpuComputePipelineRelease(compute.pipeline);
        if (compute.pipelineLayout) wgpuPipelineLayoutRelease(compute.pipelineLayout);
        if (compute.bindGroupLayout) wgpuBindGroupLayoutRelease(compute.bindGroupLayout);
        if (compute.module) wgpuShaderModuleRelease(compute.module);
    }
    mComputePipelines.clear();

    // Destroy depth buffer
    if (mDepthTextureView) {
        wgpuTextureViewRelease(mDepthTextureView);
        mDepthTextureView = nullptr;
    }
    if (mDepthTexture) {
        wgpuTextureRelease(mDepthTexture);
        mDepthTexture = nullptr;
    }

    // Destroy uniform ring buffer and dynamic bind group
    if (mDynamicBindGroup) {
        wgpuBindGroupRelease(mDynamicBindGroup);
        mDynamicBindGroup = nullptr;
    }
    if (mDynamicBindGroupLayout) {
        wgpuBindGroupLayoutRelease(mDynamicBindGroupLayout);
        mDynamicBindGroupLayout = nullptr;
    }
    if (mUniformRingBuffer) {
        wgpuBufferRelease(mUniformRingBuffer);
        mUniformRingBuffer = nullptr;
    }

    // Swap chain is managed via JS canvas context - just clear the dummy handle
    mSwapChain = nullptr;

    // Release queue and device
    if (mQueue) {
        wgpuQueueRelease(mQueue);
        mQueue = nullptr;
    }
    // Don't release device - it's owned by JavaScript

    mNextHandleId = 1;
    mCurrentShader = {};
}

void WebGPUBackend::resize(int width, int height) {
    if (width == mWidth && height == mHeight) return;

    mWidth = width;
    mHeight = height;

    // No need to recreate swap chain - we manage textures via JS canvas context
    // The canvas context automatically handles resize

    // Recreate depth buffer
    if (mDepthTextureView) {
        wgpuTextureViewRelease(mDepthTextureView);
    }
    if (mDepthTexture) {
        wgpuTextureRelease(mDepthTexture);
    }
    createDepthBuffer();

    // Update viewport
    mViewportW = width;
    mViewportH = height;
}

void WebGPUBackend::beginFrame() {
    // First, check if canvas size has changed and resize depth buffer if needed
    int canvasWidth = EM_ASM_INT({
        var context = Module._webgpuCanvasContext;
        if (!context) return 0;
        var texture = context.getCurrentTexture();
        return texture ? texture.width : 0;
    });
    int canvasHeight = EM_ASM_INT({
        var context = Module._webgpuCanvasContext;
        if (!context) return 0;
        var texture = context.getCurrentTexture();
        return texture ? texture.height : 0;
    });

    // Resize depth buffer if canvas size changed
    if (canvasWidth > 0 && canvasHeight > 0 &&
        (canvasWidth != mWidth || canvasHeight != mHeight)) {
        printf("[WebGPUBackend] Canvas resized from %dx%d to %dx%d, updating depth buffer\n",
               mWidth, mHeight, canvasWidth, canvasHeight);
        resize(canvasWidth, canvasHeight);
    }

    // Get current texture view from JavaScript canvas context
    // Since wgpuDeviceCreateSwapChain has issues in MODULARIZE mode,
    // we get the texture directly from the configured canvas context
    mCurrentSwapChainView = (WGPUTextureView)EM_ASM_PTR({
        try {
            var context = Module._webgpuCanvasContext;
            if (!context) {
                console.error('[WebGPUBackend] No canvas context stored!');
                return 0;
            }

            // Get current texture from canvas context
            var texture = context.getCurrentTexture();
            if (!texture) {
                console.error('[WebGPUBackend] getCurrentTexture() returned null!');
                return 0;
            }

            // Create a view from the texture
            var view = texture.createView();

            // Store view and texture for this frame
            // We need to keep the texture reference alive during the frame
            Module._currentFrameTexture = texture;
            Module._currentFrameTextureView = view;

            // Check if Emscripten's WebGPU manager exists
            if (typeof WebGPU !== 'undefined' && WebGPU.mgrTextureView && WebGPU.mgrTextureView.create) {
                // Use Emscripten's internal handle manager
                var id = WebGPU.mgrTextureView.create(view);
                return id;
            } else {
                // Fallback: store in our own table
                if (!Module._textureViewTable) {
                    Module._textureViewTable = {};
                    Module._textureViewNextId = 1;
                }
                var id = Module._textureViewNextId++;
                Module._textureViewTable[id] = view;
                return id;
            }
        } catch (e) {
            console.error('[WebGPUBackend] Error getting current texture:', e);
            console.error('[WebGPUBackend] Stack:', e.stack);
            return 0;
        }
    });

    if (!mCurrentSwapChainView) {
        // Don't spam the console - this can happen during resize
        return;
    }

    // Create command encoder
    WGPUCommandEncoderDescriptor encoderDesc = {};
    encoderDesc.label = "Frame Command Encoder";
    mCommandEncoder = wgpuDeviceCreateCommandEncoder(mDevice, &encoderDesc);

    // Mark that we need to clear at next render pass
    mHasPendingClear = true;

    // Reset uniform ring buffer offset for new frame
    mUniformRingOffset = 0;
}

void WebGPUBackend::endFrame() {
    // End any active render pass
    endRenderPass();

    if (mCommandEncoder) {
        // Submit commands
        WGPUCommandBufferDescriptor cmdBufDesc = {};
        cmdBufDesc.label = "Frame Commands";
        WGPUCommandBuffer cmdBuf = wgpuCommandEncoderFinish(mCommandEncoder, &cmdBufDesc);
        wgpuQueueSubmit(mQueue, 1, &cmdBuf);
        wgpuCommandBufferRelease(cmdBuf);
        wgpuCommandEncoderRelease(mCommandEncoder);
        mCommandEncoder = nullptr;
    }

    // Note: Don't release mCurrentSwapChainView here - Chrome's compositor
    // may still need the texture for presentation. The view will be
    // overwritten on the next beginFrame() call.
    // The JavaScript side keeps a reference in Module._currentFrameTexture
    // which prevents garbage collection until the next frame.
    mCurrentSwapChainView = nullptr;  // Just clear our handle

    // Note: Emscripten SwapChain doesn't need explicit present
}

// ─── Render State ────────────────────────────────────────────────────────────

void WebGPUBackend::clear(const ClearValues& values) {
    mPendingClear = values;
    mHasPendingClear = true;

    // If we already have a render pass, end it so next draw uses new clear values
    if (mRenderPassEncoder) {
        endRenderPass();
    }
}

void WebGPUBackend::viewport(int x, int y, int w, int h) {
    mViewportX = x;
    mViewportY = y;
    mViewportW = w;
    mViewportH = h;

    // Apply viewport if render pass is active
    if (mRenderPassEncoder) {
        wgpuRenderPassEncoderSetViewport(mRenderPassEncoder,
            (float)x, (float)y, (float)w, (float)h, 0.0f, 1.0f);
    }
}

void WebGPUBackend::setDrawState(const DrawState& state) {
    mCurrentDrawState = state;
    mDrawStateDirty = true;
    // Pipeline will be recreated with new state on next draw if needed
}

// ─── Buffers ─────────────────────────────────────────────────────────────────

BufferHandle WebGPUBackend::createBuffer(
    BufferType type,
    BufferUsage usage,
    const void* data,
    size_t size
) {
    BufferResource resource;
    resource.type = type;
    resource.usage = usage;
    resource.size = size;

    WGPUBufferDescriptor bufDesc = {};
    bufDesc.label = "Buffer";
    bufDesc.size = size;
    bufDesc.usage = toWGPUBufferUsage(type, usage);
    bufDesc.mappedAtCreation = (data != nullptr);

    resource.buffer = wgpuDeviceCreateBuffer(mDevice, &bufDesc);

    if (data && resource.buffer) {
        void* mapped = wgpuBufferGetMappedRange(resource.buffer, 0, size);
        if (mapped) {
            memcpy(mapped, data, size);
            wgpuBufferUnmap(resource.buffer);
        }
    }

    uint64_t id = generateHandleId();
    mBuffers[id] = resource;

    return BufferHandle{id};
}

void WebGPUBackend::updateBuffer(
    BufferHandle handle,
    const void* data,
    size_t size,
    size_t offset
) {
    auto it = mBuffers.find(handle.id);
    if (it == mBuffers.end() || !data) return;

    wgpuQueueWriteBuffer(mQueue, it->second.buffer, offset, data, size);
}

void WebGPUBackend::destroyBuffer(BufferHandle handle) {
    auto it = mBuffers.find(handle.id);
    if (it == mBuffers.end()) return;

    if (it->second.buffer) {
        wgpuBufferRelease(it->second.buffer);
    }
    mBuffers.erase(it);
}

// ─── Textures ────────────────────────────────────────────────────────────────

TextureHandle WebGPUBackend::createTexture(
    const TextureDesc& desc,
    const void* data
) {
    TextureResource resource;
    resource.desc = desc;

    WGPUTextureDescriptor texDesc = {};
    texDesc.label = "Texture";
    texDesc.size.width = desc.width;
    texDesc.size.height = desc.height;
    texDesc.size.depthOrArrayLayers = desc.depth > 1 ? desc.depth : 1;
    texDesc.mipLevelCount = desc.mipmaps ? (uint32_t)floor(log2(std::max(desc.width, desc.height))) + 1 : 1;
    texDesc.sampleCount = desc.samples;
    texDesc.dimension = desc.depth > 1 ? WGPUTextureDimension_3D : WGPUTextureDimension_2D;
    texDesc.format = toWGPUFormat(desc.format);
    texDesc.usage = WGPUTextureUsage_TextureBinding | WGPUTextureUsage_CopyDst;

    if (desc.renderTarget) {
        texDesc.usage |= WGPUTextureUsage_RenderAttachment;
    }
    if (desc.storageTexture) {
        texDesc.usage |= WGPUTextureUsage_StorageBinding;
    }

    resource.texture = wgpuDeviceCreateTexture(mDevice, &texDesc);

    // Create view
    WGPUTextureViewDescriptor viewDesc = {};
    viewDesc.format = texDesc.format;
    viewDesc.dimension = desc.depth > 1 ? WGPUTextureViewDimension_3D : WGPUTextureViewDimension_2D;
    viewDesc.mipLevelCount = texDesc.mipLevelCount;
    viewDesc.arrayLayerCount = 1;
    resource.view = wgpuTextureCreateView(resource.texture, &viewDesc);

    // Create sampler
    WGPUSamplerDescriptor samplerDesc = {};
    samplerDesc.addressModeU = toWGPUAddressMode(desc.wrapS);
    samplerDesc.addressModeV = toWGPUAddressMode(desc.wrapT);
    samplerDesc.addressModeW = toWGPUAddressMode(desc.wrapR);
    samplerDesc.minFilter = toWGPUFilterMode(desc.minFilter);
    samplerDesc.magFilter = toWGPUFilterMode(desc.magFilter);
    samplerDesc.mipmapFilter = desc.mipmaps ? WGPUMipmapFilterMode_Linear : WGPUMipmapFilterMode_Nearest;
    samplerDesc.maxAnisotropy = 1;
    resource.sampler = wgpuDeviceCreateSampler(mDevice, &samplerDesc);

    // Upload initial data
    if (data) {
        WGPUImageCopyTexture destTex = {};
        destTex.texture = resource.texture;
        destTex.mipLevel = 0;
        destTex.origin = {0, 0, 0};
        destTex.aspect = WGPUTextureAspect_All;

        WGPUTextureDataLayout dataLayout = {};
        dataLayout.offset = 0;

        // Calculate bytes per pixel
        int bytesPerPixel = 4; // Default RGBA8
        switch (desc.format) {
            case PixelFormat::R8: bytesPerPixel = 1; break;
            case PixelFormat::RG8: bytesPerPixel = 2; break;
            case PixelFormat::RGB8: bytesPerPixel = 3; break;
            case PixelFormat::RGBA8: bytesPerPixel = 4; break;
            case PixelFormat::RGBA16F: bytesPerPixel = 8; break;
            case PixelFormat::RGBA32F: bytesPerPixel = 16; break;
            default: break;
        }

        dataLayout.bytesPerRow = desc.width * bytesPerPixel;
        dataLayout.rowsPerImage = desc.height;

        WGPUExtent3D extent = {(uint32_t)desc.width, (uint32_t)desc.height, 1};
        wgpuQueueWriteTexture(mQueue, &destTex, data,
                               dataLayout.bytesPerRow * desc.height,
                               &dataLayout, &extent);
    }

    uint64_t id = generateHandleId();
    mTextures[id] = resource;

    return TextureHandle{id};
}

void WebGPUBackend::updateTexture(
    TextureHandle handle,
    const void* data,
    int level,
    int x, int y,
    int w, int h
) {
    auto it = mTextures.find(handle.id);
    if (it == mTextures.end() || !data) return;

    const auto& desc = it->second.desc;
    int width = (w < 0) ? desc.width : w;
    int height = (h < 0) ? desc.height : h;

    WGPUImageCopyTexture destTex = {};
    destTex.texture = it->second.texture;
    destTex.mipLevel = level;
    destTex.origin = {(uint32_t)x, (uint32_t)y, 0};
    destTex.aspect = WGPUTextureAspect_All;

    int bytesPerPixel = 4;
    WGPUTextureDataLayout dataLayout = {};
    dataLayout.offset = 0;
    dataLayout.bytesPerRow = width * bytesPerPixel;
    dataLayout.rowsPerImage = height;

    WGPUExtent3D extent = {(uint32_t)width, (uint32_t)height, 1};
    wgpuQueueWriteTexture(mQueue, &destTex, data,
                           dataLayout.bytesPerRow * height,
                           &dataLayout, &extent);
}

void WebGPUBackend::generateMipmaps(TextureHandle handle) {
    // WebGPU doesn't have automatic mipmap generation like OpenGL
    // Would need compute shader or manual blit - skip for now
    // TODO: Implement mipmap generation via compute
}

void WebGPUBackend::destroyTexture(TextureHandle handle) {
    auto it = mTextures.find(handle.id);
    if (it == mTextures.end()) return;

    if (it->second.sampler) wgpuSamplerRelease(it->second.sampler);
    if (it->second.view) wgpuTextureViewRelease(it->second.view);
    if (it->second.texture) wgpuTextureRelease(it->second.texture);
    mTextures.erase(it);
}

// ─── Render Targets ──────────────────────────────────────────────────────────

RenderTargetHandle WebGPUBackend::createRenderTarget(
    TextureHandle color,
    TextureHandle depth
) {
    RenderTargetResource resource;
    resource.colorAttachment = color;
    resource.depthAttachment = depth;

    // Get texture views and dimensions
    if (color.valid()) {
        auto it = mTextures.find(color.id);
        if (it != mTextures.end()) {
            resource.colorView = it->second.view;
            // Store dimensions from the color attachment
            resource.width = it->second.desc.width;
            resource.height = it->second.desc.height;
            // Don't release - owned by texture resource
        }
    }

    if (depth.valid()) {
        auto it = mTextures.find(depth.id);
        if (it != mTextures.end()) {
            resource.depthView = it->second.view;
        }
    }

    uint64_t id = generateHandleId();
    mRenderTargets[id] = resource;

    return RenderTargetHandle{id};
}

void WebGPUBackend::bindRenderTarget(RenderTargetHandle handle) {
    // End current render pass
    endRenderPass();

    mCurrentRenderTarget = handle;
    mHasPendingClear = true;

    // Update viewport to match render target dimensions
    if (handle.valid()) {
        auto it = mRenderTargets.find(handle.id);
        if (it != mRenderTargets.end()) {
            mViewportX = 0;
            mViewportY = 0;
            mViewportW = it->second.width;
            mViewportH = it->second.height;
        }
    } else {
        // Binding default framebuffer - restore canvas viewport
        mViewportX = 0;
        mViewportY = 0;
        mViewportW = mWidth;
        mViewportH = mHeight;
    }
}

void WebGPUBackend::destroyRenderTarget(RenderTargetHandle handle) {
    auto it = mRenderTargets.find(handle.id);
    if (it == mRenderTargets.end()) return;

    // Views are owned by textures, don't release them here
    mRenderTargets.erase(it);
}

// ─── Shaders ─────────────────────────────────────────────────────────────────

ShaderHandle WebGPUBackend::createShader(const ShaderDesc& desc) {
    ShaderResource resource;
    resource.name = desc.name;

    // Create vertex shader module
    if (!desc.vertexSource.empty()) {
        WGPUShaderModuleWGSLDescriptor wgslDesc = {};
        wgslDesc.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
        wgslDesc.code = desc.vertexSource.c_str();

        WGPUShaderModuleDescriptor moduleDesc = {};
        moduleDesc.nextInChain = (WGPUChainedStruct*)&wgslDesc;
        moduleDesc.label = "Vertex Shader";

        resource.vertModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDesc);
        if (!resource.vertModule) {
            printf("[WebGPUBackend] Failed to create vertex shader module!\n");
            return {};
        }
    }

    // Create fragment shader module
    if (!desc.fragmentSource.empty()) {
        WGPUShaderModuleWGSLDescriptor wgslDesc = {};
        wgslDesc.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
        wgslDesc.code = desc.fragmentSource.c_str();

        WGPUShaderModuleDescriptor moduleDesc = {};
        moduleDesc.nextInChain = (WGPUChainedStruct*)&wgslDesc;
        moduleDesc.label = "Fragment Shader";

        resource.fragModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDesc);
        if (!resource.fragModule) {
            printf("[WebGPUBackend] Failed to create fragment shader module!\n");
            if (resource.vertModule) wgpuShaderModuleRelease(resource.vertModule);
            return {};
        }
    }

    // Create bind group layout for uniforms with dynamic offset support
    WGPUBindGroupLayoutEntry layoutEntry = {};
    layoutEntry.binding = 0;
    layoutEntry.visibility = WGPUShaderStage_Vertex | WGPUShaderStage_Fragment;
    layoutEntry.buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntry.buffer.minBindingSize = 160; // Actual uniform struct size
    layoutEntry.buffer.hasDynamicOffset = true; // Enable dynamic offsets!

    WGPUBindGroupLayoutDescriptor layoutDesc = {};
    layoutDesc.entryCount = 1;
    layoutDesc.entries = &layoutEntry;
    resource.bindGroupLayout = wgpuDeviceCreateBindGroupLayout(mDevice, &layoutDesc);

    // Create pipeline layout
    WGPUPipelineLayoutDescriptor pipelineLayoutDesc = {};
    pipelineLayoutDesc.bindGroupLayoutCount = 1;
    pipelineLayoutDesc.bindGroupLayouts = &resource.bindGroupLayout;
    resource.pipelineLayout = wgpuDeviceCreatePipelineLayout(mDevice, &pipelineLayoutDesc);

    // Use the shared ring buffer for uniforms (created in init())
    // This allows dynamic offsets for each draw call
    resource.uniformBuffer = nullptr; // Don't create per-shader buffer

    // Create bind group using the shared ring buffer
    if (mUniformRingBuffer) {
        WGPUBindGroupEntry bindGroupEntry = {};
        bindGroupEntry.binding = 0;
        bindGroupEntry.buffer = mUniformRingBuffer;
        bindGroupEntry.offset = 0;
        bindGroupEntry.size = kUniformAlignment; // Size for one draw call

        WGPUBindGroupDescriptor bindGroupDesc = {};
        bindGroupDesc.layout = resource.bindGroupLayout;
        bindGroupDesc.entryCount = 1;
        bindGroupDesc.entries = &bindGroupEntry;
        resource.bindGroup = wgpuDeviceCreateBindGroup(mDevice, &bindGroupDesc);
    } else {
        // Fallback: create per-shader buffer (for shaders created before init)
        WGPUBufferDescriptor uniformBufDesc = {};
        uniformBufDesc.label = "Uniform Buffer";
        uniformBufDesc.size = 256;
        uniformBufDesc.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
        resource.uniformBuffer = wgpuDeviceCreateBuffer(mDevice, &uniformBufDesc);

        WGPUBindGroupEntry bindGroupEntry = {};
        bindGroupEntry.binding = 0;
        bindGroupEntry.buffer = resource.uniformBuffer;
        bindGroupEntry.offset = 0;
        bindGroupEntry.size = 256;

        WGPUBindGroupDescriptor bindGroupDesc = {};
        bindGroupDesc.layout = resource.bindGroupLayout;
        bindGroupDesc.entryCount = 1;
        bindGroupDesc.entries = &bindGroupEntry;
        resource.bindGroup = wgpuDeviceCreateBindGroup(mDevice, &bindGroupDesc);
    }

    // Create render pipeline
    WGPURenderPipelineDescriptor pipelineDesc = {};
    pipelineDesc.layout = resource.pipelineLayout;

    // Vertex state - must match InterleavedVertex from WebMeshAdapter:
    // - Position (vec3f, 12 bytes) at offset 0
    // - Color (vec4f, 16 bytes) at offset 12
    // - TexCoord (vec2f, 8 bytes) at offset 28
    // - Normal (vec3f, 12 bytes) at offset 36
    // Total stride: 48 bytes
    WGPUVertexAttribute vertexAttribs[4] = {};
    // Position
    vertexAttribs[0].format = WGPUVertexFormat_Float32x3;
    vertexAttribs[0].offset = 0;
    vertexAttribs[0].shaderLocation = 0;
    // Color
    vertexAttribs[1].format = WGPUVertexFormat_Float32x4;
    vertexAttribs[1].offset = 12;
    vertexAttribs[1].shaderLocation = 1;
    // Tex coord
    vertexAttribs[2].format = WGPUVertexFormat_Float32x2;
    vertexAttribs[2].offset = 28;
    vertexAttribs[2].shaderLocation = 2;
    // Normal
    vertexAttribs[3].format = WGPUVertexFormat_Float32x3;
    vertexAttribs[3].offset = 36;
    vertexAttribs[3].shaderLocation = 3;

    WGPUVertexBufferLayout vertexBufferLayout = {};
    vertexBufferLayout.arrayStride = 48; // sizeof(InterleavedVertex)
    vertexBufferLayout.stepMode = WGPUVertexStepMode_Vertex;
    vertexBufferLayout.attributeCount = 4; // position, color, texcoord, normal
    vertexBufferLayout.attributes = vertexAttribs;

    pipelineDesc.vertex.module = resource.vertModule;
    pipelineDesc.vertex.entryPoint = "vs_main";
    pipelineDesc.vertex.bufferCount = 1;
    pipelineDesc.vertex.buffers = &vertexBufferLayout;

    // Primitive state
    pipelineDesc.primitive.topology = WGPUPrimitiveTopology_TriangleList;
    pipelineDesc.primitive.stripIndexFormat = WGPUIndexFormat_Undefined;
    pipelineDesc.primitive.frontFace = WGPUFrontFace_CCW;
    pipelineDesc.primitive.cullMode = WGPUCullMode_None; // Disable culling for now

    // Depth stencil state
    // DEBUG: Using LessEqual and ensuring depth write works
    WGPUDepthStencilState depthStencil = {};
    depthStencil.format = WGPUTextureFormat_Depth24Plus;
    depthStencil.depthWriteEnabled = true;
    depthStencil.depthCompare = WGPUCompareFunction_LessEqual;
    pipelineDesc.depthStencil = &depthStencil;

    // Multisample state
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = 0xFFFFFFFF;
    pipelineDesc.multisample.alphaToCoverageEnabled = false;

    // Fragment state
    WGPUBlendState blendState = {};
    blendState.color.srcFactor = WGPUBlendFactor_SrcAlpha;
    blendState.color.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
    blendState.color.operation = WGPUBlendOperation_Add;
    blendState.alpha.srcFactor = WGPUBlendFactor_One;
    blendState.alpha.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
    blendState.alpha.operation = WGPUBlendOperation_Add;

    WGPUColorTargetState colorTarget = {};
    colorTarget.format = mSwapChainFormat;
    colorTarget.blend = &blendState;
    colorTarget.writeMask = WGPUColorWriteMask_All;

    WGPUFragmentState fragmentState = {};
    fragmentState.module = resource.fragModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;
    pipelineDesc.fragment = &fragmentState;

    resource.defaultPipeline = wgpuDeviceCreateRenderPipeline(mDevice, &pipelineDesc);
    if (!resource.defaultPipeline) {
        printf("[WebGPUBackend] Failed to create render pipeline!\n");
        // Cleanup
        wgpuBindGroupRelease(resource.bindGroup);
        wgpuBufferRelease(resource.uniformBuffer);
        wgpuPipelineLayoutRelease(resource.pipelineLayout);
        wgpuBindGroupLayoutRelease(resource.bindGroupLayout);
        if (resource.fragModule) wgpuShaderModuleRelease(resource.fragModule);
        if (resource.vertModule) wgpuShaderModuleRelease(resource.vertModule);
        return {};
    }

    // Store default pipeline (TriangleList) in the map too
    resource.pipelines[static_cast<int>(PrimitiveType::Triangles)] = resource.defaultPipeline;

    uint64_t id = generateHandleId();
    mShaders[id] = std::move(resource);

    printf("[WebGPUBackend] Created shader '%s'\n", desc.name.c_str());
    return ShaderHandle{id};
}

void WebGPUBackend::destroyShader(ShaderHandle handle) {
    auto it = mShaders.find(handle.id);
    if (it == mShaders.end()) return;

    auto& shader = it->second;
    if (shader.bindGroup) wgpuBindGroupRelease(shader.bindGroup);
    if (shader.uniformBuffer) wgpuBufferRelease(shader.uniformBuffer);
    // Release all pipelines (different primitive topologies)
    for (auto& [primType, pipeline] : shader.pipelines) {
        if (pipeline) wgpuRenderPipelineRelease(pipeline);
    }
    shader.pipelines.clear();
    if (shader.pipelineLayout) wgpuPipelineLayoutRelease(shader.pipelineLayout);
    if (shader.bindGroupLayout) wgpuBindGroupLayoutRelease(shader.bindGroupLayout);
    if (shader.fragModule) wgpuShaderModuleRelease(shader.fragModule);
    if (shader.vertModule) wgpuShaderModuleRelease(shader.vertModule);

    mShaders.erase(it);
}

void WebGPUBackend::useShader(ShaderHandle handle) {
    mCurrentShader = handle;
    mUniformsDirty = true;
}

// ─── Primitive Type Pipelines ────────────────────────────────────────────────
//
// WebGPU requires separate pipelines for different primitive topologies.
// We lazily create pipelines for each primitive type as needed.

WGPURenderPipeline WebGPUBackend::getPipelineForPrimitive(ShaderResource& shader, PrimitiveType primitive) {
    int key = static_cast<int>(primitive);

    // Check if we already have a pipeline for this primitive type
    auto it = shader.pipelines.find(key);
    if (it != shader.pipelines.end()) {
        return it->second;
    }

    // Create a new pipeline for this primitive type
    WGPURenderPipeline pipeline = createPipelineForPrimitive(shader, primitive);
    if (pipeline) {
        shader.pipelines[key] = pipeline;
    }
    return pipeline;
}

WGPURenderPipeline WebGPUBackend::createPipelineForPrimitive(ShaderResource& shader, PrimitiveType primitive) {
    // Create render pipeline with specific primitive topology
    WGPURenderPipelineDescriptor pipelineDesc = {};
    pipelineDesc.layout = shader.pipelineLayout;

    // Vertex attributes (same as default pipeline)
    WGPUVertexAttribute vertexAttribs[4] = {};
    vertexAttribs[0].format = WGPUVertexFormat_Float32x3;
    vertexAttribs[0].offset = 0;
    vertexAttribs[0].shaderLocation = 0;
    vertexAttribs[1].format = WGPUVertexFormat_Float32x4;
    vertexAttribs[1].offset = 12;
    vertexAttribs[1].shaderLocation = 1;
    vertexAttribs[2].format = WGPUVertexFormat_Float32x2;
    vertexAttribs[2].offset = 28;
    vertexAttribs[2].shaderLocation = 2;
    vertexAttribs[3].format = WGPUVertexFormat_Float32x3;
    vertexAttribs[3].offset = 36;
    vertexAttribs[3].shaderLocation = 3;

    WGPUVertexBufferLayout vertexBufferLayout = {};
    vertexBufferLayout.arrayStride = 48;
    vertexBufferLayout.stepMode = WGPUVertexStepMode_Vertex;
    vertexBufferLayout.attributeCount = 4;
    vertexBufferLayout.attributes = vertexAttribs;

    pipelineDesc.vertex.module = shader.vertModule;
    pipelineDesc.vertex.entryPoint = "vs_main";
    pipelineDesc.vertex.bufferCount = 1;
    pipelineDesc.vertex.buffers = &vertexBufferLayout;

    // Primitive state - THIS IS THE KEY DIFFERENCE
    pipelineDesc.primitive.topology = toWGPUPrimitive(primitive);

    // For strip/fan primitives with indexed drawing, we need to specify the index format
    if (primitive == PrimitiveType::TriangleStrip || primitive == PrimitiveType::LineStrip) {
        pipelineDesc.primitive.stripIndexFormat = WGPUIndexFormat_Uint32;
    } else {
        pipelineDesc.primitive.stripIndexFormat = WGPUIndexFormat_Undefined;
    }

    pipelineDesc.primitive.frontFace = WGPUFrontFace_CCW;
    pipelineDesc.primitive.cullMode = WGPUCullMode_None;

    // Depth stencil state
    WGPUDepthStencilState depthStencil = {};
    depthStencil.format = WGPUTextureFormat_Depth24Plus;
    depthStencil.depthWriteEnabled = true;
    depthStencil.depthCompare = WGPUCompareFunction_LessEqual;
    pipelineDesc.depthStencil = &depthStencil;

    // Multisample state
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = 0xFFFFFFFF;
    pipelineDesc.multisample.alphaToCoverageEnabled = false;

    // Fragment state
    WGPUBlendState blendState = {};
    blendState.color.srcFactor = WGPUBlendFactor_SrcAlpha;
    blendState.color.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
    blendState.color.operation = WGPUBlendOperation_Add;
    blendState.alpha.srcFactor = WGPUBlendFactor_One;
    blendState.alpha.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
    blendState.alpha.operation = WGPUBlendOperation_Add;

    WGPUColorTargetState colorTarget = {};
    colorTarget.format = mSwapChainFormat;
    colorTarget.blend = &blendState;
    colorTarget.writeMask = WGPUColorWriteMask_All;

    WGPUFragmentState fragmentState = {};
    fragmentState.module = shader.fragModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;
    pipelineDesc.fragment = &fragmentState;

    WGPURenderPipeline pipeline = wgpuDeviceCreateRenderPipeline(mDevice, &pipelineDesc);
    if (pipeline) {
        printf("[WebGPUBackend] Created pipeline for primitive type %d\n", static_cast<int>(primitive));
    } else {
        printf("[WebGPUBackend] Failed to create pipeline for primitive type %d!\n", static_cast<int>(primitive));
    }

    return pipeline;
}

// ─── Uniforms ────────────────────────────────────────────────────────────────
//
// Uniform Buffer Layout (matches WGSL shaders):
//   Offset 0:   mat4x4f modelViewMatrix   (64 bytes)
//   Offset 64:  mat4x4f projectionMatrix  (64 bytes)
//   Offset 128: vec4f   tint/color        (16 bytes)
//   Offset 144: vec4f   tint (color shader) or scalars (mesh shader)
//               f32     pointSize         (4 bytes at 144)
//               f32     eyeSep            (4 bytes at 148)
//               f32     focLen            (4 bytes at 152)
//               f32     _pad              (4 bytes at 156)
//   Total: 160-176 bytes depending on shader

void WebGPUBackend::setUniform(const char* name, int value) {
    // Convert to float and use float path
    setUniform(name, static_cast<float>(value));
}

void WebGPUBackend::setUniform(const char* name, float value) {
    int offset = -1;

    if (strcmp(name, "pointSize") == 0 || strcmp(name, "al_PointSize") == 0) {
        offset = 144;
    } else if (strcmp(name, "eyeSep") == 0 || strcmp(name, "eye_sep") == 0) {
        offset = 148;
    } else if (strcmp(name, "focLen") == 0 || strcmp(name, "foc_len") == 0) {
        offset = 152;
    }

    if (offset >= 0 && offset + 4 <= (int)mUniformData.size()) {
        memcpy(mUniformData.data() + offset, &value, 4);
        mUniformsDirty = true;
    }
}

void WebGPUBackend::setUniform(const char* name, float x, float y) {
    // vec2 uniforms - not commonly used in current shaders
    (void)name;
    (void)x;
    (void)y;
    mUniformsDirty = true;
}

void WebGPUBackend::setUniform(const char* name, float x, float y, float z) {
    // vec3 uniforms - handle specific cases
    (void)name;
    (void)x;
    (void)y;
    (void)z;
    mUniformsDirty = true;
}

void WebGPUBackend::setUniform(const char* name, float x, float y, float z, float w) {
    int offset = -1;

    if (strcmp(name, "tint") == 0) {
        offset = 128;
    } else if (strcmp(name, "color") == 0 || strcmp(name, "col0") == 0) {
        offset = 128;  // Color shader uses same offset as tint
    }

    if (offset >= 0 && offset + 16 <= (int)mUniformData.size()) {
        float data[4] = {x, y, z, w};
        memcpy(mUniformData.data() + offset, data, 16);
        mUniformsDirty = true;
    }
}

void WebGPUBackend::setUniformMat4(const char* name, const float* value) {
    int offset = -1;

    if (strcmp(name, "al_ModelViewMatrix") == 0 || strcmp(name, "modelViewMatrix") == 0) {
        offset = 0;
    } else if (strcmp(name, "al_ProjectionMatrix") == 0 || strcmp(name, "projectionMatrix") == 0) {
        offset = 64;
    }

    if (offset >= 0 && offset + 64 <= (int)mUniformData.size()) {
        memcpy(mUniformData.data() + offset, value, 64);
        mUniformsDirty = true;
    }
}

void WebGPUBackend::setUniformMat3(const char* name, const float* value) {
    // mat3 uniforms - would need special handling for stride
    (void)name;
    (void)value;
    mUniformsDirty = true;
}

// ─── Lighting API (Phase 2) ──────────────────────────────────────────────────

void WebGPUBackend::setLightingEnabled(bool enabled) {
    if (mLightingEnabled != enabled) {
        mLightingEnabled = enabled;
        mLightingDirty = true;
    }
}

void WebGPUBackend::setLight(int index, const float* pos, const float* ambient,
                             const float* diffuse, const float* specular,
                             const float* attenuation, bool enabled) {
    if (index < 0 || index >= 8) return;

    memcpy(mLights[index].position, pos, 16);
    memcpy(mLights[index].ambient, ambient, 16);
    memcpy(mLights[index].diffuse, diffuse, 16);
    memcpy(mLights[index].specular, specular, 16);
    memcpy(mLights[index].attenuation, attenuation, 12);
    mLights[index].enabled = enabled ? 1.0f : 0.0f;

    // Update numLights to include this light
    if (enabled && (uint32_t)(index + 1) > mNumLights) {
        mNumLights = index + 1;
    }

    mLightingDirty = true;
}

void WebGPUBackend::setMaterial(const float* ambient, const float* diffuse,
                                const float* specular, const float* emission,
                                float shininess) {
    memcpy(mMaterial.ambient, ambient, 16);
    memcpy(mMaterial.diffuse, diffuse, 16);
    memcpy(mMaterial.specular, specular, 16);
    memcpy(mMaterial.emission, emission, 16);
    mMaterial.shininess = shininess;
    mLightingDirty = true;
}

void WebGPUBackend::setGlobalAmbient(float r, float g, float b, float a) {
    mGlobalAmbient[0] = r;
    mGlobalAmbient[1] = g;
    mGlobalAmbient[2] = b;
    mGlobalAmbient[3] = a;
    mLightingDirty = true;
}

void WebGPUBackend::setNormalMatrix(const float* mat3x3) {
    // Store as 4x4 matrix for WGSL (each row padded to vec4)
    // Input is 3x3 row-major, output is 4x4 for WGSL mat4x4f
    mNormalMatrix[0] = mat3x3[0]; mNormalMatrix[1] = mat3x3[1]; mNormalMatrix[2] = mat3x3[2]; mNormalMatrix[3] = 0.0f;
    mNormalMatrix[4] = mat3x3[3]; mNormalMatrix[5] = mat3x3[4]; mNormalMatrix[6] = mat3x3[5]; mNormalMatrix[7] = 0.0f;
    mNormalMatrix[8] = mat3x3[6]; mNormalMatrix[9] = mat3x3[7]; mNormalMatrix[10] = mat3x3[8]; mNormalMatrix[11] = 0.0f;
    mNormalMatrix[12] = 0.0f; mNormalMatrix[13] = 0.0f; mNormalMatrix[14] = 0.0f; mNormalMatrix[15] = 1.0f;
    mUniformsDirty = true;
}

void WebGPUBackend::setTexture(const char* name, TextureHandle handle, int unit) {
    (void)name;  // We use unit-based binding, name is for compatibility

    if (unit < 0 || unit >= 8) return;

    // Track if binding changed
    if (mBoundTextures[unit].id != handle.id) {
        mBoundTextures[unit] = handle;
        mTextureBindingDirty = true;

        if (handle.valid()) {
            printf("[WebGPUBackend] Texture bound to unit %d (id=%llu)\n", unit, (unsigned long long)handle.id);
        }
    }
}

void WebGPUBackend::setUniformBuffer(int binding, BufferHandle handle) {
    (void)binding;
    (void)handle;
    // Would need to rebuild bind group
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

void WebGPUBackend::setVertexBuffer(BufferHandle handle, const VertexLayout& layout) {
    mCurrentVertexBuffer = handle;
    mCurrentVertexLayout = layout;
}

void WebGPUBackend::setIndexBuffer(BufferHandle handle, bool use32Bit) {
    mCurrentIndexBuffer = handle;
    mIndexBuffer32Bit = use32Bit;
}

void WebGPUBackend::draw(
    PrimitiveType primitive,
    int vertexCount,
    int firstVertex
) {
    // Ensure render pass is active
    beginRenderPass();
    if (!mRenderPassEncoder) return;

    // Flush uniforms
    flushUniforms();

    // Check rendering modes
    bool hasTexture = mBoundTextures[0].valid();
    bool useLighting = mLightingEnabled && mLitShader.valid();
    // Use screen-space shader for textured rendering without lighting (post-processing)
    bool useScreenSpace = hasTexture && !useLighting && mScreenSpaceShader.valid();
    bool useTextured = hasTexture && !useScreenSpace && mTexturedShader.valid();

    // Shader selection priority: custom > lighting > screen-space > textured > default
    ShaderHandle shaderToUse;
    if (mCurrentShader.valid()) {
        shaderToUse = mCurrentShader;
    } else if (useLighting) {
        shaderToUse = mLitShader;
    } else if (useScreenSpace) {
        shaderToUse = mScreenSpaceShader;
    } else if (useTextured) {
        shaderToUse = mTexturedShader;
    } else {
        shaderToUse = mDefaultShader;
    }

    // Get pipeline for this primitive type
    auto shaderIt = mShaders.find(shaderToUse.id);
    if (shaderIt == mShaders.end()) {
        printf("[WebGPUBackend::draw] WARNING: No valid shader!\n");
        return;
    }

    // Get or create pipeline for this primitive type
    WGPURenderPipeline pipeline = getPipelineForPrimitive(shaderIt->second, primitive);
    if (!pipeline) {
        printf("[WebGPUBackend::draw] WARNING: No valid pipeline for primitive %d!\n", static_cast<int>(primitive));
        return;
    }

    wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, pipeline);

    // Bind appropriate bind group
    if (useLighting && !mCurrentShader.valid()) {
        // Update lighting bind group if needed
        if (mLightingDirty || !mLitBindGroup) {
            updateLightingBindGroup();
        }
        if (mLitBindGroup) {
            wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, mLitBindGroup,
                                               1, &mCurrentDynamicOffset);
        }
    } else if ((useScreenSpace || useTextured) && !mCurrentShader.valid()) {
        // Screen-space and textured shaders share the same bind group layout
        if (mTextureBindingDirty || !mTexturedBindGroup) {
            updateTexturedBindGroup();
        }
        if (mTexturedBindGroup) {
            wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, mTexturedBindGroup,
                                               1, &mCurrentDynamicOffset);
        }
    } else {
        // Use regular bind group
        wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, shaderIt->second.bindGroup,
                                           1, &mCurrentDynamicOffset);
    }

    // Bind vertex buffer
    auto vbIt = mBuffers.find(mCurrentVertexBuffer.id);
    if (vbIt != mBuffers.end() && vbIt->second.buffer) {
        wgpuRenderPassEncoderSetVertexBuffer(mRenderPassEncoder, 0, vbIt->second.buffer, 0, vbIt->second.size);
    }

    // Draw
    wgpuRenderPassEncoderDraw(mRenderPassEncoder, vertexCount, 1, firstVertex, 0);
}

void WebGPUBackend::drawIndexed(
    PrimitiveType primitive,
    int indexCount,
    int firstIndex,
    int baseVertex
) {
    beginRenderPass();
    if (!mRenderPassEncoder) return;

    flushUniforms();

    // Check rendering modes
    bool hasTexture = mBoundTextures[0].valid();
    bool useLighting = mLightingEnabled && mLitShader.valid();
    // Use screen-space shader for textured rendering without lighting (post-processing)
    bool useScreenSpace = hasTexture && !useLighting && mScreenSpaceShader.valid();
    bool useTextured = hasTexture && !useScreenSpace && mTexturedShader.valid();

    // Shader selection priority: custom > lighting > screen-space > textured > default
    ShaderHandle shaderToUse;
    if (mCurrentShader.valid()) {
        shaderToUse = mCurrentShader;
    } else if (useLighting) {
        shaderToUse = mLitShader;
    } else if (useScreenSpace) {
        shaderToUse = mScreenSpaceShader;
    } else if (useTextured) {
        shaderToUse = mTexturedShader;
    } else {
        shaderToUse = mDefaultShader;
    }

    // Get pipeline for this primitive type
    auto shaderIt = mShaders.find(shaderToUse.id);
    if (shaderIt == mShaders.end()) {
        printf("[WebGPUBackend::drawIndexed] WARNING: No valid shader!\n");
        return;
    }

    // Get or create pipeline for this primitive type
    WGPURenderPipeline pipeline = getPipelineForPrimitive(shaderIt->second, primitive);
    if (!pipeline) {
        printf("[WebGPUBackend::drawIndexed] WARNING: No valid pipeline for primitive %d!\n", static_cast<int>(primitive));
        return;
    }

    wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, pipeline);

    // Bind appropriate bind group
    if (useLighting && !mCurrentShader.valid()) {
        if (mLightingDirty || !mLitBindGroup) {
            updateLightingBindGroup();
        }
        if (mLitBindGroup) {
            wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, mLitBindGroup,
                                               1, &mCurrentDynamicOffset);
        }
    } else if ((useScreenSpace || useTextured) && !mCurrentShader.valid()) {
        // Screen-space and textured shaders share the same bind group layout
        if (mTextureBindingDirty || !mTexturedBindGroup) {
            updateTexturedBindGroup();
        }
        if (mTexturedBindGroup) {
            wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, mTexturedBindGroup,
                                               1, &mCurrentDynamicOffset);
        }
    } else {
        wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, shaderIt->second.bindGroup,
                                           1, &mCurrentDynamicOffset);
    }

    // Bind vertex buffer
    auto vbIt = mBuffers.find(mCurrentVertexBuffer.id);
    if (vbIt != mBuffers.end() && vbIt->second.buffer) {
        wgpuRenderPassEncoderSetVertexBuffer(mRenderPassEncoder, 0, vbIt->second.buffer, 0, vbIt->second.size);
    }

    // Bind index buffer
    auto ibIt = mBuffers.find(mCurrentIndexBuffer.id);
    if (ibIt != mBuffers.end() && ibIt->second.buffer) {
        WGPUIndexFormat indexFormat = mIndexBuffer32Bit ? WGPUIndexFormat_Uint32 : WGPUIndexFormat_Uint16;
        wgpuRenderPassEncoderSetIndexBuffer(mRenderPassEncoder, ibIt->second.buffer, indexFormat, 0, ibIt->second.size);
    }

    // Draw
    wgpuRenderPassEncoderDrawIndexed(mRenderPassEncoder, indexCount, 1, firstIndex, baseVertex, 0);
}

void WebGPUBackend::drawInstanced(
    PrimitiveType primitive,
    int vertexCount,
    int instanceCount,
    int firstVertex,
    int firstInstance
) {
    beginRenderPass();
    if (!mRenderPassEncoder) return;

    flushUniforms();

    // Use current shader or fall back to default
    ShaderHandle shaderToUse = mCurrentShader.valid() ? mCurrentShader : mDefaultShader;

    // Get pipeline for this primitive type
    auto shaderIt = mShaders.find(shaderToUse.id);
    if (shaderIt == mShaders.end()) return;

    // Get or create pipeline for this primitive type
    WGPURenderPipeline pipeline = getPipelineForPrimitive(shaderIt->second, primitive);
    if (!pipeline) return;

    wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, pipeline);
    // Use dynamic offset for uniforms
    wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, shaderIt->second.bindGroup,
                                       1, &mCurrentDynamicOffset);

    // Bind vertex buffer
    auto vbIt = mBuffers.find(mCurrentVertexBuffer.id);
    if (vbIt != mBuffers.end() && vbIt->second.buffer) {
        wgpuRenderPassEncoderSetVertexBuffer(mRenderPassEncoder, 0, vbIt->second.buffer, 0, vbIt->second.size);
    }

    wgpuRenderPassEncoderDraw(mRenderPassEncoder, vertexCount, instanceCount, firstVertex, firstInstance);
}

void WebGPUBackend::drawIndexedInstanced(
    PrimitiveType primitive,
    int indexCount,
    int instanceCount,
    int firstIndex,
    int baseVertex,
    int firstInstance
) {
    beginRenderPass();
    if (!mRenderPassEncoder) return;

    flushUniforms();

    // Use current shader or fall back to default
    ShaderHandle shaderToUse = mCurrentShader.valid() ? mCurrentShader : mDefaultShader;

    // Get pipeline for this primitive type
    auto shaderIt = mShaders.find(shaderToUse.id);
    if (shaderIt == mShaders.end()) return;

    // Get or create pipeline for this primitive type
    WGPURenderPipeline pipeline = getPipelineForPrimitive(shaderIt->second, primitive);
    if (!pipeline) return;

    wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, pipeline);
    // Use dynamic offset for uniforms
    wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, shaderIt->second.bindGroup,
                                       1, &mCurrentDynamicOffset);

    // Bind vertex buffer
    auto vbIt = mBuffers.find(mCurrentVertexBuffer.id);
    if (vbIt != mBuffers.end() && vbIt->second.buffer) {
        wgpuRenderPassEncoderSetVertexBuffer(mRenderPassEncoder, 0, vbIt->second.buffer, 0, vbIt->second.size);
    }

    // Bind index buffer
    auto ibIt = mBuffers.find(mCurrentIndexBuffer.id);
    if (ibIt != mBuffers.end() && ibIt->second.buffer) {
        WGPUIndexFormat indexFormat = mIndexBuffer32Bit ? WGPUIndexFormat_Uint32 : WGPUIndexFormat_Uint16;
        wgpuRenderPassEncoderSetIndexBuffer(mRenderPassEncoder, ibIt->second.buffer, indexFormat, 0, ibIt->second.size);
    }

    wgpuRenderPassEncoderDrawIndexed(mRenderPassEncoder, indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
}

// ─── Compute ─────────────────────────────────────────────────────────────────

ComputePipelineHandle WebGPUBackend::createComputePipeline(const ShaderDesc& desc) {
    if (desc.computeSource.empty()) {
        return {};
    }

    ComputeResource resource;

    // Create shader module
    WGPUShaderModuleWGSLDescriptor wgslDesc = {};
    wgslDesc.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDesc.code = desc.computeSource.c_str();

    WGPUShaderModuleDescriptor moduleDesc = {};
    moduleDesc.nextInChain = (WGPUChainedStruct*)&wgslDesc;
    moduleDesc.label = "Compute Shader";

    resource.module = wgpuDeviceCreateShaderModule(mDevice, &moduleDesc);
    if (!resource.module) {
        printf("[WebGPUBackend] Failed to create compute shader module!\n");
        return {};
    }

    // Create bind group layout (empty for now - would need reflection)
    WGPUBindGroupLayoutDescriptor layoutDesc = {};
    layoutDesc.entryCount = 0;
    resource.bindGroupLayout = wgpuDeviceCreateBindGroupLayout(mDevice, &layoutDesc);

    // Create pipeline layout
    WGPUPipelineLayoutDescriptor pipelineLayoutDesc = {};
    pipelineLayoutDesc.bindGroupLayoutCount = 1;
    pipelineLayoutDesc.bindGroupLayouts = &resource.bindGroupLayout;
    resource.pipelineLayout = wgpuDeviceCreatePipelineLayout(mDevice, &pipelineLayoutDesc);

    // Create compute pipeline
    WGPUComputePipelineDescriptor pipelineDesc = {};
    pipelineDesc.layout = resource.pipelineLayout;
    pipelineDesc.compute.module = resource.module;
    pipelineDesc.compute.entryPoint = "cs_main";

    resource.pipeline = wgpuDeviceCreateComputePipeline(mDevice, &pipelineDesc);
    if (!resource.pipeline) {
        printf("[WebGPUBackend] Failed to create compute pipeline!\n");
        wgpuPipelineLayoutRelease(resource.pipelineLayout);
        wgpuBindGroupLayoutRelease(resource.bindGroupLayout);
        wgpuShaderModuleRelease(resource.module);
        return {};
    }

    uint64_t id = generateHandleId();
    mComputePipelines[id] = resource;

    return ComputePipelineHandle{id};
}

void WebGPUBackend::destroyComputePipeline(ComputePipelineHandle handle) {
    auto it = mComputePipelines.find(handle.id);
    if (it == mComputePipelines.end()) return;

    auto& compute = it->second;
    if (compute.bindGroup) wgpuBindGroupRelease(compute.bindGroup);
    if (compute.pipeline) wgpuComputePipelineRelease(compute.pipeline);
    if (compute.pipelineLayout) wgpuPipelineLayoutRelease(compute.pipelineLayout);
    if (compute.bindGroupLayout) wgpuBindGroupLayoutRelease(compute.bindGroupLayout);
    if (compute.module) wgpuShaderModuleRelease(compute.module);

    mComputePipelines.erase(it);
}

void WebGPUBackend::bindStorageBuffer(int binding, BufferHandle handle) {
    (void)binding;
    (void)handle;
    // Would need to rebuild bind group
}

void WebGPUBackend::bindStorageTexture(int binding, TextureHandle handle) {
    (void)binding;
    (void)handle;
    // Would need to rebuild bind group
}

void WebGPUBackend::dispatch(
    ComputePipelineHandle pipeline,
    int groupsX,
    int groupsY,
    int groupsZ
) {
    if (!mCommandEncoder) return;

    auto it = mComputePipelines.find(pipeline.id);
    if (it == mComputePipelines.end()) return;

    // End render pass if active
    endRenderPass();

    // Begin compute pass
    WGPUComputePassDescriptor computePassDesc = {};
    mComputePassEncoder = wgpuCommandEncoderBeginComputePass(mCommandEncoder, &computePassDesc);

    wgpuComputePassEncoderSetPipeline(mComputePassEncoder, it->second.pipeline);
    if (it->second.bindGroup) {
        wgpuComputePassEncoderSetBindGroup(mComputePassEncoder, 0, it->second.bindGroup, 0, nullptr);
    }
    wgpuComputePassEncoderDispatchWorkgroups(mComputePassEncoder, groupsX, groupsY, groupsZ);

    wgpuComputePassEncoderEnd(mComputePassEncoder);
    wgpuComputePassEncoderRelease(mComputePassEncoder);
    mComputePassEncoder = nullptr;
}

void WebGPUBackend::computeBarrier() {
    // WebGPU handles synchronization automatically
    // Explicit barriers not needed between passes
}

// ─── Buffer Operations ───────────────────────────────────────────────────────

void WebGPUBackend::readBuffer(
    BufferHandle handle,
    void* dest,
    size_t size,
    size_t offset
) {
    // WebGPU buffer readback is async - would need callback
    // For now, skip implementation
    (void)handle;
    (void)dest;
    (void)size;
    (void)offset;
}

void WebGPUBackend::copyBuffer(
    BufferHandle src,
    BufferHandle dst,
    size_t size,
    size_t srcOffset,
    size_t dstOffset
) {
    if (!mCommandEncoder) return;

    auto srcIt = mBuffers.find(src.id);
    auto dstIt = mBuffers.find(dst.id);
    if (srcIt == mBuffers.end() || dstIt == mBuffers.end()) return;

    // End render pass if active
    endRenderPass();

    wgpuCommandEncoderCopyBufferToBuffer(
        mCommandEncoder,
        srcIt->second.buffer, srcOffset,
        dstIt->second.buffer, dstOffset,
        size
    );
}

// ─── Helper Methods ──────────────────────────────────────────────────────────

void WebGPUBackend::createSwapChain() {
    // In Emscripten's WebGPU, we use JavaScript to configure the canvas context
    // and create the swap chain without going through wgpuCreateInstance
    // (which requires nullptr descriptor in Emscripten)

    printf("[WebGPUBackend] Creating swap chain via JavaScript canvas configuration...\n");

    // Configure the canvas WebGPU context from JavaScript
    // Note: In MODULARIZE mode, we need to be careful about Module access
    // IMPORTANT: JavaScript runtime.ts may have already configured the context
    // We should reuse that configuration if available
    int success = EM_ASM_INT({
        try {
            console.log('[WebGPUBackend] Starting JS canvas configuration...');

            // Check if JavaScript already configured the context
            if (Module._webgpuCanvasContext) {
                console.log('[WebGPUBackend] Context already configured by JavaScript, reusing...');
                return 1;
            }

            // Try multiple methods to find the canvas
            var canvas = null;

            // Method 1: Module.canvas (set by Emscripten config)
            if (typeof Module !== 'undefined' && Module.canvas) {
                canvas = Module.canvas;
                console.log('[WebGPUBackend] Found canvas via Module.canvas');
            }

            // Method 2: Look for canvas by ID 'canvas'
            if (!canvas) {
                canvas = document.getElementById('canvas');
                if (canvas) {
                    console.log('[WebGPUBackend] Found canvas via getElementById("canvas")');
                }
            }

            // Method 3: Look for global __alloCanvas (set by runtime.ts)
            if (!canvas && typeof window !== 'undefined' && window.__alloCanvas) {
                canvas = window.__alloCanvas;
                console.log('[WebGPUBackend] Found canvas via window.__alloCanvas');
            }

            // Method 4: Query for any canvas in the document
            if (!canvas) {
                var allCanvases = document.querySelectorAll('canvas');
                console.log('[WebGPUBackend] All canvases in document:', allCanvases.length);
                allCanvases.forEach(function(c, i) {
                    console.log('[WebGPUBackend] Canvas ' + i + ':', c.id, c.className, c.width + 'x' + c.height);
                });
                if (allCanvases.length > 0) {
                    canvas = allCanvases[0];
                    console.log('[WebGPUBackend] Using first canvas found');
                }
            }

            if (!canvas) {
                console.error('[WebGPUBackend] No canvas found by any method!');
                return 0;
            }

            console.log('[WebGPUBackend] Canvas dimensions:', canvas.width, 'x', canvas.height);

            // Ensure Module.canvas is set (some Emscripten internals expect this)
            if (typeof Module !== 'undefined') {
                Module.canvas = canvas;
            }

            console.log('[WebGPUBackend] Checking navigator.gpu...');
            if (!navigator.gpu) {
                console.error('[WebGPUBackend] navigator.gpu not available!');
                return 0;
            }

            console.log('[WebGPUBackend] Getting webgpu context from canvas...');

            var context = canvas.getContext('webgpu');
            console.log('[WebGPUBackend] WebGPU context result:', context);

            if (!context) {
                console.error('[WebGPUBackend] Failed to get webgpu context from canvas');
                console.error('[WebGPUBackend] This usually means a WebGL context already exists on this canvas.');
                // Check what context exists
                var existingCtx = canvas.getContext('webgl2') || canvas.getContext('webgl');
                if (existingCtx) {
                    console.error('[WebGPUBackend] Canvas already has a WebGL context!');
                }
                return 0;
            }

            console.log('[WebGPUBackend] Checking Module.preinitializedWebGPUDevice...');
            if (typeof Module === 'undefined') {
                console.error('[WebGPUBackend] Module is undefined!');
                return 0;
            }

            var device = Module.preinitializedWebGPUDevice;
            console.log('[WebGPUBackend] Device:', device);
            if (!device) {
                console.error('[WebGPUBackend] No preinitializedWebGPUDevice!');
                return 0;
            }

            console.log('[WebGPUBackend] Getting preferred canvas format...');
            var format = navigator.gpu.getPreferredCanvasFormat();
            console.log('[WebGPUBackend] Preferred format:', format);

            console.log('[WebGPUBackend] Configuring context...');
            context.configure({
                device: device,
                format: format,
                alphaMode: 'premultiplied',
            });

            // Store context and format for later use
            Module._webgpuCanvasContext = context;
            Module._webgpuCanvasFormat = format;

            // Also ensure window.Module is set for Emscripten internals
            if (typeof window !== 'undefined') {
                window.Module = Module;
            }

            console.log('[WebGPUBackend] Canvas WebGPU context configured successfully!');
            return 1;
        } catch (e) {
            console.error('[WebGPUBackend] Exception in JS canvas configuration:', e);
            console.error('[WebGPUBackend] Stack:', e.stack);
            return 0;
        }
    });

    if (!success) {
        printf("[WebGPUBackend] ERROR: JavaScript canvas configuration failed!\n");
        return;
    }

    printf("[WebGPUBackend] Creating WGPUSwapChain...\n");

    // Verify Module.canvas is accessible before calling wgpuDeviceCreateSwapChain
    int canvasReady = EM_ASM_INT({
        console.log('[WebGPUBackend] Pre-swap-chain check:');
        console.log('[WebGPUBackend]   Module defined:', typeof Module !== 'undefined');
        console.log('[WebGPUBackend]   Module.canvas:', Module ? Module.canvas : 'N/A');
        console.log('[WebGPUBackend]   window.Module:', typeof window !== 'undefined' && window.Module ? 'defined' : 'undefined');

        if (typeof Module === 'undefined' || !Module.canvas) {
            console.error('[WebGPUBackend] Module.canvas not ready!');
            // Try to fix it
            if (typeof window !== 'undefined' && window.__alloCanvas) {
                Module.canvas = window.__alloCanvas;
                console.log('[WebGPUBackend] Fixed Module.canvas from window.__alloCanvas');
            } else {
                var canvas = document.getElementById('canvas') || document.querySelector('canvas');
                if (canvas) {
                    Module.canvas = canvas;
                    console.log('[WebGPUBackend] Fixed Module.canvas from DOM');
                } else {
                    console.error('[WebGPUBackend] Cannot find any canvas!');
                    return 0;
                }
            }
        }
        return 1;
    });

    if (!canvasReady) {
        printf("[WebGPUBackend] ERROR: Canvas not ready for swap chain!\n");
        return;
    }

    // Instead of using Emscripten's wgpuDeviceCreateSwapChain (which has MODULARIZE issues),
    // we'll manage the swap chain texture ourselves using the JavaScript canvas context.
    // Store the context format for later use
    mSwapChainFormat = WGPUTextureFormat_BGRA8Unorm; // Match the preferred format

    // We don't actually create a WGPUSwapChain - we'll get textures directly from the JS context
    // in beginFrame(). Set mSwapChain to a dummy non-null value to indicate success.
    // The actual texture acquisition happens in beginFrame() via JavaScript.
    mSwapChain = (WGPUSwapChain)1; // Dummy handle - we manage textures via JS

    printf("[WebGPUBackend] SwapChain setup complete (using JS canvas context directly)\n");
}

void WebGPUBackend::createDepthBuffer() {
    WGPUTextureDescriptor depthTexDesc = {};
    depthTexDesc.usage = WGPUTextureUsage_RenderAttachment;
    depthTexDesc.dimension = WGPUTextureDimension_2D;
    depthTexDesc.size = {(uint32_t)mWidth, (uint32_t)mHeight, 1};
    depthTexDesc.format = WGPUTextureFormat_Depth24Plus;
    depthTexDesc.mipLevelCount = 1;
    depthTexDesc.sampleCount = 1;

    mDepthTexture = wgpuDeviceCreateTexture(mDevice, &depthTexDesc);

    WGPUTextureViewDescriptor depthViewDesc = {};
    depthViewDesc.format = WGPUTextureFormat_Depth24Plus;
    depthViewDesc.dimension = WGPUTextureViewDimension_2D;
    depthViewDesc.mipLevelCount = 1;
    depthViewDesc.arrayLayerCount = 1;

    mDepthTextureView = wgpuTextureCreateView(mDepthTexture, &depthViewDesc);
}

void WebGPUBackend::createDefaultShader() {
    ShaderDesc desc;
    desc.name = "default_mesh";
    desc.vertexSource = kDefaultVertexShader;
    desc.fragmentSource = kDefaultFragmentShader;

    mDefaultShader = createShader(desc);
    if (mDefaultShader.valid()) {
        printf("[WebGPUBackend] Default shader created successfully\n");

        // Initialize uniform data with sensible defaults

        // Identity matrix for modelViewMatrix (offset 0, 64 bytes)
        // Column-major: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
        float identityMat[16] = {
            1.0f, 0.0f, 0.0f, 0.0f,  // column 0
            0.0f, 1.0f, 0.0f, 0.0f,  // column 1
            0.0f, 0.0f, 1.0f, 0.0f,  // column 2
            0.0f, 0.0f, 0.0f, 1.0f   // column 3
        };
        memcpy(mUniformData.data() + 0, identityMat, 64);

        // Identity matrix for projectionMatrix (offset 64, 64 bytes)
        memcpy(mUniformData.data() + 64, identityMat, 64);

        // Set default tint to white (offset 128, 16 bytes)
        float tint[4] = {1.0f, 1.0f, 1.0f, 1.0f};
        memcpy(mUniformData.data() + 128, tint, 16);

        // Set default scalar uniforms (offset 144+)
        float pointSize = 1.0f;
        float eyeSep = 0.0f;
        float focLen = 6.0f;
        float pad = 0.0f;
        memcpy(mUniformData.data() + 144, &pointSize, 4);
        memcpy(mUniformData.data() + 148, &eyeSep, 4);
        memcpy(mUniformData.data() + 152, &focLen, 4);
        memcpy(mUniformData.data() + 156, &pad, 4);

        mUniformsDirty = true;
        printf("[WebGPUBackend] Uniform buffer initialized with defaults\n");
    } else {
        printf("[WebGPUBackend] ERROR: Failed to create default shader!\n");
    }
}

void WebGPUBackend::createTexturedShader() {
    // The textured shader needs a special bind group layout with texture/sampler
    ShaderResource resource;
    resource.name = "textured_mesh";

    // Create vertex shader module
    WGPUShaderModuleWGSLDescriptor wgslDescVert = {};
    wgslDescVert.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescVert.code = kTexturedVertexShader;

    WGPUShaderModuleDescriptor moduleDescVert = {};
    moduleDescVert.nextInChain = &wgslDescVert.chain;
    moduleDescVert.label = "textured_vert";
    resource.vertModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescVert);

    // Create fragment shader module
    WGPUShaderModuleWGSLDescriptor wgslDescFrag = {};
    wgslDescFrag.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescFrag.code = kTexturedFragmentShader;

    WGPUShaderModuleDescriptor moduleDescFrag = {};
    moduleDescFrag.nextInChain = &wgslDescFrag.chain;
    moduleDescFrag.label = "textured_frag";
    resource.fragModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescFrag);

    if (!resource.vertModule || !resource.fragModule) {
        printf("[WebGPUBackend] ERROR: Failed to create textured shader modules!\n");
        return;
    }

    // Create bind group layout with uniform buffer + texture + sampler
    WGPUBindGroupLayoutEntry layoutEntries[3] = {};

    // Binding 0: Uniform buffer
    layoutEntries[0].binding = 0;
    layoutEntries[0].visibility = WGPUShaderStage_Vertex | WGPUShaderStage_Fragment;
    layoutEntries[0].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[0].buffer.minBindingSize = 160;
    layoutEntries[0].buffer.hasDynamicOffset = true;

    // Binding 1: Texture
    layoutEntries[1].binding = 1;
    layoutEntries[1].visibility = WGPUShaderStage_Fragment;
    layoutEntries[1].texture.sampleType = WGPUTextureSampleType_Float;
    layoutEntries[1].texture.viewDimension = WGPUTextureViewDimension_2D;
    layoutEntries[1].texture.multisampled = false;

    // Binding 2: Sampler
    layoutEntries[2].binding = 2;
    layoutEntries[2].visibility = WGPUShaderStage_Fragment;
    layoutEntries[2].sampler.type = WGPUSamplerBindingType_Filtering;

    WGPUBindGroupLayoutDescriptor layoutDesc = {};
    layoutDesc.entryCount = 3;
    layoutDesc.entries = layoutEntries;
    resource.bindGroupLayout = wgpuDeviceCreateBindGroupLayout(mDevice, &layoutDesc);

    // Create pipeline layout
    WGPUPipelineLayoutDescriptor pipelineLayoutDesc = {};
    pipelineLayoutDesc.bindGroupLayoutCount = 1;
    pipelineLayoutDesc.bindGroupLayouts = &resource.bindGroupLayout;
    resource.pipelineLayout = wgpuDeviceCreatePipelineLayout(mDevice, &pipelineLayoutDesc);

    // We don't create a bind group here - it's created dynamically when a texture is bound
    resource.uniformBuffer = nullptr;
    resource.bindGroup = nullptr;

    // Create default render pipeline (TriangleList)
    WGPURenderPipelineDescriptor pipelineDesc = {};
    pipelineDesc.layout = resource.pipelineLayout;

    // Vertex state - must match InterleavedVertex layout
    WGPUVertexAttribute vertexAttrs[4] = {};
    vertexAttrs[0].format = WGPUVertexFormat_Float32x3;  // position
    vertexAttrs[0].offset = 0;
    vertexAttrs[0].shaderLocation = 0;
    vertexAttrs[1].format = WGPUVertexFormat_Float32x4;  // color
    vertexAttrs[1].offset = 12;
    vertexAttrs[1].shaderLocation = 1;
    vertexAttrs[2].format = WGPUVertexFormat_Float32x2;  // texcoord
    vertexAttrs[2].offset = 28;
    vertexAttrs[2].shaderLocation = 2;
    vertexAttrs[3].format = WGPUVertexFormat_Float32x3;  // normal
    vertexAttrs[3].offset = 36;
    vertexAttrs[3].shaderLocation = 3;

    WGPUVertexBufferLayout vertexBufferLayout = {};
    vertexBufferLayout.arrayStride = 48;  // sizeof(InterleavedVertex)
    vertexBufferLayout.stepMode = WGPUVertexStepMode_Vertex;
    vertexBufferLayout.attributeCount = 4;
    vertexBufferLayout.attributes = vertexAttrs;

    WGPUVertexState vertexState = {};
    vertexState.module = resource.vertModule;
    vertexState.entryPoint = "vs_main";
    vertexState.bufferCount = 1;
    vertexState.buffers = &vertexBufferLayout;
    pipelineDesc.vertex = vertexState;

    // Primitive state
    WGPUPrimitiveState primitiveState = {};
    primitiveState.topology = WGPUPrimitiveTopology_TriangleList;
    primitiveState.stripIndexFormat = WGPUIndexFormat_Undefined;
    primitiveState.frontFace = WGPUFrontFace_CCW;
    primitiveState.cullMode = WGPUCullMode_None;
    pipelineDesc.primitive = primitiveState;

    // Fragment state
    WGPUBlendState blendState = {};
    blendState.color.srcFactor = WGPUBlendFactor_SrcAlpha;
    blendState.color.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
    blendState.color.operation = WGPUBlendOperation_Add;
    blendState.alpha.srcFactor = WGPUBlendFactor_One;
    blendState.alpha.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
    blendState.alpha.operation = WGPUBlendOperation_Add;

    WGPUColorTargetState colorTarget = {};
    colorTarget.format = mSwapChainFormat;
    colorTarget.blend = &blendState;
    colorTarget.writeMask = WGPUColorWriteMask_All;

    WGPUFragmentState fragmentState = {};
    fragmentState.module = resource.fragModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;
    pipelineDesc.fragment = &fragmentState;

    // Depth state
    WGPUDepthStencilState depthState = {};
    depthState.format = WGPUTextureFormat_Depth24Plus;
    depthState.depthWriteEnabled = true;
    depthState.depthCompare = WGPUCompareFunction_Less;
    pipelineDesc.depthStencil = &depthState;

    // Multisample
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = 0xFFFFFFFF;

    resource.defaultPipeline = wgpuDeviceCreateRenderPipeline(mDevice, &pipelineDesc);
    if (!resource.defaultPipeline) {
        printf("[WebGPUBackend] ERROR: Failed to create textured shader pipeline!\n");
        wgpuPipelineLayoutRelease(resource.pipelineLayout);
        wgpuBindGroupLayoutRelease(resource.bindGroupLayout);
        wgpuShaderModuleRelease(resource.fragModule);
        wgpuShaderModuleRelease(resource.vertModule);
        return;
    }

    resource.pipelines[static_cast<int>(PrimitiveType::Triangles)] = resource.defaultPipeline;

    uint64_t id = generateHandleId();
    mShaders[id] = std::move(resource);
    mTexturedShader = ShaderHandle{id};

    printf("[WebGPUBackend] Textured shader created successfully\n");
}

void WebGPUBackend::updateTexturedBindGroup() {
    // Create/update bind group for textured rendering
    if (!mTexturedShader.valid() || !mBoundTextures[0].valid()) return;

    auto shaderIt = mShaders.find(mTexturedShader.id);
    if (shaderIt == mShaders.end()) return;

    auto texIt = mTextures.find(mBoundTextures[0].id);
    if (texIt == mTextures.end()) return;

    // Release old bind group
    if (mTexturedBindGroup) {
        wgpuBindGroupRelease(mTexturedBindGroup);
        mTexturedBindGroup = nullptr;
    }

    // Create bind group entries
    WGPUBindGroupEntry entries[3] = {};

    // Binding 0: Uniform buffer (using ring buffer)
    entries[0].binding = 0;
    entries[0].buffer = mUniformRingBuffer;
    entries[0].offset = 0;
    entries[0].size = 256;

    // Binding 1: Texture view
    entries[1].binding = 1;
    entries[1].textureView = texIt->second.view;

    // Binding 2: Sampler
    entries[2].binding = 2;
    entries[2].sampler = texIt->second.sampler;

    WGPUBindGroupDescriptor bindGroupDesc = {};
    bindGroupDesc.layout = shaderIt->second.bindGroupLayout;
    bindGroupDesc.entryCount = 3;
    bindGroupDesc.entries = entries;

    mTexturedBindGroup = wgpuDeviceCreateBindGroup(mDevice, &bindGroupDesc);
    mTextureBindingDirty = false;
}

void WebGPUBackend::createScreenSpaceShader() {
    // Screen-space shader for post-processing - no transformation
    ShaderResource resource;
    resource.name = "screenspace_textured";

    // Create vertex shader module
    WGPUShaderModuleWGSLDescriptor wgslDescVert = {};
    wgslDescVert.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescVert.code = kScreenSpaceVertexShader;

    WGPUShaderModuleDescriptor moduleDescVert = {};
    moduleDescVert.nextInChain = &wgslDescVert.chain;
    moduleDescVert.label = "screenspace_vert";
    resource.vertModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescVert);

    // Create fragment shader module
    WGPUShaderModuleWGSLDescriptor wgslDescFrag = {};
    wgslDescFrag.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescFrag.code = kScreenSpaceFragmentShader;

    WGPUShaderModuleDescriptor moduleDescFrag = {};
    moduleDescFrag.nextInChain = &wgslDescFrag.chain;
    moduleDescFrag.label = "screenspace_frag";
    resource.fragModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescFrag);

    if (!resource.vertModule || !resource.fragModule) {
        printf("[WebGPUBackend] ERROR: Failed to create screen-space shader modules!\n");
        return;
    }

    // Create bind group layout with uniform buffer + texture + sampler
    WGPUBindGroupLayoutEntry layoutEntries[3] = {};

    // Binding 0: Uniform buffer
    layoutEntries[0].binding = 0;
    layoutEntries[0].visibility = WGPUShaderStage_Vertex | WGPUShaderStage_Fragment;
    layoutEntries[0].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[0].buffer.minBindingSize = 160;
    layoutEntries[0].buffer.hasDynamicOffset = true;

    // Binding 1: Texture
    layoutEntries[1].binding = 1;
    layoutEntries[1].visibility = WGPUShaderStage_Fragment;
    layoutEntries[1].texture.sampleType = WGPUTextureSampleType_Float;
    layoutEntries[1].texture.viewDimension = WGPUTextureViewDimension_2D;
    layoutEntries[1].texture.multisampled = false;

    // Binding 2: Sampler
    layoutEntries[2].binding = 2;
    layoutEntries[2].visibility = WGPUShaderStage_Fragment;
    layoutEntries[2].sampler.type = WGPUSamplerBindingType_Filtering;

    WGPUBindGroupLayoutDescriptor layoutDesc = {};
    layoutDesc.entryCount = 3;
    layoutDesc.entries = layoutEntries;
    resource.bindGroupLayout = wgpuDeviceCreateBindGroupLayout(mDevice, &layoutDesc);

    // Create pipeline layout
    WGPUPipelineLayoutDescriptor pipelineLayoutDesc = {};
    pipelineLayoutDesc.bindGroupLayoutCount = 1;
    pipelineLayoutDesc.bindGroupLayouts = &resource.bindGroupLayout;
    resource.pipelineLayout = wgpuDeviceCreatePipelineLayout(mDevice, &pipelineLayoutDesc);

    // Create render pipeline
    WGPURenderPipelineDescriptor pipelineDesc = {};
    pipelineDesc.layout = resource.pipelineLayout;

    // Vertex state - must match InterleavedVertex layout
    WGPUVertexAttribute vertexAttrs[4] = {};
    vertexAttrs[0].format = WGPUVertexFormat_Float32x3;  // position
    vertexAttrs[0].offset = 0;
    vertexAttrs[0].shaderLocation = 0;
    vertexAttrs[1].format = WGPUVertexFormat_Float32x4;  // color
    vertexAttrs[1].offset = 12;
    vertexAttrs[1].shaderLocation = 1;
    vertexAttrs[2].format = WGPUVertexFormat_Float32x2;  // texcoord
    vertexAttrs[2].offset = 28;
    vertexAttrs[2].shaderLocation = 2;
    vertexAttrs[3].format = WGPUVertexFormat_Float32x3;  // normal
    vertexAttrs[3].offset = 36;
    vertexAttrs[3].shaderLocation = 3;

    WGPUVertexBufferLayout vertexBufferLayout = {};
    vertexBufferLayout.arrayStride = 48;  // sizeof(InterleavedVertex)
    vertexBufferLayout.stepMode = WGPUVertexStepMode_Vertex;
    vertexBufferLayout.attributeCount = 4;
    vertexBufferLayout.attributes = vertexAttrs;

    WGPUVertexState vertexState = {};
    vertexState.module = resource.vertModule;
    vertexState.entryPoint = "vs_main";
    vertexState.bufferCount = 1;
    vertexState.buffers = &vertexBufferLayout;
    pipelineDesc.vertex = vertexState;

    // Primitive state
    WGPUPrimitiveState primitiveState = {};
    primitiveState.topology = WGPUPrimitiveTopology_TriangleList;
    primitiveState.stripIndexFormat = WGPUIndexFormat_Undefined;
    primitiveState.frontFace = WGPUFrontFace_CCW;
    primitiveState.cullMode = WGPUCullMode_None;
    pipelineDesc.primitive = primitiveState;

    // Fragment state - alpha blending
    WGPUBlendState blendState = {};
    blendState.color.srcFactor = WGPUBlendFactor_SrcAlpha;
    blendState.color.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
    blendState.color.operation = WGPUBlendOperation_Add;
    blendState.alpha.srcFactor = WGPUBlendFactor_One;
    blendState.alpha.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
    blendState.alpha.operation = WGPUBlendOperation_Add;

    WGPUColorTargetState colorTarget = {};
    colorTarget.format = mSwapChainFormat;
    colorTarget.blend = &blendState;
    colorTarget.writeMask = WGPUColorWriteMask_All;

    WGPUFragmentState fragmentState = {};
    fragmentState.module = resource.fragModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;
    pipelineDesc.fragment = &fragmentState;

    // No depth testing for screen-space rendering
    pipelineDesc.depthStencil = nullptr;

    // Multisample
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = 0xFFFFFFFF;

    resource.defaultPipeline = wgpuDeviceCreateRenderPipeline(mDevice, &pipelineDesc);
    if (!resource.defaultPipeline) {
        printf("[WebGPUBackend] ERROR: Failed to create screen-space shader pipeline!\n");
        wgpuPipelineLayoutRelease(resource.pipelineLayout);
        wgpuBindGroupLayoutRelease(resource.bindGroupLayout);
        wgpuShaderModuleRelease(resource.fragModule);
        wgpuShaderModuleRelease(resource.vertModule);
        return;
    }

    resource.pipelines[static_cast<int>(PrimitiveType::Triangles)] = resource.defaultPipeline;

    uint64_t id = generateHandleId();
    mShaders[id] = std::move(resource);
    mScreenSpaceShader = ShaderHandle{id};

    printf("[WebGPUBackend] Screen-space shader created successfully\n");
}

void WebGPUBackend::createLightingShader() {
    // Lighting shader with 2 uniform bindings: main uniforms + lighting uniforms
    ShaderResource resource;
    resource.name = "lit_mesh";

    // Create vertex shader module
    WGPUShaderModuleWGSLDescriptor wgslDescVert = {};
    wgslDescVert.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescVert.code = kLightingVertexShader;

    WGPUShaderModuleDescriptor moduleDescVert = {};
    moduleDescVert.nextInChain = &wgslDescVert.chain;
    moduleDescVert.label = "lighting_vert";
    resource.vertModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescVert);

    // Create fragment shader module
    WGPUShaderModuleWGSLDescriptor wgslDescFrag = {};
    wgslDescFrag.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescFrag.code = kLightingFragmentShader;

    WGPUShaderModuleDescriptor moduleDescFrag = {};
    moduleDescFrag.nextInChain = &wgslDescFrag.chain;
    moduleDescFrag.label = "lighting_frag";
    resource.fragModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescFrag);

    if (!resource.vertModule || !resource.fragModule) {
        printf("[WebGPUBackend] ERROR: Failed to create lighting shader modules!\n");
        return;
    }

    // Create bind group layout with 2 uniform buffers
    WGPUBindGroupLayoutEntry layoutEntries[2] = {};

    // Binding 0: Main uniform buffer (includes normalMatrix - 224 bytes)
    layoutEntries[0].binding = 0;
    layoutEntries[0].visibility = WGPUShaderStage_Vertex | WGPUShaderStage_Fragment;
    layoutEntries[0].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[0].buffer.minBindingSize = 224;  // mat4x4 * 3 + vec4 + 4 floats
    layoutEntries[0].buffer.hasDynamicOffset = true;

    // Binding 1: Lighting uniform buffer (752 bytes)
    // Layout: globalAmbient(16) + numLights+pad(16) + lights[8](80*8=640) + material(80) = 752
    layoutEntries[1].binding = 1;
    layoutEntries[1].visibility = WGPUShaderStage_Fragment;
    layoutEntries[1].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[1].buffer.minBindingSize = 752;
    layoutEntries[1].buffer.hasDynamicOffset = false;

    WGPUBindGroupLayoutDescriptor layoutDesc = {};
    layoutDesc.entryCount = 2;
    layoutDesc.entries = layoutEntries;
    resource.bindGroupLayout = wgpuDeviceCreateBindGroupLayout(mDevice, &layoutDesc);

    // Create lighting uniform buffer
    WGPUBufferDescriptor lightBufDesc = {};
    lightBufDesc.size = 752;
    lightBufDesc.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
    lightBufDesc.mappedAtCreation = false;
    mLightingUniformBuffer = wgpuDeviceCreateBuffer(mDevice, &lightBufDesc);

    // Create pipeline layout
    WGPUPipelineLayoutDescriptor pipelineLayoutDesc = {};
    pipelineLayoutDesc.bindGroupLayoutCount = 1;
    pipelineLayoutDesc.bindGroupLayouts = &resource.bindGroupLayout;
    resource.pipelineLayout = wgpuDeviceCreatePipelineLayout(mDevice, &pipelineLayoutDesc);

    // Resource doesn't own the lighting buffer - it's shared
    resource.uniformBuffer = nullptr;
    resource.bindGroup = nullptr;

    // Create default render pipeline (TriangleList)
    WGPURenderPipelineDescriptor pipelineDesc = {};
    pipelineDesc.layout = resource.pipelineLayout;

    // Vertex state - must match InterleavedVertex layout
    WGPUVertexAttribute vertexAttrs[4] = {};
    vertexAttrs[0].format = WGPUVertexFormat_Float32x3;  // position
    vertexAttrs[0].offset = 0;
    vertexAttrs[0].shaderLocation = 0;
    vertexAttrs[1].format = WGPUVertexFormat_Float32x4;  // color
    vertexAttrs[1].offset = 12;
    vertexAttrs[1].shaderLocation = 1;
    vertexAttrs[2].format = WGPUVertexFormat_Float32x2;  // texcoord
    vertexAttrs[2].offset = 28;
    vertexAttrs[2].shaderLocation = 2;
    vertexAttrs[3].format = WGPUVertexFormat_Float32x3;  // normal
    vertexAttrs[3].offset = 36;
    vertexAttrs[3].shaderLocation = 3;

    WGPUVertexBufferLayout vertexBufferLayout = {};
    vertexBufferLayout.arrayStride = 48;  // sizeof(InterleavedVertex)
    vertexBufferLayout.stepMode = WGPUVertexStepMode_Vertex;
    vertexBufferLayout.attributeCount = 4;
    vertexBufferLayout.attributes = vertexAttrs;

    WGPUVertexState vertexState = {};
    vertexState.module = resource.vertModule;
    vertexState.entryPoint = "vs_main";
    vertexState.bufferCount = 1;
    vertexState.buffers = &vertexBufferLayout;
    pipelineDesc.vertex = vertexState;

    // Primitive state
    WGPUPrimitiveState primitiveState = {};
    primitiveState.topology = WGPUPrimitiveTopology_TriangleList;
    primitiveState.stripIndexFormat = WGPUIndexFormat_Undefined;
    primitiveState.frontFace = WGPUFrontFace_CCW;
    primitiveState.cullMode = WGPUCullMode_None;
    pipelineDesc.primitive = primitiveState;

    // Fragment state with blending
    WGPUBlendState blendState = {};
    blendState.color.srcFactor = WGPUBlendFactor_SrcAlpha;
    blendState.color.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
    blendState.color.operation = WGPUBlendOperation_Add;
    blendState.alpha.srcFactor = WGPUBlendFactor_One;
    blendState.alpha.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
    blendState.alpha.operation = WGPUBlendOperation_Add;

    WGPUColorTargetState colorTarget = {};
    colorTarget.format = mSwapChainFormat;
    colorTarget.blend = &blendState;
    colorTarget.writeMask = WGPUColorWriteMask_All;

    WGPUFragmentState fragmentState = {};
    fragmentState.module = resource.fragModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;
    pipelineDesc.fragment = &fragmentState;

    // Depth state
    WGPUDepthStencilState depthState = {};
    depthState.format = WGPUTextureFormat_Depth24Plus;
    depthState.depthWriteEnabled = true;
    depthState.depthCompare = WGPUCompareFunction_Less;
    pipelineDesc.depthStencil = &depthState;

    // Multisample
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = 0xFFFFFFFF;

    resource.defaultPipeline = wgpuDeviceCreateRenderPipeline(mDevice, &pipelineDesc);
    if (!resource.defaultPipeline) {
        printf("[WebGPUBackend] ERROR: Failed to create lighting shader pipeline!\n");
        wgpuPipelineLayoutRelease(resource.pipelineLayout);
        wgpuBindGroupLayoutRelease(resource.bindGroupLayout);
        wgpuShaderModuleRelease(resource.fragModule);
        wgpuShaderModuleRelease(resource.vertModule);
        return;
    }

    resource.pipelines[static_cast<int>(PrimitiveType::Triangles)] = resource.defaultPipeline;

    uint64_t id = generateHandleId();
    mShaders[id] = std::move(resource);
    mLitShader = ShaderHandle{id};

    printf("[WebGPUBackend] Lighting shader created successfully\n");
}

void WebGPUBackend::updateLightingBindGroup() {
    // Create/update bind group for lit rendering
    if (!mLitShader.valid() || !mLightingUniformBuffer) return;

    auto shaderIt = mShaders.find(mLitShader.id);
    if (shaderIt == mShaders.end()) return;

    // Release old bind group
    if (mLitBindGroup) {
        wgpuBindGroupRelease(mLitBindGroup);
        mLitBindGroup = nullptr;
    }

    // Pack lighting data into buffer
    // Buffer layout: globalAmbient(16) + numLights+pad(16) + lights[8](80*8) + material(80)
    std::vector<uint8_t> lightingData(752, 0);

    // Global ambient (16 bytes)
    memcpy(lightingData.data(), mGlobalAmbient, 16);

    // numLights + padding (16 bytes)
    memcpy(lightingData.data() + 16, &mNumLights, 4);
    // padding at 20-31 is already zero

    // Lights array at offset 32 (80 bytes per light)
    for (int i = 0; i < 8; i++) {
        size_t offset = 32 + i * 80;
        memcpy(lightingData.data() + offset, mLights[i].position, 16);      // position
        memcpy(lightingData.data() + offset + 16, mLights[i].ambient, 16);  // ambient
        memcpy(lightingData.data() + offset + 32, mLights[i].diffuse, 16);  // diffuse
        memcpy(lightingData.data() + offset + 48, mLights[i].specular, 16); // specular
        memcpy(lightingData.data() + offset + 64, mLights[i].attenuation, 12); // attenuation
        memcpy(lightingData.data() + offset + 76, &mLights[i].enabled, 4);  // enabled
    }

    // Material at offset 672 (32 + 8*80 = 672)
    size_t matOffset = 672;
    memcpy(lightingData.data() + matOffset, &mMaterial, sizeof(MaterialData));

    // Upload to GPU
    wgpuQueueWriteBuffer(mQueue, mLightingUniformBuffer, 0,
                         lightingData.data(), lightingData.size());

    // Create bind group entries
    WGPUBindGroupEntry entries[2] = {};

    // Binding 0: Main uniform buffer (using ring buffer)
    entries[0].binding = 0;
    entries[0].buffer = mUniformRingBuffer;
    entries[0].offset = 0;
    entries[0].size = 256;

    // Binding 1: Lighting uniform buffer
    entries[1].binding = 1;
    entries[1].buffer = mLightingUniformBuffer;
    entries[1].offset = 0;
    entries[1].size = 752;

    WGPUBindGroupDescriptor bindGroupDesc = {};
    bindGroupDesc.layout = shaderIt->second.bindGroupLayout;
    bindGroupDesc.entryCount = 2;
    bindGroupDesc.entries = entries;

    mLitBindGroup = wgpuDeviceCreateBindGroup(mDevice, &bindGroupDesc);
    mLightingDirty = false;
}

void WebGPUBackend::beginRenderPass() {
    if (mRenderPassEncoder) return; // Already in render pass

    if (!mCommandEncoder || !mCurrentSwapChainView) return;

    // Determine which views to use
    WGPUTextureView colorView = mCurrentSwapChainView;
    WGPUTextureView depthView = mDepthTextureView;

    // Check if using custom render target
    if (mCurrentRenderTarget.valid()) {
        auto it = mRenderTargets.find(mCurrentRenderTarget.id);
        if (it != mRenderTargets.end()) {
            if (it->second.colorView) colorView = it->second.colorView;
            if (it->second.depthView) depthView = it->second.depthView;
        }
    }

    // Color attachment
    WGPURenderPassColorAttachment colorAttachment = {};
    colorAttachment.view = colorView;
    colorAttachment.depthSlice = UINT32_MAX; // Required for 2D textures!
    colorAttachment.loadOp = mHasPendingClear && mPendingClear.clearColor ?
                             WGPULoadOp_Clear : WGPULoadOp_Load;
    colorAttachment.storeOp = WGPUStoreOp_Store;
    colorAttachment.clearValue = {
        mPendingClear.r, mPendingClear.g, mPendingClear.b, mPendingClear.a
    };

    // Depth attachment
    // Using Depth24Plus format (no stencil), so stencil ops must be Undefined
    WGPURenderPassDepthStencilAttachment depthAttachment = {};
    depthAttachment.view = depthView;
    depthAttachment.depthLoadOp = mHasPendingClear && mPendingClear.clearDepth ?
                                   WGPULoadOp_Clear : WGPULoadOp_Load;
    depthAttachment.depthStoreOp = WGPUStoreOp_Store;
    depthAttachment.depthClearValue = mPendingClear.depth;
    depthAttachment.depthReadOnly = false;
    // Depth24Plus has no stencil - use Undefined ops
    depthAttachment.stencilLoadOp = WGPULoadOp_Undefined;
    depthAttachment.stencilStoreOp = WGPUStoreOp_Undefined;
    depthAttachment.stencilClearValue = 0;
    depthAttachment.stencilReadOnly = true;

    // Render pass descriptor
    WGPURenderPassDescriptor renderPassDesc = {};
    renderPassDesc.colorAttachmentCount = 1;
    renderPassDesc.colorAttachments = &colorAttachment;
    renderPassDesc.depthStencilAttachment = depthView ? &depthAttachment : nullptr;

    mRenderPassEncoder = wgpuCommandEncoderBeginRenderPass(mCommandEncoder, &renderPassDesc);
    mHasPendingClear = false;

    // Set viewport
    wgpuRenderPassEncoderSetViewport(mRenderPassEncoder,
        (float)mViewportX, (float)mViewportY,
        (float)mViewportW, (float)mViewportH,
        0.0f, 1.0f);
}

void WebGPUBackend::endRenderPass() {
    if (mRenderPassEncoder) {
        wgpuRenderPassEncoderEnd(mRenderPassEncoder);
        wgpuRenderPassEncoderRelease(mRenderPassEncoder);
        mRenderPassEncoder = nullptr;
    }
}

void WebGPUBackend::flushUniforms() {
    if (!mUniformsDirty) return;

    // Use current shader or fall back to default
    ShaderHandle shaderToUse = mCurrentShader.valid() ? mCurrentShader : mDefaultShader;
    if (!shaderToUse.valid()) return;

    auto it = mShaders.find(shaderToUse.id);
    if (it == mShaders.end()) return;

    // For lighting shader, we need to include normalMatrix in uniform buffer
    // Layout for lighting: modelView(64) + proj(64) + normal(64) + tint(16) + params(16) = 224 bytes
    // Layout for default:  modelView(64) + proj(64) + tint(16) + params(16) = 160 bytes
    if (mLightingEnabled && mLitShader.valid()) {
        // Ensure uniform data is large enough for lighting uniforms (224 bytes)
        if (mUniformData.size() < 224) {
            mUniformData.resize(256, 0);
        }

        // IMPORTANT: Save tint and params BEFORE writing normalMatrix
        // Default layout has tint at 128, params at 144
        // Lighting layout moves them to 192 and 208 to make room for normalMatrix
        float tint[4], params[4];
        memcpy(tint, mUniformData.data() + 128, 16);   // Save tint from offset 128
        memcpy(params, mUniformData.data() + 144, 16); // Save params from offset 144

        // Now copy normalMatrix at offset 128 (overwrites old tint/params location)
        memcpy(mUniformData.data() + 128, mNormalMatrix, 64);

        // Copy saved tint/params to their new locations after normalMatrix
        memcpy(mUniformData.data() + 192, tint, 16);
        memcpy(mUniformData.data() + 208, params, 16);
    }

#ifdef __EMSCRIPTEN__
    static int flushLogCount = 0;
    if (flushLogCount < 3) {
        // Log modelView matrix translation (bytes 48-60 = floats 12-14)
        float* uniforms = reinterpret_cast<float*>(mUniformData.data());
        EM_ASM({
            console.log('[WebGPUBackend::flushUniforms] MV translation at offset ' + $3 + ': (' +
                        $0 + ', ' + $1 + ', ' + $2 + ')');
        }, uniforms[12], uniforms[13], uniforms[14], (int)mUniformRingOffset);

        // Log projection matrix diagonal (floats 16+0, 16+5, 16+10, 16+15)
        EM_ASM({
            console.log('[WebGPUBackend::flushUniforms] Proj diagonal: (' +
                        $0 + ', ' + $1 + ', ' + $2 + ', ' + $3 + ')');
        }, uniforms[16+0], uniforms[16+5], uniforms[16+10], uniforms[16+15]);

        flushLogCount++;
    }
#endif

    // Check if we have room in the ring buffer
    if (mUniformRingBuffer && mUniformRingOffset + kUniformAlignment <= kUniformAlignment * kMaxDrawsPerFrame) {
        // Write uniform data to ring buffer at current offset
        wgpuQueueWriteBuffer(mQueue, mUniformRingBuffer, mUniformRingOffset,
                              mUniformData.data(), mUniformData.size());

        // Store current offset for use in draw()
        mCurrentDynamicOffset = static_cast<uint32_t>(mUniformRingOffset);

        // Advance offset for next draw call (256-byte alignment required)
        mUniformRingOffset += kUniformAlignment;
    } else if (it->second.uniformBuffer) {
        // Fallback: use per-shader buffer (old behavior)
        wgpuQueueWriteBuffer(mQueue, it->second.uniformBuffer, 0,
                              mUniformData.data(), mUniformData.size());
        mCurrentDynamicOffset = 0;
    }

    mUniformsDirty = false;
}

WGPUBufferUsageFlags WebGPUBackend::toWGPUBufferUsage(BufferType type, BufferUsage usage) {
    (void)usage;
    WGPUBufferUsageFlags flags = WGPUBufferUsage_CopyDst;

    switch (type) {
        case BufferType::Vertex:
            flags |= WGPUBufferUsage_Vertex;
            break;
        case BufferType::Index:
            flags |= WGPUBufferUsage_Index;
            break;
        case BufferType::Uniform:
            flags |= WGPUBufferUsage_Uniform;
            break;
        case BufferType::Storage:
            flags |= WGPUBufferUsage_Storage;
            break;
    }

    return flags;
}

WGPUTextureFormat WebGPUBackend::toWGPUFormat(PixelFormat format) {
    switch (format) {
        case PixelFormat::R8:           return WGPUTextureFormat_R8Unorm;
        case PixelFormat::RG8:          return WGPUTextureFormat_RG8Unorm;
        case PixelFormat::RGBA8:        return WGPUTextureFormat_RGBA8Unorm;
        case PixelFormat::R16F:         return WGPUTextureFormat_R16Float;
        case PixelFormat::RG16F:        return WGPUTextureFormat_RG16Float;
        case PixelFormat::RGBA16F:      return WGPUTextureFormat_RGBA16Float;
        case PixelFormat::R32F:         return WGPUTextureFormat_R32Float;
        case PixelFormat::RG32F:        return WGPUTextureFormat_RG32Float;
        case PixelFormat::RGBA32F:      return WGPUTextureFormat_RGBA32Float;
        case PixelFormat::Depth16:      return WGPUTextureFormat_Depth16Unorm;
        case PixelFormat::Depth24:      return WGPUTextureFormat_Depth24Plus;
        case PixelFormat::Depth32F:     return WGPUTextureFormat_Depth32Float;
        case PixelFormat::Depth24Stencil8: return WGPUTextureFormat_Depth24PlusStencil8;
        default:
            return WGPUTextureFormat_RGBA8Unorm;
    }
}

WGPUPrimitiveTopology WebGPUBackend::toWGPUPrimitive(PrimitiveType type) {
    switch (type) {
        case PrimitiveType::Points:        return WGPUPrimitiveTopology_PointList;
        case PrimitiveType::Lines:         return WGPUPrimitiveTopology_LineList;
        case PrimitiveType::LineStrip:     return WGPUPrimitiveTopology_LineStrip;
        case PrimitiveType::Triangles:     return WGPUPrimitiveTopology_TriangleList;
        case PrimitiveType::TriangleStrip: return WGPUPrimitiveTopology_TriangleStrip;
        default: return WGPUPrimitiveTopology_TriangleList;
    }
}

WGPUAddressMode WebGPUBackend::toWGPUAddressMode(WrapMode mode) {
    switch (mode) {
        case WrapMode::Repeat:         return WGPUAddressMode_Repeat;
        case WrapMode::MirroredRepeat: return WGPUAddressMode_MirrorRepeat;
        case WrapMode::ClampToEdge:    return WGPUAddressMode_ClampToEdge;
        case WrapMode::ClampToBorder:  return WGPUAddressMode_ClampToEdge;
        default: return WGPUAddressMode_ClampToEdge;
    }
}

WGPUFilterMode WebGPUBackend::toWGPUFilterMode(FilterMode mode) {
    switch (mode) {
        case FilterMode::Nearest:  return WGPUFilterMode_Nearest;
        case FilterMode::Linear:   return WGPUFilterMode_Linear;
        case FilterMode::Trilinear: return WGPUFilterMode_Linear;
        default: return WGPUFilterMode_Linear;
    }
}

WGPUCompareFunction WebGPUBackend::toWGPUCompareFunc(DepthFunc func) {
    switch (func) {
        case DepthFunc::Never:        return WGPUCompareFunction_Never;
        case DepthFunc::Less:         return WGPUCompareFunction_Less;
        case DepthFunc::LessEqual:    return WGPUCompareFunction_LessEqual;
        case DepthFunc::Equal:        return WGPUCompareFunction_Equal;
        case DepthFunc::Greater:      return WGPUCompareFunction_Greater;
        case DepthFunc::GreaterEqual: return WGPUCompareFunction_GreaterEqual;
        case DepthFunc::NotEqual:     return WGPUCompareFunction_NotEqual;
        case DepthFunc::Always:       return WGPUCompareFunction_Always;
        default: return WGPUCompareFunction_Less;
    }
}

WGPUCullMode WebGPUBackend::toWGPUCullMode(CullFace face) {
    switch (face) {
        case CullFace::None:  return WGPUCullMode_None;
        case CullFace::Front: return WGPUCullMode_Front;
        case CullFace::Back:  return WGPUCullMode_Back;
        default: return WGPUCullMode_Back;
    }
}

WGPUBlendFactor WebGPUBackend::toWGPUBlendFactor(BlendMode mode, bool isSrc) {
    switch (mode) {
        case BlendMode::Alpha:
            return isSrc ? WGPUBlendFactor_SrcAlpha : WGPUBlendFactor_OneMinusSrcAlpha;
        case BlendMode::Additive:
            return isSrc ? WGPUBlendFactor_SrcAlpha : WGPUBlendFactor_One;
        case BlendMode::Multiply:
            return isSrc ? WGPUBlendFactor_Dst : WGPUBlendFactor_Zero;
        case BlendMode::PreMultiplied:
            return isSrc ? WGPUBlendFactor_One : WGPUBlendFactor_OneMinusSrcAlpha;
        default:
            return isSrc ? WGPUBlendFactor_One : WGPUBlendFactor_Zero;
    }
}

// ─── Skybox Methods (Phase 4) ────────────────────────────────────────────────

void WebGPUBackend::createSkyboxShader() {
    // Create vertex shader module
    WGPUShaderModuleWGSLDescriptor wgslDescVert = {};
    wgslDescVert.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescVert.code = kSkyboxVertexShader;

    WGPUShaderModuleDescriptor moduleDescVert = {};
    moduleDescVert.nextInChain = &wgslDescVert.chain;
    moduleDescVert.label = "skybox_vert";
    WGPUShaderModule vertModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescVert);

    // Create fragment shader module
    WGPUShaderModuleWGSLDescriptor wgslDescFrag = {};
    wgslDescFrag.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescFrag.code = kSkyboxFragmentShader;

    WGPUShaderModuleDescriptor moduleDescFrag = {};
    moduleDescFrag.nextInChain = &wgslDescFrag.chain;
    moduleDescFrag.label = "skybox_frag";
    WGPUShaderModule fragModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescFrag);

    if (!vertModule || !fragModule) {
        printf("[WebGPUBackend] ERROR: Failed to create skybox shader modules!\n");
        return;
    }

    // Create bind group layout with 3 entries:
    // - binding 0: uniform buffer (viewMatrix, projMatrix, exposure, gamma)
    // - binding 1: texture_2d (environment map)
    // - binding 2: sampler
    WGPUBindGroupLayoutEntry layoutEntries[3] = {};

    // Binding 0: Uniform buffer (144 bytes: 2x mat4x4f + 4 floats)
    layoutEntries[0].binding = 0;
    layoutEntries[0].visibility = WGPUShaderStage_Vertex | WGPUShaderStage_Fragment;
    layoutEntries[0].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[0].buffer.minBindingSize = 144;  // 2*64 + 4*4 = 144
    layoutEntries[0].buffer.hasDynamicOffset = false;

    // Binding 1: Environment texture
    layoutEntries[1].binding = 1;
    layoutEntries[1].visibility = WGPUShaderStage_Fragment;
    layoutEntries[1].texture.sampleType = WGPUTextureSampleType_Float;
    layoutEntries[1].texture.viewDimension = WGPUTextureViewDimension_2D;
    layoutEntries[1].texture.multisampled = false;

    // Binding 2: Sampler
    layoutEntries[2].binding = 2;
    layoutEntries[2].visibility = WGPUShaderStage_Fragment;
    layoutEntries[2].sampler.type = WGPUSamplerBindingType_Filtering;

    WGPUBindGroupLayoutDescriptor layoutDesc = {};
    layoutDesc.entryCount = 3;
    layoutDesc.entries = layoutEntries;
    mSkyboxBindGroupLayout = wgpuDeviceCreateBindGroupLayout(mDevice, &layoutDesc);

    // Create skybox uniform buffer
    WGPUBufferDescriptor uniformBufDesc = {};
    uniformBufDesc.size = 256;  // Aligned to 256 bytes
    uniformBufDesc.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
    uniformBufDesc.mappedAtCreation = false;
    mSkyboxUniformBuffer = wgpuDeviceCreateBuffer(mDevice, &uniformBufDesc);

    // Create pipeline layout
    WGPUPipelineLayoutDescriptor pipelineLayoutDesc = {};
    pipelineLayoutDesc.bindGroupLayoutCount = 1;
    pipelineLayoutDesc.bindGroupLayouts = &mSkyboxBindGroupLayout;
    WGPUPipelineLayout pipelineLayout = wgpuDeviceCreatePipelineLayout(mDevice, &pipelineLayoutDesc);

    // Create render pipeline
    WGPURenderPipelineDescriptor pipelineDesc = {};
    pipelineDesc.layout = pipelineLayout;

    // Vertex state - only position (vec3f)
    WGPUVertexAttribute vertexAttrs[1] = {};
    vertexAttrs[0].format = WGPUVertexFormat_Float32x3;  // position
    vertexAttrs[0].offset = 0;
    vertexAttrs[0].shaderLocation = 0;

    WGPUVertexBufferLayout vertexBufferLayout = {};
    vertexBufferLayout.arrayStride = 12;  // 3 floats * 4 bytes
    vertexBufferLayout.stepMode = WGPUVertexStepMode_Vertex;
    vertexBufferLayout.attributeCount = 1;
    vertexBufferLayout.attributes = vertexAttrs;

    WGPUVertexState vertexState = {};
    vertexState.module = vertModule;
    vertexState.entryPoint = "vs_main";
    vertexState.bufferCount = 1;
    vertexState.buffers = &vertexBufferLayout;
    pipelineDesc.vertex = vertexState;

    // Primitive state - render inside-out cube with no culling
    WGPUPrimitiveState primitiveState = {};
    primitiveState.topology = WGPUPrimitiveTopology_TriangleList;
    primitiveState.stripIndexFormat = WGPUIndexFormat_Undefined;
    primitiveState.frontFace = WGPUFrontFace_CCW;
    primitiveState.cullMode = WGPUCullMode_None;  // Inside-out cube
    pipelineDesc.primitive = primitiveState;

    // Fragment state
    WGPUColorTargetState colorTarget = {};
    colorTarget.format = mSwapChainFormat;
    colorTarget.writeMask = WGPUColorWriteMask_All;
    // No blending needed for skybox

    WGPUFragmentState fragmentState = {};
    fragmentState.module = fragModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;
    pipelineDesc.fragment = &fragmentState;

    // Depth state - no depth write, depth compare LESS_EQUAL
    WGPUDepthStencilState depthState = {};
    depthState.format = WGPUTextureFormat_Depth24Plus;
    depthState.depthWriteEnabled = false;  // Don't write to depth buffer
    depthState.depthCompare = WGPUCompareFunction_LessEqual;  // Skybox at max depth
    pipelineDesc.depthStencil = &depthState;

    // Multisample
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = 0xFFFFFFFF;

    mSkyboxPipeline = wgpuDeviceCreateRenderPipeline(mDevice, &pipelineDesc);

    // Release intermediate objects
    wgpuPipelineLayoutRelease(pipelineLayout);
    wgpuShaderModuleRelease(vertModule);
    wgpuShaderModuleRelease(fragModule);

    if (!mSkyboxPipeline) {
        printf("[WebGPUBackend] ERROR: Failed to create skybox pipeline!\n");
        return;
    }

    printf("[WebGPUBackend] Skybox shader created successfully\n");
}

void WebGPUBackend::createSkyboxMesh() {
    // Create inside-out unit cube (36 vertices for 12 triangles)
    float s = 1.0f;

    // Vertices of a cube
    float vertices[8][3] = {
        {-s, -s, -s}, {+s, -s, -s}, {+s, +s, -s}, {-s, +s, -s},  // back
        {-s, -s, +s}, {+s, -s, +s}, {+s, +s, +s}, {-s, +s, +s}   // front
    };

    // Faces (inside-out winding - reversed from standard)
    int faces[6][4] = {
        {0, 1, 2, 3},  // back
        {5, 4, 7, 6},  // front
        {4, 0, 3, 7},  // left
        {1, 5, 6, 2},  // right
        {3, 2, 6, 7},  // top
        {4, 5, 1, 0}   // bottom
    };

    // Build 36-vertex array (6 faces * 2 triangles * 3 vertices)
    float vertexData[36 * 3];
    int vi = 0;
    for (int f = 0; f < 6; f++) {
        // First triangle
        memcpy(&vertexData[vi], vertices[faces[f][0]], 12); vi += 3;
        memcpy(&vertexData[vi], vertices[faces[f][1]], 12); vi += 3;
        memcpy(&vertexData[vi], vertices[faces[f][2]], 12); vi += 3;
        // Second triangle
        memcpy(&vertexData[vi], vertices[faces[f][0]], 12); vi += 3;
        memcpy(&vertexData[vi], vertices[faces[f][2]], 12); vi += 3;
        memcpy(&vertexData[vi], vertices[faces[f][3]], 12); vi += 3;
    }

    // Create vertex buffer
    mSkyboxVertexBuffer = createBuffer(
        BufferType::Vertex,
        BufferUsage::Static,
        vertexData,
        sizeof(vertexData)
    );

    if (mSkyboxVertexBuffer.valid()) {
        printf("[WebGPUBackend] Skybox mesh created (36 vertices)\n");
    } else {
        printf("[WebGPUBackend] ERROR: Failed to create skybox mesh!\n");
    }
}

void WebGPUBackend::updateSkyboxBindGroup() {
    if (!mSkyboxBindGroupLayout || !mSkyboxUniformBuffer) return;
    if (!mBoundEnvironmentTexture.valid()) return;

    // Release old bind group
    if (mSkyboxBindGroup) {
        wgpuBindGroupRelease(mSkyboxBindGroup);
        mSkyboxBindGroup = nullptr;
    }

    // Find environment texture
    auto texIt = mTextures.find(mBoundEnvironmentTexture.id);
    if (texIt == mTextures.end() || !texIt->second.view || !texIt->second.sampler) {
        printf("[WebGPUBackend] WARNING: Environment texture not found!\n");
        return;
    }

    // Create bind group entries
    WGPUBindGroupEntry entries[3] = {};

    // Binding 0: Uniform buffer
    entries[0].binding = 0;
    entries[0].buffer = mSkyboxUniformBuffer;
    entries[0].offset = 0;
    entries[0].size = 144;

    // Binding 1: Environment texture
    entries[1].binding = 1;
    entries[1].textureView = texIt->second.view;

    // Binding 2: Sampler
    entries[2].binding = 2;
    entries[2].sampler = texIt->second.sampler;

    WGPUBindGroupDescriptor bindGroupDesc = {};
    bindGroupDesc.layout = mSkyboxBindGroupLayout;
    bindGroupDesc.entryCount = 3;
    bindGroupDesc.entries = entries;

    mSkyboxBindGroup = wgpuDeviceCreateBindGroup(mDevice, &bindGroupDesc);
    mSkyboxBindingDirty = false;
}

void WebGPUBackend::setEnvironmentTexture(TextureHandle handle) {
    if (mBoundEnvironmentTexture.id != handle.id) {
        mBoundEnvironmentTexture = handle;
        mSkyboxBindingDirty = true;
    }
}

void WebGPUBackend::setEnvironmentParams(float exposure, float gamma) {
    mEnvExposure = exposure;
    mEnvGamma = gamma;
}

void WebGPUBackend::drawSkybox(const float* viewMatrix, const float* projMatrix) {
    if (!mSkyboxPipeline || !mSkyboxVertexBuffer.valid()) {
        return;
    }
    if (!mBoundEnvironmentTexture.valid()) {
        return;
    }

    // Update bind group if texture changed
    if (mSkyboxBindingDirty) {
        updateSkyboxBindGroup();
    }

    if (!mSkyboxBindGroup) {
        return;
    }

    // Update uniform buffer
    // Layout: viewMatrix(64) + projMatrix(64) + exposure(4) + gamma(4) + _pad(8) = 144
    struct SkyboxUniforms {
        float viewMatrix[16];
        float projMatrix[16];
        float exposure;
        float gamma;
        float _pad[2];
    } uniforms;

    memcpy(uniforms.viewMatrix, viewMatrix, 64);
    memcpy(uniforms.projMatrix, projMatrix, 64);
    uniforms.exposure = mEnvExposure;
    uniforms.gamma = mEnvGamma;
    uniforms._pad[0] = 0.0f;
    uniforms._pad[1] = 0.0f;

    wgpuQueueWriteBuffer(mQueue, mSkyboxUniformBuffer, 0, &uniforms, sizeof(uniforms));

    // Begin render pass if needed
    beginRenderPass();
    if (!mRenderPassEncoder) return;

    // Set pipeline
    wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, mSkyboxPipeline);

    // Set bind group
    wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, mSkyboxBindGroup, 0, nullptr);

    // Set vertex buffer
    auto vbIt = mBuffers.find(mSkyboxVertexBuffer.id);
    if (vbIt == mBuffers.end()) return;

    wgpuRenderPassEncoderSetVertexBuffer(
        mRenderPassEncoder, 0,
        vbIt->second.buffer, 0,
        36 * 3 * sizeof(float)
    );

    // Draw 36 vertices
    wgpuRenderPassEncoderDraw(mRenderPassEncoder, 36, 1, 0, 0);
}

// ─── Environment Reflection Methods (Phase 6) ─────────────────────────────────

void WebGPUBackend::setEnvironmentRotation(float angleRadians) {
    mEnvRotation = angleRadians;
    mEnvReflectBindingDirty = true;
}

void WebGPUBackend::createEnvReflectShader() {
    // Create vertex shader module
    WGPUShaderModuleWGSLDescriptor wgslDescVert = {};
    wgslDescVert.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescVert.code = kEnvReflectVertexShader;

    WGPUShaderModuleDescriptor moduleDescVert = {};
    moduleDescVert.nextInChain = &wgslDescVert.chain;
    moduleDescVert.label = "env_reflect_vert";
    WGPUShaderModule vertModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescVert);

    // Create fragment shader module
    WGPUShaderModuleWGSLDescriptor wgslDescFrag = {};
    wgslDescFrag.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescFrag.code = kEnvReflectFragmentShader;

    WGPUShaderModuleDescriptor moduleDescFrag = {};
    moduleDescFrag.nextInChain = &wgslDescFrag.chain;
    moduleDescFrag.label = "env_reflect_frag";
    WGPUShaderModule fragModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescFrag);

    if (!vertModule || !fragModule) {
        printf("[WebGPUBackend] ERROR: Failed to create env reflect shader modules!\n");
        return;
    }

    // Create bind group layout with 4 entries:
    // - binding 0: transform uniforms (mat4x4 * 3 = 192 bytes)
    // - binding 1: reflect params (48 bytes)
    // - binding 2: envMap texture
    // - binding 3: sampler
    WGPUBindGroupLayoutEntry layoutEntries[4] = {};

    // binding 0: transform uniforms
    layoutEntries[0].binding = 0;
    layoutEntries[0].visibility = WGPUShaderStage_Vertex;
    layoutEntries[0].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[0].buffer.minBindingSize = 192;  // 3 * mat4x4f

    // binding 1: reflect params
    layoutEntries[1].binding = 1;
    layoutEntries[1].visibility = WGPUShaderStage_Vertex | WGPUShaderStage_Fragment;
    layoutEntries[1].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[1].buffer.minBindingSize = 48;  // cameraPos(16) + baseColor(16) + 4 floats(16)

    // binding 2: envMap texture
    layoutEntries[2].binding = 2;
    layoutEntries[2].visibility = WGPUShaderStage_Fragment;
    layoutEntries[2].texture.sampleType = WGPUTextureSampleType_Float;
    layoutEntries[2].texture.viewDimension = WGPUTextureViewDimension_2D;

    // binding 3: sampler
    layoutEntries[3].binding = 3;
    layoutEntries[3].visibility = WGPUShaderStage_Fragment;
    layoutEntries[3].sampler.type = WGPUSamplerBindingType_Filtering;

    WGPUBindGroupLayoutDescriptor layoutDesc = {};
    layoutDesc.entryCount = 4;
    layoutDesc.entries = layoutEntries;
    mEnvReflectBindGroupLayout = wgpuDeviceCreateBindGroupLayout(mDevice, &layoutDesc);

    // Create pipeline layout
    WGPUPipelineLayoutDescriptor pipelineLayoutDesc = {};
    pipelineLayoutDesc.bindGroupLayoutCount = 1;
    pipelineLayoutDesc.bindGroupLayouts = &mEnvReflectBindGroupLayout;
    WGPUPipelineLayout pipelineLayout = wgpuDeviceCreatePipelineLayout(mDevice, &pipelineLayoutDesc);

    // Vertex buffer layout: position(3) + texcoord(2) + color(4) + normal(3) = 12 floats
    WGPUVertexAttribute vertexAttrs[4] = {};

    // position
    vertexAttrs[0].format = WGPUVertexFormat_Float32x3;
    vertexAttrs[0].offset = 0;
    vertexAttrs[0].shaderLocation = 0;

    // texcoord
    vertexAttrs[1].format = WGPUVertexFormat_Float32x2;
    vertexAttrs[1].offset = 12;
    vertexAttrs[1].shaderLocation = 1;

    // color
    vertexAttrs[2].format = WGPUVertexFormat_Float32x4;
    vertexAttrs[2].offset = 20;
    vertexAttrs[2].shaderLocation = 2;

    // normal
    vertexAttrs[3].format = WGPUVertexFormat_Float32x3;
    vertexAttrs[3].offset = 36;
    vertexAttrs[3].shaderLocation = 3;

    WGPUVertexBufferLayout vertexBufferLayout = {};
    vertexBufferLayout.arrayStride = 48;  // 12 floats * 4 bytes
    vertexBufferLayout.stepMode = WGPUVertexStepMode_Vertex;
    vertexBufferLayout.attributeCount = 4;
    vertexBufferLayout.attributes = vertexAttrs;

    // Fragment state
    WGPUBlendState blendState = {};
    blendState.color.srcFactor = WGPUBlendFactor_SrcAlpha;
    blendState.color.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
    blendState.color.operation = WGPUBlendOperation_Add;
    blendState.alpha.srcFactor = WGPUBlendFactor_One;
    blendState.alpha.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
    blendState.alpha.operation = WGPUBlendOperation_Add;

    WGPUColorTargetState colorTarget = {};
    colorTarget.format = mSwapChainFormat;
    colorTarget.blend = &blendState;
    colorTarget.writeMask = WGPUColorWriteMask_All;

    WGPUFragmentState fragmentState = {};
    fragmentState.module = fragModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;

    // Depth stencil state
    WGPUDepthStencilState depthStencilState = {};
    depthStencilState.format = WGPUTextureFormat_Depth24Plus;
    depthStencilState.depthWriteEnabled = true;
    depthStencilState.depthCompare = WGPUCompareFunction_Less;

    // Create pipeline
    WGPURenderPipelineDescriptor pipelineDesc = {};
    pipelineDesc.layout = pipelineLayout;
    pipelineDesc.vertex.module = vertModule;
    pipelineDesc.vertex.entryPoint = "vs_main";
    pipelineDesc.vertex.bufferCount = 1;
    pipelineDesc.vertex.buffers = &vertexBufferLayout;
    pipelineDesc.fragment = &fragmentState;
    pipelineDesc.depthStencil = &depthStencilState;
    pipelineDesc.primitive.topology = WGPUPrimitiveTopology_TriangleList;
    pipelineDesc.primitive.cullMode = WGPUCullMode_Back;
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = 0xFFFFFFFF;

    mEnvReflectPipeline = wgpuDeviceCreateRenderPipeline(mDevice, &pipelineDesc);

    // Create uniform buffer (transforms + params)
    WGPUBufferDescriptor uniformBufferDesc = {};
    uniformBufferDesc.size = sizeof(EnvReflectUniforms);
    uniformBufferDesc.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
    mEnvReflectUniformBuffer = wgpuDeviceCreateBuffer(mDevice, &uniformBufferDesc);

    // Clean up shader modules
    wgpuShaderModuleRelease(vertModule);
    wgpuShaderModuleRelease(fragModule);
    wgpuPipelineLayoutRelease(pipelineLayout);

    printf("[WebGPUBackend] Environment reflect shader created\n");
}

void WebGPUBackend::updateEnvReflectBindGroup() {
    if (!mEnvReflectBindGroupLayout || !mEnvReflectUniformBuffer) return;
    if (!mBoundEnvironmentTexture.valid()) return;

    // Release old bind group
    if (mEnvReflectBindGroup) {
        wgpuBindGroupRelease(mEnvReflectBindGroup);
        mEnvReflectBindGroup = nullptr;
    }

    // Find environment texture
    auto texIt = mTextures.find(mBoundEnvironmentTexture.id);
    if (texIt == mTextures.end()) {
        printf("[WebGPUBackend] Environment texture not found for reflection!\n");
        return;
    }

    // Create sampler for environment map
    WGPUSamplerDescriptor samplerDesc = {};
    samplerDesc.addressModeU = WGPUAddressMode_Repeat;
    samplerDesc.addressModeV = WGPUAddressMode_ClampToEdge;
    samplerDesc.addressModeW = WGPUAddressMode_ClampToEdge;
    samplerDesc.magFilter = WGPUFilterMode_Linear;
    samplerDesc.minFilter = WGPUFilterMode_Linear;
    samplerDesc.mipmapFilter = WGPUMipmapFilterMode_Linear;
    WGPUSampler sampler = wgpuDeviceCreateSampler(mDevice, &samplerDesc);

    // Create bind group entries
    WGPUBindGroupEntry entries[4] = {};

    // binding 0: transform uniforms (192 bytes for 3 mat4x4f)
    entries[0].binding = 0;
    entries[0].buffer = mEnvReflectUniformBuffer;
    entries[0].offset = 0;
    entries[0].size = 192;

    // binding 1: reflect params (48 bytes)
    entries[1].binding = 1;
    entries[1].buffer = mEnvReflectUniformBuffer;
    entries[1].offset = 192;
    entries[1].size = 48;

    // binding 2: envMap texture
    entries[2].binding = 2;
    entries[2].textureView = texIt->second.view;

    // binding 3: sampler
    entries[3].binding = 3;
    entries[3].sampler = sampler;

    WGPUBindGroupDescriptor bindGroupDesc = {};
    bindGroupDesc.layout = mEnvReflectBindGroupLayout;
    bindGroupDesc.entryCount = 4;
    bindGroupDesc.entries = entries;

    mEnvReflectBindGroup = wgpuDeviceCreateBindGroup(mDevice, &bindGroupDesc);
    mEnvReflectBindingDirty = false;

    // Note: sampler is owned by bind group now
}

void WebGPUBackend::beginEnvReflect(const float* cameraPos, float reflectivity,
                                     const float* baseColor) {
    if (!mEnvReflectPipeline) {
        printf("[WebGPUBackend] Creating environment reflection shader...\n");
        createEnvReflectShader();
    }

    if (!mEnvReflectPipeline) {
        printf("[WebGPUBackend] Environment reflection pipeline not available!\n");
        return;
    }

    // Store reflection parameters
    mEnvReflectUniforms.cameraPos[0] = cameraPos[0];
    mEnvReflectUniforms.cameraPos[1] = cameraPos[1];
    mEnvReflectUniforms.cameraPos[2] = cameraPos[2];
    mEnvReflectUniforms.cameraPos[3] = 1.0f;

    mEnvReflectUniforms.baseColor[0] = baseColor[0];
    mEnvReflectUniforms.baseColor[1] = baseColor[1];
    mEnvReflectUniforms.baseColor[2] = baseColor[2];
    mEnvReflectUniforms.baseColor[3] = baseColor[3];

    mEnvReflectUniforms.exposure = mEnvExposure;
    mEnvReflectUniforms.gamma = mEnvGamma;
    mEnvReflectUniforms.reflectivity = reflectivity;
    mEnvReflectUniforms.envRotation = mEnvRotation;

    mEnvReflectActive = true;

    // Update bind group if needed
    if (mEnvReflectBindingDirty) {
        updateEnvReflectBindGroup();
    }
}

void WebGPUBackend::endEnvReflect() {
    mEnvReflectActive = false;
}

void WebGPUBackend::drawEnvReflect(
    const float* modelViewMatrix,
    const float* projectionMatrix,
    const float* normalMatrix,
    BufferHandle vertexBuffer,
    int vertexCount,
    PrimitiveType primitive
) {
    if (!mEnvReflectActive || !mEnvReflectPipeline || !mEnvReflectBindGroup) {
        return;
    }

    auto vbIt = mBuffers.find(vertexBuffer.id);
    if (vbIt == mBuffers.end()) return;

    // Update uniform buffer
    // First part: transform uniforms (192 bytes)
    memcpy(mEnvReflectUniforms.modelViewMatrix, modelViewMatrix, 64);
    memcpy(mEnvReflectUniforms.projectionMatrix, projectionMatrix, 64);

    // Normal matrix is 3x3 but we store as 3x vec4f for WGSL alignment
    if (normalMatrix) {
        mEnvReflectUniforms.normalMatrix[0] = normalMatrix[0];
        mEnvReflectUniforms.normalMatrix[1] = normalMatrix[1];
        mEnvReflectUniforms.normalMatrix[2] = normalMatrix[2];
        mEnvReflectUniforms.normalMatrix[3] = 0.0f;
        mEnvReflectUniforms.normalMatrix[4] = normalMatrix[3];
        mEnvReflectUniforms.normalMatrix[5] = normalMatrix[4];
        mEnvReflectUniforms.normalMatrix[6] = normalMatrix[5];
        mEnvReflectUniforms.normalMatrix[7] = 0.0f;
        mEnvReflectUniforms.normalMatrix[8] = normalMatrix[6];
        mEnvReflectUniforms.normalMatrix[9] = normalMatrix[7];
        mEnvReflectUniforms.normalMatrix[10] = normalMatrix[8];
        mEnvReflectUniforms.normalMatrix[11] = 0.0f;
    } else {
        // Identity matrix
        memset(mEnvReflectUniforms.normalMatrix, 0, sizeof(mEnvReflectUniforms.normalMatrix));
        mEnvReflectUniforms.normalMatrix[0] = 1.0f;
        mEnvReflectUniforms.normalMatrix[5] = 1.0f;
        mEnvReflectUniforms.normalMatrix[10] = 1.0f;
    }

    // Upload uniforms
    wgpuQueueWriteBuffer(mQueue, mEnvReflectUniformBuffer, 0,
                         &mEnvReflectUniforms, sizeof(mEnvReflectUniforms));

    // Begin render pass
    beginRenderPass();
    if (!mRenderPassEncoder) return;

    // Set pipeline and bind group
    wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, mEnvReflectPipeline);
    wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, mEnvReflectBindGroup, 0, nullptr);

    // Set vertex buffer
    wgpuRenderPassEncoderSetVertexBuffer(
        mRenderPassEncoder, 0,
        vbIt->second.buffer, 0,
        vbIt->second.size
    );

    // Draw
    wgpuRenderPassEncoderDraw(mRenderPassEncoder, vertexCount, 1, 0, 0);
}

void WebGPUBackend::drawEnvReflectIndexed(
    const float* modelViewMatrix,
    const float* projectionMatrix,
    const float* normalMatrix,
    BufferHandle vertexBuffer,
    BufferHandle indexBuffer,
    int indexCount,
    bool use32BitIndices,
    PrimitiveType primitive
) {
    if (!mEnvReflectActive || !mEnvReflectPipeline || !mEnvReflectBindGroup) {
        return;
    }

    auto vbIt = mBuffers.find(vertexBuffer.id);
    auto ibIt = mBuffers.find(indexBuffer.id);
    if (vbIt == mBuffers.end() || ibIt == mBuffers.end()) return;

    // Update uniform buffer (same as non-indexed version)
    memcpy(mEnvReflectUniforms.modelViewMatrix, modelViewMatrix, 64);
    memcpy(mEnvReflectUniforms.projectionMatrix, projectionMatrix, 64);

    if (normalMatrix) {
        mEnvReflectUniforms.normalMatrix[0] = normalMatrix[0];
        mEnvReflectUniforms.normalMatrix[1] = normalMatrix[1];
        mEnvReflectUniforms.normalMatrix[2] = normalMatrix[2];
        mEnvReflectUniforms.normalMatrix[3] = 0.0f;
        mEnvReflectUniforms.normalMatrix[4] = normalMatrix[3];
        mEnvReflectUniforms.normalMatrix[5] = normalMatrix[4];
        mEnvReflectUniforms.normalMatrix[6] = normalMatrix[5];
        mEnvReflectUniforms.normalMatrix[7] = 0.0f;
        mEnvReflectUniforms.normalMatrix[8] = normalMatrix[6];
        mEnvReflectUniforms.normalMatrix[9] = normalMatrix[7];
        mEnvReflectUniforms.normalMatrix[10] = normalMatrix[8];
        mEnvReflectUniforms.normalMatrix[11] = 0.0f;
    } else {
        memset(mEnvReflectUniforms.normalMatrix, 0, sizeof(mEnvReflectUniforms.normalMatrix));
        mEnvReflectUniforms.normalMatrix[0] = 1.0f;
        mEnvReflectUniforms.normalMatrix[5] = 1.0f;
        mEnvReflectUniforms.normalMatrix[10] = 1.0f;
    }

    wgpuQueueWriteBuffer(mQueue, mEnvReflectUniformBuffer, 0,
                         &mEnvReflectUniforms, sizeof(mEnvReflectUniforms));

    // Begin render pass
    beginRenderPass();
    if (!mRenderPassEncoder) return;

    // Set pipeline and bind group
    wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, mEnvReflectPipeline);
    wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, mEnvReflectBindGroup, 0, nullptr);

    // Set vertex and index buffers
    wgpuRenderPassEncoderSetVertexBuffer(
        mRenderPassEncoder, 0,
        vbIt->second.buffer, 0,
        vbIt->second.size
    );

    WGPUIndexFormat indexFormat = use32BitIndices ?
        WGPUIndexFormat_Uint32 : WGPUIndexFormat_Uint16;
    wgpuRenderPassEncoderSetIndexBuffer(
        mRenderPassEncoder,
        ibIt->second.buffer, indexFormat, 0,
        ibIt->second.size
    );

    // Draw indexed
    wgpuRenderPassEncoderDrawIndexed(mRenderPassEncoder, indexCount, 1, 0, 0, 0);
}

// ─── PBR Methods (Phase 5) ────────────────────────────────────────────────────

void WebGPUBackend::createPBRShader() {
    // Create vertex shader module
    WGPUShaderModuleWGSLDescriptor wgslDescVert = {};
    wgslDescVert.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescVert.code = kPBRVertexShader;

    WGPUShaderModuleDescriptor moduleDescVert = {};
    moduleDescVert.nextInChain = &wgslDescVert.chain;
    moduleDescVert.label = "pbr_vert";
    WGPUShaderModule vertModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescVert);

    // Create fragment shader module (IBL version)
    WGPUShaderModuleWGSLDescriptor wgslDescFrag = {};
    wgslDescFrag.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescFrag.code = kPBRFragmentShader;

    WGPUShaderModuleDescriptor moduleDescFrag = {};
    moduleDescFrag.nextInChain = &wgslDescFrag.chain;
    moduleDescFrag.label = "pbr_frag";
    WGPUShaderModule fragModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescFrag);

    if (!vertModule || !fragModule) {
        printf("[WebGPUBackend] ERROR: Failed to create PBR shader modules!\n");
        return;
    }

    // Create bind group layout with 7 entries:
    // - binding 0: transform uniforms (mat4x4 * 3 = 192 bytes)
    // - binding 1: material uniforms (48 bytes)
    // - binding 2: params uniforms (80 bytes)
    // - binding 3: envMap texture
    // - binding 4: irradianceMap texture
    // - binding 5: brdfLUT texture
    // - binding 6: sampler
    WGPUBindGroupLayoutEntry layoutEntries[7] = {};

    // Binding 0: Transform uniforms
    layoutEntries[0].binding = 0;
    layoutEntries[0].visibility = WGPUShaderStage_Vertex | WGPUShaderStage_Fragment;
    layoutEntries[0].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[0].buffer.minBindingSize = 192;  // 3 * 64 bytes (mat4x4)
    layoutEntries[0].buffer.hasDynamicOffset = false;

    // Binding 1: Material uniforms
    layoutEntries[1].binding = 1;
    layoutEntries[1].visibility = WGPUShaderStage_Fragment;
    layoutEntries[1].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[1].buffer.minBindingSize = 48;
    layoutEntries[1].buffer.hasDynamicOffset = false;

    // Binding 2: Params uniforms
    layoutEntries[2].binding = 2;
    layoutEntries[2].visibility = WGPUShaderStage_Fragment;
    layoutEntries[2].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[2].buffer.minBindingSize = 80;
    layoutEntries[2].buffer.hasDynamicOffset = false;

    // Binding 3: Environment texture
    layoutEntries[3].binding = 3;
    layoutEntries[3].visibility = WGPUShaderStage_Fragment;
    layoutEntries[3].texture.sampleType = WGPUTextureSampleType_Float;
    layoutEntries[3].texture.viewDimension = WGPUTextureViewDimension_2D;
    layoutEntries[3].texture.multisampled = false;

    // Binding 4: Irradiance texture
    layoutEntries[4].binding = 4;
    layoutEntries[4].visibility = WGPUShaderStage_Fragment;
    layoutEntries[4].texture.sampleType = WGPUTextureSampleType_Float;
    layoutEntries[4].texture.viewDimension = WGPUTextureViewDimension_2D;
    layoutEntries[4].texture.multisampled = false;

    // Binding 5: BRDF LUT texture
    layoutEntries[5].binding = 5;
    layoutEntries[5].visibility = WGPUShaderStage_Fragment;
    layoutEntries[5].texture.sampleType = WGPUTextureSampleType_Float;
    layoutEntries[5].texture.viewDimension = WGPUTextureViewDimension_2D;
    layoutEntries[5].texture.multisampled = false;

    // Binding 6: Sampler
    layoutEntries[6].binding = 6;
    layoutEntries[6].visibility = WGPUShaderStage_Fragment;
    layoutEntries[6].sampler.type = WGPUSamplerBindingType_Filtering;

    WGPUBindGroupLayoutDescriptor layoutDesc = {};
    layoutDesc.entryCount = 7;
    layoutDesc.entries = layoutEntries;
    mPBRBindGroupLayout = wgpuDeviceCreateBindGroupLayout(mDevice, &layoutDesc);

    // Create PBR uniform buffer (aligned to 256 bytes for all uniform data)
    WGPUBufferDescriptor uniformBufDesc = {};
    uniformBufDesc.size = 512;  // Enough for transform(192) + material(48) + params(80) aligned
    uniformBufDesc.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
    uniformBufDesc.mappedAtCreation = false;
    mPBRUniformBuffer = wgpuDeviceCreateBuffer(mDevice, &uniformBufDesc);

    // Create pipeline layout
    WGPUPipelineLayoutDescriptor pipelineLayoutDesc = {};
    pipelineLayoutDesc.bindGroupLayoutCount = 1;
    pipelineLayoutDesc.bindGroupLayouts = &mPBRBindGroupLayout;
    WGPUPipelineLayout pipelineLayout = wgpuDeviceCreatePipelineLayout(mDevice, &pipelineLayoutDesc);

    // Create render pipeline
    WGPURenderPipelineDescriptor pipelineDesc = {};
    pipelineDesc.layout = pipelineLayout;

    // Vertex state - position, texcoord, normal
    WGPUVertexAttribute vertexAttrs[3] = {};
    vertexAttrs[0].format = WGPUVertexFormat_Float32x3;  // position (location 0)
    vertexAttrs[0].offset = 0;
    vertexAttrs[0].shaderLocation = 0;
    vertexAttrs[1].format = WGPUVertexFormat_Float32x2;  // texcoord (location 2)
    vertexAttrs[1].offset = 12;  // After position
    vertexAttrs[1].shaderLocation = 2;
    vertexAttrs[2].format = WGPUVertexFormat_Float32x3;  // normal (location 3)
    vertexAttrs[2].offset = 20;  // After texcoord
    vertexAttrs[2].shaderLocation = 3;

    WGPUVertexBufferLayout vertexBufferLayout = {};
    vertexBufferLayout.arrayStride = 32;  // 3+2+3 floats = 32 bytes
    vertexBufferLayout.stepMode = WGPUVertexStepMode_Vertex;
    vertexBufferLayout.attributeCount = 3;
    vertexBufferLayout.attributes = vertexAttrs;

    WGPUVertexState vertexState = {};
    vertexState.module = vertModule;
    vertexState.entryPoint = "vs_main";
    vertexState.bufferCount = 1;
    vertexState.buffers = &vertexBufferLayout;
    pipelineDesc.vertex = vertexState;

    // Primitive state
    WGPUPrimitiveState primitiveState = {};
    primitiveState.topology = WGPUPrimitiveTopology_TriangleList;
    primitiveState.stripIndexFormat = WGPUIndexFormat_Undefined;
    primitiveState.frontFace = WGPUFrontFace_CCW;
    primitiveState.cullMode = WGPUCullMode_Back;
    pipelineDesc.primitive = primitiveState;

    // Fragment state
    WGPUColorTargetState colorTarget = {};
    colorTarget.format = mSwapChainFormat;
    colorTarget.writeMask = WGPUColorWriteMask_All;

    WGPUFragmentState fragmentState = {};
    fragmentState.module = fragModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;
    pipelineDesc.fragment = &fragmentState;

    // Depth state
    WGPUDepthStencilState depthState = {};
    depthState.format = WGPUTextureFormat_Depth24Plus;
    depthState.depthWriteEnabled = true;
    depthState.depthCompare = WGPUCompareFunction_Less;
    pipelineDesc.depthStencil = &depthState;

    // Multisample
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = 0xFFFFFFFF;

    mPBRPipeline = wgpuDeviceCreateRenderPipeline(mDevice, &pipelineDesc);

    // Release intermediate objects
    wgpuPipelineLayoutRelease(pipelineLayout);
    wgpuShaderModuleRelease(vertModule);
    wgpuShaderModuleRelease(fragModule);

    if (!mPBRPipeline) {
        printf("[WebGPUBackend] ERROR: Failed to create PBR pipeline!\n");
        return;
    }

    printf("[WebGPUBackend] PBR shader created successfully\n");
}

void WebGPUBackend::createPBRFallbackShader() {
    // Create vertex shader module (same as IBL version)
    WGPUShaderModuleWGSLDescriptor wgslDescVert = {};
    wgslDescVert.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescVert.code = kPBRVertexShader;

    WGPUShaderModuleDescriptor moduleDescVert = {};
    moduleDescVert.nextInChain = &wgslDescVert.chain;
    moduleDescVert.label = "pbr_fallback_vert";
    WGPUShaderModule vertModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescVert);

    // Create fragment shader module (fallback version - no IBL textures)
    WGPUShaderModuleWGSLDescriptor wgslDescFrag = {};
    wgslDescFrag.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
    wgslDescFrag.code = kPBRFallbackFragmentShader;

    WGPUShaderModuleDescriptor moduleDescFrag = {};
    moduleDescFrag.nextInChain = &wgslDescFrag.chain;
    moduleDescFrag.label = "pbr_fallback_frag";
    WGPUShaderModule fragModule = wgpuDeviceCreateShaderModule(mDevice, &moduleDescFrag);

    if (!vertModule || !fragModule) {
        printf("[WebGPUBackend] ERROR: Failed to create PBR fallback shader modules!\n");
        return;
    }

    // Fallback uses the same bind group layout but only first 3 bindings (no textures)
    // Create a simpler layout for fallback with just uniforms
    WGPUBindGroupLayoutEntry fallbackLayoutEntries[3] = {};

    // Binding 0: Transform uniforms
    fallbackLayoutEntries[0].binding = 0;
    fallbackLayoutEntries[0].visibility = WGPUShaderStage_Vertex | WGPUShaderStage_Fragment;
    fallbackLayoutEntries[0].buffer.type = WGPUBufferBindingType_Uniform;
    fallbackLayoutEntries[0].buffer.minBindingSize = 192;
    fallbackLayoutEntries[0].buffer.hasDynamicOffset = false;

    // Binding 1: Material uniforms
    fallbackLayoutEntries[1].binding = 1;
    fallbackLayoutEntries[1].visibility = WGPUShaderStage_Fragment;
    fallbackLayoutEntries[1].buffer.type = WGPUBufferBindingType_Uniform;
    fallbackLayoutEntries[1].buffer.minBindingSize = 48;
    fallbackLayoutEntries[1].buffer.hasDynamicOffset = false;

    // Binding 2: Params uniforms
    fallbackLayoutEntries[2].binding = 2;
    fallbackLayoutEntries[2].visibility = WGPUShaderStage_Fragment;
    fallbackLayoutEntries[2].buffer.type = WGPUBufferBindingType_Uniform;
    fallbackLayoutEntries[2].buffer.minBindingSize = 80;
    fallbackLayoutEntries[2].buffer.hasDynamicOffset = false;

    WGPUBindGroupLayoutDescriptor fallbackLayoutDesc = {};
    fallbackLayoutDesc.entryCount = 3;
    fallbackLayoutDesc.entries = fallbackLayoutEntries;
    WGPUBindGroupLayout fallbackBindGroupLayout = wgpuDeviceCreateBindGroupLayout(mDevice, &fallbackLayoutDesc);

    // Create pipeline layout
    WGPUPipelineLayoutDescriptor pipelineLayoutDesc = {};
    pipelineLayoutDesc.bindGroupLayoutCount = 1;
    pipelineLayoutDesc.bindGroupLayouts = &fallbackBindGroupLayout;
    WGPUPipelineLayout pipelineLayout = wgpuDeviceCreatePipelineLayout(mDevice, &pipelineLayoutDesc);

    // Create render pipeline (same as IBL version but with fallback layout)
    WGPURenderPipelineDescriptor pipelineDesc = {};
    pipelineDesc.layout = pipelineLayout;

    // Vertex state - position, texcoord, normal
    WGPUVertexAttribute vertexAttrs[3] = {};
    vertexAttrs[0].format = WGPUVertexFormat_Float32x3;  // position
    vertexAttrs[0].offset = 0;
    vertexAttrs[0].shaderLocation = 0;
    vertexAttrs[1].format = WGPUVertexFormat_Float32x2;  // texcoord
    vertexAttrs[1].offset = 12;
    vertexAttrs[1].shaderLocation = 2;
    vertexAttrs[2].format = WGPUVertexFormat_Float32x3;  // normal
    vertexAttrs[2].offset = 20;
    vertexAttrs[2].shaderLocation = 3;

    WGPUVertexBufferLayout vertexBufferLayout = {};
    vertexBufferLayout.arrayStride = 32;
    vertexBufferLayout.stepMode = WGPUVertexStepMode_Vertex;
    vertexBufferLayout.attributeCount = 3;
    vertexBufferLayout.attributes = vertexAttrs;

    WGPUVertexState vertexState = {};
    vertexState.module = vertModule;
    vertexState.entryPoint = "vs_main";
    vertexState.bufferCount = 1;
    vertexState.buffers = &vertexBufferLayout;
    pipelineDesc.vertex = vertexState;

    // Primitive state
    WGPUPrimitiveState primitiveState = {};
    primitiveState.topology = WGPUPrimitiveTopology_TriangleList;
    primitiveState.stripIndexFormat = WGPUIndexFormat_Undefined;
    primitiveState.frontFace = WGPUFrontFace_CCW;
    primitiveState.cullMode = WGPUCullMode_Back;
    pipelineDesc.primitive = primitiveState;

    // Fragment state
    WGPUColorTargetState colorTarget = {};
    colorTarget.format = mSwapChainFormat;
    colorTarget.writeMask = WGPUColorWriteMask_All;

    WGPUFragmentState fragmentState = {};
    fragmentState.module = fragModule;
    fragmentState.entryPoint = "fs_main";
    fragmentState.targetCount = 1;
    fragmentState.targets = &colorTarget;
    pipelineDesc.fragment = &fragmentState;

    // Depth state
    WGPUDepthStencilState depthState = {};
    depthState.format = WGPUTextureFormat_Depth24Plus;
    depthState.depthWriteEnabled = true;
    depthState.depthCompare = WGPUCompareFunction_Less;
    pipelineDesc.depthStencil = &depthState;

    // Multisample
    pipelineDesc.multisample.count = 1;
    pipelineDesc.multisample.mask = 0xFFFFFFFF;

    mPBRFallbackPipeline = wgpuDeviceCreateRenderPipeline(mDevice, &pipelineDesc);

    // Release intermediate objects
    wgpuPipelineLayoutRelease(pipelineLayout);
    wgpuBindGroupLayoutRelease(fallbackBindGroupLayout);
    wgpuShaderModuleRelease(vertModule);
    wgpuShaderModuleRelease(fragModule);

    if (!mPBRFallbackPipeline) {
        printf("[WebGPUBackend] ERROR: Failed to create PBR fallback pipeline!\n");
        return;
    }

    printf("[WebGPUBackend] PBR fallback shader created successfully\n");
}

void WebGPUBackend::updatePBRBindGroup() {
    if (!mPBRBindGroupLayout || !mPBRUniformBuffer) return;

    // Release old bind group
    if (mPBRBindGroup) {
        wgpuBindGroupRelease(mPBRBindGroup);
        mPBRBindGroup = nullptr;
    }

    // Check if we have IBL textures
    bool hasIBL = mPBREnvMap.valid() && mPBRIrradianceMap.valid() && mPBRBrdfLUT.valid();

    if (!hasIBL) {
        // For fallback, we don't need a bind group with textures
        mPBRBindingDirty = false;
        return;
    }

    // Find textures
    auto envIt = mTextures.find(mPBREnvMap.id);
    auto irrIt = mTextures.find(mPBRIrradianceMap.id);
    auto brdfIt = mTextures.find(mPBRBrdfLUT.id);

    if (envIt == mTextures.end() || !envIt->second.view || !envIt->second.sampler ||
        irrIt == mTextures.end() || !irrIt->second.view ||
        brdfIt == mTextures.end() || !brdfIt->second.view) {
        printf("[WebGPUBackend] WARNING: PBR IBL textures not found!\n");
        return;
    }

    // Create bind group entries
    WGPUBindGroupEntry entries[7] = {};

    // Binding 0: Transform uniforms
    entries[0].binding = 0;
    entries[0].buffer = mPBRUniformBuffer;
    entries[0].offset = 0;
    entries[0].size = 192;

    // Binding 1: Material uniforms
    entries[1].binding = 1;
    entries[1].buffer = mPBRUniformBuffer;
    entries[1].offset = 192;
    entries[1].size = 48;

    // Binding 2: Params uniforms
    entries[2].binding = 2;
    entries[2].buffer = mPBRUniformBuffer;
    entries[2].offset = 256;  // Aligned
    entries[2].size = 80;

    // Binding 3: Environment texture
    entries[3].binding = 3;
    entries[3].textureView = envIt->second.view;

    // Binding 4: Irradiance texture
    entries[4].binding = 4;
    entries[4].textureView = irrIt->second.view;

    // Binding 5: BRDF LUT texture
    entries[5].binding = 5;
    entries[5].textureView = brdfIt->second.view;

    // Binding 6: Sampler
    entries[6].binding = 6;
    entries[6].sampler = envIt->second.sampler;

    WGPUBindGroupDescriptor bindGroupDesc = {};
    bindGroupDesc.layout = mPBRBindGroupLayout;
    bindGroupDesc.entryCount = 7;
    bindGroupDesc.entries = entries;

    mPBRBindGroup = wgpuDeviceCreateBindGroup(mDevice, &bindGroupDesc);
    mPBRBindingDirty = false;
}

void WebGPUBackend::setPBREnabled(bool enabled) {
    mPBREnabled = enabled;
}

bool WebGPUBackend::isPBREnabled() const {
    return mPBREnabled;
}

void WebGPUBackend::setPBRMaterial(const float* albedo, float metallic, float roughness,
                                    float ao, const float* emission) {
    mPBRMaterial.albedo[0] = albedo[0];
    mPBRMaterial.albedo[1] = albedo[1];
    mPBRMaterial.albedo[2] = albedo[2];
    mPBRMaterial.albedo[3] = 1.0f;
    mPBRMaterial.metallic = metallic;
    mPBRMaterial.roughness = roughness;
    mPBRMaterial.ao = ao;
    mPBRMaterial._pad1 = 0.0f;
    mPBRMaterial.emission[0] = emission[0];
    mPBRMaterial.emission[1] = emission[1];
    mPBRMaterial.emission[2] = emission[2];
    mPBRMaterial.emission[3] = 0.0f;
}

void WebGPUBackend::setPBREnvironment(TextureHandle envMap, TextureHandle irradianceMap,
                                       TextureHandle brdfLUT) {
    bool changed = mPBREnvMap.id != envMap.id ||
                   mPBRIrradianceMap.id != irradianceMap.id ||
                   mPBRBrdfLUT.id != brdfLUT.id;

    mPBREnvMap = envMap;
    mPBRIrradianceMap = irradianceMap;
    mPBRBrdfLUT = brdfLUT;

    if (changed) {
        mPBRBindingDirty = true;
    }
}

void WebGPUBackend::setPBRParams(float envIntensity, float exposure, float gamma) {
    mPBRParams.envIntensity = envIntensity;
    mPBRParams.exposure = exposure;
    mPBRParams.gamma = gamma;
}

void WebGPUBackend::setPBRInvViewRotation(const float* mat3x3) {
    // Store mat3 as 3 vec4 columns for WGSL alignment
    mPBRParams.invViewRot[0] = mat3x3[0];
    mPBRParams.invViewRot[1] = mat3x3[1];
    mPBRParams.invViewRot[2] = mat3x3[2];
    mPBRParams.invViewRot[3] = 0.0f;
    mPBRParams.invViewRot[4] = mat3x3[3];
    mPBRParams.invViewRot[5] = mat3x3[4];
    mPBRParams.invViewRot[6] = mat3x3[5];
    mPBRParams.invViewRot[7] = 0.0f;
    mPBRParams.invViewRot[8] = mat3x3[6];
    mPBRParams.invViewRot[9] = mat3x3[7];
    mPBRParams.invViewRot[10] = mat3x3[8];
    mPBRParams.invViewRot[11] = 0.0f;
}

void WebGPUBackend::beginPBR(const float* cameraPos) {
    mPBRParams.cameraPos[0] = cameraPos[0];
    mPBRParams.cameraPos[1] = cameraPos[1];
    mPBRParams.cameraPos[2] = cameraPos[2];
    mPBRParams.cameraPos[3] = 0.0f;

    // Update bind group if needed
    if (mPBRBindingDirty) {
        updatePBRBindGroup();
    }

    mPBREnabled = true;
}

void WebGPUBackend::endPBR() {
    mPBREnabled = false;
}

void WebGPUBackend::drawPBR(
    const float* modelViewMatrix,
    const float* projectionMatrix,
    const float* normalMatrix,
    BufferHandle vertexBuffer,
    int vertexCount,
    PrimitiveType primitive
) {
    if (!mPBRFallbackPipeline && !mPBRPipeline) {
        printf("[WebGPUBackend::drawPBR] WARNING: No PBR pipeline available!\n");
        return;
    }

    beginRenderPass();
    if (!mRenderPassEncoder) return;

    // Check if we have IBL textures
    bool hasIBL = mPBREnvMap.valid() && mPBRIrradianceMap.valid() && mPBRBrdfLUT.valid() && mPBRPipeline;

    // Upload transform uniforms
    struct TransformUniforms {
        float modelViewMatrix[16];
        float projectionMatrix[16];
        float normalMatrix[16];
    } transform;
    memcpy(transform.modelViewMatrix, modelViewMatrix, 64);
    memcpy(transform.projectionMatrix, projectionMatrix, 64);
    memcpy(transform.normalMatrix, normalMatrix, 64);

    wgpuQueueWriteBuffer(mQueue, mPBRUniformBuffer, 0, &transform, sizeof(transform));

    // Upload material uniforms at offset 192
    wgpuQueueWriteBuffer(mQueue, mPBRUniformBuffer, 192, &mPBRMaterial, sizeof(mPBRMaterial));

    // Upload params uniforms at offset 256 (aligned)
    wgpuQueueWriteBuffer(mQueue, mPBRUniformBuffer, 256, &mPBRParams, sizeof(mPBRParams));

    // Use appropriate pipeline
    WGPURenderPipeline pipeline = hasIBL ? mPBRPipeline : mPBRFallbackPipeline;
    wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, pipeline);

    // Create and bind bind group for this draw
    // For fallback (no IBL), we need a bind group with just uniforms
    WGPUBindGroupLayoutEntry layoutEntries[3] = {};

    layoutEntries[0].binding = 0;
    layoutEntries[0].visibility = WGPUShaderStage_Vertex | WGPUShaderStage_Fragment;
    layoutEntries[0].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[0].buffer.minBindingSize = 192;
    layoutEntries[0].buffer.hasDynamicOffset = false;

    layoutEntries[1].binding = 1;
    layoutEntries[1].visibility = WGPUShaderStage_Fragment;
    layoutEntries[1].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[1].buffer.minBindingSize = 48;
    layoutEntries[1].buffer.hasDynamicOffset = false;

    layoutEntries[2].binding = 2;
    layoutEntries[2].visibility = WGPUShaderStage_Fragment;
    layoutEntries[2].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[2].buffer.minBindingSize = 80;
    layoutEntries[2].buffer.hasDynamicOffset = false;

    WGPUBindGroupLayoutDescriptor layoutDesc = {};
    layoutDesc.entryCount = 3;
    layoutDesc.entries = layoutEntries;
    WGPUBindGroupLayout fallbackLayout = wgpuDeviceCreateBindGroupLayout(mDevice, &layoutDesc);

    // Create bind group entries
    WGPUBindGroupEntry entries[3] = {};

    entries[0].binding = 0;
    entries[0].buffer = mPBRUniformBuffer;
    entries[0].offset = 0;
    entries[0].size = 192;

    entries[1].binding = 1;
    entries[1].buffer = mPBRUniformBuffer;
    entries[1].offset = 192;
    entries[1].size = 48;

    entries[2].binding = 2;
    entries[2].buffer = mPBRUniformBuffer;
    entries[2].offset = 256;
    entries[2].size = 80;

    WGPUBindGroupDescriptor bindGroupDesc = {};
    bindGroupDesc.layout = fallbackLayout;
    bindGroupDesc.entryCount = 3;
    bindGroupDesc.entries = entries;

    WGPUBindGroup bindGroup = wgpuDeviceCreateBindGroup(mDevice, &bindGroupDesc);

    wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, bindGroup, 0, nullptr);

    // Bind vertex buffer
    auto vbIt = mBuffers.find(vertexBuffer.id);
    if (vbIt == mBuffers.end() || !vbIt->second.buffer) {
        printf("[WebGPUBackend::drawPBR] WARNING: Invalid vertex buffer!\n");
        wgpuBindGroupRelease(bindGroup);
        wgpuBindGroupLayoutRelease(fallbackLayout);
        return;
    }

    wgpuRenderPassEncoderSetVertexBuffer(mRenderPassEncoder, 0, vbIt->second.buffer, 0, vbIt->second.size);

    // Draw
    wgpuRenderPassEncoderDraw(mRenderPassEncoder, vertexCount, 1, 0, 0);

    // Cleanup (WebGPU keeps references so this is safe)
    wgpuBindGroupRelease(bindGroup);
    wgpuBindGroupLayoutRelease(fallbackLayout);
}

void WebGPUBackend::drawPBRIndexed(
    const float* modelViewMatrix,
    const float* projectionMatrix,
    const float* normalMatrix,
    BufferHandle vertexBuffer,
    BufferHandle indexBuffer,
    int indexCount,
    bool use32BitIndices,
    PrimitiveType primitive
) {
    if (!mPBRFallbackPipeline && !mPBRPipeline) {
        printf("[WebGPUBackend::drawPBRIndexed] WARNING: No PBR pipeline available!\n");
        return;
    }

    beginRenderPass();
    if (!mRenderPassEncoder) return;

    // Check if we have IBL textures
    bool hasIBL = mPBREnvMap.valid() && mPBRIrradianceMap.valid() && mPBRBrdfLUT.valid() && mPBRPipeline;

    // Upload transform uniforms
    struct TransformUniforms {
        float modelViewMatrix[16];
        float projectionMatrix[16];
        float normalMatrix[16];
    } transform;
    memcpy(transform.modelViewMatrix, modelViewMatrix, 64);
    memcpy(transform.projectionMatrix, projectionMatrix, 64);
    memcpy(transform.normalMatrix, normalMatrix, 64);

    wgpuQueueWriteBuffer(mQueue, mPBRUniformBuffer, 0, &transform, sizeof(transform));

    // Upload material and params
    wgpuQueueWriteBuffer(mQueue, mPBRUniformBuffer, 192, &mPBRMaterial, sizeof(mPBRMaterial));
    wgpuQueueWriteBuffer(mQueue, mPBRUniformBuffer, 256, &mPBRParams, sizeof(mPBRParams));

    // Use appropriate pipeline
    WGPURenderPipeline pipeline = hasIBL ? mPBRPipeline : mPBRFallbackPipeline;
    wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, pipeline);

    // Create bind group (same as drawPBR)
    WGPUBindGroupLayoutEntry layoutEntries[3] = {};
    layoutEntries[0].binding = 0;
    layoutEntries[0].visibility = WGPUShaderStage_Vertex | WGPUShaderStage_Fragment;
    layoutEntries[0].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[0].buffer.minBindingSize = 192;
    layoutEntries[0].buffer.hasDynamicOffset = false;

    layoutEntries[1].binding = 1;
    layoutEntries[1].visibility = WGPUShaderStage_Fragment;
    layoutEntries[1].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[1].buffer.minBindingSize = 48;
    layoutEntries[1].buffer.hasDynamicOffset = false;

    layoutEntries[2].binding = 2;
    layoutEntries[2].visibility = WGPUShaderStage_Fragment;
    layoutEntries[2].buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntries[2].buffer.minBindingSize = 80;
    layoutEntries[2].buffer.hasDynamicOffset = false;

    WGPUBindGroupLayoutDescriptor layoutDesc = {};
    layoutDesc.entryCount = 3;
    layoutDesc.entries = layoutEntries;
    WGPUBindGroupLayout fallbackLayout = wgpuDeviceCreateBindGroupLayout(mDevice, &layoutDesc);

    WGPUBindGroupEntry entries[3] = {};
    entries[0].binding = 0;
    entries[0].buffer = mPBRUniformBuffer;
    entries[0].offset = 0;
    entries[0].size = 192;

    entries[1].binding = 1;
    entries[1].buffer = mPBRUniformBuffer;
    entries[1].offset = 192;
    entries[1].size = 48;

    entries[2].binding = 2;
    entries[2].buffer = mPBRUniformBuffer;
    entries[2].offset = 256;
    entries[2].size = 80;

    WGPUBindGroupDescriptor bindGroupDesc = {};
    bindGroupDesc.layout = fallbackLayout;
    bindGroupDesc.entryCount = 3;
    bindGroupDesc.entries = entries;

    WGPUBindGroup bindGroup = wgpuDeviceCreateBindGroup(mDevice, &bindGroupDesc);

    wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, bindGroup, 0, nullptr);

    // Bind vertex buffer
    auto vbIt = mBuffers.find(vertexBuffer.id);
    if (vbIt == mBuffers.end() || !vbIt->second.buffer) {
        wgpuBindGroupRelease(bindGroup);
        wgpuBindGroupLayoutRelease(fallbackLayout);
        return;
    }
    wgpuRenderPassEncoderSetVertexBuffer(mRenderPassEncoder, 0, vbIt->second.buffer, 0, vbIt->second.size);

    // Bind index buffer
    auto ibIt = mBuffers.find(indexBuffer.id);
    if (ibIt == mBuffers.end() || !ibIt->second.buffer) {
        wgpuBindGroupRelease(bindGroup);
        wgpuBindGroupLayoutRelease(fallbackLayout);
        return;
    }

    WGPUIndexFormat indexFormat = use32BitIndices ? WGPUIndexFormat_Uint32 : WGPUIndexFormat_Uint16;
    wgpuRenderPassEncoderSetIndexBuffer(mRenderPassEncoder, ibIt->second.buffer, indexFormat, 0, ibIt->second.size);

    // Draw indexed
    wgpuRenderPassEncoderDrawIndexed(mRenderPassEncoder, indexCount, 1, 0, 0, 0);

    // Cleanup
    wgpuBindGroupRelease(bindGroup);
    wgpuBindGroupLayoutRelease(fallbackLayout);
}

} // namespace al

#else // !__EMSCRIPTEN__

// Stub implementation for non-Emscripten builds
namespace al {

WebGPUBackend::WebGPUBackend() = default;
WebGPUBackend::~WebGPUBackend() = default;

bool WebGPUBackend::init(int width, int height) {
    mWidth = width;
    mHeight = height;
    return false; // WebGPU not available outside Emscripten
}

void WebGPUBackend::shutdown() {}
void WebGPUBackend::resize(int width, int height) { mWidth = width; mHeight = height; }
void WebGPUBackend::beginFrame() {}
void WebGPUBackend::endFrame() {}
void WebGPUBackend::clear(const ClearValues&) {}
void WebGPUBackend::viewport(int, int, int, int) {}
void WebGPUBackend::setDrawState(const DrawState&) {}
BufferHandle WebGPUBackend::createBuffer(BufferType, BufferUsage, const void*, size_t) { return {}; }
void WebGPUBackend::updateBuffer(BufferHandle, const void*, size_t, size_t) {}
void WebGPUBackend::destroyBuffer(BufferHandle) {}
TextureHandle WebGPUBackend::createTexture(const TextureDesc&, const void*) { return {}; }
void WebGPUBackend::updateTexture(TextureHandle, const void*, int, int, int, int, int) {}
void WebGPUBackend::generateMipmaps(TextureHandle) {}
void WebGPUBackend::destroyTexture(TextureHandle) {}
RenderTargetHandle WebGPUBackend::createRenderTarget(TextureHandle, TextureHandle) { return {}; }
void WebGPUBackend::bindRenderTarget(RenderTargetHandle) {}
void WebGPUBackend::destroyRenderTarget(RenderTargetHandle) {}
ShaderHandle WebGPUBackend::createShader(const ShaderDesc&) { return {}; }
void WebGPUBackend::destroyShader(ShaderHandle) {}
void WebGPUBackend::useShader(ShaderHandle) {}
void WebGPUBackend::setUniform(const char*, int) {}
void WebGPUBackend::setUniform(const char*, float) {}
void WebGPUBackend::setUniform(const char*, float, float) {}
void WebGPUBackend::setUniform(const char*, float, float, float) {}
void WebGPUBackend::setUniform(const char*, float, float, float, float) {}
void WebGPUBackend::setUniformMat4(const char*, const float*) {}
void WebGPUBackend::setUniformMat3(const char*, const float*) {}
void WebGPUBackend::setTexture(const char*, TextureHandle, int) {}
void WebGPUBackend::setUniformBuffer(int, BufferHandle) {}
void WebGPUBackend::setVertexBuffer(BufferHandle, const VertexLayout&) {}
void WebGPUBackend::setIndexBuffer(BufferHandle, bool) {}
void WebGPUBackend::draw(PrimitiveType, int, int) {}
void WebGPUBackend::drawIndexed(PrimitiveType, int, int, int) {}
void WebGPUBackend::drawInstanced(PrimitiveType, int, int, int, int) {}
void WebGPUBackend::drawIndexedInstanced(PrimitiveType, int, int, int, int, int) {}
ComputePipelineHandle WebGPUBackend::createComputePipeline(const ShaderDesc&) { return {}; }
void WebGPUBackend::destroyComputePipeline(ComputePipelineHandle) {}
void WebGPUBackend::bindStorageBuffer(int, BufferHandle) {}
void WebGPUBackend::bindStorageTexture(int, TextureHandle) {}
void WebGPUBackend::dispatch(ComputePipelineHandle, int, int, int) {}
void WebGPUBackend::computeBarrier() {}
void WebGPUBackend::readBuffer(BufferHandle, void*, size_t, size_t) {}
void WebGPUBackend::copyBuffer(BufferHandle, BufferHandle, size_t, size_t, size_t) {}
void WebGPUBackend::setLightingEnabled(bool) {}
void WebGPUBackend::setLight(int, const float*, const float*, const float*, const float*, const float*, bool) {}
void WebGPUBackend::setMaterial(const float*, const float*, const float*, const float*, float) {}
void WebGPUBackend::setGlobalAmbient(float, float, float, float) {}
void WebGPUBackend::setNormalMatrix(const float*) {}
void WebGPUBackend::setEnvironmentTexture(TextureHandle) {}
void WebGPUBackend::setEnvironmentParams(float, float) {}
void WebGPUBackend::drawSkybox(const float*, const float*) {}
void WebGPUBackend::setEnvironmentRotation(float) {}
void WebGPUBackend::beginEnvReflect(const float*, float, const float*) {}
void WebGPUBackend::endEnvReflect() {}
void WebGPUBackend::drawEnvReflect(const float*, const float*, const float*, BufferHandle, int, PrimitiveType) {}
void WebGPUBackend::drawEnvReflectIndexed(const float*, const float*, const float*, BufferHandle, BufferHandle, int, bool, PrimitiveType) {}
void WebGPUBackend::setPBREnabled(bool) {}
bool WebGPUBackend::isPBREnabled() const { return false; }
void WebGPUBackend::setPBRMaterial(const float*, float, float, float, const float*) {}
void WebGPUBackend::setPBREnvironment(TextureHandle, TextureHandle, TextureHandle) {}
void WebGPUBackend::setPBRParams(float, float, float) {}
void WebGPUBackend::setPBRInvViewRotation(const float*) {}
void WebGPUBackend::beginPBR(const float*) {}
void WebGPUBackend::endPBR() {}
void WebGPUBackend::drawPBR(const float*, const float*, const float*, BufferHandle, int, PrimitiveType) {}
void WebGPUBackend::drawPBRIndexed(const float*, const float*, const float*, BufferHandle, BufferHandle, int, bool, PrimitiveType) {}

} // namespace al

#endif // __EMSCRIPTEN__
