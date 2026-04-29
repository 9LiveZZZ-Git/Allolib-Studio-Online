import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { compileRouter } from './routes/compile.js'
import { logger } from './services/logger.js'
import { initWsManager } from './services/ws-manager.js'
import { initOscRelay } from './services/osc-relay.js'

const app = express()
const PORT = process.env.PORT || 4000

app.use(helmet())

const allowedOrigins = [
  'http://localhost:3000',
  'https://9livezzz-git.github.io',
]

if (process.env.CORS_ORIGIN) {
  allowedOrigins.push(process.env.CORS_ORIGIN)
}

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? allowedOrigins
    : true, // allow all origins in development
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/compile', compileRouter)

const server = createServer(app)

// WebSocket at /ws streams compile output lines to the frontend in real time.
const wss = new WebSocketServer({ server, path: '/ws' })
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

// M5.5: OSC ↔ WebSocket relay listens on its own port(s) so the WASM URL
// `ws://<host>:<port>/osc` produced by al::osc::Send/Recv connects directly.
// Configurable via OSC_RELAY_PORTS / OSC_UDP_BRIDGE; default port 9010.
initOscRelay()

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`)
  logger.info(`WebSocket available at ws://localhost:${PORT}/ws`)
})
