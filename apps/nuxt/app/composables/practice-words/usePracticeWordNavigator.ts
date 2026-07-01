/**
 * 练习页「推进器」：对应 v1 的 next() / nextStage() / wordLoop()。
 *
 * 完全 cursor-native：
 * - cursor { nodeIndex, stepIndex, spellSubStep, wrongRetry } 是唯一位置指针
 * - resolvePhaseByCtxCursor(cursor) 是唯一相位查询入口
 * - 不再读写 statStore.stage
 */
import { ref } from 'vue'
import type { PracticeData, TaskWords, Word } from '@typewords/core/types/types.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { usePracticeStore } from '@typewords/core/stores/practice.ts'
import { WordPracticeType } from '@typewords/core/types/enum.ts'
import { emitter, EventKey } from '@typewords/core/utils/eventBus.ts'
import { cloneDeep, shuffle } from '@typewords/core/utils'
import { getFlowIdForMode } from './builtin-flows.ts'
import { GROUP_SIZE } from './phase-templates.ts'
import {
  advanceCursor,
  getActiveFlowId,
  getActiveRegistry,
  loadPracticeFlow,
  resolvePhaseByCtxCursor,
} from './practice-phase-registry.ts'
import { applyPhaseDefinition, displayOverride, sessionDisplay } from './usePracticeDisplayPolicy.ts'
import type {
  PracticeFlowCursor,
  PracticePhaseDefinition,
  PracticeSessionSnapshot,
  PracticeWordsSource,
} from './registry-types.ts'
import { cursorKey } from './registry-types.ts'

export type NavigatorDeps = {
  getPracticeData: () => PracticeData
  getTaskWords: () => TaskWords
  getCurrentWord: () => Word
  checkWordIsNeedNext: (word: Word) => boolean
  complete: () => void
}

// ─── 模块级 cursor 状态 ────────────────────────────────────────────────────────

export const activeCursor = ref<PracticeFlowCursor>({
  nodeIndex: 0,
  stepIndex: 0,
  spellSubStep: false,
  wrongRetry: false,
})

export function resetCursor() {
  activeCursor.value = { ...getActiveRegistry().initialCursor }
}

export function restoreCursorFromSnapshot(cursor: PracticeFlowCursor) {
  activeCursor.value = { ...cursor }
}

// ─── 词源解析 ──────────────────────────────────────────────────────────────────

function resolveWordsFromSource(
  source: PracticeWordsSource,
  taskWords: TaskWords,
  data: PracticeData
): Word[] {
  switch (source) {
    case 'taskNew':    return taskWords.new
    case 'taskReview': return taskWords.review
    case 'wrongWords': return data.wrongWords
    case 'current':    return data.words
  }
}

function getSourceForCursor(cursor: PracticeFlowCursor): PracticeWordsSource {
  const node = getActiveRegistry().config.nodes[cursor.nodeIndex]
  return node?.source ?? 'current'
}

// ─── 主工厂 ──────────────────────────────────────────────────────────────────────

export function createPracticeWordNavigator(deps: NavigatorDeps) {
  const settingStore = useSettingStore()
  const statStore = usePracticeStore()

  /** 同步 settingStore.wordPracticeType + 显隐（不再写 statStore.stage） */
  function syncPhase() {
    const cur = activeCursor.value
    const phase = resolvePhaseByCtxCursor(cur)
    settingStore.wordPracticeType = phase.practiceType
    applyPhaseDefinition(phase, cursorKey(cur.nodeIndex, cur.stepIndex))
    return phase
  }

  function runWordLoop(groupSize = GROUP_SIZE) {
    const data = deps.getPracticeData()
    if (settingStore.wordPracticeType === WordPracticeType.FollowWrite) {
      data.index++
      if (data.index % groupSize === 0) {
        activeCursor.value = { ...activeCursor.value, spellSubStep: true }
        settingStore.wordPracticeType = WordPracticeType.Spell
        data.index -= groupSize
      }
    } else {
      data.index++
      if (data.index % groupSize === 0) {
        activeCursor.value = { ...activeCursor.value, spellSubStep: false }
        settingStore.wordPracticeType = WordPracticeType.FollowWrite
      }
    }
    syncPhase()
  }

  function runWordAdvance(phase: PracticePhaseDefinition) {
    if (phase.wordAdvance.type === 'wordLoop') {
      runWordLoop(phase.wordAdvance.groupSize ?? GROUP_SIZE)
    } else {
      deps.getPracticeData().index++
    }
  }

  function goToCursor(newCursor: PracticeFlowCursor, originList: Word[], log = '') {
    const data = deps.getPracticeData()
    const list = originList.filter(v => !deps.checkWordIsNeedNext(v))
    console.log(log || `[Nav] → cursor ${newCursor.nodeIndex}:${newCursor.stepIndex}`)
    activeCursor.value = newCursor
    if (list.length) {
      data.words = list
      data.index = 0
      syncPhase()
    } else {
      console.log(`[Nav] cursor ${newCursor.nodeIndex}:${newCursor.stepIndex} 无单词，跳过`)
      data.words = []
      data.index = 0
      syncPhase()
      next(false)
    }
  }

  /** 阶段推进：读 phase.stepAdvance（纯 cursor 语义） */
  function runStepAdvance(phase: PracticePhaseDefinition) {
    const rule = phase.stepAdvance
    const data = deps.getPracticeData()
    const taskWords = deps.getTaskWords()

    if (rule.complete) {
      deps.complete()
      return
    }

    const { cursor: nextCursor, complete } = advanceCursor(activeCursor.value)
    if (complete) {
      deps.complete()
      return
    }

    const nextSource = getSourceForCursor(nextCursor)
    let words = resolveWordsFromSource(nextSource, taskWords, data)
    if (rule.shuffle) words = shuffle([...words])

    goToCursor(nextCursor, words, rule.toast ?? '')
  }

  function runWrongWordRetry() {
    const data = deps.getPracticeData()
    activeCursor.value = { ...activeCursor.value, wrongRetry: true, spellSubStep: false }
    data.isTypingWrongWord = true
    settingStore.wordPracticeType = WordPracticeType.FollowWrite
    console.log('[Nav] 还有错词，进入错词复习')
    data.words = shuffle(cloneDeep(data.wrongWords))
    data.index = 0
    data.wrongWords = []
    syncPhase()
  }

  function shouldEnterSpellSubPhase(phase: PracticePhaseDefinition, ignoreLoop: boolean): boolean {
    if (ignoreLoop) return false
    if (settingStore.wordPracticeType === WordPracticeType.Spell) return false
    return phase.wordAdvance.type === 'wordLoop'
  }

  function handleSpellSubPhaseTransition(word: Word, ignoreLoop: boolean) {
    const data = deps.getPracticeData()
    const phase = resolvePhaseByCtxCursor(activeCursor.value)
    const groupSize = phase.wordAdvance.groupSize ?? GROUP_SIZE
    data.index = Math.floor(data.index / groupSize) * groupSize
    emitter.emit(EventKey.resetWord)
    activeCursor.value = { ...activeCursor.value, spellSubStep: true }
    settingStore.wordPracticeType = WordPracticeType.Spell
    syncPhase()
    if (deps.checkWordIsNeedNext(word)) next(false, ignoreLoop)
  }

  function handleListEnd(phase: PracticePhaseDefinition, ignoreLoop: boolean): boolean {
    const data = deps.getPracticeData()
    const word = deps.getCurrentWord()

    if (data.words.length && shouldEnterSpellSubPhase(phase, ignoreLoop)) {
      handleSpellSubPhaseTransition(word, ignoreLoop)
      return true
    }

    if (activeCursor.value.wrongRetry) {
      activeCursor.value = { ...activeCursor.value, wrongRetry: false }
      data.isTypingWrongWord = false
    }

    data.wrongWords = data.wrongWords.filter(v => !deps.checkWordIsNeedNext(v))
    if (phase.requireWrongWordClear && data.wrongWords.length) {
      runWrongWordRetry()
      return false
    }

    data.isTypingWrongWord = false
    const mainCursor = { ...activeCursor.value, wrongRetry: false, spellSubStep: false }
    runStepAdvance(resolvePhaseByCtxCursor(mainCursor))
    return false
  }

  function atListEnd(data: PracticeData): boolean {
    return data.words.length === 0 || data.index === data.words.length - 1
  }

  function next(isTyping = true, ignoreLoop = false) {
    const data = deps.getPracticeData()
    const word = deps.getCurrentWord()
    const temp = word.word.toLowerCase()
    const preTimes = data.wrongTimesMap[temp] ?? 0

    if (settingStore.wordPracticeType === WordPracticeType.Spell && data.wrongTimes === 0 && preTimes) {
      const rIndex = data.wrongWords.findIndex(v => v.word.toLowerCase() === temp)
      if (rIndex >= 0) data.wrongWords.splice(rIndex, 1)
    }

    data.wrongTimesMap[temp] = preTimes + data.wrongTimes
    data.wrongTimes = 0
    if (isTyping) statStore.inputWordNumber++

    const phase = resolvePhaseByCtxCursor(activeCursor.value)

    if (atListEnd(data)) {
      if (handleListEnd(phase, ignoreLoop)) return
    } else {
      runWordAdvance(phase)
    }

    syncPhase()

    if (data.words.length > 0 && deps.checkWordIsNeedNext(deps.getCurrentWord())) {
      next(false, ignoreLoop)
    }
  }

  function skipStep() {
    const data = deps.getPracticeData()
    data.index = data.words.length - 1
    data.wrongWords = []
    next(false, true)
  }

  return { next, skipStep, syncPhase, goToCursor }
}

// ─── 持久化快照 ────────────────────────────────────────────────────────────────

export function buildSessionSnapshot(practiceData: PracticeData): PracticeSessionSnapshot {
  const settingStore = useSettingStore()
  return {
    wordPracticeType: settingStore.wordPracticeType,
    identifyMethod: settingStore.identifyMethod,
    isTypingWrongWord: practiceData.isTypingWrongWord,
    wordPracticeMode: settingStore.wordPracticeMode,
    flowId: getActiveFlowId(),
    flowVersion: 2,
    cursor: { ...activeCursor.value },
    sessionDisplay: sessionDisplay.value ? { ...sessionDisplay.value } : undefined,
    displayOverride: displayOverride.value ? { ...displayOverride.value } : null,
  }
}

export function restoreSessionSnapshot(
  snapshot: PracticeSessionSnapshot,
  practiceData: PracticeData,
  taskWords: TaskWords
) {
  loadPracticeFlow(snapshot.flowId)
  const settingStore = useSettingStore()

  settingStore.wordPracticeType = snapshot.wordPracticeType
  settingStore.identifyMethod = snapshot.identifyMethod
  practiceData.isTypingWrongWord = snapshot.isTypingWrongWord

  if (snapshot.cursor) {
    restoreCursorFromSnapshot(snapshot.cursor)
  } else {
    resetCursor()
  }

  if (snapshot.sessionDisplay) {
    sessionDisplay.value = { ...snapshot.sessionDisplay }
    displayOverride.value = snapshot.displayOverride ? { ...snapshot.displayOverride } : null
  } else {
    sessionDisplay.value = null
    displayOverride.value = null
    applyPhaseDefinition(
      resolvePhaseByCtxCursor(activeCursor.value),
      cursorKey(activeCursor.value.nodeIndex, activeCursor.value.stepIndex)
    )
  }
}

/** v2 缓存尚无 sessionSnapshot 时的兜底 */
export function restoreSessionFromLegacy(practiceData: PracticeData, taskWords: TaskWords) {
  const settingStore = useSettingStore()
  loadPracticeFlow(getFlowIdForMode(settingStore.wordPracticeMode))
  resetCursor()
  const phase = resolvePhaseByCtxCursor(activeCursor.value)
  settingStore.wordPracticeType = phase.practiceType
  applyPhaseDefinition(phase, cursorKey(activeCursor.value.nodeIndex, activeCursor.value.stepIndex))
}

export type { TaskWords }
