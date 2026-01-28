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

export interface ProjectFile {
  name: string
  content: string
}

export interface CompilationJob {
  id: string
  files: ProjectFile[]
  mainFile: string
  status: 'pending' | 'compiling' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
  result?: CompilationResult
}

const jobs = new Map<string, CompilationJob>()
const COMPILE_DIR = process.env.COMPILE_DIR || './compiled'
const SOURCE_DIR = process.env.SOURCE_DIR || './source'
const USE_DOCKER = process.env.USE_DOCKER === 'true'
const COMPILER_CONTAINER = process.env.COMPILER_CONTAINER || 'allolib-compiler'

export async function createCompilationJob(
  files: ProjectFile[],
  mainFile: string = 'main.cpp'
): Promise<CompilationJob> {
  const job: CompilationJob = {
    id: randomUUID(),
    files,
    mainFile,
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

  // Source files go to shared source volume, output to compiled volume
  const sourceJobDir = join(SOURCE_DIR, job.id)
  const outputDir = join(COMPILE_DIR, job.id)

  try {
    // Create job directories
    await mkdir(sourceJobDir, { recursive: true })
    await mkdir(outputDir, { recursive: true })

    // Write all source files to shared volume
    for (const file of job.files) {
      const filePath = join(sourceJobDir, file.name)
      // Create subdirectories if file is in a folder (e.g., "src/synth.hpp")
      if (file.name.includes('/')) {
        const fileDir = filePath.substring(0, filePath.lastIndexOf('/'))
        await mkdir(fileDir, { recursive: true })
      }
      await writeFile(filePath, file.content)
      logger.info(`[${job.id}] Wrote file: ${file.name}`)
    }

    const mainSourceFile = join(sourceJobDir, job.mainFile)

    if (USE_DOCKER) {
      await compileWithDocker(job, mainSourceFile, outputDir)
    } else {
      await compileLocal(job, mainSourceFile, outputDir)
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
  _sourceFile: string,
  _outputDir: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Paths inside the compiler container (mounted volumes)
    const containerSourceFile = `/app/source/${job.id}/${job.mainFile}`
    const containerOutputDir = `/app/output/${job.id}`

    logger.info(`[${job.id}] Starting Docker compilation...`)
    logger.info(`[${job.id}] Container: ${COMPILER_CONTAINER}`)
    logger.info(`[${job.id}] Source: ${containerSourceFile}`)
    logger.info(`[${job.id}] Output: ${containerOutputDir}`)

    const dockerProcess = spawn('docker', [
      'exec',
      COMPILER_CONTAINER,
      '/app/compile.sh',
      containerSourceFile,
      containerOutputDir,
      job.id,
    ])

    let stdout = ''
    let stderr = ''

    dockerProcess.stdout.on('data', (data) => {
      stdout += data.toString()
      logger.info(`[${job.id}] ${data.toString().trim()}`)
    })

    dockerProcess.stderr.on('data', (data) => {
      stderr += data.toString()
      logger.warn(`[${job.id}] ${data.toString().trim()}`)
    })

    dockerProcess.on('close', (code) => {
      if (code === 0) {
        logger.info(`[${job.id}] Compilation successful`)
        resolve()
      } else {
        logger.error(`[${job.id}] Compilation failed with code ${code}`)
        reject(new Error(`Compilation failed with code ${code}: ${stderr}`))
      }
    })

    dockerProcess.on('error', (err) => {
      logger.error(`[${job.id}] Docker process error: ${err.message}`)
      reject(err)
    })
  })
}

async function compileLocal(
  job: CompilationJob,
  _sourceFile: string,
  outputDir: string
): Promise<void> {
  // For local development without Docker, create mock output
  logger.info(`[${job.id}] Local compilation mode (mock) - ${job.files.length} file(s)`)

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
  // Output files are directly in the job directory (copied from compiler output volume)
  const filePath = join(COMPILE_DIR, jobId, filename)
  try {
    return await readFile(filePath)
  } catch {
    return null
  }
}

export async function cleanupJob(jobId: string): Promise<void> {
  const compileJobDir = join(COMPILE_DIR, jobId)
  const sourceJobDir = join(SOURCE_DIR, jobId)
  try {
    await rm(compileJobDir, { recursive: true, force: true })
    await rm(sourceJobDir, { recursive: true, force: true })
    jobs.delete(jobId)
  } catch (error) {
    logger.warn(`Failed to cleanup job ${jobId}:`, error)
  }
}
