import { Word } from '../types'
import { useBaseStore } from '../stores/base'

const dictCache: Record<string, Word[]> = {}
const pendingRequests: Record<string, Promise<Word[]>> = {}

export function useWordHydrator() {
  /**
   * 为单词回填详细信息。词典数据可用时直接从缓存或本地词典回填；
   * 不可用时返回失败状态，不自动触发下载。
   * @returns hydrated=false 表示需要下载对应词典
   */
  async function hydrate(
    word: Word,
    force = false
  ): Promise<{ hydrated: boolean; dictName?: string }> {
    if (!word.sourceDictId || (!force && word.trans && word.trans.length > 0)) {
      return { hydrated: true }
    }

    const dictId = word.sourceDictId
    let wordsData: Word[] = []

    if (dictCache[dictId]) {
      wordsData = dictCache[dictId]
    } else if (pendingRequests[dictId]) {
      wordsData = await pendingRequests[dictId]
    } else {
      // 检查用户已添加的词典中是否有已加载的单词数据
      const store = useBaseStore()
      const userDict = store.word.bookList.find(v => v.id === dictId)

      if (userDict?.words?.length) {
        dictCache[dictId] = userDict.words
        wordsData = userDict.words
      } else {
        // 词典数据不可用：不自动下载，返回失败状态
        const dictName = userDict?.name || dictId
        return { hydrated: false, dictName }
      }
    }

    if (wordsData.length > 0) {
      const sourceWord = wordsData.find(
        w => w.word.toLowerCase() === word.word.toLowerCase()
      )
      if (sourceWord) {
        const { id, sourceDictId, custom, ...details } = sourceWord
        Object.assign(word, details)
      }
    }
    return { hydrated: true }
  }

  return { hydrate }
}
