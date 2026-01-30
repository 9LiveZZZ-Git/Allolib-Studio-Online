/**
 * Web HDR Image Loader
 *
 * Loads Radiance HDR/RGBE format images for environment mapping.
 * Converts to floating-point RGB data suitable for textures.
 *
 * Usage:
 *   WebHDR hdr;
 *   hdr.load("/assets/environments/studio.hdr");
 *
 *   // In onAnimate, check if loaded
 *   if (hdr.ready()) {
 *       // Create texture from HDR data
 *       int w = hdr.width();
 *       int h = hdr.height();
 *       const float* pixels = hdr.pixels(); // RGB float data
 *   }
 *
 * Supports:
 *   - Standard Radiance HDR format (.hdr)
 *   - RLE compressed and uncompressed data
 *   - Returns floating-point RGB (3 floats per pixel)
 */

#ifndef AL_WEB_HDR_HPP
#define AL_WEB_HDR_HPP

#include <emscripten.h>
#include <string>
#include <vector>
#include <cstring>
#include <cmath>
#include <functional>

#include "al_WebFile.hpp"

namespace al {

/**
 * HDR/RGBE image loader
 */
class WebHDR {
public:
    using LoadCallback = std::function<void(bool success)>;

    WebHDR() : mWidth(0), mHeight(0), mReady(false) {}

    /**
     * Parse HDR data from memory buffer
     * @param data Raw HDR file data
     * @param size Size of data in bytes
     * @param pixels Output RGB float data (will be resized)
     * @param width Output image width
     * @param height Output image height
     * @return true on success
     */
    static bool parse(const uint8_t* data, size_t size,
                      std::vector<float>& pixels, int& width, int& height) {
        if (size < 10) return false;

        const char* ptr = reinterpret_cast<const char*>(data);
        const char* end = ptr + size;

        printf("[WebHDR] Parsing %zu bytes\n", size);

        // Check magic number
        if (strncmp(ptr, "#?RADIANCE", 10) != 0 && strncmp(ptr, "#?RGBE", 6) != 0) {
            // Try to continue anyway - some files don't have the magic
            printf("[WebHDR] Warning: Missing HDR magic number, first bytes: %02x %02x %02x %02x\n",
                   (unsigned char)ptr[0], (unsigned char)ptr[1], (unsigned char)ptr[2], (unsigned char)ptr[3]);
        } else {
            printf("[WebHDR] Magic number found\n");
        }

        // Skip header lines until empty line
        int lineCount = 0;
        while (ptr < end && lineCount < 50) {  // Safety limit
            // Find end of line
            const char* lineEnd = ptr;
            while (lineEnd < end && *lineEnd != '\n' && *lineEnd != '\r') lineEnd++;

            size_t lineLen = lineEnd - ptr;

            // Debug: print first few header lines
            if (lineCount < 10) {
                std::string line(ptr, std::min(lineLen, (size_t)60));
                printf("[WebHDR] Header line %d: '%s'\n", lineCount, line.c_str());
            }

            // Check if empty line (end of header)
            if (lineLen == 0) {
                printf("[WebHDR] Found empty line at line %d, header ends\n", lineCount);
                ptr = lineEnd;
                while (ptr < end && (*ptr == '\n' || *ptr == '\r')) ptr++;
                break;
            }

            // Check if this is the resolution line (contains -Y or +Y)
            std::string line(ptr, lineLen);
            if (line.find("-Y") != std::string::npos || line.find("+Y") != std::string::npos ||
                line.find("-X") != std::string::npos || line.find("+X") != std::string::npos) {
                printf("[WebHDR] Found resolution line at line %d: '%s'\n", lineCount, line.c_str());
                // Parse it
                if (sscanf(line.c_str(), "-Y %d +X %d", &height, &width) == 2 ||
                    sscanf(line.c_str(), "+Y %d +X %d", &height, &width) == 2 ||
                    sscanf(line.c_str(), "-X %d -Y %d", &width, &height) == 2 ||
                    sscanf(line.c_str(), "+X %d -Y %d", &width, &height) == 2 ||
                    sscanf(line.c_str(), "+X %d +Y %d", &width, &height) == 2) {
                    printf("[WebHDR] Parsed resolution: %dx%d\n", width, height);
                    ptr = lineEnd;
                    while (ptr < end && (*ptr == '\n' || *ptr == '\r')) ptr++;
                    break;
                }
            }

            ptr = lineEnd;
            while (ptr < end && (*ptr == '\n' || *ptr == '\r')) ptr++;
            lineCount++;
        }

        // Check if we found resolution
        if (width <= 0 || height <= 0) {
            printf("[WebHDR] Resolution not found after %d header lines\n", lineCount);
            return false;
        }

        if (width > 32768 || height > 32768) {
            printf("[WebHDR] Invalid dimensions: %dx%d\n", width, height);
            return false;
        }

        // Allocate output buffer (RGB floats)
        pixels.resize(width * height * 3);

        // Temporary buffer for RGBE scanline
        std::vector<uint8_t> scanline(width * 4);

        const uint8_t* dataPtr = reinterpret_cast<const uint8_t*>(ptr);
        const uint8_t* dataEnd = reinterpret_cast<const uint8_t*>(end);

        // Read scanlines
        for (int y = 0; y < height; y++) {
            if (dataPtr >= dataEnd) {
                printf("[WebHDR] Unexpected end of data at scanline %d\n", y);
                return false;
            }

            // Check for new RLE format (starts with 2, 2, width_high, width_low)
            if (dataPtr + 4 <= dataEnd &&
                dataPtr[0] == 2 && dataPtr[1] == 2 &&
                ((dataPtr[2] << 8) | dataPtr[3]) == width) {

                dataPtr += 4;

                // Read RLE compressed scanline
                for (int channel = 0; channel < 4; channel++) {
                    int x = 0;
                    while (x < width) {
                        if (dataPtr >= dataEnd) return false;
                        uint8_t code = *dataPtr++;

                        if (code > 128) {
                            // Run of same value
                            int count = code - 128;
                            if (dataPtr >= dataEnd) return false;
                            uint8_t value = *dataPtr++;
                            while (count-- > 0 && x < width) {
                                scanline[x * 4 + channel] = value;
                                x++;
                            }
                        } else {
                            // Run of different values
                            int count = code;
                            while (count-- > 0 && x < width) {
                                if (dataPtr >= dataEnd) return false;
                                scanline[x * 4 + channel] = *dataPtr++;
                                x++;
                            }
                        }
                    }
                }
            } else {
                // Old format or uncompressed - read raw RGBE
                for (int x = 0; x < width; x++) {
                    if (dataPtr + 4 > dataEnd) return false;
                    scanline[x * 4 + 0] = *dataPtr++;
                    scanline[x * 4 + 1] = *dataPtr++;
                    scanline[x * 4 + 2] = *dataPtr++;
                    scanline[x * 4 + 3] = *dataPtr++;
                }
            }

            // Convert RGBE to float RGB
            float* outPtr = pixels.data() + y * width * 3;
            for (int x = 0; x < width; x++) {
                uint8_t r = scanline[x * 4 + 0];
                uint8_t g = scanline[x * 4 + 1];
                uint8_t b = scanline[x * 4 + 2];
                uint8_t e = scanline[x * 4 + 3];

                if (e == 0) {
                    outPtr[0] = outPtr[1] = outPtr[2] = 0.0f;
                } else {
                    float scale = ldexpf(1.0f, (int)e - 128 - 8);
                    outPtr[0] = r * scale;
                    outPtr[1] = g * scale;
                    outPtr[2] = b * scale;
                }
                outPtr += 3;
            }
        }

        printf("[WebHDR] Parsed: %dx%d HDR image\n", width, height);
        return true;
    }

    /**
     * Load HDR file from URL asynchronously
     * @param url URL to HDR file
     */
    void load(const std::string& url) {
        mReady = false;
        mUrl = url;
        mPixels.clear();
        mWidth = mHeight = 0;

        printf("[WebHDR] Starting fetch: %s\n", url.c_str());
        fflush(stdout);

        WebFile::loadFromURL(url, [this](const UploadedFile& file) {
            printf("[WebHDR] Fetch callback received: %zu bytes\n", file.data.size());
            fflush(stdout);

            if (file.data.empty()) {
                printf("[WebHDR] ERROR: Empty data received (fetch failed)\n");
                if (mCallback) mCallback(false);
                return;
            }

            if (parse(file.data.data(), file.data.size(), mPixels, mWidth, mHeight)) {
                mReady = true;
                printf("[WebHDR] Loaded: %s (%dx%d)\n", mUrl.c_str(), mWidth, mHeight);
                if (mCallback) mCallback(true);
            } else {
                printf("[WebHDR] Failed to parse: %s\n", mUrl.c_str());
                if (mCallback) mCallback(false);
            }
        });
    }

    /**
     * Load HDR file with completion callback
     */
    void load(const std::string& url, LoadCallback callback) {
        mCallback = callback;
        load(url);
    }

    /**
     * Check if HDR is loaded and ready
     */
    bool ready() const { return mReady; }

    /**
     * Get image width
     */
    int width() const { return mWidth; }

    /**
     * Get image height
     */
    int height() const { return mHeight; }

    /**
     * Get pointer to RGB float pixel data (3 floats per pixel)
     */
    const float* pixels() const { return mPixels.data(); }

    /**
     * Get pixel data as vector
     */
    const std::vector<float>& data() const { return mPixels; }

    /**
     * Get URL that was loaded
     */
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
     * @param dir Normalized direction vector
     * @param r, g, b Output color values
     */
    void sampleDirection(float dx, float dy, float dz, float& r, float& g, float& b) const {
        if (!mReady) {
            r = g = b = 0;
            return;
        }

        // Convert direction to spherical coordinates
        float phi = atan2f(dz, dx);       // -PI to PI
        float theta = acosf(dy);          // 0 to PI

        // Convert to UV coordinates
        float u = (phi + M_PI) / (2.0f * M_PI);  // 0 to 1
        float v = theta / M_PI;                   // 0 to 1

        // Sample texture (bilinear)
        float fx = u * mWidth - 0.5f;
        float fy = v * mHeight - 0.5f;

        int x0 = (int)floorf(fx);
        int y0 = (int)floorf(fy);
        int x1 = x0 + 1;
        int y1 = y0 + 1;

        float wx = fx - x0;
        float wy = fy - y0;

        // Wrap coordinates
        x0 = ((x0 % mWidth) + mWidth) % mWidth;
        x1 = ((x1 % mWidth) + mWidth) % mWidth;
        y0 = std::max(0, std::min(mHeight - 1, y0));
        y1 = std::max(0, std::min(mHeight - 1, y1));

        // Sample 4 pixels
        float r00, g00, b00, r01, g01, b01, r10, g10, b10, r11, g11, b11;
        getPixel(x0, y0, r00, g00, b00);
        getPixel(x1, y0, r10, g10, b10);
        getPixel(x0, y1, r01, g01, b01);
        getPixel(x1, y1, r11, g11, b11);

        // Bilinear interpolation
        r = (r00 * (1-wx) + r10 * wx) * (1-wy) + (r01 * (1-wx) + r11 * wx) * wy;
        g = (g00 * (1-wx) + g10 * wx) * (1-wy) + (g01 * (1-wx) + g11 * wx) * wy;
        b = (b00 * (1-wx) + b10 * wx) * (1-wy) + (b01 * (1-wx) + b11 * wx) * wy;
    }

    /**
     * Get exposure-adjusted pixel data for display (tone mapped)
     * @param exposure Exposure adjustment (default 1.0)
     * @param gamma Gamma correction (default 2.2)
     * @return Vector of RGBA uint8 data suitable for standard texture
     */
    std::vector<uint8_t> toRGBA(float exposure = 1.0f, float gamma = 2.2f) const {
        std::vector<uint8_t> result(mWidth * mHeight * 4);
        float invGamma = 1.0f / gamma;

        for (int i = 0; i < mWidth * mHeight; i++) {
            // Apply exposure
            float r = mPixels[i * 3 + 0] * exposure;
            float g = mPixels[i * 3 + 1] * exposure;
            float b = mPixels[i * 3 + 2] * exposure;

            // Reinhard tone mapping
            r = r / (1.0f + r);
            g = g / (1.0f + g);
            b = b / (1.0f + b);

            // Gamma correction
            r = powf(r, invGamma);
            g = powf(g, invGamma);
            b = powf(b, invGamma);

            // Convert to 8-bit
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

} // namespace al

#endif // AL_WEB_HDR_HPP
