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
// Import examples data for E2E testing
import { allExamples, categoryGroups, isMultiFileExample } from './data/examples'

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

// Expose examples data for E2E testing
;(window as any).__allExamples = allExamples.map(ex => ({
  id: ex.id,
  title: ex.title,
  description: ex.description,
  category: ex.category,
  subcategory: ex.subcategory,
  isMultiFile: isMultiFileExample(ex),
  // Include code/files for loading
  ...('code' in ex ? { code: ex.code } : {}),
  ...('files' in ex ? { files: ex.files, mainFile: ex.mainFile } : {}),
}))
;(window as any).__categoryGroups = categoryGroups
;(window as any).allExamples = (window as any).__allExamples
;(window as any).categoryGroups = categoryGroups

// Register stores for terminal/parameter system access after mount
registerAssetStoreForTerminal()
registerObjectsStoreForTerminal()
registerEnvironmentStoreForTerminal()
registerTimelineStoreForTerminal()
