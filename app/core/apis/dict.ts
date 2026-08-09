import http from '../utils/http.ts'
import type { Dict } from '../types'

export function copyOfficialDict(params?, data?) {
  return http<Dict>('dict/copyOfficialDict', data, params, 'post')
}

export function deleteDict(params?, data?) {
  return http<Dict>('dict/delete', data, params, 'post')
}


export function parseImportFile(params?, data?) {
  return http<Dict>('dict/parseImportFile', data, params, 'post')
}

export function quickImportWords(params?, data?) {
  return http<Dict>('dict/quickImportWords', data, params, 'post')
}
