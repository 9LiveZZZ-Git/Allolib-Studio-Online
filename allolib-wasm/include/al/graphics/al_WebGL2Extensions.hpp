#pragma once

/**
 * WebGL2 Extensions Helper
 *
 * Provides runtime detection and handling of WebGL2 extensions that may not
 * be available on all devices. This allows AlloLib applications to gracefully
 * degrade when features like float textures aren't available.
 *
 * Key Extensions:
 * - EXT_color_buffer_float: Required for rendering to float textures (FBO)
 * - OES_texture_float_linear: Float texture linear filtering (optional)
 * - WEBGL_debug_renderer_info: GPU vendor/renderer info
 * - EXT_texture_filter_anisotropic: Anisotropic filtering
 * - WEBGL_compressed_texture_*: Various compression formats
 *
 * Note: Cubemap textures are fully supported in WebGL2 core, no extension needed.
 */

#include <string>
#include <unordered_map>
#include <functional>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/html5.h>
#include <GLES3/gl3.h>
#endif

namespace al {

/**
 * WebGL2 Extension availability and capabilities
 */
struct WebGL2Capabilities {
    // Texture capabilities
    bool floatTexturesReadable = true;     // Reading from float textures (WebGL2 core)
    bool floatTexturesRenderable = false;  // EXT_color_buffer_float for FBO
    bool floatTextureLinearFilter = false; // OES_texture_float_linear
    bool halfFloatRenderable = false;      // Half-float texture rendering

    // Cubemap is core WebGL2
    bool cubemapSupported = true;
    bool seamlessCubemap = true;           // WebGL2 always seamless

    // Other features
    bool anisotropicFiltering = false;
    float maxAnisotropy = 1.0f;

    // Compression formats
    bool s3tcCompression = false;
    bool etc2Compression = true;           // ETC2 is mandatory in WebGL2
    bool astcCompression = false;

    // Debug info
    bool hasDebugInfo = false;
    std::string renderer;
    std::string vendor;

    // Limits
    int maxTextureSize = 4096;
    int maxCubemapSize = 4096;
    int maxArrayTextureLayers = 256;
    int max3DTextureSize = 256;
    int maxColorAttachments = 4;
    int maxDrawBuffers = 4;
};

/**
 * WebGL2 Extensions Manager
 *
 * Detects and manages WebGL2 extension availability
 */
class WebGL2Extensions {
public:
    /**
     * Initialize and detect all available extensions.
     * Call this once after WebGL2 context creation.
     */
    static void initialize() {
        if (sInitialized) return;

#ifdef __EMSCRIPTEN__
        // Query extensions via JavaScript
        EM_ASM({
            var canvas = document.getElementById('canvas');
            if (!canvas) return;

            var gl = canvas.getContext('webgl2');
            if (!gl) return;

            // Float texture rendering
            var floatExt = gl.getExtension('EXT_color_buffer_float');
            Module._al_webgl2_set_capability(0, floatExt ? 1 : 0);

            // Float texture linear filtering
            var floatLinear = gl.getExtension('OES_texture_float_linear');
            Module._al_webgl2_set_capability(1, floatLinear ? 1 : 0);

            // Half-float rendering
            var halfFloatExt = gl.getExtension('EXT_color_buffer_half_float');
            Module._al_webgl2_set_capability(2, halfFloatExt ? 1 : 0);

            // Anisotropic filtering
            var anisoExt = gl.getExtension('EXT_texture_filter_anisotropic') ||
                          gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
            if (anisoExt) {
                var maxAniso = gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
                Module._al_webgl2_set_capability(3, 1);
                Module._al_webgl2_set_float_param(0, maxAniso);
            }

            // Debug info
            var debugExt = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugExt) {
                Module._al_webgl2_set_capability(4, 1);
                var renderer = gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL);
                var vendor = gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL);
                Module.ccall('al_webgl2_set_debug_info', null, ['string', 'string'], [vendor, renderer]);
            }

            // Compression formats
            var s3tc = gl.getExtension('WEBGL_compressed_texture_s3tc');
            Module._al_webgl2_set_capability(5, s3tc ? 1 : 0);

            var astc = gl.getExtension('WEBGL_compressed_texture_astc');
            Module._al_webgl2_set_capability(6, astc ? 1 : 0);

            // Query limits
            Module._al_webgl2_set_int_param(0, gl.getParameter(gl.MAX_TEXTURE_SIZE));
            Module._al_webgl2_set_int_param(1, gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE));
            Module._al_webgl2_set_int_param(2, gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS));
            Module._al_webgl2_set_int_param(3, gl.getParameter(gl.MAX_3D_TEXTURE_SIZE));
            Module._al_webgl2_set_int_param(4, gl.getParameter(gl.MAX_COLOR_ATTACHMENTS));
            Module._al_webgl2_set_int_param(5, gl.getParameter(gl.MAX_DRAW_BUFFERS));
        });
#endif

        sInitialized = true;
    }

    /**
     * Get current capabilities
     */
    static const WebGL2Capabilities& capabilities() {
        if (!sInitialized) initialize();
        return sCapabilities;
    }

    /**
     * Check if float textures can be rendered to (FBO target)
     */
    static bool canRenderToFloatTexture() {
        return capabilities().floatTexturesRenderable;
    }

    /**
     * Check if linear filtering works on float textures
     */
    static bool canFilterFloatTexture() {
        return capabilities().floatTextureLinearFilter;
    }

    /**
     * Get recommended internal format based on capabilities
     * Falls back to lower precision if float isn't renderable
     */
    static int getRecommendedInternalFormat(bool needsRenderTarget, bool needsAlpha) {
        if (needsRenderTarget) {
            if (capabilities().floatTexturesRenderable) {
                return needsAlpha ? GL_RGBA32F : GL_RGB32F;
            } else if (capabilities().halfFloatRenderable) {
                return needsAlpha ? GL_RGBA16F : GL_RGB16F;
            } else {
                // Fall back to 8-bit
                return needsAlpha ? GL_RGBA8 : GL_RGB8;
            }
        } else {
            // Reading only - float textures always work in WebGL2
            return needsAlpha ? GL_RGBA32F : GL_RGB32F;
        }
    }

    /**
     * Print all capabilities to console
     */
    static void printCapabilities();

private:
    static bool sInitialized;
    static WebGL2Capabilities sCapabilities;

public:
    // Direct access for C interop functions
    static WebGL2Capabilities& mutableCapabilities() { return sCapabilities; }
};

// C exports for JavaScript interop
extern "C" {
    EMSCRIPTEN_KEEPALIVE void al_webgl2_set_capability(int index, int value);
    EMSCRIPTEN_KEEPALIVE void al_webgl2_set_float_param(int index, float value);
    EMSCRIPTEN_KEEPALIVE void al_webgl2_set_int_param(int index, int value);
    EMSCRIPTEN_KEEPALIVE void al_webgl2_set_debug_info(const char* vendor, const char* renderer);
}

} // namespace al
