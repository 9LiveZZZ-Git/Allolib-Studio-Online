<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useSequencerStore } from '@/stores/sequencer'
import { useProjectStore } from '@/stores/project'
import SequencerToolbar from './sequencer/SequencerToolbar.vue'
import ClipTimeline from './sequencer/ClipTimeline.vue'
import SequencerTimeline from './sequencer/SequencerTimeline.vue'
import SequencerSidebar from './sequencer/SequencerSidebar.vue'
import ToneLattice from './sequencer/ToneLattice.vue'

const emit = defineEmits<{
  resize: [height: number]
}>()

defineProps<{
  height: number
}>()

const sequencer = useSequencerStore()
const projectStore = useProjectStore()
const showSidebar = ref(true)

// Resize state
const isResizing = ref(false)
const startY = ref(0)
const startHeight = ref(0)
const containerRef = ref<HTMLDivElement>()

function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  startY.value = e.clientY
  startHeight.value = containerRef.value?.offsetHeight || 300

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(e: MouseEvent) {
  if (!isResizing.value) return
  const delta = startY.value - e.clientY
  const newHeight = Math.max(150, Math.min(600, startHeight.value + delta))
  emit('resize', newHeight)
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// ── Auto-detect synth classes from source files ──────────────────
let synthDetectTimeout: ReturnType<typeof setTimeout> | null = null

const sourceFiles = computed(() =>
  projectStore.project.files
    .filter(f => /\.(cpp|hpp|h)$/i.test(f.path))
    .map(f => ({ name: f.path, content: f.content }))
)

watch(sourceFiles, (files) => {
  // Debounce synth detection to avoid excessive processing
  if (synthDetectTimeout) clearTimeout(synthDetectTimeout)
  synthDetectTimeout = setTimeout(() => {
    sequencer.updateDetectedSynths(files)
  }, 500)
}, { deep: true, immediate: true })

onBeforeUnmount(() => {
  if (synthDetectTimeout) clearTimeout(synthDetectTimeout)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
  sequencer.dispose()
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
      <div
        class="w-12 h-0.5 bg-gray-600 group-hover:bg-white rounded-full transition-colors"
        :class="{ 'bg-white': isResizing }"
      ></div>
    </div>

    <!-- Toolbar -->
    <SequencerToolbar
      :show-sidebar="showSidebar"
      @toggle-sidebar="showSidebar = !showSidebar"
    />

    <!-- Main content area -->
    <div class="flex-1 flex overflow-hidden min-h-0">
      <!-- Clip Timeline / Frequency Roll / Tone Lattice -->
      <ClipTimeline v-if="sequencer.viewMode === 'clipTimeline'" class="flex-1 min-w-0" />
      <SequencerTimeline v-else-if="sequencer.viewMode === 'frequencyRoll'" class="flex-1 min-w-0" />
      <ToneLattice v-else class="flex-1 min-w-0" />

      <!-- Sidebar -->
      <SequencerSidebar
        v-if="showSidebar"
        class="w-52 shrink-0 border-l border-editor-border"
      />
    </div>
  </div>
</template>
