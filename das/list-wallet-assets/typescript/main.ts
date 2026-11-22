// List a wallet's tokens and NFTs, page by page, with getAssetsByOwner. showFungible adds the tokens it holds.
import { createCarbium, isCarbiumError } from '@carbium/sdk'

const apiKey = process.env.CARBIUM_KEY
if (!apiKey) {
  console.error('set CARBIUM_KEY to your c_serv_ key')
  process.exit(2)
}

const owner = 'DFFiJgCASVfPEQgRkrjkYAPGtFyo2pygx9aGp5XpMT9H'
const limit = 10
const maxPages = 2 // this example stops after two pages; raise it to read everything

try {
  const carbium = createCarbium({ apiKey })
  const assets: Array<{ id: string; interface: string; name: string | null }> = []
  let pagesRead = 0
  let nextPage: number | null = 1
  while (nextPage !== null && pagesRead < maxPages) {
    const { items } = await carbium.das.getAssetsByOwner({ ownerAddress: owner, limit, page: nextPage, sortBy: { sortBy: 'id', sortDirection: 'asc' }, options: { showFungible: true } })
    for (const a of items) {
      const metadata = a.content?.['metadata'] as { name?: string } | undefined
      assets.push({ id: a.id, interface: a.interface, name: metadata?.name || null })
    }
    pagesRead++
    // A page shorter than the limit is the last one.
    nextPage = items.length < limit ? null : nextPage + 1
  }
  console.log(JSON.stringify({ owner, limit, pagesRead, nextPage, assets }))
} catch (error) {
  if (!isCarbiumError(error)) throw error
  console.error(JSON.stringify({ status: error.httpStatus, code: error.code, message: error.message }))
  process.exit(1)
}
