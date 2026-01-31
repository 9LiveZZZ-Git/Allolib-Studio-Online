<!--
  AudioTrackLane.vue

  Individual track lane for audio/synth tracks.
  Shows clip rectangles, volume automation, and mute/solo controls.
-->
<template>
  <div class="track-lane" :style="laneStyle">
    <!-- Track Header -->
    <div class="track-header" :style="{ width: `${headerWidth}px` }">
      <div class="track-info">
        <span class="track-icon">♫</span>
        <span class="track-name" :title="track.name">{{ track.name }}</span>
      </div>
      <div class="track-controls">
        <button
          class="ctrl-btn"
          :class="{ active: track.muted }"
          @click="toggleMute"
          title="Mute"
        >M</button>
        <button
          class="ctrl-btn"
          :class="{ active: track.solo }"
          @click="toggleSolo"
          title="Solo"
        >S</button>
      </div>
    </div>

    <!-- Track Content -->
    <div class="track-content" ref="contentRef">
      <canvas ref="canvasRef" class="track-canvas" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useSequencerStore, type ArrangementTrack, type ClipInstance, type SequencerClip } from '@/stores/sequencer'

const props = defineProps<{
  track: ArrangementTrack
  zoom: number
  scrollX: number
  headerWidth: number
  categoryColor: string
}>()

const sequencer = useSequencerStore()

const contentRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()

const TRACK_HEIGHT = 48

const laneStyle = computed(() => ({
  '--category-color': props.categoryColor,
}))

// Get clip instances for this track
const clipInstances = computed(() => sequencer.getClipInstancesForTrack(props.track.id))

// Get full clip data for each instance
interface ClipWithPosition {
  clip: SequencerClip
  startTime: number
  duration: number
}

const clipsWithPosition = computed((): ClipWithPosition[] => {
  return clipInstances.value
    .map(inst => {
      const clip = sequencer.getClip(inst.clipId)
      if (!clip) return null
      return {
        clip,
        startTime: inst.startTime,
        duration: clip.duration,
      }
    })
    .filter((c): c is ClipWithPosition => c !== null)
})

function toggleMute() {
  sequencer.toggleTrackMute(props.track.id)
}

function toggleSolo() {
  sequencer.toggleTrackSolo(props.track.id)
}

function draw() {
  const canvas = canvasRef.value
  const container = contentRef.value
  if (!canvas || !container) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = container.getBoundingClientRect()

  canvas.width = rect.width * dpr
  canvas.height = TRACK_HEIGHT * dpr
  canvas.style.height = `${TRACK_HEIGHT}px`
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = TRACK_HEIGHT

  // Clear
  ctx.clearRect(0, 0, width, height)

  // Draw clips
  for (const { clip, startTime, duration } of clipsWithPosition.value) {
    const x = (startTime * props.zoom) - props.scrollX
    const w = duration * props.zoom

    // Skip if not visible
    if (x + w < 0 || x > width) continue

    // Clip background
    ctx.fillStyle = props.track.muted
      ? 'rgba(100, 100, 100, 0.3)'
      : hexToRgba(props.categoryColor, 0.4)
    ctx.fillRect(x, 4, w, height - 8)

    // Clip border
    ctx.strokeStyle = props.track.muted
      ? 'rgba(100, 100, 100, 0.5)'
      : hexToRgba(props.categoryColor, 0.8)
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, 4.5, w - 1, height - 9)

    // Clip name
    ctx.fillStyle = props.track.muted
      ? 'rgba(255, 255, 255, 0.3)'
      : 'rgba(255, 255, 255, 0.8)'
    ctx.font = '10px Inter, sans-serif'
    ctx.textBaseline = 'top'
    const clipName = clip.name || 'Clip'
    const textWidth = ctx.measureText(clipName).width
    if (textWidth < w - 8) {
      ctx.fillText(clipName, x + 4, 8)
    }

    // Waveform preview (simplified)
    if (w > 30) {
      ctx.strokeStyle = props.track.muted
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      const midY = height / 2
      for (let i = 0; i < w - 8; i += 4) {
        const amp = Math.sin(i * 0.1) * 8 + Math.sin(i * 0.23) * 4
        if (i === 0) {
          ctx.moveTo(x + 4 + i, midY + amp)
        } else {
          ctx.lineTo(x + 4 + i, midY + amp)
        }
      }
      ctx.stroke()
    }
  }

  // Bottom border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, height - 0.5)
  ctx.lineTo(width, height - 0.5)
  ctx.stroke()
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  draw()

  resizeObserver = new ResizeObserver(draw)
  if (contentRef.value) {
    resizeObserver.observe(contentRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch([() => props.zoom, () => props.scrollX, () => clipsWithPosition.value, () => props.track.muted], draw)
</script>

<style scoped>
.track-lane {
  display: flex;
  height: 48px;
  background: rgba(0, 0, 0, 0.1);
}

.track-lane:hover {
  background: rgba(255, 255, 255, 0.02);
}

.track-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  background: rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.track-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.track-icon {
  color: var(--category-color);
  font-size: 12px;
}

.track-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-controls {
  display: flex;
  gap: 2px;
}

.ctrl-btn {
  width: 18px;
  height: 18px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 9px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.ctrl-btn.active {
  background: rgba(246, 173, 85, 0.3);
  border-color: rgba(246, 173, 85, 0.5);
  color: #F6AD55;
}

.track-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.track-canvas {
  width: 100%;
  height: 100%;
}
</style>
