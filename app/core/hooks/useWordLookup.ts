import { reactive } from 'vue'
import { queryWord } from '../apis/words.ts'
import type { Word } from '../types'
import { normalizeWordForLookup, stripWordPunctuation } from '../utils/wordLookup.ts'

const cache = new Map<string, Word | null>()

export const wordLookupState = reactive({
  visible: false,
  loading: false,
  notFound: false,
  queryWord: '',
  data: null as Word | null,
  x: 0,
  y: 0,
})

function updatePosition(target: HTMLElement) {
  const rect = target.getBoundingClientRect()
  wordLookupState.x = rect.left + rect.width / 2
  wordLookupState.y = rect.bottom + 8
}

async function fetchWordData(rawWord: string) {
  const stripped = stripWordPunctuation(rawWord)
  if (!stripped) {
    wordLookupState.notFound = true
    wordLookupState.loading = false
    wordLookupState.data = null
    return
  }

  wordLookupState.queryWord = stripped

  if (cache.has(stripped)) {
    const cached = cache.get(stripped) ?? null
    wordLookupState.data = cached
    wordLookupState.notFound = !cached
    wordLookupState.loading = false
    return
  }

  const candidates = normalizeWordForLookup(rawWord)
  for (const candidate of candidates) {
    const res = await queryWord({ word: candidate })
    if (res.success && res.data) {
      cache.set(stripped, res.data)
      wordLookupState.data = res.data
      wordLookupState.notFound = false
      wordLookupState.loading = false
      return
    }
  }

  cache.set(stripped, null)
  wordLookupState.data = null
  wordLookupState.notFound = true
  wordLookupState.loading = false
}

export function closeWordLookup() {
  wordLookupState.visible = false
}

export async function lookupWord(e: MouseEvent, rawWord: string, playAudio?: (word: string) => void) {
  e.stopPropagation()
  const target = e.currentTarget as HTMLElement | null
  if (!target) return

  updatePosition(target)
  wordLookupState.visible = true
  wordLookupState.loading = true
  wordLookupState.notFound = false
  wordLookupState.data = null

  const stripped = stripWordPunctuation(rawWord)
  if (stripped) {
    playAudio?.(stripped)
  }

  await fetchWordData(rawWord)
  if (wordLookupState.visible && target.isConnected) {
    updatePosition(target)
  }
}

export function useWordLookup() {
  return {
    state: wordLookupState,
    lookupWord,
    close: closeWordLookup,
  }
}
