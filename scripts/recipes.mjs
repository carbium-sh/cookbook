// Finds every recipe (a folder <service>/<recipe>/ holding recipe.json) and lists what is wrong with one.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'

export const root = fileURLToPath(new URL('..', import.meta.url))

// How each language runs: the file a folder must hold and the command run inside it. A new language is one entry here.
// build, when set, compiles the folder to the path it is given first, and that file is what runs.
export const RUNNERS = {
  typescript: { file: 'main.ts', command: ['node', 'main.ts'] },
  python: { file: 'main.py', command: ['python', 'main.py'] },
  rust: { file: 'src/main.rs', command: ['cargo', 'run', '--quiet'] },
  // go run reports a failing exit as "exit status N" on stderr and exits 1 whatever N was, so the example is built first.
  go: { file: 'main.go', build: (out) => ['go', 'build', '-o', out, '.'] },
}

const json = (path) => JSON.parse(readFileSync(path, 'utf8'))
const validate = new Ajv2020({ allErrors: true }).compile(json(join(root, 'recipe.schema.json')))
const served = json(join(root, 'spec/served.json'))
// The calls services.carbium.sh answers; each served subscription comes with its unsubscribe.
const DOOR = new Set([...served.rpc, ...served.ws, ...served.ws.map((s) => s.replace(/Subscribe$/, 'Unsubscribe')), ...served.stream.filters, ...served.stream.unary])
export const SERVED = new Set([...DOOR, ...served.dca, ...served.tokens])
// The door's calls it answers with no key (carbium.sh/skill.md, Endpoints and auth), 30 a minute per IP address in all.
export const PUBLIC = new Set(['quote', 'swap', 'prices', 'health', 'getHealth', 'getVersion', 'getSlot', 'getBlockHeight', 'getEpochInfo', 'getLatestBlockhash', 'isBlockhashValid', 'getGenesisHash'])
// A recipe builds at most an unsigned transaction: these calls send one.
const SENDS = new Set(['sendTransaction', 'POST /send'])

const folders = (dir) => readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules').map((d) => d.name)

/** Every recipe as { id: '<service>/<recipe>', dir, recipe, languages: the folders present }, sorted by id. */
export function listRecipes(base = root) {
  const out = []
  for (const service of folders(base)) {
    for (const name of folders(join(base, service))) {
      const dir = join(base, service, name)
      if (existsSync(join(dir, 'recipe.json'))) out.push({ id: `${service}/${name}`, dir, recipe: json(join(dir, 'recipe.json')), languages: folders(dir) })
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

/** The problems of one recipe: its schema, its folder, its calls against served.json (only public ones without CARBIUM_KEY) and its languages against its folders. */
export function recipeProblems({ id, dir, recipe, languages }) {
  const out = validate(recipe) ? [] : validate.errors.map((e) => `${id}: ${e.instancePath || 'recipe.json'} ${e.message}${e.params.additionalProperty ? `: ${e.params.additionalProperty}` : ''}`)
  const service = id.split('/')[0]
  if (recipe.service !== service) out.push(`${id}: service is ${recipe.service} but the recipe sits in ${service}/`)
  for (const call of new Set(recipe.calls ?? [])) {
    if (!SERVED.has(call)) out.push(`${id}: ${call} is not served`)
    else if (SENDS.has(call)) out.push(`${id}: ${call} sends a transaction, and no recipe sends one`)
    else if (Array.isArray(recipe.env) && !recipe.env.includes('CARBIUM_KEY') && DOOR.has(call) && !PUBLIC.has(call)) out.push(`${id}: ${call} needs a key, and the recipe does not need CARBIUM_KEY`)
  }
  const want = [...(recipe.languages ?? [])].sort().join(', ')
  const have = [...languages].sort().join(', ')
  if (want !== have) out.push(`${id}: languages lists ${want || 'none'} but the folders are ${have || 'none'}`)
  for (const language of languages) {
    const runner = RUNNERS[language]
    if (!runner) out.push(`${id}: no runner for ${language}`)
    else if (!existsSync(join(dir, language, runner.file))) out.push(`${id}: ${language}/${runner.file} is missing`)
  }
  if (recipe.expect?.unsigned && !['transaction', 'userPubkey'].every((k) => recipe.expect.keys?.includes(k))) out.push(`${id}: an unsigned check needs transaction and userPubkey in expect.keys`)
  if (!existsSync(join(dir, 'README.md'))) out.push(`${id}: README.md is missing`)
  return out
}
