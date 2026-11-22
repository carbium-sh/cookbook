// Builds an unsigned transaction for your own wallet to sign. This example holds no private key, signs nothing and sends nothing.
//
// Quotes 0.01 SOL to USDC, builds the swap for one wallet's public key, and prints what that wallet would pay.
import { createCarbium, isCarbiumError } from '@carbium/sdk'

const apiKey = process.env.CARBIUM_KEY
if (!apiKey) {
  console.error('set CARBIUM_KEY to your c_serv_ key')
  process.exit(2)
}

const SOL = 'So11111111111111111111111111111111111111112'
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
// The wallet that would sign and pay the fees. Put your own public key here.
const userPubkey = '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9'

try {
  const carbium = createCarbium({ apiKey })
  const quote = await carbium.quote.quote({ src_mint: SOL, dst_mint: USDC, amount_in: '10000000', slippage_bps: 50 })
  const swap = await carbium.quote.swap({ quote_id: quote.quoteId, user_pubkey: userPubkey })
  console.log(JSON.stringify({
    userPubkey,
    inAmount: quote.srcAmountIn,
    outAmount: quote.destAmountOut,
    minAmountOut: swap.minAmountOut,
    signatureFeeLamports: '5000',
    priorityFeeLamports: swap.priorityFeeLamports,
    rentLamports: swap.rentLamports,
    lastValidBlockHeight: swap.lastValidBlockHeight,
    // Base64. Decode it as a VersionedTransaction and sign it with your own wallet.
    transaction: swap.transaction,
  }))
} catch (error) {
  if (!isCarbiumError(error)) throw error
  console.error(JSON.stringify({ status: error.httpStatus, code: error.code, message: error.message }))
  process.exit(1)
}
