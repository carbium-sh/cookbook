// The benchmark script, offline: it runs as a user runs it, against the stand-in door through redirect.mjs, with a key
// made at run time. It reads only CARBIUM_KEY, takes no argument, calls one fixed list of served reads one at a time at
// least 200 ms apart, stops at the first refusal and never prints the key.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SERVED, root } from '../scripts/recipes.mjs'
import { Refusal, standIn } from './standin.mjs'

const SCRIPT = fileURLToPath(new URL('../benchmark/benchmark.mjs', import.meta.url))
const key = ['c_serv', `bench${randomBytes(10).toString('hex')}`].join('_')
const METHODS = ['getSlot', 'getLatestBlockhash', 'getHealth', 'getVersion', 'getBlockHeight', 'getEpochInfo', 'getGenesisHash',
  'getAgGenesisCert', 'getIdentity', 'getTransactionCount', 'getStakeMinimumDelegation', 'getInflationGovernor', 'getInflationRate',
  'getEpochSchedule', 'getSlotLeader', 'getHighestSnapshotSlot', 'getMaxRetransmitSlot', 'getMaxShredInsertSlot', 'minimumLedgerSlot',
  'getFirstAvailableBlock', 'getBalance', 'getMinimumBalanceForRentExemption', 'isBlockhashValid', 'getBlockCommitment',
  'getRecentPerformanceSamples', 'getRecentPrioritizationFees', 'getSlotLeaders', 'getBlockProduction', 'getBlockTime', 'getVoteAccounts',
  'getAccountInfo', 'getTokenSupply', 'getMultipleAccounts', 'getTokenAccountBalance']
const redirect = `--import=${pathToFileURL(fileURLToPath(new URL('redirect.mjs', import.meta.url)))}`
const env = (port, extra) => ({ PATH: process.env.PATH, HOME: process.env.HOME, STANDIN_PORT: String(port), NODE_OPTIONS: redirect, NO_PROXY: '*', no_proxy: '*', ...extra })
const leaks = (text, k) => text.includes(k) || text.includes(k.slice('c_serv_'.length))

function bench(port, extra, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { cwd: root, env: env(port, extra) })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

// An answer for every method the script reads; `times` gets each call's arrival at the door, `refuse` replaces answers
// (a value, or a promise of one).
function answers(times, refuse = {}) {
  const result = (m) => (m === 'getSlot' ? 400000000 : m === 'getLatestBlockhash' ? { context: { slot: 1 }, value: { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 1 } } : 1)
  return Object.fromEntries(METHODS.map((m) => [m, (params, n) => {
    times.push(performance.now())
    return refuse[m] ? refuse[m](n) : result(m)
  }]))
}
const upTo = (m, n) => METHODS.slice(0, METHODS.indexOf(m)).flatMap((x) => Array(11).fill(x)).concat(Array(n).fill(m))

async function run(extra, { refuse = {}, args = [], doorKey = key } = {}) {
  const times = []
  const door = await standIn({ key: doorKey, answers: answers(times, refuse) })
  try {
    return { ...(await bench(door.port, extra, args)), calls: door.calls, times }
  } finally {
    door.close()
  }
}

test('with no key, or one that is not a service key, it calls nothing and exits 2', async () => {
  const account = ['c_acct', randomBytes(8).toString('hex')].join('_')
  for (const value of [undefined, '', '   ', account, `${key} extra`, `${key}!`]) {
    const r = await run(value === undefined ? {} : { CARBIUM_KEY: value })
    assert.equal(r.code, 2, `CARBIUM_KEY=${JSON.stringify(value)}`)
    assert.deepEqual(r.calls, [])
    assert.equal(r.stdout, '')
    assert.match(r.stderr, /^set CARBIUM_KEY to your own service key \(c_serv_\.\.\.\), on one line\n$/)
    const given = value?.trim().split(' ')[0]
    if (given) assert.ok(!leaks(r.stderr, given), 'the refusal printed the key')
  }
})

test('an argument is refused before any call, and is never echoed', async () => {
  for (const args of [['--key', key], [`--key=${key}`], [key], ['--rate', '100']]) {
    const r = await run({ CARBIUM_KEY: key }, { args })
    assert.equal(r.code, 2, args.join(' '))
    assert.deepEqual(r.calls, [])
    assert.equal(r.stdout, '')
    assert.match(r.stderr, /^this script takes no argument: set CARBIUM_KEY and run it alone\n$/)
    assert.ok(!leaks(r.stderr, key) && !r.stderr.includes('100'), 'the refusal echoed the argument')
  }
})

test('a refused key stops the run at its first call, and the key is never printed', async () => {
  const r = await run({ CARBIUM_KEY: key }, { doorKey: ['c_serv', 'anotherkey'].join('_') })
  assert.equal(r.code, 3)
  assert.deepEqual(r.calls, ['getSlot'])
  assert.match(r.stderr, /^stopped at getSlot: HTTP 401 \(UNKNOWN_KEY\), the key was refused\n$/)
  assert.ok(!leaks(r.stdout + r.stderr, key))
})

test('a 429 or a 402 ends the run at once, and nothing is retried', async () => {
  const rate = await run({ CARBIUM_KEY: key }, { refuse: { getHealth: () => new Refusal(429, -32005, 'rate limit exceeded', { reason: 'RATE_LIMITED' }) } })
  assert.equal(rate.code, 4)
  assert.deepEqual(rate.calls, [...Array(11).fill('getSlot'), ...Array(11).fill('getLatestBlockhash'), 'getHealth'])
  assert.match(rate.stderr, /^stopped at getHealth: HTTP 429 \(RATE_LIMITED\), the rate was refused: wait before the next run\n$/)
  const credits = await run({ CARBIUM_KEY: key }, { refuse: { getSlot: () => new Refusal(402, -32002, 'credits exhausted', { reason: 'CREDITS_EXHAUSTED' }) } })
  assert.equal(credits.code, 3)
  assert.deepEqual(credits.calls, ['getSlot'])
  assert.match(credits.stderr, /HTTP 402 \(CREDITS_EXHAUSTED\), the account is out of credits/)
})

test('a 5xx counts as one of that method\'s tries and is not sent again', async () => {
  const r = await run({ CARBIUM_KEY: key }, { refuse: {
    getHealth: () => new Refusal(503, -32005, 'unavailable'),
    getVersion: () => new Refusal(429, -32005, 'rate limit exceeded', { reason: 'RATE_LIMITED' }),
  } })
  assert.equal(r.code, 4)
  assert.deepEqual(r.calls, upTo('getVersion', 1))
})

test('a full run: 374 served reads in a fixed order, one at a time at least 200 ms apart, whatever the environment asks', async () => {
  // A key body echoed in an answer is masked like the whole key.
  const echo = () => new Refusal(200, -32000, `echoed ${key.slice('c_serv_'.length)}`)
  // One answer held for 500 ms: the next call must not leave before it, so the calls never overlap.
  let held
  const slow = (n) => (n === 1 ? new Promise((resolve) => setTimeout(() => { held = performance.now(); resolve(1) }, 500)) : 1)
  const r = await run({ CARBIUM_KEY: key, GAP_MS: '0', CARBIUM_GAP_MS: '0', WARM: '100', CARBIUM_HOST: 'example.com' }, { refuse: { getHealth: echo, getVersion: slow } })
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(r.calls, METHODS.flatMap((m) => Array(11).fill(m)))
  for (const m of METHODS) assert.ok(SERVED.has(m), `${m} is not a served method`)
  // Arrival times at the door: one late arrival shortens the next gap, so the rate is read over the whole run, which
  // spans the 373 starts the script spaces at least 200 ms apart; no two calls arrive together.
  const gaps = r.times.slice(1).map((t, i) => t - r.times[i])
  assert.ok(Math.min(...gaps) >= 100, `two calls ${Math.min(...gaps).toFixed(1)} ms apart`)
  assert.ok(r.times.at(-1) - r.times[0] >= 373 * 200, `374 calls in ${(r.times.at(-1) - r.times[0]).toFixed(0)} ms`)
  const first = upTo('getVersion', 1).length
  assert.ok(r.times[first] >= held, 'a call left before the answer to the one before it')
  const lines = r.stdout.trimEnd().split('\n')
  assert.equal(lines[0], 'times from this machine to services.carbium.sh with your key, one call at a time')
  assert.match(lines[1], /^method +served +p50 ms +p90 ms$/)
  assert.equal(lines.length, 2 + METHODS.length + 1)
  assert.match(lines.at(-1), /^services\.carbium\.sh: 374 calls in \d+ s$/)
  assert.match(lines.find((l) => l.startsWith('getHealth')), /^getHealth +0\/10 +- +- +-32000 echoed \*\*\*$/)
  assert.ok(!leaks(r.stdout + r.stderr, key), 'the key reached the output')
})
