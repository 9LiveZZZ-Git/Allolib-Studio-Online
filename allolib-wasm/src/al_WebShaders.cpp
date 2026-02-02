/**
 * AlloLib Studio Online - Web Shaders Implementation
 *
 * Embedded WGSL shader sources from allolib-wasm/shaders/wgsl/
 */

#include "al_WebShaders.hpp"
#include <cstdio>

namespace al {

// ─── Embedded Shader Sources ─────────────────────────────────────────────────

// Mesh vertex shader - per-vertex colors
static const char* MESH_VERT_WGSL = R"(
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
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
}

fn stereo_displace_flat(v: vec4f, e: f32, f: f32) -> vec4f {
    var result = v;
    let l = sqrt((v.x - e) * (v.x - e) + v.y * v.y + v.z * v.z);
    let z = abs(v.z);
    let t = f * (v.x - e) / z;
    result.x = z * (e + t) / f;
    result = vec4f(normalize(result.xyz) * l, result.w);
    return result;
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let worldPos = uniforms.modelViewMatrix * vec4f(in.position, 1.0);
    if (uniforms.eyeSep == 0.0) {
        out.position = uniforms.projectionMatrix * worldPos;
    } else {
        out.position = uniforms.projectionMatrix * stereo_displace_flat(worldPos, uniforms.eyeSep, uniforms.focLen);
    }
    out.color = in.color;
    return out;
}
)";

// Mesh fragment shader - per-vertex colors
static const char* MESH_FRAG_WGSL = R"(
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
)";

// Color vertex shader - uniform color
static const char* COLOR_VERT_WGSL = R"(
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

struct VertexInput {
    @location(0) position: vec3f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
}

fn stereo_displace_flat(v: vec4f, e: f32, f: f32) -> vec4f {
    var result = v;
    let l = sqrt((v.x - e) * (v.x - e) + v.y * v.y + v.z * v.z);
    let z = abs(v.z);
    let t = f * (v.x - e) / z;
    result.x = z * (e + t) / f;
    result = vec4f(normalize(result.xyz) * l, result.w);
    return result;
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let worldPos = uniforms.modelViewMatrix * vec4f(in.position, 1.0);
    if (uniforms.eyeSep == 0.0) {
        out.position = uniforms.projectionMatrix * worldPos;
    } else {
        out.position = uniforms.projectionMatrix * stereo_displace_flat(worldPos, uniforms.eyeSep, uniforms.focLen);
    }
    return out;
}
)";

// Color fragment shader - uniform color
static const char* COLOR_FRAG_WGSL = R"(
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
)";

// Textured vertex shader
static const char* TEXTURED_VERT_WGSL = R"(
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
    @location(2) texcoord: vec2f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f,
}

fn stereo_displace_flat(v: vec4f, e: f32, f: f32) -> vec4f {
    var result = v;
    let l = sqrt((v.x - e) * (v.x - e) + v.y * v.y + v.z * v.z);
    let z = abs(v.z);
    let t = f * (v.x - e) / z;
    result.x = z * (e + t) / f;
    result = vec4f(normalize(result.xyz) * l, result.w);
    return result;
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    let worldPos = uniforms.modelViewMatrix * vec4f(in.position, 1.0);
    if (uniforms.eyeSep == 0.0) {
        out.position = uniforms.projectionMatrix * worldPos;
    } else {
        out.position = uniforms.projectionMatrix * stereo_displace_flat(worldPos, uniforms.eyeSep, uniforms.focLen);
    }
    out.texcoord = in.texcoord;
    return out;
}
)";

// Textured fragment shader
static const char* TEXTURED_FRAG_WGSL = R"(
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
)";

// Placeholder shaders for lighting, PBR, and skybox (use mesh shader as base)
static const char* LIGHTING_VERT_WGSL = MESH_VERT_WGSL;
static const char* LIGHTING_FRAG_WGSL = MESH_FRAG_WGSL;
static const char* PBR_VERT_WGSL = MESH_VERT_WGSL;
static const char* PBR_FRAG_WGSL = MESH_FRAG_WGSL;
static const char* SKYBOX_VERT_WGSL = MESH_VERT_WGSL;
static const char* SKYBOX_FRAG_WGSL = MESH_FRAG_WGSL;

// ─── API Implementation ──────────────────────────────────────────────────────

const char* getWGSLVertexShader(DefaultShader shader) {
    switch (shader) {
        case DefaultShader::Mesh:     return MESH_VERT_WGSL;
        case DefaultShader::Color:    return COLOR_VERT_WGSL;
        case DefaultShader::Textured: return TEXTURED_VERT_WGSL;
        case DefaultShader::Lighting: return LIGHTING_VERT_WGSL;
        case DefaultShader::PBR:      return PBR_VERT_WGSL;
        case DefaultShader::Skybox:   return SKYBOX_VERT_WGSL;
        default:                      return MESH_VERT_WGSL;
    }
}

const char* getWGSLFragmentShader(DefaultShader shader) {
    switch (shader) {
        case DefaultShader::Mesh:     return MESH_FRAG_WGSL;
        case DefaultShader::Color:    return COLOR_FRAG_WGSL;
        case DefaultShader::Textured: return TEXTURED_FRAG_WGSL;
        case DefaultShader::Lighting: return LIGHTING_FRAG_WGSL;
        case DefaultShader::PBR:      return PBR_FRAG_WGSL;
        case DefaultShader::Skybox:   return SKYBOX_FRAG_WGSL;
        default:                      return MESH_FRAG_WGSL;
    }
}

const char* getShaderName(DefaultShader shader) {
    switch (shader) {
        case DefaultShader::Mesh:     return "mesh";
        case DefaultShader::Color:    return "color";
        case DefaultShader::Textured: return "textured";
        case DefaultShader::Lighting: return "lighting";
        case DefaultShader::PBR:      return "pbr";
        case DefaultShader::Skybox:   return "skybox";
        default:                      return "unknown";
    }
}

ShaderHandle createDefaultShader(GraphicsBackend* backend, DefaultShader shader) {
    if (!backend || !backend->isWebGPU()) {
        return {};
    }

    ShaderDesc desc;
    desc.vertexSource = getWGSLVertexShader(shader);
    desc.fragmentSource = getWGSLFragmentShader(shader);
    desc.name = getShaderName(shader);

    return backend->createShader(desc);
}

// ─── WebShaderManager Implementation ─────────────────────────────────────────

WebShaderManager::~WebShaderManager() {
    clear();
}

void WebShaderManager::setBackend(GraphicsBackend* backend) {
    if (mBackend != backend) {
        clear();
        mBackend = backend;
    }
}

ShaderHandle* WebShaderManager::getShaderSlot(DefaultShader type) {
    switch (type) {
        case DefaultShader::Mesh:     return &mMeshShader;
        case DefaultShader::Color:    return &mColorShader;
        case DefaultShader::Textured: return &mTexturedShader;
        case DefaultShader::Lighting: return &mLightingShader;
        case DefaultShader::PBR:      return &mPBRShader;
        case DefaultShader::Skybox:   return &mSkyboxShader;
        default:                      return nullptr;
    }
}

ShaderHandle WebShaderManager::getShader(DefaultShader type) {
    ShaderHandle* slot = getShaderSlot(type);
    if (!slot) return {};

    // Return cached shader if valid
    if (slot->valid()) {
        return *slot;
    }

    // Create shader
    if (mBackend) {
        *slot = createDefaultShader(mBackend, type);
        if (slot->valid()) {
            printf("[WebShaderManager] Created shader: %s\n", getShaderName(type));
        } else {
            printf("[WebShaderManager] Failed to create shader: %s\n", getShaderName(type));
        }
    }

    return *slot;
}

bool WebShaderManager::hasShader(DefaultShader type) const {
    const ShaderHandle* slot = const_cast<WebShaderManager*>(this)->getShaderSlot(type);
    return slot && slot->valid();
}

void WebShaderManager::clear() {
    if (!mBackend) return;

    if (mMeshShader.valid())     mBackend->destroyShader(mMeshShader);
    if (mColorShader.valid())    mBackend->destroyShader(mColorShader);
    if (mTexturedShader.valid()) mBackend->destroyShader(mTexturedShader);
    if (mLightingShader.valid()) mBackend->destroyShader(mLightingShader);
    if (mPBRShader.valid())      mBackend->destroyShader(mPBRShader);
    if (mSkyboxShader.valid())   mBackend->destroyShader(mSkyboxShader);

    mMeshShader = {};
    mColorShader = {};
    mTexturedShader = {};
    mLightingShader = {};
    mPBRShader = {};
    mSkyboxShader = {};
}

} // namespace al
