<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from './stores/app'
import { useSettingsStore } from './stores/settings'
import Toolbar from './components/Toolbar.vue'
import EditorPane from './components/EditorPane.vue'
import ViewerPane from './components/ViewerPane.vue'
import Console from './components/Console.vue'

const appStore = useAppStore()
const settingsStore = useSettingsStore()
const editorRef = ref<InstanceType<typeof EditorPane>>()

// Computed panel height style
const panelHeightStyle = computed(() => ({
  height: `${settingsStore.display.consoleHeight}px`,
  minHeight: `${settingsStore.display.consoleHeight}px`,
}))

const handleRun = async () => {
  const code = editorRef.value?.getCode() || ''
  await appStore.compile(code)
}

const handleStop = () => {
  appStore.stop()
}

const handleLoadExample = (code: string) => {
  editorRef.value?.setCode(code)
  appStore.log('[INFO] Example loaded')
}
</script>

<template>
  <div class="h-screen flex flex-col bg-editor-bg">
    <!-- Toolbar -->
    <Toolbar
      :status="appStore.status"
      @run="handleRun"
      @stop="handleStop"
      @load-example="handleLoadExample"
    />

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Pane: Editor + Console -->
      <div class="w-1/2 flex flex-col border-r border-editor-border">
        <EditorPane ref="editorRef" class="flex-1" />
        <Console
          v-show="settingsStore.display.showConsole"
          :output="appStore.consoleOutput"
          :style="panelHeightStyle"
          class="shrink-0"
        />
      </div>

      <!-- Right Pane: Viewer -->
      <div class="w-1/2">
        <ViewerPane
          :status="appStore.status"
          :js-url="appStore.jsUrl"
          :show-audio-panel="settingsStore.display.showAudioPanel"
          :audio-panel-height="settingsStore.display.audioPanelHeight"
          @started="appStore.setRunning"
          @error="appStore.setError"
          @log="appStore.log"
        />
      </div>
    </div>
  </div>
</template>
