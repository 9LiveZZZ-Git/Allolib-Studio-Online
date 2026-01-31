/**
 * PBR Material Test
 *
 * Tests the WebPBR system with IBL.
 */

#include "al_WebApp.hpp"
#include "al_WebPBR.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class PBRTest : public WebApp {
public:
    WebPBR pbr;
    Mesh sphere;
    double angle = 0;

    void onCreate() override {
        // Load HDR environment
        pbr.loadEnvironment("/assets/environments/studio_small_09_1k.hdr", [](bool success) {
            printf("[Test] PBR environment load %s\n", success ? "succeeded" : "failed");
        });

        // Create test sphere
        addSphere(sphere, 0.8, 48, 48);
        sphere.generateNormals();

        // GPU resources created automatically on first draw

        nav().pos(0, 0, 4);
    }

    void onAnimate(double dt) override {
        angle += dt * 20.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.02, 0.02, 0.03);

        // Draw skybox
        pbr.drawSkybox(g);

        g.depthTesting(true);

        // Draw PBR sphere
        pbr.begin(g, nav().pos());

        g.pushMatrix();
        g.rotate(angle, 0, 1, 0);

        PBRMaterial mat = PBRMaterial::Gold();
        pbr.material(mat);
        g.draw(sphere);

        g.popMatrix();

        pbr.end();
    }

    bool onKeyDown(Keyboard const& k) override {
        if (k.key() == '+' || k.key() == '=') {
            pbr.exposure(pbr.exposure() + 0.2f);
            printf("Exposure: %.1f\n", pbr.exposure());
        } else if (k.key() == '-') {
            pbr.exposure(std::max(0.2f, pbr.exposure() - 0.2f));
            printf("Exposure: %.1f\n", pbr.exposure());
        }
        return true;
    }
};

int main() {
    PBRTest app;
    app.start();
    return 0;
}
