/**
 * Web PBR Material System
 *
 * Physically Based Rendering with Image-Based Lighting for WebGL2.
 * Implements the metallic-roughness workflow with IBL support.
 *
 * Usage:
 *   WebPBR pbr;
 *   pbr.loadEnvironment("/assets/environments/studio.hdr");
 *
 *   // In onCreate
 *   pbr.create(g);
 *
 *   // In onDraw
 *   pbr.drawSkybox(g);
 *
 *   PBRMaterial material;
 *   material.albedo = Color(1, 0.8, 0.6);
 *   material.metallic = 0.9;
 *   material.roughness = 0.2;
 *
 *   pbr.begin(g, nav().pos());
 *   pbr.material(material);
 *   g.draw(mesh);
 *   pbr.end();
 */

#ifndef AL_WEB_PBR_HPP
#define AL_WEB_PBR_HPP

#include <emscripten.h>
#include <string>
#include <vector>
#include <cmath>
#include <functional>

#include "al_WebHDR.hpp"
#include "al/graphics/al_Mesh.hpp"
#include "al/graphics/al_Shader.hpp"
#include "al/graphics/al_Graphics.hpp"
#include "al/graphics/al_OpenGL.hpp"  // Uses our GLAD stub for Emscripten
#include "al/math/al_Vec.hpp"
#include "al/math/al_Matrix4.hpp"

namespace al {

/**
 * PBR Material properties (metallic-roughness workflow)
 */
struct PBRMaterial {
    Vec3f albedo{0.8f, 0.8f, 0.8f};  // Base color
    float metallic{0.0f};             // 0 = dielectric, 1 = metal
    float roughness{0.5f};            // 0 = smooth, 1 = rough
    float ao{1.0f};                   // Ambient occlusion
    Vec3f emission{0.0f, 0.0f, 0.0f}; // Emissive color

    PBRMaterial() = default;

    PBRMaterial(const Vec3f& albedo_, float metallic_, float roughness_)
        : albedo(albedo_), metallic(metallic_), roughness(roughness_) {}

    // Preset materials
    static PBRMaterial Gold() {
        return PBRMaterial(Vec3f(1.0f, 0.765f, 0.336f), 1.0f, 0.1f);
    }
    static PBRMaterial Silver() {
        return PBRMaterial(Vec3f(0.972f, 0.960f, 0.915f), 1.0f, 0.1f);
    }
    static PBRMaterial Copper() {
        return PBRMaterial(Vec3f(0.955f, 0.637f, 0.538f), 1.0f, 0.15f);
    }
    static PBRMaterial Iron() {
        return PBRMaterial(Vec3f(0.560f, 0.570f, 0.580f), 1.0f, 0.3f);
    }
    static PBRMaterial Plastic() {
        return PBRMaterial(Vec3f(0.8f, 0.2f, 0.2f), 0.0f, 0.4f);
    }
    static PBRMaterial Rubber() {
        return PBRMaterial(Vec3f(0.1f, 0.1f, 0.1f), 0.0f, 0.9f);
    }
    static PBRMaterial Ceramic() {
        return PBRMaterial(Vec3f(0.95f, 0.95f, 0.95f), 0.0f, 0.1f);
    }
    static PBRMaterial Wood() {
        return PBRMaterial(Vec3f(0.5f, 0.35f, 0.2f), 0.0f, 0.7f);
    }
};

/**
 * PBR vertex shader
 * Uses view space for calculations, passes data needed for IBL
 */
inline std::string pbr_vert_shader() {
    return R"(#version 300 es
precision highp float;
precision highp int;

layout (location = 0) in vec3 position;
layout (location = 3) in vec3 normal;
layout (location = 2) in vec2 texcoord;

uniform mat4 al_ModelViewMatrix;
uniform mat4 al_ProjectionMatrix;

out vec3 vViewPos;
out vec3 vViewNormal;
out vec3 vLocalPos;  // Local position for computing normals if needed
out vec2 vTexCoord;

void main() {
    vec4 viewPos = al_ModelViewMatrix * vec4(position, 1.0);
    vViewPos = viewPos.xyz;
    vLocalPos = position;  // Pass local position

    // Compute normal from position (works for spheres at origin)
    vec3 objNormal = normalize(position);

    // Transform normal to view space using upper-left 3x3 of ModelViewMatrix
    // This is equivalent to al_NormalMatrix for uniform scaling
    mat3 normalMatrix = mat3(al_ModelViewMatrix);
    vViewNormal = normalize(normalMatrix * objNormal);

    vTexCoord = texcoord;
    gl_Position = al_ProjectionMatrix * viewPos;
}
)";
}

/**
 * PBR fragment shader with IBL
 * Works in view space, uses inverse view rotation to transform to world space for env sampling
 */
inline std::string pbr_frag_shader() {
    return R"(#version 300 es
precision highp float;
precision highp int;

in vec3 vViewPos;
in vec3 vViewNormal;
in vec3 vLocalPos;  // Local position (for computing normals if needed)
in vec2 vTexCoord;

// Material properties
uniform vec3 albedo;
uniform float metallic;
uniform float roughness;
uniform float ao;
uniform vec3 emission;

// IBL textures
uniform sampler2D envMap;        // HDR environment
uniform sampler2D irradianceMap; // Diffuse IBL
uniform sampler2D brdfLUT;       // BRDF lookup

// Camera - inverse view rotation to go from view space to world space
uniform mat3 invViewRot;

// Lighting
uniform float envIntensity;
uniform float exposure;
uniform float gamma;

out vec4 frag_color;

const float PI = 3.14159265359;

// Equirectangular mapping (world space direction to UV)
vec2 directionToUV(vec3 dir) {
    float phi = atan(dir.z, dir.x);
    float theta = acos(clamp(dir.y, -1.0, 1.0));
    return vec2((phi + PI) / (2.0 * PI), theta / PI);
}

// Fresnel-Schlick approximation
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Fresnel with roughness for IBL
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Sample pre-filtered environment at roughness level
vec3 sampleEnvLOD(vec3 worldDir, float roughness) {
    vec2 uv = directionToUV(worldDir);
    vec3 color = texture(envMap, uv).rgb;

    // Approximate roughness blur by averaging nearby samples
    if (roughness > 0.1) {
        float blur = roughness * 0.03;
        color += texture(envMap, uv + vec2(blur, 0.0)).rgb;
        color += texture(envMap, uv + vec2(-blur, 0.0)).rgb;
        color += texture(envMap, uv + vec2(0.0, blur)).rgb;
        color += texture(envMap, uv + vec2(0.0, -blur)).rgb;
        color /= 5.0;
    }

    return color;
}

void main() {
    // Everything in view space first
    vec3 N = normalize(vViewNormal);
    vec3 V = normalize(-vViewPos);  // In view space, camera is at origin
    vec3 R = reflect(-V, N);

    // Transform directions to world space for environment sampling
    vec3 worldN = invViewRot * N;
    vec3 worldR = invViewRot * R;

    // Calculate reflectance at normal incidence
    vec3 F0 = vec3(0.04); // Default for dielectrics
    F0 = mix(F0, albedo, metallic);

    // ========== IBL Diffuse ==========
    vec2 irradianceUV = directionToUV(worldN);
    vec3 irradiance = texture(irradianceMap, irradianceUV).rgb;

    // Fallback: if irradiance map weak, sample env with blur
    if (length(irradiance) < 0.001) {
        vec3 up = abs(worldN.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 tangent = normalize(cross(up, worldN));
        vec3 bitangent = cross(worldN, tangent);

        irradiance = texture(envMap, directionToUV(worldN)).rgb * 0.3;
        irradiance += texture(envMap, directionToUV(normalize(worldN + tangent * 0.5))).rgb * 0.15;
        irradiance += texture(envMap, directionToUV(normalize(worldN - tangent * 0.5))).rgb * 0.15;
        irradiance += texture(envMap, directionToUV(normalize(worldN + bitangent * 0.5))).rgb * 0.15;
        irradiance += texture(envMap, directionToUV(normalize(worldN - bitangent * 0.5))).rgb * 0.15;
        irradiance += texture(envMap, directionToUV(normalize(worldN + vec3(0.0, 0.5, 0.0)))).rgb * 0.1;
    }

    float NdotV = max(dot(N, V), 0.0);
    vec3 kS = fresnelSchlickRoughness(NdotV, F0, roughness);
    vec3 kD = 1.0 - kS;
    kD *= 1.0 - metallic; // Metals have no diffuse

    vec3 diffuse = irradiance * albedo;

    // ========== IBL Specular ==========
    vec3 prefilteredColor = sampleEnvLOD(worldR, roughness);

    // BRDF lookup
    vec2 brdfUV = vec2(NdotV, roughness);
    vec2 brdf = texture(brdfLUT, brdfUV).rg;

    // If BRDF LUT not available, use approximation
    if (brdf.x < 0.001 && brdf.y < 0.001) {
        float a = roughness * roughness;
        brdf.x = 1.0 - a * 0.5;
        brdf.y = a * 0.5;
    }

    vec3 specular = prefilteredColor * (kS * brdf.x + brdf.y);

    // ========== Combine ==========
    vec3 ambient = (kD * diffuse + specular) * ao * envIntensity;
    vec3 color = ambient + emission;

    // Tone mapping (Reinhard)
    color *= exposure;
    color = color / (vec3(1.0) + color);

    // Gamma correction
    color = pow(color, vec3(1.0 / gamma));

    frag_color = vec4(color, 1.0);
}
)";
}

/**
 * Skybox shader for PBR (same as WebEnvironment)
 */
inline std::string pbr_skybox_vert() {
    return R"(#version 300 es
precision highp float;

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

inline std::string pbr_skybox_frag() {
    return R"(#version 300 es
precision highp float;

in vec3 vDirection;
uniform sampler2D envMap;
uniform float exposure;
uniform float gamma;
out vec4 frag_color;

const float PI = 3.14159265359;

void main() {
    vec3 dir = normalize(vDirection);
    float phi = atan(dir.z, dir.x);
    float theta = acos(dir.y);
    vec2 uv = vec2((phi + PI) / (2.0 * PI), theta / PI);

    vec3 color = texture(envMap, uv).rgb * exposure;
    color = color / (vec3(1.0) + color);
    color = pow(color, vec3(1.0 / gamma));

    frag_color = vec4(color, 1.0);
}
)";
}

/**
 * Fallback PBR shader (no IBL, uses simple analytical lighting)
 * Works in view space like the main PBR shader
 */
inline std::string pbr_fallback_frag_shader() {
    return R"(#version 300 es
precision highp float;

in vec3 vViewPos;
in vec3 vViewNormal;
in vec3 vLocalPos;  // Local position (for computing normals if needed)
in vec2 vTexCoord;

uniform vec3 albedo;
uniform float metallic;
uniform float roughness;
uniform float ao;
uniform vec3 emission;
uniform float envIntensity;
uniform float exposure;
uniform float gamma;

out vec4 frag_color;

const float PI = 3.14159265359;

// Fresnel-Schlick
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// GGX NDF
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    return a2 / (PI * denom * denom);
}

// Schlick-GGX
float geometrySchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

void main() {
    // Use view-space normal (computed in vertex shader)
    vec3 N = normalize(vViewNormal);
    vec3 V = normalize(-vViewPos);  // In view space, camera is at origin

    // DEBUG: If normal is zero, show red
    if (length(vViewNormal) < 0.001) {
        frag_color = vec4(1.0, 0.0, 0.0, 1.0);
        return;
    }

    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, metallic);

    // Simple 3-point lighting (positions in view space - negative Z is forward)
    vec3 lightPositions[3];
    lightPositions[0] = vec3(3.0, 3.0, 2.0);   // Key light (behind-right-above viewer)
    lightPositions[1] = vec3(-3.0, 2.0, 0.0);  // Fill light (left of viewer)
    lightPositions[2] = vec3(0.0, -2.0, 1.0);  // Rim light (below-behind viewer)

    vec3 lightColors[3];
    lightColors[0] = vec3(1.0, 0.95, 0.9) * 8.0;  // Key light (warm, stronger)
    lightColors[1] = vec3(0.6, 0.7, 1.0) * 4.0;   // Fill light (cool)
    lightColors[2] = vec3(0.5, 0.5, 0.5) * 2.0;   // Rim light

    vec3 Lo = vec3(0.0);

    for (int i = 0; i < 3; i++) {
        vec3 L = normalize(lightPositions[i] - vViewPos);
        vec3 H = normalize(V + L);
        float distance = length(lightPositions[i] - vViewPos);
        float attenuation = 1.0 / (1.0 + distance * distance * 0.1);  // Less aggressive falloff
        vec3 radiance = lightColors[i] * attenuation;

        float NDF = distributionGGX(N, H, roughness);
        float G = geometrySmith(N, V, L, roughness);
        vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

        vec3 kD = (vec3(1.0) - F) * (1.0 - metallic);

        vec3 numerator = NDF * G * F;
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
        vec3 specular = numerator / denominator;

        float NdotL = max(dot(N, L), 0.0);
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;
    }

    // Stronger ambient for visibility
    vec3 ambient = vec3(0.2, 0.2, 0.25) * albedo * ao;
    ambient += vec3(0.15, 0.12, 0.1) * max(N.y, 0.0) * albedo * ao;

    vec3 color = ambient + Lo * envIntensity + emission;

    // Tone mapping and gamma
    color *= exposure;
    color = color / (vec3(1.0) + color);
    color = pow(color, vec3(1.0 / gamma));

    frag_color = vec4(color, 1.0);
}
)";
}

/**
 * Fallback skybox shader (gradient sky)
 */
inline std::string pbr_fallback_skybox_frag() {
    return R"(#version 300 es
precision highp float;

in vec3 vDirection;
uniform float exposure;
uniform float gamma;
out vec4 frag_color;

void main() {
    vec3 dir = normalize(vDirection);

    // Gradient sky - brighter colors for visibility
    float t = dir.y * 0.5 + 0.5;
    vec3 skyColor = mix(
        vec3(0.4, 0.35, 0.3),   // Horizon (warm tan)
        vec3(0.2, 0.3, 0.5),    // Zenith (blue)
        t
    );

    // Ground - darker
    if (dir.y < 0.0) {
        skyColor = mix(vec3(0.15, 0.12, 0.1), skyColor, 1.0 + dir.y * 2.0);
    }

    vec3 color = skyColor * exposure;
    color = pow(color, vec3(1.0 / gamma));

    frag_color = vec4(color, 1.0);
}
)";
}

/**
 * PBR rendering system with IBL
 */
class WebPBR {
public:
    using LoadCallback = std::function<void(bool success)>;

    WebPBR() : mEnvTexture(0), mIrradianceTexture(0), mBrdfLUT(0),
               mReady(false), mEnvLoaded(false), mCreated(false),
               mLoggedRenderMode(false), mLastEnvState(false),
               mExposure(1.0f), mGamma(2.2f), mEnvIntensity(1.0f) {}

    ~WebPBR() {
        destroy();
    }

    /**
     * Load HDR environment
     */
    void loadEnvironment(const std::string& url) {
        mReady = false;
        mEnvLoaded = false;
        mUrl = url;

        printf("[WebPBR] Loading environment: %s\n", url.c_str());
        fflush(stdout);

        mHdr.load(url, [this](bool success) {
            if (success && mHdr.width() > 0 && mHdr.height() > 0) {
                mEnvLoaded = true;
                mReady = true;
                mNeedsUpload = true;
                printf("[WebPBR] Environment loaded: %s (%dx%d)\n",
                       mUrl.c_str(), mHdr.width(), mHdr.height());

                // Generate irradiance map
                generateIrradianceMap();

                if (mCallback) mCallback(true);
            } else {
                printf("[WebPBR] Failed to load: %s (using fallback lighting)\n", mUrl.c_str());
                // Still mark as ready to use fallback rendering
                mEnvLoaded = false;
                mReady = true;
                if (mCallback) mCallback(false);
            }
        });
    }

    void loadEnvironment(const std::string& url, LoadCallback callback) {
        mCallback = callback;
        loadEnvironment(url);
    }

    /**
     * Create GPU resources
     */
    void create(Graphics& g) {
        if (mCreated) return;

        // Create skybox mesh
        createSkyboxMesh();

        // Compile shaders (both IBL and fallback versions)
        printf("[WebPBR] Compiling PBR shader...\n");
        if (!mPbrShader.compile(pbr_vert_shader(), pbr_frag_shader())) {
            printf("[WebPBR] ERROR: PBR shader compilation failed!\n");
        }
        printf("[WebPBR] Compiling skybox shader...\n");
        if (!mSkyboxShader.compile(pbr_skybox_vert(), pbr_skybox_frag())) {
            printf("[WebPBR] ERROR: Skybox shader compilation failed!\n");
        }
        printf("[WebPBR] Compiling fallback PBR shader...\n");
        if (!mFallbackPbrShader.compile(pbr_vert_shader(), pbr_fallback_frag_shader())) {
            printf("[WebPBR] ERROR: Fallback PBR shader compilation failed!\n");
        }
        printf("[WebPBR] Compiling fallback skybox shader...\n");
        if (!mFallbackSkyboxShader.compile(pbr_skybox_vert(), pbr_fallback_skybox_frag())) {
            printf("[WebPBR] ERROR: Fallback skybox shader compilation failed!\n");
        }
        printf("[WebPBR] All shaders compiled\n");

        // Create textures
        glGenTextures(1, &mEnvTexture);
        setupTexture(mEnvTexture);

        glGenTextures(1, &mIrradianceTexture);
        setupTexture(mIrradianceTexture);

        // Generate BRDF LUT
        generateBrdfLUT();

        mCreated = true;
        printf("[WebPBR] GPU resources created\n");
    }

    /**
     * Destroy GPU resources
     */
    void destroy() {
        if (mEnvTexture) glDeleteTextures(1, &mEnvTexture);
        if (mIrradianceTexture) glDeleteTextures(1, &mIrradianceTexture);
        if (mBrdfLUT) glDeleteTextures(1, &mBrdfLUT);
        mEnvTexture = mIrradianceTexture = mBrdfLUT = 0;
        mCreated = false;
    }

    /**
     * Draw skybox
     */
    void drawSkybox(Graphics& g) {
        // Lazy initialization (always create resources)
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

        if (mEnvLoaded) {
            g.shader(mSkyboxShader);
            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, mEnvTexture);
            mSkyboxShader.uniform("envMap", 0);
            mSkyboxShader.uniform("exposure", mExposure);
            mSkyboxShader.uniform("gamma", mGamma);
        } else {
            g.shader(mFallbackSkyboxShader);
            mFallbackSkyboxShader.uniform("exposure", mExposure);
            mFallbackSkyboxShader.uniform("gamma", mGamma);
        }

        g.draw(mSkyboxMesh);

        glDepthMask(depthMask);
        glDepthFunc(depthFunc);
        glBindTexture(GL_TEXTURE_2D, 0);
    }

    /**
     * Begin PBR rendering
     */
    void begin(Graphics& g, const Vec3f& cameraPos) {
        // Lazy initialization (always create resources)
        if (!mCreated) {
            create(g);
        }

        uploadIfNeeded();

        // Log render mode on first use or when it changes
        if (!mLoggedRenderMode || mLastEnvState != mEnvLoaded) {
            if (mEnvLoaded) {
                printf("[WebPBR] Using IBL lighting with HDR environment\n");
            } else {
                printf("[WebPBR] Using fallback analytical lighting\n");
            }
            mLoggedRenderMode = true;
            mLastEnvState = mEnvLoaded;
        }

        if (mEnvLoaded) {
            // Use IBL shader with HDR environment
            mActiveShader = &mPbrShader;
            g.shader(mPbrShader);

            // Bind textures
            glActiveTexture(GL_TEXTURE0);
            glBindTexture(GL_TEXTURE_2D, mEnvTexture);
            glActiveTexture(GL_TEXTURE1);
            glBindTexture(GL_TEXTURE_2D, mIrradianceTexture);
            glActiveTexture(GL_TEXTURE2);
            glBindTexture(GL_TEXTURE_2D, mBrdfLUT);

            mPbrShader.uniform("envMap", 0);
            mPbrShader.uniform("irradianceMap", 1);
            mPbrShader.uniform("brdfLUT", 2);
            mPbrShader.uniform("envIntensity", mEnvIntensity);
            mPbrShader.uniform("exposure", mExposure);
            mPbrShader.uniform("gamma", mGamma);

            // Pass inverse view rotation for environment sampling
            // For now, use identity (camera looking down -Z)
            float invViewRot[9] = {1,0,0, 0,1,0, 0,0,1};
            mPbrShader.uniformMatrix3("invViewRot", invViewRot);
        } else {
            // Use fallback analytical lighting
            mActiveShader = &mFallbackPbrShader;
            g.shader(mFallbackPbrShader);
            mFallbackPbrShader.uniform("envIntensity", mEnvIntensity);
            mFallbackPbrShader.uniform("exposure", mExposure);
            mFallbackPbrShader.uniform("gamma", mGamma);
        }

        // Set default material
        material(PBRMaterial());
    }

    /**
     * Set current material
     */
    void material(const PBRMaterial& mat) {
        // Use the currently active shader (set in begin())
        ShaderProgram& shader = mActiveShader ? *mActiveShader : mFallbackPbrShader;
        shader.uniform("albedo", mat.albedo);
        shader.uniform("metallic", mat.metallic);
        shader.uniform("roughness", mat.roughness);
        shader.uniform("ao", mat.ao);
        shader.uniform("emission", mat.emission);

    }

    /**
     * End PBR rendering
     */
    void end() {
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, 0);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, 0);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, 0);
    }

    // Accessors
    bool ready() const { return mCreated; }  // Can render even without HDR (uses fallback)
    bool envLoaded() const { return mEnvLoaded; }  // True only if HDR loaded successfully

    float exposure() const { return mExposure; }
    void exposure(float e) { mExposure = e; }

    float gamma() const { return mGamma; }
    void gamma(float g) { mGamma = g; }

    float envIntensity() const { return mEnvIntensity; }
    void envIntensity(float i) { mEnvIntensity = i; }

    ShaderProgram& shader() { return mPbrShader; }

private:
    void setupTexture(GLuint tex) {
        glBindTexture(GL_TEXTURE_2D, tex);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glBindTexture(GL_TEXTURE_2D, 0);
    }

    void createSkyboxMesh() {
        mSkyboxMesh.reset();
        mSkyboxMesh.primitive(Mesh::TRIANGLES);

        float s = 1.0f;
        Vec3f verts[8] = {
            {-s, -s, -s}, {+s, -s, -s}, {+s, +s, -s}, {-s, +s, -s},
            {-s, -s, +s}, {+s, -s, +s}, {+s, +s, +s}, {-s, +s, +s}
        };
        int faces[6][4] = {
            {0, 1, 2, 3}, {5, 4, 7, 6}, {4, 0, 3, 7},
            {1, 5, 6, 2}, {3, 2, 6, 7}, {4, 5, 1, 0}
        };

        for (int i = 0; i < 6; i++) {
            mSkyboxMesh.vertex(verts[faces[i][0]]);
            mSkyboxMesh.vertex(verts[faces[i][1]]);
            mSkyboxMesh.vertex(verts[faces[i][2]]);
            mSkyboxMesh.vertex(verts[faces[i][0]]);
            mSkyboxMesh.vertex(verts[faces[i][2]]);
            mSkyboxMesh.vertex(verts[faces[i][3]]);
        }
    }

    void uploadIfNeeded() {
        if (!mNeedsUpload || !mReady) return;

        // Upload environment map
        glBindTexture(GL_TEXTURE_2D, mEnvTexture);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB16F,
                     mHdr.width(), mHdr.height(), 0,
                     GL_RGB, GL_FLOAT, mHdr.pixels());

        // Upload irradiance map
        glBindTexture(GL_TEXTURE_2D, mIrradianceTexture);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB16F,
                     mIrradianceWidth, mIrradianceHeight, 0,
                     GL_RGB, GL_FLOAT, mIrradianceData.data());

        glBindTexture(GL_TEXTURE_2D, 0);
        mNeedsUpload = false;

        printf("[WebPBR] Uploaded textures\n");
    }

    /**
     * Generate diffuse irradiance map by convolving environment
     */
    void generateIrradianceMap() {
        // Lower resolution for irradiance
        mIrradianceWidth = std::min(128, mHdr.width() / 4);
        mIrradianceHeight = std::min(64, mHdr.height() / 4);
        mIrradianceData.resize(mIrradianceWidth * mIrradianceHeight * 3);

        printf("[WebPBR] Generating irradiance map %dx%d...\n",
               mIrradianceWidth, mIrradianceHeight);

        // For each pixel in irradiance map
        for (int y = 0; y < mIrradianceHeight; y++) {
            for (int x = 0; x < mIrradianceWidth; x++) {
                // Convert pixel to direction
                float u = (x + 0.5f) / mIrradianceWidth;
                float v = (y + 0.5f) / mIrradianceHeight;

                float phi = u * 2.0f * M_PI - M_PI;
                float theta = v * M_PI;

                Vec3f N(
                    sinf(theta) * cosf(phi),
                    cosf(theta),
                    sinf(theta) * sinf(phi)
                );

                // Convolve hemisphere
                Vec3f irradiance(0, 0, 0);
                int sampleCount = 0;

                // Simplified convolution with fewer samples
                const int numSamples = 64;
                for (int i = 0; i < numSamples; i++) {
                    // Cosine-weighted hemisphere sampling
                    float xi1 = (float)(i % 8) / 8.0f;
                    float xi2 = (float)(i / 8) / 8.0f;

                    float samplePhi = 2.0f * M_PI * xi1;
                    float sampleTheta = acosf(sqrtf(1.0f - xi2));

                    // Transform to world space around N
                    Vec3f up = fabsf(N.y) < 0.999f ? Vec3f(0, 1, 0) : Vec3f(1, 0, 0);
                    Vec3f tangent = cross(up, N).normalize();
                    Vec3f bitangent = cross(N, tangent);

                    Vec3f sampleDir =
                        tangent * sinf(sampleTheta) * cosf(samplePhi) +
                        bitangent * sinf(sampleTheta) * sinf(samplePhi) +
                        N * cosf(sampleTheta);

                    float r, g, b;
                    mHdr.sampleDirection(sampleDir.x, sampleDir.y, sampleDir.z, r, g, b);

                    irradiance.x += r;
                    irradiance.y += g;
                    irradiance.z += b;
                    sampleCount++;
                }

                irradiance = irradiance * (M_PI / sampleCount);

                int idx = (y * mIrradianceWidth + x) * 3;
                mIrradianceData[idx + 0] = irradiance.x;
                mIrradianceData[idx + 1] = irradiance.y;
                mIrradianceData[idx + 2] = irradiance.z;
            }
        }

        printf("[WebPBR] Irradiance map generated\n");
    }

    /**
     * Generate BRDF integration LUT
     */
    void generateBrdfLUT() {
        const int size = 256;
        std::vector<float> lutData(size * size * 2);

        printf("[WebPBR] Generating BRDF LUT %dx%d...\n", size, size);

        for (int y = 0; y < size; y++) {
            float roughness = (y + 0.5f) / size;

            for (int x = 0; x < size; x++) {
                float NdotV = (x + 0.5f) / size;
                NdotV = std::max(NdotV, 0.001f);

                // Integrate BRDF
                Vec3f V(sqrtf(1.0f - NdotV * NdotV), 0.0f, NdotV);
                Vec3f N(0.0f, 0.0f, 1.0f);

                float A = 0.0f;
                float B = 0.0f;

                const int numSamples = 64;
                for (int i = 0; i < numSamples; i++) {
                    float xi1 = (float)(i % 8) / 8.0f;
                    float xi2 = (float)(i / 8) / 8.0f;

                    // Importance sample GGX
                    float a = roughness * roughness;
                    float phi = 2.0f * M_PI * xi1;
                    float cosTheta = sqrtf((1.0f - xi2) / (1.0f + (a * a - 1.0f) * xi2));
                    float sinTheta = sqrtf(1.0f - cosTheta * cosTheta);

                    Vec3f H(sinTheta * cosf(phi), sinTheta * sinf(phi), cosTheta);
                    Vec3f L = H * 2.0f * dot(V, H) - V;

                    float NdotL = std::max(L.z, 0.0f);
                    float NdotH = std::max(H.z, 0.0f);
                    float VdotH = std::max(dot(V, H), 0.0f);

                    if (NdotL > 0.0f) {
                        // Geometry term
                        float k = (roughness * roughness) / 2.0f;
                        float G_V = NdotV / (NdotV * (1.0f - k) + k);
                        float G_L = NdotL / (NdotL * (1.0f - k) + k);
                        float G = G_V * G_L;

                        float G_Vis = (G * VdotH) / (NdotH * NdotV);
                        float Fc = powf(1.0f - VdotH, 5.0f);

                        A += (1.0f - Fc) * G_Vis;
                        B += Fc * G_Vis;
                    }
                }

                A /= numSamples;
                B /= numSamples;

                int idx = (y * size + x) * 2;
                lutData[idx + 0] = A;
                lutData[idx + 1] = B;
            }
        }

        // Upload to GPU
        glGenTextures(1, &mBrdfLUT);
        glBindTexture(GL_TEXTURE_2D, mBrdfLUT);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RG16F, size, size, 0, GL_RG, GL_FLOAT, lutData.data());
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glBindTexture(GL_TEXTURE_2D, 0);

        printf("[WebPBR] BRDF LUT generated\n");
    }

    std::string mUrl;
    WebHDR mHdr;
    GLuint mEnvTexture;
    GLuint mIrradianceTexture;
    GLuint mBrdfLUT;
    Mesh mSkyboxMesh;
    ShaderProgram mPbrShader;
    ShaderProgram mSkyboxShader;
    ShaderProgram mFallbackPbrShader;     // Analytical lighting fallback
    ShaderProgram mFallbackSkyboxShader;  // Gradient sky fallback
    ShaderProgram* mActiveShader = nullptr;  // Currently active PBR shader

    std::vector<float> mIrradianceData;
    int mIrradianceWidth = 0;
    int mIrradianceHeight = 0;

    bool mReady;
    bool mEnvLoaded;    // True only if HDR environment loaded successfully
    bool mCreated;
    bool mNeedsUpload = false;
    bool mLoggedRenderMode;  // Track if we've logged the render mode
    bool mLastEnvState;      // Track last env state to detect changes
    float mExposure;
    float mGamma;
    float mEnvIntensity;
    LoadCallback mCallback;
};

} // namespace al

#endif // AL_WEB_PBR_HPP
