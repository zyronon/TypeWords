import { beforeEach, describe, expect, it } from 'vitest'
import {
  confirmCharacterInserted,
  isDeadKeyEvent,
  isSpaceKeydownEvent,
  resetDeadKeyCompositionState,
  shouldIgnoreDeadKeyCompositionSpace,
} from '../../app/core/utils/dead-key-composition.ts'

describe('dead key composition space swallowing', () => {
  beforeEach(() => {
    resetDeadKeyCompositionState()
  })

  it('only treats keys the browser explicitly reports as Dead as dead keys — no layout guessing', () => {
    expect(isDeadKeyEvent({ key: 'Dead' })).toBe(true)
    expect(isDeadKeyEvent({ key: "'", code: 'Quote' })).toBe(false)
  })

  it('model 1 (key="Dead", Chromium/Gecko): swallows the composition space (es / US-Intl)', () => {
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: 'Dead', code: 'Quote' })).toBe(false)
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: ' ', code: 'Space' })).toBe(true)
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: ' ', code: 'Space' })).toBe(false)
  })

  it('model 2 (dead key reported as base char): swallows the space while no real character landed', () => {
    // 死键以 ' 报告，且按下后没有任何字符落盘 → 紧跟的空格是组合终结符
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: "'", code: 'Quote' })).toBe(false)
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: ' ', code: 'Space' })).toBe(true)
  })

  it('model 2 with real insertion (plain English): apostrophe lands, so the space is real', () => {
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: "'", code: 'Quote' })).toBe(false)
    // 系统真正插入了 '（隐藏输入框 input 事件）
    confirmCharacterInserted()
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: ' ', code: 'Space' })).toBe(false)
  })

  it('resets the quoted-composition state after any intermediate non-space key', () => {
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: "'", code: 'Quote' })).toBe(false)
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: 's', code: 'KeyS' })).toBe(false)
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: ' ', code: 'Space' })).toBe(false)
  })

  it('swallows the space for double-quote dead keys too (US-Intl shift+quote)', () => {
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: '"', code: 'Quote' })).toBe(false)
    expect(shouldIgnoreDeadKeyCompositionSpace({ key: ' ', code: 'Space' })).toBe(true)
  })

  it('identifies plain space keydowns only', () => {
    expect(isSpaceKeydownEvent({ key: ' ', code: 'Space' })).toBe(true)
    expect(isSpaceKeydownEvent({ key: ' ', code: 'Space', metaKey: true })).toBe(false)
    expect(isSpaceKeydownEvent({ key: '\t', code: 'Tab' })).toBe(false)
  })
})
