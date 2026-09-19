import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
const env = {
  SAVE_DICT_KEY: { key: 'dict', version: 4 },
  SAVE_SETTING_KEY: { key: 'setting', version: 23 },
  EXPORT_DATA_KEY: { version: 5 },
  LOCAL_FILE_KEY: 'audio',
  APP_VERSION: { key: 'app', version: 5 },
}
const cache = {
  PRACTICE_WORD_CACHE: { key: 'word', version: 2 },
  PRACTICE_ARTICLE_CACHE: { key: 'article', version: 1 },
}
function load(path, modules) {
  const exports = {}
  runInNewContext(
    ts.transpileModule(readFileSync(resolve(root, path), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, Date, require: n => modules[n] || {}, console, Blob, structuredClone }
  )
  return exports
}
function harness(fail = false, options = {}) {
  const events = []
  const db = new Map([
    ['dict', 'original'],
    ['audio', 'original-audio'],
  ])
  const base = {
      $state: { old: true },
      setState(v) {
        this.$state = v
      },
      $patch(fn) {
        fn(this.$state)
      },
    },
    setting = {
      $state: { old: true },
      setState(v) {
        this.$state = v
      },
      $patch(fn) {
        fn(this.$state)
      },
    }
  const persistence = load('app/core/composables/useDataSyncPersistence.ts', {
    '../utils': { cloneDeep: structuredClone, shakeCommonDict: v => v },
    '../utils/cache': {
      ...cache,
      setPracticeWordCacheLocal: async v => {
        events.push('single')
        db.set('word', JSON.stringify(v))
      },
      setPracticeArticleCacheLocal: async v => {
        events.push('single')
        db.set('article', JSON.stringify(v))
      },
    },
    '../config/env': env,
    '../stores': { useBaseStore: () => base, useSettingStore: () => setting },
    '../types/enum': {
      SyncDataType: { dict: 'dict', setting: 'setting', practice_word: 'word', practice_article: 'article' },
    },
    '../utils/supabase': {
      Supabase: {
        isEnabled: () => !options.desktop,
        check: () => true,
        getInstance: () => ({
          from: () => ({
            upsert: async () => {
              events.push('remote')
              return options.remoteError ? { error: { message: 'offline' } } : {}
            },
          }),
        }),
        setStatus() {},
      },
    },
    'idb-keyval': {
      get: async k => db.get(k),
      set: async (k, v) => {
        events.push('single')
        if (fail) throw Error('quota')
        db.set(k, v)
      },
      setMany: async entries => {
        events.push('commit')
        if (options.beforeCommit) await options.beforeCommit()
        if (fail) throw Error('quota')
        entries.forEach(([k, v]) => db.set(k, v))
      },
    },
    vue: { nextTick: async () => {}, toRaw: v => v },
  }).useDataSyncPersistence()
  const data = {
    dict: { val: { word: { bookList: [] }, article: { bookList: [] } } },
    setting: { val: { x: 1 } },
    word: { val: { n: 1 } },
    article: null,
  }
  return { persistence, events, db, base, setting, data }
}
test('local commit precedes remote and uses one transaction for all four records and audio', async () => {
  const h = harness()
  await h.persistence.forcePushLocalDataToRemote(h.data, undefined, [{ id: 'tone', file: new Blob(['x']) }])
  assert.deepEqual(h.events, ['commit', 'remote'])
  assert.equal(h.db.get('audio')[0].id, 'tone')
  const rows = ['dict', 'setting', 'word', 'article'].map(k => JSON.parse(h.db.get(k)))
  assert.equal(new Set(rows.map(r => r.updated_at)).size, 1)
})
test('local quota failure leaves remote, storage and stores untouched', async () => {
  const h = harness(true)
  await assert.rejects(h.persistence.forcePushLocalDataToRemote(h.data), /quota/)
  assert.deepEqual(h.events, ['commit'])
  assert.equal(h.db.get('dict'), 'original')
  assert.equal(h.db.get('audio'), 'original-audio')
  assert.deepEqual(JSON.parse(JSON.stringify(h.base.$state)), { old: true, _ignoreWatch: true })
  assert.deepEqual(JSON.parse(JSON.stringify(h.setting.$state)), { old: true, _ignoreWatch: true })
})
test('explicit IndexedDB abort with a null error still reports a useful failure after rollback', async () => {
  const h = harness(false, {
    beforeCommit: async () => {
      throw null
    },
  })
  await assert.rejects(h.persistence.forcePushLocalDataToRemote(h.data), /Local backup transaction failed/)
  assert.deepEqual(h.events, ['commit'])
  assert.equal(h.db.get('dict'), 'original')
  assert.equal(h.db.get('audio'), 'original-audio')
  assert.deepEqual(JSON.parse(JSON.stringify(h.base.$state)), { old: true, _ignoreWatch: true })
  assert.deepEqual(JSON.parse(JSON.stringify(h.setting.$state)), { old: true, _ignoreWatch: true })
})
const fixturePath = new URL('./fixtures/backup/backup-fixture.json', import.meta.url)
function validationHarness() {
  const events = []
  const helper = load('app/core/composables/backupImport.ts', {
    './remotePracticeValidation': load('app/core/composables/remotePracticeValidation.ts', {}),
    './settingsValidation': load('app/core/composables/settingsValidation.ts', {}),
    './dictionaryValidation': load('app/core/composables/dictionaryValidation.ts', {}),
    '../config/env': env,
    '../utils/cache': { ...cache, checkAndUpgradePracticeWordCache: v => v },
    '../utils': {
      checkAndUpgradeSaveDict: async v => {
        events.push('dict-upgrade')
        return v.val
      },
      checkAndUpgradeSaveSetting: async v => {
        events.push('setting-upgrade')
        return v.val
      },
    },
  })
  const fixture = JSON.parse(readFileSync(fixturePath))
  delete fixture.val.PracticeSaveWord
  delete fixture.val.PracticeSaveArticle
  return { helper, events, fixture, audio: [{ id: 'backup-tone', file: new Blob(['audio']) }] }
}
test('unknown export and nested versions, invalid shapes and missing audio reject before upgrade side effects', async () => {
  for (const mutate of [
    b => (b.version = 999),
    b => (b.val.dict.version = 999),
    b => (b.val.setting.version = 999),
    b => (b.val.word = { version: 999, val: {} }),
    b => (b.val.dict.val.word.bookList = null),
    b => (b.val.dict.val.article.bookList[0] = null),
    b => (b.val.setting.val.shortcutKeyMap = []),
  ]) {
    const h = validationHarness()
    mutate(h.fixture)
    await assert.rejects(h.helper.prepareBackupImport(JSON.stringify(h.fixture), h.audio))
    assert.deepEqual(h.events, [])
  }
  const h = validationHarness()
  await assert.rejects(h.helper.prepareBackupImport(JSON.stringify(h.fixture), []), /Missing backup audio/)
  assert.deepEqual(h.events, [])
})
test('valid v4 and v5 backups preserve semantic fields and upgrade only after audio validation', async () => {
  for (const version of [4, 5]) {
    const h = validationHarness()
    h.fixture.version = version
    h.fixture.val.app = 4
    const result = await h.helper.prepareBackupImport(JSON.stringify(h.fixture), h.audio)
    assert.equal(result.setting.val.wordSoundVolume, 0.37)
    assert.equal(result.dict.val.article.bookList.at(-1).articles[0].audioFileId, 'backup-tone')
    assert.deepEqual(h.events, ['dict-upgrade', 'setting-upgrade'])
    if (version === 4) assert.equal(result.setting.val.webAppVersion, 4)
  }
})
test('ZIP JSON parse and audio read failures never reach a writer', async () => {
  const { helper } = validationHarness()
  await assert.rejects(helper.readBackupZip({ file: () => null }), /missing_data_json/)
  await assert.rejects(helper.readBackupZip({ file: () => ({ async: async () => '{broken' }), files: {} }))
  const zip = {
    files: { 'mp3/tone.mp3': {} },
    file: n => ({
      async: async () => {
        if (n === 'data.json') return '{}'
        throw Error('corrupt audio')
      },
    }),
  }
  await assert.rejects(helper.readBackupZip(zip), /corrupt audio/)
})
test('custom audio backup commits locally but is never pushed as incomplete remote JSON', async () => {
  const h = harness()
  h.data.dict.val.article.bookList = [{ custom: true, articles: [{ audioFileId: 'tone' }] }]
  assert.equal(
    await h.persistence.forcePushLocalDataToRemote(h.data, undefined, [{ id: 'tone', file: new Blob(['x']) }]),
    false
  )
  assert.deepEqual(h.events, ['commit'])
})
test('remote rejection retains a successful local import without rolling data back', async () => {
  const h = harness(false, { remoteError: true })
  assert.equal(await h.persistence.forcePushLocalDataToRemote(h.data), false)
  assert.deepEqual(h.events, ['commit', 'remote'])
  assert.equal(JSON.parse(h.db.get('setting')).val.x, 1)
  assert.equal(h.setting.$state.x, 1)
})
test('queued pre-import autosave is discarded and imports cannot overlap local commits', async () => {
  let release
  const gate = new Promise(r => (release = r))
  const h = harness(false, { beforeCommit: () => gate })
  const stale = h.persistence.saveLocalAndSync('setting', { stale: true })
  const imported = h.persistence.forcePushLocalDataToRemote(h.data)
  await stale
  await new Promise(r => setImmediate(r))
  assert.deepEqual(h.events, ['commit'])
  release()
  await imported
  assert.deepEqual(h.events, ['commit', 'remote'])
  assert.equal(JSON.parse(h.db.get('setting')).val.x, 1)
})
test('nullable practice cache envelopes are valid legacy empty caches', async () => {
  const h = validationHarness()
  h.fixture.val.word = { version: 1, val: null }
  h.fixture.val.article = { version: 1, val: null }
  await h.helper.prepareBackupImport(JSON.stringify(h.fixture), h.audio)
})
test('unselected word and article sentinel indices remain importable', async () => {
  const h = validationHarness()
  h.fixture.val.dict.val.word.studyIndex = -1
  h.fixture.val.dict.val.article.studyIndex = -1
  const result = await h.helper.prepareBackupImport(JSON.stringify(h.fixture), h.audio)
  assert.equal(result.dict.val.article.studyIndex, -1)
})
test('missing shortcut map rejects before legacy normalizer can save fallback snapshots', async () => {
  const h = validationHarness()
  delete h.fixture.val.setting.val.shortcutKeyMap
  await assert.rejects(h.helper.prepareBackupImport(JSON.stringify(h.fixture), h.audio), /Invalid backup settings/)
  assert.deepEqual(h.events, [])
})
test('quota rollback preserves runtime FSRS Date objects and removes merged imported setting keys', async () => {
  const h = harness(true)
  const due = new Date('2026-09-12T12:00:00Z')
  h.base.$state.fsrsData = { test: { due } }
  h.setting.setState = function (v) {
    Object.assign(this.$state, v)
  }
  await assert.rejects(h.persistence.forcePushLocalDataToRemote(h.data), /quota/)
  assert.ok(h.base.$state.fsrsData.test.due instanceof Date)
  assert.equal(h.base.$state.fsrsData.test.due.getTime(), due.getTime())
  assert.equal('x' in h.setting.$state, false)
})
test('explicit concurrent imports both execute, rather than reporting a skipped import as success', async () => {
  const h = harness()
  const first = h.persistence.forcePushLocalDataToRemote(h.data)
  const second = h.persistence.forcePushLocalDataToRemote(h.data)
  assert.equal(await first, true)
  assert.equal(await second, true)
  assert.deepEqual(h.events, ['commit', 'remote', 'commit', 'remote'])
})
test('consumer-critical malformed fields reject before normalization or persistence', async () => {
  for (const mutate of [
    b => (b.val.dict.val.simpleWords = null),
    b => (b.val.dict.val.fsrsData = null),
    b => (b.val.setting.val.fontSize = null),
    b => (b.val.dict.val.word.bookList[0].words = [{}]),
    b => (b.val.dict.val.article.bookList[0].articles = [{}]),
    b => (b.val.setting.val.fsrsParameters = null),
  ]) {
    const h = validationHarness()
    mutate(h.fixture)
    await assert.rejects(h.helper.prepareBackupImport(JSON.stringify(h.fixture), h.audio))
    assert.deepEqual(h.events, [])
  }
})
