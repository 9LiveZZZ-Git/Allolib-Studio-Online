<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { useTerminalStore } from '@/stores/terminal'

const terminalRef = ref<HTMLDivElement>()
const terminalStore = useTerminalStore()

let term: Terminal | null = null
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!terminalRef.value) return

  term = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
    lineHeight: 1.4,
    scrollback: 5000,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#58a6ff',
      cursorAccent: '#1e1e1e',
      selectionBackground: '#264f78',
      selectionForeground: '#ffffff',
      black: '#1e1e1e',
      red: '#f44747',
      green: '#6a9955',
      yellow: '#dcdcaa',
      blue: '#569cd6',
      magenta: '#c586c0',
      cyan: '#4ec9b0',
      white: '#d4d4d4',
      brightBlack: '#808080',
      brightRed: '#f44747',
      brightGreen: '#6a9955',
      brightYellow: '#dcdcaa',
      brightBlue: '#9cdcfe',
      brightMagenta: '#c586c0',
      brightCyan: '#4ec9b0',
      brightWhite: '#ffffff',
    },
  })

  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)

  term.open(terminalRef.value)

  // Fit after DOM is ready
  requestAnimationFrame(() => {
    fitAddon?.fit()
  })

  // Register with terminal store
  terminalStore.setTerminal(term)

  // Handle user input
  term.onData((data) => {
    terminalStore.handleInput(data)
  })

  // Write welcome banner
  terminalStore.writeWelcomeBanner()

  // Auto-fit on container resize
  resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(() => {
      try {
        fitAddon?.fit()
      } catch {
        // Ignore fit errors during rapid resizing
      }
    })
  })
  resizeObserver.observe(terminalRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  term?.dispose()
  term = null
  fitAddon = null
})

/** Re-fit the terminal (called by parent on tab switch) */
function fit() {
  requestAnimationFrame(() => {
    try {
      fitAddon?.fit()
    } catch {
      // Ignore
    }
  })
}

defineExpose({ fit })
</script>

<template>
  <div ref="terminalRef" class="w-full h-full"></div>
</template>

<style scoped>
div :deep(.xterm) {
  height: 100%;
  padding: 4px;
}
div :deep(.xterm-viewport) {
  overflow-y: auto !important;
}
</style>
