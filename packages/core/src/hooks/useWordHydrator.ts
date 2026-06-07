import { Word } from '../types'
import { useBaseStore } from '../stores/base'

type DictIndexCache = {
  signature: string
  index: Map<string, Word>
}

const dictIndex: Record<string, DictIndexCache> = {}

function getDictSignature(words: Word[]): string {
  const length = words.length
  const firstWord = words[0]?.word ?? ''
  const lastWord = words[length - 1]?.word ?? ''
  return `${length}:${firstWord}:${lastWord}`
}

export function useWordHydrator() {
  async function hydrate(
    word: Word,
    force = false
  ): Promise<{ hydrated: boolean; dictName?: string }> {
    if (!word.sourceDictId || (!force && word.trans && word.trans.length > 0)) {
      return { hydrated: true }
    }

    const dictId = word.sourceDictId

    // 每次 hydrate 时检查缓存索引是否仍有效（词典是否仍在 bookList 中且有单词）
    const store = useBaseStore()
    const userDict = store.word.bookList.find(v => v.id === dictId)

    if (!userDict?.words?.length) {
      delete dictIndex[dictId]
      return { hydrated: false, dictName: userDict?.name || dictId }
    }

    const signature = getDictSignature(userDict.words)

    // 按需构建 O(1) 查找索引
    if (!dictIndex[dictId] || dictIndex[dictId].signature !== signature) {
      const index = new Map<string, Word>()
      for (const w of userDict.words) {
        index.set(w.word.toLowerCase(), w)
      }
      dictIndex[dictId] = {
        signature,
        index,
      }
    }

    const sourceWord = dictIndex[dictId].index.get(word.word.toLowerCase())
    if (!sourceWord) {
      return { hydrated: false, dictName: userDict.name || dictId }
    }

    const { id, sourceDictId, custom, ...details } = sourceWord
    Object.assign(word, details)
    return { hydrated: true }
  }

  return { hydrate }
}
