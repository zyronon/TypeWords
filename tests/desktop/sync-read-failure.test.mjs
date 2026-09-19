import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
const source = readFileSync(resolve(root, 'app/core/composables/useDataSyncPersistence.ts'), 'utf8')
function extract(start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end))
}
function harness(response = {}) {
  const events = []
  let status = 'idle'
  const types = ['dict', 'setting', 'practice_word', 'practice_article']
  const sandbox = {
    exports: {},
    console: { log() {} },
    ALL_SYNC_TYPES: types,
    store: {},
    settingStore: {},
    Supabase: {
      setStatus(value) {
        status = value
        events.push(`status:${value}`)
      },
      getStatus: () => ({ status }),
    },
    getSyncClient: () =>
      response.noClient
        ? null
        : {
            from: () => ({
              select: () => ({
                in: () => {
                  const result = response.throws
                    ? Promise.reject(Error('network interrupted'))
                    : Promise.resolve(response)
                  result.not = () => result
                  return result
                },
              }),
            }),
          },
    fetchServerMeta: async () => types.map(type => ({ type })),
    CompareResult: { RemoteNewer: 'remote', LocalNewer: 'local', NoRemote: 'none' },
    compareResultByType: async type => (type === 'dict' ? 'remote' : 'local'),
    applyRemoteDataByType: async type => events.push(`apply:${type}`),
    applyRemoteDataBatch: async rows => rows.forEach(row => events.push(`apply:${row.type}`)),
    upsertServerDatas: async () => events.push('push'),
  }
  const code = [
    extract('async function fetchServerDatas(', 'async function compareResultByType('),
    extract('  async function syncData(', '  async function saveLocalAndSync('),
    extract('  async function pullAllRemoteToLocal(', '  async function prepareDictState('),
    'exports.fetch = fetchServerDatas; exports.sync = syncData; exports.pull = pullAllRemoteToLocal;',
  ].join('\n')
  runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
    sandbox
  )
  return { ...sandbox.exports, events, status: () => status }
}

for (const response of [
  { error: { message: 'permission denied' } },
  { throws: true },
  { data: [] },
  { data: null },
  { data: [{ type: 'setting', data: {} }] },
  {
    data: [
      { type: 'dict', data: {} },
      { type: 'dict', data: {} },
    ],
  },
]) {
  test(`failed or incomplete remote read aborts mixed pull/push: ${JSON.stringify(response)}`, async () => {
    const h = harness(response)
    await h.sync({ dict: { val: {} }, setting: { val: {} } })
    assert.equal(h.status(), 'error')
    assert.ok(!h.events.includes('push'))
    assert.ok(!h.events.some(event => event.startsWith('apply:')))
  })
}

test('missing client is a failed read, not an empty successful result', async () => {
  const h = harness({ noClient: true })
  assert.equal(await h.fetch(['dict']), null)
})

test('successful mixed sync applies the requested row before pushing local changes', async () => {
  const h = harness({ data: [{ type: 'dict', data: {}, data_version: 1 }] })
  await h.sync({ dict: { val: {} }, setting: { val: {} } })
  assert.deepEqual(h.events, ['apply:dict', 'push', 'status:success'])
})

for (const data of [[], null, {}, [null], [{ type: 'unknown' }], [{ type: 'dict' }, { type: 'dict' }]]) {
  test(`first pull rejects ${JSON.stringify(data)} without success or local writes`, async () => {
    const h = harness({ data })
    assert.equal(await h.pull(), false)
    assert.equal(h.status(), 'error')
    assert.ok(!h.events.some(event => event.startsWith('apply:')))
  })
}

for (const response of [{ error: { message: 'read denied' } }, { throws: true }]) {
  test(`first pull stops on request failure: ${JSON.stringify(response)}`, async () => {
    const h = harness(response)
    assert.equal(await h.pull(), false)
    assert.equal(h.status(), 'error')
    assert.ok(!h.events.some(event => event.startsWith('apply:')))
  })
}

test('a failed mixed sync can retry after the remote read recovers', async () => {
  const response = { data: [] }
  const h = harness(response)
  const local = { dict: { val: {} }, setting: { val: {} } }
  await h.sync(local)
  assert.equal(h.status(), 'error')
  response.data = [{ type: 'dict', data: {}, data_version: 1 }]
  await h.sync(local)
  assert.ok(h.events.includes('apply:dict'))
  assert.ok(h.events.includes('push'))
})

test('first pull preserves support for older remote data with only versioned dictionary rows', async () => {
  const h = harness({ data: [{ type: 'dict', data: {}, data_version: 1 }] })
  assert.equal(await h.pull(), true)
  assert.equal(h.status(), 'success')
})
