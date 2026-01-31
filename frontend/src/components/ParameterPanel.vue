<script setup lang="ts">
/**
 * Parameter Panel
 *
 * Displays interactive controls for AlloLib parameters registered via WebControlGUI.
 * Supports all parameter types: float, int, bool, menu, trigger, vec3, vec4, color.
 * Extended to support multiple sources: synth, object, environment, camera.
 *
 * Styled to match ImGui aesthetic with collapsible groups.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  parameterSystem,
  ParameterType,
  presetManager,
  type Parameter,
  type ParameterGroup,
  type ParameterSource
} from '@/utils/parameter-system'
import Vec3Input from './inputs/Vec3Input.vue'
import ColorPicker from './inputs/ColorPicker.vue'

const props = defineProps<{
  collapsed?: boolean
  showAllSources?: boolean  // If true, show all sources; if false, show only synth
}>()

const emit = defineEmits<{
  toggle: []
  addKeyframe: [param: Parameter]
}>()

// Reactive parameter groups
const groups = ref<ParameterGroup[]>([])

// Source filter
const activeSourceFilter = ref<ParameterSource | 'all'>('all')
const sourceFilters: { source: ParameterSource | 'all'; icon: string; label: string }[] = [
  { source: 'all', icon: '☰', label: 'All' },
  { source: 'synth', icon: '♫', label: 'Synth' },
  { source: 'object', icon: '◆', label: 'Object' },
  { source: 'environment', icon: '◐', label: 'Env' },
  { source: 'camera', icon: '📷', label: 'Cam' },
]

// Expanded group states - use composite key format: source-sourceId-groupName
const expandedGroups = ref<Set<string>>(new Set([
  'synth-undefined-Parameters',
  'synth-undefined-Audio',
  'synth-undefined-Graphics',
  'synth-undefined-General',
  'environment-undefined-Environment',
  'camera-undefined-Camera'
]))

// Preset management state
const showPresetMenu = ref(false)
const newPresetName = ref('')
const presetList = ref<string[]>([])

// Update preset list
function updatePresetList() {
  presetList.value = presetManager.getPresetNames()
}

// Save current state as preset
function savePreset() {
  if (!newPresetName.value.trim()) return
  presetManager.savePreset(newPresetName.value.trim())
  newPresetName.value = ''
  updatePresetList()
  showPresetMenu.value = false
}

// Load a preset
function loadPreset(name: string) {
  presetManager.loadPreset(name)
  showPresetMenu.value = false
}

// Delete a preset
function deletePreset(name: string, event: Event) {
  event.stopPropagation()
  if (confirm(`Delete preset "${name}"?`)) {
    presetManager.deletePreset(name)
    updatePresetList()
  }
}

// Update groups from parameter system
function updateGroups() {
  // Use getAllGroups() for unified view when showAllSources is true
  if (props.showAllSources) {
    groups.value = parameterSystem.getAllGroups()
  } else {
    groups.value = parameterSystem.getGrouped()
  }
}

// Filtered groups based on source filter
const filteredGroups = computed(() => {
  if (activeSourceFilter.value === 'all') {
    return groups.value
  }
  return groups.value.filter(g => g.source === activeSourceFilter.value)
})

// Subscribe to parameter changes
let unsubscribe: (() => void) | null = null

// Toggle group expansion
function toggleGroup(groupName: string) {
  if (expandedGroups.value.has(groupName)) {
    expandedGroups.value.delete(groupName)
  } else {
    expandedGroups.value.add(groupName)
  }
}

// Handle parameter value change - routes to correct store based on source
function handleSliderChange(param: Parameter, event: Event) {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)

  if (param.source === 'synth' && param.index >= 0) {
    // Synth params use WASM index
    parameterSystem.setByIndex(param.index, value)
  } else {
    // Other sources use unified setParameterValue
    parameterSystem.setParameterValue(param.source, param.name, value, param.sourceId)
  }
}

// Handle bool toggle
function handleBoolToggle(param: Parameter) {
  const newValue = (param.value as number) === 0 ? 1 : 0

  if (param.source === 'synth' && param.index >= 0) {
    parameterSystem.setByIndex(param.index, newValue)
  } else {
    parameterSystem.setParameterValue(param.source, param.name, newValue, param.sourceId)
  }
}

// Handle menu selection
function handleMenuChange(param: Parameter, event: Event) {
  const target = event.target as HTMLSelectElement
  const value = parseInt(target.value)

  if (param.source === 'synth' && param.index >= 0) {
    parameterSystem.setByIndex(param.index, value)
  } else {
    parameterSystem.setParameterValue(param.source, param.name, value, param.sourceId)
  }
}

// Handle trigger button
function handleTrigger(param: Parameter) {
  if (param.source === 'synth' && param.index >= 0) {
    parameterSystem.trigger(param.index)
  }
}

// Reset parameter to default
function resetToDefault(param: Parameter) {
  if (param.source === 'synth' && param.index >= 0) {
    parameterSystem.resetToDefault(param.index)
  } else {
    // For non-synth params, set to default value
    parameterSystem.setParameterValue(param.source, param.name, param.defaultValue, param.sourceId)
  }
}

// ─── Keyframe Handling ─────────────────────────────────────────────────────

// Current playhead time (from sequencer store)
const currentTime = ref(0)

// Track if we're in "timeline mode" (showing keyframeable params)
const showTimelineInfo = ref(false)

// Update current time from sequencer
function updateCurrentTime() {
  const sequencerStore = (window as any).__sequencerStore
  if (sequencerStore) {
    currentTime.value = sequencerStore.playheadTime || 0
  }
}

// Periodic time update for display
let timeUpdateInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  updateGroups()
  updatePresetList()
  unsubscribe = parameterSystem.subscribe(() => {
    updateGroups()
  })
  // Update time display periodically
  timeUpdateInterval = setInterval(updateCurrentTime, 100)
})

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe()
  if (timeUpdateInterval) clearInterval(timeUpdateInterval)
})

// Add keyframe at current playhead time
function handleAddKeyframe(param: Parameter) {
  updateCurrentTime()

  const value = param.value

  switch (param.source) {
    case 'object':
      const objectsStore = (window as any).__objectsStore
      if (objectsStore && param.sourceId) {
        objectsStore.addKeyframe(param.sourceId, param.name, currentTime.value, value)
        param.hasKeyframes = true
        console.log(`[ParameterPanel] Added keyframe: ${param.sourceId}.${param.name} @ ${currentTime.value}s`)
      }
      break

    case 'environment':
      const envStore = (window as any).__environmentStore
      if (envStore) {
        envStore.addKeyframe(param.name, currentTime.value, value)
        param.hasKeyframes = true
        console.log(`[ParameterPanel] Added keyframe: env.${param.name} @ ${currentTime.value}s`)
      }
      break

    case 'camera':
      // Camera keyframes stored in environment or separate camera track
      const envStore2 = (window as any).__environmentStore
      if (envStore2) {
        envStore2.addKeyframe(`camera.${param.name}`, currentTime.value, value)
        param.hasKeyframes = true
        console.log(`[ParameterPanel] Added keyframe: camera.${param.name} @ ${currentTime.value}s`)
      }
      break

    case 'synth':
      // Synth params don't support keyframes (they use .synthSequence)
      console.log(`[ParameterPanel] Synth params use .synthSequence for automation`)
      break
  }

  // Also emit for parent component if needed
  emit('addKeyframe', param)
}

// Format value for display
function formatValue(param: Parameter): string {
  const value = param.value

  // Handle array values (vec3, vec4, color)
  if (Array.isArray(value)) {
    return value.map(v => v.toFixed(2)).join(', ')
  }

  if (param.type === ParameterType.INT || param.type === ParameterType.MENU) {
    return Math.round(value).toString()
  }
  if (param.type === ParameterType.BOOL) {
    return value > 0.5 ? 'On' : 'Off'
  }
  if (Math.abs(value) < 0.001 && value !== 0) return value.toExponential(2)
  if (Math.abs(value) < 10) return value.toFixed(3)
  if (Math.abs(value) < 100) return value.toFixed(2)
  return value.toFixed(1)
}

// Format time for keyframe tooltip
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(2)
  return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`
}

// Get step value for slider
function getStep(param: Parameter): number {
  if (param.type === ParameterType.INT || param.type === ParameterType.MENU) {
    return 1
  }
  const range = param.max - param.min
  if (range <= 1) return 0.001
  if (range <= 10) return 0.01
  if (range <= 100) return 0.1
  return 1
}

const hasParameters = computed(() => groups.value.length > 0)

// Handle Vec3 value change
function handleVec3Change(param: Parameter, value: [number, number, number]) {
  parameterSystem.setParameterValue(param.source, param.name, value, param.sourceId)
}

// Handle Color value change
function handleColorChange(param: Parameter, value: [number, number, number, number] | [number, number, number]) {
  parameterSystem.setParameterValue(param.source, param.name, value, param.sourceId)
}

// Get Vec3 value from parameter
function getVec3Value(param: Parameter): [number, number, number] {
  if (Array.isArray(param.value) && param.value.length >= 3) {
    return [param.value[0], param.value[1], param.value[2]]
  }
  return [0, 0, 0]
}

// Get Color value from parameter
function getColorValue(param: Parameter): [number, number, number, number] {
  if (Array.isArray(param.value)) {
    if (param.value.length >= 4) {
      return [param.value[0], param.value[1], param.value[2], param.value[3]]
    } else if (param.value.length === 3) {
      return [param.value[0], param.value[1], param.value[2], 1]
    }
  }
  return [1, 1, 1, 1]
}
</script>

<template>
  <div v-if="hasParameters" class="parameter-panel bg-imgui-bg border-t border-imgui-border">
    <!-- Header -->
    <div
      class="h-7 flex items-center justify-between px-2 cursor-pointer hover:bg-imgui-header-hover border-b border-imgui-border bg-imgui-header"
      @click="emit('toggle')"
    >
      <div class="flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-imgui-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <span class="text-xs font-medium text-imgui-text">Parameters</span>
        <span class="text-xs text-imgui-text-dim">({{ parameterSystem.count }})</span>
      </div>
      <svg
        class="w-3 h-3 text-imgui-text-dim transition-transform"
        :class="{ 'rotate-180': !collapsed }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>

    <!-- Source Filter Pills + Timeline Info -->
    <div v-if="!collapsed && showAllSources" class="flex items-center justify-between gap-1 px-2 py-1 border-b border-imgui-border bg-imgui-header">
      <!-- Source filters -->
      <div class="flex items-center gap-1">
        <button
          v-for="filter in sourceFilters"
          :key="filter.source"
          @click="activeSourceFilter = filter.source"
          :class="[
            'px-2 py-0.5 text-xs rounded transition-colors',
            activeSourceFilter === filter.source
              ? 'bg-imgui-accent text-white'
              : 'bg-imgui-input text-imgui-text-dim hover:text-imgui-text hover:bg-imgui-button'
          ]"
          :title="filter.label"
        >
          <span class="mr-1">{{ filter.icon }}</span>
          <span>{{ filter.label }}</span>
        </button>
      </div>

      <!-- Timeline current time indicator -->
      <div
        class="flex items-center gap-1 px-2 py-0.5 bg-imgui-input rounded text-xs"
        title="Current playhead time for keyframes"
      >
        <span class="text-imgui-text-dim">◆</span>
        <span class="text-imgui-value font-mono">{{ formatTime(currentTime) }}</span>
      </div>
    </div>

    <!-- Content -->
    <div v-if="!collapsed" class="max-h-80 overflow-y-auto">
      <div v-for="group in filteredGroups" :key="`${group.source}-${group.sourceId}-${group.name}`" class="border-b border-imgui-border last:border-b-0">
        <!-- Group Header -->
        <button
          class="w-full px-2 py-1 flex items-center gap-1 text-xs hover:bg-imgui-header-hover bg-imgui-group-header"
          @click="toggleGroup(`${group.source}-${group.sourceId}-${group.name}`)"
        >
          <svg
            class="w-2.5 h-2.5 text-imgui-text-dim transition-transform flex-shrink-0"
            :class="{ 'rotate-90': expandedGroups.has(`${group.source}-${group.sourceId}-${group.name}`) }"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          <!-- Source badge -->
          <span
            v-if="showAllSources"
            :class="[
              'px-1 py-0.5 text-[10px] rounded font-medium',
              group.source === 'synth' ? 'bg-purple-600/30 text-purple-300' :
              group.source === 'object' ? 'bg-blue-600/30 text-blue-300' :
              group.source === 'environment' ? 'bg-green-600/30 text-green-300' :
              group.source === 'camera' ? 'bg-orange-600/30 text-orange-300' :
              'bg-gray-600/30 text-gray-300'
            ]"
          >
            {{ group.source === 'synth' ? '♫' :
               group.source === 'object' ? '◆' :
               group.source === 'environment' ? '◐' :
               group.source === 'camera' ? '📷' : '?' }}
          </span>
          <span class="text-imgui-text font-medium">{{ group.name }}</span>
          <span class="text-imgui-text-dim">({{ group.parameters.length }})</span>
        </button>

        <!-- Parameters -->
        <div v-if="expandedGroups.has(`${group.source}-${group.sourceId}-${group.name}`)" class="px-2 py-1.5 space-y-2 bg-imgui-content">
          <div v-for="param in group.parameters" :key="param.index" class="parameter-row">
            <!-- Float/Int Slider -->
            <template v-if="param.type === ParameterType.FLOAT || param.type === ParameterType.INT">
              <div class="flex items-center gap-1">
                <label
                  class="text-xs text-imgui-text w-24 truncate flex-shrink-0"
                  :title="param.name"
                  @dblclick="resetToDefault(param)"
                >
                  {{ param.displayName }}
                </label>
                <input
                  type="range"
                  :min="param.min"
                  :max="param.max"
                  :step="getStep(param)"
                  :value="param.value"
                  @input="handleSliderChange(param, $event)"
                  class="flex-1 h-4 imgui-slider"
                />
                <span class="text-xs text-imgui-value font-mono w-12 text-right">
                  {{ formatValue(param) }}
                </span>
                <button
                  v-if="param.isKeyframeable"
                  @click="handleAddKeyframe(param)"
                  :class="[
                    'w-4 h-4 flex items-center justify-center text-xs transition-colors flex-shrink-0',
                    param.hasKeyframes ? 'text-imgui-accent' : 'text-imgui-text-dim hover:text-imgui-accent'
                  ]"
                  :title="`Add keyframe @ ${formatTime(currentTime)}`"
                >
                  ◆
                </button>
              </div>
            </template>

            <!-- Bool Toggle -->
            <template v-else-if="param.type === ParameterType.BOOL">
              <div class="flex items-center gap-2">
                <label
                  class="text-xs text-imgui-text w-24 truncate flex-shrink-0"
                  :title="param.name"
                >
                  {{ param.displayName }}
                </label>
                <button
                  @click="handleBoolToggle(param)"
                  :class="[
                    'imgui-checkbox w-4 h-4 border rounded-sm flex items-center justify-center',
                    param.value > 0.5 ? 'bg-imgui-accent border-imgui-accent' : 'bg-imgui-input border-imgui-border'
                  ]"
                >
                  <svg v-if="param.value > 0.5" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            </template>

            <!-- Menu/Choice -->
            <template v-else-if="param.type === ParameterType.MENU">
              <div class="flex items-center gap-2">
                <label
                  class="text-xs text-imgui-text w-24 truncate flex-shrink-0"
                  :title="param.name"
                >
                  {{ param.displayName }}
                </label>
                <select
                  :value="Math.round(param.value)"
                  @change="handleMenuChange(param, $event)"
                  class="flex-1 h-5 text-xs bg-imgui-input border border-imgui-border rounded px-1 text-imgui-text imgui-select"
                >
                  <option
                    v-for="(item, i) in param.menuItems || Array.from({length: param.max + 1}, (_, i) => `Option ${i}`)"
                    :key="i"
                    :value="i"
                  >
                    {{ item }}
                  </option>
                </select>
              </div>
            </template>

            <!-- Trigger Button -->
            <template v-else-if="param.type === ParameterType.TRIGGER">
              <div class="flex items-center gap-2">
                <label
                  class="text-xs text-imgui-text w-24 truncate flex-shrink-0"
                  :title="param.name"
                >
                  {{ param.displayName }}
                </label>
                <button
                  @click="handleTrigger(param)"
                  class="imgui-button px-3 h-5 text-xs bg-imgui-button hover:bg-imgui-button-hover border border-imgui-border rounded text-imgui-text"
                >
                  Trigger
                </button>
              </div>
            </template>

            <!-- Vec3 (3 sliders) -->
            <template v-else-if="param.type === ParameterType.VEC3">
              <div class="space-y-1">
                <div class="flex items-center justify-between">
                  <label class="text-xs text-imgui-text">{{ param.displayName }}</label>
                  <button
                    v-if="param.isKeyframeable"
                    @click="handleAddKeyframe(param)"
                    :class="[
                      'w-4 h-4 flex items-center justify-center text-xs transition-colors',
                      param.hasKeyframes ? 'text-imgui-accent' : 'text-imgui-text-dim hover:text-imgui-accent'
                    ]"
                    :title="`Add keyframe @ ${formatTime(currentTime)}`"
                  >
                    ◆
                  </button>
                </div>
                <Vec3Input
                  :model-value="getVec3Value(param)"
                  @update:model-value="handleVec3Change(param, $event)"
                  :min="param.min"
                  :max="param.max"
                  :step="param.step"
                />
              </div>
            </template>

            <!-- Vec4/Color -->
            <template v-else-if="param.type === ParameterType.VEC4 || param.type === ParameterType.COLOR">
              <div class="space-y-1">
                <div class="flex items-center justify-between">
                  <label class="text-xs text-imgui-text">{{ param.displayName }}</label>
                  <button
                    v-if="param.isKeyframeable"
                    @click="handleAddKeyframe(param)"
                    :class="[
                      'w-4 h-4 flex items-center justify-center text-xs transition-colors',
                      param.hasKeyframes ? 'text-imgui-accent' : 'text-imgui-text-dim hover:text-imgui-accent'
                    ]"
                    :title="`Add keyframe @ ${formatTime(currentTime)}`"
                  >
                    ◆
                  </button>
                </div>
                <ColorPicker
                  :model-value="getColorValue(param)"
                  @update:model-value="handleColorChange(param, $event)"
                  :show-alpha="param.type === ParameterType.VEC4 || param.type === ParameterType.COLOR"
                />
              </div>
            </template>

            <!-- String (text input) -->
            <template v-else-if="param.type === ParameterType.STRING">
              <div class="flex items-center gap-2">
                <label
                  class="text-xs text-imgui-text w-24 truncate flex-shrink-0"
                  :title="param.name"
                >
                  {{ param.displayName }}
                </label>
                <div class="text-xs text-imgui-text-dim italic">String input coming soon</div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer with preset management (SYNTH ONLY) and help info -->
    <div v-if="!collapsed && hasParameters" class="px-2 py-1.5 border-t border-imgui-border bg-imgui-header space-y-2">
      <!-- Info bar when showing all sources -->
      <div v-if="showAllSources" class="flex items-center gap-3 text-[10px] text-imgui-text-dim pb-1 border-b border-imgui-border/50">
        <span title="Synth parameters save to .preset files">
          <span class="text-purple-300">♫</span> Synth → Presets
        </span>
        <span title="Object/Environment/Camera use timeline keyframes">
          <span class="text-blue-300">◆◐📷</span> → Keyframes
        </span>
      </div>

      <!-- Preset row - only for synth params -->
      <div class="flex items-center gap-2">
        <span class="text-xs text-imgui-text-dim" title="Presets only save synth parameters (♫). Object/Env/Camera use keyframes.">♫ Presets:</span>

        <!-- Preset dropdown -->
        <div class="relative flex-1">
          <button
            @click="showPresetMenu = !showPresetMenu"
            class="w-full h-5 text-xs bg-imgui-input border border-imgui-border rounded px-2 text-left text-imgui-text flex items-center justify-between"
          >
            <span>{{ presetList.length > 0 ? `${presetList.length} saved` : 'None' }}</span>
            <svg class="w-3 h-3 text-imgui-text-dim" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>

          <!-- Dropdown menu -->
          <div
            v-if="showPresetMenu"
            class="absolute bottom-6 left-0 w-48 bg-imgui-header border border-imgui-border rounded shadow-lg z-50"
          >
            <!-- Saved presets -->
            <div v-if="presetList.length > 0" class="max-h-32 overflow-y-auto">
              <div
                v-for="preset in presetList"
                :key="preset"
                @click="loadPreset(preset)"
                class="w-full px-2 py-1 text-xs text-left text-imgui-text hover:bg-imgui-header-hover flex items-center justify-between group cursor-pointer"
              >
                <span>{{ preset }}</span>
                <span
                  @click.stop="deletePreset(preset, $event)"
                  class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 px-1 cursor-pointer"
                >
                  ✕
                </span>
              </div>
            </div>
            <div v-else class="px-2 py-1 text-xs text-imgui-text-dim italic">
              No presets saved
            </div>

            <!-- Save new preset -->
            <div class="border-t border-imgui-border px-2 py-1.5">
              <div class="flex gap-1">
                <input
                  v-model="newPresetName"
                  @keyup.enter="savePreset"
                  placeholder="New preset name"
                  class="flex-1 h-5 text-xs bg-imgui-input border border-imgui-border rounded px-1 text-imgui-text"
                />
                <button
                  @click="savePreset"
                  :disabled="!newPresetName.trim()"
                  class="px-2 h-5 text-xs bg-imgui-button hover:bg-imgui-button-hover border border-imgui-border rounded text-imgui-text disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Reset button -->
        <button
          @click="parameterSystem.resetAllToDefaults()"
          class="px-2 h-5 text-xs bg-imgui-button hover:bg-imgui-button-hover border border-imgui-border rounded text-imgui-text-dim hover:text-imgui-text"
          title="Reset all parameters to defaults"
        >
          Reset
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ImGui-inspired color scheme */
.parameter-panel {
  --imgui-bg: #1a1a1a;
  --imgui-header: #242424;
  --imgui-header-hover: #2a2a2a;
  --imgui-group-header: #1e1e1e;
  --imgui-content: #1a1a1a;
  --imgui-border: #333;
  --imgui-text: #c8c8c8;
  --imgui-text-dim: #808080;
  --imgui-value: #9cd8ff;
  --imgui-accent: #4296fa;
  --imgui-input: #262626;
  --imgui-button: #3a3a3a;
  --imgui-button-hover: #4a4a4a;
  --imgui-slider-track: #333;
  --imgui-slider-fill: #4296fa;
  --imgui-slider-thumb: #c8c8c8;
}

.bg-imgui-bg { background-color: var(--imgui-bg); }
.bg-imgui-header { background-color: var(--imgui-header); }
.bg-imgui-header-hover { background-color: var(--imgui-header-hover); }
.bg-imgui-group-header { background-color: var(--imgui-group-header); }
.bg-imgui-content { background-color: var(--imgui-content); }
.bg-imgui-input { background-color: var(--imgui-input); }
.bg-imgui-button { background-color: var(--imgui-button); }
.bg-imgui-accent { background-color: var(--imgui-accent); }
.border-imgui-border { border-color: var(--imgui-border); }
.border-imgui-accent { border-color: var(--imgui-accent); }
.text-imgui-text { color: var(--imgui-text); }
.text-imgui-text-dim { color: var(--imgui-text-dim); }
.text-imgui-value { color: var(--imgui-value); }

.hover\:bg-imgui-header-hover:hover { background-color: var(--imgui-header-hover); }
.hover\:bg-imgui-button-hover:hover { background-color: var(--imgui-button-hover); }
.hover\:text-imgui-text:hover { color: var(--imgui-text); }

/* ImGui-style slider */
.imgui-slider {
  -webkit-appearance: none;
  appearance: none;
  background: var(--imgui-slider-track);
  border-radius: 2px;
  cursor: pointer;
}

.imgui-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 8px;
  height: 16px;
  background: var(--imgui-slider-thumb);
  border-radius: 2px;
  cursor: grab;
}

.imgui-slider::-webkit-slider-thumb:active {
  cursor: grabbing;
  background: var(--imgui-accent);
}

.imgui-slider::-moz-range-thumb {
  width: 8px;
  height: 16px;
  background: var(--imgui-slider-thumb);
  border-radius: 2px;
  border: none;
  cursor: grab;
}

.imgui-slider::-moz-range-thumb:active {
  cursor: grabbing;
  background: var(--imgui-accent);
}

/* ImGui-style select */
.imgui-select {
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%23808080'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 4px center;
  padding-right: 20px;
}

.imgui-select:focus {
  outline: none;
  border-color: var(--imgui-accent);
}

/* Parameter row */
.parameter-row {
  min-height: 20px;
}
</style>
