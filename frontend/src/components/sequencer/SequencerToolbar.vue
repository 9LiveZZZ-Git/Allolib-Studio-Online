<script setup lang="ts">
import { computed } from 'vue'
import { useSequencerStore, type EditMode, type SnapMode, type ViewMode } from '@/stores/sequencer'

const sequencer = useSequencerStore()

const emit = defineEmits<{
  'toggle-sidebar': []
}>()

defineProps<{
  showSidebar: boolean
}>()

const timeDisplayText = computed(() => {
  const t = sequencer.playheadPosition
  if (sequencer.timeDisplay === 'beats') {
    const beat = (t / sequencer.beatDuration) + 1
    const bar = Math.floor((beat - 1) / 4) + 1
    const beatInBar = ((beat - 1) % 4) + 1
    return `${bar}:${beatInBar.toFixed(1)}`
  }
  const mins = Math.floor(t / 60)
  const secs = t % 60
  return `${mins}:${secs.toFixed(2).padStart(5, '0')}`
})

function setEditMode(mode: EditMode) {
  sequencer.editMode = mode
}

function setSnapMode(mode: SnapMode) {
  sequencer.snapMode = mode
}

function setViewMode(mode: ViewMode) {
  sequencer.viewMode = mode
}

function toggleTimeDisplay() {
  sequencer.timeDisplay = sequencer.timeDisplay === 'seconds' ? 'beats' : 'seconds'
}

// Octave filter options for 3D lattice
const octaveOptions = computed(() => {
  const k = sequencer.latticeRangeK
  const opts: Array<{ value: number | null; label: string }> = [{ value: null, label: 'All' }]
  for (let i = -k; i <= k; i++) {
    opts.push({ value: i, label: `${i >= 0 ? '+' : ''}${i}` })
  }
  return opts
})
</script>

<template>
  <div class="h-9 bg-editor-sidebar border-b border-editor-border flex items-center gap-1 px-2 shrink-0 select-none">
    <!-- ═══ GLOBAL: Transport controls ═══ -->
    <div class="flex items-center gap-0.5">
      <!-- Stop -->
      <button
        @click="sequencer.stop()"
        class="p-1.5 rounded hover:bg-editor-active transition-colors"
        :class="{ 'text-white': sequencer.transport === 'stopped', 'text-gray-400': sequencer.transport !== 'stopped' }"
        title="Stop"
      >
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      </button>

      <!-- Play/Pause -->
      <button
        @click="sequencer.transport === 'playing' ? sequencer.pause() : sequencer.play()"
        class="p-1.5 rounded hover:bg-editor-active transition-colors"
        :class="{
          'text-green-400': sequencer.transport === 'playing',
          'text-yellow-400': sequencer.transport === 'paused',
          'text-gray-300': sequencer.transport === 'stopped'
        }"
        :title="sequencer.transport === 'playing' ? 'Pause' : 'Play'"
      >
        <svg v-if="sequencer.transport === 'playing'" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
        <svg v-else class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
        </svg>
      </button>

      <!-- Loop -->
      <button
        @click="sequencer.toggleLoop()"
        class="p-1.5 rounded hover:bg-editor-active transition-colors"
        :class="{ 'text-allolib-blue': sequencer.loopEnabled, 'text-gray-500': !sequencer.loopEnabled }"
        title="Toggle Loop"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <div class="w-px h-5 bg-editor-border mx-1"></div>

    <!-- ═══ GLOBAL: Time display ═══ -->
    <button
      @click="toggleTimeDisplay"
      class="px-2 py-0.5 text-xs font-mono bg-editor-bg rounded border border-editor-border hover:border-gray-500 transition-colors min-w-[70px] text-center"
      :title="sequencer.timeDisplay === 'seconds' ? 'Click for beats' : 'Click for seconds'"
    >
      {{ timeDisplayText }}
    </button>

    <div class="w-px h-5 bg-editor-border mx-1"></div>

    <!-- ═══ GLOBAL: BPM ═══ -->
    <div class="flex items-center gap-1">
      <label class="text-xs text-gray-400">BPM</label>
      <input
        type="number"
        v-model.number="sequencer.bpm"
        min="20"
        max="300"
        step="1"
        class="w-12 bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:border-allolib-blue"
      />
    </div>

    <div class="w-px h-5 bg-editor-border mx-1"></div>

    <!-- ═══ GLOBAL: View mode tabs ═══ -->
    <div class="flex items-center gap-0.5">
      <button
        @click="setViewMode('clipTimeline')"
        class="px-1.5 py-0.5 text-xs rounded transition-colors"
        :class="sequencer.viewMode === 'clipTimeline' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
        title="Clip Timeline (Arrangement)"
      >
        Clips
      </button>
      <button
        @click="setViewMode('frequencyRoll')"
        class="px-1.5 py-0.5 text-xs rounded transition-colors"
        :class="sequencer.viewMode === 'frequencyRoll' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
        title="Frequency Roll (Clip Editor)"
      >
        Roll
      </button>
      <button
        @click="setViewMode('toneLattice')"
        class="px-1.5 py-0.5 text-xs rounded transition-colors"
        :class="sequencer.viewMode === 'toneLattice' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
        title="Tone Lattice (Clip Editor)"
      >
        Lattice
      </button>
    </div>

    <div class="w-px h-5 bg-editor-border mx-1"></div>

    <!-- ═══ CLIPS VIEW: Snap + Edit mode ═══ -->
    <template v-if="sequencer.viewMode === 'clipTimeline'">
      <!-- Snap mode -->
      <div class="flex items-center gap-1">
        <label class="text-xs text-gray-400">Snap</label>
        <select
          :value="sequencer.snapMode"
          @change="setSnapMode(($event.target as HTMLSelectElement).value as SnapMode)"
          class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs focus:outline-none focus:border-allolib-blue"
        >
          <option value="none">Off</option>
          <option value="beat">Beat</option>
          <option value="half">1/2</option>
          <option value="quarter">1/4</option>
          <option value="eighth">1/8</option>
          <option value="sixteenth">1/16</option>
        </select>
      </div>

      <div class="w-px h-5 bg-editor-border mx-1"></div>

      <!-- Edit mode -->
      <div class="flex items-center gap-0.5">
        <button
          @click="setEditMode('select')"
          class="px-1.5 py-0.5 text-xs rounded transition-colors"
          :class="sequencer.editMode === 'select' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
          title="Select (V)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </button>
        <button
          @click="setEditMode('draw')"
          class="px-1.5 py-0.5 text-xs rounded transition-colors"
          :class="sequencer.editMode === 'draw' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
          title="Draw (D)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          @click="setEditMode('erase')"
          class="px-1.5 py-0.5 text-xs rounded transition-colors"
          :class="sequencer.editMode === 'erase' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
          title="Erase (E)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </template>

    <!-- ═══ ROLL VIEW: Snap + Edit mode + Active clip ═══ -->
    <template v-else-if="sequencer.viewMode === 'frequencyRoll'">
      <!-- Snap mode -->
      <div class="flex items-center gap-1">
        <label class="text-xs text-gray-400">Snap</label>
        <select
          :value="sequencer.snapMode"
          @change="setSnapMode(($event.target as HTMLSelectElement).value as SnapMode)"
          class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs focus:outline-none focus:border-allolib-blue"
        >
          <option value="none">Off</option>
          <option value="beat">Beat</option>
          <option value="half">1/2</option>
          <option value="quarter">1/4</option>
          <option value="eighth">1/8</option>
          <option value="sixteenth">1/16</option>
        </select>
      </div>

      <div class="w-px h-5 bg-editor-border mx-1"></div>

      <!-- Edit mode -->
      <div class="flex items-center gap-0.5">
        <button
          @click="setEditMode('select')"
          class="px-1.5 py-0.5 text-xs rounded transition-colors"
          :class="sequencer.editMode === 'select' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
          title="Select (V)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </button>
        <button
          @click="setEditMode('draw')"
          class="px-1.5 py-0.5 text-xs rounded transition-colors"
          :class="sequencer.editMode === 'draw' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
          title="Draw (D)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          @click="setEditMode('erase')"
          class="px-1.5 py-0.5 text-xs rounded transition-colors"
          :class="sequencer.editMode === 'erase' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
          title="Erase (E)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <!-- Active clip indicator -->
      <div v-if="sequencer.activeClip" class="flex items-center gap-1 ml-2">
        <div class="w-2 h-2 rounded-sm" :style="{ backgroundColor: sequencer.activeClip.color }"></div>
        <span class="text-xs text-gray-300 truncate max-w-[80px]">{{ sequencer.activeClip.name }}</span>
        <button
          @click="setViewMode('clipTimeline')"
          class="text-[10px] text-gray-500 hover:text-white transition-colors px-1"
          title="Back to clips"
        >
          &larr;
        </button>
      </div>
    </template>

    <!-- ═══ LATTICE VIEW: Fundamental, range, 2D/3D, octave filter ═══ -->
    <template v-else-if="sequencer.viewMode === 'toneLattice'">
      <!-- Fundamental -->
      <div class="flex items-center gap-1">
        <label class="text-xs text-gray-400">Fund</label>
        <input
          type="number"
          v-model.number="sequencer.latticeFundamental"
          min="20"
          max="2000"
          step="1"
          class="w-14 bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:border-allolib-blue"
        />
        <span class="text-[10px] text-gray-500">Hz</span>
      </div>

      <div class="w-px h-5 bg-editor-border mx-1"></div>

      <!-- Range -->
      <div class="flex items-center gap-1">
        <label class="text-xs text-gray-400">Range</label>
        <input
          type="number"
          v-model.number="sequencer.latticeRangeI"
          min="1"
          max="6"
          step="1"
          class="w-8 bg-editor-bg border border-editor-border rounded px-0.5 py-0.5 text-xs text-center focus:outline-none focus:border-allolib-blue"
          title="Prime-3 range (fifths)"
        />
      </div>

      <div class="w-px h-5 bg-editor-border mx-1"></div>

      <!-- 2D/3D toggle -->
      <div class="flex items-center gap-0.5">
        <button
          @click="sequencer.latticeMode = '2d'"
          class="px-1.5 py-0.5 text-xs rounded transition-colors"
          :class="sequencer.latticeMode === '2d' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
        >
          2D
        </button>
        <button
          @click="sequencer.latticeMode = '3d'"
          class="px-1.5 py-0.5 text-xs rounded transition-colors"
          :class="sequencer.latticeMode === '3d' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
        >
          3D
        </button>
      </div>

      <!-- Octave filter (3D only) -->
      <template v-if="sequencer.latticeMode === '3d'">
        <div class="w-px h-5 bg-editor-border mx-1"></div>
        <div class="flex items-center gap-1">
          <label class="text-xs text-gray-400">Oct</label>
          <select
            :value="sequencer.latticeOctaveFilter"
            @change="sequencer.latticeOctaveFilter = ($event.target as HTMLSelectElement).value === '' ? null : parseInt(($event.target as HTMLSelectElement).value)"
            class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs focus:outline-none focus:border-allolib-blue"
          >
            <option v-for="opt in octaveOptions" :key="String(opt.value)" :value="opt.value ?? ''">{{ opt.label }}</option>
          </select>
        </div>
      </template>

      <div class="w-px h-5 bg-editor-border mx-1"></div>

      <!-- Interaction mode -->
      <div class="flex items-center gap-0.5">
        <button
          @click="sequencer.latticeInteractionMode = 'note'"
          class="px-1.5 py-0.5 text-xs rounded transition-colors"
          :class="sequencer.latticeInteractionMode === 'note' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
          title="Note mode: click to toggle notes"
        >
          Note
        </button>
        <button
          @click="sequencer.latticeInteractionMode = 'path'"
          class="px-1.5 py-0.5 text-xs rounded transition-colors"
          :class="sequencer.latticeInteractionMode === 'path' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
          title="Path mode: drag to create sequence"
        >
          Path
        </button>
        <button
          @click="sequencer.latticeInteractionMode = 'chord'"
          class="px-1.5 py-0.5 text-xs rounded transition-colors"
          :class="sequencer.latticeInteractionMode === 'chord' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white hover:bg-editor-active'"
          title="Chord mode: click notes then set duration"
        >
          Chord
        </button>
      </div>

      <!-- Poly toggle (path mode only) -->
      <label
        v-if="sequencer.latticeInteractionMode === 'path'"
        class="flex items-center gap-1 ml-1 cursor-pointer"
      >
        <input
          type="checkbox"
          v-model="sequencer.latticePolyPathEnabled"
          class="accent-allolib-blue w-3 h-3"
        />
        <span class="text-xs text-gray-400">Poly</span>
      </label>

      <!-- Chord finalize (chord mode only) -->
      <template v-if="sequencer.latticeInteractionMode === 'chord' && sequencer.latticePendingChord">
        <button
          @click="sequencer.cancelChord()"
          class="px-1 py-0.5 text-xs text-gray-500 hover:text-red-400 ml-1"
        >
          Cancel
        </button>
      </template>

      <!-- Active clip indicator -->
      <div v-if="sequencer.activeClip" class="flex items-center gap-1 ml-2">
        <div class="w-2 h-2 rounded-sm" :style="{ backgroundColor: sequencer.activeClip.color }"></div>
        <span class="text-xs text-gray-300 truncate max-w-[80px]">{{ sequencer.activeClip.name }}</span>
        <button
          @click="setViewMode('clipTimeline')"
          class="text-[10px] text-gray-500 hover:text-white transition-colors px-1"
          title="Back to clips"
        >
          &larr;
        </button>
      </div>
    </template>

    <!-- Spacer -->
    <div class="flex-1"></div>

    <!-- ═══ GLOBAL: Toggle sidebar ═══ -->
    <button
      @click="emit('toggle-sidebar')"
      class="p-1.5 rounded hover:bg-editor-active transition-colors"
      :class="{ 'text-allolib-blue': showSidebar, 'text-gray-500': !showSidebar }"
      title="Toggle Sidebar"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    </button>
  </div>
</template>
