/**
 * Native LOD (Level of Detail) System
 *
 * Native equivalent of al_WebLOD.hpp.
 * Pure C++ implementation - works identically on native and web.
 *
 * Usage is identical to WebLOD:
 *   LODMesh lodMesh;
 *   lodMesh.generate(originalMesh, 4);
 *
 *   // In onDraw
 *   float distance = (nav().pos() - objectPos).mag();
 *   g.draw(lodMesh.selectByDistance(distance));
 */

#ifndef AL_NATIVE_LOD_HPP
#define AL_NATIVE_LOD_HPP

#include <vector>
#include <array>
#include <queue>
#include <unordered_map>
#include <unordered_set>
#include <cmath>
#include <algorithm>
#include <functional>

#include "al/graphics/al_Mesh.hpp"
#include "al/graphics/al_Graphics.hpp"
#include "al/math/al_Vec.hpp"

namespace al {

/**
 * Quadric Error Metric for mesh simplification
 */
class QuadricErrorMetric {
public:
    float q[10] = {0};

    QuadricErrorMetric() = default;

    QuadricErrorMetric(float a, float b, float c, float d) {
        q[0] = a*a; q[1] = a*b; q[2] = a*c; q[3] = a*d;
                    q[4] = b*b; q[5] = b*c; q[6] = b*d;
                                q[7] = c*c; q[8] = c*d;
                                            q[9] = d*d;
    }

    static QuadricErrorMetric fromTriangle(const Vec3f& v0, const Vec3f& v1, const Vec3f& v2) {
        Vec3f n = cross(v1 - v0, v2 - v0);
        float len = n.mag();
        if (len < 1e-10f) return QuadricErrorMetric();
        n = n / len;
        float d = -dot(n, v0);
        return QuadricErrorMetric(n.x, n.y, n.z, d);
    }

    QuadricErrorMetric& operator+=(const QuadricErrorMetric& other) {
        for (int i = 0; i < 10; i++) q[i] += other.q[i];
        return *this;
    }

    QuadricErrorMetric operator+(const QuadricErrorMetric& other) const {
        QuadricErrorMetric result = *this;
        result += other;
        return result;
    }

    float error(const Vec3f& v) const {
        float x = v.x, y = v.y, z = v.z;
        return q[0]*x*x + 2*q[1]*x*y + 2*q[2]*x*z + 2*q[3]*x
                       +   q[4]*y*y + 2*q[5]*y*z + 2*q[6]*y
                                    +   q[7]*z*z + 2*q[8]*z
                                                 +   q[9];
    }

    Vec3f optimalPoint(const Vec3f& v1, const Vec3f& v2) const {
        return (v1 + v2) * 0.5f;
    }
};

struct EdgeCollapse {
    int v1, v2;
    float error;
    Vec3f newPos;

    bool operator>(const EdgeCollapse& other) const {
        return error > other.error;
    }
};

/**
 * Mesh simplifier using quadric error metrics
 */
class MeshSimplifier {
public:
    static void simplify(const Mesh& input, Mesh& output, float targetRatio) {
        if (input.vertices().empty() || targetRatio >= 1.0f) {
            output.copy(input);
            return;
        }

        std::vector<Vec3f> vertices(input.vertices().begin(), input.vertices().end());
        std::vector<Vec3f> normals;
        if (!input.normals().empty()) {
            normals.assign(input.normals().begin(), input.normals().end());
        }

        std::vector<std::array<int, 3>> triangles;
        if (!input.indices().empty()) {
            for (size_t i = 0; i + 2 < input.indices().size(); i += 3) {
                triangles.push_back({
                    (int)input.indices()[i],
                    (int)input.indices()[i+1],
                    (int)input.indices()[i+2]
                });
            }
        } else {
            for (size_t i = 0; i + 2 < vertices.size(); i += 3) {
                triangles.push_back({(int)i, (int)(i+1), (int)(i+2)});
            }
        }

        if (triangles.empty()) {
            output.copy(input);
            return;
        }

        std::vector<QuadricErrorMetric> quadrics(vertices.size());
        std::vector<std::unordered_set<int>> vertexTriangles(vertices.size());

        for (size_t ti = 0; ti < triangles.size(); ti++) {
            auto& tri = triangles[ti];
            QuadricErrorMetric q = QuadricErrorMetric::fromTriangle(
                vertices[tri[0]], vertices[tri[1]], vertices[tri[2]]
            );
            for (int i = 0; i < 3; i++) {
                quadrics[tri[i]] += q;
                vertexTriangles[tri[i]].insert(ti);
            }
        }

        std::unordered_set<uint64_t> edgeSet;
        auto edgeKey = [](int a, int b) -> uint64_t {
            if (a > b) std::swap(a, b);
            return ((uint64_t)a << 32) | (uint64_t)b;
        };

        std::priority_queue<EdgeCollapse, std::vector<EdgeCollapse>, std::greater<EdgeCollapse>> pq;

        for (const auto& tri : triangles) {
            for (int i = 0; i < 3; i++) {
                int v1 = tri[i], v2 = tri[(i+1)%3];
                uint64_t key = edgeKey(v1, v2);
                if (edgeSet.find(key) == edgeSet.end()) {
                    edgeSet.insert(key);
                    QuadricErrorMetric combined = quadrics[v1] + quadrics[v2];
                    Vec3f newPos = combined.optimalPoint(vertices[v1], vertices[v2]);
                    float error = combined.error(newPos);
                    pq.push({v1, v2, error, newPos});
                }
            }
        }

        std::vector<int> vertexMap(vertices.size());
        for (size_t i = 0; i < vertices.size(); i++) vertexMap[i] = i;

        auto findRoot = [&](int v) {
            while (vertexMap[v] != v) v = vertexMap[v];
            return v;
        };

        int targetVertices = std::max(3, (int)(vertices.size() * targetRatio));
        int currentVertices = vertices.size();

        while (!pq.empty() && currentVertices > targetVertices) {
            EdgeCollapse collapse = pq.top();
            pq.pop();

            int v1 = findRoot(collapse.v1);
            int v2 = findRoot(collapse.v2);

            if (v1 == v2) continue;

            vertices[v1] = collapse.newPos;
            if (!normals.empty()) {
                normals[v1] = (normals[v1] + normals[v2]).normalize();
            }
            quadrics[v1] = quadrics[v1] + quadrics[v2];
            vertexMap[v2] = v1;

            for (int ti : vertexTriangles[v2]) {
                vertexTriangles[v1].insert(ti);
            }

            currentVertices--;
        }

        output.reset();
        output.primitive(Mesh::TRIANGLES);

        std::unordered_map<int, int> newIndices;
        int nextIndex = 0;

        for (const auto& tri : triangles) {
            int i0 = findRoot(tri[0]);
            int i1 = findRoot(tri[1]);
            int i2 = findRoot(tri[2]);

            if (i0 == i1 || i1 == i2 || i2 == i0) continue;

            for (int idx : {i0, i1, i2}) {
                if (newIndices.find(idx) == newIndices.end()) {
                    newIndices[idx] = nextIndex++;
                    output.vertex(vertices[idx]);
                    if (!normals.empty()) {
                        output.normal(normals[idx]);
                    }
                }
                output.index(newIndices[idx]);
            }
        }

        if (output.normals().empty() && output.vertices().size() > 0) {
            output.generateNormals();
        }
    }
};

/**
 * LOD Mesh - Holds multiple detail levels
 */
class LODMesh {
public:
    struct LODLevel {
        Mesh mesh;
        float maxDistance;
        float screenCoverage;
        int triangleCount;
    };

    LODMesh() : mBias(1.0f) {}

    void generate(const Mesh& source, int levels = 4, float reductionFactor = 0.5f) {
        mLevels.clear();
        mLevels.resize(levels);

        float ratio = 1.0f;
        for (int i = 0; i < levels; i++) {
            if (i == 0) {
                mLevels[i].mesh.copy(source);
            } else {
                MeshSimplifier::simplify(source, mLevels[i].mesh, ratio);
            }

            mLevels[i].triangleCount = mLevels[i].mesh.vertices().size() / 3;
            mLevels[i].maxDistance = 10.0f * powf(2.0f, i);
            mLevels[i].screenCoverage = 0.5f / powf(2.0f, i);

            ratio *= reductionFactor;
        }

        printf("[LODMesh] Generated %d levels\n", levels);
    }

    Mesh& selectByDistance(float distance) {
        distance *= mBias;
        for (size_t i = 0; i < mLevels.size(); i++) {
            if (distance < mLevels[i].maxDistance) {
                return mLevels[i].mesh;
            }
        }
        return mLevels.back().mesh;
    }

    Mesh& selectByCoverage(float coverage) {
        coverage /= mBias;
        for (size_t i = 0; i < mLevels.size(); i++) {
            if (coverage > mLevels[i].screenCoverage) {
                return mLevels[i].mesh;
            }
        }
        return mLevels.back().mesh;
    }

    int getLODIndex(float distance) const {
        distance *= mBias;
        for (size_t i = 0; i < mLevels.size(); i++) {
            if (distance < mLevels[i].maxDistance) {
                return i;
            }
        }
        return mLevels.size() - 1;
    }

    void draw(Graphics& g, const Vec3f& objectPos, const Vec3f& cameraPos) {
        float distance = (cameraPos - objectPos).mag();
        g.draw(selectByDistance(distance));
    }

    void bias(float b) { mBias = b; }
    float bias() const { return mBias; }

    void setDistances(const std::vector<float>& distances) {
        for (size_t i = 0; i < std::min(distances.size(), mLevels.size()); i++) {
            mLevels[i].maxDistance = distances[i];
        }
    }

    int numLevels() const { return mLevels.size(); }
    Mesh& level(int i) { return mLevels[i].mesh; }
    const Mesh& level(int i) const { return mLevels[i].mesh; }
    int triangleCount(int level) const { return mLevels[level].triangleCount; }
    bool ready() const { return !mLevels.empty(); }

private:
    std::vector<LODLevel> mLevels;
    float mBias;
};

/**
 * LOD Group - Manages LOD for multiple objects
 */
class LODGroup {
public:
    struct LODObject {
        LODMesh* lodMesh;
        Vec3f position;
        float scale;
        int currentLOD;
    };

    void add(LODMesh* mesh, const Vec3f& pos, float scale = 1.0f) {
        mObjects.push_back({mesh, pos, scale, 0});
    }

    void clear() { mObjects.clear(); }

    void update(const Vec3f& cameraPos) {
        mTotalTriangles = 0;
        for (auto& obj : mObjects) {
            if (obj.lodMesh && obj.lodMesh->ready()) {
                float distance = (cameraPos - obj.position).mag() / obj.scale;
                obj.currentLOD = obj.lodMesh->getLODIndex(distance);
                mTotalTriangles += obj.lodMesh->triangleCount(obj.currentLOD);
            }
        }
    }

    void draw(Graphics& g) {
        for (auto& obj : mObjects) {
            if (obj.lodMesh && obj.lodMesh->ready()) {
                g.pushMatrix();
                g.translate(obj.position);
                g.scale(obj.scale);
                g.draw(obj.lodMesh->level(obj.currentLOD));
                g.popMatrix();
            }
        }
    }

    int totalTriangles() const { return mTotalTriangles; }
    int objectCount() const { return mObjects.size(); }

private:
    std::vector<LODObject> mObjects;
    int mTotalTriangles = 0;
};

/**
 * Texture LOD - Distance-based texture resolution switching
 */
class TextureLOD {
public:
    struct TextureLevel {
        int resolution;
        float maxDistance;
    };

    TextureLOD() : mBias(1.0f) {}

    void setLevels(const std::vector<int>& resolutions) {
        mLevels.resize(resolutions.size());
        for (size_t i = 0; i < resolutions.size(); i++) {
            mLevels[i].resolution = resolutions[i];
            mLevels[i].maxDistance = 10.0f * powf(2.0f, i);
        }
    }

    void setDistances(const std::vector<float>& distances) {
        for (size_t i = 0; i < std::min(distances.size(), mLevels.size()); i++) {
            mLevels[i].maxDistance = distances[i];
        }
    }

    int selectLevel(float distance) const {
        distance *= mBias;
        for (size_t i = 0; i < mLevels.size(); i++) {
            if (distance < mLevels[i].maxDistance) {
                return i;
            }
        }
        return mLevels.size() - 1;
    }

    int getResolution(int level) const {
        if (level >= 0 && level < (int)mLevels.size()) {
            return mLevels[level].resolution;
        }
        return mLevels.empty() ? 0 : mLevels.back().resolution;
    }

    void bias(float b) { mBias = b; }
    float bias() const { return mBias; }
    int numLevels() const { return mLevels.size(); }

private:
    std::vector<TextureLevel> mLevels;
    float mBias;
};

/**
 * Shader LOD - Distance-based shader complexity switching
 */
class ShaderLOD {
public:
    struct ShaderLevel {
        int complexity;
        float maxDistance;
        float minCoverage;
        bool normalMapping;
        bool shadowReceive;
        bool reflections;
        int lightCount;
    };

    ShaderLOD() : mBias(1.0f), mUseCoverage(false) {
        setLevels(4);
    }

    void setLevels(int count) {
        mLevels.resize(count);
        for (int i = 0; i < count; i++) {
            mLevels[i].complexity = i;
            mLevels[i].maxDistance = 10.0f * powf(2.0f, i);
            mLevels[i].minCoverage = 0.5f / powf(2.0f, i);
            mLevels[i].normalMapping = (i <= 1);
            mLevels[i].shadowReceive = (i <= 2);
            mLevels[i].reflections = (i == 0);
            mLevels[i].lightCount = std::max(1, 8 - i * 2);
        }
    }

    void setDistances(const std::vector<float>& distances) {
        for (size_t i = 0; i < std::min(distances.size(), mLevels.size()); i++) {
            mLevels[i].maxDistance = distances[i];
        }
    }

    int selectByDistance(float distance) const {
        distance *= mBias;
        for (size_t i = 0; i < mLevels.size(); i++) {
            if (distance < mLevels[i].maxDistance) {
                return i;
            }
        }
        return mLevels.size() - 1;
    }

    int selectByCoverage(float coverage) const {
        coverage /= mBias;
        for (size_t i = 0; i < mLevels.size(); i++) {
            if (coverage > mLevels[i].minCoverage) {
                return i;
            }
        }
        return mLevels.size() - 1;
    }

    const ShaderLevel& level(int i) const { return mLevels[i]; }
    ShaderLevel& level(int i) { return mLevels[i]; }

    bool normalMapping(int level) const { return mLevels[level].normalMapping; }
    bool shadowReceive(int level) const { return mLevels[level].shadowReceive; }
    bool reflections(int level) const { return mLevels[level].reflections; }
    int lightCount(int level) const { return mLevels[level].lightCount; }

    void bias(float b) { mBias = b; }
    float bias() const { return mBias; }
    void useCoverageMode(bool use) { mUseCoverage = use; }
    bool usingCoverage() const { return mUseCoverage; }
    int numLevels() const { return mLevels.size(); }

private:
    std::vector<ShaderLevel> mLevels;
    float mBias;
    bool mUseCoverage;
};

/**
 * Combined LOD Controller - Unified mesh, texture, and shader LOD
 */
class LODController {
public:
    LODController() : mCurrentDistance(0), mMeshLevel(0), mTextureLevel(0), mShaderLevel(0) {}

    void update(float distance) {
        mCurrentDistance = distance;
        if (mMeshLOD.ready()) {
            mMeshLevel = mMeshLOD.getLODIndex(distance);
        }
        if (mTextureLOD.numLevels() > 0) {
            mTextureLevel = mTextureLOD.selectLevel(distance);
        }
        if (mShaderLOD.numLevels() > 0) {
            mShaderLevel = mShaderLOD.selectByDistance(distance);
        }
    }

    LODMesh& meshLOD() { return mMeshLOD; }
    const LODMesh& meshLOD() const { return mMeshLOD; }
    TextureLOD& textureLOD() { return mTextureLOD; }
    const TextureLOD& textureLOD() const { return mTextureLOD; }
    ShaderLOD& shaderLOD() { return mShaderLOD; }
    const ShaderLOD& shaderLOD() const { return mShaderLOD; }

    Mesh& currentMesh() { return mMeshLOD.level(mMeshLevel); }
    int currentMeshLevel() const { return mMeshLevel; }
    int currentTextureLevel() const { return mTextureLevel; }
    int currentShaderLevel() const { return mShaderLevel; }
    int currentTextureResolution() const { return mTextureLOD.getResolution(mTextureLevel); }

    bool currentNormalMapping() const { return mShaderLOD.normalMapping(mShaderLevel); }
    bool currentShadowReceive() const { return mShaderLOD.shadowReceive(mShaderLevel); }
    bool currentReflections() const { return mShaderLOD.reflections(mShaderLevel); }
    int currentLightCount() const { return mShaderLOD.lightCount(mShaderLevel); }

    void bias(float b) {
        mMeshLOD.bias(b);
        mTextureLOD.bias(b);
        mShaderLOD.bias(b);
    }

    void printState() const {
        printf("[LOD] Distance: %.1f | Mesh: %d | Texture: %d (%dpx) | Shader: %d\n",
               mCurrentDistance, mMeshLevel, mTextureLevel,
               mTextureLOD.getResolution(mTextureLevel), mShaderLevel);
    }

private:
    LODMesh mMeshLOD;
    TextureLOD mTextureLOD;
    ShaderLOD mShaderLOD;
    float mCurrentDistance;
    int mMeshLevel;
    int mTextureLevel;
    int mShaderLevel;
};

// Alias for web compatibility
using WebLOD = LODMesh;

} // namespace al

#endif // AL_NATIVE_LOD_HPP
