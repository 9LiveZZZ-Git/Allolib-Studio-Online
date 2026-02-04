/**
 * AlloLib Studio Online - Web-patched EasyFBO implementation
 *
 * This file overrides al_EasyFBO.cpp for web builds to register
 * EasyFBOs with the WebGPU bridge after initialization.
 */

#include "al/graphics/al_EasyFBO.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

namespace al {

// Forward declaration of bridge registration function (defined in al_Graphics_Web.cpp)
extern void EasyFBO_registerWithBridge(unsigned int fboId, unsigned int colorTexId,
                                        unsigned int depthTexId, int width, int height);

void EasyFBO::init(int width, int height, EasyFBOSetting const& setting) {
  mWidth = width;
  mHeight = height;

  // Create color texture
  mTex.filterMin(setting.filterMin);
  mTex.filterMag(setting.filterMag);
  mTex.wrapS(setting.wrapS);
  mTex.wrapT(setting.wrapT);
  mTex.wrapR(setting.wrapR);
  mTex.mipmap(setting.mUseMipmap);
  mTex.create2D(mWidth, mHeight, setting.internal, setting.format,
                setting.type);

  // Create depth attachment (texture or RBO)
  if (setting.use_depth_texture)
    mDepthTex.create2D(mWidth, mHeight, setting.depth_format,
                       GL_DEPTH_COMPONENT, GL_FLOAT);
  else
    mRbo.create(mWidth, mHeight, setting.depth_format);

  // Setup FBO
  mFbo.bind();
  mFbo.attachTexture2D(mTex);
  if (setting.use_depth_texture)
    mFbo.attachTexture2D(mDepthTex, GL_DEPTH_ATTACHMENT);
  else
    mFbo.attachRBO(mRbo);

  // Clear color attachments to black and depth to 1
  // Prevents glitchy output for first frame
  float c[] = {0, 0, 0, 0};
  float d = 1;
  glClearBufferfv(GL_COLOR, 0, c);
  glClearBufferfv(GL_DEPTH, 0, &d);
  mFbo.unbind();

  // ─── WEB EXTENSION: Register with WebGPU bridge ─────────────────────────
  // This allows the FBO to work with WebGPU's render target system
  unsigned int depthTexId = setting.use_depth_texture ? mDepthTex.id() : 0;
  EasyFBO_registerWithBridge(mFbo.id(), mTex.id(), depthTexId, mWidth, mHeight);
}

} // namespace al
