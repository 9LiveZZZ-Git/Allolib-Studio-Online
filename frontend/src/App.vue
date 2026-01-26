<script setup lang="ts">
import { ref } from 'vue'
import Toolbar from './components/Toolbar.vue'
import EditorPane from './components/EditorPane.vue'
import ViewerPane from './components/ViewerPane.vue'
import Console from './components/Console.vue'

const isRunning = ref(false)
const consoleOutput = ref<string[]>([])

const handleRun = () => {
  isRunning.value = true
  consoleOutput.value.push('[INFO] Starting compilation...')
}

const handleStop = () => {
  isRunning.value = false
  consoleOutput.value.push('[INFO] Execution stopped.')
}
</script>

<template>
  <div class="h-screen flex flex-col bg-editor-bg">
    <!-- Toolbar -->
    <Toolbar
      :is-running="isRunning"
      @run="handleRun"
      @stop="handleStop"
    />

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Pane: Editor + Console -->
      <div class="w-1/2 flex flex-col border-r border-editor-border">
        <EditorPane class="flex-1" />
        <Console :output="consoleOutput" class="h-1/3" />
      </div>

      <!-- Right Pane: Viewer -->
      <div class="w-1/2">
        <ViewerPane :is-running="isRunning" />
      </div>
    </div>
  </div>
</template>
