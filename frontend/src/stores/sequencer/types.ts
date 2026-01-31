/**
 * Sequencer Types
 *
 * Shared type definitions for the sequencer store modules.
 * These types are used across tracks, clips, playback, and editing.
 */

import type { LatticeNode } from '@/utils/tone-lattice'

// ─── Core Note/Event Types ───────────────────────────────────────────────────

export interface SequencerNote {
  id: string
  startTime: number       // relative to clip start (seconds)
  duration: number
  synthName: string
  frequency: number
  amplitude: number
  params: number[]
  paramNames: string[]
  selected: boolean
  muted: boolean
}

// Legacy compat alias
export type SequencerEvent = SequencerNote

// ─── Clip Types ──────────────────────────────────────────────────────────────

export interface SequencerClip {
  id: string
  name: string
  duration: number         // clip length in seconds
  color: string
  notes: SequencerNote[]
  synthName: string        // primary synth for this clip
  paramNames: string[]     // synth-specific parameter names (from .synthSequence header)
  filePath: string | null  // path to .synthSequence file in project
  isDirty: boolean         // whether in-memory clip differs from file
  automation: ClipAutomation[]  // per-parameter automation envelopes
}

export interface ClipInstance {
  id: string
  clipId: string           // reference to SequencerClip
  trackIndex: number       // which arrangement track lane
  startTime: number        // absolute position on the arrangement timeline
}

// ─── Track Types ─────────────────────────────────────────────────────────────

export interface ArrangementTrack {
  id: string
  name: string
  color: string
  muted: boolean
  solo: boolean
  synthName: string        // locked to a specific synth class
  expanded: boolean        // whether automation lanes are shown
  automationLanes: ParameterLaneConfig[]  // per-track automation lane configs
}

export interface SequencerTrack {
  id: string
  name: string
  synthName: string
  events: SequencerNote[]
  muted: boolean
  solo: boolean
  color: string
}

// ─── Automation Types ────────────────────────────────────────────────────────

export interface ParameterLaneConfig {
  paramIndex: number       // index into note.params[]
  paramName: string        // display name (e.g., "attackTime")
  collapsed: boolean       // whether this lane is hidden
  min: number              // display range minimum
  max: number              // display range maximum
}

export interface AutomationPoint {
  id: string          // for hit-testing and selection
  time: number        // relative to clip start, 0..clip.duration
  value: number       // parameter value within [lane.min, lane.max]
}

export interface ClipAutomation {
  paramName: string               // matches ParameterLaneConfig.paramName
  points: AutomationPoint[]       // always sorted ascending by time
}

// ─── Lattice Types ───────────────────────────────────────────────────────────

export type LatticeInteractionMode = 'note' | 'path' | 'chord'

export interface LatticePath {
  id: string
  noteIds: string[]        // ordered sequence of note IDs in the active clip
  timeOffset: number       // seconds between successive notes
}

export interface LatticeChord {
  id: string
  noteIds: string[]        // notes sounding simultaneously
  duration: number         // chord duration
  repeats: number          // how many times to repeat within duration
}

export interface PendingChord {
  frequencies: number[]    // frequencies being collected before finalization
  nodeKeys: string[]       // "i,j,k" keys for highlighting
}

export interface LatticeContextMenu {
  type: 'note' | 'path'
  x: number               // screen pixel X
  y: number               // screen pixel Y
  noteId?: string          // for note context menu
  pathId?: string          // for path context menu
}

// ─── Transport/View Types ────────────────────────────────────────────────────

export type TransportState = 'stopped' | 'playing' | 'paused'
export type EditMode = 'select' | 'draw' | 'erase'
export type ViewMode = 'clipTimeline' | 'frequencyRoll' | 'toneLattice'
export type SnapMode = 'none' | 'beat' | 'half' | 'quarter' | 'eighth' | 'sixteenth'
export type TimeDisplay = 'seconds' | 'beats'

export interface Viewport {
  scrollX: number     // time offset in seconds
  scrollY: number     // frequency scroll (log-space offset)
  zoomX: number       // pixels per second
  zoomY: number       // pixels per octave
  minFreq: number     // Hz
  maxFreq: number     // Hz
}

// ─── Undo Entry ──────────────────────────────────────────────────────────────

export interface UndoEntry {
  clips: string
  clipInstances: string
  arrangementTracks: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const TRACK_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
]

export const CLIP_COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#ef4444', '#f97316', '#14b8a6', '#6366f1',
]

export const PARAM_DEFAULTS: Record<string, { min: number; max: number }> = {
  amplitude: { min: 0, max: 1 },
  frequency: { min: 20, max: 20000 },
  attackTime: { min: 0, max: 5 },
  releaseTime: { min: 0, max: 5 },
  pan: { min: -1, max: 1 },
  sustain: { min: 0, max: 1 },
}

// ─── ID Generation ───────────────────────────────────────────────────────────

let _nextId = 1

export function generateId(): string {
  return `seq_${Date.now().toString(36)}_${(_nextId++).toString(36)}`
}

export function resetIdCounter(): void {
  _nextId = 1
}
