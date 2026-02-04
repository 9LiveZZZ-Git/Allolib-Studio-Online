/**
 * AlloLib Studio Online - Web-patched FBO implementation
 *
 * This file overrides al_FBO.cpp for web builds to route FBO::bind()
 * through the graphics bridge, enabling WebGPU render-to-texture support.
 *
 * The key change is in FBO::bind(unsigned fboID) which calls
 * Graphics_bindFramebuffer() instead of directly calling glBindFramebuffer().
 * This allows the graphics bridge to intercept the call and route it
 * to either WebGL2 or WebGPU backend as appropriate.
 */

#include "al/graphics/al_FBO.hpp"
#include <cstdio>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

namespace al {

// Forward declaration of bridge function (defined in al_Graphics_Web.cpp)
extern void Graphics_bindFramebuffer(unsigned int fboId);

// ─── RBO Implementation (unchanged from original) ─────────────────────────────

RBO::RBO(unsigned int format) : mFormat(format) {}

void RBO::onCreate() { glGenRenderbuffers(1, &mID); }

void RBO::onDestroy() { glDeleteRenderbuffers(1, &mID); }

unsigned int RBO::format() const { return mFormat; }

RBO &RBO::format(unsigned int v) {
  mFormat = v;
  return *this;
}

void RBO::bind() {
  validate();
  bind(id());
}

void RBO::unbind() { bind(0); }

bool RBO::resize(unsigned w, unsigned h) {
  bind();
  bool r = resize(format(), w, h);
  unbind();
  return r;
}

// static functions
unsigned RBO::maxSize() {
  int s;
  glGetIntegerv(GL_MAX_RENDERBUFFER_SIZE, &s);
  return s;
}

void RBO::bind(unsigned id) { glBindRenderbuffer(GL_RENDERBUFFER, id); }

bool RBO::resize(unsigned int format, unsigned w, unsigned h) {
  unsigned mx = maxSize();
  if (w > mx || h > mx)
    return false;
  glRenderbufferStorage(GL_RENDERBUFFER, format, w, h);
  return true;
}

// ─── FBO Implementation (patched for web) ─────────────────────────────────────

void FBO::onCreate() { glGenFramebuffers(1, &mID); }

void FBO::onDestroy() { glDeleteFramebuffers(1, &mID); }

FBO &FBO::attachRBO(const RBO &rbo, unsigned int attachment) {
  renderBuffer(rbo.id(), attachment);
  return *this;
}

FBO &FBO::detachRBO(unsigned int attachment) {
  renderBuffer(0, attachment);
  return *this;
}

FBO &FBO::attachTexture2D(Texture const &tex, unsigned int attachment,
                          int level) {
  texture2D(tex.id(), attachment, level);
  return *this;
}

FBO &FBO::detachTexture2D(unsigned int attachment, int level) {
  texture2D(0, attachment, level);
  return *this;
}

FBO &FBO::attachCubemapFace(Texture const &tex, unsigned int target_face,
                            unsigned int attachment, int level) {
  textureCubemapFace(tex.id(), target_face, attachment, level);
  return *this;
}

FBO &FBO::detachCubemapFace(unsigned int target_face, unsigned int attachment,
                            int level) {
  textureCubemapFace(0, target_face, attachment, level);
  return *this;
}

void FBO::bind() {
  validate();
  bind(id());
}

void FBO::unbind() { bind(0); }

GLenum FBO::status() {
  // Must use GL directly for status check, not routed bind
  glBindFramebuffer(GL_FRAMEBUFFER, id());
  int r = glCheckFramebufferStatus(GL_FRAMEBUFFER);
  glBindFramebuffer(GL_FRAMEBUFFER, 0);
  return r;
}

const char *FBO::statusString() { return statusString(status()); }

const char *FBO::statusString(GLenum stat) {
#define CS(v)                                                                  \
  case v:                                                                      \
    return #v;
  switch (stat) {
    CS(GL_FRAMEBUFFER_COMPLETE)
    CS(GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT)
    CS(GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT)
    CS(GL_FRAMEBUFFER_INCOMPLETE_DRAW_BUFFER)
    CS(GL_FRAMEBUFFER_INCOMPLETE_READ_BUFFER)
    CS(GL_FRAMEBUFFER_UNSUPPORTED)
  default:
    return "GL_FRAMEBUFFER_UNKNOWN";
  };
#undef CS
}

// ─── PATCHED: Route through graphics bridge ───────────────────────────────────
// This is the key change - instead of directly calling glBindFramebuffer,
// we route through Graphics_bindFramebuffer which handles WebGPU mode.
void FBO::bind(unsigned fboID) {
  Graphics_bindFramebuffer(fboID);
}

void FBO::renderBuffer(unsigned rboID, unsigned int attachment) {
  glFramebufferRenderbuffer(GL_FRAMEBUFFER, attachment, GL_RENDERBUFFER, rboID);
}

void FBO::texture2D(unsigned texID, unsigned int attachment, int level) {
  glFramebufferTexture2D(GL_FRAMEBUFFER, attachment, GL_TEXTURE_2D, texID,
                         level);
}

void FBO::textureCubemapFace(unsigned int texID, unsigned int target_face,
                             unsigned int attachment, int level) {
  glFramebufferTexture2D(GL_FRAMEBUFFER, attachment, target_face, texID, level);
}

} // namespace al
