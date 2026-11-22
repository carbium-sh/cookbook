// Transactions for the tests, built byte by byte from the wire format: signatures, then the message (legacy or v0).

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function fromBase58(text) {
  let n = 0n
  for (const c of text) n = n * 58n + BigInt(ALPHABET.indexOf(c))
  const out = []
  for (; n > 0n; n >>= 8n) out.unshift(Number(n & 255n))
  for (const c of text) {
    if (c !== '1') break
    out.unshift(0)
  }
  return Uint8Array.from(out)
}

/** A length in the wire's compact-u16 form, the shortest one. */
export const length = (n) => (n < 0x80 ? [n] : n < 0x4000 ? [(n & 0x7f) | 0x80, n >> 7] : [(n & 0x7f) | 0x80, ((n >> 7) & 0x7f) | 0x80, n >> 14])

const program = new Uint8Array(32).fill(7)
const table = new Uint8Array(32).fill(8)
const blockhash = new Uint8Array(32).fill(9)

/** The message bytes: a version prefix for v0, the header, the accounts, the blockhash, instructions and, for v0, lookup tables. */
export function message({ payer, version = 0, header = [1, 0, 1], keys = [payer, program], instructions = [{ program: 1, accounts: [0, 2], data: [2, 64, 13, 3, 0] }], lookups = [{ writable: [0], readonly: [] }] }) {
  return Uint8Array.from([
    ...(version === 'legacy' ? [] : [0x80 | version]),
    ...header,
    ...length(keys.length),
    ...keys.flatMap((k) => [...k]),
    ...blockhash,
    ...length(instructions.length),
    ...instructions.flatMap((i) => [i.program, ...length(i.accounts.length), ...i.accounts, ...length(i.data.length), ...i.data]),
    ...(version === 'legacy' ? [] : [...length(lookups.length), ...lookups.flatMap((t) => [...table, ...length(t.writable.length), ...t.writable, ...length(t.readonly.length), ...t.readonly])]),
  ])
}

/** A whole transaction in base64: the signature count, each 64-byte slot, then the message. */
export function transaction(msg, slots = [new Uint8Array(64)]) {
  return Buffer.from([...length(slots.length), ...slots.flatMap((s) => [...s]), ...msg]).toString('base64')
}
