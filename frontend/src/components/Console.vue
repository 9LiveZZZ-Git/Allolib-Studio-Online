<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  output: string[]
}>()

const consoleRef = ref<HTMLDivElement>()

// Auto-scroll to bottom when new output arrives
watch(() => props.output.length, async () => {
  await nextTick()
  if (consoleRef.value) {
    consoleRef.value.scrollTop = consoleRef.value.scrollHeight
  }
})
</script>

<template>
  <div
    ref="consoleRef"
    class="h-full overflow-auto p-3 font-mono text-sm bg-editor-bg"
  >
    <div v-if="output.length === 0" class="text-gray-500">
      Compilation output will appear here...
    </div>
    <div
      v-for="(line, index) in output"
      :key="index"
      class="leading-relaxed"
      :class="{
        'text-red-400': line.includes('[ERROR]'),
        'text-yellow-400': line.includes('[WARN]'),
        'text-green-400': line.includes('[SUCCESS]'),
        'text-gray-300': !line.includes('[ERROR]') && !line.includes('[WARN]') && !line.includes('[SUCCESS]')
      }"
    >
      {{ line }}
    </div>
  </div>
</template>
