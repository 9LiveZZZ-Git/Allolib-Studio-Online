/**
 * Preset file bridge — IDBFS-backed /presets in WASM ↔ project file tree.
 *
 * The WASM image mounts /presets via IDBFS at start-up (al_WebApp.cpp),
 * so .preset and .arrangement.json files written by PresetHandler::storePreset
 * survive page reloads via IndexedDB. This service surfaces those files in
 * the IDE explorer by reading them through the _al_list_dir export and
 * pushing them into the project store as virtual files.
 *
 * - listPresetFiles()       — read /presets via _al_list_dir
 * - clearPresetFiles()      — recursive rm + persist (called on
 *                             new project / load example so presets
 *                             from the previous session don't leak in)
 * - syncPresetFilesToProject() — list + addOrUpdateFile into projectStore
 */

import type { useProjectStore } from '@/stores/project'

type ProjectStore = ReturnType<typeof useProjectStore>

interface PresetFileEntry {
  name: string
  size: number
  isDir: boolean
  body?: string
}

function getModule(): any | null {
  return (window as any).__alloWasmModule ?? (window as any).Module ?? null
}

/** List the files in /presets. Empty array if WASM isn't ready or the dir doesn't exist. */
export function listPresetFiles(path = '/presets'): PresetFileEntry[] {
  const m = getModule()
  if (!m || typeof m._al_list_dir !== 'function') return []
  try {
    const ptr: number = m.ccall ? m.ccall('al_list_dir', 'number', ['string'], [path]) : m._al_list_dir(path)
    if (!ptr) return []
    const json: string = m.UTF8ToString(ptr)
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn('[presetFiles] listPresetFiles failed:', err)
    return []
  }
}

/** Recursively remove /presets and persist the empty FS to IndexedDB.
 * Called when the user starts a new project or loads an example so the
 * previous session's presets don't bleed into the new one. Returns a
 * promise that resolves once the persist sync completes. */
export function clearPresetFiles(path = '/presets'): Promise<void> {
  const m = getModule()
  if (!m || typeof m._al_remove_dir !== 'function') return Promise.resolve()
  return new Promise((resolve) => {
    try {
      if (m.ccall) m.ccall('al_remove_dir', null, ['string'], [path])
      else m._al_remove_dir(path)
      // Recreate the dir + persist the deletion to IndexedDB.
      // Without the syncfs(false) the next session's syncfs(true) would
      // restore the old contents from IDB.
      const FS = (m as any).FS
      if (FS) {
        try { FS.mkdir(path) } catch { /* exists */ }
        if (FS.syncfs) {
          FS.syncfs(false, () => resolve())
          return
        }
      }
      resolve()
    } catch (err) {
      console.warn('[presetFiles] clearPresetFiles failed:', err)
      resolve()
    }
  })
}

/** List /presets and reflect each file as a virtual entry in the project
 * store under "presets/<name>". The IDE file tree picks them up
 * automatically via addOrUpdateFile. */
export function syncPresetFilesToProject(projectStore: ProjectStore): number {
  const entries = listPresetFiles('/presets')
  let added = 0
  for (const e of entries) {
    if (e.isDir) continue
    if (typeof e.body !== 'string') continue
    projectStore.addOrUpdateFile(`presets/${e.name}`, e.body)
    added++
  }
  return added
}
