<script setup lang="ts">
/**
 * Color Picker Component
 *
 * RGBA color picker with visual preview and sliders.
 * Supports both vec4 [r,g,b,a] and hex string formats.
 */
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: [number, number, number, number] | [number, number, number]
  showAlpha?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: [number, number, number, number] | [number, number, number]]
}>()

const showAlpha = computed(() => props.showAlpha ?? true)

// Internal RGBA values (0-1 range)
const r = computed(() => props.modelValue[0])
const g = computed(() => props.modelValue[1])
const b = computed(() => props.modelValue[2])
const a = computed(() => props.modelValue[3] ?? 1)

// Convert to hex for color input
const hexColor = computed(() => {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(r.value)}${toHex(g.value)}${toHex(b.value)}`
})

// Picker visibility
const showPicker = ref(false)

function updateChannel(channel: 'r' | 'g' | 'b' | 'a', value: number) {
  const newValue = showAlpha.value
    ? [
        channel === 'r' ? value : r.value,
        channel === 'g' ? value : g.value,
        channel === 'b' ? value : b.value,
        channel === 'a' ? value : a.value,
      ] as [number, number, number, number]
    : [
        channel === 'r' ? value : r.value,
        channel === 'g' ? value : g.value,
        channel === 'b' ? value : b.value,
      ] as [number, number, number]
  emit('update:modelValue', newValue)
}

function updateFromHex(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    const nr = parseInt(result[1], 16) / 255
    const ng = parseInt(result[2], 16) / 255
    const nb = parseInt(result[3], 16) / 255
    const newValue = showAlpha.value
      ? [nr, ng, nb, a.value] as [number, number, number, number]
      : [nr, ng, nb] as [number, number, number]
    emit('update:modelValue', newValue)
  }
}

// Preview style
const previewStyle = computed(() => ({
  backgroundColor: `rgba(${r.value * 255}, ${g.value * 255}, ${b.value * 255}, ${a.value})`,
}))

// Format value for display
function formatValue(v: number): string {
  return v.toFixed(2)
}
</script>

<template>
  <div class="color-picker">
    <!-- Color preview button -->
    <div class="flex items-center gap-2">
      <button
        @click="showPicker = !showPicker"
        class="w-8 h-5 rounded border border-imgui-border cursor-pointer"
        :style="previewStyle"
        title="Click to expand color picker"
      >
        <!-- Checkerboard pattern for transparency -->
        <div
          class="w-full h-full rounded"
          style="background-image: linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%); background-size: 8px 8px; background-position: 0 0, 0 4px, 4px -4px, -4px 0px;"
        >
          <div class="w-full h-full rounded" :style="previewStyle"></div>
        </div>
      </button>

      <!-- Native color input (hidden but functional) -->
      <input
        type="color"
        :value="hexColor"
        @input="updateFromHex(($event.target as HTMLInputElement).value)"
        class="w-6 h-5 cursor-pointer border-0 p-0"
        title="Open system color picker"
      />

      <!-- Hex display -->
      <span class="text-xs font-mono text-imgui-value">{{ hexColor.toUpperCase() }}</span>
    </div>

    <!-- Expanded picker -->
    <div v-if="showPicker" class="mt-2 space-y-1.5 p-2 bg-imgui-content rounded border border-imgui-border">
      <!-- R -->
      <div class="flex items-center gap-1">
        <span class="text-xs font-bold w-4 text-red-400">R</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="r"
          @input="updateChannel('r', parseFloat(($event.target as HTMLInputElement).value))"
          class="flex-1 h-3 slider-r"
        />
        <span class="text-xs font-mono w-10 text-right text-imgui-value">{{ formatValue(r) }}</span>
      </div>

      <!-- G -->
      <div class="flex items-center gap-1">
        <span class="text-xs font-bold w-4 text-green-400">G</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="g"
          @input="updateChannel('g', parseFloat(($event.target as HTMLInputElement).value))"
          class="flex-1 h-3 slider-g"
        />
        <span class="text-xs font-mono w-10 text-right text-imgui-value">{{ formatValue(g) }}</span>
      </div>

      <!-- B -->
      <div class="flex items-center gap-1">
        <span class="text-xs font-bold w-4 text-blue-400">B</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="b"
          @input="updateChannel('b', parseFloat(($event.target as HTMLInputElement).value))"
          class="flex-1 h-3 slider-b"
        />
        <span class="text-xs font-mono w-10 text-right text-imgui-value">{{ formatValue(b) }}</span>
      </div>

      <!-- A (optional) -->
      <div v-if="showAlpha" class="flex items-center gap-1">
        <span class="text-xs font-bold w-4 text-gray-400">A</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="a"
          @input="updateChannel('a', parseFloat(($event.target as HTMLInputElement).value))"
          class="flex-1 h-3 slider-a"
        />
        <span class="text-xs font-mono w-10 text-right text-imgui-value">{{ formatValue(a) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-picker input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: #333;
  border-radius: 2px;
  cursor: pointer;
}

.color-picker input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 8px;
  height: 12px;
  border-radius: 2px;
  cursor: grab;
}

.slider-r::-webkit-slider-thumb { background: #f87171; }
.slider-g::-webkit-slider-thumb { background: #4ade80; }
.slider-b::-webkit-slider-thumb { background: #60a5fa; }
.slider-a::-webkit-slider-thumb { background: #9ca3af; }

.color-picker input[type="range"]::-webkit-slider-thumb:active {
  cursor: grabbing;
}

.color-picker input[type="range"]::-moz-range-thumb {
  width: 8px;
  height: 12px;
  border-radius: 2px;
  border: none;
  cursor: grab;
}

.slider-r::-moz-range-thumb { background: #f87171; }
.slider-g::-moz-range-thumb { background: #4ade80; }
.slider-b::-moz-range-thumb { background: #60a5fa; }
.slider-a::-moz-range-thumb { background: #9ca3af; }

/* Color vars */
.bg-imgui-content { background-color: #1a1a1a; }
.border-imgui-border { border-color: #333; }
.text-imgui-value { color: #9cd8ff; }

/* Native color input styling */
input[type="color"] {
  -webkit-appearance: none;
  border: none;
  padding: 0;
}

input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type="color"]::-webkit-color-swatch {
  border: 1px solid #333;
  border-radius: 2px;
}
</style>
