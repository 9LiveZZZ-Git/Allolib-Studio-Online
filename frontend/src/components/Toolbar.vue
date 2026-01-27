<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AppStatus } from '@/stores/app'
import { categories, examples, type Example } from '@/data/examples'

defineProps<{
  status: AppStatus
}>()

const emit = defineEmits<{
  run: []
  stop: []
  loadExample: [code: string]
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

// Examples dropdown state
const showExamples = ref(false)
const expandedCategory = ref<string | null>(null)
const expandedSubcategory = ref<string | null>(null)

function toggleCategory(catId: string) {
  if (expandedCategory.value === catId) {
    expandedCategory.value = null
    expandedSubcategory.value = null
  } else {
    expandedCategory.value = catId
    expandedSubcategory.value = null
  }
}

function toggleSubcategory(subId: string) {
  if (expandedSubcategory.value === subId) {
    expandedSubcategory.value = null
  } else {
    expandedSubcategory.value = subId
  }
}

function getExamplesForSubcategory(catId: string, subId: string): Example[] {
  return examples.filter(e => e.category === catId && e.subcategory === subId)
}

function selectExample(example: Example) {
  emit('loadExample', example.code)
  showExamples.value = false
  expandedCategory.value = null
  expandedSubcategory.value = null
}

function closeDropdown() {
  showExamples.value = false
  expandedCategory.value = null
  expandedSubcategory.value = null
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

    <!-- Examples Dropdown -->
    <div class="relative">
      <button
        class="px-3 py-1.5 hover:bg-editor-active rounded text-sm transition-colors flex items-center gap-1"
        @click="showExamples = !showExamples"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        Examples
        <svg class="w-3 h-3 ml-1" :class="{ 'rotate-180': showExamples }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Dropdown Panel -->
      <div
        v-if="showExamples"
        class="absolute right-0 top-full mt-1 w-80 max-h-[80vh] overflow-y-auto bg-editor-bg border border-editor-border rounded-lg shadow-xl z-50"
      >
        <!-- Header -->
        <div class="sticky top-0 bg-editor-sidebar px-4 py-2 border-b border-editor-border">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Example Code</span>
            <button @click="closeDropdown" class="text-gray-400 hover:text-white">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Categories -->
        <div class="py-1">
          <div v-for="category in categories" :key="category.id" class="border-b border-editor-border last:border-b-0">
            <!-- Category Header -->
            <button
              class="w-full px-4 py-2 text-left text-sm font-medium hover:bg-editor-active flex items-center justify-between"
              @click="toggleCategory(category.id)"
            >
              <span>{{ category.title }}</span>
              <svg
                class="w-4 h-4 transition-transform"
                :class="{ 'rotate-90': expandedCategory === category.id }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <!-- Subcategories -->
            <div v-if="expandedCategory === category.id && category.subcategories" class="bg-editor-sidebar">
              <div v-for="sub in category.subcategories" :key="sub.id">
                <!-- Subcategory Header -->
                <button
                  class="w-full pl-6 pr-4 py-1.5 text-left text-sm text-gray-300 hover:bg-editor-active flex items-center justify-between"
                  @click="toggleSubcategory(sub.id)"
                >
                  <span>{{ sub.title }}</span>
                  <svg
                    class="w-3 h-3 transition-transform"
                    :class="{ 'rotate-90': expandedSubcategory === sub.id }"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <!-- Examples in Subcategory -->
                <div v-if="expandedSubcategory === sub.id" class="bg-editor-bg">
                  <button
                    v-for="example in getExamplesForSubcategory(category.id, sub.id)"
                    :key="example.id"
                    class="w-full pl-10 pr-4 py-2 text-left hover:bg-editor-active group"
                    @click="selectExample(example)"
                  >
                    <div class="text-sm text-allolib-blue group-hover:text-white">{{ example.title }}</div>
                    <div class="text-xs text-gray-500 group-hover:text-gray-400">{{ example.description }}</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="sticky bottom-0 bg-editor-sidebar px-4 py-2 border-t border-editor-border">
          <div class="text-xs text-gray-500 text-center">
            {{ examples.length }} examples available
          </div>
        </div>
      </div>

      <!-- Click outside to close -->
      <div
        v-if="showExamples"
        class="fixed inset-0 z-40"
        @click="closeDropdown"
      ></div>
    </div>

    <!-- Settings Button -->
    <button class="px-3 py-1.5 hover:bg-editor-active rounded text-sm transition-colors">
      Settings
    </button>

    <!-- GitHub Link -->
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
