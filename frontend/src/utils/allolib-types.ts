import * as monaco from 'monaco-editor'

/**
 * AlloLib Type Definitions for Monaco Intellisense
 * Provides class member completion, method signatures, and documentation
 */

export interface AlloLibMethod {
  name: string
  signature: string
  description: string
  returnType: string
  parameters?: { name: string; type: string; description?: string }[]
}

export interface AlloLibClass {
  name: string
  description: string
  methods: AlloLibMethod[]
  properties?: { name: string; type: string; description: string }[]
}

// AlloLib class definitions
export const allolibClasses: Record<string, AlloLibClass> = {
  Mesh: {
    name: 'Mesh',
    description: 'Container for vertex data including positions, colors, normals, and texture coordinates.',
    methods: [
      { name: 'vertex', signature: 'vertex(x, y, z)', returnType: 'void', description: 'Add a vertex position', parameters: [{ name: 'x', type: 'float' }, { name: 'y', type: 'float' }, { name: 'z', type: 'float' }] },
      { name: 'vertex', signature: 'vertex(Vec3f v)', returnType: 'void', description: 'Add a vertex position from vector' },
      { name: 'color', signature: 'color(r, g, b, a)', returnType: 'void', description: 'Add a vertex color', parameters: [{ name: 'r', type: 'float' }, { name: 'g', type: 'float' }, { name: 'b', type: 'float' }, { name: 'a', type: 'float', description: 'Alpha (default 1.0)' }] },
      { name: 'color', signature: 'color(Color c)', returnType: 'void', description: 'Add a vertex color from Color object' },
      { name: 'normal', signature: 'normal(x, y, z)', returnType: 'void', description: 'Add a vertex normal', parameters: [{ name: 'x', type: 'float' }, { name: 'y', type: 'float' }, { name: 'z', type: 'float' }] },
      { name: 'texCoord', signature: 'texCoord(u, v)', returnType: 'void', description: 'Add a texture coordinate', parameters: [{ name: 'u', type: 'float' }, { name: 'v', type: 'float' }] },
      { name: 'index', signature: 'index(i)', returnType: 'void', description: 'Add an index for indexed drawing' },
      { name: 'primitive', signature: 'primitive(Primitive p)', returnType: 'void', description: 'Set the primitive type (POINTS, LINES, TRIANGLES, etc.)' },
      { name: 'reset', signature: 'reset()', returnType: 'void', description: 'Clear all vertex data' },
      { name: 'generateNormals', signature: 'generateNormals()', returnType: 'void', description: 'Auto-generate smooth normals from vertices' },
      { name: 'vertices', signature: 'vertices()', returnType: 'vector<Vertex>&', description: 'Get reference to vertex array' },
      { name: 'colors', signature: 'colors()', returnType: 'vector<Color>&', description: 'Get reference to color array' },
      { name: 'normals', signature: 'normals()', returnType: 'vector<Normal>&', description: 'Get reference to normal array' },
      { name: 'decompress', signature: 'decompress()', returnType: 'void', description: 'Convert indexed mesh to non-indexed' },
      { name: 'compress', signature: 'compress()', returnType: 'void', description: 'Convert non-indexed mesh to indexed' },
    ],
    properties: [
      { name: 'POINTS', type: 'Primitive', description: 'Draw individual points' },
      { name: 'LINES', type: 'Primitive', description: 'Draw lines between pairs of vertices' },
      { name: 'LINE_STRIP', type: 'Primitive', description: 'Draw connected line strip' },
      { name: 'LINE_LOOP', type: 'Primitive', description: 'Draw connected line loop' },
      { name: 'TRIANGLES', type: 'Primitive', description: 'Draw triangles from vertex triplets' },
      { name: 'TRIANGLE_STRIP', type: 'Primitive', description: 'Draw connected triangle strip' },
      { name: 'TRIANGLE_FAN', type: 'Primitive', description: 'Draw triangle fan from first vertex' },
    ],
  },
  Graphics: {
    name: 'Graphics',
    description: 'Graphics context for rendering. Provides drawing methods and state management.',
    methods: [
      { name: 'clear', signature: 'clear(r, g, b, a)', returnType: 'void', description: 'Clear the screen with a color', parameters: [{ name: 'r', type: 'float' }, { name: 'g', type: 'float' }, { name: 'b', type: 'float' }, { name: 'a', type: 'float', description: 'Alpha (default 1.0)' }] },
      { name: 'clear', signature: 'clear(Color c)', returnType: 'void', description: 'Clear the screen with a Color' },
      { name: 'draw', signature: 'draw(Mesh& m)', returnType: 'void', description: 'Draw a mesh' },
      { name: 'color', signature: 'color(r, g, b, a)', returnType: 'void', description: 'Set the current drawing color' },
      { name: 'color', signature: 'color(Color c)', returnType: 'void', description: 'Set the current drawing color' },
      { name: 'color', signature: 'color(HSV h)', returnType: 'void', description: 'Set color from HSV' },
      { name: 'pushMatrix', signature: 'pushMatrix()', returnType: 'void', description: 'Push the current transform matrix onto the stack' },
      { name: 'popMatrix', signature: 'popMatrix()', returnType: 'void', description: 'Pop and restore the previous transform matrix' },
      { name: 'translate', signature: 'translate(x, y, z)', returnType: 'void', description: 'Translate by (x, y, z)' },
      { name: 'rotate', signature: 'rotate(angle, x, y, z)', returnType: 'void', description: 'Rotate by angle (degrees) around axis' },
      { name: 'scale', signature: 'scale(s)', returnType: 'void', description: 'Scale uniformly by s' },
      { name: 'scale', signature: 'scale(x, y, z)', returnType: 'void', description: 'Scale by (x, y, z)' },
      { name: 'lighting', signature: 'lighting(bool on)', returnType: 'void', description: 'Enable or disable lighting' },
      { name: 'depthTesting', signature: 'depthTesting(bool on)', returnType: 'void', description: 'Enable or disable depth testing' },
      { name: 'blending', signature: 'blending(bool on)', returnType: 'void', description: 'Enable or disable alpha blending' },
      { name: 'blendMode', signature: 'blendMode(BlendFunc src, BlendFunc dst)', returnType: 'void', description: 'Set the blend function' },
      { name: 'cullFace', signature: 'cullFace(bool on)', returnType: 'void', description: 'Enable or disable face culling' },
      { name: 'pointSize', signature: 'pointSize(float size)', returnType: 'void', description: 'Set the point size' },
      { name: 'lineWidth', signature: 'lineWidth(float width)', returnType: 'void', description: 'Set the line width' },
      { name: 'viewport', signature: 'viewport(x, y, w, h)', returnType: 'void', description: 'Set the viewport' },
      { name: 'shader', signature: 'shader(ShaderProgram& s)', returnType: 'void', description: 'Use a custom shader program' },
      { name: 'texture', signature: 'texture(Texture& t)', returnType: 'void', description: 'Bind a texture' },
      { name: 'camera', signature: 'camera(Viewpoint v)', returnType: 'void', description: 'Set the camera viewpoint' },
    ],
  },
  Vec3f: {
    name: 'Vec3f',
    description: '3D vector with float components (x, y, z).',
    methods: [
      { name: 'mag', signature: 'mag()', returnType: 'float', description: 'Get the magnitude (length) of the vector' },
      { name: 'magSqr', signature: 'magSqr()', returnType: 'float', description: 'Get the squared magnitude' },
      { name: 'normalize', signature: 'normalize()', returnType: 'Vec3f', description: 'Return a normalized (unit length) copy' },
      { name: 'dot', signature: 'dot(Vec3f v)', returnType: 'float', description: 'Dot product with another vector' },
      { name: 'cross', signature: 'cross(Vec3f v)', returnType: 'Vec3f', description: 'Cross product with another vector' },
      { name: 'lerp', signature: 'lerp(Vec3f target, float t)', returnType: 'Vec3f', description: 'Linear interpolation toward target' },
    ],
    properties: [
      { name: 'x', type: 'float', description: 'X component' },
      { name: 'y', type: 'float', description: 'Y component' },
      { name: 'z', type: 'float', description: 'Z component' },
    ],
  },
  Color: {
    name: 'Color',
    description: 'RGBA color value with components in range [0, 1].',
    methods: [
      { name: 'luminance', signature: 'luminance()', returnType: 'float', description: 'Get the perceived luminance' },
      { name: 'invert', signature: 'invert()', returnType: 'Color', description: 'Return inverted color' },
    ],
    properties: [
      { name: 'r', type: 'float', description: 'Red component [0-1]' },
      { name: 'g', type: 'float', description: 'Green component [0-1]' },
      { name: 'b', type: 'float', description: 'Blue component [0-1]' },
      { name: 'a', type: 'float', description: 'Alpha component [0-1]' },
    ],
  },
  Nav: {
    name: 'Nav',
    description: '3D navigation/camera controller with position and orientation.',
    methods: [
      { name: 'pos', signature: 'pos()', returnType: 'Vec3d&', description: 'Get/set position' },
      { name: 'pos', signature: 'pos(x, y, z)', returnType: 'Nav&', description: 'Set position' },
      { name: 'quat', signature: 'quat()', returnType: 'Quatd&', description: 'Get/set quaternion orientation' },
      { name: 'faceToward', signature: 'faceToward(Vec3f target, Vec3f up)', returnType: 'void', description: 'Orient to face a target point' },
      { name: 'uf', signature: 'uf()', returnType: 'Vec3d', description: 'Get forward unit vector' },
      { name: 'ur', signature: 'ur()', returnType: 'Vec3d', description: 'Get right unit vector' },
      { name: 'uu', signature: 'uu()', returnType: 'Vec3d', description: 'Get up unit vector' },
      { name: 'moveF', signature: 'moveF(float amount)', returnType: 'void', description: 'Move forward' },
      { name: 'moveR', signature: 'moveR(float amount)', returnType: 'void', description: 'Move right' },
      { name: 'moveU', signature: 'moveU(float amount)', returnType: 'void', description: 'Move up' },
      { name: 'spinR', signature: 'spinR(float angle)', returnType: 'void', description: 'Rotate around right axis (pitch)' },
      { name: 'spinU', signature: 'spinU(float angle)', returnType: 'void', description: 'Rotate around up axis (yaw)' },
      { name: 'spinF', signature: 'spinF(float angle)', returnType: 'void', description: 'Rotate around forward axis (roll)' },
    ],
  },
  AudioIOData: {
    name: 'AudioIOData',
    description: 'Audio buffer data passed to onSound(). Contains input/output sample buffers.',
    methods: [
      { name: 'out', signature: 'out(int channel)', returnType: 'float&', description: 'Get reference to output sample for channel' },
      { name: 'in', signature: 'in(int channel)', returnType: 'float', description: 'Get input sample for channel' },
      { name: 'frame', signature: 'frame()', returnType: 'int', description: 'Get current frame index in buffer' },
      { name: 'framesPerBuffer', signature: 'framesPerBuffer()', returnType: 'int', description: 'Get number of frames per buffer' },
      { name: 'framesPerSecond', signature: 'framesPerSecond()', returnType: 'double', description: 'Get sample rate' },
      { name: 'channelsOut', signature: 'channelsOut()', returnType: 'int', description: 'Get number of output channels' },
      { name: 'channelsIn', signature: 'channelsIn()', returnType: 'int', description: 'Get number of input channels' },
    ],
  },
  WebApp: {
    name: 'WebApp',
    description: 'Main application class for AlloLib Web. Override lifecycle methods to create your app.',
    methods: [
      { name: 'onCreate', signature: 'onCreate()', returnType: 'void', description: 'Called once when app starts. Initialize meshes, load resources.' },
      { name: 'onAnimate', signature: 'onAnimate(double dt)', returnType: 'void', description: 'Called before each frame. Update state, physics, animations.' },
      { name: 'onDraw', signature: 'onDraw(Graphics& g)', returnType: 'void', description: 'Called each frame. Render graphics using the Graphics context.' },
      { name: 'onSound', signature: 'onSound(AudioIOData& io)', returnType: 'void', description: 'Called for each audio buffer. Generate/process audio samples.' },
      { name: 'onKeyDown', signature: 'onKeyDown(const Keyboard& k)', returnType: 'bool', description: 'Called when a key is pressed' },
      { name: 'onKeyUp', signature: 'onKeyUp(const Keyboard& k)', returnType: 'bool', description: 'Called when a key is released' },
      { name: 'onMouseDown', signature: 'onMouseDown(const Mouse& m)', returnType: 'bool', description: 'Called when mouse button pressed' },
      { name: 'onMouseUp', signature: 'onMouseUp(const Mouse& m)', returnType: 'bool', description: 'Called when mouse button released' },
      { name: 'onMouseDrag', signature: 'onMouseDrag(const Mouse& m)', returnType: 'bool', description: 'Called when mouse dragged' },
      { name: 'onMouseMove', signature: 'onMouseMove(const Mouse& m)', returnType: 'bool', description: 'Called when mouse moved' },
      { name: 'nav', signature: 'nav()', returnType: 'Nav&', description: 'Get the navigation/camera controller' },
      { name: 'width', signature: 'width()', returnType: 'int', description: 'Get window width' },
      { name: 'height', signature: 'height()', returnType: 'int', description: 'Get window height' },
      { name: 'configureWebAudio', signature: 'configureWebAudio(sampleRate, bufferSize, outChannels, inChannels)', returnType: 'void', description: 'Configure Web Audio settings' },
    ],
  },
  Sine: {
    name: 'gam::Sine',
    description: 'Gamma sine wave oscillator.',
    methods: [
      { name: 'freq', signature: 'freq(float f)', returnType: 'void', description: 'Set the frequency in Hz' },
      { name: 'freq', signature: 'freq()', returnType: 'float', description: 'Get the current frequency' },
      { name: 'phase', signature: 'phase(float p)', returnType: 'void', description: 'Set the phase [0-1]' },
      { name: 'operator()', signature: '()', returnType: 'float', description: 'Generate next sample' },
    ],
  },
  ADSR: {
    name: 'gam::ADSR',
    description: 'Gamma ADSR envelope generator.',
    methods: [
      { name: 'attack', signature: 'attack(float seconds)', returnType: 'void', description: 'Set attack time' },
      { name: 'decay', signature: 'decay(float seconds)', returnType: 'void', description: 'Set decay time' },
      { name: 'sustain', signature: 'sustain(float level)', returnType: 'void', description: 'Set sustain level [0-1]' },
      { name: 'release', signature: 'release(float seconds)', returnType: 'void', description: 'Set release time / trigger release' },
      { name: 'reset', signature: 'reset()', returnType: 'void', description: 'Reset and trigger envelope from start' },
      { name: 'done', signature: 'done()', returnType: 'bool', description: 'Check if envelope has finished' },
      { name: 'operator()', signature: '()', returnType: 'float', description: 'Generate next envelope sample' },
    ],
  },
  PolySynth: {
    name: 'PolySynth',
    description: 'Polyphonic synthesizer that manages multiple voices.',
    methods: [
      { name: 'allocatePolyphony', signature: 'allocatePolyphony<VoiceType>(int count)', returnType: 'void', description: 'Allocate voices of the given type' },
      { name: 'getVoice', signature: 'getVoice<VoiceType>()', returnType: 'VoiceType*', description: 'Get a free voice' },
      { name: 'triggerOn', signature: 'triggerOn(SynthVoice* voice)', returnType: 'void', description: 'Trigger voice on (start playing)' },
      { name: 'triggerOff', signature: 'triggerOff(int id)', returnType: 'void', description: 'Trigger voice off by id' },
      { name: 'render', signature: 'render(AudioIOData& io)', returnType: 'void', description: 'Render all active voices to audio buffer' },
    ],
  },
  SynthVoice: {
    name: 'SynthVoice',
    description: 'Base class for polyphonic synth voices. Override for custom instruments.',
    methods: [
      { name: 'onProcess', signature: 'onProcess(AudioIOData& io)', returnType: 'void', description: 'Process audio for this voice (override)' },
      { name: 'onTriggerOn', signature: 'onTriggerOn()', returnType: 'void', description: 'Called when voice is triggered on (override)' },
      { name: 'onTriggerOff', signature: 'onTriggerOff()', returnType: 'void', description: 'Called when voice is triggered off (override)' },
      { name: 'free', signature: 'free()', returnType: 'void', description: 'Mark this voice as free for reuse' },
      { name: 'id', signature: 'id()', returnType: 'int', description: 'Get voice id' },
    ],
  },
}

// AlloLib free functions (in al:: namespace)
export const allolibFunctions: AlloLibMethod[] = [
  { name: 'addSphere', signature: 'al::addSphere(Mesh& m, float radius, int slices, int stacks)', returnType: 'void', description: 'Add sphere geometry to mesh' },
  { name: 'addCube', signature: 'al::addCube(Mesh& m, float size)', returnType: 'void', description: 'Add cube geometry to mesh' },
  { name: 'addCone', signature: 'al::addCone(Mesh& m, float radius, float height, int slices, int stacks)', returnType: 'void', description: 'Add cone geometry to mesh' },
  { name: 'addCylinder', signature: 'al::addCylinder(Mesh& m, float radius, float height, int slices)', returnType: 'void', description: 'Add cylinder geometry to mesh' },
  { name: 'addTorus', signature: 'al::addTorus(Mesh& m, float minorRadius, float majorRadius, int minorSlices, int majorSlices)', returnType: 'void', description: 'Add torus geometry to mesh' },
  { name: 'addDisc', signature: 'al::addDisc(Mesh& m, float radius, int slices)', returnType: 'void', description: 'Add disc geometry to mesh' },
  { name: 'addRect', signature: 'al::addRect(Mesh& m, float width, float height)', returnType: 'void', description: 'Add rectangle geometry to mesh' },
  { name: 'addSurface', signature: 'al::addSurface(Mesh& m, int Nx, int Ny)', returnType: 'void', description: 'Add parametric surface to mesh' },
]

/**
 * Create Monaco completion items for a class's members
 */
export function getClassMemberCompletions(
  className: string,
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  const classInfo = allolibClasses[className]
  if (!classInfo) return []

  const completions: monaco.languages.CompletionItem[] = []

  // Add methods
  for (const method of classInfo.methods) {
    completions.push({
      label: method.name,
      kind: monaco.languages.CompletionItemKind.Method,
      insertText: method.name + (method.parameters ? '($0)' : '()'),
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: method.signature,
      documentation: {
        value: `**${method.returnType}** ${method.signature}\n\n${method.description}`,
      },
      range,
    })
  }

  // Add properties
  if (classInfo.properties) {
    for (const prop of classInfo.properties) {
      completions.push({
        label: prop.name,
        kind: monaco.languages.CompletionItemKind.Property,
        insertText: prop.name,
        detail: prop.type,
        documentation: prop.description,
        range,
      })
    }
  }

  return completions
}

/**
 * Create Monaco completion items for AlloLib free functions
 */
export function getFunctionCompletions(range: monaco.IRange): monaco.languages.CompletionItem[] {
  return allolibFunctions.map(fn => ({
    label: fn.name,
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: fn.name + '($0)',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail: fn.signature,
    documentation: {
      value: `**${fn.returnType}** ${fn.signature}\n\n${fn.description}`,
    },
    range,
  }))
}

/**
 * Create Monaco completion items for AlloLib class names
 */
export function getClassCompletions(range: monaco.IRange): monaco.languages.CompletionItem[] {
  return Object.values(allolibClasses).map(cls => ({
    label: cls.name,
    kind: monaco.languages.CompletionItemKind.Class,
    insertText: cls.name,
    detail: 'AlloLib class',
    documentation: {
      value: `**${cls.name}**\n\n${cls.description}`,
    },
    range,
  }))
}

/**
 * Get signature help for a function call
 */
export function getSignatureHelp(
  functionName: string,
  className?: string
): monaco.languages.SignatureHelp | null {
  let methods: AlloLibMethod[] = []

  if (className && allolibClasses[className]) {
    methods = allolibClasses[className].methods.filter(m => m.name === functionName)
  } else {
    methods = allolibFunctions.filter(f => f.name === functionName)
  }

  if (methods.length === 0) return null

  return {
    signatures: methods.map(m => ({
      label: m.signature,
      documentation: m.description,
      parameters: m.parameters?.map(p => ({
        label: p.name,
        documentation: p.description || `${p.type} ${p.name}`,
      })) || [],
    })),
    activeSignature: 0,
    activeParameter: 0,
  }
}
