// Every example, offline. With no key it calls nothing, exits 2 and says which key to set. With a made-up key the
// stand-in door answers 401: the example exits 1, prints that status, and the key shows nowhere in what it printed.
// With the stand-in's key every call is answered, every page full: the example passes its expect and makes exactly the
// calls its recipe.json lists, in order. A recipe that reads no key runs as it is and must pass its own expect.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { lookup } from 'node:dns/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { lastObject, run, verdict } from '../scripts/check.mjs'
import { listRecipes } from '../scripts/recipes.mjs'
import { chosenLanguages } from './languages.mjs'
import { Refusal, listenProblem, standIn } from './standin.mjs'
import { certificate } from './tls.mjs'
import { fromBase58, message, transaction } from './transactions.mjs'

// Built here at run time, so the whole key is never in a file.
const canary = ['c_serv', `cookbookcanary${randomBytes(12).toString('hex')}`].join('_')
const redirect = `--import=${pathToFileURL(new URL('redirect.mjs', import.meta.url).pathname)}`
// Node loads redirect.mjs; Python loads test/python/sitecustomize.py. Both send the example's calls to the stand-in.
// Compiled examples reach it through a hosts entry for services.carbium.sh on 127.0.0.1 (set on the test side: the
// container's --add-host, or the CI runner's /etc/hosts) and the stand-in on port 443 with a certificate they trust
// through SSL_CERT_FILE. Toolchain settings pass through; no key does.
const TOOLCHAIN = ['CARGO_HOME', 'RUSTUP_HOME', 'CARGO_NET_OFFLINE', 'CARGO_TARGET_DIR', 'GOPATH', 'GOCACHE', 'GOMODCACHE', 'GOFLAGS', 'GOPROXY', 'GOTOOLCHAIN', 'GOWORK']
const COMPILED = new Set(['rust', 'go'])
const env = (port, extra = {}) => ({
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  ...Object.fromEntries(TOOLCHAIN.filter((name) => process.env[name]).map((name) => [name, process.env[name]])),
  STANDIN_PORT: String(port),
  NODE_OPTIONS: redirect,
  PYTHONPATH: fileURLToPath(new URL('python', import.meta.url)),
  PYTHONDONTWRITEBYTECODE: '1',
  // No proxy, the system's included, may carry a call around the redirect.
  NO_PROXY: '*',
  no_proxy: '*',
  ...extra,
})
// Fails closed: a compiled example runs only when services.carbium.sh resolves to 127.0.0.1 alone, so no call can leave.
async function hostsEntry() {
  const addresses = await lookup('services.carbium.sh', { all: true }).catch(() => [])
  if (addresses.length === 0 || addresses.some((a) => a.address !== '127.0.0.1')) {
    throw new Error('services.carbium.sh must resolve only to 127.0.0.1 for the Rust and Go examples: add the line "127.0.0.1 services.carbium.sh" to /etc/hosts (or run in a container with --add-host services.carbium.sh:127.0.0.1), or set COOKBOOK_LANGUAGES=typescript,python to skip them')
  }
}
async function openDoor(language, options) {
  if (COMPILED.has(language)) await hostsEntry()
  const tls = COMPILED.has(language) ? certificate() : undefined
  const door = await standIn({ ...options, ...(tls ? { tls, port: 443 } : {}) })
  door.env = (extra = {}) => env(door.port, { ...(tls ? { SSL_CERT_FILE: tls.caFile } : {}), ...extra })
  return door
}
// COOKBOOK_LANGUAGES=rust,go runs only those languages' examples, for a machine that has only their toolchains.
const languages = chosenLanguages(process.env.COOKBOOK_LANGUAGES)
const chosen = (language) => !languages || languages.has(language)

const key = ['c_serv', `standin${randomBytes(8).toString('hex')}`].join('_')
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const signature = (page, i) => `${'5'.repeat(80)}${page}x${i}`
// A page after the first must carry the cursor of the page before, or the stand-in refuses it.
const wrongCursor = new Refusal(400, -32602, 'the cursor is not the one the page before gave')
const context = { slot: 7 }
const ownership = { frozen: false, delegated: false, delegate: null, ownership_model: 'single', owner: 'owner1' }
// Answers for every call the examples make, each page full so an example reads as far as it goes.
const answers = {
  getBalance: { context, value: 1500000000 },
  getAssetsByOwner: ({ limit, page, options }, n) =>
    page !== n
      ? wrongCursor
      : { total: limit, limit, page, items: Array.from({ length: limit }, (_, i) => ({ interface: options?.showFungible && i === 0 ? 'FungibleToken' : 'V1_NFT', id: `asset${page}x${i}`, content: { metadata: { name: `Asset ${i}` } }, ownership, mutable: true, burnt: false })) },
  getAsset: { interface: 'FungibleToken', id: USDC, content: { metadata: { name: 'USD Coin', symbol: 'USDC' } }, ownership, mutable: true, burnt: false },
  getTokenSupply: { context, value: { amount: '1000000', decimals: 6, uiAmount: 1, uiAmountString: '1' } },
  getTokenAccounts: { total: 1, limit: 1, token_accounts: [{ address: 'account1', mint: USDC, owner: 'owner1', amount: 5, delegated_amount: 0, frozen: false }] },
  prices: { solUsd: 150, builtUnix: 1, priced: 1, stale: 0, noroute: 0, total: 1, rows: [['So11111111111111111111111111111111111111112', 150, 1, USDC]] },
  quote: { srcAmountIn: '10000000', destAmountOut: '1092857', minAmountOut: '1087392', slippageBps: 50, swapMode: 'BaseIn', inputMint: 'So11111111111111111111111111111111111111112', outputMint: USDC, routePlan: [{ hop: 0, percent: '100', swapInfo: { ammKey: 'pool1', label: 'm-dlmm', inputMint: 'So11111111111111111111111111111111111111112', outputMint: USDC, inAmount: '9995000', outAmount: '1092857' } }], quoteId: '4579cc7e1b1ec3ead63e9c1cbbfe8e19' },
  swap: ({ user_pubkey }) => ({ transaction: transaction(message({ payer: fromBase58(user_pubkey) })), blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 1, minAmountOut: '1087392', computeUnitLimit: 161000, priorityFeeLamports: '1610', rentLamports: '1488440', ataCreates: 1 }),
  getSignaturesForAddress: ([, { limit, before }], n) =>
    n > 1 && before !== signature(n - 1, limit - 1) ? wrongCursor : Array.from({ length: limit }, (_, i) => ({ signature: signature(n, i), slot: 7, err: null, memo: null, blockTime: 1, confirmationStatus: 'finalized' })),
  getSignatureStatuses: { context, value: [{ slot: 7, confirmations: null, err: null, confirmationStatus: 'finalized' }] },
  getTransaction: { slot: 7, blockTime: 1, version: 0, transaction: [transaction(message({ payer: new Uint8Array(32).fill(5) })), 'base64'], meta: { err: null, fee: 5000, preBalances: [], postBalances: [], computeUnitsConsumed: 100 } },
  getTransactionsForAddress: ([, { limit, paginationToken }], n) =>
    n > 1 && paginationToken !== `page${n}` ? wrongCursor : { data: Array.from({ length: limit }, (_, i) => ({ signature: signature(n, i), slot: 7, err: null, memo: null, blockTime: 1 })), paginationToken: `page${n + 1}` },
}
const notification = { context, value: { signature: signature(1, 0), err: null, logs: [] } }

/** True when a text holds the key, or the part after its prefix. */
const leaks = (text, key) => text.includes(key) || text.includes(key.slice('c_serv_'.length))

test('the canary scan catches the canary in a planted line', () => {
  assert.equal(leaks(`starting\nusing ${canary}\n`, canary), true)
  assert.equal(leaks(`key c_serv_...${canary.slice(7)}`, canary), true)
  assert.equal(leaks('starting\n{"status":401}\n', canary), false)
})

for (const r of listRecipes()) {
  for (const language of r.languages.filter(chosen)) {
    if (!r.recipe.env.includes('CARBIUM_KEY')) {
      test(`${r.id} (${language}) needs no key and passes its expect`, async () => {
        const door = await openDoor(language, { key: 'none' })
        try {
          const result = await run(r.dir, language, { env: door.env() })
          assert.deepEqual(verdict(result, r.recipe.expect), { result: 'PASS', problems: [] })
          assert.deepEqual(door.calls, [])
        } finally {
          door.close()
        }
      })
      continue
    }

    test(`${r.id} (${language}) with no key calls nothing and exits 2`, async () => {
      const door = await openDoor(language, { key: 'none' })
      try {
        const result = await run(r.dir, language, { env: door.env() })
        assert.equal(result.code, 2)
        assert.equal(result.stderr.trim(), 'set CARBIUM_KEY to your c_serv_ key')
        assert.equal(result.stdout, '')
        assert.deepEqual(door.calls, [])
      } finally {
        door.close()
      }
    })

    test(`${r.id} (${language}) with a refused key exits 1 with the 401 and never prints the key`, async () => {
      const door = await openDoor(language, { key: 'another key' })
      try {
        const result = await run(r.dir, language, { env: door.env({ CARBIUM_KEY: canary }) })
        assert.equal(result.code, 1)
        // The first call listed in recipe.json reaches the door, is refused, and nothing follows it.
        assert.deepEqual(door.calls, [r.recipe.calls[0].endsWith('Subscribe') ? 'websocket handshake' : r.recipe.calls[0]])
        const error = lastObject(result.stderr)
        // One line on stderr, the error object, printed once.
        const lines = result.stderr.trimEnd().split('\n')
        assert.equal(lines.length, 1, `stderr holds ${lines.length} lines`)
        assert.deepEqual(JSON.parse(lines[0]), error)
        assert.equal(error?.status, 401)
        assert.equal(typeof error?.message, 'string')
        assert.deepEqual(Object.keys(error), ['status', 'code', 'message'])
        assert.equal(result.stdout, '')
        assert.equal(leaks(result.stdout + result.stderr, canary), false)
      } finally {
        door.close()
      }
    })

    test(`${r.id} (${language}) makes exactly the calls its recipe.json lists`, async () => {
      const door = await openDoor(language, { key, answers, socket: { notification } })
      try {
        const result = await run(r.dir, language, { env: door.env({ CARBIUM_KEY: key }) })
        assert.deepEqual(verdict(result, r.recipe.expect), { result: 'PASS', problems: [] })
        assert.deepEqual(door.calls, r.recipe.calls)
      } finally {
        door.close()
      }
    })
  }
}

const recipe = (id) => listRecipes().find((x) => x.id === id)

for (const language of recipe('websocket/follow-a-wallet').languages.filter(chosen)) test(`websocket/follow-a-wallet (${language}) reports a socket the server closes for good after the ack, and exits 1`, async () => {
  const door = await openDoor(language, { key, answers, socket: { close: [1008, 'key_revoked'] } })
  try {
    const r = recipe('websocket/follow-a-wallet')
    const result = await run(r.dir, language, { env: door.env({ CARBIUM_KEY: key }) })
    assert.equal(result.code, 1)
    assert.equal(result.stdout, '')
    const error = lastObject(result.stderr)
    assert.deepEqual([error?.status, error?.code], [0, 1008])
    assert.match(error?.message ?? '', /key_revoked/)
  } finally {
    door.close()
  }
})

for (const language of recipe('das/list-wallet-assets').languages.filter(chosen)) test(`das/list-wallet-assets (${language}) asks for the tokens a wallet holds, not only its NFTs`, async () => {
  const door = await openDoor(language, { key, answers })
  try {
    const r = recipe('das/list-wallet-assets')
    const output = lastObject((await run(r.dir, language, { env: door.env({ CARBIUM_KEY: key }) })).stdout)
    assert.deepEqual([...new Set(output?.assets.map((a) => a.interface))], ['FungibleToken', 'V1_NFT'])
  } finally {
    door.close()
  }
})

for (const language of recipe('websocket/follow-a-wallet').languages.filter(chosen)) test(`websocket/follow-a-wallet (${language}) prints the notification that came with the acknowledgement`, async () => {
  const door = await openDoor(language, { key, answers, socket: { notification } })
  try {
    const result = await run(recipe('websocket/follow-a-wallet').dir, language, { env: door.env({ CARBIUM_KEY: key }) })
    assert.deepEqual(lastObject(result.stdout)?.notification, { slot: 7, signature: signature(1, 0), failed: false })
  } finally {
    door.close()
  }
})

for (const language of recipe('websocket/follow-a-wallet').languages.filter(chosen)) test(`websocket/follow-a-wallet (${language}) exits 1 with a fatal close that comes during its wait`, async () => {
  // Three runs: which of the close and the end of the wait an example sees first can vary from run to run.
  for (let i = 0; i < 3; i++) {
    const door = await openDoor(language, { key, answers, socket: { closeAfter: { call: 'getBalance', close: [1008, 'key_revoked'] } } })
    try {
      const result = await run(recipe('websocket/follow-a-wallet').dir, language, { env: door.env({ CARBIUM_KEY: key }) })
      assert.deepEqual(door.calls.slice(0, 2), ['logsSubscribe', 'getBalance'])
      assert.equal(result.code, 1, `run ${i + 1} exited ${result.code}`)
      assert.equal(result.stdout, '')
      const error = lastObject(result.stderr)
      assert.deepEqual([error?.status, error?.code], [0, 1008])
      assert.match(error?.message ?? '', /key_revoked/)
    } finally {
      door.close()
    }
  }
})

test('COOKBOOK_LANGUAGES takes runner names only, trimmed, and names the valid ones otherwise', () => {
  assert.equal(chosenLanguages(undefined), null)
  assert.deepEqual([...chosenLanguages('typescript, rust ,go')], ['typescript', 'rust', 'go'])
  assert.throws(() => chosenLanguages('golang'), { message: 'COOKBOOK_LANGUAGES names golang, which is no runner; use any of typescript, python, rust, go' })
})

test('the stand-in rejects, with what to do, when it cannot listen', { timeout: 10_000 }, async () => {
  const taken = createServer()
  await new Promise((resolve) => taken.listen(0, '127.0.0.1', resolve))
  try {
    const { port } = taken.address()
    await assert.rejects(standIn({ key, port }), { message: `the stand-in cannot listen on 127.0.0.1:${port}: EADDRINUSE` })
  } finally {
    taken.close()
  }
  assert.match(listenProblem(443, 'EACCES'), /^the stand-in cannot listen on 127\.0\.0\.1:443: EACCES\. .*ip_unprivileged_port_start=443.*127\.0\.0\.1 services\.carbium\.sh.*COOKBOOK_LANGUAGES=typescript,python/)
})

test('the certificate leaves no file behind: the authority key goes once the leaf is signed, the folder at exit', () => {
  const temp = mkdtempSync(join(tmpdir(), 'cookbook-temp-test-'))
  try {
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', "import { readdirSync } from 'node:fs'; import { dirname } from 'node:path'; import { certificate } from './test/tls.mjs'; console.log(JSON.stringify(readdirSync(dirname(certificate().caFile)).sort()))"], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...process.env, TMPDIR: temp }, encoding: 'utf8' })
    assert.equal(child.status, 0, child.stderr)
    assert.ok(!JSON.parse(child.stdout).includes('ca-key.pem'), 'the authority key is deleted once the leaf is signed')
    assert.deepEqual(readdirSync(temp), [], 'the folder is gone when the process exits')
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

if (chosen('go')) test('the checker leaves no binary behind', () => {
  const temp = mkdtempSync(join(tmpdir(), 'cookbook-temp-test-'))
  try {
    const child = spawnSync(process.execPath, ['scripts/check.mjs', 'go', 'webhooks/verify-a-delivery'], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: { ...env(0), TMPDIR: temp }, encoding: 'utf8' })
    assert.equal(child.status, 0, child.stderr)
    assert.equal(lastObject(child.stdout)?.result, 'PASS')
    assert.deepEqual(readdirSync(temp), [])
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

// A proxy the machine sets (here through the environment, as urllib and the others read it) must not carry a call
// around the redirect: the tests set NO_PROXY to '*'.
for (const language of recipe('websocket/follow-a-wallet').languages.filter(chosen)) test(`websocket/follow-a-wallet (${language}) reaches the stand-in even with a proxy set`, async () => {
  const door = await openDoor(language, { key, answers })
  try {
    const dead = 'http://127.0.0.1:9'
    const result = await run(recipe('websocket/follow-a-wallet').dir, language, { env: door.env({ CARBIUM_KEY: key, HTTPS_PROXY: dead, HTTP_PROXY: dead, ALL_PROXY: dead, https_proxy: dead, http_proxy: dead, all_proxy: dead }) })
    assert.deepEqual(door.calls, recipe('websocket/follow-a-wallet').recipe.calls)
    assert.equal(result.code, 0, result.stderr)
  } finally {
    door.close()
  }
})
