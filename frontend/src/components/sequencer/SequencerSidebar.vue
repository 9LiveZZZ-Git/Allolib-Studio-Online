<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSequencerStore } from '@/stores/sequencer'
import { useProjectStore } from '@/stores/project'

const sequencer = useSequencerStore()
const projectStore = useProjectStore()

// ── Shared state ──────────────────────────────────────────────────

const selectedNotes = computed(() => sequencer.selectedNotes)
const hasSelection = computed(() => selectedNotes.value.length > 0)
const singleNote = computed(() => {
  if (selectedNotes.value.length === 1) return selectedNotes.value[0]
  return null
})

// Default for new notes
const defaultAmplitude = ref(0.5)

// .synthSequence files in the project
const synthSequenceFiles = computed(() =>
  projectStore.project.files.filter(f => f.name.endsWith('.synthSequence'))
)

// ── Note property editing ─────────────────────────────────────────

function updateNoteField(field: string, value: number | string) {
  for (const note of selectedNotes.value) {
    if (field === 'startTime') note.startTime = value as number
    else if (field === 'duration') note.duration = Math.max(0.01, value as number)
    else if (field === 'frequency') note.frequency = value as number
    else if (field === 'amplitude') note.amplitude = value as number
  }
}

function updateParam(index: number, value: number) {
  for (const note of selectedNotes.value) {
    if (note.params[index] !== undefined) {
      note.params[index] = value
    }
  }
}

// ── Track controls ────────────────────────────────────────────────

function toggleTrackMute(trackIdx: number) {
  const track = sequencer.arrangementTracks[trackIdx]
  if (track) track.muted = !track.muted
}

function toggleTrackSolo(trackIdx: number) {
  const track = sequencer.arrangementTracks[trackIdx]
  if (track) track.solo = !track.solo
}

// ── Clip file operations ──────────────────────────────────────────

function handleOpenClipFile(filePath: string) {
  const clip = sequencer.loadClipFromFile(filePath)
  if (clip) {
    sequencer.setActiveClip(clip.id)
    sequencer.viewMode = 'frequencyRoll'
  }
}

function handleCreateClipFile() {
  const synthName = sequencer.detectedSynthClasses[0] || sequencer.synthNames[0] || 'SineEnv'
  const clip = sequencer.createClipFromNewFile(synthName)
  if (clip) {
    sequencer.setActiveClip(clip.id)
  }
}

function handleSaveActiveClip() {
  const clip = sequencer.activeClip
  if (clip) {
    sequencer.saveClipToFile(clip.id)
  }
}

// ── Sidebar drag support ──────────────────────────────────────────

function handleFileDragStart(e: DragEvent, filePath: string) {
  e.dataTransfer?.setData('application/x-synthsequence-path', filePath)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove'
}
</script>

<template>
  <div class="flex flex-col h-full bg-editor-sidebar overflow-hidden">
    <!-- ═══ CLIPS VIEW SIDEBAR ═══ -->
    <template v-if="sequencer.viewMode === 'clipTimeline'">
      <div class="flex-1 overflow-y-auto">
        <!-- Sequence Files section -->
        <div class="p-2">
          <div class="text-[10px] text-gray-400 mb-1.5 uppercase font-medium tracking-wider">Sequence Files</div>

          <div v-if="synthSequenceFiles.length === 0" class="text-xs text-gray-500 text-center py-3">
            No .synthSequence files yet.
          </div>

          <div
            v-for="file in synthSequenceFiles"
            :key="file.path"
            class="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-editor-active transition-colors group"
            draggable="true"
            @dragstart="handleFileDragStart($event, file.path)"
            @click="handleOpenClipFile(file.path)"
          >
            <!-- Drag handle -->
            <svg class="w-3 h-3 text-gray-600 group-hover:text-gray-400 shrink-0 cursor-grab" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
              <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
              <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
            </svg>
            <!-- File icon -->
            <span class="text-xs font-bold text-yellow-400 shrink-0">S</span>
            <!-- File name -->
            <span class="text-xs text-gray-300 truncate flex-1">{{ file.name }}</span>
          </div>

          <!-- New clip file button -->
          <button
            @click="handleCreateClipFile"
            :disabled="sequencer.detectedSynthClasses.length === 0"
            class="w-full mt-1 py-1.5 text-xs rounded border border-dashed border-editor-border transition-colors"
            :class="sequencer.detectedSynthClasses.length === 0
              ? 'text-gray-600 cursor-not-allowed opacity-50'
              : 'text-gray-400 hover:text-white hover:bg-editor-active'"
            :title="sequencer.detectedSynthClasses.length === 0
              ? 'Run your program first to detect synth voices'
              : 'Create a new .synthSequence clip file'"
          >
            + New Clip File
          </button>
        </div>

        <!-- Tracks section -->
        <div class="p-2 border-t border-editor-border">
          <div class="text-[10px] text-gray-400 mb-1.5 uppercase font-medium tracking-wider">Tracks</div>

          <div v-if="sequencer.arrangementTracks.length === 0" class="text-xs text-gray-500 text-center py-3">
            No synth classes detected.
          </div>

          <div
            v-for="(track, idx) in sequencer.arrangementTracks"
            :key="track.id"
            class="flex flex-col gap-0 rounded bg-editor-bg border border-editor-border mb-1"
          >
            <div class="flex items-center gap-1 px-2 py-1.5">
              <div class="w-2 h-6 rounded-sm shrink-0" :style="{ backgroundColor: track.color }"></div>
              <div class="flex-1 min-w-0">
                <div class="text-xs text-white truncate">{{ track.name }}</div>
                <div class="text-[10px] text-gray-500">
                  {{ sequencer.clipInstances.filter(ci => ci.trackIndex === idx).length }} clips
                </div>
              </div>
              <button
                @click="sequencer.toggleTrackExpanded(idx)"
                class="px-1 py-0.5 text-[10px] rounded transition-colors"
                :class="track.expanded ? 'bg-purple-500/30 text-purple-400' : 'text-gray-500 hover:text-white'"
                title="Toggle automation lanes"
              >A</button>
              <button
                @click="toggleTrackMute(idx)"
                class="px-1 py-0.5 text-[10px] rounded transition-colors"
                :class="track.muted ? 'bg-red-500/30 text-red-400' : 'text-gray-500 hover:text-white'"
                title="Mute"
              >M</button>
              <button
                @click="toggleTrackSolo(idx)"
                class="px-1 py-0.5 text-[10px] rounded transition-colors"
                :class="track.solo ? 'bg-yellow-500/30 text-yellow-400' : 'text-gray-500 hover:text-white'"
                title="Solo"
              >S</button>
            </div>
            <!-- Automation lane toggles when expanded -->
            <div v-if="track.expanded && track.automationLanes.length > 0" class="px-2 pb-1.5 flex flex-wrap gap-1">
              <button
                v-for="lane in track.automationLanes"
                :key="lane.paramName"
                @click="sequencer.toggleTrackAutomationLane(idx, lane.paramName)"
                class="px-1.5 py-0.5 text-[9px] rounded transition-colors border"
                :class="lane.collapsed
                  ? 'border-editor-border text-gray-500 hover:text-white'
                  : 'border-purple-500/40 bg-purple-500/20 text-purple-300'"
                :title="lane.collapsed ? 'Show ' + lane.paramName : 'Hide ' + lane.paramName"
              >{{ lane.paramName }}</button>
            </div>
            <div v-else-if="track.expanded" class="px-2 pb-1.5">
              <div class="text-[9px] text-gray-500 italic">No parameters detected</div>
            </div>
          </div>
        </div>

        <!-- Arrangement section -->
        <div class="p-2 border-t border-editor-border">
          <div class="text-[10px] text-gray-400 mb-1.5 uppercase font-medium tracking-wider">Arrangement</div>
          <div class="flex gap-1">
            <button
              @click="sequencer.saveArrangement()"
              class="flex-1 py-1 text-xs text-gray-400 hover:text-white hover:bg-editor-active rounded border border-editor-border transition-colors"
            >Save</button>
            <button
              @click="sequencer.loadArrangement()"
              class="flex-1 py-1 text-xs text-gray-400 hover:text-white hover:bg-editor-active rounded border border-editor-border transition-colors"
            >Load</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══ ROLL VIEW SIDEBAR ═══ -->
    <template v-else-if="sequencer.viewMode === 'frequencyRoll'">
      <div class="flex-1 overflow-y-auto">
        <!-- Active clip info -->
        <div class="p-2">
          <div class="text-[10px] text-gray-400 mb-1 uppercase font-medium tracking-wider">Active Clip</div>
          <div v-if="sequencer.activeClip" class="space-y-1.5">
            <div class="flex items-center gap-1.5">
              <div class="w-2 h-5 rounded-sm shrink-0" :style="{ backgroundColor: sequencer.activeClip.color }"></div>
              <div class="flex-1 min-w-0">
                <div class="text-xs text-white truncate">{{ sequencer.activeClip.name }}</div>
                <div class="text-[10px] text-gray-500">{{ sequencer.activeClip.synthName }}</div>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Duration</label>
              <input
                type="number"
                :value="sequencer.activeClip.duration"
                @input="sequencer.activeClip!.duration = Math.max(0.1, parseFloat(($event.target as HTMLInputElement).value) || 1)"
                min="0.1"
                step="0.5"
                class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs w-20 text-right"
              />
            </div>
            <button
              v-if="sequencer.activeClip.filePath"
              @click="handleSaveActiveClip"
              class="w-full py-1 text-xs transition-colors rounded border border-editor-border"
              :class="sequencer.activeClip.isDirty ? 'text-yellow-400 hover:text-yellow-300 border-yellow-500/30' : 'text-gray-500'"
            >
              {{ sequencer.activeClip.isDirty ? 'Save to File *' : 'Saved' }}
            </button>
          </div>
          <div v-else class="text-xs text-gray-500 text-center py-3">
            No clip selected.
          </div>
        </div>

        <!-- Selected note properties -->
        <div class="p-2 border-t border-editor-border">
          <div class="text-[10px] text-gray-400 mb-1 uppercase font-medium tracking-wider">Selected Note</div>

          <div v-if="!hasSelection" class="text-xs text-gray-500 text-center py-3">
            Select a note to edit.
          </div>

          <div v-else-if="singleNote" class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Start</label>
              <input
                type="number"
                :value="singleNote.startTime"
                @input="updateNoteField('startTime', parseFloat(($event.target as HTMLInputElement).value) || 0)"
                min="0" step="0.01"
                class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs w-20 text-right"
              />
            </div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Duration</label>
              <input
                type="number"
                :value="singleNote.duration"
                @input="updateNoteField('duration', parseFloat(($event.target as HTMLInputElement).value) || 0.1)"
                min="0.01" step="0.01"
                class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs w-20 text-right"
              />
            </div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Frequency</label>
              <input
                type="number"
                :value="Math.round(singleNote.frequency * 100) / 100"
                @input="updateNoteField('frequency', parseFloat(($event.target as HTMLInputElement).value) || 440)"
                min="20" max="20000" step="1"
                class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs w-20 text-right"
              />
            </div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Amplitude</label>
              <input
                type="number"
                :value="singleNote.amplitude"
                @input="updateNoteField('amplitude', parseFloat(($event.target as HTMLInputElement).value) || 0)"
                min="0" max="1" step="0.05"
                class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs w-20 text-right"
              />
            </div>

            <!-- Synth-specific params -->
            <div v-if="singleNote.params.length > 0" class="border-t border-editor-border pt-1.5 mt-1.5">
              <div class="text-[10px] text-gray-400 uppercase font-medium mb-1">Parameters</div>
              <div class="space-y-1.5">
                <div
                  v-for="(param, i) in singleNote.params"
                  :key="i"
                  class="flex items-center justify-between"
                >
                  <label class="text-xs text-gray-400 truncate mr-1">
                    {{ singleNote.paramNames[i] || `p${i}` }}
                  </label>
                  <input
                    type="number"
                    :value="param"
                    @input="updateParam(i, parseFloat(($event.target as HTMLInputElement).value) || 0)"
                    step="0.01"
                    class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs w-20 text-right"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Multi-selection -->
          <div v-else class="space-y-2">
            <div class="text-xs text-gray-300">{{ selectedNotes.length }} notes selected</div>
            <button
              @click="sequencer.deleteSelectedNotes()"
              class="w-full py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
            >Delete Selected</button>
          </div>
        </div>

        <!-- Note defaults -->
        <div class="p-2 border-t border-editor-border">
          <div class="text-[10px] text-gray-400 mb-1 uppercase font-medium tracking-wider">Note Defaults</div>
          <div class="flex items-center justify-between">
            <label class="text-xs text-gray-400">Amp</label>
            <input
              type="number"
              v-model.number="defaultAmplitude"
              min="0" max="1" step="0.05"
              class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs w-20 text-right"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- ═══ LATTICE VIEW SIDEBAR ═══ -->
    <template v-else-if="sequencer.viewMode === 'toneLattice'">
      <div class="flex-1 overflow-y-auto">
        <!-- Active clip info -->
        <div class="p-2">
          <div class="text-[10px] text-gray-400 mb-1 uppercase font-medium tracking-wider">Active Clip</div>
          <div v-if="sequencer.activeClip" class="space-y-1.5">
            <div class="flex items-center gap-1.5">
              <div class="w-2 h-5 rounded-sm shrink-0" :style="{ backgroundColor: sequencer.activeClip.color }"></div>
              <div class="flex-1 min-w-0">
                <div class="text-xs text-white truncate">{{ sequencer.activeClip.name }}</div>
                <div class="text-[10px] text-gray-500">{{ sequencer.activeClip.synthName }}</div>
              </div>
            </div>
            <button
              v-if="sequencer.activeClip.filePath"
              @click="handleSaveActiveClip"
              class="w-full py-1 text-xs transition-colors rounded border border-editor-border"
              :class="sequencer.activeClip.isDirty ? 'text-yellow-400 hover:text-yellow-300 border-yellow-500/30' : 'text-gray-500'"
            >
              {{ sequencer.activeClip.isDirty ? 'Save to File *' : 'Saved' }}
            </button>
          </div>
          <div v-else class="text-xs text-gray-500 text-center py-3">
            No clip selected.
          </div>
        </div>

        <!-- Lattice settings -->
        <div class="p-2 border-t border-editor-border">
          <div class="text-[10px] text-gray-400 mb-1.5 uppercase font-medium tracking-wider">Lattice Settings</div>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Fundamental</label>
              <div class="flex items-center gap-0.5">
                <input
                  type="number"
                  v-model.number="sequencer.latticeFundamental"
                  min="20" max="2000" step="1"
                  class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs w-16 text-right"
                />
                <span class="text-[10px] text-gray-500">Hz</span>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Range (3)</label>
              <input
                type="number"
                v-model.number="sequencer.latticeRangeI"
                min="1" max="6" step="1"
                class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs w-12 text-right"
              />
            </div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Range (5)</label>
              <input
                type="number"
                v-model.number="sequencer.latticeRangeJ"
                min="1" max="6" step="1"
                class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs w-12 text-right"
              />
            </div>
            <div v-if="sequencer.latticeMode === '3d'" class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Range (2)</label>
              <input
                type="number"
                v-model.number="sequencer.latticeRangeK"
                min="1" max="4" step="1"
                class="bg-editor-bg border border-editor-border rounded px-1 py-0.5 text-xs w-12 text-right"
              />
            </div>
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">Mode</label>
              <div class="flex gap-0.5">
                <button
                  @click="sequencer.latticeMode = '2d'"
                  class="px-2 py-0.5 text-xs rounded transition-colors"
                  :class="sequencer.latticeMode === '2d' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white bg-editor-bg border border-editor-border'"
                >2D</button>
                <button
                  @click="sequencer.latticeMode = '3d'"
                  class="px-2 py-0.5 text-xs rounded transition-colors"
                  :class="sequencer.latticeMode === '3d' ? 'bg-allolib-blue text-white' : 'text-gray-400 hover:text-white bg-editor-bg border border-editor-border'"
                >3D</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Hovered node info -->
        <div class="p-2 border-t border-editor-border">
          <div class="text-[10px] text-gray-400 mb-1.5 uppercase font-medium tracking-wider">Hovered Node</div>
          <div v-if="sequencer.latticeHoveredNode" class="space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">Ratio</span>
              <span class="text-xs text-white font-mono">{{ sequencer.latticeHoveredNode.label }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">Freq</span>
              <span class="text-xs text-white font-mono">{{ sequencer.latticeHoveredNode.frequency.toFixed(1) }} Hz</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">Cents</span>
              <span class="text-xs text-white font-mono">{{ Math.round(sequencer.latticeHoveredNode.cents) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">Consonance</span>
              <span class="text-xs text-white font-mono">{{ sequencer.latticeHoveredNode.consonance.toFixed(2) }}</span>
            </div>
          </div>
          <div v-else class="text-xs text-gray-500 text-center py-2">
            Hover a node to see info.
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
