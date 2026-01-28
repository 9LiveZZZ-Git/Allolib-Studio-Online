/**
 * AlloLib Code Transpiler
 *
 * Converts between native AlloLib (desktop) and AlloLib Online (WASM) code.
 * Handles differences in:
 * - Include statements
 * - Base class names
 * - Main function/macro
 * - Audio configuration
 * - Platform-specific APIs
 */

export interface TranspileResult {
  code: string
  warnings: string[]
  errors: string[]
}

/**
 * Patterns for converting native AlloLib to AlloLib Online
 */
const nativeToWebPatterns: Array<{
  pattern: RegExp
  replacement: string | ((match: string, ...groups: string[]) => string)
  description: string
}> = [
  // Include transformations
  {
    pattern: /#include\s*["<]al\/app\/al_App\.hpp[">]/g,
    replacement: '#include "al_WebApp.hpp"',
    description: 'App include'
  },
  {
    pattern: /#include\s*["<]al\/app\/al_AudioApp\.hpp[">]/g,
    replacement: '#include "al_WebApp.hpp"',
    description: 'AudioApp include'
  },
  {
    pattern: /#include\s*["<]al\/app\/al_GUIDomain\.hpp[">]/g,
    replacement: '// GUI not supported in web\n// #include "al/app/al_GUIDomain.hpp"',
    description: 'GUI include (not supported)'
  },
  {
    pattern: /#include\s*["<]al\/io\/al_MIDI\.hpp[">]/g,
    replacement: '#include "al_WebMIDI.hpp"',
    description: 'MIDI include'
  },
  {
    pattern: /#include\s*["<]al\/protocol\/al_OSC\.hpp[">]/g,
    replacement: '#include "al_WebOSC.hpp"',
    description: 'OSC include'
  },
  {
    pattern: /#include\s*["<]al\/sound\/al_SoundFile\.hpp[">]/g,
    replacement: '#include "al_WebSamplePlayer.hpp"',
    description: 'SoundFile include'
  },
  {
    pattern: /#include\s*["<]al\/io\/al_File\.hpp[">]/g,
    replacement: '#include "al_WebFile.hpp"',
    description: 'File include'
  },

  // Base class transformations
  {
    pattern: /:\s*public\s+al::App\b/g,
    replacement: ': public al::WebApp',
    description: 'Base class al::App'
  },
  {
    pattern: /:\s*public\s+App\b/g,
    replacement: ': public WebApp',
    description: 'Base class App'
  },
  {
    pattern: /:\s*public\s+al::AudioApp\b/g,
    replacement: ': public al::WebApp',
    description: 'Base class al::AudioApp'
  },
  {
    pattern: /:\s*public\s+AudioApp\b/g,
    replacement: ': public WebApp',
    description: 'Base class AudioApp'
  },

  // Main function transformations
  {
    pattern: /int\s+main\s*\(\s*\)\s*\{\s*(\w+)\s+app\s*;\s*app\.start\s*\(\s*\)\s*;\s*return\s+0\s*;\s*\}/g,
    replacement: 'ALLOLIB_WEB_MAIN($1)',
    description: 'Main function pattern 1'
  },
  {
    pattern: /int\s+main\s*\(\s*\)\s*\{\s*(\w+)\(\s*\)\.start\s*\(\s*\)\s*;\s*return\s+0\s*;\s*\}/g,
    replacement: 'ALLOLIB_WEB_MAIN($1)',
    description: 'Main function pattern 2'
  },
  {
    pattern: /int\s+main\s*\(\s*int\s+\w+\s*,\s*char\s*\*\*\s*\w+\s*\)\s*\{\s*(\w+)\s+app\s*;\s*app\.start\s*\(\s*\)\s*;\s*return\s+0\s*;\s*\}/g,
    replacement: 'ALLOLIB_WEB_MAIN($1)',
    description: 'Main function with argc/argv'
  },

  // Audio configuration
  {
    pattern: /configureAudio\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
    replacement: (match, rate, block, out, inp) => {
      // Clamp buffer size to 128 for Web Audio
      const webBlock = Math.min(parseInt(block), 256)
      return `configureWebAudio(${rate}, ${webBlock}, ${out}, ${inp})`
    },
    description: 'Audio configuration'
  },
  {
    pattern: /configureAudio\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
    replacement: (match, rate, block, out) => {
      const webBlock = Math.min(parseInt(block), 256)
      return `configureWebAudio(${rate}, ${webBlock}, ${out}, 0)`
    },
    description: 'Audio configuration (3 args)'
  },
  {
    pattern: /configureAudio\s*\(\s*\)/g,
    replacement: 'configureWebAudio(44100, 128, 2, 0)',
    description: 'Default audio configuration'
  },

  // Type aliases
  {
    pattern: /\bSoundFile\b/g,
    replacement: 'WebSamplePlayer',
    description: 'SoundFile type'
  },
  {
    pattern: /\bMIDIIn\b/g,
    replacement: 'WebMIDI',
    description: 'MIDIIn type'
  },
  {
    pattern: /\bMIDIOut\b/g,
    replacement: 'WebMIDI',
    description: 'MIDIOut type'
  },
  {
    pattern: /\bosc::Send\b/g,
    replacement: 'WebOSC',
    description: 'OSC Send type'
  },
  {
    pattern: /\bosc::Recv\b/g,
    replacement: 'WebOSC',
    description: 'OSC Recv type'
  },

  // onMessage callback (OSC) - comment out
  {
    pattern: /void\s+onMessage\s*\(\s*osc::Message\s*&\s*\w+\s*\)\s*override\s*\{[^}]*\}/gs,
    replacement: '// OSC onMessage not supported in web\n// $&',
    description: 'onMessage callback'
  },
]

/**
 * Patterns for converting AlloLib Online to native AlloLib
 */
const webToNativePatterns: Array<{
  pattern: RegExp
  replacement: string | ((match: string, ...groups: string[]) => string)
  description: string
}> = [
  // Include transformations
  {
    pattern: /#include\s*["<]al_WebApp\.hpp[">]/g,
    replacement: '#include "al/app/al_App.hpp"',
    description: 'WebApp include'
  },
  {
    pattern: /#include\s*["<]al_compat\.hpp[">]/g,
    replacement: '#include "al/app/al_App.hpp"',
    description: 'Compat include'
  },
  {
    pattern: /#include\s*["<]al_WebMIDI\.hpp[">]/g,
    replacement: '#include "al/io/al_MIDI.hpp"',
    description: 'WebMIDI include'
  },
  {
    pattern: /#include\s*["<]al_WebOSC\.hpp[">]/g,
    replacement: '#include "al/protocol/al_OSC.hpp"',
    description: 'WebOSC include'
  },
  {
    pattern: /#include\s*["<]al_WebSamplePlayer\.hpp[">]/g,
    replacement: '#include "al/sound/al_SoundFile.hpp"',
    description: 'WebSamplePlayer include'
  },
  {
    pattern: /#include\s*["<]al_WebFile\.hpp[">]/g,
    replacement: '#include "al/io/al_File.hpp"',
    description: 'WebFile include'
  },
  {
    pattern: /#include\s*["<]al_WebImage\.hpp[">]/g,
    replacement: '#include "al/graphics/al_Image.hpp"',
    description: 'WebImage include'
  },
  {
    pattern: /#include\s*["<]al_WebFont\.hpp[">]/g,
    replacement: '// Font rendering requires platform-specific implementation\n// #include "al_WebFont.hpp"',
    description: 'WebFont include'
  },

  // Base class transformations
  {
    pattern: /:\s*public\s+al::WebApp\b/g,
    replacement: ': public al::App',
    description: 'Base class al::WebApp'
  },
  {
    pattern: /:\s*public\s+WebApp\b/g,
    replacement: ': public App',
    description: 'Base class WebApp'
  },

  // Main macro to function
  {
    pattern: /ALLOLIB_WEB_MAIN\s*\(\s*(\w+)\s*\)/g,
    replacement: `int main() {
    $1 app;
    app.start();
    return 0;
}`,
    description: 'ALLOLIB_WEB_MAIN macro'
  },
  {
    pattern: /ALLOLIB_MAIN\s*\(\s*(\w+)\s*\)/g,
    replacement: `int main() {
    $1 app;
    app.start();
    return 0;
}`,
    description: 'ALLOLIB_MAIN macro'
  },

  // Audio configuration
  {
    pattern: /configureWebAudio\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
    replacement: 'configureAudio($1, 512, $3, $4)',
    description: 'Web audio configuration'
  },
  {
    pattern: /configureWebAudio\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
    replacement: 'configureAudio($1, 512, $3)',
    description: 'Web audio configuration (3 args)'
  },

  // Type aliases
  {
    pattern: /\bWebSamplePlayer\b/g,
    replacement: 'SoundFile',
    description: 'WebSamplePlayer type'
  },
  {
    pattern: /\bWebMIDI\b/g,
    replacement: 'MIDIIn',
    description: 'WebMIDI type'
  },
  {
    pattern: /\bWebOSC\b/g,
    replacement: 'osc::Send',
    description: 'WebOSC type'
  },
  {
    pattern: /\bWebImage\b/g,
    replacement: 'Image',
    description: 'WebImage type'
  },

  // Platform detection
  {
    pattern: /if\s*\(\s*al::isWASM\s*\(\s*\)\s*\)\s*\{[^}]*\}/gs,
    replacement: '// Web-only code removed',
    description: 'isWASM check'
  },
  {
    pattern: /if\s*\(\s*isWASM\s*\(\s*\)\s*\)/g,
    replacement: 'if (false) // WASM check disabled',
    description: 'isWASM conditional'
  },
]

/**
 * Detect if code is native AlloLib or AlloLib Online
 */
export function detectCodeType(code: string): 'native' | 'web' | 'unknown' {
  // Check for web-specific markers
  if (code.includes('al_WebApp.hpp') ||
      code.includes('al_compat.hpp') ||
      code.includes('ALLOLIB_WEB_MAIN') ||
      code.includes('configureWebAudio') ||
      code.includes('WebSamplePlayer') ||
      code.includes('WebMIDI') ||
      code.includes('WebOSC')) {
    return 'web'
  }

  // Check for native-specific markers
  if (code.includes('al/app/al_App.hpp') ||
      code.includes('al::App') ||
      (code.includes('int main(') && code.includes('.start()')) ||
      code.includes('al/io/al_MIDI.hpp') ||
      code.includes('al/protocol/al_OSC.hpp') ||
      code.includes('osc::Message')) {
    return 'native'
  }

  return 'unknown'
}

/**
 * Convert native AlloLib code to AlloLib Online (WASM)
 */
export function transpileToWeb(code: string): TranspileResult {
  const warnings: string[] = []
  const errors: string[] = []
  let result = code

  // Check if already web code
  const codeType = detectCodeType(code)
  if (codeType === 'web') {
    warnings.push('Code appears to already be in AlloLib Online format')
    return { code: result, warnings, errors }
  }

  // Apply transformations
  for (const { pattern, replacement, description } of nativeToWebPatterns) {
    const matches = result.match(pattern)
    if (matches) {
      if (typeof replacement === 'function') {
        result = result.replace(pattern, replacement as any)
      } else {
        result = result.replace(pattern, replacement)
      }
    }
  }

  // Check for unsupported features
  if (result.includes('DistributedApp')) {
    warnings.push('DistributedApp is not supported in web. Network features need alternative implementation.')
  }
  if (result.includes('imgui') || result.includes('ImGui')) {
    warnings.push('ImGui is not currently supported in AlloLib Online.')
  }
  if (result.includes('SerialIO')) {
    errors.push('SerialIO is not available in web browsers.')
  }
  if (result.includes('osc::Recv') || result.includes('osc::Send')) {
    warnings.push('OSC has been replaced with WebOSC. You\'ll need an OSC-WebSocket bridge server.')
  }

  // Validate result
  if (!result.includes('ALLOLIB_WEB_MAIN') && !result.includes('int main')) {
    warnings.push('No main function or ALLOLIB_WEB_MAIN macro found. You may need to add one.')
  }

  return { code: result, warnings, errors }
}

/**
 * Convert AlloLib Online code to native AlloLib
 */
export function transpileToNative(code: string): TranspileResult {
  const warnings: string[] = []
  const errors: string[] = []
  let result = code

  // Check if already native code
  const codeType = detectCodeType(code)
  if (codeType === 'native') {
    warnings.push('Code appears to already be in native AlloLib format')
    return { code: result, warnings, errors }
  }

  // Apply transformations
  for (const { pattern, replacement, description } of webToNativePatterns) {
    const matches = result.match(pattern)
    if (matches) {
      if (typeof replacement === 'function') {
        result = result.replace(pattern, replacement as any)
      } else {
        result = result.replace(pattern, replacement)
      }
    }
  }

  // Check for web-specific features that need manual conversion
  if (result.includes('WebFile::')) {
    warnings.push('WebFile API calls need to be replaced with standard file I/O.')
  }
  if (result.includes('WebFont')) {
    warnings.push('WebFont has no direct equivalent. Consider using a font library like FreeType.')
  }

  // Add standard headers if missing
  if (!result.includes('#include') && result.includes('al::App')) {
    result = '#include "al/app/al_App.hpp"\n' + result
  }

  return { code: result, warnings, errors }
}

/**
 * Auto-detect and convert to the target format
 */
export function transpile(code: string, target: 'native' | 'web'): TranspileResult {
  if (target === 'web') {
    return transpileToWeb(code)
  } else {
    return transpileToNative(code)
  }
}

/**
 * Format code for export (add header comment, clean up)
 */
export function formatForExport(code: string, format: 'native' | 'web'): string {
  const header = format === 'native'
    ? `/**
 * AlloLib Application
 * Exported from AlloLib Studio Online
 *
 * Compile with:
 *   g++ -o app app.cpp -lallolib -lgamma $(pkg-config --cflags --libs glfw3)
 */

`
    : `/**
 * AlloLib Online Application
 *
 * This code runs in AlloLib Studio Online (browser-based)
 * https://allolib-studio.online
 */

`

  return header + code
}

/**
 * Get a summary of what changes the transpiler will make
 */
export function getTranspileSummary(code: string, target: 'native' | 'web'): string[] {
  const changes: string[] = []
  const patterns = target === 'web' ? nativeToWebPatterns : webToNativePatterns

  for (const { pattern, description } of patterns) {
    if (pattern.test(code)) {
      changes.push(description)
    }
    // Reset regex lastIndex
    pattern.lastIndex = 0
  }

  return changes
}
