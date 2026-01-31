/**
 * OBJ Loader Test
 *
 * Tests the WebOBJ loader functionality.
 */

#include "al_WebApp.hpp"
#include "al_WebOBJ.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class OBJTest : public WebApp {
public:
    WebOBJ loader;
    Mesh mesh;
    Mesh fallbackMesh;
    double angle = 0;
    bool meshLoaded = false;

    void onCreate() override {
        // Create fallback mesh (shown while loading)
        addSphere(fallbackMesh, 0.5, 16, 16);
        fallbackMesh.generateNormals();

        // Try to load OBJ file
        loader.load("/assets/meshes/bunny.obj", [this](bool success) {
            if (success) {
                mesh = loader.mesh();
                mesh.fitToSphere(1.0);
                meshLoaded = true;
                printf("[OBJTest] Loaded mesh: %zu vertices, %zu faces\n",
                       mesh.vertices().size(), mesh.vertices().size() / 3);
            } else {
                printf("[OBJTest] Failed to load mesh\n");
            }
        });

        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        angle += dt * 45.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1, 0.1, 0.15);
        g.depthTesting(true);
        g.lighting(true);

        g.pushMatrix();
        g.rotate(angle, 0, 1, 0);

        if (meshLoaded) {
            g.color(0.9, 0.85, 0.8);
            g.draw(mesh);
        } else {
            g.color(0.5, 0.5, 0.6);
            g.draw(fallbackMesh);
        }

        g.popMatrix();
    }
};

int main() {
    OBJTest app;
    app.start();
    return 0;
}
