<template>
  <div class="asset-loading-test" v-if="settingsStore.display.showAssetLoadingTest">
    <div class="test-header">
      <h3>Asset Loading Test</h3>
      <button @click="settingsStore.display.showAssetLoadingTest = false" class="close-btn">&times;</button>
    </div>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stat">
        <span class="label">Total:</span>
        <span class="value">{{ stats.total }}</span>
      </div>
      <div class="stat">
        <span class="label">Ready:</span>
        <span class="value ready">{{ stats.ready }}</span>
      </div>
      <div class="stat">
        <span class="label">Loading:</span>
        <span class="value loading">{{ stats.loading }}</span>
      </div>
      <div class="stat">
        <span class="label">Errors:</span>
        <span class="value error">{{ stats.errors }}</span>
      </div>
      <div class="stat">
        <span class="label">Bytes:</span>
        <span class="value">{{ formatBytes(stats.bytesLoaded) }}</span>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="overall-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: stats.progress + '%' }"></div>
      </div>
      <span class="progress-text">{{ stats.progress }}%</span>
    </div>

    <!-- Action Buttons -->
    <div class="actions">
      <button @click="preloadAll" :disabled="isPreloading" class="btn primary">
        {{ isPreloading ? 'Preloading...' : 'Preload All' }}
      </button>
      <button @click="loadByTag('essential')" class="btn">Load Essential</button>
      <button @click="loadAllMeshes" class="btn">Load Meshes</button>
      <button @click="loadAllEnvironments" class="btn">Load Environments</button>
      <button @click="unloadAll" class="btn danger">Unload All</button>
    </div>

    <!-- Asset List -->
    <div class="asset-list">
      <div class="list-header">
        <span>Loadable Assets</span>
        <span class="count">{{ loadableAssets.length }} assets</span>
      </div>

      <div class="assets-scroll">
        <div
          v-for="asset in loadableAssets"
          :key="asset.id"
          class="asset-item"
          :class="asset.loadingState"
        >
          <div class="asset-info">
            <span class="asset-icon">{{ getIcon(asset.type) }}</span>
            <span class="asset-name">{{ asset.name }}</span>
            <span class="asset-size">{{ asset.fileSize }}</span>
          </div>

          <div class="asset-status">
            <!-- Status indicator -->
            <span class="status-badge" :class="asset.loadingState || 'idle'">
              {{ asset.loadingState || 'idle' }}
            </span>

            <!-- Progress bar for loading -->
            <div v-if="asset.loadingState === 'loading'" class="mini-progress">
              <div class="mini-fill" :style="{ width: (asset.loadProgress || 0) + '%' }"></div>
            </div>

            <!-- Error message -->
            <span v-if="asset.loadError" class="error-msg" :title="asset.loadError">!</span>
          </div>

          <div class="asset-actions">
            <button
              v-if="asset.loadingState !== 'ready'"
              @click="loadAsset(asset.id)"
              :disabled="asset.loadingState === 'loading'"
              class="btn-sm"
            >
              Load
            </button>
            <button
              v-else
              @click="unloadAsset(asset.id)"
              class="btn-sm danger"
            >
              Unload
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Log -->
    <div class="log-section">
      <div class="log-header">
        <span>Log</span>
        <button @click="logs = []" class="btn-sm">Clear</button>
      </div>
      <div class="log-content">
        <div v-for="(log, i) in logs" :key="i" class="log-entry" :class="log.type">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-msg">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAssetLibraryStore } from '@/stores/assetLibrary'
import { useSettingsStore } from '@/stores/settings'

const store = useAssetLibraryStore()
const settingsStore = useSettingsStore()
const logs = ref<{ time: string; message: string; type: string }[]>([])

// Computed
const stats = computed(() => store.loadingStats)
const isPreloading = computed(() => store.isPreloading)

const loadableAssets = computed(() =>
  store.assets.filter(a => a.localPath || a.downloadUrl)
)

// Helpers
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getIcon(type: string): string {
  const icons: Record<string, string> = {
    texture: '🖼',
    mesh: '△',
    environment: '🌍',
  }
  return icons[type] || '📄'
}

function log(message: string, type = 'info') {
  const time = new Date().toLocaleTimeString()
  logs.value.unshift({ time, message, type })
  if (logs.value.length > 50) logs.value.pop()
}

// Actions
async function loadAsset(id: string) {
  const asset = store.assets.find(a => a.id === id)
  log(`Loading: ${asset?.name || id}`)
  const success = await store.loadAsset(id)
  log(success ? `Loaded: ${asset?.name}` : `Failed: ${asset?.name}`, success ? 'success' : 'error')
}

function unloadAsset(id: string) {
  const asset = store.assets.find(a => a.id === id)
  store.unloadAsset(id)
  log(`Unloaded: ${asset?.name || id}`)
}

async function preloadAll() {
  log('Starting preload...')
  await store.preloadAssets()
  log('Preload complete', 'success')
}

async function loadByTag(tag: string) {
  log(`Loading assets with tag: ${tag}`)
  const results = await store.loadAssetsByTag(tag)
  const loaded = [...results.values()].filter(v => v).length
  log(`Loaded ${loaded}/${results.size} assets`, 'success')
}

async function loadAllMeshes() {
  log('Loading all meshes...')
  const results = await store.loadAssetsByCategory('meshes')
  const loaded = [...results.values()].filter(v => v).length
  log(`Loaded ${loaded}/${results.size} meshes`, 'success')
}

async function loadAllEnvironments() {
  log('Loading all environments...')
  const results = await store.loadAssetsByCategory('environments')
  const loaded = [...results.values()].filter(v => v).length
  log(`Loaded ${loaded}/${results.size} environments`, 'success')
}

function unloadAll() {
  const ready = loadableAssets.value.filter(a => a.loadingState === 'ready')
  ready.forEach(a => store.unloadAsset(a.id))
  log(`Unloaded ${ready.length} assets`)
}

// Watch for loading changes
watch(() => stats.value.loading, (newVal, oldVal) => {
  if (newVal > oldVal) {
    log(`Loading started (${newVal} active)`)
  }
})
</script>

<style scoped>
.asset-loading-test {
  position: fixed;
  top: 50px;
  right: 10px;
  width: 400px;
  max-height: calc(100vh - 100px);
  background: #1e1e2e;
  border: 1px solid #444;
  border-radius: 8px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 12px;
  color: #cdd6f4;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #313244;
  border-radius: 8px 8px 0 0;
}

.test-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}
.close-btn:hover { color: #f38ba8; }

.stats-bar {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  background: #181825;
  border-bottom: 1px solid #333;
}

.stat {
  display: flex;
  gap: 4px;
}
.stat .label { color: #888; }
.stat .value { font-weight: 600; }
.stat .value.ready { color: #a6e3a1; }
.stat .value.loading { color: #f9e2af; }
.stat .value.error { color: #f38ba8; }

.overall-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #181825;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #333;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #89b4fa, #a6e3a1);
  transition: width 0.3s;
}

.progress-text {
  font-size: 11px;
  color: #888;
  min-width: 35px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid #333;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background: #45475a;
  color: #cdd6f4;
  cursor: pointer;
  font-size: 11px;
  transition: background 0.2s;
}
.btn:hover { background: #585b70; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.primary { background: #89b4fa; color: #1e1e2e; }
.btn.primary:hover { background: #b4befe; }
.btn.danger { background: #f38ba8; color: #1e1e2e; }
.btn.danger:hover { background: #eba0ac; }

.btn-sm {
  padding: 3px 8px;
  border: none;
  border-radius: 3px;
  background: #45475a;
  color: #cdd6f4;
  cursor: pointer;
  font-size: 10px;
}
.btn-sm:hover { background: #585b70; }
.btn-sm:disabled { opacity: 0.5; }
.btn-sm.danger { background: #f38ba8; color: #1e1e2e; }

.asset-list {
  flex: 1;
  min-height: 150px;
  max-height: 300px;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #333;
}

.list-header {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #313244;
  font-weight: 600;
}
.list-header .count { color: #888; font-weight: normal; }

.assets-scroll {
  flex: 1;
  overflow-y: auto;
}

.asset-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid #2a2a3a;
  transition: background 0.2s;
}
.asset-item:hover { background: #252536; }
.asset-item.loading { background: rgba(249, 226, 175, 0.1); }
.asset-item.ready { background: rgba(166, 227, 161, 0.05); }
.asset-item.error { background: rgba(243, 139, 168, 0.1); }

.asset-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.asset-icon { font-size: 14px; }
.asset-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.asset-size { color: #666; font-size: 10px; }

.asset-status {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 70px;
}

.status-badge {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 9px;
  text-transform: uppercase;
  font-weight: 600;
}
.status-badge.idle { background: #45475a; color: #888; }
.status-badge.loading { background: #f9e2af; color: #1e1e2e; }
.status-badge.ready { background: #a6e3a1; color: #1e1e2e; }
.status-badge.error { background: #f38ba8; color: #1e1e2e; }

.mini-progress {
  width: 30px;
  height: 3px;
  background: #333;
  border-radius: 2px;
  overflow: hidden;
}
.mini-fill {
  height: 100%;
  background: #f9e2af;
  transition: width 0.2s;
}

.error-msg {
  color: #f38ba8;
  font-weight: bold;
  cursor: help;
}

.log-section {
  max-height: 120px;
  display: flex;
  flex-direction: column;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: #313244;
  font-weight: 600;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  background: #11111b;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 10px;
}

.log-entry {
  padding: 2px 12px;
  display: flex;
  gap: 8px;
}
.log-entry.success { color: #a6e3a1; }
.log-entry.error { color: #f38ba8; }
.log-time { color: #666; }
</style>
