/**
 * AlloLib Glossary
 *
 * Comprehensive dictionary of AlloLib terms, classes, and concepts
 * covering both native (desktop) and online (WASM) versions.
 */

export interface GlossaryEntry {
  term: string
  category: string
  definition: string
  syntax?: string
  example?: string
  platforms: ('native' | 'web' | 'both')[]
  relatedTerms?: string[]
  webAlternative?: string  // For native-only features
}

export interface GlossaryCategory {
  id: string
  title: string
  description: string
}

export const categories: GlossaryCategory[] = [
  // Fundamentals - Start here
  { id: 'core', title: 'Core Concepts', description: 'Fundamental AlloLib architecture: App class, namespaces, and macros' },
  { id: 'app', title: 'App Lifecycle', description: 'Application callbacks: onCreate, onDraw, onSound, and input handlers' },

  // Graphics & Math - Visual programming
  { id: 'graphics', title: 'Graphics', description: 'Rendering: Graphics class, Mesh, Shader, Texture, FBO, shapes, and draw state' },
  { id: 'math', title: 'Math', description: 'Math utilities: Vec, Mat, Quat, Random, interpolation, and functions' },
  { id: 'spatial', title: 'Spatial', description: '3D positioning: Pose, Nav, Lens, Viewpoint, and coordinate frames' },

  // Audio & Synthesis - Sound programming
  { id: 'audio', title: 'Audio I/O', description: 'Audio system: AudioIOData, buffers, spatialization (VBAP, Ambisonics)' },
  { id: 'gamma', title: 'Gamma DSP', description: 'Synthesis library: oscillators, envelopes, filters, effects, and spectral' },
  { id: 'scene', title: 'Scene & Synth', description: 'Polyphonic synthesis: SynthVoice, PolySynth, DynamicScene, sequencing' },

  // I/O & Types - Utilities
  { id: 'io', title: 'Input/Output', description: 'I/O handling: Keyboard, Mouse, Window, File, MIDI, OSC, and network' },
  { id: 'types', title: 'Types & Parameters', description: 'Data types: Color, HSV, Parameter classes, and thread-safe controls' },

  // Platform-specific
  { id: 'web', title: 'Web Platform', description: 'AlloLib Online: web alternatives for native features and WASM utilities' },

  // Studio Extended Features
  { id: 'studio', title: 'Studio Features', description: 'Extended features: OBJ loading, HDR environments, PBR materials, LOD, quality management' },
]

export const glossary: GlossaryEntry[] = [
  // ============================================================================
  // CORE CONCEPTS
  // ============================================================================
  {
    term: 'App',
    category: 'core',
    definition: 'The main application class that integrates graphics, audio, and interaction. All AlloLib applications inherit from this class and override its virtual methods.',
    syntax: 'class MyApp : public al::App { ... };',
    example: `struct MyApp : App {
  void onCreate() override { nav().pos(0, 0, 10); }
  void onDraw(Graphics& g) override { g.clear(0); }
};`,
    platforms: ['both'],
    relatedTerms: ['WebApp', 'onCreate', 'onDraw', 'onSound'],
  },
  {
    term: 'WebApp',
    category: 'core',
    definition: 'The web-specific application class for AlloLib Online. Provides the same interface as App but runs in the browser via WebAssembly. Used with ALLOLIB_WEB_MAIN macro.',
    syntax: 'class MyApp : public al::WebApp { ... };',
    platforms: ['web'],
    relatedTerms: ['App', 'ALLOLIB_WEB_MAIN'],
  },
  {
    term: 'Domain',
    category: 'core',
    definition: 'Asynchronous execution contexts that handle different aspects of the application. Includes AudioDomain, OpenGLGraphicsDomain, SimulationDomain, and OSCDomain.',
    platforms: ['native'],
    relatedTerms: ['AudioDomain', 'OpenGLGraphicsDomain'],
  },
  {
    term: 'ALLOLIB_WEB_MAIN',
    category: 'core',
    definition: 'Macro that sets up the entry point for AlloLib Online applications. Creates the necessary Emscripten exports and main function.',
    syntax: 'ALLOLIB_WEB_MAIN(MyAppClass)',
    example: `class MyApp : public al::WebApp { ... };
ALLOLIB_WEB_MAIN(MyApp)`,
    platforms: ['web'],
    relatedTerms: ['WebApp', 'ALLOLIB_MAIN'],
  },
  {
    term: 'ALLOLIB_MAIN',
    category: 'core',
    definition: 'Cross-platform macro that works on both native and web. Expands to the appropriate entry point for each platform.',
    syntax: 'ALLOLIB_MAIN(MyAppClass)',
    platforms: ['both'],
    relatedTerms: ['ALLOLIB_WEB_MAIN', 'al_compat.hpp'],
  },
  {
    term: 'namespace al',
    category: 'core',
    definition: 'All AlloLib classes, functions, and types are contained in the al namespace.',
    syntax: 'using namespace al;',
    platforms: ['both'],
  },

  // ============================================================================
  // APPLICATION METHODS
  // ============================================================================
  {
    term: 'onCreate()',
    category: 'app',
    definition: 'Virtual method called once when the application starts. Use for initialization, loading resources, and setting up initial state.',
    syntax: 'void onCreate() override { ... }',
    example: `void onCreate() override {
  nav().pos(0, 0, 10);
  addSphere(mesh, 1.0);
  mesh.generateNormals();
}`,
    platforms: ['both'],
    relatedTerms: ['onExit', 'start'],
  },
  {
    term: 'onAnimate()',
    category: 'app',
    definition: 'Virtual method called every frame for animation and state updates. Receives delta time (dt) in seconds since the last frame.',
    syntax: 'void onAnimate(double dt) override { ... }',
    example: `void onAnimate(double dt) override {
  angle += dt * rotationSpeed;
  position += velocity * dt;
}`,
    platforms: ['both'],
    relatedTerms: ['onDraw', 'onCreate'],
  },
  {
    term: 'onDraw()',
    category: 'app',
    definition: 'Virtual method called every frame for rendering graphics. Receives a Graphics reference for drawing operations.',
    syntax: 'void onDraw(Graphics& g) override { ... }',
    example: `void onDraw(Graphics& g) override {
  g.clear(0);
  g.pushMatrix();
  g.translate(0, 0, -5);
  g.draw(mesh);
  g.popMatrix();
}`,
    platforms: ['both'],
    relatedTerms: ['Graphics', 'onAnimate'],
  },
  {
    term: 'onSound()',
    category: 'app',
    definition: 'Virtual method called for each audio block to process audio. Receives AudioIOData for reading input and writing output samples.',
    syntax: 'void onSound(AudioIOData& io) override { ... }',
    example: `void onSound(AudioIOData& io) override {
  while(io()) {
    float sample = osc() * 0.5f;
    io.out(0) = sample;
    io.out(1) = sample;
  }
}`,
    platforms: ['both'],
    relatedTerms: ['AudioIOData', 'configureAudio'],
  },
  {
    term: 'onKeyDown()',
    category: 'app',
    definition: 'Virtual method called when a keyboard key is pressed. Return true if the event was handled.',
    syntax: 'bool onKeyDown(const Keyboard& k) override { ... }',
    example: `bool onKeyDown(const Keyboard& k) override {
  if (k.key() == ' ') {
    playing = !playing;
    return true;
  }
  return false;
}`,
    platforms: ['both'],
    relatedTerms: ['onKeyUp', 'Keyboard'],
  },
  {
    term: 'onKeyUp()',
    category: 'app',
    definition: 'Virtual method called when a keyboard key is released.',
    syntax: 'bool onKeyUp(const Keyboard& k) override { ... }',
    platforms: ['both'],
    relatedTerms: ['onKeyDown', 'Keyboard'],
  },
  {
    term: 'onMouseDown()',
    category: 'app',
    definition: 'Virtual method called when a mouse button is pressed.',
    syntax: 'bool onMouseDown(const Mouse& m) override { ... }',
    platforms: ['both'],
    relatedTerms: ['onMouseUp', 'onMouseDrag', 'Mouse'],
  },
  {
    term: 'onMouseDrag()',
    category: 'app',
    definition: 'Virtual method called when the mouse is moved while a button is pressed.',
    syntax: 'bool onMouseDrag(const Mouse& m) override { ... }',
    platforms: ['both'],
    relatedTerms: ['onMouseMove', 'Mouse'],
  },
  {
    term: 'onMouseScroll()',
    category: 'app',
    definition: 'Virtual method called when the mouse wheel is scrolled.',
    syntax: 'bool onMouseScroll(const Mouse& m) override { ... }',
    platforms: ['both'],
    relatedTerms: ['Mouse'],
  },
  {
    term: 'onExit()',
    category: 'app',
    definition: 'Virtual method called when the application is about to exit. Use for cleanup.',
    syntax: 'void onExit() override { ... }',
    platforms: ['both'],
    relatedTerms: ['onCreate', 'stop'],
  },
  {
    term: 'onResize()',
    category: 'app',
    definition: 'Virtual method called when the window is resized.',
    syntax: 'void onResize(int w, int h) override { ... }',
    platforms: ['both'],
  },
  {
    term: 'start()',
    category: 'app',
    definition: 'Starts the application main loop. This method does not return until the application exits.',
    syntax: 'app.start();',
    platforms: ['both'],
    relatedTerms: ['stop', 'onCreate'],
  },
  {
    term: 'stop()',
    category: 'app',
    definition: 'Stops the application and exits the main loop.',
    syntax: 'app.stop();',
    platforms: ['both'],
    relatedTerms: ['start', 'onExit'],
  },
  {
    term: 'nav()',
    category: 'app',
    definition: 'Returns a reference to the navigation pose (camera position and orientation). Use to control the viewpoint.',
    syntax: 'Pose& nav()',
    example: `nav().pos(0, 0, 10);  // Set camera position
nav().faceToward(Vec3d(0, 0, 0));  // Look at origin`,
    platforms: ['both'],
    relatedTerms: ['Pose', 'pose', 'view', 'lens'],
  },
  {
    term: 'pose()',
    category: 'app',
    definition: 'Alias for nav(). Returns a reference to the camera pose.',
    syntax: 'Pose& pose()',
    platforms: ['both'],
    relatedTerms: ['nav', 'Pose'],
  },
  {
    term: 'lens()',
    category: 'app',
    definition: 'Returns a reference to the camera lens (projection settings like field of view, near/far clip planes).',
    syntax: 'Lens& lens()',
    example: `lens().fovy(60);        // Set field of view
lens().near(0.1);       // Set near clip
lens().far(1000);       // Set far clip`,
    platforms: ['both'],
    relatedTerms: ['Lens', 'view', 'nav'],
  },
  {
    term: 'view()',
    category: 'app',
    definition: 'Returns a reference to the Viewpoint (combined lens and pose for camera rendering).',
    syntax: 'Viewpoint& view()',
    platforms: ['both'],
    relatedTerms: ['Viewpoint', 'lens', 'nav'],
  },
  {
    term: 'configureAudio()',
    category: 'app',
    definition: 'Configures audio settings before starting the application.',
    syntax: 'configureAudio(sampleRate, bufferSize, outputChannels, inputChannels)',
    example: 'configureAudio(44100, 512, 2, 0);  // 44.1kHz, stereo out, no input',
    platforms: ['both'],
    relatedTerms: ['configureWebAudio', 'onSound', 'AudioIOData'],
  },
  {
    term: 'configureWebAudio()',
    category: 'app',
    definition: 'Web-specific audio configuration. In AlloLib Online, configureAudio() maps to this function.',
    syntax: 'configureWebAudio(sampleRate, bufferSize, outputChannels, inputChannels)',
    platforms: ['web'],
    relatedTerms: ['configureAudio'],
  },
  {
    term: 'graphics()',
    category: 'app',
    definition: 'Returns a reference to the Graphics object for rendering outside of onDraw.',
    syntax: 'Graphics& graphics()',
    platforms: ['both'],
    relatedTerms: ['Graphics', 'onDraw'],
  },
  {
    term: 'aspect()',
    category: 'app',
    definition: 'Returns the window aspect ratio (width / height).',
    syntax: 'double aspect()',
    platforms: ['both'],
    relatedTerms: ['width', 'height'],
  },
  {
    term: 'width()',
    category: 'app',
    definition: 'Returns the window width in pixels.',
    syntax: 'int width()',
    platforms: ['both'],
    relatedTerms: ['height', 'aspect'],
  },
  {
    term: 'height()',
    category: 'app',
    definition: 'Returns the window height in pixels.',
    syntax: 'int height()',
    platforms: ['both'],
    relatedTerms: ['width', 'aspect'],
  },

  // ============================================================================
  // GRAPHICS - CORE CLASSES
  // ============================================================================
  {
    term: 'Graphics',
    category: 'graphics',
    definition: 'High-level graphics rendering interface that simplifies OpenGL operations. Manages state, shaders, and provides drawing methods.',
    platforms: ['both'],
    relatedTerms: ['Mesh', 'ShaderProgram', 'onDraw'],
  },
  {
    term: 'Mesh',
    category: 'graphics',
    definition: 'Container for vertex-based geometry including vertices, colors, normals, texture coordinates, and indices.',
    syntax: 'Mesh mesh;',
    example: `Mesh mesh;
mesh.primitive(Mesh::TRIANGLES);
mesh.vertex(0, 0, 0);
mesh.vertex(1, 0, 0);
mesh.vertex(0, 1, 0);
mesh.color(1, 0, 0);
mesh.generateNormals();`,
    platforms: ['both'],
    relatedTerms: ['Vertex', 'Graphics', 'Primitive'],
  },
  {
    term: 'Primitive',
    category: 'graphics',
    definition: 'Basic rendering shape types: POINTS, LINES, LINE_STRIP, LINE_LOOP, TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN.',
    syntax: 'mesh.primitive(Mesh::TRIANGLES);',
    platforms: ['both'],
    relatedTerms: ['Mesh'],
  },
  {
    term: 'Vertex',
    category: 'graphics',
    definition: 'A point in 3D space (typedef for Vec3f). Meshes are built from vertices.',
    syntax: 'mesh.vertex(x, y, z);',
    platforms: ['both'],
    relatedTerms: ['Mesh', 'Vec3f'],
  },
  {
    term: 'Normal',
    category: 'graphics',
    definition: 'A direction vector perpendicular to a surface, used for lighting calculations.',
    syntax: 'mesh.normal(x, y, z);',
    platforms: ['both'],
    relatedTerms: ['Mesh', 'generateNormals'],
  },
  {
    term: 'generateNormals()',
    category: 'graphics',
    definition: 'Automatically generates normals for a mesh based on its triangles.',
    syntax: 'mesh.generateNormals();',
    platforms: ['both'],
    relatedTerms: ['Normal', 'Mesh'],
  },
  // --- Graphics Draw Methods ---
  {
    term: 'clear()',
    category: 'graphics',
    definition: 'Clears the screen with a specified color.',
    syntax: 'g.clear(r, g, b, a);  // or g.clear(gray);',
    example: 'g.clear(0.1, 0.1, 0.1);  // Dark gray background',
    platforms: ['both'],
    relatedTerms: ['Graphics'],
  },
  {
    term: 'draw()',
    category: 'graphics',
    definition: 'Renders a mesh using current graphics state.',
    syntax: 'g.draw(mesh);',
    platforms: ['both'],
    relatedTerms: ['Mesh', 'Graphics'],
  },
  // --- Transform Stack ---
  {
    term: 'pushMatrix()',
    category: 'graphics',
    definition: 'Saves the current transformation matrix onto a stack.',
    syntax: 'g.pushMatrix();',
    example: `g.pushMatrix();
g.translate(1, 0, 0);
g.draw(mesh);
g.popMatrix();  // Restore original transform`,
    platforms: ['both'],
    relatedTerms: ['popMatrix', 'translate', 'rotate', 'scale'],
  },
  {
    term: 'popMatrix()',
    category: 'graphics',
    definition: 'Restores the last saved transformation matrix from the stack.',
    syntax: 'g.popMatrix();',
    platforms: ['both'],
    relatedTerms: ['pushMatrix'],
  },
  {
    term: 'translate()',
    category: 'graphics',
    definition: 'Translates (moves) subsequent drawing by the specified amounts.',
    syntax: 'g.translate(x, y, z);',
    platforms: ['both'],
    relatedTerms: ['rotate', 'scale', 'pushMatrix'],
  },
  {
    term: 'rotate()',
    category: 'graphics',
    definition: 'Rotates subsequent drawing around an axis.',
    syntax: 'g.rotate(angle, x, y, z);  // angle in radians',
    example: 'g.rotate(M_PI/4, 0, 1, 0);  // Rotate 45° around Y axis',
    platforms: ['both'],
    relatedTerms: ['translate', 'scale'],
  },
  {
    term: 'scale()',
    category: 'graphics',
    definition: 'Scales subsequent drawing by the specified amounts.',
    syntax: 'g.scale(x, y, z);  // or g.scale(uniform);',
    platforms: ['both'],
    relatedTerms: ['translate', 'rotate'],
  },
  {
    term: 'color()',
    category: 'graphics',
    definition: 'Sets a uniform color for subsequent drawing.',
    syntax: 'g.color(r, g, b, a);  // or g.color(Color& c);',
    example: 'g.color(1, 0, 0);  // Red',
    platforms: ['both'],
    relatedTerms: ['Color', 'meshColor'],
  },
  {
    term: 'meshColor()',
    category: 'graphics',
    definition: 'Enables per-vertex colors from the mesh instead of a uniform color.',
    syntax: 'g.meshColor();',
    platforms: ['both'],
    relatedTerms: ['color', 'Mesh'],
  },
  // --- Blending & Render State ---
  {
    term: 'blending()',
    category: 'graphics',
    definition: 'Enables or disables alpha blending for transparency effects.',
    syntax: 'g.blending(true);',
    platforms: ['both'],
    relatedTerms: ['blendTrans', 'blendAdd'],
  },
  {
    term: 'blendTrans()',
    category: 'graphics',
    definition: 'Sets standard transparency blending mode.',
    syntax: 'g.blendTrans();',
    platforms: ['both'],
    relatedTerms: ['blending', 'blendAdd'],
  },
  {
    term: 'blendAdd()',
    category: 'graphics',
    definition: 'Sets additive blending mode (colors add together).',
    syntax: 'g.blendAdd();',
    platforms: ['both'],
    relatedTerms: ['blending', 'blendTrans'],
  },
  {
    term: 'depthTesting()',
    category: 'graphics',
    definition: 'Enables or disables depth testing (z-buffer).',
    syntax: 'g.depthTesting(true);',
    platforms: ['both'],
    relatedTerms: ['culling'],
  },
  {
    term: 'culling()',
    category: 'graphics',
    definition: 'Enables or disables face culling (hiding back-facing polygons).',
    syntax: 'g.culling(true);',
    platforms: ['both'],
    relatedTerms: ['depthTesting'],
  },
  // --- Lighting ---
  {
    term: 'lighting()',
    category: 'graphics',
    definition: 'Enables or disables lighting calculations.',
    syntax: 'g.lighting(true);',
    platforms: ['both'],
    relatedTerms: ['Light', 'light'],
  },
  {
    term: 'light()',
    category: 'graphics',
    definition: 'Sets a light at the specified index.',
    syntax: 'g.light(myLight, index);',
    platforms: ['both'],
    relatedTerms: ['Light', 'lighting'],
  },
  {
    term: 'pointSize()',
    category: 'graphics',
    definition: 'Sets the size of point primitives in pixels.',
    syntax: 'g.pointSize(5.0f);',
    platforms: ['both'],
    relatedTerms: ['lineWidth'],
  },
  {
    term: 'lineWidth()',
    category: 'graphics',
    definition: 'Sets the width of line primitives in pixels.',
    syntax: 'g.lineWidth(2.0f);',
    platforms: ['both'],
    relatedTerms: ['pointSize'],
  },
  {
    term: 'camera()',
    category: 'graphics',
    definition: 'Sets the camera view from a Pose or Viewpoint.',
    syntax: 'g.camera(nav());  // or g.camera(view());',
    platforms: ['both'],
    relatedTerms: ['Pose', 'Viewpoint', 'nav'],
  },
  {
    term: 'Light',
    category: 'graphics',
    definition: 'Represents a light source with position, colors, and attenuation.',
    syntax: 'Light light;',
    example: `Light light;
light.pos(5, 5, 5);
light.diffuse(Color(1, 1, 1));`,
    platforms: ['both'],
    relatedTerms: ['lighting', 'light'],
  },
  // --- Textures & Shaders ---
  {
    term: 'Texture',
    category: 'graphics',
    definition: 'Image data stored on the GPU for texture mapping.',
    syntax: 'Texture texture;',
    platforms: ['both'],
    relatedTerms: ['texture'],
  },
  {
    term: 'ShaderProgram',
    category: 'graphics',
    definition: 'Links vertex and fragment shaders into a GPU program.',
    syntax: 'ShaderProgram shader;',
    example: `ShaderProgram shader;
shader.compile(vertexSrc, fragmentSrc);
shader.begin();
// draw
shader.end();`,
    platforms: ['both'],
    relatedTerms: ['Shader', 'uniform'],
  },
  {
    term: 'Shader',
    category: 'graphics',
    definition: 'A single shader stage (vertex, fragment, or geometry).',
    platforms: ['both'],
    relatedTerms: ['ShaderProgram'],
  },
  {
    term: 'uniform()',
    category: 'graphics',
    definition: 'Sets a uniform variable in a shader program.',
    syntax: 'shader.uniform("name", value);',
    platforms: ['both'],
    relatedTerms: ['ShaderProgram'],
  },
  {
    term: 'FBO',
    category: 'graphics',
    definition: 'Framebuffer Object - allows off-screen rendering to a texture.',
    platforms: ['both'],
    relatedTerms: ['Texture'],
  },
  {
    term: 'VAO',
    category: 'graphics',
    definition: 'Vertex Array Object - container for vertex attribute state.',
    platforms: ['both'],
    relatedTerms: ['VBO', 'Mesh'],
  },
  {
    term: 'VBO',
    category: 'graphics',
    definition: 'Vertex Buffer Object - GPU buffer for vertex data.',
    platforms: ['both'],
    relatedTerms: ['VAO', 'Mesh'],
  },

  // --- Shape Factory Functions ---
  {
    term: 'addSphere()',
    category: 'graphics',
    definition: 'Adds a sphere to a mesh.',
    syntax: 'addSphere(mesh, radius, slices, stacks);',
    example: 'addSphere(mesh, 1.0, 32, 32);',
    platforms: ['both'],
    relatedTerms: ['Mesh', 'addIcosphere'],
  },
  {
    term: 'addIcosphere()',
    category: 'graphics',
    definition: 'Adds an icosphere (geodesic sphere) to a mesh.',
    syntax: 'addIcosphere(mesh, radius, subdivisions);',
    platforms: ['both'],
    relatedTerms: ['Mesh', 'addSphere'],
  },
  {
    term: 'addCube()',
    category: 'graphics',
    definition: 'Adds a cube to a mesh.',
    syntax: 'addCube(mesh, size);',
    platforms: ['both'],
    relatedTerms: ['Mesh', 'addWireBox'],
  },
  {
    term: 'addCone()',
    category: 'graphics',
    definition: 'Adds a cone to a mesh.',
    syntax: 'addCone(mesh, radius, apex, slices);',
    platforms: ['both'],
    relatedTerms: ['Mesh', 'addCylinder'],
  },
  {
    term: 'addCylinder()',
    category: 'graphics',
    definition: 'Adds a cylinder to a mesh.',
    syntax: 'addCylinder(mesh, radius, height, slices);',
    platforms: ['both'],
    relatedTerms: ['Mesh', 'addCone'],
  },
  {
    term: 'addTorus()',
    category: 'graphics',
    definition: 'Adds a torus (donut shape) to a mesh.',
    syntax: 'addTorus(mesh, minorRadius, majorRadius, minorRes, majorRes);',
    platforms: ['both'],
    relatedTerms: ['Mesh'],
  },
  {
    term: 'addDisc()',
    category: 'graphics',
    definition: 'Adds a disc (filled circle) to a mesh.',
    syntax: 'addDisc(mesh, radius, slices);',
    platforms: ['both'],
    relatedTerms: ['Mesh'],
  },
  {
    term: 'addWireBox()',
    category: 'graphics',
    definition: 'Adds a wireframe box to a mesh.',
    syntax: 'addWireBox(mesh, size);',
    platforms: ['both'],
    relatedTerms: ['Mesh', 'addCube'],
  },

  // ============================================================================
  // AUDIO - CORE CLASSES
  // ============================================================================
  {
    term: 'AudioIOData',
    category: 'audio',
    definition: 'Provides access to audio buffers in the audio callback. Contains methods for reading input and writing output samples.',
    syntax: 'void onSound(AudioIOData& io) { ... }',
    example: `void onSound(AudioIOData& io) {
  while(io()) {
    float sample = generateSample();
    io.out(0) = sample;  // Left
    io.out(1) = sample;  // Right
  }
}`,
    platforms: ['both'],
    relatedTerms: ['onSound', 'AudioIO'],
  },
  {
    term: 'AudioIO',
    category: 'audio',
    definition: 'Audio input/output stream manager. Handles audio device setup and streaming.',
    platforms: ['native'],
    webAlternative: 'Web Audio API is used automatically',
    relatedTerms: ['AudioIOData'],
  },
  {
    term: 'io()',
    category: 'audio',
    definition: 'Advances to the next audio frame. Returns true while frames remain in the buffer.',
    syntax: 'while(io()) { ... }',
    platforms: ['both'],
    relatedTerms: ['AudioIOData'],
  },
  {
    term: 'io.out()',
    category: 'audio',
    definition: 'Writes a sample to an output channel at the current frame.',
    syntax: 'io.out(channel) = sample;  // or io.out(channel, frame) = sample;',
    platforms: ['both'],
    relatedTerms: ['io.in', 'AudioIOData'],
  },
  {
    term: 'io.in()',
    category: 'audio',
    definition: 'Reads a sample from an input channel at the current frame.',
    syntax: 'float sample = io.in(channel);  // or io.in(channel, frame);',
    platforms: ['both'],
    relatedTerms: ['io.out', 'AudioIOData'],
  },
  {
    term: 'framesPerSecond()',
    category: 'audio',
    definition: 'Returns the audio sample rate (typically 44100 or 48000 Hz).',
    syntax: 'int rate = io.framesPerSecond();',
    platforms: ['both'],
    relatedTerms: ['framesPerBuffer', 'AudioIOData'],
  },
  {
    term: 'framesPerBuffer()',
    category: 'audio',
    definition: 'Returns the number of audio frames in each buffer (block size).',
    syntax: 'int blockSize = io.framesPerBuffer();',
    platforms: ['both'],
    relatedTerms: ['framesPerSecond', 'AudioIOData'],
  },
  {
    term: 'channelsOut()',
    category: 'audio',
    definition: 'Returns the number of output audio channels.',
    syntax: 'int numOut = io.channelsOut();',
    platforms: ['both'],
    relatedTerms: ['channelsIn', 'AudioIOData'],
  },
  {
    term: 'channelsIn()',
    category: 'audio',
    definition: 'Returns the number of input audio channels.',
    syntax: 'int numIn = io.channelsIn();',
    platforms: ['both'],
    relatedTerms: ['channelsOut', 'AudioIOData'],
  },
  {
    term: 'Frame',
    category: 'audio',
    definition: 'A single audio sample across all channels at one point in time.',
    platforms: ['both'],
    relatedTerms: ['Block', 'AudioIOData'],
  },
  {
    term: 'Block',
    category: 'audio',
    definition: 'A buffer of audio frames processed together (typically 128-2048 frames).',
    platforms: ['both'],
    relatedTerms: ['Frame', 'framesPerBuffer'],
  },
  {
    term: 'Sample Rate',
    category: 'audio',
    definition: 'The number of audio frames per second (typically 44100 or 48000 Hz).',
    platforms: ['both'],
    relatedTerms: ['framesPerSecond'],
  },
  // --- Spatial Audio ---
  {
    term: 'Spatializer',
    category: 'audio',
    definition: 'Abstract base class for audio spatialization algorithms.',
    platforms: ['native'],
    webAlternative: 'Web Audio PannerNode or custom implementation',
    relatedTerms: ['Ambisonics', 'VBAP'],
  },
  {
    term: 'Ambisonics',
    category: 'audio',
    definition: 'Spherical harmonic-based spatial audio encoding/decoding system.',
    platforms: ['native'],
    relatedTerms: ['Spatializer', 'VBAP'],
  },
  {
    term: 'VBAP',
    category: 'audio',
    definition: 'Vector-Based Amplitude Panning - spatial audio technique using speaker arrays.',
    platforms: ['native'],
    relatedTerms: ['Spatializer', 'DBAP'],
  },
  {
    term: 'DBAP',
    category: 'audio',
    definition: 'Distance-Based Amplitude Panning - spatial audio technique based on source-listener distance.',
    platforms: ['native'],
    relatedTerms: ['Spatializer', 'VBAP'],
  },
  {
    term: 'SoundFile',
    category: 'audio',
    definition: 'Class for reading and writing audio files (WAV, FLAC, OGG).',
    platforms: ['native'],
    webAlternative: 'WebSamplePlayer',
    relatedTerms: ['WebSamplePlayer'],
  },

  // ============================================================================
  // MATH - VECTORS
  // ============================================================================
  {
    term: 'Vec',
    category: 'math',
    definition: 'N-dimensional vector template class. Common types: Vec2f, Vec3f, Vec4f (float), Vec3d (double).',
    syntax: 'Vec3f v(x, y, z);',
    example: `Vec3f a(1, 2, 3);
Vec3f b(4, 5, 6);
Vec3f c = a + b;      // (5, 7, 9)
float d = a.dot(b);   // 32
Vec3f n = a.normalize();`,
    platforms: ['both'],
    relatedTerms: ['Vec2f', 'Vec3f', 'Vec4f', 'Vec3d'],
  },
  {
    term: 'Vec2f',
    category: 'math',
    definition: '2D float vector with x, y components.',
    syntax: 'Vec2f v(x, y);',
    platforms: ['both'],
    relatedTerms: ['Vec', 'Vec3f'],
  },
  {
    term: 'Vec3f',
    category: 'math',
    definition: '3D float vector with x, y, z components. The most commonly used vector type.',
    syntax: 'Vec3f v(x, y, z);',
    platforms: ['both'],
    relatedTerms: ['Vec', 'Vec3d', 'Vec4f'],
  },
  {
    term: 'Vec3d',
    category: 'math',
    definition: '3D double-precision vector.',
    syntax: 'Vec3d v(x, y, z);',
    platforms: ['both'],
    relatedTerms: ['Vec3f'],
  },
  {
    term: 'Vec4f',
    category: 'math',
    definition: '4D float vector with x, y, z, w components.',
    syntax: 'Vec4f v(x, y, z, w);',
    platforms: ['both'],
    relatedTerms: ['Vec3f'],
  },
  {
    term: 'dot()',
    category: 'math',
    definition: 'Computes the dot product of two vectors.',
    syntax: 'float d = a.dot(b);',
    platforms: ['both'],
    relatedTerms: ['Vec', 'cross'],
  },
  {
    term: 'cross()',
    category: 'math',
    definition: 'Computes the cross product of two 3D vectors.',
    syntax: 'Vec3f c = a.cross(b);',
    platforms: ['both'],
    relatedTerms: ['Vec', 'dot'],
  },
  {
    term: 'mag()',
    category: 'math',
    definition: 'Returns the magnitude (length) of a vector.',
    syntax: 'float length = v.mag();',
    platforms: ['both'],
    relatedTerms: ['magSqr', 'normalize'],
  },
  {
    term: 'magSqr()',
    category: 'math',
    definition: 'Returns the squared magnitude of a vector (faster than mag()).',
    syntax: 'float lengthSq = v.magSqr();',
    platforms: ['both'],
    relatedTerms: ['mag'],
  },
  {
    term: 'normalize()',
    category: 'math',
    definition: 'Normalizes a vector to unit length.',
    syntax: 'v.normalize();  // modifies in place',
    platforms: ['both'],
    relatedTerms: ['mag', 'Vec'],
  },
  {
    term: 'lerp()',
    category: 'math',
    definition: 'Linear interpolation between two values or vectors.',
    syntax: 'v.lerp(target, amount);  // amount in [0, 1]',
    platforms: ['both'],
    relatedTerms: ['slerp'],
  },
  // --- Quaternions ---
  {
    term: 'Quat',
    category: 'math',
    definition: 'Quaternion for representing 3D rotations. Avoids gimbal lock and provides smooth interpolation.',
    syntax: 'Quatd q;',
    example: `Quatd q;
q.fromAxisAngle(M_PI/4, Vec3d(0, 1, 0));  // 45° around Y
Vec3d rotated = q.rotate(point);`,
    platforms: ['both'],
    relatedTerms: ['Quatd', 'Quatf', 'slerp'],
  },
  {
    term: 'Quatd',
    category: 'math',
    definition: 'Double-precision quaternion (w, x, y, z components).',
    syntax: 'Quatd q(w, x, y, z);',
    platforms: ['both'],
    relatedTerms: ['Quat', 'Quatf'],
  },
  {
    term: 'Quatf',
    category: 'math',
    definition: 'Single-precision quaternion.',
    syntax: 'Quatf q(w, x, y, z);',
    platforms: ['both'],
    relatedTerms: ['Quat', 'Quatd'],
  },
  {
    term: 'slerp()',
    category: 'math',
    definition: 'Spherical linear interpolation for smooth rotation between quaternions.',
    syntax: 'Quatd q = Quatd::slerp(q1, q2, amount);',
    platforms: ['both'],
    relatedTerms: ['Quat', 'lerp'],
  },
  // --- Matrices ---
  {
    term: 'Mat',
    category: 'math',
    definition: 'NxN matrix template class. Common types: Mat4f, Mat4d.',
    platforms: ['both'],
    relatedTerms: ['Mat4f', 'Matrix4f'],
  },
  {
    term: 'Mat4f',
    category: 'math',
    definition: '4x4 float matrix for transformations.',
    syntax: 'Mat4f m;',
    platforms: ['both'],
    relatedTerms: ['Matrix4f', 'Mat'],
  },
  {
    term: 'Matrix4f',
    category: 'math',
    definition: 'Alias for Mat4f. 4x4 float matrix.',
    platforms: ['both'],
    relatedTerms: ['Mat4f'],
  },
  // --- Random Numbers ---
  {
    term: 'rnd::uniform()',
    category: 'math',
    definition: 'Returns a random value in [0, 1) or [0, hi) or [lo, hi).',
    syntax: 'float r = rnd::uniform();',
    example: `float r = rnd::uniform();        // [0, 1)
float r2 = rnd::uniform(10);     // [0, 10)
float r3 = rnd::uniform(5, 10);  // [5, 10)`,
    platforms: ['both'],
    relatedTerms: ['rnd::uniformS', 'rnd::prob'],
  },
  {
    term: 'rnd::uniformS()',
    category: 'math',
    definition: 'Returns a random value in [-1, 1).',
    syntax: 'float r = rnd::uniformS();',
    platforms: ['both'],
    relatedTerms: ['rnd::uniform'],
  },
  {
    term: 'rnd::prob()',
    category: 'math',
    definition: 'Returns true with the given probability.',
    syntax: 'bool b = rnd::prob(0.5);  // 50% chance of true',
    platforms: ['both'],
    relatedTerms: ['rnd::uniform'],
  },
  {
    term: 'rnd::gaussian()',
    category: 'math',
    definition: 'Returns a random value from a Gaussian (normal) distribution.',
    syntax: 'float r = rnd::gaussian();',
    platforms: ['both'],
    relatedTerms: ['rnd::uniform'],
  },
  // --- Math Utility Functions ---
  {
    term: 'wrap()',
    category: 'math',
    definition: 'Wraps a value to a range (like modulo but works with negative numbers).',
    syntax: 'float w = wrap(value, hi);  // or wrap(value, lo, hi);',
    platforms: ['both'],
    relatedTerms: ['fold', 'clip'],
  },
  {
    term: 'fold()',
    category: 'math',
    definition: 'Folds a value at boundaries (reflects back instead of wrapping).',
    syntax: 'float f = fold(value, hi);',
    platforms: ['both'],
    relatedTerms: ['wrap', 'clip'],
  },
  {
    term: 'clip()',
    category: 'math',
    definition: 'Clamps a value to a range.',
    syntax: 'float c = clip(value, lo, hi);',
    platforms: ['both'],
    relatedTerms: ['wrap', 'fold'],
  },

  // ============================================================================
  // SPATIAL
  // ============================================================================
  {
    term: 'Pose',
    category: 'spatial',
    definition: 'Represents a position and orientation in 3D space. Combines Vec3d position with Quatd orientation.',
    syntax: 'Pose pose;',
    example: `Pose p;
p.pos(1, 2, 3);           // Set position
p.faceToward(target);     // Orient toward point
Mat4d m = p.matrix();     // Get transform matrix`,
    platforms: ['both'],
    relatedTerms: ['Nav', 'Vec3d', 'Quatd'],
  },
  {
    term: 'pos()',
    category: 'spatial',
    definition: 'Gets or sets the position component of a Pose.',
    syntax: 'pose.pos(x, y, z);  // or Vec3d p = pose.pos();',
    platforms: ['both'],
    relatedTerms: ['Pose', 'quat'],
  },
  {
    term: 'quat()',
    category: 'spatial',
    definition: 'Gets or sets the orientation quaternion of a Pose.',
    syntax: 'pose.quat(q);  // or Quatd q = pose.quat();',
    platforms: ['both'],
    relatedTerms: ['Pose', 'pos'],
  },
  {
    term: 'faceToward()',
    category: 'spatial',
    definition: 'Orients a Pose to face toward a target point.',
    syntax: 'pose.faceToward(Vec3d& point);',
    platforms: ['both'],
    relatedTerms: ['Pose'],
  },
  {
    term: 'Nav',
    category: 'spatial',
    definition: 'Extends Pose with navigation and movement capabilities. Supports smooth motion and velocity.',
    syntax: 'Nav nav;',
    example: `nav.moveF(1.0);   // Move forward
nav.spin(0.1, 0, 0);  // Rotate
nav.step(dt);         // Update position`,
    platforms: ['native'],
    relatedTerms: ['Pose', 'nav'],
  },
  {
    term: 'moveF()',
    category: 'spatial',
    definition: 'Moves forward (in the direction the Nav is facing).',
    syntax: 'nav.moveF(amount);',
    platforms: ['native'],
    relatedTerms: ['Nav', 'moveR', 'moveU'],
  },
  {
    term: 'moveR()',
    category: 'spatial',
    definition: 'Moves right (perpendicular to facing direction).',
    syntax: 'nav.moveR(amount);',
    platforms: ['native'],
    relatedTerms: ['Nav', 'moveF', 'moveU'],
  },
  {
    term: 'moveU()',
    category: 'spatial',
    definition: 'Moves up.',
    syntax: 'nav.moveU(amount);',
    platforms: ['native'],
    relatedTerms: ['Nav', 'moveF', 'moveR'],
  },
  {
    term: 'spin()',
    category: 'spatial',
    definition: 'Rotates the Nav using Euler angles.',
    syntax: 'nav.spin(x, y, z);',
    platforms: ['native'],
    relatedTerms: ['Nav'],
  },
  {
    term: 'ux(), uy(), uz()',
    category: 'spatial',
    definition: 'Returns the world-space unit vectors of a Pose (right, up, forward).',
    syntax: 'Vec3d forward = pose.uz();',
    platforms: ['both'],
    relatedTerms: ['Pose', 'ur', 'uu', 'uf'],
  },
  {
    term: 'ur(), uu(), uf()',
    category: 'spatial',
    definition: 'Returns the right, up, and forward vectors of a Pose.',
    syntax: 'Vec3d right = pose.ur();',
    platforms: ['both'],
    relatedTerms: ['Pose', 'ux', 'uy', 'uz'],
  },
  {
    term: 'Lens',
    category: 'spatial',
    definition: 'Camera projection settings including field of view and clip planes.',
    syntax: 'Lens lens;',
    example: `lens.fovy(60);       // Field of view in degrees
lens.near(0.1);      // Near clip plane
lens.far(1000);      // Far clip plane`,
    platforms: ['both'],
    relatedTerms: ['Viewpoint', 'lens'],
  },
  {
    term: 'Viewpoint',
    category: 'spatial',
    definition: 'Combines Lens and Pose for complete camera state.',
    platforms: ['both'],
    relatedTerms: ['Lens', 'Pose', 'view'],
  },
  {
    term: 'fovy()',
    category: 'spatial',
    definition: 'Gets or sets the vertical field of view in degrees.',
    syntax: 'lens.fovy(60);',
    platforms: ['both'],
    relatedTerms: ['Lens', 'near', 'far'],
  },
  {
    term: 'near()',
    category: 'spatial',
    definition: 'Gets or sets the near clip plane distance.',
    syntax: 'lens.near(0.1);',
    platforms: ['both'],
    relatedTerms: ['Lens', 'far', 'fovy'],
  },
  {
    term: 'far()',
    category: 'spatial',
    definition: 'Gets or sets the far clip plane distance.',
    syntax: 'lens.far(1000);',
    platforms: ['both'],
    relatedTerms: ['Lens', 'near', 'fovy'],
  },

  // ============================================================================
  // SCENE - POLYPHONIC SYNTHESIS
  // ============================================================================
  {
    term: 'SynthVoice',
    category: 'scene',
    definition: 'Base class for polyphonic synthesis voices. Override onProcess methods for audio and graphics.',
    syntax: 'struct MyVoice : SynthVoice { ... };',
    example: `struct MyVoice : SynthVoice {
  void onProcess(AudioIOData& io) override {
    while(io()) {
      io.out(0) = generateSample();
    }
  }
  void onTriggerOn() override { }
  void onTriggerOff() override { free(); }
};`,
    platforms: ['both'],
    relatedTerms: ['PolySynth', 'PositionedVoice'],
  },
  {
    term: 'PolySynth',
    category: 'scene',
    definition: 'Manager for multiple SynthVoice instances. Handles voice allocation and rendering.',
    syntax: 'PolySynth synth;',
    example: `PolySynth synth;
synth.allocatePolyphony<MyVoice>(16);
auto* voice = synth.getVoice<MyVoice>();
synth.triggerOn(voice);`,
    platforms: ['both'],
    relatedTerms: ['SynthVoice', 'DynamicScene'],
  },
  {
    term: 'DynamicScene',
    category: 'scene',
    definition: 'PolySynth with spatial audio rendering. Automatically spatializes positioned voices.',
    platforms: ['native'],
    webAlternative: 'Use PolySynth with manual panning',
    relatedTerms: ['PolySynth', 'PositionedVoice'],
  },
  {
    term: 'PositionedVoice',
    category: 'scene',
    definition: 'SynthVoice with 3D position for spatial audio.',
    syntax: 'struct MyAgent : PositionedVoice { ... };',
    platforms: ['native'],
    relatedTerms: ['SynthVoice', 'DynamicScene'],
  },
  {
    term: 'triggerOn()',
    category: 'scene',
    definition: 'Starts a voice playing.',
    syntax: 'synth.triggerOn(voice);',
    platforms: ['both'],
    relatedTerms: ['triggerOff', 'PolySynth'],
  },
  {
    term: 'triggerOff()',
    category: 'scene',
    definition: 'Releases a voice (begins release phase).',
    syntax: 'synth.triggerOff(voice);',
    platforms: ['both'],
    relatedTerms: ['triggerOn', 'PolySynth'],
  },
  {
    term: 'free()',
    category: 'scene',
    definition: 'Marks a voice as done and available for reuse.',
    syntax: 'free();  // Call from within voice',
    platforms: ['both'],
    relatedTerms: ['SynthVoice', 'active'],
  },
  {
    term: 'active()',
    category: 'scene',
    definition: 'Returns true if the voice is currently active.',
    syntax: 'if (voice->active()) { ... }',
    platforms: ['both'],
    relatedTerms: ['free', 'SynthVoice'],
  },
  {
    term: 'getVoice()',
    category: 'scene',
    definition: 'Gets a free voice from the PolySynth.',
    syntax: 'auto* voice = synth.getVoice<VoiceType>();',
    platforms: ['both'],
    relatedTerms: ['PolySynth', 'allocatePolyphony'],
  },
  {
    term: 'allocatePolyphony()',
    category: 'scene',
    definition: 'Pre-allocates voices for a PolySynth.',
    syntax: 'synth.allocatePolyphony<VoiceType>(count);',
    platforms: ['both'],
    relatedTerms: ['PolySynth', 'getVoice'],
  },
  {
    term: 'render()',
    category: 'scene',
    definition: 'Renders all active voices for audio or graphics.',
    syntax: 'synth.render(io);  // or synth.render(g);',
    platforms: ['both'],
    relatedTerms: ['PolySynth'],
  },

  // ============================================================================
  // INPUT/OUTPUT - KEYBOARD & MOUSE
  // ============================================================================
  {
    term: 'Keyboard',
    category: 'io',
    definition: 'Provides keyboard state in input callbacks.',
    syntax: 'bool onKeyDown(const Keyboard& k) override { ... }',
    example: `bool onKeyDown(const Keyboard& k) override {
  if (k.key() == 'a') { ... }
  if (k.shift()) { ... }
  return true;
}`,
    platforms: ['both'],
    relatedTerms: ['onKeyDown', 'onKeyUp'],
  },
  {
    term: 'key()',
    category: 'io',
    definition: 'Returns the key code of the pressed/released key.',
    syntax: 'int code = k.key();',
    platforms: ['both'],
    relatedTerms: ['Keyboard'],
  },
  {
    term: 'shift()',
    category: 'io',
    definition: 'Returns true if the Shift modifier is held.',
    syntax: 'if (k.shift()) { ... }',
    platforms: ['both'],
    relatedTerms: ['ctrl', 'alt', 'Keyboard'],
  },
  {
    term: 'ctrl()',
    category: 'io',
    definition: 'Returns true if the Ctrl modifier is held.',
    syntax: 'if (k.ctrl()) { ... }',
    platforms: ['both'],
    relatedTerms: ['shift', 'alt', 'Keyboard'],
  },
  {
    term: 'alt()',
    category: 'io',
    definition: 'Returns true if the Alt modifier is held.',
    syntax: 'if (k.alt()) { ... }',
    platforms: ['both'],
    relatedTerms: ['shift', 'ctrl', 'Keyboard'],
  },
  {
    term: 'Mouse',
    category: 'io',
    definition: 'Provides mouse state in input callbacks.',
    syntax: 'bool onMouseDown(const Mouse& m) override { ... }',
    platforms: ['both'],
    relatedTerms: ['onMouseDown', 'onMouseDrag'],
  },
  {
    term: 'x(), y()',
    category: 'io',
    definition: 'Returns the mouse position.',
    syntax: 'int mx = m.x();',
    platforms: ['both'],
    relatedTerms: ['Mouse', 'dx', 'dy'],
  },
  {
    term: 'dx(), dy()',
    category: 'io',
    definition: 'Returns the mouse movement delta since last event.',
    syntax: 'int deltaX = m.dx();',
    platforms: ['both'],
    relatedTerms: ['Mouse', 'x', 'y'],
  },
  {
    term: 'button()',
    category: 'io',
    definition: 'Returns the mouse button code (0=left, 1=middle, 2=right).',
    syntax: 'int btn = m.button();',
    platforms: ['both'],
    relatedTerms: ['Mouse', 'left', 'right'],
  },
  {
    term: 'left()',
    category: 'io',
    definition: 'Returns true if the left mouse button is pressed.',
    syntax: 'if (m.left()) { ... }',
    platforms: ['both'],
    relatedTerms: ['Mouse', 'right', 'middle'],
  },
  {
    term: 'right()',
    category: 'io',
    definition: 'Returns true if the right mouse button is pressed.',
    syntax: 'if (m.right()) { ... }',
    platforms: ['both'],
    relatedTerms: ['Mouse', 'left'],
  },
  // --- Window & Network ---
  {
    term: 'Window',
    category: 'io',
    definition: 'Window creation and management (GLFW wrapper on native).',
    platforms: ['native'],
    webAlternative: 'Canvas element is managed automatically',
    relatedTerms: ['dimensions'],
  },
  {
    term: 'osc::Send',
    category: 'io',
    definition: 'Sends OSC (Open Sound Control) messages over UDP.',
    syntax: 'osc::Send sender(port, address);',
    platforms: ['native'],
    webAlternative: 'WebOSC',
    relatedTerms: ['osc::Recv', 'WebOSC'],
  },
  {
    term: 'osc::Recv',
    category: 'io',
    definition: 'Receives OSC messages.',
    syntax: 'osc::Recv receiver(port);',
    platforms: ['native'],
    webAlternative: 'WebOSC',
    relatedTerms: ['osc::Send', 'WebOSC'],
  },
  {
    term: 'MIDIIn',
    category: 'io',
    definition: 'Receives MIDI messages from MIDI devices.',
    platforms: ['native'],
    webAlternative: 'WebMIDI',
    relatedTerms: ['MIDIOut', 'WebMIDI'],
  },
  {
    term: 'MIDIOut',
    category: 'io',
    definition: 'Sends MIDI messages to MIDI devices.',
    platforms: ['native'],
    webAlternative: 'WebMIDI',
    relatedTerms: ['MIDIIn', 'WebMIDI'],
  },

  // ============================================================================
  // TYPES
  // ============================================================================
  {
    term: 'Color',
    category: 'types',
    definition: 'RGBA color with float components (0.0 to 1.0).',
    syntax: 'Color c(r, g, b, a);',
    example: `Color red(1, 0, 0);
Color white(1);
Color semiTransparent(1, 1, 1, 0.5);`,
    platforms: ['both'],
    relatedTerms: ['HSV', 'RGB', 'Colori'],
  },
  {
    term: 'HSV',
    category: 'types',
    definition: 'Hue-Saturation-Value color representation.',
    syntax: 'HSV hsv(h, s, v);  // All values 0-1',
    example: `HSV hsv(0.5, 1, 1);  // Cyan
Color c(hsv);         // Convert to RGB`,
    platforms: ['both'],
    relatedTerms: ['Color', 'RGB'],
  },
  {
    term: 'RGB',
    category: 'types',
    definition: 'RGB color without alpha channel.',
    syntax: 'RGB rgb(r, g, b);',
    platforms: ['both'],
    relatedTerms: ['Color', 'HSV'],
  },
  {
    term: 'Colori',
    category: 'types',
    definition: 'RGBA color with 8-bit integer components (0-255).',
    syntax: 'Colori c(r, g, b, a);',
    platforms: ['both'],
    relatedTerms: ['Color'],
  },
  {
    term: 'Parameter',
    category: 'types',
    definition: 'Thread-safe parameter with range and callbacks. Used for GUI and OSC control.',
    syntax: 'Parameter param{"name", "group", default, min, max};',
    example: `Parameter freq{"frequency", "", 440, 20, 20000};
freq.registerChangeCallback([](float v) {
  // Called when value changes
});`,
    platforms: ['native'],
    relatedTerms: ['ParameterServer'],
  },

  // ============================================================================
  // WEB-SPECIFIC
  // ============================================================================
  {
    term: 'WebSamplePlayer',
    category: 'web',
    definition: 'Web alternative to SoundFile. Loads and plays audio samples using Web Audio API.',
    syntax: 'WebSamplePlayer player;',
    platforms: ['web'],
    relatedTerms: ['SoundFile'],
  },
  {
    term: 'WebMIDI',
    category: 'web',
    definition: 'Web alternative to MIDIIn/MIDIOut. Uses Web MIDI API for MIDI communication.',
    syntax: 'WebMIDI midi;',
    platforms: ['web'],
    relatedTerms: ['MIDIIn', 'MIDIOut'],
  },
  {
    term: 'WebOSC',
    category: 'web',
    definition: 'Web alternative to osc::Send/Recv. Uses WebSocket for OSC-like communication.',
    syntax: 'WebOSC osc;',
    platforms: ['web'],
    relatedTerms: ['osc::Send', 'osc::Recv'],
  },
  {
    term: 'WebFile',
    category: 'web',
    definition: 'Web alternative to file I/O. Uses browser storage and fetch API.',
    platforms: ['web'],
    relatedTerms: ['File'],
  },
  {
    term: 'WebImage',
    category: 'web',
    definition: 'Web alternative for image loading. Uses browser image APIs.',
    platforms: ['web'],
    relatedTerms: ['Image'],
  },
  {
    term: 'WebFont',
    category: 'web',
    definition: 'Web alternative for font rendering. Uses Canvas 2D text rendering.',
    platforms: ['web'],
  },
  {
    term: 'al_compat.hpp',
    category: 'web',
    definition: 'Compatibility header that allows code to compile on both native and web platforms.',
    syntax: '#include "al_compat.hpp"',
    example: `#include "al_compat.hpp"

class MyApp : public al::App { ... };
ALLOLIB_MAIN(MyApp)  // Works on both platforms`,
    platforms: ['both'],
    relatedTerms: ['ALLOLIB_MAIN', 'isWASM'],
  },
  {
    term: 'isWASM()',
    category: 'web',
    definition: 'Returns true if running in WebAssembly (browser).',
    syntax: 'if (al::isWASM()) { ... }',
    platforms: ['both'],
    relatedTerms: ['isDesktop', 'al_compat.hpp'],
  },
  {
    term: 'isDesktop()',
    category: 'web',
    definition: 'Returns true if running as native desktop application.',
    syntax: 'if (al::isDesktop()) { ... }',
    platforms: ['both'],
    relatedTerms: ['isWASM', 'al_compat.hpp'],
  },

  // ============================================================================
  // GAMMA DSP - OSCILLATORS
  // ============================================================================
  {
    term: 'gam::Sine',
    category: 'gamma',
    definition: 'Computed sine wave oscillator using polynomial approximation. Efficient for real-time synthesis.',
    syntax: 'gam::Sine<> osc(440);',
    example: `gam::Sine<> osc(440);  // 440 Hz sine
float sample = osc();     // Generate next sample`,
    platforms: ['both'],
    relatedTerms: ['gam::SineR', 'gam::CSine', 'gam::Osc'],
  },
  {
    term: 'gam::SineR',
    category: 'gamma',
    definition: 'Sine oscillator based on efficient recursion equation. Very fast but frequency changes cause discontinuities.',
    syntax: 'gam::SineR<> osc;',
    platforms: ['both'],
    relatedTerms: ['gam::Sine', 'gam::SineD'],
  },
  {
    term: 'gam::SineD',
    category: 'gamma',
    definition: 'Damped sine oscillator using recursion. Produces exponentially decaying sinusoid.',
    syntax: 'gam::SineD<> osc;',
    example: `gam::SineD<> osc;
osc.freq(440);
osc.decay(0.99);  // Decay rate`,
    platforms: ['both'],
    relatedTerms: ['gam::SineR', 'gam::Chirplet'],
  },
  {
    term: 'gam::CSine',
    category: 'gamma',
    definition: 'Complex sinusoid oscillator producing both sine and cosine outputs. Useful for modulation.',
    syntax: 'gam::CSine<> osc;',
    platforms: ['both'],
    relatedTerms: ['gam::Sine'],
  },
  {
    term: 'gam::Osc',
    category: 'gamma',
    definition: 'Tabulated function oscillator (wavetable). Can hold any periodic waveform.',
    syntax: 'gam::Osc<> osc;',
    example: `gam::Osc<> osc;
osc.addSine(1);      // Add fundamental
osc.addSine(2, 0.5); // Add 2nd harmonic
osc.freq(440);`,
    platforms: ['both'],
    relatedTerms: ['gam::Sine', 'gam::LFO'],
  },
  {
    term: 'gam::LFO',
    category: 'gamma',
    definition: 'Low-frequency oscillator with multiple waveform shapes: sine, square, triangle, saw up/down, pulse.',
    syntax: 'gam::LFO<> lfo(0.5);',
    example: `gam::LFO<> lfo(2);  // 2 Hz
float sine = lfo.cos();
float square = lfo.sqr();
float tri = lfo.tri();`,
    platforms: ['both'],
    relatedTerms: ['gam::DWO', 'gam::Osc'],
  },
  {
    term: 'gam::DWO',
    category: 'gamma',
    definition: 'Differenced wave oscillator providing aliasing reduction for classic waveforms.',
    syntax: 'gam::DWO<> osc;',
    platforms: ['both'],
    relatedTerms: ['gam::LFO', 'gam::Buzz'],
  },
  {
    term: 'gam::Buzz',
    category: 'gamma',
    definition: 'Band-limited impulse train (sum of cosines). Can produce band-limited saw and square waves.',
    syntax: 'gam::Buzz<> osc;',
    example: `gam::Buzz<> osc(440);
osc.harmonics(10);
float saw = osc.saw();
float square = osc.square();`,
    platforms: ['both'],
    relatedTerms: ['gam::Impulse', 'gam::Saw', 'gam::Square'],
  },
  {
    term: 'gam::Saw',
    category: 'gamma',
    definition: 'Band-limited sawtooth wave oscillator. Reduces aliasing artifacts.',
    syntax: 'gam::Saw<> osc(440);',
    platforms: ['both'],
    relatedTerms: ['gam::Square', 'gam::Buzz'],
  },
  {
    term: 'gam::Square',
    category: 'gamma',
    definition: 'Band-limited square wave oscillator.',
    syntax: 'gam::Square<> osc(440);',
    platforms: ['both'],
    relatedTerms: ['gam::Saw', 'gam::Buzz'],
  },
  {
    term: 'gam::DSF',
    category: 'gamma',
    definition: 'Discrete summation formula oscillator. Efficient generation of harmonic spectra.',
    syntax: 'gam::DSF<> osc;',
    platforms: ['both'],
    relatedTerms: ['gam::Buzz'],
  },
  {
    term: 'gam::Accum',
    category: 'gamma',
    definition: 'Fixed-point phase accumulator. Base class for many oscillators.',
    syntax: 'gam::Accum<> acc;',
    platforms: ['both'],
    relatedTerms: ['gam::Sweep'],
  },
  {
    term: 'gam::Sweep',
    category: 'gamma',
    definition: 'Linear sweep generating ramp in [0,1). Useful for phase and envelope generation.',
    syntax: 'gam::Sweep<> sweep(1);  // 1 Hz',
    platforms: ['both'],
    relatedTerms: ['gam::Accum'],
  },
  {
    term: 'gam::Chirplet',
    category: 'gamma',
    definition: 'Swept sinusoid with Gaussian envelope. Produces chirp/grain sound.',
    syntax: 'gam::Chirplet<> chirp;',
    platforms: ['both'],
    relatedTerms: ['gam::SineD'],
  },

  // ============================================================================
  // GAMMA DSP - ENVELOPES
  // ============================================================================
  {
    term: 'gam::Env',
    category: 'gamma',
    definition: 'Multi-segment envelope with exponential curves. Template parameter sets number of segments.',
    syntax: 'gam::Env<3> env;  // 3-segment envelope',
    example: `gam::Env<3> env;
env.lengths(0.1, 0.2, 0.5);  // Attack, decay, release
env.levels(0, 1, 0.5, 0);    // Start, peak, sustain, end`,
    platforms: ['both'],
    relatedTerms: ['gam::ADSR', 'gam::AD', 'gam::Seg'],
  },
  {
    term: 'gam::ADSR',
    category: 'gamma',
    definition: 'Attack-Decay-Sustain-Release envelope. Standard synthesizer envelope.',
    syntax: 'gam::ADSR<> env;',
    example: `gam::ADSR<> env;
env.attack(0.01);   // 10ms attack
env.decay(0.1);     // 100ms decay
env.sustain(0.7);   // 70% sustain level
env.release(0.5);   // 500ms release`,
    platforms: ['both'],
    relatedTerms: ['gam::AD', 'gam::Env'],
  },
  {
    term: 'gam::AD',
    category: 'gamma',
    definition: 'Attack-Decay envelope (2-segment). Simple envelope for percussive sounds.',
    syntax: 'gam::AD<> env(0.01, 0.5);  // 10ms attack, 500ms decay',
    platforms: ['both'],
    relatedTerms: ['gam::ADSR', 'gam::Decay'],
  },
  {
    term: 'gam::Decay',
    category: 'gamma',
    definition: 'Exponentially decaying envelope. Single-stage decay from 1 to 0.',
    syntax: 'gam::Decay<> env(1);  // 1 second decay',
    platforms: ['both'],
    relatedTerms: ['gam::AD'],
  },
  {
    term: 'gam::Seg',
    category: 'gamma',
    definition: 'Single interpolation envelope segment. Building block for custom envelopes.',
    syntax: 'gam::Seg<> seg;',
    platforms: ['both'],
    relatedTerms: ['gam::SegExp', 'gam::Env'],
  },
  {
    term: 'gam::SegExp',
    category: 'gamma',
    definition: 'Exponential envelope segment. Provides smooth parameter changes.',
    syntax: 'gam::SegExp<> seg;',
    platforms: ['both'],
    relatedTerms: ['gam::Seg'],
  },
  {
    term: 'gam::Curve',
    category: 'gamma',
    definition: 'Exponential curve with variable curvature. Can be linear, exponential, or logarithmic.',
    syntax: 'gam::Curve<> curve;',
    platforms: ['both'],
    relatedTerms: ['gam::Env'],
  },
  {
    term: 'gam::Gate',
    category: 'gamma',
    definition: 'Binary gate controlled by threshold comparison. Outputs 0 or 1.',
    syntax: 'gam::Gate<> gate;',
    platforms: ['both'],
    relatedTerms: ['gam::Env'],
  },

  // ============================================================================
  // GAMMA DSP - FILTERS
  // ============================================================================
  {
    term: 'gam::Biquad',
    category: 'gamma',
    definition: '2-pole/2-zero IIR filter using RBJ cookbook formulas. Supports LP, HP, BP, notch, peaking, shelf.',
    syntax: 'gam::Biquad<> filt;',
    example: `gam::Biquad<> lpf;
lpf.type(gam::LOW_PASS);
lpf.freq(1000);
lpf.res(2);  // Resonance
float out = lpf(input);`,
    platforms: ['both'],
    relatedTerms: ['gam::OnePole', 'gam::Reson', 'gam::Notch'],
  },
  {
    term: 'gam::OnePole',
    category: 'gamma',
    definition: 'One-pole filter (6 dB/octave). Simple lowpass or highpass smoothing filter.',
    syntax: 'gam::OnePole<> filt;',
    example: `gam::OnePole<> lpf;
lpf.freq(1000);
lpf.type(gam::LOW_PASS);`,
    platforms: ['both'],
    relatedTerms: ['gam::Biquad', 'gam::Integrator'],
  },
  {
    term: 'gam::Reson',
    category: 'gamma',
    definition: 'Two-pole resonator filter. Creates resonant peak at specified frequency.',
    syntax: 'gam::Reson<> res;',
    platforms: ['both'],
    relatedTerms: ['gam::Biquad', 'gam::Notch'],
  },
  {
    term: 'gam::Notch',
    category: 'gamma',
    definition: 'Two-zero notch filter. Creates a dip at specified frequency.',
    syntax: 'gam::Notch<> notch(1000, 100);  // Center freq, width',
    platforms: ['both'],
    relatedTerms: ['gam::Reson', 'gam::Biquad'],
  },
  {
    term: 'gam::AllPass1',
    category: 'gamma',
    definition: 'First-order allpass filter. Changes phase without affecting magnitude.',
    syntax: 'gam::AllPass1<> ap;',
    platforms: ['both'],
    relatedTerms: ['gam::AllPass2', 'gam::Hilbert'],
  },
  {
    term: 'gam::AllPass2',
    category: 'gamma',
    definition: 'Second-order allpass filter.',
    syntax: 'gam::AllPass2<> ap;',
    platforms: ['both'],
    relatedTerms: ['gam::AllPass1'],
  },
  {
    term: 'gam::Hilbert',
    category: 'gamma',
    definition: 'Hilbert transform filter. Converts real signal to analytic signal (complex).',
    syntax: 'gam::Hilbert<> hilb;',
    platforms: ['both'],
    relatedTerms: ['gam::FreqShift'],
  },
  {
    term: 'gam::BlockDC',
    category: 'gamma',
    definition: 'DC blocker filter. Removes DC offset from signal.',
    syntax: 'gam::BlockDC<> dc;',
    platforms: ['both'],
    relatedTerms: ['gam::BlockNyq'],
  },
  {
    term: 'gam::BlockNyq',
    category: 'gamma',
    definition: 'Nyquist frequency blocker. Removes frequencies near Nyquist.',
    syntax: 'gam::BlockNyq<> nyq;',
    platforms: ['both'],
    relatedTerms: ['gam::BlockDC'],
  },
  {
    term: 'gam::Integrator',
    category: 'gamma',
    definition: 'Leaky integrator filter. Accumulates input with decay.',
    syntax: 'gam::Integrator<> integ;',
    platforms: ['both'],
    relatedTerms: ['gam::Differencer', 'gam::OnePole'],
  },
  {
    term: 'gam::Differencer',
    category: 'gamma',
    definition: 'Differencing filter with zero at DC. Computes difference between consecutive samples.',
    syntax: 'gam::Differencer<> diff;',
    platforms: ['both'],
    relatedTerms: ['gam::Integrator'],
  },
  {
    term: 'gam::MovingAvg',
    category: 'gamma',
    definition: 'Moving average filter. Simple FIR lowpass.',
    syntax: 'gam::MovingAvg<> avg;',
    platforms: ['both'],
    relatedTerms: ['gam::OnePole'],
  },

  // ============================================================================
  // GAMMA DSP - NOISE GENERATORS
  // ============================================================================
  {
    term: 'gam::NoiseWhite',
    category: 'gamma',
    definition: 'White noise generator. Uniform spectral density.',
    syntax: 'gam::NoiseWhite<> noise;',
    example: 'float sample = noise();',
    platforms: ['both'],
    relatedTerms: ['gam::NoisePink', 'gam::NoiseBrown'],
  },
  {
    term: 'gam::NoisePink',
    category: 'gamma',
    definition: 'Pink noise generator. 1/f spectrum (-3 dB/octave).',
    syntax: 'gam::NoisePink<> noise;',
    platforms: ['both'],
    relatedTerms: ['gam::NoiseWhite', 'gam::NoiseBrown'],
  },
  {
    term: 'gam::NoiseBrown',
    category: 'gamma',
    definition: 'Brown (red) noise generator. 1/f² spectrum (-6 dB/octave).',
    syntax: 'gam::NoiseBrown<> noise;',
    platforms: ['both'],
    relatedTerms: ['gam::NoisePink', 'gam::NoiseViolet'],
  },
  {
    term: 'gam::NoiseViolet',
    category: 'gamma',
    definition: 'Violet noise generator. f² spectrum (+6 dB/octave).',
    syntax: 'gam::NoiseViolet<> noise;',
    platforms: ['both'],
    relatedTerms: ['gam::NoiseBrown'],
  },

  // ============================================================================
  // GAMMA DSP - EFFECTS
  // ============================================================================
  {
    term: 'gam::Delay',
    category: 'gamma',
    definition: 'Variable length delay line with interpolation.',
    syntax: 'gam::Delay<> delay(maxDelay);',
    example: `gam::Delay<> delay(1);  // 1 second max
delay.delay(0.25);       // 250ms delay
float out = delay(input);`,
    platforms: ['both'],
    relatedTerms: ['gam::Comb', 'gam::Multitap'],
  },
  {
    term: 'gam::Comb',
    category: 'gamma',
    definition: 'Comb filter with feedback and feedforward. Creates resonant/flanging effects.',
    syntax: 'gam::Comb<> comb(maxDelay);',
    example: `gam::Comb<> comb(0.1);
comb.delay(0.01);
comb.fbk(0.7);   // Feedback
comb.ffd(0.5);   // Feedforward`,
    platforms: ['both'],
    relatedTerms: ['gam::Delay', 'gam::Echo'],
  },
  {
    term: 'gam::Multitap',
    category: 'gamma',
    definition: 'Delay line with multiple read taps. For multi-tap delay effects.',
    syntax: 'gam::Multitap<4> delay;  // 4 taps',
    platforms: ['both'],
    relatedTerms: ['gam::Delay'],
  },
  {
    term: 'gam::Echo',
    category: 'gamma',
    definition: 'Recursive echo with loop filter. Creates decaying repeats.',
    syntax: 'gam::Echo<> echo(maxDelay);',
    platforms: ['both'],
    relatedTerms: ['gam::Comb', 'gam::ReverbMS'],
  },
  {
    term: 'gam::Chorus',
    category: 'gamma',
    definition: 'Dual delay-line chorus with quadrature sinusoidal modulation.',
    syntax: 'gam::Chorus<> chorus;',
    platforms: ['both'],
    relatedTerms: ['gam::Delay'],
  },
  {
    term: 'gam::ReverbMS',
    category: 'gamma',
    definition: 'Schroeder reverberator using comb and allpass filters (Manfred Schroeder algorithm).',
    syntax: 'gam::ReverbMS<> reverb;',
    example: `gam::ReverbMS<> reverb;
reverb.decay(0.8);
reverb.damping(0.5);`,
    platforms: ['both'],
    relatedTerms: ['gam::Echo', 'gam::Comb'],
  },
  {
    term: 'gam::Pan',
    category: 'gamma',
    definition: 'Equal-power stereo panner.',
    syntax: 'gam::Pan<> pan;',
    example: `gam::Pan<> pan;
pan.pos(-0.5);  // Pan left
float left, right;
pan(input, left, right);`,
    platforms: ['both'],
    relatedTerms: ['gam::Dist'],
  },
  {
    term: 'gam::FreqShift',
    category: 'gamma',
    definition: 'Frequency shifter using single-sideband modulation.',
    syntax: 'gam::FreqShift<> shift;',
    platforms: ['both'],
    relatedTerms: ['gam::Hilbert', 'gam::AM'],
  },
  {
    term: 'gam::AM',
    category: 'gamma',
    definition: 'Amplitude modulator. Ring modulation effect.',
    syntax: 'gam::AM<> am;',
    platforms: ['both'],
    relatedTerms: ['gam::FreqShift'],
  },
  {
    term: 'gam::Quantizer',
    category: 'gamma',
    definition: 'Bitcrusher effect. Reduces sample rate and bit depth.',
    syntax: 'gam::Quantizer<> quant;',
    platforms: ['both'],
    relatedTerms: ['gam::Burst'],
  },
  {
    term: 'gam::Burst',
    category: 'gamma',
    definition: 'Percussive noise burst with resonant filter and envelope.',
    syntax: 'gam::Burst<> burst;',
    platforms: ['both'],
    relatedTerms: ['gam::Pluck', 'gam::NoiseWhite'],
  },
  {
    term: 'gam::Pluck',
    category: 'gamma',
    definition: 'Karplus-Strong plucked string model. Source-filter synthesis.',
    syntax: 'gam::Pluck<> pluck(maxDelay);',
    example: `gam::Pluck<> pluck(1./50.);  // Min 50 Hz
pluck.freq(440);
pluck.reset();  // Trigger pluck`,
    platforms: ['both'],
    relatedTerms: ['gam::Burst', 'gam::Comb'],
  },
  {
    term: 'gam::Chirp',
    category: 'gamma',
    definition: 'Sine wave with frequency/amplitude driven by envelope. Creates chirp sounds.',
    syntax: 'gam::Chirp<> chirp;',
    platforms: ['both'],
    relatedTerms: ['gam::Chirplet'],
  },
  {
    term: 'gam::MonoSynth',
    category: 'gamma',
    definition: 'Saw oscillator with sweepable filter. Simple monophonic synthesizer.',
    syntax: 'gam::MonoSynth<> synth;',
    platforms: ['both'],
    relatedTerms: ['gam::Saw', 'gam::Biquad'],
  },

  // ============================================================================
  // GAMMA DSP - SPECTRAL / FFT
  // ============================================================================
  {
    term: 'gam::DFT',
    category: 'gamma',
    definition: 'Discrete Fourier Transform. Converts time-domain to frequency-domain.',
    syntax: 'gam::DFT<> dft(size);',
    platforms: ['both'],
    relatedTerms: ['gam::STFT', 'gam::SlidingDFT'],
  },
  {
    term: 'gam::STFT',
    category: 'gamma',
    definition: 'Short-time Fourier Transform. Windowed DFT for spectral analysis.',
    syntax: 'gam::STFT<> stft(windowSize, hopSize);',
    platforms: ['both'],
    relatedTerms: ['gam::DFT'],
  },
  {
    term: 'gam::SlidingDFT',
    category: 'gamma',
    definition: 'Sliding DFT with hop size of 1. Efficient for real-time spectral tracking.',
    syntax: 'gam::SlidingDFT<> sdft(size);',
    platforms: ['both'],
    relatedTerms: ['gam::DFT'],
  },
  {
    term: 'gam::SlidingWindow',
    category: 'gamma',
    definition: 'Sliding window buffer for overlap-add processing.',
    syntax: 'gam::SlidingWindow<> win(windowSize, hopSize);',
    platforms: ['both'],
    relatedTerms: ['gam::STFT'],
  },

  // ============================================================================
  // GAMMA DSP - SAMPLE PLAYBACK
  // ============================================================================
  {
    term: 'gam::SamplePlayer',
    category: 'gamma',
    definition: 'Sample buffer player with interpolation. Plays loaded audio samples.',
    syntax: 'gam::SamplePlayer<> player;',
    example: `gam::SamplePlayer<> player;
player.load("sound.wav");
player.rate(1);  // Playback rate
float out = player();`,
    platforms: ['both'],
    relatedTerms: ['SoundFile'],
  },

  // ============================================================================
  // GAMMA DSP - SPATIAL
  // ============================================================================
  {
    term: 'gam::Dist',
    category: 'gamma',
    definition: 'Spatial distribution effect. Distance-based attenuation, delay, and damping.',
    syntax: 'gam::Dist<> dist;',
    platforms: ['both'],
    relatedTerms: ['gam::Pan', 'gam::Echo'],
  },

  // ============================================================================
  // GRAPHICS - FRAMEBUFFERS & ADVANCED
  // ============================================================================
  {
    term: 'EasyFBO',
    category: 'graphics',
    definition: 'Simplified framebuffer object wrapper with color and depth attachments. For render-to-texture.',
    syntax: 'EasyFBO fbo;',
    example: `EasyFBO fbo;
fbo.init(800, 600);
g.pushFramebuffer(fbo);
// render scene
g.popFramebuffer();
fbo.tex().bind(0);  // Use as texture`,
    platforms: ['both'],
    relatedTerms: ['FBO', 'Texture'],
  },
  {
    term: 'RBO',
    category: 'graphics',
    definition: 'Render Buffer Object. GPU storage for offscreen rendering, not accessible as texture.',
    syntax: 'RBO rbo;',
    platforms: ['both'],
    relatedTerms: ['FBO', 'EasyFBO'],
  },
  {
    term: 'VAOMesh',
    category: 'graphics',
    definition: 'Mesh class with GPU-side VAO storage. More efficient for static geometry.',
    syntax: 'VAOMesh mesh;',
    platforms: ['both'],
    relatedTerms: ['Mesh', 'VAO', 'EasyVAO'],
  },
  {
    term: 'EasyVAO',
    category: 'graphics',
    definition: 'High-level VAO wrapper with automatic mesh attribute handling.',
    syntax: 'EasyVAO vao;',
    platforms: ['both'],
    relatedTerms: ['VAO', 'VAOMesh'],
  },
  {
    term: 'BufferObject',
    category: 'graphics',
    definition: 'GPU vertex/pixel buffer object (VBO/PBO). Low-level buffer management.',
    syntax: 'BufferObject buffer;',
    platforms: ['both'],
    relatedTerms: ['VAO', 'VBO'],
  },
  {
    term: 'Material',
    category: 'graphics',
    definition: 'Surface material properties for lighting: ambient, diffuse, specular colors, and shininess.',
    syntax: 'Material mat;',
    example: `Material mat;
mat.ambient(Color(0.2, 0.2, 0.2));
mat.diffuse(Color(0.8, 0.8, 0.8));
mat.specular(Color(1, 1, 1));
mat.shininess(50);
g.material(mat);`,
    platforms: ['both'],
    relatedTerms: ['Light', 'lighting'],
  },
  {
    term: 'Font',
    category: 'graphics',
    definition: 'Font loading and text rendering using signed distance field fonts.',
    syntax: 'Font font;',
    platforms: ['native'],
    webAlternative: 'WebFont',
    relatedTerms: ['FontRenderer'],
  },
  {
    term: 'FontRenderer',
    category: 'graphics',
    definition: 'Convenience class for rendering text with a font.',
    syntax: 'FontRenderer fr;',
    platforms: ['native'],
    relatedTerms: ['Font'],
  },
  {
    term: 'Image',
    category: 'graphics',
    definition: 'Image loading and saving (PNG, JPG, etc.).',
    syntax: 'Image img;',
    example: `Image img;
img.load("image.png");
texture.create2D(img.width(), img.height());
texture.submit(img.pixels());`,
    platforms: ['native'],
    webAlternative: 'WebImage',
    relatedTerms: ['Texture'],
  },
  {
    term: 'Isosurface',
    category: 'graphics',
    definition: 'Marching cubes isosurface extraction from scalar field data.',
    syntax: 'Isosurface iso;',
    platforms: ['native'],
    relatedTerms: ['Mesh'],
  },
  {
    term: 'addTetrahedron()',
    category: 'graphics',
    definition: 'Adds a tetrahedron (4-faced polyhedron) to a mesh.',
    syntax: 'addTetrahedron(mesh, radius);',
    platforms: ['both'],
    relatedTerms: ['addOctahedron', 'addDodecahedron'],
  },
  {
    term: 'addOctahedron()',
    category: 'graphics',
    definition: 'Adds an octahedron (8-faced polyhedron) to a mesh.',
    syntax: 'addOctahedron(mesh, radius);',
    platforms: ['both'],
    relatedTerms: ['addTetrahedron', 'addIcosahedron'],
  },
  {
    term: 'addDodecahedron()',
    category: 'graphics',
    definition: 'Adds a dodecahedron (12-faced polyhedron) to a mesh.',
    syntax: 'addDodecahedron(mesh, radius);',
    platforms: ['both'],
    relatedTerms: ['addIcosahedron'],
  },
  {
    term: 'addIcosahedron()',
    category: 'graphics',
    definition: 'Adds an icosahedron (20-faced polyhedron) to a mesh.',
    syntax: 'addIcosahedron(mesh, radius);',
    platforms: ['both'],
    relatedTerms: ['addIcosphere', 'addDodecahedron'],
  },
  {
    term: 'addAnnulus()',
    category: 'graphics',
    definition: 'Adds an annulus (ring/washer shape) to a mesh.',
    syntax: 'addAnnulus(mesh, innerRadius, outerRadius, slices);',
    platforms: ['both'],
    relatedTerms: ['addDisc', 'addTorus'],
  },
  {
    term: 'addPrism()',
    category: 'graphics',
    definition: 'Adds a prism to a mesh.',
    syntax: 'addPrism(mesh, ...);',
    platforms: ['both'],
    relatedTerms: ['addCylinder'],
  },
  {
    term: 'addSurface()',
    category: 'graphics',
    definition: 'Adds a tessellated surface to a mesh from a 2D function.',
    syntax: 'addSurface(mesh, Nx, Ny);',
    platforms: ['both'],
    relatedTerms: ['Mesh'],
  },
  {
    term: 'addRect()',
    category: 'graphics',
    definition: 'Adds a rectangle to a mesh.',
    syntax: 'addRect(mesh, x, y, width, height);',
    platforms: ['both'],
    relatedTerms: ['addQuad'],
  },
  {
    term: 'addQuad()',
    category: 'graphics',
    definition: 'Adds a quad (4 vertices) to a mesh.',
    syntax: 'addQuad(mesh, ...);',
    platforms: ['both'],
    relatedTerms: ['addRect'],
  },
  {
    term: 'polygonFill()',
    category: 'graphics',
    definition: 'Sets polygon rendering to filled mode.',
    syntax: 'g.polygonFill();',
    platforms: ['both'],
    relatedTerms: ['polygonLine', 'polygonMode'],
  },
  {
    term: 'polygonLine()',
    category: 'graphics',
    definition: 'Sets polygon rendering to wireframe mode.',
    syntax: 'g.polygonLine();',
    platforms: ['both'],
    relatedTerms: ['polygonFill'],
  },
  {
    term: 'texture()',
    category: 'graphics',
    definition: 'Enables texture rendering mode. Use after binding a texture.',
    syntax: 'g.texture();',
    platforms: ['both'],
    relatedTerms: ['Texture', 'tint', 'color'],
  },
  {
    term: 'tint()',
    category: 'graphics',
    definition: 'Sets coloring mode that multiplies texture color by a tint.',
    syntax: 'g.tint(r, g, b, a);',
    platforms: ['both'],
    relatedTerms: ['color', 'texture'],
  },
  {
    term: 'material()',
    category: 'graphics',
    definition: 'Sets the current material for lighting calculations.',
    syntax: 'g.material(mat);',
    platforms: ['both'],
    relatedTerms: ['Material', 'lighting'],
  },
  {
    term: 'blendMult()',
    category: 'graphics',
    definition: 'Sets multiplicative blending mode (colors multiply together).',
    syntax: 'g.blendMult();',
    platforms: ['both'],
    relatedTerms: ['blendAdd', 'blendTrans', 'blendScreen'],
  },
  {
    term: 'blendScreen()',
    category: 'graphics',
    definition: 'Sets screen blending mode (inverse multiply).',
    syntax: 'g.blendScreen();',
    platforms: ['both'],
    relatedTerms: ['blendMult', 'blendAdd'],
  },
  {
    term: 'cullFace()',
    category: 'graphics',
    definition: 'Enables face culling and sets which face to cull (front or back).',
    syntax: 'g.cullFace(true);  // or g.cullFace(GL_BACK);',
    platforms: ['both'],
    relatedTerms: ['culling'],
  },
  {
    term: 'viewport()',
    category: 'graphics',
    definition: 'Sets the viewport dimensions for rendering.',
    syntax: 'g.viewport(x, y, width, height);',
    platforms: ['both'],
    relatedTerms: ['Viewport', 'pushViewport'],
  },
  {
    term: 'pushViewport()',
    category: 'graphics',
    definition: 'Saves current viewport to stack.',
    syntax: 'g.pushViewport(w, h);',
    platforms: ['both'],
    relatedTerms: ['popViewport', 'viewport'],
  },
  {
    term: 'popViewport()',
    category: 'graphics',
    definition: 'Restores viewport from stack.',
    syntax: 'g.popViewport();',
    platforms: ['both'],
    relatedTerms: ['pushViewport'],
  },
  {
    term: 'pushFramebuffer()',
    category: 'graphics',
    definition: 'Saves current framebuffer and switches to a new one.',
    syntax: 'g.pushFramebuffer(fbo);',
    platforms: ['both'],
    relatedTerms: ['popFramebuffer', 'EasyFBO'],
  },
  {
    term: 'popFramebuffer()',
    category: 'graphics',
    definition: 'Restores previous framebuffer from stack.',
    syntax: 'g.popFramebuffer();',
    platforms: ['both'],
    relatedTerms: ['pushFramebuffer'],
  },
  {
    term: 'pushCamera()',
    category: 'graphics',
    definition: 'Saves current camera matrices and sets new view/projection.',
    syntax: 'g.pushCamera(viewpoint);',
    platforms: ['both'],
    relatedTerms: ['popCamera', 'camera'],
  },
  {
    term: 'popCamera()',
    category: 'graphics',
    definition: 'Restores camera matrices from stack.',
    syntax: 'g.popCamera();',
    platforms: ['both'],
    relatedTerms: ['pushCamera'],
  },
  {
    term: 'modelMatrix()',
    category: 'graphics',
    definition: 'Gets or sets the current model matrix.',
    syntax: 'Mat4f m = g.modelMatrix();',
    platforms: ['both'],
    relatedTerms: ['viewMatrix', 'projMatrix'],
  },
  {
    term: 'viewMatrix()',
    category: 'graphics',
    definition: 'Gets or sets the current view matrix.',
    syntax: 'Mat4f m = g.viewMatrix();',
    platforms: ['both'],
    relatedTerms: ['modelMatrix', 'projMatrix'],
  },
  {
    term: 'projMatrix()',
    category: 'graphics',
    definition: 'Gets or sets the current projection matrix.',
    syntax: 'Mat4f m = g.projMatrix();',
    platforms: ['both'],
    relatedTerms: ['modelMatrix', 'viewMatrix'],
  },
  {
    term: 'shader()',
    category: 'graphics',
    definition: 'Sets the current shader program for rendering.',
    syntax: 'g.shader(shaderProgram);',
    platforms: ['both'],
    relatedTerms: ['ShaderProgram'],
  },

  // ============================================================================
  // MATH - ADVANCED CLASSES
  // ============================================================================
  {
    term: 'Complex',
    category: 'math',
    definition: 'Complex number with real and imaginary components.',
    syntax: 'Complex<float> c(real, imag);',
    example: `Complexf c(1, 2);  // 1 + 2i
float mag = c.norm();
float phase = c.arg();`,
    platforms: ['both'],
    relatedTerms: ['Polar', 'Quatd'],
  },
  {
    term: 'Polar',
    category: 'math',
    definition: 'Number in polar form (magnitude and phase).',
    syntax: 'Polar<float> p(mag, phase);',
    platforms: ['both'],
    relatedTerms: ['Complex'],
  },
  {
    term: 'Frustum',
    category: 'math',
    definition: 'View frustum for culling tests. Can test points, spheres, and boxes.',
    syntax: 'Frustum<double> frust;',
    example: `Frustumd frust;
frust.computePlanes(viewMatrix, projMatrix);
if (frust.testSphere(center, radius) != OUTSIDE) {
  // Object is visible
}`,
    platforms: ['both'],
    relatedTerms: ['Lens', 'Viewpoint'],
  },
  {
    term: 'Ray',
    category: 'math',
    definition: 'Ray with origin and direction for ray casting and intersection tests.',
    syntax: 'Ray<float> ray(origin, direction);',
    example: `Rayf ray(origin, dir);
float t;
if (ray.intersectSphere(center, radius, t)) {
  Vec3f hitPoint = ray(t);
}`,
    platforms: ['both'],
    relatedTerms: ['Vec3f'],
  },
  {
    term: 'Matrix4',
    category: 'math',
    definition: 'Specialized 4x4 matrix for graphics transformations with factory methods.',
    syntax: 'Matrix4f mat;',
    example: `Matrix4f view = Matrix4f::lookAt(eye, target, up);
Matrix4f proj = Matrix4f::perspective(fovy, aspect, near, far);`,
    platforms: ['both'],
    relatedTerms: ['Mat4f', 'Mat'],
  },
  {
    term: 'LinCon',
    category: 'math',
    definition: 'Linear congruential random number generator (in rnd namespace).',
    syntax: 'rnd::LinCon gen;',
    platforms: ['both'],
    relatedTerms: ['rnd::uniform', 'Tausworthe'],
  },
  {
    term: 'Tausworthe',
    category: 'math',
    definition: 'High-quality combined Tausworthe random number generator.',
    syntax: 'rnd::Tausworthe gen;',
    platforms: ['both'],
    relatedTerms: ['LinCon', 'rnd::uniform'],
  },
  {
    term: 'fromAxisAngle()',
    category: 'math',
    definition: 'Creates a quaternion from axis-angle representation.',
    syntax: 'q.fromAxisAngle(angle, axis);',
    example: `Quatd q;
q.fromAxisAngle(M_PI/2, Vec3d(0, 1, 0));  // 90° around Y`,
    platforms: ['both'],
    relatedTerms: ['Quat', 'toAxisAngle'],
  },
  {
    term: 'toAxisAngle()',
    category: 'math',
    definition: 'Converts quaternion to axis-angle representation.',
    syntax: 'q.toAxisAngle(angle, axis);',
    platforms: ['both'],
    relatedTerms: ['fromAxisAngle'],
  },
  {
    term: 'fromEuler()',
    category: 'math',
    definition: 'Creates a quaternion from Euler angles (YXZ order).',
    syntax: 'q.fromEuler(yaw, pitch, roll);',
    platforms: ['both'],
    relatedTerms: ['Quat', 'toEuler'],
  },
  {
    term: 'rotate()',
    category: 'math',
    definition: 'Rotates a vector by a quaternion.',
    syntax: 'Vec3d rotated = q.rotate(vec);',
    platforms: ['both'],
    relatedTerms: ['Quat'],
  },
  {
    term: 'lagrange()',
    category: 'math',
    definition: 'Lagrange polynomial interpolation.',
    syntax: 'float y = ipl::lagrange(x, points, n);',
    platforms: ['both'],
    relatedTerms: ['cubic', 'hermite'],
  },
  {
    term: 'hermite()',
    category: 'math',
    definition: 'Hermite interpolation with tension and bias control.',
    syntax: 'float y = ipl::hermite(frac, y0, y1, y2, y3, tension, bias);',
    platforms: ['both'],
    relatedTerms: ['cubic', 'lagrange'],
  },
  {
    term: 'cubic()',
    category: 'math',
    definition: 'Catmull-Rom cubic spline interpolation.',
    syntax: 'float y = ipl::cubic(frac, y0, y1, y2, y3);',
    platforms: ['both'],
    relatedTerms: ['hermite', 'linear'],
  },
  {
    term: 'linear()',
    category: 'math',
    definition: 'Linear interpolation between two points.',
    syntax: 'float y = ipl::linear(frac, y0, y1);',
    platforms: ['both'],
    relatedTerms: ['lerp', 'cubic'],
  },

  // ============================================================================
  // SPATIAL - ADVANCED CLASSES
  // ============================================================================
  {
    term: 'HashSpace',
    category: 'spatial',
    definition: 'Spatial hashing using voxel grid for collision detection and nearest neighbor queries.',
    syntax: 'HashSpace space(resolution, numObjects);',
    example: `HashSpace space(128, 1000);
space.move(objectId, position);
auto query = space(center, maxRadius);
int nearest = query.nearest();`,
    platforms: ['native'],
    relatedTerms: ['Pose'],
  },
  {
    term: 'SmoothPose',
    category: 'spatial',
    definition: 'Pose that smoothly interpolates toward a target pose.',
    syntax: 'SmoothPose pose(initial, posSmooth, quatSmooth);',
    platforms: ['native'],
    relatedTerms: ['Pose', 'Nav'],
  },
  {
    term: 'Frenet',
    category: 'spatial',
    definition: 'Frenet frame generator for curves. Computes tangent, normal, and binormal vectors.',
    syntax: 'Frenet<Vec3f> frame(p2, p1);',
    platforms: ['native'],
    relatedTerms: ['Pose'],
  },
  {
    term: 'DistAtten',
    category: 'spatial',
    definition: 'Distance attenuation calculator. Maps distance to gain using various attenuation laws.',
    syntax: 'DistAtten<float> atten(near, far, law, bias);',
    platforms: ['native'],
    relatedTerms: ['DynamicScene'],
  },
  {
    term: 'matrix()',
    category: 'spatial',
    definition: 'Converts a Pose to a 4x4 transformation matrix.',
    syntax: 'Mat4d m = pose.matrix();',
    platforms: ['both'],
    relatedTerms: ['Pose', 'Mat4d'],
  },
  {
    term: 'Viewport',
    category: 'spatial',
    definition: 'Screen region definition with left, bottom, width, height.',
    syntax: 'Viewport vp(0, 0, 800, 600);',
    platforms: ['both'],
    relatedTerms: ['Viewpoint', 'viewport'],
  },

  // ============================================================================
  // SCENE - SEQUENCING & DISTRIBUTION
  // ============================================================================
  {
    term: 'SynthSequencer',
    category: 'scene',
    definition: 'Event sequencer for triggering voices from text files or programmatically.',
    syntax: 'SynthSequencer seq;',
    example: `SynthSequencer seq;
seq.add<MyVoice>(0.0, 1.0);  // Start at 0s, 1s duration
seq.playSequence("score.synthSequence");`,
    platforms: ['native'],
    relatedTerms: ['PolySynth', 'SynthVoice'],
  },
  {
    term: 'SynthRecorder',
    category: 'scene',
    definition: 'Records trigger events and parameter changes to text files.',
    syntax: 'SynthRecorder recorder;',
    platforms: ['native'],
    relatedTerms: ['SynthSequencer', 'PolySynth'],
  },
  {
    term: 'DistributedScene',
    category: 'scene',
    definition: 'Scene that replicates across network using OSC. For distributed performances.',
    syntax: 'DistributedScene scene("sceneName");',
    platforms: ['native'],
    relatedTerms: ['DynamicScene', 'PolySynth'],
  },
  {
    term: 'SequencerMIDI',
    category: 'scene',
    definition: 'Connects MIDI input to PolySynth for real-time control.',
    syntax: 'SequencerMIDI seq(deviceIndex, synth);',
    platforms: ['native'],
    relatedTerms: ['PolySynth', 'MIDIIn'],
  },
  {
    term: 'onTriggerOn()',
    category: 'scene',
    definition: 'Virtual method called when a voice is triggered on.',
    syntax: 'void onTriggerOn() override { ... }',
    platforms: ['both'],
    relatedTerms: ['SynthVoice', 'onTriggerOff'],
  },
  {
    term: 'onTriggerOff()',
    category: 'scene',
    definition: 'Virtual method called when a voice is released.',
    syntax: 'void onTriggerOff() override { free(); }',
    platforms: ['both'],
    relatedTerms: ['SynthVoice', 'onTriggerOn'],
  },
  {
    term: 'onProcess()',
    category: 'scene',
    definition: 'Virtual method for voice audio or graphics processing.',
    syntax: 'void onProcess(AudioIOData& io) override { ... }',
    platforms: ['both'],
    relatedTerms: ['SynthVoice', 'render'],
  },

  // ============================================================================
  // AUDIO/IO - SPEAKERS, REVERB & FILES
  // ============================================================================
  {
    term: 'Speaker',
    category: 'audio',
    definition: 'Individual speaker metadata including position, channel, and gain.',
    syntax: 'Speaker speaker(channel, azimuth, elevation);',
    platforms: ['native'],
    relatedTerms: ['Speakers', 'Spatializer'],
  },
  {
    term: 'Speakers',
    category: 'audio',
    definition: 'Collection of Speaker objects defining a speaker layout.',
    syntax: 'Speakers layout = StereoSpeakerLayout();',
    platforms: ['native'],
    relatedTerms: ['Speaker', 'VBAP'],
  },
  {
    term: 'SpeakerRingLayout',
    category: 'audio',
    definition: 'Factory function creating equally-spaced speakers in a ring.',
    syntax: 'auto layout = SpeakerRingLayout<8>();  // 8 speakers',
    platforms: ['native'],
    relatedTerms: ['Speakers'],
  },
  {
    term: 'Reverb',
    category: 'audio',
    definition: 'Plate reverberator based on Dattorro design.',
    syntax: 'Reverb<float> reverb;',
    example: `Reverb<float> reverb;
reverb.bandwidth(0.9);
reverb.damping(0.3);
reverb.decay(0.8);
float wet = reverb(input);`,
    platforms: ['native'],
    relatedTerms: ['gam::ReverbMS'],
  },
  {
    term: 'BiQuad',
    category: 'audio',
    definition: 'Biquad filter (allolib version). Supports LP, HP, BP, notch, peaking, shelving.',
    syntax: 'BiQuad filter;',
    platforms: ['native'],
    relatedTerms: ['gam::Biquad'],
  },
  {
    term: 'AmbiDecode',
    category: 'audio',
    definition: 'Higher Order Ambisonic decoder. Decodes B-format to speaker outputs.',
    syntax: 'AmbiDecode decoder(order, numSpeakers);',
    platforms: ['native'],
    relatedTerms: ['AmbiEncode', 'Ambisonics'],
  },
  {
    term: 'AmbiEncode',
    category: 'audio',
    definition: 'Higher Order Ambisonic encoder. Encodes sources to B-format.',
    syntax: 'AmbiEncode encoder(order);',
    platforms: ['native'],
    relatedTerms: ['AmbiDecode', 'Ambisonics'],
  },
  {
    term: 'Lbap',
    category: 'audio',
    definition: 'Layer-Based Amplitude Panning spatializer.',
    syntax: 'Lbap lbap;',
    platforms: ['native'],
    relatedTerms: ['VBAP', 'DBAP', 'Spatializer'],
  },
  {
    term: 'StereoPanner',
    category: 'audio',
    definition: 'Simple stereo panning spatializer using equal-power panning.',
    syntax: 'StereoPanner panner;',
    platforms: ['native'],
    relatedTerms: ['gam::Pan', 'Spatializer'],
  },
  {
    term: 'bus()',
    category: 'audio',
    definition: 'Accesses an auxiliary audio bus for mixing.',
    syntax: 'io.bus(channel) = sample;',
    platforms: ['both'],
    relatedTerms: ['AudioIOData', 'io.out'],
  },
  {
    term: 'zeroBus()',
    category: 'audio',
    definition: 'Zeros all bus channels.',
    syntax: 'io.zeroBus();',
    platforms: ['both'],
    relatedTerms: ['bus', 'zeroOut'],
  },
  {
    term: 'zeroOut()',
    category: 'audio',
    definition: 'Zeros all output channels.',
    syntax: 'io.zeroOut();',
    platforms: ['both'],
    relatedTerms: ['zeroBus'],
  },
  {
    term: 'File',
    category: 'io',
    definition: 'File I/O operations. Read, write, and query files.',
    syntax: 'File file(path, mode);',
    platforms: ['native'],
    webAlternative: 'WebFile',
    relatedTerms: ['Dir', 'FilePath'],
  },
  {
    term: 'Dir',
    category: 'io',
    definition: 'Directory operations. Create, remove, and list directories.',
    syntax: 'Dir::make(path);',
    platforms: ['native'],
    relatedTerms: ['File'],
  },
  {
    term: 'FileList',
    category: 'io',
    definition: 'Collection of file paths with navigation.',
    syntax: 'FileList files;',
    platforms: ['native'],
    relatedTerms: ['File', 'SearchPaths'],
  },
  {
    term: 'SearchPaths',
    category: 'io',
    definition: 'Multi-path file search management.',
    syntax: 'SearchPaths paths;',
    platforms: ['native'],
    relatedTerms: ['File', 'FileList'],
  },
  {
    term: 'Socket',
    category: 'io',
    definition: 'Network socket abstraction for TCP/UDP communication.',
    syntax: 'Socket socket;',
    platforms: ['native'],
    relatedTerms: ['SocketClient', 'SocketServer'],
  },
  {
    term: 'SocketClient',
    category: 'io',
    definition: 'Client socket that connects to remote server.',
    syntax: 'SocketClient client(address, port);',
    platforms: ['native'],
    relatedTerms: ['Socket', 'SocketServer'],
  },
  {
    term: 'SocketServer',
    category: 'io',
    definition: 'Server socket that listens for connections.',
    syntax: 'SocketServer server(port);',
    platforms: ['native'],
    relatedTerms: ['Socket', 'SocketClient'],
  },
  {
    term: 'MIDIMessage',
    category: 'io',
    definition: 'Represents a MIDI message with type, channel, and data bytes.',
    syntax: 'void onMIDIMessage(const MIDIMessage& m) { ... }',
    example: `void onMIDIMessage(const MIDIMessage& m) {
  if (m.type() == MIDIByte::NOTE_ON) {
    int note = m.noteNumber();
    int vel = m.velocity();
  }
}`,
    platforms: ['native'],
    relatedTerms: ['MIDIIn', 'MIDIMessageHandler'],
  },
  {
    term: 'MIDIMessageHandler',
    category: 'io',
    definition: 'Interface for handling MIDI messages.',
    syntax: 'class MyHandler : public MIDIMessageHandler { ... };',
    platforms: ['native'],
    relatedTerms: ['MIDIMessage', 'MIDIIn'],
  },
  {
    term: 'CSVReader',
    category: 'io',
    definition: 'CSV file parsing and data extraction.',
    syntax: 'CSVReader csv;',
    platforms: ['native'],
    relatedTerms: ['File'],
  },
  {
    term: 'TomlLoader',
    category: 'io',
    definition: 'TOML configuration file handling.',
    syntax: 'TomlLoader config;',
    platforms: ['native'],
    relatedTerms: ['PersistentConfig'],
  },
  {
    term: 'PersistentConfig',
    category: 'io',
    definition: 'Configuration persistence manager. Saves/loads app settings.',
    syntax: 'PersistentConfig config;',
    platforms: ['native'],
    relatedTerms: ['TomlLoader', 'Parameter'],
  },
  {
    term: 'NavInputControl',
    category: 'io',
    definition: 'Maps keyboard/mouse input to Nav navigation.',
    syntax: 'NavInputControl navControl(nav);',
    platforms: ['native'],
    relatedTerms: ['Nav', 'Keyboard', 'Mouse'],
  },
  {
    term: 'middle()',
    category: 'io',
    definition: 'Returns true if the middle mouse button is pressed.',
    syntax: 'if (m.middle()) { ... }',
    platforms: ['both'],
    relatedTerms: ['left', 'right', 'Mouse'],
  },
  {
    term: 'scrollX(), scrollY()',
    category: 'io',
    definition: 'Returns the mouse scroll wheel delta.',
    syntax: 'float scroll = m.scrollY();',
    platforms: ['both'],
    relatedTerms: ['Mouse', 'onMouseScroll'],
  },
  {
    term: 'down()',
    category: 'io',
    definition: 'Returns true if a key or mouse button is pressed down.',
    syntax: 'if (k.down()) { ... }',
    platforms: ['both'],
    relatedTerms: ['Keyboard', 'Mouse'],
  },
  {
    term: 'keyAsNumber()',
    category: 'io',
    definition: 'Returns the key as a number (0-9) if it is a digit key.',
    syntax: 'int num = k.keyAsNumber();',
    platforms: ['both'],
    relatedTerms: ['key', 'Keyboard'],
  },

  // ============================================================================
  // TYPES - PARAMETER CLASSES
  // ============================================================================
  {
    term: 'ParameterBool',
    category: 'types',
    definition: 'Thread-safe boolean parameter with callbacks.',
    syntax: 'ParameterBool param{"name", "group", false};',
    platforms: ['native'],
    relatedTerms: ['Parameter', 'ParameterInt'],
  },
  {
    term: 'ParameterInt',
    category: 'types',
    definition: 'Thread-safe integer parameter with range and callbacks.',
    syntax: 'ParameterInt param{"name", "group", 0, 0, 100};',
    platforms: ['native'],
    relatedTerms: ['Parameter', 'ParameterBool'],
  },
  {
    term: 'ParameterString',
    category: 'types',
    definition: 'Thread-safe string parameter with callbacks.',
    syntax: 'ParameterString param{"name", "group", ""};',
    platforms: ['native'],
    relatedTerms: ['Parameter'],
  },
  {
    term: 'ParameterVec3',
    category: 'types',
    definition: 'Thread-safe 3D vector parameter.',
    syntax: 'ParameterVec3 param{"name", "group"};',
    platforms: ['native'],
    relatedTerms: ['Parameter', 'Vec3f'],
  },
  {
    term: 'ParameterPose',
    category: 'types',
    definition: 'Thread-safe Pose parameter for position/orientation.',
    syntax: 'ParameterPose param{"name", "group"};',
    platforms: ['native'],
    relatedTerms: ['Parameter', 'Pose'],
  },
  {
    term: 'ParameterMenu',
    category: 'types',
    definition: 'Parameter that selects from a list of options.',
    syntax: 'ParameterMenu param{"name", "group"};',
    platforms: ['native'],
    relatedTerms: ['Parameter'],
  },
  {
    term: 'Trigger',
    category: 'types',
    definition: 'Single-shot trigger parameter. Resets after being read.',
    syntax: 'Trigger trig{"name", "group"};',
    platforms: ['native'],
    relatedTerms: ['Parameter'],
  },

  // ============================================================================
  // SYNTHGUIMANAGER & CONTROL GUI
  // ============================================================================
  {
    term: 'SynthGUIManager',
    category: 'scene',
    definition: 'Template class that combines PolySynth with GUI controls and preset management. Simplifies creating polyphonic synthesizers with parameter control.',
    syntax: 'SynthGUIManager<MySynthVoice> synthManager{"SynthName"};',
    example: `SynthGUIManager<SineEnv> synthManager{"SineEnv"};

// Get a voice and trigger
synthManager.voice()->setInternalParameterValue("frequency", 440);
synthManager.triggerOn(midiNote);
synthManager.triggerOff(midiNote);

// Render audio and graphics
synthManager.render(io);
synthManager.render(g);`,
    platforms: ['both'],
    relatedTerms: ['PolySynth', 'SynthVoice', 'ControlGUI', 'PresetHandler'],
  },
  {
    term: 'ControlGUI',
    category: 'types',
    definition: 'GUI controller that displays and manages Parameter objects. In native builds uses ImGui, in web builds maps to Vue Parameter Panel.',
    syntax: 'ControlGUI gui;',
    example: `Parameter amplitude{"Amplitude", "", 0.5f, 0.0f, 1.0f};
Parameter frequency{"Frequency", "", 440.0f, 20.0f, 20000.0f};
ControlGUI gui;

void onCreate() override {
    gui << amplitude << frequency;
    gui.init();
}

void onAnimate(double dt) override {
    gui.draw();
}`,
    platforms: ['both'],
    relatedTerms: ['Parameter', 'ParameterGUI', 'SynthGUIManager'],
  },
  {
    term: 'PresetHandler',
    category: 'types',
    definition: 'Manages saving and loading parameter presets to/from files. Supports morphing between presets.',
    syntax: 'PresetHandler presets{"presets"};',
    example: `PresetHandler presets{"presets"};
presets << amplitude << frequency;
presets.storePreset("brass");
presets.recallPreset("brass");
presets.setMorphTime(2.0);  // 2 second morph`,
    platforms: ['native'],
    webAlternative: 'Quick Save button creates .preset files in bin/{synthName}-data/',
    relatedTerms: ['Parameter', 'ControlGUI', 'SynthGUIManager'],
  },
  {
    term: 'ParameterBundle',
    category: 'types',
    definition: 'Groups multiple parameters together for organization and bulk operations.',
    syntax: 'ParameterBundle bundle{"group"};',
    example: `ParameterBundle bundle{"oscillator"};
bundle << frequency << amplitude << detune;
presets << bundle;`,
    platforms: ['both'],
    relatedTerms: ['Parameter', 'PresetHandler'],
  },

  // ============================================================================
  // SYNTHVOICE PARAMETER METHODS
  // ============================================================================
  {
    term: 'createInternalTriggerParameter',
    category: 'scene',
    definition: 'Creates a parameter inside a SynthVoice that is set when the voice is triggered. Used for per-note parameters like frequency, amplitude, etc.',
    syntax: 'createInternalTriggerParameter("name", default, min, max);',
    example: `void init() override {
    createInternalTriggerParameter("frequency", 440, 20, 20000);
    createInternalTriggerParameter("amplitude", 0.5, 0.0, 1.0);
    createInternalTriggerParameter("attackTime", 0.1, 0.01, 3.0);
}`,
    platforms: ['both'],
    relatedTerms: ['SynthVoice', 'getInternalParameterValue', 'setInternalParameterValue'],
  },
  {
    term: 'getInternalParameterValue',
    category: 'scene',
    definition: 'Retrieves the current value of an internal trigger parameter within a SynthVoice.',
    syntax: 'float value = getInternalParameterValue("name");',
    example: `void onProcess(AudioIOData& io) override {
    float freq = getInternalParameterValue("frequency");
    float amp = getInternalParameterValue("amplitude");
    osc.freq(freq);
    // ...
}`,
    platforms: ['both'],
    relatedTerms: ['SynthVoice', 'createInternalTriggerParameter', 'setInternalParameterValue'],
  },
  {
    term: 'setInternalParameterValue',
    category: 'scene',
    definition: 'Sets the value of an internal trigger parameter on a SynthVoice before triggering.',
    syntax: 'voice->setInternalParameterValue("name", value);',
    example: `int midiNote = asciiToMIDI(k.key());
if (midiNote > 0) {
    float freq = pow(2.f, (midiNote - 69.f) / 12.f) * 440.f;
    synthManager.voice()->setInternalParameterValue("frequency", freq);
    synthManager.voice()->setInternalParameterValue("amplitude", 0.5f);
    synthManager.triggerOn(midiNote);
}`,
    platforms: ['both'],
    relatedTerms: ['SynthVoice', 'createInternalTriggerParameter', 'getInternalParameterValue'],
  },

  // ============================================================================
  // KEYBOARD TO MIDI
  // ============================================================================
  {
    term: 'asciiToMIDI',
    category: 'io',
    definition: 'Converts ASCII keyboard keys to MIDI note numbers. Maps QWERTY keyboard rows to piano-like layout.',
    syntax: 'int midiNote = asciiToMIDI(key);',
    example: `bool onKeyDown(Keyboard const& k) override {
    int midiNote = asciiToMIDI(k.key());
    if (midiNote > 0) {
        float freq = pow(2.f, (midiNote - 69.f) / 12.f) * 440.f;
        synthManager.voice()->setInternalParameterValue("frequency", freq);
        synthManager.triggerOn(midiNote);
    }
    return true;
}
// ZXCVBNM = C3-B3, ASDFGHJ = C4-B4, QWERTYU = C5-B5`,
    platforms: ['both'],
    relatedTerms: ['Keyboard', 'SynthVoice', 'triggerOn'],
  },
  {
    term: 'asciiToIndex',
    category: 'io',
    definition: 'Converts number keys 0-9 to index values. Useful for preset selection.',
    syntax: 'int index = asciiToIndex(key);',
    example: `if (k.shift()) {
    int presetNum = asciiToIndex(k.key());
    if (presetNum >= 0) {
        synthManager.recallPreset(presetNum);
    }
}`,
    platforms: ['both'],
    relatedTerms: ['asciiToMIDI', 'PresetHandler'],
  },

  // ============================================================================
  // GAMMA DSP - ADDITIONAL
  // ============================================================================
  {
    term: 'gam::EnvFollow',
    category: 'gamma',
    definition: 'Envelope follower that tracks the amplitude of a signal. Useful for graphics that react to audio.',
    syntax: 'gam::EnvFollow<> envFollow;',
    example: `gam::EnvFollow<> mEnvFollow;

void onProcess(AudioIOData& io) override {
    while (io()) {
        float sample = osc() * env();
        mEnvFollow(sample);  // Track amplitude
        io.out(0) = sample;
    }
}

void onProcess(Graphics& g) override {
    float amp = mEnvFollow.value();  // Use for visuals
    g.scale(1.0 + amp);
}`,
    platforms: ['both'],
    relatedTerms: ['gam::Env', 'gam::ADSR', 'SynthVoice'],
  },
  {
    term: 'gam::sampleRate',
    category: 'gamma',
    definition: 'Sets or gets the global sample rate for all Gamma objects. Must be called before creating oscillators/envelopes.',
    syntax: 'gam::sampleRate(44100);',
    example: `void onCreate() override {
    gam::sampleRate(44100);  // Set before using Gamma objects
    // Now oscillators will be correctly tuned
}`,
    platforms: ['both'],
    relatedTerms: ['gam::Sine', 'gam::Env', 'AudioIOData'],
  },

  // ============================================================================
  // ADDITIONAL PARAMETER TYPES
  // ============================================================================
  {
    term: 'Trigger',
    category: 'types',
    definition: 'A parameter that triggers an action when activated. Has no persistent value, just fires an event.',
    syntax: 'Trigger trigger{"name", "group"};',
    example: `Trigger resetTrigger{"Reset", ""};

// Connect callback
resetTrigger.registerChangeCallback([&](float) {
    resetAllParameters();
});`,
    platforms: ['both'],
    relatedTerms: ['Parameter', 'ParameterBool'],
  },
  {
    term: 'ParameterColor',
    category: 'types',
    definition: 'Parameter that stores an RGBA color value.',
    syntax: 'ParameterColor color{"name", "group"};',
    example: `ParameterColor bgColor{"Background", "", Color(0.1, 0.1, 0.1)};

void onDraw(Graphics& g) override {
    g.clear(bgColor.get());
}`,
    platforms: ['both'],
    relatedTerms: ['Parameter', 'ParameterVec4', 'Color'],
  },
  {
    term: 'ParameterVec4',
    category: 'types',
    definition: 'Parameter that stores a 4D vector value.',
    syntax: 'ParameterVec4 vec{"name", "group"};',
    example: `ParameterVec4 lightDir{"Light Direction", ""};`,
    platforms: ['both'],
    relatedTerms: ['Parameter', 'ParameterVec3', 'Vec4f'],
  },
  {
    term: 'ParameterChoice',
    category: 'types',
    definition: 'Parameter that selects from named options. Similar to ParameterMenu but with string labels.',
    syntax: 'ParameterChoice choice{"name", "group"};',
    example: `ParameterChoice waveform{"Waveform", ""};
waveform.setElements({"Sine", "Square", "Saw", "Triangle"});`,
    platforms: ['both'],
    relatedTerms: ['Parameter', 'ParameterMenu'],
  },

  // ============================================================================
  // WEB PLATFORM - COMPATIBILITY
  // ============================================================================
  {
    term: 'al_playground_compat.hpp',
    category: 'web',
    definition: 'Compatibility header that allows code to compile on both native and web platforms. Provides stubs for ImGui and maps ControlGUI to WebControlGUI.',
    syntax: '#include "al_playground_compat.hpp"',
    example: `#include "al_playground_compat.hpp"

// Works on both platforms:
SynthGUIManager<MySynth> synthManager{"MySynth"};
ControlGUI gui;  // WebControlGUI on web, real ControlGUI on native`,
    platforms: ['both'],
    relatedTerms: ['al_compat.hpp', 'ControlGUI', 'SynthGUIManager'],
  },
  {
    term: 'WebControlGUI',
    category: 'web',
    definition: 'Web implementation of ControlGUI that bridges C++ parameters to the Vue Parameter Panel via JavaScript callbacks.',
    syntax: 'using ControlGUI = WebControlGUI;  // automatic in al_playground_compat.hpp',
    platforms: ['web'],
    relatedTerms: ['ControlGUI', 'Parameter', 'al_playground_compat.hpp'],
  },

  // ============================================================================
  // STUDIO FEATURES - EXTENDED CAPABILITIES
  // ============================================================================
  {
    term: 'WebOBJ',
    category: 'studio',
    definition: 'OBJ mesh file loader. Parses Wavefront OBJ files and creates AlloLib Mesh objects. Supports vertices, normals, texture coordinates, and triangulated faces.',
    syntax: 'WebOBJ loader;\nloader.load("/path/to/mesh.obj");',
    example: `WebOBJ bunny;

void onCreate() override {
    bunny.load("/assets/meshes/bunny.obj");
}

void onDraw(Graphics& g) override {
    if (bunny.ready()) {
        g.draw(bunny.mesh());
    }
}`,
    platforms: ['both'],
    relatedTerms: ['Mesh', 'LODMesh', 'WebEnvironment'],
  },
  {
    term: 'WebHDR',
    category: 'studio',
    definition: 'HDR (High Dynamic Range) image loader. Loads .hdr files for environment maps and image-based lighting. Uses RGBE format parsing.',
    syntax: 'WebHDR hdr;\nhdr.load("/path/to/environment.hdr");',
    example: `WebHDR hdr;

void onCreate() override {
    hdr.load("/assets/environments/studio.hdr");
}

void onAnimate(double dt) override {
    if (hdr.ready()) {
        int w = hdr.width();
        int h = hdr.height();
        const float* pixels = hdr.pixels();
    }
}`,
    platforms: ['both'],
    relatedTerms: ['WebEnvironment', 'WebPBR'],
  },
  {
    term: 'WebEnvironment',
    category: 'studio',
    definition: 'Environment map system providing skybox rendering and environment reflections. Works with equirectangular HDR images.',
    syntax: 'WebEnvironment env;\nenv.load("/path/to/environment.hdr");',
    example: `WebEnvironment env;

void onCreate() override {
    env.load("/assets/environments/studio.hdr");
}

void onDraw(Graphics& g) override {
    env.drawSkybox(g);  // Draw background

    // Draw reflective objects
    env.beginReflect(g, nav().pos(), 0.8);
    g.draw(sphereMesh);
    env.endReflect();
}`,
    platforms: ['both'],
    relatedTerms: ['WebHDR', 'WebPBR', 'drawSkybox'],
  },
  {
    term: 'drawSkybox()',
    category: 'studio',
    definition: 'Draws the environment map as a background skybox. Call at the beginning of onDraw for proper depth ordering.',
    syntax: 'env.drawSkybox(g);',
    platforms: ['both'],
    relatedTerms: ['WebEnvironment', 'beginReflect'],
  },
  {
    term: 'beginReflect()',
    category: 'studio',
    definition: 'Starts drawing reflective objects. Sets up environment reflection shader.',
    syntax: 'env.beginReflect(g, cameraPos, reflectivity);',
    platforms: ['both'],
    relatedTerms: ['WebEnvironment', 'endReflect'],
  },
  {
    term: 'WebPBR',
    category: 'studio',
    definition: 'Physically-Based Rendering system with metallic-roughness workflow. Supports IBL (Image-Based Lighting) using environment maps.',
    syntax: 'WebPBR pbr;',
    example: `WebPBR pbr;
PBRMaterial gold = PBRMaterial::Gold();

void onCreate() override {
    pbr.loadEnvironment("/assets/environments/studio.hdr");
}

void onDraw(Graphics& g) override {
    pbr.drawSkybox(g);
    pbr.begin(g, nav().pos());
    pbr.material(gold);
    g.draw(sphereMesh);
    pbr.end();
}`,
    platforms: ['web'],
    relatedTerms: ['PBRMaterial', 'WebEnvironment', 'WebHDR'],
  },
  {
    term: 'PBRMaterial',
    category: 'studio',
    definition: 'Material properties for physically-based rendering. Includes albedo, metallic, roughness, ambient occlusion, and emission. Has built-in presets for common materials.',
    syntax: 'PBRMaterial mat;\nmat.albedo = Vec3f(1, 0, 0);  // Red\nmat.metallic = 1.0f;\nmat.roughness = 0.3f;',
    example: `// Built-in presets
PBRMaterial gold = PBRMaterial::Gold();
PBRMaterial silver = PBRMaterial::Silver();
PBRMaterial copper = PBRMaterial::Copper();
PBRMaterial iron = PBRMaterial::Iron();
PBRMaterial plastic = PBRMaterial::Plastic(Color::Red);
PBRMaterial rubber = PBRMaterial::Rubber(Color::Black);`,
    platforms: ['web'],
    relatedTerms: ['WebPBR', 'metallic', 'roughness'],
  },
  {
    term: 'enableAutoLOD',
    category: 'studio',
    definition: 'Enables automatic Level of Detail for all meshes. AUTO-LOD IS ENABLED BY DEFAULT - you do not need to call this. All g.draw() calls automatically use LOD. Use this only if you disabled auto-LOD and want to re-enable it, or to customize the number of LOD levels.',
    syntax: 'enableAutoLOD(4);  // 4 LOD levels (default)\nautoLOD().setDistances({10, 25, 50, 100});',
    example: `// AUTO-LOD IS ON BY DEFAULT - NO CODE CHANGES NEEDED!
// Just use g.draw() normally - LOD happens automatically.

void onDraw(Graphics& g) override {
    g.draw(myMesh);  // Automatic LOD based on camera distance!
}

// To customize LOD (optional):
void onCreate() override {
    autoLOD().setDistances({5, 15, 30, 60});  // Custom thresholds
    autoLOD().setBias(1.2);  // Adjust aggressiveness
}`,
    platforms: ['web'],
    relatedTerms: ['autoLOD', 'drawLOD', 'LODMesh', 'LODSelectionMode'],
  },
  {
    term: 'autoLOD',
    category: 'studio',
    definition: 'Accessor for the automatic LOD manager (Unreal Engine-style). Auto-LOD is ENABLED BY DEFAULT with screen-size based selection. Use this to customize LOD settings like selection mode, distance thresholds, bias, triangle budget, and statistics.',
    syntax: 'autoLOD().setBias(1.5);\nautoLOD().setSelectionMode(LODSelectionMode::ScreenError);',
    example: `// Auto-LOD works automatically! Optional customization:
void onCreate() override {
    // Selection modes (like Unreal Engine):
    autoLOD().setSelectionMode(LODSelectionMode::ScreenSize);  // Default (like Unreal)
    // autoLOD().setSelectionMode(LODSelectionMode::ScreenError);  // Nanite-like
    // autoLOD().setSelectionMode(LODSelectionMode::TriangleBudget);  // Fixed budget

    autoLOD().setBias(1.2);           // Higher = use simpler LOD sooner
    autoLOD().setBudget(500000);      // Max triangles per frame
    autoLOD().enableStats(true);      // Track triangle counts
}

void onDraw(Graphics& g) override {
    g.draw(mesh);  // LOD automatic!
    printf("Triangles: %d\\n", autoLOD().frameTriangles());
}`,
    platforms: ['web'],
    relatedTerms: ['enableAutoLOD', 'drawLOD', 'LODMesh', 'LODSelectionMode'],
  },
  {
    term: 'drawLOD',
    category: 'studio',
    definition: 'Draws a mesh with automatic LOD selection based on screen-size metrics (Unreal Engine-style). NOTE: You typically do not need to call this directly - all g.draw() calls are automatically converted to use LOD. Use this only for explicit control.',
    syntax: 'drawLOD(g, mesh);  // Usually not needed - g.draw() auto-converts!',
    example: `// RECOMMENDED: Just use g.draw() - LOD is automatic!
void onDraw(Graphics& g) override {
    g.draw(myMesh);  // Auto-LOD applied behind the scenes
}

// ADVANCED: Explicit drawLOD call (rarely needed)
void onDraw(Graphics& g) override {
    g.pushMatrix();
    g.translate(0, 1, 0);
    drawLOD(g, myHighPolyMesh);  // Explicit LOD call
    g.popMatrix();
}`,
    platforms: ['web'],
    relatedTerms: ['enableAutoLOD', 'autoLOD', 'LODMesh', 'LODSelectionMode'],
  },
  {
    term: 'LODSelectionMode',
    category: 'studio',
    definition: 'Enum defining how the auto-LOD system selects detail levels. Inspired by Unreal Engine: Distance (classic), ScreenSize (Unreal default - based on projected screen coverage), ScreenError (Nanite-like - minimizes visual error), TriangleBudget (enforces triangle limit per frame).',
    syntax: 'autoLOD().setSelectionMode(LODSelectionMode::ScreenSize);',
    example: `void onCreate() override {
    // Selection modes (Unreal Engine-style):

    // Distance: Classic distance-based (fastest, least accurate)
    autoLOD().setSelectionMode(LODSelectionMode::Distance);

    // ScreenSize: Based on projected screen coverage (Unreal default)
    autoLOD().setSelectionMode(LODSelectionMode::ScreenSize);

    // ScreenError: Minimizes visual error (Nanite-like, highest quality)
    autoLOD().setSelectionMode(LODSelectionMode::ScreenError);

    // TriangleBudget: Enforces max triangles per frame
    autoLOD().setSelectionMode(LODSelectionMode::TriangleBudget);
    autoLOD().setBudget(500000);  // 500K triangle limit
}`,
    platforms: ['web'],
    relatedTerms: ['autoLOD', 'enableAutoLOD', 'drawLOD', 'QualityManager'],
  },
  {
    term: 'LODMesh',
    category: 'studio',
    definition: 'Manual Level of Detail mesh system. NOTE: For most cases, auto-LOD is enabled by default and g.draw() automatically uses LOD. LODMesh is only needed for advanced manual control.',
    syntax: 'LODMesh lod;\nlod.generate(mesh, 4);  // 4 LOD levels',
    example: `// AUTO-LOD IS ON BY DEFAULT - just use g.draw()!
// LODMesh is only needed for advanced manual control:

// LODMesh for explicit per-object control:
LODMesh lod;

void onCreate() override {
    lod.generate(mesh, 4);
    lod.setDistances({5, 15, 30, 60});
}

void onDraw(Graphics& g) override {
    float dist = (nav().pos() - objectPos).mag();
    g.draw(lod.selectByDistance(dist));
}`,
    platforms: ['both'],
    relatedTerms: ['enableAutoLOD', 'drawLOD', 'autoLOD', 'LODGroup'],
  },
  {
    term: 'LODGroup',
    category: 'studio',
    definition: 'Manages Level of Detail for multiple objects. Updates all LOD selections based on camera position and draws all objects efficiently.',
    syntax: 'LODGroup group;\ngroup.add(&lodMesh, position, scale);',
    example: `LODGroup group;

void onCreate() override {
    for (int i = 0; i < 100; i++) {
        group.add(&lodMesh, randomPosition(), 1.0f);
    }
}

void onAnimate(double dt) override {
    group.update(nav().pos());  // Update all LOD selections
}

void onDraw(Graphics& g) override {
    group.draw(g);  // Draw all objects with appropriate LOD
}`,
    platforms: ['both'],
    relatedTerms: ['LODMesh', 'QualityManager'],
  },
  {
    term: 'MeshSimplifier',
    category: 'studio',
    definition: 'Mesh decimation using Quadric Error Metrics. Reduces polygon count while preserving shape. Used internally by LODMesh.',
    syntax: 'MeshSimplifier::simplify(input, output, 0.5);  // 50% reduction',
    platforms: ['both'],
    relatedTerms: ['LODMesh', 'QuadricErrorMetric'],
  },
  {
    term: 'TextureLOD',
    category: 'studio',
    definition: 'Distance-based texture resolution switching. Automatically selects appropriate texture resolution based on camera distance to reduce memory bandwidth and improve performance.',
    syntax: 'TextureLOD texLOD;\ntexLOD.setLevels({2048, 1024, 512, 256});\ntexLOD.setDistances({5, 15, 30, 60});',
    example: `TextureLOD texLOD;
Texture textures[4];  // Different resolutions

void onCreate() override {
    texLOD.setLevels({2048, 1024, 512, 256});
    texLOD.setDistances({10, 25, 50, 100});
}

void onDraw(Graphics& g) override {
    float distance = (nav().pos() - objectPos).mag();
    int level = texLOD.selectLevel(distance);
    textures[level].bind();
    g.draw(mesh);
}`,
    platforms: ['both'],
    relatedTerms: ['LODMesh', 'ShaderLOD', 'LODController'],
  },
  {
    term: 'ShaderLOD',
    category: 'studio',
    definition: 'Distance-based shader complexity switching. Selects simpler shaders for distant objects to improve performance while maintaining quality for close objects.',
    syntax: 'ShaderLOD shaderLOD;\nshaderLOD.setLevels(4);\nshaderLOD.setDistances({10, 30, 60, 100});',
    example: `ShaderLOD shaderLOD;

void onCreate() override {
    shaderLOD.setLevels(4);  // 4 complexity levels
    // Level 0: Full PBR with IBL, normal maps, reflections
    // Level 1: Standard PBR, no reflections
    // Level 2: Simple diffuse/specular
    // Level 3: Unlit/vertex lighting
}

void onDraw(Graphics& g) override {
    int level = shaderLOD.selectByDistance(distance);
    if (shaderLOD.normalMapping(level)) useNormalMap();
    if (shaderLOD.reflections(level)) enableReflections();
}`,
    platforms: ['both'],
    relatedTerms: ['LODMesh', 'TextureLOD', 'LODController', 'QualityManager'],
  },
  {
    term: 'LODController',
    category: 'studio',
    definition: 'Unified controller for mesh, texture, and shader LOD. Manages all LOD aspects for an object in one place, simplifying distance-based quality management.',
    syntax: 'LODController lod;\nlod.meshLOD().generate(mesh, 4);\nlod.update(distance);',
    example: `LODController lod;

void onCreate() override {
    lod.meshLOD().generate(highPolyMesh, 4);
    lod.textureLOD().setLevels({2048, 1024, 512, 256});
    lod.shaderLOD().setLevels(4);
}

void onDraw(Graphics& g) override {
    float distance = (nav().pos() - objectPos).mag();
    lod.update(distance);

    // All selections made automatically
    g.draw(lod.currentMesh());
    textures[lod.currentTextureLevel()].bind();

    if (lod.currentNormalMapping()) enableNormalMaps();
    if (lod.currentReflections()) enableReflections();
}`,
    platforms: ['both'],
    relatedTerms: ['LODMesh', 'TextureLOD', 'ShaderLOD', 'QualityManager'],
  },
  {
    term: 'QualityManager',
    category: 'studio',
    definition: 'Adaptive quality system that monitors FPS and automatically adjusts rendering settings. Similar to Unreal Engine\'s scalability system.',
    syntax: 'QualityManager quality;\nquality.setPreset(QualityPreset::High);',
    example: `QualityManager quality;

void onCreate() override {
    quality.setTargetFPS(60);
    quality.setPreset(QualityPreset::Auto);  // Auto-adjust
}

void onAnimate(double dt) override {
    quality.update(dt);  // Monitor FPS and adjust

    // Use quality settings
    lodMesh.bias(quality.lodBias());
}

void onDraw(Graphics& g) override {
    if (quality.shadowsEnabled()) {
        // Draw shadows
    }
}`,
    platforms: ['both'],
    relatedTerms: ['QualityPreset', 'QualitySettings', 'LODMesh'],
  },
  {
    term: 'QualityPreset',
    category: 'studio',
    definition: 'Predefined quality levels: Auto, Low, Medium, High, Ultra. Auto mode dynamically adjusts settings based on FPS.',
    syntax: 'quality.setPreset(QualityPreset::High);',
    example: `// Preset values
QualityPreset::Auto    // Starts at High, adapts based on FPS
QualityPreset::Low     // 0.5x resolution, no shadows/AO
QualityPreset::Medium  // 0.75x resolution, basic effects
QualityPreset::High    // 1.0x resolution, all effects
QualityPreset::Ultra   // Max quality, 2K+ shadows`,
    platforms: ['both'],
    relatedTerms: ['QualityManager', 'QualitySettings'],
  },
  {
    term: 'QualitySettings',
    category: 'studio',
    definition: 'Individual quality parameters including resolution scale, LOD bias, shadow map size, and effect toggles.',
    syntax: 'QualitySettings& s = quality.settings();',
    example: `const QualitySettings& s = quality.settings();
// Resolution
float scale = s.resolutionScale;  // 0.5 - 1.0
float lodBias = s.lodBias;        // Higher = lower detail

// Effects
bool shadows = s.shadowsEnabled;
bool reflections = s.reflectionsEnabled;
bool bloom = s.bloomEnabled;
bool ao = s.ambientOcclusion;

// Limits
int maxLights = s.maxLights;
int maxParticles = s.maxParticles;`,
    platforms: ['both'],
    relatedTerms: ['QualityManager', 'QualityPreset'],
  },
  {
    term: 'ProceduralTexture',
    category: 'studio',
    definition: 'Procedural texture generator with various noise and pattern functions. Creates textures programmatically using noise algorithms, gradients, and mathematical patterns.',
    syntax: 'ProceduralTexture tex(512, 512);\ntex.fbmNoise(6, 2.0f, 0.5f);',
    example: `ProceduralTexture tex(512, 512);

void onCreate() override {
    // Fill with FBM noise
    tex.fbmNoise(6, 2.0f, 0.5f);  // octaves, lacunarity, persistence
    tex.upload();
}

void onDraw(Graphics& g) override {
    tex.bind(0);
    g.draw(mesh);
}`,
    platforms: ['web'],
    relatedTerms: ['Texture', 'WebImage', 'MipmapTexture'],
  },
  {
    term: 'MipmapTexture',
    category: 'studio',
    definition: 'Texture with automatic mipmap generation for continuous LOD. Uploads a single high-resolution texture and generates mipmaps on the GPU, then uses textureLod() in shaders for smooth continuous LOD.',
    syntax: 'MipmapTexture tex;\ntex.load("/assets/textures/brick_4k.jpg");',
    example: `MipmapTexture tex;

void onCreate() override {
    tex.load("/assets/textures/brick_4k.jpg");
    tex.setReferenceDistance(5.0f);  // Full quality at 5 units
}

void onDraw(Graphics& g) override {
    float dist = (nav().pos() - objectPos).mag();
    float lod = tex.calculateLOD(dist);  // Continuous 0.0, 0.5, 1.3...

    shader.uniform("u_textureLOD", lod);
    tex.bind(0);
    g.draw(mesh);
}`,
    platforms: ['web'],
    relatedTerms: ['TextureLOD', 'ProceduralTexture', 'autoLOD'],
  },
  {
    term: 'Asset',
    category: 'studio',
    definition: 'Any loadable resource in the asset library: textures, meshes, environments, fonts, sounds, etc. Assets have loading states (idle, loading, ready, error), priorities, and can be preloaded.',
    syntax: 'const asset = assetLibrary.getAsset("bunny-mesh");',
    example: `// Asset library in Vue frontend
const assetStore = useAssetLibraryStore();

// Load single asset
await assetStore.loadAsset("brick-texture");

// Load by tag
await assetStore.loadAssetsByTag("essential");

// Check loading state
const state = assetStore.getLoadingState("brick-texture");
if (state === "ready") {
    // Use asset
}`,
    platforms: ['web'],
    relatedTerms: ['preloadAssets', 'AssetPriority'],
  },
  {
    term: 'preloadAssets',
    category: 'studio',
    definition: 'Preloads all assets marked with preload: true. Returns progress events for loading UI. Uses concurrent loading with configurable concurrency limit.',
    syntax: 'await assetStore.preloadAssets();',
    example: `// Preload essential assets before app starts
const assetStore = useAssetLibraryStore();

// Check loading progress
const stats = assetStore.loadingStats;
console.log(\`Progress: \${stats.progress}%\`);
console.log(\`\${stats.ready}/\${stats.total} assets loaded\`);

// Preload with progress
await assetStore.preloadAssets();`,
    platforms: ['web'],
    relatedTerms: ['Asset', 'AssetPriority', 'loadAssetsByTag'],
  },
  {
    term: 'AssetPriority',
    category: 'studio',
    definition: 'Loading priority levels for assets: critical (load first), high, normal, low. Critical assets block app start, low priority assets load in background.',
    syntax: "priority: 'critical' | 'high' | 'normal' | 'low'",
    example: `// In asset library definition
{
    id: 'main-environment',
    name: 'Studio HDR',
    type: 'environment',
    priority: 'critical',  // Load before anything else
    preload: true,
}`,
    platforms: ['web'],
    relatedTerms: ['Asset', 'preloadAssets'],
  },
  {
    term: 'native_compat',
    category: 'studio',
    definition: 'Native compatibility layer providing desktop equivalents of AlloLib Studio web headers. Allows Studio code to run on native AlloLib with identical APIs.',
    syntax: '#include "native_compat/al_StudioCompat.hpp"',
    example: `// Include all native compat headers
#include "native_compat/al_StudioCompat.hpp"

// Or include individually:
#include "native_compat/al_NativeOBJ.hpp"
#include "native_compat/al_NativeHDR.hpp"
#include "native_compat/al_NativeEnvironment.hpp"
#include "native_compat/al_NativeLOD.hpp"
#include "native_compat/al_NativeQuality.hpp"

// Types are aliased: WebOBJ = NativeOBJ, etc.`,
    platforms: ['native'],
    relatedTerms: ['WebOBJ', 'WebHDR', 'WebEnvironment'],
  },
]

// Helper function to get entries by category
export function getEntriesByCategory(categoryId: string): GlossaryEntry[] {
  return glossary.filter(entry => entry.category === categoryId)
}

// Helper function to search glossary
export function searchGlossary(query: string): GlossaryEntry[] {
  const lowerQuery = query.toLowerCase()
  return glossary.filter(entry =>
    entry.term.toLowerCase().includes(lowerQuery) ||
    entry.definition.toLowerCase().includes(lowerQuery) ||
    entry.syntax?.toLowerCase().includes(lowerQuery)
  )
}

// Helper function to get related entries
export function getRelatedEntries(term: string): GlossaryEntry[] {
  const entry = glossary.find(e => e.term === term)
  if (!entry?.relatedTerms) return []
  return glossary.filter(e => entry.relatedTerms!.includes(e.term))
}

// Get all unique platforms
export function getPlatformFilter(): string[] {
  return ['both', 'native', 'web']
}
