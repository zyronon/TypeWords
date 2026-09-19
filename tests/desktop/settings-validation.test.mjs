import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { settingsMigrationSource } from './settings-migration-source.mjs'
import { ConvertStepUnitToMinutes, createEmptyCard, default_w, fsrs, Rating } from 'ts-fsrs'

const root = process.env.TYPEWORDS_TEST_ROOT || process.cwd()
function load(source, modules = {}) {
  const exports = {}
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require(name) {
        assert.ok(Object.hasOwn(modules, name), `Unexpected import: ${name}`)
        return modules[name]
      },
    }
  )
  return exports
}
const { validateStoredSettings } = load(
  readFileSync(resolve(root, 'app/core/composables/settingsValidation.ts'), 'utf8')
)

test('settings boundary accepts real current defaults without modifying them', () => {
  const defaults = load(settingsMigrationSource(root), {
    '../types/enum': load(readFileSync(resolve(root, 'app/core/types/enum.ts'), 'utf8')),
    'idb-keyval': {},
    '../composables/useDataSyncPersistence': {},
  }).getDefaultSettingState()
  const before = JSON.stringify(defaults)
  validateStoredSettings(defaults)
  assert.equal(JSON.stringify(defaults), before)
})

test('settings boundary preserves omitted legacy collections, empty shortcuts and unknown fields', () => {
  for (const value of [
    { shortcutKeyMap: {} },
    { shortcutKeyMap: { Next: '', historical: 'Alt+N' }, customMetadata: { version: 'legacy' } },
    { shortcutKeyMap: {}, ttsVoiceMap: [{ key: 'win+edge', voice: '' }], fontSize: { wordForeignFontSize: 48 } },
  ]) {
    const before = JSON.stringify(value)
    validateStoredSettings(value)
    assert.equal(JSON.stringify(value), before)
  }
})

test('settings boundary rejects unsafe numeric font sizes and incomplete voice entries', () => {
  for (const value of [0, -1, NaN, Infinity, -Infinity, null]) {
    assert.throws(
      () => validateStoredSettings({ shortcutKeyMap: {}, fontSize: { wordForeignFontSize: value } }),
      /fontSize/
    )
  }
  for (const entry of [{}, { key: 'win+edge' }, { voice: 'Voice' }, []]) {
    assert.throws(() => validateStoredSettings({ shortcutKeyMap: {}, ttsVoiceMap: [entry] }), /ttsVoiceMap/)
  }
})

test('FSRS settings preserve partial, legacy weights and engine-compatible steps without mutation', () => {
  for (const parameters of [
    {},
    { request_retention: 1, maximum_interval: 1.5 },
    { enable_fuzz: false, enable_short_term: false, learning_steps: [], relearning_steps: [] },
    { learning_steps: ['0m', '1m', '0.5h', '2h', '1d'] },
    ...[17, 19, 21].map(length => ({ w: default_w.slice(0, length) })),
    { metadata: { historical: true } },
  ]) {
    const value = { shortcutKeyMap: {}, fsrsParameters: parameters }
    const before = structuredClone(value)
    validateStoredSettings(value)
    assert.deepEqual(value, before)
    const engine = fsrs(parameters)
    const now = new Date('2026-09-15T00:00:00Z')
    for (const grade of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
      const card = engine.next(createEmptyCard(now), now, grade).card
      assert.ok(Number.isFinite(card.due.getTime()))
    }
    for (const step of parameters.learning_steps ?? []) {
      assert.ok(Number.isFinite(ConvertStepUnitToMinutes(step)))
    }
  }
})

test('FSRS settings reject non-JSON non-finite values and sparse arrays', () => {
  for (const bad of [NaN, Infinity, -Infinity, undefined]) {
    for (const parameters of [
      { request_retention: bad },
      { maximum_interval: bad },
      { w: [...default_w.slice(0, 20), bad] },
      { enable_fuzz: bad },
      { enable_short_term: bad },
    ]) {
      assert.throws(() => validateStoredSettings({ shortcutKeyMap: {}, fsrsParameters: parameters }), /fsrsParameters/)
    }
  }
  for (const parameters of [{ w: Array(21) }, { learning_steps: Array(1) }, { relearning_steps: Array(1) }]) {
    assert.throws(() => validateStoredSettings({ shortcutKeyMap: {}, fsrsParameters: parameters }), /fsrsParameters/)
  }
})

test('audio scalars preserve omitted fields, mute, fractional volumes and historical positive speeds', () => {
  for (const fields of [
    {},
    {
      wordSoundVolume: 0,
      sentenceSoundVolume: 100,
      articleSoundVolume: 37.5,
      keyboardSoundVolume: 0,
      effectSoundVolume: 100,
    },
    { wordSoundSpeed: 0.25, sentenceSoundSpeed: 1.25, articleSoundSpeed: 4 },
  ]) {
    const value = { shortcutKeyMap: {}, ...fields }
    const before = structuredClone(value)
    validateStoredSettings(value)
    assert.deepEqual(value, before)
  }
})

test('audio scalars reject non-JSON invalid values without coercing or modifying input', () => {
  for (const field of [
    'wordSoundVolume',
    'sentenceSoundVolume',
    'articleSoundVolume',
    'keyboardSoundVolume',
    'effectSoundVolume',
    'wordSoundSpeed',
    'sentenceSoundSpeed',
    'articleSoundSpeed',
  ]) {
    for (const bad of [NaN, Infinity, -Infinity, undefined, false, {}, []]) {
      const value = { shortcutKeyMap: {}, [field]: bad }
      const before = structuredClone(value)
      assert.throws(() => validateStoredSettings(value), new RegExp(field))
      assert.deepEqual(value, before)
    }
  }
})

test('practice controls preserve legacy omissions, custom sentinel and values outside current UI ranges', () => {
  for (const fields of [
    {},
    { repeatCount: 4, repeatCustomCount: null },
    { repeatCount: 100 },
    { repeatCount: 100, repeatCustomCount: null },
    { repeatCount: 100, repeatCustomCount: 20 },
    { waitTimeForChangeWord: 0, spaceCooldownTime: 0, wordReviewRatio: 0 },
    { waitTimeForChangeWord: 10000.5, spaceCooldownTime: 10000.5, wordReviewRatio: 1.5 },
  ]) {
    const value = { shortcutKeyMap: {}, ...fields }
    const before = structuredClone(value)
    validateStoredSettings(value)
    assert.deepEqual(value, before)
  }
})

test('practice controls reject non-JSON invalid scalars without mutation or coercion', () => {
  for (const field of [
    'repeatCount',
    'repeatCustomCount',
    'waitTimeForChangeWord',
    'spaceCooldownTime',
    'wordReviewRatio',
  ]) {
    for (const bad of [NaN, Infinity, -Infinity, undefined, false, {}, []]) {
      const value = { shortcutKeyMap: {}, [field]: bad }
      const before = structuredClone(value)
      assert.throws(() => validateStoredSettings(value), new RegExp(field))
      assert.deepEqual(value, before)
    }
  }
})

function gradeByWrongTimes(wrongTimes, easy, good, hard) {
  if (wrongTimes <= easy) return Rating.Easy
  if (wrongTimes <= good) return Rating.Good
  if (wrongTimes <= hard) return Rating.Hard
  return Rating.Again
}

test('FSRS grade limits preserve omissions, defaults, equals and values above the current UI max', () => {
  for (const fields of [
    {},
    { fsrsEasyLimit: 0, fsrsGoodLimit: 3, fsrsHardLimit: 6 },
    { fsrsEasyLimit: 0 },
    { fsrsGoodLimit: 3 },
    { fsrsHardLimit: 6 },
    { fsrsEasyLimit: 2, fsrsGoodLimit: 2, fsrsHardLimit: 2 },
    { fsrsEasyLimit: 0, fsrsGoodLimit: 0, fsrsHardLimit: 6 },
    { fsrsEasyLimit: 0, fsrsGoodLimit: 12, fsrsHardLimit: 20 },
    { fsrsEasyLimit: 10, fsrsGoodLimit: 10, fsrsHardLimit: 10 },
  ]) {
    const value = { shortcutKeyMap: {}, ...fields }
    const before = structuredClone(value)
    validateStoredSettings(value)
    assert.deepEqual(value, before)
  }
  assert.deepEqual(
    [0, 1, 3, 4, 6, 7].map(wrong => gradeByWrongTimes(wrong, 0, 3, 6)),
    [Rating.Easy, Rating.Good, Rating.Good, Rating.Hard, Rating.Hard, Rating.Again]
  )
})

test('FSRS grade limits reject unsafe counts and inverted cascade order without mutation', () => {
  for (const field of ['fsrsEasyLimit', 'fsrsGoodLimit', 'fsrsHardLimit']) {
    for (const bad of [NaN, Infinity, -Infinity, undefined, false, {}, [], 1.5, -1, null]) {
      const value = { shortcutKeyMap: {}, [field]: bad }
      const before = structuredClone(value)
      assert.throws(() => validateStoredSettings(value), new RegExp(field))
      assert.deepEqual(value, before)
    }
  }
  for (const fields of [
    { fsrsEasyLimit: 4, fsrsGoodLimit: 2 },
    { fsrsGoodLimit: 8, fsrsHardLimit: 3 },
    { fsrsEasyLimit: 5, fsrsHardLimit: 1 },
    { fsrsEasyLimit: 6, fsrsGoodLimit: 3, fsrsHardLimit: 0 },
  ]) {
    const value = { shortcutKeyMap: {}, ...fields }
    const before = structuredClone(value)
    assert.throws(() => validateStoredSettings(value), /fsrs(Easy|Good)Limit/)
    assert.deepEqual(value, before)
  }
})

test('millisecond timers accept the signed 32-bit max and reject overflow without mutating input', () => {
  for (const fields of [
    { waitTimeForChangeWord: 2147483647, spaceCooldownTime: 2147483647 },
    { waitTimeForChangeWord: 20000, spaceCooldownTime: 15000.25 },
  ]) {
    const value = { shortcutKeyMap: {}, ...fields }
    const before = structuredClone(value)
    validateStoredSettings(value)
    assert.deepEqual(value, before)
  }
  for (const field of ['waitTimeForChangeWord', 'spaceCooldownTime']) {
    for (const bad of [2147483648, Number.MAX_VALUE, Number.MAX_SAFE_INTEGER]) {
      const value = { shortcutKeyMap: {}, [field]: bad }
      const before = structuredClone(value)
      assert.throws(() => validateStoredSettings(value), new RegExp(field))
      assert.deepEqual(value, before)
    }
  }
})
