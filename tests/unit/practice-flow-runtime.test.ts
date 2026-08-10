import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WordPracticeMode } from '@/core/types/enum.ts'
import { getDefaultWord } from '@/core/types/func.ts'
import {
  createPracticeFlowRuntime,
  getUserFlow,
  isValidFlowConfig,
  resolveFlowConfigOrSystem,
  saveUserFlow,
} from '@/composables/practice-words/practice-flow-runtime.ts'
import { BUILTIN_FLOWS, CURRENT_FLOW_VERSION } from '@/composables/practice-words/practice-flow-config.ts'
import type { PracticeFlowConfig } from '@/composables/practice-words/practice-flow-types.ts'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}

const word = (value: string) => ({ ...getDefaultWord(), word: value })

function flow(
  id: string,
  source: 'taskNew' | 'taskReview' | 'current' = 'current',
  templateId: 'followWrite' | 'spell' = 'followWrite'
): PracticeFlowConfig {
  return {
    id,
    version: CURRENT_FLOW_VERSION,
    mode: WordPracticeMode.Custom,
    label: id,
    nodes: [{ id: `${id}-node`, label: id, source, steps: [{ templateId }] }],
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true })
})

describe('Flow v6 strict validation', () => {
  it.each([
    { name: 'zero groupSize', patch: { wordAdvance: { type: 'wordLoop', groupSize: 0, subSteps: [] } } },
    { name: 'fraction groupSize', patch: { wordAdvance: { type: 'wordLoop', groupSize: 1.5, subSteps: [] } } },
    { name: 'unknown template', patch: { templateId: 'missing' } },
    { name: 'invalid action', patch: { onEnd: [{ type: 'navigate', target: '' }] } },
    { name: 'unsupported navigation', patch: { onEnd: [{ type: 'navigate', target: 'previousStep' }] } },
  ])('falls back to System for $name', ({ patch }) => {
    const invalid = flow('invalid')
    Object.assign(invalid.nodes[0].steps[0], patch)
    expect(resolveFlowConfigOrSystem(invalid).id).toBe('system')
  })

  it.each([CURRENT_FLOW_VERSION - 1, CURRENT_FLOW_VERSION + 1])('falls back for unsupported version %s', version => {
    const unsupported = flow('unsupported')
    unsupported.version = version
    expect(resolveFlowConfigOrSystem(unsupported).id).toBe('system')
  })

  it('does not migrate or write back an unsupported stored flow', () => {
    const legacy = flow('stored')
    legacy.version = CURRENT_FLOW_VERSION - 1
    const createdAt = 100
    const updatedAt = 200
    localStorage.setItem('PracticeFlowV2', JSON.stringify({
      activeId: 'stored', flows: { stored: { config: legacy, name: 'stored', createdAt, updatedAt } },
    }))
    expect(getUserFlow('stored')).toBeNull()
    const stored = JSON.parse(localStorage.getItem('PracticeFlowV2')!)
    expect(stored.flows.stored).toMatchObject({ config: { version: CURRENT_FLOW_VERSION - 1 }, createdAt, updatedAt })
  })

  it('ignores malformed stored entries without throwing', () => {
    localStorage.setItem('PracticeFlowV2', JSON.stringify({
      activeId: 'broken',
      flows: { broken: { name: 'broken', createdAt: 1, updatedAt: 2 } },
    }))
    expect(() => getUserFlow('broken')).not.toThrow()
    expect(getUserFlow('broken')).toBeNull()
  })

  it('contains no display policy in the current serialized flow', () => {
    expect(JSON.stringify(resolveFlowConfigOrSystem(flow('current')))).not.toContain('display')
  })

  it('safely rejects malformed values from storage', () => {
    expect(isValidFlowConfig(null)).toBe(false)
    expect(isValidFlowConfig({ id: 'broken' })).toBe(false)
    expect(() => resolveFlowConfigOrSystem({ id: 'broken' })).not.toThrow()
    expect(resolveFlowConfigOrSystem({ id: 'broken' }).id).toBe('system')
  })

  it('does not infer validity from a system id', () => {
    const invalidSystem = flow('system') as any
    invalidSystem.nodes = []
    expect(isValidFlowConfig(invalidSystem)).toBe(false)
    expect(() => saveUserFlow('system', invalidSystem, 'invalid')).toThrow('INVALID_FLOW_CONFIG')
  })
})

describe('isolated runtime and task counts', () => {
  it('keeps two runtimes independent', () => {
    const a = createPracticeFlowRuntime(flow('a', 'taskNew'))
    const b = createPracticeFlowRuntime(flow('b', 'taskReview'))
    a.loadPracticeFlow(flow('a2', 'current'))
    expect(a.getActiveFlowId()).toBe('a2')
    expect(b.getActiveFlowId()).toBe('b')
  })

  it.each([
    ['new only', 'taskNew', 2, 0, 2],
    ['review only', 'taskReview', 0, 3, 3],
    ['current', 'current', 2, 3, 5],
  ] as const)('counts %s sources correctly', (_name, source, expectedNew, expectedReview, total) => {
    const config = flow(`count-${source}`, source)
    const runtime = createPracticeFlowRuntime(config)
    const result = runtime.resolveFlowStart(WordPracticeMode.Custom, {
      new: [word('n1'), word('n2')],
      review: [word('r1'), word('r2'), word('r3')],
    }, config)
    expect(result).toMatchObject({ newWordNumber: expectedNew, reviewWordNumber: expectedReview, total })
  })

  it('does not double-count repeated sources', () => {
    const config = flow('repeat-source', 'current')
    config.nodes.push({ ...config.nodes[0], id: 'second' })
    const runtime = createPracticeFlowRuntime(config)
    const result = runtime.resolveFlowStart(WordPracticeMode.Custom, {
      new: [word('n')], review: [word('r')],
    }, config)
    expect(result.total).toBe(2)
  })

  it('honors shuffleOnEnter when the Flow starts from its first Step', () => {
    const config = flow('initial-shuffle', 'current')
    config.nodes[0].steps[0].shuffleOnEnter = true
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    const runtime = createPracticeFlowRuntime(config)

    const result = runtime.resolveFlowStart(WordPracticeMode.Custom, {
      new: [word('a'), word('b')],
      review: [word('c')],
    }, config)

    expect(result.words.map(item => item.word)).toEqual(['b', 'c', 'a'])
    random.mockRestore()
  })

  it('enables shuffleOnEnter for every built-in Dictation Step', () => {
    const dictationSteps = Object.values(BUILTIN_FLOWS)
      .flatMap(config => config.nodes)
      .flatMap(node => node.steps)
      .filter(step => step.templateId === 'dictation')

    expect(dictationSteps.length).toBeGreaterThan(0)
    expect(dictationSteps.every(step => step.shuffleOnEnter === true)).toBe(true)
  })

  it('counts built-in Review and System from their actual sources', () => {
    const taskWords = { new: [word('n1'), word('n2')], review: [word('r1')] }
    const reviewRuntime = createPracticeFlowRuntime()
    expect(reviewRuntime.resolveFlowStart(WordPracticeMode.Review, taskWords)).toMatchObject({
      newWordNumber: 0, reviewWordNumber: 1, total: 1,
    })
    const systemRuntime = createPracticeFlowRuntime()
    expect(systemRuntime.resolveFlowStart(WordPracticeMode.System, taskWords)).toMatchObject({
      newWordNumber: 2, reviewWordNumber: 1, total: 3,
    })
  })
})
