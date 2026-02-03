<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/70" @click="close"></div>

      <!-- Dialog -->
      <div class="relative bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl w-[480px] max-h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
          <h2 class="text-lg font-semibold text-white">Export Project</h2>
          <button @click="close" class="text-gray-400 hover:text-white">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-4 space-y-4 overflow-y-auto">
          <!-- Project Name -->
          <div>
            <label class="block text-sm text-gray-400 mb-1">Project Name</label>
            <input
              v-model="projectName"
              type="text"
              class="w-full bg-[#2d2d2d] border border-[#3c3c3c] rounded px-3 py-2 text-white focus:outline-none focus:border-[#007acc]"
            />
          </div>

          <!-- What's Included -->
          <div>
            <label class="block text-sm text-gray-400 mb-2">Included in Export</label>
            <div class="bg-[#2d2d2d] border border-[#3c3c3c] rounded p-3 space-y-2 text-sm">
              <div class="flex items-center text-gray-300">
                <svg class="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                {{ fileCount }} source file(s)
              </div>
              <div class="flex items-center text-gray-300">
                <svg class="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                Timeline &amp; keyframes
              </div>
              <div class="flex items-center text-gray-300">
                <svg class="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                Scene objects &amp; materials
              </div>
              <div class="flex items-center text-gray-300">
                <svg class="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                Environment settings
              </div>
              <div class="flex items-center text-gray-300">
                <svg class="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                Sequencer clips &amp; arrangement
              </div>
            </div>
          </div>

          <!-- Filename Preview -->
          <div class="text-sm text-gray-400">
            File will be saved as: <span class="text-white">{{ filename }}</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-[#3c3c3c]">
          <button
            @click="close"
            class="px-4 py-2 text-sm text-gray-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            @click="handleExport"
            class="px-4 py-2 text-sm bg-[#007acc] text-white rounded hover:bg-[#005a9e]"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '@/stores/project'
import { downloadProject } from '@/services/unifiedProject'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const projectStore = useProjectStore()

const projectName = ref(projectStore.project.name || 'Untitled Project')

const fileCount = computed(() => projectStore.files.length)

const filename = computed(() => {
  const safeName = projectName.value.replace(/[^a-zA-Z0-9-_]/g, '_')
  return `${safeName}.allolib`
})

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    projectName.value = projectStore.project.name || 'Untitled Project'
  }
})

function close() {
  emit('update:modelValue', false)
}

function handleExport() {
  // Update project name if changed
  if (projectName.value !== projectStore.project.name) {
    projectStore.project.name = projectName.value
  }

  downloadProject()
  close()
}
</script>
