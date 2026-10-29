import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Rating } from 'ts-fsrs'
import { recordRecognitionResult } from '../app/core/composables/practice-words/recognition-result.ts'

const word = { word: 'abandon' } as any
const state = () => ({ ratingMap: {}, wrongTimes: 0, allWrongWords: [], wrongWords: [] }) as any

test('a correct recognition answer receives a Good review rating without adding a wrong word', () => {
  const data = state()
  recordRecognitionResult(data, word, true)
  assert.equal(data.ratingMap.abandon, Rating.Good)
  assert.equal(data.wrongTimes, 0)
  assert.deepEqual(data.wrongWords, [])
})

test('a missed word keeps its Again rating after correctly answering the consolidation question', () => {
  const data = state()
  recordRecognitionResult(data, word, false)
  assert.equal(data.ratingMap.abandon, Rating.Again)
  assert.deepEqual(data.allWrongWords, ['abandon'])
  assert.equal(data.wrongTimes, 1)
  data.wrongWords = [] // Navigator starts the consolidation pass with a fresh error list.
  recordRecognitionResult(data, word, true)
  assert.equal(data.ratingMap.abandon, Rating.Again)
  assert.deepEqual(data.wrongWords, [])
  assert.deepEqual(data.allWrongWords, ['abandon'])
})

test('repeated wrong answers are counted without duplicating a word in the error lists', () => {
  const data = state()
  recordRecognitionResult(data, word, false)
  recordRecognitionResult(data, word, false)
  assert.equal(data.wrongTimes, 2)
  assert.equal(data.wrongWords.length, 1)
  assert.equal(data.allWrongWords.length, 1)
})

test('ratings survive a cache round trip and remain conservative on retry', () => {
  const data = state()
  recordRecognitionResult(data, word, false)
  const restored = JSON.parse(JSON.stringify(data))
  recordRecognitionResult(restored, word, true)
  assert.equal(restored.ratingMap.abandon, Rating.Again)
})
