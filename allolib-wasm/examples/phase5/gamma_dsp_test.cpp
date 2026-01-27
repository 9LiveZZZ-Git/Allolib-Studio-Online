/**
 * Phase 5 Test: Gamma DSP Comprehensive
 * Tests all major Gamma DSP components:
 * - Oscillators: Sine, Saw, Square, Triangle, Pulse
 * - Envelopes: ADSR, Decay, Seg
 * - Filters: Biquad (LP, HP, BP), OnePole
 * - Effects: Delay, basic reverb
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
    // Oscillators
    Sine<> sine;
    Saw<> saw;
    Square<> square;
    Tri<> tri;
    Pulse<> pulse;

    // Envelope
    ADSR<> adsr;

    // Filters
    Biquad<> lowpass;
    Biquad<> highpass;
    OnePole<> smoother;

    // Effects
    Delay<float, ipl::Linear> delay;
    Comb<> comb1, comb2;  // For simple reverb

    // Noise source
    NoisePink<> pink;

    // State
    int oscType = 0;
    const int numOscTypes = 6;
    const char* oscNames[6] = {"Sine", "Saw", "Square", "Triangle", "Pulse", "Pink Noise"};

    float baseFreq = 220.0f;
    float filterCutoff = 2000.0f;
    float delayMix = 0.3f;
    bool filterEnabled = true;
    bool delayEnabled = true;

    // Visualization
    Mesh oscWave;
    float waveBuffer[256];
    int waveIndex = 0;

    double time = 0;

    void onCreate() override {
        // Initialize Gamma domain
        gam::sampleRate(44100);

        // Configure oscillators
        sine.freq(baseFreq);
        saw.freq(baseFreq);
        square.freq(baseFreq);
        tri.freq(baseFreq);
        pulse.freq(baseFreq);
        pulse.width(0.3f);

        // Configure envelope
        adsr.attack(0.01f);
        adsr.decay(0.1f);
        adsr.sustain(0.7f);
        adsr.release(0.3f);

        // Configure filters
        lowpass.type(Biquad<>::LOW_PASS);
        lowpass.freq(filterCutoff);
        lowpass.res(2.0f);

        highpass.type(Biquad<>::HIGH_PASS);
        highpass.freq(100.0f);

        smoother.freq(10.0f);

        // Configure delay (300ms)
        delay.maxDelay(1.0f);
        delay.delay(0.3f);

        // Comb filters for simple reverb
        comb1.delay(0.035f);
        comb1.decay(0.5f);
        comb2.delay(0.042f);
        comb2.decay(0.5f);

        // Initialize wave display
        oscWave.primitive(Mesh::LINE_STRIP);
        for (int i = 0; i < 256; i++) {
            waveBuffer[i] = 0;
            oscWave.vertex((i / 255.0f) * 4.0f - 2.0f, 0, 0);
            oscWave.color(0.3f, 0.8f, 1.0f);
        }

        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);

        // Trigger initial note
        adsr.reset();

        std::cout << "[INFO] Gamma DSP Comprehensive Test" << std::endl;
        std::cout << "[INFO] Press 1-6 to switch oscillators" << std::endl;
        std::cout << "[INFO] Press SPACE to trigger envelope" << std::endl;
        std::cout << "[INFO] Press UP/DOWN to change frequency" << std::endl;
        std::cout << "[INFO] Press F to toggle filter, D to toggle delay" << std::endl;
    }

    void onAnimate(double dt) override {
        time += dt;

        // Update wave display mesh
        for (int i = 0; i < 256; i++) {
            oscWave.vertices()[i].y = waveBuffer[i] * 1.5f;
        }
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);

        // Draw waveform
        g.depthTesting(false);
        g.lineWidth(2);

        g.pushMatrix();
        g.translate(0, 0.5f, 0);
        g.color(0.3f, 0.8f, 1.0f);
        g.draw(oscWave);
        g.popMatrix();

        // Draw frequency visualization
        g.pushMatrix();
        g.translate(0, -1.0f, 0);
        float barWidth = 0.1f;
        float barHeight = (baseFreq / 880.0f) * 2.0f;
        g.color(HSV(baseFreq / 880.0f, 0.8f, 1.0f));
        g.scale(barWidth, barHeight, 0.1f);
        Mesh bar;
        addCube(bar, 1.0f);
        g.draw(bar);
        g.popMatrix();
    }

    void onSound(AudioIOData& io) override {
        while (io()) {
            // Get envelope value
            float env = adsr();

            // Generate oscillator sample based on type
            float osc = 0;
            switch (oscType) {
                case 0: osc = sine(); break;
                case 1: osc = saw(); break;
                case 2: osc = square(); break;
                case 3: osc = tri(); break;
                case 4: osc = pulse(); break;
                case 5: osc = pink(); break;
            }

            // Apply envelope
            float sample = osc * env * 0.5f;

            // Apply filter
            if (filterEnabled) {
                sample = lowpass(sample);
                sample = highpass(sample);
            }

            // Store for visualization
            waveBuffer[waveIndex] = sample;
            waveIndex = (waveIndex + 1) % 256;

            // Apply delay/reverb
            if (delayEnabled) {
                float delayed = delay(sample);
                float reverb = (comb1(sample) + comb2(sample)) * 0.3f;
                sample = sample * 0.7f + delayed * delayMix + reverb * 0.2f;
            }

            // Soft clip
            sample = tanh(sample);

            // Output stereo
            io.out(0) = sample;
            io.out(1) = sample;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        // Number keys for oscillator selection
        if (k.key() >= '1' && k.key() <= '6') {
            oscType = k.key() - '1';
            std::cout << "[INFO] Oscillator: " << oscNames[oscType] << std::endl;
            return true;
        }

        // Space to trigger envelope
        if (k.key() == ' ') {
            adsr.reset();
            std::cout << "[INFO] Envelope triggered" << std::endl;
            return true;
        }

        // Arrow keys for frequency
        if (k.key() == Keyboard::UP) {
            baseFreq = std::min(baseFreq * 1.1f, 2000.0f);
            updateFrequencies();
            std::cout << "[INFO] Frequency: " << baseFreq << " Hz" << std::endl;
            return true;
        }
        if (k.key() == Keyboard::DOWN) {
            baseFreq = std::max(baseFreq / 1.1f, 55.0f);
            updateFrequencies();
            std::cout << "[INFO] Frequency: " << baseFreq << " Hz" << std::endl;
            return true;
        }

        // F for filter toggle
        if (k.key() == 'f' || k.key() == 'F') {
            filterEnabled = !filterEnabled;
            std::cout << "[INFO] Filter: " << (filterEnabled ? "ON" : "OFF") << std::endl;
            return true;
        }

        // D for delay toggle
        if (k.key() == 'd' || k.key() == 'D') {
            delayEnabled = !delayEnabled;
            std::cout << "[INFO] Delay: " << (delayEnabled ? "ON" : "OFF") << std::endl;
            return true;
        }

        return false;
    }

    void updateFrequencies() {
        sine.freq(baseFreq);
        saw.freq(baseFreq);
        square.freq(baseFreq);
        tri.freq(baseFreq);
        pulse.freq(baseFreq);
    }
};

ALLOLIB_WEB_MAIN(GammaDSPTest)
