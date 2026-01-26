<script setup lang="ts">
import { ref, onMounted } from 'vue'

const editorContainer = ref<HTMLDivElement>()
const code = ref(`#include "al/app/al_App.hpp"

using namespace al;

struct MyApp : App {
  void onCreate() override {
    // Initialize your application
  }

  void onAnimate(double dt) override {
    // Update animation
  }

  void onDraw(Graphics& g) override {
    g.clear(0.1f);
    // Draw your scene
  }
};

int main() {
  MyApp app;
  app.start();
  return 0;
}
`)

onMounted(async () => {
  // Monaco editor will be initialized here
  // For now, using a simple textarea as placeholder
})
</script>

<template>
  <div class="h-full flex flex-col bg-editor-bg">
    <div class="h-8 bg-editor-sidebar border-b border-editor-border flex items-center px-3">
      <span class="text-sm text-gray-400">main.cpp</span>
    </div>
    <div ref="editorContainer" class="flex-1 overflow-hidden">
      <!-- Monaco editor will be mounted here -->
      <textarea
        v-model="code"
        class="w-full h-full bg-editor-bg text-gray-300 p-4 font-mono text-sm resize-none outline-none"
        spellcheck="false"
      />
    </div>
  </div>
</template>
