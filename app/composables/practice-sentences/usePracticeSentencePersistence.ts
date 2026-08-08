import {
  getPracticeSentenceCacheLocal,
  setPracticeSentenceCacheLocal,
  type PracticeSentenceCache,
} from './practice-sentence-cache.ts'

export function usePracticeSentencePersistence() {
  async function load(): Promise<PracticeSentenceCache | null> {
    return await getPracticeSentenceCacheLocal()
  }

  async function fetch(): Promise<PracticeSentenceCache | null> {
    return load()
  }

  async function save(data: PracticeSentenceCache | null) {
    await setPracticeSentenceCacheLocal(data)
  }

  async function clear() {
    await setPracticeSentenceCacheLocal(null)
  }

  return { load, fetch, save, clear }
}
