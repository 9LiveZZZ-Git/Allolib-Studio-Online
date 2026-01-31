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

---

# Auto-LOD System Fixes

## Issues Found

1. **LOD 0 not true full quality**: The `generate()` function in `al_WebLOD.hpp` called `compress()` on LOD 0 meshes, which could modify geometry by merging duplicate vertices.

2. **Missing minFullQualityDistance**: Objects close to camera should always use LOD 0, but this setting wasn't connected from the UI.

3. **LOD not being enabled**: Quality preset changes didn't enable the auto-LOD system.

4. **Missing global drawLOD()**: Users needed to access WebApp instance to use LOD.

## Fixes Applied

### 1. LOD 0 True Full Quality (`al_WebLOD.hpp`)
Removed `compress()` call for LOD 0:
```cpp
if (i == 0) {
    // LOD 0: TRUE FULL QUALITY - preserve exact original mesh unchanged
    // Do NOT call compress() as it can merge vertices and lose detail
    mLevels[i].mesh.copy(source);
}
```

### 2. MinFullQualityDistance Support (`al_WebAutoLOD.hpp`)
Added member variable and forced LOD 0 for close objects:
```cpp
float mMinFullQualityDistance = 5.0f;

int selectLODLevel(...) {
    // ALWAYS use LOD 0 (full quality) within minimum distance
    if (distance < mMinFullQualityDistance) {
        return 0;
    }
    // ... rest of selection logic
}
```

### 3. JS Bridge Functions (`al_WebApp.cpp`)
Added new bridge functions:
- `al_autolod_set_min_full_quality_distance(float distance)`
- `al_autolod_set_distances(float d0, float d1, float d2, float d3)`

And registered them in JavaScript:
```javascript
window.allolib.autoLOD.setMinFullQualityDistance(distance)
window.allolib.autoLOD.setDistances(d0, d1, d2, d3)
```

### 4. Enable LOD from Settings (`settings.ts`)
Added `setEnabled` call when quality preset is applied:
```typescript
// Enable auto-LOD when texture LOD is enabled
w.allolib.autoLOD.setEnabled(graphics.value.textureLODEnabled)
```

### 5. Global drawLOD() Function (`al_WebAutoLOD.hpp`)
Added convenience functions for transpiler compatibility:
```cpp
inline void drawLOD(Graphics& g, const Mesh& mesh) {
    if (gAutoLODInstance && gAutoLODInstance->enabled()) {
        const Mesh& selected = gAutoLODInstance->selectMesh(mesh, g.modelMatrix());
        g.draw(selected);
    } else {
        g.draw(mesh);
    }
}

inline void enableAutoLOD(int levels = 4);
inline void disableAutoLOD();
```

## UI Control Flow

1. User selects quality preset (low/medium/high/ultra) in Settings → Graphics
2. `applyQualityPreset()` sets `textureLODEnabled`, `lodBias`, `lodMinFullQualityDistance`, `lodDistances`
3. `notifyQualityChange()` sends all settings to WASM via JS bridge
4. Auto-LOD system receives settings and enables/disables accordingly

## Quality Presets LOD Settings

| Preset | LOD Enabled | LOD Bias | Min Full Quality Dist | Distance Thresholds |
|--------|-------------|----------|----------------------|---------------------|
| Low    | Yes         | 2.0      | 2                    | 5, 15, 30, 60       |
| Medium | Yes         | 1.5      | 5                    | 10, 25, 50, 100     |
| High   | Yes         | 1.0      | 8                    | 15, 35, 70, 150     |
| Ultra  | No          | 0.75     | 15                   | 25, 60, 120, 250    |
| Auto   | Yes         | 1.0      | 8                    | 15, 35, 70, 150     |

## Files Modified

### C++ (allolib-wasm):
- `include/al_WebLOD.hpp` - Fixed LOD 0 to not call compress()
- `include/al_WebAutoLOD.hpp` - Added minFullQualityDistance, global drawLOD()
- `src/al_WebApp.cpp` - Added JS bridge for new functions

### TypeScript (frontend):
- `src/stores/settings.ts` - Added setEnabled call, updated log message
