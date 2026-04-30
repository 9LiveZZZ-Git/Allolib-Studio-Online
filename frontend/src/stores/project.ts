import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { defaultCode } from '@/utils/monaco-config'

export interface ProjectFile {
  name: string        // Just the filename (e.g., "synth.hpp")
  path: string        // Full path including folders (e.g., "src/synth.hpp")
  content: string
  isMain: boolean
  isDirty: boolean
  createdAt: number
  updatedAt: number
}

export interface ProjectFolder {
  name: string        // Folder name
  path: string        // Full path (e.g., "src" or "src/audio")
  isExpanded: boolean
  createdAt: number
}

export interface Project {
  id: string
  name: string
  files: ProjectFile[]
  folders: ProjectFolder[]
  activeFile: string  // Full path of active file
  createdAt: number
  updatedAt: number
}

// Tree node for display
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  isMain?: boolean
  isDirty?: boolean
  isExpanded?: boolean
  children?: FileTreeNode[]
}

const STORAGE_KEY = 'allolib-project'
const LEGACY_CODE_KEY = 'allolib-code'
const LEGACY_FILENAME_KEY = 'allolib-filename'

// Mirrors frontend/public/assets/. Maps basename → bundled URL path.
// Update when adding to the static asset library so the Import Native
// modal correctly marks references as "bundled" instead of "missing".
const BUNDLED_ASSETS = new Map<string, string>([
  // Meshes
  ['Box.glb',           '/assets/meshes/Box.glb'],
  ['Duck.glb',          '/assets/meshes/Duck.glb'],
  ['RiggedSimple.glb',  '/assets/meshes/RiggedSimple.glb'],
  ['bunny.obj',   '/assets/meshes/bunny.obj'],
  ['spot.obj',    '/assets/meshes/spot.obj'],
  ['suzanne.obj', '/assets/meshes/suzanne.obj'],
  ['teapot.obj',  '/assets/meshes/teapot.obj'],
  // Environments (HDR maps — common ones; partial list is fine, missing
  // entries just fall through to "missing" UX which is acceptable.)
  ['kloofendal_48d_partly_cloudy_puresky_1k.hdr',
    '/assets/environments/kloofendal_48d_partly_cloudy_puresky_1k.hdr'],
])

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function createDefaultProject(): Project {
  return {
    id: generateId(),
    name: 'Untitled Project',
    files: [
      {
        name: 'main.cpp',
        path: 'main.cpp',
        content: defaultCode,
        isMain: true,
        isDirty: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    folders: [],
    activeFile: 'main.cpp',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function migrateFromLegacy(): Project | null {
  const legacyCode = localStorage.getItem(LEGACY_CODE_KEY)
  if (legacyCode) {
    const project: Project = {
      id: generateId(),
      name: 'Migrated Project',
      files: [
        {
          name: 'main.cpp',
          path: 'main.cpp',
          content: legacyCode,
          isMain: true,
          isDirty: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      folders: [],
      activeFile: 'main.cpp',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // Clean up legacy storage
    localStorage.removeItem(LEGACY_CODE_KEY)
    localStorage.removeItem(LEGACY_FILENAME_KEY)

    return project
  }
  return null
}

// Upgrades projects saved before the multi-file/folder schema was introduced.
// Adds the `path` field to files and the `folders` array if they are absent.
function migrateProjectStructure(project: Project): Project {
  project.files = project.files.map(f => ({
    ...f,
    path: f.path || f.name,
  }))
  if (!project.folders) {
    project.folders = []
  }
  return project
}

function loadProject(): Project {
  // First check for existing project in new format
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const project = JSON.parse(stored) as Project
      // Migrate structure if needed (add path/folders)
      return migrateProjectStructure(project)
    } catch (e) {
      console.warn('[Project] Stored project data is invalid JSON, falling back to legacy check:', e)
    }
  }

  // Check for legacy single-file format
  const migrated = migrateFromLegacy()
  if (migrated) {
    return migrated
  }

  // Return new default project
  return createDefaultProject()
}

export const useProjectStore = defineStore('project', () => {
  // State
  const project = ref<Project>(loadProject())
  const isNewFileDialogOpen = ref(false)
  const isNewFolderDialogOpen = ref(false)
  const isDeleteConfirmOpen = ref(false)
  const fileToDelete = ref<string | null>(null)
  const folderToDelete = ref<string | null>(null)
  const newItemParentFolder = ref<string>('')  // Parent folder for new file/folder
  const isExplorerCollapsed = ref(false)

  // Computed
  const files = computed(() => project.value.files)
  const folders = computed(() => project.value.folders)
  const activeFileName = computed(() => project.value.activeFile)
  const activeFile = computed(() =>
    project.value.files.find((f) => f.path === project.value.activeFile)
  )
  const mainFile = computed(() => project.value.files.find((f) => f.isMain))
  const mainFilePath = computed(() => mainFile.value?.path || 'main.cpp')
  const hasUnsavedChanges = computed(() => project.value.files.some((f) => f.isDirty))
  const fileNames = computed(() => project.value.files.map((f) => f.name))
  const filePaths = computed(() => project.value.files.map((f) => f.path))

  // Build file tree for explorer
  const fileTree = computed((): FileTreeNode[] => {
    const root: FileTreeNode[] = []
    const folderMap = new Map<string, FileTreeNode>()

    // Create folder nodes
    for (const folder of project.value.folders) {
      const node: FileTreeNode = {
        name: folder.name,
        path: folder.path,
        type: 'folder',
        isExpanded: folder.isExpanded,
        children: [],
      }
      folderMap.set(folder.path, node)
    }

    // Nest folders properly
    for (const folder of project.value.folders) {
      const parentPath = folder.path.includes('/')
        ? folder.path.substring(0, folder.path.lastIndexOf('/'))
        : ''
      const node = folderMap.get(folder.path)!

      if (parentPath && folderMap.has(parentPath)) {
        folderMap.get(parentPath)!.children!.push(node)
      } else if (!parentPath) {
        root.push(node)
      }
    }

    // Add files to their folders
    for (const file of project.value.files) {
      const fileNode: FileTreeNode = {
        name: file.name,
        path: file.path,
        type: 'file',
        isMain: file.isMain,
        isDirty: file.isDirty,
      }

      const folderPath = file.path.includes('/')
        ? file.path.substring(0, file.path.lastIndexOf('/'))
        : ''

      if (folderPath && folderMap.has(folderPath)) {
        folderMap.get(folderPath)!.children!.push(fileNode)
      } else {
        root.push(fileNode)
      }
    }

    // Sort: folders first, then files, alphabetically
    const sortNodes = (nodes: FileTreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1
        }
        // Keep main file at top of files
        if (a.type === 'file' && b.type === 'file') {
          if (a.isMain) return -1
          if (b.isMain) return 1
        }
        return a.name.localeCompare(b.name)
      })
      nodes.forEach(n => {
        if (n.children) sortNodes(n.children)
      })
    }
    sortNodes(root)

    return root
  })

  // Actions
  function setActiveFile(path: string) {
    const file = project.value.files.find((f) => f.path === path)
    if (file) {
      project.value.activeFile = path
    }
  }

  function updateFileContent(path: string, content: string) {
    const file = project.value.files.find((f) => f.path === path)
    if (file) {
      file.content = content
      file.isDirty = true
      file.updatedAt = Date.now()
      project.value.updatedAt = Date.now()
    }
  }

  /**
   * Asset file lookup helpers (M8.5+).
   *
   * The Import Native flow scans user source for asset path literals
   * (.glb, .obj, .hdr, .wav, ...) and cross-references them against:
   *   1. Project files (anything under assets/ in the FileExplorer)
   *   2. Bundled studio assets at /assets/... (frontend/public/assets/)
   *
   * For (1) we do basename matching since users write asset paths with
   * varied prefixes ("Box.glb", "./Box.glb", "/uploaded/Box.glb"). For
   * (2) we keep a small registry that mirrors what's actually shipped
   * with the studio bundle.
   *
   * Binary uploads (.glb / images / audio) live in the project's
   * binaryAssets map. The runtime preRun walks this map and writes each
   * asset into Emscripten's FS so WebFile::loadFromURL can fetch them
   * via an in-WASM-FS overlay before falling through to the network.
   */
  const binaryAssets = ref<Map<string, ArrayBuffer>>(new Map())

  function findAssetByName(name: string): { source: 'project' | 'bundled' | 'missing'; path?: string } {
    const basename = name.includes('/') ? name.substring(name.lastIndexOf('/') + 1) : name

    // 1. Project text files (anything in assets/ folder, or matching basename anywhere)
    for (const f of project.value.files) {
      const fileBasename = f.name
      if (fileBasename === basename || f.path === name) {
        return { source: 'project', path: f.path }
      }
    }
    // 2. Project binary uploads
    for (const path of binaryAssets.value.keys()) {
      const assetBasename = path.includes('/') ? path.substring(path.lastIndexOf('/') + 1) : path
      if (assetBasename === basename || path === name) {
        return { source: 'project', path }
      }
    }
    // 3. Bundled studio assets — small fixed registry that matches what
    //    ships under frontend/public/assets/. Updated as the asset library
    //    grows; missing entries are marked as 'missing' rather than
    //    HEAD-requested every time.
    if (BUNDLED_ASSETS.has(basename)) {
      return { source: 'bundled', path: BUNDLED_ASSETS.get(basename) }
    }
    return { source: 'missing' }
  }

  function addBinaryAsset(path: string, bytes: ArrayBuffer): void {
    // Normalize: drop leading slashes, ensure assets/ prefix so it appears
    // in the FileExplorer under a single canonical folder.
    let normPath = path.replace(/^\/+/, '')
    if (!normPath.startsWith('assets/')) {
      normPath = 'assets/' + (normPath.includes('/') ? normPath.substring(normPath.lastIndexOf('/') + 1) : normPath)
    }
    binaryAssets.value.set(normPath, bytes)

    // Mirror into project.files as a placeholder marker so the FileExplorer
    // shows the upload (the content stays empty in the text store; the
    // bytes live in binaryAssets). Tag with [binary:N bytes] so the user
    // can see it without us trying to render the bytes as text.
    const placeholder = `[binary asset: ${bytes.byteLength} bytes]`
    addOrUpdateFile(normPath, placeholder)
  }

  function getBinaryAsset(path: string): ArrayBuffer | undefined {
    return binaryAssets.value.get(path)
  }

  function listBinaryAssets(): Array<{ path: string; bytes: ArrayBuffer }> {
    return Array.from(binaryAssets.value.entries()).map(([path, bytes]) => ({ path, bytes }))
  }

  /**
   * Add a new file or update an existing file's content.
   * Used for loading examples and importing files.
   */
  function addOrUpdateFile(path: string, content: string) {
    const existingFile = project.value.files.find((f) => f.path === path)
    if (existingFile) {
      // Update existing file
      existingFile.content = content
      existingFile.isDirty = false
      existingFile.updatedAt = Date.now()
      project.value.updatedAt = Date.now()
    } else {
      // Create new file
      const name = path.includes('/') ? path.substring(path.lastIndexOf('/') + 1) : path

      // Create any necessary folders
      if (path.includes('/')) {
        const folderPath = path.substring(0, path.lastIndexOf('/'))
        const folderParts = folderPath.split('/')
        let currentPath = ''
        for (const part of folderParts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part
          if (!project.value.folders.some((f) => f.path === currentPath)) {
            project.value.folders.push({
              name: part,
              path: currentPath,
              isExpanded: true,
              createdAt: Date.now(),
            })
          }
        }
      }

      const newFile: ProjectFile = {
        name,
        path,
        content,
        isMain: false,
        isDirty: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      project.value.files.push(newFile)
      project.value.updatedAt = Date.now()
    }
  }

  function getFileContent(path: string): string | undefined {
    const file = project.value.files.find((f) => f.path === path)
    return file?.content
  }

  function getFileByPath(path: string): ProjectFile | undefined {
    return project.value.files.find((f) => f.path === path)
  }

  function createFile(name: string, folderPath: string = ''): { success: boolean; error?: string } {
    // Validate filename - strip known extensions first
    const nameWithoutExt = name.replace(/\.(cpp|hpp|h|synthSequence|preset|obj)$/, '')
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(nameWithoutExt)) {
      return {
        success: false,
        error: 'Filename must start with a letter and contain only letters, numbers, underscores, or dashes',
      }
    }

    if (name.length > 60) {
      return { success: false, error: 'Filename too long (max 60 characters)' }
    }

    // Build full path
    const fullPath = folderPath ? `${folderPath}/${name}` : name

    // Check for duplicates (case-insensitive on path)
    if (project.value.files.some((f) => f.path.toLowerCase() === fullPath.toLowerCase())) {
      return { success: false, error: 'A file with this path already exists' }
    }

    // Check max files
    if (project.value.files.length >= 50) {
      return { success: false, error: 'Maximum 50 files per project' }
    }

    // Determine initial content based on extension
    let content = ''
    if (name.endsWith('.hpp') || name.endsWith('.h')) {
      const guard = nameWithoutExt.toUpperCase() + '_HPP'
      content = `#ifndef ${guard}
#define ${guard}

// Header file: ${name}

#endif // ${guard}
`
    } else if (name.endsWith('.synthSequence')) {
      content = `# ${nameWithoutExt}
# @ <start> <dur> <SynthName> <param1> <param2> ...
# Example:
# @ 0 1.0 SineEnv 0.5 440 0.1 0.5 0
`
    } else if (name.endsWith('.preset')) {
      content = `::${nameWithoutExt}
/amplitude f 0.500000
/freq f 440.000000
/attackTime f 0.100000
/releaseTime f 0.500000
/pan f 0.000000
::
`
    } else if (name.endsWith('.obj')) {
      content = `# Wavefront OBJ - ${nameWithoutExt}
# v x y z
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.0 1.0 0.0
# f v1 v2 v3
f 1 2 3
`
    } else if (name.endsWith('.cpp') || name.endsWith('.c')) {
      content = `// Source file: ${name}
`
    } else {
      content = ''
    }

    const newFile: ProjectFile = {
      name,
      path: fullPath,
      content,
      isMain: false,
      isDirty: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    project.value.files.push(newFile)
    project.value.activeFile = fullPath
    project.value.updatedAt = Date.now()

    return { success: true }
  }

  function createFolder(name: string, parentPath: string = ''): { success: boolean; error?: string } {
    // Validate folder name
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
      return {
        success: false,
        error: 'Folder name must start with a letter and contain only letters, numbers, underscores, or dashes',
      }
    }

    if (name.length > 30) {
      return { success: false, error: 'Folder name too long (max 30 characters)' }
    }

    // Build full path
    const fullPath = parentPath ? `${parentPath}/${name}` : name

    // Check for duplicates
    if (project.value.folders.some((f) => f.path.toLowerCase() === fullPath.toLowerCase())) {
      return { success: false, error: 'A folder with this name already exists' }
    }

    // Check max folders
    if (project.value.folders.length >= 20) {
      return { success: false, error: 'Maximum 20 folders per project' }
    }

    const newFolder: ProjectFolder = {
      name,
      path: fullPath,
      isExpanded: true,
      createdAt: Date.now(),
    }

    project.value.folders.push(newFolder)
    project.value.updatedAt = Date.now()

    return { success: true }
  }

  function toggleFolderExpanded(path: string) {
    const folder = project.value.folders.find((f) => f.path === path)
    if (folder) {
      folder.isExpanded = !folder.isExpanded
    }
  }

  function deleteFolder(path: string): { success: boolean; error?: string } {
    // Check if folder has files
    const hasFiles = project.value.files.some((f) => f.path.startsWith(path + '/'))
    if (hasFiles) {
      return { success: false, error: 'Folder contains files. Delete files first.' }
    }

    // Check for subfolders
    const hasSubfolders = project.value.folders.some(
      (f) => f.path !== path && f.path.startsWith(path + '/')
    )
    if (hasSubfolders) {
      return { success: false, error: 'Folder contains subfolders. Delete subfolders first.' }
    }

    const index = project.value.folders.findIndex((f) => f.path === path)
    if (index === -1) {
      return { success: false, error: 'Folder not found' }
    }

    project.value.folders.splice(index, 1)
    project.value.updatedAt = Date.now()

    return { success: true }
  }

  function deleteFile(path: string): { success: boolean; error?: string } {
    const file = project.value.files.find((f) => f.path === path)
    if (!file) {
      return { success: false, error: 'File not found' }
    }

    if (file.isMain) {
      return { success: false, error: `Cannot delete the main entry file (${file.name})` }
    }

    const index = project.value.files.findIndex((f) => f.path === path)
    project.value.files.splice(index, 1)

    // Switch to main file if we deleted the active file
    if (project.value.activeFile === path) {
      project.value.activeFile = mainFilePath.value
    }

    project.value.updatedAt = Date.now()
    return { success: true }
  }

  function renameFile(oldPath: string, newName: string): { success: boolean; error?: string } {
    const file = project.value.files.find((f) => f.path === oldPath)
    if (!file) {
      return { success: false, error: 'File not found' }
    }

    // Build new path (keep same folder)
    const folderPath = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : ''
    const newPath = folderPath ? `${folderPath}/${newName}` : newName

    // Check for duplicates
    if (project.value.files.some((f) => f.path !== oldPath && f.path.toLowerCase() === newPath.toLowerCase())) {
      return { success: false, error: 'A file with this name already exists' }
    }

    file.name = newName
    file.path = newPath
    file.updatedAt = Date.now()

    if (project.value.activeFile === oldPath) {
      project.value.activeFile = newPath
    }

    project.value.updatedAt = Date.now()
    return { success: true }
  }

  function getFilesForCompilation(): Array<{ name: string; content: string }> {
    // Use path for compilation (includes folder structure)
    // Only include source files (.cpp, .hpp, .h), not data files (.preset, .synthSequence, etc.)
    return project.value.files
      .filter((f) => /\.(cpp|hpp|h|c)$/i.test(f.path))
      .map((f) => ({
        name: f.path,
        content: f.content,
      }))
  }

  /**
   * Create a data file (preset, sequence, etc.) without source code filename restrictions
   */
  function createDataFile(path: string, content: string): { success: boolean; error?: string } {
    // Check for duplicates
    if (project.value.files.some((f) => f.path.toLowerCase() === path.toLowerCase())) {
      // Update existing file instead
      const file = project.value.files.find((f) => f.path.toLowerCase() === path.toLowerCase())
      if (file) {
        file.content = content
        file.updatedAt = Date.now()
        project.value.updatedAt = Date.now()
        return { success: true }
      }
    }

    // Extract filename from path
    const name = path.includes('/') ? path.substring(path.lastIndexOf('/') + 1) : path

    const newFile: ProjectFile = {
      name,
      path,
      content,
      isMain: false,
      isDirty: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    project.value.files = [...project.value.files, newFile]
    project.value.updatedAt = Date.now()

    return { success: true }
  }

  function saveProject() {
    // Mark all files as saved
    project.value.files.forEach((f) => {
      f.isDirty = false
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project.value))
  }

  function newProject() {
    project.value = createDefaultProject()
    saveProject()
  }

  function loadFromCode(code: string, filename: string = 'main.cpp') {
    // Create a new project with the provided code
    project.value = {
      id: generateId(),
      name: filename.replace(/\.(cpp|hpp|h)$/, ''),
      files: [
        {
          name: 'main.cpp',
          path: 'main.cpp',
          content: code,
          isMain: true,
          isDirty: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      folders: [],
      activeFile: 'main.cpp',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  function openNewFolderDialog(parentPath: string = '') {
    newItemParentFolder.value = parentPath
    isNewFolderDialogOpen.value = true
  }

  function closeNewFolderDialog() {
    isNewFolderDialogOpen.value = false
    newItemParentFolder.value = ''
  }

  function confirmDeleteFolder(path: string) {
    folderToDelete.value = path
    isDeleteConfirmOpen.value = true
  }

  function executeDeleteFolder() {
    if (folderToDelete.value) {
      deleteFolder(folderToDelete.value)
    }
    folderToDelete.value = null
    isDeleteConfirmOpen.value = false
  }

  function toggleExplorer() {
    isExplorerCollapsed.value = !isExplorerCollapsed.value
  }

  function openNewFileDialog(parentPath: string = '') {
    newItemParentFolder.value = parentPath
    isNewFileDialogOpen.value = true
  }

  function closeNewFileDialog() {
    isNewFileDialogOpen.value = false
    newItemParentFolder.value = ''
  }

  function confirmDeleteFile(name: string) {
    fileToDelete.value = name
    isDeleteConfirmOpen.value = true
  }

  function cancelDeleteFile() {
    fileToDelete.value = null
    isDeleteConfirmOpen.value = false
  }

  function executeDeleteFile() {
    if (fileToDelete.value) {
      deleteFile(fileToDelete.value)
    }
    fileToDelete.value = null
    isDeleteConfirmOpen.value = false
  }

  // Auto-save on changes (debounced via watch)
  let saveTimeout: ReturnType<typeof setTimeout> | null = null
  watch(
    () => project.value,
    () => {
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => {
        saveProject()
      }, 1000) // Auto-save after 1 second of no changes
    },
    { deep: true }
  )

  return {
    // State
    project,
    isNewFileDialogOpen,
    isNewFolderDialogOpen,
    isDeleteConfirmOpen,
    fileToDelete,
    folderToDelete,
    newItemParentFolder,
    isExplorerCollapsed,

    // Computed
    files,
    folders,
    activeFileName,
    activeFile,
    mainFile,
    mainFilePath,
    hasUnsavedChanges,
    fileNames,
    filePaths,
    fileTree,

    // Asset helpers (M8.5)
    binaryAssets,
    findAssetByName,
    addBinaryAsset,
    getBinaryAsset,
    listBinaryAssets,

    // Actions
    setActiveFile,
    updateFileContent,
    addOrUpdateFile,
    getFileContent,
    getFileByPath,
    createFile,
    createFolder,
    deleteFile,
    deleteFolder,
    renameFile,
    toggleFolderExpanded,
    getFilesForCompilation,
    createDataFile,
    saveProject,
    newProject,
    loadFromCode,
    openNewFileDialog,
    closeNewFileDialog,
    openNewFolderDialog,
    closeNewFolderDialog,
    confirmDeleteFile,
    confirmDeleteFolder,
    cancelDeleteFile,
    executeDeleteFile,
    executeDeleteFolder,
    toggleExplorer,
  }
})
