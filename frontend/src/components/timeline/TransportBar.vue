<!--
  TransportBar.vue

  Unified transport controls for the timeline.
  Includes play/pause/stop, time display, and mode toggle.
-->
<template>
  <div class="transport-bar">
    <!-- Left: Transport Controls -->
    <div class="transport-controls">
      <button
        class="transport-btn"
        @click="stop"
        title="Stop (Return to start)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <rect x="4" y="4" width="8" height="8" fill="currentColor" rx="1" />
        </svg>
      </button>

      <button
        class="transport-btn play-btn"
        :class="{ playing }"
        @click="togglePlay"
        :title="playing ? 'Pause' : 'Play'"
      >
        <svg v-if="!playing" width="16" height="16" viewBox="0 0 16 16">
          <path d="M5 3L13 8L5 13V3Z" fill="currentColor" />
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 16 16">
          <rect x="4" y="3" width="3" height="10" fill="currentColor" rx="0.5" />
          <rect x="9" y="3" width="3" height="10" fill="currentColor" rx="0.5" />
        </svg>
      </button>

      <button
        class="transport-btn"
        :class="{ active: looping }"
        @click="toggleLoop"
        title="Loop"
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            d="M4 6H10C11.5 6 12.5 7 12.5 8.5C12.5 10 11.5 11 10 11H8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M12 10H6C4.5 10 3.5 9 3.5 7.5C3.5 6 4.5 5 6 5H8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path d="M6 3L8 5L6 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M10 13L8 11L10 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <!-- Edit Mode Controls (always visible, context-aware) -->
    <div class="edit-controls">
      <span class="edit-context-label">{{ editContextLabel }}</span>
      <div class="edit-mode-group">
        <button
          class="edit-btn"
          :class="{ active: sequencer.editMode === 'select' }"
          @click="setEditMode('select')"
          :title="editModeLabels.select"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M3 2L11 6L7 7.5L5.5 12L3 2Z" fill="currentColor" />
          </svg>
        </button>
        <button
          class="edit-btn"
          :class="{ active: sequencer.editMode === 'draw' }"
          @click="setEditMode('draw')"
          :title="editModeLabels.draw"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M10 2L12 4L5 11H3V9L10 2Z" fill="currentColor" />
          </svg>
        </button>
        <button
          class="edit-btn erase"
          :class="{ active: sequencer.editMode === 'erase' }"
          @click="setEditMode('erase')"
          :title="editModeLabels.erase"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M4 4H10V5H4V4ZM5 6V11H9V6H5ZM3 3V5H11V3H3Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div class="snap-control">
        <label>Snap</label>
        <select
          :value="sequencer.snapMode"
          @change="setSnapMode(($event.target as HTMLSelectElement).value as SnapMode)"
        >
          <option value="none">Off</option>
          <option value="beat">Beat</option>
          <option value="half">1/2</option>
          <option value="quarter">1/4</option>
          <option value="eighth">1/8</option>
          <option value="sixteenth">1/16</option>
        </select>
      </div>
    </div>

    <!-- Center: Time Display -->
    <div class="time-display">
      <div class="time-value">
        <span class="time-current">{{ formatTime(currentTime) }}</span>
        <span class="time-separator">/</span>
        <span class="time-duration">{{ formatTime(duration) }}</span>
      </div>
      <div class="bpm-display" v-if="showBPM">
        <input
          type="number"
          class="bpm-input"
          :value="bpm"
          @change="e => $emit('bpm-change', parseFloat((e.target as HTMLInputElement).value))"
          min="20"
          max="300"
          step="1"
        />
        <span class="bpm-label">BPM</span>
      </div>
    </div>

    <!-- Right: Mode Toggle & Actions -->
    <div class="transport-actions">
      <div class="mode-toggle">
        <button
          class="mode-btn"
          :class="{ active: mode === 'animation' }"
          @click="setMode('animation')"
          title="Animation Mode (Linear playback)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <rect x="2" y="5" width="10" height="4" rx="1" fill="currentColor" />
            <circle cx="4" cy="7" r="1.5" fill="var(--bg-color, #1a1a2e)" />
            <circle cx="10" cy="7" r="1.5" fill="var(--bg-color, #1a1a2e)" />
          </svg>
          <span>Anim</span>
        </button>
        <button
          class="mode-btn"
          :class="{ active: mode === 'interactive' }"
          @click="setMode('interactive')"
          title="Interactive Mode (Game-like)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <rect x="3" y="4" width="8" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" />
            <circle cx="5.5" cy="7" r="1" fill="currentColor" />
            <circle cx="9" cy="6" r="0.7" fill="currentColor" />
            <circle cx="10" cy="7.5" r="0.7" fill="currentColor" />
          </svg>
          <span>Game</span>
        </button>
      </div>

      <div class="zoom-controls">
        <button class="zoom-btn" @click="$emit('zoom-out')" title="Zoom out">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
        <span class="zoom-value">{{ Math.round(zoom) }}%</span>
        <button class="zoom-btn" @click="$emit('zoom-in')" title="Zoom in">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <line x1="7" y1="4" x2="7" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSequencerStore, type EditMode, type SnapMode } from '@/stores/sequencer'
import type { TrackCategory } from '@/stores/timeline'

const sequencer = useSequencerStore()

const props = withDefaults(defineProps<{
  playing: boolean
  looping: boolean
  currentTime: number
  duration: number
  mode: 'animation' | 'interactive'
  bpm?: number
  showBPM?: boolean
  zoom: number
  activeTrackType?: TrackCategory | null
}>(), {
  activeTrackType: 'audio',
})

// Context label based on active track type
const editContextLabel = computed(() => {
  if (sequencer.viewMode !== 'clipTimeline') {
    return 'Notes'  // Editing notes in a clip
  }
  switch (props.activeTrackType) {
    case 'audio': return 'Clips'
    case 'objects': return 'Objects'
    case 'environment': return 'Keyframes'
    case 'events': return 'Events'
    default: return 'Items'
  }
})

// Edit mode button labels/tooltips based on context
const editModeLabels = computed(() => {
  const context = editContextLabel.value
  return {
    select: `Select ${context} (V)`,
    draw: `Draw ${context} (D)`,
    erase: `Erase ${context} (E)`,
  }
})

function setEditMode(mode: EditMode) {
  sequencer.editMode = mode
}

function setSnapMode(mode: SnapMode) {
  sequencer.snapMode = mode
}

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'stop'): void
  (e: 'toggle-loop'): void
  (e: 'mode-change', mode: 'animation' | 'interactive'): void
  (e: 'bpm-change', bpm: number): void
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
}>()

function togglePlay() {
  if (props.playing) {
    emit('pause')
  } else {
    emit('play')
  }
}

function stop() {
  emit('stop')
}

function toggleLoop() {
  emit('toggle-loop')
}

function setMode(mode: 'animation' | 'interactive') {
  emit('mode-change', mode)
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.transport-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  background: linear-gradient(to bottom, #2a2a3e, #1e1e2e);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.transport-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.transport-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s;
}

.transport-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.transport-btn.active {
  background: rgba(99, 179, 237, 0.2);
  border-color: rgba(99, 179, 237, 0.4);
  color: #63B3ED;
}

.play-btn {
  width: 36px;
}

.play-btn.playing {
  background: rgba(104, 211, 145, 0.2);
  border-color: rgba(104, 211, 145, 0.4);
  color: #68D391;
}

/* Edit Controls (always visible, context-aware) */
.edit-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.edit-context-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  min-width: 50px;
}

.edit-mode-group {
  display: flex;
  gap: 2px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 2px;
}

.edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.15s;
}

.edit-btn:hover {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.1);
}

.edit-btn.active {
  background: rgba(99, 179, 237, 0.3);
  color: #63B3ED;
}

.edit-btn.erase.active {
  background: rgba(245, 101, 101, 0.3);
  color: #FC8181;
}

.snap-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.snap-control label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
}

.snap-control select {
  height: 24px;
  padding: 0 6px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
}

.snap-control select:focus {
  outline: none;
  border-color: rgba(99, 179, 237, 0.5);
}

/* Time Display */
.time-display {
  display: flex;
  align-items: center;
  gap: 16px;
}

.time-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #fff;
}

.time-current {
  color: #68D391;
}

.time-separator {
  color: rgba(255, 255, 255, 0.3);
  margin: 0 4px;
}

.time-duration {
  color: rgba(255, 255, 255, 0.5);
}

.bpm-display {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bpm-input {
  width: 48px;
  height: 24px;
  padding: 0 6px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  text-align: center;
}

.bpm-input:focus {
  outline: none;
  border-color: rgba(159, 122, 234, 0.5);
}

.bpm-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
}

/* Transport Actions */
.transport-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mode-toggle {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn:hover {
  color: rgba(255, 255, 255, 0.8);
}

.mode-btn.active {
  background: rgba(159, 122, 234, 0.3);
  color: #B794F4;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s;
}

.zoom-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.zoom-value {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  min-width: 36px;
  text-align: center;
}
</style>
