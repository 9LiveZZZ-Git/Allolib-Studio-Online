<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  output: string[]
}>()

const emit = defineEmits<{
  resize: [height: number]
}>()

const consoleRef = ref<HTMLDivElement>()
const containerRef = ref<HTMLDivElement>()
const isResizing = ref(false)
const startY = ref(0)
const startHeight = ref(0)

// Auto-scroll to bottom when new output arrives
watch(() => props.output.length, async () => {
  await nextTick()
  if (consoleRef.value) {
    consoleRef.value.scrollTop = consoleRef.value.scrollHeight
  }
})

// Resize handlers
function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  startY.value = e.clientY
  startHeight.value = containerRef.value?.offsetHeight || 200

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(e: MouseEvent) {
  if (!isResizing.value) return

  // Calculate new height (dragging up increases height)
  const delta = startY.value - e.clientY
  const newHeight = Math.max(100, Math.min(600, startHeight.value + delta))

  emit('resize', newHeight)
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<template>
  <div ref="containerRef" class="flex flex-col bg-editor-bg border-t border-editor-border">
    <!-- Resize Handle -->
    <div
      class="h-1 bg-editor-border hover:bg-allolib-blue cursor-ns-resize transition-colors group flex items-center justify-center"
      @mousedown="startResize"
      :class="{ 'bg-allolib-blue': isResizing }"
    >
      <div class="w-12 h-0.5 bg-gray-600 group-hover:bg-white rounded-full transition-colors" :class="{ 'bg-white': isResizing }"></div>
    </div>

    <!-- Header -->
    <div class="h-8 bg-editor-sidebar border-b border-editor-border flex items-center px-3">
      <span class="text-sm text-gray-400">Console</span>
    </div>

    <!-- Content -->
    <div
      ref="consoleRef"
      class="flex-1 overflow-auto p-3 font-mono text-sm"
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
  </div>
</template>
