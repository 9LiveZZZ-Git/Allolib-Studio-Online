/**
 * AlloLib Studio Online - WebGPU Compute Shader Wrapper
 *
 * High-level wrapper around the raw WebGPU compute pipeline API.
 * Header-only for ease of use in examples.
 */

#ifndef AL_WEBGPU_COMPUTE_HPP
#define AL_WEBGPU_COMPUTE_HPP

#include "al_WebGraphicsBackend.hpp"
#include <string>

namespace al {

class ComputeShader {
    GraphicsBackend* mBackend = nullptr;
    ComputePipelineHandle mPipeline;

public:
    ComputeShader() = default;

    /// Create compute pipeline from WGSL source
    void create(GraphicsBackend& backend, const std::string& wgslSource) {
        mBackend = &backend;
        ShaderDesc desc;
        desc.computeSource = wgslSource;
        mPipeline = backend.createComputePipeline(desc);
    }

    /// Bind a storage buffer at the given binding index
    void bind(int binding, BufferHandle buffer) {
        if (!mBackend || !mPipeline.valid()) return;
        mBackend->bindStorageBuffer(binding, buffer);
    }

    /// Bind a uniform buffer at the given binding index
    void bindUniform(int binding, BufferHandle buffer) {
        if (!mBackend || !mPipeline.valid()) return;
        mBackend->bindUniformBuffer(binding, buffer);
    }

    /// Bind a storage texture at the given binding index
    void bindTexture(int binding, TextureHandle texture) {
        if (!mBackend || !mPipeline.valid()) return;
        mBackend->bindStorageTexture(binding, texture);
    }

    /// Dispatch compute work groups
    void dispatch(int groupsX, int groupsY = 1, int groupsZ = 1) {
        if (!mBackend || !mPipeline.valid()) return;
        mBackend->dispatch(mPipeline, groupsX, groupsY, groupsZ);
    }

    /// Destroy the compute pipeline
    void destroy() {
        if (mBackend && mPipeline.valid())
            mBackend->destroyComputePipeline(mPipeline);
        mPipeline = {};
    }

    ~ComputeShader() { destroy(); }

    bool valid() const { return mPipeline.valid(); }
    ComputePipelineHandle handle() const { return mPipeline; }

    // Non-copyable
    ComputeShader(const ComputeShader&) = delete;
    ComputeShader& operator=(const ComputeShader&) = delete;

    // Movable
    ComputeShader(ComputeShader&& other) noexcept
        : mBackend(other.mBackend), mPipeline(other.mPipeline) {
        other.mBackend = nullptr;
        other.mPipeline = {};
    }
    ComputeShader& operator=(ComputeShader&& other) noexcept {
        if (this != &other) {
            destroy();
            mBackend = other.mBackend;
            mPipeline = other.mPipeline;
            other.mBackend = nullptr;
            other.mPipeline = {};
        }
        return *this;
    }
};

} // namespace al

#endif // AL_WEBGPU_COMPUTE_HPP
