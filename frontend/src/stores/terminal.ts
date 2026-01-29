import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { Terminal } from 'xterm'
import { useProjectStore } from './project'
import { useAppStore } from './app'
import { useSequencerStore } from './sequencer'

// ── ANSI helpers ──────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  alloblue: '\x1b[38;2;88;166;255m',
} as const

// ── Types ─────────────────────────────────────────────────────────────────
interface CommandContext {
  args: string[]
  rawArgs: string
  flags: Record<string, string | boolean>
  stdin: string | null           // piped input from previous command
  stdout: string                 // collected output
  redirectFile: string | null    // ">" target
  appendFile: string | null      // ">>" target
}

type CommandFn = (ctx: CommandContext) => void | Promise<void>

export const useTerminalStore = defineStore('terminal', () => {
  // ── State ───────────────────────────────────────────────────────────────
  const terminal = shallowRef<Terminal | null>(null)
  const history = ref<string[]>([])
  const historyIndex = ref(-1)
  const inputBuffer = ref('')
  const cursorPos = ref(0)
  const cwd = ref('/')                        // virtual working directory
  const aliases = ref<Record<string, string>>({
    ll: 'ls -l',
    la: 'ls -a',
    cls: 'clear',
    dir: 'ls',
    type: 'cat',
    del: 'rm',
    copy: 'cp',
    rename: 'mv',
    md: 'mkdir',
    rd: 'rmdir',
    edit: 'open',
    build: 'compile',
  })
  const env = ref<Record<string, string>>({
    USER: 'developer',
    HOME: '/',
    SHELL: '/bin/alloterm',
    TERM: 'xterm-256color',
    EDITOR: 'monaco',
    LANG: 'en_US.UTF-8',
    PROJECT: 'AlloLib Studio',
  })

  // Tab completion state
  let tabCompletionCandidates: string[] = []
  let tabCompletionIndex = -1
  let lastTabInput = ''

  // Saved input for history navigation
  let savedInput = ''

  // User-defined scripts/functions
  interface UserScript {
    name: string
    body: string[]           // array of command lines
    description: string      // user documentation
    args: string[]           // argument names for documentation
    createdAt: number
    updatedAt: number
  }
  const userScripts = ref<Record<string, UserScript>>({})

  // Script execution context for argument passing
  let scriptArgs: string[] = []

  // Load user scripts from localStorage
  function loadUserScripts() {
    try {
      const saved = localStorage.getItem('alloterm-scripts')
      if (saved) {
        userScripts.value = JSON.parse(saved)
      }
    } catch { /* ignore */ }
  }

  // Save user scripts to localStorage
  function saveUserScripts() {
    try {
      localStorage.setItem('alloterm-scripts', JSON.stringify(userScripts.value))
    } catch { /* ignore */ }
  }

  // Initialize scripts on store creation
  loadUserScripts()

  const VERSION = '0.1.0'

  // ── Prompt ──────────────────────────────────────────────────────────────
  function getPrompt(): string {
    const cwdDisplay = cwd.value === '/' ? '~' : cwd.value
    return `${C.alloblue}${cwdDisplay}${C.reset} ${C.alloblue}❯${C.reset} `
  }

  // ── Terminal registration ───────────────────────────────────────────────
  function setTerminal(term: Terminal) {
    terminal.value = term
  }

  function writeWelcomeBanner() {
    const term = terminal.value
    if (!term) return

    term.writeln('')
    term.writeln(`${C.alloblue}  ┌─────────────────────────────────────┐${C.reset}`)
    term.writeln(`${C.alloblue}  │${C.reset}   ${C.bold}${C.white}AlloLib Studio Online${C.reset}  ${C.dim}v${VERSION}${C.reset}    ${C.alloblue}│${C.reset}`)
    term.writeln(`${C.alloblue}  │${C.reset}   ${C.dim}Interactive Terminal${C.reset}              ${C.alloblue}│${C.reset}`)
    term.writeln(`${C.alloblue}  └─────────────────────────────────────┘${C.reset}`)
    term.writeln('')
    term.writeln(`  Type ${C.yellow}help${C.reset} for available commands.`)
    term.writeln('')
    writePrompt()
  }

  function writePrompt() {
    terminal.value?.write(getPrompt())
  }

  // ── Write helpers ───────────────────────────────────────────────────────
  function writeln(text: string) {
    terminal.value?.writeln(text)
  }

  function write(text: string) {
    terminal.value?.write(text)
  }

  function writeError(msg: string) {
    writeln(`${C.red}${msg}${C.reset}`)
  }

  // ── Path resolution ─────────────────────────────────────────────────────
  function resolvePath(input: string): string {
    if (!input) return cwd.value

    let path: string
    if (input.startsWith('/')) {
      path = input
    } else if (input === '~' || input.startsWith('~/')) {
      path = input === '~' ? '/' : '/' + input.slice(2)
    } else {
      path = cwd.value === '/' ? '/' + input : cwd.value + '/' + input
    }

    // Normalize: resolve . and ..
    const parts = path.split('/').filter(Boolean)
    const resolved: string[] = []
    for (const part of parts) {
      if (part === '.') continue
      if (part === '..') {
        resolved.pop()
      } else {
        resolved.push(part)
      }
    }

    return '/' + resolved.join('/')
  }

  /** Convert an absolute virtual path to the project-store relative path */
  function toProjectPath(absPath: string): string {
    return absPath.startsWith('/') ? absPath.slice(1) : absPath
  }

  /** Convert project-store relative path to virtual absolute path */
  function toAbsPath(projectPath: string): string {
    return projectPath.startsWith('/') ? projectPath : '/' + projectPath
  }

  // ── Virtual FS helpers ──────────────────────────────────────────────────
  function getProjectStore() {
    return useProjectStore()
  }

  function getAppStore() {
    return useAppStore()
  }

  function listDir(absDir: string): { files: string[]; dirs: string[] } {
    const ps = getProjectStore()
    const dirPrefix = absDir === '/' ? '' : toProjectPath(absDir)

    const files: string[] = []
    const dirs: Set<string> = new Set()

    for (const f of ps.project.files) {
      if (dirPrefix === '') {
        // Root: files at root level have no '/' in path
        if (!f.path.includes('/')) {
          files.push(f.name)
        } else {
          // Top-level folder name
          dirs.add(f.path.split('/')[0])
        }
      } else {
        if (f.path.startsWith(dirPrefix + '/')) {
          const rest = f.path.slice(dirPrefix.length + 1)
          if (!rest.includes('/')) {
            files.push(rest)
          } else {
            dirs.add(rest.split('/')[0])
          }
        }
      }
    }

    // Also include explicit folders
    for (const folder of ps.project.folders) {
      if (dirPrefix === '') {
        if (!folder.path.includes('/')) {
          dirs.add(folder.name)
        }
      } else {
        if (folder.path.startsWith(dirPrefix + '/')) {
          const rest = folder.path.slice(dirPrefix.length + 1)
          if (!rest.includes('/')) {
            dirs.add(rest)
          }
        }
      }
    }

    return {
      files: files.sort(),
      dirs: [...dirs].sort(),
    }
  }

  function pathExists(absPath: string): 'file' | 'dir' | null {
    const ps = getProjectStore()
    const projPath = toProjectPath(absPath)

    if (absPath === '/') return 'dir'

    // Check files
    if (ps.project.files.some(f => f.path === projPath)) return 'file'

    // Check explicit folders
    if (ps.project.folders.some(f => f.path === projPath)) return 'dir'

    // Check implicit folders (directories implied by file paths)
    if (ps.project.files.some(f => f.path.startsWith(projPath + '/'))) return 'dir'

    return null
  }

  // ── Input handling ──────────────────────────────────────────────────────
  function handleInput(data: string) {
    const term = terminal.value
    if (!term) return

    for (let i = 0; i < data.length; i++) {
      const char = data[i]
      const code = char.charCodeAt(0)

      // Reset tab completion on non-tab input
      if (code !== 9) {
        tabCompletionCandidates = []
        tabCompletionIndex = -1
        lastTabInput = ''
      }

      if (code === 13) {
        // ── Enter ─────────────────────────────────────────────────────
        term.writeln('')
        const command = inputBuffer.value.trim()
        inputBuffer.value = ''
        cursorPos.value = 0
        savedInput = ''

        if (command) {
          history.value.push(command)
          historyIndex.value = history.value.length
          executeCommandLine(command)
        } else {
          writePrompt()
        }
      } else if (code === 9) {
        // ── Tab completion ────────────────────────────────────────────
        handleTabCompletion()
      } else if (code === 127 || code === 8) {
        // ── Backspace ─────────────────────────────────────────────────
        if (cursorPos.value > 0) {
          const before = inputBuffer.value.slice(0, cursorPos.value - 1)
          const after = inputBuffer.value.slice(cursorPos.value)
          inputBuffer.value = before + after
          cursorPos.value--
          term.write('\x1b[D' + after + ' ' + '\x1b[' + (after.length + 1) + 'D')
        }
      } else if (data.slice(i, i + 4) === '\x1b[3~') {
        // ── Delete key ────────────────────────────────────────────────
        i += 3
        if (cursorPos.value < inputBuffer.value.length) {
          const before = inputBuffer.value.slice(0, cursorPos.value)
          const after = inputBuffer.value.slice(cursorPos.value + 1)
          inputBuffer.value = before + after
          term.write(after + ' ' + '\x1b[' + (after.length + 1) + 'D')
        }
      } else if (data.slice(i, i + 3) === '\x1b[A') {
        // ── Up arrow ──────────────────────────────────────────────────
        i += 2
        navigateHistory(-1)
      } else if (data.slice(i, i + 3) === '\x1b[B') {
        // ── Down arrow ────────────────────────────────────────────────
        i += 2
        navigateHistory(1)
      } else if (data.slice(i, i + 3) === '\x1b[C') {
        // ── Right arrow ───────────────────────────────────────────────
        i += 2
        if (cursorPos.value < inputBuffer.value.length) {
          cursorPos.value++
          term.write('\x1b[C')
        }
      } else if (data.slice(i, i + 3) === '\x1b[D') {
        // ── Left arrow ────────────────────────────────────────────────
        i += 2
        if (cursorPos.value > 0) {
          cursorPos.value--
          term.write('\x1b[D')
        }
      } else if (data.slice(i, i + 3) === '\x1b[H' || data.slice(i, i + 4) === '\x1b[1~') {
        // ── Home key ──────────────────────────────────────────────────
        const skip = data.slice(i, i + 4) === '\x1b[1~' ? 3 : 2
        i += skip
        if (cursorPos.value > 0) {
          term.write('\x1b[' + cursorPos.value + 'D')
          cursorPos.value = 0
        }
      } else if (data.slice(i, i + 3) === '\x1b[F' || data.slice(i, i + 4) === '\x1b[4~') {
        // ── End key ───────────────────────────────────────────────────
        const skip = data.slice(i, i + 4) === '\x1b[4~' ? 3 : 2
        i += skip
        const remaining = inputBuffer.value.length - cursorPos.value
        if (remaining > 0) {
          term.write('\x1b[' + remaining + 'C')
          cursorPos.value = inputBuffer.value.length
        }
      } else if (code === 1) {
        // ── Ctrl+A  →  Home ───────────────────────────────────────────
        if (cursorPos.value > 0) {
          term.write('\x1b[' + cursorPos.value + 'D')
          cursorPos.value = 0
        }
      } else if (code === 5) {
        // ── Ctrl+E  →  End ────────────────────────────────────────────
        const remaining = inputBuffer.value.length - cursorPos.value
        if (remaining > 0) {
          term.write('\x1b[' + remaining + 'C')
          cursorPos.value = inputBuffer.value.length
        }
      } else if (code === 21) {
        // ── Ctrl+U  →  Clear line before cursor ──────────────────────
        if (cursorPos.value > 0) {
          const after = inputBuffer.value.slice(cursorPos.value)
          term.write('\x1b[' + cursorPos.value + 'D')
          term.write('\x1b[K')
          term.write(after)
          if (after.length > 0) {
            term.write('\x1b[' + after.length + 'D')
          }
          inputBuffer.value = after
          cursorPos.value = 0
        }
      } else if (code === 11) {
        // ── Ctrl+K  →  Clear line after cursor ───────────────────────
        inputBuffer.value = inputBuffer.value.slice(0, cursorPos.value)
        term.write('\x1b[K')
      } else if (code === 23) {
        // ── Ctrl+W  →  Delete word before cursor ─────────────────────
        if (cursorPos.value > 0) {
          const before = inputBuffer.value.slice(0, cursorPos.value)
          const after = inputBuffer.value.slice(cursorPos.value)
          // Find start of previous word
          let j = before.length - 1
          while (j >= 0 && before[j] === ' ') j--
          while (j >= 0 && before[j] !== ' ') j--
          j++
          const deleted = before.length - j
          inputBuffer.value = before.slice(0, j) + after
          term.write('\x1b[' + deleted + 'D')
          term.write(after + ' '.repeat(deleted))
          term.write('\x1b[' + (after.length + deleted) + 'D')
          cursorPos.value = j
        }
      } else if (code === 3) {
        // ── Ctrl+C ────────────────────────────────────────────────────
        term.writeln('^C')
        inputBuffer.value = ''
        cursorPos.value = 0
        savedInput = ''
        writePrompt()
      } else if (code === 12) {
        // ── Ctrl+L  →  Clear screen ──────────────────────────────────
        term.clear()
        writePrompt()
        term.write(inputBuffer.value)
        if (cursorPos.value < inputBuffer.value.length) {
          term.write('\x1b[' + (inputBuffer.value.length - cursorPos.value) + 'D')
        }
      } else if (code >= 32) {
        // ── Printable character ───────────────────────────────────────
        const before = inputBuffer.value.slice(0, cursorPos.value)
        const after = inputBuffer.value.slice(cursorPos.value)
        inputBuffer.value = before + char + after
        cursorPos.value++
        term.write(char + after)
        if (after.length > 0) {
          term.write('\x1b[' + after.length + 'D')
        }
      }
    }
  }

  // ── History navigation ──────────────────────────────────────────────────
  function navigateHistory(direction: number) {
    const term = terminal.value
    if (!term) return
    if (history.value.length === 0) return

    const newIndex = historyIndex.value + direction
    if (newIndex < 0 || newIndex > history.value.length) return

    // Save current input when starting to navigate
    if (historyIndex.value === history.value.length) {
      savedInput = inputBuffer.value
    }

    // Clear current line
    if (cursorPos.value > 0) {
      term.write('\x1b[' + cursorPos.value + 'D')
    }
    term.write('\x1b[K')

    historyIndex.value = newIndex

    if (newIndex === history.value.length) {
      // Restore saved input
      inputBuffer.value = savedInput
    } else {
      inputBuffer.value = history.value[newIndex]
    }
    cursorPos.value = inputBuffer.value.length
    term.write(inputBuffer.value)
  }

  // ── Tab completion ──────────────────────────────────────────────────────
  function handleTabCompletion() {
    const term = terminal.value
    if (!term) return

    const currentInput = inputBuffer.value
    const beforeCursor = currentInput.slice(0, cursorPos.value)

    // If we're already cycling through candidates
    if (tabCompletionCandidates.length > 0 && lastTabInput === beforeCursor.slice(0, beforeCursor.lastIndexOf(tabCompletionCandidates[tabCompletionIndex] ?? '') || beforeCursor.length)) {
      tabCompletionIndex = (tabCompletionIndex + 1) % tabCompletionCandidates.length
      applyCompletion(tabCompletionCandidates[tabCompletionIndex])
      return
    }

    // Determine what to complete
    const parts = beforeCursor.split(/\s+/)
    const isFirstWord = parts.length <= 1
    const partial = parts[parts.length - 1] || ''
    const cmd = parts[0]?.toLowerCase() || ''

    let candidates: string[]

    if (isFirstWord) {
      // Complete command names (built-ins, aliases, and user scripts)
      const allCmds = Object.keys(commands)
      const allAliases = Object.keys(aliases.value)
      const allUserScripts = Object.keys(userScripts.value)
      const all = [...new Set([...allCmds, ...allAliases, ...allUserScripts])]
      candidates = all.filter(c => c.startsWith(partial)).sort()
    } else if (cmd === 'seq') {
      // Complete seq subcommands
      candidates = completeSeqCommand(parts, partial)
    } else if (cmd === 'script') {
      // Complete script subcommands
      candidates = completeScriptCommand(parts, partial)
    } else if (cmd === 'source' || cmd === '.') {
      // Complete .sh files
      candidates = completePath(partial).filter(p =>
        p.endsWith('.sh') || p.endsWith('/')
      )
    } else {
      // Complete file/folder paths
      candidates = completePath(partial)
    }

    if (candidates.length === 0) return

    if (candidates.length === 1) {
      // Unique match → complete it
      const completion = candidates[0]
      const toInsert = completion.slice(partial.length)
      // Add trailing slash for directories, space for files/commands
      const suffix = isFirstWord ? ' ' : (pathExists(resolvePath(completion)) === 'dir' ? '/' : ' ')
      insertAtCursor(toInsert + suffix)
    } else {
      // Multiple matches
      // Find common prefix
      const common = commonPrefix(candidates)
      if (common.length > partial.length) {
        insertAtCursor(common.slice(partial.length))
      } else {
        // Show candidates
        term.writeln('')
        const formatted = formatColumns(candidates.map(c => {
          const abs = resolvePath(c)
          return pathExists(abs) === 'dir' ? `${C.blue}${c}/${C.reset}` : c
        }))
        writeln(formatted)
        writePrompt()
        term.write(inputBuffer.value)
        if (cursorPos.value < inputBuffer.value.length) {
          term.write('\x1b[' + (inputBuffer.value.length - cursorPos.value) + 'D')
        }
      }

      tabCompletionCandidates = candidates
      tabCompletionIndex = -1
      lastTabInput = beforeCursor
    }
  }

  function completePath(partial: string): string[] {
    let dirPart: string
    let filePart: string

    if (partial.includes('/')) {
      const lastSlash = partial.lastIndexOf('/')
      dirPart = partial.slice(0, lastSlash) || '/'
      filePart = partial.slice(lastSlash + 1)
    } else {
      dirPart = ''
      filePart = partial
    }

    const absDir = dirPart ? resolvePath(dirPart) : cwd.value
    const { files, dirs } = listDir(absDir)

    const all = [...dirs.map(d => d + '/'), ...files]
    const prefix = dirPart ? (dirPart.endsWith('/') ? dirPart : dirPart + '/') : ''

    return all
      .filter(name => {
        const base = name.endsWith('/') ? name.slice(0, -1) : name
        return base.startsWith(filePart)
      })
      .map(name => prefix + name)
  }

  function completeSeqCommand(parts: string[], partial: string): string[] {
    const sequencer = useSequencerStore()

    // seq subcommands
    const seqSubcommands = [
      'play', 'stop', 'pause', 'seek',
      'bpm', 'loop', 'loop-range', 'snap',
      'tracks', 'track',
      'clips', 'clip',
      'notes', 'note',
      'save', 'load',
      'status', 'synths',
    ]

    // Track actions
    const trackActions = ['add', 'del', 'delete', 'rm', 'mute', 'solo']

    // Clip actions
    const clipActions = ['new', 'create', 'sel', 'select', 'del', 'delete', 'rm', 'info']

    // Note actions
    const noteActions = ['add', 'del', 'delete', 'rm']

    // Snap modes
    const snapModes = ['none', 'beat', 'bar', '1/4', '1/8', '1/16']

    // Loop options
    const loopOptions = ['on', 'off']

    const wordIndex = parts.length - 1  // 0-indexed position we're completing

    if (wordIndex === 1) {
      // Completing first seq subcommand
      return seqSubcommands.filter(c => c.startsWith(partial)).sort()
    }

    const subCmd = parts[1]?.toLowerCase() || ''

    if (wordIndex === 2) {
      // Completing second argument after subcommand
      switch (subCmd) {
        case 'track':
          return trackActions.filter(a => a.startsWith(partial)).sort()
        case 'clip':
          return clipActions.filter(a => a.startsWith(partial)).sort()
        case 'note':
          return noteActions.filter(a => a.startsWith(partial)).sort()
        case 'snap':
          return snapModes.filter(m => m.startsWith(partial)).sort()
        case 'loop':
          return loopOptions.filter(o => o.startsWith(partial)).sort()
        case 'load':
          // Complete .synthSequence files
          return completePath(partial).filter(p =>
            p.endsWith('.synthSequence') || p.endsWith('/')
          )
        default:
          return []
      }
    }

    if (wordIndex === 3) {
      const action = parts[2]?.toLowerCase() || ''

      // seq track add <synth>
      if (subCmd === 'track' && action === 'add') {
        const synths = sequencer.detectedSynthClasses.map(s => s.name)
        return synths.filter(s => s.startsWith(partial)).sort()
      }

      // seq track del/mute/solo <index> - complete with track indices
      if (subCmd === 'track' && ['del', 'delete', 'rm', 'mute', 'solo'].includes(action)) {
        const indices = sequencer.arrangementTracks.map((_, i) => String(i))
        return indices.filter(i => i.startsWith(partial))
      }

      // seq clip sel/del <id> - complete with clip IDs
      if (subCmd === 'clip' && ['sel', 'select', 'del', 'delete', 'rm'].includes(action)) {
        const ids = sequencer.clips.map(c => c.id.slice(0, 8))
        return ids.filter(id => id.startsWith(partial))
      }

      // seq note del <id> - complete with note IDs
      if (subCmd === 'note' && ['del', 'delete', 'rm'].includes(action)) {
        const clip = sequencer.activeClip
        if (clip) {
          const ids = clip.notes.map(n => n.id.slice(0, 6))
          return ids.filter(id => id.startsWith(partial))
        }
      }
    }

    return []
  }

  function completeScriptCommand(parts: string[], partial: string): string[] {
    const scriptSubcommands = ['list', 'ls', 'show', 'cat', 'edit', 'del', 'rm', 'delete', 'export', 'import', 'doc']
    const wordIndex = parts.length - 1

    if (wordIndex === 1) {
      // Complete first script subcommand
      return scriptSubcommands.filter(c => c.startsWith(partial)).sort()
    }

    const subCmd = parts[1]?.toLowerCase() || ''

    if (wordIndex === 2) {
      // Complete script name for most commands
      if (['show', 'cat', 'edit', 'del', 'rm', 'delete', 'export', 'doc'].includes(subCmd)) {
        const names = Object.keys(userScripts.value)
        return names.filter(n => n.startsWith(partial)).sort()
      }
      // Complete file path for import
      if (subCmd === 'import') {
        return completePath(partial).filter(p =>
          p.endsWith('.sh') || p.endsWith('/')
        )
      }
    }

    return []
  }

  function applyCompletion(candidate: string) {
    const term = terminal.value
    if (!term) return

    const beforeCursor = inputBuffer.value.slice(0, cursorPos.value)
    const parts = beforeCursor.split(/\s+/)
    const partial = parts[parts.length - 1] || ''

    // Clear from the start of the partial
    const newBefore = beforeCursor.slice(0, beforeCursor.length - partial.length) + candidate
    const after = inputBuffer.value.slice(cursorPos.value)

    // Clear line
    if (cursorPos.value > 0) term.write('\x1b[' + cursorPos.value + 'D')
    term.write('\x1b[K')

    inputBuffer.value = newBefore + after
    cursorPos.value = newBefore.length
    term.write(inputBuffer.value)
    if (after.length > 0) {
      term.write('\x1b[' + after.length + 'D')
    }
  }

  function insertAtCursor(text: string) {
    const term = terminal.value
    if (!term) return

    const before = inputBuffer.value.slice(0, cursorPos.value)
    const after = inputBuffer.value.slice(cursorPos.value)
    inputBuffer.value = before + text + after
    cursorPos.value += text.length
    term.write(text + after)
    if (after.length > 0) {
      term.write('\x1b[' + after.length + 'D')
    }
  }

  function commonPrefix(strings: string[]): string {
    if (strings.length === 0) return ''
    let prefix = strings[0]
    for (let i = 1; i < strings.length; i++) {
      while (!strings[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1)
      }
    }
    return prefix
  }

  function formatColumns(items: string[]): string {
    if (items.length === 0) return ''
    // Simple column layout
    const clean = items.map(i => i.replace(/\x1b\[[^m]*m/g, ''))
    const maxLen = Math.max(...clean.map(s => s.length))
    const colWidth = maxLen + 2
    const cols = Math.max(1, Math.floor(80 / colWidth))
    let out = ''
    for (let i = 0; i < items.length; i++) {
      const pad = ' '.repeat(colWidth - clean[i].length)
      out += items[i] + pad
      if ((i + 1) % cols === 0 && i < items.length - 1) out += '\r\n'
    }
    return out
  }

  // ── Command parsing & execution ─────────────────────────────────────────
  function executeCommandLine(line: string) {
    // Expand aliases (first word only, prevent infinite recursion)
    const expanded = expandAlias(line, new Set())

    // Split by pipes
    const segments = splitPipes(expanded)

    let pipeData: string | null = null
    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si].trim()
      if (!seg) continue

      // Parse redirect on last segment
      let redirect: { file: string; append: boolean } | null = null
      let cmdPart = seg
      const appendMatch = seg.match(/^(.*?)>>(.+)$/)
      const overwriteMatch = seg.match(/^(.*?)>([^>].*)$/)
      if (appendMatch) {
        cmdPart = appendMatch[1].trim()
        redirect = { file: appendMatch[2].trim(), append: true }
      } else if (overwriteMatch) {
        cmdPart = overwriteMatch[1].trim()
        redirect = { file: overwriteMatch[2].trim(), append: false }
      }

      const { cmd, args, flags, rawArgs } = parseCommand(cmdPart)
      if (!cmd) { writePrompt(); return }

      const ctx: CommandContext = {
        args,
        rawArgs,
        flags,
        stdin: pipeData,
        stdout: '',
        redirectFile: redirect && !redirect.append ? redirect.file : null,
        appendFile: redirect && redirect.append ? redirect.file : null,
      }

      const handler = commands[cmd]
      const userScript = userScripts.value[cmd]

      if (handler) {
        try {
          handler(ctx)
        } catch (err) {
          writeError(`${cmd}: ${err instanceof Error ? err.message : String(err)}`)
        }
      } else if (userScript) {
        // Execute user-defined script
        try {
          executeUserScript(userScript, ctx.args)
        } catch (err) {
          writeError(`${cmd}: ${err instanceof Error ? err.message : String(err)}`)
        }
      } else {
        writeError(`${cmd}: command not found`)
      }

      // Handle output redirect
      if (redirect) {
        const absPath = resolvePath(redirect.file)
        const projPath = toProjectPath(absPath)
        const ps = getProjectStore()
        const existing = ps.project.files.find(f => f.path === projPath)
        if (existing) {
          existing.content = redirect.append ? existing.content + ctx.stdout : ctx.stdout
          existing.updatedAt = Date.now()
          existing.isDirty = true
        } else {
          const name = projPath.includes('/') ? projPath.split('/').pop()! : projPath
          ps.project.files.push({
            name,
            path: projPath,
            content: ctx.stdout,
            isMain: false,
            isDirty: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        }
        pipeData = null
      } else {
        pipeData = ctx.stdout || null
      }
    }

    writePrompt()
  }

  /**
   * Execute a user-defined script with argument substitution.
   * Supports: $1, $2... for positional args, $@ for all args, $# for arg count
   */
  function executeUserScript(script: UserScript, args: string[]) {
    // Save current script args context (for nested scripts)
    const prevArgs = scriptArgs
    scriptArgs = args

    try {
      for (const line of script.body) {
        // Skip empty lines and comments
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue

        // Expand script arguments
        const expanded = expandScriptArgs(trimmed, args)

        // Execute the command (but don't write another prompt)
        executeScriptLine(expanded)
      }
    } finally {
      // Restore previous script args context
      scriptArgs = prevArgs
    }
  }

  /**
   * Expand script arguments in a command line.
   * $1, $2... = positional args
   * $@ = all args space-separated
   * $* = all args space-separated
   * $# = number of args
   * $0 = script name (not implemented, use $SCRIPT_NAME env if needed)
   */
  function expandScriptArgs(line: string, args: string[]): string {
    let result = line

    // Replace $# with arg count
    result = result.replace(/\$#/g, String(args.length))

    // Replace $@ and $* with all args
    const allArgs = args.join(' ')
    result = result.replace(/\$@/g, allArgs)
    result = result.replace(/\$\*/g, allArgs)

    // Replace positional args $1, $2, ... $9, ${10}, ${11}, etc.
    result = result.replace(/\$\{(\d+)\}/g, (_, num) => args[parseInt(num) - 1] || '')
    result = result.replace(/\$(\d)/g, (_, num) => args[parseInt(num) - 1] || '')

    return result
  }

  /**
   * Execute a single line from a script (without writing prompt).
   */
  function executeScriptLine(line: string) {
    const expanded = expandAlias(line, new Set())
    const segments = splitPipes(expanded)

    let pipeData: string | null = null
    for (const seg of segments) {
      const trimmed = seg.trim()
      if (!trimmed) continue

      // Parse redirect
      let redirect: { file: string; append: boolean } | null = null
      let cmdPart = trimmed
      const appendMatch = trimmed.match(/^(.*?)>>(.+)$/)
      const overwriteMatch = trimmed.match(/^(.*?)>([^>].*)$/)
      if (appendMatch) {
        cmdPart = appendMatch[1].trim()
        redirect = { file: appendMatch[2].trim(), append: true }
      } else if (overwriteMatch) {
        cmdPart = overwriteMatch[1].trim()
        redirect = { file: overwriteMatch[2].trim(), append: false }
      }

      const { cmd, args, flags, rawArgs } = parseCommand(cmdPart)
      if (!cmd) continue

      const ctx: CommandContext = {
        args,
        rawArgs,
        flags,
        stdin: pipeData,
        stdout: '',
        redirectFile: redirect && !redirect.append ? redirect.file : null,
        appendFile: redirect && redirect.append ? redirect.file : null,
      }

      const handler = commands[cmd]
      const userScript = userScripts.value[cmd]

      if (handler) {
        try { handler(ctx) } catch { /* ignore in scripts */ }
      } else if (userScript) {
        try { executeUserScript(userScript, ctx.args) } catch { /* ignore */ }
      } else {
        writeError(`${cmd}: command not found`)
      }

      // Handle redirect
      if (redirect) {
        const absPath = resolvePath(redirect.file)
        const projPath = toProjectPath(absPath)
        const ps = getProjectStore()
        const existing = ps.project.files.find(f => f.path === projPath)
        if (existing) {
          existing.content = redirect.append ? existing.content + ctx.stdout : ctx.stdout
          existing.updatedAt = Date.now()
          existing.isDirty = true
        } else {
          const name = projPath.includes('/') ? projPath.split('/').pop()! : projPath
          ps.project.files.push({
            name,
            path: projPath,
            content: ctx.stdout,
            isMain: false,
            isDirty: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
        }
        pipeData = null
      } else {
        pipeData = ctx.stdout || null
      }
    }
  }

  function expandAlias(line: string, seen: Set<string>): string {
    const parts = line.match(/^(\S+)(.*)$/)
    if (!parts) return line
    const first = parts[1]
    const rest = parts[2]
    if (seen.has(first)) return line
    if (aliases.value[first]) {
      seen.add(first)
      return expandAlias(aliases.value[first] + rest, seen)
    }
    return line
  }

  function splitPipes(line: string): string[] {
    // Split on | but respect quotes
    const segments: string[] = []
    let current = ''
    let inSingle = false
    let inDouble = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === "'" && !inDouble) { inSingle = !inSingle; current += ch; continue }
      if (ch === '"' && !inSingle) { inDouble = !inDouble; current += ch; continue }
      if (ch === '|' && !inSingle && !inDouble) {
        segments.push(current)
        current = ''
        continue
      }
      current += ch
    }
    segments.push(current)
    return segments
  }

  function parseCommand(input: string): { cmd: string; args: string[]; flags: Record<string, string | boolean>; rawArgs: string } {
    const tokens = tokenize(input)
    if (tokens.length === 0) return { cmd: '', args: [], flags: {}, rawArgs: '' }

    const cmd = tokens[0].toLowerCase()
    const args: string[] = []
    const flags: Record<string, string | boolean> = {}
    const rawArgs = input.slice(input.indexOf(tokens[0]) + tokens[0].length).trim()

    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i]
      if (t.startsWith('--')) {
        const eqIdx = t.indexOf('=')
        if (eqIdx > -1) {
          flags[t.slice(2, eqIdx)] = t.slice(eqIdx + 1)
        } else {
          flags[t.slice(2)] = true
        }
      } else if (t.startsWith('-') && t.length > 1 && !t.startsWith('-', 1)) {
        // Short flags: -l, -la, -n 5
        for (let c = 1; c < t.length; c++) {
          flags[t[c]] = true
        }
      } else {
        args.push(t)
      }
    }

    return { cmd, args, flags, rawArgs }
  }

  function tokenize(input: string): string[] {
    const tokens: string[] = []
    let current = ''
    let inSingle = false
    let inDouble = false
    let escaped = false

    for (const ch of input) {
      if (escaped) { current += ch; escaped = false; continue }
      if (ch === '\\' && !inSingle) { escaped = true; continue }
      if (ch === "'" && !inDouble) { inSingle = !inSingle; continue }
      if (ch === '"' && !inSingle) { inDouble = !inDouble; continue }
      if (ch === ' ' && !inSingle && !inDouble) {
        if (current) { tokens.push(current); current = '' }
        continue
      }
      current += ch
    }
    if (current) tokens.push(current)
    return tokens
  }

  // ── Commands ────────────────────────────────────────────────────────────
  const commands: Record<string, CommandFn> = {
    // ──────────────────────────────────────────────── help
    help(ctx) {
      const topic = ctx.args[0]
      if (topic && commandHelp[topic]) {
        ctx.stdout += commandHelp[topic] + '\n'
        writeln(commandHelp[topic])
        return
      }

      const sections: [string, string[][]][] = [
        ['File System', [
          ['ls [path]', 'List directory contents'],
          ['cd [path]', 'Change directory'],
          ['pwd', 'Print working directory'],
          ['cat <file> ...', 'Display file contents'],
          ['head [-n N] <file>', 'Show first N lines (default 10)'],
          ['tail [-n N] <file>', 'Show last N lines (default 10)'],
          ['touch <file>', 'Create empty file'],
          ['mkdir <dir>', 'Create directory'],
          ['rm <file>', 'Remove file'],
          ['rmdir <dir>', 'Remove empty directory'],
          ['cp <src> <dest>', 'Copy file'],
          ['mv <src> <dest>', 'Move/rename file'],
          ['find [path] [-name pat]', 'Find files by pattern'],
          ['grep <pattern> [files]', 'Search in file contents'],
          ['wc <file>', 'Word, line, byte counts'],
          ['tree [path]', 'Display directory tree'],
        ]],
        ['Editor & Project', [
          ['open <file>', 'Open file in editor'],
          ['compile', 'Compile the project'],
          ['run', 'Compile and run'],
          ['stop', 'Stop running application'],
          ['status', 'Show application status'],
        ]],
        ['Utilities', [
          ['echo <text>', 'Print text (supports > redirect)'],
          ['clear', 'Clear terminal screen'],
          ['history', 'Show command history'],
          ['alias [name=cmd]', 'Show/set command aliases'],
          ['unalias <name>', 'Remove alias'],
          ['env', 'Show environment variables'],
          ['export <K>=<V>', 'Set environment variable'],
          ['date', 'Show current date/time'],
          ['whoami', 'Show current user'],
          ['which <cmd>', 'Show command type'],
          ['version', 'Show version info'],
          ['help [command]', 'Show help'],
        ]],
        ['Sequencer', [
          ['seq play', 'Start playback'],
          ['seq stop', 'Stop and reset'],
          ['seq pause', 'Pause playback'],
          ['seq seek <time>', 'Jump to time (sec or beats)'],
          ['seq bpm [value]', 'Get/set tempo'],
          ['seq loop [on|off]', 'Toggle loop mode'],
          ['seq tracks', 'List arrangement tracks'],
          ['seq clips', 'List all clips'],
          ['seq status', 'Show sequencer state'],
          ['seq synths', 'List detected synths'],
        ]],
        ['Scripting', [
          ['fn <name> <cmd>', 'Define custom function'],
          ['script list', 'List user scripts'],
          ['script show <name>', 'Show script source'],
          ['script edit <name>', 'Edit script in editor'],
          ['script del <name>', 'Delete a script'],
          ['source <file>', 'Execute script file'],
          ['. <file>', 'Execute script file (alias)'],
        ]],
      ]

      writeln('')
      for (const [title, cmds] of sections) {
        writeln(`${C.bold}${C.white}  ${title}${C.reset}`)
        writeln('')
        for (const [cmd, desc] of cmds) {
          const padded = cmd.padEnd(26)
          writeln(`  ${C.yellow}${padded}${C.reset}${C.dim}${desc}${C.reset}`)
        }
        writeln('')
      }
      writeln(`  ${C.dim}Shortcuts: Tab (autocomplete), Ctrl+L (clear), Ctrl+C (cancel)${C.reset}`)
      writeln(`  ${C.dim}           Ctrl+A/E (home/end), Ctrl+W (delete word), Ctrl+U (clear line)${C.reset}`)
      writeln(`  ${C.dim}           ↑↓ (history), | (pipe), >/>> (redirect)${C.reset}`)
      writeln('')

      ctx.stdout = '[help output]'
    },

    // ──────────────────────────────────────────────── ls
    ls(ctx) {
      const target = ctx.args[0] || '.'
      const absPath = resolvePath(target)
      const type = pathExists(absPath)

      if (type === 'file') {
        // ls on a single file
        const projPath = toProjectPath(absPath)
        const ps = getProjectStore()
        const file = ps.project.files.find(f => f.path === projPath)
        if (file) {
          const line = formatLsEntry(file.name, false, ctx.flags, file)
          writeln(line)
          ctx.stdout += file.name + '\n'
        }
        return
      }

      if (type !== 'dir') {
        writeError(`ls: ${target}: No such file or directory`)
        return
      }

      const { files, dirs } = listDir(absPath)
      const showAll = !!ctx.flags['a']
      const longFormat = !!ctx.flags['l']

      const entries: string[] = []
      if (showAll) {
        entries.push('.', '..')
      }
      entries.push(...dirs, ...files)

      if (entries.length === 0) {
        return
      }

      if (longFormat) {
        // Long format listing
        const ps = getProjectStore()
        const dirPrefix = absPath === '/' ? '' : toProjectPath(absPath)
        writeln(`total ${entries.length}`)
        ctx.stdout += `total ${entries.length}\n`
        for (const name of entries) {
          if (name === '.' || name === '..') {
            const line = `${C.blue}d${C.reset}rwxr-xr-x  -  ${C.blue}${name}${C.reset}`
            writeln(line)
            ctx.stdout += name + '\n'
            continue
          }
          const isDir = dirs.includes(name)
          const projPath = dirPrefix ? `${dirPrefix}/${name}` : name
          const file = ps.project.files.find(f => f.path === projPath)
          const line = formatLsLong(name, isDir, file)
          writeln(line)
          ctx.stdout += name + '\n'
        }
      } else {
        // Short format - columns
        const colored = entries.map(name => {
          if (name === '.' || name === '..') return `${C.blue}${name}${C.reset}`
          if (dirs.includes(name)) return `${C.blue}${name}/${C.reset}`
          if (name.endsWith('.cpp') || name.endsWith('.c')) return `${C.green}${name}${C.reset}`
          if (name.endsWith('.hpp') || name.endsWith('.h')) return `${C.cyan}${name}${C.reset}`
          return name
        })
        writeln(formatColumns(colored))
        ctx.stdout = entries.join('\n') + '\n'
      }
    },

    // ──────────────────────────────────────────────── cd
    cd(ctx) {
      const target = ctx.args[0] || '/'
      const absPath = resolvePath(target)
      const type = pathExists(absPath)

      if (type === null) {
        writeError(`cd: ${target}: No such directory`)
        return
      }
      if (type === 'file') {
        writeError(`cd: ${target}: Not a directory`)
        return
      }

      cwd.value = absPath === '/' ? '/' : absPath
    },

    // ──────────────────────────────────────────────── pwd
    pwd(ctx) {
      writeln(cwd.value)
      ctx.stdout = cwd.value + '\n'
    },

    // ──────────────────────────────────────────────── cat
    cat(ctx) {
      // If stdin is available (piped), display it
      if (ctx.stdin !== null && ctx.args.length === 0) {
        writeln(ctx.stdin)
        ctx.stdout = ctx.stdin
        return
      }

      if (ctx.args.length === 0) {
        writeError('cat: missing file operand')
        return
      }

      const ps = getProjectStore()
      for (const arg of ctx.args) {
        const absPath = resolvePath(arg)
        const projPath = toProjectPath(absPath)
        const file = ps.project.files.find(f => f.path === projPath)
        if (!file) {
          writeError(`cat: ${arg}: No such file`)
          continue
        }
        if (ctx.flags['n']) {
          const lines = file.content.split('\n')
          lines.forEach((line, i) => {
            const numStr = `${C.dim}${String(i + 1).padStart(6)}${C.reset}  `
            writeln(numStr + line)
            ctx.stdout += `${i + 1}\t${line}\n`
          })
        } else {
          writeln(file.content)
          ctx.stdout += file.content
          if (!file.content.endsWith('\n')) ctx.stdout += '\n'
        }
      }
    },

    // ──────────────────────────────────────────────── head
    head(ctx) {
      const n = parseInt(ctx.flags['n'] as string) || 10
      const target = ctx.args[0]

      let content: string
      if (!target && ctx.stdin !== null) {
        content = ctx.stdin
      } else if (target) {
        const ps = getProjectStore()
        const absPath = resolvePath(target)
        const projPath = toProjectPath(absPath)
        const file = ps.project.files.find(f => f.path === projPath)
        if (!file) { writeError(`head: ${target}: No such file`); return }
        content = file.content
      } else {
        writeError('head: missing file operand')
        return
      }

      const lines = content.split('\n').slice(0, n)
      const out = lines.join('\n')
      writeln(out)
      ctx.stdout = out + '\n'
    },

    // ──────────────────────────────────────────────── tail
    tail(ctx) {
      const n = parseInt(ctx.flags['n'] as string) || 10
      const target = ctx.args[0]

      let content: string
      if (!target && ctx.stdin !== null) {
        content = ctx.stdin
      } else if (target) {
        const ps = getProjectStore()
        const absPath = resolvePath(target)
        const projPath = toProjectPath(absPath)
        const file = ps.project.files.find(f => f.path === projPath)
        if (!file) { writeError(`tail: ${target}: No such file`); return }
        content = file.content
      } else {
        writeError('tail: missing file operand')
        return
      }

      const allLines = content.split('\n')
      const lines = allLines.slice(-n)
      const out = lines.join('\n')
      writeln(out)
      ctx.stdout = out + '\n'
    },

    // ──────────────────────────────────────────────── touch
    touch(ctx) {
      if (ctx.args.length === 0) {
        writeError('touch: missing file operand')
        return
      }

      const ps = getProjectStore()
      for (const arg of ctx.args) {
        const absPath = resolvePath(arg)
        const projPath = toProjectPath(absPath)

        // If file exists, just update timestamp
        const existing = ps.project.files.find(f => f.path === projPath)
        if (existing) {
          existing.updatedAt = Date.now()
          continue
        }

        // Create new file
        const name = projPath.includes('/') ? projPath.split('/').pop()! : projPath
        const parentDir = projPath.includes('/') ? projPath.slice(0, projPath.lastIndexOf('/')) : ''

        if (parentDir) {
          // Ensure parent directory exists
          const result = ps.createFolder(parentDir.split('/').pop()!, parentDir.includes('/') ? parentDir.slice(0, parentDir.lastIndexOf('/')) : '')
          // Folder may already exist, that's okay
          if (!result.success && result.error !== 'A folder with this name already exists') {
            writeError(`touch: cannot create '${arg}': ${result.error}`)
            continue
          }
        }

        ps.project.files.push({
          name,
          path: projPath,
          content: '',
          isMain: false,
          isDirty: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
    },

    // ──────────────────────────────────────────────── mkdir
    mkdir(ctx) {
      if (ctx.args.length === 0) {
        writeError('mkdir: missing operand')
        return
      }

      const ps = getProjectStore()
      for (const arg of ctx.args) {
        const absPath = resolvePath(arg)
        const projPath = toProjectPath(absPath)

        if (pathExists(absPath)) {
          if (ctx.flags['p']) continue // -p: no error if exists
          writeError(`mkdir: ${arg}: already exists`)
          continue
        }

        if (ctx.flags['p']) {
          // Create parents recursively
          const parts = projPath.split('/')
          let current = ''
          for (const part of parts) {
            const parent = current
            current = current ? current + '/' + part : part
            if (!pathExists(toAbsPath(current))) {
              ps.createFolder(part, parent)
            }
          }
        } else {
          const name = projPath.includes('/') ? projPath.split('/').pop()! : projPath
          const parent = projPath.includes('/') ? projPath.slice(0, projPath.lastIndexOf('/')) : ''
          const result = ps.createFolder(name, parent)
          if (!result.success) {
            writeError(`mkdir: ${arg}: ${result.error}`)
          }
        }
      }
    },

    // ──────────────────────────────────────────────── rm
    rm(ctx) {
      if (ctx.args.length === 0) {
        writeError('rm: missing operand')
        return
      }

      const ps = getProjectStore()
      const recursive = !!ctx.flags['r'] || !!ctx.flags['R']
      const force = !!ctx.flags['f']

      for (const arg of ctx.args) {
        const absPath = resolvePath(arg)
        const projPath = toProjectPath(absPath)
        const type = pathExists(absPath)

        if (!type) {
          if (!force) writeError(`rm: ${arg}: No such file or directory`)
          continue
        }

        if (type === 'dir') {
          if (!recursive) {
            writeError(`rm: ${arg}: is a directory (use -r)`)
            continue
          }
          // Remove all files inside
          const toRemove = ps.project.files.filter(f => f.path.startsWith(projPath + '/') || f.path === projPath)
          for (const file of toRemove) {
            if (file.isMain) {
              writeError(`rm: cannot remove '${file.name}' (main entry file)`)
              continue
            }
            ps.deleteFile(file.path)
          }
          // Remove subfolders deepest first
          const subFolders = ps.project.folders
            .filter(f => f.path.startsWith(projPath + '/') || f.path === projPath)
            .sort((a, b) => b.path.length - a.path.length)
          for (const folder of subFolders) {
            ps.deleteFolder(folder.path)
          }
          continue
        }

        // Regular file
        const result = ps.deleteFile(projPath)
        if (!result.success) {
          writeError(`rm: ${arg}: ${result.error}`)
        }
      }
    },

    // ──────────────────────────────────────────────── rmdir
    rmdir(ctx) {
      if (ctx.args.length === 0) {
        writeError('rmdir: missing operand')
        return
      }

      const ps = getProjectStore()
      for (const arg of ctx.args) {
        const absPath = resolvePath(arg)
        const projPath = toProjectPath(absPath)
        const result = ps.deleteFolder(projPath)
        if (!result.success) {
          writeError(`rmdir: ${arg}: ${result.error}`)
        }
      }
    },

    // ──────────────────────────────────────────────── cp
    cp(ctx) {
      if (ctx.args.length < 2) {
        writeError('cp: missing destination operand')
        return
      }

      const ps = getProjectStore()
      const src = ctx.args[0]
      const dest = ctx.args[1]
      const srcAbs = resolvePath(src)
      const srcProj = toProjectPath(srcAbs)

      const srcFile = ps.project.files.find(f => f.path === srcProj)
      if (!srcFile) {
        writeError(`cp: ${src}: No such file`)
        return
      }

      let destAbs = resolvePath(dest)
      let destProj = toProjectPath(destAbs)

      // If dest is a directory, copy into it with same name
      if (pathExists(destAbs) === 'dir') {
        destProj = destProj + '/' + srcFile.name
        destAbs = toAbsPath(destProj)
      }

      // Check if dest already exists
      if (ps.project.files.some(f => f.path === destProj)) {
        writeError(`cp: ${dest}: File already exists`)
        return
      }

      const name = destProj.includes('/') ? destProj.split('/').pop()! : destProj
      ps.project.files.push({
        name,
        path: destProj,
        content: srcFile.content,
        isMain: false,
        isDirty: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    },

    // ──────────────────────────────────────────────── mv
    mv(ctx) {
      if (ctx.args.length < 2) {
        writeError('mv: missing destination operand')
        return
      }

      const ps = getProjectStore()
      const src = ctx.args[0]
      const dest = ctx.args[1]
      const srcAbs = resolvePath(src)
      const srcProj = toProjectPath(srcAbs)

      const srcFile = ps.project.files.find(f => f.path === srcProj)
      if (!srcFile) {
        writeError(`mv: ${src}: No such file`)
        return
      }

      if (srcFile.isMain) {
        writeError(`mv: cannot move '${srcFile.name}' (main entry file)`)
        return
      }

      let destAbs = resolvePath(dest)
      let destProj = toProjectPath(destAbs)

      // If dest is a directory, move into it with same name
      if (pathExists(destAbs) === 'dir') {
        destProj = destProj + '/' + srcFile.name
        destAbs = toAbsPath(destProj)
      }

      // Check if dest already exists
      if (ps.project.files.some(f => f.path === destProj && f.path !== srcProj)) {
        writeError(`mv: ${dest}: File already exists`)
        return
      }

      const name = destProj.includes('/') ? destProj.split('/').pop()! : destProj
      // Update active file if this was the active one
      if (ps.project.activeFile === srcProj) {
        ps.project.activeFile = destProj
      }
      srcFile.name = name
      srcFile.path = destProj
      srcFile.updatedAt = Date.now()
    },

    // ──────────────────────────────────────────────── find
    find(ctx) {
      const ps = getProjectStore()
      let searchDir = '/'
      let namePattern = ''

      // Parse: find [path] [-name pattern]
      let i = 0
      while (i < ctx.args.length) {
        if (ctx.args[i] === '-name' && i + 1 < ctx.args.length) {
          namePattern = ctx.args[i + 1]
          i += 2
        } else {
          searchDir = resolvePath(ctx.args[i])
          i++
        }
      }

      // Also check flag format
      if (ctx.flags['name']) {
        namePattern = ctx.flags['name'] as string
      }

      const dirPrefix = searchDir === '/' ? '' : toProjectPath(searchDir)
      const regex = namePattern ? globToRegex(namePattern) : null

      for (const file of ps.project.files) {
        const fullPath = '/' + file.path
        if (dirPrefix && !file.path.startsWith(dirPrefix === '' ? '' : dirPrefix + '/') && file.path !== dirPrefix) {
          continue
        }
        if (regex && !regex.test(file.name)) {
          continue
        }
        writeln(fullPath)
        ctx.stdout += fullPath + '\n'
      }
    },

    // ──────────────────────────────────────────────── grep
    grep(ctx) {
      if (ctx.args.length === 0) {
        writeError('grep: missing pattern')
        return
      }

      const pattern = ctx.args[0]
      const caseInsensitive = !!ctx.flags['i']
      const showLineNumbers = !!ctx.flags['n']
      const onlyFileNames = !!ctx.flags['l']
      const invertMatch = !!ctx.flags['v']
      let regex: RegExp
      try {
        regex = new RegExp(pattern, caseInsensitive ? 'gi' : 'g')
      } catch {
        regex = new RegExp(escapeRegex(pattern), caseInsensitive ? 'gi' : 'g')
      }

      const ps = getProjectStore()
      let targets: string[]

      // If piped input, search stdin
      if (ctx.stdin !== null && ctx.args.length === 1) {
        const lines = ctx.stdin.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const match = regex.test(lines[i])
          regex.lastIndex = 0
          if (match !== invertMatch) {
            const highlighted = lines[i].replace(new RegExp(pattern, caseInsensitive ? 'gi' : 'g'),
              m => `${C.red}${C.bold}${m}${C.reset}`)
            const prefix = showLineNumbers ? `${C.green}${i + 1}${C.reset}:` : ''
            writeln(prefix + highlighted)
            ctx.stdout += (showLineNumbers ? `${i + 1}:` : '') + lines[i] + '\n'
          }
        }
        return
      }

      // Search files
      if (ctx.args.length > 1) {
        targets = ctx.args.slice(1)
      } else {
        // Search all files in cwd
        const { files } = listDir(cwd.value)
        targets = files
      }

      const multiFile = targets.length > 1

      for (const t of targets) {
        const absPath = resolvePath(t)
        const projPath = toProjectPath(absPath)
        const file = ps.project.files.find(f => f.path === projPath)
        if (!file) {
          writeError(`grep: ${t}: No such file`)
          continue
        }

        const lines = file.content.split('\n')
        let fileHasMatch = false

        for (let i = 0; i < lines.length; i++) {
          const match = regex.test(lines[i])
          regex.lastIndex = 0
          if (match !== invertMatch) {
            fileHasMatch = true
            if (onlyFileNames) break

            const highlighted = lines[i].replace(new RegExp(pattern, caseInsensitive ? 'gi' : 'g'),
              m => `${C.red}${C.bold}${m}${C.reset}`)
            const filePrefix = multiFile ? `${C.magenta}${t}${C.reset}:` : ''
            const linePrefix = showLineNumbers ? `${C.green}${i + 1}${C.reset}:` : ''
            writeln(filePrefix + linePrefix + highlighted)
            ctx.stdout += (multiFile ? `${t}:` : '') + (showLineNumbers ? `${i + 1}:` : '') + lines[i] + '\n'
          }
        }

        if (onlyFileNames && fileHasMatch) {
          writeln(`${C.magenta}${t}${C.reset}`)
          ctx.stdout += t + '\n'
        }
      }
    },

    // ──────────────────────────────────────────────── wc
    wc(ctx) {
      const targets = ctx.args.length > 0 ? ctx.args : null

      let content: string
      if (targets) {
        const ps = getProjectStore()
        let allOut = ''
        let totalLines = 0
        let totalWords = 0
        let totalBytes = 0

        for (const t of targets) {
          const absPath = resolvePath(t)
          const projPath = toProjectPath(absPath)
          const file = ps.project.files.find(f => f.path === projPath)
          if (!file) { writeError(`wc: ${t}: No such file`); continue }

          const lines = file.content.split('\n').length
          const words = file.content.split(/\s+/).filter(Boolean).length
          const bytes = new Blob([file.content]).size
          totalLines += lines
          totalWords += words
          totalBytes += bytes
          const line = ` ${String(lines).padStart(7)} ${String(words).padStart(7)} ${String(bytes).padStart(7)} ${t}`
          writeln(line)
          allOut += line + '\n'
        }

        if (targets.length > 1) {
          const line = ` ${String(totalLines).padStart(7)} ${String(totalWords).padStart(7)} ${String(totalBytes).padStart(7)} total`
          writeln(line)
          allOut += line + '\n'
        }
        ctx.stdout = allOut
        return
      }

      // Piped input
      content = ctx.stdin || ''
      const lines = content.split('\n').length
      const words = content.split(/\s+/).filter(Boolean).length
      const bytes = new Blob([content]).size
      const out = ` ${String(lines).padStart(7)} ${String(words).padStart(7)} ${String(bytes).padStart(7)}`
      writeln(out)
      ctx.stdout = out + '\n'
    },

    // ──────────────────────────────────────────────── tree
    tree(ctx) {
      const target = ctx.args[0] || '.'
      const absPath = resolvePath(target)

      if (pathExists(absPath) !== 'dir') {
        writeError(`tree: ${target}: No such directory`)
        return
      }

      const displayName = absPath === '/' ? '.' : toProjectPath(absPath)
      writeln(`${C.blue}${displayName}${C.reset}`)
      ctx.stdout += displayName + '\n'

      const result = drawTree(absPath, '', true)
      ctx.stdout += result.text
      writeln(``)
      const summary = `${result.dirs} director${result.dirs === 1 ? 'y' : 'ies'}, ${result.files} file${result.files === 1 ? '' : 's'}`
      writeln(summary)
      ctx.stdout += '\n' + summary + '\n'
    },

    // ──────────────────────────────────────────────── echo
    echo(ctx) {
      const text = ctx.rawArgs
      // Expand environment variables
      const expanded = text.replace(/\$(\w+)/g, (_, name) => env.value[name] || '')
      writeln(expanded)
      ctx.stdout = expanded + '\n'
    },

    // ──────────────────────────────────────────────── open
    open(ctx) {
      if (ctx.args.length === 0) {
        writeError('open: missing file operand')
        return
      }

      const ps = getProjectStore()
      const absPath = resolvePath(ctx.args[0])
      const projPath = toProjectPath(absPath)
      const file = ps.project.files.find(f => f.path === projPath)

      if (!file) {
        writeError(`open: ${ctx.args[0]}: No such file`)
        return
      }

      ps.setActiveFile(projPath)
      writeln(`${C.dim}Opened ${projPath} in editor${C.reset}`)
    },

    // ──────────────────────────────────────────────── compile
    compile(ctx) {
      const app = getAppStore()
      if (app.status === 'compiling') {
        writeError('Already compiling...')
        return
      }
      if (app.status === 'running') {
        writeError('Application is running. Stop it first.')
        return
      }
      writeln(`${C.cyan}Starting compilation...${C.reset}`)
      // Trigger compilation via the global event (App.vue handles this)
      window.dispatchEvent(new CustomEvent('terminal:compile'))
    },

    // ──────────────────────────────────────────────── run
    run(ctx) {
      const app = getAppStore()
      if (app.status === 'running') {
        writeError('Application is already running.')
        return
      }
      writeln(`${C.cyan}Building and running...${C.reset}`)
      window.dispatchEvent(new CustomEvent('terminal:compile'))
    },

    // ──────────────────────────────────────────────── stop
    stop(ctx) {
      const app = getAppStore()
      if (app.status !== 'running' && app.status !== 'loading') {
        writeError('No application is running.')
        return
      }
      app.stop()
      writeln(`${C.yellow}Application stopped.${C.reset}`)
    },

    // ──────────────────────────────────────────────── status
    status(ctx) {
      const app = getAppStore()
      const ps = getProjectStore()

      writeln('')
      writeln(`${C.bold}${C.white}  Project Status${C.reset}`)
      writeln('')
      writeln(`  ${C.dim}Project:${C.reset}     ${ps.project.name}`)
      writeln(`  ${C.dim}Files:${C.reset}       ${ps.project.files.length}`)
      writeln(`  ${C.dim}Folders:${C.reset}     ${ps.project.folders.length}`)
      writeln(`  ${C.dim}Active File:${C.reset} ${ps.project.activeFile}`)

      const statusColor =
        app.status === 'running' ? C.green :
        app.status === 'compiling' ? C.yellow :
        app.status === 'error' ? C.red :
        C.dim
      writeln(`  ${C.dim}Status:${C.reset}      ${statusColor}${app.status}${C.reset}`)

      if (app.errorMessage) {
        writeln(`  ${C.dim}Error:${C.reset}       ${C.red}${app.errorMessage}${C.reset}`)
      }
      writeln('')

      ctx.stdout = `status: ${app.status}\n`
    },

    // ──────────────────────────────────────────────── clear
    clear() {
      terminal.value?.clear()
    },

    // ──────────────────────────────────────────────── history
    history(ctx) {
      if (ctx.flags['c']) {
        history.value = []
        writeln('History cleared.')
        return
      }

      const count = ctx.args[0] ? parseInt(ctx.args[0]) : history.value.length
      const start = Math.max(0, history.value.length - count)

      for (let i = start; i < history.value.length; i++) {
        const line = ` ${C.dim}${String(i + 1).padStart(5)}${C.reset}  ${history.value[i]}`
        writeln(line)
        ctx.stdout += `${i + 1}\t${history.value[i]}\n`
      }
    },

    // ──────────────────────────────────────────────── alias
    alias(ctx) {
      if (ctx.args.length === 0 && !ctx.rawArgs.includes('=')) {
        // Show all aliases
        for (const [name, value] of Object.entries(aliases.value)) {
          writeln(`${C.cyan}${name}${C.reset}='${value}'`)
          ctx.stdout += `${name}='${value}'\n`
        }
        return
      }

      // Set alias: alias name='value' or alias name=value
      const raw = ctx.rawArgs
      const eqIdx = raw.indexOf('=')
      if (eqIdx === -1) {
        // Show specific alias
        const name = ctx.args[0]
        if (aliases.value[name]) {
          writeln(`${C.cyan}${name}${C.reset}='${aliases.value[name]}'`)
        } else {
          writeError(`alias: ${name}: not found`)
        }
        return
      }

      const name = raw.slice(0, eqIdx).trim()
      let value = raw.slice(eqIdx + 1).trim()
      // Remove surrounding quotes
      if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1)
      }
      aliases.value[name] = value
    },

    // ──────────────────────────────────────────────── unalias
    unalias(ctx) {
      if (ctx.args.length === 0) {
        writeError('unalias: missing argument')
        return
      }
      for (const name of ctx.args) {
        if (aliases.value[name]) {
          delete aliases.value[name]
        } else {
          writeError(`unalias: ${name}: not found`)
        }
      }
    },

    // ──────────────────────────────────────────────── env
    env(ctx) {
      for (const [key, val] of Object.entries(env.value)) {
        writeln(`${C.cyan}${key}${C.reset}=${val}`)
        ctx.stdout += `${key}=${val}\n`
      }
    },

    // ──────────────────────────────────────────────── export
    export(ctx) {
      const raw = ctx.rawArgs
      const eqIdx = raw.indexOf('=')
      if (eqIdx === -1) {
        writeError('export: usage: export KEY=VALUE')
        return
      }
      const key = raw.slice(0, eqIdx).trim()
      let value = raw.slice(eqIdx + 1).trim()
      if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
        value = value.slice(1, -1)
      }
      env.value[key] = value
    },

    // ──────────────────────────────────────────────── date
    date(ctx) {
      const now = new Date().toString()
      writeln(now)
      ctx.stdout = now + '\n'
    },

    // ──────────────────────────────────────────────── whoami
    whoami(ctx) {
      const user = env.value.USER || 'developer'
      writeln(user)
      ctx.stdout = user + '\n'
    },

    // ──────────────────────────────────────────────── which
    which(ctx) {
      if (ctx.args.length === 0) {
        writeError('which: missing argument')
        return
      }

      for (const name of ctx.args) {
        if (commands[name]) {
          writeln(`${name}: shell built-in command`)
          ctx.stdout += `${name}: shell built-in command\n`
        } else if (aliases.value[name]) {
          writeln(`${name}: aliased to '${aliases.value[name]}'`)
          ctx.stdout += `${name}: aliased to '${aliases.value[name]}'\n`
        } else {
          writeError(`${name}: not found`)
        }
      }
    },

    // ──────────────────────────────────────────────── fn (define function/script)
    fn(ctx) {
      if (ctx.args.length < 1) {
        writeln(`${C.bold}fn${C.reset} - Define a custom command/script`)
        writeln('')
        writeln(`${C.cyan}Usage:${C.reset}`)
        writeln(`  ${C.green}fn <name> <command>${C.reset}       Single-line function`)
        writeln(`  ${C.green}fn <name> { ... }${C.reset}        Multi-line function`)
        writeln('')
        writeln(`${C.cyan}Examples:${C.reset}`)
        writeln(`  ${C.dim}fn greet echo "Hello, $1!"${C.reset}`)
        writeln(`  ${C.dim}fn build-run compile && run${C.reset}`)
        writeln(`  ${C.dim}fn status { seq status; echo "---"; ls }${C.reset}`)
        writeln('')
        writeln(`${C.cyan}Arguments:${C.reset}`)
        writeln(`  ${C.dim}$1, $2, ...${C.reset}  Positional arguments`)
        writeln(`  ${C.dim}$@${C.reset}          All arguments`)
        writeln(`  ${C.dim}$#${C.reset}          Number of arguments`)
        writeln('')
        writeln(`Use ${C.green}script list${C.reset} to see defined functions`)
        return
      }

      const name = ctx.args[0]
      if (commands[name]) {
        writeError(`fn: cannot override built-in command '${name}'`)
        return
      }

      // Check for multi-line { ... } syntax
      const rest = ctx.rawArgs.slice(name.length).trim()
      let body: string[]

      if (rest.startsWith('{')) {
        // Multi-line: extract commands between { }
        const match = rest.match(/^\{([^}]*)\}$/)
        if (!match) {
          writeError('fn: unclosed brace, use { commands; ... }')
          return
        }
        // Split by ; for multiple commands
        body = match[1].split(';').map(s => s.trim()).filter(Boolean)
      } else {
        // Single-line command
        body = [rest]
      }

      if (body.length === 0 || (body.length === 1 && !body[0])) {
        writeError('fn: missing command body')
        return
      }

      userScripts.value[name] = {
        name,
        body,
        description: '',
        args: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      saveUserScripts()
      writeln(`Defined function: ${C.green}${name}${C.reset}`)
    },

    // ──────────────────────────────────────────────── script (manage scripts)
    script(ctx) {
      const sub = ctx.args[0]
      const scriptName = ctx.args[1]

      if (!sub) {
        writeln(`${C.bold}script${C.reset} - Manage custom scripts`)
        writeln('')
        writeln(`${C.cyan}Commands:${C.reset}`)
        writeln(`  ${C.green}script list${C.reset}              List all scripts`)
        writeln(`  ${C.green}script show <name>${C.reset}       Show script source`)
        writeln(`  ${C.green}script edit <name>${C.reset}       Edit script (opens editor)`)
        writeln(`  ${C.green}script del <name>${C.reset}        Delete a script`)
        writeln(`  ${C.green}script export <name>${C.reset}     Export to .sh file`)
        writeln(`  ${C.green}script import <file>${C.reset}     Import from .sh file`)
        writeln(`  ${C.green}script doc <name> <text>${C.reset} Set script description`)
        writeln('')
        writeln(`${C.dim}Use 'fn <name> <cmd>' to create simple functions${C.reset}`)
        return
      }

      switch (sub) {
        case 'list':
        case 'ls': {
          const scripts = Object.values(userScripts.value)
          if (scripts.length === 0) {
            writeln(`${C.dim}No custom scripts defined${C.reset}`)
            writeln(`Use ${C.green}fn <name> <command>${C.reset} to create one`)
            return
          }
          writeln(`${C.bold}Custom Scripts${C.reset} (${scripts.length})`)
          writeln('')
          for (const s of scripts) {
            const desc = s.description ? ` ${C.dim}- ${s.description}${C.reset}` : ''
            const lineCount = s.body.length
            writeln(`  ${C.green}${s.name}${C.reset}${desc} ${C.dim}(${lineCount} line${lineCount !== 1 ? 's' : ''})${C.reset}`)
          }
          break
        }

        case 'show':
        case 'cat': {
          if (!scriptName) {
            writeError('script show: missing script name')
            return
          }
          const s = userScripts.value[scriptName]
          if (!s) {
            writeError(`script show: '${scriptName}' not found`)
            return
          }
          writeln(`${C.bold}${s.name}${C.reset}${s.description ? ` - ${s.description}` : ''}`)
          writeln(`${C.dim}─────────────────────────────${C.reset}`)
          for (let i = 0; i < s.body.length; i++) {
            writeln(`${C.dim}${String(i + 1).padStart(3)}│${C.reset} ${s.body[i]}`)
          }
          break
        }

        case 'edit': {
          if (!scriptName) {
            writeError('script edit: missing script name')
            return
          }
          const s = userScripts.value[scriptName]
          if (!s) {
            // Create new script
            userScripts.value[scriptName] = {
              name: scriptName,
              body: ['# Your script here', 'echo "Hello from ' + scriptName + '"'],
              description: '',
              args: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
            saveUserScripts()
          }
          // Create a virtual .sh file in the project for editing
          const content = `#!/bin/alloterm
# Script: ${scriptName}
# ${userScripts.value[scriptName].description || 'Add description with: script doc ' + scriptName + ' "description"'}
#
# Arguments: $1, $2, ... (positional), $@ (all), $# (count)
# Run with: ${scriptName} [args...]

${userScripts.value[scriptName].body.join('\n')}
`
          const ps = getProjectStore()
          const filePath = `/scripts/${scriptName}.sh`
          const existing = ps.project.files.find(f => f.path === filePath)
          if (existing) {
            existing.content = content
            existing.updatedAt = Date.now()
          } else {
            ps.project.files.push({
              name: `${scriptName}.sh`,
              path: filePath,
              content,
              isMain: false,
              isDirty: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            })
          }
          // Open in editor
          const app = useAppStore()
          app.openFile(filePath)
          writeln(`Opening ${C.cyan}${filePath}${C.reset} in editor`)
          writeln(`${C.dim}Save and run 'script import ${filePath}' to update${C.reset}`)
          break
        }

        case 'del':
        case 'rm':
        case 'delete': {
          if (!scriptName) {
            writeError('script del: missing script name')
            return
          }
          if (!userScripts.value[scriptName]) {
            writeError(`script del: '${scriptName}' not found`)
            return
          }
          delete userScripts.value[scriptName]
          saveUserScripts()
          writeln(`Deleted script: ${scriptName}`)
          break
        }

        case 'export': {
          if (!scriptName) {
            writeError('script export: missing script name')
            return
          }
          const s = userScripts.value[scriptName]
          if (!s) {
            writeError(`script export: '${scriptName}' not found`)
            return
          }
          const content = `#!/bin/alloterm
# Script: ${s.name}
# ${s.description || ''}
# Created: ${new Date(s.createdAt).toISOString()}

${s.body.join('\n')}
`
          const filePath = `/scripts/${scriptName}.sh`
          const ps = getProjectStore()
          const existing = ps.project.files.find(f => f.path === filePath)
          if (existing) {
            existing.content = content
            existing.updatedAt = Date.now()
            existing.isDirty = true
          } else {
            ps.project.files.push({
              name: `${scriptName}.sh`,
              path: filePath,
              content,
              isMain: false,
              isDirty: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            })
          }
          writeln(`Exported to ${C.green}${filePath}${C.reset}`)
          break
        }

        case 'import': {
          const filePath = scriptName  // Actually the file path
          if (!filePath) {
            writeError('script import: missing file path')
            return
          }
          const absPath = resolvePath(filePath)
          const projPath = toProjectPath(absPath)
          const ps = getProjectStore()
          const file = ps.project.files.find(f => f.path === projPath || f.path === filePath)
          if (!file) {
            writeError(`script import: file not found '${filePath}'`)
            return
          }
          // Parse the script file
          const lines = file.content.split('\n')
          const body: string[] = []
          let name = file.name.replace(/\.sh$/, '')
          let description = ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith('#!/')) continue  // Skip shebang
            if (trimmed.startsWith('# Script:')) {
              name = trimmed.slice(9).trim()
              continue
            }
            if (trimmed.startsWith('#') && !description && trimmed.length > 2) {
              description = trimmed.slice(1).trim()
              continue
            }
            if (trimmed && !trimmed.startsWith('#')) {
              body.push(trimmed)
            }
          }

          if (body.length === 0) {
            writeError('script import: no commands found in file')
            return
          }

          userScripts.value[name] = {
            name,
            body,
            description,
            args: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          saveUserScripts()
          writeln(`Imported script: ${C.green}${name}${C.reset} (${body.length} lines)`)
          break
        }

        case 'doc': {
          if (!scriptName) {
            writeError('script doc: missing script name')
            return
          }
          const s = userScripts.value[scriptName]
          if (!s) {
            writeError(`script doc: '${scriptName}' not found`)
            return
          }
          const desc = ctx.args.slice(2).join(' ')
          if (!desc) {
            writeln(`${C.bold}${s.name}${C.reset}: ${s.description || C.dim + '(no description)' + C.reset}`)
            return
          }
          s.description = desc
          s.updatedAt = Date.now()
          saveUserScripts()
          writeln(`Updated description for ${C.green}${scriptName}${C.reset}`)
          break
        }

        default:
          writeError(`script: unknown command '${sub}'`)
      }
    },

    // ──────────────────────────────────────────────── source (run script file)
    source(ctx) {
      const filePath = ctx.args[0]
      if (!filePath) {
        writeln(`${C.bold}source${C.reset} <file> - Execute commands from a file`)
        writeln('')
        writeln(`Also available as: ${C.green}.${C.reset} <file>`)
        writeln('')
        writeln(`${C.cyan}Example:${C.reset}`)
        writeln(`  ${C.dim}source /scripts/setup.sh${C.reset}`)
        writeln(`  ${C.dim}. mycommands.sh${C.reset}`)
        return
      }

      const absPath = resolvePath(filePath)
      const projPath = toProjectPath(absPath)
      const ps = getProjectStore()
      const file = ps.project.files.find(f => f.path === projPath || f.path === filePath)

      if (!file) {
        writeError(`source: file not found '${filePath}'`)
        return
      }

      const lines = file.content.split('\n')
      const args = ctx.args.slice(1)  // Pass remaining args to sourced script

      // Save script args context
      const prevArgs = scriptArgs
      scriptArgs = args

      try {
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const expanded = expandScriptArgs(trimmed, args)
          executeScriptLine(expanded)
        }
      } finally {
        scriptArgs = prevArgs
      }
    },

    // ──────────────────────────────────────────────── . (alias for source)
    '.'(ctx) {
      commands.source(ctx)
    },

    // ──────────────────────────────────────────────── version
    version(ctx) {
      writeln(`${C.cyan}AlloLib Studio Online${C.reset} v${VERSION}`)
      writeln(`${C.dim}Terminal: alloterm v${VERSION}${C.reset}`)
      writeln(`${C.dim}Shell: /bin/alloterm${C.reset}`)
      ctx.stdout = `v${VERSION}\n`
    },

    // ──────────────────────────────────────────────── seq (sequencer)
    seq(ctx) {
      const sequencer = useSequencerStore()
      const sub = ctx.args[0]
      const subArgs = ctx.args.slice(1)

      // Helper to format time as MM:SS.mmm or beats
      const formatTime = (sec: number): string => {
        const mins = Math.floor(sec / 60)
        const secs = sec % 60
        return `${mins}:${secs.toFixed(3).padStart(6, '0')}`
      }

      const formatBeats = (sec: number): string => {
        const beats = (sec / 60) * sequencer.bpm
        return `${beats.toFixed(2)} beats`
      }

      if (!sub) {
        // Show usage
        writeln(`${C.bold}seq${C.reset} - Sequencer control`)
        writeln('')
        writeln(`${C.cyan}Transport:${C.reset}`)
        writeln(`  ${C.green}seq play${C.reset}              Start playback`)
        writeln(`  ${C.green}seq stop${C.reset}              Stop and reset to start`)
        writeln(`  ${C.green}seq pause${C.reset}             Pause playback`)
        writeln(`  ${C.green}seq seek <time>${C.reset}       Seek to time (seconds or beats)`)
        writeln('')
        writeln(`${C.cyan}Settings:${C.reset}`)
        writeln(`  ${C.green}seq bpm [value]${C.reset}       Get/set tempo (BPM)`)
        writeln(`  ${C.green}seq loop [on|off]${C.reset}     Toggle or set loop mode`)
        writeln(`  ${C.green}seq loop-range <s> <e>${C.reset} Set loop start/end (seconds)`)
        writeln(`  ${C.green}seq snap [mode]${C.reset}       Get/set snap (none|beat|bar|1/4|1/8|1/16)`)
        writeln('')
        writeln(`${C.cyan}Tracks:${C.reset}`)
        writeln(`  ${C.green}seq tracks${C.reset}            List arrangement tracks`)
        writeln(`  ${C.green}seq track add <synth>${C.reset} Add track for synth`)
        writeln(`  ${C.green}seq track del <n>${C.reset}     Delete track by index`)
        writeln(`  ${C.green}seq track mute <n>${C.reset}    Toggle track mute`)
        writeln(`  ${C.green}seq track solo <n>${C.reset}    Toggle track solo`)
        writeln('')
        writeln(`${C.cyan}Clips:${C.reset}`)
        writeln(`  ${C.green}seq clips${C.reset}             List all clips`)
        writeln(`  ${C.green}seq clip new <name>${C.reset}   Create new clip`)
        writeln(`  ${C.green}seq clip sel <id>${C.reset}     Select clip by ID`)
        writeln(`  ${C.green}seq clip del <id>${C.reset}     Delete clip by ID`)
        writeln(`  ${C.green}seq clip info${C.reset}         Show active clip details`)
        writeln('')
        writeln(`${C.cyan}Notes:${C.reset}`)
        writeln(`  ${C.green}seq notes${C.reset}             List notes in active clip`)
        writeln(`  ${C.green}seq note add <f> <a> <d>${C.reset} Add note (freq, amp, dur)`)
        writeln(`  ${C.green}seq note del <id>${C.reset}     Delete note by ID`)
        writeln('')
        writeln(`${C.cyan}Files:${C.reset}`)
        writeln(`  ${C.green}seq save [path]${C.reset}       Save clip to .synthSequence`)
        writeln(`  ${C.green}seq load <path>${C.reset}       Load .synthSequence file`)
        writeln('')
        writeln(`${C.cyan}Info:${C.reset}`)
        writeln(`  ${C.green}seq status${C.reset}            Show sequencer status`)
        writeln(`  ${C.green}seq synths${C.reset}            List detected synths`)
        return
      }

      switch (sub) {
        // ── Transport ────────────────────────────────
        case 'play':
          sequencer.play()
          writeln(`${C.green}▶${C.reset} Playing`)
          break

        case 'stop':
          sequencer.stop()
          writeln(`${C.yellow}■${C.reset} Stopped`)
          break

        case 'pause':
          sequencer.pause()
          writeln(`${C.yellow}❚❚${C.reset} Paused at ${formatTime(sequencer.playheadPosition)}`)
          break

        case 'seek': {
          if (!subArgs[0]) {
            writeError('seq seek: missing time argument')
            return
          }
          let time = 0
          const arg = subArgs[0].toLowerCase()
          if (arg.endsWith('b') || arg.endsWith('beat') || arg.endsWith('beats')) {
            // Parse as beats
            const beats = parseFloat(arg)
            time = (beats / sequencer.bpm) * 60
          } else {
            time = parseFloat(arg)
          }
          if (isNaN(time) || time < 0) {
            writeError(`seq seek: invalid time '${subArgs[0]}'`)
            return
          }
          sequencer.setPosition(time)
          writeln(`Seeked to ${formatTime(time)} (${formatBeats(time)})`)
          break
        }

        // ── Settings ─────────────────────────────────
        case 'bpm': {
          if (!subArgs[0]) {
            writeln(`BPM: ${C.cyan}${sequencer.bpm}${C.reset}`)
            writeln(`Beat duration: ${C.dim}${(60 / sequencer.bpm).toFixed(3)}s${C.reset}`)
          } else {
            const newBpm = parseFloat(subArgs[0])
            if (isNaN(newBpm) || newBpm <= 0 || newBpm > 999) {
              writeError(`seq bpm: invalid BPM '${subArgs[0]}' (1-999)`)
              return
            }
            sequencer.bpm = newBpm
            writeln(`BPM set to ${C.cyan}${newBpm}${C.reset}`)
          }
          break
        }

        case 'loop': {
          if (!subArgs[0]) {
            sequencer.toggleLoop()
            writeln(`Loop: ${sequencer.loopEnabled ? `${C.green}ON${C.reset}` : `${C.dim}OFF${C.reset}`}`)
          } else if (subArgs[0] === 'on') {
            sequencer.loopEnabled = true
            writeln(`Loop: ${C.green}ON${C.reset}`)
          } else if (subArgs[0] === 'off') {
            sequencer.loopEnabled = false
            writeln(`Loop: ${C.dim}OFF${C.reset}`)
          } else {
            writeError(`seq loop: expected 'on' or 'off'`)
          }
          if (sequencer.loopEnabled) {
            writeln(`  Range: ${formatTime(sequencer.loopStart)} - ${formatTime(sequencer.loopEnd)}`)
          }
          break
        }

        case 'loop-range': {
          if (subArgs.length < 2) {
            writeln(`Loop range: ${formatTime(sequencer.loopStart)} - ${formatTime(sequencer.loopEnd)}`)
            return
          }
          const start = parseFloat(subArgs[0])
          const end = parseFloat(subArgs[1])
          if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
            writeError('seq loop-range: invalid range (end must be > start)')
            return
          }
          sequencer.loopStart = start
          sequencer.loopEnd = end
          writeln(`Loop range: ${formatTime(start)} - ${formatTime(end)}`)
          break
        }

        case 'snap': {
          const modes = ['none', 'beat', 'bar', '1/4', '1/8', '1/16']
          if (!subArgs[0]) {
            writeln(`Snap mode: ${C.cyan}${sequencer.snapMode}${C.reset}`)
            writeln(`Available: ${C.dim}${modes.join(', ')}${C.reset}`)
          } else {
            const mode = subArgs[0]
            if (!modes.includes(mode)) {
              writeError(`seq snap: unknown mode '${mode}'`)
              writeln(`Available: ${modes.join(', ')}`)
              return
            }
            sequencer.snapMode = mode as typeof sequencer.snapMode
            writeln(`Snap mode: ${C.cyan}${mode}${C.reset}`)
          }
          break
        }

        // ── Tracks ───────────────────────────────────
        case 'tracks': {
          const tracks = sequencer.arrangementTracks
          if (tracks.length === 0) {
            writeln(`${C.dim}No arrangement tracks${C.reset}`)
            writeln(`Use ${C.green}seq track add <synth>${C.reset} to create one`)
            return
          }
          writeln(`${C.bold}Arrangement Tracks${C.reset} (${tracks.length})`)
          writeln('')
          for (let i = 0; i < tracks.length; i++) {
            const t = tracks[i]
            const flags = []
            if (t.muted) flags.push(`${C.yellow}M${C.reset}`)
            if (t.solo) flags.push(`${C.green}S${C.reset}`)
            const flagStr = flags.length ? ` [${flags.join('')}]` : ''
            writeln(`  ${C.dim}${i}:${C.reset} ${t.name} ${C.dim}(${t.synthName})${C.reset}${flagStr}`)
          }
          break
        }

        case 'track': {
          const action = subArgs[0]
          if (!action) {
            writeError('seq track: missing action (add|del|mute|solo)')
            return
          }

          switch (action) {
            case 'add': {
              const synthName = subArgs[1]
              if (!synthName) {
                writeError('seq track add: missing synth name')
                const synths = sequencer.detectedSynthClasses
                if (synths.length > 0) {
                  writeln(`Available synths: ${synths.map(s => s.name).join(', ')}`)
                }
                return
              }
              sequencer.ensureSynthTrack(synthName)
              writeln(`Added track for ${C.cyan}${synthName}${C.reset}`)
              break
            }

            case 'del':
            case 'delete':
            case 'rm': {
              const idx = parseInt(subArgs[1])
              if (isNaN(idx)) {
                writeError('seq track del: missing track index')
                return
              }
              if (idx < 0 || idx >= sequencer.arrangementTracks.length) {
                writeError(`seq track del: invalid track index ${idx}`)
                return
              }
              const name = sequencer.arrangementTracks[idx].name
              sequencer.deleteTrack(idx)
              writeln(`Deleted track ${idx}: ${name}`)
              break
            }

            case 'mute': {
              const idx = parseInt(subArgs[1])
              if (isNaN(idx) || idx < 0 || idx >= sequencer.arrangementTracks.length) {
                writeError('seq track mute: invalid track index')
                return
              }
              const track = sequencer.arrangementTracks[idx]
              track.muted = !track.muted
              writeln(`Track ${idx}: ${track.muted ? `${C.yellow}MUTED${C.reset}` : 'unmuted'}`)
              break
            }

            case 'solo': {
              const idx = parseInt(subArgs[1])
              if (isNaN(idx) || idx < 0 || idx >= sequencer.arrangementTracks.length) {
                writeError('seq track solo: invalid track index')
                return
              }
              const track = sequencer.arrangementTracks[idx]
              track.solo = !track.solo
              writeln(`Track ${idx}: ${track.solo ? `${C.green}SOLO${C.reset}` : 'unsolo'}`)
              break
            }

            default:
              writeError(`seq track: unknown action '${action}'`)
          }
          break
        }

        // ── Clips ────────────────────────────────────
        case 'clips': {
          const clips = sequencer.clips
          if (clips.length === 0) {
            writeln(`${C.dim}No clips${C.reset}`)
            writeln(`Use ${C.green}seq clip new <name>${C.reset} to create one`)
            return
          }
          writeln(`${C.bold}Clips${C.reset} (${clips.length})`)
          writeln('')
          for (const clip of clips) {
            const active = clip.id === sequencer.activeClipId ? `${C.green}*${C.reset}` : ' '
            const dirty = clip.isDirty ? `${C.yellow}*${C.reset}` : ''
            writeln(`${active} ${C.dim}${clip.id.slice(0, 8)}${C.reset} ${clip.name}${dirty} ${C.dim}(${clip.notes.length} notes, ${clip.duration.toFixed(2)}s)${C.reset}`)
          }
          break
        }

        case 'clip': {
          const action = subArgs[0]
          if (!action) {
            writeError('seq clip: missing action (new|sel|del|info)')
            return
          }

          switch (action) {
            case 'new':
            case 'create': {
              const name = subArgs.slice(1).join(' ') || 'New Clip'
              const clip = sequencer.createClip(name)
              sequencer.setActiveClip(clip.id)
              writeln(`Created clip: ${C.cyan}${clip.name}${C.reset}`)
              writeln(`ID: ${C.dim}${clip.id}${C.reset}`)
              break
            }

            case 'sel':
            case 'select': {
              const id = subArgs[1]
              if (!id) {
                writeError('seq clip sel: missing clip ID')
                return
              }
              // Find clip by ID prefix
              const clip = sequencer.clips.find(c => c.id.startsWith(id))
              if (!clip) {
                writeError(`seq clip sel: no clip matching '${id}'`)
                return
              }
              sequencer.setActiveClip(clip.id)
              writeln(`Selected: ${C.cyan}${clip.name}${C.reset}`)
              break
            }

            case 'del':
            case 'delete':
            case 'rm': {
              const id = subArgs[1]
              if (!id) {
                writeError('seq clip del: missing clip ID')
                return
              }
              const clip = sequencer.clips.find(c => c.id.startsWith(id))
              if (!clip) {
                writeError(`seq clip del: no clip matching '${id}'`)
                return
              }
              sequencer.deleteClip(clip.id)
              writeln(`Deleted clip: ${clip.name}`)
              break
            }

            case 'info': {
              const clip = sequencer.activeClip
              if (!clip) {
                writeln(`${C.dim}No active clip${C.reset}`)
                return
              }
              writeln(`${C.bold}${clip.name}${C.reset}${clip.isDirty ? ` ${C.yellow}(unsaved)${C.reset}` : ''}`)
              writeln(`  ID: ${C.dim}${clip.id}${C.reset}`)
              writeln(`  Synth: ${C.cyan}${clip.synthName}${C.reset}`)
              writeln(`  Duration: ${formatTime(clip.duration)} (${formatBeats(clip.duration)})`)
              writeln(`  Notes: ${clip.notes.length}`)
              if (clip.filePath) {
                writeln(`  File: ${C.dim}${clip.filePath}${C.reset}`)
              }
              if (clip.paramNames.length > 0) {
                writeln(`  Params: ${C.dim}${clip.paramNames.join(', ')}${C.reset}`)
              }
              break
            }

            default:
              writeError(`seq clip: unknown action '${action}'`)
          }
          break
        }

        // ── Notes ────────────────────────────────────
        case 'notes': {
          const clip = sequencer.activeClip
          if (!clip) {
            writeln(`${C.dim}No active clip${C.reset}`)
            return
          }
          const notes = clip.notes
          if (notes.length === 0) {
            writeln(`${C.dim}No notes in clip${C.reset}`)
            return
          }
          writeln(`${C.bold}Notes in ${clip.name}${C.reset} (${notes.length})`)
          writeln('')
          // Show first 20 notes
          const shown = notes.slice(0, 20)
          for (const note of shown) {
            const sel = note.selected ? `${C.green}*${C.reset}` : ' '
            const muted = note.muted ? `${C.dim}M${C.reset}` : ''
            writeln(`${sel}${muted} ${C.dim}${note.id.slice(0, 6)}${C.reset} t=${note.startTime.toFixed(3)} f=${note.frequency.toFixed(1)}Hz a=${note.amplitude.toFixed(2)} d=${note.duration.toFixed(3)}`)
          }
          if (notes.length > 20) {
            writeln(`${C.dim}... and ${notes.length - 20} more${C.reset}`)
          }
          break
        }

        case 'note': {
          const action = subArgs[0]
          if (!action) {
            writeError('seq note: missing action (add|del)')
            return
          }

          const clip = sequencer.activeClip
          if (!clip) {
            writeError('seq note: no active clip')
            return
          }

          switch (action) {
            case 'add': {
              const freq = parseFloat(subArgs[1])
              const amp = parseFloat(subArgs[2]) ?? 0.5
              const dur = parseFloat(subArgs[3]) ?? 0.5
              if (isNaN(freq)) {
                writeError('seq note add: missing frequency')
                return
              }
              const note = sequencer.addNote(freq, isNaN(amp) ? 0.5 : amp, isNaN(dur) ? 0.5 : dur)
              if (note) {
                writeln(`Added note: ${C.cyan}${note.frequency.toFixed(1)}Hz${C.reset} at t=${note.startTime.toFixed(3)}`)
              }
              break
            }

            case 'del':
            case 'delete':
            case 'rm': {
              const id = subArgs[1]
              if (!id) {
                writeError('seq note del: missing note ID')
                return
              }
              const note = clip.notes.find(n => n.id.startsWith(id))
              if (!note) {
                writeError(`seq note del: no note matching '${id}'`)
                return
              }
              sequencer.removeNote(note.id)
              writeln(`Deleted note ${note.id.slice(0, 6)}`)
              break
            }

            default:
              writeError(`seq note: unknown action '${action}'`)
          }
          break
        }

        // ── Files ────────────────────────────────────
        case 'save': {
          const clip = sequencer.activeClip
          if (!clip) {
            writeError('seq save: no active clip')
            return
          }
          const path = subArgs[0] || clip.filePath
          if (!path) {
            writeError('seq save: no file path (use seq save <path>)')
            return
          }
          try {
            sequencer.saveClipToFile(clip.id, path)
            writeln(`Saved ${C.green}${path}${C.reset}`)
          } catch (e) {
            writeError(`seq save: ${e}`)
          }
          break
        }

        case 'load': {
          const path = subArgs[0]
          if (!path) {
            writeError('seq load: missing file path')
            return
          }
          // Resolve path
          const absPath = path.startsWith('/') ? path : (cwd.value === '/' ? '/' + path : cwd.value + '/' + path)
          const project = useProjectStore()
          const file = project.files.find(f => f.path === absPath || f.path === path)
          if (!file) {
            writeError(`seq load: file not found '${path}'`)
            return
          }
          try {
            const clip = sequencer.loadClipFromFile(file.path, file.content)
            if (clip) {
              sequencer.setActiveClip(clip.id)
              writeln(`Loaded ${C.green}${clip.name}${C.reset} (${clip.notes.length} notes)`)
            }
          } catch (e) {
            writeError(`seq load: ${e}`)
          }
          break
        }

        // ── Info ─────────────────────────────────────
        case 'status': {
          const transportIcon = sequencer.transport === 'playing'
            ? `${C.green}▶${C.reset}`
            : sequencer.transport === 'paused'
              ? `${C.yellow}❚❚${C.reset}`
              : `${C.dim}■${C.reset}`

          writeln(`${C.bold}Sequencer Status${C.reset}`)
          writeln('')
          writeln(`  Transport: ${transportIcon} ${sequencer.transport}`)
          writeln(`  Position: ${formatTime(sequencer.playheadPosition)} (${formatBeats(sequencer.playheadPosition)})`)
          writeln(`  BPM: ${C.cyan}${sequencer.bpm}${C.reset}`)
          writeln(`  Loop: ${sequencer.loopEnabled ? `${C.green}ON${C.reset} (${formatTime(sequencer.loopStart)}-${formatTime(sequencer.loopEnd)})` : `${C.dim}OFF${C.reset}`}`)
          writeln(`  Snap: ${sequencer.snapMode}`)
          writeln(`  View: ${sequencer.viewMode}`)
          writeln(`  Edit: ${sequencer.editMode}`)
          writeln('')
          writeln(`  Tracks: ${sequencer.arrangementTracks.length}`)
          writeln(`  Clips: ${sequencer.clips.length}`)
          writeln(`  Active clip: ${sequencer.activeClip ? sequencer.activeClip.name : `${C.dim}none${C.reset}`}`)
          break
        }

        case 'synths': {
          const synths = sequencer.detectedSynthClasses
          if (synths.length === 0) {
            writeln(`${C.dim}No synths detected${C.reset}`)
            writeln(`Compile a project with SynthGUIManager to detect synths`)
            return
          }
          writeln(`${C.bold}Detected Synths${C.reset} (${synths.length})`)
          writeln('')
          for (const synth of synths) {
            writeln(`  ${C.cyan}${synth.name}${C.reset}`)
            if (synth.params.length > 0) {
              const paramStr = synth.params.map(p => p.name).join(', ')
              writeln(`    ${C.dim}Params: ${paramStr}${C.reset}`)
            }
          }
          break
        }

        default:
          writeError(`seq: unknown subcommand '${sub}'`)
          writeln(`Run ${C.green}seq${C.reset} for usage`)
      }
    },
  }

  // ── Detailed help for individual commands ───────────────────────────────
  const commandHelp: Record<string, string> = {
    ls: `${C.bold}ls${C.reset} [-l] [-a] [path]
  List directory contents.
  ${C.dim}-l${C.reset}  Long format (size, date)
  ${C.dim}-a${C.reset}  Show hidden entries (. and ..)`,
    cd: `${C.bold}cd${C.reset} [path]
  Change working directory.
  ${C.dim}cd${C.reset}       Go to root (/)
  ${C.dim}cd ..${C.reset}    Go up one level
  ${C.dim}cd ~${C.reset}     Go to home (/)`,
    cat: `${C.bold}cat${C.reset} [-n] <file> ...
  Display file contents.
  ${C.dim}-n${C.reset}  Show line numbers`,
    grep: `${C.bold}grep${C.reset} [-i] [-n] [-l] [-v] <pattern> [files...]
  Search for pattern in files.
  ${C.dim}-i${C.reset}  Case insensitive
  ${C.dim}-n${C.reset}  Show line numbers
  ${C.dim}-l${C.reset}  Only show filenames
  ${C.dim}-v${C.reset}  Invert match`,
    find: `${C.bold}find${C.reset} [path] [-name <pattern>]
  Find files matching a glob pattern.
  ${C.dim}*${C.reset}  Matches anything
  ${C.dim}?${C.reset}  Matches one character`,
    rm: `${C.bold}rm${C.reset} [-r] [-f] <file|dir> ...
  Remove files or directories.
  ${C.dim}-r${C.reset}  Recursive (for directories)
  ${C.dim}-f${C.reset}  Force (no error if missing)`,
    mkdir: `${C.bold}mkdir${C.reset} [-p] <dir> ...
  Create directories.
  ${C.dim}-p${C.reset}  Create parent directories as needed`,
    head: `${C.bold}head${C.reset} [-n N] <file>
  Show the first N lines of a file (default 10).`,
    tail: `${C.bold}tail${C.reset} [-n N] <file>
  Show the last N lines of a file (default 10).`,
    wc: `${C.bold}wc${C.reset} <file> ...
  Print line, word, and byte counts.`,
    echo: `${C.bold}echo${C.reset} <text>
  Print text. Supports $VARIABLE expansion.
  Redirect with > or >> to write to files.`,
    alias: `${C.bold}alias${C.reset} [name=command]
  Show or set command aliases.
  ${C.dim}alias${C.reset}           Show all
  ${C.dim}alias ll='ls -l'${C.reset} Set alias`,
    history: `${C.bold}history${C.reset} [-c] [N]
  Show command history.
  ${C.dim}-c${C.reset}  Clear history
  ${C.dim}N${C.reset}   Show last N entries`,
    seq: `${C.bold}seq${C.reset} <subcommand> [args]
  Control the sequencer. Run ${C.dim}seq${C.reset} for full usage.

  ${C.cyan}Transport:${C.reset}
    ${C.dim}play, stop, pause${C.reset}  Control playback
    ${C.dim}seek <time>${C.reset}        Jump to position

  ${C.cyan}Settings:${C.reset}
    ${C.dim}bpm [val]${C.reset}          Get/set tempo
    ${C.dim}loop [on|off]${C.reset}      Toggle loop
    ${C.dim}snap [mode]${C.reset}        Set snap grid

  ${C.cyan}Tracks:${C.reset}
    ${C.dim}tracks${C.reset}             List all tracks
    ${C.dim}track add|del|mute|solo${C.reset}

  ${C.cyan}Clips:${C.reset}
    ${C.dim}clips${C.reset}              List all clips
    ${C.dim}clip new|sel|del|info${C.reset}

  ${C.cyan}Info:${C.reset}
    ${C.dim}status${C.reset}             Show sequencer state
    ${C.dim}synths${C.reset}             List detected synths`,
    fn: `${C.bold}fn${C.reset} <name> <command>
  Define a custom function/script.

  ${C.cyan}Single-line:${C.reset}
    ${C.dim}fn greet echo "Hello, $1!"${C.reset}
    ${C.dim}fn rebuild compile && run${C.reset}

  ${C.cyan}Multi-line:${C.reset}
    ${C.dim}fn setup { mkdir src; touch src/main.cpp }${C.reset}

  ${C.cyan}Arguments:${C.reset}
    ${C.dim}$1, $2, ...${C.reset}  Positional arguments
    ${C.dim}$@${C.reset}          All arguments
    ${C.dim}$#${C.reset}          Number of arguments

  ${C.cyan}Example:${C.reset}
    ${C.dim}fn greet echo "Hello, $1!"${C.reset}
    ${C.dim}greet World${C.reset}  → Hello, World!`,
    script: `${C.bold}script${C.reset} <cmd> [args]
  Manage custom scripts.

  ${C.cyan}Commands:${C.reset}
    ${C.dim}list${C.reset}              List all scripts
    ${C.dim}show <name>${C.reset}       Show script source
    ${C.dim}edit <name>${C.reset}       Edit in Monaco editor
    ${C.dim}del <name>${C.reset}        Delete a script
    ${C.dim}export <name>${C.reset}     Save to .sh file
    ${C.dim}import <file>${C.reset}     Load from .sh file
    ${C.dim}doc <name> <text>${C.reset} Set description

  Scripts are saved to localStorage and persist
  across sessions.`,
    source: `${C.bold}source${C.reset} <file> [args]
  Execute commands from a script file.

  Also available as: ${C.green}.${C.reset} <file>

  ${C.cyan}Example:${C.reset}
    ${C.dim}source /scripts/setup.sh${C.reset}
    ${C.dim}. mycommands.sh arg1 arg2${C.reset}

  Lines starting with # are treated as comments.
  Arguments are passed as $1, $2, etc.`,
    scripting: `${C.bold}Scripting Guide${C.reset}

  ${C.cyan}Creating Functions:${C.reset}
    ${C.dim}fn <name> <command>${C.reset}        Single-line
    ${C.dim}fn <name> { cmd1; cmd2 }${C.reset}  Multi-line

  ${C.cyan}Managing Scripts:${C.reset}
    ${C.dim}script list${C.reset}               Show all scripts
    ${C.dim}script edit <name>${C.reset}        Edit in editor
    ${C.dim}script export <name>${C.reset}      Save to file

  ${C.cyan}Running Scripts:${C.reset}
    ${C.dim}<name> [args]${C.reset}             Run user function
    ${C.dim}source <file>${C.reset}             Run script file
    ${C.dim}. <file>${C.reset}                  Alias for source

  ${C.cyan}Arguments:${C.reset}
    ${C.dim}$1, $2, ... $9${C.reset}            Positional args
    ${C.dim}\${10}, \${11}...${C.reset}           Args 10+
    ${C.dim}$@${C.reset}                        All arguments
    ${C.dim}$#${C.reset}                        Argument count

  ${C.cyan}Script File Format:${C.reset}
    ${C.dim}#!/bin/alloterm${C.reset}
    ${C.dim}# Comment${C.reset}
    ${C.dim}echo "Hello $1"${C.reset}
    ${C.dim}compile && run${C.reset}`,
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function formatLsEntry(name: string, isDir: boolean, _flags: Record<string, string | boolean>, _file?: { content: string; updatedAt: number }): string {
    if (isDir) return `${C.blue}${name}/${C.reset}`
    if (name.endsWith('.cpp') || name.endsWith('.c')) return `${C.green}${name}${C.reset}`
    if (name.endsWith('.hpp') || name.endsWith('.h')) return `${C.cyan}${name}${C.reset}`
    return name
  }

  function formatLsLong(name: string, isDir: boolean, file?: { content: string; updatedAt: number; isMain: boolean }): string {
    const type = isDir ? `${C.blue}d${C.reset}` : '-'
    const perms = isDir ? 'rwxr-xr-x' : (file?.isMain ? 'rw-r--r--' : 'rw-rw-r--')
    const size = file ? String(new Blob([file.content]).size).padStart(8) : '       0'
    const date = file ? formatDate(file.updatedAt) : formatDate(Date.now())
    const display = isDir
      ? `${C.blue}${name}${C.reset}`
      : name.endsWith('.cpp') || name.endsWith('.c')
        ? `${C.green}${name}${C.reset}`
        : name.endsWith('.hpp') || name.endsWith('.h')
          ? `${C.cyan}${name}${C.reset}`
          : name
    return `${type}${perms}  ${size} ${C.dim}${date}${C.reset} ${display}`
  }

  function formatDate(timestamp: number): string {
    const d = new Date(timestamp)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  function drawTree(absDir: string, prefix: string, isLast: boolean): { text: string; files: number; dirs: number } {
    const { files, dirs } = listDir(absDir)
    let text = ''
    let fileCount = files.length
    let dirCount = dirs.length
    const entries = [...dirs.map(d => ({ name: d, isDir: true })), ...files.map(f => ({ name: f, isDir: false }))]

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const last = i === entries.length - 1
      const connector = last ? '└── ' : '├── '
      const childPrefix = prefix + (last ? '    ' : '│   ')

      if (entry.isDir) {
        const line = `${prefix}${connector}${C.blue}${entry.name}/${C.reset}`
        writeln(line)
        text += entry.name + '/\n'
        const childPath = absDir === '/' ? '/' + entry.name : absDir + '/' + entry.name
        const sub = drawTree(childPath, childPrefix, last)
        text += sub.text
        fileCount += sub.files
        dirCount += sub.dirs
      } else {
        const colored =
          entry.name.endsWith('.cpp') || entry.name.endsWith('.c')
            ? `${C.green}${entry.name}${C.reset}`
            : entry.name.endsWith('.hpp') || entry.name.endsWith('.h')
              ? `${C.cyan}${entry.name}${C.reset}`
              : entry.name
        writeln(`${prefix}${connector}${colored}`)
        text += entry.name + '\n'
      }
    }

    return { text, files: fileCount, dirs: dirCount }
  }

  function globToRegex(pattern: string): RegExp {
    let regex = '^'
    for (const ch of pattern) {
      if (ch === '*') regex += '.*'
      else if (ch === '?') regex += '.'
      else regex += escapeRegex(ch)
    }
    regex += '$'
    return new RegExp(regex, 'i')
  }

  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // ── Public API ──────────────────────────────────────────────────────────
  function writeCompilationOutput(line: string) {
    const term = terminal.value
    if (!term) return

    let colored = line
    if (line.includes('[ERROR]')) {
      colored = `${C.red}${line}${C.reset}`
    } else if (line.includes('[WARN]')) {
      colored = `${C.yellow}${line}${C.reset}`
    } else if (line.includes('[SUCCESS]')) {
      colored = `${C.green}${line}${C.reset}`
    } else if (line.includes('[INFO]')) {
      colored = `${C.cyan}${line}${C.reset}`
    }

    term.writeln(colored)
  }

  function writeRuntimeOutput(line: string) {
    terminal.value?.writeln(`${C.dim}${line}${C.reset}`)
  }

  function writeColored(text: string, color: string) {
    const colorCodes: Record<string, string> = {
      red: C.red, green: C.green, yellow: C.yellow,
      blue: C.blue, magenta: C.magenta, cyan: C.cyan, white: C.white,
    }
    terminal.value?.writeln(`${colorCodes[color] || ''}${text}${C.reset}`)
  }

  return {
    terminal,
    history,
    inputBuffer,
    cwd,
    aliases,
    env,

    setTerminal,
    writeWelcomeBanner,
    writePrompt,
    handleInput,
    writeCompilationOutput,
    writeRuntimeOutput,
    writeColored,
  }
})
