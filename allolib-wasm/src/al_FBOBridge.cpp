/**
 * AlloLib Studio Online - FBO Bridge Implementation
 *
 * Maps OpenGL FBO IDs to WebGPU RenderTargetHandles using a simple
 * hash map. Thread-safety is not needed since we're single-threaded
 * in the browser.
 */

#include "al_FBOBridge.hpp"
#include <unordered_map>

namespace al {

// Static map of GL FBO IDs to bridge entries
static std::unordered_map<unsigned int, FBOBridgeEntry> sFBOMap;

void FBO_register(unsigned int glFboId, RenderTargetHandle rtHandle, int width, int height) {
    if (glFboId == 0) {
        // FBO ID 0 is the default framebuffer, never register it
        return;
    }

    FBOBridgeEntry entry;
    entry.handle = rtHandle;
    entry.width = width;
    entry.height = height;

    sFBOMap[glFboId] = entry;
}

RenderTargetHandle FBO_getWebGPUHandle(unsigned int glFboId) {
    if (glFboId == 0) {
        // FBO ID 0 means default framebuffer (screen)
        return RenderTargetHandle{0};
    }

    auto it = sFBOMap.find(glFboId);
    if (it != sFBOMap.end()) {
        return it->second.handle;
    }

    // Not found - return invalid handle
    return RenderTargetHandle{0};
}

bool FBO_getDimensions(unsigned int glFboId, int& outWidth, int& outHeight) {
    if (glFboId == 0) {
        // Default framebuffer - caller should use canvas dimensions
        return false;
    }

    auto it = sFBOMap.find(glFboId);
    if (it != sFBOMap.end()) {
        outWidth = it->second.width;
        outHeight = it->second.height;
        return true;
    }

    return false;
}

void FBO_unregister(unsigned int glFboId) {
    sFBOMap.erase(glFboId);
}

void FBO_clearAll() {
    sFBOMap.clear();
}

} // namespace al
