import * as monaco from 'monaco-editor'
import {
  allolibClasses,
  getClassMemberCompletions,
  getFunctionCompletions,
  getClassCompletions,
  getSignatureHelp,
} from './allolib-types'

// AlloLib-specific C++ snippets
export const allolibSnippets: monaco.languages.CompletionItem[] = [
  {
    label: 'allolib-app',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: `#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"

using namespace al;

class MyApp : public WebApp {
public:
  void onCreate() override {
    \${1:// Initialize}
  }

  void onAnimate(double dt) override {
    \${2:// Update}
  }

  void onDraw(Graphics& g) override {
    g.clear(0.1f, 0.1f, 0.15f);
    \${3:// Draw}
  }
};

ALLOLIB_WEB_MAIN(MyApp)`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Basic AlloLib Web application template',
    range: undefined as any,
  },
  {
    label: 'mesh-sphere',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: `Mesh mesh;
al::addSphere(mesh, \${1:1.0}, \${2:32}, \${3:32});
mesh.generateNormals();`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Create a sphere mesh',
    range: undefined as any,
  },
  {
    label: 'mesh-cube',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: `Mesh mesh;
al::addCube(mesh, \${1:1.0});
mesh.generateNormals();`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Create a cube mesh',
    range: undefined as any,
  },
  {
    label: 'sine-osc',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: `gam::Sine<> osc{\${1:440.0}};`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Create a sine oscillator',
    range: undefined as any,
  },
  {
    label: 'adsr-env',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: `gam::ADSR<> env{
  \${1:0.1},  // attack
  \${2:0.1},  // decay
  \${3:0.8},  // sustain
  \${4:0.5}   // release
};`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Create an ADSR envelope',
    range: undefined as any,
  },
  {
    label: 'nav3d',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: `nav().pos(\${1:0}, \${2:0}, \${3:5});
nav().faceToward(Vec3f(\${4:0}, \${5:0}, \${6:0}));`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Set up 3D navigation/camera',
    range: undefined as any,
  },
  {
    label: 'color-hsv',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: `Color color = HSV(\${1:0.5}, \${2:1.0}, \${3:1.0});`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Create color from HSV values',
    range: undefined as any,
  },
  {
    label: 'shader-basic',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: `ShaderProgram shader;
shader.compile(R"(
  #version 330
  layout(location = 0) in vec3 position;
  uniform mat4 MVP;
  void main() {
    gl_Position = MVP * vec4(position, 1.0);
  }
)", R"(
  #version 330
  out vec4 fragColor;
  void main() {
    fragColor = vec4(\${1:1.0}, \${2:1.0}, \${3:1.0}, 1.0);
  }
)");`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Basic shader program',
    range: undefined as any,
  },
  // Scene System Snippets
  {
    label: 'synthvoice',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: `// Polyphonic voice with envelope
struct \${1:SineVoice} : SynthVoice {
  gam::Sine<> osc;
  gam::ADSR<> env{0.01, 0.1, 0.7, 0.3};
  float amp = 0.2f;

  void setFreq(float f) { osc.freq(f); }

  void onProcess(AudioIOData& io) override {
    while (io()) {
      float s = osc() * env() * amp;
      io.out(0) += s;
      io.out(1) += s;
    }
    if (env.done()) free();
  }

  void onTriggerOn() override { env.reset(); }
  void onTriggerOff() override { env.release(); }
};`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'SynthVoice template for polyphonic synthesis',
    range: undefined as any,
  },
  {
    label: 'polysynth',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: `#include "al/scene/al_PolySynth.hpp"

// In your app class:
PolySynth synth;

// In onCreate():
synth.allocatePolyphony<\${1:SineVoice}>(16);

// In onSound():
synth.render(io);

// Trigger a voice:
auto* voice = synth.getVoice<\${1:SineVoice}>();
voice->setFreq(440.0f);
synth.triggerOn(voice);`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'PolySynth setup for polyphonic voice management',
    range: undefined as any,
  },
  {
    label: 'stereopanner',
    kind: monaco.languages.CompletionItemKind.Snippet,
    insertText: `// Stereo panning - pan value from -1 (left) to 1 (right)
float pan = \${1:0.0f}; // center
float leftGain = cosf((pan + 1.0f) * M_PI / 4.0f);
float rightGain = sinf((pan + 1.0f) * M_PI / 4.0f);
io.out(0) += sample * leftGain;
io.out(1) += sample * rightGain;`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    documentation: 'Simple stereo panning (equal power)',
    range: undefined as any,
  },
]

// AlloLib theme (dark)
export const allolibTheme: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955' },
    { token: 'keyword', foreground: '569CD6' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'variable', foreground: '9CDCFE' },
    { token: 'operator', foreground: 'D4D4D4' },
  ],
  colors: {
    'editor.background': '#1E1E1E',
    'editor.foreground': '#D4D4D4',
    'editor.lineHighlightBackground': '#2D2D2D',
    'editor.selectionBackground': '#264F78',
    'editorCursor.foreground': '#FFFFFF',
    'editorWhitespace.foreground': '#3B3B3B',
    'editorLineNumber.foreground': '#858585',
    'editorLineNumber.activeForeground': '#C6C6C6',
  },
}

// Configure Monaco for C++
export function configureMonaco() {
  // Register AlloLib theme
  monaco.editor.defineTheme('allolib-dark', allolibTheme)

  // Track variable types for smart completion
  const variableTypes: Map<string, string> = new Map()

  // Register enhanced completion provider for C++
  monaco.languages.registerCompletionItemProvider('cpp', {
    triggerCharacters: ['.', ':', '>', '('],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      // Get the text before cursor on this line
      const lineContent = model.getLineContent(position.lineNumber)
      const textBeforeCursor = lineContent.substring(0, position.column - 1)

      // Check if we're completing after a dot (member access)
      const memberAccessMatch = textBeforeCursor.match(/(\w+)\.\s*(\w*)$/)
      if (memberAccessMatch) {
        const varName = memberAccessMatch[1]
        // Try to find the type of this variable
        const varType = findVariableType(model, varName, position.lineNumber)
        if (varType) {
          const memberCompletions = getClassMemberCompletions(varType, range)
          if (memberCompletions.length > 0) {
            return { suggestions: memberCompletions }
          }
        }
      }

      // Check if we're completing after -> (pointer member access)
      const pointerAccessMatch = textBeforeCursor.match(/(\w+)->\s*(\w*)$/)
      if (pointerAccessMatch) {
        const varName = pointerAccessMatch[1]
        const varType = findVariableType(model, varName, position.lineNumber)
        if (varType) {
          // Remove pointer notation if present
          const baseType = varType.replace(/\*$/, '').trim()
          const memberCompletions = getClassMemberCompletions(baseType, range)
          if (memberCompletions.length > 0) {
            return { suggestions: memberCompletions }
          }
        }
      }

      // Check if completing after al:: namespace
      if (textBeforeCursor.match(/al::\s*\w*$/)) {
        return { suggestions: getFunctionCompletions(range) }
      }

      // Check if completing after gam:: namespace
      if (textBeforeCursor.match(/gam::\s*\w*$/)) {
        const gammaCompletions: monaco.languages.CompletionItem[] = [
          { label: 'Sine', kind: monaco.languages.CompletionItemKind.Class, insertText: 'Sine<>', detail: 'Sine wave oscillator', range },
          { label: 'Saw', kind: monaco.languages.CompletionItemKind.Class, insertText: 'Saw<>', detail: 'Sawtooth oscillator', range },
          { label: 'Square', kind: monaco.languages.CompletionItemKind.Class, insertText: 'Square<>', detail: 'Square wave oscillator', range },
          { label: 'Tri', kind: monaco.languages.CompletionItemKind.Class, insertText: 'Tri<>', detail: 'Triangle wave oscillator', range },
          { label: 'ADSR', kind: monaco.languages.CompletionItemKind.Class, insertText: 'ADSR<>', detail: 'ADSR envelope', range },
          { label: 'AD', kind: monaco.languages.CompletionItemKind.Class, insertText: 'AD<>', detail: 'AD envelope', range },
          { label: 'Decay', kind: monaco.languages.CompletionItemKind.Class, insertText: 'Decay<>', detail: 'Decay envelope', range },
          { label: 'Biquad', kind: monaco.languages.CompletionItemKind.Class, insertText: 'Biquad<>', detail: 'Biquad filter', range },
          { label: 'OnePole', kind: monaco.languages.CompletionItemKind.Class, insertText: 'OnePole<>', detail: 'One-pole filter', range },
          { label: 'Delay', kind: monaco.languages.CompletionItemKind.Class, insertText: 'Delay<>', detail: 'Delay line', range },
          { label: 'NoiseWhite', kind: monaco.languages.CompletionItemKind.Class, insertText: 'NoiseWhite<>', detail: 'White noise', range },
          { label: 'NoisePink', kind: monaco.languages.CompletionItemKind.Class, insertText: 'NoisePink<>', detail: 'Pink noise', range },
        ]
        return { suggestions: gammaCompletions }
      }

      // Default: provide snippets, class names, and function completions
      const suggestions: monaco.languages.CompletionItem[] = [
        ...allolibSnippets.map((snippet) => ({ ...snippet, range })),
        ...getClassCompletions(range),
        ...getFunctionCompletions(range),
      ]

      return { suggestions }
    },
  })

  // Register signature help provider (parameter hints)
  monaco.languages.registerSignatureHelpProvider('cpp', {
    signatureHelpTriggerCharacters: ['(', ','],
    provideSignatureHelp: (model, position) => {
      const lineContent = model.getLineContent(position.lineNumber)
      const textBeforeCursor = lineContent.substring(0, position.column - 1)

      // Find function call pattern: functionName( or object.methodName(
      const funcCallMatch = textBeforeCursor.match(/(?:(\w+)\.)?(\w+)\s*\([^)]*$/)
      if (funcCallMatch) {
        const objectName = funcCallMatch[1]
        const functionName = funcCallMatch[2]

        let className: string | undefined
        if (objectName) {
          className = findVariableType(model, objectName, position.lineNumber)
        }

        const help = getSignatureHelp(functionName, className)
        if (help) {
          // Count commas to determine active parameter
          const afterParen = textBeforeCursor.substring(textBeforeCursor.lastIndexOf('(') + 1)
          const commaCount = (afterParen.match(/,/g) || []).length
          help.activeParameter = commaCount

          return {
            value: help,
            dispose: () => {},
          }
        }
      }

      return null
    },
  })

  // Register hover provider for AlloLib types
  monaco.languages.registerHoverProvider('cpp', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position)
      if (!word) return null

      // Check if it's an AlloLib class
      const classInfo = allolibClasses[word.word]
      if (classInfo) {
        const methodList = classInfo.methods.slice(0, 5).map(m => `- \`${m.signature}\``).join('\n')
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [
            { value: `**${classInfo.name}** (AlloLib)` },
            { value: classInfo.description },
            { value: `**Methods:**\n${methodList}${classInfo.methods.length > 5 ? '\n- ...' : ''}` },
          ],
        }
      }

      // Basic docs for non-class types
      const basicDocs: Record<string, string> = {
        App: 'Desktop AlloLib application (use WebApp for web builds).',
        Vec3d: '3D vector with double components (x, y, z).',
        HSV: 'Create a color from Hue (0-1), Saturation (0-1), and Value (0-1).',
        Pose: '3D position and orientation.',
        Quatd: 'Quaternion with double components for 3D rotations.',
        ShaderProgram: 'OpenGL shader program for custom rendering.',
      }

      const doc = basicDocs[word.word]
      if (doc) {
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [
            { value: `**${word.word}**` },
            { value: doc },
          ],
        }
      }

      return null
    },
  })
}

/**
 * Find the type of a variable by searching declarations above the current line
 */
function findVariableType(
  model: monaco.editor.ITextModel,
  varName: string,
  currentLine: number
): string | undefined {
  // Search backwards from current line to find variable declaration
  for (let line = currentLine; line >= 1; line--) {
    const lineContent = model.getLineContent(line)

    // Match patterns like: Type varName; or Type varName = ...;
    // Also handles templates like: gam::Sine<> varName;
    const declPattern = new RegExp(
      `(?:^|\\s)(\\w+(?:<[^>]*>)?(?:\\s*\\*)?|gam::\\w+<[^>]*>)\\s+${varName}\\s*[=;(]`
    )
    const match = lineContent.match(declPattern)
    if (match) {
      let typeName = match[1].trim()
      // Normalize gam:: types to base name
      if (typeName.startsWith('gam::')) {
        typeName = typeName.replace(/^gam::/, '').replace(/<.*>/, '')
      }
      return typeName
    }

    // Match class member declarations like: Mesh mesh;
    const memberPattern = new RegExp(`^\\s*(\\w+)\\s+${varName}\\s*;`)
    const memberMatch = lineContent.match(memberPattern)
    if (memberMatch) {
      return memberMatch[1]
    }
  }

  // Check for common parameter names
  const paramTypes: Record<string, string> = {
    g: 'Graphics',
    io: 'AudioIOData',
    k: 'Keyboard',
    m: 'Mouse',
  }
  if (paramTypes[varName]) {
    return paramTypes[varName]
  }

  return undefined
}

// Default code template for AlloLib Web (with audio)
export const defaultCode = `/**
 * AlloLib Web - Audio Visual Demo
 * Rotating sphere with sine wave audio
 *
 * Camera Controls:
 *   WASD  - Move forward/left/back/right
 *   Q/E   - Move up/down
 *   I/J/K/L - Look around
 *   Mouse Drag - Rotate view
 *
 * Audio Controls:
 *   1-8 - Change frequency
 */

#include "al_WebApp.hpp"
#include "al/graphics/al_Shapes.hpp"
#include "Gamma/Oscillator.h"
#include <cmath>

using namespace al;

class MyApp : public WebApp {
public:
  Mesh mesh;
  double angle = 0;

  // Audio: sine oscillator
  gam::Sine<> osc{440.0};
  float amplitude = 0.3f;

  // Camera control
  float moveSpeed = 5.0f;
  float turnSpeed = 90.0f;  // degrees per second

  // Key states (only for printable ASCII keys)
  bool keyW = false, keyA = false, keyS = false, keyD = false;
  bool keyQ = false, keyE = false;
  bool keyI = false, keyJ = false, keyK = false, keyL = false;

  // Mouse state
  bool mouseDown = false;
  int lastMouseX = 0;
  int lastMouseY = 0;

  void onCreate() override {
    // Create a sphere mesh
    al::addSphere(mesh, 1.0, 32, 32);
    mesh.generateNormals();

    // Set up camera
    nav().pos(0, 0, 5);
    nav().faceToward(Vec3f(0, 0, 0));

    // Configure audio (44100 Hz, 128 frames, stereo)
    configureWebAudio(44100, 128, 2, 0);

    std::cout << "[INFO] Camera: WASD move, Q/E up/down, IJKL or mouse drag to look" << std::endl;
  }

  void onAnimate(double dt) override {
    // Rotate the sphere
    angle += dt * 30.0;

    // Camera movement based on held keys
    Vec3f move(0, 0, 0);

    // Forward/backward (W/S)
    if (keyW) move.z -= 1;
    if (keyS) move.z += 1;

    // Left/right strafe (A/D)
    if (keyA) move.x -= 1;
    if (keyD) move.x += 1;

    // Up/down (Q/E)
    if (keyQ) move.y -= 1;
    if (keyE) move.y += 1;

    // Apply movement in camera's local space
    if (move.mag() > 0) {
      move = move.normalize() * moveSpeed * dt;
      // Transform movement to world space using camera orientation
      Vec3f forward = nav().uf();  // forward vector
      Vec3f right = nav().ur();    // right vector
      Vec3f up = nav().uu();       // up vector

      nav().pos() += forward * (-move.z) + right * move.x + up * move.y;
    }

    // Camera rotation with IJKL keys
    float yaw = 0, pitch = 0;
    if (keyJ) yaw += 1;
    if (keyL) yaw -= 1;
    if (keyI) pitch += 1;
    if (keyK) pitch -= 1;

    if (yaw != 0 || pitch != 0) {
      float yawRad = yaw * turnSpeed * dt * M_PI / 180.0;
      float pitchRad = pitch * turnSpeed * dt * M_PI / 180.0;
      Quatd rot = Quatd().fromEuler(yawRad, pitchRad, 0);
      nav().quat() = rot * nav().quat();
    }
  }

  void onDraw(Graphics& g) override {
    g.clear(0.1f, 0.1f, 0.15f);
    g.depthTesting(true);
    g.lighting(true);

    g.pushMatrix();
    g.rotate(angle, 0, 1, 0);
    g.color(HSV(fmod(angle * 0.01, 1.0), 0.8, 1.0));
    g.draw(mesh);
    g.popMatrix();

    // Draw a ground grid for reference
    g.lighting(false);
    g.color(0.3f, 0.3f, 0.3f);
    Mesh grid;
    grid.primitive(Mesh::LINES);
    for (int i = -5; i <= 5; i++) {
      grid.vertex(i, -1, -5); grid.vertex(i, -1, 5);
      grid.vertex(-5, -1, i); grid.vertex(5, -1, i);
    }
    g.draw(grid);
  }

  void onSound(AudioIOData& io) override {
    while (io()) {
      float sample = osc() * amplitude;
      io.out(0) = sample;
      io.out(1) = sample;
    }
  }

  bool onKeyDown(const Keyboard& k) override {
    int key = k.key();

    // Movement keys
    if (key == 'w' || key == 'W') keyW = true;
    if (key == 'a' || key == 'A') keyA = true;
    if (key == 's' || key == 'S') keyS = true;
    if (key == 'd' || key == 'D') keyD = true;
    if (key == 'q' || key == 'Q') keyQ = true;
    if (key == 'e' || key == 'E') keyE = true;

    // Look keys
    if (key == 'i' || key == 'I') keyI = true;
    if (key == 'j' || key == 'J') keyJ = true;
    if (key == 'k' || key == 'K') keyK = true;
    if (key == 'l' || key == 'L') keyL = true;

    // Change frequency with number keys 1-8
    if (key >= '1' && key <= '8') {
      float freq = 220.0f * (key - '0');
      osc.freq(freq);
      std::cout << "[INFO] Frequency: " << freq << " Hz" << std::endl;
    }
    return true;
  }

  bool onKeyUp(const Keyboard& k) override {
    int key = k.key();

    if (key == 'w' || key == 'W') keyW = false;
    if (key == 'a' || key == 'A') keyA = false;
    if (key == 's' || key == 'S') keyS = false;
    if (key == 'd' || key == 'D') keyD = false;
    if (key == 'q' || key == 'Q') keyQ = false;
    if (key == 'e' || key == 'E') keyE = false;

    if (key == 'i' || key == 'I') keyI = false;
    if (key == 'j' || key == 'J') keyJ = false;
    if (key == 'k' || key == 'K') keyK = false;
    if (key == 'l' || key == 'L') keyL = false;

    return true;
  }

  bool onMouseDown(const Mouse& m) override {
    mouseDown = true;
    lastMouseX = m.x();
    lastMouseY = m.y();
    return true;
  }

  bool onMouseUp(const Mouse& m) override {
    mouseDown = false;
    return true;
  }

  bool onMouseDrag(const Mouse& m) override {
    if (mouseDown) {
      int dx = m.x() - lastMouseX;
      int dy = m.y() - lastMouseY;

      // Rotate camera based on mouse movement
      float sensitivity = 0.2f;
      float yawRad = -dx * sensitivity * M_PI / 180.0;
      float pitchRad = -dy * sensitivity * M_PI / 180.0;
      Quatd rot = Quatd().fromEuler(yawRad, pitchRad, 0);
      nav().quat() = rot * nav().quat();

      lastMouseX = m.x();
      lastMouseY = m.y();
    }
    return true;
  }
};

// Create the web application with WASM exports
ALLOLIB_WEB_MAIN(MyApp)
`
