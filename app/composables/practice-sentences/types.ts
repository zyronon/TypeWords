import type { Sentence, Word } from '@/core/types/types.ts'

export type SentencePracticeMode = 'followWrite' | 'dictation' | 'listen'

export interface SentencePracticeSource {
  id: string
  text: string
  translate?: string
  sourceWord?: Word
  meta?: Record<string, unknown>
}

export interface SentencePracticeItem {
  id: string
  source: SentencePracticeSource
  sentence: Sentence
}

export interface SentenceTypingState {
  wordIndex: number
  stringIndex: number
  input: string
  wrong: string
  isSpace: boolean
  isEnd: boolean
  showResult: boolean
}
