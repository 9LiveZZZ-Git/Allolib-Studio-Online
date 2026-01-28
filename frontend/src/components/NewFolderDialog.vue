<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps<{
  isOpen: boolean
  existingFolders: string[]
  parentPath: string
}>()

const emit = defineEmits<{
  create: [folderName: string, parentPath: string]
  cancel: []
}>()

const folderName = ref('')
const inputRef = ref<HTMLInputElement>()

const fullPath = computed(() => {
  if (!folderName.value.trim()) return ''
  return props.parentPath ? `${props.parentPath}/${folderName.value.trim()}` : folderName.value.trim()
})

const validationError = computed(() => {
  const name = folderName.value.trim()

  if (!name) return null

  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    return 'Name must start with a letter and contain only letters, numbers, underscores, or dashes'
  }

  if (name.length > 30) {
    return 'Folder name too long'
  }

  if (props.existingFolders.some(f => f.toLowerCase() === fullPath.value.toLowerCase())) {
    return 'A folder with this name already exists'
  }

  return null
})

const isValid = computed(() => {
  return folderName.value.trim().length > 0 && !validationError.value
})

function handleCreate() {
  if (isValid.value) {
    emit('create', folderName.value.trim(), props.parentPath)
    folderName.value = ''
  }
}

function handleCancel() {
  folderName.value = ''
  emit('cancel')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    handleCancel()
  }
}

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    inputRef.value?.focus()
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      @click.self="handleCancel"
      @keydown="handleKeydown"
    >
      <div class="bg-editor-bg border border-editor-border rounded-lg shadow-2xl w-80 max-w-[90vw]">
        <!-- Header -->
        <div class="px-4 py-3 border-b border-editor-border flex items-center justify-between">
          <h3 class="text-white font-medium">New Folder</h3>
          <button
            @click="handleCancel"
            class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-4 space-y-4">
          <!-- Parent path indicator -->
          <div v-if="parentPath" class="text-sm">
            <span class="text-gray-400">Parent: </span>
            <span class="text-allolib-blue font-mono">{{ parentPath }}/</span>
          </div>

          <!-- Folder name input -->
          <div>
            <label class="block text-sm text-gray-400 mb-2">Folder Name</label>
            <input
              ref="inputRef"
              v-model="folderName"
              type="text"
              class="w-full px-3 py-2 bg-editor-active border border-editor-border rounded text-white placeholder-gray-500 focus:outline-none focus:border-allolib-blue transition-colors"
              placeholder="src"
              @keyup.enter="handleCreate"
            />
          </div>

          <!-- Preview -->
          <div v-if="fullPath" class="text-sm">
            <span class="text-gray-400">Will create: </span>
            <span class="text-yellow-500 font-mono">{{ fullPath }}/</span>
          </div>

          <!-- Error Message -->
          <p v-if="validationError" class="text-red-400 text-sm">
            {{ validationError }}
          </p>
        </div>

        <!-- Footer -->
        <div class="px-4 py-3 border-t border-editor-border flex justify-end gap-2">
          <button
            @click="handleCancel"
            class="px-4 py-1.5 text-gray-300 hover:text-white hover:bg-editor-active rounded transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleCreate"
            :disabled="!isValid"
            class="px-4 py-1.5 bg-allolib-blue hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
