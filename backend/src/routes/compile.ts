import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { logger } from '../services/logger.js'
import {
  createCompilationJob,
  getJob,
  getCompiledFile,
  cleanupJob,
  BackendType,
} from '../services/compiler.js'

export const compileRouter = Router()

// File schema for multi-file projects
// Allows paths with folders like "src/synth.hpp"
// Security: prevents path traversal by requiring paths start with word char, no ".."
const FileSchema = z.object({
  name: z.string()
    .regex(/^[a-zA-Z][\w./-]*\.(cpp|hpp|h)$/, 'Invalid filename or path')
    .refine((val) => !val.includes('..'), 'Path traversal not allowed'),
  content: z.string().max(100000),
})

// Backend type schema
const BackendSchema = z.enum(['webgl2', 'webgpu']).default('webgl2')

// New multi-file request schema
const MultiFileRequestSchema = z.object({
  files: z.array(FileSchema).min(1).max(20),
  mainFile: z.string().default('main.cpp'),
  backend: BackendSchema,
})

// Legacy single-file request schema (for backward compatibility)
const LegacyRequestSchema = z.object({
  source: z.string().min(1).max(100000),
  filename: z.string().default('main.cpp'),
  backend: BackendSchema,
})

// Submit compilation request
compileRouter.post('/', async (req: Request, res: Response) => {
  try {
    let files: Array<{ name: string; content: string }>
    let mainFile: string
    let backend: BackendType

    // Check if this is a multi-file or legacy request
    if (req.body.files) {
      // Multi-file request
      const parsed = MultiFileRequestSchema.parse(req.body)
      files = parsed.files
      mainFile = parsed.mainFile
      backend = parsed.backend as BackendType
      logger.info(`Multi-file compilation requested: ${files.length} files, main: ${mainFile}, backend: ${backend}`)
    } else {
      // Legacy single-file request
      const parsed = LegacyRequestSchema.parse(req.body)
      files = [{ name: parsed.filename, content: parsed.source }]
      mainFile = parsed.filename
      backend = parsed.backend as BackendType
      logger.info(`Single-file compilation requested: ${mainFile}, backend: ${backend}`)
    }

    const job = await createCompilationJob(files, mainFile, backend)

    res.json({
      success: true,
      jobId: job.id,
      status: job.status,
      backend: job.backend,
      message: 'Compilation started',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors,
      })
      return
    }

    logger.error('Compilation error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

// Get job status
compileRouter.get('/status/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params
  const job = getJob(jobId)

  if (!job) {
    res.status(404).json({
      success: false,
      error: 'Job not found',
    })
    return
  }

  res.json({
    success: true,
    jobId: job.id,
    status: job.status,
    backend: job.backend,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    result: job.result,
  })
})

// Get compiled output files
compileRouter.get('/output/:jobId/:filename', async (req: Request, res: Response) => {
  const { jobId, filename } = req.params

  // Validate filename to prevent path traversal
  if (!/^[\w.-]+$/.test(filename)) {
    res.status(400).json({
      success: false,
      error: 'Invalid filename',
    })
    return
  }

  const file = await getCompiledFile(jobId, filename)

  if (!file) {
    res.status(404).json({
      success: false,
      error: 'File not found',
    })
    return
  }

  // Set appropriate content type
  if (filename.endsWith('.wasm')) {
    res.setHeader('Content-Type', 'application/wasm')
  } else if (filename.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript')
  }

  res.send(file)
})

// Cleanup job
compileRouter.delete('/:jobId', async (req: Request, res: Response) => {
  const { jobId } = req.params

  await cleanupJob(jobId)

  res.json({
    success: true,
    message: 'Job cleaned up',
  })
})
