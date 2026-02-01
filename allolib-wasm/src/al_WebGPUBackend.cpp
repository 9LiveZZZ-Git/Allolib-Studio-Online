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

// ─── Constructor / Destructor ────────────────────────────────────────────────

WebGPUBackend::WebGPUBackend() {
    // Reserve space for uniform data (typical size)
    mUniformData.resize(256, 0);
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

    // Initialize viewport
    mViewportX = 0;
    mViewportY = 0;
    mViewportW = width;
    mViewportH = height;

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
        if (shader.pipeline) wgpuRenderPipelineRelease(shader.pipeline);
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

    if (mCurrentSwapChainView) {
        wgpuTextureViewRelease(mCurrentSwapChainView);
        mCurrentSwapChainView = nullptr;
    }

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

    // Get texture views
    if (color.valid()) {
        auto it = mTextures.find(color.id);
        if (it != mTextures.end()) {
            resource.colorView = it->second.view;
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

    // Create bind group layout for uniforms
    WGPUBindGroupLayoutEntry layoutEntry = {};
    layoutEntry.binding = 0;
    layoutEntry.visibility = WGPUShaderStage_Vertex | WGPUShaderStage_Fragment;
    layoutEntry.buffer.type = WGPUBufferBindingType_Uniform;
    layoutEntry.buffer.minBindingSize = 256; // Standard uniform buffer size

    WGPUBindGroupLayoutDescriptor layoutDesc = {};
    layoutDesc.entryCount = 1;
    layoutDesc.entries = &layoutEntry;
    resource.bindGroupLayout = wgpuDeviceCreateBindGroupLayout(mDevice, &layoutDesc);

    // Create pipeline layout
    WGPUPipelineLayoutDescriptor pipelineLayoutDesc = {};
    pipelineLayoutDesc.bindGroupLayoutCount = 1;
    pipelineLayoutDesc.bindGroupLayouts = &resource.bindGroupLayout;
    resource.pipelineLayout = wgpuDeviceCreatePipelineLayout(mDevice, &pipelineLayoutDesc);

    // Create uniform buffer
    WGPUBufferDescriptor uniformBufDesc = {};
    uniformBufDesc.label = "Uniform Buffer";
    uniformBufDesc.size = 256;
    uniformBufDesc.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
    resource.uniformBuffer = wgpuDeviceCreateBuffer(mDevice, &uniformBufDesc);

    // Create bind group
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

    // Create render pipeline
    WGPURenderPipelineDescriptor pipelineDesc = {};
    pipelineDesc.layout = resource.pipelineLayout;

    // Vertex state
    WGPUVertexAttribute vertexAttribs[3] = {};
    // Position
    vertexAttribs[0].format = WGPUVertexFormat_Float32x3;
    vertexAttribs[0].offset = 0;
    vertexAttribs[0].shaderLocation = 0;
    // Color
    vertexAttribs[1].format = WGPUVertexFormat_Float32x4;
    vertexAttribs[1].offset = 12;
    vertexAttribs[1].shaderLocation = 1;
    // Tex coord (optional)
    vertexAttribs[2].format = WGPUVertexFormat_Float32x2;
    vertexAttribs[2].offset = 28;
    vertexAttribs[2].shaderLocation = 2;

    WGPUVertexBufferLayout vertexBufferLayout = {};
    vertexBufferLayout.arrayStride = 36; // 3 + 4 + 2 floats
    vertexBufferLayout.stepMode = WGPUVertexStepMode_Vertex;
    vertexBufferLayout.attributeCount = 2; // Default: position + color
    vertexBufferLayout.attributes = vertexAttribs;

    pipelineDesc.vertex.module = resource.vertModule;
    pipelineDesc.vertex.entryPoint = "vs_main";
    pipelineDesc.vertex.bufferCount = 1;
    pipelineDesc.vertex.buffers = &vertexBufferLayout;

    // Primitive state
    pipelineDesc.primitive.topology = WGPUPrimitiveTopology_TriangleList;
    pipelineDesc.primitive.stripIndexFormat = WGPUIndexFormat_Undefined;
    pipelineDesc.primitive.frontFace = WGPUFrontFace_CCW;
    pipelineDesc.primitive.cullMode = WGPUCullMode_Back;

    // Depth stencil state
    WGPUDepthStencilState depthStencil = {};
    depthStencil.format = WGPUTextureFormat_Depth24Plus;
    depthStencil.depthWriteEnabled = true;
    depthStencil.depthCompare = WGPUCompareFunction_Less;
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

    resource.pipeline = wgpuDeviceCreateRenderPipeline(mDevice, &pipelineDesc);
    if (!resource.pipeline) {
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

    uint64_t id = generateHandleId();
    mShaders[id] = resource;

    printf("[WebGPUBackend] Created shader '%s'\n", desc.name.c_str());
    return ShaderHandle{id};
}

void WebGPUBackend::destroyShader(ShaderHandle handle) {
    auto it = mShaders.find(handle.id);
    if (it == mShaders.end()) return;

    auto& shader = it->second;
    if (shader.bindGroup) wgpuBindGroupRelease(shader.bindGroup);
    if (shader.uniformBuffer) wgpuBufferRelease(shader.uniformBuffer);
    if (shader.pipeline) wgpuRenderPipelineRelease(shader.pipeline);
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

// ─── Uniforms ────────────────────────────────────────────────────────────────

void WebGPUBackend::setUniform(const char* name, int value) {
    // For now, we use a fixed layout uniform buffer
    // Name-based uniforms would require reflection
    (void)name;
    (void)value;
    mUniformsDirty = true;
}

void WebGPUBackend::setUniform(const char* name, float value) {
    (void)name;
    (void)value;
    mUniformsDirty = true;
}

void WebGPUBackend::setUniform(const char* name, float x, float y) {
    (void)name;
    (void)x;
    (void)y;
    mUniformsDirty = true;
}

void WebGPUBackend::setUniform(const char* name, float x, float y, float z) {
    (void)name;
    (void)x;
    (void)y;
    (void)z;
    mUniformsDirty = true;
}

void WebGPUBackend::setUniform(const char* name, float x, float y, float z, float w) {
    (void)name;
    (void)x;
    (void)y;
    (void)z;
    (void)w;
    mUniformsDirty = true;
}

void WebGPUBackend::setUniformMat4(const char* name, const float* value) {
    // Write to uniform buffer at standard offset
    // AlloLib layout: modelViewMatrix at 0, projectionMatrix at 64
    if (strcmp(name, "al_ModelViewMatrix") == 0 || strcmp(name, "modelViewMatrix") == 0) {
        memcpy(mUniformData.data(), value, 64);
    } else if (strcmp(name, "al_ProjectionMatrix") == 0 || strcmp(name, "projectionMatrix") == 0) {
        memcpy(mUniformData.data() + 64, value, 64);
    }
    mUniformsDirty = true;
}

void WebGPUBackend::setUniformMat3(const char* name, const float* value) {
    (void)name;
    (void)value;
    mUniformsDirty = true;
}

void WebGPUBackend::setTexture(const char* name, TextureHandle handle, int unit) {
    // Would need to rebuild bind group with texture
    // For now, textures need to be bound at pipeline creation
    (void)name;
    (void)handle;
    (void)unit;
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
    (void)primitive; // Pipeline was created with fixed topology

    // Ensure render pass is active
    beginRenderPass();
    if (!mRenderPassEncoder) return;

    // Flush uniforms
    flushUniforms();

    // Bind pipeline
    auto shaderIt = mShaders.find(mCurrentShader.id);
    if (shaderIt != mShaders.end() && shaderIt->second.pipeline) {
        wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, shaderIt->second.pipeline);
        wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, shaderIt->second.bindGroup, 0, nullptr);
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
    (void)primitive;

    beginRenderPass();
    if (!mRenderPassEncoder) return;

    flushUniforms();

    // Bind pipeline
    auto shaderIt = mShaders.find(mCurrentShader.id);
    if (shaderIt != mShaders.end() && shaderIt->second.pipeline) {
        wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, shaderIt->second.pipeline);
        wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, shaderIt->second.bindGroup, 0, nullptr);
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
    (void)primitive;

    beginRenderPass();
    if (!mRenderPassEncoder) return;

    flushUniforms();

    // Bind pipeline
    auto shaderIt = mShaders.find(mCurrentShader.id);
    if (shaderIt != mShaders.end() && shaderIt->second.pipeline) {
        wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, shaderIt->second.pipeline);
        wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, shaderIt->second.bindGroup, 0, nullptr);
    }

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
    (void)primitive;

    beginRenderPass();
    if (!mRenderPassEncoder) return;

    flushUniforms();

    // Bind pipeline
    auto shaderIt = mShaders.find(mCurrentShader.id);
    if (shaderIt != mShaders.end() && shaderIt->second.pipeline) {
        wgpuRenderPassEncoderSetPipeline(mRenderPassEncoder, shaderIt->second.pipeline);
        wgpuRenderPassEncoderSetBindGroup(mRenderPassEncoder, 0, shaderIt->second.bindGroup, 0, nullptr);
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
    int success = EM_ASM_INT({
        try {
            console.log('[WebGPUBackend] Starting JS canvas configuration...');

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
                alphaMode: 'opaque',
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
    WGPURenderPassDepthStencilAttachment depthAttachment = {};
    depthAttachment.view = depthView;
    depthAttachment.depthLoadOp = mHasPendingClear && mPendingClear.clearDepth ?
                                   WGPULoadOp_Clear : WGPULoadOp_Load;
    depthAttachment.depthStoreOp = WGPUStoreOp_Store;
    depthAttachment.depthClearValue = mPendingClear.depth;
    depthAttachment.depthReadOnly = false;
    depthAttachment.stencilLoadOp = WGPULoadOp_Clear;
    depthAttachment.stencilStoreOp = WGPUStoreOp_Store;
    depthAttachment.stencilClearValue = mPendingClear.stencil;
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
    if (!mUniformsDirty || !mCurrentShader.valid()) return;

    auto it = mShaders.find(mCurrentShader.id);
    if (it == mShaders.end() || !it->second.uniformBuffer) return;

    // Write uniform data to buffer
    wgpuQueueWriteBuffer(mQueue, it->second.uniformBuffer, 0,
                          mUniformData.data(), mUniformData.size());
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

} // namespace al

#endif // __EMSCRIPTEN__
