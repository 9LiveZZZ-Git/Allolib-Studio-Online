# WebGPU FBO/Render-to-Texture Debug Session Notes

**Date:** 2026-02-06
**Issue:** WebGPU FBO tests show black canvas when they should display rendered content

## Problem Summary

The WebGPU render-to-texture test (`basic render-to-texture works (WebGPU)`) fails because the canvas shows only black when drawing a textured quad using an FBO's color texture. WebGL2 works correctly.

Test: `tests/e2e/webgpu-features.spec.ts` line 1151

## What Was Done This Session

### 1. Initial Investigation
- Traced the texture binding flow: EasyFBO -> sTextureBridge -> mTextures -> bind group
- Verified FBO registration flow is correct
- Added debug printf statements throughout the draw path

### 2. Bug Fixes Attempted

#### Fix 1: Bind Group for Screen-Space Shader
**Problem:** When using screen-space shader, the code was entering `else` branch using `shaderIt->second.bindGroup` instead of `mTexturedBindGroup`.

**Fix Applied:** Modified condition at line 2436 from:
```cpp
} else if (useTextured && !mCurrentShader.valid()) {
```
to:
```cpp
} else if ((useTextured || useScreenSpace) && !mCurrentShader.valid()) {
```

#### Fix 2: Bind Group Layout Compatibility
**Problem:** In WebGPU, bind groups must be created with the exact layout used by the pipeline. `updateTexturedBindGroup()` was using textured shader's layout even when screen-space shader was selected.

**Fix Applied:** Added shader parameter to `updateTexturedBindGroup()`:
- `allolib-wasm/src/al_WebGPUBackend.cpp` line 3354: Changed signature to `void WebGPUBackend::updateTexturedBindGroup(ShaderHandle shaderToUse)`
- `allolib-wasm/include/al_WebGPUBackend.hpp` line 573: Updated declaration
- Updated all call sites to pass the appropriate shader

#### Fix 3: Debug Shaders
- Added debug magenta output to textured fragment shader (line 203-205)
- Added debug cyan output to screen-space fragment shader (line 293)
- Neither debug color appears -> the quad isn't rendering at all or a different code path is used

### 3. Debug Output Added
Key debug messages added to `al_WebGPUBackend.cpp`:
- `[draw] ENTRY call=%d hasTex=%d` (line 2358)
- `[draw] useScreenSpace conditions:` (line 2387)
- `[draw] SCREEN-SPACE PATH:` or `[draw] TEXTURED PATH:` (line 2390-2393)
- `[draw] primitive=%d` (line 2475) - **THIS APPEARS IN OUTPUT**
- `[draw] Executing draw: vertexCount=%d, firstVertex=%d` (line 2487) - **THIS APPEARS**

### 4. Console Output Analysis
From the test screenshot, visible output shows:
```
[draw] VB_NEW_2026 id=11 sz=192
[draw] primitive=5  (TriangleStrip)
[draw] Proj diag: (2.566, 3.732, -1.002, 0.000)
[draw] MV translate: (0.000, 0.000, -5.000)
[draw] Executing draw: vertexCount=4, firstVertex=0
[draw] Draw call complete
```

**What's MISSING from output:**
- `useScreenSpace conditions:` - should appear BEFORE `primitive=`
- `SCREEN-SPACE PATH:` or `TEXTURED PATH:`
- `Using shader '%s'`

This suggests the new debug code might not be in the compiled WASM despite being in the library.

## Files Modified

1. `allolib-wasm/src/al_WebGPUBackend.cpp`:
   - Line 269-295: Added debug cyan to screen-space fragment shader
   - Line 203-205: Debug magenta in textured fragment shader
   - Line 2354-2393: Extensive debug logging in draw()
   - Line 2436-2441: Fixed bind group selection for useScreenSpace
   - Line 3354-3358: Changed updateTexturedBindGroup() to accept shader parameter

2. `allolib-wasm/include/al_WebGPUBackend.hpp`:
   - Line 573: Updated function signature

## Current State

- The draw call IS happening (vertexCount=4, primitive=5)
- hasTexture IS true (because `primitive=` message inside `if(hasTexture)` block appears)
- Canvas is still BLACK (not cyan or magenta from debug shaders)
- Some debug messages are missing from output (possibly scrolled off or not flushed)

## What Needs to Be Done Next Session

### Immediate Debugging Priorities

1. **Verify debug output is complete**: Add fflush(stdout) after printf statements or use EM_ASM for direct console.log

2. **Check shader creation success**: Look for "Screen-space shader created successfully" message in startup

3. **Verify screen-space shader is valid**: The `mScreenSpaceShader.valid()` check might be failing

4. **Check pipeline binding**: The pipeline might not be set correctly, or there's a WebGPU validation error that's being silently swallowed

### Alternative Approaches to Try

1. **Use Textured Shader Instead**: Remove the screen-space shader override and use the textured shader (which applies MV/Proj transforms) for textured draws. This is more correct for general use anyway.

2. **Check WebGPU Validation Errors**: Enable WebGPU validation layer/debug output in browser

3. **Simplify Test**: Create a minimal test that just draws a solid-color quad without texture to verify basic rendering works

4. **Check Render Pass Transitions**: Verify that when switching from FBO to screen, the render pass is properly ended and the texture is in the correct state for sampling

### Build Commands
```bash
# Rebuild WebGPU library
docker exec allolib-compiler bash -c 'cd /app && ./build-allolib.sh webgpu'

# Clear compiled cache (IMPORTANT - do this before testing!)
rm -rf "C:/Allolib Studio Online/backend/compiled/"*

# Run the specific test
cd tests && npx playwright test webgpu-features.spec.ts -g "basic render-to-texture works.*WebGPU" --project=chromium-webgpu
```

### Key Files for Reference
- `allolib-wasm/src/al_WebGPUBackend.cpp` - Main WebGPU backend implementation
- `allolib-wasm/src/al_Graphics_Web.cpp` - GL to WebGPU bridge
- `tests/e2e/webgpu-features.spec.ts` - Test file (BASIC_FBO_CODE at line 900)
