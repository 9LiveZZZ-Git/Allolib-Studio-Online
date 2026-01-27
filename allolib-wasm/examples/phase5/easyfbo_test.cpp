/**
 * Phase 5 Test: EasyFBO (Framebuffer Objects)
 * Tests render-to-texture functionality:
 * - Creating FBO with color attachment
 * - Rendering scene to texture
 * - Using texture on geometry
 * - Post-processing effects
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/graphics/al_EasyFBO.hpp"
#include <cmath>

using namespace al;

class EasyFBOTest : public WebApp {
public:
    EasyFBO fbo;
    Mesh sphere;
    Mesh cube;
    Mesh screenQuad;
    ShaderProgram postShader;

    double time = 0;
    int effectMode = 0;
    const int numEffects = 4;
    const char* effectNames[4] = {"Normal", "Invert", "Grayscale", "Pixelate"};

    // Post-processing shaders
    const char* postVertShader = R"(#version 300 es
        precision highp float;
        layout(location = 0) in vec3 position;
        layout(location = 2) in vec2 texcoord;
        out vec2 vTexCoord;
        void main() {
            gl_Position = vec4(position, 1.0);
            vTexCoord = texcoord;
        }
    )";

    const char* postFragShader = R"(#version 300 es
        precision highp float;
        uniform sampler2D tex0;
        uniform int effectMode;
        uniform float time;
        in vec2 vTexCoord;
        out vec4 fragColor;

        void main() {
            vec2 uv = vTexCoord;

            // Effect 3: Pixelate
            if (effectMode == 3) {
                float pixels = 100.0;
                uv = floor(uv * pixels) / pixels;
            }

            vec4 color = texture(tex0, uv);

            // Effect 1: Invert
            if (effectMode == 1) {
                color.rgb = 1.0 - color.rgb;
            }
            // Effect 2: Grayscale
            else if (effectMode == 2) {
                float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                color.rgb = vec3(gray);
            }

            fragColor = color;
        }
    )";

    void onCreate() override {
        // Create FBO at reasonable resolution
        fbo.init(800, 600);

        // Create shapes
        addSphere(sphere, 1.0, 32, 32);
        sphere.generateNormals();

        addCube(cube, 0.8);
        cube.generateNormals();

        // Create screen-space quad for post-processing
        screenQuad.primitive(Mesh::TRIANGLES);
        screenQuad.vertex(-1, -1, 0); screenQuad.texCoord(0, 0);
        screenQuad.vertex( 1, -1, 0); screenQuad.texCoord(1, 0);
        screenQuad.vertex( 1,  1, 0); screenQuad.texCoord(1, 1);
        screenQuad.vertex(-1, -1, 0); screenQuad.texCoord(0, 0);
        screenQuad.vertex( 1,  1, 0); screenQuad.texCoord(1, 1);
        screenQuad.vertex(-1,  1, 0); screenQuad.texCoord(0, 1);

        // Compile post-processing shader
        if (!postShader.compile(postVertShader, postFragShader)) {
            std::cerr << "[ERROR] Failed to compile post shader" << std::endl;
        }

        nav().pos(0, 0, 6);
        configureWebAudio(44100, 128, 2, 0);

        std::cout << "[INFO] EasyFBO Test - Render to Texture" << std::endl;
        std::cout << "[INFO] Press SPACE to cycle effects: Normal, Invert, Grayscale, Pixelate" << std::endl;
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void renderScene(Graphics& g) {
        // This is what gets rendered to the FBO
        g.clear(0.1f, 0.1f, 0.2f);
        g.depthTesting(true);
        g.lighting(true);

        // Central sphere
        g.pushMatrix();
        g.rotate(time * 30, 0, 1, 0);
        g.color(0.8f, 0.2f, 0.2f);
        g.draw(sphere);
        g.popMatrix();

        // Orbiting cubes
        for (int i = 0; i < 6; i++) {
            g.pushMatrix();
            float angle = i * M_PI / 3.0f + time * 0.5f;
            g.translate(3.0f * cos(angle), sin(time + i) * 0.5f, 3.0f * sin(angle));
            g.rotate(time * 60 + i * 30, 1, 1, 0);
            g.color(HSV(i / 6.0f, 0.8f, 1.0f));
            g.draw(cube);
            g.popMatrix();
        }
    }

    void onDraw(Graphics& g) override {
        // === Pass 1: Render scene to FBO ===
        g.pushFramebuffer(fbo);
        g.pushViewport(fbo.width(), fbo.height());
        g.pushCamera(nav().view());
        g.pushMatrix();

        renderScene(g);

        g.popMatrix();
        g.popCamera();
        g.popViewport();
        g.popFramebuffer();

        // === Pass 2: Render FBO texture to screen with post-processing ===
        g.clear(0, 0, 0);
        g.depthTesting(false);
        g.lighting(false);

        // Use post-processing shader
        g.shader(postShader);
        postShader.uniform("effectMode", effectMode);
        postShader.uniform("time", (float)time);

        // Bind FBO texture
        fbo.colorTexture().bind(0);
        g.texture();
        g.draw(screenQuad);
        fbo.colorTexture().unbind(0);
    }

    bool onKeyDown(const Keyboard& k) override {
        if (k.key() == ' ') {
            effectMode = (effectMode + 1) % numEffects;
            std::cout << "[INFO] Effect: " << effectNames[effectMode] << std::endl;
            return true;
        }
        return false;
    }
};

ALLOLIB_WEB_MAIN(EasyFBOTest)
