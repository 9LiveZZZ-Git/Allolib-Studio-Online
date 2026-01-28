/**
 * Phase 5 Test: Multi-Light System
 * Tests the lighting system with multiple lights:
 * - Point lights
 * - Directional lights
 * - Light colors and intensities
 * - Material properties
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/graphics/al_Light.hpp"
#include <cmath>

using namespace al;

class MultiLightTest : public WebApp {
public:
    Mesh sphere;
    Mesh plane;
    Mesh lightMarker;

    Light lights[4];
    Material material;

    double time = 0;
    int numActiveLights = 3;

    void onCreate() override {
        // Create a sphere for the main object
        addSphere(sphere, 1.0, 64, 64);
        sphere.generateNormals();

        // Create a ground plane
        plane.primitive(Mesh::TRIANGLES);
        float size = 8.0f;
        plane.vertex(-size, -2, -size); plane.normal(0, 1, 0); plane.color(0.4f, 0.4f, 0.4f);
        plane.vertex( size, -2, -size); plane.normal(0, 1, 0); plane.color(0.4f, 0.4f, 0.4f);
        plane.vertex( size, -2,  size); plane.normal(0, 1, 0); plane.color(0.4f, 0.4f, 0.4f);
        plane.vertex(-size, -2, -size); plane.normal(0, 1, 0); plane.color(0.4f, 0.4f, 0.4f);
        plane.vertex( size, -2,  size); plane.normal(0, 1, 0); plane.color(0.4f, 0.4f, 0.4f);
        plane.vertex(-size, -2,  size); plane.normal(0, 1, 0); plane.color(0.4f, 0.4f, 0.4f);

        // Small sphere to mark light positions
        addSphere(lightMarker, 0.1, 8, 8);

        // Configure lights
        // Light 0: Red, orbiting
        lights[0].ambient(Color(0.1f, 0.0f, 0.0f));
        lights[0].diffuse(Color(1.0f, 0.2f, 0.2f));
        lights[0].specular(Color(1.0f, 0.5f, 0.5f));

        // Light 1: Green, orbiting
        lights[1].ambient(Color(0.0f, 0.1f, 0.0f));
        lights[1].diffuse(Color(0.2f, 1.0f, 0.2f));
        lights[1].specular(Color(0.5f, 1.0f, 0.5f));

        // Light 2: Blue, orbiting
        lights[2].ambient(Color(0.0f, 0.0f, 0.1f));
        lights[2].diffuse(Color(0.2f, 0.2f, 1.0f));
        lights[2].specular(Color(0.5f, 0.5f, 1.0f));

        // Light 3: White directional light from above
        lights[3].ambient(Color(0.1f, 0.1f, 0.1f));
        lights[3].diffuse(Color(0.5f, 0.5f, 0.5f));
        lights[3].specular(Color(1.0f, 1.0f, 1.0f));
        lights[3].dir(0, -1, -0.5);  // Directional light

        // Configure material
        material.ambient(Color(0.2f, 0.2f, 0.2f));
        material.diffuse(Color(0.8f, 0.8f, 0.8f));
        material.specular(Color(1.0f, 1.0f, 1.0f));
        material.shininess(50.0f);

        nav().pos(0, 2, 8);
        nav().faceToward(Vec3f(0, 0, 0));
        configureWebAudio(44100, 128, 2, 0);

        std::cout << "[INFO] Multi-Light Test" << std::endl;
        std::cout << "[INFO] Press 1-4 to toggle lights" << std::endl;
        std::cout << "[INFO] Red, Green, Blue point lights + White directional" << std::endl;
    }

    void onAnimate(double dt) override {
        time += dt;

        // Update light positions (orbiting)
        float r = 3.0f;
        float h = 1.5f;

        lights[0].pos(r * cos(time), h, r * sin(time));
        lights[1].pos(r * cos(time + 2.094f), h, r * sin(time + 2.094f));  // 120 degrees offset
        lights[2].pos(r * cos(time + 4.189f), h, r * sin(time + 4.189f));  // 240 degrees offset
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f, 0.05f, 0.08f);
        g.depthTesting(true);

        // Apply material
        g.material(material);

        // Enable lighting with multiple lights
        g.lighting(true);
        for (int i = 0; i < 4; i++) {
            g.light(lights[i], i);
        }

        // Draw ground plane
        g.draw(plane);

        // Draw main sphere
        g.color(1.0f, 1.0f, 1.0f);
        g.draw(sphere);

        // Draw smaller spheres around
        for (int i = 0; i < 8; i++) {
            g.pushMatrix();
            float angle = i * M_PI / 4.0f + time * 0.2f;
            g.translate(4.0f * cos(angle), -1.0f, 4.0f * sin(angle));
            g.scale(0.5f);
            g.draw(sphere);
            g.popMatrix();
        }

        // Draw light position markers (unlit)
        g.lighting(false);
        for (int i = 0; i < 3; i++) {
            g.pushMatrix();
            Vec3f pos = lights[i].pos();
            g.translate(pos);
            g.color(lights[i].diffuse());
            g.draw(lightMarker);
            g.popMatrix();
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() >= '1' && k.key() <= '4') {
            int idx = k.key() - '1';
            // Toggle light by setting diffuse to black or restoring
            Color diff = lights[idx].diffuse();
            if (diff.r > 0.1f || diff.g > 0.1f || diff.b > 0.1f) {
                lights[idx].diffuse(Color(0, 0, 0));
                std::cout << "[INFO] Light " << (idx + 1) << " OFF" << std::endl;
            } else {
                // Restore original color
                Color colors[] = {
                    Color(1.0f, 0.2f, 0.2f),
                    Color(0.2f, 1.0f, 0.2f),
                    Color(0.2f, 0.2f, 1.0f),
                    Color(0.5f, 0.5f, 0.5f)
                };
                lights[idx].diffuse(colors[idx]);
                std::cout << "[INFO] Light " << (idx + 1) << " ON" << std::endl;
            }
            return true;
        }
        return false;
    }
};

ALLOLIB_WEB_MAIN(MultiLightTest)
