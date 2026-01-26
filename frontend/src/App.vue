<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from './stores/app'
import Toolbar from './components/Toolbar.vue'
import EditorPane from './components/EditorPane.vue'
import ViewerPane from './components/ViewerPane.vue'
import Console from './components/Console.vue'

const appStore = useAppStore()
const editorRef = ref<InstanceType<typeof EditorPane>>()

const handleRun = async () => {
  const code = editorRef.value?.getCode() || ''
  await appStore.compile(code)
}

const handleStop = () => {
  appStore.stop()
}
</script>

<template>
  <div class="h-screen flex flex-col bg-editor-bg">
    <!-- Toolbar -->
    <Toolbar
      :status="appStore.status"
      @run="handleRun"
      @stop="handleStop"
    />

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Pane: Editor + Console -->
      <div class="w-1/2 flex flex-col border-r border-editor-border">
        <EditorPane ref="editorRef" class="flex-[2]" />
        <Console :output="appStore.consoleOutput" class="flex-1 min-h-[150px]" />
      </div>

      <!-- Right Pane: Viewer -->
      <div class="w-1/2">
        <ViewerPane
          :status="appStore.status"
          :js-url="appStore.jsUrl"
          @started="appStore.setRunning"
          @error="appStore.setError"
          @log="appStore.log"
        />
      </div>
    </div>
  </div>
</template>
