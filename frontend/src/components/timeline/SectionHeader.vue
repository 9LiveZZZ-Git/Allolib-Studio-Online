<!--
  SectionHeader.vue

  Collapsible header for timeline track sections.
  Displays category icon, label, track count, and collapse toggle.
-->
<template>
  <div
    class="section-header"
    :style="headerStyle"
    @click="toggleCollapse"
  >
    <div class="header-left">
      <span class="collapse-icon" :class="{ collapsed }">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </span>
      <span class="category-icon">{{ icon }}</span>
      <span class="category-label">{{ label }}</span>
      <span class="track-count">({{ trackCount }})</span>
    </div>

    <div class="header-right" @click.stop>
      <button
        class="header-btn"
        :class="{ active: visible }"
        @click="toggleVisibility"
        :title="visible ? 'Hide tracks' : 'Show tracks'"
      >
        <svg width="14" height="14" viewBox="0 0 14 14">
          <template v-if="visible">
            <circle cx="7" cy="7" r="2.5" fill="currentColor" />
            <path
              d="M1 7C2.5 4 4.5 2.5 7 2.5C9.5 2.5 11.5 4 13 7C11.5 10 9.5 11.5 7 11.5C4.5 11.5 2.5 10 1 7Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
            />
          </template>
          <template v-else>
            <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" stroke-width="1.2" />
            <path
              d="M1 7C2.5 4 4.5 2.5 7 2.5C9.5 2.5 11.5 4 13 7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
            />
          </template>
        </svg>
      </button>

      <button
        v-if="showAddButton"
        class="header-btn add-btn"
        @click="$emit('add')"
        title="Add track"
      >
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="7" y1="3" x2="7" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TrackCategory } from '@/stores/timeline'

const props = defineProps<{
  category: TrackCategory
  label: string
  icon: string
  color: string
  headerColor: string
  collapsed: boolean
  visible: boolean
  trackCount: number
  showAddButton?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-collapse'): void
  (e: 'toggle-visibility'): void
  (e: 'add'): void
}>()

const headerStyle = computed(() => ({
  backgroundColor: props.headerColor,
  borderLeft: `3px solid ${props.color}`,
}))

function toggleCollapse() {
  emit('toggle-collapse')
}

function toggleVisibility() {
  emit('toggle-visibility')
}
</script>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  padding: 0 8px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;
}

.section-header:hover {
  filter: brightness(1.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.collapse-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.2s;
}

.collapse-icon.collapsed {
  transform: rotate(-90deg);
}

.category-icon {
  font-size: 14px;
}

.category-label {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.track-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: rgba(0, 0, 0, 0.2);
  border: none;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.15s;
}

.header-btn:hover {
  background: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.8);
}

.header-btn.active {
  color: rgba(255, 255, 255, 0.9);
}

.add-btn:hover {
  color: #68D391;
}
</style>
