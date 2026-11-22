// Quote a swap of 0.01 SOL to USDC with one quote call. Amounts are strings in base units: lamports and USDC atoms.
import { createCarbium, isCarbiumError } from '@carbium/sdk'

const apiKey = process.env.CARBIUM_KEY
if (!apiKey) {
  console.error('set CARBIUM_KEY to your c_serv_ key')
  process.exit(2)
}

const SOL = 'So11111111111111111111111111111111111111112'
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

try {
  const carbium = createCarbium({ apiKey })
  const quote = await carbium.quote.quote({ src_mint: SOL, dst_mint: USDC, amount_in: '10000000', slippage_bps: 50 })
  console.log(JSON.stringify({
    inputMint: quote.inputMint,
    outputMint: quote.outputMint,
    inAmount: quote.srcAmountIn,
    outAmount: quote.destAmountOut, // net of the router fee
    minAmountOut: quote.minAmountOut, // the floor a swap built from this quote enforces
    route: quote.routePlan.map((leg) => `${leg.swapInfo.label} ${leg.percent}%`),
    fee: quote.platformFee ?? null,
    quoteId: quote.quoteId, // valid for 30 seconds
  }))
} catch (error) {
  if (!isCarbiumError(error)) throw error
  console.error(JSON.stringify({ status: error.httpStatus, code: error.code, message: error.message }))
  process.exit(1)
}
