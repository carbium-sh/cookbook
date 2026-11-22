// Read a token: its name and symbol (getAsset), its supply (getTokenSupply) and one holder's balance (getTokenAccounts).
import { createCarbium, isCarbiumError } from '@carbium/sdk'

const apiKey = process.env.CARBIUM_KEY
if (!apiKey) {
  console.error('set CARBIUM_KEY to your c_serv_ key')
  process.exit(2)
}

const mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC

try {
  const carbium = createCarbium({ apiKey })
  const asset = await carbium.das.getAsset({ id: mint })
  const metadata = asset.content?.['metadata'] as { name?: string; symbol?: string } | undefined
  const { value: supply } = await carbium.rpc.getTokenSupply(mint)
  const { token_accounts } = await carbium.das.getTokenAccounts({ mint, limit: 1 })
  const holder = token_accounts[0]
  console.log(JSON.stringify({
    mint,
    name: metadata?.name ?? null,
    symbol: metadata?.symbol ?? null,
    decimals: supply.decimals,
    supply: supply.uiAmountString,
    holder: holder ? { owner: holder.owner, tokenAccount: holder.address, amount: String(holder.amount) } : null,
  }))
} catch (error) {
  if (!isCarbiumError(error)) throw error
  console.error(JSON.stringify({ status: error.httpStatus, code: error.code, message: error.message }))
  process.exit(1)
}
