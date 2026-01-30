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
 * - Graphics API differences (OpenGL vs WebGL2/OpenGL ES 3.0)
 *
 * Key WebGL2/OpenGL ES 3.0 differences:
 * - glPointSize() is NOT supported; point size must be set via gl_PointSize in vertex shader
 * - AlloLib Online shaders default to 4.0 pixel points if not set
 * - Some polygon modes (GL_POINT, GL_LINE) behave differently
 * - Shader precision qualifiers are required (highp, mediump, lowp)
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
  // Include transformations - Core App
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
    replacement: '// GUI Domain not needed in web (handled by Vue)\n// #include "al/app/al_GUIDomain.hpp"',
    description: 'GUIDomain include (not needed)'
  },

  // Include transformations - Playground UI classes
  {
    pattern: /#include\s*["<]al\/ui\/al_ControlGUI\.hpp[">]/g,
    replacement: '#include "al_playground_compat.hpp"  // Provides WebControlGUI',
    description: 'ControlGUI include'
  },
  {
    pattern: /#include\s*["<]al\/ui\/al_ParameterGUI\.hpp[">]/g,
    replacement: '#include "al_playground_compat.hpp"  // Provides ParameterGUI stub',
    description: 'ParameterGUI include'
  },
  {
    pattern: /#include\s*["<]al\/ui\/al_PresetHandler\.hpp[">]/g,
    replacement: '#include "al_playground_compat.hpp"  // Provides PresetHandler stub',
    description: 'PresetHandler include'
  },
  {
    pattern: /#include\s*["<]al\/ui\/al_PresetSequencer\.hpp[">]/g,
    replacement: '#include "al_playground_compat.hpp"  // Provides PresetSequencer stub',
    description: 'PresetSequencer include'
  },
  {
    pattern: /#include\s*["<]al\/ui\/al_ParameterMIDI\.hpp[">]/g,
    replacement: '#include "al_playground_compat.hpp"  // Provides ParameterMIDI stub',
    description: 'ParameterMIDI include'
  },

  // Include transformations - Scene/Synth classes
  {
    pattern: /#include\s*["<]al\/scene\/al_PolySynth\.hpp[">]/g,
    replacement: '#include "al_playground_compat.hpp"  // Provides PolySynth',
    description: 'PolySynth include'
  },
  {
    pattern: /#include\s*["<]al\/scene\/al_SynthSequencer\.hpp[">]/g,
    replacement: '#include "al_playground_compat.hpp"  // Provides SynthSequencer',
    description: 'SynthSequencer include'
  },
  {
    pattern: /#include\s*["<]al\/scene\/al_SynthRecorder\.hpp[">]/g,
    replacement: '#include "al_playground_compat.hpp"  // Provides SynthRecorder',
    description: 'SynthRecorder include'
  },

  // Include transformations - Other I/O
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

  // Include transformations - Asset loading (native uses Assimp, web uses custom loaders)
  {
    pattern: /#include\s*["<]al_ext\/assets3d\/al_Asset\.hpp[">]/g,
    replacement: '#include "al_WebOBJ.hpp"  // Web uses WebOBJ instead of Assimp',
    description: 'Asset3D include'
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

  // Auto-LOD: Convert g.draw(mesh) to drawLOD(g, mesh) for automatic LOD
  // This makes LOD transparent - users don't need to change their code
  // Handles simple identifiers, member access, array access, and pointer dereference
  {
    pattern: /\bg\.draw\s*\(\s*(\*?[a-zA-Z_][a-zA-Z0-9_]*(?:(?:\.|->)[a-zA-Z_][a-zA-Z0-9_]*)*(?:\[[^\]]+\])?)\s*\)/g,
    replacement: (match: string, expr: string) => {
      // Don't convert VAOMesh or EasyVAO draws (they're not Mesh type)
      if (expr.includes('VAO') || expr.includes('vao')) {
        return match
      }
      return `drawLOD(g, ${expr.trim()})`
    },
    description: 'Auto-LOD: g.draw(expr) -> drawLOD(g, expr)'
  },
  // Handle g.draw with function calls like g.draw(getMesh()) or g.draw(obj.getMesh())
  {
    pattern: /\bg\.draw\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*(?:(?:\.|->)[a-zA-Z_][a-zA-Z0-9_]*)*\([^)]*\))\s*\)/g,
    replacement: (match: string, expr: string) => {
      if (expr.includes('VAO') || expr.includes('vao')) {
        return match
      }
      return `drawLOD(g, ${expr.trim()})`
    },
    description: 'Auto-LOD: g.draw(func()) -> drawLOD(g, func())'
  },
  // Handle graphics.draw() variant - simple expressions
  {
    pattern: /\bgraphics\.draw\s*\(\s*(\*?[a-zA-Z_][a-zA-Z0-9_]*(?:(?:\.|->)[a-zA-Z_][a-zA-Z0-9_]*)*(?:\[[^\]]+\])?)\s*\)/g,
    replacement: (match: string, expr: string) => {
      if (expr.includes('VAO') || expr.includes('vao')) {
        return match
      }
      return `drawLOD(graphics, ${expr.trim()})`
    },
    description: 'Auto-LOD: graphics.draw(expr) -> drawLOD(graphics, expr)'
  },
  // Handle graphics.draw with function calls
  {
    pattern: /\bgraphics\.draw\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*(?:(?:\.|->)[a-zA-Z_][a-zA-Z0-9_]*)*\([^)]*\))\s*\)/g,
    replacement: (match: string, expr: string) => {
      if (expr.includes('VAO') || expr.includes('vao')) {
        return match
      }
      return `drawLOD(graphics, ${expr.trim()})`
    },
    description: 'Auto-LOD: graphics.draw(func()) -> drawLOD(graphics, func())'
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
  // Include transformations - Core App
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

  // Include transformations - Playground compat header (expands to multiple native includes)
  {
    pattern: /#include\s*["<]al_playground_compat\.hpp[">].*$/gm,
    replacement: `#include "al/app/al_App.hpp"
#include "al/scene/al_PolySynth.hpp"
#include "al/scene/al_SynthSequencer.hpp"
#include "al/scene/al_SynthRecorder.hpp"
#include "al/ui/al_ControlGUI.hpp"
#include "al/ui/al_ParameterGUI.hpp"
#include "al/ui/al_PresetHandler.hpp"
#include "al/ui/al_Parameter.hpp"
#include "al/ui/al_ParameterBundle.hpp"
#include "al/graphics/al_Light.hpp"`,
    description: 'Playground compat header'
  },

  // Include transformations - Web Control GUI
  {
    pattern: /#include\s*["<]al_WebControlGUI\.hpp[">]/g,
    replacement: '#include "al/ui/al_ControlGUI.hpp"',
    description: 'WebControlGUI include'
  },
  {
    pattern: /#include\s*["<]al_WebSequencerBridge\.hpp[">]/g,
    replacement: '// WebSequencerBridge is web-only (native uses SynthSequencer directly)',
    description: 'WebSequencerBridge include'
  },

  // Include transformations - Other I/O
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

  // Include transformations - Web asset/rendering headers -> Native compat layer
  // These use the native_compat headers which provide identical API
  {
    pattern: /#include\s*["<]al_WebOBJ\.hpp[">]/g,
    replacement: '#include "native_compat/al_NativeOBJ.hpp"  // WebOBJ -> NativeOBJ (same API)',
    description: 'WebOBJ include'
  },
  {
    pattern: /#include\s*["<]al_WebHDR\.hpp[">]/g,
    replacement: '#include "native_compat/al_NativeHDR.hpp"  // WebHDR -> NativeHDR (same API, uses stb_image)',
    description: 'WebHDR include'
  },
  {
    pattern: /#include\s*["<]al_WebEnvironment\.hpp[">]/g,
    replacement: '#include "native_compat/al_NativeEnvironment.hpp"  // WebEnvironment -> NativeEnvironment (same API)',
    description: 'WebEnvironment include'
  },
  {
    pattern: /#include\s*["<]al_WebPBR\.hpp[">]/g,
    replacement: '// WebPBR: PBR shaders need manual porting (no native compat yet)\n// Copy shaders from al_WebPBR.hpp and update for desktop OpenGL\n// #include "al_WebPBR.hpp"',
    description: 'WebPBR include'
  },
  {
    pattern: /#include\s*["<]al_WebLOD\.hpp[">]/g,
    replacement: '#include "native_compat/al_NativeLOD.hpp"  // WebLOD -> NativeLOD (same API)',
    description: 'WebLOD include'
  },
  {
    pattern: /#include\s*["<]al_WebQuality\.hpp[">]/g,
    replacement: '#include "native_compat/al_NativeQuality.hpp"  // WebQuality -> NativeQuality (same API)',
    description: 'WebQuality include'
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

  // Convert simple main() to ALLOLIB_WEB_MAIN for WebApp classes
  // This is crucial for WASM exports to work correctly
  {
    pattern: /int\s+main\s*\(\s*\)\s*\{\s*(\w+)\s+\w+\s*;\s*\w+\.start\s*\(\s*\)\s*;\s*return\s+0\s*;\s*\}/g,
    replacement: 'ALLOLIB_WEB_MAIN($1)',
    description: 'Convert simple main() to ALLOLIB_WEB_MAIN'
  },
  // Also handle main with configureAudio before start
  {
    pattern: /int\s+main\s*\(\s*\)\s*\{\s*(\w+)\s+\w+\s*;[^}]*\w+\.start\s*\(\s*\)\s*;\s*return\s+0\s*;\s*\}/g,
    replacement: 'ALLOLIB_WEB_MAIN($1)',
    description: 'Convert main() with configureAudio to ALLOLIB_WEB_MAIN'
  },

  // Main macro to function (for native export)
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
  {
    pattern: /\bWebControlGUI\b/g,
    replacement: 'ControlGUI',
    description: 'WebControlGUI type'
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

  // Convert LOD-aware draw back to standard g.draw() for native
  // Native AlloLib has its own LOD systems if needed
  {
    pattern: /\bdrawLOD\s*\(\s*g\s*,\s*([^)]+)\s*\)/g,
    replacement: 'g.draw($1)',
    description: 'drawLOD(g, mesh) -> g.draw(mesh)'
  },
  {
    pattern: /\bdrawLOD\s*\(\s*graphics\s*,\s*([^)]+)\s*\)/g,
    replacement: 'graphics.draw($1)',
    description: 'drawLOD(graphics, mesh) -> graphics.draw(mesh)'
  },
]

/**
 * Detect if code is native AlloLib or AlloLib Online
 */
export function detectCodeType(code: string): 'native' | 'web' | 'unknown' {
  // Check for web-specific markers
  if (code.includes('al_WebApp.hpp') ||
      code.includes('al_compat.hpp') ||
      code.includes('al_playground_compat.hpp') ||
      code.includes('al_WebControlGUI.hpp') ||
      code.includes('al_WebSequencerBridge.hpp') ||
      code.includes('al_WebOBJ.hpp') ||
      code.includes('al_WebHDR.hpp') ||
      code.includes('al_WebEnvironment.hpp') ||
      code.includes('al_WebPBR.hpp') ||
      code.includes('al_WebAutoLOD.hpp') ||
      code.includes('ALLOLIB_WEB_MAIN') ||
      code.includes('configureWebAudio') ||
      code.includes('WebSamplePlayer') ||
      code.includes('WebMIDI') ||
      code.includes('WebOSC') ||
      code.includes('WebOBJ') ||
      code.includes('WebHDR') ||
      code.includes('WebEnvironment') ||
      code.includes('WebPBR') ||
      code.includes('PBRMaterial') ||
      code.includes('LODMesh') ||
      code.includes('LODGroup') ||
      code.includes('QualityManager') ||
      code.includes('AutoLODManager') ||
      code.includes('drawLOD(') ||
      code.includes('WebControlGUI')) {
    return 'web'
  }

  // Check for native-specific markers
  if (code.includes('al/app/al_App.hpp') ||
      code.includes('al/ui/al_ControlGUI.hpp') ||
      code.includes('al/ui/al_ParameterGUI.hpp') ||
      code.includes('al/scene/al_PolySynth.hpp') ||
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

  // Always ensure main() is converted to ALLOLIB_WEB_MAIN for WebApp classes
  // This is required for WASM exports to work correctly
  const mainToMacroPattern = /int\s+main\s*\(\s*\)\s*\{\s*(\w+)\s+\w+\s*;[^}]*\w+\.start\s*\(\s*\)\s*;\s*return\s+0\s*;\s*\}/g
  const mainMatch = result.match(mainToMacroPattern)
  if (mainMatch) {
    result = result.replace(mainToMacroPattern, 'ALLOLIB_WEB_MAIN($1)')
  }

  if (codeType === 'web' && !mainMatch) {
    warnings.push('Code appears to already be in AlloLib Online format')
    return { code: result, warnings, errors }
  } else if (codeType === 'web') {
    // Code was web format but we converted main() - still return early for other transforms
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
    warnings.push('ImGui is not supported in AlloLib Online. Parameter UI is handled by Vue.')
  }
  if (result.includes('SerialIO')) {
    errors.push('SerialIO is not available in web browsers.')
  }
  if (result.includes('osc::Recv') || result.includes('osc::Send')) {
    warnings.push('OSC has been replaced with WebOSC. You\'ll need an OSC-WebSocket bridge server.')
  }

  // Notes about playground features
  if (code.includes('SynthGUIManager') || code.includes('ControlGUI')) {
    warnings.push('SynthGUIManager/ControlGUI use web-based parameter panel instead of ImGui.')
  }
  if (code.includes('PresetHandler') || code.includes('storePreset') || code.includes('recallPreset')) {
    warnings.push('PresetHandler is stubbed. Use the web UI preset system instead.')
  }

  // Graphics API differences (WebGL2/OpenGL ES 3.0)
  if (code.includes('pointSize') || code.includes('Mesh::POINTS')) {
    warnings.push('WebGL2 note: glPointSize() is not supported. Point size is set via shader uniform (defaults to 1.0 pixels).')
  }
  if (code.includes('polygonMode') || code.includes('polygonLine') || code.includes('polygonPoint')) {
    warnings.push('WebGL2 note: polygonMode() may behave differently. LINE and POINT modes have limited support.')
  }
  if (code.includes('glBegin') || code.includes('glEnd') || code.includes('glVertex')) {
    errors.push('Immediate mode OpenGL (glBegin/glEnd) is not supported in WebGL2. Use Mesh class instead.')
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

  // Check for web-specific features that need manual conversion or native compat
  if (result.includes('WebFile::')) {
    warnings.push('WebFile API calls need to be replaced with standard file I/O.')
  }
  if (result.includes('WebFont')) {
    warnings.push('WebFont has no direct equivalent. Consider using a font library like FreeType.')
  }
  if (code.includes('WebOBJ') || code.includes('al_WebOBJ')) {
    warnings.push('Using NativeOBJ from native_compat layer. API is identical to WebOBJ.')
  }
  if (code.includes('WebHDR') || code.includes('al_WebHDR')) {
    warnings.push('Using NativeHDR from native_compat layer. Requires stb_image.h in include path.')
  }
  if (code.includes('WebEnvironment') || code.includes('al_WebEnvironment')) {
    warnings.push('Using NativeEnvironment from native_compat layer. API is identical to WebEnvironment.')
  }
  if (code.includes('WebPBR') || code.includes('al_WebPBR') || code.includes('PBRMaterial')) {
    warnings.push('WebPBR has no native compat yet. PBR shaders need manual porting to desktop OpenGL.')
  }
  if (code.includes('WebLOD') || code.includes('LODMesh') || code.includes('LODGroup')) {
    warnings.push('Using NativeLOD from native_compat layer. API is identical to WebLOD.')
  }
  if (code.includes('WebQuality') || code.includes('QualityManager') || code.includes('QualityPreset')) {
    warnings.push('Using NativeQuality from native_compat layer. API is identical to WebQuality.')
  }

  // Check for playground features that need ImGui in native
  if (result.includes('SynthGUIManager') || result.includes('ControlGUI')) {
    warnings.push('SynthGUIManager/ControlGUI requires ImGui setup in native builds. See allolib_playground for examples.')
  }

  // Graphics API notes (native OpenGL vs WebGL2)
  if (code.includes('pointSize') || code.includes('Mesh::POINTS')) {
    warnings.push('Native note: pointSize() uses glPointSize() directly (supported in desktop OpenGL, not in WebGL2).')
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
 * Setup:
 * 1. Copy the native_compat/ folder to your project's include path
 * 2. Add stb_image.h to your include path (https://github.com/nothings/stb)
 * 3. In ONE .cpp file, add: #define STB_IMAGE_IMPLEMENTATION
 *    before including any native_compat headers
 *
 * Compile with:
 *   g++ -o app app.cpp -lallolib -lgamma $(pkg-config --cflags --libs glfw3)
 *
 * Native Compatibility Layer:
 * - WebOBJ, WebHDR, WebEnvironment, LODMesh, QualityManager all have
 *   native equivalents with identical APIs in native_compat/
 * - WebPBR requires manual shader porting (see al_WebPBR.hpp for reference)
 *
 * Note: Native AlloLib uses desktop OpenGL which supports glPointSize().
 */

`
    : `/**
 * AlloLib Online Application
 *
 * This code runs in AlloLib Studio Online (browser-based)
 * https://allolib-studio.online
 *
 * Graphics Notes (WebGL2 / OpenGL ES 3.0):
 * - Point rendering: glPointSize() is not supported in WebGL2.
 *   Point sizes are set via gl_PointSize in vertex shader (defaults to 1.0 pixels).
 * - Use g.pointSize(n) to request point size; shader handles it automatically.
 * - Polygon modes (GL_LINE, GL_POINT) have limited WebGL2 support.
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
