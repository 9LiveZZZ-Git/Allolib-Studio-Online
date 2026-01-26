<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  isRunning: boolean
}>()

const canvasRef = ref<HTMLCanvasElement>()
</script>

<template>
  <div class="h-full flex flex-col bg-black">
    <div class="h-8 bg-editor-sidebar border-b border-editor-border flex items-center px-3 justify-between">
      <span class="text-sm text-gray-400">Output</span>
      <div class="flex items-center gap-2">
        <span v-if="isRunning" class="text-xs text-green-400">Running</span>
        <span v-else class="text-xs text-gray-500">Idle</span>
      </div>
    </div>
    <div class="flex-1 relative">
      <canvas
        ref="canvasRef"
        class="w-full h-full"
      />
      <div
        v-if="!isRunning"
        class="absolute inset-0 flex items-center justify-center text-gray-500"
      >
        <div class="text-center">
          <p class="text-lg">Press Run to start</p>
          <p class="text-sm mt-2">Your AlloLib application will render here</p>
        </div>
      </div>
    </div>
  </div>
</template>
