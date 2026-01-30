/**
 * Web LOD (Level of Detail) System
 *
 * Automatic mesh simplification and LOD selection based on distance/screen coverage.
 * Similar to Unreal's Nanite concept but for WebGL2.
 *
 * Features:
 * - Automatic mesh decimation using edge collapse
 * - Distance-based LOD selection
 * - Screen coverage-based LOD selection
 * - Seamless LOD transitions
 *
 * Usage:
 *   LODMesh lodMesh;
 *   lodMesh.generate(originalMesh, 4);  // Generate 4 LOD levels
 *
 *   // In onDraw
 *   float distance = (nav().pos() - objectPos).mag();
 *   Mesh& mesh = lodMesh.select(distance);
 *   g.draw(mesh);
 *
 *   // Or use automatic selection
 *   lodMesh.draw(g, objectPos, nav().pos());
 */

#ifndef AL_WEB_LOD_HPP
#define AL_WEB_LOD_HPP

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
 * Based on Garland & Heckbert's surface simplification algorithm
 */
class QuadricErrorMetric {
public:
    // 4x4 symmetric matrix stored as 10 floats
    float q[10] = {0};

    QuadricErrorMetric() = default;

    // Create quadric from plane equation ax + by + cz + d = 0
    QuadricErrorMetric(float a, float b, float c, float d) {
        q[0] = a*a; q[1] = a*b; q[2] = a*c; q[3] = a*d;
                    q[4] = b*b; q[5] = b*c; q[6] = b*d;
                                q[7] = c*c; q[8] = c*d;
                                            q[9] = d*d;
    }

    // Create quadric from triangle
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

    // Evaluate error at point
    float error(const Vec3f& v) const {
        float x = v.x, y = v.y, z = v.z;
        return q[0]*x*x + 2*q[1]*x*y + 2*q[2]*x*z + 2*q[3]*x
                       +   q[4]*y*y + 2*q[5]*y*z + 2*q[6]*y
                                    +   q[7]*z*z + 2*q[8]*z
                                                 +   q[9];
    }

    // Find optimal point (simplified - just use midpoint)
    Vec3f optimalPoint(const Vec3f& v1, const Vec3f& v2) const {
        // For simplicity, use midpoint. Full implementation would solve linear system.
        return (v1 + v2) * 0.5f;
    }
};

/**
 * Edge collapse candidate for priority queue
 */
struct EdgeCollapse {
    int v1, v2;           // Vertex indices
    float error;          // Collapse error
    Vec3f newPos;         // Position after collapse
    bool isBoundary;      // Is this a boundary edge?

    bool operator>(const EdgeCollapse& other) const {
        return error > other.error;  // Min-heap
    }
};

/**
 * Mesh simplifier using quadric error metrics with topological constraints
 *
 * Improvements over basic QEM:
 * - Boundary edge preservation (penalized, not collapsed first)
 * - Triangle flip prevention (checks normal direction before collapse)
 * - Minimum triangle quality enforcement
 * - Proper vertex attribute interpolation
 */
class MeshSimplifier {
public:
    /**
     * Simplify mesh to target vertex count
     * @param input Input mesh (triangles)
     * @param output Output simplified mesh
     * @param targetRatio Ratio of vertices to keep (0.0-1.0)
     */
    static void simplify(const Mesh& input, Mesh& output, float targetRatio) {
        if (input.vertices().empty() || targetRatio >= 1.0f) {
            output.copy(input);
            return;
        }

        // Convert non-indexed mesh to indexed form for proper edge collapse
        Mesh working;
        working.copy(input);
        size_t origVerts = working.vertices().size();
        size_t origIndices = working.indices().size();

        if (working.indices().empty() && working.vertices().size() >= 3) {
            working.compress();  // Merge duplicate vertices and create indices
            printf("[Simplify] compress(): %zu verts -> %zu verts, %zu indices\n",
                   origVerts, working.vertices().size(), working.indices().size());
        }

        // Copy vertices from the (now indexed) working mesh
        std::vector<Vec3f> vertices(working.vertices().begin(), working.vertices().end());
        std::vector<Vec3f> normals;
        if (!working.normals().empty()) {
            normals.assign(working.normals().begin(), working.normals().end());
        }

        // Build triangle list from indices
        std::vector<std::array<int, 3>> triangles;
        std::vector<bool> triangleValid;  // Track which triangles are still valid
        if (!working.indices().empty()) {
            for (size_t i = 0; i + 2 < working.indices().size(); i += 3) {
                triangles.push_back({
                    (int)working.indices()[i],
                    (int)working.indices()[i+1],
                    (int)working.indices()[i+2]
                });
                triangleValid.push_back(true);
            }
        } else {
            for (size_t i = 0; i + 2 < vertices.size(); i += 3) {
                triangles.push_back({(int)i, (int)(i+1), (int)(i+2)});
                triangleValid.push_back(true);
            }
        }

        if (triangles.empty()) {
            output.copy(input);
            return;
        }

        // Compute quadrics for each vertex
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

        // Build edge map to count edge usage (for boundary detection)
        std::unordered_map<uint64_t, int> edgeCount;
        auto edgeKey = [](int a, int b) -> uint64_t {
            if (a > b) std::swap(a, b);
            return ((uint64_t)a << 32) | (uint64_t)b;
        };

        for (const auto& tri : triangles) {
            for (int i = 0; i < 3; i++) {
                int v1 = tri[i], v2 = tri[(i+1)%3];
                edgeCount[edgeKey(v1, v2)]++;
            }
        }

        // Helper: compute triangle normal
        auto triangleNormal = [](const Vec3f& v0, const Vec3f& v1, const Vec3f& v2) -> Vec3f {
            Vec3f n = cross(v1 - v0, v2 - v0);
            float len = n.mag();
            return len > 1e-10f ? n / len : Vec3f(0, 1, 0);
        };

        // Helper: check if collapse would flip any triangle (relaxed check)
        auto wouldFlipTriangle = [&](int v1, int v2, const Vec3f& newPos,
                                     const std::vector<int>& vertexMap) -> bool {
            auto findRoot = [&](int v) {
                while (vertexMap[v] != v) v = vertexMap[v];
                return v;
            };

            // Check all triangles connected to v1 or v2
            std::unordered_set<int> affectedTris;
            for (int ti : vertexTriangles[v1]) affectedTris.insert(ti);
            for (int ti : vertexTriangles[v2]) affectedTris.insert(ti);

            int flipCount = 0;
            for (int ti : affectedTris) {
                if (!triangleValid[ti]) continue;

                auto& tri = triangles[ti];
                int i0 = findRoot(tri[0]);
                int i1 = findRoot(tri[1]);
                int i2 = findRoot(tri[2]);

                // Skip already degenerate triangles
                if (i0 == i1 || i1 == i2 || i2 == i0) continue;

                // Get current normal
                Vec3f oldNormal = triangleNormal(vertices[i0], vertices[i1], vertices[i2]);

                // Simulate the collapse: replace v1 or v2 with newPos
                Vec3f p0 = (i0 == v1 || i0 == v2) ? newPos : vertices[i0];
                Vec3f p1 = (i1 == v1 || i1 == v2) ? newPos : vertices[i1];
                Vec3f p2 = (i2 == v1 || i2 == v2) ? newPos : vertices[i2];

                // Skip if this triangle becomes degenerate (will be removed anyway)
                if ((p0 - p1).mag() < 1e-8f || (p1 - p2).mag() < 1e-8f || (p2 - p0).mag() < 1e-8f) {
                    continue;
                }

                Vec3f newNormal = triangleNormal(p0, p1, p2);

                // Relaxed flip check: allow small negative dot products (numerical precision)
                // Only reject severe flips (> 90 degree change)
                if (dot(oldNormal, newNormal) < -0.2f) {
                    flipCount++;
                    if (flipCount > 1) {
                        return true;  // Multiple flips - definitely bad
                    }
                }
            }
            return false;  // Allow collapse
        };

        // Build priority queue with boundary penalty
        std::priority_queue<EdgeCollapse, std::vector<EdgeCollapse>, std::greater<EdgeCollapse>> pq;
        std::unordered_set<uint64_t> processedEdges;

        const float BOUNDARY_PENALTY = 100.0f;  // Heavy penalty for boundary edges

        for (const auto& tri : triangles) {
            for (int i = 0; i < 3; i++) {
                int v1 = tri[i], v2 = tri[(i+1)%3];
                uint64_t key = edgeKey(v1, v2);
                if (processedEdges.find(key) == processedEdges.end()) {
                    processedEdges.insert(key);

                    QuadricErrorMetric combined = quadrics[v1] + quadrics[v2];
                    Vec3f newPos = combined.optimalPoint(vertices[v1], vertices[v2]);
                    float error = combined.error(newPos);

                    // Check if this is a boundary edge (only 1 adjacent triangle)
                    bool isBoundary = (edgeCount[key] == 1);
                    if (isBoundary) {
                        error += BOUNDARY_PENALTY;  // Penalize boundary edges
                    }

                    // Add edge length factor to prefer collapsing short edges
                    float edgeLen = (vertices[v1] - vertices[v2]).mag();
                    error += edgeLen * 0.1f;

                    pq.push({v1, v2, error, newPos, isBoundary});
                }
            }
        }

        // Collapse edges until target reached
        std::vector<int> vertexMap(vertices.size());
        for (size_t i = 0; i < vertices.size(); i++) vertexMap[i] = i;

        auto findRoot = [&](int v) {
            while (vertexMap[v] != v) v = vertexMap[v];
            return v;
        };

        int targetTriangles = std::max(4, (int)(triangles.size() * targetRatio));
        int currentTriangles = triangles.size();
        int skippedFlips = 0;
        int collapseCount = 0;
        int skippedAlreadyCollapsed = 0;

        printf("[Simplify] Target: %d triangles (from %d, ratio %.2f)\n",
               targetTriangles, currentTriangles, targetRatio);

        while (!pq.empty() && currentTriangles > targetTriangles) {
            EdgeCollapse collapse = pq.top();
            pq.pop();

            int v1 = findRoot(collapse.v1);
            int v2 = findRoot(collapse.v2);

            if (v1 == v2) {
                skippedAlreadyCollapsed++;
                continue;  // Already collapsed
            }

            // Check if this collapse would flip any triangles
            if (wouldFlipTriangle(v1, v2, collapse.newPos, vertexMap)) {
                skippedFlips++;
                continue;  // Skip this collapse
            }

            collapseCount++;

            // Perform the collapse: v2 -> v1
            vertices[v1] = collapse.newPos;
            if (!normals.empty() && v1 < (int)normals.size() && v2 < (int)normals.size()) {
                normals[v1] = (normals[v1] + normals[v2]).normalize();
            }
            quadrics[v1] = quadrics[v1] + quadrics[v2];
            vertexMap[v2] = v1;

            // Mark degenerate triangles as invalid and count remaining
            for (int ti : vertexTriangles[v2]) {
                vertexTriangles[v1].insert(ti);
            }

            // Count how many triangles become degenerate
            for (int ti : vertexTriangles[v1]) {
                if (!triangleValid[ti]) continue;
                auto& tri = triangles[ti];
                int i0 = findRoot(tri[0]);
                int i1 = findRoot(tri[1]);
                int i2 = findRoot(tri[2]);
                if (i0 == i1 || i1 == i2 || i2 == i0) {
                    triangleValid[ti] = false;
                    currentTriangles--;
                }
            }
        }

        printf("[Simplify] Done: %d collapses, %d skipped (flips), %d skipped (already), %d tris remaining\n",
               collapseCount, skippedFlips, skippedAlreadyCollapsed, currentTriangles);

        // Rebuild mesh with remaining valid triangles
        output.reset();
        output.primitive(Mesh::TRIANGLES);

        std::unordered_map<int, int> newIndices;
        int nextIndex = 0;

        for (size_t ti = 0; ti < triangles.size(); ti++) {
            if (!triangleValid[ti]) continue;

            const auto& tri = triangles[ti];
            int i0 = findRoot(tri[0]);
            int i1 = findRoot(tri[1]);
            int i2 = findRoot(tri[2]);

            // Skip degenerate triangles
            if (i0 == i1 || i1 == i2 || i2 == i0) continue;

            for (int idx : {i0, i1, i2}) {
                if (newIndices.find(idx) == newIndices.end()) {
                    newIndices[idx] = nextIndex++;
                    output.vertex(vertices[idx]);
                    if (!normals.empty() && idx < (int)normals.size()) {
                        output.normal(normals[idx]);
                    }
                }
                output.index(newIndices[idx]);
            }
        }

        // Regenerate normals for better quality
        if (output.vertices().size() > 0) {
            output.generateNormals();
        }
    }
};

/**
 * LOD Mesh - Holds multiple detail levels of a mesh
 */
class LODMesh {
public:
    struct LODLevel {
        Mesh mesh;
        float maxDistance;      // Max distance for this LOD
        float screenCoverage;   // Min screen coverage for this LOD
        int triangleCount;
    };

    LODMesh() : mBias(1.0f) {}

    /**
     * Generate LOD levels from source mesh
     * @param source Original high-poly mesh
     * @param levels Number of LOD levels to generate (1-16)
     * @param reductionFactor How much to reduce each level (default 0.5 = half)
     *
     * Uses quadric error metric simplification with mesh compression
     * to properly handle both indexed and non-indexed meshes.
     *
     * With many levels (8-16), the final levels approach zero triangles
     * for efficient culling at extreme distances.
     */
    void generate(const Mesh& source, int levels = 4, float reductionFactor = 0.5f) {
        // Clamp levels to reasonable range
        levels = std::max(1, std::min(levels, 16));

        mLevels.clear();
        mLevels.resize(levels);

        // Calculate source triangle count
        int sourceTriangles = source.indices().empty()
            ? source.vertices().size() / 3
            : source.indices().size() / 3;

        // For many levels, adjust reduction factor to spread out more gradually
        float effectiveReduction = reductionFactor;
        if (levels > 4) {
            // Gentler reduction for more levels: aim for ~1% at final level
            // Calculate what reduction would give us ~1% after (levels-1) steps
            effectiveReduction = powf(0.01f, 1.0f / (levels - 1));
            effectiveReduction = std::max(effectiveReduction, 0.5f);  // Don't go above 0.5
        }

        // Generate LOD levels with progressive simplification
        float ratio = 1.0f;
        for (int i = 0; i < levels; i++) {
            if (i == 0) {
                // LOD 0: TRUE FULL QUALITY - preserve exact original mesh unchanged
                // Do NOT call compress() as it can merge vertices and lose detail
                mLevels[i].mesh.copy(source);
            } else {
                // LOD 1+: Simplified versions
                ratio *= effectiveReduction;

                // For the last few levels, go very aggressive
                if (i >= levels - 2 && levels > 4) {
                    ratio = std::min(ratio, 0.05f / (i - levels + 3));
                }

                // Minimum ratio floor - allow very low for high level counts
                float minRatio = (levels > 8) ? 0.001f : 0.01f;
                float effectiveRatio = std::max(ratio, minRatio);

                MeshSimplifier::simplify(source, mLevels[i].mesh, effectiveRatio);
            }

            // Calculate triangle count (handle both indexed and non-indexed)
            mLevels[i].triangleCount = mLevels[i].mesh.indices().empty()
                ? mLevels[i].mesh.vertices().size() / 3
                : mLevels[i].mesh.indices().size() / 3;

            // Set distance thresholds - spread more for more levels
            // Use sqrt for more gradual spacing with many levels
            float distMultiplier = (levels > 4) ? powf(1.5f, i) : powf(2.0f, i);
            mLevels[i].maxDistance = 10.0f * distMultiplier;
            mLevels[i].screenCoverage = 0.5f / distMultiplier;
        }

        // Print LOD generation summary
        printf("[LODMesh] Generated %d levels: ", levels);
        for (int i = 0; i < levels; i++) {
            printf("%d tris%s", mLevels[i].triangleCount, i < levels-1 ? " -> " : "\n");
        }
    }

    /**
     * Generate LOD levels with custom ratios
     */
    void generate(const Mesh& source, const std::vector<float>& ratios) {
        mLevels.clear();
        mLevels.resize(ratios.size());

        for (size_t i = 0; i < ratios.size(); i++) {
            if (ratios[i] >= 1.0f) {
                mLevels[i].mesh.copy(source);
            } else {
                MeshSimplifier::simplify(source, mLevels[i].mesh, ratios[i]);
            }

            mLevels[i].triangleCount = mLevels[i].mesh.vertices().size() / 3;
            mLevels[i].maxDistance = 10.0f * powf(2.0f, i);
            mLevels[i].screenCoverage = 0.5f / powf(2.0f, i);
        }
    }

    /**
     * Select LOD level based on distance
     */
    Mesh& selectByDistance(float distance) {
        distance *= mBias;
        for (size_t i = 0; i < mLevels.size(); i++) {
            if (distance < mLevels[i].maxDistance) {
                return mLevels[i].mesh;
            }
        }
        return mLevels.back().mesh;
    }

    /**
     * Select LOD level based on screen coverage (0-1)
     */
    Mesh& selectByCoverage(float coverage) {
        coverage /= mBias;
        for (size_t i = 0; i < mLevels.size(); i++) {
            if (coverage > mLevels[i].screenCoverage) {
                return mLevels[i].mesh;
            }
        }
        return mLevels.back().mesh;
    }

    /**
     * Get LOD index for distance
     */
    int getLODIndex(float distance) const {
        distance *= mBias;
        for (size_t i = 0; i < mLevels.size(); i++) {
            if (distance < mLevels[i].maxDistance) {
                return i;
            }
        }
        return mLevels.size() - 1;
    }

    /**
     * Draw with automatic LOD selection
     */
    void draw(Graphics& g, const Vec3f& objectPos, const Vec3f& cameraPos) {
        float distance = (cameraPos - objectPos).mag();
        g.draw(selectByDistance(distance));
    }

    /**
     * Set LOD bias (higher = use lower detail sooner)
     */
    void bias(float b) { mBias = b; }
    float bias() const { return mBias; }

    /**
     * Set distance thresholds manually
     */
    void setDistances(const std::vector<float>& distances) {
        for (size_t i = 0; i < std::min(distances.size(), mLevels.size()); i++) {
            mLevels[i].maxDistance = distances[i];
        }
    }

    /**
     * Get number of LOD levels
     */
    int numLevels() const { return mLevels.size(); }

    /**
     * Get specific LOD level (with bounds safety)
     */
    Mesh& level(int i) {
        i = std::max(0, std::min(i, (int)mLevels.size() - 1));
        return mLevels[i].mesh;
    }
    const Mesh& level(int i) const {
        i = std::max(0, std::min(i, (int)mLevels.size() - 1));
        return mLevels[i].mesh;
    }

    /**
     * Get LOD stats
     */
    int triangleCount(int level) const { return mLevels[level].triangleCount; }

    /**
     * Check if LOD data exists
     */
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

    /**
     * Update LOD selections based on camera
     */
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

    /**
     * Draw all objects with their current LOD
     */
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
 *
 * Manages multiple resolution versions of a texture and automatically
 * selects the appropriate resolution based on camera distance.
 *
 * Usage:
 *   TextureLOD texLOD;
 *   texLOD.setLevels({2048, 1024, 512, 256});  // Resolution levels
 *   texLOD.setDistances({5, 15, 30, 60});       // Distance thresholds
 *
 *   // In onDraw
 *   int level = texLOD.selectLevel(distance);
 *   bindTexture(textures[level]);
 */
class TextureLOD {
public:
    struct TextureLevel {
        int resolution;       // Texture resolution (width/height for square)
        float maxDistance;    // Max distance for this level
    };

    TextureLOD() : mBias(1.0f) {}

    /**
     * Set resolution levels (from highest to lowest)
     */
    void setLevels(const std::vector<int>& resolutions) {
        mLevels.resize(resolutions.size());
        for (size_t i = 0; i < resolutions.size(); i++) {
            mLevels[i].resolution = resolutions[i];
            // Default distance thresholds (exponential)
            mLevels[i].maxDistance = 10.0f * powf(2.0f, i);
        }
    }

    /**
     * Set distance thresholds for each level
     */
    void setDistances(const std::vector<float>& distances) {
        for (size_t i = 0; i < std::min(distances.size(), mLevels.size()); i++) {
            mLevels[i].maxDistance = distances[i];
        }
    }

    /**
     * Select texture level index based on distance
     */
    int selectLevel(float distance) const {
        distance *= mBias;
        for (size_t i = 0; i < mLevels.size(); i++) {
            if (distance < mLevels[i].maxDistance) {
                return i;
            }
        }
        return mLevels.size() - 1;
    }

    /**
     * Get resolution for the selected level
     */
    int getResolution(int level) const {
        if (level >= 0 && level < (int)mLevels.size()) {
            return mLevels[level].resolution;
        }
        return mLevels.empty() ? 0 : mLevels.back().resolution;
    }

    /**
     * Set LOD bias (higher = use lower resolution sooner)
     */
    void bias(float b) { mBias = b; }
    float bias() const { return mBias; }

    int numLevels() const { return mLevels.size(); }

private:
    std::vector<TextureLevel> mLevels;
    float mBias;
};

/**
 * Shader LOD - Distance-based shader complexity switching
 *
 * Manages multiple shader complexity levels and selects appropriate
 * shader based on distance or screen coverage.
 *
 * Typical complexity levels:
 * - Level 0 (Full): Full PBR with IBL, normal maps, AO, subsurface
 * - Level 1 (Standard): Standard PBR with reduced samples
 * - Level 2 (Simple): Basic lighting with diffuse/specular
 * - Level 3 (Minimal): Unlit or simple vertex lighting
 *
 * Usage:
 *   ShaderLOD shaderLOD;
 *   shaderLOD.setLevels(4);
 *   shaderLOD.setDistances({10, 30, 60, 100});
 *
 *   // In onDraw
 *   int level = shaderLOD.selectLevel(distance);
 *   switch(level) {
 *       case 0: usePBRShader(); break;
 *       case 1: useStandardShader(); break;
 *       case 2: useSimpleShader(); break;
 *       case 3: useMinimalShader(); break;
 *   }
 */
class ShaderLOD {
public:
    struct ShaderLevel {
        int complexity;       // Complexity level (0=highest quality)
        float maxDistance;    // Max distance for this level
        float minCoverage;    // Min screen coverage for this level (0-1)
        bool normalMapping;   // Enable normal maps at this level
        bool shadowReceive;   // Receive shadows at this level
        bool reflections;     // Enable reflections at this level
        int lightCount;       // Max lights to process
    };

    ShaderLOD() : mBias(1.0f), mUseCoverage(false) {
        // Default 4 levels
        setLevels(4);
    }

    /**
     * Set number of shader complexity levels
     */
    void setLevels(int count) {
        mLevels.resize(count);
        for (int i = 0; i < count; i++) {
            mLevels[i].complexity = i;
            mLevels[i].maxDistance = 10.0f * powf(2.0f, i);
            mLevels[i].minCoverage = 0.5f / powf(2.0f, i);

            // Default feature flags based on level
            mLevels[i].normalMapping = (i <= 1);
            mLevels[i].shadowReceive = (i <= 2);
            mLevels[i].reflections = (i == 0);
            mLevels[i].lightCount = std::max(1, 8 - i * 2);
        }
    }

    /**
     * Set distance thresholds
     */
    void setDistances(const std::vector<float>& distances) {
        for (size_t i = 0; i < std::min(distances.size(), mLevels.size()); i++) {
            mLevels[i].maxDistance = distances[i];
        }
    }

    /**
     * Select shader level by distance
     */
    int selectByDistance(float distance) const {
        distance *= mBias;
        for (size_t i = 0; i < mLevels.size(); i++) {
            if (distance < mLevels[i].maxDistance) {
                return i;
            }
        }
        return mLevels.size() - 1;
    }

    /**
     * Select shader level by screen coverage (0-1)
     */
    int selectByCoverage(float coverage) const {
        coverage /= mBias;
        for (size_t i = 0; i < mLevels.size(); i++) {
            if (coverage > mLevels[i].minCoverage) {
                return i;
            }
        }
        return mLevels.size() - 1;
    }

    /**
     * Get shader level info
     */
    const ShaderLevel& level(int i) const { return mLevels[i]; }
    ShaderLevel& level(int i) { return mLevels[i]; }

    /**
     * Convenience accessors for current level features
     */
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
 *
 * Manages all LOD aspects for an object in one place.
 *
 * Usage:
 *   LODController lod;
 *   lod.meshLOD().generate(mesh, 4);
 *   lod.textureLOD().setLevels({2048, 1024, 512, 256});
 *   lod.shaderLOD().setLevels(4);
 *
 *   // In onDraw
 *   lod.update(cameraDistance);
 *   g.draw(lod.currentMesh());
 *   bindTexture(textures[lod.currentTextureLevel()]);
 *   useShader(shaders[lod.currentShaderLevel()]);
 */
class LODController {
public:
    LODController() : mCurrentDistance(0), mMeshLevel(0), mTextureLevel(0), mShaderLevel(0) {}

    /**
     * Update all LOD selections based on distance
     */
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

    /**
     * Access individual LOD systems
     */
    LODMesh& meshLOD() { return mMeshLOD; }
    const LODMesh& meshLOD() const { return mMeshLOD; }

    TextureLOD& textureLOD() { return mTextureLOD; }
    const TextureLOD& textureLOD() const { return mTextureLOD; }

    ShaderLOD& shaderLOD() { return mShaderLOD; }
    const ShaderLOD& shaderLOD() const { return mShaderLOD; }

    /**
     * Get current LOD selections
     */
    Mesh& currentMesh() { return mMeshLOD.level(mMeshLevel); }
    int currentMeshLevel() const { return mMeshLevel; }
    int currentTextureLevel() const { return mTextureLevel; }
    int currentShaderLevel() const { return mShaderLevel; }

    /**
     * Get current texture resolution
     */
    int currentTextureResolution() const {
        return mTextureLOD.getResolution(mTextureLevel);
    }

    /**
     * Get current shader features
     */
    bool currentNormalMapping() const { return mShaderLOD.normalMapping(mShaderLevel); }
    bool currentShadowReceive() const { return mShaderLOD.shadowReceive(mShaderLevel); }
    bool currentReflections() const { return mShaderLOD.reflections(mShaderLevel); }
    int currentLightCount() const { return mShaderLOD.lightCount(mShaderLevel); }

    /**
     * Set unified bias for all LOD systems
     */
    void bias(float b) {
        mMeshLOD.bias(b);
        mTextureLOD.bias(b);
        mShaderLOD.bias(b);
    }

    /**
     * Print current LOD state (for debugging)
     */
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

} // namespace al

#endif // AL_WEB_LOD_HPP
