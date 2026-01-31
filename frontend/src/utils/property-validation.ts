/**
 * Property Validation System
 *
 * Provides type-safe property definitions with validation
 * for all animatable properties in the timeline system.
 *
 * Features:
 * - Typed property definitions (number, vec2, vec3, color, enum, etc.)
 * - Min/max/step constraints
 * - Validation before value application
 * - Grouped property organization
 * - Metadata for UI generation
 */

// ─── Property Types ──────────────────────────────────────────────────────────

export type PropertyType =
  | 'number'
  | 'vec2'
  | 'vec3'
  | 'vec4'
  | 'color'
  | 'boolean'
  | 'string'
  | 'enum'
  | 'angle'     // Degrees, wraps at 360
  | 'percentage' // 0-100 displayed, 0-1 stored

export interface PropertyDefinition {
  /** Property type for validation and UI */
  type: PropertyType

  /** Default value */
  default: any

  /** Human-readable label */
  label?: string

  /** Group for UI organization */
  group?: string

  /** Tooltip/description */
  description?: string

  /** For number types: minimum value */
  min?: number

  /** For number types: maximum value */
  max?: number

  /** For number types: step increment */
  step?: number

  /** For enum types: allowed values */
  options?: string[]

  /** For enum types: option labels */
  optionLabels?: Record<string, string>

  /** Whether property is keyframeable */
  animatable?: boolean

  /** Unit suffix for display (e.g., '°', 'px', '%') */
  unit?: string
}

// ─── Validation Result ───────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  value: any       // Corrected/clamped value
  error?: string   // Error message if invalid
  warning?: string // Warning if value was adjusted
}

// ─── Transform Properties ────────────────────────────────────────────────────

export const TRANSFORM_PROPERTIES: Record<string, PropertyDefinition> = {
  'position.x': {
    type: 'number',
    default: 0,
    label: 'X',
    group: 'Position',
    animatable: true,
    step: 0.1,
  },
  'position.y': {
    type: 'number',
    default: 0,
    label: 'Y',
    group: 'Position',
    animatable: true,
    step: 0.1,
  },
  'position.z': {
    type: 'number',
    default: 0,
    label: 'Z',
    group: 'Position',
    animatable: true,
    step: 0.1,
  },
  'rotation.x': {
    type: 'angle',
    default: 0,
    min: -360,
    max: 360,
    step: 1,
    label: 'X',
    group: 'Rotation',
    unit: '°',
    animatable: true,
  },
  'rotation.y': {
    type: 'angle',
    default: 0,
    min: -360,
    max: 360,
    step: 1,
    label: 'Y',
    group: 'Rotation',
    unit: '°',
    animatable: true,
  },
  'rotation.z': {
    type: 'angle',
    default: 0,
    min: -360,
    max: 360,
    step: 1,
    label: 'Z',
    group: 'Rotation',
    unit: '°',
    animatable: true,
  },
  'scale.x': {
    type: 'number',
    default: 1,
    min: 0.001,
    step: 0.1,
    label: 'X',
    group: 'Scale',
    animatable: true,
  },
  'scale.y': {
    type: 'number',
    default: 1,
    min: 0.001,
    step: 0.1,
    label: 'Y',
    group: 'Scale',
    animatable: true,
  },
  'scale.z': {
    type: 'number',
    default: 1,
    min: 0.001,
    step: 0.1,
    label: 'Z',
    group: 'Scale',
    animatable: true,
  },
  'scale.uniform': {
    type: 'number',
    default: 1,
    min: 0.001,
    step: 0.1,
    label: 'Uniform',
    group: 'Scale',
    description: 'Scale all axes uniformly',
    animatable: true,
  },
}

// ─── Material Properties ─────────────────────────────────────────────────────

export const MATERIAL_PROPERTIES: Record<string, PropertyDefinition> = {
  'color': {
    type: 'color',
    default: [1, 1, 1, 1],
    label: 'Color',
    group: 'Material',
    animatable: true,
  },
  'opacity': {
    type: 'percentage',
    default: 1,
    min: 0,
    max: 1,
    step: 0.01,
    label: 'Opacity',
    group: 'Material',
    unit: '%',
    animatable: true,
  },
  'metallic': {
    type: 'number',
    default: 0,
    min: 0,
    max: 1,
    step: 0.01,
    label: 'Metallic',
    group: 'PBR',
    animatable: true,
  },
  'roughness': {
    type: 'number',
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
    label: 'Roughness',
    group: 'PBR',
    animatable: true,
  },
  'emissive': {
    type: 'number',
    default: 0,
    min: 0,
    max: 10,
    step: 0.1,
    label: 'Emissive',
    group: 'PBR',
    description: 'Self-illumination intensity',
    animatable: true,
  },
  'emissiveColor': {
    type: 'color',
    default: [1, 1, 1, 1],
    label: 'Emissive Color',
    group: 'PBR',
    animatable: true,
  },
}

// ─── Environment Properties ──────────────────────────────────────────────────

export const ENVIRONMENT_PROPERTIES: Record<string, PropertyDefinition> = {
  'backgroundColor': {
    type: 'color',
    default: [0.1, 0.1, 0.15, 1],
    label: 'Background',
    group: 'Scene',
    animatable: true,
  },
  'fog.enabled': {
    type: 'boolean',
    default: false,
    label: 'Enabled',
    group: 'Fog',
    animatable: false,
  },
  'fog.near': {
    type: 'number',
    default: 10,
    min: 0,
    step: 1,
    label: 'Near',
    group: 'Fog',
    animatable: true,
  },
  'fog.far': {
    type: 'number',
    default: 100,
    min: 0,
    step: 1,
    label: 'Far',
    group: 'Fog',
    animatable: true,
  },
  'fog.color': {
    type: 'color',
    default: [0.5, 0.5, 0.5, 1],
    label: 'Color',
    group: 'Fog',
    animatable: true,
  },
  'fog.density': {
    type: 'number',
    default: 0.01,
    min: 0,
    max: 1,
    step: 0.001,
    label: 'Density',
    group: 'Fog',
    animatable: true,
  },
  'ambient.color': {
    type: 'color',
    default: [1, 1, 1, 1],
    label: 'Color',
    group: 'Ambient',
    animatable: true,
  },
  'ambient.intensity': {
    type: 'number',
    default: 0.3,
    min: 0,
    max: 2,
    step: 0.01,
    label: 'Intensity',
    group: 'Ambient',
    animatable: true,
  },
}

// ─── All Properties Combined ─────────────────────────────────────────────────

export const ALL_PROPERTIES: Record<string, PropertyDefinition> = {
  ...TRANSFORM_PROPERTIES,
  ...MATERIAL_PROPERTIES,
  ...ENVIRONMENT_PROPERTIES,
}

// ─── Validation Functions ────────────────────────────────────────────────────

/**
 * Validate a value against a property definition
 */
export function validatePropertyValue(
  definition: PropertyDefinition,
  value: any
): ValidationResult {
  switch (definition.type) {
    case 'number':
    case 'angle':
    case 'percentage':
      return validateNumber(definition, value)

    case 'vec2':
      return validateVector(definition, value, 2)

    case 'vec3':
      return validateVector(definition, value, 3)

    case 'vec4':
    case 'color':
      return validateVector(definition, value, 4)

    case 'boolean':
      return validateBoolean(value)

    case 'string':
      return validateString(value)

    case 'enum':
      return validateEnum(definition, value)

    default:
      return { valid: true, value }
  }
}

function validateNumber(def: PropertyDefinition, value: any): ValidationResult {
  const num = Number(value)

  if (isNaN(num)) {
    return {
      valid: false,
      value: def.default,
      error: 'Must be a number',
    }
  }

  let corrected = num
  let warning: string | undefined

  // Apply min/max constraints
  if (def.min !== undefined && corrected < def.min) {
    corrected = def.min
    warning = `Value clamped to minimum ${def.min}`
  }

  if (def.max !== undefined && corrected > def.max) {
    corrected = def.max
    warning = `Value clamped to maximum ${def.max}`
  }

  // Handle angle wrapping
  if (def.type === 'angle') {
    while (corrected > 360) corrected -= 360
    while (corrected < -360) corrected += 360
  }

  return {
    valid: true,
    value: corrected,
    warning,
  }
}

function validateVector(
  def: PropertyDefinition,
  value: any,
  length: number
): ValidationResult {
  if (!Array.isArray(value)) {
    return {
      valid: false,
      value: def.default,
      error: `Must be an array of ${length} numbers`,
    }
  }

  if (value.length !== length) {
    return {
      valid: false,
      value: def.default,
      error: `Must have exactly ${length} components`,
    }
  }

  const corrected: number[] = []
  let hasWarning = false

  for (let i = 0; i < length; i++) {
    const num = Number(value[i])
    if (isNaN(num)) {
      return {
        valid: false,
        value: def.default,
        error: `Component ${i} must be a number`,
      }
    }

    let comp = num

    // For colors, clamp to 0-1
    if (def.type === 'color') {
      if (comp < 0) {
        comp = 0
        hasWarning = true
      }
      if (comp > 1) {
        comp = 1
        hasWarning = true
      }
    }

    corrected.push(comp)
  }

  return {
    valid: true,
    value: corrected,
    warning: hasWarning ? 'Color values clamped to 0-1' : undefined,
  }
}

function validateBoolean(value: any): ValidationResult {
  if (typeof value === 'boolean') {
    return { valid: true, value }
  }

  if (value === 0 || value === '0' || value === 'false') {
    return { valid: true, value: false }
  }

  if (value === 1 || value === '1' || value === 'true') {
    return { valid: true, value: true }
  }

  return {
    valid: false,
    value: false,
    error: 'Must be a boolean',
  }
}

function validateString(value: any): ValidationResult {
  if (typeof value === 'string') {
    return { valid: true, value }
  }

  return {
    valid: true,
    value: String(value),
    warning: 'Converted to string',
  }
}

function validateEnum(def: PropertyDefinition, value: any): ValidationResult {
  if (!def.options) {
    return { valid: true, value }
  }

  if (def.options.includes(String(value))) {
    return { valid: true, value: String(value) }
  }

  return {
    valid: false,
    value: def.options[0] ?? def.default,
    error: `Must be one of: ${def.options.join(', ')}`,
  }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Get property definition by name
 */
export function getPropertyDefinition(propertyName: string): PropertyDefinition | undefined {
  return ALL_PROPERTIES[propertyName]
}

/**
 * Get all properties in a group
 */
export function getPropertiesInGroup(group: string): Record<string, PropertyDefinition> {
  const result: Record<string, PropertyDefinition> = {}

  for (const [name, def] of Object.entries(ALL_PROPERTIES)) {
    if (def.group === group) {
      result[name] = def
    }
  }

  return result
}

/**
 * Get all unique property groups
 */
export function getPropertyGroups(): string[] {
  const groups = new Set<string>()

  for (const def of Object.values(ALL_PROPERTIES)) {
    if (def.group) {
      groups.add(def.group)
    }
  }

  return Array.from(groups)
}

/**
 * Check if a property is animatable
 */
export function isAnimatable(propertyName: string): boolean {
  const def = ALL_PROPERTIES[propertyName]
  return def?.animatable !== false
}

/**
 * Get default value for a property
 */
export function getDefaultValue(propertyName: string): any {
  return ALL_PROPERTIES[propertyName]?.default
}

/**
 * Validate and coerce a value for a property
 * Returns the validated/clamped value, or throws on error
 */
export function coercePropertyValue(propertyName: string, value: any): any {
  const def = ALL_PROPERTIES[propertyName]
  if (!def) {
    console.warn(`[Validation] Unknown property: ${propertyName}`)
    return value
  }

  const result = validatePropertyValue(def, value)

  if (!result.valid) {
    console.warn(`[Validation] Invalid value for ${propertyName}: ${result.error}`)
    return result.value  // Return default/corrected value
  }

  if (result.warning) {
    console.debug(`[Validation] ${propertyName}: ${result.warning}`)
  }

  return result.value
}
