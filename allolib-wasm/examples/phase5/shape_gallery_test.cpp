/**
 * Phase 5 Test: Shape Gallery
 * Tests all addShape() functions from al_Shapes.hpp
 *
 * Shapes tested:
 * - addSphere
 * - addCube
 * - addCone
 * - addCylinder
 * - addTorus
 * - addSurfaceLoop (surface of revolution)
 * - addRect
 * - addIcosphere
 * - addDodecahedron
 * - addOctahedron
 * - addTetrahedron
 * - addWireBox
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include <cmath>

using namespace al;

struct ShapeInfo {
    Mesh mesh;
    const char* name;
    Color color;
};

class ShapeGalleryTest : public WebApp {
public:
    std::vector<ShapeInfo> shapes;
    double time = 0;
    int currentShape = 0;
    int displayMode = 0;  // 0: solid, 1: wireframe, 2: both

    void onCreate() override {
        // Create all shapes
        createShape("Sphere", [](Mesh& m) { addSphere(m, 1.0, 32, 32); }, HSV(0.0f, 0.7f, 1.0f));
        createShape("Cube", [](Mesh& m) { addCube(m, 1.5); }, HSV(0.1f, 0.7f, 1.0f));
        createShape("Cone", [](Mesh& m) { addCone(m, 0.8, Vec3f(0, -1, 0), Vec3f(0, 1.5, 0), 32); }, HSV(0.2f, 0.7f, 1.0f));
        createShape("Cylinder", [](Mesh& m) { addCylinder(m, 0.6, 2.0, 32, 1, true, true); }, HSV(0.3f, 0.7f, 1.0f));
        createShape("Torus", [](Mesh& m) { addTorus(m, 0.3, 1.0, 32, 32); }, HSV(0.4f, 0.7f, 1.0f));
        createShape("Icosphere", [](Mesh& m) { addIcosphere(m, 1.0, 3); }, HSV(0.5f, 0.7f, 1.0f));
        createShape("Dodecahedron", [](Mesh& m) { addDodecahedron(m, 1.0); }, HSV(0.6f, 0.7f, 1.0f));
        createShape("Octahedron", [](Mesh& m) { addOctahedron(m, 1.2); }, HSV(0.7f, 0.7f, 1.0f));
        createShape("Tetrahedron", [](Mesh& m) { addTetrahedron(m, 1.2); }, HSV(0.8f, 0.7f, 1.0f));
        createShape("Rect", [](Mesh& m) { addRect(m, -1.0f, -0.75f, 2.0f, 1.5f); }, HSV(0.9f, 0.7f, 1.0f));

        // Create a surface of revolution (vase-like shape)
        createShape("Surface Loop", [](Mesh& m) {
            std::vector<Vec3f> profile;
            for (int i = 0; i <= 16; i++) {
                float t = i / 16.0f;
                float y = t * 2.0f - 1.0f;
                float r = 0.3f + 0.3f * sin(t * M_PI * 2) + 0.1f * sin(t * M_PI * 4);
                profile.push_back(Vec3f(r, y, 0));
            }
            addSurfaceLoop(m, profile.data(), profile.size(), 32, 0);
        }, HSV(0.95f, 0.7f, 1.0f));

        // Wire box
        createShape("Wire Box", [](Mesh& m) {
            addWireBox(m, 1.5, 1.0, 1.2);
        }, HSV(0.15f, 0.5f, 1.0f));

        nav().pos(0, 0, 5);
        configureWebAudio(44100, 128, 2, 0);

        std::cout << "[INFO] Shape Gallery Test - " << shapes.size() << " shapes loaded" << std::endl;
        std::cout << "[INFO] Press SPACE to cycle shapes, 'M' to change display mode" << std::endl;
    }

    template<typename F>
    void createShape(const char* name, F createFunc, Color color) {
        ShapeInfo info;
        info.name = name;
        info.color = color;
        createFunc(info.mesh);
        info.mesh.generateNormals();
        shapes.push_back(std::move(info));
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        // Rotate the shape
        g.pushMatrix();
        g.rotate(time * 30, 0, 1, 0);
        g.rotate(time * 15, 1, 0, 0);

        auto& shape = shapes[currentShape];

        if (displayMode == 0 || displayMode == 2) {
            // Solid
            g.polygonFill();
            g.color(shape.color);
            g.draw(shape.mesh);
        }

        if (displayMode == 1 || displayMode == 2) {
            // Wireframe
            g.polygonLine();
            g.color(1, 1, 1, 0.5f);
            g.draw(shape.mesh);
        }

        g.popMatrix();
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') {
            currentShape = (currentShape + 1) % shapes.size();
            std::cout << "[INFO] Now showing: " << shapes[currentShape].name << std::endl;
            return true;
        }
        if (k.key() == 'm' || k.key() == 'M') {
            displayMode = (displayMode + 1) % 3;
            const char* modes[] = {"Solid", "Wireframe", "Both"};
            std::cout << "[INFO] Display mode: " << modes[displayMode] << std::endl;
            return true;
        }
        if (k.key() >= '0' && k.key() <= '9') {
            int idx = k.key() - '0';
            if (idx < (int)shapes.size()) {
                currentShape = idx;
                std::cout << "[INFO] Now showing: " << shapes[currentShape].name << std::endl;
            }
            return true;
        }
        return false;
    }
};

ALLOLIB_WEB_MAIN(ShapeGalleryTest)
