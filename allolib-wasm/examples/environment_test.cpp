/**
 * Environment Map Test
 *
 * Tests the WebHDR and WebEnvironment functionality.
 */

#include "al_WebApp.hpp"
#include "al_WebEnvironment.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class EnvironmentTest : public WebApp {
public:
    WebEnvironment env;
    Mesh sphere;
    Mesh floor;
    double angle = 0;

    void onCreate() override {
        // Load HDR environment
        env.load("/assets/environments/studio_small_09_1k.hdr", [](bool success) {
            printf("[Test] Environment load %s\n", success ? "succeeded" : "failed");
        });

        // Create test objects
        addSphere(sphere, 0.8, 48, 48);
        sphere.generateNormals();

        addSurface(floor, 10, 10, 2, 2);
        floor.generateNormals();

        // GPU resources created automatically on first draw

        nav().pos(0, 1, 5);
        nav().faceToward(Vec3d(0, 0, 0));
    }

    void onAnimate(double dt) override {
        angle += dt * 25.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.05, 0.05, 0.08);

        // Draw skybox first (background)
        env.drawSkybox(g);

        g.depthTesting(true);

        // Draw reflective sphere using environment
        env.beginReflect(g, nav().pos(), 0.85);

        g.pushMatrix();
        g.translate(0, 0.8, 0);
        g.rotate(angle, 0.1, 1, 0.05);
        g.draw(sphere);
        g.popMatrix();

        env.endReflect();

        // Draw floor with standard lighting
        g.lighting(true);
        g.pushMatrix();
        g.rotate(-90, 1, 0, 0);
        g.color(0.3, 0.3, 0.35);
        g.draw(floor);
        g.popMatrix();
    }

    bool onKeyDown(Keyboard const& k) override {
        if (k.key() == '+' || k.key() == '=') {
            env.exposure(env.exposure() + 0.2f);
            printf("Exposure: %.1f\n", env.exposure());
        } else if (k.key() == '-') {
            env.exposure(std::max(0.2f, env.exposure() - 0.2f));
            printf("Exposure: %.1f\n", env.exposure());
        }
        return true;
    }
};

int main() {
    EnvironmentTest app;
    app.start();
    return 0;
}
