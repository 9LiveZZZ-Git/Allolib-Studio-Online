/**
 * Native OBJ Mesh Loader
 *
 * Native equivalent of al_WebOBJ.hpp using standard file I/O.
 * Provides the same API for cross-platform compatibility.
 *
 * DEPENDENCIES:
 *   - tinyobjloader (optional, for advanced features)
 *   Or uses built-in parser compatible with WebOBJ
 *
 * Usage is identical to WebOBJ:
 *   NativeOBJ loader;  // or use the alias: WebOBJ loader;
 *   loader.load("/path/to/mesh.obj");
 *   if (loader.ready()) {
 *       g.draw(loader.mesh());
 *   }
 */

#ifndef AL_NATIVE_OBJ_HPP
#define AL_NATIVE_OBJ_HPP

#include <string>
#include <vector>
#include <sstream>
#include <fstream>
#include <functional>
#include <cstring>

#include "al/graphics/al_Mesh.hpp"

namespace al {

/**
 * OBJ file parser and loader (Native version)
 * API-compatible with WebOBJ
 */
class NativeOBJ {
public:
    using LoadCallback = std::function<void(bool success)>;

    NativeOBJ() : mReady(false) {}

    /**
     * Parse OBJ data from memory buffer
     */
    static bool parse(const uint8_t* data, size_t size, Mesh& mesh) {
        return parse(std::string(reinterpret_cast<const char*>(data), size), mesh);
    }

    /**
     * Parse OBJ data from string
     */
    static bool parse(const std::string& objData, Mesh& mesh) {
        // Temporary storage for OBJ data
        std::vector<Vec3f> positions;
        std::vector<Vec2f> texcoords;
        std::vector<Vec3f> normals;

        // Face indices
        struct FaceVertex {
            int v, vt, vn;
        };
        std::vector<std::vector<FaceVertex>> faces;

        // Parse line by line
        std::istringstream stream(objData);
        std::string line;

        while (std::getline(stream, line)) {
            if (line.empty() || line[0] == '#') continue;

            // Trim leading whitespace
            size_t start = line.find_first_not_of(" \t\r");
            if (start == std::string::npos) continue;
            line = line.substr(start);

            // Parse based on prefix
            if (line.compare(0, 2, "v ") == 0) {
                Vec3f pos;
                if (sscanf(line.c_str(), "v %f %f %f", &pos.x, &pos.y, &pos.z) >= 3) {
                    positions.push_back(pos);
                }
            }
            else if (line.compare(0, 3, "vt ") == 0) {
                Vec2f tc;
                if (sscanf(line.c_str(), "vt %f %f", &tc.x, &tc.y) >= 2) {
                    texcoords.push_back(tc);
                }
            }
            else if (line.compare(0, 3, "vn ") == 0) {
                Vec3f n;
                if (sscanf(line.c_str(), "vn %f %f %f", &n.x, &n.y, &n.z) >= 3) {
                    normals.push_back(n);
                }
            }
            else if (line.compare(0, 2, "f ") == 0) {
                std::vector<FaceVertex> face;
                std::istringstream faceStream(line.substr(2));
                std::string vertexStr;

                while (faceStream >> vertexStr) {
                    FaceVertex fv = {0, 0, 0};
                    size_t slash1 = vertexStr.find('/');
                    if (slash1 == std::string::npos) {
                        fv.v = std::stoi(vertexStr);
                    } else {
                        fv.v = std::stoi(vertexStr.substr(0, slash1));
                        size_t slash2 = vertexStr.find('/', slash1 + 1);
                        if (slash2 == std::string::npos) {
                            if (slash1 + 1 < vertexStr.size()) {
                                fv.vt = std::stoi(vertexStr.substr(slash1 + 1));
                            }
                        } else {
                            if (slash2 > slash1 + 1) {
                                fv.vt = std::stoi(vertexStr.substr(slash1 + 1, slash2 - slash1 - 1));
                            }
                            if (slash2 + 1 < vertexStr.size()) {
                                fv.vn = std::stoi(vertexStr.substr(slash2 + 1));
                            }
                        }
                    }
                    face.push_back(fv);
                }

                if (face.size() >= 3) {
                    faces.push_back(face);
                }
            }
        }

        // Build mesh
        mesh.reset();
        mesh.primitive(Mesh::TRIANGLES);

        bool hasTexcoords = !texcoords.empty();
        bool hasNormals = !normals.empty();

        for (const auto& face : faces) {
            for (size_t i = 1; i + 1 < face.size(); i++) {
                const FaceVertex* tri[3] = { &face[0], &face[i], &face[i + 1] };

                for (int j = 0; j < 3; j++) {
                    const FaceVertex& fv = *tri[j];

                    int vi = fv.v;
                    if (vi < 0) vi = positions.size() + vi + 1;
                    if (vi < 1 || vi > (int)positions.size()) continue;

                    mesh.vertex(positions[vi - 1]);

                    if (hasTexcoords && fv.vt != 0) {
                        int ti = fv.vt;
                        if (ti < 0) ti = texcoords.size() + ti + 1;
                        if (ti >= 1 && ti <= (int)texcoords.size()) {
                            mesh.texCoord(texcoords[ti - 1]);
                        }
                    }

                    if (hasNormals && fv.vn != 0) {
                        int ni = fv.vn;
                        if (ni < 0) ni = normals.size() + ni + 1;
                        if (ni >= 1 && ni <= (int)normals.size()) {
                            mesh.normal(normals[ni - 1]);
                        }
                    }
                }
            }
        }

        if (!hasNormals && mesh.vertices().size() > 0) {
            mesh.generateNormals();
        }

        printf("[NativeOBJ] Parsed: %zu vertices, %zu normals, %zu texcoords, %zu faces\n",
               positions.size(), normals.size(), texcoords.size(), faces.size());

        return mesh.vertices().size() > 0;
    }

    /**
     * Load OBJ file synchronously from path
     */
    void load(const std::string& path) {
        mReady = false;
        mUrl = path;
        mMesh.reset();

        std::ifstream file(path, std::ios::binary);
        if (!file) {
            printf("[NativeOBJ] Failed to open: %s\n", path.c_str());
            if (mCallback) mCallback(false);
            return;
        }

        std::stringstream buffer;
        buffer << file.rdbuf();
        std::string content = buffer.str();

        if (parse(content, mMesh)) {
            mReady = true;
            printf("[NativeOBJ] Loaded: %s\n", path.c_str());
            if (mCallback) mCallback(true);
        } else {
            printf("[NativeOBJ] Failed to parse: %s\n", path.c_str());
            if (mCallback) mCallback(false);
        }
    }

    /**
     * Load with callback (for API compatibility)
     */
    void load(const std::string& path, LoadCallback callback) {
        mCallback = callback;
        load(path);
    }

    bool ready() const { return mReady; }
    const Mesh& mesh() const { return mMesh; }
    Mesh& mesh() { return mMesh; }

    bool getMesh(Mesh& out) const {
        if (!mReady) return false;
        out.copy(mMesh);
        return true;
    }

    const std::string& url() const { return mUrl; }
    size_t vertexCount() const { return mMesh.vertices().size(); }
    size_t faceCount() const { return mMesh.vertices().size() / 3; }

private:
    std::string mUrl;
    Mesh mMesh;
    bool mReady;
    LoadCallback mCallback;
};

// Alias for cross-platform compatibility
using WebOBJ = NativeOBJ;

} // namespace al

#endif // AL_NATIVE_OBJ_HPP
