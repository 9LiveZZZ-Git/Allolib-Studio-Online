/**
 * AlloLib Studio Online - WebGPU Render Shader Wrapper
 *
 * High-level wrapper for creating fullscreen and custom WGSL render pipelines.
 * Handles pipeline creation, uniform buffers, texture binding, and draw calls.
 * Header-only for ease of use in examples.
 *
 * Safe to include on both WebGL2 and WebGPU builds. On WebGL2, all methods
 * are no-ops and WGPUBuffer is typedef'd to void*.
 *
 * Usage pattern (fullscreen):
 *   FullscreenShader shader;
 *   shader.create(backend, wgslSource, sizeof(MyUniforms));
 *   shader.setUniforms(myUniforms);
 *   shader.drawFullscreen();
 *
 * Usage pattern (mesh with vertex layout):
 *   FullscreenShader shader;
 *   shader.createWithVertexLayout(backend, wgslSource, sizeof(MyUniforms));
 *   WGPUBuffer vb = shader.uploadMesh(data, size);
 *   WGPUBuffer ib = shader.uploadIndices(indices, count);
 *   shader.setUniforms(myUniforms);
 *   shader.drawIndexed(vb, ib, indexCount);
 */

#ifndef AL_WEBGPU_RENDER_SHADER_HPP
#define AL_WEBGPU_RENDER_SHADER_HPP

#ifdef ALLOLIB_WEBGPU
#include "al_WebGPUBackend.hpp"
#else
// On WebGL2, we still need the WebGPU types for member declarations.
// webgpu.h is available in Emscripten sysroot regardless of -sUSE_WEBGPU.
// All actual WebGPU API calls are guarded by #ifdef ALLOLIB_WEBGPU.
#include "al_WebGraphicsBackend.hpp"
#ifdef __EMSCRIPTEN__
#include <webgpu/webgpu.h>
#endif
#endif

#include <cstdio>
#include <cstring>

namespace al {

// Forward declarations - defined in al_Graphics_Web.cpp
// (also declared in al_Graphics.hpp, but we may be included before it)
bool Graphics_isWebGPU();
GraphicsBackend* Graphics_getBackend();

/**
 * FullscreenShader - Wraps a WebGPU render pipeline for fullscreen or mesh-based effects.
 *
 * The WGSL source must contain both @vertex and @fragment entry points
 * named vs_main and fs_main. Binding 0 is reserved for the uniform buffer.
 * Additional bindings (textures, samplers) can be added via setTexture/setSampler.
 *
 * On WebGL2 builds, all methods are safe no-ops.
 */
class FullscreenShader {
public:
    FullscreenShader() = default;

    /**
     * Create a fullscreen render pipeline (no vertex buffers, no depth testing).
     */
    void create(GraphicsBackend& backend, const char* wgslSource, int uniformSize) {
        createInternal(backend, wgslSource, uniformSize, false);
    }

    /**
     * Create a render pipeline with the standard 48-byte InterleavedVertex layout
     * and depth testing enabled (Depth32Float, LessEqual).
     */
    void createWithVertexLayout(GraphicsBackend& backend, const char* wgslSource, int uniformSize) {
        createInternal(backend, wgslSource, uniformSize, true);
    }

    /**
     * Create a GPU buffer and upload vertex data.
     */
    WGPUBuffer uploadMesh(const void* interleavedData, size_t dataSize) {
#ifdef ALLOLIB_WEBGPU
        if (!mBackend || (!interleavedData && dataSize > 0)) return nullptr;
        WGPUBufferDescriptor desc = {};
        desc.label = "custom_vertex_buffer";
        desc.size = (dataSize + 3) & ~3;
        desc.usage = WGPUBufferUsage_Vertex | WGPUBufferUsage_CopyDst;
        WGPUBuffer buf = wgpuDeviceCreateBuffer(mBackend->getDevice(), &desc);
        if (buf) {
            wgpuQueueWriteBuffer(mBackend->getQueue(), buf, 0, interleavedData, dataSize);
        }
        return buf;
#else
        (void)interleavedData; (void)dataSize;
        return nullptr;
#endif
    }

    /**
     * Create and upload an index buffer (uint32 indices).
     */
    WGPUBuffer uploadIndices(const uint32_t* indices, size_t count) {
#ifdef ALLOLIB_WEBGPU
        if (!mBackend || (!indices && count > 0)) return nullptr;
        size_t dataSize = count * sizeof(uint32_t);
        WGPUBufferDescriptor desc = {};
        desc.label = "custom_index_buffer";
        desc.size = (dataSize + 3) & ~3;
        desc.usage = WGPUBufferUsage_Index | WGPUBufferUsage_CopyDst;
        WGPUBuffer buf = wgpuDeviceCreateBuffer(mBackend->getDevice(), &desc);
        if (buf) {
            wgpuQueueWriteBuffer(mBackend->getQueue(), buf, 0, indices, dataSize);
        }
        return buf;
#else
        (void)indices; (void)count;
        return nullptr;
#endif
    }

    /**
     * Upload uniform data to the GPU buffer.
     */
    template<typename T>
    void setUniforms(const T& data) {
#ifdef ALLOLIB_WEBGPU
        if (!mUniformBuffer || !mBackend) return;
        const size_t bytes = sizeof(T);
        const size_t alignedBytes = (bytes + 3) & ~3;  // WebGPU requires 4-byte alignment
        const size_t allocatedSize = ((size_t)mUniformSize + 15) & ~15;
        if (mUniformSize <= 0 || alignedBytes > allocatedSize) {
            printf("[FullscreenShader] ERROR: uniform upload too large (%zu > %d)\n", bytes, mUniformSize);
            return;
        }
        wgpuQueueWriteBuffer(mBackend->getQueue(), mUniformBuffer, 0, &data, alignedBytes);
#else
        (void)data;
#endif
    }

    /**
     * Set a texture view at the given binding index.
     */
    void setTexture(int binding, WGPUTextureView view) {
#ifdef ALLOLIB_WEBGPU
        if (binding < 1 || binding > 7) return;
        int idx = binding - 1;
        if (mTextureViews[idx] != view) {
            mTextureViews[idx] = view;
            mBindGroupDirty = true;
        }
#else
        (void)binding; (void)view;
#endif
    }

    /**
     * Set a sampler at the given binding index.
     */
    void setSampler(int binding, WGPUSampler sampler) {
#ifdef ALLOLIB_WEBGPU
        if (binding < 1 || binding > 7) return;
        int idx = binding - 1;
        if (mSamplers[idx] != sampler) {
            mSamplers[idx] = sampler;
            mBindGroupDirty = true;
        }
#else
        (void)binding; (void)sampler;
#endif
    }

    /**
     * Create a linear sampler (useful for FBO texture sampling).
     */
    WGPUSampler createLinearSampler() {
#ifdef ALLOLIB_WEBGPU
        if (!mBackend) return nullptr;
        WGPUSamplerDescriptor desc = {};
        desc.label = "linear_sampler";
        desc.addressModeU = WGPUAddressMode_ClampToEdge;
        desc.addressModeV = WGPUAddressMode_ClampToEdge;
        desc.addressModeW = WGPUAddressMode_ClampToEdge;
        desc.magFilter = WGPUFilterMode_Linear;
        desc.minFilter = WGPUFilterMode_Linear;
        desc.mipmapFilter = WGPUMipmapFilterMode_Linear;
        return wgpuDeviceCreateSampler(mBackend->getDevice(), &desc);
#else
        return nullptr;
#endif
    }

    /**
     * Draw a fullscreen quad (6 vertices, no vertex buffer needed).
     */
    void drawFullscreen() {
#ifdef ALLOLIB_WEBGPU
        if (!mCreated || !mPipeline || !mBackend) return;
        if (mBindGroupDirty) rebuildBindGroup();
        if (!mBindGroup) return;
        mBackend->drawCustomFullscreen(mPipeline, mBindGroup);
#endif
    }

    /**
     * Draw with a custom vertex buffer (non-indexed).
     */
    void drawWithVertices(WGPUBuffer vertexBuffer, uint32_t vertexCount) {
#ifdef ALLOLIB_WEBGPU
        if (!mCreated || !mPipeline || !mBackend) return;
        if (mBindGroupDirty) rebuildBindGroup();
        if (!mBindGroup) return;
        mBackend->drawCustomWithVertices(mPipeline, mBindGroup, vertexBuffer, vertexCount);
#else
        (void)vertexBuffer; (void)vertexCount;
#endif
    }

    /**
     * Draw indexed with vertex + index buffers.
     */
    void drawIndexed(WGPUBuffer vertexBuffer, WGPUBuffer indexBuffer, uint32_t indexCount) {
#ifdef ALLOLIB_WEBGPU
        if (!mCreated || !mPipeline || !mBackend) return;
        if (mBindGroupDirty) rebuildBindGroup();
        if (!mBindGroup) return;
        mBackend->drawCustomIndexed(mPipeline, mBindGroup, vertexBuffer, indexBuffer, indexCount);
#else
        (void)vertexBuffer; (void)indexBuffer; (void)indexCount;
#endif
    }

    void destroy() {
#ifdef ALLOLIB_WEBGPU
        if (mBindGroup) { wgpuBindGroupRelease(mBindGroup); mBindGroup = nullptr; }
        if (mBindGroupLayout) { wgpuBindGroupLayoutRelease(mBindGroupLayout); mBindGroupLayout = nullptr; }
        if (mPipeline) { wgpuRenderPipelineRelease(mPipeline); mPipeline = nullptr; }
        if (mShaderModule) { wgpuShaderModuleRelease(mShaderModule); mShaderModule = nullptr; }
        if (mUniformBuffer) { wgpuBufferRelease(mUniformBuffer); mUniformBuffer = nullptr; }
        mCreated = false;
#endif
    }

    ~FullscreenShader() { destroy(); }

    bool valid() const { return mCreated; }

    // Non-copyable
    FullscreenShader(const FullscreenShader&) = delete;
    FullscreenShader& operator=(const FullscreenShader&) = delete;

    // Movable
    FullscreenShader(FullscreenShader&& other) noexcept
#ifdef ALLOLIB_WEBGPU
        : mBackend(other.mBackend), mPipeline(other.mPipeline),
          mBindGroupLayout(other.mBindGroupLayout), mBindGroup(other.mBindGroup),
          mShaderModule(other.mShaderModule), mUniformBuffer(other.mUniformBuffer),
          mUniformSize(other.mUniformSize), mBindGroupDirty(other.mBindGroupDirty),
          mCreated(other.mCreated) {
        std::memcpy(mTextureViews, other.mTextureViews, sizeof(mTextureViews));
        std::memcpy(mSamplers, other.mSamplers, sizeof(mSamplers));
        other.mBackend = nullptr;
#else
        : mCreated(other.mCreated) {
#endif
        other.mPipeline = nullptr;
        other.mBindGroupLayout = nullptr;
        other.mBindGroup = nullptr;
        other.mShaderModule = nullptr;
        other.mUniformBuffer = nullptr;
        other.mCreated = false;
    }

    FullscreenShader& operator=(FullscreenShader&& other) noexcept {
        if (this != &other) {
            destroy();
#ifdef ALLOLIB_WEBGPU
            mBackend = other.mBackend;
            mUniformSize = other.mUniformSize;
            mBindGroupDirty = other.mBindGroupDirty;
            std::memcpy(mTextureViews, other.mTextureViews, sizeof(mTextureViews));
            std::memcpy(mSamplers, other.mSamplers, sizeof(mSamplers));
            other.mBackend = nullptr;
#endif
            mPipeline = other.mPipeline;
            mBindGroupLayout = other.mBindGroupLayout;
            mBindGroup = other.mBindGroup;
            mShaderModule = other.mShaderModule;
            mUniformBuffer = other.mUniformBuffer;
            mCreated = other.mCreated;
            other.mPipeline = nullptr;
            other.mBindGroupLayout = nullptr;
            other.mBindGroup = nullptr;
            other.mShaderModule = nullptr;
            other.mUniformBuffer = nullptr;
            other.mCreated = false;
        }
        return *this;
    }

private:
#ifdef ALLOLIB_WEBGPU
    void createInternal(GraphicsBackend& backend, const char* wgslSource, int uniformSize, bool withVertexLayout) {
        destroy();
        mBindGroupDirty = true;
        std::memset(mTextureViews, 0, sizeof(mTextureViews));
        std::memset(mSamplers, 0, sizeof(mSamplers));

        if (!wgslSource) {
            printf("[FullscreenShader] ERROR: wgslSource is null\n");
            return;
        }

        mBackend = dynamic_cast<WebGPUBackend*>(&backend);
        if (!mBackend) {
            printf("[FullscreenShader] ERROR: Backend is not WebGPU\n");
            return;
        }

        mUniformSize = uniformSize;
        WGPUDevice device = mBackend->getDevice();

        // Create shader module
        WGPUShaderModuleWGSLDescriptor wgslDesc = {};
        wgslDesc.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
        wgslDesc.code = wgslSource;
        WGPUShaderModuleDescriptor smDesc = {};
        smDesc.nextInChain = (WGPUChainedStruct*)&wgslDesc;
        smDesc.label = withVertexLayout ? "mesh_shader" : "fullscreen_shader";
        mShaderModule = wgpuDeviceCreateShaderModule(device, &smDesc);

        if (!mShaderModule) {
            printf("[FullscreenShader] ERROR: Failed to create shader module\n");
            destroy();
            return;
        }

        // Create uniform buffer if needed
        if (uniformSize > 0) {
            WGPUBufferDescriptor bufDesc = {};
            bufDesc.label = "shader_uniforms";
            bufDesc.size = (uniformSize + 15) & ~15;
            bufDesc.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
            mUniformBuffer = wgpuDeviceCreateBuffer(device, &bufDesc);
        }

        // Create render pipeline with auto layout
        WGPURenderPipelineDescriptor rpDesc = {};
        rpDesc.label = withVertexLayout ? "mesh_pipeline" : "fullscreen_pipeline";
        rpDesc.layout = nullptr; // auto layout

        // Vertex state
        WGPUVertexState vertexState = {};
        vertexState.module = mShaderModule;
        vertexState.entryPoint = "vs_main";

        // Vertex attributes for InterleavedVertex layout (48 bytes)
        WGPUVertexAttribute vertexAttrs[4] = {};
        WGPUVertexBufferLayout vertexBufferLayout = {};

        if (withVertexLayout) {
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

            vertexBufferLayout.arrayStride = 48;
            vertexBufferLayout.stepMode = WGPUVertexStepMode_Vertex;
            vertexBufferLayout.attributeCount = 4;
            vertexBufferLayout.attributes = vertexAttrs;

            vertexState.bufferCount = 1;
            vertexState.buffers = &vertexBufferLayout;
        } else {
            vertexState.bufferCount = 0;
        }

        rpDesc.vertex = vertexState;

        // Color target
        WGPUColorTargetState colorTarget = {};
        colorTarget.format = mBackend->getSwapChainFormat();
        colorTarget.writeMask = WGPUColorWriteMask_All;

        WGPUBlendState blend = {};
        blend.color.srcFactor = WGPUBlendFactor_SrcAlpha;
        blend.color.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
        blend.color.operation = WGPUBlendOperation_Add;
        blend.alpha.srcFactor = WGPUBlendFactor_One;
        blend.alpha.dstFactor = WGPUBlendFactor_OneMinusSrcAlpha;
        blend.alpha.operation = WGPUBlendOperation_Add;
        colorTarget.blend = &blend;

        WGPUFragmentState fragState = {};
        fragState.module = mShaderModule;
        fragState.entryPoint = "fs_main";
        fragState.targetCount = 1;
        fragState.targets = &colorTarget;
        rpDesc.fragment = &fragState;

        rpDesc.primitive.topology = WGPUPrimitiveTopology_TriangleList;
        rpDesc.primitive.cullMode = WGPUCullMode_None;

        // Depth state: always required to match render pass depth attachment.
        // Mesh shaders use depth testing; fullscreen shaders pass through.
        WGPUDepthStencilState depthState = {};
        depthState.format = WGPUTextureFormat_Depth32Float;
        depthState.stencilFront.compare = WGPUCompareFunction_Always;
        depthState.stencilBack.compare = WGPUCompareFunction_Always;
        if (withVertexLayout) {
            depthState.depthWriteEnabled = true;
            depthState.depthCompare = WGPUCompareFunction_LessEqual;
        } else {
            depthState.depthWriteEnabled = false;
            depthState.depthCompare = WGPUCompareFunction_Always;
        }
        rpDesc.depthStencil = &depthState;

        WGPUMultisampleState msState = {};
        msState.count = 1;
        msState.mask = 0xFFFFFFFF;
        msState.alphaToCoverageEnabled = false;
        rpDesc.multisample = msState;

        mPipeline = wgpuDeviceCreateRenderPipeline(device, &rpDesc);

        if (!mPipeline) {
            printf("[FullscreenShader] ERROR: Failed to create render pipeline\n");
            destroy();
            return;
        }

        // Get bind group layout from auto-layout pipeline
        mBindGroupLayout = wgpuRenderPipelineGetBindGroupLayout(mPipeline, 0);

        rebuildBindGroup();

        if (!mBindGroup) {
            printf("[FullscreenShader] ERROR: Bind group creation failed\n");
            destroy();
            return;
        }

        printf("[FullscreenShader] %s pipeline created successfully\n",
               withVertexLayout ? "Mesh" : "Fullscreen");
        mCreated = true;
    }

    void rebuildBindGroup() {
        if (!mBackend || !mBindGroupLayout) return;
        WGPUDevice device = mBackend->getDevice();

        if (mBindGroup) {
            wgpuBindGroupRelease(mBindGroup);
            mBindGroup = nullptr;
        }

        WGPUBindGroupEntry entries[16] = {};
        int entryCount = 0;

        // Binding 0: uniform buffer
        if (mUniformBuffer) {
            entries[entryCount].binding = 0;
            entries[entryCount].buffer = mUniformBuffer;
            entries[entryCount].offset = 0;
            entries[entryCount].size = (mUniformSize + 15) & ~15;
            entryCount++;
        }

        // Additional bindings: textures and samplers
        // Each binding index must be unique — texture and sampler at same slot
        // cannot share a binding number. Texture takes priority if both exist.
        for (int i = 0; i < 7; i++) {
            int bindingIdx = i + 1;
            if (mTextureViews[i]) {
                if (mSamplers[i]) {
                    printf("[FullscreenShader] WARNING: binding %d has both texture and sampler, sampler ignored\n", bindingIdx);
                }
                entries[entryCount].binding = bindingIdx;
                entries[entryCount].textureView = mTextureViews[i];
                entryCount++;
            } else if (mSamplers[i]) {
                entries[entryCount].binding = bindingIdx;
                entries[entryCount].sampler = mSamplers[i];
                entryCount++;
            }
        }

        WGPUBindGroupDescriptor bgDesc = {};
        bgDesc.label = "shader_bind_group";
        bgDesc.layout = mBindGroupLayout;
        bgDesc.entryCount = entryCount;
        bgDesc.entries = entries;

        mBindGroup = wgpuDeviceCreateBindGroup(device, &bgDesc);
        if (!mBindGroup) {
            printf("[FullscreenShader] WARNING: Failed to create bind group\n");
            mBindGroupDirty = true;
            return;
        }
        mBindGroupDirty = false;
    }

    WebGPUBackend* mBackend = nullptr;
    int mUniformSize = 0;
    bool mBindGroupDirty = true;
    WGPUTextureView mTextureViews[7] = {};
    WGPUSampler mSamplers[7] = {};
#else
    void createInternal(GraphicsBackend&, const char*, int, bool) {}
#endif
    // These members exist on both backends (using void* on WebGL2)
    WGPURenderPipeline mPipeline = nullptr;
    WGPUBindGroupLayout mBindGroupLayout = nullptr;
    WGPUBindGroup mBindGroup = nullptr;
    WGPUShaderModule mShaderModule = nullptr;
    WGPUBuffer mUniformBuffer = nullptr;
    bool mCreated = false;
};

} // namespace al

#endif // AL_WEBGPU_RENDER_SHADER_HPP
