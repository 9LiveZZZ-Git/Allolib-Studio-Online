import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'
import { registerAssetStoreForTerminal } from './stores/assetLibrary'
import { registerObjectsStoreForTerminal } from './stores/objects'
import { registerEnvironmentStoreForTerminal } from './stores/environment'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

// Register stores for terminal/parameter system access after mount
registerAssetStoreForTerminal()
registerObjectsStoreForTerminal()
registerEnvironmentStoreForTerminal()
