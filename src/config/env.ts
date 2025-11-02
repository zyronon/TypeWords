import { useBaseStore } from "@/stores/base.ts";

export const GITHUB = 'https://github.com/zyronon/TypeWords'
export const ProjectName = 'Type Words'
export const Host = '2study.top'
export const Origin = `https://${Host}`
export const APP_NAME = 'Type Words'

const common = {
  word_dict_list_version: 1
}
const map = {
  DEV: {
    API: 'http://localhost/',
  }
}

export const ENV = Object.assign(map['DEV'], common)
// export const IS_OFFICIAL = import.meta.env.DEV
// export let IS_LOGIN = true
export const IS_OFFICIAL = false
export let IS_LOGIN = false
export const CAN_REQUEST = IS_LOGIN && IS_OFFICIAL
export const RESOURCE_PATH = ENV.API + 'static'

export const DICT_LIST = {
  WORD: {
    ALL: '/list/word.json',
    RECOMMENDED: '/list/recommend_word.json',
  },
  ARTICLE: {
    ALL: '/list/article.json',
    RECOMMENDED: '/list/article.json',
  }
}

export const SoundFileKeys = {
  MECHANICAL: 'MechanicalKeyboard',
  MECHANICAL1: 'MechanicalKeyboard1',
  MECHANICAL2: 'MechanicalKeyboard2',
  VINTAGE: 'VintageMechanicalKeyboard',
  LAPTOP: 'LaptopKeyboard'
}

// Fonction pour obtenir les options de son avec traductions
export function getSoundFileOptions(t: (key: string) => string) {
  return [
    {value: 'mechanical', label: t('MechanicalKeyboard')},
    {value: 'mechanical1', label: t('MechanicalKeyboard1')},
    {value: 'mechanical2', label: t('MechanicalKeyboard2')},
    {value: 'vintage', label: t('VintageMechanicalKeyboard')},
    {value: 'laptop', label: t('LaptopKeyboard')},
  ]
}

// Pour la compatibilité avec l'ancien code
export const SoundFileOptions = [
  {value: 'mechanical', label: 'MechanicalKeyboard'},
  {value: 'mechanical1', label: 'MechanicalKeyboard1'},
  {value: 'mechanical2', label: 'MechanicalKeyboard2'},
  {value: 'vintage', label: 'VintageMechanicalKeyboard'},
  {value: 'laptop', label: 'LaptopKeyboard'},
]
export const APP_VERSION = {
  key: 'type-words-app-version',
  version: 1
}
export const SAVE_DICT_KEY = {
  key: 'typing-word-dict',
  version: 4
}
export const SAVE_SETTING_KEY = {
  key: 'typing-word-setting',
  version: 15
}
export const EXPORT_DATA_KEY = {
  key: 'typing-word-export',
  version: 4
}
export const LOCAL_FILE_KEY = 'typing-word-files'
export const PracticeSaveWordKey = {
  key: 'PracticeSaveWord',
  version: 1
}
export const PracticeSaveArticleKey = {
  key: 'PracticeSaveArticle',
  version: 1
}