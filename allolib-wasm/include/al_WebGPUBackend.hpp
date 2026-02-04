/**
 * AlloLib Studio Online - WebGPU Graphics Backend
 *
 * Implementation of GraphicsBackend for WebGPU, providing modern
 * graphics features including compute shaders.
 *
 * Features:
 *   - Modern WebGPU rendering pipeline
 *   - Compute shader support for GPU particle systems
 *   - Efficient resource binding model
 *   - Better performance for complex scenes
 *
 * Note: Requires Emscripten 3.1.73+ and browser WebGPU support.
 * Uses JavaScript-side device initialization via Module.preinitializedWebGPUDevice.
 */

#ifndef AL_WEBGPU_BACKEND_HPP
#define AL_WEBGPU_BACKEND_HPP

#include "al_WebGraphicsBackend.hpp"
#include <unordered_map>
#include <vector>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/html5.h>
#include <webgpu/webgpu.h>
#endif

namespace al {

/**
 * WebGPU Backend Implementation
 *
 * Maps the abstract GraphicsBackend interface to WebGPU calls.
 * Provides compute shader support not available in WebGL2.
 */
class WebGPUBackend : public GraphicsBackend {
public:
    WebGPUBackend();
    ~WebGPUBackend() override;

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

    // ── Compute ──────────────────────────────────────────────────────────

    bool supportsCompute() const override { return true; }

    ComputePipelineHandle createComputePipeline(const ShaderDesc& desc) override;
    void destroyComputePipeline(ComputePipelineHandle handle) override;
    void bindStorageBuffer(int binding, BufferHandle handle) override;
    void bindStorageTexture(int binding, TextureHandle handle) override;

    void dispatch(
        ComputePipelineHandle pipeline,
        int groupsX,
        int groupsY = 1,
        int groupsZ = 1
    ) override;

    void computeBarrier() override;

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

    BackendType getType() const override { return BackendType::WebGPU; }
    const char* getName() const override { return "WebGPU"; }
    int getWidth() const override { return mWidth; }
    int getHeight() const override { return mHeight; }

    // ── Lighting (Phase 2) ───────────────────────────────────────────────

    /// Enable or disable lighting
    void setLightingEnabled(bool enabled);

    /// Set light data at specified index (0-7)
    void setLight(int index, const float* pos, const float* ambient,
                  const float* diffuse, const float* specular,
                  const float* attenuation, bool enabled);

    /// Set material properties
    void setMaterial(const float* ambient, const float* diffuse,
                     const float* specular, const float* emission,
                     float shininess);

    /// Set global ambient light
    void setGlobalAmbient(float r, float g, float b, float a);

    /// Set normal matrix (inverse transpose of modelView 3x3)
    void setNormalMatrix(const float* mat3x3);

    // ── Skybox/Environment (Phase 4) ────────────────────────────────────────

    /// Set environment texture for skybox rendering
    void setEnvironmentTexture(TextureHandle handle);

    /// Set environment rendering parameters
    void setEnvironmentParams(float exposure, float gamma);

    /// Draw skybox with current environment texture
    void drawSkybox(const float* viewMatrix, const float* projMatrix);

    // ── PBR Rendering (Phase 5) ─────────────────────────────────────────────

    /// Enable or disable PBR rendering mode
    void setPBREnabled(bool enabled);

    /// Check if PBR mode is enabled
    bool isPBREnabled() const;

    /// Set PBR material properties (metallic-roughness workflow)
    void setPBRMaterial(const float* albedo, float metallic, float roughness,
                        float ao, const float* emission);

    /// Set IBL environment texture for PBR
    void setPBREnvironment(TextureHandle envMap, TextureHandle irradianceMap,
                           TextureHandle brdfLUT);

    /// Set PBR rendering parameters
    void setPBRParams(float envIntensity, float exposure, float gamma);

    /// Set inverse view rotation matrix for environment sampling
    void setPBRInvViewRotation(const float* mat3x3);

    /// Begin PBR rendering pass (binds shader and resources)
    void beginPBR(const float* cameraPos);

    /// End PBR rendering pass
    void endPBR();

    /// Draw with PBR shader (upload transforms and draw)
    /// Call after beginPBR() and setPBRMaterial()
    void drawPBR(
        const float* modelViewMatrix,
        const float* projectionMatrix,
        const float* normalMatrix,
        BufferHandle vertexBuffer,
        int vertexCount,
        PrimitiveType primitive = PrimitiveType::Triangles
    );

    /// Draw indexed with PBR shader
    void drawPBRIndexed(
        const float* modelViewMatrix,
        const float* projectionMatrix,
        const float* normalMatrix,
        BufferHandle vertexBuffer,
        BufferHandle indexBuffer,
        int indexCount,
        bool use32BitIndices = false,
        PrimitiveType primitive = PrimitiveType::Triangles
    );

#ifdef __EMSCRIPTEN__
    // ── WebGPU-specific accessors ────────────────────────────────────────

    WGPUDevice getDevice() const { return mDevice; }
    WGPUQueue getQueue() const { return mQueue; }
#endif

private:
#ifdef __EMSCRIPTEN__
    // ── Internal Resource Tracking ───────────────────────────────────────

    struct BufferResource {
        WGPUBuffer buffer = nullptr;
        BufferType type;
        BufferUsage usage;
        size_t size = 0;
    };

    struct TextureResource {
        WGPUTexture texture = nullptr;
        WGPUTextureView view = nullptr;
        WGPUSampler sampler = nullptr;
        TextureDesc desc;
    };

    struct ShaderResource {
        WGPUShaderModule vertModule = nullptr;
        WGPUShaderModule fragModule = nullptr;
        // Pipelines per primitive topology (WebGPU requires separate pipelines)
        std::unordered_map<int, WGPURenderPipeline> pipelines; // keyed by PrimitiveType
        WGPURenderPipeline defaultPipeline = nullptr; // TriangleList for fallback
        WGPUBindGroupLayout bindGroupLayout = nullptr;
        WGPUPipelineLayout pipelineLayout = nullptr;
        std::string name;
        // Uniform buffer for this shader
        WGPUBuffer uniformBuffer = nullptr;
        WGPUBindGroup bindGroup = nullptr;
    };

    struct RenderTargetResource {
        TextureHandle colorAttachment;
        TextureHandle depthAttachment;
        WGPUTextureView colorView = nullptr;
        WGPUTextureView depthView = nullptr;
        int width = 0;   // For viewport management
        int height = 0;  // For viewport management
    };

    struct ComputeResource {
        WGPUShaderModule module = nullptr;
        WGPUComputePipeline pipeline = nullptr;
        WGPUBindGroupLayout bindGroupLayout = nullptr;
        WGPUPipelineLayout pipelineLayout = nullptr;
        WGPUBindGroup bindGroup = nullptr;
    };

    // Resource maps (handle ID -> resource)
    std::unordered_map<uint64_t, BufferResource> mBuffers;
    std::unordered_map<uint64_t, TextureResource> mTextures;
    std::unordered_map<uint64_t, ShaderResource> mShaders;
    std::unordered_map<uint64_t, RenderTargetResource> mRenderTargets;
    std::unordered_map<uint64_t, ComputeResource> mComputePipelines;

    // Core WebGPU objects
    WGPUDevice mDevice = nullptr;
    WGPUQueue mQueue = nullptr;
    WGPUSwapChain mSwapChain = nullptr;
    WGPUTextureFormat mSwapChainFormat = WGPUTextureFormat_BGRA8Unorm;

    // Depth buffer
    WGPUTexture mDepthTexture = nullptr;
    WGPUTextureView mDepthTextureView = nullptr;

    // Current frame state
    WGPUTextureView mCurrentSwapChainView = nullptr;
    WGPUCommandEncoder mCommandEncoder = nullptr;
    WGPURenderPassEncoder mRenderPassEncoder = nullptr;
    WGPUComputePassEncoder mComputePassEncoder = nullptr;

    // Clear values for next render pass
    ClearValues mPendingClear;
    bool mHasPendingClear = true;

    // Current render target
    RenderTargetHandle mCurrentRenderTarget;

    // Current pipeline state
    ShaderHandle mCurrentShader;
    ShaderHandle mDefaultShader;    // Default mesh shader for fallback
    ShaderHandle mTexturedShader;   // Textured mesh shader
    ShaderHandle mLitShader;        // Lighting shader (Phase 2)

    // Lighting state (Phase 2)
    bool mLightingEnabled = false;
    WGPUBuffer mLightingUniformBuffer = nullptr;
    WGPUBindGroup mLitBindGroup = nullptr;
    bool mLightingDirty = true;

    // Skybox/Environment state (Phase 4)
    ShaderHandle mSkyboxShader;
    BufferHandle mSkyboxVertexBuffer;
    WGPUBuffer mSkyboxUniformBuffer = nullptr;
    WGPUBindGroup mSkyboxBindGroup = nullptr;
    WGPUBindGroupLayout mSkyboxBindGroupLayout = nullptr;
    WGPURenderPipeline mSkyboxPipeline = nullptr;
    TextureHandle mBoundEnvironmentTexture;
    float mEnvExposure = 1.0f;
    float mEnvGamma = 2.2f;
    bool mSkyboxBindingDirty = true;

    // PBR state (Phase 5)
    ShaderHandle mPBRShader;
    ShaderHandle mPBRFallbackShader;  // Analytical lighting fallback
    WGPUBuffer mPBRUniformBuffer = nullptr;
    WGPUBindGroup mPBRBindGroup = nullptr;
    WGPUBindGroupLayout mPBRBindGroupLayout = nullptr;
    WGPURenderPipeline mPBRPipeline = nullptr;
    WGPURenderPipeline mPBRFallbackPipeline = nullptr;
    bool mPBREnabled = false;
    bool mPBRBindingDirty = true;

    // PBR IBL textures (Phase 5)
    TextureHandle mPBREnvMap;
    TextureHandle mPBRIrradianceMap;
    TextureHandle mPBRBrdfLUT;

    // PBR material data (matches WGSL struct layout)
    struct PBRMaterialData {
        float albedo[4];      // RGB + padding
        float metallic;
        float roughness;
        float ao;
        float _pad1;
        float emission[4];    // RGB + padding
    };

    // PBR params data (matches WGSL struct layout)
    struct PBRParamsData {
        float envIntensity;
        float exposure;
        float gamma;
        float _pad;
        float invViewRot[12]; // mat3 stored as 3x vec4 for WGSL alignment
        float cameraPos[4];   // xyz + padding
    };

    PBRMaterialData mPBRMaterial;
    PBRParamsData mPBRParams;

    // Lighting data storage (matches WGSL struct layout)
    struct LightData {
        float position[4];    // w=0 for directional, w=1 for point
        float ambient[4];
        float diffuse[4];
        float specular[4];
        float attenuation[3]; // constant, linear, quadratic
        float enabled;        // 1.0 = enabled, 0.0 = disabled
    };

    struct MaterialData {
        float ambient[4];
        float diffuse[4];
        float specular[4];
        float emission[4];
        float shininess;
        float _pad[3];
    };

    float mGlobalAmbient[4] = {0.1f, 0.1f, 0.1f, 1.0f};
    uint32_t mNumLights = 1;
    LightData mLights[8];
    MaterialData mMaterial;
    float mNormalMatrix[16];  // Stored as 4x4 for WGSL padding
    BufferHandle mCurrentVertexBuffer;
    BufferHandle mCurrentIndexBuffer;
    bool mIndexBuffer32Bit = false;
    VertexLayout mCurrentVertexLayout;

    // Texture state
    TextureHandle mBoundTextures[8];  // Up to 8 texture units
    int mActiveTextureUnit = 0;
    bool mTextureBindingDirty = false;
    WGPUBindGroup mTexturedBindGroup = nullptr;  // Bind group with texture

    // Pending uniform data (accumulated before draw)
    std::vector<uint8_t> mUniformData;
    bool mUniformsDirty = false;

    // Dynamic uniform buffer for multiple draw calls per frame
    // WebGPU requires 256-byte alignment for dynamic offsets
    static constexpr size_t kUniformAlignment = 256;
    static constexpr size_t kMaxDrawsPerFrame = 256;
    WGPUBuffer mUniformRingBuffer = nullptr;
    WGPUBindGroup mDynamicBindGroup = nullptr;
    WGPUBindGroupLayout mDynamicBindGroupLayout = nullptr;
    size_t mUniformRingOffset = 0;
    uint32_t mCurrentDynamicOffset = 0;

    // Viewport state
    int mViewportX = 0, mViewportY = 0;
    int mViewportW = 0, mViewportH = 0;

    // Draw state
    DrawState mCurrentDrawState;
    bool mDrawStateDirty = true;

#endif // __EMSCRIPTEN__

    // Handle generation
    uint64_t mNextHandleId = 1;
    uint64_t generateHandleId() { return mNextHandleId++; }

    // Dimensions
    int mWidth = 0;
    int mHeight = 0;

#ifdef __EMSCRIPTEN__
    // ── Helper Methods ───────────────────────────────────────────────────

    void createSwapChain();
    void createDepthBuffer();
    void createDefaultShader();
    void createTexturedShader();
    void createLightingShader();     // Phase 2: Lighting
    void createSkyboxShader();       // Phase 4: Skybox
    void createSkyboxMesh();         // Phase 4: Skybox
    void createPBRShader();          // Phase 5: PBR
    void createPBRFallbackShader();  // Phase 5: PBR fallback
    void updateTexturedBindGroup();
    void updateLightingBindGroup();  // Phase 2: Lighting
    void updateSkyboxBindGroup();    // Phase 4: Skybox
    void updatePBRBindGroup();       // Phase 5: PBR
    void beginRenderPass();
    void endRenderPass();
    void flushUniforms();

    // Get or create pipeline for a specific primitive type
    WGPURenderPipeline getPipelineForPrimitive(ShaderResource& shader, PrimitiveType primitive);
    WGPURenderPipeline createPipelineForPrimitive(ShaderResource& shader, PrimitiveType primitive);

    WGPUBufferUsageFlags toWGPUBufferUsage(BufferType type, BufferUsage usage);
    WGPUTextureFormat toWGPUFormat(PixelFormat format);
    WGPUPrimitiveTopology toWGPUPrimitive(PrimitiveType type);
    WGPUAddressMode toWGPUAddressMode(WrapMode mode);
    WGPUFilterMode toWGPUFilterMode(FilterMode mode);
    WGPUCompareFunction toWGPUCompareFunc(DepthFunc func);
    WGPUCullMode toWGPUCullMode(CullFace face);
    WGPUBlendFactor toWGPUBlendFactor(BlendMode mode, bool isSrc);
#endif
};

// ─── Factory Functions ───────────────────────────────────────────────────────

inline std::unique_ptr<GraphicsBackend> createWebGPUBackend() {
    return std::make_unique<WebGPUBackend>();
}

/// Check if WebGPU is available
#ifdef __EMSCRIPTEN__
inline bool isWebGPUAvailable() {
    // Check if Module.preinitializedWebGPUDevice exists
    return EM_ASM_INT({
        return (typeof Module !== 'undefined' &&
                Module.preinitializedWebGPUDevice !== undefined) ? 1 : 0;
    }) != 0;
}
#else
inline bool isWebGPUAvailable() {
    return false;
}
#endif

// Forward declaration for WebGL2 fallback (if available)
#if defined(ALLOLIB_WEBGL2)
std::unique_ptr<GraphicsBackend> createWebGL2Backend();
#endif

/// Create the best available backend
inline std::unique_ptr<GraphicsBackend> createBestBackend() {
    if (isWebGPUAvailable()) {
        return createWebGPUBackend();
    }
#if defined(ALLOLIB_WEBGL2)
    return createWebGL2Backend();
#else
    // No fallback available - WebGPU is required
    return nullptr;
#endif
}

} // namespace al

#endif // AL_WEBGPU_BACKEND_HPP
