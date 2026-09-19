import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { invalidSettings } from './settings-validation-fixtures.mjs'
import { dictionaryFixture, invalidDictionaries } from './dictionary-validation-fixtures.mjs'

const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
function load(path, modules = {}) {
  const exports = {}
  runInNewContext(
    ts.transpileModule(readFileSync(resolve(root, path), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      Blob,
      require(name) {
        assert.ok(Object.hasOwn(modules, name), `Unexpected import: ${name}`)
        return modules[name]
      },
    }
  )
  return exports
}
const stats = () => ({
  stage: 0,
  startDate: 1,
  spend: 0,
  total: 1,
  newWordNumber: 1,
  reviewWordNumber: 0,
  inputWordNumber: 0,
  wrong: 0,
})
const word = () => ({
  taskWordsStr: { new: ['hello'], review: [] },
  practiceData: { index: 0, wordsStr: ['hello'], wrongWordsStr: [] },
  statStoreData: stats(),
  sessionSnapshot: {
    flowId: 'fixture',
    cursor: { nodeIndex: 0, stepIndex: 0, inWrongWordClear: false, loop: null, endActionIndex: null },
  },
})
const article = () => ({
  practiceData: { sectionIndex: 0, sentenceIndex: 0, wordIndex: 0 },
  statStoreData: stats(),
})

for (const [label, mutate] of invalidDictionaries) {
  test(`ZIP dictionary boundary rejects before any migration: ${label}`, async () => {
    const h = harness()
    h.backup.val.dict.val = dictionaryFixture()
    mutate(h.backup.val.dict.val)
    await assert.rejects(h.prepareBackupImport(JSON.stringify(h.backup), h.audio), /Invalid backup/)
    assert.deepEqual(h.events, [])
    h.backup.val.dict.val = dictionaryFixture()
    await h.prepareBackupImport(JSON.stringify(h.backup), h.audio)
    assert.deepEqual(h.events, ['dict', 'setting', 'word'])
  })
}
function harness(realUpgrade = false) {
  const events = []
  const cache = load('app/core/utils/cache.ts', {
    '../types/enum': load('app/core/types/enum.ts'),
    'idb-keyval': {
      get() {
        assert.fail('Preflight must not read storage')
      },
      set() {
        assert.fail('Preflight must not write storage')
      },
    },
  })
  const helper = load('app/core/composables/backupImport.ts', {
    '../config/env': {
      APP_VERSION: { key: 'app' },
      EXPORT_DATA_KEY: { version: 5 },
      SAVE_DICT_KEY: { version: 4 },
      SAVE_SETTING_KEY: { version: 23 },
    },
    '../utils': {
      checkAndUpgradeSaveDict: async value => {
        events.push('dict')
        return value.val
      },
      checkAndUpgradeSaveSetting: async value => {
        events.push('setting')
        return value.val
      },
    },
    '../utils/cache': {
      PRACTICE_WORD_CACHE: { key: 'PracticeSaveWord', version: 2 },
      PRACTICE_ARTICLE_CACHE: { key: 'PracticeSaveArticle', version: 1 },
      checkAndUpgradePracticeWordCache: (value, context) => {
        events.push('word')
        return realUpgrade ? cache.checkAndUpgradePracticeWordCache(value, context) : value
      },
    },
    './remotePracticeValidation': load('app/core/composables/remotePracticeValidation.ts'),
    './settingsValidation': load('app/core/composables/settingsValidation.ts'),
    './dictionaryValidation': load('app/core/composables/dictionaryValidation.ts'),
  })
  const backup = {
    version: 5,
    val: {
      dict: {
        version: 4,
        val: {
          word: { studyIndex: 0, bookList: [{ words: [{ word: 'hello' }], articles: [] }] },
          article: {
            studyIndex: 0,
            bookList: [{ words: [], articles: [{ text: 'Hello.', audioFileId: 'tone' }] }],
          },
        },
      },
      setting: { version: 23, val: { shortcutKeyMap: {} } },
      PracticeSaveWord: { version: 2, val: word() },
      PracticeSaveArticle: { version: 1, val: article() },
    },
  }
  const audio = [{ id: 'tone', file: new Blob(['synthetic audio bytes']) }]
  return { ...helper, events, backup, audio }
}

for (const [name, mutate] of invalidSettings) {
  test(`ZIP rejects ${name} before any migrator and accepts a corrected retry`, async () => {
    const h = harness()
    mutate(h.backup.val.setting.val)
    await assert.rejects(h.prepareBackupImport(JSON.stringify(h.backup), h.audio), /Invalid backup/)
    assert.deepEqual(h.events, [])
    h.backup.val.setting.val = { shortcutKeyMap: {} }
    await h.prepareBackupImport(JSON.stringify(h.backup), h.audio)
    assert.deepEqual(h.events, ['dict', 'setting', 'word'])
  })
}

for (const [name, mutate] of [
  [
    'word list',
    b => {
      b.PracticeSaveWord.val.taskWordsStr.new = [42]
    },
  ],
  [
    'empty word identifier',
    b => {
      b.PracticeSaveWord.val.taskWordsStr.new = ['']
    },
  ],
  [
    'word position',
    b => {
      b.PracticeSaveWord.val.practiceData.index = -1
    },
  ],
  [
    'word index past list',
    b => {
      b.PracticeSaveWord.val.practiceData.index = 3
    },
  ],
  [
    'word question candidates',
    b => {
      b.PracticeSaveWord.val.practiceData.question = { candidates: [], correctIndex: 0 }
    },
  ],
  [
    'word question correct word',
    b => {
      b.PracticeSaveWord.val.practiceData.question = {
        candidates: [
          { word: { word: 'hello' }, similarity: 1 },
          { word: { word: 'world' }, similarity: 0.2 },
        ],
        correctIndex: 1,
      }
    },
  ],
  [
    'word loop range',
    b => {
      b.PracticeSaveWord.val.sessionSnapshot.cursor.loop = { startIndex: 0, endIndex: 6, subStepIndex: 1 }
    },
  ],
  [
    'word working keys',
    b => {
      b.PracticeSaveWord.val.sessionSnapshot.nodeWorkingWordKeys = ['missing']
    },
  ],
  [
    'word wrong-word-clear cursor',
    b => {
      b.PracticeSaveWord.val.sessionSnapshot.cursor.inWrongWordClear = true
      b.PracticeSaveWord.val.sessionSnapshot.cursor.endActionIndex = null
    },
  ],
  [
    'statistics pair',
    b => {
      delete b.PracticeSaveWord.val.statStoreData
    },
  ],
  [
    'timer segment',
    b => {
      b.PracticeSaveWord.val.statStoreData.segments = [[4, 1]]
    },
  ],
  [
    'session cursor',
    b => {
      b.PracticeSaveWord.val.sessionSnapshot.cursor.nodeIndex = 0.5
    },
  ],
  [
    'article position',
    b => {
      b.PracticeSaveArticle.val.practiceData.wordIndex = '1'
    },
  ],
  [
    'article statistics',
    b => {
      b.PracticeSaveArticle.val.statStoreData.wrong = -1
    },
  ],
]) {
  test(`ZIP rejects damaged ${name} before all migration and write side effects`, async () => {
    const h = harness()
    mutate(h.backup.val)
    await assert.rejects(async () => {
      await h.prepareBackupImport(JSON.stringify(h.backup), h.audio)
      h.events.push('write')
    }, /Invalid backup practice cache/)
    assert.deepEqual(h.events, [])
  })
}

for (const version of [4, 5]) {
  test(`v${version} ZIP preserves current caches and audio references`, async () => {
    const h = harness()
    h.backup.version = version
    const text = JSON.stringify(h.backup)
    const result = await h.prepareBackupImport(text, h.audio)
    assert.deepEqual(JSON.parse(JSON.stringify(result.PracticeSaveWord)), h.backup.val.PracticeSaveWord)
    assert.deepEqual(JSON.parse(JSON.stringify(result.PracticeSaveArticle)), h.backup.val.PracticeSaveArticle)
    assert.equal(result.dict.val.article.bookList[0].articles[0].audioFileId, 'tone')
    assert.equal(JSON.stringify(h.backup), text)
    assert.deepEqual(h.events, ['dict', 'setting', 'word'])
  })
}

test('ZIP accepts legacy full-word and compact caches without timer or session fields', async () => {
  for (const compact of [false, true]) {
    const h = harness()
    const value = h.backup.val.PracticeSaveWord
    value.version = 1
    delete value.val.sessionSnapshot
    if (!compact) {
      value.val.taskWords = { new: [{ word: 'hello' }], review: [] }
      delete value.val.taskWordsStr
      value.val.practiceData.words = [{ word: 'hello' }]
      value.val.practiceData.wrongWords = []
      delete value.val.practiceData.wordsStr
      delete value.val.practiceData.wrongWordsStr
    }
    await h.prepareBackupImport(JSON.stringify(h.backup), h.audio)
    assert.deepEqual(h.events, ['dict', 'setting', 'word'])
  }
})

test('ZIP preserves absent, null-envelope and null-payload cache compatibility', async () => {
  for (const state of ['absent', 'null', 'null-payload', 'tasks-only']) {
    const h = harness()
    for (const key of ['PracticeSaveWord', 'PracticeSaveArticle']) {
      if (state === 'absent') delete h.backup.val[key]
      else if (state === 'null') h.backup.val[key] = null
      else h.backup.val[key].val = null
    }
    if (state === 'tasks-only') h.backup.val.PracticeSaveWord.val = { taskWordsStr: { new: [], review: [] } }
    await h.prepareBackupImport(JSON.stringify(h.backup), h.audio)
    assert.deepEqual(h.events, ['dict', 'setting', 'word'])
  }
})

test('ZIP rejects invalid legacy words and supports retry with repaired input', async () => {
  const h = harness()
  h.backup.val.PracticeSaveWord = { version: 1, val: { taskWords: { new: [{}], review: [] } } }
  await assert.rejects(h.prepareBackupImport(JSON.stringify(h.backup), h.audio), /Invalid backup practice cache/)
  assert.deepEqual(h.events, [])
  h.backup.val.PracticeSaveWord.val.taskWords.new = [{ word: 'hello' }]
  await h.prepareBackupImport(JSON.stringify(h.backup), h.audio)
  assert.deepEqual(h.events, ['dict', 'setting', 'word'])
})

test('ZIP preflight runs the actual legacy cache migration without storage access', async () => {
  for (const compact of [false, true]) {
    const h = harness(true)
    const envelope = h.backup.val.PracticeSaveWord
    envelope.version = 1
    delete envelope.val.sessionSnapshot
    if (!compact) {
      envelope.val.taskWords = { new: [{ word: 'hello' }], review: [] }
      delete envelope.val.taskWordsStr
      envelope.val.practiceData.words = [{ word: 'hello' }]
      envelope.val.practiceData.wrongWords = []
      delete envelope.val.practiceData.wordsStr
      delete envelope.val.practiceData.wrongWordsStr
    }
    const result = await h.prepareBackupImport(JSON.stringify(h.backup), h.audio)
    assert.equal(result.PracticeSaveWord.version, 2)
    assert.deepEqual(Array.from(result.PracticeSaveWord.val.taskWordsStr.new), ['hello'])
    assert.deepEqual(Array.from(result.PracticeSaveWord.val.practiceData.wordsStr), ['hello'])
    assert.ok(result.PracticeSaveWord.val.sessionSnapshot.flowId)
    assert.deepEqual(h.events, ['dict', 'setting', 'word'])
  }
})

test('setting import failure restores loading and never commits or reports success; repaired retry commits', async () => {
  const h = harness(true)
  const source = readFileSync(resolve(root, 'app/pages/setting.vue'), 'utf8')
  const start = source.indexOf('async function importJson(')
  const end = source.indexOf('\nasync function ', start + 1)
  assert.ok(start >= 0 && end > start)
  const sandbox = {
    exports: {},
    importLoading: false,
    showBackupGate: true,
    runtimeStore: { globalLoading: false },
    prepareBackupImport: h.prepareBackupImport,
    Supabase: {
      check: () => {
        h.events.push('check-sync')
        return true
      },
    },
    dataSyncPersistence: {
      forcePushLocalDataToRemote: async () => {
        h.events.push('commit')
        return true
      },
    },
    Toast: {
      error: () => h.events.push('error'),
      success: () => h.events.push('success'),
    },
    APP_VERSION: { version: 5 },
    t: value => value,
    nextTick: async () => {},
  }
  // Only the import handler runs; page setup and unrelated actions are excluded.
  const body = source.slice(start, source.indexOf('\n}', start) + 2)
  runInNewContext(
    ts.transpileModule(body + '\nexports.importJson = importJson', {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
    sandbox
  )
  h.backup.val.PracticeSaveArticle.val.practiceData.wordIndex = -1
  await sandbox.exports.importJson(JSON.stringify(h.backup), h.audio)
  assert.deepEqual(h.events, ['error'])
  assert.equal(sandbox.importLoading, false)
  assert.equal(sandbox.runtimeStore.globalLoading, false)
  assert.equal(sandbox.showBackupGate, true)
  h.events.length = 0
  h.backup.val.PracticeSaveArticle.val.practiceData.wordIndex = 0
  await sandbox.exports.importJson(JSON.stringify(h.backup), h.audio)
  assert.deepEqual(h.events, ['dict', 'setting', 'word', 'check-sync', 'commit', 'success'])
  assert.equal(sandbox.showBackupGate, false)
})
