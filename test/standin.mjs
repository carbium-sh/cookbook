// A stand-in for the services.carbium.sh door, on 127.0.0.1. Examples reach it through redirect.mjs, so a test needs no
// network and no real key.
// - HTTP: with the one key it is given it answers the methods in `answers`: a result, or a function of (params, n), n
//   counting that method's calls from 1, that returns a result or a Refusal, or a promise of one. With no x-api-key header it
//   answers the public methods the same way, as the door does; any other key gets the door's 401, and no key on any other
//   method its 401 KEY_REQUIRED.
// - WebSocket: with that key it acks every subscribe and unsubscribe; `socket.notification` is pushed with each ack, in
//   the same write, and `socket.close` ([code, reason]) closes the socket right after it. `socket.closeAfter`
//   ({ call, close }) closes every open socket once that HTTP call has been answered instead. Any other key, or none,
//   is refused at the handshake.
// With `tls` ({ key, cert }) it serves HTTPS, and `port` names its port (443 for the compiled languages' hosts entry).
// The promise rejects, with what to do, when it cannot listen there.
// `calls` lists every call in order by method; a refused handshake is 'websocket handshake', and a key that came in the
// URL or the WebSocket subprotocol is 'key outside x-api-key'.
import { createServer } from 'node:http'
import { createServer as createSecureServer } from 'node:https'
import { WebSocketServer } from 'ws'
import { PUBLIC } from '../scripts/recipes.mjs'

export class Refusal {
  constructor(status, code, message, data) {
    Object.assign(this, { status, error: { code, message, ...(data ? { data } : {}) } })
  }
}

const outside = (req) => /c_serv_|api-key/i.test(req.url) || /c_serv_/.test(String(req.headers['sec-websocket-protocol'] ?? ''))

export function standIn({ key, answers = {}, socket = {}, tls, port = 0 }) {
  const calls = []
  const counts = {}
  const handle = (req, res) => {
    let text = ''
    req.on('data', (chunk) => (text += chunk))
    req.on('end', async () => {
      const { id = null, method, params } = JSON.parse(text || '{}')
      calls.push(outside(req) ? 'key outside x-api-key' : method)
      const reply = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id, ...body }))
      }
      const sent = req.headers['x-api-key']
      if (sent === undefined && !PUBLIC.has(method)) return reply(401, { error: { code: -32001, message: 'this method needs an api key', data: { reason: 'KEY_REQUIRED' } } })
      if (sent !== undefined && sent !== key) return reply(401, { error: { code: -32001, message: 'unknown api key', data: { reason: 'UNKNOWN_KEY' } } })
      if (!(method in answers)) return reply(200, { error: { code: -32601, message: 'Method not found' } })
      counts[method] = (counts[method] ?? 0) + 1
      const answer = await (typeof answers[method] === 'function' ? answers[method](params, counts[method]) : answers[method])
      if (answer instanceof Refusal) return reply(answer.status, { error: answer.error })
      reply(200, { result: answer })
      if (socket.closeAfter?.call === method) setTimeout(() => sockets.clients.forEach((ws) => ws.close(...socket.closeAfter.close)), 100)
    })
  }
  const server = tls ? createSecureServer(tls, handle) : createServer(handle)
  const sockets = new WebSocketServer({ noServer: true })
  server.on('upgrade', (req, raw, head) => {
    if (outside(req) || req.headers['x-api-key'] !== key) {
      calls.push(outside(req) ? 'key outside x-api-key' : 'websocket handshake')
      return raw.end('HTTP/1.1 401 Unauthorized\r\ncontent-length: 0\r\nconnection: close\r\n\r\n')
    }
    sockets.handleUpgrade(req, raw, head, (ws) => {
      ws.on('message', (data) => {
        const { id, method } = JSON.parse(String(data))
        calls.push(method)
        if (method.endsWith('Unsubscribe')) return ws.send(JSON.stringify({ jsonrpc: '2.0', id, result: true }))
        // The ack and the notification leave in one write, as two frames can on the service.
        ws._socket.cork()
        ws.send(JSON.stringify({ jsonrpc: '2.0', id, result: 7 }))
        if (socket.notification) ws.send(JSON.stringify({ jsonrpc: '2.0', method: method.replace(/Subscribe$/, 'Notification'), params: { subscription: 7, result: socket.notification } }))
        process.nextTick(() => ws._socket.uncork())
        if (socket.close) ws.close(...socket.close)
      })
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', (error) => reject(new Error(listenProblem(port, error.code))))
    server.listen(port, '127.0.0.1', () =>
      resolve({
        port: server.address().port,
        calls,
        close: () => {
          for (const ws of sockets.clients) ws.terminate()
          server.closeAllConnections()
          server.close()
        },
      }),
    )
  })
}

/** Why the stand-in could not listen, and for port 443 what lets it. */
export function listenProblem(port, code) {
  const why = `the stand-in cannot listen on 127.0.0.1:${port}: ${code}`
  if (port !== 443) return why
  return `${why}. The Rust and Go examples need port 443: allow it (sudo sysctl -w net.ipv4.ip_unprivileged_port_start=443, or a container), add "127.0.0.1 services.carbium.sh" to /etc/hosts, or set COOKBOOK_LANGUAGES=typescript,python to skip them.`
}
