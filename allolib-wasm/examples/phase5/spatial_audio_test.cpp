/**
 * Phase 5 Test: Spatial Audio
 * Tests spatial audio features:
 * - StereoPanner for stereo positioning
 * - Distance-based attenuation
 * - Multiple positioned sound sources
 * - Listener pose updates
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/sound/al_StereoPanner.hpp"
#include "al/scene/al_DynamicScene.hpp"
#include "al/scene/al_PositionedVoice.hpp"
#include "Gamma/Oscillator.h"
#include "Gamma/Envelope.h"
#include <cmath>

using namespace al;
using namespace gam;

// A positioned sound source
class SpatialVoice : public PositionedVoice {
public:
    Sine<> osc;
    AD<> env;
    float freq = 440.0f;
    Color color;

    void init() override {
        env.attack(0.01f);
        env.decay(2.0f);
    }

    void onTriggerOn() override {
        osc.freq(freq);
        env.reset();
    }

    void onProcess(AudioIOData& io) override {
        while (io()) {
            float s = osc() * env() * 0.3f;
            io.out(0) = s;
            io.out(1) = s;
        }
        if (env.done()) free();
    }

    void onProcess(Graphics& g) override {
        // Draw a sphere at the voice position
        Mesh sphere;
        addSphere(sphere, 0.2f, 16, 16);
        g.pushMatrix();
        g.translate(pose().pos());
        g.color(color);
        g.draw(sphere);
        g.popMatrix();
    }
};

class SpatialAudioTest : public WebApp {
public:
    DynamicScene scene;
    Mesh listenerMesh;
    Mesh groundPlane;
    Mesh directionArrow;

    double time = 0;
    float listenerAngle = 0;

    // Manual stereo panner for demo
    StereoPanner panner;
    Sine<> continuousOsc;
    float manualSourceX = 0;
    float manualSourceZ = -3;

    void onCreate() override {
        // Initialize scene
        scene.distanceAttenuation(true);
        scene.setDefaultNearClip(0.5f);
        scene.setDefaultFarClip(20.0f);

        // Allocate voices
        scene.allocatePolyphony<SpatialVoice>(16);
        scene.prepare(audioIO());

        // Create listener visual (a cone/arrow showing direction)
        addCone(listenerMesh, 0.2f, Vec3f(0, 0, 0.5f), Vec3f(0, 0, -0.3f), 12);
        listenerMesh.generateNormals();

        // Create ground plane
        groundPlane.primitive(Mesh::TRIANGLES);
        float size = 10.0f;
        groundPlane.vertex(-size, -0.5f, -size); groundPlane.color(0.2f, 0.3f, 0.2f);
        groundPlane.vertex( size, -0.5f, -size); groundPlane.color(0.2f, 0.3f, 0.2f);
        groundPlane.vertex( size, -0.5f,  size); groundPlane.color(0.2f, 0.3f, 0.2f);
        groundPlane.vertex(-size, -0.5f, -size); groundPlane.color(0.2f, 0.3f, 0.2f);
        groundPlane.vertex( size, -0.5f,  size); groundPlane.color(0.2f, 0.3f, 0.2f);
        groundPlane.vertex(-size, -0.5f,  size); groundPlane.color(0.2f, 0.3f, 0.2f);

        // Create direction arrow
        directionArrow.primitive(Mesh::LINES);
        directionArrow.vertex(0, 0, 0); directionArrow.color(1, 1, 0);
        directionArrow.vertex(0, 0, -1); directionArrow.color(1, 1, 0);

        // Configure panner
        panner.numSpeakers(2);
        std::vector<float> azimuths = {-45.0f, 45.0f};  // Stereo at +/- 45 degrees
        panner.setSpeakerAngles(azimuths);

        continuousOsc.freq(330.0f);

        nav().pos(0, 2, 8);
        nav().faceToward(Vec3f(0, 0, 0));
        configureWebAudio(44100, 128, 2, 0);

        std::cout << "[INFO] Spatial Audio Test" << std::endl;
        std::cout << "[INFO] Press 1-5 to trigger sounds at different positions" << std::endl;
        std::cout << "[INFO] Press LEFT/RIGHT arrows to rotate listener" << std::endl;
        std::cout << "[INFO] Press A/D to move manual source left/right" << std::endl;
        std::cout << "[INFO] Press W/S to move manual source forward/back" << std::endl;
    }

    void onAnimate(double dt) override {
        time += dt;

        // Update listener pose in scene
        Pose listenerPose;
        listenerPose.pos(0, 0, 0);
        listenerPose.faceToward(Vec3f(sin(listenerAngle), 0, -cos(listenerAngle)));
        scene.listenerPose(listenerPose);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        // Draw ground
        g.draw(groundPlane);

        // Draw listener at origin
        g.pushMatrix();
        g.rotate(listenerAngle * 180.0f / M_PI, 0, 1, 0);
        g.color(1.0f, 0.8f, 0.2f);
        g.draw(listenerMesh);
        // Draw direction indicator
        g.lighting(false);
        g.lineWidth(3);
        g.draw(directionArrow);
        g.lighting(true);
        g.popMatrix();

        // Draw manual source position
        g.pushMatrix();
        g.translate(manualSourceX, 0, manualSourceZ);
        Mesh sourceSphere;
        addSphere(sourceSphere, 0.15f, 12, 12);
        g.color(0.2f, 0.8f, 1.0f);
        g.draw(sourceSphere);
        g.popMatrix();

        // Draw positioned voice locations (from scene)
        // Scene will call onProcess(Graphics) for each active voice
        scene.render(g);

        // Draw reference grid
        g.lighting(false);
        g.lineWidth(1);
        g.color(0.3f, 0.3f, 0.3f);
        Mesh grid;
        grid.primitive(Mesh::LINES);
        for (int i = -5; i <= 5; i++) {
            grid.vertex(i, -0.49f, -5); grid.vertex(i, -0.49f, 5);
            grid.vertex(-5, -0.49f, i); grid.vertex(5, -0.49f, i);
        }
        g.draw(grid);
    }

    void onSound(AudioIOData& io) override {
        // Process scene (positioned voices)
        scene.render(io);

        // Add continuous panned source for testing stereo panning
        while (io()) {
            float s = continuousOsc() * 0.1f;

            // Calculate azimuth of manual source relative to listener
            float dx = manualSourceX;
            float dz = manualSourceZ;

            // Rotate by listener angle
            float rotX = dx * cos(-listenerAngle) - dz * sin(-listenerAngle);
            float rotZ = dx * sin(-listenerAngle) + dz * cos(-listenerAngle);

            // Calculate azimuth in degrees
            float azimuth = atan2(rotX, -rotZ) * 180.0f / M_PI;

            // Calculate distance for attenuation
            float distance = sqrt(dx * dx + dz * dz);
            float atten = 1.0f / (1.0f + distance * 0.5f);

            // Use panner to get stereo gains
            float gains[2];
            panner.renderSample(io, azimuth, 0, gains);

            // Mix in with attenuation
            io.out(0) += s * gains[0] * atten;
            io.out(1) += s * gains[1] * atten;
        }
    }

    void triggerSoundAt(float x, float y, float z, float freq, Color col) {
        auto* voice = scene.getVoice<SpatialVoice>();
        if (voice) {
            voice->freq = freq;
            voice->color = col;
            voice->pose().pos(x, y, z);
            scene.triggerOn(voice);
            std::cout << "[INFO] Sound triggered at (" << x << ", " << y << ", " << z << ")" << std::endl;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        // Trigger sounds at various positions
        if (k.key() == '1') {
            triggerSoundAt(-3, 0, 0, 440, Color(1, 0, 0));  // Left
            return true;
        }
        if (k.key() == '2') {
            triggerSoundAt(3, 0, 0, 550, Color(0, 1, 0));   // Right
            return true;
        }
        if (k.key() == '3') {
            triggerSoundAt(0, 0, -5, 660, Color(0, 0, 1));  // Front
            return true;
        }
        if (k.key() == '4') {
            triggerSoundAt(0, 0, 5, 330, Color(1, 1, 0));   // Behind
            return true;
        }
        if (k.key() == '5') {
            // Trigger several at once (chord)
            triggerSoundAt(-2, 0, -2, 262, Color(1, 0.5f, 0));
            triggerSoundAt(0, 0, -3, 330, Color(0.5f, 1, 0));
            triggerSoundAt(2, 0, -2, 392, Color(0, 0.5f, 1));
            return true;
        }

        // Listener rotation
        if (k.key() == Keyboard::LEFT) {
            listenerAngle -= 0.2f;
            std::cout << "[INFO] Listener angle: " << (listenerAngle * 180 / M_PI) << " deg" << std::endl;
            return true;
        }
        if (k.key() == Keyboard::RIGHT) {
            listenerAngle += 0.2f;
            std::cout << "[INFO] Listener angle: " << (listenerAngle * 180 / M_PI) << " deg" << std::endl;
            return true;
        }

        // Manual source movement
        if (k.key() == 'a' || k.key() == 'A') {
            manualSourceX -= 0.5f;
            return true;
        }
        if (k.key() == 'd' || k.key() == 'D') {
            manualSourceX += 0.5f;
            return true;
        }
        if (k.key() == 'w' || k.key() == 'W') {
            manualSourceZ -= 0.5f;
            return true;
        }
        if (k.key() == 's' || k.key() == 'S') {
            manualSourceZ += 0.5f;
            return true;
        }

        return false;
    }
};

ALLOLIB_WEB_MAIN(SpatialAudioTest)
