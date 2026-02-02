/**
 * Textured Vertex Shader
 *
 * WGSL equivalent of al_tex_vert_shader() from al_DefaultShaders.hpp
 *
 * Inputs:
 *   - position (location 0): vec3f vertex position
 *   - texcoord (location 2): vec2f texture coordinates
 *
 * Outputs:
 *   - position: clip space position
 *   - texcoord: interpolated texture coordinates
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
    @location(2) texcoord: vec2f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) texcoord: vec2f,
}

// Stereo displacement for flat (perspective) displays
fn stereo_displace_flat(v: vec4f, e: f32, f: f32) -> vec4f {
    var result = v;
    let l = sqrt((v.x - e) * (v.x - e) + v.y * v.y + v.z * v.z);
    let z = abs(v.z);
    let t = f * (v.x - e) / z;
    result.x = z * (e + t) / f;
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

    out.texcoord = in.texcoord;
    return out;
}
