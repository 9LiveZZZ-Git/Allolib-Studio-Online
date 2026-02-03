#!/usr/bin/env ts-node
/**
 * Local Test Runner for AlloLib Studio Online
 *
 * Interactive CLI for running rendering tests locally with real-time feedback.
 * Supports watching for changes, visual comparison, and error tracking.
 */

import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'
import { WebSocketServer, WebSocket } from 'ws'

// Dynamic imports for ESM modules
let chalk: any
let ora: any
let open: any

async function loadDeps() {
  chalk = (await import('chalk')).default
  ora = (await import('ora')).default
  open = (await import('open')).default
}

interface TestConfig {
  backend: 'webgl2' | 'webgpu' | 'both'
  headed: boolean
  watch: boolean
  dashboard: boolean
  filter?: string
}

interface TestResult {
  name: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: string
  screenshot?: string
}

interface TestSession {
  id: string
  startTime: Date
  config: TestConfig
  results: TestResult[]
  errors: any[]
  status: 'running' | 'completed' | 'failed'
}

class LocalTestRunner {
  private config: TestConfig
  private session: TestSession | null = null
  private processes: ChildProcess[] = []
  private wss: WebSocketServer | null = null
  private dashboardServer: http.Server | null = null
  private clients: Set<WebSocket> = new Set()

  constructor(config: TestConfig) {
    this.config = config
  }

  async run(): Promise<void> {
    await loadDeps()

    console.log(chalk.cyan.bold('\n🧪 AlloLib Studio Online - Local Test Runner\n'))
    console.log(chalk.gray('─'.repeat(50)))
    console.log(`  Backend:   ${chalk.yellow(this.config.backend)}`)
    console.log(`  Headed:    ${this.config.headed ? chalk.green('Yes') : chalk.gray('No')}`)
    console.log(`  Watch:     ${this.config.watch ? chalk.green('Yes') : chalk.gray('No')}`)
    console.log(`  Dashboard: ${this.config.dashboard ? chalk.green('Yes') : chalk.gray('No')}`)
    if (this.config.filter) {
      console.log(`  Filter:    ${chalk.cyan(this.config.filter)}`)
    }
    console.log(chalk.gray('─'.repeat(50)) + '\n')

    // Initialize session
    this.session = {
      id: `test-${Date.now()}`,
      startTime: new Date(),
      config: this.config,
      results: [],
      errors: [],
      status: 'running',
    }

    try {
      // Start dashboard if requested
      if (this.config.dashboard) {
        await this.startDashboard()
      }

      // Start services
      await this.startServices()

      // Run tests
      await this.runTests()

      // Handle watch mode
      if (this.config.watch) {
        await this.watchMode()
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Test runner failed:'), error)
      this.session.status = 'failed'
    } finally {
      if (!this.config.watch) {
        await this.cleanup()
      }
    }
  }

  private async startDashboard(): Promise<void> {
    const spinner = ora('Starting error dashboard...').start()

    const port = 3333

    // Create simple HTTP server for dashboard
    this.dashboardServer = http.createServer((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(this.getDashboardHTML())
      } else if (req.url === '/api/session') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(this.session))
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    // WebSocket for real-time updates
    this.wss = new WebSocketServer({ server: this.dashboardServer })
    this.wss.on('connection', (ws) => {
      this.clients.add(ws)
      ws.send(JSON.stringify({ type: 'session', data: this.session }))
      ws.on('close', () => this.clients.delete(ws))
    })

    this.dashboardServer.listen(port, () => {
      spinner.succeed(`Dashboard running at ${chalk.cyan(`http://localhost:${port}`)}`)
      open(`http://localhost:${port}`)
    })
  }

  private broadcastUpdate(data: any): void {
    const message = JSON.stringify(data)
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    })
  }

  private async startServices(): Promise<void> {
    const spinner = ora('Starting development servers...').start()

    // Check if servers are already running
    const frontendUp = await this.checkPort(5173)
    const backendUp = await this.checkPort(4000)

    if (frontendUp && backendUp) {
      spinner.succeed('Development servers already running')
      return
    }

    // Start frontend if needed
    if (!frontendUp) {
      const frontend = spawn('npm', ['run', 'dev'], {
        cwd: path.join(__dirname, '../../frontend'),
        shell: true,
        stdio: 'pipe',
      })
      this.processes.push(frontend)
    }

    // Start backend if needed
    if (!backendUp) {
      const backend = spawn('npm', ['run', 'dev'], {
        cwd: path.join(__dirname, '../../backend'),
        shell: true,
        stdio: 'pipe',
      })
      this.processes.push(backend)
    }

    // Wait for servers to be ready
    await this.waitForServer('http://localhost:5173', 30000)
    await this.waitForServer('http://localhost:4000/health', 30000)

    spinner.succeed('Development servers ready')
  }

  private async checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}`, () => resolve(true))
      req.on('error', () => resolve(false))
      req.setTimeout(1000, () => {
        req.destroy()
        resolve(false)
      })
    })
  }

  private async waitForServer(url: string, timeout: number): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      try {
        await new Promise<void>((resolve, reject) => {
          const req = http.get(url, (res) => {
            if (res.statusCode === 200) resolve()
            else reject()
          })
          req.on('error', reject)
          req.setTimeout(1000, () => {
            req.destroy()
            reject()
          })
        })
        return
      } catch {
        await new Promise(r => setTimeout(r, 500))
      }
    }
    throw new Error(`Server at ${url} did not start within ${timeout}ms`)
  }

  private async runTests(): Promise<void> {
    console.log(chalk.cyan('\n📋 Running tests...\n'))

    // Build playwright command
    const args = ['playwright', 'test']

    // Add project filter based on backend
    if (this.config.backend === 'webgl2') {
      args.push('--project=chromium-webgl2')
    } else if (this.config.backend === 'webgpu') {
      args.push('--project=chromium-webgpu')
    }

    // Add headed mode
    if (this.config.headed) {
      args.push('--headed')
    }

    // Add test filter
    if (this.config.filter) {
      args.push('--grep', this.config.filter)
    }

    // Add reporter for real-time updates
    args.push('--reporter=list,json')

    return new Promise((resolve, reject) => {
      const proc = spawn('npx', args, {
        cwd: __dirname,
        shell: true,
        stdio: 'pipe',
        env: {
          ...process.env,
          FORCE_COLOR: '1',
        },
      })

      proc.stdout?.on('data', (data) => {
        const output = data.toString()
        process.stdout.write(output)

        // Parse test results from output
        this.parseTestOutput(output)
      })

      proc.stderr?.on('data', (data) => {
        const output = data.toString()
        process.stderr.write(output)

        // Track errors
        if (output.includes('Error') || output.includes('error')) {
          this.session?.errors.push({
            type: 'stderr',
            message: output,
            timestamp: new Date().toISOString(),
          })
          this.broadcastUpdate({
            type: 'error',
            data: { message: output },
          })
        }
      })

      proc.on('close', (code) => {
        this.session!.status = code === 0 ? 'completed' : 'failed'
        this.broadcastUpdate({
          type: 'complete',
          data: { exitCode: code, session: this.session },
        })

        this.printSummary()

        if (code === 0) {
          resolve()
        } else {
          resolve() // Don't reject, just report failure
        }
      })

      proc.on('error', reject)
    })
  }

  private parseTestOutput(output: string): void {
    // Parse Playwright list reporter output
    const passedMatch = output.match(/✓.*?(\d+)\s*(.+)/)
    const failedMatch = output.match(/✘.*?(\d+)\s*(.+)/)
    const skippedMatch = output.match(/○.*?(\d+)\s*(.+)/)

    if (passedMatch) {
      const result: TestResult = {
        name: passedMatch[2].trim(),
        status: 'passed',
        duration: parseInt(passedMatch[1]) || 0,
      }
      this.session?.results.push(result)
      this.broadcastUpdate({ type: 'result', data: result })
    }

    if (failedMatch) {
      const result: TestResult = {
        name: failedMatch[2].trim(),
        status: 'failed',
        duration: parseInt(failedMatch[1]) || 0,
      }
      this.session?.results.push(result)
      this.broadcastUpdate({ type: 'result', data: result })
    }

    if (skippedMatch) {
      const result: TestResult = {
        name: skippedMatch[2].trim(),
        status: 'skipped',
        duration: 0,
      }
      this.session?.results.push(result)
      this.broadcastUpdate({ type: 'result', data: result })
    }
  }

  private async watchMode(): Promise<void> {
    console.log(chalk.cyan('\n👀 Watch mode enabled. Press Ctrl+C to exit.\n'))

    // Watch for file changes
    const watchPaths = [
      path.join(__dirname, '../../frontend/src'),
      path.join(__dirname, '../../allolib-wasm/src'),
      path.join(__dirname, '../e2e'),
    ]

    const chokidar = await import('chokidar')

    const watcher = chokidar.watch(watchPaths, {
      ignoreInitial: true,
      ignored: /node_modules|dist/,
    })

    watcher.on('change', async (filepath) => {
      console.log(chalk.yellow(`\n📝 File changed: ${path.relative(process.cwd(), filepath)}`))
      console.log(chalk.cyan('Re-running tests...\n'))

      // Reset session for new run
      this.session = {
        id: `test-${Date.now()}`,
        startTime: new Date(),
        config: this.config,
        results: [],
        errors: [],
        status: 'running',
      }
      this.broadcastUpdate({ type: 'session', data: this.session })

      await this.runTests()
    })

    // Keep process alive
    await new Promise(() => {})
  }

  private printSummary(): void {
    if (!this.session) return

    const passed = this.session.results.filter(r => r.status === 'passed').length
    const failed = this.session.results.filter(r => r.status === 'failed').length
    const skipped = this.session.results.filter(r => r.status === 'skipped').length
    const total = this.session.results.length

    console.log('\n' + chalk.gray('─'.repeat(50)))
    console.log(chalk.bold('\n📊 Test Summary\n'))
    console.log(`  ${chalk.green('✓ Passed:')}  ${passed}`)
    console.log(`  ${chalk.red('✘ Failed:')}  ${failed}`)
    console.log(`  ${chalk.yellow('○ Skipped:')} ${skipped}`)
    console.log(`  ${chalk.blue('Total:')}     ${total}`)

    if (this.session.errors.length > 0) {
      console.log(chalk.red(`\n⚠️  ${this.session.errors.length} error(s) logged`))
    }

    const duration = (Date.now() - this.session.startTime.getTime()) / 1000
    console.log(chalk.gray(`\nCompleted in ${duration.toFixed(1)}s`))
    console.log(chalk.gray('─'.repeat(50)) + '\n')
  }

  private async cleanup(): Promise<void> {
    // Kill spawned processes
    for (const proc of this.processes) {
      proc.kill()
    }

    // Close dashboard
    if (this.dashboardServer) {
      this.dashboardServer.close()
    }
    if (this.wss) {
      this.wss.close()
    }
  }

  private getDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>AlloLib Test Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    h1 { color: #00d9ff; }
    .status {
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
    }
    .status.running { background: #ff9f1c; color: #000; }
    .status.completed { background: #2ec4b6; color: #000; }
    .status.failed { background: #e71d36; color: #fff; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    .card {
      background: #16213e;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #0f3460;
    }
    .card h2 {
      margin-bottom: 15px;
      color: #00d9ff;
      font-size: 1.1em;
    }
    .stat {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #0f3460;
    }
    .stat:last-child { border-bottom: none; }
    .stat-value { font-weight: bold; }
    .stat-value.passed { color: #2ec4b6; }
    .stat-value.failed { color: #e71d36; }
    .stat-value.skipped { color: #ff9f1c; }
    .results {
      max-height: 400px;
      overflow-y: auto;
    }
    .result {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      margin: 4px 0;
      background: #0f3460;
      border-radius: 6px;
    }
    .result.passed .icon { color: #2ec4b6; }
    .result.failed .icon { color: #e71d36; }
    .result.skipped .icon { color: #ff9f1c; }
    .icon { margin-right: 10px; font-size: 1.2em; }
    .result-name { flex: 1; }
    .result-time { color: #888; font-size: 0.9em; }
    .errors {
      max-height: 300px;
      overflow-y: auto;
    }
    .error {
      background: rgba(231, 29, 54, 0.2);
      border-left: 3px solid #e71d36;
      padding: 10px;
      margin: 8px 0;
      font-family: monospace;
      font-size: 0.85em;
      white-space: pre-wrap;
      overflow-x: auto;
    }
    .live-indicator {
      display: inline-block;
      width: 10px;
      height: 10px;
      background: #2ec4b6;
      border-radius: 50%;
      margin-right: 8px;
      animation: pulse 1s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧪 AlloLib Test Dashboard</h1>
    <div id="status" class="status running">
      <span class="live-indicator"></span>
      Running
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>📊 Statistics</h2>
      <div class="stat">
        <span>Passed</span>
        <span id="passed" class="stat-value passed">0</span>
      </div>
      <div class="stat">
        <span>Failed</span>
        <span id="failed" class="stat-value failed">0</span>
      </div>
      <div class="stat">
        <span>Skipped</span>
        <span id="skipped" class="stat-value skipped">0</span>
      </div>
      <div class="stat">
        <span>Total</span>
        <span id="total" class="stat-value">0</span>
      </div>
    </div>

    <div class="card">
      <h2>⚙️ Configuration</h2>
      <div class="stat">
        <span>Backend</span>
        <span id="backend" class="stat-value">-</span>
      </div>
      <div class="stat">
        <span>Session ID</span>
        <span id="sessionId" class="stat-value">-</span>
      </div>
      <div class="stat">
        <span>Started</span>
        <span id="startTime" class="stat-value">-</span>
      </div>
    </div>
  </div>

  <div class="grid" style="margin-top: 20px;">
    <div class="card">
      <h2>📋 Test Results</h2>
      <div id="results" class="results"></div>
    </div>

    <div class="card">
      <h2>⚠️ Errors</h2>
      <div id="errors" class="errors">
        <div style="color: #888; text-align: center; padding: 40px;">
          No errors yet
        </div>
      </div>
    </div>
  </div>

  <script>
    const ws = new WebSocket('ws://' + location.host);
    let session = null;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'session') {
        session = msg.data;
        updateUI();
      } else if (msg.type === 'result') {
        if (session) {
          session.results = session.results || [];
          session.results.push(msg.data);
          updateUI();
        }
      } else if (msg.type === 'error') {
        if (session) {
          session.errors = session.errors || [];
          session.errors.push(msg.data);
          updateErrors();
        }
      } else if (msg.type === 'complete') {
        session = msg.data.session;
        updateUI();
      }
    };

    function updateUI() {
      if (!session) return;

      // Update status
      const statusEl = document.getElementById('status');
      statusEl.className = 'status ' + session.status;
      statusEl.innerHTML = session.status === 'running'
        ? '<span class="live-indicator"></span>' + session.status.charAt(0).toUpperCase() + session.status.slice(1)
        : session.status.charAt(0).toUpperCase() + session.status.slice(1);

      // Update stats
      const results = session.results || [];
      document.getElementById('passed').textContent = results.filter(r => r.status === 'passed').length;
      document.getElementById('failed').textContent = results.filter(r => r.status === 'failed').length;
      document.getElementById('skipped').textContent = results.filter(r => r.status === 'skipped').length;
      document.getElementById('total').textContent = results.length;

      // Update config
      document.getElementById('backend').textContent = session.config?.backend || '-';
      document.getElementById('sessionId').textContent = session.id || '-';
      document.getElementById('startTime').textContent = session.startTime
        ? new Date(session.startTime).toLocaleTimeString()
        : '-';

      // Update results
      const resultsEl = document.getElementById('results');
      resultsEl.innerHTML = results.map(r => \`
        <div class="result \${r.status}">
          <span class="icon">\${r.status === 'passed' ? '✓' : r.status === 'failed' ? '✘' : '○'}</span>
          <span class="result-name">\${r.name}</span>
          <span class="result-time">\${r.duration}ms</span>
        </div>
      \`).join('');

      updateErrors();
    }

    function updateErrors() {
      const errorsEl = document.getElementById('errors');
      const errors = session?.errors || [];

      if (errors.length === 0) {
        errorsEl.innerHTML = '<div style="color: #888; text-align: center; padding: 40px;">No errors yet</div>';
      } else {
        errorsEl.innerHTML = errors.map(e => \`
          <div class="error">\${e.message || JSON.stringify(e)}</div>
        \`).join('');
      }
    }
  </script>
</body>
</html>
`
  }
}

// CLI
async function main() {
  const { Command } = await import('commander')

  const program = new Command()
    .name('local-test-runner')
    .description('Run AlloLib Studio rendering tests locally')
    .option('-b, --backend <type>', 'Backend to test (webgl2, webgpu, both)', 'both')
    .option('-h, --headed', 'Run tests in headed mode', false)
    .option('-w, --watch', 'Watch mode - re-run on file changes', false)
    .option('-d, --dashboard', 'Open live error tracking dashboard', false)
    .option('-f, --filter <pattern>', 'Filter tests by name pattern')
    .parse()

  const options = program.opts()

  const runner = new LocalTestRunner({
    backend: options.backend as 'webgl2' | 'webgpu' | 'both',
    headed: options.headed,
    watch: options.watch,
    dashboard: options.dashboard,
    filter: options.filter,
  })

  await runner.run()
}

main().catch(console.error)
