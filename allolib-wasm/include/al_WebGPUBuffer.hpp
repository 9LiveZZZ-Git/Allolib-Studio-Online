/**
 * AlloLib Studio Online - WebGPU GPU Buffer Templates
 *
 * Typed buffer wrappers for compute shader data transfer.
 * Header-only for ease of use in examples.
 */

#ifndef AL_WEBGPU_BUFFER_HPP
#define AL_WEBGPU_BUFFER_HPP

#include "al_WebGraphicsBackend.hpp"
#include <vector>
#include <cstddef>

namespace al {

/// Typed GPU storage buffer for compute shaders
template<typename T>
class GPUBuffer {
    GraphicsBackend* mBackend = nullptr;
    BufferHandle mHandle;
    size_t mCount = 0;

public:
    GPUBuffer() = default;

    /// Create a storage buffer with optional initial data
    void create(GraphicsBackend& backend, size_t count, const T* data = nullptr) {
        mBackend = &backend;
        mCount = count;
        mHandle = backend.createBuffer(
            BufferType::Storage, BufferUsage::Dynamic,
            data, count * sizeof(T)
        );
    }

    /// Create from a vector
    void create(GraphicsBackend& backend, const std::vector<T>& data) {
        create(backend, data.size(), data.data());
    }

    /// Upload data to the buffer
    void upload(const T* data, size_t count, size_t offset = 0) {
        mBackend->updateBuffer(mHandle, data, count * sizeof(T), offset * sizeof(T));
    }

    /// Upload from a vector
    void upload(const std::vector<T>& data) { upload(data.data(), data.size()); }

    /// Read buffer data back to CPU (requires ASYNCIFY)
    void readback(T* dest, size_t count, size_t offset = 0) {
        mBackend->readBuffer(mHandle, dest, count * sizeof(T), offset * sizeof(T));
    }

    /// Read back into a vector
    void readback(std::vector<T>& dest) {
        dest.resize(mCount);
        readback(dest.data(), mCount);
    }

    BufferHandle handle() const { return mHandle; }
    size_t count() const { return mCount; }
    size_t sizeBytes() const { return mCount * sizeof(T); }

    void destroy() {
        if (mBackend && mHandle.valid()) mBackend->destroyBuffer(mHandle);
        mHandle = {};
    }

    ~GPUBuffer() { destroy(); }

    // Non-copyable
    GPUBuffer(const GPUBuffer&) = delete;
    GPUBuffer& operator=(const GPUBuffer&) = delete;

    // Movable
    GPUBuffer(GPUBuffer&& other) noexcept
        : mBackend(other.mBackend), mHandle(other.mHandle), mCount(other.mCount) {
        other.mBackend = nullptr;
        other.mHandle = {};
        other.mCount = 0;
    }
    GPUBuffer& operator=(GPUBuffer&& other) noexcept {
        if (this != &other) {
            destroy();
            mBackend = other.mBackend;
            mHandle = other.mHandle;
            mCount = other.mCount;
            other.mBackend = nullptr;
            other.mHandle = {};
            other.mCount = 0;
        }
        return *this;
    }
};

/// Typed GPU uniform buffer for compute shader parameters
template<typename T>
class GPUUniformBuffer {
    GraphicsBackend* mBackend = nullptr;
    BufferHandle mHandle;

public:
    GPUUniformBuffer() = default;

    /// Create a uniform buffer with optional initial data
    void create(GraphicsBackend& backend, const T* data = nullptr) {
        mBackend = &backend;
        mHandle = backend.createBuffer(
            BufferType::Uniform, BufferUsage::Dynamic,
            data, sizeof(T)
        );
    }

    /// Upload uniform data
    void upload(const T& data) {
        mBackend->updateBuffer(mHandle, &data, sizeof(T), 0);
    }

    BufferHandle handle() const { return mHandle; }

    void destroy() {
        if (mBackend && mHandle.valid()) mBackend->destroyBuffer(mHandle);
        mHandle = {};
    }

    ~GPUUniformBuffer() { destroy(); }

    // Non-copyable
    GPUUniformBuffer(const GPUUniformBuffer&) = delete;
    GPUUniformBuffer& operator=(const GPUUniformBuffer&) = delete;

    // Movable
    GPUUniformBuffer(GPUUniformBuffer&& other) noexcept
        : mBackend(other.mBackend), mHandle(other.mHandle) {
        other.mBackend = nullptr;
        other.mHandle = {};
    }
    GPUUniformBuffer& operator=(GPUUniformBuffer&& other) noexcept {
        if (this != &other) {
            destroy();
            mBackend = other.mBackend;
            mHandle = other.mHandle;
            other.mBackend = nullptr;
            other.mHandle = {};
        }
        return *this;
    }
};

} // namespace al

#endif // AL_WEBGPU_BUFFER_HPP
