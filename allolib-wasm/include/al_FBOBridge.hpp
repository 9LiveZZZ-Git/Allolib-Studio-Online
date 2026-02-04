/**
 * AlloLib Studio Online - FBO Bridge
 *
 * Maps OpenGL FBO IDs to WebGPU RenderTargetHandles.
 * This allows EasyFBO and other GL-based FBO code to work
 * transparently with the WebGPU backend.
 *
 * Usage:
 *   1. When creating an EasyFBO in WebGPU mode, call FBO_register()
 *   2. RenderManager::framebuffer() uses FBO_getWebGPUHandle() to route
 *   3. When destroying an FBO, call FBO_unregister()
 */

#ifndef AL_FBO_BRIDGE_HPP
#define AL_FBO_BRIDGE_HPP

#include "al_WebGraphicsBackend.hpp"

namespace al {

/**
 * Entry in the FBO bridge mapping table.
 * Stores the WebGPU handle plus dimensions for viewport management.
 */
struct FBOBridgeEntry {
    RenderTargetHandle handle;
    int width = 0;
    int height = 0;
};

/**
 * Register an OpenGL FBO ID with its corresponding WebGPU render target.
 * Called after EasyFBO::init() creates the WebGPU render target.
 *
 * @param glFboId The OpenGL FBO ID (from mFbo.id())
 * @param rtHandle The WebGPU RenderTargetHandle
 * @param width FBO width in pixels
 * @param height FBO height in pixels
 */
void FBO_register(unsigned int glFboId, RenderTargetHandle rtHandle, int width, int height);

/**
 * Get the WebGPU RenderTargetHandle for an OpenGL FBO ID.
 * Returns an invalid handle if the FBO is not registered.
 *
 * @param glFboId The OpenGL FBO ID
 * @return The corresponding RenderTargetHandle, or invalid if not found
 */
RenderTargetHandle FBO_getWebGPUHandle(unsigned int glFboId);

/**
 * Get the dimensions of a registered FBO.
 *
 * @param glFboId The OpenGL FBO ID
 * @param outWidth Output: FBO width
 * @param outHeight Output: FBO height
 * @return true if found, false if not registered
 */
bool FBO_getDimensions(unsigned int glFboId, int& outWidth, int& outHeight);

/**
 * Unregister an FBO when it is destroyed.
 *
 * @param glFboId The OpenGL FBO ID to remove
 */
void FBO_unregister(unsigned int glFboId);

/**
 * Clear all FBO bridge registrations.
 * Called during backend shutdown.
 */
void FBO_clearAll();

} // namespace al

#endif // AL_FBO_BRIDGE_HPP
