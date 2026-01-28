/**
 * Web Image Loading
 *
 * Asynchronous image loading using browser's Image API.
 * Alternative/supplement to al::Image for web environments.
 *
 * Usage:
 *   WebImage img;
 *   img.load("path/to/image.png");  // Async load
 *
 *   // In onCreate/onAnimate, check if loaded
 *   if (img.ready()) {
 *       texture.create2D(img.width(), img.height(), ...);
 *       texture.submit(img.pixels());
 *   }
 *
 * Supports: PNG, JPG, GIF, WebP, BMP, and other browser-supported formats.
 */

#ifndef AL_WEB_IMAGE_HPP
#define AL_WEB_IMAGE_HPP

#include <emscripten.h>
#include <string>
#include <vector>
#include <cstdint>
#include <functional>

namespace al {

/**
 * Web-based image loader using browser Image API
 */
class WebImage {
public:
    using LoadCallback = std::function<void(bool success)>;

    WebImage() : mWidth(0), mHeight(0), mReady(false) {}

    ~WebImage() {
        // Cleanup handled automatically
    }

    /**
     * Load image from URL (async)
     * @param url Path to image file or data URL
     */
    void load(const std::string& url) {
        mReady = false;
        mUrl = url;
        mPixels.clear();

        EM_ASM({
            var imgPtr = $0;
            var url = UTF8ToString($1);

            var img = new Image();
            img.crossOrigin = 'anonymous';  // Enable CORS for external images

            img.onload = function() {
                // Create canvas to extract pixel data
                var canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                // Get RGBA pixel data
                var imageData = ctx.getImageData(0, 0, img.width, img.height);
                var pixels = imageData.data;

                // Copy to WASM memory
                var ptr = Module._malloc(pixels.length);
                Module.HEAPU8.set(pixels, ptr);

                // Call C++ callback
                Module.ccall('_al_web_image_loaded', null,
                    ['number', 'number', 'number', 'number', 'number'],
                    [imgPtr, ptr, img.width, img.height, pixels.length]);

                // Note: Don't free ptr here, C++ will copy the data
            };

            img.onerror = function() {
                console.error('[WebImage] Failed to load:', url);
                Module.ccall('_al_web_image_error', null, ['number'], [imgPtr]);
            };

            img.src = url;
        }, this, url.c_str());
    }

    /**
     * Load image with completion callback
     */
    void load(const std::string& url, LoadCallback callback) {
        mLoadCallback = callback;
        load(url);
    }

    /**
     * Check if image is loaded and ready
     */
    bool ready() const { return mReady; }

    /**
     * Get image width in pixels
     */
    unsigned int width() const { return mWidth; }

    /**
     * Get image height in pixels
     */
    unsigned int height() const { return mHeight; }

    /**
     * Get pointer to RGBA pixel data (4 bytes per pixel)
     */
    const uint8_t* pixels() const { return mPixels.data(); }

    /**
     * Get pixel data as vector
     */
    const std::vector<uint8_t>& data() const { return mPixels; }

    /**
     * Get pixel at x, y
     */
    void getPixel(unsigned int x, unsigned int y, uint8_t& r, uint8_t& g, uint8_t& b, uint8_t& a) const {
        if (!mReady || x >= mWidth || y >= mHeight) {
            r = g = b = a = 0;
            return;
        }
        size_t idx = (y * mWidth + x) * 4;
        r = mPixels[idx];
        g = mPixels[idx + 1];
        b = mPixels[idx + 2];
        a = mPixels[idx + 3];
    }

    /**
     * Create a texture from this image
     * Call after image is ready()
     */
    template<typename TextureType>
    bool createTexture(TextureType& texture) const {
        if (!mReady) return false;

        texture.create2D(mWidth, mHeight,
                         TextureType::RGBA8,  // Internal format
                         TextureType::RGBA,   // Format
                         TextureType::UBYTE); // Type
        texture.submit(mPixels.data());
        return true;
    }

    // Internal callback from JavaScript
    void _onLoaded(uint8_t* pixels, int width, int height, int size) {
        mWidth = width;
        mHeight = height;
        mPixels.assign(pixels, pixels + size);
        mReady = true;

        // Free the malloc'd buffer from JS
        EM_ASM({ Module._free($0); }, pixels);

        printf("[WebImage] Loaded: %s (%dx%d)\n", mUrl.c_str(), width, height);

        if (mLoadCallback) {
            mLoadCallback(true);
        }
    }

    void _onError() {
        mReady = false;
        if (mLoadCallback) {
            mLoadCallback(false);
        }
    }

private:
    std::string mUrl;
    unsigned int mWidth;
    unsigned int mHeight;
    std::vector<uint8_t> mPixels;
    bool mReady;
    LoadCallback mLoadCallback;
};

/**
 * Utility class for loading multiple images
 */
class WebImageBatch {
public:
    using BatchCallback = std::function<void(int loaded, int total)>;

    WebImageBatch() : mLoaded(0), mTotal(0) {}

    /**
     * Add an image to the batch
     * @return Index of the image
     */
    int add(const std::string& url) {
        int index = mImages.size();
        mImages.emplace_back();
        mUrls.push_back(url);
        return index;
    }

    /**
     * Start loading all images
     */
    void loadAll(BatchCallback callback = nullptr) {
        mCallback = callback;
        mLoaded = 0;
        mTotal = mImages.size();

        for (size_t i = 0; i < mImages.size(); i++) {
            mImages[i].load(mUrls[i], [this](bool success) {
                mLoaded++;
                if (mCallback) {
                    mCallback(mLoaded, mTotal);
                }
            });
        }
    }

    /**
     * Check if all images are loaded
     */
    bool allReady() const {
        for (const auto& img : mImages) {
            if (!img.ready()) return false;
        }
        return !mImages.empty();
    }

    /**
     * Get progress (0.0 to 1.0)
     */
    float progress() const {
        if (mTotal == 0) return 0;
        return (float)mLoaded / mTotal;
    }

    /**
     * Get image by index
     */
    WebImage& get(int index) { return mImages[index]; }
    const WebImage& get(int index) const { return mImages[index]; }

    /**
     * Get number of images
     */
    size_t count() const { return mImages.size(); }

private:
    std::vector<WebImage> mImages;
    std::vector<std::string> mUrls;
    BatchCallback mCallback;
    int mLoaded;
    int mTotal;
};

} // namespace al

// C callbacks for JavaScript
extern "C" {
    void _al_web_image_loaded(al::WebImage* img, uint8_t* pixels, int width, int height, int size) {
        if (img) {
            img->_onLoaded(pixels, width, height, size);
        }
    }

    void _al_web_image_error(al::WebImage* img) {
        if (img) {
            img->_onError();
        }
    }
}

#endif // AL_WEB_IMAGE_HPP
