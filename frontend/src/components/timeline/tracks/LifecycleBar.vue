<!--
  LifecycleBar.vue

  Visualizes an object's lifecycle from spawn to destroy.
  Draggable endpoints to adjust spawn/destroy times.
-->
<template>
  <div
    class="lifecycle-bar"
    :style="barStyle"
    @mousedown="startDragBar"
  >
    <!-- Spawn handle -->
    <div
      class="lifecycle-handle spawn-handle"
      :class="{ dragging: draggingHandle === 'spawn' }"
      @mousedown.stop="startDragHandle($event, 'spawn')"
      title="Drag to adjust spawn time"
    >
      <svg width="8" height="12" viewBox="0 0 8 12">
        <path d="M0 0L8 6L0 12V0Z" fill="currentColor" />
      </svg>
    </div>

    <!-- Bar content -->
    <div class="bar-content">
      <span class="bar-label" v-if="showLabel && barWidth > 60">
        {{ formatDuration(duration) }}
      </span>
    </div>

    <!-- Destroy handle -->
    <div
      class="lifecycle-handle destroy-handle"
      :class="{ dragging: draggingHandle === 'destroy' }"
      @mousedown.stop="startDragHandle($event, 'destroy')"
      title="Drag to adjust destroy time"
    >
      <svg width="8" height="12" viewBox="0 0 8 12">
        <path d="M8 0L0 6L8 12V0Z" fill="currentColor" />
      </svg>
    </div>

    <!-- Resize hint lines -->
    <div class="resize-lines left" v-if="draggingHandle === 'spawn'" />
    <div class="resize-lines right" v-if="draggingHandle === 'destroy'" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

const props = defineProps<{
  spawnTime: number
  destroyTime: number
  zoom: number
  scrollX: number
  color: string
  minDuration?: number
  showLabel?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:spawnTime', time: number): void
  (e: 'update:destroyTime', time: number): void
  (e: 'move', deltaTime: number): void
}>()

const draggingHandle = ref<'spawn' | 'destroy' | 'bar' | null>(null)
const dragStartX = ref(0)
const dragStartTime = ref(0)

const minDur = computed(() => props.minDuration ?? 0.1)

const duration = computed(() => props.destroyTime - props.spawnTime)

const barWidth = computed(() => duration.value * props.zoom)

const barStyle = computed(() => {
  const x = (props.spawnTime * props.zoom) - props.scrollX
  return {
    left: `${x}px`,
    width: `${barWidth.value}px`,
    '--bar-color': props.color,
    '--bar-color-light': hexToRgba(props.color, 0.3),
    '--bar-color-medium': hexToRgba(props.color, 0.6),
  }
})

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function formatDuration(seconds: number): string {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(0)
  return `${mins}:${secs.padStart(2, '0')}`
}

function startDragHandle(e: MouseEvent, handle: 'spawn' | 'destroy') {
  draggingHandle.value = handle
  dragStartX.value = e.clientX
  dragStartTime.value = handle === 'spawn' ? props.spawnTime : props.destroyTime

  window.addEventListener('mousemove', onDragHandle)
  window.addEventListener('mouseup', stopDrag)
}

function startDragBar(e: MouseEvent) {
  draggingHandle.value = 'bar'
  dragStartX.value = e.clientX
  dragStartTime.value = props.spawnTime

  window.addEventListener('mousemove', onDragBar)
  window.addEventListener('mouseup', stopDrag)
}

function onDragHandle(e: MouseEvent) {
  if (!draggingHandle.value || draggingHandle.value === 'bar') return

  const deltaX = e.clientX - dragStartX.value
  const deltaTime = deltaX / props.zoom
  const newTime = Math.max(0, dragStartTime.value + deltaTime)

  if (draggingHandle.value === 'spawn') {
    // Don't allow spawn to go past destroy - minDuration
    const maxSpawn = props.destroyTime - minDur.value
    emit('update:spawnTime', Math.min(newTime, maxSpawn))
  } else {
    // Don't allow destroy to go before spawn + minDuration
    const minDestroy = props.spawnTime + minDur.value
    emit('update:destroyTime', Math.max(newTime, minDestroy))
  }
}

function onDragBar(e: MouseEvent) {
  if (draggingHandle.value !== 'bar') return

  const deltaX = e.clientX - dragStartX.value
  const deltaTime = deltaX / props.zoom

  emit('move', deltaTime)
}

function stopDrag() {
  draggingHandle.value = null
  window.removeEventListener('mousemove', onDragHandle)
  window.removeEventListener('mousemove', onDragBar)
  window.removeEventListener('mouseup', stopDrag)
}

onUnmounted(() => {
  stopDrag()
})
</script>

<style scoped>
.lifecycle-bar {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 20px;
  min-width: 20px;
  background: var(--bar-color-light);
  border: 1px solid var(--bar-color-medium);
  border-radius: 4px;
  cursor: move;
  display: flex;
  align-items: center;
  transition: box-shadow 0.15s;
}

.lifecycle-bar:hover {
  box-shadow: 0 0 0 1px var(--bar-color);
}

.bar-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0 12px;
}

.bar-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

.lifecycle-handle {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ew-resize;
  color: var(--bar-color);
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}

.lifecycle-bar:hover .lifecycle-handle,
.lifecycle-handle.dragging {
  opacity: 1;
}

.lifecycle-handle:hover,
.lifecycle-handle.dragging {
  color: #fff;
}

.spawn-handle {
  left: -6px;
}

.destroy-handle {
  right: -6px;
}

.resize-lines {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: repeating-linear-gradient(
    to bottom,
    var(--bar-color) 0px,
    var(--bar-color) 2px,
    transparent 2px,
    transparent 4px
  );
}

.resize-lines.left {
  left: 0;
}

.resize-lines.right {
  right: 0;
}
</style>
