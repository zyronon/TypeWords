import { reactive } from 'vue'
import type { Word } from '../types'
import { resolveWordLookup, stripWordPunctuation } from '../utils/wordLookup.ts'

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
  const result = await resolveWordLookup(rawWord)
  if (!result.query) {
    wordLookupState.notFound = true
    wordLookupState.loading = false
    wordLookupState.data = null
    return
  }

  wordLookupState.queryWord = result.query
  wordLookupState.data = result.data
  wordLookupState.notFound = !result.data
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
