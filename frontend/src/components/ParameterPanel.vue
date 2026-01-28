<script setup lang="ts">
/**
 * Parameter Panel
 *
 * Displays interactive controls for AlloLib parameters.
 * Parameters can be registered from code and controlled via sliders, toggles, etc.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { parameterSystem, type ParameterGroup } from '@/utils/parameter-system'

const props = defineProps<{
  collapsed?: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

// Reactive parameter groups
const groups = ref<ParameterGroup[]>([])

// Expanded group states
const expandedGroups = ref<Set<string>>(new Set(['Audio', 'Graphics', 'General']))

// Update groups from parameter system
function updateGroups() {
  groups.value = parameterSystem.getGrouped()
}

// Subscribe to parameter changes
let unsubscribe: (() => void) | null = null

onMounted(() => {
  updateGroups()
  unsubscribe = parameterSystem.subscribe(() => {
    updateGroups()
  })
})

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe()
})

// Toggle group expansion
function toggleGroup(groupName: string) {
  if (expandedGroups.value.has(groupName)) {
    expandedGroups.value.delete(groupName)
  } else {
    expandedGroups.value.add(groupName)
  }
}

// Handle parameter value change
function handleChange(name: string, event: Event) {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  parameterSystem.set(name, value)
  updateGroups()
}

// Format value for display
function formatValue(value: number, type: string): string {
  if (type === 'int') return Math.round(value).toString()
  if (Math.abs(value) < 0.01) return value.toExponential(2)
  if (Math.abs(value) < 10) return value.toFixed(2)
  return value.toFixed(1)
}

const hasParameters = computed(() => groups.value.length > 0)
</script>

<template>
  <div v-if="hasParameters" class="parameter-panel bg-editor-sidebar border-t border-editor-border">
    <!-- Header -->
    <div
      class="h-8 flex items-center justify-between px-3 cursor-pointer hover:bg-editor-active"
      @click="emit('toggle')"
    >
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-allolib-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <span class="text-sm text-gray-400">Parameters</span>
      </div>
      <svg
        class="w-4 h-4 text-gray-500 transition-transform"
        :class="{ 'rotate-180': !collapsed }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>

    <!-- Content -->
    <div v-if="!collapsed" class="max-h-64 overflow-y-auto">
      <div v-for="group in groups" :key="group.name" class="border-b border-editor-border last:border-b-0">
        <!-- Group Header -->
        <button
          class="w-full px-3 py-1.5 flex items-center justify-between text-sm hover:bg-editor-active"
          @click="toggleGroup(group.name)"
        >
          <span class="text-gray-300">{{ group.name }}</span>
          <svg
            class="w-3 h-3 text-gray-500 transition-transform"
            :class="{ 'rotate-90': expandedGroups.has(group.name) }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <!-- Parameters -->
        <div v-if="expandedGroups.has(group.name)" class="px-3 py-2 space-y-3 bg-editor-bg">
          <div v-for="param in group.parameters" :key="param.name" class="space-y-1">
            <div class="flex items-center justify-between text-xs">
              <label :for="param.name" class="text-gray-400">{{ param.displayName }}</label>
              <span class="text-gray-500 font-mono">{{ formatValue(param.value, param.type) }}</span>
            </div>

            <!-- Slider for float/int -->
            <div v-if="param.type !== 'bool'" class="flex items-center gap-2">
              <input
                :id="param.name"
                type="range"
                :min="param.min"
                :max="param.max"
                :step="param.step"
                :value="param.value"
                @input="handleChange(param.name, $event)"
                class="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-allolib-blue"
              />
            </div>

            <!-- Toggle for bool -->
            <button
              v-else
              @click="parameterSystem.set(param.name, param.value === 0 ? 1 : 0); updateGroups()"
              :class="[
                'w-10 h-5 rounded-full transition-colors relative',
                param.value ? 'bg-allolib-blue' : 'bg-gray-600'
              ]"
            >
              <span
                :class="[
                  'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                  param.value ? 'left-5' : 'left-0.5'
                ]"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.parameter-panel input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #58a6ff;
  cursor: pointer;
}

.parameter-panel input[type="range"]::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #58a6ff;
  cursor: pointer;
  border: none;
}
</style>
