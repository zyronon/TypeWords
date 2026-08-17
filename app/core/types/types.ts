import { DictType, Frequency, PracticeArticleWordType, WordPracticeType } from './enum'
import type { Rating } from 'ts-fsrs'
import { PRACTICE_ARTICLE_CACHE, PRACTICE_WORD_CACHE } from '../utils/cache'
import { APP_VERSION } from '../config/env'

export type WordSubContent = {
  c: string //content
  cn: string
}
export type Word = {
  id?: string
  custom?: boolean
  word: string
  phonetic0: string
  phonetic1: string
  trans: {
    pos: string
    cn: string
    frequency?: Frequency
  }[]
  sentences: WordSubContent[]
  phrases: WordSubContent[]
  synos: {
    pos: string
    cn: string
    ws: string[]
  }[]
  relWords: {
    root: string
    rels: {
      pos: string
      words: WordSubContent[]
    }[]
  }
  etymology: {
    t: string //title
    d: string //desc
  }[]
}
export type TranslateLanguageType = 'en' | 'zh-CN' | 'ja' | 'de' | 'common' | ''
export type LanguageType = 'en' | 'ja' | 'de' | 'code'

export interface ArticleWord extends Word {
  nextSpace: boolean
  symbolPosition: 'start' | 'end' | ''
  input: string
  type: PracticeArticleWordType
}

export interface Sentence {
  text: string
  translate: string
  words: ArticleWord[]
  audioPosition: number[]
}

export interface Article {
  id?: number | string
  title: string
  titleTranslate: string
  text: string
  textTranslate: string
  newWords: Word[]
  sections: Sentence[][]
  audioSrc: string
  audioFileId: string
  lrcPosition?: number[][]
  nameList?: string[]
  questions?: {
    stem: string
    options: string[]
    correctAnswer: string[]
    explanation: string
  }[]
  quote?: {
    start: number
    text: string
    translate: string
    end: number
  }
  question?: {
    start: number
    text: string
    translate: string
    end: number
  }
}

export interface Statistics {
  startDate: number //开始日期
  spend: number //花费时间
  total: number //单词数量
  new: number //新学单词数量
  review: number //复习单词数量
  wrong: number //错误数
  title?: string //文章标题
  /** 本日实际学习的时间片段列表，每项为 [startMs, endMs] */
  segments?: [number, number][]
  /**
   * 本条记录在整次练习中的角色（仅跨天练习时有意义）：
   * - 'single'：整次练习仅一天（含老数据默认情况）
   * - 'start'  ：多天练习的第一天
   * - 'middle' ：多天练习的中间日
   * - 'end'    ：多天练习的最后一天
   */
  sessionRole?: 'single' | 'start' | 'middle' | 'end'
}

export type DictResource = {
  id: string | number
  enName?: string
  name: string
  description: string
  url: string
  length: number
  category: string
  tags: string[]
  translateLanguage: TranslateLanguageType
  //todo 可以考虑删除了
  type?: DictType
  version?: number
  language: LanguageType
}

export interface Dict extends DictResource {
  lastLearnIndex: number
  perDayStudyNumber: number
  words: Word[]
  articles: Article[]
  statistics: Statistics[]
  custom: boolean //是否是自定义词典
  system?: boolean //是否是系统虚拟词典（收藏/错词/已掌握/文章收藏），可编辑词条但不能改名，不显示tag
  sourceId?: string //如果是官方资源副本，这里记录原始官方资源 id
  complete: boolean //是否学习完成，学完了设为true，然后lastLearnIndex重置
  //后端字段
  enName?: string
  createdBy?: string
  category_id?: number
  is_default?: boolean
  update?: boolean
  cover?: string
  sync?: boolean
  userDictId?: number
}

export interface ArticleItem {
  item: Article
  index: number
}

export interface PracticeData {
  index: number
  words: Word[]
  wrongWords: Word[]
  excludeWords: string[]
  allWrongWords: string[]
  isTypingWrongWord: boolean
  // word -> wrongTimes 用以评级
  wrongTimesMap: Record<string, number>
  wrongTimes: number
  ratingMap: Record<string, Rating>
  /** 自由练习中的拼写错误输入，仅用于本次练习总结，不改变错词本和复习调度。 */
  spellingMistakes: PracticeSpellingMistake[]
  question: Question
}

export type PracticeSpellingCheckMode = 'instant' | 'wholeWord'

export interface PracticeSpellingMistake {
  word: string
  expected: string
  actual: string
  mode: PracticeSpellingCheckMode
  /** 逐字即时核对时的错误位置；整词核对时不设置。 */
  position?: number
  expectedCharacter?: string
  actualCharacter?: string
}

export interface TaskWords {
  new: Word[]
  review: Word[]
}

export interface SaveData {
  val: any
  version: number
  updated_at?: string
}

export interface Snapshot {
  meta: {
    currentHash: string
    previousHash: string
    createdAt: number
  }
  data: {
    dict: string
    setting: string
    [PRACTICE_WORD_CACHE.key]: string
    [PRACTICE_ARTICLE_CACHE.key]: string
    [APP_VERSION.key]: number
  }
}

export interface BackupData {
  version: number
  val: {
    dict: SaveData
    setting: SaveData
    [PRACTICE_WORD_CACHE.key]: SaveData
    [PRACTICE_ARTICLE_CACHE.key]: SaveData
    [APP_VERSION.key]: number
  }
}

export type Candidate = { word: Word; similarity: number }

export type Question = {
  candidates: Candidate[]
  correctIndex: number
}
// 类型定义
export interface Resource {
  name?: string
  description?: string
  difficulty?: string
  link?: string
  author?: string
  features?: string
  suitable?: string
  type?: string
  children?: Resource[]
}
