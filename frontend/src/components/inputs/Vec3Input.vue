<script setup lang="ts">
/**
 * Vec3 Input Component
 *
 * Three-value vector input for position, scale, rotation, etc.
 * Supports X, Y, Z labels with individual sliders or number inputs.
 */
import { computed } from 'vue'

const props = defineProps<{
  modelValue: [number, number, number]
  min?: number
  max?: number
  step?: number
  labels?: [string, string, string]
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: [number, number, number]]
}>()

const labels = computed(() => props.labels || ['X', 'Y', 'Z'])
const minVal = computed(() => props.min ?? -1000)
const maxVal = computed(() => props.max ?? 1000)
const stepVal = computed(() => props.step ?? 0.01)

function updateValue(index: number, value: number) {
  const newValue: [number, number, number] = [...props.modelValue] as [number, number, number]
  newValue[index] = value
  emit('update:modelValue', newValue)
}

function formatValue(value: number): string {
  if (Math.abs(value) < 0.001 && value !== 0) return value.toExponential(2)
  if (Math.abs(value) < 10) return value.toFixed(3)
  if (Math.abs(value) < 100) return value.toFixed(2)
  return value.toFixed(1)
}

const colors = ['text-red-400', 'text-green-400', 'text-blue-400']
</script>

<template>
  <div :class="compact ? 'flex gap-1' : 'space-y-1'">
    <div
      v-for="(label, i) in labels"
      :key="i"
      class="flex items-center gap-1"
    >
      <span
        class="text-xs font-bold w-4 text-center"
        :class="colors[i]"
      >
        {{ label }}
      </span>
      <input
        type="range"
        :min="minVal"
        :max="maxVal"
        :step="stepVal"
        :value="modelValue[i]"
        @input="updateValue(i, parseFloat(($event.target as HTMLInputElement).value))"
        class="flex-1 h-4 vec3-slider"
        :class="`slider-${['x', 'y', 'z'][i]}`"
      />
      <input
        type="number"
        :min="minVal"
        :max="maxVal"
        :step="stepVal"
        :value="formatValue(modelValue[i])"
        @change="updateValue(i, parseFloat(($event.target as HTMLInputElement).value))"
        class="w-14 h-5 text-xs bg-imgui-input border border-imgui-border rounded px-1 text-imgui-value font-mono text-right"
      />
    </div>
  </div>
</template>

<style scoped>
.vec3-slider {
  -webkit-appearance: none;
  appearance: none;
  background: #333;
  border-radius: 2px;
  cursor: pointer;
}

.vec3-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 6px;
  height: 14px;
  border-radius: 2px;
  cursor: grab;
}

.slider-x::-webkit-slider-thumb { background: #f87171; }
.slider-y::-webkit-slider-thumb { background: #4ade80; }
.slider-z::-webkit-slider-thumb { background: #60a5fa; }

.vec3-slider::-webkit-slider-thumb:active {
  cursor: grabbing;
}

.vec3-slider::-moz-range-thumb {
  width: 6px;
  height: 14px;
  border-radius: 2px;
  border: none;
  cursor: grab;
}

.slider-x::-moz-range-thumb { background: #f87171; }
.slider-y::-moz-range-thumb { background: #4ade80; }
.slider-z::-moz-range-thumb { background: #60a5fa; }

/* ImGui-style input */
input[type="number"] {
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Color vars */
.bg-imgui-input { background-color: #262626; }
.border-imgui-border { border-color: #333; }
.text-imgui-value { color: #9cd8ff; }
</style>
