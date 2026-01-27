/**
 * Phase 5 Test: Mesh Primitives
 * Tests all OpenGL primitive types supported by WebGL2
 *
 * Primitives tested:
 * - POINTS
 * - LINES
 * - LINE_STRIP
 * - LINE_LOOP
 * - TRIANGLES
 * - TRIANGLE_STRIP
 * - TRIANGLE_FAN
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

class MeshPrimitivesTest : public WebApp {
public:
    // Different meshes for each primitive type
    Mesh pointsMesh;
    Mesh linesMesh;
    Mesh lineStripMesh;
    Mesh lineLoopMesh;
    Mesh trianglesMesh;
    Mesh triangleStripMesh;
    Mesh triangleFanMesh;

    double time = 0;
    int currentPrimitive = 0;
    const int numPrimitives = 7;
    const char* primitiveNames[7] = {
        "POINTS", "LINES", "LINE_STRIP", "LINE_LOOP",
        "TRIANGLES", "TRIANGLE_STRIP", "TRIANGLE_FAN"
    };

    void onCreate() override {
        // POINTS - scattered points
        pointsMesh.primitive(Mesh::POINTS);
        for (int i = 0; i < 50; i++) {
            float angle = i * 0.125664f;
            float r = 0.5f + 0.5f * sin(i * 0.3f);
            pointsMesh.vertex(r * cos(angle), r * sin(angle), 0);
            pointsMesh.color(HSV(i / 50.0f, 1, 1));
        }

        // LINES - paired line segments
        linesMesh.primitive(Mesh::LINES);
        for (int i = 0; i < 10; i++) {
            float y = -0.8f + i * 0.16f;
            linesMesh.vertex(-0.8f, y, 0);
            linesMesh.color(HSV(i / 10.0f, 1, 1));
            linesMesh.vertex(0.8f, y, 0);
            linesMesh.color(HSV(i / 10.0f, 1, 1));
        }

        // LINE_STRIP - connected line
        lineStripMesh.primitive(Mesh::LINE_STRIP);
        for (int i = 0; i < 50; i++) {
            float t = i / 49.0f;
            float x = -0.8f + t * 1.6f;
            float y = 0.5f * sin(t * 6.28f * 3);
            lineStripMesh.vertex(x, y, 0);
            lineStripMesh.color(HSV(t, 1, 1));
        }

        // LINE_LOOP - closed polygon
        lineLoopMesh.primitive(Mesh::LINE_LOOP);
        for (int i = 0; i < 6; i++) {
            float angle = i * M_PI / 3.0f;
            lineLoopMesh.vertex(0.7f * cos(angle), 0.7f * sin(angle), 0);
            lineLoopMesh.color(HSV(i / 6.0f, 1, 1));
        }

        // TRIANGLES - individual triangles
        trianglesMesh.primitive(Mesh::TRIANGLES);
        for (int i = 0; i < 4; i++) {
            float cx = -0.5f + (i % 2) * 1.0f;
            float cy = -0.3f + (i / 2) * 0.6f;
            float size = 0.3f;
            HSV col(i / 4.0f, 1, 1);

            trianglesMesh.vertex(cx, cy + size, 0);
            trianglesMesh.color(col);
            trianglesMesh.vertex(cx - size * 0.866f, cy - size * 0.5f, 0);
            trianglesMesh.color(col);
            trianglesMesh.vertex(cx + size * 0.866f, cy - size * 0.5f, 0);
            trianglesMesh.color(col);
        }

        // TRIANGLE_STRIP - connected triangles
        triangleStripMesh.primitive(Mesh::TRIANGLE_STRIP);
        for (int i = 0; i < 10; i++) {
            float x = -0.8f + i * 0.18f;
            float y = (i % 2 == 0) ? 0.3f : -0.3f;
            triangleStripMesh.vertex(x, y, 0);
            triangleStripMesh.color(HSV(i / 10.0f, 1, 1));
        }

        // TRIANGLE_FAN - fan from center point
        triangleFanMesh.primitive(Mesh::TRIANGLE_FAN);
        triangleFanMesh.vertex(0, 0, 0);  // Center
        triangleFanMesh.color(1, 1, 1);
        for (int i = 0; i <= 12; i++) {
            float angle = i * M_PI / 6.0f;
            triangleFanMesh.vertex(0.7f * cos(angle), 0.7f * sin(angle), 0);
            triangleFanMesh.color(HSV(i / 12.0f, 1, 1));
        }

        nav().pos(0, 0, 3);
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        time += dt;
        // Cycle through primitives every 2 seconds
        currentPrimitive = (int(time / 2.0) % numPrimitives);
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(false);
        g.blending(true);
        g.blendAdd();

        g.pointSize(8);
        g.lineWidth(2);

        switch (currentPrimitive) {
            case 0: g.draw(pointsMesh); break;
            case 1: g.draw(linesMesh); break;
            case 2: g.draw(lineStripMesh); break;
            case 3: g.draw(lineLoopMesh); break;
            case 4: g.draw(trianglesMesh); break;
            case 5: g.draw(triangleStripMesh); break;
            case 6: g.draw(triangleFanMesh); break;
        }
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') {
            currentPrimitive = (currentPrimitive + 1) % numPrimitives;
            return true;
        }
        return false;
    }
};

ALLOLIB_WEB_MAIN(MeshPrimitivesTest)
