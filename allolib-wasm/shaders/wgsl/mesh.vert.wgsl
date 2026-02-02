/**
 * Mesh Vertex Shader - Per-vertex colors
 *
 * WGSL equivalent of al_mesh_vert_shader() from al_DefaultShaders.hpp
 *
 * Inputs:
 *   - position (location 0): vec3f vertex position
 *   - color (location 1): vec4f vertex color
 *
 * Outputs:
 *   - position: clip space position
 *   - color: interpolated vertex color
 */

struct Uniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    tint: vec4f,
    pointSize: f32,
    eyeSep: f32,
    focLen: f32,
    _pad: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
    @location(0) position: vec3f,
    @location(1) color: vec4f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
}

// Stereo displacement for flat (perspective) displays
fn stereo_displace_flat(v: vec4f, e: f32, f: f32) -> vec4f {
    var result = v;
    // eye to vertex distance
    let l = sqrt((v.x - e) * (v.x - e) + v.y * v.y + v.z * v.z);
    // absolute z-direction distance
    let z = abs(v.z);
    // x coord of projection of vertex on focal plane when looked from eye
    let t = f * (v.x - e) / z;
    // x coord of displaced vertex
    result.x = z * (e + t) / f;
    // normalize and set distance
    result = vec4f(normalize(result.xyz) * l, result.w);
    return result;
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    let worldPos = uniforms.modelViewMatrix * vec4f(in.position, 1.0);

    if (uniforms.eyeSep == 0.0) {
        out.position = uniforms.projectionMatrix * worldPos;
    } else {
        out.position = uniforms.projectionMatrix * stereo_displace_flat(worldPos, uniforms.eyeSep, uniforms.focLen);
    }

    out.color = in.color;
    return out;
}
