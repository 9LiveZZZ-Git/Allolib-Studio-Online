<!--
  CreateObjectDialog.vue

  Dialog for creating new scene objects with primitive picker.
-->
<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="dialog-overlay" @click.self="close">
        <div class="dialog-container">
          <div class="dialog-header">
            <h3>Create Object</h3>
            <button class="close-btn" @click="close">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" />
                <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" stroke-width="1.5" />
              </svg>
            </button>
          </div>

          <div class="dialog-body">
            <!-- Object Name -->
            <div class="form-group">
              <label>Name</label>
              <input
                type="text"
                v-model="objectName"
                placeholder="Object name"
                @keydown.enter="create"
                ref="nameInput"
              />
            </div>

            <!-- Primitive Picker -->
            <div class="form-group">
              <label>Primitive</label>
              <div class="primitive-grid">
                <button
                  v-for="prim in primitives"
                  :key="prim.id"
                  class="primitive-btn"
                  :class="{ selected: selectedPrimitive === prim.id }"
                  @click="selectedPrimitive = prim.id"
                >
                  <div class="primitive-icon">{{ prim.icon }}</div>
                  <div class="primitive-name">{{ prim.name }}</div>
                </button>
              </div>
            </div>

            <!-- Material Type -->
            <div class="form-group">
              <label>Material</label>
              <div class="material-options">
                <button
                  v-for="mat in materials"
                  :key="mat.id"
                  class="material-btn"
                  :class="{ selected: selectedMaterial === mat.id }"
                  @click="selectedMaterial = mat.id"
                >
                  <span class="material-swatch" :style="{ background: mat.preview }" />
                  <span>{{ mat.name }}</span>
                </button>
              </div>
            </div>

            <!-- Initial Color -->
            <div class="form-group" v-if="selectedMaterial !== 'custom'">
              <label>Color</label>
              <div class="color-row">
                <input
                  type="color"
                  v-model="colorHex"
                  class="color-input"
                />
                <span class="color-value">{{ colorHex }}</span>
              </div>
            </div>

            <!-- Spawn Time -->
            <div class="form-group">
              <label>Spawn At</label>
              <div class="time-row">
                <input
                  type="number"
                  v-model.number="spawnTime"
                  min="0"
                  step="0.1"
                  class="time-input"
                />
                <span class="time-unit">seconds</span>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="hasDestroyTime" />
                  <span>Destroy at</span>
                </label>
                <input
                  v-if="hasDestroyTime"
                  type="number"
                  v-model.number="destroyTime"
                  :min="spawnTime + 0.1"
                  step="0.1"
                  class="time-input"
                />
                <span v-if="hasDestroyTime" class="time-unit">seconds</span>
              </div>
            </div>
          </div>

          <div class="dialog-footer">
            <button class="btn btn-secondary" @click="close">Cancel</button>
            <button class="btn btn-primary" @click="create" :disabled="!objectName.trim()">
              Create Object
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useObjectsStore, type SceneObject } from '@/stores/objects'

const props = defineProps<{
  visible: boolean
  currentTime?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', object: SceneObject): void
}>()

const objectsStore = useObjectsStore()
const nameInput = ref<HTMLInputElement>()

const objectName = ref('')
const selectedPrimitive = ref<'sphere' | 'cube' | 'cylinder' | 'plane' | 'torus' | 'cone'>('cube')
const selectedMaterial = ref<'basic' | 'pbr' | 'custom'>('basic')
const colorHex = ref('#ffffff')
const spawnTime = ref(0)
const destroyTime = ref(10)
const hasDestroyTime = ref(false)

const primitives = [
  { id: 'cube', name: 'Cube', icon: '■' },
  { id: 'sphere', name: 'Sphere', icon: '●' },
  { id: 'cylinder', name: 'Cylinder', icon: '▮' },
  { id: 'cone', name: 'Cone', icon: '▲' },
  { id: 'torus', name: 'Torus', icon: '◎' },
  { id: 'plane', name: 'Plane', icon: '▬' },
] as const

const materials = [
  { id: 'basic', name: 'Basic', preview: 'linear-gradient(135deg, #666 0%, #333 100%)' },
  { id: 'pbr', name: 'PBR', preview: 'linear-gradient(135deg, #888 0%, #444 50%, #222 100%)' },
  { id: 'custom', name: 'Custom', preview: 'linear-gradient(135deg, #9F7AEA 0%, #6B46C1 100%)' },
] as const

function hexToRgba(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b, 1]
}

function create() {
  if (!objectName.value.trim()) return

  const obj = objectsStore.createObject({
    name: objectName.value.trim(),
    mesh: {
      type: 'primitive',
      primitive: selectedPrimitive.value,
    },
    material: {
      type: selectedMaterial.value,
      color: hexToRgba(colorHex.value),
      ...(selectedMaterial.value === 'pbr' ? { metallic: 0.5, roughness: 0.5 } : {}),
    },
    spawnTime: spawnTime.value > 0 ? spawnTime.value : undefined,
    destroyTime: hasDestroyTime.value ? destroyTime.value : undefined,
  })

  emit('created', obj)
  close()
}

function close() {
  emit('close')
}

function reset() {
  objectName.value = `Object ${objectsStore.objectList.length + 1}`
  selectedPrimitive.value = 'cube'
  selectedMaterial.value = 'basic'
  colorHex.value = '#ffffff'
  spawnTime.value = props.currentTime ?? 0
  destroyTime.value = (props.currentTime ?? 0) + 10
  hasDestroyTime.value = false
}

watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    reset()
    nextTick(() => {
      nameInput.value?.focus()
      nameInput.value?.select()
    })
  }
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-container {
  background: #1e1e2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.dialog-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-group input[type="text"],
.form-group input[type="number"] {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #fff;
  font-size: 14px;
}

.form-group input:focus {
  outline: none;
  border-color: rgba(99, 179, 237, 0.5);
}

/* Primitive Grid */
.primitive-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.primitive-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.primitive-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.primitive-btn.selected {
  background: rgba(99, 179, 237, 0.2);
  border-color: rgba(99, 179, 237, 0.5);
}

.primitive-icon {
  font-size: 24px;
  color: #63B3ED;
}

.primitive-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

/* Material Options */
.material-options {
  display: flex;
  gap: 8px;
}

.material-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.material-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.material-btn.selected {
  background: rgba(99, 179, 237, 0.2);
  border-color: rgba(99, 179, 237, 0.5);
  color: #fff;
}

.material-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Color Row */
.color-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-input {
  width: 48px;
  height: 32px;
  padding: 2px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  cursor: pointer;
}

.color-value {
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  color: rgba(255, 255, 255, 0.5);
}

/* Time Row */
.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.time-input {
  width: 80px;
}

.time-unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  margin-left: 8px;
}

.checkbox-label input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #63B3ED;
}

/* Dialog Footer */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.btn-primary {
  background: #63B3ED;
  color: #1a1a2e;
}

.btn-primary:hover {
  background: #90CDF4;
}

.btn-primary:disabled {
  background: rgba(99, 179, 237, 0.3);
  color: rgba(255, 255, 255, 0.3);
  cursor: not-allowed;
}

/* Transitions */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s;
}

.dialog-enter-active .dialog-container,
.dialog-leave-active .dialog-container {
  transition: transform 0.2s;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .dialog-container,
.dialog-leave-to .dialog-container {
  transform: scale(0.95);
}
</style>
