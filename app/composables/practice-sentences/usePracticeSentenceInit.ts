import type { Dict, Sentence, Word } from '@/core/types/types.ts'
import { getDefaultDict } from '@/core/types/func.ts'
import { parseSentence } from '@/core/hooks/article.ts'
import { useBaseStore } from '@/core/stores/base.ts'
import { DICT_LIST } from '@/core/config/env.ts'
import { _getDictDataByUrl, isDictIdMatch, resourceWrap } from '@/core/utils'
import type { SentencePracticeItem, SentencePracticeSource } from './types.ts'

function createSentence(source: SentencePracticeSource): Sentence {
  return {
    text: source.text,
    translate: source.translate ?? '',
    words: parseSentence(source.text),
    audioPosition: [0, 0],
  }
}

export function createSentencePracticeItem(source: SentencePracticeSource): SentencePracticeItem {
  return {
    id: source.id,
    source,
    sentence: createSentence(source),
  }
}

export function createWordSentencePracticeItems(word: Word): SentencePracticeItem[] {
  return (word.sentences ?? [])
    .filter(sentence => sentence.c?.trim())
    .map((sentence, index) => {
      const id = `${word.id || word.word}-${index}`
      return createSentencePracticeItem({
        id,
        text: sentence.c.trim(),
        translate: sentence.cn?.trim(),
        sourceWord: word,
        meta: {
          source: 'word',
          sentenceIndex: index,
        },
      })
    })
}

export function flattenDictSentencePracticeItems(dict: Dict): SentencePracticeItem[] {
  return (dict.words ?? []).flatMap((word, wordIndex) => {
    return (word.sentences ?? [])
      .filter(sentence => sentence.c?.trim())
      .map((sentence, sentenceIndex) => {
        const id = `${dict.id}-${word.id || word.word}-${sentenceIndex}`
        return createSentencePracticeItem({
          id,
          text: sentence.c.trim(),
          translate: sentence.cn?.trim(),
          sourceWord: word,
          meta: {
            source: 'dict',
            dictId: dict.id,
            wordIndex,
            sentenceIndex,
          },
        })
      })
  })
}

export function usePracticeSentenceInit() {
  const store = useBaseStore()

  async function loadDictById(dictId: string | number): Promise<Dict> {
    let dict = store.word.bookList.find(item => isDictIdMatch(item, dictId))

    const response = await fetch(resourceWrap(DICT_LIST.WORD.ALL))
    const dictList = await response.json()
    if (!dict) {
      dict = dictList.flat().find((item: Dict) => isDictIdMatch(item, dictId)) as Dict
    }

    if (!dict?.id) return getDefaultDict()
    if (!dict.custom) {
      dict = await _getDictDataByUrl(dict)
    }

    if (dict?.id) {
      store.changeDict(dict)
    }

    return dict
  }

  async function loadItemsByDictId(dictId: string | number) {
    const dict = await loadDictById(dictId)
    return {
      dict,
      items: flattenDictSentencePracticeItems(dict),
    }
  }

  return {
    loadDictById,
    loadItemsByDictId,
  }
}
