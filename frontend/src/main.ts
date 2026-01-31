import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'
import { registerAssetStoreForTerminal } from './stores/assetLibrary'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

// Register asset store for terminal access after mount
registerAssetStoreForTerminal()
