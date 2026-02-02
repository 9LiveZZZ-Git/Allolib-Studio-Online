<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { AppStatus } from '@/stores/app'
import { useSettingsStore } from '@/stores/settings'
import {
  categoryGroups,
  allExamples,
  getExamplesBySubcategory,
  isMultiFileExample,
  type AnyExample,
  type ExampleCategory,
  type MultiFileExample,
  type Example
} from '@/data/examples'
import {
  glossary,
  categories as glossaryCategories,
  getEntriesByCategory,
  searchGlossary,
  type GlossaryEntry
} from '@/data/glossary'
import ExampleDialog from './ExampleDialog.vue'
import { downloadProject, importProjectFile, newProject } from '@/services/unifiedProject'

const props = defineProps<{
  status: AppStatus
}>()

const settings = useSettingsStore()

const emit = defineEmits<{
  run: []
  stop: []
  loadExample: [code: string]
  addExampleToProject: [example: AnyExample]
  replaceProjectWithExample: [example: AnyExample]
  settingsChanged: []
  fileNew: []
  fileSave: []
  fileSaveAs: []
  fileOpen: []
  fileOpenFromDisk: []
  fileExport: []
  fileExportZip: []
  importNative: []
  exportNative: []
  showExportNativeDialog: []
  showImportNativeDialog: []
}>()

// File menu state
const showFileMenu = ref(false)

// Run menu state
const showRunMenu = ref(false)

function closeFileMenu() {
  showFileMenu.value = false
}

function handleFileAction(action: string) {
  closeFileMenu()
  switch (action) {
    case 'new': emit('fileNew'); break
    case 'save': emit('fileSave'); break
    case 'saveAs': emit('fileSaveAs'); break
    case 'open': emit('fileOpen'); break
    case 'openFromDisk': emit('fileOpenFromDisk'); break
    case 'export': emit('fileExport'); break
    case 'exportZip': emit('fileExportZip'); break
    case 'importNative': emit('importNative'); break
    case 'exportNative': emit('exportNative'); break
    case 'showExportNativeDialog': emit('showExportNativeDialog'); break
    case 'showImportNativeDialog': emit('showImportNativeDialog'); break
  }
}

// Project import/export handlers
const projectFileInput = ref<HTMLInputElement | null>(null)

function handleProjectExport() {
  closeFileMenu()
  downloadProject()
}

function handleProjectImport() {
  closeFileMenu()
  // Create a file input and trigger it
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.allolib'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      try {
        await importProjectFile(file)
        // Reload the page to ensure all components reflect the new state
        window.location.reload()
      } catch (error) {
        console.error('Failed to import project:', error)
        alert('Failed to import project. Please check the file format.')
      }
    }
  }
  input.click()
}

// Settings dropdown state
const showSettings = ref(false)
const activeSettingsTab = ref<'editor' | 'audio' | 'compiler' | 'display' | 'graphics'>('editor')
const showLODDistances = ref(false)

function closeSettings() {
  showSettings.value = false
}

function handleSettingChange() {
  emit('settingsChanged')
}

// WebGPU backend handling
interface WebGPUStatus {
  available: boolean
  message: string
}

const webgpuStatus = ref<WebGPUStatus | null>(null)
const backendChanged = ref(false)
const initialBackendType = ref(settings.graphics.backendType)

// Watch for status changes to reset backend changed flag
watch(() => props.status, (newStatus) => {
  if (newStatus === 'running' || newStatus === 'compiling') {
    // Reset backend changed flag when app is re-run
    initialBackendType.value = settings.graphics.backendType
    backendChanged.value = false
  }
})

// Check WebGPU availability on mount
async function checkWebGPUAvailability() {
  if (!navigator.gpu) {
    webgpuStatus.value = {
      available: false,
      message: 'WebGPU not supported in this browser'
    }
    return
  }

  try {
    const adapter = await navigator.gpu.requestAdapter()
    if (adapter) {
      const info = await adapter.requestAdapterInfo?.() || {}
      webgpuStatus.value = {
        available: true,
        message: `WebGPU available: ${info.vendor || 'GPU'} ${info.architecture || ''}`
      }
    } else {
      webgpuStatus.value = {
        available: false,
        message: 'WebGPU adapter not available'
      }
    }
  } catch (e) {
    webgpuStatus.value = {
      available: false,
      message: 'WebGPU check failed: ' + (e as Error).message
    }
  }
}

// Check on component mount
checkWebGPUAvailability()

function handleBackendChange() {
  const backend = settings.graphics.backendType
  console.log('[Settings] Backend changed to:', backend)

  // Track if backend was changed from initial value
  backendChanged.value = backend !== initialBackendType.value

  // Store the preference - it will be used on next app start/reload
  handleSettingChange()

  // Notify user that a reload is required
  const w = window as any
  if (w.allolib?.setBackendType) {
    // If runtime supports dynamic backend switching (future)
    w.allolib.setBackendType(backend)
  } else {
    // Show a notification that reload is required
    console.log('[Settings] Backend change will take effect on next compile/run')
  }
}

// Reset backendChanged flag when app is re-run
function resetBackendChanged() {
  initialBackendType.value = settings.graphics.backendType
  backendChanged.value = false
}

const statusColors: Record<AppStatus, string> = {
  idle: 'text-gray-500',
  compiling: 'text-yellow-400',
  loading: 'text-blue-400',
  running: 'text-green-400',
  error: 'text-red-400',
}

const statusLabels: Record<AppStatus, string> = {
  idle: 'Ready',
  compiling: 'Compiling...',
  loading: 'Loading...',
  running: 'Running',
  error: 'Error',
}

// Examples dropdown state
const showExamples = ref(false)
const expandedGroup = ref<string | null>(null)
const expandedCategory = ref<string | null>(null)
const expandedSubcategory = ref<string | null>(null)

// Example dialog state
const showExampleDialog = ref(false)
const selectedExample = ref<AnyExample | null>(null)

function toggleGroup(groupId: string) {
  if (expandedGroup.value === groupId) {
    expandedGroup.value = null
    expandedCategory.value = null
    expandedSubcategory.value = null
  } else {
    expandedGroup.value = groupId
    expandedCategory.value = null
    expandedSubcategory.value = null
  }
}

function toggleCategory(catId: string) {
  if (expandedCategory.value === catId) {
    expandedCategory.value = null
    expandedSubcategory.value = null
  } else {
    expandedCategory.value = catId
    expandedSubcategory.value = null
  }
}

function toggleSubcategory(subId: string) {
  if (expandedSubcategory.value === subId) {
    expandedSubcategory.value = null
  } else {
    expandedSubcategory.value = subId
  }
}

function getExamplesForSubcategory(catId: string, subId: string): AnyExample[] {
  return getExamplesBySubcategory(catId, subId)
}

function selectExample(example: AnyExample) {
  selectedExample.value = example
  showExampleDialog.value = true
  showExamples.value = false
}

function handleAddToProject(example: AnyExample) {
  emit('addExampleToProject', example)
  showExampleDialog.value = false
  selectedExample.value = null
  expandedGroup.value = null
  expandedCategory.value = null
  expandedSubcategory.value = null
}

function handleReplaceProject(example: AnyExample) {
  emit('replaceProjectWithExample', example)
  showExampleDialog.value = false
  selectedExample.value = null
  expandedGroup.value = null
  expandedCategory.value = null
  expandedSubcategory.value = null
}

function closeExampleDialog() {
  showExampleDialog.value = false
  selectedExample.value = null
}

function closeDropdown() {
  showExamples.value = false
  expandedGroup.value = null
  expandedCategory.value = null
  expandedSubcategory.value = null
}

// Glossary state
const showGlossary = ref(false)
const glossarySearch = ref('')
const selectedGlossaryCategory = ref<string | null>(null)
const selectedEntry = ref<GlossaryEntry | null>(null)
const platformFilter = ref<'all' | 'native' | 'web' | 'both'>('all')

const filteredGlossary = computed(() => {
  let entries = glossarySearch.value
    ? searchGlossary(glossarySearch.value)
    : selectedGlossaryCategory.value
      ? getEntriesByCategory(selectedGlossaryCategory.value)
      : glossary

  if (platformFilter.value !== 'all') {
    entries = entries.filter(e =>
      e.platforms.includes(platformFilter.value as 'native' | 'web' | 'both') ||
      (platformFilter.value === 'both' && e.platforms.includes('both'))
    )
  }

  return entries.sort((a, b) => a.term.localeCompare(b.term))
})

function openGlossary() {
  showGlossary.value = true
  glossarySearch.value = ''
  selectedGlossaryCategory.value = null
  selectedEntry.value = null
}

function closeGlossary() {
  showGlossary.value = false
}

function selectGlossaryCategory(catId: string | null) {
  selectedGlossaryCategory.value = catId
  glossarySearch.value = ''
  selectedEntry.value = null
}

function selectGlossaryEntry(entry: GlossaryEntry) {
  selectedEntry.value = entry
}

function getPlatformBadgeClass(platform: string) {
  switch (platform) {
    case 'both': return 'bg-green-600'
    case 'native': return 'bg-blue-600'
    case 'web': return 'bg-purple-600'
    default: return 'bg-gray-600'
  }
}
</script>

<template>
  <header class="h-12 bg-editor-sidebar border-b border-editor-border flex items-center px-4 gap-4">
    <!-- Logo -->
    <div class="flex items-center gap-2">
      <span class="text-allolib-blue font-semibold">AlloLib Studio</span>
      <span class="text-gray-500 text-sm">Online</span>
    </div>

    <!-- File Menu -->
    <div class="relative">
      <button
        class="px-3 py-1.5 hover:bg-editor-active rounded text-sm transition-colors flex items-center gap-1"
        @click="showFileMenu = !showFileMenu"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Project
        <svg class="w-3 h-3" :class="{ 'rotate-180': showFileMenu }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Project Menu Dropdown -->
      <div
        v-if="showFileMenu"
        class="absolute left-0 top-full mt-1 w-56 bg-editor-bg border border-editor-border rounded-lg shadow-xl z-50 py-1"
        @click.stop
      >
        <button
          @click="handleFileAction('new')"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>New</span>
          <span class="ml-auto text-xs text-gray-500">Ctrl+N</span>
        </button>

        <div class="border-t border-editor-border my-1"></div>

        <button
          @click="handleFileAction('open')"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
          <span>Open from Browser</span>
          <span class="ml-auto text-xs text-gray-500">Ctrl+O</span>
        </button>

        <button
          @click="handleFileAction('openFromDisk')"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>Open from File...</span>
        </button>

        <div class="border-t border-editor-border my-1"></div>

        <button
          @click="handleFileAction('save')"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span>Save</span>
          <span class="ml-auto text-xs text-gray-500">Ctrl+S</span>
        </button>

        <button
          @click="handleFileAction('saveAs')"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span>Save As...</span>
          <span class="ml-auto text-xs text-gray-500">Ctrl+Shift+S</span>
        </button>

        <div class="border-t border-editor-border my-1"></div>

        <button
          @click="handleFileAction('export')"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Export as .cpp</span>
        </button>

        <button
          @click="handleFileAction('exportZip')"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <span>Export Project as ZIP</span>
        </button>

        <div class="border-t border-editor-border my-1"></div>

        <div class="px-4 py-1 text-xs text-gray-500 font-medium">Full Project (with Timeline)</div>

        <button
          @click="handleProjectExport()"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Export as .allolib Project</span>
        </button>

        <button
          @click="handleProjectImport()"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>Import .allolib Project...</span>
        </button>

        <div class="border-t border-editor-border my-1"></div>

        <div class="px-4 py-1 text-xs text-gray-500 font-medium">Cross-Platform</div>

        <button
          @click="handleFileAction('importNative')"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span>Import Native AlloLib...</span>
        </button>

        <button
          @click="handleFileAction('exportNative')"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <span>Export for Desktop AlloLib</span>
        </button>

        <div class="border-t border-editor-border my-1"></div>

        <div class="px-4 py-1 text-xs text-gray-500 font-medium">Full Project Export</div>

        <button
          @click="handleFileAction('showExportNativeDialog')"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span>Export Native C++ Project...</span>
        </button>

        <button
          @click="handleFileAction('showImportNativeDialog')"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
        >
          <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1-4l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span>Import Native C++ Project...</span>
        </button>
      </div>

      <!-- Click outside to close -->
      <div
        v-if="showFileMenu"
        class="fixed inset-0 z-40"
        @click="closeFileMenu"
      ></div>
    </div>

    <!-- Run/Stop Button with dropdown -->
    <div class="relative flex" v-if="status === 'idle' || status === 'error'">
      <button
        class="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-l text-sm font-medium transition-colors flex items-center gap-2"
        @click="emit('run')"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
        </svg>
        {{ settings.compiler.runMode === 'project' ? 'Run Project' : 'Run File' }}
      </button>
      <button
        class="px-1.5 py-1.5 bg-green-600 hover:bg-green-700 rounded-r border-l border-green-700 transition-colors"
        @click="showRunMenu = !showRunMenu"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Run Menu Dropdown -->
      <div
        v-if="showRunMenu"
        class="absolute left-0 top-full mt-1 w-48 bg-editor-bg border border-editor-border rounded-lg shadow-xl z-50 py-1"
      >
        <button
          @click="settings.compiler.runMode = 'project'; showRunMenu = false"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
          :class="{ 'text-allolib-blue': settings.compiler.runMode === 'project' }"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span>Run Project</span>
          <svg v-if="settings.compiler.runMode === 'project'" class="w-4 h-4 ml-auto text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </button>
        <button
          @click="settings.compiler.runMode = 'file'; showRunMenu = false"
          class="w-full px-4 py-2 text-left text-sm hover:bg-editor-active flex items-center gap-3"
          :class="{ 'text-allolib-blue': settings.compiler.runMode === 'file' }"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Run Active File</span>
          <svg v-if="settings.compiler.runMode === 'file'" class="w-4 h-4 ml-auto text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </button>
        <div class="border-t border-editor-border my-1"></div>
        <div class="px-4 py-2 text-xs text-gray-500">
          <strong>Project:</strong> Compiles all source files<br>
          <strong>File:</strong> Compiles only active file
        </div>
      </div>

      <!-- Click outside to close -->
      <div
        v-if="showRunMenu"
        class="fixed inset-0 z-40"
        @click="showRunMenu = false"
      ></div>
    </div>
    <button
      v-else-if="status === 'running'"
      class="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors flex items-center gap-2"
      @click="emit('stop')"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <rect x="4" y="4" width="12" height="12" rx="1" />
      </svg>
      Stop
    </button>
    <button
      v-else
      class="px-4 py-1.5 bg-gray-600 rounded text-sm font-medium cursor-not-allowed flex items-center gap-2"
      disabled
    >
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {{ status === 'compiling' ? 'Compiling' : 'Loading' }}
    </button>

    <!-- Status indicator -->
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full" :class="status === 'running' ? 'bg-green-400 animate-pulse' : status === 'error' ? 'bg-red-400' : 'bg-gray-500'"></span>
      <span class="text-xs" :class="statusColors[status]">{{ statusLabels[status] }}</span>
    </div>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Examples Dropdown -->
    <div class="relative">
      <button
        class="px-3 py-1.5 hover:bg-editor-active rounded text-sm transition-colors flex items-center gap-1"
        @click="showExamples = !showExamples"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        Examples
        <svg class="w-3 h-3 ml-1" :class="{ 'rotate-180': showExamples }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Dropdown Panel -->
      <div
        v-if="showExamples"
        class="absolute right-0 top-full mt-1 w-96 max-h-[80vh] overflow-y-auto bg-editor-bg border border-editor-border rounded-lg shadow-xl z-50"
      >
        <!-- Header -->
        <div class="sticky top-0 bg-editor-sidebar px-4 py-2 border-b border-editor-border">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Example Code</span>
            <button @click="closeDropdown" class="text-gray-400 hover:text-white">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Category Groups -->
        <div class="py-1">
          <div v-for="group in categoryGroups" :key="group.id" class="border-b border-editor-border last:border-b-0">
            <!-- Group Header (AlloLib / AlloLib Playground) -->
            <button
              class="w-full px-4 py-2.5 text-left font-semibold hover:bg-editor-active flex items-center justify-between"
              :class="expandedGroup === group.id ? 'bg-editor-active text-allolib-blue' : 'text-white'"
              @click="toggleGroup(group.id)"
            >
              <span class="flex items-center gap-2">
                <svg v-if="group.id === 'allolib'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <svg v-else-if="group.id === 'studio'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                </svg>
                <svg v-else-if="group.id === 'gpu'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <!-- GPU/Chip icon -->
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                {{ group.title }}
              </span>
              <svg
                class="w-4 h-4 transition-transform"
                :class="{ 'rotate-90': expandedGroup === group.id }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <!-- Categories within Group -->
            <div v-if="expandedGroup === group.id" class="bg-editor-sidebar/50">
              <div v-for="category in group.categories" :key="category.id" class="border-t border-editor-border/50">
                <!-- Category Header -->
                <button
                  class="w-full pl-6 pr-4 py-2 text-left text-sm font-medium hover:bg-editor-active flex items-center justify-between"
                  @click="toggleCategory(category.id)"
                >
                  <span>{{ category.title }}</span>
                  <svg
                    class="w-4 h-4 transition-transform"
                    :class="{ 'rotate-90': expandedCategory === category.id }"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <!-- Subcategories -->
                <div v-if="expandedCategory === category.id && category.subcategories" class="bg-editor-sidebar">
                  <div v-for="sub in category.subcategories" :key="sub.id">
                    <!-- Subcategory Header -->
                    <button
                      class="w-full pl-10 pr-4 py-1.5 text-left text-sm text-gray-300 hover:bg-editor-active flex items-center justify-between"
                      @click="toggleSubcategory(sub.id)"
                    >
                      <span>{{ sub.title }}</span>
                      <svg
                        class="w-3 h-3 transition-transform"
                        :class="{ 'rotate-90': expandedSubcategory === sub.id }"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    <!-- Examples in Subcategory -->
                    <div v-if="expandedSubcategory === sub.id" class="bg-editor-bg">
                      <button
                        v-for="example in getExamplesForSubcategory(category.id, sub.id)"
                        :key="example.id"
                        class="w-full pl-14 pr-4 py-2 text-left hover:bg-editor-active group"
                        @click="selectExample(example)"
                      >
                        <div class="flex items-center gap-2">
                          <span class="text-sm text-allolib-blue group-hover:text-white">{{ example.title }}</span>
                          <span
                            v-if="'files' in example"
                            class="text-[10px] px-1.5 py-0.5 bg-purple-600/30 text-purple-300 rounded"
                          >
                            {{ example.files.length }} files
                          </span>
                        </div>
                        <div class="text-xs text-gray-500 group-hover:text-gray-400">{{ example.description }}</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="sticky bottom-0 bg-editor-sidebar px-4 py-2 border-t border-editor-border">
          <div class="text-xs text-gray-500 text-center">
            {{ allExamples.length }} examples available
          </div>
        </div>
      </div>

      <!-- Click outside to close -->
      <div
        v-if="showExamples"
        class="fixed inset-0 z-40"
        @click="closeDropdown"
      ></div>
    </div>

    <!-- Settings Dropdown -->
    <div class="relative">
      <button
        class="px-3 py-1.5 hover:bg-editor-active rounded text-sm transition-colors flex items-center gap-1"
        @click="showSettings = !showSettings"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Settings
        <svg class="w-3 h-3 ml-1" :class="{ 'rotate-180': showSettings }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Settings Panel -->
      <div
        v-if="showSettings"
        class="absolute right-0 top-full mt-1 w-96 bg-editor-bg border border-editor-border rounded-lg shadow-xl z-50"
        @click.stop
      >
        <!-- Header with tabs -->
        <div class="flex items-center border-b border-editor-border">
          <button
            v-for="tab in ['editor', 'audio', 'compiler', 'display', 'graphics'] as const"
            :key="tab"
            :class="[
              'flex-1 px-3 py-2 text-xs font-medium transition-colors capitalize',
              activeSettingsTab === tab
                ? 'text-allolib-blue border-b-2 border-allolib-blue bg-editor-sidebar'
                : 'text-gray-400 hover:text-white hover:bg-editor-active'
            ]"
            @click="activeSettingsTab = tab"
          >
            {{ tab }}
          </button>
          <button @click="closeSettings" class="px-3 py-2 text-gray-400 hover:text-white">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Editor Settings -->
        <div v-if="activeSettingsTab === 'editor'" class="p-4 space-y-4">
          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Font Size</label>
            <select
              v-model.number="settings.editor.fontSize"
              @change="handleSettingChange"
              class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
            >
              <option v-for="size in [10, 12, 14, 16, 18, 20, 22, 24]" :key="size" :value="size">{{ size }}px</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Tab Size</label>
            <select
              v-model.number="settings.editor.tabSize"
              @change="handleSettingChange"
              class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
            >
              <option v-for="size in [2, 4, 8]" :key="size" :value="size">{{ size }} spaces</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Word Wrap</label>
            <select
              v-model="settings.editor.wordWrap"
              @change="handleSettingChange"
              class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
            >
              <option value="off">Off</option>
              <option value="on">On</option>
              <option value="wordWrapColumn">At Column</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Line Numbers</label>
            <select
              v-model="settings.editor.lineNumbers"
              @change="handleSettingChange"
              class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
            >
              <option value="on">On</option>
              <option value="off">Off</option>
              <option value="relative">Relative</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Minimap</label>
            <button
              @click="settings.editor.minimap = !settings.editor.minimap; handleSettingChange()"
              :class="[
                'w-12 h-6 rounded-full transition-colors relative',
                settings.editor.minimap ? 'bg-allolib-blue' : 'bg-gray-600'
              ]"
            >
              <span
                :class="[
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  settings.editor.minimap ? 'left-7' : 'left-1'
                ]"
              />
            </button>
          </div>

          <button
            @click="settings.resetEditor(); handleSettingChange()"
            class="w-full py-1.5 text-xs text-gray-400 hover:text-white hover:bg-editor-active rounded transition-colors"
          >
            Reset Editor Settings
          </button>
        </div>

        <!-- Audio Settings -->
        <div v-if="activeSettingsTab === 'audio'" class="p-4 space-y-4">
          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Sample Rate</label>
            <select
              v-model.number="settings.audio.sampleRate"
              @change="handleSettingChange"
              class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
            >
              <option :value="44100">44100 Hz</option>
              <option :value="48000">48000 Hz</option>
              <option :value="96000">96000 Hz</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Buffer Size</label>
            <select
              v-model.number="settings.audio.bufferSize"
              @change="handleSettingChange"
              class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
            >
              <option :value="128">128 (Low latency)</option>
              <option :value="256">256</option>
              <option :value="512">512</option>
              <option :value="1024">1024</option>
              <option :value="2048">2048 (Stable)</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Channels</label>
            <select
              v-model.number="settings.audio.channels"
              @change="handleSettingChange"
              class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
            >
              <option :value="1">Mono</option>
              <option :value="2">Stereo</option>
            </select>
          </div>

          <!-- Safety Limiter Section -->
          <div class="border-t border-editor-border pt-3 mt-3">
            <div class="text-xs text-gray-400 mb-2 font-medium">Safety Limiter</div>

            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Enable Limiter</label>
              <button
                @click="settings.audio.limiterEnabled = !settings.audio.limiterEnabled; handleSettingChange()"
                :class="[
                  'w-12 h-6 rounded-full transition-colors relative',
                  settings.audio.limiterEnabled ? 'bg-allolib-blue' : 'bg-gray-600'
                ]"
              >
                <span
                  :class="[
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                    settings.audio.limiterEnabled ? 'left-7' : 'left-1'
                  ]"
                />
              </button>
            </div>

            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Threshold</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  v-model.number="settings.audio.limiterThreshold"
                  @input="handleSettingChange()"
                  min="-12"
                  max="0"
                  step="0.5"
                  class="w-20 accent-allolib-blue"
                  :disabled="!settings.audio.limiterEnabled"
                />
                <span class="text-xs text-gray-400 w-12 text-right">{{ settings.audio.limiterThreshold }} dB</span>
              </div>
            </div>

            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Soft Clip</label>
              <button
                @click="settings.audio.softClipEnabled = !settings.audio.softClipEnabled; handleSettingChange()"
                :class="[
                  'w-12 h-6 rounded-full transition-colors relative',
                  settings.audio.softClipEnabled ? 'bg-orange-500' : 'bg-gray-600'
                ]"
              >
                <span
                  :class="[
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                    settings.audio.softClipEnabled ? 'left-7' : 'left-1'
                  ]"
                />
              </button>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-sm text-gray-300">Drive</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  v-model.number="settings.audio.softClipDrive"
                  @input="handleSettingChange()"
                  min="1"
                  max="4"
                  step="0.1"
                  class="w-20 accent-orange-500"
                  :disabled="!settings.audio.softClipEnabled"
                />
                <span class="text-xs text-gray-400 w-12 text-right">{{ settings.audio.softClipDrive.toFixed(1) }}x</span>
              </div>
            </div>
          </div>

          <div class="text-xs text-gray-500 bg-editor-sidebar p-2 rounded">
            The safety limiter prevents clipping and protects your speakers. Soft clip adds gentle saturation before hard limiting.</div>

          <button
            @click="settings.resetAudio(); handleSettingChange()"
            class="w-full py-1.5 text-xs text-gray-400 hover:text-white hover:bg-editor-active rounded transition-colors"
          >
            Reset Audio Settings
          </button>
        </div>

        <!-- Compiler Settings -->
        <div v-if="activeSettingsTab === 'compiler'" class="p-4 space-y-4">
          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Optimization Level</label>
            <select
              v-model="settings.compiler.optimization"
              @change="handleSettingChange"
              class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
            >
              <option value="O0">-O0 (None, fastest compile)</option>
              <option value="O1">-O1 (Basic)</option>
              <option value="O2">-O2 (Recommended)</option>
              <option value="O3">-O3 (Aggressive)</option>
              <option value="Os">-Os (Size optimized)</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Debug Info</label>
            <button
              @click="settings.compiler.debugInfo = !settings.compiler.debugInfo; handleSettingChange()"
              :class="[
                'w-12 h-6 rounded-full transition-colors relative',
                settings.compiler.debugInfo ? 'bg-allolib-blue' : 'bg-gray-600'
              ]"
            >
              <span
                :class="[
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  settings.compiler.debugInfo ? 'left-7' : 'left-1'
                ]"
              />
            </button>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Show Warnings</label>
            <button
              @click="settings.compiler.warnings = !settings.compiler.warnings; handleSettingChange()"
              :class="[
                'w-12 h-6 rounded-full transition-colors relative',
                settings.compiler.warnings ? 'bg-allolib-blue' : 'bg-gray-600'
              ]"
            >
              <span
                :class="[
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  settings.compiler.warnings ? 'left-7' : 'left-1'
                ]"
              />
            </button>
          </div>

          <div class="text-xs text-gray-500 bg-editor-sidebar p-2 rounded">
            Higher optimization levels produce faster code but increase compile time. Debug info enables better error messages but increases binary size.
          </div>

          <button
            @click="settings.resetCompiler(); handleSettingChange()"
            class="w-full py-1.5 text-xs text-gray-400 hover:text-white hover:bg-editor-active rounded transition-colors"
          >
            Reset Compiler Settings
          </button>
        </div>

        <!-- Display Settings -->
        <div v-if="activeSettingsTab === 'display'" class="p-4 space-y-4">
          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Show Toolbar Panel</label>
            <button
              @click="settings.display.showAnalysisPanel = !settings.display.showAnalysisPanel; handleSettingChange()"
              :class="[
                'w-12 h-6 rounded-full transition-colors relative',
                settings.display.showAnalysisPanel ? 'bg-allolib-blue' : 'bg-gray-600'
              ]"
            >
              <span
                :class="[
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  settings.display.showAnalysisPanel ? 'left-7' : 'left-1'
                ]"
              />
            </button>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Panel Height</label>
            <div class="flex items-center gap-2">
              <input
                type="range"
                v-model.number="settings.display.analysisPanelHeight"
                @input="handleSettingChange()"
                min="100"
                max="400"
                step="10"
                class="w-24 accent-allolib-blue"
              />
              <span class="text-xs text-gray-400 w-12 text-right">{{ settings.display.analysisPanelHeight }}px</span>
            </div>
          </div>

          <!-- Asset Loading Test Panel (Development) -->
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm text-gray-300">Asset Loading Test</label>
              <div class="text-xs text-gray-500">Debug panel for asset streaming</div>
            </div>
            <button
              @click="settings.display.showAssetLoadingTest = !settings.display.showAssetLoadingTest; handleSettingChange()"
              :class="[
                'w-12 h-6 rounded-full transition-colors relative',
                settings.display.showAssetLoadingTest ? 'bg-allolib-blue' : 'bg-gray-600'
              ]"
            >
              <span
                :class="[
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  settings.display.showAssetLoadingTest ? 'left-7' : 'left-1'
                ]"
              />
            </button>
          </div>

          <div class="border-t border-editor-border pt-3 mt-3">
            <div class="flex items-center justify-between">
              <label class="text-sm text-gray-300">Default Point Size</label>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  v-model.number="settings.display.defaultPointSize"
                  @input="handleSettingChange()"
                  min="0.1"
                  max="20"
                  step="0.1"
                  class="w-16 px-2 py-1 bg-editor-bg border border-editor-border rounded text-sm text-white text-right"
                />
              </div>
            </div>
            <div class="text-xs text-gray-500 mt-1">
              Controls gl_PointSize for particle rendering (0.1 - 20)
            </div>
          </div>

          <button
            @click="settings.resetDisplay(); handleSettingChange()"
            class="w-full py-1.5 text-xs text-gray-400 hover:text-white hover:bg-editor-active rounded transition-colors"
          >
            Reset Display Settings
          </button>
        </div>

        <!-- Graphics Settings -->
        <div v-if="activeSettingsTab === 'graphics'" class="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <!-- Backend Selection (Phase 1 WebGPU support) -->
          <div class="border border-allolib-blue/30 rounded-lg p-3 bg-allolib-blue/5">
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm text-gray-300 font-medium">Graphics Backend</label>
              <select
                v-model="settings.graphics.backendType"
                @change="handleBackendChange"
                class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
              >
                <option value="webgl2">WebGL2 (Stable)</option>
                <option value="webgpu">WebGPU (Compute)</option>
                <option value="auto">Auto-detect</option>
              </select>
            </div>
            <p class="text-xs text-gray-500">
              <span v-if="settings.graphics.backendType === 'webgl2'">WebGL2: Maximum compatibility, works in all browsers</span>
              <span v-else-if="settings.graphics.backendType === 'webgpu'">WebGPU: Modern API with compute shader support (Chrome 113+, Edge 113+)</span>
              <span v-else>Auto: Uses WebGPU if available, falls back to WebGL2</span>
            </p>
            <p v-if="webgpuStatus" class="text-xs mt-1" :class="webgpuStatus.available ? 'text-green-400' : 'text-orange-400'">
              {{ webgpuStatus.message }}
            </p>
            <div v-if="backendChanged" class="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
              <p class="text-xs text-yellow-400">
                Backend change requires recompilation. Click "Run" to apply.
              </p>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Quality Preset</label>
            <select
              v-model="settings.graphics.qualityPreset"
              @change="settings.applyQualityPreset(settings.graphics.qualityPreset); handleSettingChange()"
              class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
            >
              <option value="auto">Auto (Adaptive)</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="ultra">Ultra</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Target FPS</label>
            <select
              v-model.number="settings.graphics.targetFPS"
              @change="handleSettingChange"
              class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
            >
              <option :value="30">30 FPS</option>
              <option :value="60">60 FPS</option>
              <option :value="120">120 FPS</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm text-gray-300">Resolution Scale</label>
            <div class="flex items-center gap-2">
              <input
                type="range"
                v-model.number="settings.graphics.resolutionScale"
                @input="handleSettingChange()"
                min="0.25"
                max="1.5"
                step="0.05"
                class="w-20 accent-allolib-blue"
              />
              <span class="text-xs text-gray-400 w-12 text-right">{{ (settings.graphics.resolutionScale * 100).toFixed(0) }}%</span>
            </div>
          </div>

          <div class="border-t border-editor-border pt-3 mt-3">
            <div class="text-xs text-gray-400 mb-2 font-medium">Effects</div>

            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Shadows</label>
              <button
                @click="settings.graphics.shadowsEnabled = !settings.graphics.shadowsEnabled; handleSettingChange()"
                :class="[
                  'w-12 h-6 rounded-full transition-colors relative',
                  settings.graphics.shadowsEnabled ? 'bg-allolib-blue' : 'bg-gray-600'
                ]"
              >
                <span
                  :class="[
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                    settings.graphics.shadowsEnabled ? 'left-7' : 'left-1'
                  ]"
                />
              </button>
            </div>

            <div v-if="settings.graphics.shadowsEnabled" class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Shadow Quality</label>
              <select
                v-model.number="settings.graphics.shadowMapSize"
                @change="handleSettingChange"
                class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
              >
                <option :value="256">Low (256)</option>
                <option :value="512">Medium (512)</option>
                <option :value="1024">High (1024)</option>
                <option :value="2048">Ultra (2048)</option>
              </select>
            </div>

            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Reflections</label>
              <button
                @click="settings.graphics.reflectionsEnabled = !settings.graphics.reflectionsEnabled; handleSettingChange()"
                :class="[
                  'w-12 h-6 rounded-full transition-colors relative',
                  settings.graphics.reflectionsEnabled ? 'bg-allolib-blue' : 'bg-gray-600'
                ]"
              >
                <span
                  :class="[
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                    settings.graphics.reflectionsEnabled ? 'left-7' : 'left-1'
                  ]"
                />
              </button>
            </div>

            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Bloom</label>
              <button
                @click="settings.graphics.bloomEnabled = !settings.graphics.bloomEnabled; handleSettingChange()"
                :class="[
                  'w-12 h-6 rounded-full transition-colors relative',
                  settings.graphics.bloomEnabled ? 'bg-allolib-blue' : 'bg-gray-600'
                ]"
              >
                <span
                  :class="[
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                    settings.graphics.bloomEnabled ? 'left-7' : 'left-1'
                  ]"
                />
              </button>
            </div>

            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Ambient Occlusion</label>
              <button
                @click="settings.graphics.ambientOcclusion = !settings.graphics.ambientOcclusion; handleSettingChange()"
                :class="[
                  'w-12 h-6 rounded-full transition-colors relative',
                  settings.graphics.ambientOcclusion ? 'bg-allolib-blue' : 'bg-gray-600'
                ]"
              >
                <span
                  :class="[
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                    settings.graphics.ambientOcclusion ? 'left-7' : 'left-1'
                  ]"
                />
              </button>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-sm text-gray-300">Anti-Aliasing</label>
              <select
                v-model="settings.graphics.antiAliasing"
                @change="handleSettingChange"
                class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
              >
                <option value="none">None</option>
                <option value="fxaa">FXAA</option>
                <option value="msaa4x">MSAA 4x</option>
              </select>
            </div>
          </div>

          <div class="border-t border-editor-border pt-3 mt-3">
            <div class="text-xs text-gray-400 mb-2 font-medium">Performance</div>

            <!-- Auto-LOD Enable Toggle -->
            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300" title="Automatically simplify distant meshes for better performance">Auto-LOD</label>
              <button
                @click="settings.graphics.lodEnabled = !settings.graphics.lodEnabled; handleSettingChange()"
                :class="settings.graphics.lodEnabled ? 'bg-allolib-blue' : 'bg-gray-600'"
                class="w-10 h-5 rounded-full relative transition-colors"
              >
                <span
                  :class="settings.graphics.lodEnabled ? 'translate-x-5' : 'translate-x-0.5'"
                  class="absolute top-0.5 left-0 w-4 h-4 bg-white rounded-full transition-transform"
                ></span>
              </button>
            </div>

            <div class="flex items-center justify-between mb-3" v-if="settings.graphics.lodEnabled">
              <label class="text-sm text-gray-300">LOD Bias</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  v-model.number="settings.graphics.lodBias"
                  @input="handleSettingChange()"
                  min="0.5"
                  max="3"
                  step="0.25"
                  class="w-20 accent-allolib-blue"
                />
                <span class="text-xs text-gray-400 w-12 text-right">{{ settings.graphics.lodBias.toFixed(2) }}</span>
              </div>
            </div>

            <!-- LOD Distance Settings (only show when LOD enabled) -->
            <div class="flex items-center justify-between mb-3" v-if="settings.graphics.lodEnabled">
              <label class="text-sm text-gray-300">Full Quality Distance</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  v-model.number="settings.graphics.lodMinFullQualityDistance"
                  @input="handleSettingChange()"
                  min="0"
                  max="20"
                  step="1"
                  class="w-20 accent-allolib-blue"
                />
                <span class="text-xs text-gray-400 w-12 text-right">{{ settings.graphics.lodMinFullQualityDistance }}</span>
              </div>
            </div>

            <div class="mb-3" v-if="settings.graphics.lodEnabled">
              <button
                @click="showLODDistances = !showLODDistances"
                class="flex items-center gap-1 text-sm text-gray-300 hover:text-white"
              >
                <span :class="showLODDistances ? 'rotate-90' : ''" class="transition-transform">▶</span>
                LOD Distances
              </button>
              <div v-if="showLODDistances" class="mt-2 pl-3 space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-xs text-gray-400">LOD 1</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="range"
                      v-model.number="settings.graphics.lodDistances[0]"
                      @input="handleSettingChange()"
                      min="5"
                      max="50"
                      step="5"
                      class="w-16 accent-allolib-blue"
                    />
                    <span class="text-xs text-gray-400 w-8 text-right">{{ settings.graphics.lodDistances[0] }}</span>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <label class="text-xs text-gray-400">LOD 2</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="range"
                      v-model.number="settings.graphics.lodDistances[1]"
                      @input="handleSettingChange()"
                      min="10"
                      max="100"
                      step="5"
                      class="w-16 accent-allolib-blue"
                    />
                    <span class="text-xs text-gray-400 w-8 text-right">{{ settings.graphics.lodDistances[1] }}</span>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <label class="text-xs text-gray-400">LOD 3</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="range"
                      v-model.number="settings.graphics.lodDistances[2]"
                      @input="handleSettingChange()"
                      min="25"
                      max="200"
                      step="10"
                      class="w-16 accent-allolib-blue"
                    />
                    <span class="text-xs text-gray-400 w-8 text-right">{{ settings.graphics.lodDistances[2] }}</span>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <label class="text-xs text-gray-400">LOD 4</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="range"
                      v-model.number="settings.graphics.lodDistances[3]"
                      @input="handleSettingChange()"
                      min="50"
                      max="500"
                      step="25"
                      class="w-16 accent-allolib-blue"
                    />
                    <span class="text-xs text-gray-400 w-8 text-right">{{ settings.graphics.lodDistances[3] }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- NEW: Distance Scale (unified control) -->
            <div class="flex items-center justify-between mb-3" v-if="settings.graphics.lodEnabled">
              <label class="text-sm text-gray-300" title="Scales all LOD distances proportionally. Higher = more detail at distance.">Distance Scale</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  v-model.number="settings.graphics.lodDistanceScale"
                  @input="handleSettingChange()"
                  min="0.25"
                  max="4"
                  step="0.25"
                  class="w-20 accent-allolib-blue"
                />
                <span class="text-xs text-gray-400 w-12 text-right">{{ settings.graphics.lodDistanceScale.toFixed(2) }}x</span>
              </div>
            </div>

            <!-- NEW: LOD Levels -->
            <div class="flex items-center justify-between mb-3" v-if="settings.graphics.lodEnabled">
              <label class="text-sm text-gray-300" title="Number of LOD levels (more = smoother transitions)">LOD Levels</label>
              <select
                v-model.number="settings.graphics.lodLevels"
                @change="handleSettingChange"
                class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
              >
                <option :value="4">4</option>
                <option :value="6">6</option>
                <option :value="8">8</option>
                <option :value="12">12</option>
                <option :value="16">16</option>
              </select>
            </div>

            <!-- NEW: Unload Settings -->
            <div class="flex items-center justify-between mb-3" v-if="settings.graphics.lodEnabled">
              <label class="text-sm text-gray-300" title="Hide meshes beyond unload distance">Enable Unload</label>
              <button
                @click="settings.graphics.lodUnloadEnabled = !settings.graphics.lodUnloadEnabled; handleSettingChange()"
                :class="settings.graphics.lodUnloadEnabled ? 'bg-allolib-blue' : 'bg-gray-600'"
                class="w-10 h-5 rounded-full relative transition-colors"
              >
                <span
                  :class="settings.graphics.lodUnloadEnabled ? 'translate-x-5' : 'translate-x-0.5'"
                  class="absolute top-0.5 left-0 w-4 h-4 bg-white rounded-full transition-transform"
                ></span>
              </button>
            </div>

            <div v-if="settings.graphics.lodEnabled && settings.graphics.lodUnloadEnabled" class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Unload Distance</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  v-model.number="settings.graphics.lodUnloadDistance"
                  @input="handleSettingChange()"
                  min="50"
                  max="1000"
                  step="50"
                  class="w-20 accent-allolib-blue"
                />
                <span class="text-xs text-gray-400 w-12 text-right">{{ settings.graphics.lodUnloadDistance }}</span>
              </div>
            </div>

            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Max Lights</label>
              <select
                v-model.number="settings.graphics.maxLights"
                @change="handleSettingChange"
                class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
              >
                <option :value="2">2</option>
                <option :value="4">4</option>
                <option :value="8">8</option>
                <option :value="16">16</option>
              </select>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-sm text-gray-300">Max Particles</label>
              <select
                v-model.number="settings.graphics.maxParticles"
                @change="handleSettingChange"
                class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
              >
                <option :value="1000">1K</option>
                <option :value="5000">5K</option>
                <option :value="10000">10K</option>
                <option :value="50000">50K</option>
              </select>
            </div>
          </div>

          <!-- Texture LOD Settings -->
          <div class="border-t border-editor-border pt-3 mt-3">
            <div class="text-xs text-gray-400 mb-2 font-medium">Texture LOD</div>

            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Texture LOD</label>
              <button
                @click="settings.graphics.textureLODEnabled = !settings.graphics.textureLODEnabled; handleSettingChange()"
                :class="[
                  'w-12 h-6 rounded-full transition-colors relative',
                  settings.graphics.textureLODEnabled ? 'bg-allolib-blue' : 'bg-gray-600'
                ]"
              >
                <span
                  :class="[
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                    settings.graphics.textureLODEnabled ? 'left-7' : 'left-1'
                  ]"
                />
              </button>
            </div>

            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Texture Quality</label>
              <select
                v-model="settings.graphics.textureQuality"
                @change="handleSettingChange"
                class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="ultra">Ultra</option>
              </select>
            </div>

            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Max Texture Size</label>
              <select
                v-model.number="settings.graphics.maxTextureSize"
                @change="handleSettingChange"
                class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
              >
                <option :value="512">512px</option>
                <option :value="1024">1024px</option>
                <option :value="2048">2048px</option>
                <option :value="4096">4096px</option>
              </select>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-sm text-gray-300">Texture LOD Bias</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  v-model.number="settings.graphics.textureLODBias"
                  @input="handleSettingChange()"
                  min="0.5"
                  max="3"
                  step="0.25"
                  class="w-20 accent-allolib-blue"
                />
                <span class="text-xs text-gray-400 w-12 text-right">{{ settings.graphics.textureLODBias.toFixed(2) }}</span>
              </div>
            </div>
          </div>

          <!-- Shader LOD Settings -->
          <div class="border-t border-editor-border pt-3 mt-3">
            <div class="text-xs text-gray-400 mb-2 font-medium">Shader LOD</div>

            <div class="flex items-center justify-between mb-3">
              <label class="text-sm text-gray-300">Shader LOD</label>
              <button
                @click="settings.graphics.shaderLODEnabled = !settings.graphics.shaderLODEnabled; handleSettingChange()"
                :class="[
                  'w-12 h-6 rounded-full transition-colors relative',
                  settings.graphics.shaderLODEnabled ? 'bg-allolib-blue' : 'bg-gray-600'
                ]"
              >
                <span
                  :class="[
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                    settings.graphics.shaderLODEnabled ? 'left-7' : 'left-1'
                  ]"
                />
              </button>
            </div>

            <div class="flex items-center justify-between">
              <label class="text-sm text-gray-300">Shader Complexity</label>
              <select
                v-model="settings.graphics.shaderComplexity"
                @change="handleSettingChange"
                class="bg-editor-sidebar border border-editor-border rounded px-2 py-1 text-sm"
              >
                <option value="minimal">Minimal</option>
                <option value="simple">Simple</option>
                <option value="standard">Standard</option>
                <option value="full">Full PBR</option>
              </select>
            </div>
          </div>

          <div class="text-xs text-gray-500 bg-editor-sidebar p-2 rounded">
            <strong>Auto:</strong> Dynamically adjusts settings based on FPS. Higher LOD bias = lower detail at closer distances. Texture/Shader LOD reduce quality for distant objects.
          </div>

          <button
            @click="settings.resetGraphics(); handleSettingChange()"
            class="w-full py-1.5 text-xs text-gray-400 hover:text-white hover:bg-editor-active rounded transition-colors"
          >
            Reset Graphics Settings
          </button>
        </div>

        <!-- Footer -->
        <div class="border-t border-editor-border px-4 py-2 flex justify-between items-center">
          <span class="text-xs text-gray-500">Settings auto-save to browser</span>
          <button
            @click="settings.resetAll(); handleSettingChange()"
            class="text-xs text-red-400 hover:text-red-300"
          >
            Reset All
          </button>
        </div>
      </div>

      <!-- Click outside to close -->
      <div
        v-if="showSettings"
        class="fixed inset-0 z-40"
        @click="closeSettings"
      ></div>
    </div>

    <!-- Glossary Button -->
    <button
      @click="openGlossary"
      class="px-3 py-1.5 hover:bg-editor-active rounded text-sm transition-colors flex items-center gap-1"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      Glossary
    </button>

    <!-- GitHub Link -->
    <a
      href="https://github.com/9LiveZZZ-Git/Allolib-Studio-Online"
      target="_blank"
      class="px-3 py-1.5 hover:bg-editor-active rounded text-sm transition-colors flex items-center gap-1"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      GitHub
    </a>
  </header>

  <!-- Glossary Modal -->
  <Teleport to="body">
    <div v-if="showGlossary" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-editor-bg border border-editor-border rounded-lg shadow-2xl w-[900px] max-w-[95vw] h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="px-4 py-3 border-b border-editor-border flex items-center justify-between shrink-0">
          <h2 class="text-lg font-semibold text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-allolib-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            AlloLib Glossary
          </h2>
          <button @click="closeGlossary" class="text-gray-400 hover:text-white p-1">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Search and Filters -->
        <div class="px-4 py-3 border-b border-editor-border flex items-center gap-4 shrink-0">
          <div class="flex-1 relative">
            <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="glossarySearch"
              type="text"
              placeholder="Search glossary..."
              class="w-full bg-editor-sidebar border border-editor-border rounded pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-allolib-blue"
            />
          </div>
          <select
            v-model="platformFilter"
            class="bg-editor-sidebar border border-editor-border rounded px-3 py-2 text-sm"
          >
            <option value="all">All Platforms</option>
            <option value="both">Cross-Platform</option>
            <option value="native">Native Only</option>
            <option value="web">Web Only</option>
          </select>
        </div>

        <!-- Main Content -->
        <div class="flex-1 flex overflow-hidden min-h-0">
          <!-- Category Sidebar -->
          <div class="w-48 border-r border-editor-border overflow-y-auto shrink-0">
            <button
              @click="selectGlossaryCategory(null)"
              :class="[
                'w-full px-4 py-2 text-left text-sm hover:bg-editor-active transition-colors',
                selectedGlossaryCategory === null && !glossarySearch ? 'bg-editor-active text-allolib-blue' : 'text-gray-300'
              ]"
            >
              All Terms ({{ glossary.length }})
            </button>
            <div class="border-t border-editor-border my-1"></div>
            <button
              v-for="cat in glossaryCategories"
              :key="cat.id"
              @click="selectGlossaryCategory(cat.id)"
              :class="[
                'w-full px-4 py-2 text-left text-sm hover:bg-editor-active transition-colors',
                selectedGlossaryCategory === cat.id ? 'bg-editor-active text-allolib-blue' : 'text-gray-300'
              ]"
            >
              {{ cat.title }}
            </button>
          </div>

          <!-- Terms List -->
          <div class="w-64 border-r border-editor-border overflow-y-auto shrink-0">
            <div v-if="filteredGlossary.length === 0" class="p-4 text-gray-500 text-sm text-center">
              No terms found
            </div>
            <button
              v-for="entry in filteredGlossary"
              :key="entry.term"
              @click="selectGlossaryEntry(entry)"
              :class="[
                'w-full px-4 py-2 text-left hover:bg-editor-active transition-colors border-b border-editor-border',
                selectedEntry?.term === entry.term ? 'bg-editor-active' : ''
              ]"
            >
              <div class="font-mono text-sm text-white">{{ entry.term }}</div>
              <div class="flex gap-1 mt-1">
                <span
                  v-for="platform in entry.platforms"
                  :key="platform"
                  :class="[
                    'text-[10px] px-1.5 py-0.5 rounded',
                    getPlatformBadgeClass(platform)
                  ]"
                >
                  {{ platform }}
                </span>
              </div>
            </button>
          </div>

          <!-- Entry Detail -->
          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="!selectedEntry" class="h-full flex items-center justify-center text-gray-500">
              <div class="text-center">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p>Select a term to view details</p>
              </div>
            </div>

            <div v-else class="space-y-4">
              <!-- Term Header -->
              <div>
                <h3 class="text-2xl font-mono font-bold text-white">{{ selectedEntry.term }}</h3>
                <div class="flex items-center gap-2 mt-2">
                  <span class="text-xs px-2 py-1 bg-editor-sidebar rounded text-gray-400">
                    {{ glossaryCategories.find(c => c.id === selectedEntry.category)?.title }}
                  </span>
                  <span
                    v-for="platform in selectedEntry.platforms"
                    :key="platform"
                    :class="[
                      'text-xs px-2 py-1 rounded',
                      getPlatformBadgeClass(platform)
                    ]"
                  >
                    {{ platform === 'both' ? 'Cross-Platform' : platform === 'native' ? 'Native' : 'Web' }}
                  </span>
                </div>
              </div>

              <!-- Definition -->
              <div>
                <h4 class="text-sm font-medium text-gray-400 mb-1">Definition</h4>
                <p class="text-gray-200">{{ selectedEntry.definition }}</p>
              </div>

              <!-- Syntax -->
              <div v-if="selectedEntry.syntax">
                <h4 class="text-sm font-medium text-gray-400 mb-1">Syntax</h4>
                <pre class="bg-editor-sidebar rounded p-3 text-sm font-mono text-green-400 overflow-x-auto">{{ selectedEntry.syntax }}</pre>
              </div>

              <!-- Example -->
              <div v-if="selectedEntry.example">
                <h4 class="text-sm font-medium text-gray-400 mb-1">Example</h4>
                <pre class="bg-editor-sidebar rounded p-3 text-sm font-mono text-blue-300 overflow-x-auto whitespace-pre-wrap">{{ selectedEntry.example }}</pre>
              </div>

              <!-- Web Alternative -->
              <div v-if="selectedEntry.webAlternative" class="bg-purple-900/30 border border-purple-700 rounded p-3">
                <h4 class="text-sm font-medium text-purple-400 mb-1 flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Web Alternative
                </h4>
                <p class="text-purple-200 text-sm">{{ selectedEntry.webAlternative }}</p>
              </div>

              <!-- Related Terms -->
              <div v-if="selectedEntry.relatedTerms?.length">
                <h4 class="text-sm font-medium text-gray-400 mb-2">Related Terms</h4>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="term in selectedEntry.relatedTerms"
                    :key="term"
                    @click="selectGlossaryEntry(glossary.find(e => e.term === term)!)"
                    class="text-sm px-2 py-1 bg-editor-sidebar hover:bg-editor-active rounded text-allolib-blue"
                  >
                    {{ term }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-4 py-2 border-t border-editor-border text-xs text-gray-500 shrink-0">
          {{ filteredGlossary.length }} terms | AlloLib Studio Online Glossary
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Example Dialog -->
  <ExampleDialog
    :example="selectedExample"
    :visible="showExampleDialog"
    @close="closeExampleDialog"
    @addToProject="handleAddToProject"
    @replaceProject="handleReplaceProject"
  />
</template>
