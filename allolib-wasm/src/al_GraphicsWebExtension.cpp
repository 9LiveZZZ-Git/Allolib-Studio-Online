/**
 * AlloLib Studio Online - Graphics Web Extension Implementation
 */

#include "al_GraphicsWebExtension.hpp"
#include "al/graphics/al_OpenGL.hpp"
#include <cstdio>
#include <cstring>

namespace al {

// Global extension instance
static GraphicsWebExtension* gGraphicsExtension = nullptr;

void setGlobalGraphicsExtension(GraphicsWebExtension* ext) {
    gGraphicsExtension = ext;
}

GraphicsWebExtension* getGlobalGraphicsExtension() {
    return gGraphicsExtension;
}

// ─── GraphicsWebExtension Implementation ─────────────────────────────────────

void GraphicsWebExtension::setBackend(GraphicsBackend* backend) {
    mBackend = backend;
    mMeshAdapter.setBackend(backend);
    mShaderManager.setBackend(backend);

    if (backend) {
        printf("[GraphicsWebExtension] Backend set: %s\n", backend->getName());
    }
}

void GraphicsWebExtension::initShaders() {
    if (!mBackend || !mBackend->isWebGPU()) return;

    // Pre-create default shaders
    mShaderManager.getShader(DefaultShader::Mesh);
    mShaderManager.getShader(DefaultShader::Color);

    // Set initial shader
    mCurrentShaderType = DefaultShader::Mesh;
    mCurrentShader = mShaderManager.getShader(DefaultShader::Mesh);

    if (mCurrentShader.valid()) {
        mBackend->useShader(mCurrentShader);
    }

    printf("[GraphicsWebExtension] Shaders initialized\n");
}

void GraphicsWebExtension::draw(const Mesh& mesh) {
    if (isWebGPUActive()) {
        drawWithBackend(mesh);
    } else if (mGraphics) {
        // Fall back to standard Graphics path
        mGraphics->draw(mesh);
    }
}

void GraphicsWebExtension::draw(VAOMesh& mesh) {
    if (isWebGPUActive()) {
        // VAOMesh wraps a Mesh, extract it
        drawWithBackend(mesh);
    } else if (mGraphics) {
        mGraphics->draw(mesh);
    }
}

void GraphicsWebExtension::clear(float r, float g, float b, float a) {
    if (isWebGPUActive()) {
        mBackend->clear(r, g, b, a);
    } else if (mGraphics) {
        mGraphics->clear(r, g, b, a);
    }
}

void GraphicsWebExtension::syncDrawState() {
    if (!mBackend) return;

    DrawState state;

    // Get depth test state from OpenGL
    state.depthTest = glIsEnabled(GL_DEPTH_TEST);
    state.depthWrite = true; // Would need to query GL_DEPTH_WRITEMASK

    // Get blend state
    state.blend = glIsEnabled(GL_BLEND) ? BlendMode::Alpha : BlendMode::None;

    // Get cull face state
    if (glIsEnabled(GL_CULL_FACE)) {
        GLint cullFaceMode;
        glGetIntegerv(GL_CULL_FACE_MODE, &cullFaceMode);
        state.cull = (cullFaceMode == GL_FRONT) ? CullFace::Front : CullFace::Back;
    } else {
        state.cull = CullFace::None;
    }

    // Point size
    state.pointSize = gl::getPointSize();

    mBackend->setDrawState(state);
}

void GraphicsWebExtension::syncMatrices() {
    if (!mBackend || !mGraphics) return;

    // Get model-view matrix
    Mat4f mv = mGraphics->viewMatrix() * mGraphics->modelMatrix();
    mBackend->setUniformMat4("modelViewMatrix", mv.elems());

    // Get projection matrix
    mBackend->setUniformMat4("projectionMatrix", mGraphics->projMatrix().elems());
}

void GraphicsWebExtension::syncColor() {
    if (!mBackend || !mGraphics) return;

    // Note: AlloLib Graphics doesn't have getter methods for tint/color,
    // so we use default white tint. The actual color comes from mesh vertex colors.
    mBackend->setUniform("tint", 1.0f, 1.0f, 1.0f, 1.0f);
    mBackend->setUniform("color", 1.0f, 1.0f, 1.0f, 1.0f);

    // Sync stereo parameters
    const Lens& lens = mGraphics->lens();
    float eyeSep = static_cast<float>(lens.eyeSep()) * mGraphics->eye() / 2.0f;
    mBackend->setUniform("eyeSep", eyeSep);
    mBackend->setUniform("focLen", static_cast<float>(lens.focalLength()));

    // Point size
    mBackend->setUniform("pointSize", gl::getPointSize());
}

void GraphicsWebExtension::selectShader() {
    if (!mBackend) return;

    // Determine shader type based on Graphics coloring mode
    DefaultShader newType = DefaultShader::Mesh;

    // Check coloring mode - would need to access Graphics internals
    // For now, default to mesh shader (per-vertex colors)
    // Future: inspect mGraphics->coloringMode() if accessible

    if (newType != mCurrentShaderType || !mCurrentShader.valid()) {
        mCurrentShaderType = newType;
        mCurrentShader = mShaderManager.getShader(newType);

        if (mCurrentShader.valid()) {
            mBackend->useShader(mCurrentShader);
        }
    }
}

void GraphicsWebExtension::drawWithBackend(const Mesh& mesh) {
    if (!mBackend || !mGraphics) return;

    // 1. Select shader based on coloring mode
    selectShader();

    // 2. Sync draw state
    syncDrawState();

    // 3. Sync matrices
    syncMatrices();

    // 4. Sync colors/uniforms
    syncColor();

    // 5. Prepare and draw mesh
    if (mMeshAdapter.prepareMesh(mesh)) {
        PrimitiveType prim = meshPrimitiveToPrimitiveType(mesh.primitive());
        mMeshAdapter.drawMesh(prim);
    }
}

} // namespace al
