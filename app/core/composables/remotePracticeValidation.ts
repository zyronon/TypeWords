export class RemoteDataValidationError extends Error {
  constructor(
    message: string,
    public readonly unsupportedVersion?: number
  ) {
    super(message)
  }
}

const record = (value: any): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const index = (value: any) => Number.isSafeInteger(value) && value >= 0
const number = (value: any) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const strings = (value: any) => Array.isArray(value) && value.every(item => typeof item === 'string')
const wordKeys = (value: any) => strings(value) && value.every((item: string) => item.length > 0)

function assert(condition: boolean, field: string): asserts condition {
  if (!condition) throw new RemoteDataValidationError(`Invalid remote practice cache: ${field}`)
}

function validateStats(stats: any) {
  assert(record(stats), 'statStoreData')
  for (const key of ['startDate', 'spend', 'total', 'newWordNumber', 'reviewWordNumber', 'inputWordNumber', 'wrong']) {
    assert(number(stats[key]), `statStoreData.${key}`)
  }
  assert([0, 1, 2, 3, 4, 5, 6, 7, 12, 13].includes(stats.stage), 'statStoreData.stage')
  // Timer fields were added after the original caches shipped.
  if ('timerPaused' in stats) assert(typeof stats.timerPaused === 'boolean', 'timerPaused')
  if ('timerPauseReason' in stats)
    assert([null, 'manual', 'auto_visibility', 'auto_idle'].includes(stats.timerPauseReason), 'timerPauseReason')
  if ('segments' in stats) {
    assert(
      Array.isArray(stats.segments) &&
        stats.segments.every(
          (segment: any) =>
            Array.isArray(segment) && segment.length === 2 && segment.every(number) && segment[1] >= segment[0]
        ),
      'segments'
    )
  }
}

function wordId(item: any, compact: boolean): string {
  return compact ? item : item.word
}

function validateQuestion(question: any, currentWord: string | undefined) {
  if (question === null) return
  assert(record(question) && Array.isArray(question.candidates), 'practiceData.question')
  assert(question.candidates.length > 0, 'practiceData.question.candidates')
  assert(
    index(question.correctIndex) && question.correctIndex < question.candidates.length,
    'practiceData.question.correctIndex'
  )
  for (const candidate of question.candidates) {
    assert(
      record(candidate) &&
        number(candidate.similarity) &&
        record(candidate.word) &&
        typeof candidate.word.word === 'string' &&
        candidate.word.word.length > 0,
      'practiceData.question.candidates'
    )
  }
  // A stored question is for the current practice word. Do not retarget or drop it.
  assert(typeof currentWord === 'string' && currentWord.length > 0, 'practiceData.question.currentWord')
  assert(
    question.candidates[question.correctIndex].word.word === currentWord,
    'practiceData.question.correctIndex.word'
  )
}

function validateSnapshot(snapshot: any, context: { wordCount: number; sessionWordKeys: Set<string> }) {
  assert(record(snapshot) && typeof snapshot.flowId === 'string' && snapshot.flowId.length > 0, 'sessionSnapshot')
  const cursor = snapshot.cursor
  assert(record(cursor), 'cursor')
  assert(index(cursor.nodeIndex) && index(cursor.stepIndex), 'cursor.index')
  assert(typeof cursor.inWrongWordClear === 'boolean', 'cursor.inWrongWordClear')
  assert(cursor.endActionIndex === null || index(cursor.endActionIndex), 'cursor.endActionIndex')
  if (cursor.loop !== null) {
    assert(
      record(cursor.loop) &&
        index(cursor.loop.startIndex) &&
        index(cursor.loop.endIndex) &&
        cursor.loop.endIndex >= cursor.loop.startIndex &&
        index(cursor.loop.subStepIndex),
      'cursor.loop'
    )
    // Restore already rejects endIndex past the live word list; start<=end keeps start in range.
    assert(cursor.loop.endIndex < context.wordCount, 'cursor.loop.range')
  }
  // inWrongWordClear means an onEnd action is active; null is "not in onEnd".
  if (cursor.inWrongWordClear) assert(cursor.endActionIndex !== null, 'cursor.endActionIndex.wrongWordClear')
  if ('nodeWorkingWordKeys' in snapshot) {
    assert(wordKeys(snapshot.nodeWorkingWordKeys), 'nodeWorkingWordKeys')
    assert(
      snapshot.nodeWorkingWordKeys.every((key: string) => context.sessionWordKeys.has(key)),
      'nodeWorkingWordKeys.unknown'
    )
  }
}

/** Pure boundary check: never normalize, discard malformed entries, or touch local storage. */
export function validateRemotePracticeCache(value: any, kind: 'word' | 'article', version: number): void {
  if (value === null) return
  assert(record(value), 'data')
  if (kind === 'article') {
    assert(record(value.practiceData), 'practiceData')
    for (const key of ['sectionIndex', 'sentenceIndex', 'wordIndex']) {
      assert(index(value.practiceData[key]), `practiceData.${key}`)
    }
    validateStats(value.statStoreData)
    return
  }
  const compact = 'taskWordsStr' in value
  assert(version === 1 || compact, 'taskWordsStr')
  const words = (items: any) =>
    compact
      ? wordKeys(items)
      : Array.isArray(items) &&
        items.every(item => record(item) && typeof item.word === 'string' && item.word.length > 0)
  const tasks = compact ? value.taskWordsStr : value.taskWords
  assert(record(tasks) && words(tasks.new) && words(tasks.review), 'taskWords')
  const hasPractice = 'practiceData' in value
  const hasStats = 'statStoreData' in value
  assert(hasPractice === hasStats, 'incomplete session')
  let wordCount = 0
  const sessionWordKeys = new Set<string>()
  if (hasPractice) {
    const data = value.practiceData
    assert(record(data) && index(data.index), 'practiceData.index')
    const wordList = data[compact ? 'wordsStr' : 'words']
    assert(words(wordList), 'practiceData.words')
    assert(wordList.length === 0 ? data.index === 0 : data.index < wordList.length, 'practiceData.index.range')
    const wrongList = data[compact ? 'wrongWordsStr' : 'wrongWords']
    assert(words(wrongList), 'practiceData.wrongWords')
    wordCount = wordList.length
    for (const item of [...tasks.new, ...tasks.review, ...wordList, ...wrongList]) {
      sessionWordKeys.add(wordId(item, compact))
    }
    const currentWord = wordCount === 0 ? undefined : wordId(wordList[data.index], compact)
    if ('question' in data) validateQuestion(data.question, currentWord)
    for (const key of ['excludeWords', 'allWrongWords']) {
      if (key in data) assert(strings(data[key]), `practiceData.${key}`)
    }
    for (const key of ['wrongTimesMap', 'ratingMap']) {
      if (key in data) {
        assert(record(data[key]) && Object.values(data[key]).every(number), `practiceData.${key}`)
      }
    }
    if ('wrongTimes' in data) assert(number(data.wrongTimes), 'practiceData.wrongTimes')
    if ('isTypingWrongWord' in data)
      assert(typeof data.isTypingWrongWord === 'boolean', 'practiceData.isTypingWrongWord')
    validateStats(value.statStoreData)
  }
  if ('sessionSnapshot' in value) {
    assert(hasPractice, 'sessionSnapshot without practiceData')
    validateSnapshot(value.sessionSnapshot, { wordCount, sessionWordKeys })
  }
}
