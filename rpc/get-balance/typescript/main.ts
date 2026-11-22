// Get a wallet's SOL balance with one getBalance call.
import { createCarbium, isCarbiumError } from '@carbium/sdk'

const apiKey = process.env.CARBIUM_KEY
if (!apiKey) {
  console.error('set CARBIUM_KEY to your c_serv_ key')
  process.exit(2)
}

const wallet = '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9'

try {
  const carbium = createCarbium({ apiKey })
  const { context, value } = await carbium.rpc.getBalance(wallet, { commitment: 'confirmed' })
  console.log(JSON.stringify({ wallet, lamports: value, sol: value / 1e9, slot: context.slot }))
} catch (error) {
  if (!isCarbiumError(error)) throw error
  console.error(JSON.stringify({ status: error.httpStatus, code: error.code, message: error.message }))
  process.exit(1)
}
