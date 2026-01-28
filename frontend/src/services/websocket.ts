export type MessageType = 'compile:output' | 'compile:status' | 'compile:complete'

export interface WsMessage {
  type: MessageType
  payload: Record<string, unknown>
}

type MessageHandler = (payload: Record<string, unknown>) => void

/**
 * WebSocket client with auto-reconnect for real-time compile streaming.
 * Connects to ws://host/ws (proxied via vite dev server).
 */
export class WebSocketService {
  private ws: WebSocket | null = null
  private listeners = new Map<string, Set<MessageHandler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private baseDelay = 1000
  private maxDelay = 30000
  private intentionallyClosed = false

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    this.intentionallyClosed = false
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        console.log('[WS] Connected')
      }

      this.ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data)
          this.dispatch(msg.type, msg.payload)
        } catch {
          // Non-JSON message, ignore
        }
      }

      this.ws.onclose = () => {
        console.log('[WS] Disconnected')
        if (!this.intentionallyClosed) {
          this.scheduleReconnect()
        }
      }

      this.ws.onerror = () => {
        // onclose will fire after onerror, which handles reconnection
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  disconnect() {
    this.intentionallyClosed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(handler)
  }

  off(type: string, handler: MessageHandler) {
    this.listeners.get(type)?.delete(handler)
  }

  private dispatch(type: string, payload: Record<string, unknown>) {
    const handlers = this.listeners.get(type)
    if (handlers) {
      for (const handler of handlers) {
        handler(payload)
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached')
      return
    }

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      this.maxDelay
    )
    this.reconnectAttempts++

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }
}

// Singleton instance
export const wsService = new WebSocketService()
