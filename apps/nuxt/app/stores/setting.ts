import { defineStore } from 'pinia'
import { checkAndUpgradeSaveSetting, cloneDeep } from '@/utils'
import { get } from 'idb-keyval'
import { AppEnv, DefaultShortcutKeyMap, SAVE_SETTING_KEY } from '@/config/env'
import { getSetting } from '@/apis'
import { WordPracticeMode, WordPracticeType } from '@/types/enum'

export interface SettingState {
  soundType: string

  wordSound: boolean
  wordSoundVolume: number
  wordSoundSpeed: number
  wordReviewRatio: number // 单词复习比例

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
  allowWordTip: boolean // 默写时时否允许查看提示
  waitTimeForChangeWord: number // 切下一个词的等待时间
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
  load: boolean
  conflictNotice: boolean // 其他脚本/插件冲突提示
  showConflictNotice2: boolean // 其他脚本/插件冲突提示
  showUsageTips: boolean //  显示使用提示
  ignoreSimpleWord: boolean // 忽略简单词
  wordPracticeMode: WordPracticeMode // 单词练习模式
  wordPracticeType: WordPracticeType // 单词练习类型
  disableShowPracticeSettingDialog: boolean // 不默认显示练习设置弹框
  autoNextWord: boolean // 自动切换下一个单词
  inputWrongClear: boolean // 单词输入错误，清空已输入内容
  mobileNavCollapsed: boolean // 移动端底部导航栏收缩状态
  ignoreSymbol: boolean // 过滤符号
  practiceSentence: boolean // 练习例句
}

export const getDefaultSettingState = (): SettingState => ({
  soundType: 'us',

  wordSound: true,
  wordSoundVolume: 100,
  wordSoundSpeed: 1,
  wordReviewRatio: 4,

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
  load: false,
  conflictNotice: true,
  showConflictNotice2: true,
  showUsageTips: true,
  ignoreSimpleWord: false,
  wordPracticeMode: WordPracticeMode.System,
  wordPracticeType: WordPracticeType.FollowWrite,
  disableShowPracticeSettingDialog: false,
  autoNextWord: true,
  inputWrongClear: false,
  mobileNavCollapsed: false,
  ignoreSymbol: true,
  practiceSentence: false
})

export const useSettingStore = defineStore('setting', {
  state: (): SettingState => {
    return getDefaultSettingState()
  },
  actions: {
    setState(obj: any) {
      this.$patch(obj)
    },
    init() {
      return new Promise(async resolve => {
        let configStr = await get(SAVE_SETTING_KEY.key)
        let data = checkAndUpgradeSaveSetting(configStr)
        if (AppEnv.CAN_REQUEST) {
          let res = await getSetting()
          if (res.success) {
            Object.assign(data, res.data)
          }
        }
        this.setState({ ...data, load: true })
        resolve(true)
      })
    },
  },
})
