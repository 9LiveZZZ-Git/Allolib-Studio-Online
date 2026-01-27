/**
 * AlloLib Web - Texture Test
 * Tests procedural texture generation and rendering
 *
 * This verifies Phase 4: Texture Support
 *
 * Note: Loading textures from files is not supported in the web
 * environment without additional setup. This test uses procedurally
 * generated textures.
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/graphics/al_Texture.hpp"
#include <cmath>
#include <vector>

using namespace al;

class TextureTestApp : public WebApp {
public:
    Mesh mesh;
    Texture texture;
    double angle = 0;
    static const int TEX_SIZE = 256;

    void onCreate() override {
        // Create a cube mesh with texture coordinates
        addCube(mesh, 1.5);
        mesh.generateNormals();

        // Generate procedural texture (checkerboard pattern)
        std::vector<unsigned char> pixels(TEX_SIZE * TEX_SIZE * 4);
        for (int y = 0; y < TEX_SIZE; ++y) {
            for (int x = 0; x < TEX_SIZE; ++x) {
                int idx = (y * TEX_SIZE + x) * 4;
                bool check = ((x / 32) + (y / 32)) % 2 == 0;

                // Add some gradient
                float fx = float(x) / TEX_SIZE;
                float fy = float(y) / TEX_SIZE;

                if (check) {
                    // Blue-ish squares with gradient
                    pixels[idx + 0] = (unsigned char)(50 + fx * 100);    // R
                    pixels[idx + 1] = (unsigned char)(100 + fy * 100);   // G
                    pixels[idx + 2] = (unsigned char)(200);               // B
                } else {
                    // Yellow-ish squares with gradient
                    pixels[idx + 0] = (unsigned char)(200 + fx * 55);    // R
                    pixels[idx + 1] = (unsigned char)(180 + fy * 55);    // G
                    pixels[idx + 2] = (unsigned char)(50);                // B
                }
                pixels[idx + 3] = 255; // A (fully opaque)
            }
        }

        // Create texture from procedural data
        texture.create2D(TEX_SIZE, TEX_SIZE, Texture::RGBA8, Texture::RGBA, Texture::UBYTE);
        texture.submit(pixels.data());

        // Set texture filtering
        texture.filter(Texture::LINEAR);
        texture.wrap(Texture::REPEAT);

        std::cout << "[INFO] Procedural texture created: " << TEX_SIZE << "x" << TEX_SIZE << std::endl;

        // Set up camera
        nav().pos(0, 0, 5);

        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        angle += dt * 30.0;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.15f);
        g.depthTesting(true);
        g.lighting(true);

        g.pushMatrix();

        // Rotate the cube
        g.rotate(angle, 0, 1, 0);
        g.rotate(angle * 0.7, 1, 0, 0);

        // Bind and use texture
        texture.bind(0);
        g.texture();
        g.draw(mesh);
        texture.unbind(0);

        g.popMatrix();
    }
};

ALLOLIB_WEB_MAIN(TextureTestApp)
