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

        pbr.end();
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

        pbr.end();
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
 * Stanford Bunny - OBJ Mesh Loading
 *
 * The classic Stanford bunny (1994) loaded from an OBJ file.
 * Demonstrates the WebOBJ loader for importing 3D models.
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"

using namespace al;

class BunnyDemo : public WebApp {
public:
    WebOBJ loader;
    Mesh bunny;
    double angle = 0;
    bool meshLoaded = false;

    void onCreate() override {
        // Load the Stanford bunny OBJ file
        loader.load("/assets/meshes/bunny.obj", [this](bool success) {
            if (success) {
                bunny = loader.mesh();
                // Center and scale the mesh
                bunny.fitToSphere(1.0);
                meshLoaded = true;
                printf("Bunny loaded: %zu vertices\\n", bunny.vertices().size());
            } else {
                printf("Failed to load bunny.obj\\n");
            }
        });

        nav().pos(0, 0, 3);
    }

    void onAnimate(double dt) override {
        angle += dt * 30.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.15, 0.15, 0.2);
        g.depthTesting(true);
        g.lighting(true);

        if (meshLoaded) {
            g.pushMatrix();
            g.rotate(angle, 0, 1, 0);
            g.color(0.9, 0.85, 0.8);
            g.draw(bunny);
            g.popMatrix();
        } else {
            // Show loading indicator (simple spinning cube)
            g.pushMatrix();
            g.rotate(angle * 2, 1, 1, 0);
            g.color(0.5, 0.5, 0.6);
            Mesh cube;
            addCube(cube, 0.3);
            g.draw(cube);
            g.popMatrix();
        }
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
 * Utah Teapot - OBJ Mesh Loading
 *
 * The Utah teapot, created by Martin Newell in 1975,
 * is one of the most iconic models in computer graphics.
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"

using namespace al;

class TeapotDemo : public WebApp {
public:
    WebOBJ loader;
    Mesh teapot;
    double angle = 0;
    bool meshLoaded = false;

    void onCreate() override {
        // Load the Utah teapot OBJ file
        loader.load("/assets/meshes/teapot.obj", [this](bool success) {
            if (success) {
                teapot = loader.mesh();
                teapot.fitToSphere(1.0);
                meshLoaded = true;
                printf("Teapot loaded: %zu vertices\\n", teapot.vertices().size());
            } else {
                printf("Failed to load teapot.obj\\n");
            }
        });

        nav().pos(0, 0, 3);
    }

    void onAnimate(double dt) override {
        angle += dt * 25.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1, 0.12, 0.15);
        g.depthTesting(true);
        g.lighting(true);

        if (meshLoaded) {
            g.pushMatrix();
            g.rotate(angle, 0, 1, 0);
            g.color(0.8, 0.5, 0.3); // Copper color
            g.draw(teapot);
            g.popMatrix();
        } else {
            // Loading indicator
            g.pushMatrix();
            g.rotate(angle * 2, 1, 1, 0);
            g.color(0.5, 0.5, 0.6);
            Mesh cube;
            addCube(cube, 0.3);
            g.draw(cube);
            g.popMatrix();
        }
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

            pbr.end();
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
 * A procedurally generated trefoil knot -
 * a classic mathematical surface.
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

class TrefoilKnot : public WebApp {
public:
    Mesh knot;
    double angle = 0;

    // Trefoil knot parametric equations
    Vec3f trefoilPoint(float t) {
        float x = sin(t) + 2 * sin(2 * t);
        float y = cos(t) - 2 * cos(2 * t);
        float z = -sin(3 * t);
        return Vec3f(x, y, z) * 0.3;
    }

    Vec3f trefoilTangent(float t) {
        float dx = cos(t) + 4 * cos(2 * t);
        float dy = -sin(t) + 4 * sin(2 * t);
        float dz = -3 * cos(3 * t);
        return Vec3f(dx, dy, dz).normalize();
    }

    void onCreate() override {
        // Generate tube mesh along trefoil curve
        int segments = 200;
        int tubeSegments = 16;
        float tubeRadius = 0.08;

        for (int i = 0; i <= segments; i++) {
            float t = (float)i / segments * M_2PI;
            Vec3f center = trefoilPoint(t);
            Vec3f tangent = trefoilTangent(t);

            // Create perpendicular vectors
            Vec3f up(0, 1, 0);
            if (abs(tangent.dot(up)) > 0.9) up = Vec3f(1, 0, 0);
            Vec3f right = tangent.cross(up).normalize();
            Vec3f realUp = right.cross(tangent).normalize();

            for (int j = 0; j < tubeSegments; j++) {
                float angle = (float)j / tubeSegments * M_2PI;
                Vec3f offset = (right * cos(angle) + realUp * sin(angle)) * tubeRadius;
                Vec3f pos = center + offset;

                knot.vertex(pos);
                knot.normal(offset.normalize());

                // Rainbow color based on position
                knot.color(HSV((float)i / segments, 0.8, 1.0));
            }
        }

        // Generate indices for triangle strip
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

        nav().pos(0, 0, 3);
    }

    void onAnimate(double dt) override {
        angle += dt * 30.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05, 0.05, 0.08);
        g.depthTesting(true);
        g.lighting(true);

        g.pushMatrix();
        g.rotate(angle, 0.3, 1, 0.2);
        g.draw(knot);
        g.popMatrix();
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
 * A non-orientable surface that passes through itself.
 * This mathematical curiosity has no inside or outside.
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

class KleinBottle : public WebApp {
public:
    Mesh klein;
    double angle = 0;

    // Klein bottle parametric equations
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

        return Vec3f(x, y, z) * 0.05;
    }

    void onCreate() override {
        int uSegments = 60;
        int vSegments = 30;

        for (int i = 0; i <= uSegments; i++) {
            float u = (float)i / uSegments * M_2PI;

            for (int j = 0; j <= vSegments; j++) {
                float v = (float)j / vSegments * M_2PI;

                Vec3f pos = kleinPoint(u, v);
                klein.vertex(pos);

                // Calculate normal numerically
                Vec3f du = kleinPoint(u + 0.01, v) - pos;
                Vec3f dv = kleinPoint(u, v + 0.01) - pos;
                klein.normal(du.cross(dv).normalize());

                // Color gradient
                klein.color(HSV((float)i / uSegments * 0.7, 0.6, 0.9));
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

        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.08, 0.06, 0.1);
        g.depthTesting(true);
        g.lighting(true);
        g.blending(true);
        g.blendAdd();

        g.pushMatrix();
        g.rotate(angle, 0.2, 1, 0.1);
        g.rotate(90, 1, 0, 0);
        g.draw(klein);
        g.popMatrix();
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
    title: 'Automatic LOD Demo',
    description: 'Automatic mesh simplification based on distance',
    category: 'studio-meshes',
    subcategory: 'procedural',
    code: `/**
 * Automatic LOD Demo
 *
 * Demonstrates automatic Level of Detail generation
 * and distance-based mesh simplification.
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"
#include "al_WebLOD.hpp"

using namespace al;

class LODDemo : public WebApp {
public:
    WebOBJ loader;
    Mesh originalMesh;
    LODMesh lodMesh;
    double angle = 0;
    float cameraDistance = 5;
    bool meshLoaded = false;

    void onCreate() override {
        // Load mesh and generate LOD
        loader.load("/assets/meshes/bunny.obj", [this](bool success) {
            if (success) {
                originalMesh = loader.mesh();
                originalMesh.fitToSphere(1.0);

                // Generate 4 LOD levels
                lodMesh.generate(originalMesh, 4, 0.5);
                lodMesh.setDistances({5, 15, 30, 60});

                meshLoaded = true;
                printf("LOD generated: %d levels\\n", lodMesh.numLevels());
                for (int i = 0; i < lodMesh.numLevels(); i++) {
                    printf("  LOD %d: %d triangles\\n", i, lodMesh.triangleCount(i));
                }
            }
        });

        nav().pos(0, 0, cameraDistance);
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1, 0.1, 0.15);
        g.depthTesting(true);
        g.lighting(true);

        if (meshLoaded) {
            g.pushMatrix();
            g.rotate(angle, 0, 1, 0);

            // Get LOD based on distance
            int lodIndex = lodMesh.getLODIndex(cameraDistance);
            g.color(0.9, 0.85, 0.8);
            g.draw(lodMesh.level(lodIndex));

            g.popMatrix();

            // Show current LOD info
            printf("\\rDistance: %.1f  LOD: %d  Triangles: %d    ",
                   cameraDistance, lodIndex, lodMesh.triangleCount(lodIndex));
        }
    }

    bool onKeyDown(Keyboard const& k) override {
        if (k.key() == '=' || k.key() == '+') {
            cameraDistance = std::max(1.0f, cameraDistance - 2.0f);
            nav().pos(0, 0, cameraDistance);
        } else if (k.key() == '-') {
            cameraDistance = std::min(100.0f, cameraDistance + 2.0f);
            nav().pos(0, 0, cameraDistance);
        }
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
    title: 'LOD Group (Many Objects)',
    description: 'Efficient rendering of many objects with LOD',
    category: 'studio-meshes',
    subcategory: 'procedural',
    code: `/**
 * LOD Group Demo
 *
 * Demonstrates rendering many objects with automatic
 * LOD selection for each based on camera distance.
 */

#include "al_WebApp.hpp"
#include "al_WebLOD.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <vector>

using namespace al;

class LODGroupDemo : public WebApp {
public:
    LODMesh lodSphere;
    LODGroup group;
    Mesh originalSphere;
    double time = 0;
    int totalTriangles = 0;

    void onCreate() override {
        // Create sphere and generate LOD
        addSphere(originalSphere, 0.3, 32, 32);
        originalSphere.generateNormals();
        lodSphere.generate(originalSphere, 4);
        lodSphere.setDistances({5, 15, 30, 100});

        // Create a grid of objects
        for (int x = -5; x <= 5; x++) {
            for (int z = -5; z <= 5; z++) {
                Vec3f pos(x * 2.0f, 0, z * 2.0f);
                group.add(&lodSphere, pos, 1.0f);
            }
        }

        printf("Created %d objects with LOD\\n", (int)group.objectCount());

        nav().pos(0, 5, 15);
        nav().faceToward(Vec3d(0, 0, 0));
    }

    void onAnimate(double dt) override {
        time += dt;

        // Update LOD based on camera
        group.update(nav().pos());
        totalTriangles = group.totalTriangles();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05, 0.05, 0.08);
        g.depthTesting(true);
        g.lighting(true);

        g.color(0.7, 0.8, 0.9);
        group.draw(g);

        printf("\\rTotal triangles: %d    ", totalTriangles);
    }
};

int main() {
    LODGroupDemo app;
    app.start();
    return 0;
}
`,
  },
  {
    id: 'studio-mesh-lod-controller',
    title: 'Unified LOD Controller',
    description: 'Combined mesh, texture, and shader LOD management',
    category: 'studio-meshes',
    subcategory: 'procedural',
    code: `/**
 * Unified LOD Controller Demo
 *
 * Demonstrates the LODController class that manages
 * mesh, texture, and shader LOD together for optimal
 * performance with distance-based quality scaling.
 *
 * Press +/- to change camera distance and see LOD changes.
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"
#include "al_WebLOD.hpp"
#include "al_WebPBR.hpp"

using namespace al;

class LODControllerDemo : public WebApp {
public:
    WebOBJ loader;
    LODController lod;
    WebPBR pbr;
    Mesh originalMesh;
    double angle = 0;
    float cameraDistance = 5;
    bool meshLoaded = false;

    void onCreate() override {
        // Load high-poly mesh
        loader.load("/assets/meshes/bunny.obj", [this](bool success) {
            if (success) {
                originalMesh = loader.mesh();
                originalMesh.fitToSphere(1.0);

                // Setup mesh LOD - 4 levels of detail
                lod.meshLOD().generate(originalMesh, 4, 0.5);
                lod.meshLOD().setDistances({8, 20, 40, 80});

                // Setup texture LOD - 4 resolution levels
                lod.textureLOD().setLevels({2048, 1024, 512, 256});
                lod.textureLOD().setDistances({10, 25, 50, 100});

                // Setup shader LOD - 4 complexity levels
                lod.shaderLOD().setLevels(4);
                lod.shaderLOD().setDistances({15, 35, 60, 100});

                meshLoaded = true;

                printf("LOD Controller initialized:\\n");
                printf("  Mesh levels: %d\\n", lod.meshLOD().numLevels());
                printf("  Texture levels: %d\\n", lod.textureLOD().numLevels());
                printf("  Shader levels: %d\\n", lod.shaderLOD().numLevels());
            }
        });

        // Load environment for PBR
        pbr.loadEnvironment("/assets/environments/studio_small_09_1k.hdr");

        nav().pos(0, 0, cameraDistance);
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;

        if (meshLoaded) {
            // Update all LOD selections based on camera distance
            lod.update(cameraDistance);
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05, 0.05, 0.08);

        if (!meshLoaded) {
            // Loading indicator
            g.lighting(true);
            g.depthTesting(true);
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

        int shaderLevel = lod.currentShaderLevel();

        if (shaderLevel == 0) {
            // Full PBR with reflections
            pbr.begin(g, nav().pos());
            PBRMaterial mat = PBRMaterial::Gold();
            pbr.material(mat);
            g.pushMatrix();
            g.rotate(angle, 0, 1, 0);
            g.draw(lod.currentMesh());
            g.popMatrix();
            pbr.end();
        } else if (shaderLevel == 1) {
            // Standard PBR
            pbr.begin(g, nav().pos());
            PBRMaterial mat;
            mat.albedo = Vec3f(1.0, 0.84, 0.0);
            mat.metallic = 0.9;
            mat.roughness = 0.3;
            pbr.material(mat);
            g.pushMatrix();
            g.rotate(angle, 0, 1, 0);
            g.draw(lod.currentMesh());
            g.popMatrix();
            pbr.end();
        } else {
            // Simple lighting
            g.lighting(true);
            g.pushMatrix();
            g.rotate(angle, 0, 1, 0);
            g.color(shaderLevel == 2 ? 0.9 : 0.6, shaderLevel == 2 ? 0.75 : 0.5, 0.3);
            g.draw(lod.currentMesh());
            g.popMatrix();
        }

        printf("\\rDist: %.1f | Mesh: %d | Tex: %dpx | Shader: %d    ",
               cameraDistance, lod.currentMeshLevel(),
               lod.currentTextureResolution(), lod.currentShaderLevel());
    }

    bool onKeyDown(Keyboard const& k) override {
        if (k.key() == '=' || k.key() == '+') {
            cameraDistance = std::max(2.0f, cameraDistance - 3.0f);
            nav().pos(0, 0, cameraDistance);
        } else if (k.key() == '-') {
            cameraDistance = std::min(150.0f, cameraDistance + 3.0f);
            nav().pos(0, 0, cameraDistance);
        } else if (k.key() == 'b') {
            float bias = lod.meshLOD().bias();
            bias = (bias >= 2.0f) ? 0.5f : bias + 0.5f;
            lod.bias(bias);
            printf("\\nLOD Bias: %.1f\\n", bias);
        }
        return true;
    }
};

int main() {
    LODControllerDemo app;
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
]

export const studioMultiFileExamples: MultiFileExample[] = []
