/**
 * Texture Bridge - Syncs AlloLib textures to WebGPU backend
 *
 * This provides the glue between OpenGL-based al::Texture and WebGPU rendering.
 * When a texture is submitted or bound, these functions sync it to WebGPU.
 */

#ifndef AL_TEXTURE_BRIDGE_HPP
#define AL_TEXTURE_BRIDGE_HPP

#ifdef __EMSCRIPTEN__
#include "al/graphics/al_OpenGL.hpp"
#include "al_WebGraphicsBackend.hpp"

namespace al {

/// Register/update a 2D RGBA8 texture for WebGPU use
void Graphics_registerTexture(GLuint glTextureId, int width, int height, const void* pixels);

/// Register/update a 2D texture with specific format (supports float textures)
void Graphics_registerTextureWithFormat(GLuint glTextureId, int width, int height,
                                         PixelFormat format, const void* pixels);

/// Register/update a 3D texture for WebGPU use
void Graphics_registerTexture3D(GLuint glTextureId, int width, int height, int depth,
                                 PixelFormat format, const void* pixels);

/// Notify that a GL texture was bound
void Graphics_onTextureBind(GLuint glTextureId, int unit);

/// Check if WebGPU has a texture ready
bool Graphics_hasWebGPUTexture();

/// Check if the currently bound texture is 3D
bool Graphics_isBoundTexture3D();

/// Clean up all texture bridge entries
void Graphics_clearTextureBridge();

} // namespace al

#endif // __EMSCRIPTEN__
#endif // AL_TEXTURE_BRIDGE_HPP
