<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import MonacoEditor from './MonacoEditor.vue'
import FileTabBar from './FileTabBar.vue'
import FileExplorer from './FileExplorer.vue'
import NewFileDialog from './NewFileDialog.vue'
import NewFolderDialog from './NewFolderDialog.vue'
import { useProjectStore } from '@/stores/project'
import type { CompilerDiagnostic } from '@/utils/error-parser'

const projectStore = useProjectStore()
const editorRef = ref<InstanceType<typeof MonacoEditor>>()

const emit = defineEmits<{
  save: []
}>()

// Current file content for v-model binding
const currentContent = computed({
  get: () => projectStore.activeFile?.content || '',
  set: (value: string) => {
    if (projectStore.activeFileName) {
      projectStore.updateFileContent(projectStore.activeFileName, value)
    }
  }
})

// Handle file selection (from tabs or explorer)
function handleSelectFile(path: string) {
  // Save current content first
  if (editorRef.value && projectStore.activeFileName) {
    const currentValue = editorRef.value.getValue()
    projectStore.updateFileContent(projectStore.activeFileName, currentValue)
  }

  // Switch to new file
  projectStore.setActiveFile(path)
  const content = projectStore.getFileContent(path) || ''
  editorRef.value?.switchToFile(path, content)
}

// Handle new file creation
function handleNewFile(folderPath: string = '') {
  projectStore.openNewFileDialog(folderPath)
}

function handleCreateFile(filename: string, parentPath: string) {
  const result = projectStore.createFile(filename, parentPath)
  if (result.success) {
    projectStore.closeNewFileDialog()
    // Switch to the new file
    const fullPath = parentPath ? `${parentPath}/${filename}` : filename
    const content = projectStore.getFileContent(fullPath) || ''
    editorRef.value?.switchToFile(fullPath, content)
  }
}

function handleCancelNewFile() {
  projectStore.closeNewFileDialog()
}

// Handle new folder creation
function handleNewFolder(parentPath: string = '') {
  projectStore.openNewFolderDialog(parentPath)
}

function handleCreateFolder(folderName: string, parentPath: string) {
  const result = projectStore.createFolder(folderName, parentPath)
  if (result.success) {
    projectStore.closeNewFolderDialog()
  }
}

function handleCancelNewFolder() {
  projectStore.closeNewFolderDialog()
}

// Handle file close/delete
function handleCloseFile(path: string) {
  projectStore.confirmDeleteFile(path)
}

function handleDeleteFile(path: string) {
  projectStore.confirmDeleteFile(path)
}

function handleDeleteFolder(path: string) {
  projectStore.confirmDeleteFolder(path)
}

function handleConfirmDelete() {
  if (projectStore.fileToDelete) {
    // Dispose the model in Monaco
    editorRef.value?.disposeModel(projectStore.fileToDelete)
    projectStore.executeDeleteFile()
  } else if (projectStore.folderToDelete) {
    projectStore.executeDeleteFolder()
  }
  // Switch to main file
  const mainPath = projectStore.mainFilePath
  const content = projectStore.getFileContent(mainPath) || ''
  editorRef.value?.switchToFile(mainPath, content)
}

function handleCancelDelete() {
  projectStore.cancelDeleteFile()
}

const handleSave = () => {
  // Update store with current editor content
  if (editorRef.value && projectStore.activeFileName) {
    const currentValue = editorRef.value.getValue()
    projectStore.updateFileContent(projectStore.activeFileName, currentValue)
  }
  projectStore.saveProject()
  emit('save')
}

// Editor action handlers
const handleFormat = () => editorRef.value?.format()
const handleUndo = () => editorRef.value?.undo()
const handleRedo = () => editorRef.value?.redo()
const handleFind = () => editorRef.value?.openFind()
const handleReplace = () => editorRef.value?.openReplace()
const handleGoToLine = () => editorRef.value?.openGoToLine()

// Watch for external file changes (e.g., loading examples)
watch(() => projectStore.activeFileName, (newPath) => {
  if (newPath && editorRef.value) {
    const content = projectStore.getFileContent(newPath) || ''
    editorRef.value.switchToFile(newPath, content)
  }
})

// Get display name from path
function getDisplayName(path: string): string {
  if (path.includes('/')) {
    return path.substring(path.lastIndexOf('/') + 1)
  }
  return path
}

// Expose methods for parent
defineExpose({
  getCode: () => editorRef.value?.getValue() || '',
  setCode: (value: string) => {
    // Update the active file content
    if (projectStore.activeFileName) {
      projectStore.updateFileContent(projectStore.activeFileName, value)
    }
    editorRef.value?.setValue(value)
  },
  // Multi-file support
  getFilesForCompilation: () => projectStore.getFilesForCompilation(),
  loadFromCode: (code: string, filename?: string) => {
    projectStore.loadFromCode(code, filename)
    editorRef.value?.switchToFile(projectStore.mainFilePath, code)
  },
  newProject: () => {
    projectStore.newProject()
    const mainPath = projectStore.mainFilePath
    const content = projectStore.getFileContent(mainPath) || ''
    editorRef.value?.switchToFile(mainPath, content)
  },
  // Editor actions
  format: handleFormat,
  undo: handleUndo,
  redo: handleRedo,
  find: handleFind,
  replace: handleReplace,
  goToLine: handleGoToLine,
  // Diagnostics (error highlighting)
  setDiagnostics: (diagnostics: CompilerDiagnostic[]) => editorRef.value?.setDiagnostics(diagnostics),
  clearDiagnostics: () => editorRef.value?.clearDiagnostics(),
  jumpToFirstError: (diagnostics: CompilerDiagnostic[]) => editorRef.value?.jumpToFirstError(diagnostics),
})
</script>

<template>
  <div class="flex bg-editor-bg h-full min-h-0">
    <!-- File Explorer Sidebar -->
    <FileExplorer
      @select-file="handleSelectFile"
      @new-file="handleNewFile"
      @new-folder="handleNewFolder"
      @delete-file="handleDeleteFile"
      @delete-folder="handleDeleteFolder"
    />

    <!-- Main Editor Area -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- File Tabs -->
      <FileTabBar
        :files="projectStore.files"
        :active-file="projectStore.activeFileName"
        @select-file="handleSelectFile"
        @new-file="() => handleNewFile('')"
        @close-file="handleCloseFile"
      />

      <!-- Editor Header with actions -->
      <div class="h-8 bg-editor-sidebar border-b border-editor-border flex items-center px-3 justify-between shrink-0">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-allolib-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span class="text-sm text-gray-400">{{ projectStore.activeFileName }}</span>
          <span v-if="projectStore.activeFile?.isDirty" class="text-yellow-400 text-xs">*</span>
        </div>
        <div class="flex items-center gap-1">
          <!-- Editor toolbar buttons -->
          <button
            @click="handleUndo"
            class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
            title="Undo (Ctrl+Z)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            @click="handleRedo"
            class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
            title="Redo (Ctrl+Y)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>
          <div class="w-px h-4 bg-editor-border mx-1"></div>
          <button
            @click="handleFind"
            class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
            title="Find (Ctrl+F)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button
            @click="handleReplace"
            class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
            title="Replace (Ctrl+H)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>
          <button
            @click="handleGoToLine"
            class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
            title="Go to Line (Ctrl+G)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </button>
          <div class="w-px h-4 bg-editor-border mx-1"></div>
          <button
            @click="handleFormat"
            class="p-1 hover:bg-editor-active rounded text-gray-400 hover:text-white"
            title="Format Document (Shift+Alt+F)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </button>
          <div class="w-px h-4 bg-editor-border mx-1"></div>
          <span class="text-xs text-gray-500">C++17</span>
        </div>
      </div>

      <!-- Monaco Editor -->
      <div class="flex-1 min-h-0 overflow-hidden">
        <MonacoEditor
          ref="editorRef"
          v-model="currentContent"
          :filename="projectStore.activeFileName"
          @save="handleSave"
        />
      </div>
    </div>

    <!-- New File Dialog -->
    <NewFileDialog
      :is-open="projectStore.isNewFileDialogOpen"
      :existing-files="projectStore.filePaths"
      :parent-path="projectStore.newItemParentFolder"
      @create="handleCreateFile"
      @cancel="handleCancelNewFile"
    />

    <!-- New Folder Dialog -->
    <NewFolderDialog
      :is-open="projectStore.isNewFolderDialogOpen"
      :existing-folders="projectStore.folders.map(f => f.path)"
      :parent-path="projectStore.newItemParentFolder"
      @create="handleCreateFolder"
      @cancel="handleCancelNewFolder"
    />

    <!-- Delete Confirmation Dialog -->
    <Teleport to="body">
      <div
        v-if="projectStore.isDeleteConfirmOpen"
        class="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        @click.self="handleCancelDelete"
      >
        <div class="bg-editor-bg border border-editor-border rounded-lg shadow-2xl w-80">
          <div class="px-4 py-3 border-b border-editor-border">
            <h3 class="text-white font-medium">
              {{ projectStore.folderToDelete ? 'Delete Folder' : 'Delete File' }}
            </h3>
          </div>
          <div class="p-4">
            <p class="text-gray-300">
              Are you sure you want to delete
              <span class="text-allolib-blue font-mono">{{ projectStore.fileToDelete || projectStore.folderToDelete }}</span>?
            </p>
            <p class="text-gray-500 text-sm mt-2">This action cannot be undone.</p>
          </div>
          <div class="px-4 py-3 border-t border-editor-border flex justify-end gap-2">
            <button
              @click="handleCancelDelete"
              class="px-4 py-1.5 text-gray-300 hover:text-white hover:bg-editor-active rounded transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleConfirmDelete"
              class="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
