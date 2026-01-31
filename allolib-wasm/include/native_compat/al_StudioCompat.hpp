/**
 * AlloLib Studio Native Compatibility Layer
 *
 * Master include file for all AlloLib Studio native compatibility headers.
 * Include this file to get access to all Studio features in native AlloLib.
 *
 * DEPENDENCIES:
 *   - stb_image.h (for HDR loading)
 *   - OpenGL 3.3+ or 4.1+
 *   - AlloLib (native)
 *
 * Usage:
 *   #include "native_compat/al_StudioCompat.hpp"
 *
 *   // All Web* types are aliased to Native* equivalents:
 *   WebHDR hdr;          // -> NativeHDR
 *   WebOBJ obj;          // -> NativeOBJ
 *   WebEnvironment env;  // -> NativeEnvironment
 *   LODMesh lod;         // Works identically
 *   QualityManager qm;   // Works identically
 *
 * Note: This header provides native implementations of AlloLib Studio's
 * extended features. The API is identical to the web versions, making
 * code portable between AlloLib Studio Online and native AlloLib.
 *
 * To use with native AlloLib:
 * 1. Copy the native_compat folder to your project
 * 2. Add stb_image.h to your include path
 * 3. #define STB_IMAGE_IMPLEMENTATION in ONE .cpp file
 * 4. Include this header in your source files
 */

#ifndef AL_STUDIO_COMPAT_HPP
#define AL_STUDIO_COMPAT_HPP

// Core loaders
#include "al_NativeHDR.hpp"
#include "al_NativeOBJ.hpp"

// Environment/Skybox system
#include "al_NativeEnvironment.hpp"

// Level of Detail system
#include "al_NativeLOD.hpp"

// Adaptive quality system
#include "al_NativeQuality.hpp"

namespace al {

/**
 * Print Studio compatibility layer info
 */
inline void printStudioCompatInfo() {
    printf("AlloLib Studio Native Compatibility Layer\n");
    printf("=========================================\n");
    printf("Features:\n");
    printf("  - NativeHDR (WebHDR)           - HDR image loading with stb_image\n");
    printf("  - NativeOBJ (WebOBJ)           - OBJ mesh loading\n");
    printf("  - NativeEnvironment (WebEnvironment) - Skybox and reflections\n");
    printf("  - LODMesh                      - Automatic mesh LOD\n");
    printf("  - LODGroup                     - Multi-object LOD management\n");
    printf("  - QualityManager               - Adaptive quality system\n");
    printf("\n");
    printf("All Web* types are aliased to their Native* equivalents.\n");
}

} // namespace al

#endif // AL_STUDIO_COMPAT_HPP
