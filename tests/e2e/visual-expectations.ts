/**
 * Visual Expectations for All Examples
 *
 * Defines expected visual characteristics for each example:
 * - Dominant colors
 * - Region checks
 * - Animation expectations
 * - Brightness ranges
 * - Specific pixel checks
 */

import { VisualExpectation, RGB } from './visual-verification'

// ─── Color Constants ──────────────────────────────────────────────────────────

const COLORS = {
  // Basic colors
  BLACK: { r: 0, g: 0, b: 0 },
  WHITE: { r: 255, g: 255, b: 255 },
  RED: { r: 255, g: 0, b: 0 },
  GREEN: { r: 0, g: 255, b: 0 },
  BLUE: { r: 0, g: 0, b: 255 },
  YELLOW: { r: 255, g: 255, b: 0 },
  CYAN: { r: 0, g: 255, b: 255 },
  MAGENTA: { r: 255, g: 0, b: 255 },

  // Common rendering colors
  GRAY: { r: 128, g: 128, b: 128 },
  DARK_GRAY: { r: 64, g: 64, b: 64 },
  LIGHT_GRAY: { r: 192, g: 192, b: 192 },

  // Typical AlloLib defaults
  ALLOLIB_BG: { r: 13, g: 13, b: 13 },  // ~0.05 gray
  ALLOLIB_DEFAULT: { r: 200, g: 200, b: 200 },

  // Audio visualization colors
  WAVEFORM_GREEN: { r: 100, g: 200, b: 100 },
  SPECTRUM_BLUE: { r: 50, g: 100, b: 200 },

  // Simulation colors
  FIRE_ORANGE: { r: 255, g: 150, b: 50 },
  WATER_BLUE: { r: 50, g: 100, b: 200 },
  SLIME_GREEN: { r: 100, g: 200, b: 50 },
  PARTICLE_WHITE: { r: 230, g: 230, b: 230 },
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function staticGraphics(minColors: number = 3, minBrightness: number = 0.05): VisualExpectation {
  return {
    requiresContent: true,
    minUniqueColors: minColors,
    minBrightness,
    maxBrightness: 0.95,
  }
}

function animatedGraphics(
  minColors: number = 3,
  minChange: number = 0.5,
  frameDelay: number = 500
): VisualExpectation {
  return {
    requiresContent: true,
    minUniqueColors: minColors,
    animation: {
      expectedMinChange: minChange,
      frameDelayMs: frameDelay,
      numFrames: 3
    }
  }
}

function audioVisual(minColors: number = 3): VisualExpectation {
  return {
    requiresContent: true,
    minUniqueColors: minColors,
    minBrightness: 0.01,
  }
}

function particles(minColors: number = 2, animated: boolean = true): VisualExpectation {
  return {
    requiresContent: true,
    minUniqueColors: minColors,
    ...(animated ? {
      animation: {
        expectedMinChange: 0.3,
        frameDelayMs: 300,
        numFrames: 3
      }
    } : {})
  }
}

function simulation(minChange: number = 0.2): VisualExpectation {
  return {
    requiresContent: true,
    minUniqueColors: 2,
    animation: {
      expectedMinChange: minChange,
      frameDelayMs: 500,
      numFrames: 4
    }
  }
}

function centerContent(): VisualExpectation {
  return {
    requiresContent: true,
    regions: [
      {
        name: 'center',
        x: 0.3,
        y: 0.3,
        width: 0.4,
        height: 0.4,
        expectation: 'has-variation'
      }
    ]
  }
}

// ─── Visual Expectations by Example ───────────────────────────────────────────

export const VISUAL_EXPECTATIONS: Record<string, VisualExpectation> = {
  // === BASICS ===
  'hello-sphere': {
    requiresContent: true,
    minUniqueColors: 5,
    minBrightness: 0.05,
    regions: [
      {
        name: 'sphere-center',
        x: 0.35,
        y: 0.35,
        width: 0.3,
        height: 0.3,
        expectation: 'has-variation'
      }
    ]
  },

  'hello-audio': audioVisual(2),
  'hello-audiovisual': audioVisual(3),

  'shape-gallery': {
    requiresContent: true,
    minUniqueColors: 5,
    regions: [
      {
        name: 'shapes-visible',
        x: 0.1,
        y: 0.1,
        width: 0.8,
        height: 0.8,
        expectation: 'has-variation'
      }
    ]
  },

  'custom-mesh': {
    requiresContent: true,
    minUniqueColors: 3,
    regions: [
      {
        name: 'mesh-center',
        x: 0.3,
        y: 0.3,
        width: 0.4,
        height: 0.4,
        expectation: 'has-color'
      }
    ]
  },

  'color-hsv': {
    requiresContent: true,
    minUniqueColors: 10,  // HSV should show many colors
    minBrightness: 0.1,
  },

  'vertex-colors': {
    requiresContent: true,
    minUniqueColors: 4,
    regions: [
      {
        name: 'colored-vertices',
        x: 0.2,
        y: 0.2,
        width: 0.6,
        height: 0.6,
        expectation: 'has-variation'
      }
    ]
  },

  // === GRAPHICS ===
  'points-only-test': staticGraphics(2),
  'triangles-only-test': staticGraphics(3),
  'mesh-primitives': staticGraphics(5),

  'mesh-normals': {
    requiresContent: true,
    minUniqueColors: 5,
    minBrightness: 0.05,
    animation: {
      expectedMinChange: 0.1,
      frameDelayMs: 500,
      numFrames: 3
    }
  },

  'transform-hierarchy': animatedGraphics(5, 0.3),
  'matrix-operations': animatedGraphics(4, 0.2),

  'basic-lighting': {
    requiresContent: true,
    minUniqueColors: 5,
    minBrightness: 0.05,
    regions: [
      {
        name: 'lit-surface',
        x: 0.3,
        y: 0.3,
        width: 0.4,
        height: 0.4,
        expectation: 'has-variation'  // Lighting should create gradients
      }
    ]
  },

  'custom-shader': {
    requiresContent: true,
    minUniqueColors: 3,
  },

  'procedural-texture': {
    requiresContent: true,
    minUniqueColors: 8,
    regions: [
      {
        name: 'textured-area',
        x: 0.2,
        y: 0.2,
        width: 0.6,
        height: 0.6,
        expectation: 'has-variation'
      }
    ]
  },

  'web-image-texture': staticGraphics(10),

  // === AUDIO ===
  'oscillator-types': {
    requiresContent: true,
    minUniqueColors: 2,
    regions: [
      {
        name: 'waveform-display',
        x: 0.1,
        y: 0.3,
        width: 0.8,
        height: 0.4,
        expectation: 'has-variation'
      }
    ]
  },

  'fm-synthesis': audioVisual(3),
  'adsr-envelope': audioVisual(3),
  'additive-synthesis': audioVisual(3),
  'web-sample-player': audioVisual(2),
  'reverb-filter-chain': audioVisual(3),

  // === INTERACTION ===
  'piano-keyboard': {
    requiresContent: true,
    minUniqueColors: 3,
    regions: [
      {
        name: 'keyboard-area',
        x: 0.1,
        y: 0.4,
        width: 0.8,
        height: 0.4,
        expectation: 'has-variation'
      }
    ]
  },

  'mouse-theremin': audioVisual(3),

  'camera-control': {
    requiresContent: true,
    minUniqueColors: 3,
  },

  // === SCENE ===
  'synthvoice-basic': audioVisual(3),
  'polysynth-demo': audioVisual(3),
  'dynamic-scene': audioVisual(3),

  // === SIMULATION ===
  'particle-system': particles(3),
  'audio-reactive': audioVisual(5),
  'lissajous': animatedGraphics(3, 0.5),
  'fractal-tree': staticGraphics(5),

  'sim-particle-fountain': {
    requiresContent: true,
    minUniqueColors: 3,
    animation: {
      expectedMinChange: 0.5,
      frameDelayMs: 300,
      numFrames: 4
    },
    regions: [
      {
        name: 'fountain-area',
        x: 0.3,
        y: 0.1,
        width: 0.4,
        height: 0.8,
        expectation: 'has-variation'
      }
    ]
  },

  'sim-flocking': simulation(0.3),
  'sim-wave-equation': simulation(0.2),
  'sim-spring-mesh': simulation(0.3),
  'sim-ant-trails': simulation(0.1),
  'sim-andromeda-galaxy': staticGraphics(10, 0.02),
  'sim-particle-galaxy': particles(5),
  'sim-point-test': staticGraphics(2),

  // === CELLULAR AUTOMATA ===
  'ca-game-of-life': {
    requiresContent: true,
    minUniqueColors: 2,
    animation: {
      expectedMinChange: 0.5,
      frameDelayMs: 200,
      numFrames: 4
    }
  },

  'ca-falling-sand': simulation(0.3),
  'ca-3d-life': simulation(0.3),
  'ca-reaction-diffusion': simulation(0.1),
  'ca-wireworld': simulation(0.2),

  // === RAY MARCHING ===
  'rm-sphere-basic': {
    requiresContent: true,
    minUniqueColors: 5,
    minBrightness: 0.05,
    regions: [
      {
        name: 'sphere',
        x: 0.3,
        y: 0.3,
        width: 0.4,
        height: 0.4,
        expectation: 'has-variation'
      }
    ]
  },

  'rm-mandelbulb': staticGraphics(8),
  'rm-csg-operations': staticGraphics(6),
  'rm-infinite-repetition': staticGraphics(8),
  'rm-organic-blob': animatedGraphics(6, 0.3),
  'rm-terrain': staticGraphics(8),
  'rm-volumetric-clouds': staticGraphics(5),

  // === FLUIDS ===
  'fluid-simple-2d': simulation(0.2),
  'fluid-smoke-2d': simulation(0.2),
  'fluid-ink-drops': simulation(0.3),
  'fluid-lava-lamp': simulation(0.1),

  // === ARTIFICIAL LIFE ===
  'life-slime-mold': {
    requiresContent: true,
    minUniqueColors: 3,
    animation: {
      expectedMinChange: 0.1,
      frameDelayMs: 500,
      numFrames: 3
    }
  },

  'life-creatures-simple': simulation(0.2),
  'life-aquarium': simulation(0.2),
  'life-coral-growth': simulation(0.1),
  'life-neural-creatures': simulation(0.2),
  'life-plants-2d': simulation(0.1),

  // === AGENTS ===
  'agents-evolution': simulation(0.2),
  'agents-predator-prey': simulation(0.3),
  'agents-school-fish': simulation(0.3),
  'agents-traffic': simulation(0.2),

  // === PROCEDURAL ===
  'proc-caves': {
    requiresContent: true,
    minUniqueColors: 5,
    regions: [
      {
        name: 'cave-structure',
        x: 0.2,
        y: 0.2,
        width: 0.6,
        height: 0.6,
        expectation: 'has-variation'
      }
    ]
  },

  'proc-city': staticGraphics(8),
  'proc-galaxy': staticGraphics(10),
  'proc-noise-gallery': staticGraphics(15),
  'proc-terrain': staticGraphics(8),

  // === PARTICLES ===
  'particles-rain': particles(3),
  'particles-fire': {
    requiresContent: true,
    minUniqueColors: 5,
    animation: {
      expectedMinChange: 0.5,
      frameDelayMs: 200,
      numFrames: 4
    }
  },
  'particles-snow': particles(2),
  'particles-smoke': particles(4),
  'particles-attractor': particles(3),
  'particles-swarm': particles(3),

  // === ADVANCED ===
  'adv-multifile-synth': audioVisual(3),
  'cross-platform-app': staticGraphics(5),
  'hashspace-demo': staticGraphics(5),

  // === FEATURE TESTS ===
  'mesh-primitives-test': staticGraphics(6),
  'transform-stack-test': staticGraphics(5),
  'distance-attenuation': staticGraphics(5),
  'multilight-test': staticGraphics(6),
  'easyfbo-test': staticGraphics(4),
  'blend-modes-test': staticGraphics(8),
  'shape-gallery-test': animatedGraphics(5, 0.2),
  'parameter-panel-test': staticGraphics(4),
  'spatial-audio-test': audioVisual(3),
  'gamma-dsp-test': audioVisual(3),
  'gamma-oscillators-full': audioVisual(3),
  'gamma-fft-analysis': audioVisual(5),
  'gamma-envelopes': audioVisual(3),
  'gamma-filters': audioVisual(3),
  'gamma-delays-effects': audioVisual(3),
  'allolib-reverb': audioVisual(3),

  // === GPU EXAMPLES ===
  'gpu-wave-shader': animatedGraphics(5, 0.3),
  'gpu-gradient-sphere': {
    requiresContent: true,
    minUniqueColors: 8,
    regions: [
      {
        name: 'gradient-sphere',
        x: 0.3,
        y: 0.3,
        width: 0.4,
        height: 0.4,
        expectation: 'has-variation'
      }
    ]
  },
  'gpu-procedural-pattern': staticGraphics(6),
  'gpu-vertex-colors': staticGraphics(5),

  // === PLAYGROUND ===
  'pg-sine-env': audioVisual(3),
  'pg-osc-env': audioVisual(3),
  'pg-fm': audioVisual(3),
  'pg-am': audioVisual(3),
  'pg-vibrato': audioVisual(3),
  'pg-subtractive': audioVisual(3),
  'pg-additive': audioVisual(3),
  'pg-audiovisual-basic': audioVisual(4),
  'pg-audiovisual-color': audioVisual(5),
  'pg-plucked-string': audioVisual(3),
  'pg-synthesis-showcase': audioVisual(4),

  // === STUDIO - ENVIRONMENTS ===
  'studio-env-basic': staticGraphics(5),
  'studio-env-pbr-materials': {
    requiresContent: true,
    minUniqueColors: 8,
    minBrightness: 0.05,
    regions: [
      {
        name: 'pbr-spheres',
        x: 0.1,
        y: 0.2,
        width: 0.8,
        height: 0.6,
        expectation: 'has-variation'
      }
    ]
  },
  'studio-env-pbr-roughness': staticGraphics(8),
  'studio-env-hdri-skybox': staticGraphics(10),
  'studio-env-reflect-sphere': staticGraphics(8),
  'studio-skybox-procedural': staticGraphics(8),
  'studio-skybox-hdri-picker': staticGraphics(8),

  // === STUDIO - MESHES ===
  'studio-mesh-bunny': {
    requiresContent: true,
    minUniqueColors: 5,
    regions: [
      {
        name: 'bunny-mesh',
        x: 0.3,
        y: 0.2,
        width: 0.4,
        height: 0.6,
        expectation: 'has-variation'
      }
    ]
  },
  'studio-mesh-teapot': staticGraphics(5),
  'studio-mesh-pbr-bunny': staticGraphics(8),
  'studio-mesh-env-teapot': staticGraphics(8),
  'studio-mesh-gallery': staticGraphics(8),
  'studio-mesh-knot': animatedGraphics(5, 0.2),
  'studio-mesh-klein': staticGraphics(5),
  'studio-mesh-lod-demo': staticGraphics(5),
  'studio-mesh-lod-group': staticGraphics(5),
  'studio-mesh-lod-controller': staticGraphics(5),
  'studio-mesh-texture-lod': staticGraphics(6),
  'studio-mesh-shader-lod': staticGraphics(5),

  // === STUDIO - TEXTURES ===
  'studio-tex-procedural-noise': staticGraphics(10),
  'studio-tex-procedural-patterns': staticGraphics(8),
  'studio-tex-bunny-uv': staticGraphics(6),
  'studio-tex-lod-demo': staticGraphics(6),
  'studio-tex-mipmap-lod': staticGraphics(6),
  'studio-tex-pbr-mipmap': staticGraphics(8),
  'studio-tex-pbr-procedural': staticGraphics(8),
  'studio-tex-pbr-normal-mapping': staticGraphics(8),
  'studio-tex-3d-noise': staticGraphics(10),
  'studio-tex-hdr-exposure': staticGraphics(8),

  // === STUDIO - TIMELINE ===
  'studio-timeline-objects': animatedGraphics(5, 0.2),
  'studio-timeline-keyframes': animatedGraphics(5, 0.3),

  // === STUDIO - TEMPLATES ===
  'studio-template-av': audioVisual(4),

  // === STUDIO - SHOWCASE ===
  'studio-showcase-particles': particles(5),
  'studio-showcase-pbr-gallery': staticGraphics(10),
  'studio-showcase-museum': staticGraphics(10),
  'studio-showcase-crystal-cave': staticGraphics(10),
  'studio-showcase-procedural-planet': staticGraphics(8),
  'studio-showcase-day-night': animatedGraphics(8, 0.1, 1000),
  'studio-showcase-camera-demo': animatedGraphics(5, 0.2),
  'studio-showcase-audio-visualizer': audioVisual(5),
  'studio-showcase-simple-game': {
    requiresContent: true,
    minUniqueColors: 4,
  },
  'studio-showcase-emergence': simulation(0.2),
}

// ─── Default Expectation ──────────────────────────────────────────────────────

export const DEFAULT_EXPECTATION: VisualExpectation = {
  requiresContent: true,
  minUniqueColors: 2,
  minBrightness: 0.01,
}

export function getExpectation(exampleId: string): VisualExpectation {
  return VISUAL_EXPECTATIONS[exampleId] || DEFAULT_EXPECTATION
}
