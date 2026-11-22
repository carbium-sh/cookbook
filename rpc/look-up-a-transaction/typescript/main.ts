// Look up a transaction and its status. A recent signature for the USDC mint stands in for yours: getSignatureStatuses
// reads its status, then getTransaction reads the transaction itself.
import { createCarbium, isCarbiumError } from '@carbium/sdk'

const apiKey = process.env.CARBIUM_KEY
if (!apiKey) {
  console.error('set CARBIUM_KEY to your c_serv_ key')
  process.exit(2)
}

const address = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC

try {
  const carbium = createCarbium({ apiKey })
  const [latest] = await carbium.rpc.getSignaturesForAddress(address, { limit: 1 })
  if (!latest) {
    console.error(JSON.stringify({ status: 200, code: null, message: 'the address has no signature to look up' }))
    process.exit(1)
  }
  const { signature } = latest
  const { value: [status] } = await carbium.rpc.getSignatureStatuses([signature], { searchTransactionHistory: true })
  // maxSupportedTransactionVersion 1: without it a version 1 transaction is refused.
  const tx = await carbium.rpc.getTransaction(signature, { encoding: 'base64', maxSupportedTransactionVersion: 1, commitment: 'confirmed' })
  console.log(JSON.stringify({
    signature,
    slot: status?.slot ?? latest.slot,
    confirmationStatus: status?.confirmationStatus ?? null,
    err: status?.err ?? null,
    blockTime: tx?.blockTime ?? null,
    version: tx?.version ?? null,
    feeLamports: tx?.meta?.fee ?? null,
    computeUnits: tx?.meta?.computeUnitsConsumed ?? null,
    bytes: tx && Array.isArray(tx.transaction) ? Buffer.from(tx.transaction[0], 'base64').length : null,
  }))
} catch (error) {
  if (!isCarbiumError(error)) throw error
  console.error(JSON.stringify({ status: error.httpStatus, code: error.code, message: error.message }))
  process.exit(1)
}
