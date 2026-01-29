import { ChildProcess, spawn, fork } from 'child_process';
import * as path from 'path';
import * as http from 'http';
import { app } from 'electron';

export class BackendRunner {
  private process: ChildProcess | null = null;
  private port: number;
  private getResourcePath: (relativePath: string) => string;
  private isRunning = false;

  constructor(port: number, getResourcePath: (relativePath: string) => string) {
    this.port = port;
    this.getResourcePath = getResourcePath;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Backend] Already running');
      return;
    }

    console.log('[Backend] Starting server on port', this.port);

    try {
      // Determine the backend entry point
      let backendPath: string;
      let useNode = true;

      if (app.isPackaged) {
        // Production: use bundled backend
        backendPath = this.getResourcePath('backend/index.js');

        // Check if we have the compiled JS or need to use tsx
        const fs = await import('fs');
        if (!fs.existsSync(backendPath)) {
          // Fallback to source with tsx
          backendPath = this.getResourcePath('backend-src/index.ts');
          useNode = false;
        }
      } else {
        // Development: run from source
        backendPath = path.join(__dirname, '..', '..', 'backend', 'src', 'index.ts');
        useNode = false;
      }

      console.log('[Backend] Entry point:', backendPath);
      console.log('[Backend] Using Node:', useNode);

      // Set up environment
      const env = {
        ...process.env,
        PORT: String(this.port),
        NODE_ENV: app.isPackaged ? 'production' : 'development',
      };

      if (useNode) {
        // Run compiled JavaScript with Node
        this.process = spawn('node', [backendPath], {
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: path.dirname(backendPath),
        });
      } else {
        // Run TypeScript with tsx
        const tsxPath = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'tsx');
        this.process = spawn(process.platform === 'win32' ? 'npx' : tsxPath,
          process.platform === 'win32' ? ['tsx', backendPath] : [backendPath], {
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: path.dirname(backendPath),
          shell: process.platform === 'win32',
        });
      }

      // Handle stdout
      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          console.log('[Backend]', text);
        }
      });

      // Handle stderr
      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString().trim();
        if (text) {
          console.error('[Backend Error]', text);
        }
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        console.log('[Backend] Process exited with code:', code, 'signal:', signal);
        this.isRunning = false;
        this.process = null;
      });

      this.process.on('error', (error) => {
        console.error('[Backend] Process error:', error);
        this.isRunning = false;
      });

      // Wait for server to be ready
      await this.waitForReady();
      this.isRunning = true;
      console.log('[Backend] Server is ready');
    } catch (error) {
      console.error('[Backend] Failed to start:', error);
      throw error;
    }
  }

  private async waitForReady(timeout = 30000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 500;

    return new Promise((resolve, reject) => {
      const check = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Backend server failed to start (timeout)'));
          return;
        }

        // Try to connect to the health endpoint
        const req = http.request(
          {
            hostname: 'localhost',
            port: this.port,
            path: '/health',
            method: 'GET',
            timeout: 1000,
          },
          (res) => {
            if (res.statusCode === 200) {
              resolve();
            } else {
              setTimeout(check, checkInterval);
            }
          }
        );

        req.on('error', () => {
          setTimeout(check, checkInterval);
        });

        req.on('timeout', () => {
          req.destroy();
          setTimeout(check, checkInterval);
        });

        req.end();
      };

      // Start checking after a short delay
      setTimeout(check, 1000);
    });
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    console.log('[Backend] Stopping server...');

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        console.log('[Backend] Force killing...');
        this.process?.kill('SIGKILL');
        resolve();
      }, 5000);

      this.process.once('exit', () => {
        clearTimeout(timeout);
        this.isRunning = false;
        this.process = null;
        console.log('[Backend] Server stopped');
        resolve();
      });

      // Send graceful shutdown signal
      if (process.platform === 'win32') {
        this.process.kill();
      } else {
        this.process.kill('SIGTERM');
      }
    });
  }

  getPort(): number {
    return this.port;
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }
}
