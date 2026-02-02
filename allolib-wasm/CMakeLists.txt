# AlloLib WASM Build Configuration
# Compiles AlloLib for WebAssembly using Emscripten
# Supports dual backends: WebGL2 (default) and WebGPU

cmake_minimum_required(VERSION 3.20)
project(allolib-wasm)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ==============================================================================
# Backend Selection Options
# ==============================================================================

option(ALLOLIB_BACKEND_WEBGL2 "Build with WebGL2 backend (default, maximum compatibility)" ON)
option(ALLOLIB_BACKEND_WEBGPU "Build with WebGPU backend (compute shaders, modern features)" OFF)

# Validate at least one backend is selected
if(NOT ALLOLIB_BACKEND_WEBGL2 AND NOT ALLOLIB_BACKEND_WEBGPU)
    message(FATAL_ERROR "At least one backend must be enabled: ALLOLIB_BACKEND_WEBGL2 or ALLOLIB_BACKEND_WEBGPU")
endif()

# Paths
set(ALLOLIB_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../allolib")
set(GAMMA_DIR "${ALLOLIB_DIR}/external/Gamma")

# Verify we're using Emscripten
if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "This project must be built with Emscripten. Use 'emcmake cmake ..'")
endif()

message(STATUS "Building AlloLib for WebAssembly")
message(STATUS "AlloLib directory: ${ALLOLIB_DIR}")
message(STATUS "Backend: WebGL2=${ALLOLIB_BACKEND_WEBGL2}, WebGPU=${ALLOLIB_BACKEND_WEBGPU}")

# ==============================================================================
# Emscripten Configuration
# ==============================================================================

# Base compile flags (common to both backends)
set(EMSCRIPTEN_COMPILE_FLAGS
    "-sUSE_GLFW=3"
)

# Base link flags for applications
set(EMSCRIPTEN_LINK_FLAGS
    "-sUSE_GLFW=3"
    "-sALLOW_MEMORY_GROWTH=1"
    "-sEXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString','stringToUTF8']"
    "-sEXPORTED_FUNCTIONS=['_main','_malloc','_free','_allolib_configure_backend']"
    "-sMODULARIZE=1"
    "-sEXPORT_ES6=1"
    "-sENVIRONMENT='web'"
    "-sASYNCIFY=1"
    "-sASYNCIFY_STACK_SIZE=65536"
    "--bind"
)

# Backend-specific flags
if(ALLOLIB_BACKEND_WEBGPU)
    message(STATUS "Configuring WebGPU backend")
    list(APPEND EMSCRIPTEN_COMPILE_FLAGS "-sUSE_WEBGPU=1")
    list(APPEND EMSCRIPTEN_LINK_FLAGS "-sUSE_WEBGPU=1")
    # Note: WebGPU builds still need WebGL2 for fallback/compatibility layers
    list(APPEND EMSCRIPTEN_COMPILE_FLAGS "-sUSE_WEBGL2=1" "-sFULL_ES3=1")
    list(APPEND EMSCRIPTEN_LINK_FLAGS "-sUSE_WEBGL2=1" "-sFULL_ES3=1")
else()
    # Pure WebGL2 build (no WebGPU)
    message(STATUS "Configuring WebGL2 backend (no WebGPU)")
    list(APPEND EMSCRIPTEN_COMPILE_FLAGS "-sUSE_WEBGL2=1" "-sFULL_ES3=1")
    list(APPEND EMSCRIPTEN_LINK_FLAGS "-sUSE_WEBGL2=1" "-sFULL_ES3=1")
endif()

string(REPLACE ";" " " EMSCRIPTEN_COMPILE_FLAGS_STR "${EMSCRIPTEN_COMPILE_FLAGS}")
string(REPLACE ";" " " EMSCRIPTEN_LINK_FLAGS_STR "${EMSCRIPTEN_LINK_FLAGS}")

# ==============================================================================
# Build Gamma DSP Library
# ==============================================================================

# Gamma sources - exclude AudioIO.cpp, Recorder.cpp, SoundFile.cpp which need PortAudio/libsndfile
set(GAMMA_SOURCES
    ${GAMMA_DIR}/src/Conversion.cpp
    ${GAMMA_DIR}/src/DFT.cpp
    ${GAMMA_DIR}/src/Domain.cpp
    ${GAMMA_DIR}/src/FFT_fftpack.cpp
    ${GAMMA_DIR}/src/Print.cpp
    ${GAMMA_DIR}/src/Scheduler.cpp
    ${GAMMA_DIR}/src/Timer.cpp
    ${GAMMA_DIR}/src/arr.cpp
    ${GAMMA_DIR}/src/fftpack++1.cpp
    ${GAMMA_DIR}/src/fftpack++2.cpp
    ${GAMMA_DIR}/src/scl.cpp
)

add_library(Gamma STATIC ${GAMMA_SOURCES})

target_include_directories(Gamma PUBLIC
    "${GAMMA_DIR}"
)

target_compile_options(Gamma PRIVATE
    -Wno-deprecated-declarations
    -Wno-unused-variable
    ${EMSCRIPTEN_COMPILE_FLAGS}
)

set_target_properties(Gamma PROPERTIES
    CXX_STANDARD 17
)

# ==============================================================================
# Build AlloLib Core (Web-compatible subset)
# ==============================================================================

# Core AlloLib sources that work with Emscripten
set(ALLOLIB_SOURCES
    # External - glad OpenGL loader
    ${ALLOLIB_DIR}/external/glad/src/glad.c

    # IO (audio data handling)
    ${ALLOLIB_DIR}/src/io/al_AudioIOData.cpp
    ${ALLOLIB_DIR}/src/io/al_Window.cpp
    ${ALLOLIB_DIR}/src/io/al_WindowGLFW.cpp
    ${ALLOLIB_DIR}/src/io/al_ControlNav.cpp

    # Graphics
    ${ALLOLIB_DIR}/src/graphics/al_BufferObject.cpp
    # NOTE: al_DefaultShaders.cpp and al_DefaultShaderString.cpp are replaced by web versions
    # NOTE: al_Graphics.cpp is replaced by al_Graphics_Web.cpp (WebGL2/WebGPU support)
    ${ALLOLIB_DIR}/src/graphics/al_EasyFBO.cpp
    ${ALLOLIB_DIR}/src/graphics/al_EasyVAO.cpp
    ${ALLOLIB_DIR}/src/graphics/al_FBO.cpp
    ${ALLOLIB_DIR}/src/graphics/al_GPUObject.cpp
    # ${ALLOLIB_DIR}/src/graphics/al_Graphics.cpp  # Replaced by web version
    ${ALLOLIB_DIR}/src/graphics/al_Isosurface.cpp
    ${ALLOLIB_DIR}/src/graphics/al_Lens.cpp
    ${ALLOLIB_DIR}/src/graphics/al_Light.cpp
    ${ALLOLIB_DIR}/src/graphics/al_Mesh.cpp
    # ${ALLOLIB_DIR}/src/graphics/al_OpenGL.cpp  # Replaced by al_OpenGL_Web.cpp
    ${ALLOLIB_DIR}/src/graphics/al_RenderManager.cpp
    ${ALLOLIB_DIR}/src/graphics/al_Shader.cpp
    ${ALLOLIB_DIR}/src/graphics/al_Shapes.cpp
    # ${ALLOLIB_DIR}/src/graphics/al_Texture.cpp  # Replaced by al_Texture_Web.cpp (WebGPU texture bridge)
    ${ALLOLIB_DIR}/src/graphics/al_VAO.cpp
    ${ALLOLIB_DIR}/src/graphics/al_VAOMesh.cpp
    ${ALLOLIB_DIR}/src/graphics/al_Viewpoint.cpp
    ${ALLOLIB_DIR}/src/graphics/al_stb_image.cpp

    # IO (web-compatible only)
    ${ALLOLIB_DIR}/src/io/al_ControlNav.cpp
    ${ALLOLIB_DIR}/src/io/al_Window.cpp
    ${ALLOLIB_DIR}/src/io/al_WindowGLFW.cpp

    # Math
    ${ALLOLIB_DIR}/src/math/al_StdRandom.cpp

    # Scene
    ${ALLOLIB_DIR}/src/scene/al_DynamicScene.cpp
    ${ALLOLIB_DIR}/src/scene/al_PolySynth.cpp
    ${ALLOLIB_DIR}/src/scene/al_PositionedVoice.cpp
    ${ALLOLIB_DIR}/src/scene/al_SynthSequencer.cpp
    ${ALLOLIB_DIR}/src/scene/al_SynthVoice.cpp

    # Sound
    ${ALLOLIB_DIR}/src/sound/al_Ambisonics.cpp
    ${ALLOLIB_DIR}/src/sound/al_Biquad.cpp
    ${ALLOLIB_DIR}/src/sound/al_Dbap.cpp
    ${ALLOLIB_DIR}/src/sound/al_DownMixer.cpp
    ${ALLOLIB_DIR}/src/sound/al_Lbap.cpp
    ${ALLOLIB_DIR}/src/sound/al_Spatializer.cpp
    ${ALLOLIB_DIR}/src/sound/al_Speaker.cpp
    ${ALLOLIB_DIR}/src/sound/al_SpeakerAdjustment.cpp
    ${ALLOLIB_DIR}/src/sound/al_StereoPanner.cpp
    ${ALLOLIB_DIR}/src/sound/al_Vbap.cpp

    # Spatial
    ${ALLOLIB_DIR}/src/spatial/al_HashSpace.cpp
    ${ALLOLIB_DIR}/src/spatial/al_Pose.cpp

    # System (minimal)
    ${ALLOLIB_DIR}/src/system/al_PeriodicThread.cpp
    ${ALLOLIB_DIR}/src/system/al_Printing.cpp
    ${ALLOLIB_DIR}/src/system/al_Time.cpp

    # Types
    ${ALLOLIB_DIR}/src/types/al_Color.cpp
    ${ALLOLIB_DIR}/src/types/al_VariantValue.cpp

    # UI (minimal - no imgui for now)
    ${ALLOLIB_DIR}/src/ui/al_Parameter.cpp
    ${ALLOLIB_DIR}/src/ui/al_ParameterBundle.cpp
)

# Web-specific sources (replacing desktop-only implementations)
set(WEB_SOURCES
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebAudioBackend.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebApp.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_DefaultShaderString_Web.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_DefaultShaders_Web.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_Demangle_Web.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_OSC_Web.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGL2Extensions.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebControlGUI.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_Graphics_Web.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_OpenGL_Web.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_Texture_Web.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebMeshAdapter.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebShaders.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_GraphicsWebExtension.cpp
)

# WebGL2 backend sources - always included (needed for al::Graphics)
list(APPEND WEB_SOURCES
    ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGL2Backend.cpp
)

# WebGPU backend sources
if(ALLOLIB_BACKEND_WEBGPU)
    list(APPEND WEB_SOURCES
        ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGPUBackend.cpp
    )
    # Future: Add compute infrastructure sources when implemented
    # ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGPUCompute.cpp
    # ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGPUParticles.cpp
    # ${CMAKE_CURRENT_SOURCE_DIR}/src/al_WebGPUFluid.cpp
endif()

add_library(al_web STATIC ${ALLOLIB_SOURCES} ${WEB_SOURCES})

# IMPORTANT: Our patched include directory MUST come first to override AlloLib headers
target_include_directories(al_web PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${ALLOLIB_DIR}/include
    ${ALLOLIB_DIR}/external/glfw/include
    ${ALLOLIB_DIR}/external/glad/include
    ${ALLOLIB_DIR}/external/json/include
    ${ALLOLIB_DIR}/external/stb/stb
    ${GAMMA_DIR}
)

target_compile_definitions(al_web PUBLIC
    AL_AUDIO_DUMMY
    AL_EMSCRIPTEN
    GLFW_INCLUDE_ES3
)

# Backend-specific definitions
# WebGL2 is always available (needed for al::Graphics)
target_compile_definitions(al_web PUBLIC ALLOLIB_WEBGL2=1)

if(ALLOLIB_BACKEND_WEBGPU)
    target_compile_definitions(al_web PUBLIC ALLOLIB_WEBGPU=1)
endif()

target_compile_options(al_web PRIVATE
    -Wno-deprecated-declarations
    -Wno-unused-variable
    -Wno-unused-but-set-variable
    ${EMSCRIPTEN_COMPILE_FLAGS}
)

target_link_libraries(al_web PUBLIC Gamma)

set_target_properties(al_web PROPERTIES
    CXX_STANDARD 17
)

# ==============================================================================
# Example Test Application
# ==============================================================================

option(BUILD_TEST_APP "Build test application" ON)

if(BUILD_TEST_APP)
    add_executable(test_app ${CMAKE_CURRENT_SOURCE_DIR}/src/test_app.cpp)

    target_link_libraries(test_app PRIVATE al_web Gamma)

    set_target_properties(test_app PROPERTIES
        SUFFIX ".js"
        LINK_FLAGS "${EMSCRIPTEN_LINK_FLAGS_STR}"
    )
endif()

# ==============================================================================
# Installation
# ==============================================================================

install(TARGETS al_web Gamma
    ARCHIVE DESTINATION lib
    LIBRARY DESTINATION lib
)

install(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/include/
    DESTINATION include
)

message(STATUS "AlloLib WASM configuration complete")
