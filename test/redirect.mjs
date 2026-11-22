// Loaded into an example with NODE_OPTIONS=--import: its calls to services.carbium.sh go to the stand-in on
// 127.0.0.1:$STANDIN_PORT instead, over fetch (HTTP) and over the ws package (WebSocket). The example is not changed.
import net from 'node:net'
import tls from 'node:tls'

const host = 'services.carbium.sh'
const port = Number(process.env.STANDIN_PORT)
const fetch = globalThis.fetch
const connect = tls.connect

globalThis.fetch = (input, init) => {
  const url = new URL(String(input))
  if (url.hostname === host) url.href = `http://127.0.0.1:${port}${url.pathname}${url.search}`
  return fetch(url, init)
}

tls.connect = function (options, ...rest) {
  if (options?.host === host || options?.servername === host) return net.connect({ host: '127.0.0.1', port })
  return connect.call(this, options, ...rest)
}
