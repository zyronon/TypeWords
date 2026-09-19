import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { invalidSettings } from './settings-validation-fixtures.mjs'
import { dictionaryFixture, invalidDictionaries } from './dictionary-validation-fixtures.mjs'

const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
const plain = value => JSON.parse(JSON.stringify(value))
function deferred() {
  let resolve
  const promise = new Promise(done => (resolve = done))
  return { promise, resolve }
}
function accountFixture(h, read = async () => h.rows) {
  const controller = new AbortController()
  let captured = 0
  let completed = 0
  const scope = {
    signal: controller.signal,
    assertCurrent() {
      if (controller.signal.aborted) throw Error('stale account')
    },
    read,
  }
  return {
    capture(mode) {
      assert.equal(mode, 'read')
      captured++
      scope.assertCurrent()
      return scope
    },
    completeInitialSync(value) {
      assert.equal(value, scope)
      scope.assertCurrent()
      completed++
    },
    invalidate: () => controller.abort(),
    captured: () => captured,
    completed: () => completed,
  }
}
const validation = {}
const settingsValidation = {}
const dictionaryValidation = {}
runInNewContext(
  ts.transpileModule(readFileSync(resolve(root, 'app/core/composables/dictionaryValidation.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports: dictionaryValidation }
)
runInNewContext(
  ts.transpileModule(readFileSync(resolve(root, 'app/core/composables/settingsValidation.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports: settingsValidation }
)
runInNewContext(
  ts.transpileModule(readFileSync(resolve(root, 'app/core/composables/remotePracticeValidation.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports: validation }
)
function harness(options = {}) {
  const events = []
  const db = new Map(['dict', 'setting', 'word', 'article', 'audio'].map(key => [key, `old-${key}`]))
  const makeStore = () => ({
    $state: { old: true, due: new Date('2026-09-15T00:00:00Z') },
    setState(value) {
      Object.assign(this.$state, value)
    },
    $patch(fn) {
      fn(this.$state)
    },
  })
  const base = makeStore()
  Object.defineProperties(base, {
    word: { get: () => base.$state.word },
    article: { get: () => base.$state.article },
    sdict: { get: () => base.word.bookList[base.word.studyIndex] },
    sbook: { get: () => base.article.bookList[base.article.studyIndex] },
  })
  base.setState = function (value) {
    this.$state = value
  }
  const setting = makeStore()
  let status = options.status
  let reads = 0
  const rows = [
    {
      type: 'dict',
      data: { marker: 'remote', word: { studyIndex: -1, bookList: [] }, article: { studyIndex: -1, bookList: [] } },
      data_version: 4,
    },
    { type: 'setting', data: { added: true, wordPracticeMode: 'remote-mode', shortcutKeyMap: {} }, data_version: 23 },
    { type: 'practice_word', data: null, data_version: 1 },
    { type: 'practice_article', data: null, data_version: 1 },
  ]
  const client = {
    from: () => ({
      select: columns => ({
        in: (_, types) => {
          reads++
          const result = options.networkFailure
            ? Promise.reject(Error('network interrupted'))
            : Promise.resolve({
                error: options.readError,
                data:
                  columns === 'type, updated_at, data_version' && Object.hasOwn(options, 'metadata')
                    ? options.metadata
                    : rows.filter(row => types.includes(row.type)),
              })
          result.not = () => result
          return result
        },
      }),
      upsert: async () => {
        events.push('push')
        return {}
      },
    }),
  }
  const cache = {
    PRACTICE_WORD_CACHE: { key: 'word', version: 2 },
    PRACTICE_ARTICLE_CACHE: { key: 'article', version: 1 },
    checkAndUpgradePracticeWordCache: (data, context) => {
      events.push(`upgrade:word:${context.wordPracticeMode}`)
      if (options.upgradeFailure) throw Error('upgrade failed')
      return { val: data.val, version: 2 }
    },
    getPracticeWordCacheLocalWithMeta: async () => null,
    getPracticeArticleCacheLocalWithMeta: async () => null,
    setPracticeWordCacheLocal: async value => {
      events.push('single')
      db.set('word', JSON.stringify(value))
    },
    setPracticeArticleCacheLocal: async value => {
      events.push('single')
      db.set('article', JSON.stringify(value))
    },
  }
  const modules = {
    './remotePracticeValidation': validation,
    './settingsValidation': settingsValidation,
    './dictionaryValidation': dictionaryValidation,
    '../config/env': {
      SAVE_DICT_KEY: { key: 'dict', version: 4 },
      SAVE_SETTING_KEY: { key: 'setting', version: 23 },
    },
    '../utils/cache': cache,
    '../stores': { useBaseStore: () => base, useSettingStore: () => setting },
    '../types/enum': {
      SyncDataType: {
        dict: 'dict',
        setting: 'setting',
        practice_word: 'practice_word',
        practice_article: 'practice_article',
      },
      CompareResult: { RemoteNewer: 'remote', LocalNewer: 'local', NoRemote: 'none' },
    },
    '../utils': {
      _getDictDataByUrl: () => {
        events.push('hydrate')
        return options.resource ?? Promise.resolve({ loaded: true })
      },
      checkAndUpgradeSaveDict: async data => {
        events.push('upgrade:dict')
        await options.dictMigration?.()
        data.val.mutatedByUpgrade = true
        return data.val
      },
      checkAndUpgradeSaveSetting: async data => {
        events.push('upgrade:setting')
        await options.settingMigration?.()
        if (options.settingFailure) throw Error('setting failed')
        return data.val
      },
      shouldFetchRemote: () => 'remote',
    },
    '../utils/supabase': {
      Supabase: {
        isEnabled: () => !options.desktop,
        check: () => !options.noClient,
        getInstance: () => client,
        setStatus: value => {
          status = value
        },
        getStatus: () => ({ status }),
      },
    },
    'idb-keyval': {
      get: async () => JSON.stringify({ version: 1, updated_at: '2020-01-01T00:00:00Z' }),
      set: async (key, value) => {
        events.push('single')
        if (options.quota) throw Error('quota')
        db.set(key, value)
      },
      setMany: async entries => {
        events.push('commit')
        if (options.beforeCommit) await options.beforeCommit()
        if (options.quota) throw Error('quota')
        for (const [key, value] of entries) db.set(key, value)
      },
    },
    vue: { toRaw: value => value, nextTick: async () => {} },
  }
  modules['../platform/accountPersistence'] = {
    setManyForAccount: async (entries, scope) => {
      scope.assertCurrent()
      events.push('account:commit')
      await options.accountCommit?.()
      scope.assertCurrent()
      if (options.quota) throw Error('quota')
      for (const [key, value] of entries) db.set(key, value)
    },
  }
  let configApi
  if (options.realConfig) {
    const storage = new Map()
    configApi = {}
    runInNewContext(
      ts.transpileModule(readFileSync(resolve(root, 'app/core/utils/supabase.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      {
        exports: configApi,
        require: key =>
          ({
            '@supabase/supabase-js': { createClient: () => client },
            '../platform/sync': { validatedSyncUrl: value => value, createSyncClient: () => client },
            '../stores': { useRuntimeStore: () => ({}) },
            '@/base': { Toast: { error() {} } },
          })[key],
        useRuntimeConfig: () => ({ public: { isDesktop: Boolean(options.desktop) } }),
        window: {},
        localStorage: {
          getItem: key => storage.get(key) ?? null,
          setItem: (key, value) => storage.set(key, value),
        },
      }
    )
    configApi.setConfig({ url: 'https://fixture.supabase.co', key: 'fixture-key', status: 'success' })
    modules['../utils/supabase'] = configApi
  }
  const exports = {}
  runInNewContext(
    ts.transpileModule(readFileSync(resolve(root, 'app/core/composables/useDataSyncPersistence.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: key => modules[key] ?? {}, Date, console: { log() {}, warn() {} } }
  )
  const api = exports.useDataSyncPersistence()
  const session = {}
  runInNewContext(
    ts.transpileModule(
      readFileSync(resolve(root, 'app/core/composables/practice-words/practice-word-session.ts'), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
    ).outputText,
    {
      exports: session,
      require: key =>
        ({
          '@/core/composables/useDataSyncPersistence.ts': { ...exports, useDataSyncPersistence: () => api },
          '@/core/composables/remotePracticeValidation': validation,
          '@/core/stores/setting.ts': { useSettingStore: () => setting },
          '@/core/stores/base.ts': { useBaseStore: () => ({ sdict: { words: [{ word: 'hello' }] } }) },
          '@/core/utils/cache.ts': {
            ...cache,
            getPracticeWordCacheLocalWithMeta: async () => options.localCache ?? null,
          },
          '@/core/utils/index.ts': { shouldFetchRemote: () => 'remote' },
          '@/core/types/enum.ts': modules['../types/enum'],
        })[key] ?? {},
    }
  )
  return {
    api,
    session,
    events,
    db,
    base,
    setting,
    rows,
    configApi,
    reads: () => reads,
    status: () => (configApi ? configApi.Supabase.getStatus().status : status),
  }
}

test('account first pull commits all four records before activation without uploading', async () => {
  const h = harness({ status: 'idle' })
  const account = accountFixture(h)
  assert.equal(await h.api.pullAccountRemoteToLocal(account), true)
  assert.equal(account.captured(), 1)
  assert.equal(account.completed(), 1)
  assert.equal(h.status(), 'idle')
  assert.equal(h.events.filter(value => value === 'account:commit').length, 1)
  assert.ok(!h.events.includes('push'))
  assert.equal(JSON.parse(h.db.get('dict')).val.marker, 'remote')
  assert.equal(JSON.parse(h.db.get('article')).val, null)
  assert.equal(h.db.get('audio'), 'old-audio')
})

for (const boundary of ['read', 'settingMigration', 'dictMigration', 'accountCommit']) {
  test(`account switch during ${boundary} leaves disk, memory, status and activation unchanged`, async () => {
    const entered = deferred()
    const release = deferred()
    const wait = async () => {
      entered.resolve()
      await release.promise
    }
    const h = harness({ status: 'idle', ...(boundary === 'read' ? {} : { [boundary]: wait }) })
    const before = [...h.db]
    const memory = plain(h.base.$state)
    const settings = plain(h.setting.$state)
    const account = accountFixture(h, async () => {
      if (boundary === 'read') await wait()
      return h.rows
    })
    const operation = h.api.pullAccountRemoteToLocal(account)
    const rejected = assert.rejects(operation, /stale account/)
    await entered.promise
    // Account transactions do not expose speculative remote data even while current.
    assert.deepEqual(plain(h.base.$state), memory)
    assert.deepEqual(plain(h.setting.$state), settings)
    account.invalidate()
    release.resolve()
    await rejected
    assert.deepEqual([...h.db], before)
    assert.deepEqual(plain(h.base.$state), memory)
    assert.deepEqual(plain(h.setting.$state), settings)
    assert.equal(account.completed(), 0)
    assert.equal(h.status(), 'idle')
    assert.ok(!h.events.includes('push'))
  })
}

test('account scope is captured before waiting in the persistence queue', async () => {
  const entered = deferred()
  const release = deferred()
  const h = harness({
    beforeCommit: async () => {
      entered.resolve()
      await release.promise
    },
  })
  const predecessor = h.api.pullAllRemoteToLocal()
  await entered.promise
  let reads = 0
  const account = accountFixture(h, async () => {
    reads++
    return h.rows
  })
  const queued = h.api.pullAccountRemoteToLocal(account)
  const rejected = assert.rejects(queued, /stale account/)
  assert.equal(account.captured(), 1)
  account.invalidate()
  release.resolve()
  await predecessor
  await rejected
  assert.equal(reads, 0)
  assert.equal(account.completed(), 0)
})

for (const failure of ['empty', 'partial', 'duplicate', 'invalid', 'quota']) {
  test(`failed account first pull (${failure}) never activates; explicit retry succeeds`, async () => {
    const options = { quota: failure === 'quota', status: 'idle' }
    const h = harness(options)
    const before = [...h.db]
    const original = structuredClone(h.rows)
    if (failure === 'empty') h.rows.length = 0
    if (failure === 'partial') h.rows.pop()
    if (failure === 'duplicate') h.rows[3] = h.rows[0]
    if (failure === 'invalid') h.rows[1].data = { shortcutKeyMap: [] }
    const account = accountFixture(h)
    await assert.rejects(h.api.pullAccountRemoteToLocal(account))
    assert.deepEqual([...h.db], before)
    assert.equal(h.base.$state.old, true)
    assert.equal(h.setting.$state.old, true)
    assert.equal(account.completed(), 0)
    assert.equal(h.status(), 'idle')
    h.rows.splice(0, h.rows.length, ...original)
    options.quota = false
    assert.equal(await h.api.pullAccountRemoteToLocal(account), true)
    assert.equal(account.completed(), 1)
    assert.ok(!h.events.includes('push'))
  })
}

for (const [name, mutate] of invalidSettings) {
  test(`all remote entry points reject ${name} before migration or writes and allow retry`, async () => {
    for (const method of ['pullAllRemoteToLocal', 'pullIfRemoteNewer', 'getRemoteData', 'syncData']) {
      const h = harness({ realConfig: true })
      const before = [...h.db]
      const beforeBase = plain(h.base.$state)
      const beforeSetting = plain(h.setting.$state)
      mutate(h.rows[1].data)
      const run = () =>
        h.api[method](
          ...(method === 'syncData'
            ? [{ dict: { val: {}, version: 4 }, setting: { val: {}, version: 23 } }]
            : method === 'pullAllRemoteToLocal'
              ? []
              : ['setting'])
        )
      if (['pullIfRemoteNewer', 'getRemoteData'].includes(method)) {
        await assert.rejects(run(), /Invalid remote settings/)
      } else {
        await run()
      }
      assert.equal(h.status(), 'error', method)
      assert.deepEqual(h.events, [], method)
      assert.deepEqual([...h.db], before, method)
      assert.deepEqual(plain(h.base.$state), beforeBase, method)
      assert.deepEqual(plain(h.setting.$state), beforeSetting, method)
      assert.equal(h.configApi.Supabase.check(), false)
      h.rows[1].data = { shortcutKeyMap: {} }
      // Mixed sync intentionally remains blocked in error; explicit read-only recovery unlocks it.
      assert.ok(await h.api.pullIfRemoteNewer('setting'))
      assert.equal(h.status(), 'success')
      assert.equal(h.configApi.Supabase.getStatus().statusMessage, '')
      assert.ok(!h.events.includes('push'))
    }
  })
}

for (const method of ['pullAllRemoteToLocal', 'pullIfRemoteNewer']) {
  test(`${method} retries error configuration and clears it only after commit`, async () => {
    const options = { realConfig: true, networkFailure: true }
    const h = harness(options)
    await h.api[method](...(method === 'pullIfRemoteNewer' ? ['dict'] : []))
    assert.equal(h.status(), 'error')
    options.networkFailure = false
    h.configApi.Supabase.setStatus('error', 'previous read failed')
    const result = await h.api[method](...(method === 'pullIfRemoteNewer' ? ['dict'] : []))
    assert.ok(result)
    assert.equal(h.status(), 'success')
    assert.equal(h.configApi.Supabase.getStatus().statusMessage, '')
    assert.ok(h.events.includes('commit'))
    assert.ok(!h.events.includes('push'))
  })

  test(`${method} leaves automatic writes blocked while the retry commit is pending`, async () => {
    let release
    let entered
    const pending = new Promise(resolve => (entered = resolve))
    const gate = new Promise(resolve => (release = resolve))
    const h = harness({
      realConfig: true,
      beforeCommit: async () => {
        entered()
        await gate
      },
    })
    h.configApi.Supabase.setStatus('error', 'previous failure')
    const action = h.api[method](...(method === 'pullIfRemoteNewer' ? ['dict'] : []))
    await pending
    try {
      assert.equal(h.status(), 'error')
      assert.equal(h.configApi.Supabase.check(), false)
      assert.ok(!h.events.includes('push'))
    } finally {
      release()
      await action
    }
    assert.equal(h.status(), 'success')
  })

  test(`${method} does not enable an unverified idle configuration`, async () => {
    const h = harness({ realConfig: true })
    h.configApi.Supabase.setStatus('idle')
    assert.ok(!(await h.api[method](...(method === 'pullIfRemoteNewer' ? ['dict'] : []))))
    assert.equal(h.reads(), 0)
    assert.equal(h.status(), 'idle')
    assert.deepEqual(h.events, [])
  })

  test(`${method} records client initialization failure and permits a corrected retry`, async () => {
    const h = harness({ realConfig: true })
    const getInstance = h.configApi.Supabase.getInstance.bind(h.configApi.Supabase)
    h.configApi.Supabase.getInstance = () => {
      throw Error('client initialization failed')
    }
    const action = () => h.api[method](...(method === 'pullIfRemoteNewer' ? ['dict'] : []))
    if (method === 'pullIfRemoteNewer') await assert.rejects(action(), /client initialization failed/)
    else assert.equal(await action(), false)
    assert.equal(h.status(), 'error')
    assert.equal(h.reads(), 0)
    assert.deepEqual(h.events, [])
    h.configApi.Supabase.getInstance = getInstance
    assert.ok(await action())
    assert.equal(h.status(), 'success')
  })

  for (const failure of ['quota', 'settingFailure']) {
    test(`${method} keeps error and old data when retry ${failure} fails`, async () => {
      const options = { realConfig: true, [failure]: true }
      const h = harness(options)
      const before = [...h.db]
      h.configApi.Supabase.setStatus('error', 'previous failure')
      const action = () => h.api[method](...(method === 'pullIfRemoteNewer' ? ['setting'] : []))
      if (method === 'pullIfRemoteNewer') await assert.rejects(action(), /quota|setting failed/)
      else assert.equal(await action(), false)
      assert.ok(h.reads() > 0)
      assert.equal(h.status(), 'error')
      assert.deepEqual([...h.db], before)
      assert.ok(!h.events.includes('push'))
      options[failure] = false
      assert.ok(await action())
      assert.equal(h.status(), 'success')
    })
  }

  test(`${method} does not unlock writes after a damaged payload retry`, async () => {
    const h = harness({ realConfig: true })
    h.configApi.Supabase.setStatus('error', 'previous failure')
    h.rows[0].data_version = 999
    const action = () => h.api[method](...(method === 'pullIfRemoteNewer' ? ['dict'] : []))
    if (method === 'pullIfRemoteNewer') await assert.rejects(action(), /Invalid or unsupported/)
    else assert.equal(await action(), false)
    assert.ok(h.reads() > 0)
    assert.equal(h.status(), 'error')
    assert.equal(h.configApi.Supabase.check(), false)
    assert.deepEqual(h.events, [])
  })
}

test('metadata-only pull retry cannot clear an error or authorize an automatic push', async () => {
  const h = harness({ realConfig: true, metadata: [] })
  h.configApi.Supabase.setStatus('error', 'previous failure')
  assert.equal(await h.api.pullIfRemoteNewer('dict'), null)
  assert.equal(h.reads(), 1)
  assert.equal(h.status(), 'error')
  await h.api.saveLocalAndSync('setting', { local: true })
  assert.equal(h.reads(), 1)
  assert.deepEqual(h.events, ['single'])
  assert.equal(h.status(), 'error')
})

for (const failure of [{ networkFailure: true }, { readError: { message: 'read denied' } }]) {
  for (const val of [null, { taskWordsStr: { new: ['hello'], review: [] } }]) {
    test(`failed raw read restores legacy local cache without automatic saves: ${JSON.stringify({ failure, val })}`, async () => {
      const options = { ...failure, localCache: { val, version: 1 } }
      const h = harness(options)
      const before = [...h.db]
      await assert.rejects(h.api.getRemoteData('practice_word'), /远端.*读取失败/)
      const restored = await h.session.usePracticeWordPersistence().load()
      assert.deepEqual(plain(restored), val ? { taskWords: { new: [{ word: 'hello' }], review: [] } } : null)
      assert.deepEqual([...h.db], before)
      assert.ok(!h.events.some(event => ['single', 'commit', 'push'].includes(event)))
      assert.equal(h.status(), 'error')
    })
  }
}

test('raw read retries actual persisted error status and clears it only after validated recovery', async () => {
  const options = {
    realConfig: true,
    networkFailure: true,
    localCache: { val: { taskWordsStr: { new: ['hello'], review: [] } }, version: 1 },
  }
  const h = harness(options)
  await h.session.usePracticeWordPersistence().load()
  assert.equal(h.status(), 'error')
  assert.equal(h.configApi.Supabase.check(), false)
  assert.deepEqual(
    [...h.db].map(([, value]) => value),
    ['old-dict', 'old-setting', 'old-word', 'old-article', 'old-audio']
  )
  options.networkFailure = false
  h.rows[2] = { type: 'practice_word', data: { taskWordsStr: { new: ['hello'], review: [] } }, data_version: 2 }
  const restored = await h.session.usePracticeWordPersistence().load()
  assert.equal(restored.taskWords.new[0].word, 'hello')
  assert.equal(h.reads(), 2)
  assert.equal(h.status(), 'success')
  assert.equal(h.configApi.Supabase.getStatus().statusMessage, '')
  assert.equal(h.configApi.Supabase.check(), true)
  assert.ok(!h.events.some(event => ['single', 'commit', 'push'].includes(event)))
})

test('empty or invisible remote rows never trigger legacy local migration saves', async () => {
  const h = harness({ localCache: { val: null, version: 1 } })
  h.rows.splice(2, 1)
  assert.equal(await h.session.usePracticeWordPersistence().load(), null)
  assert.equal(h.status(), 'error')
  assert.ok(!h.events.some(event => ['single', 'commit', 'push'].includes(event)))
})

test('unconfigured raw reads remain local-only and do not set a sync error', async () => {
  const h = harness({ noClient: true })
  assert.equal(await h.api.getRemoteData('practice_word'), null)
  assert.equal(h.reads(), 0)
  assert.notEqual(h.status(), 'error')
})

test('a recovered transport with damaged payload retains actual error status and blocks migration', async () => {
  const options = { realConfig: true, networkFailure: true, localCache: { val: null, version: 1 } }
  const h = harness(options)
  await h.session.usePracticeWordPersistence().load()
  const before = [...h.db]
  options.networkFailure = false
  h.rows[2].data = {}
  await assert.rejects(h.session.usePracticeWordPersistence().load())
  assert.equal(h.status(), 'error')
  assert.equal(h.configApi.Supabase.check(), false)
  assert.deepEqual([...h.db], before)
  assert.ok(!h.events.some(event => ['single', 'commit', 'push'].includes(event)))
  assert.equal(h.reads(), 2)
})

test('configured but unavailable clients cannot turn a failed read into an automatic cache save', async () => {
  const h = harness({ noClient: true, status: 'error', localCache: { val: null, version: 1 } })
  assert.equal(await h.session.usePracticeWordPersistence().load(), null)
  assert.equal(h.reads(), 0)
  assert.equal(h.status(), 'error')
  assert.ok(!h.events.some(event => ['single', 'commit', 'push'].includes(event)))
})

for (const metadata of [
  null,
  {},
  [null],
  [{ type: 'unknown' }],
  [{ type: 'dict' }, { type: 'dict' }],
  [{ type: 'dict', data_version: 0 }],
  [{ type: 'dict', data_version: 1.5 }],
  [{ type: 'dict', data_version: '4' }],
  [{ type: 'dict', updated_at: 123 }],
  [{ type: 'dict', updated_at: 'not-a-date' }],
  [{ type: 'dict', updated_at: '1' }],
]) {
  test(`invalid metadata stops mixed sync before local changes or remote writes: ${JSON.stringify(metadata)}`, async () => {
    const h = harness({ metadata })
    const before = [...h.db]
    await h.api.syncData({ dict: { val: {} }, setting: { val: {} } })
    assert.equal(h.status(), 'error')
    assert.deepEqual(h.events, [])
    assert.deepEqual([...h.db], before)
  })
}

test('metadata rejects an unrequested known type in single-type reads and pulls', async () => {
  const h = harness({ metadata: [{ type: 'setting', data_version: 23 }] })
  assert.equal(await h.api.getRemoteMeta('dict'), null)
  assert.equal(h.status(), 'error')
  assert.equal(await h.api.pullIfRemoteNewer('dict'), null)
  assert.deepEqual(h.events, [])
})

test('invalid metadata keeps the explicit local save but prevents subsequent remote writes', async () => {
  const h = harness({ metadata: [{ type: 'setting', updated_at: 'invalid' }] })
  await h.api.saveLocalAndSync('setting', { localEdit: true })
  assert.equal(h.status(), 'error')
  assert.deepEqual(h.events, ['single'])
  assert.equal(JSON.parse(h.db.get('setting')).val.localEdit, true)
})

for (const metadata of [
  [],
  [{ type: 'dict' }],
  [{ type: 'dict', data_version: null, updated_at: null }],
  [{ type: 'dict', data_version: 4, updated_at: '2026-09-15T00:00:00.123456+00:00' }],
]) {
  test(`valid empty or legacy metadata remains compatible: ${JSON.stringify(metadata)}`, async () => {
    const h = harness({ metadata })
    assert.deepEqual(plain(await h.api.getRemoteMeta('dict')), metadata[0] ?? null)
    assert.notEqual(h.status(), 'error')
    assert.deepEqual(h.events, [])
  })
}

test('corrected metadata permits a subsequent queued sync when a client is available', async () => {
  const options = { metadata: [{ type: 'dict' }, { type: 'dict' }] }
  const h = harness(options)
  await h.api.syncData({ dict: { val: {} } })
  assert.equal(h.status(), 'error')
  assert.deepEqual(h.events, [])
  options.metadata = []
  await h.api.syncData({ dict: { val: {} } })
  assert.deepEqual(h.events, ['push'])
})

for (const [data, version] of [
  [{}, 1],
  [{ taskWordsStr: { new: ['hello', null], review: [] } }, 2],
  [{ taskWordsStr: { new: ['hello'], review: [] } }, 0],
  [{ taskWordsStr: { new: ['hello'], review: [] } }, 2.5],
  [null, 999],
]) {
  test(`raw practice load rejects invalid data/version without migration or saving: ${version}/${JSON.stringify(data)}`, async () => {
    const h = harness({ localCache: { val: null, version: 1 } })
    Object.assign(h.rows[2], { data, data_version: version })
    const before = [...h.db]
    await assert.rejects(h.session.usePracticeWordPersistence().load())
    assert.equal(h.status(), 'error')
    assert.deepEqual(h.events, [])
    assert.deepEqual([...h.db], before)
  })
}

test('raw read can retry a repaired cache and leaves source data unchanged', async () => {
  const h = harness()
  h.rows[2].data = {}
  await assert.rejects(h.api.getRemoteData('practice_word'))
  h.rows[2].data = { taskWordsStr: { new: ['hello'], review: [] } }
  h.rows[2].data_version = 2
  const before = plain(h.rows)
  const restored = await h.session.usePracticeWordPersistence().load()
  assert.deepEqual(plain(restored), { taskWords: { new: [{ word: 'hello' }], review: [] } })
  assert.deepEqual(plain(h.rows), before)
  assert.deepEqual(h.events, [])
})

for (const version of [undefined, null, 1, 2]) {
  test(`raw read retains legacy absent-version and null-cache compatibility: ${version}`, async () => {
    const h = harness()
    h.rows[2].data_version = version
    assert.equal((await h.api.getRemoteData('practice_word')).data, null)
    assert.equal(await h.session.usePracticeWordPersistence().load(), null)
    assert.deepEqual(h.events, version === 2 ? [] : ['upgrade:word:undefined', 'single', 'push'])
  })
}

test('future raw cache retains the existing unsupported-version error type', async () => {
  const h = harness()
  h.rows[2].data_version = 999
  await assert.rejects(
    h.session.usePracticeWordPersistence().load(),
    error => error instanceof h.session.UnsupportedPracticeCacheVersionError && error.version === 999
  )
  assert.deepEqual(h.events, [])
})

for (const future of [false, true]) {
  test(`word-list cache failure blocks starting/resetting practice and recovers after retry (future=${future})`, async () => {
    const h = harness()
    const source = readFileSync(resolve(root, 'app/pages/(words)/words.vue'), 'utf8')
    const slice = (start, end) => source.slice(source.indexOf(start), source.indexOf(end))
    let failure = future
      ? new h.session.UnsupportedPracticeCacheVersionError(999)
      : new validation.RemoteDataValidationError('invalid')
    const messages = []
    const exports = {}
    const code = [
      'let blockedPracticeCache = false;',
      slice('async function loadPracticeCache()', 'const shouldShowDialogPracticeMode'),
      slice('async function resetCacheData()', '// runtimeStore.globalLoading'),
      // Execute the guard before any mode selection or destructive reset.
      slice('async function startPractice(', '  if (practiceMode === WordPracticeMode.Custom)') +
        'throw new Error("reached practice start"); }',
      'exports.load = loadPracticeCache; exports.start = startPractice; exports.reset = resetCacheData;',
    ].join('\n')
    runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports,
      ...h.session,
      wordPersistence: {
        load: async () => {
          if (failure) throw failure
          return null
        },
      },
      Toast: { error: message => messages.push(message) },
    })
    assert.equal(await exports.load(), null)
    await exports.start('mode', true)
    // Any fallthrough would access unavailable mutable state or invoke clear().
    await exports.reset()
    assert.equal(messages.length, 2)
    assert.match(messages[0], future ? /更高版本/ : /缓存损坏/)
    failure = null
    assert.equal(await exports.load(), null)
    await assert.rejects(exports.start('mode', true), /reached practice start/)
  })
}

for (const [type, data, version] of [
  ['practice_word', {}, 1],
  ['practice_word', { taskWordsStr: { new: ['valid', null], review: [] } }, 1],
  ['practice_word', { taskWords: { new: [{ word: 12 }], review: [] } }, 1],
  ['practice_word', { taskWordsStr: { new: [], review: [] }, practiceData: {} }, 2],
  ['practice_article', { practiceData: { sectionIndex: -1, sentenceIndex: 0, wordIndex: 0 } }, 1],
  ['practice_article', { practiceData: { sectionIndex: 0, sentenceIndex: 0, wordIndex: 0 }, statStoreData: [] }, 1],
]) {
  test(`malformed ${type} payload is rejected before all migrations: ${JSON.stringify(data)}`, async () => {
    const h = harness()
    const row = h.rows.find(row => row.type === type)
    Object.assign(row, { data, data_version: version })
    const before = [...h.db]
    assert.equal(await h.api.pullAllRemoteToLocal(), false)
    assert.equal(h.status(), 'error')
    assert.deepEqual(h.events, [])
    assert.deepEqual([...h.db], before)
    assert.equal(h.base.$state.old, true)
  })
}

test('first pull commits four records once and preserves absent audio and source rows', async () => {
  const h = harness()
  const before = plain(h.rows)
  assert.equal(await h.api.pullAllRemoteToLocal(), true)
  assert.deepEqual(h.events, ['upgrade:setting', 'upgrade:dict', 'upgrade:word:remote-mode', 'commit'])
  assert.deepEqual(plain(h.rows), before)
  assert.equal(h.db.get('audio'), 'old-audio')
  assert.equal(JSON.parse(h.db.get('word')).version, 2)
  assert.equal(h.base.$state.marker, 'remote')
})

test('valid task-only cache commits and a malformed cache can be corrected and retried', async () => {
  const h = harness()
  h.rows[2].data = { taskWordsStr: { new: ['hello', null], review: [] } }
  assert.equal(await h.api.pullAllRemoteToLocal(), false)
  assert.deepEqual(h.events, [])
  h.rows[2].data.taskWordsStr.new.pop()
  assert.equal(await h.api.pullAllRemoteToLocal(), true)
  assert.deepEqual(JSON.parse(h.db.get('word')).val, { taskWordsStr: { new: ['hello'], review: [] } })
  assert.equal(h.events.filter(event => event === 'commit').length, 1)
})

test('mixed sync does not push local branches when a remote practice payload is malformed', async () => {
  const h = harness()
  h.rows.splice(3)
  h.rows[2].data = {}
  await h.api.syncData({
    dict: { val: {} },
    practice_word: { val: {} },
    practice_article: { val: {} },
  })
  assert.equal(h.status(), 'error')
  assert.deepEqual(h.events, [])
  assert.equal(h.db.get('dict'), 'old-dict')
})

for (const options of [{ settingFailure: true }, { upgradeFailure: true }, { quota: true }]) {
  test(`failed pull preserves all records and restores runtime Dates: ${JSON.stringify(options)}`, async () => {
    const h = harness(options)
    const before = [...h.db]
    assert.equal(await h.api.pullAllRemoteToLocal(), false)
    assert.equal(h.status(), 'error')
    assert.deepEqual([...h.db], before)
    assert.ok(h.base.$state.due instanceof Date)
    assert.equal(h.base.$state.due.toISOString(), '2026-09-15T00:00:00.000Z')
    assert.equal(h.base.$state.marker, undefined)
    assert.equal(h.setting.$state.added, undefined)
    assert.ok(!h.events.includes('single'))
    assert.ok(!h.events.includes('push'))
  })
}

for (const change of [
  rows => {
    rows[3].data_version = 999
  },
  rows => {
    rows[2].data_version = 0
  },
  rows => {
    rows[1].data = null
  },
  rows => {
    rows[0].data = []
  },
]) {
  test('invalid later envelope rejects the whole batch before any upgrade or write', async () => {
    const h = harness()
    change(h.rows)
    assert.equal(await h.api.pullAllRemoteToLocal(), false)
    assert.deepEqual(h.events, [])
    assert.equal(h.base.$state.old, true)
  })
}

test('partial legacy pull leaves absent types untouched and preserves the remote timestamp', async () => {
  const h = harness()
  h.rows.splice(1)
  h.rows[0].updated_at = '2026-09-14T00:00:00Z'
  assert.equal(await h.api.pullAllRemoteToLocal(), true)
  assert.equal(h.db.get('setting'), 'old-setting')
  assert.equal(h.db.get('word'), 'old-word')
  assert.equal(JSON.parse(h.db.get('dict')).updated_at, h.rows[0].updated_at)
})

test('mixed sync commits all pulled types together and does not push after quota failure', async () => {
  const h = harness({ quota: true })
  h.rows.splice(2)
  await h.api.syncData({ dict: { val: {} }, setting: { val: {} }, practice_article: { val: {} } })
  assert.equal(h.status(), 'error')
  assert.deepEqual([...h.db.values()], ['old-dict', 'old-setting', 'old-word', 'old-article', 'old-audio'])
  assert.ok(!h.events.includes('push'))
})

test('failed transaction can retry successfully through the same persistence queue', async () => {
  const options = { quota: true }
  const h = harness(options)
  assert.equal(await h.api.pullAllRemoteToLocal(), false)
  options.quota = false
  assert.equal(await h.api.pullAllRemoteToLocal(), true)
  assert.equal(h.status(), 'success')
  assert.equal(h.events.filter(event => event === 'commit').length, 2)
})

test('a throwing setting store is restored before any database transaction', async () => {
  const h = harness()
  h.setting.setState = function (value) {
    Object.assign(this.$state, value)
    throw Error('store application failed')
  }
  assert.equal(await h.api.pullAllRemoteToLocal(), false)
  assert.equal(h.setting.$state.added, undefined)
  assert.equal(h.base.$state.marker, undefined)
  assert.ok(!h.events.includes('commit'))
})

test('single-type remote pull also rolls back a failed transaction', async () => {
  const h = harness({ quota: true })
  await assert.rejects(h.api.pullIfRemoteNewer('dict'), /quota/)
  assert.equal(h.status(), 'error')
  assert.equal(h.base.$state.marker, undefined)
  assert.equal(h.db.get('dict'), 'old-dict')
})

test('save-and-sync does not report success when its remote pull rejects an unsupported version', async () => {
  const h = harness()
  h.rows[1].data_version = 999
  await assert.rejects(h.api.saveLocalAndSync('setting', { localEdit: true }), /unsupported/)
  assert.equal(h.status(), 'error')
  assert.equal(JSON.parse(h.db.get('setting')).val.localEdit, true)
  assert.ok(!h.events.includes('push'))
})

for (const quota of [false, true]) {
  test(`dictionary hydration only starts after a successful commit (quota=${quota})`, async () => {
    const h = harness({ quota })
    h.rows[0].data.word = {
      studyIndex: 3,
      bookList: Array.from({ length: 4 }, () => ({ words: [], articles: [] })),
    }
    assert.equal(await h.api.pullAllRemoteToLocal(), !quota)
    assert.equal(h.events.includes('hydrate'), !quota)
    if (!quota) assert.ok(h.events.indexOf('hydrate') > h.events.indexOf('commit'))
  })
}

test('a pending dictionary resource cannot overwrite a subsequently replaced state', async () => {
  let finish
  const h = harness({
    resource: new Promise(resolve => {
      finish = resolve
    }),
  })
  h.rows[0].data.word = { studyIndex: 3, bookList: Array.from({ length: 4 }, () => ({ words: [], articles: [] })) }
  assert.equal(await h.api.pullAllRemoteToLocal(), true)
  const replacement = { word: { studyIndex: 3, bookList: [{}, {}, {}, { marker: 'newer' }] } }
  h.base.setState(replacement)
  finish({ marker: 'stale-resource' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.base.word.bookList[3].marker, 'newer')
})

for (const [label, mutate] of invalidDictionaries) {
  test(`dictionary boundary rejects before migration and supports read-only retry: ${label}`, async () => {
    for (const method of ['pullAllRemoteToLocal', 'pullIfRemoteNewer', 'getRemoteData', 'syncData']) {
      const h = harness({ realConfig: true })
      const before = [...h.db]
      const beforeBase = plain(h.base.$state)
      const beforeSetting = plain(h.setting.$state)
      h.rows[0].data = dictionaryFixture()
      mutate(h.rows[0].data)
      const run = () =>
        h.api[method](
          ...(method === 'syncData'
            ? [{ dict: { val: {}, version: 4 }, setting: { val: {}, version: 23 } }]
            : method === 'pullAllRemoteToLocal'
              ? []
              : ['dict'])
        )
      if (['pullIfRemoteNewer', 'getRemoteData'].includes(method)) {
        await assert.rejects(run(), /Invalid remote dictionary/)
      } else {
        await run()
      }
      assert.deepEqual(h.events, [], method)
      assert.deepEqual([...h.db], before, method)
      assert.deepEqual(plain(h.base.$state), beforeBase, method)
      assert.deepEqual(plain(h.setting.$state), beforeSetting, method)
      assert.equal(h.status(), 'error', method)
      assert.equal(h.configApi.Supabase.check(), false)
      h.rows[0].data = dictionaryFixture()
      assert.equal(await h.api.pullAllRemoteToLocal(), true)
      assert.equal(h.status(), 'success')
      assert.equal(h.configApi.Supabase.getStatus().statusMessage, '')
      assert.ok(!h.events.includes('push'))
    }
  })
}
