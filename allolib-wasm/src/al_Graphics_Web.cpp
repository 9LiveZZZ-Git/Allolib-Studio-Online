/**
 * WebGL2/WebGPU-compatible Graphics implementation
 *
 * This is a patched version of al_Graphics.cpp for web builds.
 * Key changes:
 * - Sets al_PointSize uniform before drawing (WebGL2 doesn't support glPointSize)
 * - Supports WebGPU backend routing for draw calls
 */

#include "al/graphics/al_Graphics.hpp"
#include "al_WebGraphicsBackend.hpp"
#ifdef ALLOLIB_WEBGPU
#include "al_WebGPUBackend.hpp"
#endif
#include "al_WebMeshAdapter.hpp"
#include <utility>
#include <cmath>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include "al/graphics/al_OpenGL.hpp"
#include <unordered_map>
#include <vector>
#endif

namespace al {

// ─── WebGPU Backend Integration ──────────────────────────────────────────────

static GraphicsBackend* sGraphicsBackend = nullptr;
static WebMeshAdapter sMeshAdapter;
static bool sWebGPUMode = false;

// ─── Texture Bridge (OpenGL ↔ WebGPU) ────────────────────────────────────────

struct TextureBridgeEntry {
    TextureHandle webgpuHandle;
    int width = 0;
    int height = 0;
    uint32_t version = 0;  // To detect if texture data changed
};

static std::unordered_map<GLuint, TextureBridgeEntry> sTextureBridge;
static GLuint sLastBoundGLTexture = 0;

// Register a texture for WebGPU use (called after texture.submit())
void Graphics_registerTexture(GLuint glTextureId, int width, int height, const void* pixels) {
    if (!sWebGPUMode || !sGraphicsBackend || glTextureId == 0) return;

    auto it = sTextureBridge.find(glTextureId);

    // Create new or update existing
    TextureDesc desc;
    desc.width = width;
    desc.height = height;
    desc.format = PixelFormat::RGBA8;
    desc.minFilter = FilterMode::Linear;
    desc.magFilter = FilterMode::Linear;
    desc.wrapS = WrapMode::Repeat;
    desc.wrapT = WrapMode::Repeat;

    if (it == sTextureBridge.end()) {
        // Create new WebGPU texture
        TextureHandle handle = sGraphicsBackend->createTexture(desc, pixels);
        if (handle.valid()) {
            sTextureBridge[glTextureId] = {handle, width, height, 1};
            printf("[Graphics] Registered GL texture %u → WebGPU (size: %dx%d)\n",
                   glTextureId, width, height);
        }
    } else {
        // Update existing texture
        if (it->second.width != width || it->second.height != height) {
            // Size changed - recreate
            sGraphicsBackend->destroyTexture(it->second.webgpuHandle);
            TextureHandle handle = sGraphicsBackend->createTexture(desc, pixels);
            it->second = {handle, width, height, it->second.version + 1};
        } else {
            // Same size - just update data
            sGraphicsBackend->updateTexture(it->second.webgpuHandle, pixels);
            it->second.version++;
        }
    }
}

// Called when a GL texture is bound - sync to WebGPU backend
void Graphics_onTextureBind(GLuint glTextureId, int unit) {
    if (!sWebGPUMode || !sGraphicsBackend) return;

    sLastBoundGLTexture = glTextureId;

    auto it = sTextureBridge.find(glTextureId);
    if (it != sTextureBridge.end() && it->second.webgpuHandle.valid()) {
        sGraphicsBackend->setTexture("tex0", it->second.webgpuHandle, unit);
    }
}

// Check if there's a registered texture for WebGPU
bool Graphics_hasWebGPUTexture() {
    if (!sWebGPUMode || sLastBoundGLTexture == 0) return false;
    auto it = sTextureBridge.find(sLastBoundGLTexture);
    return it != sTextureBridge.end() && it->second.webgpuHandle.valid();
}

// Clean up texture bridge
void Graphics_clearTextureBridge() {
    if (sGraphicsBackend) {
        for (auto& [glId, entry] : sTextureBridge) {
            if (entry.webgpuHandle.valid()) {
                sGraphicsBackend->destroyTexture(entry.webgpuHandle);
            }
        }
    }
    sTextureBridge.clear();
    sLastBoundGLTexture = 0;
}

void Graphics_setBackend(GraphicsBackend* backend) {
    sGraphicsBackend = backend;
    sMeshAdapter.setBackend(backend);
    sWebGPUMode = backend && backend->isWebGPU();
#ifdef __EMSCRIPTEN__
    EM_ASM({ console.log('[Graphics] Backend set, WebGPU mode: ' + $0); }, sWebGPUMode ? 1 : 0);
#endif
}

GraphicsBackend* Graphics_getBackend() {
    return sGraphicsBackend;
}

bool Graphics_isWebGPU() {
    return sWebGPUMode;
}

const float Graphics::LEFT_EYE = -1.0f;
const float Graphics::RIGHT_EYE = 1.0f;
const float Graphics::MONO_EYE = 0.0f;

void Graphics::init() {
  if (initialized)
    return;

  // In WebGPU mode, skip GL shader compilation - backend handles rendering
  if (sWebGPUMode) {
#ifdef __EMSCRIPTEN__
    EM_ASM({ console.log('[Graphics::init] WebGPU mode - skipping GL shader compilation'); });
#endif
    initialized = true;
    return;
  }

  compileDefaultShader(color_shader, ShaderType::COLOR);
  compileDefaultShader(mesh_shader, ShaderType::MESH);
  compileDefaultShader(tex_shader, ShaderType::TEXTURE);

  color_location = color_shader.getUniformLocation("col0");
  color_tint_location = color_shader.getUniformLocation("tint");
  tex_tint_location = tex_shader.getUniformLocation("tint");
  mesh_tint_location = mesh_shader.getUniformLocation("tint");

  tex_shader.begin();
  tex_shader.uniform("tex0", 0);
  tex_shader.end();

  for (int i = 0; i < al_max_num_lights(); i += 1) {
    compileMultiLightShader(lighting_color_shader[i],
                            ShaderType::LIGHTING_COLOR, i + 1);
    compileMultiLightShader(lighting_mesh_shader[i], ShaderType::LIGHTING_MESH,
                            i + 1);
    compileMultiLightShader(lighting_tex_shader[i],
                            ShaderType::LIGHTING_TEXTURE, i + 1);
    compileMultiLightShader(lighting_material_shader[i],
                            ShaderType::LIGHTING_MATERIAL, i + 1);

    lighting_color_location[i] =
        lighting_color_shader[i].getUniformLocation("col0");
    lighting_color_tint_location[i] =
        lighting_color_shader[i].getUniformLocation("tint");
    lighting_mesh_tint_location[i] =
        lighting_mesh_shader[i].getUniformLocation("tint");
    lighting_tex_tint_location[i] =
        lighting_tex_shader[i].getUniformLocation("tint");
    lighting_material_tint_location[i] =
        lighting_material_shader[i].getUniformLocation("tint");

    lighting_color_uniforms[i] =
        al_get_lighting_uniform_locations(lighting_color_shader[i]);
    lighting_mesh_uniforms[i] =
        al_get_lighting_uniform_locations(lighting_mesh_shader[i]);
    lighting_tex_uniforms[i] =
        al_get_lighting_uniform_locations(lighting_tex_shader[i]);
    lighting_material_uniforms[i] =
        al_get_lighting_uniform_locations(lighting_material_shader[i]);

    lighting_tex_shader[i].begin();
    lighting_tex_shader[i].uniform("tex0", 0);
    lighting_tex_shader[i].end();
  }

  compileDefaultShader(omni_color_shader, ShaderType::COLOR, true);
  compileDefaultShader(omni_mesh_shader, ShaderType::MESH, true);
  compileDefaultShader(omni_tex_shader, ShaderType::TEXTURE, true);

  omni_color_location = omni_color_shader.getUniformLocation("col0");
  omni_color_tint_location = omni_color_shader.getUniformLocation("tint");
  omni_tex_tint_location = omni_tex_shader.getUniformLocation("tint");
  omni_mesh_tint_location = omni_mesh_shader.getUniformLocation("tint");

  omni_tex_shader.begin();
  omni_tex_shader.uniform("tex0", 0);
  omni_tex_shader.end();

  for (int i = 0; i < al_max_num_lights(); i += 1) {
    compileMultiLightShader(omni_lighting_color_shader[i],
                            ShaderType::LIGHTING_COLOR, i + 1, true);
    compileMultiLightShader(omni_lighting_mesh_shader[i],
                            ShaderType::LIGHTING_MESH, i + 1, true);
    compileMultiLightShader(omni_lighting_tex_shader[i],
                            ShaderType::LIGHTING_TEXTURE, i + 1, true);
    compileMultiLightShader(omni_lighting_material_shader[i],
                            ShaderType::LIGHTING_MATERIAL, i + 1, true);

    omni_lighting_color_location[i] =
        omni_lighting_color_shader[i].getUniformLocation("col0");
    omni_lighting_color_tint_location[i] =
        omni_lighting_color_shader[i].getUniformLocation("tint");
    omni_lighting_mesh_tint_location[i] =
        omni_lighting_mesh_shader[i].getUniformLocation("tint");
    omni_lighting_tex_tint_location[i] =
        omni_lighting_tex_shader[i].getUniformLocation("tint");
    omni_lighting_material_tint_location[i] =
        omni_lighting_material_shader[i].getUniformLocation("tint");

    omni_lighting_color_uniforms[i] =
        al_get_lighting_uniform_locations(lighting_color_shader[i]);
    omni_lighting_mesh_uniforms[i] =
        al_get_lighting_uniform_locations(lighting_mesh_shader[i]);
    omni_lighting_tex_uniforms[i] =
        al_get_lighting_uniform_locations(lighting_tex_shader[i]);
    omni_lighting_material_uniforms[i] =
        al_get_lighting_uniform_locations(lighting_material_shader[i]);

    omni_lighting_tex_shader[i].begin();
    omni_lighting_tex_shader[i].uniform("tex0", 0);
    omni_lighting_tex_shader[i].end();
  }

  for (int i = 0; i < al_max_num_lights(); i += 1) {
    mLightOn[i] = true;
  }

  initialized = true;
}

void Graphics::tint(const Color &c) {
  mTint = c;
  mUniformChanged = true;
}

void Graphics::tint(float r, float g, float b, float a) {
  mTint.set(r, g, b, a);
  mUniformChanged = true;
}

void Graphics::tint(float grayscale, float a) {
  tint(grayscale, grayscale, grayscale, a);
}

void Graphics::color() {
  if (mColoringMode != ColoringMode::UNIFORM) {
    mColoringMode = ColoringMode::UNIFORM;
    mRenderModeChanged = true;
  }
}

void Graphics::color(float r, float g, float b, float a) {
  mColor.set(r, g, b, a);
  mUniformChanged = true;
  color();
}

void Graphics::color(Color const &c) {
  mColor = c;
  mUniformChanged = true;
  color();
}

void Graphics::color(float grayscale, float a) {
  color(grayscale, grayscale, grayscale, a);
}

void Graphics::meshColor() {
  if (mColoringMode != ColoringMode::MESH) {
    mColoringMode = ColoringMode::MESH;
    mRenderModeChanged = true;
  }
}

void Graphics::texture() {
  if (mColoringMode != ColoringMode::TEXTURE) {
    mColoringMode = ColoringMode::TEXTURE;
    mRenderModeChanged = true;
  }
}

void Graphics::material() {
  if (mColoringMode != ColoringMode::MATERIAL) {
    mColoringMode = ColoringMode::MATERIAL;
    mRenderModeChanged = true;
  }
}
// set to material mode, using provied material
void Graphics::material(Material const &m) {
  mMaterial = m;
  mUniformChanged = true;
  material();
}

// enable/disable lighting
void Graphics::lighting(bool b) {
  if (mLightingEnabled != b) {
    mLightingEnabled = b;
    mRenderModeChanged = true;
  }
}

void Graphics::numLight(int n) {
  // if lighting on, should update change in light number
  // else it will get updated later when lighting gets enabled
  if (mLightingEnabled)
    mRenderModeChanged = true;
  num_lights = n;
}

// does not enable light, call lighting(true) to enable lighting
void Graphics::light(Light const &l, int idx) {
  mLights[idx] = l;
  // if lighting on, should update change in light info
  // else it will get updated later when lighting gets enabled
  if (mLightingEnabled)
    mUniformChanged = true;
  // change shader only if current number of light is less than given index
  if (num_lights <= idx)
    numLight(idx + 1);
}

void Graphics::enableLight(int idx) { mLightOn[idx] = true; }
void Graphics::disableLight(int idx) { mLightOn[idx] = false; }
void Graphics::toggleLight(int idx) { mLightOn[idx] = !mLightOn[idx]; }

void Graphics::quad(Texture &tex, float x, float y, float w, float h,
                    bool flip) {
  static Mesh m = [flip]() {
    Mesh m{Mesh::TRIANGLE_STRIP};
    m.vertex(0, 0, 0);
    m.vertex(0, 0, 0);
    m.vertex(0, 0, 0);
    m.vertex(0, 0, 0);
    if (flip) {
      m.texCoord(1, 1);
      m.texCoord(0, 1);
      m.texCoord(1, 0);
      m.texCoord(0, 0);
    } else {
      m.texCoord(0, 0);
      m.texCoord(1, 0);
      m.texCoord(0, 1);
      m.texCoord(1, 1);
    }
    return m;
  }();

  auto &verts = m.vertices();
  verts[0].set(x, y, 0);
  verts[1].set(x + w, y, 0);
  verts[2].set(x, y + h, 0);
  verts[3].set(x + w, y + h, 0);

  tex.bind(0);
  texture();
  draw(m);
  tex.unbind(0);
}

void Graphics::quadViewport(Texture &tex, float x, float y, float w, float h) {
  pushCamera();
  camera(Viewpoint::IDENTITY);
  bool prev_lighting = mLightingEnabled;
  lighting(false);
  quad(tex, x, y, w, h);
  lighting(prev_lighting); // put back previous lighting mode
  popCamera();
}

void Graphics::shader(ShaderProgram &s) {
  // Custom GLSL shaders don't work with WebGPU - WGSL is required
  if (sWebGPUMode) {
#ifdef __EMSCRIPTEN__
    static bool warned = false;
    if (!warned) {
      EM_ASM({
        console.warn('[Graphics::shader] Custom GLSL shaders are not supported in WebGPU mode.');
        console.warn('WebGPU requires WGSL shaders. The default shader will be used instead.');
      });
      warned = true;
    }
#endif
    // Don't set CUSTOM mode - keep using default shader
    return;
  }
  mColoringMode = ColoringMode::CUSTOM;
  RenderManager::shader(s);
}

ShaderProgram &Graphics::shader() { return RenderManager::shader(); }

ShaderProgram *Graphics::shaderPtr() { return RenderManager::shaderPtr(); }

void Graphics::camera(const Viewpoint &v) {
  mLens = v.lens();
  mUniformChanged = true;
  RenderManager::camera(v);
}

void Graphics::send_lighting_uniforms(ShaderProgram &s,
                                      lighting_shader_uniforms const &u) {
  s.uniform4v(u.global_ambient, Light::globalAmbient().components);
  s.uniformMatrix4(
      u.normal_matrix,
      (viewMatrix() * modelMatrix()).inversed().transpose().elems());
  for (int i = 0; i < u.num_lights; i += 1) {
    s.uniform4v(u.lights[i].ambient, mLights[i].ambient().components);
    s.uniform4v(u.lights[i].diffuse, mLights[i].diffuse().components);
    s.uniform4v(u.lights[i].specular, mLights[i].specular().components);
    s.uniform4v(u.lights[i].position, (viewMatrix() * Vec4f{mLights[i].pos()})
                                          .elems()); // could be optimized...
    s.uniform(u.lights[i].enabled,
              (mLightOn[i] ? 1.0f : 0.0f)); // could be optimized...
    // s.uniform4v(u.lights[i].atten, mLights[i].attenuation());
  }

  if (u.has_material) {
    s.uniform4v(u.material.ambient, mMaterial.ambient().components);
    s.uniform4v(u.material.diffuse, mMaterial.diffuse().components);
    s.uniform4v(u.material.specular, mMaterial.specular().components);
    s.uniform(u.material.shininess, mMaterial.shininess());
    // s.uniform4v(u.material.emission, mMaterial.emission().components);
  }
}

void Graphics::update() {
  if (mRenderModeChanged) {
    switch (mColoringMode) {
    case ColoringMode::UNIFORM:
      if (!is_omni)
        RenderManager::shader(mLightingEnabled
                                  ? lighting_color_shader[num_lights - 1]
                                  : color_shader);
      else
        RenderManager::shader(mLightingEnabled
                                  ? omni_lighting_color_shader[num_lights - 1]
                                  : omni_color_shader);
      break;
    case ColoringMode::MESH:
      if (!is_omni)
        RenderManager::shader(mLightingEnabled
                                  ? lighting_mesh_shader[num_lights - 1]
                                  : mesh_shader);
      else
        RenderManager::shader(mLightingEnabled
                                  ? omni_lighting_mesh_shader[num_lights - 1]
                                  : omni_mesh_shader);
      break;
    case ColoringMode::TEXTURE:
      if (!is_omni)
        RenderManager::shader(mLightingEnabled
                                  ? lighting_tex_shader[num_lights - 1]
                                  : tex_shader);
      else
        RenderManager::shader(mLightingEnabled
                                  ? omni_lighting_tex_shader[num_lights - 1]
                                  : omni_tex_shader);
      break;
    case ColoringMode::MATERIAL:
      if (!is_omni)
        RenderManager::shader(mLightingEnabled
                                  ? lighting_material_shader[num_lights - 1]
                                  : color_shader);
      else
        RenderManager::shader(
            mLightingEnabled ? omni_lighting_material_shader[num_lights - 1]
                             : omni_color_shader);
      break;
    case ColoringMode::CUSTOM:
      // do nothing
      break;
    }
    mRenderModeChanged = false;
    mUniformChanged = true; // force uniform update since shader changed
  }

  if (mUniformChanged) {
    auto &s = RenderManager::shader();
    switch (mColoringMode) {
    case ColoringMode::UNIFORM:
      if (mLightingEnabled) {
        if (!is_omni) {
          send_lighting_uniforms(s, lighting_color_uniforms[num_lights - 1]);
          s.uniform4v(lighting_color_location[num_lights - 1],
                      mColor.components);
          s.uniform4v(lighting_color_tint_location[num_lights - 1],
                      mTint.components);
        } else {
          send_lighting_uniforms(s,
                                 omni_lighting_color_uniforms[num_lights - 1]);
          s.uniform4v(omni_lighting_color_location[num_lights - 1],
                      mColor.components);
          s.uniform4v(omni_lighting_color_tint_location[num_lights - 1],
                      mTint.components);
        }
      } else {
        if (!is_omni) {
          s.uniform4v(color_location, mColor.components);
          s.uniform4v(color_tint_location, mTint.components);
        } else {
          s.uniform4v(omni_color_location, mColor.components);
          s.uniform4v(omni_color_tint_location, mTint.components);
        }
      }
      break;
    case ColoringMode::MESH:
      if (mLightingEnabled) {
        if (!is_omni) {
          send_lighting_uniforms(s, lighting_mesh_uniforms[num_lights - 1]);
          s.uniform4v(lighting_mesh_tint_location[num_lights - 1],
                      mTint.components);
        } else {
          send_lighting_uniforms(s,
                                 omni_lighting_mesh_uniforms[num_lights - 1]);
          s.uniform4v(omni_lighting_mesh_tint_location[num_lights - 1],
                      mTint.components);
        }
      } else {
        if (!is_omni) {
          s.uniform4v(mesh_tint_location, mTint.components);
        } else {
          s.uniform4v(omni_mesh_tint_location, mTint.components);
        }
      }
      break;
    case ColoringMode::TEXTURE:
      if (mLightingEnabled) {
        if (!is_omni) {
          send_lighting_uniforms(s, lighting_tex_uniforms[num_lights - 1]);
          s.uniform4v(lighting_tex_tint_location[num_lights - 1],
                      mTint.components);
        } else {
          send_lighting_uniforms(s, omni_lighting_tex_uniforms[num_lights - 1]);
          s.uniform4v(omni_lighting_tex_tint_location[num_lights - 1],
                      mTint.components);
        }
      } else {
        if (!is_omni)
          s.uniform4v(tex_tint_location, mTint.components);
        else
          s.uniform4v(omni_tex_tint_location, mTint.components);
      }
      break;
    case ColoringMode::MATERIAL:
      if (mLightingEnabled) {
        if (!is_omni) {
          send_lighting_uniforms(s, lighting_material_uniforms[num_lights - 1]);
          s.uniform4v(lighting_material_tint_location[num_lights - 1],
                      mTint.components);
        } else {
          send_lighting_uniforms(
              s, omni_lighting_material_uniforms[num_lights - 1]);
          s.uniform4v(omni_lighting_material_tint_location[num_lights - 1],
                      mTint.components);
        }
      } else {
        if (!is_omni) {
          s.uniform4v(color_location, mColor.components);
          s.uniform4v(color_tint_location, mTint.components);
        } else {
          s.uniform4v(omni_color_location, mColor.components);
          s.uniform4v(omni_color_tint_location, mTint.components);
        }
      }
      break;
    case ColoringMode::CUSTOM:
      // do nothing
      break;
    }

    // for any default shaders, needs to be cleaned up with other uniforms
    // (using pre saved location, or possibly uniform buffer)
    if (mColoringMode != ColoringMode::CUSTOM) {
      s.uniform("eye_sep", mLens.eyeSep() * mEye / 2.0f);
      s.uniform("foc_len", mLens.focalLength());

      // WebGL2 FIX: Set point size uniform
      // In WebGL2/OpenGL ES 3.0, glPointSize() doesn't exist.
      // Point size must be set via gl_PointSize in the vertex shader,
      // which reads from the al_PointSize uniform.
      s.uniform("al_PointSize", gl::getPointSize());
    }
    mUniformChanged = false;
  }

  // also call base class's update
  RenderManager::update();
}

void Graphics::eye(float e) {
  mEye = e;
  mUniformChanged = true;
}

Lens &Graphics::lens() {
  mUniformChanged = true;
  return mLens;
}

void Graphics::lens(const Lens &l) {
  mUniformChanged = true;
  mLens = l;
}

void Graphics::omni(bool b) {
  is_omni = b;
  mRenderModeChanged = true;
}

bool Graphics::omni() { return is_omni; }

// ─── WebGPU Backend Draw Routing ─────────────────────────────────────────────

#ifdef ALLOLIB_WEBGPU
// Helper: compute 3x3 matrix inverse for normal matrix
static bool invert3x3(const float* m, float* inv) {
    // m is column-major 3x3 stored as m[col*3 + row]
    float det = m[0] * (m[4] * m[8] - m[7] * m[5])
              - m[3] * (m[1] * m[8] - m[7] * m[2])
              + m[6] * (m[1] * m[5] - m[4] * m[2]);

    if (std::abs(det) < 1e-10f) return false;

    float invDet = 1.0f / det;

    inv[0] = (m[4] * m[8] - m[7] * m[5]) * invDet;
    inv[1] = (m[7] * m[2] - m[1] * m[8]) * invDet;
    inv[2] = (m[1] * m[5] - m[4] * m[2]) * invDet;
    inv[3] = (m[6] * m[5] - m[3] * m[8]) * invDet;
    inv[4] = (m[0] * m[8] - m[6] * m[2]) * invDet;
    inv[5] = (m[3] * m[2] - m[0] * m[5]) * invDet;
    inv[6] = (m[3] * m[7] - m[6] * m[4]) * invDet;
    inv[7] = (m[6] * m[1] - m[0] * m[7]) * invDet;
    inv[8] = (m[0] * m[4] - m[3] * m[1]) * invDet;

    return true;
}

// Helper: sync lighting state from Graphics to WebGPU backend
static void syncLightingToBackend(Graphics& g, const Mat4f& mv) {
    auto* backend = dynamic_cast<WebGPUBackend*>(sGraphicsBackend);
    if (!backend) return;

    bool lightingOn = g.lightingEnabled();
    backend->setLightingEnabled(lightingOn);

    if (!lightingOn) return;

    // Compute normal matrix = transpose(inverse(upper-left 3x3 of modelView))
    // Extract upper-left 3x3 from modelView (column-major)
    const float* mvElems = mv.elems();
    float mv3x3[9] = {
        mvElems[0], mvElems[1], mvElems[2],   // column 0
        mvElems[4], mvElems[5], mvElems[6],   // column 1
        mvElems[8], mvElems[9], mvElems[10]   // column 2
    };

    float invMv3x3[9];
    if (invert3x3(mv3x3, invMv3x3)) {
        // Transpose the inverse to get normal matrix
        float normalMat[9] = {
            invMv3x3[0], invMv3x3[3], invMv3x3[6],
            invMv3x3[1], invMv3x3[4], invMv3x3[7],
            invMv3x3[2], invMv3x3[5], invMv3x3[8]
        };
        backend->setNormalMatrix(normalMat);
    } else {
        // Fallback: use upper-left 3x3 directly (works for rotation-only transforms)
        backend->setNormalMatrix(mv3x3);
    }

    // Sync global ambient
    Color globalAmb = Light::globalAmbient();
    backend->setGlobalAmbient(globalAmb.r, globalAmb.g, globalAmb.b, globalAmb.a);

    // Sync lights
    int numLights = g.numLights();
    for (int i = 0; i < numLights && i < 8; i++) {
        const Light& light = g.getLight(i);
        bool enabled = g.isLightOn(i);

        float pos[4] = {light.pos()[0], light.pos()[1], light.pos()[2], light.pos()[3]};
        float amb[4] = {light.ambient().r, light.ambient().g, light.ambient().b, light.ambient().a};
        float diff[4] = {light.diffuse().r, light.diffuse().g, light.diffuse().b, light.diffuse().a};
        float spec[4] = {light.specular().r, light.specular().g, light.specular().b, light.specular().a};
        // AlloLib Light doesn't expose attenuation, use default (no attenuation)
        float atten[3] = {1.0f, 0.0f, 0.0f};  // constant=1, linear=0, quadratic=0

        backend->setLight(i, pos, amb, diff, spec, atten, enabled);
    }

    // Sync material
    const Material& mat = g.getMaterial();
    float matAmb[4] = {mat.ambient().r, mat.ambient().g, mat.ambient().b, mat.ambient().a};
    float matDiff[4] = {mat.diffuse().r, mat.diffuse().g, mat.diffuse().b, mat.diffuse().a};
    float matSpec[4] = {mat.specular().r, mat.specular().g, mat.specular().b, mat.specular().a};
    // AlloLib Material doesn't expose emission, use default (black/none)
    float matEmis[4] = {0.0f, 0.0f, 0.0f, 0.0f};
    backend->setMaterial(matAmb, matDiff, matSpec, matEmis, mat.shininess());
}
#endif // ALLOLIB_WEBGPU

static void drawMeshWithWebGPU(Graphics& g, const Mesh& m) {
    // Sync matrices
    Mat4f model = g.modelMatrix();
    Mat4f view = g.viewMatrix();
    Mat4f mv = view * model;
    Mat4f proj = g.projMatrix();

#ifdef __EMSCRIPTEN__
    static int matrixLogCount = 0;
    if (matrixLogCount < 3) {
        // Log model matrix translation (column 3)
        EM_ASM({
            console.log('[WebGPU Matrix] Model translation: (' + $0 + ', ' + $1 + ', ' + $2 + ')');
        }, model.elems()[12], model.elems()[13], model.elems()[14]);

        // Log view matrix (position is embedded in column 3)
        EM_ASM({
            console.log('[WebGPU Matrix] View[12-14]: (' + $0 + ', ' + $1 + ', ' + $2 + ')');
        }, view.elems()[12], view.elems()[13], view.elems()[14]);

        // Log modelView result translation
        EM_ASM({
            console.log('[WebGPU Matrix] ModelView translation: (' + $0 + ', ' + $1 + ', ' + $2 + ')');
        }, mv.elems()[12], mv.elems()[13], mv.elems()[14]);

        // Log projection matrix diagonal (aspect ratio info)
        EM_ASM({
            console.log('[WebGPU Matrix] Proj diagonal: (' + $0 + ', ' + $1 + ', ' + $2 + ', ' + $3 + ')');
        }, proj.elems()[0], proj.elems()[5], proj.elems()[10], proj.elems()[15]);

        matrixLogCount++;
    }
#endif

    sGraphicsBackend->setUniformMat4("modelViewMatrix", mv.elems());
    sGraphicsBackend->setUniformMat4("projectionMatrix", proj.elems());

    // Sync uniforms using accessors
    Color tint = g.currentTint();
    Color col = g.currentColor();
    sGraphicsBackend->setUniform("tint", tint.r, tint.g, tint.b, tint.a);
    sGraphicsBackend->setUniform("color", col.r, col.g, col.b, col.a);
    sGraphicsBackend->setUniform("pointSize", gl::getPointSize());
    sGraphicsBackend->setUniform("eyeSep", static_cast<float>(g.lens().eyeSep() * g.eye() / 2.0f));
    sGraphicsBackend->setUniform("focLen", static_cast<float>(g.lens().focalLength()));

#ifdef ALLOLIB_WEBGPU
    // Sync lighting state (Phase 2)
    syncLightingToBackend(g, mv);
#endif

    // Prepare and draw mesh
    if (sMeshAdapter.prepareMesh(m)) {
        PrimitiveType prim = meshPrimitiveToPrimitiveType(m.primitive());
        sMeshAdapter.drawMesh(prim);
    }
}

void Graphics::draw(const Mesh& mesh) {
#ifdef __EMSCRIPTEN__
    static int drawCount = 0;
    if (drawCount < 5) {
        EM_ASM({ console.log('[Graphics::draw] Entry, count=' + $0 + ', WebGPU=' + $1); }, drawCount, sWebGPUMode ? 1 : 0);
    }
#endif

    if (sWebGPUMode && sGraphicsBackend) {
#ifdef __EMSCRIPTEN__
        if (drawCount < 5) {
            EM_ASM({ console.log('[Graphics::draw] Calling drawMeshWithWebGPU...'); });
        }
#endif
        drawMeshWithWebGPU(*this, mesh);
#ifdef __EMSCRIPTEN__
        if (drawCount < 5) {
            EM_ASM({ console.log('[Graphics::draw] drawMeshWithWebGPU done'); });
            drawCount++;
        }
#endif
        return;
    }

    // Standard WebGL2 path - delegate to RenderManager
#ifdef __EMSCRIPTEN__
    if (drawCount < 5) {
        EM_ASM({ console.log('[Graphics::draw] Using WebGL2 path'); });
        drawCount++;
    }
#endif
    RenderManager::draw(mesh);
}

void Graphics::draw(Mesh&& mesh) {
    if (sWebGPUMode && sGraphicsBackend) {
        drawMeshWithWebGPU(*this, mesh);
        return;
    }

    // Standard WebGL2 path - delegate to RenderManager
    RenderManager::draw(std::move(mesh));
}

void Graphics::draw(VAOMesh& mesh) {
    if (sWebGPUMode && sGraphicsBackend) {
        // VAOMesh is a Mesh, route through backend
        drawMeshWithWebGPU(*this, mesh);
        return;
    }

    // Standard WebGL2 path - delegate to RenderManager
    RenderManager::draw(mesh);
}

void Graphics::draw(EasyVAO& vao) {
    // EasyVAO doesn't have mesh data we can extract for WebGPU
    // Just delegate to RenderManager
    RenderManager::draw(vao);
}

void Graphics::clear(float r, float g, float b, float a) {
    if (sWebGPUMode && sGraphicsBackend) {
        sGraphicsBackend->clear(r, g, b, a);
        return;
    }

    // Standard WebGL2 path
    gl::clearColor(r, g, b, a);
    gl::clearDepth(1.f);
}

void Graphics::clear(float grayscale, float a) {
    clear(grayscale, grayscale, grayscale, a);
}

void Graphics::clear(Color const& c) {
    clear(c.r, c.g, c.b, c.a);
}

// ─── WebGPU-safe Viewport ────────────────────────────────────────────────────

void Graphics::viewport(int left, int bottom, int width, int height) {
    // Update the viewport stack (same as base class)
    mViewportStack.set(left, bottom, width, height);

    // Skip glViewport in WebGPU mode - the backend manages its own viewport
    if (sWebGPUMode) {
        // Optionally, sync viewport to backend
        if (sGraphicsBackend) {
            sGraphicsBackend->viewport(left, bottom, width, height);
        }
        return;
    }

    // WebGL2 path - call glViewport
    gl::viewport(left, bottom, width, height);
}

void Graphics::popViewport() {
    // Pop from the stack (same as base class)
    mViewportStack.pop();
    // Re-apply the viewport at the top of the stack using our override
    Viewport v = mViewportStack.get();
    viewport(v);
}

} // namespace al
