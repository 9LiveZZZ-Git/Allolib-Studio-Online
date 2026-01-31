/**
 * Timeline Components
 *
 * Unified timeline panel with all track categories:
 * - Audio (synth tracks from sequencer)
 * - Objects (visual entities)
 * - Environment (global scene settings)
 * - Events (camera, markers, scripts)
 */

export { default as TimelinePanel } from './TimelinePanel.vue'
export { default as TransportBar } from './TransportBar.vue'
export { default as TimeRuler } from './TimeRuler.vue'
export { default as TrackSection } from './TrackSection.vue'
export { default as SectionHeader } from './SectionHeader.vue'
export { default as TrackContainer } from './TrackContainer.vue'

// Track lane components
export { default as AudioTrackLane } from './tracks/AudioTrackLane.vue'
export { default as ObjectTrackLane } from './tracks/ObjectTrackLane.vue'
export { default as EnvironmentTrackLane } from './tracks/EnvironmentTrackLane.vue'
export { default as EventTrackLane } from './tracks/EventTrackLane.vue'
