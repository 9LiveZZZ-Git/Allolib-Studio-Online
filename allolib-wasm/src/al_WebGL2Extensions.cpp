/**
 * WebGL2 Extensions Implementation
 */

#include "al/graphics/al_WebGL2Extensions.hpp"
#include <iostream>

#ifdef __EMSCRIPTEN__
#include <GLES3/gl3.h>
#endif

namespace al {

// Static member initialization
bool WebGL2Extensions::sInitialized = false;
WebGL2Capabilities WebGL2Extensions::sCapabilities;

void WebGL2Extensions::printCapabilities() {
    const auto& caps = capabilities();

    std::cout << "=== WebGL2 Capabilities ===" << std::endl;
    std::cout << "Float Textures (read): " << (caps.floatTexturesReadable ? "Yes" : "No") << std::endl;
    std::cout << "Float Textures (FBO): " << (caps.floatTexturesRenderable ? "Yes" : "No") << std::endl;
    std::cout << "Float Texture Filter: " << (caps.floatTextureLinearFilter ? "Yes" : "No") << std::endl;
    std::cout << "Half-Float Renderable: " << (caps.halfFloatRenderable ? "Yes" : "No") << std::endl;
    std::cout << "Cubemap Supported: " << (caps.cubemapSupported ? "Yes" : "No") << std::endl;
    std::cout << "Anisotropic Filtering: " << (caps.anisotropicFiltering ? "Yes" : "No");
    if (caps.anisotropicFiltering) {
        std::cout << " (max " << caps.maxAnisotropy << "x)";
    }
    std::cout << std::endl;

    std::cout << "S3TC Compression: " << (caps.s3tcCompression ? "Yes" : "No") << std::endl;
    std::cout << "ETC2 Compression: " << (caps.etc2Compression ? "Yes" : "No") << std::endl;
    std::cout << "ASTC Compression: " << (caps.astcCompression ? "Yes" : "No") << std::endl;

    if (caps.hasDebugInfo) {
        std::cout << "GPU Vendor: " << caps.vendor << std::endl;
        std::cout << "GPU Renderer: " << caps.renderer << std::endl;
    }

    std::cout << "Max Texture Size: " << caps.maxTextureSize << std::endl;
    std::cout << "Max Cubemap Size: " << caps.maxCubemapSize << std::endl;
    std::cout << "Max Array Layers: " << caps.maxArrayTextureLayers << std::endl;
    std::cout << "Max 3D Size: " << caps.max3DTextureSize << std::endl;
    std::cout << "Max Color Attachments: " << caps.maxColorAttachments << std::endl;
    std::cout << "Max Draw Buffers: " << caps.maxDrawBuffers << std::endl;
    std::cout << "===========================" << std::endl;
}

} // namespace al

// C exports for JavaScript interop (outside namespace)
extern "C" {

EMSCRIPTEN_KEEPALIVE void al_webgl2_set_capability(int index, int value) {
    auto& caps = al::WebGL2Extensions::mutableCapabilities();
    switch (index) {
        case 0: caps.floatTexturesRenderable = (value != 0); break;
        case 1: caps.floatTextureLinearFilter = (value != 0); break;
        case 2: caps.halfFloatRenderable = (value != 0); break;
        case 3: caps.anisotropicFiltering = (value != 0); break;
        case 4: caps.hasDebugInfo = (value != 0); break;
        case 5: caps.s3tcCompression = (value != 0); break;
        case 6: caps.astcCompression = (value != 0); break;
    }
}

EMSCRIPTEN_KEEPALIVE void al_webgl2_set_float_param(int index, float value) {
    auto& caps = al::WebGL2Extensions::mutableCapabilities();
    switch (index) {
        case 0: caps.maxAnisotropy = value; break;
    }
}

EMSCRIPTEN_KEEPALIVE void al_webgl2_set_int_param(int index, int value) {
    auto& caps = al::WebGL2Extensions::mutableCapabilities();
    switch (index) {
        case 0: caps.maxTextureSize = value; break;
        case 1: caps.maxCubemapSize = value; break;
        case 2: caps.maxArrayTextureLayers = value; break;
        case 3: caps.max3DTextureSize = value; break;
        case 4: caps.maxColorAttachments = value; break;
        case 5: caps.maxDrawBuffers = value; break;
    }
}

EMSCRIPTEN_KEEPALIVE void al_webgl2_set_debug_info(const char* vendor, const char* renderer) {
    auto& caps = al::WebGL2Extensions::mutableCapabilities();
    caps.vendor = vendor ? vendor : "";
    caps.renderer = renderer ? renderer : "";
}

} // extern "C"
