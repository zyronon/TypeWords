import http from '../utils/http.ts'
import type { Dict, Word } from '../types'

export function wordDelete(params?, data?) {
  return http<Dict>('word/delete', data, params, 'post')
}

export function queryWord(params?: { word: string }) {
  return http<Word>('public.word/query', null, params, 'get')
}

export function getWordList(params?, data?) {
  return http<Dict>('public.word/getWordList', data, params, 'post')
}
