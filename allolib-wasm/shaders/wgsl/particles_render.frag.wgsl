/**
 * Particle Render Fragment Shader
 *
 * Renders particle sprites with soft circular falloff.
 * Supports optional sprite texture.
 *
 * Inputs:
 *   - uv (location 0): texture coordinates
 *   - color (location 1): particle color with alpha
 *
 * Output:
 *   - Final particle color with alpha blending
 */

@group(0) @binding(2) var particleTexture: texture_2d<f32>;
@group(0) @binding(3) var particleSampler: sampler;

struct FragmentInput {
    @location(0) uv: vec2f,
    @location(1) color: vec4f,
}

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4f {
    // Soft circular falloff
    let center = vec2f(0.5);
    let dist = length(in.uv - center) * 2.0;

    // Smooth circle with soft edges
    let alpha = 1.0 - smoothstep(0.8, 1.0, dist);

    // Discard fully transparent pixels
    if (alpha < 0.01) {
        discard;
    }

    // Sample texture if available (optional - can use uniform to toggle)
    // let texColor = textureSample(particleTexture, particleSampler, in.uv);

    // Final color with particle alpha and circular falloff
    var finalColor = in.color;
    finalColor.a *= alpha;

    return finalColor;
}
