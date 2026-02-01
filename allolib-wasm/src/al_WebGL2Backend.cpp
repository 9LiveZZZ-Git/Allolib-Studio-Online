/**
 * AlloLib Studio Online - WebGL2 Graphics Backend Implementation
 *
 * Maps the abstract GraphicsBackend interface to WebGL2/OpenGL ES 3.0 calls.
 */

#include "al_WebGL2Backend.hpp"
#include <cstring>
#include <cstdio>

namespace al {

// ─── Constructor / Destructor ────────────────────────────────────────────────

WebGL2Backend::WebGL2Backend() = default;

WebGL2Backend::~WebGL2Backend() {
    shutdown();
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

bool WebGL2Backend::init(int width, int height) {
    mWidth = width;
    mHeight = height;

    // Create a VAO for vertex attribute management
    glGenVertexArrays(1, &mVao);
    glBindVertexArray(mVao);

    // Set default state
    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LESS);
    glEnable(GL_CULL_FACE);
    glCullFace(GL_BACK);

    printf("[WebGL2Backend] Initialized %dx%d\n", width, height);
    return true;
}

void WebGL2Backend::shutdown() {
    // Destroy all resources
    for (auto& [id, buf] : mBuffers) {
        if (buf.glId) glDeleteBuffers(1, &buf.glId);
    }
    mBuffers.clear();

    for (auto& [id, tex] : mTextures) {
        if (tex.glId) glDeleteTextures(1, &tex.glId);
    }
    mTextures.clear();

    for (auto& [id, shader] : mShaders) {
        if (shader.glProgram) glDeleteProgram(shader.glProgram);
    }
    mShaders.clear();

    for (auto& [id, rt] : mRenderTargets) {
        if (rt.glFbo) glDeleteFramebuffers(1, &rt.glFbo);
    }
    mRenderTargets.clear();

    if (mVao) {
        glDeleteVertexArrays(1, &mVao);
        mVao = 0;
    }

    mNextHandleId = 1;
    mCurrentShader = {};
}

void WebGL2Backend::resize(int width, int height) {
    mWidth = width;
    mHeight = height;
    glViewport(0, 0, width, height);
}

void WebGL2Backend::beginFrame() {
    glBindVertexArray(mVao);
}

void WebGL2Backend::endFrame() {
    // WebGL2 doesn't need explicit present - handled by browser
}

// ─── Render State ────────────────────────────────────────────────────────────

void WebGL2Backend::clear(const ClearValues& values) {
    GLbitfield mask = 0;

    if (values.clearColor) {
        glClearColor(values.r, values.g, values.b, values.a);
        mask |= GL_COLOR_BUFFER_BIT;
    }

    if (values.clearDepth) {
        glClearDepthf(values.depth);
        mask |= GL_DEPTH_BUFFER_BIT;
    }

    if (values.clearStencil) {
        glClearStencil(values.stencil);
        mask |= GL_STENCIL_BUFFER_BIT;
    }

    if (mask) {
        glClear(mask);
    }
}

void WebGL2Backend::viewport(int x, int y, int w, int h) {
    glViewport(x, y, w, h);
}

void WebGL2Backend::setDrawState(const DrawState& state) {
    // Blending
    if (state.blend == BlendMode::None) {
        glDisable(GL_BLEND);
    } else {
        glEnable(GL_BLEND);
        GLenum srcFactor = toGLBlendFactor(state.blend, true);
        GLenum dstFactor = toGLBlendFactor(state.blend, false);
        glBlendFunc(srcFactor, dstFactor);
    }

    // Culling
    if (state.cull == CullFace::None) {
        glDisable(GL_CULL_FACE);
    } else {
        glEnable(GL_CULL_FACE);
        glCullFace(toGLCullFace(state.cull));
    }

    // Depth test
    if (state.depthTest) {
        glEnable(GL_DEPTH_TEST);
        glDepthFunc(toGLDepthFunc(state.depth));
    } else {
        glDisable(GL_DEPTH_TEST);
    }

    // Depth write
    glDepthMask(state.depthWrite ? GL_TRUE : GL_FALSE);

    // Scissor
    if (state.scissorTest) {
        glEnable(GL_SCISSOR_TEST);
        glScissor(state.scissorX, state.scissorY, state.scissorW, state.scissorH);
    } else {
        glDisable(GL_SCISSOR_TEST);
    }

    // Line width (may be clamped by implementation)
    glLineWidth(state.lineWidth);
}

// ─── Buffers ─────────────────────────────────────────────────────────────────

BufferHandle WebGL2Backend::createBuffer(
    BufferType type,
    BufferUsage usage,
    const void* data,
    size_t size
) {
    BufferResource resource;
    resource.type = type;
    resource.usage = usage;
    resource.size = size;

    glGenBuffers(1, &resource.glId);

    GLenum target = toGLBufferType(type);
    GLenum glUsage = toGLBufferUsage(usage);

    glBindBuffer(target, resource.glId);
    glBufferData(target, size, data, glUsage);
    glBindBuffer(target, 0);

    uint64_t id = generateHandleId();
    mBuffers[id] = resource;

    return BufferHandle{id};
}

void WebGL2Backend::updateBuffer(
    BufferHandle handle,
    const void* data,
    size_t size,
    size_t offset
) {
    auto it = mBuffers.find(handle.id);
    if (it == mBuffers.end()) return;

    GLenum target = toGLBufferType(it->second.type);
    glBindBuffer(target, it->second.glId);
    glBufferSubData(target, offset, size, data);
    glBindBuffer(target, 0);
}

void WebGL2Backend::destroyBuffer(BufferHandle handle) {
    auto it = mBuffers.find(handle.id);
    if (it == mBuffers.end()) return;

    if (it->second.glId) {
        glDeleteBuffers(1, &it->second.glId);
    }
    mBuffers.erase(it);
}

// ─── Textures ────────────────────────────────────────────────────────────────

TextureHandle WebGL2Backend::createTexture(
    const TextureDesc& desc,
    const void* data
) {
    TextureResource resource;
    resource.desc = desc;

    glGenTextures(1, &resource.glId);

    GLenum target = GL_TEXTURE_2D;
    if (desc.depth > 1) target = GL_TEXTURE_3D;
    if (desc.samples > 1) target = GL_TEXTURE_2D_MULTISAMPLE;

    glBindTexture(target, resource.glId);

    // Set filtering
    if (target != GL_TEXTURE_2D_MULTISAMPLE) {
        glTexParameteri(target, GL_TEXTURE_MIN_FILTER, toGLFilter(desc.minFilter, true));
        glTexParameteri(target, GL_TEXTURE_MAG_FILTER, toGLFilter(desc.magFilter, false));
        glTexParameteri(target, GL_TEXTURE_WRAP_S, toGLWrap(desc.wrapS));
        glTexParameteri(target, GL_TEXTURE_WRAP_T, toGLWrap(desc.wrapT));
        if (desc.depth > 1) {
            glTexParameteri(target, GL_TEXTURE_WRAP_R, toGLWrap(desc.wrapR));
        }
    }

    GLenum internalFormat = toGLInternalFormat(desc.format);
    GLenum pixelFormat = toGLPixelFormat(desc.format);
    GLenum pixelType = toGLPixelType(desc.format);

    if (target == GL_TEXTURE_2D) {
        glTexImage2D(target, 0, internalFormat, desc.width, desc.height, 0,
                     pixelFormat, pixelType, data);
    } else if (target == GL_TEXTURE_3D) {
        glTexImage3D(target, 0, internalFormat, desc.width, desc.height, desc.depth,
                     0, pixelFormat, pixelType, data);
    } else if (target == GL_TEXTURE_2D_MULTISAMPLE) {
        glTexStorage2DMultisample(target, desc.samples, internalFormat,
                                   desc.width, desc.height, GL_TRUE);
    }

    if (desc.mipmaps && target == GL_TEXTURE_2D) {
        glGenerateMipmap(target);
    }

    glBindTexture(target, 0);

    uint64_t id = generateHandleId();
    mTextures[id] = resource;

    return TextureHandle{id};
}

void WebGL2Backend::updateTexture(
    TextureHandle handle,
    const void* data,
    int level,
    int x, int y,
    int w, int h
) {
    auto it = mTextures.find(handle.id);
    if (it == mTextures.end()) return;

    const auto& desc = it->second.desc;
    GLenum target = GL_TEXTURE_2D;
    if (desc.depth > 1) target = GL_TEXTURE_3D;

    int width = (w < 0) ? desc.width : w;
    int height = (h < 0) ? desc.height : h;

    glBindTexture(target, it->second.glId);

    GLenum pixelFormat = toGLPixelFormat(desc.format);
    GLenum pixelType = toGLPixelType(desc.format);

    glTexSubImage2D(target, level, x, y, width, height, pixelFormat, pixelType, data);

    glBindTexture(target, 0);
}

void WebGL2Backend::generateMipmaps(TextureHandle handle) {
    auto it = mTextures.find(handle.id);
    if (it == mTextures.end()) return;

    GLenum target = GL_TEXTURE_2D;
    glBindTexture(target, it->second.glId);
    glGenerateMipmap(target);
    glBindTexture(target, 0);
}

void WebGL2Backend::destroyTexture(TextureHandle handle) {
    auto it = mTextures.find(handle.id);
    if (it == mTextures.end()) return;

    if (it->second.glId) {
        glDeleteTextures(1, &it->second.glId);
    }
    mTextures.erase(it);
}

// ─── Render Targets ──────────────────────────────────────────────────────────

RenderTargetHandle WebGL2Backend::createRenderTarget(
    TextureHandle color,
    TextureHandle depth
) {
    RenderTargetResource resource;
    resource.colorAttachment = color;
    resource.depthAttachment = depth;

    glGenFramebuffers(1, &resource.glFbo);
    glBindFramebuffer(GL_FRAMEBUFFER, resource.glFbo);

    // Attach color texture
    if (color.valid()) {
        auto it = mTextures.find(color.id);
        if (it != mTextures.end()) {
            glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0,
                                    GL_TEXTURE_2D, it->second.glId, 0);
        }
    }

    // Attach depth texture
    if (depth.valid()) {
        auto it = mTextures.find(depth.id);
        if (it != mTextures.end()) {
            GLenum attachment = GL_DEPTH_ATTACHMENT;
            if (it->second.desc.format == PixelFormat::Depth24Stencil8) {
                attachment = GL_DEPTH_STENCIL_ATTACHMENT;
            }
            glFramebufferTexture2D(GL_FRAMEBUFFER, attachment,
                                    GL_TEXTURE_2D, it->second.glId, 0);
        }
    }

    // Check completeness
    GLenum status = glCheckFramebufferStatus(GL_FRAMEBUFFER);
    if (status != GL_FRAMEBUFFER_COMPLETE) {
        printf("[WebGL2Backend] Framebuffer incomplete: 0x%x\n", status);
    }

    glBindFramebuffer(GL_FRAMEBUFFER, 0);

    uint64_t id = generateHandleId();
    mRenderTargets[id] = resource;

    return RenderTargetHandle{id};
}

void WebGL2Backend::bindRenderTarget(RenderTargetHandle handle) {
    if (!handle.valid()) {
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glViewport(0, 0, mWidth, mHeight);
        return;
    }

    auto it = mRenderTargets.find(handle.id);
    if (it == mRenderTargets.end()) return;

    glBindFramebuffer(GL_FRAMEBUFFER, it->second.glFbo);

    // Set viewport to render target size
    if (it->second.colorAttachment.valid()) {
        auto texIt = mTextures.find(it->second.colorAttachment.id);
        if (texIt != mTextures.end()) {
            glViewport(0, 0, texIt->second.desc.width, texIt->second.desc.height);
        }
    }
}

void WebGL2Backend::destroyRenderTarget(RenderTargetHandle handle) {
    auto it = mRenderTargets.find(handle.id);
    if (it == mRenderTargets.end()) return;

    if (it->second.glFbo) {
        glDeleteFramebuffers(1, &it->second.glFbo);
    }
    mRenderTargets.erase(it);
}

// ─── Shaders ─────────────────────────────────────────────────────────────────

ShaderHandle WebGL2Backend::createShader(const ShaderDesc& desc) {
    ShaderResource resource;
    resource.name = desc.name;

    // Create program
    resource.glProgram = glCreateProgram();

    // Compile vertex shader
    if (!desc.vertexSource.empty()) {
        GLuint vs = glCreateShader(GL_VERTEX_SHADER);
        if (!compileShader(vs, desc.vertexSource.c_str())) {
            glDeleteShader(vs);
            glDeleteProgram(resource.glProgram);
            return {};
        }
        glAttachShader(resource.glProgram, vs);
        glDeleteShader(vs);
    }

    // Compile fragment shader
    if (!desc.fragmentSource.empty()) {
        GLuint fs = glCreateShader(GL_FRAGMENT_SHADER);
        if (!compileShader(fs, desc.fragmentSource.c_str())) {
            glDeleteShader(fs);
            glDeleteProgram(resource.glProgram);
            return {};
        }
        glAttachShader(resource.glProgram, fs);
        glDeleteShader(fs);
    }

    // Link program
    if (!linkProgram(resource.glProgram)) {
        glDeleteProgram(resource.glProgram);
        return {};
    }

    uint64_t id = generateHandleId();
    mShaders[id] = resource;

    printf("[WebGL2Backend] Created shader '%s'\n", desc.name.c_str());
    return ShaderHandle{id};
}

void WebGL2Backend::destroyShader(ShaderHandle handle) {
    auto it = mShaders.find(handle.id);
    if (it == mShaders.end()) return;

    if (it->second.glProgram) {
        glDeleteProgram(it->second.glProgram);
    }
    mShaders.erase(it);
}

void WebGL2Backend::useShader(ShaderHandle handle) {
    if (!handle.valid()) {
        glUseProgram(0);
        mCurrentShader = {};
        return;
    }

    auto it = mShaders.find(handle.id);
    if (it == mShaders.end()) return;

    glUseProgram(it->second.glProgram);
    mCurrentShader = handle;
}

// ─── Uniforms ────────────────────────────────────────────────────────────────

GLint WebGL2Backend::getUniformLocation(const char* name) {
    if (!mCurrentShader.valid()) return -1;

    auto it = mShaders.find(mCurrentShader.id);
    if (it == mShaders.end()) return -1;

    // Check cache
    auto& cache = it->second.uniformCache;
    auto cacheIt = cache.find(name);
    if (cacheIt != cache.end()) {
        return cacheIt->second;
    }

    // Query and cache
    GLint loc = glGetUniformLocation(it->second.glProgram, name);
    cache[name] = loc;
    return loc;
}

void WebGL2Backend::setUniform(const char* name, int value) {
    GLint loc = getUniformLocation(name);
    if (loc >= 0) glUniform1i(loc, value);
}

void WebGL2Backend::setUniform(const char* name, float value) {
    GLint loc = getUniformLocation(name);
    if (loc >= 0) glUniform1f(loc, value);
}

void WebGL2Backend::setUniform(const char* name, float x, float y) {
    GLint loc = getUniformLocation(name);
    if (loc >= 0) glUniform2f(loc, x, y);
}

void WebGL2Backend::setUniform(const char* name, float x, float y, float z) {
    GLint loc = getUniformLocation(name);
    if (loc >= 0) glUniform3f(loc, x, y, z);
}

void WebGL2Backend::setUniform(const char* name, float x, float y, float z, float w) {
    GLint loc = getUniformLocation(name);
    if (loc >= 0) glUniform4f(loc, x, y, z, w);
}

void WebGL2Backend::setUniformMat4(const char* name, const float* value) {
    GLint loc = getUniformLocation(name);
    if (loc >= 0) glUniformMatrix4fv(loc, 1, GL_FALSE, value);
}

void WebGL2Backend::setUniformMat3(const char* name, const float* value) {
    GLint loc = getUniformLocation(name);
    if (loc >= 0) glUniformMatrix3fv(loc, 1, GL_FALSE, value);
}

void WebGL2Backend::setTexture(const char* name, TextureHandle handle, int unit) {
    auto it = mTextures.find(handle.id);
    if (it == mTextures.end()) return;

    glActiveTexture(GL_TEXTURE0 + unit);

    GLenum target = GL_TEXTURE_2D;
    if (it->second.desc.depth > 1) target = GL_TEXTURE_3D;

    glBindTexture(target, it->second.glId);
    setUniform(name, unit);
}

void WebGL2Backend::setUniformBuffer(int binding, BufferHandle handle) {
    auto it = mBuffers.find(handle.id);
    if (it == mBuffers.end()) return;

    glBindBufferBase(GL_UNIFORM_BUFFER, binding, it->second.glId);
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

void WebGL2Backend::setVertexBuffer(BufferHandle handle, const VertexLayout& layout) {
    auto it = mBuffers.find(handle.id);
    if (it == mBuffers.end()) return;

    glBindBuffer(GL_ARRAY_BUFFER, it->second.glId);

    for (const auto& attr : layout.attributes) {
        glEnableVertexAttribArray(attr.location);
        glVertexAttribPointer(
            attr.location,
            attr.components,
            GL_FLOAT,
            attr.normalized ? GL_TRUE : GL_FALSE,
            layout.stride,
            reinterpret_cast<const void*>(static_cast<intptr_t>(attr.offset))
        );
    }
}

void WebGL2Backend::setIndexBuffer(BufferHandle handle, bool use32Bit) {
    auto it = mBuffers.find(handle.id);
    if (it == mBuffers.end()) return;

    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, it->second.glId);
    mIndexBuffer32Bit = use32Bit;
}

void WebGL2Backend::draw(
    PrimitiveType primitive,
    int vertexCount,
    int firstVertex
) {
    glDrawArrays(toGLPrimitive(primitive), firstVertex, vertexCount);
}

void WebGL2Backend::drawIndexed(
    PrimitiveType primitive,
    int indexCount,
    int firstIndex,
    int baseVertex
) {
    GLenum indexType = mIndexBuffer32Bit ? GL_UNSIGNED_INT : GL_UNSIGNED_SHORT;
    size_t indexSize = mIndexBuffer32Bit ? 4 : 2;

    if (baseVertex != 0) {
        glDrawElementsBaseVertex(
            toGLPrimitive(primitive),
            indexCount,
            indexType,
            reinterpret_cast<const void*>(firstIndex * indexSize),
            baseVertex
        );
    } else {
        glDrawElements(
            toGLPrimitive(primitive),
            indexCount,
            indexType,
            reinterpret_cast<const void*>(firstIndex * indexSize)
        );
    }
}

void WebGL2Backend::drawInstanced(
    PrimitiveType primitive,
    int vertexCount,
    int instanceCount,
    int firstVertex,
    int firstInstance
) {
    // Note: firstInstance requires GL_ARB_base_instance, not available in ES 3.0
    (void)firstInstance;
    glDrawArraysInstanced(toGLPrimitive(primitive), firstVertex, vertexCount, instanceCount);
}

void WebGL2Backend::drawIndexedInstanced(
    PrimitiveType primitive,
    int indexCount,
    int instanceCount,
    int firstIndex,
    int baseVertex,
    int firstInstance
) {
    (void)firstInstance;
    GLenum indexType = mIndexBuffer32Bit ? GL_UNSIGNED_INT : GL_UNSIGNED_SHORT;
    size_t indexSize = mIndexBuffer32Bit ? 4 : 2;

    if (baseVertex != 0) {
        glDrawElementsInstancedBaseVertex(
            toGLPrimitive(primitive),
            indexCount,
            indexType,
            reinterpret_cast<const void*>(firstIndex * indexSize),
            instanceCount,
            baseVertex
        );
    } else {
        glDrawElementsInstanced(
            toGLPrimitive(primitive),
            indexCount,
            indexType,
            reinterpret_cast<const void*>(firstIndex * indexSize),
            instanceCount
        );
    }
}

// ─── Buffer Operations ───────────────────────────────────────────────────────

void WebGL2Backend::readBuffer(
    BufferHandle handle,
    void* dest,
    size_t size,
    size_t offset
) {
    auto it = mBuffers.find(handle.id);
    if (it == mBuffers.end()) return;

    GLenum target = toGLBufferType(it->second.type);
    glBindBuffer(target, it->second.glId);

    // Map buffer and copy
    void* mapped = glMapBufferRange(target, offset, size, GL_MAP_READ_BIT);
    if (mapped) {
        memcpy(dest, mapped, size);
        glUnmapBuffer(target);
    }

    glBindBuffer(target, 0);
}

void WebGL2Backend::copyBuffer(
    BufferHandle src,
    BufferHandle dst,
    size_t size,
    size_t srcOffset,
    size_t dstOffset
) {
    auto srcIt = mBuffers.find(src.id);
    auto dstIt = mBuffers.find(dst.id);
    if (srcIt == mBuffers.end() || dstIt == mBuffers.end()) return;

    glBindBuffer(GL_COPY_READ_BUFFER, srcIt->second.glId);
    glBindBuffer(GL_COPY_WRITE_BUFFER, dstIt->second.glId);
    glCopyBufferSubData(GL_COPY_READ_BUFFER, GL_COPY_WRITE_BUFFER,
                        srcOffset, dstOffset, size);
    glBindBuffer(GL_COPY_READ_BUFFER, 0);
    glBindBuffer(GL_COPY_WRITE_BUFFER, 0);
}

// ─── Helper Methods ──────────────────────────────────────────────────────────

GLenum WebGL2Backend::toGLBufferType(BufferType type) {
    switch (type) {
        case BufferType::Vertex:  return GL_ARRAY_BUFFER;
        case BufferType::Index:   return GL_ELEMENT_ARRAY_BUFFER;
        case BufferType::Uniform: return GL_UNIFORM_BUFFER;
        case BufferType::Storage: return GL_SHADER_STORAGE_BUFFER;
        default: return GL_ARRAY_BUFFER;
    }
}

GLenum WebGL2Backend::toGLBufferUsage(BufferUsage usage) {
    switch (usage) {
        case BufferUsage::Static:  return GL_STATIC_DRAW;
        case BufferUsage::Dynamic: return GL_DYNAMIC_DRAW;
        case BufferUsage::Stream:  return GL_STREAM_DRAW;
        default: return GL_STATIC_DRAW;
    }
}

GLenum WebGL2Backend::toGLPixelFormat(PixelFormat format) {
    switch (format) {
        case PixelFormat::R8:
        case PixelFormat::R16F:
        case PixelFormat::R32F:
            return GL_RED;
        case PixelFormat::RG8:
        case PixelFormat::RG16F:
        case PixelFormat::RG32F:
            return GL_RG;
        case PixelFormat::RGB8:
            return GL_RGB;
        case PixelFormat::RGBA8:
        case PixelFormat::RGBA16F:
        case PixelFormat::RGBA32F:
            return GL_RGBA;
        case PixelFormat::Depth16:
        case PixelFormat::Depth24:
        case PixelFormat::Depth32F:
            return GL_DEPTH_COMPONENT;
        case PixelFormat::Depth24Stencil8:
            return GL_DEPTH_STENCIL;
        default:
            return GL_RGBA;
    }
}

GLenum WebGL2Backend::toGLInternalFormat(PixelFormat format) {
    switch (format) {
        case PixelFormat::R8:           return GL_R8;
        case PixelFormat::RG8:          return GL_RG8;
        case PixelFormat::RGB8:         return GL_RGB8;
        case PixelFormat::RGBA8:        return GL_RGBA8;
        case PixelFormat::R16F:         return GL_R16F;
        case PixelFormat::RG16F:        return GL_RG16F;
        case PixelFormat::RGBA16F:      return GL_RGBA16F;
        case PixelFormat::R32F:         return GL_R32F;
        case PixelFormat::RG32F:        return GL_RG32F;
        case PixelFormat::RGBA32F:      return GL_RGBA32F;
        case PixelFormat::Depth16:      return GL_DEPTH_COMPONENT16;
        case PixelFormat::Depth24:      return GL_DEPTH_COMPONENT24;
        case PixelFormat::Depth32F:     return GL_DEPTH_COMPONENT32F;
        case PixelFormat::Depth24Stencil8: return GL_DEPTH24_STENCIL8;
        default: return GL_RGBA8;
    }
}

GLenum WebGL2Backend::toGLPixelType(PixelFormat format) {
    switch (format) {
        case PixelFormat::R8:
        case PixelFormat::RG8:
        case PixelFormat::RGB8:
        case PixelFormat::RGBA8:
            return GL_UNSIGNED_BYTE;
        case PixelFormat::R16F:
        case PixelFormat::RG16F:
        case PixelFormat::RGBA16F:
            return GL_HALF_FLOAT;
        case PixelFormat::R32F:
        case PixelFormat::RG32F:
        case PixelFormat::RGBA32F:
        case PixelFormat::Depth32F:
            return GL_FLOAT;
        case PixelFormat::Depth16:
            return GL_UNSIGNED_SHORT;
        case PixelFormat::Depth24:
            return GL_UNSIGNED_INT;
        case PixelFormat::Depth24Stencil8:
            return GL_UNSIGNED_INT_24_8;
        default:
            return GL_UNSIGNED_BYTE;
    }
}

GLenum WebGL2Backend::toGLPrimitive(PrimitiveType type) {
    switch (type) {
        case PrimitiveType::Points:        return GL_POINTS;
        case PrimitiveType::Lines:         return GL_LINES;
        case PrimitiveType::LineStrip:     return GL_LINE_STRIP;
        case PrimitiveType::LineLoop:      return GL_LINE_LOOP;
        case PrimitiveType::Triangles:     return GL_TRIANGLES;
        case PrimitiveType::TriangleStrip: return GL_TRIANGLE_STRIP;
        case PrimitiveType::TriangleFan:   return GL_TRIANGLE_FAN;
        default: return GL_TRIANGLES;
    }
}

GLenum WebGL2Backend::toGLBlendFactor(BlendMode mode, bool isSrc) {
    switch (mode) {
        case BlendMode::Alpha:
            return isSrc ? GL_SRC_ALPHA : GL_ONE_MINUS_SRC_ALPHA;
        case BlendMode::Additive:
            return isSrc ? GL_SRC_ALPHA : GL_ONE;
        case BlendMode::Multiply:
            return isSrc ? GL_DST_COLOR : GL_ZERO;
        case BlendMode::PreMultiplied:
            return isSrc ? GL_ONE : GL_ONE_MINUS_SRC_ALPHA;
        default:
            return isSrc ? GL_ONE : GL_ZERO;
    }
}

GLenum WebGL2Backend::toGLCullFace(CullFace face) {
    switch (face) {
        case CullFace::Front: return GL_FRONT;
        case CullFace::Back:  return GL_BACK;
        default: return GL_BACK;
    }
}

GLenum WebGL2Backend::toGLDepthFunc(DepthFunc func) {
    switch (func) {
        case DepthFunc::Never:        return GL_NEVER;
        case DepthFunc::Less:         return GL_LESS;
        case DepthFunc::LessEqual:    return GL_LEQUAL;
        case DepthFunc::Equal:        return GL_EQUAL;
        case DepthFunc::Greater:      return GL_GREATER;
        case DepthFunc::GreaterEqual: return GL_GEQUAL;
        case DepthFunc::NotEqual:     return GL_NOTEQUAL;
        case DepthFunc::Always:       return GL_ALWAYS;
        default: return GL_LESS;
    }
}

GLenum WebGL2Backend::toGLFilter(FilterMode mode, bool minFilter) {
    switch (mode) {
        case FilterMode::Nearest:
            return GL_NEAREST;
        case FilterMode::Linear:
            return GL_LINEAR;
        case FilterMode::Trilinear:
            return minFilter ? GL_LINEAR_MIPMAP_LINEAR : GL_LINEAR;
        default:
            return GL_LINEAR;
    }
}

GLenum WebGL2Backend::toGLWrap(WrapMode mode) {
    switch (mode) {
        case WrapMode::Repeat:         return GL_REPEAT;
        case WrapMode::MirroredRepeat: return GL_MIRRORED_REPEAT;
        case WrapMode::ClampToEdge:    return GL_CLAMP_TO_EDGE;
        case WrapMode::ClampToBorder:  return GL_CLAMP_TO_EDGE; // Not in ES 3.0
        default: return GL_CLAMP_TO_EDGE;
    }
}

bool WebGL2Backend::compileShader(GLuint shader, const char* source) {
    glShaderSource(shader, 1, &source, nullptr);
    glCompileShader(shader);

    GLint success;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &success);
    if (!success) {
        char log[512];
        glGetShaderInfoLog(shader, sizeof(log), nullptr, log);
        printf("[WebGL2Backend] Shader compile error: %s\n", log);
        return false;
    }
    return true;
}

bool WebGL2Backend::linkProgram(GLuint program) {
    glLinkProgram(program);

    GLint success;
    glGetProgramiv(program, GL_LINK_STATUS, &success);
    if (!success) {
        char log[512];
        glGetProgramInfoLog(program, sizeof(log), nullptr, log);
        printf("[WebGL2Backend] Program link error: %s\n", log);
        return false;
    }
    return true;
}

} // namespace al
