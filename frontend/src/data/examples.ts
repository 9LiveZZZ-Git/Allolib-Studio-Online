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
};

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

    void onCreate() override {
        curve.primitive(Mesh::LINE_STRIP);
        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
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
};

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
        time += dt;
        buildTree();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02f, 0.02f, 0.05f);
        g.meshColor();
        g.draw(tree);
    }

    bool onKeyDown(const Keyboard& k) override {
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
};

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
        g.light().pos(5, 5, 5);

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

    void onCreate() override {
        nav().pos(4, 0, 8);
        nav().faceToward(Vec3f(0, 0, 0));
    }

    void onAnimate(double dt) override {
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
};

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
};

ALLOLIB_WEB_MAIN(SpringMesh)

// Press SPACE to shake the mesh!
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
        if (k.key() == 'r' || k.key() == 'R') {
            resetBoids();
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(FlockingBoids)

// Press R to reset the flock!
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
};

ALLOLIB_WEB_MAIN(AntTrails)
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
 */

#include "al_playground_compat.hpp"
#include "voices/FMVoice.hpp"
#include "effects/Reverb.hpp"

using namespace al;

class OrganizedSynthApp : public WebApp {
public:
    SynthGUIManager<FMVoice> synthManager;
    SimpleReverb reverb;

    void onCreate() override {
        nav().pos(0, 0, 4);
        reverb.setDecay(0.85f);
        reverb.setMix(0.3f);
    }

    void onAnimate(double dt) override {
        synthManager.setCurrentTime(currentTime());
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08f, 0.08f, 0.12f);
        g.lighting(true);
        g.depthTesting(true);
        synthManager.render(g);
        synthManager.drawSynthControlPanel();
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
        int midi = keyToMidi(k.key());
        if (midi > 0) {
            synthManager.voice()->setInternalParameterValue("frequency", midiToFreq(midi));
            synthManager.triggerOn(midi);
        }
        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        int midi = keyToMidi(k.key());
        if (midi > 0) synthManager.triggerOff(midi);
        return true;
    }
};

ALLOLIB_MAIN(OrganizedSynthApp)
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

class FMVoice : public SynthVoice {
public:
    gam::Sine<> carrier;
    gam::Sine<> modulator;
    gam::Env<4> env;
    gam::Pan<> pan;

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

    void onProcess(AudioIOData& io) override {
        float freq = getInternalParameterValue("frequency");
        float amp = getInternalParameterValue("amplitude");
        float modRatio = getInternalParameterValue("modRatio");
        float modIndex = getInternalParameterValue("modIndex");

        env.lengths()[0] = getInternalParameterValue("attackTime");
        env.lengths()[2] = getInternalParameterValue("releaseTime");
        pan.pos(getInternalParameterValue("pan"));

        modulator.freq(freq * modRatio);

        while (io()) {
            float mod = modulator() * modIndex * freq;
            carrier.freq(freq + mod);

            envValue = env();
            float s1 = carrier() * envValue * amp;
            float s2;
            pan(s1, s1, s2);

            io.out(0) += s1;
            io.out(1) += s2;
        }

        if (env.done()) free();
    }

    void onProcess(Graphics& g) override {
        g.pushMatrix();
        g.translate(getInternalParameterValue("pan") * 2, 0, 0);
        g.scale(1 + envValue);

        float freq = getInternalParameterValue("frequency");
        float hue = log2(freq / 110.0f) / 4.0f;
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
