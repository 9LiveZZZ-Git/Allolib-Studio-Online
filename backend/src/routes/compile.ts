import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { logger } from '../services/logger.js'

export const compileRouter = Router()

const CompileRequestSchema = z.object({
  source: z.string().min(1).max(100000),
  filename: z.string().default('main.cpp'),
})

compileRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { source, filename } = CompileRequestSchema.parse(req.body)

    logger.info(`Compilation requested for ${filename}`)

    // TODO: Implement actual compilation with Emscripten
    // For now, return a placeholder response

    res.json({
      success: true,
      message: 'Compilation endpoint ready',
      jobId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
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

compileRouter.get('/status/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params

  // TODO: Implement job status checking
  res.json({
    jobId,
    status: 'pending',
    message: 'Job status endpoint ready',
  })
})
