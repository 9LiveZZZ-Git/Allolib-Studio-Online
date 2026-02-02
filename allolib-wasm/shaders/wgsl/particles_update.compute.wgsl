/**
 * Particle Update Compute Shader
 *
 * Updates particle positions, velocities, and ages.
 * Implements physics simulation with:
 *   - Velocity integration
 *   - Gravity
 *   - Curl noise turbulence
 *   - Damping
 *   - Age progression
 *
 * Workgroup size: 256 particles per group
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

struct SimParams {
    deltaTime: f32,
    time: f32,
    damping: f32,
    noiseScale: f32,
    noiseStrength: f32,
    particleCount: u32,
    _pad0: u32,
    _pad1: u32,
    gravity: vec3f,
    _pad2: f32,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;

// Simplex noise helpers
fn mod289(x: vec3f) -> vec3f {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_4(x: vec4f) -> vec4f {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute(x: vec4f) -> vec4f {
    return mod289_4(((x * 34.0) + 1.0) * x);
}

fn taylorInvSqrt(r: vec4f) -> vec4f {
    return 1.79284291400159 - 0.85373472095314 * r;
}

// Simplified 3D noise for curl noise
fn snoise(v: vec3f) -> f32 {
    let C = vec2f(1.0 / 6.0, 1.0 / 3.0);
    let D = vec4f(0.0, 0.5, 1.0, 2.0);

    var i = floor(v + dot(v, vec3f(C.y)));
    let x0 = v - i + dot(i, vec3f(C.x));

    let g = step(x0.yzx, x0.xyz);
    let l = 1.0 - g;
    let i1 = min(g.xyz, l.zxy);
    let i2 = max(g.xyz, l.zxy);

    let x1 = x0 - i1 + vec3f(C.x);
    let x2 = x0 - i2 + vec3f(C.y);
    let x3 = x0 - vec3f(D.y);

    i = mod289(i);
    let p = permute(permute(permute(
        i.z + vec4f(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4f(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4f(0.0, i1.x, i2.x, 1.0));

    let n_ = 0.142857142857;
    let ns = n_ * D.wyz - D.xzx;

    let j = p - 49.0 * floor(p * ns.z * ns.z);

    let x_ = floor(j * ns.z);
    let y_ = floor(j - 7.0 * x_);

    let x = x_ * ns.x + vec4f(ns.y);
    let y = y_ * ns.x + vec4f(ns.y);
    let h = 1.0 - abs(x) - abs(y);

    let b0 = vec4f(x.xy, y.xy);
    let b1 = vec4f(x.zw, y.zw);

    let s0 = floor(b0) * 2.0 + 1.0;
    let s1 = floor(b1) * 2.0 + 1.0;
    let sh = -step(h, vec4f(0.0));

    let a0 = b0.xzyw + s0.xzyw * vec4f(sh.x, sh.x, sh.y, sh.y);
    let a1 = b1.xzyw + s1.xzyw * vec4f(sh.z, sh.z, sh.w, sh.w);

    var p0 = vec3f(a0.xy, h.x);
    var p1 = vec3f(a0.zw, h.y);
    var p2 = vec3f(a1.xy, h.z);
    var p3 = vec3f(a1.zw, h.w);

    let norm = taylorInvSqrt(vec4f(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    var m = max(0.6 - vec4f(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4f(0.0));
    m = m * m;
    return 42.0 * dot(m * m, vec4f(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Curl noise for organic turbulence
fn curlNoise(p: vec3f) -> vec3f {
    let e = 0.0001;

    let dx = vec3f(e, 0.0, 0.0);
    let dy = vec3f(0.0, e, 0.0);
    let dz = vec3f(0.0, 0.0, e);

    let p_x0 = snoise(p - dx);
    let p_x1 = snoise(p + dx);
    let p_y0 = snoise(p - dy);
    let p_y1 = snoise(p + dy);
    let p_z0 = snoise(p - dz);
    let p_z1 = snoise(p + dz);

    let x = (p_y1 - p_y0) - (p_z1 - p_z0);
    let y = (p_z1 - p_z0) - (p_x1 - p_x0);
    let z = (p_x1 - p_x0) - (p_y1 - p_y0);

    return normalize(vec3f(x, y, z)) / (2.0 * e);
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;

    if (index >= params.particleCount) {
        return;
    }

    var p = particles[index];

    // Skip dead particles
    if (p.age >= p.lifetime) {
        return;
    }

    // Age the particle
    p.age += params.deltaTime;

    // Apply gravity
    p.velocity += params.gravity * params.deltaTime;

    // Apply curl noise turbulence
    let noisePos = p.position * params.noiseScale + vec3f(params.time * 0.1);
    let turbulence = curlNoise(noisePos) * params.noiseStrength;
    p.velocity += turbulence * params.deltaTime;

    // Apply damping
    p.velocity *= 1.0 - params.damping * params.deltaTime;

    // Integrate position
    p.position += p.velocity * params.deltaTime;

    // Update size and color based on age (fade out)
    let lifeRatio = p.age / p.lifetime;
    p.color.a = 1.0 - lifeRatio;  // Fade out alpha

    particles[index] = p;
}
