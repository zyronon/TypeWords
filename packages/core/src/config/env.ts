import { offset } from '@floating-ui/dom'
//这里合并导入，打包会报错
import { ShortcutKey, WordPracticeMode, WordPracticeStage } from '../types/enum.ts'

export const GITHUB = 'https://github.com/zyronon/TypeWords'
export const Host = 'typewords.cc'
export const Old_Host = '2study.top'
export const EMAIL = 'zyronon@163.com'
export const Origin = `https://${Host}`
export const APP_NAME = 'Type Words'
export const IS_DEV = import.meta.env.MODE === 'development'

const common = {
  word_dict_list_version: 1,
}
const map = {
  DEV: {
    // API: 'http://localhost/',
    API: 'https://api.typewords.cc/',
    // RESOURCE_URL: 'https://dicts.2study.top/',
    // RESOURCE_URL: '/',
    RESOURCE_URL: 'https://files.typewords.cc/',
    // RESOURCE_URL: 'http://localhost/static/',
    LIBS_URL: 'https://libs.typewords.cc/',
  },
}

export const ENV = Object.assign(map['DEV'], common)

export let AppEnv = {
  // TOKEN: localStorage.getItem('token') ?? '',
  TOKEN: '',
  IS_OFFICIAL: false,
  IS_LOGIN: false,
  CAN_REQUEST: false,
}

if (import.meta.client) {
  AppEnv.TOKEN = localStorage.getItem('token') ?? ''
  // AppEnv.IS_OFFICIAL = IS_DEV || [Host,Old_Host].includes(window.location.host)
}

AppEnv.IS_LOGIN = !!AppEnv.TOKEN
AppEnv.CAN_REQUEST = AppEnv.IS_LOGIN && AppEnv.IS_OFFICIAL
// AppEnv.IS_OFFICIAL = true
// AppEnv.CAN_REQUEST = true
// console.log('AppEnv.CAN_REQUEST',AppEnv.CAN_REQUEST)

export const RESOURCE_PATH = ENV.API + 'static'

export const DICT_LIST = {
  WORD: {
    ALL: ENV.RESOURCE_URL + `/list/word.json`,
    RECOMMENDED: ENV.RESOURCE_URL + `/list/recommend_word.json`,
  },
  ARTICLE: {
    ALL: ENV.RESOURCE_URL + `/list/article.json`,
    RECOMMENDED: ENV.RESOURCE_URL + `/list/recommend_article.json`,
  },
}

export const SoundFileOptions = [
  { value: '机械键盘', label: '机械键盘' },
  { value: '机械键盘1', label: '机械键盘1' },
  { value: '机械键盘2', label: '机械键盘2' },
  { value: '老式机械键盘', label: '老式机械键盘' },
  { value: '笔记本键盘', label: '笔记本键盘' },
]
export const APP_VERSION = {
  key: 'type-words-app-version',
  version: 3,
}
export const SAVE_DICT_KEY = {
  key: 'typing-word-dict',
  version: 4,
}
export const SAVE_SETTING_KEY = {
  key: 'typing-word-setting',
  version: 23,
}

//5版本，不再单独保存 app version字段
export const EXPORT_DATA_KEY = {
  key: 'typing-word-export',
  version: 5,
}
export const LOCAL_FILE_KEY = 'typing-word-files'
export const WEBSITE_VERSION_HASH = 'type-words-website-version-hash'
export const BACKUP_INDEX_KEY = 'type-words-backup-index'
export const BACKUP_KEY = 'type-words-backup-'

export const TourConfig = {
  useModalOverlay: true,
  defaultStepOptions: {
    canClickTarget: false,
    classes: 'shadow-md bg-purple-dark',
    cancelIcon: { enabled: true },
    modalOverlayOpeningPadding: 10,
    modalOverlayOpeningRadius: 6,
    floatingUIOptions: {
      middleware: [offset({ mainAxis: 30 })],
    },
  },
  total: 4,
}

export const LIB_JS_URL = {
  SHEPHERD: `${ENV.LIBS_URL}Shepherd.14.5.1.mjs.js`,
  SNAPDOM: `${ENV.LIBS_URL}/snapdom.min.js`,
  JSZIP: `${ENV.LIBS_URL}/jszip.min.js`,
  XLSX: `${ENV.LIBS_URL}/xlsx.full.min.js`,
}
export const PronunciationApi = 'https://dict.youdao.com/dictvoice?audio='
export const DefaultShortcutKeyMap = {
  [ShortcutKey.EditArticle]: 'Ctrl+E',
  [ShortcutKey.ShowWord]: 'Escape',
  [ShortcutKey.Previous]: 'Ctrl+⬅',
  [ShortcutKey.Next]: 'Ctrl+➡',
  [ShortcutKey.Ignore]: 'Tab',
  [ShortcutKey.ToggleSimple]: '`',
  [ShortcutKey.ToggleCollect]: 'Enter',
  [ShortcutKey.PreviousChapter]: 'Alt+⬅',
  [ShortcutKey.NextChapter]: 'Alt+➡',
  [ShortcutKey.NextStep]: 'Shift+➡',
  [ShortcutKey.RepeatChapter]: 'Ctrl+Enter',
  [ShortcutKey.DictationChapter]: 'Alt+Enter',
  [ShortcutKey.PlayWordPronunciation]: 'Ctrl+P',
  [ShortcutKey.ToggleShowTranslate]: 'Ctrl+Z',
  [ShortcutKey.ToggleDictation]: 'Ctrl+I',
  [ShortcutKey.ToggleTheme]: 'Ctrl+Q',
  [ShortcutKey.ToggleConciseMode]: 'Ctrl+M',
  [ShortcutKey.ToggleToolbar]: 'Ctrl+B',
  [ShortcutKey.TogglePanel]: 'Ctrl+L',
  [ShortcutKey.RandomWrite]: 'Ctrl+R',
  [ShortcutKey.KnowWord]: '1',
  [ShortcutKey.UnknownWord]: '2',
  [ShortcutKey.MasteredWord]: '3',
  [ShortcutKey.ChooseA]: '1',
  [ShortcutKey.ChooseB]: '2',
  [ShortcutKey.ChooseC]: '3',
  [ShortcutKey.ChooseD]: '4',
  [ShortcutKey.PlaySentence1]: 'Ctrl+1',
  [ShortcutKey.PlaySentence2]: 'Ctrl+2',
  [ShortcutKey.PlaySentence3]: 'Ctrl+3',
  [ShortcutKey.PlaySentence4]: 'Ctrl+4',
  [ShortcutKey.PlaySentence5]: 'Ctrl+5',
  [ShortcutKey.PlaySentence6]: 'Ctrl+6',
  [ShortcutKey.PlaySentence7]: 'Ctrl+7',
  [ShortcutKey.PlaySentence8]: 'Ctrl+8',
  [ShortcutKey.PlaySentence9]: 'Ctrl+9',
}
export const SlideType = {
  HORIZONTAL: 0,
  VERTICAL: 1,
}
export const WordPracticeModeStageMap: Record<WordPracticeMode, WordPracticeStage[]> = {
  [WordPracticeMode.Free]: [WordPracticeStage.FollowWriteNewWord, WordPracticeStage.Complete],
  [WordPracticeMode.IdentifyOnly]: [
    WordPracticeStage.IdentifyNewWord,
    WordPracticeStage.IdentifyReview,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.DictationOnly]: [
    WordPracticeStage.DictationNewWord,
    WordPracticeStage.DictationReview,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.ListenOnly]: [
    WordPracticeStage.ListenNewWord,
    WordPracticeStage.ListenReview,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.System]: [
    WordPracticeStage.FollowWriteNewWord,
    WordPracticeStage.ListenNewWord,
    WordPracticeStage.DictationNewWord,
    WordPracticeStage.IdentifyReview,
    WordPracticeStage.ListenReview,
    WordPracticeStage.DictationReview,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.Shuffle]: [WordPracticeStage.Shuffle, WordPracticeStage.Complete],
  [WordPracticeMode.Review]: [
    WordPracticeStage.IdentifyReview,
    WordPracticeStage.ListenReview,
    WordPracticeStage.DictationReview,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.ShuffleWordsTest]: null,
  [WordPracticeMode.ReviewWordsTest]: null,
}
export const WordPracticeStageNameMap: Record<WordPracticeStage, string> = {
  [WordPracticeStage.FollowWriteNewWord]: '跟写新词',
  [WordPracticeStage.IdentifyNewWord]: '自测新词',
  [WordPracticeStage.ListenNewWord]: '听写新词',
  [WordPracticeStage.DictationNewWord]: '默写新词',
  [WordPracticeStage.FollowWriteReview]: '跟写旧词',
  [WordPracticeStage.IdentifyReview]: '自测旧词',
  [WordPracticeStage.ListenReview]: '听写旧词',
  [WordPracticeStage.DictationReview]: '默写旧词',
  [WordPracticeStage.Complete]: '完成学习',
  [WordPracticeStage.Shuffle]: '随机复习',
}
export const WordPracticeModeNameMap: Record<WordPracticeMode, string> = {
  [WordPracticeMode.System]: '学习',
  [WordPracticeMode.Free]: '自由练习',
  [WordPracticeMode.IdentifyOnly]: '自测',
  [WordPracticeMode.DictationOnly]: '默写',
  [WordPracticeMode.ListenOnly]: '听写',
  [WordPracticeMode.Shuffle]: '随机复习',
  [WordPracticeMode.Review]: '复习',
  [WordPracticeMode.ShuffleWordsTest]: '随机单词测试',
  [WordPracticeMode.ReviewWordsTest]: '单词测试',
}
export const WordPracticeModeUrlMap: Record<WordPracticeMode, string> = {
  [WordPracticeMode.System]: '/practice-words',
  [WordPracticeMode.Free]: '/practice-words',
  [WordPracticeMode.IdentifyOnly]: '/practice-words',
  [WordPracticeMode.DictationOnly]: '/practice-words',
  [WordPracticeMode.ListenOnly]: '/practice-words',
  [WordPracticeMode.Shuffle]: '/practice-words',
  [WordPracticeMode.Review]: '/practice-words',
  [WordPracticeMode.ShuffleWordsTest]: '/words-test',
  [WordPracticeMode.ReviewWordsTest]: '/words-test',
}
export class DictId {
  static wordCollect = 'wordCollect'
  static wordWrong = 'wordWrong'
  static wordKnown = 'wordKnown'
  static articleCollect = 'articleCollect'
}
