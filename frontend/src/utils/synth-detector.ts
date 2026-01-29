/**
 * Detects synth classes from C++ source code by scanning for
 * SynthGUIManager<ClassName> patterns and extracting parameter
 * definitions from createInternalTriggerParameter calls.
 */

export interface SynthParamDef {
  name: string
  defaultValue: number
  min: number
  max: number
}

export interface DetectedSynth {
  className: string     // template param: SineEnv
  displayName: string   // string literal: "SineEnv"
  sourceFile: string    // which file it was found in
  params: SynthParamDef[]  // parameters from createInternalTriggerParameter
}

// Matches: SynthGUIManager<ClassName> varName{"DisplayName"}
const SYNTH_MANAGER_REGEX = /SynthGUIManager\s*<\s*(\w+)\s*>\s+\w+\s*\{\s*"([^"]+)"\s*\}/g

// Matches: class ClassName : public SynthVoice
const CLASS_DEF_REGEX = /class\s+(\w+)\s*:\s*public\s+SynthVoice\b/g

// Matches: createInternalTriggerParameter("name", default, min, max)
// Handles 2-arg (name, default) and 4-arg (name, default, min, max) forms
const PARAM_REGEX = /createInternalTriggerParameter\s*\(\s*"([^"]+)"\s*,\s*([0-9eE.+-]+)\s*(?:,\s*([0-9eE.+-]+)\s*,\s*([0-9eE.+-]+)\s*)?\)/g

/**
 * Extract parameters defined within a class body by scanning for
 * createInternalTriggerParameter calls between this class declaration
 * and the next class declaration (or end of file).
 */
function extractClassParams(content: string, classStart: number, nextClassStart: number): SynthParamDef[] {
  const classBody = content.substring(classStart, nextClassStart)
  const params: SynthParamDef[] = []
  const regex = new RegExp(PARAM_REGEX.source, 'g')
  let match: RegExpExecArray | null
  while ((match = regex.exec(classBody)) !== null) {
    params.push({
      name: match[1],
      defaultValue: parseFloat(match[2]),
      min: match[3] !== undefined ? parseFloat(match[3]) : -9999,
      max: match[4] !== undefined ? parseFloat(match[4]) : 9999,
    })
  }
  return params
}

/**
 * Build a map of className → SynthParamDef[] by scanning all files for
 * class definitions that extend SynthVoice and their parameter registrations.
 */
function buildClassParamMap(
  files: Array<{ name: string; content: string }>
): Map<string, SynthParamDef[]> {
  const map = new Map<string, SynthParamDef[]>()

  for (const file of files) {
    if (!/\.(cpp|hpp|h|c)$/i.test(file.name)) continue

    // Find all class declarations in this file
    const classRegex = new RegExp(CLASS_DEF_REGEX.source, 'g')
    const classPositions: Array<{ name: string; start: number }> = []
    let match: RegExpExecArray | null
    while ((match = classRegex.exec(file.content)) !== null) {
      classPositions.push({ name: match[1], start: match.index })
    }

    // Extract params for each class using the range between successive class definitions
    for (let i = 0; i < classPositions.length; i++) {
      const cls = classPositions[i]
      const nextStart = i + 1 < classPositions.length
        ? classPositions[i + 1].start
        : file.content.length
      const params = extractClassParams(file.content, cls.start, nextStart)
      if (params.length > 0 && !map.has(cls.name)) {
        map.set(cls.name, params)
      }
    }
  }

  return map
}

export function detectSynthClasses(
  files: Array<{ name: string; content: string }>
): DetectedSynth[] {
  const results: DetectedSynth[] = []
  const seen = new Set<string>()

  // First pass: build className → params map from all class definitions
  const classParamMap = buildClassParamMap(files)

  // Second pass: find SynthGUIManager usages and attach params
  for (const file of files) {
    if (!/\.(cpp|hpp|h|c)$/i.test(file.name)) continue

    const regex = new RegExp(SYNTH_MANAGER_REGEX.source, 'g')
    let match: RegExpExecArray | null
    while ((match = regex.exec(file.content)) !== null) {
      const displayName = match[2]
      if (seen.has(displayName)) continue
      seen.add(displayName)

      const className = match[1]
      results.push({
        className,
        displayName,
        sourceFile: file.name,
        params: classParamMap.get(className) || [],
      })
    }
  }

  return results
}
