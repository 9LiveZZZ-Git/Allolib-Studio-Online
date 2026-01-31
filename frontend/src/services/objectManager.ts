/**
 * Object Manager Bridge
 *
 * Connects the frontend ObjectsStore to the WASM ObjectManager.
 * Syncs object creation, transforms, materials, and lifecycle.
 */

import { watch } from 'vue'
import { useObjectsStore, type SceneObject } from '@/stores/objects'
import { useTimelineStore } from '@/stores/timeline'

// ─── WASM Function Types ─────────────────────────────────────────────────────

interface ObjectManagerWasm {
  _al_obj_create: (idPtr: number, namePtr: number, primitivePtr: number) => number
  _al_obj_remove: (idPtr: number) => number
  _al_obj_clear: () => void
  _al_obj_set_position: (idPtr: number, x: number, y: number, z: number) => void
  _al_obj_set_rotation: (idPtr: number, x: number, y: number, z: number, w: number) => void
  _al_obj_set_scale: (idPtr: number, x: number, y: number, z: number) => void
  _al_obj_set_color: (idPtr: number, r: number, g: number, b: number, a: number) => void
  _al_obj_set_material_type: (idPtr: number, typePtr: number) => void
  _al_obj_set_pbr_params: (idPtr: number, metallic: number, roughness: number) => void
  _al_obj_set_visible: (idPtr: number, visible: number) => void
  _al_obj_set_spawn_time: (idPtr: number, time: number) => void
  _al_obj_set_destroy_time: (idPtr: number, time: number) => void
  _al_obj_update_lifecycles: (currentTime: number) => void
  _al_obj_count: () => number
  _al_obj_visible_count: () => number

  // String helpers
  allocateUTF8: (str: string) => number
  _free: (ptr: number) => void
}

// ─── Object Manager Bridge Class ─────────────────────────────────────────────

class ObjectManagerBridge {
  private wasmModule: ObjectManagerWasm | null = null
  private objectsStore: ReturnType<typeof useObjectsStore> | null = null
  private timelineStore: ReturnType<typeof useTimelineStore> | null = null
  private unwatchFns: Array<() => void> = []
  private syncedObjects: Set<string> = new Set()
  private animationFrameId: number | null = null

  /**
   * Check if WASM module has object manager functions
   */
  private hasObjectManagerFunctions(wasm: any): boolean {
    return typeof wasm._al_obj_create === 'function' &&
           typeof wasm._al_obj_clear === 'function'
  }

  /**
   * Connect to WASM module and stores
   */
  connect(wasmModule: any): void {
    // Check if object manager functions are available
    if (!this.hasObjectManagerFunctions(wasmModule)) {
      console.log('[ObjectManagerBridge] WASM object manager not available (expected for basic apps)')
      return
    }

    this.wasmModule = wasmModule as ObjectManagerWasm
    this.objectsStore = useObjectsStore()
    this.timelineStore = useTimelineStore()

    console.log('[ObjectManagerBridge] Connected to WASM')

    // Initial sync of all existing objects
    this.syncAllObjects()

    // Watch for object changes
    this.setupWatchers()

    // Start lifecycle update loop
    this.startLifecycleLoop()
  }

  /**
   * Disconnect from WASM
   */
  disconnect(): void {
    // Only do cleanup if we were actually connected
    if (!this.wasmModule) return

    this.stopLifecycleLoop()

    for (const unwatch of this.unwatchFns) {
      unwatch()
    }
    this.unwatchFns = []

    if (this.wasmModule._al_obj_clear) {
      this.wasmModule._al_obj_clear()
    }

    this.wasmModule = null
    this.objectsStore = null
    this.timelineStore = null
    this.syncedObjects.clear()

    console.log('[ObjectManagerBridge] Disconnected')
  }

  /**
   * Sync all objects from store to WASM
   */
  private syncAllObjects(): void {
    if (!this.objectsStore || !this.wasmModule) return

    // Clear WASM objects first
    this.wasmModule._al_obj_clear()
    this.syncedObjects.clear()

    // Create all objects
    for (const obj of this.objectsStore.objectList) {
      this.createWasmObject(obj)
    }

    console.log(`[ObjectManagerBridge] Synced ${this.syncedObjects.size} objects`)
  }

  /**
   * Create a single object in WASM
   */
  private createWasmObject(obj: SceneObject): void {
    if (!this.wasmModule || this.syncedObjects.has(obj.id)) return

    const idPtr = this.allocString(obj.id)
    const namePtr = this.allocString(obj.name)
    const primitivePtr = this.allocString(obj.mesh.primitive || 'cube')

    const result = this.wasmModule._al_obj_create(idPtr, namePtr, primitivePtr)

    this.freeString(idPtr)
    this.freeString(namePtr)
    this.freeString(primitivePtr)

    if (result === 1) {
      this.syncedObjects.add(obj.id)
      this.syncObjectTransform(obj)
      this.syncObjectMaterial(obj)
      this.syncObjectLifecycle(obj)
    }
  }

  /**
   * Remove an object from WASM
   */
  private removeWasmObject(id: string): void {
    if (!this.wasmModule || !this.syncedObjects.has(id)) return

    const idPtr = this.allocString(id)
    this.wasmModule._al_obj_remove(idPtr)
    this.freeString(idPtr)

    this.syncedObjects.delete(id)
  }

  /**
   * Sync object transform to WASM
   */
  private syncObjectTransform(obj: SceneObject): void {
    if (!this.wasmModule || !this.syncedObjects.has(obj.id)) return

    const idPtr = this.allocString(obj.id)

    const [px, py, pz] = obj.transform.position
    this.wasmModule._al_obj_set_position(idPtr, px, py, pz)

    const [rx, ry, rz, rw] = obj.transform.rotation
    this.wasmModule._al_obj_set_rotation(idPtr, rx, ry, rz, rw)

    const [sx, sy, sz] = obj.transform.scale
    this.wasmModule._al_obj_set_scale(idPtr, sx, sy, sz)

    this.freeString(idPtr)
  }

  /**
   * Sync object material to WASM
   */
  private syncObjectMaterial(obj: SceneObject): void {
    if (!this.wasmModule || !this.syncedObjects.has(obj.id)) return

    const idPtr = this.allocString(obj.id)

    if (obj.material.color) {
      const [r, g, b, a] = obj.material.color
      this.wasmModule._al_obj_set_color(idPtr, r, g, b, a)
    }

    const typePtr = this.allocString(obj.material.type)
    this.wasmModule._al_obj_set_material_type(idPtr, typePtr)
    this.freeString(typePtr)

    if (obj.material.type === 'pbr') {
      this.wasmModule._al_obj_set_pbr_params(
        idPtr,
        obj.material.metallic ?? 0.5,
        obj.material.roughness ?? 0.5
      )
    }

    this.freeString(idPtr)
  }

  /**
   * Sync object lifecycle times to WASM
   */
  private syncObjectLifecycle(obj: SceneObject): void {
    if (!this.wasmModule || !this.syncedObjects.has(obj.id)) return

    const idPtr = this.allocString(obj.id)

    this.wasmModule._al_obj_set_visible(idPtr, obj.visible ? 1 : 0)
    this.wasmModule._al_obj_set_spawn_time(idPtr, obj.spawnTime ?? -1)
    this.wasmModule._al_obj_set_destroy_time(idPtr, obj.destroyTime ?? -1)

    this.freeString(idPtr)
  }

  /**
   * Setup watchers for store changes
   */
  private setupWatchers(): void {
    if (!this.objectsStore) return

    // Watch for object list changes (add/remove)
    this.unwatchFns.push(
      watch(
        () => this.objectsStore!.objectList.length,
        () => {
          this.handleObjectListChange()
        }
      )
    )

    // Watch each object for transform/material changes
    this.unwatchFns.push(
      watch(
        () => this.objectsStore!.objects,
        () => {
          for (const obj of this.objectsStore!.objectList) {
            if (this.syncedObjects.has(obj.id)) {
              this.syncObjectTransform(obj)
              this.syncObjectMaterial(obj)
              this.syncObjectLifecycle(obj)
            }
          }
        },
        { deep: true }
      )
    )
  }

  /**
   * Handle object list changes (additions/removals)
   */
  private handleObjectListChange(): void {
    if (!this.objectsStore) return

    const currentIds = new Set(this.objectsStore.objectList.map(o => o.id))

    // Find removed objects
    for (const id of this.syncedObjects) {
      if (!currentIds.has(id)) {
        this.removeWasmObject(id)
      }
    }

    // Find new objects
    for (const obj of this.objectsStore.objectList) {
      if (!this.syncedObjects.has(obj.id)) {
        this.createWasmObject(obj)
      }
    }
  }

  /**
   * Start the lifecycle update loop
   */
  private startLifecycleLoop(): void {
    const update = () => {
      if (this.wasmModule && this.timelineStore && this.timelineStore.playing) {
        this.wasmModule._al_obj_update_lifecycles(this.timelineStore.currentTime)
      }
      this.animationFrameId = requestAnimationFrame(update)
    }
    this.animationFrameId = requestAnimationFrame(update)
  }

  /**
   * Stop the lifecycle update loop
   */
  private stopLifecycleLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  // ─── String Helpers ──────────────────────────────────────────────────────

  private allocString(str: string): number {
    if (!this.wasmModule?.allocateUTF8) {
      console.warn('[ObjectManagerBridge] allocateUTF8 not available')
      return 0
    }
    return this.wasmModule.allocateUTF8(str)
  }

  private freeString(ptr: number): void {
    if (ptr && this.wasmModule?._free) {
      this.wasmModule._free(ptr)
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Force sync a specific object
   */
  syncObject(id: string): void {
    const obj = this.objectsStore?.getObject(id)
    if (obj) {
      this.syncObjectTransform(obj)
      this.syncObjectMaterial(obj)
      this.syncObjectLifecycle(obj)
    }
  }

  /**
   * Update lifecycle based on current time (manual call)
   */
  updateLifecycles(time: number): void {
    if (this.wasmModule) {
      this.wasmModule._al_obj_update_lifecycles(time)
    }
  }

  /**
   * Get object count from WASM
   */
  getObjectCount(): number {
    return this.wasmModule?._al_obj_count() ?? 0
  }

  /**
   * Get visible object count from WASM
   */
  getVisibleCount(): number {
    return this.wasmModule?._al_obj_visible_count() ?? 0
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.wasmModule !== null
  }
}

// ─── Global Instance ─────────────────────────────────────────────────────────

export const objectManagerBridge = new ObjectManagerBridge()

// Register on window for debugging
if (typeof window !== 'undefined') {
  ;(window as any).__objectManagerBridge = objectManagerBridge
}
