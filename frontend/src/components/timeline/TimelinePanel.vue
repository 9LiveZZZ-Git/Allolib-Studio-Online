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
      @scroll="handleScroll"
    >
      <!-- Audio Section -->
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
        @toggle-collapse="timeline.toggleSection(cat.id)"
        @toggle-visibility="timeline.toggleSectionVisibility(cat.id)"
        @add="handleAddTrack(cat.id)"
      >
        <!-- Audio Tracks -->
        <template v-if="cat.id === 'audio'">
          <AudioTrackLane
            v-for="track in sequencer.arrangementTracks"
            :key="track.id"
            :track="track"
            :zoom="timeline.viewport.zoomX"
            :scrollX="timeline.viewport.scrollX"
            :headerWidth="HEADER_WIDTH"
            :categoryColor="cat.color"
          />
          <div v-if="sequencer.arrangementTracks.length === 0" class="empty-section">
            No audio tracks. Add synths in the Sequencer.
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTimelineStore, type TrackCategory } from '@/stores/timeline'
import { useSequencerStore } from '@/stores/sequencer'
import { useObjectsStore } from '@/stores/objects'
import { useEnvironmentStore } from '@/stores/environment'

import TransportBar from './TransportBar.vue'
import TimeRuler from './TimeRuler.vue'
import TrackContainer from './TrackContainer.vue'
import TrackSection from './TrackSection.vue'
import AudioTrackLane from './tracks/AudioTrackLane.vue'
import ObjectTrackLane from './tracks/ObjectTrackLane.vue'
import EnvironmentTrackLane from './tracks/EnvironmentTrackLane.vue'
import EventTrackLane from './tracks/EventTrackLane.vue'

const HEADER_WIDTH = 120

const timeline = useTimelineStore()
const sequencer = useSequencerStore()
const objectsStore = useObjectsStore()
const environmentStore = useEnvironmentStore()

const trackContainerRef = ref<InstanceType<typeof TrackContainer>>()

// Event tracks (placeholder until event store is created)
const eventTracks = ref<Array<{ id: string; name: string; type: string }>>([])

const zoomPercent = computed(() => (timeline.viewport.zoomX / 50) * 100)

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
      objectsStore.createObject({
        name: `Object ${objectsStore.objectList.length + 1}`,
      })
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
</style>
