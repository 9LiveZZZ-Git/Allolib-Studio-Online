<!--
  TimelinePanel.vue

  Unified Timeline Panel with all track categories:
  - Audio (synth tracks from sequencer)
  - Objects (visual entities)
  - Environment (global scene settings)
  - Events (camera, markers, scripts)

  This replaces/extends the existing SequencerPanel for unified editing.
-->
<template>
  <div class="timeline-panel">
    <!-- Transport Bar -->
    <TransportBar
      :playing="timeline.playing"
      :looping="sequencer.loopEnabled"
      :currentTime="timeline.currentTime"
      :duration="timeline.duration"
      :mode="timeline.mode"
      :bpm="sequencer.bpm"
      :showBPM="true"
      :zoom="zoomPercent"
      :activeTrackType="activeTrackType"
      @play="timeline.play"
      @pause="timeline.pause"
      @stop="timeline.stop"
      @toggle-loop="sequencer.toggleLoop"
      @mode-change="setMode"
      @bpm-change="setBPM"
      @zoom-in="timeline.zoomIn"
      @zoom-out="timeline.zoomOut"
    />

    <!-- Time Ruler -->
    <TimeRuler
      :duration="timeline.duration"
      :currentTime="timeline.currentTime"
      :zoom="timeline.viewport.zoomX"
      :scrollX="timeline.viewport.scrollX"
      :bpm="sequencer.bpm"
      :showBeats="true"
      :headerWidth="HEADER_WIDTH"
      @seek="timeline.seek"
    />

    <!-- Track Container -->
    <TrackContainer
      ref="trackContainerRef"
      :duration="timeline.duration"
      :zoom="timeline.viewport.zoomX"
      :scrollX="timeline.viewport.scrollX"
      :scrollY="timeline.viewport.scrollY"
      :headerWidth="HEADER_WIDTH"
      :bpm="sequencer.bpm"
      :showGrid="true"
      @scroll="handleScroll"
    >
      <!-- Track Sections (Audio, Objects, Environment, Events) -->
      <TrackSection
        v-for="cat in timeline.categories"
        :key="cat.id"
        :category="cat.id"
        :label="cat.label"
        :icon="cat.icon"
        :color="cat.color"
        :headerColor="cat.headerColor"
        :trackBg="cat.trackBg"
        :collapsed="cat.collapsed"
        :visible="cat.visible"
        :trackCount="getTrackCount(cat.id)"
        :showAddButton="cat.id === 'objects' || cat.id === 'events'"
        :active="activeTrackType === cat.id"
        @toggle-collapse="timeline.toggleSection(cat.id)"
        @toggle-visibility="timeline.toggleSectionVisibility(cat.id)"
        @add="handleAddTrack(cat.id)"
        @mousedown="activeTrackType = cat.id"
      >
        <!-- Audio Section - Arrangement or Clip Editor -->
        <template v-if="cat.id === 'audio'">
          <!-- Clip Editor Header (when editing a clip) -->
          <div v-if="sequencer.viewMode !== 'clipTimeline'" class="clip-editor-header">
            <button class="back-btn" @click="sequencer.viewMode = 'clipTimeline'" title="Back to arrangement">
              ← Arrangement
            </button>
            <span class="editing-label">
              Editing: {{ activeClipName }}
            </span>
            <div class="view-toggle">
              <button
                :class="{ active: sequencer.viewMode === 'frequencyRoll' }"
                @click="sequencer.viewMode = 'frequencyRoll'"
                title="Frequency Roll"
              >Roll</button>
              <button
                :class="{ active: sequencer.viewMode === 'toneLattice' }"
                @click="sequencer.viewMode = 'toneLattice'"
                title="Tone Lattice"
              >Lattice</button>
            </div>
          </div>

          <!-- Arrangement View -->
          <div v-if="sequencer.viewMode === 'clipTimeline'" class="clip-timeline-container">
            <ClipTimeline
              :embedded="true"
              :zoom="timeline.viewport.zoomX"
              :scrollX="timeline.viewport.scrollX"
              :headerWidth="HEADER_WIDTH"
              @open-lattice="showLatticePopup = true"
            />
          </div>

          <!-- Frequency Roll (Note Editor) -->
          <div v-else-if="sequencer.viewMode === 'frequencyRoll'" class="clip-editor-container">
            <SequencerTimeline @open-lattice="showLatticePopup = true" />
          </div>

          <!-- Tone Lattice (Harmonic Note Entry) - inline mode -->
          <div v-else-if="sequencer.viewMode === 'toneLattice'" class="clip-editor-container">
            <ToneLattice />
          </div>
        </template>

        <!-- Object Tracks -->
        <template v-else-if="cat.id === 'objects'">
          <ObjectTrackLane
            v-for="obj in objectsStore.objectList"
            :key="obj.id"
            :object="obj"
            :zoom="timeline.viewport.zoomX"
            :scrollX="timeline.viewport.scrollX"
            :headerWidth="HEADER_WIDTH"
            :categoryColor="cat.color"
            :selected="obj.id === objectsStore.selectedObjectId"
            @select="objectsStore.selectObject(obj.id)"
          />
          <div v-if="objectsStore.objectList.length === 0" class="empty-section">
            No objects. Click + to add one.
          </div>
        </template>

        <!-- Environment Track -->
        <template v-else-if="cat.id === 'environment'">
          <EnvironmentTrackLane
            :zoom="timeline.viewport.zoomX"
            :scrollX="timeline.viewport.scrollX"
            :headerWidth="HEADER_WIDTH"
            :categoryColor="cat.color"
          />
        </template>

        <!-- Event Tracks -->
        <template v-else-if="cat.id === 'events'">
          <EventTrackLane
            v-for="eventTrack in eventTracks"
            :key="eventTrack.id"
            :track="eventTrack"
            :zoom="timeline.viewport.zoomX"
            :scrollX="timeline.viewport.scrollX"
            :headerWidth="HEADER_WIDTH"
            :categoryColor="cat.color"
          />
          <div v-if="eventTracks.length === 0" class="empty-section">
            No event tracks. Click + to add camera or markers.
          </div>
        </template>
      </TrackSection>
    </TrackContainer>

    <!-- Section Toggle Bar -->
    <div class="section-toggles">
      <button
        v-for="cat in timeline.categories"
        :key="cat.id"
        class="section-toggle"
        :class="{ active: cat.visible && !cat.collapsed }"
        :style="{ '--cat-color': cat.color }"
        @click="timeline.toggleSection(cat.id)"
        :title="`${cat.label} (${getTrackCount(cat.id)} tracks)`"
      >
        <span class="toggle-icon">{{ cat.icon }}</span>
      </button>
    </div>

    <!-- Create Object Dialog -->
    <CreateObjectDialog
      :visible="showCreateObjectDialog"
      :currentTime="timeline.currentTime"
      @close="showCreateObjectDialog = false"
      @created="onObjectCreated"
    />

    <!-- Tone Lattice Popup -->
    <Teleport to="body">
      <div v-if="showLatticePopup" class="lattice-popup-overlay" @click.self="showLatticePopup = false">
        <div class="lattice-popup">
          <div class="lattice-popup-header">
            <h3 class="lattice-popup-title">
              <span class="lattice-icon">◇</span>
              Tone Lattice Editor
            </h3>
            <div class="lattice-popup-subtitle">{{ activeClipName }}</div>
            <div class="lattice-popup-actions">
              <button class="lattice-help-btn" title="Lattice Help">?</button>
              <button class="lattice-close-btn" @click="showLatticePopup = false" title="Close">✕</button>
            </div>
          </div>
          <div class="lattice-popup-toolbar">
            <!-- Interaction Mode -->
            <div class="lattice-tool-group">
              <span class="tool-label">Interaction:</span>
              <button
                class="tool-btn"
                :class="{ active: sequencer.latticeInteractionMode === 'note' }"
                @click="sequencer.latticeInteractionMode = 'note'"
                title="Single notes"
              >Note</button>
              <button
                class="tool-btn"
                :class="{ active: sequencer.latticeInteractionMode === 'path' }"
                @click="sequencer.latticeInteractionMode = 'path'"
                title="Draw melodic paths"
              >Path</button>
              <button
                class="tool-btn"
                :class="{ active: sequencer.latticeInteractionMode === 'chord' }"
                @click="sequencer.latticeInteractionMode = 'chord'"
                title="Build chords"
              >Chord</button>
            </div>

            <!-- Poly Path Toggle (for path mode) -->
            <div v-if="sequencer.latticeInteractionMode === 'path'" class="lattice-tool-group">
              <label class="poly-toggle">
                <input type="checkbox" v-model="sequencer.latticePolyPathEnabled" />
                <span>Poly</span>
              </label>
            </div>

            <!-- 2D/3D Toggle -->
            <div class="lattice-tool-group">
              <span class="tool-label">View:</span>
              <button
                class="tool-btn"
                :class="{ active: sequencer.latticeMode === '2d' }"
                @click="sequencer.latticeMode = '2d'"
              >2D</button>
              <button
                class="tool-btn"
                :class="{ active: sequencer.latticeMode === '3d' }"
                @click="sequencer.latticeMode = '3d'"
              >3D</button>
            </div>

            <!-- Fundamental & Range -->
            <div class="lattice-tool-group">
              <span class="tool-label">Fund:</span>
              <input
                type="number"
                v-model.number="sequencer.latticeFundamental"
                class="lattice-input"
                min="20"
                max="2000"
                step="1"
              />
              <span class="tool-unit">Hz</span>
            </div>

            <div class="lattice-tool-group">
              <span class="tool-label">Range:</span>
              <input type="number" v-model.number="sequencer.latticeRangeI" class="lattice-input-sm" min="1" max="10" title="Range I (fifths)" />
              <input type="number" v-model.number="sequencer.latticeRangeJ" class="lattice-input-sm" min="1" max="10" title="Range J (thirds)" />
              <input v-if="sequencer.latticeMode === '3d'" type="number" v-model.number="sequencer.latticeRangeK" class="lattice-input-sm" min="1" max="5" title="Range K (sevenths)" />
            </div>

            <!-- Spacer -->
            <div class="flex-1"></div>

            <!-- Edit Mode -->
            <div class="lattice-tool-group">
              <span class="tool-label">Edit:</span>
              <button
                class="tool-btn"
                :class="{ active: sequencer.editMode === 'select' }"
                @click="sequencer.editMode = 'select'"
                title="Select (V)"
              >Select</button>
              <button
                class="tool-btn"
                :class="{ active: sequencer.editMode === 'draw' }"
                @click="sequencer.editMode = 'draw'"
                title="Draw (D)"
              >Draw</button>
              <button
                class="tool-btn"
                :class="{ active: sequencer.editMode === 'erase' }"
                @click="sequencer.editMode = 'erase'"
                title="Erase (E)"
              >Erase</button>
            </div>
          </div>
          <div class="lattice-popup-content">
            <ToneLattice />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTimelineStore, type TrackCategory } from '@/stores/timeline'
import { useSequencerStore } from '@/stores/sequencer'
import { useObjectsStore, type SceneObject } from '@/stores/objects'
import { useEnvironmentStore } from '@/stores/environment'
import { parameterSystem } from '@/utils/parameter-system'

import TransportBar from './TransportBar.vue'
import TimeRuler from './TimeRuler.vue'
import TrackContainer from './TrackContainer.vue'
import TrackSection from './TrackSection.vue'
import ObjectTrackLane from './tracks/ObjectTrackLane.vue'
import EnvironmentTrackLane from './tracks/EnvironmentTrackLane.vue'
import EventTrackLane from './tracks/EventTrackLane.vue'
import CreateObjectDialog from './CreateObjectDialog.vue'

// Full sequencer components for Audio section
import ClipTimeline from '@/components/sequencer/ClipTimeline.vue'
import SequencerTimeline from '@/components/sequencer/SequencerTimeline.vue'
import ToneLattice from '@/components/sequencer/ToneLattice.vue'

const HEADER_WIDTH = 120

const timeline = useTimelineStore()
const sequencer = useSequencerStore()
const objectsStore = useObjectsStore()
const environmentStore = useEnvironmentStore()

const trackContainerRef = ref<InstanceType<typeof TrackContainer>>()

// Event tracks (placeholder until event store is created)
const eventTracks = ref<Array<{ id: string; name: string; type: string }>>([])

// Dialog state
const showCreateObjectDialog = ref(false)
const showLatticePopup = ref(false)

// Active track type for context-aware edit controls
const activeTrackType = ref<TrackCategory>('audio')

const zoomPercent = computed(() => (timeline.viewport.zoomX / 50) * 100)

// Get active clip name for display
const activeClipName = computed(() => {
  const activeClip = sequencer.clips.find(c => c.id === sequencer.activeClipId)
  return activeClip?.name || 'Untitled'
})

// Sync object selection with Parameter Panel
watch(() => objectsStore.selectedObjectId, (objectId) => {
  if (objectId) {
    // Notify parameter system that an object is selected
    parameterSystem.setSelectedObject(objectId)
    console.log(`[Timeline] Object selected: ${objectId}`)
  } else {
    parameterSystem.setSelectedObject(null)
  }
})

function getTrackCount(category: TrackCategory): number {
  switch (category) {
    case 'audio':
      return sequencer.arrangementTracks.length
    case 'objects':
      return objectsStore.objectList.length
    case 'environment':
      return 1 // Always one environment track
    case 'events':
      return eventTracks.value.length
    default:
      return 0
  }
}

function handleScroll(x: number, y: number) {
  timeline.setScroll(x, y)
}

function setMode(mode: 'animation' | 'interactive') {
  timeline.mode = mode
}

function setBPM(bpm: number) {
  sequencer.setBPM(bpm)
}

function handleAddTrack(category: TrackCategory) {
  switch (category) {
    case 'objects':
      showCreateObjectDialog.value = true
      break
    case 'events':
      // TODO: Show event type picker (camera, marker, script)
      eventTracks.value.push({
        id: `event_${Date.now()}`,
        name: 'Camera',
        type: 'camera',
      })
      break
  }
}

function onObjectCreated(object: SceneObject) {
  // Select the newly created object
  objectsStore.selectObject(object.id)
  console.log(`[Timeline] Created object: ${object.name}`)
}
</script>

<style scoped>
.timeline-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a2e;
  color: #fff;
}

.empty-section {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  font-style: italic;
}

/* ClipTimeline container for full arrangement view */
.clip-timeline-container {
  width: 100%;
  min-height: 200px;
  height: 300px;
  position: relative;
}

/* Clip Editor Header (when editing a clip) */
.clip-editor-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #2a4858 0%, #1e3a47 100%);
  border-bottom: 1px solid rgba(0, 200, 255, 0.3);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.editing-label {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.view-toggle {
  display: flex;
  gap: 2px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 2px;
}

.view-toggle button {
  padding: 4px 12px;
  background: transparent;
  border: none;
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.view-toggle button:hover {
  color: rgba(255, 255, 255, 0.8);
}

.view-toggle button.active {
  background: rgba(0, 200, 255, 0.3);
  color: #fff;
}

/* Clip Editor container (SequencerTimeline / ToneLattice) */
.clip-editor-container {
  width: 100%;
  min-height: 250px;
  height: 350px;
  position: relative;
}

/* Section Toggle Bar */
.section-toggles {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 32px;
  background: #252538;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.section-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: all 0.15s;
}

.section-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--cat-color);
}

.section-toggle.active {
  background: color-mix(in srgb, var(--cat-color) 20%, transparent);
  border-color: color-mix(in srgb, var(--cat-color) 40%, transparent);
  color: var(--cat-color);
}

.toggle-icon {
  font-size: 14px;
}

/* Lattice Popup */
.lattice-popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.lattice-popup {
  width: 90vw;
  max-width: 1200px;
  height: 80vh;
  max-height: 800px;
  background: #1a1a2e;
  border: 1px solid rgba(159, 122, 234, 0.4);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.lattice-popup-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #2d2d4a 0%, #252538 100%);
  border-bottom: 1px solid rgba(159, 122, 234, 0.3);
}

.lattice-popup-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.lattice-icon {
  color: #9F7AEA;
  font-size: 18px;
}

.lattice-popup-subtitle {
  flex: 1;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.lattice-popup-actions {
  display: flex;
  gap: 8px;
}

.lattice-help-btn,
.lattice-close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.lattice-help-btn:hover,
.lattice-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.lattice-close-btn:hover {
  background: rgba(239, 68, 68, 0.3);
  border-color: rgba(239, 68, 68, 0.5);
}

.lattice-popup-toolbar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 8px 16px;
  background: #252538;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.lattice-tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tool-btn {
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.tool-btn.active {
  background: rgba(159, 122, 234, 0.3);
  border-color: rgba(159, 122, 234, 0.5);
  color: #9F7AEA;
}

.snap-select {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  cursor: pointer;
}

.snap-select:focus {
  outline: none;
  border-color: rgba(159, 122, 234, 0.5);
}

.lattice-popup-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.lattice-input {
  width: 60px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  text-align: right;
}

.lattice-input:focus {
  outline: none;
  border-color: rgba(159, 122, 234, 0.5);
}

.lattice-input-sm {
  width: 40px;
  padding: 4px 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  text-align: center;
}

.lattice-input-sm:focus {
  outline: none;
  border-color: rgba(159, 122, 234, 0.5);
}

.tool-unit {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-left: -4px;
}

.poly-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}

.poly-toggle input {
  accent-color: #9F7AEA;
}

.flex-1 {
  flex: 1;
}
</style>
