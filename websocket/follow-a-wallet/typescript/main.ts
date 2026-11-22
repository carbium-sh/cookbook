// Follow a wallet over WebSocket. logsSubscribe with mentions fires for every transaction that touches the wallet;
// getBalance reads the balance it starts from. The example takes at most one notification within 10 seconds, then
// unsubscribes and exits.
import { createCarbium, isCarbiumError } from '@carbium/sdk'
import WebSocket from 'ws'

const apiKey = process.env.CARBIUM_KEY
if (!apiKey) {
  console.error('set CARBIUM_KEY to your c_serv_ key')
  process.exit(2)
}

const wallet = '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9'
const waitMs = 10_000

// Nothing here waits longer than 20 seconds in all.
setTimeout(() => {
  console.error(JSON.stringify({ status: 0, code: null, message: 'no answer within 20 seconds' }))
  process.exit(1)
}, 20_000).unref()

try {
  const carbium = createCarbium({ apiKey })
  // The ws package lets the key travel in the x-api-key header of the handshake. onFatal fires when the socket gives up
  // for good, for example when the server closes it because the key was revoked.
  const socket = carbium.socket({
    WebSocket,
    carrier: 'header',
    onFatal: (error) => {
      console.error(JSON.stringify({ status: error.httpStatus, code: error.code, message: error.message }))
      process.exit(1)
    },
  })
  let notification: { slot: number; signature: string; failed: boolean } | null = null
  let arrived = () => {}
  const first = new Promise<void>((resolve) => (arrived = resolve))
  const sub = socket.logsSubscribe({ mentions: [wallet] }, (n) => {
    notification ??= { slot: n.context.slot, signature: n.value.signature, failed: n.value.err !== null }
    arrived()
  }, { commitment: 'confirmed' })
  const subscription = await sub.ready
  const { value: lamports } = await carbium.rpc.getBalance(wallet, { commitment: 'confirmed' })
  const started = Date.now()
  await Promise.race([first, new Promise((resolve) => setTimeout(resolve, waitMs).unref())])
  const waitedMs = Date.now() - started
  await sub.unsubscribe()
  socket.close()
  console.log(JSON.stringify({ wallet, subscription, lamports, waitedMs, notification }))
} catch (error) {
  if (!isCarbiumError(error)) throw error
  console.error(JSON.stringify({ status: error.httpStatus, code: error.code, message: error.message }))
  process.exit(1)
}
