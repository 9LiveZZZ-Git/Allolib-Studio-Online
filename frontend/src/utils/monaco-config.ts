import * as monaco from 'monaco-editor'

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

  // Register completion provider for C++
  monaco.languages.registerCompletionItemProvider('cpp', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      // Add range to snippets
      const suggestions = allolibSnippets.map((snippet) => ({
        ...snippet,
        range,
      }))

      return { suggestions }
    },
  })

  // Register hover provider for AlloLib types
  monaco.languages.registerHoverProvider('cpp', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position)
      if (!word) return null

      const docs: Record<string, string> = {
        WebApp: 'Web application class for AlloLib. Inherit from this and override onCreate(), onAnimate(), onDraw(), onSound().',
        App: 'Desktop AlloLib application (use WebApp for web builds).',
        Mesh: 'Container for vertex data including positions, colors, normals, and texture coordinates.',
        Graphics: 'Graphics context for rendering. Provides drawing methods and state management.',
        Vec3f: '3D vector with float components (x, y, z).',
        Vec3d: '3D vector with double components (x, y, z).',
        Color: 'RGBA color value.',
        HSV: 'Create a color from Hue, Saturation, and Value.',
        Nav: '3D navigation/camera controller.',
        Pose: '3D position and orientation.',
        ShaderProgram: 'OpenGL shader program for custom rendering.',
        Sine: 'Gamma sine wave oscillator.',
        ADSR: 'Gamma ADSR envelope generator.',
        AudioIOData: 'Audio buffer data passed to onSound(). Use io.out(channel) to write samples.',
        addSphere: 'Add sphere geometry to a mesh. al::addSphere(mesh, radius, slices, stacks)',
        addCube: 'Add cube geometry to a mesh. al::addCube(mesh, size)',
        addCone: 'Add cone geometry to a mesh. al::addCone(mesh, radius, height)',
        addCylinder: 'Add cylinder geometry to a mesh. al::addCylinder(mesh, radius, height)',
        addTorus: 'Add torus geometry to a mesh. al::addTorus(mesh, minorRadius, majorRadius)',
      }

      const doc = docs[word.word]
      if (doc) {
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          ),
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

// Default code template for AlloLib Web (with audio)
export const defaultCode = `/**
 * AlloLib Web - Audio Visual Demo
 * Rotating sphere with sine wave audio
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

  void onCreate() override {
    // Create a sphere mesh
    al::addSphere(mesh, 1.0, 32, 32);
    mesh.generateNormals();

    // Set up camera
    nav().pos(0, 0, 5);

    // Configure audio (44100 Hz, 128 frames, stereo)
    configureWebAudio(44100, 128, 2, 0);
  }

  void onAnimate(double dt) override {
    // Rotate the sphere
    angle += dt * 30.0;  // degrees per second
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
  }

  void onSound(AudioIOData& io) override {
    while (io()) {
      // Generate sine wave
      float sample = osc() * amplitude;

      // Output to both channels
      io.out(0) = sample;
      io.out(1) = sample;
    }
  }

  bool onKeyDown(const Keyboard& k) override {
    // Change frequency with number keys 1-8
    if (k.key() >= '1' && k.key() <= '8') {
      float freq = 220.0f * (k.key() - '0');  // 220Hz to 1760Hz
      osc.freq(freq);
    }
    return true;
  }
};

// Create the web application with WASM exports
ALLOLIB_WEB_MAIN(MyApp)
`
