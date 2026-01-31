<script setup lang="ts">
/**
 * Asset Library Panel
 *
 * A searchable, categorized library of reusable code snippets, templates,
 * objects, shaders, and other assets. Supports drag-and-drop to file explorer.
 * Now with file import and auto-sorting!
 */
import { ref, computed, watch } from 'vue'
import {
  useAssetLibraryStore,
  assetCategories,
  type Asset,
  type AssetCategory
} from '@/stores/assetLibrary'

const assetStore = useAssetLibraryStore()

// Local state
const hoveredAsset = ref<string | null>(null)
const copiedAsset = ref<string | null>(null)
const showPreview = ref<Asset | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isImporting = ref(false)
const importedCount = ref(0)

// Emit events
const emit = defineEmits<{
  insertSnippet: [content: string]
  close: []
}>()

// Get icon for asset type
function getTypeIcon(type: Asset['type']): string {
  switch (type) {
    case 'snippet': return '{ }'
    case 'file': return '📄'
    case 'object': return '◆'
    case 'shader': return '🎨'
    case 'texture': return '🖼'
    case 'mesh': return '△'
    case 'environment': return '🌍'
    default: return '📦'
  }
}

// Get color for asset type
function getTypeColor(type: Asset['type']): string {
  switch (type) {
    case 'snippet': return 'text-blue-400'
    case 'file': return 'text-green-400'
    case 'object': return 'text-purple-400'
    case 'shader': return 'text-pink-400'
    case 'texture': return 'text-yellow-400'
    case 'mesh': return 'text-orange-400'
    case 'environment': return 'text-cyan-400'
    default: return 'text-gray-400'
  }
}

// Handle asset click
function handleAssetClick(asset: Asset) {
  if (asset.type === 'snippet') {
    // For snippets, copy to clipboard and show feedback
    handleCopySnippet(asset)
  } else if (asset.type === 'file') {
    // For files, add to project
    assetStore.addToProject(asset)
    emit('close')
  } else {
    // Show preview for other types
    showPreview.value = asset
  }
}

// Handle snippet copy
async function handleCopySnippet(asset: Asset) {
  const success = await assetStore.copySnippetToClipboard(asset)
  if (success) {
    copiedAsset.value = asset.id
    setTimeout(() => {
      copiedAsset.value = null
    }, 2000)
  }
}

// Handle snippet insert (into editor)
function handleInsertSnippet(asset: Asset) {
  if (asset.content) {
    emit('insertSnippet', asset.content)
    emit('close')
  }
}

// Handle drag start for drag-and-drop
function handleDragStart(asset: Asset, event: DragEvent) {
  if (!event.dataTransfer) return

  event.dataTransfer.setData('application/asset', JSON.stringify(asset))
  event.dataTransfer.setData('text/plain', asset.content || '')
  event.dataTransfer.effectAllowed = 'copy'

  // Custom drag image
  const dragEl = document.createElement('div')
  dragEl.className = 'bg-editor-bg border border-editor-border rounded px-2 py-1 text-sm text-white'
  dragEl.textContent = asset.name
  document.body.appendChild(dragEl)
  event.dataTransfer.setDragImage(dragEl, 0, 0)
  setTimeout(() => document.body.removeChild(dragEl), 0)
}

// Close preview modal
function closePreview() {
  showPreview.value = null
}

// Add preview asset to project
function addPreviewToProject() {
  if (showPreview.value) {
    assetStore.addToProject(showPreview.value)
    closePreview()
  }
}

// Trigger file input click
function triggerFileImport() {
  fileInput.value?.click()
}

// Handle file selection
async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  isImporting.value = true
  importedCount.value = 0

  try {
    const results = await assetStore.loadFiles(input.files)
    importedCount.value = results.length

    // Show feedback
    if (results.length > 0) {
      console.log(`[AssetLibrary] Imported ${results.length} file(s)`)
      // Brief flash message
      setTimeout(() => {
        importedCount.value = 0
      }, 3000)
    }
  } catch (e) {
    console.error('[AssetLibrary] Import failed:', e)
  } finally {
    isImporting.value = false
    // Reset input so same file can be selected again
    input.value = ''
  }
}

// Handle drag and drop on library
function handleDrop(event: DragEvent) {
  event.preventDefault()
  if (!event.dataTransfer?.files) return

  handleFileDrop(event.dataTransfer.files)
}

async function handleFileDrop(files: FileList) {
  isImporting.value = true
  importedCount.value = 0

  try {
    const results = await assetStore.loadFiles(files)
    importedCount.value = results.length
    setTimeout(() => { importedCount.value = 0 }, 3000)
  } finally {
    isImporting.value = false
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
}
</script>

<template>
  <div
    class="asset-library h-full flex flex-col bg-editor-sidebar"
    @drop="handleDrop"
    @dragover="handleDragOver"
  >
    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      multiple
      accept=".jpg,.jpeg,.png,.webp,.tga,.hdr,.exr,.obj,.fbx,.gltf,.glb,.glsl,.vert,.frag,.cpp,.hpp,.h"
      class="hidden"
      @change="handleFileSelect"
    />

    <!-- Header -->
    <div class="h-8 flex items-center justify-between px-3 border-b border-editor-border shrink-0">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-gray-400 uppercase tracking-wider">Assets</span>
        <span class="text-xs text-gray-500">({{ assetStore.filteredAssets.length }})</span>
        <!-- Import feedback -->
        <span v-if="importedCount > 0" class="text-xs text-green-400 animate-pulse">
          +{{ importedCount }} imported
        </span>
      </div>
      <div class="flex items-center gap-1">
        <!-- Import button -->
        <button
          @click="triggerFileImport"
          class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-blue-400"
          :class="{ 'opacity-50 pointer-events-none': isImporting }"
          title="Import files (textures, meshes, shaders)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>
        <!-- Close button -->
        <button
          @click="emit('close')"
          class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
          title="Close"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="px-2 py-2 border-b border-editor-border">
      <div class="relative">
        <input
          v-model="assetStore.searchQuery"
          type="text"
          placeholder="Search assets..."
          class="w-full h-7 pl-7 pr-2 text-xs bg-editor-bg border border-editor-border rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <svg
          class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="flex flex-wrap gap-1 px-2 py-2 border-b border-editor-border">
      <button
        @click="assetStore.setCategory(null)"
        :class="[
          'px-2 py-1 text-xs rounded transition-colors',
          assetStore.selectedCategory === null
            ? 'bg-blue-600 text-white'
            : 'bg-editor-bg text-gray-400 hover:text-white hover:bg-editor-active'
        ]"
      >
        All
      </button>
      <button
        v-for="cat in assetCategories"
        :key="cat.id"
        @click="assetStore.setCategory(cat.id)"
        :class="[
          'px-2 py-1 text-xs rounded transition-colors',
          assetStore.selectedCategory === cat.id
            ? 'bg-blue-600 text-white'
            : 'bg-editor-bg text-gray-400 hover:text-white hover:bg-editor-active'
        ]"
        :title="cat.description"
      >
        {{ cat.icon }} {{ cat.name }}
      </button>
    </div>

    <!-- Subcategory Pills -->
    <div
      v-if="assetStore.subcategories.length > 0"
      class="flex flex-wrap gap-1 px-2 py-1.5 border-b border-editor-border bg-editor-bg/50"
    >
      <button
        @click="assetStore.setSubcategory(null)"
        :class="[
          'px-2 py-0.5 text-xs rounded-full transition-colors',
          assetStore.selectedSubcategory === null
            ? 'bg-gray-600 text-white'
            : 'bg-transparent text-gray-500 hover:text-white'
        ]"
      >
        All
      </button>
      <button
        v-for="sub in assetStore.subcategories"
        :key="sub"
        @click="assetStore.setSubcategory(sub)"
        :class="[
          'px-2 py-0.5 text-xs rounded-full transition-colors',
          assetStore.selectedSubcategory === sub
            ? 'bg-gray-600 text-white'
            : 'bg-transparent text-gray-500 hover:text-white'
        ]"
      >
        {{ sub }}
      </button>
    </div>

    <!-- Asset List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="assetStore.filteredAssets.length === 0" class="p-4 text-center text-gray-500 text-sm">
        No assets found
      </div>

      <div v-else class="p-2 space-y-1">
        <div
          v-for="asset in assetStore.filteredAssets"
          :key="asset.id"
          class="asset-card group relative p-2 rounded cursor-pointer transition-colors"
          :class="[
            hoveredAsset === asset.id ? 'bg-editor-active' : 'hover:bg-editor-active/50'
          ]"
          draggable="true"
          @click="handleAssetClick(asset)"
          @mouseenter="hoveredAsset = asset.id"
          @mouseleave="hoveredAsset = null"
          @dragstart="handleDragStart(asset, $event)"
        >
          <!-- Main content -->
          <div class="flex items-start gap-2">
            <!-- Type icon -->
            <span
              class="flex-shrink-0 w-6 h-6 flex items-center justify-center text-sm rounded bg-editor-bg"
              :class="getTypeColor(asset.type)"
            >
              {{ getTypeIcon(asset.type) }}
            </span>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm text-white truncate">{{ asset.name }}</span>
                <span
                  v-if="copiedAsset === asset.id"
                  class="text-xs text-green-400"
                >
                  Copied!
                </span>
              </div>
              <p class="text-xs text-gray-500 truncate">{{ asset.description }}</p>
            </div>

            <!-- Favorite button -->
            <button
              @click.stop="assetStore.toggleFavorite(asset.id)"
              class="p-1 rounded transition-colors"
              :class="asset.isFavorite ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'"
              title="Toggle favorite"
            >
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          </div>

          <!-- Tags -->
          <div v-if="asset.tags.length > 0" class="mt-1.5 flex flex-wrap gap-1">
            <span
              v-for="tag in asset.tags.slice(0, 4)"
              :key="tag"
              class="px-1.5 py-0.5 text-xs rounded bg-editor-bg text-gray-500"
            >
              {{ tag }}
            </span>
            <span
              v-if="asset.tags.length > 4"
              class="px-1.5 py-0.5 text-xs rounded bg-editor-bg text-gray-500"
            >
              +{{ asset.tags.length - 4 }}
            </span>
          </div>

          <!-- Quick actions (shown on hover) -->
          <div
            v-if="hoveredAsset === asset.id && asset.type === 'snippet'"
            class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1"
          >
            <button
              @click.stop="handleCopySnippet(asset)"
              class="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
              title="Copy to clipboard"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              @click.stop="handleInsertSnippet(asset)"
              class="p-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white"
              title="Insert into editor"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Favorites Section (if any) -->
    <div
      v-if="assetStore.favoriteAssets.length > 0 && !assetStore.selectedCategory"
      class="border-t border-editor-border"
    >
      <div class="px-3 py-1.5 flex items-center gap-2 bg-editor-bg/50">
        <svg class="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span class="text-xs text-gray-400">Favorites</span>
      </div>
      <div class="p-2 flex flex-wrap gap-1">
        <button
          v-for="asset in assetStore.favoriteAssets.slice(0, 6)"
          :key="asset.id"
          @click="handleAssetClick(asset)"
          class="px-2 py-1 text-xs rounded bg-editor-bg hover:bg-editor-active text-gray-300 truncate max-w-24"
          :title="asset.name"
        >
          {{ getTypeIcon(asset.type) }} {{ asset.name }}
        </button>
      </div>
    </div>

    <!-- Preview Modal -->
    <div
      v-if="showPreview"
      class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      @click.self="closePreview"
    >
      <div class="bg-editor-bg border border-editor-border rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <!-- Modal Header -->
        <div class="px-4 py-3 border-b border-editor-border flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span :class="getTypeColor(showPreview.type)">{{ getTypeIcon(showPreview.type) }}</span>
            <h3 class="text-white font-medium">{{ showPreview.name }}</h3>
          </div>
          <button
            @click="closePreview"
            class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-4 overflow-y-auto flex-1">
          <p class="text-gray-400 text-sm mb-4">{{ showPreview.description }}</p>

          <!-- Code Preview -->
          <div
            v-if="showPreview.content"
            class="bg-black/50 rounded p-3 font-mono text-xs text-gray-300 overflow-x-auto max-h-64"
          >
            <pre>{{ showPreview.content }}</pre>
          </div>

          <!-- Object Definition Preview -->
          <div
            v-else-if="showPreview.objectDefinition"
            class="bg-black/50 rounded p-3 font-mono text-xs text-gray-300 overflow-x-auto"
          >
            <pre>{{ JSON.stringify(showPreview.objectDefinition, null, 2) }}</pre>
          </div>

          <!-- Tags -->
          <div class="mt-4 flex flex-wrap gap-1">
            <span
              v-for="tag in showPreview.tags"
              :key="tag"
              class="px-2 py-0.5 text-xs rounded bg-editor-active text-gray-400"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-4 py-3 border-t border-editor-border flex justify-end gap-2">
          <button
            @click="closePreview"
            class="px-4 py-1.5 text-sm text-gray-400 hover:text-white rounded hover:bg-editor-active"
          >
            Cancel
          </button>
          <button
            v-if="showPreview.type === 'snippet'"
            @click="handleCopySnippet(showPreview); closePreview()"
            class="px-4 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded"
          >
            Copy to Clipboard
          </button>
          <button
            @click="addPreviewToProject"
            class="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded"
          >
            Add to Project
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.asset-library {
  min-width: 280px;
}

.asset-card {
  border: 1px solid transparent;
}

.asset-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

/* Drag ghost styling */
.asset-card[draggable="true"] {
  cursor: grab;
}

.asset-card[draggable="true"]:active {
  cursor: grabbing;
}
</style>
