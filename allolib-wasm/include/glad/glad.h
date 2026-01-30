/**
 * GLAD Wrapper for WebGL2/Emscripten
 *
 * This wrapper includes the original glad.h but patches functions
 * that don't exist in WebGL2/OpenGL ES 3.0:
 * - glPointSize() - must use gl_PointSize in vertex shader instead
 * - glPolygonMode() - only GL_FILL is supported in WebGL2
 * - glDrawBuffer() - not available in WebGL2
 */

#ifndef ALLOLIB_WEB_GLAD_WRAPPER_H
#define ALLOLIB_WEB_GLAD_WRAPPER_H

// Include the real glad.h from the original location
// The include path order ensures this file is found first, so we need to use
// a relative path to find the original
#include "../../../allolib/external/glad/include/glad/glad.h"

#ifdef __EMSCRIPTEN__

// Store point size for retrieval by shaders
// Defined in al_WebGL2Extensions.cpp
#ifdef __cplusplus
extern "C" {
#endif

void al_web_set_point_size(float size);
float al_web_get_point_size(void);

#ifdef __cplusplus
}
#endif

// Override glPointSize to store the value instead of calling the non-existent function
// In WebGL2, point size must be set via gl_PointSize in the vertex shader
#undef glPointSize
#define glPointSize(size) al_web_set_point_size(size)

// Override glPolygonMode - not available in WebGL2
// Only GL_FILL is supported, wireframe must be done with GL_LINES primitive
#undef glPolygonMode
#define glPolygonMode(face, mode) ((void)(face), (void)(mode))

// Override glDrawBuffer - not available in WebGL2
// Single-buffered contexts handle this automatically
#undef glDrawBuffer
#define glDrawBuffer(buffer) ((void)(buffer))

#endif // __EMSCRIPTEN__

#endif // ALLOLIB_WEB_GLAD_WRAPPER_H
