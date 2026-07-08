import type { Article, ArticleWord, Dict, Sentence, Word } from './types'
import { shallowReactive } from 'vue'
import { cloneDeep } from '../utils'
import { nanoid } from 'nanoid'
import { DictType, PracticeArticleWordType } from './enum'

export function getDefaultWord(val: Partial<Word> = {}): Word {
  return {
    custom: false,
    id: nanoid(6),
    word: '',
    phonetic0: '',
    phonetic1: '',
    trans: [],
    sentences: [],
    phrases: [],
    synos: [],
    relWords: {
      root: '',
      rels: [],
    },
    etymology: [],
    ...val,
  }
}

export function getDefaultArticleWord(val: Partial<ArticleWord> = {}): ArticleWord {
  return getDefaultWord({
    nextSpace: true,
    symbolPosition: '',
    input: '',
    type: PracticeArticleWordType.Word,
    ...val,
  }) as ArticleWord
}

export function getDefaultArticle(val: Partial<Article> = {}): Article {
  return {
    id: nanoid(6),
    title: '',
    titleTranslate: '',
    text: '',
    textTranslate: '',
    newWords: [],
    sections: [],
    audioSrc: '',
    audioFileId: '',
    lrcPosition: [],
    questions: [],
    nameList: [],
    ...cloneDeep(val),
  }
}

export function getDefaultDict(val: Partial<Dict> = {}): Dict {
  return {
    id: '',
    name: '',
    description: '',
    url: '',
    length: 0,
    category: '',
    tags: [],
    translateLanguage: '',
    type: DictType.word,
    language: 'en',
    lastLearnIndex: 0,
    perDayStudyNumber: 20,
    custom: false,
    system: false,
    sourceId: '',
    complete: false,

    createdBy: '',
    enName: '',
    category_id: null,
    is_default: false,
    update: false,
    cover: '',
    sync: false,

    ...val,
    words: shallowReactive(val.words ?? []),
    articles: shallowReactive(val.articles ?? []),
    statistics: shallowReactive(val.statistics ?? []),
  }
}
export function getDefaultSentence(val?: Partial<Sentence>): Sentence {
  return {
    text: '',
    translate: '',
    words: [],
    audioPosition: [],
    ...val,
  }
}
