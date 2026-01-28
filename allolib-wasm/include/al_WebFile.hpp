/**
 * Web File Utilities
 *
 * File upload/download support for web browsers.
 * Provides alternatives to native file I/O.
 *
 * Usage:
 *   // Download data as file
 *   WebFile::download("mydata.txt", textContent);
 *   WebFile::downloadBinary("mydata.bin", binaryData, size);
 *
 *   // Upload file with callback
 *   WebFile::upload([](const std::string& name, const uint8_t* data, size_t size) {
 *       printf("Uploaded: %s (%zu bytes)\n", name.c_str(), size);
 *   });
 */

#ifndef AL_WEB_FILE_HPP
#define AL_WEB_FILE_HPP

#include <emscripten.h>
#include <string>
#include <vector>
#include <functional>
#include <cstdint>

namespace al {

/**
 * File upload result
 */
struct UploadedFile {
    std::string name;
    std::string mimeType;
    std::vector<uint8_t> data;

    // Helper to get data as string
    std::string asString() const {
        return std::string(data.begin(), data.end());
    }
};

/**
 * Web file utilities for browser-based file I/O
 */
class WebFile {
public:
    using UploadCallback = std::function<void(const UploadedFile&)>;
    using MultiUploadCallback = std::function<void(const std::vector<UploadedFile>&)>;

    /**
     * Download text content as a file
     * @param filename Suggested filename for download
     * @param content Text content to download
     */
    static void download(const std::string& filename, const std::string& content) {
        EM_ASM({
            var filename = UTF8ToString($0);
            var content = UTF8ToString($1);

            var blob = new Blob([content], { type: 'text/plain' });
            var url = URL.createObjectURL(blob);

            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('[WebFile] Downloaded:', filename);
        }, filename.c_str(), content.c_str());
    }

    /**
     * Download binary data as a file
     * @param filename Suggested filename for download
     * @param data Binary data pointer
     * @param size Size of data in bytes
     * @param mimeType MIME type (default: application/octet-stream)
     */
    static void downloadBinary(const std::string& filename, const uint8_t* data, size_t size,
                               const std::string& mimeType = "application/octet-stream") {
        EM_ASM({
            var filename = UTF8ToString($0);
            var dataPtr = $1;
            var size = $2;
            var mimeType = UTF8ToString($3);

            var buffer = new Uint8Array(Module.HEAPU8.buffer, dataPtr, size);
            var blob = new Blob([buffer], { type: mimeType });
            var url = URL.createObjectURL(blob);

            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('[WebFile] Downloaded binary:', filename, size, 'bytes');
        }, filename.c_str(), data, size, mimeType.c_str());
    }

    /**
     * Download binary data from vector
     */
    static void downloadBinary(const std::string& filename, const std::vector<uint8_t>& data,
                               const std::string& mimeType = "application/octet-stream") {
        downloadBinary(filename, data.data(), data.size(), mimeType);
    }

    /**
     * Download JSON data
     */
    static void downloadJSON(const std::string& filename, const std::string& json) {
        EM_ASM({
            var filename = UTF8ToString($0);
            var content = UTF8ToString($1);

            var blob = new Blob([content], { type: 'application/json' });
            var url = URL.createObjectURL(blob);

            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, filename.c_str(), json.c_str());
    }

    /**
     * Open file upload dialog (single file)
     * @param callback Function called when file is uploaded
     * @param accept File type filter (e.g., ".txt,.json" or "image/*")
     */
    static void upload(UploadCallback callback, const std::string& accept = "") {
        // Store callback globally for JavaScript access
        sUploadCallback = callback;

        EM_ASM({
            var accept = UTF8ToString($0);

            var input = document.createElement('input');
            input.type = 'file';
            if (accept) input.accept = accept;

            input.onchange = function(e) {
                var file = e.target.files[0];
                if (!file) return;

                var reader = new FileReader();
                reader.onload = function(event) {
                    var data = new Uint8Array(event.target.result);
                    var ptr = Module._malloc(data.length);
                    Module.HEAPU8.set(data, ptr);

                    var namePtr = allocateUTF8(file.name);
                    var mimePtr = allocateUTF8(file.type);

                    Module.ccall('_al_web_file_uploaded', null,
                        ['number', 'number', 'number', 'number', 'number'],
                        [namePtr, mimePtr, ptr, data.length, 0]);

                    _free(namePtr);
                    _free(mimePtr);
                    _free(ptr);
                };
                reader.readAsArrayBuffer(file);
            };

            input.click();
        }, accept.c_str());
    }

    /**
     * Open file upload dialog (multiple files)
     * @param callback Function called when files are uploaded
     * @param accept File type filter
     */
    static void uploadMultiple(MultiUploadCallback callback, const std::string& accept = "") {
        sMultiUploadCallback = callback;

        EM_ASM({
            var accept = UTF8ToString($0);

            var input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            if (accept) input.accept = accept;

            input.onchange = function(e) {
                var files = e.target.files;
                if (!files.length) return;

                var filesProcessed = 0;
                var totalFiles = files.length;

                // Signal start of batch
                Module.ccall('_al_web_file_batch_start', null, ['number'], [totalFiles]);

                for (var i = 0; i < files.length; i++) {
                    (function(file, index) {
                        var reader = new FileReader();
                        reader.onload = function(event) {
                            var data = new Uint8Array(event.target.result);
                            var ptr = Module._malloc(data.length);
                            Module.HEAPU8.set(data, ptr);

                            var namePtr = allocateUTF8(file.name);
                            var mimePtr = allocateUTF8(file.type);

                            Module.ccall('_al_web_file_uploaded', null,
                                ['number', 'number', 'number', 'number', 'number'],
                                [namePtr, mimePtr, ptr, data.length, 1]);

                            _free(namePtr);
                            _free(mimePtr);
                            _free(ptr);

                            filesProcessed++;
                            if (filesProcessed === totalFiles) {
                                Module.ccall('_al_web_file_batch_end', null, [], []);
                            }
                        };
                        reader.readAsArrayBuffer(file);
                    })(files[i], i);
                }
            };

            input.click();
        }, accept.c_str());
    }

    /**
     * Load file from URL (for assets bundled with the app)
     * @param url URL to fetch
     * @param callback Function called when loaded
     */
    static void loadFromURL(const std::string& url, UploadCallback callback) {
        sURLCallback = callback;

        EM_ASM({
            var url = UTF8ToString($0);

            fetch(url)
                .then(function(response) {
                    if (!response.ok) throw new Error('HTTP error ' + response.status);
                    return response.arrayBuffer();
                })
                .then(function(buffer) {
                    var data = new Uint8Array(buffer);
                    var ptr = Module._malloc(data.length);
                    Module.HEAPU8.set(data, ptr);

                    // Extract filename from URL
                    var filename = url.split('/').pop() || 'file';
                    var namePtr = allocateUTF8(filename);
                    var mimePtr = allocateUTF8('');

                    Module.ccall('_al_web_file_url_loaded', null,
                        ['number', 'number', 'number', 'number'],
                        [namePtr, mimePtr, ptr, data.length]);

                    _free(namePtr);
                    _free(mimePtr);
                    _free(ptr);
                })
                .catch(function(err) {
                    console.error('[WebFile] Load error:', err);
                });
        }, url.c_str());
    }

    /**
     * Check if File API is supported
     */
    static bool isSupported() {
        return EM_ASM_INT({
            return (window.File && window.FileReader && window.Blob) ? 1 : 0;
        }) != 0;
    }

    // Internal callbacks
    static void _onFileUploaded(const char* name, const char* mime, const uint8_t* data, size_t size, bool isBatch) {
        UploadedFile file;
        file.name = name;
        file.mimeType = mime;
        file.data.assign(data, data + size);

        if (isBatch) {
            sBatchFiles.push_back(file);
        } else if (sUploadCallback) {
            sUploadCallback(file);
        }
    }

    static void _onBatchStart(int count) {
        sBatchFiles.clear();
        sBatchFiles.reserve(count);
    }

    static void _onBatchEnd() {
        if (sMultiUploadCallback) {
            sMultiUploadCallback(sBatchFiles);
        }
        sBatchFiles.clear();
    }

    static void _onURLLoaded(const char* name, const char* mime, const uint8_t* data, size_t size) {
        if (sURLCallback) {
            UploadedFile file;
            file.name = name;
            file.mimeType = mime;
            file.data.assign(data, data + size);
            sURLCallback(file);
        }
    }

private:
    static UploadCallback sUploadCallback;
    static MultiUploadCallback sMultiUploadCallback;
    static UploadCallback sURLCallback;
    static std::vector<UploadedFile> sBatchFiles;
};

// Static member definitions
WebFile::UploadCallback WebFile::sUploadCallback;
WebFile::MultiUploadCallback WebFile::sMultiUploadCallback;
WebFile::UploadCallback WebFile::sURLCallback;
std::vector<UploadedFile> WebFile::sBatchFiles;

} // namespace al

// C callbacks for JavaScript
extern "C" {
    void _al_web_file_uploaded(const char* name, const char* mime, uint8_t* data, int size, int isBatch) {
        al::WebFile::_onFileUploaded(name, mime, data, size, isBatch != 0);
    }

    void _al_web_file_batch_start(int count) {
        al::WebFile::_onBatchStart(count);
    }

    void _al_web_file_batch_end() {
        al::WebFile::_onBatchEnd();
    }

    void _al_web_file_url_loaded(const char* name, const char* mime, uint8_t* data, int size) {
        al::WebFile::_onURLLoaded(name, mime, data, size);
    }
}

#endif // AL_WEB_FILE_HPP
