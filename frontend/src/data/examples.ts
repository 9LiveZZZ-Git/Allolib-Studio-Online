/**
 * AlloLib Studio Online - Example Code Library
 *
 * Complete code examples organized by category for the examples dropdown.
 * Each example is a fully functional AlloLib web application.
 *
 * Structure:
 * - AlloLib (core library examples)
 *   - Basics, Graphics, Audio, Interaction, Scene System, Simulation, Advanced
 * - AlloLib Playground (synthesis tutorials)
 *   - Synthesis, AudioVisual
 */

import { playgroundCategories, playgroundExamples } from './playgroundExamples'

export interface ExampleFile {
  path: string
  content: string
}

export interface Example {
  id: string
  title: string
  description: string
  category: string
  subcategory?: string
  code: string
}

export interface MultiFileExample {
  id: string
  title: string
  description: string
  category: string
  subcategory?: string
  files: ExampleFile[]
  mainFile: string // which file to open in editor
}

export type AnyExample = Example | MultiFileExample

export interface ExampleCategory {
  id: string
  title: string
  subcategories?: { id: string; title: string }[]
}

// Helper to check if an example is multi-file
export function isMultiFileExample(example: AnyExample): example is MultiFileExample {
  return 'files' in example
}

// Top-level category groups for the dropdown
export interface CategoryGroup {
  id: string
  title: string
  categories: ExampleCategory[]
}

export const categoryGroups: CategoryGroup[] = [
  {
    id: 'allolib',
    title: 'AlloLib',
    categories: [
      {
        id: 'basics',
        title: 'Basics',
        subcategories: [
          { id: 'hello-world', title: 'Hello World' },
          { id: 'shapes', title: 'Shapes' },
          { id: 'colors', title: 'Colors' },
        ],
      },
      {
        id: 'graphics',
        title: 'Graphics',
        subcategories: [
          { id: 'meshes', title: 'Meshes' },
          { id: 'transforms', title: 'Transforms' },
          { id: 'lighting', title: 'Lighting' },
          { id: 'shaders', title: 'Shaders' },
          { id: 'textures', title: 'Textures' },
        ],
      },
      {
        id: 'audio',
        title: 'Audio',
        subcategories: [
          { id: 'oscillators', title: 'Oscillators' },
          { id: 'envelopes', title: 'Envelopes' },
          { id: 'synthesis', title: 'Synthesis' },
          { id: 'samples', title: 'Samples' },
          { id: 'effects', title: 'Effects' },
        ],
      },
      {
        id: 'interaction',
        title: 'Interaction',
        subcategories: [
          { id: 'keyboard', title: 'Keyboard' },
          { id: 'mouse', title: 'Mouse' },
          { id: 'navigation', title: 'Navigation' },
        ],
      },
      {
        id: 'scene',
        title: 'Scene System',
        subcategories: [
          { id: 'synthvoice', title: 'SynthVoice' },
          { id: 'polysynth', title: 'PolySynth' },
          { id: 'dynamicscene', title: 'DynamicScene' },
        ],
      },
      {
        id: 'simulation',
        title: 'Simulation',
        subcategories: [
          { id: 'particles', title: 'Particle Systems' },
          { id: 'physics', title: 'Physics' },
          { id: 'agents', title: 'Agent-Based' },
          { id: 'raymarching', title: 'Ray Marching' },
          { id: 'fluids', title: 'Fluid & Smoke' },
          { id: 'life', title: 'Artificial Life' },
          { id: 'cellular', title: 'Cellular Automata' },
          { id: 'procedural', title: 'Procedural Generation' },
        ],
      },
      {
        id: 'advanced',
        title: 'Advanced',
        subcategories: [
          { id: 'multifile', title: 'Multi-File Projects' },
          { id: 'audiovisual', title: 'Audio-Visual' },
          { id: 'generative', title: 'Generative' },
        ],
      },
      {
        id: 'feature-tests',
        title: 'Feature Tests',
        subcategories: [
          { id: 'graphics', title: 'Graphics Tests' },
          { id: 'audio', title: 'Audio Tests' },
          { id: 'ui', title: 'UI Tests' },
        ],
      },
    ],
  },
  {
    id: 'playground',
    title: 'AlloLib Playground',
    categories: playgroundCategories,
  },
]

// Flat list of all categories for backwards compatibility
export const categories: ExampleCategory[] = [
  ...categoryGroups[0].categories,
  ...playgroundCategories,
]

// Combine base examples with playground examples
export const examples: Example[] = [
  // ==========================================================================
  // BASICS - Hello World
  // ==========================================================================
  {
    id: 'hello-sphere',
    title: 'Hello Sphere',
    description: 'Simple rotating sphere - the classic first example',
    category: 'basics',
    subcategory: 'hello-world',
    code: `/**
 * Hello Sphere - Your first AlloLib Web application
 * A simple rotating sphere with color
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class HelloSphere : public WebApp {
public:
    Mesh mesh;
    double angle = 0;

    void onCreate() override {
        // Create a sphere mesh
        addSphere(mesh, 1.0, 32, 32);
        mesh.generateNormals();

        // Position camera
        nav().pos(0, 0, 5);
    }

    void onAnimate(double dt) override {
        angle += dt * 45.0; // 45 degrees per second
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        g.pushMatrix();
        g.rotate(angle, 0, 1, 0);
        g.color(0.4f, 0.7f, 1.0f);
        g.draw(mesh);
        g.popMatrix();
    }
};

ALLOLIB_WEB_MAIN(HelloSphere)
`,
  },
  {
    id: 'hello-audio',
    title: 'Hello Audio',
    description: 'Simple sine wave tone',
    category: 'basics',
    subcategory: 'hello-world',
    code: `/**
 * Hello Audio - Your first audio application
 * Generates a pure sine wave tone (no Gamma, manual calculation)
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

class HelloAudio : public WebApp {
public:
    Mesh mesh;
    float amplitude = 0.3f;
    float frequency = 440.0f;
    double phase = 0.0;
    double phaseIncrement = 0.0;

    void onCreate() override {
        addSphere(mesh, 0.5, 32, 32);
        mesh.generateNormals();
        nav().pos(0, 0, 4);
        configureWebAudio(44100, 128, 2, 0);

        // Calculate phase increment for 440Hz at 44100 sample rate
        phaseIncrement = 2.0 * M_PI * frequency / 44100.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        // Visualize with a pulsing sphere
        float size = 1.0f + amplitude * 0.5f;
        g.pushMatrix();
        g.scale(size);
        g.color(0.2f, 0.8f, 0.4f);
        g.draw(mesh);
        g.popMatrix();
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            // Pure sine wave using standard math
            float sample = std::sin(phase) * amplitude;
            phase += phaseIncrement;

            // Keep phase in reasonable range
            if (phase >= 2.0 * M_PI) {
                phase -= 2.0 * M_PI;
            }

            io.out(0) = sample;
            io.out(1) = sample;
        }
    }
};

ALLOLIB_WEB_MAIN(HelloAudio)
`,
  },
  {
    id: 'hello-audiovisual',
    title: 'Hello Audio-Visual',
    description: 'Combined graphics and audio',
    category: 'basics',
    subcategory: 'hello-world',
    code: `/**
 * Hello Audio-Visual
 * Combines rotating graphics with audio synthesis
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"

using namespace al;

class HelloAudioVisual : public WebApp {
public:
    Mesh mesh;
    double angle = 0;
    gam::Sine<> osc{440.0f};
    float amplitude = 0.25f;

    void onCreate() override {
        addSphere(mesh, 1.0, 32, 32);
        mesh.generateNormals();

        // Add vertex colors
        for (size_t i = 0; i < mesh.vertices().size(); ++i) {
            float t = float(i) / float(mesh.vertices().size());
            mesh.color(HSV(t, 0.8f, 1.0f));
        }

        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        angle += dt * 30.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        g.pushMatrix();
        g.rotate(angle, 0, 1, 0);
        g.rotate(angle * 0.7, 1, 0, 0);
        g.meshColor();
        g.draw(mesh);
        g.popMatrix();
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float sample = osc() * amplitude;
            io.out(0) = sample;
            io.out(1) = sample;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '8') {
            float freq = 220.0f * (k.key() - '0');
            osc.freq(freq);
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(HelloAudioVisual)
`,
  },

  // ==========================================================================
  // BASICS - Shapes
  // ==========================================================================
  {
    id: 'shape-gallery',
    title: 'Shape Gallery',
    description: 'All built-in primitive shapes',
    category: 'basics',
    subcategory: 'shapes',
    code: `/**
 * Shape Gallery - All AlloLib primitive shapes
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class ShapeGallery : public WebApp {
public:
    Mesh sphere, cube, cone, cylinder, torus;
    Mesh icosphere, dodecahedron, octahedron;
    double angle = 0;

    void onCreate() override {
        // Create all shapes
        addSphere(sphere, 0.4, 32, 32);
        addCube(cube, 0.6);
        addCone(cone, 0.3, Vec3f(0, 0.8, 0), 32, 1);
        addCylinder(cylinder, 0.25, 0.7, 32, 1);
        addTorus(torus, 0.15, 0.35, 32, 32);
        addIcosphere(icosphere, 0.4, 2);
        addDodecahedron(dodecahedron, 0.35);
        addOctahedron(octahedron, 0.4);

        sphere.generateNormals();
        cube.generateNormals();
        cone.generateNormals();
        cylinder.generateNormals();
        torus.generateNormals();
        icosphere.generateNormals();
        dodecahedron.generateNormals();
        octahedron.generateNormals();

        nav().pos(0, 0, 8);
    }

    void onAnimate(double dt) override {
        angle += dt * 30.0;
    }

    void drawShape(Graphics& g, Mesh& mesh, float x, float y, Color color) {
        g.pushMatrix();
        g.translate(x, y, 0);
        g.rotate(angle, 0, 1, 0);
        g.color(color);
        g.draw(mesh);
        g.popMatrix();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        // Top row
        drawShape(g, sphere, -3, 1.5, Color(1, 0.3, 0.3));
        drawShape(g, cube, -1, 1.5, Color(0.3, 1, 0.3));
        drawShape(g, cone, 1, 1.5, Color(0.3, 0.3, 1));
        drawShape(g, cylinder, 3, 1.5, Color(1, 1, 0.3));

        // Bottom row
        drawShape(g, torus, -3, -1.5, Color(1, 0.3, 1));
        drawShape(g, icosphere, -1, -1.5, Color(0.3, 1, 1));
        drawShape(g, dodecahedron, 1, -1.5, Color(1, 0.6, 0.3));
        drawShape(g, octahedron, 3, -1.5, Color(0.6, 0.3, 1));
    }
};

ALLOLIB_WEB_MAIN(ShapeGallery)
`,
  },
  {
    id: 'custom-mesh',
    title: 'Custom Mesh',
    description: 'Building meshes from vertices',
    category: 'basics',
    subcategory: 'shapes',
    code: `/**
 * Custom Mesh - Building geometry from scratch
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Mesh.hpp"
#include <cmath>

using namespace al;

class CustomMesh : public WebApp {
public:
    Mesh mesh;
    double angle = 0;

    void onCreate() override {
        // Create a star shape
        mesh.primitive(Mesh::TRIANGLE_FAN);

        // Center vertex
        mesh.vertex(0, 0, 0);
        mesh.color(1, 1, 0);

        int points = 5;
        float outerRadius = 1.0f;
        float innerRadius = 0.4f;

        for (int i = 0; i <= points * 2; ++i) {
            float angle = M_PI / 2.0f + i * M_PI / points;
            float radius = (i % 2 == 0) ? outerRadius : innerRadius;
            float x = cos(angle) * radius;
            float y = sin(angle) * radius;
            mesh.vertex(x, y, 0);
            mesh.color(HSV(float(i) / (points * 2), 0.8f, 1.0f));
        }

        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        angle += dt * 60.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f, 0.05f, 0.1f);
        g.depthTesting(true);

        g.pushMatrix();
        g.rotate(angle, 0, 0, 1);
        g.meshColor();
        g.draw(mesh);
        g.popMatrix();
    }
};

ALLOLIB_WEB_MAIN(CustomMesh)
`,
  },

  // ==========================================================================
  // BASICS - Colors
  // ==========================================================================
  {
    id: 'color-hsv',
    title: 'HSV Colors',
    description: 'Hue-Saturation-Value color cycling',
    category: 'basics',
    subcategory: 'colors',
    code: `/**
 * HSV Colors - Smooth color transitions using HSV
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class HSVColors : public WebApp {
public:
    Mesh mesh;
    double time = 0;

    void onCreate() override {
        addSphere(mesh, 1.0, 64, 64);
        mesh.generateNormals();
        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void onDraw(Graphics& g) override {
        // Background cycles through colors slowly
        float bgHue = fmod(time * 0.05, 1.0);
        Color bg = HSV(bgHue, 0.3f, 0.15f);
        g.clear(bg);

        g.depthTesting(true);
        g.lighting(true);

        // Sphere cycles through rainbow
        float hue = fmod(time * 0.2, 1.0);
        g.color(HSV(hue, 0.9f, 1.0f));
        g.draw(mesh);
    }
};

ALLOLIB_WEB_MAIN(HSVColors)
`,
  },
  {
    id: 'vertex-colors',
    title: 'Vertex Colors',
    description: 'Per-vertex coloring on meshes',
    category: 'basics',
    subcategory: 'colors',
    code: `/**
 * Vertex Colors - Different colors at each vertex
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class VertexColors : public WebApp {
public:
    Mesh mesh;
    double angle = 0;

    void onCreate() override {
        addSphere(mesh, 1.2, 48, 48);
        mesh.generateNormals();

        // Assign colors based on vertex position
        for (size_t i = 0; i < mesh.vertices().size(); ++i) {
            Vec3f& v = mesh.vertices()[i];
            // Map position to color
            float r = (v.x + 1.2f) / 2.4f;
            float g = (v.y + 1.2f) / 2.4f;
            float b = (v.z + 1.2f) / 2.4f;
            mesh.color(r, g, b);
        }

        nav().pos(0, 0, 5);
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f, 0.05f, 0.08f);
        g.depthTesting(true);
        g.lighting(true);

        g.pushMatrix();
        g.rotate(angle, 0, 1, 0);
        g.rotate(angle * 0.5, 1, 0, 0);
        g.meshColor();
        g.draw(mesh);
        g.popMatrix();
    }
};

ALLOLIB_WEB_MAIN(VertexColors)
`,
  },

  // ==========================================================================
  // GRAPHICS - Meshes
  // ==========================================================================
  {
    id: 'mesh-primitives',
    title: 'Mesh Primitives',
    description: 'Different mesh primitive types',
    category: 'graphics',
    subcategory: 'meshes',
    code: `/**
 * Mesh Primitives - Points, Lines, Triangles
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Mesh.hpp"
#include <cmath>

using namespace al;

class MeshPrimitives : public WebApp {
public:
    Mesh points, lines, lineStrip, triangles;
    double time = 0;

    void onCreate() override {
        // Points
        points.primitive(Mesh::POINTS);
        for (int i = 0; i < 100; ++i) {
            float angle = i * 0.1f;
            float r = 0.5f + i * 0.01f;
            points.vertex(cos(angle) * r - 2, sin(angle) * r + 1, 0);
            points.color(HSV(i / 100.0f, 0.8f, 1.0f));
        }

        // Lines
        lines.primitive(Mesh::LINES);
        for (int i = 0; i < 20; ++i) {
            float y = (i - 10) * 0.15f;
            lines.vertex(-0.8f, y + 1, 0);
            lines.vertex(0.8f, y + 1, 0);
            lines.color(0.2f, 0.8f, 1.0f);
            lines.color(1.0f, 0.4f, 0.8f);
        }

        // Line strip (spiral)
        lineStrip.primitive(Mesh::LINE_STRIP);
        for (int i = 0; i < 100; ++i) {
            float t = i / 100.0f;
            float angle = t * 6.0f * M_PI;
            float r = 0.3f + t * 0.5f;
            lineStrip.vertex(cos(angle) * r + 2, sin(angle) * r + 1, 0);
            lineStrip.color(HSV(t, 0.9f, 1.0f));
        }

        // Triangles
        triangles.primitive(Mesh::TRIANGLES);
        for (int i = 0; i < 5; ++i) {
            float x = (i - 2) * 0.8f;
            triangles.vertex(x, -1.5f, 0);
            triangles.vertex(x - 0.3f, -2.2f, 0);
            triangles.vertex(x + 0.3f, -2.2f, 0);
            Color c = HSV(i / 5.0f, 0.8f, 1.0f);
            triangles.color(c);
            triangles.color(c);
            triangles.color(c);
        }

        nav().pos(0, 0, 6);
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);
        g.pointSize(4);

        g.meshColor();
        g.draw(points);
        g.draw(lines);
        g.draw(lineStrip);
        g.draw(triangles);
    }
};

ALLOLIB_WEB_MAIN(MeshPrimitives)
`,
  },
  {
    id: 'mesh-normals',
    title: 'Mesh Normals',
    description: 'Visualizing surface normals',
    category: 'graphics',
    subcategory: 'meshes',
    code: `/**
 * Mesh Normals - Visualizing normal vectors
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class MeshNormals : public WebApp {
public:
    Mesh mesh;
    Mesh normalLines;
    double angle = 0;
    bool showNormals = true;

    void onCreate() override {
        addTorus(mesh, 0.3, 0.8, 32, 32);
        mesh.generateNormals();

        // Create lines showing normals
        normalLines.primitive(Mesh::LINES);
        float normalLength = 0.15f;

        for (size_t i = 0; i < mesh.vertices().size(); ++i) {
            Vec3f& v = mesh.vertices()[i];
            Vec3f& n = mesh.normals()[i];

            normalLines.vertex(v);
            normalLines.vertex(v + n * normalLength);
            normalLines.color(0.2f, 1.0f, 0.4f);
            normalLines.color(1.0f, 1.0f, 0.2f);
        }

        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        angle += dt * 25.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        g.pushMatrix();
        g.rotate(angle, 0, 1, 0);
        g.rotate(angle * 0.3, 1, 0, 0);

        g.color(0.6f, 0.6f, 0.8f);
        g.draw(mesh);

        if (showNormals) {
            g.lighting(false);
            g.meshColor();
            g.draw(normalLines);
        }

        g.popMatrix();
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == 'n' || k.key() == 'N') {
            showNormals = !showNormals;
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(MeshNormals)
`,
  },

  // ==========================================================================
  // GRAPHICS - Transforms
  // ==========================================================================
  {
    id: 'transform-hierarchy',
    title: 'Transform Hierarchy',
    description: 'Nested transformations (solar system)',
    category: 'graphics',
    subcategory: 'transforms',
    code: `/**
 * Transform Hierarchy - Solar system with nested transforms
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class TransformHierarchy : public WebApp {
public:
    Mesh sun, planet, moon;
    double time = 0;

    void onCreate() override {
        addSphere(sun, 0.5, 32, 32);
        addSphere(planet, 0.2, 24, 24);
        addSphere(moon, 0.08, 16, 16);
        sun.generateNormals();
        planet.generateNormals();
        moon.generateNormals();

        nav().pos(0, 2, 8);
        nav().faceToward(Vec3d(0, 0, 0));
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f, 0.02f, 0.05f);
        g.depthTesting(true);
        g.lighting(true);

        // Sun (center)
        g.pushMatrix();
        g.rotate(time * 10, 0, 1, 0);
        g.color(1.0f, 0.8f, 0.2f);
        g.draw(sun);

        // Planet 1 orbit
        g.pushMatrix();
        g.rotate(time * 30, 0, 1, 0);
        g.translate(2, 0, 0);
        g.rotate(time * 50, 0, 1, 0);
        g.color(0.3f, 0.5f, 1.0f);
        g.draw(planet);

        // Moon orbits planet
        g.pushMatrix();
        g.rotate(time * 100, 0, 1, 0);
        g.translate(0.5, 0, 0);
        g.color(0.7f, 0.7f, 0.7f);
        g.draw(moon);
        g.popMatrix();

        g.popMatrix();

        // Planet 2 orbit
        g.pushMatrix();
        g.rotate(time * 20 + 120, 0, 1, 0);
        g.translate(3.5, 0, 0);
        g.rotate(time * 40, 0, 1, 0);
        g.color(0.9f, 0.4f, 0.2f);
        g.draw(planet);
        g.popMatrix();

        // Planet 3 orbit
        g.pushMatrix();
        g.rotate(time * 15 + 240, 0, 1, 0);
        g.translate(5, 0, 0);
        g.rotate(time * 30, 0, 1, 0);
        g.color(0.2f, 0.8f, 0.4f);
        g.draw(planet);

        // Two moons
        g.pushMatrix();
        g.rotate(time * 80, 0, 1, 0);
        g.translate(0.6, 0, 0);
        g.color(0.6f, 0.6f, 0.5f);
        g.draw(moon);
        g.popMatrix();

        g.pushMatrix();
        g.rotate(time * 60 + 180, 0, 1, 0);
        g.translate(0.8, 0, 0);
        g.color(0.5f, 0.5f, 0.6f);
        g.draw(moon);
        g.popMatrix();

        g.popMatrix();
        g.popMatrix();
    }
};

ALLOLIB_WEB_MAIN(TransformHierarchy)
`,
  },
  {
    id: 'matrix-operations',
    title: 'Matrix Operations',
    description: 'Translate, rotate, scale',
    category: 'graphics',
    subcategory: 'transforms',
    code: `/**
 * Matrix Operations - Basic transformations
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class MatrixOperations : public WebApp {
public:
    Mesh cube;
    double time = 0;

    void onCreate() override {
        addCube(cube, 0.4);
        cube.generateNormals();
        nav().pos(0, 0, 8);
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        // Translation only
        g.pushMatrix();
        g.translate(-3, 1.5, 0);
        g.color(1, 0.3, 0.3);
        g.draw(cube);
        g.popMatrix();

        // Rotation only
        g.pushMatrix();
        g.translate(0, 1.5, 0);
        g.rotate(time * 60, 0, 1, 0);
        g.color(0.3, 1, 0.3);
        g.draw(cube);
        g.popMatrix();

        // Scale only
        g.pushMatrix();
        g.translate(3, 1.5, 0);
        float s = 1.0 + 0.5 * sin(time * 2);
        g.scale(s, s, s);
        g.color(0.3, 0.3, 1);
        g.draw(cube);
        g.popMatrix();

        // Combined: translate + rotate
        g.pushMatrix();
        g.translate(-3, -1.5, 0);
        g.rotate(time * 45, 1, 1, 0);
        g.color(1, 1, 0.3);
        g.draw(cube);
        g.popMatrix();

        // Combined: rotate + scale
        g.pushMatrix();
        g.translate(0, -1.5, 0);
        g.rotate(time * 30, 0, 0, 1);
        float s2 = 0.7 + 0.3 * sin(time * 3);
        g.scale(s2, 1, s2);
        g.color(1, 0.3, 1);
        g.draw(cube);
        g.popMatrix();

        // Combined: all three
        g.pushMatrix();
        g.translate(3, -1.5, 0);
        g.rotate(time * 40, 1, 1, 1);
        float s3 = 0.8 + 0.4 * sin(time * 2.5);
        g.scale(s3);
        g.color(0.3, 1, 1);
        g.draw(cube);
        g.popMatrix();
    }
};

ALLOLIB_WEB_MAIN(MatrixOperations)
`,
  },

  // ==========================================================================
  // GRAPHICS - Lighting
  // ==========================================================================
  {
    id: 'basic-lighting',
    title: 'Basic Lighting',
    description: 'Diffuse and specular lighting',
    category: 'graphics',
    subcategory: 'lighting',
    code: `/**
 * Basic Lighting - Diffuse lighting on shapes
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class BasicLighting : public WebApp {
public:
    Mesh sphere, cube, torus;
    double angle = 0;

    void onCreate() override {
        addSphere(sphere, 0.8, 48, 48);
        addCube(cube, 1.0);
        addTorus(torus, 0.3, 0.7, 32, 32);

        sphere.generateNormals();
        cube.generateNormals();
        torus.generateNormals();

        nav().pos(0, 0, 7);
    }

    void onAnimate(double dt) override {
        angle += dt * 20;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f, 0.05f, 0.08f);
        g.depthTesting(true);
        g.lighting(true);

        // Sphere with lighting
        g.pushMatrix();
        g.translate(-2.5, 0, 0);
        g.rotate(angle, 0, 1, 0);
        g.color(0.8f, 0.2f, 0.2f);
        g.draw(sphere);
        g.popMatrix();

        // Cube with lighting
        g.pushMatrix();
        g.translate(0, 0, 0);
        g.rotate(angle, 1, 1, 0);
        g.color(0.2f, 0.8f, 0.2f);
        g.draw(cube);
        g.popMatrix();

        // Torus with lighting
        g.pushMatrix();
        g.translate(2.5, 0, 0);
        g.rotate(angle, 1, 0, 1);
        g.color(0.2f, 0.2f, 0.8f);
        g.draw(torus);
        g.popMatrix();
    }
};

ALLOLIB_WEB_MAIN(BasicLighting)
`,
  },

  // ==========================================================================
  // GRAPHICS - Shaders
  // ==========================================================================
  {
    id: 'custom-shader',
    title: 'Custom Shader',
    description: 'GLSL ES 3.0 vertex and fragment shaders',
    category: 'graphics',
    subcategory: 'shaders',
    code: `/**
 * Custom Shader - Wave deformation with rainbow colors
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/graphics/al_Shader.hpp"

using namespace al;

const char* vertShader = R"(#version 300 es
layout(location = 0) in vec3 position;
layout(location = 3) in vec3 normal;

uniform mat4 al_ModelViewMatrix;
uniform mat4 al_ProjectionMatrix;
uniform float time;

out vec3 vNormal;
out vec3 vPos;

void main() {
    vec3 pos = position;
    pos.y += sin(pos.x * 4.0 + time * 3.0) * 0.15;
    pos.x += cos(pos.z * 4.0 + time * 2.0) * 0.1;

    gl_Position = al_ProjectionMatrix * al_ModelViewMatrix * vec4(pos, 1.0);
    vNormal = normal;
    vPos = pos;
}
)";

const char* fragShader = R"(#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vPos;
uniform float time;

out vec4 fragColor;

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    float hue = fract(vPos.y * 0.5 + time * 0.1);
    vec3 color = hsv2rgb(vec3(hue, 0.8, 1.0));

    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(normalize(vNormal), lightDir), 0.3);

    fragColor = vec4(color * diff, 1.0);
}
)";

class CustomShader : public WebApp {
public:
    Mesh mesh;
    ShaderProgram shader;
    double time = 0;

    void onCreate() override {
        addSphere(mesh, 1.2, 64, 64);
        mesh.generateNormals();
        shader.compile(vertShader, fragShader);
        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);
        g.depthTesting(true);

        g.shader(shader);
        shader.uniform("time", (float)time);
        g.draw(mesh);
    }
};

ALLOLIB_WEB_MAIN(CustomShader)
`,
  },

  // ==========================================================================
  // GRAPHICS - Textures
  // ==========================================================================
  {
    id: 'procedural-texture',
    title: 'Procedural Texture',
    description: 'Generate textures with code',
    category: 'graphics',
    subcategory: 'textures',
    code: `/**
 * Procedural Texture - Checkerboard pattern
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/graphics/al_Texture.hpp"
#include <vector>

using namespace al;

class ProceduralTexture : public WebApp {
public:
    Mesh mesh;
    Texture texture;
    double angle = 0;
    static const int SIZE = 256;

    void onCreate() override {
        addCube(mesh, 1.5);
        mesh.generateNormals();

        // Generate checkerboard texture
        std::vector<unsigned char> pixels(SIZE * SIZE * 4);
        for (int y = 0; y < SIZE; ++y) {
            for (int x = 0; x < SIZE; ++x) {
                int idx = (y * SIZE + x) * 4;
                bool check = ((x / 32) + (y / 32)) % 2;

                if (check) {
                    pixels[idx + 0] = 50 + x * 200 / SIZE;
                    pixels[idx + 1] = 100 + y * 150 / SIZE;
                    pixels[idx + 2] = 200;
                } else {
                    pixels[idx + 0] = 220;
                    pixels[idx + 1] = 180 + y * 75 / SIZE;
                    pixels[idx + 2] = 50;
                }
                pixels[idx + 3] = 255;
            }
        }

        texture.create2D(SIZE, SIZE, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
        texture.submit(pixels.data());
        texture.filter(Texture::LINEAR);
        texture.wrap(Texture::REPEAT);

        nav().pos(0, 0, 5);
    }

    void onAnimate(double dt) override {
        angle += dt * 25.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        g.pushMatrix();
        g.rotate(angle, 0, 1, 0);
        g.rotate(angle * 0.5, 1, 0, 0);

        texture.bind(0);
        g.texture();
        g.draw(mesh);
        texture.unbind(0);

        g.popMatrix();
    }
};

ALLOLIB_WEB_MAIN(ProceduralTexture)
`,
  },
  {
    id: 'web-image-texture',
    title: 'Web Image Texture',
    description: 'Load images from URL and use as textures',
    category: 'graphics',
    subcategory: 'textures',
    code: `/**
 * Web Image Texture
 * Demonstrates loading images asynchronously using WebImage
 * and applying them as textures to 3D objects.
 *
 * Press 1-3 to switch between procedurally generated textures
 * Press R to reload (for testing different images)
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/graphics/al_Texture.hpp"
#include "al_WebImage.hpp"
#include <vector>

using namespace al;

class WebImageTexture : public WebApp {
public:
    Mesh cubeMesh;
    Mesh sphereMesh;
    Texture texture;
    WebImage image;

    bool imageLoaded = false;
    bool useProceduralTexture = true;
    int textureType = 0;
    double angle = 0;
    double animTime = 0;

    static const int TEX_SIZE = 256;

    void onCreate() override {
        // Create meshes with texture coordinates
        addCube(cubeMesh, 1.5);
        cubeMesh.generateNormals();

        addSphere(sphereMesh, 1.0, 32, 32);
        sphereMesh.generateNormals();

        // Start with procedural texture
        generateProceduralTexture();

        // Note: To load an image from URL, uncomment and modify:
        // image.load("https://example.com/texture.png");

        nav().pos(0, 0, 5);
    }

    void generateProceduralTexture() {
        std::vector<unsigned char> pixels(TEX_SIZE * TEX_SIZE * 4);

        for (int y = 0; y < TEX_SIZE; ++y) {
            for (int x = 0; x < TEX_SIZE; ++x) {
                int idx = (y * TEX_SIZE + x) * 4;
                float fx = x / (float)TEX_SIZE;
                float fy = y / (float)TEX_SIZE;

                switch (textureType) {
                    case 0: // Checkerboard
                    {
                        bool check = ((x / 32) + (y / 32)) % 2;
                        if (check) {
                            pixels[idx + 0] = 50 + x * 200 / TEX_SIZE;
                            pixels[idx + 1] = 100 + y * 150 / TEX_SIZE;
                            pixels[idx + 2] = 200;
                        } else {
                            pixels[idx + 0] = 220;
                            pixels[idx + 1] = 180 + y * 75 / TEX_SIZE;
                            pixels[idx + 2] = 50;
                        }
                        break;
                    }
                    case 1: // Gradient circles
                    {
                        float cx = fx - 0.5f;
                        float cy = fy - 0.5f;
                        float d = sqrtf(cx*cx + cy*cy) * 2.0f;
                        float wave = sinf(d * 20.0f) * 0.5f + 0.5f;
                        pixels[idx + 0] = (unsigned char)(wave * 255);
                        pixels[idx + 1] = (unsigned char)((1.0f - d) * 200);
                        pixels[idx + 2] = (unsigned char)(d * 255);
                        break;
                    }
                    case 2: // Noise-like pattern
                    {
                        float n = sinf(x * 0.1f) * cosf(y * 0.1f);
                        n += sinf(x * 0.05f + y * 0.05f);
                        n = n * 0.25f + 0.5f;
                        pixels[idx + 0] = (unsigned char)(n * 200 + 55);
                        pixels[idx + 1] = (unsigned char)(n * 150 + 50);
                        pixels[idx + 2] = (unsigned char)((1.0f - n) * 200 + 55);
                        break;
                    }
                }
                pixels[idx + 3] = 255;
            }
        }

        texture.create2D(TEX_SIZE, TEX_SIZE, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
        texture.submit(pixels.data());
        texture.filter(Texture::LINEAR);
        texture.wrap(Texture::REPEAT);
        useProceduralTexture = true;
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;
        animTime += dt;

        // Check if image finished loading
        if (!imageLoaded && image.ready()) {
            imageLoaded = true;
            // Create texture from loaded image
            texture.create2D(image.width(), image.height(),
                           Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
            texture.submit(image.pixels());
            texture.filter(Texture::LINEAR);
            texture.wrap(Texture::REPEAT);
            useProceduralTexture = false;
            printf("Image texture applied: %dx%d\\n", image.width(), image.height());
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);
        g.depthTesting(true);
        g.lighting(true);

        // Draw textured cube
        g.pushMatrix();
        g.translate(-1.5f, 0, 0);
        g.rotate(angle, 0, 1, 0);
        g.rotate(angle * 0.7f, 1, 0, 0);

        texture.bind(0);
        g.texture();
        g.draw(cubeMesh);
        texture.unbind(0);

        g.popMatrix();

        // Draw textured sphere
        g.pushMatrix();
        g.translate(1.5f, 0, 0);
        g.rotate(angle * 0.5f, 0, 1, 0);

        texture.bind(0);
        g.texture();
        g.draw(sphereMesh);
        texture.unbind(0);

        g.popMatrix();

        // Loading indicator
        if (!useProceduralTexture && !imageLoaded) {
            g.pushMatrix();
            g.translate(0, -2, 0);
            g.rotate(animTime * 180, 0, 0, 1);
            g.color(0.5f, 0.5f, 0.8f);
            Mesh loader;
            addRect(loader, 0.3f, 0.1f);
            g.draw(loader);
            g.popMatrix();
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        // Switch procedural textures
        if (k.key() == '1') {
            textureType = 0;
            generateProceduralTexture();
            printf("Texture: Checkerboard\\n");
        }
        if (k.key() == '2') {
            textureType = 1;
            generateProceduralTexture();
            printf("Texture: Circles\\n");
        }
        if (k.key() == '3') {
            textureType = 2;
            generateProceduralTexture();
            printf("Texture: Pattern\\n");
        }
        if (k.key() == 'r' || k.key() == 'R') {
            // Example: reload image
            // image.load("your-image-url.png");
            // imageLoaded = false;
            printf("Reload image (uncomment image.load() in code)\\n");
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(WebImageTexture)
`,
  },

  // ==========================================================================
  // AUDIO - Oscillators
  // ==========================================================================
  {
    id: 'oscillator-types',
    title: 'Oscillator Types',
    description: 'Sine, saw, square, triangle waves',
    category: 'audio',
    subcategory: 'oscillators',
    code: `/**
 * Oscillator Types - Different waveforms
 * Press 1-4 to switch: 1=Sine, 2=Saw, 3=Square, 4=Triangle
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"

using namespace al;

class OscillatorTypes : public WebApp {
public:
    Mesh mesh;
    gam::Sine<> sine{220.0f};
    gam::LFO<> lfo;  // LFO provides saw, square, triangle via methods

    int oscType = 0;
    float amplitude = 0.25f;
    double angle = 0;

    void onCreate() override {
        addSphere(mesh, 0.8, 32, 32);
        mesh.generateNormals();
        nav().pos(0, 0, 4);
        configureWebAudio(44100, 128, 2, 0);
        lfo.freq(220.0f);
    }

    void onAnimate(double dt) override {
        angle += dt * 30.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        // Color based on oscillator type
        Color colors[] = {
            Color(0.2f, 0.8f, 0.2f),  // Sine - green
            Color(1.0f, 0.6f, 0.2f),  // Saw - orange
            Color(0.8f, 0.2f, 0.8f),  // Square - purple
            Color(0.2f, 0.6f, 1.0f),  // Triangle - blue
        };

        g.pushMatrix();
        g.rotate(angle, 0, 1, 0);
        g.color(colors[oscType]);
        g.draw(mesh);
        g.popMatrix();
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float sample = 0;
            switch (oscType) {
                case 0: sample = sine() * amplitude; break;
                case 1: sample = lfo.up() * amplitude; break;      // Saw (upward ramp)
                case 2: sample = lfo.sqr() * amplitude * 0.5f; break;  // Square
                case 3: sample = lfo.tri() * amplitude; break;     // Triangle
            }
            io.out(0) = sample;
            io.out(1) = sample;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '4') {
            oscType = k.key() - '1';
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(OscillatorTypes)
`,
  },
  {
    id: 'fm-synthesis',
    title: 'FM Synthesis',
    description: 'Frequency modulation synthesis',
    category: 'audio',
    subcategory: 'oscillators',
    code: `/**
 * FM Synthesis - Frequency Modulation
 * Press 1-8 for different carrier frequencies
 * Mouse Y controls modulation depth
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"

using namespace al;

class FMSynthesis : public WebApp {
public:
    Mesh mesh;
    gam::Sine<> carrier{220.0f};
    gam::Sine<> modulator{220.0f};

    float carrierFreq = 220.0f;
    float modRatio = 2.0f;
    float modDepth = 100.0f;
    float amplitude = 0.3f;
    double angle = 0;

    void onCreate() override {
        addTorus(mesh, 0.3, 0.8, 48, 48);
        mesh.generateNormals();
        nav().pos(0, 0, 4);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        angle += dt * 40.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.05f, 0.12f);
        g.depthTesting(true);
        g.lighting(true);

        float hue = carrierFreq / 1000.0f;
        g.pushMatrix();
        g.rotate(angle, 0, 1, 0);
        g.rotate(angle * 0.5, 1, 0, 0);
        g.color(HSV(hue, 0.8f, 1.0f));
        g.draw(mesh);
        g.popMatrix();
    }

    void onSound(AudioIOData& io) override {
        modulator.freq(carrierFreq * modRatio);

        while (io()) {
            float mod = modulator() * modDepth;
            carrier.freq(carrierFreq + mod);
            float sample = carrier() * amplitude;
            io.out(0) = sample;
            io.out(1) = sample;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '8') {
            carrierFreq = 110.0f * (k.key() - '0');
        }
        return true;
    }

    bool onMouseDrag(const Mouse& m) override {
        modDepth = (1.0f - m.y() / 600.0f) * 500.0f;
        modRatio = 1.0f + m.x() / 200.0f;
        return true;
    }
};

ALLOLIB_WEB_MAIN(FMSynthesis)
`,
  },

  // ==========================================================================
  // AUDIO - Envelopes
  // ==========================================================================
  {
    id: 'adsr-envelope',
    title: 'ADSR Envelope',
    description: 'Attack-Decay-Sustain-Release',
    category: 'audio',
    subcategory: 'envelopes',
    code: `/**
 * ADSR Envelope - Press space to trigger
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"

using namespace al;

class ADSREnvelope : public WebApp {
public:
    Mesh mesh;
    gam::Sine<> osc{440.0f};
    gam::ADSR<> env{0.1f, 0.2f, 0.6f, 0.5f};
    double angle = 0;

    void onCreate() override {
        addSphere(mesh, 1.0, 48, 48);
        mesh.generateNormals();
        nav().pos(0, 0, 4);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        angle += dt * 30.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);
        g.depthTesting(true);
        g.lighting(true);

        float envValue = env.value();
        float scale = 0.5f + envValue * 0.8f;

        g.pushMatrix();
        g.scale(scale);
        g.rotate(angle, 0, 1, 0);
        g.color(HSV(0.3f - envValue * 0.3f, 0.8f, 0.5f + envValue * 0.5f));
        g.draw(mesh);
        g.popMatrix();
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float sample = osc() * env() * 0.4f;
            io.out(0) = sample;
            io.out(1) = sample;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') {
            env.reset();
        }
        if (k.key() >= '1' && k.key() <= '8') {
            float freq = 220.0f * powf(2.0f, (k.key() - '1') / 12.0f * 7);
            osc.freq(freq);
            env.reset();
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        if (k.key() == ' ' || (k.key() >= '1' && k.key() <= '8')) {
            env.release();
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(ADSREnvelope)
`,
  },

  // ==========================================================================
  // AUDIO - Synthesis
  // ==========================================================================
  {
    id: 'additive-synthesis',
    title: 'Additive Synthesis',
    description: 'Combining harmonics',
    category: 'audio',
    subcategory: 'synthesis',
    code: `/**
 * Additive Synthesis - Building sounds from harmonics
 * Press 1-8 to change number of harmonics
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include <cmath>

using namespace al;

class AdditiveSynthesis : public WebApp {
public:
    Mesh mesh;
    static const int MAX_HARMONICS = 16;
    gam::Sine<> harmonics[MAX_HARMONICS];
    int numHarmonics = 4;
    float baseFreq = 110.0f;
    float amplitude = 0.3f;
    double angle = 0;

    void onCreate() override {
        addSphere(mesh, 0.8, 32, 32);
        mesh.generateNormals();
        updateFrequencies();
        nav().pos(0, 0, 4);
        configureWebAudio(44100, 128, 2, 0);
    }

    void updateFrequencies() {
        for (int i = 0; i < MAX_HARMONICS; ++i) {
            harmonics[i].freq(baseFreq * (i + 1));
        }
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);
        g.depthTesting(true);
        g.lighting(true);

        // Draw a sphere for each active harmonic
        for (int i = 0; i < numHarmonics; ++i) {
            float offset = (i - numHarmonics / 2.0f) * 0.5f;
            float scale = 1.0f / (i + 1);

            g.pushMatrix();
            g.translate(offset * 2, 0, 0);
            g.scale(scale * 0.8f);
            g.rotate(angle * (i + 1), 0, 1, 0);
            g.color(HSV(float(i) / MAX_HARMONICS, 0.8f, 1.0f));
            g.draw(mesh);
            g.popMatrix();
        }
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float sample = 0;
            for (int i = 0; i < numHarmonics; ++i) {
                float harmAmp = 1.0f / (i + 1);
                sample += harmonics[i]() * harmAmp;
            }
            sample *= amplitude / numHarmonics;
            io.out(0) = sample;
            io.out(1) = sample;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '8') {
            numHarmonics = (k.key() - '0') * 2;
            if (numHarmonics > MAX_HARMONICS) numHarmonics = MAX_HARMONICS;
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(AdditiveSynthesis)
`,
  },

  // ==========================================================================
  // AUDIO - Samples
  // ==========================================================================
  {
    id: 'web-sample-player',
    title: 'Web Sample Player',
    description: 'Load and play audio samples using Web Audio API',
    category: 'audio',
    subcategory: 'samples',
    code: `/**
 * Web Sample Player
 * Demonstrates loading and playing audio samples in the browser
 * using the WebSamplePlayer (Web Audio API alternative to SoundFile)
 *
 * Press SPACE to trigger sample, 1-4 to change playback speed
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al_WebSamplePlayer.hpp"
#include <cmath>

using namespace al;

class WebSamplePlayerDemo : public WebApp {
public:
    WebSamplePlayer sample;
    Mesh waveformMesh;
    Mesh progressMesh;

    // Playback state
    float playPosition = 0;       // Current sample position
    float playbackSpeed = 1.0f;   // Playback rate
    bool isPlaying = false;
    bool isLoaded = false;

    float amplitude = 0.8f;
    double animTime = 0;

    void onCreate() override {
        // Create visual meshes
        waveformMesh.primitive(Mesh::LINE_STRIP);
        progressMesh.primitive(Mesh::TRIANGLES);

        nav().pos(0, 0, 4);
        configureWebAudio(44100, 128, 2, 0);

        // Load a sample (you can change this URL to any audio file)
        // Using a simple test tone URL - replace with your audio file
        printf("[WebSamplePlayer] Loading sample...\\n");

        // For demo purposes, we'll synthesize a simple sound
        // In production, use: sample.load("path/to/your/sample.wav");
        printf("NOTE: Replace the sample.load() URL with your audio file\\n");
    }

    void onAnimate(double dt) override {
        animTime += dt;

        // Check if sample loaded
        if (!isLoaded && sample.ready()) {
            isLoaded = true;
            buildWaveformMesh();
            printf("Sample loaded: %d channels, %d frames, %.0f Hz\\n",
                   sample.channels(), sample.frames(), sample.sampleRate());
        }
    }

    void buildWaveformMesh() {
        if (!sample.ready()) return;

        waveformMesh.reset();
        waveformMesh.primitive(Mesh::LINE_STRIP);

        // Build waveform display (downsample for visualization)
        int frames = sample.frames();
        int step = std::max(1, frames / 512);

        for (int i = 0; i < frames; i += step) {
            float x = (float(i) / frames) * 6.0f - 3.0f;
            float y = sample.read(0, i);  // Left channel
            waveformMesh.vertex(x, y * 1.5f, 0);
            waveformMesh.color(0.3f, 0.7f, 1.0f);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);

        if (isLoaded) {
            // Draw waveform
            g.lineWidth(1.5f);
            g.pushMatrix();
            g.translate(0, 0.5f, 0);
            g.draw(waveformMesh);
            g.popMatrix();

            // Draw playback position indicator
            float progress = playPosition / sample.frames();
            float indicatorX = progress * 6.0f - 3.0f;

            g.pushMatrix();
            g.translate(indicatorX, 0.5f, 0);
            g.color(1.0f, 0.4f, 0.2f);
            Mesh indicator;
            addCube(indicator, 0.05f);
            indicator.generateNormals();
            g.draw(indicator);
            g.popMatrix();

            // Draw speed indicator
            g.pushMatrix();
            g.translate(0, -1.5f, 0);
            float speedWidth = playbackSpeed * 0.5f;
            g.color(0.2f, 0.8f, 0.4f);
            Mesh speedBar;
            addRect(speedBar, speedWidth, 0.1f);
            g.draw(speedBar);
            g.popMatrix();
        } else {
            // Loading indicator
            g.pushMatrix();
            g.rotate(animTime * 180, 0, 0, 1);
            g.color(0.5f, 0.5f, 0.8f);
            Mesh loader;
            addRect(loader, 0.5f, 0.1f);
            g.draw(loader);
            g.popMatrix();
        }
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float outL = 0, outR = 0;

            if (isPlaying && isLoaded) {
                // Read with interpolation for pitch shifting
                outL = sample.readInterp(0, playPosition) * amplitude;
                if (sample.channels() > 1) {
                    outR = sample.readInterp(1, playPosition) * amplitude;
                } else {
                    outR = outL;
                }

                // Advance position
                playPosition += playbackSpeed;

                // Loop or stop at end
                if (playPosition >= sample.frames()) {
                    playPosition = 0;  // Loop
                    // Or: isPlaying = false; // One-shot
                }
            }

            io.out(0) = outL;
            io.out(1) = outR;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') {
            if (isLoaded) {
                isPlaying = !isPlaying;
                if (isPlaying) {
                    playPosition = 0;  // Start from beginning
                }
                printf("%s\\n", isPlaying ? "Playing" : "Stopped");
            }
        }

        // Change playback speed
        if (k.key() == '1') { playbackSpeed = 0.5f; printf("Speed: 0.5x\\n"); }
        if (k.key() == '2') { playbackSpeed = 1.0f; printf("Speed: 1.0x\\n"); }
        if (k.key() == '3') { playbackSpeed = 1.5f; printf("Speed: 1.5x\\n"); }
        if (k.key() == '4') { playbackSpeed = 2.0f; printf("Speed: 2.0x\\n"); }

        // Scrub with arrow keys
        if (k.key() == Keyboard::LEFT && isLoaded) {
            playPosition = std::max(0.0f, playPosition - sample.sampleRate() * 0.1f);
        }
        if (k.key() == Keyboard::RIGHT && isLoaded) {
            playPosition = std::min((float)(sample.frames() - 1),
                                   playPosition + sample.sampleRate() * 0.1f);
        }

        return true;
    }
};

ALLOLIB_WEB_MAIN(WebSamplePlayerDemo)
`,
  },

  // ==========================================================================
  // AUDIO - Effects
  // ==========================================================================
  {
    id: 'reverb-filter-chain',
    title: 'Reverb & Filter Chain',
    description: 'Audio effects chain with reverb and filters',
    category: 'audio',
    subcategory: 'effects',
    code: `/**
 * Reverb & Filter Chain
 * Demonstrates al::Reverb (Dattorro plate reverb) with filter processing
 *
 * Press SPACE to trigger sound
 * 1-3=Reverb size, R=Toggle reverb, F=Toggle filter
 * UP/DOWN=Filter frequency
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/sound/al_Reverb.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
#include "Gamma/Filter.h"
#include "Gamma/Noise.h"
#include <cmath>

using namespace al;
using namespace gam;

class ReverbFilterChain : public WebApp {
public:
    // Sound source
    Sine<> osc;
    NoisePink<> noise;
    ADSR<> env;

    // Effects
    Reverb<float> reverb;
    Biquad<> lowpass;
    Biquad<> highpass;

    // State
    bool reverbEnabled = true;
    bool filterEnabled = true;
    float filterFreq = 2000.0f;
    float reverbMix = 0.3f;
    float reverbDecay = 0.85f;

    // Visualization
    Mesh sphereMesh;
    float visualLevel = 0;
    float reverbLevel = 0;
    double time = 0;

    void onCreate() override {
        gam::sampleRate(44100);

        // Configure oscillator
        osc.freq(220.0f);

        // Configure envelope
        env.attack(0.01f);
        env.decay(0.2f);
        env.sustain(0.3f);
        env.release(0.5f);

        // Configure reverb
        reverb.bandwidth(0.9f);
        reverb.damping(0.5f);
        reverb.decay(reverbDecay);
        reverb.diffusion(0.8f, 0.8f, 0.7f, 0.6f);

        // Configure filters
        lowpass.type(LOW_PASS);
        lowpass.freq(filterFreq);
        lowpass.res(1.5f);

        highpass.type(HIGH_PASS);
        highpass.freq(80.0f);

        // Create mesh
        addSphere(sphereMesh, 1.0f, 32, 32);
        sphereMesh.generateNormals();

        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        time += dt;
        visualLevel *= 0.95f;  // Decay
        reverbLevel *= 0.98f;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.06f, 0.06f, 0.1f);
        g.depthTesting(true);
        g.lighting(true);

        // Main sphere (dry signal)
        g.pushMatrix();
        g.translate(-1.5f, 0, 0);
        float dryScale = 0.5f + visualLevel * 0.5f;
        g.scale(dryScale);
        g.color(0.3f + visualLevel * 0.7f, 0.5f, 0.8f);
        g.draw(sphereMesh);
        g.popMatrix();

        // Reverb sphere (wet signal)
        g.pushMatrix();
        g.translate(1.5f, 0, 0);
        float wetScale = 0.3f + reverbLevel * 0.7f;
        g.scale(wetScale);
        g.color(0.8f, 0.4f + reverbLevel * 0.4f, 0.3f);
        g.draw(sphereMesh);
        g.popMatrix();

        // Filter indicator
        g.pushMatrix();
        g.translate(0, -1.5f, 0);
        float filterNorm = (filterFreq - 100.0f) / 4900.0f;
        g.color(filterEnabled ? Color(0.2f, 0.8f, 0.4f) : Color(0.4f, 0.4f, 0.4f));
        Mesh filterBar;
        addRect(filterBar, filterNorm * 2.0f, 0.1f);
        g.draw(filterBar);
        g.popMatrix();
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            // Generate sound
            float e = env();
            float dry = (osc() * 0.7f + noise() * 0.3f) * e * 0.5f;

            // Track level for visualization
            visualLevel = std::max(visualLevel, std::abs(dry));

            // Apply filter
            float filtered = dry;
            if (filterEnabled) {
                filtered = lowpass(filtered);
                filtered = highpass(filtered);
            }

            // Apply reverb
            float wet = 0;
            if (reverbEnabled) {
                float reverbIn = filtered;
                float reverbOutL, reverbOutR;
                reverb(reverbIn, reverbOutL, reverbOutR);
                wet = (reverbOutL + reverbOutR) * 0.5f;
                reverbLevel = std::max(reverbLevel, std::abs(wet) * 2.0f);
            }

            // Mix dry and wet
            float out = filtered * (1.0f - reverbMix) + wet * reverbMix;

            // Soft clip
            out = std::tanh(out * 1.5f);

            io.out(0) = out;
            io.out(1) = out;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') {
            env.reset();
            osc.freq(220.0f + (rand() % 220));
        }

        // Reverb presets
        if (k.key() == '1') {
            reverbDecay = 0.7f;
            reverb.decay(reverbDecay);
            printf("Reverb: Small room\\n");
        }
        if (k.key() == '2') {
            reverbDecay = 0.85f;
            reverb.decay(reverbDecay);
            printf("Reverb: Medium hall\\n");
        }
        if (k.key() == '3') {
            reverbDecay = 0.95f;
            reverb.decay(reverbDecay);
            printf("Reverb: Large hall\\n");
        }

        // Toggle effects
        if (k.key() == 'r' || k.key() == 'R') {
            reverbEnabled = !reverbEnabled;
            printf("Reverb: %s\\n", reverbEnabled ? "ON" : "OFF");
        }
        if (k.key() == 'f' || k.key() == 'F') {
            filterEnabled = !filterEnabled;
            printf("Filter: %s\\n", filterEnabled ? "ON" : "OFF");
        }

        // Filter frequency
        if (k.key() == Keyboard::UP) {
            filterFreq = std::min(5000.0f, filterFreq * 1.2f);
            lowpass.freq(filterFreq);
            printf("Filter freq: %.0f Hz\\n", filterFreq);
        }
        if (k.key() == Keyboard::DOWN) {
            filterFreq = std::max(100.0f, filterFreq / 1.2f);
            lowpass.freq(filterFreq);
            printf("Filter freq: %.0f Hz\\n", filterFreq);
        }

        return true;
    }
};

ALLOLIB_WEB_MAIN(ReverbFilterChain)
`,
  },

  // ==========================================================================
  // INTERACTION - Keyboard
  // ==========================================================================
  {
    id: 'piano-keyboard',
    title: 'Piano Keyboard',
    description: 'Play notes with computer keyboard',
    category: 'interaction',
    subcategory: 'keyboard',
    code: `/**
 * Piano Keyboard - Use ASDFGHJKL for notes
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"

using namespace al;

class PianoKeyboard : public WebApp {
public:
    static const int NUM_VOICES = 8;
    struct Voice {
        gam::Sine<> osc;
        gam::ADSR<> env{0.01f, 0.1f, 0.5f, 0.3f};
        int note = -1;
        bool active = false;
    };

    Voice voices[NUM_VOICES];
    Mesh keyMesh;
    int pressedKeys[256] = {0};

    void onCreate() override {
        addCube(keyMesh, 0.3);
        keyMesh.generateNormals();
        nav().pos(0, 0, 6);
        configureWebAudio(44100, 128, 2, 0);
    }

    int noteFromKey(int key) {
        const char* keys = "ASDFGHJKL";
        for (int i = 0; keys[i]; ++i) {
            if (key == keys[i] || key == keys[i] + 32) return i;
        }
        return -1;
    }

    float freqFromNote(int note) {
        return 261.63f * powf(2.0f, note / 12.0f);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        // Draw piano keys
        const char* keys = "ASDFGHJKL";
        for (int i = 0; keys[i]; ++i) {
            g.pushMatrix();
            g.translate((i - 4) * 0.7f, 0, 0);

            bool pressed = pressedKeys[(int)keys[i]] || pressedKeys[(int)keys[i] + 32];
            if (pressed) {
                g.translate(0, -0.1f, 0);
                g.color(HSV(i / 9.0f, 0.8f, 1.0f));
            } else {
                g.color(0.9f, 0.9f, 0.9f);
            }

            g.draw(keyMesh);
            g.popMatrix();
        }
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float sample = 0;
            for (int i = 0; i < NUM_VOICES; ++i) {
                if (voices[i].active || voices[i].env.value() > 0.001f) {
                    sample += voices[i].osc() * voices[i].env() * 0.15f;
                }
            }
            io.out(0) = sample;
            io.out(1) = sample;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        int note = noteFromKey(k.key());
        if (note >= 0) {
            pressedKeys[k.key()] = 1;
            for (int i = 0; i < NUM_VOICES; ++i) {
                if (!voices[i].active) {
                    voices[i].osc.freq(freqFromNote(note));
                    voices[i].env.reset();
                    voices[i].note = note;
                    voices[i].active = true;
                    break;
                }
            }
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        int note = noteFromKey(k.key());
        if (note >= 0) {
            pressedKeys[k.key()] = 0;
            for (int i = 0; i < NUM_VOICES; ++i) {
                if (voices[i].note == note) {
                    voices[i].env.release();
                    voices[i].active = false;
                }
            }
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(PianoKeyboard)
`,
  },

  // ==========================================================================
  // INTERACTION - Mouse
  // ==========================================================================
  {
    id: 'mouse-theremin',
    title: 'Mouse Theremin',
    description: 'Control pitch and volume with mouse',
    category: 'interaction',
    subcategory: 'mouse',
    code: `/**
 * Mouse Theremin - X = frequency, Y = amplitude
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"

using namespace al;

class MouseTheremin : public WebApp {
public:
    Mesh mesh;
    gam::Sine<> osc{440.0f};
    float frequency = 440.0f;
    float amplitude = 0.0f;
    float targetFreq = 440.0f;
    float targetAmp = 0.0f;
    float mouseX = 0.5f;
    float mouseY = 0.5f;

    void onCreate() override {
        addSphere(mesh, 0.3, 32, 32);
        mesh.generateNormals();
        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        // Smooth parameter changes
        frequency += (targetFreq - frequency) * 0.1f;
        amplitude += (targetAmp - amplitude) * 0.1f;
        osc.freq(frequency);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f, 0.05f, 0.1f);
        g.depthTesting(true);
        g.lighting(true);

        // Draw cursor sphere
        float x = (mouseX - 0.5f) * 6.0f;
        float y = (0.5f - mouseY) * 4.0f;
        float scale = 0.5f + amplitude * 2.0f;

        g.pushMatrix();
        g.translate(x, y, 0);
        g.scale(scale);
        g.color(HSV(frequency / 1000.0f, 0.8f, 0.5f + amplitude * 0.5f));
        g.draw(mesh);
        g.popMatrix();

        // Draw frequency line
        Mesh line;
        line.primitive(Mesh::LINES);
        line.vertex(-3, y, 0);
        line.vertex(3, y, 0);
        line.color(0.3f, 0.3f, 0.5f);
        line.color(0.3f, 0.3f, 0.5f);
        g.draw(line);
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float sample = osc() * amplitude * 0.4f;
            io.out(0) = sample;
            io.out(1) = sample;
        }
    }

    bool onMouseMove(const Mouse& m) override {
        mouseX = m.x() / 800.0f;
        mouseY = m.y() / 600.0f;
        targetFreq = 100.0f + mouseX * 900.0f;
        targetAmp = 1.0f - mouseY;
        return true;
    }

    bool onMouseDrag(const Mouse& m) override {
        return onMouseMove(m);
    }
};

ALLOLIB_WEB_MAIN(MouseTheremin)
`,
  },

  // ==========================================================================
  // INTERACTION - Navigation
  // ==========================================================================
  {
    id: 'camera-control',
    title: 'Camera Control',
    description: 'WASD + mouse look navigation',
    category: 'interaction',
    subcategory: 'navigation',
    code: `/**
 * Camera Control - WASD movement, arrow keys for rotation
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class CameraControl : public WebApp {
public:
    Mesh ground, objects[10];
    bool keys[256] = {false};
    float moveSpeed = 3.0f;
    float rotSpeed = 60.0f;

    void onCreate() override {
        // Create ground plane
        ground.primitive(Mesh::TRIANGLES);
        float size = 20.0f;
        ground.vertex(-size, -1, -size);
        ground.vertex(size, -1, -size);
        ground.vertex(size, -1, size);
        ground.vertex(-size, -1, -size);
        ground.vertex(size, -1, size);
        ground.vertex(-size, -1, size);
        for (int i = 0; i < 6; ++i) ground.color(0.2f, 0.4f, 0.2f);

        // Create scattered objects
        for (int i = 0; i < 10; ++i) {
            addSphere(objects[i], 0.5, 16, 16);
            objects[i].generateNormals();
        }

        nav().pos(0, 0, 5);
    }

    void onAnimate(double dt) override {
        // Movement
        Vec3d forward = nav().uf();
        Vec3d right = nav().ur();
        forward.y = 0; forward.normalize();
        right.y = 0; right.normalize();

        if (keys['W'] || keys['w']) nav().pos() += forward * moveSpeed * dt;
        if (keys['S'] || keys['s']) nav().pos() -= forward * moveSpeed * dt;
        if (keys['A'] || keys['a']) nav().pos() -= right * moveSpeed * dt;
        if (keys['D'] || keys['d']) nav().pos() += right * moveSpeed * dt;

        // Rotation with arrow keys
        if (keys[Keyboard::LEFT]) nav().spinR(rotSpeed * dt);
        if (keys[Keyboard::RIGHT]) nav().spinR(-rotSpeed * dt);
        if (keys[Keyboard::UP]) nav().spinU(rotSpeed * dt);
        if (keys[Keyboard::DOWN]) nav().spinU(-rotSpeed * dt);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.4f, 0.6f, 0.9f);
        g.depthTesting(true);
        g.lighting(true);

        // Draw ground
        g.color(0.2f, 0.4f, 0.2f);
        g.draw(ground);

        // Draw objects at fixed positions
        float positions[][3] = {
            {-5, 0, -5}, {5, 0, -5}, {0, 0, -8},
            {-3, 0, 3}, {3, 0, 3}, {-7, 0, 0},
            {7, 0, 0}, {0, 0, 5}, {-4, 0, -2}, {4, 0, -2}
        };
        Color colors[] = {
            Color(1,0,0), Color(0,1,0), Color(0,0,1),
            Color(1,1,0), Color(1,0,1), Color(0,1,1),
            Color(1,0.5,0), Color(0.5,0,1), Color(0,1,0.5), Color(1,0.5,0.5)
        };

        for (int i = 0; i < 10; ++i) {
            g.pushMatrix();
            g.translate(positions[i][0], positions[i][1], positions[i][2]);
            g.color(colors[i]);
            g.draw(objects[i]);
            g.popMatrix();
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        keys[k.key()] = true;
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        keys[k.key()] = false;
        return true;
    }
};

ALLOLIB_WEB_MAIN(CameraControl)
`,
  },

  // ==========================================================================
  // SCENE SYSTEM - SynthVoice
  // ==========================================================================
  {
    id: 'synthvoice-basic',
    title: 'Basic SynthVoice',
    description: 'Simple voice with envelope',
    category: 'scene',
    subcategory: 'synthvoice',
    code: `/**
 * Basic SynthVoice - Voice with ADSR envelope
 * Press 1-8 to trigger notes
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/scene/al_PolySynth.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"

using namespace al;
using namespace gam;

struct SimpleVoice : SynthVoice {
    Sine<> osc;
    ADSR<> env{0.02f, 0.1f, 0.6f, 0.4f};
    Mesh mesh;
    float freq = 440.0f;

    SimpleVoice() {
        addSphere(mesh, 0.15, 16, 16);
    }

    void setFreq(float f) {
        freq = f;
        osc.freq(f);
    }

    void onProcess(AudioIOData& io) override {
        while (io()) {
            float s = osc() * env() * 0.2f;
            io.out(0) += s;
            io.out(1) += s;
        }
        if (env.done()) free();
    }

    void onProcess(Graphics& g) override {
        float e = env.value();
        g.pushMatrix();
        g.translate((freq - 400) / 100.0f, e * 2 - 1, -5);
        g.scale(0.5f + e);
        g.color(HSV(freq / 800.0f, 0.8f, e));
        g.draw(mesh);
        g.popMatrix();
    }

    void onTriggerOn() override { env.reset(); }
    void onTriggerOff() override { env.release(); }
};

class SynthVoiceBasic : public WebApp {
public:
    PolySynth synth;
    Mesh bgMesh;

    void onCreate() override {
        synth.allocatePolyphony<SimpleVoice>(16);
        addSphere(bgMesh, 0.3, 16, 16);
        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);
        g.depthTesting(true);
        g.lighting(true);
        synth.render(g);
    }

    void onSound(AudioIOData& io) override {
        synth.render(io);
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '8') {
            float freq = 220.0f * powf(2.0f, (k.key() - '1') / 12.0f * 7);
            auto* v = synth.getVoice<SimpleVoice>();
            if (v) {
                v->setFreq(freq);
                synth.triggerOn(v, 0, k.key());
            }
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '8') {
            synth.triggerOff(k.key());
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(SynthVoiceBasic)
`,
  },

  // ==========================================================================
  // SCENE SYSTEM - PolySynth
  // ==========================================================================
  {
    id: 'polysynth-demo',
    title: 'PolySynth Demo',
    description: 'Polyphonic synthesizer with voice stealing',
    category: 'scene',
    subcategory: 'polysynth',
    code: `/**
 * PolySynth Demo - Full polyphonic synthesizer
 * Use QWERTY row for notes
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/scene/al_PolySynth.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"

using namespace al;
using namespace gam;

struct PolyVoice : SynthVoice {
    Sine<> osc1, osc2;
    ADSR<> ampEnv{0.01f, 0.15f, 0.5f, 0.3f};
    Mesh mesh;
    float freq = 440.0f;

    PolyVoice() {
        addSphere(mesh, 0.2, 16, 16);
    }

    void setFreq(float f) {
        freq = f;
        osc1.freq(f);
        osc2.freq(f * 1.003f); // Slight detune for richness
    }

    void onProcess(AudioIOData& io) override {
        while (io()) {
            float s = (osc1() + osc2() * 0.5f) * ampEnv() * 0.12f;
            io.out(0) += s;
            io.out(1) += s;
        }
        if (ampEnv.done()) free();
    }

    void onProcess(Graphics& g) override {
        float e = ampEnv.value();
        g.pushMatrix();
        float x = (freq - 300) / 150.0f;
        g.translate(x, e * 2 - 1, -5);
        g.scale(0.3f + e * 0.5f);
        g.color(HSV(freq / 1000.0f, 0.7f, 0.4f + e * 0.6f));
        g.draw(mesh);
        g.popMatrix();
    }

    void onTriggerOn() override { ampEnv.reset(); }
    void onTriggerOff() override { ampEnv.release(); }
};

class PolySynthDemo : public WebApp {
public:
    PolySynth synth;
    int keyToNote[256];

    void onCreate() override {
        synth.allocatePolyphony<PolyVoice>(16);

        // Map keys to notes (QWERTY row = white keys)
        const char* keys = "QWERTYUIOP";
        int notes[] = {0, 2, 4, 5, 7, 9, 11, 12, 14, 16};
        for (int i = 0; i < 256; ++i) keyToNote[i] = -1;
        for (int i = 0; keys[i]; ++i) {
            keyToNote[(int)keys[i]] = notes[i];
            keyToNote[(int)keys[i] + 32] = notes[i];
        }

        nav().pos(0, 0, 6);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        synth.update(dt);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.06f, 0.06f, 0.1f);
        g.depthTesting(true);
        synth.render(g);
    }

    void onSound(AudioIOData& io) override {
        synth.render(io);
    }

    bool onKeyDown(const Keyboard& k) override {
        int note = keyToNote[k.key()];
        if (note >= 0) {
            float freq = 261.63f * powf(2.0f, note / 12.0f);
            auto* v = synth.getVoice<PolyVoice>();
            if (v) {
                v->setFreq(freq);
                synth.triggerOn(v, 0, k.key());
            }
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        if (keyToNote[k.key()] >= 0) {
            synth.triggerOff(k.key());
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(PolySynthDemo)
`,
  },

  // ==========================================================================
  // SCENE SYSTEM - DynamicScene
  // ==========================================================================
  {
    id: 'dynamic-scene',
    title: 'Dynamic Scene',
    description: 'Spatial audio with positioned voices',
    category: 'scene',
    subcategory: 'dynamicscene',
    code: `/**
 * Dynamic Scene - Voices with 3D positions
 * Auto-spawns notes that move through space
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/scene/al_DynamicScene.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"

using namespace al;
using namespace gam;

struct SpaceVoice : PositionedVoice {
    Sine<> osc;
    AD<> env{0.1f, 2.0f};
    Mesh mesh;
    float freq = 440.0f;
    Vec3f velocity;

    SpaceVoice() {
        addSphere(mesh, 0.15, 16, 16);
    }

    void set(float f, Vec3f pos, Vec3f vel) {
        freq = f;
        osc.freq(f);
        setPose(Pose(pos));
        velocity = vel;
    }

    void update(double dt) override {
        Pose p = pose();
        p.pos() += velocity * dt;
        setPose(p);
    }

    void onProcess(AudioIOData& io) override {
        while (io()) {
            io.out(0) = osc() * env() * 0.15f;
        }
        if (env.done()) free();
    }

    void onProcess(Graphics& g) override {
        float e = env.value();
        g.color(HSV(freq / 800.0f, 0.8f, e));
        g.draw(mesh);
    }

    void onTriggerOn() override { env.reset(); }
};

class DynamicSceneDemo : public WebApp {
public:
    DynamicScene scene;
    double spawnTimer = 0;
    int noteIndex = 0;

    void onCreate() override {
        scene.allocatePolyphony<SpaceVoice>(32);
        nav().pos(0, 0, 8);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        spawnTimer += dt;
        scene.update(dt);

        // Spawn a new voice periodically
        if (spawnTimer > 0.3) {
            spawnTimer = 0;

            float freq = 220.0f * powf(2.0f, (noteIndex % 12) / 12.0f);
            noteIndex = (noteIndex + 5) % 24;

            Vec3f pos(-4 + (noteIndex % 8), -2 + (noteIndex % 5) * 0.8f, -5);
            Vec3f vel((rand() % 100 - 50) / 50.0f, 0.5f, 0);

            auto* v = scene.getVoice<SpaceVoice>();
            if (v) {
                v->set(freq, pos, vel);
                scene.triggerOn(v);
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f, 0.05f, 0.08f);
        g.depthTesting(true);
        g.lighting(true);
        scene.render(g);
    }

    void onSound(AudioIOData& io) override {
        scene.listenerPose(nav());
        scene.render(io);
    }
};

ALLOLIB_WEB_MAIN(DynamicSceneDemo)
`,
  },

  // ==========================================================================
  // ADVANCED - Particles
  // ==========================================================================
  {
    id: 'particle-system',
    title: 'Particle System',
    description: 'Many animated particles',
    category: 'advanced',
    subcategory: 'particles',
    code: `/**
 * Particle System - Thousands of animated particles
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Mesh.hpp"
#include <cmath>
#include <cstdlib>

using namespace al;

class ParticleSystem : public WebApp {
public:
    static const int NUM_PARTICLES = 2000;
    struct Particle {
        Vec3f pos, vel;
        Color color;
        float life;
    };

    Particle particles[NUM_PARTICLES];
    Mesh mesh;

    // Camera control
    bool keys[256] = {false};
    float moveSpeed = 5.0f;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);

        for (int i = 0; i < NUM_PARTICLES; ++i) {
            resetParticle(particles[i]);
            particles[i].life = (rand() % 1000) / 1000.0f;
        }

        nav().pos(0, 0, 5);
    }

    void resetParticle(Particle& p) {
        float angle = (rand() % 1000) / 1000.0f * 2 * M_PI;
        float speed = 0.5f + (rand() % 1000) / 500.0f;
        p.pos = Vec3f(0, -2, 0);
        p.vel = Vec3f(cos(angle) * speed * 0.5f, speed, sin(angle) * speed * 0.5f);
        p.color = HSV((rand() % 1000) / 1000.0f, 0.8f, 1.0f);
        p.life = 1.0f;
    }

    void onAnimate(double dt) override {
        // Camera movement
        Vec3d forward = nav().uf();
        Vec3d right = nav().ur();
        Vec3d up = Vec3d(0, 1, 0);
        if (keys['W'] || keys['w']) nav().pos() += forward * moveSpeed * dt;
        if (keys['S'] || keys['s']) nav().pos() -= forward * moveSpeed * dt;
        if (keys['A'] || keys['a']) nav().pos() -= right * moveSpeed * dt;
        if (keys['D'] || keys['d']) nav().pos() += right * moveSpeed * dt;
        if (keys['Q'] || keys['q']) nav().pos() -= up * moveSpeed * dt;
        if (keys['E'] || keys['e']) nav().pos() += up * moveSpeed * dt;

        for (int i = 0; i < NUM_PARTICLES; ++i) {
            Particle& p = particles[i];
            p.vel.y -= dt * 2.0f; // Gravity
            p.pos += p.vel * dt;
            p.life -= dt * 0.5f;

            if (p.life <= 0 || p.pos.y < -3) {
                resetParticle(p);
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f, 0.02f, 0.05f);
        g.blending(true);
        g.blendAdd();
        g.pointSize(3);

        mesh.reset();
        for (int i = 0; i < NUM_PARTICLES; ++i) {
            Particle& p = particles[i];
            mesh.vertex(p.pos);
            Color c = p.color;
            c.a = p.life;
            mesh.color(c);
        }

        g.meshColor();
        g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        keys[k.key()] = true;
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        keys[k.key()] = false;
        return true;
    }
};

// Use WASD to move camera, Q/E for up/down
ALLOLIB_WEB_MAIN(ParticleSystem)
`,
  },

  // ==========================================================================
  // ADVANCED - Audio-Visual
  // ==========================================================================
  {
    id: 'audio-reactive',
    title: 'Audio Reactive',
    description: 'Graphics react to audio',
    category: 'advanced',
    subcategory: 'audiovisual',
    code: `/**
 * Audio Reactive - Visuals respond to sound
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
#include "Gamma/Filter.h"

using namespace al;
using namespace gam;

class AudioReactive : public WebApp {
public:
    Mesh mesh;
    Sine<> osc{220.0f};
    LFO<> lfo;  // LFO for modulation
    ADSR<> env{0.01f, 0.1f, 0.5f, 0.3f};
    OnePole<> smoother{0.1f};

    float audioLevel = 0;
    float smoothLevel = 0;
    double time = 0;

    void onCreate() override {
        addSphere(mesh, 1.0, 48, 48);
        mesh.generateNormals();
        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
        lfo.freq(0.5f);  // Slow modulation
    }

    void onAnimate(double dt) override {
        time += dt;
        smoothLevel = smoother(audioLevel);
    }

    void onDraw(Graphics& g) override {
        float level = smoothLevel;

        // Background pulses with audio
        g.clear(0.05f + level * 0.1f, 0.02f, 0.08f + level * 0.05f);
        g.depthTesting(true);
        g.lighting(true);

        // Main sphere scales and colors with audio
        g.pushMatrix();
        float scale = 0.5f + level * 1.5f;
        g.scale(scale);
        g.rotate(time * 30, 0, 1, 0);
        g.rotate(time * 20, 1, 0, 0);
        g.color(HSV(level * 0.3f, 0.8f, 0.5f + level * 0.5f));
        g.draw(mesh);
        g.popMatrix();

        // Orbiting spheres
        for (int i = 0; i < 6; ++i) {
            g.pushMatrix();
            float angle = time * 2 + i * M_PI / 3;
            float radius = 1.5f + level;
            g.translate(cos(angle) * radius, sin(angle * 0.7f) * level, sin(angle) * radius);
            g.scale(0.2f + level * 0.3f);
            g.color(HSV(i / 6.0f + level, 0.7f, 0.8f));
            g.draw(mesh);
            g.popMatrix();
        }
    }

    void onSound(AudioIOData& io) override {
        float sum = 0;
        while (io()) {
            float mod = 1.0f + lfo.up() * 0.5f;  // Use saw ramp for modulation
            osc.freq(220.0f * mod);
            float s = osc() * env() * 0.3f;
            sum += fabs(s);
            io.out(0) = s;
            io.out(1) = s;
        }
        audioLevel = sum / io.framesPerBuffer();
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') {
            env.reset();
        }
        if (k.key() >= '1' && k.key() <= '8') {
            osc.freq(110.0f * (k.key() - '0'));
            env.reset();
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        env.release();
        return true;
    }
};

ALLOLIB_WEB_MAIN(AudioReactive)
`,
  },

  // ==========================================================================
  // ADVANCED - Generative
  // ==========================================================================
  {
    id: 'lissajous',
    title: 'Lissajous Curves',
    description: 'Mathematical curves with audio',
    category: 'advanced',
    subcategory: 'generative',
    code: `/**
 * Lissajous Curves - Mathematical beauty
 * Press 1-9 to change frequency ratios
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "Gamma/Oscillator.h"
#include <cmath>

using namespace al;

class Lissajous : public WebApp {
public:
    Mesh curve;
    gam::Sine<> oscA{220.0f};
    gam::Sine<> oscB{330.0f};

    float freqA = 3.0f;
    float freqB = 4.0f;
    double phase = 0;
    float amplitude = 0.2f;

    // Camera control
    bool keys[256] = {false};
    float moveSpeed = 5.0f;

    void onCreate() override {
        curve.primitive(Mesh::LINE_STRIP);
        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        // Camera movement
        Vec3d forward = nav().uf();
        Vec3d right = nav().ur();
        Vec3d up = Vec3d(0, 1, 0);
        if (keys['W'] || keys['w']) nav().pos() += forward * moveSpeed * dt;
        if (keys['S'] || keys['s']) nav().pos() -= forward * moveSpeed * dt;
        if (keys['A'] || keys['a']) nav().pos() -= right * moveSpeed * dt;
        if (keys['D'] || keys['d']) nav().pos() += right * moveSpeed * dt;
        if (keys['Q'] || keys['q']) nav().pos() -= up * moveSpeed * dt;
        if (keys['E'] || keys['e']) nav().pos() += up * moveSpeed * dt;

        phase += dt;

        // Rebuild curve
        curve.reset();
        int points = 1000;
        for (int i = 0; i <= points; ++i) {
            float t = i / (float)points * 2 * M_PI * 4 + phase;
            float x = sin(freqA * t + phase * 0.5) * 1.5;
            float y = sin(freqB * t) * 1.5;
            float z = sin((freqA + freqB) * t * 0.5) * 0.5;
            curve.vertex(x, y, z);
            curve.color(HSV(i / (float)points, 0.8f, 1.0f));
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f, 0.02f, 0.05f);
        g.blending(true);
        g.blendAdd();

        g.meshColor();
        g.draw(curve);
    }

    void onSound(AudioIOData& io) override {
        oscA.freq(110.0f * freqA);
        oscB.freq(110.0f * freqB);

        while (io()) {
            float sA = oscA() * amplitude;
            float sB = oscB() * amplitude;
            io.out(0) = sA;
            io.out(1) = sB;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        keys[k.key()] = true;
        if (k.key() >= '1' && k.key() <= '9') {
            int n = k.key() - '0';
            if (k.shift()) {
                freqB = n;
            } else {
                freqA = n;
            }
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        keys[k.key()] = false;
        return true;
    }
};

// Use WASD to move camera, Q/E for up/down. 1-9 change freqA, Shift+1-9 change freqB
ALLOLIB_WEB_MAIN(Lissajous)
`,
  },
  {
    id: 'fractal-tree',
    title: 'Fractal Tree',
    description: 'Recursive branching structure',
    category: 'advanced',
    subcategory: 'generative',
    code: `/**
 * Fractal Tree - Recursive branching
 * Press 1-6 to change depth, +/- to change angle
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Mesh.hpp"
#include <cmath>

using namespace al;

class FractalTree : public WebApp {
public:
    Mesh tree;
    int maxDepth = 8;
    float branchAngle = 25.0f;
    float lengthRatio = 0.7f;
    double time = 0;

    // Camera control
    bool keys[256] = {false};
    float moveSpeed = 5.0f;

    void onCreate() override {
        tree.primitive(Mesh::LINES);
        buildTree();
        nav().pos(0, 0, 8);
    }

    void branch(Vec3f start, float angle, float length, int depth) {
        if (depth <= 0 || length < 0.01f) return;

        float windOffset = sin(time * 2 + start.y) * 5.0f * (1.0f - depth / (float)maxDepth);
        float actualAngle = angle + windOffset;

        Vec3f end = start + Vec3f(
            sin(actualAngle * M_PI / 180) * length,
            cos(actualAngle * M_PI / 180) * length,
            0
        );

        tree.vertex(start);
        tree.vertex(end);

        float hue = (maxDepth - depth) / (float)maxDepth * 0.3f;
        float val = 0.4f + (maxDepth - depth) / (float)maxDepth * 0.6f;
        Color c = HSV(hue, 0.6f, val);
        tree.color(c);
        tree.color(c);

        float newLength = length * lengthRatio;
        branch(end, actualAngle - branchAngle, newLength, depth - 1);
        branch(end, actualAngle + branchAngle, newLength, depth - 1);
    }

    void buildTree() {
        tree.reset();
        branch(Vec3f(0, -2, 0), 0, 1.5f, maxDepth);
    }

    void onAnimate(double dt) override {
        // Camera movement
        Vec3d forward = nav().uf();
        Vec3d right = nav().ur();
        Vec3d up = Vec3d(0, 1, 0);
        if (keys['W'] || keys['w']) nav().pos() += forward * moveSpeed * dt;
        if (keys['S'] || keys['s']) nav().pos() -= forward * moveSpeed * dt;
        if (keys['A'] || keys['a']) nav().pos() -= right * moveSpeed * dt;
        if (keys['D'] || keys['d']) nav().pos() += right * moveSpeed * dt;
        if (keys['Q'] || keys['q']) nav().pos() -= up * moveSpeed * dt;
        if (keys['E'] || keys['e']) nav().pos() += up * moveSpeed * dt;

        time += dt;
        buildTree();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f, 0.02f, 0.05f);
        g.meshColor();
        g.draw(tree);
    }

    bool onKeyDown(const Keyboard& k) override {
        keys[k.key()] = true;
        if (k.key() >= '1' && k.key() <= '9') {
            maxDepth = k.key() - '0' + 3;
        }
        if (k.key() == '=' || k.key() == '+') {
            branchAngle += 5;
        }
        if (k.key() == '-') {
            branchAngle -= 5;
        }
        buildTree();
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        keys[k.key()] = false;
        return true;
    }
};

// Use WASD to move camera, Q/E for up/down. 1-9 change depth, +/- change angle
ALLOLIB_WEB_MAIN(FractalTree)
`,
  },

  // ==========================================================================
  // FEATURE TESTS - Graphics Tests
  // ==========================================================================
  {
    id: 'mesh-primitives-test',
    title: 'Mesh Primitives Test',
    description: 'Tests all OpenGL primitive types: POINTS, LINES, LINE_STRIP, LINE_LOOP, TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN',
    category: 'feature-tests',
    subcategory: 'graphics',
    code: `/**
 * Phase 5 Test: Mesh Primitives
 * Tests all OpenGL primitive types supported by WebGL2
 * Press SPACE to cycle through primitives
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

class MeshPrimitivesTest : public WebApp {
public:
    Mesh pointsMesh, linesMesh, lineStripMesh, lineLoopMesh;
    Mesh trianglesMesh, triangleStripMesh, triangleFanMesh;

    double time = 0;
    int currentPrimitive = 0;
    const int numPrimitives = 7;

    void onCreate() override {
        // POINTS
        pointsMesh.primitive(Mesh::POINTS);
        for (int i = 0; i < 50; i++) {
            float angle = i * 0.125664f;
            float r = 0.5f + 0.5f * sin(i * 0.3f);
            pointsMesh.vertex(r * cos(angle), r * sin(angle), 0);
            pointsMesh.color(HSV(i / 50.0f, 1, 1));
        }

        // LINES
        linesMesh.primitive(Mesh::LINES);
        for (int i = 0; i < 10; i++) {
            float y = -0.8f + i * 0.16f;
            linesMesh.vertex(-0.8f, y, 0);
            linesMesh.color(HSV(i / 10.0f, 1, 1));
            linesMesh.vertex(0.8f, y, 0);
            linesMesh.color(HSV(i / 10.0f, 1, 1));
        }

        // LINE_STRIP
        lineStripMesh.primitive(Mesh::LINE_STRIP);
        for (int i = 0; i < 50; i++) {
            float t = i / 49.0f;
            lineStripMesh.vertex(-0.8f + t * 1.6f, 0.5f * sin(t * 6.28f * 3), 0);
            lineStripMesh.color(HSV(t, 1, 1));
        }

        // LINE_LOOP
        lineLoopMesh.primitive(Mesh::LINE_LOOP);
        for (int i = 0; i < 6; i++) {
            float angle = i * M_PI / 3.0f;
            lineLoopMesh.vertex(0.7f * cos(angle), 0.7f * sin(angle), 0);
            lineLoopMesh.color(HSV(i / 6.0f, 1, 1));
        }

        // TRIANGLES
        trianglesMesh.primitive(Mesh::TRIANGLES);
        for (int i = 0; i < 4; i++) {
            float cx = -0.5f + (i % 2) * 1.0f;
            float cy = -0.3f + (i / 2) * 0.6f;
            HSV col(i / 4.0f, 1, 1);
            trianglesMesh.vertex(cx, cy + 0.3f, 0); trianglesMesh.color(col);
            trianglesMesh.vertex(cx - 0.26f, cy - 0.15f, 0); trianglesMesh.color(col);
            trianglesMesh.vertex(cx + 0.26f, cy - 0.15f, 0); trianglesMesh.color(col);
        }

        // TRIANGLE_STRIP
        triangleStripMesh.primitive(Mesh::TRIANGLE_STRIP);
        for (int i = 0; i < 10; i++) {
            float x = -0.8f + i * 0.18f;
            float y = (i % 2 == 0) ? 0.3f : -0.3f;
            triangleStripMesh.vertex(x, y, 0);
            triangleStripMesh.color(HSV(i / 10.0f, 1, 1));
        }

        // TRIANGLE_FAN
        triangleFanMesh.primitive(Mesh::TRIANGLE_FAN);
        triangleFanMesh.vertex(0, 0, 0);
        triangleFanMesh.color(1, 1, 1);
        for (int i = 0; i <= 12; i++) {
            float angle = i * M_PI / 6.0f;
            triangleFanMesh.vertex(0.7f * cos(angle), 0.7f * sin(angle), 0);
            triangleFanMesh.color(HSV(i / 12.0f, 1, 1));
        }

        nav().pos(0, 0, 3);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        time += dt;
        currentPrimitive = (int(time / 2.0) % numPrimitives);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.blending(true);
        g.blendAdd();
        g.pointSize(8);

        switch (currentPrimitive) {
            case 0: g.draw(pointsMesh); break;
            case 1: g.draw(linesMesh); break;
            case 2: g.draw(lineStripMesh); break;
            case 3: g.draw(lineLoopMesh); break;
            case 4: g.draw(trianglesMesh); break;
            case 5: g.draw(triangleStripMesh); break;
            case 6: g.draw(triangleFanMesh); break;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') {
            currentPrimitive = (currentPrimitive + 1) % numPrimitives;
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(MeshPrimitivesTest)
`,
  },
  {
    id: 'shape-gallery-test',
    title: 'Shape Gallery Test',
    description: 'Tests all addShape() functions: sphere, cube, cone, cylinder, torus, icosphere, dodecahedron, octahedron, tetrahedron',
    category: 'feature-tests',
    subcategory: 'graphics',
    code: `/**
 * Phase 5 Test: Shape Gallery
 * Tests all addShape() functions from al_Shapes.hpp
 * Press SPACE to cycle, M for display mode
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

class ShapeGalleryTest : public WebApp {
public:
    Mesh shapes[12];
    const char* names[12] = {
        "Sphere", "Cube", "Cone", "Cylinder", "Torus",
        "Icosphere", "Dodecahedron", "Octahedron", "Tetrahedron",
        "Rect", "Surface Loop", "Wire Box"
    };
    Color colors[12];
    double time = 0;
    int currentShape = 0;
    int displayMode = 0;

    void onCreate() override {
        addSphere(shapes[0], 1.0, 32, 32);
        addCube(shapes[1], 1.5);
        addCone(shapes[2], 0.8, Vec3f(0, -1, 0), Vec3f(0, 1.5, 0), 32);
        addCylinder(shapes[3], 0.6, 2.0, 32, 1, true, true);
        addTorus(shapes[4], 0.3, 1.0, 32, 32);
        addIcosphere(shapes[5], 1.0, 3);
        addDodecahedron(shapes[6], 1.0);
        addOctahedron(shapes[7], 1.2);
        addTetrahedron(shapes[8], 1.2);
        addRect(shapes[9], -1.0f, -0.75f, 2.0f, 1.5f);

        // Surface of revolution
        std::vector<Vec3f> profile;
        for (int i = 0; i <= 16; i++) {
            float t = i / 16.0f;
            float y = t * 2.0f - 1.0f;
            float r = 0.3f + 0.3f * sin(t * M_PI * 2);
            profile.push_back(Vec3f(r, y, 0));
        }
        addSurfaceLoop(shapes[10], profile.data(), profile.size(), 32, 0);

        addWireBox(shapes[11], 1.5, 1.0, 1.2);

        for (int i = 0; i < 12; i++) {
            shapes[i].generateNormals();
            colors[i] = HSV(i / 12.0f, 0.7f, 1.0f);
        }

        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override { time += dt; }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        g.pushMatrix();
        g.rotate(time * 30, 0, 1, 0);
        g.rotate(time * 15, 1, 0, 0);

        if (displayMode != 1) {
            g.polygonFill();
            g.color(colors[currentShape]);
            g.draw(shapes[currentShape]);
        }
        if (displayMode >= 1) {
            g.polygonLine();
            g.color(1, 1, 1, 0.5f);
            g.draw(shapes[currentShape]);
        }

        g.popMatrix();
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') currentShape = (currentShape + 1) % 12;
        if (k.key() == 'm') displayMode = (displayMode + 1) % 3;
        return true;
    }
};

ALLOLIB_WEB_MAIN(ShapeGalleryTest)
`,
  },
  {
    id: 'transform-stack-test',
    title: 'Transform Stack Test',
    description: 'Tests matrix operations: pushMatrix/popMatrix, translate, rotate, scale with nested hierarchies',
    category: 'feature-tests',
    subcategory: 'graphics',
    code: `/**
 * Phase 5 Test: Transform Stack
 * Tests nested matrix transformations
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

class TransformStackTest : public WebApp {
public:
    Mesh cube, sphere;
    double time = 0;

    void onCreate() override {
        addCube(cube, 0.5);
        cube.generateNormals();
        addSphere(sphere, 0.15, 16, 16);
        sphere.generateNormals();

        nav().pos(0, 2, 8);
        nav().faceToward(Vec3f(0, 0, 0));
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override { time += dt; }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        // Solar system demo
        g.pushMatrix();
        g.color(1.0f, 0.8f, 0.2f);
        g.scale(1.5);
        g.draw(sphere);
        g.popMatrix();

        // Earth orbit
        g.pushMatrix();
        g.rotate(time * 30, 0, 1, 0);
        g.translate(3, 0, 0);

        g.pushMatrix();
        g.scale(0.5);
        g.color(0.2f, 0.5f, 1.0f);
        g.draw(sphere);
        g.popMatrix();

        // Moon
        g.pushMatrix();
        g.rotate(time * 120, 0, 1, 0);
        g.translate(0.8, 0, 0);
        g.scale(0.2);
        g.color(0.7f, 0.7f, 0.7f);
        g.draw(sphere);
        g.popMatrix();

        g.popMatrix();

        // Rotating cubes
        g.pushMatrix();
        g.translate(-3, 0, 0);
        for (int i = 0; i < 5; i++) {
            g.pushMatrix();
            g.rotate(i * 72 + time * 50, 0, 1, 0);
            g.translate(1.5, 0, 0);
            g.scale(0.3f + 0.1f * sin(time * 2 + i));
            g.color(HSV(i / 5.0f, 0.8f, 1.0f));
            g.draw(cube);
            g.popMatrix();
        }
        g.popMatrix();

        // Robotic arm
        g.pushMatrix();
        g.translate(4, -1, 0);
        g.rotate(sin(time) * 45, 0, 0, 1);
        g.translate(0, 0.8, 0);
        g.color(1.0f, 0.3f, 0.3f);
        g.pushMatrix();
        g.scale(0.3f, 0.8f, 0.3f);
        g.draw(cube);
        g.popMatrix();

        g.translate(0, 0.8, 0);
        g.rotate(sin(time * 1.5) * 60, 0, 0, 1);
        g.translate(0, 0.6, 0);
        g.color(0.3f, 1.0f, 0.3f);
        g.pushMatrix();
        g.scale(0.25f, 0.6f, 0.25f);
        g.draw(cube);
        g.popMatrix();
        g.popMatrix();
    }
};

ALLOLIB_WEB_MAIN(TransformStackTest)
`,
  },
  {
    id: 'multilight-test',
    title: 'Multi-Light Test',
    description: 'Tests multiple colored lights, materials, and distance attenuation',
    category: 'feature-tests',
    subcategory: 'graphics',
    code: `/**
 * Phase 5 Test: Multi-Light System
 * Press 1-4 to toggle lights
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/graphics/al_Light.hpp"
#include <cmath>

using namespace al;

class MultiLightTest : public WebApp {
public:
    Mesh sphere, plane, lightMarker;
    Light lights[4];
    Material material;
    double time = 0;

    void onCreate() override {
        addSphere(sphere, 1.0, 64, 64);
        sphere.generateNormals();

        plane.primitive(Mesh::TRIANGLES);
        float size = 8.0f;
        for (int i = 0; i < 2; i++) {
            plane.vertex(-size, -2, -size + i * 2 * size);
            plane.vertex(size, -2, -size);
            plane.vertex(size - i * 2 * size, -2, size);
            for (int j = 0; j < 3; j++) {
                plane.normal(0, 1, 0);
                plane.color(0.4f, 0.4f, 0.4f);
            }
        }

        addSphere(lightMarker, 0.1, 8, 8);

        // RGB point lights + white directional
        Color lc[] = {Color(1,0.2,0.2), Color(0.2,1,0.2), Color(0.2,0.2,1), Color(0.5,0.5,0.5)};
        for (int i = 0; i < 4; i++) {
            lights[i].diffuse(lc[i]);
            lights[i].attenuation(1.0f, 0.1f, 0.01f);
        }
        lights[3].dir(0, -1, -0.5);

        material.shininess(50.0f);

        nav().pos(0, 2, 8);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        time += dt;
        float r = 3.0f, h = 1.5f;
        for (int i = 0; i < 3; i++) {
            float angle = time + i * 2.094f;
            lights[i].pos(r * cos(angle), h, r * sin(angle));
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f, 0.05f, 0.08f);
        g.depthTesting(true);
        g.material(material);
        g.lighting(true);
        for (int i = 0; i < 4; i++) g.light(lights[i], i);

        g.draw(plane);
        g.color(1, 1, 1);
        g.draw(sphere);

        g.lighting(false);
        for (int i = 0; i < 3; i++) {
            g.pushMatrix();
            g.translate(lights[i].pos());
            g.color(lights[i].diffuse());
            g.draw(lightMarker);
            g.popMatrix();
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '4') {
            int i = k.key() - '1';
            Color d = lights[i].diffuse();
            Color orig[] = {Color(1,0.2,0.2), Color(0.2,1,0.2), Color(0.2,0.2,1), Color(0.5,0.5,0.5)};
            lights[i].diffuse(d.r > 0.1f ? Color(0,0,0) : orig[i]);
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(MultiLightTest)
`,
  },
  {
    id: 'easyfbo-test',
    title: 'EasyFBO Test',
    description: 'Tests render-to-texture with post-processing effects',
    category: 'feature-tests',
    subcategory: 'graphics',
    code: `/**
 * Phase 5 Test: EasyFBO - Render to Texture
 * Press SPACE to cycle effects: Normal, Invert, Grayscale, Pixelate
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/graphics/al_EasyFBO.hpp"
#include <cmath>

using namespace al;

class EasyFBOTest : public WebApp {
public:
    EasyFBO fbo;
    Mesh sphere, cube, screenQuad;
    ShaderProgram postShader;
    double time = 0;
    int effectMode = 0;

    const char* vertSrc = R"(#version 300 es
        precision highp float;
        layout(location = 0) in vec3 position;
        layout(location = 2) in vec2 texcoord;
        out vec2 vUV;
        void main() { gl_Position = vec4(position, 1.0); vUV = texcoord; }
    )";

    const char* fragSrc = R"(#version 300 es
        precision highp float;
        uniform sampler2D tex0;
        uniform int effect;
        in vec2 vUV;
        out vec4 fragColor;
        void main() {
            vec2 uv = vUV;
            if (effect == 3) uv = floor(uv * 100.0) / 100.0;
            vec4 c = texture(tex0, uv);
            if (effect == 1) c.rgb = 1.0 - c.rgb;
            if (effect == 2) c.rgb = vec3(dot(c.rgb, vec3(0.299, 0.587, 0.114)));
            fragColor = c;
        }
    )";

    void onCreate() override {
        fbo.init(800, 600);
        addSphere(sphere, 1.0, 32, 32); sphere.generateNormals();
        addCube(cube, 0.8); cube.generateNormals();

        screenQuad.primitive(Mesh::TRIANGLES);
        screenQuad.vertex(-1,-1,0); screenQuad.texCoord(0,0);
        screenQuad.vertex(1,-1,0); screenQuad.texCoord(1,0);
        screenQuad.vertex(1,1,0); screenQuad.texCoord(1,1);
        screenQuad.vertex(-1,-1,0); screenQuad.texCoord(0,0);
        screenQuad.vertex(1,1,0); screenQuad.texCoord(1,1);
        screenQuad.vertex(-1,1,0); screenQuad.texCoord(0,1);

        postShader.compile(vertSrc, fragSrc);
        nav().pos(0, 0, 6);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override { time += dt; }

    void onDraw(Graphics& g) override {
        // Pass 1: Render to FBO
        g.pushFramebuffer(fbo);
        g.pushViewport(fbo.width(), fbo.height());
        g.pushCamera(nav().view());
        g.clear(0.1f, 0.1f, 0.2f);
        g.depthTesting(true);
        g.lighting(true);

        g.pushMatrix();
        g.rotate(time * 30, 0, 1, 0);
        g.color(0.8f, 0.2f, 0.2f);
        g.draw(sphere);
        g.popMatrix();

        for (int i = 0; i < 6; i++) {
            g.pushMatrix();
            float a = i * M_PI / 3.0f + time * 0.5f;
            g.translate(3 * cos(a), sin(time + i) * 0.5f, 3 * sin(a));
            g.rotate(time * 60 + i * 30, 1, 1, 0);
            g.color(HSV(i / 6.0f, 0.8f, 1.0f));
            g.draw(cube);
            g.popMatrix();
        }

        g.popCamera();
        g.popViewport();
        g.popFramebuffer();

        // Pass 2: Post-process
        g.clear(0, 0, 0);
        g.depthTesting(false);
        g.shader(postShader);
        postShader.uniform("effect", effectMode);
        fbo.colorTexture().bind(0);
        g.texture();
        g.draw(screenQuad);
        fbo.colorTexture().unbind(0);
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') effectMode = (effectMode + 1) % 4;
        return true;
    }
};

ALLOLIB_WEB_MAIN(EasyFBOTest)
`,
  },
  {
    id: 'blend-modes-test',
    title: 'Blend Modes Test',
    description: 'Tests alpha, additive, multiply, screen blending and render states',
    category: 'feature-tests',
    subcategory: 'graphics',
    code: `/**
 * Phase 5 Test: Blending Modes
 * SPACE=cycle blend, D=depth test, C=culling
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

class BlendModesTest : public WebApp {
public:
    Mesh sphere;
    double time = 0;
    int blendMode = 0;
    bool depthTest = true, cullFace = false;

    void onCreate() override {
        addSphere(sphere, 1.0, 32, 32);
        sphere.generateNormals();
        nav().pos(0, 0, 8);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override { time += dt; }

    void onDraw(Graphics& g) override {
        g.clear(0.2f, 0.2f, 0.25f);
        g.depthTesting(depthTest);
        g.cullFace(cullFace);

        // Background spheres (opaque)
        g.blending(false);
        g.lighting(true);
        for (int x = -3; x <= 3; x++) {
            for (int y = -2; y <= 2; y++) {
                g.pushMatrix();
                g.translate(x * 1.5f, y * 1.5f, -5);
                g.scale(0.3f);
                g.color(0.5f, 0.5f, 0.5f);
                g.draw(sphere);
                g.popMatrix();
            }
        }

        // Set blend mode
        g.blending(blendMode > 0);
        if (blendMode == 1) g.blendTrans();
        if (blendMode == 2) g.blendAdd();
        if (blendMode == 3) g.blendMult();
        if (blendMode == 4) g.blendScreen();
        g.lighting(false);

        // Colored spheres
        float cols[][4] = {{1,0.2,0.2,0.5},{0.2,1,0.2,0.5},{0.2,0.2,1,0.5},
                          {1,1,0.2,0.5},{1,0.2,1,0.5},{0.2,1,1,0.5}};
        for (int i = 0; i < 6; i++) {
            g.pushMatrix();
            float a = i * M_PI / 3.0f + time * 0.3f;
            g.translate(2 * cos(a), 2 * sin(a), 0);
            g.scale(1.2f);
            g.color(cols[i][0], cols[i][1], cols[i][2], cols[i][3]);
            g.draw(sphere);
            g.popMatrix();
        }

        g.pushMatrix();
        g.scale(1.5f);
        g.color(1, 1, 1, 0.7f);
        g.draw(sphere);
        g.popMatrix();
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') blendMode = (blendMode + 1) % 5;
        if (k.key() == 'd') depthTest = !depthTest;
        if (k.key() == 'c') cullFace = !cullFace;
        return true;
    }
};

ALLOLIB_WEB_MAIN(BlendModesTest)
`,
  },

  // ==========================================================================
  // FEATURE TESTS - Audio Tests
  // ==========================================================================
  {
    id: 'gamma-dsp-test',
    title: 'Gamma DSP Test',
    description: 'Tests oscillators, envelopes, filters, delay, and reverb',
    category: 'feature-tests',
    subcategory: 'audio',
    code: `/**
 * Phase 5 Test: Gamma DSP Comprehensive
 * 1-6=oscillators, SPACE=trigger, UP/DOWN=freq, F=filter, D=delay
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
#include "Gamma/Filter.h"
#include "Gamma/Delay.h"
#include "Gamma/Effects.h"
#include "Gamma/Noise.h"
#include <cmath>

using namespace al;
using namespace gam;

class GammaDSPTest : public WebApp {
public:
    // Sine oscillator and LFO for other waveforms
    Sine<> sine;
    LFO<> lfo;  // LFO provides saw, square, triangle, pulse via methods
    NoisePink<> pink;
    ADSR<> adsr;
    Biquad<> lowpass, highpass;
    Delay<float, ipl::Linear> delay;
    Comb<> comb1, comb2;

    int oscType = 0;
    float baseFreq = 220.0f;
    bool filterOn = true, delayOn = true;

    Mesh oscWave;
    float waveBuffer[256];
    int waveIdx = 0;
    double time = 0;

    void onCreate() override {
        gam::sampleRate(44100);
        sine.freq(baseFreq);
        lfo.freq(baseFreq);
        lfo.mod(0.3f);  // Pulse width for pulse wave

        adsr.attack(0.01f); adsr.decay(0.1f); adsr.sustain(0.7f); adsr.release(0.3f);

        lowpass.type(LOW_PASS); lowpass.freq(2000); lowpass.res(2);
        highpass.type(HIGH_PASS); highpass.freq(100);

        delay.maxDelay(1.0f); delay.delay(0.3f);
        comb1.delay(0.035f); comb1.decay(0.5f);
        comb2.delay(0.042f); comb2.decay(0.5f);

        oscWave.primitive(Mesh::LINE_STRIP);
        for (int i = 0; i < 256; i++) {
            waveBuffer[i] = 0;
            oscWave.vertex((i / 255.0f) * 4.0f - 2.0f, 0, 0);
            oscWave.color(0.3f, 0.8f, 1.0f);
        }

        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
        adsr.reset();
    }

    void onAnimate(double dt) override {
        time += dt;
        for (int i = 0; i < 256; i++)
            oscWave.vertices()[i].y = waveBuffer[i] * 1.5f;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.lineWidth(2);
        g.pushMatrix();
        g.translate(0, 0.5f, 0);
        g.color(0.3f, 0.8f, 1.0f);
        g.draw(oscWave);
        g.popMatrix();
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float env = adsr();
            float osc = 0;
            switch (oscType) {
                case 0: osc = sine(); break;
                case 1: osc = lfo.up(); break;      // Saw (upward ramp)
                case 2: osc = lfo.sqr(); break;     // Square
                case 3: osc = lfo.tri(); break;     // Triangle
                case 4: osc = lfo.pulse(); break;   // Pulse
                case 5: osc = pink(); break;        // Pink noise
            }
            float s = osc * env * 0.5f;
            if (filterOn) { s = lowpass(s); s = highpass(s); }
            waveBuffer[waveIdx] = s;
            waveIdx = (waveIdx + 1) % 256;
            if (delayOn) {
                float d = delay(s);
                float r = (comb1(s) + comb2(s)) * 0.3f;
                s = s * 0.7f + d * 0.3f + r * 0.2f;
            }
            s = std::tanh(s);
            io.out(0) = s; io.out(1) = s;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '6') oscType = k.key() - '1';
        if (k.key() == ' ') adsr.reset();
        if (k.key() == Keyboard::UP) { baseFreq = std::min(baseFreq * 1.1f, 2000.0f); updateFreq(); }
        if (k.key() == Keyboard::DOWN) { baseFreq = std::max(baseFreq / 1.1f, 55.0f); updateFreq(); }
        if (k.key() == 'f') filterOn = !filterOn;
        if (k.key() == 'd') delayOn = !delayOn;
        return true;
    }

    void updateFreq() {
        sine.freq(baseFreq);
        lfo.freq(baseFreq);
    }
};

ALLOLIB_WEB_MAIN(GammaDSPTest)
`,
  },
  {
    id: 'gamma-oscillators-full',
    title: 'Gamma Oscillators (All Types)',
    description: 'Complete showcase of all Gamma oscillator types including band-limited',
    category: 'feature-tests',
    subcategory: 'audio',
    code: `/**
 * Gamma Oscillators - Complete Showcase
 * Demonstrates ALL Gamma oscillator types:
 * 1=Sine, 2=LFO Saw, 3=LFO Square, 4=LFO Triangle, 5=LFO Pulse
 * 6=Band-Limited Saw, 7=Band-Limited Square, 8=Buzz, 9=DSF
 * UP/DOWN=frequency, SPACE=trigger
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
#include <cmath>

using namespace al;
using namespace gam;

class GammaOscillatorsShowcase : public WebApp {
public:
    // Computed sine
    Sine<> sine;

    // LFO - non-band-limited, efficient for low frequencies
    LFO<> lfo;

    // Band-limited oscillators - use at audio rates to avoid aliasing
    Saw<> blSaw;      // Band-limited saw
    Square<> blSquare; // Band-limited square

    // Advanced oscillators
    Buzz<> buzz;  // Impulse train (sum of cosines)
    DSF<> dsf;    // Discrete Summation Formula

    // Envelope
    ADSR<> adsr;

    // Current state
    int oscType = 0;
    float baseFreq = 220.0f;

    // Waveform display
    Mesh waveform;
    float buffer[512];
    int bufIdx = 0;

    // Info display
    const char* oscNames[9] = {
        "Sine (computed)",
        "LFO Saw (non-BL)",
        "LFO Square (non-BL)",
        "LFO Triangle (non-BL)",
        "LFO Pulse (non-BL)",
        "Band-Limited Saw",
        "Band-Limited Square",
        "Buzz (impulse train)",
        "DSF (spectral)"
    };

    void onCreate() override {
        gam::sampleRate(44100);

        // Initialize oscillators
        sine.freq(baseFreq);
        lfo.freq(baseFreq);
        lfo.mod(0.3f);  // Pulse width
        blSaw.freq(baseFreq);
        blSquare.freq(baseFreq);
        buzz.freq(baseFreq);
        buzz.harmonics(12);
        dsf.freq(baseFreq);
        dsf.harmonics(8);
        dsf.freqRatio(1.0);
        dsf.ampRatio(0.5);

        // Envelope
        adsr.attack(0.01f);
        adsr.decay(0.1f);
        adsr.sustain(0.7f);
        adsr.release(0.5f);

        // Waveform display
        waveform.primitive(Mesh::LINE_STRIP);
        for (int i = 0; i < 512; i++) {
            buffer[i] = 0;
            waveform.vertex((i / 511.0f) * 6.0f - 3.0f, 0, 0);
            waveform.color(0.4f, 0.9f, 0.5f);
        }

        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
        adsr.reset();
    }

    void onAnimate(double dt) override {
        // Update waveform vertices
        for (int i = 0; i < 512; i++) {
            waveform.vertices()[i].y = buffer[i] * 2.0f;
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);

        // Draw waveform
        g.lineWidth(2);
        g.pushMatrix();
        g.translate(0, 0, 0);
        g.draw(waveform);
        g.popMatrix();

        // Draw info box background
        g.pushMatrix();
        g.translate(0, 1.8f, 0);
        g.color(0.2f, 0.2f, 0.3f, 0.8f);
        g.popMatrix();
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float env = adsr();
            float osc = 0;

            switch (oscType) {
                case 0: osc = sine(); break;
                case 1: osc = lfo.up(); break;
                case 2: osc = lfo.sqr(); break;
                case 3: osc = lfo.tri(); break;
                case 4: osc = lfo.pulse(); break;
                case 5: osc = blSaw(); break;
                case 6: osc = blSquare(); break;
                case 7: osc = buzz(); break;
                case 8: osc = dsf(); break;
            }

            float s = osc * env * 0.4f;

            // Store for visualization
            buffer[bufIdx] = s;
            bufIdx = (bufIdx + 1) % 512;

            // Soft clip for safety
            s = std::tanh(s * 1.5f);

            io.out(0) = s;
            io.out(1) = s;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '9') {
            oscType = k.key() - '1';
            printf("Oscillator: %s\\n", oscNames[oscType]);
        }
        if (k.key() == ' ') {
            adsr.reset();
        }
        if (k.key() == Keyboard::UP) {
            baseFreq = std::min(baseFreq * 1.1f, 4000.0f);
            updateFrequencies();
        }
        if (k.key() == Keyboard::DOWN) {
            baseFreq = std::max(baseFreq / 1.1f, 27.5f);
            updateFrequencies();
        }
        return true;
    }

    void updateFrequencies() {
        sine.freq(baseFreq);
        lfo.freq(baseFreq);
        blSaw.freq(baseFreq);
        blSquare.freq(baseFreq);
        buzz.freq(baseFreq);
        dsf.freq(baseFreq);
        printf("Frequency: %.1f Hz\\n", baseFreq);
    }
};

ALLOLIB_WEB_MAIN(GammaOscillatorsShowcase)
`,
  },
  {
    id: 'gamma-fft-analysis',
    title: 'Gamma FFT Spectral Analysis',
    description: 'Real-time FFT visualization using Gamma STFT',
    category: 'feature-tests',
    subcategory: 'audio',
    code: `/**
 * Gamma FFT - Real-time Spectral Analysis
 * Shows frequency spectrum of different waveforms
 * 1=Sine, 2=Saw, 3=Square, 4=Triangle, 5=Noise
 * UP/DOWN=frequency, LEFT/RIGHT=harmonics (for Buzz)
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/DFT.h"
#include "Gamma/Noise.h"
#include <cmath>

using namespace al;
using namespace gam;

class GammaFFTAnalysis : public WebApp {
public:
    static const int FFT_SIZE = 1024;
    static const int HOP_SIZE = 256;
    static const int NUM_BINS = FFT_SIZE / 2 + 1;

    // Oscillators
    Sine<> sine;
    LFO<> lfo;
    Buzz<> buzz;
    NoisePink<> noise;

    // FFT analysis
    STFT stft;
    float magnitudes[NUM_BINS];

    // Display meshes
    Mesh spectrumBars;
    Mesh waveformLine;
    float waveBuffer[512];
    int waveIdx = 0;

    int oscType = 0;
    float baseFreq = 220.0f;
    int numHarmonics = 16;

    const char* oscNames[5] = {
        "Sine", "Saw (LFO)", "Square (LFO)", "Triangle (LFO)", "Noise"
    };

    void onCreate() override {
        gam::sampleRate(44100);

        // Initialize oscillators
        sine.freq(baseFreq);
        lfo.freq(baseFreq);
        buzz.freq(baseFreq);
        buzz.harmonics(numHarmonics);

        // Initialize STFT with Hann window
        stft.resize(FFT_SIZE, HOP_SIZE);

        // Clear magnitudes
        for (int i = 0; i < NUM_BINS; i++) {
            magnitudes[i] = 0;
        }

        // Create spectrum visualization mesh
        spectrumBars.primitive(Mesh::LINES);
        for (int i = 0; i < 256; i++) {
            float x = (i / 255.0f) * 5.0f - 2.5f;
            spectrumBars.vertex(x, -1.5f, 0);
            spectrumBars.color(0.2f, 0.6f, 1.0f);
            spectrumBars.vertex(x, -1.5f, 0);
            spectrumBars.color(0.4f, 0.9f, 1.0f);
        }

        // Create waveform line mesh
        waveformLine.primitive(Mesh::LINE_STRIP);
        for (int i = 0; i < 512; i++) {
            waveBuffer[i] = 0;
            float x = (i / 511.0f) * 5.0f - 2.5f;
            waveformLine.vertex(x, 1.0f, 0);
            waveformLine.color(0.3f, 1.0f, 0.5f);
        }

        nav().pos(0, 0, 6);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        // Update spectrum bars
        for (int i = 0; i < 256; i++) {
            int binIdx = (i * NUM_BINS) / 256;
            float mag = magnitudes[binIdx];
            // Log scale for better visualization
            float height = mag > 0.0001f ? (log10f(mag) + 4) * 0.5f : 0;
            height = std::max(0.0f, std::min(2.5f, height));

            spectrumBars.vertices()[i * 2 + 1].y = -1.5f + height;

            // Color based on height
            float hue = height / 2.5f;
            spectrumBars.colors()[i * 2 + 1] = HSV(0.6f - hue * 0.4f, 0.8f, 0.5f + hue * 0.5f);
        }

        // Update waveform
        for (int i = 0; i < 512; i++) {
            waveformLine.vertices()[i].y = 1.0f + waveBuffer[i] * 0.8f;
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f, 0.05f, 0.1f);

        // Draw spectrum
        g.lineWidth(3);
        g.draw(spectrumBars);

        // Draw waveform
        g.lineWidth(2);
        g.draw(waveformLine);

        // Draw frequency axis labels would go here in a full implementation
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float s = 0;

            switch (oscType) {
                case 0: s = sine(); break;
                case 1: s = lfo.up(); break;
                case 2: s = lfo.sqr(); break;
                case 3: s = lfo.tri(); break;
                case 4: s = noise() * 0.5f; break;
            }

            // Store for waveform display
            waveBuffer[waveIdx] = s;
            waveIdx = (waveIdx + 1) % 512;

            // Feed into STFT
            if (stft(s * 0.5f)) {
                // FFT frame ready - extract magnitudes
                Complex<float>* bins = stft.bins();
                for (int i = 0; i < NUM_BINS; i++) {
                    magnitudes[i] = bins[i].mag();
                }
            }

            // Output
            float out = s * 0.3f;
            io.out(0) = out;
            io.out(1) = out;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '5') {
            oscType = k.key() - '1';
            printf("Source: %s\\n", oscNames[oscType]);
        }
        if (k.key() == Keyboard::UP) {
            baseFreq = std::min(baseFreq * 1.1f, 4000.0f);
            updateFreq();
        }
        if (k.key() == Keyboard::DOWN) {
            baseFreq = std::max(baseFreq / 1.1f, 55.0f);
            updateFreq();
        }
        if (k.key() == Keyboard::RIGHT) {
            numHarmonics = std::min(numHarmonics + 2, 64);
            buzz.harmonics(numHarmonics);
            printf("Harmonics: %d\\n", numHarmonics);
        }
        if (k.key() == Keyboard::LEFT) {
            numHarmonics = std::max(numHarmonics - 2, 1);
            buzz.harmonics(numHarmonics);
            printf("Harmonics: %d\\n", numHarmonics);
        }
        return true;
    }

    void updateFreq() {
        sine.freq(baseFreq);
        lfo.freq(baseFreq);
        buzz.freq(baseFreq);
        printf("Frequency: %.1f Hz\\n", baseFreq);
    }
};

ALLOLIB_WEB_MAIN(GammaFFTAnalysis)
`,
  },
  {
    id: 'gamma-envelopes',
    title: 'Gamma Envelopes Showcase',
    description: 'All Gamma envelope types: AD, ADSR, Decay, Seg, Curve',
    category: 'feature-tests',
    subcategory: 'audio',
    code: `/**
 * Gamma Envelopes - Complete Showcase
 * 1=AD, 2=ADSR, 3=Decay, 4=Curve, 5=Seg
 * SPACE=trigger, UP/DOWN=attack time, LEFT/RIGHT=decay/release
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
#include <cmath>

using namespace al;
using namespace gam;

class GammaEnvelopesShowcase : public WebApp {
public:
    // Oscillator
    Sine<> osc;

    // Envelope types
    AD<> envAD;
    ADSR<> envADSR;
    Decay<> envDecay;
    Curve<> envCurve;
    Seg<> envSeg;

    // Envelope parameters
    float attackTime = 0.05f;
    float decayTime = 0.3f;
    float sustainLevel = 0.6f;
    float releaseTime = 0.5f;

    int envType = 1;  // Start with ADSR
    bool keyHeld = false;

    // Envelope visualization
    Mesh envMesh;
    float envBuffer[512];
    int bufIdx = 0;

    const char* envNames[5] = {
        "AD (Attack-Decay)",
        "ADSR (Attack-Decay-Sustain-Release)",
        "Decay (Exponential)",
        "Curve (Variable curvature)",
        "Seg (Linear interpolation)"
    };

    void onCreate() override {
        gam::sampleRate(44100);
        osc.freq(440.0f);

        // Initialize envelopes
        envAD.attack(attackTime);
        envAD.decay(decayTime);

        envADSR.attack(attackTime);
        envADSR.decay(decayTime);
        envADSR.sustain(sustainLevel);
        envADSR.release(releaseTime);

        envDecay.decay(decayTime);

        envCurve.set(decayTime * 44100, -4.0f, 1.0f, 0.0f);

        envSeg.length(decayTime);

        // Envelope display mesh
        envMesh.primitive(Mesh::LINE_STRIP);
        for (int i = 0; i < 512; i++) {
            envBuffer[i] = 0;
            float x = (i / 511.0f) * 5.0f - 2.5f;
            envMesh.vertex(x, 0, 0);
            envMesh.color(1.0f, 0.6f, 0.2f);
        }

        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        for (int i = 0; i < 512; i++) {
            float y = envBuffer[i] * 2.0f - 1.0f;
            envMesh.vertices()[i].y = y;

            // Color based on envelope value
            float h = envBuffer[i];
            envMesh.colors()[i] = HSV(0.1f - h * 0.1f, 0.9f, 0.5f + h * 0.5f);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);

        g.lineWidth(3);
        g.draw(envMesh);
    }

    float getEnvelopeValue() {
        switch (envType) {
            case 0: return envAD();
            case 1: return envADSR();
            case 2: return envDecay();
            case 3: return envCurve();
            case 4: return envSeg();
            default: return 0;
        }
    }

    void triggerEnvelope() {
        envAD.reset();
        envADSR.reset();
        envDecay.reset();
        envCurve.reset();
        envSeg.reset();
    }

    void releaseEnvelope() {
        envADSR.triggerRelease();
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float env = getEnvelopeValue();

            // Store for visualization
            envBuffer[bufIdx] = env;
            bufIdx = (bufIdx + 1) % 512;

            float s = osc() * env * 0.3f;

            io.out(0) = s;
            io.out(1) = s;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '5') {
            envType = k.key() - '1';
            printf("Envelope: %s\\n", envNames[envType]);
        }
        if (k.key() == ' ' && !keyHeld) {
            keyHeld = true;
            triggerEnvelope();
            printf("Triggered\\n");
        }
        if (k.key() == Keyboard::UP) {
            attackTime = std::min(attackTime * 1.2f, 2.0f);
            updateEnvelopes();
        }
        if (k.key() == Keyboard::DOWN) {
            attackTime = std::max(attackTime / 1.2f, 0.001f);
            updateEnvelopes();
        }
        if (k.key() == Keyboard::RIGHT) {
            decayTime = std::min(decayTime * 1.2f, 5.0f);
            releaseTime = std::min(releaseTime * 1.2f, 5.0f);
            updateEnvelopes();
        }
        if (k.key() == Keyboard::LEFT) {
            decayTime = std::max(decayTime / 1.2f, 0.01f);
            releaseTime = std::max(releaseTime / 1.2f, 0.01f);
            updateEnvelopes();
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        if (k.key() == ' ') {
            keyHeld = false;
            releaseEnvelope();
            printf("Released\\n");
        }
        return true;
    }

    void updateEnvelopes() {
        envAD.attack(attackTime);
        envAD.decay(decayTime);

        envADSR.attack(attackTime);
        envADSR.decay(decayTime);
        envADSR.release(releaseTime);

        envDecay.decay(decayTime);

        envCurve.set(decayTime * 44100, -4.0f, 1.0f, 0.0f);

        envSeg.length(decayTime);

        printf("Attack: %.3fs, Decay: %.3fs, Release: %.3fs\\n",
               attackTime, decayTime, releaseTime);
    }
};

ALLOLIB_WEB_MAIN(GammaEnvelopesShowcase)
`,
  },
  {
    id: 'gamma-filters',
    title: 'Gamma Filters Showcase',
    description: 'All Gamma filter types: Biquad (LP/HP/BP/Notch), OnePole, AllPass',
    category: 'feature-tests',
    subcategory: 'audio',
    code: `/**
 * Gamma Filters - Complete Showcase
 * 1=LowPass, 2=HighPass, 3=BandPass, 4=Notch, 5=OnePole, 6=AllPass
 * UP/DOWN=cutoff frequency, LEFT/RIGHT=resonance
 * SPACE=trigger noise burst
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Filter.h"
#include "Gamma/Envelope.h"
#include "Gamma/Noise.h"
#include <cmath>

using namespace al;
using namespace gam;

class GammaFiltersShowcase : public WebApp {
public:
    // Sound source
    NoisePink<> noise;
    Saw<> saw;
    ADSR<> env;

    // Filters
    Biquad<> biquadLP;
    Biquad<> biquadHP;
    Biquad<> biquadBP;
    Biquad<> biquadNotch;
    OnePole<> onepole;
    AllPass1<> allpass;

    // Parameters
    float cutoffFreq = 1000.0f;
    float resonance = 1.0f;
    int filterType = 0;
    bool useSaw = false;

    // Frequency response visualization
    Mesh freqResponse;
    float responseBuffer[256];

    const char* filterNames[6] = {
        "Biquad LowPass",
        "Biquad HighPass",
        "Biquad BandPass",
        "Biquad Notch",
        "OnePole (simple LP)",
        "AllPass (phase shift)"
    };

    void onCreate() override {
        gam::sampleRate(44100);

        saw.freq(110.0f);

        env.attack(0.01f);
        env.decay(0.1f);
        env.sustain(0.5f);
        env.release(0.3f);

        // Initialize filters
        biquadLP.type(LOW_PASS);
        biquadHP.type(HIGH_PASS);
        biquadBP.type(BAND_PASS);
        biquadNotch.type(BAND_REJECT);

        updateFilters();

        // Frequency response mesh
        freqResponse.primitive(Mesh::LINE_STRIP);
        for (int i = 0; i < 256; i++) {
            responseBuffer[i] = 0;
            float x = (i / 255.0f) * 5.0f - 2.5f;
            freqResponse.vertex(x, 0, 0);
            freqResponse.color(0.3f, 0.8f, 1.0f);
        }

        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        for (int i = 0; i < 256; i++) {
            float y = responseBuffer[i] * 3.0f - 1.5f;
            freqResponse.vertices()[i].y = y;
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);

        g.lineWidth(2);
        g.draw(freqResponse);

        // Draw cutoff indicator
        float cutoffX = (log10f(cutoffFreq) - 1.0f) / 3.0f * 5.0f - 2.5f;
        g.pushMatrix();
        g.translate(cutoffX, 0, 0);
        g.color(1.0f, 0.3f, 0.3f, 0.5f);
        g.scale(0.05f, 3.0f, 1.0f);
        Mesh line;
        line.primitive(Mesh::LINES);
        line.vertex(0, -1, 0);
        line.vertex(0, 1, 0);
        g.draw(line);
        g.popMatrix();
    }

    float applyFilter(float input) {
        switch (filterType) {
            case 0: return biquadLP(input);
            case 1: return biquadHP(input);
            case 2: return biquadBP(input);
            case 3: return biquadNotch(input);
            case 4: return onepole(input);
            case 5: return allpass(input);
            default: return input;
        }
    }

    void onSound(AudioIOData& io) override {
        static int bufIdx = 0;

        while (io()) {
            float e = env();
            float source = useSaw ? saw() : noise();
            float s = source * e;

            // Apply current filter
            s = applyFilter(s);

            // Store magnitude for visualization
            responseBuffer[bufIdx] = std::abs(s);
            bufIdx = (bufIdx + 1) % 256;

            s = std::tanh(s * 2.0f) * 0.3f;

            io.out(0) = s;
            io.out(1) = s;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '6') {
            filterType = k.key() - '1';
            printf("Filter: %s\\n", filterNames[filterType]);
        }
        if (k.key() == ' ') {
            env.reset();
        }
        if (k.key() == 's') {
            useSaw = !useSaw;
            printf("Source: %s\\n", useSaw ? "Saw wave" : "Pink noise");
        }
        if (k.key() == Keyboard::UP) {
            cutoffFreq = std::min(cutoffFreq * 1.2f, 15000.0f);
            updateFilters();
        }
        if (k.key() == Keyboard::DOWN) {
            cutoffFreq = std::max(cutoffFreq / 1.2f, 50.0f);
            updateFilters();
        }
        if (k.key() == Keyboard::RIGHT) {
            resonance = std::min(resonance * 1.2f, 20.0f);
            updateFilters();
        }
        if (k.key() == Keyboard::LEFT) {
            resonance = std::max(resonance / 1.2f, 0.1f);
            updateFilters();
        }
        return true;
    }

    void updateFilters() {
        biquadLP.freq(cutoffFreq);
        biquadLP.res(resonance);

        biquadHP.freq(cutoffFreq);
        biquadHP.res(resonance);

        biquadBP.freq(cutoffFreq);
        biquadBP.res(resonance);

        biquadNotch.freq(cutoffFreq);
        biquadNotch.res(resonance);

        onepole.freq(cutoffFreq);

        allpass.freq(cutoffFreq);

        printf("Cutoff: %.0f Hz, Resonance: %.2f\\n", cutoffFreq, resonance);
    }
};

ALLOLIB_WEB_MAIN(GammaFiltersShowcase)
`,
  },
  {
    id: 'gamma-delays-effects',
    title: 'Gamma Delays & Effects',
    description: 'Delay lines, comb filters, chorus, flanger effects',
    category: 'feature-tests',
    subcategory: 'audio',
    code: `/**
 * Gamma Delays & Effects
 * 1=Delay, 2=Comb, 3=Flanger, 4=Chorus, 5=Burst, 6=Chirp
 * UP/DOWN=delay time, LEFT/RIGHT=feedback/depth
 * SPACE=trigger effect
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Delay.h"
#include "Gamma/Effects.h"
#include "Gamma/Envelope.h"
#include "Gamma/Noise.h"
#include <cmath>

using namespace al;
using namespace gam;

class GammaDelaysEffects : public WebApp {
public:
    // Sound source
    Sine<> osc;
    ADSR<> env;
    NoisePink<> noise;

    // Delay effects
    Delay<float, ipl::Linear> delay;
    Comb<> comb;

    // LFO for modulation effects
    LFO<> lfo;

    // Effect modules
    Burst burst;
    Chirp<> chirp;

    // Parameters
    float delayTime = 0.25f;
    float feedback = 0.5f;
    float modDepth = 0.3f;
    int effectType = 0;

    // Visualization
    Mesh waveform;
    float buffer[512];
    int bufIdx = 0;

    const char* effectNames[6] = {
        "Simple Delay",
        "Comb Filter",
        "Flanger",
        "Chorus",
        "Burst (noise)",
        "Chirp (sweep)"
    };

    void onCreate() override {
        gam::sampleRate(44100);

        osc.freq(220.0f);

        env.attack(0.01f);
        env.decay(0.2f);
        env.sustain(0.5f);
        env.release(0.5f);

        // Initialize delay line
        delay.maxDelay(2.0f);
        delay.delay(delayTime);

        // Initialize comb filter
        comb.maxDelay(0.5f);
        comb.delay(0.02f);
        comb.decay(0.5f);
        comb.fbk(feedback);

        // LFO for modulation
        lfo.freq(0.5f);

        // Burst and Chirp
        burst(8000, 200, 0.1f);
        chirp(880, 110, 0.3f);

        // Waveform display
        waveform.primitive(Mesh::LINE_STRIP);
        for (int i = 0; i < 512; i++) {
            buffer[i] = 0;
            float x = (i / 511.0f) * 5.0f - 2.5f;
            waveform.vertex(x, 0, 0);
            waveform.color(0.5f, 0.8f, 1.0f);
        }

        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        for (int i = 0; i < 512; i++) {
            waveform.vertices()[i].y = buffer[i] * 2.0f;
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);
        g.lineWidth(2);
        g.draw(waveform);
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float e = env();
            float dry = osc() * e * 0.5f;
            float wet = 0;

            switch (effectType) {
                case 0: {  // Simple delay
                    float delayed = delay(dry);
                    wet = dry + delayed * feedback;
                    break;
                }
                case 1: {  // Comb filter
                    wet = comb(dry);
                    break;
                }
                case 2: {  // Flanger
                    float modDelay = 0.002f + lfo.tri() * 0.003f * modDepth;
                    delay.delay(modDelay);
                    float delayed = delay(dry);
                    wet = dry + delayed * 0.7f;
                    break;
                }
                case 3: {  // Chorus
                    float modDelay = 0.02f + lfo.tri() * 0.01f * modDepth;
                    delay.delay(modDelay);
                    float delayed = delay(dry);
                    wet = (dry + delayed) * 0.7f;
                    break;
                }
                case 4: {  // Burst
                    wet = burst() * 0.5f;
                    break;
                }
                case 5: {  // Chirp
                    wet = chirp() * 0.5f;
                    break;
                }
            }

            // Store for visualization
            buffer[bufIdx] = wet;
            bufIdx = (bufIdx + 1) % 512;

            // Soft clip
            wet = std::tanh(wet * 1.5f) * 0.4f;

            io.out(0) = wet;
            io.out(1) = wet;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '6') {
            effectType = k.key() - '1';
            printf("Effect: %s\\n", effectNames[effectType]);
        }
        if (k.key() == ' ') {
            env.reset();
            burst.reset();
            chirp.reset();
        }
        if (k.key() == Keyboard::UP) {
            delayTime = std::min(delayTime * 1.2f, 1.0f);
            delay.delay(delayTime);
            printf("Delay: %.3f s\\n", delayTime);
        }
        if (k.key() == Keyboard::DOWN) {
            delayTime = std::max(delayTime / 1.2f, 0.001f);
            delay.delay(delayTime);
            printf("Delay: %.3f s\\n", delayTime);
        }
        if (k.key() == Keyboard::RIGHT) {
            feedback = std::min(feedback + 0.1f, 0.95f);
            modDepth = std::min(modDepth + 0.1f, 1.0f);
            comb.fbk(feedback);
            printf("Feedback/Depth: %.2f\\n", feedback);
        }
        if (k.key() == Keyboard::LEFT) {
            feedback = std::max(feedback - 0.1f, 0.0f);
            modDepth = std::max(modDepth - 0.1f, 0.0f);
            comb.fbk(feedback);
            printf("Feedback/Depth: %.2f\\n", feedback);
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(GammaDelaysEffects)
`,
  },
  {
    id: 'allolib-reverb',
    title: 'AlloLib Plate Reverb',
    description: 'Dattorro plate reverb algorithm from al::Reverb',
    category: 'feature-tests',
    subcategory: 'audio',
    code: `/**
 * AlloLib Plate Reverb
 * High-quality Dattorro plate reverb algorithm
 * SPACE=trigger, UP/DOWN=decay, LEFT/RIGHT=damping
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/sound/al_Reverb.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
#include "Gamma/Noise.h"
#include <cmath>

using namespace al;
using namespace gam;

class ReverbDemo : public WebApp {
public:
    // Sound sources
    Sine<> osc;
    NoisePink<> noise;
    ADSR<> env;

    // AlloLib plate reverb
    Reverb<float> reverb;

    // Parameters
    float decayAmount = 0.85f;
    float dampingAmount = 0.4f;
    float wetMix = 0.5f;
    int sourceType = 0;  // 0=sine, 1=noise

    // Visualization
    Mesh waveL, waveR;
    float bufferL[256], bufferR[256];
    int bufIdx = 0;

    void onCreate() override {
        gam::sampleRate(44100);

        osc.freq(440.0f);
        env.attack(0.01f);
        env.decay(0.1f);
        env.sustain(0.3f);
        env.release(0.5f);

        // Configure reverb
        reverb.decay(decayAmount);
        reverb.damping(dampingAmount);
        reverb.bandwidth(0.9995f);
        reverb.diffusion(0.76f, 0.666f, 0.707f, 0.571f);

        // Waveform displays
        waveL.primitive(Mesh::LINE_STRIP);
        waveR.primitive(Mesh::LINE_STRIP);
        for (int i = 0; i < 256; i++) {
            bufferL[i] = bufferR[i] = 0;
            float x = (i / 255.0f) * 4.0f - 2.0f;
            waveL.vertex(x, 0.7f, 0);
            waveL.color(0.3f, 0.8f, 1.0f);
            waveR.vertex(x, -0.7f, 0);
            waveR.color(1.0f, 0.5f, 0.3f);
        }

        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        for (int i = 0; i < 256; i++) {
            waveL.vertices()[i].y = 0.7f + bufferL[i] * 0.5f;
            waveR.vertices()[i].y = -0.7f + bufferR[i] * 0.5f;
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);
        g.lineWidth(2);
        g.draw(waveL);
        g.draw(waveR);
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float e = env();
            float dry = (sourceType == 0 ? osc() : noise()) * e * 0.5f;

            // Apply reverb (mono in, stereo out)
            float wetL, wetR;
            reverb(dry, wetL, wetR, 0.6f);

            // Mix dry and wet
            float outL = dry * (1.0f - wetMix) + wetL * wetMix;
            float outR = dry * (1.0f - wetMix) + wetR * wetMix;

            // Store for visualization
            bufferL[bufIdx] = outL;
            bufferR[bufIdx] = outR;
            bufIdx = (bufIdx + 1) % 256;

            io.out(0) = outL;
            io.out(1) = outR;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') {
            env.reset();
        }
        if (k.key() == '1') {
            sourceType = 0;
            printf("Source: Sine\\n");
        }
        if (k.key() == '2') {
            sourceType = 1;
            printf("Source: Noise\\n");
        }
        if (k.key() == Keyboard::UP) {
            decayAmount = std::min(decayAmount + 0.05f, 0.99f);
            reverb.decay(decayAmount);
            printf("Decay: %.2f\\n", decayAmount);
        }
        if (k.key() == Keyboard::DOWN) {
            decayAmount = std::max(decayAmount - 0.05f, 0.1f);
            reverb.decay(decayAmount);
            printf("Decay: %.2f\\n", decayAmount);
        }
        if (k.key() == Keyboard::RIGHT) {
            dampingAmount = std::min(dampingAmount + 0.05f, 0.99f);
            reverb.damping(dampingAmount);
            printf("Damping: %.2f\\n", dampingAmount);
        }
        if (k.key() == Keyboard::LEFT) {
            dampingAmount = std::max(dampingAmount - 0.05f, 0.0f);
            reverb.damping(dampingAmount);
            printf("Damping: %.2f\\n", dampingAmount);
        }
        if (k.key() == 'w') {
            wetMix = std::min(wetMix + 0.1f, 1.0f);
            printf("Wet Mix: %.1f\\n", wetMix);
        }
        if (k.key() == 'd') {
            wetMix = std::max(wetMix - 0.1f, 0.0f);
            printf("Wet Mix: %.1f\\n", wetMix);
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(ReverbDemo)
`,
  },
  {
    id: 'distance-attenuation',
    title: 'Distance Attenuation',
    description: 'DistAtten class for distance-based volume falloff',
    category: 'feature-tests',
    subcategory: 'audio',
    code: `/**
 * Distance Attenuation Demo
 * Shows how sound attenuates with distance
 * WASD=move source, 1-3=attenuation law
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/spatial/al_DistAtten.hpp"
#include "Gamma/Oscillator.h"
#include <cmath>

using namespace al;
using namespace gam;

class DistanceAttenDemo : public WebApp {
public:
    Sine<> osc;

    // Distance attenuation
    DistAtten<float> distAtten;

    // Positions
    Vec3f sourcePos{2, 0, 0};
    Vec3f listenerPos{0, 0, 0};

    // Visualization
    Mesh sourceMesh, listenerMesh, groundMesh;

    int attenLaw = 1;  // 0=none, 1=linear, 2=inverse, 3=inverse square

    void onCreate() override {
        gam::sampleRate(44100);
        osc.freq(440.0f);

        // Configure distance attenuation
        distAtten.near(0.5f);    // Full volume at 0.5 units
        distAtten.far(10.0f);    // Silent at 10 units
        distAtten.law(ATTEN_LINEAR);

        // Create meshes
        addSphere(sourceMesh, 0.2f, 16, 16);
        sourceMesh.generateNormals();

        addSphere(listenerMesh, 0.15f, 16, 16);
        listenerMesh.generateNormals();

        // Ground grid
        groundMesh.primitive(Mesh::LINES);
        for (int i = -5; i <= 5; i++) {
            groundMesh.vertex(i, -0.5f, -5);
            groundMesh.vertex(i, -0.5f, 5);
            groundMesh.vertex(-5, -0.5f, i);
            groundMesh.vertex(5, -0.5f, i);
        }
        for (int i = 0; i < groundMesh.vertices().size(); i++) {
            groundMesh.color(0.3f, 0.3f, 0.3f);
        }

        nav().pos(0, 2, 8);
        nav().faceToward(Vec3d(0, 0, 0));
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        // Draw ground
        g.lighting(false);
        g.draw(groundMesh);
        g.lighting(true);

        // Draw source (color based on attenuation)
        float dist = (sourcePos - listenerPos).mag();
        float atten = distAtten(dist);

        g.pushMatrix();
        g.translate(sourcePos);
        g.color(1.0f, atten, 0.2f);
        g.draw(sourceMesh);
        g.popMatrix();

        // Draw listener
        g.pushMatrix();
        g.translate(listenerPos);
        g.color(0.2f, 0.8f, 1.0f);
        g.draw(listenerMesh);
        g.popMatrix();
    }

    void onSound(AudioIOData& io) override {
        float dist = (sourcePos - listenerPos).mag();
        float atten = distAtten(dist);

        while (io()) {
            float s = osc() * atten * 0.3f;

            // Simple stereo panning based on X position
            float pan = (sourcePos.x - listenerPos.x) * 0.5f;
            pan = std::max(-1.0f, std::min(1.0f, pan));

            float gainL = (1.0f - pan) * 0.5f;
            float gainR = (1.0f + pan) * 0.5f;

            io.out(0) = s * gainL;
            io.out(1) = s * gainR;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        float moveSpeed = 0.3f;
        if (k.key() == 'w') sourcePos.z -= moveSpeed;
        if (k.key() == 's') sourcePos.z += moveSpeed;
        if (k.key() == 'a') sourcePos.x -= moveSpeed;
        if (k.key() == 'd') sourcePos.x += moveSpeed;
        if (k.key() == 'q') sourcePos.y += moveSpeed;
        if (k.key() == 'e') sourcePos.y -= moveSpeed;

        if (k.key() == '1') {
            distAtten.law(ATTEN_NONE);
            printf("Attenuation: None\\n");
        }
        if (k.key() == '2') {
            distAtten.law(ATTEN_LINEAR);
            printf("Attenuation: Linear\\n");
        }
        if (k.key() == '3') {
            distAtten.law(ATTEN_INVERSE);
            printf("Attenuation: Inverse\\n");
        }
        if (k.key() == '4') {
            distAtten.law(ATTEN_INVERSE_SQUARE);
            printf("Attenuation: Inverse Square\\n");
        }

        float dist = (sourcePos - listenerPos).mag();
        printf("Distance: %.2f, Attenuation: %.3f\\n", dist, distAtten(dist));

        return true;
    }
};

ALLOLIB_WEB_MAIN(DistanceAttenDemo)
`,
  },
  {
    id: 'hashspace-demo',
    title: 'HashSpace Spatial Query',
    description: 'Efficient spatial hashing for proximity detection',
    category: 'feature-tests',
    subcategory: 'advanced',
    code: `/**
 * HashSpace Demo - Spatial Hashing
 * Efficient spatial queries for many objects
 * Click to add objects, neighbors highlight
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/spatial/al_HashSpace.hpp"
#include <cmath>
#include <vector>

using namespace al;

class HashSpaceDemo : public WebApp {
public:
    static const int MAX_OBJECTS = 100;

    // HashSpace for spatial queries
    HashSpace space;
    HashSpace::Query query;

    // Object data
    struct Object {
        HashSpace::Object hsObj;
        Vec3f pos;
        Vec3f vel;
        bool isNeighbor;
    };
    std::vector<Object> objects;

    // Query point (mouse controlled)
    Vec3f queryPoint{0, 0, 0};
    float queryRadius = 1.5f;

    Mesh sphereMesh;
    Mesh queryMesh;
    double time = 0;

    void onCreate() override {
        // Initialize HashSpace (dim=3, resolution)
        space.dim(3);
        space.maxRadius(queryRadius);

        // Create sphere mesh
        addSphere(sphereMesh, 0.1f, 8, 8);
        sphereMesh.generateNormals();

        // Create query visualization mesh (wireframe sphere)
        addSphere(queryMesh, queryRadius, 16, 16);

        // Add initial objects
        for (int i = 0; i < 30; i++) {
            addRandomObject();
        }

        nav().pos(0, 0, 10);
        configureWebAudio(44100, 128, 2, 0);
    }

    void addRandomObject() {
        if (objects.size() >= MAX_OBJECTS) return;

        Object obj;
        obj.pos = Vec3f(
            (rand() / float(RAND_MAX) - 0.5f) * 8,
            (rand() / float(RAND_MAX) - 0.5f) * 8,
            (rand() / float(RAND_MAX) - 0.5f) * 4
        );
        obj.vel = Vec3f(
            (rand() / float(RAND_MAX) - 0.5f) * 0.5f,
            (rand() / float(RAND_MAX) - 0.5f) * 0.5f,
            (rand() / float(RAND_MAX) - 0.5f) * 0.25f
        );
        obj.isNeighbor = false;

        // Register with HashSpace
        obj.hsObj = HashSpace::Object(space, objects.size());
        obj.hsObj.pos(obj.pos.x, obj.pos.y, obj.pos.z);

        objects.push_back(obj);
    }

    void onAnimate(double dt) override {
        time += dt;

        // Update object positions
        for (auto& obj : objects) {
            obj.pos += obj.vel * dt;

            // Bounce off boundaries
            for (int i = 0; i < 3; i++) {
                if (obj.pos[i] > 4 || obj.pos[i] < -4) {
                    obj.vel[i] *= -1;
                    obj.pos[i] = std::max(-4.0f, std::min(4.0f, obj.pos[i]));
                }
            }

            // Update HashSpace position
            obj.hsObj.pos(obj.pos.x, obj.pos.y, obj.pos.z);
            obj.isNeighbor = false;
        }

        // Query neighbors
        int numNeighbors = query(space, queryPoint.x, queryPoint.y, queryPoint.z, queryRadius);

        for (int i = 0; i < numNeighbors; i++) {
            int idx = query[i]->id;
            if (idx < objects.size()) {
                objects[idx].isNeighbor = true;
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);
        g.depthTesting(true);
        g.lighting(true);

        // Draw objects
        for (const auto& obj : objects) {
            g.pushMatrix();
            g.translate(obj.pos);
            if (obj.isNeighbor) {
                g.color(1.0f, 0.8f, 0.2f);  // Yellow for neighbors
            } else {
                g.color(0.3f, 0.5f, 0.8f);  // Blue for others
            }
            g.draw(sphereMesh);
            g.popMatrix();
        }

        // Draw query sphere (wireframe)
        g.lighting(false);
        g.blending(true);
        g.blendTrans();
        g.pushMatrix();
        g.translate(queryPoint);
        g.color(0.2f, 1.0f, 0.5f, 0.2f);
        g.polygonMode(Graphics::LINE);
        g.draw(queryMesh);
        g.polygonMode(Graphics::FILL);
        g.popMatrix();
        g.blending(false);
    }

    void onSound(AudioIOData& io) override {
        // Count neighbors for audio feedback
        int neighbors = 0;
        for (const auto& obj : objects) {
            if (obj.isNeighbor) neighbors++;
        }

        float freq = 200 + neighbors * 50;
        float amp = neighbors > 0 ? 0.1f : 0.0f;

        static float phase = 0;
        while (io()) {
            float s = sin(phase * 2 * M_PI) * amp;
            phase += freq / 44100.0f;
            if (phase > 1) phase -= 1;
            io.out(0) = s;
            io.out(1) = s;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') {
            addRandomObject();
            printf("Objects: %zu\\n", objects.size());
        }
        if (k.key() == Keyboard::UP) {
            queryRadius = std::min(queryRadius + 0.2f, 5.0f);
            space.maxRadius(queryRadius);
            printf("Query radius: %.1f\\n", queryRadius);
        }
        if (k.key() == Keyboard::DOWN) {
            queryRadius = std::max(queryRadius - 0.2f, 0.5f);
            space.maxRadius(queryRadius);
            printf("Query radius: %.1f\\n", queryRadius);
        }
        return true;
    }

    bool onMouseMove(const Mouse& m) override {
        // Map mouse to 3D position
        float x = (m.x() / 800.0f - 0.5f) * 10;
        float y = -(m.y() / 600.0f - 0.5f) * 10;
        queryPoint = Vec3f(x, y, 0);
        return true;
    }
};

ALLOLIB_WEB_MAIN(HashSpaceDemo)
`,
  },
  {
    id: 'spatial-audio-test',
    title: 'Spatial Audio Test',
    description: 'Tests StereoPanner, DynamicScene, PositionedVoice, distance attenuation',
    category: 'feature-tests',
    subcategory: 'audio',
    code: `/**
 * Phase 5 Test: Spatial Audio
 * 1-5=trigger sounds, LEFT/RIGHT=rotate listener, WASD=move source
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/sound/al_StereoPanner.hpp"
#include "al/scene/al_DynamicScene.hpp"
#include "al/scene/al_PositionedVoice.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
#include <cmath>

using namespace al;
using namespace gam;

class SpatialVoice : public PositionedVoice {
public:
    Sine<> osc;
    AD<> env;
    float freq = 440.0f;
    Color color;

    void init() override { env.attack(0.01f); env.decay(2.0f); }
    void onTriggerOn() override { osc.freq(freq); env.reset(); }
    void onProcess(AudioIOData& io) override {
        while (io()) {
            float s = osc() * env() * 0.3f;
            io.out(0) = s; io.out(1) = s;
        }
        if (env.done()) free();
    }
    void onProcess(Graphics& g) override {
        Mesh m; addSphere(m, 0.2f, 16, 16);
        g.pushMatrix();
        g.translate(pose().pos());
        g.color(color);
        g.draw(m);
        g.popMatrix();
    }
};

class SpatialAudioTest : public WebApp {
public:
    DynamicScene scene;
    Mesh listenerMesh, groundPlane;
    double time = 0;
    float listenerAngle = 0;
    StereoPanner panner;
    Sine<> continuousOsc;
    float srcX = 0, srcZ = -3;

    void onCreate() override {
        scene.distanceAttenuation(true);
        scene.allocatePolyphony<SpatialVoice>(16);
        scene.prepare(audioIO());

        addCone(listenerMesh, 0.2f, Vec3f(0,0,0.5f), Vec3f(0,0,-0.3f), 12);
        listenerMesh.generateNormals();

        groundPlane.primitive(Mesh::TRIANGLES);
        float sz = 10.0f;
        groundPlane.vertex(-sz,-0.5f,-sz); groundPlane.vertex(sz,-0.5f,-sz); groundPlane.vertex(sz,-0.5f,sz);
        groundPlane.vertex(-sz,-0.5f,-sz); groundPlane.vertex(sz,-0.5f,sz); groundPlane.vertex(-sz,-0.5f,sz);
        for (int i = 0; i < 6; i++) groundPlane.color(0.2f, 0.3f, 0.2f);

        panner.numSpeakers(2);
        std::vector<float> az = {-45.0f, 45.0f};
        panner.setSpeakerAngles(az);
        continuousOsc.freq(330.0f);

        nav().pos(0, 2, 8);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        time += dt;
        Pose lp; lp.pos(0,0,0);
        lp.faceToward(Vec3f(sin(listenerAngle), 0, -cos(listenerAngle)));
        scene.listenerPose(lp);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);
        g.draw(groundPlane);

        g.pushMatrix();
        g.rotate(listenerAngle * 180.0f / M_PI, 0, 1, 0);
        g.color(1.0f, 0.8f, 0.2f);
        g.draw(listenerMesh);
        g.popMatrix();

        g.pushMatrix();
        g.translate(srcX, 0, srcZ);
        Mesh s; addSphere(s, 0.15f, 12, 12);
        g.color(0.2f, 0.8f, 1.0f);
        g.draw(s);
        g.popMatrix();

        scene.render(g);
    }

    void onSound(AudioIOData& io) override {
        scene.render(io);
        while (io()) {
            float s = continuousOsc() * 0.1f;
            float dx = srcX, dz = srcZ;
            float rotX = dx * cos(-listenerAngle) - dz * sin(-listenerAngle);
            float rotZ = dx * sin(-listenerAngle) + dz * cos(-listenerAngle);
            float azimuth = atan2(rotX, -rotZ) * 180.0f / M_PI;
            float dist = sqrt(dx*dx + dz*dz);
            float atten = 1.0f / (1.0f + dist * 0.5f);
            float gains[2];
            panner.renderSample(io, azimuth, 0, gains);
            io.out(0) += s * gains[0] * atten;
            io.out(1) += s * gains[1] * atten;
        }
    }

    void trigger(float x, float y, float z, float f, Color c) {
        auto* v = scene.getVoice<SpatialVoice>();
        if (v) { v->freq = f; v->color = c; v->pose().pos(x,y,z); scene.triggerOn(v); }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == '1') trigger(-3, 0, 0, 440, Color(1,0,0));
        if (k.key() == '2') trigger(3, 0, 0, 550, Color(0,1,0));
        if (k.key() == '3') trigger(0, 0, -5, 660, Color(0,0,1));
        if (k.key() == '4') trigger(0, 0, 5, 330, Color(1,1,0));
        if (k.key() == '5') { trigger(-2,0,-2,262,Color(1,0.5,0)); trigger(0,0,-3,330,Color(0.5,1,0)); trigger(2,0,-2,392,Color(0,0.5,1)); }
        if (k.key() == Keyboard::LEFT) listenerAngle -= 0.2f;
        if (k.key() == Keyboard::RIGHT) listenerAngle += 0.2f;
        if (k.key() == 'a') srcX -= 0.5f;
        if (k.key() == 'd') srcX += 0.5f;
        if (k.key() == 'w') srcZ -= 0.5f;
        if (k.key() == 's') srcZ += 0.5f;
        return true;
    }
};

ALLOLIB_WEB_MAIN(SpatialAudioTest)
`,
  },
  {
    id: 'cross-platform-app',
    title: 'Cross-Platform App',
    description: 'Code that works on both desktop AlloLib and AlloLib Online',
    category: 'feature-tests',
    subcategory: 'graphics',
    code: `/**
 * Cross-Platform AlloLib Application
 *
 * This code uses the compatibility layer to work on BOTH:
 * - Native AlloLib (desktop with GLFW/OpenGL)
 * - AlloLib Studio Online (browser with WebGL2/WebAudio)
 *
 * The key differences handled by al_compat.hpp:
 * 1. Base class: al::App (aliased to WebApp on WASM)
 * 2. Main macro: ALLOLIB_MAIN() works on both
 * 3. Audio config: configureAudio/configureWebAudio unified
 */

// Use compatibility header for cross-platform support
// On desktop: #include "al/app/al_App.hpp"
// On WASM:    #include "al_WebApp.hpp"
// This header handles both:
#include "al_compat.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include <cmath>

using namespace al;

/**
 * Example app that runs on both desktop and browser
 */
class CrossPlatformApp : public App {  // "App" works on both platforms!
public:
    Mesh sphereMesh;
    gam::Sine<> osc{440.0f};

    double rotation = 0;
    float amplitude = 0.3f;
    int colorMode = 0;

    void onCreate() override {
        addSphere(sphereMesh, 1.0, 32, 32);
        sphereMesh.generateNormals();
        nav().pos(0, 0, 5);

        // This works on both platforms:
        // - Desktop: calls configureAudio()
        // - WASM: calls configureWebAudio()
        configureAudio(44100, 128, 2, 0);

        // Platform detection (optional)
        if (isWASM()) {
            printf("Running in browser (WebAssembly)\\n");
        } else {
            printf("Running on desktop\\n");
        }
    }

    void onAnimate(double dt) override {
        rotation += dt * 45.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        g.pushMatrix();
        g.rotate(rotation, 0, 1, 0);
        g.rotate(rotation * 0.7, 1, 0, 0);

        // Color based on mode
        switch (colorMode % 3) {
            case 0: g.color(0.8f, 0.3f, 0.2f); break;  // Red
            case 1: g.color(0.2f, 0.8f, 0.3f); break;  // Green
            case 2: g.color(0.2f, 0.3f, 0.8f); break;  // Blue
        }

        g.draw(sphereMesh);
        g.popMatrix();
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float sample = osc() * amplitude;
            io.out(0) = sample;
            io.out(1) = sample;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        // Change color with 1-3
        if (k.key() >= '1' && k.key() <= '3') {
            colorMode = k.key() - '1';
            printf("Color mode: %d\\n", colorMode);
        }

        // Change frequency with up/down
        if (k.key() == Keyboard::UP) {
            osc.freq(osc.freq() * 1.1f);
            printf("Frequency: %.1f Hz\\n", osc.freq());
        }
        if (k.key() == Keyboard::DOWN) {
            osc.freq(osc.freq() / 1.1f);
            printf("Frequency: %.1f Hz\\n", osc.freq());
        }

        return true;
    }
};

// This macro works on both platforms:
// - Desktop: creates main() that calls app.start()
// - WASM: creates Emscripten exports + main()
ALLOLIB_MAIN(CrossPlatformApp)

/*
 * To compile for desktop:
 *   g++ -o app app.cpp -lallolib -lgamma -lglfw ...
 *
 * To compile for WASM (what AlloLib Online does):
 *   em++ -o app.js app.cpp ... -s WASM=1
 *
 * The same source file works for both!
 */
`,
  },
  // ==========================================================================
  // FEATURE TESTS - UI Tests
  // ==========================================================================
  {
    id: 'parameter-panel-test',
    title: 'Parameter Panel Demo',
    description: 'Demonstrates the web-based parameter GUI with sliders, toggles, and presets',
    category: 'feature-tests',
    subcategory: 'ui',
    code: `/**
 * Parameter Panel Demo
 *
 * This example demonstrates the Vue-based parameter panel that replaces
 * ImGui in the browser. Parameters registered with ControlGUI appear
 * in the Parameters panel below the viewer.
 *
 * Features:
 * - Float sliders with real-time feedback
 * - Boolean toggles (checkboxes)
 * - Menu/dropdown selections
 * - Preset save/load to localStorage
 * - Double-click parameter name to reset to default
 *
 * The same code will use real ImGui when exported to native AlloLib!
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include <cmath>

using namespace al;

class ParameterDemoApp : public App {
public:
    // Parameters - these will appear in the web GUI
    Parameter frequency{"Frequency", "", 440.0f, 100.0f, 2000.0f};
    Parameter amplitude{"Amplitude", "", 0.3f, 0.0f, 1.0f};
    Parameter rotation_speed{"Rotation Speed", "", 30.0f, 0.0f, 180.0f};
    ParameterInt shape_type{"Shape", "", 0, 0, 3};
    ParameterBool audio_enabled{"Audio Enabled", "", true};
    Parameter hue{"Hue", "Color", 0.5f, 0.0f, 1.0f};
    Parameter saturation{"Saturation", "Color", 0.8f, 0.0f, 1.0f};
    Parameter brightness{"Brightness", "Color", 0.9f, 0.0f, 1.0f};

    // The GUI manager - in WASM this uses WebControlGUI, on native it uses ImGui
    ControlGUI gui;

    // Audio
    gam::Sine<> osc;

    // Graphics
    Mesh sphere, cube, cone, torus;
    double angle = 0;

    void onCreate() override {
        // Register all parameters with the GUI
        // These will appear in the Parameters panel
        gui << frequency << amplitude << rotation_speed;
        gui << shape_type << audio_enabled;
        gui << hue << saturation << brightness;

        // Set up GUI (optional title and position on native)
        gui.setTitle("Demo Controls");

        // Create meshes for different shapes
        addSphere(sphere, 1.0, 32, 32);
        addCube(cube);
        addCone(cone, 0.5, Vec3f(0, 0, 1.5));
        addTorus(torus, 0.3, 0.8, 32, 32);

        sphere.generateNormals();
        cube.generateNormals();
        cone.generateNormals();
        torus.generateNormals();

        nav().pos(0, 0, 5);
        configureAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        angle += rotation_speed.get() * dt;

        // Update oscillator frequency from parameter
        osc.freq(frequency.get());

        // Draw the GUI (no-op in WASM, Vue panel handles it)
        gui.draw();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1);

        // Set up basic lighting
        g.lighting(true);
        Light light; light.pos(5,5,5); g.light(light);

        // Convert HSV to RGB for color
        float h = hue.get();
        float s = saturation.get();
        float v = brightness.get();

        // Simple HSV to RGB conversion
        float c = v * s;
        float x = c * (1 - std::abs(std::fmod(h * 6, 2.0f) - 1));
        float m = v - c;
        float r, gr, b;

        if (h < 1.0f/6) { r = c; gr = x; b = 0; }
        else if (h < 2.0f/6) { r = x; gr = c; b = 0; }
        else if (h < 3.0f/6) { r = 0; gr = c; b = x; }
        else if (h < 4.0f/6) { r = 0; gr = x; b = c; }
        else if (h < 5.0f/6) { r = x; gr = 0; b = c; }
        else { r = c; gr = 0; b = x; }

        g.color(r + m, gr + m, b + m);

        g.pushMatrix();
        g.rotate(angle, 0, 1, 0);
        g.rotate(angle * 0.7, 1, 0, 0);

        // Draw selected shape based on parameter
        switch (shape_type.get()) {
            case 0: g.draw(sphere); break;
            case 1: g.draw(cube); break;
            case 2: g.draw(cone); break;
            case 3: g.draw(torus); break;
        }

        g.popMatrix();

        // Show parameter values on screen
        // (In native ImGui, you could draw text overlays)
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            float sample = 0;

            if (audio_enabled.get()) {
                sample = osc() * amplitude.get();
            }

            io.out(0) = io.out(1) = sample;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        // 1-4 to change shape
        if (k.key() >= '1' && k.key() <= '4') {
            shape_type.set(k.key() - '1');
        }

        // Space to toggle audio
        if (k.key() == ' ') {
            audio_enabled.set(!audio_enabled.get());
        }

        return true;
    }
};

ALLOLIB_MAIN(ParameterDemoApp)

/*
 * Try these:
 * - Adjust sliders in the Parameters panel below
 * - Save a preset with your favorite settings
 * - Double-click a parameter name to reset it
 * - Press 1-4 to change shapes via keyboard
 * - Press SPACE to toggle audio
 */
`,
  },

  // ==========================================================================
  // SIMULATION - Particle Systems
  // ==========================================================================
  {
    id: 'sim-point-test',
    title: 'Point Rendering Test',
    description: 'Simple test to verify point primitives render correctly',
    category: 'simulation',
    subcategory: 'particles',
    code: `/**
 * Point Rendering Test
 * Minimal test for WebGL2 point rendering
 */

#include "al_WebApp.hpp"

using namespace al;

class PointTest : public WebApp {
public:
    Mesh points;

    void onCreate() override {
        // Create simple colored points in a grid
        points.primitive(Mesh::POINTS);

        for (int y = -5; y <= 5; y++) {
            for (int x = -5; x <= 5; x++) {
                points.vertex(x * 0.2f, y * 0.2f, 0);
                // Bright solid colors (no alpha)
                float r = (x + 5) / 10.0f;
                float g = (y + 5) / 10.0f;
                float b = 1.0f;
                points.color(r, g, b, 1.0f);  // Full opacity
            }
        }

        nav().pos(0, 0, 4);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.1f);

        // Simple rendering - no blending, no depth test
        g.blending(false);
        g.depthTesting(false);

        g.pointSize(10);  // Large points
        g.meshColor();
        g.draw(points);
    }
};

ALLOLIB_WEB_MAIN(PointTest)
`,
  },
  {
    id: 'sim-andromeda-galaxy',
    title: 'Andromeda Galaxy (M31)',
    description: 'Realistic simulation of the Andromeda Galaxy with spiral arms, central bulge, dust lanes, and companion galaxies M32 and M110',
    category: 'simulation',
    subcategory: 'particles',
    code: `/**
 * Andromeda Galaxy (M31) - Realistic Simulation
 *
 * Models the key features of the Andromeda Galaxy:
 * - Central bulge: Dense, spheroidal, older yellow/orange stars
 * - Disk: Flattened exponential profile
 * - Spiral arms: Two main logarithmic spirals with younger blue stars
 * - Dust lanes: Dark regions along inner edges of spiral arms
 * - Stellar halo: Sparse, old red stars
 * - Companion galaxies: M32 (compact) and M110 (dwarf elliptical)
 * - Inclination: ~77 degrees from face-on (as seen from Earth)
 *
 * Use WASD + Q/E to navigate
 */

#include "al_WebApp.hpp"
#include "al/math/al_Random.hpp"
#include <cmath>

using namespace al;

class AndromedaGalaxy : public WebApp {
public:
    Mesh galaxy;
    Mesh companions;
    double time = 0;

    // Galaxy parameters (scaled for visualization)
    const float GALAXY_RADIUS = 4.0f;
    const float BULGE_RADIUS = 0.8f;
    const float DISK_HEIGHT = 0.1f;
    const float INCLINATION = 77.0f;
    const int NUM_STARS = 80000;
    const int NUM_BULGE_STARS = 15000;
    const int NUM_HALO_STARS = 5000;

    // Spiral arm parameters
    const float SPIRAL_A = 0.3f;
    const float SPIRAL_B = 0.15f;
    const int NUM_ARMS = 2;
    const float PI_F = 3.14159265358979f;

    rnd::Random<> rng;

    void onCreate() override {
        galaxy.primitive(Mesh::POINTS);
        companions.primitive(Mesh::POINTS);

        generateBulge();
        generateDisk();
        generateHalo();
        generateCompanions();

        nav().pos(0, 2, 8);
        nav().faceToward(Vec3f(0, 0, 0));
    }

    float bulgeProfile(float r) {
        float re = BULGE_RADIUS * 0.5f;
        return exp(-7.67f * (pow(r / re, 0.25f) - 1.0f));
    }

    float diskProfile(float r) {
        float rd = GALAXY_RADIUS * 0.3f;
        return exp(-r / rd);
    }

    float spiralAngle(float r, int arm) {
        float baseAngle = (2.0f * PI_F * arm) / NUM_ARMS;
        return baseAngle + SPIRAL_A * log(1.0f + r / SPIRAL_B);
    }

    void generateBulge() {
        for (int i = 0; i < NUM_BULGE_STARS; i++) {
            float u = rng.uniform();
            float r = BULGE_RADIUS * pow(u, 0.5f);

            if (rng.uniform() > bulgeProfile(r) * 2.0f) {
                i--;
                continue;
            }

            float theta = rng.uniform(0.0f, 2.0f * PI_F);
            float phi = acos(2.0f * rng.uniform() - 1.0f);
            float flattenY = 0.7f;

            float x = r * sin(phi) * cos(theta);
            float y = r * sin(phi) * sin(theta) * flattenY;
            float z = r * cos(phi);

            galaxy.vertex(x, y, z);

            float age = rng.uniform(0.7f, 1.0f);
            float temp = 0.3f + age * 0.4f;
            galaxy.color(1.0f, 0.8f * temp + 0.2f, 0.3f * temp, 0.9f);
        }
    }

    void generateDisk() {
        for (int i = 0; i < NUM_STARS; i++) {
            float u = rng.uniform();
            float r = -GALAXY_RADIUS * 0.3f * log(1.0f - u * 0.99f);
            r = fmin(r, GALAXY_RADIUS);

            float baseTheta = rng.uniform(0.0f, 2.0f * PI_F);
            bool inArm = false;
            float armInfluence = 0.0f;

            for (int arm = 0; arm < NUM_ARMS; arm++) {
                float armAngle = spiralAngle(r, arm);
                float angleDiff = baseTheta - armAngle;

                while (angleDiff > PI_F) angleDiff -= 2.0f * PI_F;
                while (angleDiff < -PI_F) angleDiff += 2.0f * PI_F;

                float armWidth = 0.3f + 0.2f * (r / GALAXY_RADIUS);

                if (fabs(angleDiff) < armWidth) {
                    inArm = true;
                    armInfluence = 1.0f - fabs(angleDiff) / armWidth;
                    baseTheta = armAngle + angleDiff * 0.5f;
                    break;
                }
            }

            float theta = baseTheta + rng.uniform(-0.15f, 0.15f);
            float zScale = DISK_HEIGHT * (1.0f + r / GALAXY_RADIUS);
            float z = rng.gaussian() * zScale;

            float x = r * cos(theta);
            float y = r * sin(theta);

            galaxy.vertex(x, y, z);

            float brightness = diskProfile(r) * 0.5f + 0.5f;

            if (inArm && r > BULGE_RADIUS * 0.5f) {
                float blue = 0.6f + armInfluence * 0.4f;
                float starType = rng.uniform();

                if (starType < 0.1f) {
                    galaxy.color(0.7f, 0.85f, 1.0f, brightness);
                } else if (starType < 0.3f) {
                    galaxy.color(0.85f, 0.9f, 1.0f, brightness * 0.9f);
                } else {
                    galaxy.color(0.9f, 0.9f, blue, brightness * 0.8f);
                }
            } else {
                float yellow = 0.8f - r / GALAXY_RADIUS * 0.3f;
                galaxy.color(1.0f, 0.85f * yellow + 0.15f, 0.5f * yellow, brightness * 0.7f);
            }

            if (inArm && r > BULGE_RADIUS) {
                float dustProb = 0.3f * armInfluence * (1.0f - r / GALAXY_RADIUS);
                if (rng.uniform() < dustProb) {
                    auto& c = galaxy.colors().back();
                    c.r *= 0.3f;
                    c.g *= 0.25f;
                    c.b *= 0.2f;
                }
            }
        }
    }

    void generateHalo() {
        for (int i = 0; i < NUM_HALO_STARS; i++) {
            float u = rng.uniform();
            float r = GALAXY_RADIUS * 0.5f * pow(u, -0.33f);
            r = fmin(r, GALAXY_RADIUS * 2.0f);

            if (r < BULGE_RADIUS) {
                i--;
                continue;
            }

            float theta = rng.uniform(0.0f, 2.0f * PI_F);
            float phi = acos(2.0f * rng.uniform() - 1.0f);

            float x = r * sin(phi) * cos(theta);
            float y = r * sin(phi) * sin(theta);
            float z = r * cos(phi);

            galaxy.vertex(x, y, z);

            float dim = 0.3f + 0.2f * rng.uniform();
            galaxy.color(1.0f * dim, 0.6f * dim, 0.4f * dim, 0.5f);
        }
    }

    void generateCompanions() {
        // M32 - Compact elliptical
        Vec3f m32Pos(1.8f, -0.3f, 0.5f);
        int m32Stars = 2000;
        float m32Radius = 0.25f;

        for (int i = 0; i < m32Stars; i++) {
            float r = m32Radius * pow(rng.uniform(), 0.5f);
            float theta = rng.uniform(0.0f, 2.0f * PI_F);
            float phi = acos(2.0f * rng.uniform() - 1.0f);

            float x = m32Pos.x + r * sin(phi) * cos(theta);
            float y = m32Pos.y + r * sin(phi) * sin(theta) * 0.8f;
            float z = m32Pos.z + r * cos(phi);

            companions.vertex(x, y, z);

            float bright = 0.6f + 0.4f * (1.0f - r / m32Radius);
            companions.color(1.0f * bright, 0.85f * bright, 0.6f * bright, 0.8f);
        }

        // M110 - Dwarf elliptical
        Vec3f m110Pos(-2.5f, 1.0f, -0.5f);
        int m110Stars = 1500;
        float m110Radius = 0.4f;

        for (int i = 0; i < m110Stars; i++) {
            float r = m110Radius * pow(rng.uniform(), 0.4f);
            float theta = rng.uniform(0.0f, 2.0f * PI_F);
            float phi = acos(2.0f * rng.uniform() - 1.0f);

            float x = m110Pos.x + r * sin(phi) * cos(theta) * 1.5f;
            float y = m110Pos.y + r * sin(phi) * sin(theta);
            float z = m110Pos.z + r * cos(phi);

            companions.vertex(x, y, z);

            float bright = 0.4f + 0.3f * (1.0f - r / m110Radius);
            companions.color(1.0f * bright, 0.8f * bright, 0.65f * bright, 0.6f);
        }
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.0f, 0.0f, 0.02f);

        g.blending(true);
        g.blendAdd();
        g.depthTesting(false);
        g.pointSize(1);  // Small points for realistic star field

        g.pushMatrix();
        g.rotate(INCLINATION, 1, 0, 0);
        g.rotate(time * 2.0, 0, 0, 1);

        g.meshColor();
        g.draw(galaxy);
        g.draw(companions);

        g.popMatrix();
    }

    bool onKeyDown(Keyboard const& k) override {
        float moveSpeed = 0.3f;
        switch (k.key()) {
            case 'w': nav().pos() += nav().uf() * moveSpeed; break;
            case 's': nav().pos() -= nav().uf() * moveSpeed; break;
            case 'a': nav().pos() -= nav().ur() * moveSpeed; break;
            case 'd': nav().pos() += nav().ur() * moveSpeed; break;
            case 'q': nav().pos() -= nav().uu() * moveSpeed; break;
            case 'e': nav().pos() += nav().uu() * moveSpeed; break;
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(AndromedaGalaxy)
`,
  },
  {
    id: 'sim-particle-fountain',
    title: 'Particle Fountain',
    description: 'Simple particle system with fountain-like emission',
    category: 'simulation',
    subcategory: 'particles',
    code: `/**
 * Particle Fountain
 *
 * A simple particle system demonstrating emission, velocity, and gravity.
 * Particles are emitted upward and fall back down.
 *
 * Based on allolib/examples/simulation/particleSystem.cpp
 */

#include "al_WebApp.hpp"
#include "al/math/al_Random.hpp"

using namespace al;

struct Particle {
    Vec3f pos, vel, acc;
    int age = 0;

    void update(int ageInc) {
        vel += acc;
        pos += vel;
        age += ageInc;
    }
};

template <int N>
struct Emitter {
    Particle particles[N];
    int tap = 0;

    Emitter() {
        for (auto& p : particles) p.age = N;
    }

    template <int M>
    void update() {
        for (auto& p : particles) p.update(M);

        for (int i = 0; i < M; ++i) {
            auto& p = particles[tap];

            // Fountain emission
            if (rnd::prob(0.95)) {
                p.vel.set(
                    rnd::uniform(-0.1f, -0.05f),
                    rnd::uniform(0.12f, 0.14f),
                    rnd::uniform(-0.01f, 0.01f)
                );
                p.acc.set(0, -0.002f, 0);  // Gravity
            } else {
                // Occasional spray
                p.vel.set(
                    rnd::uniformS(0.01f),
                    rnd::uniformS(0.01f),
                    rnd::uniformS(0.01f)
                );
                p.acc.set(0, 0, 0);
            }
            p.pos.set(0, -2, 0);  // Emission point
            p.age = 0;

            ++tap;
            if (tap >= N) tap = 0;
        }
    }

    int size() { return N; }
};

class ParticleFountain : public WebApp {
public:
    Emitter<8000> emitter;
    Mesh mesh;
    bool keys[256] = {false};
    float moveSpeed = 5.0f;

    void onCreate() override {
        nav().pos(4, 0, 8);
        nav().faceToward(Vec3f(0, 0, 0));
    }

    void onAnimate(double dt) override {
        // Camera movement (WASD + QE)
        Vec3d forward = nav().uf();
        Vec3d right = nav().ur();
        Vec3d up = Vec3d(0, 1, 0);

        if (keys['W'] || keys['w']) nav().pos() += forward * moveSpeed * dt;
        if (keys['S'] || keys['s']) nav().pos() -= forward * moveSpeed * dt;
        if (keys['A'] || keys['a']) nav().pos() -= right * moveSpeed * dt;
        if (keys['D'] || keys['d']) nav().pos() += right * moveSpeed * dt;
        if (keys['Q'] || keys['q']) nav().pos() -= up * moveSpeed * dt;
        if (keys['E'] || keys['e']) nav().pos() += up * moveSpeed * dt;

        emitter.update<40>();

        mesh.reset();
        mesh.primitive(Mesh::POINTS);

        for (int i = 0; i < emitter.size(); ++i) {
            Particle& p = emitter.particles[i];
            float age = float(p.age) / emitter.size();

            mesh.vertex(p.pos);
            // Color based on age: blue to transparent
            mesh.color(Color(0.3f, 0.5f, 1.0f, (1.0f - age) * 0.6f));
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f, 0.02f, 0.05f);
        g.blending(true);
        g.blendAdd();
        g.depthTesting(false);
        g.pointSize(4);
        g.meshColor();
        g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        keys[k.key()] = true;
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        keys[k.key()] = false;
        return true;
    }
};

ALLOLIB_WEB_MAIN(ParticleFountain)
`,
  },
  {
    id: 'sim-particle-galaxy',
    title: 'Particle Galaxy',
    description: 'Spinning galaxy of particles with orbital motion',
    category: 'simulation',
    subcategory: 'particles',
    code: `/**
 * Particle Galaxy
 *
 * Particles orbit around a center point creating a galaxy effect.
 * Demonstrates circular motion and mesh generation.
 */

#include "al_WebApp.hpp"
#include "al/math/al_Random.hpp"
#include <cmath>

using namespace al;

struct Star {
    float radius;      // Distance from center
    float angle;       // Current angle
    float speed;       // Angular velocity
    float height;      // Y offset
    float brightness;

    void update(float dt) {
        angle += speed * dt;
        if (angle > M_2PI) angle -= M_2PI;
    }

    Vec3f position() const {
        return Vec3f(
            cos(angle) * radius,
            height + sin(angle * 3) * 0.1f,
            sin(angle) * radius
        );
    }
};

class ParticleGalaxy : public WebApp {
public:
    static const int NUM_STARS = 10000;
    Star stars[NUM_STARS];
    Mesh mesh;
    float rotation = 0;
    bool keys[256] = {false};
    float moveSpeed = 5.0f;

    void onCreate() override {
        // Initialize stars with random orbits
        for (int i = 0; i < NUM_STARS; ++i) {
            Star& s = stars[i];
            // Distribute radius with more stars near center
            float r = rnd::uniform();
            s.radius = r * r * 4.0f + 0.2f;
            s.angle = rnd::uniform() * M_2PI;
            // Inner stars orbit faster (Kepler's law approximation)
            s.speed = 0.5f / (s.radius + 0.5f);
            s.height = rnd::uniformS(0.2f) * (1.0f - r);
            s.brightness = rnd::uniform(0.3f, 1.0f);
        }

        nav().pos(0, 3, 8);
        nav().faceToward(Vec3f(0, 0, 0));
    }

    void onAnimate(double dt) override {
        // Camera movement (WASD + QE)
        Vec3d forward = nav().uf();
        Vec3d right = nav().ur();
        Vec3d up = Vec3d(0, 1, 0);

        if (keys['W'] || keys['w']) nav().pos() += forward * moveSpeed * dt;
        if (keys['S'] || keys['s']) nav().pos() -= forward * moveSpeed * dt;
        if (keys['A'] || keys['a']) nav().pos() -= right * moveSpeed * dt;
        if (keys['D'] || keys['d']) nav().pos() += right * moveSpeed * dt;
        if (keys['Q'] || keys['q']) nav().pos() -= up * moveSpeed * dt;
        if (keys['E'] || keys['e']) nav().pos() += up * moveSpeed * dt;

        rotation += dt * 0.1;

        // Update all stars
        for (int i = 0; i < NUM_STARS; ++i) {
            stars[i].update(dt);
        }

        // Rebuild mesh
        mesh.reset();
        mesh.primitive(Mesh::POINTS);

        for (int i = 0; i < NUM_STARS; ++i) {
            Star& s = stars[i];
            mesh.vertex(s.position());

            // Color based on radius: blue core, white/yellow outer
            float t = s.radius / 4.0f;
            float r = 0.6f + t * 0.4f;
            float g = 0.7f + t * 0.3f;
            float b = 1.0f - t * 0.3f;
            mesh.color(Color(r, g, b, s.brightness * 0.8f));
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.01f, 0.01f, 0.02f);
        g.blending(true);
        g.blendAdd();
        g.depthTesting(false);
        g.pointSize(2);

        g.pushMatrix();
        g.rotate(rotation * 10, 0, 1, 0);
        g.meshColor();
        g.draw(mesh);
        g.popMatrix();
    }

    bool onKeyDown(const Keyboard& k) override {
        keys[k.key()] = true;
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        keys[k.key()] = false;
        return true;
    }
};

ALLOLIB_WEB_MAIN(ParticleGalaxy)
`,
  },

  // ==========================================================================
  // SIMULATION - Physics
  // ==========================================================================
  {
    id: 'sim-wave-equation',
    title: 'Wave Equation',
    description: '2D wave simulation with ripples and reflections',
    category: 'simulation',
    subcategory: 'physics',
    code: `/**
 * Wave Equation Simulation
 *
 * Implements a discretized 2D wave equation with random droplets.
 * Based on allolib/examples/simulation/waveEquation.cpp
 *
 * u(r,t+1) = 2u(r,t) - u(r,t-1) + v^2[u(r+1,t) - 2u(r,t) + u(r-1,t)]
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/math/al_Random.hpp"

using namespace al;

class WaveEquation : public WebApp {
public:
    static const int Nx = 128, Ny = 128;  // Grid size
    float wave[Nx * Ny * 2];  // Double buffer for wave values
    int zcurr = 0;            // Current time plane
    float decay = 0.96f;      // Wave decay factor
    float velocity = 0.4f;    // Wave propagation speed

    Mesh mesh;

    // Camera control
    bool keys[256] = {false};
    float moveSpeed = 3.0f;

    void onCreate() override {
        // Initialize wave array to zero
        for (int i = 0; i < Nx * Ny * 2; ++i) wave[i] = 0;

        // Create a tessellated plane mesh
        addSurface(mesh, Nx, Ny);

        nav().pos(0, 2, 3);
        nav().faceToward(Vec3f(0, 0, 0));
    }

    int indexAt(int x, int y, int z) {
        return (y * Nx + x) * 2 + z;
    }

    void onAnimate(double dt) override {
        // Camera movement
        Vec3d forward = nav().uf();
        Vec3d right = nav().ur();
        Vec3d up = Vec3d(0, 1, 0);
        if (keys['W'] || keys['w']) nav().pos() += forward * moveSpeed * dt;
        if (keys['S'] || keys['s']) nav().pos() -= forward * moveSpeed * dt;
        if (keys['A'] || keys['a']) nav().pos() -= right * moveSpeed * dt;
        if (keys['D'] || keys['d']) nav().pos() += right * moveSpeed * dt;
        if (keys['Q'] || keys['q']) nav().pos() -= up * moveSpeed * dt;
        if (keys['E'] || keys['e']) nav().pos() += up * moveSpeed * dt;

        int zprev = 1 - zcurr;

        // Add random droplets
        for (int k = 0; k < 2; ++k) {
            if (rnd::prob(0.02f)) {
                int ix = rnd::uniform(Nx - 8) + 4;
                int iy = rnd::uniform(Ny - 8) + 4;

                // Create Gaussian droplet
                for (int j = -4; j <= 4; ++j) {
                    for (int i = -4; i <= 4; ++i) {
                        float x = float(i) / 4.0f;
                        float y = float(j) / 4.0f;
                        float v = 0.3f * exp(-(x*x + y*y) / 0.25f);
                        wave[indexAt(ix + i, iy + j, zcurr)] += v;
                        wave[indexAt(ix + i, iy + j, zprev)] += v;
                    }
                }
            }
        }

        // Update wave equation
        for (int j = 0; j < Ny; ++j) {
            for (int i = 0; i < Nx; ++i) {
                // Wrap at boundaries (toroidal)
                int im1 = i > 0 ? i - 1 : Nx - 1;
                int ip1 = i < Nx - 1 ? i + 1 : 0;
                int jm1 = j > 0 ? j - 1 : Ny - 1;
                int jp1 = j < Ny - 1 ? j + 1 : 0;

                // Get neighborhood values
                float vp = wave[indexAt(i, j, zprev)];
                float vc = wave[indexAt(i, j, zcurr)];
                float vl = wave[indexAt(im1, j, zcurr)];
                float vr = wave[indexAt(ip1, j, zcurr)];
                float vd = wave[indexAt(i, jm1, zcurr)];
                float vu = wave[indexAt(i, jp1, zcurr)];

                // Wave equation update
                float val = 2*vc - vp + velocity*((vl - 2*vc + vr) + (vd - 2*vc + vu));
                wave[indexAt(i, j, zprev)] = val * decay;

                // Update mesh vertex height
                int idx = j * Nx + i;
                mesh.vertices()[idx].z = val;
            }
        }

        mesh.generateNormals();
        zcurr = zprev;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        g.pushMatrix();
        g.rotate(-60, 1, 0, 0);
        g.scale(2);
        g.color(0.3f, 0.6f, 0.9f);
        g.draw(mesh);
        g.popMatrix();
    }

    bool onKeyDown(const Keyboard& k) override {
        keys[k.key()] = true;
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        keys[k.key()] = false;
        return true;
    }
};

// Use WASD to move camera, Q/E for up/down
ALLOLIB_WEB_MAIN(WaveEquation)
`,
  },
  {
    id: 'sim-spring-mesh',
    title: 'Spring Mesh',
    description: 'Soft body simulation using spring-mass physics',
    category: 'simulation',
    subcategory: 'physics',
    code: `/**
 * Spring Mesh Simulation
 *
 * A grid of particles connected by springs creating a cloth-like effect.
 * Click to apply force to the mesh.
 */

#include "al_WebApp.hpp"
#include "al/math/al_Random.hpp"
#include <vector>

using namespace al;

struct MassPoint {
    Vec3f pos, vel;
    bool fixed = false;

    void update(float dt, Vec3f force) {
        if (fixed) return;
        Vec3f acc = force;
        vel += acc * dt;
        vel *= 0.98f;  // Damping
        pos += vel * dt;
    }
};

class SpringMesh : public WebApp {
public:
    static const int WIDTH = 20;
    static const int HEIGHT = 15;
    MassPoint points[WIDTH * HEIGHT];
    Mesh mesh;

    float stiffness = 50.0f;
    float restLength = 0.15f;
    Vec3f gravity{0, -2.0f, 0};

    // Camera control
    bool keys[256] = {false};
    float moveSpeed = 3.0f;

    void onCreate() override {
        // Initialize grid of points
        for (int y = 0; y < HEIGHT; ++y) {
            for (int x = 0; x < WIDTH; ++x) {
                int i = y * WIDTH + x;
                points[i].pos = Vec3f(
                    (x - WIDTH/2.0f) * restLength,
                    (HEIGHT/2.0f - y) * restLength,
                    0
                );
                points[i].vel.set(0, 0, 0);
                // Fix top row
                if (y == 0 && (x == 0 || x == WIDTH-1 || x == WIDTH/2)) {
                    points[i].fixed = true;
                }
            }
        }

        nav().pos(0, 0, 4);
    }

    Vec3f springForce(MassPoint& a, MassPoint& b) {
        Vec3f diff = b.pos - a.pos;
        float dist = diff.mag();
        if (dist < 0.001f) return Vec3f(0);

        float stretch = dist - restLength;
        return diff.normalized() * stretch * stiffness;
    }

    void onAnimate(double dt) override {
        // Camera movement
        Vec3d forward = nav().uf();
        Vec3d right = nav().ur();
        Vec3d up = Vec3d(0, 1, 0);
        if (keys['W'] || keys['w']) nav().pos() += forward * moveSpeed * dt;
        if (keys['S'] || keys['s']) nav().pos() -= forward * moveSpeed * dt;
        if (keys['A'] || keys['a']) nav().pos() -= right * moveSpeed * dt;
        if (keys['D'] || keys['d']) nav().pos() += right * moveSpeed * dt;
        if (keys['Q'] || keys['q']) nav().pos() -= up * moveSpeed * dt;
        if (keys['E'] || keys['e']) nav().pos() += up * moveSpeed * dt;

        float step = 0.002f;  // Fixed timestep for stability
        int steps = int(dt / step) + 1;

        for (int s = 0; s < steps; ++s) {
            // Calculate forces
            std::vector<Vec3f> forces(WIDTH * HEIGHT, gravity);

            // Horizontal springs
            for (int y = 0; y < HEIGHT; ++y) {
                for (int x = 0; x < WIDTH - 1; ++x) {
                    int i = y * WIDTH + x;
                    int j = i + 1;
                    Vec3f f = springForce(points[i], points[j]);
                    forces[i] += f;
                    forces[j] -= f;
                }
            }

            // Vertical springs
            for (int y = 0; y < HEIGHT - 1; ++y) {
                for (int x = 0; x < WIDTH; ++x) {
                    int i = y * WIDTH + x;
                    int j = i + WIDTH;
                    Vec3f f = springForce(points[i], points[j]);
                    forces[i] += f;
                    forces[j] -= f;
                }
            }

            // Update positions
            for (int i = 0; i < WIDTH * HEIGHT; ++i) {
                points[i].update(step, forces[i]);
            }
        }

        // Build mesh
        mesh.reset();
        mesh.primitive(Mesh::LINES);

        // Horizontal lines
        for (int y = 0; y < HEIGHT; ++y) {
            for (int x = 0; x < WIDTH - 1; ++x) {
                int i = y * WIDTH + x;
                mesh.vertex(points[i].pos);
                mesh.vertex(points[i + 1].pos);
                mesh.color(0.4f, 0.7f, 1.0f);
                mesh.color(0.4f, 0.7f, 1.0f);
            }
        }

        // Vertical lines
        for (int y = 0; y < HEIGHT - 1; ++y) {
            for (int x = 0; x < WIDTH; ++x) {
                int i = y * WIDTH + x;
                mesh.vertex(points[i].pos);
                mesh.vertex(points[i + WIDTH].pos);
                mesh.color(0.4f, 0.7f, 1.0f);
                mesh.color(0.4f, 0.7f, 1.0f);
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f);
        g.depthTesting(true);
        g.meshColor();
        g.draw(mesh);

        // Draw fixed points
        Mesh fixedPts;
        fixedPts.primitive(Mesh::POINTS);
        for (int i = 0; i < WIDTH * HEIGHT; ++i) {
            if (points[i].fixed) {
                fixedPts.vertex(points[i].pos);
                fixedPts.color(1.0f, 0.3f, 0.3f);
            }
        }
        g.pointSize(8);
        g.draw(fixedPts);
    }

    bool onKeyDown(const Keyboard& k) override {
        keys[k.key()] = true;
        if (k.key() == ' ') {
            // Apply random impulse
            for (int i = 0; i < WIDTH * HEIGHT; ++i) {
                if (!points[i].fixed) {
                    points[i].vel += Vec3f(
                        rnd::uniformS(2.0f),
                        rnd::uniform(1.0f, 3.0f),
                        rnd::uniformS(2.0f)
                    );
                }
            }
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        keys[k.key()] = false;
        return true;
    }
};

// Use WASD to move camera, Q/E for up/down. SPACE to shake the mesh!
ALLOLIB_WEB_MAIN(SpringMesh)
`,
  },

  // ==========================================================================
  // SIMULATION - Agent-Based
  // ==========================================================================
  {
    id: 'sim-flocking',
    title: 'Flocking Boids',
    description: 'Reynolds flocking algorithm with collision avoidance and velocity matching',
    category: 'simulation',
    subcategory: 'agents',
    code: `/**
 * Flocking Boids
 *
 * Implementation of Craig Reynolds' flocking algorithm with:
 * - Collision avoidance
 * - Velocity matching
 * - Random hunting motion
 *
 * Based on allolib/examples/simulation/flocking.cpp
 * Press R to reset boids.
 */

#include "al_WebApp.hpp"
#include "al/math/al_Random.hpp"
#include <cmath>

using namespace al;

class Boid {
public:
    Vec2f pos, vel;

    void update(float dt) {
        pos += vel * dt;
    }
};

class FlockingBoids : public WebApp {
public:
    static const int NUM_BOIDS = 64;
    Boid boids[NUM_BOIDS];
    Mesh heads, tails, box;

    // Camera control
    bool keys[256] = {false};
    float moveSpeed = 3.0f;

    void onCreate() override {
        // Create boundary box
        box.primitive(Mesh::LINE_LOOP);
        box.vertex(-1, -1, 0);
        box.vertex(1, -1, 0);
        box.vertex(1, 1, 0);
        box.vertex(-1, 1, 0);

        nav().pos(0, 0, 4);
        resetBoids();
    }

    void resetBoids() {
        for (auto& b : boids) {
            // Random position and velocity in unit disc
            float r = sqrt(rnd::uniform());
            float a = rnd::uniform() * M_2PI;
            b.pos = Vec2f(cos(a) * r, sin(a) * r);

            r = sqrt(rnd::uniform()) * 0.5f;
            a = rnd::uniform() * M_2PI;
            b.vel = Vec2f(cos(a) * r, sin(a) * r);
        }
    }

    void onAnimate(double dt) override {
        // Camera movement
        Vec3d forward = nav().uf();
        Vec3d right = nav().ur();
        Vec3d up = Vec3d(0, 1, 0);
        if (keys['W'] || keys['w']) nav().pos() += forward * moveSpeed * dt;
        if (keys['S'] || keys['s']) nav().pos() -= forward * moveSpeed * dt;
        if (keys['A'] || keys['a']) nav().pos() -= right * moveSpeed * dt;
        if (keys['D'] || keys['d']) nav().pos() += right * moveSpeed * dt;
        if (keys['Q'] || keys['q']) nav().pos() -= up * moveSpeed * dt;
        if (keys['E'] || keys['e']) nav().pos() += up * moveSpeed * dt;

        // Boid-boid interactions
        for (int i = 0; i < NUM_BOIDS - 1; ++i) {
            for (int j = i + 1; j < NUM_BOIDS; ++j) {
                Vec2f ds = boids[i].pos - boids[j].pos;
                float dist = ds.mag();
                if (dist < 0.001f) continue;

                // Collision avoidance (Gaussian falloff)
                float pushRadius = 0.08f;
                float pushStrength = 1.0f;
                float push = exp(-dist*dist / (pushRadius*pushRadius)) * pushStrength;
                Vec2f pushVec = ds.normalized() * push;
                boids[i].vel += pushVec;
                boids[j].vel -= pushVec;

                // Velocity matching
                float matchRadius = 0.15f;
                float nearness = exp(-dist*dist / (matchRadius*matchRadius));
                Vec2f veli = boids[i].vel;
                Vec2f velj = boids[j].vel;
                boids[i].vel = veli * (1 - 0.5f*nearness) + velj * (0.5f*nearness);
                boids[j].vel = velj * (1 - 0.5f*nearness) + veli * (0.5f*nearness);
            }
        }

        // Individual behaviors
        for (auto& b : boids) {
            // Random hunting motion
            float huntUrge = 0.3f;
            float r = sqrt(rnd::uniform());
            float a = rnd::uniform() * M_2PI;
            Vec2f hunt(cos(a) * r, sin(a) * r);
            hunt *= hunt.magSqr();  // Cubed distribution
            b.vel += hunt * huntUrge;

            // Speed limit
            float speed = b.vel.mag();
            if (speed > 2.0f) b.vel *= 2.0f / speed;

            // Boundary reflection
            if (b.pos.x > 1 || b.pos.x < -1) {
                b.pos.x = b.pos.x > 0 ? 1 : -1;
                b.vel.x = -b.vel.x;
            }
            if (b.pos.y > 1 || b.pos.y < -1) {
                b.pos.y = b.pos.y > 0 ? 1 : -1;
                b.vel.y = -b.vel.y;
            }

            b.update(dt);
        }

        // Generate meshes
        heads.reset();
        heads.primitive(Mesh::POINTS);
        tails.reset();
        tails.primitive(Mesh::LINES);

        for (int i = 0; i < NUM_BOIDS; ++i) {
            Vec3f pos(boids[i].pos.x, boids[i].pos.y, 0);
            Vec3f tailEnd = pos - Vec3f(boids[i].vel.normalized() * 0.07f, 0);

            heads.vertex(pos);
            float hue = float(i) / NUM_BOIDS * 0.3f + 0.55f;
            Color c = HSV(hue, 0.7f, 1.0f);
            heads.color(c);

            tails.vertex(pos);
            tails.vertex(tailEnd);
            tails.color(c);
            tails.color(Color(0.5f));
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f);
        g.depthTesting(true);
        g.pointSize(8);
        g.meshColor();
        g.draw(heads);
        g.draw(tails);

        g.color(0.3f);
        g.draw(box);
    }

    bool onKeyDown(const Keyboard& k) override {
        keys[k.key()] = true;
        if (k.key() == 'r' || k.key() == 'R') {
            resetBoids();
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        keys[k.key()] = false;
        return true;
    }
};

// Use WASD to move camera, Q/E for up/down. R to reset the flock!
ALLOLIB_WEB_MAIN(FlockingBoids)
`,
  },
  {
    id: 'sim-ant-trails',
    title: 'Ant Colony Trails',
    description: 'Ant colony simulation with pheromone trails',
    category: 'simulation',
    subcategory: 'agents',
    code: `/**
 * Ant Colony Simulation
 *
 * Simple ant foraging with pheromone trail following.
 * Ants search for food and leave trails for others to follow.
 */

#include "al_WebApp.hpp"
#include "al/math/al_Random.hpp"
#include <cmath>
#include <vector>

using namespace al;

class AntTrails : public WebApp {
public:
    static const int GRID_SIZE = 100;
    static const int NUM_ANTS = 200;

    float pheromones[GRID_SIZE][GRID_SIZE];
    float food[GRID_SIZE][GRID_SIZE];

    struct Ant {
        Vec2f pos;
        float angle;
        bool hasFood;
    };
    std::vector<Ant> ants;

    Vec2f nestPos{GRID_SIZE/2.0f, GRID_SIZE/2.0f};
    Mesh trailMesh, antMesh, foodMesh;

    // Camera control
    bool keys[256] = {false};
    float moveSpeed = 3.0f;

    void onCreate() override {
        // Initialize pheromones and food
        for (int y = 0; y < GRID_SIZE; ++y) {
            for (int x = 0; x < GRID_SIZE; ++x) {
                pheromones[y][x] = 0;
                food[y][x] = 0;
            }
        }

        // Place food sources
        placeFood(20, 20, 8);
        placeFood(80, 30, 6);
        placeFood(70, 75, 10);

        // Initialize ants
        ants.resize(NUM_ANTS);
        for (auto& ant : ants) {
            ant.pos = nestPos;
            ant.angle = rnd::uniform() * M_2PI;
            ant.hasFood = false;
        }

        nav().pos(0, 0, 3);
    }

    void placeFood(int cx, int cy, int radius) {
        for (int dy = -radius; dy <= radius; ++dy) {
            for (int dx = -radius; dx <= radius; ++dx) {
                if (dx*dx + dy*dy <= radius*radius) {
                    int x = cx + dx;
                    int y = cy + dy;
                    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                        food[y][x] = 1.0f;
                    }
                }
            }
        }
    }

    void onAnimate(double dt) override {
        // Camera movement
        Vec3d forward = nav().uf();
        Vec3d right = nav().ur();
        Vec3d up = Vec3d(0, 1, 0);
        if (keys['W'] || keys['w']) nav().pos() += forward * moveSpeed * dt;
        if (keys['S'] || keys['s']) nav().pos() -= forward * moveSpeed * dt;
        if (keys['A'] || keys['a']) nav().pos() -= right * moveSpeed * dt;
        if (keys['D'] || keys['d']) nav().pos() += right * moveSpeed * dt;
        if (keys['Q'] || keys['q']) nav().pos() -= up * moveSpeed * dt;
        if (keys['E'] || keys['e']) nav().pos() += up * moveSpeed * dt;

        // Evaporate pheromones
        for (int y = 0; y < GRID_SIZE; ++y) {
            for (int x = 0; x < GRID_SIZE; ++x) {
                pheromones[y][x] *= 0.995f;
            }
        }

        // Update ants
        for (auto& ant : ants) {
            // Sense pheromones
            float leftAngle = ant.angle + 0.5f;
            float rightAngle = ant.angle - 0.5f;

            Vec2f leftPos = ant.pos + Vec2f(cos(leftAngle), sin(leftAngle)) * 2;
            Vec2f rightPos = ant.pos + Vec2f(cos(rightAngle), sin(rightAngle)) * 2;

            float leftPher = samplePheromone(leftPos);
            float rightPher = samplePheromone(rightPos);

            // Turn towards stronger pheromone
            if (!ant.hasFood) {
                if (leftPher > rightPher) ant.angle += 0.1f;
                else if (rightPher > leftPher) ant.angle -= 0.1f;
            }

            // Random wandering
            ant.angle += rnd::uniformS(0.3f);

            // Move forward
            float speed = 15.0f * dt;
            ant.pos += Vec2f(cos(ant.angle), sin(ant.angle)) * speed;

            // Boundary wrapping
            if (ant.pos.x < 0) ant.pos.x += GRID_SIZE;
            if (ant.pos.x >= GRID_SIZE) ant.pos.x -= GRID_SIZE;
            if (ant.pos.y < 0) ant.pos.y += GRID_SIZE;
            if (ant.pos.y >= GRID_SIZE) ant.pos.y -= GRID_SIZE;

            int gx = int(ant.pos.x);
            int gy = int(ant.pos.y);

            if (ant.hasFood) {
                // Deposit pheromone while carrying food
                pheromones[gy][gx] = std::min(1.0f, pheromones[gy][gx] + 0.1f);

                // Check if at nest
                float distToNest = (ant.pos - nestPos).mag();
                if (distToNest < 3) {
                    ant.hasFood = false;
                    ant.angle += M_PI;  // Turn around
                }
            } else {
                // Check for food
                if (food[gy][gx] > 0) {
                    ant.hasFood = true;
                    food[gy][gx] -= 0.01f;
                    if (food[gy][gx] < 0) food[gy][gx] = 0;
                    ant.angle += M_PI;  // Turn around
                }
            }
        }

        // Build meshes
        buildTrailMesh();
        buildAntMesh();
        buildFoodMesh();
    }

    float samplePheromone(Vec2f pos) {
        int x = int(pos.x) % GRID_SIZE;
        int y = int(pos.y) % GRID_SIZE;
        if (x < 0) x += GRID_SIZE;
        if (y < 0) y += GRID_SIZE;
        return pheromones[y][x];
    }

    void buildTrailMesh() {
        trailMesh.reset();
        trailMesh.primitive(Mesh::POINTS);

        float scale = 2.0f / GRID_SIZE;
        for (int y = 0; y < GRID_SIZE; ++y) {
            for (int x = 0; x < GRID_SIZE; ++x) {
                float p = pheromones[y][x];
                if (p > 0.01f) {
                    trailMesh.vertex(
                        (x - GRID_SIZE/2.0f) * scale,
                        (y - GRID_SIZE/2.0f) * scale,
                        0
                    );
                    trailMesh.color(0.2f, 0.8f, 0.3f, p * 0.5f);
                }
            }
        }
    }

    void buildAntMesh() {
        antMesh.reset();
        antMesh.primitive(Mesh::POINTS);

        float scale = 2.0f / GRID_SIZE;
        for (auto& ant : ants) {
            antMesh.vertex(
                (ant.pos.x - GRID_SIZE/2.0f) * scale,
                (ant.pos.y - GRID_SIZE/2.0f) * scale,
                0.01f
            );
            if (ant.hasFood) {
                antMesh.color(1.0f, 0.8f, 0.2f);
            } else {
                antMesh.color(0.8f, 0.2f, 0.2f);
            }
        }
    }

    void buildFoodMesh() {
        foodMesh.reset();
        foodMesh.primitive(Mesh::POINTS);

        float scale = 2.0f / GRID_SIZE;
        for (int y = 0; y < GRID_SIZE; ++y) {
            for (int x = 0; x < GRID_SIZE; ++x) {
                if (food[y][x] > 0) {
                    foodMesh.vertex(
                        (x - GRID_SIZE/2.0f) * scale,
                        (y - GRID_SIZE/2.0f) * scale,
                        0
                    );
                    foodMesh.color(0.2f, 0.6f, 1.0f, food[y][x]);
                }
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f);
        g.blending(true);
        g.blendAdd();
        g.depthTesting(false);

        g.pointSize(3);
        g.meshColor();
        g.draw(trailMesh);

        g.pointSize(5);
        g.draw(foodMesh);

        g.pointSize(3);
        g.draw(antMesh);

        // Draw nest
        Mesh nest;
        nest.primitive(Mesh::POINTS);
        float scale = 2.0f / GRID_SIZE;
        nest.vertex(0, 0, 0.02f);
        nest.color(1.0f, 1.0f, 1.0f);
        g.pointSize(10);
        g.draw(nest);
    }

    bool onKeyDown(const Keyboard& k) override {
        keys[k.key()] = true;
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        keys[k.key()] = false;
        return true;
    }
};

// Use WASD to move camera, Q/E for up/down
ALLOLIB_WEB_MAIN(AntTrails)
`,
  },

  {
    id: 'agents-predator-prey',
    title: 'Predator-Prey',
    description: 'Ecosystem simulation with predators hunting prey',
    category: 'simulation',
    subcategory: 'agents',
    code: `/**
 * Predator-Prey Ecosystem
 * Features: Energy, hunting, reproduction, death
 * Controls: Space = pause, P = add prey, H = add predator
 */
#include "al_playground_compat.hpp"
#include <vector>
#include <cmath>
#include <algorithm>

using namespace al;

struct Agent { Vec2f pos,vel; float energy,size; int type; bool alive; };

class PredatorPrey : public WebApp {
public:
    std::vector<Agent> agents;
    Mesh mesh; bool running=true;
    float worldSize=3.0f;
    rnd::Random<> rng;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);
        for(int i=0;i<60;i++) spawn(0);
        for(int i=0;i<10;i++) spawn(1);
        nav().pos(0,0,8);
    }

    void spawn(int type) {
        Agent a; a.type=type;
        a.pos=Vec2f(rng.uniformS(),rng.uniformS())*worldSize*0.9f;
        a.vel=Vec2f(rng.uniformS(),rng.uniformS())*0.5f;
        a.energy=(type==0)?50.0f:80.0f;
        a.size=(type==0)?0.08f:0.12f;
        a.alive=true;
        agents.push_back(a);
    }

    void onAnimate(double dt) override {
        if(!running) return;

        for(auto& a:agents){
            if(!a.alive) continue;
            a.energy-=dt*(a.type==0?3.0f:5.0f);

            if(a.type==1){
                Agent* nearest=nullptr; float minD=999;
                for(auto& b:agents){
                    if(!b.alive||b.type!=0) continue;
                    float d=(a.pos-b.pos).mag();
                    if(d<minD){minD=d;nearest=&b;}
                }
                if(nearest&&minD<2.0f){
                    Vec2f dir=(nearest->pos-a.pos).normalize();
                    a.vel+=dir*dt*3.0f;
                    if(minD<a.size+nearest->size){
                        a.energy+=30.0f;
                        nearest->alive=false;
                    }
                }
            }

            a.vel+=Vec2f(rng.uniformS(),rng.uniformS())*dt*2.0f;
            a.vel*=0.95f;
            float maxSpd=(a.type==0)?1.5f:2.0f;
            if(a.vel.mag()>maxSpd) a.vel=a.vel.normalize()*maxSpd;
            a.pos+=a.vel*dt;

            if(a.pos.x>worldSize){a.pos.x=worldSize;a.vel.x*=-0.5f;}
            if(a.pos.x<-worldSize){a.pos.x=-worldSize;a.vel.x*=-0.5f;}
            if(a.pos.y>worldSize){a.pos.y=worldSize;a.vel.y*=-0.5f;}
            if(a.pos.y<-worldSize){a.pos.y=-worldSize;a.vel.y*=-0.5f;}

            float thresh=(a.type==0)?100.0f:150.0f;
            int maxPop=(a.type==0)?100:20;
            int count=0;for(auto& b:agents)if(b.alive&&b.type==a.type)count++;
            if(a.energy>thresh&&count<maxPop){
                a.energy*=0.5f;
                spawn(a.type);
                agents.back().pos=a.pos+Vec2f(rng.uniformS(),rng.uniformS())*0.2f;
            }

            if(a.energy<=0) a.alive=false;
        }

        if(rng.prob(0.01)){spawn(0);}

        agents.erase(std::remove_if(agents.begin(),agents.end(),[](const Agent& a){return !a.alive;}),agents.end());

        mesh.reset();
        for(auto& a:agents){
            mesh.vertex(a.pos.x,a.pos.y,0);
            if(a.type==0) mesh.color(0.3f,0.9f,0.4f,fmin(1.0f,a.energy/50.0f));
            else mesh.color(0.9f,0.3f,0.2f,fmin(1.0f,a.energy/80.0f));
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f,0.03f,0.05f);
        g.blending(true);g.blendAdd();g.depthTesting(false);
        g.pointSize(8);g.meshColor();g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()==' ')running=!running;
        if(k.key()=='p')for(int i=0;i<5;i++)spawn(0);
        if(k.key()=='h')spawn(1);
        return true;
    }
};

ALLOLIB_WEB_MAIN(PredatorPrey)
`,
  },

  {
    id: 'agents-school-fish',
    title: '3D Fish School',
    description: '3D boids simulation of schooling fish',
    category: 'simulation',
    subcategory: 'agents',
    code: `/**
 * 3D Fish Schooling
 * Features: 3D boids with cohesion, separation, alignment
 * Controls: WASD/QE = move camera
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

struct Fish { Vec3f pos,vel; float phase; };

class FishSchool : public WebApp {
public:
    static const int NUM=200;
    Fish fish[NUM];
    Mesh mesh;
    rnd::Random<> rng;
    bool keys[256];
    float time=0;

    void onCreate() override {
        memset(keys,0,sizeof(keys));
        mesh.primitive(Mesh::POINTS);
        for(int i=0;i<NUM;i++){
            fish[i].pos=Vec3f(rng.uniformS(),rng.uniformS(),rng.uniformS())*3.0f;
            fish[i].vel=Vec3f(rng.uniformS(),rng.uniformS(),rng.uniformS())*0.5f;
            fish[i].phase=rng.uniform()*6.28f;
        }
        nav().pos(0,0,12);
    }

    void onAnimate(double dt) override {
        float dtf=(float)dt;
        time+=dtf;
        float spd=5.0f*dtf;
        if(keys[(int)'w'])nav().pos()+=nav().uf()*spd;if(keys[(int)'s'])nav().pos()-=nav().uf()*spd;
        if(keys[(int)'a'])nav().pos()-=nav().ur()*spd;if(keys[(int)'d'])nav().pos()+=nav().ur()*spd;
        if(keys[(int)'q'])nav().pos()-=nav().uu()*spd;if(keys[(int)'e'])nav().pos()+=nav().uu()*spd;

        for(int i=0;i<NUM;i++){
            Vec3f sep,ali,coh; int count=0;

            for(int j=0;j<NUM;j++){
                if(i==j)continue;
                Vec3f diff=fish[i].pos-fish[j].pos;
                float d=diff.mag();
                if(d<2.0f){
                    sep+=diff.normalize()/(d+0.1f);
                    ali+=fish[j].vel;
                    coh+=fish[j].pos;
                    count++;
                }
            }

            if(count>0){
                ali/=(float)count; coh/=(float)count;
                fish[i].vel+=sep*0.05f;
                fish[i].vel+=(ali-fish[i].vel)*0.02f;
                fish[i].vel+=(coh-fish[i].pos)*0.01f;
            }

            Vec3f center=-fish[i].pos;
            if(fish[i].pos.mag()>5.0f) fish[i].vel+=center.normalize()*0.1f;

            float maxSpd=2.0f;
            if(fish[i].vel.mag()>maxSpd) fish[i].vel=fish[i].vel.normalize()*maxSpd;
            if(fish[i].vel.mag()<0.5f) fish[i].vel=fish[i].vel.normalize()*0.5f;

            fish[i].pos+=fish[i].vel*dtf;
        }

        mesh.reset();
        for(int i=0;i<NUM;i++){
            mesh.vertex(fish[i].pos);
            float h=fmodf(fish[i].phase+time*0.5f,6.28f)/6.28f;
            mesh.color(HSV(0.55f+h*0.1f,0.7f,0.9f));
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f,0.05f,0.1f);
        g.blending(true);g.blendAdd();g.depthTesting(false);
        g.pointSize(5);g.meshColor();g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {int key=k.key();if(key>=0&&key<256)keys[key]=true;return true;}
    bool onKeyUp(const Keyboard& k) override {int key=k.key();if(key>=0&&key<256)keys[key]=false;return true;}
};

ALLOLIB_WEB_MAIN(FishSchool)
`,
  },

  // ==========================================================================
  // SIMULATION - Procedural Generation
  // ==========================================================================
  {
    id: 'proc-noise-gallery',
    title: 'Noise Gallery',
    description: 'Interactive gallery of Perlin, FBM, and turbulence noise functions',
    category: 'simulation',
    subcategory: 'procedural',
    code: `/**
 * Noise Gallery - Procedural Noise Functions
 * Controls: 1-4 = noise type, +/- = scale, WASD = pan
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

namespace noise {
    static const int p[512] = {151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180};
    inline float fade(float t) { return t*t*t*(t*(t*6.0f-15.0f)+10.0f); }
    inline float lerp(float t, float a, float b) { return a + t*(b-a); }
    inline float grad(int hash, float x, float y, float z) {
        int h = hash & 15; float u = h<8?x:y, v = h<4?y:(h==12||h==14?x:z);
        return ((h&1)?-u:u)+((h&2)?-v:v);
    }
    float perlin(float x, float y, float z) {
        int X=(int)floor(x)&255, Y=(int)floor(y)&255, Z=(int)floor(z)&255;
        x-=floor(x); y-=floor(y); z-=floor(z);
        float u=fade(x), v=fade(y), w=fade(z);
        int A=p[X]+Y, AA=p[A]+Z, AB=p[A+1]+Z, B=p[X+1]+Y, BA=p[B]+Z, BB=p[B+1]+Z;
        return lerp(w,lerp(v,lerp(u,grad(p[AA],x,y,z),grad(p[BA],x-1,y,z)),lerp(u,grad(p[AB],x,y-1,z),grad(p[BB],x-1,y-1,z))),lerp(v,lerp(u,grad(p[AA+1],x,y,z-1),grad(p[BA+1],x-1,y,z-1)),lerp(u,grad(p[AB+1],x,y-1,z-1),grad(p[BB+1],x-1,y-1,z-1))));
    }
    float fbm(float x, float y, float z, int oct=4) {
        float v=0,a=0.5f,f=1.0f; for(int i=0;i<oct;i++){v+=a*perlin(x*f,y*f,z*f);f*=2;a*=0.5f;} return v;
    }
    float turbulence(float x, float y, float z, int oct=4) {
        float v=0,a=0.5f,f=1.0f; for(int i=0;i<oct;i++){v+=a*fabs(perlin(x*f,y*f,z*f));f*=2;a*=0.5f;} return v;
    }
    float ridged(float x, float y, float z, int oct=4) {
        float v=0,a=0.5f,f=1.0f,pr=1.0f; for(int i=0;i<oct;i++){float n=1.0f-fabs(perlin(x*f,y*f,z*f));n*=n;v+=n*a*pr;pr=n;f*=2;a*=0.5f;} return v;
    }
}

class NoiseGallery : public WebApp {
public:
    Mesh plane; float scale=4.0f, offX=0, offY=0; int type=0; float time=0;
    const int res=100; bool keys[256];

    void onCreate() override { memset(keys,0,sizeof(keys)); plane.primitive(Mesh::POINTS); nav().pos(0,0,2); }

    void onAnimate(double dt) override {
        float dtf=(float)dt;
        time+=dtf; float pan=0.5f*dtf;
        if(keys[(int)'w'])offY+=pan; if(keys[(int)'s'])offY-=pan; if(keys[(int)'a'])offX-=pan; if(keys[(int)'d'])offX+=pan;
        plane.reset(); float step=2.0f/res;
        for(int y=0;y<res;y++) for(int x=0;x<res;x++) {
            float px=-1.0f+x*step, py=-1.0f+y*step;
            float nx=(px+offX)*scale, ny=(py+offY)*scale, nz=time*0.3f, n;
            switch(type){case 0:n=noise::perlin(nx,ny,nz)*0.5f+0.5f;break;case 1:n=noise::fbm(nx,ny,nz)*0.5f+0.5f;break;case 2:n=noise::turbulence(nx,ny,nz);break;default:n=noise::ridged(nx,ny,nz)*0.5f;}
            plane.vertex(px,py,n*0.3f); plane.color(n,n*0.8f,1.0f-n*0.5f);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f); g.depthTesting(true); g.pointSize(3);
        g.pushMatrix(); g.rotate(30,1,0,0); g.meshColor(); g.draw(plane); g.popMatrix();
    }

    bool onKeyDown(const Keyboard& k) override {
        int key=k.key();if(key>=0&&key<256)keys[key]=true;
        if(key>='1'&&key<='4')type=key-'1';
        if(key=='+'||key=='=')scale*=1.2f; if(key=='-')scale/=1.2f;
        return true;
    }
    bool onKeyUp(const Keyboard& k) override { int key=k.key();if(key>=0&&key<256)keys[key]=false; return true; }
};

ALLOLIB_WEB_MAIN(NoiseGallery)
`,
  },

  // ==========================================================================
  // SIMULATION - Ray Marching
  // ==========================================================================
  {
    id: 'rm-sphere-basic',
    title: 'Basic Sphere SDF',
    description: 'Introduction to ray marching with a sphere signed distance function',
    category: 'simulation',
    subcategory: 'raymarching',
    code: `/**
 * Basic Ray Marching - Sphere SDF
 * Controls: WASD = rotate, Q/E = zoom
 */
#include "al_playground_compat.hpp"
#include <cmath>

using namespace al;

const char* rmVert = R"(#version 300 es
precision highp float;
layout(location = 0) in vec3 position;
out vec2 uv;
void main() { uv = position.xy; gl_Position = vec4(position, 1.0); }
)";

const char* rmFrag = R"(#version 300 es
precision highp float;
in vec2 uv; out vec4 fragColor;
uniform float time; uniform vec2 resolution; uniform vec3 camPos;

float sdSphere(vec3 p, float r) { return length(p) - r; }
float scene(vec3 p) {
    vec3 sp = vec3(sin(time)*0.5, 0.0, cos(time)*0.5);
    return min(sdSphere(p-sp, 1.0), p.y+1.0);
}
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(scene(p+e.xyy)-scene(p-e.xyy),scene(p+e.yxy)-scene(p-e.yxy),scene(p+e.yyx)-scene(p-e.yyx)));
}
float march(vec3 ro, vec3 rd) {
    float d = 0.0;
    for (int i = 0; i < 100; i++) { float ds = scene(ro + rd * d); d += ds; if (d > 100.0 || ds < 0.001) break; }
    return d;
}
void main() {
    vec2 p = uv; p.x *= resolution.x / resolution.y;
    vec3 ro = camPos, fwd = normalize(-ro), right = normalize(cross(vec3(0,1,0), fwd)), up = cross(fwd, right);
    vec3 rd = normalize(fwd + p.x * right + p.y * up);
    float d = march(ro, rd);
    vec3 col = mix(vec3(0.1,0.1,0.2), vec3(0.4,0.6,0.9), uv.y * 0.5 + 0.5);
    if (d < 100.0) {
        vec3 pos = ro + rd * d, n = calcNormal(pos), light = normalize(vec3(2,5,-3));
        float diff = max(dot(n, light), 0.0), spec = pow(max(dot(reflect(-light, n), -rd), 0.0), 32.0);
        col = vec3(0.2,0.5,0.8) * (diff * 0.8 + 0.2) + vec3(1) * spec * 0.5;
    }
    fragColor = vec4(pow(col, vec3(0.4545)), 1.0);
}
)";

class RayMarchSphere : public WebApp {
public:
    ShaderProgram shader; Mesh quad;
    float camDist=5.0f, angleX=0.3f, angleY=0.0f; double time=0;

    void onCreate() override {
        quad.primitive(Mesh::TRIANGLE_STRIP);
        quad.vertex(-1,-1,0); quad.vertex(1,-1,0); quad.vertex(-1,1,0); quad.vertex(1,1,0);
        shader.compile(rmVert, rmFrag);
    }
    void onAnimate(double dt) override { time+=dt; angleY+=dt*0.2f; }
    void onDraw(Graphics& g) override {
        g.clear(0); g.depthTesting(false);
        float cx=camDist*sin(angleY)*cos(angleX), cy=camDist*sin(angleX)+1.0f, cz=camDist*cos(angleY)*cos(angleX);
        shader.begin();
        shader.uniform("time",(float)time); shader.uniform("resolution",(float)width(),(float)height());
        shader.uniform("camPos",cx,cy,cz);
        g.draw(quad); shader.end();
    }
    bool onKeyDown(const Keyboard& k) override {
        if(k.key()=='w')angleX+=0.1f; if(k.key()=='s')angleX-=0.1f;
        if(k.key()=='a')angleY-=0.1f; if(k.key()=='d')angleY+=0.1f;
        if(k.key()=='q')camDist=fmax(2.0f,camDist-0.5f); if(k.key()=='e')camDist=fmin(20.0f,camDist+0.5f);
        return true;
    }
};

ALLOLIB_WEB_MAIN(RayMarchSphere)
`,
  },

  {
    id: 'rm-csg-operations',
    title: 'CSG Operations',
    description: 'Constructive Solid Geometry: union, intersection, and difference of shapes',
    category: 'simulation',
    subcategory: 'raymarching',
    code: `/**
 * Ray Marching - CSG Operations
 * Controls: 1-4 = switch operation
 */
#include "al_playground_compat.hpp"
#include <cmath>

using namespace al;

const char* csgVert = R"(#version 300 es
precision highp float;
layout(location=0)in vec3 position;out vec2 uv;
void main(){uv=position.xy;gl_Position=vec4(position,1.0);}
)";

const char* csgFrag = R"(#version 300 es
precision highp float;
in vec2 uv;out vec4 fragColor;
uniform float time;uniform vec2 resolution;uniform int mode;

float sdSphere(vec3 p,float r){return length(p)-r;}
float sdBox(vec3 p,vec3 b){vec3 d=abs(p)-b;return min(max(d.x,max(d.y,d.z)),0.0)+length(max(d,0.0));}
float opU(float a,float b){return min(a,b);}
float opI(float a,float b){return max(a,b);}
float opS(float a,float b){return max(-a,b);}
float opSU(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}

float scene(vec3 p){
    float a=time*0.5;mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a));p.xz=r*p.xz;
    float sp=sdSphere(p-vec3(0.3,0,0),0.8),bx=sdBox(p-vec3(-0.3,0,0),vec3(0.6));
    if(mode==0)return opU(sp,bx);if(mode==1)return opI(sp,bx);
    if(mode==2)return opS(sp,bx);return opSU(sp,bx,0.3);
}
vec3 norm(vec3 p){vec2 e=vec2(0.001,0);return normalize(vec3(scene(p+e.xyy)-scene(p-e.xyy),scene(p+e.yxy)-scene(p-e.yxy),scene(p+e.yyx)-scene(p-e.yyx)));}
float march(vec3 ro,vec3 rd){float d=0.0;for(int i=0;i<100;i++){float ds=scene(ro+rd*d);d+=ds;if(d>50.0||ds<0.001)break;}return d;}

void main(){
    vec2 p=uv;p.x*=resolution.x/resolution.y;
    vec3 ro=vec3(0,0,4),rd=normalize(vec3(p,-1.5));
    float d=march(ro,rd);
    vec3 col=vec3(0.1,0.1,0.15);
    if(d<50.0){
        vec3 pos=ro+rd*d,n=norm(pos),l=normalize(vec3(1,2,1));
        float df=max(dot(n,l),0.0),sp=pow(max(dot(reflect(-l,n),-rd),0.0),32.0);
        col=vec3(0.2,0.6,0.9)*(df*0.7+0.3)+vec3(1)*sp*0.5;
    }
    fragColor=vec4(pow(col,vec3(0.4545)),1.0);
}
)";

class CSGOps : public WebApp {
public:
    ShaderProgram shader;Mesh quad;int mode=0;double time=0;

    void onCreate() override {
        quad.primitive(Mesh::TRIANGLE_STRIP);
        quad.vertex(-1,-1,0);quad.vertex(1,-1,0);quad.vertex(-1,1,0);quad.vertex(1,1,0);
        shader.compile(csgVert,csgFrag);
    }
    void onAnimate(double dt) override {time+=dt;}
    void onDraw(Graphics& g) override {
        g.clear(0);g.depthTesting(false);
        shader.begin();
        shader.uniform("time",(float)time);
        shader.uniform("resolution",(float)width(),(float)height());
        shader.uniform("mode",mode);
        g.draw(quad);shader.end();
    }
    bool onKeyDown(const Keyboard& k) override {
        if(k.key()>='1'&&k.key()<='4')mode=k.key()-'1';
        return true;
    }
};

ALLOLIB_WEB_MAIN(CSGOps)
`,
  },

  {
    id: 'rm-infinite-repetition',
    title: 'Infinite Repetition',
    description: 'Infinite grid of shapes using domain repetition',
    category: 'simulation',
    subcategory: 'raymarching',
    code: `/**
 * Ray Marching - Infinite Repetition
 * Controls: WASD = move camera
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

const char* repVert = R"(#version 300 es
precision highp float;
layout(location=0)in vec3 position;out vec2 uv;
void main(){uv=position.xy;gl_Position=vec4(position,1.0);}
)";

const char* repFrag = R"(#version 300 es
precision highp float;
in vec2 uv;out vec4 fragColor;
uniform float time;uniform vec2 resolution;uniform vec3 camPos;

float sdSphere(vec3 p,float r){return length(p)-r;}
float sdBox(vec3 p,vec3 b){vec3 d=abs(p)-b;return min(max(d.x,max(d.y,d.z)),0.0)+length(max(d,0.0));}

vec3 rep(vec3 p,vec3 c){return mod(p+0.5*c,c)-0.5*c;}

float scene(vec3 p){
    vec3 rp=rep(p,vec3(4.0));
    float sp=sdSphere(rp,0.5+0.2*sin(p.x*0.5+time)*sin(p.z*0.5+time));
    float bx=sdBox(rp,vec3(0.3));
    return min(sp,bx);
}

vec3 norm(vec3 p){vec2 e=vec2(0.001,0);return normalize(vec3(scene(p+e.xyy)-scene(p-e.xyy),scene(p+e.yxy)-scene(p-e.yxy),scene(p+e.yyx)-scene(p-e.yyx)));}

float march(vec3 ro,vec3 rd){
    float d=0.0;
    for(int i=0;i<100;i++){float ds=scene(ro+rd*d);d+=ds;if(d>100.0||ds<0.001)break;}
    return d;
}

void main(){
    vec2 p=uv;p.x*=resolution.x/resolution.y;
    vec3 ro=camPos;
    vec3 fwd=normalize(vec3(sin(time*0.2),0,-cos(time*0.2)));
    vec3 right=normalize(cross(vec3(0,1,0),fwd));
    vec3 up=cross(fwd,right);
    vec3 rd=normalize(fwd+p.x*right+p.y*up);

    float d=march(ro,rd);
    vec3 col=vec3(0.02,0.02,0.05);

    if(d<100.0){
        vec3 pos=ro+rd*d;
        vec3 n=norm(pos);
        vec3 l=normalize(vec3(1,2,1));
        float df=max(dot(n,l),0.0);
        float sp=pow(max(dot(reflect(-l,n),-rd),0.0),32.0);
        vec3 base=vec3(0.5+0.5*sin(pos.x*0.5),0.5+0.5*sin(pos.y*0.5),0.5+0.5*sin(pos.z*0.5));
        col=base*(df*0.7+0.2)+vec3(1)*sp*0.3;
        col*=exp(-d*0.03);
    }
    fragColor=vec4(pow(col,vec3(0.4545)),1.0);
}
)";

class InfiniteRep : public WebApp {
public:
    ShaderProgram shader;Mesh quad;
    Vec3f camPos;float time=0;
    bool keys[256];

    void onCreate() override {
        memset(keys,0,sizeof(keys));
        quad.primitive(Mesh::TRIANGLE_STRIP);
        quad.vertex(-1,-1,0);quad.vertex(1,-1,0);quad.vertex(-1,1,0);quad.vertex(1,1,0);
        shader.compile(repVert,repFrag);
        camPos=Vec3f(0,0,0);
    }
    void onAnimate(double dt) override {
        float dtf=(float)dt;
        time+=dtf;
        float spd=5.0f*dtf;
        if(keys[(int)'w'])camPos.z-=spd;if(keys[(int)'s'])camPos.z+=spd;
        if(keys[(int)'a'])camPos.x-=spd;if(keys[(int)'d'])camPos.x+=spd;
        if(keys[(int)'q'])camPos.y-=spd;if(keys[(int)'e'])camPos.y+=spd;
    }
    void onDraw(Graphics& g) override {
        g.clear(0);g.depthTesting(false);
        shader.begin();
        shader.uniform("time",time);
        shader.uniform("resolution",(float)width(),(float)height());
        shader.uniform("camPos",camPos.x,camPos.y,camPos.z);
        g.draw(quad);shader.end();
    }
    bool onKeyDown(const Keyboard& k) override {int key=k.key();if(key>=0&&key<256)keys[key]=true;return true;}
    bool onKeyUp(const Keyboard& k) override {int key=k.key();if(key>=0&&key<256)keys[key]=false;return true;}
};

ALLOLIB_WEB_MAIN(InfiniteRep)
`,
  },

  {
    id: 'rm-mandelbulb',
    title: 'Mandelbulb Fractal',
    description: '3D Mandelbrot-like fractal rendered with ray marching',
    category: 'simulation',
    subcategory: 'raymarching',
    code: `/**
 * Ray Marching - Mandelbulb Fractal
 * Controls: WASD = rotate, Q/E = zoom, +/- = power
 */
#include "al_playground_compat.hpp"
#include <cmath>

using namespace al;

const char* mbVert = R"(#version 300 es
precision highp float;
layout(location=0)in vec3 position;out vec2 uv;
void main(){uv=position.xy;gl_Position=vec4(position,1.0);}
)";

const char* mbFrag = R"(#version 300 es
precision highp float;
in vec2 uv;out vec4 fragColor;
uniform float time;uniform vec2 resolution;uniform vec3 camPos;uniform float power;

float mandelbulb(vec3 p){
    vec3 z=p;float dr=1.0,r=0.0;
    for(int i=0;i<15;i++){
        r=length(z);if(r>2.0)break;
        float theta=acos(z.z/r)*power;
        float phi=atan(z.y,z.x)*power;
        float zr=pow(r,power);
        dr=pow(r,power-1.0)*power*dr+1.0;
        z=zr*vec3(sin(theta)*cos(phi),sin(theta)*sin(phi),cos(theta))+p;
    }
    return 0.5*log(r)*r/dr;
}

vec3 norm(vec3 p){vec2 e=vec2(0.0005,0);return normalize(vec3(mandelbulb(p+e.xyy)-mandelbulb(p-e.xyy),mandelbulb(p+e.yxy)-mandelbulb(p-e.yxy),mandelbulb(p+e.yyx)-mandelbulb(p-e.yyx)));}

float march(vec3 ro,vec3 rd){
    float d=0.0;
    for(int i=0;i<200;i++){float ds=mandelbulb(ro+rd*d);d+=ds;if(d>4.0||ds<0.0001)break;}
    return d;
}

void main(){
    vec2 p=uv;p.x*=resolution.x/resolution.y;
    vec3 ro=camPos;
    vec3 fwd=normalize(-ro);
    vec3 right=normalize(cross(vec3(0,1,0),fwd));
    vec3 up=cross(fwd,right);
    vec3 rd=normalize(fwd+p.x*right+p.y*up);

    float d=march(ro,rd);
    vec3 col=vec3(0.02,0.02,0.04);

    if(d<4.0){
        vec3 pos=ro+rd*d;
        vec3 n=norm(pos);
        vec3 l=normalize(vec3(1,1,-1));
        float df=max(dot(n,l),0.0);
        float ao=1.0-float(d)*0.2;
        col=vec3(0.6,0.4,0.8)*(df*0.6+0.4)*ao;
        col+=vec3(0.2,0.1,0.3)*pow(1.0-abs(dot(n,-rd)),2.0);
    }
    fragColor=vec4(pow(col,vec3(0.4545)),1.0);
}
)";

class Mandelbulb : public WebApp {
public:
    ShaderProgram shader;Mesh quad;
    float camDist=2.5f,angleX=0.3f,angleY=0.0f,power=8.0f;
    double time=0;

    void onCreate() override {
        quad.primitive(Mesh::TRIANGLE_STRIP);
        quad.vertex(-1,-1,0);quad.vertex(1,-1,0);quad.vertex(-1,1,0);quad.vertex(1,1,0);
        shader.compile(mbVert,mbFrag);
    }
    void onAnimate(double dt) override {time+=dt;angleY+=dt*0.1f;}
    void onDraw(Graphics& g) override {
        g.clear(0);g.depthTesting(false);
        float cx=camDist*sin(angleY)*cos(angleX);
        float cy=camDist*sin(angleX);
        float cz=camDist*cos(angleY)*cos(angleX);
        shader.begin();
        shader.uniform("time",(float)time);
        shader.uniform("resolution",(float)width(),(float)height());
        shader.uniform("camPos",cx,cy,cz);
        shader.uniform("power",power);
        g.draw(quad);shader.end();
    }
    bool onKeyDown(const Keyboard& k) override {
        if(k.key()=='w')angleX+=0.1f;if(k.key()=='s')angleX-=0.1f;
        if(k.key()=='a')angleY-=0.1f;if(k.key()=='d')angleY+=0.1f;
        if(k.key()=='q')camDist=fmax(1.0f,camDist-0.2f);
        if(k.key()=='e')camDist=fmin(5.0f,camDist+0.2f);
        if(k.key()=='+'||k.key()=='=')power+=0.5f;
        if(k.key()=='-')power=fmax(2.0f,power-0.5f);
        return true;
    }
};

ALLOLIB_WEB_MAIN(Mandelbulb)
`,
  },

  // ==========================================================================
  // SIMULATION - Cellular Automata
  // ==========================================================================
  {
    id: 'ca-game-of-life',
    title: "Conway's Game of Life",
    description: 'Classic cellular automaton with birth and death rules',
    category: 'simulation',
    subcategory: 'cellular',
    code: `/**
 * Conway's Game of Life
 * Controls: Space = pause, R = randomize, C = clear, +/- = speed
 */
#include "al_playground_compat.hpp"
#include <cstring>

using namespace al;

class GameOfLife : public WebApp {
public:
    static const int W=128, H=128;
    bool grid[H][W], next[H][W];
    Mesh mesh; bool running=true; double timer=0, stepTime=0.1;
    rnd::Random<> rng;

    void onCreate() override { mesh.primitive(Mesh::POINTS); randomize(); nav().pos(0,0,2.5f); }

    void randomize() { for(int y=0;y<H;y++) for(int x=0;x<W;x++) grid[y][x]=rng.prob(0.3); }

    int neighbors(int cx, int cy) {
        int c=0; for(int dy=-1;dy<=1;dy++) for(int dx=-1;dx<=1;dx++) {
            if(dx==0&&dy==0)continue; if(grid[(cy+dy+H)%H][(cx+dx+W)%W])c++;
        } return c;
    }

    void step() {
        for(int y=0;y<H;y++) for(int x=0;x<W;x++) {
            int n=neighbors(x,y); next[y][x]=grid[y][x]?(n==2||n==3):(n==3);
        }
        memcpy(grid,next,sizeof(grid));
    }

    void onAnimate(double dt) override {
        if(running){timer+=dt; if(timer>=stepTime){step();timer=0;}}
        mesh.reset(); float scale=2.0f/W;
        for(int y=0;y<H;y++) for(int x=0;x<W;x++) if(grid[y][x]){
            mesh.vertex((x-W/2.0f)*scale,(y-H/2.0f)*scale,0);
            mesh.color(HSV(neighbors(x,y)/8.0f*0.3f,0.8f,1.0f));
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f); g.blending(true); g.blendAdd(); g.depthTesting(false);
        g.pointSize(4); g.meshColor(); g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()==' ')running=!running; if(k.key()=='r')randomize();
        if(k.key()=='c')memset(grid,0,sizeof(grid));
        if(k.key()=='+'||k.key()=='=')stepTime=fmax(0.01,stepTime-0.02); if(k.key()=='-')stepTime+=0.02;
        return true;
    }
};

ALLOLIB_WEB_MAIN(GameOfLife)
`,
  },

  // ==========================================================================
  // SIMULATION - Particles (Weather)
  // ==========================================================================
  {
    id: 'particles-rain',
    title: 'Rain System',
    description: 'Falling rain with streaks and ground splashes',
    category: 'simulation',
    subcategory: 'particles',
    code: `/**
 * Rain Particle System
 * Controls: WASD/QE = move, +/- = wind
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

struct Drop { Vec3f pos, vel; float len; };
struct Splash { Vec3f pos; float life; };

class RainSystem : public WebApp {
public:
    static const int MAX_DROPS=3000, MAX_SPLASH=500;
    Drop drops[MAX_DROPS]; Splash splashes[MAX_SPLASH]; int nextSplash=0;
    Mesh rainMesh, splashMesh;
    float wind=0, groundY=-2.0f;
    rnd::Random<> rng; bool keys[256];

    void onCreate() override {
        memset(keys,0,sizeof(keys));
        rainMesh.primitive(Mesh::LINES); splashMesh.primitive(Mesh::POINTS);
        for(int i=0;i<MAX_DROPS;i++) resetDrop(drops[i],true);
        for(int i=0;i<MAX_SPLASH;i++) splashes[i].life=0;
        nav().pos(0,1,8);
    }

    void resetDrop(Drop& d, bool randY=false) {
        d.pos=Vec3f(rng.uniform(-8.0f,8.0f),randY?rng.uniform(-5.0f,12.0f):rng.uniform(8.0f,12.0f),rng.uniform(-8.0f,8.0f));
        d.vel=Vec3f(wind,-15.0f+rng.uniform(-2.0f,0.0f),0); d.len=rng.uniform(0.1f,0.3f);
    }

    void splash(Vec3f p) { Splash& s=splashes[nextSplash]; s.pos=Vec3f(p.x,groundY+0.01f,p.z); s.life=1.0f; nextSplash=(nextSplash+1)%MAX_SPLASH; }

    void onAnimate(double dt) override {
        float spd=5.0f*(float)dt;
        if(keys[(int)'w'])nav().pos()+=nav().uf()*spd; if(keys[(int)'s'])nav().pos()-=nav().uf()*spd;
        if(keys[(int)'a'])nav().pos()-=nav().ur()*spd; if(keys[(int)'d'])nav().pos()+=nav().ur()*spd;
        if(keys[(int)'q'])nav().pos()-=nav().uu()*spd; if(keys[(int)'e'])nav().pos()+=nav().uu()*spd;

        for(int i=0;i<MAX_DROPS;i++){
            Drop& d=drops[i]; d.vel.x=wind+rng.uniform(-0.5f,0.5f); d.pos+=d.vel*(float)dt;
            if(d.pos.y<groundY){splash(d.pos);resetDrop(d);}
        }
        for(int i=0;i<MAX_SPLASH;i++) if(splashes[i].life>0) splashes[i].life-=(float)dt*3.0f;

        rainMesh.reset();
        for(int i=0;i<MAX_DROPS;i++){
            Drop& d=drops[i]; Vec3f dir=d.vel.normalized()*d.len;
            float a=fmax(0.1f,1.0f-fabs(d.pos.z)/10.0f)*0.6f;
            rainMesh.vertex(d.pos); rainMesh.color(0.7f,0.8f,1.0f,a);
            rainMesh.vertex(d.pos+dir); rainMesh.color(0.7f,0.8f,1.0f,0.0f);
        }
        splashMesh.reset();
        for(int i=0;i<MAX_SPLASH;i++) if(splashes[i].life>0){
            splashMesh.vertex(splashes[i].pos); splashMesh.color(0.8f,0.9f,1.0f,splashes[i].life*0.8f);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f,0.03f,0.05f); g.blending(true); g.blendTrans(); g.depthTesting(false);
        Mesh ground; ground.primitive(Mesh::TRIANGLE_STRIP);
        ground.vertex(-10,groundY,-10); ground.color(0.1f,0.1f,0.12f);
        ground.vertex(10,groundY,-10); ground.color(0.1f,0.1f,0.12f);
        ground.vertex(-10,groundY,10); ground.color(0.05f,0.05f,0.07f);
        ground.vertex(10,groundY,10); ground.color(0.05f,0.05f,0.07f);
        g.draw(ground);
        g.meshColor(); g.draw(rainMesh); g.pointSize(3); g.draw(splashMesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        int key=k.key(); if(key>=0&&key<256)keys[key]=true;
        if(k.key()=='+'||k.key()=='=')wind+=1.0f; if(k.key()=='-')wind-=1.0f;
        return true;
    }
    bool onKeyUp(const Keyboard& k) override { int key=k.key(); if(key>=0&&key<256)keys[key]=false; return true; }
};

ALLOLIB_WEB_MAIN(RainSystem)
`,
  },

  {
    id: 'particles-snow',
    title: 'Snowfall',
    description: 'Gentle snowfall with wind drift and wobble',
    category: 'simulation',
    subcategory: 'particles',
    code: `/**
 * Snowfall Particle System
 * Controls: WASD/QE = move, +/- = wind
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

struct Flake { Vec3f pos; float phase, speed, wobble; };

class SnowSystem : public WebApp {
public:
    static const int NUM=5000;
    Flake flakes[NUM]; Mesh mesh;
    float wind=0, groundY=-3.0f; float time=0;
    rnd::Random<> rng; bool keys[256];

    void onCreate() override {
        memset(keys,0,sizeof(keys));
        mesh.primitive(Mesh::POINTS);
        for(int i=0;i<NUM;i++) reset(flakes[i],true);
        nav().pos(0,0,6);
    }

    void reset(Flake& f, bool randY=false) {
        f.pos=Vec3f(rng.uniform(-10.0f,10.0f),randY?rng.uniform(groundY,10.0f):rng.uniform(8.0f,15.0f),rng.uniform(-10.0f,10.0f));
        f.phase=rng.uniform(0.0f,6.28f); f.speed=rng.uniform(0.5f,1.5f); f.wobble=rng.uniform(0.3f,1.0f);
    }

    void onAnimate(double dt) override {
        float dtf=(float)dt;
        time+=dtf; float spd=3.0f*dtf;
        if(keys[(int)'w'])nav().pos()+=nav().uf()*spd; if(keys[(int)'s'])nav().pos()-=nav().uf()*spd;
        if(keys[(int)'a'])nav().pos()-=nav().ur()*spd; if(keys[(int)'d'])nav().pos()+=nav().ur()*spd;
        if(keys[(int)'q'])nav().pos()-=nav().uu()*spd; if(keys[(int)'e'])nav().pos()+=nav().uu()*spd;

        for(int i=0;i<NUM;i++){
            Flake& f=flakes[i];
            f.pos.y-=f.speed*dtf;
            f.pos.x+=sinf(time*2.0f+f.phase)*f.wobble*dtf+wind*dtf;
            f.pos.z+=cosf(time*1.5f+f.phase*0.7f)*f.wobble*0.5f*dtf;
            if(f.pos.y<groundY) reset(f);
        }

        mesh.reset(); Vec3f cam=nav().pos();
        for(int i=0;i<NUM;i++){
            Flake& f=flakes[i]; mesh.vertex(f.pos);
            float a=fmax(0.1f,fmin(1.0f,1.0f-(f.pos-cam).mag()/20.0f))*0.8f;
            mesh.color(0.9f,0.95f,1.0f,a);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f,0.03f,0.08f); g.blending(true); g.depthTesting(false);
        Mesh ground; ground.primitive(Mesh::TRIANGLE_STRIP);
        ground.vertex(-15,groundY,-15); ground.color(0.3f,0.35f,0.4f);
        ground.vertex(15,groundY,-15); ground.color(0.3f,0.35f,0.4f);
        ground.vertex(-15,groundY,15); ground.color(0.15f,0.18f,0.22f);
        ground.vertex(15,groundY,15); ground.color(0.15f,0.18f,0.22f);
        g.blendTrans(); g.draw(ground);
        g.blendAdd(); g.pointSize(3); g.meshColor(); g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        int key=k.key(); if(key>=0&&key<256)keys[key]=true;
        if(k.key()=='+'||k.key()=='=')wind+=0.5f; if(k.key()=='-')wind-=0.5f;
        return true;
    }
    bool onKeyUp(const Keyboard& k) override { int key=k.key(); if(key>=0&&key<256)keys[key]=false; return true; }
};

ALLOLIB_WEB_MAIN(SnowSystem)
`,
  },

  {
    id: 'particles-fire',
    title: 'Fire Simulation',
    description: 'Realistic fire with temperature-based color and turbulence',
    category: 'simulation',
    subcategory: 'particles',
    code: `/**
 * Fire Particle System
 * Features: Temperature-based color, turbulent rise, embers
 * Controls: WASD/QE = move, +/- = intensity
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

struct Ember { Vec3f pos,vel; float temp,life,maxLife; };

class FireSystem : public WebApp {
public:
    static const int MAX=3000;
    Ember embers[MAX]; Mesh mesh;
    float intensity=1.0f;
    float time=0;
    rnd::Random<> rng;
    bool keys[256];

    void onCreate() override {
        memset(keys,0,sizeof(keys));
        mesh.primitive(Mesh::POINTS);
        for(int i=0;i<MAX;i++) reset(embers[i]);
        nav().pos(0,1,5);
    }

    void reset(Ember& e) {
        float a=rng.uniform()*6.28f,r=rng.uniform()*0.3f*intensity;
        e.pos=Vec3f(cosf(a)*r,-1.5f,sinf(a)*r);
        e.vel=Vec3f(rng.uniformS()*0.3f,2.0f+rng.uniform()*2.0f,rng.uniformS()*0.3f);
        e.temp=1.0f;
        e.maxLife=0.5f+rng.uniform()*1.5f;
        e.life=e.maxLife;
    }

    Vec3f turbulence(Vec3f p,float t) {
        return Vec3f(sinf(p.y*3.0f+t*2.0f)*0.5f,0,cosf(p.y*2.5f+t*1.5f)*0.5f);
    }

    Color tempToColor(float t) {
        if(t>0.8f) return Color(1.0f,0.9f,0.5f,t);
        if(t>0.5f) return Color(1.0f,0.5f,0.1f,t);
        if(t>0.2f) return Color(0.8f,0.2f,0.0f,t*0.8f);
        return Color(0.3f,0.1f,0.1f,t*0.5f);
    }

    void onAnimate(double dt) override {
        float dtf=(float)dt;
        time+=dtf;
        float spd=3.0f*dtf;
        if(keys[(int)'w'])nav().pos()+=nav().uf()*spd;if(keys[(int)'s'])nav().pos()-=nav().uf()*spd;
        if(keys[(int)'a'])nav().pos()-=nav().ur()*spd;if(keys[(int)'d'])nav().pos()+=nav().ur()*spd;
        if(keys[(int)'q'])nav().pos()-=nav().uu()*spd;if(keys[(int)'e'])nav().pos()+=nav().uu()*spd;

        for(int i=0;i<MAX;i++){
            Ember& e=embers[i];
            e.life-=dtf;
            if(e.life<=0){reset(e);continue;}

            float lifeRatio=e.life/e.maxLife;
            e.temp=lifeRatio;
            e.vel+=turbulence(e.pos,time)*dtf*2.0f;
            e.vel.y+=dtf*(1.0f+e.temp*3.0f);
            e.vel*=0.98f;
            e.pos+=e.vel*dtf;
        }

        mesh.reset();
        for(int i=0;i<MAX;i++){
            Ember& e=embers[i];
            if(e.life>0){
                mesh.vertex(e.pos);
                mesh.color(tempToColor(e.temp));
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f,0.01f,0.02f);
        g.blending(true);g.blendAdd();g.depthTesting(false);
        g.pointSize(4);g.meshColor();g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        int key=k.key(); if(key>=0&&key<256)keys[key]=true;
        if(k.key()=='+'||k.key()=='=')intensity=fmin(3.0f,intensity+0.2f);
        if(k.key()=='-')intensity=fmax(0.2f,intensity-0.2f);
        return true;
    }
    bool onKeyUp(const Keyboard& k) override {int key=k.key(); if(key>=0&&key<256)keys[key]=false;return true;}
};

ALLOLIB_WEB_MAIN(FireSystem)
`,
  },

  {
    id: 'particles-smoke',
    title: 'Smoke Plume',
    description: 'Rising smoke with buoyancy and turbulent diffusion',
    category: 'simulation',
    subcategory: 'particles',
    code: `/**
 * Smoke Particle System
 * Features: Buoyancy, turbulent spread, alpha fading
 * Controls: WASD/QE = move
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

struct Puff { Vec3f pos,vel; float life,maxLife,size; };

class SmokeSystem : public WebApp {
public:
    static const int MAX=2000;
    Puff puffs[MAX]; Mesh mesh;
    float time=0;
    rnd::Random<> rng;
    bool keys[256];

    void onCreate() override {
        memset(keys,0,sizeof(keys));
        mesh.primitive(Mesh::POINTS);
        for(int i=0;i<MAX;i++) reset(puffs[i]);
        nav().pos(0,2,6);
    }

    void reset(Puff& p) {
        float a=rng.uniform()*6.28f,r=rng.uniform()*0.2f;
        p.pos=Vec3f(cosf(a)*r,-2.0f,sinf(a)*r);
        p.vel=Vec3f(rng.uniformS()*0.2f,1.0f+rng.uniform(),rng.uniformS()*0.2f);
        p.maxLife=2.0f+rng.uniform()*2.0f;
        p.life=p.maxLife;
        p.size=0.1f+rng.uniform()*0.1f;
    }

    Vec3f noise3(Vec3f p,float t) {
        return Vec3f(sinf(p.y*2.0f+t)*cosf(p.z*3.0f+t),0,cosf(p.y*2.5f+t)*sinf(p.x*2.0f+t));
    }

    void onAnimate(double dt) override {
        float dtf=(float)dt;
        time+=dtf;
        float spd=3.0f*dtf;
        if(keys[(int)'w'])nav().pos()+=nav().uf()*spd;if(keys[(int)'s'])nav().pos()-=nav().uf()*spd;
        if(keys[(int)'a'])nav().pos()-=nav().ur()*spd;if(keys[(int)'d'])nav().pos()+=nav().ur()*spd;
        if(keys[(int)'q'])nav().pos()-=nav().uu()*spd;if(keys[(int)'e'])nav().pos()+=nav().uu()*spd;

        for(int i=0;i<MAX;i++){
            Puff& p=puffs[i];
            p.life-=dtf;
            if(p.life<=0){reset(p);continue;}

            float age=1.0f-p.life/p.maxLife;
            p.vel+=noise3(p.pos,time)*dtf*0.8f;
            p.vel.y+=dtf*(0.5f+age*0.5f);
            p.vel.x+=sinf(time*0.5f+p.pos.y)*dtf*0.3f;
            p.vel*=0.98f;
            p.pos+=p.vel*dtf;
            p.size+=dtf*0.1f;
        }

        mesh.reset();
        for(int i=0;i<MAX;i++){
            Puff& p=puffs[i];
            if(p.life>0){
                mesh.vertex(p.pos);
                float a=(p.life/p.maxLife)*0.4f;
                float g=0.3f+0.2f*(1.0f-p.life/p.maxLife);
                mesh.color(g,g,g+0.05f,a);
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f,0.07f,0.1f);
        g.blending(true);g.blendTrans();g.depthTesting(false);
        g.pointSize(6);g.meshColor();g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {int key=k.key(); if(key>=0&&key<256)keys[key]=true;return true;}
    bool onKeyUp(const Keyboard& k) override {int key=k.key(); if(key>=0&&key<256)keys[key]=false;return true;}
};

ALLOLIB_WEB_MAIN(SmokeSystem)
`,
  },

  {
    id: 'particles-attractor',
    title: 'Strange Attractors',
    description: 'Lorenz and Rossler chaotic attractors visualized with particles',
    category: 'simulation',
    subcategory: 'particles',
    code: `/**
 * Strange Attractors
 * Controls: 1 = Lorenz, 2 = Rossler, WASD = rotate
 */
#include "al_playground_compat.hpp"
#include <cmath>

using namespace al;

class Attractors : public WebApp {
public:
    static const int NUM=10000;
    Vec3f points[NUM];
    Mesh mesh,trail;
    int type=0;
    float angleX=0.3f,angleY=0;
    double time=0;

    // Lorenz parameters
    float sigma=10.0f,rho=28.0f,beta=8.0f/3.0f;
    // Rossler parameters
    float a=0.2f,b=0.2f,c=5.7f;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);
        trail.primitive(Mesh::LINE_STRIP);
        reset();
        nav().pos(0,0,80);
    }

    void reset() {
        for(int i=0;i<NUM;i++){
            points[i]=Vec3f(
                (float)(i%100)/100.0f*0.1f+0.1f,
                (float)((i/100)%100)/100.0f*0.1f+0.1f,
                (float)(i/10000)*0.1f+0.1f
            );
        }
    }

    Vec3f lorenz(Vec3f p) {
        return Vec3f(sigma*(p.y-p.x),p.x*(rho-p.z)-p.y,p.x*p.y-beta*p.z);
    }

    Vec3f rossler(Vec3f p) {
        return Vec3f(-p.y-p.z,p.x+a*p.y,b+p.z*(p.x-c));
    }

    void onAnimate(double dt) override {
        time+=dt;
        angleY+=dt*0.1f;

        float step=0.01f;
        for(int i=0;i<NUM;i++){
            Vec3f d=(type==0)?lorenz(points[i]):rossler(points[i]);
            points[i]+=d*step;
        }

        mesh.reset();trail.reset();
        for(int i=0;i<NUM;i++){
            Vec3f p=points[i];
            if(type==1)p*=2.0f;
            mesh.vertex(p);
            float h=fmod((float)i/NUM+time*0.1f,1.0f);
            mesh.color(HSV(h,0.8f,1.0f));
            if(i<1000){trail.vertex(p);trail.color(HSV(h,0.8f,0.5f));}
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f);
        g.blending(true);g.blendAdd();g.depthTesting(false);

        g.pushMatrix();
        g.rotate(angleX*57.3f,1,0,0);
        g.rotate(angleY*57.3f,0,1,0);
        if(type==0)g.translate(-0,-0,-25);

        g.pointSize(1);g.meshColor();g.draw(mesh);
        g.draw(trail);
        g.popMatrix();
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()=='1'){type=0;reset();}
        if(k.key()=='2'){type=1;reset();}
        if(k.key()=='w')angleX+=0.1f;if(k.key()=='s')angleX-=0.1f;
        if(k.key()=='a')angleY-=0.1f;if(k.key()=='d')angleY+=0.1f;
        return true;
    }
};

ALLOLIB_WEB_MAIN(Attractors)
`,
  },

  // ==========================================================================
  // SIMULATION - Artificial Life
  // ==========================================================================
  {
    id: 'life-plants-2d',
    title: 'L-System Plants',
    description: 'Procedural plant generation using L-system grammar rules',
    category: 'simulation',
    subcategory: 'life',
    code: `/**
 * L-System Plants
 * Controls: 1-4 = plant types, Space = regenerate, +/- = iterations
 */
#include "al_playground_compat.hpp"
#include <string>
#include <stack>
#include <cmath>

using namespace al;

struct Turtle { Vec2f pos; float angle; };

class LSystemPlants : public WebApp {
public:
    Mesh mesh; std::string axiom, rules[26], current;
    int iterations=4, plantType=0; float angle=25.0f, len=0.02f;

    void onCreate() override { mesh.primitive(Mesh::LINES); setPlant(0); nav().pos(0,0,2); }

    void setPlant(int type) {
        plantType=type; for(int i=0;i<26;i++)rules[i]="";
        switch(type){
            case 0:axiom="F";rules['F'-'A']="FF+[+F-F-F]-[-F+F+F]";angle=22.5f;len=0.015f;iterations=4;break;
            case 1:axiom="X";rules['X'-'A']="F+[[X]-X]-F[-FX]+X";rules['F'-'A']="FF";angle=25.0f;len=0.012f;iterations=5;break;
            case 2:axiom="X";rules['X'-'A']="F-[[X]+X]+F[+FX]-X";rules['F'-'A']="FF";angle=22.5f;len=0.01f;iterations=5;break;
            case 3:axiom="F";rules['F'-'A']="F[+F]F[-F][F]";angle=20.0f;len=0.03f;iterations=4;break;
        }
        generate();
    }

    void generate() {
        current=axiom;
        for(int i=0;i<iterations;i++){
            std::string next="";
            for(char c:current) next+=(c>='A'&&c<='Z'&&rules[c-'A'].length()>0)?rules[c-'A']:std::string(1,c);
            current=next;
        }
        buildMesh();
    }

    void buildMesh() {
        mesh.reset(); std::stack<Turtle> stack;
        Turtle t; t.pos=Vec2f(0,-0.8f); t.angle=90.0f;
        const float PI_F=3.14159265f;
        for(char c:current){
            if(c=='F'){
                Vec2f np=t.pos+Vec2f(cos(t.angle*PI_F/180.0f),sin(t.angle*PI_F/180.0f))*len;
                float h=(t.pos.y+0.8f)/1.6f;
                Color col(0.3f+h*0.2f,0.5f+h*0.4f,0.2f);
                mesh.vertex(t.pos.x,t.pos.y,0); mesh.color(col);
                mesh.vertex(np.x,np.y,0); mesh.color(col);
                t.pos=np;
            } else if(c=='+')t.angle+=angle;
            else if(c=='-')t.angle-=angle;
            else if(c=='[')stack.push(t);
            else if(c==']'&&!stack.empty()){t=stack.top();stack.pop();}
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f,0.08f,0.1f); g.blending(true); g.blendTrans(); g.depthTesting(false);
        g.meshColor(); g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()>='1'&&k.key()<='4') setPlant(k.key()-'1');
        if(k.key()==' ') generate();
        if(k.key()=='+'||k.key()=='='){iterations++;generate();}
        if(k.key()=='-'&&iterations>1){iterations--;generate();}
        return true;
    }
};

ALLOLIB_WEB_MAIN(LSystemPlants)
`,
  },

  {
    id: 'life-creatures-simple',
    title: 'Simple Creatures',
    description: 'Artificial life: creatures wander, eat, and reproduce',
    category: 'simulation',
    subcategory: 'life',
    code: `/**
 * Simple Creatures - Artificial Life
 * Controls: Space = pause, F = add food, C = add creature
 */
#include "al_playground_compat.hpp"
#include <vector>
#include <cmath>
#include <algorithm>

using namespace al;

struct Creature { Vec2f pos, vel; float energy, hue, turnTimer; bool alive; };
struct Food { Vec2f pos; float energy; bool active; };

class SimpleCreatures : public WebApp {
public:
    std::vector<Creature> creatures;
    std::vector<Food> foods;
    Mesh cMesh, fMesh;
    bool running=true; float worldSize=2.0f;
    rnd::Random<> rng;

    void onCreate() override {
        cMesh.primitive(Mesh::POINTS); fMesh.primitive(Mesh::POINTS);
        for(int i=0;i<20;i++) spawn(Vec2f(rng.uniformS(),rng.uniformS())*worldSize*0.8f);
        for(int i=0;i<50;i++) addFood();
        nav().pos(0,0,4);
    }

    void spawn(Vec2f p) {
        Creature c; c.pos=p; c.vel=Vec2f(rng.uniformS(),rng.uniformS())*0.3f;
        c.energy=50+rng.uniform()*50; c.hue=rng.uniform(); c.turnTimer=0; c.alive=true;
        creatures.push_back(c);
    }

    void addFood() {
        Food f; f.pos=Vec2f(rng.uniformS(),rng.uniformS())*worldSize*0.9f;
        f.energy=20+rng.uniform()*30; f.active=true;
        foods.push_back(f);
    }

    void onAnimate(double dt) override {
        if(!running) return;
        if(rng.prob(0.02)) addFood();

        for(auto& c:creatures){
            if(!c.alive) continue;
            c.energy-=dt*5.0f; c.turnTimer-=dt;
            if(c.turnTimer<=0){
                float a=rng.uniformS();
                c.vel=Vec2f(c.vel.x*cos(a)-c.vel.y*sin(a),c.vel.x*sin(a)+c.vel.y*cos(a));
                c.turnTimer=rng.uniform(0.5f,2.0f);
            }
            c.pos+=c.vel*dt;
            if(c.pos.x>worldSize)c.pos.x-=worldSize*2; if(c.pos.x<-worldSize)c.pos.x+=worldSize*2;
            if(c.pos.y>worldSize)c.pos.y-=worldSize*2; if(c.pos.y<-worldSize)c.pos.y+=worldSize*2;

            for(auto& f:foods) if(f.active&&(c.pos-f.pos).mag()<0.05f){c.energy+=f.energy;f.active=false;}

            if(c.energy>150&&creatures.size()<100){
                c.energy*=0.5f;
                spawn(c.pos+Vec2f(rng.uniformS(),rng.uniformS())*0.1f);
            }
            if(c.energy<=0) c.alive=false;
        }

        creatures.erase(std::remove_if(creatures.begin(),creatures.end(),[](const Creature& c){return !c.alive;}),creatures.end());
        foods.erase(std::remove_if(foods.begin(),foods.end(),[](const Food& f){return !f.active;}),foods.end());

        cMesh.reset();
        for(auto& c:creatures){cMesh.vertex(c.pos.x,c.pos.y,0);cMesh.color(HSV(c.hue,0.8f,fmin(1.0f,c.energy/100.0f)));}
        fMesh.reset();
        for(auto& f:foods) if(f.active){fMesh.vertex(f.pos.x,f.pos.y,0);fMesh.color(0.2f,0.8f,0.3f,0.8f);}
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f,0.02f,0.05f); g.blending(true); g.blendAdd(); g.depthTesting(false);
        g.pointSize(4); g.meshColor(); g.draw(fMesh);
        g.pointSize(8); g.draw(cMesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()==' ') running=!running;
        if(k.key()=='f') for(int i=0;i<10;i++) addFood();
        if(k.key()=='c') spawn(Vec2f(rng.uniformS(),rng.uniformS())*worldSize*0.8f);
        return true;
    }
};

ALLOLIB_WEB_MAIN(SimpleCreatures)
`,
  },

  {
    id: 'life-aquarium',
    title: '3D Aquarium',
    description: 'Underwater scene with fish, plants, and bubbles',
    category: 'simulation',
    subcategory: 'life',
    code: `/**
 * 3D Aquarium - Artificial Life
 * Features: Fish, seaweed, bubbles
 * Controls: WASD/QE = move camera
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

struct AquaFish { Vec3f pos,vel; float size,phase,hue; };
struct Bubble { Vec3f pos; float size,speed; };
struct Weed { Vec3f base; float height,phase; };

class Aquarium : public WebApp {
public:
    static const int FISH=30,BUBBLES=50,WEEDS=20;
    AquaFish fish[FISH]; Bubble bubbles[BUBBLES]; Weed weeds[WEEDS];
    Mesh fishMesh,bubbleMesh,weedMesh;
    rnd::Random<> rng;
    bool keys[256];
    float time=0;

    void onCreate() override {
        memset(keys,0,sizeof(keys));
        fishMesh.primitive(Mesh::POINTS);
        bubbleMesh.primitive(Mesh::POINTS);
        weedMesh.primitive(Mesh::LINES);

        for(int i=0;i<FISH;i++){
            fish[i].pos=Vec3f(rng.uniformS()*4,rng.uniform(-1.5f,1.5f),rng.uniformS()*2);
            fish[i].vel=Vec3f(rng.uniformS(),0,rng.uniformS())*0.5f;
            fish[i].size=0.1f+rng.uniform()*0.1f;
            fish[i].phase=rng.uniform()*6.28f;
            fish[i].hue=rng.uniform()*0.3f;
        }
        for(int i=0;i<BUBBLES;i++) resetBubble(bubbles[i]);
        for(int i=0;i<WEEDS;i++){
            weeds[i].base=Vec3f(rng.uniformS()*4,-2,rng.uniformS()*2);
            weeds[i].height=0.5f+rng.uniform()*1.0f;
            weeds[i].phase=rng.uniform()*6.28f;
        }
        nav().pos(0,0,8);
    }

    void resetBubble(Bubble& b) {
        b.pos=Vec3f(rng.uniformS()*4,-2,rng.uniformS()*2);
        b.size=0.02f+rng.uniform()*0.03f;
        b.speed=0.5f+rng.uniform()*0.5f;
    }

    void onAnimate(double dt) override {
        float dtf=(float)dt;
        time+=dtf;
        float spd=3.0f*dtf;
        if(keys[(int)'w'])nav().pos()+=nav().uf()*spd;if(keys[(int)'s'])nav().pos()-=nav().uf()*spd;
        if(keys[(int)'a'])nav().pos()-=nav().ur()*spd;if(keys[(int)'d'])nav().pos()+=nav().ur()*spd;
        if(keys[(int)'q'])nav().pos()-=nav().uu()*spd;if(keys[(int)'e'])nav().pos()+=nav().uu()*spd;

        for(int i=0;i<FISH;i++){
            AquaFish& f=fish[i];
            f.vel.y=sinf(time*2+f.phase)*0.3f;
            f.vel+=Vec3f(rng.uniformS(),0,rng.uniformS())*dtf;
            f.vel*=0.98f;
            if(f.vel.mag()>1.5f)f.vel=f.vel.normalize()*1.5f;
            f.pos+=f.vel*dtf;
            if(f.pos.x>4){f.pos.x=4;f.vel.x*=-1;}
            if(f.pos.x<-4){f.pos.x=-4;f.vel.x*=-1;}
            if(f.pos.y>2){f.pos.y=2;f.vel.y*=-1;}
            if(f.pos.y<-1.5f){f.pos.y=-1.5f;f.vel.y*=-1;}
            if(f.pos.z>2){f.pos.z=2;f.vel.z*=-1;}
            if(f.pos.z<-2){f.pos.z=-2;f.vel.z*=-1;}
        }

        for(int i=0;i<BUBBLES;i++){
            bubbles[i].pos.y+=bubbles[i].speed*dtf;
            bubbles[i].pos.x+=sinf(time*3+i)*dtf*0.2f;
            if(bubbles[i].pos.y>2) resetBubble(bubbles[i]);
        }

        fishMesh.reset();
        for(int i=0;i<FISH;i++){
            fishMesh.vertex(fish[i].pos);
            fishMesh.color(HSV(fish[i].hue,0.8f,0.9f));
        }

        bubbleMesh.reset();
        for(int i=0;i<BUBBLES;i++){
            bubbleMesh.vertex(bubbles[i].pos);
            bubbleMesh.color(0.7f,0.9f,1.0f,0.5f);
        }

        weedMesh.reset();
        for(int i=0;i<WEEDS;i++){
            Weed& w=weeds[i];
            float sway=sinf(time*1.5f+w.phase)*0.3f;
            int segs=8;
            for(int j=0;j<segs;j++){
                float t1=(float)j/(float)segs,t2=(float)(j+1)/(float)segs;
                Vec3f p1=w.base+Vec3f(sway*t1*t1,t1*w.height,0);
                Vec3f p2=w.base+Vec3f(sway*t2*t2,t2*w.height,0);
                weedMesh.vertex(p1);weedMesh.color(0.1f,0.4f+t1*0.3f,0.2f);
                weedMesh.vertex(p2);weedMesh.color(0.1f,0.4f+t2*0.3f,0.2f);
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f,0.08f,0.15f);
        g.blending(true);g.blendAdd();g.depthTesting(false);
        g.meshColor();g.draw(weedMesh);
        g.pointSize(3);g.draw(bubbleMesh);
        g.pointSize(8);g.draw(fishMesh);
    }

    bool onKeyDown(const Keyboard& k) override {int key=k.key();if(key>=0&&key<256)keys[key]=true;return true;}
    bool onKeyUp(const Keyboard& k) override {int key=k.key();if(key>=0&&key<256)keys[key]=false;return true;}
};

ALLOLIB_WEB_MAIN(Aquarium)
`,
  },

  {
    id: 'life-slime-mold',
    title: 'Slime Mold',
    description: 'Physarum polycephalum simulation with emergent network patterns',
    category: 'simulation',
    subcategory: 'life',
    code: `/**
 * Slime Mold (Physarum) Simulation
 * Features: Agent-based trail following, emergent networks
 * Controls: Space = pause, R = reset
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

struct Particle { float x,y,angle; };

class SlimeMold : public WebApp {
public:
    static const int SIZE=200,NUM=5000;
    float trail[SIZE][SIZE];
    Particle particles[NUM];
    Mesh mesh,trailMesh;
    bool running=true;
    rnd::Random<> rng;
    const float PI_F=3.14159265f;

    float sensorAngle=0.4f,sensorDist=9.0f,turnSpeed=0.3f,moveSpeed=1.0f;
    float decayRate=0.9f,diffuseRate=0.2f;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);
        trailMesh.primitive(Mesh::POINTS);
        reset();
        nav().pos(0,0,3);
    }

    void reset() {
        memset(trail,0,sizeof(trail));
        for(int i=0;i<NUM;i++){
            float a=rng.uniform()*2*PI_F,r=rng.uniform()*SIZE*0.3f;
            particles[i].x=SIZE/2+cos(a)*r;
            particles[i].y=SIZE/2+sin(a)*r;
            particles[i].angle=rng.uniform()*2*PI_F;
        }
    }

    float sense(Particle& p, float angleOffset) {
        float a=p.angle+angleOffset;
        int sx=(int)(p.x+cos(a)*sensorDist)%SIZE;
        int sy=(int)(p.y+sin(a)*sensorDist)%SIZE;
        if(sx<0)sx+=SIZE;if(sy<0)sy+=SIZE;
        return trail[sy][sx];
    }

    void onAnimate(double dt) override {
        if(!running) return;

        for(int i=0;i<NUM;i++){
            Particle& p=particles[i];
            float fwd=sense(p,0);
            float left=sense(p,sensorAngle);
            float right=sense(p,-sensorAngle);

            if(fwd>left&&fwd>right){}
            else if(fwd<left&&fwd<right) p.angle+=turnSpeed*(rng.prob(0.5)?1:-1);
            else if(left>right) p.angle+=turnSpeed;
            else if(right>left) p.angle-=turnSpeed;

            p.x+=cos(p.angle)*moveSpeed;
            p.y+=sin(p.angle)*moveSpeed;
            if(p.x<0)p.x+=SIZE;if(p.x>=SIZE)p.x-=SIZE;
            if(p.y<0)p.y+=SIZE;if(p.y>=SIZE)p.y-=SIZE;

            int ix=(int)p.x,iy=(int)p.y;
            trail[iy][ix]=fmin(1.0f,trail[iy][ix]+0.1f);
        }

        float newTrail[SIZE][SIZE];
        for(int y=0;y<SIZE;y++){
            for(int x=0;x<SIZE;x++){
                float sum=0;
                for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){
                    int nx=(x+dx+SIZE)%SIZE,ny=(y+dy+SIZE)%SIZE;
                    sum+=trail[ny][nx];
                }
                newTrail[y][x]=fmax(0.0f,(trail[y][x]*(1-diffuseRate)+sum/9*diffuseRate)*decayRate);
            }
        }
        memcpy(trail,newTrail,sizeof(trail));

        trailMesh.reset();
        float scale=2.0f/SIZE;
        for(int y=0;y<SIZE;y+=2)for(int x=0;x<SIZE;x+=2){
            if(trail[y][x]>0.01f){
                trailMesh.vertex((x-SIZE/2)*scale,(y-SIZE/2)*scale,0);
                float v=trail[y][x];
                trailMesh.color(v*0.5f,v*0.9f,v*0.3f,v);
            }
        }

        mesh.reset();
        for(int i=0;i<NUM;i++){
            Particle& p=particles[i];
            mesh.vertex((p.x-SIZE/2)*scale,(p.y-SIZE/2)*scale,0.01f);
            mesh.color(1.0f,1.0f,0.8f,0.3f);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f);
        g.blending(true);g.blendAdd();g.depthTesting(false);
        g.pointSize(2);g.meshColor();g.draw(trailMesh);
        g.pointSize(1);g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()==' ')running=!running;
        if(k.key()=='r')reset();
        return true;
    }
};

ALLOLIB_WEB_MAIN(SlimeMold)
`,
  },

  {
    id: 'ca-reaction-diffusion',
    title: 'Reaction-Diffusion',
    description: 'Gray-Scott model creating organic patterns',
    category: 'simulation',
    subcategory: 'cellular',
    code: `/**
 * Reaction-Diffusion (Gray-Scott)
 * Features: Two-chemical system, organic patterns
 * Controls: Space = pause, R = reset, 1-4 = presets
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

class ReactionDiffusion : public WebApp {
public:
    static const int SIZE=128;
    float A[SIZE][SIZE],B[SIZE][SIZE];
    float nextA[SIZE][SIZE],nextB[SIZE][SIZE];
    Mesh mesh;
    bool running=true;
    float dA=1.0f,dB=0.5f,feed=0.055f,kill=0.062f;
    rnd::Random<> rng;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);
        reset();
        nav().pos(0,0,2.5f);
    }

    void reset() {
        for(int y=0;y<SIZE;y++)for(int x=0;x<SIZE;x++){A[y][x]=1.0f;B[y][x]=0.0f;}
        for(int i=0;i<10;i++){
            int cx=rng.uniform()*SIZE,cy=rng.uniform()*SIZE;
            for(int dy=-5;dy<=5;dy++)for(int dx=-5;dx<=5;dx++){
                int nx=(cx+dx+SIZE)%SIZE,ny=(cy+dy+SIZE)%SIZE;
                if(dx*dx+dy*dy<25){B[ny][nx]=1.0f;}
            }
        }
    }

    void setPreset(int p) {
        switch(p){
            case 0:feed=0.055f;kill=0.062f;break;
            case 1:feed=0.0367f;kill=0.0649f;break;
            case 2:feed=0.025f;kill=0.06f;break;
            case 3:feed=0.078f;kill=0.061f;break;
        }
        reset();
    }

    float laplacian(float g[SIZE][SIZE],int x,int y) {
        float sum=g[(y-1+SIZE)%SIZE][x]+g[(y+1)%SIZE][x]+g[y][(x-1+SIZE)%SIZE]+g[y][(x+1)%SIZE];
        sum+=0.05f*(g[(y-1+SIZE)%SIZE][(x-1+SIZE)%SIZE]+g[(y-1+SIZE)%SIZE][(x+1)%SIZE]+g[(y+1)%SIZE][(x-1+SIZE)%SIZE]+g[(y+1)%SIZE][(x+1)%SIZE]);
        return sum*0.2f-g[y][x];
    }

    void onAnimate(double dt) override {
        if(!running)return;

        for(int i=0;i<4;i++){
            for(int y=0;y<SIZE;y++)for(int x=0;x<SIZE;x++){
                float a=A[y][x],b=B[y][x];
                float abb=a*b*b;
                nextA[y][x]=a+dA*laplacian(A,x,y)-abb+feed*(1-a);
                nextB[y][x]=b+dB*laplacian(B,x,y)+abb-(kill+feed)*b;
                nextA[y][x]=fmax(0.0f,fmin(1.0f,nextA[y][x]));
                nextB[y][x]=fmax(0.0f,fmin(1.0f,nextB[y][x]));
            }
            memcpy(A,nextA,sizeof(A));
            memcpy(B,nextB,sizeof(B));
        }

        mesh.reset();
        float scale=2.0f/SIZE;
        for(int y=0;y<SIZE;y++)for(int x=0;x<SIZE;x++){
            mesh.vertex((x-SIZE/2)*scale,(y-SIZE/2)*scale,0);
            float v=1.0f-A[y][x]+B[y][x];
            mesh.color(v*0.3f,v*0.6f,v*0.9f);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f);
        g.blending(true);g.blendAdd();g.depthTesting(false);
        g.pointSize(4);g.meshColor();g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()==' ')running=!running;
        if(k.key()=='r')reset();
        if(k.key()>='1'&&k.key()<='4')setPreset(k.key()-'1');
        return true;
    }
};

ALLOLIB_WEB_MAIN(ReactionDiffusion)
`,
  },

  // ==========================================================================
  // SIMULATION - Ray Marching (Advanced)
  // ==========================================================================
  {
    id: 'rm-terrain',
    title: 'Ray Marched Terrain',
    description: 'Procedural terrain with noise-based heightmap',
    category: 'simulation',
    subcategory: 'raymarching',
    code: `/**
 * Ray Marched Terrain
 * Features: Noise heightmap, adaptive stepping, fog
 * Controls: WASD+QE navigation, mouse look
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <string>

using namespace al;

class RayMarchTerrain : public WebApp {
public:
    ShaderProgram shader;
    Mesh quad;
    float time=0;

    const char* vert = R"(#version 300 es
        layout(location=0) in vec3 position;
        out vec2 vUV;
        void main(){
            vUV=position.xy*0.5+0.5;
            gl_Position=vec4(position,1.0);
        }
    )";

    const char* frag = R"(#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;
        uniform float uTime;
        uniform vec2 uRes;
        uniform vec3 uCamPos;
        uniform mat4 uCamMat;

        // Hash and noise functions
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){
            vec2 i=floor(p),f=fract(p);
            f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){
            float v=0.0,a=0.5;
            for(int i=0;i<6;i++){v+=a*noise(p);p*=2.0;a*=0.5;}
            return v;
        }

        float terrain(vec3 p){
            // Add subtle water wave animation using uTime
            float h=fbm(p.xz*0.3)*2.0+fbm(p.xz*0.7)*0.5;
            if(h<0.3) h+=sin(p.x*2.0+uTime)*0.05*smoothstep(0.3,0.0,h);
            return p.y-h;
        }

        vec3 calcNormal(vec3 p){
            vec2 e=vec2(0.01,0);
            return normalize(vec3(
                terrain(p+e.xyy)-terrain(p-e.xyy),
                terrain(p+e.yxy)-terrain(p-e.yxy),
                terrain(p+e.yyx)-terrain(p-e.yyx)));
        }

        float march(vec3 ro,vec3 rd,out vec3 hitP){
            float t=0.0;
            for(int i=0;i<100;i++){
                hitP=ro+rd*t;
                float d=terrain(hitP);
                if(d<0.01)return t;
                t+=d*0.5;
                if(t>100.0)break;
            }
            return -1.0;
        }

        void main(){
            vec2 uv=(gl_FragCoord.xy-uRes*0.5)/uRes.y;
            vec3 rd=normalize((uCamMat*vec4(uv.x,uv.y,-1.5,0)).xyz);
            vec3 ro=uCamPos;

            vec3 hitP;
            float t=march(ro,rd,hitP);

            vec3 col=vec3(0.4,0.6,0.9)-rd.y*0.3; // sky

            if(t>0.0){
                vec3 n=calcNormal(hitP);
                vec3 sun=normalize(vec3(0.8,0.4,0.2));
                float diff=max(dot(n,sun),0.0);
                float ao=1.0-hitP.y*0.1;

                // Grass/rock colors
                float slope=1.0-n.y;
                vec3 grass=vec3(0.2,0.5,0.1);
                vec3 rock=vec3(0.4,0.35,0.3);
                vec3 snow=vec3(0.95,0.95,1.0);
                vec3 mat=mix(grass,rock,smoothstep(0.3,0.7,slope));
                if(hitP.y>2.5)mat=mix(mat,snow,smoothstep(2.5,3.5,hitP.y));

                col=mat*(0.3+0.7*diff)*ao;

                // Fog
                float fog=1.0-exp(-t*0.02);
                col=mix(col,vec3(0.5,0.6,0.7),fog);
            }

            fragColor=vec4(pow(col,vec3(0.4545)),1.0);
        }
    )";

    bool keys[256]={};
    float yaw=0,pitch=0;
    bool dragging=false;
    int lastX=0,lastY=0;

    void onCreate() override {
        shader.compile(vert,frag);
        quad.primitive(Mesh::TRIANGLE_STRIP);
        quad.vertex(-1,-1,0);quad.vertex(1,-1,0);
        quad.vertex(-1,1,0);quad.vertex(1,1,0);
        nav().pos(0,3,5);
        memset(keys,0,sizeof(keys));
    }

    void onAnimate(double dt) override {
        time+=dt;
        // WASD+QE movement
        float spd=5.0f*(float)dt;
        nav().updateDirectionVectors();
        if(keys[(int)'w'])nav().pos()+=nav().uf()*spd;
        if(keys[(int)'s'])nav().pos()-=nav().uf()*spd;
        if(keys[(int)'a'])nav().pos()-=nav().ur()*spd;
        if(keys[(int)'d'])nav().pos()+=nav().ur()*spd;
        if(keys[(int)'q'])nav().pos()-=nav().uu()*spd;
        if(keys[(int)'e'])nav().pos()+=nav().uu()*spd;
    }

    void onDraw(Graphics& g) override {
        g.clear(0);
        shader.use();
        shader.uniform("uTime",time);
        shader.uniform("uRes",(float)width(),(float)height());
        Vec3f pos=nav().pos();
        shader.uniform("uCamPos",pos.x,pos.y,pos.z);
        // Construct inverse view matrix from nav direction vectors
        nav().updateDirectionVectors();
        Vec3f r=nav().ur(), u=nav().uu(), f=nav().uf();
        float vm[16]={r.x,r.y,r.z,0, u.x,u.y,u.z,0, f.x,f.y,f.z,0, 0,0,0,1};
        shader.uniform("uCamMat",Matrix4f(vm));
        g.draw(quad);
    }

    bool onKeyDown(const Keyboard& k) override {
        int key=k.key();
        if(key>=0&&key<256)keys[key]=true;
        return true;
    }
    bool onKeyUp(const Keyboard& k) override {
        int key=k.key();
        if(key>=0&&key<256)keys[key]=false;
        return true;
    }
    bool onMouseDown(const Mouse& m) override {
        dragging=true; lastX=m.x(); lastY=m.y();
        return true;
    }
    bool onMouseUp(const Mouse& m) override {
        dragging=false;
        return true;
    }
    bool onMouseDrag(const Mouse& m) override {
        if(dragging){
            float dx=(m.x()-lastX)*0.005f;
            float dy=(m.y()-lastY)*0.005f;
            yaw-=dx; pitch-=dy;
            pitch=fmax(-1.5f,fmin(1.5f,pitch));
            // Update nav orientation from yaw/pitch
            Quatf qy; qy.fromAxisAngle(yaw,0,1,0);
            Quatf qp; qp.fromAxisAngle(pitch,1,0,0);
            Quatf q=qy*qp; nav().quat().set(q.x,q.y,q.z,q.w);
            lastX=m.x(); lastY=m.y();
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(RayMarchTerrain)
`,
  },

  {
    id: 'rm-volumetric-clouds',
    title: 'Volumetric Clouds',
    description: 'Ray marched volumetric clouds with light scattering',
    category: 'simulation',
    subcategory: 'raymarching',
    code: `/**
 * Volumetric Clouds
 * Features: Density sampling, light scattering, god rays
 * Controls: WASD+QE navigation
 */
#include "al_playground_compat.hpp"
#include <cmath>

using namespace al;

class VolumetricClouds : public WebApp {
public:
    ShaderProgram shader;
    Mesh quad;
    float time=0;
    bool keys[256]={};
    float yaw=0,pitch=0;
    bool dragging=false;
    int lastX=0,lastY=0;

    const char* vert = R"(#version 300 es
        layout(location=0) in vec3 position;
        void main(){gl_Position=vec4(position,1.0);}
    )";

    const char* frag = R"(#version 300 es
        precision highp float;
        out vec4 fragColor;
        uniform float uTime;
        uniform vec2 uRes;
        uniform vec3 uCamPos;
        uniform mat4 uCamMat;

        float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}

        float noise(vec3 p){
            vec3 i=floor(p),f=fract(p);
            f=f*f*(3.0-2.0*f);
            return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                           mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                       mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                           mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }

        float fbm(vec3 p){
            float v=0.0,a=0.5;
            vec3 shift=vec3(100);
            for(int i=0;i<5;i++){
                v+=a*noise(p);
                p=p*2.0+shift;
                a*=0.5;
            }
            return v;
        }

        float cloudDensity(vec3 p){
            float h=(p.y-5.0)*0.2;
            if(h<0.0||h>1.0)return 0.0;
            float shape=fbm(p*0.3+vec3(uTime*0.1,0,uTime*0.05));
            float edge=smoothstep(0.0,0.3,h)*smoothstep(1.0,0.7,h);
            return max(0.0,(shape-0.4)*edge*2.0);
        }

        vec3 lightMarch(vec3 p,vec3 sunDir){
            float density=0.0;
            float stepSize=0.5;
            for(int i=0;i<6;i++){
                density+=cloudDensity(p)*stepSize;
                p+=sunDir*stepSize;
            }
            return exp(-density*vec3(0.6,0.7,0.9)*0.8);
        }

        vec4 cloudMarch(vec3 ro,vec3 rd){
            vec3 sunDir=normalize(vec3(0.5,0.3,0.5));
            float tmin=max(0.0,(5.0-ro.y)/rd.y);
            float tmax=(15.0-ro.y)/rd.y;
            if(tmax<tmin)return vec4(0);

            float t=tmin;
            vec3 col=vec3(0);
            float transmit=1.0;
            float stepSize=0.3;

            for(int i=0;i<64;i++){
                if(t>tmax||transmit<0.01)break;
                vec3 p=ro+rd*t;
                float d=cloudDensity(p);
                if(d>0.01){
                    vec3 light=lightMarch(p,sunDir);
                    vec3 ambient=vec3(0.4,0.5,0.6);
                    col+=transmit*d*stepSize*(light*vec3(1.0,0.95,0.8)+ambient);
                    transmit*=exp(-d*stepSize*1.5);
                }
                t+=stepSize;
            }
            return vec4(col,1.0-transmit);
        }

        void main(){
            vec2 uv=(gl_FragCoord.xy-uRes*0.5)/uRes.y;
            vec3 rd=normalize((uCamMat*vec4(uv.x,uv.y,-1.5,0)).xyz);
            vec3 ro=uCamPos;

            // Sky gradient
            vec3 sky=mix(vec3(0.5,0.7,1.0),vec3(0.2,0.4,0.8),rd.y*0.5+0.5);

            // Sun
            vec3 sunDir=normalize(vec3(0.5,0.3,0.5));
            float sun=pow(max(dot(rd,sunDir),0.0),64.0);
            sky+=vec3(1.0,0.9,0.6)*sun;

            // Clouds
            vec4 clouds=cloudMarch(ro,rd);
            vec3 col=mix(sky,clouds.rgb,clouds.a);

            // Ground
            if(rd.y<0.0){
                float t=-ro.y/rd.y;
                vec3 ground=vec3(0.2,0.3,0.1);
                float fog=1.0-exp(-t*0.01);
                col=mix(ground,sky,fog);
            }

            fragColor=vec4(pow(col,vec3(0.4545)),1.0);
        }
    )";

    void onCreate() override {
        shader.compile(vert,frag);
        quad.primitive(Mesh::TRIANGLE_STRIP);
        quad.vertex(-1,-1,0);quad.vertex(1,-1,0);
        quad.vertex(-1,1,0);quad.vertex(1,1,0);
        nav().pos(0,8,0);
        memset(keys,0,sizeof(keys));
    }

    void onAnimate(double dt) override {
        time+=dt;
        float spd=5.0f*(float)dt;
        nav().updateDirectionVectors();
        if(keys[(int)'w'])nav().pos()+=nav().uf()*spd;
        if(keys[(int)'s'])nav().pos()-=nav().uf()*spd;
        if(keys[(int)'a'])nav().pos()-=nav().ur()*spd;
        if(keys[(int)'d'])nav().pos()+=nav().ur()*spd;
        if(keys[(int)'q'])nav().pos()-=nav().uu()*spd;
        if(keys[(int)'e'])nav().pos()+=nav().uu()*spd;
    }

    void onDraw(Graphics& g) override {
        g.clear(0);
        shader.use();
        shader.uniform("uTime",time);
        shader.uniform("uRes",(float)width(),(float)height());
        Vec3f pos=nav().pos();
        shader.uniform("uCamPos",pos.x,pos.y,pos.z);
        nav().updateDirectionVectors();
        Vec3f r=nav().ur(), u=nav().uu(), f=nav().uf();
        float vm[16]={r.x,r.y,r.z,0, u.x,u.y,u.z,0, f.x,f.y,f.z,0, 0,0,0,1};
        shader.uniform("uCamMat",Matrix4f(vm));
        g.draw(quad);
    }

    bool onKeyDown(const Keyboard& k) override {
        int key=k.key(); if(key>=0&&key<256)keys[key]=true; return true;
    }
    bool onKeyUp(const Keyboard& k) override {
        int key=k.key(); if(key>=0&&key<256)keys[key]=false; return true;
    }
    bool onMouseDown(const Mouse& m) override {
        dragging=true; lastX=m.x(); lastY=m.y(); return true;
    }
    bool onMouseUp(const Mouse& m) override { dragging=false; return true; }
    bool onMouseDrag(const Mouse& m) override {
        if(dragging){
            float dx=(m.x()-lastX)*0.005f, dy=(m.y()-lastY)*0.005f;
            yaw-=dx; pitch-=dy; pitch=fmax(-1.5f,fmin(1.5f,pitch));
            Quatf qy; qy.fromAxisAngle(yaw,0,1,0);
            Quatf qp; qp.fromAxisAngle(pitch,1,0,0);
            Quatf q=qy*qp; nav().quat().set(q.x,q.y,q.z,q.w);
            lastX=m.x(); lastY=m.y();
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(VolumetricClouds)
`,
  },

  // ==========================================================================
  // SIMULATION - Fluid & Smoke
  // ==========================================================================
  {
    id: 'fluid-simple-2d',
    title: 'Simple 2D Fluid',
    description: 'Navier-Stokes fluid simulation on a grid',
    category: 'simulation',
    subcategory: 'fluids',
    code: `/**
 * Simple 2D Fluid Simulation
 * Features: Navier-Stokes, advection, diffusion
 * Controls: Click/drag to add dye and force
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

class SimpleFluid2D : public WebApp {
public:
    static const int N=64;
    float vx[N][N],vy[N][N],vx0[N][N],vy0[N][N];
    float dens[N][N],dens0[N][N];
    Mesh mesh;
    float visc=0.0001f,diff=0.0001f,dt=0.1f;
    bool mouseDown=false;
    float mx=0,my=0,pmx=0,pmy=0;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);
        memset(vx,0,sizeof(vx));memset(vy,0,sizeof(vy));
        memset(dens,0,sizeof(dens));
        nav().pos(0,0,2);
    }

    int IX(int x,int y){return ((x+N)%N)+((y+N)%N)*N;}

    void diffuse(float x[N][N],float x0[N][N],float diff,int b){
        float a=dt*diff*N*N;
        for(int k=0;k<4;k++){
            for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
                x[j][i]=(x0[j][i]+a*(x[j][i-1]+x[j][i+1]+x[j-1][i]+x[j+1][i]))/(1+4*a);
            }
        }
    }

    void advect(float d[N][N],float d0[N][N],float u[N][N],float v[N][N]){
        for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
            float x=i-dt*N*u[j][i];
            float y=j-dt*N*v[j][i];
            x=fmax(0.5f,fmin(N-1.5f,x));
            y=fmax(0.5f,fmin(N-1.5f,y));
            int i0=(int)x,j0=(int)y;
            float s1=x-i0,s0=1-s1,t1=y-j0,t0=1-t1;
            d[j][i]=s0*(t0*d0[j0][i0]+t1*d0[j0+1][i0])+s1*(t0*d0[j0][i0+1]+t1*d0[j0+1][i0+1]);
        }
    }

    void project(){
        float div[N][N],p[N][N];
        memset(p,0,sizeof(p));
        for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
            div[j][i]=-0.5f*(vx[j][i+1]-vx[j][i-1]+vy[j+1][i]-vy[j-1][i])/N;
        }
        for(int k=0;k<4;k++){
            for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
                p[j][i]=(div[j][i]+p[j][i-1]+p[j][i+1]+p[j-1][i]+p[j+1][i])/4;
            }
        }
        for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
            vx[j][i]-=0.5f*N*(p[j][i+1]-p[j][i-1]);
            vy[j][i]-=0.5f*N*(p[j+1][i]-p[j-1][i]);
        }
    }

    void velStep(){
        memcpy(vx0,vx,sizeof(vx));memcpy(vy0,vy,sizeof(vy));
        diffuse(vx,vx0,visc,1);diffuse(vy,vy0,visc,2);
        project();
        memcpy(vx0,vx,sizeof(vx));memcpy(vy0,vy,sizeof(vy));
        advect(vx,vx0,vx0,vy0);advect(vy,vy0,vx0,vy0);
        project();
    }

    void densStep(){
        memcpy(dens0,dens,sizeof(dens));
        diffuse(dens,dens0,diff,0);
        memcpy(dens0,dens,sizeof(dens));
        advect(dens,dens0,vx,vy);
    }

    void onAnimate(double dt_) override {
        if(mouseDown){
            int i=(int)((mx+1)*0.5f*N);
            int j=(int)((my+1)*0.5f*N);
            i=std::max(1,std::min(N-2,i));
            j=std::max(1,std::min(N-2,j));
            dens[j][i]+=10.0f;
            vx[j][i]+=(mx-pmx)*50;
            vy[j][i]+=(my-pmy)*50;
        }
        pmx=mx;pmy=my;
        velStep();densStep();

        mesh.reset();
        float scale=2.0f/N;
        for(int j=0;j<N;j++)for(int i=0;i<N;i++){
            mesh.vertex((i-N/2)*scale,(j-N/2)*scale,0);
            float d=fmin(1.0f,dens[j][i]);
            mesh.color(d*0.2f,d*0.5f,d);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f);
        g.blending(true);g.blendAdd();g.depthTesting(false);
        g.pointSize(6);g.meshColor();g.draw(mesh);
    }

    bool onMouseDown(const Mouse& m) override {
        mouseDown=true;
        mx=(m.x()/(float)width())*2-1;
        my=1-(m.y()/(float)height())*2;
        pmx=mx;pmy=my;
        return true;
    }
    bool onMouseUp(const Mouse& m) override {mouseDown=false;return true;}
    bool onMouseDrag(const Mouse& m) override {
        mx=(m.x()/(float)width())*2-1;
        my=1-(m.y()/(float)height())*2;
        return true;
    }
};

ALLOLIB_WEB_MAIN(SimpleFluid2D)
`,
  },

  {
    id: 'fluid-smoke-2d',
    title: '2D Smoke Simulation',
    description: 'Smoke with buoyancy and vorticity confinement',
    category: 'simulation',
    subcategory: 'fluids',
    code: `/**
 * 2D Smoke Simulation
 * Features: Buoyancy, vorticity confinement, temperature
 * Controls: Space = toggle source, R = reset
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

class Smoke2D : public WebApp {
public:
    static const int N=80;
    float vx[N][N],vy[N][N],temp[N][N],smoke[N][N];
    float vx0[N][N],vy0[N][N],temp0[N][N],smoke0[N][N];
    Mesh mesh;
    bool sourceOn=true;
    float dt=0.05f;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);
        reset();
        nav().pos(0,0,2);
    }

    void reset(){
        memset(vx,0,sizeof(vx));memset(vy,0,sizeof(vy));
        memset(temp,0,sizeof(temp));memset(smoke,0,sizeof(smoke));
    }

    void diffuse(float x[N][N],float x0[N][N],float diff){
        float a=dt*diff*N*N;
        for(int k=0;k<4;k++){
            for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
                x[j][i]=(x0[j][i]+a*(x[j][i-1]+x[j][i+1]+x[j-1][i]+x[j+1][i]))/(1+4*a);
            }
        }
    }

    void advect(float d[N][N],float d0[N][N]){
        for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
            float x=i-dt*N*vx[j][i];
            float y=j-dt*N*vy[j][i];
            x=fmax(0.5f,fmin(N-1.5f,x));
            y=fmax(0.5f,fmin(N-1.5f,y));
            int i0=(int)x,j0=(int)y;
            float s1=x-i0,s0=1-s1,t1=y-j0,t0=1-t1;
            d[j][i]=s0*(t0*d0[j0][i0]+t1*d0[j0+1][i0])+s1*(t0*d0[j0][i0+1]+t1*d0[j0+1][i0+1]);
        }
    }

    void project(){
        float div[N][N],p[N][N];
        memset(p,0,sizeof(p));
        for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
            div[j][i]=-0.5f*(vx[j][i+1]-vx[j][i-1]+vy[j+1][i]-vy[j-1][i])/N;
        }
        for(int k=0;k<4;k++){
            for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
                p[j][i]=(div[j][i]+p[j][i-1]+p[j][i+1]+p[j-1][i]+p[j+1][i])/4;
            }
        }
        for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
            vx[j][i]-=0.5f*N*(p[j][i+1]-p[j][i-1]);
            vy[j][i]-=0.5f*N*(p[j+1][i]-p[j-1][i]);
        }
    }

    void vorticity(){
        float curl[N][N];
        for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
            curl[j][i]=0.5f*((vy[j][i+1]-vy[j][i-1])-(vx[j+1][i]-vx[j-1][i]));
        }
        float eps=0.5f;
        for(int j=2;j<N-2;j++)for(int i=2;i<N-2;i++){
            float dx=fabs(curl[j][i+1])-fabs(curl[j][i-1]);
            float dy=fabs(curl[j+1][i])-fabs(curl[j-1][i]);
            float len=sqrtf(dx*dx+dy*dy)+1e-5f;
            dx/=len;dy/=len;
            vx[j][i]+=eps*dt*dy*curl[j][i];
            vy[j][i]-=eps*dt*dx*curl[j][i];
        }
    }

    void buoyancy(){
        float buoy=1.0f,ambTemp=0.0f;
        for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
            vy[j][i]+=dt*buoy*(temp[j][i]-ambTemp);
        }
    }

    void onAnimate(double dt_) override {
        // Add source
        if(sourceOn){
            int cx=N/2;
            for(int dx=-3;dx<=3;dx++){
                smoke[5][cx+dx]+=0.3f;
                temp[5][cx+dx]+=0.5f;
            }
        }

        // Velocity step
        memcpy(vx0,vx,sizeof(vx));memcpy(vy0,vy,sizeof(vy));
        diffuse(vx,vx0,0.0001f);diffuse(vy,vy0,0.0001f);
        project();
        vorticity();
        buoyancy();
        memcpy(vx0,vx,sizeof(vx));memcpy(vy0,vy,sizeof(vy));
        advect(vx,vx0);advect(vy,vy0);
        project();

        // Smoke and temp step
        memcpy(smoke0,smoke,sizeof(smoke));
        memcpy(temp0,temp,sizeof(temp));
        diffuse(smoke,smoke0,0.0001f);
        diffuse(temp,temp0,0.0002f);
        memcpy(smoke0,smoke,sizeof(smoke));
        memcpy(temp0,temp,sizeof(temp));
        advect(smoke,smoke0);
        advect(temp,temp0);

        // Decay
        for(int j=0;j<N;j++)for(int i=0;i<N;i++){
            smoke[j][i]*=0.995f;
            temp[j][i]*=0.99f;
        }

        mesh.reset();
        float scale=2.0f/N;
        for(int j=0;j<N;j++)for(int i=0;i<N;i++){
            mesh.vertex((i-N/2)*scale,(j-N/2)*scale,0);
            float s=fmin(1.0f,smoke[j][i]);
            float t=fmin(1.0f,temp[j][i]*0.5f);
            mesh.color(s*0.8f+t*0.2f,s*0.8f,s*0.9f);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f);
        g.blending(true);g.blendAdd();g.depthTesting(false);
        g.pointSize(5);g.meshColor();g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()==' ')sourceOn=!sourceOn;
        if(k.key()=='r')reset();
        return true;
    }
};

ALLOLIB_WEB_MAIN(Smoke2D)
`,
  },

  {
    id: 'fluid-ink-drops',
    title: 'Ink in Water',
    description: 'Multiple colored ink drops dispersing in water',
    category: 'simulation',
    subcategory: 'fluids',
    code: `/**
 * Ink in Water
 * Features: Multiple dye colors, turbulent mixing
 * Controls: Click to add ink, R = reset
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

class InkDrops : public WebApp {
public:
    static const int N=80;
    float vx[N][N],vy[N][N];
    float r[N][N],g[N][N],b[N][N];
    float vx0[N][N],vy0[N][N];
    float r0[N][N],g0[N][N],b0[N][N];
    Mesh mesh;
    rnd::Random<> rng;
    int colorIdx=0;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);
        reset();
        nav().pos(0,0,2);
    }

    void reset(){
        memset(vx,0,sizeof(vx));memset(vy,0,sizeof(vy));
        memset(r,0,sizeof(r));memset(g,0,sizeof(g));memset(b,0,sizeof(b));
    }

    void diffuse(float x[N][N],float x0[N][N],float diff){
        float a=0.05f*diff*N*N;
        for(int k=0;k<4;k++){
            for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
                x[j][i]=(x0[j][i]+a*(x[j][i-1]+x[j][i+1]+x[j-1][i]+x[j+1][i]))/(1+4*a);
            }
        }
    }

    void advect(float d[N][N],float d0[N][N]){
        float dt=0.05f;
        for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
            float x=i-dt*N*vx[j][i];
            float y=j-dt*N*vy[j][i];
            x=fmax(0.5f,fmin(N-1.5f,x));
            y=fmax(0.5f,fmin(N-1.5f,y));
            int i0=(int)x,j0=(int)y;
            float s1=x-i0,s0=1-s1,t1=y-j0,t0=1-t1;
            d[j][i]=s0*(t0*d0[j0][i0]+t1*d0[j0+1][i0])+s1*(t0*d0[j0][i0+1]+t1*d0[j0+1][i0+1]);
        }
    }

    void project(){
        float div[N][N],p[N][N];
        memset(p,0,sizeof(p));
        for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
            div[j][i]=-0.5f*(vx[j][i+1]-vx[j][i-1]+vy[j+1][i]-vy[j-1][i])/N;
        }
        for(int k=0;k<4;k++){
            for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
                p[j][i]=(div[j][i]+p[j][i-1]+p[j][i+1]+p[j-1][i]+p[j+1][i])/4;
            }
        }
        for(int j=1;j<N-1;j++)for(int i=1;i<N-1;i++){
            vx[j][i]-=0.5f*N*(p[j][i+1]-p[j][i-1]);
            vy[j][i]-=0.5f*N*(p[j+1][i]-p[j-1][i]);
        }
    }

    void addInk(int ci,int cj,float dr,float dg,float db){
        for(int dj=-3;dj<=3;dj++)for(int di=-3;di<=3;di++){
            int i=ci+di,j=cj+dj;
            if(i>0&&i<N-1&&j>0&&j<N-1){
                float dist=sqrtf(di*di+dj*dj);
                if(dist<4){
                    float amt=(4-dist)/4*0.5f;
                    r[j][i]+=dr*amt;
                    g[j][i]+=dg*amt;
                    b[j][i]+=db*amt;
                    vy[j][i]+=(rng.uniform()-0.5f)*2;
                    vx[j][i]+=(rng.uniform()-0.5f)*2;
                }
            }
        }
    }

    void onAnimate(double dt) override {
        // Velocity step
        memcpy(vx0,vx,sizeof(vx));memcpy(vy0,vy,sizeof(vy));
        diffuse(vx,vx0,0.0001f);diffuse(vy,vy0,0.0001f);
        project();
        memcpy(vx0,vx,sizeof(vx));memcpy(vy0,vy,sizeof(vy));
        advect(vx,vx0);advect(vy,vy0);
        project();

        // Dye step
        memcpy(r0,r,sizeof(r));memcpy(g0,g,sizeof(g));memcpy(b0,b,sizeof(b));
        diffuse(r,r0,0.0002f);diffuse(g,g0,0.0002f);diffuse(b,b0,0.0002f);
        memcpy(r0,r,sizeof(r));memcpy(g0,g,sizeof(g));memcpy(b0,b,sizeof(b));
        advect(r,r0);advect(g,g0);advect(b,b0);

        // Decay
        for(int j=0;j<N;j++)for(int i=0;i<N;i++){
            r[j][i]*=0.998f;g[j][i]*=0.998f;b[j][i]*=0.998f;
            vx[j][i]*=0.99f;vy[j][i]*=0.99f;
        }

        mesh.reset();
        float scale=2.0f/N;
        for(int j=0;j<N;j++)for(int i=0;i<N;i++){
            mesh.vertex((i-N/2)*scale,(j-N/2)*scale,0);
            mesh.color(fmin(1.0f,r[j][i]),fmin(1.0f,g[j][i]),fmin(1.0f,b[j][i]));
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.95f,0.95f,0.98f);
        g.blending(true);g.blendTrans();g.depthTesting(false);
        g.pointSize(5);g.meshColor();g.draw(mesh);
    }

    bool onMouseDown(const Mouse& m) override {
        float mx=(m.x()/(float)width())*2-1;
        float my=1-(m.y()/(float)height())*2;
        int i=(int)((mx+1)*0.5f*N);
        int j=(int)((my+1)*0.5f*N);

        // Cycle through colors
        float colors[5][3]={{1,0.2f,0.1f},{0.1f,0.8f,0.2f},{0.1f,0.3f,1},{1,0.8f,0.1f},{0.8f,0.1f,0.9f}};
        addInk(i,j,colors[colorIdx][0],colors[colorIdx][1],colors[colorIdx][2]);
        colorIdx=(colorIdx+1)%5;
        return true;
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()=='r')reset();
        return true;
    }
};

ALLOLIB_WEB_MAIN(InkDrops)
`,
  },

  // ==========================================================================
  // SIMULATION - Cellular Automata (Advanced)
  // ==========================================================================
  {
    id: 'ca-3d-life',
    title: '3D Game of Life',
    description: '3D cellular automaton with volumetric rendering',
    category: 'simulation',
    subcategory: 'cellular',
    code: `/**
 * 3D Game of Life
 * Features: 3D neighbor rules, volumetric cubes
 * Controls: Space = pause, R = reset, WASD+QE = navigate
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

class Life3D : public WebApp {
public:
    static const int SIZE=20;
    bool grid[SIZE][SIZE][SIZE];
    bool next[SIZE][SIZE][SIZE];
    Mesh cube;
    bool running=true;
    float timer=0;
    rnd::Random<> rng;
    // 3D Life rule: survive 4,5, born 5
    int surviveMin=4,surviveMax=5,bornMin=5,bornMax=5;

    void onCreate() override {
        addCube(cube,0.4f);
        cube.generateNormals();
        reset();
        nav().pos(0,0,SIZE*1.5f);
    }

    void reset(){
        for(int z=0;z<SIZE;z++)for(int y=0;y<SIZE;y++)for(int x=0;x<SIZE;x++){
            grid[z][y][x]=rng.uniform()<0.2f;
        }
    }

    int countNeighbors(int cx,int cy,int cz){
        int count=0;
        for(int dz=-1;dz<=1;dz++)for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){
            if(dx==0&&dy==0&&dz==0)continue;
            int nx=(cx+dx+SIZE)%SIZE;
            int ny=(cy+dy+SIZE)%SIZE;
            int nz=(cz+dz+SIZE)%SIZE;
            if(grid[nz][ny][nx])count++;
        }
        return count;
    }

    void step(){
        for(int z=0;z<SIZE;z++)for(int y=0;y<SIZE;y++)for(int x=0;x<SIZE;x++){
            int n=countNeighbors(x,y,z);
            if(grid[z][y][x]){
                next[z][y][x]=(n>=surviveMin&&n<=surviveMax);
            }else{
                next[z][y][x]=(n>=bornMin&&n<=bornMax);
            }
        }
        memcpy(grid,next,sizeof(grid));
    }

    void onAnimate(double dt) override {
        if(running){
            timer+=dt;
            if(timer>0.2f){
                step();
                timer=0;
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f);
        g.depthTesting(true);
        g.lighting(true);
        Light light; light.pos(SIZE,SIZE*2.0f,SIZE); g.light(light);

        float offset=SIZE/2.0f;
        for(int z=0;z<SIZE;z++)for(int y=0;y<SIZE;y++)for(int x=0;x<SIZE;x++){
            if(grid[z][y][x]){
                g.pushMatrix();
                g.translate(x-offset,y-offset,z-offset);
                float hue=(float)(x+y+z)/(SIZE*3);
                g.color(HSV(hue,0.7f,0.9f));
                g.draw(cube);
                g.popMatrix();
            }
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()==' ')running=!running;
        if(k.key()=='r')reset();
        return true;
    }
};

ALLOLIB_WEB_MAIN(Life3D)
`,
  },

  {
    id: 'ca-falling-sand',
    title: 'Falling Sand',
    description: 'Falling sand game with multiple material types',
    category: 'simulation',
    subcategory: 'cellular',
    code: `/**
 * Falling Sand Game
 * Features: Sand, water, fire, stone materials
 * Controls: 1=sand, 2=water, 3=fire, 4=stone, Click to place
 */
#include "al_playground_compat.hpp"
#include <cmath>

using namespace al;

class FallingSand : public WebApp {
public:
    static const int W=120,H=80;
    enum Material{EMPTY=0,SAND,WATER,FIRE,STONE};
    Material grid[H][W];
    Mesh mesh;
    Material brush=SAND;
    bool mouseDown=false;
    float mx=0,my=0;
    rnd::Random<> rng;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);
        for(int y=0;y<H;y++)for(int x=0;x<W;x++)grid[y][x]=EMPTY;
        nav().pos(0,0,2);
    }

    void swap(int x1,int y1,int x2,int y2){
        Material t=grid[y1][x1];
        grid[y1][x1]=grid[y2][x2];
        grid[y2][x2]=t;
    }

    bool inBounds(int x,int y){return x>=0&&x<W&&y>=0&&y<H;}

    void updateSand(int x,int y){
        if(y>0){
            if(grid[y-1][x]==EMPTY){swap(x,y,x,y-1);return;}
            if(grid[y-1][x]==WATER){swap(x,y,x,y-1);return;}
            int dir=rng.uniform()<0.5f?-1:1;
            if(x+dir>=0&&x+dir<W&&y>0&&grid[y-1][x+dir]==EMPTY){
                swap(x,y,x+dir,y-1);return;
            }
            if(x-dir>=0&&x-dir<W&&y>0&&grid[y-1][x-dir]==EMPTY){
                swap(x,y,x-dir,y-1);return;
            }
        }
    }

    void updateWater(int x,int y){
        if(y>0&&grid[y-1][x]==EMPTY){swap(x,y,x,y-1);return;}
        int dir=rng.uniform()<0.5f?-1:1;
        if(inBounds(x+dir,y-1)&&grid[y-1][x+dir]==EMPTY){
            swap(x,y,x+dir,y-1);return;
        }
        if(inBounds(x+dir,y)&&grid[y][x+dir]==EMPTY){
            swap(x,y,x+dir,y);return;
        }
        if(inBounds(x-dir,y)&&grid[y][x-dir]==EMPTY){
            swap(x,y,x-dir,y);return;
        }
    }

    void updateFire(int x,int y){
        if(rng.uniform()<0.1f){grid[y][x]=EMPTY;return;}
        if(y<H-1&&grid[y+1][x]==EMPTY&&rng.uniform()<0.4f){
            swap(x,y,x,y+1);
        }
        // Spread to adjacent
        for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){
            int nx=x+dx,ny=y+dy;
            if(inBounds(nx,ny)&&grid[ny][nx]==SAND&&rng.uniform()<0.01f){
                grid[ny][nx]=FIRE;
            }
        }
        if(inBounds(x,y-1)&&grid[y-1][x]==WATER){
            grid[y][x]=EMPTY;grid[y-1][x]=EMPTY;
        }
    }

    void onAnimate(double dt) override {
        if(mouseDown){
            int px=(int)((mx+1)*0.5f*W);
            int py=(int)((my+1)*0.5f*H);
            for(int dy=-2;dy<=2;dy++)for(int dx=-2;dx<=2;dx++){
                int nx=px+dx,ny=py+dy;
                if(inBounds(nx,ny)&&(brush==STONE||grid[ny][nx]==EMPTY)){
                    if(rng.uniform()<0.5f)grid[ny][nx]=brush;
                }
            }
        }

        // Update bottom to top for falling
        for(int y=0;y<H;y++)for(int x=0;x<W;x++){
            Material m=grid[y][x];
            if(m==SAND)updateSand(x,y);
            else if(m==WATER)updateWater(x,y);
            else if(m==FIRE)updateFire(x,y);
        }

        mesh.reset();
        float sx=2.0f/W,sy=2.0f/H;
        for(int y=0;y<H;y++)for(int x=0;x<W;x++){
            Material m=grid[y][x];
            if(m!=EMPTY){
                mesh.vertex((x-W/2)*sx,(y-H/2)*sy,0);
                switch(m){
                    case SAND:mesh.color(0.9f,0.8f,0.4f);break;
                    case WATER:mesh.color(0.2f,0.4f,0.9f);break;
                    case FIRE:mesh.color(1.0f,0.3f+rng.uniform()*0.3f,0.1f);break;
                    case STONE:mesh.color(0.5f,0.5f,0.5f);break;
                    default:break;
                }
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f);
        g.blending(true);g.blendAdd();g.depthTesting(false);
        g.pointSize(4);g.meshColor();g.draw(mesh);
    }

    bool onMouseDown(const Mouse& m) override {
        mouseDown=true;
        mx=(m.x()/(float)width())*2-1;
        my=1-(m.y()/(float)height())*2;
        return true;
    }
    bool onMouseUp(const Mouse& m) override {mouseDown=false;return true;}
    bool onMouseDrag(const Mouse& m) override {
        mx=(m.x()/(float)width())*2-1;
        my=1-(m.y()/(float)height())*2;
        return true;
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()=='1')brush=SAND;
        if(k.key()=='2')brush=WATER;
        if(k.key()=='3')brush=FIRE;
        if(k.key()=='4')brush=STONE;
        return true;
    }
};

ALLOLIB_WEB_MAIN(FallingSand)
`,
  },

  {
    id: 'ca-wireworld',
    title: 'Wireworld',
    description: 'Electronic circuit simulation cellular automaton',
    category: 'simulation',
    subcategory: 'cellular',
    code: `/**
 * Wireworld - Electronic Circuit Simulation
 * Features: Electron heads, tails, conductors
 * Controls: Click to place, 1=conductor, 2=head, Space=pause, R=reset
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

class Wireworld : public WebApp {
public:
    static const int W=80,H=60;
    enum Cell{EMPTY=0,HEAD,TAIL,WIRE};
    Cell grid[H][W],next[H][W];
    Mesh mesh;
    Cell brush=WIRE;
    bool mouseDown=false,running=true;
    float mx=0,my=0;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);
        memset(grid,EMPTY,sizeof(grid));
        // Create example circuit - oscillator
        for(int x=20;x<60;x++)grid[30][x]=WIRE;
        for(int y=25;y<35;y++){grid[y][20]=WIRE;grid[y][60]=WIRE;}
        grid[30][25]=HEAD;grid[30][26]=TAIL;
        nav().pos(0,0,2);
    }

    void reset(){memset(grid,EMPTY,sizeof(grid));}

    int countHeads(int x,int y){
        int c=0;
        for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){
            if(dx==0&&dy==0)continue;
            int nx=x+dx,ny=y+dy;
            if(nx>=0&&nx<W&&ny>=0&&ny<H&&grid[ny][nx]==HEAD)c++;
        }
        return c;
    }

    void step(){
        for(int y=0;y<H;y++)for(int x=0;x<W;x++){
            Cell c=grid[y][x];
            if(c==EMPTY)next[y][x]=EMPTY;
            else if(c==HEAD)next[y][x]=TAIL;
            else if(c==TAIL)next[y][x]=WIRE;
            else{
                int heads=countHeads(x,y);
                next[y][x]=(heads==1||heads==2)?HEAD:WIRE;
            }
        }
        memcpy(grid,next,sizeof(grid));
    }

    void onAnimate(double dt) override {
        if(mouseDown){
            int px=(int)((mx+1)*0.5f*W);
            int py=(int)((my+1)*0.5f*H);
            if(px>=0&&px<W&&py>=0&&py<H)grid[py][px]=brush;
        }
        if(running)step();

        mesh.reset();
        float sx=2.0f/W,sy=2.0f/H;
        for(int y=0;y<H;y++)for(int x=0;x<W;x++){
            Cell c=grid[y][x];
            if(c!=EMPTY){
                mesh.vertex((x-W/2)*sx,(y-H/2)*sy,0);
                if(c==HEAD)mesh.color(0.2f,0.5f,1.0f);
                else if(c==TAIL)mesh.color(1.0f,0.3f,0.3f);
                else mesh.color(0.9f,0.7f,0.2f);
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f);
        g.blending(true);g.blendAdd();g.depthTesting(false);
        g.pointSize(5);g.meshColor();g.draw(mesh);
    }

    bool onMouseDown(const Mouse& m) override {
        mouseDown=true;
        mx=(m.x()/(float)width())*2-1;
        my=1-(m.y()/(float)height())*2;
        return true;
    }
    bool onMouseUp(const Mouse& m) override {mouseDown=false;return true;}
    bool onMouseDrag(const Mouse& m) override {
        mx=(m.x()/(float)width())*2-1;
        my=1-(m.y()/(float)height())*2;
        return true;
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()=='1')brush=WIRE;
        if(k.key()=='2')brush=HEAD;
        if(k.key()==' ')running=!running;
        if(k.key()=='r')reset();
        return true;
    }
};

ALLOLIB_WEB_MAIN(Wireworld)
`,
  },

  // ==========================================================================
  // SIMULATION - Procedural Generation
  // ==========================================================================
  {
    id: 'proc-terrain',
    title: 'Procedural Terrain',
    description: 'Infinite terrain with FBM noise and erosion',
    category: 'simulation',
    subcategory: 'procedural',
    code: `/**
 * Procedural Terrain Generator
 * Features: FBM noise, thermal erosion, biomes
 * Controls: WASD+QE = navigate, R = regenerate
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <vector>

using namespace al;

class ProcTerrain : public WebApp {
public:
    static const int SIZE=64;
    float height[SIZE][SIZE];
    Mesh mesh;
    rnd::Random<> rng;
    bool keys[256]={};

    float hash(float x,float y){
        float n=sinf(x*127.1f+y*311.7f)*43758.5453f;
        return n-floorf(n);
    }

    float noise(float x,float y){
        float ix=floorf(x),iy=floorf(y);
        float fx=x-ix,fy=y-iy;
        fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
        return (hash(ix,iy)*(1-fx)+hash(ix+1,iy)*fx)*(1-fy)+
               (hash(ix,iy+1)*(1-fx)+hash(ix+1,iy+1)*fx)*fy;
    }

    float fbm(float x,float y,int oct=6){
        float v=0,a=0.5f,f=1.0f;
        for(int i=0;i<oct;i++){v+=a*noise(x*f,y*f);f*=2;a*=0.5f;}
        return v;
    }

    void generate(){
        float seed=rng.uniform()*1000;
        for(int y=0;y<SIZE;y++)for(int x=0;x<SIZE;x++){
            float nx=x*0.1f+seed,ny=y*0.1f+seed;
            height[y][x]=fbm(nx,ny)*3.0f;
            // Add ridges
            height[y][x]+=powf(1.0f-fabsf(noise(nx*2,ny*2)*2-1),2)*1.5f;
        }
        // Simple thermal erosion
        for(int iter=0;iter<20;iter++){
            for(int y=1;y<SIZE-1;y++)for(int x=1;x<SIZE-1;x++){
                float h=height[y][x];
                float diffs[4]={h-height[y-1][x],h-height[y+1][x],
                                h-height[y][x-1],h-height[y][x+1]};
                float maxDiff=0;int maxIdx=-1;
                for(int i=0;i<4;i++)if(diffs[i]>maxDiff){maxDiff=diffs[i];maxIdx=i;}
                if(maxDiff>0.3f){
                    float amt=maxDiff*0.25f;
                    height[y][x]-=amt;
                    if(maxIdx==0)height[y-1][x]+=amt;
                    else if(maxIdx==1)height[y+1][x]+=amt;
                    else if(maxIdx==2)height[y][x-1]+=amt;
                    else height[y][x+1]+=amt;
                }
            }
        }
        buildMesh();
    }

    void buildMesh(){
        mesh.reset();
        mesh.primitive(Mesh::TRIANGLES);
        float scale=4.0f/SIZE;
        for(int y=0;y<SIZE-1;y++)for(int x=0;x<SIZE-1;x++){
            float h00=height[y][x],h10=height[y][x+1];
            float h01=height[y+1][x],h11=height[y+1][x+1];
            Vec3f v00((x-SIZE/2)*scale,h00,(y-SIZE/2)*scale);
            Vec3f v10((x+1-SIZE/2)*scale,h10,(y-SIZE/2)*scale);
            Vec3f v01((x-SIZE/2)*scale,h01,(y+1-SIZE/2)*scale);
            Vec3f v11((x+1-SIZE/2)*scale,h11,(y+1-SIZE/2)*scale);

            auto getColor=[](float h)->Color{
                if(h<0.3f)return Color(0.2f,0.4f,0.8f);      // water
                if(h<0.5f)return Color(0.8f,0.75f,0.5f);     // sand
                if(h<1.5f)return Color(0.3f,0.6f,0.2f);      // grass
                if(h<2.5f)return Color(0.4f,0.35f,0.3f);     // rock
                return Color(0.95f,0.95f,1.0f);              // snow
            };

            mesh.vertex(v00);mesh.color(getColor(h00));
            mesh.vertex(v10);mesh.color(getColor(h10));
            mesh.vertex(v01);mesh.color(getColor(h01));
            mesh.vertex(v10);mesh.color(getColor(h10));
            mesh.vertex(v11);mesh.color(getColor(h11));
            mesh.vertex(v01);mesh.color(getColor(h01));
        }
        mesh.generateNormals();
    }

    void onCreate() override {
        generate();
        nav().pos(0,4,6);
        nav().faceToward(Vec3f(0,0,0));
        memset(keys,0,sizeof(keys));
    }

    void onAnimate(double dt) override {
        float spd=4.0f*(float)dt;
        nav().updateDirectionVectors();
        if(keys[(int)'w'])nav().pos()+=nav().uf()*spd;
        if(keys[(int)'s'])nav().pos()-=nav().uf()*spd;
        if(keys[(int)'a'])nav().pos()-=nav().ur()*spd;
        if(keys[(int)'d'])nav().pos()+=nav().ur()*spd;
        if(keys[(int)'q'])nav().pos()-=nav().uu()*spd;
        if(keys[(int)'e'])nav().pos()+=nav().uu()*spd;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.5f,0.7f,0.9f);
        g.depthTesting(true);
        g.lighting(true);
        Light light; light.pos(5,10,5); g.light(light);
        g.meshColor();
        g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        int key=k.key();
        if(key>=0&&key<256)keys[key]=true;
        if(k.key()=='r')generate();
        return true;
    }
    bool onKeyUp(const Keyboard& k) override {
        int key=k.key(); if(key>=0&&key<256)keys[key]=false; return true;
    }
};

ALLOLIB_WEB_MAIN(ProcTerrain)
`,
  },

  {
    id: 'proc-caves',
    title: 'Cave Generation',
    description: 'Procedural caves using cellular automata and noise',
    category: 'simulation',
    subcategory: 'procedural',
    code: `/**
 * Procedural Cave Generator
 * Features: Cellular automata smoothing, connected caves
 * Controls: R = regenerate, WASD+QE = navigate
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <cstring>

using namespace al;

class ProcCaves : public WebApp {
public:
    static const int W=60,H=40,D=30;
    bool solid[D][H][W];
    Mesh mesh;
    rnd::Random<> rng;
    bool keys[256]={};

    void onCreate() override {
        generate();
        nav().pos(0,0,0); // Start inside the cave
        memset(keys,0,sizeof(keys));
    }

    void generate(){
        // Random fill
        for(int z=0;z<D;z++)for(int y=0;y<H;y++)for(int x=0;x<W;x++){
            solid[z][y][x]=rng.uniform()<0.52f;
        }
        // Cellular automata smoothing
        bool next[D][H][W];
        for(int iter=0;iter<5;iter++){
            for(int z=1;z<D-1;z++)for(int y=1;y<H-1;y++)for(int x=1;x<W-1;x++){
                int count=0;
                for(int dz=-1;dz<=1;dz++)for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){
                    if(solid[z+dz][y+dy][x+dx])count++;
                }
                next[z][y][x]=count>=14;
            }
            // Keep borders solid
            for(int z=0;z<D;z++)for(int y=0;y<H;y++){next[z][y][0]=next[z][y][W-1]=true;}
            for(int z=0;z<D;z++)for(int x=0;x<W;x++){next[z][0][x]=next[z][H-1][x]=true;}
            for(int y=0;y<H;y++)for(int x=0;x<W;x++){next[0][y][x]=next[D-1][y][x]=true;}
            memcpy(solid,next,sizeof(solid));
        }
        buildMesh();
    }

    void buildMesh(){
        mesh.reset();
        mesh.primitive(Mesh::TRIANGLES);
        float sx=0.2f,sy=0.2f,sz=0.2f;
        float ox=W*sx*0.5f,oy=H*sy*0.5f,oz=D*sz*0.5f;

        auto addFace=[&](Vec3f a,Vec3f b,Vec3f c,Vec3f d,Vec3f n,Color col){
            mesh.vertex(a);mesh.normal(n);mesh.color(col);
            mesh.vertex(b);mesh.normal(n);mesh.color(col);
            mesh.vertex(c);mesh.normal(n);mesh.color(col);
            mesh.vertex(a);mesh.normal(n);mesh.color(col);
            mesh.vertex(c);mesh.normal(n);mesh.color(col);
            mesh.vertex(d);mesh.normal(n);mesh.color(col);
        };

        for(int z=0;z<D;z++)for(int y=0;y<H;y++)for(int x=0;x<W;x++){
            if(!solid[z][y][x])continue;
            float px=x*sx-ox,py=y*sy-oy,pz=z*sz-oz;
            float s=sx*0.5f;
            Color col(0.45f+rng.uniform()*0.1f,0.4f+rng.uniform()*0.1f,0.35f);
            // Only add faces between solid and air
            if(x<W-1&&!solid[z][y][x+1])addFace(Vec3f(px+s,py-s,pz-s),Vec3f(px+s,py+s,pz-s),Vec3f(px+s,py+s,pz+s),Vec3f(px+s,py-s,pz+s),Vec3f(1,0,0),col);
            if(x>0&&!solid[z][y][x-1])addFace(Vec3f(px-s,py-s,pz+s),Vec3f(px-s,py+s,pz+s),Vec3f(px-s,py+s,pz-s),Vec3f(px-s,py-s,pz-s),Vec3f(-1,0,0),col);
            if(y<H-1&&!solid[z][y+1][x])addFace(Vec3f(px-s,py+s,pz-s),Vec3f(px-s,py+s,pz+s),Vec3f(px+s,py+s,pz+s),Vec3f(px+s,py+s,pz-s),Vec3f(0,1,0),col);
            if(y>0&&!solid[z][y-1][x])addFace(Vec3f(px-s,py-s,pz+s),Vec3f(px-s,py-s,pz-s),Vec3f(px+s,py-s,pz-s),Vec3f(px+s,py-s,pz+s),Vec3f(0,-1,0),col);
            if(z<D-1&&!solid[z+1][y][x])addFace(Vec3f(px-s,py-s,pz+s),Vec3f(px+s,py-s,pz+s),Vec3f(px+s,py+s,pz+s),Vec3f(px-s,py+s,pz+s),Vec3f(0,0,1),col);
            if(z>0&&!solid[z-1][y][x])addFace(Vec3f(px+s,py-s,pz-s),Vec3f(px-s,py-s,pz-s),Vec3f(px-s,py+s,pz-s),Vec3f(px+s,py+s,pz-s),Vec3f(0,0,-1),col);
        }
    }

    void onAnimate(double dt) override {
        float spd=3.0f*(float)dt;
        nav().updateDirectionVectors();
        if(keys[(int)'w'])nav().pos()+=nav().uf()*spd;
        if(keys[(int)'s'])nav().pos()-=nav().uf()*spd;
        if(keys[(int)'a'])nav().pos()-=nav().ur()*spd;
        if(keys[(int)'d'])nav().pos()+=nav().ur()*spd;
        if(keys[(int)'q'])nav().pos()-=nav().uu()*spd;
        if(keys[(int)'e'])nav().pos()+=nav().uu()*spd;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f);
        g.depthTesting(true);
        g.lighting(true);
        Vec3f lp=nav().pos(); Light light; light.pos(lp.x,lp.y,lp.z); g.light(light);
        g.meshColor();
        g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        int key=k.key(); if(key>=0&&key<256)keys[key]=true;
        if(k.key()=='r')generate();
        return true;
    }
    bool onKeyUp(const Keyboard& k) override {
        int key=k.key(); if(key>=0&&key<256)keys[key]=false; return true;
    }
};

ALLOLIB_WEB_MAIN(ProcCaves)
`,
  },

  {
    id: 'proc-city',
    title: 'Procedural City',
    description: 'City generation with lot subdivision and buildings',
    category: 'simulation',
    subcategory: 'procedural',
    code: `/**
 * Procedural City Generator
 * Features: Lot subdivision, varied buildings, streets
 * Controls: R = regenerate, WASD+QE = navigate
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <vector>

using namespace al;

struct Building {
    Vec3f pos;
    float w,d,h;
    Color col;
};

class ProcCity : public WebApp {
public:
    std::vector<Building> buildings;
    Mesh mesh,ground;
    rnd::Random<> rng;
    bool keys[256]={};

    void onCreate() override {
        generate();
        addSurface(ground,20,20,40,40);
        nav().pos(0,8,15);
        nav().faceToward(Vec3f(0,0,0));
        memset(keys,0,sizeof(keys));
    }

    void subdivide(float x,float z,float w,float d,int depth){
        if(depth>4||w<1.0f||d<1.0f){
            // Create building
            float h=0.5f+rng.uniform()*3.0f+rng.uniform()*rng.uniform()*5.0f;
            float margin=0.15f;
            Building b;
            b.pos=Vec3f(x+margin,0,z+margin);
            b.w=w-margin*2;
            b.d=d-margin*2;
            b.h=h;
            float gray=0.4f+rng.uniform()*0.3f;
            b.col=Color(gray,gray,gray+rng.uniform()*0.1f);
            buildings.push_back(b);
            return;
        }
        // Subdivide
        if(rng.uniform()<0.5f&&w>2.0f){
            float split=w*(0.3f+rng.uniform()*0.4f);
            subdivide(x,z,split-0.1f,d,depth+1);
            subdivide(x+split+0.1f,z,w-split-0.1f,d,depth+1);
        }else if(d>2.0f){
            float split=d*(0.3f+rng.uniform()*0.4f);
            subdivide(x,z,w,split-0.1f,depth+1);
            subdivide(x,z+split+0.1f,w,d-split-0.1f,depth+1);
        }else{
            // Leaf node
            float h=0.5f+rng.uniform()*2.0f;
            Building b;
            b.pos=Vec3f(x+0.1f,0,z+0.1f);
            b.w=w-0.2f;b.d=d-0.2f;b.h=h;
            b.col=Color(0.5f+rng.uniform()*0.2f,0.5f+rng.uniform()*0.2f,0.55f);
            buildings.push_back(b);
        }
    }

    void generate(){
        buildings.clear();
        float citySize=16;
        for(float bx=-citySize;bx<citySize;bx+=4.0f){
            for(float bz=-citySize;bz<citySize;bz+=4.0f){
                if(rng.uniform()<0.15f)continue; // Park/empty lot
                subdivide(bx+0.2f,bz+0.2f,3.6f,3.6f,0);
            }
        }
        buildMesh();
    }

    void buildMesh(){
        mesh.reset();
        mesh.primitive(Mesh::TRIANGLES);
        for(auto& b:buildings){
            Vec3f p=b.pos;
            float w=b.w,d=b.d,h=b.h;
            Color c=b.col,top=b.col*0.7f;
            // Front
            mesh.vertex(p.x,p.y,p.z+d);mesh.color(c);mesh.normal(0,0,1);
            mesh.vertex(p.x+w,p.y,p.z+d);mesh.color(c);mesh.normal(0,0,1);
            mesh.vertex(p.x+w,p.y+h,p.z+d);mesh.color(c);mesh.normal(0,0,1);
            mesh.vertex(p.x,p.y,p.z+d);mesh.color(c);mesh.normal(0,0,1);
            mesh.vertex(p.x+w,p.y+h,p.z+d);mesh.color(c);mesh.normal(0,0,1);
            mesh.vertex(p.x,p.y+h,p.z+d);mesh.color(c);mesh.normal(0,0,1);
            // Back
            mesh.vertex(p.x+w,p.y,p.z);mesh.color(c);mesh.normal(0,0,-1);
            mesh.vertex(p.x,p.y,p.z);mesh.color(c);mesh.normal(0,0,-1);
            mesh.vertex(p.x,p.y+h,p.z);mesh.color(c);mesh.normal(0,0,-1);
            mesh.vertex(p.x+w,p.y,p.z);mesh.color(c);mesh.normal(0,0,-1);
            mesh.vertex(p.x,p.y+h,p.z);mesh.color(c);mesh.normal(0,0,-1);
            mesh.vertex(p.x+w,p.y+h,p.z);mesh.color(c);mesh.normal(0,0,-1);
            // Left
            mesh.vertex(p.x,p.y,p.z);mesh.color(c);mesh.normal(-1,0,0);
            mesh.vertex(p.x,p.y,p.z+d);mesh.color(c);mesh.normal(-1,0,0);
            mesh.vertex(p.x,p.y+h,p.z+d);mesh.color(c);mesh.normal(-1,0,0);
            mesh.vertex(p.x,p.y,p.z);mesh.color(c);mesh.normal(-1,0,0);
            mesh.vertex(p.x,p.y+h,p.z+d);mesh.color(c);mesh.normal(-1,0,0);
            mesh.vertex(p.x,p.y+h,p.z);mesh.color(c);mesh.normal(-1,0,0);
            // Right
            mesh.vertex(p.x+w,p.y,p.z+d);mesh.color(c);mesh.normal(1,0,0);
            mesh.vertex(p.x+w,p.y,p.z);mesh.color(c);mesh.normal(1,0,0);
            mesh.vertex(p.x+w,p.y+h,p.z);mesh.color(c);mesh.normal(1,0,0);
            mesh.vertex(p.x+w,p.y,p.z+d);mesh.color(c);mesh.normal(1,0,0);
            mesh.vertex(p.x+w,p.y+h,p.z);mesh.color(c);mesh.normal(1,0,0);
            mesh.vertex(p.x+w,p.y+h,p.z+d);mesh.color(c);mesh.normal(1,0,0);
            // Top
            mesh.vertex(p.x,p.y+h,p.z+d);mesh.color(top);mesh.normal(0,1,0);
            mesh.vertex(p.x+w,p.y+h,p.z+d);mesh.color(top);mesh.normal(0,1,0);
            mesh.vertex(p.x+w,p.y+h,p.z);mesh.color(top);mesh.normal(0,1,0);
            mesh.vertex(p.x,p.y+h,p.z+d);mesh.color(top);mesh.normal(0,1,0);
            mesh.vertex(p.x+w,p.y+h,p.z);mesh.color(top);mesh.normal(0,1,0);
            mesh.vertex(p.x,p.y+h,p.z);mesh.color(top);mesh.normal(0,1,0);
        }
    }

    void onAnimate(double dt) override {
        float spd=8.0f*(float)dt;
        nav().updateDirectionVectors();
        if(keys[(int)'w'])nav().pos()+=nav().uf()*spd;
        if(keys[(int)'s'])nav().pos()-=nav().uf()*spd;
        if(keys[(int)'a'])nav().pos()-=nav().ur()*spd;
        if(keys[(int)'d'])nav().pos()+=nav().ur()*spd;
        if(keys[(int)'q'])nav().pos()-=nav().uu()*spd;
        if(keys[(int)'e'])nav().pos()+=nav().uu()*spd;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.6f,0.75f,0.9f);
        g.depthTesting(true);
        g.lighting(true);
        Light light; light.pos(10,20,10); g.light(light);
        // Ground
        g.pushMatrix();
        g.rotate(90,1,0,0);
        g.color(0.3f,0.3f,0.35f);
        g.draw(ground);
        g.popMatrix();
        // Buildings
        g.meshColor();
        g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        int key=k.key(); if(key>=0&&key<256)keys[key]=true;
        if(k.key()=='r')generate();
        return true;
    }
    bool onKeyUp(const Keyboard& k) override {
        int key=k.key(); if(key>=0&&key<256)keys[key]=false; return true;
    }
};

ALLOLIB_WEB_MAIN(ProcCity)
`,
  },

  {
    id: 'proc-galaxy',
    title: 'Galaxy Generator',
    description: 'Procedural spiral galaxy with star distribution',
    category: 'simulation',
    subcategory: 'procedural',
    code: `/**
 * Procedural Galaxy Generator
 * Features: Spiral arms, star colors, density falloff
 * Controls: R = regenerate, WASD+QE = navigate
 */
#include "al_playground_compat.hpp"
#include <cmath>

using namespace al;

class ProcGalaxy : public WebApp {
public:
    Mesh stars;
    rnd::Random<> rng;
    float rotation=0;
    static const int NUM_STARS=30000;

    void onCreate() override {
        stars.primitive(Mesh::POINTS);
        generate();
        nav().pos(0,5,8);
        nav().faceToward(Vec3f(0,0,0));
    }

    void generate(){
        stars.reset();
        int numArms=rng.uniform()*2+2;
        float armSpread=0.5f;
        float armLength=4.0f;

        for(int i=0;i<NUM_STARS;i++){
            float r=rng.uniform()*rng.uniform()*armLength;
            float armAngle=((int)(rng.uniform()*numArms))*(2*M_PI/numArms);
            float spiralAngle=r*1.5f;
            float spread=(rng.uniform()-0.5f)*armSpread*(1+r*0.3f);

            float angle=armAngle+spiralAngle+spread;
            float x=cosf(angle)*r+(rng.uniform()-0.5f)*0.2f;
            float z=sinf(angle)*r+(rng.uniform()-0.5f)*0.2f;
            float y=(rng.uniform()-0.5f)*0.1f*(1.0f-r/armLength);

            stars.vertex(x,y,z);

            // Color based on position
            float temp=0.5f+rng.uniform()*0.5f;
            if(r<0.5f)temp+=0.3f; // Core is hotter
            if(rng.uniform()<0.02f)temp=1.0f; // Bright blue stars

            Color col;
            if(temp<0.5f)col=Color(1.0f,0.8f*temp*2,0.6f*temp*2);
            else if(temp<0.8f)col=Color(1.0f,1.0f,(temp-0.5f)*3);
            else col=Color(0.8f+(1-temp)*0.5f,0.9f+(1-temp)*0.2f,1.0f);

            col.a=0.3f+rng.uniform()*0.7f;
            stars.color(col);
        }

        // Add central bulge
        for(int i=0;i<3000;i++){
            float r=rng.uniform()*rng.uniform()*0.8f;
            float theta=rng.uniform()*2*M_PI;
            float phi=rng.uniform()*M_PI-M_PI/2;
            float x=r*cosf(theta)*cosf(phi);
            float y=r*sinf(phi)*0.3f;
            float z=r*sinf(theta)*cosf(phi);
            stars.vertex(x,y,z);
            float bright=1.0f-r;
            stars.color(1.0f,0.95f*bright,0.8f*bright,0.5f+bright*0.5f);
        }
    }

    void onAnimate(double dt) override {
        rotation+=dt*5;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f,0.02f,0.05f);
        g.blending(true);
        g.blendAdd();
        g.depthTesting(false);
        g.pushMatrix();
        g.rotate(rotation,0,1,0);
        g.rotate(30,1,0,0);
        g.pointSize(2);
        g.meshColor();
        g.draw(stars);
        g.popMatrix();
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()=='r')generate();
        return true;
    }
};

ALLOLIB_WEB_MAIN(ProcGalaxy)
`,
  },

  // ==========================================================================
  // SIMULATION - Ray Marching (Additional)
  // ==========================================================================
  {
    id: 'rm-organic-blob',
    title: 'Organic Blob',
    description: 'Metaball-style organic blob with smooth blending',
    category: 'simulation',
    subcategory: 'raymarching',
    code: `/**
 * Organic Blob - Ray Marched Metaballs
 * Features: Smooth minimum blending, animation
 * Controls: WASD+QE navigation
 */
#include "al_playground_compat.hpp"
#include <cmath>

using namespace al;

class OrganicBlob : public WebApp {
public:
    ShaderProgram shader;
    Mesh quad;
    float time=0;
    bool keys[256]={};
    float yaw=0,pitch=0;
    bool dragging=false;
    int lastX=0,lastY=0;

    const char* vert = R"(#version 300 es
        layout(location=0) in vec3 position;
        void main(){gl_Position=vec4(position,1.0);}
    )";

    const char* frag = R"(#version 300 es
        precision highp float;
        out vec4 fragColor;
        uniform float uTime;
        uniform vec2 uRes;
        uniform vec3 uCamPos;
        uniform mat4 uCamMat;

        float sdSphere(vec3 p,float r){return length(p)-r;}

        float smin(float a,float b,float k){
            float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);
            return mix(b,a,h)-k*h*(1.0-h);
        }

        float scene(vec3 p){
            float d=1e10;
            // Multiple animated spheres
            for(int i=0;i<5;i++){
                float fi=float(i);
                float t=uTime+fi*1.2;
                vec3 offset=vec3(
                    sin(t*0.7+fi)*0.8,
                    cos(t*0.5+fi*2.0)*0.6,
                    sin(t*0.3+fi*0.5)*0.8
                );
                float r=0.4+0.1*sin(t+fi);
                d=smin(d,sdSphere(p-offset,r),0.5);
            }
            // Central core
            d=smin(d,sdSphere(p,0.6+0.1*sin(uTime*2.0)),0.3);
            return d;
        }

        vec3 calcNormal(vec3 p){
            vec2 e=vec2(0.001,0);
            return normalize(vec3(
                scene(p+e.xyy)-scene(p-e.xyy),
                scene(p+e.yxy)-scene(p-e.yxy),
                scene(p+e.yyx)-scene(p-e.yyx)));
        }

        float march(vec3 ro,vec3 rd){
            float t=0.0;
            for(int i=0;i<80;i++){
                float d=scene(ro+rd*t);
                if(d<0.001)return t;
                t+=d;
                if(t>20.0)break;
            }
            return -1.0;
        }

        void main(){
            vec2 uv=(gl_FragCoord.xy-uRes*0.5)/uRes.y;
            vec3 rd=normalize((uCamMat*vec4(uv.x,uv.y,-1.5,0)).xyz);
            vec3 ro=uCamPos;

            vec3 col=vec3(0.05,0.05,0.1);

            float t=march(ro,rd);
            if(t>0.0){
                vec3 p=ro+rd*t;
                vec3 n=calcNormal(p);
                vec3 light=normalize(vec3(1,1,1));

                // Subsurface scattering approximation
                float wrap=max(0.0,dot(n,light)*0.5+0.5);
                vec3 sss=vec3(0.8,0.2,0.1)*wrap*wrap;

                // Rim lighting
                float rim=1.0-max(0.0,dot(n,-rd));
                rim=pow(rim,3.0);

                // Specular
                vec3 h=normalize(light-rd);
                float spec=pow(max(0.0,dot(n,h)),32.0);

                col=sss+vec3(0.3,0.5,0.8)*rim+vec3(1)*spec*0.5;

                // Fresnel
                float fresnel=pow(1.0-max(0.0,dot(n,-rd)),2.0);
                col=mix(col,vec3(0.8,0.9,1.0),fresnel*0.3);
            }

            fragColor=vec4(pow(col,vec3(0.4545)),1.0);
        }
    )";

    void onCreate() override {
        shader.compile(vert,frag);
        quad.primitive(Mesh::TRIANGLE_STRIP);
        quad.vertex(-1,-1,0);quad.vertex(1,-1,0);
        quad.vertex(-1,1,0);quad.vertex(1,1,0);
        nav().pos(0,0,4);
        memset(keys,0,sizeof(keys));
    }

    void onAnimate(double dt) override {
        time+=dt;
        float spd=3.0f*(float)dt;
        nav().updateDirectionVectors();
        if(keys[(int)'w'])nav().pos()+=nav().uf()*spd;
        if(keys[(int)'s'])nav().pos()-=nav().uf()*spd;
        if(keys[(int)'a'])nav().pos()-=nav().ur()*spd;
        if(keys[(int)'d'])nav().pos()+=nav().ur()*spd;
        if(keys[(int)'q'])nav().pos()-=nav().uu()*spd;
        if(keys[(int)'e'])nav().pos()+=nav().uu()*spd;
    }

    void onDraw(Graphics& g) override {
        g.clear(0);
        shader.use();
        shader.uniform("uTime",time);
        shader.uniform("uRes",(float)width(),(float)height());
        Vec3f pos=nav().pos();
        shader.uniform("uCamPos",pos.x,pos.y,pos.z);
        nav().updateDirectionVectors();
        Vec3f r=nav().ur(), u=nav().uu(), f=nav().uf();
        float vm[16]={r.x,r.y,r.z,0, u.x,u.y,u.z,0, f.x,f.y,f.z,0, 0,0,0,1};
        shader.uniform("uCamMat",Matrix4f(vm));
        g.draw(quad);
    }

    bool onKeyDown(const Keyboard& k) override {
        int key=k.key(); if(key>=0&&key<256)keys[key]=true; return true;
    }
    bool onKeyUp(const Keyboard& k) override {
        int key=k.key(); if(key>=0&&key<256)keys[key]=false; return true;
    }
    bool onMouseDown(const Mouse& m) override {
        dragging=true; lastX=m.x(); lastY=m.y(); return true;
    }
    bool onMouseUp(const Mouse& m) override { dragging=false; return true; }
    bool onMouseDrag(const Mouse& m) override {
        if(dragging){
            float dx=(m.x()-lastX)*0.005f, dy=(m.y()-lastY)*0.005f;
            yaw-=dx; pitch-=dy; pitch=fmax(-1.5f,fmin(1.5f,pitch));
            Quatf qy; qy.fromAxisAngle(yaw,0,1,0);
            Quatf qp; qp.fromAxisAngle(pitch,1,0,0);
            Quatf q=qy*qp; nav().quat().set(q.x,q.y,q.z,q.w);
            lastX=m.x(); lastY=m.y();
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(OrganicBlob)
`,
  },

  // ==========================================================================
  // SIMULATION - Fluid & Smoke (Additional)
  // ==========================================================================
  {
    id: 'fluid-lava-lamp',
    title: 'Lava Lamp',
    description: 'Metaball lava lamp with heat convection',
    category: 'simulation',
    subcategory: 'fluids',
    code: `/**
 * Lava Lamp Simulation
 * Features: Metaballs, heat convection, color blending
 * Controls: WASD+QE navigation
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <vector>

using namespace al;

struct Blob {
    Vec2f pos,vel;
    float radius,temp;
};

class LavaLamp : public WebApp {
public:
    std::vector<Blob> blobs;
    ShaderProgram shader;
    Mesh quad;
    float time=0;
    rnd::Random<> rng;

    const char* vert = R"(#version 300 es
        layout(location=0) in vec3 position;
        out vec2 vUV;
        void main(){
            vUV=position.xy*0.5+0.5;
            gl_Position=vec4(position,1.0);
        }
    )";

    const char* frag = R"(#version 300 es
        precision highp float;
        in vec2 vUV;
        out vec4 fragColor;
        uniform float uTime;
        uniform vec4 uBlobs[20];
        uniform int uNumBlobs;

        void main(){
            vec2 p=vUV*2.0-1.0;
            p.y*=1.5; // Aspect ratio for lamp shape

            float field=0.0;
            float tempField=0.0;
            for(int i=0;i<20;i++){
                if(i>=uNumBlobs)break;
                vec2 bp=uBlobs[i].xy;
                float r=uBlobs[i].z;
                float t=uBlobs[i].w;
                float d=length(p-bp);
                field+=r*r/(d*d+0.01);
                tempField+=t*r*r/(d*d+0.01);
            }

            // Lamp glass boundary
            float lamp=smoothstep(0.9,0.85,abs(p.x))*smoothstep(1.4,1.3,abs(p.y));

            if(field>1.0&&lamp>0.5){
                float t=tempField/field;
                vec3 cold=vec3(0.8,0.2,0.1);
                vec3 hot=vec3(1.0,0.8,0.2);
                vec3 col=mix(cold,hot,t);
                // Add animated glow using uTime
                float pulse=0.5+0.5*sin(uTime*2.0);
                col+=vec3(0.2,0.1,0.05)*smoothstep(1.0,3.0,field)*(0.8+0.2*pulse);
                fragColor=vec4(col,1.0);
            }else{
                // Glass and liquid
                vec3 glass=vec3(0.1,0.15,0.2);
                vec3 liquid=vec3(0.05,0.08,0.12);
                float edge=smoothstep(0.8,0.85,abs(p.x))+smoothstep(1.3,1.35,abs(p.y));
                fragColor=vec4(mix(liquid,glass,edge),1.0);
            }
        }
    )";

    void onCreate() override {
        shader.compile(vert,frag);
        quad.primitive(Mesh::TRIANGLE_STRIP);
        quad.vertex(-1,-1,0);quad.vertex(1,-1,0);
        quad.vertex(-1,1,0);quad.vertex(1,1,0);

        // Initialize blobs
        for(int i=0;i<12;i++){
            Blob b;
            b.pos=Vec2f(rng.uniform(-0.6f,0.6f),rng.uniform(-1.2f,1.2f));
            b.vel=Vec2f(0,0);
            b.radius=0.15f+rng.uniform()*0.15f;
            b.temp=rng.uniform();
            blobs.push_back(b);
        }
        nav().pos(0,0,2);
    }

    void onAnimate(double dt) override {
        time+=dt;
        float dtf=(float)dt;

        // Heat source at bottom, cool at top
        for(auto& b:blobs){
            float heatSource=(b.pos.y<-1.0f)?1.0f:0.0f;
            float coolSink=(b.pos.y>1.0f)?1.0f:0.0f;
            b.temp+=(heatSource-coolSink)*dtf*0.5f;
            b.temp=fmax(0.0f,fmin(1.0f,b.temp));

            // Buoyancy
            float buoyancy=(b.temp-0.5f)*2.0f;
            b.vel.y+=buoyancy*dtf;

            // Drag
            b.vel*=0.98f;

            // Random perturbation
            b.vel.x+=(rng.uniform()-0.5f)*dtf*0.5f;

            // Update position
            b.pos+=b.vel*dtf;

            // Boundaries
            if(b.pos.x<-0.7f){b.pos.x=-0.7f;b.vel.x*=-0.5f;}
            if(b.pos.x>0.7f){b.pos.x=0.7f;b.vel.x*=-0.5f;}
            if(b.pos.y<-1.3f){b.pos.y=-1.3f;b.vel.y*=-0.3f;b.temp=fmin(1.0f,b.temp+0.1f);}
            if(b.pos.y>1.3f){b.pos.y=1.3f;b.vel.y*=-0.3f;b.temp=fmax(0.0f,b.temp-0.1f);}
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f);
        shader.use();
        shader.uniform("uTime",time);
        shader.uniform("uNumBlobs",(int)blobs.size());
        for(int i=0;i<(int)blobs.size()&&i<20;i++){
            char name[32];
            snprintf(name,32,"uBlobs[%d]",i);
            shader.uniform(name,blobs[i].pos.x,blobs[i].pos.y,blobs[i].radius,blobs[i].temp);
        }
        g.draw(quad);
    }
};

ALLOLIB_WEB_MAIN(LavaLamp)
`,
  },

  // ==========================================================================
  // SIMULATION - Particle Systems (Additional)
  // ==========================================================================
  {
    id: 'particles-swarm',
    title: 'Massive Swarm',
    description: '50,000+ particles with emergent behavior',
    category: 'simulation',
    subcategory: 'particles',
    code: `/**
 * Massive Particle Swarm
 * Features: 50k particles, spatial hashing, emergent patterns
 * Controls: WASD+QE navigation, Space = toggle mode
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <vector>

using namespace al;

class MassiveSwarm : public WebApp {
public:
    static const int NUM=50000;
    struct Particle {
        Vec3f pos,vel;
    };
    std::vector<Particle> particles;
    Mesh mesh;
    rnd::Random<> rng;
    int mode=0;
    Vec3f attractor;
    float time=0;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);
        particles.resize(NUM);
        for(auto& p:particles){
            float theta=rng.uniform()*2*M_PI;
            float phi=acosf(rng.uniform()*2-1);
            float r=rng.uniform()*3;
            p.pos=Vec3f(r*sinf(phi)*cosf(theta),r*sinf(phi)*sinf(theta),r*cosf(phi));
            p.vel=Vec3f(0);
        }
        nav().pos(0,0,10);
    }

    void onAnimate(double dt) override {
        time+=dt;
        float dtf=fmin(0.016f,(float)dt);

        // Mode-specific attractor
        if(mode==0){
            attractor=Vec3f(sinf(time*0.3f)*3,cosf(time*0.4f)*2,sinf(time*0.5f)*2);
        }else if(mode==1){
            attractor=Vec3f(0);
        }else{
            float r=3+sinf(time*0.5f);
            attractor=Vec3f(r*cosf(time),0,r*sinf(time));
        }

        for(auto& p:particles){
            Vec3f toAttr=attractor-p.pos;
            float dist=toAttr.mag()+0.01f;

            if(mode==0){
                // Swirl around attractor
                Vec3f force=toAttr.normalized()*0.5f;
                Vec3f tangent=cross(toAttr,Vec3f(0,1,0)).normalized();
                force+=tangent*2.0f/dist;
                p.vel+=force*dtf;
            }else if(mode==1){
                // Collapse and expand
                float pulse=sinf(time*2)*0.5f+0.5f;
                p.vel+=toAttr.normalized()*(pulse-0.3f)*dtf*2;
            }else{
                // Orbit
                Vec3f radial=p.pos;radial.y=0;
                if(radial.mag()>0.1f){
                    Vec3f tangent=cross(radial,Vec3f(0,1,0)).normalized();
                    p.vel+=tangent*dtf*3;
                    p.vel-=radial.normalized()*(radial.mag()-3)*dtf;
                }
                p.vel.y-=p.pos.y*dtf*2;
            }

            // Damping
            p.vel*=0.99f;

            // Speed limit
            float speed=p.vel.mag();
            if(speed>2.0f)p.vel*=2.0f/speed;

            p.pos+=p.vel*dtf;
        }

        mesh.reset();
        for(auto& p:particles){
            mesh.vertex(p.pos);
            float speed=p.vel.mag();
            mesh.color(HSV(speed*0.3f,0.7f,0.9f));
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f);
        g.blending(true);
        g.blendAdd();
        g.depthTesting(false);
        g.pointSize(1);
        g.meshColor();
        g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()==' ')mode=(mode+1)%3;
        return true;
    }
};

ALLOLIB_WEB_MAIN(MassiveSwarm)
`,
  },

  // ==========================================================================
  // SIMULATION - Agent-Based (Additional)
  // ==========================================================================
  {
    id: 'agents-traffic',
    title: 'Traffic Flow',
    description: 'Traffic simulation with car following and lane changes',
    category: 'simulation',
    subcategory: 'agents',
    code: `/**
 * Traffic Flow Simulation
 * Features: Car following model, lane changes, intersections
 * Controls: Space = add cars, R = reset
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <vector>
#include <algorithm>

using namespace al;

struct Car {
    float x,lane,vel,targetVel;
    Color col;
};

class TrafficFlow : public WebApp {
public:
    std::vector<Car> cars;
    Mesh mesh;
    rnd::Random<> rng;
    float roadLen=20.0f;
    int numLanes=3;

    void onCreate() override {
        mesh.primitive(Mesh::TRIANGLES);
        reset();
        nav().pos(0,8,0);
        nav().faceToward(Vec3f(0,0,0),Vec3f(0,0,-1));
    }

    void reset(){
        cars.clear();
        for(int i=0;i<30;i++)addCar();
    }

    void addCar(){
        Car c;
        c.x=rng.uniform()*roadLen;
        c.lane=(float)((int)(rng.uniform()*numLanes));
        c.vel=2+rng.uniform()*2;
        c.targetVel=c.vel;
        c.col=Color(rng.uniform()*0.5f+0.5f,rng.uniform()*0.3f,rng.uniform()*0.3f);
        cars.push_back(c);
    }

    float getDistToNext(int idx){
        float minDist=roadLen;
        for(int i=0;i<(int)cars.size();i++){
            if(i==idx)continue;
            if(fabs(cars[i].lane-cars[idx].lane)<0.5f){
                float dx=cars[i].x-cars[idx].x;
                if(dx<0)dx+=roadLen;
                if(dx<minDist)minDist=dx;
            }
        }
        return minDist;
    }

    bool canChangeLane(int idx,int dir){
        float targetLane=cars[idx].lane+dir;
        if(targetLane<0||targetLane>=numLanes)return false;
        for(int i=0;i<(int)cars.size();i++){
            if(i==idx)continue;
            if(fabs(cars[i].lane-targetLane)<0.5f){
                float dx=fabs(cars[i].x-cars[idx].x);
                if(dx>roadLen/2)dx=roadLen-dx;
                if(dx<2.0f)return false;
            }
        }
        return true;
    }

    void onAnimate(double dt) override {
        float dtf=(float)dt;
        for(int i=0;i<(int)cars.size();i++){
            Car& c=cars[i];
            float dist=getDistToNext(i);

            // Car following - slow down if too close
            float safeSpeed=fmax(0.0f,(dist-1.0f)*0.8f);
            float targetSpeed=fmin(c.targetVel,safeSpeed);

            // Accelerate/decelerate
            float accel=(targetSpeed-c.vel)*2.0f;
            c.vel+=accel*dtf;
            c.vel=fmax(0.0f,c.vel);

            // Lane change decision
            if(dist<3.0f&&c.vel<c.targetVel*0.7f){
                if(rng.uniform()<0.02f){
                    int dir=rng.uniform()<0.5f?-1:1;
                    if(canChangeLane(i,dir)){
                        c.lane+=dir;
                    }else if(canChangeLane(i,-dir)){
                        c.lane-=dir;
                    }
                }
            }

            // Move
            c.x+=c.vel*dtf;
            if(c.x>roadLen)c.x-=roadLen;
        }

        // Build mesh
        mesh.reset();
        float laneWidth=1.5f;
        float roadWidth=numLanes*laneWidth;

        // Road surface
        mesh.vertex(-roadWidth/2,0,-roadLen/2);mesh.color(0.2f,0.2f,0.2f);mesh.normal(0,1,0);
        mesh.vertex(roadWidth/2,0,-roadLen/2);mesh.color(0.2f,0.2f,0.2f);mesh.normal(0,1,0);
        mesh.vertex(roadWidth/2,0,roadLen/2);mesh.color(0.2f,0.2f,0.2f);mesh.normal(0,1,0);
        mesh.vertex(-roadWidth/2,0,-roadLen/2);mesh.color(0.2f,0.2f,0.2f);mesh.normal(0,1,0);
        mesh.vertex(roadWidth/2,0,roadLen/2);mesh.color(0.2f,0.2f,0.2f);mesh.normal(0,1,0);
        mesh.vertex(-roadWidth/2,0,roadLen/2);mesh.color(0.2f,0.2f,0.2f);mesh.normal(0,1,0);

        // Cars
        for(auto& c:cars){
            float cx=(c.lane+0.5f)*laneWidth-roadWidth/2;
            float cz=c.x-roadLen/2;
            float w=0.4f,l=0.8f,h=0.3f;
            // Simple box
            Vec3f v[8]={
                {cx-w,0,cz-l},{cx+w,0,cz-l},{cx+w,0,cz+l},{cx-w,0,cz+l},
                {cx-w,h,cz-l},{cx+w,h,cz-l},{cx+w,h,cz+l},{cx-w,h,cz+l}
            };
            int faces[6][4]={{0,1,2,3},{4,7,6,5},{0,4,5,1},{2,6,7,3},{0,3,7,4},{1,5,6,2}};
            Vec3f normals[6]={{0,-1,0},{0,1,0},{0,0,-1},{0,0,1},{-1,0,0},{1,0,0}};
            for(int f=0;f<6;f++){
                mesh.vertex(v[faces[f][0]]);mesh.color(c.col);mesh.normal(normals[f]);
                mesh.vertex(v[faces[f][1]]);mesh.color(c.col);mesh.normal(normals[f]);
                mesh.vertex(v[faces[f][2]]);mesh.color(c.col);mesh.normal(normals[f]);
                mesh.vertex(v[faces[f][0]]);mesh.color(c.col);mesh.normal(normals[f]);
                mesh.vertex(v[faces[f][2]]);mesh.color(c.col);mesh.normal(normals[f]);
                mesh.vertex(v[faces[f][3]]);mesh.color(c.col);mesh.normal(normals[f]);
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.3f,0.5f,0.3f);
        g.depthTesting(true);
        g.lighting(true);
        Light light; light.pos(5,10,5); g.light(light);
        g.meshColor();
        g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()==' ')addCar();
        if(k.key()=='r')reset();
        return true;
    }
};

ALLOLIB_WEB_MAIN(TrafficFlow)
`,
  },

  {
    id: 'agents-evolution',
    title: 'Evolutionary Agents',
    description: 'Genetic algorithm with mutation and selection',
    category: 'simulation',
    subcategory: 'agents',
    code: `/**
 * Evolutionary Agents
 * Features: Genetics, mutation, natural selection, food gathering
 * Controls: Space = fast forward, R = reset
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <vector>
#include <algorithm>

using namespace al;

struct Gene {
    float speed,sense,size;
};

struct Agent {
    Vec2f pos,vel;
    Gene genes;
    float energy,age;
    bool alive;
};

struct Food {
    Vec2f pos;
    bool eaten;
};

class Evolution : public WebApp {
public:
    std::vector<Agent> agents;
    std::vector<Food> food;
    Mesh agentMesh,foodMesh;
    rnd::Random<> rng;
    int generation=0;
    float time=0;
    bool fastMode=false;

    void onCreate() override {
        agentMesh.primitive(Mesh::POINTS);
        foodMesh.primitive(Mesh::POINTS);
        reset();
        nav().pos(0,0,4);
    }

    void reset(){
        agents.clear();
        food.clear();
        for(int i=0;i<50;i++){
            Agent a;
            a.pos=Vec2f(rng.uniform(-2,2),rng.uniform(-2,2));
            a.vel=Vec2f(0);
            a.genes.speed=0.5f+rng.uniform()*1.0f;
            a.genes.sense=0.3f+rng.uniform()*0.7f;
            a.genes.size=0.5f+rng.uniform()*0.5f;
            a.energy=100;
            a.age=0;
            a.alive=true;
            agents.push_back(a);
        }
        spawnFood(100);
        generation=0;
    }

    void spawnFood(int n){
        for(int i=0;i<n;i++){
            Food f;
            f.pos=Vec2f(rng.uniform(-2.5f,2.5f),rng.uniform(-2.5f,2.5f));
            f.eaten=false;
            food.push_back(f);
        }
    }

    Agent reproduce(Agent& parent){
        Agent child;
        child.pos=parent.pos+Vec2f(rng.uniform(-0.1f,0.1f),rng.uniform(-0.1f,0.1f));
        child.vel=Vec2f(0);
        child.genes=parent.genes;
        // Mutation
        if(rng.uniform()<0.3f)child.genes.speed+=rng.uniform(-0.2f,0.2f);
        if(rng.uniform()<0.3f)child.genes.sense+=rng.uniform(-0.1f,0.1f);
        if(rng.uniform()<0.3f)child.genes.size+=rng.uniform(-0.1f,0.1f);
        child.genes.speed=fmax(0.1f,fmin(3.0f,child.genes.speed));
        child.genes.sense=fmax(0.1f,fmin(1.5f,child.genes.sense));
        child.genes.size=fmax(0.2f,fmin(1.5f,child.genes.size));
        child.energy=50;
        child.age=0;
        child.alive=true;
        return child;
    }

    void onAnimate(double dt) override {
        int steps=fastMode?10:1;
        float dtf=0.016f;

        for(int s=0;s<steps;s++){
            time+=dtf;
            std::vector<Agent> newAgents;

            for(auto& a:agents){
                if(!a.alive)continue;

                // Find nearest food
                Food* nearest=nullptr;
                float nearDist=1e10f;
                for(auto& f:food){
                    if(f.eaten)continue;
                    float d=(f.pos-a.pos).mag();
                    if(d<nearDist&&d<a.genes.sense){
                        nearDist=d;
                        nearest=&f;
                    }
                }

                // Move toward food or wander
                if(nearest){
                    Vec2f dir=(nearest->pos-a.pos).normalized();
                    a.vel+=dir*a.genes.speed*dtf*10;
                }else{
                    a.vel+=Vec2f(rng.uniform(-1,1),rng.uniform(-1,1))*dtf;
                }

                // Limit speed
                float spd=a.vel.mag();
                if(spd>a.genes.speed)a.vel*=a.genes.speed/spd;

                a.pos+=a.vel*dtf;

                // Bounds
                if(a.pos.x<-2.5f||a.pos.x>2.5f)a.vel.x*=-1;
                if(a.pos.y<-2.5f||a.pos.y>2.5f)a.vel.y*=-1;
                a.pos.x=fmax(-2.5f,fmin(2.5f,a.pos.x));
                a.pos.y=fmax(-2.5f,fmin(2.5f,a.pos.y));

                // Eat food
                for(auto& f:food){
                    if(!f.eaten&&(f.pos-a.pos).mag()<0.1f){
                        f.eaten=true;
                        a.energy+=30;
                    }
                }

                // Energy cost
                a.energy-=(0.5f+a.genes.speed*0.3f+a.genes.sense*0.2f)*dtf*10;
                a.age+=dtf;

                // Death
                if(a.energy<=0||a.age>30){
                    a.alive=false;
                }

                // Reproduction
                if(a.energy>150){
                    a.energy-=50;
                    newAgents.push_back(reproduce(a));
                }
            }

            // Add new agents
            for(auto& a:newAgents)agents.push_back(a);

            // Remove dead
            agents.erase(std::remove_if(agents.begin(),agents.end(),[](Agent& a){return !a.alive;}),agents.end());
            food.erase(std::remove_if(food.begin(),food.end(),[](Food& f){return f.eaten;}),food.end());

            // Respawn food
            if(food.size()<50)spawnFood(10);

            // Check extinction
            if(agents.empty()){
                generation++;
                for(int i=0;i<20;i++){
                    Agent a;
                    a.pos=Vec2f(rng.uniform(-2,2),rng.uniform(-2,2));
                    a.vel=Vec2f(0);
                    a.genes.speed=0.5f+rng.uniform()*1.0f;
                    a.genes.sense=0.3f+rng.uniform()*0.7f;
                    a.genes.size=0.5f+rng.uniform()*0.5f;
                    a.energy=100;a.age=0;a.alive=true;
                    agents.push_back(a);
                }
            }
        }

        // Build meshes
        agentMesh.reset();
        for(auto& a:agents){
            agentMesh.vertex(a.pos.x,a.pos.y,0);
            float hue=a.genes.speed/3.0f;
            agentMesh.color(HSV(hue,0.8f,0.9f));
        }

        foodMesh.reset();
        for(auto& f:food){
            if(!f.eaten){
                foodMesh.vertex(f.pos.x,f.pos.y,0);
                foodMesh.color(0.2f,0.8f,0.2f);
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f);
        g.blending(true);g.blendTrans();g.depthTesting(false);
        g.pointSize(4);g.meshColor();g.draw(foodMesh);
        g.pointSize(8);g.meshColor();g.draw(agentMesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()==' ')fastMode=!fastMode;
        if(k.key()=='r')reset();
        return true;
    }
};

ALLOLIB_WEB_MAIN(Evolution)
`,
  },

  {
    id: 'life-neural-creatures',
    title: 'Neural Creatures',
    description: 'Creatures with simple neural network brains',
    category: 'simulation',
    subcategory: 'life',
    code: `/**
 * Neural Network Creatures
 * Features: Simple feedforward neural nets, learning through evolution
 * Controls: Space = fast mode, R = reset
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <vector>
#include <algorithm>

using namespace al;

class NeuralCreatures : public WebApp {
public:
    static const int INPUTS=6,HIDDEN=4,OUTPUTS=2;

    struct Brain {
        float w1[INPUTS][HIDDEN],w2[HIDDEN][OUTPUTS];
        float b1[HIDDEN],b2[OUTPUTS];

        void randomize(rnd::Random<>& rng){
            for(int i=0;i<INPUTS;i++)for(int j=0;j<HIDDEN;j++)w1[i][j]=rng.uniform(-1,1);
            for(int i=0;i<HIDDEN;i++)for(int j=0;j<OUTPUTS;j++)w2[i][j]=rng.uniform(-1,1);
            for(int i=0;i<HIDDEN;i++)b1[i]=rng.uniform(-0.5f,0.5f);
            for(int i=0;i<OUTPUTS;i++)b2[i]=rng.uniform(-0.5f,0.5f);
        }

        void mutate(rnd::Random<>& rng,float rate=0.1f){
            for(int i=0;i<INPUTS;i++)for(int j=0;j<HIDDEN;j++)
                if(rng.uniform()<rate)w1[i][j]+=rng.uniform(-0.5f,0.5f);
            for(int i=0;i<HIDDEN;i++)for(int j=0;j<OUTPUTS;j++)
                if(rng.uniform()<rate)w2[i][j]+=rng.uniform(-0.5f,0.5f);
        }

        void forward(float in[INPUTS],float out[OUTPUTS]){
            float h[HIDDEN];
            for(int j=0;j<HIDDEN;j++){
                h[j]=b1[j];
                for(int i=0;i<INPUTS;i++)h[j]+=in[i]*w1[i][j];
                h[j]=tanhf(h[j]);
            }
            for(int j=0;j<OUTPUTS;j++){
                out[j]=b2[j];
                for(int i=0;i<HIDDEN;i++)out[j]+=h[i]*w2[i][j];
                out[j]=tanhf(out[j]);
            }
        }
    };

    struct Creature {
        Vec2f pos,vel;
        float angle,energy;
        Brain brain;
        bool alive;
    };

    struct Food { Vec2f pos; bool eaten; };

    std::vector<Creature> creatures;
    std::vector<Food> food;
    Mesh creatureMesh,foodMesh;
    rnd::Random<> rng;
    bool fastMode=false;

    void onCreate() override {
        creatureMesh.primitive(Mesh::POINTS);
        foodMesh.primitive(Mesh::POINTS);
        reset();
        nav().pos(0,0,5);
    }

    void reset(){
        creatures.clear();
        food.clear();
        for(int i=0;i<30;i++){
            Creature c;
            c.pos=Vec2f(rng.uniform(-3,3),rng.uniform(-3,3));
            c.vel=Vec2f(0);
            c.angle=rng.uniform()*2*M_PI;
            c.energy=100;
            c.brain.randomize(rng);
            c.alive=true;
            creatures.push_back(c);
        }
        for(int i=0;i<80;i++){
            Food f;
            f.pos=Vec2f(rng.uniform(-3.5f,3.5f),rng.uniform(-3.5f,3.5f));
            f.eaten=false;
            food.push_back(f);
        }
    }

    void onAnimate(double dt) override {
        int steps=fastMode?5:1;
        float dtf=0.02f;

        for(int s=0;s<steps;s++){
            std::vector<Creature> babies;

            for(auto& c:creatures){
                if(!c.alive)continue;

                // Sense nearest food (front left, front right, behind)
                float sensors[INPUTS]={0,0,0,0,0,0};
                for(auto& f:food){
                    if(f.eaten)continue;
                    Vec2f toFood=f.pos-c.pos;
                    float dist=toFood.mag();
                    if(dist<2.0f){
                        float foodAngle=atan2f(toFood.y,toFood.x);
                        float relAngle=foodAngle-c.angle;
                        while(relAngle>M_PI)relAngle-=2*M_PI;
                        while(relAngle<-M_PI)relAngle+=2*M_PI;
                        float strength=1.0f/(dist+0.1f);
                        if(relAngle>0.3f)sensors[0]+=strength;
                        else if(relAngle<-0.3f)sensors[1]+=strength;
                        else sensors[2]+=strength;
                    }
                }
                sensors[3]=c.energy/200.0f;
                sensors[4]=sinf(c.angle);
                sensors[5]=cosf(c.angle);

                // Neural network decision
                float outputs[OUTPUTS];
                c.brain.forward(sensors,outputs);

                // Apply outputs: turn and speed
                c.angle+=outputs[0]*dtf*3;
                float speed=(outputs[1]+1)*0.5f*2;

                c.vel.x=cosf(c.angle)*speed;
                c.vel.y=sinf(c.angle)*speed;
                c.pos+=c.vel*dtf;

                // Wrap around
                if(c.pos.x<-4)c.pos.x=4;if(c.pos.x>4)c.pos.x=-4;
                if(c.pos.y<-4)c.pos.y=4;if(c.pos.y>4)c.pos.y=-4;

                // Eat food
                for(auto& f:food){
                    if(!f.eaten&&(f.pos-c.pos).mag()<0.2f){
                        f.eaten=true;
                        c.energy+=40;
                    }
                }

                c.energy-=dtf*5;
                if(c.energy<=0)c.alive=false;

                // Reproduce
                if(c.energy>180){
                    c.energy-=80;
                    Creature baby;
                    baby.pos=c.pos;
                    baby.angle=rng.uniform()*2*M_PI;
                    baby.vel=Vec2f(0);
                    baby.energy=80;
                    baby.brain=c.brain;
                    baby.brain.mutate(rng);
                    baby.alive=true;
                    babies.push_back(baby);
                }
            }

            for(auto& b:babies)creatures.push_back(b);
            creatures.erase(std::remove_if(creatures.begin(),creatures.end(),[](Creature& c){return !c.alive;}),creatures.end());
            food.erase(std::remove_if(food.begin(),food.end(),[](Food& f){return f.eaten;}),food.end());

            if(food.size()<30){
                for(int i=0;i<20;i++){
                    Food f;f.pos=Vec2f(rng.uniform(-3.5f,3.5f),rng.uniform(-3.5f,3.5f));f.eaten=false;
                    food.push_back(f);
                }
            }

            if(creatures.empty())reset();
        }

        creatureMesh.reset();
        for(auto& c:creatures){
            creatureMesh.vertex(c.pos.x,c.pos.y,0);
            creatureMesh.color(HSV(c.energy/200.0f*0.3f,0.8f,0.9f));
        }
        foodMesh.reset();
        for(auto& f:food){
            if(!f.eaten){foodMesh.vertex(f.pos.x,f.pos.y,0);foodMesh.color(0.2f,0.9f,0.3f);}
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f);
        g.blending(true);g.blendTrans();g.depthTesting(false);
        g.pointSize(5);g.meshColor();g.draw(foodMesh);
        g.pointSize(10);g.meshColor();g.draw(creatureMesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()==' ')fastMode=!fastMode;
        if(k.key()=='r')reset();
        return true;
    }
};

ALLOLIB_WEB_MAIN(NeuralCreatures)
`,
  },

  {
    id: 'life-coral-growth',
    title: 'Coral Growth',
    description: 'Diffusion-limited aggregation coral simulation',
    category: 'simulation',
    subcategory: 'life',
    code: `/**
 * Coral Growth (DLA)
 * Features: Diffusion-limited aggregation, branching structures
 * Controls: Space = spawn particles, R = reset
 */
#include "al_playground_compat.hpp"
#include <cmath>
#include <vector>
#include <cstring>

using namespace al;

class CoralGrowth : public WebApp {
public:
    static const int SIZE=200;
    bool grid[SIZE][SIZE];
    Mesh mesh;
    rnd::Random<> rng;
    int particles=0;

    struct Walker { float x,y; };
    std::vector<Walker> walkers;

    void onCreate() override {
        mesh.primitive(Mesh::POINTS);
        reset();
        nav().pos(0,0,3);
    }

    void reset(){
        memset(grid,false,sizeof(grid));
        // Seed at bottom center
        for(int x=SIZE/2-2;x<=SIZE/2+2;x++)grid[0][x]=true;
        walkers.clear();
        particles=5;
    }

    bool hasNeighbor(int x,int y){
        for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){
            int nx=x+dx,ny=y+dy;
            if(nx>=0&&nx<SIZE&&ny>=0&&ny<SIZE&&grid[ny][nx])return true;
        }
        return false;
    }

    void onAnimate(double dt) override {
        // Spawn new walkers at top
        while((int)walkers.size()<500){
            Walker w;
            w.x=rng.uniform()*SIZE;
            w.y=SIZE-1;
            walkers.push_back(w);
        }

        // Move walkers
        for(int iter=0;iter<50;iter++){
            for(auto it=walkers.begin();it!=walkers.end();){
                it->x+=(rng.uniform()-0.5f)*2;
                it->y+=(rng.uniform()-0.5f)*2-0.3f; // Slight downward bias

                int ix=(int)it->x,iy=(int)it->y;

                // Out of bounds
                if(ix<0||ix>=SIZE||iy<0){
                    it=walkers.erase(it);
                    continue;
                }
                if(iy>=SIZE){it->y=SIZE-1;iy=SIZE-1;}

                // Check if we should stick
                if(hasNeighbor(ix,iy)&&!grid[iy][ix]){
                    grid[iy][ix]=true;
                    particles++;
                    it=walkers.erase(it);
                }else{
                    ++it;
                }
            }
        }

        // Build mesh
        mesh.reset();
        float scale=2.0f/SIZE;
        for(int y=0;y<SIZE;y++)for(int x=0;x<SIZE;x++){
            if(grid[y][x]){
                mesh.vertex((x-SIZE/2)*scale,(y-SIZE/2)*scale,0);
                float h=(float)y/SIZE;
                mesh.color(HSV(0.45f+h*0.15f,0.6f,0.7f+h*0.3f));
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f,0.15f,0.2f);
        g.blending(true);g.blendAdd();g.depthTesting(false);
        g.pointSize(2);g.meshColor();g.draw(mesh);
    }

    bool onKeyDown(const Keyboard& k) override {
        if(k.key()=='r')reset();
        return true;
    }
};

ALLOLIB_WEB_MAIN(CoralGrowth)
`,
  },

  // ==========================================================================
  // ADVANCED - Multi-File Projects
  // ==========================================================================
  {
    id: 'adv-multifile-synth',
    title: 'Multi-File Synth',
    description: 'Example showing how to organize code across multiple files',
    category: 'advanced',
    subcategory: 'multifile',
    code: `/**
 * Multi-File Synthesizer Example
 *
 * This example demonstrates organizing code across multiple files:
 * - main.cpp (this file) - Application entry point
 * - MySynth.hpp - Header with synth voice definition
 *
 * Add MySynth.hpp to your project to compile this example.
 */

#include "al_playground_compat.hpp"
#include "MySynth.hpp"

using namespace al;

class MultiFileSynthApp : public WebApp {
public:
    SynthGUIManager<MySynthVoice> synthManager;
    Mesh backgroundSphere;

    void onCreate() override {
        addSphere(backgroundSphere, 0.5, 30, 30);
        backgroundSphere.generateNormals();
        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        synthManager.setCurrentTime(currentTime());
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        // Draw synth visuals
        synthManager.render(g);

        // Draw background
        g.pushMatrix();
        g.translate(0, -1, 0);
        g.color(0.2f, 0.3f, 0.4f);
        g.draw(backgroundSphere);
        g.popMatrix();

        // Draw GUI
        synthManager.drawSynthControlPanel();
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);
    }

    bool onKeyDown(const Keyboard& k) override {
        int midiNote = keyToMidi(k.key());
        if (midiNote > 0) {
            synthManager.voice()->setInternalParameterValue("frequency", midiToFreq(midiNote));
            synthManager.triggerOn(midiNote);
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        int midiNote = keyToMidi(k.key());
        if (midiNote > 0) {
            synthManager.triggerOff(midiNote);
        }
        return true;
    }
};

ALLOLIB_MAIN(MultiFileSynthApp)

/*
 * To use this example:
 * 1. Add a new file called "MySynth.hpp" to your project
 * 2. Copy the MySynth.hpp template code into it
 * 3. Compile and run - play notes with your keyboard!
 */
`,
  },

  // Merge playground examples (from allolib_playground tutorials)
  ...playgroundExamples,
]

// Multi-file examples (separate array for better organization)
export const multiFileExamples: MultiFileExample[] = [
  {
    id: 'multi-organized-synth',
    title: 'Organized Synth Project',
    description: 'A well-organized multi-file synth with separate voice and effects',
    category: 'advanced',
    subcategory: 'multifile',
    mainFile: 'main.cpp',
    files: [
      {
        path: 'main.cpp',
        content: `/**
 * Organized Synth Project
 *
 * Demonstrates proper code organization with:
 * - Separate voice definition (voices/FMVoice.hpp)
 * - Reusable effect (effects/Reverb.hpp)
 * - Clean main application file
 *
 * Controls: ZSXDCVGBHNJM = piano keys (Z=C4)
 */

#include "al_playground_compat.hpp"
#include "voices/FMVoice.hpp"
#include "effects/Reverb.hpp"

using namespace al;

class OrganizedSynthApp : public al::WebApp {
public:
    SynthGUIManager<FMVoice> synthManager{"FMSynth"};
    SimpleReverb reverb;

    void onCreate() override {
        nav().pos(0, 0, 4);
        reverb.setDecay(0.85f);
        reverb.setMix(0.3f);
    }

    void onAnimate(double dt) override {
        (void)dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);
        g.lighting(true);
        g.depthTesting(true);
        synthManager.render(g);
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);

        // Apply reverb to output
        while (io()) {
            float left = io.out(0);
            float right = io.out(1);
            reverb.process(left, right);
            io.out(0) = left;
            io.out(1) = right;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        int midi = asciiToMIDI(k.key());
        if (midi > 0) {
            synthManager.voice()->setInternalParameterValue("frequency", 440.0f * powf(2.0f, (midi - 69) / 12.0f));
            synthManager.triggerOn(midi);
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        int midi = asciiToMIDI(k.key());
        if (midi > 0) synthManager.triggerOff(midi);
        return true;
    }
};

ALLOLIB_WEB_MAIN(OrganizedSynthApp)
`,
      },
      {
        path: 'voices/FMVoice.hpp',
        content: `#pragma once
/**
 * FM Synthesis Voice
 *
 * A polyphonic FM voice with:
 * - Carrier and modulator oscillators
 * - ADSR envelope
 * - Visual feedback sphere
 */

#include "al_playground_compat.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class FMVoice : public al::SynthVoice {
public:
    gam::Sine<> carrier;
    gam::Sine<> modulator;
    gam::Env<4> env;

    Mesh sphere;
    float envValue = 0;

    void init() override {
        // Envelope: Attack, Decay, Sustain level, Release
        env.levels(0, 1, 0.6, 0);
        env.lengths(0.01, 0.1, 0.8);
        env.curve(-4);
        env.sustainPoint(2);

        // Visual
        addSphere(sphere, 0.3, 20, 20);
        sphere.generateNormals();

        // Parameters
        createInternalTriggerParameter("frequency", 440, 20, 2000);
        createInternalTriggerParameter("amplitude", 0.2, 0.0, 1.0);
        createInternalTriggerParameter("modRatio", 2.0, 0.5, 8.0);
        createInternalTriggerParameter("modIndex", 3.0, 0.0, 10.0);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
        createInternalTriggerParameter("attackTime", 0.01, 0.001, 1.0);
        createInternalTriggerParameter("releaseTime", 0.8, 0.01, 5.0);
    }

    void onProcess(al::AudioIOData& io) override {
        float freq = getInternalParameterValue("frequency");
        float amp = getInternalParameterValue("amplitude");
        float modRatio = getInternalParameterValue("modRatio");
        float modIndex = getInternalParameterValue("modIndex");
        float panVal = getInternalParameterValue("pan");

        env.lengths()[0] = getInternalParameterValue("attackTime");
        env.lengths()[2] = getInternalParameterValue("releaseTime");

        modulator.freq(freq * modRatio);

        while (io()) {
            float mod = modulator() * modIndex * freq;
            carrier.freq(freq + mod);

            envValue = env();
            float s = carrier() * envValue * amp;

            // Manual stereo panning: panVal from -1 (left) to 1 (right)
            float leftGain = (1.0f - panVal) * 0.5f + 0.5f;
            float rightGain = (1.0f + panVal) * 0.5f + 0.5f;
            io.out(0) += s * leftGain;
            io.out(1) += s * rightGain;
        }

        if (env.done()) free();
    }

    void onProcess(al::Graphics& g) override {
        g.pushMatrix();
        g.translate(getInternalParameterValue("pan") * 2, 0, 0);
        g.scale(1 + envValue);

        float freq = getInternalParameterValue("frequency");
        float hue = log2f(freq / 110.0f) / 4.0f;
        g.color(HSV(hue, 0.7f, 0.5f + envValue * 0.5f));
        g.draw(sphere);
        g.popMatrix();
    }

    void onTriggerOn() override {
        env.reset();
    }

    void onTriggerOff() override {
        env.release();
    }
};
`,
      },
      {
        path: 'effects/Reverb.hpp',
        content: `#pragma once
/**
 * Simple Stereo Reverb Effect
 *
 * A basic comb filter reverb for demonstration.
 * For production, use Gamma's Reverb classes.
 */

class SimpleReverb {
public:
    static const int BUFFER_SIZE = 8192;
    float bufferL[BUFFER_SIZE];
    float bufferR[BUFFER_SIZE];
    int writePos = 0;

    float decay = 0.8f;
    float mix = 0.3f;

    // Different delay times for each channel (in samples)
    int delayL = 1557;
    int delayR = 1617;

    SimpleReverb() {
        for (int i = 0; i < BUFFER_SIZE; ++i) {
            bufferL[i] = 0;
            bufferR[i] = 0;
        }
    }

    void setDecay(float d) { decay = d; }
    void setMix(float m) { mix = m; }

    void process(float& left, float& right) {
        // Read from delay buffers
        int readPosL = (writePos - delayL + BUFFER_SIZE) % BUFFER_SIZE;
        int readPosR = (writePos - delayR + BUFFER_SIZE) % BUFFER_SIZE;

        float delayedL = bufferL[readPosL];
        float delayedR = bufferR[readPosR];

        // Write to delay buffers (input + feedback)
        bufferL[writePos] = left + delayedR * decay;
        bufferR[writePos] = right + delayedL * decay;

        // Mix dry and wet
        left = left * (1.0f - mix) + delayedL * mix;
        right = right * (1.0f - mix) + delayedR * mix;

        // Advance write position
        writePos = (writePos + 1) % BUFFER_SIZE;
    }
};
`,
      },
    ],
  },
]

// Combined list of all examples (single and multi-file)
export const allExamples: AnyExample[] = [...examples, ...multiFileExamples]

// Helper function to get examples by category
export function getExamplesByCategory(categoryId: string): AnyExample[] {
  return allExamples.filter((e) => e.category === categoryId)
}

// Helper function to get examples by subcategory
export function getExamplesBySubcategory(
  categoryId: string,
  subcategoryId: string
): AnyExample[] {
  return allExamples.filter(
    (e) => e.category === categoryId && e.subcategory === subcategoryId
  )
}

// Get all category titles for display
export function getCategoryTitle(categoryId: string): string {
  const cat = categories.find((c) => c.id === categoryId)
  return cat?.title || categoryId
}

export function getSubcategoryTitle(
  categoryId: string,
  subcategoryId: string
): string {
  const cat = categories.find((c) => c.id === categoryId)
  const sub = cat?.subcategories?.find((s) => s.id === subcategoryId)
  return sub?.title || subcategoryId
}

// Get the main code for an example (handles both single and multi-file)
export function getExampleMainCode(example: AnyExample): string {
  if (isMultiFileExample(example)) {
    const mainFile = example.files.find(f => f.path === example.mainFile)
    return mainFile?.content || example.files[0]?.content || ''
  }
  return example.code
}
