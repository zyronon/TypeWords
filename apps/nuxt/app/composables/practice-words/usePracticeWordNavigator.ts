/**
 * 练习页「推进器」：对应 v1 的 next() / nextStage() / wordLoop()。
 *
 * 设计目标：只读 resolvePhase() 返回的 wordAdvance / stageAdvance，不再写 mode+stage 硬编码分支。
 * 仍保留 v1 的错词复习、Spell 子相位、空列表跳阶段等「系统内置」行为。
 */
import type { PracticeData, TaskWords, Word } from '@typewords/core/types/types.ts'
import { useSettingStore } from '@typewords/core/stores/setting.ts'
import { usePracticeStore } from '@typewords/core/stores/practice.ts'
import { WordPracticeType } from '@typewords/core/types/enum.ts'
import { emitter, EventKey } from '@typewords/core/utils/eventBus.ts'
import { cloneDeep, shuffle } from '@typewords/core/utils'
import { getFlowIdForMode } from './builtin-flows.ts'
import { GROUP_SIZE } from './phase-templates.ts'
import { buildSessionContext, getActiveFlowId, loadPracticeFlow, resolvePhase } from './practice-phase-registry.ts'
import { applyPhaseDefinition, displayOverride, sessionDisplay } from './usePracticeDisplayPolicy.ts'
import type {
  PracticePhaseDefinition,
  PracticeSessionSnapshot,
  SessionContext,
  StageAdvanceRule,
} from './registry-types.ts'

/** createPracticeWordNavigator 的依赖注入，避免与页面级 data/ref 硬耦合 */
export type NavigatorDeps = {
  getPracticeData: () => PracticeData
  getTaskWords: () => TaskWords
  getCurrentWord: () => Word
  checkWordIsNeedNext: (word: Word) => boolean
  complete: () => void
}

/** 当前词是否为本阶段列表最后一个（或列表已空） */
function atListEnd(data: PracticeData): boolean {
  return data.words.length === 0 || data.index === data.words.length - 1
}

/**
 * 按 stageAdvance.wordsFrom 从 taskWords / practiceData 取词表。
 * runStageAdvance 专用。
 */
function resolveWordsFrom(
  source: StageAdvanceRule['wordsFrom'],
  taskWords: TaskWords,
  data: PracticeData
): Word[] {
  switch (source) {
    case 'taskNew':
      return taskWords.new
    case 'taskReview':
      return taskWords.review
    case 'wrongWords':
      return data.wrongWords
    case 'current':
      return data.words
  }
}

/**
 * 工厂：创建绑定到当前页面的推进器实例。
 * 页面只暴露 next() / skipStep()，内部逻辑全在这里。
 */
export function createPracticeWordNavigator(deps: NavigatorDeps) {
  const settingStore = useSettingStore()
  const statStore = usePracticeStore()

  /** 收集 resolvePhase 需要的上下文（见 buildSessionContext 注释） */
  function getCtx(): SessionContext {
    return buildSessionContext(
      settingStore.wordPracticeMode,
      statStore.stage,
      settingStore.wordPracticeType,
      settingStore.identifyMethod,
      deps.getPracticeData(),
      deps.getTaskWords()
    )
  }

  /**
   * 根据当前上下文解析相位，并同步 practiceType + 显隐（applyPhaseDefinition）。
   * 每次 index/stage/错词状态变化后都应调用。
   */
  function syncPhase() {
    const phase = resolvePhase(getCtx())
    settingStore.wordPracticeType = phase.key.practiceType
    applyPhaseDefinition(phase)
    return phase
  }

  /**
   * v1 wordLoop() 原样：跟写 7 词 ↔ Spell 交替，index 在组内循环。
   * 仅 wordAdvance.type === 'wordLoop' 时由 runWordAdvance 调用。
   */
  function runWordLoop(groupSize = GROUP_SIZE) {
    const data = deps.getPracticeData()
    if (settingStore.wordPracticeType === WordPracticeType.FollowWrite) {
      data.index++
      if (data.index % groupSize === 0) {
        settingStore.wordPracticeType = WordPracticeType.Spell
        data.index -= groupSize
      }
    } else {
      data.index++
      if (data.index % groupSize === 0) {
        settingStore.wordPracticeType = WordPracticeType.FollowWrite
      }
    }
    syncPhase()
  }

  /**
   * 词内推进：读 phase.wordAdvance。
   * - wordLoop → runWordLoop
   * - increment → index++
   */
  function runWordAdvance(phase: PracticePhaseDefinition) {
    if (phase.wordAdvance.type === 'wordLoop') {
      runWordLoop(phase.wordAdvance.groupSize ?? GROUP_SIZE)
    } else {
      deps.getPracticeData().index++
    }
  }

  /**
   * v1 nextStage()：切换到指定 stage，装入新词表，过滤已掌握词。
   * 若过滤后无词，清空列表并递归 next(false) 继续跳阶段（防死循环逻辑同 v1）。
   */
  function goToStage(stage: NonNullable<StageAdvanceRule['nextStage']>, originList: Word[], log = '') {
    const data = deps.getPracticeData()
    const list = originList.filter(v => !deps.checkWordIsNeedNext(v))
    console.log(log)
    statStore.stage = stage
    if (list.length) {
      data.words = list
      data.index = 0
      syncPhase()
    } else {
      console.log(`${log}:无单词略过`)
      data.words = []
      data.index = 0
      syncPhase()
      next(false)
    }
  }

  /**
   * 阶段推进：读 phase.stageAdvance。
   * complete → 结算；否则按 wordsFrom 取词、可选 shuffle，再 goToStage。
   * 【这是替代 v1 advanceStructuredStage 里几十行 if-else 的关键函数】
   */
  function runStageAdvance(phase: PracticePhaseDefinition) {
    const rule = phase.stageAdvance
    const data = deps.getPracticeData()
    const taskWords = deps.getTaskWords()

    if (rule.forcePracticeType) {
      settingStore.wordPracticeType = rule.forcePracticeType
    }

    if (rule.complete) {
      deps.complete()
      return
    }

    if (!rule.nextStage) {
      deps.complete()
      return
    }

    let words = resolveWordsFrom(rule.wordsFrom, taskWords, data)
    if (rule.shuffle) {
      words = shuffle([...words])
    }
    goToStage(rule.nextStage, words, rule.toast ?? '')
  }

  /**
   * 本阶段列表练完但还有错词：进入错词复习（仍在当前 stage，isTypingWrongWord=true）。
   */
  function runWrongWordRetry() {
    const data = deps.getPracticeData()
    data.isTypingWrongWord = true
    settingStore.wordPracticeType = WordPracticeType.FollowWrite
    console.log('当前学完了，但还有错词')
    data.words = shuffle(cloneDeep(data.wrongWords))
    data.index = 0
    data.wrongWords = []
    syncPhase()
  }

  /**
   * 是否应在「列表最后一个词」时切入 Spell 子相位（跟写组内拼写），而非进入下一阶段。
   * 判断条件：
   *  1. 当前 phase 是 wordLoop 类型（不硬编码 stage 名）
   *  2. 当前 practiceType 不是 Spell（避免 Spell 结束后重入）
   *  3. 未被 ignoreLoop（skipStep 跳阶段时传 true）
   */
  function shouldEnterSpellSubPhase(phase: PracticePhaseDefinition, ignoreLoop: boolean): boolean {
    if (ignoreLoop) return false
    if (settingStore.wordPracticeType === WordPracticeType.Spell) return false
    return phase.wordAdvance.type === 'wordLoop'
  }

  /**
   * 执行 Spell 子相位切换：index 回到本组起点，practiceType=Spell，必要时跳过当前词。
   * 调用后外层 next() 必须 return，避免重复 syncPhase（与 v1 return 语义一致）。
   */
  function handleSpellSubPhaseTransition(word: Word, ignoreLoop: boolean) {
    const data = deps.getPracticeData()
    const phase = resolvePhase(getCtx())
    const groupSize = phase.wordAdvance.groupSize ?? GROUP_SIZE
    data.index = Math.floor(data.index / groupSize) * groupSize
    emitter.emit(EventKey.resetWord)
    settingStore.wordPracticeType = WordPracticeType.Spell
    syncPhase()
    if (deps.checkWordIsNeedNext(word)) next(false, ignoreLoop)
  }

  /** 列表末尾处理：Spell 子相位 → 错词复习 → 阶段推进（自由/系统共用） */
  function handleListEnd(phase: PracticePhaseDefinition, ignoreLoop: boolean): boolean {
    const data = deps.getPracticeData()
    const word = deps.getCurrentWord()

    if (data.words.length && shouldEnterSpellSubPhase(phase, ignoreLoop)) {
      handleSpellSubPhaseTransition(word, ignoreLoop)
      return true
    }

    data.wrongWords = data.wrongWords.filter(v => !deps.checkWordIsNeedNext(v))
    if (phase.requireWrongWordClear && data.wrongWords.length) {
      runWrongWordRetry()
      return false
    }

    data.isTypingWrongWord = false
    const mainPhase = resolvePhase({
      ...getCtx(),
      practiceData: { ...data, isTypingWrongWord: false },
    })
    runStageAdvance(mainPhase)
    return false
  }

  /**
   * 主入口，对应 v1 next(isTyping, ignoreLoop)。
   * 流程：记错词统计 → 按 free/结构化分支推进 → syncPhase → 跳过已掌握词。
   */
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

    const phase = resolvePhase(getCtx())

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

  /** 跳过本阶段：index 置末，清空错词，ignoreLoop 推进（Footer「下一阶段」） */
  function skipStep() {
    const data = deps.getPracticeData()
    data.index = data.words.length - 1
    data.wrongWords = []
    next(false, true)
  }

  return { next, skipStep, syncPhase, goToStage }
}

/**
 * 持久化前快照：除 practiceData/stat 外，额外存 flowId + 显隐，供刷新恢复。
 * 调用方：savePracticeDataIns
 */
export function buildSessionSnapshot(practiceData: PracticeData): PracticeSessionSnapshot {
  const settingStore = useSettingStore()
  return {
    wordPracticeType: settingStore.wordPracticeType,
    identifyMethod: settingStore.identifyMethod,
    isTypingWrongWord: practiceData.isTypingWrongWord,
    wordPracticeMode: settingStore.wordPracticeMode,
    flowId: getActiveFlowId(),
    flowVersion: 1,
    sessionDisplay:
      sessionDisplay.value ? { ...sessionDisplay.value } : undefined,
    displayOverride: displayOverride.value ? { ...displayOverride.value } : null,
  }
}

/**
 * 从 v2 缓存的 sessionSnapshot 恢复 flow + 显隐 + 错词状态。
 * 有 sessionDisplay 则原样恢复；否则走 resolvePhase 重算显隐。
 */
export function restoreSessionSnapshot(
  snapshot: PracticeSessionSnapshot,
  practiceData: PracticeData,
  taskWords: TaskWords
) {
  loadPracticeFlow(snapshot.flowId)
  const settingStore = useSettingStore()
  const statStore = usePracticeStore()

  settingStore.wordPracticeType = snapshot.wordPracticeType
  settingStore.identifyMethod = snapshot.identifyMethod
  practiceData.isTypingWrongWord = snapshot.isTypingWrongWord

  if (snapshot.sessionDisplay) {
    sessionDisplay.value = { ...snapshot.sessionDisplay }
    displayOverride.value = snapshot.displayOverride ? { ...snapshot.displayOverride } : null
  } else {
    sessionDisplay.value = null
    displayOverride.value = null
    const phase = resolvePhase(
      buildSessionContext(
        snapshot.wordPracticeMode,
        statStore.stage,
        snapshot.wordPracticeType,
        snapshot.identifyMethod,
        practiceData,
        taskWords
      )
    )
    settingStore.wordPracticeType = phase.key.practiceType
    applyPhaseDefinition(phase)
  }
}

/**
 * v2 缓存尚无 sessionSnapshot 时的兜底：按 mode 加载内置 flow 并重算显隐。
 * 修复 v1 刷新后 stage 与显隐不一致的问题。
 */
export function restoreSessionFromLegacy(practiceData: PracticeData, taskWords: TaskWords) {
  const settingStore = useSettingStore()
  const statStore = usePracticeStore()
  loadPracticeFlow(getFlowIdForMode(settingStore.wordPracticeMode))
  const phase = resolvePhase(
    buildSessionContext(
      settingStore.wordPracticeMode,
      statStore.stage,
      settingStore.wordPracticeType,
      settingStore.identifyMethod,
      practiceData,
      taskWords
    )
  )
  settingStore.wordPracticeType = phase.key.practiceType
  applyPhaseDefinition(phase)
}
