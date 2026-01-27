/**
 * AlloLib Studio Online - Example Code Library
 *
 * Complete code examples organized by category for the examples dropdown.
 * Each example is a fully functional AlloLib web application.
 */

export interface Example {
  id: string
  title: string
  description: string
  category: string
  subcategory?: string
  code: string
}

export interface ExampleCategory {
  id: string
  title: string
  subcategories?: { id: string; title: string }[]
}

export const categories: ExampleCategory[] = [
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
    id: 'advanced',
    title: 'Advanced',
    subcategories: [
      { id: 'particles', title: 'Particles' },
      { id: 'audiovisual', title: 'Audio-Visual' },
      { id: 'generative', title: 'Generative' },
    ],
  },
]

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
 * Generates a simple sine wave tone
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"

using namespace al;

class HelloAudio : public WebApp {
public:
    Mesh mesh;
    gam::Sine<> osc{440.0f};
    float amplitude = 0.3f;

    void onCreate() override {
        addSphere(mesh, 0.5, 32, 32);
        mesh.generateNormals();
        nav().pos(0, 0, 4);
        configureWebAudio(44100, 128, 2, 0);
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
            float sample = osc() * amplitude;
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
    gam::Saw<> saw{220.0f};
    gam::Square<> square{220.0f};
    gam::Tri<> tri{220.0f};

    int oscType = 0;
    float amplitude = 0.25f;
    double angle = 0;

    void onCreate() override {
        addSphere(mesh, 0.8, 32, 32);
        mesh.generateNormals();
        nav().pos(0, 0, 4);
        configureWebAudio(44100, 128, 2, 0);
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
                case 1: sample = saw() * amplitude; break;
                case 2: sample = square() * amplitude * 0.5f; break;
                case 3: sample = tri() * amplitude; break;
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
    Saw<> lfo{0.5f};
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
            float mod = 1.0f + lfo() * 0.5f;
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
]

// Helper function to get examples by category
export function getExamplesByCategory(categoryId: string): Example[] {
  return examples.filter((e) => e.category === categoryId)
}

// Helper function to get examples by subcategory
export function getExamplesBySubcategory(
  categoryId: string,
  subcategoryId: string
): Example[] {
  return examples.filter(
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
