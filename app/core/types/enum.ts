
export enum CompareResult {
  RemoteNewer = 0,
  LocalNewer = 1,
  Equal = 2,
  NoRemote = 3,
  NoLocal = 4,
}

export enum DictType {
  collect = 'collect',
  simple = 'simple',
  wrong = 'wrong',
  known = 'known',
  word = 'word',
  article = 'article',
}
export enum Sort {
  normal = 0,
  random = 1,
  reverse = 2,
  reverseAll = 3,
  randomAll = 4,
}

export enum ShortcutKey {
  ShowWord = 'ShowWord',
  EditArticle = 'EditArticle',
  Next = 'Next',
  Ignore = 'Ignore',
  Previous = 'Previous',
  ToggleSimple = 'ToggleSimple',
  ToggleCollect = 'ToggleCollect',
  CollectToDict = 'CollectToDict',
  NextChapter = 'NextChapter',
  PreviousChapter = 'PreviousChapter',
  NextStep = 'NextStep',
  RepeatChapter = 'RepeatChapter',
  DictationChapter = 'DictationChapter',
  PlayWordPronunciation = 'PlayWordPronunciation',
  ToggleShowTranslate = 'ToggleShowTranslate',
  ToggleDictation = 'ToggleDictation',
  ToggleTheme = 'ToggleTheme',
  ToggleToolbar = 'ToggleToolbar',
  ToggleConciseMode = 'ToggleConciseMode',
  TogglePanel = 'TogglePanel',
  RandomWrite = 'RandomWrite',
  KnowWord = 'KnowWord',
  UnknownWord = 'UnknownWord',
  MasteredWord = 'MasteredWord',
  ChooseA = 'ChooseA',
  ChooseB = 'ChooseB',
  ChooseC = 'ChooseC',
  ChooseD = 'ChooseD',
  SelfTestingChooseA = 'SelfTestingChooseA',
  SelfTestingChooseB = 'SelfTestingChooseB',
  SelfTestingChooseC = 'SelfTestingChooseC',
  SelfTestingChooseD = 'SelfTestingChooseD',
  PlaySentence1 = 'PlaySentence1',
  PlaySentence2 = 'PlaySentence2',
  PlaySentence3 = 'PlaySentence3',
  PlaySentence4 = 'PlaySentence4',
  PlaySentence5 = 'PlaySentence5',
  PlaySentence6 = 'PlaySentence6',
  PlaySentence7 = 'PlaySentence7',
  PlaySentence8 = 'PlaySentence8',
  PlaySentence9 = 'PlaySentence9',
}

export const SENTENCE_PLAY_SHORTCUT_KEYS = [
  ShortcutKey.PlaySentence1,
  ShortcutKey.PlaySentence2,
  ShortcutKey.PlaySentence3,
  ShortcutKey.PlaySentence4,
  ShortcutKey.PlaySentence5,
  ShortcutKey.PlaySentence6,
  ShortcutKey.PlaySentence7,
  ShortcutKey.PlaySentence8,
  ShortcutKey.PlaySentence9,
] as const

export enum TranslateEngine {
  Baidu = 0,
}

export enum PracticeArticleWordType {
  Symbol,
  Number,
  Word,
}

//练习模式
//新增模式，记得测试正常流程
export enum WordPracticeMode {
  // practice-words
  System = 0,
  Free = 1,
  IdentifyOnly = 2, // 独立自测模式
  DictationOnly = 3, // 独立默写模式
  ListenOnly = 4, // 独立听写模式
  Shuffle = 5, // 随机复习模式
  Review = 6, // 复习模式
  // words-test
  ShuffleWordsTest = 7, // 单词测试模式
  ReviewWordsTest = 8, // 单词测试模式
  Custom = 9, // 自定义流程
}

//练习类型
export enum WordPlayTrigger {
  NewWord = 'newWord',
  RepeatWord = 'repeatWord',
  ResetSameWord = 'resetSameWord',
  RevealUnknown = 'revealUnknown',
  DictationReveal = 'dictationReveal',
  IdentifyWrongKey = 'identifyWrongKey',
  Typo = 'typo',
  DelRetry = 'delRetry',
  Manual = 'manual',
  Shortcut = 'shortcut',
}

export enum WordPracticeType {
  FollowWrite, //跟写
  Spell,
  Identify,
  Listen,
  Dictation,
}

//练习类型
export enum PracticeType {
  FollowWrite, //跟写
  Spell,
  Identify,
  Listen,
  Dictation,
}

export enum CodeType {
  Login = 0,
  Register = 1,
  ResetPwd = 2,
  ChangeEmail = 3,
  ChangePhoneNew = 4,
  ChangePhoneOld = 5,
}

export enum ImportStatus {
  Idle = 0,
  Success = 1,
  Fail = 2,
}

//练习阶段
export enum WordPracticeStage {
  FollowWriteNewWord = 0,
  IdentifyNewWord = 1,
  ListenNewWord = 2,
  DictationNewWord = 3,

  FollowWriteReview = 4,
  IdentifyReview = 5,
  ListenReview = 6,
  DictationReview = 7,

  Shuffle = 12,
  Complete = 13,
}

// 自测方法
export enum IdentifyMethod {
  // 自我评估
  SelfAssessment = 0,
  // 单词测试
  WordTest = 1,
  // 快速自测
  QuickIdentify = 2,
}

export enum SyncDataType {
  dict = 'dict',
  setting = 'setting',
  practice_word = 'practice_word',
  practice_article = 'practice_article',
}

export enum Frequency {
  Rare = 0,
  Uncommon = 1,
  Common = 2,
}
