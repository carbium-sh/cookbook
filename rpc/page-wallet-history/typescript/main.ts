// Page through a wallet's history. getSignaturesForAddress pages with a before cursor: the last signature of a page.
// getTransactionsForAddress pages with the paginationToken of its answer, null on the last page.
import { createCarbium, isCarbiumError } from '@carbium/sdk'

const apiKey = process.env.CARBIUM_KEY
if (!apiKey) {
  console.error('set CARBIUM_KEY to your c_serv_ key')
  process.exit(2)
}

const address = '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9'
const limit = 5
const maxPages = 2 // this example stops after two pages; raise it to read further back

try {
  const carbium = createCarbium({ apiKey })
  const pages: number[] = []
  let before: string | undefined
  let newest: string | null = null
  let oldest: string | null = null
  while (pages.length < maxPages) {
    const page = await carbium.rpc.getSignaturesForAddress(address, before ? { limit, before } : { limit })
    pages.push(page.length)
    newest ??= page[0]?.signature ?? null
    oldest = page.at(-1)?.signature ?? oldest
    if (page.length < limit) break // the last page
    before = oldest ?? undefined
  }
  // The same history in the other shape, newest first: each answer's paginationToken asks for the next page.
  const rows: number[] = []
  let paginationToken: string | null = null
  let historyFloor: number | null = null
  do {
    const page = await carbium.rpc.getTransactionsForAddress(address, paginationToken ? { limit, transactionDetails: 'signatures', paginationToken } : { limit, transactionDetails: 'signatures' })
    rows.push(page.data.length)
    paginationToken = page.paginationToken
    historyFloor = page.historyFloor ?? historyFloor
  } while (paginationToken !== null && rows.length < maxPages)
  console.log(JSON.stringify({
    address,
    pages,
    newest,
    oldest,
    // It reads only down to historyFloor, the ledger floor: an address quiet since then shows no rows here.
    transactionsForAddress: { pages: rows, more: paginationToken !== null, historyFloor },
  }))
} catch (error) {
  if (!isCarbiumError(error)) throw error
  console.error(JSON.stringify({ status: error.httpStatus, code: error.code, message: error.message }))
  process.exit(1)
}
