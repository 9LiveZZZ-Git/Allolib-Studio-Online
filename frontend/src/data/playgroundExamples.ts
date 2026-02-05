/**
 * AlloLib Playground Tutorials - Ported for AlloLib Studio Online
 *
 * These examples are adapted from the allolib_playground tutorials repository.
 * They demonstrate polyphonic synthesis using SynthVoice and PolySynth.
 *
 * Original tutorials by: AlloSphere Research Group
 * Web adaptation by: AlloLib Studio Online
 */

import type { Example, ExampleCategory } from './examples'

export const playgroundCategories: ExampleCategory[] = [
  {
    id: 'playground-synthesis',
    title: 'Playground - Synthesis',
    subcategories: [
      { id: 'envelopes', title: 'Envelopes' },
      { id: 'oscillators', title: 'Oscillators' },
      { id: 'modulation', title: 'Modulation' },
      { id: 'filters', title: 'Filters' },
    ],
  },
  {
    id: 'playground-audiovisual',
    title: 'Playground - AudioVisual',
    subcategories: [
      { id: 'basic-av', title: 'Basic Audio-Visual' },
      { id: 'advanced-av', title: 'Advanced Audio-Visual' },
    ],
  },
]

export const playgroundExamples: Example[] = [
  // ==========================================================================
  // PLAYGROUND - SYNTHESIS - Envelopes
  // ==========================================================================
  {
    id: 'pg-sine-env',
    title: 'Sine Envelope',
    description: 'Basic sine wave with ADSR envelope - play with keyboard (QWERTY)',
    category: 'playground-synthesis',
    subcategory: 'envelopes',
    code: `/**
 * Playground Tutorial: Sine Envelope
 *
 * A polyphonic sine synthesizer with envelope control.
 * Play notes using your keyboard like a piano:
 * - Bottom row (ZXCVBNM) = C3-B3
 * - Middle row (QWERTY) = C4-B4 (middle C)
 * - Number keys for sharps/flats
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"

#include "Gamma/Analysis.h"
#include "Gamma/Effects.h"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"

using namespace al;

class SineEnv : public SynthVoice {
public:
    gam::Pan<> mPan;
    gam::Sine<> mOsc;
    gam::Env<3> mAmpEnv;
    gam::EnvFollow<> mEnvFollow;
    Mesh mMesh;

    void init() override {
        mAmpEnv.curve(0);
        mAmpEnv.levels(0, 1, 1, 0);
        mAmpEnv.sustainPoint(2);

        addDisc(mMesh, 1.0, 30);

        createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 60, 20, 5000);
        createInternalTriggerParameter("attackTime", 0.1, 0.01, 3.0);
        createInternalTriggerParameter("releaseTime", 1.0, 0.1, 10.0);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    void onProcess(AudioIOData& io) override {
        mOsc.freq(getInternalParameterValue("frequency"));
        mAmpEnv.lengths()[0] = getInternalParameterValue("attackTime");
        mAmpEnv.lengths()[2] = getInternalParameterValue("releaseTime");
        mPan.pos(getInternalParameterValue("pan"));

        while (io()) {
            float s1 = mOsc() * mAmpEnv() * getInternalParameterValue("amplitude");
            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }
        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001f)) free();
    }

    void onProcess(Graphics& g) override {
        float frequency = getInternalParameterValue("frequency");
        float amplitude = getInternalParameterValue("amplitude");
        g.pushMatrix();
        g.translate(frequency / 200 - 3, amplitude, -8);
        g.scale(1 - amplitude, amplitude, 1);
        g.color(mEnvFollow.value(), frequency / 1000, mEnvFollow.value() * 10, 0.4);
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override { mAmpEnv.reset(); }
    void onTriggerOff() override { mAmpEnv.release(); }
};

class MyApp : public App {
public:
    SynthGUIManager<SineEnv> synthManager{"SineEnv"};

    // GUI Parameters
    Parameter amplitude{"Amplitude", "", 0.3f, 0.0f, 1.0f};
    Parameter attackTime{"Attack", "", 0.1f, 0.01f, 3.0f};
    Parameter releaseTime{"Release", "", 1.0f, 0.1f, 10.0f};
    ControlGUI gui;

    void onCreate() override {
        gam::sampleRate(44100);
        nav().pos(0, 0, 10);

        // Register parameters with GUI
        gui << amplitude << attackTime << releaseTime;
        gui.init();

        std::cout << "[Sine Envelope Synth]" << std::endl;
        std::cout << "Play with keyboard: ZXCVBNM (C3-B3), QWERTY (C4-B4)" << std::endl;
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);
    }

    void onAnimate(double dt) override {
        gui.draw();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1);
        g.lighting(true);
        g.depthTesting(true);
        synthManager.render(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.voice()->setInternalParameterValue(
                "frequency", ::pow(2.f, (midiNote - 69.f) / 12.f) * 440.f);
            synthManager.voice()->setInternalParameterValue("amplitude", amplitude.get());
            synthManager.voice()->setInternalParameterValue("attackTime", attackTime.get());
            synthManager.voice()->setInternalParameterValue("releaseTime", releaseTime.get());
            synthManager.triggerOn(midiNote);
        }
        return true;
    }

    bool onKeyUp(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.triggerOff(midiNote);
        }
        return true;
    }
};

ALLOLIB_MAIN(MyApp)
`,
  },

  // ==========================================================================
  // PLAYGROUND - SYNTHESIS - Oscillators
  // ==========================================================================
  {
    id: 'pg-osc-env',
    title: 'Wavetable Oscillator',
    description: 'Multiple waveforms (saw, square, sine, pulse) with envelope',
    category: 'playground-synthesis',
    subcategory: 'oscillators',
    code: `/**
 * Playground Tutorial: Wavetable Oscillator
 *
 * Polyphonic synth with multiple waveform options.
 * Uses wavetable synthesis for anti-aliased waveforms.
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"

#include "Gamma/Analysis.h"
#include "Gamma/Effects.h"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"

using namespace al;

// Wavetables for different waveforms
gam::ArrayPow2<float> tbSaw(2048), tbSqr(2048), tbSin(2048), tbPls(2048);

class OscEnv : public SynthVoice {
public:
    gam::Pan<> mPan;
    gam::Osc<> mOsc;
    gam::ADSR<> mAmpEnv;
    gam::EnvFollow<> mEnvFollow;
    Mesh mMesh;
    int currentTable = 0;

    void init() override {
        mAmpEnv.curve(0);
        mAmpEnv.levels(0, 0.3, 0.3, 0);
        mAmpEnv.sustainPoint(2);

        addDisc(mMesh, 1.0, 30);

        createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 220, 20, 5000);
        createInternalTriggerParameter("attackTime", 0.05, 0.01, 3.0);
        createInternalTriggerParameter("releaseTime", 0.5, 0.1, 10.0);
        createInternalTriggerParameter("table", 0, 0, 3);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    void onProcess(AudioIOData& io) override {
        mOsc.freq(getInternalParameterValue("frequency"));
        mPan.pos(getInternalParameterValue("pan"));

        while (io()) {
            float s1 = 0.3 * mOsc() * mAmpEnv() * getInternalParameterValue("amplitude");
            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }
        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001f)) free();
    }

    void onProcess(Graphics& g) override {
        float frequency = getInternalParameterValue("frequency");
        float amplitude = getInternalParameterValue("amplitude");
        g.pushMatrix();
        g.translate(frequency / 500 - 2, amplitude - 0.5, -6);
        g.scale(0.3, 0.3, 0.3);
        g.color(HSV(currentTable / 4.0f, 0.8, mEnvFollow.value() * 5 + 0.3));
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override {
        mAmpEnv.attack(getInternalParameterValue("attackTime"));
        mAmpEnv.release(getInternalParameterValue("releaseTime"));
        mAmpEnv.reset();

        currentTable = int(getInternalParameterValue("table"));
        switch (currentTable) {
            case 0: mOsc.source(tbSaw); break;
            case 1: mOsc.source(tbSqr); break;
            case 2: mOsc.source(tbSin); break;
            case 3: mOsc.source(tbPls); break;
        }
    }

    void onTriggerOff() override { mAmpEnv.triggerRelease(); }
};

class MyApp : public App {
public:
    SynthGUIManager<OscEnv> synthManager{"OscEnv"};

    // GUI Parameters
    Parameter amplitude{"Amplitude", "", 0.3f, 0.0f, 1.0f};
    Parameter attackTime{"Attack", "", 0.05f, 0.01f, 3.0f};
    Parameter releaseTime{"Release", "", 0.5f, 0.1f, 10.0f};
    ParameterInt waveform{"Waveform", "", 0, 0, 3};
    ControlGUI gui;

    void onCreate() override {
        gam::sampleRate(44100);

        // Initialize wavetables
        gam::addSinesPow<1>(tbSaw, 9, 1);  // Sawtooth
        gam::addSinesPow<1>(tbSqr, 9, 2);  // Square
        gam::addSine(tbSin);                // Sine
        float A[] = {1, 1, 1, 1, 0.7, 0.5, 0.3, 0.1};
        gam::addSines(tbPls, A, 8);         // Pulse

        // Register parameters with GUI (0=Saw, 1=Square, 2=Sine, 3=Pulse)
        gui << amplitude << attackTime << releaseTime << waveform;
        gui.init();

        nav().pos(0, 0, 8);
        std::cout << "[Wavetable Oscillator Synth]" << std::endl;
        std::cout << "Press 1-4 or use slider: 0=Saw, 1=Square, 2=Sine, 3=Pulse" << std::endl;
        std::cout << "Play with keyboard: ZXCVBNM (C3-B3), QWERTY (C4-B4)" << std::endl;
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);
    }

    void onAnimate(double dt) override {
        gui.draw();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05, 0.05, 0.1);
        g.lighting(true);
        g.depthTesting(true);
        synthManager.render(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        // Number keys change waveform
        if (k.key() >= '1' && k.key() <= '4') {
            waveform.set(k.key() - '1');
            const char* names[] = {"Sawtooth", "Square", "Sine", "Pulse"};
            std::cout << "Waveform: " << names[waveform.get()] << std::endl;
            return true;
        }

        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.voice()->setInternalParameterValue(
                "frequency", ::pow(2.f, (midiNote - 69.f) / 12.f) * 440.f);
            synthManager.voice()->setInternalParameterValue("table", waveform.get());
            synthManager.voice()->setInternalParameterValue("amplitude", amplitude.get());
            synthManager.voice()->setInternalParameterValue("attackTime", attackTime.get());
            synthManager.voice()->setInternalParameterValue("releaseTime", releaseTime.get());
            synthManager.triggerOn(midiNote);
        }
        return true;
    }

    bool onKeyUp(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.triggerOff(midiNote);
        }
        return true;
    }
};

ALLOLIB_MAIN(MyApp)
`,
  },

  // ==========================================================================
  // PLAYGROUND - SYNTHESIS - Modulation
  // ==========================================================================
  {
    id: 'pg-fm',
    title: 'FM Synthesis with Vibrato',
    description: 'FM synthesis with modulation indices and optional vibrato',
    category: 'playground-synthesis',
    subcategory: 'modulation',
    code: `/**
 * Playground Tutorial: FM Synthesis with Vibrato
 *
 * Full FM synthesis with three modulation indices and optional vibrato.
 * Based on 04_FMVib_visual from allolib_playground.
 *
 * Presets: brass, clarinet, oboe, bassoon, gong, drum
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"

#include "Gamma/Analysis.h"
#include "Gamma/Effects.h"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"

using namespace al;

class FM : public SynthVoice {
public:
    gam::Pan<> mPan;
    gam::ADSR<> mAmpEnv;
    gam::Env<3> mModEnv;
    gam::EnvFollow<> mEnvFollow;
    gam::Sine<> car, mod, mVib;
    Mesh mMesh;
    double a = 0;
    double b = 0;
    double timepose = 0;

    void init() override {
        mAmpEnv.levels(0, 1, 1, 0);
        mAmpEnv.sustainPoint(2);
        mModEnv.levels(0, 1, 1, 0);
        mModEnv.sustainPoint(2);

        addTetrahedron(mMesh);
        mMesh.decompress();
        mMesh.generateNormals();

        createInternalTriggerParameter("freq", 262, 10, 4000.0);
        createInternalTriggerParameter("amplitude", 0.5, 0.0, 1.0);
        createInternalTriggerParameter("attackTime", 0.1, 0.01, 3.0);
        createInternalTriggerParameter("releaseTime", 0.5, 0.1, 10.0);
        createInternalTriggerParameter("sustain", 0.75, 0.0, 1.0);

        // FM parameters
        createInternalTriggerParameter("idx1", 0.01, 0.0, 10.0);
        createInternalTriggerParameter("idx2", 7.0, 0.0, 10.0);
        createInternalTriggerParameter("idx3", 5.0, 0.0, 10.0);
        createInternalTriggerParameter("carMul", 1.0, 0.0, 20.0);
        createInternalTriggerParameter("modMul", 1.0007, 0.0, 20.0);

        // Vibrato parameters
        createInternalTriggerParameter("vibRate1", 0.0, 0.0, 20.0);
        createInternalTriggerParameter("vibRate2", 0.0, 0.0, 20.0);
        createInternalTriggerParameter("vibRise", 0.5, 0.0, 3.0);
        createInternalTriggerParameter("vibDepth", 0.0, 0.0, 1.0);

        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    void onProcess(AudioIOData& io) override {
        float freq = getInternalParameterValue("freq");
        float carMul = getInternalParameterValue("carMul");
        float modMul = getInternalParameterValue("modMul");
        float idx1 = getInternalParameterValue("idx1");
        float idx2 = getInternalParameterValue("idx2");
        float idx3 = getInternalParameterValue("idx3");
        float amp = getInternalParameterValue("amplitude");
        float vibDepth = getInternalParameterValue("vibDepth");

        while (io()) {
            mVib.freq(mModEnv());
            float carFreq = freq * carMul;
            float worbleFreq = carFreq + (mVib() * vibDepth * carFreq);
            mod.freq(freq * modMul);

            float modEnvValue = mModEnv();
            float modulation = mod() * (idx1 + (modEnvValue * (idx2 - idx1)));
            car.freq(worbleFreq + modulation * modMul * freq);

            float s1 = car() * mAmpEnv() * amp;
            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }
        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001)) free();
    }

    void onProcess(Graphics& g) override {
        a += 0.29;
        b += 0.23;
        timepose -= 0.06;

        g.pushMatrix();
        g.depthTesting(true);
        g.lighting(true);
        g.translate(timepose, getInternalParameterValue("freq") / 500 - 1, -4);
        g.rotate(a, Vec3f(0, 1, 0));
        g.rotate(b, Vec3f(1));
        g.scale(0.5 + mAmpEnv() * 0.5, 0.5 + mAmpEnv() * 0.5, 1);
        g.color(HSV(getInternalParameterValue("modMul") / 20, 0.7, 0.4 + mAmpEnv() * 0.6));
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override {
        timepose = 10;
        mAmpEnv.attack(getInternalParameterValue("attackTime"));
        mAmpEnv.release(getInternalParameterValue("releaseTime"));
        mAmpEnv.sustain(getInternalParameterValue("sustain"));

        mModEnv.levels(getInternalParameterValue("vibRate1"),
                       getInternalParameterValue("vibRate1"),
                       getInternalParameterValue("vibRate2"),
                       getInternalParameterValue("vibRate2"));
        mModEnv.lengths()[0] = getInternalParameterValue("vibRise");
        mModEnv.lengths()[1] = 0;
        mModEnv.lengths()[2] = getInternalParameterValue("vibRise");

        mPan.pos(getInternalParameterValue("pan"));
        mAmpEnv.reset();
        mModEnv.reset();
    }

    void onTriggerOff() override {
        mAmpEnv.triggerRelease();
    }
};

class MyApp : public App {
public:
    SynthGUIManager<FM> synthManager{"FM"};

    // GUI Parameters
    Parameter amplitude{"Amplitude", "", 0.5f, 0.0f, 1.0f};
    Parameter idx1{"Idx1 (start)", "", 0.01f, 0.0f, 10.0f};
    Parameter idx2{"Idx2 (peak)", "", 7.0f, 0.0f, 10.0f};
    Parameter idx3{"Idx3 (end)", "", 5.0f, 0.0f, 10.0f};
    Parameter carMul{"Carrier Mul", "", 1.0f, 0.0f, 20.0f};
    Parameter modMul{"Mod Mul", "", 1.0007f, 0.0f, 20.0f};
    Parameter vibRate1{"Vib Rate1", "", 0.0f, 0.0f, 20.0f};
    Parameter vibDepth{"Vib Depth", "", 0.0f, 0.0f, 1.0f};
    Parameter attackTime{"Attack", "", 0.1f, 0.01f, 3.0f};
    Parameter releaseTime{"Release", "", 0.5f, 0.1f, 10.0f};
    ControlGUI gui;

    void onCreate() override {
        gam::sampleRate(44100);
        nav().pos(0, 0, 8);

        // Register parameters with GUI
        gui << amplitude << idx1 << idx2 << carMul << modMul;
        gui << vibRate1 << vibDepth << attackTime << releaseTime;
        gui.init();

        std::cout << "[FM Synthesis with Vibrato]" << std::endl;
        std::cout << "Brass: idx2=7, modMul=1.0007" << std::endl;
        std::cout << "Oboe: carMul=3, idx1=2, idx2=2" << std::endl;
        std::cout << "Play with keyboard: ZXCVBNM, QWERTY" << std::endl;
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);
    }

    void onAnimate(double dt) override {
        gui.draw();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05, 0.02, 0.1);
        g.lighting(true);
        g.depthTesting(true);
        synthManager.render(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.voice()->setInternalParameterValue(
                "freq", ::pow(2.f, (midiNote - 69.f) / 12.f) * 440.f);
            synthManager.voice()->setInternalParameterValue("amplitude", amplitude.get());
            synthManager.voice()->setInternalParameterValue("idx1", idx1.get());
            synthManager.voice()->setInternalParameterValue("idx2", idx2.get());
            synthManager.voice()->setInternalParameterValue("idx3", idx3.get());
            synthManager.voice()->setInternalParameterValue("carMul", carMul.get());
            synthManager.voice()->setInternalParameterValue("modMul", modMul.get());
            synthManager.voice()->setInternalParameterValue("vibRate1", vibRate1.get());
            synthManager.voice()->setInternalParameterValue("vibDepth", vibDepth.get());
            synthManager.voice()->setInternalParameterValue("attackTime", attackTime.get());
            synthManager.voice()->setInternalParameterValue("releaseTime", releaseTime.get());
            synthManager.triggerOn(midiNote);
        }
        return true;
    }

    bool onKeyUp(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.triggerOff(midiNote);
        }
        return true;
    }
};

ALLOLIB_MAIN(MyApp)
`,
  },

  {
    id: 'pg-am',
    title: 'AM Synthesis',
    description: 'Amplitude modulation synthesis with tremolo effect',
    category: 'playground-synthesis',
    subcategory: 'modulation',
    code: `/**
 * Playground Tutorial: AM Synthesis
 *
 * Amplitude Modulation synthesis creates tremolo and ring modulation effects.
 * The modulator controls the amplitude of the carrier.
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"

#include "Gamma/Analysis.h"
#include "Gamma/Effects.h"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"

using namespace al;

class OscAM : public SynthVoice {
public:
    gam::Sine<> mOsc;       // Carrier
    gam::Sine<> mAM;        // Modulator
    gam::ADSR<> mAmpEnv;
    gam::ADSR<> mAMEnv;
    gam::EnvFollow<> mEnvFollow;
    gam::Pan<> mPan;
    Mesh mMesh;

    void init() override {
        mAmpEnv.levels(0, 1, 1, 0);
        mAmpEnv.sustainPoint(2);
        mAMEnv.curve(0);
        mAMEnv.levels(0, 1, 1, 0);
        mAMEnv.sustainPoint(2);

        addTorus(mMesh, 0.2, 0.5, 20, 20);
        mMesh.generateNormals();

        createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 440, 10, 4000.0);
        createInternalTriggerParameter("attackTime", 0.1, 0.01, 3.0);
        createInternalTriggerParameter("releaseTime", 0.5, 0.1, 10.0);
        createInternalTriggerParameter("amRatio", 0.5, 0.1, 4.0);
        createInternalTriggerParameter("amDepth", 0.5, 0.0, 1.0);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    void onProcess(AudioIOData& io) override {
        float freq = getInternalParameterValue("frequency");
        float amp = getInternalParameterValue("amplitude");
        float amRatio = getInternalParameterValue("amRatio");
        float amDepth = getInternalParameterValue("amDepth");

        mOsc.freq(freq);
        mAM.freq(freq * amRatio);

        while (io()) {
            float amAmount = mAMEnv() * amDepth;
            float s1 = mOsc();
            // Mix modulated and unmodulated signal
            s1 = s1 * (1 - amAmount) + (s1 * mAM()) * amAmount;
            s1 *= mAmpEnv() * amp;

            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }
        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001)) free();
    }

    void onProcess(Graphics& g) override {
        float freq = getInternalParameterValue("frequency");
        float amRatio = getInternalParameterValue("amRatio");
        g.pushMatrix();
        g.translate(freq / 400 - 1.5, amRatio / 2 - 1, -6);
        g.rotate(freq * 0.1, 0, 1, 0);
        g.scale(mEnvFollow.value() * 3 + 0.2);
        g.color(HSV(amRatio / 4, 0.7, mEnvFollow.value() * 3 + 0.4));
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override {
        mAmpEnv.attack(getInternalParameterValue("attackTime"));
        mAmpEnv.release(getInternalParameterValue("releaseTime"));
        mAMEnv.attack(getInternalParameterValue("attackTime"));
        mAMEnv.release(getInternalParameterValue("releaseTime"));
        mPan.pos(getInternalParameterValue("pan"));

        mAmpEnv.reset();
        mAMEnv.reset();
    }

    void onTriggerOff() override {
        mAmpEnv.triggerRelease();
        mAMEnv.triggerRelease();
    }
};

class MyApp : public App {
public:
    SynthGUIManager<OscAM> synthManager{"OscAM"};

    // GUI Parameters
    Parameter amplitude{"Amplitude", "", 0.3f, 0.0f, 1.0f};
    Parameter amRatio{"AM Ratio", "", 0.5f, 0.1f, 4.0f};
    Parameter amDepth{"AM Depth", "", 0.5f, 0.0f, 1.0f};
    Parameter attackTime{"Attack", "", 0.1f, 0.01f, 3.0f};
    Parameter releaseTime{"Release", "", 0.5f, 0.1f, 10.0f};
    ControlGUI gui;

    void onCreate() override {
        gam::sampleRate(44100);
        nav().pos(0, 0, 8);

        // Register parameters with GUI
        gui << amplitude << amRatio << amDepth << attackTime << releaseTime;
        gui.init();

        std::cout << "[AM Synthesis]" << std::endl;
        std::cout << "Use GUI sliders to adjust parameters" << std::endl;
        std::cout << "Play with keyboard: ZXCVBNM, QWERTY" << std::endl;
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);
    }

    void onAnimate(double dt) override {
        gui.draw();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02, 0.05, 0.1);
        g.lighting(true);
        g.depthTesting(true);
        synthManager.render(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.voice()->setInternalParameterValue(
                "frequency", ::pow(2.f, (midiNote - 69.f) / 12.f) * 440.f);
            synthManager.voice()->setInternalParameterValue("amplitude", amplitude.get());
            synthManager.voice()->setInternalParameterValue("amRatio", amRatio.get());
            synthManager.voice()->setInternalParameterValue("amDepth", amDepth.get());
            synthManager.voice()->setInternalParameterValue("attackTime", attackTime.get());
            synthManager.voice()->setInternalParameterValue("releaseTime", releaseTime.get());
            synthManager.triggerOn(midiNote);
        }
        return true;
    }

    bool onKeyUp(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.triggerOff(midiNote);
        }
        return true;
    }
};

ALLOLIB_MAIN(MyApp)
`,
  },

  {
    id: 'pg-vibrato',
    title: 'Vibrato Effect',
    description: 'Vibrato using LFO frequency modulation',
    category: 'playground-synthesis',
    subcategory: 'modulation',
    code: `/**
 * Playground Tutorial: Vibrato
 *
 * Vibrato is a subtle frequency modulation at sub-audio rates (1-10 Hz).
 * Creates an expressive, vocal-like quality.
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"

#include "Gamma/Analysis.h"
#include "Gamma/Effects.h"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"

using namespace al;

// Wavetables
gam::ArrayPow2<float> tbSaw(2048), tbSin(2048);

class Vib : public SynthVoice {
public:
    gam::Pan<> mPan;
    gam::Osc<> mOsc;
    gam::Sine<> mVib;
    gam::ADSR<> mAmpEnv;
    gam::ADSR<> mVibEnv;
    gam::EnvFollow<> mEnvFollow;
    float vibValue = 0;
    Mesh mMesh;

    void init() override {
        mAmpEnv.curve(0);
        mAmpEnv.levels(0, 1, 1, 0);
        mAmpEnv.sustainPoint(2);
        mVibEnv.curve(0);
        mVibEnv.levels(0, 1, 1, 0);
        mVibEnv.sustainPoint(2);

        addSphere(mMesh, 0.3, 20, 20);
        mMesh.generateNormals();

        createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 220, 20, 5000);
        createInternalTriggerParameter("attackTime", 0.2, 0.01, 3.0);
        createInternalTriggerParameter("releaseTime", 1.0, 0.1, 10.0);
        createInternalTriggerParameter("vibRate", 5.0, 0.2, 20);
        createInternalTriggerParameter("vibDepth", 0.01, 0.0, 0.1);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    void onProcess(AudioIOData& io) override {
        float oscFreq = getInternalParameterValue("frequency");
        float amp = getInternalParameterValue("amplitude");
        float vibDepth = getInternalParameterValue("vibDepth");
        float vibRate = getInternalParameterValue("vibRate");

        mVib.freq(vibRate);

        while (io()) {
            vibValue = mVib() * mVibEnv();
            mOsc.freq(oscFreq + vibValue * vibDepth * oscFreq);

            float s1 = mOsc() * mAmpEnv() * amp;
            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }
        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001)) free();
    }

    void onProcess(Graphics& g) override {
        float frequency = getInternalParameterValue("frequency");
        float amplitude = getInternalParameterValue("amplitude");
        g.pushMatrix();
        g.translate(frequency / 400 - 1 + vibValue * 2, amplitude - 0.3, -5);
        float scaling = 0.5 + mEnvFollow.value() * 2;
        g.scale(scaling);
        g.color(HSV(0.6 + vibValue * 0.1, 0.7, mEnvFollow.value() * 3 + 0.4));
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override {
        mAmpEnv.attack(getInternalParameterValue("attackTime"));
        mAmpEnv.release(getInternalParameterValue("releaseTime"));
        mVibEnv.levels(0, 1, 1, 0);
        mVibEnv.attack(0.3);  // Vibrato fades in
        mVibEnv.release(0.3);
        mPan.pos(getInternalParameterValue("pan"));

        mOsc.source(tbSaw);
        mAmpEnv.reset();
        mVibEnv.reset();
    }

    void onTriggerOff() override {
        mAmpEnv.triggerRelease();
        mVibEnv.triggerRelease();
    }
};

class MyApp : public App {
public:
    SynthGUIManager<Vib> synthManager{"Vib"};

    // GUI Parameters
    Parameter amplitude{"Amplitude", "", 0.3f, 0.0f, 1.0f};
    Parameter vibRate{"Vib Rate", "", 5.0f, 0.2f, 20.0f};
    Parameter vibDepth{"Vib Depth", "", 0.01f, 0.0f, 0.1f};
    Parameter attackTime{"Attack", "", 0.2f, 0.01f, 3.0f};
    Parameter releaseTime{"Release", "", 1.0f, 0.1f, 10.0f};
    ControlGUI gui;

    void onCreate() override {
        gam::sampleRate(44100);
        gam::addSinesPow<1>(tbSaw, 9, 1);
        gam::addSine(tbSin);

        // Register parameters with GUI
        gui << amplitude << vibRate << vibDepth << attackTime << releaseTime;
        gui.init();

        nav().pos(0, 0, 8);
        std::cout << "[Vibrato Synth]" << std::endl;
        std::cout << "Use GUI sliders to adjust parameters" << std::endl;
        std::cout << "Play with keyboard: ZXCVBNM, QWERTY" << std::endl;
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);
    }

    void onAnimate(double dt) override {
        gui.draw();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05, 0.02, 0.08);
        g.lighting(true);
        g.depthTesting(true);
        synthManager.render(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.voice()->setInternalParameterValue(
                "frequency", ::pow(2.f, (midiNote - 69.f) / 12.f) * 440.f);
            synthManager.voice()->setInternalParameterValue("amplitude", amplitude.get());
            synthManager.voice()->setInternalParameterValue("vibRate", vibRate.get());
            synthManager.voice()->setInternalParameterValue("vibDepth", vibDepth.get());
            synthManager.voice()->setInternalParameterValue("attackTime", attackTime.get());
            synthManager.voice()->setInternalParameterValue("releaseTime", releaseTime.get());
            synthManager.triggerOn(midiNote);
        }
        return true;
    }

    bool onKeyUp(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.triggerOff(midiNote);
        }
        return true;
    }
};

ALLOLIB_MAIN(MyApp)
`,
  },

  // ==========================================================================
  // PLAYGROUND - SYNTHESIS - Filters
  // ==========================================================================
  {
    id: 'pg-subtractive',
    title: 'Subtractive Synthesis',
    description: 'Resonant filter with harmonic-rich oscillator',
    category: 'playground-synthesis',
    subcategory: 'filters',
    code: `/**
 * Playground Tutorial: Subtractive Synthesis
 *
 * Classic subtractive synthesis: a harmonically rich oscillator
 * (DSF - Discrete Summation Formula) filtered by a resonant filter.
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"

#include "Gamma/Analysis.h"
#include "Gamma/Effects.h"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"
#include "Gamma/Filter.h"

using namespace al;

class Sub : public SynthVoice {
public:
    gam::Pan<> mPan;
    gam::ADSR<> mAmpEnv;
    gam::EnvFollow<> mEnvFollow;
    gam::DSF<> mOsc;
    gam::NoiseWhite<> mNoise;
    gam::Reson<> mRes;
    gam::Env<2> mCFEnv;
    Mesh mMesh;

    void init() override {
        mAmpEnv.curve(0);
        mAmpEnv.levels(0, 1.0, 1.0, 0);
        mAmpEnv.sustainPoint(2);
        mCFEnv.curve(0);
        mOsc.harmonics(12);

        addCube(mMesh, 0.5);
        mMesh.generateNormals();

        createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 110, 20, 1000);
        createInternalTriggerParameter("attackTime", 0.1, 0.01, 3.0);
        createInternalTriggerParameter("releaseTime", 1.0, 0.1, 10.0);
        createInternalTriggerParameter("noise", 0.0, 0.0, 1.0);
        createInternalTriggerParameter("cutoff", 1000.0, 100.0, 5000);
        createInternalTriggerParameter("resonance", 500.0, 10.0, 2000);
        createInternalTriggerParameter("harmonics", 12.0, 1.0, 20.0);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    void onProcess(AudioIOData& io) override {
        float amp = getInternalParameterValue("amplitude");
        float noiseMix = getInternalParameterValue("noise");
        float cutoff = getInternalParameterValue("cutoff");
        float resonance = getInternalParameterValue("resonance");

        while (io()) {
            // Mix oscillator with noise
            float s1 = mOsc() * (1 - noiseMix) + mNoise() * noiseMix;

            // Apply resonant filter with envelope
            mRes.set(cutoff * mCFEnv(), resonance);
            s1 = mRes(s1);

            // Apply amplitude envelope
            s1 *= mAmpEnv() * amp;

            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }

        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001f)) free();
    }

    void onProcess(Graphics& g) override {
        float frequency = getInternalParameterValue("frequency");
        float cutoff = getInternalParameterValue("cutoff");
        g.pushMatrix();
        g.translate(frequency / 200 - 1, cutoff / 2000 - 1, -6);
        g.rotate(frequency * 0.5, 1, 1, 0);
        g.scale(mEnvFollow.value() * 2 + 0.2);
        g.color(HSV(cutoff / 5000, 0.8, mEnvFollow.value() * 3 + 0.3));
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override {
        mOsc.freq(getInternalParameterValue("frequency"));
        mOsc.harmonics(getInternalParameterValue("harmonics"));
        mAmpEnv.attack(getInternalParameterValue("attackTime"));
        mAmpEnv.release(getInternalParameterValue("releaseTime"));
        mCFEnv.levels(1.5, 1, 0.5);  // Filter sweep down
        mCFEnv.lengths()[0] = 0.3;
        mCFEnv.lengths()[1] = 0.5;
        mPan.pos(getInternalParameterValue("pan"));

        mAmpEnv.reset();
        mCFEnv.reset();
    }

    void onTriggerOff() override {
        mAmpEnv.triggerRelease();
    }
};

class MyApp : public App {
public:
    SynthGUIManager<Sub> synthManager{"Sub"};

    // GUI Parameters
    Parameter amplitude{"Amplitude", "", 0.3f, 0.0f, 1.0f};
    Parameter attackTime{"Attack", "", 0.1f, 0.01f, 3.0f};
    Parameter releaseTime{"Release", "", 1.0f, 0.1f, 10.0f};
    Parameter cutoff{"Cutoff", "", 1000.0f, 100.0f, 5000.0f};
    Parameter resonance{"Resonance", "", 500.0f, 10.0f, 2000.0f};
    ParameterInt harmonics{"Harmonics", "", 12, 1, 20};
    ControlGUI gui;

    void onCreate() override {
        gam::sampleRate(44100);
        nav().pos(0, 0, 8);

        // Register parameters with GUI
        gui << amplitude << attackTime << releaseTime << cutoff << resonance << harmonics;
        gui.init();

        std::cout << "[Subtractive Synthesis]" << std::endl;
        std::cout << "Up/Down: Cutoff, Left/Right: Resonance" << std::endl;
        std::cout << "1-9: Number of harmonics" << std::endl;
        std::cout << "Play with keyboard: ZXCVBNM, QWERTY" << std::endl;
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);
    }

    void onAnimate(double dt) override {
        gui.draw();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02, 0.02, 0.05);
        g.lighting(true);
        g.depthTesting(true);
        synthManager.render(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        if (k.key() == Keyboard::UP) {
            cutoff.set(std::min(5000.0f, cutoff.get() + 100.0f));
            std::cout << "Cutoff: " << cutoff.get() << std::endl;
            return true;
        }
        if (k.key() == Keyboard::DOWN) {
            cutoff.set(std::max(100.0f, cutoff.get() - 100.0f));
            std::cout << "Cutoff: " << cutoff.get() << std::endl;
            return true;
        }
        if (k.key() == Keyboard::RIGHT) {
            resonance.set(std::min(2000.0f, resonance.get() + 50.0f));
            std::cout << "Resonance: " << resonance.get() << std::endl;
            return true;
        }
        if (k.key() == Keyboard::LEFT) {
            resonance.set(std::max(10.0f, resonance.get() - 50.0f));
            std::cout << "Resonance: " << resonance.get() << std::endl;
            return true;
        }

        // Number keys set harmonics
        if (k.key() >= '1' && k.key() <= '9') {
            harmonics.set((k.key() - '0') * 2);
            std::cout << "Harmonics: " << harmonics.get() << std::endl;
            return true;
        }

        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.voice()->setInternalParameterValue(
                "frequency", ::pow(2.f, (midiNote - 69.f) / 12.f) * 440.f);
            synthManager.voice()->setInternalParameterValue("amplitude", amplitude.get());
            synthManager.voice()->setInternalParameterValue("attackTime", attackTime.get());
            synthManager.voice()->setInternalParameterValue("releaseTime", releaseTime.get());
            synthManager.voice()->setInternalParameterValue("cutoff", cutoff.get());
            synthManager.voice()->setInternalParameterValue("resonance", resonance.get());
            synthManager.voice()->setInternalParameterValue("harmonics", harmonics.get());
            synthManager.triggerOn(midiNote);
        }
        return true;
    }

    bool onKeyUp(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.triggerOff(midiNote);
        }
        return true;
    }
};

ALLOLIB_MAIN(MyApp)
`,
  },

  {
    id: 'pg-additive',
    title: 'Additive Synthesis',
    description: 'Building complex timbres from sine wave partials',
    category: 'playground-synthesis',
    subcategory: 'oscillators',
    code: `/**
 * Playground Tutorial: Additive Synthesis
 *
 * Creates complex timbres by combining multiple sine wave partials.
 * Each partial has its own frequency ratio, amplitude, and envelope.
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"

#include "Gamma/Analysis.h"
#include "Gamma/Effects.h"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"

using namespace al;

class AddSyn : public SynthVoice {
public:
    static const int NUM_PARTIALS = 10;
    gam::Sine<> mOsc[NUM_PARTIALS];
    gam::ADSR<> mEnv[NUM_PARTIALS];
    gam::Pan<> mPan;
    gam::EnvFollow<> mEnvFollow;
    float partialAmps[NUM_PARTIALS];
    Mesh mMesh;

    void init() override {
        // Initialize partial amplitudes (harmonic series falloff)
        for (int i = 0; i < NUM_PARTIALS; i++) {
            partialAmps[i] = 1.0f / (i + 1);
            mEnv[i].curve(-4);
            mEnv[i].levels(0, 1, 1, 0);
            mEnv[i].sustainPoint(2);
        }

        addSphere(mMesh, 0.15, 16, 16);
        mMesh.generateNormals();

        createInternalTriggerParameter("amplitude", 0.2, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 110, 20, 2000);
        createInternalTriggerParameter("attackTime", 0.1, 0.01, 3.0);
        createInternalTriggerParameter("releaseTime", 1.5, 0.1, 10.0);
        createInternalTriggerParameter("partials", 10, 1, 10);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    void onProcess(AudioIOData& io) override {
        float freq = getInternalParameterValue("frequency");
        float amp = getInternalParameterValue("amplitude");
        int numPartials = (int)getInternalParameterValue("partials");

        // Set partial frequencies
        for (int i = 0; i < numPartials; i++) {
            mOsc[i].freq(freq * (i + 1));  // Harmonic series
        }

        while (io()) {
            float s1 = 0;
            for (int i = 0; i < numPartials; i++) {
                s1 += mOsc[i]() * mEnv[i]() * partialAmps[i];
            }
            s1 *= amp;

            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }

        // Check if all envelopes are done
        bool allDone = true;
        for (int i = 0; i < NUM_PARTIALS; i++) {
            if (!mEnv[i].done()) allDone = false;
        }
        if (allDone && (mEnvFollow.value() < 0.001f)) free();
    }

    void onProcess(Graphics& g) override {
        float freq = getInternalParameterValue("frequency");
        int numPartials = (int)getInternalParameterValue("partials");

        for (int i = 0; i < numPartials; i++) {
            g.pushMatrix();
            float x = (i - numPartials / 2.0f) * 0.5f;
            float y = partialAmps[i] * mEnv[i].value() * 2 - 1;
            g.translate(x, y, -6);
            g.scale(0.3 + mEnv[i].value() * 0.5);
            g.color(HSV(i / 10.0f, 0.8, mEnv[i].value() + 0.3));
            g.draw(mMesh);
            g.popMatrix();
        }
    }

    void onTriggerOn() override {
        int numPartials = (int)getInternalParameterValue("partials");
        float attack = getInternalParameterValue("attackTime");
        float release = getInternalParameterValue("releaseTime");
        mPan.pos(getInternalParameterValue("pan"));

        for (int i = 0; i < numPartials; i++) {
            // Higher partials decay faster
            mEnv[i].attack(attack * (1 + i * 0.1f));
            mEnv[i].release(release * (1.0f - i * 0.05f));
            mEnv[i].reset();
        }
    }

    void onTriggerOff() override {
        for (int i = 0; i < NUM_PARTIALS; i++) {
            mEnv[i].triggerRelease();
        }
    }
};

class MyApp : public App {
public:
    SynthGUIManager<AddSyn> synthManager{"AddSyn"};

    // GUI Parameters
    Parameter amplitude{"Amplitude", "", 0.2f, 0.0f, 1.0f};
    Parameter attackTime{"Attack", "", 0.1f, 0.01f, 3.0f};
    Parameter releaseTime{"Release", "", 1.5f, 0.1f, 10.0f};
    ParameterInt partials{"Partials", "", 10, 1, 10};
    ControlGUI gui;

    void onCreate() override {
        gam::sampleRate(44100);
        nav().pos(0, 0, 8);

        // Register parameters with GUI
        gui << amplitude << attackTime << releaseTime << partials;
        gui.init();

        std::cout << "[Additive Synthesis]" << std::endl;
        std::cout << "Up/Down: Number of partials (1-10)" << std::endl;
        std::cout << "Play with keyboard: ZXCVBNM, QWERTY" << std::endl;
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);
    }

    void onAnimate(double dt) override {
        gui.draw();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02, 0.04, 0.08);
        g.lighting(true);
        g.depthTesting(true);
        synthManager.render(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        if (k.key() == Keyboard::UP) {
            partials.set(std::min(10, partials.get() + 1));
            std::cout << "Partials: " << partials.get() << std::endl;
            return true;
        }
        if (k.key() == Keyboard::DOWN) {
            partials.set(std::max(1, partials.get() - 1));
            std::cout << "Partials: " << partials.get() << std::endl;
            return true;
        }

        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.voice()->setInternalParameterValue(
                "frequency", ::pow(2.f, (midiNote - 69.f) / 12.f) * 440.f);
            synthManager.voice()->setInternalParameterValue("amplitude", amplitude.get());
            synthManager.voice()->setInternalParameterValue("attackTime", attackTime.get());
            synthManager.voice()->setInternalParameterValue("releaseTime", releaseTime.get());
            synthManager.voice()->setInternalParameterValue("partials", partials.get());
            synthManager.triggerOn(midiNote);
        }
        return true;
    }

    bool onKeyUp(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.triggerOff(midiNote);
        }
        return true;
    }
};

ALLOLIB_MAIN(MyApp)
`,
  },

  // ==========================================================================
  // PLAYGROUND - AUDIOVISUAL
  // ==========================================================================
  {
    id: 'pg-audiovisual-basic',
    title: 'AudioVisual Spheres',
    description: 'Animated spheres react to audio envelope with 3D movement',
    category: 'playground-audiovisual',
    subcategory: 'basic-av',
    code: `/**
 * Playground Tutorial: AudioVisual Spheres
 *
 * Each note creates a sphere that moves through 3D space.
 * The sphere's size and color react to the audio envelope.
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/math/al_Random.hpp"

#include "Gamma/Analysis.h"
#include "Gamma/Effects.h"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"

using namespace al;

class SineEnv : public SynthVoice {
public:
    gam::Pan<> mPan;
    gam::Sine<> mOsc;
    gam::Env<3> mAmpEnv;
    gam::EnvFollow<> mEnvFollow;
    Mesh mMesh;

    double rotation = 0;
    double rotSpeed;
    float timepose = 0;
    Vec3f note_position;
    Vec3f note_direction;

    void init() override {
        mAmpEnv.curve(0);
        mAmpEnv.levels(0, 1, 1, 0);
        mAmpEnv.sustainPoint(2);

        addSphere(mMesh, 0.3, 30, 30);
        mMesh.decompress();
        mMesh.generateNormals();

        rotSpeed = al::rnd::uniformS() * 2;

        createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 60, 20, 5000);
        createInternalTriggerParameter("attackTime", 0.1, 0.01, 3.0);
        createInternalTriggerParameter("releaseTime", 2.0, 0.1, 10.0);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    void onProcess(AudioIOData& io) override {
        mOsc.freq(getInternalParameterValue("frequency"));
        mAmpEnv.lengths()[0] = getInternalParameterValue("attackTime");
        mAmpEnv.lengths()[2] = getInternalParameterValue("releaseTime");
        mPan.pos(getInternalParameterValue("pan"));

        while (io()) {
            float s1 = mOsc() * mAmpEnv() * getInternalParameterValue("amplitude");
            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }
        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001f)) free();
    }

    void onProcess(Graphics& g) override {
        float frequency = getInternalParameterValue("frequency");
        float amplitude = getInternalParameterValue("amplitude");
        rotation += rotSpeed;
        timepose += 0.02;

        g.pushMatrix();
        g.depthTesting(true);
        g.lighting(true);
        g.translate(note_position + note_direction * timepose);
        g.rotate(rotation, Vec3f(0, 1, 0));
        g.rotate(rotation * 0.7, Vec3f(1, 0, 0));
        g.scale(0.3 + mAmpEnv() * 0.3, 0.3 + mAmpEnv() * 0.5, amplitude);
        g.color(HSV(frequency / 1000, 0.5 + mAmpEnv() * 0.3, 0.3 + 0.6 * mAmpEnv()));
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override {
        float angle = getInternalParameterValue("frequency") / 200;
        mAmpEnv.reset();
        rotation = al::rnd::uniform() * 360;
        timepose = 0;
        note_position = Vec3f(0, 0, -8);
        note_direction = Vec3f(sin(angle), cos(angle) * 0.3, 0.1);
    }

    void onTriggerOff() override { mAmpEnv.release(); }
};

class MyApp : public App {
public:
    SynthGUIManager<SineEnv> synthManager{"SineEnv"};

    // GUI Parameters
    Parameter amplitude{"Amplitude", "", 0.3f, 0.0f, 1.0f};
    Parameter attackTime{"Attack", "", 0.1f, 0.01f, 3.0f};
    Parameter releaseTime{"Release", "", 2.0f, 0.1f, 10.0f};
    ControlGUI gui;

    void onCreate() override {
        gam::sampleRate(44100);
        nav().pos(0, 0, 0);

        // Register parameters with GUI
        gui << amplitude << attackTime << releaseTime;
        gui.init();

        std::cout << "[AudioVisual Spheres]" << std::endl;
        std::cout << "Spheres fly outward based on pitch!" << std::endl;
        std::cout << "Play with keyboard: ZXCVBNM, QWERTY" << std::endl;
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);
    }

    void onAnimate(double dt) override {
        gui.draw();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05, 0.05, 0.1);
        synthManager.render(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.voice()->setInternalParameterValue(
                "frequency", ::pow(2.f, (midiNote - 69.f) / 12.f) * 440.f);
            synthManager.voice()->setInternalParameterValue("amplitude", amplitude.get());
            synthManager.voice()->setInternalParameterValue("attackTime", attackTime.get());
            synthManager.voice()->setInternalParameterValue("releaseTime", releaseTime.get());
            synthManager.triggerOn(midiNote);
        }
        return true;
    }

    bool onKeyUp(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.triggerOff(midiNote);
        }
        return true;
    }
};

ALLOLIB_MAIN(MyApp)
`,
  },

  {
    id: 'pg-audiovisual-color',
    title: 'Color Space Synth',
    description: 'HSV color mapping to frequency and amplitude',
    category: 'playground-audiovisual',
    subcategory: 'basic-av',
    code: `/**
 * Playground Tutorial: Color Space Synth
 *
 * Maps audio parameters to HSV color space:
 * - Hue: Frequency (pitch)
 * - Saturation: Envelope level
 * - Value: Amplitude
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"

#include "Gamma/Analysis.h"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"

using namespace al;

class ColorVoice : public SynthVoice {
public:
    gam::Sine<> mOsc;
    gam::ADSR<> mAmpEnv;
    gam::EnvFollow<> mEnvFollow;
    float mPanPos = 0;
    Mesh mMesh;
    float hue = 0;

    void init() override {
        mAmpEnv.levels(0, 1, 0.8, 0);
        mAmpEnv.sustainPoint(2);
        mAmpEnv.curve(-2);

        // Icosphere for interesting lighting
        addIcosphere(mMesh, 1.0, 3);
        mMesh.generateNormals();

        createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 220, 20, 2000);
        createInternalTriggerParameter("attackTime", 0.05, 0.01, 1.0);
        createInternalTriggerParameter("releaseTime", 0.8, 0.1, 5.0);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    void onProcess(AudioIOData& io) override {
        mOsc.freq(getInternalParameterValue("frequency"));
        mPanPos = getInternalParameterValue("pan");

        while (io()) {
            float s1 = mOsc() * mAmpEnv() * getInternalParameterValue("amplitude");
            mEnvFollow(s1);
            // Manual stereo panning: pan from -1 (left) to 1 (right)
            float leftGain = (1.0f - mPanPos) * 0.5f;
            float rightGain = (1.0f + mPanPos) * 0.5f;
            io.out(0) += s1 * leftGain;
            io.out(1) += s1 * rightGain;
        }
        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001f)) free();
    }

    void onProcess(Graphics& g) override {
        float frequency = getInternalParameterValue("frequency");
        float amplitude = getInternalParameterValue("amplitude");
        float envValue = mAmpEnv.value();

        // Map frequency to hue (rainbow across keyboard range)
        float h = (frequency - 100) / 1000.0f;
        float s = 0.3 + envValue * 0.7;  // Saturation from envelope
        float v = 0.2 + amplitude * 0.8;  // Value from amplitude

        g.pushMatrix();
        g.translate(0, 0, -6);
        float scale = 0.5 + envValue * 1.5;
        g.scale(scale);
        g.color(HSV(h, s, v));
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override {
        mAmpEnv.attack(getInternalParameterValue("attackTime"));
        mAmpEnv.release(getInternalParameterValue("releaseTime"));
        mAmpEnv.reset();
        hue = getInternalParameterValue("frequency") / 1000.0f;
    }

    void onTriggerOff() override { mAmpEnv.triggerRelease(); }
};

class MyApp : public App {
public:
    SynthGUIManager<ColorVoice> synthManager{"ColorVoice"};
    Mesh bgMesh;

    // GUI Parameters
    Parameter amplitude{"Amplitude", "", 0.3f, 0.0f, 1.0f};
    Parameter attackTime{"Attack", "", 0.05f, 0.01f, 1.0f};
    Parameter releaseTime{"Release", "", 0.8f, 0.1f, 5.0f};
    ControlGUI gui;

    void onCreate() override {
        gam::sampleRate(44100);
        nav().pos(0, 0, 0);

        // Background quad
        bgMesh.primitive(Mesh::TRIANGLES);
        bgMesh.vertex(-10, -10, -15); bgMesh.color(0.02, 0.02, 0.05);
        bgMesh.vertex( 10, -10, -15); bgMesh.color(0.02, 0.02, 0.05);
        bgMesh.vertex( 10,  10, -15); bgMesh.color(0.05, 0.02, 0.08);
        bgMesh.vertex(-10, -10, -15); bgMesh.color(0.02, 0.02, 0.05);
        bgMesh.vertex( 10,  10, -15); bgMesh.color(0.05, 0.02, 0.08);
        bgMesh.vertex(-10,  10, -15); bgMesh.color(0.05, 0.02, 0.08);

        // Register parameters with GUI
        gui << amplitude << attackTime << releaseTime;
        gui.init();

        std::cout << "[Color Space Synth]" << std::endl;
        std::cout << "Colors change with pitch (low=red, high=blue)" << std::endl;
        std::cout << "Play with keyboard: ZXCVBNM, QWERTY" << std::endl;
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);
    }

    void onAnimate(double dt) override {
        gui.draw();
    }

    void onDraw(Graphics& g) override {
        g.clear(0);
        g.meshColor();
        g.draw(bgMesh);

        g.lighting(true);
        g.depthTesting(true);
        synthManager.render(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.voice()->setInternalParameterValue(
                "frequency", ::pow(2.f, (midiNote - 69.f) / 12.f) * 440.f);
            synthManager.voice()->setInternalParameterValue("amplitude", amplitude.get());
            synthManager.voice()->setInternalParameterValue("attackTime", attackTime.get());
            synthManager.voice()->setInternalParameterValue("releaseTime", releaseTime.get());
            synthManager.triggerOn(midiNote);
        }
        return true;
    }

    bool onKeyUp(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.triggerOff(midiNote);
        }
        return true;
    }
};

ALLOLIB_MAIN(MyApp)
`,
  },

  // ==========================================================================
  // PLAYGROUND - AUDIOVISUAL - Advanced
  // ==========================================================================
  {
    id: 'pg-plucked-string',
    title: 'Plucked String',
    description: 'Karplus-Strong synthesis - physical modeling of plucked strings',
    category: 'playground-audiovisual',
    subcategory: 'advanced-av',
    code: `/**
 * Playground Tutorial: Plucked String Synthesis
 *
 * Karplus-Strong physical modeling synthesis.
 * Uses a delay line with filtered feedback to simulate plucked strings.
 * Based on 09_pluck_visual from allolib_playground.
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"

#include "Gamma/Analysis.h"
#include "Gamma/Effects.h"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"
#include "Gamma/Filter.h"

using namespace al;

class PluckedString : public SynthVoice {
public:
    float mAmp;
    gam::Pan<> mPan;
    gam::NoiseWhite<> noise;
    gam::Decay<> env;
    gam::MovingAvg<> fil{2};
    gam::Delay<float, gam::ipl::Trunc> delay;
    gam::ADSR<> mAmpEnv;
    gam::EnvFollow<> mEnvFollow;
    Mesh mMesh;
    double rotation = 0;

    void init() override {
        mAmpEnv.levels(0, 1, 1, 0);
        mAmpEnv.sustainPoint(2);
        env.decay(0.1);
        delay.maxDelay(1.0 / 27.5);
        delay.delay(1.0 / 440.0);

        addDisc(mMesh, 1.0, 30);
        mMesh.generateNormals();

        createInternalTriggerParameter("amplitude", 0.5, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 220, 20, 2000);
        createInternalTriggerParameter("attackTime", 0.001, 0.001, 0.1);
        createInternalTriggerParameter("releaseTime", 3.0, 0.1, 10.0);
        createInternalTriggerParameter("sustain", 0.7, 0.0, 1.0);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    float pluck() {
        return delay(fil(delay() + noise() * env()));
    }

    void onProcess(AudioIOData& io) override {
        while (io()) {
            float s1 = pluck() * mAmpEnv() * mAmp;
            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }
        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001f)) free();
    }

    void onProcess(Graphics& g) override {
        float frequency = getInternalParameterValue("frequency");
        rotation += 0.5;

        g.pushMatrix();
        g.depthTesting(true);
        g.lighting(true);
        g.translate(frequency / 300 - 2, mEnvFollow.value() * 2 - 0.5, -6);
        g.rotate(rotation, Vec3f(0, 1, 0));
        g.scale(0.3 + mEnvFollow.value(), 0.3 + mEnvFollow.value() * 0.5, 0.1);
        g.color(HSV(frequency / 1000, 0.6, 0.3 + mEnvFollow.value() * 0.7));
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override {
        mAmpEnv.attack(getInternalParameterValue("attackTime"));
        mAmpEnv.release(getInternalParameterValue("releaseTime"));
        mAmpEnv.sustain(getInternalParameterValue("sustain"));
        delay.freq(getInternalParameterValue("frequency"));
        mAmp = getInternalParameterValue("amplitude");
        mPan.pos(getInternalParameterValue("pan"));

        mAmpEnv.reset();
        env.reset();
        delay.zero();
    }

    void onTriggerOff() override {
        mAmpEnv.triggerRelease();
    }
};

class MyApp : public App {
public:
    SynthGUIManager<PluckedString> synthManager{"PluckedString"};

    // GUI Parameters
    Parameter amplitude{"Amplitude", "", 0.5f, 0.0f, 1.0f};
    Parameter attackTime{"Attack", "", 0.001f, 0.001f, 0.1f};
    Parameter releaseTime{"Release", "", 3.0f, 0.1f, 10.0f};
    Parameter sustain{"Sustain", "", 0.7f, 0.0f, 1.0f};
    ControlGUI gui;

    void onCreate() override {
        gam::sampleRate(44100);
        nav().pos(0, 0, 8);

        // Register parameters with GUI
        gui << amplitude << attackTime << releaseTime << sustain;
        gui.init();

        std::cout << "[Plucked String Synthesis]" << std::endl;
        std::cout << "Karplus-Strong physical modeling" << std::endl;
        std::cout << "Play with keyboard: ZXCVBNM, QWERTY" << std::endl;
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);
    }

    void onAnimate(double dt) override {
        gui.draw();
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02, 0.02, 0.08);
        g.lighting(true);
        g.depthTesting(true);
        synthManager.render(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.voice()->setInternalParameterValue(
                "frequency", ::pow(2.f, (midiNote - 69.f) / 12.f) * 440.f);
            synthManager.voice()->setInternalParameterValue("amplitude", amplitude.get());
            synthManager.voice()->setInternalParameterValue("attackTime", attackTime.get());
            synthManager.voice()->setInternalParameterValue("releaseTime", releaseTime.get());
            synthManager.voice()->setInternalParameterValue("sustain", sustain.get());
            synthManager.triggerOn(midiNote);
        }
        return true;
    }

    bool onKeyUp(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.triggerOff(midiNote);
        }
        return true;
    }
};

ALLOLIB_MAIN(MyApp)
`,
  },

  {
    id: 'pg-synthesis-showcase',
    title: 'Synthesis Showcase',
    description: 'Demonstrates all synthesis techniques in one example',
    category: 'playground-audiovisual',
    subcategory: 'advanced-av',
    code: `/**
 * Playground Tutorial: Synthesis Showcase
 *
 * A comprehensive example demonstrating multiple synthesis techniques:
 * - Press 1: Sine Envelope (basic additive)
 * - Press 2: FM Synthesis
 * - Press 3: Subtractive (filtered oscillator)
 * - Press 4: Plucked String (physical modeling)
 *
 * Based on 10_integrated from allolib_playground.
 */

#include "al_playground_compat.hpp"
#include "al/graphics/al_Shapes.hpp"

#include "Gamma/Analysis.h"
#include "Gamma/Effects.h"
#include "Gamma/Envelope.h"
#include "Gamma/Oscillator.h"
#include "Gamma/Filter.h"

using namespace al;

// ============================================================================
// Synthesis Voice 1: Sine with Envelope
// ============================================================================
class SineEnv : public SynthVoice {
public:
    gam::Pan<> mPan;
    gam::Sine<> mOsc;
    gam::Env<3> mAmpEnv;
    gam::EnvFollow<> mEnvFollow;
    Mesh mMesh;

    void init() override {
        mAmpEnv.curve(0);
        mAmpEnv.levels(0, 1, 1, 0);
        mAmpEnv.sustainPoint(2);

        addSphere(mMesh, 0.3, 30, 30);
        mMesh.generateNormals();

        createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 60, 20, 5000);
        createInternalTriggerParameter("attackTime", 0.1, 0.01, 3.0);
        createInternalTriggerParameter("releaseTime", 1.5, 0.1, 10.0);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    void onProcess(AudioIOData& io) override {
        mOsc.freq(getInternalParameterValue("frequency"));
        mAmpEnv.lengths()[0] = getInternalParameterValue("attackTime");
        mAmpEnv.lengths()[2] = getInternalParameterValue("releaseTime");
        mPan.pos(getInternalParameterValue("pan"));

        while (io()) {
            float s1 = mOsc() * mAmpEnv() * getInternalParameterValue("amplitude");
            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }
        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001f)) free();
    }

    void onProcess(Graphics& g) override {
        float frequency = getInternalParameterValue("frequency");
        g.pushMatrix();
        g.translate(frequency / 500 - 2, 1, -6);
        g.scale(0.3 + mEnvFollow.value() * 0.5);
        g.color(HSV(0.6, 0.7, 0.3 + mEnvFollow.value() * 0.7));
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override { mAmpEnv.reset(); }
    void onTriggerOff() override { mAmpEnv.release(); }
};

// ============================================================================
// Synthesis Voice 2: FM Synthesis
// ============================================================================
class FMVoice : public SynthVoice {
public:
    gam::Pan<> mPan;
    gam::ADSR<> mAmpEnv;
    gam::EnvFollow<> mEnvFollow;
    gam::Sine<> car, mod;
    Mesh mMesh;

    void init() override {
        mAmpEnv.levels(0, 1, 1, 0);
        mAmpEnv.sustainPoint(2);

        addTetrahedron(mMesh);
        mMesh.decompress();
        mMesh.generateNormals();

        createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 262, 20, 5000);
        createInternalTriggerParameter("attackTime", 0.1, 0.01, 3.0);
        createInternalTriggerParameter("releaseTime", 0.5, 0.1, 10.0);
        createInternalTriggerParameter("modIndex", 3.0, 0.0, 10.0);
        createInternalTriggerParameter("modRatio", 2.0, 0.5, 5.0);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    void onProcess(AudioIOData& io) override {
        float freq = getInternalParameterValue("frequency");
        float modRatio = getInternalParameterValue("modRatio");
        float modIndex = getInternalParameterValue("modIndex");
        mod.freq(freq * modRatio);

        while (io()) {
            float modAmount = mod() * modIndex * freq;
            car.freq(freq + modAmount);
            float s1 = car() * mAmpEnv() * getInternalParameterValue("amplitude");
            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }
        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001)) free();
    }

    void onProcess(Graphics& g) override {
        float frequency = getInternalParameterValue("frequency");
        g.pushMatrix();
        g.translate(frequency / 500 - 2, 0, -6);
        g.scale(0.3 + mEnvFollow.value() * 0.5);
        g.color(HSV(0.1, 0.8, 0.3 + mEnvFollow.value() * 0.7));
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override {
        mAmpEnv.attack(getInternalParameterValue("attackTime"));
        mAmpEnv.release(getInternalParameterValue("releaseTime"));
        mPan.pos(getInternalParameterValue("pan"));
        mAmpEnv.reset();
    }

    void onTriggerOff() override { mAmpEnv.triggerRelease(); }
};

// ============================================================================
// Synthesis Voice 3: Subtractive
// ============================================================================
class SubVoice : public SynthVoice {
public:
    gam::Pan<> mPan;
    gam::ADSR<> mAmpEnv;
    gam::EnvFollow<> mEnvFollow;
    gam::DSF<> mOsc;
    gam::Reson<> mRes;
    Mesh mMesh;

    void init() override {
        mAmpEnv.levels(0, 1, 1, 0);
        mAmpEnv.sustainPoint(2);
        mOsc.harmonics(12);

        addCube(mMesh, 0.5);
        mMesh.generateNormals();

        createInternalTriggerParameter("amplitude", 0.3, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 110, 20, 1000);
        createInternalTriggerParameter("attackTime", 0.1, 0.01, 3.0);
        createInternalTriggerParameter("releaseTime", 1.0, 0.1, 10.0);
        createInternalTriggerParameter("cutoff", 1000.0, 100.0, 5000);
        createInternalTriggerParameter("resonance", 500.0, 10.0, 2000);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    void onProcess(AudioIOData& io) override {
        float cutoff = getInternalParameterValue("cutoff");
        float resonance = getInternalParameterValue("resonance");
        mRes.set(cutoff, resonance);

        while (io()) {
            float s1 = mRes(mOsc()) * mAmpEnv() * getInternalParameterValue("amplitude");
            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }
        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001f)) free();
    }

    void onProcess(Graphics& g) override {
        float frequency = getInternalParameterValue("frequency");
        g.pushMatrix();
        g.translate(frequency / 500 - 2, -1, -6);
        g.scale(0.3 + mEnvFollow.value() * 0.5);
        g.color(HSV(0.8, 0.7, 0.3 + mEnvFollow.value() * 0.7));
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override {
        mOsc.freq(getInternalParameterValue("frequency"));
        mAmpEnv.attack(getInternalParameterValue("attackTime"));
        mAmpEnv.release(getInternalParameterValue("releaseTime"));
        mPan.pos(getInternalParameterValue("pan"));
        mAmpEnv.reset();
    }

    void onTriggerOff() override { mAmpEnv.triggerRelease(); }
};

// ============================================================================
// Synthesis Voice 4: Plucked String
// ============================================================================
class PluckVoice : public SynthVoice {
public:
    float mAmp;
    gam::Pan<> mPan;
    gam::NoiseWhite<> noise;
    gam::Decay<> env;
    gam::MovingAvg<> fil{2};
    gam::Delay<float, gam::ipl::Trunc> delay;
    gam::ADSR<> mAmpEnv;
    gam::EnvFollow<> mEnvFollow;
    Mesh mMesh;

    void init() override {
        mAmpEnv.levels(0, 1, 1, 0);
        mAmpEnv.sustainPoint(2);
        env.decay(0.1);
        delay.maxDelay(1.0 / 27.5);
        delay.delay(1.0 / 440.0);

        addDisc(mMesh, 0.5, 30);
        mMesh.generateNormals();

        createInternalTriggerParameter("amplitude", 0.5, 0.0, 1.0);
        createInternalTriggerParameter("frequency", 220, 20, 2000);
        createInternalTriggerParameter("attackTime", 0.001, 0.001, 0.1);
        createInternalTriggerParameter("releaseTime", 3.0, 0.1, 10.0);
        createInternalTriggerParameter("pan", 0.0, -1.0, 1.0);
    }

    float pluck() { return delay(fil(delay() + noise() * env())); }

    void onProcess(AudioIOData& io) override {
        while (io()) {
            float s1 = pluck() * mAmpEnv() * mAmp;
            float s2;
            mEnvFollow(s1);
            mPan(s1, s1, s2);
            io.out(0) += s1;
            io.out(1) += s2;
        }
        if (mAmpEnv.done() && (mEnvFollow.value() < 0.001f)) free();
    }

    void onProcess(Graphics& g) override {
        float frequency = getInternalParameterValue("frequency");
        g.pushMatrix();
        g.translate(frequency / 500 - 2, -2, -6);
        g.scale(0.3 + mEnvFollow.value() * 0.5);
        g.color(HSV(0.3, 0.6, 0.3 + mEnvFollow.value() * 0.7));
        g.draw(mMesh);
        g.popMatrix();
    }

    void onTriggerOn() override {
        mAmpEnv.attack(getInternalParameterValue("attackTime"));
        mAmpEnv.release(getInternalParameterValue("releaseTime"));
        delay.freq(getInternalParameterValue("frequency"));
        mAmp = getInternalParameterValue("amplitude");
        mPan.pos(getInternalParameterValue("pan"));
        mAmpEnv.reset();
        env.reset();
        delay.zero();
    }

    void onTriggerOff() override { mAmpEnv.triggerRelease(); }
};

// ============================================================================
// Main Application
// ============================================================================
class MyApp : public App {
public:
    SynthGUIManager<SineEnv> synthManager{"Showcase"};
    int currentSynth = 0;

    void onCreate() override {
        gam::sampleRate(44100);
        nav().pos(0, 0, 8);

        // Register all synth classes
        synthManager.synth().registerSynthClass<SineEnv>("SineEnv");
        synthManager.synth().registerSynthClass<FMVoice>("FM");
        synthManager.synth().registerSynthClass<SubVoice>("Sub");
        synthManager.synth().registerSynthClass<PluckVoice>("Pluck");

        std::cout << "[Synthesis Showcase]" << std::endl;
        std::cout << "Press 1-4 to switch synthesis type:" << std::endl;
        std::cout << "  1: Sine Envelope (blue sphere)" << std::endl;
        std::cout << "  2: FM Synthesis (orange tetrahedron)" << std::endl;
        std::cout << "  3: Subtractive (purple cube)" << std::endl;
        std::cout << "  4: Plucked String (green disc)" << std::endl;
        std::cout << "Play with keyboard: ZXCVBNM, QWERTY" << std::endl;
    }

    void onSound(AudioIOData& io) override {
        synthManager.render(io);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05, 0.05, 0.1);
        g.lighting(true);
        g.depthTesting(true);
        synthManager.render(g);
    }

    bool onKeyDown(Keyboard const& k) override {
        // Number keys switch synthesis type
        if (k.key() >= '1' && k.key() <= '4') {
            currentSynth = k.key() - '1';
            const char* names[] = {"SineEnv", "FM", "Sub", "Pluck"};
            std::cout << "Switched to: " << names[currentSynth] << std::endl;
            return true;
        }

        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            float freq = ::pow(2.f, (midiNote - 69.f) / 12.f) * 440.f;

            // Create voice based on current synth type
            const char* synthNames[] = {"SineEnv", "FM", "Sub", "Pluck"};
            auto* voice = synthManager.synth().getVoice(synthNames[currentSynth]);
            if (voice) {
                voice->setInternalParameterValue("frequency", freq);
                voice->setInternalParameterValue("amplitude", 0.3f);
                synthManager.synth().triggerOn(voice, 0, midiNote);
            }
        }
        return true;
    }

    bool onKeyUp(Keyboard const& k) override {
        int midiNote = asciiToMIDI(k.key());
        if (midiNote > 0) {
            synthManager.triggerOff(midiNote);
        }
        return true;
    }
};

ALLOLIB_MAIN(MyApp)
`,
  },
]
