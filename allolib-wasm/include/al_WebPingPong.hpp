/**
 * AlloLib Studio Online - Ping-Pong Buffer for Compute
 *
 * Double-buffered wrapper for read/write compute shader patterns.
 * Header-only for ease of use in examples.
 */

#ifndef AL_WEB_PING_PONG_HPP
#define AL_WEB_PING_PONG_HPP

#include "al_WebGPUBuffer.hpp"

namespace al {

/// Double-buffered GPU storage buffer for ping-pong compute patterns
template<typename T>
class PingPongBuffer {
    GPUBuffer<T> mBuffers[2];
    int mCurrent = 0;

public:
    PingPongBuffer() = default;

    /// Create both buffers with optional initial data
    void create(GraphicsBackend& backend, size_t count, const T* data = nullptr) {
        mBuffers[0].create(backend, count, data);
        mBuffers[1].create(backend, count, data);
    }

    /// Create from a vector (both buffers get the same data)
    void create(GraphicsBackend& backend, const std::vector<T>& data) {
        mBuffers[0].create(backend, data);
        mBuffers[1].create(backend, data);
    }

    /// Get the current (write target) buffer
    GPUBuffer<T>& current() { return mBuffers[mCurrent]; }

    /// Get the previous (read source) buffer
    GPUBuffer<T>& previous() { return mBuffers[1 - mCurrent]; }

    /// Get current buffer handle
    BufferHandle currentHandle() { return mBuffers[mCurrent].handle(); }

    /// Get previous buffer handle
    BufferHandle previousHandle() { return mBuffers[1 - mCurrent].handle(); }

    /// Swap current and previous buffers
    void swap() { mCurrent = 1 - mCurrent; }

    /// Get element count
    size_t count() const { return mBuffers[0].count(); }

    void destroy() {
        mBuffers[0].destroy();
        mBuffers[1].destroy();
    }

    ~PingPongBuffer() { destroy(); }

    // Non-copyable
    PingPongBuffer(const PingPongBuffer&) = delete;
    PingPongBuffer& operator=(const PingPongBuffer&) = delete;

    // Movable
    PingPongBuffer(PingPongBuffer&& other) noexcept
        : mCurrent(other.mCurrent) {
        mBuffers[0] = std::move(other.mBuffers[0]);
        mBuffers[1] = std::move(other.mBuffers[1]);
        other.mCurrent = 0;
    }
    PingPongBuffer& operator=(PingPongBuffer&& other) noexcept {
        if (this != &other) {
            destroy();
            mBuffers[0] = std::move(other.mBuffers[0]);
            mBuffers[1] = std::move(other.mBuffers[1]);
            mCurrent = other.mCurrent;
            other.mCurrent = 0;
        }
        return *this;
    }
};

} // namespace al

#endif // AL_WEB_PING_PONG_HPP
