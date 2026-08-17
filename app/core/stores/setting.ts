import { defineStore } from 'pinia'
import { checkAndUpgradeSaveSetting, cloneDeep, parseJsonStr } from '../utils'
import { get, set } from 'idb-keyval'
import { APP_VERSION, DefaultShortcutKeyMap, SAVE_SETTING_KEY } from '../config/env'
import { IdentifyMethod, type SaveData, WordPracticeMode, WordPracticeType } from '../types'
import type { FSRSParameters } from 'ts-fsrs'

export interface SettingState {
  soundType: string

  wordSound: boolean
  wordSoundVolume: number
  wordSoundSpeed: number
  sentenceSoundVolume: number
  sentenceSoundSpeed: number
  wordReviewRatio: number // 单词复习比例
  autoAddRandomReviewWhenNoDue: boolean // 无到期词时自动加入随机复习

  articleSound: boolean
  articleAutoPlayNext: boolean
  articleSoundVolume: number
  articleSoundSpeed: number

  keyboardSound: boolean
  keyboardSoundVolume: number
  keyboardSoundFile: string

  effectSound: boolean
  effectSoundVolume: number

  repeatCount: number // 重复次数
  repeatCustomCount?: number // 自定义重复次数
  dictation: boolean // 显示默写
  translate: boolean // 显示翻译
  showNearWord: boolean // 显示上/下一个词
  ignoreCase: boolean // 忽略大小写
  //@deprecated 没有意义
  allowWordTip: boolean // 默写时时否允许查看提示
  waitTimeForChangeWord: number // 切下一个词的等待时间（自动模式）
  spaceCooldownTime: number // 空格冷却时间（手动模式，单词完成后忽略空格键的时间）
  fontSize: {
    articleForeignFontSize: number
    articleTranslateFontSize: number
    wordForeignFontSize: number
    wordTranslateFontSize: number
  }
  showToolbar: boolean //收起/展开工具栏
  showPanel: boolean // 收起/展开面板
  sideExpand: boolean // 收起/展开左侧侧边栏
  theme: string
  shortcutKeyMap: Record<string, string>
  first: boolean
  firstTime: number
  webAppVersion: number
  load: boolean
  conflictNotice: boolean // 其他脚本/插件冲突提示
  showConflictNotice2: boolean // 其他脚本/插件冲突提示
  showUsageTips: boolean //  显示使用提示
  ignoreSimpleWord: boolean // 忽略简单词
  wordPracticeMode: WordPracticeMode // 单词练习模式
  wordPracticeType: WordPracticeType // 单词练习类型
  autoNextWord: boolean // 自动切换下一个单词
  inputWrongClear: boolean // 单词输入错误，清空已输入内容
  mobileNavCollapsed: boolean // 移动端底部导航栏收缩状态
  ignoreSymbol: boolean // 过滤符号
  practiceSentence: boolean // 练习例句
  autoPlayFirstSentence: boolean // 单词发音结束后自动播放首条例句

  fsrsEasyLimit: number // 小于等于fsrsEasyLimit的卡片会评估为Easy
  fsrsGoodLimit: number // 小于等于fsrsEasyLimit且小于等于fsrsHardLimit的卡片会评估为Good
  fsrsHardLimit: number // 小于等于fsrsHardLimit的卡片会评估为Hard
  fsrsParameters: FSRSParameters

  //@deprecated 没有意义
  identifyMethod: IdentifyMethod
  _ignoreWatch: boolean //忽略监听，避免重复保存和上传
  ttsVoiceMap: { key: string; voice: string }[] // 浏览器 TTS 声色映射，key 为 OS+浏览器组合（如 mac+chrome）
  showEtymologyAndRelWords: boolean // 显示词源和相关词
  showWordQuestion: boolean //显示单词选项
}

export const getDefaultSettingState = (): SettingState => ({
  soundType: 'us',

  wordSound: true,
  wordSoundVolume: 100,
  wordSoundSpeed: 1,
  sentenceSoundVolume: 100,
  sentenceSoundSpeed: 1,
  wordReviewRatio: 3,
  autoAddRandomReviewWhenNoDue: false,

  articleSound: true,
  articleAutoPlayNext: false,
  articleSoundVolume: 100,
  articleSoundSpeed: 1,

  keyboardSound: true,
  keyboardSoundVolume: 100,
  keyboardSoundFile: '笔记本键盘',

  effectSound: true,
  effectSoundVolume: 100,

  repeatCount: 1,
  repeatCustomCount: null,
  dictation: false,
  translate: true,
  showNearWord: true,
  ignoreCase: true,
  allowWordTip: true,
  waitTimeForChangeWord: 300,
  spaceCooldownTime: 0,
  fontSize: {
    articleForeignFontSize: 48,
    articleTranslateFontSize: 20,
    wordForeignFontSize: 48,
    wordTranslateFontSize: 20,
  },
  showToolbar: true,
  showPanel: true,
  sideExpand: true,
  theme: 'auto',
  shortcutKeyMap: cloneDeep(DefaultShortcutKeyMap),
  first: true,
  firstTime: Date.now(),
  webAppVersion: APP_VERSION.version,
  load: false,
  conflictNotice: true,
  showConflictNotice2: true,
  showUsageTips: true,
  ignoreSimpleWord: false,
  wordPracticeMode: WordPracticeMode.System,
  wordPracticeType: WordPracticeType.FollowWrite,
  autoNextWord: false,
  inputWrongClear: false,
  mobileNavCollapsed: false,
  ignoreSymbol: true,
  practiceSentence: false,
  autoPlayFirstSentence: true,
  fsrsEasyLimit: 0,
  fsrsGoodLimit: 3,
  fsrsHardLimit: 6,

  fsrsParameters: {
    request_retention: 0.9,
    maximum_interval: 36500,
    w: [
      0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
      1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
    ],
    enable_fuzz: false,
    enable_short_term: true,
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  },

  identifyMethod: IdentifyMethod.SelfAssessment,
  _ignoreWatch: false,
  ttsVoiceMap: [],
  showEtymologyAndRelWords: false,
  showWordQuestion: true,
})

export const useSettingStore = defineStore('setting', {
  state: (): SettingState => {
    return getDefaultSettingState()
  },
  actions: {
    setState(obj: any) {
      this.$patch(obj)
    },
    async init(): Promise<SaveData | null> {
      return new Promise(async resolve => {
        try {
          let jsonStr = await get(SAVE_SETTING_KEY.key)
          if (jsonStr) {
            let result = await parseJsonStr(jsonStr, checkAndUpgradeSaveSetting)

            //如果升级了，那么要保持本地比线上新，不然会被覆盖
            const shouldRefreshUpdatedAt = (result.val as any)?.__updateLocalData ?? false
            delete (result.val as any)?.__updateLocalData
            if (shouldRefreshUpdatedAt) {
              await set(SAVE_SETTING_KEY.key, JSON.stringify(result))
            }
            this.setState(result.val)
            resolve(result)
          }
          resolve(null)
        } catch (e) {
          console.error('读取本地设置数据失败', e)
          resolve(null)
        }
      })
    },
  },
})
