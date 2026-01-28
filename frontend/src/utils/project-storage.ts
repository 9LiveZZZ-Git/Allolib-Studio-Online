/**
 * Project Storage using IndexedDB
 *
 * Provides persistent storage for user projects with features:
 * - Multiple project support
 * - Auto-save capability
 * - Version history
 * - Export/import
 */

export interface Project {
  id: string
  name: string
  code: string
  createdAt: number
  updatedAt: number
  description?: string
}

export interface ProjectVersion {
  id: string
  projectId: string
  code: string
  timestamp: number
  label?: string
}

const DB_NAME = 'allolib-studio'
const DB_VERSION = 1
const PROJECTS_STORE = 'projects'
const VERSIONS_STORE = 'versions'

let db: IDBDatabase | null = null

/**
 * Initialize the IndexedDB database
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Create projects store
      if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
        const projectStore = database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' })
        projectStore.createIndex('name', 'name', { unique: false })
        projectStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      }

      // Create versions store for history
      if (!database.objectStoreNames.contains(VERSIONS_STORE)) {
        const versionStore = database.createObjectStore(VERSIONS_STORE, { keyPath: 'id' })
        versionStore.createIndex('projectId', 'projectId', { unique: false })
        versionStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Save a project (create or update)
 */
export async function saveProject(project: Partial<Project> & { code: string; name: string }): Promise<Project> {
  const database = await initDB()

  const now = Date.now()
  const fullProject: Project = {
    id: project.id || generateId(),
    name: project.name,
    code: project.code,
    description: project.description,
    createdAt: project.createdAt || now,
    updatedAt: now,
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PROJECTS_STORE], 'readwrite')
    const store = transaction.objectStore(PROJECTS_STORE)
    const request = store.put(fullProject)

    request.onsuccess = () => resolve(fullProject)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get a project by ID
 */
export async function getProject(id: string): Promise<Project | undefined> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PROJECTS_STORE], 'readonly')
    const store = transaction.objectStore(PROJECTS_STORE)
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all projects, sorted by most recently updated
 */
export async function getAllProjects(): Promise<Project[]> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PROJECTS_STORE], 'readonly')
    const store = transaction.objectStore(PROJECTS_STORE)
    const index = store.index('updatedAt')
    const request = index.openCursor(null, 'prev') // Descending order

    const projects: Project[] = []
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        projects.push(cursor.value)
        cursor.continue()
      } else {
        resolve(projects)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete a project by ID
 */
export async function deleteProject(id: string): Promise<void> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PROJECTS_STORE, VERSIONS_STORE], 'readwrite')

    // Delete the project
    const projectStore = transaction.objectStore(PROJECTS_STORE)
    projectStore.delete(id)

    // Delete all versions for this project
    const versionStore = transaction.objectStore(VERSIONS_STORE)
    const versionIndex = versionStore.index('projectId')
    const versionRequest = versionIndex.openCursor(IDBKeyRange.only(id))

    versionRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

/**
 * Save a version snapshot
 */
export async function saveVersion(projectId: string, code: string, label?: string): Promise<ProjectVersion> {
  const database = await initDB()

  const version: ProjectVersion = {
    id: generateId(),
    projectId,
    code,
    timestamp: Date.now(),
    label,
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([VERSIONS_STORE], 'readwrite')
    const store = transaction.objectStore(VERSIONS_STORE)
    const request = store.put(version)

    request.onsuccess = () => resolve(version)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get version history for a project
 */
export async function getProjectVersions(projectId: string, limit = 20): Promise<ProjectVersion[]> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([VERSIONS_STORE], 'readonly')
    const store = transaction.objectStore(VERSIONS_STORE)
    const index = store.index('projectId')
    const request = index.openCursor(IDBKeyRange.only(projectId), 'prev')

    const versions: ProjectVersion[] = []
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor && versions.length < limit) {
        versions.push(cursor.value)
        cursor.continue()
      } else {
        resolve(versions)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Export a project to JSON
 */
export function exportProject(project: Project): string {
  return JSON.stringify({
    name: project.name,
    code: project.code,
    description: project.description,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  }, null, 2)
}

/**
 * Import a project from JSON
 */
export function importProject(json: string): Partial<Project> {
  const data = JSON.parse(json)
  return {
    name: data.name || 'Imported Project',
    code: data.code || '',
    description: data.description,
  }
}

/**
 * Search projects by name
 */
export async function searchProjects(query: string): Promise<Project[]> {
  const allProjects = await getAllProjects()
  const lowerQuery = query.toLowerCase()
  return allProjects.filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    (p.description && p.description.toLowerCase().includes(lowerQuery))
  )
}

/**
 * Clean up old versions (keep only recent N versions per project)
 */
export async function cleanupOldVersions(keepCount = 10): Promise<number> {
  const database = await initDB()
  const projects = await getAllProjects()
  let deletedCount = 0

  for (const project of projects) {
    const versions = await getProjectVersions(project.id, 1000)
    if (versions.length > keepCount) {
      const toDelete = versions.slice(keepCount)

      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction([VERSIONS_STORE], 'readwrite')
        const store = transaction.objectStore(VERSIONS_STORE)

        for (const version of toDelete) {
          store.delete(version.id)
          deletedCount++
        }

        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
    }
  }

  return deletedCount
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(): Promise<{ projectCount: number; versionCount: number }> {
  const database = await initDB()

  const projectCount = await new Promise<number>((resolve, reject) => {
    const transaction = database.transaction([PROJECTS_STORE], 'readonly')
    const store = transaction.objectStore(PROJECTS_STORE)
    const request = store.count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  const versionCount = await new Promise<number>((resolve, reject) => {
    const transaction = database.transaction([VERSIONS_STORE], 'readonly')
    const store = transaction.objectStore(VERSIONS_STORE)
    const request = store.count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return { projectCount, versionCount }
}
