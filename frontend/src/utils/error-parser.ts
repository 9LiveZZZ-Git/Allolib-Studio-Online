import * as monaco from 'monaco-editor'

/**
 * Parsed diagnostic from compiler output
 */
export interface CompilerDiagnostic {
  line: number
  column: number
  endLine?: number
  endColumn?: number
  message: string
  severity: 'error' | 'warning' | 'info'
  source: string
}

/**
 * Parse GCC/Clang/Emscripten compiler output into structured diagnostics
 *
 * Typical formats:
 * - GCC/Clang: "file.cpp:10:5: error: expected ';' after expression"
 * - Emscripten: "source.cpp:15:3: warning: unused variable 'x' [-Wunused-variable]"
 * - Linker: "undefined reference to `foo'"
 */
export function parseCompilerOutput(output: string | string[]): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = []
  const lines = Array.isArray(output) ? output : output.split('\n')

  // GCC/Clang error format: file:line:column: severity: message
  const gccPattern = /^(?:.*?[\\/])?([^:\\/]+):(\d+):(\d+):\s*(error|warning|note|fatal error):\s*(.+)$/i

  // Alternative format without column: file:line: severity: message
  const gccNoColPattern = /^(?:.*?[\\/])?([^:\\/]+):(\d+):\s*(error|warning|note|fatal error):\s*(.+)$/i

  // Linker error format: undefined reference to `symbol'
  const linkerPattern = /undefined reference to [`']([^'`]+)[`']/i

  // In function pattern (context for errors)
  const inFunctionPattern = /In function [`']([^'`]+)[`']/i

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Try GCC/Clang format with column
    let match = trimmed.match(gccPattern)
    if (match) {
      const [, file, lineNum, colNum, severity, message] = match
      // Only include errors from user source files (app.cpp, source.cpp, main.cpp)
      if (file.match(/^(app|source|main|user)\.cpp$/i) || file === '<source>') {
        diagnostics.push({
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
          message: message.trim(),
          severity: mapSeverity(severity),
          source: 'emcc',
        })
      }
      continue
    }

    // Try GCC/Clang format without column
    match = trimmed.match(gccNoColPattern)
    if (match) {
      const [, file, lineNum, severity, message] = match
      if (file.match(/^(app|source|main|user)\.cpp$/i) || file === '<source>') {
        diagnostics.push({
          line: parseInt(lineNum, 10),
          column: 1,
          message: message.trim(),
          severity: mapSeverity(severity),
          source: 'emcc',
        })
      }
      continue
    }

    // Try linker error
    match = trimmed.match(linkerPattern)
    if (match) {
      diagnostics.push({
        line: 1,
        column: 1,
        message: `Linker error: undefined reference to '${match[1]}'`,
        severity: 'error',
        source: 'ld',
      })
      continue
    }
  }

  return diagnostics
}

function mapSeverity(severity: string): 'error' | 'warning' | 'info' {
  const lower = severity.toLowerCase()
  if (lower === 'error' || lower === 'fatal error') return 'error'
  if (lower === 'warning') return 'warning'
  return 'info'
}

/**
 * Convert our diagnostics to Monaco markers
 */
export function diagnosticsToMarkers(diagnostics: CompilerDiagnostic[]): monaco.editor.IMarkerData[] {
  return diagnostics.map(diag => ({
    startLineNumber: diag.line,
    startColumn: diag.column,
    endLineNumber: diag.endLine || diag.line,
    endColumn: diag.endColumn || diag.column + 1,
    message: diag.message,
    severity: severityToMonaco(diag.severity),
    source: diag.source,
  }))
}

function severityToMonaco(severity: 'error' | 'warning' | 'info'): monaco.MarkerSeverity {
  switch (severity) {
    case 'error': return monaco.MarkerSeverity.Error
    case 'warning': return monaco.MarkerSeverity.Warning
    case 'info': return monaco.MarkerSeverity.Info
    default: return monaco.MarkerSeverity.Info
  }
}

/**
 * Set diagnostics on a Monaco editor model
 */
export function setEditorDiagnostics(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  diagnostics: CompilerDiagnostic[]
): void {
  if (!editor) return

  const model = editor.getModel()
  if (!model) return

  const markers = diagnosticsToMarkers(diagnostics)
  monaco.editor.setModelMarkers(model, 'compiler', markers)
}

/**
 * Clear all diagnostics from a Monaco editor
 */
export function clearEditorDiagnostics(editor: monaco.editor.IStandaloneCodeEditor | null): void {
  if (!editor) return

  const model = editor.getModel()
  if (!model) return

  monaco.editor.setModelMarkers(model, 'compiler', [])
}

/**
 * Jump to the first error in the editor
 */
export function jumpToFirstError(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  diagnostics: CompilerDiagnostic[]
): void {
  if (!editor || diagnostics.length === 0) return

  const firstError = diagnostics.find(d => d.severity === 'error') || diagnostics[0]

  editor.revealLineInCenter(firstError.line)
  editor.setPosition({ lineNumber: firstError.line, column: firstError.column })
  editor.focus()
}
