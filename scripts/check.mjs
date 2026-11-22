// Runs a recipe in one language and checks the last line it prints against the recipe's expect.
//   node scripts/check.mjs [language] <service>/<recipe> ...   these recipes, in this order
//   node scripts/check.mjs [language] --all                    every recipe
// One at a time, 1 s apart. Each result is one JSON line with what the example printed: PASS; RATE (a 429, tried once
// more at the end); CAP (a 402 or a suspended key: nothing is called after it); FAIL (anything else); SKIP (not run: a
// key it needs is not set, or a cap stopped the run). The exit code is 0 only when every recipe passed.
import { spawn } from 'node:child_process'
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { listRecipes, RUNNERS } from './recipes.mjs'

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function base58(bytes) {
  let n = 0n
  for (const b of bytes) n = n * 256n + BigInt(b)
  let out = ''
  for (; n > 0n; n /= 58n) out = ALPHABET[Number(n % 58n)] + out
  for (const b of bytes) {
    if (b !== 0) break
    out = '1' + out
  }
  return out
}

let built = 0
let binaries

function spawned(command, args, cwd, env, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('close', (code) => resolve({ code: code ?? 124, stdout, stderr }))
  })
}

/** Runs one language folder of a recipe with its runner; resolves with the exit code and both outputs. */
export async function run(dir, language, { env = process.env, timeoutMs = 60_000 } = {}) {
  const runner = RUNNERS[language]
  const cwd = join(dir, language)
  if (!runner.build) return spawned(runner.command[0], runner.command.slice(1), cwd, env, timeoutMs)
  if (!binaries) {
    const dir = (binaries = mkdtempSync(join(tmpdir(), 'cookbook-')))
    process.once('exit', () => rmSync(dir, { recursive: true, force: true }))
  }
  const out = join(binaries, `example-${++built}`)
  const [command, ...args] = runner.build(out)
  const compiled = await spawned(command, args, cwd, env, timeoutMs)
  if (compiled.code !== 0) return compiled
  const result = await spawned(out, [], cwd, env, timeoutMs)
  rmSync(out, { force: true })
  return result
}

/** The last non-empty line of a text when it is one JSON object, else undefined. */
export function lastObject(text) {
  try {
    const value = JSON.parse(text.trimEnd().split('\n').pop() ?? '')
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined
  } catch {
    return undefined
  }
}

// A length in the wire's compact-u16 form: one to three bytes, the shortest form only, at most 0xffff.
function compactU16(bytes, at) {
  let value = 0
  for (let i = 0; i < 3 && at + i < bytes.length; i++) {
    const b = bytes[at + i]
    if ((i > 0 && b === 0) || (i === 2 && b > 3)) return { alias: true }
    value |= (b & 0x7f) << (7 * i)
    if (!(b & 0x80)) return { value, next: at + i + 1 }
  }
  return undefined
}

/**
 * What keeps a base64 transaction from being one unsigned legacy or v0 transaction for feePayer. It walks the whole
 * wire form: one signature slot of 64 zero bytes, a header that fits the accounts, the accounts, the blockhash, every
 * instruction and, for v0, every lookup table, ending at the last byte, within 1232 bytes. The fee payer is the first
 * account. A transaction that puts its message first (v1, the guide says) is refused as one this check cannot read.
 */
export function unsignedProblems(transaction, feePayer) {
  if (typeof transaction !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(transaction)) return ['transaction is not base64']
  const bytes = Buffer.from(transaction, 'base64')
  if (bytes[0] & 0x80) return [`the transaction starts with a version ${bytes[0] & 0x7f} message, so its message comes before its signatures; this check reads legacy and v0 only`]
  let at = 0
  const take = (n) => {
    if (at + n > bytes.length) throw new RangeError('the transaction is cut short')
    at += n
    return bytes.subarray(at - n, at)
  }
  const length = () => {
    const r = compactU16(bytes, at)
    if (!r) throw new RangeError('the transaction is cut short')
    if (r.alias) throw new RangeError(`the length at byte ${at} is not a canonical compact-u16`)
    at = r.next
    return r.value
  }
  const out = []
  try {
    const slots = length()
    if (slots !== 1) return [`the transaction has ${slots} signature slots; a swap has exactly one`]
    if (take(64).some((b) => b !== 0)) out.push('signature slot 0 is not empty')
    const version = bytes[at] & 0x80 ? take(1)[0] & 0x7f : 'legacy'
    if (version !== 'legacy' && version !== 0) return [...out, `message version ${version} is not one this check reads`]
    const [signers, readonlySigners, readonlyOthers] = take(3)
    const count = length()
    const keys = take(32 * count)
    if (signers !== slots) out.push(`the message requires ${signers} signatures and the transaction has room for ${slots}`)
    if (signers > count || readonlySigners >= signers || readonlyOthers > count - signers) out.push(`the message header [${signers}, ${readonlySigners}, ${readonlyOthers}] does not fit its ${count} accounts`)
    take(32) // the blockhash
    let highest = -1
    for (let n = length(); n > 0; n--) {
      highest = Math.max(highest, take(1)[0], ...take(length())) // the program and the accounts it names
      take(length()) // the instruction data
    }
    let loaded = 0
    if (version === 0) {
      for (let n = length(); n > 0; n--) {
        take(32) // the table's address
        loaded += take(length()).length + take(length()).length // the writable and the read-only accounts it loads
      }
    }
    if (at < bytes.length) out.push(`${bytes.length - at} byte${bytes.length - at === 1 ? ' is' : 's are'} left after the end of the message`)
    if (bytes.length > 1232) out.push(`the transaction is ${bytes.length} bytes, over the 1232 a v0 transaction may be`)
    if (highest >= count + loaded) out.push(`an instruction names account ${highest}, and the message has ${count + loaded}`)
    const payer = count > 0 ? base58(keys.subarray(0, 32)) : 'nobody'
    if (payer !== feePayer) out.push(`the fee payer is ${payer}, not ${feePayer}`)
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    out.push(error.message)
  }
  return out
}

/** What is wrong with one output object against a recipe's expect. */
export function outputProblems(expect, output) {
  if (!output) return ['the last line of output is not one JSON object']
  const out = expect.keys.filter((k) => !(k in output)).map((k) => `the output has no ${k}`)
  if (expect.unsigned) out.push(...unsignedProblems(output.transaction, output.userPubkey))
  return out
}

/** Sorts one run into PASS, RATE, CAP or FAIL. A failed example prints {status, code, message} as its last stderr line. */
export function verdict({ code, stdout, stderr }, expect) {
  if (code === 0) {
    const problems = outputProblems(expect, lastObject(stdout))
    return { result: problems.length ? 'FAIL' : 'PASS', problems }
  }
  const error = lastObject(stderr) ?? {}
  const result = error.status === 429 ? 'RATE' : error.status === 402 || /suspended/i.test(String(error.message)) ? 'CAP' : 'FAIL'
  return { result, exit: code, status: error.status, code: error.code, message: error.message }
}

async function main(args) {
  const all = listRecipes()
  const language = args.find((a) => a in RUNNERS) ?? 'typescript'
  const ids = args.filter((a) => a !== '--all' && !(a in RUNNERS))
  const picked = args.includes('--all') ? all.filter((r) => r.languages.includes(language)) : ids.map((id) => all.find((r) => r.id === id))
  if (picked.length === 0 || picked.includes(undefined) || (args.includes('--all') && ids.length)) {
    console.error('usage: node scripts/check.mjs [language] (--all | <service>/<recipe> ...)')
    process.exit(2)
  }
  const results = new Map()
  let called = false
  let stopped = ''
  const once = async (r) => {
    if (called) await sleep(1000)
    called = true
    const result = await run(r.dir, language)
    const v = { recipe: r.id, language, ...verdict(result, r.recipe.expect), output: lastObject(result.stdout) }
    if (v.result === 'CAP') stopped = `${r.id} hit a cap`
    results.set(r.id, v)
  }
  for (const r of picked) {
    const missing = r.recipe.env.filter((name) => !process.env[name])
    if (stopped || missing.length) results.set(r.id, { recipe: r.id, language, result: 'SKIP', reason: `not run: ${stopped || `${missing.join(', ')} is not set`}` })
    else await once(r)
  }
  // A RATE is tried once more at the end, unless a cap stopped the run.
  for (const r of picked) if (!stopped && results.get(r.id).result === 'RATE') await once(r)
  for (const v of results.values()) console.log(JSON.stringify(v))
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = [...results.values()].map((v) => `| ${v.recipe} | ${v.result} | ${v.status ?? ''} | ${String(v.message ?? v.reason ?? v.problems?.join('; ') ?? '').replaceAll('|', '/')} |`)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, ['| Recipe | Result | HTTP | Detail |', '|---|---|---|---|', ...rows, ''].join('\n'))
  }
  // Green only when every recipe ran and passed: a SKIP is red too.
  process.exit([...results.values()].every((v) => v.result === 'PASS') ? 0 : 1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2))
