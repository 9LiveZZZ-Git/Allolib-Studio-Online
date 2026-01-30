/**
 * Web Procedural Texture Generation
 *
 * CPU-based procedural texture generators for noise, patterns, and effects.
 * Generates texture data that can be uploaded to GPU.
 *
 * Usage:
 *   ProceduralTexture tex;
 *   tex.perlinNoise(512, 512, 4.0f, 6);
 *   tex.uploadToTexture(gpuTexture);
 *
 * Or use presets for complete PBR materials:
 *   ProceduralTexture albedo, normal, roughness;
 *   ProceduralPresets::generateBrickPBR(albedo, normal, roughness, ao, 1024);
 */

#ifndef AL_WEB_PROCEDURAL_HPP
#define AL_WEB_PROCEDURAL_HPP

#include <vector>
#include <cstdint>
#include <cmath>
#include <functional>
#include <random>
#include <algorithm>

// Use allolib's OpenGL header which properly handles GLAD
#include "al/graphics/al_OpenGL.hpp"

namespace al {

/**
 * Procedural texture generator
 */
class ProceduralTexture {
public:
    ProceduralTexture() : mWidth(0), mHeight(0), mChannels(4) {
        initPermutation(0);
    }

    // ========== Noise Generators ==========

    /**
     * Generate Perlin noise texture
     * @param width/height Texture dimensions
     * @param scale Noise scale (higher = more detail)
     * @param octaves Number of noise octaves (FBM)
     * @param persistence Amplitude reduction per octave
     */
    void perlinNoise(int width, int height, float scale = 4.0f,
                     int octaves = 6, float persistence = 0.5f) {
        resize(width, height);

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                float nx = (float)x / width * scale;
                float ny = (float)y / height * scale;

                float value = fbm(nx, ny, octaves, persistence);
                value = (value + 1.0f) * 0.5f;  // Normalize to 0-1

                uint8_t v = (uint8_t)(std::clamp(value, 0.0f, 1.0f) * 255);
                setPixel(x, y, v, v, v, 255);
            }
        }
    }

    /**
     * Generate Simplex noise texture (similar to Perlin but faster)
     */
    void simplexNoise(int width, int height, float scale = 4.0f,
                      int octaves = 6, float persistence = 0.5f) {
        // Use Perlin as fallback (simplex implementation is more complex)
        perlinNoise(width, height, scale, octaves, persistence);
    }

    /**
     * Generate Worley/Voronoi cellular noise
     * @param cellCount Number of cells
     * @param mode 0=F1 (distance to nearest), 1=F2-F1 (edge), 2=cell ID
     */
    void worleyNoise(int width, int height, int cellCount = 16, int mode = 0) {
        resize(width, height);

        // Generate random cell centers
        std::vector<float> cellsX(cellCount), cellsY(cellCount);
        std::mt19937 rng(42);
        std::uniform_real_distribution<float> dist(0.0f, 1.0f);

        for (int i = 0; i < cellCount; i++) {
            cellsX[i] = dist(rng);
            cellsY[i] = dist(rng);
        }

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                float px = (float)x / width;
                float py = (float)y / height;

                // Find two nearest cell centers
                float d1 = 1000.0f, d2 = 1000.0f;
                int nearestCell = 0;

                for (int i = 0; i < cellCount; i++) {
                    // Check 3x3 grid for tiling
                    for (int ox = -1; ox <= 1; ox++) {
                        for (int oy = -1; oy <= 1; oy++) {
                            float cx = cellsX[i] + ox;
                            float cy = cellsY[i] + oy;
                            float d = sqrtf((px - cx) * (px - cx) + (py - cy) * (py - cy));
                            if (d < d1) {
                                d2 = d1;
                                d1 = d;
                                nearestCell = i;
                            } else if (d < d2) {
                                d2 = d;
                            }
                        }
                    }
                }

                float value;
                switch (mode) {
                    case 0: value = d1 * 2.0f; break;  // F1
                    case 1: value = (d2 - d1) * 4.0f; break;  // F2-F1 (edges)
                    case 2: value = (float)nearestCell / cellCount; break;  // Cell ID
                    default: value = d1 * 2.0f;
                }

                value = std::clamp(value, 0.0f, 1.0f);
                uint8_t v = (uint8_t)(value * 255);
                setPixel(x, y, v, v, v, 255);
            }
        }
    }

    // ========== Pattern Generators ==========

    /**
     * Generate checkerboard pattern
     */
    void checkerboard(int width, int height, int checkSize = 32,
                      uint32_t color1 = 0xFFFFFFFF, uint32_t color2 = 0xFF000000) {
        resize(width, height);

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                bool check = ((x / checkSize) + (y / checkSize)) % 2 == 0;
                uint32_t c = check ? color1 : color2;
                setPixelRGBA(x, y, c);
            }
        }
    }

    /**
     * Generate gradient (linear)
     */
    void linearGradient(int width, int height,
                        uint32_t colorStart, uint32_t colorEnd,
                        float angle = 0.0f) {
        resize(width, height);

        float cosA = cosf(angle);
        float sinA = sinf(angle);

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                float nx = (float)x / width - 0.5f;
                float ny = (float)y / height - 0.5f;
                float t = (nx * cosA + ny * sinA) + 0.5f;
                t = std::clamp(t, 0.0f, 1.0f);

                setPixelRGBA(x, y, lerpColor(colorStart, colorEnd, t));
            }
        }
    }

    /**
     * Generate radial gradient
     */
    void radialGradient(int width, int height,
                        uint32_t colorCenter, uint32_t colorEdge) {
        resize(width, height);

        float cx = width * 0.5f;
        float cy = height * 0.5f;
        float maxDist = sqrtf(cx * cx + cy * cy);

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                float dx = x - cx;
                float dy = y - cy;
                float t = sqrtf(dx * dx + dy * dy) / maxDist;
                t = std::clamp(t, 0.0f, 1.0f);

                setPixelRGBA(x, y, lerpColor(colorCenter, colorEdge, t));
            }
        }
    }

    /**
     * Generate brick/tile pattern
     */
    void brickPattern(int width, int height,
                      int brickWidth = 64, int brickHeight = 32,
                      int mortarWidth = 4,
                      uint32_t brickColor = 0xFFC25A3C,
                      uint32_t mortarColor = 0xFF808080) {
        resize(width, height);

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                // Offset every other row
                int row = y / brickHeight;
                int xOffset = (row % 2) * (brickWidth / 2);
                int bx = (x + xOffset) % brickWidth;
                int by = y % brickHeight;

                // Check if in mortar
                bool inMortar = (bx < mortarWidth) || (by < mortarWidth);

                if (inMortar) {
                    setPixelRGBA(x, y, mortarColor);
                } else {
                    // Add some noise to brick color
                    float noise = perlin2D(x * 0.1f, y * 0.1f) * 0.1f + 0.95f;
                    setPixelRGBA(x, y, scaleColor(brickColor, noise));
                }
            }
        }
    }

    /**
     * Generate wood grain texture
     */
    void woodGrain(int width, int height,
                   float grainScale = 10.0f, float ringFreq = 20.0f) {
        resize(width, height);

        uint32_t lightWood = 0xFFD4A574;
        uint32_t darkWood = 0xFF8B5A2B;

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                float nx = (float)x / width;
                float ny = (float)y / height;

                // Create ring pattern
                float dist = sqrtf(nx * nx + ny * ny);
                float rings = sinf(dist * ringFreq + fbm(nx * grainScale, ny * grainScale, 4, 0.5f) * 3.0f);
                rings = (rings + 1.0f) * 0.5f;

                // Add grain noise
                float grain = fbm(nx * grainScale * 2, ny * grainScale * 0.5f, 3, 0.5f);
                grain = (grain + 1.0f) * 0.5f * 0.2f;

                float t = std::clamp(rings + grain, 0.0f, 1.0f);
                setPixelRGBA(x, y, lerpColor(lightWood, darkWood, t));
            }
        }
    }

    /**
     * Generate marble texture
     */
    void marble(int width, int height,
                float scale = 3.0f, float turbulence = 5.0f) {
        resize(width, height);

        uint32_t white = 0xFFF0F0F0;
        uint32_t gray = 0xFF404040;

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                float nx = (float)x / width * scale;
                float ny = (float)y / height * scale;

                float turb = fbm(nx * turbulence, ny * turbulence, 6, 0.5f);
                float value = sinf(nx * 10.0f + turb * 5.0f);
                value = (value + 1.0f) * 0.5f;

                setPixelRGBA(x, y, lerpColor(white, gray, value));
            }
        }
    }

    // ========== PBR Map Generation ==========

    /**
     * Generate normal map from height data
     * @param strength Normal map strength (1.0 = standard)
     */
    void normalMapFromHeight(int width, int height, float strength = 1.0f) {
        // Assumes current data is height map (grayscale)
        if (mPixels.empty()) return;

        std::vector<uint8_t> original = mPixels;

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                // Sample neighbors (with wrapping)
                float l = getGray(original, (x - 1 + width) % width, y, width);
                float r = getGray(original, (x + 1) % width, y, width);
                float t = getGray(original, x, (y - 1 + height) % height, width);
                float b = getGray(original, x, (y + 1) % height, width);

                // Calculate normal
                float dx = (r - l) * strength;
                float dy = (b - t) * strength;
                float dz = 1.0f;

                // Normalize
                float len = sqrtf(dx * dx + dy * dy + dz * dz);
                dx /= len;
                dy /= len;
                dz /= len;

                // Convert to 0-255 range (tangent space normal map)
                uint8_t nx = (uint8_t)((dx * 0.5f + 0.5f) * 255);
                uint8_t ny = (uint8_t)((dy * 0.5f + 0.5f) * 255);
                uint8_t nz = (uint8_t)((dz * 0.5f + 0.5f) * 255);

                setPixel(x, y, nx, ny, nz, 255);
            }
        }
    }

    /**
     * Generate roughness map from noise
     */
    void roughnessMap(int width, int height, float baseRoughness = 0.5f,
                      float variation = 0.3f) {
        resize(width, height);

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                float nx = (float)x / width * 8.0f;
                float ny = (float)y / height * 8.0f;

                float noise = fbm(nx, ny, 4, 0.5f);
                float value = baseRoughness + noise * variation;
                value = std::clamp(value, 0.0f, 1.0f);

                uint8_t v = (uint8_t)(value * 255);
                setPixel(x, y, v, v, v, 255);
            }
        }
    }

    // ========== Effects ==========

    /**
     * Make texture tile seamlessly
     */
    void applySeamless() {
        if (mPixels.empty()) return;

        std::vector<uint8_t> original = mPixels;
        int blendWidth = mWidth / 4;

        for (int y = 0; y < mHeight; y++) {
            for (int x = 0; x < mWidth; x++) {
                float bx = 1.0f, by = 1.0f;

                // Horizontal blend
                if (x < blendWidth) {
                    bx = (float)x / blendWidth;
                } else if (x >= mWidth - blendWidth) {
                    bx = (float)(mWidth - x) / blendWidth;
                }

                // Vertical blend
                if (y < blendWidth) {
                    by = (float)y / blendWidth;
                } else if (y >= mHeight - blendWidth) {
                    by = (float)(mHeight - y) / blendWidth;
                }

                float blend = std::min(bx, by);
                if (blend < 1.0f) {
                    int ox = (x + mWidth / 2) % mWidth;
                    int oy = (y + mHeight / 2) % mHeight;

                    size_t idx1 = (y * mWidth + x) * 4;
                    size_t idx2 = (oy * mWidth + ox) * 4;

                    for (int c = 0; c < 4; c++) {
                        mPixels[idx1 + c] = (uint8_t)(
                            original[idx1 + c] * blend +
                            original[idx2 + c] * (1.0f - blend)
                        );
                    }
                }
            }
        }
    }

    /**
     * Apply Gaussian blur
     */
    void applyBlur(int radius) {
        if (mPixels.empty() || radius <= 0) return;

        std::vector<uint8_t> temp = mPixels;

        // Simple box blur (faster approximation)
        for (int pass = 0; pass < 2; pass++) {
            // Horizontal
            for (int y = 0; y < mHeight; y++) {
                for (int x = 0; x < mWidth; x++) {
                    int r = 0, g = 0, b = 0, a = 0, count = 0;
                    for (int dx = -radius; dx <= radius; dx++) {
                        int sx = (x + dx + mWidth) % mWidth;
                        size_t idx = (y * mWidth + sx) * 4;
                        r += temp[idx];
                        g += temp[idx + 1];
                        b += temp[idx + 2];
                        a += temp[idx + 3];
                        count++;
                    }
                    size_t idx = (y * mWidth + x) * 4;
                    mPixels[idx] = r / count;
                    mPixels[idx + 1] = g / count;
                    mPixels[idx + 2] = b / count;
                    mPixels[idx + 3] = a / count;
                }
            }
            temp = mPixels;

            // Vertical
            for (int y = 0; y < mHeight; y++) {
                for (int x = 0; x < mWidth; x++) {
                    int r = 0, g = 0, b = 0, a = 0, count = 0;
                    for (int dy = -radius; dy <= radius; dy++) {
                        int sy = (y + dy + mHeight) % mHeight;
                        size_t idx = (sy * mWidth + x) * 4;
                        r += temp[idx];
                        g += temp[idx + 1];
                        b += temp[idx + 2];
                        a += temp[idx + 3];
                        count++;
                    }
                    size_t idx = (y * mWidth + x) * 4;
                    mPixels[idx] = r / count;
                    mPixels[idx + 1] = g / count;
                    mPixels[idx + 2] = b / count;
                    mPixels[idx + 3] = a / count;
                }
            }
            temp = mPixels;
        }
    }

    /**
     * Custom procedural with callback
     */
    void custom(int width, int height,
                std::function<uint32_t(int x, int y, float u, float v)> generator) {
        resize(width, height);

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                float u = (float)x / width;
                float v = (float)y / height;
                setPixelRGBA(x, y, generator(x, y, u, v));
            }
        }
    }

    // ========== Data Access ==========

    const uint8_t* pixels() const { return mPixels.data(); }
    std::vector<uint8_t>& pixelData() { return mPixels; }
    int width() const { return mWidth; }
    int height() const { return mHeight; }
    int channels() const { return mChannels; }

    /**
     * Upload to OpenGL texture
     */
    void uploadToTexture(GLuint textureId) {
        glBindTexture(GL_TEXTURE_2D, textureId);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8,
                     mWidth, mHeight, 0,
                     GL_RGBA, GL_UNSIGNED_BYTE, mPixels.data());
        glGenerateMipmap(GL_TEXTURE_2D);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
        glBindTexture(GL_TEXTURE_2D, 0);
    }

    /**
     * Create and upload to new texture
     */
    GLuint createTexture() {
        GLuint texId;
        glGenTextures(1, &texId);
        uploadToTexture(texId);
        return texId;
    }

private:
    std::vector<uint8_t> mPixels;
    int mWidth, mHeight, mChannels;
    std::vector<int> mPerm;

    void resize(int w, int h) {
        mWidth = w;
        mHeight = h;
        mPixels.resize(w * h * 4);
    }

    void setPixel(int x, int y, uint8_t r, uint8_t g, uint8_t b, uint8_t a) {
        size_t idx = (y * mWidth + x) * 4;
        mPixels[idx] = r;
        mPixels[idx + 1] = g;
        mPixels[idx + 2] = b;
        mPixels[idx + 3] = a;
    }

    void setPixelRGBA(int x, int y, uint32_t rgba) {
        setPixel(x, y,
                 (rgba >> 16) & 0xFF,
                 (rgba >> 8) & 0xFF,
                 rgba & 0xFF,
                 (rgba >> 24) & 0xFF);
    }

    float getGray(const std::vector<uint8_t>& data, int x, int y, int w) {
        size_t idx = (y * w + x) * 4;
        return data[idx] / 255.0f;
    }

    uint32_t lerpColor(uint32_t c1, uint32_t c2, float t) {
        uint8_t r1 = (c1 >> 16) & 0xFF, g1 = (c1 >> 8) & 0xFF, b1 = c1 & 0xFF, a1 = (c1 >> 24) & 0xFF;
        uint8_t r2 = (c2 >> 16) & 0xFF, g2 = (c2 >> 8) & 0xFF, b2 = c2 & 0xFF, a2 = (c2 >> 24) & 0xFF;
        return ((uint32_t)(a1 + (a2 - a1) * t) << 24) |
               ((uint32_t)(r1 + (r2 - r1) * t) << 16) |
               ((uint32_t)(g1 + (g2 - g1) * t) << 8) |
               (uint32_t)(b1 + (b2 - b1) * t);
    }

    uint32_t scaleColor(uint32_t c, float s) {
        uint8_t r = std::min(255, (int)((c >> 16) & 0xFF) * s);
        uint8_t g = std::min(255, (int)((c >> 8) & 0xFF) * s);
        uint8_t b = std::min(255, (int)(c & 0xFF) * s);
        return (c & 0xFF000000) | (r << 16) | (g << 8) | b;
    }

    // Perlin noise helpers
    void initPermutation(unsigned int seed) {
        mPerm.resize(512);
        std::vector<int> p(256);
        for (int i = 0; i < 256; i++) p[i] = i;

        std::mt19937 rng(seed);
        std::shuffle(p.begin(), p.end(), rng);

        for (int i = 0; i < 256; i++) {
            mPerm[i] = mPerm[i + 256] = p[i];
        }
    }

    float fade(float t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    float lerp(float a, float b, float t) {
        return a + t * (b - a);
    }

    float grad(int hash, float x, float y) {
        int h = hash & 7;
        float u = h < 4 ? x : y;
        float v = h < 4 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -2.0f * v : 2.0f * v);
    }

    float perlin2D(float x, float y) {
        int X = (int)floorf(x) & 255;
        int Y = (int)floorf(y) & 255;

        x -= floorf(x);
        y -= floorf(y);

        float u = fade(x);
        float v = fade(y);

        int A = mPerm[X] + Y;
        int B = mPerm[X + 1] + Y;

        return lerp(
            lerp(grad(mPerm[A], x, y), grad(mPerm[B], x - 1, y), u),
            lerp(grad(mPerm[A + 1], x, y - 1), grad(mPerm[B + 1], x - 1, y - 1), u),
            v
        );
    }

    float fbm(float x, float y, int octaves, float persistence) {
        float total = 0;
        float amplitude = 1;
        float frequency = 1;
        float maxValue = 0;

        for (int i = 0; i < octaves; i++) {
            total += perlin2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return total / maxValue;
    }
};


/**
 * Pre-built procedural texture presets for complete PBR materials
 */
class ProceduralPresets {
public:
    /**
     * Generate complete brick PBR material set
     */
    static void generateBrickPBR(ProceduralTexture& albedo,
                                  ProceduralTexture& normal,
                                  ProceduralTexture& roughness,
                                  ProceduralTexture& ao,
                                  int resolution = 1024) {
        // Albedo - brick pattern
        albedo.brickPattern(resolution, resolution, resolution / 8, resolution / 16, 4);
        albedo.applySeamless();

        // Roughness - slightly noisy
        roughness.roughnessMap(resolution, resolution, 0.7f, 0.2f);

        // Create height for normal map
        normal.perlinNoise(resolution, resolution, 8.0f, 4, 0.5f);
        normal.normalMapFromHeight(resolution, resolution, 1.5f);

        // AO - darken mortar areas
        ao.brickPattern(resolution, resolution, resolution / 8, resolution / 16, 4,
                        0xFFFFFFFF, 0xFFB0B0B0);
        ao.applyBlur(2);
    }

    /**
     * Generate wood PBR material set
     */
    static void generateWoodPBR(ProceduralTexture& albedo,
                                 ProceduralTexture& normal,
                                 ProceduralTexture& roughness,
                                 int resolution = 1024) {
        albedo.woodGrain(resolution, resolution, 10.0f, 20.0f);
        albedo.applySeamless();

        roughness.roughnessMap(resolution, resolution, 0.4f, 0.15f);

        normal.perlinNoise(resolution, resolution, 4.0f, 4, 0.5f);
        normal.normalMapFromHeight(resolution, resolution, 0.5f);
    }

    /**
     * Generate marble PBR material set
     */
    static void generateMarblePBR(ProceduralTexture& albedo,
                                   ProceduralTexture& normal,
                                   ProceduralTexture& roughness,
                                   int resolution = 1024) {
        albedo.marble(resolution, resolution, 3.0f, 5.0f);
        albedo.applySeamless();

        roughness.roughnessMap(resolution, resolution, 0.2f, 0.1f);

        normal.perlinNoise(resolution, resolution, 6.0f, 3, 0.5f);
        normal.normalMapFromHeight(resolution, resolution, 0.3f);
    }

    /**
     * Generate metal PBR material set
     */
    static void generateMetalPBR(ProceduralTexture& albedo,
                                  ProceduralTexture& normal,
                                  ProceduralTexture& roughness,
                                  ProceduralTexture& metallic,
                                  int resolution = 1024,
                                  uint32_t metalColor = 0xFFC0C0C0) {
        // Base metal color with scratches
        albedo.custom(resolution, resolution, [metalColor](int x, int y, float u, float v) {
            return metalColor;
        });

        // Add scratch patterns
        roughness.custom(resolution, resolution, [](int x, int y, float u, float v) {
            float scratch = sinf(u * 100.0f + v * 20.0f) * 0.5f + 0.5f;
            scratch = scratch * scratch;  // Make scratches sharper
            float base = 0.3f + scratch * 0.4f;
            uint8_t v8 = (uint8_t)(base * 255);
            return 0xFF000000 | (v8 << 16) | (v8 << 8) | v8;
        });

        normal.perlinNoise(resolution, resolution, 16.0f, 3, 0.5f);
        normal.normalMapFromHeight(resolution, resolution, 0.8f);

        // Full metallic
        metallic.custom(resolution, resolution, [](int x, int y, float u, float v) {
            return 0xFFFFFFFF;
        });
    }

    /**
     * Generate fabric PBR material set
     */
    static void generateFabricPBR(ProceduralTexture& albedo,
                                   ProceduralTexture& normal,
                                   ProceduralTexture& roughness,
                                   int resolution = 1024,
                                   uint32_t fabricColor = 0xFF4466AA) {
        // Woven pattern
        albedo.custom(resolution, resolution, [fabricColor, resolution](int x, int y, float u, float v) {
            int gridSize = resolution / 32;
            bool warp = (x / gridSize) % 2 == 0;
            bool weft = (y / gridSize) % 2 == 0;
            float brightness = (warp != weft) ? 1.0f : 0.9f;

            uint8_t r = (uint8_t)(((fabricColor >> 16) & 0xFF) * brightness);
            uint8_t g = (uint8_t)(((fabricColor >> 8) & 0xFF) * brightness);
            uint8_t b = (uint8_t)((fabricColor & 0xFF) * brightness);
            return 0xFF000000 | (r << 16) | (g << 8) | b;
        });

        roughness.roughnessMap(resolution, resolution, 0.8f, 0.1f);

        normal.worleyNoise(resolution, resolution, 64, 1);
        normal.normalMapFromHeight(resolution, resolution, 0.4f);
    }
};

} // namespace al

#endif // AL_WEB_PROCEDURAL_HPP
