// The checker. On real output: examples run against the stand-in door and the checker reads what they printed. On the
// run loop: scripts/check.mjs runs as CI runs it, against the stand-in. Each test plants a fault and checks it is caught.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { base58, lastObject, run, unsignedProblems, verdict } from '../scripts/check.mjs'
import { listRecipes, root } from '../scripts/recipes.mjs'
import { chosenLanguages } from './languages.mjs'
import { Refusal, standIn } from './standin.mjs'
import { fromBase58, message, transaction } from './transactions.mjs'

const key = ['c_serv', `standin${randomBytes(8).toString('hex')}`].join('_')
const recipes = Object.fromEntries(listRecipes().map((r) => [r.id, r]))
const env = (port, extra = { CARBIUM_KEY: key }) => ({ PATH: process.env.PATH, HOME: process.env.HOME, STANDIN_PORT: String(port), NODE_OPTIONS: `--import=${pathToFileURL(fileURLToPath(new URL('redirect.mjs', import.meta.url)))}`, ...extra })
const zero = () => new Uint8Array(64)
// The tests below that run an example run its TypeScript version, so they are skipped when COOKBOOK_LANGUAGES leaves
// TypeScript out, as on a machine with no Node packages installed for the examples.
const languages = chosenLanguages(process.env.COOKBOOK_LANGUAGES)
const examples = { skip: languages && !languages.has('typescript') ? 'COOKBOOK_LANGUAGES leaves out typescript, whose examples these tests run' : false }

const quote = { srcAmountIn: '10000000', destAmountOut: '1092857', minAmountOut: '1087392', slippageBps: 50, swapMode: 'BaseIn', inputMint: 'So11111111111111111111111111111111111111112', outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', routePlan: [], quoteId: '4579cc7e1b1ec3ead63e9c1cbbfe8e19' }
const swapAnswer = (tx) => (params) => ({ transaction: tx(fromBase58(params.user_pubkey)), blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 1, minAmountOut: '1087392', computeUnitLimit: 161000, priorityFeeLamports: '1610', rentLamports: '1488440', ataCreates: 1 })

async function swapRun(tx) {
  const door = await standIn({ key, answers: { quote, swap: swapAnswer(tx) } })
  try {
    const r = recipes['swap/build-an-unsigned-swap']
    return { result: await run(r.dir, 'typescript', { env: env(door.port) }), expect: r.recipe.expect, calls: door.calls }
  } finally {
    door.close()
  }
}

test('base58 matches known addresses', () => {
  assert.equal(base58(new Uint8Array(32)), '11111111111111111111111111111111')
  assert.equal(base58(Buffer.from('06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9', 'hex')), 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
  assert.equal(base58(Buffer.from('06a7d51718c774c928566398691d5eb68b5eb8a39b4b6d5c73555b2100000000', 'hex')), 'SysvarC1ock11111111111111111111111111111111')
})

test('a wrong expectation fails on real output', examples, async () => {
  const door = await standIn({ key, answers: { getBalance: { context: { slot: 7 }, value: 1500000000 } } })
  try {
    const r = recipes['rpc/get-balance']
    const result = await run(r.dir, 'typescript', { env: env(door.port) })
    assert.deepEqual(door.calls, ['getBalance'])
    assert.deepEqual(lastObject(result.stdout), { wallet: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', lamports: 1500000000, sol: 1.5, slot: 7 })
    assert.deepEqual(verdict(result, { keys: [...r.recipe.expect.keys, 'owner'] }), { result: 'FAIL', problems: ['the output has no owner'] })
    assert.deepEqual(verdict({ ...result, stdout: `${result.stdout}done\n` }, r.recipe.expect), { result: 'FAIL', problems: ['the last line of output is not one JSON object'] })
    assert.deepEqual(verdict(result, r.recipe.expect), { result: 'PASS', problems: [] })
  } finally {
    door.close()
  }
})

test('one nonzero byte in a signature slot fails the unsigned check', examples, async () => {
  const signed = zero()
  signed[63] = 1
  const bad = await swapRun((payer) => transaction(message({ payer }), [signed]))
  assert.deepEqual(bad.calls, ['quote', 'swap'])
  assert.deepEqual(verdict(bad.result, bad.expect), { result: 'FAIL', problems: ['signature slot 0 is not empty'] })
  const good = await swapRun((payer) => transaction(message({ payer })))
  assert.deepEqual(verdict(good.result, good.expect), { result: 'PASS', problems: [] })
})

test('a fee payer other than the given public key fails', examples, async () => {
  const other = new Uint8Array(32).fill(3)
  const bad = await swapRun(() => transaction(message({ payer: other })))
  assert.deepEqual(verdict(bad.result, bad.expect), { result: 'FAIL', problems: [`the fee payer is ${base58(other)}, not 5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9`] })
})

test('the unsigned check walks the whole message and refuses what does not fit', () => {
  const payer = new Uint8Array(32).fill(5)
  const pk = base58(payer)
  const v0 = transaction(message({ payer }))
  const bytes = Buffer.from(v0, 'base64')
  const of = (b) => unsignedProblems(Buffer.from(b).toString('base64'), pk)
  assert.deepEqual(unsignedProblems(v0, pk), [])
  assert.deepEqual(unsignedProblems(transaction(message({ payer, version: 'legacy', instructions: [{ program: 1, accounts: [0], data: [1] }] })), pk), [])
  assert.deepEqual(of(bytes.subarray(0, 102)), ['the transaction is cut short'])
  assert.deepEqual(of(bytes.subarray(0, bytes.length - 1)), ['the transaction is cut short'])
  assert.deepEqual(of([...bytes, 0]), ['1 byte is left after the end of the message'])
  assert.deepEqual(unsignedProblems(transaction(message({ payer, header: [2, 0, 1], keys: [payer, new Uint8Array(32).fill(6), new Uint8Array(32).fill(7)] }), [zero(), zero()]), pk), ['the transaction has 2 signature slots; a swap has exactly one'])
  assert.deepEqual(unsignedProblems(transaction(message({ payer, header: [1, 1, 1] })), pk), ['the message header [1, 1, 1] does not fit its 2 accounts'])
  assert.deepEqual(unsignedProblems(transaction(message({ payer, header: [1, 0, 2] })), pk), ['the message header [1, 0, 2] does not fit its 2 accounts'])
  // The account count, 2, written as 0x82 0x00: the same value in a longer form.
  assert.deepEqual(of([...bytes.subarray(0, 69), 0x82, 0x00, ...bytes.subarray(70)]), ['the length at byte 69 is not a canonical compact-u16'])
  assert.deepEqual(unsignedProblems(transaction(message({ payer, instructions: [{ program: 4, accounts: [0], data: [] }] })), pk), ['an instruction names account 4, and the message has 3'])
  const big = transaction(message({ payer, instructions: [{ program: 1, accounts: [0], data: new Array(1200).fill(1) }] }))
  assert.deepEqual(unsignedProblems(big, pk), [`the transaction is ${Buffer.from(big, 'base64').length} bytes, over the 1232 a v0 transaction may be`])
  assert.deepEqual(unsignedProblems(transaction(message({ payer, version: 2 })), pk), ['message version 2 is not one this check reads'])
  // The guide's v1 puts the message first: its first byte is the version prefix, not a signature count.
  const first = Buffer.from(message({ payer, version: 1 }))
  assert.deepEqual(of([...first, 1, ...zero()]), ['the transaction starts with a version 1 message, so its message comes before its signatures; this check reads legacy and v0 only'])
  assert.deepEqual(unsignedProblems('not base64!', pk), ['transaction is not base64'])
})

test('a failed run is sorted by the status the example printed', () => {
  const failed = (status, message = 'rate limit exceeded') => verdict({ code: 1, stdout: '', stderr: `${JSON.stringify({ status, code: -32005, message })}\n` }, { keys: ['x'] }).result
  assert.equal(failed(429), 'RATE')
  assert.equal(failed(402), 'CAP')
  assert.equal(failed(401, 'api key suspended'), 'CAP')
  assert.equal(failed(401, 'unknown api key'), 'FAIL')
  assert.equal(failed(503), 'FAIL')
  assert.equal(verdict({ code: 1, stdout: '', stderr: 'TypeError: boom\n' }, { keys: ['x'] }).result, 'FAIL')
})

// The run loop, through the command CI runs.
function cli(args, environment) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/check.mjs', ...args], { cwd: root, env: environment })
    let stdout = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.on('close', (code) => resolve({ code, lines: stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) }))
  })
}
const rate = new Refusal(429, -32005, 'rate limit exceeded', { reason: 'RATE_LIMITED', retryAfterMs: 60000 })
const prices = { solUsd: 150, builtUnix: 1, priced: 1, stale: 0, noroute: 0, total: 1, rows: [['So11111111111111111111111111111111111111112', 150, 1, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v']] }
const balance = { context: { slot: 7 }, value: 1 }
const results = (lines) => lines.map((l) => [l.recipe, l.result, l.status ?? l.reason ?? null])

test('the run loop: a 429 is tried once more at the end, and the run is green when every recipe then passes', examples, async () => {
  const door = await standIn({ key, answers: { prices: (_, n) => (n === 1 ? rate : prices), getBalance: balance } })
  try {
    const out = await cli(['prices/read-usd-prices', 'rpc/get-balance'], env(door.port))
    assert.deepEqual(results(out.lines), [['prices/read-usd-prices', 'PASS', null], ['rpc/get-balance', 'PASS', null]])
    assert.deepEqual(door.calls, ['prices', 'getBalance', 'prices'])
    assert.equal(out.code, 0)
  } finally {
    door.close()
  }
})

test('the run loop: a 429 twice is RATE and the run is red', examples, async () => {
  const door = await standIn({ key, answers: { prices: () => rate } })
  try {
    const out = await cli(['prices/read-usd-prices'], env(door.port))
    assert.deepEqual(results(out.lines), [['prices/read-usd-prices', 'RATE', 429]])
    assert.deepEqual(door.calls, ['prices', 'prices'])
    assert.equal(out.code, 1)
  } finally {
    door.close()
  }
})

test('the run loop: a cap stops every call after it, and each recipe not run gets a SKIP line', examples, async () => {
  const door = await standIn({ key, answers: { prices: () => rate, quote: () => new Refusal(402, -32002, 'credits exhausted'), getBalance: balance } })
  try {
    const out = await cli(['prices/read-usd-prices', 'quote/quote-a-swap', 'rpc/get-balance'], env(door.port))
    assert.deepEqual(results(out.lines), [['prices/read-usd-prices', 'RATE', 429], ['quote/quote-a-swap', 'CAP', 402], ['rpc/get-balance', 'SKIP', 'not run: quote/quote-a-swap hit a cap']])
    assert.deepEqual(door.calls, ['prices', 'quote'])
    assert.equal(out.code, 1)
  } finally {
    door.close()
  }
})

test('the run loop: with no key only the keyless recipes run, on public calls, the rest are SKIP and the run is red', examples, async () => {
  const door = await standIn({ key, answers: { prices, quote, swap: swapAnswer((payer) => transaction(message({ payer }))) } })
  try {
    const out = await cli(['prices/read-usd-prices', 'rpc/get-balance', 'webhooks/verify-a-delivery'], env(door.port, {}))
    assert.deepEqual(results(out.lines), [['prices/read-usd-prices', 'PASS', null], ['rpc/get-balance', 'SKIP', 'not run: CARBIUM_KEY is not set'], ['webhooks/verify-a-delivery', 'PASS', null]])
    assert.deepEqual(door.calls, ['prices'])
    assert.equal(out.code, 1)
    const all = await cli(['--all'], env(door.port, {}))
    assert.equal(all.code, 1)
    const ids = (result) => all.lines.filter((l) => l.result === result).map((l) => l.recipe)
    assert.deepEqual(ids('SKIP'), listRecipes().filter((r) => r.recipe.env.includes('CARBIUM_KEY')).map((r) => r.id))
    assert.deepEqual(ids('PASS'), ['prices/read-usd-prices', 'quote/quote-a-swap', 'swap/build-an-unsigned-swap', 'webhooks/verify-a-delivery'])
    assert.deepEqual(door.calls, ['prices', 'prices', 'quote', 'quote', 'swap'])
  } finally {
    door.close()
  }
})

test('COOKBOOK_LANGUAGES=python runs no TypeScript example here: the seven tests that run one are skipped, the rest pass', { skip: process.env.COOKBOOK_LANGUAGES === 'python' ? 'this is the run it starts' : false }, () => {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', fileURLToPath(import.meta.url)], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, COOKBOOK_LANGUAGES: 'python' } })
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`)
  assert.equal(r.stdout.match(/# SKIP COOKBOOK_LANGUAGES leaves out typescript/g)?.length, 7, r.stdout)
  assert.match(r.stdout, /^# fail 0$/m, r.stdout)
})
