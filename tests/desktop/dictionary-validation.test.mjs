import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { dictionaryFixture, fsrsCardFixture } from './dictionary-validation-fixtures.mjs'
import { createEmptyCard, fsrs, Rating } from 'ts-fsrs'

const exports = {}
runInNewContext(
  ts.transpileModule(
    readFileSync(
      resolve(process.env.TYPEWORDS_TEST_ROOT || process.cwd(), 'app/core/composables/dictionaryValidation.ts'),
      'utf8'
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText,
  { exports }
)

test('dictionary boundary preserves legacy identifiers, omitted optional maps and unknown metadata', () => {
  const value = dictionaryFixture()
  delete value.simpleWords
  delete value.noteData
  delete value.fsrsData
  value.metadata = { historical: true }
  const before = JSON.stringify(value)
  exports.validateStoredDictionary(value)
  assert.equal(JSON.stringify(value), before)
})

test('dictionary boundary allows empty unselected sections but rejects impossible selections', () => {
  const value = { word: { bookList: [], studyIndex: -1 }, article: { bookList: [], studyIndex: -1 } }
  exports.validateStoredDictionary(value)
  for (const index of [0, -2, NaN, Infinity, '0', null]) {
    value.word.studyIndex = index
    assert.throws(() => exports.validateStoredDictionary(value), /studyIndex/)
  }
})

test('dictionary boundary rejects empty word identifiers without mutation or silent repair', () => {
  for (const kind of ['word', 'article']) {
    const value = dictionaryFixture()
    value[kind].bookList[0].words = [{ word: '' }]
    const before = structuredClone(value)
    assert.throws(() => exports.validateStoredDictionary(value), /words/)
    assert.deepEqual(value, before)
  }
})

test('dictionary boundary still accepts non-empty historical word identifiers', () => {
  const value = dictionaryFixture()
  value.word.bookList[0].words = [{ word: 'hello' }, { word: 'a', extra: true }]
  const before = structuredClone(value)
  exports.validateStoredDictionary(value)
  assert.deepEqual(value, before)
})

test('FSRS boundary accepts engine-generated cards before and after JSON round trips without mutation', () => {
  const engine = fsrs({ enable_fuzz: false })
  const now = new Date('2026-09-15T00:00:00.000Z')
  const empty = createEmptyCard(now)
  const cards = [empty]
  for (const grade of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
    const first = engine.next(empty, now, grade).card
    cards.push(first, engine.next(first, first.due, Rating.Again).card)
  }
  for (const card of cards) {
    for (const candidate of [card, JSON.parse(JSON.stringify(card))]) {
      const value = dictionaryFixture()
      value.fsrsData.hello = candidate
      const before = structuredClone(value)
      exports.validateStoredDictionary(value)
      assert.deepEqual(value, before)
    }
  }
})

test('FSRS boundary preserves legacy steps, optional review date, supported date/state inputs and metadata', () => {
  for (const state of [0, 1, 2, 3, 'New', 'Learning', 'Review', 'Relearning']) {
    const value = dictionaryFixture()
    value.fsrsData.hello = { ...fsrsCardFixture(), state, due: 0, last_review: null, metadata: { old: true } }
    exports.validateStoredDictionary(value)
    delete value.fsrsData.hello.last_review
    exports.validateStoredDictionary(value)
  }
})

test('FSRS boundary rejects non-finite numbers, unsafe counters and invalid Date objects', () => {
  for (const field of [
    'stability',
    'difficulty',
    'elapsed_days',
    'scheduled_days',
    'reps',
    'lapses',
    'learning_steps',
  ]) {
    for (const bad of [NaN, Infinity, -Infinity, null, '1', -1]) {
      const value = dictionaryFixture()
      value.fsrsData.hello[field] = bad
      assert.throws(() => exports.validateStoredDictionary(value), /fsrsData/, `${field}=${bad}`)
    }
  }
  for (const field of ['reps', 'lapses', 'learning_steps']) {
    for (const bad of [0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const value = dictionaryFixture()
      value.fsrsData.hello[field] = bad
      assert.throws(() => exports.validateStoredDictionary(value), /fsrsData/)
    }
  }
  for (const due of [new Date(NaN), NaN, Infinity, 9e15, true, [], '']) {
    const value = dictionaryFixture()
    value.fsrsData.hello.due = due
    assert.throws(() => exports.validateStoredDictionary(value), /fsrsData/)
  }
})
