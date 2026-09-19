import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
const page = readFileSync(resolve(root, 'app/pages/(words)/practice-words/[id].vue'), 'utf8')
const utils = readFileSync(resolve(root, 'app/core/utils/index.ts'), 'utf8')
// Execute the actual page loader and existing identity helpers, not a copied implementation.
function declaration(source, name) {
  const file = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true)
  const node = file.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert.ok(node, `missing ${name}`)
  return node.getText(file).replace(/^export /, '')
}
async function load({ id = '1', personal = [], catalog = [{ id: 1, words: [] }] } = {}) {
  const events = []
  const store = { word: { bookList: personal }, changeDict: d => events.push(['dict', d.id]) }
  const context = {
    store,
    route: { params: { id } },
    getDefaultDict: () => ({}),
    fetch: async () => ({ json: async () => catalog }),
    resourceWrap: x => x,
    DICT_LIST: { WORD: { ALL: '/list/word.json' } },
    _getDictDataByUrl: async d => ({ ...d, words: [{ word: 'cancel' }] }),
    initData: async () => events.push(['cache']),
    loading: true,
    router: { push: url => events.push(['redirect', url]) },
    Toast: { warning: x => events.push(['warning', x]) },
  }
  const source =
    ['normalizeDictId', 'getDictIdentityList', 'isDictIdMatch'].map(n => declaration(utils, n)).join('\n') +
    '\n' +
    declaration(page.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1], 'loadDict')
  runInNewContext(
    ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
    context
  )
  await context.loadDict()
  return events
}
test('direct numeric catalog route resolves string URL before cache restoration', async () => {
  assert.deepEqual(await load(), [['dict', 1], ['cache']])
})
test('persisted numeric dictionary wins over catalog and preserves selection', async () => {
  assert.deepEqual(await load({ personal: [{ id: 1, custom: true, words: [{ word: 'local' }] }], catalog: [] }), [
    ['dict', 1],
    ['cache'],
  ])
})
test('legacy enName route resolves using existing dictionary identity semantics', async () => {
  assert.deepEqual(await load({ id: 'cet4', catalog: [{ id: 1, enName: 'cet4' }] }), [['dict', 1], ['cache']])
})
test('custom string ID still loads and unknown/empty routes still return to words', async () => {
  assert.deepEqual(await load({ id: 'custom-one', personal: [{ id: 'custom-one', custom: true, words: [{}] }] }), [
    ['dict', 'custom-one'],
    ['cache'],
  ])
  assert.deepEqual(await load({ id: 'missing' }), [['redirect', '/words']])
  assert.deepEqual(await load({ id: '' }), [['redirect', '/words']])
})
