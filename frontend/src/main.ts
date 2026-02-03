import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'
import { registerAssetStoreForTerminal } from './stores/assetLibrary'
import { registerObjectsStoreForTerminal } from './stores/objects'
import { registerEnvironmentStoreForTerminal } from './stores/environment'
import { registerTimelineStoreForTerminal } from './stores/timeline'
import { useProjectStore } from './stores/project'
import { useAppStore } from './stores/app'
import { useSettingsStore } from './stores/settings'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

// Expose Pinia and stores for E2E testing
;(window as any).__pinia = pinia
;(window as any).__stores = {
  project: useProjectStore(pinia),
  app: useAppStore(pinia),
  settings: useSettingsStore(pinia),
}

// Register stores for terminal/parameter system access after mount
registerAssetStoreForTerminal()
registerObjectsStoreForTerminal()
registerEnvironmentStoreForTerminal()
registerTimelineStoreForTerminal()
