// Read the USD price of a few mints with one prices call. The table behind it is rebuilt about every 30 seconds.
import { createCarbium, isCarbiumError } from '@carbium/sdk'

const mints = [
  'So11111111111111111111111111111111111111112', // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]

try {
  // CARBIUM_KEY is optional here: unset, the calls go out with no key, up to 30 a minute per IP address.
  const carbium = createCarbium({ apiKey: process.env.CARBIUM_KEY })
  const table = await carbium.quote.prices({ mints })
  // Each row is [mint, priceUsd or null, tvlUsd, quoteMint]. A mint the table does not carry is absent.
  const prices = Object.fromEntries(table.rows.map(([mint, priceUsd]) => [mint, priceUsd]))
  // stale counts the table's rows that are stale, 0 when none.
  console.log(JSON.stringify({ solUsd: table.solUsd, builtUnix: table.builtUnix, stale: table.stale, prices }))
} catch (error) {
  if (!isCarbiumError(error)) throw error
  console.error(JSON.stringify({ status: error.httpStatus, code: error.code, message: error.message }))
  process.exit(1)
}
