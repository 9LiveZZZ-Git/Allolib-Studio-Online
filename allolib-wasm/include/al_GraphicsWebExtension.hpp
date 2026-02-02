/**
 * AlloLib Studio Online - Graphics Web Extension
 *
 * Provides backend-aware drawing for al::Graphics.
 * Routes draw calls through WebGPU backend when active.
 *
 * This extension works alongside the existing Graphics class
 * without modifying it, using a wrapper pattern.
 */

#ifndef AL_GRAPHICS_WEB_EXTENSION_HPP
#define AL_GRAPHICS_WEB_EXTENSION_HPP

#include "al/graphics/al_Graphics.hpp"
#include "al_WebGraphicsBackend.hpp"
#include "al_WebMeshAdapter.hpp"
#include "al_WebShaders.hpp"

namespace al {

/**
 * GraphicsWebExtension - Backend-aware Graphics wrapper
 *
 * Wraps an al::Graphics object and routes draw calls through
 * the WebGPU backend when active. Falls back to standard
 * Graphics methods for WebGL2.
 */
class GraphicsWebExtension {
public:
    GraphicsWebExtension() = default;
    ~GraphicsWebExtension() = default;

    /**
     * Set the Graphics object to extend
     */
    void setGraphics(Graphics* g) { mGraphics = g; }
    Graphics* graphics() const { return mGraphics; }

    /**
     * Set the backend to use for rendering
     * Pass nullptr to disable backend routing
     */
    void setBackend(GraphicsBackend* backend);
    GraphicsBackend* backend() const { return mBackend; }

    /**
     * Check if WebGPU backend is active
     */
    bool isWebGPUActive() const {
        return mBackend && mBackend->isWebGPU();
    }

    /**
     * Initialize WebGPU shaders (call after backend is set)
     */
    void initShaders();

    /**
     * Draw a mesh using the appropriate path
     * - WebGPU: Routes through backend
     * - WebGL2: Uses standard Graphics::draw()
     */
    void draw(const Mesh& mesh);

    /**
     * Draw a VAOMesh using the appropriate path
     */
    void draw(VAOMesh& mesh);

    /**
     * Clear the screen
     */
    void clear(float r, float g, float b, float a = 1.0f);

    /**
     * Sync draw state from Graphics to Backend
     */
    void syncDrawState();

    /**
     * Sync matrices from Graphics to Backend
     */
    void syncMatrices();

    /**
     * Sync color/tint from Graphics to Backend
     */
    void syncColor();

    /**
     * Get the mesh adapter
     */
    WebMeshAdapter& meshAdapter() { return mMeshAdapter; }

    /**
     * Get the shader manager
     */
    WebShaderManager& shaderManager() { return mShaderManager; }

private:
    Graphics* mGraphics = nullptr;
    GraphicsBackend* mBackend = nullptr;
    WebMeshAdapter mMeshAdapter;
    WebShaderManager mShaderManager;

    ShaderHandle mCurrentShader;
    DefaultShader mCurrentShaderType = DefaultShader::Mesh;

    /**
     * Draw mesh through WebGPU backend
     */
    void drawWithBackend(const Mesh& mesh);

    /**
     * Select appropriate shader based on Graphics coloring mode
     */
    void selectShader();
};

// ─── Global Extension Access ─────────────────────────────────────────────────

/**
 * Set the global graphics extension for the current context
 */
void setGlobalGraphicsExtension(GraphicsWebExtension* ext);

/**
 * Get the global graphics extension
 */
GraphicsWebExtension* getGlobalGraphicsExtension();

} // namespace al

#endif // AL_GRAPHICS_WEB_EXTENSION_HPP
