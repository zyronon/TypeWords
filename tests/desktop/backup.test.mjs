import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = process.cwd()
const fixtures = new URL('./fixtures/backup/', import.meta.url)
const require = createRequire(import.meta.url)
const JSZip = require(resolve(root, 'public/libs/jszip.min.js'))
const fixture = JSON.parse(readFileSync(new URL('backup-fixture.json', fixtures)))
const tone = readFileSync(new URL('backup-tone.mp3', fixtures))
const constants = {
  EXPORT_DATA_KEY: { version: 5 },
  SAVE_SETTING_KEY: { version: 23 },
  SAVE_DICT_KEY: { version: 4 },
  LOCAL_FILE_KEY: 'typing-word-files',
  LIB_JS_URL: { JSZIP: '/libs/jszip.min.js' },
  PRACTICE_WORD_CACHE: { key: 'PracticeSaveWord', version: 2 },
  PRACTICE_ARTICLE_CACHE: { key: 'PracticeSaveArticle', version: 1 },
}
function evaluate(source, globals) {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  return runInNewContext(js, globals)
}

async function exportFixture(data = fixture, audio = tone) {
  const exports = {}
  evaluate(readFileSync(resolve(root, 'app/core/hooks/export.ts'), 'utf8'), {
    exports,
    useRuntimeConfig: () => ({ public: { isDesktop: false } }),
    Blob,
    require(name) {
      if (name === '../config/env' || name === '../utils/cache') return constants
      if (name === 'vue') return { ref: value => ({ value }) }
      if (name === '../utils') return { loadJsLib: async () => JSZip, shakeCommonDict: structuredClone }
      if (name === 'idb-keyval')
        return {
          get: async key => {
            assert.equal(key, constants.LOCAL_FILE_KEY)
            return [{ id: 'backup-tone', file: audio }]
          },
        }
      if (name === '../stores/base') return { useBaseStore: () => ({ $state: data.val.dict.val }) }
      if (name === '../stores/setting') return { useSettingStore: () => ({ $state: data.val.setting.val }) }
      if (name.includes('usePracticePersistence'))
        return {
          usePracticeWordPersistence: () => ({ getLocalDataCompact: async () => data.val.PracticeSaveWord.val }),
          usePracticeArticlePersistence: () => ({
            getLocalDataCompact: async () => data.val.PracticeSaveArticle.val,
          }),
        }
      return {}
    },
  })
  return Buffer.from(
    await exports
      .useExport()
      .buildExportZip()
      .then(b => b.arrayBuffer())
  )
}

test('actual application exporter produces compatible ZIP with custom audio and practice fields', async () => {
  const zip = await JSZip.loadAsync(await exportFixture())
  assert.deepEqual(JSON.parse(await zip.file('data.json').async('string')), fixture)
  assert.deepEqual(await zip.file('mp3/backup-tone.mp3').async('nodebuffer'), tone)
})

test('actual setting.vue ZIP import handler stages audio bytes and JSON without early writes', async () => {
  const source = readFileSync(resolve(root, 'app/pages/setting.vue'), 'utf8')
  const body = source.slice(source.indexOf('async function importData(e)'), source.indexOf('\nlet showBackupGate'))
  let data, records
  const helper = {}
  evaluate(readFileSync(resolve(root, 'app/core/composables/backupImport.ts'), 'utf8'), {
    exports: helper,
    require: () => ({}),
    Blob,
  })
  const sandbox = {
    exports: {},
    readBackupZip: helper.readBackupZip,
    importLoading: false,
    ...constants,
    loadJsLib: async () => JSZip,
    set: async (key, value) => {
      assert.fail('Import handler must not write audio before JSON validation')
    },
    importJson: async (value, audio) => {
      data = JSON.parse(value)
      records = audio
    },
    Toast: {
      error: value => {
        throw Error(value)
      },
    },
    t: value => value,
  }
  evaluate(body + '\nexports.importData = importData', sandbox)
  const file = await exportFixture()
  file.name = 'synthetic-backup.zip'
  await sandbox.exports.importData({ target: { files: [file] } })
  assert.deepEqual(data, fixture)
  assert.equal(records[0].id, 'backup-tone')
  assert.deepEqual(Buffer.from(await records[0].file.arrayBuffer()), tone)
  assert.equal(sandbox.importLoading, false)
})

test('synthetic ZIP read and re-export preserves data and bytes with stub stores (not browser UI)', async () => {
  const helper = {}
  evaluate(readFileSync(resolve(root, 'app/core/composables/backupImport.ts'), 'utf8'), {
    exports: helper,
    require: () => ({}),
    Blob,
  })
  const first = await JSZip.loadAsync(await exportFixture())
  const staged = await helper.readBackupZip(first)
  const data = JSON.parse(staged.text)
  const audio = Buffer.from(await staged.audio[0].file.arrayBuffer())
  const second = await JSZip.loadAsync(await exportFixture(data, audio))
  assert.deepEqual(JSON.parse(await second.file('data.json').async('string')), fixture)
  assert.deepEqual(await second.file('mp3/backup-tone.mp3').async('nodebuffer'), tone)
})
