import { spawn } from 'child_process'
import { writeFile, mkdir, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { logger } from './logger.js'

export interface CompilationResult {
  success: boolean
  jobId: string
  wasmUrl?: string
  jsUrl?: string
  errors?: string[]
  warnings?: string[]
  duration?: number
}

export interface CompilationJob {
  id: string
  source: string
  status: 'pending' | 'compiling' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
  result?: CompilationResult
}

const jobs = new Map<string, CompilationJob>()
const COMPILE_DIR = process.env.COMPILE_DIR || './compiled'
const USE_DOCKER = process.env.USE_DOCKER === 'true'

export async function createCompilationJob(source: string): Promise<CompilationJob> {
  const job: CompilationJob = {
    id: randomUUID(),
    source,
    status: 'pending',
    createdAt: new Date(),
  }

  jobs.set(job.id, job)

  // Start compilation asynchronously
  compileAsync(job).catch(err => {
    logger.error(`Compilation failed for job ${job.id}:`, err)
    job.status = 'failed'
    job.result = {
      success: false,
      jobId: job.id,
      errors: [err.message],
    }
  })

  return job
}

export function getJob(jobId: string): CompilationJob | undefined {
  return jobs.get(jobId)
}

async function compileAsync(job: CompilationJob): Promise<void> {
  const startTime = Date.now()
  job.status = 'compiling'

  const jobDir = join(COMPILE_DIR, job.id)
  const sourceFile = join(jobDir, 'main.cpp')
  const outputDir = join(jobDir, 'output')

  try {
    // Create job directory
    await mkdir(jobDir, { recursive: true })
    await mkdir(outputDir, { recursive: true })

    // Write source file
    await writeFile(sourceFile, job.source)

    if (USE_DOCKER) {
      await compileWithDocker(job, sourceFile, outputDir)
    } else {
      await compileLocal(job, sourceFile, outputDir)
    }

    const duration = Date.now() - startTime

    job.status = 'completed'
    job.completedAt = new Date()
    job.result = {
      success: true,
      jobId: job.id,
      wasmUrl: `/api/compile/output/${job.id}/app.wasm`,
      jsUrl: `/api/compile/output/${job.id}/app.js`,
      duration,
    }

    logger.info(`Compilation completed for job ${job.id} in ${duration}ms`)
  } catch (error) {
    job.status = 'failed'
    job.completedAt = new Date()
    job.result = {
      success: false,
      jobId: job.id,
      errors: [(error as Error).message],
      duration: Date.now() - startTime,
    }
    throw error
  }
}

async function compileWithDocker(
  job: CompilationJob,
  sourceFile: string,
  outputDir: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn('docker', [
      'exec',
      'allolib-studio-online-compiler-1',
      '/app/compile.sh',
      `/app/source/${job.id}/main.cpp`,
      `/app/output/${job.id}`,
      job.id,
    ])

    let stdout = ''
    let stderr = ''

    process.stdout.on('data', (data) => {
      stdout += data.toString()
      logger.debug(`[${job.id}] ${data}`)
    })

    process.stderr.on('data', (data) => {
      stderr += data.toString()
      logger.warn(`[${job.id}] ${data}`)
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Compilation failed with code ${code}: ${stderr}`))
      }
    })

    process.on('error', reject)
  })
}

async function compileLocal(
  job: CompilationJob,
  sourceFile: string,
  outputDir: string
): Promise<void> {
  // For local development without Docker, create mock output
  logger.info(`[${job.id}] Local compilation mode (mock)`)

  // Create a simple mock WASM module for testing
  const mockJs = `
// Mock AlloLib WASM module for development
export default function createModule(config = {}) {
  return Promise.resolve({
    _main: () => console.log('AlloLib app started'),
    canvas: config.canvas,
    print: config.print || console.log,
    printErr: config.printErr || console.error,
  });
}
`

  await writeFile(join(outputDir, 'app.js'), mockJs)
  logger.info(`[${job.id}] Mock compilation complete`)
}

export async function getCompiledFile(jobId: string, filename: string): Promise<Buffer | null> {
  const filePath = join(COMPILE_DIR, jobId, 'output', filename)
  try {
    return await readFile(filePath)
  } catch {
    return null
  }
}

export async function cleanupJob(jobId: string): Promise<void> {
  const jobDir = join(COMPILE_DIR, jobId)
  try {
    await rm(jobDir, { recursive: true, force: true })
    jobs.delete(jobId)
  } catch (error) {
    logger.warn(`Failed to cleanup job ${jobId}:`, error)
  }
}
