import { computed, reactive } from 'vue'
import type { SentencePracticeItem, SentencePracticeMode } from './types.ts'
import type { PracticeSentenceCache } from './practice-sentence-cache.ts'

export interface PracticeSentenceSessionState {
  items: SentencePracticeItem[]
  index: number
  wrongIds: string[]
  completedIds: string[]
}

export function createDefaultPracticeSentenceSession(): PracticeSentenceSessionState {
  return {
    items: [],
    index: 0,
    wrongIds: [],
    completedIds: [],
  }
}

function resetItemInputs(items: SentencePracticeItem[]) {
  items.forEach(item => {
    item.sentence.words.forEach(word => {
      word.input = ''
    })
  })
}

function unique(list: string[]) {
  return Array.from(new Set(list.filter(Boolean)))
}

export function usePracticeSentenceSession() {
  const session = reactive<PracticeSentenceSessionState>(createDefaultPracticeSentenceSession())

  const currentItem = computed(() => {
    return session.items[session.index] ?? null
  })

  const isComplete = computed(() => {
    return session.items.length > 0 && session.index >= session.items.length
  })

  function init(items: SentencePracticeItem[]) {
    resetItemInputs(items)
    session.items = items
    session.index = 0
    session.wrongIds = []
    session.completedIds = []
  }

  function applyCache(cache: PracticeSentenceCache, freshItems?: SentencePracticeItem[]) {
    const items = freshItems?.length ? freshItems : cache.items
    resetItemInputs(items)
    session.items = items
    session.index = Math.min(Math.max(cache.index ?? 0, 0), items.length)
    session.wrongIds = unique(cache.wrongIds ?? []).filter(id => items.some(item => item.id === id))
    session.completedIds = unique(cache.completedIds ?? []).filter(id => items.some(item => item.id === id))
  }

  function markWrong(id = currentItem.value?.id) {
    if (!id || session.wrongIds.includes(id)) return
    session.wrongIds.push(id)
  }

  function completeCurrent() {
    const item = currentItem.value
    if (!item) return false
    if (!session.completedIds.includes(item.id)) {
      session.completedIds.push(item.id)
    }
    item.sentence.words.forEach(word => {
      word.input = ''
    })
    if (session.index >= session.items.length - 1) {
      session.index = session.items.length
      return true
    }
    session.index++
    return false
  }

  function restart(items = session.items) {
    resetItemInputs(items)
    session.items = items
    session.index = 0
    session.wrongIds = []
    session.completedIds = []
  }

  function snapshot(dictId: string, mode: SentencePracticeMode, dictName?: string): PracticeSentenceCache {
    return {
      dictId,
      dictName,
      items: session.items,
      index: session.index,
      wrongIds: unique(session.wrongIds),
      completedIds: unique(session.completedIds),
      mode,
    }
  }

  return {
    session,
    currentItem,
    isComplete,
    init,
    applyCache,
    markWrong,
    completeCurrent,
    restart,
    snapshot,
  }
}
