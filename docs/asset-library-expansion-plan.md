# Asset Library Expansion Plan (Updated)

## Compatibility Requirements

Based on the allolib-wasm backend analysis, all assets must:

1. **Shaders**: Use GLSL ES 3.0 (`#version 300 es`) with precision qualifiers
2. **Code Snippets**: Work with `WebApp` class structure (not native `App`)
3. **Gamma DSP**: Use supported oscillators/envelopes (Sine, Saw, Square, Tri, Pulse, ADSR, Biquad, etc.)
4. **Meshes**: Use `al::addSphere`, `al::addCube`, etc. - all primitives supported
5. **No External Files**: HDRIs/OBJ files require WebFile infrastructure (not yet implemented) - provide URL references only

**Skipped**: Synth presets (per user request)

---

## Phase 1: Shaders from Tutorials (Convert to GLSL ES 3.0)

### Source Files to Convert

| Original | GLSL Version | Action |
|----------|--------------|--------|
| `feedback/shaders/composite.frag` | 330 core | Convert to 300 es |
| `feedback/shaders/diffusion.frag` | 330 core | Convert to 300 es |
| `feedback/shaders/reactiondiffusion.frag` | 330 core | Convert to 300 es |
| `feedback/shaders/reactiondiffusion_colormap.frag` | 330 core | Convert to 300 es |
| `feedback/shaders/uv.vert` | 330 core | Convert to 300 es |
| `raymarching/shaders/raymarch.frag` | 330 | Convert to 300 es |
| `raymarching/shaders/raymarch.vert` | 330 | Convert to 300 es |

### Conversion Pattern

```glsl
// FROM (Desktop GLSL 330):
#version 330 core
in vec2 vuv;
out vec4 fragColor;

// TO (WebGL2 GLSL ES 3.0):
#version 300 es
precision highp float;
precision highp int;
in vec2 vuv;
out vec4 fragColor;
```

### New Shader Assets to Add

```typescript
// Feedback Effects
{ id: 'shader-composite', name: 'Composite Blend', subcategory: 'Effects' }
{ id: 'shader-diffusion', name: 'Diffusion', subcategory: 'Effects' }
{ id: 'shader-reaction-diffusion', name: 'Reaction Diffusion', subcategory: 'Generative' }
{ id: 'shader-rd-colormap', name: 'Reaction Diffusion Colormap', subcategory: 'Generative' }
{ id: 'shader-uv-passthrough', name: 'UV Passthrough Vertex', subcategory: 'Utility' }

// Raymarching
{ id: 'shader-raymarch-frag', name: 'Raymarching Fragment', subcategory: 'Raymarching' }
{ id: 'shader-raymarch-vert', name: 'Raymarching Vertex', subcategory: 'Raymarching' }
```

---

## Phase 2: LYGIA-Style Shader Utilities (GLSL ES 3.0)

### Noise Functions

```typescript
{ id: 'shader-util-simplex2d', name: 'Simplex Noise 2D', subcategory: 'Noise' }
{ id: 'shader-util-simplex3d', name: 'Simplex Noise 3D', subcategory: 'Noise' }
{ id: 'shader-util-fbm', name: 'Fractal Brownian Motion', subcategory: 'Noise' }
{ id: 'shader-util-voronoi', name: 'Voronoi/Worley Noise', subcategory: 'Noise' }
```

### SDF Functions

```typescript
{ id: 'shader-util-sdf-sphere', name: 'SDF Sphere', subcategory: 'SDF' }
{ id: 'shader-util-sdf-box', name: 'SDF Box', subcategory: 'SDF' }
{ id: 'shader-util-sdf-torus', name: 'SDF Torus', subcategory: 'SDF' }
{ id: 'shader-util-sdf-operations', name: 'SDF Operations (union, subtract, intersect)', subcategory: 'SDF' }
{ id: 'shader-util-sdf-smooth', name: 'Smooth SDF Operations', subcategory: 'SDF' }
```

### Color Utilities

```typescript
{ id: 'shader-util-hsv2rgb', name: 'HSV to RGB', subcategory: 'Color' }
{ id: 'shader-util-rgb2hsv', name: 'RGB to HSV', subcategory: 'Color' }
{ id: 'shader-util-palette', name: 'Cosine Palette', subcategory: 'Color' }
{ id: 'shader-util-blend-modes', name: 'Blend Modes', subcategory: 'Color' }
```

### Math Utilities

```typescript
{ id: 'shader-util-rotate2d', name: 'Rotate 2D', subcategory: 'Math' }
{ id: 'shader-util-rotate3d', name: 'Rotate 3D', subcategory: 'Math' }
{ id: 'shader-util-remap', name: 'Remap Range', subcategory: 'Math' }
{ id: 'shader-util-smoothstep-variants', name: 'Smoothstep Variants', subcategory: 'Math' }
```

---

## Phase 3: Mesh Primitives (Object Definitions)

### Platonic Solids (Missing from current library)

```typescript
{ id: 'object-tetrahedron', name: 'Tetrahedron', subcategory: 'Platonic Solids' }
{ id: 'object-octahedron', name: 'Octahedron', subcategory: 'Platonic Solids' }
{ id: 'object-icosahedron', name: 'Icosahedron', subcategory: 'Platonic Solids' }
{ id: 'object-dodecahedron', name: 'Dodecahedron', subcategory: 'Platonic Solids' }
```

### Standard Primitives (Missing)

```typescript
{ id: 'object-cone', name: 'Cone', subcategory: 'Primitives' }
{ id: 'object-cylinder', name: 'Cylinder', subcategory: 'Primitives' }
{ id: 'object-disk', name: 'Disk', subcategory: 'Primitives' }
{ id: 'object-plane', name: 'Plane', subcategory: 'Primitives' }
{ id: 'object-prism', name: 'Prism', subcategory: 'Primitives' }
```

---

## Phase 4: Code Snippets (WebApp Compatible)

### Synth Voices (Updated for WebApp)

```typescript
// Already have: FM, Subtractive, Additive, Wavetable

// New additions:
{ id: 'snippet-plucked-string', name: 'Plucked String (Karplus-Strong)', subcategory: 'Synths' }
{ id: 'snippet-noise-synth', name: 'Noise Synth with Filter', subcategory: 'Synths' }
{ id: 'snippet-granular-basic', name: 'Basic Granular', subcategory: 'Synths' }
{ id: 'snippet-pad-synth', name: 'Pad Synth (Detuned Oscillators)', subcategory: 'Synths' }
```

### Graphics Patterns

```typescript
// New additions:
{ id: 'snippet-fbo-feedback', name: 'FBO Feedback Loop', subcategory: 'Graphics' }
{ id: 'snippet-instanced-mesh', name: 'Instanced Mesh Rendering', subcategory: 'Graphics' }
{ id: 'snippet-billboarding', name: 'Billboard Sprite', subcategory: 'Graphics' }
{ id: 'snippet-trail-renderer', name: 'Trail Renderer', subcategory: 'Graphics' }
{ id: 'snippet-mesh-morphing', name: 'Mesh Morphing', subcategory: 'Graphics' }
```

### Audio Effects

```typescript
// New additions:
{ id: 'snippet-chorus', name: 'Chorus Effect', subcategory: 'Audio' }
{ id: 'snippet-flanger', name: 'Flanger Effect', subcategory: 'Audio' }
{ id: 'snippet-bitcrusher', name: 'Bitcrusher', subcategory: 'Audio' }
{ id: 'snippet-compressor', name: 'Simple Compressor', subcategory: 'Audio' }
```

### Visualization

```typescript
{ id: 'snippet-spectrum-analyzer', name: 'Spectrum Analyzer', subcategory: 'Visualization' }
{ id: 'snippet-waveform-display', name: 'Waveform Display', subcategory: 'Visualization' }
{ id: 'snippet-audio-reactive-mesh', name: 'Audio-Reactive Mesh', subcategory: 'Visualization' }
{ id: 'snippet-fft-bars', name: 'FFT Bar Graph', subcategory: 'Visualization' }
```

### Utilities

```typescript
{ id: 'snippet-midi-to-freq', name: 'MIDI to Frequency', subcategory: 'Utilities' }
{ id: 'snippet-easing-functions', name: 'Easing Functions', subcategory: 'Utilities' }
{ id: 'snippet-camera-orbit', name: 'Orbit Camera Controller', subcategory: 'Utilities' }
{ id: 'snippet-screenshot', name: 'Screenshot Capture', subcategory: 'Utilities' }
```

---

## Phase 5: Environment References (URL-based)

Since WebFile infrastructure isn't fully implemented, environments are stored as URL references with metadata for future loading.

### HDRI References (CC0 Sources)

```typescript
{
  id: 'env-studio-soft',
  name: 'Studio Soft Light',
  type: 'environment',
  description: 'Neutral studio lighting setup',
  downloadUrl: 'https://polyhaven.com/a/studio_small_03',
  license: 'CC0',
  resolution: '2K-8K',
  previewUrl: '...' // thumbnail
}
```

**Sources to reference:**
- Poly Haven (polyhaven.com/hdris) - CC0, no signup
- CGEES (cgees.com) - CC0, up to 24K
- OpenHDRI (openhdri.org) - CC0, up to 29K

### Categories

```typescript
// Studio
{ id: 'env-studio-soft', name: 'Studio Soft Light' }
{ id: 'env-studio-hard', name: 'Studio Hard Light' }
{ id: 'env-studio-gradient', name: 'Studio Gradient' }

// Outdoor
{ id: 'env-outdoor-sunset', name: 'Sunset Sky' }
{ id: 'env-outdoor-overcast', name: 'Overcast Sky' }
{ id: 'env-outdoor-night', name: 'Night Sky' }
{ id: 'env-outdoor-forest', name: 'Forest Clearing' }

// Interior
{ id: 'env-interior-gallery', name: 'Art Gallery' }
{ id: 'env-interior-warehouse', name: 'Industrial Warehouse' }
```

---

## Phase 6: External Mesh References (URL-based)

Similar to environments, meshes are URL references until WebFile is fully implemented.

### Sources (CC0)

- Poly Haven Models (polyhaven.com) - CC0
- Kenney Assets (kenney.nl) - CC0
- Keenan Crane Repository - CC0 academic models

### Categories

```typescript
// Abstract
{ id: 'mesh-abstract-knot', name: 'Trefoil Knot', downloadUrl: '...' }
{ id: 'mesh-abstract-mobius', name: 'Möbius Strip', downloadUrl: '...' }

// Nature
{ id: 'mesh-nature-rock', name: 'Rock Formation', downloadUrl: '...' }
{ id: 'mesh-nature-tree', name: 'Low Poly Tree', downloadUrl: '...' }

// Props
{ id: 'mesh-prop-chair', name: 'Simple Chair', downloadUrl: '...' }
```

---

## Implementation Structure

### Updated Asset Interface

```typescript
export interface Asset {
  id: string
  name: string
  category: AssetCategory
  subcategory?: string
  type: AssetType
  description: string
  tags: string[]

  // Content (for snippets, shaders, templates)
  content?: string

  // Object definition (for mesh primitives)
  objectDefinition?: ObjectDefinition

  // External resource (for HDRIs, OBJ meshes)
  downloadUrl?: string
  previewUrl?: string
  license?: 'CC0' | 'MIT' | 'Apache-2.0'
  resolution?: string  // '2K', '4K', etc.
  fileSize?: string    // '2.4 MB'

  // Metadata
  isBuiltIn: boolean
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}
```

### New Subcategories

```typescript
// Shaders
'Effects' | 'Generative' | 'Raymarching' | 'Utility' | 'Noise' | 'SDF' | 'Color' | 'Math'

// Objects
'Primitives' | 'Platonic Solids'

// Snippets
'Synths' | 'Graphics' | 'Audio' | 'Visualization' | 'Utilities'

// Environments
'Studio' | 'Outdoor' | 'Interior'

// Meshes
'Abstract' | 'Nature' | 'Props'
```

---

## Asset Count Summary

| Category | Current | After Expansion |
|----------|---------|-----------------|
| Snippets | 10 | ~30 |
| Templates | 3 | 5 |
| Objects | 3 | 12 |
| Shaders | 0 | ~25 |
| Environments | 0 | 10 (refs) |
| Meshes | 0 | 10 (refs) |
| **Total** | **16** | **~92** |

---

## Implementation Order

1. **Convert tutorial shaders to ES 3.0** - Direct value, tested code
2. **Add mesh primitives** - Simple, uses existing al_Shapes
3. **Add LYGIA-style shader utilities** - High value for creative coding
4. **Add synth/graphics snippets** - From tutorials
5. **Add environment/mesh references** - URL-only until WebFile ready

---

## File Changes Required

```
frontend/src/stores/assetLibrary.ts  # Add all new assets
```

No backend changes needed - all assets are embedded in the frontend store.
