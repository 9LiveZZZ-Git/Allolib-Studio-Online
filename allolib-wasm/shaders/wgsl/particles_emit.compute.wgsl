/**
 * Particle Emit Compute Shader
 *
 * Spawns new particles by finding dead particles and reinitializing them.
 * Uses atomic counter for thread-safe particle allocation.
 *
 * Workgroup size: 64 particles per group
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

struct EmitParams {
    emitPosition: vec3f,
    emitCount: u32,
    emitDirection: vec3f,
    spread: f32,
    minSpeed: f32,
    maxSpeed: f32,
    minLifetime: f32,
    maxLifetime: f32,
    startColor: vec4f,
    endColor: vec4f,
    startSize: f32,
    endSize: f32,
    time: f32,
    particleCount: u32,
}

struct AtomicCounter {
    count: atomic<u32>,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: EmitParams;
@group(0) @binding(2) var<storage, read_write> emitCounter: AtomicCounter;

// Simple hash function for random numbers
fn hash(n: u32) -> f32 {
    var x = n;
    x = ((x >> 16u) ^ x) * 0x45d9f3bu;
    x = ((x >> 16u) ^ x) * 0x45d9f3bu;
    x = (x >> 16u) ^ x;
    return f32(x) / f32(0xffffffffu);
}

// Generate random vec3 in unit sphere
fn randomInSphere(seed: u32) -> vec3f {
    let theta = hash(seed) * 6.28318530718;
    let phi = acos(2.0 * hash(seed + 1u) - 1.0);
    let r = pow(hash(seed + 2u), 1.0 / 3.0);

    return vec3f(
        r * sin(phi) * cos(theta),
        r * sin(phi) * sin(theta),
        r * cos(phi)
    );
}

// Generate random direction in cone around given direction
fn randomInCone(dir: vec3f, spread: f32, seed: u32) -> vec3f {
    // Generate random point in unit disk
    let angle = hash(seed) * 6.28318530718;
    let radius = sqrt(hash(seed + 1u)) * tan(spread);

    // Build orthonormal basis around direction
    var up = vec3f(0.0, 1.0, 0.0);
    if (abs(dot(dir, up)) > 0.99) {
        up = vec3f(1.0, 0.0, 0.0);
    }

    let right = normalize(cross(up, dir));
    let forward = cross(dir, right);

    // Combine to get cone direction
    let offset = right * cos(angle) * radius + forward * sin(angle) * radius;
    return normalize(dir + offset);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let index = global_id.x;

    if (index >= params.particleCount) {
        return;
    }

    var p = particles[index];

    // Only emit into dead particles
    if (p.age < p.lifetime) {
        return;
    }

    // Check if we should emit more
    let emitted = atomicAdd(&emitCounter.count, 1u);
    if (emitted >= params.emitCount) {
        return;
    }

    // Generate unique seed for this particle
    let seed = index * 7u + u32(params.time * 1000.0);

    // Initialize particle
    p.position = params.emitPosition;

    // Random velocity in cone
    let dir = randomInCone(params.emitDirection, params.spread, seed);
    let speed = mix(params.minSpeed, params.maxSpeed, hash(seed + 10u));
    p.velocity = dir * speed;

    // Random lifetime
    p.lifetime = mix(params.minLifetime, params.maxLifetime, hash(seed + 20u));
    p.age = 0.0;

    // Initial color and size
    p.color = params.startColor;
    p.size = params.startSize;
    p.mass = 1.0;

    particles[index] = p;
}
