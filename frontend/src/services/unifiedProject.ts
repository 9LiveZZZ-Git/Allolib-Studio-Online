/**
 * Unified Project Service
 *
 * Manages saving/loading of the complete project state across browser sessions.
 * Handles export/import of .allolib project files.
 */

import JSZip from 'jszip'
import { useProjectStore } from '@/stores/project'
import { useObjectsStore } from '@/stores/objects'
import { useEnvironmentStore } from '@/stores/environment'
import { useTimelineStore } from '@/stores/timeline'

const STORAGE_KEY = 'allolib-unified-project'
const PROJECT_VERSION = 1

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

interface UnifiedProjectData {
  version: number
  timestamp: number
  name: string
  project: any
  objects: any
  environment: any
  timeline: any
}

/**
 * Load the unified project from localStorage
 */
export function loadUnifiedProject(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      console.log('[UnifiedProject] No saved project found')
      return false
    }

    const data: UnifiedProjectData = JSON.parse(stored)
    console.log(`[UnifiedProject] Loading project: ${data.name}`)

    const projectStore = useProjectStore()
    const objectsStore = useObjectsStore()
    const environmentStore = useEnvironmentStore()
    const timelineStore = useTimelineStore()

    // Restore project files
    if (data.project) {
      if (data.project.files) {
        projectStore.project.files = data.project.files
      }
      if (data.project.folders) {
        projectStore.project.folders = data.project.folders
      }
      if (data.project.name) {
        projectStore.project.name = data.project.name
      }
      if (data.project.activeFile) {
        projectStore.project.activeFile = data.project.activeFile
      }
    }

    // Restore objects
    if (data.objects && objectsStore.fromJSON) {
      objectsStore.fromJSON(data.objects)
    }

    // Restore environment
    if (data.environment && environmentStore.fromJSON) {
      environmentStore.fromJSON(data.environment)
    }

    // Restore timeline state
    if (data.timeline) {
      if (data.timeline.duration !== undefined) {
        timelineStore.duration = data.timeline.duration
      }
    }

    console.log(`[UnifiedProject] Loaded project: ${data.name}`)
    return true
  } catch (error) {
    console.error('[UnifiedProject] Failed to load project:', error)
    return false
  }
}

/**
 * Save the unified project to localStorage
 */
export function saveUnifiedProject(): void {
  try {
    const projectStore = useProjectStore()
    const objectsStore = useObjectsStore()
    const environmentStore = useEnvironmentStore()
    const timelineStore = useTimelineStore()

    const data: UnifiedProjectData = {
      version: PROJECT_VERSION,
      timestamp: Date.now(),
      name: projectStore.project.name || 'Untitled Project',
      project: {
        id: projectStore.project.id,
        name: projectStore.project.name,
        files: projectStore.project.files,
        folders: projectStore.project.folders,
        activeFile: projectStore.project.activeFile,
        createdAt: projectStore.project.createdAt,
        updatedAt: Date.now(),
      },
      objects: objectsStore.toJSON ? objectsStore.toJSON() : null,
      environment: environmentStore.toJSON ? environmentStore.toJSON() : null,
      timeline: {
        duration: timelineStore.duration,
      },
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    console.log(`[UnifiedProject] Saved project: ${data.name}`)
  } catch (error) {
    console.error('[UnifiedProject] Failed to save project:', error)
  }
}

/**
 * Check if a unified project exists in localStorage
 */
export function hasUnifiedProject(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

/**
 * Schedule an auto-save with debouncing
 */
export function scheduleAutoSave(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  autoSaveTimer = setTimeout(() => {
    saveUnifiedProject()
    autoSaveTimer = null
  }, 2000)
}

/**
 * Export the project as a .allolib file (ZIP archive)
 */
export async function downloadProject(): Promise<void> {
  try {
    const projectStore = useProjectStore()
    const objectsStore = useObjectsStore()
    const environmentStore = useEnvironmentStore()
    const timelineStore = useTimelineStore()

    const zip = new JSZip()

    // Add all project files
    const sourcesFolder = zip.folder('sources')
    for (const file of projectStore.files) {
      sourcesFolder?.file(file.path, file.content)
    }

    // Create project metadata
    const projectData: UnifiedProjectData = {
      version: PROJECT_VERSION,
      timestamp: Date.now(),
      name: projectStore.project.name || 'Untitled Project',
      project: {
        id: projectStore.project.id,
        name: projectStore.project.name,
        files: projectStore.project.files.map(f => ({
          name: f.name,
          path: f.path,
          isMain: f.isMain,
        })),
        folders: projectStore.project.folders,
        activeFile: projectStore.project.activeFile,
      },
      objects: objectsStore.toJSON ? objectsStore.toJSON() : null,
      environment: environmentStore.toJSON ? environmentStore.toJSON() : null,
      timeline: {
        duration: timelineStore.duration,
      },
    }

    zip.file('project.json', JSON.stringify(projectData, null, 2))

    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = (projectStore.project.name || 'project').replace(/[^a-zA-Z0-9-_]/g, '_')
    link.href = url
    link.download = `${safeName}.allolib`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log(`[UnifiedProject] Downloaded project: ${link.download}`)
  } catch (error) {
    console.error('[UnifiedProject] Failed to download project:', error)
    throw error
  }
}

/**
 * Import a .allolib project file
 */
export async function importProjectFile(file: File): Promise<void> {
  try {
    const zip = await JSZip.loadAsync(file)

    // Check for project.json
    const projectJsonFile = zip.file('project.json')
    if (!projectJsonFile) {
      throw new Error('Invalid .allolib file: missing project.json')
    }

    const projectJsonText = await projectJsonFile.async('text')
    const data: UnifiedProjectData = JSON.parse(projectJsonText)

    console.log(`[UnifiedProject] Importing project: ${data.name}`)

    const projectStore = useProjectStore()
    const objectsStore = useObjectsStore()
    const environmentStore = useEnvironmentStore()
    const timelineStore = useTimelineStore()

    // Clear current project
    projectStore.newProject()

    // Restore project metadata
    if (data.project) {
      projectStore.project.name = data.name || data.project.name || 'Imported Project'
      if (data.project.folders) {
        projectStore.project.folders = data.project.folders
      }
    }

    // Load source files
    const sourcesFolder = zip.folder('sources')
    if (sourcesFolder) {
      const filePromises: Promise<void>[] = []

      sourcesFolder.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          filePromises.push(
            zipEntry.async('text').then(content => {
              projectStore.addOrUpdateFile(relativePath, content)
            })
          )
        }
      })

      await Promise.all(filePromises)
    }

    // Set active file
    if (data.project?.activeFile) {
      projectStore.setActiveFile(data.project.activeFile)
    } else if (projectStore.files.length > 0) {
      const mainFile = projectStore.files.find(f => f.isMain) || projectStore.files[0]
      projectStore.setActiveFile(mainFile.path)
    }

    // Restore objects
    if (data.objects && objectsStore.fromJSON) {
      objectsStore.fromJSON(data.objects)
    }

    // Restore environment
    if (data.environment && environmentStore.fromJSON) {
      environmentStore.fromJSON(data.environment)
    }

    // Restore timeline
    if (data.timeline) {
      if (data.timeline.duration !== undefined) {
        timelineStore.duration = data.timeline.duration
      }
    }

    // Save to localStorage
    saveUnifiedProject()

    console.log(`[UnifiedProject] Imported project: ${data.name}`)
  } catch (error) {
    console.error('[UnifiedProject] Failed to import project:', error)
    throw error
  }
}

/**
 * Create a new empty project
 */
export function newProject(): void {
  const projectStore = useProjectStore()
  const objectsStore = useObjectsStore()
  const environmentStore = useEnvironmentStore()

  // Clear all stores
  projectStore.newProject()

  if (objectsStore.clear) {
    objectsStore.clear()
  }

  if (environmentStore.reset) {
    environmentStore.reset()
  }

  // Clear localStorage
  localStorage.removeItem(STORAGE_KEY)

  console.log('[UnifiedProject] Created new project')
}
