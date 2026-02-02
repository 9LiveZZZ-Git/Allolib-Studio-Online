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

namespace al {

/// Register/update a texture for WebGPU use
/// Call this after Texture::submit() with the GL texture ID and pixel data
void Graphics_registerTexture(GLuint glTextureId, int width, int height, const void* pixels);

/// Notify that a GL texture was bound
/// Call this in Texture::bind() to sync to WebGPU backend
void Graphics_onTextureBind(GLuint glTextureId, int unit);

/// Check if WebGPU has a texture ready
bool Graphics_hasWebGPUTexture();

/// Clean up all texture bridge entries
void Graphics_clearTextureBridge();

} // namespace al

#endif // __EMSCRIPTEN__
#endif // AL_TEXTURE_BRIDGE_HPP
