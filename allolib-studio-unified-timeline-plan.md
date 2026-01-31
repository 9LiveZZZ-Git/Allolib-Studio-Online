# AlloLib Studio Online: Unified Timeline Implementation Plan

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

### 🔄 IN PROGRESS / PLANNED

| Feature | Status | Priority |
|---------|--------|----------|
| Asset Library System | 🔴 Not Started | **HIGH** |
| Unified Parameter Panel | 🔴 Not Started | **HIGH** |
| Object Tracks | 🔴 Not Started | Medium |
| Environment Track | 🔴 Not Started | Medium |
| Events Track | 🔴 Not Started | Medium |
| Keyframe Curve Editor | 🔴 Not Started | Medium |

---

## NEW: Part 0 - Asset Library System

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

## NEW: Part 0.5 - Unified Parameter Panel

### Overview

Extend the existing Parameter Panel (in AnalysisPanel) to show not just SynthVoice parameters but also:
- Object transform properties (position, rotation, scale)
- Object material uniforms
- Environment settings
- Camera properties
- Any keyframeable value

### Current State

The Parameter Panel currently:
- Connects to WASM module via `parameterSystem.ts`
- Shows parameters exposed by `createInternalTriggerParameter()` in C++
- Works only for active SynthVoice instances

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

## Part 4: Implementation Phases (UPDATED)

### Phase 0: Asset Library & Parameter Panel (2 weeks) - **NEW PRIORITY**

**Goal:** Create foundational asset management and unified parameter system.

#### Week 1: Asset Library
- [ ] Create `stores/assetLibrary.ts`
- [ ] Create `AssetLibrary.vue` component
- [ ] Implement built-in snippet loading
- [ ] Implement drag & drop to file explorer
- [ ] Add click-to-insert for code snippets
- [ ] Backend: Asset storage API endpoints
- [ ] Backend: Built-in asset directory structure

#### Week 2: Unified Parameter Panel
- [ ] Extend `parameter-system.ts` for multiple sources
- [ ] Update `ParameterPanel.vue` for grouped display
- [ ] Add source filtering (synth/object/env/camera)
- [ ] Add keyframe button to parameters
- [ ] Connect to object/environment stores (when created)
- [ ] Add vec3/vec4/color input components

### Phase 1: Object Track Foundation (2 weeks)

*(Unchanged from original plan)*

### Phase 2: Keyframe Animation (2 weeks)

*(Unchanged from original plan)*

### Phase 3: Environment Track (1 week)

*(Unchanged from original plan)*

### Phase 4: Events Track - Timed Events (2 weeks)

**Goal:** Camera and discrete events on timeline.

#### Week 1
- [ ] Extend `arrangement.json` schema for events
- [ ] Create `EventManager` runtime
- [ ] Camera state machine (transitions, follow, shake)
- [ ] Timed event execution
- [ ] Basic actions: camera, spawn, destroy, set, emit

#### Week 2
- [ ] Events track UI component (in existing sequencer panel)
- [ ] Event markers on timeline
- [ ] Camera event visualization
- [ ] Event property editor

### Phase 5: Events Track - Scripting (2 weeks)

*(Unchanged from original plan)*

### Phase 6: Integration & Polish (1 week)

*(Unchanged from original plan)*

---

## Summary of Changes from Original Plan

1. **Added Asset Library System (Part 0)** - Comprehensive asset management with categories, drag-drop, and backend storage

2. **Added Unified Parameter Panel (Part 0.5)** - Extends existing parameter panel to show object, environment, and camera properties alongside synth parameters

3. **Noted arrangement.json already exists** - Events track data will extend the existing arrangement.json rather than creating a separate events.json

4. **Updated implementation status** - Marked completed features including recording, popout visualizer, social media presets

5. **Reprioritized phases** - Asset Library and Parameter Panel are now Phase 0, as they're foundational for the object/environment/events work

6. **Added Advanced Graphics System (✅ COMPLETE)** - Full suite of web graphics features:
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

7. **Added Native Compatibility Layer (✅ COMPLETE)** - `native_compat/` headers provide identical APIs for native AlloLib:
   - `al_StudioCompat.hpp` - Master include with all aliases
   - Auto-conversion of `Web*` includes to `Native*` equivalents
   - Shader transpilation (WebGL2 ↔ Desktop GLSL)

8. **Added Graphics Settings UI (✅ COMPLETE)** - Quality preset controls in Toolbar.vue

**Estimated timeline:** 12-14 weeks for all phases (including new Phase 0)

**New files to create:**
- `stores/assetLibrary.ts`
- `components/AssetLibrary.vue`
- `backend/src/routes/assets.ts`
- `backend/src/services/assetService.ts`
- `backend/assets/built-in/` directory structure

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
