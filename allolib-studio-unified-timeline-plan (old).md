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

## Part 1: Current State Compatibility

### Existing Features (PRESERVE ALL)

```
frontend/src/
├── components/
│   └── sequencer/           # Sequencer UI (KEEP, EXTEND)
│       ├── SequencerPanel.vue
│       ├── Timeline.vue
│       ├── FrequencyRoll.vue
│       ├── ToneLattice.vue
│       └── ...
├── stores/
│   ├── project.ts           # Project state (EXTEND)
│   ├── sequencer.ts         # Sequencer state (KEEP, will reference)
│   ├── settings.ts          # User settings (KEEP)
│   └── terminal.ts          # Build output (KEEP)
├── services/
│   ├── compiler.ts          # C++ compilation (KEEP)
│   └── runtime.ts           # WASM runtime (EXTEND)
└── utils/
    ├── synthDetection.ts    # Detect SynthVoice classes (KEEP)
    └── synthSequence.ts     # Parse .synthSequence (KEEP)
```

### What Already Works

| Feature | Status | Location |
|---------|--------|----------|
| `.synthSequence` file format | ✅ Complete | `utils/synthSequence.ts` |
| Clip-based arrangement | ✅ Complete | `components/sequencer/` |
| Synth parameter automation | ✅ Complete | Sequencer stores |
| Piano roll (Frequency Roll) | ✅ Complete | `FrequencyRoll.vue` |
| Tone Lattice | ✅ Complete | `ToneLattice.vue` |
| Track mute/solo | ✅ Complete | Sequencer |
| Spectrum analyzer | ✅ Complete | Sequencer |
| Monaco code editor | ✅ Complete | Editor component |
| C++ compilation | ✅ Complete | `services/compiler.ts` |
| WASM runtime | ✅ Complete | `services/runtime.ts` |
| File management | ✅ Complete | Project store |
| Preset system | ✅ Complete | `.preset` files |

### Integration Strategy

The new track types will:
1. Live alongside the existing sequencer, not replace it
2. Share the same timeline/playhead
3. Use the same project store (extended)
4. Render in the same WebGL canvas
5. Share the same WASM runtime

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
│  │  │   Monaco    │  │  Timeline   │  │   Track     │  │   Property   │  │ │
│  │  │   Editor    │  │   Panel     │  │  Editors    │  │   Inspector  │  │ │
│  │  │  (C++ code) │  │  (unified)  │  │  (per type) │  │  (context)   │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘  │ │
│  │                                                                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │                         STORES (Pinia)                            │  │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │  │ │
│  │  │  │ project  │ │sequencer │ │ objects  │ │   env    │ │ events │ │  │ │
│  │  │  │ (extend) │ │ (exists) │ │  (new)   │ │  (new)   │ │ (new)  │ │  │ │
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
│  │           │               │               │                │           │ │
│  │  ┌────────┴───────────────┴───────────────┴────────────────┴────────┐ │ │
│  │  │                    Script Sandbox (JS)                            │ │ │
│  │  │         Executes event scripts with controlled context            │ │ │
│  │  └───────────────────────────────┬──────────────────────────────────┘ │ │
│  └──────────────────────────────────┼──────────────────────────────────────┘ │
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

### Runtime Loop

```typescript
// services/timelineRuntime.ts

class TimelineRuntime {
  private audioManager: AudioManager;      // Exists (SynthManager wrapper)
  private objectManager: ObjectManager;    // New
  private envManager: EnvironmentManager;  // New
  private eventManager: EventManager;      // New
  private scriptSandbox: ScriptSandbox;    // New
  
  private time: number = 0;
  private playing: boolean = false;
  
  update(dt: number) {
    if (!this.playing) return;
    
    this.time += dt;
    
    // 1. Events first (may trigger spawns, camera moves, scripts)
    this.eventManager.update(this.time, dt);
    
    // 2. Environment (global state - skybox, fog, lights)
    this.envManager.update(this.time);
    
    // 3. Objects (spawn/destroy lifecycle, keyframe interpolation)
    this.objectManager.update(this.time, dt);
    
    // 4. Audio (SynthVoice triggers - these render themselves)
    this.audioManager.update(this.time);
    
    // 5. Run continuous listeners (non-linear events)
    this.eventManager.runListeners(this.time, dt, this.getScriptContext());
    
    // Rendering happens automatically via AlloLib's onDraw
  }
  
  getScriptContext(): ScriptContext {
    return {
      time: this.time,
      dt: this.lastDt,
      objects: this.objectManager.getAPI(),
      audio: this.audioManager.getAPI(),
      env: this.envManager.getAPI(),
      camera: this.cameraAPI,
      input: this.inputManager.getState(),
      state: this.persistentState,
      emit: (name, data) => this.eventManager.emit(name, data),
    };
  }
}
```

---

## Part 3: Track Category Specifications

### ♫ AUDIO (Existing - No Changes)

**What it is:** SynthVoice instances triggered by `.synthSequence` files. Each voice has both `onProcess(AudioIOData&)` and `onProcess(Graphics&)` - audio and visual unified.

**Already implemented in:** `stores/sequencer.ts`, `components/sequencer/`

**File structure:**
```
audio/
├── FMSynth-data/
│   ├── intro.synthSequence
│   ├── verse.synthSequence
│   └── presets/
│       └── bright.preset
└── Pad-data/
    └── ambient.synthSequence
```

**Integration with new system:**
- Shares timeline/playhead with other track types
- Audio FFT data exposed to Events for audio-reactive scripts
- No changes to existing functionality

**Timeline representation:**
```
┌─ ♫ AUDIO ──────────────────────────────────────────────────────────────────┐
│                                                                             │
│  FMSynth    ┌─ intro.synthSequence ─┐    ┌─ verse.synthSequence ──────────┐│
│  [M][S]     │▓░▓░▓░░▓░▓░░▓░▓░▓░░▓░░│    │▓▓░▓░▓▓░░▓▓░▓░░▓▓░▓░▓▓░░▓▓░▓░░││
│             └───────────────────────┘    └─────────────────────────────────┘│
│                                                                             │
│  Pad        ┌─ ambient.synthSequence ─────────────────────────────────────┐│
│  [M][S]     │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓││
│             └─────────────────────────────────────────────────────────────┘│
│                                                                             │
│  [+ Add Audio Track]                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### ◈ OBJECTS (New)

**What it is:** Visual entities with mesh, material, and transform. Entities that exist in 3D space but aren't tied to audio note triggers.

**Store:** `stores/objects.ts` (new)

**File structure:**
```
objects/
├── definitions/                    # Reusable object templates
│   ├── crystal.object.json
│   ├── terrain.object.json
│   └── particle-emitter.object.json
└── instances are stored in project.allolib timeline data
```

#### Object Definition Schema

```typescript
// types/objects.ts

interface ObjectDefinition {
  id: string;
  name: string;
  
  components: {
    mesh?: MeshComponent;
    material?: MaterialComponent;
    transform?: TransformComponent;
    physics?: PhysicsComponent;       // Future
    particles?: ParticleComponent;    // Future
  };
}

interface MeshComponent {
  asset: string;                      // Path to .obj/.gltf
  castShadow?: boolean;
  receiveShadow?: boolean;
}

interface MaterialComponent {
  shader: string;                     // Path to .glsl or built-in name
  uniforms: Record<string, UniformDefinition>;
  textures?: Record<string, string>;  // Uniform name -> texture path
}

interface UniformDefinition {
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'mat4' | 'sampler2D';
  default: any;
  min?: number;                       // For UI slider
  max?: number;
  step?: number;
}

interface TransformComponent {
  position: [number, number, number];
  rotation: [number, number, number, number];  // Quaternion
  scale: [number, number, number];
}
```

**Example object definition:**
```json
// objects/definitions/crystal.object.json
{
  "id": "crystal",
  "name": "Crystal",
  "components": {
    "mesh": {
      "asset": "assets/meshes/crystal.obj",
      "castShadow": true
    },
    "material": {
      "shader": "assets/shaders/emissive.glsl",
      "uniforms": {
        "u_color": { "type": "vec3", "default": [1.0, 0.5, 0.8] },
        "u_glow": { "type": "float", "default": 1.0, "min": 0, "max": 5 },
        "u_time": { "type": "float", "default": 0 }
      },
      "textures": {
        "u_albedo": "assets/textures/crystal_albedo.png"
      }
    },
    "transform": {
      "position": [0, 0, 0],
      "rotation": [0, 0, 0, 1],
      "scale": [1, 1, 1]
    }
  }
}
```

#### Object Instance (Timeline Data)

```typescript
// In project timeline data
interface ObjectTrack {
  id: string;                         // Unique instance ID
  name: string;                       // Display name
  definition: string;                 // Path to .object.json
  
  // Lifecycle
  spawnTime: number;
  destroyTime?: number;               // undefined = exists until end
  
  // Overrides (keyframeable properties)
  overrides: {
    transform?: {
      position?: Keyframeable<[number, number, number]>;
      rotation?: Keyframeable<[number, number, number, number]>;
      scale?: Keyframeable<[number, number, number]>;
    };
    material?: {
      uniforms?: Record<string, Keyframeable<any>>;
    };
  };
  
  // Track state
  visible: boolean;
  locked: boolean;
  color?: string;                     // Track color in UI
}

// Keyframeable = static value OR keyframe curve
type Keyframeable<T> = T | KeyframeCurve<T>;

interface KeyframeCurve<T> {
  keyframes: Keyframe<T>[];
}

interface Keyframe<T> {
  time: number;                       // Relative to spawn time
  value: T;
  easing?: EasingType;
  tangentIn?: T;                      // For bezier curves
  tangentOut?: T;
}

type EasingType = 
  | 'linear' | 'step'
  | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'easeInElastic' | 'easeOutElastic' | 'easeInOutElastic'
  | 'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce'
  | 'bezier';
```

#### Object Manager Runtime

```typescript
// services/objectManager.ts

class ObjectManager {
  private instances: Map<string, ObjectInstance> = new Map();
  private definitions: Map<string, ObjectDefinition> = new Map();
  
  async loadDefinition(path: string): Promise<ObjectDefinition> {
    if (this.definitions.has(path)) return this.definitions.get(path)!;
    const def = await fetch(path).then(r => r.json());
    this.definitions.set(path, def);
    return def;
  }
  
  update(time: number, dt: number) {
    for (const track of this.tracks) {
      const localTime = time - track.spawnTime;
      
      // Spawn
      if (time >= track.spawnTime && !this.instances.has(track.id)) {
        this.spawn(track);
      }
      
      // Update (only if spawned and not destroyed)
      if (this.instances.has(track.id)) {
        if (track.destroyTime && time >= track.destroyTime) {
          this.destroy(track.id);
          continue;
        }
        
        this.updateInstance(track, localTime);
      }
    }
  }
  
  private spawn(track: ObjectTrack) {
    const def = this.definitions.get(track.definition)!;
    
    // Create mesh via AlloLib
    const meshId = allolib.createMesh(def.components.mesh!.asset);
    
    // Create shader/material
    const shaderId = allolib.createShader(def.components.material!.shader);
    
    // Set initial uniforms
    for (const [name, uniform] of Object.entries(def.components.material!.uniforms)) {
      allolib.setUniform(shaderId, name, uniform.default);
    }
    
    // Load textures
    for (const [name, path] of Object.entries(def.components.material!.textures || {})) {
      const texId = allolib.loadTexture(path);
      allolib.setUniform(shaderId, name, texId);
    }
    
    this.instances.set(track.id, { meshId, shaderId, track });
  }
  
  private updateInstance(track: ObjectTrack, localTime: number) {
    const instance = this.instances.get(track.id)!;
    const overrides = track.overrides;
    
    // Interpolate transform
    if (overrides.transform) {
      if (overrides.transform.position) {
        const pos = this.interpolate(overrides.transform.position, localTime);
        allolib.setPosition(instance.meshId, pos);
      }
      if (overrides.transform.rotation) {
        const rot = this.interpolate(overrides.transform.rotation, localTime);
        allolib.setRotation(instance.meshId, rot);
      }
      if (overrides.transform.scale) {
        const scale = this.interpolate(overrides.transform.scale, localTime);
        allolib.setScale(instance.meshId, scale);
      }
    }
    
    // Interpolate uniforms
    if (overrides.material?.uniforms) {
      for (const [name, value] of Object.entries(overrides.material.uniforms)) {
        const v = this.interpolate(value, localTime);
        allolib.setUniform(instance.shaderId, name, v);
      }
    }
    
    // Auto-update u_time if present
    allolib.setUniform(instance.shaderId, 'u_time', localTime);
  }
  
  private interpolate<T>(value: Keyframeable<T>, time: number): T {
    if (!('keyframes' in value)) return value as T;
    
    const curve = value as KeyframeCurve<T>;
    const keyframes = curve.keyframes;
    
    // Find surrounding keyframes
    let prev = keyframes[0];
    let next = keyframes[0];
    
    for (let i = 0; i < keyframes.length; i++) {
      if (keyframes[i].time <= time) prev = keyframes[i];
      if (keyframes[i].time >= time) { next = keyframes[i]; break; }
    }
    
    if (prev === next) return prev.value;
    
    const t = (time - prev.time) / (next.time - prev.time);
    const eased = this.applyEasing(t, next.easing || 'linear');
    
    return this.lerp(prev.value, next.value, eased);
  }
  
  // API for scripts
  getAPI(): ObjectsAPI {
    return {
      get: (id: string) => this.instances.get(id),
      spawn: (def: string, overrides?: any) => { /* ... */ },
      destroy: (id: string) => this.destroy(id),
      all: () => Array.from(this.instances.values()),
      setProperty: (id: string, path: string, value: any) => { /* ... */ },
    };
  }
}
```

#### Object Track UI

```
┌─ ◈ OBJECTS ────────────────────────────────────────────────────────────────┐
│                                                                             │
│ ▼ crystal_1     [spawn]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[destroy]           │
│   │             2.0s                                    38.0s               │
│   ├─ ◇ mesh     crystal.obj                                                │
│   ├─ ◆ material                                                            │
│   │   └─ u_glow ●━━━●━━━●━━━●━━━●━━━●  [Show Curve Editor]                │
│   └─ ⟳ transform                                                           │
│       ├─ pos.y  ●━━━━━━━●━━━━━━━●━━━●  [Show Curve Editor]                │
│       └─ rot.y  ●━━━━━━━━━━━━━━━━━━━●  (slow spin)                        │
│                                                                             │
│ ▶ crystal_2     [spawn]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│                 4.0s                                                        │
│                                                                             │
│ ▶ terrain       [spawn]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                 0.0s                                                        │
│                                                                             │
│ [+ Add Object]  [+ From Library]                                           │
└─────────────────────────────────────────────────────────────────────────────┘

Expanded curve editor (when "Show Curve Editor" clicked):

┌─ Curve: crystal_1 > material > u_glow ──────────────────────────────────────┐
│                                                                              │
│  5.0 ┤              ●                                                       │
│      │            ╱   ╲                                                     │
│  3.0 ┤          ╱       ╲           ●                                       │
│      │        ╱           ╲       ╱   ╲                                     │
│  1.0 ┼━━━━━━●               ●━━━●       ●━━━━━━━━━━━━━━━━━━━━               │
│      │                                                                       │
│      └──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼              │
│      0s     2s     4s     6s     8s    10s    12s    14s    16s             │
│                                                                              │
│  Keyframe: t=4.0s  value=5.0  easing=[easeInOut ▼]                          │
│  [+ Add Key]  [Delete]  [Flatten]  [Linear]  [Bezier]                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### ◐ ENVIRONMENT (New - Singleton)

**What it is:** Global scene settings. One per project - skybox, fog, ambient lighting, terrain, dynamic lights.

**Store:** `stores/environment.ts` (new)

**File:** `environment.json` (one per project)

#### Environment Schema

```typescript
// types/environment.ts

interface EnvironmentData {
  // Skybox
  skybox: {
    type: 'cubemap' | 'equirectangular' | 'procedural' | 'solid';
    asset?: string;                   // Path to .hdr/.png
    color?: [number, number, number]; // For solid color
    rotation?: Keyframeable<number>;  // Y-axis rotation
    transitions?: SkyboxTransition[];
  };
  
  // Fog
  fog: {
    enabled: boolean;
    type: 'linear' | 'exponential' | 'exponential2';
    color: Keyframeable<[number, number, number]>;
    density?: Keyframeable<number>;   // For exponential
    near?: Keyframeable<number>;      // For linear
    far?: Keyframeable<number>;       // For linear
  };
  
  // Ambient light
  ambient: {
    color: Keyframeable<[number, number, number]>;
    intensity: Keyframeable<number>;
  };
  
  // Dynamic lights
  lights: LightDefinition[];
  
  // Terrain (optional)
  terrain?: TerrainDefinition;
  
  // Post-processing (future)
  postProcessing?: PostProcessingDefinition;
}

interface SkyboxTransition {
  time: number;
  asset: string;
  duration: number;
  easing?: EasingType;
}

interface LightDefinition {
  id: string;
  name: string;
  type: 'directional' | 'point' | 'spot';
  color: Keyframeable<[number, number, number]>;
  intensity: Keyframeable<number>;
  
  // Directional light
  direction?: [number, number, number];
  
  // Point/Spot light
  position?: Keyframeable<[number, number, number]>;
  falloff?: number;
  
  // Spot light only
  angle?: number;
  penumbra?: number;
  target?: [number, number, number];
  
  // Shadows
  castShadow?: boolean;
  shadowMapSize?: number;
}

interface TerrainDefinition {
  heightmap: string;                  // Path to height texture
  size: [number, number];             // World units
  height: Keyframeable<number>;       // Max height
  layers: TerrainLayer[];
}

interface TerrainLayer {
  texture: string;
  normalMap?: string;
  tiling: number;
  heightRange?: [number, number];     // Auto-blend by height
  slopeRange?: [number, number];      // Auto-blend by slope
}
```

**Example environment file:**
```json
// environment.json
{
  "skybox": {
    "type": "cubemap",
    "asset": "assets/environments/dark_cave.hdr",
    "rotation": {
      "keyframes": [
        { "time": 0, "value": 0 },
        { "time": 60, "value": 360 }
      ]
    },
    "transitions": [
      {
        "time": 20.0,
        "asset": "assets/environments/crystal_glow.hdr",
        "duration": 3.0,
        "easing": "easeInOut"
      }
    ]
  },
  
  "fog": {
    "enabled": true,
    "type": "exponential",
    "color": [0.1, 0.1, 0.15],
    "density": {
      "keyframes": [
        { "time": 0, "value": 0 },
        { "time": 5, "value": 0.02 },
        { "time": 55, "value": 0.02 },
        { "time": 60, "value": 0 }
      ]
    }
  },
  
  "ambient": {
    "color": {
      "keyframes": [
        { "time": 0, "value": [0.1, 0.1, 0.2] },
        { "time": 20, "value": [0.3, 0.2, 0.4] },
        { "time": 60, "value": [0.1, 0.1, 0.2] }
      ]
    },
    "intensity": 0.5
  },
  
  "lights": [
    {
      "id": "sun",
      "name": "Sun",
      "type": "directional",
      "direction": [-0.5, -1.0, -0.3],
      "color": [1.0, 0.95, 0.9],
      "intensity": {
        "keyframes": [
          { "time": 0, "value": 0 },
          { "time": 10, "value": 1.0 },
          { "time": 50, "value": 1.0 },
          { "time": 60, "value": 0 }
        ]
      },
      "castShadow": true
    },
    {
      "id": "crystal_glow",
      "name": "Crystal Glow",
      "type": "point",
      "position": [0, 2, 0],
      "color": [0.8, 0.5, 1.0],
      "intensity": 2.0,
      "falloff": 10
    }
  ],
  
  "terrain": {
    "heightmap": "assets/terrain/cave_height.png",
    "size": [100, 100],
    "height": 10,
    "layers": [
      {
        "texture": "assets/terrain/rock.png",
        "normalMap": "assets/terrain/rock_normal.png",
        "tiling": 20
      }
    ]
  }
}
```

#### Environment Track UI

```
┌─ ◐ ENVIRONMENT ────────────────────────────────────────────────────────────┐
│                                                                             │
│  Skybox      │[dark_cave.hdr]━━━━━━━━━━━━━━━━[→]━━━[crystal_glow.hdr]━━━━━│
│  rotation    │●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●│
│              │0°                                                        360°│
│                                                                             │
│  Fog         │                                                             │
│  density     │░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░│
│              │0    ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●        0│
│                                                                             │
│  Ambient     │                                                             │
│  color       │●━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●        │
│              │[dark blue]          [purple]                   [dark blue]  │
│                                                                             │
│ ▼ Lights                                                                   │
│   sun        │intensity: ●━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━●━━━━━━━━●      │
│              │           0           1.0                 1.0          0    │
│   crystal    │[constant]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                             │
│ ▶ Terrain                                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### ⚡ EVENTS (New - The Escape Hatch)

**What it is:** Discrete triggers and continuous listeners. Handles camera, markers, callbacks, and full JavaScript scripting for non-linear behavior.

**Store:** `stores/events.ts` (new)

**File:** `events.json` (one per project)

#### Event System Schema

```typescript
// types/events.ts

interface EventsData {
  timedEvents: TimedEvent[];          // Linear: fire at specific time
  listeners: ListenerEvent[];         // Non-linear: fire when condition met
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMED EVENTS (Linear)
// ═══════════════════════════════════════════════════════════════════════════

interface TimedEvent {
  id: string;
  time: number;                       // When to fire
  action: EventAction;
}

type EventAction =
  // Camera actions
  | CameraAction
  | CameraFollowAction
  | CameraShakeAction
  
  // Object actions
  | SpawnAction
  | DestroyAction
  | SetPropertyAction
  
  // Audio actions
  | TriggerVoiceAction
  
  // Control flow
  | EmitAction
  | EnableListenerAction
  | DisableListenerAction
  
  // Visual
  | MarkerAction
  | TransitionAction
  
  // Scripting
  | ScriptAction;

interface CameraAction {
  type: 'camera';
  pose: {
    position: [number, number, number];
    target?: [number, number, number];      // Look-at point
    rotation?: [number, number, number, number];  // Or quaternion
  };
  fov?: number;
  duration?: number;                  // 0 = instant cut
  easing?: EasingType;
}

interface CameraFollowAction {
  type: 'camera-follow';
  target: string;                     // Object ID to follow
  offset?: [number, number, number];
  lookAt?: boolean;                   // Face the target?
  duration?: number;                  // How long to follow (undefined = until next camera event)
  smoothing?: number;                 // 0-1, how smoothly to follow
}

interface CameraShakeAction {
  type: 'camera-shake';
  intensity: number;
  duration: number;
  decay?: boolean;
}

interface SpawnAction {
  type: 'spawn';
  object: string;                     // Object definition path
  instanceId: string;                 // Unique ID for this instance
  overrides?: any;                    // Initial property overrides
}

interface DestroyAction {
  type: 'destroy';
  target: string;                     // Object instance ID
  effect?: 'instant' | 'fade' | 'explode';
  duration?: number;
}

interface SetPropertyAction {
  type: 'set';
  target: string;                     // Object ID
  property: string;                   // Dot-notation path: "material.uniforms.u_glow"
  value: any;
  duration?: number;                  // Animate to value
  easing?: EasingType;
}

interface TriggerVoiceAction {
  type: 'trigger-voice';
  synth: string;                      // Synth type name
  params?: Record<string, any>;       // freq, amp, etc.
  duration?: number;
}

interface EmitAction {
  type: 'emit';
  event: string;                      // Custom event name
  data?: any;
}

interface EnableListenerAction {
  type: 'enable-listener';
  listener: string;                   // Listener ID
}

interface DisableListenerAction {
  type: 'disable-listener';
  listener: string;
}

interface MarkerAction {
  type: 'marker';
  label: string;                      // Just for UI reference, no runtime effect
  color?: string;
}

interface TransitionAction {
  type: 'transition';
  effect: 'fade' | 'wipe' | 'dissolve';
  color?: [number, number, number];
  duration: number;
  direction?: 'in' | 'out';
}

interface ScriptAction {
  type: 'script';
  code: string;                       // JavaScript code
}

// ═══════════════════════════════════════════════════════════════════════════
// LISTENER EVENTS (Non-linear)
// ═══════════════════════════════════════════════════════════════════════════

interface ListenerEvent {
  id: string;
  name: string;                       // Display name
  enabled: boolean;                   // Can be toggled
  
  // When to check
  trigger: ListenerTrigger;
  
  // What to do
  action: EventAction;
  
  // Constraints
  once?: boolean;                     // Fire once then disable
  cooldown?: number;                  // Minimum seconds between fires
  activeTimeRange?: [number, number]; // Only active during this timeline range
}

type ListenerTrigger =
  | ConditionTrigger
  | InputTrigger
  | CollisionTrigger
  | AudioTrigger
  | CustomEventTrigger;

interface ConditionTrigger {
  type: 'condition';
  expression: string;                 // JS expression: "objects.get('player').position.y < 0"
}

interface InputTrigger {
  type: 'input';
  input: 
    | { key: string; state: 'down' | 'up' | 'held' }
    | { mouse: 'click' | 'move' | 'wheel' }
    | { gamepad: string };
}

interface CollisionTrigger {
  type: 'collision';
  a: string;                          // Object ID or tag
  b: string;                          // Object ID or tag
  event: 'enter' | 'exit' | 'stay';
}

interface AudioTrigger {
  type: 'audio';
  source: 'master' | string;          // Track ID
  band: 'bass' | 'mid' | 'high' | 'full';
  threshold: number;                  // 0-1
  edge: 'rising' | 'falling' | 'both';
}

interface CustomEventTrigger {
  type: 'custom';
  event: string;                      // Event name to listen for
}
```

**Example events file:**
```json
// events.json
{
  "timedEvents": [
    // Opening shot
    {
      "id": "cam-opening",
      "time": 0,
      "action": {
        "type": "camera",
        "pose": { "position": [0, 10, 30], "target": [0, 0, 0] },
        "fov": 60
      }
    },
    
    // Push in
    {
      "id": "cam-push",
      "time": 5.0,
      "action": {
        "type": "camera",
        "pose": { "position": [5, 3, 10], "target": [0, 2, 0] },
        "duration": 3.0,
        "easing": "easeInOut"
      }
    },
    
    // Marker (visual only)
    {
      "id": "marker-climax",
      "time": 15.0,
      "action": {
        "type": "marker",
        "label": "Climax",
        "color": "#ff0000"
      }
    },
    
    // Script at specific time
    {
      "id": "climax-script",
      "time": 15.0,
      "action": {
        "type": "script",
        "code": "env.setFogDensity(0.05); camera.shake(0.5, 2.0);"
      }
    },
    
    // Follow crystal
    {
      "id": "cam-follow",
      "time": 18.0,
      "action": {
        "type": "camera-follow",
        "target": "crystal_1",
        "offset": [0, 2, 5],
        "smoothing": 0.8
      }
    },
    
    // End with fade
    {
      "id": "fade-out",
      "time": 58.0,
      "action": {
        "type": "transition",
        "effect": "fade",
        "color": [0, 0, 0],
        "duration": 2.0,
        "direction": "out"
      }
    }
  ],
  
  "listeners": [
    // Audio-reactive: bass hits flash the crystals
    {
      "id": "bass-flash",
      "name": "Bass Flash",
      "enabled": true,
      "trigger": {
        "type": "audio",
        "source": "master",
        "band": "bass",
        "threshold": 0.7,
        "edge": "rising"
      },
      "action": {
        "type": "script",
        "code": "for (const obj of objects.all()) { if (obj.name.includes('crystal')) { obj.setUniform('u_glow', 3.0); } }"
      },
      "cooldown": 0.1
    },
    
    // Keyboard: space toggles something (for interactive mode)
    {
      "id": "space-toggle",
      "name": "Space Toggle",
      "enabled": false,
      "trigger": {
        "type": "input",
        "input": { "key": "Space", "state": "down" }
      },
      "action": {
        "type": "emit",
        "event": "player-jump"
      }
    },
    
    // Listen for custom event
    {
      "id": "on-jump",
      "name": "Jump Handler",
      "enabled": false,
      "trigger": {
        "type": "custom",
        "event": "player-jump"
      },
      "action": {
        "type": "script",
        "code": "const player = objects.get('player'); player.velocity.y = 10; audio.trigger('jump');"
      }
    },
    
    // Condition: respawn if fallen
    {
      "id": "respawn",
      "name": "Respawn on Fall",
      "enabled": false,
      "trigger": {
        "type": "condition",
        "expression": "objects.get('player')?.position[1] < -10"
      },
      "action": {
        "type": "script",
        "code": "objects.get('player').position = [0, 5, 0]; state.deaths++;"
      }
    }
  ]
}
```

#### Script Sandbox & Context

```typescript
// services/scriptSandbox.ts

interface ScriptContext {
  // Time
  time: number;
  dt: number;
  
  // Objects
  objects: {
    get(id: string): ObjectHandle | null;
    spawn(definition: string, id: string, overrides?: any): ObjectHandle;
    destroy(id: string): void;
    all(): ObjectHandle[];
  };
  
  // Object handle for working with instances
  // ObjectHandle: {
  //   id: string;
  //   name: string;
  //   position: [number, number, number];  // getter/setter
  //   rotation: [number, number, number, number];
  //   scale: [number, number, number];
  //   setUniform(name: string, value: any): void;
  //   getUniform(name: string): any;
  //   velocity?: [number, number, number];  // If physics enabled
  // }
  
  // Audio
  audio: {
    trigger(synth: string, params?: Record<string, any>): void;
    fft: {
      bass: number;       // 0-1
      mid: number;
      high: number;
      bins: Float32Array;
    };
    amplitude: number;    // 0-1
    bpm: number;
    beat: number;         // Current beat number
    measure: number;      // Current measure
  };
  
  // Environment
  env: {
    skybox: string;
    setSkybox(asset: string, transitionDuration?: number): void;
    fog: { color: [number, number, number]; density: number };
    setFogDensity(density: number): void;
    setFogColor(color: [number, number, number]): void;
    ambient: { color: [number, number, number]; intensity: number };
    setAmbient(color: [number, number, number], intensity: number): void;
    getLight(id: string): LightHandle;
  };
  
  // Camera
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    moveTo(pose: { position: number[]; target?: number[] }, duration?: number, easing?: string): void;
    follow(targetId: string, offset?: number[], smoothing?: number): void;
    stopFollow(): void;
    shake(intensity: number, duration: number): void;
  };
  
  // Input (for interactive/game mode)
  input: {
    key(code: string): boolean;       // Is key currently held?
    keyDown(code: string): boolean;   // Was key just pressed this frame?
    keyUp(code: string): boolean;     // Was key just released?
    mouse: {
      x: number; y: number;           // Position
      dx: number; dy: number;         // Delta since last frame
      buttons: number;                // Bitmask
    };
    click: boolean;
  };
  
  // Persistent state (survives across frames)
  state: Record<string, any>;
  
  // Event system
  emit(name: string, data?: any): void;
  
  // Math utilities
  lerp(a: number, b: number, t: number): number;
  clamp(v: number, min: number, max: number): number;
  random(min?: number, max?: number): number;
  randomInt(min: number, max: number): number;
  Vec3: {
    add(a: number[], b: number[]): number[];
    sub(a: number[], b: number[]): number[];
    mul(a: number[], s: number): number[];
    dot(a: number[], b: number[]): number;
    cross(a: number[], b: number[]): number[];
    normalize(a: number[]): number[];
    length(a: number[]): number;
    distance(a: number[], b: number[]): number;
    lerp(a: number[], b: number[], t: number): number[];
  };
  
  // Console (outputs to terminal panel)
  console: {
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
  };
}

class ScriptSandbox {
  private context: ScriptContext;
  private compiledScripts: Map<string, Function> = new Map();
  
  execute(code: string, additionalContext?: Record<string, any>) {
    // Cache compiled functions
    if (!this.compiledScripts.has(code)) {
      // Create function with context as parameters
      const fn = new Function(
        ...Object.keys(this.context),
        code
      );
      this.compiledScripts.set(code, fn);
    }
    
    const fn = this.compiledScripts.get(code)!;
    const ctx = { ...this.context, ...additionalContext };
    
    try {
      return fn(...Object.values(ctx));
    } catch (e) {
      console.error('Script error:', e);
      this.context.console.error(`Script error: ${e}`);
    }
  }
  
  evaluateCondition(expression: string): boolean {
    try {
      const fn = new Function(
        ...Object.keys(this.context),
        `return Boolean(${expression})`
      );
      return fn(...Object.values(this.context));
    } catch (e) {
      console.error('Condition error:', e);
      return false;
    }
  }
}
```

#### Event Manager Runtime

```typescript
// services/eventManager.ts

class EventManager {
  private timedEvents: TimedEvent[];
  private listeners: ListenerEvent[];
  private sandbox: ScriptSandbox;
  
  private lastTime: number = 0;
  private cooldowns: Map<string, number> = new Map();
  private customEventQueue: { name: string; data: any }[] = [];
  
  // Camera state
  private cameraTransition: CameraTransition | null = null;
  private cameraFollow: CameraFollow | null = null;
  private cameraShake: CameraShake | null = null;
  
  update(time: number, dt: number, context: ScriptContext) {
    // Fire timed events that fall between lastTime and time
    for (const event of this.timedEvents) {
      if (event.time > this.lastTime && event.time <= time) {
        this.executeAction(event.action, context);
      }
    }
    
    // Update camera transitions
    this.updateCamera(time, dt, context);
    
    // Process custom event queue
    const eventsToProcess = [...this.customEventQueue];
    this.customEventQueue = [];
    
    for (const { name, data } of eventsToProcess) {
      // Find listeners for this custom event
      for (const listener of this.listeners) {
        if (!listener.enabled) continue;
        if (listener.trigger.type !== 'custom') continue;
        if (listener.trigger.event !== name) continue;
        
        this.executeAction(listener.action, { ...context, eventData: data });
        if (listener.once) listener.enabled = false;
      }
    }
    
    // Run continuous listeners
    for (const listener of this.listeners) {
      if (!listener.enabled) continue;
      
      // Check time range
      if (listener.activeTimeRange) {
        const [start, end] = listener.activeTimeRange;
        if (time < start || time > end) continue;
      }
      
      // Check cooldown
      const lastFired = this.cooldowns.get(listener.id) || 0;
      if (listener.cooldown && time - lastFired < listener.cooldown) continue;
      
      // Check trigger condition
      if (this.checkTrigger(listener.trigger, context)) {
        this.executeAction(listener.action, context);
        this.cooldowns.set(listener.id, time);
        if (listener.once) listener.enabled = false;
      }
    }
    
    this.lastTime = time;
  }
  
  private checkTrigger(trigger: ListenerTrigger, context: ScriptContext): boolean {
    switch (trigger.type) {
      case 'condition':
        return this.sandbox.evaluateCondition(trigger.expression);
        
      case 'input':
        if ('key' in trigger.input) {
          const { key, state } = trigger.input;
          switch (state) {
            case 'down': return context.input.keyDown(key);
            case 'up': return context.input.keyUp(key);
            case 'held': return context.input.key(key);
          }
        }
        if ('mouse' in trigger.input) {
          switch (trigger.input.mouse) {
            case 'click': return context.input.click;
            // ... etc
          }
        }
        return false;
        
      case 'audio':
        const value = trigger.band === 'full' 
          ? context.audio.amplitude
          : context.audio.fft[trigger.band];
        
        // Edge detection
        const prev = this.lastAudioValues.get(trigger.source + trigger.band) || 0;
        this.lastAudioValues.set(trigger.source + trigger.band, value);
        
        if (trigger.edge === 'rising') {
          return prev < trigger.threshold && value >= trigger.threshold;
        } else if (trigger.edge === 'falling') {
          return prev >= trigger.threshold && value < trigger.threshold;
        } else {
          return (prev < trigger.threshold && value >= trigger.threshold) ||
                 (prev >= trigger.threshold && value < trigger.threshold);
        }
        
      case 'collision':
        // Would need physics system
        return false;
        
      case 'custom':
        // Handled separately via event queue
        return false;
        
      default:
        return false;
    }
  }
  
  private executeAction(action: EventAction, context: ScriptContext) {
    switch (action.type) {
      case 'camera':
        this.startCameraTransition(action, context);
        break;
        
      case 'camera-follow':
        this.cameraFollow = {
          target: action.target,
          offset: action.offset || [0, 0, 5],
          smoothing: action.smoothing || 0.1,
          endTime: action.duration ? context.time + action.duration : Infinity,
        };
        break;
        
      case 'camera-shake':
        this.cameraShake = {
          intensity: action.intensity,
          duration: action.duration,
          startTime: context.time,
          decay: action.decay ?? true,
        };
        break;
        
      case 'spawn':
        context.objects.spawn(action.object, action.instanceId, action.overrides);
        break;
        
      case 'destroy':
        context.objects.destroy(action.target);
        break;
        
      case 'set':
        const obj = context.objects.get(action.target);
        if (obj) {
          // Parse property path and set
          this.setNestedProperty(obj, action.property, action.value);
        }
        break;
        
      case 'trigger-voice':
        context.audio.trigger(action.synth, action.params);
        break;
        
      case 'emit':
        this.customEventQueue.push({ name: action.event, data: action.data });
        break;
        
      case 'enable-listener':
        const enableTarget = this.listeners.find(l => l.id === action.listener);
        if (enableTarget) enableTarget.enabled = true;
        break;
        
      case 'disable-listener':
        const disableTarget = this.listeners.find(l => l.id === action.listener);
        if (disableTarget) disableTarget.enabled = false;
        break;
        
      case 'script':
        this.sandbox.execute(action.code, context);
        break;
        
      case 'marker':
        // No runtime effect, just for UI
        break;
        
      case 'transition':
        // Trigger visual transition (fade/wipe/etc)
        this.startTransition(action);
        break;
    }
  }
  
  // Public API for scripts
  emit(name: string, data?: any) {
    this.customEventQueue.push({ name, data });
  }
}
```

#### Events Track UI

```
┌─ ⚡ EVENTS ─────────────────────────────────────────────────────────────────┐
│                                                                             │
│  TIMELINE EVENTS                                                            │
│  ────────────────────────────────────────────────────────────────────────  │
│  ↓[📷 wide]    ↓[📷 push in]     ↓[📷 follow crystal]    ↓[📷 wide]      │
│  │  instant    │  3s ease        │  hold                 │  2s ease       │
│  │             │                 │                       │                 │
│  │             ↓[marker: Climax] │                       ↓[fade out 2s]   │
│  │             ↓[script: ...]    │                       │                 │
│  0s            5s               15s                     55s              60s│
│                                                                             │
│  LISTENERS                                                         [Mode ▼]│
│  ────────────────────────────────────────────────────────────────────────  │
│  [●] bass-flash       audio.bass > 0.7      → flash crystals    [Edit][⋮] │
│  [○] space-toggle     input.Space.down      → emit:player-jump  [Edit][⋮] │
│  [○] on-jump          event:player-jump     → script: ...       [Edit][⋮] │
│  [○] respawn          player.y < -10        → script: ...       [Edit][⋮] │
│                                                                             │
│  [●] = enabled, [○] = disabled                                             │
│                                                                             │
│  [+ Add Timed Event]  [+ Add Listener]                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Mode dropdown: [Animation] / [Interactive] / [Game]
- Animation: All listeners disabled by default
- Interactive: Some listeners enabled
- Game: All listeners enabled, timeline may loop or wait for events
```

#### Script Editor Panel

```
┌─ Script Editor: climax-script ──────────────────────────────────────────────┐
│                                                                              │
│  // Monaco editor with JS syntax highlighting + autocomplete                │
│  // Context object properties available via autocomplete                     │
│                                                                              │
│  1│ // Climax script - runs at t=15s                                        │
│  2│ env.setFogDensity(0.05);                                                │
│  3│ camera.shake(0.5, 2.0);                                                 │
│  4│                                                                          │
│  5│ // Flash all crystals                                                   │
│  6│ for (const obj of objects.all()) {                                      │
│  7│   if (obj.name.includes('crystal')) {                                   │
│  8│     obj.setUniform('u_glow', 5.0);                                      │
│  9│   }                                                                      │
│ 10│ }                                                                        │
│ 11│                                                                          │
│ 12│ // Trigger a voice                                                       │
│ 13│ audio.trigger('Impact', { freq: 80, amp: 1.0 });                        │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  Available: time, dt, objects, audio, env, camera, input, state, emit, ...  │
│                                                              [Test] [Save]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: File System Structure

```
project/
├── project.allolib                   # Master project file
│
├── src/                              # C++ source code (existing)
│   ├── main.cpp
│   └── synths/
│       ├── FMSynth.hpp
│       └── Pad.hpp
│
├── audio/                            # AUDIO track data (existing structure)
│   ├── FMSynth-data/
│   │   ├── intro.synthSequence
│   │   ├── verse.synthSequence
│   │   └── presets/
│   │       ├── bright.preset
│   │       └── dark.preset
│   └── Pad-data/
│       └── ambient.synthSequence
│
├── objects/                          # OBJECTS definitions (new)
│   ├── crystal.object.json
│   ├── terrain.object.json
│   └── player.object.json            # For interactive mode
│
├── assets/                           # Shared assets
│   ├── meshes/
│   │   ├── crystal.obj
│   │   ├── terrain.obj
│   │   └── player.obj
│   ├── shaders/
│   │   ├── emissive.glsl
│   │   ├── terrain.glsl
│   │   └── standard.glsl
│   ├── textures/
│   │   ├── crystal_albedo.png
│   │   ├── terrain_rock.png
│   │   └── terrain_height.png
│   └── environments/
│       ├── dark_cave.hdr
│       └── crystal_glow.hdr
│
├── environment.json                  # ENVIRONMENT data (new)
│
├── events.json                       # EVENTS data (new)
│
└── timeline.json                     # Timeline state (new)
                                      # - Audio clip placements (references sequencer)
                                      # - Object track instances + keyframe overrides
                                      # - References to environment.json and events.json
```

### Master Project File

```json
// project.allolib
{
  "name": "Crystal Cave",
  "version": "1.0.0",
  "duration": 60.0,
  "bpm": 120,
  "timeSignature": [4, 4],
  
  // Playback mode
  "mode": "animation",  // "animation" | "interactive" | "game"
  
  // References to track data files
  "environment": "environment.json",
  "events": "events.json",
  
  // Audio tracks (existing sequencer data)
  "audioTracks": [
    {
      "id": "fm-synth",
      "name": "FM Synth",
      "synthType": "FMSynth",
      "muted": false,
      "solo": false,
      "clips": [
        {
          "id": "clip-1",
          "sequence": "audio/FMSynth-data/intro.synthSequence",
          "startTime": 0,
          "duration": 10.0
        },
        {
          "id": "clip-2",
          "sequence": "audio/FMSynth-data/verse.synthSequence",
          "startTime": 12.0,
          "duration": 30.0
        }
      ]
    },
    {
      "id": "pad",
      "name": "Pad",
      "synthType": "Pad",
      "muted": false,
      "solo": false,
      "clips": [
        {
          "id": "clip-3",
          "sequence": "audio/Pad-data/ambient.synthSequence",
          "startTime": 0,
          "duration": 60.0
        }
      ]
    }
  ],
  
  // Object track instances
  "objectTracks": [
    {
      "id": "crystal_1",
      "name": "Crystal 1",
      "definition": "objects/crystal.object.json",
      "spawnTime": 2.0,
      "destroyTime": 55.0,
      "visible": true,
      "locked": false,
      "color": "#9b59b6",
      "overrides": {
        "transform": {
          "position": {
            "keyframes": [
              { "time": 0, "value": [0, 0, 0] },
              { "time": 5, "value": [0, 2, 0], "easing": "easeInOut" },
              { "time": 10, "value": [0, 0, 0], "easing": "easeInOut" }
            ]
          },
          "rotation": {
            "keyframes": [
              { "time": 0, "value": [0, 0, 0, 1] },
              { "time": 60, "value": [0, 1, 0, 0] }
            ]
          }
        },
        "material": {
          "uniforms": {
            "u_glow": {
              "keyframes": [
                { "time": 0, "value": 1.0 },
                { "time": 15, "value": 5.0, "easing": "easeIn" },
                { "time": 20, "value": 1.0, "easing": "easeOut" }
              ]
            }
          }
        }
      }
    },
    {
      "id": "crystal_2",
      "name": "Crystal 2",
      "definition": "objects/crystal.object.json",
      "spawnTime": 4.0,
      "visible": true,
      "locked": false,
      "color": "#9b59b6",
      "overrides": {
        "transform": {
          "position": [3, 0, -2]
        }
      }
    },
    {
      "id": "terrain",
      "name": "Terrain",
      "definition": "objects/terrain.object.json",
      "spawnTime": 0,
      "visible": true,
      "locked": true,
      "overrides": {}
    }
  ]
}
```

---

## Part 5: Implementation Phases

### Phase 0: Preparation (1 week)

**Goal:** Prepare codebase for extension without breaking existing functionality.

- [ ] Audit existing sequencer code for reusable patterns
- [ ] Create shared timeline types (`types/timeline.ts`)
- [ ] Create shared interpolation utilities (`utils/interpolation.ts`)
- [ ] Add keyframe curve types and easing functions
- [ ] Create base track interface
- [ ] Document all existing store shapes
- [ ] Set up feature flags for new functionality

### Phase 1: Object Track Foundation (2 weeks)

**Goal:** Basic object spawning and static placement.

#### Week 1
- [ ] Create `stores/objects.ts` with object track state
- [ ] Create `ObjectDefinition` and `ObjectTrack` types
- [ ] Implement `ObjectManager` runtime class
- [ ] Add object loading via AlloLib WASM bridge
  - [ ] `allolib.createMesh(path)`
  - [ ] `allolib.createShader(path)`
  - [ ] `allolib.setUniform(shader, name, value)`
  - [ ] `allolib.setPosition/Rotation/Scale(mesh, value)`
- [ ] Basic object spawn/destroy based on timeline position

#### Week 2
- [ ] Object track UI component (`ObjectTrackLane.vue`)
- [ ] Object lifecycle bar (spawn → destroy visualization)
- [ ] Object definition editor/browser
- [ ] Drag to adjust spawn/destroy times
- [ ] Object property inspector panel

### Phase 2: Keyframe Animation (2 weeks)

**Goal:** Animate any object property with keyframes.

#### Week 1
- [ ] Keyframe curve data structure
- [ ] Interpolation engine with all easing types
- [ ] Bezier curve support for smooth interpolation
- [ ] Apply keyframes in `ObjectManager.update()`

#### Week 2
- [ ] Keyframe curve editor UI component
- [ ] Add/remove/move keyframes
- [ ] Easing type selector
- [ ] Tangent handles for bezier curves
- [ ] Mini-curve preview in track lane
- [ ] Expand/collapse track to show curves

### Phase 3: Environment Track (1 week)

**Goal:** Global scene settings with animation.

- [ ] Create `stores/environment.ts`
- [ ] Create `EnvironmentManager` runtime
- [ ] Implement via AlloLib WASM bridge:
  - [ ] Skybox loading and transitions
  - [ ] Fog settings
  - [ ] Ambient light
  - [ ] Dynamic lights (point, directional, spot)
- [ ] Environment track UI (single collapsible section)
- [ ] Skybox timeline with crossfade visualization
- [ ] Light property animation

### Phase 4: Events Track - Timed Events (2 weeks)

**Goal:** Camera and discrete events on timeline.

#### Week 1
- [ ] Create `stores/events.ts`
- [ ] Create `EventManager` runtime
- [ ] Camera state machine (transitions, follow, shake)
- [ ] Timed event execution
- [ ] Basic actions: camera, spawn, destroy, set, emit

#### Week 2
- [ ] Events track UI component
- [ ] Event markers on timeline
- [ ] Camera event visualization (show path/targets)
- [ ] Event property editor
- [ ] Marker labels

### Phase 5: Events Track - Scripting (2 weeks)

**Goal:** JavaScript scripting and listeners.

#### Week 1
- [ ] Script sandbox implementation
- [ ] Script context object with all APIs
- [ ] Monaco editor integration for scripts
  - [ ] JS syntax highlighting
  - [ ] Autocomplete for context object
  - [ ] Error highlighting
- [ ] Script action type

#### Week 2
- [ ] Listener system implementation
- [ ] Trigger types (condition, input, audio, custom)
- [ ] Cooldown management
- [ ] Enable/disable listeners
- [ ] Listener UI panel
- [ ] Audio FFT data exposure to scripts

### Phase 6: Integration & Polish (1 week)

**Goal:** Unified timeline experience.

- [ ] Unified timeline view with all 4 track types
- [ ] Track groups (collapsible sections per type)
- [ ] Global transport controls
- [ ] Snap to grid / snap to beat
- [ ] Copy/paste tracks and events
- [ ] Undo/redo integration
- [ ] Project save/load with all new data
- [ ] Export functionality

### Phase 7: Future Enhancements

**Not in initial scope, but designed for:**

- [ ] Physics component (particles, forces, collisions)
- [ ] Post-processing track (bloom, color grading)
- [ ] Video texture support
- [ ] Skeletal animation
- [ ] Networked collaboration
- [ ] Version control integration

---

## Part 6: UI Component Hierarchy

```
App.vue
├── TopBar.vue (existing - project name, save, export)
├── MainLayout.vue
│   ├── LeftPanel.vue
│   │   ├── CodeEditor.vue (existing - Monaco, C++)
│   │   └── AssetBrowser.vue (new)
│   │       ├── MeshBrowser.vue
│   │       ├── ShaderBrowser.vue
│   │       └── EnvironmentBrowser.vue
│   │
│   ├── CenterPanel.vue
│   │   ├── Viewer3D.vue (existing - WebGL canvas)
│   │   └── ViewerControls.vue (camera mode, gizmos)
│   │
│   ├── RightPanel.vue
│   │   ├── PropertyInspector.vue (new)
│   │   │   ├── ObjectInspector.vue
│   │   │   ├── EnvironmentInspector.vue
│   │   │   └── EventInspector.vue
│   │   └── ParameterPanel.vue (existing - synth params)
│   │
│   └── BottomPanel.vue
│       ├── TimelinePanel.vue (new - unified)
│       │   ├── TimelineHeader.vue (time ruler, transport)
│       │   ├── TrackGroups.vue
│       │   │   ├── AudioTrackGroup.vue
│       │   │   │   └── AudioTrackLane.vue (existing, adapted)
│       │   │   ├── ObjectTrackGroup.vue (new)
│       │   │   │   └── ObjectTrackLane.vue
│       │   │   ├── EnvironmentTrackGroup.vue (new)
│       │   │   │   └── EnvironmentTrackLane.vue
│       │   │   └── EventTrackGroup.vue (new)
│       │   │       └── EventTrackLane.vue
│       │   └── Playhead.vue
│       │
│       ├── CurveEditor.vue (new - keyframe editor)
│       ├── ScriptEditor.vue (new - Monaco JS)
│       └── Terminal.vue (existing)
│
└── Modals/
    ├── ObjectDefinitionEditor.vue (new)
    ├── EventEditor.vue (new)
    ├── ListenerEditor.vue (new)
    └── ... (existing modals)
```

---

## Part 7: Store Structure

```typescript
// stores/index.ts - All stores

// Existing (preserve)
import { useProjectStore } from './project';     // Extend
import { useSequencerStore } from './sequencer'; // Keep as-is
import { useSettingsStore } from './settings';   // Keep as-is
import { useTerminalStore } from './terminal';   // Keep as-is

// New
import { useObjectsStore } from './objects';
import { useEnvironmentStore } from './environment';
import { useEventsStore } from './events';
import { useTimelineStore } from './timeline';   // Unified timeline state
```

### Timeline Store (New - Orchestrator)

```typescript
// stores/timeline.ts

export const useTimelineStore = defineStore('timeline', () => {
  // Shared state
  const currentTime = ref(0);
  const duration = ref(60);
  const playing = ref(false);
  const bpm = ref(120);
  const mode = ref<'animation' | 'interactive' | 'game'>('animation');
  
  // References to other stores
  const sequencer = useSequencerStore();
  const objects = useObjectsStore();
  const environment = useEnvironmentStore();
  const events = useEventsStore();
  
  // Transport controls
  function play() {
    playing.value = true;
  }
  
  function pause() {
    playing.value = false;
  }
  
  function stop() {
    playing.value = false;
    currentTime.value = 0;
  }
  
  function seek(time: number) {
    currentTime.value = clamp(time, 0, duration.value);
  }
  
  // Main update loop (called from runtime)
  function update(dt: number) {
    if (!playing.value) return;
    
    currentTime.value += dt;
    
    if (currentTime.value >= duration.value) {
      if (mode.value === 'game') {
        // Games might loop or wait
      } else {
        stop();
      }
    }
  }
  
  // Serialization
  function toJSON(): ProjectData {
    return {
      duration: duration.value,
      bpm: bpm.value,
      mode: mode.value,
      audioTracks: sequencer.tracks,
      objectTracks: objects.tracks,
      environment: environment.data,
      events: events.data,
    };
  }
  
  function fromJSON(data: ProjectData) {
    duration.value = data.duration;
    bpm.value = data.bpm;
    mode.value = data.mode;
    sequencer.loadTracks(data.audioTracks);
    objects.loadTracks(data.objectTracks);
    environment.loadData(data.environment);
    events.loadData(data.events);
  }
  
  return {
    currentTime,
    duration,
    playing,
    bpm,
    mode,
    play, pause, stop, seek,
    update,
    toJSON, fromJSON,
  };
});
```

---

## Part 8: WASM Bridge Extensions

The existing WASM bridge needs these additions for the new track types:

```typescript
// services/allolib.ts (extend existing)

interface AllolibBridge {
  // ═══════════════════════════════════════════════════════════════
  // EXISTING (audio, basic rendering)
  // ═══════════════════════════════════════════════════════════════
  
  // ... existing methods ...
  
  // ═══════════════════════════════════════════════════════════════
  // NEW: Mesh Management
  // ═══════════════════════════════════════════════════════════════
  
  createMesh(path: string): number;                    // Returns mesh ID
  destroyMesh(id: number): void;
  setMeshPosition(id: number, pos: number[]): void;
  setMeshRotation(id: number, quat: number[]): void;
  setMeshScale(id: number, scale: number[]): void;
  setMeshVisible(id: number, visible: boolean): void;
  
  // ═══════════════════════════════════════════════════════════════
  // NEW: Shader/Material Management
  // ═══════════════════════════════════════════════════════════════
  
  createShader(vertPath: string, fragPath: string): number;
  createShaderFromSource(vert: string, frag: string): number;
  destroyShader(id: number): void;
  setUniform(shaderId: number, name: string, value: any): void;
  bindShaderToMesh(shaderId: number, meshId: number): void;
  
  // ═══════════════════════════════════════════════════════════════
  // NEW: Texture Management
  // ═══════════════════════════════════════════════════════════════
  
  loadTexture(path: string): number;                   // Returns texture ID
  destroyTexture(id: number): void;
  
  // ═══════════════════════════════════════════════════════════════
  // NEW: Environment
  // ═══════════════════════════════════════════════════════════════
  
  setSkybox(path: string): void;
  setSkyboxRotation(radians: number): void;
  blendSkybox(pathA: string, pathB: string, t: number): void;
  
  setFog(enabled: boolean, type: string, color: number[], density: number): void;
  setAmbientLight(color: number[], intensity: number): void;
  
  createLight(id: string, type: string): void;
  setLightColor(id: string, color: number[]): void;
  setLightIntensity(id: string, intensity: number): void;
  setLightPosition(id: string, pos: number[]): void;
  setLightDirection(id: string, dir: number[]): void;
  destroyLight(id: string): void;
  
  // ═══════════════════════════════════════════════════════════════
  // NEW: Camera
  // ═══════════════════════════════════════════════════════════════
  
  setCameraPosition(pos: number[]): void;
  setCameraTarget(target: number[]): void;
  setCameraRotation(quat: number[]): void;
  setCameraFOV(fov: number): void;
  getCameraPosition(): number[];
  getCameraRotation(): number[];
  
  // ═══════════════════════════════════════════════════════════════
  // NEW: Audio Analysis (for scripts)
  // ═══════════════════════════════════════════════════════════════
  
  getFFT(): Float32Array;
  getAmplitude(): number;
}
```

Most of these just need thin wrappers around existing AlloLib functionality. The C++ side already has:
- `Mesh`, `VAO` for geometry
- `ShaderProgram` for shaders
- `Texture` for textures
- `Nav` for camera
- `Light` for lighting
- Skybox rendering capability

---

## Part 9: Testing Strategy

### Unit Tests

```typescript
// tests/interpolation.test.ts
describe('Keyframe Interpolation', () => {
  it('interpolates linear keyframes', () => { ... });
  it('applies easing functions', () => { ... });
  it('handles bezier curves', () => { ... });
  it('extrapolates beyond keyframe range', () => { ... });
});

// tests/eventManager.test.ts
describe('Event Manager', () => {
  it('fires timed events at correct time', () => { ... });
  it('respects listener cooldowns', () => { ... });
  it('evaluates conditions correctly', () => { ... });
  it('handles custom events', () => { ... });
});

// tests/scriptSandbox.test.ts
describe('Script Sandbox', () => {
  it('executes scripts with context', () => { ... });
  it('catches and reports errors', () => { ... });
  it('provides correct API surface', () => { ... });
});
```

### Integration Tests

```typescript
// tests/integration/timeline.test.ts
describe('Timeline Integration', () => {
  it('synchronizes all track types', () => { ... });
  it('saves and loads project correctly', () => { ... });
  it('handles seek operations', () => { ... });
});
```

### Manual Testing Checklist

- [ ] Create object, place keyframes, verify animation
- [ ] Change skybox with transition, verify crossfade
- [ ] Add camera events, verify smooth transitions
- [ ] Create audio-reactive listener, verify response
- [ ] Write script, verify execution and error handling
- [ ] Save project, reload, verify all data preserved
- [ ] Test with existing audio-only projects (backward compat)

---

## Part 10: Migration Path for Existing Projects

Existing AlloLib Studio projects only have audio tracks. Migration:

```typescript
function migrateProject(oldProject: OldProjectFormat): NewProjectFormat {
  return {
    // Preserve all existing data
    name: oldProject.name,
    duration: oldProject.duration,
    bpm: oldProject.bpm,
    audioTracks: oldProject.audioTracks,  // Unchanged
    
    // Add empty new sections
    objectTracks: [],
    environment: {
      skybox: { type: 'solid', color: [0.1, 0.1, 0.1] },
      fog: { enabled: false, type: 'exponential', color: [0, 0, 0], density: 0 },
      ambient: { color: [1, 1, 1], intensity: 0.5 },
      lights: [],
    },
    events: {
      timedEvents: [],
      listeners: [],
    },
    
    mode: 'animation',
  };
}
```

---

## Summary

This plan extends AlloLib Studio Online from an audio sequencer to a full audiovisual animation studio with four track categories:

1. **♫ Audio** - Existing SynthVoice system (unchanged)
2. **◈ Objects** - Visual entities with mesh, material, transform, keyframe animation
3. **◐ Environment** - Global scene settings (skybox, fog, lights, terrain)
4. **⚡ Events** - Camera, markers, and full JavaScript scripting for non-linear behavior

**Key principles:**
- AlloLib C++ does all rendering - we just tell it what to do, when
- JavaScript scripting in Events track enables games without engine changes
- Linear → Non-linear is a gradient, not a mode switch
- Existing functionality preserved, new features additive

**Estimated timeline:** 10-12 weeks for Phases 0-6

**Files to create:**
- `stores/objects.ts`, `stores/environment.ts`, `stores/events.ts`, `stores/timeline.ts`
- `services/objectManager.ts`, `services/environmentManager.ts`, `services/eventManager.ts`
- `services/scriptSandbox.ts`, `services/timelineRuntime.ts`
- `types/objects.ts`, `types/environment.ts`, `types/events.ts`, `types/timeline.ts`
- `components/timeline/*` (new unified timeline UI)
- `utils/interpolation.ts`, `utils/easing.ts`
