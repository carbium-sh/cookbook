// The recipe index in README.md is exactly what scripts/index.mjs writes from the recipe.json files.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { build } from '../scripts/index.mjs'
import { listRecipes } from '../scripts/recipes.mjs'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

test('the committed README index is exactly what the builder writes', () => {
  const edited = readme.replace('| [', '| [Edited by hand ')
  assert.notEqual(edited, readme)
  assert.notEqual(build(edited), edited)
  assert.equal(build(readme), readme)
})

test('the index links every recipe and each of its languages', () => {
  const recipes = listRecipes()
  const less = build(readme, recipes.slice(1))
  assert.ok(!less.includes(`(${recipes[0].id}/)`), 'a recipe left out must not be linked')
  for (const r of recipes) {
    assert.ok(readme.includes(`[${r.recipe.title}](${r.id}/)`), r.id)
    for (const l of r.languages) assert.ok(readme.includes(`(${r.id}/${l}/)`), `${r.id} ${l}`)
  }
})
