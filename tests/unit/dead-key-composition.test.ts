import { beforeEach, describe, expect, it } from 'vitest'
import {
  resetDeadKeyCompositionState,
  shouldIgnoreDeadKeyCompositionSpace,
} from '../../app/core/utils/dead-key-composition.ts'

describe('dead key composition space swallowing', () => {
  beforeEach(() => {
    resetDeadKeyCompositionState()
  })

  it('swallows the space that terminates a dead-key composition (es / US-Intl, key=Dead)', () => {
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: 'Dead', code: 'Quote' })).toBe(false)
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: ' ', code: 'Space' })).toBe(true)
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: ' ', code: 'Space' })).toBe(false)
  })

  it('does not swallow a normal space after a regular letter (plain English layout)', () => {
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: 's', code: 'KeyS' })).toBe(false)
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: ' ', code: 'Space' })).toBe(false)
  })

  it('resets the dead key flag after any intermediate non-space key', () => {
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: 'Dead', code: 'Quote' })).toBe(false)
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: 'x', code: 'KeyX' })).toBe(false)
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: ' ', code: 'Space' })).toBe(false)
  })

  it('never swallows spaces pressed with modifiers', () => {
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: 'Dead', code: 'Quote' })).toBe(false)
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: ' ', code: 'Space', metaKey: true })).toBe(false)
  })
})
