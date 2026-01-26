<script setup lang="ts">
defineProps<{
  isRunning: boolean
}>()

const emit = defineEmits<{
  run: []
  stop: []
}>()
</script>

<template>
  <header class="h-12 bg-editor-sidebar border-b border-editor-border flex items-center px-4 gap-4">
    <!-- Logo -->
    <div class="flex items-center gap-2">
      <span class="text-allolib-blue font-semibold">AlloLib Studio</span>
      <span class="text-gray-500 text-sm">Online</span>
    </div>

    <!-- Run/Stop Button -->
    <button
      v-if="!isRunning"
      class="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors"
      @click="emit('run')"
    >
      Run
    </button>
    <button
      v-else
      class="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
      @click="emit('stop')"
    >
      Stop
    </button>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Right side actions -->
    <button class="px-3 py-1.5 hover:bg-editor-active rounded text-sm transition-colors">
      Examples
    </button>
    <button class="px-3 py-1.5 hover:bg-editor-active rounded text-sm transition-colors">
      Settings
    </button>
  </header>
</template>
