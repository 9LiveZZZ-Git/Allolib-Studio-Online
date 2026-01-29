/**
 * WebGL2-compatible OpenGL wrapper
 *
 * This replaces the desktop OpenGL wrapper for Emscripten/WebGL2 builds.
 * Key differences from desktop OpenGL:
 * - glPointSize() doesn't exist in WebGL2/OpenGL ES 3.0
 * - Point size must be set via gl_PointSize in vertex shader
 * - We store the point size and provide a getter for the shader uniform
 */

#include "al/graphics/al_OpenGL.hpp"

#include <cstdio>
#include <cstring>

namespace al {
namespace gl {

// Store point size for shader uniform (WebGL2 doesn't support glPointSize)
static float sPointSize = 1.0f;

bool loaded() { return true; }  // Always loaded in Emscripten

bool load() { return true; }

const char *versionString() {
#ifdef __EMSCRIPTEN__
  return "WebGL 2.0 (OpenGL ES 3.0)";
#else
  return (const char *)glGetString(GL_VERSION);
#endif
}

const char *errorString(bool verbose) {
  GLenum err = glGetError();
  #define CS(GL_ERR, desc)                                                       \
    case GL_ERR:                                                                 \
      return verbose ? #GL_ERR ", " desc : #GL_ERR;
  switch (err) {
    CS(GL_INVALID_ENUM, "An unacceptable value is specified for an enumerated "
                        "argument.")
    CS(GL_INVALID_VALUE, "A numeric argument is out of range.")
    CS(GL_INVALID_OPERATION,
       "The specified operation is not allowed in the current state.")
    CS(GL_OUT_OF_MEMORY,
       "There is not enough memory left to execute the command.")
    CS(GL_INVALID_FRAMEBUFFER_OPERATION,
       "The command is trying to render to or read from the framebuffer while "
       "the currently bound framebuffer is not framebuffer complete.")
    default:
      return "";
  }
  #undef CS
}

bool error(const char *msg, int ID) {
  const char *errStr = errorString();
  if (errStr[0]) {
    printf("Error %s ", errStr);
    if (msg && msg[0]) printf("%s ", msg);
    if (ID >= 0) printf("[ID=%d] ", ID);
    printf("\n");
    return true;
  }
  return false;
}

int numBytes(GLenum v) {
  switch (v) {
    case GL_BYTE:
    case GL_UNSIGNED_BYTE:
      return 1;
    case GL_SHORT:
    case GL_UNSIGNED_SHORT:
      return 2;
    case GL_INT:
    case GL_UNSIGNED_INT:
    case GL_FLOAT:
      return 4;
    default:
      return 0;
  }
}

template <>
GLenum toDataType<char>() {
  return GL_BYTE;
}
template <>
GLenum toDataType<unsigned char>() {
  return GL_UNSIGNED_BYTE;
}
template <>
GLenum toDataType<short>() {
  return GL_SHORT;
}
template <>
GLenum toDataType<unsigned short>() {
  return GL_UNSIGNED_SHORT;
}
template <>
GLenum toDataType<int>() {
  return GL_INT;
}
template <>
GLenum toDataType<unsigned int>() {
  return GL_UNSIGNED_INT;
}
template <>
GLenum toDataType<float>() {
  return GL_FLOAT;
}

void bufferToDraw(unsigned int buffer) {
  // Note: glDrawBuffer not available in OpenGL ES 3.0/WebGL2
  // For single-buffered contexts, this is a no-op
#ifndef __EMSCRIPTEN__
  glDrawBuffer(buffer);
#endif
}

void viewport(int left, int bottom, int width, int height) {
  glViewport(left, bottom, width, height);
}

void blending(bool doBlend) {
  doBlend ? glEnable(GL_BLEND) : glDisable(GL_BLEND);
}

void blendMode(unsigned int src, unsigned int dst, unsigned int eq) {
  glBlendEquation(eq);
  glBlendFunc(src, dst);
}

void depthTesting(bool testDepth) {
  testDepth ? glEnable(GL_DEPTH_TEST) : glDisable(GL_DEPTH_TEST);
}

void depthMask(bool maskDepth) { glDepthMask(maskDepth ? GL_TRUE : GL_FALSE); }

void scissorTest(bool testScissor) {
  testScissor ? glEnable(GL_SCISSOR_TEST) : glDisable(GL_SCISSOR_TEST);
}

void scissorArea(int left, int bottom, int width, int height) {
  glScissor(left, bottom, width, height);
}

void culling(bool doCulling) {
  doCulling ? glEnable(GL_CULL_FACE) : glDisable(GL_CULL_FACE);
}

void cullFace(unsigned int face) { glCullFace(face); }

void polygonMode(unsigned int mode) {
  // Note: glPolygonMode not available in OpenGL ES 3.0/WebGL2
  // Only GL_FILL is supported, GL_LINE and GL_POINT modes don't exist
#ifndef __EMSCRIPTEN__
  glPolygonMode(GL_FRONT_AND_BACK, mode);
#endif
  // In WebGL2, wireframe rendering must be done with GL_LINES primitive
}

void colorMask(bool r, bool g, bool b, bool a) { glColorMask(r, g, b, a); }
void colorMask(bool b) { colorMask(b, b, b, b); }

void pointSize(float size) {
  // Store point size for shader uniform
  // WebGL2/OpenGL ES 3.0 doesn't support glPointSize()
  // Point size must be set via gl_PointSize in the vertex shader
  sPointSize = size;

#ifndef __EMSCRIPTEN__
  // On desktop, also call the real glPointSize for compatibility
  glPointSize(size);
#endif
}

// Get current point size for setting shader uniform
float getPointSize() {
  return sPointSize;
}

void lineWidth(float size) {
  // Note: lineWidth > 1.0 may not be supported in WebGL2
  // Most implementations only support lineWidth of 1.0
  glLineWidth(size);
}

void clearColor(float r, float g, float b, float a) {
  glClearColor(r, g, b, a);
  glClear(GL_COLOR_BUFFER_BIT);
}

void clearDepth(float d) {
  glClearDepthf(d);
  glClear(GL_DEPTH_BUFFER_BIT);
}

void clearBuffer(int buffer, float r, float g, float b, float a) {
  float color[4] = {r, g, b, a};
  glClearBufferfv(GL_COLOR, buffer, color);
}

}  // namespace gl
}  // namespace al
