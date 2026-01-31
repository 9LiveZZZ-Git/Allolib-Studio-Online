/**
 * Web OBJ Mesh Loader
 *
 * Loads Wavefront OBJ files and creates AlloLib Mesh objects.
 * Supports vertices, normals, texture coordinates, and faces.
 *
 * Usage:
 *   // Synchronous (from data already loaded)
 *   Mesh mesh;
 *   if (WebOBJ::parse(objData, objSize, mesh)) {
 *       // mesh is ready to use
 *   }
 *
 *   // Asynchronous (from URL)
 *   WebOBJ loader;
 *   loader.load("/assets/meshes/bunny.obj");
 *
 *   // In onAnimate, check if loaded
 *   if (loader.ready()) {
 *       mesh = loader.mesh();  // or loader.getMesh(mesh)
 *   }
 *
 * Supports:
 *   - Vertices (v x y z)
 *   - Texture coordinates (vt u v)
 *   - Normals (vn x y z)
 *   - Faces (f v1/t1/n1 v2/t2/n2 v3/t3/n3)
 *   - Triangles and quads (quads are triangulated)
 *   - Negative indices (relative to end of buffer)
 *
 * Does NOT support:
 *   - Multiple objects/groups (all merged into one mesh)
 *   - Materials (.mtl files)
 *   - Curves/surfaces
 */

#ifndef AL_WEB_OBJ_HPP
#define AL_WEB_OBJ_HPP

#include <emscripten.h>
#include <string>
#include <vector>
#include <sstream>
#include <cstring>
#include <functional>

// Forward declare Mesh to avoid circular includes
namespace al {
class Mesh;
}

#include "al/graphics/al_Mesh.hpp"
#include "al_WebFile.hpp"
#include "al_WebLOD.hpp"

namespace al {

/**
 * OBJ file parser and loader
 */
class WebOBJ {
public:
    using LoadCallback = std::function<void(bool success)>;

    WebOBJ() : mReady(false) {}

    /**
     * Parse OBJ data from memory buffer
     * @param data Raw OBJ file data
     * @param size Size of data in bytes
     * @param mesh Output mesh to populate
     * @return true on success
     */
    static bool parse(const uint8_t* data, size_t size, Mesh& mesh) {
        return parse(std::string(reinterpret_cast<const char*>(data), size), mesh);
    }

    /**
     * Parse OBJ data from string
     * @param objData OBJ file contents as string
     * @param mesh Output mesh to populate
     * @return true on success
     */
    static bool parse(const std::string& objData, Mesh& mesh) {
        // Temporary storage for OBJ data
        std::vector<Vec3f> positions;
        std::vector<Vec2f> texcoords;
        std::vector<Vec3f> normals;

        // Face indices (each face vertex has position/texcoord/normal indices)
        struct FaceVertex {
            int v, vt, vn;  // 1-based indices, 0 means not present
        };
        std::vector<std::vector<FaceVertex>> faces;

        // Parse line by line
        std::istringstream stream(objData);
        std::string line;
        int lineNum = 0;

        while (std::getline(stream, line)) {
            lineNum++;

            // Skip empty lines and comments
            if (line.empty() || line[0] == '#') continue;

            // Trim leading whitespace
            size_t start = line.find_first_not_of(" \t\r");
            if (start == std::string::npos) continue;
            line = line.substr(start);

            // Parse based on prefix
            if (line.compare(0, 2, "v ") == 0) {
                // Vertex position: v x y z [w]
                Vec3f pos;
                if (sscanf(line.c_str(), "v %f %f %f", &pos.x, &pos.y, &pos.z) >= 3) {
                    positions.push_back(pos);
                }
            }
            else if (line.compare(0, 3, "vt ") == 0) {
                // Texture coordinate: vt u v [w]
                Vec2f tc;
                if (sscanf(line.c_str(), "vt %f %f", &tc.x, &tc.y) >= 2) {
                    texcoords.push_back(tc);
                }
            }
            else if (line.compare(0, 3, "vn ") == 0) {
                // Vertex normal: vn x y z
                Vec3f n;
                if (sscanf(line.c_str(), "vn %f %f %f", &n.x, &n.y, &n.z) >= 3) {
                    normals.push_back(n);
                }
            }
            else if (line.compare(0, 2, "f ") == 0) {
                // Face: f v1[/vt1][/vn1] v2[/vt2][/vn2] v3[/vt3][/vn3] ...
                std::vector<FaceVertex> face;

                std::istringstream faceStream(line.substr(2));
                std::string vertexStr;

                while (faceStream >> vertexStr) {
                    FaceVertex fv = {0, 0, 0};

                    // Parse v/vt/vn format
                    // Possible formats: v, v/vt, v/vt/vn, v//vn
                    size_t slash1 = vertexStr.find('/');
                    if (slash1 == std::string::npos) {
                        // Just vertex index
                        fv.v = std::stoi(vertexStr);
                    } else {
                        fv.v = std::stoi(vertexStr.substr(0, slash1));
                        size_t slash2 = vertexStr.find('/', slash1 + 1);
                        if (slash2 == std::string::npos) {
                            // v/vt format
                            if (slash1 + 1 < vertexStr.size()) {
                                fv.vt = std::stoi(vertexStr.substr(slash1 + 1));
                            }
                        } else {
                            // v/vt/vn or v//vn format
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
            // Ignore other lines (mtllib, usemtl, g, o, s, etc.)
        }

        // Build mesh from parsed data
        mesh.reset();
        mesh.primitive(Mesh::TRIANGLES);

        bool hasTexcoords = !texcoords.empty();
        bool hasNormals = !normals.empty();

        // Process faces - triangulate if needed
        for (const auto& face : faces) {
            // Triangulate fan-style: 0-1-2, 0-2-3, 0-3-4, ...
            for (size_t i = 1; i + 1 < face.size(); i++) {
                // Triangle vertices: face[0], face[i], face[i+1]
                const FaceVertex* tri[3] = { &face[0], &face[i], &face[i + 1] };

                for (int j = 0; j < 3; j++) {
                    const FaceVertex& fv = *tri[j];

                    // Resolve indices (1-based, negative = from end)
                    int vi = fv.v;
                    if (vi < 0) vi = positions.size() + vi + 1;
                    if (vi < 1 || vi > (int)positions.size()) continue;

                    // Add vertex position
                    mesh.vertex(positions[vi - 1]);

                    // Add texture coordinate if present
                    if (hasTexcoords && fv.vt != 0) {
                        int ti = fv.vt;
                        if (ti < 0) ti = texcoords.size() + ti + 1;
                        if (ti >= 1 && ti <= (int)texcoords.size()) {
                            mesh.texCoord(texcoords[ti - 1]);
                        }
                    }

                    // Add normal if present
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

        // Generate normals if not present in file
        if (!hasNormals && mesh.vertices().size() > 0) {
            mesh.generateNormals();
        }

        printf("[WebOBJ] Parsed: %zu vertices, %zu normals, %zu texcoords, %zu faces\n",
               positions.size(), normals.size(), texcoords.size(), faces.size());
        printf("[WebOBJ] Mesh: %zu vertices, %zu normals\n",
               mesh.vertices().size(), mesh.normals().size());

        return mesh.vertices().size() > 0;
    }

    /**
     * Load OBJ file from URL asynchronously
     * @param url URL to OBJ file
     */
    void load(const std::string& url) {
        mReady = false;
        mUrl = url;
        mMesh.reset();

        WebFile::loadFromURL(url, [this](const UploadedFile& file) {
            if (parse(file.data.data(), file.data.size(), mMesh)) {
                mReady = true;
                printf("[WebOBJ] Loaded: %s\n", mUrl.c_str());
                if (mCallback) mCallback(true);
            } else {
                printf("[WebOBJ] Failed to parse: %s\n", mUrl.c_str());
                if (mCallback) mCallback(false);
            }
        });
    }

    /**
     * Load OBJ file with completion callback
     */
    void load(const std::string& url, LoadCallback callback) {
        mCallback = callback;
        load(url);
    }

    /**
     * Check if mesh is loaded and ready
     */
    bool ready() const { return mReady; }

    /**
     * Get the loaded mesh (const reference)
     */
    const Mesh& mesh() const { return mMesh; }

    /**
     * Get the loaded mesh (mutable reference)
     */
    Mesh& mesh() { return mMesh; }

    /**
     * Copy loaded mesh to output mesh
     * @param out Output mesh to copy to
     * @return true if mesh was ready and copied
     */
    bool getMesh(Mesh& out) const {
        if (!mReady) return false;
        out.copy(mMesh);
        return true;
    }

    /**
     * Get URL that was loaded
     */
    const std::string& url() const { return mUrl; }

    /**
     * Get vertex count
     */
    size_t vertexCount() const { return mMesh.vertices().size(); }

    /**
     * Get face count (approximate - vertices/3 for triangles)
     */
    size_t faceCount() const { return mMesh.vertices().size() / 3; }

    /**
     * Generate LOD levels for the loaded mesh
     * @param levels Number of LOD levels (default 4)
     * @param reductionFactor How much to reduce each level (default 0.5)
     */
    void generateLOD(int levels = 4, float reductionFactor = 0.5f) {
        if (!mReady) return;
        mLOD.generate(mMesh, levels, reductionFactor);
        mHasLOD = true;
    }

    /**
     * Check if LOD is available
     */
    bool hasLOD() const { return mHasLOD; }

    /**
     * Get LOD mesh reference
     */
    LODMesh& lod() { return mLOD; }
    const LODMesh& lod() const { return mLOD; }

    /**
     * Draw with automatic LOD selection based on distance
     */
    void draw(Graphics& g, const Vec3f& objectPos, const Vec3f& cameraPos) {
        if (!mReady) return;
        if (mHasLOD) {
            mLOD.draw(g, objectPos, cameraPos);
        } else {
            g.draw(mMesh);
        }
    }

private:
    std::string mUrl;
    Mesh mMesh;
    LODMesh mLOD;
    bool mReady;
    bool mHasLOD = false;
    LoadCallback mCallback;
};

/**
 * Batch loader for multiple OBJ files
 */
class WebOBJBatch {
public:
    using BatchCallback = std::function<void(int loaded, int total)>;

    WebOBJBatch() : mLoaded(0), mTotal(0) {}

    /**
     * Add an OBJ file to the batch
     * @param url URL to OBJ file
     * @return Index of the mesh
     */
    int add(const std::string& url) {
        int index = mLoaders.size();
        mLoaders.emplace_back();
        mUrls.push_back(url);
        return index;
    }

    /**
     * Start loading all meshes
     */
    void loadAll(BatchCallback callback = nullptr) {
        mCallback = callback;
        mLoaded = 0;
        mTotal = mLoaders.size();

        for (size_t i = 0; i < mLoaders.size(); i++) {
            mLoaders[i].load(mUrls[i], [this](bool success) {
                mLoaded++;
                if (mCallback) {
                    mCallback(mLoaded, mTotal);
                }
            });
        }
    }

    /**
     * Check if all meshes are loaded
     */
    bool allReady() const {
        for (const auto& loader : mLoaders) {
            if (!loader.ready()) return false;
        }
        return !mLoaders.empty();
    }

    /**
     * Get progress (0.0 to 1.0)
     */
    float progress() const {
        if (mTotal == 0) return 0;
        return (float)mLoaded / mTotal;
    }

    /**
     * Get loader by index
     */
    WebOBJ& get(int index) { return mLoaders[index]; }
    const WebOBJ& get(int index) const { return mLoaders[index]; }

    /**
     * Get mesh by index (shorthand)
     */
    Mesh& mesh(int index) { return mLoaders[index].mesh(); }
    const Mesh& mesh(int index) const { return mLoaders[index].mesh(); }

    /**
     * Get number of meshes
     */
    size_t count() const { return mLoaders.size(); }

private:
    std::vector<WebOBJ> mLoaders;
    std::vector<std::string> mUrls;
    BatchCallback mCallback;
    int mLoaded;
    int mTotal;
};

} // namespace al

#endif // AL_WEB_OBJ_HPP
