import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const exports = {}
runInNewContext(
  ts.transpileModule(
    readFileSync(
      resolve(process.env.TYPEWORDS_TEST_ROOT || process.cwd(), 'app/core/composables/remotePracticeValidation.ts'),
      'utf8'
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText,
  { exports }
)
const validate = exports.validateRemotePracticeCache
const stats = () => ({
  stage: 0,
  startDate: 1,
  spend: 0,
  total: 0,
  newWordNumber: 0,
  reviewWordNumber: 0,
  inputWordNumber: 0,
  wrong: 0,
})
const word = () => ({
  taskWordsStr: { new: ['hello'], review: [] },
  practiceData: {
    index: 0,
    wordsStr: ['hello'],
    wrongWordsStr: [],
    excludeWords: [],
    allWrongWords: [],
    wrongTimesMap: {},
    ratingMap: {},
    wrongTimes: 0,
    question: null,
  },
  statStoreData: stats(),
  sessionSnapshot: {
    flowId: 'custom-flow',
    nodeWorkingWordKeys: ['hello'],
    cursor: { nodeIndex: 0, stepIndex: 0, inWrongWordClear: false, loop: null, endActionIndex: null },
  },
})
const article = () => ({
  practiceData: { sectionIndex: 0, sentenceIndex: 0, wordIndex: 0 },
  statStoreData: stats(),
})

test('valid current word and article sessions are accepted without mutating input', () => {
  for (const [kind, data, version] of [
    ['word', word(), 2],
    ['article', article(), 1],
  ]) {
    const before = structuredClone(data)
    validate(data, kind, version)
    assert.deepEqual(data, before)
  }
})

test('null clears, task-only sessions, and legacy full word objects remain supported', () => {
  validate(null, 'word', 1)
  validate(null, 'word', 2)
  validate(null, 'article', 1)
  validate({ taskWordsStr: { new: [], review: [] } }, 'word', 2)
  validate({ taskWords: { new: [{ word: 'hello' }], review: [] } }, 'word', 1)
  const legacy = word()
  delete legacy.sessionSnapshot
  validate(legacy, 'word', 1)
  // Existing compact writers may omit a snapshot even on the current envelope.
  validate(legacy, 'word', 2)
  legacy.taskWords = { new: [{ word: 'hello' }], review: [] }
  delete legacy.taskWordsStr
  legacy.practiceData.words = [{ word: 'hello' }]
  legacy.practiceData.wrongWords = []
  delete legacy.practiceData.wordsStr
  delete legacy.practiceData.wrongWordsStr
  validate(legacy, 'word', 1)
})

for (const [name, change] of [
  [
    'fractional index',
    v => {
      v.practiceData.index = 0.5
    },
  ],
  [
    'invalid word list',
    v => {
      v.practiceData.wordsStr = ['hello', 42]
    },
  ],
  [
    'invalid excluded words',
    v => {
      v.practiceData.excludeWords = {}
    },
  ],
  [
    'invalid rating map',
    v => {
      v.practiceData.ratingMap = { hello: 'easy' }
    },
  ],
  [
    'invalid count',
    v => {
      v.statStoreData.wrong = -1
    },
  ],
  [
    'invalid stage',
    v => {
      v.statStoreData.stage = '0'
    },
  ],
  [
    'invalid timer flag',
    v => {
      v.statStoreData.timerPaused = 1
    },
  ],
  [
    'invalid timer reason',
    v => {
      v.statStoreData.timerPauseReason = 'other'
    },
  ],
  [
    'reversed time segment',
    v => {
      v.statStoreData.segments = [[2, 1]]
    },
  ],
  [
    'invalid snapshot',
    v => {
      v.sessionSnapshot = []
    },
  ],
  [
    'negative cursor',
    v => {
      v.sessionSnapshot.cursor.nodeIndex = -1
    },
  ],
  [
    'invalid loop',
    v => {
      v.sessionSnapshot.cursor.loop = { startIndex: 2, endIndex: 1, subStepIndex: 0 }
    },
  ],
  [
    'invalid working keys',
    v => {
      v.sessionSnapshot.nodeWorkingWordKeys = [null]
    },
  ],
  [
    'orphan statistics',
    v => {
      delete v.practiceData
    },
  ],
  [
    'index past word list',
    v => {
      v.practiceData.index = 1
    },
  ],
  [
    'index on empty word list',
    v => {
      v.practiceData.wordsStr = []
      v.practiceData.index = 1
    },
  ],
  [
    'non-object question',
    v => {
      v.practiceData.question = 'fixture'
    },
  ],
  [
    'empty question candidates',
    v => {
      v.practiceData.question = { candidates: [], correctIndex: 0 }
    },
  ],
  [
    'question correctIndex past candidates',
    v => {
      v.practiceData.question = {
        candidates: [{ word: { word: 'hello' }, similarity: 1 }],
        correctIndex: 1,
      }
    },
  ],
  [
    'question candidate without word',
    v => {
      v.practiceData.question = { candidates: [{ similarity: 1 }], correctIndex: 0 }
    },
  ],
  [
    'question correct word not current',
    v => {
      v.practiceData.question = {
        candidates: [
          { word: { word: 'hello' }, similarity: 1 },
          { word: { word: 'world' }, similarity: 0.2 },
        ],
        correctIndex: 1,
      }
    },
  ],
  [
    'question without current word',
    v => {
      v.practiceData.wordsStr = []
      v.practiceData.index = 0
      v.practiceData.question = {
        candidates: [{ word: { word: 'hello' }, similarity: 1 }],
        correctIndex: 0,
      }
    },
  ],
  [
    'loop past word list',
    v => {
      v.sessionSnapshot.cursor.loop = { startIndex: 0, endIndex: 6, subStepIndex: 1 }
    },
  ],
  [
    'unknown working keys',
    v => {
      v.sessionSnapshot.nodeWorkingWordKeys = ['missing']
    },
  ],
  [
    'wrong-word-clear without end action',
    v => {
      v.sessionSnapshot.cursor.inWrongWordClear = true
      v.sessionSnapshot.cursor.endActionIndex = null
    },
  ],
]) {
  test(`rejects ${name}`, () => {
    const data = word()
    change(data)
    assert.throws(() => validate(data, 'word', 2), /Invalid remote practice cache/)
  })
}

test('article positions reject nonnumeric, fractional and unsafe indexes', () => {
  for (const invalid of ['1', -1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const data = article()
    data.practiceData.wordIndex = invalid
    assert.throws(() => validate(data, 'article', 1), /practiceData.wordIndex/)
  }
})

test('empty word identifiers cannot be silently filtered by legacy migration', () => {
  assert.throws(() => validate({ taskWordsStr: { new: [''], review: [] } }, 'word', 1), /Invalid remote practice cache/)
  assert.throws(
    () => validate({ taskWords: { new: [{ word: '' }], review: [] } }, 'word', 1),
    /Invalid remote practice cache/
  )
})

test('valid timer fields and in-range loop cursor remain accepted', () => {
  const data = word()
  const group = ['hello', 'world', 'foo', 'bar', 'baz', 'qux', 'quux']
  Object.assign(data.statStoreData, { timerPaused: true, timerPauseReason: 'manual', segments: [[1, 2]] })
  data.practiceData.wordsStr = group
  data.sessionSnapshot.nodeWorkingWordKeys = group
  data.sessionSnapshot.cursor.loop = { startIndex: 0, endIndex: 6, subStepIndex: 1 }
  validate(data, 'word', 2)
})

test('null or omitted questions stay accepted; a complete question is not rewritten', () => {
  const omitted = word()
  delete omitted.practiceData.question
  validate(omitted, 'word', 2)
  const asked = word()
  asked.practiceData.question = {
    candidates: [
      { word: { word: 'hello' }, similarity: 1 },
      { word: { word: 'world' }, similarity: 0.2 },
    ],
    correctIndex: 0,
  }
  const before = structuredClone(asked)
  validate(asked, 'word', 2)
  assert.deepEqual(asked, before)
})

test('empty word list only stays valid at index 0', () => {
  const data = word()
  data.practiceData.wordsStr = []
  data.practiceData.index = 0
  validate(data, 'word', 2)
})

test('wrong-word-clear, review working keys and prev() below a loop stay accepted', () => {
  const clearing = word()
  clearing.taskWordsStr.review = ['review-word']
  clearing.sessionSnapshot.nodeWorkingWordKeys = ['review-word']
  clearing.sessionSnapshot.cursor.inWrongWordClear = true
  clearing.sessionSnapshot.cursor.endActionIndex = 0
  validate(clearing, 'word', 2)

  const afterPrev = word()
  afterPrev.practiceData.wordsStr = ['a', 'b', 'c']
  afterPrev.practiceData.index = 0
  afterPrev.sessionSnapshot.nodeWorkingWordKeys = ['a', 'b', 'c']
  afterPrev.sessionSnapshot.cursor.loop = { startIndex: 1, endIndex: 2, subStepIndex: 0 }
  validate(afterPrev, 'word', 2)
})

test('legacy full-word question still matches the current identifier without rewrite', () => {
  const legacy = word()
  legacy.taskWords = { new: [{ word: 'hello' }], review: [] }
  delete legacy.taskWordsStr
  legacy.practiceData.words = [{ word: 'hello' }]
  legacy.practiceData.wrongWords = []
  delete legacy.practiceData.wordsStr
  delete legacy.practiceData.wrongWordsStr
  legacy.practiceData.question = {
    candidates: [{ word: { word: 'hello', extra: true }, similarity: 1 }],
    correctIndex: 0,
  }
  const before = structuredClone(legacy)
  validate(legacy, 'word', 1)
  assert.deepEqual(legacy, before)
})
