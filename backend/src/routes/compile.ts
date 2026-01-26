import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { logger } from '../services/logger.js'
import {
  createCompilationJob,
  getJob,
  getCompiledFile,
  cleanupJob,
} from '../services/compiler.js'

export const compileRouter = Router()

const CompileRequestSchema = z.object({
  source: z.string().min(1).max(100000),
  filename: z.string().default('main.cpp'),
})

// Submit compilation request
compileRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { source, filename } = CompileRequestSchema.parse(req.body)

    logger.info(`Compilation requested for ${filename}`)

    const job = await createCompilationJob(source)

    res.json({
      success: true,
      jobId: job.id,
      status: job.status,
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
