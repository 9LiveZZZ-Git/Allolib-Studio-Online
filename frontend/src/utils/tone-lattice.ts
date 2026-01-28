/**
 * Tone Lattice math: prime decomposition, octave reduction, and grid generation.
 *
 * Harmonic space uses prime-3 (x-axis, fifths) and prime-5 (y-axis, thirds),
 * omitting prime-2 (octave equivalence).
 */

export interface LatticeNode {
  i: number             // prime-3 exponent
  j: number             // prime-5 exponent
  k: number             // prime-2 exponent (0 for 2D lattice)
  ratio: number         // octave-reduced ratio in [1, 2) for 2D; raw for 3D
  frequency: number     // actual frequency
  label: string         // e.g. "3/2", "5/4"
  cents: number         // cents from unison
  consonance: number    // 0-1, higher = more consonant (simpler ratio)
}

export interface LatticeEdge {
  from: [number, number, number]  // [i, j, k]
  to: [number, number, number]
  type: 'prime3' | 'prime5' | 'prime2'  // axis identification
}

/**
 * Octave-reduce a ratio to the range [1, 2).
 */
export function octaveReduce(r: number): number {
  if (r <= 0) return 1
  while (r >= 2) r /= 2
  while (r < 1) r *= 2
  return r
}

/**
 * Compute the raw ratio for lattice position (i, j):
 *   ratio = 3^i * 5^j
 * Then octave-reduce.
 */
function latticeRatio(i: number, j: number): number {
  return octaveReduce(Math.pow(3, i) * Math.pow(5, j))
}

/**
 * Express a ratio as a fraction string.
 * For simple lattice positions, return known names;
 * for others, approximate as "num/den".
 */
function ratioLabel(i: number, j: number): string {
  const ratio = latticeRatio(i, j)

  // Known simple fractions
  const known: Record<string, string> = {
    '1': '1/1',
    '1.5': '3/2',
    '1.25': '5/4',
    '1.333333': '4/3',
    '1.666667': '5/3',
    '1.875': '15/8',
    '1.125': '9/8',
    '1.6': '8/5',
    '1.2': '6/5',
    '1.066667': '16/15',
    '1.111111': '10/9',
    '1.8': '9/5',
    '1.404664': '45/32',
    '1.6875': '27/16',
  }

  const key = ratio.toFixed(6)
  if (known[key]) return known[key]

  // Try to find a simple fraction by brute force
  for (let d = 1; d <= 32; d++) {
    const n = Math.round(ratio * d)
    if (Math.abs(n / d - ratio) < 0.001) {
      return `${n}/${d}`
    }
  }

  return ratio.toFixed(3)
}

/**
 * Consonance metric: inverse of the sum of absolute exponents.
 * Simpler ratios (smaller exponents) are more consonant.
 */
function consonanceScore(i: number, j: number): number {
  const complexity = Math.abs(i) + Math.abs(j)
  if (complexity === 0) return 1
  return 1 / (1 + complexity * 0.4)
}

/**
 * Ratio to cents (1200 * log2(ratio)).
 */
function ratioCents(ratio: number): number {
  return 1200 * Math.log2(ratio)
}

/**
 * Generate 2D lattice nodes for the given range (octave-reduced).
 */
export function generateLattice(
  fundamental: number,
  rangeI: number = 3,
  rangeJ: number = 3,
): { nodes: LatticeNode[]; edges: LatticeEdge[] } {
  const nodes: LatticeNode[] = []
  const edges: LatticeEdge[] = []

  for (let i = -rangeI; i <= rangeI; i++) {
    for (let j = -rangeJ; j <= rangeJ; j++) {
      const ratio = latticeRatio(i, j)
      nodes.push({
        i,
        j,
        k: 0,
        ratio,
        frequency: fundamental * ratio,
        label: ratioLabel(i, j),
        cents: ratioCents(ratio),
        consonance: consonanceScore(i, j),
      })

      // Edges: connect to neighbors within range
      if (i + 1 <= rangeI) {
        edges.push({ from: [i, j, 0], to: [i + 1, j, 0], type: 'prime3' })
      }
      if (j + 1 <= rangeJ) {
        edges.push({ from: [i, j, 0], to: [i, j + 1, 0], type: 'prime5' })
      }
    }
  }

  return { nodes, edges }
}

/**
 * Consonance metric for 3D nodes (includes k/octave exponent).
 */
function consonanceScore3D(i: number, j: number, k: number): number {
  const complexity = Math.abs(i) + Math.abs(j) + Math.abs(k) * 0.3
  if (complexity === 0) return 1
  return 1 / (1 + complexity * 0.4)
}

/**
 * Generate 3D 5-limit lattice (no octave reduction).
 * Ratio = 2^k * 3^i * 5^j
 */
export function generateLattice3D(
  fundamental: number,
  rangeI: number = 3,
  rangeJ: number = 3,
  rangeK: number = 2,
): { nodes: LatticeNode[]; edges: LatticeEdge[] } {
  const nodes: LatticeNode[] = []
  const edges: LatticeEdge[] = []

  for (let i = -rangeI; i <= rangeI; i++) {
    for (let j = -rangeJ; j <= rangeJ; j++) {
      for (let k = -rangeK; k <= rangeK; k++) {
        const rawRatio = Math.pow(2, k) * Math.pow(3, i) * Math.pow(5, j)
        const ratio = rawRatio > 0 ? rawRatio : 1
        const frequency = fundamental * ratio
        const label = ratioLabel(i, j) // base label from 2D position
        const cents = 1200 * Math.log2(ratio)

        nodes.push({
          i,
          j,
          k,
          ratio,
          frequency,
          label: k === 0 ? label : `${label} (${k >= 0 ? '+' : ''}${k}oct)`,
          cents,
          consonance: consonanceScore3D(i, j, k),
        })

        // Edges along each axis
        if (i + 1 <= rangeI) {
          edges.push({ from: [i, j, k], to: [i + 1, j, k], type: 'prime3' })
        }
        if (j + 1 <= rangeJ) {
          edges.push({ from: [i, j, k], to: [i, j + 1, k], type: 'prime5' })
        }
        if (k + 1 <= rangeK) {
          edges.push({ from: [i, j, k], to: [i, j, k + 1], type: 'prime2' })
        }
      }
    }
  }

  return { nodes, edges }
}

/**
 * Isometric projection of a 3D lattice coordinate to 2D screen space,
 * with optional rotation around X and Y axes.
 *
 * @param rotX  Rotation around X axis in degrees (tilt up/down)
 * @param rotY  Rotation around Y axis in degrees (spin left/right)
 */
export function isometricProject(
  i: number, j: number, k: number,
  spacingX: number, spacingY: number, spacingZ: number,
  cx: number, cy: number,
  rotX: number = 0, rotY: number = 0,
): { x: number; y: number; depth: number } {
  // Base isometric axes
  const cos30 = Math.cos(Math.PI / 6)  // ~0.866
  const sin30 = Math.sin(Math.PI / 6)  // 0.5

  // Start with 3D position
  let x3d = i * spacingX
  let y3d = j * spacingY
  let z3d = k * spacingZ

  // Apply Y rotation (spin)
  if (rotY !== 0) {
    const ry = rotY * Math.PI / 180
    const cosR = Math.cos(ry)
    const sinR = Math.sin(ry)
    const nx = x3d * cosR + z3d * sinR
    const nz = -x3d * sinR + z3d * cosR
    x3d = nx
    z3d = nz
  }

  // Apply X rotation (tilt)
  if (rotX !== 0) {
    const rx = rotX * Math.PI / 180
    const cosR = Math.cos(rx)
    const sinR = Math.sin(rx)
    const ny = y3d * cosR - z3d * sinR
    const nz = y3d * sinR + z3d * cosR
    y3d = ny
    z3d = nz
  }

  // Isometric projection to screen
  return {
    x: cx + x3d + z3d * cos30,
    y: cy - y3d - z3d * sin30,
    depth: z3d,
  }
}

/**
 * Find the closest lattice node to a given frequency.
 * In 3D mode, optionally filter by octave layer.
 */
export function findClosestNode(
  nodes: LatticeNode[],
  frequency: number,
  octaveFilter?: number | null,
): LatticeNode | null {
  const filtered = octaveFilter != null
    ? nodes.filter(n => n.k === octaveFilter)
    : nodes
  if (filtered.length === 0) return null

  let closest = filtered[0]
  let minDist = Math.abs(Math.log2(frequency / closest.frequency))

  for (const node of filtered) {
    const dist = Math.abs(Math.log2(frequency / node.frequency))
    if (dist < minDist) {
      minDist = dist
      closest = node
    }
  }

  return closest
}
