/**
 * Particle Render Vertex Shader
 *
 * Renders particles as camera-facing billboarded quads.
 * Each particle generates 4 vertices for a quad.
 *
 * Inputs:
 *   - vertex_index: Used to determine which corner of the quad
 *   - instance_index: Index into particle buffer
 *
 * Outputs:
 *   - position: clip space position
 *   - uv: texture coordinates for particle sprite
 *   - color: particle color with alpha
 */

struct Particle {
    position: vec3f,
    age: f32,
    velocity: vec3f,
    lifetime: f32,
    color: vec4f,
    size: f32,
    mass: f32,
    _pad0: f32,
    _pad1: f32,
}

struct RenderParams {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    cameraRight: vec3f,
    _pad0: f32,
    cameraUp: vec3f,
    _pad1: f32,
}

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: RenderParams;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) color: vec4f,
}

// Quad corners in local space
const QUAD_OFFSETS = array<vec2f, 6>(
    vec2f(-0.5, -0.5),  // Triangle 1
    vec2f( 0.5, -0.5),
    vec2f( 0.5,  0.5),
    vec2f(-0.5, -0.5),  // Triangle 2
    vec2f( 0.5,  0.5),
    vec2f(-0.5,  0.5)
);

const QUAD_UVS = array<vec2f, 6>(
    vec2f(0.0, 1.0),  // Triangle 1
    vec2f(1.0, 1.0),
    vec2f(1.0, 0.0),
    vec2f(0.0, 1.0),  // Triangle 2
    vec2f(1.0, 0.0),
    vec2f(0.0, 0.0)
);

@vertex
fn vs_main(
    @builtin(vertex_index) vertex_index: u32,
    @builtin(instance_index) instance_index: u32
) -> VertexOutput {
    var out: VertexOutput;

    let p = particles[instance_index];

    // Skip dead particles (move offscreen)
    if (p.age >= p.lifetime) {
        out.position = vec4f(0.0, 0.0, -1000.0, 1.0);
        out.uv = vec2f(0.0);
        out.color = vec4f(0.0);
        return out;
    }

    // Get quad corner offset
    let cornerIndex = vertex_index % 6u;
    let offset = QUAD_OFFSETS[cornerIndex];

    // Billboard: expand quad in camera space
    let worldPos = p.position +
        params.cameraRight * offset.x * p.size +
        params.cameraUp * offset.y * p.size;

    // Transform to clip space
    let viewPos = params.viewMatrix * vec4f(worldPos, 1.0);
    out.position = params.projectionMatrix * viewPos;

    out.uv = QUAD_UVS[cornerIndex];
    out.color = p.color;

    return out;
}
