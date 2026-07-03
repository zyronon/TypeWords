/**
 * 练习页「推进器」：对应 v1 的 next() / nextStage() / wordLoop()。
 *
 * Phase 2.6 升级（完全适配新 cursor 结构）：
 * - cursor { nodeIndex, stepIndex, inWrongWordClear, loop, endActionIndex } 是唯一位置指针
 * - resolvePhaseByCtxCursor(cursor) 是唯一相位查询入口
 * - runWordLoop 读取 subSteps[]，不再硬编码 Spell 切换
 * - handleListEnd 驱动 onEnd action 队列，替代 requireWrongWordClear 布尔判断
 * - runWrongWordRetry 接收来自 wrongWordClear action 的 templateId + wordAdvance 配置
 * - 移除 spellSubStep / wrongRetry / shouldEnterSpellSubPhase / handleSpellSubPhaseTransition
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
  getInitialCursor,
  loadPracticeFlow,
  resolvePhaseByCtxCursor,
} from './practice-phase-registry.ts'
import { applyPhaseDefinition, displayOverride, sessionDisplay } from './usePracticeDisplayPolicy.ts'
import type {
  PracticeCollectWrongWordsAction,
  PracticeEndAction,
  PracticeFlowCursor,
  PracticeGenerateReportAction,
  PracticePhaseDefinition,
  PracticeSessionSnapshot,
  PracticeWrongWordClearAction,
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
  inWrongWordClear: false,
  loop: null,
  endActionIndex: null,
})

export function resetCursor() {
  activeCursor.value = { ...getInitialCursor() }
}

export function restoreCursorFromSnapshot(cursor: PracticeFlowCursor) {
  // 兼容旧缓存（Phase 2.5 以前的 cursor 无新字段）
  activeCursor.value = {
    nodeIndex: cursor.nodeIndex ?? 0,
    stepIndex: cursor.stepIndex ?? 0,
    inWrongWordClear: (cursor as any).inWrongWordClear ?? (cursor as any).wrongRetry ?? false,
    loop: (cursor as any).loop ?? null,
    endActionIndex: (cursor as any).endActionIndex ?? null,
  }
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

  // ─── wordLoop 子步骤推进 ──────────────────────────────────────────────────────

  /**
   * wordLoop 内推进词索引。
   * - 主步骤：index++ → 组满时进入 loop 子步骤（subStepIndex=0），重置 index 到组头
   * - loop 子步骤：index++ → 组尾时子步骤完成，重置 subStepIndex=0 回主步骤
   */
  function runWordLoop(groupSize = GROUP_SIZE) {
    const data = deps.getPracticeData()
    const cur = activeCursor.value

    if (cur.loop !== null) {
      // 当前处于 loop 子步骤：推进 index
      data.index++
      const { startIndex, endIndex, subStepIndex } = cur.loop
      // 子步骤词表打完（index 超出 endIndex）
      if (data.index > endIndex) {
        // 取下一个 subStep
        const mainPhase = getActiveRegistry().phasesByCursor.get(cursorKey(cur.nodeIndex, cur.stepIndex))
        const subSteps = mainPhase?.wordAdvance.subSteps ?? []
        const nextSubStepIndex = subStepIndex + 1

        if (nextSubStepIndex < subSteps.length) {
          // 还有更多子步骤，重置 index 到组头
          activeCursor.value = {
            ...cur,
            loop: { startIndex, endIndex, subStepIndex: nextSubStepIndex },
          }
          data.index = startIndex
        } else {
          // 所有子步骤完成，退出 loop，回到主步骤继续
          activeCursor.value = { ...cur, loop: null }
          // index 已到 endIndex+1，即下一组的开始
          data.index = endIndex + 1
        }
      }
    } else {
      // 当前处于主步骤（FollowWrite）：推进 index
      data.index++
      if (data.index % groupSize === 0) {
        // 一组练完，进入 loop 子步骤
        const mainPhase = getActiveRegistry().phasesByCursor.get(cursorKey(cur.nodeIndex, cur.stepIndex))
        const subSteps = mainPhase?.wordAdvance.subSteps ?? []

        if (subSteps.length > 0) {
          const groupStart = data.index - groupSize
          const groupEnd = data.index - 1
          activeCursor.value = {
            ...cur,
            loop: { startIndex: groupStart, endIndex: groupEnd, subStepIndex: 0 },
          }
          data.index = groupStart
          emitter.emit(EventKey.resetWord)
        }
        // 若 subSteps 为空，则直接继续主步骤（无子步骤）
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

  // ─── 错词清空（由 onEnd wrongWordClear action 驱动） ────────────────────────

  function runWrongWordRetry(action: PracticeWrongWordClearAction) {
    const data = deps.getPracticeData()
    // 进入 inWrongWordClear 状态（cursor 已在 advanceCursor 中设为 inWrongWordClear:true）
    data.isTypingWrongWord = true

    // 实际 practiceType 由 resolvePhaseByCtxCursor 从 action.templateId 派生，无需在此设置
    console.log(`[Nav] 还有错词，进入错词清空（templateId=${action.templateId}）`)
    data.words = shuffle(cloneDeep(data.wrongWords))
    data.index = 0
    data.wrongWords = []
    syncPhase()
  }

  // ─── 即时型 action 执行 ───────────────────────────────────────────────────────

  function executeInstantAction(action: PracticeEndAction): void {
    if (action.type === 'collectWrongWords') {
      const a = action as PracticeCollectWrongWordsAction
      console.log(`[Nav] 收藏错词 → ${a.target}`)
      // TODO: 实际收藏逻辑（Phase 3+）
    } else if (action.type === 'generateReport') {
      const a = action as PracticeGenerateReportAction
      console.log(`[Nav] 生成报告 → ${a.reportType}`)
      // TODO: 实际报告逻辑（Phase 3+）
    }
  }

  // ─── onEnd action 队列处理 ───────────────────────────────────────────────────

  /**
   * 执行 onEnd 队列中的下一个 action。
   * - wrongWordClear：有错词则进入 runWrongWordRetry；无错词则继续推进队列
   * - 即时型：执行后立即推进到下一个 action
   * - 队列耗尽：进入 stepAdvance
   */
  function processNextEndAction(phase: PracticePhaseDefinition, startActionIndex: number) {
    const onEnd = phase.onEnd
    const data = deps.getPracticeData()

    let actionIdx = startActionIndex

    while (actionIdx < onEnd.length) {
      const action = onEnd[actionIdx]

      if (action.type === 'wrongWordClear') {
        data.wrongWords = data.wrongWords.filter(v => !deps.checkWordIsNeedNext(v))
        if (data.wrongWords.length > 0) {
          // 进入 inWrongWordClear 状态
          activeCursor.value = {
            ...activeCursor.value,
            inWrongWordClear: true,
            endActionIndex: actionIdx,
            loop: null,
          }
          runWrongWordRetry(action as PracticeWrongWordClearAction)
          return // 挂起，等待用户完成错词清空
        }
        // 无错词，跳过此 action，继续下一个
        actionIdx++
        continue
      }

      if (action.type === 'navigate') {
        if (action.target === 'complete') {
          deps.complete()
          return
        }
        // nextStep 或其他 → 进入 stepAdvance
        break
      }

      // collectWrongWords / generateReport：即时型
      executeInstantAction(action)
      actionIdx++
    }

    // 队列耗尽或遇到 navigate(nextStep)，进入 stepAdvance
    if (activeCursor.value.inWrongWordClear) {
      activeCursor.value = { ...activeCursor.value, inWrongWordClear: false, endActionIndex: null }
    }
    data.isTypingWrongWord = false
    runStepAdvance(phase)
  }

  function handleListEnd(phase: PracticePhaseDefinition, ignoreLoop = false): boolean {
    const data = deps.getPracticeData()

    // ── 情形 1：处于 inWrongWordClear（错词清空完毕，判断是否还有错词） ──
    if (activeCursor.value.inWrongWordClear) {
      data.wrongWords = data.wrongWords.filter(v => !deps.checkWordIsNeedNext(v))

      const cur = activeCursor.value
      const mainPhase =
        getActiveRegistry().phasesByCursor.get(cursorKey(cur.nodeIndex, cur.stepIndex)) ?? phase

      if (data.wrongWords.length > 0) {
        // 继续错词清空
        const endActionIdx = cur.endActionIndex ?? 0
        const action = mainPhase.onEnd[endActionIdx]
        if (action?.type === 'wrongWordClear') {
          // 重置 loop 状态（上一轮可能残留 loop 脏数据），避免 runWordLoop 误判
          activeCursor.value = { ...cur, loop: null }
          data.words = shuffle(cloneDeep(data.wrongWords))
          data.index = 0
          data.wrongWords = []
          syncPhase()
          return true
        }
      }

      // 错词清空完毕，继续下一个 action
      const nextActionIdx = (cur.endActionIndex ?? 0) + 1
      activeCursor.value = { ...cur, inWrongWordClear: false, endActionIndex: null }
      data.isTypingWrongWord = false
      processNextEndAction(mainPhase, nextActionIdx)
      return true
    }

    // ── 情形 2：处于 loop 子步骤（子步骤词表练完）──
    if (activeCursor.value.loop !== null) {
      // loop 词表练完，runWordLoop 会处理 loop 状态转换
      // 这里返回 false，让 next() 继续走 runWordAdvance
      // 注意：loop 子步骤结束时 data.index 已超出 endIndex，runWordLoop 内会检测并退出
      return false
    }

    // ── 情形 2.5：wordLoop 主步骤词表自然结束，最后一组尚未进入 loop 子步骤 ──
    // 例如 20 个词、groupSize=7，前三组 0-6/7-13 正常进入 loop，但最后一组 14-19 因
    // index 停在 19 不满足 19%7===0，导致漏入。这里补刀：词表穷尽时若主步骤是 wordLoop，
    // 将当前未完成的组强行送入 loop 子步骤。
    // 注意：此判断仅在 index 仍处于列表有效范围内生效；若 index 已越界（loop 退出后
    // endIndex+1 == words.length），应走情形 3 的 onEnd / stepAdvance。
    if (!ignoreLoop && phase.wordAdvance.type === 'wordLoop' && data.words.length > 0 && data.index < data.words.length) {
      const groupSize = phase.wordAdvance.groupSize ?? GROUP_SIZE
      const endIndex = data.index
      const groupStart = Math.floor(endIndex / groupSize) * groupSize
      const subSteps = phase.wordAdvance.subSteps

      if (subSteps && subSteps.length > 0) {
        activeCursor.value = {
          ...activeCursor.value,
          loop: { startIndex: groupStart, endIndex, subStepIndex: 0 },
        }
        data.index = groupStart
        emitter.emit(EventKey.resetWord)
        syncPhase()
        return true
      }
    }

    // ── 情形 3：普通主步骤词表练完 → 进入 onEnd 队列 ──
    if (phase.onEnd.length > 0) {
      processNextEndAction(phase, 0)
      return true
    }

    // 无 onEnd，直接 stepAdvance
    data.isTypingWrongWord = false
    runStepAdvance(phase)
    return true
  }

  function atListEnd(data: PracticeData): boolean {
    // loop 子步骤中，词表范围是 [loop.startIndex, loop.endIndex]
    const cur = activeCursor.value
    if (cur.loop !== null) {
      return data.index >= cur.loop.endIndex
    }
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
      const handled = handleListEnd(phase, ignoreLoop)
      if (handled) return
    }

    runWordAdvance(phase)
    syncPhase()

    // loop 子步骤全部完成后 index 可能 == words.length（超出末尾，atListEnd 的 === 检测不到），
    // 此时需补一次 handleListEnd 进入 onEnd / stepAdvance
    if (data.index >= data.words.length && data.words.length > 0) {
      handleListEnd(resolvePhaseByCtxCursor(activeCursor.value), false)
      return
    }

    if (data.words.length > 0 && deps.checkWordIsNeedNext(deps.getCurrentWord())) {
      next(false)
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
    flowVersion: 3,
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
