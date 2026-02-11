import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { compileRouter } from './routes/compile.js'
import { logger } from './services/logger.js'
import { initWsManager } from './services/ws-manager.js'

const app = express()
const PORT = parseInt(process.env.PORT || '4000', 10)

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// Rate limiting on compilation endpoint (POST only - not status/output polling)
const compileLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,               // 30 compilations per minute
  message: { success: false, error: 'Too many compilation requests, please try again later' },
  skip: (req) => req.method !== 'POST',  // Only limit POST (new compilations), not GET (status/output)
})
app.use('/api/compile', compileLimiter)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/compile', compileRouter)

// Create HTTP server
const server = createServer(app)

// WebSocket server for real-time compilation updates
const wss = new WebSocketServer({ server, path: '/ws' })

// Initialize WebSocket manager for broadcast support
initWsManager(wss)

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected')

  ws.on('message', (message) => {
    logger.debug(`Received: ${message}`)
  })

  ws.on('close', () => {
    logger.info('WebSocket client disconnected')
  })
})

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`)
  logger.info(`WebSocket available at ws://localhost:${PORT}/ws`)
})
