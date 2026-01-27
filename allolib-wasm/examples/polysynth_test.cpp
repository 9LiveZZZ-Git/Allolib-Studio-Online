/**
 * AlloLib Web - PolySynth Test
 * Tests polyphonic voice management with SynthVoice
 *
 * This verifies Phase 4: Scene System (SynthVoice, PolySynth)
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/scene/al_PolySynth.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"

using namespace al;
using namespace gam;

// Define a voice for polyphonic synthesis
struct SineVoice : SynthVoice {
    Sine<> osc;
    ADSR<> env{0.01, 0.1, 0.7, 0.3};
    float amp = 0.15f;
    Mesh mesh;

    SineVoice() {
        addSphere(mesh, 0.2, 16, 16);
    }

    void setFreq(float f) { osc.freq(f); }

    void onProcess(AudioIOData& io) override {
        while (io()) {
            float s = osc() * env() * amp;
            io.out(0) += s;
            io.out(1) += s;
        }
        if (env.done()) free();
    }

    void onProcess(Graphics& g) override {
        float envValue = env.value();
        g.pushMatrix();
        g.blending(true);
        g.blendTrans();
        // Position based on frequency
        float x = (osc.freq() - 440.0f) / 200.0f;
        g.translate(x, envValue - 0.5f, -4);
        g.color(HSV(osc.freq() / 1000.0f, 0.8f, envValue));
        g.draw(mesh);
        g.popMatrix();
    }

    void onTriggerOn() override { env.reset(); }
    void onTriggerOff() override { env.release(); }
};

class PolySynthTestApp : public WebApp {
public:
    PolySynth synth;
    Mesh bgMesh;

    void onCreate() override {
        // Pre-allocate voices
        synth.allocatePolyphony<SineVoice>(16);

        // Background mesh
        addSphere(bgMesh, 0.5, 32, 32);
        bgMesh.generateNormals();

        // Set up camera
        nav().pos(0, 0, 5);

        // Configure audio
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        synth.update(dt);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);

        // Draw background
        g.pushMatrix();
        g.translate(0, 0, -8);
        g.color(0.2f, 0.2f, 0.3f);
        g.draw(bgMesh);
        g.popMatrix();

        // Render all active voices
        synth.render(g);
    }

    void onSound(AudioIOData& io) override {
        synth.render(io);
    }

    bool onKeyDown(const Keyboard& k) override {
        // Use number keys 1-8 for different notes
        int key = k.key();
        float freq = 0.0f;

        switch (key) {
            case '1': freq = 261.63f; break; // C4
            case '2': freq = 293.66f; break; // D4
            case '3': freq = 329.63f; break; // E4
            case '4': freq = 349.23f; break; // F4
            case '5': freq = 392.00f; break; // G4
            case '6': freq = 440.00f; break; // A4
            case '7': freq = 493.88f; break; // B4
            case '8': freq = 523.25f; break; // C5
        }

        if (freq > 0.0f) {
            auto* voice = synth.getVoice<SineVoice>();
            if (voice) {
                voice->setFreq(freq);
                synth.triggerOn(voice, 0, key);
            }
        }

        return true;
    }

    bool onKeyUp(const Keyboard& k) override {
        int key = k.key();
        if (key >= '1' && key <= '8') {
            synth.triggerOff(key);
        }
        return true;
    }
};

ALLOLIB_WEB_MAIN(PolySynthTestApp)
