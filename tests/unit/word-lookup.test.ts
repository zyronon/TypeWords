import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queryWord } = vi.hoisted(() => ({ queryWord: vi.fn() }))

vi.mock('../../app/core/apis/words.ts', () => ({ queryWord }))

import { normalizeWordForLookup, resolveWordLookup } from '../../app/core/utils/wordLookup.ts'

describe('word lookup', () => {
  beforeEach(() => {
    queryWord.mockReset()
    queryWord.mockResolvedValue({ success: true, data: { word: 'Review' } })
  })

  it('按点击原词精确查询一次，不转换大小写或词形', async () => {
    const rawWord = `Review-${Date.now()}`
    queryWord.mockResolvedValueOnce({ success: true, data: { word: rawWord } })

    expect(normalizeWordForLookup(rawWord)).toEqual([rawWord])
    const result = await resolveWordLookup(rawWord)

    expect(result.query).toBe(rawWord)
    expect(result.candidates).toEqual([rawWord])
    expect(queryWord).toHaveBeenCalledTimes(1)
    expect(queryWord).toHaveBeenCalledWith({ word: rawWord })
  })

  it('大小写不同的原词使用各自独立的精确查询', async () => {
    const suffix = Date.now()
    const upperWord = `Review${suffix}`
    const lowerWord = `review${suffix}`
    queryWord
      .mockResolvedValueOnce({ success: false, data: null })
      .mockResolvedValueOnce({ success: false, data: null })

    await resolveWordLookup(upperWord)
    await resolveWordLookup(lowerWord)

    expect(queryWord).toHaveBeenNthCalledWith(1, { word: upperWord })
    expect(queryWord).toHaveBeenNthCalledWith(2, { word: lowerWord })
    expect(queryWord).toHaveBeenCalledTimes(2)
  })
})
