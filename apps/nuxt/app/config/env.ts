import { offset } from '@floating-ui/dom'
import { ShortcutKey, WordPracticeMode, WordPracticeStage } from '@/types/enum'

export const GITHUB = 'https://github.com/zyronon/TypeWords'
export const Host = 'typewords.cc'
export const EMAIL = 'zyronon@163.com'
export const Origin = `https://${Host}`
export const APP_NAME = 'Type Words'

const common = {
  word_dict_list_version: 1,
}
const map = {
  DEV: {
    API: 'http://localhost/',
    // RESOURCE_URL: 'https://dicts.2study.top/',
    // RESOURCE_URL: '/',
    RESOURCE_URL: 'https://files.2study.top/',
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
}

AppEnv.IS_LOGIN = !!AppEnv.TOKEN
AppEnv.CAN_REQUEST = AppEnv.IS_LOGIN

export const RESOURCE_PATH = ENV.API + 'static'

export const DICT_LIST = {
  WORD: {
    ALL: `/list/word.json`,
    RECOMMENDED: `/list/recommend_word.json`,
  },
  ARTICLE: {
    ALL: `/list/article.json`,
    RECOMMENDED: `/list/recommend_article.json`,
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
  version: 2,
}
export const SAVE_DICT_KEY = {
  key: 'typing-word-dict',
  version: 4,
}
export const SAVE_SETTING_KEY = {
  key: 'typing-word-setting',
  version: 17,
}
export const EXPORT_DATA_KEY = {
  key: 'typing-word-export',
  version: 4,
}
export const LOCAL_FILE_KEY = 'typing-word-files'

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

export const IS_DEV = import.meta.env.MODE === 'development'
export const LIB_JS_URL = {
  SHEPHERD: `${ENV.RESOURCE_URL}/libs/Shepherd.14.5.1.mjs.js`,
  SNAPDOM: `${ENV.RESOURCE_URL}/libs/snapdom.min.js`,
  JSZIP: `${ENV.RESOURCE_URL}/libs/jszip.min.js`,
  XLSX: `${ENV.RESOURCE_URL}/libs/xlsx.full.min.js`,
}
export const PronunciationApi = 'https://dict.youdao.com/dictvoice?audio='
export const DefaultShortcutKeyMap = {
  [ShortcutKey.EditArticle]: 'Ctrl+E',
  [ShortcutKey.ShowWord]: 'Escape',
  [ShortcutKey.Previous]: 'Alt+⬅',
  [ShortcutKey.Next]: 'Tab',
  [ShortcutKey.ToggleSimple]: '`',
  [ShortcutKey.ToggleCollect]: 'Enter',
  [ShortcutKey.PreviousChapter]: 'Ctrl+⬅',
  [ShortcutKey.NextChapter]: 'Ctrl+➡',
  [ShortcutKey.RepeatChapter]: 'Ctrl+Enter',
  [ShortcutKey.DictationChapter]: 'Alt+Enter',
  [ShortcutKey.PlayWordPronunciation]: 'Ctrl+P',
  [ShortcutKey.ToggleShowTranslate]: 'Ctrl+Z',
  [ShortcutKey.ToggleDictation]: 'Ctrl+I',
  [ShortcutKey.ToggleTheme]: 'Ctrl+Q',
  [ShortcutKey.ToggleConciseMode]: 'Ctrl+M',
  [ShortcutKey.TogglePanel]: 'Ctrl+L',
  [ShortcutKey.RandomWrite]: 'Ctrl+R',
  [ShortcutKey.KnowWord]: '1',
  [ShortcutKey.UnknownWord]: '2',
  [ShortcutKey.ChooseA]: '1',
  [ShortcutKey.ChooseB]: '2',
  [ShortcutKey.ChooseC]: '3',
  [ShortcutKey.ChooseD]: '4',
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
    WordPracticeStage.IdentifyReviewAll,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.DictationOnly]: [
    WordPracticeStage.DictationNewWord,
    WordPracticeStage.DictationReview,
    WordPracticeStage.DictationReviewAll,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.ListenOnly]: [
    WordPracticeStage.ListenNewWord,
    WordPracticeStage.ListenReview,
    WordPracticeStage.ListenReviewAll,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.System]: [
    WordPracticeStage.FollowWriteNewWord,
    WordPracticeStage.ListenNewWord,
    WordPracticeStage.DictationNewWord,
    WordPracticeStage.IdentifyReview,
    WordPracticeStage.ListenReview,
    WordPracticeStage.DictationReview,
    WordPracticeStage.IdentifyReviewAll,
    WordPracticeStage.ListenReviewAll,
    WordPracticeStage.DictationReviewAll,
    WordPracticeStage.Complete,
  ],
  [WordPracticeMode.Shuffle]: [WordPracticeStage.Shuffle, WordPracticeStage.Complete],
  [WordPracticeMode.Review]: [
    WordPracticeStage.IdentifyReview,
    WordPracticeStage.ListenReview,
    WordPracticeStage.DictationReview,
    WordPracticeStage.IdentifyReviewAll,
    WordPracticeStage.ListenReviewAll,
    WordPracticeStage.DictationReviewAll,
    WordPracticeStage.Complete,
  ],
}
export const WordPracticeStageNameMap: Record<WordPracticeStage, string> = {
  [WordPracticeStage.FollowWriteNewWord]: '跟写新词',
  [WordPracticeStage.IdentifyNewWord]: '自测新词',
  [WordPracticeStage.ListenNewWord]: '听写新词',
  [WordPracticeStage.DictationNewWord]: '默写新词',
  [WordPracticeStage.FollowWriteReview]: '跟写上次学习',
  [WordPracticeStage.IdentifyReview]: '自测上次学习',
  [WordPracticeStage.ListenReview]: '听写上次学习',
  [WordPracticeStage.DictationReview]: '默写上次学习',
  [WordPracticeStage.FollowWriteReviewAll]: '跟写之前学习',
  [WordPracticeStage.IdentifyReviewAll]: '自测之前学习',
  [WordPracticeStage.ListenReviewAll]: '听写之前学习',
  [WordPracticeStage.DictationReviewAll]: '默写之前学习',
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
  [WordPracticeMode.ReviewWordsTest]: '单词测试'
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
  [WordPracticeMode.ReviewWordsTest]: '/words-test'
}
export class DictId {
  static wordCollect = 'wordCollect'
  static wordWrong = 'wordWrong'
  static wordKnown = 'wordKnown'
  static articleCollect = 'articleCollect'
}
