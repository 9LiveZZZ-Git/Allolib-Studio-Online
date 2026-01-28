/**
 * Phase 5 Test: Blending Modes
 * Tests various blend modes and render states:
 * - Alpha blending
 * - Additive blending
 * - Multiplicative blending
 * - Depth testing on/off
 * - Face culling
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

class BlendModesTest : public WebApp {
public:
    Mesh sphere;
    Mesh quad;
    double time = 0;

    int blendMode = 0;
    const int numBlendModes = 5;
    const char* blendModeNames[5] = {
        "Off (Opaque)",
        "Alpha Blend",
        "Additive",
        "Multiply",
        "Screen"
    };

    bool depthTestEnabled = true;
    bool cullFaceEnabled = false;

    void onCreate() override {
        addSphere(sphere, 1.0, 32, 32);
        sphere.generateNormals();

        // Create a quad
        quad.primitive(Mesh::TRIANGLES);
        quad.vertex(-1, -1, 0); quad.color(1, 1, 1, 0.5);
        quad.vertex( 1, -1, 0); quad.color(1, 1, 1, 0.5);
        quad.vertex( 1,  1, 0); quad.color(1, 1, 1, 0.5);
        quad.vertex(-1, -1, 0); quad.color(1, 1, 1, 0.5);
        quad.vertex( 1,  1, 0); quad.color(1, 1, 1, 0.5);
        quad.vertex(-1,  1, 0); quad.color(1, 1, 1, 0.5);

        nav().pos(0, 0, 8);
        configureWebAudio(44100, 128, 2, 0);

        std::cout << "[INFO] Blend Modes Test" << std::endl;
        std::cout << "[INFO] Press SPACE to cycle blend modes" << std::endl;
        std::cout << "[INFO] Press 'D' to toggle depth testing" << std::endl;
        std::cout << "[INFO] Press 'C' to toggle face culling" << std::endl;
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void setBlendMode(Graphics& g, int mode) {
        switch (mode) {
            case 0:  // Off
                g.blending(false);
                break;
            case 1:  // Alpha blend
                g.blending(true);
                g.blendTrans();  // Standard alpha blending
                break;
            case 2:  // Additive
                g.blending(true);
                g.blendAdd();
                break;
            case 3:  // Multiply
                g.blending(true);
                g.blendMult();
                break;
            case 4:  // Screen
                g.blending(true);
                g.blendScreen();
                break;
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.2f, 0.2f, 0.25f);

        // Set render states
        g.depthTesting(depthTestEnabled);
        if (cullFaceEnabled) {
            g.cullFace(true);
        } else {
            g.cullFace(false);
        }

        // Draw opaque background elements first
        g.blending(false);
        g.lighting(true);

        // Grid of small spheres in background
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

        // Now draw transparent objects with current blend mode
        setBlendMode(g, blendMode);
        g.lighting(false);

        // Draw overlapping colored spheres
        float colors[][4] = {
            {1.0f, 0.2f, 0.2f, 0.5f},  // Red
            {0.2f, 1.0f, 0.2f, 0.5f},  // Green
            {0.2f, 0.2f, 1.0f, 0.5f},  // Blue
            {1.0f, 1.0f, 0.2f, 0.5f},  // Yellow
            {1.0f, 0.2f, 1.0f, 0.5f},  // Magenta
            {0.2f, 1.0f, 1.0f, 0.5f},  // Cyan
        };

        for (int i = 0; i < 6; i++) {
            g.pushMatrix();
            float angle = i * M_PI / 3.0f + time * 0.3f;
            float r = 2.0f;
            g.translate(r * cos(angle), r * sin(angle), 0);
            g.scale(1.2f);
            g.color(colors[i][0], colors[i][1], colors[i][2], colors[i][3]);
            g.draw(sphere);
            g.popMatrix();
        }

        // Central white sphere
        g.pushMatrix();
        g.scale(1.5f);
        g.color(1, 1, 1, 0.7f);
        g.draw(sphere);
        g.popMatrix();

        // Animated rotating quads
        for (int i = 0; i < 4; i++) {
            g.pushMatrix();
            g.rotate(time * 30 + i * 90, 0, 0, 1);
            g.translate(3.5f, 0, 1);
            g.scale(0.8f);
            Color col(HSV(i / 4.0f + time * 0.1f, 0.8f, 1.0f));
            col.a = 0.6f;
            g.color(col);
            g.draw(quad);
            g.popMatrix();
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') {
            blendMode = (blendMode + 1) % numBlendModes;
            std::cout << "[INFO] Blend mode: " << blendModeNames[blendMode] << std::endl;
            return true;
        }
        if (k.key() == 'd' || k.key() == 'D') {
            depthTestEnabled = !depthTestEnabled;
            std::cout << "[INFO] Depth testing: " << (depthTestEnabled ? "ON" : "OFF") << std::endl;
            return true;
        }
        if (k.key() == 'c' || k.key() == 'C') {
            cullFaceEnabled = !cullFaceEnabled;
            std::cout << "[INFO] Face culling: " << (cullFaceEnabled ? "ON" : "OFF") << std::endl;
            return true;
        }
        return false;
    }
};

ALLOLIB_WEB_MAIN(BlendModesTest)
