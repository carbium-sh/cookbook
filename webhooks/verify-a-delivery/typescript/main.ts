// Verify a webhook delivery, offline. A delivery is a POST whose webhook-signature header carries an HMAC-SHA256 of
// webhook-id.webhook-timestamp.body under the webhook's secret. This example makes a made-up secret and a sample
// delivery in the shape of carbium.sh's test event, checks it with the SDK's verifyWebhook, then shows the same
// delivery with one byte changed being refused. In your receiver, take the secret from CARBIUM_WEBHOOK_SECRET and pass
// the raw body bytes as they arrived.
import { createHmac, randomBytes } from 'node:crypto'
import { isCarbiumError } from '@carbium/sdk'
import { verifyWebhook } from '@carbium/sdk/webhooks'

// carbium.sh shows a webhook's secret once, when you create or rotate the webhook: whsec_ and then base64.
const secret = `whsec_${randomBytes(24).toString('base64')}`

// The sample delivery: the body and the three headers carbium.sh sends.
const timestamp = String(Math.floor(Date.now() / 1000))
const body = Buffer.from(JSON.stringify([{ slot: 0, blockTime: Number(timestamp), indexWithinBlock: 0, signature: '1'.repeat(64), err: null, status: { Ok: null }, test: true }]))
const webhookId = `evt_test_${randomBytes(8).toString('hex')}`
const key = Buffer.from(secret.slice('whsec_'.length), 'base64')
const signature = createHmac('sha256', key).update(`${webhookId}.${timestamp}.`).update(body).digest('base64')
const headers = { 'webhook-id': webhookId, 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}` }

try {
  const events = await verifyWebhook(body, headers, secret)
  // One byte changed: "slot":0 becomes "slot":1.
  const changed = Buffer.from(body.toString().replace('"slot":0', '"slot":1'))
  const refused = await verifyWebhook(changed, headers, secret).then(() => 'accepted', (e) => (isCarbiumError(e) ? e.reason : 'error'))
  if (refused !== 'no_match') {
    console.error(JSON.stringify({ status: 0, code: refused, message: 'a delivery with one byte changed was not refused' }))
    process.exit(1)
  }
  console.log(JSON.stringify({ webhookId, events: events.length, test: events[0]?.test === true, changedByte: refused }))
} catch (error) {
  if (!isCarbiumError(error)) throw error
  console.error(JSON.stringify({ status: error.httpStatus, code: error.reason ?? error.code, message: error.message }))
  process.exit(1)
}
