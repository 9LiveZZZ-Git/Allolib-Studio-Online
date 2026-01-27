/**
 * Phase 5 Test: Transform Stack
 * Tests matrix operations:
 * - pushMatrix/popMatrix
 * - translate
 * - rotate
 * - scale
 * - Model/View/Projection matrices
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

class TransformStackTest : public WebApp {
public:
    Mesh cube;
    Mesh sphere;
    Mesh axes;
    double time = 0;

    void onCreate() override {
        // Create cube
        addCube(cube, 0.5);
        cube.generateNormals();

        // Create small sphere
        addSphere(sphere, 0.15, 16, 16);
        sphere.generateNormals();

        // Create coordinate axes
        axes.primitive(Mesh::LINES);
        // X axis (red)
        axes.vertex(0, 0, 0); axes.color(1, 0, 0);
        axes.vertex(1, 0, 0); axes.color(1, 0, 0);
        // Y axis (green)
        axes.vertex(0, 0, 0); axes.color(0, 1, 0);
        axes.vertex(0, 1, 0); axes.color(0, 1, 0);
        // Z axis (blue)
        axes.vertex(0, 0, 0); axes.color(0, 0, 1);
        axes.vertex(0, 0, 1); axes.color(0, 0, 1);

        nav().pos(0, 2, 8);
        nav().faceToward(Vec3f(0, 0, 0));
        configureWebAudio(44100, 128, 2, 0);

        std::cout << "[INFO] Transform Stack Test" << std::endl;
        std::cout << "[INFO] Demonstrates nested transformations" << std::endl;
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        // Draw origin axes
        g.lighting(false);
        g.lineWidth(2);
        g.draw(axes);
        g.lighting(true);

        // === Test 1: Nested transforms (solar system) ===

        // Sun at origin
        g.pushMatrix();
        g.color(1.0f, 0.8f, 0.2f);
        g.scale(1.5);
        g.draw(sphere);
        g.popMatrix();

        // Earth orbit
        g.pushMatrix();
        g.rotate(time * 30, 0, 1, 0);  // Orbit around sun
        g.translate(3, 0, 0);          // Move out from sun

        // Earth
        g.pushMatrix();
        g.rotate(time * 100, 0, 1, 0.3);  // Earth rotation
        g.scale(0.5);
        g.color(0.2f, 0.5f, 1.0f);
        g.draw(sphere);
        g.popMatrix();

        // Moon orbits Earth
        g.pushMatrix();
        g.rotate(time * 120, 0, 1, 0);  // Moon orbit
        g.translate(0.8, 0, 0);
        g.scale(0.2);
        g.color(0.7f, 0.7f, 0.7f);
        g.draw(sphere);
        g.popMatrix();

        g.popMatrix();

        // === Test 2: Scale and rotation interaction ===
        g.pushMatrix();
        g.translate(-3, 0, 0);

        for (int i = 0; i < 5; i++) {
            g.pushMatrix();
            float angle = i * 72 + time * 50;
            g.rotate(angle, 0, 1, 0);
            g.translate(1.5, 0, 0);
            g.scale(0.3f + 0.1f * sin(time * 2 + i));
            g.color(HSV(i / 5.0f, 0.8f, 1.0f));
            g.draw(cube);
            g.popMatrix();
        }

        g.popMatrix();

        // === Test 3: Hierarchical arm ===
        g.pushMatrix();
        g.translate(4, -1, 0);

        // Base
        g.color(0.5f, 0.5f, 0.5f);
        g.pushMatrix();
        g.scale(0.8f, 0.2f, 0.8f);
        g.draw(cube);
        g.popMatrix();

        // First joint
        g.rotate(sin(time) * 45, 0, 0, 1);
        g.translate(0, 0.8, 0);

        g.color(1.0f, 0.3f, 0.3f);
        g.pushMatrix();
        g.scale(0.3f, 0.8f, 0.3f);
        g.draw(cube);
        g.popMatrix();

        // Second joint
        g.translate(0, 0.8, 0);
        g.rotate(sin(time * 1.5) * 60, 0, 0, 1);
        g.translate(0, 0.6, 0);

        g.color(0.3f, 1.0f, 0.3f);
        g.pushMatrix();
        g.scale(0.25f, 0.6f, 0.25f);
        g.draw(cube);
        g.popMatrix();

        // End effector
        g.translate(0, 0.6, 0);
        g.rotate(sin(time * 2) * 30, 0, 0, 1);
        g.translate(0, 0.3, 0);

        g.color(0.3f, 0.3f, 1.0f);
        g.pushMatrix();
        g.scale(0.2f, 0.3f, 0.2f);
        g.draw(cube);
        g.popMatrix();

        g.popMatrix();

        // === Test 4: Non-uniform scaling ===
        g.pushMatrix();
        g.translate(0, -2, 0);

        for (int i = 0; i < 7; i++) {
            g.pushMatrix();
            float x = (i - 3) * 1.2f;
            g.translate(x, 0, 0);

            float scaleX = 0.5f + 0.3f * sin(time + i);
            float scaleY = 0.5f + 0.3f * cos(time + i);
            float scaleZ = 0.5f + 0.3f * sin(time * 0.7f + i);

            g.scale(scaleX, scaleY, scaleZ);
            g.color(HSV(i / 7.0f + time * 0.1f, 0.7f, 1.0f));
            g.draw(cube);
            g.popMatrix();
        }

        g.popMatrix();
    }
};

ALLOLIB_WEB_MAIN(TransformStackTest)
