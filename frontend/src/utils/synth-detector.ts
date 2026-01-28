/**
 * Detects synth classes from C++ source code by scanning for
 * SynthGUIManager<ClassName> patterns.
 */

export interface DetectedSynth {
  className: string     // template param: SineEnv
  displayName: string   // string literal: "SineEnv"
  sourceFile: string    // which file it was found in
}

// Matches: SynthGUIManager<ClassName> varName{"DisplayName"}
const SYNTH_MANAGER_REGEX = /SynthGUIManager\s*<\s*(\w+)\s*>\s+\w+\s*\{\s*"([^"]+)"\s*\}/g

export function detectSynthClasses(
  files: Array<{ name: string; content: string }>
): DetectedSynth[] {
  const results: DetectedSynth[] = []
  const seen = new Set<string>()

  for (const file of files) {
    if (!/\.(cpp|hpp|h|c)$/i.test(file.name)) continue

    const regex = new RegExp(SYNTH_MANAGER_REGEX.source, 'g')
    let match: RegExpExecArray | null
    while ((match = regex.exec(file.content)) !== null) {
      const displayName = match[2]
      if (seen.has(displayName)) continue
      seen.add(displayName)

      results.push({
        className: match[1],
        displayName,
        sourceFile: file.name,
      })
    }
  }

  return results
}
