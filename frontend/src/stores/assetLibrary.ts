import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import { useProjectStore } from './project'

// ─── Asset Types ─────────────────────────────────────────────────────────────

export type AssetCategory =
  | 'snippets'
  | 'templates'
  | 'objects'
  | 'shaders'
  | 'textures'
  | 'meshes'
  | 'environments'

export type AssetType =
  | 'snippet'
  | 'file'
  | 'object'
  | 'shader'
  | 'texture'
  | 'mesh'
  | 'environment'

/**
 * Asset loading state (PlayCanvas-style)
 * - idle: Not yet requested
 * - loading: Currently downloading/parsing
 * - ready: Loaded and available
 * - error: Failed to load
 */
export type AssetLoadingState = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Priority levels for asset loading
 * - critical: Load immediately, block app start (UI, essential meshes)
 * - high: Load early in background (player models, common textures)
 * - normal: Load on-demand when needed
 * - low: Stream when idle (background music, distant scenery)
 */
export type AssetPriority = 'critical' | 'high' | 'normal' | 'low'

export interface Asset {
  id: string
  name: string
  category: AssetCategory
  subcategory?: string
  type: AssetType
  description: string
  thumbnail?: string
  tags: string[]

  // Content based on type
  content?: string                    // For snippets/files/shaders
  filePath?: string                   // For binary assets (textures, meshes)
  objectDefinition?: ObjectDefinition // For objects

  // External resource references (for HDRIs, OBJ meshes)
  downloadUrl?: string      // External URL (e.g., polyhaven.com)
  localPath?: string        // Local asset path (e.g., /assets/environments/studio.hdr)
  previewUrl?: string
  license?: 'CC0' | 'MIT' | 'Apache-2.0'
  resolution?: string  // '2K', '4K', etc.
  fileSize?: string    // '2.4 MB'
  fileSizeBytes?: number // Actual size for progress tracking

  // ─── Loading & Streaming (PlayCanvas-style) ───
  preload?: boolean           // If true, load before app starts
  priority?: AssetPriority    // Loading priority level
  loadingState?: AssetLoadingState  // Current loading state
  loadProgress?: number       // 0-100 loading progress
  loadError?: string          // Error message if failed
  loadedData?: ArrayBuffer | string | ImageBitmap  // Cached loaded data
  placeholderUrl?: string     // Placeholder image while loading

  // Metadata
  author?: string
  version?: string
  createdAt: string
  updatedAt: string
  isBuiltIn: boolean
  isFavorite: boolean
}

export interface ObjectDefinition {
  id: string
  name: string
  components: {
    mesh?: {
      type: 'sphere' | 'cube' | 'plane' | 'torus' | 'cylinder' | 'cone' | 'disk' | 'prism' | 'tetrahedron' | 'octahedron' | 'icosahedron' | 'dodecahedron' | 'custom'
      params?: Record<string, number>
    }
    material?: {
      shader?: string
      uniforms?: Record<string, { type: string; default: number | number[]; min?: number; max?: number }>
    }
    transform?: {
      position: [number, number, number]
      rotation: [number, number, number, number]
      scale: [number, number, number]
    }
  }
}

export interface AssetCategoryInfo {
  id: AssetCategory
  name: string
  icon: string
  description: string
}

// ─── Category Definitions ────────────────────────────────────────────────────

export const assetCategories: AssetCategoryInfo[] = [
  { id: 'snippets', name: 'Snippets', icon: '{ }', description: 'Reusable C++ code blocks' },
  { id: 'templates', name: 'Templates', icon: '📄', description: 'Complete file templates' },
  { id: 'objects', name: 'Objects', icon: '◆', description: 'Visual object definitions' },
  { id: 'shaders', name: 'Shaders', icon: '🎨', description: 'GLSL shader library' },
  { id: 'textures', name: 'Textures', icon: '🖼', description: 'Texture assets' },
  { id: 'meshes', name: 'Meshes', icon: '△', description: '3D model assets' },
  { id: 'environments', name: 'Environments', icon: '🌍', description: 'Skyboxes and HDRIs' },
]

// ─── Built-in Assets ─────────────────────────────────────────────────────────

const builtInAssets: Asset[] = [
  // === SYNTH SNIPPETS ===
  {
    id: 'snippet-fm-synth',
    name: 'FM Synth Voice',
    category: 'snippets',
    subcategory: 'Synths',
    type: 'snippet',
    description: 'Basic 2-operator FM synthesis voice with ADSR envelope',
    tags: ['synth', 'fm', 'frequency modulation', 'voice', 'audio'],
    content: `class FMVoice : public al::SynthVoice {
public:
  gam::Sine<> carrier, modulator;
  gam::ADSR<> env;
  float modDepth = 200.0f;
  float modRatio = 2.0f;

  void init() override {
    createInternalTriggerParameter("amplitude", 0.5, 0.0, 1.0);
    createInternalTriggerParameter("frequency", 440, 20, 5000);
    createInternalTriggerParameter("modDepth", 200, 0, 1000);
    createInternalTriggerParameter("modRatio", 2, 0.5, 8);
  }

  void onProcess(al::AudioIOData& io) override {
    while (io()) {
      modDepth = getInternalParameterValue("modDepth");
      modRatio = getInternalParameterValue("modRatio");
      float freq = getInternalParameterValue("frequency");
      modulator.freq(freq * modRatio);
      float mod = modulator() * modDepth;
      carrier.freq(freq + mod);
      float s = carrier() * env() * getInternalParameterValue("amplitude");
      io.out(0) += s;
      io.out(1) += s;
    }
    if (env.done()) free();
  }

  void onTriggerOn() override {
    env.attack(0.01f);
    env.decay(0.1f);
    env.sustain(0.7f);
    env.release(0.3f);
    env.reset();
  }

  void onTriggerOff() override {
    env.release();
  }
};`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-subtractive-synth',
    name: 'Subtractive Synth',
    category: 'snippets',
    subcategory: 'Synths',
    type: 'snippet',
    description: 'Classic subtractive synthesis with sawtooth and filter',
    tags: ['synth', 'subtractive', 'filter', 'voice', 'audio'],
    content: `class SubtractiveSynth : public al::SynthVoice {
public:
  gam::Saw<> osc;
  gam::Biquad<> filter;
  gam::ADSR<> ampEnv, filterEnv;
  float filterCutoff = 2000.0f;
  float filterRes = 0.5f;

  void init() override {
    createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
    createInternalTriggerParameter("frequency", 440, 20, 5000);
    createInternalTriggerParameter("cutoff", 2000, 100, 10000);
    createInternalTriggerParameter("resonance", 0.5, 0, 1);
    filter.type(gam::LOW_PASS);
  }

  void onProcess(al::AudioIOData& io) override {
    while (io()) {
      osc.freq(getInternalParameterValue("frequency"));
      filterCutoff = getInternalParameterValue("cutoff") * filterEnv();
      filter.freq(filterCutoff);
      filter.res(getInternalParameterValue("resonance") * 4);
      float s = filter(osc()) * ampEnv() * getInternalParameterValue("amplitude");
      io.out(0) += s;
      io.out(1) += s;
    }
    if (ampEnv.done()) free();
  }

  void onTriggerOn() override {
    ampEnv.attack(0.01f); ampEnv.decay(0.2f); ampEnv.sustain(0.6f); ampEnv.release(0.4f);
    filterEnv.attack(0.01f); filterEnv.decay(0.3f); filterEnv.sustain(0.3f); filterEnv.release(0.3f);
    ampEnv.reset(); filterEnv.reset();
  }

  void onTriggerOff() override {
    ampEnv.release(); filterEnv.release();
  }
};`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-additive-synth',
    name: 'Additive Synth',
    category: 'snippets',
    subcategory: 'Synths',
    type: 'snippet',
    description: 'Additive synthesis with 8 harmonic partials',
    tags: ['synth', 'additive', 'harmonics', 'voice', 'audio'],
    content: `class AdditiveSynth : public al::SynthVoice {
public:
  static const int NUM_PARTIALS = 8;
  gam::Sine<> partials[NUM_PARTIALS];
  gam::ADSR<> env;
  float partialAmps[NUM_PARTIALS] = {1.0, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14, 0.12};

  void init() override {
    createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
    createInternalTriggerParameter("frequency", 220, 20, 2000);
    createInternalTriggerParameter("brightness", 1.0, 0.0, 2.0);
  }

  void onProcess(al::AudioIOData& io) override {
    float freq = getInternalParameterValue("frequency");
    float brightness = getInternalParameterValue("brightness");
    float amp = getInternalParameterValue("amplitude");

    while (io()) {
      float s = 0;
      for (int i = 0; i < NUM_PARTIALS; i++) {
        partials[i].freq(freq * (i + 1));
        float pAmp = partialAmps[i] * pow(brightness, i * 0.5f);
        s += partials[i]() * pAmp;
      }
      s = s * env() * amp * 0.3f;
      io.out(0) += s;
      io.out(1) += s;
    }
    if (env.done()) free();
  }

  void onTriggerOn() override {
    env.attack(0.02f); env.decay(0.1f); env.sustain(0.8f); env.release(0.5f);
    env.reset();
  }

  void onTriggerOff() override { env.release(); }
};`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-wavetable-synth',
    name: 'Wavetable Synth',
    category: 'snippets',
    subcategory: 'Synths',
    type: 'snippet',
    description: 'Wavetable synthesis with morphing between waveforms',
    tags: ['synth', 'wavetable', 'voice', 'audio'],
    content: `class WavetableSynth : public al::SynthVoice {
public:
  gam::ArrayPow2<float> table;
  gam::Osc<> osc;
  gam::ADSR<> env;
  int tableSize = 2048;

  void init() override {
    createInternalTriggerParameter("amplitude", 0.5, 0.0, 1.0);
    createInternalTriggerParameter("frequency", 440, 20, 5000);
    createInternalTriggerParameter("morph", 0.5, 0.0, 1.0);

    table.resize(tableSize);
    updateWaveform(0.5f);
    osc.source(table);
  }

  void updateWaveform(float morph) {
    for (int i = 0; i < tableSize; i++) {
      float phase = float(i) / tableSize * 2 * M_PI;
      float sine = sin(phase);
      float saw = 2.0f * (float(i) / tableSize) - 1.0f;
      table[i] = sine * (1.0f - morph) + saw * morph;
    }
  }

  void onProcess(al::AudioIOData& io) override {
    updateWaveform(getInternalParameterValue("morph"));
    while (io()) {
      osc.freq(getInternalParameterValue("frequency"));
      float s = osc() * env() * getInternalParameterValue("amplitude");
      io.out(0) += s;
      io.out(1) += s;
    }
    if (env.done()) free();
  }

  void onTriggerOn() override {
    env.attack(0.01f); env.decay(0.1f); env.sustain(0.7f); env.release(0.3f);
    env.reset();
  }

  void onTriggerOff() override { env.release(); }
};`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === GRAPHICS SNIPPETS ===
  {
    id: 'snippet-spinning-mesh',
    name: 'Spinning Mesh',
    category: 'snippets',
    subcategory: 'Graphics',
    type: 'snippet',
    description: 'Rotating mesh with configurable speed',
    tags: ['mesh', 'animation', 'rotation', 'graphics'],
    content: `// Add to class members:
al::Mesh mesh;
float angle = 0;
float rotationSpeed = 1.0f;

// In onCreate():
al::addSphere(mesh, 1.0);
mesh.generateNormals();

// In onAnimate(double dt):
angle += rotationSpeed * dt;

// In onDraw(Graphics& g):
g.pushMatrix();
g.rotate(angle * 180 / M_PI, 0, 1, 0);
g.draw(mesh);
g.popMatrix();`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-particle-system',
    name: 'Particle System',
    category: 'snippets',
    subcategory: 'Graphics',
    type: 'snippet',
    description: 'Simple particle system with velocity and lifetime',
    tags: ['particles', 'animation', 'graphics', 'effects'],
    content: `struct Particle {
  al::Vec3f pos, vel;
  float life, maxLife;
  al::Color color;
};

std::vector<Particle> particles;
al::Mesh particleMesh;

void initParticles() {
  particleMesh.primitive(al::Mesh::POINTS);
}

void spawnParticle(al::Vec3f origin) {
  Particle p;
  p.pos = origin;
  p.vel = al::Vec3f(al::rnd::uniformS(), al::rnd::uniform() + 0.5f, al::rnd::uniformS()) * 2.0f;
  p.maxLife = p.life = 1.0f + al::rnd::uniform();
  p.color = al::HSV(al::rnd::uniform(), 0.8f, 1.0f);
  particles.push_back(p);
}

void updateParticles(double dt) {
  particleMesh.reset();
  for (auto it = particles.begin(); it != particles.end();) {
    it->life -= dt;
    if (it->life <= 0) {
      it = particles.erase(it);
    } else {
      it->vel.y -= 9.8f * dt;  // gravity
      it->pos += it->vel * dt;
      float alpha = it->life / it->maxLife;
      particleMesh.vertex(it->pos);
      particleMesh.color(it->color.r, it->color.g, it->color.b, alpha);
      ++it;
    }
  }
}

void drawParticles(al::Graphics& g) {
  g.blending(true);
  g.blendAdd();
  g.pointSize(4);
  g.draw(particleMesh);
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-lighting-setup',
    name: 'Lighting Setup',
    category: 'snippets',
    subcategory: 'Graphics',
    type: 'snippet',
    description: 'Basic lighting with diffuse and specular',
    tags: ['lighting', 'graphics', 'shading'],
    content: `// Add to class members:
al::Light light;
al::Material material;

// In onCreate():
light.pos(5, 5, 5);
light.ambient(al::Color(0.1f));
light.diffuse(al::Color(1.0f));
light.specular(al::Color(1.0f));

material.ambient(al::Color(0.2f));
material.diffuse(al::Color(0.8f, 0.3f, 0.3f));
material.specular(al::Color(1.0f));
material.shininess(50);

// In onDraw(Graphics& g):
g.lighting(true);
light();
material();
// ... draw your meshes ...
g.lighting(false);`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === AUDIO SNIPPETS ===
  {
    id: 'snippet-reverb',
    name: 'Reverb Effect',
    category: 'snippets',
    subcategory: 'Audio',
    type: 'snippet',
    description: 'Simple reverb using comb filters',
    tags: ['audio', 'effect', 'reverb', 'dsp'],
    content: `// Add to class members:
gam::Comb<float, gam::ipl::Linear> comb1, comb2, comb3, comb4;
float reverbMix = 0.3f;

// In onCreate():
comb1.maxDelay(0.1f); comb1.delay(0.0297f); comb1.decay(0.5f);
comb2.maxDelay(0.1f); comb2.delay(0.0371f); comb2.decay(0.5f);
comb3.maxDelay(0.1f); comb3.delay(0.0411f); comb3.decay(0.5f);
comb4.maxDelay(0.1f); comb4.delay(0.0437f); comb4.decay(0.5f);

// Apply reverb to a sample:
float applyReverb(float sample) {
  float wet = (comb1(sample) + comb2(sample) + comb3(sample) + comb4(sample)) * 0.25f;
  return sample * (1.0f - reverbMix) + wet * reverbMix;
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-delay',
    name: 'Delay Effect',
    category: 'snippets',
    subcategory: 'Audio',
    type: 'snippet',
    description: 'Stereo delay with feedback',
    tags: ['audio', 'effect', 'delay', 'dsp'],
    content: `// Add to class members:
gam::Delay<float> delayL, delayR;
float delayTime = 0.3f;    // seconds
float feedback = 0.5f;
float delayMix = 0.4f;

// In onCreate():
delayL.maxDelay(2.0f);
delayR.maxDelay(2.0f);
delayL.delay(delayTime);
delayR.delay(delayTime * 1.1f);  // Slight offset for stereo width

// In onProcess (per sample):
float wetL = delayL(inputL + delayL.read(delayTime) * feedback);
float wetR = delayR(inputR + delayR.read(delayTime * 1.1f) * feedback);
outputL = inputL * (1 - delayMix) + wetL * delayMix;
outputR = inputR * (1 - delayMix) + wetR * delayMix;`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === UTILITY SNIPPETS ===
  {
    id: 'snippet-smoothing',
    name: 'Parameter Smoothing',
    category: 'snippets',
    subcategory: 'Utilities',
    type: 'snippet',
    description: 'Smooth parameter changes to avoid clicks',
    tags: ['utility', 'smoothing', 'audio', 'parameters'],
    content: `// One-pole smoothing filter
class SmoothValue {
  float current = 0;
  float target = 0;
  float coeff = 0.99f;

public:
  void setTime(float seconds, float sampleRate) {
    coeff = exp(-1.0f / (seconds * sampleRate));
  }

  void setTarget(float t) { target = t; }
  void setImmediate(float v) { current = target = v; }

  float operator()() {
    current = current * coeff + target * (1.0f - coeff);
    return current;
  }

  float get() const { return current; }
};

// Usage:
SmoothValue smoothAmp;
smoothAmp.setTime(0.01f, 44100);  // 10ms smoothing
smoothAmp.setTarget(newAmplitude);
// In audio callback:
float amp = smoothAmp();`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-perlin-noise',
    name: 'Perlin Noise',
    category: 'snippets',
    subcategory: 'Utilities',
    type: 'snippet',
    description: '3D Perlin noise implementation',
    tags: ['utility', 'noise', 'procedural', 'graphics'],
    content: `namespace noise {
  static int perm[512];
  static bool initialized = false;

  void init() {
    if (initialized) return;
    for (int i = 0; i < 256; i++) perm[i] = i;
    for (int i = 255; i > 0; i--) {
      int j = rand() % (i + 1);
      std::swap(perm[i], perm[j]);
    }
    for (int i = 0; i < 256; i++) perm[256 + i] = perm[i];
    initialized = true;
  }

  float fade(float t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  float lerp(float a, float b, float t) { return a + t * (b - a); }
  float grad(int hash, float x, float y, float z) {
    int h = hash & 15;
    float u = h < 8 ? x : y;
    float v = h < 4 ? y : (h == 12 || h == 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  float perlin(float x, float y, float z) {
    init();
    int X = (int)floor(x) & 255, Y = (int)floor(y) & 255, Z = (int)floor(z) & 255;
    x -= floor(x); y -= floor(y); z -= floor(z);
    float u = fade(x), v = fade(y), w = fade(z);
    int A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    int B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return lerp(lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
                     lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
                lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
                     lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v), w);
  }

  float fbm(float x, float y, float z, int octaves = 4) {
    float value = 0, amplitude = 0.5f, frequency = 1.0f;
    for (int i = 0; i < octaves; i++) {
      value += amplitude * perlin(x * frequency, y * frequency, z * frequency);
      amplitude *= 0.5f;
      frequency *= 2.0f;
    }
    return value;
  }
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === FILE TEMPLATES ===
  {
    id: 'template-basic-app',
    name: 'Basic App',
    category: 'templates',
    subcategory: 'Main Files',
    type: 'file',
    description: 'Minimal AlloLib application template',
    tags: ['template', 'main', 'starter'],
    content: `#include "al/app/al_App.hpp"

using namespace al;

class MyApp : public App {
public:
  Mesh mesh;

  void onCreate() override {
    addSphere(mesh, 1.0);
    mesh.generateNormals();
    nav().pos(0, 0, 5);
  }

  void onAnimate(double dt) override {
    // Animation logic here
  }

  void onDraw(Graphics& g) override {
    g.clear(0.1);
    g.draw(mesh);
  }
};

int main() {
  MyApp app;
  app.start();
  return 0;
}
`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'template-synth-app',
    name: 'Synth App',
    category: 'templates',
    subcategory: 'Main Files',
    type: 'file',
    description: 'Application with SynthGUIManager and keyboard control',
    tags: ['template', 'main', 'synth', 'audio'],
    content: `#include "al/app/al_App.hpp"
#include "al/app/al_GUIDomain.hpp"
#include "al/scene/al_SynthSequencer.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"

using namespace al;

class MySynth : public SynthVoice {
public:
  gam::Sine<> osc;
  gam::ADSR<> env;

  void init() override {
    createInternalTriggerParameter("amplitude", 0.5, 0.0, 1.0);
    createInternalTriggerParameter("frequency", 440, 20, 5000);
    createInternalTriggerParameter("attackTime", 0.01, 0.001, 2.0);
    createInternalTriggerParameter("releaseTime", 0.3, 0.001, 5.0);
  }

  void onProcess(AudioIOData& io) override {
    while (io()) {
      osc.freq(getInternalParameterValue("frequency"));
      float s = osc() * env() * getInternalParameterValue("amplitude");
      io.out(0) += s;
      io.out(1) += s;
    }
    if (env.done()) free();
  }

  void onTriggerOn() override {
    env.attack(getInternalParameterValue("attackTime"));
    env.decay(0.1);
    env.sustain(0.7);
    env.release(getInternalParameterValue("releaseTime"));
    env.reset();
  }

  void onTriggerOff() override {
    env.release();
  }
};

class MyApp : public App {
public:
  SynthGUIManager<MySynth> synthManager{"MySynth"};

  void onCreate() override {
    synthManager.init(this);
    nav().pos(0, 0, 5);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.1);
    synthManager.render(g);
  }

  void onSound(AudioIOData& io) override {
    synthManager.synth().render(io);
  }

  bool onKeyDown(Keyboard const& k) override {
    if (synthManager.keyboardControl().keyDown(k)) return true;
    return false;
  }

  bool onKeyUp(Keyboard const& k) override {
    if (synthManager.keyboardControl().keyUp(k)) return true;
    return false;
  }
};

int main() {
  MyApp app;
  app.configureAudio(48000, 512, 2, 0);
  app.start();
  return 0;
}
`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'template-audiovisual-app',
    name: 'Audio-Visual App',
    category: 'templates',
    subcategory: 'Main Files',
    type: 'file',
    description: 'Combined audio synthesis and visual rendering',
    tags: ['template', 'main', 'audiovisual', 'synth'],
    content: `#include "al/app/al_App.hpp"
#include "al/app/al_GUIDomain.hpp"
#include "al/scene/al_SynthSequencer.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"

using namespace al;

class AudioVisualVoice : public SynthVoice {
public:
  gam::Sine<> osc;
  gam::ADSR<> env;
  Mesh mesh;
  Vec3f position;
  Color color;

  void init() override {
    createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
    createInternalTriggerParameter("frequency", 440, 20, 5000);
    addSphere(mesh, 0.3, 16, 16);
    mesh.generateNormals();
  }

  void onProcess(AudioIOData& io) override {
    while (io()) {
      osc.freq(getInternalParameterValue("frequency"));
      float s = osc() * env() * getInternalParameterValue("amplitude");
      io.out(0) += s;
      io.out(1) += s;
    }
    if (env.done()) free();
  }

  void onProcess(Graphics& g) override {
    float freq = getInternalParameterValue("frequency");
    float amp = env() * getInternalParameterValue("amplitude");

    // Position based on frequency (x) and amplitude (y)
    position.x = (log2(freq / 440.0f)) * 2.0f;
    position.y = amp * 3.0f;

    // Color from frequency
    color = HSV(fmod(freq / 1000.0f, 1.0f), 0.8f, amp + 0.2f);

    g.pushMatrix();
    g.translate(position);
    g.scale(0.5f + amp);
    g.color(color);
    g.draw(mesh);
    g.popMatrix();
  }

  void onTriggerOn() override {
    env.attack(0.01); env.decay(0.1); env.sustain(0.7); env.release(0.5);
    env.reset();
  }

  void onTriggerOff() override { env.release(); }
};

class MyApp : public App {
public:
  SynthGUIManager<AudioVisualVoice> synthManager{"AudioVisualVoice"};

  void onCreate() override {
    synthManager.init(this);
    nav().pos(0, 0, 10);
  }

  void onDraw(Graphics& g) override {
    g.clear(0.05);
    g.lighting(true);
    synthManager.render(g);
    g.lighting(false);
  }

  void onSound(AudioIOData& io) override {
    synthManager.synth().render(io);
  }

  bool onKeyDown(Keyboard const& k) override {
    return synthManager.keyboardControl().keyDown(k);
  }

  bool onKeyUp(Keyboard const& k) override {
    return synthManager.keyboardControl().keyUp(k);
  }
};

int main() {
  MyApp app;
  app.configureAudio(48000, 512, 2, 0);
  app.start();
  return 0;
}
`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === OBJECT DEFINITIONS ===
  {
    id: 'object-sphere',
    name: 'Sphere',
    category: 'objects',
    subcategory: 'Primitives',
    type: 'object',
    description: 'Basic sphere primitive',
    tags: ['object', 'primitive', 'sphere', '3d'],
    objectDefinition: {
      id: 'sphere',
      name: 'Sphere',
      components: {
        mesh: { type: 'sphere', params: { radius: 1, slices: 32, stacks: 32 } },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
    },
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'object-cube',
    name: 'Cube',
    category: 'objects',
    subcategory: 'Primitives',
    type: 'object',
    description: 'Basic cube primitive',
    tags: ['object', 'primitive', 'cube', 'box', '3d'],
    objectDefinition: {
      id: 'cube',
      name: 'Cube',
      components: {
        mesh: { type: 'cube', params: { size: 1 } },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
    },
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'object-torus',
    name: 'Torus',
    category: 'objects',
    subcategory: 'Primitives',
    type: 'object',
    description: 'Torus (donut) primitive',
    tags: ['object', 'primitive', 'torus', 'donut', '3d'],
    objectDefinition: {
      id: 'torus',
      name: 'Torus',
      components: {
        mesh: { type: 'torus', params: { majorRadius: 1, minorRadius: 0.3, slices: 32, stacks: 16 } },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
    },
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === PLATONIC SOLIDS ===
  {
    id: 'object-tetrahedron',
    name: 'Tetrahedron',
    category: 'objects',
    subcategory: 'Platonic Solids',
    type: 'object',
    description: 'Four-faced platonic solid (4 triangles)',
    tags: ['object', 'primitive', 'tetrahedron', 'platonic', '3d'],
    objectDefinition: {
      id: 'tetrahedron',
      name: 'Tetrahedron',
      components: {
        mesh: { type: 'tetrahedron', params: { radius: 1 } },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
    },
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'object-octahedron',
    name: 'Octahedron',
    category: 'objects',
    subcategory: 'Platonic Solids',
    type: 'object',
    description: 'Eight-faced platonic solid (8 triangles)',
    tags: ['object', 'primitive', 'octahedron', 'platonic', '3d'],
    objectDefinition: {
      id: 'octahedron',
      name: 'Octahedron',
      components: {
        mesh: { type: 'octahedron', params: { radius: 1 } },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
    },
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'object-icosahedron',
    name: 'Icosahedron',
    category: 'objects',
    subcategory: 'Platonic Solids',
    type: 'object',
    description: 'Twenty-faced platonic solid (20 triangles)',
    tags: ['object', 'primitive', 'icosahedron', 'platonic', '3d'],
    objectDefinition: {
      id: 'icosahedron',
      name: 'Icosahedron',
      components: {
        mesh: { type: 'icosahedron', params: { radius: 1 } },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
    },
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'object-dodecahedron',
    name: 'Dodecahedron',
    category: 'objects',
    subcategory: 'Platonic Solids',
    type: 'object',
    description: 'Twelve-faced platonic solid (12 pentagons)',
    tags: ['object', 'primitive', 'dodecahedron', 'platonic', '3d'],
    objectDefinition: {
      id: 'dodecahedron',
      name: 'Dodecahedron',
      components: {
        mesh: { type: 'dodecahedron', params: { radius: 1 } },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
    },
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === MORE PRIMITIVES ===
  {
    id: 'object-cone',
    name: 'Cone',
    category: 'objects',
    subcategory: 'Primitives',
    type: 'object',
    description: 'Cone primitive with configurable radius and height',
    tags: ['object', 'primitive', 'cone', '3d'],
    objectDefinition: {
      id: 'cone',
      name: 'Cone',
      components: {
        mesh: { type: 'cone', params: { radius: 1, height: 2, slices: 32 } },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
    },
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'object-cylinder',
    name: 'Cylinder',
    category: 'objects',
    subcategory: 'Primitives',
    type: 'object',
    description: 'Cylinder primitive with configurable radius and height',
    tags: ['object', 'primitive', 'cylinder', '3d'],
    objectDefinition: {
      id: 'cylinder',
      name: 'Cylinder',
      components: {
        mesh: { type: 'cylinder', params: { radius: 1, height: 2, slices: 32 } },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
    },
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'object-disk',
    name: 'Disk',
    category: 'objects',
    subcategory: 'Primitives',
    type: 'object',
    description: 'Flat circular disk primitive',
    tags: ['object', 'primitive', 'disk', 'circle', '3d'],
    objectDefinition: {
      id: 'disk',
      name: 'Disk',
      components: {
        mesh: { type: 'disk', params: { radius: 1, slices: 32 } },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
    },
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'object-plane',
    name: 'Plane',
    category: 'objects',
    subcategory: 'Primitives',
    type: 'object',
    description: 'Flat rectangular plane primitive',
    tags: ['object', 'primitive', 'plane', 'quad', '3d'],
    objectDefinition: {
      id: 'plane',
      name: 'Plane',
      components: {
        mesh: { type: 'plane', params: { width: 2, height: 2, subdivisions: 1 } },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      },
    },
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === GLSL ES 3.0 SHADERS (from tutorials) ===
  {
    id: 'shader-uv-passthrough-vert',
    name: 'UV Passthrough Vertex',
    category: 'shaders',
    subcategory: 'Utility',
    type: 'shader',
    description: 'Basic vertex shader that passes UV coordinates to fragment shader',
    tags: ['shader', 'vertex', 'uv', 'utility', 'glsl'],
    content: `#version 300 es
precision highp float;
precision highp int;

layout(location = 0) in vec3 position;
layout(location = 2) in vec2 uv;
out vec2 vuv;

void main() {
  vuv = uv;
  gl_Position = vec4(position, 1.0);
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-composite-frag',
    name: 'Composite Blend',
    category: 'shaders',
    subcategory: 'Effects',
    type: 'shader',
    description: 'Simple texture blending shader for compositing feedback effects',
    tags: ['shader', 'fragment', 'composite', 'blend', 'feedback', 'glsl'],
    content: `#version 300 es
precision highp float;
precision highp int;

in vec2 vuv;
out vec4 fragColor;

uniform sampler2D tex0;
uniform float blend0;

void main() {
  vec4 color0 = texture(tex0, vuv) * blend0;
  fragColor = color0;
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-diffusion-frag',
    name: 'Diffusion',
    category: 'shaders',
    subcategory: 'Effects',
    type: 'shader',
    description: 'Diffusion effect using Laplacian texture sampling',
    tags: ['shader', 'fragment', 'diffusion', 'blur', 'feedback', 'glsl'],
    content: `#version 300 es
precision highp float;
precision highp int;

in vec2 vuv;
out vec4 fragColor;

uniform sampler2D tex;
uniform vec2 size;
uniform float dx;
uniform float dy;

void main() {
  float ddx = 1.0 / size.x * dx;
  float ddy = 1.0 / size.y * dy;

  vec4 color = texture(tex, vuv);
  vec4 L = texture(tex, vuv + vec2(0, -ddy))
         + texture(tex, vuv + vec2(-ddx, 0))
         - 4.0 * texture(tex, vuv)
         + texture(tex, vuv + vec2(ddx, 0))
         + texture(tex, vuv + vec2(0, ddy));

  color += L * 0.1;
  fragColor = color;
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-reaction-diffusion-frag',
    name: 'Reaction Diffusion',
    category: 'shaders',
    subcategory: 'Generative',
    type: 'shader',
    description: 'Gray-Scott reaction-diffusion pattern generator with mouse interaction',
    tags: ['shader', 'fragment', 'reaction-diffusion', 'generative', 'procedural', 'glsl'],
    content: `#version 300 es
precision highp float;
precision highp int;

in vec2 vuv;
out vec4 fragColor;

uniform vec2 size;
uniform vec2 brush;
uniform sampler2D tex;
uniform float dx;
uniform float dy;

void main() {
  float ddx = 1.0 / size.x * dx;
  float ddy = 1.0 / size.y * dy;
  float dt = 0.1;

  // Diffusion rates
  vec2 alpha = vec2(0.2097, 0.105);

  vec2 V = texture(tex, vuv).rg;
  vec4 L = texture(tex, vuv + vec2(0, -ddy))
         + texture(tex, vuv + vec2(-ddx, 0))
         - 4.0 * texture(tex, vuv)
         + texture(tex, vuv + vec2(ddx, 0))
         + texture(tex, vuv + vec2(0, ddy));

  V += L.rg * alpha * dt;

  // Gray-Scott parameters (pulse pattern)
  float F = 0.025;
  float K = 0.06;

  // Reaction
  float ABB = V.r * V.g * V.g;
  float rA = -ABB + F * (1.0 - V.r);
  float rB = ABB - (F + K) * V.g;

  vec2 R = vec2(rA, rB) * dt;
  vec2 RD = V + R;

  // Mouse input
  if (brush.x > 0.0) {
    vec2 diff = (vuv - brush) / vec2(ddx, ddy);
    float dist = dot(diff, diff);
    if (dist < 100.0) {
      RD.r = 0.0;
      RD.g = 0.9;
    }
  }

  fragColor = vec4(RD, 0.0, 1.0);
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-rd-colormap-frag',
    name: 'Reaction Diffusion Colormap',
    category: 'shaders',
    subcategory: 'Generative',
    type: 'shader',
    description: 'Colormap shader for reaction-diffusion output visualization',
    tags: ['shader', 'fragment', 'colormap', 'reaction-diffusion', 'visualization', 'glsl'],
    content: `#version 300 es
precision highp float;
precision highp int;

in vec2 vuv;
out vec4 fragColor;

uniform sampler2D tex;

void main() {
  vec4 value = texture(tex, vuv);
  float v = value.g;
  float a = 0.0;
  vec3 col = vec3(0.0);

  vec4 color1 = vec4(0.0, 0.0, 0.0, 0.0);
  vec4 color2 = vec4(1.0, 1.0, 1.0, 0.3);
  vec4 color3 = vec4(0.0, 1.0, 1.0, 0.35);
  vec4 color4 = vec4(0.0, 0.0, 1.0, 0.5);
  vec4 color5 = vec4(0.0, 0.0, 0.0, 0.6);

  if (v <= color1.a) {
    col = color1.rgb;
  } else if (v <= color2.a) {
    a = (v - color1.a) / (color2.a - color1.a);
    col = mix(color1.rgb, color2.rgb, a);
  } else if (v <= color3.a) {
    a = (v - color2.a) / (color3.a - color2.a);
    col = mix(color2.rgb, color3.rgb, a);
  } else if (v <= color4.a) {
    a = (v - color3.a) / (color4.a - color3.a);
    col = mix(color3.rgb, color4.rgb, a);
  } else if (v <= color5.a) {
    a = (v - color4.a) / (color5.a - color4.a);
    col = mix(color4.rgb, color5.rgb, a);
  } else {
    col = color5.rgb;
  }

  fragColor = vec4(col, 1.0);
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-raymarch-vert',
    name: 'Raymarching Vertex',
    category: 'shaders',
    subcategory: 'Raymarching',
    type: 'shader',
    description: 'Vertex shader for raymarching setup with stereo support',
    tags: ['shader', 'vertex', 'raymarching', 'sdf', 'glsl'],
    content: `#version 300 es
precision highp float;
precision highp int;

uniform mat4 al_ModelMatrixInv;
uniform mat4 al_ViewMatrixInv;
uniform mat4 al_ProjMatrixInv;
uniform float eye_sep;
uniform float foc_len;

layout(location = 0) in vec3 position;

out vec3 ray_dir, ray_origin;

void main() {
  gl_Position = vec4(position.xy, -1.0, 1.0);

  mat4 ivp = al_ModelMatrixInv * al_ViewMatrixInv * al_ProjMatrixInv;
  vec4 worldspace_near = ivp * vec4(position.xy, -1.0, 1.0);
  vec4 worldspace_far = worldspace_near + ivp[2];
  worldspace_far /= worldspace_far.w;
  worldspace_near /= worldspace_near.w;
  ray_dir = normalize(worldspace_far.xyz - worldspace_near.xyz);
  ray_origin = worldspace_near.xyz;

  // Stereo offset
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 rdx = cross(ray_dir, up);
  vec3 eye_x = rdx * eye_sep;
  ray_origin += eye_x;

  // Positive parallax
  ray_dir -= eye_x / foc_len;
  ray_dir = normalize(ray_dir);
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-raymarch-frag',
    name: 'Raymarching Fragment',
    category: 'shaders',
    subcategory: 'Raymarching',
    type: 'shader',
    description: 'Complete raymarching shader with SDF primitives and HSV coloring',
    tags: ['shader', 'fragment', 'raymarching', 'sdf', 'procedural', 'glsl'],
    content: `#version 300 es
precision highp float;
precision highp int;

uniform vec3 box_min, box_max;
uniform int max_steps;
uniform float step_size;
uniform float translucent;
uniform float time;

in vec3 ray_dir, ray_origin;
out vec4 frag_out0;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 rayBoxIntersect(const vec3 b_min, const vec3 b_max, const vec3 r_o, const vec3 r_d) {
  vec3 inv_dir = 1.0 / r_d;
  vec3 tbot = inv_dir * (b_min - r_o);
  vec3 ttop = inv_dir * (b_max - r_o);
  vec3 tmin = min(ttop, tbot);
  vec3 tmax = max(ttop, tbot);
  vec2 traverse = max(tmin.xx, tmin.yz);
  float traverse_low = max(traverse.x, traverse.y);
  traverse = min(tmax.xx, tmax.yz);
  float traverse_high = min(traverse.x, traverse.y);
  return vec3(float(traverse_high > max(traverse_low, 0.0)), traverse_low, traverse_high);
}

float sphereSDF(vec3 center, float radius, vec3 toPoint) {
  return length(center - toPoint) - radius;
}

float boxSDF(vec3 center, vec3 size, vec3 toPoint) {
  vec3 d = abs(center - toPoint) - size;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

float distfield(vec3 p) {
  float d1 = sphereSDF(vec3(-0.25, 0.0, 0.0), 0.25, p);
  float d2 = sphereSDF(vec3(0.25, 0.0, 0.0), 0.25, p);
  return min(d1, d2);
}

void main() {
  vec3 ro = ray_origin;
  vec3 rd = ray_dir;
  vec3 boxHit = rayBoxIntersect(box_min, box_max, ro, rd);
  vec4 rayColor = vec4(0.0);

  if (boxHit.x > 0.0) {
    float dist = boxHit.y;
    float dist_max = boxHit.z;
    vec3 box_inverse = 1.0 / box_max;

    for (int i = 0; i < 256; i++) {
      if (i >= max_steps || dist >= dist_max || rayColor.a >= 1.0) break;
      vec3 ray_pos = ro + rd * dist;
      ray_pos *= box_inverse;

      float d = distfield(ray_pos);
      float amt = 1.0 - smoothstep(0.0, 0.5, d);
      vec3 rgb = hsv2rgb(vec3(amt, 1.0, amt));

      rayColor.rgb += (1.0 - translucent + amt) * rgb * step_size;
      rayColor.a += (1.0 - translucent + amt) * amt * step_size;
      dist += step_size;
    }
  }

  frag_out0 = rayColor;
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === LYGIA-STYLE SHADER UTILITIES ===
  {
    id: 'shader-util-simplex2d',
    name: 'Simplex Noise 2D',
    category: 'shaders',
    subcategory: 'Noise',
    type: 'shader',
    description: '2D Simplex noise function for procedural textures and effects',
    tags: ['shader', 'noise', 'simplex', 'procedural', 'glsl', 'utility'],
    content: `// 2D Simplex Noise (GLSL ES 3.0)
// Include in your fragment shader

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Usage: float n = snoise(uv * 10.0);`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-util-simplex3d',
    name: 'Simplex Noise 3D',
    category: 'shaders',
    subcategory: 'Noise',
    type: 'shader',
    description: '3D Simplex noise function for volumetric effects',
    tags: ['shader', 'noise', 'simplex', '3d', 'procedural', 'glsl', 'utility'],
    content: `// 3D Simplex Noise (GLSL ES 3.0)
// Include in your fragment shader

vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 mod289_3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise3(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289_3(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Usage: float n = snoise3(vec3(uv * 5.0, time));`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-util-fbm',
    name: 'Fractal Brownian Motion',
    category: 'shaders',
    subcategory: 'Noise',
    type: 'shader',
    description: 'FBM (layered noise) for natural-looking textures',
    tags: ['shader', 'noise', 'fbm', 'fractal', 'procedural', 'glsl', 'utility'],
    content: `// Fractal Brownian Motion (GLSL ES 3.0)
// Requires snoise() function from Simplex Noise 2D

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value;
}

// Turbulence (absolute value FBM)
float turbulence(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * abs(snoise(p * frequency));
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value;
}

// Domain warping
vec2 warp(vec2 p, float strength) {
  float n1 = snoise(p);
  float n2 = snoise(p + vec2(5.2, 1.3));
  return p + strength * vec2(n1, n2);
}

// Usage:
// float n = fbm(uv * 4.0, 6);
// float t = turbulence(uv * 4.0, 5);
// vec2 warped = warp(uv, 0.3);`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-util-voronoi',
    name: 'Voronoi Noise',
    category: 'shaders',
    subcategory: 'Noise',
    type: 'shader',
    description: 'Voronoi/Worley cellular noise for organic patterns',
    tags: ['shader', 'noise', 'voronoi', 'worley', 'cellular', 'procedural', 'glsl', 'utility'],
    content: `// Voronoi/Worley Noise (GLSL ES 3.0)

vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)),
                        dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

// Returns vec3(distance to closest, distance to second closest, cell id)
vec3 voronoi(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);

  float md = 8.0;
  float md2 = 8.0;
  vec2 mr;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      vec2 r = g + o - f;
      float d = dot(r, r);

      if (d < md) {
        md2 = md;
        md = d;
        mr = r;
      } else if (d < md2) {
        md2 = d;
      }
    }
  }

  return vec3(sqrt(md), sqrt(md2), dot(n + mr, vec2(1.0, 57.0)));
}

// Edge distance
float voronoiEdge(vec2 p) {
  vec3 v = voronoi(p);
  return v.y - v.x;
}

// Usage:
// vec3 v = voronoi(uv * 8.0);
// float cells = v.x;           // Distance to cell center
// float edges = voronoiEdge(uv * 8.0);`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-util-sdf-primitives',
    name: 'SDF Primitives',
    category: 'shaders',
    subcategory: 'SDF',
    type: 'shader',
    description: 'Signed Distance Functions for common 3D shapes',
    tags: ['shader', 'sdf', 'distance', 'raymarching', 'primitives', 'glsl', 'utility'],
    content: `// SDF Primitives (GLSL ES 3.0)

// Sphere
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

// Box
float sdBox(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

// Round Box
float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 d = abs(p) - b;
  return length(max(d, 0.0)) - r + min(max(d.x, max(d.y, d.z)), 0.0);
}

// Torus
float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

// Cylinder
float sdCylinder(vec3 p, float h, float r) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// Cone
float sdCone(vec3 p, vec2 c, float h) {
  vec2 q = h * vec2(c.x / c.y, -1.0);
  vec2 w = vec2(length(p.xz), p.y);
  vec2 a = w - q * clamp(dot(w, q) / dot(q, q), 0.0, 1.0);
  vec2 b = w - q * vec2(clamp(w.x / q.x, 0.0, 1.0), 1.0);
  float k = sign(q.y);
  float d = min(dot(a, a), dot(b, b));
  float s = max(k * (w.x * q.y - w.y * q.x), k * (w.y - q.y));
  return sqrt(d) * sign(s);
}

// Plane
float sdPlane(vec3 p, vec3 n, float h) {
  return dot(p, n) + h;
}

// Capsule
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-util-sdf-operations',
    name: 'SDF Operations',
    category: 'shaders',
    subcategory: 'SDF',
    type: 'shader',
    description: 'Boolean and smooth operations for combining SDFs',
    tags: ['shader', 'sdf', 'boolean', 'smooth', 'operations', 'glsl', 'utility'],
    content: `// SDF Operations (GLSL ES 3.0)

// Boolean operations
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtract(float d1, float d2) { return max(-d1, d2); }
float opIntersect(float d1, float d2) { return max(d1, d2); }

// Smooth operations
float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

float opSmoothSubtract(float d1, float d2, float k) {
  float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
  return mix(d2, -d1, h) + k * h * (1.0 - h);
}

float opSmoothIntersect(float d1, float d2, float k) {
  float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) + k * h * (1.0 - h);
}

// Repetition
vec3 opRepeat(vec3 p, vec3 c) {
  return mod(p + 0.5 * c, c) - 0.5 * c;
}

// Limited repetition
vec3 opRepeatLim(vec3 p, float c, vec3 lim) {
  return p - c * clamp(round(p / c), -lim, lim);
}

// Twist
vec3 opTwist(vec3 p, float k) {
  float c = cos(k * p.y);
  float s = sin(k * p.y);
  mat2 m = mat2(c, -s, s, c);
  return vec3(m * p.xz, p.y);
}

// Bend
vec3 opBend(vec3 p, float k) {
  float c = cos(k * p.x);
  float s = sin(k * p.x);
  mat2 m = mat2(c, -s, s, c);
  return vec3(m * p.xy, p.z);
}

// Displacement
float opDisplace(float d, vec3 p, float amt) {
  return d + amt * sin(20.0 * p.x) * sin(20.0 * p.y) * sin(20.0 * p.z);
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-util-color',
    name: 'Color Utilities',
    category: 'shaders',
    subcategory: 'Color',
    type: 'shader',
    description: 'Color space conversions and palette functions',
    tags: ['shader', 'color', 'hsv', 'rgb', 'palette', 'glsl', 'utility'],
    content: `// Color Utilities (GLSL ES 3.0)

// HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// RGB to HSV
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// Cosine palette (by Inigo Quilez)
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

// Predefined palettes
vec3 paletteRainbow(float t) {
  return palette(t, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
}

vec3 paletteSunset(float t) {
  return palette(t, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                 vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
}

vec3 paletteOcean(float t) {
  return palette(t, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                 vec3(1.0, 1.0, 1.0), vec3(0.3, 0.2, 0.2));
}

// Blend modes
vec3 blendMultiply(vec3 base, vec3 blend) { return base * blend; }
vec3 blendScreen(vec3 base, vec3 blend) { return 1.0 - (1.0 - base) * (1.0 - blend); }
vec3 blendOverlay(vec3 base, vec3 blend) {
  return mix(2.0 * base * blend, 1.0 - 2.0 * (1.0 - base) * (1.0 - blend), step(0.5, base));
}
vec3 blendSoftLight(vec3 base, vec3 blend) {
  return mix(2.0 * base * blend + base * base * (1.0 - 2.0 * blend),
             sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend),
             step(0.5, blend));
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'shader-util-math',
    name: 'Math Utilities',
    category: 'shaders',
    subcategory: 'Math',
    type: 'shader',
    description: 'Common math functions for shaders',
    tags: ['shader', 'math', 'rotate', 'remap', 'easing', 'glsl', 'utility'],
    content: `// Math Utilities (GLSL ES 3.0)

#define PI 3.14159265359
#define TAU 6.28318530718
#define PHI 1.61803398875

// Remap value from one range to another
float remap(float value, float inMin, float inMax, float outMin, float outMax) {
  return outMin + (outMax - outMin) * (value - inMin) / (inMax - inMin);
}

// Smooth minimum
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// 2D rotation matrix
mat2 rotate2D(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

// 3D rotation around X axis
mat3 rotateX(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

// 3D rotation around Y axis
mat3 rotateY(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}

// 3D rotation around Z axis
mat3 rotateZ(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}

// Easing functions
float easeInQuad(float t) { return t * t; }
float easeOutQuad(float t) { return t * (2.0 - t); }
float easeInOutQuad(float t) { return t < 0.5 ? 2.0 * t * t : -1.0 + (4.0 - 2.0 * t) * t; }
float easeInCubic(float t) { return t * t * t; }
float easeOutCubic(float t) { float t1 = t - 1.0; return t1 * t1 * t1 + 1.0; }
float easeInOutCubic(float t) { return t < 0.5 ? 4.0 * t * t * t : (t - 1.0) * (2.0 * t - 2.0) * (2.0 * t - 2.0) + 1.0; }
float easeInElastic(float t) { return sin(13.0 * PI * 0.5 * t) * pow(2.0, 10.0 * (t - 1.0)); }
float easeOutElastic(float t) { return sin(-13.0 * PI * 0.5 * (t + 1.0)) * pow(2.0, -10.0 * t) + 1.0; }
float easeOutBounce(float t) {
  if (t < 1.0 / 2.75) return 7.5625 * t * t;
  else if (t < 2.0 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
  else if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
  else { t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375; }
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === ADDITIONAL CODE SNIPPETS ===
  {
    id: 'snippet-plucked-string',
    name: 'Plucked String (Karplus-Strong)',
    category: 'snippets',
    subcategory: 'Synths',
    type: 'snippet',
    description: 'Karplus-Strong plucked string synthesis with noise burst and delay line',
    tags: ['synth', 'plucked', 'karplus-strong', 'physical', 'voice', 'audio'],
    content: `class PluckedString : public al::SynthVoice {
public:
  gam::NoiseWhite<> noise;
  gam::Decay<> env;
  gam::MovingAvg<> fil{2};
  gam::Delay<float, gam::ipl::Trunc> delay;
  gam::ADSR<> ampEnv;
  float mAmp = 0.5f;

  void init() override {
    createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
    createInternalTriggerParameter("frequency", 220, 20, 2000);
    createInternalTriggerParameter("decay", 0.995, 0.9, 0.999);
    createInternalTriggerParameter("brightness", 0.5, 0.0, 1.0);

    env.decay(0.1f);
    delay.maxDelay(1.0f / 27.5f);
    ampEnv.levels(0, 1, 1, 0);
  }

  float operator()() {
    return delay(fil(delay() + noise() * env()));
  }

  void onProcess(al::AudioIOData& io) override {
    while (io()) {
      float s = (*this)() * ampEnv() * mAmp;
      io.out(0) += s;
      io.out(1) += s;
    }
    if (ampEnv.done()) free();
  }

  void onTriggerOn() override {
    mAmp = getInternalParameterValue("amplitude");
    float freq = getInternalParameterValue("frequency");
    delay.freq(freq);
    delay.zero();
    env.reset();
    ampEnv.attack(0.001f);
    ampEnv.decay(0.01f);
    ampEnv.sustain(0.8f);
    ampEnv.release(getInternalParameterValue("decay") * 5.0f);
    ampEnv.reset();
  }

  void onTriggerOff() override {
    ampEnv.release();
  }
};`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-noise-synth',
    name: 'Noise Synth with Filter',
    category: 'snippets',
    subcategory: 'Synths',
    type: 'snippet',
    description: 'Filtered noise synthesizer for percussive and textural sounds',
    tags: ['synth', 'noise', 'filter', 'percussion', 'voice', 'audio'],
    content: `class NoiseSynth : public al::SynthVoice {
public:
  gam::NoisePink<> noise;
  gam::Biquad<> filter;
  gam::ADSR<> ampEnv, filterEnv;

  void init() override {
    createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
    createInternalTriggerParameter("cutoff", 2000, 100, 10000);
    createInternalTriggerParameter("resonance", 0.5, 0.0, 1.0);
    createInternalTriggerParameter("filterEnvAmount", 0.5, 0.0, 1.0);
    createInternalTriggerParameter("attackTime", 0.01, 0.001, 1.0);
    createInternalTriggerParameter("releaseTime", 0.3, 0.01, 2.0);

    filter.type(gam::LOW_PASS);
  }

  void onProcess(al::AudioIOData& io) override {
    float cutoff = getInternalParameterValue("cutoff");
    float envAmt = getInternalParameterValue("filterEnvAmount");
    float res = getInternalParameterValue("resonance");

    while (io()) {
      float filteredCutoff = cutoff * (1.0f + envAmt * filterEnv());
      filter.freq(std::min(filteredCutoff, 20000.0f));
      filter.res(res * 4.0f);

      float s = filter(noise()) * ampEnv() * getInternalParameterValue("amplitude");
      io.out(0) += s;
      io.out(1) += s;
    }
    if (ampEnv.done()) free();
  }

  void onTriggerOn() override {
    float attack = getInternalParameterValue("attackTime");
    float release = getInternalParameterValue("releaseTime");

    ampEnv.attack(attack);
    ampEnv.decay(0.1f);
    ampEnv.sustain(0.5f);
    ampEnv.release(release);
    ampEnv.reset();

    filterEnv.attack(attack * 0.5f);
    filterEnv.decay(0.2f);
    filterEnv.sustain(0.0f);
    filterEnv.release(release);
    filterEnv.reset();
  }

  void onTriggerOff() override {
    ampEnv.release();
    filterEnv.release();
  }
};`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-spectrum-analyzer',
    name: 'Spectrum Analyzer',
    category: 'snippets',
    subcategory: 'Visualization',
    type: 'snippet',
    description: 'Real-time FFT spectrum analyzer with visual display',
    tags: ['visualization', 'fft', 'spectrum', 'audio', 'analysis'],
    content: `// Add to includes:
#include "Gamma/DFT.h"

// Add to class members:
#define FFT_SIZE 4096
gam::STFT stft = gam::STFT(FFT_SIZE, FFT_SIZE / 4, 0, gam::HANN, gam::MAG_FREQ);
std::vector<float> spectrum;
al::Mesh spectrumMesh;

// In onCreate():
spectrum.resize(FFT_SIZE / 2 + 1);
spectrumMesh.primitive(al::Mesh::LINE_STRIP);

// In onSound() - after your audio processing:
while (io()) {
  float sample = io.out(0);  // or mix of channels
  if (stft(sample)) {
    for (unsigned k = 0; k < stft.numBins(); ++k) {
      spectrum[k] = tanh(pow(stft.bin(k).real(), 1.3));
    }
  }
}

// In onDraw():
spectrumMesh.reset();
for (int i = 0; i < FFT_SIZE / 2; i++) {
  float x = float(i) / (FFT_SIZE / 2) * 10.0f - 5.0f;  // -5 to 5
  float y = spectrum[i] * 5.0f;  // Scale height
  spectrumMesh.vertex(x, y, 0);
  spectrumMesh.color(al::HSV(0.6f - spectrum[i] * 0.5f, 0.8f, 0.9f));
}
g.meshColor();
g.draw(spectrumMesh);`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-audio-reactive-mesh',
    name: 'Audio-Reactive Mesh',
    category: 'snippets',
    subcategory: 'Visualization',
    type: 'snippet',
    description: 'Mesh that responds to audio amplitude and frequency content',
    tags: ['visualization', 'audio', 'reactive', 'mesh', 'graphics'],
    content: `// Add to class members:
al::Mesh mesh;
gam::EnvFollow<> envFollow;
float audioLevel = 0;
float smoothedLevel = 0;

// In onCreate():
al::addSphere(mesh, 1.0, 32, 32);
mesh.decompress();  // Enable per-vertex manipulation
mesh.generateNormals();
envFollow.lag(0.1f);  // Smoothing factor

// In onSound():
while (io()) {
  float s = (io.out(0) + io.out(1)) * 0.5f;
  audioLevel = envFollow(fabs(s));
}

// In onAnimate(dt):
smoothedLevel += (audioLevel - smoothedLevel) * 0.1f;

// In onDraw(g):
g.pushMatrix();

// Scale based on audio
float scale = 1.0f + smoothedLevel * 2.0f;
g.scale(scale);

// Color based on audio level
al::Color color = al::HSV(smoothedLevel * 0.3f, 0.8f, 0.5f + smoothedLevel * 0.5f);
g.color(color);

// Deform vertices based on audio (optional)
// for (int i = 0; i < mesh.vertices().size(); i++) {
//   al::Vec3f& v = mesh.vertices()[i];
//   float noise = sin(v.x * 10.0f + time) * smoothedLevel * 0.2f;
//   v = v.normalized() * (1.0f + noise);
// }

g.draw(mesh);
g.popMatrix();`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-fbo-feedback',
    name: 'FBO Feedback Loop',
    category: 'snippets',
    subcategory: 'Graphics',
    type: 'snippet',
    description: 'Framebuffer feedback for trails and echo effects',
    tags: ['graphics', 'fbo', 'feedback', 'trails', 'effect'],
    content: `// Add to class members:
al::EasyFBO fbo;
al::Mesh quad;
float feedbackAmount = 0.95f;

// In onCreate():
// Initialize FBO with window size
fbo.init(width(), height());

// Create fullscreen quad
quad.primitive(al::Mesh::TRIANGLE_STRIP);
quad.vertex(-1, -1);
quad.texCoord(0, 0);
quad.vertex(1, -1);
quad.texCoord(1, 0);
quad.vertex(-1, 1);
quad.texCoord(0, 1);
quad.vertex(1, 1);
quad.texCoord(1, 1);

// In onDraw(g):
// Bind FBO
fbo.begin(g);

// Draw previous frame with fade
g.pushMatrix();
g.loadIdentity();
g.depthTesting(false);
g.blending(true);
g.blendTrans();
fbo.tex().bind();
g.color(feedbackAmount, feedbackAmount, feedbackAmount);
g.draw(quad);
fbo.tex().unbind();
g.popMatrix();

// Draw your scene content here
g.depthTesting(true);
// ... your drawing code ...

fbo.end(g);

// Draw FBO to screen
g.clear();
fbo.tex().bind();
g.color(1);
g.draw(quad);
fbo.tex().unbind();`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-trail-renderer',
    name: 'Trail Renderer',
    category: 'snippets',
    subcategory: 'Graphics',
    type: 'snippet',
    description: 'Motion trail effect for moving objects',
    tags: ['graphics', 'trail', 'motion', 'effect', 'animation'],
    content: `// Trail renderer using a history buffer

struct TrailPoint {
  al::Vec3f position;
  al::Color color;
  float age;
};

class Trail {
public:
  std::deque<TrailPoint> points;
  al::Mesh mesh;
  int maxPoints = 100;
  float lifetime = 2.0f;

  void init() {
    mesh.primitive(al::Mesh::LINE_STRIP);
  }

  void addPoint(al::Vec3f pos, al::Color col) {
    points.push_front({pos, col, 0.0f});
    if (points.size() > maxPoints) {
      points.pop_back();
    }
  }

  void update(float dt) {
    for (auto& p : points) {
      p.age += dt;
    }
    // Remove old points
    while (!points.empty() && points.back().age > lifetime) {
      points.pop_back();
    }
  }

  void draw(al::Graphics& g) {
    mesh.reset();
    for (const auto& p : points) {
      float alpha = 1.0f - (p.age / lifetime);
      mesh.vertex(p.position);
      mesh.color(p.color.r, p.color.g, p.color.b, alpha);
    }
    g.blending(true);
    g.blendTrans();
    g.meshColor();
    g.draw(mesh);
  }
};

// Usage:
// Trail trail;
// trail.init();
// In onAnimate: trail.addPoint(objectPosition, color); trail.update(dt);
// In onDraw: trail.draw(g);`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-easing-functions-cpp',
    name: 'Easing Functions (C++)',
    category: 'snippets',
    subcategory: 'Utilities',
    type: 'snippet',
    description: 'Common easing functions for smooth animations',
    tags: ['utility', 'easing', 'animation', 'interpolation'],
    content: `namespace easing {
  // Linear
  inline float linear(float t) { return t; }

  // Quadratic
  inline float inQuad(float t) { return t * t; }
  inline float outQuad(float t) { return t * (2.0f - t); }
  inline float inOutQuad(float t) {
    return t < 0.5f ? 2.0f * t * t : -1.0f + (4.0f - 2.0f * t) * t;
  }

  // Cubic
  inline float inCubic(float t) { return t * t * t; }
  inline float outCubic(float t) { float t1 = t - 1.0f; return t1 * t1 * t1 + 1.0f; }
  inline float inOutCubic(float t) {
    return t < 0.5f ? 4.0f * t * t * t : (t - 1.0f) * (2.0f * t - 2.0f) * (2.0f * t - 2.0f) + 1.0f;
  }

  // Exponential
  inline float inExpo(float t) { return t == 0.0f ? 0.0f : pow(2.0f, 10.0f * (t - 1.0f)); }
  inline float outExpo(float t) { return t == 1.0f ? 1.0f : 1.0f - pow(2.0f, -10.0f * t); }

  // Elastic
  inline float outElastic(float t) {
    const float c4 = (2.0f * M_PI) / 3.0f;
    return t == 0.0f ? 0.0f : t == 1.0f ? 1.0f :
           pow(2.0f, -10.0f * t) * sin((t * 10.0f - 0.75f) * c4) + 1.0f;
  }

  // Bounce
  inline float outBounce(float t) {
    const float n1 = 7.5625f;
    const float d1 = 2.75f;
    if (t < 1.0f / d1) return n1 * t * t;
    if (t < 2.0f / d1) { t -= 1.5f / d1; return n1 * t * t + 0.75f; }
    if (t < 2.5f / d1) { t -= 2.25f / d1; return n1 * t * t + 0.9375f; }
    t -= 2.625f / d1;
    return n1 * t * t + 0.984375f;
  }

  // Back (overshoot)
  inline float inBack(float t) {
    const float c1 = 1.70158f;
    return t * t * ((c1 + 1.0f) * t - c1);
  }
  inline float outBack(float t) {
    const float c1 = 1.70158f;
    t -= 1.0f;
    return t * t * ((c1 + 1.0f) * t + c1) + 1.0f;
  }
}

// Usage: float value = easing::outElastic(t);`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'snippet-midi-to-freq',
    name: 'MIDI to Frequency',
    category: 'snippets',
    subcategory: 'Utilities',
    type: 'snippet',
    description: 'Convert MIDI note numbers to frequencies with tuning options',
    tags: ['utility', 'midi', 'frequency', 'tuning', 'music'],
    content: `// MIDI to Frequency utilities

// Standard 12-TET conversion (A4 = 440 Hz)
inline float midiToFreq(int midiNote, float a4Freq = 440.0f) {
  return a4Freq * pow(2.0f, (midiNote - 69) / 12.0f);
}

// Frequency to MIDI (returns float for pitch bend)
inline float freqToMidi(float freq, float a4Freq = 440.0f) {
  return 69.0f + 12.0f * log2(freq / a4Freq);
}

// Just intonation ratios (relative to root)
const float justRatios[12] = {
  1.0f,       // Unison
  16.0f/15.0f, // Minor 2nd
  9.0f/8.0f,   // Major 2nd
  6.0f/5.0f,   // Minor 3rd
  5.0f/4.0f,   // Major 3rd
  4.0f/3.0f,   // Perfect 4th
  45.0f/32.0f, // Tritone
  3.0f/2.0f,   // Perfect 5th
  8.0f/5.0f,   // Minor 6th
  5.0f/3.0f,   // Major 6th
  9.0f/5.0f,   // Minor 7th
  15.0f/8.0f   // Major 7th
};

// Just intonation conversion
inline float midiToFreqJust(int midiNote, int rootNote = 60, float rootFreq = 261.63f) {
  int octave = (midiNote - rootNote) / 12;
  int degree = ((midiNote - rootNote) % 12 + 12) % 12;
  return rootFreq * justRatios[degree] * pow(2.0f, octave);
}

// Note name from MIDI number
inline const char* midiNoteName(int midiNote) {
  static const char* names[] = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
  return names[midiNote % 12];
}

inline int midiNoteOctave(int midiNote) {
  return (midiNote / 12) - 1;
}`,
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === ENVIRONMENT ASSETS (CC0 - Local Files) ===
  {
    id: 'env-studio-small',
    name: 'Studio Small',
    category: 'environments',
    subcategory: 'Studio',
    type: 'environment',
    description: 'Small photography studio with soft lighting',
    tags: ['environment', 'hdri', 'studio', 'lighting', 'indoor', 'essential'],
    localPath: '/assets/environments/studio_small_09_1k.hdr',
    downloadUrl: 'https://polyhaven.com/a/studio_small_09',
    license: 'CC0',
    resolution: '1K',
    fileSize: '1.5 MB',
    fileSizeBytes: 1615248,
    preload: true,
    priority: 'high',
    loadingState: 'idle',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'env-sunset-field',
    name: 'Sunset Field',
    category: 'environments',
    subcategory: 'Outdoor',
    type: 'environment',
    description: 'Golden hour sunset over an open field',
    tags: ['environment', 'hdri', 'sunset', 'outdoor', 'nature'],
    localPath: '/assets/environments/kloofendal_48d_partly_cloudy_puresky_1k.hdr',
    downloadUrl: 'https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky',
    license: 'CC0',
    resolution: '1K',
    fileSize: '1.4 MB',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'env-night-sky',
    name: 'Night Sky',
    category: 'environments',
    subcategory: 'Outdoor',
    type: 'environment',
    description: 'Clear night sky with stars',
    tags: ['environment', 'hdri', 'night', 'stars', 'outdoor'],
    localPath: '/assets/environments/kloppenheim_02_puresky_1k.hdr',
    downloadUrl: 'https://polyhaven.com/a/kloppenheim_02_puresky',
    license: 'CC0',
    resolution: '1K',
    fileSize: '1.3 MB',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'env-overcast',
    name: 'Overcast Sky',
    category: 'environments',
    subcategory: 'Outdoor',
    type: 'environment',
    description: 'Soft diffused lighting from gray pier',
    tags: ['environment', 'hdri', 'overcast', 'clouds', 'outdoor'],
    localPath: '/assets/environments/gray_pier_1k.hdr',
    downloadUrl: 'https://polyhaven.com/a/gray_pier',
    license: 'CC0',
    resolution: '1K',
    fileSize: '1.5 MB',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'env-forest',
    name: 'Forest Clearing',
    category: 'environments',
    subcategory: 'Outdoor',
    type: 'environment',
    description: 'Dappled light through forest canopy',
    tags: ['environment', 'hdri', 'forest', 'nature', 'outdoor'],
    localPath: '/assets/environments/forest_slope_1k.hdr',
    downloadUrl: 'https://polyhaven.com/a/forest_slope',
    license: 'CC0',
    resolution: '1K',
    fileSize: '1.8 MB',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'env-urban-street',
    name: 'Urban Street',
    category: 'environments',
    subcategory: 'Outdoor',
    type: 'environment',
    description: 'City street with buildings',
    tags: ['environment', 'hdri', 'urban', 'city', 'street'],
    localPath: '/assets/environments/urban_street_04_1k.hdr',
    downloadUrl: 'https://polyhaven.com/a/urban_street_04',
    license: 'CC0',
    resolution: '1K',
    fileSize: '1.6 MB',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'env-warehouse',
    name: 'Industrial Warehouse',
    category: 'environments',
    subcategory: 'Interior',
    type: 'environment',
    description: 'Large industrial space with skylights',
    tags: ['environment', 'hdri', 'warehouse', 'industrial', 'indoor'],
    localPath: '/assets/environments/empty_warehouse_01_1k.hdr',
    downloadUrl: 'https://polyhaven.com/a/empty_warehouse_01',
    license: 'CC0',
    resolution: '1K',
    fileSize: '1.6 MB',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'env-museum',
    name: 'Museum Hall',
    category: 'environments',
    subcategory: 'Interior',
    type: 'environment',
    description: 'Museum interior with even lighting',
    tags: ['environment', 'hdri', 'museum', 'gallery', 'indoor'],
    localPath: '/assets/environments/museum_of_ethnography_1k.hdr',
    downloadUrl: 'https://polyhaven.com/a/museum_of_ethnography',
    license: 'CC0',
    resolution: '1K',
    fileSize: '1.6 MB',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === MESH ASSETS (CC0 - Local Files) ===
  {
    id: 'mesh-stanford-bunny',
    name: 'Stanford Bunny',
    category: 'meshes',
    subcategory: 'Classic',
    type: 'mesh',
    description: 'Classic Stanford bunny test model - the iconic CG benchmark since 1994',
    tags: ['mesh', '3d', 'bunny', 'classic', 'test', 'stanford', 'essential'],
    localPath: '/assets/meshes/bunny.obj',
    downloadUrl: 'https://graphics.stanford.edu/~mdfisher/Data/Meshes/bunny.obj',
    license: 'CC0',
    fileSize: '201 KB',
    fileSizeBytes: 205917,
    preload: false,
    priority: 'normal',
    loadingState: 'idle',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'mesh-utah-teapot',
    name: 'Utah Teapot',
    category: 'meshes',
    subcategory: 'Classic',
    type: 'mesh',
    description: 'The iconic Utah teapot - hello world of 3D graphics since 1975',
    tags: ['mesh', '3d', 'teapot', 'classic', 'test', 'utah'],
    localPath: '/assets/meshes/teapot.obj',
    downloadUrl: 'https://graphics.stanford.edu/courses/cs148-10-summer/as3/code/as3/teapot.obj',
    license: 'CC0',
    fileSize: '206 KB',
    fileSizeBytes: 210614,
    preload: false,
    priority: 'normal',
    loadingState: 'idle',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'mesh-suzanne',
    name: 'Suzanne (Blender Monkey)',
    category: 'meshes',
    subcategory: 'Classic',
    type: 'mesh',
    description: 'Blender mascot monkey head - the Blender community icon',
    tags: ['mesh', '3d', 'monkey', 'blender', 'test', 'suzanne'],
    localPath: '/assets/meshes/suzanne.obj',
    downloadUrl: 'https://github.com/alecjacobson/common-3d-test-models',
    license: 'CC0',
    fileSize: '48 KB',
    fileSizeBytes: 49137,
    preload: false,
    priority: 'normal',
    loadingState: 'idle',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'mesh-spot-cow',
    name: 'Spot (Cow)',
    category: 'meshes',
    subcategory: 'Classic',
    type: 'mesh',
    description: 'Spot the cow - classic CG test model with detailed geometry',
    tags: ['mesh', '3d', 'cow', 'classic', 'test', 'spot'],
    localPath: '/assets/meshes/spot.obj',
    downloadUrl: 'https://github.com/alecjacobson/common-3d-test-models',
    license: 'CC0',
    fileSize: '323 KB',
    fileSizeBytes: 330624,
    preload: false,
    priority: 'low',
    loadingState: 'idle',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // === TEXTURE ASSETS (Procedural & PBR) ===

  // --- Procedural Textures (Generated at runtime) ---
  {
    id: 'texture-perlin-noise',
    name: 'Perlin Noise',
    category: 'textures',
    subcategory: 'Procedural',
    type: 'texture',
    description: 'Classic Perlin noise texture - generates at runtime with customizable parameters',
    tags: ['texture', 'procedural', 'noise', 'perlin', 'organic'],
    content: `// Generate Perlin noise texture at runtime
ProceduralTexture noise;
noise.perlinNoise(512, 512, 4.0f, 4, 0.5f);
noise.uploadToTexture(myTexture.id());`,
    license: 'CC0',
    resolution: 'Configurable',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'texture-worley-noise',
    name: 'Worley Noise (Cellular)',
    category: 'textures',
    subcategory: 'Procedural',
    type: 'texture',
    description: 'Cellular/Voronoi noise texture - great for organic patterns, cracks, and cells',
    tags: ['texture', 'procedural', 'noise', 'worley', 'cellular', 'voronoi'],
    content: `// Generate Worley/cellular noise texture
ProceduralTexture noise;
noise.worleyNoise(512, 512, 32, WorleyMode::F1);
noise.uploadToTexture(myTexture.id());`,
    license: 'CC0',
    resolution: 'Configurable',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'texture-checkerboard',
    name: 'Checkerboard',
    category: 'textures',
    subcategory: 'Procedural',
    type: 'texture',
    description: 'Classic checkerboard pattern - useful for UV debugging and stylized rendering',
    tags: ['texture', 'procedural', 'pattern', 'checkerboard', 'debug', 'uv'],
    content: `// Generate checkerboard pattern
ProceduralTexture checker;
checker.checkerboard(512, 512, 64, Color(1,1,1), Color(0,0,0));
checker.uploadToTexture(myTexture.id());`,
    license: 'CC0',
    resolution: 'Configurable',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'texture-brick-procedural',
    name: 'Procedural Bricks',
    category: 'textures',
    subcategory: 'Procedural',
    type: 'texture',
    description: 'Procedural brick wall pattern with customizable brick and mortar sizes',
    tags: ['texture', 'procedural', 'pattern', 'brick', 'wall', 'architectural'],
    content: `// Generate brick pattern with PBR maps
ProceduralTexture albedo, normal, roughness, ao;
ProceduralPresets::generateBrickPBR(albedo, normal, roughness, ao, 512);

// Upload all maps
albedo.uploadToTexture(albedoTex.id());
normal.uploadToTexture(normalTex.id());
roughness.uploadToTexture(roughnessTex.id());
ao.uploadToTexture(aoTex.id());`,
    license: 'CC0',
    resolution: 'Configurable',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'texture-wood-procedural',
    name: 'Procedural Wood',
    category: 'textures',
    subcategory: 'Procedural',
    type: 'texture',
    description: 'Procedural wood grain texture with realistic ring patterns',
    tags: ['texture', 'procedural', 'pattern', 'wood', 'grain', 'natural'],
    content: `// Generate wood grain with PBR maps
ProceduralTexture albedo, normal, roughness;
ProceduralPresets::generateWoodPBR(albedo, normal, roughness, 512);

albedo.uploadToTexture(albedoTex.id());
normal.uploadToTexture(normalTex.id());
roughness.uploadToTexture(roughnessTex.id());`,
    license: 'CC0',
    resolution: 'Configurable',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'texture-marble-procedural',
    name: 'Procedural Marble',
    category: 'textures',
    subcategory: 'Procedural',
    type: 'texture',
    description: 'Procedural marble texture with veins and turbulence',
    tags: ['texture', 'procedural', 'pattern', 'marble', 'stone', 'natural'],
    content: `// Generate marble with PBR maps
ProceduralTexture albedo, normal, roughness;
ProceduralPresets::generateMarblePBR(albedo, normal, roughness, 512);

albedo.uploadToTexture(albedoTex.id());
normal.uploadToTexture(normalTex.id());
roughness.uploadToTexture(roughnessTex.id());`,
    license: 'CC0',
    resolution: 'Configurable',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'texture-metal-procedural',
    name: 'Procedural Metal',
    category: 'textures',
    subcategory: 'Procedural',
    type: 'texture',
    description: 'Procedural scratched metal texture with wear patterns',
    tags: ['texture', 'procedural', 'pattern', 'metal', 'scratched', 'industrial'],
    content: `// Generate scratched metal with PBR maps
ProceduralTexture albedo, normal, roughness, metallic;
ProceduralPresets::generateMetalPBR(albedo, normal, roughness, metallic, 512);

albedo.uploadToTexture(albedoTex.id());
normal.uploadToTexture(normalTex.id());
roughness.uploadToTexture(roughnessTex.id());
metallic.uploadToTexture(metallicTex.id());`,
    license: 'CC0',
    resolution: 'Configurable',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },

  // --- Multi-Resolution Textures (For LOD demonstration) ---
  {
    id: 'texture-uv-grid',
    name: 'UV Test Grid',
    category: 'textures',
    subcategory: 'Debug',
    type: 'texture',
    description: 'UV coordinate test grid for debugging texture mapping and LOD',
    tags: ['texture', 'debug', 'uv', 'grid', 'test', 'lod'],
    content: `// Create UV debug grid (shows coordinate values)
ProceduralTexture uvGrid;
// Custom UV grid generation
int w = 512, h = 512;
uvGrid.resize(w, h);
for (int y = 0; y < h; y++) {
  for (int x = 0; x < w; x++) {
    float u = float(x) / w;
    float v = float(y) / h;
    // Grid lines every 0.1
    bool gridLine = fmod(u, 0.1f) < 0.01f || fmod(v, 0.1f) < 0.01f;
    uvGrid.setPixel(x, y, gridLine ? Color(1,0,0) : Color(u, v, 0.5f));
  }
}
uvGrid.uploadToTexture(myTexture.id());`,
    license: 'CC0',
    resolution: 'Configurable',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'texture-lod-debug',
    name: 'LOD Debug Texture',
    category: 'textures',
    subcategory: 'Debug',
    type: 'texture',
    description: 'Color-coded texture for visualizing texture LOD level switching',
    tags: ['texture', 'debug', 'lod', 'test', 'mipmap'],
    content: `// Create LOD debug texture (each level is different color)
// Level 0 (4096): Red, Level 1 (2048): Green, Level 2 (1024): Blue, etc.
WebTexture lodDebug;
std::vector<Color> lodColors = {
  Color(1,0,0),    // 4096 - Red
  Color(0,1,0),    // 2048 - Green
  Color(0,0,1),    // 1024 - Blue
  Color(1,1,0),    // 512  - Yellow
  Color(1,0,1),    // 256  - Magenta
  Color(0,1,1)     // 128  - Cyan
};
// Load different solid colors at each resolution
lodDebug.loadMultiRes("lod_debug", {4096, 2048, 1024, 512, 256, 128});`,
    license: 'CC0',
    resolution: 'Multi-Res',
    isBuiltIn: true,
    isFavorite: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
]

// ─── Store Definition ────────────────────────────────────────────────────────

const FAVORITES_STORAGE_KEY = 'allolib-asset-favorites'

export const useAssetLibraryStore = defineStore('assetLibrary', () => {
  // State
  const assets = ref<Asset[]>([...builtInAssets])
  const searchQuery = ref('')
  const selectedCategory = ref<AssetCategory | null>(null)
  const selectedSubcategory = ref<string | null>(null)
  const isLibraryOpen = ref(false)

  // ─── Loading State (PlayCanvas-style) ───
  const loadingQueue = ref<string[]>([])           // Asset IDs queued for loading
  const activeLoads = ref<Map<string, AbortController>>(new Map())  // Active fetch controllers
  const maxConcurrentLoads = ref(4)                // Max parallel downloads
  const totalBytesLoaded = ref(0)
  const isPreloading = ref(false)                  // True during initial preload phase

  // Placeholder images for progressive loading
  const placeholders: Record<AssetType, string> = {
    texture: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="%23333" width="64" height="64"/><text x="32" y="36" text-anchor="middle" fill="%23666" font-size="10">Loading...</text></svg>',
    mesh: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="%23333" width="64" height="64"/><polygon points="32,8 56,56 8,56" fill="none" stroke="%23666" stroke-width="2"/></svg>',
    environment: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect fill="%23234" width="64" height="64"/><circle cx="48" cy="16" r="8" fill="%23ff8"/></svg>',
    snippet: '',
    file: '',
    object: '',
    shader: '',
  }

  // Load favorites from storage
  const loadFavorites = () => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY)
      if (stored) {
        const favoriteIds = JSON.parse(stored) as string[]
        for (const asset of assets.value) {
          asset.isFavorite = favoriteIds.includes(asset.id)
        }
      }
    } catch (e) {
      console.warn('[AssetLibrary] Failed to load favorites:', e)
    }
  }

  // Save favorites to storage
  const saveFavorites = () => {
    try {
      const favoriteIds = assets.value.filter(a => a.isFavorite).map(a => a.id)
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds))
    } catch (e) {
      console.warn('[AssetLibrary] Failed to save favorites:', e)
    }
  }

  // Initialize
  loadFavorites()

  // Computed
  const filteredAssets = computed(() => {
    return assets.value.filter(asset => {
      // Category filter
      if (selectedCategory.value && asset.category !== selectedCategory.value) return false

      // Subcategory filter
      if (selectedSubcategory.value && asset.subcategory !== selectedSubcategory.value) return false

      // Search filter
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase()
        const matchesName = asset.name.toLowerCase().includes(q)
        const matchesDesc = asset.description.toLowerCase().includes(q)
        const matchesTags = asset.tags.some(t => t.toLowerCase().includes(q))
        if (!matchesName && !matchesDesc && !matchesTags) return false
      }

      return true
    })
  })

  const favoriteAssets = computed(() => assets.value.filter(a => a.isFavorite))

  const subcategories = computed(() => {
    if (!selectedCategory.value) return []
    const subs = new Set<string>()
    for (const asset of assets.value) {
      if (asset.category === selectedCategory.value && asset.subcategory) {
        subs.add(asset.subcategory)
      }
    }
    return Array.from(subs).sort()
  })

  // Actions
  function setCategory(category: AssetCategory | null) {
    selectedCategory.value = category
    selectedSubcategory.value = null
  }

  function setSubcategory(subcategory: string | null) {
    selectedSubcategory.value = subcategory
  }

  function toggleFavorite(assetId: string) {
    const asset = assets.value.find(a => a.id === assetId)
    if (asset) {
      asset.isFavorite = !asset.isFavorite
      saveFavorites()
    }
  }

  function openLibrary() {
    isLibraryOpen.value = true
  }

  function closeLibrary() {
    isLibraryOpen.value = false
  }

  function toggleLibrary() {
    isLibraryOpen.value = !isLibraryOpen.value
  }

  /**
   * Add an asset to the current project
   */
  function addToProject(asset: Asset, targetPath?: string): boolean {
    const projectStore = useProjectStore()

    if (asset.type === 'snippet') {
      // For snippets, we need to insert into editor or create a new file
      // Return the content for the caller to handle
      return false // Snippets are handled differently (copy to clipboard or insert)
    }

    if (asset.type === 'file' && asset.content) {
      // Create a file with the template content
      const fileName = targetPath || `${asset.name.replace(/\s+/g, '_').toLowerCase()}.cpp`
      projectStore.addOrUpdateFile(fileName, asset.content)
      projectStore.setActiveFile(fileName)
      console.log(`[AssetLibrary] Added file: ${fileName}`)
      return true
    }

    if (asset.type === 'object' && asset.objectDefinition) {
      // Create an object definition file
      const fileName = targetPath || `objects/${asset.id}.object.json`
      const content = JSON.stringify(asset.objectDefinition, null, 2)

      // Ensure objects folder exists
      if (!projectStore.project.folders.some(f => f.path === 'objects')) {
        projectStore.createFolder('objects')
      }

      projectStore.addOrUpdateFile(fileName, content)
      console.log(`[AssetLibrary] Added object: ${fileName}`)
      return true
    }

    if (asset.type === 'shader' && asset.content) {
      const fileName = targetPath || `shaders/${asset.name.replace(/\s+/g, '_').toLowerCase()}.glsl`

      // Ensure shaders folder exists
      if (!projectStore.project.folders.some(f => f.path === 'shaders')) {
        projectStore.createFolder('shaders')
      }

      projectStore.addOrUpdateFile(fileName, asset.content)
      console.log(`[AssetLibrary] Added shader: ${fileName}`)
      return true
    }

    if (asset.type === 'environment' && (asset.localPath || asset.downloadUrl)) {
      // Create an environment reference file with metadata and file path
      const fileName = targetPath || `environments/${asset.id}.env.json`
      const envReference = {
        name: asset.name,
        description: asset.description,
        localPath: asset.localPath || null,
        downloadUrl: asset.downloadUrl || null,
        previewUrl: asset.previewUrl || null,
        license: asset.license || 'CC0',
        resolution: asset.resolution || 'Unknown',
        fileSize: asset.fileSize || 'Unknown',
        tags: asset.tags,
        addedAt: new Date().toISOString()
      }
      const content = JSON.stringify(envReference, null, 2)

      // Ensure environments folder exists
      if (!projectStore.project.folders.some(f => f.path === 'environments')) {
        projectStore.createFolder('environments')
      }

      projectStore.addOrUpdateFile(fileName, content)
      console.log(`[AssetLibrary] Added environment: ${fileName}${asset.localPath ? ' (local)' : ' (remote)'}`)
      return true
    }

    if (asset.type === 'mesh' && (asset.localPath || asset.downloadUrl)) {
      // Create a mesh reference file with metadata and file path
      const fileName = targetPath || `meshes/${asset.id}.mesh.json`
      const meshReference = {
        name: asset.name,
        description: asset.description,
        localPath: asset.localPath || null,
        downloadUrl: asset.downloadUrl || null,
        previewUrl: asset.previewUrl || null,
        license: asset.license || 'CC0',
        fileSize: asset.fileSize || 'Unknown',
        tags: asset.tags,
        addedAt: new Date().toISOString()
      }
      const content = JSON.stringify(meshReference, null, 2)

      // Ensure meshes folder exists
      if (!projectStore.project.folders.some(f => f.path === 'meshes')) {
        projectStore.createFolder('meshes')
      }

      projectStore.addOrUpdateFile(fileName, content)
      console.log(`[AssetLibrary] Added mesh: ${fileName}${asset.localPath ? ' (local)' : ' (remote)'}`)
      return true
    }

    return false
  }

  /**
   * Copy snippet content to clipboard
   */
  async function copySnippetToClipboard(asset: Asset): Promise<boolean> {
    if (asset.type !== 'snippet' || !asset.content) return false

    try {
      await navigator.clipboard.writeText(asset.content)
      console.log(`[AssetLibrary] Copied snippet to clipboard: ${asset.name}`)
      return true
    } catch (e) {
      console.warn('[AssetLibrary] Failed to copy to clipboard:', e)
      return false
    }
  }

  /**
   * Get snippet content for insertion
   */
  function getSnippetContent(assetId: string): string | null {
    const asset = assets.value.find(a => a.id === assetId)
    if (asset?.type === 'snippet' && asset.content) {
      return asset.content
    }
    return null
  }

  /**
   * Create a custom user asset
   */
  function createAsset(assetData: Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>): Asset {
    const asset: Asset = {
      ...assetData,
      id: `user-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isBuiltIn: false,
    }
    assets.value.push(asset)
    return asset
  }

  /**
   * Delete a user-created asset
   */
  function deleteAsset(assetId: string): boolean {
    const index = assets.value.findIndex(a => a.id === assetId)
    if (index === -1) return false

    const asset = assets.value[index]
    if (asset.isBuiltIn) {
      console.warn('[AssetLibrary] Cannot delete built-in asset')
      return false
    }

    assets.value.splice(index, 1)
    return true
  }

  /**
   * File type detection and auto-categorization
   */
  interface FileTypeInfo {
    category: AssetCategory
    type: AssetType
    subcategory: string
    tags: string[]
  }

  function detectFileType(filename: string, mimeType?: string): FileTypeInfo | null {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const name = filename.toLowerCase()

    // Texture files
    if (['jpg', 'jpeg', 'png', 'webp', 'tga', 'bmp'].includes(ext)) {
      // Detect PBR map type from filename
      let subcategory = 'General'
      const tags = ['texture', 'image']

      if (name.includes('albedo') || name.includes('diffuse') || name.includes('basecolor') || name.includes('color') || name.includes('_diff')) {
        subcategory = 'PBR Albedo'
        tags.push('albedo', 'diffuse', 'pbr')
      } else if (name.includes('normal') || name.includes('_nor') || name.includes('_nrm')) {
        subcategory = 'PBR Normal'
        tags.push('normal', 'bump', 'pbr')
      } else if (name.includes('rough') || name.includes('_rgh')) {
        subcategory = 'PBR Roughness'
        tags.push('roughness', 'pbr')
      } else if (name.includes('metal') || name.includes('_met')) {
        subcategory = 'PBR Metallic'
        tags.push('metallic', 'pbr')
      } else if (name.includes('ao') || name.includes('ambient') || name.includes('occlusion')) {
        subcategory = 'PBR AO'
        tags.push('ao', 'ambient-occlusion', 'pbr')
      } else if (name.includes('emissive') || name.includes('emission') || name.includes('glow')) {
        subcategory = 'PBR Emissive'
        tags.push('emissive', 'glow', 'pbr')
      } else if (name.includes('height') || name.includes('displacement') || name.includes('_disp')) {
        subcategory = 'Height Map'
        tags.push('height', 'displacement')
      }

      return { category: 'textures', type: 'texture', subcategory, tags }
    }

    // HDR environment files
    if (['hdr', 'exr'].includes(ext)) {
      return {
        category: 'environments',
        type: 'environment',
        subcategory: 'HDRI',
        tags: ['hdri', 'environment', 'skybox', 'lighting', 'ibl']
      }
    }

    // 3D mesh files
    if (['obj', 'fbx', 'gltf', 'glb', 'stl', 'ply'].includes(ext)) {
      return {
        category: 'meshes',
        type: 'mesh',
        subcategory: ext.toUpperCase(),
        tags: ['mesh', '3d', 'model', ext]
      }
    }

    // Shader files
    if (['glsl', 'vert', 'frag', 'vs', 'fs', 'shader'].includes(ext)) {
      let subcategory = 'General'
      const tags = ['shader', 'glsl']

      if (name.includes('vert') || ext === 'vert' || ext === 'vs') {
        subcategory = 'Vertex'
        tags.push('vertex')
      } else if (name.includes('frag') || ext === 'frag' || ext === 'fs') {
        subcategory = 'Fragment'
        tags.push('fragment', 'pixel')
      }

      return { category: 'shaders', type: 'shader', subcategory, tags }
    }

    // C++ source files
    if (['cpp', 'hpp', 'h', 'c'].includes(ext)) {
      return {
        category: 'templates',
        type: 'file',
        subcategory: 'Source',
        tags: ['cpp', 'source', 'code']
      }
    }

    return null
  }

  /**
   * Load a file and auto-categorize it into the asset library
   */
  async function loadFile(file: File): Promise<Asset | null> {
    const typeInfo = detectFileType(file.name, file.type)

    if (!typeInfo) {
      console.warn(`[AssetLibrary] Unsupported file type: ${file.name}`)
      return null
    }

    // Read file content based on type
    let content: string | undefined
    let localPath: string | undefined

    // For binary files (textures, meshes, HDRIs), we'll store as data URL or blob URL
    if (['texture', 'mesh', 'environment'].includes(typeInfo.type)) {
      // Create a blob URL for binary assets
      const url = URL.createObjectURL(file)
      localPath = url
    } else {
      // For text files, read content
      try {
        content = await file.text()
      } catch (e) {
        console.warn(`[AssetLibrary] Failed to read file: ${file.name}`, e)
        return null
      }
    }

    // Generate meaningful name from filename
    const baseName = file.name.replace(/\.[^/.]+$/, '')  // Remove extension
      .replace(/[_-]+/g, ' ')  // Replace separators with spaces
      .replace(/\b\w/g, c => c.toUpperCase())  // Capitalize words

    // Create the asset
    const asset = createAsset({
      name: baseName,
      category: typeInfo.category,
      subcategory: typeInfo.subcategory,
      type: typeInfo.type,
      description: `Imported from ${file.name} (${formatFileSize(file.size)})`,
      tags: typeInfo.tags,
      content,
      localPath,
      fileSize: formatFileSize(file.size),
      isFavorite: false
    })

    console.log(`[AssetLibrary] Loaded file: ${file.name} -> ${typeInfo.category}/${typeInfo.subcategory}`)
    return asset
  }

  /**
   * Load multiple files and auto-categorize them
   */
  async function loadFiles(files: FileList | File[]): Promise<Asset[]> {
    const results: Asset[] = []
    for (const file of files) {
      const asset = await loadFile(file)
      if (asset) {
        results.push(asset)
      }
    }
    return results
  }

  /**
   * Format file size for display
   */
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  /**
   * Get assets by category for easier filtering
   */
  function getAssetsByCategory(category: AssetCategory): Asset[] {
    return assets.value.filter(a => a.category === category)
  }

  /**
   * Search assets with advanced filtering
   */
  function searchAssets(query: string, options?: {
    category?: AssetCategory
    subcategory?: string
    type?: AssetType
    tagsInclude?: string[]
    tagsExclude?: string[]
  }): Asset[] {
    const q = query.toLowerCase()
    return assets.value.filter(asset => {
      // Apply filters
      if (options?.category && asset.category !== options.category) return false
      if (options?.subcategory && asset.subcategory !== options.subcategory) return false
      if (options?.type && asset.type !== options.type) return false
      if (options?.tagsInclude?.length && !options.tagsInclude.some(t => asset.tags.includes(t))) return false
      if (options?.tagsExclude?.length && options.tagsExclude.some(t => asset.tags.includes(t))) return false

      // Text search
      if (q) {
        const matchesName = asset.name.toLowerCase().includes(q)
        const matchesDesc = asset.description.toLowerCase().includes(q)
        const matchesTags = asset.tags.some(t => t.toLowerCase().includes(q))
        if (!matchesName && !matchesDesc && !matchesTags) return false
      }

      return true
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STREAMING & LOADING SYSTEM (PlayCanvas-style)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get loading state for an asset
   */
  function getLoadingState(assetId: string): AssetLoadingState {
    const asset = assets.value.find(a => a.id === assetId)
    return asset?.loadingState || 'idle'
  }

  /**
   * Get loading progress for an asset (0-100)
   */
  function getLoadProgress(assetId: string): number {
    const asset = assets.value.find(a => a.id === assetId)
    return asset?.loadProgress || 0
  }

  /**
   * Check if asset is ready to use
   */
  function isAssetReady(assetId: string): boolean {
    return getLoadingState(assetId) === 'ready'
  }

  /**
   * Get placeholder URL for progressive loading
   */
  function getPlaceholder(asset: Asset): string {
    return asset.placeholderUrl || placeholders[asset.type] || ''
  }

  /**
   * Load a single asset asynchronously with progress tracking
   */
  async function loadAsset(assetId: string): Promise<boolean> {
    const asset = assets.value.find(a => a.id === assetId)
    if (!asset) {
      console.warn(`[AssetLibrary] Asset not found: ${assetId}`)
      return false
    }

    // Skip if already loaded or loading
    if (asset.loadingState === 'ready') return true
    if (asset.loadingState === 'loading') {
      // Wait for existing load to complete
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (asset.loadingState === 'ready') {
            clearInterval(checkInterval)
            resolve(true)
          } else if (asset.loadingState === 'error') {
            clearInterval(checkInterval)
            resolve(false)
          }
        }, 100)
      })
    }

    // Skip non-binary assets (snippets, templates)
    if (!asset.localPath && !asset.downloadUrl) {
      asset.loadingState = 'ready'
      return true
    }

    const url = asset.localPath || asset.downloadUrl
    if (!url) {
      asset.loadingState = 'ready'
      return true
    }

    // Start loading
    asset.loadingState = 'loading'
    asset.loadProgress = 0
    asset.loadError = undefined

    const controller = new AbortController()
    activeLoads.value.set(assetId, controller)

    try {
      console.log(`[AssetLibrary] Loading: ${asset.name} from ${url}`)

      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentLength = response.headers.get('content-length')
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0

      // Stream the response with progress tracking
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const chunks: Uint8Array[] = []
      let loadedBytes = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        loadedBytes += value.length
        totalBytesLoaded.value += value.length

        if (totalBytes > 0) {
          asset.loadProgress = Math.round((loadedBytes / totalBytes) * 100)
        }
      }

      // Combine chunks into final buffer
      const buffer = new Uint8Array(loadedBytes)
      let offset = 0
      for (const chunk of chunks) {
        buffer.set(chunk, offset)
        offset += chunk.length
      }

      // Store loaded data based on type
      if (asset.type === 'texture' || asset.type === 'environment') {
        // Create blob URL for images
        const blob = new Blob([buffer])
        asset.loadedData = URL.createObjectURL(blob) as any
      } else {
        asset.loadedData = buffer.buffer
      }

      asset.loadingState = 'ready'
      asset.loadProgress = 100
      asset.fileSizeBytes = loadedBytes

      console.log(`[AssetLibrary] Loaded: ${asset.name} (${formatFileSize(loadedBytes)})`)
      return true

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`[AssetLibrary] Cancelled: ${asset.name}`)
        asset.loadingState = 'idle'
      } else {
        console.error(`[AssetLibrary] Failed to load ${asset.name}:`, error)
        asset.loadingState = 'error'
        asset.loadError = error.message || 'Unknown error'
      }
      return false

    } finally {
      activeLoads.value.delete(assetId)
    }
  }

  /**
   * Load multiple assets by IDs
   */
  async function loadAssets(assetIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>()

    // Process in batches respecting maxConcurrentLoads
    for (let i = 0; i < assetIds.length; i += maxConcurrentLoads.value) {
      const batch = assetIds.slice(i, i + maxConcurrentLoads.value)
      const batchResults = await Promise.all(batch.map(id => loadAsset(id)))
      batch.forEach((id, idx) => results.set(id, batchResults[idx]))
    }

    return results
  }

  /**
   * Load assets by tag (PlayCanvas-style grouped loading)
   * Example: loadAssetsByTag('level-1') or loadAssetsByTag(['essential', 'ui'])
   */
  async function loadAssetsByTag(tags: string | string[]): Promise<Map<string, boolean>> {
    const tagList = Array.isArray(tags) ? tags : [tags]
    const matchingAssets = assets.value.filter(a =>
      tagList.some(tag => a.tags.includes(tag))
    )
    const ids = matchingAssets.map(a => a.id)
    console.log(`[AssetLibrary] Loading ${ids.length} assets with tags: ${tagList.join(', ')}`)
    return loadAssets(ids)
  }

  /**
   * Load assets by category
   */
  async function loadAssetsByCategory(category: AssetCategory): Promise<Map<string, boolean>> {
    const ids = assets.value.filter(a => a.category === category).map(a => a.id)
    console.log(`[AssetLibrary] Loading ${ids.length} assets in category: ${category}`)
    return loadAssets(ids)
  }

  /**
   * Preload all assets marked with preload: true
   * Call this during app initialization
   */
  async function preloadAssets(): Promise<void> {
    isPreloading.value = true
    console.log('[AssetLibrary] Starting preload phase...')

    // Sort by priority: critical > high > normal > low
    const priorityOrder: AssetPriority[] = ['critical', 'high', 'normal', 'low']
    const preloadable = assets.value
      .filter(a => a.preload === true)
      .sort((a, b) => {
        const aIdx = priorityOrder.indexOf(a.priority || 'normal')
        const bIdx = priorityOrder.indexOf(b.priority || 'normal')
        return aIdx - bIdx
      })

    if (preloadable.length === 0) {
      console.log('[AssetLibrary] No assets marked for preload')
      isPreloading.value = false
      return
    }

    console.log(`[AssetLibrary] Preloading ${preloadable.length} assets...`)

    // Load critical assets first (blocking)
    const critical = preloadable.filter(a => a.priority === 'critical')
    if (critical.length > 0) {
      console.log(`[AssetLibrary] Loading ${critical.length} critical assets...`)
      await loadAssets(critical.map(a => a.id))
    }

    // Load remaining preload assets in background
    const remaining = preloadable.filter(a => a.priority !== 'critical')
    if (remaining.length > 0) {
      console.log(`[AssetLibrary] Loading ${remaining.length} high/normal priority assets...`)
      await loadAssets(remaining.map(a => a.id))
    }

    isPreloading.value = false
    console.log(`[AssetLibrary] Preload complete. Total loaded: ${formatFileSize(totalBytesLoaded.value)}`)
  }

  /**
   * Cancel loading for an asset
   */
  function cancelLoad(assetId: string): void {
    const controller = activeLoads.value.get(assetId)
    if (controller) {
      controller.abort()
      activeLoads.value.delete(assetId)
    }
  }

  /**
   * Cancel all active loads
   */
  function cancelAllLoads(): void {
    for (const [id, controller] of activeLoads.value) {
      controller.abort()
    }
    activeLoads.value.clear()
    loadingQueue.value = []
  }

  /**
   * Unload an asset to free memory
   */
  function unloadAsset(assetId: string): void {
    const asset = assets.value.find(a => a.id === assetId)
    if (!asset) return

    // Revoke blob URL if applicable
    if (asset.loadedData && typeof asset.loadedData === 'string' && asset.loadedData.startsWith('blob:')) {
      URL.revokeObjectURL(asset.loadedData)
    }

    asset.loadedData = undefined
    asset.loadingState = 'idle'
    asset.loadProgress = 0
    console.log(`[AssetLibrary] Unloaded: ${asset.name}`)
  }

  /**
   * Unload assets by tag to free memory
   */
  function unloadAssetsByTag(tags: string | string[]): void {
    const tagList = Array.isArray(tags) ? tags : [tags]
    const matchingAssets = assets.value.filter(a =>
      tagList.some(tag => a.tags.includes(tag)) && a.loadingState === 'ready'
    )
    matchingAssets.forEach(a => unloadAsset(a.id))
  }

  /**
   * Get all assets with a specific tag
   */
  function getAssetsByTag(tags: string | string[]): Asset[] {
    const tagList = Array.isArray(tags) ? tags : [tags]
    return assets.value.filter(a => tagList.some(tag => a.tags.includes(tag)))
  }

  /**
   * Get loading statistics
   */
  const loadingStats = computed(() => {
    const all = assets.value.filter(a => a.localPath || a.downloadUrl)
    const ready = all.filter(a => a.loadingState === 'ready')
    const loading = all.filter(a => a.loadingState === 'loading')
    const errors = all.filter(a => a.loadingState === 'error')

    return {
      total: all.length,
      ready: ready.length,
      loading: loading.length,
      errors: errors.length,
      bytesLoaded: totalBytesLoaded.value,
      progress: all.length > 0 ? Math.round((ready.length / all.length) * 100) : 100
    }
  })

  /**
   * Get asset's usable URL (loaded blob URL or original path)
   */
  function getAssetUrl(assetId: string): string | null {
    const asset = assets.value.find(a => a.id === assetId)
    if (!asset) return null

    // If loaded, return blob URL
    if (asset.loadedData && typeof asset.loadedData === 'string') {
      return asset.loadedData
    }

    // Otherwise return original path (will trigger load on use)
    return asset.localPath || asset.downloadUrl || null
  }

  return {
    // State
    assets,
    searchQuery,
    selectedCategory,
    selectedSubcategory,
    isLibraryOpen,
    isPreloading,
    loadingStats,

    // Computed
    filteredAssets,
    favoriteAssets,
    subcategories,

    // Actions
    setCategory,
    setSubcategory,
    toggleFavorite,
    openLibrary,
    closeLibrary,
    toggleLibrary,
    addToProject,
    copySnippetToClipboard,
    getSnippetContent,
    createAsset,
    deleteAsset,

    // File loading (existing)
    loadFile,
    loadFiles,
    detectFileType,
    getAssetsByCategory,
    searchAssets,

    // Streaming & Loading (new PlayCanvas-style)
    loadAsset,
    loadAssets,
    loadAssetsByTag,
    loadAssetsByCategory,
    preloadAssets,
    cancelLoad,
    cancelAllLoads,
    unloadAsset,
    unloadAssetsByTag,
    getAssetsByTag,
    getLoadingState,
    getLoadProgress,
    isAssetReady,
    getPlaceholder,
    getAssetUrl,
  }
})

// Expose store to window for terminal access
export function registerAssetStoreForTerminal() {
  const store = useAssetLibraryStore()
  ;(window as any).__assetStore = store
}
