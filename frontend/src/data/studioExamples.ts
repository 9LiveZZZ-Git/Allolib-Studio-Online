/**
 * AlloLib Studio Online - Original Examples
 *
 * These examples showcase features unique to AlloLib Studio Online,
 * including environment maps, imported meshes, and studio-specific workflows.
 */

import type { Example, ExampleCategory, MultiFileExample } from './examples'

export const studioCategories: ExampleCategory[] = [
  {
    id: 'studio-environments',
    title: 'Studio - Environments',
    subcategories: [
      { id: 'hdri-lighting', title: 'HDRI Lighting' },
      { id: 'skyboxes', title: 'Skyboxes' },
    ],
  },
  {
    id: 'studio-textures',
    title: 'Studio - Textures',
    subcategories: [
      { id: 'procedural', title: 'Procedural Textures' },
      { id: 'pbr-materials', title: 'PBR Materials' },
      { id: '3d-textures', title: '3D Textures' },
      { id: 'hdr-textures', title: 'HDR Textures' },
      { id: 'texture-lod', title: 'Texture LOD' },
    ],
  },
  {
    id: 'studio-meshes',
    title: 'Studio - Meshes',
    subcategories: [
      { id: 'classic-models', title: 'Classic Models' },
      { id: 'procedural', title: 'Procedural' },
    ],
  },
  {
    id: 'studio-templates',
    title: 'Studio - Templates',
    subcategories: [
      { id: 'starter', title: 'Starter Projects' },
      { id: 'showcase', title: 'Showcase' },
    ],
  },
  {
    id: 'studio-timeline',
    title: 'Studio - Timeline',
    subcategories: [
      { id: 'objects', title: 'Object Animation' },
      { id: 'keyframes', title: 'Keyframes' },
    ],
  },
]

export const studioExamples: Example[] = [
  // ==========================================================================
  // STUDIO - ENVIRONMENTS - HDRI Lighting
  // ==========================================================================
  {
    id: 'studio-env-basic',
    title: 'Basic Environment Lighting',
    description: 'Using HDRI environment maps for realistic lighting',
    category: 'studio-environments',
    subcategory: 'hdri-lighting',
    code: `/**
 * Basic Environment Lighting
 *
 * Demonstrates how to use HDRI environment maps
 * for image-based lighting in AlloLib Studio.
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class EnvironmentDemo : public WebApp {
public:
    Mesh sphere;
    Mesh floor;
    double angle = 0;

    // Material properties
    float metallic = 0.5;
    float roughness = 0.3;

    void onCreate() override {
        // Create a reflective sphere
        addSphere(sphere, 1.0, 64, 64);
        sphere.generateNormals();

        // Create floor plane
        addSurface(floor, 10, 10, 20, 20);
        floor.generateNormals();

        nav().pos(0, 2, 8);
        nav().faceToward(Vec3d(0, 0, 0));
    }

    void onAnimate(double dt) override {
        angle += dt * 15.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1, 0.1, 0.15);

        g.depthTesting(true);
        g.lighting(true);

        // Draw sphere with material properties
        g.pushMatrix();
        g.translate(0, 1, 0);
        g.rotate(angle, 0, 1, 0);
        g.color(0.9, 0.9, 0.95);
        g.draw(sphere);
        g.popMatrix();

        // Draw floor
        g.pushMatrix();
        g.rotate(-90, 1, 0, 0);
        g.color(0.3, 0.3, 0.35);
        g.draw(floor);
        g.popMatrix();
    }
};

int main() {
    EnvironmentDemo app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-env-pbr-materials',
    title: 'PBR Material Showcase',
    description: 'Physically based rendering with different materials',
    category: 'studio-environments',
    subcategory: 'hdri-lighting',
    code: `/**
 * PBR Material Showcase
 *
 * Demonstrates physically based rendering with
 * various metallic and dielectric materials.
 *
 * Controls:
 *   Arrow keys: Orbit camera
 *   +/-: Adjust exposure
 *   W/S: Zoom in/out
 */

#include "al_WebApp.hpp"
#include "al_WebPBR.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class PBRShowcase : public WebApp {
public:
    WebPBR pbr;
    Mesh sphere;
    double angle = 0;
    float camAngleX = 0;  // Horizontal orbit
    float camAngleY = 0;  // Vertical orbit
    float camDist = 6;    // Distance from center

    void onCreate() override {
        // Load environment for IBL
        pbr.loadEnvironment("/assets/environments/studio_small_09_1k.hdr");

        // Create sphere mesh
        addSphere(sphere, 0.4, 48, 48);
        sphere.generateNormals();
    }

    void onAnimate(double dt) override {
        angle += dt * 15.0;

        // Update camera position based on orbit angles
        float x = camDist * sin(camAngleX) * cos(camAngleY);
        float y = camDist * sin(camAngleY);
        float z = camDist * cos(camAngleX) * cos(camAngleY);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(0, 0, 0), Vec3f(0, 1, 0));
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02, 0.02, 0.03);

        // Draw skybox
        pbr.drawSkybox(g);

        g.depthTesting(true);

        // Begin PBR rendering
        pbr.begin(g, nav().pos());

        // Row 1: Metals (varying roughness)
        PBRMaterial metals[] = {
            PBRMaterial::Gold(),
            PBRMaterial::Silver(),
            PBRMaterial::Copper(),
            PBRMaterial::Iron()
        };

        for (int i = 0; i < 4; i++) {
            g.pushMatrix();
            g.translate((i - 1.5) * 1.2, 0.6, 0);
            g.rotate(angle, 0, 1, 0);

            metals[i].roughness = 0.1 + i * 0.2;
            pbr.material(metals[i]);
            g.draw(sphere);

            g.popMatrix();
        }

        // Row 2: Dielectrics
        PBRMaterial dielectrics[] = {
            PBRMaterial::Plastic(),
            PBRMaterial::Ceramic(),
            PBRMaterial::Rubber(),
            PBRMaterial::Wood()
        };

        for (int i = 0; i < 4; i++) {
            g.pushMatrix();
            g.translate((i - 1.5) * 1.2, -0.6, 0);
            g.rotate(angle, 0, 1, 0);

            pbr.material(dielectrics[i]);
            g.draw(sphere);

            g.popMatrix();
        }

        pbr.end(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        float rotSpeed = 0.1f;
        float zoomSpeed = 0.5f;

        switch (k.key()) {
            case Keyboard::LEFT:  camAngleX -= rotSpeed; break;
            case Keyboard::RIGHT: camAngleX += rotSpeed; break;
            case Keyboard::UP:    camAngleY += rotSpeed; break;
            case Keyboard::DOWN:  camAngleY -= rotSpeed; break;
            case 'w': case 'W':   camDist -= zoomSpeed; break;
            case 's': case 'S':   camDist += zoomSpeed; break;
            case '+': case '=':
                pbr.exposure(pbr.exposure() + 0.2f);
                break;
            case '-':
                pbr.exposure(std::max(0.2f, pbr.exposure() - 0.2f));
                break;
        }

        // Clamp values
        camAngleY = std::max(-1.4f, std::min(1.4f, camAngleY));
        camDist = std::max(2.0f, std::min(15.0f, camDist));

        return true;
    }
};

int main() {
    PBRShowcase app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-env-pbr-roughness',
    title: 'PBR Roughness Grid',
    description: 'Metallic-roughness parameter space visualization',
    category: 'studio-environments',
    subcategory: 'hdri-lighting',
    code: `/**
 * PBR Roughness Grid
 *
 * Visualizes the metallic-roughness parameter space
 * with a grid of spheres.
 */

#include "al_WebApp.hpp"
#include "al_WebPBR.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class PBRGrid : public WebApp {
public:
    WebPBR pbr;
    Mesh sphere;
    double angle = 0;

    const int GRID_SIZE = 5;

    void onCreate() override {
        pbr.loadEnvironment("/assets/environments/kloofendal_48d_partly_cloudy_puresky_1k.hdr");
        // GPU resources created automatically on first draw
        pbr.exposure(1.5);

        addSphere(sphere, 0.35, 32, 32);
        sphere.generateNormals();

        nav().pos(0, 0, 8);
    }

    void onAnimate(double dt) override {
        angle += dt * 5.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.01, 0.01, 0.02);
        pbr.drawSkybox(g);

        g.depthTesting(true);
        pbr.begin(g, nav().pos());

        float spacing = 1.0;
        float offset = (GRID_SIZE - 1) * spacing * 0.5;

        for (int row = 0; row < GRID_SIZE; row++) {
            float metallic = (float)row / (GRID_SIZE - 1);

            for (int col = 0; col < GRID_SIZE; col++) {
                float roughness = (float)col / (GRID_SIZE - 1);
                roughness = 0.05 + roughness * 0.9; // Avoid 0 roughness

                g.pushMatrix();
                g.translate(col * spacing - offset, row * spacing - offset, 0);
                g.rotate(angle, 0, 1, 0);

                PBRMaterial mat;
                mat.albedo = Vec3f(0.9, 0.7, 0.5);
                mat.metallic = metallic;
                mat.roughness = roughness;
                pbr.material(mat);

                g.draw(sphere);
                g.popMatrix();
            }
        }

        pbr.end(g);
    }
};

int main() {
    PBRGrid app;
    app.start();
    return 0;
}
`,
  },

  {
    id: 'studio-env-hdri-skybox',
    title: 'HDRI Skybox',
    description: 'Load and display HDR environment maps as skybox',
    category: 'studio-environments',
    subcategory: 'hdri-lighting',
    code: `/**
 * HDRI Skybox
 *
 * Demonstrates loading and displaying HDR environment maps
 * as immersive 360° skyboxes with reflective objects.
 *
 * Controls:
 *   Arrow keys: Look around
 *   W/S: Move forward/back
 *   +/-: Adjust exposure
 */

#include "al_WebApp.hpp"
#include "al_WebEnvironment.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class HDRISkybox : public WebApp {
public:
    WebEnvironment env;
    Mesh sphere;
    Mesh floor;
    double angle = 0;
    float lookX = 0, lookY = 0;
    float camDist = 5;

    void onCreate() override {
        // Load HDR environment map
        env.load("/assets/environments/kloofendal_48d_partly_cloudy_puresky_1k.hdr");
        env.exposure(1.2);

        // Create reflective spheres
        addSphere(sphere, 0.6, 48, 48);
        sphere.generateNormals();

        // Create floor
        addSurface(floor, 20, 20, 10, 10);
        floor.generateNormals();
    }

    void onAnimate(double dt) override {
        angle += dt * 15.0;

        // Update camera
        float x = camDist * sin(lookX) * cos(lookY);
        float y = 1.5 + camDist * sin(lookY) * 0.3;
        float z = camDist * cos(lookX) * cos(lookY);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(0, 0.5, 0), Vec3f(0, 1, 0));
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);

        // Draw skybox (360° background)
        env.drawSkybox(g);

        g.depthTesting(true);

        // Draw reflective spheres in a circle
        env.beginReflect(g, nav().pos(), 0.85);
        for (int i = 0; i < 5; i++) {
            float a = i * M_2PI / 5 + angle * 0.01;
            g.pushMatrix();
            g.translate(cos(a) * 2.5, 0.6, sin(a) * 2.5);
            g.rotate(angle + i * 72, 0.2, 1, 0.1);
            g.draw(sphere);
            g.popMatrix();
        }
        env.endReflect();

        // Draw floor with lighting
        g.lighting(true);
        g.pushMatrix();
        g.translate(0, 0, 0);
        g.rotate(-90, 1, 0, 0);
        g.color(0.3, 0.3, 0.35);
        g.draw(floor);
        g.popMatrix();
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case Keyboard::LEFT:  lookX -= 0.1f; break;
            case Keyboard::RIGHT: lookX += 0.1f; break;
            case Keyboard::UP:    lookY += 0.05f; break;
            case Keyboard::DOWN:  lookY -= 0.05f; break;
            case 'w': case 'W':   camDist -= 0.3f; break;
            case 's': case 'S':   camDist += 0.3f; break;
            case '+': case '=':
                env.exposure(env.exposure() + 0.2f);
                break;
            case '-':
                env.exposure(std::max(0.2f, env.exposure() - 0.2f));
                break;
        }
        lookY = std::max(-0.5f, std::min(0.8f, lookY));
        camDist = std::max(2.0f, std::min(12.0f, camDist));
        return true;
    }
};

int main() {
    HDRISkybox app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-env-reflect-sphere',
    title: 'Reflective Sphere',
    description: 'Environment map reflections on a sphere',
    category: 'studio-environments',
    subcategory: 'hdri-lighting',
    code: `/**
 * Reflective Sphere
 *
 * Demonstrates environment map reflections using
 * the WebEnvironment reflection shader.
 *
 * Controls:
 *   Arrow keys: Orbit camera
 *   W/S: Zoom in/out
 *   +/-: Adjust reflectivity
 *   E/D: Adjust exposure
 */

#include "al_WebApp.hpp"
#include "al_WebEnvironment.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class ReflectiveSphere : public WebApp {
public:
    WebEnvironment env;
    Mesh sphere;
    double angle = 0;
    float reflectivity = 0.9;
    float camAngleX = 0;
    float camAngleY = 0.2;
    float camDist = 4;

    void onCreate() override {
        // Load HDR environment
        env.load("/assets/environments/kloofendal_48d_partly_cloudy_puresky_1k.hdr");

        // Create reflective sphere
        addSphere(sphere, 1.0, 64, 64);
        sphere.generateNormals();

        env.exposure(1.5);
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;

        // Update camera position based on orbit angles
        float x = camDist * sin(camAngleX) * cos(camAngleY);
        float y = camDist * sin(camAngleY);
        float z = camDist * cos(camAngleX) * cos(camAngleY);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(0, 0, 0), Vec3f(0, 1, 0));
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);

        // Draw skybox
        env.drawSkybox(g);

        // Draw reflective sphere
        g.depthTesting(true);

        env.beginReflect(g, nav().pos(), reflectivity);

        g.pushMatrix();
        g.rotate(angle, 0.3, 1, 0);
        g.draw(sphere);
        g.popMatrix();

        env.endReflect();
    }

    bool onKeyDown(Keyboard const& k) override {
        float rotSpeed = 0.1f;
        float zoomSpeed = 0.3f;

        switch (k.key()) {
            case Keyboard::LEFT:  camAngleX -= rotSpeed; break;
            case Keyboard::RIGHT: camAngleX += rotSpeed; break;
            case Keyboard::UP:    camAngleY += rotSpeed; break;
            case Keyboard::DOWN:  camAngleY -= rotSpeed; break;
            case 'w': case 'W':   camDist -= zoomSpeed; break;
            case 's': case 'S':   camDist += zoomSpeed; break;
            case '+': case '=':
                reflectivity = std::min(1.0f, reflectivity + 0.1f);
                printf("Reflectivity: %.1f\\n", reflectivity);
                break;
            case '-':
                reflectivity = std::max(0.0f, reflectivity - 0.1f);
                printf("Reflectivity: %.1f\\n", reflectivity);
                break;
            case 'e': case 'E':
                env.exposure(env.exposure() + 0.2f);
                printf("Exposure: %.1f\\n", env.exposure());
                break;
            case 'd': case 'D':
                env.exposure(std::max(0.2f, env.exposure() - 0.2f));
                printf("Exposure: %.1f\\n", env.exposure());
                break;
        }

        // Clamp values
        camAngleY = std::max(-1.4f, std::min(1.4f, camAngleY));
        camDist = std::max(2.0f, std::min(10.0f, camDist));

        return true;
    }
};

int main() {
    ReflectiveSphere app;
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - ENVIRONMENTS - Skyboxes
  // ==========================================================================
  {
    id: 'studio-skybox-procedural',
    title: 'Procedural Skybox',
    description: 'Dynamic day/night cycle with sun, moon, and atmosphere',
    category: 'studio-environments',
    subcategory: 'skyboxes',
    code: `/**
 * Procedural Skybox
 *
 * Dynamic day/night cycle with sun, moon, and
 * changing sky colors from dawn to dusk.
 *
 * Controls:
 *   Left/Right: Orbit camera
 *   +/-: Speed up/slow down time
 *   Space: Pause/resume
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class ProceduralSky : public WebApp {
public:
    Mesh ground;
    Mesh sun;
    Mesh moon;
    Mesh cube;
    double time = 0.25;
    float timeSpeed = 0.05;
    bool paused = false;
    float camAngle = 0;

    void onCreate() override {
        // Ground plane
        addSurface(ground, 40, 40, 20, 20);
        ground.generateNormals();

        // Sun and moon spheres
        addSphere(sun, 0.8, 32, 32);
        addSphere(moon, 0.5, 24, 24);

        // Cube with normals for proper lighting
        addCube(cube, 1.0);
        cube.generateNormals();

        // Camera looking at scene
        nav().pos(0, 3, 10);
        nav().faceToward(Vec3f(0, 0, 0), Vec3f(0, 1, 0));
    }

    void onAnimate(double dt) override {
        if (!paused) time += dt * timeSpeed;
    }

    void onDraw(Graphics& g) override {
        // Sun angle (0 = sunrise, 0.5 = noon, 1 = sunset)
        float sunAngle = time * M_2PI;

        // Day factor based on sun height
        float dayFactor = (sin(sunAngle) + 1.0f) * 0.5f;

        // Horizon colors during sunrise/sunset
        float horizonFactor = std::abs(cos(sunAngle));
        horizonFactor = horizonFactor * horizonFactor; // Sharpen

        // Sky color - blue during day, dark at night, orange at horizon
        float skyR = 0.05f + dayFactor * 0.3f + horizonFactor * 0.5f * dayFactor;
        float skyG = 0.05f + dayFactor * 0.4f + horizonFactor * 0.2f * dayFactor;
        float skyB = 0.15f + dayFactor * 0.5f;

        g.clear(skyR, skyG, skyB);
        g.depthTesting(true);
        g.lighting(false);

        // Sun position in sky (drawn as billboard-ish sphere)
        float sunDist = 15.0f;
        float sunX = -sin(sunAngle) * sunDist * 0.3f;
        float sunY = sin(sunAngle) * sunDist * 0.5f + 3.0f;
        float sunZ = -cos(sunAngle) * sunDist;

        // Draw sun when visible
        if (sin(sunAngle) > -0.3f) {
            g.blending(true);
            g.blendAdd();

            float sunVis = std::min(1.0f, (sin(sunAngle) + 0.3f) * 2.0f);
            g.pushMatrix();
            g.translate(sunX, sunY, sunZ);
            // Orange at horizon, yellow at noon
            g.color(1.0f * sunVis, (0.7f + dayFactor * 0.3f) * sunVis, (0.3f + dayFactor * 0.4f) * sunVis);
            g.draw(sun);
            g.popMatrix();

            g.blending(false);
        }

        // Moon (opposite side)
        float moonX = sin(sunAngle) * 12.0f * 0.4f;
        float moonY = -sin(sunAngle) * 8.0f + 5.0f;
        float moonZ = cos(sunAngle) * 12.0f;

        if (sin(sunAngle) < 0.3f && moonY > 1.0f) {
            g.blending(true);
            g.blendAdd();

            float moonVis = (1.0f - dayFactor) * 0.9f;
            g.pushMatrix();
            g.translate(moonX, moonY, moonZ);
            g.color(0.7f * moonVis, 0.7f * moonVis, 0.8f * moonVis);
            g.draw(moon);
            g.popMatrix();

            g.blending(false);
        }

        // Enable lighting for solid objects
        g.lighting(true);

        // Ground plane
        float groundLight = 0.2f + dayFactor * 0.5f;
        g.pushMatrix();
        g.translate(0, 0, 0);
        g.rotate(-90, 1, 0, 0);
        g.color(groundLight * 0.4f, groundLight * 0.6f, groundLight * 0.3f);
        g.draw(ground);
        g.popMatrix();

        // Rotating cube with shading
        g.pushMatrix();
        g.translate(0, 0.5, 0);
        g.rotate(time * 30, 0, 1, 0);
        g.rotate(time * 20, 1, 0, 0);
        g.color(0.4f + dayFactor * 0.4f, 0.3f + dayFactor * 0.4f, 0.5f + dayFactor * 0.3f);
        g.draw(cube);
        g.popMatrix();

        // Add a second cube for more visual interest
        g.pushMatrix();
        g.translate(2.5, 0.3, -1);
        g.rotate(time * -25, 0, 1, 0);
        g.scale(0.6);
        g.color(0.6f + dayFactor * 0.3f, 0.3f + dayFactor * 0.3f, 0.2f + dayFactor * 0.2f);
        g.draw(cube);
        g.popMatrix();

        // Third cube
        g.pushMatrix();
        g.translate(-2, 0.4, 1);
        g.rotate(time * 15, 0.5, 1, 0.2);
        g.scale(0.8);
        g.color(0.2f + dayFactor * 0.3f, 0.5f + dayFactor * 0.4f, 0.3f + dayFactor * 0.3f);
        g.draw(cube);
        g.popMatrix();
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case Keyboard::LEFT:  camAngle -= 0.15f; break;
            case Keyboard::RIGHT: camAngle += 0.15f; break;
            case '+': case '=':   timeSpeed = std::min(0.3f, timeSpeed * 1.5f); break;
            case '-':             timeSpeed = std::max(0.01f, timeSpeed / 1.5f); break;
            case ' ':             paused = !paused; break;
        }
        // Update camera orbit
        float dist = 10.0f;
        nav().pos(sin(camAngle) * dist, 3, cos(camAngle) * dist);
        nav().faceToward(Vec3f(0, 0, 0), Vec3f(0, 1, 0));
        return true;
    }
};

int main() {
    ProceduralSky app;
    app.start();
    return 0;
}
`,
  },

  {
    id: 'studio-skybox-hdri-picker',
    title: 'Environment Picker',
    description: 'Switch between different HDR environments',
    category: 'studio-environments',
    subcategory: 'skyboxes',
    code: `/**
 * Environment Picker
 *
 * Switch between different HDR environment maps.
 * Press 1-4 to change environments.
 */

#include "al_WebApp.hpp"
#include "al_WebEnvironment.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class EnvPicker : public WebApp {
public:
    WebEnvironment env;
    int currentEnv = 0;
    Mesh sphere;
    double angle = 0;
    float camAngle = 0;

    const char* envNames[4] = {
        "Studio",
        "Cloudy Sky",
        "Forest",
        "Urban Street"
    };

    const char* envPaths[4] = {
        "/assets/environments/studio_small_09_1k.hdr",
        "/assets/environments/kloofendal_48d_partly_cloudy_puresky_1k.hdr",
        "/assets/environments/forest_slope_1k.hdr",
        "/assets/environments/urban_street_04_1k.hdr"
    };

    void onCreate() override {
        // Load first environment
        loadEnvironment(0);

        // Create reflective sphere
        addSphere(sphere, 1.0, 48, 48);
        sphere.generateNormals();

        nav().pos(0, 0, 5);
    }

    void loadEnvironment(int idx) {
        currentEnv = idx;
        printf("Loading: %s\\n", envNames[idx]);
        env.load(envPaths[idx], [this, idx](bool success) {
            if (success) {
                printf("Loaded: %s\\n", envNames[idx]);
            } else {
                printf("Failed to load: %s\\n", envNames[idx]);
            }
        });
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02, 0.02, 0.03);

        // Draw skybox
        env.drawSkybox(g);

        // Draw reflective sphere
        g.depthTesting(true);
        env.beginReflect(g, nav().pos(), 0.9);

        g.pushMatrix();
        g.rotate(angle, 0.2, 1, 0.1);
        g.draw(sphere);
        g.popMatrix();

        env.endReflect();
    }

    bool onKeyDown(Keyboard const& k) override {
        if (k.key() >= '1' && k.key() <= '4') {
            int newEnv = k.key() - '1';
            if (newEnv != currentEnv) {
                loadEnvironment(newEnv);
            }
        }
        // Camera controls
        if (k.key() == Keyboard::LEFT) camAngle -= 0.2f;
        if (k.key() == Keyboard::RIGHT) camAngle += 0.2f;

        float dist = 5.0f;
        nav().pos(sin(camAngle) * dist, 0, cos(camAngle) * dist);
        nav().faceToward(Vec3f(0, 0, 0), Vec3f(0, 1, 0));

        return true;
    }
};

int main() {
    EnvPicker app;
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - MESHES - Classic Models
  // ==========================================================================
  {
    id: 'studio-mesh-bunny',
    title: 'Stanford Bunny (OBJ)',
    description: 'Load and display the classic Stanford bunny OBJ mesh',
    category: 'studio-meshes',
    subcategory: 'classic-models',
    code: `/**
 * Stanford Bunny - OBJ with HDR Lighting
 *
 * The classic Stanford bunny (1994) with HDR environment
 * lighting and camera controls.
 *
 * Controls:
 *   Arrow keys: Orbit camera
 *   W/S: Zoom in/out
 *   +/-: Adjust exposure
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"
#include "al_WebEnvironment.hpp"

using namespace al;

class BunnyDemo : public WebApp {
public:
    WebOBJ loader;
    WebEnvironment env;
    Mesh bunny;
    Mesh floor;
    double angle = 0;
    float camAngleX = 0.3f, camAngleY = 0.3f;
    float camDist = 4.0f;
    bool meshLoaded = false;

    void onCreate() override {
        // Load HDR environment
        env.load("/assets/environments/studio_small_09_1k.hdr");
        env.exposure(1.5f);

        // Load the Stanford bunny
        loader.load("/assets/meshes/bunny.obj", [this](bool success) {
            if (success) {
                bunny = loader.mesh();
                bunny.fitToSphere(1.0);
                meshLoaded = true;
                printf("Bunny loaded: %zu vertices\\n", bunny.vertices().size());
            }
        });

        // Floor
        addSurface(floor, 10, 10, 10, 10);
        floor.generateNormals();

        updateCamera();
    }

    void updateCamera() {
        float x = camDist * sin(camAngleX) * cos(camAngleY);
        float y = camDist * sin(camAngleY) + 0.5f;
        float z = camDist * cos(camAngleX) * cos(camAngleY);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(0, 0.3, 0), Vec3f(0, 1, 0));
    }

    void onAnimate(double dt) override {
        angle += dt * 25.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);

        // Draw HDR skybox
        env.drawSkybox(g);
        g.depthTesting(true);

        if (meshLoaded) {
            // Draw reflective bunny
            env.beginReflect(g, nav().pos(), 0.7f);
            g.pushMatrix();
            g.translate(0, 0.3, 0);
            g.rotate(angle, 0, 1, 0);
            g.draw(bunny);
            g.popMatrix();
            env.endReflect();
        }

        // Floor with lighting
        g.lighting(true);
        g.pushMatrix();
        g.translate(0, -0.5, 0);
        g.rotate(-90, 1, 0, 0);
        g.color(0.3, 0.3, 0.35);
        g.draw(floor);
        g.popMatrix();
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case Keyboard::LEFT:  camAngleX -= 0.15f; break;
            case Keyboard::RIGHT: camAngleX += 0.15f; break;
            case Keyboard::UP:    camAngleY = std::min(1.3f, camAngleY + 0.1f); break;
            case Keyboard::DOWN:  camAngleY = std::max(-0.2f, camAngleY - 0.1f); break;
            case 'w': case 'W':   camDist = std::max(2.0f, camDist - 0.5f); break;
            case 's': case 'S':   camDist = std::min(10.0f, camDist + 0.5f); break;
            case '+': case '=':   env.exposure(env.exposure() + 0.2f); break;
            case '-':             env.exposure(std::max(0.3f, env.exposure() - 0.2f)); break;
        }
        updateCamera();
        return true;
    }
};

int main() {
    BunnyDemo app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-mesh-teapot',
    title: 'Utah Teapot (OBJ)',
    description: 'Load and display the iconic Utah teapot OBJ mesh',
    category: 'studio-meshes',
    subcategory: 'classic-models',
    code: `/**
 * Utah Teapot - OBJ with HDR Reflections
 *
 * The Utah teapot (1975) with polished copper appearance
 * and HDR environment reflections.
 *
 * Controls:
 *   Arrow keys: Orbit camera
 *   W/S: Zoom in/out
 *   +/-: Adjust exposure
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"
#include "al_WebEnvironment.hpp"

using namespace al;

class TeapotDemo : public WebApp {
public:
    WebOBJ loader;
    WebEnvironment env;
    Mesh teapot;
    Mesh floor;
    double angle = 0;
    float camAngleX = 0.4f, camAngleY = 0.25f;
    float camDist = 4.0f;
    bool meshLoaded = false;

    void onCreate() override {
        // Load HDR environment
        env.load("/assets/environments/kloofendal_48d_partly_cloudy_puresky_1k.hdr");
        env.exposure(1.3f);

        // Load the Utah teapot
        loader.load("/assets/meshes/teapot.obj", [this](bool success) {
            if (success) {
                teapot = loader.mesh();
                teapot.fitToSphere(1.0);
                meshLoaded = true;
                printf("Teapot loaded: %zu vertices\\n", teapot.vertices().size());
            }
        });

        // Floor
        addSurface(floor, 12, 12, 10, 10);
        floor.generateNormals();

        updateCamera();
    }

    void updateCamera() {
        float x = camDist * sin(camAngleX) * cos(camAngleY);
        float y = camDist * sin(camAngleY) + 0.3f;
        float z = camDist * cos(camAngleX) * cos(camAngleY);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(0, 0.2, 0), Vec3f(0, 1, 0));
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);

        // Draw HDR skybox
        env.drawSkybox(g);
        g.depthTesting(true);

        if (meshLoaded) {
            // Draw polished copper teapot with reflections
            env.beginReflect(g, nav().pos(), 0.75f);
            g.pushMatrix();
            g.translate(0, 0.2, 0);
            g.rotate(angle, 0, 1, 0);
            g.draw(teapot);
            g.popMatrix();
            env.endReflect();
        }

        // Floor
        g.lighting(true);
        g.pushMatrix();
        g.translate(0, -0.6, 0);
        g.rotate(-90, 1, 0, 0);
        g.color(0.25, 0.22, 0.2);
        g.draw(floor);
        g.popMatrix();
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case Keyboard::LEFT:  camAngleX -= 0.15f; break;
            case Keyboard::RIGHT: camAngleX += 0.15f; break;
            case Keyboard::UP:    camAngleY = std::min(1.3f, camAngleY + 0.1f); break;
            case Keyboard::DOWN:  camAngleY = std::max(-0.1f, camAngleY - 0.1f); break;
            case 'w': case 'W':   camDist = std::max(2.0f, camDist - 0.5f); break;
            case 's': case 'S':   camDist = std::min(10.0f, camDist + 0.5f); break;
            case '+': case '=':   env.exposure(env.exposure() + 0.2f); break;
            case '-':             env.exposure(std::max(0.3f, env.exposure() - 0.2f)); break;
        }
        updateCamera();
        return true;
    }
};

int main() {
    TeapotDemo app;
    app.start();
    return 0;
}
`,
  },

  {
    id: 'studio-mesh-pbr-bunny',
    title: 'PBR Stanford Bunny',
    description: 'Stanford bunny with full PBR materials',
    category: 'studio-meshes',
    subcategory: 'classic-models',
    code: `/**
 * PBR Stanford Bunny
 *
 * The Stanford bunny rendered with physically
 * based materials and image-based lighting.
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"
#include "al_WebPBR.hpp"

using namespace al;

class PBRBunny : public WebApp {
public:
    WebOBJ loader;
    WebPBR pbr;
    Mesh bunny;
    double angle = 0;
    bool meshLoaded = false;
    int materialIndex = 0;

    void onCreate() override {
        // Load mesh
        loader.load("/assets/meshes/bunny.obj", [this](bool success) {
            if (success) {
                bunny = loader.mesh();
                bunny.fitToSphere(1.2);
                meshLoaded = true;
            }
        });

        // Load environment
        pbr.loadEnvironment("/assets/environments/museum_of_ethnography_1k.hdr");
        // GPU resources created automatically on first draw
        pbr.exposure(1.3);

        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);
        pbr.drawSkybox(g);

        g.depthTesting(true);

        if (meshLoaded) {
            pbr.begin(g, nav().pos());

            // Different material presets
            PBRMaterial materials[] = {
                PBRMaterial::Gold(),
                PBRMaterial::Silver(),
                PBRMaterial::Copper(),
                PBRMaterial::Ceramic(),
                PBRMaterial(Vec3f(0.9, 0.85, 0.8), 0.0, 0.3)
            };

            g.pushMatrix();
            g.rotate(angle, 0, 1, 0);
            pbr.material(materials[materialIndex % 5]);
            g.draw(bunny);
            g.popMatrix();

            pbr.end(g);
        }
    }

    bool onKeyDown(Keyboard const& k) override {
        if (k.key() >= '1' && k.key() <= '5') {
            materialIndex = k.key() - '1';
            const char* names[] = {"Gold", "Silver", "Copper", "Ceramic", "Clay"};
            printf("Material: %s\\n", names[materialIndex]);
        }
        return true;
    }
};

int main() {
    PBRBunny app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-mesh-env-teapot',
    title: 'Reflective Teapot',
    description: 'Utah teapot with HDR environment reflections',
    category: 'studio-meshes',
    subcategory: 'classic-models',
    code: `/**
 * Reflective Teapot
 *
 * Combines OBJ mesh loading with HDR environment mapping
 * for beautiful reflective materials.
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"
#include "al_WebEnvironment.hpp"

using namespace al;

class ReflectiveTeapot : public WebApp {
public:
    WebOBJ loader;
    WebEnvironment env;
    Mesh teapot;
    double angle = 0;
    bool meshLoaded = false;
    float reflectivity = 0.8;

    void onCreate() override {
        // Load mesh
        loader.load("/assets/meshes/teapot.obj", [this](bool success) {
            if (success) {
                teapot = loader.mesh();
                teapot.fitToSphere(1.0);
                meshLoaded = true;
                printf("Teapot loaded!\\n");
            }
        });

        // Load environment
        env.load("/assets/environments/museum_of_ethnography_1k.hdr");
        // GPU resources created automatically on first draw
        env.exposure(1.2);

        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);

        // Draw skybox
        env.drawSkybox(g);

        g.depthTesting(true);

        if (meshLoaded) {
            // Draw teapot with reflections
            env.beginReflect(g, nav().pos(), reflectivity);

            g.pushMatrix();
            g.rotate(angle, 0, 1, 0);
            g.draw(teapot);
            g.popMatrix();

            env.endReflect();
        } else {
            // Loading indicator
            g.lighting(true);
            g.pushMatrix();
            g.rotate(angle * 2, 1, 1, 0);
            g.color(0.5, 0.5, 0.6);
            Mesh cube;
            addCube(cube, 0.2);
            g.draw(cube);
            g.popMatrix();
        }
    }

    bool onKeyDown(Keyboard const& k) override {
        if (k.key() == '+' || k.key() == '=') {
            reflectivity = std::min(1.0f, reflectivity + 0.1f);
        } else if (k.key() == '-') {
            reflectivity = std::max(0.0f, reflectivity - 0.1f);
        }
        return true;
    }
};

int main() {
    ReflectiveTeapot app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-mesh-gallery',
    title: 'Classic Models Gallery',
    description: 'Load and display multiple classic 3D test models',
    category: 'studio-meshes',
    subcategory: 'classic-models',
    code: `/**
 * Classic Models Gallery
 *
 * Demonstrates loading multiple OBJ meshes using
 * the WebOBJBatch loader.
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"

using namespace al;

class ModelGallery : public WebApp {
public:
    WebOBJBatch batch;
    int bunnyIdx, teapotIdx, suzanneIdx, spotIdx;
    Mesh meshes[4];
    double angle = 0;
    int selectedModel = 0;

    void onCreate() override {
        // Add all models to batch
        bunnyIdx = batch.add("/assets/meshes/bunny.obj");
        teapotIdx = batch.add("/assets/meshes/teapot.obj");
        suzanneIdx = batch.add("/assets/meshes/suzanne.obj");
        spotIdx = batch.add("/assets/meshes/spot.obj");

        // Start loading all
        batch.loadAll([](int loaded, int total) {
            printf("Loading meshes: %d/%d\\n", loaded, total);
        });

        nav().pos(0, 0, 3);
    }

    void onAnimate(double dt) override {
        angle += dt * 30.0;

        // Copy meshes when loaded
        if (batch.allReady() && meshes[0].vertices().empty()) {
            meshes[0] = batch.mesh(bunnyIdx);
            meshes[1] = batch.mesh(teapotIdx);
            meshes[2] = batch.mesh(suzanneIdx);
            meshes[3] = batch.mesh(spotIdx);
            for (auto& m : meshes) {
                m.fitToSphere(1.0);
            }
            printf("All meshes loaded!\\n");
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1, 0.1, 0.15);
        g.depthTesting(true);
        g.lighting(true);

        if (batch.allReady() && !meshes[0].vertices().empty()) {
            g.pushMatrix();
            g.rotate(angle, 0, 1, 0);

            // Color based on selected model
            Color colors[4] = {
                Color(0.9, 0.85, 0.8),  // Bunny - cream
                Color(0.8, 0.5, 0.3),   // Teapot - copper
                Color(0.6, 0.7, 0.9),   // Suzanne - blue
                Color(0.9, 0.9, 0.7)    // Spot - light yellow
            };
            g.color(colors[selectedModel]);
            g.draw(meshes[selectedModel]);
            g.popMatrix();
        } else {
            // Show loading progress
            float progress = batch.progress();
            g.pushMatrix();
            g.rotate(angle * 2, 1, 1, 0);
            g.color(0.3 + progress * 0.5, 0.3 + progress * 0.5, 0.5);
            Mesh cube;
            addCube(cube, 0.2 + progress * 0.3);
            g.draw(cube);
            g.popMatrix();
        }
    }

    bool onKeyDown(Keyboard const& k) override {
        // 1-4 to switch models
        if (k.key() >= '1' && k.key() <= '4') {
            selectedModel = k.key() - '1';
            printf("Selected model: %d\\n", selectedModel);
        }
        return true;
    }
};

int main() {
    ModelGallery app;
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - MESHES - Procedural
  // ==========================================================================
  {
    id: 'studio-mesh-knot',
    title: 'Trefoil Knot',
    description: 'Procedurally generated mathematical knot surface',
    category: 'studio-meshes',
    subcategory: 'procedural',
    code: `/**
 * Trefoil Knot
 *
 * A procedurally generated trefoil knot with
 * HDR environment reflections.
 *
 * Controls:
 *   Arrow keys: Orbit camera
 *   W/S: Zoom in/out
 *   +/-: Adjust exposure
 */

#include "al_WebApp.hpp"
#include "al_WebEnvironment.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

class TrefoilKnot : public WebApp {
public:
    Mesh knot;
    WebEnvironment env;
    double angle = 0;
    float camAngleX = 0.4f, camAngleY = 0.3f;
    float camDist = 4.0f;

    Vec3f trefoilPoint(float t) {
        float x = sin(t) + 2 * sin(2 * t);
        float y = cos(t) - 2 * cos(2 * t);
        float z = -sin(3 * t);
        return Vec3f(x, y, z) * 0.35;
    }

    Vec3f trefoilTangent(float t) {
        float dx = cos(t) + 4 * cos(2 * t);
        float dy = -sin(t) + 4 * sin(2 * t);
        float dz = -3 * cos(3 * t);
        return Vec3f(dx, dy, dz).normalize();
    }

    void onCreate() override {
        // Load HDR environment
        env.load("/assets/environments/museum_of_ethnography_1k.hdr");
        env.exposure(1.5f);

        // Generate tube mesh along trefoil curve
        int segments = 200;
        int tubeSegments = 20;
        float tubeRadius = 0.1;

        for (int i = 0; i <= segments; i++) {
            float t = (float)i / segments * M_2PI;
            Vec3f center = trefoilPoint(t);
            Vec3f tangent = trefoilTangent(t);

            Vec3f up(0, 1, 0);
            if (abs(tangent.dot(up)) > 0.9) up = Vec3f(1, 0, 0);
            Vec3f right = tangent.cross(up).normalize();
            Vec3f realUp = right.cross(tangent).normalize();

            for (int j = 0; j < tubeSegments; j++) {
                float a = (float)j / tubeSegments * M_2PI;
                Vec3f offset = (right * cos(a) + realUp * sin(a)) * tubeRadius;
                Vec3f pos = center + offset;

                knot.vertex(pos);
                knot.normal(offset.normalize());
            }
        }

        // Generate triangle indices
        for (int i = 0; i < segments; i++) {
            for (int j = 0; j < tubeSegments; j++) {
                int next = (j + 1) % tubeSegments;
                int curr = i * tubeSegments;
                int nextRow = (i + 1) * tubeSegments;

                knot.index(curr + j);
                knot.index(nextRow + j);
                knot.index(curr + next);

                knot.index(curr + next);
                knot.index(nextRow + j);
                knot.index(nextRow + next);
            }
        }

        knot.primitive(Mesh::TRIANGLES);
        updateCamera();
    }

    void updateCamera() {
        float x = camDist * sin(camAngleX) * cos(camAngleY);
        float y = camDist * sin(camAngleY);
        float z = camDist * cos(camAngleX) * cos(camAngleY);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(0, 0, 0), Vec3f(0, 1, 0));
    }

    void onAnimate(double dt) override {
        angle += dt * 25.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);

        // Draw HDR skybox
        env.drawSkybox(g);
        g.depthTesting(true);

        // Draw reflective knot
        env.beginReflect(g, nav().pos(), 0.85f);
        g.pushMatrix();
        g.rotate(angle, 0.3, 1, 0.2);
        g.draw(knot);
        g.popMatrix();
        env.endReflect();
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case Keyboard::LEFT:  camAngleX -= 0.15f; break;
            case Keyboard::RIGHT: camAngleX += 0.15f; break;
            case Keyboard::UP:    camAngleY = std::min(1.4f, camAngleY + 0.1f); break;
            case Keyboard::DOWN:  camAngleY = std::max(-1.4f, camAngleY - 0.1f); break;
            case 'w': case 'W':   camDist = std::max(2.0f, camDist - 0.4f); break;
            case 's': case 'S':   camDist = std::min(10.0f, camDist + 0.4f); break;
            case '+': case '=':   env.exposure(env.exposure() + 0.2f); break;
            case '-':             env.exposure(std::max(0.3f, env.exposure() - 0.2f)); break;
        }
        updateCamera();
        return true;
    }
};

int main() {
    TrefoilKnot app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-mesh-klein',
    title: 'Klein Bottle',
    description: 'Non-orientable surface - the famous Klein bottle',
    category: 'studio-meshes',
    subcategory: 'procedural',
    code: `/**
 * Klein Bottle
 *
 * A non-orientable surface that passes through itself,
 * rendered with HDR environment reflections.
 *
 * Controls:
 *   Arrow keys: Orbit camera
 *   W/S: Zoom in/out
 *   +/-: Adjust exposure
 */

#include "al_WebApp.hpp"
#include "al_WebEnvironment.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

class KleinBottle : public WebApp {
public:
    Mesh klein;
    WebEnvironment env;
    double angle = 0;
    float camAngleX = 0.5f, camAngleY = 0.2f;
    float camDist = 4.5f;

    Vec3f kleinPoint(float u, float v) {
        float r = 4.0 * (1.0 - cos(u) / 2.0);
        float x, y, z;

        if (u < M_PI) {
            x = 6 * cos(u) * (1 + sin(u)) + r * cos(u) * cos(v);
            y = 16 * sin(u) + r * sin(u) * cos(v);
        } else {
            x = 6 * cos(u) * (1 + sin(u)) + r * cos(v + M_PI);
            y = 16 * sin(u);
        }
        z = r * sin(v);

        return Vec3f(x, y, z) * 0.055;
    }

    void onCreate() override {
        // Load HDR environment
        env.load("/assets/environments/gray_pier_1k.hdr");
        env.exposure(1.4f);

        int uSegments = 80;
        int vSegments = 40;

        for (int i = 0; i <= uSegments; i++) {
            float u = (float)i / uSegments * M_2PI;

            for (int j = 0; j <= vSegments; j++) {
                float v = (float)j / vSegments * M_2PI;

                Vec3f pos = kleinPoint(u, v);
                klein.vertex(pos);

                // Numerical normal calculation
                Vec3f du = kleinPoint(u + 0.01, v) - pos;
                Vec3f dv = kleinPoint(u, v + 0.01) - pos;
                klein.normal(du.cross(dv).normalize());
            }
        }

        // Generate indices
        for (int i = 0; i < uSegments; i++) {
            for (int j = 0; j < vSegments; j++) {
                int curr = i * (vSegments + 1) + j;
                int next = curr + vSegments + 1;

                klein.index(curr);
                klein.index(next);
                klein.index(curr + 1);

                klein.index(curr + 1);
                klein.index(next);
                klein.index(next + 1);
            }
        }

        klein.primitive(Mesh::TRIANGLES);
        updateCamera();
    }

    void updateCamera() {
        float x = camDist * sin(camAngleX) * cos(camAngleY);
        float y = camDist * sin(camAngleY);
        float z = camDist * cos(camAngleX) * cos(camAngleY);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(0, 0, 0), Vec3f(0, 1, 0));
    }

    void onAnimate(double dt) override {
        angle += dt * 18.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);

        // Draw HDR skybox
        env.drawSkybox(g);
        g.depthTesting(true);

        // Draw reflective Klein bottle
        env.beginReflect(g, nav().pos(), 0.8f);
        g.pushMatrix();
        g.rotate(angle, 0.2, 1, 0.1);
        g.rotate(90, 1, 0, 0);
        g.draw(klein);
        g.popMatrix();
        env.endReflect();
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case Keyboard::LEFT:  camAngleX -= 0.15f; break;
            case Keyboard::RIGHT: camAngleX += 0.15f; break;
            case Keyboard::UP:    camAngleY = std::min(1.4f, camAngleY + 0.1f); break;
            case Keyboard::DOWN:  camAngleY = std::max(-1.4f, camAngleY - 0.1f); break;
            case 'w': case 'W':   camDist = std::max(2.0f, camDist - 0.4f); break;
            case 's': case 'S':   camDist = std::min(10.0f, camDist + 0.4f); break;
            case '+': case '=':   env.exposure(env.exposure() + 0.2f); break;
            case '-':             env.exposure(std::max(0.3f, env.exposure() - 0.2f)); break;
        }
        updateCamera();
        return true;
    }
};

int main() {
    KleinBottle app;
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - MESHES - LOD
  // ==========================================================================
  {
    id: 'studio-mesh-lod-demo',
    title: 'Unified LOD System',
    description: 'Up to 16 LOD levels with distance scale and unload support',
    category: 'studio-meshes',
    subcategory: 'procedural',
    code: `/**
 * Advanced Automatic LOD System Demo
 *
 * Demonstrates automatic mesh simplification using Quadric Error Metrics.
 * Now with support for up to 16 LOD levels, unified distance scaling,
 * and mesh unloading at extreme distances.
 *
 * NEW FEATURES:
 * - Up to 16 LOD levels (for gradual quality reduction)
 * - Distance Scale: Unified control to scale ALL distances proportionally
 * - Unload: Meshes can be completely hidden at extreme distances
 *
 * KEY CONCEPT: Use drawLOD(g, mesh) instead of g.draw(mesh) to enable
 * automatic LOD selection. LOD levels are generated on first draw.
 *
 * Controls:
 *   Arrow keys: Orbit camera
 *   W/S: Zoom in/out (watch LOD change!)
 *   L: Toggle LOD on/off
 *   1-4: Set LOD levels (4, 8, 12, 16)
 *   D/F: Decrease/Increase distance scale
 *   U: Toggle unload feature
 *   M: Cycle selection mode
 *   +/-: Adjust exposure
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"
#include "al_WebEnvironment.hpp"

using namespace al;

class LODDemo : public WebApp {
public:
    WebOBJ loader;
    WebEnvironment env;
    Mesh bunnyMesh;
    Mesh floor;
    double angle = 0;
    float camAngleX = 0.5f, camAngleY = 0.3f;
    float camDist = 5.0f;
    bool meshLoaded = false;
    int lodMode = 1;  // 0=distance, 1=screenSize, 2=screenError
    int numLevels = 8;
    float distScale = 1.0f;
    bool unloadEnabled = false;
    float unloadDist = 50.0f;

    void onCreate() override {
        // Enable Auto-LOD system with extended features
        autoLOD().enable(true);
        autoLOD().setLevels(numLevels);  // Start with 8 LOD levels
        autoLOD().setMinFullQualityDistance(3.0f);  // Always LOD 0 within 3 units
        autoLOD().setDistanceScale(distScale);  // Unified distance scale
        autoLOD().setUnloadEnabled(unloadEnabled);
        autoLOD().setUnloadDistance(unloadDist);
        autoLOD().setSelectionMode(LODSelectionMode::ScreenSize);
        autoLOD().enableStats(true);

        printf("[LOD Demo] Advanced Auto-LOD enabled!\\n");
        printf("  - %d LOD levels (supports up to 16)\\n", numLevels);
        printf("  - Distance scale: %.1f (D/F to adjust)\\n", distScale);
        printf("  - Unload: %s at %.0f units (U to toggle)\\n",
               unloadEnabled ? "ON" : "OFF", unloadDist);
        printf("  - Keys: 1-4=levels, D/F=scale, U=unload, M=mode\\n");

        // Load HDR environment
        env.load("/assets/environments/forest_slope_1k.hdr");
        env.exposure(1.4f);

        // Load mesh - LOD levels generated automatically on first drawLOD()!
        loader.load("/assets/meshes/bunny.obj", [this](bool success) {
            if (success) {
                bunnyMesh = loader.mesh();
                bunnyMesh.fitToSphere(1.0);
                bunnyMesh.generateNormals();
                meshLoaded = true;
                printf("Mesh loaded: %zu vertices\\n", bunnyMesh.vertices().size());
                printf("LOD levels generated on first draw (watch console)\\n");
            }
        });

        // Floor (simple geometry - no LOD needed)
        addSurface(floor, 15, 15, 10, 10);
        floor.generateNormals();

        updateCamera();
    }

    void updateCamera() {
        float x = camDist * sin(camAngleX) * cos(camAngleY);
        float y = camDist * sin(camAngleY) + 0.5f;
        float z = camDist * cos(camAngleX) * cos(camAngleY);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(0, 0.3, 0), Vec3f(0, 1, 0));
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);

        // Draw HDR skybox
        env.drawSkybox(g);
        g.depthTesting(true);

        if (meshLoaded) {
            // Use drawLOD() for automatic LOD selection!
            env.beginReflect(g, nav().pos(), 0.6f);
            g.pushMatrix();
            g.translate(0, 0.3, 0);
            g.rotate(angle, 0, 1, 0);
            drawLOD(g, bunnyMesh);  // <-- Auto LOD with up to 16 levels!
            g.popMatrix();
            env.endReflect();

            // Show LOD info
            int tris = autoLOD().frameTriangles();
            const char* modeNames[] = {"Distance", "ScreenSize", "ScreenError", "Budget"};

            // Check if unloaded (0 triangles beyond unload distance)
            if (tris == 0 && unloadEnabled && camDist > unloadDist * distScale) {
                printf("\\rDist: %.1f | UNLOADED (beyond %.0f) | Scale: %.1f | Levels: %d    ",
                       camDist, unloadDist * distScale, distScale, numLevels);
            } else {
                printf("\\rDist: %.1f | Tris: %d | Scale: %.1f | Levels: %d | Mode: %s    ",
                       camDist, tris, distScale, numLevels, modeNames[lodMode]);
            }
        }

        // Floor
        g.lighting(true);
        g.pushMatrix();
        g.translate(0, -0.5, 0);
        g.rotate(-90, 1, 0, 0);
        g.color(0.2, 0.25, 0.2);
        g.draw(floor);
        g.popMatrix();
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case Keyboard::LEFT:  camAngleX -= 0.15f; break;
            case Keyboard::RIGHT: camAngleX += 0.15f; break;
            case Keyboard::UP:    camAngleY = std::min(1.2f, camAngleY + 0.1f); break;
            case Keyboard::DOWN:  camAngleY = std::max(-0.1f, camAngleY - 0.1f); break;
            case 'w': case 'W':   camDist = std::max(1.5f, camDist - 1.5f); break;
            case 's': case 'S':   camDist = std::min(100.0f, camDist + 2.0f); break;
            case '+': case '=':   env.exposure(env.exposure() + 0.2f); break;
            case '-':             env.exposure(std::max(0.3f, env.exposure() - 0.2f)); break;

            // Toggle LOD
            case 'l': case 'L': {
                bool enabled = !autoLOD().enabled();
                autoLOD().enable(enabled);
                printf("\\nLOD %s\\n", enabled ? "ENABLED" : "DISABLED");
            } break;

            // Set LOD levels (1=4, 2=8, 3=12, 4=16)
            case '1': numLevels = 4;  autoLOD().setLevels(4);
                      printf("\\nLOD Levels: 4\\n"); break;
            case '2': numLevels = 8;  autoLOD().setLevels(8);
                      printf("\\nLOD Levels: 8\\n"); break;
            case '3': numLevels = 12; autoLOD().setLevels(12);
                      printf("\\nLOD Levels: 12\\n"); break;
            case '4': numLevels = 16; autoLOD().setLevels(16);
                      printf("\\nLOD Levels: 16 (maximum)\\n"); break;

            // Adjust distance scale (unified slider concept)
            case 'd': case 'D':
                distScale = std::max(0.25f, distScale - 0.25f);
                autoLOD().setDistanceScale(distScale);
                printf("\\nDistance Scale: %.2f (lower = more aggressive LOD)\\n", distScale);
                break;
            case 'f': case 'F':
                distScale = std::min(4.0f, distScale + 0.25f);
                autoLOD().setDistanceScale(distScale);
                printf("\\nDistance Scale: %.2f (higher = more detail at distance)\\n", distScale);
                break;

            // Toggle unload
            case 'u': case 'U':
                unloadEnabled = !unloadEnabled;
                autoLOD().setUnloadEnabled(unloadEnabled);
                printf("\\nUnload: %s (meshes hidden beyond %.0f * scale)\\n",
                       unloadEnabled ? "ENABLED" : "DISABLED", unloadDist);
                break;

            // Cycle selection mode
            case 'm': case 'M': {
                lodMode = (lodMode + 1) % 3;
                autoLOD().setSelectionMode(static_cast<LODSelectionMode>(lodMode));
                const char* names[] = {"Distance", "ScreenSize", "ScreenError"};
                printf("\\nLOD Mode: %s\\n", names[lodMode]);
            } break;
        }
        updateCamera();
        return true;
    }
};

int main() {
    LODDemo app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-mesh-lod-group',
    title: 'Auto-LOD Many Objects',
    description: 'LOD + unload for hundreds of objects with distance scale',
    category: 'studio-meshes',
    subcategory: 'procedural',
    code: `/**
 * Auto-LOD Many Objects with Unload
 *
 * Shows automatic LOD working seamlessly with many objects.
 * Features distance scale and unload for performance optimization.
 *
 * NEW: Objects beyond unload distance are completely hidden!
 * This dramatically improves performance for large scenes.
 *
 * Controls:
 *   Arrow keys: Orbit camera
 *   W/S: Zoom in/out
 *   D/F: Decrease/Increase distance scale
 *   U: Toggle unload feature
 *   1-4: Set LOD levels (4, 8, 12, 16)
 *   +/-: Adjust exposure
 */

#include "al_WebApp.hpp"
#include "al_WebEnvironment.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <vector>

using namespace al;

class AutoLODManyDemo : public WebApp {
public:
    WebEnvironment env;
    Mesh sphere;
    Mesh floor;
    std::vector<Vec3f> positions;
    double time = 0;
    float camAngleX = 0.3f, camAngleY = 0.4f;
    float camDist = 20.0f;
    float distScale = 1.0f;
    bool unloadEnabled = true;
    float unloadDist = 35.0f;
    int numLevels = 8;

    void onCreate() override {
        // Enable Auto-LOD with extended features
        autoLOD().enable(true);
        autoLOD().setLevels(numLevels);  // 8 LOD levels for smooth transitions
        autoLOD().setDistanceScale(distScale);
        autoLOD().setUnloadEnabled(unloadEnabled);  // Enable unloading!
        autoLOD().setUnloadDistance(unloadDist);  // Unload beyond 35 units
        autoLOD().enableStats(true);

        printf("[LOD Many] %d levels, unload at %.0f, scale %.1f\\n",
               numLevels, unloadDist, distScale);
        printf("  D/F: distance scale, U: toggle unload, 1-4: levels\\n");

        // Load HDR environment
        env.load("/assets/environments/kloppenheim_02_puresky_1k.hdr");
        env.exposure(1.2f);

        // Create a high-poly sphere (auto-LOD will simplify as needed)
        addSphere(sphere, 0.4, 32, 32);
        sphere.generateNormals();

        // Create larger grid of object positions
        for (int x = -7; x <= 7; x++) {
            for (int z = -7; z <= 7; z++) {
                positions.push_back(Vec3f(x * 2.5f, 0.4f, z * 2.5f));
            }
        }

        // Floor
        addSurface(floor, 50, 50, 20, 20);
        floor.generateNormals();

        printf("Created %zu objects - some will be unloaded at distance!\\n", positions.size());
        updateCamera();
    }

    void updateCamera() {
        float x = camDist * sin(camAngleX) * cos(camAngleY);
        float y = camDist * sin(camAngleY) + 2.0f;
        float z = camDist * cos(camAngleX) * cos(camAngleY);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(0, 0, 0), Vec3f(0, 1, 0));
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);

        // Draw HDR skybox
        env.drawSkybox(g);
        g.depthTesting(true);

        // Draw all spheres - LOD + unload is automatic!
        env.beginReflect(g, nav().pos(), 0.7f);
        for (const auto& pos : positions) {
            g.pushMatrix();
            g.translate(pos);
            drawLOD(g, sphere);  // Auto-LOD + unload!
            g.popMatrix();
        }
        env.endReflect();

        // Floor
        g.lighting(true);
        g.pushMatrix();
        g.rotate(-90, 1, 0, 0);
        g.color(0.2, 0.2, 0.22);
        g.draw(floor);
        g.popMatrix();

        // Count visible objects (those with triangles)
        int tris = autoLOD().frameTriangles();
        printf("\\rObjects: %zu | Tris: %d | Scale: %.1f | Unload: %s@%.0f    ",
               positions.size(), tris, distScale,
               unloadEnabled ? "ON" : "OFF", unloadDist * distScale);
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case Keyboard::LEFT:  camAngleX -= 0.12f; break;
            case Keyboard::RIGHT: camAngleX += 0.12f; break;
            case Keyboard::UP:    camAngleY = std::min(1.3f, camAngleY + 0.1f); break;
            case Keyboard::DOWN:  camAngleY = std::max(0.1f, camAngleY - 0.1f); break;
            case 'w': case 'W':   camDist = std::max(5.0f, camDist - 3.0f); break;
            case 's': case 'S':   camDist = std::min(80.0f, camDist + 3.0f); break;
            case '+': case '=':   env.exposure(env.exposure() + 0.2f); break;
            case '-':             env.exposure(std::max(0.3f, env.exposure() - 0.2f)); break;

            // Distance scale
            case 'd': case 'D':
                distScale = std::max(0.25f, distScale - 0.25f);
                autoLOD().setDistanceScale(distScale);
                printf("\\nDistance Scale: %.2f\\n", distScale);
                break;
            case 'f': case 'F':
                distScale = std::min(4.0f, distScale + 0.25f);
                autoLOD().setDistanceScale(distScale);
                printf("\\nDistance Scale: %.2f\\n", distScale);
                break;

            // Toggle unload
            case 'u': case 'U':
                unloadEnabled = !unloadEnabled;
                autoLOD().setUnloadEnabled(unloadEnabled);
                printf("\\nUnload: %s\\n", unloadEnabled ? "ENABLED" : "DISABLED");
                break;

            // LOD levels
            case '1': numLevels = 4;  autoLOD().setLevels(4);
                      printf("\\nLOD Levels: 4\\n"); break;
            case '2': numLevels = 8;  autoLOD().setLevels(8);
                      printf("\\nLOD Levels: 8\\n"); break;
            case '3': numLevels = 12; autoLOD().setLevels(12);
                      printf("\\nLOD Levels: 12\\n"); break;
            case '4': numLevels = 16; autoLOD().setLevels(16);
                      printf("\\nLOD Levels: 16\\n"); break;
        }
        updateCamera();
        return true;
    }
};

int main() {
    AutoLODManyDemo app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-mesh-lod-controller',
    title: 'Auto-LOD with PBR',
    description: 'Automatic LOD combined with PBR materials',
    category: 'studio-meshes',
    subcategory: 'procedural',
    code: `/**
 * Auto-LOD with PBR Materials
 *
 * Shows how automatic LOD integrates seamlessly with
 * PBR materials. AUTO-LOD IS ON BY DEFAULT!
 * Just use g.draw() normally - LOD is transparent.
 *
 * Uses Unreal Engine-style screen-size selection.
 *
 * Controls:
 *   Arrow keys: Orbit camera
 *   W/S: Zoom in/out (watch LOD change!)
 *   +/-: Adjust exposure
 *   B: Cycle LOD bias
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"
#include "al_WebPBR.hpp"

using namespace al;

class AutoLODwithPBR : public WebApp {
public:
    WebOBJ loader;
    WebPBR pbr;
    Mesh bunnyMesh;
    double angle = 0;
    float camAngleX = 0.5f, camAngleY = 0.3f;
    float camDist = 8.0f;
    bool meshLoaded = false;

    void onCreate() override {
        // Enable Auto-LOD with custom settings (call methods directly)
        autoLOD().enable(true);  // Enable LOD system
        autoLOD().setLevels(4);  // 4 LOD levels
        autoLOD().setDistances({8, 20, 40, 80});  // Custom thresholds
        autoLOD().enableStats(true);  // Track triangle counts
        printf("[LOD Init] Enabled: %d\\n", autoLOD().enabled());

        // Load high-poly mesh
        loader.load("/assets/meshes/bunny.obj", [this](bool success) {
            if (success) {
                bunnyMesh = loader.mesh();
                bunnyMesh.fitToSphere(1.0);
                bunnyMesh.generateNormals();
                meshLoaded = true;
                printf("Mesh loaded! Auto-LOD will handle simplification\\n");
            }
        });

        // Load PBR environment
        pbr.loadEnvironment("/assets/environments/studio_small_09_1k.hdr");
        pbr.exposure(1.3f);

        updateCamera();
    }

    void updateCamera() {
        float x = camDist * sin(camAngleX) * cos(camAngleY);
        float y = camDist * sin(camAngleY) + 0.3f;
        float z = camDist * cos(camAngleX) * cos(camAngleY);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(0, 0.3, 0), Vec3f(0, 1, 0));
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05, 0.05, 0.08);

        if (!meshLoaded) {
            // Loading indicator
            g.lighting(true);
            g.pushMatrix();
            g.rotate(angle * 2, 1, 1, 0);
            g.color(0.5, 0.5, 0.6);
            Mesh cube;
            addCube(cube, 0.3);
            g.draw(cube);
            g.popMatrix();
            return;
        }

        pbr.drawSkybox(g);
        g.depthTesting(true);

        // Draw with PBR - LOD is automatic!
        pbr.begin(g, nav().pos());
        PBRMaterial mat = PBRMaterial::Gold();
        pbr.material(mat);
        g.pushMatrix();
        g.translate(0, 0.3, 0);
        g.rotate(angle, 0, 1, 0);
        g.draw(bunnyMesh);  // Auto-LOD + PBR - just works!
        g.popMatrix();
        pbr.end(g);

        // Floor
        g.lighting(true);
        g.pushMatrix();
        g.translate(0, -0.5, 0);
        g.rotate(-90, 1, 0, 0);
        g.color(0.15, 0.15, 0.18);
        Mesh floor;
        addSurface(floor, 20, 20, 10, 10);
        g.draw(floor);
        g.popMatrix();

        int level = autoLOD().getLevelForDistance(camDist);
        printf("\\rDist: %.1f | LOD: %d | Tris: %d    ",
               camDist, level, autoLOD().frameTriangles());
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case Keyboard::LEFT:  camAngleX -= 0.15f; break;
            case Keyboard::RIGHT: camAngleX += 0.15f; break;
            case Keyboard::UP:    camAngleY = std::min(1.2f, camAngleY + 0.1f); break;
            case Keyboard::DOWN:  camAngleY = std::max(-0.1f, camAngleY - 0.1f); break;
            case 'w': case 'W':   camDist = std::max(2.0f, camDist - 2.0f); break;
            case 's': case 'S':   camDist = std::min(100.0f, camDist + 3.0f); break;
            case '+': case '=':   pbr.exposure(pbr.exposure() + 0.2f); break;
            case '-':             pbr.exposure(std::max(0.3f, pbr.exposure() - 0.2f)); break;
            case 'b': case 'B': {
                float bias = autoLOD().bias();
                bias = (bias >= 2.0f) ? 0.5f : bias + 0.5f;
                autoLOD().setBias(bias);
                printf("\\nLOD Bias: %.1f\\n", bias);
            } break;
        }
        updateCamera();
        return true;
    }
};

int main() {
    AutoLODwithPBR app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-mesh-texture-lod',
    title: 'Texture LOD Demo',
    description: 'Distance-based texture resolution switching',
    category: 'studio-meshes',
    subcategory: 'procedural',
    code: `/**
 * Texture LOD Demo
 *
 * Demonstrates TextureLOD for automatic texture
 * resolution selection based on camera distance.
 */

#include "al_WebApp.hpp"
#include "al_WebLOD.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class TextureLODDemo : public WebApp {
public:
    Mesh sphere;
    TextureLOD texLOD;
    double angle = 0;
    float cameraDistance = 5;

    void onCreate() override {
        addSphere(sphere, 1.0, 64, 64);
        sphere.generateNormals();

        // Setup texture LOD levels
        texLOD.setLevels({2048, 1024, 512, 256});
        texLOD.setDistances({8, 20, 40, 80});

        printf("Texture LOD: 2048 -> 1024 -> 512 -> 256px\\n");
        printf("Press +/- to change distance\\n");

        nav().pos(0, 0, cameraDistance);
    }

    void onAnimate(double dt) override {
        angle += dt * 30.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1, 0.1, 0.15);
        g.depthTesting(true);
        g.lighting(true);

        int level = texLOD.selectLevel(cameraDistance);
        int resolution = texLOD.getResolution(level);
        float quality = 1.0f - (float)level / 3.0f;

        g.pushMatrix();
        g.rotate(angle, 0, 1, 0);
        g.color(0.2 + quality * 0.7, 0.5 + quality * 0.4, 0.8);
        g.draw(sphere);
        g.popMatrix();

        printf("\\rDistance: %.1f | Texture LOD: %d | Resolution: %dpx    ",
               cameraDistance, level, resolution);
    }

    bool onKeyDown(Keyboard const& k) override {
        if (k.key() == '=' || k.key() == '+') {
            cameraDistance = std::max(2.0f, cameraDistance - 2.0f);
            nav().pos(0, 0, cameraDistance);
        } else if (k.key() == '-') {
            cameraDistance = std::min(100.0f, cameraDistance + 2.0f);
            nav().pos(0, 0, cameraDistance);
        }
        return true;
    }
};

int main() {
    TextureLODDemo app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-mesh-shader-lod',
    title: 'Shader LOD Demo',
    description: 'Distance-based shader complexity switching',
    category: 'studio-meshes',
    subcategory: 'procedural',
    code: `/**
 * Shader LOD Demo
 *
 * Demonstrates ShaderLOD for automatic shader
 * complexity selection based on camera distance.
 *
 * Levels: Full PBR -> Standard -> Simple -> Minimal
 */

#include "al_WebApp.hpp"
#include "al_WebLOD.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class ShaderLODDemo : public WebApp {
public:
    Mesh sphere;
    ShaderLOD shaderLOD;
    double angle = 0;
    float cameraDistance = 5;

    void onCreate() override {
        addSphere(sphere, 1.0, 48, 48);
        sphere.generateNormals();

        shaderLOD.setLevels(4);
        shaderLOD.setDistances({12, 30, 60, 100});

        printf("Shader LOD: Full -> Standard -> Simple -> Minimal\\n");
        printf("Press +/- to change distance\\n");

        nav().pos(0, 0, cameraDistance);
    }

    void onAnimate(double dt) override {
        angle += dt * 25.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08, 0.08, 0.12);
        g.depthTesting(true);

        int level = shaderLOD.selectByDistance(cameraDistance);

        g.pushMatrix();
        g.rotate(angle, 0.2, 1, 0.1);

        if (shaderLOD.reflections(level)) {
            g.lighting(true);
            g.color(0.95, 0.85, 0.4);
        } else if (shaderLOD.normalMapping(level)) {
            g.lighting(true);
            g.color(0.85, 0.75, 0.35);
        } else if (shaderLOD.shadowReceive(level)) {
            g.lighting(true);
            g.color(0.7, 0.6, 0.3);
        } else {
            g.lighting(false);
            g.color(0.5, 0.4, 0.2);
        }

        g.draw(sphere);
        g.popMatrix();

        const char* names[] = {"Full PBR", "Standard", "Simple", "Minimal"};
        printf("\\rDist: %.1f | Shader: %d (%s) | Lights: %d    ",
               cameraDistance, level, names[level], shaderLOD.lightCount(level));
    }

    bool onKeyDown(Keyboard const& k) override {
        if (k.key() == '=' || k.key() == '+') {
            cameraDistance = std::max(2.0f, cameraDistance - 3.0f);
            nav().pos(0, 0, cameraDistance);
        } else if (k.key() == '-') {
            cameraDistance = std::min(150.0f, cameraDistance + 3.0f);
            nav().pos(0, 0, cameraDistance);
        }
        return true;
    }
};

int main() {
    ShaderLODDemo app;
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - TEMPLATES - Starter Projects
  // ==========================================================================
  {
    id: 'studio-template-av',
    title: 'Audio-Visual Starter',
    description: 'Complete starter template for audio-visual projects',
    category: 'studio-templates',
    subcategory: 'starter',
    code: `/**
 * Audio-Visual Starter Template
 *
 * A complete starting point for audio-visual projects
 * with synth voice, visuals, and keyboard control.
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"

using namespace al;

// Simple synth voice with visuals
class AVVoice : public SynthVoice {
public:
    gam::Sine<> osc;
    gam::Env<3> env;
    Mesh mesh;
    float visualSize = 0;

    void init() override {
        env.levels(0, 1, 0.7, 0);
        env.lengths(0.05, 0.1, 0.3);
        env.curve(-4);
        env.sustainPoint(2);

        addSphere(mesh, 0.5, 24, 24);
        mesh.generateNormals();

        createInternalTriggerParameter("frequency", 440, 20, 2000);
        createInternalTriggerParameter("amplitude", 0.3, 0, 1);
    }

    void onProcess(AudioIOData& io) override {
        float freq = getInternalParameterValue("frequency");
        float amp = getInternalParameterValue("amplitude");
        osc.freq(freq);

        while (io()) {
            float s = osc() * env() * amp;
            visualSize = env.value();
            io.out(0) += s;
            io.out(1) += s;
        }

        if (env.done()) free();
    }

    void onProcess(Graphics& g) override {
        g.pushMatrix();
        g.scale(visualSize * 2);
        g.color(HSV(getInternalParameterValue("frequency") / 1000.0, 0.8, 1));
        g.draw(mesh);
        g.popMatrix();
    }

    void onTriggerOn() override {
        env.reset();
    }

    void onTriggerOff() override {
        env.release();
    }
};

class AVStarter : public WebApp {
public:
    PolySynth synth;

    void onCreate() override {
        synth.allocatePolyphony<AVVoice>(16);
        nav().pos(0, 0, 10);
    }

    void onSound(AudioIOData& io) override {
        synth.render(io);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1);
        g.depthTesting(true);
        g.lighting(true);
        synth.render(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        // Map keyboard to frequencies (simple piano layout)
        static const float freqs[] = {
            261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25
        };

        int note = -1;
        switch (k.key()) {
            case 'a': note = 0; break;
            case 's': note = 1; break;
            case 'd': note = 2; break;
            case 'f': note = 3; break;
            case 'j': note = 4; break;
            case 'k': note = 5; break;
            case 'l': note = 6; break;
            case ';': note = 7; break;
        }

        if (note >= 0) {
            auto* voice = synth.getVoice<AVVoice>();
            voice->setInternalParameterValue("frequency", freqs[note]);
            voice->setInternalParameterValue("amplitude", 0.3);
            synth.triggerOn(voice);
        }

        return true;
    }

    bool onKeyUp(Keyboard const& k) override {
        synth.triggerOff();
        return true;
    }
};

int main() {
    AVStarter app;
    app.configureAudio(44100, 512, 2, 0);
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - TEMPLATES - Showcase
  // ==========================================================================
  {
    id: 'studio-showcase-particles',
    title: 'Particle Galaxy',
    description: 'Stunning particle system with audio reactivity',
    category: 'studio-templates',
    subcategory: 'showcase',
    code: `/**
 * Particle Galaxy Showcase
 *
 * A visually impressive particle system that responds
 * to audio input with swirling galaxy-like motion.
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
#include <vector>
#include <cmath>

using namespace al;

struct Particle {
    Vec3f pos;
    Vec3f vel;
    float life;
    float maxLife;
    HSV color;
};

class ParticleGalaxy : public WebApp {
public:
    std::vector<Particle> particles;
    Mesh particleMesh;
    double time = 0;
    gam::Sine<> lfo1, lfo2;

    const int NUM_PARTICLES = 5000;

    void onCreate() override {
        particles.resize(NUM_PARTICLES);

        lfo1.freq(0.1);
        lfo2.freq(0.07);

        // Initialize particles in spiral pattern
        for (int i = 0; i < NUM_PARTICLES; i++) {
            resetParticle(particles[i], i);
        }

        addSphere(particleMesh, 0.02, 6, 6);

        nav().pos(0, 5, 15);
        nav().faceToward(Vec3d(0, 0, 0));
    }

    void resetParticle(Particle& p, int index) {
        float angle = (float)index / NUM_PARTICLES * M_2PI * 5;
        float radius = 2.0 + (float)index / NUM_PARTICLES * 6.0;
        float height = sin(angle * 3) * 0.5;

        p.pos = Vec3f(
            cos(angle) * radius,
            height,
            sin(angle) * radius
        );
        p.vel = Vec3f(0, 0, 0);
        p.life = 1.0;
        p.maxLife = 3.0 + (rand() % 100) / 50.0;
        p.color = HSV(angle / M_2PI, 0.8, 1.0);
    }

    void onAnimate(double dt) override {
        time += dt;

        float mod1 = lfo1();
        float mod2 = lfo2();

        for (auto& p : particles) {
            // Spiral motion around center
            Vec3f toCenter = -p.pos;
            toCenter.y = 0;
            float dist = toCenter.mag();

            if (dist > 0.1) {
                Vec3f tangent(-toCenter.z, 0, toCenter.x);
                tangent.normalize();

                // Orbital velocity
                float orbitalSpeed = 2.0 / sqrt(dist);
                p.vel = tangent * orbitalSpeed;

                // Slight inward pull
                p.vel += toCenter.normalize() * 0.1;

                // Vertical oscillation
                p.vel.y = sin(time + dist) * 0.5 * (1.0 + mod1);
            }

            p.pos += p.vel * dt;

            // Color shifts over time
            p.color.h = fmod(p.color.h + dt * 0.05, 1.0);

            p.life -= dt / p.maxLife;
            if (p.life <= 0) {
                resetParticle(p, rand() % NUM_PARTICLES);
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02, 0.02, 0.05);
        g.depthTesting(true);
        g.blending(true);
        g.blendAdd();

        for (const auto& p : particles) {
            g.pushMatrix();
            g.translate(p.pos);

            float alpha = p.life * 0.8;
            Color c = p.color;
            g.color(c.r * alpha, c.g * alpha, c.b * alpha);

            g.draw(particleMesh);
            g.popMatrix();
        }
    }
};

int main() {
    ParticleGalaxy app;
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - SHOWCASES - Big Demos
  // ==========================================================================
  {
    id: 'studio-showcase-pbr-gallery',
    title: 'PBR Material Gallery',
    description: 'Comprehensive showcase of PBR materials with HDR lighting',
    category: 'studio-templates',
    subcategory: 'showcase',
    code: `/**
 * PBR Material Gallery
 *
 * A stunning showcase of physically-based rendering with
 * various materials: gold, silver, copper, jade, ruby,
 * and more, all lit by HDR image-based lighting.
 *
 * Controls:
 *   Arrow keys: Orbit camera
 *   W/S: Zoom in/out
 *   1-4: Change HDR environment
 *   +/-: Adjust exposure
 */

#include "al_WebApp.hpp"
#include "al_WebPBR.hpp"
#include "al_WebOBJ.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class PBRGallery : public WebApp {
public:
    WebPBR pbr;
    WebOBJ objLoader;
    Mesh sphere;
    Mesh floor;
    Mesh teapot;
    Mesh pedestal;
    double time = 0;
    float camAngleX = 0.0f, camAngleY = 0.35f;
    float camDist = 12.0f;
    bool teapotLoaded = false;
    int currentEnv = 0;

    const char* envPaths[4] = {
        "/assets/environments/studio_small_09_1k.hdr",
        "/assets/environments/museum_of_ethnography_1k.hdr",
        "/assets/environments/kloofendal_48d_partly_cloudy_puresky_1k.hdr",
        "/assets/environments/empty_warehouse_01_1k.hdr"
    };

    // Material definitions
    struct MaterialDef {
        const char* name;
        Vec3f albedo;
        float metallic;
        float roughness;
    };

    MaterialDef materials[7] = {
        {"Gold",     Vec3f(1.0, 0.84, 0.0), 1.0, 0.15},
        {"Silver",   Vec3f(0.95, 0.95, 0.97), 1.0, 0.1},
        {"Copper",   Vec3f(0.95, 0.64, 0.54), 1.0, 0.2},
        {"Jade",     Vec3f(0.0, 0.66, 0.42), 0.0, 0.3},
        {"Ruby",     Vec3f(0.88, 0.07, 0.37), 0.0, 0.15},
        {"Chrome",   Vec3f(0.55, 0.55, 0.55), 1.0, 0.05},
        {"Obsidian", Vec3f(0.05, 0.05, 0.07), 0.0, 0.1}
    };

    void onCreate() override {
        // Load initial environment
        pbr.loadEnvironment(envPaths[0]);
        pbr.exposure(1.5f);

        // Create sphere for material samples
        addSphere(sphere, 0.5, 48, 48);
        sphere.generateNormals();

        // Create floor
        addSurface(floor, 30, 30, 20, 20);
        floor.generateNormals();

        // Create pedestal
        addCylinder(pedestal, 0.15, 0.6, 24, 2, 2);
        pedestal.generateNormals();

        // Load teapot for center piece
        objLoader.load("/assets/meshes/teapot.obj", [this](bool success) {
            if (success) {
                teapot = objLoader.mesh();
                teapot.fitToSphere(1.2);
                teapotLoaded = true;
            }
        });

        updateCamera();
    }

    void updateCamera() {
        float x = camDist * sin(camAngleX) * cos(camAngleY);
        float y = camDist * sin(camAngleY) + 2.0f;
        float z = camDist * cos(camAngleX) * cos(camAngleY);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(0, 1.0, 0), Vec3f(0, 1, 0));
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);

        // Draw HDR skybox
        pbr.drawSkybox(g);
        g.depthTesting(true);

        // All rendering uses PBR for consistent lighting
        pbr.begin(g, nav().pos());

        // Draw floor with dark material
        PBRMaterial floorMat;
        floorMat.albedo = Vec3f(0.15, 0.15, 0.18);
        floorMat.metallic = 0.0;
        floorMat.roughness = 0.8;
        pbr.material(floorMat);
        g.pushMatrix();
        g.translate(0, 0, 0);
        g.rotate(-90, 1, 0, 0);
        g.draw(floor);
        g.popMatrix();

        // Pedestal material (dark stone look)
        PBRMaterial pedestalMat;
        pedestalMat.albedo = Vec3f(0.2, 0.2, 0.22);
        pedestalMat.metallic = 0.0;
        pedestalMat.roughness = 0.6;

        // Draw material spheres in a semicircle
        for (int i = 0; i < 7; i++) {
            float angle = (i - 3) * 0.4f;
            float x = sin(angle) * 5.0f;
            float z = cos(angle) * 5.0f - 3.0f;

            // Draw pedestal with stone material
            pbr.material(pedestalMat);
            g.pushMatrix();
            g.translate(x, 0.3f, z);
            g.draw(pedestal);
            g.popMatrix();

            // Draw sphere with showcase material
            PBRMaterial mat;
            mat.albedo = materials[i].albedo;
            mat.metallic = materials[i].metallic;
            mat.roughness = materials[i].roughness;
            pbr.material(mat);

            g.pushMatrix();
            g.translate(x, 1.1f, z);
            g.rotate(time * 15, 0, 1, 0);
            g.draw(sphere);
            g.popMatrix();
        }

        // Draw center piece teapot in gold
        if (teapotLoaded) {
            PBRMaterial goldMat = PBRMaterial::Gold();
            pbr.material(goldMat);

            g.pushMatrix();
            g.translate(0, 1.5f, 0);
            g.rotate(time * 10, 0, 1, 0);
            g.draw(teapot);
            g.popMatrix();

            // Center pedestal
            pbr.material(pedestalMat);
            g.pushMatrix();
            g.translate(0, 0.3f, 0);
            g.scale(1.5, 1, 1.5);
            g.draw(pedestal);
            g.popMatrix();
        }

        pbr.end(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case Keyboard::LEFT:  camAngleX -= 0.12f; break;
            case Keyboard::RIGHT: camAngleX += 0.12f; break;
            case Keyboard::UP:    camAngleY = std::min(1.2f, camAngleY + 0.08f); break;
            case Keyboard::DOWN:  camAngleY = std::max(0.1f, camAngleY - 0.08f); break;
            case 'w': case 'W':   camDist = std::max(5.0f, camDist - 1.0f); break;
            case 's': case 'S':   camDist = std::min(25.0f, camDist + 1.0f); break;
            case '1': case '2': case '3': case '4':
                currentEnv = k.key() - '1';
                pbr.loadEnvironment(envPaths[currentEnv]);
                printf("Environment: %d\\n", currentEnv + 1);
                break;
            case '+': case '=':   pbr.exposure(pbr.exposure() + 0.2f); break;
            case '-':             pbr.exposure(std::max(0.3f, pbr.exposure() - 0.2f)); break;
        }
        updateCamera();
        return true;
    }
};

int main() {
    PBRGallery app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-showcase-museum',
    title: 'Virtual Museum',
    description: 'Interactive 3D museum with classic models and HDR lighting',
    category: 'studio-templates',
    subcategory: 'showcase',
    code: `/**
 * Virtual Museum Showcase
 *
 * An immersive 3D museum featuring classic computer graphics
 * test models with HDR lighting and environment reflections.
 *
 * Controls:
 *   Arrow keys: Orbit camera
 *   W/S: Zoom in/out
 *   A/D: Pan left/right
 *   +/-: Adjust exposure
 *   Space: Toggle auto-rotate
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"
#include "al_WebEnvironment.hpp"
#include "al_WebPBR.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class VirtualMuseum : public WebApp {
public:
    WebOBJ loaders[4];
    WebEnvironment env;
    WebPBR pbr;
    Mesh bunny, teapot, suzanne, spot;
    Mesh floor, wall;
    Mesh pedestal;
    double time = 0;
    float camAngleX = 0.0f, camAngleY = 0.25f;
    float camDist = 15.0f;
    float panX = 0;
    bool autoRotate = true;
    int loadedCount = 0;

    void onCreate() override {
        // Load HDR environment
        env.load("/assets/environments/museum_of_ethnography_1k.hdr");
        env.exposure(1.3f);

        pbr.loadEnvironment("/assets/environments/museum_of_ethnography_1k.hdr");
        pbr.exposure(1.3f);

        // Load all models
        loaders[0].load("/assets/meshes/bunny.obj", [this](bool s) {
            if (s) { bunny = loaders[0].mesh(); bunny.fitToSphere(1.0); loadedCount++; }
        });
        loaders[1].load("/assets/meshes/teapot.obj", [this](bool s) {
            if (s) { teapot = loaders[1].mesh(); teapot.fitToSphere(1.0); loadedCount++; }
        });
        loaders[2].load("/assets/meshes/suzanne.obj", [this](bool s) {
            if (s) { suzanne = loaders[2].mesh(); suzanne.fitToSphere(0.9); loadedCount++; }
        });
        loaders[3].load("/assets/meshes/spot.obj", [this](bool s) {
            if (s) { spot = loaders[3].mesh(); spot.fitToSphere(1.0); loadedCount++; }
        });

        // Create floor
        addSurface(floor, 40, 40, 30, 30);
        floor.generateNormals();

        // Create walls
        addSurface(wall, 40, 15, 20, 8);
        wall.generateNormals();

        // Create pedestal
        addCylinder(pedestal, 0.8, 1.0, 32, 2, 2);
        pedestal.generateNormals();

        updateCamera();
    }

    void updateCamera() {
        float x = camDist * sin(camAngleX) * cos(camAngleY) + panX;
        float y = camDist * sin(camAngleY) + 2.5f;
        float z = camDist * cos(camAngleX) * cos(camAngleY);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(panX, 1.5f, 0), Vec3f(0, 1, 0));
    }

    void onAnimate(double dt) override {
        time += dt;
        if (autoRotate) {
            camAngleX += dt * 0.1f;
            updateCamera();
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);

        // Draw HDR skybox
        env.drawSkybox(g);
        g.depthTesting(true);

        // Draw floor - dark polished
        g.lighting(true);
        g.pushMatrix();
        g.rotate(-90, 1, 0, 0);
        g.color(0.08, 0.08, 0.1);
        g.draw(floor);
        g.popMatrix();

        // Draw back wall
        g.pushMatrix();
        g.translate(0, 7.5, -20);
        g.color(0.12, 0.12, 0.15);
        g.draw(wall);
        g.popMatrix();

        // Model positions
        float positions[4][2] = {{-6, -3}, {6, -3}, {-6, 5}, {6, 5}};
        Mesh* models[4] = {&bunny, &teapot, &suzanne, &spot};

        // Draw pedestals and models
        for (int i = 0; i < 4; i++) {
            float x = positions[i][0];
            float z = positions[i][1];

            // Pedestal
            g.pushMatrix();
            g.translate(x, 0.5f, z);
            g.color(0.2, 0.2, 0.25);
            g.draw(pedestal);
            g.popMatrix();

            // Model with environment reflection
            if (loadedCount > i && models[i]->vertices().size() > 0) {
                env.beginReflect(g, nav().pos(), 0.75f);
                g.pushMatrix();
                g.translate(x, 2.0f, z);
                g.rotate(time * 20, 0, 1, 0);
                g.draw(*models[i]);
                g.popMatrix();
                env.endReflect();
            }
        }

        // Draw a center piece - reflective sphere
        env.beginReflect(g, nav().pos(), 0.95f);
        g.pushMatrix();
        g.translate(0, 3.5f, 1);
        Mesh centerSphere;
        addSphere(centerSphere, 1.2, 48, 48);
        centerSphere.generateNormals();
        g.draw(centerSphere);
        g.popMatrix();
        env.endReflect();

        // Center pedestal (taller)
        g.pushMatrix();
        g.translate(0, 1.0f, 1);
        g.scale(1.2, 2, 1.2);
        g.color(0.15, 0.15, 0.18);
        g.draw(pedestal);
        g.popMatrix();
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case Keyboard::LEFT:  camAngleX -= 0.15f; break;
            case Keyboard::RIGHT: camAngleX += 0.15f; break;
            case Keyboard::UP:    camAngleY = std::min(1.0f, camAngleY + 0.08f); break;
            case Keyboard::DOWN:  camAngleY = std::max(0.05f, camAngleY - 0.08f); break;
            case 'w': case 'W':   camDist = std::max(6.0f, camDist - 1.0f); break;
            case 's': case 'S':   camDist = std::min(30.0f, camDist + 1.0f); break;
            case 'a': case 'A':   panX -= 1.0f; break;
            case 'd': case 'D':   panX += 1.0f; break;
            case ' ':             autoRotate = !autoRotate; break;
            case '+': case '=':   env.exposure(env.exposure() + 0.2f); break;
            case '-':             env.exposure(std::max(0.3f, env.exposure() - 0.2f)); break;
        }
        updateCamera();
        return true;
    }
};

int main() {
    VirtualMuseum app;
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - TEXTURES - PROCEDURAL
  // ==========================================================================
  {
    id: 'studio-tex-procedural-noise',
    title: 'Procedural Noise Textures',
    description: 'Generate noise textures at runtime with Perlin and Worley noise',
    category: 'studio-textures',
    subcategory: 'procedural',
    code: `/**
 * Procedural Noise Textures
 *
 * Demonstrates generating procedural textures at runtime
 * and the auto-UV system for texture coordinate generation.
 *
 * Controls:
 *   1: Checkerboard (test pattern)
 *   2: Perlin noise
 *   3: Worley/Cellular noise
 *   4: Worley edges (cell boundaries)
 *   5: Brick pattern
 *   +/-: Adjust noise scale
 *   W/S: Zoom in/out
 *   A/D: Rotate left/right
 *   Arrow Up/Down: Look up/down
 */

#include "al_WebApp.hpp"
#include "al_WebProcedural.hpp"
#include "al_WebAutoUV.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class ProceduralNoiseDemo : public WebApp {
public:
    Mesh sphere;
    Mesh plane;
    Mesh cube;
    Texture noiseTex;
    ProceduralTexture noise;

    int noiseType = 0;
    float noiseScale = 4.0f;
    bool needsUpdate = true;
    float angle = 0;

    // Camera controls
    float camDist = 6.0f;
    float camAngleH = 0.0f;
    float camAngleV = 0.3f;

    void onCreate() override {
        // Create plane and auto-generate UVs
        addSurface(plane, 4, 4);
        plane.generateNormals();
        autoGenerateUVs(plane);  // Auto UV generation!

        // Create sphere and auto-generate UVs
        addSphere(sphere, 1.0, 48, 48);
        sphere.generateNormals();
        generateSphericalUVs(sphere);  // Spherical projection for sphere

        // Create cube and auto-generate UVs
        addCube(cube, 1.2);
        cube.generateNormals();
        generateBoxUVs(cube);  // Box projection for cube

        // Create RGBA texture
        noiseTex.create2D(512, 512, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
        noiseTex.filter(Texture::LINEAR);
        noiseTex.wrap(Texture::REPEAT);

        // Generate initial pattern
        updateNoise();
        updateCamera();
    }

    void updateCamera() {
        float x = camDist * cos(camAngleV) * sin(camAngleH);
        float y = camDist * sin(camAngleV) + 0.5f;
        float z = camDist * cos(camAngleV) * cos(camAngleH);
        nav().pos(x, y, z);
        nav().faceToward(Vec3f(0, 0.5f, 0));
    }

    void updateNoise() {
        switch (noiseType) {
            case 0:
                // Checkerboard test pattern - should show clear squares
                noise.checkerboard(512, 512, 64, 0xFFFFFFFF, 0xFF000000);
                break;
            case 1:
                // High contrast Perlin noise
                noise.perlinNoise(512, 512, noiseScale * 2, 4, 0.5f);
                break;
            case 2:
                // Worley cellular noise
                noise.worleyNoise(512, 512, 32, WorleyMode::F1);
                break;
            case 3:
                // Worley edges (cell boundaries)
                noise.worleyNoise(512, 512, 24, WorleyMode::F2_MINUS_F1);
                break;
            case 4:
                // Brick pattern
                noise.brickPattern(512, 512, 64, 32, 4);
                break;
        }
        // Use Texture's submit() to upload noise data
        noiseTex.submit(noise.pixels());
        needsUpdate = false;
    }

    void onAnimate(double dt) override {
        if (needsUpdate) updateNoise();
        angle += dt * 20;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.2, 0.2, 0.25);
        g.depthTesting(true);

        // Bind texture for all textured objects
        noiseTex.bind(0);
        g.texture();

        // Draw textured plane (floor)
        g.pushMatrix();
        g.translate(0, -0.5, 0);
        g.rotate(-90, 1, 0, 0);
        g.draw(plane);
        g.popMatrix();

        // Draw textured sphere (auto UV)
        g.pushMatrix();
        g.translate(-1.5, 1, 0);
        g.rotate(angle, 0, 1, 0);
        g.draw(sphere);
        g.popMatrix();

        // Draw textured cube (box UV)
        g.pushMatrix();
        g.translate(1.5, 1, 0);
        g.rotate(angle * 0.7f, 1, 1, 0);
        g.draw(cube);
        g.popMatrix();

        noiseTex.unbind(0);
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            // Texture patterns
            case '1': noiseType = 0; needsUpdate = true; break;  // Checkerboard
            case '2': noiseType = 1; needsUpdate = true; break;  // Perlin
            case '3': noiseType = 2; needsUpdate = true; break;  // Worley F1
            case '4': noiseType = 3; needsUpdate = true; break;  // Worley edges
            case '5': noiseType = 4; needsUpdate = true; break;  // Brick
            case '+': case '=': noiseScale += 0.5f; needsUpdate = true; break;
            case '-': noiseScale = std::max(0.5f, noiseScale - 0.5f); needsUpdate = true; break;

            // Camera controls
            case 'w': case 'W': camDist = std::max(2.0f, camDist - 0.5f); updateCamera(); break;
            case 's': case 'S': camDist = std::min(20.0f, camDist + 0.5f); updateCamera(); break;
            case 'a': case 'A': camAngleH += 0.1f; updateCamera(); break;
            case 'd': case 'D': camAngleH -= 0.1f; updateCamera(); break;
            case Keyboard::UP: camAngleV = std::min(1.4f, camAngleV + 0.1f); updateCamera(); break;
            case Keyboard::DOWN: camAngleV = std::max(-0.5f, camAngleV - 0.1f); updateCamera(); break;
        }
        return true;
    }
};

int main() {
    ProceduralNoiseDemo app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-tex-procedural-patterns',
    title: 'Procedural Patterns',
    description: 'Generate pattern textures: brick, wood, marble, checkerboard',
    category: 'studio-textures',
    subcategory: 'procedural',
    code: `/**
 * Procedural Patterns
 *
 * Demonstrates generating pattern textures at runtime
 * including bricks, wood grain, marble, and checkerboard.
 *
 * Controls:
 *   1: Checkerboard
 *   2: Brick pattern
 *   3: Wood grain
 *   4: Marble
 *   W/S: Zoom in/out
 *   A/D: Rotate camera
 */

#include "al_WebApp.hpp"
#include "al_WebProcedural.hpp"
#include "al_WebAutoUV.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class ProceduralPatternsDemo : public WebApp {
public:
    Mesh cube;
    Mesh sphere;
    Mesh floor;
    Texture patternTex;
    ProceduralTexture procTex;

    int patternType = 0;
    float angle = 0;
    float camDist = 6.0f;
    float camAngleH = 0.5f;

    void onCreate() override {
        // Create cube with auto UVs
        addCube(cube, 1.2);
        cube.generateNormals();
        generateBoxUVs(cube);

        // Create sphere with auto UVs
        addSphere(sphere, 0.8, 48, 48);
        sphere.generateNormals();
        generateSphericalUVs(sphere);

        // Create floor with auto UVs
        addSurface(floor, 8, 8);
        floor.generateNormals();
        autoGenerateUVs(floor, 2.0f);  // Tile 2x

        // Create texture
        patternTex.create2D(512, 512, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
        patternTex.filter(Texture::LINEAR);
        patternTex.wrap(Texture::REPEAT);

        updatePattern();
        updateCamera();
    }

    void updatePattern() {
        switch (patternType) {
            case 0:
                procTex.checkerboard(512, 512, 64, 0xFFE0E0E0, 0xFF303030);
                break;
            case 1:
                procTex.brickPattern(512, 512, 64, 32, 4,
                    0xFFC25A3C, 0xFF808080);
                break;
            case 2:
                procTex.woodGrain(512, 512, 8.0f, 15.0f);
                break;
            case 3:
                procTex.marble(512, 512, 3.0f, 5.0f);
                break;
        }
        patternTex.submit(procTex.pixels());
    }

    void updateCamera() {
        float x = camDist * sin(camAngleH);
        float z = camDist * cos(camAngleH);
        nav().pos(x, 2.5f, z);
        nav().faceToward(Vec3f(0, 0.5f, 0));
    }

    void onAnimate(double dt) override {
        angle += dt * 20;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.15, 0.15, 0.2);
        g.depthTesting(true);

        // Bind pattern texture
        patternTex.bind(0);
        g.texture();

        // Draw textured floor
        g.pushMatrix();
        g.translate(0, -0.5, 0);
        g.rotate(-90, 1, 0, 0);
        g.draw(floor);
        g.popMatrix();

        // Draw textured cube
        g.pushMatrix();
        g.translate(-1.5, 0.6, 0);
        g.rotate(angle, 0, 1, 0);
        g.draw(cube);
        g.popMatrix();

        // Draw textured sphere
        g.pushMatrix();
        g.translate(1.5, 0.8, 0);
        g.rotate(angle * 0.7f, 0, 1, 0);
        g.draw(sphere);
        g.popMatrix();

        patternTex.unbind(0);
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case '1': patternType = 0; updatePattern(); break;
            case '2': patternType = 1; updatePattern(); break;
            case '3': patternType = 2; updatePattern(); break;
            case '4': patternType = 3; updatePattern(); break;
            case 'w': case 'W': camDist = std::max(2.0f, camDist - 0.5f); updateCamera(); break;
            case 's': case 'S': camDist = std::min(15.0f, camDist + 0.5f); updateCamera(); break;
            case 'a': case 'A': camAngleH += 0.15f; updateCamera(); break;
            case 'd': case 'D': camAngleH -= 0.15f; updateCamera(); break;
        }
        return true;
    }
};

int main() {
    ProceduralPatternsDemo app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-tex-bunny-uv',
    title: 'Auto UV - Stanford Bunny',
    description: 'Test automatic UV generation on complex loaded mesh',
    category: 'studio-textures',
    subcategory: 'procedural',
    code: `/**
 * Auto UV - Stanford Bunny
 *
 * Tests automatic UV coordinate generation on the
 * Stanford Bunny mesh loaded from OBJ file.
 *
 * Controls:
 *   1-5: Switch texture pattern
 *   W/S: Zoom in/out
 *   A/D: Rotate view
 */

#include "al_WebApp.hpp"
#include "al_WebProcedural.hpp"
#include "al_WebAutoUV.hpp"
#include "al_WebOBJ.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class BunnyTextureDemo : public WebApp {
public:
    Mesh bunny;
    Mesh floor;
    Texture tex;
    ProceduralTexture procTex;
    WebOBJ objLoader;

    int texType = 0;
    bool meshLoaded = false;
    float angle = 0;
    float camDist = 4.0f;
    float camAngleH = 0.5f;

    void onCreate() override {
        // Load Stanford Bunny
        objLoader.load("/assets/meshes/bunny.obj", [this](bool success) {
            if (success) {
                bunny = objLoader.mesh();
                bunny.generateNormals();

                // Auto-generate UV coordinates for the bunny!
                autoGenerateUVs(bunny);

                meshLoaded = true;
            }
        });

        // Create floor
        addSurface(floor, 6, 6);
        floor.generateNormals();
        autoGenerateUVs(floor);

        // Create texture
        tex.create2D(512, 512, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
        tex.filter(Texture::LINEAR);
        tex.wrap(Texture::REPEAT);

        updateTexture();
        updateCamera();
    }

    void updateTexture() {
        switch (texType) {
            case 0: procTex.checkerboard(512, 512, 32); break;
            case 1: procTex.perlinNoise(512, 512, 8.0f, 4); break;
            case 2: procTex.worleyNoise(512, 512, 48, WorleyMode::F1); break;
            case 3: procTex.brickPattern(512, 512, 64, 32, 4); break;
            case 4: procTex.marble(512, 512, 4.0f, 6.0f); break;
        }
        tex.submit(procTex.pixels());
    }

    void updateCamera() {
        float x = camDist * sin(camAngleH);
        float z = camDist * cos(camAngleH);
        nav().pos(x, 1.5f, z);
        nav().faceToward(Vec3f(0, 0.5f, 0));
    }

    void onAnimate(double dt) override {
        angle += dt * 30;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.15, 0.15, 0.18);
        g.depthTesting(true);

        tex.bind(0);
        g.texture();

        // Draw textured floor
        g.pushMatrix();
        g.translate(0, -0.5, 0);
        g.rotate(-90, 1, 0, 0);
        g.draw(floor);
        g.popMatrix();

        // Draw textured bunny
        if (meshLoaded) {
            g.pushMatrix();
            g.translate(0, 0, 0);
            g.rotate(angle, 0, 1, 0);
            g.scale(4.0);  // Bunny is small, scale it up
            g.draw(bunny);
            g.popMatrix();
        }

        tex.unbind(0);

        // Draw loading indicator if not loaded
        if (!meshLoaded) {
            g.lighting(true);
            g.color(0.5, 0.5, 0.5);
            Mesh loadingSphere;
            addSphere(loadingSphere, 0.3, 16, 16);
            g.draw(loadingSphere);
        }
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case '1': texType = 0; updateTexture(); break;
            case '2': texType = 1; updateTexture(); break;
            case '3': texType = 2; updateTexture(); break;
            case '4': texType = 3; updateTexture(); break;
            case '5': texType = 4; updateTexture(); break;
            case 'w': case 'W': camDist = std::max(1.5f, camDist - 0.3f); updateCamera(); break;
            case 's': case 'S': camDist = std::min(10.0f, camDist + 0.3f); updateCamera(); break;
            case 'a': case 'A': camAngleH += 0.15f; updateCamera(); break;
            case 'd': case 'D': camAngleH -= 0.15f; updateCamera(); break;
        }
        return true;
    }
};

int main() {
    BunnyTextureDemo app;
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - TEXTURES - TEXTURE LOD
  // ==========================================================================
  {
    id: 'studio-tex-lod-demo',
    title: 'Texture LOD Demo',
    description: 'Visualize automatic texture LOD level switching based on distance',
    category: 'studio-textures',
    subcategory: 'texture-lod',
    code: `/**
 * Texture LOD Demo
 *
 * Demonstrates automatic texture resolution concepts
 * based on camera distance. Uses the global texture LOD helpers.
 *
 * Controls:
 *   W/S: Move camera forward/backward
 *   Arrow keys: Rotate view
 */

#include "al_WebApp.hpp"
#include "al_WebAutoLOD.hpp"
#include "al_WebPBR.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class TextureLODDemo : public WebApp {
public:
    WebPBR pbr;
    Mesh sphere;

    float camDist = 10.0f;
    float camAngle = 0;
    int lastLOD = -1;

    void onCreate() override {
        pbr.loadEnvironment("/assets/environments/studio_small_09_1k.hdr");

        // Create sphere
        addSphere(sphere, 2.0, 64, 64);
        sphere.generateNormals();

        // Enable auto-LOD (includes texture LOD)
        enableAutoLOD();

        nav().pos(0, 2, camDist);
        nav().faceToward(Vec3f(0, 0, 0));

        printf("[TextureLOD] Move camera (W/S) to see texture LOD changes\\n");
        printf("[TextureLOD] Distance thresholds: 5, 15, 30, 60, 120 units\\n");
    }

    void onAnimate(double dt) override {
        camAngle += dt * 5.0;

        // Update camera position
        nav().pos(camDist * sin(camAngle * 0.1), 2, camDist * cos(camAngle * 0.1));
        nav().faceToward(Vec3f(0, 0, 0));

        // Check LOD level (using global helper from al_WebAutoLOD.hpp)
        float dist = nav().pos().mag();
        int currentLOD = getTextureLOD(dist, 5);
        if (currentLOD != lastLOD) {
            int res = getTextureResolution(dist);
            printf("[TextureLOD] Distance: %.1f, LOD Level: %d, Suggested Resolution: %d\\n",
                   dist, currentLOD, res);
            lastLOD = currentLOD;
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02, 0.02, 0.03);

        pbr.drawSkybox(g);
        g.depthTesting(true);

        pbr.begin(g, nav().pos());

        // Draw sphere - color based on LOD level for visualization
        float dist = nav().pos().mag();
        int level = getTextureLOD(dist, 5);

        // Color-code by LOD level
        Vec3f colors[] = {
            Vec3f(1,0.2,0.2),    // Level 0: Red (highest quality)
            Vec3f(0.2,1,0.2),    // Level 1: Green
            Vec3f(0.2,0.2,1),    // Level 2: Blue
            Vec3f(1,1,0.2),      // Level 3: Yellow
            Vec3f(1,0.2,1)       // Level 4: Magenta (lowest quality)
        };

        PBRMaterial mat;
        mat.albedo = colors[std::min(level, 4)];
        mat.metallic = 0.0f;
        mat.roughness = 0.3f;
        pbr.material(mat);

        g.pushMatrix();
        g.draw(sphere);
        g.popMatrix();

        pbr.end(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case 'w': case 'W': camDist = std::max(3.0f, camDist - 2.0f); break;
            case 's': case 'S': camDist = std::min(150.0f, camDist + 2.0f); break;
        }
        return true;
    }
};

int main() {
    TextureLODDemo app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-tex-mipmap-lod',
    title: 'Mipmap Texture LOD (Unreal-Style)',
    description: 'Continuous texture LOD with procedural textures and GPU mipmaps',
    category: 'studio-textures',
    subcategory: 'texture-lod',
    code: `/**
 * Mipmap Texture LOD Demo
 *
 * Tests GPU mipmap LOD with procedural textures.
 * Move camera closer/farther to see texture detail change.
 *
 * - CLOSE: Sharp texture detail (low mip level)
 * - FAR: Blurry texture (high mip level, GPU auto-selects)
 *
 * The checkerboard pattern (press 3) shows LOD most clearly!
 *
 * Controls:
 *   W/S: Zoom in/out (watch texture blur!)
 *   1/2/3: Brick, Marble, Checkerboard
 */

#include "al_WebApp.hpp"
#include "al_WebPBR.hpp"
#include "al_WebProcedural.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class MipmapLODDemo : public WebApp {
public:
    WebPBR pbr;
    Mesh cube;

    ProceduralTexture albedoTex, normalTex, roughnessTex, aoTex;
    GLuint albedoId = 0, normalId = 0, roughnessId = 0, aoId = 0;

    float camDist = 5.0f;
    float rotation = 0;
    float lastLOD = -1;
    int currentMaterial = 2;  // Start with checkerboard
    bool texturesReady = false;

    void onCreate() override {
        pbr.loadEnvironment("/assets/environments/studio_small_09_1k.hdr");

        addCube(cube, true, 2.0f);
        cube.generateNormals();

        nav().pos(0, 1, camDist);
        nav().faceToward(Vec3f(0, 0, 0));

        printf("\\n=== Mipmap Texture LOD Test ===\\n");
        printf("Move W/S to see mipmap LOD in action!\\n");
        printf("Checkerboard (3) shows it best.\\n\\n");

        generateMaterial(currentMaterial);
    }

    void generateMaterial(int type) {
        currentMaterial = type;
        int res = 1024;

        switch (type) {
            case 0:
                ProceduralPresets::generateBrickPBR(albedoTex, normalTex, roughnessTex, aoTex, res);
                printf("Texture: Brick\\n");
                break;
            case 1:
                ProceduralPresets::generateMarblePBR(albedoTex, normalTex, roughnessTex, res);
                aoTex.fill(res, res, 0xFFFFFFFF);
                printf("Texture: Marble\\n");
                break;
            case 2:
                // High-frequency checkerboard - best for seeing LOD!
                albedoTex.checkerboard(res, res, res/32, 0xFFFFFFFF, 0xFF000000);
                normalTex.fill(res, res, 0xFFFF8080);
                roughnessTex.fill(res, res, 0xFF606060);
                aoTex.fill(res, res, 0xFFFFFFFF);
                printf("Texture: Checkerboard (watch for moire/blur!)\\n");
                break;
        }

        uploadTextures();
        texturesReady = true;
    }

    void uploadTextures() {
        if (albedoId) glDeleteTextures(1, &albedoId);
        if (normalId) glDeleteTextures(1, &normalId);
        if (roughnessId) glDeleteTextures(1, &roughnessId);
        if (aoId) glDeleteTextures(1, &aoId);

        albedoId = albedoTex.createTexture();
        normalId = normalTex.createTexture();
        roughnessId = roughnessTex.createTexture();
        aoId = aoTex.createTexture();
    }

    void onAnimate(double dt) override {
        rotation += dt * 10.0f;

        // Estimate mip level based on distance
        float lod = log2f(camDist / 2.0f);
        lod = std::max(0.0f, lod);

        if (fabs(lod - lastLOD) > 0.15f) {
            printf("Distance: %.1f -> Approx LOD: %.1f\\n", camDist, lod);
            lastLOD = lod;
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02, 0.02, 0.03);
        pbr.drawSkybox(g);
        g.depthTesting(true);

        if (!texturesReady) return;

        glActiveTexture(GL_TEXTURE3);
        glBindTexture(GL_TEXTURE_2D, albedoId);
        glActiveTexture(GL_TEXTURE4);
        glBindTexture(GL_TEXTURE_2D, normalId);
        glActiveTexture(GL_TEXTURE5);
        glBindTexture(GL_TEXTURE_2D, roughnessId);
        glActiveTexture(GL_TEXTURE7);
        glBindTexture(GL_TEXTURE_2D, aoId);

        pbr.begin(g, nav().pos());

        PBRMaterialEx mat;
        mat.albedo = Vec3f(1, 1, 1);
        mat.metallic = 0.0f;
        mat.roughness = 0.5f;
        mat.withAlbedoMap(3).withNormalMap(1.0f, 4).withRoughnessMap(5).withAOMap(7);
        pbr.materialEx(mat);

        g.pushMatrix();
        g.rotate(rotation, 0, 1, 0);
        g.draw(cube);
        g.popMatrix();

        pbr.end(g);
        glActiveTexture(GL_TEXTURE0);
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case '1': generateMaterial(0); break;
            case '2': generateMaterial(1); break;
            case '3': generateMaterial(2); break;
            case 'w': case 'W':
                camDist = std::max(3.0f, camDist - 1.0f);
                nav().pos(0, 0, camDist);
                break;
            case 's': case 'S':
                camDist = std::min(20.0f, camDist + 1.0f);
                nav().pos(0, 0, camDist);
                break;
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(MipmapLODDemo)
`,
  },
  {
    id: 'studio-tex-pbr-mipmap',
    title: 'PBR Textures with Mipmap LOD',
    description: 'Full PBR materials with continuous mipmap LOD for all texture maps',
    category: 'studio-textures',
    subcategory: 'texture-lod',
    code: `/**
 * PBR Textures with Mipmap LOD
 *
 * Demonstrates using PBRMipmapSet for full PBR materials
 * with continuous mipmap LOD on all texture maps:
 * - Albedo
 * - Normal
 * - Roughness
 * - Metallic
 * - AO
 * - Emissive
 *
 * All maps share the same LOD level based on distance.
 *
 * Controls:
 *   W/S: Move camera forward/backward
 *   R: Adjust reference distance
 */

#include "al_WebApp.hpp"
#include "al_WebMipmapTexture.hpp"
#include "al_WebAutoLOD.hpp"
#include "al_WebPBR.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class PBRMipmapDemo : public WebApp {
public:
    WebPBR pbr;
    Mesh sphere;

    float camDist = 15.0f;
    float camAngle = 0;
    float refDistance = 5.0f;

    void onCreate() override {
        pbr.loadEnvironment("/assets/environments/studio_small_09_1k.hdr");

        // Create high-detail sphere
        addSphere(sphere, 2.0, 128, 128);
        sphere.generateNormals();

        // Configure texture LOD
        setTextureReferenceDistance(refDistance);
        enableAutoLOD();

        nav().pos(0, 2, camDist);
        nav().faceToward(Vec3f(0, 0, 0));

        printf("\\n=== PBR Mipmap LOD Demo ===\\n");
        printf("This demo shows how all PBR texture maps\\n");
        printf("share the same continuous LOD level.\\n");
        printf("Reference distance: %.1f units\\n\\n", refDistance);
    }

    void onAnimate(double dt) override {
        camAngle += dt * 10.0;

        // Orbit camera
        nav().pos(camDist * sin(camAngle * 0.02), 2, camDist * cos(camAngle * 0.02));
        nav().faceToward(Vec3f(0, 0, 0));
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02, 0.02, 0.03);

        pbr.drawSkybox(g);
        g.depthTesting(true);

        // Calculate LOD for all PBR textures
        float dist = nav().pos().mag();
        float lod = getTextureLODContinuous(dist, 10);

        // Begin LOD-aware rendering
        pbr.beginWithLOD(g, nav().pos(), lod);

        // Create extended material with texture map settings
        PBRMaterialEx mat = PBRMaterialEx::TexturedBrick();

        // Visualize LOD with color tint
        float t = std::min(lod / 3.0f, 1.0f);
        mat.albedo = Vec3f(0.6f + t * 0.2f, 0.4f - t * 0.2f, 0.3f);
        mat.roughness = 0.5f + t * 0.3f;  // More rough at higher LOD

        pbr.materialEx(mat);

        // Draw multiple spheres at different distances
        for (int i = 0; i < 5; i++) {
            float z = -8.0f + i * 4.0f;
            g.pushMatrix();
            g.translate(0, 0, z);

            // Calculate per-object LOD
            float objDist = (nav().pos() - Vec3f(0, 0, z)).mag();
            float objLOD = getTextureLODContinuous(objDist, 10);
            pbr.setTextureLOD(objLOD);

            g.draw(sphere);
            g.popMatrix();
        }

        pbr.end(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case 'w': case 'W':
                camDist = std::max(5.0f, camDist - 2.0f);
                break;
            case 's': case 'S':
                camDist = std::min(50.0f, camDist + 2.0f);
                break;
            case 'r': case 'R':
                refDistance = refDistance == 5.0f ? 10.0f :
                              refDistance == 10.0f ? 2.5f : 5.0f;
                setTextureReferenceDistance(refDistance);
                printf("[PBRMipmap] Reference distance: %.1f\\n", refDistance);
                break;
        }
        return true;
    }
};

int main() {
    PBRMipmapDemo app;
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - TEXTURES - PBR MATERIALS
  // ==========================================================================
  {
    id: 'studio-tex-pbr-procedural',
    title: 'Procedural PBR Materials',
    description: 'Generate complete PBR texture sets (albedo, normal, roughness, metallic, AO) procedurally',
    category: 'studio-textures',
    subcategory: 'pbr-materials',
    code: `/**
 * Procedural PBR Materials
 *
 * Generates complete PBR texture sets procedurally including:
 * - Albedo (color)
 * - Normal map (surface detail)
 * - Roughness map
 * - Metallic map
 * - Ambient Occlusion
 *
 * Controls:
 *   1-4: Switch material type
 *   W/S: Zoom in/out
 *   A/D: Rotate view
 */

#include "al_WebApp.hpp"
#include "al_WebPBR.hpp"
#include "al_WebProcedural.hpp"
#include "al_WebAutoUV.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class ProceduralPBRDemo : public WebApp {
public:
    WebPBR pbr;
    Mesh sphere;
    Mesh cube;
    Mesh floor;

    // PBR texture maps
    Texture albedoTex, normalTex, roughnessTex, metallicTex, aoTex;
    ProceduralTexture procTex;

    int materialType = 0;
    float angle = 0;
    float camDist = 5.0f;
    float camAngle = 0.5f;

    void onCreate() override {
        // Create meshes with UVs
        addSphere(sphere, 1.0, 64, 64);
        sphere.generateNormals();
        generateSphericalUVs(sphere);

        addCube(cube, 1.5);
        cube.generateNormals();
        generateBoxUVs(cube);

        addSurface(floor, 10, 10, 10, 10);
        floor.generateNormals();
        autoGenerateUVs(floor, 3.0f);

        // Create textures
        createTexture(albedoTex);
        createTexture(normalTex);
        createTexture(roughnessTex);
        createTexture(metallicTex);
        createTexture(aoTex);

        // Load environment
        pbr.loadEnvironment("/assets/environments/studio_small_09_1k.hdr");
        pbr.exposure(1.5f);

        generateMaterial();
        updateCamera();
    }

    void createTexture(Texture& tex) {
        tex.create2D(512, 512, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
        tex.filter(Texture::LINEAR);
        tex.wrap(Texture::REPEAT);
    }

    void generateMaterial() {
        switch (materialType) {
            case 0: generateBrickMaterial(); break;
            case 1: generateWoodMaterial(); break;
            case 2: generateMetalMaterial(); break;
            case 3: generateStoneMaterial(); break;
        }
    }

    void generateBrickMaterial() {
        // Brick albedo
        procTex.brickPattern(512, 512, 64, 32, 4, 0xFFC25A3C, 0xFF808080);
        albedoTex.submit(procTex.pixels());

        // Brick normal - derive from height
        procTex.brickPattern(512, 512, 64, 32, 4, 0xFF606060, 0xFFFFFFFF);
        procTex.normalMapFromHeight(512, 512, 2.0f);
        normalTex.submit(procTex.pixels());

        // Roughness - bricks rough, mortar rougher
        procTex.brickPattern(512, 512, 64, 32, 4, 0xFF707070, 0xFF909090);
        roughnessTex.submit(procTex.pixels());

        // Metallic - non-metallic
        procTex.fill(512, 512, 0xFF000000);
        metallicTex.submit(procTex.pixels());

        // AO - VERY dark in mortar grooves for visibility
        // White (0xFF) = full light, Dark (0x20) = heavily occluded
        procTex.brickPattern(512, 512, 64, 32, 4, 0xFFFFFFFF, 0xFF202020);
        procTex.applyBlur(2);  // Soften edges
        aoTex.submit(procTex.pixels());
    }

    void generateWoodMaterial() {
        procTex.woodGrain(512, 512, 10.0f, 20.0f);
        albedoTex.submit(procTex.pixels());

        procTex.woodGrain(512, 512, 10.0f, 20.0f);
        procTex.normalMapFromHeight(512, 512, 0.5f);
        normalTex.submit(procTex.pixels());

        // Wood is moderately rough
        procTex.perlinNoise(512, 512, 8.0f, 3);
        for (auto& p : procTex.pixelData()) p = 128 + p / 4;
        roughnessTex.submit(procTex.pixels());

        procTex.fill(512, 512, 0xFF000000);
        metallicTex.submit(procTex.pixels());

        // AO - darken wood grain grooves
        procTex.woodGrain(512, 512, 10.0f, 20.0f);
        // Invert and enhance: dark rings become AO
        for (auto& p : procTex.pixelData()) {
            int ao = 255 - (255 - p) / 2;  // Subtle darkening in grain
            p = (uint8_t)std::max(60, ao);  // Floor at 60 for visible effect
        }
        aoTex.submit(procTex.pixels());
    }

    void generateMetalMaterial() {
        // Brushed metal pattern
        procTex.perlinNoise(512, 512, 2.0f, 2);
        for (int y = 0; y < 512; y++) {
            for (int x = 0; x < 512; x++) {
                int idx = (y * 512 + x) * 4;
                uint8_t v = 180 + procTex.pixelData()[idx] / 8;
                procTex.pixelData()[idx] = v;
                procTex.pixelData()[idx+1] = v;
                procTex.pixelData()[idx+2] = v;
            }
        }
        albedoTex.submit(procTex.pixels());

        // Subtle scratches normal
        procTex.perlinNoise(512, 512, 64.0f, 2);
        procTex.normalMapFromHeight(512, 512, 0.3f);
        normalTex.submit(procTex.pixels());

        // Low roughness with scratches
        procTex.perlinNoise(512, 512, 32.0f, 2);
        for (auto& p : procTex.pixelData()) p = 30 + p / 8;
        roughnessTex.submit(procTex.pixels());

        // Fully metallic
        procTex.fill(512, 512, 0xFFFFFFFF);
        metallicTex.submit(procTex.pixels());

        // AO - wear and edge darkening from scratches
        procTex.perlinNoise(512, 512, 16.0f, 4);
        for (auto& p : procTex.pixelData()) {
            // Create pitting/wear pattern: mostly bright with dark spots
            p = (p > 100) ? 255 : (uint8_t)(p * 2);  // Dark pits where noise is low
        }
        aoTex.submit(procTex.pixels());
    }

    void generateStoneMaterial() {
        // Stone/marble
        procTex.marble(512, 512, 4.0f, 8.0f);
        albedoTex.submit(procTex.pixels());

        procTex.worleyNoise(512, 512, 32, WorleyMode::F2_MINUS_F1);
        procTex.normalMapFromHeight(512, 512, 1.0f);
        normalTex.submit(procTex.pixels());

        // Polished stone - low roughness
        procTex.fill(512, 512, 0xFF404040);
        roughnessTex.submit(procTex.pixels());

        procTex.fill(512, 512, 0xFF000000);
        metallicTex.submit(procTex.pixels());

        // AO - dark crevices between cells (very pronounced)
        procTex.worleyNoise(512, 512, 32, WorleyMode::F1);
        for (auto& p : procTex.pixelData()) {
            // F1 gives distance to nearest cell center
            // Near center = bright, edges = dark
            int ao = 80 + (p * 175) / 255;  // Range: 80-255 (darker crevices)
            p = (uint8_t)ao;
        }
        aoTex.submit(procTex.pixels());
    }

    void updateCamera() {
        float x = camDist * sin(camAngle);
        float z = camDist * cos(camAngle);
        nav().pos(x, 2.0f, z);
        nav().faceToward(Vec3f(0, 0.5f, 0));
    }

    void onAnimate(double dt) override {
        angle += dt * 15;
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);
        pbr.drawSkybox(g);
        g.depthTesting(true);

        // Bind all PBR textures BEFORE starting the shader
        albedoTex.bind(3);
        normalTex.bind(4);
        roughnessTex.bind(5);
        metallicTex.bind(6);
        aoTex.bind(7);

        // Use beginTextured for textured PBR materials
        pbr.beginTextured(g, nav().pos());

        // Create material with all maps
        PBRMaterialEx mat;
        mat.withAlbedoMap(3)
           .withNormalMap(1.0f, 4)
           .withRoughnessMap(5)
           .withMetallicMap(6)
           .withAOMap(7);

        pbr.materialEx(mat);

        // Draw sphere
        g.pushMatrix();
        g.translate(-2, 1, 0);
        g.rotate(angle, 0, 1, 0);
        g.draw(sphere);
        g.popMatrix();

        // Draw cube
        g.pushMatrix();
        g.translate(2, 0.75, 0);
        g.rotate(angle * 0.7f, 0, 1, 0);
        g.draw(cube);
        g.popMatrix();

        // Draw floor
        g.pushMatrix();
        g.translate(0, -0.5, 0);
        g.rotate(-90, 1, 0, 0);
        g.draw(floor);
        g.popMatrix();

        pbr.end(g);

        // Unbind textures
        albedoTex.unbind(3);
        normalTex.unbind(4);
        roughnessTex.unbind(5);
        metallicTex.unbind(6);
        aoTex.unbind(7);
    }

    bool onKeyDown(Keyboard const& k) override {
        const char* names[] = {"Brick", "Wood", "Metal", "Stone"};
        switch (k.key()) {
            case '1': materialType = 0; generateMaterial(); printf("Material: %s\\n", names[0]); break;
            case '2': materialType = 1; generateMaterial(); printf("Material: %s\\n", names[1]); break;
            case '3': materialType = 2; generateMaterial(); printf("Material: %s\\n", names[2]); break;
            case '4': materialType = 3; generateMaterial(); printf("Material: %s\\n", names[3]); break;
            case 'w': case 'W': camDist = std::max(2.0f, camDist - 0.5f); updateCamera(); break;
            case 's': case 'S': camDist = std::min(15.0f, camDist + 0.5f); updateCamera(); break;
            case 'a': case 'A': camAngle += 0.15f; updateCamera(); break;
            case 'd': case 'D': camAngle -= 0.15f; updateCamera(); break;
        }
        return true;
    }
};

int main() {
    ProceduralPBRDemo app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-tex-pbr-normal-mapping',
    title: 'Normal Mapping Deep Dive',
    description: 'Understand normal maps with interactive strength control on sphere, cube, and Stanford bunny',
    category: 'studio-textures',
    subcategory: 'pbr-materials',
    code: `/**
 * Normal Mapping Deep Dive
 *
 * Demonstrates how normal maps add surface detail
 * without adding geometry. Shows sphere, cube, and
 * Stanford bunny with/without normal mapping.
 *
 * Controls:
 *   1-4: Different normal map patterns
 *   +/-: Adjust normal strength
 *   W/S: Zoom
 *   A/D: Rotate
 */

#include "al_WebApp.hpp"
#include "al_WebPBR.hpp"
#include "al_WebProcedural.hpp"
#include "al_WebAutoUV.hpp"
#include "al_WebOBJ.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class NormalMapDemo : public WebApp {
public:
    WebPBR pbr;
    Mesh sphere, cube, bunny;
    WebOBJ bunnyLoader;
    bool bunnyLoaded = false;

    Texture albedoTex, normalTex;
    ProceduralTexture procTex;

    int patternType = 0;
    float normalStrength = 1.0f;
    float angle = 0;
    float camDist = 8.0f;
    float camAngle = 0.5f;

    // Create a proper cube with separate faces (no shared vertices)
    void createSolidCube(Mesh& m, float size) {
        m.reset();
        m.primitive(Mesh::TRIANGLES);
        float s = size * 0.5f;

        // Each face has its own vertices to avoid Z-fighting
        // Front face (+Z)
        m.vertex(-s, -s, s); m.normal(0, 0, 1); m.texCoord(0, 0);
        m.vertex( s, -s, s); m.normal(0, 0, 1); m.texCoord(1, 0);
        m.vertex( s,  s, s); m.normal(0, 0, 1); m.texCoord(1, 1);
        m.vertex(-s, -s, s); m.normal(0, 0, 1); m.texCoord(0, 0);
        m.vertex( s,  s, s); m.normal(0, 0, 1); m.texCoord(1, 1);
        m.vertex(-s,  s, s); m.normal(0, 0, 1); m.texCoord(0, 1);

        // Back face (-Z)
        m.vertex( s, -s, -s); m.normal(0, 0, -1); m.texCoord(0, 0);
        m.vertex(-s, -s, -s); m.normal(0, 0, -1); m.texCoord(1, 0);
        m.vertex(-s,  s, -s); m.normal(0, 0, -1); m.texCoord(1, 1);
        m.vertex( s, -s, -s); m.normal(0, 0, -1); m.texCoord(0, 0);
        m.vertex(-s,  s, -s); m.normal(0, 0, -1); m.texCoord(1, 1);
        m.vertex( s,  s, -s); m.normal(0, 0, -1); m.texCoord(0, 1);

        // Right face (+X)
        m.vertex(s, -s,  s); m.normal(1, 0, 0); m.texCoord(0, 0);
        m.vertex(s, -s, -s); m.normal(1, 0, 0); m.texCoord(1, 0);
        m.vertex(s,  s, -s); m.normal(1, 0, 0); m.texCoord(1, 1);
        m.vertex(s, -s,  s); m.normal(1, 0, 0); m.texCoord(0, 0);
        m.vertex(s,  s, -s); m.normal(1, 0, 0); m.texCoord(1, 1);
        m.vertex(s,  s,  s); m.normal(1, 0, 0); m.texCoord(0, 1);

        // Left face (-X)
        m.vertex(-s, -s, -s); m.normal(-1, 0, 0); m.texCoord(0, 0);
        m.vertex(-s, -s,  s); m.normal(-1, 0, 0); m.texCoord(1, 0);
        m.vertex(-s,  s,  s); m.normal(-1, 0, 0); m.texCoord(1, 1);
        m.vertex(-s, -s, -s); m.normal(-1, 0, 0); m.texCoord(0, 0);
        m.vertex(-s,  s,  s); m.normal(-1, 0, 0); m.texCoord(1, 1);
        m.vertex(-s,  s, -s); m.normal(-1, 0, 0); m.texCoord(0, 1);

        // Top face (+Y)
        m.vertex(-s, s,  s); m.normal(0, 1, 0); m.texCoord(0, 0);
        m.vertex( s, s,  s); m.normal(0, 1, 0); m.texCoord(1, 0);
        m.vertex( s, s, -s); m.normal(0, 1, 0); m.texCoord(1, 1);
        m.vertex(-s, s,  s); m.normal(0, 1, 0); m.texCoord(0, 0);
        m.vertex( s, s, -s); m.normal(0, 1, 0); m.texCoord(1, 1);
        m.vertex(-s, s, -s); m.normal(0, 1, 0); m.texCoord(0, 1);

        // Bottom face (-Y)
        m.vertex(-s, -s, -s); m.normal(0, -1, 0); m.texCoord(0, 0);
        m.vertex( s, -s, -s); m.normal(0, -1, 0); m.texCoord(1, 0);
        m.vertex( s, -s,  s); m.normal(0, -1, 0); m.texCoord(1, 1);
        m.vertex(-s, -s, -s); m.normal(0, -1, 0); m.texCoord(0, 0);
        m.vertex( s, -s,  s); m.normal(0, -1, 0); m.texCoord(1, 1);
        m.vertex(-s, -s,  s); m.normal(0, -1, 0); m.texCoord(0, 1);
    }

    void onCreate() override {
        // Create sphere
        addSphere(sphere, 0.8, 48, 48);
        sphere.generateNormals();
        generateSphericalUVs(sphere);

        // Create cube with proper separate faces
        createSolidCube(cube, 1.3);

        // Load Stanford bunny
        bunnyLoader.load("/assets/meshes/bunny.obj", [this](bool success) {
            if (success) {
                bunny = bunnyLoader.mesh();
                bunny.generateNormals();
                autoGenerateUVs(bunny, 2.0f);
                bunnyLoaded = true;
                printf("Bunny loaded: %d vertices\\n", (int)bunny.vertices().size());
            }
        });

        // Create textures
        albedoTex.create2D(512, 512, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
        albedoTex.filter(Texture::LINEAR);
        normalTex.create2D(512, 512, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
        normalTex.filter(Texture::LINEAR);

        pbr.loadEnvironment("/assets/environments/museum_of_ethnography_1k.hdr");
        pbr.exposure(1.3f);

        generatePattern();
        updateCamera();
    }

    void generatePattern() {
        // Create albedo (neutral gray to show normal effect)
        procTex.fill(512, 512, 0xFF909090);
        albedoTex.submit(procTex.pixels());

        // Generate height map then convert to normal
        switch (patternType) {
            case 0: procTex.brickPattern(512, 512, 64, 32, 4, 0xFF606060, 0xFFFFFFFF); break;
            case 1: procTex.worleyNoise(512, 512, 24, WorleyMode::F1); break;
            case 2: procTex.perlinNoise(512, 512, 4.0f, 4); break;
            case 3: procTex.fbmNoise(512, 512, 16.0f, 6, 0.5f); break;
        }
        procTex.normalMapFromHeight(512, 512, normalStrength * 2.0f);
        normalTex.submit(procTex.pixels());
    }

    void updateCamera() {
        float x = camDist * sin(camAngle);
        float z = camDist * cos(camAngle);
        nav().pos(x, 1, z);
        nav().faceToward(Vec3f(0, 0, 0));
    }

    void onAnimate(double dt) override {
        angle += dt * 10;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05, 0.05, 0.08);
        pbr.drawSkybox(g);
        g.depthTesting(true);
        g.culling(true);  // Enable backface culling to prevent Z-fighting

        // Bind textures BEFORE starting textured PBR
        albedoTex.bind(3);
        normalTex.bind(4);

        pbr.beginTextured(g, nav().pos());

        // === TOP ROW: Without normal map (flat surfaces) ===
        PBRMaterialEx matFlat;
        matFlat.albedo = Vec3f(0.6f);
        matFlat.roughness = 0.4f;
        matFlat.metallic = 0.0f;
        pbr.materialEx(matFlat);

        // Sphere - flat
        g.pushMatrix();
        g.translate(-2.5, 1.2, 0);
        g.rotate(angle, 0, 1, 0);
        g.draw(sphere);
        g.popMatrix();

        // Cube - flat
        g.pushMatrix();
        g.translate(0, 1.2, 0);
        g.rotate(angle, 0, 1, 0);
        g.draw(cube);
        g.popMatrix();

        // Bunny - flat
        if (bunnyLoaded) {
            g.pushMatrix();
            g.translate(2.5, 0.5, 0);
            g.rotate(angle, 0, 1, 0);
            g.scale(8.0);  // Bunny is small
            g.draw(bunny);
            g.popMatrix();
        }

        // === BOTTOM ROW: With normal map (surface detail) ===
        PBRMaterialEx matNormal;
        matNormal.albedo = Vec3f(0.6f);
        matNormal.roughness = 0.4f;
        matNormal.metallic = 0.0f;
        matNormal.withAlbedoMap(3).withNormalMap(normalStrength, 4);
        pbr.materialEx(matNormal);

        // Sphere - normal mapped
        g.pushMatrix();
        g.translate(-2.5, -1.2, 0);
        g.rotate(angle, 0, 1, 0);
        g.draw(sphere);
        g.popMatrix();

        // Cube - normal mapped
        g.pushMatrix();
        g.translate(0, -1.2, 0);
        g.rotate(angle, 0, 1, 0);
        g.draw(cube);
        g.popMatrix();

        // Bunny - normal mapped
        if (bunnyLoaded) {
            g.pushMatrix();
            g.translate(2.5, -1.9, 0);
            g.rotate(angle, 0, 1, 0);
            g.scale(8.0);
            g.draw(bunny);
            g.popMatrix();
        }

        pbr.end(g);

        albedoTex.unbind(3);
        normalTex.unbind(4);
    }

    bool onKeyDown(Keyboard const& k) override {
        const char* names[] = {"Brick", "Cells", "Perlin", "FBM"};
        switch (k.key()) {
            case '1': patternType = 0; generatePattern(); printf("Pattern: %s\\n", names[0]); break;
            case '2': patternType = 1; generatePattern(); printf("Pattern: %s\\n", names[1]); break;
            case '3': patternType = 2; generatePattern(); printf("Pattern: %s\\n", names[2]); break;
            case '4': patternType = 3; generatePattern(); printf("Pattern: %s\\n", names[3]); break;
            case '+': case '=':
                normalStrength = std::min(3.0f, normalStrength + 0.2f);
                generatePattern();
                printf("Normal strength: %.1f\\n", normalStrength);
                break;
            case '-':
                normalStrength = std::max(0.0f, normalStrength - 0.2f);
                generatePattern();
                printf("Normal strength: %.1f\\n", normalStrength);
                break;
            case 'w': case 'W': camDist = std::max(3.0f, camDist - 0.5f); updateCamera(); break;
            case 's': case 'S': camDist = std::min(15.0f, camDist + 0.5f); updateCamera(); break;
            case 'a': case 'A': camAngle += 0.15f; updateCamera(); break;
            case 'd': case 'D': camAngle -= 0.15f; updateCamera(); break;
        }
        return true;
    }
};

int main() {
    NormalMapDemo app;
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - TEXTURES - 3D TEXTURES
  // ==========================================================================
  {
    id: 'studio-tex-3d-noise',
    title: '3D Noise Volume',
    description: 'Volumetric 3D Perlin noise texture for clouds, fog, and procedural effects',
    category: 'studio-textures',
    subcategory: '3d-textures',
    code: `/**
 * 3D Noise Volume
 *
 * Demonstrates 3D texture generation with Perlin noise
 * for volumetric effects like clouds and fog.
 *
 * The 3D texture is sliced and animated to show
 * the volumetric nature of the data.
 *
 * Controls:
 *   Space: Toggle animation
 *   1-3: Change slice axis (X/Y/Z)
 *   W/S: Zoom
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>
#include <vector>

using namespace al;

class Volume3DDemo : public WebApp {
public:
    ShaderProgram shader;
    GLuint volumeTexId = 0;
    GLuint quadVAO = 0, quadVBO = 0;

    std::vector<uint8_t> volumeData;
    int volumeSize = 64;
    float slicePos = 0.5f;
    int sliceAxis = 2;  // 0=X, 1=Y, 2=Z
    bool animate = true;
    float time = 0;
    float camDist = 3.0f;

    void onCreate() override {
        // Create display quad with VAO/VBO (avoid g.draw uniform conflicts)
        float quadVerts[] = {
            // pos x,y,z, uv u,v
            -1, -1, 0, 0, 0,
             1, -1, 0, 1, 0,
            -1,  1, 0, 0, 1,
             1,  1, 0, 1, 1
        };
        glGenVertexArrays(1, &quadVAO);
        glGenBuffers(1, &quadVBO);
        glBindVertexArray(quadVAO);
        glBindBuffer(GL_ARRAY_BUFFER, quadVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(quadVerts), quadVerts, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5*sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5*sizeof(float), (void*)(3*sizeof(float)));
        glEnableVertexAttribArray(1);
        glBindVertexArray(0);

        // Generate 3D noise volume
        generateVolume();
        createVolumeTexture();

        // Create slice shader
        createShader();

        nav().pos(0, 0, camDist);
    }

    // Hash function for noise
    float hash3D(float x, float y, float z) {
        float n = sin(x * 127.1f + y * 311.7f + z * 74.7f) * 43758.5453f;
        return n - floor(n);  // fract
    }

    // Smooth interpolation
    float smoothstep(float t) {
        return t * t * (3.0f - 2.0f * t);
    }

    // 3D value noise
    float noise3D(float x, float y, float z) {
        float ix = floor(x), iy = floor(y), iz = floor(z);
        float fx = x - ix, fy = y - iy, fz = z - iz;
        fx = smoothstep(fx); fy = smoothstep(fy); fz = smoothstep(fz);

        // 8 corners of the cube
        float n000 = hash3D(ix, iy, iz);
        float n100 = hash3D(ix+1, iy, iz);
        float n010 = hash3D(ix, iy+1, iz);
        float n110 = hash3D(ix+1, iy+1, iz);
        float n001 = hash3D(ix, iy, iz+1);
        float n101 = hash3D(ix+1, iy, iz+1);
        float n011 = hash3D(ix, iy+1, iz+1);
        float n111 = hash3D(ix+1, iy+1, iz+1);

        // Trilinear interpolation
        float nx00 = n000 + fx * (n100 - n000);
        float nx10 = n010 + fx * (n110 - n010);
        float nx01 = n001 + fx * (n101 - n001);
        float nx11 = n011 + fx * (n111 - n011);
        float nxy0 = nx00 + fy * (nx10 - nx00);
        float nxy1 = nx01 + fy * (nx11 - nx01);
        return nxy0 + fz * (nxy1 - nxy0);
    }

    // Fractal Brownian Motion for cloud-like noise
    float fbm3D(float x, float y, float z, int octaves = 5) {
        float value = 0.0f, amplitude = 0.5f;
        for (int i = 0; i < octaves; i++) {
            value += amplitude * noise3D(x, y, z);
            x *= 2.0f; y *= 2.0f; z *= 2.0f;
            amplitude *= 0.5f;
        }
        return value;
    }

    void generateVolume() {
        volumeData.resize(volumeSize * volumeSize * volumeSize * 4);

        for (int z = 0; z < volumeSize; z++) {
            for (int y = 0; y < volumeSize; y++) {
                for (int x = 0; x < volumeSize; x++) {
                    // Scale to create good noise frequency
                    float fx = (float)x / volumeSize * 4.0f;
                    float fy = (float)y / volumeSize * 4.0f;
                    float fz = (float)z / volumeSize * 4.0f;

                    // Use FBM for cloud-like appearance
                    float n = fbm3D(fx, fy, fz, 5);

                    int idx = (z * volumeSize * volumeSize + y * volumeSize + x) * 4;
                    uint8_t v = (uint8_t)(n * 255);
                    volumeData[idx] = v;
                    volumeData[idx + 1] = v;
                    volumeData[idx + 2] = v;
                    volumeData[idx + 3] = 255;
                }
            }
        }
        printf("Generated %dx%dx%d volume\\n", volumeSize, volumeSize, volumeSize);
    }

    void createVolumeTexture() {
        glGenTextures(1, &volumeTexId);
        glBindTexture(GL_TEXTURE_3D, volumeTexId);
        glTexImage3D(GL_TEXTURE_3D, 0, GL_RGBA8, volumeSize, volumeSize, volumeSize,
                     0, GL_RGBA, GL_UNSIGNED_BYTE, volumeData.data());
        glTexParameteri(GL_TEXTURE_3D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_3D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_3D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_3D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_3D, GL_TEXTURE_WRAP_R, GL_REPEAT);
    }

    void createShader() {
        const char* vert = R"(#version 300 es
            layout(location = 0) in vec3 position;
            layout(location = 1) in vec2 texCoord;
            out vec2 vUV;
            uniform mat4 MVP;
            void main() {
                vUV = texCoord;
                gl_Position = MVP * vec4(position, 1.0);
            }
        )";

        const char* frag = R"(#version 300 es
            precision highp float;
            precision highp sampler3D;
            in vec2 vUV;
            out vec4 fragColor;
            uniform sampler3D volumeTex;
            uniform float slicePos;
            uniform int sliceAxis;

            void main() {
                vec3 uvw;
                if (sliceAxis == 0) uvw = vec3(slicePos, vUV.x, vUV.y);
                else if (sliceAxis == 1) uvw = vec3(vUV.x, slicePos, vUV.y);
                else uvw = vec3(vUV.x, vUV.y, slicePos);

                vec4 color = texture(volumeTex, uvw);

                // Color mapping - blue to white
                float v = color.r;
                vec3 finalColor = mix(vec3(0.1, 0.2, 0.4), vec3(1.0), v);
                fragColor = vec4(finalColor, 1.0);
            }
        )";

        shader.compile(vert, frag);
    }

    void onAnimate(double dt) override {
        time += dt;
        if (animate) {
            slicePos = (sin(time * 0.5f) + 1.0f) * 0.5f;
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1, 0.1, 0.15);

        shader.use();

        // Set uniforms
        Mat4f mvp = g.projMatrix() * g.viewMatrix() * g.modelMatrix();
        shader.uniform("MVP", mvp);
        shader.uniform("slicePos", slicePos);
        shader.uniform("sliceAxis", sliceAxis);

        // Bind 3D texture
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_3D, volumeTexId);
        shader.uniform("volumeTex", 0);

        // Draw quad directly (avoid g.draw which sets extra uniforms)
        glBindVertexArray(quadVAO);
        glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
        glBindVertexArray(0);
    }

    bool onKeyDown(Keyboard const& k) override {
        const char* axisNames[] = {"X", "Y", "Z"};
        switch (k.key()) {
            case ' ':
                animate = !animate;
                printf("Animation: %s\\n", animate ? "ON" : "OFF");
                break;
            case '1': sliceAxis = 0; printf("Slice axis: %s\\n", axisNames[0]); break;
            case '2': sliceAxis = 1; printf("Slice axis: %s\\n", axisNames[1]); break;
            case '3': sliceAxis = 2; printf("Slice axis: %s\\n", axisNames[2]); break;
            case 'w': case 'W':
                camDist = std::max(1.5f, camDist - 0.3f);
                nav().pos(0, 0, camDist);
                break;
            case 's': case 'S':
                camDist = std::min(8.0f, camDist + 0.3f);
                nav().pos(0, 0, camDist);
                break;
        }
        return true;
    }
};

int main() {
    Volume3DDemo app;
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - TEXTURES - HDR TEXTURES
  // ==========================================================================
  {
    id: 'studio-tex-hdr-exposure',
    title: 'HDR Exposure Control',
    description: 'Load HDR environment maps and control exposure/tonemapping',
    category: 'studio-textures',
    subcategory: 'hdr-textures',
    code: `/**
 * HDR Exposure Control
 *
 * Demonstrates HDR (High Dynamic Range) environment maps
 * with interactive exposure and tonemapping controls.
 *
 * HDR textures store values beyond 0-1 range, allowing
 * realistic lighting and bloom effects.
 *
 * Controls:
 *   1-4: Switch HDR environment
 *   +/-: Adjust exposure
 *   W/S: Zoom
 */

#include "al_WebApp.hpp"
#include "al_WebPBR.hpp"
#include "al_WebAutoUV.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class HDRExposureDemo : public WebApp {
public:
    WebPBR pbr;
    Mesh sphere;
    Mesh mirrorBall;

    int envIndex = 0;
    float exposure = 1.0f;
    float angle = 0;
    float camDist = 4.0f;

    const char* envPaths[4] = {
        "/assets/environments/studio_small_09_1k.hdr",
        "/assets/environments/museum_of_ethnography_1k.hdr",
        "/assets/environments/forest_slope_1k.hdr",
        "/assets/environments/urban_street_04_1k.hdr"
    };
    const char* envNames[4] = {
        "Studio", "Museum", "Forest", "Urban Street"
    };

    void onCreate() override {
        addSphere(sphere, 0.8, 64, 64);
        sphere.generateNormals();
        generateSphericalUVs(sphere);

        addSphere(mirrorBall, 0.3, 32, 32);
        mirrorBall.generateNormals();

        loadEnvironment(0);
        nav().pos(0, 0, camDist);
    }

    void loadEnvironment(int idx) {
        envIndex = idx;
        pbr.loadEnvironment(envPaths[idx]);
        pbr.exposure(exposure);
        printf("Loaded: %s\\n", envNames[idx]);
    }

    void onAnimate(double dt) override {
        angle += dt * 15;
    }

    void onDraw(Graphics& g) override {
        g.clear(0, 0, 0);

        // Apply exposure
        pbr.exposure(exposure);

        // Draw HDR skybox
        pbr.drawSkybox(g);

        g.depthTesting(true);
        pbr.begin(g, nav().pos());

        // Reflective sphere to show HDR environment
        PBRMaterial mirror;
        mirror.albedo = Vec3f(0.95f);
        mirror.metallic = 1.0f;
        mirror.roughness = 0.0f;
        pbr.material(mirror);

        g.pushMatrix();
        g.translate(0, 0, 0);
        g.rotate(angle * 0.5f, 0, 1, 0);
        g.draw(sphere);
        g.popMatrix();

        // Rough sphere for comparison
        PBRMaterial rough;
        rough.albedo = Vec3f(0.8f);
        rough.metallic = 0.0f;
        rough.roughness = 0.8f;
        pbr.material(rough);

        g.pushMatrix();
        g.translate(-2, 0, 0);
        g.rotate(angle, 0, 1, 0);
        g.draw(sphere);
        g.popMatrix();

        // Various roughness levels
        for (int i = 0; i < 5; i++) {
            PBRMaterial mat;
            mat.albedo = Vec3f(0.9f);
            mat.metallic = 1.0f;
            mat.roughness = i * 0.25f;
            pbr.material(mat);

            g.pushMatrix();
            g.translate(-2.0f + i * 1.0f, -1.5f, 0);
            g.draw(mirrorBall);
            g.popMatrix();
        }

        pbr.end(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case '1': loadEnvironment(0); break;
            case '2': loadEnvironment(1); break;
            case '3': loadEnvironment(2); break;
            case '4': loadEnvironment(3); break;
            case '+': case '=':
                exposure = std::min(5.0f, exposure + 0.2f);
                printf("Exposure: %.1f\\n", exposure);
                break;
            case '-':
                exposure = std::max(0.1f, exposure - 0.2f);
                printf("Exposure: %.1f\\n", exposure);
                break;
            case 'w': case 'W':
                camDist = std::max(2.0f, camDist - 0.5f);
                nav().pos(0, 0, camDist);
                break;
            case 's': case 'S':
                camDist = std::min(10.0f, camDist + 0.5f);
                nav().pos(0, 0, camDist);
                break;
        }
        return true;
    }
};

int main() {
    HDRExposureDemo app;
    app.start();
    return 0;
}
`,
  },

  // ==========================================================================
  // STUDIO - TIMELINE - Object Animation
  // ==========================================================================
  {
    id: 'studio-timeline-objects',
    title: 'Object Animation Demo',
    description: 'Animated primitives with timeline-driven transforms and materials',
    category: 'studio-timeline',
    subcategory: 'objects',
    code: `/**
 * Object Animation Demo
 *
 * Demonstrates the ObjectManager system for timeline-driven animation.
 * Objects can be spawned, animated, and destroyed based on timeline time.
 *
 * This example shows:
 * - Multiple primitive objects (sphere, cube, torus)
 * - Animated positions using sine waves
 * - Color changes over time
 * - Basic PBR materials
 */

#include "al_WebApp.hpp"
#include "al_WebObjectManager.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class ObjectAnimationDemo : public WebApp {
public:
    float time = 0;
    bool useObjectManager = true;

    // Manual fallback meshes (if ObjectManager not available)
    VAOMesh sphere, cube, torus;

    void onCreate() override {
        // Initialize ObjectManager meshes
        objectManager().initMeshes();

        // Create some objects via ObjectManager
        auto* obj1 = objectManager().createObject("sphere1", "Red Sphere", PrimitiveType::Sphere);
        if (obj1) {
            obj1->material.color = Color(1, 0.3, 0.3, 1);
            obj1->material.type = MaterialType::PBR;
            obj1->material.metallic = 0.8;
            obj1->material.roughness = 0.2;
        }

        auto* obj2 = objectManager().createObject("cube1", "Blue Cube", PrimitiveType::Cube);
        if (obj2) {
            obj2->material.color = Color(0.3, 0.5, 1, 1);
            obj2->material.type = MaterialType::PBR;
            obj2->material.metallic = 0.3;
            obj2->material.roughness = 0.6;
        }

        auto* obj3 = objectManager().createObject("torus1", "Gold Torus", PrimitiveType::Torus);
        if (obj3) {
            obj3->material.color = Color(1, 0.8, 0.2, 1);
            obj3->material.type = MaterialType::PBR;
            obj3->material.metallic = 0.9;
            obj3->material.roughness = 0.1;
        }

        // Create manual meshes as fallback
        addSphere(sphere, 0.5, 32, 32);
        sphere.update();
        addCube(cube, false, 0.8);
        cube.update();
        addTorus(torus, 0.2, 0.4, 32, 32);
        torus.update();

        // Set up camera
        nav().pos(0, 2, 6);
        nav().faceToward(Vec3f(0, 0, 0));
    }

    void onAnimate(double dt) override {
        time += dt;

        // Animate objects via ObjectManager
        if (useObjectManager) {
            // Sphere orbits in XZ plane
            float angle1 = time * 0.8;
            objectManager().setPosition("sphere1",
                sin(angle1) * 2.5,
                sin(time * 2) * 0.3 + 0.5,
                cos(angle1) * 2.5
            );

            // Cube bounces up and down
            objectManager().setPosition("cube1",
                0,
                abs(sin(time * 1.5)) * 2 + 0.5,
                0
            );
            // Rotate cube
            float cubeAngle = time * 0.5;
            Quatf cubeRot = Quatf::fromEuler(cubeAngle, cubeAngle * 0.7, 0);
            objectManager().setRotation("cube1", cubeRot.x, cubeRot.y, cubeRot.z, cubeRot.w);

            // Torus spins and moves in figure-8
            float angle3 = time * 0.6;
            objectManager().setPosition("torus1",
                sin(angle3 * 2) * 1.5,
                0.5,
                sin(angle3) * cos(angle3) * 3
            );
            Quatf torusRot = Quatf::fromEuler(time, time * 1.3, 0);
            objectManager().setRotation("torus1", torusRot.x, torusRot.y, torusRot.z, torusRot.w);

            // Animate colors
            float hue = fmod(time * 0.1, 1.0);
            objectManager().setColor("sphere1", 0.8 + 0.2*sin(time), 0.3, 0.3 + 0.3*cos(time*0.7), 1);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05, 0.05, 0.1);

        g.depthTesting(true);
        g.lighting(true);
        g.light().pos(5, 5, 5);

        // Draw ground plane
        g.pushMatrix();
        g.translate(0, -0.01, 0);
        g.scale(10, 1, 10);
        g.color(0.15, 0.15, 0.2);
        g.draw(cube);
        g.popMatrix();

        // Draw objects via ObjectManager
        if (useObjectManager) {
            // PBR rendering if available, otherwise basic
            objectManager().draw(g, pbr());
        } else {
            // Manual fallback rendering
            float angle1 = time * 0.8;
            g.pushMatrix();
            g.translate(sin(angle1) * 2.5, sin(time * 2) * 0.3 + 0.5, cos(angle1) * 2.5);
            g.color(1, 0.3, 0.3);
            g.draw(sphere);
            g.popMatrix();

            g.pushMatrix();
            g.translate(0, abs(sin(time * 1.5)) * 2 + 0.5, 0);
            g.rotate(time * 0.5, 1, 0.7, 0);
            g.color(0.3, 0.5, 1);
            g.draw(cube);
            g.popMatrix();

            float angle3 = time * 0.6;
            g.pushMatrix();
            g.translate(sin(angle3 * 2) * 1.5, 0.5, sin(angle3) * cos(angle3) * 3);
            g.rotate(time, 1, 1.3, 0);
            g.color(1, 0.8, 0.2);
            g.draw(torus);
            g.popMatrix();
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') {
            useObjectManager = !useObjectManager;
            printf("ObjectManager: %s\\n", useObjectManager ? "ON" : "OFF");
        }
        return true;
    }
};

int main() {
    ObjectAnimationDemo app;
    app.start();
    return 0;
}
`,
  },

  {
    id: 'studio-timeline-keyframes',
    title: 'Keyframe Animation',
    description: 'Object transforms driven by keyframe interpolation',
    category: 'studio-timeline',
    subcategory: 'keyframes',
    code: `/**
 * Keyframe Animation Demo
 *
 * Demonstrates keyframe-driven animation where transforms
 * are interpolated between defined keyframes.
 *
 * In the full timeline system:
 * - Keyframes are defined in the UI
 * - Values interpolate based on easing functions
 * - Timeline playhead drives the current time
 *
 * This example simulates keyframe interpolation manually.
 */

#include "al_WebApp.hpp"
#include "al_WebObjectManager.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <vector>

using namespace al;

// Simple keyframe structure
struct Keyframe {
    float time;
    Vec3f value;
};

// Linear interpolation between keyframes
Vec3f interpolateKeyframes(const std::vector<Keyframe>& keyframes, float time) {
    if (keyframes.empty()) return Vec3f(0);
    if (time <= keyframes.front().time) return keyframes.front().value;
    if (time >= keyframes.back().time) return keyframes.back().value;

    // Find surrounding keyframes
    for (size_t i = 0; i < keyframes.size() - 1; i++) {
        if (time >= keyframes[i].time && time < keyframes[i+1].time) {
            float t = (time - keyframes[i].time) / (keyframes[i+1].time - keyframes[i].time);
            // Ease in-out
            t = t < 0.5 ? 2*t*t : 1 - pow(-2*t + 2, 2) / 2;
            return keyframes[i].value + (keyframes[i+1].value - keyframes[i].value) * t;
        }
    }
    return keyframes.back().value;
}

class KeyframeDemo : public WebApp {
public:
    float time = 0;
    float duration = 10.0f; // 10 second loop

    VAOMesh sphere;

    // Position keyframes
    std::vector<Keyframe> positionKeyframes = {
        {0.0f, Vec3f(-3, 0.5, 0)},
        {2.5f, Vec3f(0, 2.5, -2)},
        {5.0f, Vec3f(3, 0.5, 0)},
        {7.5f, Vec3f(0, 1.5, 2)},
        {10.0f, Vec3f(-3, 0.5, 0)},
    };

    // Scale keyframes
    std::vector<Keyframe> scaleKeyframes = {
        {0.0f, Vec3f(0.5, 0.5, 0.5)},
        {2.5f, Vec3f(1.0, 1.5, 1.0)},
        {5.0f, Vec3f(0.8, 0.8, 0.8)},
        {7.5f, Vec3f(1.2, 0.6, 1.2)},
        {10.0f, Vec3f(0.5, 0.5, 0.5)},
    };

    void onCreate() override {
        addSphere(sphere, 1.0, 32, 32);
        sphere.update();

        nav().pos(0, 3, 8);
        nav().faceToward(Vec3f(0, 1, 0));
    }

    void onAnimate(double dt) override {
        time += dt;
        if (time > duration) time -= duration;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08, 0.08, 0.12);
        g.depthTesting(true);
        g.lighting(true);
        g.light().pos(5, 8, 5);

        // Interpolate position and scale from keyframes
        Vec3f pos = interpolateKeyframes(positionKeyframes, time);
        Vec3f scale = interpolateKeyframes(scaleKeyframes, time);

        // Draw animated sphere
        g.pushMatrix();
        g.translate(pos);
        g.scale(scale);
        g.color(0.9, 0.5, 0.2);
        g.draw(sphere);
        g.popMatrix();

        // Draw keyframe markers
        g.lighting(false);
        for (const auto& kf : positionKeyframes) {
            g.pushMatrix();
            g.translate(kf.value);
            g.scale(0.08);
            g.color(0.2, 0.8, 0.4, 0.7);
            g.draw(sphere);
            g.popMatrix();
        }

        // Draw current time indicator on ground
        float progress = time / duration;
        g.pushMatrix();
        g.translate(-3 + progress * 6, 0.02, 3);
        g.scale(0.15, 0.02, 0.15);
        g.color(1, 1, 1);
        g.draw(sphere);
        g.popMatrix();

        // Draw timeline bar
        g.pushMatrix();
        g.translate(0, 0.01, 3);
        g.scale(3, 0.01, 0.05);
        g.color(0.3, 0.3, 0.4);
        g.draw(sphere);
        g.popMatrix();
    }
};

int main() {
    KeyframeDemo app;
    app.start();
    return 0;
}
`,
  },
]

export const studioMultiFileExamples: MultiFileExample[] = []
