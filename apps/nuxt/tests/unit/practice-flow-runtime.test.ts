import { beforeEach, describe, expect, it } from 'vitest'
import { WordPracticeMode } from '@typewords/core/types/enum.ts'
import { getDefaultWord } from '@typewords/core/types/func.ts'
import {
  createPracticeFlowRuntime,
  getUserFlow,
  migrateFlowConfig,
  saveUserFlow,
  validateFlowConfig,
} from '../../app/composables/practice-words/practice-flow-runtime.ts'
import { CURRENT_FLOW_VERSION } from '../../app/composables/practice-words/practice-flow-config.ts'
import type { PracticeFlowConfig } from '../../app/composables/practice-words/practice-flow-types.ts'

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

describe('Flow v5 migration and validation', () => {
  it('migrates Spell loop subSteps, including wrongWordClear, without enabling other templates', () => {
    const legacy = flow('legacy') as PracticeFlowConfig
    legacy.version = 4
    legacy.nodes[0].steps[0].wordAdvance = {
      type: 'wordLoop', groupSize: 7,
      subSteps: [{ templateId: 'listen' }, { templateId: 'spell' }],
    }
    legacy.nodes[0].steps[0].onEnd = [{
      type: 'wrongWordClear', templateId: 'followWrite',
      wordAdvance: { type: 'wordLoop', groupSize: 3, subSteps: [{ templateId: 'spell' }] },
    }]

    const migrated = migrateFlowConfig(legacy)!
    expect(migrated.version).toBe(5)
    expect(migrated.nodes[0].steps[0].wordAdvance?.subSteps).toEqual([
      { templateId: 'listen', clearWrongOnSuccess: false },
      { templateId: 'spell', clearWrongOnSuccess: true },
    ])
    const action = migrated.nodes[0].steps[0].onEnd?.[0]
    expect(action?.type === 'wrongWordClear' && action.wordAdvance?.subSteps[0].clearWrongOnSuccess).toBe(true)
  })

  it.each([
    { name: 'zero groupSize', patch: { wordAdvance: { type: 'wordLoop', groupSize: 0, subSteps: [] } } },
    { name: 'fraction groupSize', patch: { wordAdvance: { type: 'wordLoop', groupSize: 1.5, subSteps: [] } } },
    { name: 'unknown template', patch: { templateId: 'missing' } },
    { name: 'invalid action', patch: { onEnd: [{ type: 'navigate', target: '' }] } },
  ])('falls back to System for $name', ({ patch }) => {
    const invalid = flow('invalid')
    Object.assign(invalid.nodes[0].steps[0], patch)
    expect(validateFlowConfig(invalid).id).toBe('system')
  })

  it('falls back for a future version', () => {
    const future = flow('future')
    future.version = CURRENT_FLOW_VERSION + 1
    expect(validateFlowConfig(future).id).toBe('system')
  })

  it('writes migrated user flows without changing their storage metadata', () => {
    const legacy = flow('stored')
    legacy.version = 4
    legacy.nodes[0].steps[0] = {
      templateId: 'followWrite',
      wordAdvance: { type: 'wordLoop', groupSize: 7, subSteps: [{ templateId: 'spell' }] },
    }
    const createdAt = 100
    const updatedAt = 200
    localStorage.setItem('PracticeFlowV2', JSON.stringify({
      activeId: 'stored', flows: { stored: { config: legacy, name: 'stored', createdAt, updatedAt } },
    }))
    expect(getUserFlow('stored')?.version).toBe(5)
    const stored = JSON.parse(localStorage.getItem('PracticeFlowV2')!)
    expect(stored.flows.stored).toMatchObject({ createdAt, updatedAt })
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
