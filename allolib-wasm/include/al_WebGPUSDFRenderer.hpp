/**
 * AlloLib Studio Online - WebGPU SDF Sphere Tracing Renderer
 *
 * WGSL fragment shader that ray marches through a 3D SDF volume texture.
 * Features: Phong lighting, soft shadows, ambient occlusion, environment reflections.
 * Renders as a fullscreen quad using the backend's drawCustomFullscreen().
 *
 * Header-only for ease of use in examples.
 */

#ifndef AL_WEBGPU_SDF_RENDERER_HPP
#define AL_WEBGPU_SDF_RENDERER_HPP

#include "al_WebGPUSDFVolume.hpp"
#include "al_WebGPUBuffer.hpp"
#include "al_WebGPUBackend.hpp"
#include <cmath>
#include <cstdio>

#ifdef __EMSCRIPTEN__
#include <webgpu/webgpu.h>
#endif

namespace al {

/// Camera parameters for sphere tracing (128 bytes, GPU-aligned)
struct SDFCameraParams {
    float invViewProj[16];      // Inverse view-projection matrix
    float camPosX, camPosY, camPosZ;
    float time;
    float resX, resY;
    float nearPlane, farPlane;
    float volumeMinX, volumeMinY, volumeMinZ;
    float volumeExtent;
    float volumeMaxX, volumeMaxY, volumeMaxZ;
    uint32_t resolution;
};
static_assert(sizeof(SDFCameraParams) == 128, "SDFCameraParams must be 128 bytes");

/// Lighting/material parameters (64 bytes, GPU-aligned)
struct SDFLightParams {
    float lightDirX, lightDirY, lightDirZ;
    float shadowSoftness;           // Soft shadow penumbra factor
    float diffuseR, diffuseG, diffuseB;
    float aoRadius;                 // AO sampling radius
    float ambientR, ambientG, ambientB;
    uint32_t shadowSteps;           // 0 = no shadows
    float albedoR, albedoG, albedoB;
    uint32_t aoSamples;             // 0 = no AO
    float bgR, bgG, bgB, bgA;      // Background color
    uint32_t maxSteps;              // Ray march max steps
    float epsilon;                  // Hit threshold
    float metallic, roughness;
};
static_assert(sizeof(SDFLightParams) == 96, "SDFLightParams must be 96 bytes");

// ── WGSL Fullscreen Quad Vertex Shader ──────────────────────────────────────

static const char* kSDFVertexShader = R"(
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var positions = array<vec2f, 6>(
        vec2f(-1.0, -1.0),
        vec2f( 1.0, -1.0),
        vec2f(-1.0,  1.0),
        vec2f(-1.0,  1.0),
        vec2f( 1.0, -1.0),
        vec2f( 1.0,  1.0),
    );

    var uvs = array<vec2f, 6>(
        vec2f(0.0, 1.0),
        vec2f(1.0, 1.0),
        vec2f(0.0, 0.0),
        vec2f(0.0, 0.0),
        vec2f(1.0, 1.0),
        vec2f(1.0, 0.0),
    );

    var out: VertexOutput;
    out.position = vec4f(positions[vertex_index], 0.0, 1.0);
    out.uv = uvs[vertex_index];
    return out;
}
)";

// ── WGSL Sphere Tracing Fragment Shader ─────────────────────────────────────

static const char* kSDFFragmentShader = R"(
struct CameraParams {
    invViewProj: mat4x4f,
    camPos: vec3f,
    time: f32,
    resolution: vec2f,
    nearPlane: f32,
    farPlane: f32,
    volumeMin: vec3f,
    volumeExtent: f32,
    volumeMax: vec3f,
    volumeRes: u32,
}

struct LightParams {
    lightDir: vec3f,
    shadowSoftness: f32,
    diffuseColor: vec3f,
    aoRadius: f32,
    ambientColor: vec3f,
    shadowSteps: u32,
    albedo: vec3f,
    aoSamples: u32,
    bgColor: vec4f,
    maxSteps: u32,
    epsilon: f32,
    metallic: f32,
    roughness: f32,
}

@group(0) @binding(0) var<uniform> camera: CameraParams;
@group(0) @binding(1) var volume: texture_3d<f32>;
@group(0) @binding(2) var volumeSampler: sampler;
@group(0) @binding(3) var<uniform> lighting: LightParams;

fn worldToUV(p: vec3f) -> vec3f {
    return (p - camera.volumeMin) / (camera.volumeMax - camera.volumeMin);
}

fn sampleSDF(p: vec3f) -> f32 {
    let uv = worldToUV(p);
    if (any(uv < vec3f(0.0)) || any(uv > vec3f(1.0))) {
        return 1.0;  // Outside volume
    }
    return textureSampleLevel(volume, volumeSampler, uv, 0.0).r;
}

fn calcNormal(p: vec3f) -> vec3f {
    let e = camera.volumeExtent / f32(camera.volumeRes) * 0.5;
    let dx = sampleSDF(p + vec3f(e, 0.0, 0.0)) - sampleSDF(p - vec3f(e, 0.0, 0.0));
    let dy = sampleSDF(p + vec3f(0.0, e, 0.0)) - sampleSDF(p - vec3f(0.0, e, 0.0));
    let dz = sampleSDF(p + vec3f(0.0, 0.0, e)) - sampleSDF(p - vec3f(0.0, 0.0, e));
    return normalize(vec3f(dx, dy, dz));
}

fn softShadow(ro: vec3f, rd: vec3f, mint: f32, maxt: f32, k: f32) -> f32 {
    var res = 1.0;
    var t = mint;
    for (var i = 0u; i < lighting.shadowSteps; i++) {
        let p = ro + rd * t;
        let h = sampleSDF(p);
        if (h < 0.001) { return 0.0; }
        res = min(res, k * h / t);
        t += clamp(h, 0.01, 0.2);
        if (t > maxt) { break; }
    }
    return clamp(res, 0.0, 1.0);
}

fn calcAO(p: vec3f, n: vec3f) -> f32 {
    if (lighting.aoSamples == 0u) { return 1.0; }
    var occ = 0.0;
    var sca = 1.0;
    let samples = min(lighting.aoSamples, 5u);
    for (var i = 0u; i < samples; i++) {
        let h = lighting.aoRadius * (f32(i) + 1.0) / f32(samples);
        let d = sampleSDF(p + n * h);
        occ += (h - d) * sca;
        sca *= 0.75;
    }
    return clamp(1.0 - occ, 0.0, 1.0);
}

fn intersectAABB(ro: vec3f, rd: vec3f) -> vec2f {
    let invRd = 1.0 / rd;
    let t1 = (camera.volumeMin - ro) * invRd;
    let t2 = (camera.volumeMax - ro) * invRd;
    let tmin = min(t1, t2);
    let tmax = max(t1, t2);
    let tNear = max(max(tmin.x, tmin.y), tmin.z);
    let tFar = min(min(tmax.x, tmax.y), tmax.z);
    return vec2f(max(tNear, 0.0), tFar);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
    // Reconstruct ray from UV + inverse view-projection
    let ndc = vec4f(uv * 2.0 - 1.0, -1.0, 1.0);
    let ndcFar = vec4f(uv * 2.0 - 1.0, 1.0, 1.0);

    var worldNear = camera.invViewProj * ndc;
    worldNear /= worldNear.w;
    var worldFar = camera.invViewProj * ndcFar;
    worldFar /= worldFar.w;

    let ro = worldNear.xyz;
    let rd = normalize(worldFar.xyz - worldNear.xyz);

    // Intersect volume AABB
    let tBounds = intersectAABB(ro, rd);
    if (tBounds.x > tBounds.y) {
        return lighting.bgColor;
    }

    // Sphere tracing
    var t = tBounds.x;
    let maxT = tBounds.y;
    let eps = lighting.epsilon;
    var hit = false;

    for (var i = 0u; i < lighting.maxSteps; i++) {
        let p = ro + rd * t;
        let d = sampleSDF(p);

        if (d < eps) {
            hit = true;
            break;
        }

        t += max(d * 0.9, eps * 0.5);
        if (t > maxT) { break; }
    }

    if (!hit) {
        return lighting.bgColor;
    }

    let hitPos = ro + rd * t;
    let normal = calcNormal(hitPos);

    // Lighting
    let lightDir = normalize(lighting.lightDir);
    let NdotL = max(dot(normal, lightDir), 0.0);

    // Specular (Blinn-Phong)
    let viewDir = normalize(camera.camPos - hitPos);
    let halfVec = normalize(lightDir + viewDir);
    let spec = pow(max(dot(normal, halfVec), 0.0), mix(16.0, 128.0, 1.0 - lighting.roughness));
    let specular = spec * mix(0.04, 1.0, lighting.metallic);

    // Shadows
    var shadow = 1.0;
    if (lighting.shadowSteps > 0u) {
        shadow = softShadow(hitPos + normal * eps * 2.0, lightDir, 0.02, 4.0, lighting.shadowSoftness);
    }

    // AO
    let ao = calcAO(hitPos, normal);

    // Combine
    let ambient = lighting.ambientColor * ao;
    let diffuse = lighting.diffuseColor * NdotL * shadow;
    let color = lighting.albedo * (ambient + diffuse) + vec3f(specular * shadow);

    // Gamma correction
    let gamma = pow(color, vec3f(1.0 / 2.2));

    return vec4f(gamma, 1.0);
}
)";

// ── C++ SDFRenderer Class ────────────────────────────────────────────────────

class SDFRenderer {
    GraphicsBackend* mBackend = nullptr;
    GPUUniformBuffer<SDFCameraParams> mCameraBuffer;
    GPUUniformBuffer<SDFLightParams> mLightBuffer;

    SDFCameraParams mCamera;
    SDFLightParams mLight;

#ifdef __EMSCRIPTEN__
    WGPURenderPipeline mPipeline = nullptr;
    WGPUBindGroupLayout mBindGroupLayout = nullptr;
    WGPUBindGroup mBindGroup = nullptr;
    WGPUSampler mVolumeSampler = nullptr;
    TextureHandle mBoundVolumeTexture;
    bool mBindGroupDirty = true;
#endif

    void initDefaults() {
        // Camera defaults
        for (int i = 0; i < 16; i++) mCamera.invViewProj[i] = 0;
        mCamera.invViewProj[0] = mCamera.invViewProj[5] = mCamera.invViewProj[10] = mCamera.invViewProj[15] = 1;
        mCamera.camPosX = 0; mCamera.camPosY = 0; mCamera.camPosZ = 5;
        mCamera.time = 0;
        mCamera.resX = 800; mCamera.resY = 600;
        mCamera.nearPlane = 0.1f; mCamera.farPlane = 100;
        mCamera.volumeMinX = -2; mCamera.volumeMinY = -2; mCamera.volumeMinZ = -2;
        mCamera.volumeMaxX = 2; mCamera.volumeMaxY = 2; mCamera.volumeMaxZ = 2;
        mCamera.volumeExtent = 4;
        mCamera.resolution = 128;

        // Light defaults
        mLight.lightDirX = 0.57735f; mLight.lightDirY = 0.57735f; mLight.lightDirZ = 0.57735f;
        mLight.shadowSoftness = 8.0f;
        mLight.diffuseR = 1; mLight.diffuseG = 0.95f; mLight.diffuseB = 0.9f;
        mLight.aoRadius = 0.3f;
        mLight.ambientR = 0.15f; mLight.ambientG = 0.17f; mLight.ambientB = 0.2f;
        mLight.shadowSteps = 0;    // Off by default
        mLight.albedoR = 0.8f; mLight.albedoG = 0.7f; mLight.albedoB = 0.6f;
        mLight.aoSamples = 0;      // Off by default
        mLight.bgR = 0.1f; mLight.bgG = 0.12f; mLight.bgB = 0.15f; mLight.bgA = 1.0f;
        mLight.maxSteps = 128;
        mLight.epsilon = 0.005f;
        mLight.metallic = 0.0f;
        mLight.roughness = 0.5f;
    }

public:
    SDFRenderer() { initDefaults(); }

    /// Create the renderer
    void create(GraphicsBackend& backend) {
        mBackend = &backend;
        mCameraBuffer.create(backend);
        mLightBuffer.create(backend);

#ifdef __EMSCRIPTEN__
        createPipeline();
#endif
    }

    /// Set camera from view and projection matrices
    void setCamera(const float* viewMatrix, const float* projMatrix,
                   float camX, float camY, float camZ) {
        // Compute view-projection
        float vp[16];
        for (int i = 0; i < 4; i++) {
            for (int j = 0; j < 4; j++) {
                vp[i * 4 + j] = 0;
                for (int k = 0; k < 4; k++) {
                    vp[i * 4 + j] += projMatrix[k * 4 + j] * viewMatrix[i * 4 + k];
                }
            }
        }
        // Invert 4x4
        invertMatrix4(vp, mCamera.invViewProj);
        mCamera.camPosX = camX;
        mCamera.camPosY = camY;
        mCamera.camPosZ = camZ;
    }

    /// Set time (for animated effects)
    void setTime(float t) { mCamera.time = t; }

    /// Set resolution (for adaptive epsilon)
    void setResolution(float w, float h) { mCamera.resX = w; mCamera.resY = h; }

    /// Set background color
    void setBackgroundColor(float r, float g, float b, float a = 1.0f) {
        mLight.bgR = r; mLight.bgG = g; mLight.bgB = b; mLight.bgA = a;
    }

    /// Set light direction (will be normalized in shader)
    void setLightDir(float x, float y, float z) {
        mLight.lightDirX = x; mLight.lightDirY = y; mLight.lightDirZ = z;
    }

    /// Set light colors
    void setLightColor(float dr, float dg, float db,
                       float ar, float ag, float ab) {
        mLight.diffuseR = dr; mLight.diffuseG = dg; mLight.diffuseB = db;
        mLight.ambientR = ar; mLight.ambientG = ag; mLight.ambientB = ab;
    }

    /// Set material color (albedo)
    void setMaterialColor(float r, float g, float b) {
        mLight.albedoR = r; mLight.albedoG = g; mLight.albedoB = b;
    }

    /// Set material properties
    void setMaterial(float metallic, float roughness) {
        mLight.metallic = metallic; mLight.roughness = roughness;
    }

    /// Set max ray march steps (default 128)
    void setMaxSteps(int steps) { mLight.maxSteps = steps; }

    /// Set hit epsilon (default 0.005)
    void setEpsilon(float eps) { mLight.epsilon = eps; }

    /// Enable/disable soft shadows
    void enableSoftShadows(bool enable, int steps = 16, float softness = 8.0f) {
        mLight.shadowSteps = enable ? steps : 0;
        mLight.shadowSoftness = softness;
    }

    /// Enable/disable ambient occlusion
    void enableAO(bool enable, int samples = 5, float radius = 0.3f) {
        mLight.aoSamples = enable ? samples : 0;
        mLight.aoRadius = radius;
    }

    /// Render the SDF volume
    void render(const SDFVolume& volume) {
#ifdef __EMSCRIPTEN__
        if (!mBackend || !mPipeline) return;

        auto* backend = dynamic_cast<WebGPUBackend*>(mBackend);
        if (!backend) return;

        // Update camera with volume bounds
        mCamera.volumeMinX = volume.worldMinX();
        mCamera.volumeMinY = volume.worldMinY();
        mCamera.volumeMinZ = volume.worldMinZ();
        mCamera.volumeMaxX = volume.worldMaxX();
        mCamera.volumeMaxY = volume.worldMaxY();
        mCamera.volumeMaxZ = volume.worldMaxZ();
        mCamera.volumeExtent = volume.worldExtent();
        mCamera.resolution = volume.resolution();

        mCameraBuffer.upload(mCamera);
        mLightBuffer.upload(mLight);

        // Rebuild bind group if volume changed
        if (mBindGroupDirty || volume.volumeTexture().id != mBoundVolumeTexture.id) {
            rebuildBindGroup(backend, volume.volumeTexture());
        }

        if (!mBindGroup) return;

        backend->drawCustomFullscreen(mPipeline, mBindGroup);
#endif
    }

private:
#ifdef __EMSCRIPTEN__
    void createPipeline() {
        auto* backend = dynamic_cast<WebGPUBackend*>(mBackend);
        if (!backend) return;

        WGPUDevice device = backend->getDevice();

        // Vertex shader
        WGPUShaderModuleWGSLDescriptor vsWgsl = {};
        vsWgsl.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
        vsWgsl.code = kSDFVertexShader;
        WGPUShaderModuleDescriptor vsDesc = {};
        vsDesc.nextInChain = (WGPUChainedStruct*)&vsWgsl;
        vsDesc.label = "sdf_vertex";
        WGPUShaderModule vsModule = wgpuDeviceCreateShaderModule(device, &vsDesc);

        // Fragment shader
        WGPUShaderModuleWGSLDescriptor fsWgsl = {};
        fsWgsl.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
        fsWgsl.code = kSDFFragmentShader;
        WGPUShaderModuleDescriptor fsDesc = {};
        fsDesc.nextInChain = (WGPUChainedStruct*)&fsWgsl;
        fsDesc.label = "sdf_fragment";
        WGPUShaderModule fsModule = wgpuDeviceCreateShaderModule(device, &fsDesc);

        if (!vsModule || !fsModule) {
            printf("[SDFRenderer] ERROR: Failed to create shader modules\n");
            if (vsModule) wgpuShaderModuleRelease(vsModule);
            if (fsModule) wgpuShaderModuleRelease(fsModule);
            return;
        }

        // Bind group layout: uniform + texture3d + sampler + uniform
        WGPUBindGroupLayoutEntry entries[4] = {};

        // Binding 0: camera uniform (vertex + fragment)
        entries[0].binding = 0;
        entries[0].visibility = WGPUShaderStage_Fragment;
        entries[0].buffer.type = WGPUBufferBindingType_Uniform;
        entries[0].buffer.minBindingSize = sizeof(SDFCameraParams);

        // Binding 1: 3D SDF volume texture
        entries[1].binding = 1;
        entries[1].visibility = WGPUShaderStage_Fragment;
        entries[1].texture.sampleType = WGPUTextureSampleType_UnfilterableFloat;
        entries[1].texture.viewDimension = WGPUTextureViewDimension_3D;
        entries[1].texture.multisampled = false;

        // Binding 2: sampler
        entries[2].binding = 2;
        entries[2].visibility = WGPUShaderStage_Fragment;
        entries[2].sampler.type = WGPUSamplerBindingType_NonFiltering;

        // Binding 3: lighting uniform
        entries[3].binding = 3;
        entries[3].visibility = WGPUShaderStage_Fragment;
        entries[3].buffer.type = WGPUBufferBindingType_Uniform;
        entries[3].buffer.minBindingSize = sizeof(SDFLightParams);

        WGPUBindGroupLayoutDescriptor bglDesc = {};
        bglDesc.label = "sdf_renderer_bind_group_layout";
        bglDesc.entryCount = 4;
        bglDesc.entries = entries;
        mBindGroupLayout = wgpuDeviceCreateBindGroupLayout(device, &bglDesc);

        // Pipeline layout
        WGPUPipelineLayoutDescriptor plDesc = {};
        plDesc.bindGroupLayoutCount = 1;
        plDesc.bindGroupLayouts = &mBindGroupLayout;
        WGPUPipelineLayout pipelineLayout = wgpuDeviceCreatePipelineLayout(device, &plDesc);

        // Render pipeline
        WGPURenderPipelineDescriptor rpDesc = {};
        rpDesc.label = "sdf_renderer_pipeline";
        rpDesc.layout = pipelineLayout;

        WGPUVertexState vertexState = {};
        vertexState.module = vsModule;
        vertexState.entryPoint = "vs_main";
        vertexState.bufferCount = 0;
        rpDesc.vertex = vertexState;

        WGPUPrimitiveState primState = {};
        primState.topology = WGPUPrimitiveTopology_TriangleList;
        primState.frontFace = WGPUFrontFace_CCW;
        primState.cullMode = WGPUCullMode_None;
        rpDesc.primitive = primState;

        WGPUColorTargetState colorTarget = {};
        colorTarget.format = backend->getSwapChainFormat();
        colorTarget.writeMask = WGPUColorWriteMask_All;

        WGPUFragmentState fragState = {};
        fragState.module = fsModule;
        fragState.entryPoint = "fs_main";
        fragState.targetCount = 1;
        fragState.targets = &colorTarget;
        rpDesc.fragment = &fragState;

        // Depth stencil: must match render pass depth attachment (Depth32Float)
        WGPUDepthStencilState depthState = {};
        depthState.format = WGPUTextureFormat_Depth32Float;
        depthState.depthWriteEnabled = false;
        depthState.depthCompare = WGPUCompareFunction_Always;
        depthState.stencilFront.compare = WGPUCompareFunction_Always;
        depthState.stencilBack.compare = WGPUCompareFunction_Always;
        rpDesc.depthStencil = &depthState;

        WGPUMultisampleState msState = {};
        msState.count = 1;
        msState.mask = 0xFFFFFFFF;
        msState.alphaToCoverageEnabled = false;
        rpDesc.multisample = msState;

        mPipeline = wgpuDeviceCreateRenderPipeline(device, &rpDesc);

        wgpuPipelineLayoutRelease(pipelineLayout);
        wgpuShaderModuleRelease(vsModule);
        wgpuShaderModuleRelease(fsModule);

        if (!mPipeline) {
            printf("[SDFRenderer] ERROR: Failed to create render pipeline\n");
        } else {
            printf("[SDFRenderer] Pipeline created successfully\n");
        }

        // Create sampler
        WGPUSamplerDescriptor sampDesc = {};
        sampDesc.label = "sdf_volume_sampler";
        sampDesc.addressModeU = WGPUAddressMode_ClampToEdge;
        sampDesc.addressModeV = WGPUAddressMode_ClampToEdge;
        sampDesc.addressModeW = WGPUAddressMode_ClampToEdge;
        sampDesc.magFilter = WGPUFilterMode_Nearest;
        sampDesc.minFilter = WGPUFilterMode_Nearest;
        sampDesc.mipmapFilter = WGPUMipmapFilterMode_Nearest;
        mVolumeSampler = wgpuDeviceCreateSampler(device, &sampDesc);
    }

    void rebuildBindGroup(WebGPUBackend* backend, TextureHandle volTex) {
        WGPUDevice device = backend->getDevice();

        if (mBindGroup) {
            wgpuBindGroupRelease(mBindGroup);
            mBindGroup = nullptr;
        }

        WGPUTextureView texView = backend->getTextureView(volTex);
        WGPUBuffer cameraBuf = backend->getRawBuffer(mCameraBuffer.handle());
        WGPUBuffer lightBuf = backend->getRawBuffer(mLightBuffer.handle());

        if (!texView || !cameraBuf || !lightBuf || !mVolumeSampler) {
            printf("[SDFRenderer] ERROR: Missing resources for bind group\n");
            return;
        }

        WGPUBindGroupEntry entries[4] = {};

        entries[0].binding = 0;
        entries[0].buffer = cameraBuf;
        entries[0].offset = 0;
        entries[0].size = sizeof(SDFCameraParams);

        entries[1].binding = 1;
        entries[1].textureView = texView;

        entries[2].binding = 2;
        entries[2].sampler = mVolumeSampler;

        entries[3].binding = 3;
        entries[3].buffer = lightBuf;
        entries[3].offset = 0;
        entries[3].size = sizeof(SDFLightParams);

        WGPUBindGroupDescriptor bgDesc = {};
        bgDesc.label = "sdf_renderer_bind_group";
        bgDesc.layout = mBindGroupLayout;
        bgDesc.entryCount = 4;
        bgDesc.entries = entries;

        mBindGroup = wgpuDeviceCreateBindGroup(device, &bgDesc);
        mBoundVolumeTexture = volTex;
        mBindGroupDirty = false;

        if (!mBindGroup) {
            printf("[SDFRenderer] ERROR: Failed to create bind group\n");
        }
    }
#endif

    // 4x4 matrix inversion
    static void invertMatrix4(const float* m, float* out) {
        float inv[16];
        inv[0] = m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15] +
                 m[9]*m[7]*m[14] + m[13]*m[6]*m[11] - m[13]*m[7]*m[10];
        inv[4] = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15] -
                  m[8]*m[7]*m[14] - m[12]*m[6]*m[11] + m[12]*m[7]*m[10];
        inv[8] = m[4]*m[9]*m[15] - m[4]*m[11]*m[13] - m[8]*m[5]*m[15] +
                 m[8]*m[7]*m[13] + m[12]*m[5]*m[11] - m[12]*m[7]*m[9];
        inv[12] = -m[4]*m[9]*m[14] + m[4]*m[10]*m[13] + m[8]*m[5]*m[14] -
                   m[8]*m[6]*m[13] - m[12]*m[5]*m[10] + m[12]*m[6]*m[9];
        inv[1] = -m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15] -
                  m[9]*m[3]*m[14] - m[13]*m[2]*m[11] + m[13]*m[3]*m[10];
        inv[5] = m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15] +
                 m[8]*m[3]*m[14] + m[12]*m[2]*m[11] - m[12]*m[3]*m[10];
        inv[9] = -m[0]*m[9]*m[15] + m[0]*m[11]*m[13] + m[8]*m[1]*m[15] -
                  m[8]*m[3]*m[13] - m[12]*m[1]*m[11] + m[12]*m[3]*m[9];
        inv[13] = m[0]*m[9]*m[14] - m[0]*m[10]*m[13] - m[8]*m[1]*m[14] +
                  m[8]*m[2]*m[13] + m[12]*m[1]*m[10] - m[12]*m[2]*m[9];
        inv[2] = m[1]*m[6]*m[15] - m[1]*m[7]*m[14] - m[5]*m[2]*m[15] +
                 m[5]*m[3]*m[14] + m[13]*m[2]*m[7] - m[13]*m[3]*m[6];
        inv[6] = -m[0]*m[6]*m[15] + m[0]*m[7]*m[14] + m[4]*m[2]*m[15] -
                  m[4]*m[3]*m[14] - m[12]*m[2]*m[7] + m[12]*m[3]*m[6];
        inv[10] = m[0]*m[5]*m[15] - m[0]*m[7]*m[13] - m[4]*m[1]*m[15] +
                  m[4]*m[3]*m[13] + m[12]*m[1]*m[7] - m[12]*m[3]*m[5];
        inv[14] = -m[0]*m[5]*m[14] + m[0]*m[6]*m[13] + m[4]*m[1]*m[14] -
                   m[4]*m[2]*m[13] - m[12]*m[1]*m[6] + m[12]*m[2]*m[5];
        inv[3] = -m[1]*m[6]*m[11] + m[1]*m[7]*m[10] + m[5]*m[2]*m[11] -
                  m[5]*m[3]*m[10] - m[9]*m[2]*m[7] + m[9]*m[3]*m[6];
        inv[7] = m[0]*m[6]*m[11] - m[0]*m[7]*m[10] - m[4]*m[2]*m[11] +
                 m[4]*m[3]*m[10] + m[8]*m[2]*m[7] - m[8]*m[3]*m[6];
        inv[11] = -m[0]*m[5]*m[11] + m[0]*m[7]*m[9] + m[4]*m[1]*m[11] -
                   m[4]*m[3]*m[9] - m[8]*m[1]*m[7] + m[8]*m[3]*m[5];
        inv[15] = m[0]*m[5]*m[10] - m[0]*m[6]*m[9] - m[4]*m[1]*m[10] +
                  m[4]*m[2]*m[9] + m[8]*m[1]*m[6] - m[8]*m[2]*m[5];

        float det = m[0]*inv[0] + m[1]*inv[4] + m[2]*inv[8] + m[3]*inv[12];
        if (det == 0) {
            for (int i = 0; i < 16; i++) out[i] = 0;
            return;
        }
        det = 1.0f / det;
        for (int i = 0; i < 16; i++) out[i] = inv[i] * det;
    }
};

} // namespace al

#endif // AL_WEBGPU_SDF_RENDERER_HPP
