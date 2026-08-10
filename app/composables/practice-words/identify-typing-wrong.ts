import type { Word } from '@/core/types/types.ts'

export interface IdentifyTypingWrongState {
  wrongTimes: number
  allWrongWords: string[]
  wrongWords: Word[]
  storedWrongWords: Word[]
}

export interface IdentifyTypingWrongSnapshot {
  wordKey: string
  wrongTimes: number
  hadAllWrongWord: boolean
  hadWrongWord: boolean
  hadStoredWrongWord: boolean
}

const normalizeWordKey = (word: string) => word.toLowerCase()

const containsWordKey = (words: string[], wordKey: string) => words.some(word => normalizeWordKey(word) === wordKey)

const containsWord = (words: Word[], wordKey: string) => words.some(word => normalizeWordKey(word.word) === wordKey)

export function captureIdentifyTypingWrong(word: Word, state: IdentifyTypingWrongState): IdentifyTypingWrongSnapshot {
  const wordKey = normalizeWordKey(word.word)
  return {
    wordKey,
    wrongTimes: state.wrongTimes,
    hadAllWrongWord: containsWordKey(state.allWrongWords, wordKey),
    hadWrongWord: containsWord(state.wrongWords, wordKey),
    hadStoredWrongWord: containsWord(state.storedWrongWords, wordKey),
  }
}

function removeStringWord(words: string[], wordKey: string) {
  for (let index = words.length - 1; index >= 0; index--) {
    if (normalizeWordKey(words[index]) === wordKey) words.splice(index, 1)
  }
}

function removeWord(words: Word[], wordKey: string) {
  for (let index = words.length - 1; index >= 0; index--) {
    if (normalizeWordKey(words[index].word) === wordKey) words.splice(index, 1)
  }
}

export function restoreIdentifyTypingWrong(snapshot: IdentifyTypingWrongSnapshot, state: IdentifyTypingWrongState) {
  state.wrongTimes = snapshot.wrongTimes
  if (!snapshot.hadAllWrongWord) removeStringWord(state.allWrongWords, snapshot.wordKey)
  if (!snapshot.hadWrongWord) removeWord(state.wrongWords, snapshot.wordKey)
  if (!snapshot.hadStoredWrongWord) removeWord(state.storedWrongWords, snapshot.wordKey)
}
