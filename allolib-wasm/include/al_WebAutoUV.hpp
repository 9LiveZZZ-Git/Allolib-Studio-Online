/**
 * Automatic UV Coordinate Generation for AlloLib Meshes
 *
 * Provides utility functions to generate texture coordinates for any mesh
 * using various projection methods:
 * - Spherical: Projects UVs from center outward (good for round objects)
 * - Box/Cubic: Projects from 6 sides (good for arbitrary shapes)
 * - Planar: Projects from a single plane (good for flat objects)
 * - Cylindrical: Projects around Y axis (good for elongated objects)
 *
 * Usage:
 *   Mesh mesh;
 *   addSphere(mesh, 1.0, 32, 32);
 *   al::generateSphericalUVs(mesh);  // Add texture coordinates
 *
 *   // Or use the universal function:
 *   al::autoGenerateUVs(mesh);  // Auto-detects best projection
 */

#ifndef AL_WEB_AUTO_UV_HPP
#define AL_WEB_AUTO_UV_HPP

#include "al/graphics/al_Mesh.hpp"
#include <cmath>
#include <algorithm>

namespace al {

/**
 * UV projection modes
 */
enum class UVProjection {
    SPHERICAL,    // Project from center - good for spheres, rounded objects
    BOX,          // Project from 6 cube faces - good for complex shapes
    PLANAR_XY,    // Project onto XY plane
    PLANAR_XZ,    // Project onto XZ plane (top-down)
    PLANAR_YZ,    // Project onto YZ plane
    CYLINDRICAL,  // Project around Y axis
    AUTO          // Automatically choose based on mesh shape
};

/**
 * Generate spherical UV coordinates
 * Maps vertices based on their angle from center
 */
inline void generateSphericalUVs(Mesh& mesh, float scale = 1.0f) {
    auto& verts = mesh.vertices();
    mesh.texCoord2s().resize(verts.size());

    // Find center of mesh
    Vec3f center(0, 0, 0);
    for (const auto& v : verts) {
        center += v;
    }
    center /= (float)verts.size();

    for (size_t i = 0; i < verts.size(); i++) {
        Vec3f dir = verts[i] - center;
        dir.normalize();

        // Spherical to UV mapping
        float u = 0.5f + atan2(dir.z, dir.x) / (2.0f * M_PI);
        float v = 0.5f - asin(std::clamp(dir.y, -1.0f, 1.0f)) / M_PI;

        mesh.texCoord2s()[i] = Vec2f(u * scale, v * scale);
    }
}

/**
 * Generate cylindrical UV coordinates
 * Maps U around Y axis, V along Y height
 */
inline void generateCylindricalUVs(Mesh& mesh, float scale = 1.0f) {
    auto& verts = mesh.vertices();
    mesh.texCoord2s().resize(verts.size());

    // Find bounds
    float minY = verts[0].y, maxY = verts[0].y;
    Vec3f center(0, 0, 0);
    for (const auto& v : verts) {
        minY = std::min(minY, v.y);
        maxY = std::max(maxY, v.y);
        center.x += v.x;
        center.z += v.z;
    }
    center.x /= verts.size();
    center.z /= verts.size();
    float height = maxY - minY;
    if (height < 0.0001f) height = 1.0f;

    for (size_t i = 0; i < verts.size(); i++) {
        float dx = verts[i].x - center.x;
        float dz = verts[i].z - center.z;

        float u = 0.5f + atan2(dz, dx) / (2.0f * M_PI);
        float v = (verts[i].y - minY) / height;

        mesh.texCoord2s()[i] = Vec2f(u * scale, v * scale);
    }
}

/**
 * Generate planar UV coordinates
 * Projects vertices onto a plane
 */
inline void generatePlanarUVs(Mesh& mesh, UVProjection plane = UVProjection::PLANAR_XZ, float scale = 1.0f) {
    auto& verts = mesh.vertices();
    mesh.texCoord2s().resize(verts.size());

    // Find bounds for the chosen plane
    float minA = 1e10f, maxA = -1e10f;
    float minB = 1e10f, maxB = -1e10f;

    for (const auto& v : verts) {
        float a, b;
        switch (plane) {
            case UVProjection::PLANAR_XY: a = v.x; b = v.y; break;
            case UVProjection::PLANAR_YZ: a = v.y; b = v.z; break;
            case UVProjection::PLANAR_XZ:
            default: a = v.x; b = v.z; break;
        }
        minA = std::min(minA, a); maxA = std::max(maxA, a);
        minB = std::min(minB, b); maxB = std::max(maxB, b);
    }

    float rangeA = maxA - minA;
    float rangeB = maxB - minB;
    if (rangeA < 0.0001f) rangeA = 1.0f;
    if (rangeB < 0.0001f) rangeB = 1.0f;

    for (size_t i = 0; i < verts.size(); i++) {
        float a, b;
        switch (plane) {
            case UVProjection::PLANAR_XY: a = verts[i].x; b = verts[i].y; break;
            case UVProjection::PLANAR_YZ: a = verts[i].y; b = verts[i].z; break;
            case UVProjection::PLANAR_XZ:
            default: a = verts[i].x; b = verts[i].z; break;
        }

        float u = (a - minA) / rangeA;
        float v = (b - minB) / rangeB;

        mesh.texCoord2s()[i] = Vec2f(u * scale, v * scale);
    }
}

/**
 * Generate box-projected UV coordinates
 * Projects from the dominant face normal for each vertex
 */
inline void generateBoxUVs(Mesh& mesh, float scale = 1.0f) {
    auto& verts = mesh.vertices();
    auto& norms = mesh.normals();
    mesh.texCoord2s().resize(verts.size());

    // If no normals, generate them first
    if (norms.size() != verts.size()) {
        mesh.generateNormals();
    }

    // Find bounds
    Vec3f minV = verts[0], maxV = verts[0];
    for (const auto& v : verts) {
        minV.x = std::min(minV.x, v.x); maxV.x = std::max(maxV.x, v.x);
        minV.y = std::min(minV.y, v.y); maxV.y = std::max(maxV.y, v.y);
        minV.z = std::min(minV.z, v.z); maxV.z = std::max(maxV.z, v.z);
    }
    Vec3f range = maxV - minV;
    if (range.x < 0.0001f) range.x = 1.0f;
    if (range.y < 0.0001f) range.y = 1.0f;
    if (range.z < 0.0001f) range.z = 1.0f;

    for (size_t i = 0; i < verts.size(); i++) {
        Vec3f n = (norms.size() > i) ? norms[i] : Vec3f(0, 1, 0);
        Vec3f v = verts[i];

        float u, uv_v;

        // Choose projection based on dominant normal axis
        float ax = std::abs(n.x);
        float ay = std::abs(n.y);
        float az = std::abs(n.z);

        if (ax >= ay && ax >= az) {
            // Project onto YZ plane
            u = (v.z - minV.z) / range.z;
            uv_v = (v.y - minV.y) / range.y;
        } else if (ay >= ax && ay >= az) {
            // Project onto XZ plane
            u = (v.x - minV.x) / range.x;
            uv_v = (v.z - minV.z) / range.z;
        } else {
            // Project onto XY plane
            u = (v.x - minV.x) / range.x;
            uv_v = (v.y - minV.y) / range.y;
        }

        mesh.texCoord2s()[i] = Vec2f(u * scale, uv_v * scale);
    }
}

/**
 * Automatically generate UVs based on mesh shape
 * Analyzes the mesh and chooses the best projection method
 */
inline void autoGenerateUVs(Mesh& mesh, float scale = 1.0f) {
    auto& verts = mesh.vertices();
    if (verts.empty()) return;

    // Find bounding box
    Vec3f minV = verts[0], maxV = verts[0];
    Vec3f center(0, 0, 0);
    for (const auto& v : verts) {
        minV.x = std::min(minV.x, v.x); maxV.x = std::max(maxV.x, v.x);
        minV.y = std::min(minV.y, v.y); maxV.y = std::max(maxV.y, v.y);
        minV.z = std::min(minV.z, v.z); maxV.z = std::max(maxV.z, v.z);
        center += v;
    }
    center /= (float)verts.size();
    Vec3f size = maxV - minV;

    // Calculate how "spherical" the mesh is
    float avgDist = 0;
    float distVariance = 0;
    for (const auto& v : verts) {
        avgDist += (v - center).mag();
    }
    avgDist /= verts.size();

    for (const auto& v : verts) {
        float d = (v - center).mag();
        distVariance += (d - avgDist) * (d - avgDist);
    }
    distVariance /= verts.size();
    float distStdDev = sqrt(distVariance);

    // If vertices are roughly equidistant from center, use spherical
    if (avgDist > 0.001f && distStdDev / avgDist < 0.15f) {
        generateSphericalUVs(mesh, scale);
        return;
    }

    // Check if mesh is flat (one dimension much smaller)
    float minSize = std::min({size.x, size.y, size.z});
    float maxSize = std::max({size.x, size.y, size.z});

    if (minSize < maxSize * 0.1f) {
        // Flat mesh - use planar projection
        if (size.y <= size.x && size.y <= size.z) {
            generatePlanarUVs(mesh, UVProjection::PLANAR_XZ, scale);
        } else if (size.z <= size.x && size.z <= size.y) {
            generatePlanarUVs(mesh, UVProjection::PLANAR_XY, scale);
        } else {
            generatePlanarUVs(mesh, UVProjection::PLANAR_YZ, scale);
        }
        return;
    }

    // Check if mesh is elongated (cylindrical)
    if (size.y > size.x * 1.5f && size.y > size.z * 1.5f) {
        generateCylindricalUVs(mesh, scale);
        return;
    }

    // Default to box projection for complex shapes
    generateBoxUVs(mesh, scale);
}

/**
 * Generate UVs with specified projection type
 */
inline void generateUVs(Mesh& mesh, UVProjection projection, float scale = 1.0f) {
    switch (projection) {
        case UVProjection::SPHERICAL:
            generateSphericalUVs(mesh, scale);
            break;
        case UVProjection::BOX:
            generateBoxUVs(mesh, scale);
            break;
        case UVProjection::PLANAR_XY:
        case UVProjection::PLANAR_XZ:
        case UVProjection::PLANAR_YZ:
            generatePlanarUVs(mesh, projection, scale);
            break;
        case UVProjection::CYLINDRICAL:
            generateCylindricalUVs(mesh, scale);
            break;
        case UVProjection::AUTO:
        default:
            autoGenerateUVs(mesh, scale);
            break;
    }
}

} // namespace al

#endif // AL_WEB_AUTO_UV_HPP
