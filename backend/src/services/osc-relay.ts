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

import { createServer as createHttpServer, type IncomingMessage, type Server as HttpServer } from 'http'
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

// ─── Shared /osc endpoint on the main HTTP server ─────────────────────────
//
// Production deployments (Railway) expose only one HTTP port. Browser clients
// can't reach the per-port hubs above because (a) Railway doesn't open
// arbitrary ports, and (b) `ws://127.0.0.1:<port>/osc` from a remote browser
// is the user's own loopback, not ours. So we attach a second WSS to the
// existing PORT (4000) at path `/osc` and demux clients by `?port=N` query —
// each port becomes a hub, identical fan-out semantics to the per-port
// listeners. The frontend runtime sets window.__alloOscRelayUrl to this URL
// and the WASM appends `?port=N`.

const sharedHubs = new Map<number, Set<WebSocket>>()
let sharedWss: WebSocketServer | null = null

/**
 * Returns a `noServer:true` WebSocketServer for /osc. The caller is
 * responsible for routing HTTP upgrade events to it (see index.ts) so we
 * don't conflict with the /ws WSS that lives on the same HTTP server.
 */
export function attachOscRelayToServer(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true })
  sharedWss = wss

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const queryStr = (req.url ?? '').split('?')[1] ?? ''
    const params = new URLSearchParams(queryStr)
    const portStr = params.get('port') ?? '0'
    const port = parseInt(portStr, 10)
    if (!port || port < 1 || port > 65535) {
      logger.warn(`[osc-relay shared] rejecting connection without valid ?port (got "${portStr}")`)
      ws.close(1008, 'missing port query param')
      return
    }

    let hub = sharedHubs.get(port)
    if (!hub) {
      hub = new Set<WebSocket>()
      sharedHubs.set(port, hub)
    }
    hub.add(ws)
    logger.info(`[osc-relay shared :${port}] client joined (${hub.size} on hub)`)

    ws.on('message', (data, isBinary) => {
      if (!isBinary) return
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
      const peers = sharedHubs.get(port)
      if (!peers) return
      for (const peer of peers) {
        if (peer === ws) continue
        if (peer.readyState === WebSocket.OPEN) peer.send(buf, { binary: true })
      }
      // If a per-port hub on this port also exists (e.g. with UDP bridge
      // enabled), forward into that hub's UDP socket so native receivers
      // hear browser frames.
      const localHub = hubs.get(port)
      if (localHub?.udp) {
        localHub.udp.send(buf, port, '127.0.0.1', () => {})
      }
    })

    ws.on('close', () => {
      const peers = sharedHubs.get(port)
      if (peers) {
        peers.delete(ws)
        if (peers.size === 0) sharedHubs.delete(port)
        logger.info(`[osc-relay shared :${port}] client left (${peers.size} remaining)`)
      }
    })
    ws.on('error', (err) => {
      logger.warn(`[osc-relay shared :${port}] ws error: ${err.message}`)
    })
  })

  logger.info('[osc-relay shared] /osc WSS ready (caller routes upgrade events; ?port=N to join hub)')
  return wss
}

export function shutdownOscRelay() {
  for (const hub of hubs.values()) {
    for (const c of hub.clients) c.close()
    hub.wss.close()
    hub.udp?.close()
    hub.http.close()
  }
  hubs.clear()
  if (sharedWss) {
    for (const peers of sharedHubs.values()) for (const c of peers) c.close()
    sharedHubs.clear()
    sharedWss.close()
    sharedWss = null
  }
}
