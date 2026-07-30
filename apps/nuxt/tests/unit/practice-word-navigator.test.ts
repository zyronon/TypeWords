import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import { getDefaultWord } from '@typewords/core/types/func.ts'
import { createPracticeWordNavigator } from '../../app/composables/practice-words/usePracticeWordNavigator.ts'
import { saveUserFlow } from '../../app/composables/practice-words/practice-flow-runtime.ts'
import { CURRENT_FLOW_VERSION } from '../../app/composables/practice-words/practice-flow-config.ts'
import type { PracticeFlowConfig, PracticeStepTemplateId } from '../../app/composables/practice-words/practice-flow-types.ts'

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
}

const makeWord = (value: string) => ({ ...getDefaultWord(), word: value })

function makeFlow(id: string, subSteps: { templateId: PracticeStepTemplateId; clearWrongOnSuccess?: boolean }[]): PracticeFlowConfig {
  return {
    id, version: CURRENT_FLOW_VERSION, mode: WordPracticeMode.Custom, label: id,
    nodes: [{
      id: 'node', label: 'node', source: 'current',
      steps: [{
        templateId: 'followWrite',
        wordAdvance: { type: 'wordLoop', groupSize: 7, subSteps },
      }],
    }],
  }
}

function setupNavigator(config: PracticeFlowConfig, count: number) {
  saveUserFlow(config.id, config, config.label)
  const words = Array.from({ length: count }, (_, i) => makeWord(`w${i}`))
  const data: any = {
    words, index: 0, wrongTimes: 0, wrongWords: [], allWrongWords: [],
    wrongTimesMap: {}, ratingMap: {}, excludeWords: [], question: null,
  }
  let completed = false
  const navigator = createPracticeWordNavigator({
    getPracticeData: () => data,
    getTaskWords: () => ({ new: words, review: [] }),
    getCurrentWord: () => data.words[data.index] ?? getDefaultWord(),
    checkWordIsNeedNext: () => false,
    complete: () => { completed = true },
  })
  navigator.restoreSessionSnapshot({
    identifyMethod: 0 as any,
    flowId: config.id,
    cursor: { nodeIndex: 0, stepIndex: 0, inWrongWordClear: false, loop: null, endActionIndex: null },
  })
  return { navigator, data, words, completed: () => completed }
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true })
})

describe('Navigator wordLoop cursor', () => {
  it.each([7, 8, 14])('visits every main and loop word for %i words and multiple subSteps', count => {
    const { navigator, data, completed } = setupNavigator(makeFlow(`order-${count}`, [
      { templateId: 'spell' }, { templateId: 'listen' },
    ]), count)
    const visits: string[] = []
    for (let guard = 0; guard < count * 4 && !completed(); guard++) {
      visits.push(`${navigator.activeCursor.value.loop?.subStepIndex ?? 'main'}:${data.index}`)
      navigator.next()
    }
    expect(completed()).toBe(true)
    expect(visits.filter(v => v.startsWith('main:'))).toHaveLength(count)
    expect(visits.filter(v => v.startsWith('0:'))).toHaveLength(count)
    expect(visits.filter(v => v.startsWith('1:'))).toHaveLength(count)
  })
})

describe('clearWrongOnSuccess', () => {
  it('does not clear on a subStep without the switch', () => {
    const { navigator, data, words } = setupNavigator(makeFlow('no-clear', [{ templateId: 'spell' }]), 1)
    data.wrongWords = [words[0]]
    navigator.activeCursor.value.loop = { startIndex: 0, endIndex: 0, subStepIndex: 0 }
    navigator.next()
    expect(data.wrongWords).toEqual([words[0]])
  })

  it.each(['spell', 'listen', 'dictation'] as const)('clears a zero-error %s verification subStep', templateId => {
    const { navigator, data, words } = setupNavigator(makeFlow(`clear-${templateId}`, [
      { templateId, clearWrongOnSuccess: true },
    ]), 1)
    data.wrongWords = [words[0]]
    data.wrongTimesMap.w0 = 3
    navigator.activeCursor.value.loop = { startIndex: 0, endIndex: 0, subStepIndex: 0 }
    navigator.next()
    expect(data.wrongWords).toEqual([])
    expect(data.wrongTimesMap.w0).toBe(3)
  })

  it('keeps an error on verification and allows a later error to re-add a cleared word', () => {
    const { navigator, data, words } = setupNavigator(makeFlow('clear-readd', [
      { templateId: 'spell', clearWrongOnSuccess: true },
      { templateId: 'listen', clearWrongOnSuccess: true },
    ]), 1)
    data.wrongWords = [words[0]]
    data.wrongTimes = 1
    navigator.activeCursor.value.loop = { startIndex: 0, endIndex: 0, subStepIndex: 0 }
    navigator.next()
    expect(data.wrongWords).toEqual([words[0]])

    data.wrongTimes = 0
    navigator.next()
    expect(data.wrongWords).toEqual([])

    data.wrongWords.push(words[0])
    data.wrongTimes = 1
    navigator.activeCursor.value.loop = { startIndex: 0, endIndex: 0, subStepIndex: 1 }
    navigator.next()
    expect(data.wrongWords).toEqual([words[0]])
  })

  it('rejects an invalid restored loop cursor', () => {
    const { navigator } = setupNavigator(makeFlow('bad-cursor', [{ templateId: 'spell' }]), 1)
    const restored = navigator.restoreSessionSnapshot({
      identifyMethod: 0 as any, flowId: 'bad-cursor',
      cursor: {
        nodeIndex: 0, stepIndex: 0, inWrongWordClear: false, endActionIndex: null,
        loop: { startIndex: 0, endIndex: 5, subStepIndex: 8 },
      },
    })
    expect(restored).toBe(false)
    expect(navigator.activeFlowConfig.value.id).toBe('system')
    expect(navigator.activeCursor.value.loop).toBeNull()
  })

  it('restores a valid loop subStepIndex from cache', () => {
    const { navigator } = setupNavigator(makeFlow('valid-cursor', [
      { templateId: 'spell' }, { templateId: 'listen' },
    ]), 7)
    const restored = navigator.restoreSessionSnapshot({
      identifyMethod: 0 as any, flowId: 'valid-cursor',
      cursor: {
        nodeIndex: 0, stepIndex: 0, inWrongWordClear: false, endActionIndex: null,
        loop: { startIndex: 0, endIndex: 6, subStepIndex: 1 },
      },
    })
    expect(restored).toBe(true)
    expect(navigator.activeCursor.value.loop).toEqual({ startIndex: 0, endIndex: 6, subStepIndex: 1 })
  })

  it('safely skips an empty node', () => {
    const config = makeFlow('empty-node', [])
    config.nodes.push({ id: 'empty', label: 'empty', source: 'wrongWords', steps: [{ templateId: 'spell' }] })
    const { navigator, completed } = setupNavigator(config, 1)
    navigator.next()
    expect(completed()).toBe(true)
  })
})
