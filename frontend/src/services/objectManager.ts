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
  // Object creation/removal (JS → WASM)
  _al_obj_create: (idPtr: number, namePtr: number, primitivePtr: number) => number
  _al_obj_remove: (idPtr: number) => number
  _al_obj_clear: () => void

  // Transform setters (JS → WASM)
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

  // Object enumeration (WASM → JS) - for syncing C++ objects to timeline
  _al_obj_get_id_by_index: (index: number) => number  // returns char*
  _al_obj_get_name: (idPtr: number) => number         // returns char*
  _al_obj_get_primitive: (idPtr: number) => number    // returns char*
  _al_obj_get_material_type: (idPtr: number) => number // returns char*

  // Transform getters (WASM → JS)
  _al_obj_get_pos_x: (idPtr: number) => number
  _al_obj_get_pos_y: (idPtr: number) => number
  _al_obj_get_pos_z: (idPtr: number) => number
  _al_obj_get_scale_x: (idPtr: number) => number
  _al_obj_get_scale_y: (idPtr: number) => number
  _al_obj_get_scale_z: (idPtr: number) => number
  _al_obj_get_rot_x: (idPtr: number) => number
  _al_obj_get_rot_y: (idPtr: number) => number
  _al_obj_get_rot_z: (idPtr: number) => number
  _al_obj_get_rot_w: (idPtr: number) => number

  // Material getters (WASM → JS)
  _al_obj_get_color_r: (idPtr: number) => number
  _al_obj_get_color_g: (idPtr: number) => number
  _al_obj_get_color_b: (idPtr: number) => number
  _al_obj_get_color_a: (idPtr: number) => number
  _al_obj_get_metallic: (idPtr: number) => number
  _al_obj_get_roughness: (idPtr: number) => number
  _al_obj_get_visible: (idPtr: number) => number
  _al_obj_get_spawn_time: (idPtr: number) => number
  _al_obj_get_destroy_time: (idPtr: number) => number

  // String helpers
  allocateUTF8: (str: string) => number
  UTF8ToString: (ptr: number) => string
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
    this.objectsStore = useObjectsStore()
    this.timelineStore = useTimelineStore()

    // Set up callback for C++ object registration (for future registrations)
    this.setupObjectRegistrationCallback()

    // ALWAYS process pending objects - these come from C++ registerTimelineObject()
    // even if the full ObjectManager WASM bridge isn't available
    this.processPendingObjects()

    // Check if full object manager functions are available
    if (!this.hasObjectManagerFunctions(wasmModule)) {
      console.log('[ObjectManagerBridge] Full WASM object manager not available, but pending objects processed')
      return
    }

    this.wasmModule = wasmModule as ObjectManagerWasm
    console.log('[ObjectManagerBridge] Connected to WASM with full ObjectManager support')

    // Also sync any objects FROM WASM to the store (C++ created objects)
    // This populates the timeline with objects created in C++ code
    this.syncFromWasmToStore()

    // Then sync any objects FROM store to WASM (UI created objects)
    this.syncAllObjects()

    // Watch for object changes
    this.setupWatchers()

    // Start lifecycle update loop
    this.startLifecycleLoop()
  }

  /**
   * Process objects that were registered during module initialization
   * These are captured by the pre-init callback before we're connected
   */
  private processPendingObjects(): void {
    if (!this.objectsStore) return

    const pending = (window as any).__pendingTimelineObjects as Array<{
      id: string
      name: string
      primitive: string
      position: [number, number, number]
      scale: [number, number, number]
      color: [number, number, number, number]
    }> | undefined

    if (!pending || pending.length === 0) {
      console.log('[ObjectManagerBridge] No pending objects to process')
      return
    }

    console.log(`[ObjectManagerBridge] Processing ${pending.length} pending objects from onCreate()`)

    for (const info of pending) {
      this.addObjectToStore(info)
    }

    // Clear the pending list
    ;(window as any).__pendingTimelineObjects = []
  }

  /**
   * Add an object to the store (shared by pending and callback)
   */
  private addObjectToStore(info: {
    id: string
    name: string
    primitive: string
    position: [number, number, number]
    scale: [number, number, number]
    color: [number, number, number, number]
  }): void {
    if (!this.objectsStore) return

    // Check if object already exists in store
    if (this.objectsStore.objects.has(info.id)) {
      console.log(`[ObjectManagerBridge] Object already in store: ${info.id}`)
      return
    }

    // Add to store (this makes it appear in the timeline)
    const sceneObject: SceneObject = {
      id: info.id,
      name: info.name,
      visible: true,
      locked: false,
      transform: {
        position: info.position,
        rotation: [0, 0, 0, 1],  // Identity quaternion
        scale: info.scale,
      },
      mesh: {
        primitive: info.primitive as any || 'sphere',
      },
      material: {
        type: 'basic',
        color: info.color,
        metallic: 0.0,
        roughness: 0.5,
      },
    }

    this.objectsStore.objects.set(info.id, sceneObject)
    this.syncedObjects.add(info.id)

    console.log(`[ObjectManagerBridge] Added to timeline: ${info.name} (${info.id})`)
  }

  /**
   * Set up callback for when C++ code registers objects
   * This handles objects registered AFTER module init (e.g., dynamically created)
   */
  private setupObjectRegistrationCallback(): void {
    // Ensure window.allolib exists
    if (typeof window !== 'undefined') {
      (window as any).allolib = (window as any).allolib || {}

      // Called when C++ code uses registerTimelineObject() after init
      ;(window as any).allolib.onObjectRegistered = (info: {
        id: string
        name: string
        primitive: string
        position: [number, number, number]
        scale: [number, number, number]
        color: [number, number, number, number]
      }) => {
        console.log(`[ObjectManagerBridge] C++ registered object (post-init): ${info.name} (${info.id})`)
        this.addObjectToStore(info)
      }
    }
  }

  /**
   * Disconnect from WASM
   * This is called when loading a new project - clears all objects
   */
  disconnect(): void {
    this.stopLifecycleLoop()

    for (const unwatch of this.unwatchFns) {
      unwatch()
    }
    this.unwatchFns = []

    // Clear the object registration callback
    if (typeof window !== 'undefined' && (window as any).allolib) {
      (window as any).allolib.onObjectRegistered = null
    }

    // Clear pending objects queue
    if (typeof window !== 'undefined') {
      (window as any).__pendingTimelineObjects = []
    }

    // Clear WASM objects (if WASM bridge was connected)
    if (this.wasmModule?._al_obj_clear) {
      this.wasmModule._al_obj_clear()
    }

    // Clear the objects store (timeline) - this resets for new project
    // Do this even if wasmModule wasn't available
    if (this.objectsStore) {
      this.objectsStore.objects.clear()
      this.objectsStore.keyframeCurves.clear()
      this.objectsStore.selectObject(null)
      console.log('[ObjectManagerBridge] Cleared objects store for new project')
    }

    this.wasmModule = null
    this.objectsStore = null
    this.timelineStore = null
    this.syncedObjects.clear()

    console.log('[ObjectManagerBridge] Disconnected')
  }

  /**
   * Sync objects FROM WASM to the ObjectsStore
   * This populates the timeline with objects created in C++ code
   */
  private syncFromWasmToStore(): void {
    if (!this.objectsStore || !this.wasmModule) return

    // Check if enumeration functions are available
    if (!this.wasmModule._al_obj_get_id_by_index) {
      console.log('[ObjectManagerBridge] Object enumeration not available')
      return
    }

    const count = this.wasmModule._al_obj_count()
    if (count === 0) return

    console.log(`[ObjectManagerBridge] Found ${count} C++ objects to sync to timeline`)

    for (let i = 0; i < count; i++) {
      const idPtr = this.wasmModule._al_obj_get_id_by_index(i)
      const id = this.wasmModule.UTF8ToString(idPtr)

      if (!id || this.objectsStore.objects.has(id)) {
        // Skip empty IDs or objects already in store
        continue
      }

      // Allocate ID string for subsequent calls
      const idStrPtr = this.allocString(id)

      // Get object info from WASM
      const namePtr = this.wasmModule._al_obj_get_name(idStrPtr)
      const name = this.wasmModule.UTF8ToString(namePtr)

      const primitivePtr = this.wasmModule._al_obj_get_primitive(idStrPtr)
      const primitive = this.wasmModule.UTF8ToString(primitivePtr)

      const materialTypePtr = this.wasmModule._al_obj_get_material_type(idStrPtr)
      const materialType = this.wasmModule.UTF8ToString(materialTypePtr)

      // Get transform
      const posX = this.wasmModule._al_obj_get_pos_x(idStrPtr)
      const posY = this.wasmModule._al_obj_get_pos_y(idStrPtr)
      const posZ = this.wasmModule._al_obj_get_pos_z(idStrPtr)

      const scaleX = this.wasmModule._al_obj_get_scale_x(idStrPtr)
      const scaleY = this.wasmModule._al_obj_get_scale_y(idStrPtr)
      const scaleZ = this.wasmModule._al_obj_get_scale_z(idStrPtr)

      const rotX = this.wasmModule._al_obj_get_rot_x(idStrPtr)
      const rotY = this.wasmModule._al_obj_get_rot_y(idStrPtr)
      const rotZ = this.wasmModule._al_obj_get_rot_z(idStrPtr)
      const rotW = this.wasmModule._al_obj_get_rot_w(idStrPtr)

      // Get material
      const colorR = this.wasmModule._al_obj_get_color_r(idStrPtr)
      const colorG = this.wasmModule._al_obj_get_color_g(idStrPtr)
      const colorB = this.wasmModule._al_obj_get_color_b(idStrPtr)
      const colorA = this.wasmModule._al_obj_get_color_a(idStrPtr)
      const metallic = this.wasmModule._al_obj_get_metallic(idStrPtr)
      const roughness = this.wasmModule._al_obj_get_roughness(idStrPtr)

      // Get lifecycle
      const visible = this.wasmModule._al_obj_get_visible(idStrPtr) !== 0
      const spawnTime = this.wasmModule._al_obj_get_spawn_time(idStrPtr)
      const destroyTime = this.wasmModule._al_obj_get_destroy_time(idStrPtr)

      this.freeString(idStrPtr)

      // Create object in store (this adds it to the timeline)
      const sceneObject: SceneObject = {
        id,
        name: name || `Object ${i}`,
        visible,
        locked: false,
        transform: {
          position: [posX, posY, posZ],
          rotation: [rotX, rotY, rotZ, rotW],
          scale: [scaleX, scaleY, scaleZ],
        },
        mesh: {
          primitive: primitive as any || 'cube',
        },
        material: {
          type: materialType as any || 'basic',
          color: [colorR, colorG, colorB, colorA],
          metallic,
          roughness,
        },
        spawnTime: spawnTime >= 0 ? spawnTime : undefined,
        destroyTime: destroyTime >= 0 ? destroyTime : undefined,
      }

      // Add to store without syncing back to WASM (we already have it there)
      this.objectsStore.objects.set(id, sceneObject)
      this.syncedObjects.add(id)

      console.log(`[ObjectManagerBridge] Synced C++ object to timeline: ${name} (${id})`)
    }
  }

  /**
   * Sync all objects from store to WASM
   */
  private syncAllObjects(): void {
    if (!this.objectsStore || !this.wasmModule) return

    // Only sync objects that aren't already in WASM
    for (const obj of this.objectsStore.objectList) {
      if (!this.syncedObjects.has(obj.id)) {
        this.createWasmObject(obj)
      }
    }

    console.log(`[ObjectManagerBridge] Total synced objects: ${this.syncedObjects.size}`)
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
   * This runs every frame during playback to:
   * 1. Interpolate keyframes and update object transforms
   * 2. Update lifecycle visibility (spawn/destroy times)
   */
  private startLifecycleLoop(): void {
    const update = () => {
      if (this.wasmModule && this.timelineStore && this.objectsStore) {
        const currentTime = this.timelineStore.currentTime
        const isPlaying = this.timelineStore.playing

        // Always interpolate keyframes when playing (or when scrubbing)
        if (isPlaying || this.lastTime !== currentTime) {
          this.interpolateAllObjects(currentTime)
          this.lastTime = currentTime
        }

        // Update WASM lifecycle (spawn/destroy visibility)
        if (isPlaying) {
          this.wasmModule._al_obj_update_lifecycles(currentTime)
        }
      }
      this.animationFrameId = requestAnimationFrame(update)
    }
    this.animationFrameId = requestAnimationFrame(update)
  }

  private lastTime: number = -1

  /**
   * Interpolate all object properties from keyframes at the given time
   */
  private interpolateAllObjects(time: number): void {
    if (!this.objectsStore) return

    for (const obj of this.objectsStore.objectList) {
      this.interpolateObject(obj.id, time)
    }
  }

  /**
   * Interpolate a single object's properties from keyframes
   */
  private interpolateObject(objectId: string, time: number): void {
    if (!this.objectsStore) return

    const obj = this.objectsStore.getObject(objectId)
    if (!obj) return

    // List of properties that can be keyframed
    const transformProps = [
      { prop: 'positionX', target: 'position', index: 0 },
      { prop: 'positionY', target: 'position', index: 1 },
      { prop: 'positionZ', target: 'position', index: 2 },
      { prop: 'scaleX', target: 'scale', index: 0 },
      { prop: 'scaleY', target: 'scale', index: 1 },
      { prop: 'scaleZ', target: 'scale', index: 2 },
      { prop: 'rotationX', target: 'rotation', index: 0 },
      { prop: 'rotationY', target: 'rotation', index: 1 },
      { prop: 'rotationZ', target: 'rotation', index: 2 },
      { prop: 'rotationW', target: 'rotation', index: 3 },
    ]

    let transformChanged = false

    for (const { prop, target, index } of transformProps) {
      if (this.objectsStore.hasKeyframes(objectId, prop)) {
        const value = this.objectsStore.getValueAtTime(objectId, prop, time)
        if (value !== undefined) {
          const arr = obj.transform[target as keyof typeof obj.transform] as number[]
          if (arr[index] !== value) {
            arr[index] = value
            transformChanged = true
          }
        }
      }
    }

    // Material properties
    const materialProps = [
      { prop: 'colorR', target: 'color', index: 0 },
      { prop: 'colorG', target: 'color', index: 1 },
      { prop: 'colorB', target: 'color', index: 2 },
      { prop: 'colorA', target: 'color', index: 3 },
      { prop: 'metallic', target: 'metallic', index: -1 },
      { prop: 'roughness', target: 'roughness', index: -1 },
    ]

    let materialChanged = false

    for (const { prop, target, index } of materialProps) {
      if (this.objectsStore.hasKeyframes(objectId, prop)) {
        const value = this.objectsStore.getValueAtTime(objectId, prop, time)
        if (value !== undefined) {
          if (index >= 0 && obj.material.color) {
            if (obj.material.color[index] !== value) {
              obj.material.color[index] = value
              materialChanged = true
            }
          } else if (index < 0) {
            const current = obj.material[target as keyof typeof obj.material]
            if (current !== value) {
              (obj.material as any)[target] = value
              materialChanged = true
            }
          }
        }
      }
    }

    // Sync to WASM if anything changed
    if (transformChanged) {
      this.syncObjectTransform(obj)
    }
    if (materialChanged) {
      this.syncObjectMaterial(obj)
    }
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
