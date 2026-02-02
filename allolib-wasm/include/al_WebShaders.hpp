/**
 * AlloLib Studio Online - Web Shaders
 *
 * Provides embedded WGSL shader sources and shader management
 * for the WebGPU backend.
 *
 * Uniform Buffer Layout (160 bytes):
 *   Offset 0:   mat4x4f modelViewMatrix   (64 bytes)
 *   Offset 64:  mat4x4f projectionMatrix  (64 bytes)
 *   Offset 128: vec4f   tint              (16 bytes)
 *   Offset 144: f32     pointSize         (4 bytes)
 *   Offset 148: f32     eyeSep            (4 bytes)
 *   Offset 152: f32     focLen            (4 bytes)
 *   Offset 156: f32     _pad              (4 bytes)
 *
 * Color shader has additional uniform:
 *   Offset 128: vec4f   color             (16 bytes)
 *   Offset 144: vec4f   tint              (16 bytes)
 *   (extends to 176 bytes total)
 */

#ifndef AL_WEB_SHADERS_HPP
#define AL_WEB_SHADERS_HPP

#include "al_WebGraphicsBackend.hpp"

namespace al {

/// Default shader types available
enum class DefaultShader {
    Mesh,       ///< Per-vertex colors (mesh coloring mode)
    Color,      ///< Uniform color
    Textured,   ///< Texture mapping
    Lighting,   ///< Multi-light Phong shading
    PBR,        ///< Physically-based rendering
    Skybox      ///< Environment background
};

/// Uniform buffer offsets (in bytes)
namespace ShaderUniform {
    constexpr int ModelViewMatrix = 0;      // 64 bytes (mat4)
    constexpr int ProjectionMatrix = 64;    // 64 bytes (mat4)
    constexpr int Tint = 128;               // 16 bytes (vec4) - for mesh shader
    constexpr int Color = 128;              // 16 bytes (vec4) - for color shader
    constexpr int ColorTint = 144;          // 16 bytes (vec4) - tint for color shader
    constexpr int PointSize = 144;          // 4 bytes (f32) - for mesh shader
    constexpr int EyeSep = 148;             // 4 bytes (f32)
    constexpr int FocLen = 152;             // 4 bytes (f32)

    // Standard uniform buffer sizes
    constexpr int MeshUniformSize = 160;    // For mesh shader
    constexpr int ColorUniformSize = 176;   // For color shader (has color + tint)
}

/**
 * Get WGSL vertex shader source for a default shader
 *
 * @param shader The shader type
 * @return Null-terminated WGSL source string
 */
const char* getWGSLVertexShader(DefaultShader shader);

/**
 * Get WGSL fragment shader source for a default shader
 *
 * @param shader The shader type
 * @return Null-terminated WGSL source string
 */
const char* getWGSLFragmentShader(DefaultShader shader);

/**
 * Get shader name for debugging
 *
 * @param shader The shader type
 * @return Human-readable name
 */
const char* getShaderName(DefaultShader shader);

/**
 * Create a default shader on the given backend
 *
 * @param backend The graphics backend
 * @param shader The shader type to create
 * @return Handle to the created shader, or invalid handle on failure
 */
ShaderHandle createDefaultShader(GraphicsBackend* backend, DefaultShader shader);

/**
 * WebShaderManager - Manages default shaders for a backend
 *
 * Creates and caches default shaders, handling lifecycle.
 */
class WebShaderManager {
public:
    WebShaderManager() = default;
    ~WebShaderManager();

    /// Set the graphics backend
    void setBackend(GraphicsBackend* backend);

    /// Get the current backend
    GraphicsBackend* backend() const { return mBackend; }

    /// Get or create a default shader
    ShaderHandle getShader(DefaultShader type);

    /// Check if a shader is available
    bool hasShader(DefaultShader type) const;

    /// Destroy all cached shaders
    void clear();

private:
    GraphicsBackend* mBackend = nullptr;
    ShaderHandle mMeshShader;
    ShaderHandle mColorShader;
    ShaderHandle mTexturedShader;
    ShaderHandle mLightingShader;
    ShaderHandle mPBRShader;
    ShaderHandle mSkyboxShader;

    ShaderHandle* getShaderSlot(DefaultShader type);
};

} // namespace al

#endif // AL_WEB_SHADERS_HPP
