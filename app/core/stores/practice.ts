import { defineStore } from 'pinia'
import { useSettingStore } from './setting'
import { WordPracticeStage } from '../types'
import { WordPracticeModeStageMap, WordPracticeStageNameMap } from '../config/env'

export type TimerPauseReason = null | 'manual' | 'auto_visibility' | 'auto_idle'

export interface PracticeState {
  stage: WordPracticeStage
  startDate: number
  spend: number
  total: number
  newWordNumber: number
  reviewWordNumber: number
  inputWordNumber: number //当前总输入了多少个单词（不包含跳过）
  wrong: number
  /** 学习计时是否暂停（单词练习页 interval 不累计 spend） */
  timerPaused: boolean
  /** 暂停原因：手动 / 切走标签 / 长时间无键盘操作 */
  timerPauseReason: TimerPauseReason
  /**
   * 学习时间片段列表，每项为 [startMs, endMs]。
   * - resumeTimer 时 push [now, now] 开启新片段
   * - 计时进行中 end 实时被更新（保存/暂停时写入当前时刻）
   * - pauseTimer 时将最后一条 end 更新为暂停时刻，使其定格
   */
  segments: [number, number][]
}

export const usePracticeStore = defineStore('practice', {
  state: (): PracticeState => {
    return {
      stage: WordPracticeStage.FollowWriteNewWord,
      spend: 0,
      startDate: Date.now(),
      total: 0,
      newWordNumber: 0,
      reviewWordNumber: 0,
      inputWordNumber: 0,
      wrong: 0,
      timerPaused: false,
      timerPauseReason: null,
      segments: [],
    }
  },
  getters: {
    getStageName: state => {
      return WordPracticeStageNameMap[state.stage]
    },
    nextStage: state => {
      const settingStore = useSettingStore()
      const stages = WordPracticeModeStageMap[settingStore.wordPracticeMode]
      const index = stages.findIndex(v => v === state.stage)
      return stages[index + 1]
    },
  },
  actions: {
    pauseTimer(reason: TimerPauseReason) {
      if (!this.timerPaused) {
        // 将最后一条片段的 end 定格为当前时刻
        if (this.segments.length > 0) {
          this.segments[this.segments.length - 1][1] = Date.now()
        }
        this.timerPaused = true
        this.timerPauseReason = reason
      }
    },
    resumeTimer() {
      this.timerPaused = false
      this.timerPauseReason = null
      // 开启新片段，start 和 end 均为当前时刻
      const now = Date.now()
      this.segments.push([now, now])
    },
  },
})