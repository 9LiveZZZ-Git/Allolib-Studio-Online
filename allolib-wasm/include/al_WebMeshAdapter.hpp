/**
 * AlloLib Studio Online - Web Mesh Adapter
 *
 * Converts al::Mesh to backend buffer handles with caching.
 * Provides the bridge between AlloLib's Mesh class and the
 * GraphicsBackend buffer interface.
 *
 * Vertex Layout (AlloLib Standard - interleaved):
 *   Location 0: Position (vec3f) - offset 0
 *   Location 1: Color (vec4f) - offset 12
 *   Location 2: TexCoord (vec2f) - offset 28
 *   Location 3: Normal (vec3f) - offset 36
 *   Stride: 48 bytes
 */

#ifndef AL_WEB_MESH_ADAPTER_HPP
#define AL_WEB_MESH_ADAPTER_HPP

#include "al_WebGraphicsBackend.hpp"
#include "al/graphics/al_Mesh.hpp"
#include <unordered_map>
#include <vector>

namespace al {

/// Interleaved vertex format for backend rendering
struct InterleavedVertex {
    float position[3];   // 12 bytes
    float color[4];      // 16 bytes
    float texCoord[2];   // 8 bytes
    float normal[3];     // 12 bytes
    // Total: 48 bytes
};

/// Cache entry for a mesh's GPU resources
struct MeshCacheEntry {
    BufferHandle vertexBuffer;
    BufferHandle indexBuffer;
    VertexLayout layout;
    size_t vertexCount = 0;
    size_t indexCount = 0;
    uint32_t meshVersion = 0;
    bool hasIndices = false;
    PrimitiveType convertedPrimitive = PrimitiveType::Triangles; // After conversion
    Mesh::Primitive originalPrimitive = Mesh::TRIANGLES;
};

/**
 * WebMeshAdapter - Converts al::Mesh to backend buffers
 *
 * Handles:
 * - Converting mesh data to interleaved vertex format
 * - Creating and managing GPU buffers
 * - Caching buffers for reuse
 * - Updating buffers when mesh data changes
 */
class WebMeshAdapter {
public:
    WebMeshAdapter() = default;
    ~WebMeshAdapter();

    /// Set the graphics backend to use
    void setBackend(GraphicsBackend* backend);

    /// Get the current backend
    GraphicsBackend* backend() const { return mBackend; }

    /**
     * Prepare a mesh for rendering
     *
     * Creates or updates GPU buffers as needed.
     * Returns true if the mesh is ready to draw.
     */
    bool prepareMesh(const Mesh& mesh);

    /**
     * Bind the mesh's buffers and draw
     *
     * @param primitive Primitive type to use (from mesh)
     * @param vertexCount Number of vertices to draw (0 = all)
     */
    void drawMesh(PrimitiveType primitive, int vertexCount = 0);

    /**
     * Get cache entry for a mesh (if exists)
     */
    const MeshCacheEntry* getCacheEntry(const Mesh* mesh) const;

    /**
     * Clear all cached GPU resources
     */
    void clearCache();

    /**
     * Remove a specific mesh from cache
     */
    void removeMesh(const Mesh* mesh);

    /**
     * Get statistics
     */
    size_t cacheSize() const { return mCache.size(); }
    size_t totalBufferMemory() const { return mTotalBufferMemory; }

private:
    GraphicsBackend* mBackend = nullptr;
    std::unordered_map<const Mesh*, MeshCacheEntry> mCache;
    const Mesh* mCurrentMesh = nullptr;
    size_t mTotalBufferMemory = 0;

    /**
     * Create interleaved vertex data from mesh
     */
    void createInterleavedData(
        const Mesh& mesh,
        std::vector<InterleavedVertex>& outVertices
    );

    /**
     * Create vertex layout for interleaved format
     */
    VertexLayout createVertexLayout();

    /**
     * Convert unsupported primitives (TRIANGLE_FAN, LINE_LOOP) to supported ones.
     * WebGPU only supports: Points, Lines, LineStrip, Triangles, TriangleStrip.
     *
     * @param primitive Original primitive type
     * @param vertices Input vertices
     * @param indices Input indices (may be empty for non-indexed)
     * @param outVertices Output vertices (may be expanded)
     * @param outIndices Output indices
     * @return Converted primitive type
     */
    PrimitiveType convertPrimitive(
        Mesh::Primitive primitive,
        const std::vector<InterleavedVertex>& vertices,
        const std::vector<unsigned int>& indices,
        std::vector<InterleavedVertex>& outVertices,
        std::vector<uint32_t>& outIndices
    );

    /**
     * Check if primitive type needs conversion for WebGPU
     */
    static bool needsPrimitiveConversion(Mesh::Primitive p) {
        return p == Mesh::TRIANGLE_FAN || p == Mesh::LINE_LOOP;
    }
};

/**
 * Convert al::Mesh::Primitive to PrimitiveType
 * (Free function for use by other modules)
 */
PrimitiveType meshPrimitiveToPrimitiveType(Mesh::Primitive p);

/// Convert al::Mesh::Primitive to backend PrimitiveType
inline PrimitiveType meshPrimitiveToPrimitiveType(Mesh::Primitive p) {
    switch (p) {
        case Mesh::POINTS:         return PrimitiveType::Points;
        case Mesh::LINES:          return PrimitiveType::Lines;
        case Mesh::LINE_STRIP:     return PrimitiveType::LineStrip;
        case Mesh::LINE_LOOP:      return PrimitiveType::LineLoop;
        case Mesh::TRIANGLES:      return PrimitiveType::Triangles;
        case Mesh::TRIANGLE_STRIP: return PrimitiveType::TriangleStrip;
        case Mesh::TRIANGLE_FAN:   return PrimitiveType::TriangleFan;
        default:                   return PrimitiveType::Triangles;
    }
}

} // namespace al

#endif // AL_WEB_MESH_ADAPTER_HPP
