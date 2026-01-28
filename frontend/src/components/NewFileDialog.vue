<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps<{
  isOpen: boolean
  existingFiles: string[]
  parentPath?: string
}>()

const emit = defineEmits<{
  create: [filename: string, parentPath: string]
  cancel: []
}>()

const filename = ref('')
const extension = ref('.hpp')
const inputRef = ref<HTMLInputElement>()

interface ExtOption {
  ext: string
  label: string
  description: string
  category: 'source' | 'data'
}

const extensionOptions: ExtOption[] = [
  { ext: '.cpp', label: '.cpp', description: 'C++ source file', category: 'source' },
  { ext: '.hpp', label: '.hpp', description: 'C++ header file (included by other files)', category: 'source' },
  { ext: '.h', label: '.h', description: 'C header file', category: 'source' },
  { ext: '.preset', label: '.preset', description: 'Synth preset — parameter values for a synthesizer voice', category: 'data' },
  { ext: '.synthSequence', label: '.synthSequence', description: 'Synth sequence — timed sequence of synth note events', category: 'data' },
  { ext: '.obj', label: '.obj', description: 'Wavefront OBJ — 3D mesh geometry (vertices, faces)', category: 'data' },
]

const currentOption = computed(() =>
  extensionOptions.find(o => o.ext === extension.value) || extensionOptions[0]
)

const fullFilename = computed(() => {
  if (!filename.value.trim()) return ''
  return filename.value.trim() + extension.value
})

const fullPath = computed(() => {
  if (!fullFilename.value) return ''
  return props.parentPath ? `${props.parentPath}/${fullFilename.value}` : fullFilename.value
})

const validationError = computed(() => {
  const name = filename.value.trim()

  if (!name) return null // No error shown for empty input

  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    return 'Name must start with a letter and contain only letters, numbers, underscores, or dashes'
  }

  if (name.length > 46) {
    return 'Filename too long'
  }

  if (props.existingFiles.some(f => f.toLowerCase() === fullPath.value.toLowerCase())) {
    return 'A file with this path already exists'
  }

  return null
})

const isValid = computed(() => {
  return filename.value.trim().length > 0 && !validationError.value
})

function handleCreate() {
  if (isValid.value) {
    emit('create', fullFilename.value, props.parentPath || '')
    filename.value = ''
    extension.value = '.hpp'
  }
}

function handleCancel() {
  filename.value = ''
  extension.value = '.hpp'
  emit('cancel')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    handleCancel()
  }
}

// Focus input when dialog opens
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
      <div class="bg-editor-bg border border-editor-border rounded-lg shadow-2xl w-[440px] max-w-[90vw]">
        <!-- Header -->
        <div class="px-4 py-3 border-b border-editor-border flex items-center justify-between">
          <h3 class="text-white font-medium">New File</h3>
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
            <span class="text-gray-400">Folder: </span>
            <span class="text-yellow-500 font-mono">{{ parentPath }}/</span>
          </div>

          <!-- Filename Input -->
          <div>
            <label class="block text-sm text-gray-400 mb-2">Filename</label>
            <div class="flex gap-2">
              <input
                ref="inputRef"
                v-model="filename"
                type="text"
                class="flex-1 px-3 py-2 bg-editor-active border border-editor-border rounded text-white placeholder-gray-500 focus:outline-none focus:border-allolib-blue transition-colors"
                placeholder="myfile"
                @keyup.enter="handleCreate"
              />
              <span class="px-3 py-2 bg-editor-sidebar border border-editor-border rounded text-gray-400 text-sm whitespace-nowrap">
                {{ extension }}
              </span>
            </div>
          </div>

          <!-- Extension Selector -->
          <div>
            <label class="block text-sm text-gray-400 mb-2">File Type</label>

            <!-- Source files row -->
            <div class="text-xs text-gray-500 mb-1">Source</div>
            <div class="flex gap-1.5 mb-2">
              <button
                v-for="opt in extensionOptions.filter(o => o.category === 'source')"
                :key="opt.ext"
                @click="extension = opt.ext"
                :class="[
                  'px-3 py-1.5 text-sm rounded transition-colors',
                  extension === opt.ext
                    ? 'bg-allolib-blue text-white'
                    : 'bg-editor-active text-gray-400 hover:text-white hover:bg-editor-border'
                ]"
              >
                {{ opt.label }}
              </button>
            </div>

            <!-- Data files row -->
            <div class="text-xs text-gray-500 mb-1">Data</div>
            <div class="flex gap-1.5">
              <button
                v-for="opt in extensionOptions.filter(o => o.category === 'data')"
                :key="opt.ext"
                @click="extension = opt.ext"
                :class="[
                  'px-3 py-1.5 text-sm rounded transition-colors',
                  extension === opt.ext
                    ? 'bg-allolib-blue text-white'
                    : 'bg-editor-active text-gray-400 hover:text-white hover:bg-editor-border'
                ]"
              >
                {{ opt.label }}
              </button>
            </div>

            <p class="mt-2 text-xs text-gray-500">
              {{ currentOption.description }}
            </p>
          </div>

          <!-- Preview -->
          <div v-if="fullFilename" class="text-sm">
            <span class="text-gray-400">Will create: </span>
            <span class="text-allolib-blue font-mono">{{ fullPath }}</span>
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
