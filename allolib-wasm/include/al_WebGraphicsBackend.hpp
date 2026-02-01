/**
 * AlloLib Studio Online - Graphics Backend Abstraction
 *
 * Provides a unified interface for WebGL2 and WebGPU backends,
 * allowing seamless switching between rendering APIs.
 *
 * This integrates with the existing WebApp architecture and
 * works alongside existing systems like PBR, AutoLOD, etc.
 *
 * Usage:
 *   // In WebApp subclass
 *   void onCreate() override {
 *       // Backend is already initialized by WebApp
 *       auto& backend = *this->backend();
 *
 *       // Create resources
 *       vbo = backend.createBuffer(BufferType::Vertex, ...);
 *       shader = backend.createShader(shaderDesc);
 *   }
 *
 *   void onDraw(Graphics& g) override {
 *       auto& backend = *this->backend();
 *       backend.useShader(shader);
 *       backend.draw(PrimitiveType::Triangles, vbo, vertexCount);
 *   }
 */

#ifndef AL_WEB_GRAPHICS_BACKEND_HPP
#define AL_WEB_GRAPHICS_BACKEND_HPP

#include <memory>
#include <string>
#include <cstdint>
#include <functional>

namespace al {

// ─── Opaque Handles ──────────────────────────────────────────────────────────

/// Opaque handle for GPU buffer resources
struct BufferHandle {
    uint64_t id = 0;
    bool valid() const { return id != 0; }
    operator bool() const { return valid(); }
};

/// Opaque handle for texture resources
struct TextureHandle {
    uint64_t id = 0;
    bool valid() const { return id != 0; }
    operator bool() const { return valid(); }
};

/// Opaque handle for shader programs/pipelines
struct ShaderHandle {
    uint64_t id = 0;
    bool valid() const { return id != 0; }
    operator bool() const { return valid(); }
};

/// Opaque handle for render targets (FBO/attachment equivalent)
struct RenderTargetHandle {
    uint64_t id = 0;
    bool valid() const { return id != 0; }
    operator bool() const { return valid(); }
};

/// Opaque handle for compute pipelines (WebGPU only)
struct ComputePipelineHandle {
    uint64_t id = 0;
    bool valid() const { return id != 0; }
    operator bool() const { return valid(); }
};

// ─── Enumerations ────────────────────────────────────────────────────────────

/// Backend type selection
enum class BackendType {
    WebGL2,     ///< WebGL2 / OpenGL ES 3.0 (maximum compatibility)
    WebGPU,     ///< WebGPU (modern features + compute)
    Auto        ///< Auto-detect best available
};

/// Buffer type for GPU memory allocation
enum class BufferType {
    Vertex,     ///< Vertex buffer (VBO)
    Index,      ///< Index buffer (IBO/EBO)
    Uniform,    ///< Uniform buffer (UBO)
    Storage     ///< Storage buffer (WebGPU compute)
};

/// Buffer usage hints for optimization
enum class BufferUsage {
    Static,     ///< Data set once, used many times
    Dynamic,    ///< Data updated occasionally
    Stream      ///< Data updated every frame
};

/// Pixel formats for textures
enum class PixelFormat {
    R8,         ///< 8-bit single channel
    RG8,        ///< 8-bit two channel
    RGB8,       ///< 8-bit RGB
    RGBA8,      ///< 8-bit RGBA (most common)
    R16F,       ///< 16-bit float single channel
    RG16F,      ///< 16-bit float two channel
    RGBA16F,    ///< 16-bit float RGBA (HDR)
    R32F,       ///< 32-bit float single channel
    RG32F,      ///< 32-bit float two channel
    RGBA32F,    ///< 32-bit float RGBA (compute)
    Depth16,    ///< 16-bit depth
    Depth24,    ///< 24-bit depth
    Depth32F,   ///< 32-bit float depth
    Depth24Stencil8  ///< 24-bit depth + 8-bit stencil
};

/// Primitive topology for drawing
enum class PrimitiveType {
    Points,
    Lines,
    LineStrip,
    LineLoop,
    Triangles,
    TriangleStrip,
    TriangleFan
};

/// Blending modes
enum class BlendMode {
    None,       ///< No blending (opaque)
    Alpha,      ///< Standard alpha blending
    Additive,   ///< Additive blending (glow effects)
    Multiply,   ///< Multiply blending
    PreMultiplied  ///< Pre-multiplied alpha
};

/// Face culling modes
enum class CullFace {
    None,       ///< No culling (double-sided)
    Front,      ///< Cull front faces
    Back        ///< Cull back faces (default)
};

/// Depth comparison functions
enum class DepthFunc {
    Never,
    Less,       ///< Pass if depth < buffer (default)
    LessEqual,
    Equal,
    Greater,
    GreaterEqual,
    NotEqual,
    Always
};

/// Texture filtering modes
enum class FilterMode {
    Nearest,    ///< Point sampling (pixelated)
    Linear,     ///< Bilinear filtering
    Trilinear   ///< Trilinear with mipmaps
};

/// Texture wrapping modes
enum class WrapMode {
    Repeat,
    MirroredRepeat,
    ClampToEdge,
    ClampToBorder
};

// ─── Descriptor Structures ───────────────────────────────────────────────────

/// Texture creation descriptor
struct TextureDesc {
    int width = 1;
    int height = 1;
    int depth = 1;              ///< For 3D textures
    PixelFormat format = PixelFormat::RGBA8;
    FilterMode minFilter = FilterMode::Linear;
    FilterMode magFilter = FilterMode::Linear;
    WrapMode wrapS = WrapMode::ClampToEdge;
    WrapMode wrapT = WrapMode::ClampToEdge;
    WrapMode wrapR = WrapMode::ClampToEdge;
    bool mipmaps = false;
    bool renderTarget = false;  ///< Can be used as render target
    bool storageTexture = false; ///< Can be written from compute (WebGPU)
    int samples = 1;            ///< MSAA sample count
};

/// Shader creation descriptor
struct ShaderDesc {
    std::string vertexSource;   ///< GLSL or WGSL vertex shader
    std::string fragmentSource; ///< GLSL or WGSL fragment shader
    std::string computeSource;  ///< WGSL compute shader (WebGPU only)
    std::string name;           ///< Debug name
};

/// Vertex attribute descriptor
struct VertexAttribute {
    int location;       ///< Shader attribute location
    int components;     ///< Number of components (1-4)
    int offset;         ///< Byte offset in vertex
    bool normalized = false;
};

/// Vertex layout descriptor
struct VertexLayout {
    int stride;         ///< Bytes per vertex
    std::vector<VertexAttribute> attributes;
};

/// Draw state configuration
struct DrawState {
    BlendMode blend = BlendMode::None;
    CullFace cull = CullFace::Back;
    DepthFunc depth = DepthFunc::Less;
    bool depthWrite = true;
    bool depthTest = true;
    bool scissorTest = false;
    int scissorX = 0, scissorY = 0;
    int scissorW = 0, scissorH = 0;
    float lineWidth = 1.0f;
    float pointSize = 1.0f;
};

/// Clear values for render pass
struct ClearValues {
    float r = 0.0f, g = 0.0f, b = 0.0f, a = 1.0f;
    float depth = 1.0f;
    int stencil = 0;
    bool clearColor = true;
    bool clearDepth = true;
    bool clearStencil = false;
};

// ─── Abstract Backend Interface ──────────────────────────────────────────────

/**
 * Abstract Graphics Backend Interface
 *
 * Implementations:
 *   - WebGL2Backend: Wraps existing al::Graphics OpenGL calls
 *   - WebGPUBackend: New WebGPU implementation with compute support
 */
class GraphicsBackend {
public:
    virtual ~GraphicsBackend() = default;

    // ── Lifecycle ────────────────────────────────────────────────────────

    /// Initialize the backend with canvas dimensions
    virtual bool init(int width, int height) = 0;

    /// Shutdown and release all resources
    virtual void shutdown() = 0;

    /// Handle canvas resize
    virtual void resize(int width, int height) = 0;

    /// Begin a new frame (acquire swapchain image, etc.)
    virtual void beginFrame() = 0;

    /// End frame and present to screen
    virtual void endFrame() = 0;

    // ── Render State ─────────────────────────────────────────────────────

    /// Clear the current render target
    virtual void clear(const ClearValues& values) = 0;

    /// Convenience: clear with color only
    void clear(float r, float g, float b, float a = 1.0f) {
        ClearValues cv;
        cv.r = r; cv.g = g; cv.b = b; cv.a = a;
        clear(cv);
    }

    /// Set the viewport
    virtual void viewport(int x, int y, int w, int h) = 0;

    /// Set draw state (blending, culling, depth)
    virtual void setDrawState(const DrawState& state) = 0;

    // ── Buffers ──────────────────────────────────────────────────────────

    /// Create a GPU buffer
    virtual BufferHandle createBuffer(
        BufferType type,
        BufferUsage usage,
        const void* data,
        size_t size
    ) = 0;

    /// Update buffer data
    virtual void updateBuffer(
        BufferHandle handle,
        const void* data,
        size_t size,
        size_t offset = 0
    ) = 0;

    /// Destroy a buffer
    virtual void destroyBuffer(BufferHandle handle) = 0;

    // ── Textures ─────────────────────────────────────────────────────────

    /// Create a texture
    virtual TextureHandle createTexture(
        const TextureDesc& desc,
        const void* data = nullptr
    ) = 0;

    /// Update texture data
    virtual void updateTexture(
        TextureHandle handle,
        const void* data,
        int level = 0,
        int x = 0, int y = 0,
        int w = -1, int h = -1
    ) = 0;

    /// Generate mipmaps for a texture
    virtual void generateMipmaps(TextureHandle handle) = 0;

    /// Destroy a texture
    virtual void destroyTexture(TextureHandle handle) = 0;

    // ── Render Targets ───────────────────────────────────────────────────

    /// Create a render target (FBO equivalent)
    virtual RenderTargetHandle createRenderTarget(
        TextureHandle color,
        TextureHandle depth = {}
    ) = 0;

    /// Bind a render target (nullptr for default framebuffer)
    virtual void bindRenderTarget(RenderTargetHandle handle) = 0;

    /// Unbind render target (bind default)
    void unbindRenderTarget() { bindRenderTarget({}); }

    /// Destroy a render target
    virtual void destroyRenderTarget(RenderTargetHandle handle) = 0;

    // ── Shaders ──────────────────────────────────────────────────────────

    /// Create a shader program/pipeline
    virtual ShaderHandle createShader(const ShaderDesc& desc) = 0;

    /// Destroy a shader
    virtual void destroyShader(ShaderHandle handle) = 0;

    /// Bind a shader for rendering
    virtual void useShader(ShaderHandle handle) = 0;

    // ── Uniforms ─────────────────────────────────────────────────────────

    virtual void setUniform(const char* name, int value) = 0;
    virtual void setUniform(const char* name, float value) = 0;
    virtual void setUniform(const char* name, float x, float y) = 0;
    virtual void setUniform(const char* name, float x, float y, float z) = 0;
    virtual void setUniform(const char* name, float x, float y, float z, float w) = 0;
    virtual void setUniformMat4(const char* name, const float* value) = 0;
    virtual void setUniformMat3(const char* name, const float* value) = 0;

    /// Bind a texture to a sampler uniform
    virtual void setTexture(const char* name, TextureHandle handle, int unit = 0) = 0;

    /// Bind a uniform buffer to a binding point
    virtual void setUniformBuffer(int binding, BufferHandle handle) = 0;

    // ── Drawing ──────────────────────────────────────────────────────────

    /// Set vertex buffer and layout for drawing
    virtual void setVertexBuffer(BufferHandle handle, const VertexLayout& layout) = 0;

    /// Set index buffer for indexed drawing
    virtual void setIndexBuffer(BufferHandle handle, bool use32Bit = false) = 0;

    /// Draw primitives
    virtual void draw(
        PrimitiveType primitive,
        int vertexCount,
        int firstVertex = 0
    ) = 0;

    /// Draw indexed primitives
    virtual void drawIndexed(
        PrimitiveType primitive,
        int indexCount,
        int firstIndex = 0,
        int baseVertex = 0
    ) = 0;

    /// Draw instanced primitives
    virtual void drawInstanced(
        PrimitiveType primitive,
        int vertexCount,
        int instanceCount,
        int firstVertex = 0,
        int firstInstance = 0
    ) = 0;

    /// Draw indexed instanced primitives
    virtual void drawIndexedInstanced(
        PrimitiveType primitive,
        int indexCount,
        int instanceCount,
        int firstIndex = 0,
        int baseVertex = 0,
        int firstInstance = 0
    ) = 0;

    // ── Compute (WebGPU only) ────────────────────────────────────────────

    /// Check if compute shaders are supported
    virtual bool supportsCompute() const { return false; }

    /// Create a compute pipeline
    virtual ComputePipelineHandle createComputePipeline(const ShaderDesc& desc) {
        return {};
    }

    /// Destroy a compute pipeline
    virtual void destroyComputePipeline(ComputePipelineHandle handle) {}

    /// Bind a storage buffer for compute
    virtual void bindStorageBuffer(int binding, BufferHandle handle) {}

    /// Bind a storage texture for compute
    virtual void bindStorageTexture(int binding, TextureHandle handle) {}

    /// Dispatch compute work
    virtual void dispatch(
        ComputePipelineHandle pipeline,
        int groupsX,
        int groupsY = 1,
        int groupsZ = 1
    ) {}

    /// Memory barrier between compute and render
    virtual void computeBarrier() {}

    // ── Buffer Operations ────────────────────────────────────────────────

    /// Read buffer data back to CPU (async on WebGPU)
    virtual void readBuffer(
        BufferHandle handle,
        void* dest,
        size_t size,
        size_t offset = 0
    ) {}

    /// Copy data between buffers
    virtual void copyBuffer(
        BufferHandle src,
        BufferHandle dst,
        size_t size,
        size_t srcOffset = 0,
        size_t dstOffset = 0
    ) {}

    // ── Queries ──────────────────────────────────────────────────────────

    /// Get the backend type
    virtual BackendType getType() const = 0;

    /// Get backend name string
    virtual const char* getName() const = 0;

    /// Check if this is WebGPU backend
    bool isWebGPU() const { return getType() == BackendType::WebGPU; }

    /// Check if this is WebGL2 backend
    bool isWebGL2() const { return getType() == BackendType::WebGL2; }

    /// Get current canvas width
    virtual int getWidth() const = 0;

    /// Get current canvas height
    virtual int getHeight() const = 0;

    /// Get aspect ratio
    float getAspect() const {
        int h = getHeight();
        return h > 0 ? float(getWidth()) / float(h) : 1.0f;
    }
};

// ─── Factory Functions ───────────────────────────────────────────────────────

/// Create a WebGL2 backend instance
std::unique_ptr<GraphicsBackend> createWebGL2Backend();

/// Create a WebGPU backend instance
std::unique_ptr<GraphicsBackend> createWebGPUBackend();

/// Create the best available backend
std::unique_ptr<GraphicsBackend> createBestBackend();

/// Check if WebGPU is available in the current browser
bool isWebGPUAvailable();

} // namespace al

#endif // AL_WEB_GRAPHICS_BACKEND_HPP
