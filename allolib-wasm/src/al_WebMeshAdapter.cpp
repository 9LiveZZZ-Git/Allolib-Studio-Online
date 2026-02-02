/**
 * AlloLib Studio Online - Web Mesh Adapter Implementation
 */

#include "al_WebMeshAdapter.hpp"
#include <cstring>
#include <cstdio>

namespace al {

WebMeshAdapter::~WebMeshAdapter() {
    clearCache();
}

void WebMeshAdapter::setBackend(GraphicsBackend* backend) {
    if (mBackend != backend) {
        // Clear cache when backend changes
        clearCache();
        mBackend = backend;
    }
}

bool WebMeshAdapter::prepareMesh(const Mesh& mesh) {
    if (!mBackend) return false;

    const Mesh* meshPtr = &mesh;
    mCurrentMesh = meshPtr;

    // Check if mesh is in cache
    auto it = mCache.find(meshPtr);

    // Get current mesh state for version check
    size_t vertCount = mesh.vertices().size();
    size_t indexCount = mesh.indices().size();

    // Simple version check - could use mesh's version counter if available
    uint32_t currentVersion = static_cast<uint32_t>(vertCount + indexCount * 1000);

    if (it != mCache.end()) {
        // Check if mesh needs updating
        if (it->second.meshVersion == currentVersion &&
            it->second.vertexCount == vertCount &&
            it->second.originalPrimitive == mesh.primitive()) {
            // Cache hit - buffers are up to date
            return true;
        }

        // Mesh changed - destroy old buffers
        if (it->second.vertexBuffer.valid()) {
            mBackend->destroyBuffer(it->second.vertexBuffer);
            mTotalBufferMemory -= it->second.vertexCount * sizeof(InterleavedVertex);
        }
        if (it->second.indexBuffer.valid()) {
            mBackend->destroyBuffer(it->second.indexBuffer);
            mTotalBufferMemory -= it->second.indexCount * sizeof(uint32_t);
        }
        mCache.erase(it);
    }

    // Create new cache entry
    MeshCacheEntry entry;
    entry.meshVersion = currentVersion;
    entry.layout = createVertexLayout();
    entry.originalPrimitive = mesh.primitive();

    // Create interleaved vertex data
    std::vector<InterleavedVertex> interleavedData;
    createInterleavedData(mesh, interleavedData);

    // Check if we need to convert unsupported primitives (TRIANGLE_FAN, LINE_LOOP)
    if (needsPrimitiveConversion(mesh.primitive())) {
        std::vector<InterleavedVertex> convertedVertices;
        std::vector<uint32_t> convertedIndices;

        entry.convertedPrimitive = convertPrimitive(
            mesh.primitive(),
            interleavedData,
            mesh.indices(),
            convertedVertices,
            convertedIndices
        );

        // Use converted data
        entry.vertexCount = convertedVertices.size();
        entry.indexCount = convertedIndices.size();
        entry.hasIndices = !convertedIndices.empty();

        // Create vertex buffer with converted data
        if (!convertedVertices.empty()) {
            entry.vertexBuffer = mBackend->createBuffer(
                BufferType::Vertex,
                BufferUsage::Dynamic,
                convertedVertices.data(),
                convertedVertices.size() * sizeof(InterleavedVertex)
            );
            mTotalBufferMemory += convertedVertices.size() * sizeof(InterleavedVertex);
        }

        // Create index buffer if needed
        if (entry.hasIndices) {
            entry.indexBuffer = mBackend->createBuffer(
                BufferType::Index,
                BufferUsage::Dynamic,
                convertedIndices.data(),
                convertedIndices.size() * sizeof(uint32_t)
            );
            mTotalBufferMemory += convertedIndices.size() * sizeof(uint32_t);
        }
    } else {
        // No conversion needed - use original primitive
        entry.convertedPrimitive = meshPrimitiveToPrimitiveType(mesh.primitive());
        entry.vertexCount = vertCount;
        entry.indexCount = indexCount;
        entry.hasIndices = indexCount > 0;

        // Create vertex buffer
        if (!interleavedData.empty()) {
            entry.vertexBuffer = mBackend->createBuffer(
                BufferType::Vertex,
                BufferUsage::Dynamic,
                interleavedData.data(),
                interleavedData.size() * sizeof(InterleavedVertex)
            );
            mTotalBufferMemory += interleavedData.size() * sizeof(InterleavedVertex);
        }

        // Create index buffer if needed
        if (entry.hasIndices) {
            const auto& indices = mesh.indices();
            entry.indexBuffer = mBackend->createBuffer(
                BufferType::Index,
                BufferUsage::Dynamic,
                indices.data(),
                indices.size() * sizeof(uint32_t)
            );
            mTotalBufferMemory += indices.size() * sizeof(uint32_t);
        }
    }

    mCache[meshPtr] = entry;
    return entry.vertexBuffer.valid();
}

void WebMeshAdapter::drawMesh(PrimitiveType primitive, int vertexCount) {
    if (!mBackend || !mCurrentMesh) return;

    auto it = mCache.find(mCurrentMesh);
    if (it == mCache.end()) return;

    const auto& entry = it->second;
    if (!entry.vertexBuffer.valid()) return;

    // Use the converted primitive type (handles TRIANGLE_FAN → TRIANGLES, etc.)
    PrimitiveType actualPrimitive = entry.convertedPrimitive;

    // Bind vertex buffer
    mBackend->setVertexBuffer(entry.vertexBuffer, entry.layout);

    int count = (vertexCount > 0) ? vertexCount : static_cast<int>(entry.vertexCount);

    if (entry.hasIndices && entry.indexBuffer.valid()) {
        // Indexed draw
        mBackend->setIndexBuffer(entry.indexBuffer, true); // 32-bit indices
        int indexCount = static_cast<int>(entry.indexCount);
        mBackend->drawIndexed(actualPrimitive, indexCount, 0, 0);
    } else {
        // Non-indexed draw
        mBackend->draw(actualPrimitive, count, 0);
    }
}

const MeshCacheEntry* WebMeshAdapter::getCacheEntry(const Mesh* mesh) const {
    auto it = mCache.find(mesh);
    return (it != mCache.end()) ? &it->second : nullptr;
}

void WebMeshAdapter::clearCache() {
    if (!mBackend) {
        mCache.clear();
        mTotalBufferMemory = 0;
        return;
    }

    for (auto& [meshPtr, entry] : mCache) {
        if (entry.vertexBuffer.valid()) {
            mBackend->destroyBuffer(entry.vertexBuffer);
        }
        if (entry.indexBuffer.valid()) {
            mBackend->destroyBuffer(entry.indexBuffer);
        }
    }
    mCache.clear();
    mTotalBufferMemory = 0;
    mCurrentMesh = nullptr;
}

void WebMeshAdapter::removeMesh(const Mesh* mesh) {
    auto it = mCache.find(mesh);
    if (it == mCache.end()) return;

    if (mBackend) {
        if (it->second.vertexBuffer.valid()) {
            mBackend->destroyBuffer(it->second.vertexBuffer);
            mTotalBufferMemory -= it->second.vertexCount * sizeof(InterleavedVertex);
        }
        if (it->second.indexBuffer.valid()) {
            mBackend->destroyBuffer(it->second.indexBuffer);
            mTotalBufferMemory -= it->second.indexCount * sizeof(uint32_t);
        }
    }
    mCache.erase(it);

    if (mCurrentMesh == mesh) {
        mCurrentMesh = nullptr;
    }
}

void WebMeshAdapter::createInterleavedData(
    const Mesh& mesh,
    std::vector<InterleavedVertex>& outVertices
) {
    const auto& positions = mesh.vertices();
    const auto& colors = mesh.colors();
    const auto& texCoords = mesh.texCoord2s();
    const auto& normals = mesh.normals();

    size_t vertexCount = positions.size();
    outVertices.resize(vertexCount);

    bool hasColors = !colors.empty();
    bool hasTexCoords = !texCoords.empty();
    bool hasNormals = !normals.empty();

    // Default values
    const float defaultColor[4] = {1.0f, 1.0f, 1.0f, 1.0f};
    const float defaultTexCoord[2] = {0.0f, 0.0f};
    const float defaultNormal[3] = {0.0f, 0.0f, 1.0f};

    for (size_t i = 0; i < vertexCount; ++i) {
        InterleavedVertex& v = outVertices[i];

        // Position
        v.position[0] = positions[i].x;
        v.position[1] = positions[i].y;
        v.position[2] = positions[i].z;

        // Color
        if (hasColors && i < colors.size()) {
            v.color[0] = colors[i].r;
            v.color[1] = colors[i].g;
            v.color[2] = colors[i].b;
            v.color[3] = colors[i].a;
        } else {
            memcpy(v.color, defaultColor, sizeof(defaultColor));
        }

        // Texture coordinates
        if (hasTexCoords && i < texCoords.size()) {
            v.texCoord[0] = texCoords[i].x;
            v.texCoord[1] = texCoords[i].y;
        } else {
            memcpy(v.texCoord, defaultTexCoord, sizeof(defaultTexCoord));
        }

        // Normal
        if (hasNormals && i < normals.size()) {
            v.normal[0] = normals[i].x;
            v.normal[1] = normals[i].y;
            v.normal[2] = normals[i].z;
        } else {
            memcpy(v.normal, defaultNormal, sizeof(defaultNormal));
        }
    }
}

VertexLayout WebMeshAdapter::createVertexLayout() {
    VertexLayout layout;
    layout.stride = sizeof(InterleavedVertex); // 48 bytes

    // Position: location 0, vec3f, offset 0
    layout.attributes.push_back({0, 3, 0, false});

    // Color: location 1, vec4f, offset 12
    layout.attributes.push_back({1, 4, 12, false});

    // TexCoord: location 2, vec2f, offset 28
    layout.attributes.push_back({2, 2, 28, false});

    // Normal: location 3, vec3f, offset 36
    layout.attributes.push_back({3, 3, 36, false});

    return layout;
}

PrimitiveType WebMeshAdapter::convertPrimitive(
    Mesh::Primitive primitive,
    const std::vector<InterleavedVertex>& vertices,
    const std::vector<unsigned int>& indices,
    std::vector<InterleavedVertex>& outVertices,
    std::vector<uint32_t>& outIndices
) {
    // Handle TRIANGLE_FAN conversion to TRIANGLES
    // TRIANGLE_FAN: v0 is center, draws triangles (v0,v1,v2), (v0,v2,v3), (v0,v3,v4), ...
    if (primitive == Mesh::TRIANGLE_FAN) {
        if (indices.empty()) {
            // Non-indexed TRIANGLE_FAN
            if (vertices.size() < 3) {
                outVertices = vertices;
                return PrimitiveType::Triangles;
            }

            // Convert to non-indexed TRIANGULAR
            // For n vertices, we get (n-2) triangles, each with 3 vertices
            size_t numTriangles = vertices.size() - 2;
            outVertices.reserve(numTriangles * 3);

            const InterleavedVertex& center = vertices[0];
            for (size_t i = 0; i < numTriangles; ++i) {
                outVertices.push_back(center);           // v0 (center)
                outVertices.push_back(vertices[i + 1]);  // v[i+1]
                outVertices.push_back(vertices[i + 2]);  // v[i+2]
            }

            printf("[WebMeshAdapter] Converted TRIANGLE_FAN (%zu verts) to TRIANGLES (%zu verts)\n",
                   vertices.size(), outVertices.size());
        } else {
            // Indexed TRIANGLE_FAN - convert indices
            if (indices.size() < 3) {
                outVertices = vertices;
                outIndices.assign(indices.begin(), indices.end());
                return PrimitiveType::Triangles;
            }

            outVertices = vertices; // Keep vertices as-is
            size_t numTriangles = indices.size() - 2;
            outIndices.reserve(numTriangles * 3);

            uint32_t centerIdx = indices[0];
            for (size_t i = 0; i < numTriangles; ++i) {
                outIndices.push_back(centerIdx);
                outIndices.push_back(indices[i + 1]);
                outIndices.push_back(indices[i + 2]);
            }

            printf("[WebMeshAdapter] Converted indexed TRIANGLE_FAN (%zu indices) to TRIANGLES (%zu indices)\n",
                   indices.size(), outIndices.size());
        }
        return PrimitiveType::Triangles;
    }

    // Handle LINE_LOOP conversion to LINES
    // LINE_LOOP: draws lines v0-v1, v1-v2, v2-v3, ..., v[n-1]-v0
    if (primitive == Mesh::LINE_LOOP) {
        if (indices.empty()) {
            // Non-indexed LINE_LOOP
            if (vertices.size() < 2) {
                outVertices = vertices;
                return PrimitiveType::Lines;
            }

            // Convert to non-indexed LINES
            // For n vertices, we get n lines, each with 2 vertices
            outVertices.reserve(vertices.size() * 2);

            for (size_t i = 0; i < vertices.size(); ++i) {
                outVertices.push_back(vertices[i]);
                outVertices.push_back(vertices[(i + 1) % vertices.size()]);
            }

            printf("[WebMeshAdapter] Converted LINE_LOOP (%zu verts) to LINES (%zu verts)\n",
                   vertices.size(), outVertices.size());
        } else {
            // Indexed LINE_LOOP - convert indices
            if (indices.size() < 2) {
                outVertices = vertices;
                outIndices.assign(indices.begin(), indices.end());
                return PrimitiveType::Lines;
            }

            outVertices = vertices;
            outIndices.reserve(indices.size() * 2);

            for (size_t i = 0; i < indices.size(); ++i) {
                outIndices.push_back(indices[i]);
                outIndices.push_back(indices[(i + 1) % indices.size()]);
            }

            printf("[WebMeshAdapter] Converted indexed LINE_LOOP (%zu indices) to LINES (%zu indices)\n",
                   indices.size(), outIndices.size());
        }
        return PrimitiveType::Lines;
    }

    // No conversion needed - shouldn't reach here if needsPrimitiveConversion() was checked
    outVertices = vertices;
    outIndices.assign(indices.begin(), indices.end());
    return meshPrimitiveToPrimitiveType(primitive);
}

} // namespace al
