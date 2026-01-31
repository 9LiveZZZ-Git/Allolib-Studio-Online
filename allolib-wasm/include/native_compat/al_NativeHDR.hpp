/**
 * Native HDR Image Loader
 *
 * Native equivalent of al_WebHDR.hpp using stb_image.
 * Provides the same API for cross-platform compatibility.
 *
 * DEPENDENCIES:
 *   - stb_image.h (https://github.com/nothings/stb)
 *   Define STB_IMAGE_IMPLEMENTATION in ONE .cpp file before including this header.
 *
 * Usage is identical to WebHDR:
 *   NativeHDR hdr;  // or use the alias: WebHDR hdr;
 *   hdr.load("/path/to/environment.hdr");
 *   if (hdr.ready()) {
 *       int w = hdr.width();
 *       int h = hdr.height();
 *       const float* pixels = hdr.pixels();
 *   }
 */

#ifndef AL_NATIVE_HDR_HPP
#define AL_NATIVE_HDR_HPP

#include <string>
#include <vector>
#include <functional>
#include <cmath>
#include <fstream>

// Include stb_image for HDR loading
// User must define STB_IMAGE_IMPLEMENTATION in one .cpp file
#ifndef STBI_INCLUDE_STB_IMAGE_H
#include "stb_image.h"
#endif

namespace al {

/**
 * HDR/RGBE image loader (Native version)
 * API-compatible with WebHDR
 */
class NativeHDR {
public:
    using LoadCallback = std::function<void(bool success)>;

    NativeHDR() : mWidth(0), mHeight(0), mReady(false) {}

    ~NativeHDR() {
        // stbi data is copied to mPixels, no need to free
    }

    /**
     * Load HDR file synchronously (native is sync, not async like web)
     * @param path Path to HDR file
     */
    void load(const std::string& path) {
        mReady = false;
        mUrl = path;
        mPixels.clear();
        mWidth = mHeight = 0;

        int w, h, channels;
        float* data = stbi_loadf(path.c_str(), &w, &h, &channels, 3);

        if (data) {
            mWidth = w;
            mHeight = h;
            mPixels.assign(data, data + w * h * 3);
            stbi_image_free(data);
            mReady = true;
            printf("[NativeHDR] Loaded: %s (%dx%d)\n", path.c_str(), w, h);
            if (mCallback) mCallback(true);
        } else {
            printf("[NativeHDR] Failed to load: %s\n", path.c_str());
            if (mCallback) mCallback(false);
        }
    }

    /**
     * Load with callback (for API compatibility with WebHDR)
     */
    void load(const std::string& path, LoadCallback callback) {
        mCallback = callback;
        load(path);
    }

    /**
     * Parse HDR data from memory buffer
     */
    static bool parse(const uint8_t* data, size_t size,
                      std::vector<float>& pixels, int& width, int& height) {
        int w, h, channels;
        float* imgData = stbi_loadf_from_memory(data, size, &w, &h, &channels, 3);

        if (imgData) {
            width = w;
            height = h;
            pixels.assign(imgData, imgData + w * h * 3);
            stbi_image_free(imgData);
            return true;
        }
        return false;
    }

    // Accessors (same as WebHDR)
    bool ready() const { return mReady; }
    int width() const { return mWidth; }
    int height() const { return mHeight; }
    const float* pixels() const { return mPixels.data(); }
    const std::vector<float>& data() const { return mPixels; }
    const std::string& url() const { return mUrl; }

    /**
     * Get pixel at x, y
     */
    void getPixel(int x, int y, float& r, float& g, float& b) const {
        if (!mReady || x < 0 || x >= mWidth || y < 0 || y >= mHeight) {
            r = g = b = 0;
            return;
        }
        int idx = (y * mWidth + x) * 3;
        r = mPixels[idx];
        g = mPixels[idx + 1];
        b = mPixels[idx + 2];
    }

    /**
     * Sample HDR using equirectangular mapping from direction vector
     */
    void sampleDirection(float dx, float dy, float dz, float& r, float& g, float& b) const {
        if (!mReady) {
            r = g = b = 0;
            return;
        }

        float phi = atan2f(dz, dx);
        float theta = acosf(dy);

        float u = (phi + M_PI) / (2.0f * M_PI);
        float v = theta / M_PI;

        float fx = u * mWidth - 0.5f;
        float fy = v * mHeight - 0.5f;

        int x0 = (int)floorf(fx);
        int y0 = (int)floorf(fy);
        int x1 = x0 + 1;
        int y1 = y0 + 1;

        float wx = fx - x0;
        float wy = fy - y0;

        x0 = ((x0 % mWidth) + mWidth) % mWidth;
        x1 = ((x1 % mWidth) + mWidth) % mWidth;
        y0 = std::max(0, std::min(mHeight - 1, y0));
        y1 = std::max(0, std::min(mHeight - 1, y1));

        float r00, g00, b00, r01, g01, b01, r10, g10, b10, r11, g11, b11;
        getPixel(x0, y0, r00, g00, b00);
        getPixel(x1, y0, r10, g10, b10);
        getPixel(x0, y1, r01, g01, b01);
        getPixel(x1, y1, r11, g11, b11);

        r = (r00 * (1-wx) + r10 * wx) * (1-wy) + (r01 * (1-wx) + r11 * wx) * wy;
        g = (g00 * (1-wx) + g10 * wx) * (1-wy) + (g01 * (1-wx) + g11 * wx) * wy;
        b = (b00 * (1-wx) + b10 * wx) * (1-wy) + (b01 * (1-wx) + b11 * wx) * wy;
    }

    /**
     * Get tone-mapped RGBA data
     */
    std::vector<uint8_t> toRGBA(float exposure = 1.0f, float gamma = 2.2f) const {
        std::vector<uint8_t> result(mWidth * mHeight * 4);
        float invGamma = 1.0f / gamma;

        for (int i = 0; i < mWidth * mHeight; i++) {
            float r = mPixels[i * 3 + 0] * exposure;
            float g = mPixels[i * 3 + 1] * exposure;
            float b = mPixels[i * 3 + 2] * exposure;

            r = r / (1.0f + r);
            g = g / (1.0f + g);
            b = b / (1.0f + b);

            r = powf(r, invGamma);
            g = powf(g, invGamma);
            b = powf(b, invGamma);

            result[i * 4 + 0] = (uint8_t)(std::min(1.0f, r) * 255);
            result[i * 4 + 1] = (uint8_t)(std::min(1.0f, g) * 255);
            result[i * 4 + 2] = (uint8_t)(std::min(1.0f, b) * 255);
            result[i * 4 + 3] = 255;
        }

        return result;
    }

private:
    std::string mUrl;
    std::vector<float> mPixels;
    int mWidth;
    int mHeight;
    bool mReady;
    LoadCallback mCallback;
};

// Alias for cross-platform compatibility
using WebHDR = NativeHDR;

} // namespace al

#endif // AL_NATIVE_HDR_HPP
