<script setup lang="ts">
import type { AppStatus } from '@/stores/app'

defineProps<{
  status: AppStatus
}>()

const emit = defineEmits<{
  run: []
  stop: []
}>()

const statusColors: Record<AppStatus, string> = {
  idle: 'text-gray-500',
  compiling: 'text-yellow-400',
  loading: 'text-blue-400',
  running: 'text-green-400',
  error: 'text-red-400',
}

const statusLabels: Record<AppStatus, string> = {
  idle: 'Ready',
  compiling: 'Compiling...',
  loading: 'Loading...',
  running: 'Running',
  error: 'Error',
}
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
      v-if="status === 'idle' || status === 'error'"
      class="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors flex items-center gap-2"
      @click="emit('run')"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
      </svg>
      Run
    </button>
    <button
      v-else-if="status === 'running'"
      class="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors flex items-center gap-2"
      @click="emit('stop')"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <rect x="4" y="4" width="12" height="12" rx="1" />
      </svg>
      Stop
    </button>
    <button
      v-else
      class="px-4 py-1.5 bg-gray-600 rounded text-sm font-medium cursor-not-allowed flex items-center gap-2"
      disabled
    >
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {{ status === 'compiling' ? 'Compiling' : 'Loading' }}
    </button>

    <!-- Status indicator -->
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full" :class="status === 'running' ? 'bg-green-400 animate-pulse' : status === 'error' ? 'bg-red-400' : 'bg-gray-500'"></span>
      <span class="text-xs" :class="statusColors[status]">{{ statusLabels[status] }}</span>
    </div>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Right side actions -->
    <button class="px-3 py-1.5 hover:bg-editor-active rounded text-sm transition-colors">
      Examples
    </button>
    <button class="px-3 py-1.5 hover:bg-editor-active rounded text-sm transition-colors">
      Settings
    </button>
    <a
      href="https://github.com/9LiveZZZ-Git/Allolib-Studio-Online"
      target="_blank"
      class="px-3 py-1.5 hover:bg-editor-active rounded text-sm transition-colors flex items-center gap-1"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      GitHub
    </a>
  </header>
</template>
