import { WebSocketServer, WebSocket } from 'ws'
import { logger } from './logger.js'

let wss: WebSocketServer | null = null

/**
 * Initialize the WebSocket manager with the existing WSS instance.
 */
export function initWsManager(server: WebSocketServer) {
  wss = server
  logger.info('WebSocket manager initialized')
}

/**
 * Broadcast a typed message to all connected WebSocket clients.
 */
export function broadcast(type: string, payload: Record<string, unknown>) {
  if (!wss) return

  const message = JSON.stringify({ type, payload })

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

/**
 * Get the count of currently connected clients.
 */
export function getClientCount(): number {
  return wss?.clients.size ?? 0
}
