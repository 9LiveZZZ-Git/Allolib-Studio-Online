# Native Compatibility Audit — Graphics

Scope: `al/graphics/*` plus `al/ui/al_BoundingBox*`, `al/math/al_{Plane,Frustum}` (the graphics-flavored ones). Compared against `allolib-wasm/` and `frontend/src/services/transpiler.ts`. Audit-only.

## Already covered

| Native API | Web equivalent | File:line |
|---|---|---|
| `al::Graphics` (RenderManager subclass) | shadowed `al::Graphics` | `allolib-wasm/include/al/graphics/al_Graphics.hpp:29` |
| `Graphics::blendAdd/Sub/Screen/Mult/Trans/Mode/blending` | inline forwarders to `gl::blendMode` | `al_Graphics.hpp:47-67` |
| `Graphics::depthTesting/depthMask/scissorTest/scissorArea` | inline forwarders | `al_Graphics.hpp:70-78` |
| `Graphics::culling/cullFace[Back/Front/Both]` | inline forwarders | `al_Graphics.hpp:81-86` |
| `Graphics::polygonMode/Point/Line/Fill` | inline forwarders | `al_Graphics.hpp:89-95` |
| `Graphics::colorMask/pointSize/lineWidth` | inline forwarders | `al_Graphics.hpp:98-105` |
| `Graphics::clear/clearColor/clearDepth/clearBuffer` | backend-aware override | `al_Graphics.hpp:108-131`, `src/al_Graphics_Web.cpp` |
| `Graphics::draw(Mesh/VAOMesh/EasyVAO)` | backend-aware override + `WebMeshAdapter` | `al_Graphics.hpp:136-139`, `src/al_WebMeshAdapter.cpp` |
| `Graphics::viewport/pushViewport/popViewport` | backend-aware override | `al_Graphics.hpp:144-163` |
| `Graphics::tint/color/meshColor/texture/material/lighting/light/numLight/enableLight/disableLight/toggleLight` | preserved | `al_Graphics.hpp:165-206` |
| `Graphics::quad/quadViewport/shader/camera/eye/lens/omni` | preserved | `al_Graphics.hpp:208-238` |
| `Graphics::ColoringMode` enum | preserved | `al_Graphics.hpp:31-37` |
| `RenderManager::translate/rotate/scale/pushMatrix/popMatrix/loadIdentity/multModelMatrix` | inherited from native header | `allolib/include/al/graphics/al_RenderManager.hpp` (used as-is) |
| `Mesh` (vertices/colors/normals/texCoords/indices/primitive) | upstream class used as-is, drawn via `WebMeshAdapter::createInterleavedData` | `allolib-wasm/include/al_WebMeshAdapter.hpp:57` |
| `VAOMesh::update/bind/unbind` | upstream + `Graphics::draw(VAOMesh&)` override | `al_Graphics.hpp:136` |
| `EasyVAO` | upstream + `Graphics::draw(EasyVAO&)` override | `al_Graphics.hpp:137` |
| `Texture` (bind/unbind/filter/wrap/mipmap/submit/resize) | upstream native header + WebGL2 path | `allolib-wasm/src/al_Texture_Web.cpp` |
| `FBO/RBO::bind/unbind/attach*/status` | upstream native header + WebGL2 path | `allolib-wasm/src/al_FBO_Web.cpp` |
| `EasyFBO/EasyFBOSetting` (init/begin/end/bind/tex/depthTex/fbo/rbo) | shadowed with WebGPU bridge dtor | `allolib-wasm/include/al/graphics/al_EasyFBO.hpp:85` + `src/al_EasyFBO_Web.cpp` |
| `Shader/ShaderProgram::compile/link/begin/end/uniform/attribute/getUniformLocation` | upstream native header used as-is in WebGL2 | `allolib-wasm/include/al_WebShaders.hpp` (mgr) |
| `ShaderProgram::Type` enum (FLOAT/VEC*/MAT*/SAMPLER_*) | upstream | n/a |
| `BufferObject::bind/unbind/usage/bufferType/size` | upstream | n/a |
| `Lens` (fovy/near/far/eyeSep/focalLength/fovx/heightAt*) | upstream | n/a |
| `Light/Material` (pos/dir/ambient/diffuse/specular) | upstream + `Graphics::send_lighting_uniforms` | `al_Graphics.hpp:221-222` |
| `Viewpoint` (lens/pose/viewport/SpecialType) | upstream | n/a |
| `Viewport` struct (l/b/w/h, set, aspect) | upstream | n/a |
| `Color/Colori/HSV/RGB/HCLab/CIE_XYZ/Lab/Luv` | upstream (header-only) | n/a |
| `BoundingBox/BoundingBoxData` (set/setCenterDim/getMesh/draw) | upstream | n/a |
| `Plane/Frustum` (testPoint/testSphere/testBox/computePlanes) | upstream (header-only, math) | n/a |
| `Image::load/save/pixels/array/width/height/at/read/write/resize` | upstream `al_Image.hpp` works (libpng/jpg via Emscripten); `WebImage` provides async browser-side alt | `allolib-wasm/include/al_WebImage.hpp:34` |
| `DefaultShaders` (`al_max_num_lights`, `lighting_shader_uniforms`, `ShaderType`) | shadowed | `allolib-wasm/include/al/graphics/al_DefaultShaders.hpp` |
| `GPUObject::create/destroy/onCreate/onDestroy` | upstream | n/a |
| OBJ loading (Wavefront, ad-hoc — not in upstream Graphics module) | `WebOBJ` + transpiler maps `al_ext/assets3d/al_Asset.hpp` → `al_WebOBJ.hpp` | `transpiler.ts:117-122`; `al_WebOBJ.hpp` |
| Web-only PBR/HDR/Environment/AutoLOD/Procedural/MipmapTexture | first-class headers + native_compat shims | `allolib-wasm/include/al_Web*.hpp`, `include/native_compat/*` |

## Missing — high severity

- **`al_ext/assets3d/al_Asset.hpp` (Scene/Asset3D via Assimp)**
  - signature: `class Scene { static Scene* import(const std::string& filename, ...); ... }; class Asset3D;`
  - matters: native examples load FBX/GLTF/COLLADA via Assimp; transpiler rewrites the include but `WebOBJ` only handles `.obj` (and not materials, multi-mesh, animation, skeletons).
  - approach: either widen `WebOBJ` to a multi-format loader (gltf is high-value, has JS reference impls) or document Assimp-only formats as unsupported and convert assets at upload time.

- **`al::Font` / `al_Font.hpp` (FreeType-backed)**
  - signature: `Font; Font::load(const char* filename, int size, int dpi=96); Font::render(Graphics&, const char*, ...);`
  - matters: native uses freetype + a path; web uses CSS-family + Canvas atlas. `al_compat_font.hpp` papers over this with `using Font = WebFont`, but signatures differ (`load("Arial", 24)` vs `load("/path/font.ttf", 24)`).
  - approach: parse TTF path in `WebFont::load` and try to fetch as a `@font-face` URL before falling back to family name. Also add a transpiler include rewrite for `al/graphics/al_Font.hpp` → `al_compat_font.hpp` (currently no rewrite exists).

- **`Graphics::quadViewport(Texture&, ...)` — WebGPU path**
  - signature: `void quadViewport(Texture& tex, float x=-1, float y=-1, float w=2, float h=2);`
  - matters: declared in shadowed header but only the WebGL2 path exists in `al_Graphics_Web.cpp`. Many post-FX/full-screen-quad examples rely on this.
  - approach: route through `GraphicsBackend::draw` with a unit-quad mesh and the texture set on sampler 0 when `Graphics_isWebGPU()`.

- **`Graphics::omni(bool)` / `omni()` (Allosphere stereo/omni rendering)**
  - signature: `void omni(bool b); bool omni();`
  - matters: declared but the omni shader paths (`omni_color_shader`, `omni_lighting_*`) only initialize on WebGL2; running an omni example on WebGPU is silently broken.
  - approach: skip omni shader compile in WebGPU mode and disable `omni(true)` with a runtime warning, OR port the omni vertex displacement to WGSL.

- **3D textures (`Texture::create3D`, `Texture::submit` for `GL_TEXTURE_3D`, `resize(w,h,d)`)**
  - signature: `void create3D(...); void resize(unsigned w, unsigned h, unsigned d);` (`al_Texture.hpp:265,276`)
  - matters: WebGL2 supports 3D textures and a few volumetric examples use them; our `WebTexture` and `TextureBridge` paths assume 2D. WebGPU also supports 3D textures.
  - approach: extend `TextureDesc` (already has `depth`) all the way through `createTexture` / `updateTexture` so `Texture_Web.cpp` can route 3D submits.

- **`Texture::copyFrameBuffer(...)`**
  - signature: `void copyFrameBuffer(int w=-1, int h=-1, int fbx=0, int fby=0, int texx=0, int texy=0, int texz=0);`
  - matters: used by post-FX / motion-blur / ping-pong examples; `glCopyTexSubImage2D` exists in WebGL2 but no WebGPU implementation in `WebGPUBackend`.
  - approach: emulate on WebGPU via `commandEncoder.copyTextureToTexture` between the swap-chain texture and the destination handle.

- **Geometry shaders (`ShaderProgram::compile(vert, frag, geom)`)**
  - signature: `bool compile(const std::string& vert, const std::string& frag, const std::string& geom="");`
  - matters: API accepts a `geom` source; WebGL2 has no geometry shaders, WebGPU has none either. Examples that pass a non-empty `geom` arg silently lose it.
  - approach: when `geom != ""`, emit a transpile-time warning (currently silent) and add a comment line in the rewritten code; document the limitation.

- **`bind_temp()` / multi-binding-point texture binds**
  - signature: `Texture::bind(int binding_point=0); Texture::unbind(int binding_point=0); Texture::bind_temp();`
  - matters: present in upstream; verify `al_Texture_Web.cpp` honors `binding_point`. Risk for shader-heavy examples that bind multiple textures simultaneously.

## Missing — low severity

- **`Mesh::saveSTL/savePLY/save`** — file I/O writes; native fopen path won't be useful in browser. No web implementation. Suggest stub-out with console warning.
- **`Mesh::print(FILE*)/debug(FILE*)`** — work via stdout but `FILE*` arg patterns are odd in web; usually fine.
- **`ShaderProgram::listParams/validateProgram(printLog=true)`** — work with WebGL2; on WebGPU, no equivalent reflection. Low impact.
- **`ShaderProgram::Type::SAMPLER_RECT / SAMPLER_1D / SAMPLER_1D_SHADOW`** — WebGL2/WebGPU have no `sampler1D` or `sampler2DRect`. Already absent at the GLSL level; enums exist but unusable.
- **`Texture::numComponents(Format)`** — static helper; works since enum is the native one.
- **`RBO::maxSize()`** — static, returns `glGetIntegerv(GL_MAX_RENDERBUFFER_SIZE)`. Works in WebGL2; trivial WebGPU equivalent.
- **`Lens::getFovyForFovX/getFovyForHeight`** — pure math; works.
- **`Plane::distance/Frustum::testPoint/testSphere/testBox`** — header-only math; works.
- **`BoundingBox::draw(Graphics&, bool drawTics)`** — depends on `al_Shapes.hpp`; works as long as Shapes is buildable in WASM.
- **`Image::saveImage` / `Image::compression`** — saving works in node-fs (Emscripten FS) but not directly to disk in browser. Document only.
- **`per-projection rendering` (`PerProjectionRender`, `OmniRendererDomain`)** — Allosphere-specific, multi-machine/distributed. Out of scope for browser; transpiler already collapses `DistributedApp` → `WebApp`.
- **`FBOStack`** — minor utility; verify it compiles with our shadowed FBO.
- **`ViewportStack`** — pushViewport/popViewport stack; covered via `RenderManager::pushViewport` re-export.

## Transpiler gaps

`frontend/src/services/transpiler.ts` only rewrites two graphics-related includes (`al_ext/assets3d/al_Asset.hpp` → `al_WebOBJ.hpp`; `al_WebImage.hpp` ↔ `al/graphics/al_Image.hpp`). The following native graphics includes are untouched and rely on header shadowing or bare passthrough — fine when the headers exist verbatim, but worth listing because each is a friction point if a native example uses an unusual variant:

- `#include <al/graphics/al_Graphics.hpp>` — passthrough; relies on shadow ordering. OK but no warning if shadow misses.
- `#include <al/graphics/al_Font.hpp>` — **NO rewrite**. Native Font ≠ WebFont. Add: rewrite to `al_compat_font.hpp`.
- `#include <al/graphics/al_Asset.hpp>` (older path) — only `al_ext/assets3d/al_Asset.hpp` is rewritten; the bare `al/graphics/al_Asset*` (and `al_Asset_data`) variants pass through.
- `#include <al/graphics/al_FBO.hpp>` / `al_EasyFBO.hpp` — passthrough; relies on shadow. Confirm shadow includes for direct-include examples.
- `#include <al/graphics/al_DefaultShaderString.hpp>` — passthrough (we have `src/al_DefaultShaderString_Web.cpp`); confirm header exists in shadow path.
- `#include <al/graphics/al_GPUObject.hpp>` — passthrough; native is fine since `onCreate/onDestroy` are pure virtual.
- `#include <al/graphics/al_BufferObject.hpp>` — passthrough.
- `#include <al/graphics/al_VAO.hpp>` and `al_VAOMesh.hpp` — passthrough.

Class/template patterns the transpiler does NOT touch but may need future handling:

- `al::PerProjectionRender`, `al::ProjectionViewport`, `al::GLFWOpenGLOmniRendererDomain`, `al::OpenGLGraphicsDomain` — Allosphere/desktop-only; should be stripped or stubbed when seen in user code (currently compile-fail).
- `al::Asset3D scene; scene.import(...)` — only the `#include` line is rewritten; the class and method calls survive untouched and will fail to link unless the user manually switches to `WebOBJ::parse`.
- `al::Font font; font.load("/path.ttf", 24)` — no class rewrite. Add `\bal::Font\b` → `al::WebFont` (or rely on `al_compat_font.hpp` typedef and just rewrite the include).
- `Graphics::geometryShader(...)` / `ShaderProgram::compile(v, f, g)` with non-empty `g` — silently drops the geom shader. Add a transpile warning.
- `glPointSize`, `glBegin`/`glEnd` — already warned about (`transpiler.ts:670, 677`).
- `glPolygonMode(GL_POINT)` and `glPolygonMode(GL_LINE)` — WebGL2 only supports `GL_FILL` for `glPolygonMode`; native `polygonPoint()/polygonLine()` would silently fail. Worth a transpiler warning for direct GL calls.

