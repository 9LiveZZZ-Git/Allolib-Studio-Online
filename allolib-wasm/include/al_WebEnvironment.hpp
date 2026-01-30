/**
 * Web Environment Map System
 *
 * Provides skybox rendering and environment mapping for HDR environments.
 * Works with equirectangular HDR images loaded via WebHDR.
 *
 * Usage:
 *   WebEnvironment env;
 *   env.load("/assets/environments/studio.hdr");
 *
 *   // In onCreate
 *   env.create(g);  // Initialize GPU resources
 *
 *   // In onDraw
 *   env.drawSkybox(g, nav());  // Draw skybox behind everything
 *
 *   // For reflective objects
 *   env.bind(0);  // Bind environment texture to unit 0
 *   g.shader(myReflectiveShader);
 *   // ... draw reflective objects
 *   env.unbind(0);
 */

#ifndef AL_WEB_ENVIRONMENT_HPP
#define AL_WEB_ENVIRONMENT_HPP

#include <emscripten.h>
#include <GLES3/gl3.h>
#include <string>
#include <vector>
#include <functional>
#include <cmath>

#include "al_WebHDR.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/graphics/al_Shader.hpp"
#include "al/graphics/al_Graphics.hpp"

namespace al {

/**
 * Skybox vertex shader for equirectangular environment maps
 */
inline std::string skybox_vert_shader() {
    return R"(#version 300 es
precision highp float;
precision highp int;

layout (location = 0) in vec3 position;
uniform mat4 al_ModelViewMatrix;
uniform mat4 al_ProjectionMatrix;
out vec3 vDirection;

void main() {
    // Remove translation from view matrix for skybox
    mat4 viewNoTranslate = al_ModelViewMatrix;
    viewNoTranslate[3][0] = 0.0;
    viewNoTranslate[3][1] = 0.0;
    viewNoTranslate[3][2] = 0.0;

    vec4 pos = al_ProjectionMatrix * viewNoTranslate * vec4(position, 1.0);
    // Set z to w so the skybox is always at max depth
    gl_Position = pos.xyww;
    vDirection = position;
}
)";
}

/**
 * Skybox fragment shader for equirectangular HDR maps
 */
inline std::string skybox_frag_shader() {
    return R"(#version 300 es
precision highp float;
precision highp int;

in vec3 vDirection;
uniform sampler2D envMap;
uniform float exposure;
uniform float gamma;
out vec4 frag_color;

const float PI = 3.14159265359;

vec2 directionToUV(vec3 dir) {
    // Equirectangular mapping
    float phi = atan(dir.z, dir.x);    // -PI to PI
    float theta = acos(dir.y);         // 0 to PI

    float u = (phi + PI) / (2.0 * PI); // 0 to 1
    float v = theta / PI;               // 0 to 1

    return vec2(u, v);
}

void main() {
    vec3 dir = normalize(vDirection);
    vec2 uv = directionToUV(dir);

    vec3 hdrColor = texture(envMap, uv).rgb;

    // Tone mapping (Reinhard)
    vec3 mapped = hdrColor * exposure;
    mapped = mapped / (vec3(1.0) + mapped);

    // Gamma correction
    mapped = pow(mapped, vec3(1.0 / gamma));

    frag_color = vec4(mapped, 1.0);
}
)";
}

/**
 * Environment reflection vertex shader
 */
inline std::string envmap_reflect_vert_shader() {
    return R"(#version 300 es
precision highp float;
precision highp int;

layout (location = 0) in vec3 position;
layout (location = 3) in vec3 normal;
uniform mat4 al_ModelViewMatrix;
uniform mat4 al_ProjectionMatrix;
uniform vec3 cameraPos;

out vec3 vNormal;
out vec3 vPosition;
out vec3 vViewDir;
out vec3 vLocalPos;

void main() {
    vec4 worldPos = al_ModelViewMatrix * vec4(position, 1.0);
    vPosition = worldPos.xyz;
    vLocalPos = position;

    // Compute normal from position (works for spheres at origin)
    // al_NormalMatrix isn't set correctly for custom shaders
    vec3 objNormal = normalize(position);

    // Transform normal to world space using upper-left 3x3 of ModelViewMatrix
    mat3 normalMatrix = mat3(al_ModelViewMatrix);
    vNormal = normalize(normalMatrix * objNormal);

    vViewDir = normalize(cameraPos - worldPos.xyz);

    gl_Position = al_ProjectionMatrix * worldPos;
}
)";
}

/**
 * Environment reflection fragment shader
 */
inline std::string envmap_reflect_frag_shader() {
    return R"(#version 300 es
precision highp float;
precision highp int;

in vec3 vNormal;
in vec3 vPosition;
in vec3 vViewDir;
in vec3 vLocalPos;

uniform sampler2D envMap;
uniform float exposure;
uniform float gamma;
uniform float reflectivity;
uniform vec4 baseColor;
uniform vec4 tint;

out vec4 frag_color;

const float PI = 3.14159265359;

vec2 directionToUV(vec3 dir) {
    float phi = atan(dir.z, dir.x);
    float theta = acos(clamp(dir.y, -1.0, 1.0));
    return vec2((phi + PI) / (2.0 * PI), theta / PI);
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDir);

    // Reflection vector
    vec3 reflectDir = reflect(-viewDir, normal);

    // Sample environment map
    vec2 uv = directionToUV(reflectDir);
    vec3 envColor = texture(envMap, uv).rgb;

    // Tone mapping
    vec3 mapped = envColor * exposure;
    mapped = mapped / (vec3(1.0) + mapped);
    mapped = pow(mapped, vec3(1.0 / gamma));

    // Mix with base color
    vec3 finalColor = mix(baseColor.rgb, mapped, reflectivity);

    // Note: tint uniform may not be set, default to white
    frag_color = vec4(finalColor, baseColor.a);
}
)";
}

/**
 * Environment map system for skybox and reflections
 */
class WebEnvironment {
public:
    using LoadCallback = std::function<void(bool success)>;

    WebEnvironment() : mTextureId(0), mReady(false), mCreated(false),
                       mExposure(1.0f), mGamma(2.2f) {}

    ~WebEnvironment() {
        destroy();
    }

    /**
     * Load HDR environment from URL
     */
    void load(const std::string& url) {
        mReady = false;
        mUrl = url;

        mHdr.load(url, [this](bool success) {
            if (success) {
                mReady = true;
                mNeedsUpload = true;
                printf("[WebEnvironment] Loaded: %s (%dx%d)\n",
                       mUrl.c_str(), mHdr.width(), mHdr.height());
                if (mCallback) mCallback(true);
            } else {
                printf("[WebEnvironment] Failed to load: %s\n", mUrl.c_str());
                if (mCallback) mCallback(false);
            }
        });
    }

    /**
     * Load with callback
     */
    void load(const std::string& url, LoadCallback callback) {
        mCallback = callback;
        load(url);
    }

    /**
     * Create GPU resources (call once after GL context is ready)
     */
    void create(Graphics& g) {
        if (mCreated) return;

        // Create skybox mesh (inside-out cube)
        createSkyboxMesh();

        // Compile shaders
        mSkyboxShader.compile(skybox_vert_shader(), skybox_frag_shader());
        mReflectShader.compile(envmap_reflect_vert_shader(), envmap_reflect_frag_shader());

        // Create texture (will upload HDR data when ready)
        glGenTextures(1, &mTextureId);
        glBindTexture(GL_TEXTURE_2D, mTextureId);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glBindTexture(GL_TEXTURE_2D, 0);

        mCreated = true;
    }

    /**
     * Destroy GPU resources
     */
    void destroy() {
        if (mTextureId) {
            glDeleteTextures(1, &mTextureId);
            mTextureId = 0;
        }
        mCreated = false;
    }

    /**
     * Draw skybox (should be called first in onDraw, with depth test disabled or depth func LEQUAL)
     */
    void drawSkybox(Graphics& g) {
        if (!mReady) return;

        // Lazy initialization - create GPU resources on first use
        if (!mCreated) {
            create(g);
        }

        uploadIfNeeded();

        // Save state
        GLboolean depthMask;
        glGetBooleanv(GL_DEPTH_WRITEMASK, &depthMask);
        GLint depthFunc;
        glGetIntegerv(GL_DEPTH_FUNC, &depthFunc);

        // Configure for skybox
        glDepthMask(GL_FALSE);
        glDepthFunc(GL_LEQUAL);

        // Bind shader
        g.shader(mSkyboxShader);
        mSkyboxShader.uniform("envMap", 0);
        mSkyboxShader.uniform("exposure", mExposure);
        mSkyboxShader.uniform("gamma", mGamma);

        // Bind texture
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, mTextureId);

        // Draw skybox
        g.draw(mSkyboxMesh);

        // Restore state
        glDepthMask(depthMask);
        glDepthFunc(depthFunc);
        glBindTexture(GL_TEXTURE_2D, 0);
    }

    /**
     * Get shader for reflective objects
     * Set uniforms: cameraPos, reflectivity (0-1), baseColor
     */
    ShaderProgram& reflectShader() { return mReflectShader; }

    /**
     * Begin drawing reflective objects
     */
    void beginReflect(Graphics& g, const Vec3f& cameraPos, float reflectivity = 0.8f) {
        if (!mReady) return;

        // Lazy initialization
        if (!mCreated) {
            create(g);
        }

        uploadIfNeeded();

        g.shader(mReflectShader);
        mReflectShader.uniform("envMap", 0);
        mReflectShader.uniform("exposure", mExposure);
        mReflectShader.uniform("gamma", mGamma);
        mReflectShader.uniform("cameraPos", cameraPos);
        mReflectShader.uniform("reflectivity", reflectivity);
        mReflectShader.uniform("baseColor", Vec4f(0.8f, 0.8f, 0.8f, 1.0f));

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, mTextureId);
    }

    /**
     * End drawing reflective objects
     */
    void endReflect() {
        glBindTexture(GL_TEXTURE_2D, 0);
    }

    /**
     * Bind environment texture to texture unit
     */
    void bind(int unit = 0) {
        if (!mReady || !mCreated) return;
        uploadIfNeeded();
        glActiveTexture(GL_TEXTURE0 + unit);
        glBindTexture(GL_TEXTURE_2D, mTextureId);
    }

    /**
     * Unbind environment texture
     */
    void unbind(int unit = 0) {
        glActiveTexture(GL_TEXTURE0 + unit);
        glBindTexture(GL_TEXTURE_2D, 0);
    }

    /**
     * Check if environment is loaded and ready
     */
    bool ready() const { return mReady && mCreated; }

    /**
     * Get/set exposure for tone mapping
     */
    float exposure() const { return mExposure; }
    void exposure(float e) { mExposure = e; }

    /**
     * Get/set gamma for correction
     */
    float gamma() const { return mGamma; }
    void gamma(float g) { mGamma = g; }

    /**
     * Get underlying HDR data
     */
    const WebHDR& hdr() const { return mHdr; }

    /**
     * Get texture ID for custom shaders
     */
    GLuint textureId() const { return mTextureId; }

    /**
     * Get URL that was loaded
     */
    const std::string& url() const { return mUrl; }

    /**
     * Sample environment in direction (for CPU calculations)
     */
    void sample(float dx, float dy, float dz, float& r, float& g, float& b) const {
        mHdr.sampleDirection(dx, dy, dz, r, g, b);
    }

private:
    void createSkyboxMesh() {
        mSkyboxMesh.reset();
        mSkyboxMesh.primitive(Mesh::TRIANGLES);

        // Create inside-out cube
        float s = 1.0f;

        // Vertices of a cube
        Vec3f vertices[8] = {
            {-s, -s, -s}, {+s, -s, -s}, {+s, +s, -s}, {-s, +s, -s},  // back
            {-s, -s, +s}, {+s, -s, +s}, {+s, +s, +s}, {-s, +s, +s}   // front
        };

        // Faces (inside-out winding)
        int faces[6][4] = {
            {0, 1, 2, 3},  // back
            {5, 4, 7, 6},  // front
            {4, 0, 3, 7},  // left
            {1, 5, 6, 2},  // right
            {3, 2, 6, 7},  // top
            {4, 5, 1, 0}   // bottom
        };

        for (int i = 0; i < 6; i++) {
            // Two triangles per face
            mSkyboxMesh.vertex(vertices[faces[i][0]]);
            mSkyboxMesh.vertex(vertices[faces[i][1]]);
            mSkyboxMesh.vertex(vertices[faces[i][2]]);

            mSkyboxMesh.vertex(vertices[faces[i][0]]);
            mSkyboxMesh.vertex(vertices[faces[i][2]]);
            mSkyboxMesh.vertex(vertices[faces[i][3]]);
        }
    }

    void uploadIfNeeded() {
        if (!mNeedsUpload || !mReady) return;

        // Upload HDR data as RGB float texture
        glBindTexture(GL_TEXTURE_2D, mTextureId);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB16F,
                     mHdr.width(), mHdr.height(), 0,
                     GL_RGB, GL_FLOAT, mHdr.pixels());
        glBindTexture(GL_TEXTURE_2D, 0);

        mNeedsUpload = false;
        printf("[WebEnvironment] Uploaded HDR texture: %dx%d\n", mHdr.width(), mHdr.height());
    }

    std::string mUrl;
    WebHDR mHdr;
    GLuint mTextureId;
    Mesh mSkyboxMesh;
    ShaderProgram mSkyboxShader;
    ShaderProgram mReflectShader;
    bool mReady;
    bool mCreated;
    bool mNeedsUpload = false;
    float mExposure;
    float mGamma;
    LoadCallback mCallback;
};

} // namespace al

#endif // AL_WEB_ENVIRONMENT_HPP
