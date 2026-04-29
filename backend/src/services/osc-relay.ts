/**
 * OSC ↔ WebSocket relay (M5.5)
 *
 * Browser-side AlloLib (al::osc::Send / al::osc::Recv) ships binary OSC
 * packets over WebSocket. This relay listens on one or more "OSC ports",
 * groups clients per port into a hub, and rebroadcasts every binary frame
 * to all other clients on the same port. That mirrors UDP multicast on
 * loopback: every Send to port N is heard by every Recv on port N.
 *
 * Optional UDP bridge:
 *   When OSC_UDP_BRIDGE=true, each port also opens a dgram socket and:
 *     - forwards binary frames received from any WS client to UDP
 *       127.0.0.1:<port> (so a native AlloLib instance bound there
 *       receives them);
 *     - forwards UDP packets received from outside back to all WS clients.
 *   This is the cross-language interop path. Disabled by default because
 *   Railway-style PaaS environments typically don't allow inbound UDP.
 *
 * Configuration (env vars):
 *   OSC_RELAY_PORTS   comma-separated list, ranges allowed: "9010,9011-9020"
 *                     (default "9010")
 *   OSC_UDP_BRIDGE    "true"|"false" (default "false")
 *
 * Path: each port listens on path `/osc`. WASM clients connect to
 *   ws://<host>:<port>/osc
 * which is exactly what `osc::Send(port, host)` / `osc::Recv(port)`
 * produce in al_OSC_Web.cpp. No URL rewriting needed.
 */

import { createServer as createHttpServer, type Server as HttpServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { createSocket, type Socket as DgramSocket } from 'dgram'
import { logger } from './logger.js'

interface PortHub {
  port: number
  http: HttpServer
  wss: WebSocketServer
  udp?: DgramSocket
  clients: Set<WebSocket>
}

const hubs = new Map<number, PortHub>()

function parsePortList(spec: string): number[] {
  const out = new Set<number>()
  for (const segment of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const range = segment.match(/^(\d+)-(\d+)$/)
    if (range) {
      const lo = parseInt(range[1], 10)
      const hi = parseInt(range[2], 10)
      for (let p = lo; p <= hi; p++) out.add(p)
    } else {
      const p = parseInt(segment, 10)
      if (!Number.isNaN(p)) out.add(p)
    }
  }
  return Array.from(out).filter((p) => p >= 1 && p <= 65535)
}

function startPortHub(port: number, udpBridge: boolean) {
  const http = createHttpServer()
  const wss = new WebSocketServer({ server: http, path: '/osc' })

  const hub: PortHub = { port, http, wss, clients: new Set() }
  hubs.set(port, hub)

  wss.on('connection', (ws, req) => {
    hub.clients.add(ws)
    logger.info(`[osc-relay :${port}] client connected from ${req.socket.remoteAddress} (${hub.clients.size} on port)`)

    ws.on('message', (data, isBinary) => {
      if (!isBinary) return
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
      // Rebroadcast to every other WS client on this port.
      for (const peer of hub.clients) {
        if (peer === ws) continue
        if (peer.readyState === WebSocket.OPEN) peer.send(buf, { binary: true })
      }
      // Bridge to UDP loopback so native receivers also get it.
      if (hub.udp) {
        hub.udp.send(buf, port, '127.0.0.1', (err) => {
          if (err) logger.warn(`[osc-relay :${port}] udp send error: ${err.message}`)
        })
      }
    })

    ws.on('close', () => {
      hub.clients.delete(ws)
      logger.info(`[osc-relay :${port}] client disconnected (${hub.clients.size} remaining)`)
    })
    ws.on('error', (err) => {
      logger.warn(`[osc-relay :${port}] ws error: ${err.message}`)
    })
  })

  if (udpBridge) {
    const udp = createSocket('udp4')
    udp.on('message', (buf) => {
      // Forward UDP → all WS clients on this port.
      for (const peer of hub.clients) {
        if (peer.readyState === WebSocket.OPEN) peer.send(buf, { binary: true })
      }
    })
    udp.on('error', (err) => {
      logger.warn(`[osc-relay :${port}] udp socket error: ${err.message}`)
    })
    udp.bind(port, () => {
      logger.info(`[osc-relay :${port}] udp bridge listening on 0.0.0.0:${port}`)
    })
    hub.udp = udp
  }

  http.listen(port, () => {
    logger.info(`[osc-relay :${port}] ws://0.0.0.0:${port}/osc ready`)
  })
  http.on('error', (err) => {
    logger.error(`[osc-relay :${port}] http listen failed: ${(err as Error).message}`)
    hubs.delete(port)
  })
}

export function initOscRelay() {
  const spec = process.env.OSC_RELAY_PORTS ?? '9010'
  const udpBridge = (process.env.OSC_UDP_BRIDGE ?? 'false').toLowerCase() === 'true'
  const ports = parsePortList(spec)

  if (ports.length === 0) {
    logger.warn('[osc-relay] OSC_RELAY_PORTS empty — relay disabled')
    return
  }

  logger.info(`[osc-relay] starting on ports [${ports.join(', ')}]${udpBridge ? ' + udp bridge' : ''}`)
  for (const port of ports) startPortHub(port, udpBridge)
}

export function shutdownOscRelay() {
  for (const hub of hubs.values()) {
    for (const c of hub.clients) c.close()
    hub.wss.close()
    hub.udp?.close()
    hub.http.close()
  }
  hubs.clear()
}
