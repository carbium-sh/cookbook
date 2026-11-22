// Every recipe fits recipe.schema.json, names only served calls and lists exactly the language folders it has.
// Each test first plants one problem in a copy and checks that exact problem is caught.
import test from 'node:test'
import assert from 'node:assert/strict'
import { listRecipes, recipeProblems } from '../scripts/recipes.mjs'

const recipes = listRecipes()
const balance = recipes.find((r) => r.id === 'rpc/get-balance')
const swap = recipes.find((r) => r.id === 'swap/build-an-unsigned-swap')
const planted = (r, change) => {
  const copy = structuredClone(r)
  change(copy)
  return recipeProblems(copy)
}

test('a recipe.json with a key the schema does not allow fails', () => {
  assert.deepEqual(planted(balance, (r) => (r.recipe.order = 1)), ['rpc/get-balance: recipe.json must NOT have additional properties: order'])
  assert.deepEqual(planted(balance, (r) => (r.recipe.expect.values = {})), ['rpc/get-balance: /expect must NOT have additional properties: values'])
  assert.deepEqual(planted(balance, (r) => delete r.recipe.summary), ["rpc/get-balance: recipe.json must have required property 'summary'"])
})

test('a call that served.json does not list fails', () => {
  assert.deepEqual(planted(balance, (r) => r.recipe.calls.push('requestAirdrop')), ['rpc/get-balance: requestAirdrop is not served'])
  assert.deepEqual(planted(balance, (r) => (r.recipe.calls = ['getbalance'])), ['rpc/get-balance: getbalance is not served'])
})

test('a recipe never sends a transaction', () => {
  assert.deepEqual(planted(swap, (r) => r.recipe.calls.push('sendTransaction')), ['swap/build-an-unsigned-swap: sendTransaction sends a transaction, and no recipe sends one'])
  const dca = { ...structuredClone(balance), id: 'dca/open-a-position' }
  dca.recipe.service = 'dca'
  dca.recipe.calls = ['GET /quote', 'POST /open', 'POST /send']
  assert.deepEqual(recipeProblems(dca), ['dca/open-a-position: POST /send sends a transaction, and no recipe sends one'])
})

test('calls list each call in order, repeats and unsubscribes included', () => {
  assert.deepEqual(planted(balance, (r) => (r.recipe.calls = ['getBalance', 'getBalance'])), [])
  assert.deepEqual(planted(balance, (r) => (r.recipe.calls = ['logsSubscribe', 'getBalance', 'logsUnsubscribe'])), [])
  assert.deepEqual(planted(balance, (r) => (r.recipe.calls = ['getBalance', 'balanceUnsubscribe'])), ['rpc/get-balance: balanceUnsubscribe is not served'])
})

test('languages must be the folders present', () => {
  assert.deepEqual(planted(balance, (r) => r.languages.push('java')), [
    'rpc/get-balance: languages lists go, python, rust, typescript but the folders are go, java, python, rust, typescript',
    'rpc/get-balance: no runner for java',
  ])
  assert.deepEqual(planted(balance, (r) => (r.recipe.languages = ['python', 'rust', 'typescript'])), ['rpc/get-balance: languages lists python, rust, typescript but the folders are go, python, rust, typescript'])
  assert.deepEqual(planted(balance, (r) => (r.recipe.languages = ['typescript'])), ['rpc/get-balance: languages lists typescript but the folders are go, python, rust, typescript'])
  // A language folder without its runner's file.
  assert.ok(planted(balance, (r) => (r.dir = r.dir.replace('get-balance', 'no-such-recipe'))).includes('rpc/get-balance: python/main.py is missing'))
})

test('a recipe sits under its own service and an unsigned check has what it reads', () => {
  assert.deepEqual(planted(balance, (r) => (r.recipe.service = 'das')), ['rpc/get-balance: service is das but the recipe sits in rpc/'])
  assert.deepEqual(planted(swap, (r) => (r.recipe.expect.keys = ['transaction'])), ['swap/build-an-unsigned-swap: an unsigned check needs transaction and userPubkey in expect.keys'])
})

test('every recipe passes', () => {
  assert.ok(recipes.length > 0)
  assert.deepEqual(recipes.flatMap(recipeProblems), [])
})
