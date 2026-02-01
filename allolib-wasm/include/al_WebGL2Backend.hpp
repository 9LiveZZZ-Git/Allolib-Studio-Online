/**
 * AlloLib Studio Online - WebGL2 Graphics Backend
 *
 * Implementation of GraphicsBackend for WebGL2/OpenGL ES 3.0.
 * This wraps the existing al::Graphics functionality to provide
 * maximum compatibility while allowing future WebGPU migration.
 *
 * Features:
 *   - Full WebGL2 support (OpenGL ES 3.0)
 *   - Integrates with existing al::Graphics pipeline
 *   - Maximum browser compatibility
 *   - No compute shader support (WebGL2 limitation)
 */

#ifndef AL_WEBGL2_BACKEND_HPP
#define AL_WEBGL2_BACKEND_HPP

#include "al_WebGraphicsBackend.hpp"
#include <unordered_map>
#include <vector>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/html5.h>
#endif

// Use AlloLib's OpenGL setup which handles glad properly
#include "al/graphics/al_OpenGL.hpp"

namespace al {

/**
 * WebGL2 Backend Implementation
 *
 * Maps the abstract GraphicsBackend interface to WebGL2/OpenGL ES 3.0 calls.
 * Resource handles map to OpenGL object IDs internally.
 */
class WebGL2Backend : public GraphicsBackend {
public:
    WebGL2Backend();
    ~WebGL2Backend() override;

    // ── Lifecycle ────────────────────────────────────────────────────────

    bool init(int width, int height) override;
    void shutdown() override;
    void resize(int width, int height) override;
    void beginFrame() override;
    void endFrame() override;

    // ── Render State ─────────────────────────────────────────────────────

    void clear(const ClearValues& values) override;
    void viewport(int x, int y, int w, int h) override;
    void setDrawState(const DrawState& state) override;

    // ── Buffers ──────────────────────────────────────────────────────────

    BufferHandle createBuffer(
        BufferType type,
        BufferUsage usage,
        const void* data,
        size_t size
    ) override;

    void updateBuffer(
        BufferHandle handle,
        const void* data,
        size_t size,
        size_t offset = 0
    ) override;

    void destroyBuffer(BufferHandle handle) override;

    // ── Textures ─────────────────────────────────────────────────────────

    TextureHandle createTexture(
        const TextureDesc& desc,
        const void* data = nullptr
    ) override;

    void updateTexture(
        TextureHandle handle,
        const void* data,
        int level = 0,
        int x = 0, int y = 0,
        int w = -1, int h = -1
    ) override;

    void generateMipmaps(TextureHandle handle) override;
    void destroyTexture(TextureHandle handle) override;

    // ── Render Targets ───────────────────────────────────────────────────

    RenderTargetHandle createRenderTarget(
        TextureHandle color,
        TextureHandle depth = {}
    ) override;

    void bindRenderTarget(RenderTargetHandle handle) override;
    void destroyRenderTarget(RenderTargetHandle handle) override;

    // ── Shaders ──────────────────────────────────────────────────────────

    ShaderHandle createShader(const ShaderDesc& desc) override;
    void destroyShader(ShaderHandle handle) override;
    void useShader(ShaderHandle handle) override;

    // ── Uniforms ─────────────────────────────────────────────────────────

    void setUniform(const char* name, int value) override;
    void setUniform(const char* name, float value) override;
    void setUniform(const char* name, float x, float y) override;
    void setUniform(const char* name, float x, float y, float z) override;
    void setUniform(const char* name, float x, float y, float z, float w) override;
    void setUniformMat4(const char* name, const float* value) override;
    void setUniformMat3(const char* name, const float* value) override;
    void setTexture(const char* name, TextureHandle handle, int unit = 0) override;
    void setUniformBuffer(int binding, BufferHandle handle) override;

    // ── Drawing ──────────────────────────────────────────────────────────

    void setVertexBuffer(BufferHandle handle, const VertexLayout& layout) override;
    void setIndexBuffer(BufferHandle handle, bool use32Bit = false) override;

    void draw(
        PrimitiveType primitive,
        int vertexCount,
        int firstVertex = 0
    ) override;

    void drawIndexed(
        PrimitiveType primitive,
        int indexCount,
        int firstIndex = 0,
        int baseVertex = 0
    ) override;

    void drawInstanced(
        PrimitiveType primitive,
        int vertexCount,
        int instanceCount,
        int firstVertex = 0,
        int firstInstance = 0
    ) override;

    void drawIndexedInstanced(
        PrimitiveType primitive,
        int indexCount,
        int instanceCount,
        int firstIndex = 0,
        int baseVertex = 0,
        int firstInstance = 0
    ) override;

    // ── Compute (Not supported in WebGL2) ────────────────────────────────

    bool supportsCompute() const override { return false; }

    // ── Buffer Operations ────────────────────────────────────────────────

    void readBuffer(
        BufferHandle handle,
        void* dest,
        size_t size,
        size_t offset = 0
    ) override;

    void copyBuffer(
        BufferHandle src,
        BufferHandle dst,
        size_t size,
        size_t srcOffset = 0,
        size_t dstOffset = 0
    ) override;

    // ── Queries ──────────────────────────────────────────────────────────

    BackendType getType() const override { return BackendType::WebGL2; }
    const char* getName() const override { return "WebGL2"; }
    int getWidth() const override { return mWidth; }
    int getHeight() const override { return mHeight; }

private:
    // ── Internal Resource Tracking ───────────────────────────────────────

    struct BufferResource {
        GLuint glId = 0;
        BufferType type;
        BufferUsage usage;
        size_t size = 0;
    };

    struct TextureResource {
        GLuint glId = 0;
        TextureDesc desc;
    };

    struct ShaderResource {
        GLuint glProgram = 0;
        std::string name;
        // Cache uniform locations
        mutable std::unordered_map<std::string, GLint> uniformCache;
    };

    struct RenderTargetResource {
        GLuint glFbo = 0;
        TextureHandle colorAttachment;
        TextureHandle depthAttachment;
    };

    // Resource maps (handle ID -> resource)
    std::unordered_map<uint64_t, BufferResource> mBuffers;
    std::unordered_map<uint64_t, TextureResource> mTextures;
    std::unordered_map<uint64_t, ShaderResource> mShaders;
    std::unordered_map<uint64_t, RenderTargetResource> mRenderTargets;

    // Handle generation
    uint64_t mNextHandleId = 1;
    uint64_t generateHandleId() { return mNextHandleId++; }

    // Current state
    int mWidth = 0;
    int mHeight = 0;
    ShaderHandle mCurrentShader;
    GLuint mCurrentVao = 0;
    bool mIndexBuffer32Bit = false;

    // VAO for vertex attribute setup
    GLuint mVao = 0;

    // ── Helper Methods ───────────────────────────────────────────────────

    GLint getUniformLocation(const char* name);
    GLenum toGLBufferType(BufferType type);
    GLenum toGLBufferUsage(BufferUsage usage);
    GLenum toGLPixelFormat(PixelFormat format);
    GLenum toGLInternalFormat(PixelFormat format);
    GLenum toGLPixelType(PixelFormat format);
    GLenum toGLPrimitive(PrimitiveType type);
    GLenum toGLBlendFactor(BlendMode mode, bool isSrc);
    GLenum toGLCullFace(CullFace face);
    GLenum toGLDepthFunc(DepthFunc func);
    GLenum toGLFilter(FilterMode mode, bool minFilter);
    GLenum toGLWrap(WrapMode mode);

    bool compileShader(GLuint shader, const char* source);
    bool linkProgram(GLuint program);
};

// ─── Factory Function Implementation ─────────────────────────────────────────

inline std::unique_ptr<GraphicsBackend> createWebGL2Backend() {
    return std::make_unique<WebGL2Backend>();
}

} // namespace al

#endif // AL_WEBGL2_BACKEND_HPP
