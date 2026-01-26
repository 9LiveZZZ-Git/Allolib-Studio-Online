cmake_minimum_required(VERSION 3.20)
project(allolib-wasm)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Emscripten-specific settings
if(EMSCRIPTEN)
  set(CMAKE_EXECUTABLE_SUFFIX ".js")

  # Emscripten compile flags
  set(EMSCRIPTEN_FLAGS
    "-s USE_WEBGL2=1"
    "-s FULL_ES3=1"
    "-s USE_GLFW=3"
    "-s ALLOW_MEMORY_GROWTH=1"
    "-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap']"
    "-s MODULARIZE=1"
    "-s EXPORT_ES6=1"
    "-s ENVIRONMENT='web'"
    "-s ASYNCIFY=1"
  )

  string(REPLACE ";" " " EMSCRIPTEN_FLAGS_STR "${EMSCRIPTEN_FLAGS}")

  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${EMSCRIPTEN_FLAGS_STR}")
  set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} ${EMSCRIPTEN_FLAGS_STR}")
endif()

# Include directories
include_directories(${CMAKE_SOURCE_DIR}/include)

# Source files
set(SOURCES
  src/web_audio_backend.cpp
)

# This will be built when integrating with AlloLib
# add_executable(allolib_wasm ${SOURCES})
