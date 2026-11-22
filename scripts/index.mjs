// Writes the recipe index into README.md, between its two markers, from the recipe.json files: one table per service,
// one link per language. Run it after adding or changing a recipe: node scripts/index.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listRecipes, root } from './recipes.mjs'

const SERVICES = { rpc: 'RPC', das: 'DAS', websocket: 'WebSocket', stream: 'Carbon Stream', quote: 'Quote', swap: 'Swap', prices: 'Prices', health: 'Health', webhooks: 'Webhooks', account: 'Account API', dca: 'DCA API', tokens: 'Token API' }
const LANGUAGES = { typescript: 'TypeScript', python: 'Python', rust: 'Rust', go: 'Go' }
const START = '<!-- index: written by scripts/index.mjs from the recipe.json files -->'
const END = '<!-- end of index -->'

/** The README text with its index rebuilt from these recipes. */
export function build(readme, recipes = listRecipes()) {
  const start = readme.indexOf(START)
  const end = readme.indexOf(END, start)
  if (start < 0 || end < 0) throw new Error('README.md lacks the index markers')
  const languages = Object.keys(LANGUAGES).filter((l) => recipes.some((r) => r.languages.includes(l)))
  const tables = Object.entries(SERVICES).flatMap(([service, name]) => {
    const rows = recipes.filter((r) => r.recipe.service === service)
    if (rows.length === 0) return []
    return [
      `### ${name}`,
      '',
      `| Recipe | What it does | ${languages.map((l) => LANGUAGES[l]).join(' | ')} |`,
      `|---|---|${languages.map(() => '---|').join('')}`,
      ...rows.map((r) => `| [${r.recipe.title}](${r.id}/) | ${r.recipe.summary} | ${languages.map((l) => (r.languages.includes(l) ? `[${LANGUAGES[l]}](${r.id}/${l}/)` : '')).join(' | ')} |`),
      '',
    ]
  })
  return `${readme.slice(0, start)}${START}\n\n${tables.join('\n')}\n${readme.slice(end)}`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = join(root, 'README.md')
  writeFileSync(path, build(readFileSync(path, 'utf8')))
}
