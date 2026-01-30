# WebGL2 Point Size Fix - Investigation Notes

## Original Issue
Mesh Primitives examples showed "function signature mismatch" error in WASM during render loop, while other examples (Studio) worked fine.

## Root Cause
In WebGL2/OpenGL ES 3.0, `glPointSize()` doesn't exist. The function was being loaded as a NULL pointer via GLAD, and calling it caused a WASM "function signature mismatch" crash.

## Solution

### 1. GLAD Wrapper (`allolib-wasm/include/glad/glad.h`)
Created a wrapper that intercepts `glPointSize()` calls:
```c
#undef glPointSize
#define glPointSize(size) al_web_set_point_size(size)
```
Also patches `glPolygonMode` and `glDrawBuffer` which don't exist in WebGL2.

### 2. Point Size Storage (`al_WebGL2Extensions.cpp`)
Added functions to store and retrieve point size:
- `al_web_set_point_size(float size)` - stores the value
- `al_web_get_point_size()` - retrieves for shader uniform
- `al::gl::getPointSize()` - C++ API

### 3. Shader Uniform (`al_DefaultShaders.hpp`)
Added `al_PointSize` uniform to vertex shaders:
```glsl
uniform float al_PointSize;
gl_PointSize = al_PointSize > 0.0 ? al_PointSize : 5.0;
```

### 4. Uniform Setting (`al_WebApp.cpp`)
Set the uniform before each frame in `tick()`:
```cpp
float pointSize = gl::getPointSize();
if (pointSize > 0.0f) {
    mGraphics->shader().uniform("al_PointSize", pointSize);
}
```

### 5. JS Bridge (`al_WebApp.cpp`)
Added `window.allolib.graphics.setPointSize(size)` for UI control.

### 6. Frontend Integration (`settings.ts`, `runtime.ts`)
- `notifyDisplayChange()` sends point size to WASM
- Watcher triggers on slider change
- Initial settings applied on app start

## Failed Attempt - DO NOT REPEAT

**What was tried:**
- Modified CMakeLists.txt to exclude desktop `al_Graphics.cpp` and `al_OpenGL.cpp`
- Added `al_Graphics_Web.cpp` and `al_OpenGL_Web.cpp` to WEB_SOURCES

**Result:** BROKE ALL EXAMPLES

**Reason:** The desktop al_Graphics.cpp and al_OpenGL.cpp are required. The web versions were incomplete replacements.

## Files Modified/Created

### New Files:
- `allolib-wasm/include/glad/glad.h` - GLAD wrapper
- `allolib-wasm/include/al/graphics/al_OpenGL.hpp` - Patched header with getPointSize()

### Modified Files:
- `allolib-wasm/include/al/graphics/al_DefaultShaders.hpp` - Added al_PointSize uniform
- `allolib-wasm/src/al_WebGL2Extensions.cpp` - Point size storage functions
- `allolib-wasm/src/al_WebApp.cpp` - JS bridge and uniform setting
- `frontend/src/stores/settings.ts` - notifyDisplayChange()
- `frontend/src/services/runtime.ts` - Apply initial settings

## Testing
- Points Only Test: WORKS
- Mesh Primitives: WORKS
- UI Point Size Slider: WORKS (Settings → Display → Default Point Size)
