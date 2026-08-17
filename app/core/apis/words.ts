import http from '../utils/http.ts'
import type { Word } from '../types'

export function queryWord(params?: { word: string }) {
  return http<Word>('public.word/query', null, params, 'get')
}
