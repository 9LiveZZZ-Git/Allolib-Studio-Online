/**
 * AlloLib WebAssembly Test Application
 *
 * Simple test to verify the Emscripten build is working.
 * Renders a rotating colored sphere with basic audio output.
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/math/al_Vec.hpp"
#include "al/types/al_Color.hpp"

#include <cmath>

using namespace al;

struct TestApp : WebApp {
    Mesh mesh;
    double phase = 0;
    double audioPhase = 0;
    float frequency = 440.0f;

    void onCreate() override {
        // Create a sphere mesh
        addSphere(mesh, 1.0, 32, 32);
        mesh.generateNormals();

        // Add vertex colors
        for (size_t i = 0; i < mesh.vertices().size(); ++i) {
            float t = float(i) / float(mesh.vertices().size());
            mesh.color(HSV(t, 0.8f, 1.0f));
        }

        // Setup camera
        nav().pos(0, 0, 5);
        nav().faceToward(Vec3d(0, 0, 0));

        // Configure audio
        configureWebAudio(44100, 512, 2, 0);
    }

    void onAnimate(double dt) override {
        phase += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);

        g.depthTesting(true);
        g.lighting(true);

        // Rotate the sphere
        g.pushMatrix();
        g.rotate(phase * 30.0, 0, 1, 0);
        g.rotate(phase * 20.0, 1, 0, 0);

        // Draw with mesh colors
        g.meshColor();
        g.draw(mesh);

        g.popMatrix();
    }

    void onSound(AudioIOData& io) override {
        // Simple sine wave output
        float inc = frequency / float(io.framesPerSecond());

        while (io()) {
            float sample = std::sin(audioPhase * 2.0 * M_PI) * 0.2f;
            audioPhase += inc;
            if (audioPhase >= 1.0) audioPhase -= 1.0;

            io.out(0) = sample;
            io.out(1) = sample;
        }
    }

    bool onKeyDown(Keyboard const& k) override {
        switch (k.key()) {
            case '1': frequency = 261.63f; break; // C4
            case '2': frequency = 293.66f; break; // D4
            case '3': frequency = 329.63f; break; // E4
            case '4': frequency = 349.23f; break; // F4
            case '5': frequency = 392.00f; break; // G4
            case '6': frequency = 440.00f; break; // A4
            case '7': frequency = 493.88f; break; // B4
            case '8': frequency = 523.25f; break; // C5
        }
        return true;
    }
};

// Create web app exports
ALLOLIB_WEB_MAIN(TestApp)
