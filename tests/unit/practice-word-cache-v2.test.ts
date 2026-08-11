import { describe, expect, it } from 'vitest'
import { CompareResult, IdentifyMethod, WordPracticeMode, WordPracticeStage, WordPracticeType } from '@/core/types/enum.ts'
import { shouldFetchRemote } from '@/core/utils'
import {
  checkAndUpgradePracticeWordCache,
  PRACTICE_WORD_CACHE,
  resolveLegacyPracticeWordCursor,
} from '@/core/utils/cache.ts'
import {
  addWrongWordKey,
  resolveNewerRemotePracticeCacheTime,
  UnsupportedPracticeCacheVersionError,
} from '@/core/composables/practice-words/practice-word-session.ts'

describe('wrong word keys', () => {
  it('adds each wrong word only once', () => {
    const words = ['word']
    expect(addWrongWordKey(words, 'word')).toBe(false)
    expect(addWrongWordKey(words, 'Other')).toBe(true)
    expect(words).toEqual(['word', 'Other'])
  })
})

describe('practice cache version selection', () => {
  it('uses the shared practice cache version as the current v2 format', () => {
    expect(PRACTICE_WORD_CACHE).toMatchObject({ key: 'PracticeSaveWord', version: 2 })
  })

  it('prefers v2 over a newer timestamped v1 cache', () => {
    expect(shouldFetchRemote(
      '2029-01-01T00:00:00Z',
      '2030-01-01T00:00:00Z',
      1,
      2
    )).toBe(CompareResult.LocalNewer)
  })

  it('uses updated_at within the same format version', () => {
    expect(shouldFetchRemote(
      '2029-01-01T00:00:00Z',
      '2030-01-01T00:00:00Z',
      1,
      1
    )).toBe(CompareResult.RemoteNewer)
  })

  it('keeps a local v2 tombstone ahead of stale remote v1 data', () => {
    expect(shouldFetchRemote(
      '2030-01-01T00:00:00Z',
      '2031-01-01T00:00:00Z',
      1,
      2
    )).toBe(CompareResult.LocalNewer)
  })
})

describe('remote practice cache update detection', () => {
  it('returns only a newer v2 timestamp', () => {
    const known = Date.parse('2030-01-01T00:00:00Z')
    expect(resolveNewerRemotePracticeCacheTime({
      data_version: 2,
      updated_at: '2030-01-01T00:00:01Z',
    }, known)).toBe(Date.parse('2030-01-01T00:00:01Z'))
    expect(resolveNewerRemotePracticeCacheTime({
      data_version: 2,
      updated_at: '2030-01-01T00:00:00Z',
    }, known)).toBeNull()
    expect(resolveNewerRemotePracticeCacheTime({
      data_version: 1,
      updated_at: '2031-01-01T00:00:00Z',
    }, known)).toBeNull()
  })

  it('blocks a future remote cache version', () => {
    expect(() => resolveNewerRemotePracticeCacheTime({
      data_version: 3,
      updated_at: '2030-01-01T00:00:01Z',
    }, 0)).toThrow(UnsupportedPracticeCacheVersionError)
  })
})

describe('v1 stage to v2 cursor', () => {
  it.each([
    [WordPracticeMode.System, WordPracticeStage.FollowWriteNewWord, 0, 0],
    [WordPracticeMode.System, WordPracticeStage.ListenNewWord, 0, 1],
    [WordPracticeMode.System, WordPracticeStage.DictationNewWord, 0, 2],
    [WordPracticeMode.System, WordPracticeStage.IdentifyReview, 1, 0],
    [WordPracticeMode.System, WordPracticeStage.ListenReview, 1, 1],
    [WordPracticeMode.System, WordPracticeStage.DictationReview, 1, 2],
    [WordPracticeMode.Review, WordPracticeStage.ListenReview, 0, 1],
    [WordPracticeMode.ListenOnly, WordPracticeStage.ListenReview, 1, 0],
  ] as const)('maps mode %s stage %s', (mode, stage, nodeIndex, stepIndex) => {
    expect(resolveLegacyPracticeWordCursor(mode, stage)).toMatchObject({
      nodeIndex,
      stepIndex,
      inWrongWordClear: false,
      loop: null,
      endActionIndex: null,
    })
  })

  it('restores v1 wrongWordClear and the active Spell group', () => {
    expect(resolveLegacyPracticeWordCursor(WordPracticeMode.System, WordPracticeStage.ListenReview, {
      isTypingWrongWord: true,
      practiceType: WordPracticeType.Spell,
      index: 8,
      wordsLength: 14,
    })).toEqual({
      nodeIndex: 1,
      stepIndex: 1,
      inWrongWordClear: true,
      endActionIndex: 0,
      loop: { startIndex: 7, endIndex: 13, subStepIndex: 0 },
    })
  })
})

describe('public practice cache upgrade', () => {
  it('upgrades a v1 compact cache to the current format', () => {
    const upgraded = checkAndUpgradePracticeWordCache({
      version: 1,
      updated_at: '2030-01-01T00:00:00Z',
      val: {
        taskWordsStr: { new: ['follow'], review: ['write'] },
        practiceData: {
          index: 0,
          wordsStr: ['follow'],
          wrongWordsStr: ['follow'],
          isTypingWrongWord: true,
          question: { stale: true },
        },
        statStoreData: { stage: WordPracticeStage.FollowWriteNewWord },
      },
    }, {
      wordPracticeMode: WordPracticeMode.System,
      wordPracticeType: WordPracticeType.FollowWrite,
    })

    expect(upgraded.version).toBe(PRACTICE_WORD_CACHE.version)
    expect(upgraded.updated_at).toBe('2030-01-01T00:00:00Z')
    expect(upgraded.val?.practiceData).not.toHaveProperty('isTypingWrongWord')
    expect(upgraded.val?.practiceData?.question).toBeNull()
    expect(upgraded.val?.sessionSnapshot?.cursor.inWrongWordClear).toBe(true)
    expect(upgraded.val?.sessionSnapshot).not.toHaveProperty('identifyMethod')
  })

  it.each([
    IdentifyMethod.SelfAssessment,
    IdentifyMethod.WordTest,
    IdentifyMethod.QuickIdentify,
  ])('restores an Identify cursor without preserving legacy identify method %s', identifyMethod => {
    const context = {
      wordPracticeMode: WordPracticeMode.System,
      wordPracticeType: WordPracticeType.Identify,
      identifyMethod,
    }
    const upgraded = checkAndUpgradePracticeWordCache({
      version: 1,
      val: {
        taskWordsStr: { new: [], review: ['identify'] },
        practiceData: {
          index: 0,
          wordsStr: ['identify'],
          wrongWordsStr: [],
          question: { stale: true },
        },
        statStoreData: { stage: WordPracticeStage.IdentifyReview },
      },
    }, context)

    expect(upgraded.val?.practiceData?.question).toBeNull()
    expect(upgraded.val?.sessionSnapshot?.cursor).toMatchObject({ nodeIndex: 1, stepIndex: 0 })
    expect(upgraded.val?.sessionSnapshot).not.toHaveProperty('identifyMethod')
  })
})
