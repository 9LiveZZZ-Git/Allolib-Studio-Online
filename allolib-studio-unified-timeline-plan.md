# AlloLib Studio Online: Unified Timeline Implementation Plan

> **Last Updated:** 2026-01-30
> **Overall Progress:** ~70% foundation complete (Asset Library, Graphics, LOD, Parameter Panel, Stores done)
> **Timeline UI:** 0% - Full mockup designed, implementation pending (Phase 1-6)

## Executive Summary

This document outlines the expansion of AlloLib Studio Online from an audio sequencer to a complete audiovisual animation studio with game-capable interactivity. The system uses **four track categories**:

| Category | Purpose | Linearity |
|----------|---------|-----------|
| ♫ **Audio** | SynthVoice instances (audio + visual) | Linear (sequenced) |
| ◈ **Objects** | Visual entities (mesh, material, transform) | Linear (keyframed) |
| ◐ **Environment** | Global scene (skybox, fog, lights, terrain) | Linear (keyframed) |
| ⚡ **Events** | Triggers + Scripts (camera, callbacks, game logic) | **Linear AND Non-linear** |

**Key architectural principle:** AlloLib (C++) already does all rendering and audio. We are building:
1. JSON/JS files that describe what happens when
2. Vue UI to edit those files visually
3. A thin TypeScript runtime that reads data and calls AlloLib APIs

**No modifications to AlloLib C++ codebase required.**

---

## Implementation Status Overview

### ✅ COMPLETED FEATURES

| Feature | Status | Location |
|---------|--------|----------|
| `.synthSequence` file format | ✅ Complete | `utils/synthSequence.ts` |
| Clip-based arrangement | ✅ Complete | `components/sequencer/` |
| `arrangement.json` persistence | ✅ Complete | `stores/sequencer.ts` |
| ArrangementTrack with mute/solo | ✅ Complete | `stores/sequencer.ts` |
| Synth parameter automation | ✅ Complete | Sequencer stores |
| Piano roll (Frequency Roll) | ✅ Complete | `FrequencyRoll.vue` |
| Tone Lattice (2D/3D) | ✅ Complete | `ToneLattice.vue` |
| Track mute/solo/expand | ✅ Complete | Sequencer |
| Spectrum analyzer | ✅ Complete | `AnalysisPanel.vue` |
| Monaco code editor | ✅ Complete | Editor component |
| C++ compilation | ✅ Complete | `services/compiler.ts` |
| WASM runtime | ✅ Complete | `services/runtime.ts` |
| File management | ✅ Complete | Project store |
| Preset system | ✅ Complete | `.preset` files |
| **Video Recording** | ✅ Complete | `services/recorder.ts` |
| **Popout Visualizer** | ✅ Complete | `PopoutVisualizer.vue` |
| **Social Media Size Presets** | ✅ Complete | YouTube Shorts, Reels, TikTok |
| **Screenshot Export** | ✅ Complete | PNG/JPEG/WebP |
| Terminal with JS scripting | ✅ Complete | `stores/terminal.ts` |
| Lattice/Just Intonation API | ✅ Complete | Terminal JS context |
| **PBR Materials System** | ✅ Complete | `al_WebPBR.hpp` |
| **HDR Environment/Skybox** | ✅ Complete | `al_WebEnvironment.hpp`, `al_WebHDR.hpp` |
| **LOD System** | ✅ Complete | `al_WebLOD.hpp` |
| **Auto-LOD (Unreal-style)** | ✅ Complete | `al_WebAutoLOD.hpp` - Automatic for all g.draw() calls |
| **Quality Management** | ✅ Complete | `al_WebQuality.hpp` |
| **OBJ Mesh Loading** | ✅ Complete | `al_WebOBJ.hpp` |
| **Native Compatibility Headers** | ✅ Complete | `native_compat/al_StudioCompat.hpp` |
| **Graphics Settings UI** | ✅ Complete | `Toolbar.vue` (Graphics tab) |
| **Asset Library System** | ✅ Complete | `stores/assetLibrary.ts`, `AssetLibrary.vue` |
| **Procedural Textures** | ✅ Complete | `al_WebProcedural.hpp` - Perlin, Simplex, Worley noise |
| **Mipmap Texture LOD** | ✅ Complete | `al_WebMipmapTexture.hpp` - GPU mipmaps, continuous LOD |
| **Terminal: assets command** | ✅ Complete | `stores/terminal.ts` - list, load, preload, status |
| **Terminal: graphics command** | ✅ Complete | `stores/terminal.ts` - status, preset, lod |
| **Glossary Updates (25+ entries)** | ✅ Complete | `data/glossary.ts` - Auto-LOD, PBR, Procedural, Assets |
| **Asset Loading States** | ✅ Complete | PlayCanvas-style: idle/loading/ready/error |
| **Asset Priority System** | ✅ Complete | critical/high/normal/low preload priorities |
| **Unified Parameter Panel** | ✅ Complete | Multi-source, keyframes, stores connected |
| **Objects Store** | ✅ Complete | `stores/objects.ts` - CRUD, keyframes, transforms |
| **Environment Store** | ✅ Complete | `stores/environment.ts` - Fog, ambient, skybox |

### 🔄 IN PROGRESS / PLANNED

| Feature | Status | Priority |
|---------|--------|----------|
| Unified Parameter Panel | ✅ Complete | **HIGH** - Full multi-source + keyframe support |
| **Timeline Panel Restructure** | 🔴 Not Started | **HIGH** - Full mockup designed (Part 3.5) |
| Object Tracks | 🔴 Not Started | High - Phase 1, Week 2-3 |
| Environment Track | 🔴 Not Started | Medium - Phase 3 |
| Events Track | 🔴 Not Started | Medium - Phase 4-5 |
| Keyframe Curve Editor | 🔴 Not Started | Medium - Phase 2 |
| Native Export Transpiler | 🟡 Partial | Medium - Headers complete, codegen pending |

---

## ✅ Part 0 - Asset Library System (COMPLETE)

> **Implementation Status:** Fully implemented on 2026-01-30
>
> **Files Created:**
> - `frontend/src/stores/assetLibrary.ts` - Full store with loading states, priorities, search
> - `frontend/src/components/AssetLibrary.vue` - Complete UI with drag-drop, import, favorites
> - `frontend/src/main.ts` - Asset store registration for terminal access
>
> **Features Implemented:**
> - 7 asset types (snippet, file, object, shader, texture, mesh, environment)
> - PlayCanvas-style loading states (idle/loading/ready/error)
> - Priority system (critical/high/normal/low)
> - Search and category filtering
> - Favorites/starring system
> - Terminal `assets` command (list, textures, meshes, environments, load, preload, status, info)
> - Multi-file import from disk

### Overview

A comprehensive asset library for managing reusable code, files, and templates. Assets can be dragged into the file explorer or clicked to add.

### Asset Categories

```
Asset Library/
├── Code Snippets/           # Reusable C++ code blocks
│   ├── Synths/              # SynthVoice templates
│   ├── Graphics/            # Mesh, shader, texture patterns
│   ├── Audio/               # Oscillators, envelopes, effects
│   └── Utilities/           # Math, helpers, common patterns
├── File Templates/          # Complete file templates
│   ├── main.cpp templates
│   ├── Header files (.hpp)
│   └── Shader files (.glsl)
├── Objects/                 # Object definitions (NEW)
│   ├── Primitives/          # Sphere, cube, plane, etc.
│   ├── Effects/             # Particle emitters, trails
│   └── Custom/              # User-created objects
├── Shaders/                 # GLSL shader library
│   ├── Built-in/            # Standard shaders
│   └── Custom/              # User shaders
├── Textures/                # Texture assets
├── Meshes/                  # 3D model assets (.obj)
└── Environments/            # Skyboxes, HDRIs
```

### Frontend Implementation

#### Asset Library Store

```typescript
// stores/assetLibrary.ts

export interface Asset {
  id: string
  name: string
  category: AssetCategory
  subcategory?: string
  type: 'snippet' | 'file' | 'object' | 'shader' | 'texture' | 'mesh' | 'environment'
  description: string
  thumbnail?: string
  tags: string[]

  // Content based on type
  content?: string                    // For snippets/files
  filePath?: string                   // For binary assets
  objectDefinition?: ObjectDefinition // For objects

  // Metadata
  author?: string
  version?: string
  createdAt: string
  updatedAt: string
  isBuiltIn: boolean
  isFavorite: boolean
}

export type AssetCategory =
  | 'snippets'
  | 'templates'
  | 'objects'
  | 'shaders'
  | 'textures'
  | 'meshes'
  | 'environments'

export const useAssetLibraryStore = defineStore('assetLibrary', () => {
  const assets = ref<Asset[]>([])
  const searchQuery = ref('')
  const selectedCategory = ref<AssetCategory | null>(null)
  const favorites = ref<Set<string>>(new Set())

  // Load built-in assets
  async function loadBuiltInAssets() { ... }

  // Load user assets from backend
  async function loadUserAssets() { ... }

  // Add asset to project
  function addToProject(asset: Asset, targetPath?: string) {
    const projectStore = useProjectStore()

    if (asset.type === 'snippet') {
      // Insert at cursor in active editor
      // or create new file with snippet
    } else if (asset.type === 'file') {
      projectStore.createFile(targetPath || asset.name, asset.content!)
    } else if (asset.type === 'object') {
      // Add to objects/ folder
      projectStore.createFile(
        `objects/${asset.name}.object.json`,
        JSON.stringify(asset.objectDefinition, null, 2)
      )
    }
    // ... handle other types
  }

  // Search and filter
  const filteredAssets = computed(() => {
    return assets.value.filter(a => {
      if (selectedCategory.value && a.category !== selectedCategory.value) return false
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase()
        return a.name.toLowerCase().includes(q) ||
               a.description.toLowerCase().includes(q) ||
               a.tags.some(t => t.toLowerCase().includes(q))
      }
      return true
    })
  })

  // Create user asset
  function createAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>) { ... }

  // Upload asset to backend
  async function uploadAsset(asset: Asset) { ... }

  return { assets, searchQuery, selectedCategory, favorites, filteredAssets, addToProject, ... }
})
```

#### Asset Library UI Component

```vue
<!-- components/AssetLibrary.vue -->
<template>
  <div class="asset-library">
    <!-- Header with search -->
    <div class="header">
      <input v-model="searchQuery" placeholder="Search assets..." />
      <button @click="showCreateDialog = true">+ New</button>
    </div>

    <!-- Category tabs -->
    <div class="categories">
      <button
        v-for="cat in categories"
        :key="cat.id"
        :class="{ active: selectedCategory === cat.id }"
        @click="selectedCategory = cat.id"
      >
        {{ cat.icon }} {{ cat.name }}
      </button>
    </div>

    <!-- Asset grid -->
    <div class="asset-grid">
      <div
        v-for="asset in filteredAssets"
        :key="asset.id"
        class="asset-card"
        draggable="true"
        @dragstart="onDragStart(asset, $event)"
        @click="onAssetClick(asset)"
      >
        <div class="thumbnail">
          <img v-if="asset.thumbnail" :src="asset.thumbnail" />
          <span v-else class="icon">{{ getIcon(asset.type) }}</span>
        </div>
        <div class="info">
          <span class="name">{{ asset.name }}</span>
          <span class="type">{{ asset.type }}</span>
        </div>
        <button
          class="favorite"
          @click.stop="toggleFavorite(asset.id)"
        >
          {{ isFavorite(asset.id) ? '★' : '☆' }}
        </button>
      </div>
    </div>
  </div>
</template>
```

### Backend Implementation

#### Asset Storage API

```typescript
// backend/src/routes/assets.ts

router.get('/assets', async (req, res) => {
  // List all assets (built-in + user)
  const builtIn = await loadBuiltInAssets()
  const userAssets = await db.assets.findAll({ userId: req.user?.id })
  res.json([...builtIn, ...userAssets])
})

router.post('/assets', upload.single('file'), async (req, res) => {
  // Upload new asset
  const { name, category, type, description, tags, content } = req.body

  let filePath = null
  if (req.file) {
    // Store binary file (texture, mesh, etc.)
    filePath = await storeAssetFile(req.file)
  }

  const asset = await db.assets.create({
    id: generateId(),
    name,
    category,
    type,
    description,
    tags: JSON.parse(tags),
    content,
    filePath,
    userId: req.user?.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  res.json(asset)
})

router.get('/assets/:id/download', async (req, res) => {
  // Download asset file
  const asset = await db.assets.findById(req.params.id)
  if (!asset?.filePath) return res.status(404).send('Not found')
  res.sendFile(asset.filePath)
})

router.delete('/assets/:id', async (req, res) => {
  // Delete user asset
  await db.assets.delete({ id: req.params.id, userId: req.user?.id })
  res.json({ success: true })
})
```

#### Asset File Structure (Backend)

```
backend/
├── assets/
│   ├── built-in/              # Ships with app
│   │   ├── snippets/
│   │   │   ├── synths/
│   │   │   │   ├── fm-synth.snippet.json
│   │   │   │   ├── subtractive.snippet.json
│   │   │   │   └── ...
│   │   │   ├── graphics/
│   │   │   │   ├── spinning-cube.snippet.json
│   │   │   │   └── ...
│   │   │   └── audio/
│   │   │       └── ...
│   │   ├── templates/
│   │   │   ├── basic-app.cpp
│   │   │   ├── synth-app.cpp
│   │   │   └── ...
│   │   ├── objects/
│   │   │   ├── sphere.object.json
│   │   │   ├── particle-emitter.object.json
│   │   │   └── ...
│   │   ├── shaders/
│   │   │   ├── standard.glsl
│   │   │   ├── emissive.glsl
│   │   │   └── ...
│   │   └── environments/
│   │       ├── studio.hdr
│   │       └── ...
│   │
│   └── user/                   # User uploads
│       └── {userId}/
│           ├── snippets/
│           ├── objects/
│           └── ...
│
└── src/
    └── services/
        └── assetService.ts     # Asset management logic
```

### Built-in Snippet Examples

```json
// assets/built-in/snippets/synths/fm-synth.snippet.json
{
  "id": "fm-synth-basic",
  "name": "FM Synth Voice",
  "category": "snippets",
  "subcategory": "synths",
  "type": "snippet",
  "description": "Basic 2-operator FM synthesis voice with ADSR envelope",
  "tags": ["synth", "fm", "frequency modulation", "voice"],
  "content": "class FMVoice : public al::SynthVoice {\npublic:\n  gam::Sine<> carrier, modulator;\n  gam::ADSR<> env;\n  float modDepth = 200.0f;\n  float modRatio = 2.0f;\n\n  void onProcess(al::AudioIOData& io) override {\n    while (io()) {\n      float mod = modulator() * modDepth;\n      carrier.freq(getInternalParameterValue(\"frequency\") + mod);\n      float s = carrier() * env() * getInternalParameterValue(\"amplitude\");\n      io.out(0) += s;\n      io.out(1) += s;\n    }\n    if (env.done()) free();\n  }\n\n  void onTriggerOn() override {\n    float freq = getInternalParameterValue(\"frequency\");\n    carrier.freq(freq);\n    modulator.freq(freq * modRatio);\n    env.attack(0.01f);\n    env.decay(0.1f);\n    env.sustain(0.7f);\n    env.release(0.3f);\n    env.reset();\n  }\n\n  void onTriggerOff() override {\n    env.release();\n  }\n};",
  "isBuiltIn": true
}
```

```json
// assets/built-in/snippets/graphics/spinning-mesh.snippet.json
{
  "id": "spinning-mesh",
  "name": "Spinning Mesh",
  "category": "snippets",
  "subcategory": "graphics",
  "type": "snippet",
  "description": "Rotating mesh with configurable speed",
  "tags": ["mesh", "animation", "rotation", "graphics"],
  "content": "// Add to class members:\nal::Mesh mesh;\nfloat angle = 0;\nfloat rotationSpeed = 1.0f;\n\n// In onCreate():\nal::addSphere(mesh, 1.0);\nmesh.generateNormals();\n\n// In onAnimate(dt):\nangle += rotationSpeed * dt;\n\n// In onDraw(g):\ng.pushMatrix();\ng.rotate(angle, 0, 1, 0);\ng.draw(mesh);\ng.popMatrix();",
  "isBuiltIn": true
}
```

### Drag & Drop Integration

```typescript
// In FileExplorer.vue - handle asset drops

function onDrop(event: DragEvent, targetFolder: string) {
  const assetData = event.dataTransfer?.getData('application/asset')
  if (assetData) {
    const asset = JSON.parse(assetData) as Asset
    assetLibrary.addToProject(asset, targetFolder)
    return
  }
  // ... existing file drop handling
}

// In AssetLibrary.vue - initiate drag
function onDragStart(asset: Asset, event: DragEvent) {
  event.dataTransfer?.setData('application/asset', JSON.stringify(asset))
  event.dataTransfer!.effectAllowed = 'copy'
}
```

---

## ✅ Part 0.5 - Unified Parameter Panel (COMPLETE)

> **Implementation Status:** Fully implemented on 2026-01-30
>
> **Files Implemented:**
> - `frontend/src/utils/parameter-system.ts` - Full unified system with multi-source routing
> - `frontend/src/components/ParameterPanel.vue` - Complete UI with source filtering, keyframes, presets
> - `frontend/src/components/inputs/Vec3Input.vue` - Vec3 input component
> - `frontend/src/components/inputs/ColorPicker.vue` - Color picker component
> - `frontend/src/stores/objects.ts` - **NEW:** Full object management store with keyframes
> - `frontend/src/stores/environment.ts` - **NEW:** Environment settings store with keyframes
> - `frontend/src/main.ts` - Store registration for terminal/parameter access
>
> **Features Implemented:**
> - Multi-source parameter types: `synth`, `object`, `environment`, `camera`, `event`
> - Source filtering pills (All, ♫ Synth, ◆ Object, ◐ Env, 📷 Cam)
> - Live playhead time indicator for keyframe placement
> - Keyframe button handlers connected to stores
> - Value routing to correct stores based on source
> - Camera parameter sync to WASM nav()
> - Info bar explaining presets vs keyframes
> - Objects store with CRUD, keyframes, and WASM sync placeholder
> - Environment store with fog, ambient, skybox, HDRI support

### Overview

Extend the existing Parameter Panel to show not just SynthVoice parameters but also:
- Object transform properties (position, rotation, scale)
- Object material uniforms
- Environment settings
- Camera properties
- Any keyframeable value

### Current Implementation State

The Parameter Panel now fully supports:
- ✅ Multi-source parameter types: `synth`, `object`, `environment`, `camera`, `event`
- ✅ Source filtering pills (All, ♫ Synth, ◆ Object, ◐ Env, 📷 Cam)
- ✅ Parameter types: FLOAT, INT, BOOL, STRING, VEC3, VEC4, COLOR, MENU, TRIGGER
- ✅ Vec3Input and ColorPicker components for vector/color parameters
- ✅ Keyframeable parameter indicators (◆ button) with live time display
- ✅ Preset save/load to localStorage (synth-only, by design)
- ✅ Default environment/camera parameters initialized
- ✅ Object parameter registration via `registerObject()`
- ✅ **Objects store connected** - Full CRUD, keyframe curves, WASM sync
- ✅ **Environment store connected** - Background, fog, ambient, skybox
- ✅ **Keyframe creation** - Handlers route to correct stores
- ✅ **Camera WASM sync** - Position and FOV sync to nav()
- ✅ **Value routing** - `setParameterValue()` routes to correct store by source
- ✅ **Info bar** - Explains presets (synth) vs keyframes (object/env/camera)

---

## ⚠️ CRITICAL: Native AlloLib Preset Compatibility

### Native Preset System Architecture

AlloLib uses a text-based preset format for synth voices:

**File Location:** `bin/<SynthName>-data/<preset-name>.preset`

**File Format:**
```
::preset-name
/amplitude f 0.500000
/attackTime f 0.100000
/freq f 384.868225
/releaseTime f 0.100000
::
```

**Key Characteristics:**
- OSC-like format: `/<param-name> f <value>`
- Parameters created via `createInternalTriggerParameter(name, default, min, max)`
- Stored in synth-specific `-data` directories
- Used by `PresetHandler` class in `al/ui/al_PresetHandler.hpp`
- Supports preset morphing and interpolation

### Web Parameter System Architecture

The web system (`parameter-system.ts`) bridges C++ parameters to Vue UI:

**Parameter Registration Flow:**
```
C++ SynthVoice.createInternalTriggerParameter()
    ↓
WebControlGUI registers parameter
    ↓
al_webgui_* C exports expose to JS
    ↓
parameterSystem.loadFromWasm() reads parameters
    ↓
ParameterPanel.vue displays controls
```

**Multi-Source Support (NEW):**
```typescript
type ParameterSource = 'synth' | 'object' | 'environment' | 'camera' | 'event'

interface Parameter {
  source: ParameterSource   // Which system owns this param
  sourceId?: string         // Object ID for 'object' source
  index: number             // WASM index (only valid for 'synth', -1 otherwise)
  isKeyframeable: boolean
  hasKeyframes: boolean
}
```

### Compatibility Requirements

**CRITICAL: Synth presets must remain separate from other parameter sources.**

| Aspect | Synth Parameters | Object/Env/Camera Parameters |
|--------|-----------------|------------------------------|
| Source | WASM module | Frontend stores (pending) |
| Index | 0, 1, 2... (WASM indices) | -1 (not in WASM) |
| Preset Format | Native `.preset` files | JSON in arrangement/object files |
| Storage | `bin/<Synth>-data/` | `arrangement.json`, `*.object.json` |
| UI Presets | localStorage (temporary) | Not applicable |

### Implementation Rules

1. **Never mix synth presets with object/environment data**
   - Synth parameters use WASM bridge (`_al_webgui_set_parameter_value`)
   - Object/env params use store actions (`objectsStore.setProperty()`)

2. **Quick-Save Presets (PresetManager) - SYNTH ONLY**
   ```typescript
   // PresetManager.savePreset() uses getAll() which ONLY returns synth params:
   getAll(): Parameter[] {
     return Array.from(this.parameters.values())  // Only synth params!
   }

   // Object/env/camera params are in separate Maps:
   // - this.objectParameters: Map<string, Parameter[]>
   // - this.environmentParameters: Parameter[]
   // - this.cameraParameters: Parameter[]
   // These are NOT included in getAll() or preset save/load
   ```

   **Current Behavior (CORRECT):**
   - Save Preset → Only saves synth parameters to localStorage
   - Load Preset → Only restores synth parameters via WASM bridge
   - Object/env/camera values are NOT affected by preset operations

   **Why This Is Important:**
   - Native AlloLib `.preset` files only contain synth voice parameters
   - Mixing object transforms into presets would break native compatibility
   - Object/environment state belongs in `arrangement.json`, not presets

3. **Preserve native preset compatibility**
   - The web `PresetManager` saves to localStorage (separate from native)
   - Future: Export to native `.preset` format for round-trip compatibility

3. **Source isolation in `getAllGroups()`**
   - Already implemented: Groups are tagged with their source
   - `.synthsequence` groups are correctly filtered out (line 476, 519)
   - `.preset` suffix is cleaned from display names

4. **Parameter value routing in `setParameterValue()`**
   ```typescript
   switch (source) {
     case 'synth':
       this.wasmModule._al_webgui_set_parameter_value(index, value)
       break
     case 'object':
       objectsStore.setProperty(sourceId, name, value)  // Future
       break
     case 'environment':
       environmentStore.setProperty(name, value)  // Future
       break
   }
   ```

### Remaining Work for Full Integration

All core items are now complete:
- ✅ **Object Store Connected** - `objectsStore.setProperty()` updates object state
- ✅ **Environment Store Connected** - Syncs to WASM for background, fog, ambient
- ✅ **Camera Parameter Sync** - WASM bridge for nav() position and lens FOV
- ✅ **Keyframe Integration** - Handlers create keyframes in stores

**Pending (for Object/Environment Track UI):**
1. Object selection UI to populate parameters (requires Object Track panel)
2. Keyframe curve editor visualization (Phase 2)
3. Timeline playback driving store values (Phase 2)

### Extended Parameter System

```typescript
// utils/parameter-system.ts (EXTEND)

export interface Parameter {
  name: string
  group: string
  type: 'float' | 'int' | 'bool' | 'vec3' | 'vec4' | 'color'
  value: number | number[]
  min?: number
  max?: number
  step?: number

  // NEW: Source tracking
  source: 'synth' | 'object' | 'environment' | 'camera' | 'event'
  sourceId?: string  // Object ID, synth name, etc.

  // NEW: Keyframe support
  isKeyframeable: boolean
  hasKeyframes: boolean
  keyframeCurve?: KeyframeCurve<any>
}

export interface ParameterGroup {
  name: string
  source: Parameter['source']
  sourceId?: string
  parameters: Parameter[]
  collapsed: boolean
}

class UnifiedParameterSystem {
  private synthParameters: Parameter[] = []
  private objectParameters: Map<string, Parameter[]> = new Map()
  private environmentParameters: Parameter[] = []
  private cameraParameters: Parameter[] = []

  // Get all parameters grouped by source
  getAllGroups(): ParameterGroup[] {
    const groups: ParameterGroup[] = []

    // Synth parameters (existing)
    if (this.synthParameters.length > 0) {
      groups.push({
        name: 'Synth Parameters',
        source: 'synth',
        parameters: this.synthParameters,
        collapsed: false,
      })
    }

    // Object parameters
    for (const [objectId, params] of this.objectParameters) {
      groups.push({
        name: `Object: ${objectId}`,
        source: 'object',
        sourceId: objectId,
        parameters: params,
        collapsed: true,
      })
    }

    // Environment
    if (this.environmentParameters.length > 0) {
      groups.push({
        name: 'Environment',
        source: 'environment',
        parameters: this.environmentParameters,
        collapsed: true,
      })
    }

    // Camera
    if (this.cameraParameters.length > 0) {
      groups.push({
        name: 'Camera',
        source: 'camera',
        parameters: this.cameraParameters,
        collapsed: true,
      })
    }

    return groups
  }

  // Register object parameters
  registerObject(objectId: string, definition: ObjectDefinition) {
    const params: Parameter[] = []

    // Transform
    params.push(
      { name: 'Position X', group: 'Transform', type: 'float', value: 0, source: 'object', sourceId: objectId, isKeyframeable: true, hasKeyframes: false },
      { name: 'Position Y', group: 'Transform', type: 'float', value: 0, source: 'object', sourceId: objectId, isKeyframeable: true, hasKeyframes: false },
      { name: 'Position Z', group: 'Transform', type: 'float', value: 0, source: 'object', sourceId: objectId, isKeyframeable: true, hasKeyframes: false },
      { name: 'Rotation', group: 'Transform', type: 'vec4', value: [0,0,0,1], source: 'object', sourceId: objectId, isKeyframeable: true, hasKeyframes: false },
      { name: 'Scale', group: 'Transform', type: 'vec3', value: [1,1,1], source: 'object', sourceId: objectId, isKeyframeable: true, hasKeyframes: false },
    )

    // Material uniforms
    if (definition.components.material?.uniforms) {
      for (const [name, uniform] of Object.entries(definition.components.material.uniforms)) {
        params.push({
          name,
          group: 'Material',
          type: uniform.type as any,
          value: uniform.default,
          min: uniform.min,
          max: uniform.max,
          step: uniform.step,
          source: 'object',
          sourceId: objectId,
          isKeyframeable: true,
          hasKeyframes: false,
        })
      }
    }

    this.objectParameters.set(objectId, params)
    this.notifySubscribers()
  }

  unregisterObject(objectId: string) {
    this.objectParameters.delete(objectId)
    this.notifySubscribers()
  }

  // Set parameter value (updates WASM or store as appropriate)
  setValue(param: Parameter, value: any) {
    switch (param.source) {
      case 'synth':
        // Existing WASM bridge
        this.wasmModule?._al_webgui_set_parameter_value(param.index, value)
        break

      case 'object':
        // Update object store
        const objectsStore = useObjectsStore()
        objectsStore.setProperty(param.sourceId!, param.name, value)
        break

      case 'environment':
        const envStore = useEnvironmentStore()
        envStore.setProperty(param.name, value)
        break

      case 'camera':
        // Update camera via runtime
        this.runtime?.setCamera(param.name, value)
        break
    }
  }

  // Add keyframe at current time
  addKeyframe(param: Parameter, time: number, value: any) {
    if (!param.isKeyframeable) return

    switch (param.source) {
      case 'object':
        const objectsStore = useObjectsStore()
        objectsStore.addKeyframe(param.sourceId!, param.name, time, value)
        break
      // ... other sources
    }

    param.hasKeyframes = true
    this.notifySubscribers()
  }
}
```

### Updated Parameter Panel UI

```vue
<!-- components/ParameterPanel.vue (UPDATED) -->
<template>
  <div class="parameter-panel">
    <div class="header">
      <span>Parameters</span>
      <div class="filters">
        <button
          v-for="filter in filters"
          :key="filter.source"
          :class="{ active: activeFilters.has(filter.source) }"
          @click="toggleFilter(filter.source)"
        >
          {{ filter.icon }}
        </button>
      </div>
    </div>

    <div class="groups">
      <div
        v-for="group in filteredGroups"
        :key="group.name + group.sourceId"
        class="parameter-group"
      >
        <div class="group-header" @click="group.collapsed = !group.collapsed">
          <span class="icon">{{ getSourceIcon(group.source) }}</span>
          <span class="name">{{ group.name }}</span>
          <span class="chevron">{{ group.collapsed ? '▶' : '▼' }}</span>
        </div>

        <div v-if="!group.collapsed" class="parameters">
          <div
            v-for="param in group.parameters"
            :key="param.name"
            class="parameter"
          >
            <div class="param-header">
              <span class="name">{{ param.name }}</span>
              <button
                v-if="param.isKeyframeable"
                class="keyframe-btn"
                :class="{ active: param.hasKeyframes }"
                @click="addKeyframe(param)"
                title="Add keyframe at current time"
              >
                ◆
              </button>
            </div>

            <!-- Render appropriate control based on type -->
            <FloatSlider
              v-if="param.type === 'float'"
              :param="param"
              @change="setValue(param, $event)"
            />
            <Vec3Input
              v-else-if="param.type === 'vec3'"
              :param="param"
              @change="setValue(param, $event)"
            />
            <ColorPicker
              v-else-if="param.type === 'color'"
              :param="param"
              @change="setValue(param, $event)"
            />
            <!-- ... other types -->
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

---

## Part 1: Current State Compatibility

### Existing Features (PRESERVE ALL)

```
frontend/src/
├── components/
│   └── sequencer/           # Sequencer UI (KEEP, EXTEND)
│       ├── SequencerPanel.vue
│       ├── Timeline.vue
│       ├── ClipTimeline.vue      # ✅ Arrangement view
│       ├── FrequencyRoll.vue
│       ├── ToneLattice.vue
│       └── ...
├── stores/
│   ├── project.ts           # Project state (EXTEND)
│   ├── sequencer.ts         # Sequencer state (✅ Has arrangement.json)
│   ├── settings.ts          # User settings (KEEP)
│   └── terminal.ts          # Terminal + JS API (KEEP)
├── services/
│   ├── compiler.ts          # C++ compilation (KEEP)
│   ├── runtime.ts           # WASM runtime (EXTEND)
│   └── recorder.ts          # ✅ NEW: Video/audio recording
└── utils/
    ├── synthDetection.ts    # Detect SynthVoice classes (KEEP)
    ├── synthSequence.ts     # Parse .synthSequence (KEEP)
    └── parameter-system.ts  # Parameter bridge (EXTEND)
```

### Existing arrangement.json Structure

The sequencer already saves/loads `arrangement.json` with this structure:

```typescript
interface ArrangementFileData {
  version: number
  bpm: number
  loopEnabled: boolean
  loopStart: number
  loopEnd: number
  viewport: { scrollX, scrollY, zoomX, zoomY }
  tracks: Array<{
    synthName: string
    name: string
    color: string
    muted: boolean
    solo: boolean
    expanded: boolean
    automationLanes: Array<{ paramName, collapsed }>
  }>
  clipInstances: Array<{
    filePath: string
    trackSynthName: string
    startTime: number
  }>
}
```

**This can be EXTENDED** for the Events track by adding:

```typescript
interface ArrangementFileData {
  // ... existing fields ...

  // NEW: Events track data
  events?: {
    timedEvents: TimedEvent[]
    listeners: ListenerEvent[]
  }

  // NEW: Object tracks (references to object.json files)
  objectTracks?: ObjectTrack[]

  // NEW: Environment reference
  environment?: string  // path to environment.json
}
```

---

## Part 2: System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ALLOLIB STUDIO ONLINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        FRONTEND (Vue 3 / TypeScript)                    │ │
│  │                                                                         │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │ │
│  │  │   Monaco    │  │   Asset     │  │  Timeline   │  │   Property   │  │ │
│  │  │   Editor    │  │  Library    │  │   Panel     │  │   Inspector  │  │ │
│  │  │  (C++ code) │  │   (NEW)     │  │  (unified)  │  │  (EXTENDED)  │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘  │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │                         STORES (Pinia)                            │  │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │  │ │
│  │  │  │ project  │ │sequencer │ │ objects  │ │   env    │ │ assets │ │  │ │
│  │  │  │ (extend) │ │(✅ exists)│ │  (new)   │ │  (new)   │ │ (NEW)  │ │  │ │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      │ Project Data (JSON)                   │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      RUNTIME LAYER (TypeScript)                         │ │
│  │                                                                         │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────┐ │ │
│  │  │ AudioManager │ │ObjectManager │ │  EnvManager  │ │ EventManager  │ │ │
│  │  │  (exists)    │ │    (new)     │ │    (new)     │ │    (new)      │ │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └───────────────┘ │ │
│  │           │               │               │                │           │ │
│  │  ┌────────┴───────────────┴───────────────┴────────────────┴────────┐ │ │
│  │  │                    Script Sandbox (JS)                            │ │ │
│  │  │         Executes event scripts with controlled context            │ │ │
│  │  └───────────────────────────────────┬──────────────────────────────┘ │ │
│  └──────────────────────────────────────┼──────────────────────────────────┘ │
│                                     │                                        │
│                                     │ WASM Bridge Calls                      │
│                                     ▼                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        ALLOLIB (C++ / WebAssembly)                      │ │
│  │                                                                         │ │
│  │   • Mesh rendering          • Audio synthesis (Gamma)                  │ │
│  │   • Shader compilation      • Spatial audio                            │ │
│  │   • Texture loading         • SynthVoice system                        │ │
│  │   • Transform matrices      • PolySynth / SynthSequencer               │ │
│  │   • Camera / Nav            • Parameter system                         │ │
│  │                                                                         │ │
│  │   *** NO MODIFICATIONS NEEDED - JUST CALL EXISTING APIs ***            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Track Category Specifications

### ♫ AUDIO (Existing - ✅ COMPLETE)

**Status:** Fully implemented with clip-based arrangement

**Already implemented:**
- `.synthSequence` file format
- Clip creation/editing
- Arrangement tracks with mute/solo
- Automation lanes
- `arrangement.json` persistence
- Frequency roll and tone lattice editors

**Integration with new system:**
- Shares timeline/playhead with other track types
- Audio FFT data exposed to Events for audio-reactive scripts
- No changes to existing functionality

---

### ◈ OBJECTS (New)

**What it is:** Visual entities with mesh, material, and transform. Entities that exist in 3D space but aren't tied to audio note triggers.

*(See original plan for full specification - unchanged)*

---

### ◐ ENVIRONMENT (New - Singleton)

**What it is:** Global scene settings. One per project - skybox, fog, ambient lighting, terrain, dynamic lights.

*(See original plan for full specification - unchanged)*

---

### ⚡ EVENTS (New - The Escape Hatch)

**What it is:** Discrete triggers and continuous listeners. Handles camera, markers, callbacks, and full JavaScript scripting for non-linear behavior.

**IMPORTANT:** Events data will be stored in the existing `arrangement.json` file by extending its schema, rather than a separate `events.json` file. This keeps all timeline data unified.

*(See original plan for event types and scripting - unchanged)*

---

## Part 3.5: Unified Timeline Main View (NEW)

### Overview

The existing SequencerPanel.vue will be restructured into a unified TimelinePanel that displays all four track categories in collapsible sections. The current audio sequencer functionality is preserved and extended.

### Full Unified Timeline Mockup

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ◀ ▐▐ ▶  ⏹   🔁   00:00:00.000 / 03:24:00.000   ♩ 120 BPM   [━━━━━━━●━━━━━] 🔊   ⚙   📹 REC       │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│         │    1    │    2    │    3    │    4    │    5    │    6    │    7    │    8    │         │
│  TRACKS │ ┊ ┊ ┊ ┊ │ ┊ ┊ ┊ ┊ │ ┊ ┊ ┊ ┊ │ ┊ ┊ ┊ ┊ │ ┊ ┊ ┊ ┊ │ ┊ ┊ ┊ ┊ │ ┊ ┊ ┊ ┊ │ ┊ ┊ ┊ ┊ │  TIME   │
├─────────┴─────────┴─────────┴─────────┴────▼────┴─────────┴─────────┴─────────┴─────────┴─────────┤
│                                            │ ◀── PLAYHEAD                                         │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▼ ♫ AUDIO (3 tracks)                                                            [M] [S] [+]       │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ │ ▶ FMSynth        │ [M][S]│ ┃intro.synthSeq┃━━━━━━━━━┃verse.synthSeq┃━━━━━┃chorus.synthSeq┃     │
│ │   └─ amplitude   │       │ ◆───────◆                 ◆════════════◆                             │
│ │   └─ modDepth    │       │         ◆─────────────────◆                                          │
│ ├──────────────────┼───────┼─────────────────────────────────────────────────────────────────────│
│ │ ▶ PadSynth       │ [M][S]│ ━━━━━━━━━━━━━━━┃pad_long.synthSeq┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ ├──────────────────┼───────┼─────────────────────────────────────────────────────────────────────│
│ │ ▶ DrumSynth      │ [M][S]│ ┃drums.synthSeq┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▼ ◈ OBJECTS (4 objects)                                                         [👁] [🔒] [+]     │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ │ ▶ crystal_main   │ [👁][🔒]│ ────[spawn]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ │   └─ positionX   │       │      ◆════════════════════════◆                                     │
│ │   └─ positionY   │       │      ◆────────────◆───────────◆────────────◆                        │
│ │   └─ rotationY   │       │      ◆══════════════════════════════════════◆                       │
│ │   └─ scale       │       │      ◆                                      ◆                       │
│ ├──────────────────┼───────┼─────────────────────────────────────────────────────────────────────│
│ │ ▷ particle_emitter│[👁][🔒]│ ━━━━━━━━━━━━[spawn]━━━━━━━━━━━━━━━━━━━━━━━━━━━━[destroy]───────────│
│ ├──────────────────┼───────┼─────────────────────────────────────────────────────────────────────│
│ │ ▷ floating_rocks │ [👁][🔒]│ [spawn]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ ├──────────────────┼───────┼─────────────────────────────────────────────────────────────────────│
│ │ ▷ ground_plane   │ [👁][🔒]│ [spawn]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▼ ◐ ENVIRONMENT                                                                 [⚙]              │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ │   Skybox         │       │ ┃dark_cave.hdr┃━━━━━━━━━━━━━━[↔]━━━━━━┃crystal_glow.hdr┃━━━━━━━━━━│
│ │   └─ rotation    │       │ ◆════════════════════════════════════════════════════◆              │
│ │   └─ intensity   │       │ ◆────────────────◆═══════════════════════◆                          │
│ ├──────────────────┼───────┼─────────────────────────────────────────────────────────────────────│
│ │   Fog            │       │ ━━━━━━━━━━━━━━━━━━━[enable]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ │   └─ density     │       │                     ◆════════════════════◆                          │
│ │   └─ color       │       │                     ◆────────────────────◆                          │
│ ├──────────────────┼───────┼─────────────────────────────────────────────────────────────────────│
│ │   Ambient Light  │       │ ◆═════════════════════════════════════════════════════════════════◆│
│ │   └─ intensity   │       │ ◆────────────◆═══════════════════════════◆                          │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▼ ⚡ EVENTS                                                                      [+]              │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ │   Timed Events   │       │ ▼intro    ▼cam_dolly   ▼spawn_fx              ▼fade_out   ▼end     │
│ │                  │       │  │          │            │                       │          │       │
│ ├──────────────────┼───────┼─────────────────────────────────────────────────────────────────────│
│ │   Camera         │       │ ┃orbit┃━━━━━━━━━━┃follow:crystal┃━━━━━━━━━━━━┃cinematic┃━━━━━━━━━━│
│ │   └─ fov         │       │ ◆════◆───────────◆                            ◆═══════════════════◆│
│ │   └─ position    │       │ ◆────────────────◆═══════════════════════════◆                     │
│ ├──────────────────┼───────┼─────────────────────────────────────────────────────────────────────│
│ │   Markers        │       │ 🚩start   🚩buildup      🚩drop                   🚩outro           │
│ ├──────────────────┼───────┼─────────────────────────────────────────────────────────────────────│
│ │ ▷ Listeners (3)  │ [on]  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│ │   └─ onBeat      │       │ (continuous - triggers on audio beat detection)                    │
│ │   └─ onKeyPress  │       │ (input - responds to spacebar)                                     │
│ │   └─ onCollision │       │ (custom - script checks object proximity)                          │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Track Section Behavior

#### Header Bar (Transport)
```
◀ ▐▐ ▶  ⏹   🔁   00:00:00.000 / 03:24:00.000   ♩ 120 BPM   [━━━━━━━●━━━━━] 🔊   ⚙   📹 REC
│  │  │   │    │   │                             │            │         │    │    │
│  │  │   │    │   └─ Current / Total time       │            │         │    │    └─ Record video
│  │  │   │    └─ Loop toggle                    │            │         │    └─ Settings
│  │  │   └─ Stop                                │            │         └─ Master volume
│  │  └─ Play/Pause                              │            └─ Zoom slider
│  └─ Step backward                              └─ Tempo (editable)
└─ Step forward
```

#### Section Headers (Collapsible)
```
▼ ♫ AUDIO (3 tracks)                    [M] [S] [+]
│  │        │                            │   │   └─ Add new track
│  │        │                            │   └─ Solo all (isolate audio)
│  │        └─ Track count               └─ Mute all
│  └─ Category icon
└─ Collapse/expand toggle (▼/▶)

▼ ◈ OBJECTS (4 objects)                 [👁] [🔒] [+]
                                         │    │    └─ Add new object
                                         │    └─ Lock all (prevent edits)
                                         └─ Visibility toggle all

▼ ◐ ENVIRONMENT                         [⚙]
                                          └─ Environment settings modal

▼ ⚡ EVENTS                              [+]
                                          └─ Add new event
```

#### Track Lane Elements

**Audio Clips:**
```
┃intro.synthSeq┃━━━━━━━━━┃verse.synthSeq┃
│              │         │              │
└─ Clip block  │         └─ Another clip
               └─ Empty space (no audio)
```

**Object Lifecycle:**
```
────[spawn]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[destroy]────
    │                                        │
    └─ Object appears at this time           └─ Object removed
```

**Keyframe Curves:**
```
◆════════════════════════◆      Linear interpolation (═)
◆────────────◆───────────◆      Bezier/smooth curve (─)
◆                        ◆      Hold/step (just keyframes, no line)
```

**Environment Transitions:**
```
┃dark_cave.hdr┃━━━━━━━━━━━━━━[↔]━━━━━━┃crystal_glow.hdr┃
│             │              │        │                 │
└─ Active HDR │              │        └─ Next HDR       │
              │              └─ Crossfade zone          │
              └─ Duration bar ━━━━━━━━━━━━━━━━━━━━━━━━━┘
```

**Event Markers:**
```
▼intro    ▼cam_dolly   ▼spawn_fx          ▼fade_out
 │          │            │                   │
 └─ Timed event (click to edit properties)

🚩start   🚩buildup      🚩drop             🚩outro
 │          │             │                  │
 └─ Marker (navigation point, no action)
```

### Component Structure

```
TimelinePanel.vue (replaces/extends SequencerPanel.vue)
├── TransportBar.vue
│   ├── PlaybackControls.vue (play, pause, stop, step)
│   ├── TimeDisplay.vue (current time, total duration)
│   ├── TempoControl.vue (BPM input)
│   ├── ZoomSlider.vue
│   └── RecordButton.vue
│
├── TimeRuler.vue (beat/time grid)
│
├── TrackContainer.vue (scrollable)
│   │
│   ├── TrackSection.vue (♫ AUDIO)
│   │   ├── SectionHeader.vue (collapse, count, M/S/+)
│   │   └── AudioTrackLane.vue[] (existing, adapted)
│   │       ├── TrackHeader.vue (name, M/S buttons)
│   │       ├── ClipTimeline.vue (existing - .synthSequence clips)
│   │       └── AutomationLane.vue[] (parameter keyframes)
│   │
│   ├── TrackSection.vue (◈ OBJECTS)
│   │   ├── SectionHeader.vue (collapse, count, 👁/🔒/+)
│   │   └── ObjectTrackLane.vue[] (new)
│   │       ├── TrackHeader.vue (name, visibility, lock)
│   │       ├── LifecycleBar.vue (spawn → destroy)
│   │       └── KeyframeLane.vue[] (transform/material curves)
│   │
│   ├── TrackSection.vue (◐ ENVIRONMENT)
│   │   ├── SectionHeader.vue (collapse, ⚙)
│   │   └── EnvironmentLane.vue[] (new)
│   │       ├── SkyboxLane.vue (HDR transitions)
│   │       ├── FogLane.vue (enable/disable + params)
│   │       └── LightingLane.vue (ambient + dynamic lights)
│   │
│   └── TrackSection.vue (⚡ EVENTS)
│       ├── SectionHeader.vue (collapse, +)
│       ├── TimedEventLane.vue (event markers)
│       ├── CameraLane.vue (camera modes + keyframes)
│       ├── MarkerLane.vue (navigation markers)
│       └── ListenerPanel.vue (non-linear event list)
│
└── Playhead.vue (vertical line, draggable)
```

### Interaction Patterns

| Action | Behavior |
|--------|----------|
| Click section header | Collapse/expand track group |
| Drag playhead | Scrub timeline, update all stores |
| Double-click empty space | Create new clip/keyframe/event at that time |
| Drag clip/keyframe | Move in time (snap to grid if enabled) |
| Drag clip edge | Resize clip duration |
| Right-click track | Context menu (delete, duplicate, properties) |
| Ctrl+scroll | Zoom timeline horizontally |
| Shift+scroll | Scroll timeline vertically |
| Click keyframe ◆ | Select for editing in Property Panel |
| Drag between keyframes | Adjust curve tension (bezier) |
| Spacebar | Play/pause |
| Home/End | Jump to start/end |

### Color Coding

| Category | Header Color | Track Background | Accent |
|----------|--------------|------------------|--------|
| ♫ Audio | `#6B46C1` (purple) | `#2D1F4E` | `#9F7AEA` |
| ◈ Objects | `#2B6CB0` (blue) | `#1A365D` | `#63B3ED` |
| ◐ Environment | `#276749` (green) | `#1C4532` | `#68D391` |
| ⚡ Events | `#C05621` (orange) | `#652B19` | `#F6AD55` |

### Responsive Behavior

**Collapsed Section:**
```
▶ ♫ AUDIO (3 tracks)                    [M] [S] [+]
▶ ◈ OBJECTS (4 objects)                 [👁] [🔒] [+]
▼ ◐ ENVIRONMENT                         [⚙]
│  (expanded content...)
▶ ⚡ EVENTS                              [+]
```

**Narrow Width (< 800px):**
- Section headers stack vertically
- Track names truncate with ellipsis
- Keyframe lanes collapse into single summary lane
- Tooltip shows full details on hover

**Timeline Zoom Levels:**
- Zoomed out: Show only clips and lifecycle bars
- Normal: Show clips + keyframe diamonds
- Zoomed in: Show keyframe curves with tangent handles

---

## Part 4: Implementation Phases (UPDATED)

### Phase 0: Asset Library & Parameter Panel - **ASSET LIBRARY ✅ COMPLETE**

**Goal:** Create foundational asset management and unified parameter system.

#### Week 1: Asset Library ✅ COMPLETE (2026-01-30)
- [x] Create `stores/assetLibrary.ts` - Full store with 7 asset types, loading states, priorities
- [x] Create `AssetLibrary.vue` component - Complete UI with search, categories, favorites
- [x] Implement built-in snippet loading - Extensive synth and graphics snippets
- [x] Implement drag & drop to file explorer - Working
- [x] Add click-to-insert for code snippets - Working
- [x] Terminal `assets` command - list, textures, meshes, environments, load, preload, status, info
- [x] Terminal `graphics` command - status, preset, lod
- [x] Glossary updates - 25+ new entries for Auto-LOD, PBR, Procedural, Assets
- [ ] Backend: Asset storage API endpoints (frontend-only for now)
- [ ] Backend: Built-in asset directory structure (frontend-only for now)

#### Week 2: Unified Parameter Panel ✅ COMPLETE (2026-01-30)
- [x] Basic parameter system exists - Works for synth parameters
- [x] Extend `parameter-system.ts` for multiple sources - Added setParameterValue(), syncCameraToWasm()
- [x] Update `ParameterPanel.vue` for grouped display - Source badges, collapsible groups
- [x] Add source filtering (synth/object/env/camera) - Filter pills with icons
- [x] Add keyframe button to parameters - With live playhead time display
- [x] Connect to object/environment stores - Full store implementation
- [x] Add vec3/vec4/color input components - Vec3Input, ColorPicker in `components/inputs/`
- [x] Create objects store (`stores/objects.ts`) - CRUD, keyframes, serialization
- [x] Create environment store (`stores/environment.ts`) - Fog, ambient, skybox, HDRI
- [x] Register stores for terminal access (`main.ts`)
- [x] Add info bar explaining presets vs keyframes

### Phase 1: Object Track Foundation + Timeline Restructure (3 weeks)

**Goal:** Restructure main timeline view and add basic object spawning.

#### Week 1: Timeline Panel Restructure
- [ ] Create `TimelinePanel.vue` (extends SequencerPanel concepts)
- [ ] Create `TransportBar.vue` with unified playback controls
- [ ] Create `TimeRuler.vue` with beat/time grid
- [ ] Create `TrackSection.vue` component (collapsible sections)
- [ ] Create `SectionHeader.vue` with category icons and controls
- [ ] Create `TrackContainer.vue` with scroll sync
- [ ] Adapt existing `ClipTimeline.vue` for audio section
- [ ] Add section collapse/expand state to store
- [ ] Implement color coding per category

#### Week 2: Object Track UI
- [ ] Create `ObjectTrackLane.vue` component
- [ ] Create `LifecycleBar.vue` (spawn → destroy visualization)
- [ ] Create `KeyframeLane.vue` (keyframe diamonds on timeline)
- [ ] Add object tracks to `TrackSection.vue`
- [ ] Implement drag-to-adjust spawn/destroy times
- [ ] Connect to existing `stores/objects.ts`
- [ ] Object selection syncs with Parameter Panel

#### Week 3: Object Runtime
- [ ] Create `ObjectManager` runtime class
- [ ] Implement object spawn/destroy lifecycle
- [ ] Connect object keyframes to runtime interpolation
- [ ] Sync object transforms to WASM via bridge
- [ ] Timeline playback drives object state
- [ ] Test with multiple objects and keyframe curves

### Phase 2: Keyframe Animation (2 weeks)

**Goal:** Full keyframe curve editing with visual editor.

#### Week 1: Curve Editor Core
- [ ] Create `CurveEditor.vue` component (modal or docked panel)
- [ ] Implement keyframe curve data structure with easing types
- [ ] Create bezier curve editor with tangent handles
- [ ] Add easing type selector (linear, easeIn, easeOut, easeInOut, step)
- [ ] Implement curve preview in `KeyframeLane.vue`
- [ ] Connect to objects store keyframe system

#### Week 2: Curve Editor UI Polish
- [ ] Add/remove/move keyframes via click/drag
- [ ] Multi-select keyframes for batch operations
- [ ] Copy/paste keyframes
- [ ] Curve presets (bounce, elastic, smooth)
- [ ] Keyboard shortcuts (K = add keyframe, Del = remove)
- [ ] Integrate with Parameter Panel keyframe buttons

### Phase 3: Environment Track (2 weeks)

**Goal:** Global scene settings with timeline animation.

#### Week 1: Environment Track UI
- [ ] Create `EnvironmentLane.vue` parent component
- [ ] Create `SkyboxLane.vue` with HDR transition visualization
- [ ] Create `FogLane.vue` with enable/disable + density curve
- [ ] Create `LightingLane.vue` for ambient and dynamic lights
- [ ] Add environment section to timeline with [⚙] settings
- [ ] Connect to existing `stores/environment.ts`

#### Week 2: Environment Runtime
- [ ] Create `EnvironmentManager` runtime class
- [ ] Implement HDR/skybox crossfade transitions
- [ ] Sync fog settings to WASM
- [ ] Sync ambient lighting to WASM
- [ ] Add dynamic light support (point, directional, spot)
- [ ] Timeline playback drives environment state

### Phase 4: Events Track - Timed Events (2 weeks)

**Goal:** Camera and discrete events on timeline.

#### Week 1: Events Core
- [ ] Create `stores/events.ts` with timed events and listeners
- [ ] Extend `arrangement.json` schema for events data
- [ ] Create `EventManager` runtime class
- [ ] Implement camera state machine (orbit, follow, cinematic, shake)
- [ ] Implement basic actions: camera, spawn, destroy, set, emit
- [ ] Timed event execution during playback

#### Week 2: Events Track UI
- [ ] Create `TimedEventLane.vue` with event markers (▼)
- [ ] Create `CameraLane.vue` with camera mode segments
- [ ] Create `MarkerLane.vue` with navigation markers (🚩)
- [ ] Event property editor in right panel
- [ ] Camera path visualization (optional 3D preview)
- [ ] Drag events to reposition in time

### Phase 5: Events Track - Scripting (2 weeks)

**Goal:** JavaScript scripting and non-linear listeners.

#### Week 1: Script System
- [ ] Create `ScriptSandbox` with controlled context
- [ ] Implement script context object (time, objects, audio, env, camera)
- [ ] Monaco editor integration for JavaScript editing
- [ ] Autocomplete for context object properties
- [ ] Script action type for timed events
- [ ] Error handling and display

#### Week 2: Listener System
- [ ] Create `ListenerPanel.vue` for non-linear events
- [ ] Implement listener types: condition, input, audio, custom
- [ ] Add cooldown management
- [ ] Enable/disable listeners toggle
- [ ] Audio FFT data exposure to scripts
- [ ] Listener debugging panel (shows trigger history)

### Phase 6: Integration & Polish (2 weeks)

**Goal:** Unified experience, polish, and testing.

#### Week 1: Integration
- [ ] Verify all 4 track types render in unified timeline
- [ ] Global transport controls work for all track types
- [ ] Playhead scrubbing updates all stores
- [ ] Snap to grid / snap to beat
- [ ] Copy/paste tracks, clips, keyframes, events
- [ ] Undo/redo integration for all operations

#### Week 2: Polish & Export
- [ ] Project save/load with all new data types
- [ ] Performance optimization (virtualized track rendering)
- [ ] Keyboard shortcuts documentation
- [ ] Timeline zoom levels (collapsed → detailed view)
- [ ] Responsive layout for narrow screens
- [ ] Export functionality for native projects

---

## Summary of Changes from Original Plan

### Recently Completed (2026-01-30)

1. **Asset Library System (✅ COMPLETE)** - Full frontend implementation:
   - `stores/assetLibrary.ts` - 7 asset types, loading states, priority system
   - `components/AssetLibrary.vue` - Search, categories, favorites, import
   - PlayCanvas-style loading states (idle/loading/ready/error)
   - Priority preload system (critical/high/normal/low)

2. **Procedural Textures (✅ COMPLETE)** - `al_WebProcedural.hpp`:
   - Perlin noise with FBM (Fractal Brownian Motion)
   - Simplex noise
   - Worley/Voronoi cellular noise (F1, F2, F2-F1, F1*F2 modes)
   - Gradient, wave, ring pattern generators

3. **Mipmap Texture LOD (✅ COMPLETE)** - `al_WebMipmapTexture.hpp`:
   - GPU auto-generated mipmaps via `glGenerateMipmap()`
   - Continuous (float) LOD calculation
   - Reference distance-based LOD formula
   - Anisotropic filtering support

4. **Terminal Commands (✅ COMPLETE)**:
   - `assets` command - list, textures, meshes, environments, load, preload, status, info
   - `graphics` command - status, preset, lod

5. **Glossary Updates (✅ COMPLETE)** - 25+ new entries for:
   - Auto-LOD family (enableAutoLOD, drawLOD, LODSelectionMode, etc.)
   - Quality management (QualityManager, QualityPreset)
   - Procedural textures (ProceduralTexture, noise functions)
   - Asset system (Asset, preloadAssets, AssetPriority)
   - Mipmap textures (MipmapTexture)

### Previously Completed

6. **Advanced Graphics System (✅ COMPLETE)** - Full suite of web graphics features:
   - PBR Materials (`al_WebPBR.hpp`) - Metallic-roughness workflow, IBL support
   - LOD System (`al_WebLOD.hpp`) - Mesh simplification with quadric error metrics
   - **Auto-LOD (`al_WebAutoLOD.hpp`)** - Unreal Engine-style automatic LOD:
     - Enabled by default for all g.draw() calls (no code changes needed!)
     - Selection modes: Distance, ScreenSize, ScreenError (Nanite-like), TriangleBudget
     - Configurable via Graphics Settings in toolbar
     - Transpiler auto-converts g.draw() to LOD-aware calls
   - Quality Management (`al_WebQuality.hpp`) - Adaptive quality based on FPS
   - Environment System (`al_WebEnvironment.hpp`) - Skybox, reflections, IBL
   - OBJ Loading (`al_WebOBJ.hpp`) - Wavefront OBJ mesh import
   - HDR Loading (`al_WebHDR.hpp`) - HDR image support

7. **Native Compatibility Layer (✅ COMPLETE)** - `native_compat/` headers provide identical APIs for native AlloLib:
   - `al_StudioCompat.hpp` - Master include with all aliases
   - Auto-conversion of `Web*` includes to `Native*` equivalents
   - Shader transpilation (WebGL2 ↔ Desktop GLSL)

8. **Graphics Settings UI (✅ COMPLETE)** - Quality preset controls in Toolbar.vue

9. **Unified Parameter Panel (✅ COMPLETE)** - Full multi-source panel with keyframes:
   - `parameter-system.ts` - Value routing to stores, camera WASM sync
   - `ParameterPanel.vue` - Source filtering, keyframe handlers, info bar
   - `stores/objects.ts` - Object management with keyframe curves
   - `stores/environment.ts` - Environment settings with keyframe support
   - `main.ts` - Store registration for terminal access

### Remaining Work

**Estimated timeline:** 8-10 weeks for remaining phases (Phase 0 asset work complete)

**Files still to create:**
- `backend/src/routes/assets.ts` - Backend API (currently frontend-only)
- `backend/src/services/assetService.ts` - Backend service
- `backend/assets/built-in/` - Server-side asset storage

**Files to extend:**
- `utils/parameter-system.ts` - Multi-source parameters
- `components/ParameterPanel.vue` - Grouped display with keyframe support
- `stores/sequencer.ts` - Events data in arrangement.json

---

## Part 7: Native Import/Export Transpiler

### Overview

The transpiler system enables bidirectional conversion between AlloLib Studio Online's web-based formats and native AlloLib C++ projects. This allows:

1. **Export**: Generate standalone C++ projects from web projects
2. **Import**: Load existing AlloLib Playground projects into the web IDE
3. **Round-trip**: Edit in web, export to native, continue development locally

### Native Compatibility Layer (✅ IMPLEMENTED)

AlloLib Studio Online provides a complete native compatibility layer that enables Studio-specific features to run in native AlloLib projects without modification. The `native_compat/` headers provide identical APIs to the web versions:

| Web Header | Native Header | Status |
|------------|---------------|--------|
| `al_WebOBJ.hpp` | `native_compat/al_NativeOBJ.hpp` | ✅ Complete |
| `al_WebHDR.hpp` | `native_compat/al_NativeHDR.hpp` | ✅ Complete |
| `al_WebEnvironment.hpp` | `native_compat/al_NativeEnvironment.hpp` | ✅ Complete |
| `al_WebLOD.hpp` | `native_compat/al_NativeLOD.hpp` | ✅ Complete |
| `al_WebQuality.hpp` | `native_compat/al_NativeQuality.hpp` | ✅ Complete |
| `al_WebPBR.hpp` | Manual shader porting needed | 🔄 Partial |
| `al_WebFont.hpp` | Web-only (use FreeType) | ❌ N/A |

**Usage:** Include `native_compat/al_StudioCompat.hpp` to get all native implementations with `Web*` type aliases for seamless code portability.

**Dependencies:**
- `stb_image.h` for HDR loading (define `STB_IMAGE_IMPLEMENTATION` in one .cpp file)
- OpenGL 3.3+ or 4.1+
- Native AlloLib

### File Format Mapping

| Web Format | Native Format | Direction |
|------------|---------------|-----------|
| `.synthSequence` | `.synthSequence` | Bidirectional (already compatible) |
| `arrangement.json` | Generated C++ | Export only |
| `*.object.json` | C++ class / header | Export only |
| `environment.json` | C++ initialization code | Export only |
| Events (in arrangement.json) | C++ event handlers | Export only |
| Keyframe curves | C++ interpolation code | Export only |
| `.preset` files | `.preset` files | Bidirectional (already compatible) |
| Asset snippets | C++ source | Export (insert into files) |
| `al_Web*.hpp` includes | `native_compat/al_Native*.hpp` | ✅ Auto-converted |
| WebGL2 shaders (#300 es) | Desktop GLSL (#330 core) | ✅ Auto-converted |

### Export Transpiler Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXPORT TRANSPILER                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │ Project Store │    │ Object Store │    │ Sequencer Store          │  │
│  │ (files, code) │    │ (objects)    │    │ (arrangement, events)    │  │
│  └──────┬───────┘    └──────┬───────┘    └────────────┬─────────────┘  │
│         │                   │                         │                  │
│         └───────────────────┴─────────────────────────┘                  │
│                             │                                            │
│                             ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Transpiler Core                                │   │
│  │                                                                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐│   │
│  │  │  CodeGen    │  │  AssetGen   │  │ SequenceGen │  │ BuildGen ││   │
│  │  │  (C++ code) │  │  (shaders,  │  │ (.synth     │  │ (CMake,  ││   │
│  │  │             │  │  textures)  │  │  Sequence)  │  │ scripts) ││   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘│   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                             │                                            │
│                             ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Output Structure                              │   │
│  │                                                                   │   │
│  │  project_name/                                                    │   │
│  │  ├── CMakeLists.txt           # Build configuration              │   │
│  │  ├── src/                                                         │   │
│  │  │   ├── main.cpp             # Generated main with all setup    │   │
│  │  │   ├── objects/             # Generated object classes         │   │
│  │  │   │   ├── MyObject.hpp                                        │   │
│  │  │   │   └── ...                                                  │   │
│  │  │   ├── synths/              # User synth classes               │   │
│  │  │   │   └── MySynth.hpp                                         │   │
│  │  │   └── environment.hpp      # Environment setup code           │   │
│  │  ├── bin/                                                         │   │
│  │  │   ├── MySynth-data/        # .synthSequence files             │   │
│  │  │   └── presets/             # .preset files                    │   │
│  │  ├── shaders/                 # GLSL shaders                     │   │
│  │  ├── textures/                # Texture assets                   │   │
│  │  └── meshes/                  # 3D model assets                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Code Generation Templates

#### Object → C++ Class

```typescript
// services/transpiler/objectCodeGen.ts

export function generateObjectClass(obj: ObjectDefinition): string {
  const className = toPascalCase(obj.id)

  return `
#pragma once
#include "al/app/al_App.hpp"
#include "al/graphics/al_Shapes.hpp"

class ${className} {
public:
  al::Mesh mesh;
  al::Vec3f position{${obj.components.transform.position.join(', ')}};
  al::Quatf rotation{${obj.components.transform.rotation.join(', ')}};
  al::Vec3f scale{${obj.components.transform.scale.join(', ')}};
  ${generateMaterialUniforms(obj.components.material)}

  void init() {
    ${generateMeshInit(obj.components.mesh)}
    ${generateShaderInit(obj.components.material)}
  }

  void update(double dt) {
    ${generateAnimationCode(obj)}
  }

  void draw(al::Graphics& g) {
    g.pushMatrix();
    g.translate(position);
    g.rotate(rotation);
    g.scale(scale);
    ${generateMaterialApply(obj.components.material)}
    g.draw(mesh);
    g.popMatrix();
  }
};
`
}
```

#### Keyframe Curves → C++ Interpolation

```typescript
// services/transpiler/keyframeCodeGen.ts

export function generateKeyframeInterpolation(
  curve: KeyframeCurve<any>,
  propertyPath: string
): string {
  if (curve.keyframes.length === 0) return ''
  if (curve.keyframes.length === 1) {
    return `${propertyPath} = ${formatValue(curve.keyframes[0].value)};`
  }

  // Generate lookup table for complex curves
  const keyframeData = curve.keyframes.map(kf => ({
    time: kf.time,
    value: kf.value,
    easing: kf.easing
  }))

  return `
// Keyframe animation for ${propertyPath}
static const std::vector<Keyframe> ${sanitizeName(propertyPath)}_keyframes = {
  ${keyframeData.map(kf => `{${kf.time}f, ${formatValue(kf.value)}, Easing::${kf.easing}}`).join(',\n  ')}
};
${propertyPath} = interpolateKeyframes(${sanitizeName(propertyPath)}_keyframes, time);
`
}
```

#### Events → C++ Event Handlers

```typescript
// services/transpiler/eventCodeGen.ts

export function generateEventHandlers(events: EventsData): string {
  const timedHandlers = events.timedEvents.map(event => `
    // ${event.id}: ${event.action.type} at ${event.time}s
    if (time >= ${event.time}f && !triggered_${sanitize(event.id)}) {
      triggered_${sanitize(event.id)} = true;
      ${generateActionCode(event.action)}
    }
  `).join('\n')

  const listenerHandlers = events.listeners.map(listener => `
    // Listener: ${listener.id}
    ${generateListenerCode(listener)}
  `).join('\n')

  return `
class EventManager {
  ${events.timedEvents.map(e => `bool triggered_${sanitize(e.id)} = false;`).join('\n  ')}

public:
  void update(double time, App& app) {
    ${timedHandlers}
    ${listenerHandlers}
  }

  void reset() {
    ${events.timedEvents.map(e => `triggered_${sanitize(e.id)} = false;`).join('\n    ')}
  }
};
`
}
```

#### Generated main.cpp Structure

```typescript
// services/transpiler/mainCodeGen.ts

export function generateMainCpp(project: ProjectData): string {
  return `
#include "al/app/al_App.hpp"
#include "al/app/al_GUIDomain.hpp"
#include "al/scene/al_SynthSequencer.hpp"
${project.objects.map(o => `#include "objects/${toPascalCase(o.id)}.hpp"`).join('\n')}
${project.synths.map(s => `#include "synths/${s.name}.hpp"`).join('\n')}
#include "environment.hpp"

using namespace al;

class ${project.name}App : public App {
public:
  // Synths
  ${project.synths.map(s => `SynthGUIManager<${s.name}> ${camelCase(s.name)};`).join('\n  ')}
  SynthSequencer sequencer;

  // Objects
  ${project.objects.map(o => `${toPascalCase(o.id)} ${camelCase(o.id)};`).join('\n  ')}

  // Environment
  Environment env;

  // Events
  EventManager events;

  // Timeline
  double playheadTime = 0;
  bool isPlaying = false;

  void onCreate() override {
    // Initialize synths
    ${project.synths.map(s => `${camelCase(s.name)}.init(this);`).join('\n    ')}

    // Load sequences
    ${generateSequenceLoading(project)}

    // Initialize objects
    ${project.objects.map(o => `${camelCase(o.id)}.init();`).join('\n    ')}

    // Initialize environment
    env.init(this);

    // Setup camera
    ${generateCameraSetup(project)}
  }

  void onAnimate(double dt) override {
    if (isPlaying) {
      playheadTime += dt;
      events.update(playheadTime, *this);
    }

    // Update objects
    ${project.objects.map(o => `${camelCase(o.id)}.update(dt);`).join('\n    ')}

    // Update environment
    env.update(dt);
  }

  void onDraw(Graphics& g) override {
    g.clear(env.backgroundColor);
    env.apply(g);

    // Draw objects
    ${project.objects.map(o => `${camelCase(o.id)}.draw(g);`).join('\n    ')}

    // Draw synth visuals
    ${project.synths.map(s => `${camelCase(s.name)}.render(g);`).join('\n    ')}
  }

  void onSound(AudioIOData& io) override {
    sequencer.render(io);
    ${project.synths.map(s => `${camelCase(s.name)}.synth().render(io);`).join('\n    ')}
  }

  bool onKeyDown(Keyboard const& k) override {
    ${generateKeyboardHandlers(project)}
    return true;
  }
};

int main() {
  ${project.name}App app;
  app.configureAudio(48000, 512, 2, 0);
  app.start();
  return 0;
}
`
}
```

### Import Transpiler

#### AlloLib Playground Project Import

```typescript
// services/transpiler/projectImport.ts

export interface ImportResult {
  files: ProjectFile[]
  synths: DetectedSynth[]
  sequences: string[]  // paths to .synthSequence files
  presets: string[]    // paths to .preset files
  assets: {
    shaders: string[]
    textures: string[]
    meshes: string[]
  }
  warnings: string[]
}

export async function importAlloLibProject(
  projectPath: string
): Promise<ImportResult> {
  const result: ImportResult = {
    files: [],
    synths: [],
    sequences: [],
    presets: [],
    assets: { shaders: [], textures: [], meshes: [] },
    warnings: []
  }

  // Scan for C++ files
  const cppFiles = await glob(`${projectPath}/**/*.{cpp,hpp,h}`)
  for (const file of cppFiles) {
    const content = await readFile(file)
    result.files.push({
      name: basename(file),
      path: relative(projectPath, file),
      content
    })

    // Detect synth classes
    const synths = detectSynthClasses([{ name: basename(file), content }])
    result.synths.push(...synths)
  }

  // Scan for .synthSequence files
  const seqFiles = await glob(`${projectPath}/bin/**/*.synthSequence`)
  for (const file of seqFiles) {
    result.sequences.push(relative(projectPath, file))
    const content = await readFile(file)
    result.files.push({
      name: basename(file),
      path: relative(projectPath, file),
      content
    })
  }

  // Scan for presets
  const presetFiles = await glob(`${projectPath}/bin/**/*.preset`)
  for (const file of presetFiles) {
    result.presets.push(relative(projectPath, file))
    const content = await readFile(file)
    result.files.push({
      name: basename(file),
      path: relative(projectPath, file),
      content
    })
  }

  // Scan for shaders
  const shaderFiles = await glob(`${projectPath}/**/*.{glsl,vert,frag}`)
  for (const file of shaderFiles) {
    result.assets.shaders.push(relative(projectPath, file))
    // Convert to WebGL2-compatible if needed
    const content = await readFile(file)
    const webglContent = transpileShaderToWebGL2(content)
    result.files.push({
      name: basename(file),
      path: relative(projectPath, file),
      content: webglContent
    })
    if (content !== webglContent) {
      result.warnings.push(`Shader ${basename(file)} was converted to WebGL2 format`)
    }
  }

  return result
}
```

#### Shader WebGL2 Transpilation

```typescript
// services/transpiler/shaderTranspile.ts

export function transpileShaderToWebGL2(glslSource: string): string {
  let output = glslSource

  // Convert GLSL 330 to GLSL ES 3.0
  output = output.replace(/#version\s+330\s*(core)?/g, '#version 300 es')

  // Add precision qualifiers if missing
  if (!output.includes('precision ')) {
    output = output.replace(
      /(#version 300 es)/,
      '$1\nprecision highp float;\nprecision highp int;'
    )
  }

  // Convert deprecated functions
  output = output.replace(/texture2D\s*\(/g, 'texture(')
  output = output.replace(/textureCube\s*\(/g, 'texture(')

  // Convert attribute/varying to in/out (vertex shader)
  if (output.includes('gl_Position')) {
    output = output.replace(/\battribute\b/g, 'in')
    output = output.replace(/\bvarying\b/g, 'out')
  }

  // Convert varying to in (fragment shader)
  if (output.includes('gl_FragColor') || output.includes('fragColor')) {
    output = output.replace(/\bvarying\b/g, 'in')
    // gl_FragColor → out variable
    if (output.includes('gl_FragColor')) {
      output = output.replace(
        /(precision.*;\n)/,
        '$1out vec4 fragColor;\n'
      )
      output = output.replace(/gl_FragColor/g, 'fragColor')
    }
  }

  return output
}

export function transpileShaderToDesktop(webglSource: string): string {
  let output = webglSource

  // Convert GLSL ES 3.0 to GLSL 330
  output = output.replace(/#version\s+300\s+es/g, '#version 330 core')

  // Remove precision qualifiers (not needed in desktop GLSL)
  output = output.replace(/precision\s+(highp|mediump|lowp)\s+\w+;\n?/g, '')

  return output
}
```

### Export UI Integration

```vue
<!-- components/ExportDialog.vue -->
<template>
  <div class="export-dialog">
    <h2>Export Native Project</h2>

    <div class="options">
      <div class="option">
        <label>Project Name</label>
        <input v-model="projectName" />
      </div>

      <div class="option">
        <label>Export Format</label>
        <select v-model="exportFormat">
          <option value="allolib-playground">AlloLib Playground (CMake)</option>
          <option value="standalone">Standalone App</option>
          <option value="zip">ZIP Archive</option>
        </select>
      </div>

      <div class="option">
        <label>Include</label>
        <div class="checkboxes">
          <label><input type="checkbox" v-model="include.sequences" /> Sequences</label>
          <label><input type="checkbox" v-model="include.presets" /> Presets</label>
          <label><input type="checkbox" v-model="include.assets" /> Assets</label>
          <label><input type="checkbox" v-model="include.buildScripts" /> Build Scripts</label>
        </div>
      </div>

      <div class="option">
        <label>Target Platform</label>
        <select v-model="targetPlatform">
          <option value="cross-platform">Cross-Platform (CMake)</option>
          <option value="macos">macOS</option>
          <option value="windows">Windows</option>
          <option value="linux">Linux</option>
        </select>
      </div>
    </div>

    <div class="preview">
      <h3>Files to Generate</h3>
      <ul>
        <li v-for="file in previewFiles" :key="file.path">
          <span class="icon">{{ getFileIcon(file.type) }}</span>
          {{ file.path }}
          <span class="size">({{ formatSize(file.size) }})</span>
        </li>
      </ul>
    </div>

    <div class="actions">
      <button @click="$emit('close')">Cancel</button>
      <button class="primary" @click="exportProject" :disabled="exporting">
        {{ exporting ? 'Exporting...' : 'Export' }}
      </button>
    </div>
  </div>
</template>
```

### Backend Export API

```typescript
// backend/src/routes/export.ts

router.post('/export/native', async (req, res) => {
  const { projectData, options } = req.body

  try {
    const transpiler = new NativeProjectTranspiler(projectData, options)
    const result = await transpiler.generate()

    if (options.format === 'zip') {
      // Create ZIP archive
      const zip = new JSZip()
      for (const file of result.files) {
        zip.file(file.path, file.content)
      }
      const buffer = await zip.generateAsync({ type: 'nodebuffer' })
      res.set('Content-Type', 'application/zip')
      res.set('Content-Disposition', `attachment; filename="${options.projectName}.zip"`)
      res.send(buffer)
    } else {
      // Return file list for preview/download
      res.json({
        files: result.files.map(f => ({
          path: f.path,
          size: f.content.length,
          type: getFileType(f.path)
        })),
        warnings: result.warnings
      })
    }
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/import/allolib-project', upload.single('project'), async (req, res) => {
  const projectZip = req.file

  try {
    // Extract and analyze the uploaded project
    const extractPath = await extractZip(projectZip.path)
    const result = await importAlloLibProject(extractPath)

    // Clean up temp files
    await cleanup(extractPath)

    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

### Implementation Phase

Add to **Phase 6: Integration & Polish**:

#### Native Export/Import (Week 2 of Phase 6)

- [ ] Create `services/transpiler/` directory structure
- [ ] Implement `objectCodeGen.ts` - Object → C++ class generation
- [ ] Implement `keyframeCodeGen.ts` - Keyframe → interpolation code
- [ ] Implement `eventCodeGen.ts` - Events → C++ event handlers
- [ ] Implement `mainCodeGen.ts` - Main app structure generation
- [ ] Implement `shaderTranspile.ts` - GLSL version conversion
- [ ] Implement `projectImport.ts` - AlloLib project import
- [ ] Create `ExportDialog.vue` UI component
- [ ] Create `ImportDialog.vue` UI component
- [ ] Backend: `/export/native` endpoint with ZIP generation
- [ ] Backend: `/import/allolib-project` endpoint
- [ ] Add CMakeLists.txt template generation
- [ ] Add README.md template for exported projects
- [ ] Test round-trip: create in web → export → build native → verify

### Files Created (✅ IMPLEMENTED)

```
allolib-wasm/include/
├── native_compat/               # ✅ Complete native compatibility layer
│   ├── al_StudioCompat.hpp      # Master include (aliases Web* to Native*)
│   ├── al_NativeHDR.hpp         # HDR loading with stb_image
│   ├── al_NativeOBJ.hpp         # OBJ mesh loading with file I/O
│   ├── al_NativeEnvironment.hpp # Skybox/reflections for desktop GL
│   ├── al_NativeLOD.hpp         # LOD system (pure C++)
│   └── al_NativeQuality.hpp     # Adaptive quality (no emscripten)
│
├── al_WebPBR.hpp                # ✅ PBR materials system
├── al_WebLOD.hpp                # ✅ LOD with mesh simplification
├── al_WebQuality.hpp            # ✅ Adaptive quality management
├── al_WebEnvironment.hpp        # ✅ Skybox and reflections
├── al_WebOBJ.hpp                # ✅ OBJ mesh loading
└── al_WebHDR.hpp                # ✅ HDR image loading
```

### Files To Create (Remaining)

```
frontend/src/
├── services/
│   └── transpiler/
│       ├── index.ts              # Main transpiler orchestration
│       ├── objectCodeGen.ts      # Object → C++ class
│       ├── keyframeCodeGen.ts    # Keyframes → interpolation
│       ├── eventCodeGen.ts       # Events → handlers
│       ├── mainCodeGen.ts        # Main app generation
│       ├── shaderTranspile.ts    # ✅ Implemented in transpiler.ts
│       ├── projectImport.ts      # Import AlloLib projects
│       └── templates/            # C++ code templates
│           ├── CMakeLists.txt.template
│           ├── main.cpp.template
│           └── README.md.template
└── components/
    ├── ExportDialog.vue
    └── ImportDialog.vue

backend/src/
├── routes/
│   └── export.ts                 # Export/import endpoints
└── services/
    └── transpilerService.ts      # Server-side transpilation
```
