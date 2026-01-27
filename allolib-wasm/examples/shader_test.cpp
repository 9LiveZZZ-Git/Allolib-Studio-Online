/**
 * AlloLib Web - Custom Shader Test
 * Tests custom GLSL ES 3.0 shaders
 *
 * This verifies Phase 4: Custom Shaders
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "al/graphics/al_Shader.hpp"
#include <cmath>

using namespace al;

// Custom vertex shader (GLSL ES 3.0)
const char* vertexShader = R"(#version 300 es
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;

uniform mat4 al_ModelViewMatrix;
uniform mat4 al_ProjectionMatrix;
uniform mat4 al_NormalMatrix;
uniform float time;

out vec3 vNormal;
out vec3 vPosition;
out float vTime;

void main() {
    // Apply wave deformation based on time
    vec3 pos = position;
    pos.y += sin(pos.x * 3.0 + time * 2.0) * 0.2;
    pos.x += cos(pos.z * 3.0 + time * 1.5) * 0.1;

    vec4 worldPos = al_ModelViewMatrix * vec4(pos, 1.0);
    gl_Position = al_ProjectionMatrix * worldPos;

    vNormal = normalize((al_NormalMatrix * vec4(normal, 0.0)).xyz);
    vPosition = worldPos.xyz;
    vTime = time;
}
)";

// Custom fragment shader (GLSL ES 3.0)
const char* fragmentShader = R"(#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vPosition;
in float vTime;

out vec4 fragColor;

void main() {
    // Animated color based on position and time
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0);

    // Rainbow color cycling
    float hue = fract(vPosition.y * 0.3 + vTime * 0.2);
    vec3 baseColor = vec3(
        abs(hue * 6.0 - 3.0) - 1.0,
        2.0 - abs(hue * 6.0 - 2.0),
        2.0 - abs(hue * 6.0 - 4.0)
    );
    baseColor = clamp(baseColor, 0.0, 1.0);

    vec3 color = baseColor * (0.3 + 0.7 * diffuse);
    fragColor = vec4(color, 1.0);
}
)";

class ShaderTestApp : public WebApp {
public:
    Mesh mesh;
    ShaderProgram shader;
    double time = 0;

    void onCreate() override {
        // Create a sphere mesh
        addSphere(mesh, 1.0, 64, 64);
        mesh.generateNormals();

        // Compile custom shader
        if (!shader.compile(vertexShader, fragmentShader)) {
            std::cerr << "[ERROR] Shader compilation failed!" << std::endl;
        } else {
            std::cout << "[INFO] Custom shader compiled successfully" << std::endl;
        }

        // Set up camera
        nav().pos(0, 0, 4);

        // No audio for this test
        configureWebAudio(44100, 128, 2, 0);
    }

    void onAnimate(double dt) override {
        time += dt;
    }

    void onDraw(Graphics& g) override {
        g.clear(0.1f, 0.1f, 0.2f);
        g.depthTesting(true);

        // Use custom shader
        g.shader(shader);

        // Set uniform for time
        shader.uniform("time", (float)time);

        // Draw mesh
        g.draw(mesh);
    }
};

ALLOLIB_WEB_MAIN(ShaderTestApp)
