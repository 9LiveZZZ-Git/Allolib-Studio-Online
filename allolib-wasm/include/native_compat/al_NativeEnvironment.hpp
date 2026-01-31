/**
 * Native Environment Map System
 *
 * Native equivalent of al_WebEnvironment.hpp using standard OpenGL.
 * Provides skybox rendering and environment mapping for HDR environments.
 *
 * DEPENDENCIES:
 *   - al_NativeHDR.hpp (for HDR loading)
 *   - OpenGL 3.3+ or 4.1+
 *
 * Usage is identical to WebEnvironment:
 *   NativeEnvironment env;  // or use the alias: WebEnvironment env;
 *   env.load("/path/to/studio.hdr");
 *   // In onDraw
 *   env.drawSkybox(g);
 */

#ifndef AL_NATIVE_ENVIRONMENT_HPP
#define AL_NATIVE_ENVIRONMENT_HPP

#ifdef _WIN32
#include <windows.h>
#endif
#include <GL/gl.h>

#include <string>
#include <vector>
#include <functional>
#include <cmath>

#include "al_NativeHDR.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/graphics/al_Shader.hpp"
#include "al/graphics/al_Graphics.hpp"

namespace al {

/**
 * Skybox vertex shader for desktop OpenGL
 */
inline std::string native_skybox_vert_shader() {
    return R"(#version 330 core
layout (location = 0) in vec3 position;
uniform mat4 al_ModelViewMatrix;
uniform mat4 al_ProjectionMatrix;
out vec3 vDirection;

void main() {
    mat4 viewNoTranslate = al_ModelViewMatrix;
    viewNoTranslate[3][0] = 0.0;
    viewNoTranslate[3][1] = 0.0;
    viewNoTranslate[3][2] = 0.0;

    vec4 pos = al_ProjectionMatrix * viewNoTranslate * vec4(position, 1.0);
    gl_Position = pos.xyww;
    vDirection = position;
}
)";
}

/**
 * Skybox fragment shader for equirectangular HDR maps
 */
inline std::string native_skybox_frag_shader() {
    return R"(#version 330 core
in vec3 vDirection;
uniform sampler2D envMap;
uniform float exposure;
uniform float gamma;
out vec4 frag_color;

const float PI = 3.14159265359;

vec2 directionToUV(vec3 dir) {
    float phi = atan(dir.z, dir.x);
    float theta = acos(dir.y);
    float u = (phi + PI) / (2.0 * PI);
    float v = theta / PI;
    return vec2(u, v);
}

void main() {
    vec3 dir = normalize(vDirection);
    vec2 uv = directionToUV(dir);

    vec3 hdrColor = texture(envMap, uv).rgb;

    // Reinhard tone mapping
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
inline std::string native_envmap_reflect_vert_shader() {
    return R"(#version 330 core
layout (location = 0) in vec3 position;
layout (location = 3) in vec3 normal;
uniform mat4 al_ModelViewMatrix;
uniform mat4 al_ProjectionMatrix;
uniform mat3 al_NormalMatrix;
uniform vec3 cameraPos;

out vec3 vNormal;
out vec3 vPosition;
out vec3 vViewDir;

void main() {
    vec4 worldPos = al_ModelViewMatrix * vec4(position, 1.0);
    vPosition = worldPos.xyz;
    vNormal = normalize(al_NormalMatrix * normal);
    vViewDir = normalize(cameraPos - worldPos.xyz);

    gl_Position = al_ProjectionMatrix * worldPos;
}
)";
}

/**
 * Environment reflection fragment shader
 */
inline std::string native_envmap_reflect_frag_shader() {
    return R"(#version 330 core
in vec3 vNormal;
in vec3 vPosition;
in vec3 vViewDir;

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

    vec3 reflectDir = reflect(-viewDir, normal);

    vec2 uv = directionToUV(reflectDir);
    vec3 envColor = texture(envMap, uv).rgb;

    vec3 mapped = envColor * exposure;
    mapped = mapped / (vec3(1.0) + mapped);
    mapped = pow(mapped, vec3(1.0 / gamma));

    vec3 finalColor = mix(baseColor.rgb, mapped, reflectivity);

    frag_color = vec4(finalColor, baseColor.a) * tint;
}
)";
}

/**
 * Environment map system for skybox and reflections (Native version)
 */
class NativeEnvironment {
public:
    using LoadCallback = std::function<void(bool success)>;

    NativeEnvironment() : mTextureId(0), mReady(false), mCreated(false),
                          mExposure(1.0f), mGamma(2.2f) {}

    ~NativeEnvironment() {
        destroy();
    }

    /**
     * Load HDR environment from path
     */
    void load(const std::string& path) {
        mReady = false;
        mUrl = path;

        mHdr.load(path, [this](bool success) {
            if (success) {
                mReady = true;
                mNeedsUpload = true;
                printf("[NativeEnvironment] Loaded: %s (%dx%d)\n",
                       mUrl.c_str(), mHdr.width(), mHdr.height());
                if (mCallback) mCallback(true);
            } else {
                printf("[NativeEnvironment] Failed to load: %s\n", mUrl.c_str());
                if (mCallback) mCallback(false);
            }
        });
    }

    void load(const std::string& path, LoadCallback callback) {
        mCallback = callback;
        load(path);
    }

    /**
     * Create GPU resources
     */
    void create(Graphics& g) {
        if (mCreated) return;

        createSkyboxMesh();

        mSkyboxShader.compile(native_skybox_vert_shader(), native_skybox_frag_shader());
        mReflectShader.compile(native_envmap_reflect_vert_shader(), native_envmap_reflect_frag_shader());

        glGenTextures(1, &mTextureId);
        glBindTexture(GL_TEXTURE_2D, mTextureId);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glBindTexture(GL_TEXTURE_2D, 0);

        mCreated = true;
    }

    void destroy() {
        if (mTextureId) {
            glDeleteTextures(1, &mTextureId);
            mTextureId = 0;
        }
        mCreated = false;
    }

    /**
     * Draw skybox
     */
    void drawSkybox(Graphics& g) {
        if (!mReady) return;

        if (!mCreated) {
            create(g);
        }

        uploadIfNeeded();

        GLboolean depthMask;
        glGetBooleanv(GL_DEPTH_WRITEMASK, &depthMask);
        GLint depthFunc;
        glGetIntegerv(GL_DEPTH_FUNC, &depthFunc);

        glDepthMask(GL_FALSE);
        glDepthFunc(GL_LEQUAL);

        g.shader(mSkyboxShader);
        mSkyboxShader.uniform("envMap", 0);
        mSkyboxShader.uniform("exposure", mExposure);
        mSkyboxShader.uniform("gamma", mGamma);

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, mTextureId);

        g.draw(mSkyboxMesh);

        glDepthMask(depthMask);
        glDepthFunc(depthFunc);
        glBindTexture(GL_TEXTURE_2D, 0);
    }

    ShaderProgram& reflectShader() { return mReflectShader; }

    void beginReflect(Graphics& g, const Vec3f& cameraPos, float reflectivity = 0.8f) {
        if (!mReady) return;

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

    void endReflect() {
        glBindTexture(GL_TEXTURE_2D, 0);
    }

    void bind(int unit = 0) {
        if (!mReady || !mCreated) return;
        uploadIfNeeded();
        glActiveTexture(GL_TEXTURE0 + unit);
        glBindTexture(GL_TEXTURE_2D, mTextureId);
    }

    void unbind(int unit = 0) {
        glActiveTexture(GL_TEXTURE0 + unit);
        glBindTexture(GL_TEXTURE_2D, 0);
    }

    bool ready() const { return mReady && mCreated; }

    float exposure() const { return mExposure; }
    void exposure(float e) { mExposure = e; }

    float gamma() const { return mGamma; }
    void gamma(float g) { mGamma = g; }

    const NativeHDR& hdr() const { return mHdr; }
    GLuint textureId() const { return mTextureId; }
    const std::string& url() const { return mUrl; }

    void sample(float dx, float dy, float dz, float& r, float& g, float& b) const {
        mHdr.sampleDirection(dx, dy, dz, r, g, b);
    }

private:
    void createSkyboxMesh() {
        mSkyboxMesh.reset();
        mSkyboxMesh.primitive(Mesh::TRIANGLES);

        float s = 1.0f;

        Vec3f vertices[8] = {
            {-s, -s, -s}, {+s, -s, -s}, {+s, +s, -s}, {-s, +s, -s},
            {-s, -s, +s}, {+s, -s, +s}, {+s, +s, +s}, {-s, +s, +s}
        };

        int faces[6][4] = {
            {0, 1, 2, 3}, {5, 4, 7, 6},
            {4, 0, 3, 7}, {1, 5, 6, 2},
            {3, 2, 6, 7}, {4, 5, 1, 0}
        };

        for (int i = 0; i < 6; i++) {
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

        glBindTexture(GL_TEXTURE_2D, mTextureId);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB16F,
                     mHdr.width(), mHdr.height(), 0,
                     GL_RGB, GL_FLOAT, mHdr.pixels());
        glBindTexture(GL_TEXTURE_2D, 0);

        mNeedsUpload = false;
        printf("[NativeEnvironment] Uploaded HDR texture: %dx%d\n", mHdr.width(), mHdr.height());
    }

    std::string mUrl;
    NativeHDR mHdr;
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

// Alias for cross-platform compatibility
using WebEnvironment = NativeEnvironment;

} // namespace al

#endif // AL_NATIVE_ENVIRONMENT_HPP
