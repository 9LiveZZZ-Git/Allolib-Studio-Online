/**
 * AlloLib Web - DynamicScene Test
 * Tests spatial audio scene with PositionedVoice
 *
 * This verifies Phase 4: DynamicScene, PositionedVoice
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/scene/al_DynamicScene.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
#include "al/math/al_Random.hpp"

using namespace al;
using namespace gam;

// A positioned voice that has spatial audio and graphics
struct SpatialVoice : public PositionedVoice {
    Sine<> osc;
    AD<> env{0.1f, 1.5f};
    Mesh mesh;
    float freq = 440.0f;

    SpatialVoice() {
        addSphere(mesh, 0.1, 16, 16);
        mesh.generateNormals();
    }

    void setFreq(float f) {
        freq = f;
        osc.freq(f);
    }

    void onProcess(AudioIOData& io) override {
        while (io()) {
            io.out(0) = osc() * env() * 0.1f;
        }
        if (env.done()) {
            free();
        }
    }

    void onProcess(Graphics& g) override {
        float envVal = env.value();
        g.color(HSV(freq / 1000.0f, 0.8f, envVal));
        g.draw(mesh);
    }

    void update(double dt) override {
        // Move the voice in a circular pattern
        auto p = pose();
        float angle = freq * 0.001f * env.value() * 10.0f;
        float radius = 2.0f;
        p.pos().x = cosf(angle) * radius;
        p.pos().y = sinf(angle) * radius;
        p.pos().z = -5.0f;
        setPose(p);
    }

    void onTriggerOn() override {
        env.reset();
    }
};

class DynamicSceneTestApp : public WebApp {
public:
    DynamicScene scene;
    double lastTrigger = 0;
    double triggerInterval = 0.5;
    int noteIndex = 0;

    void onCreate() override {
        // Allocate voices in the scene
        scene.allocatePolyphony<SpatialVoice>(16);

        // Set up camera
        nav().pos(0, 0, 5);

        // Configure audio
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        lastTrigger += dt;
        scene.update(dt);

        // Auto-trigger voices
        if (lastTrigger > triggerInterval) {
            lastTrigger = 0;

            float freq = 220.0f * powf(2.0f, noteIndex / 12.0f);
            noteIndex = (noteIndex + 3) % 24; // Cycle through 2 octaves

            auto* voice = scene.getVoice<SpatialVoice>();
            if (voice) {
                voice->setFreq(freq);
                scene.triggerOn(voice);
            }
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05f, 0.05f, 0.1f);
        g.depthTesting(true);
        g.lighting(true);

        // Render all active spatial voices
        scene.render(g);
    }

    void onSound(AudioIOData& io) override {
        // Set listener pose for spatial audio
        scene.listenerPose(nav());
        scene.render(io);
    }

    bool onKeyDown(const Keyboard& k) override {
        // Use number keys to trigger notes
        if (k.key() >= '1' && k.key() <= '8') {
            float freq = 220.0f * (k.key() - '0');
            auto* voice = scene.getVoice<SpatialVoice>();
            if (voice) {
                voice->setFreq(freq);
                scene.triggerOn(voice, 0, k.key());
            }
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(DynamicSceneTestApp)
