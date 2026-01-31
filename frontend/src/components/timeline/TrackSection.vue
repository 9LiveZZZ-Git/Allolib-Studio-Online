<!--
  TrackSection.vue

  Collapsible section container for a track category.
  Contains the section header and a slot for track content.
-->
<template>
  <div class="track-section" :class="{ collapsed, hidden: !visible }">
    <SectionHeader
      :category="category"
      :label="label"
      :icon="icon"
      :color="color"
      :headerColor="headerColor"
      :collapsed="collapsed"
      :visible="visible"
      :trackCount="trackCount"
      :showAddButton="showAddButton"
      @toggle-collapse="$emit('toggle-collapse')"
      @toggle-visibility="$emit('toggle-visibility')"
      @add="$emit('add')"
    />

    <Transition name="section">
      <div
        v-show="!collapsed && visible"
        class="section-content"
        :style="contentStyle"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SectionHeader from './SectionHeader.vue'
import type { TrackCategory } from '@/stores/timeline'

const props = defineProps<{
  category: TrackCategory
  label: string
  icon: string
  color: string
  headerColor: string
  trackBg: string
  collapsed: boolean
  visible: boolean
  trackCount: number
  showAddButton?: boolean
}>()

defineEmits<{
  (e: 'toggle-collapse'): void
  (e: 'toggle-visibility'): void
  (e: 'add'): void
}>()

const contentStyle = computed(() => ({
  backgroundColor: props.trackBg,
}))
</script>

<style scoped>
.track-section {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.track-section.hidden {
  display: none;
}

.section-content {
  overflow: hidden;
}

/* Collapse animation */
.section-enter-active,
.section-leave-active {
  transition: all 0.2s ease;
}

.section-enter-from,
.section-leave-to {
  opacity: 0;
  max-height: 0;
}

.section-enter-to,
.section-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>
